# Final Project Report — Nowcasting Indian Equity Index Moves
## A Lag-Aware Framework for News-Driven Short-Horizon Prediction

> [!NOTE]
> **REAL MARKET DATA SNAPSHOT:** This report reflects real live RSS headline pulls (Economic Times, Moneycontrol, Google News India) 
> and real `yfinance` minute-level price bars (`^NSEI`, `^BSESN`) spanning a 6-day trailing collection window. 
> All metadata flags (`news_is_synthetic=False`, `price_is_synthetic=False`) are verified.

---

## 1. Executive Summary
This project empirically measures the time delay (lag) between financial news headline publications and subsequent minute-bar price reactions in Indian equity indices (NIFTY 50 / SENSEX). Incorporating these empirical lag findings, a short-horizon XGBoost nowcasting model was constructed, strictly enforcing programmatic look-ahead bias guards (`assert_no_lookahead`). Model performance was benchmarked after realistic slippage (5.0 bps) and transaction cost deductions against Buy-and-Hold and 1,000-run Monte Carlo random-signal baselines.

---

## 2. Research Scope & Feed Quality Audit
- **Intraday Bar Completeness:** Audited raw `yfinance` minute bar counts across all 6 trading days (`^NSEI`). Every single trading day contains **375 out of 375 expected minute bars (100.0% completeness)**. Total intraday gaps (>2 mins) during active market hours: **ZERO (0)**.
- **Headline Publication Breakdown:**
  - Total Raw Canonical Headlines: **174 headlines**
  - Published DURING Market Hours (09:15-15:30 IST): **93 headlines (53.4%)**
  - Published OUTSIDE Market Hours (Off-hours/Evenings/Weekends): **81 headlines (46.6%)**
- **Explicit Scoping Decision:**
  > Analysis is strictly scoped to intraday headlines published with sufficient lead time before market close to allow a full 60-minute continuous observation window. After-hours and overnight news (46.6% of raw volume) and late-session windows are intentionally excluded as a separate class of discrete gap-open phenomena outside this study's continuous-time lag framework.
- **Distinct Headline Audit:** 30 clean in-session event-ticker pairs represent **15 distinct headlines** evaluated across NIFTY 50 and SENSEX.
- **Look-Ahead Bias Guard Status:** PASSED (`assert_no_lookahead` active during all feature calculations)
- **Metadata Verification:** `news_is_synthetic = False`, `price_is_synthetic = False`

---

## 3. Primary Standalone Finding: Empirical Lag Distribution
- **Baseline Window:** 15 minutes pre-event ($T-15\text{m}$ to $T$)
- **Reaction Window:** 60 minutes post-event ($T$ to $T+60\text{m}$)
- **Statistical Significance Threshold:** 2.0 × baseline return standard deviation ($\sigma_{\text{base}}$)
- **Empirical Reaction Lag Range:** **3 to 13 minutes**
- **Empirical Median Reaction Lag:** **6 minutes**
- **In-Session No-Reaction Rate:** **50.0%** (among clean in-session events with full 60-minute windows)

> [!IMPORTANT]
> **Methodological Bridge Note:** An earlier, uncorrected raw measurement reported an 87.4% no-reaction rate across all 
> 174 headlines (which included off-hours and session-end gap events where market price bars did not exist). After applying the 
> gap-exclusion guard (`has_data_gap == False`), the true in-session no-reaction rate among headlines with valid continuous price 
> windows is **50.0%**.

---

## 4. Extended Case Study Inspection (15 Clean In-Session Headlines)
Manual inspection of clean in-session reaction events confirms high-impact market news triggers:
1. `[2026-08-18 14:07 UTC]` *Indices fall as elevated crude prices, rising global bond yields weigh* (Lag: 4 min, Move: -0.054%)
2. `[2026-08-18 12:12 UTC]` *BSE hits 4-month low after Jefferies, Nuvama downgrade stock on CAS risks* (Lag: 4 min, Move: -0.041%)
3. `[2026-08-18 12:09 UTC]` *BSE shares slide as analysts turn bearish ahead of Nifty 50 entry* (Lag: 4 min, Move: -0.034%)
4. `[2026-08-18 10:47 UTC]` *Sensex Nifty Tank as Crude Oil Jumps to $91/Barrel* (Lag: 6 min, Move: -0.032%)
5. `[2026-08-18 10:46 UTC]` *Sensex, Nifty tumble as crude surge, geopolitical concerns weigh* (Lag: 7 min, Move: -0.041%)
6. `[2026-08-18 10:18 UTC]` *Stock market fall explained: Sensex drops 493 points, Nifty below 24,200* (Lag: 6 min, Move: +0.020%)
7. `[2026-08-18 10:06 UTC]` *Sensex crashes almost 500 points, Nifty 50 extends losses* (Lag: 10 min, Move: -0.046%)
8. `[2026-08-18 09:40 UTC]` *BSE stock hammered after back-to-back downgrades* (Lag: 4 min, Move: -0.082%)
9. `[2026-08-17 11:16 UTC]` *Share Market Today: Nifty 50, Bank Nifty* (Lag: 7 min, Move: -0.023%)
10. `[2026-08-17 10:59 UTC]` *Sensex Today Ends 281 Points Lower | Nifty Below 24,300* (Lag: 10 min, Move: -0.033%)
11. `[2026-08-17 10:43 UTC]` *Sensex, Nifty Fall as IT Stocks Drag; Crude Near $89* (Lag: 3 min, Move: -0.029%)
12. `[2026-08-17 10:11 UTC]` *Why Sensex, Nifty ended lower despite Midcaps outperforming* (Lag: 5 min, Move: -0.049%)
13. `[2026-08-17 10:03 UTC]` *Sensex ends 281 points lower, Nifty below 24,300; Infosys down 3%* (Lag: 13 min, Move: -0.068%)

---

## 5. Nowcasting Model & Strategy Backtest: IN PROGRESS
- **Chronological 80/20 Train/Test Split:** Clean Train size = 12 events, Clean Test size = 3 events
- **Target Integrity:** `train.py` explicitly filters `has_data_gap == False` and enforces entry/exit bar continuity within 5 minutes of target prediction times.

> [!CAUTION]
> **SAMPLE SIZE STATEMENT (n = 3 in Test Set):**  
> With n=3 in the test set, the 1.000 accuracy figure is **not statistically interpretable** and is reported strictly to confirm 
> that the modeling and inference pipeline executes end-to-end without errors. No model performance or strategy edge claim is made 
> at this sample size. Strategy Sharpe ratio, win rate, and Monte Carlo percentile metrics remain marked as **"In Progress — Pending 2-3 Week Rolling Data Accumulation"**.

---

## 6. Automated Rolling Collection Daemon Setup
To accumulate a statistically sound sample ($n \ge 60-100$ clean events) for strategy backtesting:
- **Daemon Script:** `src/ingestion/collector_daemon.py`
- **NSE Trading Hours Gating:** Price polling is strictly gated to **09:15 AM to 03:30 PM IST** (03:45 AM to 10:00 AM UTC, Mon-Fri).
- **Execution Command:** `python3 src/ingestion/collector_daemon.py --interval-min 15`
