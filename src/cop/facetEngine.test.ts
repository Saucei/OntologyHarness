// facetEngine — pure helper tests (FN-GEO-002 / T-20): filter + histogram + linkage.
import { describe, it, expect } from 'vitest'
import {
  buildFacets,
  buildHistogramBins,
  buildSelectionAwareFacets,
  clampDateRange,
  dataTimeDomain,
  filterPoints,
  highlightedIds,
  linkedFacetValues,
  pointTime,
  resolveLinkedSelection,
  toggleFacetValue,
  type FacetablePoint,
} from './facetEngine'

const PTS: FacetablePoint[] = [
  { id: 'a', label: 'A', category: 'Stage', status: 'Successful', value: 10, date: '2025-10-01T00:00:00Z' },
  { id: 'b', label: 'B', category: 'Stage', status: 'Successful', value: 30, date: '2025-10-03T00:00:00Z' },
  { id: 'c', label: 'C', category: 'Raw Material', status: 'Cancelled', value: 5, date: '2025-10-05T00:00:00Z' },
  { id: 'd', label: 'D', category: 'Customer', status: 'Diverted', value: 8, date: '2025-10-07T00:00:00Z' },
  { id: 'e', label: 'E', category: 'Customer', status: 'Successful', value: 4 }, // undated
]

describe('facetEngine — buildFacets', () => {
  it('produces count badges + totalValue per category/status, count-desc sorted', () => {
    const g = buildFacets(PTS)
    // Stage and Customer tie at count=2 -> alphabetical tie-break (Customer first);
    // Stage(2) sorts ahead of Raw Material(1) by count-desc.
    expect(g.categories.map(f => f.value)).toEqual(['Customer', 'Stage', 'Raw Material'])
    expect(g.categories.find(f => f.value === 'Stage')).toMatchObject({ value: 'Stage', count: 2, totalValue: 40 })
    expect(g.categories.find(f => f.value === 'Customer')).toMatchObject({ count: 2, totalValue: 12 })
    expect(g.statuses.find(f => f.value === 'Successful')).toMatchObject({ count: 3, totalValue: 44 })
    expect(g.statuses.find(f => f.value === 'Cancelled')).toMatchObject({ count: 1, totalValue: 5 })
  })

  it('skips empty category/status values', () => {
    const g = buildFacets([{ id: 'x', value: 3 }, { id: 'y', category: '', status: '' }])
    expect(g.categories).toEqual([])
    expect(g.statuses).toEqual([])
  })
})

describe('facetEngine — filterPoints', () => {
  it('filters by category + status + date range (undated excluded only when a range is set)', () => {
    const sel = { categories: ['Stage'], statuses: ['Successful'], dateRange: [Date.parse('2025-10-02T00:00:00Z'), Date.parse('2025-10-07T00:00:00Z')] as [number, number] }
    expect(filterPoints(PTS, sel).map(p => p.id)).toEqual(['b'])
    // no date range: undated point e passes category/status filters
    expect(filterPoints(PTS, { categories: ['Customer'], statuses: ['Successful'], dateRange: null }).map(p => p.id)).toEqual(['e'])
    // empty selection passes everything
    expect(filterPoints(PTS, { categories: [], statuses: [], dateRange: null })).toHaveLength(5)
  })

  it('toggleFacetValue adds and removes without mutating input', () => {
    const start = ['Stage']
    expect(toggleFacetValue(start, 'Customer')).toEqual(['Stage', 'Customer'])
    expect(toggleFacetValue(start, 'Stage')).toEqual([])
    expect(start).toEqual(['Stage'])
  })
})

describe('facetEngine — histogram bins + domain + clamp', () => {
  it('builds equal-width bins that conserve the dated count', () => {
    const bins = buildHistogramBins(PTS, 4)
    expect(bins).toHaveLength(4)
    expect(bins.reduce((s, b) => s + b.count, 0)).toBe(4) // 4 dated points (e is undated)
    expect(bins[0].count).toBeGreaterThanOrEqual(1)
    expect(bins[3].count).toBeGreaterThanOrEqual(1) // latest point lands in the last bin
    expect(buildHistogramBins([{ id: 'x', value: 1 }], 12)).toEqual([])
  })

  it('domain spans dated extremes; clampDateRange normalizes + clamps', () => {
    const dom = dataTimeDomain(PTS)!
    expect(dom[0]).toBe(Date.parse('2025-10-01T00:00:00Z'))
    expect(dom[1]).toBe(Date.parse('2025-10-07T00:00:00Z'))
    expect(clampDateRange(null, dom)).toBeNull()
    expect(clampDateRange([dom[0] - 1000, dom[1] + 1000], dom)).toEqual(dom)
    // reversed ends are ordered
    expect(clampDateRange([dom[1], dom[0]], dom)).toEqual(dom)
    expect(pointTime(PTS[4])).toBeNull()
    expect(pointTime(PTS[0])).toBe(Date.parse('2025-10-01T00:00:00Z'))
  })

  it('selection-aware facets respect the other dimension filter', () => {
    const g = buildSelectionAwareFacets(PTS, { categories: [], statuses: ['Successful'], dateRange: null })
    // categories counted within Successful only: Recipe(2) + Customer(1: undated e)
    expect(g.categories.find(f => f.value === 'Stage')).toMatchObject({ count: 2, totalValue: 40 })
    expect(g.categories.find(f => f.value === 'Customer')).toMatchObject({ count: 1, totalValue: 4 })
    expect(g.categories.find(f => f.value === 'Raw Material')).toBeUndefined()
  })
})

describe('facetEngine — linkage selection', () => {
  it('resolves the linked point, its facet values, and highlight ids', () => {
    const filtered = filterPoints(PTS, { categories: [], statuses: [], dateRange: null })
    expect(resolveLinkedSelection(filtered, 'c')?.id).toBe('c')
    expect(resolveLinkedSelection(filtered, 'nope')).toBeNull()
    expect(linkedFacetValues(resolveLinkedSelection(filtered, 'c'))).toEqual({ category: 'Raw Material', status: 'Cancelled' })
    expect(highlightedIds(filtered, 'c')).toEqual(['c'])
    // selection filtered out => no highlight (sync-safe)
    const narrow = filterPoints(PTS, { categories: ['Stage'], statuses: [], dateRange: null })
    expect(highlightedIds(narrow, 'c')).toEqual([])
    expect(linkedFacetValues(null)).toEqual({ category: null, status: null })
  })
})
