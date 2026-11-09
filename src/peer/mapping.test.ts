// T-24 peer mapping helpers — peering job state machine + property map (FN-PEER-001/002/003).
import { describe, it, expect } from 'vitest'
import {
  ALL_JOB_STATUSES,
  PEER_FIXTURE_CONNECTIONS,
  PEER_FIXTURE_JOBS,
  PEER_FIXTURE_SOURCES,
  TARGET_PROPERTY_OPTIONS,
  buildPropertyMap,
  canProceedWizard,
  canSendAck,
  canStartExport,
  canTransition,
  createEmptyWizardState,
  filterJobsByStatus,
  isActiveJobStatus,
  isTerminalJobStatus,
  jobHealthForConnection,
  nextWizardStep,
  prevWizardStep,
  searchConnections,
  sendAck,
  setDoNotMap,
  sortJobsByUpdatedDesc,
  startExport,
  summarizeJobs,
  summarizeMapping,
  topologySummary,
  transitionJob,
  updatePropertyMapRow,
  validatePropertyMap,
  wizardWithSource,
  failJob,
  completeJob,
  type PeeringJob,
} from './mapping'

const job = (status: PeeringJob['status'], extra: Partial<PeeringJob> = {}): PeeringJob => ({
  id: 'job-test',
  connectionId: 'conn-north',
  status,
  createdAt: '2025-11-05T09:00:00.000Z',
  updatedAt: '2025-11-05T09:00:00.000Z',
  progress: 0,
  ...extra,
})

describe('peering job state machine', () => {
  it('allows the happy path idle → queued → exporting → awaiting-ack → acknowledged → completed', () => {
    expect(canTransition('idle', 'queued')).toBe(true)
    expect(canTransition('queued', 'exporting')).toBe(true)
    expect(canTransition('exporting', 'awaiting-ack')).toBe(true)
    expect(canTransition('awaiting-ack', 'acknowledged')).toBe(true)
    expect(canTransition('acknowledged', 'completed')).toBe(true)
    let j = job('idle')
    j = transitionJob(j, 'queued')
    j = transitionJob(j, 'exporting')
    j = transitionJob(j, 'awaiting-ack')
    expect(j.progress).toBe(100)
    j = transitionJob(j, 'acknowledged')
    expect(j.ackedAt).toBeTruthy()
    j = transitionJob(j, 'completed')
    expect(j.status).toBe('completed')
    expect(isTerminalJobStatus(j.status)).toBe(true)
  })

  it('rejects illegal transitions with RangeError', () => {
    expect(canTransition('idle', 'completed')).toBe(false)
    expect(canTransition('completed', 'queued')).toBe(false)
    expect(() => transitionJob(job('idle'), 'completed')).toThrow(RangeError)
    expect(() => transitionJob(job('completed'), 'queued')).toThrow(RangeError)
    expect(() => transitionJob(job('exporting'), 'acknowledged')).toThrow(RangeError)
  })

  it('startExport chains idle/failed through queued to exporting; sendAck requires awaiting-ack', () => {
    const started = startExport(job('idle'))
    expect(started.status).toBe('exporting')
    expect(canStartExport(job('idle'))).toBe(true)
    expect(canStartExport(job('exporting'))).toBe(false)
    expect(() => startExport(job('exporting'))).toThrow(RangeError)
    const restarted = startExport({ ...job('failed'), lastError: 'x' })
    expect(restarted.status).toBe('exporting')
    expect(restarted.lastError).toBeUndefined()

    expect(canSendAck(job('awaiting-ack'))).toBe(true)
    expect(canSendAck(job('exporting'))).toBe(false)
    expect(() => sendAck(job('exporting'))).toThrow(RangeError)
    const acked = sendAck(job('awaiting-ack'))
    expect(acked.status).toBe('acknowledged')
    expect(acked.ackedAt).toBeTruthy()
  })

  it('failJob records the reason and completeJob requires acknowledged', () => {
    const failed = failJob(job('exporting', { progress: 30 }), 'Remote unreachable')
    expect(failed.status).toBe('failed')
    expect(failed.lastError).toBe('Remote unreachable')
    expect(failed.progress).toBe(30)
    expect(() => failJob(job('completed'), 'x')).toThrow(RangeError)
    expect(completeJob(job('acknowledged')).status).toBe('completed')
    expect(() => completeJob(job('exporting'))).toThrow(RangeError)
  })

  it('summarizes job health and filters/sorts jobs', () => {
    expect(ALL_JOB_STATUSES).toContain('awaiting-ack')
    const health = jobHealthForConnection(PEER_FIXTURE_JOBS, 'conn-north')
    expect(health.total).toBe(2)
    expect(health.awaitingAck).toBe(1)
    expect(health.health).toBe('healthy')
    expect(jobHealthForConnection(PEER_FIXTURE_JOBS, 'conn-edge').health).toBe('attention')
    expect(summarizeJobs([]).health).toBe('idle')
    expect(filterJobsByStatus(PEER_FIXTURE_JOBS, 'failed')).toHaveLength(1)
    expect(filterJobsByStatus(PEER_FIXTURE_JOBS, 'all')).toHaveLength(PEER_FIXTURE_JOBS.length)
    expect(isActiveJobStatus('exporting')).toBe(true)
    expect(isActiveJobStatus('completed')).toBe(false)
    const sorted = sortJobsByUpdatedDesc(PEER_FIXTURE_JOBS)
    expect(sorted[0].updatedAt >= sorted[sorted.length - 1].updatedAt).toBe(true)
  })
})

