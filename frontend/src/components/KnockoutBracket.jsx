/**
 * KnockoutBracket.jsx
 *
 * Displays the WC 2026 tournament bracket: R32 → R16 → QF → SF → Final.
 * Data comes from GET /api/bracket (see backend/app.py).
 *
 * While the group stage is still running the bracket shows the projected
 * R32 pairings based on current standings (with "TBD" for undecided slots).
 * Once knockouts begin, real results fill in automatically.
 */

import { useState, useEffect, useCallback } from 'react'
import API_BASE from '../config.js'

// ── Colors ────────────────────────────────────────────────────────────────────
const GREEN  = '#00ff87'
const BG     = '#0d0d0d'
const CARD   = '#141414'
const BORDER = '#1f1f1f'
const MUTED  = '#525252'
const TEXT   = '#e5e5e5'

// ── Round display config ──────────────────────────────────────────────────────
const ROUND_META = {
  r32:   { label: 'Round of 32',    short: 'R32',   dates: 'Jun 28 – Jul 3' },
  r16:   { label: 'Round of 16',    short: 'R16',   dates: 'Jul 4 – 7'      },
  qf:    { label: 'Quarter-Finals', short: 'QF',    dates: 'Jul 9 – 11'     },
  sf:    { label: 'Semi-Finals',    short: 'SF',    dates: 'Jul 14 – 15'    },
  final: { label: 'Final',          short: 'FINAL', dates: 'Jul 19'         },
}

const ROUND_ORDER = ['r32', 'r16', 'qf', 'sf', 'final']

// ── Utility: format UTC date string ──────────────────────────────────────────
function fmtDate(utc) {
  if (!utc) return ''
  const d = new Date(utc)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })
}

// ── MatchCard ─────────────────────────────────────────────────────────────────
function MatchCard({ match, compact, isProjected }) {
  const { team_a, team_b, score_a, score_b, winner, status, slot_a, slot_b } = match
  const isPlayed   = status === 'FINISHED'
  const isLive     = status === 'IN_PLAY' || status === 'PAUSED'
  const isTBD_a    = !team_a || team_a === 'TBD'
  const isTBD_b    = !team_b || team_b === 'TBD'

  const teamRow = (name, score, isWinner, slotCode, isTBD) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: compact ? '5px 8px' : '7px 10px',
        borderRadius: '4px',
        background: isWinner ? 'rgba(0,255,135,0.08)' : 'transparent',
        transition: 'background 0.15s',
      }}
    >
      <span
        style={{
          fontSize: compact ? '11px' : '12px',
          fontWeight: isWinner ? 700 : 400,
          color: isTBD ? MUTED : (isWinner ? GREEN : TEXT),
          letterSpacing: '0.02em',
          maxWidth: compact ? '90px' : '120px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={name || slotCode}
      >
        {isTBD ? (slotCode || 'TBD') : name}
      </span>
      {isPlayed || isLive ? (
        <span
          style={{
            fontSize: compact ? '12px' : '14px',
            fontWeight: 700,
            color: isWinner ? GREEN : TEXT,
            minWidth: '16px',
            textAlign: 'right',
          }}
        >
          {score ?? '-'}
        </span>
      ) : null}
    </div>
  )

  return (
    <div
      style={{
        background: CARD,
        border: `1px solid ${isLive ? GREEN : isProjected ? '#2a2a2a' : BORDER}`,
        borderRadius: '6px',
        overflow: 'hidden',
        width: compact ? '160px' : '200px',
        flexShrink: 0,
        boxShadow: isLive ? `0 0 8px rgba(0,255,135,0.25)` : 'none',
        transition: 'border-color 0.2s',
        opacity: isProjected ? 0.85 : 1,
      }}
    >
      {isLive && (
        <div style={{ background: GREEN, textAlign: 'center', padding: '2px 0', fontSize: '9px', fontWeight: 700, color: '#000', letterSpacing: '0.15em' }}>
          LIVE
        </div>
      )}
      {isProjected && !isLive && (
        <div style={{ background: '#1a1a1a', textAlign: 'center', padding: '2px 0', fontSize: '8px', fontWeight: 700, color: '#f59e0b', letterSpacing: '0.15em', borderBottom: '1px solid #2a2a2a' }}>
          PROJECTED
        </div>
      )}
      <div style={{ borderBottom: `1px solid ${BORDER}` }}>
        {teamRow(team_a, score_a, winner === team_a, slot_a, isTBD_a)}
      </div>
      {teamRow(team_b, score_b, winner === team_b, slot_b, isTBD_b)}
    </div>
  )
}

