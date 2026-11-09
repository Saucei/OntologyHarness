// Peer Manager pure helpers — peering job state machine + property map (T-24, FN-PEER-001/002/003).
// No React, no store imports: every function here is deterministic and unit-testable.
// Reference: corpus-2 tiles C11 (home), C12 (overview), C13 (map properties) and
// master-prompts/functions/FN-GOV-PEER.md ("topology, peering jobs Start export/Send Ack").

export type SecurityClassification = 'Public' | 'Internal' | 'Confidential' | 'Restricted'
export type PeerStatus = 'connected' | 'disconnected' | 'degraded'
export type TopologyNodeKind = 'object-type' | 'link-type' | 'dataset' | 'action'

export interface TopologyNode {
  id: string
  label: string
  kind: TopologyNodeKind
  status?: 'ok' | 'warn' | 'error'
}

export interface PeerConnection {
  id: string
  name: string
  remote: string
  classification: SecurityClassification
  status: PeerStatus
  localTopology: TopologyNode[]
  remoteTopology: TopologyNode[]
}

export type PeeringJobStatus =
  | 'idle'
  | 'queued'
  | 'exporting'
  | 'awaiting-ack'
  | 'acknowledged'
  | 'completed'
  | 'failed'

export interface PeeringJob {
  id: string
  connectionId: string
  status: PeeringJobStatus
  createdAt: string
  updatedAt: string
  progress: number
  lastError?: string
  ackedAt?: string
}

export type PeerSourceKind = 'ontology' | 'object-type' | 'dataset'

export interface PeerSource {
  id: string
  name: string
  kind: PeerSourceKind
  properties: string[]
}

export type PropertyTransform = 'identity' | 'lowercase' | 'uppercase' | 'trim'

export interface PropertyMapRow {
  sourceProp: string
  targetProp: string | null
  transform: PropertyTransform
  doNotMap: boolean
}

export type WizardStep = 'select' | 'map' | 'review'

export interface WizardState {
  step: WizardStep
  sourceId: string | null
  rows: PropertyMapRow[]
}

/* ── Target property options (local ontology side of the mapping) ─────────── */
export const TARGET_PROPERTY_OPTIONS: string[] = [
  'FacilityId',
  'Name',
  'Region',
  'Capacity',
  'Status',
  'ShipmentId',
  'Origin',
  'Destination',
  'WeightKg',
  'Eta',
  'LegacyCode',
]

/* ── Fixtures aligned to corpus-2 peer tiles C11–C13 ──────────────────────── */
export const PEER_FIXTURE_CONNECTIONS: PeerConnection[] = [
  {
    id: 'conn-north',
    name: 'North Campus — PROD',
    remote: 'foundry-north.example',
    classification: 'Confidential',
    status: 'connected',
    localTopology: [
      { id: 'fac', label: 'Facility', kind: 'object-type', status: 'ok' },
      { id: 'insp', label: 'Inspection', kind: 'object-type', status: 'ok' },
      { id: 'fac-link', label: 'Facility → Region', kind: 'link-type', status: 'ok' },
    ],
    remoteTopology: [
      { id: 'r-fac', label: 'Facility', kind: 'object-type', status: 'ok' },
      { id: 'r-region', label: 'Region', kind: 'object-type', status: 'warn' },
    ],
  },
  {
    id: 'conn-partner',
    name: 'Partner Org — UAT',
    remote: 'foundry-partner.example',
    classification: 'Internal',
    status: 'connected',
    localTopology: [
      { id: 'ship', label: 'Shipment', kind: 'object-type', status: 'ok' },
      { id: 'ship-ds', label: 'Shipment dataset', kind: 'dataset', status: 'ok' },
    ],
    remoteTopology: [
      { id: 'r-ship', label: 'Shipment', kind: 'object-type', status: 'ok' },
      { id: 'r-carrier', label: 'Carrier', kind: 'object-type', status: 'ok' },
    ],
  },
  {
    id: 'conn-edge',
    name: 'Edge Hub — Archive',
    remote: 'foundry-edge.example',
    classification: 'Restricted',
    status: 'disconnected',
    localTopology: [{ id: 'fac2', label: 'Facility', kind: 'object-type', status: 'ok' }],
    remoteTopology: [{ id: 'r-arc', label: 'Archive store', kind: 'dataset', status: 'error' }],
  },
]

const AT = (day: number) => `2025-11-0${day}T09:00:00.000Z`

