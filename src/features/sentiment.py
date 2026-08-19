import pandas as pd
import numpy as np
from src.utils.logging_config import setup_logging

logger = setup_logging()

_finbert_pipeline = None

def score_headlines_batch(headlines: list) -> list:
    """
    Scores a list of headlines in efficient batches using VADER sentiment analyzer.
    """
    results = []
    try:
        from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
        analyzer = SentimentIntensityAnalyzer()
        for text in headlines:
            vs = analyzer.polarity_scores(text)
            compound = vs['compound']
            label = 'positive' if compound >= 0.05 else ('negative' if compound <= -0.05 else 'neutral')
            results.append({"sentiment_score": float(compound), "sentiment_label": label})
        return results
    except Exception as e:
        logger.error(f"VADER sentiment calculation failed: {e}. Defaulting to neutral.")
        return [{"sentiment_score": 0.0, "sentiment_label": "neutral"} for _ in headlines]

def compute_sentiment_ewm(events_df: pd.DataFrame, halflife_min: float = 30.0) -> pd.Series:
    """
    Computes 60-minute Exponentially Weighted Moving Average (EWM) of headline sentiment scores.
    """
    if events_df.empty or "sentiment_score" not in events_df.columns:
        return pd.Series(dtype=float)
        
    events_df = events_df.sort_values("published_at").copy()
    ewm_scores = events_df["sentiment_score"].ewm(halflife=f"{halflife_min}m", times=events_df["published_at"]).mean()
    return ewm_scores
