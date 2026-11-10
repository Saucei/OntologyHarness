// T-31 Data & Link Closeout — FN-ARC-002, FN-DAT-001/002/003, FN-ONT-003, FN-BLD-017, FN-FLT-006/007.
// One suite per host area touched. Glass tokens only at render; every mutation logs trace + audit.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

import { BRANCH_NODES, isPromotable, promotionPath, branchGraphStats } from './GraphCanvas'
import {
  applyCleanTransform,
  buildUnionPreview,
  validateDeployConfig,
  computeDeployProfile,
  normalizeColumnName,
} from './DataHub'
import DataHub from './DataHub'
import OntologyStudio, {
  validateLinkDraft,
  createManagedLink,
  toggleFavoriteId,
  isFavorite,
  validateFilterVariant,
  formatFilterValue,
} from './OntologyStudio'
import { OBJECT_TYPES } from '../data/ontology'
import { ws } from '../store'

const readAudit = (): any[] => {
  try { return JSON.parse(localStorage.getItem('ontology-harness.audit') ?? '[]') } catch { return [] }
}

beforeEach(() => {
  localStorage.clear()
  ws.meta = {}
  ws.traces.length = 0
  ws.datasets = []
  ws.objectTypes = JSON.parse(JSON.stringify(OBJECT_TYPES))
})
afterEach(() => cleanup())

/* ── Host 1: GraphCanvas — FN-ARC-002 branch graph ── */
describe('GraphCanvas branch graph helpers (FN-ARC-002)', () => {
  it('models Master/Dev/Feature Y/Feature X/Oct sources and PROD/UAT targets', () => {
    const stats = branchGraphStats()
    expect(stats.sources).toBe(5)
    expect(stats.targets).toBe(2)
    expect(stats.edges).toBeGreaterThan(0)
    expect(BRANCH_NODES.map(n => n.id)).toEqual(expect.arrayContaining(['master', 'dev', 'feature-y', 'feature-x', 'oct', 'prod', 'uat']))
  })

  it('promotionPath finds a path and isPromotable guards direct edges', () => {
    expect(promotionPath('master', 'prod')).toEqual(['master', 'prod'])
    expect(promotionPath('feature-y', 'prod')).toBeNull()
    expect(isPromotable('oct', 'uat')).toBe(true)
    expect(isPromotable('uat', 'prod')).toBe(false)
  })
})

/* ── Host 2: DataHub — FN-DAT-001/002/003 clean/union/deploy ── */
const sampleDataset: any = {
  id: 'ds-1',
  name: 'sample.csv',
  importedAt: 'now',
  provenance: 'csv:sample.csv',
  hash: 'a'.repeat(64),
  columns: [
    { name: 'Model Name', type: 'string' },
    { name: 'qty', type: 'number' },
    { name: 'build_date', type: 'string' },
  ],
  rows: [
    { 'Model Name': 'Sedan S1', qty: 3, build_date: '2026-01-02' },
    { 'Model Name': '', qty: 0, build_date: '2026-01-03' },
    { 'Model Name': 'Crossover X2', qty: 7, build_date: '2026-01-04' },
  ],
}

describe('DataHub clean/union/deploy helpers (FN-DAT-001/002/003)', () => {
  it('applyCleanTransform normalizes names, casts Timestamp, filters not-null and drops columns', () => {
    expect(normalizeColumnName(' Product Name ')).toBe('Product_Name')
    const res = applyCleanTransform(sampleDataset, {
      normalizeNames: true,
      filterNotNull: true,
      dropColumns: ['qty'],
      renames: {},
      castTimestampColumns: ['build_date'],
    })
    expect(res.dataset.columns.map(c => c.name)).toEqual(['Model_Name', 'build_date'])
    expect(res.dataset.columns.find(c => c.name === 'build_date')?.type).toBe('date')
    expect(res.dataset.rows.length).toBe(2)
    expect(res.droppedRows).toBe(1)
    expect(res.droppedCols).toBe(1)
    expect(res.dataset.rows[0].build_date).toMatch(/^2026-01-02/)
  })

  it('buildUnionPreview merges schema and caps preview rows; deploy validation + profile guard', () => {
    const preview = buildUnionPreview([sampleDataset])
    expect(preview.rowCount).toBe(3)
    expect(preview.colCount).toBe(3)
    expect(preview.previewRows.length).toBe(3)
    expect(validateDeployConfig(null, [], 'standard').length).toBeGreaterThan(0)
    expect(validateDeployConfig(sampleDataset, ['Model Name'], 'standard')).toEqual([])
    const prof = computeDeployProfile(sampleDataset)
    expect(prof.rowCount).toBe(3)
    expect(prof.colCount).toBe(3)
  })

  it('DataHub renders clean/union/deploy panels with deploy status badge', () => {
    render(<DataHub />)
    expect(screen.getByTestId('data-clean-panel')).toBeTruthy()
    expect(screen.getByTestId('data-union-panel')).toBeTruthy()
    expect(screen.getByTestId('data-deploy-panel')).toBeTruthy()
    expect(screen.getByTestId('deploy-status-badge').textContent).toContain('deploy: idle')
    expect(screen.getByTestId('data-clean-open').textContent).toMatch(/Clean/)
    expect(screen.getByTestId('data-deploy-open').textContent).toMatch(/Deploy/)
  })
})

