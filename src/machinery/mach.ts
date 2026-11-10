// Machinery state-transition analytics — core helpers + fixtures (FN-MCH-001/002/008).
// Pure, testable, no ReactFlow import. Tiles: corpus-2 machinery C19–C22
// (Patient Journey + Approval Process).
//
// Duration/count fields are additive: Lineage Graph data structures are
// untouched; machinery graphs carry duration/count as first-class fields.

export type MachineryFixtureId = 'patient-journey' | 'approval-process' | 'assembly-line'
export type MachineryMetric = 'historical-count' | 'current-count' | 'historical-duration'
export type MachineryNodeKind = 'state' | 'transition' | 'terminal-state'
export type NodeTone = 'terminal-ok' | 'sla-breach' | 'sla-warn' | 'in-progress' | 'neutral'
export type DurationTone = 'sla-breach' | 'sla-warn' | 'ok' | 'neutral'

export type MachineryNode = {
  id: string
  label: string
  kind: Exclude<MachineryNodeKind, 'transition'>
  terminal: boolean
  subprocess?: string | null
  durationDays?: number | null
  durationHours?: number | null
  historicalCount?: number | null
  currentCount?: number | null
}

export type MachineryEdge = {
  id: string
  source: string
  target: string
  durationDays?: number | null
  durationHours?: number | null
  count?: number | null
  currentCount?: number | null
}

export type MachineryFixture = {
  id: MachineryFixtureId
  title: string
  subtitle: string
  nodes: MachineryNode[]
  edges: MachineryEdge[]
  positions: Record<string, { x: number; y: number }>
}

export const MACHINERY_METRICS: Array<{ id: MachineryMetric; label: string }> = [
  { id: 'historical-count', label: 'Historical count' },
  { id: 'current-count', label: 'Current count' },
  { id: 'historical-duration', label: 'Historical duration' },
]
export const METRIC_ORDER: MachineryMetric[] = MACHINERY_METRICS.map(m => m.id)

/** Thresholds (days) for duration SLA tones — Patient tile: 103/40 → breach, 14 → warn, ≤7 → ok. */
export const SLA_WARN_DAYS = 10
export const SLA_BREACH_DAYS = 30

/* ── fixtures (corpus-2 tiles C19 Lead, C20–C22 Approval) ───────────────── */

const patientJourney: MachineryFixture = {
  id: 'patient-journey',
  title: 'Patient Journey',
  subtitle: 'Outpatient Activity [first] · duration-encoded state graph',
  nodes: [
    { id: 'referred', label: 'referred', kind: 'state', terminal: false, subprocess: null, durationDays: 103, durationHours: 103 * 24, historicalCount: 2480, currentCount: 312 },
    { id: 'on-waitlist', label: 'on waitlist', kind: 'state', terminal: false, subprocess: 'Outpatient Activity [first]', durationDays: 14, durationHours: 14 * 24, historicalCount: 2130, currentCount: 441 },
    { id: 'booked', label: 'booked', kind: 'state', terminal: false, subprocess: 'Outpatient Activity [first]', durationDays: 40, durationHours: 40 * 24, historicalCount: 2128, currentCount: 218 },
    { id: 'cancelled', label: 'cancelled', kind: 'terminal-state', terminal: true, subprocess: 'Outpatient Activity [first]', durationDays: 7, durationHours: 7 * 24, historicalCount: 318, currentCount: 318 },
    { id: 'attended', label: 'attended', kind: 'terminal-state', terminal: true, subprocess: 'Outpatient Activity [first]', durationDays: null, durationHours: null, historicalCount: null, currentCount: null },
    { id: 'did-not-attend', label: 'did not attend', kind: 'terminal-state', terminal: true, subprocess: 'Outpatient Activity [first]', durationDays: 4, durationHours: 4 * 24, historicalCount: 205, currentCount: 205 },
  ],
  edges: [
    { id: 'e-referred-waitlist', source: 'referred', target: 'on-waitlist', durationDays: null, count: null },
    { id: 'e-waitlist-booked', source: 'on-waitlist', target: 'booked', durationDays: 14, durationHours: 14 * 24, count: 2128 },
    { id: 'e-booked-cancelled', source: 'booked', target: 'cancelled', durationDays: 7, durationHours: 7 * 24, count: 84 },
    { id: 'e-booked-attended', source: 'booked', target: 'attended', durationDays: 40, durationHours: 40 * 24, count: 1210 },
    { id: 'e-booked-dna', source: 'booked', target: 'did-not-attend', durationDays: 40, durationHours: 40 * 24, count: 205 },
    { id: 'e-waitlist-dna', source: 'on-waitlist', target: 'did-not-attend', durationDays: 4, durationHours: 4 * 24, count: 41 },
  ],
  positions: {
    referred: { x: 0, y: 280 },
    'on-waitlist': { x: 540, y: 280 },
    booked: { x: 880, y: 280 },
    cancelled: { x: 1180, y: 60 },
    attended: { x: 1180, y: 210 },
    'did-not-attend': { x: 1180, y: 360 },
  },
}

