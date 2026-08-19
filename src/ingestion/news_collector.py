import hashlib
import datetime
import re
import yaml
import feedparser
import requests
import numpy as np
from sqlalchemy.orm import Session
from src.utils.db import get_session, NewsEvent, init_db, PipelineMetadata
from src.utils.logging_config import setup_logging

logger = setup_logging()

EVENT_KEYWORDS = {
    "monetary_policy": ["rbi", "repo rate", "monetary policy", "mpc", "interest rate", "inflation target", "central bank"],
    "earnings": ["q1", "q2", "q3", "q4", "profit", "loss", "revenue", "ebitda", "quarterly results", "pat", "margin", "earnings"],
    "regulatory": ["sebi", "compliance", "penalty", "regulation", "circular", "ban", "investigation", "nod"],
    "geopolitical": ["war", "tariff", "trade war", "crude", "oil price", "us-china", "sanctions", "geopolitical"],
    "macro_data": ["gdp", "iip", "cpi", "wpi", "inflation", "deficit", "forex", "tax collection", "gst"],
    "corporate_action": ["dividend", "bonus", "split", "buyback", "merger", "acquisition", "stake sale"]
}

def classify_event_type(headline: str) -> str:
    headline_lower = headline.lower()
    for event_type, keywords in EVENT_KEYWORDS.items():
        for kw in keywords:
            if re.search(r'\b' + re.escape(kw) + r'\b', headline_lower):
                return event_type
    return "other"

def generate_hash(text: str, published_at: datetime.datetime) -> str:
    raw = f"{text}_{published_at.isoformat()}"
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()[:16]

def deduplicate_headlines(headlines_list: list) -> list:
    """
    Deduplicates near-identical headlines within a 2-minute window using 
    TF-IDF cosine similarity for high execution speed and offline safety.
    """
    if not headlines_list:
        return []
        
    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.metrics.pairwise import cosine_similarity
        
        texts = [h['headline_text'] for h in headlines_list]
        vectorizer = TfidfVectorizer(stop_words='english')
        tfidf_matrix = vectorizer.fit_transform(texts)
        sim_matrix = cosine_similarity(tfidf_matrix)
        
        for i, h_item in enumerate(headlines_list):
            for j in range(i):
                time_diff = abs((h_item['published_at'] - headlines_list[j]['published_at']).total_seconds())
                if time_diff <= 120 and sim_matrix[i, j] > 0.75:
                    h_item['is_duplicate_of'] = headlines_list[j]['event_id']
                    break
    except Exception as e:
        logger.warning(f"TF-IDF deduplication failed: {e}")
        
    return headlines_list

def collect_rss_news(config: dict) -> list:
    feeds = config.get("data_collection", {}).get("rss_feeds", [])
    collected = []
    
    for feed in feeds:
        url = feed.get("url")
        name = feed.get("name")
        logger.info(f"Polling RSS feed: {name}")
        try:
            parsed = feedparser.parse(url)
            for entry in parsed.entries:
                title = entry.get("title", "")
                if not title:
                    continue
                    
                # Parse timestamp
                published_parsed = entry.get("published_parsed") or entry.get("updated_parsed")
                if published_parsed:
                    published_at = datetime.datetime(*published_parsed[:6])
                else:
                    published_at = datetime.datetime.utcnow()
                    
                event_id = generate_hash(title, published_at)
                event_type = classify_event_type(title)
                
                collected.append({
                    "event_id": event_id,
                    "headline_text": title,
                    "published_at": published_at,
                    "source": name,
                    "url": entry.get("link", ""),
                    "event_type": event_type,
                    "is_duplicate_of": None,
                    "ingested_at": datetime.datetime.utcnow(),
                    "is_synthetic": False
                })
        except Exception as e:
            logger.error(f"Error parsing feed {name}: {e}")
            
    return collected

