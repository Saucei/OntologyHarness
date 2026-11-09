// Observability event model — FN-OBS-001 (timeline) + FN-OBS-002 (event table)
// + FN-OBS-003 (session replay Preview|Raw + status chips) + FN-OBS-004 (waterfall)
// + FN-OBS-005 (logs).
// Fed from the existing trace ledger (`appendTrace` in src/store.ts) and from
// exported `.ohtrace` files (JSON produced by SwarmsModule / future exporters).
// Pure helpers only — no store reads/writes here, so this file is trivially testable.
//
// Reference: corpus-2 session-debugging tile — diamond timeline (Agent blue /
// Internal dark, click-to-filter, ⌘-click multi, date chip) + event table
// (Time | Type | Updates ↻⚡ | Payload, Type filter, payload search) + split
// Session view (Preview | Raw toggle, chat bubbles, Ran <tool> lines) and
// corpus-2 session-logs tile — 6-column logs
// (Timestamp | Message | Content | Producing Resource | Tags | Parameters)
// with case-sensitive `*` wildcard search + Copy as JSON.
import type { Trace } from '../store'

export type EventCategory = 'agent' | 'internal'
export type EventKind = Trace['kind']

/** Agent-facing model reasoning: llm-call, agent-step, swarm-worker. */
export const AGENT_KINDS: readonly EventKind[] = ['llm-call', 'agent-step', 'swarm-worker']
/** Harness/tool execution: tool-call, preset-run. */
export const INTERNAL_KINDS: readonly EventKind[] = ['tool-call', 'preset-run']

export function categoryForKind(kind: EventKind): EventCategory {
  return (AGENT_KINDS as readonly string[]).includes(kind) ? 'agent' : 'internal'
}

export function isAgentKind(kind: EventKind): boolean {
  return categoryForKind(kind) === 'agent'
}

export interface BaseEvent {
  /** Stable row id, unique within a converted list. */
  id: string
  /** ISO timestamp (as stored on the Trace `at`). */
  at: string
  /** Epoch milliseconds parsed from `at` (0 when unparseable). */
  ts: number
  kind: EventKind
  category: EventCategory
  /** Display type: tool || worker || kind. */
  type: string
  /** Short human label for the timeline/table. */
  label: string
  /** Payload text: detail ?? tool/worker ?? JSON. */
  payload: string
  ok: boolean
  ms: number
  tokensIn?: number
  tokensOut?: number
  provider?: string
  model?: string
  taskClass?: string
  worker?: string
  tool?: string
  runId?: string
  runName?: string
  stepIdx?: number
}

export type AgentEvent = BaseEvent & { category: 'agent' }
export type InternalEvent = BaseEvent & { category: 'internal' }
export type EventRow = AgentEvent | InternalEvent

export function isAgentEvent(row: EventRow): row is AgentEvent {
  return row.category === 'agent'
}

export function isInternalEvent(row: EventRow): row is InternalEvent {
  return row.category === 'internal'
}

/** Map one ledger Trace to a display EventRow. `index` keeps ids stable. */
export function traceToEventRow(trace: Trace, index: number): EventRow {
  const at = trace.at ?? ''
  const ts = at ? Date.parse(at) : 0
  const kind = trace.kind
  const category = categoryForKind(kind)
  const type = trace.tool ?? trace.worker ?? kind
  const payload =
    trace.detail ??
    trace.tool ??
    trace.worker ??
    JSON.stringify(trace)
  const label = trace.runName ? `${trace.runName} · ${type}` : type
  const base: BaseEvent = {
    id: `ev-${Number.isFinite(ts) ? ts : 0}-${index}-${kind}`,
    at,
    ts: Number.isFinite(ts) ? ts : 0,
    kind,
    category,
    type,
    label,
    payload,
    ok: Boolean(trace.ok),
    ms: Number(trace.ms) || 0,
    tokensIn: trace.tokensIn,
    tokensOut: trace.tokensOut,
    provider: trace.provider,
    model: trace.model,
    taskClass: trace.taskClass,
    worker: trace.worker,
    tool: trace.tool,
    runId: trace.runId,
    runName: trace.runName,
    stepIdx: trace.stepIdx,
  }
  return base as EventRow
}

