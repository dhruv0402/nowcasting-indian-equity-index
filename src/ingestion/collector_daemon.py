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

def is_nse_market_hours(utc_dt: datetime.datetime = None) -> bool:
    """
    Checks if current UTC time falls within NSE trading hours:
    09:15 AM to 03:30 PM IST (03:45 AM to 10:00 AM UTC), Monday through Friday.
    """
    if utc_dt is None:
        utc_dt = datetime.datetime.utcnow()
        
    # Check weekday (0 = Monday, 4 = Friday, 5 = Saturday, 6 = Sunday)
    if utc_dt.weekday() >= 5:
        return False
        
    minute_of_day_utc = utc_dt.hour * 60 + utc_dt.minute
    # 03:45 UTC = 225 mins, 10:00 UTC = 600 mins
    if 225 <= minute_of_day_utc <= 600:
        return True
        
    return False

def run_collection_cycle(config_path="config.yaml", db_path="data/db.sqlite", force_price_poll=False):
    now_utc = datetime.datetime.utcnow()
    now_str = now_utc.strftime("%Y-%m-%d %H:%M:%S UTC")
    in_market_hours = is_nse_market_hours(now_utc)
    
    logger.info(f"--- Starting Rolling Data Collection Cycle at {now_str} (Market Open: {in_market_hours}) ---")
    
    try:
        # 1. Collect RSS news (RSS can be collected anytime as headlines drop 24/7)
        news_count = run_news_ingestion(config_path=config_path, use_synthetic=False, db_path=db_path)
        
        # 2. Collect price bars (Only poll price bars during market hours or if forced)
        price_count = 0
        if in_market_hours or force_price_poll:
            price_count = run_price_ingestion(config_path=config_path, use_synthetic=False, db_path=db_path)
            run_lag_engine(config_path=config_path, db_path=db_path)
        else:
            logger.info("Market is closed. Skipping yfinance price polling to conserve rate limits.")
            
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
