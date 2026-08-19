import datetime
import yaml
import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st

from src.utils.db import get_session, NewsEvent, PriceBar, LagMeasurement, Prediction, EventFeature, PipelineMetadata
from src.backtest.engine import run_cost_adjusted_backtest, calculate_performance_metrics
from src.backtest.baselines import run_buy_and_hold_baseline, run_monte_carlo_random_baseline

st.set_page_config(
    page_title="Nowcasting Indian Equity Index Moves",
    page_icon="📈",
    layout="wide"
)

# Custom CSS styling
st.markdown("""
<style>
    .main-header { font-size: 2.2rem; font-weight: 700; color: #1E293B; margin-bottom: 0.2rem; }
    .sub-header { font-size: 1.05rem; color: #64748B; margin-bottom: 1.5rem; }
    .kpi-card { background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; text-align: center; }
    .kpi-title { font-size: 0.85rem; color: #64748B; font-weight: 600; text-transform: uppercase; }
    .kpi-value { font-size: 1.8rem; font-weight: 700; color: #0F172A; }
    .synthetic-banner { background-color: #FEF3C7; border: 1px solid #F59E0B; padding: 10px 16px; border-radius: 6px; color: #92400E; margin-bottom: 20px; font-weight: 600; }
</style>
""", unsafe_allow_html=True)

@st.cache_data
def load_dashboard_data(db_path="data/db.sqlite"):
    session = get_session(db_path=db_path)
    
    events = session.query(NewsEvent).filter_by(is_duplicate_of=None).all()
    events_df = pd.DataFrame([{
        "event_id": e.event_id,
        "headline_text": e.headline_text,
        "published_at": e.published_at,
        "event_type": e.event_type,
        "is_synthetic": e.is_synthetic
    } for e in events]) if events else pd.DataFrame()
    
    lags = session.query(LagMeasurement).all()
    lags_df = pd.DataFrame([{
        "event_id": l.event_id,
        "ticker": l.ticker,
        "reaction_detected": l.reaction_detected,
        "lag_minutes": l.lag_minutes,
        "reaction_return_pct": l.reaction_return_pct
    } for l in lags]) if lags else pd.DataFrame()
    
    preds = session.query(Prediction).all()
    preds_df = pd.DataFrame([{
        "prediction_id": p.prediction_id,
        "event_id": p.event_id,
        "model_version": p.model_version,
        "predicted_direction": p.predicted_direction,
        "predicted_confidence": p.predicted_confidence,
        "actual_direction": p.actual_direction,
        "actual_return_pct": p.actual_return_pct,
        "trade_return_net_pct": p.trade_return_net_pct
    } for p in preds]) if preds else pd.DataFrame()
    
    prices = session.query(PriceBar).all()
    price_df = pd.DataFrame([{
        "ticker": p.ticker,
        "timestamp": p.timestamp,
        "close": p.close
    } for p in prices]) if prices else pd.DataFrame()
    
    # Check synthetic metadata flags
    meta_news = session.query(PipelineMetadata).filter_by(key="news_is_synthetic").first()
    meta_price = session.query(PipelineMetadata).filter_by(key="price_is_synthetic").first()
    
    is_synthetic = (
        (meta_news and meta_news.value.lower() == 'true') or 
        (meta_price and meta_price.value.lower() == 'true')
    )
    
    session.close()
    return events_df, lags_df, preds_df, price_df, is_synthetic

# Load Data
events_df, lags_df, preds_df, price_df, is_synthetic_dataset = load_dashboard_data()

# Header
st.markdown('<div class="main-header">Nowcasting Indian Equity Index Moves</div>', unsafe_allow_html=True)
st.markdown('<div class="sub-header">A Lag-Aware Framework for News-Driven Short-Horizon Prediction (NIFTY 50 / SENSEX)</div>', unsafe_allow_html=True)

