import React, { useEffect, useRef, useState, useMemo } from "react";

/**
 * SeismographDrum
 * ----------------
 * Reference implementation for the nowcasting project's "seismograph" UI concept.
 *
 * Visual grammar:
 *   - Horizontal scrolling trace = 1-minute index return series (the "seismic trace")
 *   - Vertical tick markers      = news headline publication timestamps ("events")
 *   - Trace deflection           = detected reaction (reaction_detected === true)
 *   - Flat trace past a tick     = no reaction (the 67.4% no-reaction finding, shown structurally)
 *   - Annotation on deflection   = measured lag_minutes ("P-wave arrival")
 *
 * DATA CONTRACT (matches src/utils/db.py schema):
 *   priceBars: [{ timestamp: ISOString, ticker: string, close: number }]
 *   events: [{
 *     event_id, headline_text, published_at: ISOString, event_type,
 *     reaction_detected: boolean, has_data_gap: boolean,
 *     lag_minutes: number | null, reaction_return_pct: number | null
 *   }]
 *
 * TO WIRE UP TO THE REAL BACKEND:
 *   Replace `useMockData()` below with a fetch to a new endpoint, e.g.
 *     GET /api/seismograph-trace?ticker=^NSEI&start=...&end=...
 *   returning { priceBars, events } in the shape above. Everything else
 *   (rendering, tooltips, scaling) works unchanged against real data.
 *
 * No decorative color per project directive: dark slate only, sharp edges,
 * SF Mono typography, zero gradients.
 */

// ---------- Mock data generator (swap for real API call) ----------
function useMockData() {
  return useMemo(() => {
    const startTime = new Date("2026-08-18T03:45:00Z").getTime(); // 09:15 IST
    const totalMinutes = 375; // one NSE trading session
    const priceBars = [];
    let price = 24250;

    for (let i = 0; i <= totalMinutes; i++) {
      // small random walk baseline
      price += (Math.random() - 0.5) * 4;
      priceBars.push({
        timestamp: new Date(startTime + i * 60000).toISOString(),
        ticker: "^NSEI",
        close: Math.round(price * 100) / 100,
      });
    }

    // Hand-placed events resembling the project's real case studies
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

    // Inject a real deflection into the mock price series so detected events visibly move
    events.forEach((ev) => {
      if (!ev.reaction_detected) return;
      const evMinute = Math.round((new Date(ev.published_at).getTime() - startTime) / 60000);
      const lagIdx = evMinute + ev.lag_minutes;
      for (let i = lagIdx; i < Math.min(lagIdx + 12, priceBars.length); i++) {
        const progress = (i - lagIdx) / 12;
        priceBars[i].close += ev.reaction_return_pct * priceBars[lagIdx].close * progress * 0.01;
      }
    });

    return { priceBars, events, startTime };
  }, []);
}

