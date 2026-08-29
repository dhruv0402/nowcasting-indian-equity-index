import os
import sys
import time
import datetime
import argparse

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from src.ingestion.news_collector import run_news_ingestion
from src.ingestion.price_collector import run_price_ingestion
from src.features.lag_engine import run_lag_engine
from src.features.feature_pipeline import build_event_features
from src.utils.logging_config import setup_logging

logger = setup_logging()

def get_active_tickers_for_time(config: dict, utc_dt: datetime.datetime = None) -> list:
    """
    Determines which tickers are actively trading based on their asset class and UTC time:
    - Crypto (BTC-USD, ETH-USD): 24/7 continuous trading
    - Indian Markets (^NSEI, ^BSESN, RELIANCE.NS, etc.): Mon-Fri 03:45 to 10:00 UTC (09:15-15:30 IST)
    - US Markets (^GSPC, NVDA, AAPL): Mon-Fri 13:30 to 20:00 UTC (09:30-16:00 EST)
    - Global Commodities / Forex (GC=F, CL=F, USDINR=X): Mon-Fri 00:00 to 22:00 UTC
    """
    if utc_dt is None:
        utc_dt = datetime.datetime.now(datetime.UTC).replace(tzinfo=None)
        
    weekday = utc_dt.weekday() # 0 = Monday, 6 = Sunday
    minute_utc = utc_dt.hour * 60 + utc_dt.minute
    
    active_tickers = []
    asset_classes = config.get("asset_classes", {})
    
    for ac_key, ac_val in asset_classes.items():
        m_type = ac_val.get("market_hours", "24/7")
        tickers = ac_val.get("tickers", [])
        
        if m_type == "24/7":
            active_tickers.extend(tickers)
        elif weekday < 5: # Mon-Fri
            if m_type == "NSE" and (225 <= minute_utc <= 600):
                active_tickers.extend(tickers)
            elif m_type == "US" and (810 <= minute_utc <= 1200):
                active_tickers.extend(tickers)
            elif m_type == "GLOBAL" and (0 <= minute_utc <= 1320):
                active_tickers.extend(tickers)
                
    # Fallback to configured tickers list if asset_classes not defined
    if not active_tickers and weekday < 5:
        active_tickers = config.get("tickers", ["^NSEI", "^BSESN"])
        
    return list(set(active_tickers))

def run_collection_cycle(config_path="config.yaml", db_path="data/db.sqlite", force_price_poll=False):
    now_utc = datetime.datetime.now(datetime.UTC).replace(tzinfo=None)
    now_str = now_utc.strftime("%Y-%m-%d %H:%M:%S UTC")
    
    with open(config_path, "r") as f:
        config = yaml.safe_load(f)
        
    active_tickers = get_active_tickers_for_time(config, now_utc) if not force_price_poll else config.get("tickers", ["^NSEI"])
    
    logger.info(f"--- Starting Multi-Asset Data Collection Cycle at {now_str} (Active Tickers: {len(active_tickers)}) ---")
    
    try:
        # 1. Collect RSS news 24/7 across global feeds
        news_count = run_news_ingestion(config_path=config_path, use_synthetic=False, db_path=db_path)
        
        # 1b. Ingest Tier-1 Social Squawk & FinTwit streams
        try:
            from src.ingestion.social_collector import run_social_squawk_ingestion
            social_count = run_social_squawk_ingestion(db_path=db_path)
            news_count += social_count
        except Exception as se:
            logger.warning(f"Social squawk ingestion skipped: {se}")

        # 1c. Ingest Direct NSE & BSE Official Regulatory Filings
        try:
            from src.ingestion.exchange_collector import run_exchange_filings_ingestion
            exchange_count = run_exchange_filings_ingestion(db_path=db_path)
            news_count += exchange_count
        except Exception as ee:
            logger.warning(f"Exchange filings ingestion skipped: {ee}")
        
        # 2. Collect price bars for active market tickers
        price_count = 0
        if active_tickers:
            price_count = run_price_ingestion(config_path=config_path, use_synthetic=False, db_path=db_path)
            run_lag_engine(config_path=config_path, db_path=db_path)
        else:
            logger.info("All traditional equity markets closed for weekend. Crypto polling active.")
            
        # 3. Extract features for new events
        build_event_features(config_path=config_path, db_path=db_path)
        
        logger.info(f"Cycle completed successfully. New Events: {news_count}, Price Bars: {price_count}.")
    except Exception as e:
        logger.error(f"Error during collection cycle: {e}")

def main():
    parser = argparse.ArgumentParser(description="Rolling Ingestion Daemon for Nowcasting Project")
    parser.add_argument("--interval-min", type=int, default=15, help="Polling interval in minutes")
    parser.add_argument("--once", action="store_true", help="Run a single collection cycle and exit")
    parser.add_argument("--force-price", action="store_true", help="Force price polling even outside market hours")
    parser.add_argument("--config", default="config.yaml", help="Path to config.yaml")
    parser.add_argument("--db", default="data/db.sqlite", help="Path to SQLite database")
    
    args = parser.parse_args()
    
    if args.once:
        run_collection_cycle(config_path=args.config, db_path=args.db, force_price_poll=args.force_price)
        return
        
    logger.info(f"Starting Ingestion Daemon (Polling every {args.interval_min} minutes)... Press Ctrl+C to stop.")
    while True:
        run_collection_cycle(config_path=args.config, db_path=args.db, force_price_poll=args.force_price)
        time.sleep(args.interval_min * 60)

if __name__ == "__main__":
    main()
