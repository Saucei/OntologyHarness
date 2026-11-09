import { describe, it, expect } from 'vitest'
import { MODULES, moduleById, moduleIds } from './modules/registry'

describe('module registry (T0 plugin contract)', () => {
  it('registers every module with unique ids', () => {
    const ids = MODULES.map(m => m.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.length).toBeGreaterThanOrEqual(13)
  })

  it('every module implements the contract', () => {
    for (const m of MODULES) {
      expect(m.id).toMatch(/^[a-z][a-z0-9-]*$/)
      expect(m.label.length).toBeGreaterThan(2)
      expect(m.hint.length).toBeGreaterThan(6)
      expect(['WORK', 'INTELLIGENCE', 'INSPECT']).toContain(m.section)
      expect(typeof m.Component).toBe('function')
    }
  })

  it('icon-uniqueness honored: each section has distinct icon set EXCEPT intentional spark reuse', () => {
    for (const section of ['WORK', 'INTELLIGENCE', 'INSPECT'] as const) {
      const icons = MODULES.filter(m => m.section === section).map(m => m.icon)
      expect(new Set(icons).size).toBeGreaterThanOrEqual(icons.length - 1) // allow ≤1 reuse
    }
  })

  it('lookup + ordering helpers work', () => {
    expect(moduleById('workshop')?.label).toBe('Workshop Canvas')
    expect(moduleById('nonexistent')).toBeUndefined()
    expect(moduleIds()[0]).toBe('graph')
  })

  it('sections are contiguous blocks (WORK → INTELLIGENCE → INSPECT)', () => {
    const order = MODULES.map(m => m.section)
    const flattened = order.filter((s, i) => order[i - 1] !== s)
    expect(flattened).toEqual(['WORK', 'INTELLIGENCE', 'INSPECT'])
  })

  it('every module declares exactly one valid layer (L0→L4 stack)', () => {
    const LAYERS = ['L0-MODEL', 'L1-APPLICATION', 'L2-ONTOLOGY', 'L3-FOUNDRY', 'L4-FDE']
    for (const m of MODULES) expect(LAYERS).toContain(m.layer)
    // All five layers represented
    for (const l of LAYERS) expect(MODULES.some(m => m.layer === l), `no module in ${l}`).toBe(true)
  })

  it('layer invariants: L0 singleton model, L1 app, L2 ontology, L4 operators', () => {
    const inLayer = (l: string) => MODULES.filter(m => m.layer === l).map(m => m.id).sort()
    expect(inLayer('L0-MODEL')).toEqual(['providers'])
    expect(inLayer('L1-APPLICATION')).toEqual(['aip', 'presets'])
    expect(inLayer('L2-ONTOLOGY')).toEqual(['data', 'graph', 'studio'])
    expect(inLayer('L4-FDE')).toEqual(['agent', 'jobs', 'swarms', 'workers'])
    expect(inLayer('L3-FOUNDRY')).toEqual(['code-workspaces', 'manifest', 'map', 'observability', 'peer-manager', 'pipeline', 'plugins', 'repos', 'scoping', 'workshop'])
  })
})
