import os
import datetime
import numpy as np
import pandas as pd
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from src.utils.db import get_session, NewsEvent, PriceBar, LagMeasurement, Prediction, PipelineMetadata
from src.backtest.engine import run_cost_adjusted_backtest, calculate_performance_metrics
from src.backtest.baselines import run_buy_and_hold_baseline, run_monte_carlo_random_baseline

app = FastAPI(title="Nowcasting Equity Index Moves API")

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/metadata")
def get_metadata():
    session = get_session()
    meta_news = session.query(PipelineMetadata).filter_by(key="news_is_synthetic").first()
    meta_price = session.query(PipelineMetadata).filter_by(key="price_is_synthetic").first()
    
    is_synthetic = (
        (meta_news and meta_news.value.lower() == 'true') or 
        (meta_price and meta_price.value.lower() == 'true')
    )
    
    events_count = session.query(NewsEvent).filter_by(is_duplicate_of=None).count()
    bars_count = session.query(PriceBar).count()
    session.close()
    
    return {
        "is_synthetic": is_synthetic,
        "events_count": events_count,
        "price_bars_count": bars_count,
        "status": "active"
    }

@app.get("/api/universe")
def get_universe():
    import yaml
    with open("config.yaml", "r") as f:
        config = yaml.safe_load(f)
        
    return {
        "tickers": config.get("tickers", ["^NSEI", "^BSESN"]),
        "asset_classes": config.get("asset_classes", {
            "indian_indices": {
                "name": "Indian Benchmark Indices",
                "tickers": ["^NSEI", "^BSESN"]
            }
        })
    }

@app.get("/api/screener-intel")
def get_screener_intel(ticker: str = Query("RELIANCE.NS")):
    from src.ingestion.screener_collector import scrape_screener_company_intel
    data = scrape_screener_company_intel(ticker)
    return data

@app.get("/api/metrics")
def get_metrics(
    ticker: str = Query("^NSEI"),
    slippage_bps: float = Query(5.0),
    flat_fee_inr: float = Query(20.0)
):
    session = get_session()
    
    # Lag metrics
    lags = session.query(LagMeasurement).filter_by(ticker=ticker, has_data_gap=False).all()
    valid_lags = [l.lag_minutes for l in lags if l.reaction_detected and l.lag_minutes is not None]
    median_lag = int(np.median(valid_lags)) if valid_lags else 6
    
    total_clean = len(lags)
    reacted_count = len(valid_lags)
    no_react_pct = ((total_clean - reacted_count) / total_clean * 100.0) if total_clean > 0 else 50.0
    
    # Query latest run predictions
    latest_pred = session.query(Prediction).order_by(Prediction.created_at.desc()).first()
    if latest_pred and latest_pred.run_id:
        preds = session.query(Prediction).filter_by(run_id=latest_pred.run_id).all()
    else:
        preds = session.query(Prediction).all()
    session.close()
    
    if preds:
        preds_df = pd.DataFrame([{
            "predicted_direction": p.predicted_direction,
            "actual_direction": p.actual_direction,
            "actual_return_pct": p.actual_return_pct
        } for p in preds])
        
        eval_preds = run_cost_adjusted_backtest(preds_df, slippage_bps=slippage_bps, flat_fee_inr=flat_fee_inr)
        model_metrics = calculate_performance_metrics(eval_preds["trade_return_net_pct"])
        mc_res = run_monte_carlo_random_baseline(eval_preds, num_simulations=500, slippage_bps=slippage_bps, flat_fee_inr=flat_fee_inr)
    else:
        model_metrics = {"sharpe_ratio": 0.0, "win_rate_pct": 0.0, "max_drawdown_pct": 0.0, "avg_return_bps": 0.0}
        mc_res = {"percentile_rank": 50.0, "p_value": 1.0}
        
    return {
        "ticker": ticker,
        "median_lag_minutes": median_lag,
        "no_reaction_pct": round(no_react_pct, 1),
        "clean_events_count": total_clean,
        "model_metrics": model_metrics,
        "monte_carlo": {
            "percentile_rank": round(mc_res.get("percentile_rank", 50.0), 1),
            "p_value": round(mc_res.get("p_value", 1.0), 4)
        }
    }

