import datetime
from src.utils.logging_config import setup_logging

logger = setup_logging()

def assert_no_lookahead(feature_timestamp: datetime.datetime, decision_timestamp: datetime.datetime, feature_name: str = "feature"):
    """
    Every feature used at decision time T must be computable strictly using data 
    with a timestamp <= T.
    Raises AssertionError if feature_timestamp > decision_timestamp.
    """
    assert feature_timestamp <= decision_timestamp, (
        f"LOOK-AHEAD VIOLATION DETECTED [{feature_name}]: Feature timestamp ({feature_timestamp.isoformat()}) "
        f"is after decision timestamp ({decision_timestamp.isoformat()})."
    )

def validate_feature_matrix_timestamps(df_features, decision_time_col="decision_timestamp"):
    """
    Scans a pandas DataFrame of features and verifies that all feature creation 
    timestamps precede or equal the decision timestamp.
    """
    if df_features.empty:
        return True
        
    for idx, row in df_features.iterrows():
        decision_ts = row[decision_time_col]
        for col in df_features.columns:
            if col.endswith("_timestamp"):
                feat_ts = row[col]
                if feat_ts is not None and isinstance(feat_ts, datetime.datetime):
                    assert_no_lookahead(feat_ts, decision_ts, feature_name=col)
                    
    logger.info("Look-Ahead Guard validation PASSED: No look-ahead violations found across feature matrix.")
    return True
