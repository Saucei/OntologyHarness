// Machinery panels render/interaction tests — FN-MCH-005/006 (jsdom, no ReactFlow).
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import PathExplorer from './PathExplorer'
import DurationHistogram from './DurationHistogram'
import { getFixture, listMachineryPaths } from './mach'

beforeEach(() => { localStorage.clear() })
afterEach(() => cleanup())

describe('PathExplorer', () => {
  it('renders checked rows with duration bars and counts', () => {
    const paths = listMachineryPaths(getFixture('approval-process'))
    render(
      <PathExplorer
        paths={paths}
        checked={[paths[0].id]}
        selectedId={null}
        onToggleChecked={vi.fn()}
        onSelect={vi.fn()}
      />,
    )
    expect(screen.getByTestId('path-explorer')).toBeTruthy()
    const row = screen.getByTestId(`path-row-${paths[0].id}`)
    expect(row.textContent).toContain(paths[0].title)
    expect(row.textContent).toMatch(/hop/)
    expect(screen.getByTestId(`path-check-${paths[0].id}`)).toBeTruthy()
    expect((screen.getByTestId(`path-check-${paths[0].id}`) as HTMLInputElement).checked).toBe(true)
  })

  it('clicking a row selects it; checkbox toggles checked state', () => {
    const paths = listMachineryPaths(getFixture('patient-journey'))
    const onSelect = vi.fn()
    const onToggleChecked = vi.fn()
    render(
      <PathExplorer paths={paths} checked={[]} selectedId={null} onToggleChecked={onToggleChecked} onSelect={onSelect} />,
    )
    fireEvent.click(screen.getByTestId(`path-row-${paths[1].id}`))
    expect(onSelect).toHaveBeenCalledWith(paths[1].id)
    fireEvent.click(screen.getByTestId(`path-check-${paths[1].id}`))
    expect(onToggleChecked).toHaveBeenCalledWith(paths[1].id)
  })
})

describe('DurationHistogram', () => {
  it('renders brush area, sliders and clear control', () => {
    const nodes = getFixture('patient-journey').nodes
    render(<DurationHistogram nodes={nodes} fixtureId="patient-journey" range={null} onChange={vi.fn()} />)
    expect(screen.getByTestId('duration-histogram')).toBeTruthy()
    expect(screen.getByTestId('duration-histogram-area')).toBeTruthy()
    expect(screen.getByTestId('duration-range-start')).toBeTruthy()
    expect(screen.getByTestId('duration-range-end')).toBeTruthy()
    expect(screen.getByTestId('duration-histogram-clear')).toBeTruthy()
  })

  it('shows an empty state when no node has a duration', () => {
    const nodes = getFixture('patient-journey').nodes.filter(n => n.id === 'attended')
    render(<DurationHistogram nodes={nodes} fixtureId="patient-journey" range={null} onChange={vi.fn()} />)
    expect(screen.getByTestId('duration-histogram').textContent).toContain('duration brush unavailable')
  })

  it('clear emits a null range', () => {
    const nodes = getFixture('patient-journey').nodes
    const onChange = vi.fn()
    render(<DurationHistogram nodes={nodes} fixtureId="patient-journey" range={[0, 14]} onChange={onChange} />)
    fireEvent.click(screen.getByTestId('duration-histogram-clear'))
    expect(onChange).toHaveBeenCalledWith(null)
  })
})
