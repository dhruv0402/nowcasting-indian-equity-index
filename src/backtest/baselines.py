import numpy as np
import pandas as pd
from scipy import stats
from src.backtest.engine import calculate_performance_metrics

def run_buy_and_hold_baseline(price_df: pd.DataFrame) -> dict:
    """
    Computes Buy-and-Hold return across the full evaluation price window.
    """
    if price_df.empty or len(price_df) < 2:
        return {"total_return_pct": 0.0, "sharpe_ratio": 0.0}
        
    start_p = price_df["close"].iloc[0]
    end_p = price_df["close"].iloc[-1]
    total_ret = (end_p - start_p) / start_p * 100.0
    
    returns = price_df["close"].pct_change().dropna()
    std_ret = returns.std()
    sharpe = (returns.mean() / (std_ret + 1e-8)) * np.sqrt(252 * 375) if std_ret > 0 else 0.0
    
    return {
        "total_return_pct": float(total_ret),
        "sharpe_ratio": float(sharpe)
    }

def run_monte_carlo_random_baseline(
    predictions_df: pd.DataFrame, 
    num_simulations: int = 1000, 
    slippage_bps: float = 5.0,
    flat_fee_inr: float = 20.0
) -> dict:
    """
    Executes 1,000 Monte Carlo simulations matching trade frequency and duration,
    with randomized directional signals (up, down, flat).
    Computes model percentile rank and paired Wilcoxon / t-test p-value.
    """
    if predictions_df.empty:
        return {
            "percentile_rank": 50.0,
            "p_value": 1.0,
            "mc_sharpes": [0.0],
            "mc_returns_mean": 0.0,
            "mc_5th_pct": 0.0,
            "mc_95th_pct": 0.0
        }
        
    actual_returns = predictions_df["actual_return_pct"].values
    n_trades = len(actual_returns)
    cost_fraction = (slippage_bps / 10000.0) + (flat_fee_inr / 24000.0)
    
    model_net_returns = predictions_df["trade_return_net_pct"].values
    model_total_ret = float(np.sum(model_net_returns))
    
    mc_total_returns = []
    mc_sharpes = []
    mc_trade_matrix = []
    
    directions = ["up", "down", "flat"]
    probs = [0.4, 0.4, 0.2]  # matching typical active market trade split
    
    for sim in range(num_simulations):
        random_dirs = np.random.choice(directions, size=n_trades, p=probs)
        sim_net_returns = []
        for i, d in enumerate(random_dirs):
            if d == "up":
                ret = actual_returns[i] - cost_fraction
            elif d == "down":
                ret = -actual_returns[i] - cost_fraction
            else:
                ret = 0.0
            sim_net_returns.append(ret)
            
        sim_net_returns = np.array(sim_net_returns)
        mc_trade_matrix.append(sim_net_returns)
        
        tot_r = float(np.sum(sim_net_returns))
        mc_total_returns.append(tot_r)
        
        metrics = calculate_performance_metrics(pd.Series(sim_net_returns))
        mc_sharpes.append(metrics["sharpe_ratio"])
        
    # Percentile rank of model vs random distribution
    percentile = float(stats.percentileofscore(mc_total_returns, model_total_ret))
    
    # Statistical significance: Paired t-test between model trade returns and mean random trade returns
    mean_random_trades = np.mean(mc_trade_matrix, axis=0)
    if len(model_net_returns) > 2 and np.std(model_net_returns - mean_random_trades) > 1e-8:
        t_stat, p_val = stats.ttest_rel(model_net_returns, mean_random_trades)
    else:
        p_val = 1.0
        
    return {
        "percentile_rank": float(percentile),
        "p_value": float(p_val),
        "mc_sharpes": mc_sharpes,
        "mc_returns_mean": float(np.mean(mc_total_returns)),
        "mc_5th_pct": float(np.percentile(mc_total_returns, 5)),
        "mc_95th_pct": float(np.percentile(mc_total_returns, 95)),
        "mc_total_returns": mc_total_returns
    }
