// consume.ts tests (T-36) — enabled plugins must take effect outside the Plugin Manager.
import { describe, it, expect, beforeEach } from 'vitest'
import { ws } from '../store'
import { enabledPackUnits, enabledPackPresets, mergeCorpus, packEntries, PACK_LANDING } from './consume'

const CORPUS_PACK = JSON.stringify({
  id: 'test-corpus',
  name: 'Test Corpus',
  kind: 'corpus',
  api: '^1.0',
  version: '1.0.0',
  description: 'session corpus for tests',
  totalFiles: 2,
  generatedAt: '2026-11-10T00:00:00Z',
  source: 'test',
  categories: { 'architecture-lineage': { count: 2, files: ['pack-alpha.png', 'pack-beta.png'] } },
})

const PRESET_PACK = JSON.stringify({
  id: 'test-presets',
  name: 'Test Presets',
  kind: 'presets',
  api: '^1.0',
  version: '1.0.0',
  description: 'session presets for tests',
  data: [{
    id: 'p-pack-test',
    name: 'Pack preset',
    desc: 'from test pack',
    icon: 'spark',
    systemPrompt: 'You are a pack-provided test agent. Terse bullets.',
    userTemplate: 'Search the corpus for: {{QUESTION}}',
    tools: ['corpus.search'],
    workerId: 'wk-scribe',
  }],
})

describe('pack consumption (T-36)', () => {
  beforeEach(() => { ws.meta = {} })

  it('enabledPackUnits returns valid enabled packs (bundled + custom) and nothing else', () => {
    // Nothing enabled → nothing consumed.
    expect(enabledPackUnits().map(u => u.manifest.id)).toEqual([])
    // Custom corpus pack installed + enabled.
    ws.meta.customPacks = [{ json: CORPUS_PACK, source: 'pasted', jwt: 42 }]
    ws.meta.packState = { 'test-corpus': true, 'not-a-pack': true }
    const ids = enabledPackUnits().map(u => u.manifest.id)
    expect(ids).toContain('test-corpus')
    expect(ids).not.toContain('not-a-pack')
    // Toggle it off → gone.
    ws.meta.packState = { 'test-corpus': false }
    expect(enabledPackUnits().map(u => u.manifest.id)).toEqual([])
  })

  it('enabledPackPresets surfaces presets from enabled presets packs only', () => {
    ws.meta.customPacks = [{ json: PRESET_PACK, source: 'pasted', jwt: 7 }]
    expect(enabledPackPresets()).toEqual([])
    ws.meta.packState = { 'test-presets': true }
    const presets = enabledPackPresets()
    expect(presets).toHaveLength(1)
    expect(presets[0].id).toBe('p-pack-test')
    expect(presets[0].name).toBe('Pack preset')
  })

  it('mergeCorpus merges base + pack categories, dedupes by file, labels pack files', () => {
    const base = { categories: { 'ontology-layer': { count: 1, files: ['base.png'] } } }
    ws.meta.customPacks = [{ json: CORPUS_PACK, source: 'pasted', jwt: 42 }]
    ws.meta.packState = { 'test-corpus': true }
    const units = enabledPackUnits()
    const merged = mergeCorpus(base, units)
    expect(merged.packNames).toEqual(['Test Corpus'])
    expect(merged.totalFiles).toBe(3)
    expect(merged.categories['ontology-layer'].files).toEqual(['base.png'])
    expect(merged.categories['architecture-lineage'].files).toEqual(['pack-alpha.png', 'pack-beta.png'])
    expect(merged.fileSource['pack-alpha.png']).toBe('Test Corpus')
    expect(merged.fileSource['base.png']).toBeUndefined()
    // Search entries carry the pack note.
    const entries = packEntries(merged)
    expect(entries).toHaveLength(2)
    expect(entries[0]).toEqual({ file: 'pack-alpha.png', category: 'architecture-lineage', note: 'pack: Test Corpus' })
  })

  it('mergeCorpus dedupes files the base already has (base wins, no pack label)', () => {
    const base = { categories: { 'ontology-layer': { count: 1, files: ['pack-alpha.png'] } } }
    const unit = { valid: true, manifest: { id: 'x', name: 'Test Corpus', kind: 'corpus' as const, api: '^1.0', version: '1.0.0' }, files: {}, issues: [], source: 'pasted' as const, jwt: 1 }
    const merged = mergeCorpus(base, [unit])
    expect(merged.totalFiles).toBe(1)
    expect(merged.fileSource['pack-alpha.png']).toBeUndefined()
    expect(packEntries(merged)).toEqual([])
  })

  it('documents a landing zone for every pack kind', () => {
    for (const kind of ['theme-packs', 'corpus', 'presets', 'rules', 'prompts']) {
      expect(PACK_LANDING[kind]).toBeTruthy()
    }
    expect(PACK_LANDING['corpus']).toMatch(/corpus\.search/)
  })
})