const approvalProcess: MachineryFixture = {
  id: 'approval-process',
  title: 'Approval Process',
  subtitle: 'Draft → Submitted → In Review → Approved / Cancelled',
  nodes: [
    { id: 'draft', label: 'Draft', kind: 'state', terminal: false, durationHours: 43, durationDays: 43 / 24, historicalCount: 215, currentCount: 16 },
    { id: 'submitted', label: 'Submitted', kind: 'state', terminal: false, durationHours: 39, durationDays: 39 / 24, historicalCount: 175, currentCount: null },
    { id: 'in-review', label: 'In Review', kind: 'state', terminal: false, durationHours: 775, durationDays: 775 / 24, historicalCount: 162, currentCount: 96 },
    { id: 'cancelled', label: 'Cancelled', kind: 'terminal-state', terminal: true, durationHours: null, durationDays: null, historicalCount: 49, currentCount: 49 },
    { id: 'approved', label: 'Approved', kind: 'terminal-state', terminal: true, durationHours: null, durationDays: null, historicalCount: 58, currentCount: 58 },
  ],
  edges: [
    { id: 'e-draft-submitted', source: 'draft', target: 'submitted', durationHours: 39, durationDays: 39 / 24, count: 175 },
    { id: 'e-submitted-review', source: 'submitted', target: 'in-review', durationHours: 775, durationDays: 775 / 24, count: 162 },
    { id: 'e-review-approved', source: 'in-review', target: 'approved', durationHours: null, durationDays: null, count: 58 },
    { id: 'e-draft-cancelled', source: 'draft', target: 'cancelled', durationHours: null, durationDays: null, count: 24 },
    { id: 'e-submitted-cancelled', source: 'submitted', target: 'cancelled', durationHours: null, durationDays: null, count: 13 },
    { id: 'e-review-cancelled', source: 'in-review', target: 'cancelled', durationHours: null, durationDays: null, count: 8 },
  ],
  positions: {
    draft: { x: 0, y: 180 },
    submitted: { x: 380, y: 320 },
    'in-review': { x: 720, y: 380 },
    cancelled: { x: 1040, y: 220 },
    approved: { x: 1040, y: 460 },
  },
}

/** T-33 — researched production line (industry-typical automotive assembly figures). */
const assemblyLine: MachineryFixture = {
  id: 'assembly-line',
  title: 'Assembly Line',
  subtitle: 'Automotive assembly · unit flow @ ~950/day · industry-typical durations',
  nodes: [
    { id: 'stamped', label: 'Stamped Body', kind: 'state', terminal: false, durationHours: 0.5, historicalCount: 1000, currentCount: 42 },
    { id: 'welded', label: 'Body Weld', kind: 'state', terminal: false, durationHours: 1, historicalCount: 985, currentCount: 38 },
    { id: 'painted', label: 'Paint Shop', kind: 'state', terminal: false, durationHours: 9.5, historicalCount: 970, currentCount: 51 },
    { id: 'trimmed', label: 'Trim & Chassis', kind: 'state', terminal: false, durationHours: 1, historicalCount: 960, currentCount: 29 },
    { id: 'married', label: 'Final Assembly (Marriage)', kind: 'state', terminal: false, durationHours: 1.2, historicalCount: 955, currentCount: 18 },
    { id: 'tested', label: 'Test & Inspection', kind: 'state', terminal: false, durationHours: 0.3, historicalCount: 952, currentCount: 12 },
    { id: 'shipped', label: 'Shipped', kind: 'terminal-state', terminal: true, durationHours: null, historicalCount: 950, currentCount: 950 },
    { id: 'paint-rework', label: 'Paint Rework', kind: 'state', terminal: false, durationHours: 3.2, historicalCount: 38, currentCount: 5 },
    { id: 'repair-bay', label: 'Repair Bay', kind: 'state', terminal: false, durationHours: 1.5, historicalCount: 19, currentCount: 2 },
  ],
  edges: [
    { id: 'e-stamp-weld', source: 'stamped', target: 'welded', durationHours: 0.3, count: 985 },
    { id: 'e-weld-paint', source: 'welded', target: 'painted', durationHours: 0.5, count: 970 },
    { id: 'e-paint-trim', source: 'painted', target: 'trimmed', durationHours: 9.5, count: 932 },
    { id: 'e-trim-marry', source: 'trimmed', target: 'married', durationHours: 0.2, count: 955 },
    { id: 'e-marry-test', source: 'married', target: 'tested', durationHours: 0.25, count: 952 },
    { id: 'e-test-ship', source: 'tested', target: 'shipped', durationHours: 0.1, count: 950 },
    { id: 'e-paint-rework', source: 'painted', target: 'paint-rework', durationHours: 3.2, count: 38 },
    { id: 'e-rework-trim', source: 'paint-rework', target: 'trimmed', durationHours: 1, count: 38 },
    { id: 'e-test-repair', source: 'tested', target: 'repair-bay', durationHours: 0.5, count: 19 },
    { id: 'e-repair-trim', source: 'repair-bay', target: 'trimmed', durationHours: 0.5, count: 19 },
  ],
  positions: {
    stamped: { x: 0, y: 140 },
    welded: { x: 300, y: 140 },
    painted: { x: 600, y: 140 },
    trimmed: { x: 900, y: 140 },
    married: { x: 1200, y: 140 },
    tested: { x: 1500, y: 140 },
    shipped: { x: 1800, y: 140 },
    'paint-rework': { x: 600, y: 400 },
    'repair-bay': { x: 1350, y: 400 },
  },
}

