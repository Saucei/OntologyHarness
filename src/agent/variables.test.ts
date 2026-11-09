// Typed inputs + session completion policy helpers (FN-AST-001, FN-AST-009)
// + pre-computed templates (FN-AST-002) + variable operation chains (FN-AST-003).
import { describe, it, expect, beforeEach } from 'vitest'
import {
  CHAINS_META_KEY,
  INPUTS_META_KEY,
  POLICY_META_KEY,
  TEMPLATES_META_KEY,
  addChainStep,
  addInput,
  addPrecomputedVariable,
  chainOutputSummary,
  coerceInputValue,
  computePrecomputedVariable,
  createChainStep,
  createInput,
  createPrecomputedVariable,
  defaultCompletionPolicy,
  defaultInputs,
  defaultPrecomputedVariables,
  defaultValues,
  defaultVariableChains,
  deriveChainOutput,
  deriveChainStepOutputs,
  evaluateChain,
  evaluatePrecomputedVariable,
  filterPrecomputedVariables,
  formatPolicySummary,
  loadAgentInputs,
  loadCompletionPolicy,
  loadPrecomputedVariables,
  loadVariableChains,
  moveChainStep,
  removeChainStep,
  removeInput,
  removePrecomputedVariable,
  renderTemplate,
  saveAgentInputs,
  saveCompletionPolicy,
  savePrecomputedVariables,
  saveVariableChains,
  setChainStepType,
  updateChainStepFilter,
  updateCompletionPolicy,
  updateInput,
  validateChain,
  validateChains,
  validateCompletionPolicy,
  validateInputValues,
  validateInputs,
  validatePrecomputedVariables,
} from './variables'
import { ws } from '../store'

beforeEach(() => {
  ws.meta = {}
  ws.hydrated = true
  ws.traces.length = 0
})

describe('defaults', () => {
  it('seeds the corpus-2 inputs tile (input1 string + boolean sample)', () => {
    const inputs = defaultInputs()
    expect(inputs.map(i => i.name)).toEqual(['input1', 'includePartnerFlights'])
    expect(inputs[0]).toMatchObject({ type: 'string', required: true })
    expect(inputs[1]).toMatchObject({ type: 'boolean', required: false })
  })

  it('defaults the completion policy to stays-open / 8 turns / verify / dry-run', () => {
    expect(defaultCompletionPolicy()).toEqual({
      mode: 'stays-open',
      maxTurns: 8,
      requireVerification: true,
      dryRunDefault: true,
    })
  })
})

describe('list edits', () => {
  it('adds with the next free inputN name, updates immutably, and removes by id', () => {
    const seed = defaultInputs()
    const withNew = addInput(seed)
    expect(withNew).toHaveLength(3)
    expect(withNew[2].name).toBe('input2')
    expect(withNew[2].type).toBe('string')
    expect(seed).toHaveLength(2) // seed untouched

    const updated = updateInput(withNew, withNew[2].id, { type: 'number', required: false })
    expect(updated[2]).toMatchObject({ type: 'number', required: false })
    expect(withNew[2].type).toBe('string') // immutable

    expect(removeInput(updated, withNew[2].id).map(i => i.name)).toEqual(['input1', 'includePartnerFlights'])
  })

  it('createInput honours partial overrides', () => {
    const input = createInput([], { name: 'airportCode', type: 'string', required: true })
    expect(input).toMatchObject({ name: 'airportCode', type: 'string', required: true })
    expect(input.options).toEqual([])
  })
})

