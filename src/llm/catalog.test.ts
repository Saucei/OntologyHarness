// FN-FDE-009/010: model catalog + reasoning tiers + composer protocol.
import { describe, it, expect } from 'vitest'
import {
  CATALOG_TABS,
  MODEL_CATALOG,
  catalogForTab,
  catalogEntryForModel,
  formatContextTokens,
  formatRate,
  REASONING_TIERS,
  getReasoningTier,
  nextReasoningTier,
  tierPillLabel,
  applyReasoningTier,
  resolveComposerAction,
  detectComposerTrigger,
  composerTriggerQuery,
  defaultSettings,
} from './client'

describe('model catalog (FN-FDE-009)', () => {
  it('exposes Hosted | Registered | More tabs with non-empty groups', () => {
    expect(CATALOG_TABS.map(t => t.id)).toEqual(['hosted', 'registered', 'more'])
    for (const t of CATALOG_TABS) {
      expect(catalogForTab(t.id).length).toBeGreaterThan(0)
    }
    const ids = new Set(MODEL_CATALOG.map(e => e.id))
    expect(ids.size).toBe(MODEL_CATALOG.length)
  })

  it('looks up entries by model (+ provider disambiguation) and formats stats', () => {
    expect(catalogEntryForModel('gpt-4o-mini', 'openai')?.tab).toBe('registered')
    expect(catalogEntryForModel('claude-sonnet-4-5', 'anthropic')?.tab).toBe('hosted')
    expect(catalogEntryForModel('nope')).toBeNull()
    expect(formatContextTokens(128_000)).toBe('128K')
    expect(formatContextTokens(1_000_000)).toBe('1M')
    expect(formatRate(1_000_000)).toBe('1,000,000')
    expect(formatRate(0)).toBe('—')
  })
})

describe('reasoning tiers (FN-FDE-010)', () => {
  it('defaults to Balanced / Medium and pills as "Balanced • model (Medium)"', () => {
    expect(defaultSettings().reasoningTier).toBe('balanced')
    expect(getReasoningTier('balanced').effort).toBe('Medium')
    expect(getReasoningTier('bogus').id).toBe('balanced')
    expect(tierPillLabel('balanced', 'gpt-4o-mini')).toBe('Balanced • gpt-4o-mini (Medium)')
    expect(tierPillLabel(null, '')).toBe('Balanced • no model (Medium)')
    expect(nextReasoningTier('balanced')).toBe('deep')
    expect(nextReasoningTier('deep')).toBe('fast')
    expect(REASONING_TIERS.length).toBeGreaterThanOrEqual(3)
  })

  it('applies a tier as a pure settings patch', () => {
    const s = { ...defaultSettings(), temperature: 0.9, maxTokens: 999 }
    const next = applyReasoningTier(s, 'fast')
    expect(next.reasoningTier).toBe('fast')
    expect(next.temperature).toBe(0.0)
    expect(next.maxTokens).toBe(512)
    expect(s.temperature).toBe(0.9) // original untouched
  })
})

describe('composer keyboard protocol (FN-FDE-010)', () => {
  it('maps Enter / Shift+Enter / Ctrl+Enter', () => {
    expect(resolveComposerAction({ key: 'Enter' })).toBe('send')
    expect(resolveComposerAction({ key: 'Enter', ctrlKey: true })).toBe('send')
    expect(resolveComposerAction({ key: 'Enter', metaKey: true })).toBe('send')
    expect(resolveComposerAction({ key: 'Enter', shiftKey: true })).toBe('newline')
    expect(resolveComposerAction({ key: 'a' })).toBe('none')
    expect(resolveComposerAction({ key: 'Escape' })).toBe('none')
  })

  it('detects "/" and "$" triggers anchored to the last token', () => {
    expect(detectComposerTrigger('/')).toBe('/')
    expect(detectComposerTrigger('hello /mode')).toBe('/')
    expect(detectComposerTrigger('$')).toBe('$')
    expect(detectComposerTrigger('sum $budget')).toBe('$')
    expect(detectComposerTrigger('a/b')).toBeNull()
    expect(composerTriggerQuery('hello /mo')).toEqual({ trigger: '/', query: 'mo' })
    expect(composerTriggerQuery('plain text')).toBeNull()
  })
})
