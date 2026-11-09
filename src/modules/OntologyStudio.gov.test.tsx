// FN-GOV-001/002/003 (T-23) — governance helpers + Ontology Studio / DataHub panels.
// Glass tokens only at render; every mutating action logs appendTrace + appendAudit.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

import OntologyStudio, {
  computePendingChanges,
  makeOntologySnapshot,
  getHealthChecks,
} from './OntologyStudio'
import { getDatasetHealthChecks, makeDatasetSnapshot } from './DataHub'
import { OBJECT_TYPES, type ObjectType } from '../data/ontology'
import { ws } from '../store'

const readAudit = (): any[] => {
  try { return JSON.parse(localStorage.getItem('ontology-harness.audit') ?? '[]') } catch { return [] }
}

const clone = (types: ObjectType[]): ObjectType[] => JSON.parse(JSON.stringify(types))

beforeEach(() => {
  localStorage.clear()
  ws.meta = {}
  ws.traces.length = 0
  ws.datasets = []
  ws.objectTypes = clone(OBJECT_TYPES)
})

afterEach(() => cleanup())

describe('computePendingChanges (FN-GOV-001 review)', () => {
  it('clean tree has no pending changes', () => {
    expect(computePendingChanges(OBJECT_TYPES, clone(OBJECT_TYPES))).toEqual([])
  })

  it('detects add, rename, edit and delete', () => {
    const base = clone(OBJECT_TYPES)
    const cur = clone(OBJECT_TYPES)
    cur[0].name = 'Depot' // rename
    cur[1].backing = 'derived/other_path' // edit
    cur.push({ id: 'ot-new-x', name: 'New', icon: '✨', color: '#16a34a', backing: 'derived/new', objectCount: 0, description: '', properties: [{ name: 'id', type: 'String', indexed: true }] })
    cur.splice(cur.length - 2, 1) // delete one
    const pending = computePendingChanges(base, cur)
    const kinds = pending.map(p => p.kind).sort()
    expect(kinds).toEqual(['add', 'delete', 'edit', 'rename'])
    expect(pending.find(p => p.kind === 'rename')?.label).toContain('Warehouse')
    expect(pending.find(p => p.kind === 'add')?.id).toBe('ot-new-x')
  })
})

describe('makeOntologySnapshot (FN-GOV-002 RID) + getHealthChecks (FN-GOV-003)', () => {
  it('snapshot carries a deterministic RID and deep-copies the ontology', () => {
    const objs = clone(OBJECT_TYPES)
    const snap = makeOntologySnapshot(objs, '2026-01-01T00:00:00.000Z')
    expect(snap.id).toMatch(/^RID-/)
    expect(snap.id).toContain(`${objs.length}types`)
    expect(snap.at).toBe('2026-01-01T00:00:00.000Z')
    objs[0].name = 'Mutated'
    expect(snap.objects[0].name).not.toBe('Mutated')
  })

  it('seed ontology passes every health check', () => {
    const checks = getHealthChecks(clone(OBJECT_TYPES))
    expect(checks.length).toBeGreaterThanOrEqual(8)
    expect(checks.every(c => c.pass)).toBe(true)
  })

  it('health checks fail on unknown value type, duplicate property and missing title', () => {
    const bad = clone(OBJECT_TYPES)
    bad[0].properties = [
      { name: 'id', type: 'Nope/Unknown', indexed: false },
      { name: 'id', type: 'String', indexed: false },
    ]
    const byId = Object.fromEntries(getHealthChecks(bad).map(c => [c.id, c]))
    expect(byId['value-types-known']?.pass).toBe(false)
    expect(byId['no-duplicate-properties']?.pass).toBe(false)
    expect(byId['title-property']?.pass).toBe(false)
  })
})