describe('connections search + topology', () => {
  it('searchConnections matches name/remote/classification case-insensitively', () => {
    expect(searchConnections(PEER_FIXTURE_CONNECTIONS, '')).toHaveLength(3)
    expect(searchConnections(PEER_FIXTURE_CONNECTIONS, 'north')).toHaveLength(1)
    expect(searchConnections(PEER_FIXTURE_CONNECTIONS, 'CONFIDENTIAL')).toHaveLength(1)
    expect(searchConnections(PEER_FIXTURE_CONNECTIONS, 'foundry-partner')).toHaveLength(1)
    expect(searchConnections(PEER_FIXTURE_CONNECTIONS, 'nope')).toHaveLength(0)
  })

  it('topologySummary counts local/remote nodes and kinds', () => {
    const s = topologySummary(PEER_FIXTURE_CONNECTIONS[0])
    expect(s.localCount).toBe(3)
    expect(s.remoteCount).toBe(2)
    expect(s.total).toBe(5)
    expect(s.localKinds['object-type']).toBe(2)
    expect(s.localKinds['link-type']).toBe(1)
  })
})

describe('property map (FN-PEER-003)', () => {
  it('buildPropertyMap suggests exact-name matches and leaves the rest unmapped', () => {
    const rows = buildPropertyMap(['FacilityId', 'Carrier', 'Name'])
    expect(rows[0].targetProp).toBe('FacilityId')
    expect(rows[1].targetProp).toBeNull()
    expect(rows[2].targetProp).toBe('Name')
    expect(rows.every((r) => r.transform === 'identity' && !r.doNotMap)).toBe(true)
  })

  it('validatePropertyMap flags unmapped, duplicates, unknown targets, and do-not-map conflicts', () => {
    expect(validatePropertyMap([]).ok).toBe(false)
    const rows = buildPropertyMap(['FacilityId', 'Carrier'])
    const v1 = validatePropertyMap(rows)
    expect(v1.ok).toBe(false)
    expect(v1.errors.join(' ')).toMatch(/Unmapped/)
    expect(v1.unmapped).toBe(1)

    const dup = [
      { sourceProp: 'A', targetProp: 'Name', transform: 'identity' as const, doNotMap: false },
      { sourceProp: 'B', targetProp: 'Name', transform: 'identity' as const, doNotMap: false },
    ]
    expect(validatePropertyMap(dup).errors.join(' ')).toMatch(/Duplicate/)

    const unknown = [{ sourceProp: 'A', targetProp: 'Nope', transform: 'identity' as const, doNotMap: false }]
    expect(validatePropertyMap(unknown, TARGET_PROPERTY_OPTIONS).errors.join(' ')).toMatch(/Unknown/)

    const conflict = [{ sourceProp: 'A', targetProp: 'Name', transform: 'identity' as const, doNotMap: true }]
    expect(validatePropertyMap(conflict).errors.join(' ')).toMatch(/Do not map/)
  })

  it('updatePropertyMapRow + setDoNotMap are immutable and do-not-map clears the target', () => {
    const rows = buildPropertyMap(['FacilityId', 'Carrier'])
    const next = setDoNotMap(rows, 'Carrier', true)
    expect(next.find((r) => r.sourceProp === 'Carrier')?.doNotMap).toBe(true)
    expect(next.find((r) => r.sourceProp === 'Carrier')?.targetProp).toBeNull()
    expect(rows.find((r) => r.sourceProp === 'Carrier')?.doNotMap).toBe(false)
    const mapped = updatePropertyMapRow(next, 'Carrier', { targetProp: 'Name' })
    expect(mapped.find((r) => r.sourceProp === 'Carrier')?.doNotMap).toBe(false)
    expect(mapped.find((r) => r.sourceProp === 'Carrier')?.targetProp).toBe('Name')
    const lowered = updatePropertyMapRow(rows, 'FacilityId', { transform: 'lowercase' })
    expect(lowered[0].transform).toBe('lowercase')
  })

  it('summarizeMapping computes mapped/doNotMap/coverage', () => {
    const rows = [
      { sourceProp: 'A', targetProp: 'Name', transform: 'identity' as const, doNotMap: false },
      { sourceProp: 'B', targetProp: null, transform: 'identity' as const, doNotMap: true },
      { sourceProp: 'C', targetProp: null, transform: 'identity' as const, doNotMap: false },
      { sourceProp: 'D', targetProp: 'Region', transform: 'identity' as const, doNotMap: false },
    ]
    const s = summarizeMapping(rows)
    expect(s).toEqual({ total: 4, mapped: 2, unmapped: 1, doNotMap: 1, coveragePct: 50 })
    expect(summarizeMapping([]).coveragePct).toBe(0)
  })
})

