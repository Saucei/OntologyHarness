// PeerManager — connections home (FN-PEER-001), topology + jobs (FN-PEER-002),
// 3-step mapping wizard (FN-PEER-003). UNREGISTERED module; render-tested directly.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import PeerManager from './PeerManager'
import { ws } from '../store'

const readAudit = (): any[] => {
  try {
    return JSON.parse(localStorage.getItem('ontology-harness.audit') ?? '[]')
  } catch {
    return []
  }
}

beforeEach(() => {
  localStorage.clear()
  ws.meta = {}
  ws.traces.length = 0
})
afterEach(() => cleanup())

describe('PeerManager connections home + overview (FN-PEER-001/002)', () => {
  it('renders the connections home list with statuses and job health', () => {
    render(<PeerManager />)
    expect(screen.getByTestId('peer-manager')).toBeTruthy()
    expect(screen.getByTestId('peer-connections-home')).toBeTruthy()
    for (const name of ['North Campus — PROD', 'Partner Org — UAT', 'Edge Hub — Archive']) {
      expect(screen.getByText(name)).toBeTruthy()
    }
    expect(screen.getByTestId('peer-connection-row-conn-north')).toBeTruthy()
    expect(screen.getByTestId('peer-connection-row-conn-partner')).toBeTruthy()
    expect(screen.getByTestId('peer-connection-row-conn-edge')).toBeTruthy()
    // stuck/failed edge job surfaces as attention health
    expect(screen.getByTestId('peer-connection-row-conn-edge').textContent).toMatch(/failed/)
    expect(screen.getByLabelText('Search connections')).toBeTruthy()
  })

  it('search narrows the home list', () => {
    render(<PeerManager />)
    fireEvent.change(screen.getByTestId('peer-search'), { target: { value: 'partner' } })
    expect(screen.queryByTestId('peer-connection-row-conn-north')).toBeFalsy()
    expect(screen.getByTestId('peer-connection-row-conn-partner')).toBeTruthy()
  })

  it('overview shows local/remote topology and peering jobs with Start export / Send Ack gating', () => {
    render(<PeerManager />)
    expect(screen.getByTestId('peer-topology-overview')).toBeTruthy()
    expect(screen.getByTestId('peer-local-topology').textContent).toContain('Facility')
    expect(screen.getByTestId('peer-remote-topology').textContent).toContain('Region')
    expect(screen.getByTestId('peer-topology-summary').textContent).toMatch(/5 nodes/)
    // north: one awaiting-ack (Ack only), one idle (Start only)
    expect((screen.getByTestId('peer-job-ack-job-north-1') as HTMLButtonElement).disabled).toBe(false)
    expect((screen.getByTestId('peer-job-start-job-north-1') as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByTestId('peer-job-start-job-north-2') as HTMLButtonElement).disabled).toBe(false)
    expect((screen.getByTestId('peer-job-ack-job-north-2') as HTMLButtonElement).disabled).toBe(true)
    // job filter narrows the list
    expect(screen.getAllByTestId(/^peer-job-row-/)).toHaveLength(2)
    fireEvent.change(screen.getByTestId('peer-job-filter'), { target: { value: 'awaiting-ack' } })
    expect(screen.getAllByTestId(/^peer-job-row-/)).toHaveLength(1)
  })

  it('Start export moves a job to exporting and records trace + audit', () => {
    render(<PeerManager />)
    fireEvent.click(screen.getByTestId('peer-job-start-job-north-2'))
    expect(screen.getByTestId('peer-job-row-job-north-2').textContent).toMatch(/exporting/)
    expect(screen.getByTestId('peer-action-msg').textContent).toMatch(/Start export/)
    expect(ws.traces.some((t) => t.tool === 'peer.job.start-export' && t.ok)).toBe(true)
    expect(readAudit().some((a) => a.event === 'peer.job.start-export')).toBe(true)
  })

  it('Send Ack moves a job to acknowledged and records trace + audit', () => {
    render(<PeerManager />)
    fireEvent.click(screen.getByTestId('peer-job-ack-job-north-1'))
    expect(screen.getByTestId('peer-job-row-job-north-1').textContent).toMatch(/acknowledged/)
    expect(screen.getByTestId('peer-action-msg').textContent).toMatch(/Ack sent/)
    expect(ws.traces.some((t) => t.tool === 'peer.job.send-ack' && t.ok)).toBe(true)
    expect(readAudit().some((a) => a.event === 'peer.job.send-ack')).toBe(true)
  })

  it('Connect / Disconnect toggles status and records trace + audit', () => {
    render(<PeerManager />)
    fireEvent.click(screen.getByTestId('peer-connect-conn-north'))
    expect(screen.getByTestId('peer-connection-row-conn-north').textContent).toMatch(/disconnected/)
    expect(screen.getByTestId('peer-action-msg').textContent).toMatch(/Disconnected/)
    expect(ws.traces.some((t) => t.tool === 'peer.disconnect' && t.ok)).toBe(true)
    expect(readAudit().some((a) => a.event === 'peer.disconnect')).toBe(true)

    fireEvent.click(screen.getByTestId('peer-connect-conn-edge'))
    expect(screen.getByTestId('peer-connection-row-conn-edge').textContent).toMatch(/connected/)
    expect(ws.traces.some((t) => t.tool === 'peer.connect' && t.ok)).toBe(true)
  })
})

