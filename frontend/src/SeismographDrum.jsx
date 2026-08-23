import React, { useEffect, useRef, useState, useMemo } from "react";

/**
 * SeismographDrum
 * ----------------
 * Seismological Drum Recorder Terminal Visual Component.
 * High-DPI Canvas plotting 1-minute return series, event tick markers (#EV-241),
 * P-wave arrival annotations, and null-result baseline trace.
 */

function useMockData() {
  return useMemo(() => {
    const startTime = new Date("2026-08-21T03:45:00Z").getTime(); // 09:15 IST
    const totalMinutes = 375;
    const priceBars = [];
    let price = 24250;

    for (let i = 0; i <= totalMinutes; i++) {
      price += (Math.random() - 0.5) * 3;
      priceBars.push({
        timestamp: new Date(startTime + i * 60000).toISOString(),
        ticker: "^NSEI",
        close: Math.round(price * 100) / 100,
      });
    }

    const events = [
      {
        event_id: "EV-241",
        headline_text: "Indices fall as elevated crude prices, rising global bond yields weigh",
        published_at: new Date(startTime + 42 * 60000).toISOString(),
        event_type: "macro_data",
        reaction_detected: true,
        has_data_gap: false,
        lag_minutes: 4,
        reaction_return_pct: -0.054,
      },
      {
        event_id: "EV-198",
        headline_text: "Sensex, Nifty tumble as crude surge, geopolitical concerns weigh",
        published_at: new Date(startTime + 96 * 60000).toISOString(),
        event_type: "geopolitical",
        reaction_detected: true,
        has_data_gap: false,
        lag_minutes: 7,
        reaction_return_pct: -0.041,
      },
      {
        event_id: "EV-205",
        headline_text: "RBI holds repo rate steady; commentary seen as mildly hawkish",
        published_at: new Date(startTime + 150 * 60000).toISOString(),
        event_type: "monetary_policy",
        reaction_detected: false,
        has_data_gap: false,
        lag_minutes: null,
        reaction_return_pct: null,
      },
      {
        event_id: "EV-212",
        headline_text: "IT major beats quarterly estimates, guidance unchanged",
        published_at: new Date(startTime + 210 * 60000).toISOString(),
        event_type: "earnings",
        reaction_detected: false,
        has_data_gap: false,
        lag_minutes: null,
        reaction_return_pct: null,
      },
      {
        event_id: "EV-219",
        headline_text: "BSE hits 4-month low after Jefferies, Nuvama downgrade stock",
        published_at: new Date(startTime + 270 * 60000).toISOString(),
        event_type: "corporate_action",
        reaction_detected: true,
        has_data_gap: false,
        lag_minutes: 3,
        reaction_return_pct: -0.038,
      },
      {
        event_id: "EV-226",
        headline_text: "Routine sector commentary, minor rebalancing note from brokerage",
        published_at: new Date(startTime + 320 * 60000).toISOString(),
        event_type: "other",
        reaction_detected: false,
        has_data_gap: false,
        lag_minutes: null,
        reaction_return_pct: null,
      },
    ];

    events.forEach((ev) => {
      if (!ev.reaction_detected) return;
      const evMinute = Math.round((new Date(ev.published_at).getTime() - startTime) / 60000);
      const lagIdx = evMinute + ev.lag_minutes;
      for (let i = lagIdx; i < Math.min(lagIdx + 15, priceBars.length); i++) {
        const progress = (i - lagIdx) / 15;
        priceBars[i].close += ev.reaction_return_pct * priceBars[lagIdx].close * progress * 0.012;
      }
    });

    return { priceBars, events, startTime };
  }, []);
}

const C = {
  bg: "#080B11",
  panel: "#0E1420",
  border: "#1C2638",
  grid: "#141D2B",
  baseline: "#00F0FF",
  trace: "#38BDF8",
  shock: "#FF3B5C",
  muted: "#64748B",
  text: "#E2E8F0",
};

