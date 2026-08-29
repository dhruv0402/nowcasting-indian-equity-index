import datetime
import re
import requests
from bs4 import BeautifulSoup
from src.utils.db import get_session, NewsEvent
from src.utils.logging_config import setup_logging
from src.ingestion.social_collector import generate_social_event_id

logger = setup_logging()

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def scrape_screener_company_intel(ticker_symbol: str) -> dict:
    """
    Scrapes fundamental ratios, latest quarterly numbers, concall summaries,
    and recent exchange filings from Screener.in for any Indian stock.
    """
    clean_sym = ticker_symbol.replace(".NS", "").replace(".BO", "").replace("^", "")
    url = f"https://www.screener.in/company/{clean_sym}/consolidated/"
    
    try:
        resp = requests.get(url, headers=HEADERS, timeout=10)
        if resp.status_code != 200:
            # Fallback to standalone if consolidated not available
            url = f"https://www.screener.in/company/{clean_sym}/"
            resp = requests.get(url, headers=HEADERS, timeout=10)
            
        if resp.status_code != 200:
            logger.warning(f"Screener returned status {resp.status_code} for {clean_sym}")
            return {}
            
        soup = BeautifulSoup(resp.text, "html.parser")
        
        # 1. Parse Top Fundamental Ratios
        ratios = {}
        top_ratios_ul = soup.find("ul", {"id": "top-ratios"})
        if top_ratios_ul:
            for li in top_ratios_ul.find_all("li"):
                name_span = li.find("span", {"class": "name"})
                val_span = li.find("span", {"class": "value"}) or li.find("span", {"class": "nowrap value"})
                if name_span and val_span:
                    key = name_span.text.strip()
                    val = re.sub(r'\s+', ' ', val_span.text).strip()
                    ratios[key] = val
                    
        # 2. Parse Recent Announcements & Exchange Filings
        announcements = []
        ann_section = soup.find("section", {"id": "announcements"}) or soup.find("section", {"id": "documents"})
        if ann_section:
            for item in ann_section.find_all("li", limit=8):
                text = re.sub(r'\s+', ' ', item.text).strip()
                if text and len(text) > 10:
                    announcements.append(text)
                    
        # 3. Parse Concall Transcripts & Notes
        concalls = []
        concall_section = soup.find("div", {"class": "concalls"}) or soup.find("div", {"class": "documents concalls"})
        if concall_section:
            for a in concall_section.find_all("a", limit=5):
                text = a.text.strip()
                if text:
                    concalls.append(text)
                    
        return {
            "symbol": clean_sym,
            "url": url,
            "ratios": ratios,
            "announcements": announcements,
            "concalls": concalls,
            "scraped_at": datetime.datetime.now(datetime.UTC).replace(tzinfo=None)
        }
        
    except Exception as e:
        logger.error(f"Error scraping Screener.in for {clean_sym}: {e}")
        return {}

def ingest_screener_announcements_to_db(ticker_symbol: str = "RELIANCE.NS"):
    """
    Converts breaking Screener.in corporate filings into canonical NewsEvents.
    """
    intel = scrape_screener_company_intel(ticker_symbol)
    if not intel or not intel.get("announcements"):
        return 0
        
    session = get_session()
    existing_ids = {e.event_id for e in session.query(NewsEvent.event_id).all()}
    
    new_events = []
    now = intel["scraped_at"]
    
    for ann in intel["announcements"]:
        event_id = generate_social_event_id(ann, now)
        if event_id in existing_ids:
            continue
            
        event = NewsEvent(
            event_id=event_id,
            published_at=now,
            headline_text=f"[{intel['symbol']} Screener Filing] {ann}",
            source=f"Screener.in/{intel['symbol']}",
            event_type="corporate_action",
            is_synthetic=False
        )
        new_events.append(event)
        existing_ids.add(event_id)
        
    if new_events:
        session.bulk_save_objects(new_events)
        session.commit()
        logger.info(f"Ingested {len(new_events)} corporate announcements from Screener.in for {ticker_symbol}.")
        
    session.close()
    return len(new_events)

if __name__ == "__main__":
    import json
    data = scrape_screener_company_intel("RELIANCE.NS")
    print(json.dumps(data, indent=2, default=str))
