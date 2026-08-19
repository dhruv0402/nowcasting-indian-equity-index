import datetime
import yaml
import numpy as np
import pandas as pd
from sqlalchemy.orm import Session
from src.utils.db import get_session, NewsEvent, PriceBar, LagMeasurement, init_db
from src.utils.logging_config import setup_logging

logger = setup_logging()

def measure_event_lag(
    event_published_at: datetime.datetime,
    price_df: pd.DataFrame,
    baseline_window_min: int = 15,
    reaction_window_min: int = 60,
    std_threshold: float = 2.0,
    max_allowed_gap_min: int = 5
) -> dict:
    """
    Computes empirical reaction lag for a single news event with feed gap protection.
    Returns dict with keys: reaction_detected, lag_minutes, reaction_return_pct, baseline_volatility, has_data_gap.
    """
    if price_df.empty:
        return {
            "reaction_detected": False,
            "lag_minutes": None,
            "reaction_return_pct": 0.0,
            "baseline_volatility": 0.0,
            "has_data_gap": True
        }
        
    price_df = price_df.sort_values("timestamp").reset_index(drop=True)
    
    t_start_baseline = event_published_at - datetime.timedelta(minutes=baseline_window_min)
    t_end_reaction = event_published_at + datetime.timedelta(minutes=reaction_window_min)
    
    # 1. Baseline bars strictly prior to or at event_published_at
    baseline_bars = price_df[
        (price_df["timestamp"] >= t_start_baseline) & 
        (price_df["timestamp"] <= event_published_at)
    ]
    
    # Check if a valid price bar exists close to T (within 30 minutes)
    prior_bars = price_df[
        (price_df["timestamp"] >= event_published_at - datetime.timedelta(minutes=30)) &
        (price_df["timestamp"] <= event_published_at)
    ]
    
    if prior_bars.empty:
        # Event occurred during market off-hours or a large pre-event gap
        return {
            "reaction_detected": False,
            "lag_minutes": None,
            "reaction_return_pct": 0.0,
            "baseline_volatility": 0.0,
            "has_data_gap": True
        }
        
    price_at_t = float(prior_bars["close"].iloc[-1])
    time_at_t = prior_bars["timestamp"].iloc[-1]
    
    # 2. Reaction bars strictly post-event
    reaction_bars = price_df[
        (price_df["timestamp"] > event_published_at) & 
        (price_df["timestamp"] <= t_end_reaction)
    ]
    
    if reaction_bars.empty:
        return {
            "reaction_detected": False,
            "lag_minutes": None,
            "reaction_return_pct": 0.0,
            "baseline_volatility": 0.0,
            "has_data_gap": True
        }
        
    # Check gap between event_published_at and first available post-event bar
    first_post_time = reaction_bars["timestamp"].iloc[0]
    initial_gap_min = (first_post_time - event_published_at).total_seconds() / 60.0
    
    has_data_gap = False
    if initial_gap_min > max_allowed_gap_min:
        has_data_gap = True
        
    # Baseline volatility calculation
    if len(baseline_bars) >= 3:
        baseline_returns = baseline_bars["close"].pct_change().dropna()
        baseline_vol = baseline_returns.std()
    else:
        # Use prior 15 bars if baseline window is sparse
        baseline_vol = prior_bars["close"].pct_change().std() if len(prior_bars) > 1 else 0.0005
        
    if np.isnan(baseline_vol) or baseline_vol == 0:
        baseline_vol = 0.0005  # minimum floor
        
    threshold = std_threshold * baseline_vol
    
    # Scan minute-by-minute in post-event window
    prev_time = time_at_t
    for _, bar in reaction_bars.iterrows():
        cur_time = bar["timestamp"]
        step_gap_min = (cur_time - prev_time).total_seconds() / 60.0
        
        if step_gap_min > max_allowed_gap_min:
            has_data_gap = True
            
        cumulative_return = abs((bar["close"] - price_at_t) / price_at_t)
        
        if cumulative_return >= threshold:
            # If a data gap occurred prior to detection, flag has_data_gap
            lag_sec = (cur_time - event_published_at).total_seconds()
            lag_mins = max(1, int(round(lag_sec / 60.0)))
            actual_return = (bar["close"] - price_at_t) / price_at_t
            
            return {
                "reaction_detected": True if not has_data_gap else False,  # exclude gap reactions
                "lag_minutes": lag_mins if not has_data_gap else None,
                "reaction_return_pct": float(actual_return),
                "baseline_volatility": float(baseline_vol),
                "has_data_gap": has_data_gap
            }
            
        prev_time = cur_time
        
    return {
        "reaction_detected": False,
        "lag_minutes": None,
        "reaction_return_pct": 0.0,
        "baseline_volatility": float(baseline_vol),
        "has_data_gap": has_data_gap
    }

def run_lag_engine(config_path="config.yaml", db_path="data/db.sqlite"):
    init_db(db_path)
    session = get_session(db_path=db_path)
    
    with open(config_path, "r") as f:
        config = yaml.safe_load(f)
        
    lag_cfg = config.get("lag_detection", {})
    b_window = lag_cfg.get("baseline_window_min", 15)
    r_window = lag_cfg.get("reaction_window_min", 60)
    std_thresh = lag_cfg.get("significance_std_threshold", 2.0)
    tickers = config.get("tickers", ["^NSEI"])
    
    news_events = session.query(NewsEvent).filter_by(is_duplicate_of=None).all()
    logger.info(f"Processing lag measurement with gap-protection for {len(news_events)} canonical events...")
    
    total_measured = 0
    detected_count = 0
    gap_count = 0
    
    for ticker in tickers:
        price_bars = session.query(PriceBar).filter_by(ticker=ticker).all()
        if not price_bars:
            continue
            
        price_df = pd.DataFrame([{
            "timestamp": b.timestamp,
            "open": b.open,
            "high": b.high,
            "low": b.low,
            "close": b.close,
            "volume": b.volume
        } for b in price_bars])
        
        for event in news_events:
            result = measure_event_lag(
                event_published_at=event.published_at,
                price_df=price_df,
                baseline_window_min=b_window,
                reaction_window_min=r_window,
                std_threshold=std_thresh
            )
            
            existing = session.query(LagMeasurement).filter_by(event_id=event.event_id).first()
            if not existing:
                lag_obj = LagMeasurement(
                    event_id=event.event_id,
                    ticker=ticker,
                    reaction_detected=result["reaction_detected"],
                    lag_minutes=result["lag_minutes"],
                    reaction_return_pct=result["reaction_return_pct"],
                    has_data_gap=result["has_data_gap"],
                    measured_at=datetime.datetime.utcnow()
                )
                session.add(lag_obj)
            else:
                existing.reaction_detected = result["reaction_detected"]
                existing.lag_minutes = result["lag_minutes"]
                existing.reaction_return_pct = result["reaction_return_pct"]
                existing.has_data_gap = result["has_data_gap"]
                existing.measured_at = datetime.datetime.utcnow()
                
            total_measured += 1
            if result["has_data_gap"]:
                gap_count += 1
            elif result["reaction_detected"]:
                detected_count += 1
                
    session.commit()
    session.close()
    
    valid_events = total_measured - gap_count
    pct_detected = (detected_count / valid_events * 100.0) if valid_events > 0 else 0.0
    logger.info(
        f"Lag engine complete. Processed {total_measured} pairs. "
        f"Excluded due to feed gaps: {gap_count}. Valid clean reactions detected: {detected_count} ({pct_detected:.1f}%)."
    )
    return detected_count