/** Convert ledger traces to rows sorted oldest → newest (timeline order). */
export function tracesToEvents(traces: readonly Trace[]): EventRow[] {
  return traces
    .map((t, i) => traceToEventRow(t, i))
    .sort((a, b) => (a.ts - b.ts) || a.id.localeCompare(b.id))
}

/**
 * Parse a `.ohtrace` payload: JSON string, `{ traces: [...] }`, `{ events: [...] }`,
 * or a bare array of traces. Invalid input yields `[]` (never throws) so the
 * timeline renders an empty state instead of crashing on a bad import.
 */
export function parseOhtrace(input: unknown): EventRow[] {
  let value: unknown = input
  if (typeof input === 'string') {
    const text = input.trim()
    if (!text) return []
    try {
      value = JSON.parse(text)
    } catch {
      return []
    }
  }
  if (!value || typeof value !== 'object') return []
  const arr: unknown[] = Array.isArray(value)
    ? (value as unknown[])
    : Array.isArray((value as { traces?: unknown }).traces)
      ? ((value as { traces: unknown[] }).traces as unknown[])
      : Array.isArray((value as { events?: unknown }).events)
        ? ((value as { events: unknown[] }).events as unknown[])
        : []
  const traces: Trace[] = []
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue
    const t = item as Record<string, unknown>
    const kind = t.kind
    if (typeof kind !== 'string') continue
    if (!['llm-call', 'swarm-worker', 'agent-step', 'tool-call', 'preset-run'].includes(kind)) continue
    traces.push({
      kind: kind as EventKind,
      ok: typeof t.ok === 'boolean' ? t.ok : true,
      ms: typeof t.ms === 'number' ? t.ms : 0,
      at: typeof t.at === 'string' ? t.at : undefined,
      provider: typeof t.provider === 'string' ? t.provider : undefined,
      model: typeof t.model === 'string' ? t.model : undefined,
      taskClass: typeof t.taskClass === 'string' ? t.taskClass : undefined,
      tokensIn: typeof t.tokensIn === 'number' ? t.tokensIn : undefined,
      tokensOut: typeof t.tokensOut === 'number' ? t.tokensOut : undefined,
      worker: typeof t.worker === 'string' ? t.worker : undefined,
      tool: typeof t.tool === 'string' ? t.tool : typeof t.type === 'string' && t.type !== kind ? t.type : undefined,
      detail: typeof t.detail === 'string' ? t.detail : typeof t.payload === 'string' ? t.payload : undefined,
      runId: typeof t.runId === 'string' ? t.runId : undefined,
      runName: typeof t.runName === 'string' ? t.runName : undefined,
      stepIdx: typeof t.stepIdx === 'number' ? t.stepIdx : undefined,
    } as Trace)
  }
  return tracesToEvents(traces)
}

/** Serialize rows for `.ohtrace` export (array form — parses with parseOhtrace). */
export function stringifyOhtrace(events: readonly EventRow[]): string {
  const traces = events.map((e) => ({
    kind: e.kind,
    ok: e.ok,
    ms: e.ms,
    at: e.at,
    detail: e.payload,
    ...(e.tool ? { tool: e.tool } : {}),
    ...(e.worker ? { worker: e.worker } : {}),
    ...(e.provider ? { provider: e.provider } : {}),
    ...(e.model ? { model: e.model } : {}),
    ...(e.taskClass ? { taskClass: e.taskClass } : {}),
    ...(e.tokensIn !== undefined ? { tokensIn: e.tokensIn } : {}),
    ...(e.tokensOut !== undefined ? { tokensOut: e.tokensOut } : {}),
    ...(e.runId ? { runId: e.runId } : {}),
    ...(e.runName ? { runName: e.runName } : {}),
    ...(e.stepIdx !== undefined ? { stepIdx: e.stepIdx } : {}),
  }))
  return JSON.stringify(traces, null, 2)
}

