// Agent inputs + session completion drawer (FN-AST-001, FN-AST-009) +
// pre-computed variables + templates (FN-AST-002) + variable operation
// chains (FN-AST-003) — slide-over panel mirroring the corpus-2
// Configuration tile; edits persist via ws.meta with appendTrace +
// appendAudit on every mutating action.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

import { AgentInputsDrawer } from './AgentInputsDrawer'
import { CHAINS_META_KEY, INPUTS_META_KEY, POLICY_META_KEY, TEMPLATES_META_KEY, loadAgentInputs, loadPrecomputedVariables } from '../agent/variables'
import { ws } from '../store'

const readAudit = (): any[] => {
  try { return JSON.parse(localStorage.getItem('ontology-harness.audit') ?? '[]') } catch { return [] }
}

beforeEach(() => {
  localStorage.clear()
  ws.meta = {}
  ws.traces.length = 0
  ws.hydrated = true
})
afterEach(() => cleanup())

describe('AgentInputsDrawer (FN-AST-001, FN-AST-009)', () => {
  it('renders nothing while closed', () => {
    const { container } = render(<AgentInputsDrawer open={false} onClose={vi.fn()} />)
    expect(container.textContent).toBe('')
    expect(screen.queryByTestId('agent-inputs-drawer')).toBeNull()
  })

  it('renders the seeded inputs tile + session completion policy (glass tokens only)', () => {
    render(<AgentInputsDrawer open onClose={vi.fn()} />)
    expect(screen.getByTestId('agent-inputs-drawer')).toBeTruthy()
    expect(screen.getByTestId('agent-inputs-drawer').getAttribute('role')).toBe('dialog')

    // Seeded rows from the corpus-2 Configuration tile.
    expect(screen.getByText('input1 *')).toBeTruthy()
    expect(screen.getByText('includePartnerFlights')).toBeTruthy()

    // Type select + Required/Optional segmented (matches new-agent-input-settings.png).
    expect(screen.getByTestId('input-type')).toBeTruthy()
    expect(screen.getByTestId('input-required-required')).toBeTruthy()
    expect(screen.getByTestId('input-required-optional')).toBeTruthy()

    // Completion policy: mode + maxTurns + verification + dry-run.
    expect(screen.getByTestId('policy-mode')).toBeTruthy()
    expect(screen.getByTestId('policy-max-turns')).toBeTruthy()
    expect(screen.getByTestId('policy-require-verification')).toBeTruthy()
    expect(screen.getByTestId('policy-dry-run-default')).toBeTruthy()
    expect(screen.getByTestId('policy-summary').textContent).toMatch(/max 8 turns/)
  })

  it('changing the type persists via ws.meta with trace + audit', () => {
    render(<AgentInputsDrawer open onClose={vi.fn()} />)
    fireEvent.change(screen.getByTestId('input-type'), { target: { value: 'option' } })

    const persisted = (ws.meta?.[INPUTS_META_KEY] ?? []) as any[]
    const input1 = persisted.find(i => i.name === 'input1')
    expect(input1).toBeTruthy()
    expect(input1.type).toBe('option')

    expect(ws.traces.some(t => t.tool === 'inputs.update' && t.ok)).toBe(true)
    const audit = readAudit()
    expect(audit.some(a => a.event === 'inputs-update')).toBe(true)
  })

  it('Add creates input2 and Delete removes the selected input, both persisted + audited', () => {
    render(<AgentInputsDrawer open onClose={vi.fn()} />)
    fireEvent.click(screen.getByTestId('inputs-add'))
    expect(loadAgentInputs().map(i => i.name)).toContain('input2')
    expect(ws.traces.some(t => t.tool === 'inputs.add' && t.ok)).toBe(true)

    // New input is selected → delete removes it again.
    fireEvent.click(screen.getByTestId('input-delete'))
    expect(loadAgentInputs().map(i => i.name)).not.toContain('input2')
    expect(ws.traces.some(t => t.tool === 'inputs.remove' && t.ok)).toBe(true)
    expect(readAudit().some(a => a.event === 'inputs-remove')).toBe(true)
  })

  it('policy edits persist maxTurns/verification/dry-run with trace + audit', () => {
    render(<AgentInputsDrawer open onClose={vi.fn()} />)
    fireEvent.change(screen.getByTestId('policy-max-turns'), { target: { value: '12' } })
    fireEvent.click(screen.getByTestId('policy-require-verification'))
    fireEvent.click(screen.getByTestId('policy-dry-run-default'))
    fireEvent.change(screen.getByTestId('policy-mode'), { target: { value: 'first-valid-output' } })

    const persisted = (ws.meta?.[POLICY_META_KEY] ?? {}) as any
    expect(persisted.maxTurns).toBe(12)
    expect(persisted.requireVerification).toBe(false)
    expect(persisted.dryRunDefault).toBe(false)
    expect(persisted.mode).toBe('first-valid-output')
    expect(screen.getByTestId('policy-summary').textContent).toMatch(/Ends after first valid output/)

    expect(ws.traces.filter(t => t.tool === 'policy.update' && t.ok).length).toBeGreaterThanOrEqual(4)
    expect(readAudit().some(a => a.event === 'policy-update')).toBe(true)
  })

  it('Escape closes the drawer', () => {
    const onClose = vi.fn()
    render(<AgentInputsDrawer open onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('AgentInputsDrawer templates (FN-AST-002)', () => {
  it('renders template cards with a search input and Use/Delete per card', () => {
    render(<AgentInputsDrawer open onClose={vi.fn()} />)
    expect(screen.getByTestId('templates-section')).toBeTruthy()
    expect(screen.getByTestId('template-search')).toBeTruthy()
    expect(screen.getByTestId('template-cards')).toBeTruthy()
    expect(screen.getByText('countSummary')).toBeTruthy()
    expect(screen.getByText('greeting')).toBeTruthy()
    // Use + Delete buttons exist for each seeded card.
    expect(screen.getByTestId('template-use-tpl-greeting')).toBeTruthy()
    expect(screen.getByTestId('template-delete-tpl-greeting')).toBeTruthy()
    expect(screen.getAllByText('Use').length).toBeGreaterThanOrEqual(3)
    expect(screen.getAllByText('Delete').length).toBeGreaterThanOrEqual(3)
    expect(screen.getByTestId('template-apply-input')).toBeTruthy()
  })

  it('search filters the cards list', () => {
    render(<AgentInputsDrawer open onClose={vi.fn()} />)
    fireEvent.change(screen.getByTestId('template-search'), { target: { value: 'greet' } })
    expect(screen.getByText('greeting')).toBeTruthy()
    expect(screen.queryByText('countSummary')).toBeNull()
    fireEvent.change(screen.getByTestId('template-search'), { target: { value: 'no-such-template' } })
    expect(screen.getByTestId('template-empty')).toBeTruthy()
  })

  it('Use applies the template (apply-template) with {input} substitution, traced + audited', () => {
    render(<AgentInputsDrawer open onClose={vi.fn()} />)
    fireEvent.change(screen.getByTestId('template-apply-input'), { target: { value: 'EWR' } })
    fireEvent.click(screen.getByTestId('template-use-tpl-greeting'))
    expect(screen.getByTestId('apply-template-result').textContent).toContain('Hello EWR')
    expect(ws.traces.some(t => t.tool === 'templates.apply-template' && t.ok)).toBe(true)
    expect(readAudit().some(a => a.event === 'templates-apply-template')).toBe(true)
  })

  it('Delete removes a card via ws.meta with trace + audit, and Add creates one', () => {
    render(<AgentInputsDrawer open onClose={vi.fn()} />)
    fireEvent.click(screen.getByTestId('template-delete-tpl-greeting'))
    expect(loadPrecomputedVariables().map(v => v.name)).not.toContain('greeting')
    expect((ws.meta?.[TEMPLATES_META_KEY] ?? []).some((v: any) => v.name === 'greeting')).toBe(false)
    expect(ws.traces.some(t => t.tool === 'templates.remove' && t.ok)).toBe(true)
    expect(readAudit().some(a => a.event === 'templates-remove')).toBe(true)

    fireEvent.change(screen.getByTestId('template-new-name'), { target: { value: 'airportTag' } })
    fireEvent.change(screen.getByTestId('template-new-template'), { target: { value: 'Airport: {input}' } })
    fireEvent.click(screen.getByTestId('template-add'))
    expect(loadPrecomputedVariables().map(v => v.name)).toContain('airportTag')
    expect(ws.traces.some(t => t.tool === 'templates.add' && t.ok)).toBe(true)
    expect(readAudit().some(a => a.event === 'templates-add')).toBe(true)
  })
})

describe('AgentInputsDrawer chain builder (FN-AST-003)', () => {
  it('renders the seeded chain with typed output chip, Problems bar, and Apply', () => {
    render(<AgentInputsDrawer open onClose={vi.fn()} />)
    expect(screen.getByTestId('chain-section')).toBeTruthy()
    expect(screen.getByTestId('chain-output-chip').textContent).toBe('ObjectSet(stage)')
    expect(screen.getByTestId('chain-step-count').textContent).toMatch(/2 step/)
    expect(screen.getByTestId('chain-problems').textContent).toMatch(/Problems — none/)
    expect(screen.getByTestId('chain-steps')).toBeTruthy()
    expect(screen.getByTestId('chain-add')).toBeTruthy()
    expect(screen.getByTestId('chain-apply')).toBeTruthy()
    // Seeded step controls: filter step + search-around step.
    expect(screen.getByTestId('chain-step-field-chain-step-filter-1')).toBeTruthy()
    expect(screen.getByTestId('chain-step-direction-chain-step-search-1')).toBeTruthy()
    expect(screen.getByTestId('chain-step-depth-chain-step-search-1')).toBeTruthy()
  })

  it('Add/Remove/Reorder persist via ws.meta with trace + audit; Apply evaluates over the graph', () => {
    render(<AgentInputsDrawer open onClose={vi.fn()} />)

    // Add a Filter step → 3 steps persisted.
    fireEvent.change(screen.getByTestId('chain-new-step-type'), { target: { value: 'filter' } })
    fireEvent.click(screen.getByTestId('chain-add'))
    const afterAdd = (ws.meta?.[CHAINS_META_KEY] ?? []) as any[]
    expect(afterAdd[0].steps).toHaveLength(3)
    expect(ws.traces.some(t => t.tool === 'chains.add-step' && t.ok)).toBe(true)
    expect(readAudit().some(a => a.event === 'chains-add-step')).toBe(true)

    // Reorder: move the first step down.
    const beforeReorder = afterAdd[0].steps.map((s: any) => s.id)
    fireEvent.click(screen.getByTestId(`chain-step-down-${beforeReorder[0]}`))
    const afterReorder = (ws.meta?.[CHAINS_META_KEY] ?? []) as any[]
    expect(afterReorder[0].steps[0].id).toBe(beforeReorder[1])
    expect(ws.traces.some(t => t.tool === 'chains.reorder' && t.ok)).toBe(true)

    // Remove the newly added step → back to 2 steps.
    const addedId = afterReorder[0].steps[afterReorder[0].steps.length - 1].id
    fireEvent.click(screen.getByTestId(`chain-step-remove-${addedId}`))
    const afterRemove = (ws.meta?.[CHAINS_META_KEY] ?? []) as any[]
    expect(afterRemove[0].steps).toHaveLength(2)
    expect(ws.traces.some(t => t.tool === 'chains.remove-step' && t.ok)).toBe(true)
    expect(readAudit().some(a => a.event === 'chains-remove-step')).toBe(true)

    // Apply evaluates the (reordered but still valid) chain over GRAPH_NODES.
    fireEvent.click(screen.getByTestId('chain-apply'))
    expect(screen.getByTestId('chain-apply-result').textContent).toMatch(/Apply:.*→ ObjectSet\(stage\) \(/)
    expect(ws.traces.some(t => t.tool === 'chains.apply' && t.ok)).toBe(true)
    expect(readAudit().some(a => a.event === 'chains-apply')).toBe(true)
  })

  it('surfaces Problems and disables Apply when the chain is invalid', () => {
    render(<AgentInputsDrawer open onClose={vi.fn()} />)
    fireEvent.change(screen.getByTestId('chain-name'), { target: { value: 'not valid!' } })
    expect(screen.getByTestId('chain-problems').textContent).toMatch(/Problems \(/)
    expect(screen.getByTestId('chain-problems').textContent).toMatch(/valid identifier/)
    expect((screen.getByTestId('chain-apply') as HTMLButtonElement).disabled).toBe(true)
    // Changing the step type is also a persisted, traced mutation.
    fireEvent.change(screen.getByTestId('chain-step-type-chain-step-filter-1'), { target: { value: 'searchAround' } })
    expect(ws.traces.some(t => t.tool === 'chains.update-step' && t.ok)).toBe(true)
    expect(readAudit().some(a => a.event === 'chains-update-step')).toBe(true)
  })
})