// ── RoundColumn ───────────────────────────────────────────────────────────────
function RoundColumn({ roundKey, matches, isCurrent, compact, isGroupStage }) {
  // R32 during group stage = projected; all other rounds always = not projected
  const isProjected = isGroupStage && roundKey === 'r32'
  const meta = ROUND_META[roundKey]
  if (!meta) return null

  // For empty rounds (not started), show placeholder cards
  const cards = matches.length > 0
    ? matches
    : generatePlaceholders(roundKey)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', minWidth: compact ? '168px' : '210px' }}>
      {/* Round header */}
      <div style={{ textAlign: 'center', marginBottom: '4px' }}>
        <div style={{
          fontSize: '10px',
          fontWeight: 800,
          letterSpacing: '0.14em',
          color: isCurrent ? GREEN : MUTED,
          textTransform: 'uppercase',
        }}>
          {meta.label}
        </div>
        <div style={{ fontSize: '9px', color: '#404040', letterSpacing: '0.1em', marginTop: '2px' }}>
          {meta.dates}
        </div>
        {isCurrent && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginTop: '4px' }}>
            <span style={{ height: '6px', width: '6px', borderRadius: '50%', background: GREEN, display: 'inline-block', animation: 'pulse 2s infinite' }} />
            <span style={{ fontSize: '9px', color: GREEN, fontWeight: 700, letterSpacing: '0.1em' }}>CURRENT</span>
          </div>
        )}
      </div>

      {/* Match cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
        {cards.map((m, i) => (
          <MatchCard key={m.match_id || i} match={m} compact={compact} isProjected={isProjected && m.team_a !== 'TBD' && m.team_b !== 'TBD'} />
        ))}
      </div>
    </div>
  )
}

// Generate placeholder cards for future rounds
function generatePlaceholders(roundKey) {
  const counts = { r16: 8, qf: 4, sf: 2, final: 1 }
  const count = counts[roundKey] || 0
  return Array.from({ length: count }, (_, i) => ({
    match_id: `${roundKey}_ph_${i}`,
    team_a: 'TBD', team_b: 'TBD',
    score_a: null, score_b: null,
    winner: null, status: 'SCHEDULED',
    slot_a: '', slot_b: '',
  }))
}

// ── Status Banner ─────────────────────────────────────────────────────────────
function StatusBanner({ currentStage }) {
  const isGroupStage = currentStage === 'GROUP'

  const config = {
    GROUP: {
      icon: '⏳',
      color: '#f59e0b',
      bg: 'rgba(245,158,11,0.06)',
      border: 'rgba(245,158,11,0.25)',
      text: 'Group stage ends Jun 27 — matchups below are PROJECTED from current standings. Teams update automatically once group stage is confirmed.',
    },
    r32:   { icon: '⚽', color: GREEN, bg: 'rgba(0,255,135,0.06)', border: 'rgba(0,255,135,0.2)', text: 'Round of 32 in progress — results update every 60 seconds.' },
    r16:   { icon: '⚽', color: GREEN, bg: 'rgba(0,255,135,0.06)', border: 'rgba(0,255,135,0.2)', text: 'Round of 16 in progress.' },
    qf:    { icon: '⚽', color: GREEN, bg: 'rgba(0,255,135,0.06)', border: 'rgba(0,255,135,0.2)', text: 'Quarter-Finals in progress.' },
    sf:    { icon: '⚽', color: GREEN, bg: 'rgba(0,255,135,0.06)', border: 'rgba(0,255,135,0.2)', text: 'Semi-Finals in progress.' },
    final: { icon: '🏆', color: GREEN, bg: 'rgba(0,255,135,0.06)', border: 'rgba(0,255,135,0.2)', text: 'FINAL — Winner takes all.' },
  }[currentStage] || { icon: '⚽', color: MUTED, bg: 'transparent', border: BORDER, text: '' }

  return (
    <div style={{
      background: config.bg,
      border: `1px solid ${config.border}`,
      borderRadius: '6px',
      padding: '10px 16px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '10px',
      marginBottom: '20px',
    }}>
      <span style={{ fontSize: '14px', flexShrink: 0 }}>{config.icon}</span>
      <span style={{ fontSize: '12px', color: config.color, letterSpacing: '0.03em', lineHeight: '1.5' }}>{config.text}</span>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function KnockoutBracket() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [compact, setCompact] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE}/api/bracket`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(await res.json())
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    // Refresh every 30s — picks up group stage final standings quickly once
    // they're confirmed, and pulls live knockout results as they happen.
    const id = setInterval(load, 30_000)
    return () => clearInterval(id)
  }, [load])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px', color: MUTED }}>
        <span style={{ fontSize: '13px', letterSpacing: '0.1em' }}>Loading bracket…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ color: '#ef4444', padding: '24px', fontSize: '13px' }}>
        Failed to load bracket: {error}
      </div>
    )
  }

  const { current_stage, rounds } = data

  return (
    <div>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: TEXT, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Knockout Bracket
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '11px', color: MUTED }}>
            WC 2026 · R32 → R16 → QF → SF → Final
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => setCompact(c => !c)}
            style={{
              background: 'transparent',
              border: `1px solid ${BORDER}`,
              borderRadius: '4px',
              color: MUTED,
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.1em',
              padding: '4px 10px',
              cursor: 'pointer',
            }}
          >
            {compact ? 'EXPAND' : 'COMPACT'}
          </button>
          <button
            onClick={load}
            style={{
              background: 'transparent',
              border: `1px solid ${BORDER}`,
              borderRadius: '4px',
              color: MUTED,
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.1em',
              padding: '4px 10px',
              cursor: 'pointer',
            }}
          >
            REFRESH
          </button>
        </div>
      </div>

      <StatusBanner currentStage={current_stage} />

      {/* Scrollable bracket */}
      <div style={{ overflowX: 'auto', paddingBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', minWidth: 'max-content', padding: '4px 2px' }}>
          {ROUND_ORDER.map(key => (
            <RoundColumn
              key={key}
              roundKey={key}
              matches={rounds[key] || []}
              isCurrent={current_stage === key}
              compact={compact}
              isGroupStage={current_stage === 'GROUP'}
            />
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ marginTop: '16px', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        <LegendItem color={GREEN} label="Winner / Current round" />
        <LegendItem color={MUTED} label="TBD — awaiting result" />
        <LegendItem color="#ef4444" label="Eliminated" />
      </div>
    </div>
  )
}

function LegendItem({ color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, display: 'inline-block' }} />
      <span style={{ fontSize: '10px', color: MUTED, letterSpacing: '0.08em' }}>{label}</span>
    </div>
  )
}
