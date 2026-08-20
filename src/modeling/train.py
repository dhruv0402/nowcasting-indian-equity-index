import datetime
import yaml
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import classification_report, accuracy_score
from sqlalchemy.orm import Session
from src.utils.db import get_session, NewsEvent, EventFeature, LagMeasurement, PriceBar, Prediction, init_db
from src.utils.logging_config import setup_logging

logger = setup_logging()

def load_training_dataset(session: Session, ticker: str = "^NSEI") -> pd.DataFrame:
    """
    Joins NewsEvent, EventFeature, LagMeasurement, and PriceBar data to build
    the training feature matrix and target labels.
    """
    # Only train/evaluate on clean in-session events without feed gaps
    clean_lags = session.query(LagMeasurement).filter_by(ticker=ticker, has_data_gap=False).all()
    clean_event_ids = {l.event_id for l in clean_lags}
    
    events = (
        session.query(NewsEvent)
        .filter(NewsEvent.is_duplicate_of.is_(None), NewsEvent.event_id.in_(clean_event_ids))
        .order_by(NewsEvent.published_at)
        .all()
    )
    if not events:
        return pd.DataFrame()
        
    # Calculate empirical median lag among clean events
    lag_vals = [l.lag_minutes for l in clean_lags if l.lag_minutes is not None]
    median_lag = int(np.median(lag_vals)) if lag_vals else 6
    
    price_bars = session.query(PriceBar).filter_by(ticker=ticker).order_by(PriceBar.timestamp).all()
    if not price_bars:
        return pd.DataFrame()
        
    price_df = pd.DataFrame([{
        "timestamp": p.timestamp,
        "close": p.close
    } for p in price_bars]).sort_values("timestamp").reset_index(drop=True)
    
    # Batch load all events and features in memory to avoid per-event SQL queries
    events = session.query(NewsEvent).all()
    event_map = {e.event_id: e for e in events}
    event_features = session.query(EventFeature).all()
    feature_map = {f.event_id: f for f in event_features}
    
    rows = []
    for l in clean_lags:
        e = event_map.get(l.event_id)
        feat = feature_map.get(l.event_id)
        if not e or not feat:
            continue
            
        t_pub = e.published_at
        # Prediction window: [T + median_lag, T + median_lag + 15m]
        t_entry = t_pub + datetime.timedelta(minutes=median_lag)
        t_exit = t_entry + datetime.timedelta(minutes=15)
        
        # Enforce that entry and exit bars must exist within 5 minutes of target time (no overnight jumps)
        entry_candidates = price_df[
            (price_df["timestamp"] >= t_entry) & 
            (price_df["timestamp"] <= t_entry + datetime.timedelta(minutes=5))
        ]
        exit_candidates = price_df[
            (price_df["timestamp"] >= t_exit) & 
            (price_df["timestamp"] <= t_exit + datetime.timedelta(minutes=5))
        ]
        
        if entry_candidates.empty or exit_candidates.empty:
            continue
            
        p_entry = entry_candidates["close"].values[0]
        p_exit = exit_candidates["close"].values[0]
        actual_ret = (p_exit - p_entry) / p_entry
        
        # Deadband target classification (+/- 0.05% = +/- 0.0005)
        if actual_ret > 0.0005:
            target_dir = "up"
            target_label = 1
        elif actual_ret < -0.0005:
            target_dir = "down"
            target_label = -1
        else:
            target_dir = "flat"
            target_label = 0
            
        rows.append({
            "event_id": e.event_id,
            "published_at": t_pub,
            "event_type": e.event_type,
            "sentiment_score": feat.sentiment_score,
            "sentiment_ewm_60m": feat.sentiment_ewm_60m,
            "news_velocity_15m": feat.news_velocity_15m,
            "news_velocity_30m": feat.news_velocity_30m,
            "news_velocity_60m": feat.news_velocity_60m,
            "time_of_day_bucket": feat.time_of_day_bucket,
            "pre_event_volatility": feat.pre_event_volatility,
            "actual_return_pct": float(actual_ret),
            "actual_direction": target_dir,
            "target_label": target_label
        })
        
    df = pd.DataFrame(rows)
    return df

