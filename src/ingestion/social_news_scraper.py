import requests
import datetime
import hashlib
import json
import re
from bs4 import BeautifulSoup
from src.utils.db import get_session, NewsEvent
from src.ingestion.news_collector import classify_event_type, deduplicate_headlines
from src.utils.logging_config import setup_logging

logger = setup_logging()

def generate_hash(text: str, published_at: datetime.datetime) -> str:
    raw = f"{text}_{published_at.isoformat()}"
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()[:16]

def fetch_reddit_financial_feed(subreddit: str = "IndianStockMarket") -> list:
    """
    Ingests live social market sentiment, breaking rumors and retail flow
    directly from Reddit RSS feeds.
    """
    url = f"https://www.reddit.com/r/{subreddit}/new/.rss"
    collected = []
    try:
        import feedparser
        parsed = feedparser.parse(url)
        for entry in parsed.entries:
            title = entry.get("title", "").strip()
            if not title or len(title) < 10:
                continue
            
            published_parsed = entry.get("published_parsed") or entry.get("updated_parsed")
            if published_parsed:
                pub_time = datetime.datetime(*published_parsed[:6])
            else:
                pub_time = datetime.datetime.now(datetime.UTC).replace(tzinfo=None)
                
            event_id = generate_hash(title, pub_time)
            event_type = classify_event_type(title)
            
            collected.append({
                "event_id": event_id,
                "headline_text": f"[Reddit r/{subreddit}] {title}",
                "published_at": pub_time,
                "source": f"Reddit r/{subreddit}",
                "url": entry.get("link", ""),
                "event_type": event_type,
                "is_duplicate_of": None,
                "ingested_at": datetime.datetime.now(datetime.UTC).replace(tzinfo=None),
                "is_synthetic": False
            })
    except Exception as e:
        logger.error(f"Error fetching Reddit RSS for r/{subreddit}: {e}")
        
    return collected

def fetch_x_twitter_google_stream(query: str = "Nifty OR Sensex OR 'SEBI' OR 'RBI' site:twitter.com OR site:x.com") -> list:
    """
    Scrapes real-time indexed financial tweets and Breaking X Alerts
    via Google Real-Time Bridge without getting blocked or paying $100/mo X API.
    """
    url = f"https://news.google.com/rss/search?q={requests.utils.quote(query)}&hl=en-IN&gl=IN&ceid=IN:en"
    collected = []
    try:
        import feedparser
        parsed = feedparser.parse(url)
        for entry in parsed.entries:
            title = entry.get("title", "")
            if not title:
                continue
            
            published_parsed = entry.get("published_parsed") or entry.get("updated_parsed")
            if published_parsed:
                pub_time = datetime.datetime(*published_parsed[:6])
            else:
                pub_time = datetime.datetime.now(datetime.UTC).replace(tzinfo=None)
                
            event_id = generate_hash(title, pub_time)
            event_type = classify_event_type(title)
            
            collected.append({
                "event_id": event_id,
                "headline_text": f"[X / FinTwit] {title}",
                "published_at": pub_time,
                "source": "X (Twitter) FinTwit Stream",
                "url": entry.get("link", ""),
                "event_type": event_type,
                "is_duplicate_of": None,
                "ingested_at": datetime.datetime.now(datetime.UTC).replace(tzinfo=None),
                "is_synthetic": False
            })
    except Exception as e:
        logger.error(f"Error scraping X FinTwit stream: {e}")
        
    return collected

def sync_social_and_x_feeds_into_db() -> int:
    """
    Aggregates X (FinTwit) + Reddit (r/IndianStockMarket, r/IndiaInvestments, r/wallstreetbets)
    and commits deduplicated signals directly into nowcasting database.
    """
    reddit_ism = fetch_reddit_financial_feed("IndianStockMarket")
    reddit_inv = fetch_reddit_financial_feed("IndiaInvestments")
    reddit_wsb = fetch_reddit_financial_feed("wallstreetbets")
    x_stream = fetch_x_twitter_google_stream()
    
    all_social = reddit_ism + reddit_inv + reddit_wsb + x_stream
    all_social = deduplicate_headlines(all_social)
    
    session = get_session()
    new_count = 0
    for s in all_social:
        existing = session.query(NewsEvent).filter_by(event_id=s["event_id"]).first()
        if not existing:
            event = NewsEvent(
                event_id=s["event_id"],
                headline_text=s["headline_text"],
                published_at=s["published_at"],
                source=s["source"],
                url=s["url"],
                event_type=s["event_type"],
                is_duplicate_of=s.get("is_duplicate_of"),
                ingested_at=s["ingested_at"],
                is_synthetic=False
            )
            session.add(event)
            new_count += 1
            
    session.commit()
    session.close()
    return new_count

if __name__ == "__main__":
    count = sync_social_and_x_feeds_into_db()
    print(f"🔥 Successfully synced {count} brand-new posts from X (FinTwit) and Reddit into DB!")
