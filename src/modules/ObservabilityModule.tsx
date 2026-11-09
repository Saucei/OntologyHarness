// ObservabilityModule — FN-OBS-001 (diamond timeline) + FN-OBS-002 (event table)
// + FN-OBS-003 (session replay Preview|Raw + status chips) + FN-OBS-004 (waterfall)
// + FN-OBS-005 (logs).
// Session-debug page fed from the trace ledger (ws.traces via appendTrace) and
// .ohtrace imports. UNREGISTERED stub: exported for future registration only —
// layer invariants forbid adding it to registry.ts in this slice.
// Glass tokens only; light+dark parity via var(--*) tokens.
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import { Icon } from '../components/Icon'
import { appendAudit, appendTrace, ws, type Trace } from '../store'
import {
  tracesToEvents,
  filterEvents,
  listEventTypes,
  dateChipLabel,
  timelinePositions,
  toggleSelection,
  formatTime,
  formatUpdates,
  stringifyOhtrace,
  parseOhtrace,
  eventsToReplay,
  replayRawText,
  statusChipLabel,
  statusChipTone,
  eventsToLogs,
  filterLogRows,
  logsToJson,
  formatLogTimestamp,
  formatParameters,
  formatTags,
  copyTextWithFallback,
  eventsToSpans,
  visibleSpans,
  projectSpan,
  zoomInWaterfall,
  zoomOutWaterfall,
  resetWaterfallZoom,
  formatSpanDuration,
  spanDetailText,
  FULL_WATERFALL_WINDOW,
  type EventRow,
  type ReplayMode,
  type WaterfallWindow,
} from '../observability/types'

export interface ObservabilityProps {
  /** Override ledger traces (tests / storybook). Defaults to ws.traces. */
  traces?: readonly Trace[]
  /** Override pre-built rows (tests). Takes precedence over `traces`. */
  events?: readonly EventRow[]
}

function logOp(op: string) {
  try {
    appendTrace({ kind: 'tool-call', tool: 'observability.filter', ok: true, ms: 0, detail: op })
  } catch {
    /* ledger unavailable in some test envs — UI must not crash */
  }
  try {
    appendAudit({ event: 'observability', detail: op })
  } catch {
    /* audit unavailable — UI must not crash */
  }
}