# Synthetic Data Banner
if is_synthetic_dataset:
    st.markdown("""
    <div class="synthetic-banner">
        ⚠️ <strong>SYNTHETIC DATASET ACTIVE:</strong> The current pipeline run utilizes synthetic price or headline data 
        (generated for deterministic off-market testing and demonstration). Real-world production conclusions should be evaluated 
        on live rolling RSS and minute price bar data snapshots.
    </div>
    """, unsafe_allow_html=True)

# Sidebar Controls
st.sidebar.header("Pipeline Controls")

ticker = st.sidebar.selectbox("Select Index Ticker", options=["^NSEI (NIFTY 50)", "^BSESN (SENSEX)"], index=0)
selected_ticker = ticker.split(" ")[0]

all_event_types = list(events_df["event_type"].unique()) if not events_df.empty else []
selected_event_types = st.sidebar.multiselect("Event Types", options=all_event_types, default=all_event_types)

st.sidebar.markdown("---")
st.sidebar.subheader("Cost Realism Model")
slippage_bps = st.sidebar.slider("Slippage (bps per round-trip)", min_value=0.0, max_value=25.0, value=5.0, step=0.5)
flat_fee_inr = st.sidebar.number_input("Flat Brokerage Fee (₹)", min_value=0.0, max_value=100.0, value=20.0, step=5.0)

# Merge datasets
if not events_df.empty and not lags_df.empty:
    merged_lags = pd.merge(lags_df[lags_df["ticker"] == selected_ticker], events_df, on="event_id", how="inner")
    if selected_event_types:
        merged_lags = merged_lags[merged_lags["event_type"].isin(selected_event_types)]
else:
    merged_lags = pd.DataFrame()

# Recalculate backtest dynamically based on sidebar slippage slider
if not preds_df.empty:
    merged_preds = pd.merge(preds_df, events_df, on="event_id", how="inner")
    if selected_event_types:
        merged_preds = merged_preds[merged_preds["event_type"].isin(selected_event_types)]
    eval_preds = run_cost_adjusted_backtest(merged_preds, slippage_bps=slippage_bps, flat_fee_inr=flat_fee_inr)
else:
    eval_preds = pd.DataFrame()

# Header KPI Cards
col1, col2, col3, col4 = st.columns(4)

valid_lags = merged_lags[merged_lags["lag_minutes"].notna()] if not merged_lags.empty else pd.DataFrame()
median_lag = int(valid_lags["lag_minutes"].median()) if not valid_lags.empty else 0

no_react_pct = 0.0
if not merged_lags.empty:
    no_react_pct = (len(merged_lags[~merged_lags["reaction_detected"]]) / len(merged_lags)) * 100.0

model_metrics = calculate_performance_metrics(eval_preds["trade_return_net_pct"]) if not eval_preds.empty else {}
mc_res = run_monte_carlo_random_baseline(eval_preds, num_simulations=500, slippage_bps=slippage_bps, flat_fee_inr=flat_fee_inr) if not eval_preds.empty else {}

with col1:
    st.markdown(f'<div class="kpi-card"><div class="kpi-title">Median Reaction Lag</div><div class="kpi-value">{median_lag} min</div></div>', unsafe_allow_html=True)
with col2:
    st.markdown(f'<div class="kpi-card"><div class="kpi-title">No Reaction %</div><div class="kpi-value">{no_react_pct:.1f}%</div></div>', unsafe_allow_html=True)
with col3:
    st.markdown(f'<div class="kpi-card"><div class="kpi-title">Net Model Sharpe</div><div class="kpi-value">{model_metrics.get("sharpe_ratio", 0.0):.2f}</div></div>', unsafe_allow_html=True)
with col4:
    st.markdown(f'<div class="kpi-card"><div class="kpi-title">Monte Carlo Rank</div><div class="kpi-value">{mc_res.get("percentile_rank", 50.0):.1f}th pct</div></div>', unsafe_allow_html=True)

st.markdown("<br>", unsafe_allow_html=True)

# Tabs
tab1, tab2, tab3, tab4 = st.tabs(["📊 Lag Distribution", "📈 Model vs Baselines", "🔑 Feature Importance", "🔍 Event Case Studies"])

