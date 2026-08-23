# Frontend UI Specification: "The Seismograph" Monitoring Terminal

**Project:** Intraday Nowcasting Engine for Indian Equity Indices  
**Theme:** Seismological Monitoring Station Terminal  
**Design Philosophy:** The project's data *is* seismographic data. Intraday price returns represent the seismic trace; financial news headlines represent seismic events; market reaction lag represents P-wave arrival time; volatility shocks represent tremor magnitude; and index selectors represent station channels.

---

## 1. Design System & Constraints

- **Color Palette:** Clinical Dark Slate (`#0B0F17` primary background, `#121824` container background, `#1E2638` border stroke, `#64748B` muted text, `#38BDF8` signal trace line, `#F43F5E` shock deflection marker).
- **Typography:** `SF Mono`, `Cascadia Code`, `Fira Code`, or `Courier New` monospaced fonts throughout.
- **Borders & Edges:** Sharp 0px to 2px radii, zero drop shadows, zero soft glows, zero color gradients.
- **Data Binding:** 100% real Supabase PostgreSQL endpoints (`/api/lag-distribution`, `/api/metrics`, `/api/case-studies`, `/api/seismograph-trace`).

---

## 2. Core Visual Components

### Component 1: Live Seismograph Strip Chart (`SeismographDrum.jsx`)
- **Visual Structure:** A continuous, horizontally scrolling drum recorder canvas plotting 1-minute index returns over time.
- **Base Signal:** A flat, muted hairline trace along the central baseline (`0.0%`).
- **Event Tick Markers:** Vertical ticks dropped on the trace at headline publication timestamps (`t_0`), labeled with monospaced Event IDs (`#EV-241`). Hovering opens an observation tooltip displaying full headline text, VADER sentiment, and event category.
- **P-Wave Shock Annotations:** When `reaction_detected == True` (`has_data_gap == False`), the trace deflects into a vertical waveform with amplitude scaled to `reaction_return_pct`. The deflection onset is annotated with arrival lag (`P-wave lag: 2m`).
- **Visual Proof of Null Result:** Events with `reaction_detected == False` remain flat along the baseline, visually proving the 67.4% no-reaction finding without needing text explanation.

### Component 2: Richter-Style Shock Magnitude Gauge (`MagnitudeScale.jsx`)
- Replaces standard KPI cards with a vertical seismic magnitude gauge calibrated against `reaction_return_pct` distribution ($\text{Magnitude} = \log_{10}(|\Delta P| / \sigma_{\text{base}})$).
- Historical shocks cluster along tick marks on the scale, visually reinforcing that 67.4% of events land near zero magnitude.

### Component 3: Monitoring Station Control Panel (`StationControls.jsx`)
- **Station Selector:** Toggle between Stations `^NSEI` (NIFTY 50) and `^BSESN` (SENSEX 30).
- **Tremor Classification Filter:** Filter by event class (`MONETARY_POLICY`, `EARNINGS`, `GEOPOLITICAL`, `MACRO_TAX`).
- **Instrument Dials:** Styled range controls for transaction cost and slippage parameters (`slippage_bps`, `flat_fee_inr`).

### Component 4: USGS-Style Seismological Event Log (`SeismicBulletin.jsx`)
- Fixed-width, monospaced event log formatting historical case studies as an official seismic bulletin printout:
```text
================================================================================
STATION  TIMESTAMP (IST)       CLASS       P-LAG   MAGNITUDE (RETURN)  STATUS
================================================================================
^NSEI    2026-08-21 10:15 AM   MONETARY    02 MIN  +0.184% (SHOCK)     DETECTED
^BSESN   2026-08-21 11:30 AM   EARNINGS    -- MIN   0.012% (DRIFT)     NO SHOCK
================================================================================
```

### Component 5: Low-Activity Session Panel (`QuietSessionPanel.jsx`)
- A quiet horizontal panel displaying a low-volatility trading session trace with zero deflections, titled: **"Station Record: Baseline Consolidation (No Significant Activity Detected)"**.

---

## 3. Implementation Order (Post-Report Phase)

1. **Step 1:** Add `/api/seismograph-trace` FastAPI endpoint to serve 1-minute return series merged with event markers.
2. **Step 2:** Build HTML5 Canvas / SVG `SeismographDrum.jsx` component.
3. **Step 3:** Implement `MagnitudeScale.jsx` and `StationControls.jsx`.
4. **Step 4:** Replace React dashboard main view with Seismograph Terminal UI.