def train_nowcasting_model(config_path="config.yaml", db_path="data/db.sqlite"):
    init_db(db_path)
    session = get_session(db_path=db_path)
    
    with open(config_path, "r") as f:
        config = yaml.safe_load(f)
        
    tickers = config.get("tickers", ["^NSEI"])
    df = load_training_dataset(session, ticker=tickers[0])
    
    if df.empty or len(df) < 10:
        logger.warning("Insufficient dataset size to train XGBoost model. Requires at least 10 events.")
        session.close()
        return None, {}
        
    df = df.sort_values("published_at").reset_index(drop=True)
    
    # Feature matrix encoding
    feature_cols = [
        "sentiment_score", "sentiment_ewm_60m",
        "news_velocity_15m", "news_velocity_30m", "news_velocity_60m",
        "pre_event_volatility"
    ]
    
    # One-hot encode event_type and time_of_day_bucket
    df_encoded = pd.get_dummies(df, columns=["event_type", "time_of_day_bucket"], drop_first=False)
    encoded_feature_cols = [c for c in df_encoded.columns if c not in [
        "event_id", "published_at", "actual_return_pct", "actual_direction", "target_label"
    ]]
    
    X = df_encoded[encoded_feature_cols]
    y = df_encoded["target_label"]
    
    # Map target label -1, 0, 1 to 0, 1, 2 for XGBoost
    label_map = {-1: 0, 0: 1, 1: 2}
    reverse_map = {0: "down", 1: "flat", 2: "up"}
    y_mapped = y.map(label_map)
    
    # Chronological 80/20 train/test split (never random split)
    split_idx = int(len(X) * 0.8)
    X_train, X_test = X.iloc[:split_idx], X.iloc[split_idx:]
    y_train, y_test = y_mapped.iloc[:split_idx], y_mapped.iloc[split_idx:]
    test_events = df.iloc[split_idx:]
    
    logger.info(f"Training XGBoost classifier (Train size: {len(X_train)}, Test size: {len(X_test)})...")
    
    model = xgb.XGBClassifier(
        n_estimators=100,
        max_depth=4,
        learning_rate=0.05,
        random_state=config.get("model", {}).get("random_state", 42)
    )
    
    model.fit(X_train, y_train)
    
    preds = model.predict(X_test)
    probs = model.predict_proba(X_test)
    
    acc = accuracy_score(y_test, preds)
    logger.info(f"Chronological Test Accuracy: {acc:.4f}")
    
    # Generate unique run_id for historical run tracking (no delete needed)
    run_id = f"run_{datetime.datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
    
    cost_cfg = config.get("backtest", {})
    slippage_bps = cost_cfg.get("slippage_bps", 5.0)
    flat_fee = cost_cfg.get("brokerage_flat_fee_inr", 20.0)
    cost_pct = (slippage_bps / 10000.0) + (flat_fee / 240000.0)  # approx cost fraction
    
    for i, (_, row) in enumerate(test_events.iterrows()):
        pred_label_idx = preds[i]
        pred_dir = reverse_map[pred_label_idx]
        conf = float(np.max(probs[i]))
        actual_ret = row["actual_return_pct"]
        
        # Calculate net trade return after costs
        if pred_dir == "up":
            gross_ret = actual_ret
        elif pred_dir == "down":
            gross_ret = -actual_ret
        else:
            gross_ret = 0.0
            
        net_ret = (gross_ret - cost_pct) if pred_dir != "flat" else 0.0
        
        pred_id = f"{run_id}_{row['event_id']}"
        pred_obj = Prediction(
            prediction_id=pred_id,
            run_id=run_id,
            event_id=row["event_id"],
            model_version="xgb_v1",
            predicted_direction=pred_dir,
            predicted_confidence=conf,
            actual_direction=row["actual_direction"],
            actual_return_pct=actual_ret,
            trade_return_net_pct=net_ret,
            created_at=datetime.datetime.utcnow()
        )
        session.add(pred_obj)
            
    session.commit()
    
    # Feature importances
    importances = dict(zip(encoded_feature_cols, [float(v) for v in model.feature_importances_]))
    
    session.close()
    return model, importances
