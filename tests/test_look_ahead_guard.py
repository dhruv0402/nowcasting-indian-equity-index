import pytest
import datetime
from src.modeling.look_ahead_guard import assert_no_lookahead

def test_assert_no_lookahead_valid():
    t_decision = datetime.datetime(2026, 8, 1, 10, 0, 0)
    t_feat_prior = datetime.datetime(2026, 8, 1, 9, 45, 0)
    t_feat_equal = datetime.datetime(2026, 8, 1, 10, 0, 0)
    
    # Should pass without raising assertion error
    assert_no_lookahead(t_feat_prior, t_decision, "prior_feature")
    assert_no_lookahead(t_feat_equal, t_decision, "equal_feature")

def test_assert_no_lookahead_violation():
    t_decision = datetime.datetime(2026, 8, 1, 10, 0, 0)
    t_feat_future = datetime.datetime(2026, 8, 1, 10, 1, 0)  # 1 min in future
    
    with pytest.raises(AssertionError) as exc_info:
        assert_no_lookahead(t_feat_future, t_decision, "future_feature")
        
    assert "LOOK-AHEAD VIOLATION DETECTED" in str(exc_info.value)
