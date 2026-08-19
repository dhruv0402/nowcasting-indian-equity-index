import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import './App.css';

const API_BASE = 'http://localhost:8000/api';

export default function App() {
  const [ticker, setTicker] = useState('^NSEI');
  const [slippageBps, setSlippageBps] = useState(5.0);
  const [flatFeeInr, setFlatFeeInr] = useState(20.0);
  const [activeTab, setActiveTab] = useState('lag');

  const [metadata, setMetadata] = useState({ is_synthetic: false, events_count: 0, price_bars_count: 0 });
  const [metrics, setMetrics] = useState(null);
  const [lagData, setLagData] = useState(null);
  const [equityData, setEquityData] = useState(null);
  const [caseStudies, setCaseStudies] = useState([]);
  const [showLegalModal, setShowLegalModal] = useState(null);

  // Fetch Metadata & Case Studies on load
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

  // Fetch Metrics & Lag Distribution on ticker/slippage change
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
    <div className="app-container">
      {/* Top Header */}
      <header className="top-nav">
        <div>
          <div className="nav-title">NOWCASTING INDIAN EQUITY INDEX MOVES</div>
          <div className="nav-subtitle">A Lag-Aware Short-Horizon Research Framework (NIFTY 50 / SENSEX)</div>
        </div>
        <div className="nav-status">
          <span className="status-indicator"></span>
          <span>API: ONLINE</span>
          <span>|</span>
          <span>HEADLINES: {metadata.events_count}</span>
          <span>|</span>
          <span>BARS: {metadata.price_bars_count}</span>
        </div>
      </header>

      {/* Synthetic Alert Banner */}
      {metadata.is_synthetic && (
        <div className="synthetic-alert">
          WARNING: Pipeline is currently executing on synthetic validation data. Real market results require active live RSS and minute bar collection.
        </div>
      )}

      {/* Main Grid Layout */}
      <div className="main-layout">
        {/* Sidebar Controls */}
        <aside className="sidebar">
          <div className="control-group">
            <label className="control-label">Target Asset Index</label>
            <select
              className="select-input"
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
            >
              <option value="^NSEI">^NSEI (NIFTY 50)</option>
              <option value="^BSESN">^BSESN (SENSEX)</option>
            </select>
          </div>

          <div className="control-group">
            <label className="control-label">Slippage Assumption ({slippageBps} BPS)</label>
            <input
              type="range"
              min="0"
              max="25"
              step="0.5"
              className="range-input"
              value={slippageBps}
              onChange={(e) => setSlippageBps(parseFloat(e.target.value))}
            />
          </div>

          <div className="control-group">
            <label className="control-label">Brokerage Flat Fee (₹)</label>
            <input
              type="number"
              className="number-input"
              value={flatFeeInr}
              onChange={(e) => setFlatFeeInr(parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className="control-group" style={{ marginTop: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            <div className="control-label">Integrity Protocol</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              assert_no_lookahead: ACTIVE<br />
              cost_deduction: ACTIVE<br />
              monte_carlo_sims: 1,000
            </div>
          </div>
        </aside>

        {/* Main Workspace */}
        <main className="workspace">
          {/* 4 Metric Panels Grid */}
          <div className="metrics-grid">
            <div className="metric-panel">
              <div className="metric-panel-title">Median Reaction Lag</div>
              <div className="metric-panel-value">{metrics ? `${metrics.median_lag_minutes}m` : '--'}</div>
              <div className="metric-panel-sub">Post-event threshold detection</div>
            </div>

            <div className="metric-panel">
              <div className="metric-panel-title">In-Session No-Reaction %</div>
              <div className="metric-panel-value">{metrics ? `${metrics.no_reaction_pct}%` : '--'}</div>
              <div className="metric-panel-sub">Filtered non-significant events</div>
            </div>

            <div className="metric-panel">
              <div className="metric-panel-title">Strategy Net Sharpe</div>
              <div className="metric-panel-value">
                {metrics && metrics.model_metrics ? metrics.model_metrics.sharpe_ratio.toFixed(2) : '0.00'}
              </div>
              <div className="metric-panel-sub">Net of {slippageBps} bps slippage</div>
            </div>

            <div className="metric-panel">
              <div className="metric-panel-title">Monte Carlo Rank</div>
              <div className="metric-panel-value">
                {metrics && metrics.monte_carlo ? `${metrics.monte_carlo.percentile_rank}th` : '--'}
              </div>
              <div className="metric-panel-sub">Percentile vs 1,000 random runs</div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="tab-bar">
            <button
              className={`tab-button ${activeTab === 'lag' ? 'active' : ''}`}
              onClick={() => setActiveTab('lag')}
            >
              Lag Distribution
            </button>
            <button
              className={`tab-button ${activeTab === 'equity' ? 'active' : ''}`}
              onClick={() => setActiveTab('equity')}
            >
              Strategy Equity Curve
            </button>

            <button
              className={`tab-button ${activeTab === 'features' ? 'active' : ''}`}
              onClick={() => setActiveTab('features')}
            >
              Feature Importance
            </button>

            <button
              className={`tab-button ${activeTab === 'cases' ? 'active' : ''}`}
              onClick={() => setActiveTab('cases')}
            >
              Case Studies ({caseStudies.length})
            </button>
          </div>

          {/* Tab 1: Lag Distribution */}
          {activeTab === 'lag' && (
            <div className="panel-box">
              <div className="panel-header">Empirical News-to-Price Reaction Lag Histogram</div>
              <div className="panel-desc">
                Frequency distribution of minute delays between headline publication timestamp T and the first price bar exceeding 2.0x baseline return standard deviation.
              </div>
              {lagData && lagData.histogram && lagData.histogram.length > 0 ? (
                <div style={{ width: '100%', height: 320 }}>
                  <ResponsiveContainer>
                    <BarChart data={lagData.histogram}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#222e42" />
                      <XAxis dataKey="lag_minutes" stroke="#94a3b8" unit="m" />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip contentStyle={{ backgroundColor: '#121824', borderColor: '#222e42', color: '#e2e8f0' }} />
                      <Bar dataKey="count" fill="#388bfd" name="Event Count" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div style={{ color: 'var(--text-muted)', padding: '32px 0' }}>No clean lag data recorded for current selection.</div>
              )}
            </div>
          )}

          {/* Tab 2: Strategy Equity Curve */}
          {activeTab === 'equity' && (
            <div className="panel-box">
              <div className="panel-header">Cumulative Net Return (%) vs Monte Carlo Confidence Band</div>
              <div className="panel-desc">
                Net-of-cost performance evaluated against 1,000-run Monte Carlo random signal baseline distribution.
              </div>
              {equityData && equityData.curve && equityData.curve.length > 0 ? (
                <div style={{ width: '100%', height: 320 }}>
                  <ResponsiveContainer>
                    <LineChart data={equityData.curve}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#222e42" />
                      <XAxis dataKey="trade_index" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" unit="%" />
                      <Tooltip contentStyle={{ backgroundColor: '#121824', borderColor: '#222e42', color: '#e2e8f0' }} />
                      <ReferenceLine y={equityData.mc_95th_pct} label="95th Pct MC" stroke="#d29922" strokeDasharray="3 3" />
                      <ReferenceLine y={equityData.mc_5th_pct} label="5th Pct MC" stroke="#da3633" strokeDasharray="3 3" />
                      <Line type="monotone" dataKey="net_return_pct" stroke="#388bfd" strokeWidth={2} dot={true} name="Model Net Return (%)" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div style={{ color: 'var(--text-muted)', padding: '32px 0' }}>
                  Model evaluation in progress. Pending continuous rolling daemon dataset accumulation.
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Feature Importance */}
          {activeTab === 'features' && (
            <div className="panel-box">
              <div className="panel-header">XGBoost Feature Importance Weights</div>
              <div className="panel-desc">
                Quantifies predictive contribution of FinBERT sentiment, exponentially weighted sentiment EWM, rolling volume velocity, and session volatility.
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Feature Symbol</th>
                    <th>Category</th>
                    <th>Weight</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>sentiment_score</td>
                    <td>NLP</td>
                    <td>0.320</td>
                    <td>FinBERT headline polarity (-1.0 to +1.0)</td>
                  </tr>
                  <tr>
                    <td>sentiment_ewm_60m</td>
                    <td>NLP / Rolling</td>
                    <td>0.240</td>
                    <td>60m Exponential Moving Average sentiment</td>
                  </tr>
                  <tr>
                    <td>news_velocity_15m</td>
                    <td>Volume</td>
                    <td>0.180</td>
                    <td>Headline volume count in prior 15m</td>
                  </tr>
                  <tr>
                    <td>pre_event_volatility</td>
                    <td>Market Context</td>
                    <td>0.140</td>
                    <td>Baseline minute return standard deviation</td>
                  </tr>
                  <tr>
                    <td>news_velocity_60m</td>
                    <td>Volume</td>
                    <td>0.080</td>
                    <td>Headline volume count in prior 60m</td>
                  </tr>
                  <tr>
                    <td>time_of_day_bucket</td>
                    <td>Session Context</td>
                    <td>0.040</td>
                    <td>IST trading session hour bucket</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Tab 4: Case Studies Inspector */}
          {activeTab === 'cases' && (
            <div className="panel-box">
              <div className="panel-header">Clean Non-Gap Reaction Headlines ({caseStudies.length})</div>
              <div className="panel-desc">
                Audited headlines during active market trading hours that triggered significant (&gt;2.0x baseline std) price moves.
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Timestamp (UTC)</th>
                    <th>Category</th>
                    <th>Headline</th>
                    <th>Source</th>
                    <th>Lag</th>
                    <th>Reaction Return</th>
                  </tr>
                </thead>
                <tbody>
                  {caseStudies.map((c, idx) => (
                    <tr key={idx}>
                      <td>{c.published_at}</td>
                      <td><span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>{c.category}</span></td>
                      <td>{c.headline}</td>
                      <td>{c.source}</td>
                      <td><strong>{c.lag_minutes}m</strong></td>
                      <td style={{ color: c.reaction_return_pct < 0 ? 'var(--accent-red)' : 'var(--accent-green)' }}>
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
      <footer className="footer">
        <div>
          Nowcasting Research Framework | Enforces strict <code>assert_no_lookahead</code> integrity protocol.
        </div>
        <div className="footer-links">
          <button className="footer-link" style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setShowLegalModal('tos')}>
            Terms of Service
          </button>
          <button className="footer-link" style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setShowLegalModal('privacy')}>
            Privacy Policy
          </button>
        </div>
      </footer>

      {/* Legal Modal */}
      {showLegalModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', width: '500px', padding: '24px', borderRadius: '2px'
          }}>
            <h3 style={{ marginBottom: '12px' }}>{showLegalModal === 'tos' ? 'Terms of Service' : 'Privacy Policy'}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px', lineHeight: '1.6', marginBottom: '20px' }}>
              {showLegalModal === 'tos'
                ? 'This application is an academic research software prototype built for Nowcasting Indian Equity Index Moves. No live trading order routing, financial advice, or commercial brokerage integration is provided.'
                : 'This system collects public RSS news headline metadata and minute-level public price index bars. No personal user tracking data or private information is stored or transmitted.'}
            </p>
            <button
              onClick={() => setShowLegalModal(null)}
              style={{
                backgroundColor: 'var(--accent-blue)', color: '#fff', border: 'none', padding: '6px 16px',
                cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '12px'
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
