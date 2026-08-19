import pandas as pd
from sqlalchemy.orm import Session
from src.utils.db import get_session, NewsEvent, LagMeasurement, EventFeature

def get_reaction_case_studies(db_path="data/db.sqlite"):
    session = get_session(db_path=db_path)
    
    query = (
        session.query(NewsEvent, LagMeasurement, EventFeature)
        .join(LagMeasurement, NewsEvent.event_id == LagMeasurement.event_id)
        .outerjoin(EventFeature, NewsEvent.event_id == EventFeature.event_id)
        .filter(LagMeasurement.reaction_detected == True)
        .order_by(NewsEvent.published_at.desc())
    )
    
    records = []
    for news, lag, feat in query.all():
        records.append({
            "event_id": news.event_id,
            "headline": news.headline_text,
            "published_at": news.published_at.strftime("%Y-%m-%d %H:%M:%S UTC"),
            "event_type": news.event_type,
            "source": news.source,
            "ticker": lag.ticker,
            "lag_minutes": lag.lag_minutes,
            "reaction_return_pct": f"{lag.reaction_return_pct * 100:.3f}%" if lag.reaction_return_pct else "0.000%",
            "sentiment_label": feat.sentiment_label if feat else "neutral",
            "sentiment_score": f"{feat.sentiment_score:.2f}" if feat else "0.00"
        })
        
    session.close()
    return pd.DataFrame(records)

if __name__ == "__main__":
    df = get_reaction_case_studies()
    print(f"\n================ EMPIRICAL REACTION CASE STUDIES ({len(df)} DETECTED EVENTS) ================\n")
    if not df.empty:
        for idx, row in df.iterrows():
            print(f"[{row['published_at']}] [{row['event_type'].upper()}] (Lag: {row['lag_minutes']} min | Move: {row['reaction_return_pct']})")
            print(f"Headline: {row['headline']}")
            print(f"Source: {row['source']} | Ticker: {row['ticker']} | Sentiment: {row['sentiment_label']} ({row['sentiment_score']})\n" + "-"*80)
    else:
        print("No reaction events detected in current dataset.")