def generate_synthetic_news(num_events: int = 150) -> list:
    """
    Generates realistic, timestamped synthetic financial headlines for testing and demonstration.
    """
    logger.info("Generating synthetic news dataset...")
    categories = {
        "monetary_policy": [
            "RBI keeps repo rate unchanged at 6.5%, maintains withdrawal of accommodation stance",
            "RBI hikes repo rate by 25 bps amid persistent headline inflation",
            "MPC minutes highlight concerns over food inflation spikes",
            "RBI announces open market operations to absorb banking liquidity"
        ],
        "earnings": [
            "Reliance Industries reports Q1 net profit up 12% YoY, beating estimates",
            "TCS posts revenue growth of 8% YoY, announces Rs 18 per share dividend",
            "Infosys trims full-year revenue guidance to 1-3%, ADR slumps",
            "HDFC Bank Q1 net profit jumps 30% YoY post-merger integration"
        ],
        "regulatory": [
            "SEBI introduces tighter rules for index derivatives and F&O trading",
            "SEBI issues guidelines for algo trading and co-location facilities",
            "SEBI imposes penalty on major brokerage firm for margin shortfall violations",
            "SEBI simplifies KYC requirements for foreign portfolio investors"
        ],
        "geopolitical": [
            "Global crude oil prices surge 4% following Middle East supply disruption concerns",
            "US Fed hints at rate cuts, boosting emerging market equity sentiment",
            "FPI inflows into Indian equities touch 6-month high amid global rally",
            "OPEC+ announces surprise oil production cut of 1 million barrels per day"
        ],
        "macro_data": [
            "India Q1 GDP growth comes in strong at 7.8%, exceeding analyst forecasts",
            "Retail CPI inflation eases to 4.75% in May, hitting 12-month low",
            "India IIP growth accelerates to 5.0% driven by manufacturing recovery",
            "Gross GST collection for May crosses Rs 1.73 lakh crore"
        ],
        "corporate_action": [
            "L&T board approves Rs 10,000 crore share buyback at premium price",
            "Tata Motors announces demerger of commercial and passenger vehicle businesses",
            "Bharti Airtel acquires additional 5G spectrum in SEBI-cleared deal",
            "Coal India declares interim dividend of Rs 5.25 per share"
        ]
    }
    
    events = []
    base_time = datetime.datetime.utcnow() - datetime.timedelta(days=14)
    
    for i in range(num_events):
        cat = np.random.choice(list(categories.keys()))
        headline = np.random.choice(categories[cat])
        
        # Add random timestamp during market trading hours (09:15 to 15:30 IST)
        day_offset = np.random.randint(0, 14)
        hour = np.random.randint(9, 15)
        minute = np.random.randint(0, 60)
        second = np.random.randint(0, 60)
        
        pub_time = base_time + datetime.timedelta(days=day_offset, hours=hour-base_time.hour, minutes=minute)
        pub_time = pub_time.replace(second=second)
        
        event_id = generate_hash(headline, pub_time)
        events.append({
            "event_id": event_id,
            "headline_text": headline,
            "published_at": pub_time,
            "source": "Synthetic Market News",
            "url": "https://example.com/news",
            "event_type": cat,
            "is_duplicate_of": None,
            "ingested_at": datetime.datetime.utcnow(),
            "is_synthetic": True
        })
        
    events.sort(key=lambda x: x["published_at"])
    return events

def run_news_ingestion(config_path="config.yaml", use_synthetic=False, db_path="data/db.sqlite"):
    init_db(db_path)
    session = get_session(db_path=db_path)
    
    with open(config_path, "r") as f:
        config = yaml.safe_load(f)
        
    if use_synthetic:
        news_items = generate_synthetic_news(num_events=200)
    else:
        news_items = collect_rss_news(config)
        if len(news_items) < 10:
            logger.warning("Fewer than 10 real RSS items retrieved. Supplementing with synthetic data for pipeline robustness.")
            synthetic_items = generate_synthetic_news(num_events=150)
            news_items.extend(synthetic_items)
            
    news_items = deduplicate_headlines(news_items)
    
    inserted_count = 0
    has_synthetic = any(item.get("is_synthetic", False) for item in news_items)
    
    for item in news_items:
        existing = session.query(NewsEvent).filter_by(event_id=item["event_id"]).first()
        if not existing:
            event = NewsEvent(**item)
            session.add(event)
            inserted_count += 1
            
    # Save metadata flag
    meta = session.query(PipelineMetadata).filter_by(key="news_is_synthetic").first()
    if not meta:
        meta = PipelineMetadata(key="news_is_synthetic", value=str(has_synthetic))
        session.add(meta)
    else:
        meta.value = str(has_synthetic)
        
    session.commit()
    session.close()
    logger.info(f"News ingestion complete. Inserted {inserted_count} new events (Is Synthetic: {has_synthetic}).")
    return inserted_count
