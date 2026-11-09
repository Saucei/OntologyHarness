// T-20 facet rail + histogram + map-table linkage tests (FN-GEO-002).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import MapCanvas, { DEFAULT_CLUSTER_CONFIG } from './MapCanvas'
import type { MapPoint } from './MapCanvas'
import MapModule, { DISPATCH_FIXTURES } from '../modules/MapModule'
import { EMPTY_SELECTION } from '../cop/facetEngine'
import type { FacetSelection } from '../cop/facetEngine'

const PTS: MapPoint[] = [
  { id: 'a', label: 'Alpha Site', point: { lat: 40.7128, lng: -74.006 }, value: 10, category: 'Recipe', status: 'Successful', date: '2025-10-01T00:00:00Z' },
  { id: 'b', label: 'Bravo Site', point: { lat: 38.9, lng: -77.03 }, value: 30, category: 'Raw Material', status: 'Cancelled', date: '2025-10-05T00:00:00Z' },
  { id: 'c', label: 'Charlie Site', point: { lat: 41.87, lng: -87.62 }, value: 8, category: 'Customer', status: 'Diverted', date: '2025-10-07T00:00:00Z' },
]

describe('T-20 facet rail + histogram + map-table linkage', () => {
  beforeEach(() => { localStorage.clear() })
  afterEach(() => cleanup())

  it('facet rail renders count badges + histogram; clicking a facet filters map + table', () => {
    const onFacetChange = vi.fn()
    const selection: FacetSelection = { ...EMPTY_SELECTION }
    const { rerender } = render(
      <MapCanvas
        points={PTS}
        config={{ ...DEFAULT_CLUSTER_CONFIG, layerType: 'point' }}
        facetSelection={selection}
        onFacetChange={onFacetChange}
        showFacetRail
        showTable
      />,
    )
    expect(screen.getByTestId('facet-rail')).toBeTruthy()
    expect(screen.getByTestId('histogram-brush')).toBeTruthy()
    expect(screen.getByTestId('cop-table')).toBeTruthy()
    // count badges: Recipe=1, Raw Material=1, Customer=1
    expect(screen.getByTestId('facet-categories-Recipe').textContent).toMatch(/1/)
    // table initially shows all rows
    expect(document.querySelectorAll('[data-testid^="cop-table-row-"]').length).toBe(3)
    // click the Raw Material facet checkbox
    fireEvent.click(screen.getByLabelText(/Filter by category Raw Material/))
    expect(onFacetChange).toHaveBeenCalledTimes(1)
    expect(onFacetChange.mock.calls[0][0].categories).toEqual(['Raw Material'])

    // rerender with the filter applied -> map + table both narrowed to 1 point
    rerender(
      <MapCanvas
        points={PTS}
        config={{ ...DEFAULT_CLUSTER_CONFIG, layerType: 'point' }}
        facetSelection={{ categories: ['Raw Material'], statuses: [], dateRange: null }}
        onFacetChange={onFacetChange}
        showFacetRail
        showTable
      />,
    )
    expect(document.querySelectorAll('[data-testid^="cop-table-row-"]').length).toBe(1)
    expect(screen.getByTestId('cop-table-row-b')).toBeTruthy()
    expect(document.querySelector('[data-testid="map-point-a"]')).toBeNull()
    expect(screen.getByTestId('map-point-b')).toBeTruthy()
  })

  it('table row + map point highlight sync via shared selection', () => {
    render(
      <MapCanvas
        points={PTS}
        config={{ ...DEFAULT_CLUSTER_CONFIG, layerType: 'point' }}
        facetSelection={{ ...EMPTY_SELECTION }}
        showFacetRail
        showTable
      />,
    )
    fireEvent.click(screen.getByTestId('cop-table-row-a'))
    expect(screen.getByTestId('cop-table-row-a').getAttribute('aria-selected')).toBe('true')
    expect(screen.getByTestId('map-canvas').getAttribute('aria-label')).toMatch(/Alpha Site/)
    // linked facet row is highlighted too
    expect(screen.getByTestId('facet-categories-Recipe').getAttribute('data-linked')).toBe('true')
  })

  it('histogram brush date filter narrows the map to the brushed window', () => {
    const { rerender } = render(
      <MapCanvas
        points={PTS}
        config={{ ...DEFAULT_CLUSTER_CONFIG, layerType: 'point' }}
        facetSelection={{ ...EMPTY_SELECTION }}
        showFacetRail
        showTable
      />,
    )
    expect(screen.getByTestId('histogram-brush-area')).toBeTruthy()
    // brush window covering only 2025-10-01 (point a)
    const range: [number, number] = [Date.parse('2025-10-01T00:00:00Z'), Date.parse('2025-10-02T00:00:00Z')]
    rerender(
      <MapCanvas
        points={PTS}
        config={{ ...DEFAULT_CLUSTER_CONFIG, layerType: 'point' }}
        facetSelection={{ categories: [], statuses: [], dateRange: range }}
        showFacetRail
        showTable
      />,
    )
    expect(document.querySelectorAll('[data-testid^="cop-table-row-"]').length).toBe(1)
    expect(screen.getByTestId('cop-table-row-a')).toBeTruthy()
  })

  it('MapModule wires dispatch fixtures through the COP rail with dates', () => {
    render(<MapModule />)
    expect(screen.getByTestId('facet-rail')).toBeTruthy()
    expect(screen.getByTestId('histogram-brush')).toBeTruthy()
    expect(screen.getByTestId('cop-table')).toBeTruthy()
    expect(DISPATCH_FIXTURES.every(p => typeof p.date === 'string')).toBe(true)
    // all fixtures visible initially
    expect(document.querySelectorAll('[data-testid^="cop-table-row-"]').length).toBe(DISPATCH_FIXTURES.length)
  })
})