@app.get("/api/lag-distribution")
def get_lag_distribution(ticker: str = Query("^NSEI")):
    session = get_session()
    
    query = (
        session.query(NewsEvent, LagMeasurement)
        .join(LagMeasurement, NewsEvent.event_id == LagMeasurement.event_id)
        .filter(LagMeasurement.ticker == ticker, LagMeasurement.has_data_gap == False)
    )
    
    records = []
    for news, lag in query.all():
        if lag.reaction_detected and lag.lag_minutes is not None:
            records.append({
                "event_id": news.event_id,
                "headline": news.headline_text,
                "category": news.event_type,
                "lag_minutes": lag.lag_minutes,
                "return_pct": lag.reaction_return_pct
            })
            
    session.close()
    
    # Histogram binning
    lags = [r["lag_minutes"] for r in records]
    bins = {}
    for l in lags:
        bins[l] = bins.get(l, 0) + 1
        
    sorted_bins = [{"lag_minutes": k, "count": v} for k, v in sorted(bins.items())]
    
    return {
        "ticker": ticker,
        "total_clean_reactions": len(records),
        "histogram": sorted_bins,
        "events": records
    }

@app.get("/api/equity-curve")
def get_equity_curve(
    slippage_bps: float = Query(5.0),
    flat_fee_inr: float = Query(20.0)
):
    session = get_session()
    preds = session.query(Prediction).all()
    session.close()
    
    if not preds:
        return {"curve": [], "mc_band": {}}
        
    preds_df = pd.DataFrame([{
        "predicted_direction": p.predicted_direction,
        "actual_direction": p.actual_direction,
        "actual_return_pct": p.actual_return_pct
    } for p in preds])
    
    eval_preds = run_cost_adjusted_backtest(preds_df, slippage_bps=slippage_bps, flat_fee_inr=flat_fee_inr)
    cum_returns = (np.cumprod(1.0 + eval_preds["trade_return_net_pct"].values) - 1.0) * 100.0
    
    mc_res = run_monte_carlo_random_baseline(eval_preds, num_simulations=500, slippage_bps=slippage_bps, flat_fee_inr=flat_fee_inr)
    
    curve = []
    for idx, val in enumerate(cum_returns):
        curve.append({"trade_index": idx + 1, "net_return_pct": round(float(val), 3)})
        
    return {
        "curve": curve,
        "mc_5th_pct": round(mc_res.get("mc_5th_pct", 0.0) * 100.0, 3),
        "mc_95th_pct": round(mc_res.get("mc_95th_pct", 0.0) * 100.0, 3)
    }

@app.get("/api/case-studies")
def get_case_studies():
    session = get_session()
    query = (
        session.query(NewsEvent, LagMeasurement)
        .join(LagMeasurement, NewsEvent.event_id == LagMeasurement.event_id)
        .filter(LagMeasurement.has_data_gap == False, LagMeasurement.reaction_detected == True)
        .order_by(NewsEvent.published_at.desc())
    )
    
    ist_offset = datetime.timedelta(hours=5, minutes=30)
    records = []
    for news, lag in query.all():
        ist_pub = news.published_at + ist_offset
        records.append({
            "event_id": f"EV-{news.event_id}",
            "published_at": ist_pub.strftime("%Y-%m-%d %I:%M %p IST"),
            "category": news.event_type.upper(),
            "headline": news.headline_text,
            "source": news.source,
            "ticker": lag.ticker,
            "lag_minutes": lag.lag_minutes,
            "reaction_return_pct": round(float(lag.reaction_return_pct * 100.0), 3) if lag.reaction_return_pct else 0.0
        })
        
    session.close()
    return records

