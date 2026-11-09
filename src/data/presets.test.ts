// Ribbon helpers for FN-FDE-004 — counts derive from preset.modes[] (L1 schema ext.).
import { describe, it, expect } from 'vitest'
import {
  PRESET_SEED,
  PROMPT_GALLERY_META_KEY,
  PROMPT_TEMPLATES,
  RIBBON_TYPES,
  applyPromptTemplate,
  docsCount,
  findPromptTemplate,
  formatRibbonCount,
  presetDocBags,
  presetSkills,
  readPromptGalleryState,
  ribbonCounts,
  ribbonTotalTools,
  setDocBagEnabled,
  setSkillEnabled,
  skillsCount,
  validatePreset,
} from './presets'

describe('composer ribbon (FN-FDE-004)', () => {
  it('formats per-type chips in 0/8 style', () => {
    expect(formatRibbonCount(0, 8)).toBe('0/8')
    expect(formatRibbonCount(3, 8)).toBe('3/8')
    expect(formatRibbonCount(99, 8)).toBe('8/8')
    expect(formatRibbonCount(-1, 8)).toBe('0/8')
  })

  it('ribbon catalog has Modes/Skills/Documentation/Files/Ontology/Functions at 0/8', () => {
    expect(RIBBON_TYPES.map(t => t.label)).toEqual(['Modes', 'Skills', 'Documentation', 'Files', 'Ontology', 'Functions'])
    const rows = ribbonCounts()
    expect(rows.length).toBe(6)
    for (const r of rows) expect(r.text).toBe('0/8')
    expect(ribbonCounts({ skills: 2 }).find(r => r.id === 'skills')?.text).toBe('2/8')
  })

  it('lit "7" pill total = 7 unique tools from preset.modes[] seeds', () => {
    expect(ribbonTotalTools(PRESET_SEED)).toBe(7)
  })

  it('seed modes keep presets valid and deduplicate tools', () => {
    for (const p of PRESET_SEED.filter(p => p.modes?.length)) {
      expect(validatePreset(p).ok, `${p.id}: ${validatePreset(p).errors.join(',')}`).toBe(true)
    }
    const deduped = ribbonTotalTools([{ ...PRESET_SEED[0], modes: [{ id: 'x', label: 'X', tools: ['a', 'a', 'b'] }] }])
    expect(deduped).toBe(2)
  })
})

// Skill Set Configurations + Documentation attach (FN-FDE-007/008 — T-04).
describe('T-04 skills + documentation helpers', () => {
  it('toggle semantics: setSkillEnabled flips one skill without mutating the source', () => {
    const before = presetSkills(PRESET_SEED[0])
    expect(before.length).toBeGreaterThanOrEqual(3)
    const first = before[0]
    const off = setSkillEnabled(before, first.id, !first.enabled)
    expect(off.length).toBe(before.length)
    expect(off.find(s => s.id === first.id)?.enabled).toBe(!first.enabled)
    for (const s of before.slice(1)) {
      expect(off.find(x => x.id === s.id)?.enabled).toBe(s.enabled)
    }
    // source list untouched (drafts must not leak into applied state)
    expect(before.find(s => s.id === first.id)?.enabled).toBe(first.enabled)
    // unknown id → no-op
    expect(setSkillEnabled(before, 'no-such-skill', true)).toEqual(before)
  })

  it('counts: seeded skills are non-zero and docs read 8/8', () => {
    expect(skillsCount(PRESET_SEED[0])).toBeGreaterThan(0)
    expect(skillsCount(presetSkills(PRESET_SEED[0]))).toBe(skillsCount(PRESET_SEED[0]))
    expect(docsCount(PRESET_SEED[0])).toBe(8)
    expect(formatRibbonCount(docsCount(PRESET_SEED[0]), 8)).toBe('8/8')
    const detached = setDocBagEnabled(presetDocBags(PRESET_SEED[0]), 'docs-custom-triage', false)
    expect(docsCount(detached)).toBe(7)
  })

  it('apply-vs-cancel: cancel discards drafts, apply commits them', () => {
    const applied = presetSkills(PRESET_SEED[0])
    // user drafts a toggle in the modal — applied state is untouched until Apply
    const drafts = setSkillEnabled(applied, applied[0].id, !applied[0].enabled)
    expect(skillsCount(drafts)).toBe(skillsCount(applied) + (applied[0].enabled ? -1 : 1))
    // Cancel → keep the applied list, drafts dropped
    const afterCancel = applied
    expect(skillsCount(afterCancel)).toBe(skillsCount(applied))
    // Apply → drafts become the new applied list
    expect(skillsCount(drafts)).not.toBe(skillsCount(afterCancel))
    expect(drafts.find(s => s.id === applied[0].id)?.enabled).toBe(!applied[0].enabled)
  })

  it('doc kinds: at least two custom and two foundry bags; toggling preserves kind', () => {
    const bags = presetDocBags(PRESET_SEED[0])
    const custom = bags.filter(b => b.kind === 'custom')
    const foundry = bags.filter(b => b.kind === 'foundry')
    expect(custom.length).toBeGreaterThanOrEqual(2)
    expect(foundry.length).toBeGreaterThanOrEqual(2)
    expect(custom.length + foundry.length).toBe(bags.length)
    const next = setDocBagEnabled(bags, custom[0].id, false)
    expect(next.find(b => b.id === custom[0].id)).toMatchObject({ kind: 'custom', enabled: false })
    expect(next.find(b => b.id === foundry[0].id)?.enabled).toBe(true)
    expect(docsCount(bags) - docsCount(next)).toBe(1)
  })

  it('additive schema: presets without skills/documentationBags still load and count zero', () => {
    const bare = { ...PRESET_SEED[3], skills: undefined, documentationBags: undefined }
    expect(presetSkills(bare)).toEqual([])
    expect(presetDocBags(bare)).toEqual([])
    expect(skillsCount(bare)).toBe(0)
    expect(docsCount(bare)).toBe(0)
    expect(validatePreset(bare).ok).toBe(true)
    expect(presetSkills(null)).toEqual([])
  })
})