export const FIXTURES: Record<MachineryFixtureId, MachineryFixture> = {
  'patient-journey': patientJourney,
  'approval-process': approvalProcess,
  'assembly-line': assemblyLine,
}
export const FIXTURE_LIST: MachineryFixture[] = [patientJourney, approvalProcess, assemblyLine]

export function getFixture(id: MachineryFixtureId): MachineryFixture {
  return FIXTURES[id]
}

/* ── formatting ─────────────────────────────────────────────────────────── */

export function formatCount(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '--'
  return Math.round(v).toLocaleString('en-US')
}

export function formatDays(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '--'
  const d = Math.round(v)
  return `${d} ${d === 1 ? 'day' : 'days'}`
}

/** Edge pills. Sub-day durations read as HRS/MIN (T-33 production line) instead of "0 DAYS". */
export function formatEdgeDays(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '--'
  const hours = v * 24
  if (hours >= 48) return `${Math.round(v)} DAYS`
  if (hours >= 1) return `${Math.round(hours * 10) / 10} HRS`
  return `${Math.max(1, Math.round(hours * 60))} MIN`
}

/** Approval zoom cards: "1d 19h", "32d 7h"; sub-hour shows minutes (T-33). */
export function formatDurationHours(hours: number | null | undefined, days?: number | null): string {
  if (hours !== null && hours !== undefined && !Number.isNaN(hours)) {
    if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`
    const hv = Math.round(hours * 10) / 10
    const d = Math.floor(hv / 24)
    const h = Math.round((hv - d * 24) * 10) / 10
    if (d === 0) return `${h}h`
    return `${d}d ${h}h`
  }
  if (days !== null && days !== undefined && !Number.isNaN(days)) return formatDays(days)
  return '--'
}

/* ── metric carousel ────────────────────────────────────────────────────── */

export function cycleMetric(current: MachineryMetric, dir: 1 | -1): MachineryMetric {
  const i = METRIC_ORDER.indexOf(current)
  const next = (i + (dir === 1 ? 1 : -1) + METRIC_ORDER.length) % METRIC_ORDER.length
  return METRIC_ORDER[next]
}
export const nextMetric = (m: MachineryMetric) => cycleMetric(m, 1)
export const prevMetric = (m: MachineryMetric) => cycleMetric(m, -1)

/** Primary value shown on a state node for the active carousel metric. */
export function formatNodeMetricValue(node: MachineryNode, metric: MachineryMetric): string {
  switch (metric) {
    case 'historical-count': return formatCount(node.historicalCount)
    case 'current-count': return formatCount(node.currentCount)
    case 'historical-duration':
      if (node.durationDays !== null && node.durationDays !== undefined && Number.isFinite(node.durationDays) && Math.round(node.durationDays!) >= 5) {
        return formatDays(node.durationDays)
      }
      return formatDurationHours(node.durationHours, node.durationDays)
  }
}

/** Edge pill label for the active metric: "40 DAYS" in duration view, raw count otherwise. */
export function formatEdgeMetricValue(edge: MachineryEdge, metric: MachineryMetric): string {
  switch (metric) {
    case 'historical-count': return formatCount(edge.count)
    case 'current-count': return formatCount(edge.currentCount ?? edge.count)
    case 'historical-duration':
      if (edge.durationDays !== null && edge.durationDays !== undefined) return formatEdgeDays(edge.durationDays)
      if (edge.durationHours !== null && edge.durationHours !== undefined) return formatEdgeDays(edge.durationHours / 24)
      return '--'
  }
}

/* ── duration / terminal tone ───────────────────────────────────────────── */

export function durationTone(days: number | null | undefined): DurationTone {
  if (days === null || days === undefined || Number.isNaN(days)) return 'neutral'
  if (days >= SLA_BREACH_DAYS) return 'sla-breach'
  if (days >= SLA_WARN_DAYS) return 'sla-warn'
  return 'ok'
}

export function nodeDurationDays(node: MachineryNode): number | null {
  if (node.durationDays !== null && node.durationDays !== undefined && Number.isFinite(node.durationDays)) return node.durationDays
  if (node.durationHours !== null && node.durationHours !== undefined && Number.isFinite(node.durationHours)) return node.durationHours / 24
  return null
}

/**
 * Terminal color coding: terminal states are green even when long;
 * non-terminal states encode duration SLA (breach/warn/in-progress).
 * Attended-like terminals with no metric stay neutral (grey).
 */
export function nodeTone(node: MachineryNode): NodeTone {
  const d = nodeDurationDays(node)
  if (node.terminal || node.kind === 'terminal-state') {
    if (d === null && node.historicalCount == null && node.currentCount == null) return 'neutral'
    return 'terminal-ok'
  }
  const t = durationTone(d)
  if (t === 'sla-breach') return 'sla-breach'
  if (t === 'sla-warn') return 'sla-warn'
  if (t === 'ok') return 'in-progress'
  return 'neutral'
}

export function isTerminal(node: MachineryNode): boolean {
  return node.terminal || node.kind === 'terminal-state'
}

/* ── node width encoding (Approval tile: width ∝ count) ─────────────────── */

export function nodeWidthForValue(value: number | null | undefined, maxValue: number, minW = 150, maxW = 280): number {
  if (value === null || value === undefined || Number.isNaN(value)) return minW
  const m = Math.max(1, maxValue)
  const t = Math.sqrt(Math.min(1, Math.max(0, value) / m))
  return Math.round(minW + t * (maxW - minW))
}

/* ── History count series (FN-MCH-008) ──────────────────────────────────── */

/** Deterministic 12-point history ending at historicalCount. */
export function buildHistorySeries(node: MachineryNode, points = 12): number[] {
  const hist = node.historicalCount
  if (hist === null || hist === undefined || Number.isNaN(hist)) return []
  const seed = Array.from(node.id).reduce((a, c) => a + c.charCodeAt(0), 0)
  const out: number[] = []
  for (let i = 0; i < points; i++) {
    const x = i / Math.max(1, points - 1)
    const wobble = Math.abs(Math.sin((seed + i * 12.9898) * 43758.5453) % 1)
    const v = hist * (0.25 + 0.75 * x) * (0.82 + wobble * 0.28)
    out.push(Math.round(v))
  }
  out[out.length - 1] = Math.round(hist)
  return out
}

/* ── graph builder (ReactFlow-shaped, without importing ReactFlow) ─────── */

export type BuiltMachineryNode = {
  id: string
  type: 'machinery'
  position: { x: number; y: number }
  style: { width: number }
  data: {
    label: string
    kind: MachineryNodeKind
    terminal: boolean
    tone: NodeTone
    metric: MachineryMetric
    metricValue: string
    durationDays: number | null
    durationHours: number | null
    historicalCount: number | null
    currentCount: number | null
    subprocess?: string | null
    /** FN-MCH-005/006 decorations applied by MachineryGraph (dim/filter view). */
    dimmed?: boolean
    highlighted?: boolean
  }
}

export type BuiltMachineryEdge = {
  id: string
  source: string
  target: string
  label: string
  labelBgPadding: [number, number]
  labelBgBorderRadius: number
  labelBgStyle: Record<string, string>
  labelStyle: Record<string, string>
  style: Record<string, string | number>
  markerEnd: { type: string; color: string }
  data: {
    durationDays: number | null
    count: number | null
    tone: DurationTone
    metric: MachineryMetric
    expectedDays?: number | null
    isDeviation?: boolean
  }
}

const TONE_BG: Record<DurationTone, string> = {
  'sla-breach': 'var(--danger-bg)',
  'sla-warn': 'var(--warn-bg)',
  ok: 'rgba(34,197,94,.14)',
  neutral: 'rgba(5,46,22,.06)',
}
const TONE_FG: Record<DurationTone, string> = {
  'sla-breach': 'var(--danger)',
  'sla-warn': 'var(--warn)',
  ok: 'var(--green-800)',
  neutral: 'var(--text-dim)',
}

export function buildMachineryGraph(
  fixtureId: MachineryFixtureId,
  metric: MachineryMetric,
  showTransitionNodes: boolean,
  opts?: { deviationFilter?: DeviationFilter },
): { nodes: BuiltMachineryNode[]; edges: BuiltMachineryEdge[] } {
  const fixture = getFixture(fixtureId)
  const byId = new Map(fixture.nodes.map(n => [n.id, n]))
  const maxValue = Math.max(
    1,
    ...fixture.nodes.map(n =>
      metric === 'historical-duration'
        ? Math.max(0, nodeDurationDays(n) ?? 0)
        : metric === 'current-count'
          ? Math.max(0, n.currentCount ?? 0)
          : Math.max(0, n.historicalCount ?? 0),
    ),
    ...fixture.edges.map(e => (metric === 'historical-duration' ? Math.max(0, e.durationDays ?? 0) : Math.max(0, e.count ?? 0))),
  )

  const nodes: BuiltMachineryNode[] = fixture.nodes.map(n => {
    const v =
      metric === 'historical-duration'
        ? nodeDurationDays(n)
        : metric === 'current-count'
          ? n.currentCount
          : n.historicalCount
    return {
      id: n.id,
      type: 'machinery',
      position: fixture.positions[n.id] ?? { x: 0, y: 0 },
      style: { width: nodeWidthForValue(v, maxValue) },
      data: {
        label: n.label,
        kind: n.kind,
        terminal: isTerminal(n),
        tone: nodeTone(n),
        metric,
        metricValue: formatNodeMetricValue(n, metric),
        durationDays: nodeDurationDays(n),
        durationHours: n.durationHours ?? null,
        historicalCount: n.historicalCount ?? null,
        currentCount: n.currentCount ?? null,
        subprocess: n.subprocess ?? null,
      },
    }
  })

  const edges: BuiltMachineryEdge[] = []
  const transitionNodes: BuiltMachineryNode[] = []

  const expectedDays = expectedEdgeDurationDays(fixture)
  const deviations = new Map(computeDeviations(fixture).map(d => [d.edgeId, d]))
  const filter = opts?.deviationFilter ?? 'all'
  const visibleEdges = fixture.edges.filter(e => {
    const d = deviations.get(e.id)
    if (filter === 'deviations') return d?.isDeviation === true
    if (filter === 'on-time') return d !== undefined && d.isDeviation !== true
    return true
  })

  for (const e of visibleEdges) {
    const tone = durationTone(e.durationDays ?? (e.durationHours !== null && e.durationHours !== undefined ? e.durationHours / 24 : null))
    const pill = formatEdgeMetricValue(e, metric)
    const dev = deviations.get(e.id)
    const isDev = dev?.isDeviation === true
    const mkEdge = (id: string, source: string, target: string, label: string, showPill: boolean): BuiltMachineryEdge => ({
      id,
      source,
      target,
      label: showPill ? pill : '',
      labelBgPadding: [6, 4],
      labelBgBorderRadius: 999,
      labelBgStyle: (showPill ? { background: TONE_BG[tone], border: '1px solid var(--glass-border-strong)' } : {}) as Record<string, string>,
      labelStyle: (showPill ? { color: TONE_FG[tone], fontWeight: '800', fontSize: '10px', letterSpacing: '.06em' } : {}) as Record<string, string>,
      style: { stroke: isDev ? 'var(--danger)' : 'var(--green-700)', strokeWidth: isDev ? 2.5 : metric === 'historical-count' && e.count !== null && e.count !== undefined ? Math.min(8, 1.5 + Math.sqrt(Math.max(0, e.count)) / 2) : 2, opacity: 0.7, ...(isDev ? { strokeDasharray: '6 4' } : {}) },
      markerEnd: { type: 'arrowclosed', color: isDev ? 'var(--danger)' : 'var(--green-700)' },
      data: { durationDays: e.durationDays ?? (e.durationHours !== null && e.durationHours !== undefined ? e.durationHours / 24 : null), count: e.count ?? null, tone, metric, expectedDays: expectedDays ?? null, isDeviation: isDev },
    })

    if (showTransitionNodes) {
      const tId = `t-${e.id}`
      const a = fixture.positions[e.source] ?? { x: 0, y: 0 }
      const b = fixture.positions[e.target] ?? { x: 0, y: 0 }
      const label = `${byId.get(e.source)?.label ?? e.source} → ${byId.get(e.target)?.label ?? e.target}`
      transitionNodes.push({
        id: tId,
        type: 'machinery',
        position: { x: Math.round((a.x + b.x) / 2), y: Math.round((a.y + b.y) / 2) },
        style: { width: 44 },
        data: {
          label,
          kind: 'transition',
          terminal: false,
          tone: 'neutral',
          metric,
          metricValue: pill,
          durationDays: e.durationDays ?? (e.durationHours !== null && e.durationHours !== undefined ? e.durationHours / 24 : null),
          durationHours: e.durationHours ?? null,
          historicalCount: e.count ?? null,
          currentCount: e.currentCount ?? null,
          subprocess: null,
        },
      })
      edges.push(mkEdge(`${e.id}-a`, e.source, tId, '', false))
      edges.push(mkEdge(`${e.id}-b`, tId, e.target, pill, true))
    } else {
      edges.push(mkEdge(e.id, e.source, e.target, pill, true))
    }
  }

  return { nodes: [...nodes, ...transitionNodes], edges }
}

/** Preserve dragged positions when rebuilding labels/metric/toggle. */
export function mergePositions<T extends { id: string; position: { x: number; y: number } }>(prev: T[], next: T[]): T[] {
  const prevById = new Map(prev.map(n => [n.id, n]))
  return next.map(n => {
    const p = prevById.get(n.id)
    return p ? { ...n, position: p.position } : n
  })
}

/* ── deviation edges (FN-MCH-004) ───────────────────────────────────────── */

export type DeviationFilter = 'all' | 'deviations' | 'on-time'
export const DEVIATION_FILTERS: Array<{ id: DeviationFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'deviations', label: 'Deviations' },
  { id: 'on-time', label: 'On time' },
]

/** Observed duration of an edge in days (durationDays preferred, hours fallback). */
export function edgeDurationDays(edge: MachineryEdge): number | null {
  if (edge.durationDays !== null && edge.durationDays !== undefined && Number.isFinite(edge.durationDays)) return edge.durationDays
  if (edge.durationHours !== null && edge.durationHours !== undefined && Number.isFinite(edge.durationHours)) return edge.durationHours / 24
  return null
}

/** Expected edge duration = median of observed edge durations (robust to outliers). */
export function expectedEdgeDurationDays(fixture: MachineryFixture): number | null {
  const ds = fixture.edges.map(edgeDurationDays).filter((v): v is number => v !== null).sort((a, b) => a - b)
  if (ds.length === 0) return null
  const mid = Math.floor(ds.length / 2)
  return ds.length % 2 === 1 ? ds[mid] : (ds[mid - 1] + ds[mid]) / 2
}

export type DeviationRow = {
  edgeId: string
  source: string
  target: string
  observedDays: number
  expectedDays: number
  deltaDays: number
  deltaPct: number
  isDeviation: boolean
}

/** Compare each observed edge duration against the fixture median (expected). */
export function computeDeviations(fixture: MachineryFixture): DeviationRow[] {
  const expected = expectedEdgeDurationDays(fixture)
  if (expected === null || expected === 0) return []
  const rows: DeviationRow[] = []
  for (const e of fixture.edges) {
    const observed = edgeDurationDays(e)
    if (observed === null) continue
    const deltaDays = observed - expected
    const deltaPct = expected === 0 ? 0 : Math.abs(deltaDays) / Math.abs(expected)
    const isDeviation = Math.abs(deltaDays) >= 5 && deltaPct > 0.5
    rows.push({ edgeId: e.id, source: e.source, target: e.target, observedDays: observed, expectedDays: expected, deltaDays, deltaPct, isDeviation })
  }
  return rows
}

export function filterDeviations(rows: DeviationRow[], filter: DeviationFilter): DeviationRow[] {
  if (filter === 'all') return rows
  if (filter === 'deviations') return rows.filter(r => r.isDeviation)
  return rows.filter(r => !r.isDeviation)
}

/* ── contextual zoom cards (FN-MCH-003) ─────────────────────────────────── */

export type ZoomSubState = { nodeId: string; label: string; count: number | null; terminal: boolean }

export type ZoomCard = {
  nodeId: string
  label: string
  kind: MachineryNodeKind
  terminal: boolean
  tone: NodeTone
  durationDays: number | null
  durationHours: number | null
  historicalCount: number | null
  currentCount: number | null
  subprocess?: string | null
  subStates: ZoomSubState[]
  outgoingEdgeIds: string[]
  incomingEdgeIds: string[]
}

/** Zoom card for a node: its own stats plus sub-state (outgoing target) counts. */
export function buildZoomCard(fixture: MachineryFixture, nodeId: string): ZoomCard | null {
  const node = fixture.nodes.find(n => n.id === nodeId)
  if (!node) return null
  const byId = new Map(fixture.nodes.map(n => [n.id, n]))
  const outgoing = fixture.edges.filter(e => e.source === nodeId)
  const incoming = fixture.edges.filter(e => e.target === nodeId)
  return {
    nodeId: node.id,
    label: node.label,
    kind: node.kind,
    terminal: isTerminal(node),
    tone: nodeTone(node),
    durationDays: nodeDurationDays(node),
    durationHours: node.durationHours ?? null,
    historicalCount: node.historicalCount ?? null,
    currentCount: node.currentCount ?? null,
    subprocess: node.subprocess ?? null,
    subStates: outgoing.map(e => {
      const t = byId.get(e.target)
      return { nodeId: e.target, label: t?.label ?? e.target, count: e.count ?? t?.historicalCount ?? null, terminal: t ? isTerminal(t) : false }
    }),
    outgoingEdgeIds: outgoing.map(e => e.id),
    incomingEdgeIds: incoming.map(e => e.id),
  }
}

/** Center + zoom target when a node is clicked (contextual zoom camera). */
export function zoomCenterForNode(position: { x: number; y: number }, opts?: { nodeWidth?: number; nodeHeight?: number; zoom?: number }): { x: number; y: number; zoom: number } {
  const w = opts?.nodeWidth ?? 220
  const h = opts?.nodeHeight ?? 64
  return { x: Math.round(position.x + w / 2), y: Math.round(position.y + h / 2), zoom: opts?.zoom ?? 1.1 }
}

/* ── subprocess frames (FN-MCH-007) ─────────────────────────────────────── */

export type SubprocessFrame = {
  key: string
  label: string
  nodeIds: string[]
  bounds: { x: number; y: number; width: number; height: number }
}

/** Group nodes by subprocess and return padded bounding frames (read-only geometry). */
export function computeSubprocessFrames(
  fixture: MachineryFixture,
  positions: Record<string, { x: number; y: number }> = fixture.positions,
  opts?: { nodeWidth?: number; nodeHeight?: number; padding?: number },
): SubprocessFrame[] {
  const nodeWidth = opts?.nodeWidth ?? 220
  const nodeHeight = opts?.nodeHeight ?? 64
  const padding = opts?.padding ?? 24
  const groups = new Map<string, MachineryNode[]>()
  for (const n of fixture.nodes) {
    const key = n.subprocess ?? 'Unassigned'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(n)
  }
  const frames: SubprocessFrame[] = []
  for (const [label, members] of groups) {
    const pts = members.map(m => positions[m.id]).filter((p): p is { x: number; y: number } => p !== undefined)
    if (pts.length === 0) continue
    const minX = Math.min(...pts.map(p => p.x))
    const minY = Math.min(...pts.map(p => p.y))
    const maxX = Math.max(...pts.map(p => p.x))
    const maxY = Math.max(...pts.map(p => p.y))
    frames.push({
      key: label,
      label,
      nodeIds: members.map(m => m.id),
      bounds: {
        x: Math.round(minX - padding),
        y: Math.round(minY - padding),
        width: Math.round(maxX - minX + nodeWidth + padding * 2),
        height: Math.round(maxY - minY + nodeHeight + padding * 2),
      },
    })
  }
  return frames
}

export function summarizeFixture(fixture: MachineryFixture) {
  const hists = fixture.nodes.map(n => n.historicalCount).filter((v): v is number => v !== null && v !== undefined)
  const curs = fixture.nodes.map(n => n.currentCount).filter((v): v is number => v !== null && v !== undefined)
  const durations = fixture.nodes.map(n => nodeDurationDays(n)).filter((v): v is number => v !== null)
  return {
    nodeCount: fixture.nodes.length,
    edgeCount: fixture.edges.length,
    terminalCount: fixture.nodes.filter(isTerminal).length,
    totalHistorical: hists.reduce((a, v) => a + v, 0),
    totalCurrent: curs.reduce((a, v) => a + v, 0),
    medianDurationDays: durations.length ? durations.sort((a, b) => a - b)[Math.floor(durations.length / 2)] : null,
  }
}

/* ── path explorer (FN-MCH-005) ─────────────────────────────────────────── */

export type MachineryPath = {
  id: string
  startNodeId: string
  endNodeId: string
  nodeIds: string[]
  edgeIds: string[]
  labels: string[]
  /** "Draft" (single node) | "Draft → Cancelled" (direct edge) | "Draft ••• Approved" (multi-hop). */
  title: string
  /** Number of edges in the path ("length"). */
  hopCount: number
  /** Summed node duration along the path (days); null when no node has a duration. */
  totalDurationDays: number | null
  /** Destination currentCount ?? historicalCount (bar magnitude proxy). */
  totalCount: number | null
  /** Min edge count along the path when all edges carry counts; otherwise totalCount. */
  flowCount: number | null
  terminal: boolean
}

/**
 * All simple paths from every source (in-degree 0) to every reachable node,
 * including single-node source paths. Cycle-safe (visited set per walk).
 * Sorted count-desc then duration-desc then hopCount-desc (tile order).
 */
export function listMachineryPaths(fixture: MachineryFixture): MachineryPath[] {
  const byId = new Map(fixture.nodes.map(n => [n.id, n]))
  const outgoing = new Map<string, MachineryEdge[]>()
  const inDegree = new Map<string, number>(fixture.nodes.map(n => [n.id, 0]))
  for (const e of fixture.edges) {
    if (!byId.has(e.source) || !byId.has(e.target)) continue
    if (!outgoing.has(e.source)) outgoing.set(e.source, [])
    outgoing.get(e.source)!.push(e)
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1)
  }
  const sources = fixture.nodes.filter(n => (inDegree.get(n.id) ?? 0) === 0)
  const paths: MachineryPath[] = []

  const emit = (nodeIds: string[], edgeIds: string[]) => {
    const start = byId.get(nodeIds[0])!
    const end = byId.get(nodeIds[nodeIds.length - 1])!
    const labels = nodeIds.map(id => byId.get(id)?.label ?? id)
    const title =
      nodeIds.length === 1 ? labels[0]
      : nodeIds.length === 2 ? `${labels[0]} → ${labels[1]}`
      : `${labels[0]} ••• ${labels[labels.length - 1]}`
    const durations = nodeIds.map(id => nodeDurationDays(byId.get(id)!)).filter((v): v is number => v !== null)
    const edgeDays = edgeIds
      .map(id => fixture.edges.find(e => e.id === id))
      .map(e => (e ? edgeDurationDays(e) : null))
      .filter((v): v is number => v !== null)
    const totalDurationDays = durations.length ? durations.reduce((a, v) => a + v, 0) : edgeDays.length ? edgeDays.reduce((a, v) => a + v, 0) : null
    const totalCount = end.currentCount ?? end.historicalCount ?? null
    const counts = edgeIds
      .map(id => fixture.edges.find(e => e.id === id))
      .map(e => e?.count)
      .filter((v): v is number => v !== null && v !== undefined)
    const flowCount = edgeIds.length && counts.length === edgeIds.length ? Math.min(...counts) : totalCount
    paths.push({
      id: `path:${nodeIds.join('>')}`,
      startNodeId: start.id,
      endNodeId: end.id,
      nodeIds: [...nodeIds],
      edgeIds: [...edgeIds],
      labels,
      title,
      hopCount: edgeIds.length,
      totalDurationDays: totalDurationDays === null ? null : Math.round(totalDurationDays * 100) / 100,
      totalCount,
      flowCount,
      terminal: isTerminal(end),
    })
  }

  const walk = (nodeIds: string[], edgeIds: string[]) => {
    emit(nodeIds, edgeIds)
    const last = outgoing.get(nodeIds[nodeIds.length - 1]) ?? []
    for (const e of last) {
      if (nodeIds.includes(e.target)) continue // simple paths only
      walk([...nodeIds, e.target], [...edgeIds, e.id])
    }
  }
  for (const s of sources) walk([s.id], [])
  return paths.sort((a, b) => (b.totalCount ?? -1) - (a.totalCount ?? -1) || (b.totalDurationDays ?? -1) - (a.totalDurationDays ?? -1) || b.hopCount - a.hopCount || a.id.localeCompare(b.id))
}

/** Toggle an id in a checked-path list (returns a new array, input untouched). */
export function toggleCheckedPath(checked: string[], id: string): string[] {
  return checked.includes(id) ? checked.filter(v => v !== id) : [...checked, id]
}

export type PathHighlight = { nodeIds: Set<string>; edgeIds: Set<string> }

/** Union of node/edge ids for every checked path plus the clicked (selected) path. */
export function pathHighlightSets(paths: MachineryPath[], checked: string[], selectedId: string | null): PathHighlight {
  const active = new Set<string>([...checked, ...(selectedId ? [selectedId] : [])])
  const nodeIds = new Set<string>()
  const edgeIds = new Set<string>()
  for (const p of paths) {
    if (!active.has(p.id)) continue
    for (const id of p.nodeIds) nodeIds.add(id)
    for (const id of p.edgeIds) edgeIds.add(id)
  }
  return { nodeIds, edgeIds }
}

/** Bar width 0–100 (%) for a path-bar value against the max; min 0 for null, else ≥2. */
export function pathBarWidthPct(value: number | null | undefined, max: number | null | undefined): number {
  if (value === null || value === undefined || Number.isNaN(value)) return 0
  const m = max === null || max === undefined || !Number.isFinite(max) ? 0 : max
  if (m <= 0) return 2
  return Math.max(2, Math.min(100, (Math.max(0, value) / m) * 100))
}

/* ── duration histogram + brush filter (FN-MCH-006) ─────────────────────── */

export type DurationRange = [number, number] | null
export type DurationBin = { start: number; end: number; count: number }

/** [min, max] node duration (days) across the fixture; null when no node has a duration. */
export function durationDomain(nodes: MachineryNode[]): [number, number] | null {
  const ds = nodes.map(nodeDurationDays).filter((v): v is number => v !== null)
  if (!ds.length) return null
  return [Math.min(...ds), Math.max(...ds)]
}

/** Equal-width histogram bins over node durations (days); [] when no dated node. */
export function buildDurationHistogram(nodes: MachineryNode[], binCount = 12, domain?: [number, number] | null): DurationBin[] {
  const dom = domain ?? durationDomain(nodes)
  if (!dom) return []
  const bins = Math.min(60, Math.max(1, Math.floor(binCount) || 12))
  const lo = Math.min(dom[0], dom[1])
  const hi = Math.max(dom[0], dom[1])
  const span = hi - lo || 1
  const width = span / bins
  const out: DurationBin[] = Array.from({ length: bins }, (_, i) => ({ start: lo + i * width, end: lo + (i + 1) * width, count: 0 }))
  for (const n of nodes) {
    const d = nodeDurationDays(n)
    if (d === null) continue
    let idx = Math.floor((d - lo) / width)
    if (d === hi) idx = bins - 1
    if (idx < 0 || idx >= bins) continue
    out[idx].count += 1
  }
  return out
}

/** Clamp/normalize a candidate duration range into the domain; null stays null. */
export function normalizeDurationRange(range: DurationRange, domain: [number, number] | null): DurationRange {
  if (!range || !domain) return null
  const lo = Math.min(domain[0], domain[1])
  const hi = Math.max(domain[0], domain[1])
  const a = Math.min(hi, Math.max(lo, Number(range[0])))
  const b = Math.min(hi, Math.max(lo, Number(range[1])))
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  return [Math.min(a, b), Math.max(a, b)]
}

/** True when the node passes: null range keeps all; nodes with unknown duration fail a set range. */
export function nodeInDurationRange(node: MachineryNode, range: DurationRange): boolean {
  if (!range) return true
  const d = nodeDurationDays(node)
  if (d === null) return false
  return d >= range[0] && d <= range[1]
}

/** Nodes whose duration falls inside the brushed range (inclusive). */
export function filterNodesByDurationRange<T extends MachineryNode>(nodes: T[], range: DurationRange): T[] {
  return nodes.filter(n => nodeInDurationRange(n, range))
}

/** Fixture narrowed to nodes in the brushed range; edges with both endpoints kept survive. */
export function filterFixtureByDurationRange(fixture: MachineryFixture, range: DurationRange): MachineryFixture {
  const nodes = filterNodesByDurationRange(fixture.nodes, range)
  const keep = new Set(nodes.map(n => n.id))
  return { ...fixture, nodes, edges: fixture.edges.filter(e => keep.has(e.source) && keep.has(e.target)) }
}
