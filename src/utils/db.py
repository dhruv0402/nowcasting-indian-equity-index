import os
from dotenv import load_dotenv
import sqlite3
from sqlalchemy import (
    create_engine, Column, String, Float, Integer, DateTime, Boolean, ForeignKey, Text
)
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()

Base = declarative_base()

class NewsEvent(Base):
    __tablename__ = "news_events"
    
    event_id = Column(String, primary_key=True)
    headline_text = Column(Text, nullable=False)
    published_at = Column(DateTime, nullable=False, index=True)
    source = Column(String)
    url = Column(String)
    event_type = Column(String, index=True)
    is_duplicate_of = Column(String, nullable=True)
    ingested_at = Column(DateTime, nullable=False)
    is_synthetic = Column(Boolean, default=False)

class PriceBar(Base):
    __tablename__ = "price_bars"
    
    ticker = Column(String, primary_key=True)
    timestamp = Column(DateTime, primary_key=True, index=True)
    open = Column(Float)
    high = Column(Float)
    low = Column(Float)
    close = Column(Float)
    volume = Column(Integer)
    is_synthetic = Column(Boolean, default=False)

class EventFeature(Base):
    __tablename__ = "event_features"
    
    event_id = Column(String, ForeignKey("news_events.event_id"), primary_key=True)
    sentiment_score = Column(Float)
    sentiment_label = Column(String)
    sentiment_ewm_60m = Column(Float)
    news_velocity_15m = Column(Integer)
    news_velocity_30m = Column(Integer)
    news_velocity_60m = Column(Integer)
    time_of_day_bucket = Column(String)
    pre_event_volatility = Column(Float)

class LagMeasurement(Base):
    __tablename__ = "lag_measurements"
    
    event_id = Column(String, ForeignKey("news_events.event_id"), primary_key=True)
    ticker = Column(String, primary_key=True)
    reaction_detected = Column(Boolean, nullable=False)
    lag_minutes = Column(Integer, nullable=True)
    reaction_return_pct = Column(Float, nullable=True)
    has_data_gap = Column(Boolean, default=False)
    measured_at = Column(DateTime, nullable=False)

class Prediction(Base):
    __tablename__ = "predictions"
    
    prediction_id = Column(String, primary_key=True)
    run_id = Column(String, index=True, nullable=False, default="run_legacy")
    event_id = Column(String, ForeignKey("news_events.event_id"))
    model_version = Column(String, nullable=False)
    predicted_direction = Column(String)  # 'up', 'down', 'flat'
    predicted_confidence = Column(Float)
    actual_direction = Column(String)
    actual_return_pct = Column(Float)
    trade_return_net_pct = Column(Float)
    created_at = Column(DateTime, nullable=False)

class PipelineMetadata(Base):
    __tablename__ = "pipeline_metadata"
    
    key = Column(String, primary_key=True)
    value = Column(String)

def get_engine(db_path="data/db.sqlite"):
    # Check for Supabase / PostgreSQL environment variable
    db_url = os.environ.get("SUPABASE_DB_URL") or os.environ.get("DATABASE_URL")
    
    if db_url:
        # Normalize postgres:// to postgresql:// for SQLAlchemy
        if db_url.startswith("postgres://"):
            db_url = db_url.replace("postgres://", "postgresql://", 1)
        return create_engine(db_url, pool_pre_ping=True)
    else:
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        return create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})

def init_db(db_path="data/db.sqlite"):
    engine = get_engine(db_path)
    Base.metadata.create_all(engine)
    return engine

def get_session(engine=None, db_path="data/db.sqlite"):
    if engine is None:
        engine = get_engine(db_path)
    Session = sessionmaker(bind=engine)
    return Session()
