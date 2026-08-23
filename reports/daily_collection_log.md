# 7-Day Progressive Cloud Data Collection & Daily Evaluation Log

**Project:** Nowcasting Indian Equity Index Moves (`^NSEI` / `^BSESN`)  
**Data Infrastructure:** Supabase Cloud PostgreSQL  
**Automation:** GitHub Actions (`collector.yml` 24/7 Daemon & `evaluator.yml` Daily Run)  
**Methodology Epoch:** Clean Measurement Era (Post-Timezone & Post-Drift Correction)  

---

### ⚠️ Note on Data Provenance & Methodology Boundary

> **Methodological Boundary Established August 23, 2026:**  
> Prior to August 23, 2026, the data collection pipeline underwent two major bug fixes:
> 1. **Timezone Conversion Fix (`price_collector.py`):** Converted `yfinance` `Asia/Kolkata` intraday timestamps to UTC before stripping timezone metadata (`9c26a9e`).
> 2. **Random Walk Drift Correction (`lag_engine.py`):** Upgraded static $2 \sigma_{\text{1m}}$ thresholds to adaptive $\text{Threshold}(t) = 2.0 \times \sigma_{\text{base}} \times \sqrt{t}$ thresholds to account for Brownian motion variance growth over time.
> 
> To prevent mixing invalid pre-fix measurements with clean post-fix data, **all pre-fix historical rows from August 20–22 have been excluded**. The 7-Day Progressive Tracking Log begins cleanly on **August 23, 2026 as Day 1 of the Clean Measurement Era**.

---

### 📊 Clean Measurement Era Tracking Log (Aug 23 – Sept 5, 2026)

| Log Date | Canonical Headlines | Total Price Bars | Clean Events (Train / Test) | Valid Pairs (NSEI / BSESN) | Model Test Accuracy | Naive Baseline (Flat) | **Net Excess Alpha Lift** | Top Predictive Feature | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **2026-08-23 (Day 1)** | 946 | 5,235 | 265 (212 / 53) | 527 (265 / 262) | **70.59%** | **82.35%** | **-11.76%** | `sentiment_ewm_60m` (24.1%) | 🟢 Epoch Baseline Established* |
| **2026-08-24 (Day 2)** | *Pending* | *Pending* | *Pending* | *Pending* | *Pending* | *Pending* | *Pending* | *Pending* | ⏳ Scheduled |
| **2026-08-25 (Day 3)** | *Pending* | *Pending* | *Pending* | *Pending* | *Pending* | *Pending* | *Pending* | *Pending* | ⏳ Scheduled |
| **2026-08-26 (Day 4)** | *Pending* | *Pending* | *Pending* | *Pending* | *Pending* | *Pending* | *Pending* | *Pending* | ⏳ Scheduled |
| **2026-08-27 (Day 5)** | *Pending* | *Pending* | *Pending* | *Pending* | *Pending* | *Pending* | *Pending* | *Pending* | ⏳ Scheduled |
| **2026-08-28 (Day 6)** | *Pending* | *Pending* | *Pending* | *Pending* | *Pending* | *Pending* | *Pending* | *Pending* | ⏳ Scheduled |
| **2026-08-29 (Day 7)** | *Pending* | *Pending* | *Pending* | *Pending* | *Pending* | *Pending* | *Pending* | *Pending* | ⏳ Scheduled |
| **2026-08-30 (Day 8)** | *Pending* | *Pending* | *Pending* | *Pending* | *Pending* | *Pending* | *Pending* | *Pending* | ⏳ Scheduled |
| **2026-08-31 (Day 9)** | *Pending* | *Pending* | *Pending* | *Pending* | *Pending* | *Pending* | *Pending* | *Pending* | ⏳ Scheduled |
| **2026-09-01 (Day 10)**| *Pending* | *Pending* | *Pending* | *Pending* | *Pending* | *Pending* | *Pending* | *Pending* | ⏳ Scheduled |

*\*Day 1 Baseline Note (Aug 23): Computed from clean cumulative market data up to Friday Aug 21 close (logged Sunday Aug 23 during weekend trading pause).*

---

### 📝 Tracking Protocol & Rules
1. **Daily Execution:** `.github/workflows/evaluator.yml` executes automatically at 00:00 UTC (05:30 AM IST).
2. **Apples-to-Apples Evaluation:** Every daily entry MUST report both Model Accuracy and Naive Flat Baseline on the exact same test set.
3. **No Retrospective Editing:** Once a day's row is logged, it remains fixed to preserve authentic sample accumulation history over the 14-day runway toward the Sept 5–10 deadline.
4. **Mid-Epoch Bug Protocol:** If a bug is discovered affecting already-logged rows, the fix is dated and noted in a new addendum footnote—existing rows are annotated as "known-affected, see addendum," never silently altered or deleted.
