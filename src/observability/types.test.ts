// FN-OBS-001 / FN-OBS-002 helpers: classification, conversion, filter, parse, chip.
// + FN-OBS-003 (replay Preview|Raw) / FN-OBS-005 (logs + `*` wildcard).
import { describe, it, expect } from 'vitest'
import {
  categoryForKind,
  tracesToEvents,
  filterEvents,
  parseOhtrace,
  stringifyOhtrace,
  dateChipLabel,
  timelinePositions,
  toggleSelection,
  formatUpdates,
  listEventTypes,
  wildcardMatch,
  eventsToReplay,
  statusChipLabel,
  replayRawText,
  eventsToLogs,
  filterLogRows,
  logsToJson,
  logRowToJson,
  countParameters,
  formatParameters,
  formatLogTimestamp,
  copyTextWithFallback,
  eventsToSpans,
  isLlmKind,
  sessionDurationMs,
  clampWaterfallWindow,
  zoomInWaterfall,
  zoomOutWaterfall,
  resetWaterfallZoom,
  projectSpan,
  visibleSpans,
  formatSpanDuration,
  spanDetailText,
  FULL_WATERFALL_WINDOW,
} from './types'
import type { Trace } from '../store'

const T0 = new Date(2025, 9, 8, 16, 19, 52).toISOString()

function trace(partial: Partial<Trace> & { kind: Trace['kind'] }): Trace {
  return { ok: true, ms: 10, at: T0, ...partial } as Trace
}

describe('observability classification (Agent vs Internal)', () => {
  it('routes llm-call/agent-step/swarm-worker to agent and tool/preset to internal', () => {
    expect(categoryForKind('llm-call')).toBe('agent')
    expect(categoryForKind('agent-step')).toBe('agent')
    expect(categoryForKind('swarm-worker')).toBe('agent')
    expect(categoryForKind('tool-call')).toBe('internal')
    expect(categoryForKind('preset-run')).toBe('internal')
  })

  it('converts traces to sorted EventRows with stable ids, types and payloads', () => {
    const rows = tracesToEvents([
      trace({ kind: 'tool-call', tool: 'map.canvas.select', detail: 'mp-1', at: new Date(2025, 9, 8, 16, 20, 0).toISOString(), ms: 3 }),
      trace({ kind: 'llm-call', model: 'm', detail: 'hello', at: new Date(2025, 9, 8, 16, 19, 0).toISOString(), ms: 120 }),
    ])
    expect(rows).toHaveLength(2)
    // sorted oldest first
    expect(rows[0].kind).toBe('llm-call')
    expect(rows[0].category).toBe('agent')
    expect(rows[1].category).toBe('internal')
    expect(rows[1].type).toBe('map.canvas.select')
    expect(rows[1].payload).toBe('mp-1')
    expect(rows[0].id).toMatch(/^ev-\d+-\d+-llm-call$/)
  })

  it('filters by selected diamond ids, then category/type/query', () => {
    const rows = tracesToEvents([
      trace({ kind: 'llm-call', detail: 'grounding ok', at: T0 }),
      trace({ kind: 'tool-call', tool: 'data.import', detail: 'rows=42', at: T0 }),
    ])
    const agentOnly = filterEvents(rows, { categories: ['agent'] })
    expect(agentOnly).toHaveLength(1)
    expect(agentOnly[0].kind).toBe('llm-call')
    const searched = filterEvents(rows, { query: 'rows=42' })
    expect(searched).toHaveLength(1)
    expect(searched[0].type).toBe('data.import')
    const typed = filterEvents(rows, { types: ['data.import'] })
    expect(typed).toHaveLength(1)
    const picked = filterEvents(rows, { selectedIds: new Set([rows[1].id]), categories: ['agent'] })
    expect(picked.map((r) => r.id)).toEqual([rows[1].id])
    expect(listEventTypes(rows)).toEqual(['data.import', 'llm-call'])
  })
})

describe('ohtrace parse/serialize round-trip', () => {
  it('parses JSON string, { traces }, and bare arrays; invalid → []', () => {
    const traces = [trace({ kind: 'tool-call', tool: 'x.y', detail: 'hi' })]
    expect(parseOhtrace(JSON.stringify(traces))).toHaveLength(1)
    expect(parseOhtrace({ traces })).toHaveLength(1)
    expect(parseOhtrace(traces)).toHaveLength(1)
    expect(parseOhtrace('not json')).toEqual([])
    expect(parseOhtrace(null)).toEqual([])
    expect(parseOhtrace([{ kind: 'bogus' }])).toEqual([])
  })

  it('stringify → parse preserves count and payload', () => {
    const rows = tracesToEvents([trace({ kind: 'agent-step', detail: 'step one' })])
    const text = stringifyOhtrace(rows)
    const back = parseOhtrace(text)
    expect(back).toHaveLength(1)
    expect(back[0].payload).toBe('step one')
  })
})