describe('OntologyStudio governance UI (FN-GOV-001/002/003)', () => {
  it('Force snapshot adds a RID entry and records trace + audit', () => {
    render(<OntologyStudio />)
    expect(screen.getByTestId('gov-branch-bar')).toBeTruthy()
    expect(screen.getByTestId('gov-pending-count').textContent).toContain('Pending 0')
    fireEvent.click(screen.getByTestId('gov-force-snapshot'))
    expect(screen.getByTestId('gov-notice').textContent).toMatch(/Snapshot RID-/)
    const entry = document.querySelector('[data-testid^="rid-entry-"]')
    expect(entry).toBeTruthy()
    expect(screen.getByTestId('rid-history-panel').textContent).toMatch(/RID-/)
    expect(ws.traces.some(t => t.tool === 'ontology.snapshot' && t.ok)).toBe(true)
    expect(readAudit().some(a => a.event === 'ontology.snapshot')).toBe(true)
  })

  it('Restore rolls the working tree back to the snapshot and records trace + audit', () => {
    render(<OntologyStudio />)
    fireEvent.click(screen.getByTestId('gov-force-snapshot'))
    // mutate the tree, then restore
    fireEvent.click(screen.getByText('New object type'))
    expect(screen.getByTestId('gov-pending-count').textContent).toContain('Pending 1')
    const restoreBtn = document.querySelector('[data-testid^="rid-restore-"]') as HTMLElement
    expect(restoreBtn).toBeTruthy()
    fireEvent.click(restoreBtn)
    expect(screen.getByTestId('gov-pending-count').textContent).toContain('Pending 0')
    expect(ws.traces.some(t => t.tool === 'ontology.restore' && t.ok)).toBe(true)
    expect(readAudit().some(a => a.event === 'ontology.restore')).toBe(true)
  })

  it('Review lists the pending change and Rebase onto main clears it with trace + audit', () => {
    render(<OntologyStudio />)
    expect((screen.getByTestId('gov-rebase') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByText('New object type'))
    fireEvent.click(screen.getByTestId('gov-review-toggle'))
    expect(screen.getByTestId('gov-review-panel')).toBeTruthy()
    expect(screen.getByTestId('gov-review-panel').textContent).toMatch(/Add “New Object Type”|add/)
    fireEvent.click(screen.getByTestId('gov-rebase'))
    expect(screen.getByTestId('gov-pending-count').textContent).toContain('Pending 0')
    expect(screen.queryByTestId('gov-review-panel')).toBeNull()
    expect(ws.traces.some(t => t.tool === 'ontology.rebase' && t.ok)).toBe(true)
    expect(readAudit().some(a => a.event === 'ontology.rebase' && a.pending === 1)).toBe(true)
  })

  it('Run checks gates the clean ontology — all rules pass with trace + audit', () => {
    render(<OntologyStudio />)
    expect(screen.getByTestId('health-checks-panel')).toBeTruthy()
    // before the run every rule is pending
    expect(document.querySelector('[data-testid^="health-check-"] .pill-draft')).toBeTruthy()
    fireEvent.click(screen.getByTestId('health-run-checks'))
    const summary = screen.getByTestId('gov-health-summary').textContent ?? ''
    expect(summary).toMatch(/\d+\/\d+ health checks passing/)
    const passes = Number((summary.match(/^(\d+)\//) ?? ['0','0'])[1])
    expect(passes).toBeGreaterThanOrEqual(8)
    expect(document.querySelector('[data-testid^="health-check-"] .pill-live')).toBeTruthy()
    expect(ws.traces.some(t => t.tool === 'ontology.health-checks')).toBe(true)
    expect(readAudit().some(a => a.event === 'ontology.health-checks')).toBe(true)
  })
})

describe('DataHub dataset health + snapshots (FN-GOV-002/003)', () => {
  const cleanDataset: any = {
    id: 'ds-clean', name: 'clean.csv', importedAt: 'now', provenance: 'csv:clean.csv',
    hash: 'a'.repeat(64),
    columns: [
      { name: 'name', type: 'string' },
      { name: 'qty', type: 'number' },
    ],
    rows: [
      { name: 'alpha', qty: 3 },
      { name: 'beta', qty: 7 },
    ],
  }

  it('clean dataset passes all dataset health checks', () => {
    const checks = getDatasetHealthChecks(cleanDataset)
    expect(checks.length).toBe(5)
    expect(checks.every(c => c.pass)).toBe(true)
  })

  it('empty / high-null datasets fail rows-present and null-budget', () => {
    const empty = getDatasetHealthChecks(null)
    expect(empty.every(c => !c.pass)).toBe(true)
    const sparse: any = {
      ...cleanDataset,
      rows: [
        { name: '', qty: '' },
        { name: '', qty: '' },
      ],
    }
    const byId = Object.fromEntries(getDatasetHealthChecks(sparse).map(c => [c.id, c]))
    expect(byId['null-budget']?.pass).toBe(false)
    expect(byId['hash-verified']?.pass).toBe(true)
  })

  it('dataset snapshot RID deep-copies rows and columns', () => {
    const snap = makeDatasetSnapshot(cleanDataset, '2026-02-02T00:00:00.000Z')
    expect(snap.id).toMatch(/^RID-/)
    expect(snap.rowCount).toBe(2)
    cleanDataset.rows[0].name = 'mutated'
    expect(snap.rows[0].name).not.toBe('mutated')
    cleanDataset.rows[0].name = 'alpha' // restore fixture
  })
})
