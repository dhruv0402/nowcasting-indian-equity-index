import React from "react";

export default function MagnitudeScale({ noReactionPct = 67.4, cleanCount = 265 }) {
  return (
    <div style={{
      backgroundColor: "#0E1420",
      border: "1px solid #1C2638",
      padding: "16px",
      borderRadius: "6px",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
      fontFamily: "var(--font-mono)"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "12px", color: "#00F0FF", fontWeight: 700, letterSpacing: "0.05em" }}>
          SHOCK INTENSITY GAUGE
        </span>
        <span style={{ fontSize: "11px", color: "#64748B" }}>2.0σ√t Drift Scaled</span>
      </div>

      {/* Modern Gradient Scale Bar */}
      <div style={{ position: "relative", marginTop: "6px" }}>
        <div style={{
          height: "10px",
          width: "100%",
          borderRadius: "5px",
          background: "linear-gradient(to right, #64748B 0%, #00F0FF 40%, #D29922 70%, #FF3B5C 100%)",
          boxShadow: "0 0 10px rgba(0, 240, 255, 0.2)"
        }} />
        
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "10px",
          color: "#94A3B8",
          marginTop: "6px"
        }}>
          <span>Mag 0.0 (Noise)</span>
          <span style={{ color: "#00F0FF" }}>Mag 2.0 (Threshold)</span>
          <span style={{ color: "#FF3B5C" }}>Mag 5.0 (Rupture)</span>
        </div>
      </div>

      {/* Clean Status Legend */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "8px",
        marginTop: "6px",
        fontSize: "11px",
        color: "#94A3B8"
      }}>
        <div style={{ padding: "8px", backgroundColor: "#080B11", border: "1px solid #1C2638", borderRadius: "4px" }}>
          <div style={{ color: "#64748B", fontSize: "9px" }}>NULL SHOCK RATE</div>
          <div style={{ color: "#00F0FF", fontSize: "14px", fontWeight: 700, marginTop: "2px" }}>{noReactionPct}%</div>
        </div>
        <div style={{ padding: "8px", backgroundColor: "#080B11", border: "1px solid #1C2638", borderRadius: "4px" }}>
          <div style={{ color: "#64748B", fontSize: "9px" }}>AUDITED EVENTS</div>
          <div style={{ color: "#34D399", fontSize: "14px", fontWeight: 700, marginTop: "2px" }}>{cleanCount} Events</div>
        </div>
      </div>

      <div style={{ fontSize: "10px", color: "#64748B", lineHeight: "1.4", borderTop: "1px solid #1C2638", paddingTop: "8px" }}>
        Over {noReactionPct}% of headlines produce zero market deflection, safely absorbing within random walk Brownian drift.
      </div>
    </div>
  );
}