describe('timeline + chip + updates helpers', () => {
  it('date chip covers empty, single-day and range cases', () => {
    expect(dateChipLabel([])).toBe('No events')
    const one = tracesToEvents([trace({ kind: 'agent-step', at: new Date(2025, 9, 8, 16, 19).toISOString() })])
    expect(dateChipLabel(one)).toMatch(/8 Oct 2025 · 1 event/)
    const two = tracesToEvents([
      trace({ kind: 'agent-step', at: new Date(2025, 9, 8).toISOString() }),
      trace({ kind: 'tool-call', tool: 'a.b', at: new Date(2025, 9, 9).toISOString() }),
    ])
    expect(dateChipLabel(two)).toContain('2 events')
  })

  it('timeline positions map time to 0–100 and spread identical stamps', () => {
    const rows = tracesToEvents([
      trace({ kind: 'agent-step', at: new Date(2025, 9, 8, 16, 0, 0).toISOString() }),
      trace({ kind: 'tool-call', tool: 'a.b', at: new Date(2025, 9, 8, 16, 0, 10).toISOString() }),
    ])
    const dots = timelinePositions(rows)
    expect(dots.map((d) => d.left)).toEqual([0, 100])
    const same = tracesToEvents([
      trace({ kind: 'agent-step', at: T0 }),
      trace({ kind: 'tool-call', tool: 'a.b', at: T0 }),
      trace({ kind: 'llm-call', at: T0 }),
    ])
    expect(timelinePositions(same).map((d) => d.left)).toEqual([0, 50, 100])
  })

  it('formatUpdates marks retries and fast paths', () => {
    const failed = tracesToEvents([trace({ kind: 'llm-call', ok: false, ms: 10 })])[0]
    const fast = tracesToEvents([trace({ kind: 'tool-call', tool: 'a.b', ok: true, ms: 5 })])[0]
    const slow = tracesToEvents([trace({ kind: 'llm-call', ok: true, ms: 500 })])[0]
    expect(formatUpdates(failed)).toBe('↻ 1')
    expect(formatUpdates(fast)).toBe('⚡ fast')
    expect(formatUpdates(slow)).toBe('—')
  })

  it('toggleSelection implements plain click and ⌘-click multi', () => {
    const one = toggleSelection(new Set(), 'a', false)
    expect([...one]).toEqual(['a'])
    const cleared = toggleSelection(one, 'a', false)
    expect(cleared.size).toBe(0)
    const multi = toggleSelection(one, 'b', true)
    expect([...multi].sort()).toEqual(['a', 'b'])
    const removed = toggleSelection(multi, 'a', true)
    expect([...removed]).toEqual(['b'])
  })
})

describe('FN-OBS-005 wildcardMatch + typePattern', () => {
  it('matches * wildcards and plain substrings (case-insensitive by default)', () => {
    expect(wildcardMatch('data.import', '*import*')).toBe(true)
    expect(wildcardMatch('data.import', 'data.*')).toBe(true)
    expect(wildcardMatch('data.import', '*.export')).toBe(false)
    expect(wildcardMatch('data.import', 'import')).toBe(true)
    expect(wildcardMatch('data.import', 'DATA.*')).toBe(true)
    expect(wildcardMatch('data.import', 'DATA.*', { caseSensitive: true })).toBe(false)
    expect(wildcardMatch('ctx.run completed', 'ctx*', { caseSensitive: true })).toBe(true)
    expect(wildcardMatch('ctx.run completed', '*completed', { caseSensitive: true })).toBe(true)
  })

  it('filterEvents applies typePattern wildcards', () => {
    const rows = tracesToEvents([
      trace({ kind: 'tool-call', tool: 'data.import', detail: 'a' }),
      trace({ kind: 'tool-call', tool: 'data.export', detail: 'b' }),
      trace({ kind: 'llm-call', detail: 'c' }),
    ])
    expect(filterEvents(rows, { typePattern: 'data.*' })).toHaveLength(2)
    expect(filterEvents(rows, { typePattern: '*import*' })).toHaveLength(1)
    expect(filterEvents(rows, { typePattern: '' })).toHaveLength(3)
    // types list entries may also carry `*` wildcards
    expect(filterEvents(rows, { types: ['data.*'] })).toHaveLength(2)
  })
})