export const PEER_FIXTURE_JOBS: PeeringJob[] = [
  { id: 'job-north-1', connectionId: 'conn-north', status: 'awaiting-ack', createdAt: AT(5), updatedAt: AT(5), progress: 100 },
  { id: 'job-north-2', connectionId: 'conn-north', status: 'idle', createdAt: AT(5), updatedAt: AT(5), progress: 0 },
  { id: 'job-partner-1', connectionId: 'conn-partner', status: 'exporting', createdAt: AT(5), updatedAt: AT(5), progress: 42 },
  { id: 'job-partner-2', connectionId: 'conn-partner', status: 'completed', createdAt: AT(4), updatedAt: AT(4), progress: 100, ackedAt: AT(4) },
  { id: 'job-edge-1', connectionId: 'conn-edge', status: 'failed', createdAt: AT(3), updatedAt: AT(3), progress: 12, lastError: 'Remote unreachable' },
]

export const PEER_FIXTURE_SOURCES: PeerSource[] = [
  {
    id: 'src-facility',
    name: 'Facility ontology',
    kind: 'ontology',
    properties: ['FacilityId', 'Name', 'Region', 'Capacity', 'Status', 'LegacyCode'],
  },
  {
    id: 'src-shipment',
    name: 'Shipment dataset',
    kind: 'dataset',
    properties: ['ShipmentId', 'Origin', 'Destination', 'WeightKg', 'Eta', 'Carrier'],
  },
  {
    id: 'src-inspection',
    name: 'Inspection object type',
    kind: 'object-type',
    properties: ['InspectionId', 'FacilityId', 'Inspector', 'Result', 'InspectedAt'],
  },
]

/* ── Peering job state machine ──────────────────────────────────────────────
 * idle → queued → exporting → awaiting-ack → acknowledged → completed
 * Any non-terminal state can fail; failed can be re-queued. Terminal: completed.
 */
export const JOB_TRANSITIONS: Record<PeeringJobStatus, PeeringJobStatus[]> = {
  idle: ['queued', 'failed'],
  queued: ['exporting', 'failed'],
  exporting: ['awaiting-ack', 'failed'],
  'awaiting-ack': ['acknowledged', 'failed'],
  acknowledged: ['completed', 'failed'],
  failed: ['queued'],
  completed: [],
}

export const ALL_JOB_STATUSES: PeeringJobStatus[] = [
  'idle',
  'queued',
  'exporting',
  'awaiting-ack',
  'acknowledged',
  'completed',
  'failed',
]

export function canTransition(from: PeeringJobStatus, to: PeeringJobStatus): boolean {
  return (JOB_TRANSITIONS[from] ?? []).includes(to)
}

export function isTerminalJobStatus(s: PeeringJobStatus): boolean {
  return s === 'completed' || s === 'failed'
}

export function isActiveJobStatus(s: PeeringJobStatus): boolean {
  return s === 'queued' || s === 'exporting' || s === 'awaiting-ack'
}

export function canStartExport(job: PeeringJob): boolean {
  return job.status === 'idle' || job.status === 'queued' || job.status === 'failed'
}

export function canSendAck(job: PeeringJob): boolean {
  return job.status === 'awaiting-ack'
}

function progressFor(status: PeeringJobStatus, current: number): number {
  switch (status) {
    case 'idle':
    case 'queued':
      return 0
    case 'exporting':
      return Math.min(99, Math.max(1, current || 1))
    case 'awaiting-ack':
    case 'acknowledged':
    case 'completed':
      return 100
    case 'failed':
      return current
  }
}

/** Advance a job to `to`. Throws RangeError on an illegal transition (pure, immutable). */
export function transitionJob(job: PeeringJob, to: PeeringJobStatus, now: string = new Date().toISOString()): PeeringJob {
  if (!canTransition(job.status, to)) {
    throw new RangeError(`Illegal peering transition ${job.status} -> ${to} (${job.id})`)
  }
  return {
    ...job,
    status: to,
    updatedAt: now,
    progress: progressFor(to, job.progress),
    ackedAt: to === 'acknowledged' ? now : job.ackedAt,
    lastError: to === 'failed' ? job.lastError : to === 'queued' ? undefined : job.lastError,
  }
}

/** Start export: idle/queued/failed → exporting, chaining through queued when needed. */
export function startExport(job: PeeringJob, now: string = new Date().toISOString()): PeeringJob {
  if (!canStartExport(job)) throw new RangeError(`Cannot start export from ${job.status} (${job.id})`)
  const queued = job.status === 'failed' || job.status === 'idle' ? transitionJob(job, 'queued', now) : job
  return transitionJob(queued, 'exporting', now)
}