describe('PeerManager mapping wizard (FN-PEER-003)', () => {
  it('runs Select source → Map properties → Review, updates the map, and finishes with trace + audit', () => {
    render(<PeerManager />)
    fireEvent.click(screen.getByTestId('peer-open-wizard'))
    expect(screen.getByTestId('peer-mapping-wizard')).toBeTruthy()
    expect(screen.getByTestId('peer-wizard-step-select')).toBeTruthy()
    expect(screen.getByRole('dialog')).toBeTruthy()

    // Step 1: pick a source (jumps to Map)
    fireEvent.click(screen.getByTestId('peer-source-src-shipment'))
    expect(screen.getByTestId('peer-wizard-step-map')).toBeTruthy()
    expect(screen.getByTestId('peer-map-row-Carrier')).toBeTruthy()
    // Carrier starts unmapped → Next is blocked until it is dealt with
    fireEvent.click(screen.getByTestId('peer-wizard-next'))
    expect(screen.getByTestId('peer-wizard-errors').textContent).toMatch(/Unmapped/)
    expect(screen.getByTestId('peer-wizard-step-map')).toBeTruthy()

    // Map: mark Carrier as Do not map (FN-PEER-003 "Do not map property")
    fireEvent.click(screen.getByTestId('peer-map-donotmap-Carrier'))
    expect((screen.getByTestId('peer-map-target-Carrier') as HTMLSelectElement).disabled).toBe(true)

    // Step 3: Review shows the summary
    fireEvent.click(screen.getByTestId('peer-wizard-next'))
    expect(screen.getByTestId('peer-wizard-step-review')).toBeTruthy()
    expect(screen.getByTestId('peer-mapping-summary').textContent).toMatch(/5\/6 mapped/)
    expect(screen.getByTestId('peer-mapping-summary').textContent).toMatch(/83% coverage/)

    // Finish: persists mapping to ws.meta, queues a job, closes the wizard
    fireEvent.click(screen.getByTestId('peer-wizard-finish'))
    expect(screen.queryByTestId('peer-mapping-wizard')).toBeFalsy()
    const saved = (ws.meta?.peerMapping ?? {}) as any
    expect(saved.sourceId).toBe('src-shipment')
    expect(saved.rows.find((r: any) => r.sourceProp === 'Carrier')?.doNotMap).toBe(true)
    expect(saved.connectionId).toBeTruthy()
    expect(ws.traces.some((t) => t.tool === 'peer.wizard.finish' && t.ok)).toBe(true)
    expect(ws.traces.some((t) => t.tool === 'peer.wizard.select-source' && t.ok)).toBe(true)
    expect(ws.traces.some((t) => t.tool === 'peer.wizard.step' && t.ok)).toBe(true)
    const audit = readAudit()
    expect(audit.some((a) => a.event === 'peer.wizard.finish')).toBe(true)
    expect(audit.some((a) => a.event === 'peer.wizard.select-source')).toBe(true)
  })

  it('maps a property to a target and shows it in Review; Back returns a step', () => {
    render(<PeerManager />)
    fireEvent.click(screen.getByTestId('peer-open-wizard'))
    fireEvent.click(screen.getByTestId('peer-source-src-shipment'))
    // Carrier unmapped: assign a target instead of do-not-map
    fireEvent.change(screen.getByTestId('peer-map-target-Carrier'), { target: { value: 'Name' } })
    fireEvent.click(screen.getByTestId('peer-wizard-next'))
    expect(screen.getByTestId('peer-wizard-step-review')).toBeTruthy()
    const review = screen.getByTestId('peer-wizard-step-review')
    expect(review.textContent).toContain('Carrier')
    expect(review.textContent).toContain('Name')
    fireEvent.click(screen.getByTestId('peer-wizard-back'))
    expect(screen.getByTestId('peer-wizard-step-map')).toBeTruthy()
  })

  it('Escape closes the wizard and records the close', () => {
    render(<PeerManager />)
    fireEvent.click(screen.getByTestId('peer-open-wizard'))
    expect(screen.getByTestId('peer-mapping-wizard')).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByTestId('peer-mapping-wizard')).toBeFalsy()
    expect(ws.traces.some((t) => t.tool === 'peer.wizard.close' && t.ok)).toBe(true)
    expect(readAudit().some((a) => a.event === 'peer.wizard.close')).toBe(true)
  })
})
