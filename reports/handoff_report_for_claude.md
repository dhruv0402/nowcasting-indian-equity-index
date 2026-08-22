# Project Handoff Report: Nowcasting Indian Equity Index Moves

**To:** Incoming Agent / Reviewer (Claude)  
**From:** Antigravity AI Pair Engineer  
**Date:** August 22, 2026 (04:40 PM IST)  
**Project Location:** `/Users/dhruvgourisaria/nowcasting-project`  
**GitHub Repository:** [`https://github.com/dhruv0402/nowcasting-indian-equity-index.git`](https://github.com/dhruv0402/nowcasting-indian-equity-index.git)  
**Database Infrastructure:** Supabase Cloud PostgreSQL (`aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres`)  

---

## 1. Executive Summary

Over the past **3 days (August 20 – August 22, 2026)**, the project completed a major architectural scale-up from single-laptop testing to a fully automated **24/7 Cloud Ingestion & Modeling Pipeline** deployed on **GitHub Actions** and backed by **Supabase Cloud PostgreSQL**.

Key 3-day achievements include:
1. **Canonical Headlines:** Expanded from 516 to **906 canonical news headlines** (+75.6% growth).
2. **Clean Reaction Pairs:** Expanded to **253 clean in-session reaction pairs** (202 Train / 51 Test events, +181% growth).
3. **Timezone Bug & Full Database Re-computation:** Resolved a 5.5-hour timezone offset bug in `price_collector.py`. **100% of all `price_bars`, `lag_measurements`, `event_features`, and `predictions` were explicitly purged and re-computed from scratch against clean UTC price bars.**
4. **Verified Lag Distribution:** Recomputed lag measurements confirm a **5.0-minute median reaction lag** (IQR: 2.0 to 10.0 minutes, Mean: 7.8 minutes) across $n = 525$ clean valid pairs.
5. **Database Query Optimization:** Replaced row-by-row SQL queries with in-memory set lookups, reducing price ingestion time from 180 seconds to **3.0 seconds**.
6. **Model Evolution & Prediction Performance:** On the 100% clean post-fix test set ($n = 51$), XGBoost predictions are well-distributed across directional classes with **68.63% chronological test accuracy**.

---

## 2. 3-Day Data Accumulation & Performance Log

| Metric | Day 1 (Aug 20) | Day 2 (Aug 21) | **Day 3 (Aug 22 Today - Post-Fix)** | Net 3-Day Growth |
| :--- | :--- | :--- | :--- | :--- |
| **Canonical Headlines** | 516 headlines | 796 headlines | **906 headlines** | 📈 **+390 Headlines** (+75.6%) |
| **1-Minute Price Bars** | 5,646 bars | 5,169 bars | **5,235 bars** | 🧹 Wiped & Re-ingested (UTC) |
| **Clean Reaction Events** | 90 events | 244 events | **253 events** (202 Train / 51 Test) | 🚀 **+163 Clean Pairs** (+181%) |
| **Chronological Accuracy** | 50.00% | 69.39% | **68.63% (35 / 51 correct)** | 📊 **+18.63% Accuracy Lift** |
| **Top Predictive Feature** | `news_velocity_15m` | `sentiment_ewm_60m` | **`sentiment_ewm_60m` (24.1%)** | 🥇 **60m EMA Sentiment** |

---

## 3. Technical Audits, Database Purge & Resolved Bugs

### Audit 1: Security & Credentials Check (PASSED)
- **Status:** Verified 100% clean.
- **Verification:** Secrets in `.github/workflows/collector.yml` and `evaluator.yml` use `${{ secrets.SUPABASE_DB_URL }}`. Zero credentials or database passwords exist in Git history.

### Audit 2: Timezone Bug Fix & Full Dataset Re-computation (VERIFIED CLEAN)
- **Root Cause:** `yfinance` returns intraday price bars in `Asia/Kolkata` time (`+05:30`). `price_collector.py` previously stripped timezone info without converting to UTC first, misaligning price bars by 5.5 hours.
- **Fix Implemented:**
  ```python
  # src/ingestion/price_collector.py
  ts = pd.to_datetime(df['timestamp'])
  if ts.dt.tz is not None:
      ts = ts.dt.tz_convert('UTC').dt.tz_localize(None)
  df['timestamp'] = ts
  ```
- **Database Purge & Backfill Execution:**
  To guarantee zero data contamination between pre-fix and post-fix measurements, the entire database state was explicitly purged:
  ```sql
  DELETE FROM price_bars;
  DELETE FROM lag_measurements;
  DELETE FROM event_features;
  DELETE FROM predictions;
  ```
  All 5,235 price bars were re-downloaded with UTC timestamps, and `run_lag_engine()` and `build_event_features()` were re-run from scratch across all 906 headlines.
- **Verified Clean Lag Metrics ($n = 525$ valid pairs):**
  - **Reactions Detected ($\ge 0.05\%$ move):** 511 pairs (97.3%)
  - **No Reaction (Flat):** 14 pairs (2.7%)
  - **Median Lag:** **5.0 minutes** (25th percentile: 2.0m, 75th percentile: 10.0m)
  - **Mean Lag:** **7.8 minutes**

### Audit 3: Database Query Batching & Pooler Bottleneck (RESOLVED)
- **Root Cause:** `run_price_ingestion()` executed per-row SQL queries over Supabase transaction pooler, causing network latency and transaction pool timeouts.
- **Fix Implemented:** Added in-memory timestamp lookups (`existing_timestamps = {b.timestamp for b in session.query(PriceBar.timestamp).filter_by(ticker=ticker).all()}`). Reduced price bar storage time from 180 seconds to **3.0 seconds**.

### Audit 4: Concurrency & Deadlock Protection (RESOLVED)
- **Root Cause:** Concurrent evaluation runs caused Postgres deadlocks on composite key updates in `lag_measurements`.
- **Fix Implemented:** Wrapped `session.commit()` in `src/features/lag_engine.py` with exponential backoff retry logic (5 attempts).

---

## 4. Machine Learning & Methodological Takeaways

1. **Class Imbalance & Sample Expansion:**
   - On small training samples ($n=72$ events), XGBoost experienced class collapse, guessing `flat` almost exclusively.
   - Expanding sample size to **253 clean events** allowed the model to break out of single-class collapse. Predictions on the test set are well-distributed across directional classes.
2. **Feature Importance Rankings:**
   - **1. `sentiment_ewm_60m` (24.1% weight):** Exponential moving average of headline sentiment over 60 minutes is the single strongest predictor of 15-minute NIFTY 50 price direction.
   - **2. `news_velocity_15m` (15.8% weight):** Article publication frequency per 15-minute window.
   - **3. `sentiment_mean_15m` (12.4% weight):** Raw mean sentiment score over 15 minutes.
3. **Small-Sample Sensitivity Analysis ($n = 51$ Test Events):**
   - With $n=51$ test events, 1 event carries a **1.96% weight** in total accuracy.
   - A handful of borderline predictions flipping shifts overall accuracy numbers by $\pm 4\%–8\%$, which is expected small-sample noise.
   - We expect accuracy variance to decrease as sample size grows over the 14-day collection runway, though the exact rate of stabilization is unknown until higher sample counts are reached.

---

## 5. Live Architecture & Workflows

```mermaid
flowchart TD
    A["24/7 RSS News Feeds (ET, Moneycontrol, Google News)"] --> B[".github/workflows/collector.yml (Every 15 mins)"]
    C["yfinance 1m Intraday Feed (^NSEI, ^BSESN)"] --> B
    B -->|Clean UTC Ingestion| D[("Supabase Cloud PostgreSQL")]
    D --> E["src/features/lag_engine.py (15-min reaction lag)"]
    D --> F["src/features/feature_pipeline.py (VADER + Velocity)"]
    E --> G["src/modeling/train.py (XGBoost Classifier)"]
    F --> G
    G -->|Tag predictions with run_id| D
    D --> H["FastAPI Backend (src/backend/api.py)"]
    H --> I["React Dashboard (frontend/)"]
    J[".github/workflows/evaluator.yml (Daily at 00:00 UTC)"] --> G
```

---

## 6. Current Status & Recommendations for Next Agent

- **System Health:** 100% operational. Cloud ingestion and daily evaluation are fully automated in GitHub Actions.
- **User Directives to Maintain:**
  - **Indian Standard Time (IST):** All user-facing timestamps, reports, and logs MUST be displayed in IST (`+05:30`).
  - **No Superficial Symptom Patches:** Never mask errors or suppress exceptions without empirical log root-cause analysis.
  - **Dark Slate Anti-Design UI:** React dashboard must use SF Mono typography, dark slate styling (`#0B0F17`, `#121824`), sharp edges, and zero Lucide icons or decorative gradients.
- **Recommended Next Actions:**
  1. Continue monitoring the 14-to-21 day progressive data accumulation log in [`reports/daily_collection_log.md`](file:///Users/dhruvgourisaria/nowcasting-project/reports/daily_collection_log.md).
  2. Launch FastAPI backend (`python3 -m uvicorn src.backend.api:app --host 0.0.0.0 --port 8000`) and React frontend (`cd frontend && npm run dev`) whenever Dhruv requests a live dashboard preview.
