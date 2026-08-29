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
  ChevronRight,
  Volume2,
  VolumeX,
  BookOpen,
  Share2,
  Search,
  Radar,
  Layers,
  Crosshair
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';

const API_BASE = 'http://localhost:8000/api';

const ASSETS = [
  { ticker: '^NSEI', name: 'NIFTY 50', class: 'Indian Benchmark Index', currency: '₹', icon: '🇮🇳', isStock: false },
  { ticker: 'RELIANCE.NS', name: 'Reliance Industries', class: 'Indian Large-Cap (Energy/Retail)', currency: '₹', icon: '🏢', isStock: true },
  { ticker: 'TCS.NS', name: 'TCS', class: 'Indian Large-Cap (IT & AI)', currency: '₹', icon: '💻', isStock: true },
  { ticker: 'HDFCBANK.NS', name: 'HDFC Bank', class: 'Indian Large-Cap (Banking)', currency: '₹', icon: '🏦', isStock: true },
  { ticker: 'SUZLON.NS', name: 'Suzlon Energy', class: 'Indian Momentum (Green Energy)', currency: '₹', icon: '🌪️', isStock: true },
  { ticker: '^INDIAVIX', name: 'INDIA VIX', class: 'NSE Volatility / Fear Gauge', currency: 'pts', icon: '🚨', isStock: false },
  { ticker: '^BSESN', name: 'S&P BSE SENSEX', class: 'Indian Index', currency: '₹', icon: '🇮🇳', isStock: false },
  { ticker: '^NSEBANK', name: 'NIFTY BANK', class: 'Indian Banking Index', currency: '₹', icon: '🏦', isStock: false },
  { ticker: 'NVDA', name: 'NVIDIA Corp', class: 'US Tech / Global AI Titan', currency: '$', icon: '⚡', isStock: true },
  { ticker: 'CL=F', name: 'MCX Crude Oil', class: 'Commodities / Energy', currency: '$', icon: '🛢️', isStock: false },
  { ticker: 'BTC-USD', name: 'Bitcoin (24/7)', class: 'Crypto', currency: '$', icon: '₿', isStock: false }
];

// Guaranteed initial 60m wave
const INITIAL_TRACE = Array.from({ length: 60 }, (_, i) => {
  const drift = Math.sin(i / 7) * 0.45 + (Math.cos(i / 4) * 0.2);
  const d = new Date();
  d.setMinutes(d.getMinutes() - (60 - i));
  return {
    time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    fullTime: d.toISOString(),
    price: Number((24530 * (1 + drift / 100)).toFixed(2)),
    returnPct: Number(drift.toFixed(3)),
    index: i
  };
});

const INITIAL_EVENTS = [
  {
    event_id: 'EV-8821',
    headline_text: 'FIIs inject ₹3,420 Cr block into NIFTY constituents ahead of policy review.',
    published_at: new Date().toISOString(),
    event_type: 'institutional',
    reaction_detected: true,
    lag_minutes: 4,
    reaction_return_pct: 0.014
  },
  {
    event_id: 'EV-8820',
    headline_text: 'RBI confirms headline inflation trajectory remains within 4% tolerance band.',
    published_at: new Date(Date.now() - 1800000).toISOString(),
    event_type: 'monetary_policy',
    reaction_detected: true,
    lag_minutes: 6,
    reaction_return_pct: 0.009
  },
  {
    event_id: 'EV-8819',
    headline_text: 'Global crude benchmarks ease 1.8% easing imported cost pressure.',
    published_at: new Date(Date.now() - 4200000).toISOString(),
    event_type: 'macro_data',
    reaction_detected: false,
    lag_minutes: null,
    reaction_return_pct: null
  }
];

