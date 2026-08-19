import pytest
import pandas as pd
import numpy as np
from src.backtest.engine import run_cost_adjusted_backtest, calculate_performance_metrics
from src.backtest.baselines import run_monte_carlo_random_baseline

def test_cost_adjusted_backtest_deducts_slippage():
    df_preds = pd.DataFrame([
        {"predicted_direction": "up", "actual_return_pct": 0.0020},    # +20 bps gross
        {"predicted_direction": "down", "actual_return_pct": -0.0020}, # +20 bps gross (short)
        {"predicted_direction": "flat", "actual_return_pct": 0.0050}   # 0 bps trade
    ])
    
    # 5 bps slippage + flat fee (~0.8 bps) = ~5.8 bps cost
    res_df = run_cost_adjusted_backtest(df_preds, slippage_bps=5.0, flat_fee_inr=20.0, index_price_level=24000.0)
    
    assert len(res_df) == 3
    # Net return should be less than gross return due to slippage
    assert res_df["trade_return_net_pct"].iloc[0] < 0.0020
    assert res_df["trade_return_net_pct"].iloc[0] > 0.0005
    assert res_df["trade_return_net_pct"].iloc[2] == 0.0

def test_monte_carlo_baseline_returns_distribution():
    df_preds = pd.DataFrame([
        {"predicted_direction": "up", "actual_return_pct": 0.0010, "trade_return_net_pct": 0.0005},
        {"predicted_direction": "down", "actual_return_pct": -0.0015, "trade_return_net_pct": 0.0010},
        {"predicted_direction": "up", "actual_return_pct": 0.0020, "trade_return_net_pct": 0.0015}
    ])
    
    mc_res = run_monte_carlo_random_baseline(df_preds, num_simulations=100, slippage_bps=5.0)
    
    assert "percentile_rank" in mc_res
    assert "p_value" in mc_res
    assert len(mc_res["mc_total_returns"]) == 100
