import numpy as np
import pandas as pd
from scipy import stats
from sqlalchemy.orm import Session
from src.utils.db import get_session, Prediction, PriceBar, init_db
from src.utils.logging_config import setup_logging

logger = setup_logging()

def calculate_performance_metrics(returns_series: pd.Series, risk_free_rate: float = 0.05) -> dict:
    """
    Computes Sharpe ratio, Win Rate, Max Drawdown, Profit Factor, Average Return per trade.
    """
    if returns_series.empty or len(returns_series) < 2:
        return {
            "sharpe_ratio": 0.0,
            "win_rate_pct": 0.0,
            "max_drawdown_pct": 0.0,
            "profit_factor": 0.0,
            "avg_return_bps": 0.0,
            "total_trades": 0
        }
        
    trades = returns_series.values
    active_trades = trades[trades != 0.0]
    
    if len(active_trades) == 0:
        return {
            "sharpe_ratio": 0.0,
            "win_rate_pct": 0.0,
            "max_drawdown_pct": 0.0,
            "profit_factor": 0.0,
            "avg_return_bps": 0.0,
            "total_trades": 0
        }
        
    mean_ret = np.mean(active_trades)
    std_ret = np.std(active_trades, ddof=1) if len(active_trades) > 1 else 1e-4
    
    # Annualized Sharpe (assuming ~252 trading days, ~15 trades/day scale)
    sharpe = (mean_ret / (std_ret + 1e-8)) * np.sqrt(252 * 5)
    
    win_rate = (np.sum(active_trades > 0) / len(active_trades)) * 100.0
    
    gains = np.sum(active_trades[active_trades > 0])
    losses = abs(np.sum(active_trades[active_trades < 0]))
    profit_factor = float(gains / losses) if losses > 0 else (10.0 if gains > 0 else 0.0)
    
    # Cumulative equity curve for drawdown calculation
    cum_equity = np.cumprod(1.0 + active_trades)
    running_max = np.maximum.accumulate(cum_equity)
    drawdowns = (cum_equity - running_max) / running_max
    max_dd = float(abs(np.min(drawdowns))) * 100.0 if len(drawdowns) > 0 else 0.0
    
    return {
        "sharpe_ratio": float(sharpe),
        "win_rate_pct": float(win_rate),
        "max_drawdown_pct": float(max_dd),
        "profit_factor": float(profit_factor),
        "avg_return_bps": float(mean_ret * 10000.0),
        "total_trades": int(len(active_trades))
    }

def run_cost_adjusted_backtest(
    predictions_df: pd.DataFrame, 
    slippage_bps: float = 5.0, 
    flat_fee_inr: float = 20.0,
    index_price_level: float = 24000.0
) -> pd.DataFrame:
    """
    Applies configurable slippage and flat transaction costs to predictions.
    Returns DataFrame with net_trade_return column.
    """
    if predictions_df.empty:
        return predictions_df
        
    df = predictions_df.copy()
    cost_fraction = (slippage_bps / 10000.0) + (flat_fee_inr / index_price_level)
    
    net_returns = []
    for _, row in df.iterrows():
        p_dir = row["predicted_direction"]
        actual_ret = row["actual_return_pct"]
        
        if p_dir == "up":
            gross = actual_ret
            net = gross - cost_fraction
        elif p_dir == "down":
            gross = -actual_ret
            net = gross - cost_fraction
        else:
            net = 0.0
            
        net_returns.append(net)
        
    df["trade_return_net_pct"] = net_returns
    return df