describe('FN-OBS-003 replay (Preview turns + Raw + status chips)', () => {
  it('maps tool rows to tool turns and keeps payload text', () => {
    const rows = tracesToEvents([
      trace({ kind: 'llm-call', detail: 'hello', at: new Date(2025, 9, 8, 16, 19, 0).toISOString(), ms: 120 }),
      trace({ kind: 'tool-call', tool: 'data.import', detail: 'rows=42', at: new Date(2025, 9, 8, 16, 20, 0).toISOString(), ms: 5 }),
      trace({ kind: 'preset-run', detail: 'preset p1', at: new Date(2025, 9, 8, 16, 22, 0).toISOString(), ms: 40 }),
    ])
    const turns = eventsToReplay(rows)
    expect(turns).toHaveLength(3)
    expect(turns.map((t) => t.role)).toEqual(['assistant', 'tool', 'system'])
    expect(turns[1].text).toBe('rows=42')
    expect(turns[1].type).toBe('data.import')
    expect(turns[0].id).toBe(rows[0].id)
  })

  it('status chips + Raw text reflect ok/ms/tokens', () => {
    const rows = tracesToEvents([
      trace({ kind: 'llm-call', ok: false, ms: 200, tokensIn: 10, tokensOut: 5, detail: 'x' }),
      trace({ kind: 'llm-call', ok: true, ms: 30, detail: 'y' }),
    ])
    expect(statusChipLabel(rows[0])).toContain('✗ failed')
    expect(statusChipLabel(rows[0])).toContain('200 ms')
    expect(statusChipLabel(rows[0])).toContain('15 tok')
    expect(statusChipLabel(rows[1])).toContain('✓ ok')
    const raw = replayRawText(rows)
    expect(() => JSON.parse(raw)).not.toThrow()
    expect(JSON.parse(raw)).toHaveLength(2)
  })
})

describe('FN-OBS-005 logs (6 columns + search + JSON)', () => {
  it('maps EventRows to 6-column LogRows with resource/tags/parameters', () => {
    const rows = tracesToEvents([
      trace({ kind: 'tool-call', tool: 'ctx.run', detail: '{"a":1,"b":2}', model: 'm1', at: T0 }),
      trace({ kind: 'llm-call', detail: 'plain text', at: T0 }),
    ])
    const logs = eventsToLogs(rows)
    expect(logs).toHaveLength(2)
    // Timestamp/Resource/Tags/Parameters derivations
    expect(logs[0].message).toBe('ctx.run')
    expect(logs[0].content).toBe('{"a":1,"b":2}')
    expect(logs[0].resource).toBe('m1')
    expect(logs[0].tags).toContain('internal')
    expect(logs[0].parameters).toBe(2)
    expect(formatParameters(0)).toBe('None')
    expect(countParameters('not json')).toBe(0)
    expect(logs[1].parameters).toBe(0)
    expect(formatLogTimestamp(logs[0].ts)).toContain('2025')
  })

  it('filterLogRows is case-sensitive with * wildcards', () => {
    const rows = tracesToEvents([
      trace({ kind: 'tool-call', tool: 'ctx.run', detail: 'ctx.run completed', at: T0 }),
      trace({ kind: 'llm-call', detail: 'Token usage', at: T0 }),
    ])
    const logs = eventsToLogs(rows)
    expect(filterLogRows(logs, 'ctx*')).toHaveLength(1)
    expect(filterLogRows(logs, '*completed')).toHaveLength(1)
    expect(filterLogRows(logs, 'token*')).toHaveLength(0) // case-sensitive: Token ≠ token
    expect(filterLogRows(logs, 'Token*')).toHaveLength(1)
    expect(filterLogRows(logs, '')).toHaveLength(2)
  })

  it('Copy as JSON helpers serialize single + bulk logs', () => {
    const rows = tracesToEvents([trace({ kind: 'tool-call', tool: 'a.b', detail: 'hi' })])
    const logs = eventsToLogs(rows)
    expect(JSON.parse(logRowToJson(logs[0])).message).toBe('a.b')
    const bulk = JSON.parse(logsToJson(logs))
    expect(bulk).toHaveLength(1)
    expect(bulk[0].id).toBe(logs[0].id)
  })

  it('copyTextWithFallback prefers the clipboard API', async () => {
    let written: string | null = null
    const ok = await copyTextWithFallback('{"a":1}', {
      clipboard: { writeText: async (t: string) => { written = t } },
      document: undefined as unknown as Document,
      navigator: undefined as unknown as Navigator,
    })
    expect(ok).toBe(true)
    expect(written).toBe('{"a":1}')
  })
})

