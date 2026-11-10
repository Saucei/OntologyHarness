// MapCanvas globe-view tests (T-36) — the GeoMap globe is fully traversable:
// toggle in/out, drag through 360°, far-side culling, spin, keyboard rotation.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import MapCanvas from './MapCanvas'
import { GEO_FIXTURES } from '../data/geoFixtures'

describe('MapCanvas globe view (T-36)', () => {
  beforeEach(() => { localStorage.clear() })
  afterEach(() => cleanup())

  it('toggles between flat and globe, keeping marker testids stable', () => {
    render(<MapCanvas points={GEO_FIXTURES} />)
    expect(screen.queryByTestId('globe-svg')).toBeNull()
    fireEvent.click(screen.getByTestId('map-view-toggle'))
    expect(screen.getByTestId('globe-svg')).toBeTruthy()
    // Default rotation centers on the data centroid → all fixtures near-side.
    expect(screen.getByTestId('map-point-site-nyc')).toBeTruthy()
    expect(screen.getByTestId('map-point-site-chi')).toBeTruthy()
    fireEvent.click(screen.getByTestId('map-view-toggle'))
    expect(screen.queryByTestId('globe-svg')).toBeNull()
    expect(screen.getByTestId('map-point-site-nyc')).toBeTruthy()
  })

  it('opens directly on the globe when initialView="globe"', () => {
    render(<MapCanvas points={GEO_FIXTURES} initialView="globe" />)
    expect(screen.getByTestId('globe-svg')).toBeTruthy()
    expect(screen.getByTestId('map-point-site-nyc')).toBeTruthy()
  })

  it('is fully traversable: a wide drag carries the data to the far hemisphere', () => {
    render(<MapCanvas points={GEO_FIXTURES} />)
    fireEvent.click(screen.getByTestId('map-view-toggle'))
    expect(screen.getByTestId('map-point-site-nyc')).toBeTruthy()
    const svg = screen.getByTestId('globe-svg')
    // Drag left by 500 px → view center moves east 200° → fixtures on the far side.
    fireEvent.pointerDown(svg, { clientX: 300, clientY: 200, pointerId: 1 })
    fireEvent.pointerMove(svg, { clientX: -200, clientY: 200, pointerId: 1 })
    fireEvent.pointerUp(svg, { clientX: -200, clientY: 200, pointerId: 1 })
    expect(screen.queryByTestId('map-point-site-nyc')).toBeNull()
    expect(screen.getByText(/on far side/)).toBeTruthy()
    // …and traversing back brings them around again.
    fireEvent.pointerDown(svg, { clientX: 0, clientY: 200, pointerId: 2 })
    fireEvent.pointerMove(svg, { clientX: 600, clientY: 200, pointerId: 2 })
    fireEvent.pointerUp(svg, { clientX: 600, clientY: 200, pointerId: 2 })
    expect(screen.getByTestId('map-point-site-nyc')).toBeTruthy()
  })

  it('auto-spin toggles and Reset re-centers and stops the spin', () => {
    render(<MapCanvas points={GEO_FIXTURES} initialView="globe" />)
    const spinBtn = screen.getByLabelText('Toggle auto-spin')
    expect(spinBtn.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(spinBtn)
    expect(spinBtn.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByLabelText('Reset map'))
    expect(spinBtn.getAttribute('aria-pressed')).toBe('false')
    // Data re-centered → fixtures visible again.
    expect(screen.getByTestId('map-point-site-nyc')).toBeTruthy()
  })

  it('arrow keys rotate the globe (keyboard traversal)', () => {
    render(<MapCanvas points={GEO_FIXTURES} initialView="globe" />)
    const before = screen.getByTestId('globe-rotation').textContent
    fireEvent.keyDown(screen.getByTestId('globe-svg'), { key: 'ArrowRight' })
    const after = screen.getByTestId('globe-rotation').textContent
    expect(after).not.toBe(before)
  })

  it('zoom controls keep working in globe mode', () => {
    render(<MapCanvas points={GEO_FIXTURES} initialView="globe" />)
    fireEvent.click(screen.getByLabelText('Zoom in'))
    expect(screen.getByText(/1\.25×/)).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Reset map'))
    expect(screen.getByText(/1\.00×/)).toBeTruthy()
  })
})
