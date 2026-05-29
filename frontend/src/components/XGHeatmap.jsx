/**
 * Module 2 — xG Shot Map
 * Round 2 visual redesign: #0d0d0d / #161616 / #00ff87 / #ff3b3b system.
 * All data logic, API calls, state, and hooks are unchanged.
 */

import { useState, useEffect, useRef } from 'react'
import API_BASE from '../config.js'

// ── Design tokens (inline hex, no Tailwind color classes) ────────────────────
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

// ── Outcome colour palette ────────────────────────────────────────────────────
const OUTCOME_COLOR = {
  Goal:    GREEN,   // electric green
  Saved:   AMBER,   // amber
  'Off T': RED,     // red
  Blocked: '#71717a', // zinc-500
  Wayward: RED,
}

const OUTCOME_LABEL = {
  Goal:             'Goal',
  Saved:            'Saved',
  'Off T':          'Off T',
  'Off Target':     'Off T',
  Blocked:          'Blocked',
  Wayward:          'Wayward',
  'Post':           'Off T',
  'Saved Off Post': 'Saved',
}

function normaliseOutcome(raw) {
  return OUTCOME_LABEL[raw] ?? raw
}

function outcomeColor(outcome) {
  return OUTCOME_COLOR[normaliseOutcome(outcome)] ?? '#71717a'
}

// ── Pitch geometry ─────────────────────────────────────────────────────────────
const W = 600
const H = 400

const toSvg = (x, y) => ({ cx: (x - 60) * 10, cy: y * 5 })

const P = {
  penX:     (102 - 60) * 10,
  penY1:    18 * 5,
  penY2:    62 * 5,
  sixX:     (114 - 60) * 10,
  sixY1:    30 * 5,
  sixY2:    50 * 5,
  penSpotX: (108 - 60) * 10,
  penSpotY: 40 * 5,
  goalY1:   36.34 * 5,
  goalY2:   43.66 * 5,
}

const shotRadius = (xg) => 3 + xg * 7

// ── Pitch SVG ─────────────────────────────────────────────────────────────────
function Pitch({ shots, onHover }) {
  return (
    <g>
      {/* Grass base */}
      <rect x={0} y={0} width={W} height={H} fill="#0a1f0a" />

      {/* Mowing stripes — alternating very subtle shades */}
      {Array.from({ length: 6 }).map((_, i) => (
        <rect key={i} x={i * 100} y={0} width={100} height={H}
          fill={i % 2 === 0 ? '#0a1f0a' : '#0d230d'} />
      ))}

      {/* Pitch outline */}
      <rect x={1} y={1} width={W - 2} height={H - 2}
        fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={1.5} />

      {/* Left edge (halfway line) */}
      <line x1={0} y1={0} x2={0} y2={H}
        stroke="rgba(255,255,255,0.5)" strokeWidth={1.5} />

      {/* Penalty area */}
      <rect x={P.penX} y={P.penY1}
        width={W - P.penX} height={P.penY2 - P.penY1}
        fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={1.5} />

      {/* Six-yard box */}
      <rect x={P.sixX} y={P.sixY1}
        width={W - P.sixX} height={P.sixY2 - P.sixY1}
        fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1.2} />

      {/* Penalty arc */}
      <path
        d={`M ${P.penX} ${H / 2 - 48} A 75 75 0 0 0 ${P.penX} ${H / 2 + 48}`}
        fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1.2}
      />

      {/* Penalty spot */}
      <circle cx={P.penSpotX} cy={P.penSpotY} r={3}
        fill="rgba(255,255,255,0.5)" />

      {/* Corner arcs */}
      <path d={`M 10 0 A 10 10 0 0 1 0 10`}
        fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1.2} />
      <path d={`M ${W - 10} 0 A 10 10 0 0 0 ${W} 10`}
        fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1.2} />
      <path d={`M 10 ${H} A 10 10 0 0 0 0 ${H - 10}`}
        fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1.2} />
      <path d={`M ${W - 10} ${H} A 10 10 0 0 1 ${W} ${H - 10}`}
        fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1.2} />

      {/* Goal mouth */}
      <rect x={W} y={P.goalY1} width={14} height={P.goalY2 - P.goalY1}
        fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.7)" strokeWidth={1.5} />

      {/* Shot circles */}
      {shots.map((shot) => {
        const { cx, cy } = toSvg(shot.x, shot.y)
        const color      = outcomeColor(shot.outcome)
        const r          = shotRadius(shot.xg)
        const isGoal     = shot.outcome === 'Goal'

        return (
          <g
            key={shot.id}
            onMouseEnter={() => onHover(shot)}
            onMouseLeave={() => onHover(null)}
            style={{ cursor: 'pointer' }}
          >
            {/* Outer glow ring for goals */}
            {isGoal && (
              <circle cx={cx} cy={cy} r={r + 5}
                fill="none" stroke={GREEN} strokeWidth={1.5} opacity={0.4} />
            )}
            <circle
              cx={cx} cy={cy} r={r}
              fill={color}
              opacity={0.55 + shot.xg * 0.45}
              stroke="rgba(0,0,0,0.45)"
              strokeWidth={0.5}
            />
          </g>
        )
      })}
    </g>
  )
}

