// FN-FDE-005/011 Modes + Thinking (T-02) — presets catalogue, verbatim
// "Adds N tools" pill computed from the mode's tools set cross-checked
// against TOOL_CATEGORIES, and the persistable thinking summary.
import { describe, it, expect, beforeEach } from 'vitest'
import {
  MODE_SEGMENTS,
  PRESET_SEED,
  allPresetModes,
  filterModesBySegment,
  modeSegmentFor,
} from '../data/presets'
import {
  ACTIVE_MODE_META_KEY,
  TOOL_CATEGORIES,
  addsToolsLabel,
  buildActiveMode,
  countModeTools,
  loadActiveMode,
  modeToolNames,
  saveActiveMode,
  thinkingSummary,
} from './permissions'
import { TOOLS } from './tools'
import { ws } from '../store'

beforeEach(() => {
  ws.meta = {}
  ws.hydrated = true
})

describe('modes catalogue (FN-FDE-005)', () => {
  it('lists all 7 tool-carrying modes from PresetMode seeds', () => {
    const modes = allPresetModes(PRESET_SEED)
    const labels = modes.map(m => m.label)
    for (const label of [
      'Transform data',
      'Modify ontology',
      'Write functions',
      'Exploration',
      'Governance',
      'OSDK React',
      'Platform Q&A',
    ]) {
      expect(labels).toContain(label)
    }
    // Distinct by id, no duplicates.
    expect(new Set(modes.map(m => m.id)).size).toBe(modes.length)
    // Every mode carries at least one tool name.
    for (const m of modes) expect(m.tools.length).toBeGreaterThan(0)
  })

  it('computes verbatim Adds N tools from the mode tools set (cross-checked, deduped)', () => {
    // Genuine modes: count comes from the set, never a hard-coded literal.
    for (const m of allPresetModes(PRESET_SEED)) {
      expect(addsToolsLabel(m, TOOLS)).toBe(`Adds ${countModeTools(m.tools, TOOLS)} tools`)
      expect(addsToolsLabel(m, TOOLS)).toMatch(/^Adds \d+ tools$/)
    }
    // Dedupes and drops unknown tools instead of duplicating a tool list.
    expect(modeToolNames(['graph.query', 'graph.query', 'no.such.tool'], TOOLS)).toEqual(['graph.query'])
    expect(addsToolsLabel({ tools: ['graph.query', 'graph.query', 'no.such.tool'] }, TOOLS)).toBe('Adds 1 tools')
    // Cross-check: every counted tool belongs to a TOOL_CATEGORIES bucket.
    const cats = new Set(TOOL_CATEGORIES.map(c => c.id))
    for (const name of modeToolNames(allPresetModes(PRESET_SEED).flatMap(m => m.tools), TOOLS)) {
      const def = TOOLS.find(t => t.name === name)!
      expect(cats.has(def.category ?? '')).toBe(true)
    }
  })

  it('segments modes into Data / Build / Govern buckets without changing tools', () => {
    expect(modeSegmentFor('write-functions')).toBe('build')
    expect(modeSegmentFor('osdk-react')).toBe('build')
    expect(modeSegmentFor('govern')).toBe('govern')
    expect(modeSegmentFor('platform-qa')).toBe('govern')
    expect(modeSegmentFor('transform')).toBe('data')
    expect(MODE_SEGMENTS.map(s => s.id)).toEqual(['all', 'data', 'build', 'govern'])
    const all = allPresetModes(PRESET_SEED)
    const union = filterModesBySegment(all, 'data').length + filterModesBySegment(all, 'build').length + filterModesBySegment(all, 'govern').length
    expect(union).toBe(all.length)
    expect(filterModesBySegment(all, 'all')).toHaveLength(all.length)
  })
})

describe('thinking summary (FN-FDE-011)', () => {
  it('summarises the plan before tool calls from mode label + tools', () => {
    const mode = allPresetModes(PRESET_SEED).find(m => m.id === 'transform')!
    const summary = thinkingSummary(mode, 'back up the lineage graph', TOOLS)
    expect(summary).toContain('Transform data')
    expect(summary).toContain('ontology.get')
    expect(summary).toMatch(/before (acting|tool)/i)
    expect(summary).toContain('back up the lineage graph')
    // Empty prompt still yields a plan rooted in the mode's tools.
    const bare = thinkingSummary(mode, '', TOOLS)
    expect(bare).not.toContain('Task:')
    expect(bare).toContain('ontology.get')
  })

  it('persists the active mode in ws.meta and reloads it sanitized', () => {
    const mode = allPresetModes(PRESET_SEED).find(m => m.id === 'govern')!
    const next = buildActiveMode(mode, 'audit lineage', TOOLS)
    expect(next.modeId).toBe('govern')
    expect(next.tools).toEqual(['ontology.list'])
    expect(next.thinking).toContain('Governance')
    saveActiveMode(next)
    expect(ws.meta[ACTIVE_MODE_META_KEY]).toMatchObject({ modeId: 'govern', label: 'Governance', tools: ['ontology.list'] })
    const loaded = loadActiveMode(TOOLS)
    expect(loaded).toEqual(next)
    // Unknown tools in a persisted blob are dropped on load.
    ws.meta[ACTIVE_MODE_META_KEY] = { modeId: 'govern', label: 'Governance', tools: ['ontology.list', 'ghost.tool', 'ontology.list'], thinking: 'x' }
    expect(loadActiveMode(TOOLS).tools).toEqual(['ontology.list'])
    // Missing blob loads as empty.
    ws.meta = {}
    expect(loadActiveMode(TOOLS)).toEqual({ modeId: null, label: null, tools: [], thinking: '' })
  })
})
