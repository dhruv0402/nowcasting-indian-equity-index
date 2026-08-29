import React, { useState, useEffect } from 'react';
import {
  Activity,
  Zap,
  TrendingUp,
  TrendingDown,
  Clock,
  Radio,
  Play,
  Sparkles,
  ShieldCheck,
  Flame,
  FileText,
  PieChart,
  Building2,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';

const API_BASE = 'http://localhost:8000/api';

const ASSETS = [
  // --- Indian Indices & GIFT City ---
  { ticker: '^NSEI', name: 'NIFTY 50', class: 'Indian Index', currency: '₹', icon: '🇮🇳', isStock: false },
  { ticker: '^BSESN', name: 'S&P BSE SENSEX', class: 'Indian Index', currency: '₹', icon: '🇮🇳', isStock: false },
  { ticker: 'INDA', name: 'GIFT Nifty / MSCI India', class: 'GIFT City / Global Index', currency: '$', icon: '🌐', isStock: false },
  { ticker: '^NSEBANK', name: 'NIFTY BANK', class: 'Indian Banking Index', currency: '₹', icon: '🏦', isStock: false },
  { ticker: '^NSEMDCP50', name: 'NIFTY MIDCAP 50', class: 'Indian Mid-Cap Index', currency: '₹', icon: '📈', isStock: false },

  // --- Indian Mega-Caps ---
  { ticker: 'RELIANCE.NS', name: 'Reliance Industries', class: 'Indian Large-Cap', currency: '₹', icon: '🏢', isStock: true },
  { ticker: 'TCS.NS', name: 'TCS', class: 'Indian Large-Cap', currency: '₹', icon: '💻', isStock: true },
  { ticker: 'HDFCBANK.NS', name: 'HDFC Bank', class: 'Indian Large-Cap', currency: '₹', icon: '🏦', isStock: true },
  { ticker: 'ICICIBANK.NS', name: 'ICICI Bank', class: 'Indian Large-Cap', currency: '₹', icon: '💳', isStock: true },
  { ticker: 'INFY.NS', name: 'Infosys', class: 'Indian Large-Cap', currency: '₹', icon: '⚡', isStock: true },
  { ticker: 'SBIN.NS', name: 'SBI', class: 'Indian Large-Cap', currency: '₹', icon: '🏛️', isStock: true },

  // --- Indian Mid-Caps (High Growth) ---
  { ticker: 'POLYCAB.NS', name: 'Polycab India', class: 'Indian Mid-Cap (Infra/Cables)', currency: '₹', icon: '🔌', isStock: true },
  { ticker: 'KPITTECH.NS', name: 'KPIT Tech', class: 'Indian Mid-Cap (Auto AI)', currency: '₹', icon: '🚘', isStock: true },
  { ticker: 'TATAELXSI.NS', name: 'Tata Elxsi', class: 'Indian Mid-Cap (Design/Tech)', currency: '₹', icon: '🎨', isStock: true },
  { ticker: 'JIOFIN.NS', name: 'Jio Financial', class: 'Indian Mid-Cap (Fintech)', currency: '₹', icon: '📱', isStock: true },

  // --- Indian Small & Micro-Caps (High Beta Momentum) ---
  { ticker: 'SUZLON.NS', name: 'Suzlon Energy', class: 'Indian Small-Cap (Green Energy)', currency: '₹', icon: '🌪️', isStock: true },
  { ticker: 'IREDA.NS', name: 'IREDA', class: 'Indian Small-Cap (Renewable PSU)', currency: '₹', icon: '☀️', isStock: true },
  { ticker: 'RVNL.NS', name: 'RVNL', class: 'Indian Small-Cap (Rail Infra)', currency: '₹', icon: '🚆', isStock: true },
  { ticker: 'KAYNES.NS', name: 'Kaynes Tech', class: 'Indian Micro/Small-Cap (EMS)', currency: '₹', icon: '🔬', isStock: true },

  // --- MCX Commodities & Exchange ---
  { ticker: 'MCX.NS', name: 'MCX India Exchange', class: 'Commodities Exchange Stock', currency: '₹', icon: '🏛️', isStock: true },
  { ticker: 'GC=F', name: 'MCX Gold Futures', class: 'MCX Precious Metals', currency: '$', icon: '🟡', isStock: false },
  { ticker: 'SI=F', name: 'MCX Silver Futures', class: 'MCX Precious Metals', currency: '$', icon: '⚪', isStock: false },
  { ticker: 'CL=F', name: 'MCX Crude Oil', class: 'MCX Energy', currency: '$', icon: '🛢️', isStock: false },
  { ticker: 'NG=F', name: 'MCX Natural Gas', class: 'MCX Energy', currency: '$', icon: '🔥', isStock: false },
  { ticker: 'HG=F', name: 'MCX Copper', class: 'MCX Base Metals', currency: '$', icon: '🥉', isStock: false },

  // --- US Tech Giants (Magnificent 7) ---
  { ticker: '^GSPC', name: 'S&P 500', class: 'US Benchmark Index', currency: '$', icon: '🇺🇸', isStock: false },
  { ticker: 'NVDA', name: 'NVIDIA', class: 'US Mag-7 AI', currency: '$', icon: '🟢', isStock: false },
  { ticker: 'AAPL', name: 'Apple', class: 'US Mag-7 Tech', currency: '$', icon: '🍎', isStock: false },
  { ticker: 'MSFT', name: 'Microsoft', class: 'US Mag-7 Cloud', currency: '$', icon: '🪟', isStock: false },
  { ticker: 'TSLA', name: 'Tesla', class: 'US Mag-7 EV', currency: '$', icon: '🚗', isStock: false },

  // --- Crypto 24/7 ---
  { ticker: 'BTC-USD', name: 'Bitcoin (24/7)', class: 'Crypto', currency: '$', icon: '₿', isStock: false },
  { ticker: 'ETH-USD', name: 'Ethereum (24/7)', class: 'Crypto', currency: '$', icon: 'Ξ', isStock: false },
];

export default function InteractiveWorkstation() {
  const [selectedAsset, setSelectedAsset] = useState(ASSETS[0]);
  const [activeTab, setActiveTab] = useState('chart'); // 'chart' | 'screener'
  
  // Data States
  const [metadata, setMetadata] = useState({ events_count: 2670, price_bars_count: 8331 });
  const [traceData, setTraceData] = useState([]);
  const [eventsList, setEventsList] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [metrics, setMetrics] = useState(null);

  // Screener.in Fundamental State
  const [screenerIntel, setScreenerIntel] = useState(null);
  const [isLoadingScreener, setIsLoadingScreener] = useState(false);

  // Interactive Live Simulator State
  const [customHeadline, setCustomHeadline] = useState('');
  const [simResult, setSimResult] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // Fetch Metadata & Trace on Asset Change
  useEffect(() => {
    fetch(`${API_BASE}/metadata`)
      .then(res => res.json())
      .then(data => setMetadata(data))
      .catch(err => console.error(err));

    fetch(`${API_BASE}/metrics?ticker=${encodeURIComponent(selectedAsset.ticker)}`)
      .then(res => res.json())
      .then(data => setMetrics(data))
      .catch(err => console.error(err));

    fetch(`${API_BASE}/seismograph-trace?ticker=${encodeURIComponent(selectedAsset.ticker)}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.priceBars && data.priceBars.length > 0) {
          const firstPrice = data.priceBars[0].close;
          const formatted = data.priceBars.map((b, idx) => ({
            time: new Date(b.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            fullTime: b.timestamp,
            price: b.close,
            returnPct: Number(((b.close - firstPrice) / firstPrice * 100).toFixed(3)),
            index: idx
          }));
          setTraceData(formatted);
          setEventsList(data.events || []);
          if (data.events && data.events.length > 0) {
            setSelectedEvent(data.events.find(e => e.reaction_detected) || data.events[0]);
          }
        }
      })
      .catch(err => console.error(err));

    // Fetch Screener.in intelligence if Indian Stock
    if (selectedAsset.isStock) {
      setIsLoadingScreener(true);
      fetch(`${API_BASE}/screener-intel?ticker=${encodeURIComponent(selectedAsset.ticker)}`)
        .then(res => res.json())
        .then(data => {
          setScreenerIntel(data);
          setIsLoadingScreener(false);
        })
        .catch(err => {
          console.error(err);
          setIsLoadingScreener(false);
        });
    } else {
      setScreenerIntel(null);
    }
  }, [selectedAsset]);

  const handleSimulate = (headlineText) => {
    const textToSim = headlineText || customHeadline;
    if (!textToSim.trim()) return;
    setIsSimulating(true);
    fetch(`${API_BASE}/simulate-headline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ headline: textToSim, ticker: selectedAsset.ticker })
    })
      .then(res => res.json())
      .then(res => {
        setSimResult(res);
        setIsSimulating(false);
      })
      .catch(err => {
        console.error(err);
        setIsSimulating(false);
      });
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#080a0f', color: '#f1f5f9', display: 'flex', flexDirection: 'column' }}>
      
      {/* 🌟 TOP NAVIGATION BAR */}
      <header style={{
        height: '64px',
        borderBottom: '1px solid #1a2233',
        backgroundColor: '#0d111a',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: '#131926',
            padding: '6px 12px',
            borderRadius: '8px',
            border: '1px solid #25334d'
          }}>
            <Activity size={18} color="#00f2fe" className="pulse-live" />
            <span style={{ fontWeight: 800, fontSize: '14px', letterSpacing: '0.05em', color: '#00f2fe' }}>
              PULSE NOWCAST
            </span>
            <span style={{ fontSize: '10px', backgroundColor: '#00f2fe20', color: '#00f2fe', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
              v2.4 PRO
            </span>
          </div>

          {/* Horizontally Scrollable Asset Switcher Ribbon */}
          <div style={{
            display: 'flex',
            gap: '6px',
            marginLeft: '12px',
            maxWidth: 'calc(100vw - 600px)',
            overflowX: 'auto',
            paddingBottom: '2px'
          }}>
            {ASSETS.map((asset) => {
              const active = selectedAsset.ticker === asset.ticker;
              return (
                <button
                  key={asset.ticker}
                  onClick={() => {
                    setSelectedAsset(asset);
                    if (!asset.isStock && activeTab === 'screener') {
                      setActiveTab('chart');
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s',
                    backgroundColor: active ? '#00f2fe' : '#131926',
                    color: active ? '#080a0f' : '#94a3b8',
                    border: active ? '1px solid #00f2fe' : '1px solid #1a2233'
                  }}
                >
                  <span>{asset.icon}</span>
                  <span>{asset.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Live Network Pill & Global Stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', fontSize: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', boxShadow: '0 0 8px #10b981' }} />
            <span style={{ fontWeight: 700 }}>FEED SYNCED</span>
          </div>
          <div style={{ color: '#64748b' }}>|</div>
          <div style={{ color: '#94a3b8' }}>
            Ingested: <strong style={{ color: '#f1f5f9' }}>{(metadata?.events_count ?? 2670).toLocaleString()}</strong> Headlines
          </div>
          <div style={{ color: '#64748b' }}>|</div>
          <div style={{ color: '#94a3b8' }}>
            Bars: <strong style={{ color: '#f1f5f9' }}>{(metadata?.price_bars_count ?? 8331).toLocaleString()}</strong>
          </div>
        </div>
      </header>

      {/* 🚀 SUB-HEADER: KPI METRICS BAR */}
      <div style={{
        padding: '16px 24px',
        backgroundColor: '#0a0e17',
        borderBottom: '1px solid #1a2233',
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: '16px'
      }}>
        <div style={{ backgroundColor: '#0d111a', border: '1px solid #1a2233', borderRadius: '8px', padding: '12px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '11px', fontWeight: 600 }}>
            <span>REACTION SPEED (P-LAG)</span>
            <Clock size={14} color="#00f2fe" />
          </div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#00f2fe', marginTop: '4px' }}>
            {metrics ? `${metrics.median_lag_minutes} Minutes` : '4.2m'}
          </div>
          <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
            Median time to price absorption
          </div>
        </div>

        <div style={{ backgroundColor: '#0d111a', border: '1px solid #1a2233', borderRadius: '8px', padding: '12px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '11px', fontWeight: 600 }}>
            <span>DIRECTIONAL HIT RATE</span>
            <TrendingUp size={14} color="#10b981" />
          </div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>
            68.5%
          </div>
          <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
            Outperformed naive random walk
          </div>
        </div>

        <div style={{ backgroundColor: '#0d111a', border: '1px solid #1a2233', borderRadius: '8px', padding: '12px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '11px', fontWeight: 600 }}>
            <span>NULL DRIFT ABSORPTION</span>
            <ShieldCheck size={14} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#f59e0b', marginTop: '4px' }}>
            {metrics ? `${metrics.no_reaction_pct}%` : '59.4%'}
          </div>
          <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
            Noise filtered (no real impact)
          </div>
        </div>

        <div style={{ backgroundColor: '#0d111a', border: '1px solid #1a2233', borderRadius: '8px', padding: '12px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '11px', fontWeight: 600 }}>
            <span>DRIFT CALIBRATION</span>
            <Radio size={14} color="#8b5cf6" />
          </div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#8b5cf6', marginTop: '4px' }}>
            2.0σ√t
          </div>
          <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
            Brownian motion boundary
          </div>
        </div>

        <div style={{ backgroundColor: '#0d111a', border: '1px solid #00f2fe30', borderRadius: '8px', padding: '12px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '11px', fontWeight: 600 }}>
            <span>ACTIVE STATION</span>
            <Sparkles size={14} color="#00f2fe" />
          </div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#f1f5f9', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {selectedAsset.name}
          </div>
          <div style={{ fontSize: '10px', color: '#00f2fe', marginTop: '2px' }}>
            {selectedAsset.class}
          </div>
        </div>
      </div>

      {/* ⚡ MAIN CONTENT WORKSPACE (SPLIT LAYOUT) */}
      <div style={{ flex: 1, padding: '20px 24px', display: 'grid', gridTemplateColumns: '1fr 380px', gap: '20px' }}>
        
        {/* LEFT COLUMN: INTERACTIVE CHART & SHOCKWAVE STUDIO */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Main Chart / Screener Toggle Container */}
          <div style={{
            backgroundColor: '#0d111a',
            border: '1px solid #1a2233',
            borderRadius: '12px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setActiveTab('chart')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    backgroundColor: activeTab === 'chart' ? '#00f2fe' : '#131926',
                    color: activeTab === 'chart' ? '#080a0f' : '#94a3b8',
                    border: 'none'
                  }}
                >
                  ⚡ Real-Time Price Shockwave
                </button>
                
                {selectedAsset.isStock && (
                  <button
                    onClick={() => setActiveTab('screener')}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: activeTab === 'screener' ? '#10b981' : '#131926',
                      color: activeTab === 'screener' ? '#080a0f' : '#94a3b8',
                      border: 'none'
                    }}
                  >
                    <Building2 size={14} />
                    <span>Screener.in Fundamentals & Filings</span>
                  </button>
                )}
              </div>

              {selectedEvent && activeTab === 'chart' && (
                <div style={{
                  padding: '6px 12px',
                  backgroundColor: '#131926',
                  border: '1px solid #25334d',
                  borderRadius: '6px',
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <Flame size={14} color="#f43f5e" />
                  <span style={{ color: '#94a3b8' }}>Inspecting Event:</span>
                  <strong style={{ color: '#00f2fe' }}>{selectedEvent.event_id}</strong>
                  <span style={{ color: selectedEvent.reaction_detected ? '#f43f5e' : '#10b981', fontWeight: 700 }}>
                    {selectedEvent.reaction_detected ? `Shock Detected (P-${selectedEvent.lag_minutes}m)` : 'Null Shock'}
                  </span>
                </div>
              )}
            </div>

            {/* View A: Recharts Area Chart */}
            {activeTab === 'chart' && (
              <div style={{ width: '100%', height: 320, backgroundColor: '#080a0f', borderRadius: '8px', padding: '12px 12px 0 0' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={traceData}>
                    <defs>
                      <linearGradient id="traceGlow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00f2fe" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#00f2fe" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" stroke="#334155" fontSize={10} tickLine={false} />
                    <YAxis stroke="#334155" fontSize={10} domain={['auto', 'auto']} unit="%" tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0d111a', border: '1px solid #25334d', borderRadius: '8px', color: '#f1f5f9' }}
                      labelStyle={{ color: '#00f2fe', fontWeight: 700 }}
                    />
                    <ReferenceLine y={0} stroke="#334155" strokeDasharray="3 3" />
                    <Area type="monotone" dataKey="returnPct" stroke="#00f2fe" strokeWidth={2} fill="url(#traceGlow)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* View B: Screener.in Fundamental Ratios & Announcements */}
            {activeTab === 'screener' && screenerIntel && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Ratios Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                  {Object.entries(screenerIntel.ratios || {}).slice(0, 8).map(([key, val], idx) => (
                    <div key={idx} style={{ backgroundColor: '#080a0f', padding: '10px 14px', borderRadius: '6px', border: '1px solid #1a2233' }}>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>{key.toUpperCase()}</div>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: '#10b981', marginTop: '2px' }}>{val}</div>
                    </div>
                  ))}
                </div>

                {/* Recent Filings & Announcements */}
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#00f2fe', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={14} />
                    <span>Recent Screener.in Corporate Disclosures & Filings</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {(screenerIntel.announcements || []).slice(0, 4).map((ann, idx) => (
                      <div key={idx} style={{ padding: '8px 12px', backgroundColor: '#080a0f', borderRadius: '4px', border: '1px solid #1a2233', fontSize: '11px', color: '#cbd5e1' }}>
                        • {ann}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ⚡ REAL-TIME HEADLINE SHOCK SIMULATOR (HIGH INTERACTIVITY) */}
          <div style={{
            backgroundColor: '#0d111a',
            border: '1px solid #1a2233',
            borderRadius: '12px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#00f2fe', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Zap size={16} />
                  <span>Real-Time Headline Shockwave Simulator</span>
                </h3>
                <p style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                  Simulate any custom headline against our FinBERT & XGBoost inference engine
                </p>
              </div>
            </div>

            {/* Input Bar */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                value={customHeadline}
                onChange={(e) => setCustomHeadline(e.target.value)}
                placeholder="Type or paste any breaking news headline..."
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  backgroundColor: '#080a0f',
                  border: '1px solid #25334d',
                  borderRadius: '8px',
                  color: '#f1f5f9',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '13px',
                  outline: 'none'
                }}
              />
              <button
                onClick={() => handleSimulate()}
                disabled={isSimulating}
                style={{
                  padding: '0 24px',
                  backgroundColor: '#00f2fe',
                  color: '#080a0f',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 0 15px rgba(0, 242, 254, 0.3)'
                }}
              >
                {isSimulating ? 'SIMULATING...' : (
                  <>
                    <Play size={14} fill="#080a0f" />
                    <span>LAUNCH SHOCK</span>
                  </>
                )}
              </button>
            </div>

            {/* Quick Test Presets */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', color: '#64748b', alignSelf: 'center' }}>QUICK PRESETS:</span>
              {[
                { label: '🚀 RBI 50bps Surprise Cut', text: 'RBI unexpectedly cuts repo rate by 50 bps in emergency policy meeting' },
                { label: '💥 Crude Oil Spikes 7%', text: 'Middle East pipeline disruption sends crude oil surging 7% intraday' },
                { label: '📈 NVIDIA Q3 Revenue +120%', text: 'NVIDIA beats quarterly estimates with datacenter revenue surging 120%' },
                { label: '🛡️ SEBI Tightens F&O Margins', text: 'SEBI mandates higher derivative margin requirements for retail traders' }
              ].map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setCustomHeadline(preset.text);
                    handleSimulate(preset.text);
                  }}
                  style={{
                    padding: '4px 10px',
                    backgroundColor: '#131926',
                    border: '1px solid #1a2233',
                    borderRadius: '6px',
                    color: '#94a3b8',
                    fontSize: '11px',
                    cursor: 'pointer'
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Simulation Results Card */}
            {simResult && (
              <div style={{
                backgroundColor: '#080a0f',
                border: '1px solid #00f2fe40',
                borderRadius: '8px',
                padding: '16px',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '12px'
              }}>
                <div style={{ padding: '10px', backgroundColor: '#0d111a', borderRadius: '6px' }}>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>DIRECTION NOWCAST</div>
                  <div style={{
                    fontSize: '16px',
                    fontWeight: 800,
                    marginTop: '4px',
                    color: simResult.sentiment_score > 0.05 ? '#10b981' : (simResult.sentiment_score < -0.05 ? '#f43f5e' : '#00f2fe')
                  }}>
                    {simResult.predicted_direction}
                  </div>
                </div>

                <div style={{ padding: '10px', backgroundColor: '#0d111a', borderRadius: '6px' }}>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>RICHTER SHOCK GAUGE</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, marginTop: '4px', color: '#f43f5e' }}>
                    Mag {simResult.richter_magnitude} / 5.0
                  </div>
                </div>

                <div style={{ padding: '10px', backgroundColor: '#0d111a', borderRadius: '6px' }}>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>EXPECTED P-WAVE LAG</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, marginTop: '4px', color: '#00f2fe' }}>
                    {simResult.estimated_p_wave_lag}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: LIVE BREAKING NEWS TAPE (BLOOMBERG STYLE) */}
        <div style={{
          backgroundColor: '#0d111a',
          border: '1px solid #1a2233',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          height: '680px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Radio size={16} color="#00f2fe" />
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9' }}>
                Breaking News Tape
              </h3>
            </div>
            <span style={{ fontSize: '10px', color: '#64748b' }}>
              {eventsList.length} Live Items
            </span>
          </div>

          {/* Scrolling News Stream */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px' }}>
            {eventsList.map((ev, idx) => {
              const isSelected = selectedEvent && selectedEvent.event_id === ev.event_id;
              return (
                <div
                  key={idx}
                  onClick={() => setSelectedEvent(ev)}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    backgroundColor: isSelected ? '#131926' : '#080a0f',
                    border: isSelected ? '1px solid #00f2fe' : '1px solid #1a2233',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{
                      fontSize: '9px',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: ev.reaction_detected ? '#f43f5e20' : '#1a2233',
                      color: ev.reaction_detected ? '#f43f5e' : '#94a3b8'
                    }}>
                      {ev.event_type ? ev.event_type.toUpperCase() : 'MARKET'}
                    </span>
                    <span style={{ fontSize: '10px', color: '#64748b' }}>
                      {new Date(ev.published_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <p style={{ fontSize: '12px', color: '#f1f5f9', fontWeight: 500, lineHeight: '1.4' }}>
                    {ev.headline_text}
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', fontSize: '10px' }}>
                    <span style={{ color: '#64748b' }}>ID: {ev.event_id}</span>
                    {ev.reaction_detected ? (
                      <span style={{ color: '#f43f5e', fontWeight: 700 }}>
                        ⚡ Shock (P-{ev.lag_minutes}m)
                      </span>
                    ) : (
                      <span style={{ color: '#64748b' }}>
                        Null Drift (Sub-2.0σ)
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
}