/** Send Ack: awaiting-ack → acknowledged. Throws otherwise. */
export function sendAck(job: PeeringJob, now: string = new Date().toISOString()): PeeringJob {
  if (!canSendAck(job)) throw new RangeError(`Cannot send Ack from ${job.status} (${job.id})`)
  return transitionJob(job, 'acknowledged', now)
}

export function failJob(job: PeeringJob, reason: string, now: string = new Date().toISOString()): PeeringJob {
  if (isTerminalJobStatus(job.status)) throw new RangeError(`Cannot fail terminal job ${job.id} (${job.status})`)
  return { ...transitionJob(job, 'failed', now), lastError: reason }
}

export function completeJob(job: PeeringJob, now: string = new Date().toISOString()): PeeringJob {
  return transitionJob(job, 'completed', now)
}

export type JobHealth = 'healthy' | 'attention' | 'idle'

export interface JobHealthSummary {
  total: number
  active: number
  failed: number
  completed: number
  acknowledged: number
  awaitingAck: number
  health: JobHealth
  label: string
}

export function summarizeJobs(jobs: readonly PeeringJob[]): JobHealthSummary {
  const total = jobs.length
  const active = jobs.filter((j) => isActiveJobStatus(j.status)).length
  const failed = jobs.filter((j) => j.status === 'failed').length
  const completed = jobs.filter((j) => j.status === 'completed').length
  const acknowledged = jobs.filter((j) => j.status === 'acknowledged').length
  const awaitingAck = jobs.filter((j) => j.status === 'awaiting-ack').length
  const health: JobHealth = total === 0 ? 'idle' : failed > 0 ? 'attention' : 'healthy'
  const label =
    total === 0
      ? 'no jobs'
      : [`${active} active`, failed ? `${failed} failed` : null, completed ? `${completed} done` : null]
          .filter(Boolean)
          .join(' · ') || 'idle'
  return { total, active, failed, completed, acknowledged, awaitingAck, health, label }
}

export function jobHealthForConnection(jobs: readonly PeeringJob[], connectionId: string): JobHealthSummary {
  return summarizeJobs(jobs.filter((j) => j.connectionId === connectionId))
}

export function filterJobsByStatus(jobs: readonly PeeringJob[], status: PeeringJobStatus | 'all'): PeeringJob[] {
  if (status === 'all') return [...jobs]
  return jobs.filter((j) => j.status === status)
}

export function sortJobsByUpdatedDesc(jobs: readonly PeeringJob[]): PeeringJob[] {
  return [...jobs].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
}

/* ── Connections: search + topology ─────────────────────────────────────── */
export function searchConnections(connections: readonly PeerConnection[], query: string): PeerConnection[] {
  const q = query.trim().toLowerCase()
  if (!q) return [...connections]
  return connections.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.remote.toLowerCase().includes(q) ||
      c.classification.toLowerCase().includes(q) ||
      c.status.toLowerCase().includes(q),
  )
}

export interface TopologySummary {
  localCount: number
  remoteCount: number
  total: number
  localKinds: Partial<Record<TopologyNodeKind, number>>
  remoteKinds: Partial<Record<TopologyNodeKind, number>>
}

function countKinds(nodes: readonly TopologyNode[]): Partial<Record<TopologyNodeKind, number>> {
  const out: Partial<Record<TopologyNodeKind, number>> = {}
  for (const n of nodes) out[n.kind] = (out[n.kind] ?? 0) + 1
  return out
}

export function topologySummary(connection: PeerConnection): TopologySummary {
  return {
    localCount: connection.localTopology.length,
    remoteCount: connection.remoteTopology.length,
    total: connection.localTopology.length + connection.remoteTopology.length,
    localKinds: countKinds(connection.localTopology),
    remoteKinds: countKinds(connection.remoteTopology),
  }
}

/* ── Property map (FN-PEER-003 — Map properties, "Do not map property") ─── */
export function buildPropertyMap(sourceProps: readonly string[], targetProps: readonly string[] = TARGET_PROPERTY_OPTIONS): PropertyMapRow[] {
  const lowered = new Map(targetProps.map((t) => [t.toLowerCase(), t]))
  return sourceProps.map((sourceProp) => {
    const exact = targetProps.includes(sourceProp) ? sourceProp : lowered.get(sourceProp.toLowerCase()) ?? null
    return { sourceProp, targetProp: exact, transform: 'identity' as const, doNotMap: false }
  })
}

export function updatePropertyMapRow(
  rows: readonly PropertyMapRow[],
  sourceProp: string,
  patch: Partial<PropertyMapRow>,
): PropertyMapRow[] {
  return rows.map((r) => {
    if (r.sourceProp !== sourceProp) return r
    const next = { ...r, ...patch }
    // Mapping a target implicitly clears do-not-map.
    if (patch.targetProp != null) next.doNotMap = false
    // "Do not map property" wins: a do-not-mapped row carries no target.
    if (next.doNotMap) next.targetProp = null
    return next
  })
}