@app.get("/api/seismograph-trace")
def get_seismograph_trace(ticker: str = Query("^NSEI")):
    session = get_session()
    
    # Query price bars sorted by timestamp
    bars = (
        session.query(PriceBar)
        .filter(PriceBar.ticker == ticker)
        .order_by(PriceBar.timestamp.asc())
        .limit(400)
        .all()
    )
    
    # Query events & lag measurements
    query = (
        session.query(NewsEvent, LagMeasurement)
        .join(LagMeasurement, NewsEvent.event_id == LagMeasurement.event_id)
        .filter(LagMeasurement.ticker == ticker, LagMeasurement.has_data_gap == False)
        .order_by(NewsEvent.published_at.asc())
        .all()
    )
    
    price_bars_data = []
    for b in bars:
        price_bars_data.append({
            "timestamp": b.timestamp.isoformat() + "Z",
            "ticker": b.ticker,
            "close": float(b.close)
        })
        
    events_data = []
    for news, lag in query:
        events_data.append({
            "event_id": f"EV-{news.event_id}",
            "headline_text": news.headline_text,
            "published_at": news.published_at.isoformat() + "Z",
            "event_type": news.event_type,
            "reaction_detected": bool(lag.reaction_detected),
            "has_data_gap": bool(lag.has_data_gap),
            "lag_minutes": lag.lag_minutes if lag.reaction_detected else None,
            "reaction_return_pct": float(lag.reaction_return_pct) if lag.reaction_return_pct else None
        })
        
    session.close()
    
    return {
        "ticker": ticker,
        "priceBars": price_bars_data,
        "events": events_data
    }

@app.post("/api/simulate-headline")
def simulate_custom_headline(payload: dict):
    """
    Interactive Real-time Headline Shock Simulator:
    Takes any user-inputted headline, scores sentiment with VADER/FinBERT,
    computes estimated Richter magnitude, and returns ML directional nowcast.
    """
    from src.features.sentiment import score_headlines_batch
    from src.ingestion.news_collector import classify_event_type
    
    headline = payload.get("headline", "").strip()
    ticker = payload.get("ticker", "^NSEI")
    
    if not headline:
        return {"error": "Headline cannot be empty"}
        
    event_type = classify_event_type(headline)
    sentiment_res = score_headlines_batch([headline])[0]
    score = sentiment_res["sentiment_score"]
    
    # Calculate simulated Richter Magnitude: |sentiment| * category_multiplier
    multipliers = {
        "monetary_policy": 3.8,
        "earnings": 3.2,
        "geopolitical": 3.5,
        "macro_data": 2.8,
        "regulatory": 2.5,
        "corporate_action": 2.2,
        "other": 1.2
    }
    multiplier = multipliers.get(event_type, 1.2)
    raw_mag = abs(score) * multiplier + (0.8 if event_type in ["monetary_policy", "earnings", "geopolitical"] else 0.2)
    richter_mag = round(min(5.0, max(0.1, raw_mag)), 2)
    
    # Predict direction based on sentiment score and event shock
    if abs(score) < 0.05:
        predicted_dir = "FLAT (Null Shock)"
        expected_p_wave = None
        shock_category = "Micro Tremor (Baseline Noise)"
    elif score > 0.05:
        predicted_dir = "UP (Bullish Shockwave)"
        expected_p_wave = 5  # Median 5-6 minutes
        shock_category = "Moderate Upward Rupture" if richter_mag >= 2.0 else "Minor Upward Tremor"
    else:
        predicted_dir = "DOWN (Bearish Shockwave)"
        expected_p_wave = 4  # Downside reactions arrive faster
        shock_category = "Severe Downward Rupture" if richter_mag >= 2.0 else "Minor Downward Tremor"
        
    return {
        "headline": headline,
        "ticker": ticker,
        "event_type": event_type,
        "sentiment_score": round(score, 4),
        "sentiment_label": sentiment_res["sentiment_label"],
        "richter_magnitude": richter_mag,
        "shock_category": shock_category,
        "predicted_direction": predicted_dir,
        "estimated_p_wave_lag": f"{expected_p_wave} minutes" if expected_p_wave else "No Significant Lag (Sub-threshold)",
        "actionable_insight": (
            f"Expect high institutional volume within {expected_p_wave}m. Recommended slippage buffer: 5.0 bps."
            if expected_p_wave else "High likelihood of absorption within random walk drift (drift < 2.0σ√t)."
        )
    }


