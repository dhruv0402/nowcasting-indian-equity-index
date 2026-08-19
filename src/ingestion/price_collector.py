import datetime
import yaml
import yfinance as yf
import pandas as pd
import numpy as np
from sqlalchemy.orm import Session
from src.utils.db import get_session, PriceBar, NewsEvent, init_db, PipelineMetadata
from src.utils.logging_config import setup_logging

logger = setup_logging()

def fetch_yfinance_minute_data(ticker: str, period: str = "7d") -> pd.DataFrame:
    logger.info(f"Fetching minute price data for {ticker} (period={period}) via yfinance...")
    try:
        df = yf.download(ticker, period=period, interval="1m", progress=False)
        if df.empty:
            logger.warning(f"No minute data returned for {ticker}.")
            return pd.DataFrame()
            
        # Clean multi-index columns if present
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
            
        df = df.reset_index()
        # Rename timestamp column
        time_col = [c for c in df.columns if "date" in c.lower() or "time" in c.lower()][0]
        df = df.rename(columns={
            time_col: "timestamp",
            "Open": "open",
            "High": "high",
            "Low": "low",
            "Close": "close",
            "Volume": "volume"
        })
        
        # Convert timestamp to naive UTC datetime
        df['timestamp'] = pd.to_datetime(df['timestamp']).dt.tz_localize(None)
        df['ticker'] = ticker
        df['is_synthetic'] = False
        return df[['ticker', 'timestamp', 'open', 'high', 'low', 'close', 'volume', 'is_synthetic']]
    except Exception as e:
        logger.error(f"Failed to fetch yfinance data for {ticker}: {e}")
        return pd.DataFrame()

def generate_synthetic_price_series(ticker: str, start_time: datetime.datetime, end_time: datetime.datetime) -> pd.DataFrame:
    logger.info(f"Generating synthetic minute price series for {ticker} from {start_time} to {end_time}...")
    
    # Generate minute range
    minutes = pd.date_range(start=start_time, end=end_time, freq="1min")
    if len(minutes) == 0:
        return pd.DataFrame()
        
    base_price = 24000.0 if ticker == "^NSEI" else 79000.0
    
    # Geometric Brownian Motion simulation with intraday volatility
    dt = 1.0 / (375.0 * 252.0)  # minute step in trading year
    mu = 0.05
    sigma = 0.18
    
    n = len(minutes)
    returns = np.random.normal(loc=(mu - 0.5 * sigma**2) * dt, scale=sigma * np.sqrt(dt), size=n)
    
    price_path = base_price * np.exp(np.cumsum(returns))
    
    records = []
    for i in range(n):
        c = price_path[i]
        h = c * (1.0 + abs(np.random.normal(0, 0.0005)))
        l = c * (1.0 - abs(np.random.normal(0, 0.0005)))
        o = price_path[i-1] if i > 0 else c
        v = int(np.random.poisson(1500))
        
        records.append({
            "ticker": ticker,
            "timestamp": minutes[i].to_pydatetime(),
            "open": float(o),
            "high": float(max(h, o, c)),
            "low": float(min(l, o, c)),
            "close": float(c),
            "volume": v,
            "is_synthetic": True
        })
        
    return pd.DataFrame(records)

def inject_synthetic_news_shocks(price_df: pd.DataFrame, news_events: list) -> pd.DataFrame:
    """
    Injects synthetic price reactions following news event timestamps to create 
    controlled empirical lag ground truth for synthetic testing.
    """
    if price_df.empty or not news_events:
        return price_df
        
    price_df = price_df.sort_values("timestamp").reset_index(drop=True)
    timestamps = price_df["timestamp"].tolist()
    closes = price_df["close"].values.copy()
    
    for event in news_events:
        pub_time = event.published_at
        event_type = event.event_type
        
        # Determine reaction direction based on headline sentiment/keywords
        direction = 1 if any(w in event.headline_text.lower() for w in ["beat", "up", "surge", "jump", "eases", "high", "growth"]) else -1
        
        # Inject realistic lag between 2 and 18 minutes
        lag_mins = np.random.randint(3, 15)
        impact_start = pub_time + datetime.timedelta(minutes=lag_mins)
        
        # Apply step shock over next 5 minutes
        for i, ts in enumerate(timestamps):
            if impact_start <= ts <= impact_start + datetime.timedelta(minutes=15):
                magnitude = 0.003 * direction * (1.0 if event_type in ["monetary_policy", "earnings"] else 0.5)
                closes[i:] *= (1.0 + magnitude / 15.0)
                
    price_df["close"] = closes
    price_df["high"] = np.maximum(price_df["high"], price_df["close"])
    price_df["low"] = np.minimum(price_df["low"], price_df["close"])
    return price_df

def run_price_ingestion(config_path="config.yaml", use_synthetic=False, db_path="data/db.sqlite"):
    init_db(db_path)
    session = get_session(db_path=db_path)
    
    with open(config_path, "r") as f:
        config = yaml.safe_load(f)
        
    tickers = config.get("tickers", ["^NSEI", "^BSESN"])
    
    # Query min/max news dates to align price bar range
    news_events = session.query(NewsEvent).all()
    if news_events:
        min_date = min(e.published_at for e in news_events) - datetime.timedelta(hours=2)
        max_date = max(e.published_at for e in news_events) + datetime.timedelta(hours=4)
    else:
        min_date = datetime.datetime.utcnow() - datetime.timedelta(days=7)
        max_date = datetime.datetime.utcnow()
        
    total_bars = 0
    price_is_synthetic = use_synthetic
    
    for ticker in tickers:
        df = pd.DataFrame()
        if not use_synthetic:
            df = fetch_yfinance_minute_data(ticker=ticker, period="7d")
            
        if df.empty:
            logger.warning(f"Using synthetic price generation for {ticker}.")
            price_is_synthetic = True
            df = generate_synthetic_price_series(ticker, min_date, max_date)
            if news_events:
                df = inject_synthetic_news_shocks(df, news_events)
                
        # Insert bars into DB
        bars_to_insert = []
        for _, row in df.iterrows():
            existing = session.query(PriceBar).filter_by(ticker=row["ticker"], timestamp=row["timestamp"]).first()
            if not existing:
                bar = PriceBar(
                    ticker=row["ticker"],
                    timestamp=row["timestamp"],
                    open=float(row["open"]),
                    high=float(row["high"]),
                    low=float(row["low"]),
                    close=float(row["close"]),
                    volume=int(row["volume"]),
                    is_synthetic=bool(row["is_synthetic"])
                )
                bars_to_insert.append(bar)
                
        session.bulk_save_objects(bars_to_insert)
        session.commit()
        total_bars += len(bars_to_insert)
        logger.info(f"Inserted {len(bars_to_insert)} price bars for {ticker}.")
        
    # Save metadata flag
    meta = session.query(PipelineMetadata).filter_by(key="price_is_synthetic").first()
    if not meta:
        meta = PipelineMetadata(key="price_is_synthetic", value=str(price_is_synthetic))
        session.add(meta)
    else:
        meta.value = str(price_is_synthetic)
        
    session.commit()
    session.close()
    logger.info(f"Price ingestion complete. Total bars stored: {total_bars} (Is Synthetic: {price_is_synthetic}).")
    return total_bars
