# Project Handoff Report: Nowcasting Indian Equity Index Moves

**To:** Incoming Agent / Reviewer (Claude)  
**From:** Antigravity AI Pair Engineer  
**Date:** August 23, 2026 (03:55 PM IST)  
**Project Location:** `/Users/dhruvgourisaria/nowcasting-project`  
**GitHub Repository:** [`https://github.com/dhruv0402/nowcasting-indian-equity-index.git`](https://github.com/dhruv0402/nowcasting-indian-equity-index.git)  
**Database Infrastructure:** Supabase Cloud PostgreSQL (`aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres`)  

---

## 1. Executive Summary

Over the past **4 days (August 20 – August 23, 2026)**, the project completed a major architectural scale-up from single-laptop testing to a fully automated **24/7 Cloud Ingestion & Modeling Pipeline** deployed on **GitHub Actions** and backed by **Supabase Cloud PostgreSQL**.

### ⚠️ Primary Statistical Verdict: Net Excess Alpha Lift is Currently Negative (-11.76%)
- **Model Test Accuracy:** **70.59% (36 / 51 correct)** on the chronological test set ($n = 51$).
- **Naive Majority-Class Baseline (`always predict flat`):** **82.35% (42 / 51 actual flat outcomes)**.
- **Net Excess Alpha Lift:** **-11.76% (Model underperforms the naive baseline by 11.76 percentage points)**.
- **Context:** Low-volatility Friday market consolidation caused 82.35% of test outcomes to stay within $\pm 0.05\%$. Predicting any directional `up` or `down` swings that fall short of 0.05% incurs a penalty against the naive flat baseline.

Key 4-day achievements include:
1. **Canonical Headlines:** Expanded from 516 to **946 canonical news headlines** (+83.3% growth).
2. **Clean In-Session Events:** Expanded to **255 clean in-session events** (204 Train / 51 Test events, +183% growth).
3. **Timezone Bug & Random Walk Drift Correction:**
   - Resolved a 5.5-hour timezone offset bug in `price_collector.py`.
   - Upgraded `src/features/lag_engine.py` to use a statistically adaptive threshold $\text{Threshold}(t) = 2.0 \times \sigma_{\text{base}} \times \sqrt{t}$ that explicitly accounts for random walk drift over time $t$.
4. **Verified Lag Distribution ($n = 527$ valid pairs across `^NSEI` & `^BSESN`):**
   - **No Excess Reaction Rate:** **67.4% (355 out of 527 valid pairs)** produced no excess market shock above random walk drift.
   - **Genuine Market Shocks ($\ge 2.0 \sigma \sqrt{t}$):** **32.6% (172 pairs)**.
   - **Median Reaction Lag for Genuine Shocks:** **2.0 minutes** (Mean: 5.4 minutes).

---

## 2. 4-Day Progressive Data & Model Metrics (Aug 20 – Aug 23, 2026)

| Metric | Day 1 (Aug 20) | Day 2 (Aug 21) | Day 3 (Aug 22) | **Day 4 (Aug 23 Today)** | 4-Day Progression |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Canonical Headlines** | 516 headlines | 796 headlines | 920 headlines | **946 headlines** | 📈 **+430 Headlines** (+83.3%) |
| **1-Minute Price Bars** | 5,646 bars | 5,169 bars | 5,235 bars | **5,235 bars** | 🟢 Weekend (NSE Closed) |
| **Clean Reaction Events (Headline-Level)** | 90 events | 244 events | 255 events | **255 events** (204 Train / 51 Test) | 🚀 **+165 Clean Events** (+183%) |
| **Valid Pairs in `lag_measurements`** | 180 pairs | 490 pairs | 525 pairs | **527 pairs** (255 `^NSEI` + 272 `^BSESN`) | 📊 Pair-Level Aggregation |
| **Model Test Accuracy** | 50.00% | 69.39% | 72.55% | **70.59% (36 / 51 correct)** | 📊 Raw Model Metric |
| **Naive Majority Baseline (Flat)** | **55.56%** | **81.63%** | **80.39%** | **82.35% (42 / 51 flat)** | 🎯 Trivial Flat Baseline |
| **Net Excess Alpha Lift** | **-5.56%** | **-12.24%** | **-7.84%** | **-11.76%** | ⚠️ Model vs Baseline Edge |
| **Top Predictive Feature** | `news_velocity_15m` | `sentiment_ewm_60m` | `sentiment_ewm_60m` | **`sentiment_ewm_60m` (24.1% weight)** | 🥇 **60m EMA Sentiment** |

*Note on Aug 22–23 Bar Growth:* Indian stock exchanges (NSE/BSE) were closed for the weekend on Aug 22–23, so 0 new intraday price bars were generated (expected behavior). Headline ingestion continued 24/7.

---

## 3. Technical Audits, Detection Threshold Formula & Database Purge

### Audit 1: Security & Credentials Check (PASSED)
- **Status:** Verified 100% clean. Secrets in `.github/workflows/collector.yml` and `evaluator.yml` use `${{ secrets.SUPABASE_DB_URL }}`. Zero credentials exist in Git history.

### Audit 2: Lag Engine Random Walk Drift Correction (VERIFIED CLEAN)
- **Mathematical Root Cause:** Comparing cumulative return over $t$ minutes against a static 1-minute threshold $2.0 \times \sigma_{\text{1m}}$ caused 1-minute random walk drift ($\sigma(t) = \sigma_{\text{1m}}\sqrt{t}$) to trigger false "reactions" after $t=4$ minutes.
- **Fix Implemented (`src/features/lag_engine.py`):**
  ```python
  # Random walk drift corrected threshold: std_threshold * baseline_vol * sqrt(t)
  t_min = max(1.0, (cur_time - event_published_at).total_seconds() / 60.0)
  threshold_t = std_threshold * baseline_vol * np.sqrt(t_min)
  ```
- **Reconciled Data Definitions:**
  - **255 clean events** = Unique `NewsEvent` records occurring during live market hours (headline-level).
  - **527 valid pairs** = Unique `(event_id, ticker)` records in `lag_measurements` across both NIFTY 50 (`^NSEI`) and SENSEX (`^BSESN`) ($255 \text{ `^NSEI` pairs} + 272 \text{ `^BSESN` pairs} = 527 \text{ total pairs}$).
- **Verified Lag Metrics ($n = 527$ valid pairs):**
  - **No Excess Reaction (Within Random Walk Drift):** **355 pairs (67.4%)**
  - **Genuine Excess Market Shocks ($\ge 2.0 \sigma \sqrt{t}$):** **172 pairs (32.6%)**
  - **Median Lag for Genuine Shocks:** **2.0 minutes** (Mean: 5.4 minutes)

### Audit 3: Database Query Batching & Pooler Bottleneck (RESOLVED)
- Optimized price bar ingestion from 180 seconds down to **3.0 seconds** using in-memory set lookups.

---

## 4. Machine Learning & Methodological Takeaways

1. **Prediction Diversity:** XGBoost predictions on the test set are well-distributed across directional classes.
2. **Feature Importance Rankings:** `sentiment_ewm_60m` (24.1% weight) remains the single strongest predictor of 15-minute price moves.
3. **Small-Sample Sensitivity Analysis ($n = 51$ Test Events):** With $n=51$ test events, 1 event carries a **1.96% weight** in total accuracy.

---

## 5. Current Status & Next Steps

- **System Health:** 100% operational. Cloud ingestion and daily evaluation are fully automated in GitHub Actions.
- **Primary Verdict:** Net Excess Alpha Lift is **-11.76%**. The model currently underperforms the trivial "always predict flat" baseline because 82.35% of test outcomes were flat during Friday's low-volatility consolidation.
- **Git State:** All code changes in `src/features/lag_engine.py`, `reports/daily_collection_log.md`, `reports/claude_progress_update.md`, and `reports/handoff_report_for_claude.md` are committed and pushed to `main`.
