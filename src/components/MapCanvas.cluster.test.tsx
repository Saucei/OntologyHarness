// T-19 cluster/bubble + metric-card tests (FN-GEO-001 detail, FN-GEO-003).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import MapCanvas, {
  aggregateByGeohash,
  buildMetricCards,
  summarizeDispatch,
  sanitizeClusterConfig,
  scaledBubbleRadius,
  DEFAULT_CLUSTER_CONFIG,
} from './MapCanvas'
import type { MapPoint } from './MapCanvas'
import MapModule, { DISPATCH_FIXTURES } from '../modules/MapModule'

const PTS: MapPoint[] = [
  { id: 'a', label: 'A', point: { lat: 40.7128, lng: -74.006 }, value: 10, status: 'Successful' },
  { id: 'b', label: 'B', point: { lat: 40.73, lng: -74.01 }, value: 30, status: 'Successful' },
  { id: 'c', label: 'C', point: { lat: 38.9, lng: -77.03 }, value: 5, status: 'Cancelled' },
  { id: 'd', label: 'D', point: { lat: 41.87, lng: -87.62 }, value: 8, status: 'Diverted' },
]

describe('T-19 cluster layer config + bubbles + metric cards', () => {
  beforeEach(() => { localStorage.clear() })
  afterEach(() => cleanup())

  it('aggregateByGeohash honors avg / count / max aggregation', () => {
    const avg = aggregateByGeohash(PTS, 4, 'avg')
    const mergedAvg = avg.find(b => b.labels.includes('A') && b.labels.includes('B'))
    expect(mergedAvg).toBeTruthy()
    expect(mergedAvg!.totalValue).toBe(20) // (10+30)/2
    expect(mergedAvg!.count).toBe(2)

    const count = aggregateByGeohash(PTS, 4, 'count')
    expect(count.find(b => b.labels.includes('A'))!.totalValue).toBe(2)

    const max = aggregateByGeohash(PTS, 4, 'max')
    expect(max.find(b => b.labels.includes('A'))!.totalValue).toBe(30)

    const sum = aggregateByGeohash(PTS, 4, 'sum')
    expect(sum.find(b => b.labels.includes('A'))!.totalValue).toBe(40)
    // sum still totals 53 across all bubbles
    expect(sum.reduce((a, b) => a + b.totalValue, 0)).toBe(53)
  })

  it('summarizeDispatch + buildMetricCards count Successful/Cancelled/Diverted', () => {
    const summary = summarizeDispatch(PTS)
    expect(summary.Successful).toEqual({ count: 2, value: 40 })
    expect(summary.Cancelled).toEqual({ count: 1, value: 5 })
    expect(summary.Diverted).toEqual({ count: 1, value: 8 })

    const cards = buildMetricCards(PTS)
    expect(cards.map(c => c.label)).toEqual(['Successful', 'Cancelled', 'Diverted', 'Total'])
    expect(cards[3].count).toBe(4)
    expect(cards[0].share).toBe(50)
    expect(cards[3].value).toBe(53)
  })

  it('sanitizeClusterConfig clamps + scaledBubbleRadius honors autoscale', () => {
    expect(sanitizeClusterConfig({ layerType: 'bogus' as never, precision: 99 }).precision).toBe(12)
    expect(sanitizeClusterConfig({ layerType: 'bogus' as never }).layerType).toBe('point')
    expect(sanitizeClusterConfig({ geohashProperty: '  ' }).geohashProperty).toBe('geohash')
    // autoscale on: max value maps to max radius; off: fixed ceiling shrinks it
    expect(scaledBubbleRadius(50, 50, true)).toBeGreaterThan(scaledBubbleRadius(50, 50, false))
    expect(scaledBubbleRadius(50, 50, false)).toBeLessThanOrEqual(5)
    expect(DEFAULT_CLUSTER_CONFIG.aggregation).toBe('sum')
  })

  it('renders cluster bubbles + metric cards + status legend; config panel switches modes', () => {
    const onConfigChange = vi.fn()
    render(
      <MapCanvas
        points={PTS}
        config={{ ...DEFAULT_CLUSTER_CONFIG, layerType: 'cluster', precision: 4 }}
        onConfigChange={onConfigChange}
        showConfigPanel
      />,
    )
    // metric cards over map
    expect(screen.getByTestId('metric-cards')).toBeTruthy()
    expect(screen.getByTestId('metric-card-successful').textContent).toMatch(/2/)
    expect(screen.getByTestId('metric-card-cancelled').textContent).toMatch(/1/)
    expect(screen.getByTestId('metric-card-diverted').textContent).toMatch(/1/)
    // legend statuses
    expect(screen.getByTestId('map-legend-status').textContent).toMatch(/Successful/)
    expect(screen.getByTestId('map-legend-status').textContent).toMatch(/Cancelled/)
    expect(screen.getByTestId('map-legend-status').textContent).toMatch(/Diverted/)
    // cluster bubbles (geohash buckets) instead of individual points
    expect(document.querySelector('[data-testid^="map-bubble-"]')).toBeTruthy()
    expect(document.querySelector('[data-testid^="map-point-"]')).toBeNull()
    // config panel controls
    expect(screen.getByLabelText('Layer type')).toBeTruthy()
    expect(screen.getByLabelText('Geohash property')).toBeTruthy()
    expect(screen.getByLabelText('Aggregation')).toBeTruthy()
    expect(screen.getByLabelText('Autoscale')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Layer type'), { target: { value: 'choropleth' } })
    expect(onConfigChange).toHaveBeenCalled()
  })

  it('renders choropleth cells and line segment layer types', () => {
    const { rerender } = render(
      <MapCanvas points={PTS} config={{ ...DEFAULT_CLUSTER_CONFIG, layerType: 'choropleth', precision: 4 }} />,
    )
    expect(document.querySelector('[data-testid^="map-cell-"]')).toBeTruthy()
    expect(document.querySelector('[data-testid^="map-bubble-"]')).toBeTruthy()

    rerender(<MapCanvas points={PTS} config={{ ...DEFAULT_CLUSTER_CONFIG, layerType: 'line' }} />)
    expect(screen.getByTestId('map-line')).toBeTruthy()
    expect(document.querySelector('[data-testid^="map-point-"]')).toBeTruthy()
  })

  it('MapModule renders config panel + aggregated bubbles + cards over dispatch fixtures', () => {
    render(<MapModule />)
    expect(screen.getByTestId('cluster-layer-config')).toBeTruthy()
    expect(screen.getByTestId('metric-cards')).toBeTruthy()
    expect(screen.getByTestId('map-legend-status').textContent).toMatch(/Successful/)
    // default module layer is cluster → bubbles, not individual points
    expect(document.querySelector('[data-testid^="map-bubble-"]')).toBeTruthy()
    expect(DISPATCH_FIXTURES.some(p => p.status === 'Cancelled')).toBe(true)
    expect(DISPATCH_FIXTURES.some(p => p.status === 'Diverted')).toBe(true)
  })
})
