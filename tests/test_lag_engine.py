import pytest
import datetime
import pandas as pd
import numpy as np
from src.features.lag_engine import measure_event_lag

def test_lag_engine_detects_reaction():
    t_pub = datetime.datetime(2026, 8, 1, 10, 0, 0)
    
    # 15 min baseline with low volatility (std ~0.0005)
    baseline_times = [t_pub - datetime.timedelta(minutes=i) for i in range(15, 0, -1)]
    baseline_prices = [24000.0 + np.random.normal(0, 5.0) for _ in range(15)]
    
    # Post-event window with a shock at minute 7
    reaction_times = [t_pub + datetime.timedelta(minutes=i) for i in range(1, 61)]
    reaction_prices = []
    for i in range(1, 61):
        if i < 7:
            p = 24000.0
        else:
            p = 24200.0  # +0.83% spike
        reaction_prices.append(p)
        
    df_baseline = pd.DataFrame({"timestamp": baseline_times, "close": baseline_prices})
    df_reaction = pd.DataFrame({"timestamp": reaction_times, "close": reaction_prices})
    df_all = pd.concat([df_baseline, df_reaction]).sort_values("timestamp").reset_index(drop=True)
    
    res = measure_event_lag(
        event_published_at=t_pub,
        price_df=df_all,
        baseline_window_min=15,
        reaction_window_min=60,
        std_threshold=2.0
    )
    
    assert res["reaction_detected"] is True
    assert res["lag_minutes"] == 7
    assert res["reaction_return_pct"] > 0

def test_lag_engine_no_reaction():
    t_pub = datetime.datetime(2026, 8, 1, 10, 0, 0)
    
    times = [t_pub + datetime.timedelta(minutes=i) for i in range(-15, 60)]
    prices = [24000.0 + np.random.normal(0, 1.0) for _ in range(len(times))]
    df = pd.DataFrame({"timestamp": times, "close": prices})
    
    res = measure_event_lag(
        event_published_at=t_pub,
        price_df=df,
        baseline_window_min=15,
        reaction_window_min=60,
        std_threshold=5.0  # High threshold impossible to cross
    )
    
    assert res["reaction_detected"] is False
    assert res["lag_minutes"] is None
