import { useEffect, useState } from 'react'
import Plot from 'react-plotly.js'

const STAGES = [
  { value: 'GROUP', label: 'Group Stage' },
  { value: 'R16',   label: 'Round of 16' },
  { value: 'QF',    label: 'Quarter-final' },
  { value: 'SF',    label: 'Semi-final' },
  { value: 'FINAL', label: 'Final' },
]

// ── Colors ────────────────────────────────────────────────────────────────────
const GREEN  = '#00ff87'
const RED    = '#ff3b3b'
const WHITE  = '#ffffff'
const ZN500  = '#737373'
const ZN600  = '#525252'
const ZN800  = '#262626'
const SURF   = '#161616'
const ELEV   = '#1e1e1e'

// ── Helpers ───────────────────────────────────────────────────────────────────
function pretty(code, r) {
  if (code === 'A_WIN') return `${r.team_a} Win`
  if (code === 'B_WIN') return `${r.team_b} Win`
  return 'Draw'
}

function FormBubble({ result }) {
  const styles = {
    W: { background: GREEN,    color: '#000000' },
    D: { background: '#3f3f46', color: WHITE },
    L: { background: RED,       color: WHITE },
  }
  const s = styles[result] ?? styles.D
  return (
    <span
      className="inline-flex items-center justify-center text-xs font-black"
      style={{ width: 28, height: 28, borderRadius: 2, ...s }}
    >
      {result}
    </span>
  )
}

