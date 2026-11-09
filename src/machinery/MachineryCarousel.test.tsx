// Machinery carousel render test — FN-MCH-002 (jsdom, no ReactFlow).
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import MachineryCarousel from './MachineryCarousel'

beforeEach(() => { localStorage.clear() })
afterEach(() => cleanup())

describe('MachineryCarousel', () => {
  it('renders all three metrics with the active one pressed', () => {
    render(<MachineryCarousel metric="historical-duration" onChange={vi.fn()} />)
    expect(screen.getByTestId('machinery-carousel')).toBeTruthy()
    for (const label of ['Historical count', 'Current count', 'Historical duration']) {
      expect(screen.getByText(label)).toBeTruthy()
    }
    expect(screen.getByTestId('metric-historical-duration').getAttribute('aria-selected')).toBe('true')
    expect(screen.getByTestId('metric-historical-count').getAttribute('aria-selected')).toBe('false')
  })

  it('prev/next arrows cycle the metric in order', () => {
    const onChange = vi.fn()
    render(<MachineryCarousel metric="historical-count" onChange={onChange} />)
    fireEvent.click(screen.getByTestId('metric-next'))
    expect(onChange).toHaveBeenCalledWith('current-count')
    fireEvent.click(screen.getByTestId('metric-prev'))
    expect(onChange).toHaveBeenCalledWith('historical-duration') // wraps from start
  })

  it('clicking a pill selects it; arrow keys cycle', () => {
    const onChange = vi.fn()
    render(<MachineryCarousel metric="historical-count" onChange={onChange} />)
    fireEvent.click(screen.getByTestId('metric-historical-duration'))
    expect(onChange).toHaveBeenCalledWith('historical-duration')
    fireEvent.keyDown(screen.getByTestId('machinery-carousel'), { key: 'ArrowRight' })
    expect(onChange).toHaveBeenCalledWith('current-count')
    fireEvent.keyDown(screen.getByTestId('machinery-carousel'), { key: 'ArrowLeft' })
    expect(onChange).toHaveBeenCalledWith('historical-duration')
  })
})