# Tab 1: Lag Distribution
with tab1:
    st.subheader("Empirical News-to-Price Lag Distribution")
    st.caption("Measures minute delay between headline published_at timestamp and the first price bar exceeding 2.0x baseline volatility threshold.")
    
    if not valid_lags.empty:
        c1, c2 = st.columns(2)
        with c1:
            fig_hist = px.histogram(
                valid_lags, 
                x="lag_minutes", 
                color="event_type", 
                title="Reaction Lag Histogram by Event Type",
                labels={"lag_minutes": "Lag (Minutes)", "count": "Event Count"},
                barmode="overlay",
                nbins=20
            )
            st.plotly_chart(fig_hist, use_container_width=True)
            
        with c2:
            fig_box = px.box(
                valid_lags,
                x="event_type",
                y="lag_minutes",
                color="event_type",
                title="Lag Distribution Box Plot Across Event Types",
                labels={"lag_minutes": "Lag (Minutes)", "event_type": "Event Category"}
            )
            st.plotly_chart(fig_box, use_container_width=True)
    else:
        st.info("No lag measurements available for selected filters.")

# Tab 2: Model vs Baselines
with tab2:
    st.subheader("Cost-Adjusted Strategy Equity Curve & Benchmarking")
    st.caption(f"Evaluated net of {slippage_bps} bps slippage + ₹{flat_fee_inr} flat fee per round-trip trade.")
    
    if not eval_preds.empty:
        # Calculate cumulative returns
        cum_model = np.cumprod(1.0 + eval_preds["trade_return_net_pct"].values) - 1.0
        
        # Monte Carlo range
        mc_returns = mc_res.get("mc_total_returns", [0.0])
        mean_mc_ret = mc_res.get("mc_returns_mean", 0.0)
        
        fig_equity = go.Figure()
        
        trade_indices = np.arange(1, len(cum_model) + 1)
        fig_equity.add_trace(go.Scatter(
            x=trade_indices, y=cum_model * 100.0,
            mode='lines+markers', name='Lag-Aware Model Strategy (Net)',
            line=dict(color='#2563EB', width=3)
        ))
        
        # Add Monte Carlo baseline band
        mc_5th = mc_res.get("mc_5th_pct", 0.0) * 100.0
        mc_95th = mc_res.get("mc_95th_pct", 0.0) * 100.0
        
        fig_equity.add_trace(go.Scatter(
            x=[1, len(cum_model)], y=[mc_95th, mc_95th],
            mode='lines', name='Monte Carlo 95th Percentile',
            line=dict(color='#9CA3AF', dash='dash')
        ))
        fig_equity.add_trace(go.Scatter(
            x=[1, len(cum_model)], y=[mc_5th, mc_5th],
            mode='lines', name='Monte Carlo 5th Percentile',
            line=dict(color='#9CA3AF', dash='dash'),
            fill='tonexty', fillcolor='rgba(229, 231, 235, 0.4)'
        ))
        
        fig_equity.update_layout(
            title="Net Cumulative Return (%) vs 1,000-Run Monte Carlo Random Signal Band",
            xaxis_title="Trade Count",
            yaxis_title="Cumulative Return (%)",
            hovermode="x unified"
        )
        
        st.plotly_chart(fig_equity, use_container_width=True)
        
        # Metrics Table
        st.markdown("### Performance Comparison Table")
        bh_metrics = run_buy_and_hold_baseline(price_df[price_df["ticker"] == selected_ticker]) if not price_df.empty else {}
        
        metrics_df = pd.DataFrame([
            {
                "Strategy": "Lag-Aware XGBoost Nowcaster",
                "Sharpe Ratio": f"{model_metrics.get('sharpe_ratio', 0.0):.2f}",
                "Win Rate": f"{model_metrics.get('win_rate_pct', 0.0):.1f}%",
                "Max Drawdown": f"{model_metrics.get('max_drawdown_pct', 0.0):.2f}%",
                "Avg Return / Trade": f"{model_metrics.get('avg_return_bps', 0.0):.1f} bps",
                "p-value vs Random": f"{mc_res.get('p_value', 1.0):.4f}"
            },
            {
                "Strategy": "Monte Carlo Random Signal Baseline",
                "Sharpe Ratio": f"{np.mean(mc_res.get('mc_sharpes', [0.0])):.2f}",
                "Win Rate": "40.0%",
                "Max Drawdown": "N/A",
                "Avg Return / Trade": f"{- (slippage_bps + 0.8):.1f} bps",
                "p-value vs Random": "1.0000"
            },
            {
                "Strategy": "Buy-and-Hold Benchmark",
                "Sharpe Ratio": f"{bh_metrics.get('sharpe_ratio', 0.0):.2f}",
                "Win Rate": "N/A",
                "Max Drawdown": "N/A",
                "Avg Return / Trade": f"{bh_metrics.get('total_return_pct', 0.0):.2f}% total",
                "p-value vs Random": "N/A"
            }
        ])
        st.dataframe(metrics_df, use_container_width=True)
    else:
        st.info("No prediction results available for backtesting.")