/* ── Host 3: OntologyStudio — FN-ONT-003, FN-BLD-017, FN-FLT-006/007 ── */
describe('OntologyStudio link/favorites/filter helpers (FN-ONT-003, FN-BLD-017, FN-FLT-006/007)', () => {
  it('validateLinkDraft rejects blank name and same from/to; createManagedLink builds a link', () => {
    expect(validateLinkDraft({ name: '', from: OBJECT_TYPES[0].id, to: OBJECT_TYPES[1].id, cardinality: 'N ↔ N', enabled: true }, OBJECT_TYPES).length).toBeGreaterThan(0)
    expect(validateLinkDraft({ name: 'Supplied By', from: OBJECT_TYPES[0].id, to: OBJECT_TYPES[0].id, cardinality: 'N ↔ N', enabled: true }, OBJECT_TYPES).join()).toMatch(/differ/i)
    const made = createManagedLink({ name: 'Supplied By', from: OBJECT_TYPES[0].id, to: OBJECT_TYPES[1].id, cardinality: 'N ↔ N', enabled: true }, 12345)
    expect(made.name).toBe('Supplied By')
    expect(made.enabled).toBe(true)
  })

  it('favorites toggle + filter variant validation/format are pure and boundary-checked', () => {
    expect(toggleFavoriteId([], 'ot-warehouse')).toEqual(['ot-warehouse'])
    expect(toggleFavoriteId(['ot-warehouse'], 'ot-warehouse')).toEqual([])
    expect(isFavorite(['ot-warehouse'], 'ot-warehouse')).toBe(true)
    expect(validateFilterVariant({ layout: 'pills', defaultValue: 'bbl', prefix: '', suffix: '' })).toEqual([])
    expect(validateFilterVariant({ layout: 'pills', defaultValue: 'x_bbl', prefix: 'pre_', suffix: '_bbl' }).join()).toMatch(/prefix/i)
    expect(formatFilterValue('bbl', '', '')).toBe('bbl')
    expect(formatFilterValue('7', 'qty_', '_cnt')).toBe('qty_7_cnt')
  })

  it('OntologyStudio link dialog creates a link with trace + audit', () => {
    render(<OntologyStudio />)
    fireEvent.click(screen.getByText('Link types'))
    fireEvent.click(screen.getByTestId('link-create-open') as any)
    expect(screen.getByTestId('link-create-dialog')).toBeTruthy()
    fireEvent.change(screen.getByTestId('link-name'), { target: { value: 'Supplied By' } })
    fireEvent.click(screen.getByTestId('link-save'))
    expect(ws.traces.some(t => String(t.tool).includes('link.create'))).toBe(true)
    expect(readAudit().some(a => String(a.event).includes('link.create'))).toBe(true)
  })

  it('OntologyStudio favorites Star view filters the list and persists', () => {
    render(<OntologyStudio />)
    const star = screen.getByTestId('star-ot-warehouse')
    fireEvent.click(star)
    expect(star.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByTestId('star-view-favorites'))
    expect(screen.getByTestId('star-view-favorites').textContent).toContain('Favorites')
    expect(screen.queryByTestId('star-ot-process')).toBeNull()
    expect(ws.traces.some(t => t.tool === 'ontology.favorite.toggle')).toBe(true)
    expect(readAudit().some(a => a.event === 'ontology.favorite.toggle')).toBe(true)
  })

  it('OntologyStudio filter variants switch layout and validate prefix/suffix', () => {
    render(<OntologyStudio />)
    expect(screen.getByTestId('filter-variants-panel')).toBeTruthy()
    fireEvent.click(screen.getByTestId('filter-layout-pills'))
    expect(screen.getByTestId('filter-preview-pills')).toBeTruthy()
    fireEvent.change(screen.getByTestId('filter-prefix'), { target: { value: 'pre_' } })
    fireEvent.change(screen.getByTestId('filter-default'), { target: { value: 'bbl' } })
    fireEvent.click(screen.getByTestId('filter-save'))
    expect(screen.getByTestId('filter-error').textContent).toMatch(/prefix|Default/i)
    expect(ws.traces.some(t => t.tool === 'ontology.filter.save' && t.ok === false)).toBe(true)
  })
})