export function setDoNotMap(rows: readonly PropertyMapRow[], sourceProp: string, flag: boolean): PropertyMapRow[] {
  return updatePropertyMapRow(rows, sourceProp, flag ? { doNotMap: true, targetProp: null } : { doNotMap: false })
}

export interface MappingValidation {
  ok: boolean
  errors: string[]
  mapped: number
  unmapped: number
  doNotMapped: number
  duplicates: string[]
}

export function validatePropertyMap(rows: readonly PropertyMapRow[], targetProps: readonly string[] = TARGET_PROPERTY_OPTIONS): MappingValidation {
  const errors: string[] = []
  const duplicates: string[] = []
  if (rows.length === 0) errors.push('No properties to map — select a source first')
  const seen = new Map<string, number>()
  let mapped = 0
  let unmapped = 0
  let doNotMapped = 0
  for (const row of rows) {
    if (row.doNotMap) {
      doNotMapped += 1
      if (row.targetProp != null) errors.push(`Do not map + target set: ${row.sourceProp}`)
      continue
    }
    if (row.targetProp == null || row.targetProp.trim() === '') {
      unmapped += 1
      errors.push(`Unmapped property: ${row.sourceProp}`)
      continue
    }
    mapped += 1
    if (targetProps.length > 0 && !targetProps.includes(row.targetProp)) {
      errors.push(`Unknown target property: ${row.targetProp}`)
    }
    const n = (seen.get(row.targetProp) ?? 0) + 1
    seen.set(row.targetProp, n)
    if (n === 2) duplicates.push(row.targetProp)
  }
  for (const d of duplicates) errors.push(`Duplicate target property: ${d}`)
  return { ok: errors.length === 0, errors, mapped, unmapped, doNotMapped, duplicates }
}

export interface MappingSummary {
  total: number
  mapped: number
  unmapped: number
  doNotMap: number
  coveragePct: number
}

export function summarizeMapping(rows: readonly PropertyMapRow[]): MappingSummary {
  const total = rows.length
  const mapped = rows.filter((r) => !r.doNotMap && r.targetProp != null).length
  const doNotMap = rows.filter((r) => r.doNotMap).length
  const unmapped = total - mapped - doNotMap
  return { total, mapped, unmapped, doNotMap, coveragePct: total === 0 ? 0 : Math.round((mapped / total) * 100) }
}

/* ── 3-step wizard state (Select source → Map properties → Review) ────────── */
export const WIZARD_STEPS: WizardStep[] = ['select', 'map', 'review']

export const WIZARD_STEP_LABELS: Record<WizardStep, string> = {
  select: 'Select source',
  map: 'Map properties',
  review: 'Review',
}

export function createEmptyWizardState(): WizardState {
  return { step: 'select', sourceId: null, rows: [] }
}

export function wizardWithSource(
  sourceId: string,
  sources: readonly PeerSource[],
  targetProps: readonly string[] = TARGET_PROPERTY_OPTIONS,
): WizardState {
  const source = sources.find((s) => s.id === sourceId)
  if (!source) return { ...createEmptyWizardState(), sourceId }
  return { step: 'map', sourceId, rows: buildPropertyMap(source.properties, targetProps) }
}

export function nextWizardStep(step: WizardStep): WizardStep {
  if (step === 'select') return 'map'
  if (step === 'map') return 'review'
  return 'review'
}

export function prevWizardStep(step: WizardStep): WizardStep {
  if (step === 'map') return 'select'
  if (step === 'review') return 'map'
  return 'select'
}

export interface WizardCheck {
  ok: boolean
  errors: string[]
}

export function canProceedWizard(state: WizardState, targetProps: readonly string[] = TARGET_PROPERTY_OPTIONS): WizardCheck {
  if (state.step === 'select') {
    return state.sourceId ? { ok: true, errors: [] } : { ok: false, errors: ['Select a source to continue'] }
  }
  if (state.step === 'map') {
    if (!state.sourceId) return { ok: false, errors: ['Select a source to continue'] }
    const v = validatePropertyMap(state.rows, targetProps)
    return { ok: v.ok, errors: v.errors }
  }
  // review
  if (!state.sourceId) return { ok: false, errors: ['Select a source to continue'] }
  const v = validatePropertyMap(state.rows, targetProps)
  return { ok: v.ok, errors: v.errors }
}