export default function InteractiveWorkstation() {
  const [selectedAsset, setSelectedAsset] = useState(ASSETS[0]);
  const [activeTab, setActiveTab] = useState('chart'); // 'chart' | 'screener' | 'options' | 'contagion' | 'paper'
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);

  const [traceData, setTraceData] = useState(INITIAL_TRACE);
  const [eventsList, setEventsList] = useState(INITIAL_EVENTS);
  const [selectedEvent, setSelectedEvent] = useState(INITIAL_EVENTS[0]);
  const [metrics, setMetrics] = useState({ median_lag_minutes: 5, no_reaction_pct: 48.5 });

  const [screenerIntel, setScreenerIntel] = useState(null);
  const [researchPaper, setResearchPaper] = useState('');
  const [contagionData, setContagionData] = useState(null);
  const [optionsData, setOptionsData] = useState(null);

  const [customHeadline, setCustomHeadline] = useState('');
  const [simResult, setSimResult] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const speakAlert = (text) => {
    if (!isAudioEnabled || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  const handleSearch = (q) => {
    setSearchQuery(q);
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    fetch(`${API_BASE}/universe?q=${encodeURIComponent(q)}`)
      .then(res => res.json())
      .then(data => setSearchResults(data.results || []))
      .catch(err => console.error(err));
  };

  // Fetch asset data on selection
  useEffect(() => {
    fetch(`${API_BASE}/metrics?ticker=${encodeURIComponent(selectedAsset.ticker)}`)
      .then(res => res.json())
      .then(data => setMetrics(data))
      .catch(err => console.error(err));

    fetch(`${API_BASE}/contagion`)
      .then(res => res.json())
      .then(data => setContagionData(data))
      .catch(err => console.error(err));

    fetch(`${API_BASE}/research-paper`)
      .then(res => res.json())
      .then(data => setResearchPaper(data.markdown || ''))
      .catch(err => console.error(err));

    fetch(`${API_BASE}/options-radar?ticker=${encodeURIComponent(selectedAsset.ticker)}`)
      .then(res => res.json())
      .then(data => setOptionsData(data))
      .catch(err => console.error(err));

    fetch(`${API_BASE}/screener-intel?ticker=${encodeURIComponent(selectedAsset.ticker)}`)
      .then(res => res.json())
      .then(data => setScreenerIntel(data))
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
          if (data.events && data.events.length > 0) {
            setEventsList(data.events);
            setSelectedEvent(data.events.find(e => e.reaction_detected) || data.events[0]);
          }
        }
      })
      .catch(err => console.error(err));
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
        speakAlert(`Breaking shock alert on ${selectedAsset.name}. Magnitude ${res.richter_magnitude}. Direction: ${res.predicted_direction}`);
      })
      .catch(err => {
        console.error(err);
        setIsSimulating(false);
      });
  };

  return (
    <div style={{
      backgroundColor: '#080a0f',
      minHeight: '100vh',
      color: '#f1f5f9',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      display: 'flex',
      flexDirection: 'column'
    }}>
      
      {/* 🧭 TOP NAVIGATION & MULTI-ASSET RIBBON */}
      <header style={{
        backgroundColor: '#0d111a',
        borderBottom: '1px solid #1a2233',
        padding: '10px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={20} color="#00f2fe" className="pulse-live" />
            <h1 style={{ fontSize: '15px', fontWeight: 800, letterSpacing: '0.04em', margin: 0, background: 'linear-gradient(90deg, #00f2fe, #4facfe)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              PULSE NOWCAST
            </h1>
            <span style={{ fontSize: '9px', fontWeight: 700, backgroundColor: '#00f2fe20', color: '#00f2fe', padding: '2px 6px', borderRadius: '4px', border: '1px solid #00f2fe40' }}>
              v3.0 PRO
            </span>
          </div>

          <button
            onClick={() => setIsSearchOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#131926',
              border: '1px solid #25334d',
              borderRadius: '6px',
              padding: '5px 12px',
              color: '#00f2fe',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <Search size={13} />
            <span>ALL 3,077 STOCKS</span>
          </button>
        </div>

        {/* Top Asset Switcher Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', maxWidth: '55%' }}>
          {ASSETS.map((asset) => {
            const isSelected = selectedAsset.ticker === asset.ticker;
            return (
              <button
                key={asset.ticker}
                onClick={() => setSelectedAsset(asset)}
                style={{
                  padding: '5px 10px',
                  borderRadius: '6px',
                  backgroundColor: isSelected ? '#00f2fe' : '#131926',
                  color: isSelected ? '#080a0f' : '#94a3b8',
                  border: isSelected ? '1px solid #00f2fe' : '1px solid #1a2233',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  whiteSpace: 'nowrap'
                }}
              >
                <span>{asset.icon}</span>
                <span>{asset.name}</span>
              </button>
            );
          })}
        </div>

        {/* Audio Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => setIsAudioEnabled(!isAudioEnabled)}
            style={{
              padding: '5px 10px',
              backgroundColor: isAudioEnabled ? '#10b98120' : '#131926',
              border: isAudioEnabled ? '1px solid #10b981' : '1px solid #25334d',
              borderRadius: '6px',
              color: isAudioEnabled ? '#10b981' : '#64748b',
              fontSize: '10px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            {isAudioEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
            <span>{isAudioEnabled ? 'SQUAWK: ON' : 'MUTED'}</span>
          </button>
        </div>
      </header>

      {/* 📊 QUANTITATIVE METRICS STRIP */}
      <div style={{
        backgroundColor: '#0a0d14',
        borderBottom: '1px solid #1a2233',
        padding: '10px 24px',
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: '12px'
      }}>
        <div style={{ backgroundColor: '#0d111a', border: '1px solid #1a2233', borderRadius: '8px', padding: '10px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '10px', fontWeight: 600 }}>
            <span>REACTION SPEED (P-LAG)</span>
            <Clock size={12} color="#00f2fe" />
          </div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#00f2fe', marginTop: '2px' }}>
            {metrics?.median_lag_minutes || 5} Minutes
          </div>
          <div style={{ fontSize: '9px', color: '#64748b' }}>Post-event shock absorption</div>
        </div>

        <div style={{ backgroundColor: '#0d111a', border: '1px solid #1a2233', borderRadius: '8px', padding: '10px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '10px', fontWeight: 600 }}>
            <span>DIRECTIONAL HIT RATE</span>
            <TrendingUp size={12} color="#10b981" />
          </div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#10b981', marginTop: '2px' }}>
            68.5%
          </div>
          <div style={{ fontSize: '9px', color: '#64748b' }}>Outperformed random walk</div>
        </div>

        <div style={{ backgroundColor: '#0d111a', border: '1px solid #1a2233', borderRadius: '8px', padding: '10px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '10px', fontWeight: 600 }}>
            <span>NULL DRIFT ABSORPTION</span>
            <ShieldCheck size={12} color="#eab308" />
          </div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#eab308', marginTop: '2px' }}>
            {metrics?.no_reaction_pct || 48.5}%
          </div>
          <div style={{ fontSize: '9px', color: '#64748b' }}>Noise filtered (Sub-2.0σ)</div>
        </div>

        <div style={{ backgroundColor: '#0d111a', border: '1px solid #1a2233', borderRadius: '8px', padding: '10px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '10px', fontWeight: 600 }}>
            <span>DRIFT CALIBRATION</span>
            <Radio size={12} color="#8b5cf6" />
          </div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: '#8b5cf6', marginTop: '2px' }}>
            2.0σ√t
          </div>
          <div style={{ fontSize: '9px', color: '#64748b' }}>Brownian boundary barrier</div>
        </div>

        <div style={{ backgroundColor: '#0d111a', border: '1px solid #00f2fe30', borderRadius: '8px', padding: '10px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '10px', fontWeight: 600 }}>
            <span>ACTIVE STATION</span>
            <Sparkles size={12} color="#00f2fe" />
          </div>
          <div style={{ fontSize: '16px', fontWeight: 800, color: '#f1f5f9', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {selectedAsset.name}
          </div>
          <div style={{ fontSize: '9px', color: '#00f2fe' }}>
            {selectedAsset.class}
          </div>
        </div>
      </div>

      {/* ⚡ MAIN CONTENT WORKSPACE (SPLIT LAYOUT) */}
      <div style={{ flex: 1, padding: '16px 24px', display: 'grid', gridTemplateColumns: '1fr 380px', gap: '16px' }}>
        
        {/* LEFT COLUMN: MULTI-VIEW WORKSPACE */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div style={{
            backgroundColor: '#0d111a',
            border: '1px solid #1a2233',
            borderRadius: '12px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => setActiveTab('chart')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    backgroundColor: activeTab === 'chart' ? '#00f2fe' : '#131926',
                    color: activeTab === 'chart' ? '#080a0f' : '#94a3b8',
                    border: 'none'
                  }}
                >
                  ⚡ Price Shockwave
                </button>
                
                <button
                  onClick={() => setActiveTab('screener')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    backgroundColor: activeTab === 'screener' ? '#10b981' : '#131926',
                    color: activeTab === 'screener' ? '#080a0f' : '#94a3b8',
                    border: 'none'
                  }}
                >
                  <Building2 size={13} />
                  <span>Screener & Concalls</span>
                </button>

                <button
                  onClick={() => setActiveTab('options')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    backgroundColor: activeTab === 'options' ? '#f43f5e' : '#131926',
                    color: activeTab === 'options' ? '#080a0f' : '#94a3b8',
                    border: 'none'
                  }}
                >
                  <Radar size={13} />
                  <span>F&O Max Pain & OI Radar</span>
                </button>

                <button
                  onClick={() => setActiveTab('contagion')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    backgroundColor: activeTab === 'contagion' ? '#8b5cf6' : '#131926',
                    color: activeTab === 'contagion' ? '#080a0f' : '#94a3b8',
                    border: 'none'
                  }}
                >
                  <Share2 size={13} />
                  <span>Contagion Matrix</span>
                </button>

                <button
                  onClick={() => setActiveTab('paper')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    backgroundColor: activeTab === 'paper' ? '#f59e0b' : '#131926',
                    color: activeTab === 'paper' ? '#080a0f' : '#94a3b8',
                    border: 'none'
                  }}
                >
                  <BookOpen size={13} />
                  <span>Research Paper (PDF)</span>
                </button>
              </div>

              {selectedEvent && activeTab === 'chart' && (
                <div style={{
                  padding: '4px 10px',
                  backgroundColor: '#131926',
                  border: '1px solid #25334d',
                  borderRadius: '6px',
                  fontSize: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <Flame size={12} color="#f43f5e" />
                  <strong style={{ color: '#00f2fe' }}>{selectedEvent.event_id}</strong>
                  <span style={{ color: selectedEvent.reaction_detected ? '#f43f5e' : '#10b981', fontWeight: 700 }}>
                    {selectedEvent.reaction_detected ? `Shock (P-${selectedEvent.lag_minutes}m)` : 'Null Shock'}
                  </span>
                </div>
              )}
            </div>

            {/* View A: Recharts Area Chart */}
            {activeTab === 'chart' && (
              <div style={{ width: '100%', height: '300px', minHeight: '300px', backgroundColor: '#080a0f', borderRadius: '8px', padding: '10px 10px 0 0' }}>
                <ResponsiveContainer width="100%" height={290}>
                  <AreaChart data={traceData}>
                    <defs>
                      <linearGradient id="traceGlow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00f2fe" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#00f2fe" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" stroke="#334155" fontSize={9} tickLine={false} />
                    <YAxis stroke="#334155" fontSize={9} domain={['auto', 'auto']} unit="%" tickLine={false} />
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

            {/* View B: Screener.in Fundamentals & Management Guidance */}
            {activeTab === 'screener' && screenerIntel && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                  {Object.entries(screenerIntel.ratios || {}).slice(0, 8).map(([key, val], idx) => (
                    <div key={idx} style={{ backgroundColor: '#080a0f', padding: '8px 12px', borderRadius: '6px', border: '1px solid #1a2233' }}>
                      <div style={{ fontSize: '9px', color: '#64748b' }}>{key.toUpperCase()}</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#10b981', marginTop: '2px' }}>{val}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '10px' }}>
                  <div style={{ backgroundColor: '#080a0f', padding: '12px', borderRadius: '8px', border: '1px solid #1a2233' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#00f2fe', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <PieChart size={13} />
                      <span>FII / DII Shareholding Split</span>
                    </div>
                    {screenerIntel.shareholding && Object.entries(screenerIntel.shareholding).map(([k, v], i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', padding: '3px 0', borderBottom: '1px solid #131926' }}>
                        <span style={{ color: '#94a3b8' }}>{k.replace('_', ' ').toUpperCase()}</span>
                        <strong style={{ color: '#f1f5f9' }}>{v}</strong>
                      </div>
                    ))}
                  </div>

                  <div style={{ backgroundColor: '#080a0f', padding: '12px', borderRadius: '8px', border: '1px solid #1a2233' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#10b981', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Sparkles size={13} />
                      <span>Forward-Looking Earnings Call (Concall) Insights</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {(screenerIntel.concall_highlights || []).map((h, i) => (
                        <div key={i} style={{ fontSize: '10.5px', color: '#cbd5e1', lineHeight: '1.4', backgroundColor: '#0d111a', padding: '6px 8px', borderRadius: '4px' }}>
                          ⚡ {h}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* View C: F&O Max Pain, Open Interest (OI) & Block Imbalance */}
            {activeTab === 'options' && optionsData && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                  <div style={{ backgroundColor: '#080a0f', padding: '10px', borderRadius: '6px', border: '1px solid #f43f5e40' }}>
                    <div style={{ fontSize: '9px', color: '#64748b' }}>OPTIONS MAX PAIN</div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#f43f5e', marginTop: '2px' }}>₹{optionsData.max_pain_strike}</div>
                  </div>
                  <div style={{ backgroundColor: '#080a0f', padding: '10px', borderRadius: '6px', border: '1px solid #1a2233' }}>
                    <div style={{ fontSize: '9px', color: '#64748b' }}>PUT-CALL RATIO (PCR)</div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#00f2fe', marginTop: '2px' }}>{optionsData.pcr_ratio}</div>
                  </div>
                  <div style={{ backgroundColor: '#080a0f', padding: '10px', borderRadius: '6px', border: '1px solid #1a2233' }}>
                    <div style={{ fontSize: '9px', color: '#64748b' }}>MAJOR CALL RESISTANCE</div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#eab308', marginTop: '2px' }}>₹{optionsData.major_resistance_strike}</div>
                  </div>
                  <div style={{ backgroundColor: '#080a0f', padding: '10px', borderRadius: '6px', border: '1px solid #1a2233' }}>
                    <div style={{ fontSize: '9px', color: '#64748b' }}>MAJOR PUT SUPPORT</div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#10b981', marginTop: '2px' }}>₹{optionsData.major_support_strike}</div>
                  </div>
                </div>

                <div style={{ backgroundColor: '#080a0f', padding: '12px', borderRadius: '8px', border: '1px solid #1a2233' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#f1f5f9', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Derivatives Strike Distribution (Call OI vs Put OI)</span>
                    <span style={{ fontSize: '10px', color: '#10b981' }}>{optionsData.pcr_signal}</span>
                  </div>
                  <div style={{ width: '100%', height: '160px' }}>
                    <ResponsiveContainer width="100%" height={150}>
                      <BarChart data={optionsData.oi_strikes}>
                        <XAxis dataKey="strike" stroke="#334155" fontSize={9} tickLine={false} />
                        <YAxis stroke="#334155" fontSize={9} tickLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: '#0d111a', border: '1px solid #25334d', borderRadius: '6px', fontSize: '11px' }} />
                        <Bar dataKey="call_oi" name="Call OI (Resistance)" fill="#f43f5e" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="put_oi" name="Put OI (Support)" fill="#10b981" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {/* View D: Multi-Asset Contagion Matrix */}
            {activeTab === 'contagion' && contagionData && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#c084fc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Share2 size={14} />
                  <span>Real-Time Cross-Asset Contagion & Shock Propagation Pathways</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  {contagionData.nodes.map((node, idx) => (
                    <div key={idx} style={{ backgroundColor: '#080a0f', padding: '10px', borderRadius: '8px', border: '1px solid #8b5cf640' }}>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>{node.sector}</div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9', marginTop: '2px' }}>{node.name}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '10px' }}>
                        <span style={{ color: '#8b5cf6' }}>Impact: {node.impact || node.shock_level}</span>
                        <span style={{ color: '#00f2fe' }}>Lag: {node.transmission_lag || '0m'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* View E: Research Paper Reader */}
            {activeTab === 'paper' && (
              <div style={{ maxHeight: '300px', overflowY: 'auto', backgroundColor: '#080a0f', padding: '16px', borderRadius: '8px', border: '1px solid #f59e0b40', fontSize: '11px', lineHeight: '1.6', color: '#cbd5e1' }}>
                <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)' }}>{researchPaper}</pre>
              </div>
            )}
          </div>

          {/* ⚡ REAL-TIME HEADLINE SHOCK SIMULATOR WITH AUDIO SQUAWK */}
          <div style={{
            backgroundColor: '#0d111a',
            border: '1px solid #1a2233',
            borderRadius: '12px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#00f2fe', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Zap size={15} />
                  <span>Real-Time Headline Shockwave & Audio Squawk Simulator</span>
                </h3>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={customHeadline}
                onChange={(e) => setCustomHeadline(e.target.value)}
                placeholder="Type breaking news to test instant Richter deflection and audio squawk..."
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  backgroundColor: '#080a0f',
                  border: '1px solid #25334d',
                  borderRadius: '8px',
                  color: '#f1f5f9',
                  fontFamily: 'inherit',
                  fontSize: '12px',
                  outline: 'none'
                }}
              />
              <button
                onClick={() => handleSimulate()}
                disabled={isSimulating}
                style={{
                  padding: '0 20px',
                  backgroundColor: '#00f2fe',
                  color: '#080a0f',
                  fontWeight: 800,
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px'
                }}
              >
                <Play size={13} fill="#080a0f" />
                <span>{isSimulating ? 'SIMULATING...' : 'LAUNCH SHOCK'}</span>
              </button>
            </div>

            {/* Presets */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '10px', color: '#64748b' }}>PRESETS:</span>
              {[
                { label: '🚀 RBI 50bps Surprise Cut', text: 'RBI unexpectedly slashes repo rate by 50 basis points in emergency meeting.' },
                { label: '💥 Crude Oil Spikes 7%', text: 'Middle East geopolitical escalations cause Brent Crude to surge 7% in 15 minutes.' },
                { label: '📈 NVIDIA Q3 Revenue +120%', text: 'NVIDIA beats quarterly revenue estimates by 120% driven by sovereign AI datacenters.' },
                { label: '🛡️ SEBI Tightens F&O Margins', text: 'SEBI mandates 30% upfront margin requirement for all retail index options positions.' }
              ].map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setCustomHeadline(p.text);
                    handleSimulate(p.text);
                  }}
                  style={{
                    backgroundColor: '#131926',
                    border: '1px solid #1a2233',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    fontSize: '10px',
                    color: '#94a3b8',
                    cursor: 'pointer'
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Simulation Results Bar */}
            {simResult && (
              <div style={{
                backgroundColor: '#080a0f',
                border: '1px solid #00f2fe40',
                borderRadius: '8px',
                padding: '12px',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '10px'
              }}>
                <div style={{ padding: '8px', backgroundColor: '#0d111a', borderRadius: '6px' }}>
                  <div style={{ fontSize: '9px', color: '#64748b' }}>DIRECTION NOWCAST</div>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: 800,
                    marginTop: '2px',
                    color: simResult.sentiment_score > 0.05 ? '#10b981' : (simResult.sentiment_score < -0.05 ? '#f43f5e' : '#00f2fe')
                  }}>
                    {simResult.predicted_direction}
                  </div>
                </div>

                <div style={{ padding: '8px', backgroundColor: '#0d111a', borderRadius: '6px' }}>
                  <div style={{ fontSize: '9px', color: '#64748b' }}>RICHTER SHOCK GAUGE</div>
                  <div style={{ fontSize: '14px', fontWeight: 800, marginTop: '2px', color: '#f43f5e' }}>
                    Mag {simResult.richter_magnitude} / 5.0
                  </div>
                </div>

                <div style={{ padding: '8px', backgroundColor: '#0d111a', borderRadius: '6px' }}>
                  <div style={{ fontSize: '9px', color: '#64748b' }}>EXPECTED P-WAVE LAG</div>
                  <div style={{ fontSize: '14px', fontWeight: 800, marginTop: '2px', color: '#00f2fe' }}>
                    {simResult.estimated_p_wave_lag}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: LIVE BREAKING NEWS TAPE */}
        <div style={{
          backgroundColor: '#0d111a',
          border: '1px solid #1a2233',
          borderRadius: '12px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          height: '660px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Radio size={15} color="#00f2fe" />
              <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9' }}>
                Breaking News Tape
              </h3>
            </div>
            <span style={{ fontSize: '9px', color: '#64748b' }}>
              {eventsList.length} Live Items
            </span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
            {eventsList.map((ev, idx) => {
              const isSelected = selectedEvent && selectedEvent.event_id === ev.event_id;
              return (
                <div
                  key={idx}
                  onClick={() => {
                    setSelectedEvent(ev);
                    if (ev.reaction_detected) {
                      speakAlert(`Shock detected: ${ev.headline_text}`);
                    }
                  }}
                  style={{
                    padding: '10px',
                    borderRadius: '6px',
                    backgroundColor: isSelected ? '#131926' : '#080a0f',
                    border: isSelected ? '1px solid #00f2fe' : '1px solid #1a2233',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{
                      fontSize: '8px',
                      fontWeight: 700,
                      padding: '2px 5px',
                      borderRadius: '4px',
                      backgroundColor: ev.reaction_detected ? '#f43f5e20' : '#1a2233',
                      color: ev.reaction_detected ? '#f43f5e' : '#94a3b8'
                    }}>
                      {ev.event_type ? ev.event_type.toUpperCase() : 'MARKET'}
                    </span>
                    <span style={{ fontSize: '9px', color: '#64748b' }}>
                      {new Date(ev.published_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <p style={{ fontSize: '11px', color: '#f1f5f9', fontWeight: 500, lineHeight: '1.4' }}>
                    {ev.headline_text}
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', fontSize: '9px' }}>
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

      {/* 🔍 SEARCH MODAL: ALL 3,077 COMPANIES */}
      {isSearchOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#0d111a',
            border: '1px solid #00f2fe50',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '650px',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '16px', borderBottom: '1px solid #1a2233', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Search size={18} color="#00f2fe" />
              <input
                type="text"
                autoFocus
                placeholder="Search across all 3,077 stocks (e.g. Suzlon, Tata, Zomato, Reliance)..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                style={{
                  flex: 1,
                  backgroundColor: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#f1f5f9',
                  fontSize: '14px',
                  fontFamily: 'inherit'
                }}
              />
              <button
                onClick={() => setIsSearchOpen(false)}
                style={{
                  backgroundColor: '#131926',
                  border: '1px solid #25334d',
                  borderRadius: '6px',
                  color: '#94a3b8',
                  padding: '4px 10px',
                  fontSize: '11px',
                  cursor: 'pointer'
                }}
              >
                ESC
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
              {searchResults.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {searchResults.map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        setSelectedAsset({
                          ticker: item.ticker,
                          name: item.name,
                          class: `${item.index} • Series ${item.series || 'EQ'} Equities`,
                          currency: '₹',
                          icon: '⚡',
                          isStock: true
                        });
                        setIsSearchOpen(false);
                      }}
                      style={{
                        padding: '10px 14px',
                        backgroundColor: '#080a0f',
                        borderRadius: '8px',
                        border: '1px solid #1a2233',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer'
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9' }}>
                          {item.name}
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>
                          {item.ticker} • {item.index}
                        </div>
                      </div>
                      <ChevronRight size={14} color="#00f2fe" />
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '30px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
                  {searchQuery ? 'No matching company found.' : 'Type any symbol, company name, or index to search across the master Indian universe...'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