const COLORS = {
  bg: "#0B0F17",
  panel: "#121824",
  border: "#1E2638",
  muted: "#64748B",
  trace: "#38BDF8",
  shock: "#F43F5E",
  text: "#CBD5E1",
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

  // Precompute layout: x-scale by time, y-scale by return relative to session baseline
  const layout = useMemo(() => {
    const height = 220;
    const paddingX = 24;
    const paddingY = 30;
    const plotW = width - paddingX * 2;
    const plotH = height - paddingY * 2;

    const t0 = new Date(priceBars[0].timestamp).getTime();
    const t1 = new Date(priceBars[priceBars.length - 1].timestamp).getTime();
    const basePrice = priceBars[0].close;

    const maxAbsReturn = Math.max(
      ...priceBars.map((b) => Math.abs((b.close - basePrice) / basePrice)),
      0.001
    );

    const xForTime = (ts) => {
      const t = new Date(ts).getTime();
      return paddingX + ((t - t0) / (t1 - t0)) * plotW;
    };
    const yForReturn = (close) => {
      const ret = (close - basePrice) / basePrice;
      return paddingY + plotH / 2 - (ret / maxAbsReturn) * (plotH / 2 - 10);
    };

    return { height, paddingX, paddingY, plotW, plotH, xForTime, yForReturn };
  }, [priceBars, width]);

  // Draw the trace on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = layout.height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${layout.height}px`;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, layout.height);

    // baseline hairline
    const baseY = layout.yForReturn(priceBars[0].close);
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(layout.paddingX, baseY);
    ctx.lineTo(width - layout.paddingX, baseY);
    ctx.stroke();

    // trace
    ctx.strokeStyle = COLORS.trace;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    priceBars.forEach((bar, i) => {
      const x = layout.xForTime(bar.timestamp);
      const y = layout.yForReturn(bar.close);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // event tick markers
    events.forEach((ev) => {
      const x = layout.xForTime(ev.published_at);
      ctx.strokeStyle = ev.reaction_detected ? COLORS.shock : COLORS.muted;
      ctx.lineWidth = ev.reaction_detected ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(x, layout.paddingY - 8);
      ctx.lineTo(x, layout.height - layout.paddingY + 8);
      ctx.stroke();

      // arrival-lag annotation for detected reactions
      if (ev.reaction_detected && ev.lag_minutes != null) {
        ctx.fillStyle = COLORS.shock;
        ctx.font = "10px SFMono-Regular, Menlo, monospace";
        ctx.textAlign = "center";
        ctx.fillText(`+${ev.lag_minutes}m`, x, layout.paddingY - 12);
      }
    });
  }, [priceBars, events, layout, width]);

  const handleMouseMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    setMousePos({ x: e.clientX, y: e.clientY });

    const hit = events.find((ev) => Math.abs(layout.xForTime(ev.published_at) - x) < 6);
    setHoveredEvent(hit || null);
  };

  return (
    <div
      ref={containerRef}
      style={{
        background: COLORS.bg,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 0,
        padding: "16px 16px 12px",
        fontFamily: '"SF Mono", "SFMono-Regular", Menlo, Consolas, monospace',
        color: COLORS.text,
        position: "relative",
        width: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 10,
          fontSize: 11,
          color: COLORS.muted,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        <span>Station: ^NSEI</span>
        <span>Session: 2026-08-18</span>
      </div>

      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredEvent(null)}
        style={{ display: "block", cursor: "crosshair" }}
      />

      <div
        style={{
          display: "flex",
          gap: 16,
          marginTop: 10,
          fontSize: 11,
          color: COLORS.muted,
        }}
      >
        <LegendDot color={COLORS.shock} label="Detected reaction" />
        <LegendDot color={COLORS.muted} label="No reaction" />
      </div>

      {hoveredEvent && (
        <div
          style={{
            position: "fixed",
            left: mousePos.x + 14,
            top: mousePos.y + 14,
            background: COLORS.panel,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 0,
            padding: "10px 12px",
            maxWidth: 280,
            fontSize: 12,
            lineHeight: 1.5,
            pointerEvents: "none",
            zIndex: 10,
          }}
        >
          <div style={{ color: COLORS.muted, fontSize: 10, textTransform: "uppercase", marginBottom: 4 }}>
            {hoveredEvent.event_id} &middot; {hoveredEvent.event_type.replace("_", " ")}
          </div>
          <div style={{ marginBottom: 6 }}>{hoveredEvent.headline_text}</div>
          {hoveredEvent.reaction_detected ? (
            <div style={{ color: COLORS.shock }}>
              Reaction detected &middot; lag {hoveredEvent.lag_minutes}m &middot;{" "}
              {(hoveredEvent.reaction_return_pct * 100).toFixed(2)}%
            </div>
          ) : (
            <div style={{ color: COLORS.muted }}>No significant reaction within 60m window</div>
          )}
        </div>
      )}
    </div>
  );
}

function LegendDot({ color, label }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 8, height: 8, background: color, display: "inline-block" }} />
      {label}
    </span>
  );
}