describe('3-step wizard state', () => {
  it('blocks select without a source and map with unmapped rows; review requires a valid map', () => {
    const empty = createEmptyWizardState()
    expect(empty.step).toBe('select')
    expect(canProceedWizard(empty).ok).toBe(false)

    const withSource = wizardWithSource('src-facility', PEER_FIXTURE_SOURCES)
    expect(withSource.step).toBe('map')
    expect(withSource.rows.length).toBeGreaterThan(0)
    // Fixture source properties all exist as target options, so the suggested map is valid.
    expect(canProceedWizard(withSource).ok).toBe(true)

    const shipment = wizardWithSource('src-shipment', PEER_FIXTURE_SOURCES)
    // Carrier has no exact target → cannot proceed until mapped or do-not-mapped.
    expect(canProceedWizard(shipment).ok).toBe(false)
    const fixed = setDoNotMap(shipment.rows, 'Carrier', true)
    expect(canProceedWizard({ ...shipment, rows: fixed }).ok).toBe(true)
  })

  it('steps forward/backward between Select source → Map properties → Review', () => {
    expect(nextWizardStep('select')).toBe('map')
    expect(nextWizardStep('map')).toBe('review')
    expect(nextWizardStep('review')).toBe('review')
    expect(prevWizardStep('review')).toBe('map')
    expect(prevWizardStep('map')).toBe('select')
    expect(prevWizardStep('select')).toBe('select')
  })
})
