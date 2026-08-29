import datetime
import hashlib
import json
import re
import requests
from src.utils.db import get_session, NewsEvent
from src.utils.logging_config import setup_logging
from src.ingestion.news_collector import classify_event_type

logger = setup_logging()

NSE_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.nseindia.com/companies-listing/corporate-filings-announcements"
}

BSE_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://www.bseindia.com/corporates/ann.html"
}

def generate_exchange_event_id(exchange: str, symbol: str, text: str, dt_str: str) -> str:
    raw = f"{exchange}_{symbol}_{text}_{dt_str}"
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()[:16]

def fetch_nse_corporate_filings():
    """
    Fetches real-time official exchange announcements directly from NSE India API.
    """
    announcements = []
    try:
        session = requests.Session()
        session.headers.update(NSE_HEADERS)
        # Establish session cookies on home page
        session.get("https://www.nseindia.com", timeout=10)
        
        # Pull live corporate filings
        r = session.get("https://www.nseindia.com/api/corporate-announcements?index=equities", timeout=10)
        if r.status_code == 200:
            data = r.json()
            for item in data[:30]:
                symbol = item.get("symbol", "").strip()
                desc = item.get("desc", "").strip() or item.get("attchmntText", "").strip()
                dt_str = item.get("an_dt", "")
                
                if symbol and desc:
                    announcements.append({
                        "exchange": "NSE",
                        "symbol": symbol,
                        "headline": f"[NSE Official Filing: {symbol}] {desc}",
                        "raw_date": dt_str,
                        "source": f"NSE/{symbol}"
                    })
    except Exception as e:
        logger.warning(f"NSE corporate filings scraper warning: {e}")
        
    return announcements

def fetch_bse_corporate_filings():
    """
    Fetches real-time official regulatory disclosures directly from BSE India API.
    """
    announcements = []
    try:
        url = "https://api.bseindia.com/BseIndiaAPI/api/AnnSubCategoryGetData/w?pageno=1&strCat=-1&strPrevDate=&strScrip=&strSearch=P&strToDate=&strType=C"
        r = requests.get(url, headers=BSE_HEADERS, timeout=10)
        if r.status_code == 200:
            data = r.json()
            table = data.get("Table", [])
            for item in table[:30]:
                scrip_name = item.get("SLONGNAME", "").strip() or str(item.get("SCRIP_CD", ""))
                headline = item.get("NEWSSUB", "").strip()
                more = item.get("HEADLINE", "").strip()
                dt_str = item.get("NEWS_DT", "")
                
                full_text = f"{headline} - {more}" if more else headline
                if scrip_name and full_text:
                    announcements.append({
                        "exchange": "BSE",
                        "symbol": scrip_name,
                        "headline": f"[BSE Official Filing: {scrip_name}] {full_text}",
                        "raw_date": dt_str,
                        "source": f"BSE/{scrip_name}"
                    })
    except Exception as e:
        logger.warning(f"BSE corporate filings scraper warning: {e}")
        
    return announcements

def run_exchange_filings_ingestion(db_path="data/db.sqlite"):
    """
    Ingests official zero-latency regulatory disclosures from NSE & BSE into canonical NewsEvents.
    """
    logger.info("--- Starting Direct NSE & BSE Official Filing Ingestion ---")
    session = get_session()
    existing_ids = {e.event_id for e in session.query(NewsEvent.event_id).all()}
    
    nse_items = fetch_nse_corporate_filings()
    bse_items = fetch_bse_corporate_filings()
    
    all_items = nse_items + bse_items
    new_events = []
    now_utc = datetime.datetime.now(datetime.UTC).replace(tzinfo=None)
    
    for item in all_items:
        event_id = generate_exchange_event_id(item["exchange"], item["symbol"], item["headline"], item.get("raw_date", ""))
        if event_id in existing_ids:
            continue
            
        category = classify_event_type(item["headline"])
        if category == "other":
            category = "regulatory" if "filing" in item["headline"].lower() else "corporate_action"
            
        event = NewsEvent(
            event_id=event_id,
            published_at=now_utc,
            headline_text=item["headline"],
            source=item["source"],
            event_type=category,
            is_synthetic=False
        )
        new_events.append(event)
        existing_ids.add(event_id)
        
    if new_events:
        session.bulk_save_objects(new_events)
        session.commit()
        logger.info(f"Ingested {len(new_events)} official disclosures from NSE & BSE.")
    else:
        logger.info("NSE & BSE official filings are up to date. Zero new unread disclosures.")
        
    session.close()
    return len(new_events)

if __name__ == "__main__":
    count = run_exchange_filings_ingestion()
    print(f"Total New Exchange Events Ingested: {count}")
