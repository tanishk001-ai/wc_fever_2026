/**
 * Module 3 – Group Stage Tracker
 * Round 2 visual redesign: #0d0d0d / #161616 / #00ff87 color system.
 * All data logic, state, API calls, and polling are unchanged.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import API_BASE from '../config.js'

// ── Design tokens ─────────────────────────────────────────────────────────────
const GREEN  = '#00ff87'
const RED    = '#ff3b3b'
const AMBER  = '#f59e0b'
const WHITE  = '#ffffff'
const ZN400  = '#a3a3a3'
const ZN500  = '#737373'
const ZN600  = '#525252'
const ZN800  = '#262626'
const SURF   = '#161616'
const ELEV   = '#1e1e1e'

const POLL_INTERVAL_MS  = 5 * 60 * 1000
const LIVE_THRESHOLD_MS = 5 * 60 * 1000

// ── Helpers (unchanged) ───────────────────────────────────────────────────────

function timeSince(isoString) {
  if (!isoString) return null
  const diff = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins === 1) return '1 min ago'
  return `${mins} mins ago`
}

function isDataFresh(isoString) {
  if (!isoString) return false
  return Date.now() - new Date(isoString).getTime() < LIVE_THRESHOLD_MS
}

// ── Advancement % color ───────────────────────────────────────────────────────
function advColor(pct) {
  if (pct >= 60) return GREEN
  if (pct >= 30) return AMBER
  return RED
}

// ── GroupCard — real league table widget ─────────────────────────────────────

function GroupCard({ group, generatedAt }) {
  const { group: name, teams } = group

  return (
    <div style={{ backgroundColor: SURF, border: `1px solid ${ZN800}`, borderRadius: 2, overflow: 'hidden' }}>

      {/* Card header */}
      <div
        className="flex items-center justify-between"
        style={{ backgroundColor: ELEV, borderBottom: `1px solid ${ZN800}`, padding: '8px 12px' }}
      >
        <div className="flex items-center gap-2">
          {/* Red accent bar */}
          <div style={{ width: 3, height: 14, backgroundColor: RED, flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.14em', color: WHITE }}>
            {name}
          </span>
        </div>
        <span style={{ fontSize: 9, color: ZN600, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
          {generatedAt ? `Updated ${timeSince(generatedAt)}` : 'Loading…'}
        </span>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table className="w-full">

          {/* Column headers */}
          <thead>
            <tr style={{ borderBottom: `1px solid ${ZN800}` }}>
              {/* Left bar spacer */}
              <th style={{ width: 3, padding: 0 }} />
              <th style={{ padding: '7px 12px', textAlign: 'left', fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: ZN600, minWidth: 110 }}>Team</th>
              <th style={{ padding: '7px 8px', textAlign: 'center', fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: ZN600, width: 28 }}>MP</th>
              <th style={{ padding: '7px 8px', textAlign: 'center', fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: ZN600, width: 28 }}>W</th>
              <th style={{ padding: '7px 8px', textAlign: 'center', fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: ZN600, width: 28 }}>D</th>
              <th style={{ padding: '7px 8px', textAlign: 'center', fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: ZN600, width: 28 }}>L</th>
              <th style={{ padding: '7px 8px', textAlign: 'center', fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: ZN600, width: 36 }}>GD</th>
              <th style={{ padding: '7px 8px', textAlign: 'center', fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: ZN600, width: 32 }}>PTS</th>
              <th style={{ padding: '7px 12px', textAlign: 'center', fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: ZN600, minWidth: 60 }}>ADV%</th>
            </tr>
          </thead>

          <tbody>
            {teams.map((team, idx) => {
              const isAdvancing = idx < 2
              const advPct      = Math.round((team.advancement_prob ?? 0) * 100)

              // Left edge: green for advancing, very dark for not
              const edgeColor = isAdvancing ? GREEN : ZN800

              // Row bg: alternating
              const rowBg = idx % 2 === 0 ? SURF : '#191919'

              return (
                <tr
                  key={team.name}
                  style={{
                    backgroundColor: rowBg,
                    borderBottom: `1px solid rgba(38,38,38,0.6)`,
                  }}
                >
                  {/* Left advancement bar */}
                  <td style={{ padding: 0, width: 3, backgroundColor: edgeColor }} />

                  {/* Team name */}
                  <td style={{ padding: '8px 12px' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: isAdvancing ? WHITE : ZN500 }}>
                      {team.name}
                    </span>
                  </td>

                  {/* MP */}
                  <td style={{ padding: '8px', textAlign: 'center', fontSize: 11, color: ZN500, fontVariantNumeric: 'tabular-nums' }}>
                    {team.played}
                  </td>

                  {/* W */}
                  <td style={{ padding: '8px', textAlign: 'center', fontSize: 11, color: ZN400, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                    {team.won}
                  </td>

                  {/* D */}
                  <td style={{ padding: '8px', textAlign: 'center', fontSize: 11, color: ZN500, fontVariantNumeric: 'tabular-nums' }}>
                    {team.draw}
                  </td>

                  {/* L */}
                  <td style={{ padding: '8px', textAlign: 'center', fontSize: 11, color: ZN500, fontVariantNumeric: 'tabular-nums' }}>
                    {team.lost}
                  </td>

                  {/* GD */}
                  <td style={{
                    padding: '8px',
                    textAlign: 'center',
                    fontSize: 11,
                    fontVariantNumeric: 'tabular-nums',
                    fontWeight: 700,
                    color: team.goal_diff > 0 ? GREEN : team.goal_diff < 0 ? RED : ZN500,
                  }}>
                    {team.goal_diff > 0 ? `+${team.goal_diff}` : team.goal_diff}
                  </td>

                  {/* Points — most prominent */}
                  <td style={{ padding: '8px', textAlign: 'center' }}>
                    <span style={{ fontSize: 14, fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: isAdvancing ? WHITE : ZN500 }}>
                      {team.points}
                    </span>
                  </td>

                  {/* ADV% — colored number only, no bar */}
                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: advColor(advPct) }}>
                      {advPct}%
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Legend row */}
      <div
        className="flex items-center gap-2"
        style={{ padding: '7px 12px', borderTop: `1px solid rgba(38,38,38,0.6)`, backgroundColor: ELEV }}
      >
        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: GREEN, opacity: 0.8, flexShrink: 0 }} />
        <span style={{ fontSize: 9, color: ZN600, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 500 }}>
          Top 2 advance · Monte Carlo {(10000).toLocaleString()} sims
        </span>
      </div>
    </div>
  )
}

/** Skeleton card while loading */
function SkeletonCard() {
  return (
    <div
      className="animate-pulse"
      style={{ backgroundColor: SURF, border: `1px solid ${ZN800}`, borderRadius: 2, overflow: 'hidden' }}
    >
      <div style={{ backgroundColor: ELEV, padding: '8px 12px', borderBottom: `1px solid ${ZN800}` }}>
        <div style={{ height: 11, width: 64, backgroundColor: ZN800, borderRadius: 2 }} />
      </div>
      <div style={{ padding: 12 }} className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <div style={{ height: 10, width: 96, backgroundColor: ZN800, borderRadius: 2 }} />
            <div style={{ height: 10, flex: 1, backgroundColor: ZN800, borderRadius: 2 }} />
            <div style={{ height: 10, width: 32, backgroundColor: ZN800, borderRadius: 2 }} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function GroupTracker({ onLiveChange }) {
  const [groups, setGroups]           = useState([])
  const [generatedAt, setGeneratedAt] = useState(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)
  const timerRef                      = useRef(null)

  const fetchStandings = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/standings`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setGroups(data.groups ?? [])
      setGeneratedAt(data.generated_at ?? new Date().toISOString())
      setError(null)
      onLiveChange?.(true)
    } catch (err) {
      setError(err.message)
      onLiveChange?.(false)
    } finally {
      setLoading(false)
    }
  }, [onLiveChange])

  useEffect(() => {
    fetchStandings()
    timerRef.current = setInterval(fetchStandings, POLL_INTERVAL_MS)
    return () => clearInterval(timerRef.current)
  }, [fetchStandings])

  useEffect(() => {
    const id = setInterval(() => {
      onLiveChange?.(isDataFresh(generatedAt))
    }, 30_000)
    return () => clearInterval(id)
  }, [generatedAt, onLiveChange])

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* Section header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div style={{ width: 3, height: 24, backgroundColor: RED, flexShrink: 0 }} />
          <div>
            <h2 className="text-xl font-black tracking-tight uppercase leading-none" style={{ color: WHITE }}>
              Group Stage Tracker
            </h2>
            <p style={{ fontSize: 9, color: ZN500, textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: 2, fontWeight: 600 }}>
              Standings + Monte Carlo advancement · auto-refreshes every 5 min
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {generatedAt && (
            <span
              style={{ fontSize: 9, color: ZN600, textTransform: 'uppercase', letterSpacing: '0.1em', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}
              className="hidden sm:block"
            >
              {timeSince(generatedAt)}
            </span>
          )}
          <button
            onClick={fetchStandings}
            disabled={loading}
            style={{
              padding: '6px 12px',
              fontSize: 9,
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              borderRadius: 2,
              border: `1px solid ${ZN800}`,
              backgroundColor: 'transparent',
              color: loading ? ZN600 : ZN400,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.4 : 1,
              transition: 'color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => { if (!loading) { e.currentTarget.style.color = WHITE; e.currentTarget.style.borderColor = RED } }}
            onMouseLeave={e => { if (!loading) { e.currentTarget.style.color = ZN400; e.currentTarget.style.borderColor = ZN800 } }}
          >
            {loading ? 'LOADING…' : '↻ REFRESH'}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div
          style={{
            borderRadius: 2,
            border: `1px solid rgba(255,59,59,0.3)`,
            backgroundColor: 'rgba(255,59,59,0.08)',
            padding: '10px 14px',
            fontSize: 13,
            color: RED,
            fontWeight: 500,
          }}
        >
          Backend unreachable: <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{error}</span>
        </div>
      )}

      {/* Group cards grid */}
      {loading && groups.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : groups.length === 0 ? (
        <div
          style={{ backgroundColor: SURF, border: `1px solid ${ZN800}`, borderRadius: 2, padding: 40, textAlign: 'center', fontSize: 14, color: ZN500 }}
        >
          No group data available.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {groups.map((group) => (
            <GroupCard
              key={group.group}
              group={group}
              generatedAt={generatedAt}
            />
          ))}
        </div>
      )}

      {/* Footer note */}
      <p style={{ fontSize: 9, color: ZN600, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 500 }}>
        Advancement = fraction of 10,000 simulated group completions finishing top 2 · powered by XGBoost
      </p>

    </div>
  )
}
