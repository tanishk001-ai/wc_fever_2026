import { useState, useCallback } from 'react'
import MatchPredictor from './components/MatchPredictor.jsx'
import XGHeatmap from './components/XGHeatmap.jsx'
import GroupTracker from './components/GroupTracker.jsx'
import KnockoutBracket from './components/KnockoutBracket.jsx'

export default function App() {
  const [active, setActive]               = useState('predict')
  const [isTrackerLive, setIsTrackerLive] = useState(false)

  const handleLiveChange = useCallback((live) => {
    setIsTrackerLive(live)
  }, [])

  const TABS = [
    { id: 'predict',  label: 'PREDICT',  component: <MatchPredictor /> },
    { id: 'xg',       label: 'XG MAP',   component: <XGHeatmap /> },
    { id: 'tracker',  label: 'GROUPS',   component: <GroupTracker onLiveChange={handleLiveChange} /> },
    { id: 'bracket',  label: 'BRACKET',  component: <KnockoutBracket /> },
  ]

  return (
    <div className="min-h-full flex flex-col" style={{ backgroundColor: '#0d0d0d' }}>

      {/* ── Header ── */}
      <header
        className="flex-shrink-0 sticky top-0 z-50"
        style={{ backgroundColor: '#0d0d0d', borderBottom: '1px solid #1f1f1f' }}
      >
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between" style={{ height: '52px' }}>

          {/* Brand */}
          <div className="flex items-center gap-3">
            <span className="text-white font-black text-base tracking-tight leading-none">WC FEVER</span>
            <span className="font-black text-base tracking-tight leading-none" style={{ color: '#00ff87' }}>2026</span>
            <span className="text-xs font-medium hidden sm:inline" style={{ color: '#525252' }}>· ANALYTICS</span>
          </div>

          {/* Tabs */}
          <nav className="flex items-stretch" style={{ height: '52px' }}>
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setActive(t.id)}
                className="flex items-center gap-2 px-5 transition-colors duration-150"
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  height: '52px',
                  color: active === t.id ? '#ffffff' : '#525252',
                  borderBottom: active === t.id ? '2px solid #00ff87' : '2px solid transparent',
                }}
                onMouseEnter={e => { if (active !== t.id) e.currentTarget.style.color = '#a3a3a3' }}
                onMouseLeave={e => { if (active !== t.id) e.currentTarget.style.color = '#525252' }}
              >
                {t.label}
                {t.id === 'tracker' && isTrackerLive && (
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: '#00ff87' }} />
                    <span className="font-bold" style={{ fontSize: '9px', color: '#00ff87', letterSpacing: '0.1em' }}>LIVE</span>
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-6">
        {TABS.map(t => (
          <div key={t.id} className={`fade-in ${t.id === active ? 'block' : 'hidden'}`}>
            {t.component}
          </div>
        ))}
      </main>

      {/* ── Footer ── */}
      <footer className="flex-shrink-0 mt-4" style={{ borderTop: '1px solid #1f1f1f' }}>
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <span style={{ fontSize: '10px', color: '#404040', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            WC Fever 2026 · StatsBomb Open Data
          </span>
          <span style={{ fontSize: '10px', color: '#404040', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            XGBoost · Flask · React
          </span>
        </div>
      </footer>

    </div>
  )
}