export default function SeismographDrum({ ticker = "^NSEI" }) {
  const mock = useMockData();
  const [liveData, setLiveData] = useState(null);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [hoveredEvent, setHoveredEvent] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [width, setWidth] = useState(900);

  useEffect(() => {
    fetch(`http://localhost:8000/api/seismograph-trace?ticker=${encodeURIComponent(ticker)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data && data.priceBars && data.priceBars.length > 5) {
          const startTime = new Date(data.priceBars[0].timestamp).getTime();
          setLiveData({ priceBars: data.priceBars, events: data.events, startTime });
        }
      })
      .catch((err) => console.error("Seismograph live trace fetch error:", err));
  }, [ticker]);

  const { priceBars, events, startTime } = liveData || mock;

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setWidth(containerRef.current.clientWidth);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const layout = useMemo(() => {
    if (!priceBars || priceBars.length < 2) return null;
    const basePrice = priceBars[0].close;
    const returns = priceBars.map((b) => (b.close - basePrice) / basePrice);
    const minRet = Math.min(...returns, -0.005);
    const maxRet = Math.max(...returns, 0.005);

    return {
      returns,
      minRet,
      maxRet,
      totalMinutes: priceBars.length - 1,
    };
  }, [priceBars]);

  // High-DPI Canvas Renderer
  useEffect(() => {
    if (!layout || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const height = 240;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const padLeft = 50;
    const padRight = 20;
    const padTop = 30;
    const padBottom = 30;
    const chartW = width - padLeft - padRight;
    const chartH = height - padTop - padBottom;

    const getTimeX = (tIso) => {
      const tMs = new Date(tIso).getTime();
      const elapsedMin = (tMs - startTime) / 60000;
      const frac = Math.max(0, Math.min(1, elapsedMin / layout.totalMinutes));
      return padLeft + frac * chartW;
    };

    const getRetY = (retVal) => {
      const norm = (retVal - layout.minRet) / (layout.maxRet - layout.minRet || 1);
      return padTop + chartH * (1 - norm);
    };

    const zeroY = getRetY(0);

    // 1. Background Fill
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, width, height);

    // 2. Seismic Millimeter Grid Mesh
    ctx.lineWidth = 1;
    ctx.strokeStyle = C.grid;
    const gridCols = 12;
    for (let c = 0; c <= gridCols; c++) {
      const gx = padLeft + (chartW / gridCols) * c;
      ctx.beginPath();
      ctx.moveTo(gx, padTop);
      ctx.lineTo(gx, padTop + chartH);
      ctx.stroke();
    }

    const gridRows = 6;
    for (let r = 0; r <= gridRows; r++) {
      const gy = padTop + (chartH / gridRows) * r;
      ctx.beginPath();
      ctx.moveTo(padLeft, gy);
      ctx.lineTo(padLeft + chartW, gy);
      ctx.stroke();
    }

    // 3. Central Baseline (0.00% Return)
    ctx.strokeStyle = C.baseline;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padLeft, zeroY);
    ctx.lineTo(padLeft + chartW, zeroY);
    ctx.stroke();

    // 4. Return Axis Labels
    ctx.fillStyle = C.muted;
    ctx.font = "10px SFMono-Regular, Consolas, monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText("0.00%", padLeft - 6, zeroY);
    ctx.fillText(`+${(layout.maxRet * 100).toFixed(2)}%`, padLeft - 6, padTop);
    ctx.fillText(`${(layout.minRet * 100).toFixed(2)}%`, padLeft - 6, padTop + chartH);

    // 5. Seismograph Continuous Trace Line
    ctx.strokeStyle = C.trace;
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    priceBars.forEach((bar, idx) => {
      const ret = (bar.close - priceBars[0].close) / priceBars[0].close;
      const x = getTimeX(bar.timestamp);
      const y = getRetY(ret);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // 6. Render News Events & P-Wave Shock Deflections
    events.forEach((ev) => {
      const evX = getTimeX(ev.published_at);
      if (evX < padLeft || evX > padLeft + chartW) return;

      // Event tick line
      ctx.strokeStyle = ev.reaction_detected ? C.shock : C.muted;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(evX, padTop);
      ctx.lineTo(evX, padTop + chartH);
      ctx.stroke();
      ctx.setLineDash([]);

      // Event ID Badge
      ctx.fillStyle = ev.reaction_detected ? C.shock : C.panel;
      ctx.fillRect(evX - 22, padTop - 22, 44, 16);
      ctx.strokeStyle = ev.reaction_detected ? C.shock : C.border;
      ctx.strokeRect(evX - 22, padTop - 22, 44, 16);

      ctx.fillStyle = ev.reaction_detected ? "#FFFFFF" : C.text;
      ctx.font = "bold 9px SFMono-Regular, Consolas, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(ev.event_id, evX, padTop - 14);

      // P-Wave Arrival Callout Badge on Reaction Shock
      if (ev.reaction_detected && ev.lag_minutes) {
        const evMs = new Date(ev.published_at).getTime();
        const shockMs = evMs + ev.lag_minutes * 60000;
        const shockX = getTimeX(new Date(shockMs).toISOString());

        ctx.fillStyle = C.shock;
        ctx.beginPath();
        ctx.arc(shockX, zeroY, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#FF3B5C";
        ctx.fillRect(shockX + 6, zeroY - 18, 54, 14);
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "bold 9px SFMono-Regular, Consolas, monospace";
        ctx.textAlign = "left";
        ctx.fillText(`P-${ev.lag_minutes}m SHOCK`, shockX + 10, zeroY - 10);
      }
    });
  }, [layout, events, priceBars, startTime, width]);

  // Handle Mouse Over for Event Inspection
  const handleMouseMove = (e) => {
    if (!containerRef.current || !events || !layout) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    setMousePos({ x: mx, y: my });

    const padLeft = 50;
    const chartW = width - 70;

    const hit = events.find((ev) => {
      const evMs = new Date(ev.published_at).getTime();
      const elapsedMin = (evMs - startTime) / 60000;
      const evX = padLeft + (elapsedMin / layout.totalMinutes) * chartW;
      return Math.abs(mx - evX) < 25;
    });

    setHoveredEvent(hit || null);
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoveredEvent(null)}
      style={{
        backgroundColor: C.panel,
        border: `1px solid ${C.border}`,
        borderRadius: "2px",
        padding: "16px",
        fontFamily: "var(--font-mono)",
        position: "relative",
      }}
    >
      {/* Station Terminal Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", borderBottom: `1px solid ${C.border}`, paddingBottom: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: C.baseline, boxShadow: "0 0 8px #00F0FF" }} />
          <span style={{ fontSize: "12px", color: C.text, fontWeight: 700, letterSpacing: "0.05em" }}>
            SEISMIC STATION DRUM RECORDER [{ticker}]
          </span>
        </div>
        <div style={{ fontSize: "10px", color: C.muted, display: "flex", gap: "12px" }}>
          <span>SAMPLING: 1m</span>
          <span>|</span>
          <span>CALIBRATION: DYNAMIC 2.0σ√t</span>
          <span>|</span>
          <span>STATUS: RECORDING</span>
        </div>
      </div>

      {/* Canvas Recorder View */}
      <canvas ref={canvasRef} style={{ width: `${width - 32}px`, height: "240px", display: "block" }} />

      {/* Observation Tooltip */}
      {hoveredEvent && (
        <div
          style={{
            position: "absolute",
            top: `${mousePos.y + 15}px`,
            left: `${Math.min(mousePos.x, width - 260)}px`,
            backgroundColor: "#080B11",
            border: `1px solid ${hoveredEvent.reaction_detected ? C.shock : C.border}`,
            padding: "10px",
            maxWidth: "260px",
            zIndex: 100,
            fontSize: "11px",
            color: C.text,
            boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", color: C.muted, fontSize: "10px" }}>
            <span style={{ color: hoveredEvent.reaction_detected ? C.shock : C.baseline, fontWeight: 700 }}>{hoveredEvent.event_id}</span>
            <span>{hoveredEvent.event_type.toUpperCase()}</span>
          </div>
          <div style={{ fontSize: "11px", lineHeight: "1.3", marginBottom: "6px" }}>{hoveredEvent.headline_text}</div>
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: "4px", display: "flex", justifyContent: "space-between", fontSize: "10px" }}>
            <span>REACTION: {hoveredEvent.reaction_detected ? "SHOCK DETECTED" : "NO SHOCK (DRIFT)"}</span>
            {hoveredEvent.lag_minutes && <span style={{ color: C.shock, fontWeight: 700 }}>P-LAG: {hoveredEvent.lag_minutes}m</span>}
          </div>
        </div>
      )}
    </div>
  );
}
