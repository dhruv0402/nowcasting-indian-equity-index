import yaml
import datetime
from src.ingestion.news_collector import collect_rss_news, deduplicate_headlines
from src.utils.db import get_session, NewsEvent

def sync_latest_rss_into_db():
    with open('config.yaml') as f:
        config = yaml.safe_load(f)
        
    articles = collect_rss_news(config)
    articles = deduplicate_headlines(articles)
    
    session = get_session()
    new_count = 0
    
    for a in articles:
        existing = session.query(NewsEvent).filter_by(event_id=a["event_id"]).first()
        if not existing:
            event = NewsEvent(
                event_id=a["event_id"],
                headline_text=a["headline_text"],
                published_at=a["published_at"],
                source=a["source"],
                url=a["url"],
                event_type=a["event_type"],
                is_duplicate_of=a.get("is_duplicate_of"),
                ingested_at=datetime.datetime.utcnow(),
                is_synthetic=False
            )
            session.add(event)
            new_count += 1
            
    session.commit()
    session.close()
    return new_count

if __name__ == "__main__":
    count = sync_latest_rss_into_db()
    print(f"✅ Ingested {count} brand-new live breaking headlines into DB!")
