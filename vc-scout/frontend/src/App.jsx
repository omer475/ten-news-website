import { useState, useEffect, useCallback } from 'react'
import './App.css'

const API = 'http://localhost:8000/api'

function App() {
  const [tab, setTab] = useState('dashboard')
  const [stats, setStats] = useState(null)
  const [sources, setSources] = useState([])
  const [topics, setTopics] = useState([])
  const [companies, setCompanies] = useState([])
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState(null)
  const [newSource, setNewSource] = useState({ name: '', url: '' })
  const [newTopic, setNewTopic] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showNewOnly, setShowNewOnly] = useState(false)
  const [error, setError] = useState('')

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API}/dashboard`)
      if (res.ok) setStats(await res.json())
    } catch { /* ignore */ }
  }, [])

  const fetchSources = useCallback(async () => {
    try {
      const res = await fetch(`${API}/sources`)
      if (res.ok) setSources(await res.json())
    } catch { /* ignore */ }
  }, [])

  const fetchTopics = useCallback(async () => {
    try {
      const res = await fetch(`${API}/topics`)
      if (res.ok) setTopics(await res.json())
    } catch { /* ignore */ }
  }, [])

  const fetchCompanies = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (showNewOnly) params.set('new_only', 'true')
      if (searchQuery) params.set('search', searchQuery)
      const res = await fetch(`${API}/companies?${params}`)
      if (res.ok) setCompanies(await res.json())
    } catch { /* ignore */ }
  }, [showNewOnly, searchQuery])

  useEffect(() => {
    fetchStats()
    fetchSources()
    fetchTopics()
    fetchCompanies()
  }, [fetchStats, fetchSources, fetchTopics, fetchCompanies])

  useEffect(() => {
    fetchCompanies()
  }, [showNewOnly, searchQuery, fetchCompanies])

  // ── Actions ──

  const addSource = async (e) => {
    e.preventDefault()
    setError('')
    if (!newSource.name || !newSource.url) return
    try {
      const res = await fetch(`${API}/sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSource),
      })
      if (res.ok) {
        setNewSource({ name: '', url: '' })
        fetchSources()
        fetchStats()
      } else {
        const data = await res.json()
        setError(data.detail || 'Failed to add source')
      }
    } catch { setError('Connection failed') }
  }

  const deleteSource = async (id) => {
    await fetch(`${API}/sources/${id}`, { method: 'DELETE' })
    fetchSources()
    fetchStats()
  }

  const toggleSource = async (id) => {
    await fetch(`${API}/sources/${id}/toggle`, { method: 'PATCH' })
    fetchSources()
  }

  const addTopic = async (e) => {
    e.preventDefault()
    setError('')
    if (!newTopic) return
    try {
      const res = await fetch(`${API}/topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTopic }),
      })
      if (res.ok) {
        setNewTopic('')
        fetchTopics()
        fetchStats()
      } else {
        const data = await res.json()
        setError(data.detail || 'Failed to add topic')
      }
    } catch { setError('Connection failed') }
  }

  const deleteTopic = async (id) => {
    await fetch(`${API}/topics/${id}`, { method: 'DELETE' })
    fetchTopics()
    fetchStats()
  }

  const toggleTopic = async (id) => {
    await fetch(`${API}/topics/${id}/toggle`, { method: 'PATCH' })
    fetchTopics()
  }

  const seedTopics = async () => {
    await fetch(`${API}/seed`, { method: 'POST' })
    fetchTopics()
    fetchStats()
  }

  const runScan = async () => {
    setScanning(true)
    setScanResult(null)
    setError('')
    try {
      const res = await fetch(`${API}/scan`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setScanResult(data)
        fetchCompanies()
        fetchStats()
        fetchSources()
        setTab('results')
      } else {
        const data = await res.json()
        setError(data.detail || 'Scan failed')
      }
    } catch {
      setError('Connection failed. Is the backend running?')
    }
    setScanning(false)
  }

  const markSeen = async (id) => {
    await fetch(`${API}/companies/${id}/mark-seen`, { method: 'PATCH' })
    fetchCompanies()
    fetchStats()
  }

  const markAllSeen = async () => {
    await fetch(`${API}/companies/mark-all-seen`, { method: 'PATCH' })
    fetchCompanies()
    fetchStats()
  }

  const deleteCompany = async (id) => {
    await fetch(`${API}/companies/${id}`, { method: 'DELETE' })
    fetchCompanies()
    fetchStats()
  }

  const exportExcel = () => {
    const params = new URLSearchParams()
    if (showNewOnly) params.set('new_only', 'true')
    window.open(`${API}/export/excel?${params}`, '_blank')
  }

  // ── Render ──

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <h1>VC Scout</h1>
          <span className="subtitle">Startup Discovery Platform</span>
        </div>
        <button
          className={`scan-btn ${scanning ? 'scanning' : ''}`}
          onClick={runScan}
          disabled={scanning}
        >
          {scanning ? 'Scanning...' : 'Scan Now'}
        </button>
      </header>

      {error && (
        <div className="error-bar">
          {error}
          <button onClick={() => setError('')}>x</button>
        </div>
      )}

      <nav className="tabs">
        {['dashboard', 'sources', 'topics', 'results'].map((t) => (
          <button
            key={t}
            className={`tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'dashboard' && 'Dashboard'}
            {t === 'sources' && 'Sources'}
            {t === 'topics' && 'Topics'}
            {t === 'results' && `Companies${stats?.new_companies ? ` (${stats.new_companies} new)` : ''}`}
          </button>
        ))}
      </nav>

      <main className="content">
        {/* ── Dashboard ── */}
        {tab === 'dashboard' && (
          <div className="dashboard">
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">{stats?.total_companies || 0}</div>
                <div className="stat-label">Total Companies</div>
              </div>
              <div className="stat-card highlight">
                <div className="stat-value">{stats?.new_companies || 0}</div>
                <div className="stat-label">New Companies</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats?.total_sources || 0}</div>
                <div className="stat-label">Sources</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats?.active_topics || 0}</div>
                <div className="stat-label">Active Topics</div>
              </div>
            </div>

            {stats?.last_scan && (
              <p className="last-scan">
                Last scan: {new Date(stats.last_scan).toLocaleString()}
              </p>
            )}

            <div className="quick-actions">
              <h3>Quick Start</h3>
              <ol>
                <li>Add source URLs in the <strong>Sources</strong> tab</li>
                <li>Select topics to filter in the <strong>Topics</strong> tab</li>
                <li>Click <strong>Scan Now</strong> to discover new companies</li>
                <li>View results and export to Excel</li>
              </ol>
            </div>

            {scanResult && (
              <div className="scan-summary">
                <h3>Last Scan Results</h3>
                <p>Sources scanned: {scanResult.sources_scanned}</p>
                <p>New companies found: {scanResult.new_companies_found}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Sources ── */}
        {tab === 'sources' && (
          <div className="sources-panel">
            <h2>Manage Sources</h2>
            <p className="section-desc">
              Add URLs of startup directories and listing sites to scan.
            </p>

            <form className="add-form" onSubmit={addSource}>
              <input
                type="text"
                placeholder="Source name (e.g. Startups.watch)"
                value={newSource.name}
                onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
              />
              <input
                type="url"
                placeholder="https://example.com/startups"
                value={newSource.url}
                onChange={(e) => setNewSource({ ...newSource, url: e.target.value })}
              />
              <button type="submit">Add Source</button>
            </form>

            <div className="list">
              {sources.length === 0 && (
                <p className="empty">No sources added yet. Add a URL above to get started.</p>
              )}
              {sources.map((s) => (
                <div key={s.id} className={`list-item ${!s.is_active ? 'inactive' : ''}`}>
                  <div className="item-info">
                    <strong>{s.name}</strong>
                    <a href={s.url} target="_blank" rel="noopener noreferrer">{s.url}</a>
                    {s.last_scraped_at && (
                      <small>Last scraped: {new Date(s.last_scraped_at).toLocaleString()}</small>
                    )}
                  </div>
                  <div className="item-actions">
                    <button
                      className={`toggle-btn ${s.is_active ? 'on' : 'off'}`}
                      onClick={() => toggleSource(s.id)}
                    >
                      {s.is_active ? 'Active' : 'Inactive'}
                    </button>
                    <button className="delete-btn" onClick={() => deleteSource(s.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Topics ── */}
        {tab === 'topics' && (
          <div className="topics-panel">
            <h2>Filter Topics</h2>
            <p className="section-desc">
              Select which industries/topics to scan for. Only companies matching active topics will be shown.
              If no topics are active, all companies will be included.
            </p>

            <div className="topic-actions-row">
              <form className="add-form inline" onSubmit={addTopic}>
                <input
                  type="text"
                  placeholder="Add a topic (e.g. Fintech, AI)"
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                />
                <button type="submit">Add</button>
              </form>
              <button className="seed-btn" onClick={seedTopics}>
                Load Default Topics
              </button>
            </div>

            <div className="topics-grid">
              {topics.length === 0 && (
                <p className="empty">No topics yet. Add topics or load defaults above.</p>
              )}
              {topics.map((t) => (
                <div
                  key={t.id}
                  className={`topic-chip ${t.is_active ? 'active' : 'inactive'}`}
                  onClick={() => toggleTopic(t.id)}
                >
                  <span>{t.name}</span>
                  <button
                    className="chip-delete"
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteTopic(t.id)
                    }}
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Results ── */}
        {tab === 'results' && (
          <div className="results-panel">
            <div className="results-header">
              <h2>Discovered Companies</h2>
              <div className="results-controls">
                <input
                  type="text"
                  placeholder="Search companies..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={showNewOnly}
                    onChange={(e) => setShowNewOnly(e.target.checked)}
                  />
                  New only
                </label>
                <button className="export-btn" onClick={exportExcel}>
                  Export Excel
                </button>
                <button className="mark-all-btn" onClick={markAllSeen}>
                  Mark All Seen
                </button>
              </div>
            </div>

            <div className="companies-list">
              {companies.length === 0 && (
                <p className="empty">
                  No companies found. Run a scan to discover new companies.
                </p>
              )}
              {companies.map((c) => (
                <div key={c.id} className={`company-card ${c.is_new ? 'new' : ''}`}>
                  <div className="company-header">
                    <h3>
                      {c.is_new && <span className="new-badge">NEW</span>}
                      {c.name}
                    </h3>
                    <div className="company-actions">
                      {c.is_new && (
                        <button className="seen-btn" onClick={() => markSeen(c.id)}>
                          Mark Seen
                        </button>
                      )}
                      <button className="delete-btn small" onClick={() => deleteCompany(c.id)}>
                        Remove
                      </button>
                    </div>
                  </div>
                  {c.description && <p className="company-desc">{c.description}</p>}
                  <div className="company-meta">
                    {c.industry && <span className="meta-tag">{c.industry}</span>}
                    {c.location && <span className="meta-item">Location: {c.location}</span>}
                    {c.funding_stage && <span className="meta-item">Stage: {c.funding_stage}</span>}
                    {c.funding_amount && <span className="meta-item">Funding: {c.funding_amount}</span>}
                    {c.website && (
                      <a href={c.website} target="_blank" rel="noopener noreferrer" className="meta-link">
                        Website
                      </a>
                    )}
                    {c.source_name && (
                      <span className="meta-source">via {c.source_name}</span>
                    )}
                  </div>
                  <small className="discovered-date">
                    Discovered: {new Date(c.discovered_at).toLocaleDateString()}
                  </small>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
