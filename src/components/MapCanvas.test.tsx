// MapCanvas render + aggregation helper (FN-GEO-001 substrate).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import MapCanvas, { aggregateByGeohash, bubbleRadius } from './MapCanvas'
import { GEO_FIXTURES } from '../data/geoFixtures'

describe('MapCanvas', () => {
  beforeEach(() => { localStorage.clear() })
  afterEach(() => cleanup())

  it('renders one bubble per fixture with labels and a legend', () => {
    render(<MapCanvas points={GEO_FIXTURES} title="Substrate" />)
    expect(screen.getByTestId('map-canvas')).toBeTruthy()
    for (const f of GEO_FIXTURES) {
      expect(screen.getByTestId(`map-point-${f.id}`)).toBeTruthy()
      expect(screen.getByLabelText(new RegExp(f.label.slice(0, 8)))).toBeTruthy()
    }
    expect(screen.getByLabelText('Map legend')).toBeTruthy()
    expect(screen.getByLabelText('Map controls')).toBeTruthy()
  })

  it('selecting a bubble updates the aria label and supports Escape clear', () => {
    const onSelect = vi.fn()
    render(<MapCanvas points={GEO_FIXTURES} onSelect={onSelect} />)
    fireEvent.click(screen.getByLabelText(/NYC Ale/))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('map-canvas').getAttribute('aria-label')).toMatch(/NYC Ale/)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByTestId('map-canvas').getAttribute('aria-label')).not.toMatch(/NYC Ale/)
  })

  it('zoom controls clamp and report', () => {
    render(<MapCanvas points={GEO_FIXTURES} />)
    fireEvent.click(screen.getByLabelText('Zoom in'))
    fireEvent.click(screen.getByLabelText('Zoom in'))
    expect(screen.getByText(/1\.50×/)).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Reset map'))
    expect(screen.getByText(/1\.00×/)).toBeTruthy()
  })

  it('bubbleRadius scales monotonically with sqrt(value)', () => {
    const small = bubbleRadius(10, 100)
    const mid = bubbleRadius(25, 100)
    const big = bubbleRadius(100, 100)
    expect(small).toBeLessThan(mid)
    expect(mid).toBeLessThan(big)
    expect(bubbleRadius(0, 100)).toBe(1.6)
  })

  it('aggregateByGeohash merges nearby points into summed bubbles', () => {
    const pts = [
      { id: 'a', label: 'A', point: { lat: 40.7128, lng: -74.006 }, value: 10 },
      { id: 'b', label: 'B', point: { lat: 40.73, lng: -74.01 }, value: 20 },
      { id: 'c', label: 'C', point: { lat: 38.9, lng: -77.03 }, value: 5 },
    ]
    const bubbles = aggregateByGeohash(pts, 4)
    expect(bubbles.length).toBeLessThanOrEqual(3)
    expect(bubbles.length).toBeGreaterThanOrEqual(1)
    const total = bubbles.reduce((s, b) => s + b.totalValue, 0)
    expect(total).toBe(35)
    const merged = bubbles.find(b => b.labels.includes('A') && b.labels.includes('B'))
    // precision 4 is coarse enough that A+B share a cell on this dataset
    expect(merged).toBeTruthy()
    expect(merged!.count).toBeGreaterThanOrEqual(2)
    expect(merged!.totalValue).toBe(30)
  })
})