function HistStat({ label, value }) {
  return (
    <div className="text-center">
      <div className="font-black leading-none" style={{ fontSize: 28, color: WHITE }}>{value ?? '—'}</div>
      <div className="mt-1" style={{ fontSize: 10, color: ZN600, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{label}</div>
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: ZN500, marginBottom: 12 }}>
      {children}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function MatchPredictor() {
  const [fixtures, setFixtures]     = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [stage, setStage]           = useState('GROUP')
  const [result, setResult]         = useState(null)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)

  useEffect(() => {
    fetch('/api/fixtures')
      .then(r => r.json())
      .then(data => {
        setFixtures(data.fixtures || [])
        if (data.fixtures?.length) setSelectedId(String(data.fixtures[0].id))
      })
      .catch(err => setError(`Could not load fixtures: ${err.message}`))
  }, [])

  const selected = fixtures.find(f => String(f.id) === selectedId)

  async function handlePredict() {
    if (!selected) return
    setLoading(true); setError(null); setResult(null)
    try {
      const resp = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_a: selected.team_a, team_b: selected.team_b, stage }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Prediction failed')
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Broadcast banner — always visible ────────────────────────────────────
  const renderBanner = () => (
    <div style={{ backgroundColor: SURF, border: `1px solid ${ZN800}` }}>
      {/* Stage label strip */}
      <div
        className="text-center py-1.5"
        style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: ZN600, borderBottom: `1px solid ${ZN800}` }}
      >
        FIFA World Cup 2026 · {STAGES.find(s => s.value === stage)?.label ?? 'Group Stage'}
      </div>

      {/* Teams + VS */}
      <div className="flex items-center justify-between px-8 py-8">
        <div className="flex-1 text-center">
          <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: ZN600, marginBottom: 8 }}>HOME</div>
          <div className="font-black uppercase tracking-tight leading-none" style={{ fontSize: 36, color: WHITE }}>
            {selected?.team_a ?? '—'}
          </div>
          {result?.stats && (
            <div className="mt-2" style={{ fontSize: 12, color: ZN600 }}>#{result.stats.rank_a} FIFA</div>
          )}
        </div>

        <div className="px-6 font-black" style={{ fontSize: 22, color: ZN800, letterSpacing: '-0.02em' }}>VS</div>

        <div className="flex-1 text-center">
          <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: ZN600, marginBottom: 8 }}>AWAY</div>
          <div className="font-black uppercase tracking-tight leading-none" style={{ fontSize: 36, color: WHITE }}>
            {selected?.team_b ?? '—'}
          </div>
          {result?.stats && (
            <div className="mt-2" style={{ fontSize: 12, color: ZN600 }}>#{result.stats.rank_b} FIFA</div>
          )}
        </div>
      </div>

      {/* Controls bar */}
      <div
        className="flex flex-col sm:flex-row sm:items-center gap-3 px-6 py-3"
        style={{ borderTop: `1px solid ${ZN800}`, backgroundColor: ELEV }}
      >
        {/* Fixture select */}
        <div className="flex items-center gap-2 flex-1">
          <span style={{ fontSize: 10, color: ZN600, letterSpacing: '0.12em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Fixture</span>
          <div className="relative flex-1">
            <select
              value={selectedId}
              onChange={e => setSelectedId(e.target.value)}
              className="w-full transition-colors duration-150"
              style={{ backgroundColor: SURF, border: `1px solid ${ZN800}`, color: WHITE, fontSize: 13, padding: '6px 28px 6px 10px', cursor: 'pointer', outline: 'none' }}
              onFocus={e => e.target.style.borderColor = GREEN}
              onBlur={e => e.target.style.borderColor = ZN800}
            >
              {fixtures.length === 0 && <option>Loading…</option>}
              {fixtures.map(f => (
                <option key={f.id} value={f.id}>{f.team_a} vs {f.team_b}</option>
              ))}
            </select>
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: ZN600, fontSize: 11 }}>▾</span>
          </div>
        </div>

        {/* Stage select */}
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 10, color: ZN600, letterSpacing: '0.12em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Stage</span>
          <div className="relative">
            <select
              value={stage}
              onChange={e => setStage(e.target.value)}
              className="transition-colors duration-150"
              style={{ backgroundColor: SURF, border: `1px solid ${ZN800}`, color: WHITE, fontSize: 13, padding: '6px 28px 6px 10px', cursor: 'pointer', outline: 'none' }}
              onFocus={e => e.target.style.borderColor = GREEN}
              onBlur={e => e.target.style.borderColor = ZN800}
            >
              {STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: ZN600, fontSize: 11 }}>▾</span>
          </div>
        </div>

        {/* Predict button */}
        <button
          onClick={handlePredict}
          disabled={!selected || loading}
          className="font-bold uppercase tracking-widest transition-all duration-150 active:scale-95"
          style={{
            backgroundColor: (!selected || loading) ? '#1a1a1a' : GREEN,
            color: (!selected || loading) ? ZN600 : '#000000',
            fontSize: 11,
            letterSpacing: '0.14em',
            padding: '8px 24px',
            border: 'none',
            cursor: (!selected || loading) ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => { if (selected && !loading) e.currentTarget.style.backgroundColor = '#00e87a' }}
          onMouseLeave={e => { if (selected && !loading) e.currentTarget.style.backgroundColor = GREEN }}
        >
          {loading ? 'PREDICTING…' : 'RUN PREDICTION'}
        </button>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">

      {/* Broadcast banner */}
      {renderBanner()}

      {/* Error */}
      {error && (
        <div style={{ border: `1px solid ${RED}40`, backgroundColor: `${RED}10`, color: RED, fontSize: 13, padding: '10px 16px', fontWeight: 500 }}>
          {error}
        </div>
      )}

      {/* ── Result section ── */}
      {result && (
        <div className="space-y-4 fade-in">

          {/* Predicted outcome label */}
          <div className="flex items-center justify-between">
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: ZN500 }}>
              Prediction Result
            </div>
            <div
              style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: GREEN, border: `1px solid ${GREEN}40`, padding: '3px 10px' }}
            >
              {pretty(result.predicted, result)}
            </div>
          </div>

          {/* ── Three probability cards — joined, no outer borders ── */}
          <div className="grid grid-cols-3 divide-x" style={{ backgroundColor: SURF, border: `1px solid ${ZN800}`, borderRadius: 0, '--tw-divide-opacity': 1, '--tw-divide-color': ZN800 }}>
            {[
              { pct: result.probabilities.a_win, label: `${result.team_a} WIN`, color: GREEN },
              { pct: result.probabilities.draw,  label: 'DRAW',                 color: WHITE },
              { pct: result.probabilities.b_win, label: `${result.team_b} WIN`, color: RED },
            ].map((item, i) => (
              <div key={i} className="text-center py-6 px-4" style={{ borderRight: i < 2 ? `1px solid ${ZN800}` : 'none' }}>
                <div
                  className="font-black leading-none tabular-nums"
                  style={{ fontSize: 56, color: item.color, letterSpacing: '-0.03em' }}
                >
                  {(item.pct * 100).toFixed(1)}%
                </div>
                <div
                  className="mt-3 font-bold"
                  style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: ZN600 }}
                >
                  {item.label}
                </div>
              </div>
            ))}
          </div>

          {/* Probability bar — 3px, no rounded ends */}
          <div style={{ height: 3, display: 'flex', overflow: 'hidden' }}>
            <div style={{ backgroundColor: GREEN, width: `${result.probabilities.a_win * 100}%`, transition: 'width 700ms ease' }} />
            <div style={{ backgroundColor: ZN600, width: `${result.probabilities.draw * 100}%`, transition: 'width 700ms ease' }} />
            <div style={{ backgroundColor: RED,   width: `${result.probabilities.b_win * 100}%`, transition: 'width 700ms ease' }} />
          </div>
          <div className="flex justify-between" style={{ fontSize: 10, color: ZN600, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 4 }}>
            <span>{result.team_a}</span>
            <span>Draw</span>
            <span>{result.team_b}</span>
          </div>

          {result.stats && (
            <>
              {/* ── Stats row: Ranking + Form + H2H ── */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

                {/* FIFA Ranking */}
                <div className="p-4 transition-colors duration-150" style={{ backgroundColor: SURF, border: `1px solid ${ZN800}` }}
                     onMouseEnter={e => e.currentTarget.style.borderColor = '#404040'}
                     onMouseLeave={e => e.currentTarget.style.borderColor = ZN800}>
                  <SectionLabel>FIFA Ranking</SectionLabel>
                  <div className="flex items-center justify-between mt-2">
                    <div className="text-center">
                      <div className="font-black leading-none" style={{ fontSize: 32, color: WHITE }}>#{result.stats.rank_a}</div>
                      <div className="mt-1 truncate max-w-[80px]" style={{ fontSize: 10, color: ZN600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{result.team_a}</div>
                    </div>
                    <div className="font-black" style={{ fontSize: 12, color: ZN800 }}>VS</div>
                    <div className="text-center">
                      <div className="font-black leading-none" style={{ fontSize: 32, color: WHITE }}>#{result.stats.rank_b}</div>
                      <div className="mt-1 truncate max-w-[80px]" style={{ fontSize: 10, color: ZN600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{result.team_b}</div>
                    </div>
                  </div>
                  <div className="text-center mt-3" style={{ fontSize: 10, color: ZN600 }}>
                    {result.stats.rank_a < result.stats.rank_b
                      ? `${result.team_a} ranked ${result.stats.rank_b - result.stats.rank_a} places higher`
                      : result.stats.rank_a > result.stats.rank_b
                      ? `${result.team_b} ranked ${result.stats.rank_a - result.stats.rank_b} places higher`
                      : 'Equal ranking'}
                  </div>
                </div>

                {/* Avg Goals */}
                <div className="p-4 transition-colors duration-150" style={{ backgroundColor: SURF, border: `1px solid ${ZN800}` }}
                     onMouseEnter={e => e.currentTarget.style.borderColor = '#404040'}
                     onMouseLeave={e => e.currentTarget.style.borderColor = ZN800}>
                  <SectionLabel>Avg Goals · Last 5 WC</SectionLabel>
                  <div className="space-y-3 mt-2">
                    {[
                      { name: result.team_a, scored: result.stats.form_a_scored, conceded: result.stats.form_a_conceded },
                      { name: result.team_b, scored: result.stats.form_b_scored, conceded: result.stats.form_b_conceded },
                    ].map(t => (
                      <div key={t.name}>
                        <div className="flex justify-between mb-1.5" style={{ fontSize: 11 }}>
                          <span className="font-semibold truncate max-w-[80px]" style={{ color: WHITE }}>{t.name}</span>
                          <span className="font-bold" style={{ color: GREEN }}>{t.scored} scored</span>
                          <span className="font-bold" style={{ color: RED }}>{t.conceded} conceded</span>
                        </div>
                        <div style={{ height: 2, backgroundColor: '#2a2a2a', overflow: 'hidden' }}>
                          <div style={{ height: '100%', backgroundColor: GREEN, width: `${Math.min(t.scored / 4 * 100, 100)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* H2H */}
                <div className="p-4 transition-colors duration-150" style={{ backgroundColor: SURF, border: `1px solid ${ZN800}` }}
                     onMouseEnter={e => e.currentTarget.style.borderColor = '#404040'}
                     onMouseLeave={e => e.currentTarget.style.borderColor = ZN800}>
                  <SectionLabel>Head-to-Head · {result.stats.h2h_meetings} WC Meetings</SectionLabel>
                  {result.stats.h2h_meetings === 0 ? (
                    <div className="text-center mt-6" style={{ fontSize: 12, color: ZN600 }}>No previous WC meetings</div>
                  ) : (
                    <>
                      <div className="flex items-end justify-center gap-6 mt-2">
                        <div className="text-center">
                          <div className="font-black leading-none" style={{ fontSize: 32, color: GREEN }}>
                            {Math.round(result.stats.h2h_a_win_rate * 100)}%
                          </div>
                          <div className="mt-1" style={{ fontSize: 10, color: ZN600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{result.team_a}</div>
                        </div>
                        <div className="text-center">
                          <div className="font-black leading-none" style={{ fontSize: 32, color: RED }}>
                            {Math.round((1 - result.stats.h2h_a_win_rate) * 100)}%
                          </div>
                          <div className="mt-1" style={{ fontSize: 10, color: ZN600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{result.team_b}</div>
                        </div>
                      </div>
                      <div className="mt-3 flex overflow-hidden" style={{ height: 2 }}>
                        <div style={{ backgroundColor: GREEN, width: `${result.stats.h2h_a_win_rate * 100}%` }} />
                        <div style={{ backgroundColor: RED, flex: 1 }} />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* ── Recent WC Form ── */}
              {(result.stats.wc_a || result.stats.wc_b) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { team: result.team_a, wc: result.stats.wc_a },
                    { team: result.team_b, wc: result.stats.wc_b },
                  ].map(({ team, wc }) => wc && (
                    <div key={team} className="p-4 transition-colors duration-150" style={{ backgroundColor: SURF, border: `1px solid ${ZN800}` }}
                         onMouseEnter={e => e.currentTarget.style.borderColor = '#404040'}
                         onMouseLeave={e => e.currentTarget.style.borderColor = ZN800}>
                      <SectionLabel>{team} · Recent WC Form</SectionLabel>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {wc.recent_form.length === 0
                          ? <span style={{ fontSize: 12, color: ZN600 }}>No WC data</span>
                          : wc.recent_form.map((r, i) => <FormBubble key={i} result={r} />)
                        }
                        {wc.recent_form.length > 0 && (
                          <span style={{ fontSize: 10, color: ZN600, marginLeft: 4 }}>← last {wc.recent_form.length} games</span>
                        )}
                      </div>
                      <div className="flex gap-4 mt-3" style={{ fontSize: 11 }}>
                        <span className="font-black" style={{ color: GREEN }}>{wc.wins}W</span>
                        <span className="font-bold" style={{ color: ZN500 }}>{wc.draws}D</span>
                        <span className="font-black" style={{ color: RED }}>{wc.losses}L</span>
                        <span style={{ color: ZN800 }}>·</span>
                        <span style={{ color: ZN500 }}>{wc.goals_for} GF</span>
                        <span style={{ color: ZN500 }}>{wc.goals_against} GA</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── WC History ── */}
              {(result.stats.wc_a || result.stats.wc_b) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { team: result.team_a, wc: result.stats.wc_a },
                    { team: result.team_b, wc: result.stats.wc_b },
                  ].map(({ team, wc }) => wc && (
                    <div key={team} className="p-4 transition-colors duration-150" style={{ backgroundColor: SURF, border: `1px solid ${ZN800}` }}
                         onMouseEnter={e => e.currentTarget.style.borderColor = '#404040'}
                         onMouseLeave={e => e.currentTarget.style.borderColor = ZN800}>
                      <SectionLabel>{team} · World Cup History</SectionLabel>
                      <div className="grid grid-cols-3 gap-2 mb-4">
                        <HistStat label="Titles"      value={
                          <span style={{ color: wc.titles > 0 ? GREEN : ZN600 }}>{wc.titles}</span>
                        } />
                        <HistStat label="Appearances" value={wc.appearances} />
                        <HistStat label="Wins"        value={wc.wins} />
                      </div>
                      <div className="text-center px-3 py-2" style={{ backgroundColor: ZN800, fontSize: 12 }}>
                        <span style={{ color: ZN600 }}>Best finish: </span>
                        <span className="font-bold" style={{ color: WHITE }}>{wc.best_finish}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── Bar chart ── */}
          <div className="p-4" style={{ backgroundColor: SURF, border: `1px solid ${ZN800}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em', color: ZN500, marginBottom: 8 }}>
              Win Probability Breakdown
            </div>
            <Plot
              data={[{
                type: 'bar',
                x: [`${result.team_a} Win`, 'Draw', `${result.team_b} Win`],
                y: [result.probabilities.a_win, result.probabilities.draw, result.probabilities.b_win],
                text: [
                  `${(result.probabilities.a_win * 100).toFixed(1)}%`,
                  `${(result.probabilities.draw   * 100).toFixed(1)}%`,
                  `${(result.probabilities.b_win  * 100).toFixed(1)}%`,
                ],
                textposition: 'outside',
                marker: { color: [GREEN, '#525252', RED] },
                hoverinfo: 'x+text',
              }]}
              layout={{
                paper_bgcolor: 'transparent',
                plot_bgcolor:  'transparent',
                font: { color: '#737373', family: 'Inter, sans-serif', size: 11 },
                margin: { t: 20, l: 40, r: 20, b: 50 },
                yaxis: { tickformat: ',.0%', range: [0, 1.15], gridcolor: '#1f1f1f', tickfont: { color: '#525252', size: 10 } },
                xaxis: { gridcolor: 'transparent', tickfont: { color: '#d4d4d4', size: 11 } },
                showlegend: false,
                height: 220,
              }}
              config={{ displayModeBar: false, responsive: true }}
              useResizeHandler
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ fontSize: 10, color: '#404040', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            XGBoost · WC 2006–2022 · FIFA rank diff, recent form, H2H, stage, host nation
          </div>
        </div>
      )}
    </div>
  )
}
