import requests
import datetime
import hashlib
import json
import feedparser
from src.utils.db import get_session, NewsEvent
from src.ingestion.news_collector import classify_event_type, deduplicate_headlines
from src.utils.logging_config import setup_logging

logger = setup_logging()

def generate_hash(text: str, published_at: datetime.datetime) -> str:
    raw = f"{text}_{published_at.isoformat()}"
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()[:16]

def fetch_direct_nse_regulatory_filings() -> list:
    """
    Direct API connection to National Stock Exchange (NSE India)
    for official corporate disclosures, board outcomes, M&A, and quarterly results.
    Zero noise, 100% regulatory authoritative filings.
    """
    url = 'https://www.nseindia.com/api/corporate-announcements?index=equities'
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'application/json, text/plain, */*'
    }
    collected = []
    try:
        s = requests.Session()
        s.get('https://www.nseindia.com', headers=headers, timeout=5)
        r = s.get(url, headers=headers, timeout=5)
        if r.status_code == 200:
            data = r.json()
            for item in data:
                symbol = item.get('symbol', 'NSE')
                desc = item.get('desc') or item.get('attmntText') or 'Corporate Disclosure'
                headline = f"[{symbol}] {desc}"
                
                # Parse timestamp
                dt_str = item.get('an_dt', '')
                try:
                    pub_time = datetime.datetime.strptime(dt_str, '%d-%b-%Y %H:%M:%S')
                except Exception:
                    pub_time = datetime.datetime.now(datetime.UTC).replace(tzinfo=None)
                    
                event_id = generate_hash(headline, pub_time)
                event_type = classify_event_type(desc)
                if event_type == "other":
                    event_type = "corporate_action"
                    
                collected.append({
                    "event_id": event_id,
                    "headline_text": f"🏛️ [NSE Exchange Official] {headline}",
                    "published_at": pub_time,
                    "source": "NSE India Official Filings",
                    "url": item.get('attmntFile', 'https://www.nseindia.com'),
                    "event_type": event_type,
                    "is_duplicate_of": None,
                    "ingested_at": datetime.datetime.now(datetime.UTC).replace(tzinfo=None),
                    "is_synthetic": False
                })
    except Exception as e:
        logger.error(f"Error scraping direct NSE disclosures: {e}")
        
    return collected

def fetch_rbi_official_press_releases() -> list:
    """
    Direct official stream from Reserve Bank of India (RBI)
    for monetary policy actions, repo rate decisions, liquidity & banking circulars.
    """
    url = 'https://www.rbi.org.in/pressreleases_rss.xml'
    collected = []
    try:
        p = feedparser.parse(url)
        for entry in p.entries:
            title = entry.get('title', '').strip()
            if not title:
                continue
                
            published_parsed = entry.get('published_parsed')
            if published_parsed:
                pub_time = datetime.datetime(*published_parsed[:6])
            else:
                pub_time = datetime.datetime.now(datetime.UTC).replace(tzinfo=None)
                
            event_id = generate_hash(title, pub_time)
            
            collected.append({
                "event_id": event_id,
                "headline_text": f"🏛️ [RBI Central Bank] {title}",
                "published_at": pub_time,
                "source": "Reserve Bank of India (RBI)",
                "url": entry.get('link', 'https://www.rbi.org.in'),
                "event_type": "monetary_policy",
                "is_duplicate_of": None,
                "ingested_at": datetime.datetime.now(datetime.UTC).replace(tzinfo=None),
                "is_synthetic": False
            })
    except Exception as e:
        logger.error(f"Error fetching RBI official feed: {e}")
        
    return collected

def fetch_bloomberg_and_ft_institutional() -> list:
    """
    Pulls high-signal institutional macro and markets reporting
    from Bloomberg Markets and Financial Times.
    """
    feeds = [
        ("Bloomberg Markets", "https://feeds.bloomberg.com/markets/news.rss"),
        ("Financial Times Global", "https://www.ft.com/markets?format=rss")
    ]
    collected = []
    for name, url in feeds:
        try:
            p = feedparser.parse(url)
            for entry in p.entries:
                title = entry.get('title', '').strip()
                if not title:
                    continue
                published_parsed = entry.get('published_parsed')
                if published_parsed:
                    pub_time = datetime.datetime(*published_parsed[:6])
                else:
                    pub_time = datetime.datetime.now(datetime.UTC).replace(tzinfo=None)
                    
                event_id = generate_hash(title, pub_time)
                event_type = classify_event_type(title)
                
                collected.append({
                    "event_id": event_id,
                    "headline_text": f"🌐 [{name}] {title}",
                    "published_at": pub_time,
                    "source": name,
                    "url": entry.get('link', ''),
                    "event_type": event_type,
                    "is_duplicate_of": None,
                    "ingested_at": datetime.datetime.now(datetime.UTC).replace(tzinfo=None),
                    "is_synthetic": False
                })
        except Exception as e:
            logger.error(f"Error fetching {name}: {e}")
            
    return collected

def sync_tier1_institutional_news() -> int:
    """
    Syncs verified, high-alpha institutional disclosures and official wires.
    """
    nse_filings = fetch_direct_nse_regulatory_filings()
    rbi_alerts = fetch_rbi_official_press_releases()
    bloomberg_ft = fetch_bloomberg_and_ft_institutional()
    
    all_tier1 = nse_filings + rbi_alerts + bloomberg_ft
    all_tier1 = deduplicate_headlines(all_tier1)
    
    session = get_session()
    new_count = 0
    for item in all_tier1:
        existing = session.query(NewsEvent).filter_by(event_id=item["event_id"]).first()
        if not existing:
            event = NewsEvent(
                event_id=item["event_id"],
                headline_text=item["headline_text"],
                published_at=item["published_at"],
                source=item["source"],
                url=item["url"],
                event_type=item["event_type"],
                is_duplicate_of=item.get("is_duplicate_of"),
                ingested_at=item["ingested_at"],
                is_synthetic=False
            )
            session.add(event)
            new_count += 1
            
    session.commit()
    session.close()
    return new_count

if __name__ == "__main__":
    count = sync_tier1_institutional_news()
    print(f"💎 Successfully synced {count} Tier-1 Institutional & Official Central Bank / NSE filings into DB!")