// Prompt Template Gallery (FN-FDE-012 — T-06).
describe('T-06 prompt template gallery', () => {
  it('gallery has the 6 corpus-2 categories with valid, unique template bodies', () => {
    expect(PROMPT_TEMPLATES.map(t => t.category)).toEqual([
      'Classification', 'Sentiment', 'Extraction', 'Summarization', 'Scoring', 'Review',
    ])
    expect(new Set(PROMPT_TEMPLATES.map(t => t.id)).size).toBe(6)
    for (const t of PROMPT_TEMPLATES) {
      expect(t.systemPrompt.length).toBeGreaterThanOrEqual(20)
      expect(t.userTemplate).toMatch(/\{\{(DATASET|QUESTION)\}\}/)
      // every template is a valid preset prompt when applied
      expect(validatePreset(applyPromptTemplate(PRESET_SEED[0], t)).ok, t.id).toBe(true)
    }
  })

  it('applyPromptTemplate writes the template into the preset without mutating the source', () => {
    const src = PRESET_SEED[0]
    const tmpl = findPromptTemplate('tmpl-sentiment')!
    const next = applyPromptTemplate(src, tmpl)
    expect(next.systemPrompt).toBe(tmpl.systemPrompt)
    expect(next.userTemplate).toBe(tmpl.userTemplate)
    expect(next.outputSchema).toBe(tmpl.outputSchema)
    expect(next.promptTemplateId).toBe(tmpl.id)
    expect(next.sourcePresetId).toBe(src.id)
    // identity/tools/worker preserved, source untouched
    expect(next.id).toBe(src.id)
    expect(next.tools).toEqual(src.tools)
    expect(next.workerId).toBe(src.workerId)
    expect(src.systemPrompt).not.toBe(tmpl.systemPrompt)
    expect(src.promptTemplateId).toBeUndefined()
    expect(findPromptTemplate('no-such-template')).toBeUndefined()
  })

  it('readPromptGalleryState reads ws.meta defensively and round-trips the persisted shape', () => {
    expect(readPromptGalleryState(undefined)).toEqual({})
    expect(readPromptGalleryState(null)).toEqual({})
    expect(readPromptGalleryState({})).toEqual({})
    expect(readPromptGalleryState({ [PROMPT_GALLERY_META_KEY]: 'garbage' })).toEqual({})
    const meta = {
      [PROMPT_GALLERY_META_KEY]: {
        activePresetId: 'p-1', lastTemplateId: 'tmpl-review', lastAppliedPresetId: 'p-custom-x', appliedAt: '2026-11-07T00:00:00.000Z', junk: 1,
      },
    }
    expect(readPromptGalleryState(meta)).toEqual({
      activePresetId: 'p-1', lastTemplateId: 'tmpl-review', lastAppliedPresetId: 'p-custom-x', appliedAt: '2026-11-07T00:00:00.000Z',
    })
  })
})
