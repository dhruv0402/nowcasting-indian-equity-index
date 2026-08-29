import datetime
import hashlib
import re
import feedparser
import requests
from src.utils.db import get_session, NewsEvent
from src.utils.logging_config import setup_logging
from src.ingestion.news_collector import classify_event_type

logger = setup_logging()

# Tier-1 Institutional Financial Squawk & Premium Macro/Equity Intelligence
SOCIAL_SQUAWK_FEEDS = [
    # --- Ultra-Fast Flash Squawks (Sub-second Macro & Earnings) ---
    {
        "source": "X/@DeItaone",
        "name": "Deltaone Squawk Wire",
        "url": "https://rss.app/feeds/v1.1/tG265YqXw1.xml",
        "category": "macro_squawk"
    },
    {
        "source": "X/@WalterBloomberg",
        "name": "Walter Bloomberg Terminal Wire",
        "url": "https://rss.app/feeds/v1.1/uH834ZpQw2.xml",
        "category": "macro_squawk"
    },
    {
        "source": "X/@KobeissiLetter",
        "name": "The Kobeissi Letter (Global Macro & Fed)",
        "url": "https://rss.app/feeds/v1.1/kL981XqZa5.xml",
        "category": "macro_intelligence"
    },
    {
        "source": "X/@WatcherGuru",
        "name": "WatcherGuru Crypto/Macro",
        "url": "https://rss.app/feeds/v1.1/wK942LmZx3.xml",
        "category": "crypto_macro"
    },
    {
        "source": "X/@FirstSquawk",
        "name": "First Squawk Live",
        "url": "https://rss.app/feeds/v1.1/fS120KjPl4.xml",
        "category": "energy_forex"
    },
    # --- Curated Indian Fundamental & Sector Analysis Feeds ---
    {
        "source": "YouTube/SOIC",
        "name": "SOIC Finance (School of Intrinsic Compounding)",
        "url": "https://www.youtube.com/feeds/videos.xml?channel_id=UCWkYf99_9Lp29r6u5nOa_1A",
        "category": "indian_deep_research"
    },
    {
        "source": "X/@SajalKapoor",
        "name": "Sajal Kapoor (Un-Structured / Micro-Cap Cycles)",
        "url": "https://rss.app/feeds/v1.1/sK732VpLt6.xml",
        "category": "indian_deep_research"
    },
    {
        "source": "YouTube/YadnyaAdvisory",
        "name": "Yadnya Investment Academy",
        "url": "https://www.youtube.com/feeds/videos.xml?channel_id=UCtC1b0Fj_4fXFwX6j9_7_2Q",
        "category": "indian_deep_research"
    }
]

def generate_social_event_id(text: str, published_at: datetime.datetime) -> str:
    raw = f"social_{text}_{published_at.isoformat()}"
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()[:16]

def clean_tweet_text(text: str) -> str:
    # Strip URLs, hashtags and formatting artifacts
    text = re.sub(r'http\S+', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def run_social_squawk_ingestion(db_path="data/db.sqlite"):
    """
    Ingests zero-latency breaking squawk tweets from Tier-1 financial handles
    into the canonical database with automated category classification.
    """
    logger.info("--- Starting Tier-1 Social Squawk & FinTwit Ingestion Stream ---")
    session = get_session()
    
    # Pre-cache existing event IDs for O(1) deduplication
    existing_ids = {e.event_id for e in session.query(NewsEvent.event_id).all()}
    
    new_events = []
    
    for feed in SOCIAL_SQUAWK_FEEDS:
        try:
            parsed = feedparser.parse(feed["url"])
            entries = parsed.entries if parsed and parsed.entries else []
            
            for entry in entries:
                headline = clean_tweet_text(entry.get("title", ""))
                if not headline or len(headline) < 15:
                    continue
                    
                # Extract timestamp
                if hasattr(entry, "published_parsed") and entry.published_parsed:
                    pub_dt = datetime.datetime(*entry.published_parsed[:6])
                else:
                    pub_dt = datetime.datetime.now(datetime.UTC).replace(tzinfo=None)
                    
                event_id = generate_social_event_id(headline, pub_dt)
                if event_id in existing_ids:
                    continue
                    
                category = classify_event_type(headline)
                
                event = NewsEvent(
                    event_id=event_id,
                    published_at=pub_dt,
                    headline_text=headline,
                    source=feed["source"],
                    event_type=category,
                    is_synthetic=False
                )
                
                new_events.append(event)
                existing_ids.add(event_id)
                
        except Exception as e:
            logger.warning(f"Failed to pull social feed {feed['name']}: {e}")
            
    if new_events:
        session.bulk_save_objects(new_events)
        session.commit()
        logger.info(f"Ingested {len(new_events)} Tier-1 breaking squawk tweets.")
    else:
        logger.info("Social squawk stream up to date. Zero new unread alerts.")
        
    session.close()
    return len(new_events)

if __name__ == "__main__":
    run_social_squawk_ingestion()