export interface EventFilter {
  /** Restrict to these categories; empty/undefined = both. */
  categories?: readonly EventCategory[]
  /** Restrict to these display types; empty/undefined = all. Entries may contain `*` wildcards. */
  types?: readonly string[]
  /** `*` wildcard pattern matched case-insensitively against the display type. */
  typePattern?: string
  /** Case-insensitive substring over type + payload + label. */
  query?: string
  /** Diamond selection: when non-empty it outranks categories/types. */
  selectedIds?: ReadonlySet<string> | readonly string[]
}

export function filterEvents(rows: readonly EventRow[], f: EventFilter = {}): EventRow[] {
  const input = f.selectedIds
  const selected: Set<string> = input
    ? input instanceof Set
      ? new Set<string>(input as ReadonlySet<string>)
      : new Set<string>(input as readonly string[])
    : new Set<string>()
  const q = (f.query ?? '').trim().toLowerCase()
  const hasWildcardTypes = !!f.types?.some((t) => t.includes('*'))
  const types = f.types && f.types.length && !hasWildcardTypes ? new Set(f.types) : null
  const wildcardTypes = f.types && f.types.length && hasWildcardTypes ? [...f.types] : null
  const pattern = (f.typePattern ?? '').trim()
  const cats = f.categories && f.categories.length ? new Set(f.categories) : null
  return rows.filter((r) => {
    if (selected.size > 0) return selected.has(r.id)
    if (cats && !cats.has(r.category)) return false
    if (types && !types.has(r.type)) return false
    if (wildcardTypes && !wildcardTypes.some((t) => wildcardMatch(r.type, t))) return false
    if (pattern && !wildcardMatch(r.type, pattern)) return false
    if (q) {
      const hay = `${r.type} ${r.payload} ${r.label}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}

/** Distinct display types in first-seen order (for the Type filter select). */
export function listEventTypes(rows: readonly EventRow[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const r of rows) {
    if (!seen.has(r.type)) {
      seen.add(r.type)
      out.push(r.type)
    }
  }
  return out.sort()
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function dayLabel(ts: number): string {
  const d = new Date(ts)
  return `${d.getDate()} ${MONTHS[d.getMonth()] ?? ''} ${d.getFullYear()}`
}

/** Date chip text: single day or inclusive range + count. */
export function dateChipLabel(rows: readonly EventRow[]): string {
  if (!rows.length) return 'No events'
  const stamps = rows.map((r) => r.ts).filter((t) => t > 0)
  const count = `${rows.length} event${rows.length === 1 ? '' : 's'}`
  if (!stamps.length) return count
  const lo = Math.min(...stamps)
  const hi = Math.max(...stamps)
  if (lo === hi || dayLabel(lo) === dayLabel(hi)) return `${dayLabel(lo)} · ${count}`
  return `${dayLabel(lo)} – ${dayLabel(hi)} · ${count}`
}

/** HH:MM:SS local time for the Time column. */
export function formatTime(ts: number): string {
  if (!ts) return '—'
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

export interface TimelineDot {
  id: string
  /** 0–100 percent along the track. */
  left: number
  category: EventCategory
  label: string
}

/** Even timeline positions for diamonds; identical stamps spread evenly. */
export function timelinePositions(rows: readonly EventRow[]): TimelineDot[] {
  if (!rows.length) return []
  const stamps = rows.map((r) => r.ts)
  const lo = Math.min(...stamps)
  const hi = Math.max(...stamps)
  const span = hi - lo
  return rows.map((r, i) => {
    const left = span > 0
      ? Math.round(((r.ts - lo) / span) * 100 * 100) / 100
      : rows.length === 1 ? 50 : Math.round((i / (rows.length - 1)) * 100 * 100) / 100
    return { id: r.id, left, category: r.category, label: r.label }
  })
}

/**
 * Updates cell text (↻ = retry/failed, ⚡ = fast path). Deterministic so tests
 * can pin it: !ok → "↻ 1"; ok && ms < 50 → "⚡ fast"; otherwise "—".
 */
export function formatUpdates(row: EventRow): string {
  if (!row.ok) return '↻ 1'
  if (row.ms > 0 && row.ms < 50) return '⚡ fast'
  return '—'
}

/**
 * Diamond click reducer: plain click selects a single id (or clears when the
 * same id is clicked alone); ⌘/Ctrl-click adds/removes one id (multi-select).
 */
export function toggleSelection(selected: ReadonlySet<string>, id: string, additive: boolean): Set<string> {
  const next = new Set(selected)
  if (additive) {
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  }
  if (next.size === 1 && next.has(id)) return new Set()
  return new Set([id])
}

/* ── FN-OBS-005: `*` wildcard matching ──────────────────────────────────── */

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * `*` wildcard match: `*` matches any run of characters (including empty).
 * Without `*` this is a substring search. Case-insensitive by default so the
 * Type filter matches what users type; pass `caseSensitive: true` for the
 * Logs search (corpus-2 session-logs tile: "Case-sensitive … with *").
 */
export function wildcardMatch(haystack: string, pattern: string, opts: { caseSensitive?: boolean } = {}): boolean {
  const needle = pattern.trim()
  if (!needle) return true
  const caseSensitive = opts.caseSensitive ?? false
  if (!needle.includes('*')) {
    return caseSensitive
      ? haystack.includes(needle)
      : haystack.toLowerCase().includes(needle.toLowerCase())
  }
  const source = needle.split('*').map(escapeRegExp).join('.*')
  const re = new RegExp(source, caseSensitive ? '' : 'i')
  return re.test(haystack)
}

/* ── FN-OBS-003: session replay ─────────────────────────────────────────── */

export type ReplayRole = 'assistant' | 'tool' | 'system' | 'user'

export interface ReplayTurn {
  /** Same stable id as the source EventRow. */
  id: string
  role: ReplayRole
  text: string
  kind: EventKind
  /** Display type (tool || worker || kind) for the `Ran …` / chip labels. */
  type: string
  category: EventCategory
  ok: boolean
  ms: number
  at: string
  ts: number
  tokensIn?: number
  tokensOut?: number
  runName?: string
}

/** Map one EventRow to a replay turn (tool rows become `tool`, others `assistant`). */
export function eventToReplayTurn(row: EventRow): ReplayTurn {
  const role: ReplayRole =
    row.kind === 'tool-call'
      ? 'tool'
      : row.kind === 'preset-run'
        ? 'system'
        : 'assistant'
  const text = row.payload
  return {
    id: row.id,
    role,
    text,
    kind: row.kind,
    type: row.type,
    category: row.category,
    ok: row.ok,
    ms: row.ms,
    at: row.at,
    ts: row.ts,
    tokensIn: row.tokensIn,
    tokensOut: row.tokensOut,
    runName: row.runName,
  }
}

/** Convert (already filtered) rows to replay turns, oldest → newest. */
export function eventsToReplay(rows: readonly EventRow[]): ReplayTurn[] {
  return [...rows]
    .sort((a, b) => (a.ts - b.ts) || a.id.localeCompare(b.id))
    .map(eventToReplayTurn)
}

/** Status chip label for a replay turn / event row. */
export function statusChipLabel(input: { ok: boolean; ms: number; tokensIn?: number; tokensOut?: number }): string {
  const tokens = (input.tokensIn ?? 0) + (input.tokensOut ?? 0)
  const base = input.ok ? '✓ ok' : '✗ failed'
  const ms = `· ${input.ms} ms`
  return tokens > 0 ? `${base}${ms} · ${tokens} tok` : `${base}${ms}`
}

/** Status chip tone token for CSS classes (`pill-live` / `pill-danger`). */
export function statusChipTone(ok: boolean): 'ok' | 'error' {
  return ok ? 'ok' : 'error'
}

/** Pretty-printed Raw payload for the replay Raw view. */
export function replayRawText(rows: readonly EventRow[]): string {
  return JSON.stringify(rows, null, 2)
}

/** Replay / Raw view mode. */
export type ReplayMode = 'preview' | 'raw'

/* ── FN-OBS-005: logs (6 columns) ───────────────────────────────────────── */

export interface LogRow {
  /** Same stable id as the source EventRow. */
  id: string
  /** ISO timestamp (source `at`). */
  at: string
  ts: number
  /** MESSAGE column: display type. */
  message: string
  /** CONTENT column: payload text. */
  content: string
  /** PRODUCING RESOURCE column: model || runName || tool || worker || type. */
  resource: string
  /** TAGS column. */
  tags: string[]
  /** PARAMETERS column count (JSON keys). */
  parameters: number
  ok: boolean
  ms: number
  category: EventCategory
  type: string
}

/** Count "parameters": top-level JSON object keys / array length, else 0 → `None`. */
export function countParameters(payload: string): number {
  const text = (payload ?? '').trim()
  if (!text) return 0
  try {
    const parsed: unknown = JSON.parse(text)
    if (Array.isArray(parsed)) return parsed.length
    if (parsed && typeof parsed === 'object') return Object.keys(parsed as Record<string, unknown>).length
    return 0
  } catch {
    return 0
  }
}

/** Parameters cell text: `None` / `1 parameter` / `N parameters`. */
export function formatParameters(n: number): string {
  if (n <= 0) return 'None'
  return n === 1 ? '1 parameter' : `${n} parameters`
}

/** Produce the "N tags" cell text for the TAGS column. */
export function formatTags(tags: readonly string[]): string {
  return `${tags.length === 1 ? '1 tag' : `${tags.length} tags`}`
}

/** Map one EventRow to a LogRow (reuses T-12 rows, no new schema). */
export function eventToLogRow(row: EventRow): LogRow {
  const resource =
    row.model ??
    row.runName ??
    row.tool ??
    row.worker ??
    row.type
  return {
    id: row.id,
    at: row.at,
    ts: row.ts,
    message: row.type,
    content: row.payload,
    resource,
    tags: [row.category, row.kind, row.ok ? 'ok' : 'error'],
    parameters: countParameters(row.payload),
    ok: row.ok,
    ms: row.ms,
    category: row.category,
    type: row.type,
  }
}

/** Convert rows to log rows (same order as input). */
export function eventsToLogs(rows: readonly EventRow[]): LogRow[] {
  return rows.map(eventToLogRow)
}

/**
 * Logs search: case-sensitive `*` wildcard over message + content + resource
 * (corpus-2 session-logs placeholder). Empty pattern returns all rows.
 */
export function filterLogRows(logs: readonly LogRow[], pattern: string): LogRow[] {
  const needle = (pattern ?? '').trim()
  if (!needle) return [...logs]
  const opts = { caseSensitive: true }
  return logs.filter((log) =>
    wildcardMatch(log.message, needle, opts)
    || wildcardMatch(log.content, needle, opts)
    || wildcardMatch(log.resource, needle, opts)
  )
}

/** JSON for a single log row ("Copy as JSON" per-row). */
export function logRowToJson(log: LogRow): string {
  return JSON.stringify(log, null, 2)
}

/** JSON array for the visible logs ("Copy as JSON" bulk). */
export function logsToJson(logs: readonly LogRow[]): string {
  return JSON.stringify([...logs], null, 2)
}

/** `Oct 5, 2026, 11:16:38 AM` style timestamp for the TIMESTAMP column. */
export function formatLogTimestamp(ts: number): string {
  if (!ts) return '—'
  const d = new Date(ts)
  const months = MONTHS
  const h = d.getHours()
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  const p = (n: number) => String(n).padStart(2, '0')
  return `${months[d.getMonth()] ?? ''} ${d.getDate()}, ${d.getFullYear()}, ${h12}:${p(d.getMinutes())}:${p(d.getSeconds())} ${ampm}`
}

/**
 * Copy text via `navigator.clipboard.writeText` with a textarea fallback.
 * Returns true when the copy appears to have succeeded.
 */
export async function copyTextWithFallback(text: string, env?: {
  clipboard?: { writeText: (t: string) => Promise<void> }
  document?: Document
  navigator?: Navigator
}): Promise<boolean> {
  const nav = env?.navigator ?? (typeof navigator !== 'undefined' ? navigator : undefined)
  const clip = env?.clipboard ?? (nav as Navigator | undefined)?.clipboard
  if (clip && typeof clip.writeText === 'function') {
    try {
      await clip.writeText(text)
      return true
    } catch {
      /* fall through to the execCommand fallback */
    }
  }
  const doc = env?.document ?? (typeof document !== 'undefined' ? document : undefined)
  if (!doc || typeof doc.createElement !== 'function') return false
  try {
    const ta = doc.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    doc.body.appendChild(ta)
    ta.select()
    const ok = typeof doc.execCommand === 'function' ? doc.execCommand('copy') : false
    ta.remove()
    return ok
  } catch {
    return false
  }
}

/* ── FN-OBS-004: trace waterfall ────────────────────────────────────────── */

/** Span bar derived from one EventRow, scaled to the session duration. */
export interface SpanBar {
  /** Same stable id as the source EventRow. */
  id: string
  label: string
  /** Display type (tool || worker || kind) — waterfall row label. */
  type: string
  kind: EventKind
  category: EventCategory
  ok: boolean
  ms: number
  ts: number
  at: string
  payload: string
  /** Offset from session start, in milliseconds. */
  startMs: number
  /** Duration in milliseconds (source `ms`). */
  durationMs: number
  /** Left edge as 0–100 % of the session duration. */
  left: number
  /** Width as % of the session duration (`ms / duration * 100`). */
  width: number
  /** True for `llm-call` spans (colored via `var(--info)` in the renderer). */
  isLlm: boolean
  tokensIn?: number
  tokensOut?: number
  model?: string
  provider?: string
  runName?: string
}

/** Waterfall zoom window in session-percent coordinates (0–100). */
export interface WaterfallWindow {
  start: number
  end: number
}

export const FULL_WATERFALL_WINDOW: WaterfallWindow = { start: 0, end: 100 }
export const MIN_WATERFALL_WINDOW_WIDTH = 5

function roundPercent(n: number): number {
  return Math.round(n * 100) / 100
}

/** True for LLM-kind events (`llm-call`) — the colored waterfall spans. */
export function isLlmKind(kind: EventKind): boolean {
  return kind === 'llm-call'
}

/** True when the row should render as an LLM span. */
export function spanIsLlm(row: Pick<EventRow, 'kind'>): boolean {
  return isLlmKind(row.kind)
}

/** Session duration in ms: last end (`ts + ms`) − first start (`ts`), or 0. */
export function sessionDurationMs(rows: readonly EventRow[]): number {
  if (!rows.length) return 0
  const lo = Math.min(...rows.map((r) => r.ts))
  const hi = Math.max(...rows.map((r) => r.ts + r.ms))
  return Math.max(0, hi - lo)
}

/**
 * Convert (already filtered) rows to waterfall spans, oldest → newest.
 * `left`/`width` are percentages of the session duration, so a span that
 * starts halfway and lasts half the session renders at left 50 / width 50.
 */
export function eventsToSpans(rows: readonly EventRow[]): SpanBar[] {
  if (!rows.length) return []
  const sorted = [...rows].sort((a, b) => (a.ts - b.ts) || a.id.localeCompare(b.id))
  const lo = Math.min(...sorted.map((r) => r.ts))
  const hi = Math.max(...sorted.map((r) => r.ts + r.ms))
  const duration = hi - lo
  return sorted.map((row, i) => {
    let left: number
    let width: number
    if (duration > 0) {
      left = roundPercent(((row.ts - lo) / duration) * 100)
      width = roundPercent((row.ms / duration) * 100)
    } else if (sorted.length === 1) {
      left = 0
      width = 100
    } else {
      left = roundPercent((i / (sorted.length - 1)) * 100)
      width = 0
    }
    return {
      id: row.id,
      label: row.label,
      type: row.type,
      kind: row.kind,
      category: row.category,
      ok: row.ok,
      ms: row.ms,
      ts: row.ts,
      at: row.at,
      payload: row.payload,
      startMs: Math.max(0, row.ts - lo),
      durationMs: row.ms,
      left,
      width,
      isLlm: spanIsLlm(row),
      tokensIn: row.tokensIn,
      tokensOut: row.tokensOut,
      model: row.model,
      provider: row.provider,
      runName: row.runName,
    }
  })
}

/** Clamp a zoom window to 0–100 with a minimum visible width. */
export function clampWaterfallWindow(window: WaterfallWindow): WaterfallWindow {
  let start = window.start
  let end = window.end
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return { ...FULL_WATERFALL_WINDOW }
  }
  start = Math.min(100, Math.max(0, start))
  end = Math.min(100, Math.max(0, end))
  if (end <= start) return { ...FULL_WATERFALL_WINDOW }
  const width = end - start
  if (width < MIN_WATERFALL_WINDOW_WIDTH) {
    const center = (start + end) / 2
    start = center - MIN_WATERFALL_WINDOW_WIDTH / 2
    end = center + MIN_WATERFALL_WINDOW_WIDTH / 2
    if (start < 0) {
      end -= start
      start = 0
    }
    if (end > 100) {
      start -= end - 100
      end = 100
    }
  }
  return { start: roundPercent(start), end: roundPercent(end) }
}

/** Zoom by `factor` around the window centre: factor > 1 zooms in, < 1 out. */
export function zoomWaterfall(window: WaterfallWindow, factor: number): WaterfallWindow {
  const current = clampWaterfallWindow(window)
  if (!Number.isFinite(factor) || factor <= 0) return current
  const width = current.end - current.start
  const nextWidth = Math.min(100, Math.max(MIN_WATERFALL_WINDOW_WIDTH, width / factor))
  const center = (current.start + current.end) / 2
  let start = center - nextWidth / 2
  let end = center + nextWidth / 2
  if (start < 0) {
    end -= start
    start = 0
  }
  if (end > 100) {
    start -= end - 100
    end = 100
  }
  return clampWaterfallWindow({ start, end })
}

/** Zoom in 2× around the centre (narrower window). */
export function zoomInWaterfall(window: WaterfallWindow): WaterfallWindow {
  return zoomWaterfall(window, 2)
}

/** Zoom out 2× around the centre (wider window, capped at full). */
export function zoomOutWaterfall(window: WaterfallWindow): WaterfallWindow {
  return zoomWaterfall(window, 0.5)
}

/** Reset zoom to the full session window. */
export function resetWaterfallZoom(): WaterfallWindow {
  return { ...FULL_WATERFALL_WINDOW }
}

/**
 * Project a span into the zoom window. Returns display percentages
 * (0–100 within the visible track) and whether the span overlaps the window.
 */
export function projectSpan(
  span: Pick<SpanBar, 'left' | 'width'>,
  window: WaterfallWindow,
): { left: number; width: number; visible: boolean } {
  const w = clampWaterfallWindow(window)
  const spanWidth = w.end - w.start
  const visible = span.left < w.end && span.left + Math.max(span.width, 0) >= w.start && (span.width > 0
    ? span.left + span.width > w.start
    : span.left >= w.start)
  const rawLeft = ((span.left - w.start) / spanWidth) * 100
  const rawWidth = (span.width / spanWidth) * 100
  const left = Math.min(100, Math.max(0, rawLeft))
  const width = visible ? Math.min(100 - left, Math.max(0, rawWidth)) : 0
  return { left: roundPercent(left), width: roundPercent(Math.max(0, width)), visible }
}

/** Spans that overlap the zoom window (in session order). */
export function visibleSpans(
  spans: readonly SpanBar[],
  window: WaterfallWindow,
): SpanBar[] {
  return spans.filter((span) => projectSpan(span, window).visible)
}

/** Duration cell text for a span (`"120 ms"`). */
export function formatSpanDuration(ms: number): string {
  return `${ms} ms`
}

/** One-line detail summary for the span popover (`type · ms · ✓ ok`). */
export function spanDetailText(span: SpanBar): string {
  const tokens = (span.tokensIn ?? 0) + (span.tokensOut ?? 0)
  const base = `${span.type} · ${formatSpanDuration(span.ms)} · ${span.ok ? '✓ ok' : '✗ failed'}`
  return tokens > 0 ? `${base} · ${tokens} tok` : base
}