describe('validateInputs', () => {
  it('flags bad identifiers, duplicates, thin option lists, and bad defaults', () => {
    const inputs = [
      createInput([], { name: 'not valid!', type: 'string', required: true }),
      createInput([], { name: 'dup', type: 'string', required: true }),
      createInput([], { name: 'dup', type: 'string', required: false }),
      createInput([], { name: 'city', type: 'option', required: true, options: ['EWR'] }),
      createInput([], { name: 'count', type: 'number', required: false, defaultValue: 'abc' }),
      createInput([], { name: '', type: 'boolean', required: false }),
    ]
    const errors = validateInputs(inputs)
    expect(errors.some(e => e.includes('valid identifier'))).toBe(true)
    expect(errors.some(e => e.includes('duplicate input name "dup"'))).toBe(true)
    expect(errors.some(e => e.includes('at least 2 distinct options'))).toBe(true)
    expect(errors.some(e => e.includes('default value must be a number'))).toBe(true)
    expect(errors.some(e => e.includes('name is required'))).toBe(true)
  })

  it('accepts the seeded defaults and a well-formed option input', () => {
    expect(validateInputs(defaultInputs())).toEqual([])
    expect(validateInputs([
      createInput([], { name: 'airportCode', type: 'option', required: true, options: ['EWR', 'JFK'], defaultValue: 'EWR' }),
    ])).toEqual([])
  })
})

describe('validateCompletionPolicy + updateCompletionPolicy', () => {
  it('rejects out-of-window maxTurns and non-boolean flags', () => {
    const errors = validateCompletionPolicy({ mode: 'stays-open', maxTurns: 0, requireVerification: 'yes' as any, dryRunDefault: true })
    expect(errors.some(e => e.includes('maxTurns'))).toBe(true)
    expect(errors.some(e => e.includes('requireVerification'))).toBe(true)
    expect(validateCompletionPolicy(defaultCompletionPolicy())).toEqual([])
  })

  it('clamps maxTurns into 1..30 on update', () => {
    expect(updateCompletionPolicy(defaultCompletionPolicy(), { maxTurns: 0 }).maxTurns).toBe(1)
    expect(updateCompletionPolicy(defaultCompletionPolicy(), { maxTurns: 999 }).maxTurns).toBe(30)
    expect(updateCompletionPolicy(defaultCompletionPolicy(), { maxTurns: 12 }).maxTurns).toBe(12)
  })

  it('summarises the policy for the drawer chip', () => {
    expect(formatPolicySummary(defaultCompletionPolicy())).toBe('Stays open · max 8 turns · verification required · dry-run on')
  })
})

describe('coercion + values', () => {
  it('coerces per type and derives session-start defaults', () => {
    expect(coerceInputValue(createInput([], { type: 'number' }), '42')).toBe(42)
    expect(coerceInputValue(createInput([], { type: 'boolean' }), 'true')).toBe(true)
    expect(coerceInputValue(createInput([], { type: 'boolean' }), 'false')).toBe(false)
    expect(coerceInputValue(createInput([], { type: 'string' }), 7)).toBe('7')

    const values = defaultValues([
      createInput([], { name: 'limit', type: 'number', required: true, defaultValue: 5 }),
      createInput([], { name: 'verbose', type: 'boolean', required: false, defaultValue: true }),
    ])
    expect(values).toEqual({ limit: 5, verbose: true })
  })

  it('validates required values and per-type membership', () => {
    const inputs = [
      createInput([], { name: 'airportCode', type: 'string', required: true }),
      createInput([], { name: 'limit', type: 'number', required: false }),
      createInput([], { name: 'city', type: 'option', required: true, options: ['EWR', 'JFK'] }),
    ]
    expect(validateInputValues(inputs, {})).toContain('input "airportCode" is required')
    expect(validateInputValues(inputs, {})).toContain('input "city" is required')
    expect(validateInputValues(inputs, { airportCode: 'EWR', limit: 'abc', city: 'LAX' })).toEqual([
      'input "limit" must be a number',
      'input "city" must be one of: EWR, JFK',
    ])
    expect(validateInputValues(inputs, { airportCode: 'EWR', limit: 3, city: 'JFK' })).toEqual([])
  })
})