describe('FN-OBS-004 waterfall spans (scaled to session duration)', () => {
  it('eventsToSpans scales left/width to session duration and flags LLM spans', () => {
    const rows = tracesToEvents([
      trace({ kind: 'llm-call', detail: 'hello', at: new Date(2025, 9, 8, 16, 0, 0, 0).toISOString(), ms: 100 }),
      trace({ kind: 'tool-call', tool: 'data.import', detail: 'rows=42', at: new Date(2025, 9, 8, 16, 0, 0, 50).toISOString(), ms: 50 }),
    ])
    // session = first start → last end = 0..100ms
    expect(sessionDurationMs(rows)).toBe(100)
    const spans = eventsToSpans(rows)
    expect(spans).toHaveLength(2)
    // spans carry the same stable ids as rows
    expect(spans.map((s) => s.id)).toEqual(rows.map((r) => r.id))
    expect(isLlmKind('llm-call')).toBe(true)
    expect(isLlmKind('tool-call')).toBe(false)
    expect(spans[0].isLlm).toBe(true)
    expect(spans[1].isLlm).toBe(false)
    // first span: starts at 0, lasts 100% of the session
    expect(spans[0].left).toBe(0)
    expect(spans[0].width).toBe(100)
    // second span: starts at 50%, lasts 50%
    expect(spans[1].left).toBe(50)
    expect(spans[1].width).toBe(50)
    expect(spans[1].startMs).toBe(50)
    expect(spans[1].durationMs).toBe(50)
  })

  it('zoom helpers clamp, zoom in/out around the centre, and reset to full', () => {
    const full = resetWaterfallZoom()
    expect(full).toEqual(FULL_WATERFALL_WINDOW)
    const zoomedIn = zoomInWaterfall(full)
    expect(zoomedIn.end - zoomedIn.start).toBeCloseTo(50, 1)
    expect(zoomedIn.start).toBeCloseTo(25, 1)
    expect(zoomedIn.end).toBeCloseTo(75, 1)
    // zooming back out restores the full window
    expect(zoomOutWaterfall(zoomedIn)).toEqual(full)
    // zooming out from full stays at full (capped)
    expect(zoomOutWaterfall(full)).toEqual(full)
    // invalid windows clamp to full, tiny windows expand to the minimum
    expect(clampWaterfallWindow({ start: 80, end: 20 })).toEqual(full)
    expect(clampWaterfallWindow({ start: -10, end: 200 })).toEqual(full)
    const tiny = clampWaterfallWindow({ start: 50, end: 51 })
    expect(tiny.end - tiny.start).toBeGreaterThanOrEqual(5)
    expect(tiny.start).toBeGreaterThanOrEqual(0)
    expect(tiny.end).toBeLessThanOrEqual(100)
  })

  it('projectSpan/visibleSpans honour the zoom window; detail helpers format duration + summary', () => {
    const rows = tracesToEvents([
      trace({ kind: 'agent-step', detail: 'step', at: new Date(2025, 9, 8, 16, 0, 0, 0).toISOString(), ms: 50 }),
      trace({ kind: 'llm-call', ok: false, detail: 'hello', tokensIn: 10, tokensOut: 5, at: new Date(2025, 9, 8, 16, 0, 0, 50).toISOString(), ms: 50 }),
    ])
    const spans = eventsToSpans(rows)
    // full window: identity projection
    expect(projectSpan(spans[0], FULL_WATERFALL_WINDOW)).toEqual({ left: 0, width: 50, visible: true })
    // zooming into the second half hides the first span, doubles the second
    const half = { start: 50, end: 100 }
    expect(visibleSpans(spans, half).map((s) => s.id)).toEqual([spans[1].id])
    const projected = projectSpan(spans[1], half)
    expect(projected.visible).toBe(true)
    expect(projected.left).toBe(0)
    expect(projected.width).toBe(100)
    expect(projectSpan(spans[0], half).visible).toBe(false)
    expect(formatSpanDuration(120)).toBe('120 ms')
    expect(spanDetailText(spans[1])).toContain('✗ failed')
    expect(spanDetailText(spans[1])).toContain('50 ms')
    expect(spanDetailText(spans[1])).toContain('15 tok')
    expect(spanDetailText(spans[0])).toContain('✓ ok')
  })

  it('single-span waterfall fills the track; empty input yields no spans', () => {
    expect(eventsToSpans([])).toEqual([])
    const rows = tracesToEvents([trace({ kind: 'llm-call', detail: 'only', ms: 200 })])
    const spans = eventsToSpans(rows)
    expect(spans).toHaveLength(1)
    expect(spans[0].left).toBe(0)
    expect(spans[0].width).toBe(100)
  })
})
