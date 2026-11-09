import { describe, it, expect } from 'vitest'
import { loadPacks, registerCustomPack, lintThemeCss, packPresets, packCorpus, packDataEntryCount } from './loader'
import { validatePreset } from '../data/presets'

const validCorpusManifest = {
  id: 'testing-corpus',
  name: 'Testing Corpus',
  version: '1.0.0',
  kind: 'corpus',
  api: '^1.0',
  description: 'test pack',
  totalFiles: 2,
  generatedAt: '2026-11-06T00:00:00.000Z',
  source: 'test',
  categories: { test: { count: 2, files: ['a.png', 'b.png'] } },
}

describe('T1 pack loader', () => {
  const units = loadPacks()

  it('discovers the 4 proof packs, all valid', () => {
    const ids = units.map(u => u.manifest.id)
    expect(ids).toContain('theme-cream-glass')
    expect(ids).toContain('presets-brewery')
    expect(ids).toContain('corpus-134')
    expect(ids).toContain('corpus-2')
    for (const u of units) {
      if (ids.includes('theme-cream-glass') || ids.includes('presets-brewery') || ids.includes('corpus-134') || ids.includes('corpus-2')) {
        expect(u.valid, `${u.manifest.id} should validate: ${u.issues.join(' | ')}`).toBe(true)
      }
    }
  })

  it('corpus packs embed real manifest payloads (honest evidence)', () => {
    const c2 = units.find(u => u.manifest.id === 'corpus-2')
    const c1 = units.find(u => u.manifest.id === 'corpus-134')
    const m2 = packCorpus(c2!)
    const m1 = packCorpus(c1!)
    expect(m2?.totalFiles).toBe(72)
    expect(m2?.categories['ai-fde'].count).toBe(11)
    expect(m2?.categories['agent-studio'].count).toBe(13)
    expect(m1?.totalFiles).toBe(134)
    expect(packDataEntryCount(c2!)).toBe(72)
  })

  it('presets pack payload passes validatePreset', () => {
    const brew = units.find(u => u.manifest.id === 'presets-brewery')!
    const presets = packPresets([brew])
    expect(presets.length).toBe(3)
    for (const p of presets) expect(validatePreset(p).ok, validatePreset(p).errors.join(',')).toBe(true)
  })

  it('theme pack lint: tokens-only CSS across both modes', () => {
    const theme = units.find(u => u.manifest.id === 'theme-cream-glass')!
    expect(theme.valid).toBe(true)
    expect(lintThemeCss(theme.files['tokens.css'])).toEqual([])
  })

  it('theme law refuses non-token CSS', () => {
    expect(lintThemeCss('.nav { color: red }').length).toBeGreaterThan(0)
    expect(lintThemeCss(':root { --green-500: #000; }')).toEqual([])
    expect(lintThemeCss('[data-theme="dark"] { --green-600: #123 }')).toEqual([])
  })

  it('registerCustomPack validates manifests + rejects bad api major', () => {
    const ok = registerCustomPack(JSON.stringify(validCorpusManifest), 'pasted')
    expect(ok.ok).toBe(true)
    expect(ok.unit?.files['manifest.json']).toBeTruthy()

    const badApi = registerCustomPack(JSON.stringify({ ...validCorpusManifest, api: '^2.0' }), 'pasted')
    expect(badApi.ok).toBe(false)
    expect(badApi.issues[0]).toMatch(/major 2 unsupported/)

    const badKind = registerCustomPack(JSON.stringify({ ...validCorpusManifest, kind: 'themes' }), 'pasted')
    expect(badKind.ok).toBe(false)

    const themeBlocked = registerCustomPack(JSON.stringify({ ...validCorpusManifest, id: 'theme-x', kind: 'theme-packs' }), 'pasted')
    expect(themeBlocked.ok).toBe(false)
    expect(themeBlocked.issues[0]).toMatch(/bare JSON/)
  })
})
