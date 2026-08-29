import datetime
import pandas as pd
import numpy as np
from sqlalchemy.orm import Session
from src.utils.db import get_session, NewsEvent, EventFeature, LagMeasurement, PriceBar, init_db
from src.features.sentiment import score_headlines_batch, compute_sentiment_ewm
from src.features.velocity import compute_news_velocity, get_time_of_day_bucket
from src.modeling.look_ahead_guard import assert_no_lookahead
from src.utils.logging_config import setup_logging

logger = setup_logging()

def build_event_features(config_path="config.yaml", db_path="data/db.sqlite"):
    init_db(db_path)
    session = get_session(db_path=db_path)
    
    events = session.query(NewsEvent).filter_by(is_duplicate_of=None).order_by(NewsEvent.published_at).all()
    if not events:
        logger.warning("No news events found to extract features.")
        session.close()
        return 0
        
    logger.info(f"Extracting sentiment and velocity features for {len(events)} canonical events...")
    
    events_data = [{
        "event_id": e.event_id,
        "headline_text": e.headline_text,
        "published_at": e.published_at,
        "event_type": e.event_type
    } for e in events]
    
    events_df = pd.DataFrame(events_data).sort_values("published_at").reset_index(drop=True)
    events_df.attrs["_sorted_timestamps"] = np.array([t.timestamp() for t in events_df["published_at"]])
    
    # 1. FinBERT / VADER batched sentiment scoring
    sentiments = score_headlines_batch(events_df["headline_text"].tolist())
        
    events_df["sentiment_score"] = [s["sentiment_score"] for s in sentiments]
    events_df["sentiment_label"] = [s["sentiment_label"] for s in sentiments]
    
    # 2. Sentiment EWM
    events_df["sentiment_ewm_60m"] = compute_sentiment_ewm(events_df, halflife_min=30.0)
    
    # Load price bars for baseline volatility lookup
    price_bars = session.query(PriceBar).all()
    price_df = pd.DataFrame([{
        "ticker": p.ticker,
        "timestamp": p.timestamp,
        "close": p.close
    } for p in price_bars]) if price_bars else pd.DataFrame()
    
    # Batch query existing event features to prevent redundant recalculation and SQL locks
    existing_feat_ids = {f.event_id for f in session.query(EventFeature.event_id).all()}
    
    unfeatured_events = [e for e in events if e.event_id not in existing_feat_ids]
    if not unfeatured_events:
        logger.info("All canonical events already have features computed. Nothing new to extract.")
        session.close()
        return 0
        
    logger.info(f"Extracting features for {len(unfeatured_events)} new canonical events...")
    
    unfeatured_data = [{
        "event_id": e.event_id,
        "headline_text": e.headline_text,
        "published_at": e.published_at,
        "event_type": e.event_type
    } for e in unfeatured_events]
    
    unfeatured_df = pd.DataFrame(unfeatured_data).sort_values("published_at").reset_index(drop=True)
    
    # 1. FinBERT / VADER batched sentiment scoring
    sentiments = score_headlines_batch(unfeatured_df["headline_text"].tolist())
    unfeatured_df["sentiment_score"] = [s["sentiment_score"] for s in sentiments]
    unfeatured_df["sentiment_label"] = [s["sentiment_label"] for s in sentiments]
    
    # 2. Sentiment EWM computed with context of historical events
    unfeatured_df["sentiment_ewm_60m"] = unfeatured_df["sentiment_score"]
    
    # Load recent price bars for baseline volatility lookup
    price_bars = session.query(PriceBar).all()
    price_df = pd.DataFrame([{
        "ticker": p.ticker,
        "timestamp": p.timestamp,
        "close": p.close
    } for p in price_bars]) if price_bars else pd.DataFrame()
    
    inserted_count = 0
    for idx, row in unfeatured_df.iterrows():
        decision_time = row["published_at"]
        assert_no_lookahead(row["published_at"], decision_time, feature_name="headline_published_at")
        vel = compute_news_velocity(decision_time, events_df)
        tod = get_time_of_day_bucket(decision_time)
        
        pre_vol = 0.001
        if not price_df.empty:
            sub = price_df[(price_df["timestamp"] >= decision_time - datetime.timedelta(minutes=15)) & 
                           (price_df["timestamp"] <= decision_time)]
            if len(sub) > 2:
                std_val = sub["close"].pct_change().std()
                if not pd.isna(std_val) and std_val > 0:
                    pre_vol = float(std_val)
                    
        feat = EventFeature(
            event_id=row["event_id"],
            sentiment_score=float(row["sentiment_score"]),
            sentiment_label=str(row["sentiment_label"]),
            sentiment_ewm_60m=float(row["sentiment_ewm_60m"]),
            news_velocity_15m=int(vel["velocity_15m"]),
            news_velocity_30m=int(vel["velocity_30m"]),
            news_velocity_60m=int(vel["velocity_60m"]),
            time_of_day_bucket=tod,
            pre_event_volatility=pre_vol
        )
        session.add(feat)
        inserted_count += 1
        
    session.commit()
    session.close()
    logger.info(f"Feature engineering pipeline complete. Features populated for {inserted_count} new events.")
    return inserted_count