describe('ws.meta persistence', () => {
  it('round-trips inputs and policy through ws.meta', () => {
    const inputs = addInput(defaultInputs(), { name: 'airportCode', type: 'option', required: true, options: ['EWR', 'JFK'] })
    saveAgentInputs(inputs)
    expect(ws.meta[INPUTS_META_KEY]).toEqual(inputs)
    expect(loadAgentInputs()).toEqual(inputs)

    const policy = updateCompletionPolicy(defaultCompletionPolicy(), { mode: 'first-valid-output', maxTurns: 4, requireVerification: false })
    saveCompletionPolicy(policy)
    expect(ws.meta[POLICY_META_KEY]).toEqual(policy)
    expect(loadCompletionPolicy()).toEqual(policy)
  })

  it('sanitises corrupt persisted rows on load', () => {
    ws.meta[INPUTS_META_KEY] = [
      { id: 'ok', name: 'airportCode', type: 'string', required: true, options: [] },
      { nope: true },
      null,
      { id: 'ok', name: 'duplicate-id-row', type: 'string', required: true, options: [] },
    ]
    const loaded = loadAgentInputs()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].name).toBe('airportCode')

    ws.meta[POLICY_META_KEY] = { mode: 'bogus', maxTurns: 999, requireVerification: 'yes' }
    expect(loadCompletionPolicy()).toEqual({ mode: 'stays-open', maxTurns: 30, requireVerification: true, dryRunDefault: true })
  })
})

describe('pre-computed variables + templates (FN-AST-002)', () => {
  it('seeds template cards and renders {input} substitution', () => {
    expect(TEMPLATES_META_KEY).toBe('agentVariables_templates')
    const seeded = defaultPrecomputedVariables()
    expect(seeded.map(v => v.name)).toEqual(['countSummary', 'totalSummary', 'greeting'])
    expect(seeded[0].compute).toEqual({ type: 'count' })

    expect(renderTemplate('Hello {input} — welcome back', 'EWR')).toBe('Hello EWR — welcome back')
    expect(renderTemplate('{input} item(s) found', 3)).toBe('3 item(s) found')
    expect(renderTemplate('Hi {name}, {input} seats', { name: 'Ada', input: 2 })).toBe('Hi Ada, 2 seats')
    // Unknown placeholders stay visible.
    expect(renderTemplate('Hi {unknown}', 'x')).toBe('Hi {unknown}')
  })

  it('evaluates count / sum / text via compute + template helpers', () => {
    const countVar = createPrecomputedVariable([], { name: 'n', template: '{input} item(s) found', compute: { type: 'count' }, output: 'number' })
    expect(computePrecomputedVariable(countVar, ['a', 'b', 'c'])).toBe(3)
    expect(evaluatePrecomputedVariable(countVar, ['a', 'b', 'c'])).toBe('3 item(s) found')
    expect(evaluatePrecomputedVariable(countVar, 'a,b,c')).toBe('3 item(s) found')

    const sumVar = createPrecomputedVariable([], { name: 'total', template: 'Total: {input}', compute: { type: 'sum' }, output: 'number' })
    expect(computePrecomputedVariable(sumVar, [1, 2, 3.5])).toBe(6.5)
    expect(evaluatePrecomputedVariable(sumVar, [1, 2, 3.5])).toBe('Total: 6.5')
    expect(evaluatePrecomputedVariable(sumVar, '10, 20')).toBe('Total: 30')

    const textVar = createPrecomputedVariable([], { name: 'greet', template: 'Hello {input}', compute: { type: 'text' }, output: 'string' })
    expect(evaluatePrecomputedVariable(textVar, 'JFK')).toBe('Hello JFK')
  })

  it('round-trips templates through ws.meta and sanitises corrupt rows', () => {
    const vars = addPrecomputedVariable(defaultPrecomputedVariables(), {
      name: 'airportTag',
      template: 'Airport: {input}',
      compute: { type: 'text' },
      output: 'string',
    })
    savePrecomputedVariables(vars)
    expect(ws.meta[TEMPLATES_META_KEY]).toEqual(vars)
    expect(loadPrecomputedVariables().map(v => v.name)).toContain('airportTag')

    ws.meta[TEMPLATES_META_KEY] = [
      { id: 'ok', name: 'kept', template: 'Hi {input}', compute: { type: 'text' }, output: 'string' },
      { nope: true },
      null,
      { id: 'bad-compute', name: 'fallback', template: '{input}', compute: { type: 'bogus' } },
      { id: 'ok', name: 'duplicate-id', template: '{input}', compute: { type: 'count' }, output: 'number' },
    ]
    const loaded = loadPrecomputedVariables()
    expect(loaded.map(v => v.name)).toEqual(['kept', 'fallback'])
    expect(loaded[1].compute.type).toBe('text')
    expect(loaded[1].output).toBe('string')
  })

  it('adds/removes immutably, validates, and searches templates', () => {
    const seed = defaultPrecomputedVariables()
    const withNew = addPrecomputedVariable(seed, { name: 'seats', template: '{input} seats', compute: { type: 'count' }, output: 'number' })
    expect(withNew).toHaveLength(seed.length + 1)
    expect(seed).toHaveLength(3)

    const removed = removePrecomputedVariable(withNew, withNew[withNew.length - 1].id!)
    expect(removed.map(v => v.name)).not.toContain('seats')

    expect(validatePrecomputedVariables(defaultPrecomputedVariables())).toEqual([])
    const errors = validatePrecomputedVariables([
      createPrecomputedVariable([], { name: 'not valid!', template: '{input}', compute: { type: 'text' }, output: 'string' }),
      createPrecomputedVariable([], { name: 'dup', template: '{input}', compute: { type: 'count' }, output: 'number' }),
      createPrecomputedVariable([], { name: 'dup', template: '{input}', compute: { type: 'sum' }, output: 'number' }),
    ])
    expect(errors.some(e => e.includes('valid identifier'))).toBe(true)
    expect(errors.some(e => e.includes('duplicate template name "dup"'))).toBe(true)

    expect(filterPrecomputedVariables(seed, 'greet').map(v => v.name)).toEqual(['greeting'])
    expect(filterPrecomputedVariables(seed, 'COUNT').map(v => v.name)).toContain('countSummary')
    expect(filterPrecomputedVariables(seed, '')).toHaveLength(seed.length)
    expect(filterPrecomputedVariables(seed, 'no-such-template')).toEqual([])
  })
})