// ── Compact section label ─────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div style={{ width: 3, height: 14, backgroundColor: RED, flexShrink: 0 }} />
      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: ZN400 }}>
        {children}
      </span>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function XGHeatmap() {
  const [teams, setTeams]           = useState([])
  const [selectedTeam, setSelected] = useState('France')
  const [shotData, setShotData]     = useState(null)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)
  const [hovered, setHovered]       = useState(null)
  const [mousePos, setMousePos]     = useState({ x: 0, y: 0 })
  const [sortBy, setSortBy]         = useState('minute')
  const svgWrapRef = useRef(null)

  useEffect(() => {
    fetch(`${API_BASE}/api/xg/teams`)
      .then(r => r.json())
      .then(d => { if (d.teams?.length) setTeams(d.teams) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedTeam) return
    setLoading(true)
    setError(null)
    setShotData(null)
    setHovered(null)

    fetch(`${API_BASE}/api/xg/shots?team=${encodeURIComponent(selectedTeam)}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error)
        setShotData(d)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [selectedTeam])

  const shots       = shotData?.shots   ?? []
  const summary     = shotData?.summary ?? {}
  const isSynthetic = shotData?.source === 'synthetic'

  // ── Derived stats (unchanged logic) ────────────────────────────────────────
  const goals      = summary.goals           ?? 0
  const totalShots = summary.total_shots     ?? 0
  const onTarget   = summary.shots_on_target ?? 0
  const totalXg    = summary.total_xg        != null ? summary.total_xg.toFixed(2) : null
  const convRate   = totalShots > 0 ? `${((goals / totalShots) * 100).toFixed(1)}%` : null
  const avgXg      = totalShots > 0 && summary.total_xg != null
    ? (summary.total_xg / totalShots).toFixed(3)
    : null

  const outcomeCounts = shots.reduce((acc, s) => {
    const label = normaliseOutcome(s.outcome)
    acc[label] = (acc[label] ?? 0) + 1
    return acc
  }, {})

  const offTarget = (outcomeCounts['Off T'] ?? 0) + (outcomeCounts['Wayward'] ?? 0)
  const outcomeBreakdown = [
    { label: 'Goals',      count: outcomeCounts['Goal']    ?? 0, color: GREEN },
    { label: 'Saved',      count: outcomeCounts['Saved']   ?? 0, color: AMBER },
    { label: 'Blocked',    count: outcomeCounts['Blocked'] ?? 0, color: '#71717a' },
    { label: 'Off Target', count: offTarget,                     color: RED },
  ]

  const sortedShots = [...shots].sort((a, b) =>
    sortBy === 'xg' ? b.xg - a.xg : a.minute - b.minute
  )

  function handleMouseMove(e) {
    const rect = svgWrapRef.current?.getBoundingClientRect()
    if (rect) setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  // xG color coding for shot log
  function xgColor(xg) {
    if (xg >= 0.3) return GREEN
    if (xg >= 0.1) return AMBER
    return ZN500
  }

  return (
    <div className="space-y-4">

      {/* ── Header + team selector ── */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div style={{ width: 3, height: 24, backgroundColor: RED, flexShrink: 0 }} />
          <div>
            <h2 className="text-xl font-black tracking-tight uppercase leading-none" style={{ color: WHITE }}>
              xG Shot Map
            </h2>
            <p style={{ fontSize: 9, color: ZN500, textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: 2, fontWeight: 600 }}>
              Expected Goals · WC 2018 StatsBomb Open Data
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <div className="relative">
            <select
              value={selectedTeam}
              onChange={e => setSelected(e.target.value)}
              style={{
                backgroundColor: ELEV,
                border: `1px solid ${ZN800}`,
                color: WHITE,
                fontSize: 13,
                fontWeight: 600,
                padding: '7px 30px 7px 12px',
                borderRadius: 2,
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              {(teams.length ? teams : [selectedTeam]).map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <span
              className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-xs"
              style={{ color: ZN600 }}
            >▾</span>
          </div>
          {isSynthetic && (
            <span style={{ fontSize: 9, color: ZN600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Demo data</span>
          )}
        </div>
      </div>

      {/* ── Primary stats — 4 joined blocks ── */}
      {shotData && (
        <div
          className="grid grid-cols-2 sm:grid-cols-4 overflow-hidden"
          style={{ border: `1px solid ${ZN800}`, borderRadius: 2 }}
        >
          {[
            { label: 'Total Shots',     value: totalShots, color: WHITE },
            { label: 'Expected Goals',  value: totalXg,    color: GREEN },
            { label: 'Goals',           value: goals,      color: GREEN },
            { label: 'Shots on Target', value: onTarget,   color: WHITE },
          ].map((s, i) => (
            <div
              key={i}
              style={{
                backgroundColor: SURF,
                borderRight: i < 3 ? `1px solid ${ZN800}` : 'none',
                padding: '20px 0',
                textAlign: 'center',
              }}
            >
              <div
                className="tabular-nums leading-none font-black"
                style={{ fontSize: 48, color: s.color }}
              >
                {s.value ?? '—'}
              </div>
              <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.14em', color: ZN500, marginTop: 8, fontWeight: 700 }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Secondary derived stats ── */}
      {shotData && (
        <div
          className="grid grid-cols-3 overflow-hidden"
          style={{ border: `1px solid ${ZN800}`, borderRadius: 2 }}
        >
          {[
            { label: 'Conversion Rate', value: convRate,   sub: 'Goals / Total Shots' },
            { label: 'Avg xG per Shot', value: avgXg,      sub: 'Shot quality' },
            {
              label: 'Goals vs xG',
              value: totalXg != null && goals > 0
                ? (goals - parseFloat(totalXg)).toFixed(2)
                : '—',
              sub: totalXg != null && goals > 0
                ? goals > parseFloat(totalXg) ? 'Over xG' : 'Under xG'
                : 'xG delta',
            },
          ].map((s, i) => (
            <div
              key={i}
              style={{
                backgroundColor: SURF,
                borderRight: i < 2 ? `1px solid ${ZN800}` : 'none',
                padding: '16px 0',
                textAlign: 'center',
              }}
            >
              <div className="tabular-nums font-black leading-none" style={{ fontSize: 24, color: GREEN }}>
                {s.value ?? '—'}
              </div>
              <div style={{ fontSize: 8, color: ZN600, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 3 }}>{s.sub}</div>
              <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: ZN500, marginTop: 4, fontWeight: 700 }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Outcome breakdown — horizontal dot list ── */}
      {shotData && shots.length > 0 && (
        <div style={{ backgroundColor: SURF, border: `1px solid ${ZN800}`, borderRadius: 2, padding: '14px 16px' }}>
          <SectionLabel>Shot Outcome Breakdown</SectionLabel>
          {/* Horizontal dot list — no bars */}
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {outcomeBreakdown.map(o => (
              <div key={o.label} className="flex items-center gap-2">
                <span
                  style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: o.color, flexShrink: 0 }}
                />
                <span style={{ fontSize: 11, color: ZN400, fontWeight: 600 }}>{o.label}</span>
                <span style={{ fontSize: 14, color: o.color, fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>{o.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Pitch SVG ── */}
      <div style={{ backgroundColor: SURF, border: `1px solid ${ZN800}`, borderRadius: 2, overflow: 'hidden' }}>
        {loading && (
          <div className="h-64 flex items-center justify-center">
            <div className="flex items-center gap-2.5 text-sm" style={{ color: ZN500 }}>
              <span
                style={{
                  width: 16, height: 16, borderRadius: '50%',
                  border: `2px solid ${RED}`, borderTopColor: 'transparent',
                  display: 'inline-block', animation: 'spin 0.75s linear infinite',
                }}
              />
              Loading shot data…
            </div>
          </div>
        )}

        {error && (
          <div className="h-64 flex items-center justify-center text-sm" style={{ color: RED }}>
            Error: {error}
          </div>
        )}

        {!loading && !error && (
          <div ref={svgWrapRef} className="relative" onMouseMove={handleMouseMove}>
            {/* Direction label */}
            <div
              className="absolute top-2.5 left-3.5 select-none z-10"
              style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 500 }}
            >
              Attacking half →
            </div>

            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="w-full"
              onMouseLeave={() => setHovered(null)}
            >
              <Pitch shots={shots} onHover={setHovered} />
            </svg>

            {/* Hover tooltip */}
            {hovered && (
              <div
                className="absolute z-20 pointer-events-none shadow-xl"
                style={{
                  left: Math.min(mousePos.x + 14, (svgWrapRef.current?.offsetWidth ?? 600) - 175),
                  top: Math.max(mousePos.y - 10, 4),
                  backgroundColor: '#0a0a0a',
                  border: `1px solid ${ZN800}`,
                  borderRadius: 2,
                  padding: '10px 12px',
                  minWidth: 160,
                }}
              >
                <div className="font-black text-sm mb-2 truncate leading-tight" style={{ color: WHITE, maxWidth: 150 }}>
                  {hovered.player}
                </div>
                <div className="space-y-1">
                  {[
                    { label: 'Minute',  value: `${hovered.minute}'`, color: WHITE },
                    { label: 'xG',      value: hovered.xg,           color: GREEN },
                    { label: 'Outcome', value: hovered.outcome,      color: outcomeColor(hovered.outcome) },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between gap-4" style={{ fontSize: 10 }}>
                      <span style={{ color: ZN500, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{row.label}</span>
                      <span className="font-black tabular-nums" style={{ color: row.color }}>{row.value}</span>
                    </div>
                  ))}
                  {hovered.is_header === 1 && (
                    <div style={{ fontSize: 9, color: ZN600, textTransform: 'uppercase', letterSpacing: '0.1em', paddingTop: 4 }}>Header</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {!loading && !error && shotData && shots.length === 0 && (
          <div className="h-64 flex items-center justify-center text-sm" style={{ color: ZN500 }}>
            No shot data for {selectedTeam}.
          </div>
        )}
      </div>

      {/* ── Legend ── */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2" style={{ fontSize: 10 }}>
        <span style={{ color: ZN400, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', fontSize: 9 }}>Outcome:</span>
        {[
          { label: 'Goal',       color: GREEN },
          { label: 'Saved',      color: AMBER },
          { label: 'Blocked',    color: '#71717a' },
          { label: 'Off Target', color: RED },
        ].map(({ label, color }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: color, flexShrink: 0 }} />
            <span style={{ color: ZN500 }}>{label}</span>
          </span>
        ))}
        <span className="flex items-center gap-1.5 ml-2" style={{ color: ZN500 }}>
          <span style={{ display: 'inline-block', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.25)', width: 8, height: 8 }} />
          <span style={{ display: 'inline-block', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.7)', width: 14, height: 14 }} />
          <span>= xG magnitude</span>
        </span>
      </div>

      {/* ── Shot log table ── */}
      {shotData && shots.length > 0 && (
        <div style={{ backgroundColor: SURF, border: `1px solid ${ZN800}`, borderRadius: 2, overflow: 'hidden' }}>

          {/* Table header bar */}
          <div
            className="flex items-center justify-between"
            style={{ backgroundColor: ELEV, borderBottom: `1px solid ${ZN800}`, padding: '9px 14px' }}
          >
            <span style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.12em', color: WHITE }}>
              Shot Log
            </span>
            <div className="flex items-center gap-1">
              <span style={{ fontSize: 9, color: ZN600, textTransform: 'uppercase', letterSpacing: '0.1em', marginRight: 4 }}>Sort:</span>
              {[
                { id: 'minute', label: 'MINUTE' },
                { id: 'xg',    label: 'xG' },
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setSortBy(opt.id)}
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    padding: '4px 10px',
                    borderRadius: 0,
                    border: 'none',
                    borderBottom: sortBy === opt.id ? `1px solid ${GREEN}` : '1px solid transparent',
                    backgroundColor: 'transparent',
                    color: sortBy === opt.id ? WHITE : ZN600,
                    cursor: 'pointer',
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={e => { if (sortBy !== opt.id) e.currentTarget.style.color = ZN400 }}
                  onMouseLeave={e => { if (sortBy !== opt.id) e.currentTarget.style.color = ZN600 }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ overflowY: 'auto', maxHeight: 260 }}>
            <table className="w-full">
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: ELEV }}>
                <tr style={{ borderBottom: `1px solid ${ZN800}` }}>
                  <th style={{ width: 3, padding: 0 }} />
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: ZN500 }}>Player</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: ZN500, width: 50 }}>Min</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: ZN500, width: 50 }}>xG</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em', color: ZN500, width: 30 }}></th>
                </tr>
              </thead>
              <tbody>
                {sortedShots.map((shot, idx) => {
                  const isGoal = shot.outcome === 'Goal'
                  const color  = outcomeColor(shot.outcome)
                  return (
                    <tr
                      key={shot.id}
                      style={{
                        backgroundColor: isGoal
                          ? 'rgba(0,255,135,0.04)'
                          : idx % 2 === 1 ? '#191919' : SURF,
                        borderBottom: `1px solid rgba(38,38,38,0.6)`,
                      }}
                    >
                      {/* 3px left edge: green for goals, transparent otherwise */}
                      <td style={{ padding: 0, width: 3, backgroundColor: isGoal ? GREEN : 'transparent' }} />

                      {/* Player */}
                      <td style={{ padding: '6px 12px', fontSize: 11, color: isGoal ? WHITE : ZN400, fontWeight: 600, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {shot.player}
                      </td>

                      {/* Minute */}
                      <td style={{ padding: '6px 12px', textAlign: 'center', fontSize: 11, color: ZN500, fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                        {shot.minute}'
                      </td>

                      {/* xG — color coded */}
                      <td style={{ padding: '6px 12px', textAlign: 'center', fontSize: 11, fontWeight: 900, color: xgColor(shot.xg), fontVariantNumeric: 'tabular-nums' }}>
                        {shot.xg.toFixed(3)}
                      </td>

                      {/* Outcome — dot only */}
                      <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                        <span
                          title={normaliseOutcome(shot.outcome)}
                          style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: color }}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div
            className="flex justify-between"
            style={{ padding: '7px 14px', borderTop: `1px solid rgba(38,38,38,0.6)`, fontSize: 9, color: ZN600, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 500 }}
          >
            <span>{shots.length} shots total</span>
            <span>Sorted by {sortBy === 'xg' ? 'highest xG' : 'match minute'}</span>
          </div>
        </div>
      )}

      {/* ── Model info ── */}
      <div
        style={{ backgroundColor: SURF, border: `1px solid ${ZN800}`, borderRadius: 2, padding: '12px 14px', fontSize: 10, color: ZN500, lineHeight: 1.6 }}
      >
        <span style={{ color: ZN400, fontWeight: 900, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Model: </span>
        XGBoost binary classifier · WC 2018 + UEFA Euro 2020 (~15k shots).
        Features: distance, angle, header, penalty, pressure, technique.
        {' '}
        <span style={{ color: ZN600 }}>
          Run <code style={{ backgroundColor: ELEV, padding: '1px 4px', color: ZN400, fontSize: 10 }}>python3 scripts/train_xg_model.py</code> to load real StatsBomb data.
        </span>
      </div>

    </div>
  )
}
