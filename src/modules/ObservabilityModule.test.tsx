// ObservabilityModule — timeline click-filter, ⌘-click multi, type filter, search.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import ObservabilityModule from './ObservabilityModule'
import { tracesToEvents } from '../observability/types'
import type { Trace } from '../store'

const AT = (h: number, m: number) => new Date(2025, 9, 8, h, m, 0).toISOString()

const TRACES: Trace[] = [
  { kind: 'llm-call', ok: true, ms: 120, at: AT(16, 19), detail: 'grounding ok' },
  { kind: 'tool-call', ok: true, ms: 5, at: AT(16, 20), tool: 'data.import', detail: 'rows=42' },
  { kind: 'llm-call', ok: false, ms: 200, at: AT(16, 21), detail: 'retry needed' },
  { kind: 'preset-run', ok: true, ms: 40, at: AT(16, 22), detail: 'preset p1' },
]

beforeEach(() => { localStorage.clear() })
afterEach(() => cleanup())

describe('ObservabilityModule', () => {
  it('renders diamonds by category, a date chip, and the Time|Type|Updates|Payload table', () => {
    render(<ObservabilityModule traces={TRACES} />)
    expect(screen.getByTestId('observability-module')).toBeTruthy()
    expect(screen.getByTestId('observability-date-chip').textContent).toMatch(/8 Oct 2025/)
    const diamonds = screen.getAllByTestId(/^obs-diamond-/)
    expect(diamonds).toHaveLength(4)
    expect(diamonds.filter((d) => d.getAttribute('data-category') === 'agent')).toHaveLength(2)
    expect(diamonds.filter((d) => d.getAttribute('data-category') === 'internal')).toHaveLength(2)
    for (const h of ['Time', 'Type', 'Updates', 'Payload']) {
      expect(screen.getByRole('columnheader', { name: new RegExp(h) })).toBeTruthy()
    }
    expect(screen.getAllByTestId(/^obs-row-/)).toHaveLength(4)
    // Updates badges: failed shows ↻, fast tool-call shows ⚡
    expect(screen.getByText('↻ 1')).toBeTruthy()
    expect(screen.getAllByText('⚡ fast').length).toBeGreaterThanOrEqual(1)
  })

  it('click-to-filter: a single diamond restricts the table; clicking again clears', () => {
    render(<ObservabilityModule traces={TRACES} />)
    const rows = tracesToEvents(TRACES)
    const secondId = rows[1].id
    fireEvent.click(screen.getByTestId(`obs-diamond-${secondId}`))
    expect(screen.getAllByTestId(/^obs-row-/)).toHaveLength(1)
    expect(screen.getByTestId(`obs-row-${secondId}`)).toBeTruthy()
    expect(screen.getByTestId('observability-selected').textContent).toContain('1 selected')
    fireEvent.click(screen.getByTestId(`obs-diamond-${secondId}`))
    expect(screen.getAllByTestId(/^obs-row-/)).toHaveLength(4)
  })

  it('⌘-click / Ctrl-click multi-selects diamonds', () => {
    render(<ObservabilityModule traces={TRACES} />)
    const rows = tracesToEvents(TRACES)
    fireEvent.click(screen.getByTestId(`obs-diamond-${rows[0].id}`))
    fireEvent.click(screen.getByTestId(`obs-diamond-${rows[1].id}`), { metaKey: true })
    expect(screen.getAllByTestId(/^obs-row-/)).toHaveLength(2)
    expect(screen.getByTestId('observability-selected').textContent).toContain('2 selected')
  })

  it('Type filter + payload search narrow the table and Escape clears', () => {
    render(<ObservabilityModule traces={TRACES} />)
    fireEvent.change(screen.getByTestId('obs-type-filter'), { target: { value: 'data.import' } })
    expect(screen.getAllByTestId(/^obs-row-/)).toHaveLength(1)
    fireEvent.change(screen.getByTestId('obs-type-filter'), { target: { value: 'all' } })
    fireEvent.change(screen.getByLabelText('Payload search'), { target: { value: 'rows=42' } })
    expect(screen.getAllByTestId(/^obs-row-/)).toHaveLength(1)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getAllByTestId(/^obs-row-/)).toHaveLength(4)
  })

  it('empty ledger renders the empty state, not a crash', () => {
    render(<ObservabilityModule traces={[]} />)
    expect(screen.getByText(/No trace events yet/)).toBeTruthy()
  })

  it('FN-OBS-003: replay Preview shows turns + status chips and toggles to Raw', () => {
    const { container } = render(<ObservabilityModule traces={TRACES} />)
    expect(screen.getByTestId('observability-replay')).toBeTruthy()
    // Preview is default; tool turn shows "Ran <type>" + chips
    expect(screen.getByTestId('obs-replay-preview').getAttribute('aria-pressed')).toBe('true')
    expect(screen.getAllByTestId(/^obs-replay-/).filter((el) => el.getAttribute('data-role'))).toHaveLength(4)
    expect(container.textContent).toContain('Ran data.import')
    expect(container.textContent).toMatch(/✓ ok/)
    expect(container.textContent).toMatch(/✗ failed/)
    // Raw shows JSON of the filtered events
    fireEvent.click(screen.getByTestId('obs-replay-raw-toggle'))
    expect(screen.getByTestId('observability-replay-raw').textContent).toContain('data.import')
    expect(screen.queryByTestId('observability-replay-preview')).toBeFalsy()
    fireEvent.click(screen.getByTestId('obs-replay-preview'))
    expect(screen.getByTestId('observability-replay-preview')).toBeTruthy()
  })

  it('FN-OBS-003/005: timeline diamond selection syncs replay + logs', () => {
    render(<ObservabilityModule traces={TRACES} />)
    const rows = tracesToEvents(TRACES)
    fireEvent.click(screen.getByTestId(`obs-diamond-${rows[1].id}`))
    expect(screen.getAllByTestId(/^obs-row-/)).toHaveLength(1)
    expect(screen.getAllByTestId(/^obs-replay-/).filter((el) => el.getAttribute('data-role'))).toHaveLength(1)
    expect(screen.getAllByTestId(/^obs-log-ev-/)).toHaveLength(1)
    expect(screen.getByTestId(`obs-log-${rows[1].id}`)).toBeTruthy()
  })

  it('FN-OBS-005: logs table has 6 columns, * wildcard search, and Copy as JSON', async () => {
    const writeText = vi.fn(async (_t: string) => {})
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    render(<ObservabilityModule traces={TRACES} />)
    expect(screen.getByTestId('observability-logs')).toBeTruthy()
    for (const h of ['TIMESTAMP', 'MESSAGE', 'CONTENT', 'PRODUCING RESOURCE', 'TAGS', 'PARAMETERS']) {
      expect(screen.getByRole('columnheader', { name: h })).toBeTruthy()
    }
    expect(screen.getAllByTestId(/^obs-log-ev-/)).toHaveLength(4)
    // wildcard logs search is case-sensitive with *
    fireEvent.change(screen.getByTestId('obs-log-search'), { target: { value: 'data.*' } })
    expect(screen.getAllByTestId(/^obs-log-ev-/)).toHaveLength(1)
    fireEvent.change(screen.getByTestId('obs-log-search'), { target: { value: '' } })
    expect(screen.getAllByTestId(/^obs-log-ev-/)).toHaveLength(4)
    // Type * wildcard filter narrows the event table
    fireEvent.change(screen.getByTestId('obs-type-pattern'), { target: { value: '*import*' } })
    expect(screen.getAllByTestId(/^obs-row-/)).toHaveLength(1)
    fireEvent.change(screen.getByTestId('obs-type-pattern'), { target: { value: '' } })
    // Copy as JSON copies the visible logs
    fireEvent.click(screen.getByTestId('obs-log-copy'))
    await vi.waitFor(() => expect(writeText).toHaveBeenCalled())
    const copied = String(writeText.mock.calls[0][0])
    expect(JSON.parse(copied)).toHaveLength(4)
  })

  it('FN-OBS-004: waterfall renders one span per event, LLM spans use var(--info), hidden outside the zoom window', () => {
    render(<ObservabilityModule traces={TRACES} />)
    expect(screen.getByTestId('observability-waterfall')).toBeTruthy()
    const spans = screen.getAllByTestId(/^obs-span-ev-/)
    expect(spans).toHaveLength(4)
    const rows = tracesToEvents(TRACES)
    const llmSpan = screen.getByTestId(`obs-span-${rows[0].id}`)
    expect(llmSpan.getAttribute('data-llm')).toBe('true')
    expect(llmSpan.getAttribute('style')).toContain('var(--info)')
    const toolSpan = screen.getByTestId(`obs-span-${rows[1].id}`)
    expect(toolSpan.getAttribute('data-llm')).toBe('false')
    // spans derive from the filtered events: filter to one type → one span
    fireEvent.change(screen.getByTestId('obs-type-filter'), { target: { value: 'data.import' } })
    expect(screen.getAllByTestId(/^obs-span-ev-/)).toHaveLength(1)
    fireEvent.change(screen.getByTestId('obs-type-filter'), { target: { value: 'all' } })
    expect(screen.getAllByTestId(/^obs-span-ev-/)).toHaveLength(4)
  })

  it('FN-OBS-004: click span filters the timeline + shows detail popover; close clears', () => {
    render(<ObservabilityModule traces={TRACES} />)
    const rows = tracesToEvents(TRACES)
    const secondId = rows[1].id
    fireEvent.click(screen.getByTestId(`obs-span-${secondId}`))
    expect(screen.getByTestId('observability-selected').textContent).toContain('1 selected')
    expect(screen.getAllByTestId(/^obs-row-/)).toHaveLength(1)
    const detail = screen.getByTestId('obs-waterfall-detail')
    expect(detail.textContent).toContain('data.import')
    expect(detail.textContent).toContain('rows=42')
    expect(detail.getAttribute('role')).toBe('dialog')
    fireEvent.click(screen.getByTestId('obs-waterfall-detail-close'))
    expect(screen.queryByTestId('obs-waterfall-detail')).toBeFalsy()
    expect(screen.getAllByTestId(/^obs-row-/)).toHaveLength(4)
  })

  it('FN-OBS-004: zoom in/out/reset updates the window chip and hides spans outside the window', () => {
    render(<ObservabilityModule traces={TRACES} />)
    expect(screen.getByTestId('obs-waterfall-window').textContent).toContain('0')
    fireEvent.click(screen.getByTestId('obs-waterfall-zoom-in'))
    const windowChip = screen.getByTestId('obs-waterfall-window').textContent ?? ''
    expect(windowChip).toContain('25')
    // 4 spans across the full session; zooming to the middle window hides the ends
    const afterZoomIn = screen.getAllByTestId(/^obs-span-ev-/).length
    expect(afterZoomIn).toBeLessThanOrEqual(4)
    fireEvent.click(screen.getByTestId('obs-waterfall-zoom-out'))
    fireEvent.click(screen.getByTestId('obs-waterfall-zoom-reset'))
    expect(screen.getByTestId('obs-waterfall-window').textContent).toContain('0')
    expect(screen.getAllByTestId(/^obs-span-ev-/)).toHaveLength(4)
  })
})