describe('variable operation chains (FN-AST-003)', () => {
  const nodes = [
    { id: 'wh', label: 'Warehouse 1', kind: 'warehouse' },
    { id: 'malt', label: 'Malt', kind: 'material' },
    { id: 'hops', label: 'Hops', kind: 'material' },
    { id: 'nyc-ale', label: 'NYC Ale', kind: 'recipe' },
    { id: 'cust', label: '30 Customers', kind: 'customer' },
  ]
  const edges = [
    { id: 'e1', source: 'wh', target: 'malt' },
    { id: 'e2', source: 'wh', target: 'hops' },
    { id: 'e3', source: 'malt', target: 'nyc-ale' },
    { id: 'e4', source: 'hops', target: 'nyc-ale' },
    { id: 'e5', source: 'nyc-ale', target: 'cust' },
  ]

  it('evaluates Filter predicates + SearchAround link traversal (pure)', () => {
    const chain = {
      name: 'materialRecipes',
      steps: [
        { id: 's1', type: 'filter' as const, config: { field: 'kind', operator: 'equals' as const, value: 'material' } },
        { id: 's2', type: 'searchAround' as const, config: { direction: 'outgoing' as const, depth: 1, targetKind: 'recipe' } },
      ],
    }
    const result = evaluateChain(chain, nodes, nodes, edges)
    expect(result.map(o => o.id)).toEqual(['nyc-ale'])
    expect(deriveChainOutput(chain.steps)).toBe('ObjectSet(recipe)')
    expect(deriveChainStepOutputs(chain)).toEqual(['ObjectSet', 'ObjectSet(recipe)'])
    expect(chainOutputSummary(chain)).toBe('materialRecipes → ObjectSet(recipe) · 2 step(s)')

    // Label-contains predicate + incoming traversal.
    const labelChain = {
      name: 'warehouseNeighbours',
      steps: [
        { id: 's1', type: 'filter' as const, config: { field: 'label', operator: 'contains' as const, value: 'warehouse' } },
        { id: 's2', type: 'searchAround' as const, config: { direction: 'outgoing' as const, depth: 1, targetKind: '' } },
      ],
    }
    expect(evaluateChain(labelChain, nodes, nodes, edges).map(o => o.id).sort()).toEqual(['hops', 'malt'])
    expect(deriveChainOutput(labelChain.steps)).toBe('ObjectSet')
  })

  it('validates chain problems via validateChain + validateChains', () => {
    expect(validateChain(defaultVariableChains()[0])).toEqual([])
    expect(validateChains(defaultVariableChains())).toEqual([])

    const bad = {
      name: 'not valid!',
      steps: [
        { id: 'a', type: 'filter' as const, config: { field: 'bogus', operator: 'gt' as const, value: 'abc' } },
        { id: 'b', type: 'searchAround' as const, config: { direction: 'sideways' as any, depth: 99, targetKind: 'mystery' } },
      ],
    }
    const errors = validateChain(bad as any)
    expect(errors.some(e => e.includes('valid identifier'))).toBe(true)
    expect(errors.some(e => e.includes('filter.field must be one of'))).toBe(true)
    expect(errors.some(e => e.includes('filter.value must be a number'))).toBe(true)
    expect(errors.some(e => e.includes('searchAround.direction'))).toBe(true)
    expect(errors.some(e => e.includes('searchAround.depth'))).toBe(true)
    expect(errors.some(e => e.includes('searchAround.targetKind'))).toBe(true)

    const dup = [defaultVariableChains()[0], { ...defaultVariableChains()[0] }]
    expect(validateChains(dup).some(e => e.includes('duplicate chain name'))).toBe(true)
  })

  it('adds/removes/reorders steps immutably and round-trips through ws.meta', () => {
    const seed = defaultVariableChains()[0]
    const added = addChainStep(seed, 'filter')
    expect(added.steps).toHaveLength(seed.steps.length + 1)
    expect(seed.steps).toHaveLength(2) // seed untouched
    expect(added.steps[added.steps.length - 1].type).toBe('filter')

    const moved = moveChainStep(added, added.steps[0].id, 'down')
    expect(moved.steps[0].id).toBe(added.steps[1].id)
    expect(moved.steps[1].id).toBe(added.steps[0].id)
    expect(added.steps[0].id).not.toBe(moved.steps[0].id) // immutable

    const removed = removeChainStep(moved, moved.steps[0].id)
    expect(removed.steps).toHaveLength(added.steps.length - 1)

    const renamed = { ...removed, name: 'materialRecipes' }
    const patched = updateChainStepFilter(renamed, removed.steps[0].id, { operator: 'contains' })
    expect(patched.steps[0].type).toBe('filter')

    const retyped = setChainStepType(removed, removed.steps[0].id, 'searchAround')
    expect(retyped.steps[0].type).toBe('searchAround')

    saveVariableChains([patched])
    expect(ws.meta[CHAINS_META_KEY]).toEqual([patched])
    expect(loadVariableChains()[0].name).toBe('materialRecipes')
    expect(loadVariableChains()[0].steps[0].type).toBe('filter')

    // Corrupt persisted rows are sanitised on load.
    ws.meta[CHAINS_META_KEY] = [
      { id: 'ok', name: 'kept', steps: [{ id: 's1', type: 'searchAround', config: { direction: 'incoming', depth: 99 } }] },
      { nope: true },
      null,
      { id: 'bad', name: 'fallback', steps: [{ id: 's2', type: 'weird', config: {} }] },
    ]
    const loaded = loadVariableChains()
    expect(loaded.map(c => c.name)).toEqual(['kept', 'fallback'])
    expect(loaded[0].steps[0].type).toBe('searchAround')
    expect(loaded[0].steps[0].type === 'searchAround' && loaded[0].steps[0].config.depth).toBe(3)
    expect(loaded[1].steps[0].type).toBe('filter')
  })
})