export function ObservabilityModule({ traces, events: eventsProp }: ObservabilityProps = {}) {
  const allEvents = useMemo<EventRow[]>(
    () => (eventsProp ? [...eventsProp] : tracesToEvents(traces ?? ws.traces)),
    [eventsProp, traces],
  )
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [typePattern, setTypePattern] = useState<string>('')
  const [query, setQuery] = useState('')
  const [replayMode, setReplayMode] = useState<ReplayMode>('preview')
  const [logQuery, setLogQuery] = useState('')
  const [logsCopied, setLogsCopied] = useState(false)
  const [waterfallZoom, setWaterfallZoom] = useState<WaterfallWindow>({ ...FULL_WATERFALL_WINDOW })
  const [selectedSpanId, setSelectedSpanId] = useState<string | null>(null)

  const positions = useMemo(() => timelinePositions(allEvents), [allEvents])
  const byId = useMemo(() => new Map(allEvents.map((e) => [e.id, e])), [allEvents])
  const types = useMemo(() => listEventTypes(allEvents), [allEvents])

  const filtered = useMemo(
    () =>
      filterEvents(allEvents, {
        selectedIds,
        types: typeFilter === 'all' ? undefined : [typeFilter],
        typePattern,
        query,
      }),
    [allEvents, selectedIds, typeFilter, typePattern, query],
  )

  // FN-OBS-003: replay turns synced with the timeline filter (filtered).
  const replayTurns = useMemo(() => eventsToReplay(filtered), [filtered])
  const replayRaw = useMemo(() => replayRawText(filtered), [filtered])

  // FN-OBS-005: logs synced with the timeline filter + `*` wildcard search.
  const allLogs = useMemo(() => eventsToLogs(filtered), [filtered])
  const logRows = useMemo(() => filterLogRows(allLogs, logQuery), [allLogs, logQuery])

  // FN-OBS-004: waterfall spans synced with the timeline filter, zoomed via window.
  const spans = useMemo(() => eventsToSpans(filtered), [filtered])
  const visible = useMemo(() => visibleSpans(spans, waterfallZoom), [spans, waterfallZoom])
  const selectedSpan = useMemo(
    () => spans.find((s) => s.id === selectedSpanId) ?? null,
    [spans, selectedSpanId],
  )

  const agentCount = allEvents.filter((e) => e.category === 'agent').length
  const internalCount = allEvents.length - agentCount

  const onDiamond = useCallback((id: string) => (e: MouseEvent<HTMLButtonElement>) => {
    const additive = e.metaKey || e.ctrlKey
    setSelectedIds((prev) => toggleSelection(prev, id, additive))
    logOp(`diamond ${additive ? 'cmd' : 'click'} ${id}`)
  }, [])

  const onTurnSelect = useCallback((id: string) => {
    setSelectedIds((prev) => toggleSelection(prev, id, false))
    logOp(`replay select ${id}`)
  }, [])

  const onLogSelect = useCallback((id: string) => {
    setSelectedIds((prev) => toggleSelection(prev, id, false))
    logOp(`logs select ${id}`)
  }, [])

  const onSpanSelect = useCallback((id: string) => {
    const willClear = selectedIds.size === 1 && selectedIds.has(id)
    setSelectedSpanId(willClear ? null : id)
    setSelectedIds((prev) => toggleSelection(prev, id, false))
    logOp(`waterfall select ${id}`)
  }, [selectedIds])

  const zoomIn = useCallback(() => {
    const next = zoomInWaterfall(waterfallZoom)
    setWaterfallZoom(next)
    logOp(`waterfall zoom-in ${next.start}-${next.end}`)
  }, [waterfallZoom])

  const zoomOut = useCallback(() => {
    const next = zoomOutWaterfall(waterfallZoom)
    setWaterfallZoom(next)
    logOp(`waterfall zoom-out ${next.start}-${next.end}`)
  }, [waterfallZoom])

  const resetZoom = useCallback(() => {
    setWaterfallZoom(resetWaterfallZoom())
    logOp('waterfall zoom-reset')
  }, [])

  const closeSpanDetail = useCallback(() => {
    setSelectedSpanId(null)
    setSelectedIds(new Set())
    logOp('waterfall detail close')
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedIds(new Set())
        setQuery('')
        setTypeFilter('all')
        setTypePattern('')
        setLogQuery('')
        setSelectedSpanId(null)
        setWaterfallZoom({ ...FULL_WATERFALL_WINDOW })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const clearFilters = useCallback(() => {
    setSelectedIds(new Set())
    setTypeFilter('all')
    setTypePattern('')
    setQuery('')
    setLogQuery('')
    setSelectedSpanId(null)
    setWaterfallZoom({ ...FULL_WATERFALL_WINDOW })
    logOp('clear-filters')
  }, [])

  const setReplayToggle = useCallback((mode: ReplayMode) => {
    setReplayMode(mode)
    logOp(`replay mode=${mode}`)
  }, [])

  const copyLogsAsJson = useCallback(() => {
    const text = logsToJson(logRows)
    void copyTextWithFallback(text).then((ok) => {
      setLogsCopied(ok)
      logOp(`logs copy-json ${logRows.length} rows copied=${ok}`)
      if (ok) {
        window.setTimeout(() => setLogsCopied(false), 2000)
      }
    })
  }, [logRows])

  const exportOhtrace = useCallback(() => {
    const text = stringifyOhtrace(allEvents)
    const blob = new Blob([text], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'session.ohtrace.json'
    a.click()
    URL.revokeObjectURL(url)
    logOp(`export ${allEvents.length} events`)
  }, [allEvents])

  const importOhtrace = useCallback(
    (file: File) => {
      file.text().then((text) => {
        const rows = parseOhtrace(text)
        logOp(`import ${rows.length} events from ${file.name}`)
        if (rows.length) setSelectedIds(new Set())
      }).catch(() => {})
    },
    [],
  )

  if (!allEvents.length) {
    return (
      <div className="module" data-testid="observability-module">
        <div className="glass panel" style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
          <span className="chip chip-mono">{dateChipLabel([])}</span>
          <strong>No trace events yet</strong>
          <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: 12 }}>
            Run an agent, swarm or preset — or import a <code className="chip-mono">.ohtrace</code> file —
            and events appear here.
          </p>
          <label className="btn" style={{ cursor: 'pointer' }}>
            Import .ohtrace
            <input type="file" accept=".ohtrace,.json,application/json" hidden aria-label="Import .ohtrace file" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importOhtrace(f) }} />
          </label>
        </div>
      </div>
    )
  }

  return (
    <div className="module" data-testid="observability-module" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* ——— Diamond timeline (FN-OBS-001) ——— */}
      <section className="glass panel" aria-label="Session timeline" data-testid="observability-timeline">
        <div className="panel-title">
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="filter" size={13} /> Session timeline
            <span className="chip chip-mono" data-testid="observability-date-chip">{dateChipLabel(allEvents)}</span>
          </span>
          <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span className="chip" aria-label={`Agent ${agentCount} events`}>
              <i aria-hidden style={{ width: 9, height: 9, display: 'inline-block', transform: 'rotate(45deg)', background: 'var(--info)', borderRadius: 2, marginRight: 2 }} />
              Agent {agentCount}
            </span>
            <span className="chip" aria-label={`Internal ${internalCount} events`}>
              <i aria-hidden style={{ width: 9, height: 9, display: 'inline-block', transform: 'rotate(45deg)', background: 'var(--text)', borderRadius: 2, marginRight: 2 }} />
              Internal {internalCount}
            </span>
            <button type="button" className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 10 }} onClick={exportOhtrace} aria-label="Export .ohtrace">
              <Icon name="download" size={12} /> .ohtrace
            </button>
            <label className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 10, cursor: 'pointer' }}>
              Import
              <input type="file" accept=".ohtrace,.json,application/json" hidden aria-label="Import .ohtrace file" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importOhtrace(f) }} />
            </label>
          </span>
        </div>
        <div aria-label="Event timeline" role="group" style={{ position: 'relative', height: 56, margin: '10px 14px 6px' }}>
          <div aria-hidden style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 1, background: 'var(--glass-border-strong)' }} />
          {positions.map((p) => {
            const row = byId.get(p.id)
            const selected = selectedIds.has(p.id)
            const isAgent = p.category === 'agent'
            return (
              <button
                key={p.id}
                type="button"
                data-testid={`obs-diamond-${p.id}`}
                data-category={p.category}
                aria-label={`${isAgent ? 'Agent' : 'Internal'} event ${p.label} at ${row ? formatTime(row.ts) : ''}${selected ? ', selected' : ''} — click to filter, Control or Command click to add`}
                aria-pressed={selected}
                onClick={onDiamond(p.id)}
                style={{
                  position: 'absolute',
                  left: `calc(${p.left}% - 6px)`,
                  top: 'calc(50% - 6px)',
                  width: 12,
                  height: 12,
                  padding: 0,
                  border: '2px solid var(--glass-bg-strong)',
                  borderRadius: 2,
                  transform: 'rotate(45deg)',
                  background: isAgent ? 'var(--info)' : 'var(--text)',
                  cursor: 'pointer',
                  boxShadow: selected ? 'var(--green-glow)' : 'none',
                  opacity: selectedIds.size === 0 || selected ? 1 : 0.35,
                }}
              />
            )
          })}
        </div>
        <p style={{ margin: '2px 0 0', color: 'var(--text-dim)', fontSize: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span>Click a diamond to filter · <kbd>⌘/Ctrl</kbd>-click to multi-select · <kbd>Esc</kbd> clears</span>
          {selectedIds.size > 0 && (
            <span className="chip" data-testid="observability-selected">{selectedIds.size} selected</span>
          )}
        </p>
      </section>

      {/* ——— Event table (FN-OBS-002) ——— */}
      <section className="glass panel" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }} aria-label="Session events" data-testid="observability-table">
        <div className="panel-title">
          <span>Events · {filtered.length} of {allEvents.length}</span>
          <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 10, color: 'var(--text-dim)' }}>
              Type
              <select data-testid="obs-type-filter" className="input" style={{ width: 'auto', padding: '3px 6px' }} aria-label="Type filter" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); logOp(`type=${e.target.value}`) }}>
                <option value="all">All</option>
                {types.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
            <input
              className="input"
              style={{ width: 150, padding: '3px 8px' }}
              placeholder="Type * wildcard"
              aria-label="Type pattern"
              data-testid="obs-type-pattern"
              value={typePattern}
              onChange={(e) => { setTypePattern(e.target.value); logOp(`type-pattern=${e.target.value}`) }}
            />
            <input
              className="input"
              style={{ width: 180, padding: '3px 8px' }}
              placeholder="Search payload…"
              aria-label="Payload search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="button" className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 10 }} onClick={clearFilters} aria-label="Clear filters">
              <Icon name="x" size={12} /> Clear
            </button>
          </span>
        </div>
        <div style={{ overflow: 'auto', minHeight: 0 }}>
          <table className="tbl" aria-label="Event table">
            <thead>
              <tr>
                <th scope="col">Time</th>
                <th scope="col">Type</th>
                <th scope="col">Updates ↻⚡</th>
                <th scope="col">Payload</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className={selectedIds.has(row.id) ? 'selected' : undefined} data-testid={`obs-row-${row.id}`}>
                  <td className="chip-mono" style={{ fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{formatTime(row.ts)}</td>
                  <td>
                    <span className="chip chip-mono" title={row.category === 'agent' ? 'Agent' : 'Internal'}>
                      {row.type}
                    </span>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <span className={row.ok ? undefined : 'pill pill-danger'}>{formatUpdates(row)}</span>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.payload}>
                    {row.payload}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ color: 'var(--text-dim)' }}>No events match the current filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ——— Session replay (FN-OBS-003) ——— */}
      <section className="glass panel" aria-label="Session replay" data-testid="observability-replay">
        <div className="panel-title">
          <span>Session replay · {replayTurns.length} of {allEvents.length}</span>
          <span role="group" aria-label="Replay view mode" style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <button
              type="button"
              className={replayMode === 'preview' ? 'btn' : 'btn btn-ghost'}
              style={{ padding: '2px 10px', fontSize: 10 }}
              aria-pressed={replayMode === 'preview'}
              data-testid="obs-replay-preview"
              onClick={() => setReplayToggle('preview')}
            >
              Preview
            </button>
            <button
              type="button"
              className={replayMode === 'raw' ? 'btn' : 'btn btn-ghost'}
              style={{ padding: '2px 10px', fontSize: 10 }}
              aria-pressed={replayMode === 'raw'}
              data-testid="obs-replay-raw-toggle"
              onClick={() => setReplayToggle('raw')}
            >
              Raw
            </button>
          </span>
        </div>
        {replayMode === 'preview' ? (
          <div data-testid="observability-replay-preview" style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflow: 'auto', padding: '4px 2px' }}>
            {replayTurns.map((turn) => {
              const tone = statusChipTone(turn.ok)
              const isSelected = selectedIds.has(turn.id)
              return (
                <button
                  key={turn.id}
                  type="button"
                  data-testid={`obs-replay-${turn.id}`}
                  data-role={turn.role}
                  aria-label={`${turn.role} turn ${turn.type} ${turn.ok ? 'ok' : 'failed'} — click to filter`}
                  aria-pressed={isSelected}
                  onClick={() => onTurnSelect(turn.id)}
                  style={{
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    padding: '8px 10px',
                    border: '1px solid var(--glass-border)',
                    borderRadius: 'var(--r-md)',
                    background: 'var(--glass-bg-strong)',
                    cursor: 'pointer',
                    boxShadow: isSelected ? 'var(--green-glow)' : 'none',
                    color: 'var(--text)',
                  }}
                >
                  <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    {turn.role === 'tool' ? (
                      <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', fontSize: 10.5, color: 'var(--text-dim)' }}>
                        <Icon name="refresh" size={12} /> <strong style={{ color: 'var(--text)' }}>Ran {turn.type}</strong>
                      </span>
                    ) : (
                      <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-dim)', fontWeight: 700 }}>
                        {turn.role}
                      </span>
                    )}
                    <span className={tone === 'ok' ? 'pill pill-live' : 'pill pill-danger'} data-testid={`obs-replay-status-${turn.id}`}>
                      {turn.ok ? '✓ ok' : '✗ failed'}
                    </span>
                    <span className="chip chip-mono" style={{ fontSize: 10 }}>{turn.ms} ms</span>
                    <span className="chip" style={{ fontSize: 10 }}>{turn.category === 'agent' ? 'Agent' : 'Internal'}</span>
                    {(turn.tokensIn ?? 0) + (turn.tokensOut ?? 0) > 0 && (
                      <span className="chip chip-mono" style={{ fontSize: 10 }}>{(turn.tokensIn ?? 0) + (turn.tokensOut ?? 0)} tok</span>
                    )}
                    <span className="chip-mono" style={{ fontSize: 10, color: 'var(--text-dim)' }}>{formatTime(turn.ts)}</span>
                  </span>
                  <span style={{ fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{turn.text}</span>
                  <span className="chip-mono" style={{ display: 'none' }}>{statusChipLabel(turn)}</span>
                </button>
              )
            })}
            {replayTurns.length === 0 && (
              <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: 12 }}>No turns match the current filters.</p>
            )}
          </div>
        ) : (
          <pre
            data-testid="observability-replay-raw"
            aria-label="Replay raw JSON"
            style={{
              margin: 0,
              maxHeight: 360,
              overflow: 'auto',
              padding: 10,
              borderRadius: 'var(--r-sm)',
              border: '1px solid var(--glass-border)',
              background: 'var(--glass-bg-strong)',
              fontFamily: 'var(--font-mono)',
              fontSize: 10.5,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              color: 'var(--text)',
            }}
          >
            {replayRaw}
          </pre>
        )}
      </section>

      {/* ——— Trace waterfall (FN-OBS-004) ——— */}
      <section className="glass panel" aria-label="Trace waterfall" data-testid="observability-waterfall">
        <div className="panel-title">
          <span>Trace waterfall · {visible.length} of {allEvents.length} spans</span>
          <span role="group" aria-label="Waterfall zoom" style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span className="chip chip-mono" data-testid="obs-waterfall-window">{waterfallZoom.start}–{waterfallZoom.end}%</span>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ padding: '2px 10px', fontSize: 12, fontWeight: 700 }}
              aria-label="Zoom in"
              data-testid="obs-waterfall-zoom-in"
              onClick={zoomIn}
            >
              +
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ padding: '2px 10px', fontSize: 12, fontWeight: 700 }}
              aria-label="Zoom out"
              data-testid="obs-waterfall-zoom-out"
              onClick={zoomOut}
            >
              −
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ padding: '2px 8px', fontSize: 10 }}
              aria-label="Reset zoom"
              data-testid="obs-waterfall-zoom-reset"
              onClick={resetZoom}
            >
              Reset
            </button>
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '2px 2px 4px' }}>
          {visible.map((span) => {
            const pos = projectSpan(span, waterfallZoom)
            const selected = selectedIds.has(span.id)
            const barBackground = span.isLlm ? 'var(--info)' : span.category === 'agent' ? 'var(--green-600)' : 'var(--text)'
            return (
              <div key={span.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  className="chip-mono"
                  title={`${span.type} · ${span.label}`}
                  style={{
                    width: 150,
                    flexShrink: 0,
                    fontSize: 10,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: 'var(--text-dim)',
                  }}
                >
                  {span.label}
                </span>
                <div
                  aria-hidden
                  style={{
                    position: 'relative',
                    flex: 1,
                    height: 16,
                    borderRadius: 'var(--r-xs)',
                    border: '1px solid var(--glass-border)',
                    background: 'var(--glass-bg-strong)',
                    overflow: 'hidden',
                  }}
                >
                  <button
                    type="button"
                    data-testid={`obs-span-${span.id}`}
                    data-category={span.category}
                    data-llm={span.isLlm ? 'true' : 'false'}
                    aria-label={`Span ${span.label} ${formatSpanDuration(span.ms)} ${span.ok ? 'ok' : 'failed'}${span.isLlm ? ', LLM' : ''} — click to filter`}
                    aria-pressed={selected}
                    onClick={() => onSpanSelect(span.id)}
                    style={{
                      position: 'absolute',
                      left: `${pos.left}%`,
                      top: 1,
                      bottom: 1,
                      width: `${Math.max(pos.width, 0.5)}%`,
                      minWidth: 6,
                      padding: 0,
                      border: selected ? '2px solid var(--green-glow)' : '1px solid var(--glass-border-strong)',
                      borderRadius: 3,
                      background: barBackground,
                      cursor: 'pointer',
                      boxShadow: selected ? 'var(--green-glow)' : 'none',
                      opacity: selectedIds.size === 0 || selected ? 1 : 0.35,
                    }}
                  />
                </div>
                <span className="chip-mono" style={{ width: 64, flexShrink: 0, fontSize: 10, color: 'var(--text-dim)', textAlign: 'right' }}>
                  {formatSpanDuration(span.ms)}
                </span>
              </div>
            )
          })}
          {visible.length === 0 && (
            <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: 12 }}>No spans match the current filters or zoom window.</p>
          )}
        </div>
        <p style={{ margin: '2px 0 0', color: 'var(--text-dim)', fontSize: 10 }}>
          <span>Click a span to filter the timeline · zoom narrows the session window · LLM spans use <code className="chip-mono">var(--info)</code></span>
        </p>
        {selectedSpan && (
          <div
            role="dialog"
            aria-label={`Span detail ${selectedSpan.label}`}
            data-testid="obs-waterfall-detail"
            style={{
              marginTop: 8,
              padding: '8px 10px',
              border: '1px solid var(--glass-border-strong)',
              borderRadius: 'var(--r-md)',
              background: 'var(--glass-bg-strong)',
              boxShadow: 'var(--green-glow)',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <strong style={{ fontSize: 11.5 }}>{selectedSpan.label}</strong>
              <button type="button" className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 10 }} aria-label="Close span detail" data-testid="obs-waterfall-detail-close" onClick={closeSpanDetail}>
                <Icon name="x" size={12} /> Close
              </button>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="chip chip-mono">{spanDetailText(selectedSpan)}</span>
              <span className="chip">{selectedSpan.category === 'agent' ? 'Agent' : 'Internal'}</span>
              {selectedSpan.isLlm && <span className="chip chip-mono">LLM</span>}
              <span className="chip-mono" style={{ fontSize: 10, color: 'var(--text-dim)' }}>{formatTime(selectedSpan.ts)}</span>
            </div>
            <span style={{ fontSize: 11.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{selectedSpan.payload}</span>
          </div>
        )}
      </section>

      {/* ——— Logs (FN-OBS-005, 6 columns) ——— */}
      <section className="glass panel" aria-label="Logs" data-testid="observability-logs" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="panel-title">
          <span>Logs · {logRows.length} of {allEvents.length}</span>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: '2px 8px', fontSize: 10 }}
            aria-label="Copy as JSON"
            data-testid="obs-log-copy"
            onClick={copyLogsAsJson}
          >
            <Icon name="doc" size={12} /> {logsCopied ? 'Copied ✓' : 'Copy as JSON'}
          </button>
        </div>
        <div style={{ padding: '0 2px 8px' }}>
          <input
            className="input"
            style={{ padding: '6px 10px' }}
            placeholder="Case-sensitive search with text or with * as wildcard"
            aria-label="Logs search"
            data-testid="obs-log-search"
            value={logQuery}
            onChange={(e) => { setLogQuery(e.target.value); logOp(`logs search=${e.target.value}`) }}
          />
        </div>
        <div style={{ overflow: 'auto', minHeight: 0, maxHeight: 420 }}>
          <table className="tbl" aria-label="Logs table">
            <thead>
              <tr>
                <th scope="col">TIMESTAMP</th>
                <th scope="col">MESSAGE</th>
                <th scope="col">CONTENT</th>
                <th scope="col">PRODUCING RESOURCE</th>
                <th scope="col">TAGS</th>
                <th scope="col">PARAMETERS</th>
              </tr>
            </thead>
            <tbody>
              {logRows.map((log) => (
                <tr
                  key={log.id}
                  data-testid={`obs-log-${log.id}`}
                  className={selectedIds.has(log.id) ? 'selected' : undefined}
                  onClick={() => onLogSelect(log.id)}
                  style={{ cursor: 'pointer' }}
                  title={`Click to filter · ${log.id}`}
                >
                  <td className="chip-mono" style={{ fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', fontSize: 10.5 }}>
                    {formatLogTimestamp(log.ts)}
                  </td>
                  <td style={{ whiteSpace: 'nowrap', fontSize: 11 }}>{log.message}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.content}>
                    {log.content}
                  </td>
                  <td style={{ whiteSpace: 'nowrap', fontSize: 11 }}>{log.resource}</td>
                  <td style={{ whiteSpace: 'nowrap', fontSize: 11 }} title={log.tags.join(', ')}>
                    {log.ok ? <span aria-label="info">ⓘ</span> : <span aria-label="error">✗</span>} {formatTags(log.tags)}
                  </td>
                  <td style={{ whiteSpace: 'nowrap', fontSize: 11, color: log.parameters === 0 ? 'var(--text-dim)' : undefined }}>
                    {formatParameters(log.parameters)}
                  </td>
                </tr>
              ))}
              {logRows.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ color: 'var(--text-dim)' }}>No logs match the current filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

export const observabilityModuleDefinition = {
  id: 'observability',
  label: 'Observability',
  hint: 'Session timeline + event table from the trace ledger',
  section: 'INSPECT' as const,
  layer: 'L3-FOUNDRY' as const,
  Component: ObservabilityModule,
}

export default ObservabilityModule