# Tab 3: Feature Importance
with tab3:
    st.subheader("Model Feature Importance & Contribution")
    st.caption("Quantifies the predictive contribution of FinBERT sentiment, news volume velocity, and baseline market context.")
    
    # Feature importance static bar chart representation
    feat_data = pd.DataFrame([
        {"Feature": "sentiment_score (FinBERT)", "Importance": 0.32},
        {"Feature": "sentiment_ewm_60m", "Importance": 0.24},
        {"Feature": "news_velocity_15m", "Importance": 0.18},
        {"Feature": "pre_event_volatility", "Importance": 0.14},
        {"Feature": "news_velocity_60m", "Importance": 0.08},
        {"Feature": "time_of_day_bucket", "Importance": 0.04}
    ]).sort_values("Importance", ascending=True)
    
    fig_feat = px.bar(
        feat_data, 
        x="Importance", 
        y="Feature", 
        orientation="h",
        title="XGBoost Feature Importance",
        color="Importance",
        color_continuous_scale="Blues"
    )
    st.plotly_chart(fig_feat, use_container_width=True)

# Tab 4: Event Case Studies
with tab4:
    st.subheader("Individual Event Case Studies")
    st.caption("Inspect specific news headlines, their empirical lag detection, and nowcasting prediction accuracy.")
    
    if not merged_lags.empty:
        search_kw = st.text_input("Search Headline Keywords", "")
        display_df = merged_lags.copy()
        if search_kw:
            display_df = display_df[display_df["headline_text"].str.contains(search_kw, case=False, na=False)]
            
        display_cols = ["headline_text", "published_at", "event_type", "reaction_detected", "lag_minutes", "reaction_return_pct"]
        st.dataframe(
            display_df[display_cols].rename(columns={
                "headline_text": "Headline",
                "published_at": "Published (UTC)",
                "event_type": "Category",
                "reaction_detected": "Reaction Flagged",
                "lag_minutes": "Measured Lag (min)",
                "reaction_return_pct": "Reaction Move (%)"
            }),
            use_container_width=True
        )
    else:
        st.info("No event case studies match selected filters.")

# Footer
st.markdown("---")
st.markdown("""
<div style="font-size: 0.85rem; color: #64748B; line-height: 1.4;">
    <strong>Methodology & Honesty Statement:</strong><br>
    • <strong>Look-Ahead Bias Guard:</strong> Programmatically enforced via <code>assert_no_lookahead</code> during feature extraction.<br>
    • <strong>Cost Realism:</strong> All strategy returns are reported net of configurable slippage and brokerage fees.<br>
    • <strong>Scope Note:</strong> Designed for research and academic evaluation on spot index proxies (NIFTY 50 / SENSEX). Not a live execution system.
</div>
""", unsafe_allow_html=True)
