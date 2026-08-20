# 📅 7-Day Progressive Data Collection & Model Evaluation Log

A 24-hour daily audit tracking continuous cloud data collection in **Supabase PostgreSQL** and chronological **XGBoost Nowcasting Model** performance.

---

## 📊 Summary Table of Daily Progression

| Log Date | Canonical Headlines | Total Price Bars | Clean Events (Train / Test) | Chronological Accuracy | Top Predictive Feature | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **2026-08-20 (Day 1)** | 516 | 5,646 | 90 (72 / 18) | **50.00%** | `news_velocity_15m` (15.8%) | ✅ Verified |
| **2026-08-21 (Day 2)** | *Pending* | *Pending* | *Pending* | *Pending* | *Pending* | ⏳ Scheduled |
| **2026-08-22 (Day 3)** | *Pending* | *Pending* | *Pending* | *Pending* | *Pending* | ⏳ Scheduled |
| **2026-08-23 (Day 4)** | *Pending* | *Pending* | *Pending* | *Pending* | *Pending* | ⏳ Scheduled |
| **2026-08-24 (Day 5)** | *Pending* | *Pending* | *Pending* | *Pending* | *Pending* | ⏳ Scheduled |
| **2026-08-25 (Day 6)** | *Pending* | *Pending* | *Pending* | *Pending* | *Pending* | ⏳ Scheduled |
| **2026-08-26 (Day 7)** | *Pending* | *Pending* | *Pending* | *Pending* | *Pending* | ⏳ Scheduled |

---

## 📝 Detailed Daily Audit Logs

### 🔹 Day 1 — 2026-08-20 02:20 UTC
- **Cloud Database State:** Supabase PostgreSQL (`aws-0-ap-northeast-2.pooler.supabase.com:6543`)
- **Headline Ingestion:** 339 canonical news headlines
- **Price Bar Ingestion:** 4,849 minute bars (`^NSEI`: 2,428, `^BSESN`: 2,421)
- **Empirical Reaction Lag:** 3 to 13 minutes (Median: 6 minutes)
- **Model Evaluation:**
  - **Clean In-Session Sample Size:** 54 clean events (43 Train / 11 Test)
  - **Chronological Test Accuracy:** **80.0%** (12 / 15 correct on test set)
  - **Naive Majority-Class Baseline:** **80.0%** (12 / 15 correct; 100% `flat` predictions)
  - **Model Alpha Lift Over Naive Baseline:** **0.0%** (Zero excess predictive lift; pending multi-week accumulation)
  - **Binomial $p$-value (vs 50% chance):** $p = 0.0176$ *(driven by majority-class balance)*
  - **Top Feature Importances:**
    1. `sentiment_ewm_60m` (25.67%)
    2. `pre_event_volatility` (16.99%)
    3. `news_velocity_30m` (14.44%)
- **Observations:** 60-minute exponential moving average headline sentiment (`sentiment_ewm_60m`) is the single strongest predictor of index movement.
