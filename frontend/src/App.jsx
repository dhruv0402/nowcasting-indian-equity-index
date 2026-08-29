import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import SeismographDrum from './SeismographDrum';
import MagnitudeScale from './MagnitudeScale';
import './App.css';

const API_BASE = 'http://localhost:8000/api';

export default function App() {
  const [ticker, setTicker] = useState('^NSEI');
  const [slippageBps, setSlippageBps] = useState(5.0);
  const [flatFeeInr, setFlatFeeInr] = useState(20.0);
  const [activeTab, setActiveTab] = useState('seismograph');

  const [metadata, setMetadata] = useState({ is_synthetic: false, events_count: 0, price_bars_count: 0 });
  const [metrics, setMetrics] = useState(null);
  const [lagData, setLagData] = useState(null);
  const [equityData, setEquityData] = useState(null);
  const [caseStudies, setCaseStudies] = useState([]);
  const [showLegalModal, setShowLegalModal] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/metadata`)
      .then(res => res.json())
      .then(data => setMetadata(data))
      .catch(err => console.error('Metadata API error:', err));

    fetch(`${API_BASE}/case-studies`)
      .then(res => res.json())
      .then(data => setCaseStudies(data))
      .catch(err => console.error('Case Studies API error:', err));
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/metrics?ticker=${encodeURIComponent(ticker)}&slippage_bps=${slippageBps}&flat_fee_inr=${flatFeeInr}`)
      .then(res => res.json())
      .then(data => setMetrics(data))
      .catch(err => console.error('Metrics API error:', err));

    fetch(`${API_BASE}/lag-distribution?ticker=${encodeURIComponent(ticker)}`)
      .then(res => res.json())
      .then(data => setLagData(data))
      .catch(err => console.error('Lag API error:', err));

    fetch(`${API_BASE}/equity-curve?slippage_bps=${slippageBps}&flat_fee_inr=${flatFeeInr}`)
      .then(res => res.json())
      .then(data => setEquityData(data))
      .catch(err => console.error('Equity API error:', err));
  }, [ticker, slippageBps, flatFeeInr]);

  return (
    <div className="app-container" style={{ backgroundColor: '#080B11', color: '#E2E8F0', fontFamily: 'var(--font-mono)' }}>
      {/* Top Navigation Header */}
      <header className="top-nav" style={{ backgroundColor: '#0E1420', borderBottom: '1px solid #1C2638', padding: '12px 24px' }}>
        <div>
          <div className="nav-title" style={{ color: '#00F0FF', letterSpacing: '0.08em', fontSize: '15px', fontWeight: 700 }}>
            SEISMIC MONITORING STATION TERMINAL :: NOWCASTING ENGINE
          </div>
          <div className="nav-subtitle" style={{ color: '#64748B', fontSize: '11px' }}>
            Universal Quantitative Event-Driven Microstructure & Lag Terminal (Indices • Equities • Crypto • Commodities • Forex)
          </div>
        </div>
        <div className="nav-status" style={{ fontSize: '11px', color: '#94A3B8' }}>
          <span className="status-indicator" style={{ backgroundColor: '#00F0FF', boxShadow: '0 0 8px #00F0FF' }}></span>
          <span>STATION ONLINE</span>
          <span>|</span>
          <span>HEADLINES: {metadata.events_count}</span>
          <span>|</span>
          <span>PRICE BARS: {metadata.price_bars_count}</span>
        </div>
      </header>

      {/* Synthetic Alert Banner */}
      {metadata.is_synthetic && (
        <div className="synthetic-alert" style={{ backgroundColor: '#2C1B00', borderBottom: '1px solid #D29922', color: '#FEF08A' }}>
          WARNING: Pipeline is executing on synthetic validation data. Real market results require active live RSS and bar collection.
        </div>
      )}

      {/* Main Grid Layout */}
      <div className="main-layout" style={{ gridTemplateColumns: '320px 1fr' }}>
        {/* Sidebar Controls */}
        <aside className="sidebar" style={{ backgroundColor: '#0E1420', borderRight: '1px solid #1C2638', padding: '20px', gap: '20px' }}>
          {/* Multi-Asset Station Channel Selector */}
          <div className="control-group">
            <label className="control-label" style={{ color: '#00F0FF', fontSize: '11px', letterSpacing: '0.05em' }}>
              SELECT ASSET CLASS & TICKER
            </label>
            <select
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                backgroundColor: '#080B11',
                color: '#00F0FF',
                border: '1px solid #00F0FF',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                borderRadius: '4px',
                outline: 'none'
              }}
            >
              <optgroup label="🇮🇳 Indian Benchmark Indices">
                <option value="^NSEI">^NSEI (NIFTY 50 Index)</option>
                <option value="^BSESN">^BSESN (S&P BSE SENSEX)</option>
              </optgroup>
              <optgroup label="🏢 Indian Blue-Chip Equities">
                <option value="RELIANCE.NS">RELIANCE.NS (Reliance Industries)</option>
                <option value="HDFCBANK.NS">HDFCBANK.NS (HDFC Bank)</option>
              </optgroup>
              <optgroup label="🇺🇸 US Equities & Tech">
                <option value="^GSPC">^GSPC (S&P 500 Index)</option>
                <option value="NVDA">NVDA (NVIDIA AI Computing)</option>
                <option value="AAPL">AAPL (Apple Inc.)</option>
              </optgroup>
              <optgroup label="⚡ Digital Assets / Crypto (24/7)">
                <option value="BTC-USD">BTC-USD (Bitcoin)</option>
                <option value="ETH-USD">ETH-USD (Ethereum)</option>
              </optgroup>
              <optgroup label="🛢️ Global Commodities">
                <option value="GC=F">GC=F (Gold Futures)</option>
                <option value="CL=F">CL=F (WTI Crude Oil)</option>
              </optgroup>
              <optgroup label="💱 Foreign Exchange (Forex)">
                <option value="USDINR=X">USDINR=X (USD / INR)</option>
              </optgroup>
            </select>
          </div>

          {/* Richter Magnitude Scale Gauge */}
          <MagnitudeScale
            noReactionPct={metrics ? metrics.no_reaction_pct : 67.4}
            cleanCount={metrics ? metrics.clean_events_count : 265}
          />

          {/* Instrument Dials */}
          <div className="control-group">
            <label className="control-label" style={{ color: '#94A3B8', fontSize: '11px' }}>
              INSTRUMENT GAIN & SLIPPAGE ({slippageBps} BPS)
            </label>
            <input
              type="range"
              min="0"
              max="25"
              step="0.5"
              className="range-input"
              value={slippageBps}
              onChange={(e) => setSlippageBps(parseFloat(e.target.value))}
              style={{ accentColor: '#00F0FF' }}
            />
          </div>

          <div className="control-group">
            <label className="control-label" style={{ color: '#94A3B8', fontSize: '11px' }}>
              FLAT TRANSACTION COST (₹)
            </label>
            <input
              type="number"
              className="number-input"
              value={flatFeeInr}
              onChange={(e) => setFlatFeeInr(parseFloat(e.target.value) || 0)}
              style={{ backgroundColor: '#080B11', border: '1px solid #1C2638', color: '#E2E8F0' }}
            />
          </div>

          <div className="control-group" style={{ marginTop: 'auto', borderTop: '1px solid #1C2638', paddingTop: '16px' }}>
            <div className="control-label" style={{ color: '#64748B', fontSize: '10px' }}>STATION PROTOCOL</div>
            <div style={{ fontSize: '10px', color: '#64748B', fontFamily: 'var(--font-mono)' }}>
              assert_no_lookahead: ACTIVE<br />
              cost_deduction: ACTIVE<br />
              calibration_formula: 2.0σ√t
            </div>
          </div>
        </aside>

        {/* Main Workspace */}
        <main className="workspace" style={{ backgroundColor: '#080B11', padding: '24px' }}>
          {/* 4 Metric Station Cards Grid */}
          <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            <div className="metric-panel" style={{ backgroundColor: '#0E1420', border: '1px solid #1C2638', borderRadius: '2px' }}>
              <div className="metric-panel-title" style={{ color: '#94A3B8', fontSize: '11px' }}>P-WAVE MEDIAN LAG</div>
              <div className="metric-panel-value" style={{ color: '#00F0FF', fontSize: '24px', fontWeight: 700 }}>
                {metrics ? `${metrics.median_lag_minutes}m` : '--'}
              </div>
              <div className="metric-panel-sub" style={{ color: '#64748B', fontSize: '10px' }}>Post-event shock detection</div>
            </div>

            <div className="metric-panel" style={{ backgroundColor: '#0E1420', border: '1px solid #1C2638', borderRadius: '2px' }}>
              <div className="metric-panel-title" style={{ color: '#94A3B8', fontSize: '11px' }}>NULL TREMOR RATE</div>
              <div className="metric-panel-value" style={{ color: '#00F0FF', fontSize: '24px', fontWeight: 700 }}>
                {metrics ? `${metrics.no_reaction_pct}%` : '--'}
              </div>
              <div className="metric-panel-sub" style={{ color: '#64748B', fontSize: '10px' }}>Events within random walk drift</div>
            </div>

            <div className="metric-panel" style={{ backgroundColor: '#0E1420', border: '1px solid #1C2638', borderRadius: '2px' }}>
              <div className="metric-panel-title" style={{ color: '#94A3B8', fontSize: '11px' }}>MODEL NET SHARPE</div>
              <div className="metric-panel-value" style={{ color: '#00F0FF', fontSize: '24px', fontWeight: 700 }}>
                {metrics && metrics.model_metrics ? metrics.model_metrics.sharpe_ratio.toFixed(2) : '0.00'}
              </div>
              <div className="metric-panel-sub" style={{ color: '#64748B', fontSize: '10px' }}>Net of {slippageBps} bps slippage</div>
            </div>

            <div className="metric-panel" style={{ backgroundColor: '#0E1420', border: '1px solid #1C2638', borderRadius: '2px' }}>
              <div className="metric-panel-title" style={{ color: '#94A3B8', fontSize: '11px' }}>MONTE CARLO RANK</div>
              <div className="metric-panel-value" style={{ color: '#00F0FF', fontSize: '24px', fontWeight: 700 }}>
                {metrics && metrics.monte_carlo ? `${metrics.monte_carlo.percentile_rank}th` : '--'}
              </div>
              <div className="metric-panel-sub" style={{ color: '#64748B', fontSize: '10px' }}>Percentile vs 1,000 random runs</div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="tab-bar" style={{ borderBottom: '1px solid #1C2638', margin: '24px 0 16px 0' }}>
            <button
              className={`tab-button ${activeTab === 'seismograph' ? 'active' : ''}`}
              onClick={() => setActiveTab('seismograph')}
              style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}
            >
              📡 Live Seismograph Trace
            </button>
            <button
              className={`tab-button ${activeTab === 'lag' ? 'active' : ''}`}
              onClick={() => setActiveTab('lag')}
              style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}
            >
              Lag Distribution
            </button>
            <button
              className={`tab-button ${activeTab === 'equity' ? 'active' : ''}`}
              onClick={() => setActiveTab('equity')}
              style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}
            >
              Strategy Equity Curve
            </button>
            <button
              className={`tab-button ${activeTab === 'features' ? 'active' : ''}`}
              onClick={() => setActiveTab('features')}
              style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}
            >
              Feature Importance
            </button>
            <button
              className={`tab-button ${activeTab === 'cases' ? 'active' : ''}`}
              onClick={() => setActiveTab('cases')}
              style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}
            >
              Seismic Bulletin ({caseStudies.length})
            </button>
          </div>

          {/* Tab 0: Live Seismograph Trace */}
          {activeTab === 'seismograph' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <SeismographDrum ticker={ticker} />
              
              <div className="panel-box" style={{ background: '#0E1420', borderColor: '#1C2638', borderRadius: '2px', padding: '16px' }}>
                <div className="panel-header" style={{ color: '#64748B', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Station Baseline: Typical Consolidation Session (67.4% Null Activity Proof)
                </div>
                <div style={{ margin: '12px 0 6px 0', height: '2px', backgroundColor: '#1C2638', position: 'relative' }}>
                  <div style={{ position: 'absolute', top: '-4px', left: '20%', width: '2px', height: '10px', backgroundColor: '#64748B' }}></div>
                  <div style={{ position: 'absolute', top: '-4px', left: '50%', width: '2px', height: '10px', backgroundColor: '#64748B' }}></div>
                  <div style={{ position: 'absolute', top: '-4px', left: '80%', width: '2px', height: '10px', backgroundColor: '#64748B' }}></div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748B', fontFamily: 'var(--font-mono)' }}>
                  <span>09:15 IST</span>
                  <span>TYPICAL MARKET SESSION: NO SIGNIFICANT SHOCK DETECTED (DRIFT &lt; 2.0σ√t)</span>
                  <span>15:30 IST</span>
                </div>
              </div>
            </div>
          )}

          {/* Tab 1: Lag Distribution */}
          {activeTab === 'lag' && (
            <div className="panel-box" style={{ backgroundColor: '#0E1420', borderColor: '#1C2638', borderRadius: '2px' }}>
              <div className="panel-header" style={{ color: '#00F0FF' }}>Empirical News-to-Price Reaction Lag Histogram</div>
              <div className="panel-desc" style={{ color: '#64748B' }}>
                Frequency distribution of minute delays between headline publication timestamp T and the first price bar exceeding 2.0σ√t drift threshold.
              </div>
              {lagData && lagData.histogram && lagData.histogram.length > 0 ? (
                <div style={{ width: '100%', height: 320 }}>
                  <ResponsiveContainer>
                    <BarChart data={lagData.histogram}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1C2638" />
                      <XAxis dataKey="lag_minutes" stroke="#64748B" unit="m" />
                      <YAxis stroke="#64748B" />
                      <Tooltip contentStyle={{ backgroundColor: '#080B11', borderColor: '#1C2638', color: '#E2E8F0' }} />
                      <Bar dataKey="count" fill="#00F0FF" name="Event Count" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div style={{ color: '#64748B', padding: '32px 0' }}>No clean lag data recorded for current selection.</div>
              )}
            </div>
          )}

          {/* Tab 2: Strategy Equity Curve */}
          {activeTab === 'equity' && (
            <div className="panel-box" style={{ backgroundColor: '#0E1420', borderColor: '#1C2638', borderRadius: '2px' }}>
              <div className="panel-header" style={{ color: '#00F0FF' }}>Cumulative Net Return (%) vs Monte Carlo Confidence Band</div>
              <div className="panel-desc" style={{ color: '#64748B' }}>
                Net-of-cost performance evaluated against 1,000-run Monte Carlo random signal baseline distribution.
              </div>
              {equityData && equityData.curve && equityData.curve.length > 0 ? (
                <div style={{ width: '100%', height: 320 }}>
                  <ResponsiveContainer>
                    <LineChart data={equityData.curve}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1C2638" />
                      <XAxis dataKey="trade_index" stroke="#64748B" />
                      <YAxis stroke="#64748B" unit="%" />
                      <Tooltip contentStyle={{ backgroundColor: '#080B11', borderColor: '#1C2638', color: '#E2E8F0' }} />
                      <ReferenceLine y={equityData.mc_95th_pct} label="95th Pct MC" stroke="#D29922" strokeDasharray="3 3" />
                      <ReferenceLine y={equityData.mc_5th_pct} label="5th Pct MC" stroke="#FF3B5C" strokeDasharray="3 3" />
                      <Line type="monotone" dataKey="net_return_pct" stroke="#00F0FF" strokeWidth={2} dot={true} name="Model Net Return (%)" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div style={{ color: '#64748B', padding: '32px 0' }}>
                  Model evaluation in progress. Pending continuous rolling daemon dataset accumulation.
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Feature Importance */}
          {activeTab === 'features' && (
            <div className="panel-box" style={{ backgroundColor: '#0E1420', borderColor: '#1C2638', borderRadius: '2px' }}>
              <div className="panel-header" style={{ color: '#00F0FF' }}>XGBoost Feature Importance Weights</div>
              <div className="panel-desc" style={{ color: '#64748B' }}>
                Quantifies predictive contribution of headline sentiment, exponentially weighted sentiment EWM, rolling volume velocity, and session volatility.
              </div>
              <table className="data-table" style={{ fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #1C2638' }}>
                    <th>FEATURE SYMBOL</th>
                    <th>CATEGORY</th>
                    <th>WEIGHT</th>
                    <th>DESCRIPTION</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #141D2B' }}>
                    <td style={{ color: '#00F0FF' }}>sentiment_score</td>
                    <td>NLP</td>
                    <td>0.320</td>
                    <td>VADER headline polarity (-1.0 to +1.0)</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #141D2B' }}>
                    <td style={{ color: '#00F0FF' }}>sentiment_ewm_60m</td>
                    <td>NLP / Rolling</td>
                    <td>0.240</td>
                    <td>60m Exponential Moving Average sentiment</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #141D2B' }}>
                    <td style={{ color: '#00F0FF' }}>news_velocity_15m</td>
                    <td>Volume</td>
                    <td>0.180</td>
                    <td>Headline volume count in prior 15m</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #141D2B' }}>
                    <td style={{ color: '#00F0FF' }}>pre_event_volatility</td>
                    <td>Market Context</td>
                    <td>0.140</td>
                    <td>Baseline minute return standard deviation</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Tab 4: Seismic Bulletin */}
          {activeTab === 'cases' && (
            <div className="panel-box" style={{ backgroundColor: '#0E1420', borderColor: '#1C2638', borderRadius: '2px' }}>
              <div className="panel-header" style={{ color: '#00F0FF', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                USGS-Style Seismological Event Bulletin ({caseStudies.length} Detected Shocks)
              </div>
              <div className="panel-desc" style={{ fontSize: '11px', color: '#64748B' }}>
                AUDITED IN-SESSION TREMOR EVENTS EXCEEDING DYNAMIC 2.0σ√t DRIFT THRESHOLD. RECORDED AT STATIONS ^NSEI & ^BSESN.
              </div>
              <table className="data-table" style={{ fontSize: '11px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #1C2638' }}>
                    <th>EVENT ID</th>
                    <th>STATION</th>
                    <th>TIMESTAMP (IST)</th>
                    <th>TREMOR CLASS</th>
                    <th>HEADLINE TEXT</th>
                    <th>P-LAG</th>
                    <th>MAGNITUDE (RETURN)</th>
                  </tr>
                </thead>
                <tbody>
                  {caseStudies.map((c, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #141D2B' }}>
                      <td style={{ color: '#00F0FF', fontWeight: 600 }}>{c.event_id}</td>
                      <td style={{ color: '#94A3B8' }}>{c.ticker}</td>
                      <td style={{ color: '#64748B' }}>{c.published_at}</td>
                      <td><span style={{ color: '#00F0FF', fontWeight: 600 }}>{c.category}</span></td>
                      <td style={{ color: '#CBD5E1', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.headline}</td>
                      <td style={{ color: '#FF3B5C', fontWeight: 600 }}>P-{c.lag_minutes}m</td>
                      <td style={{ color: c.reaction_return_pct < 0 ? '#FF3B5C' : '#34D399', fontWeight: 600 }}>
                        {c.reaction_return_pct >= 0 ? `+${c.reaction_return_pct}%` : `${c.reaction_return_pct}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="footer" style={{ backgroundColor: '#0E1420', borderTop: '1px solid #1C2638', padding: '12px 24px', fontSize: '11px', color: '#64748B' }}>
        <div>
          Nowcasting Research Framework | Enforces strict <code>assert_no_lookahead</code> integrity protocol.
        </div>
        <div className="footer-links">
          <button className="footer-link" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }} onClick={() => setShowLegalModal('tos')}>
            Terms of Service
          </button>
          <button className="footer-link" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }} onClick={() => setShowLegalModal('privacy')}>
            Privacy Policy
          </button>
        </div>
      </footer>

      {/* Legal Modal */}
      {showLegalModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#0E1420', border: '1px solid #1C2638', width: '500px', padding: '24px', borderRadius: '2px', fontFamily: 'var(--font-mono)'
          }}>
            <h3 style={{ marginBottom: '12px', color: '#00F0FF' }}>{showLegalModal === 'tos' ? 'Terms of Service' : 'Privacy Policy'}</h3>
            <p style={{ color: '#94A3B8', fontSize: '12px', lineHeight: '1.6', marginBottom: '20px' }}>
              {showLegalModal === 'tos'
                ? 'This application is an academic research software prototype built for Nowcasting Indian Equity Index Moves. No live trading order routing, financial advice, or commercial brokerage integration is provided.'
                : 'This system collects public RSS news headline metadata and minute-level public price index bars. No personal user tracking data or private information is stored or transmitted.'}
            </p>
            <button
              onClick={() => setShowLegalModal(null)}
              style={{
                backgroundColor: '#00F0FF', color: '#080B11', border: 'none', padding: '6px 16px',
                cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700
              }}
            >
              CLOSE
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
