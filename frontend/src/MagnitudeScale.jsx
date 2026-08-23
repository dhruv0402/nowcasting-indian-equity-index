import React from "react";

/**
 * MagnitudeScale
 * --------------
 * Vertical Richter-style magnitude scale component.
 * Calibrated against return standard deviations:
 *   Mag 0.0 - 1.0: Micro tremor (Baseline noise)
 *   Mag 2.0: Dynamic Shock Threshold (2.0 * sigma * sqrt(t))
 *   Mag 3.0+: Major Market Shock
 */
export default function MagnitudeScale({ noReactionPct = 67.4, cleanCount = 265 }) {
  // Generate sample historical shock markers clustered near bottom (67.4% null result)
  const historicalTicks = [
    { id: 1, mag: 0.2, label: "67.4% Baseline Noise", isShock: false },
    { id: 2, mag: 0.4, label: "Null Drift", isShock: false },
    { id: 3, mag: 0.5, label: "Null Drift", isShock: false },
    { id: 4, mag: 0.8, label: "Null Drift", isShock: false },
    { id: 5, mag: 2.1, label: "#EV-241 (P-4m)", isShock: true },
    { id: 6, mag: 2.8, label: "#EV-198 (P-7m)", isShock: true },
    { id: 7, mag: 3.4, label: "#EV-219 (P-3m)", isShock: true },
  ];

  return (
    <div style={{
      backgroundColor: "#0E1420",
      border: "1px solid #1C2638",
      padding: "16px",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
      fontFamily: "var(--font-mono)",
      borderRadius: "2px"
    }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        borderBottom: "1px solid #1C2638",
        paddingBottom: "8px"
      }}>
        <span style={{ fontSize: "11px", color: "#00F0FF", fontWeight: 700, letterSpacing: "0.05em" }}>
          RICHTER MAGNITUDE SCALE
        </span>
        <span style={{ fontSize: "10px", color: "#64748B" }}>log₁₀(|ΔP| / σ)</span>
      </div>

      <div style={{ display: "flex", gap: "16px", height: "180px" }}>
        {/* Scale Gauge Bar */}
        <div style={{
          width: "28px",
          height: "100%",
          backgroundColor: "#080B11",
          border: "1px solid #1C2638",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justify: "space-between",
          alignItems: "center",
          padding: "4px 0"
        }}>
          {/* Threshold marker line at Mag 2.0 */}
          <div style={{
            position: "absolute",
            bottom: "40%",
            left: 0,
            right: 0,
            height: "2px",
            backgroundColor: "#FF3B5C",
            zIndex: 2
          }} />
          <span style={{
            position: "absolute",
            bottom: "42%",
            right: "-42px",
            fontSize: "9px",
            color: "#FF3B5C",
            fontWeight: 700
          }}>
            SHOCK ≥2.0σ
          </span>

          {[5, 4, 3, 2, 1, 0].map((num) => (
            <div key={num} style={{ fontSize: "9px", color: num >= 2 ? "#FF3B5C" : "#64748B", fontWeight: 600 }}>
              {num}
            </div>
          ))}
        </div>

        {/* Shock Distribution Markers */}
        <div style={{
          flex: 1,
          height: "100%",
          position: "relative",
          backgroundColor: "#080B11",
          border: "1px solid #1C2638",
          padding: "8px"
        }}>
          <div style={{ fontSize: "10px", color: "#64748B", marginBottom: "8px" }}>
            EVENT SHOCK CLUSTERS ({cleanCount} EVENTS)
          </div>

          {historicalTicks.map((t) => {
            const bottomPct = (t.mag / 5.0) * 100;
            return (
              <div
                key={t.id}
                style={{
                  position: "absolute",
                  bottom: `${bottomPct}%`,
                  left: "8px",
                  right: "8px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                <div style={{
                  width: t.isShock ? "8px" : "4px",
                  height: t.isShock ? "8px" : "4px",
                  borderRadius: "50%",
                  backgroundColor: t.isShock ? "#FF3B5C" : "#64748B",
                  boxShadow: t.isShock ? "0 0 6px #FF3B5C" : "none"
                }} />
                <span style={{
                  fontSize: "9px",
                  color: t.isShock ? "#FF3B5C" : "#4B5563",
                  fontWeight: t.isShock ? 600 : 400
                }}>
                  Mag {t.mag}: {t.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{
        backgroundColor: "#080B11",
        border: "1px solid #1C2638",
        padding: "8px",
        fontSize: "10px",
        color: "#94A3B8",
        lineHeight: 1.4
      }}>
        <strong style={{ color: "#00F0FF" }}>STRUCTURAL FINDING:</strong> {noReactionPct}% of events remain below the 2.0σ shock threshold (clustered at Mag &lt; 1.0 baseline noise).
      </div>
    </div>
  );
}
