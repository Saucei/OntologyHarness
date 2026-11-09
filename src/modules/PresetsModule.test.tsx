// FN-FDE-012 Prompt Template Gallery (T-06) — gallery grid + Apply persistence.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

vi.mock('../packs/loader', () => ({ loadPacks: () => [], packPresets: () => [] }))
vi.mock('../llm/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../llm/client')>()
  return { ...actual, loadSettings: () => ({ providerId: 'openai', model: 'gpt-4o-mini', temperature: 0.2, maxTokens: 256, systemPrompt: '', baseUrl: '', apiKey: '', hasKey: false }) }
})
vi.mock('../agent/orchestrator', () => ({
  runAgent: vi.fn(async () => ({ answer: 'ok', steps: [], hops: 0 })),
}))

import PresetsModule from './PresetsModule'
import { PROMPT_TEMPLATES, PROMPT_GALLERY_META_KEY } from '../data/presets'
import { ws } from '../store'

const readAudit = (): any[] => {
  try { return JSON.parse(localStorage.getItem('ontology-harness.audit') ?? '[]') } catch { return [] }
}

beforeEach(() => {
  localStorage.clear()
  ws.meta = {}
  ws.traces.length = 0
  ws.datasets = []
})
afterEach(() => cleanup())

describe('PresetsModule prompt template gallery (FN-FDE-012)', () => {
  it('renders 6 template cards with bodies and Apply buttons (glass tokens only)', () => {
    render(<PresetsModule />)
    expect(screen.getByTestId('prompt-template-gallery')).toBeTruthy()
    expect(PROMPT_TEMPLATES).toHaveLength(6)
    for (const t of PROMPT_TEMPLATES) {
      const card = screen.getByTestId(`prompt-template-card-${t.id}`)
      expect(card.textContent).toContain(t.category)
      expect(card.textContent).toContain(t.systemPrompt.slice(0, 30))
      expect(card.textContent).toContain(t.userTemplate)
      expect(screen.getByTestId(`prompt-template-apply-${t.id}`).textContent).toMatch(/Apply/)
    }
    expect(screen.getByLabelText('Active preset')).toBeTruthy()
  })

  it('Apply writes the template into the active preset, persists via ws.meta, and records trace + audit', () => {
    render(<PresetsModule />)
    fireEvent.click(screen.getByTestId('prompt-template-apply-tmpl-classification'))

    // persisted gallery state
    const gallery = (ws.meta?.[PROMPT_GALLERY_META_KEY] ?? {}) as any
    expect(gallery.lastTemplateId).toBe('tmpl-classification')
    expect(gallery.activePresetId).toBe('p-1')
    expect(typeof gallery.lastAppliedPresetId).toBe('string')
    expect(gallery.lastAppliedPresetId.length).toBeGreaterThan(0)
    expect(typeof gallery.appliedAt).toBe('string')

    // applied preset (fork of the builtin) carries the template body
    const forks = (ws.meta?.presetForks ?? []) as any[]
    const applied = forks.find(f => f.id === gallery.lastAppliedPresetId)
    expect(applied).toBeTruthy()
    expect(applied.promptTemplateId).toBe('tmpl-classification')
    expect(applied.sourcePresetId).toBe('p-1')
    expect(applied.userTemplate).toContain('Classify {{QUESTION}}')
    expect(applied.systemPrompt).toContain('classifier')

    // trace + audit recorded
    expect(ws.traces.some(t => t.tool === 'prompt-template.apply' && t.ok)).toBe(true)
    const audit = readAudit()
    expect(audit.some(a => a.event === 'prompt-template-apply' && a.templateId === 'tmpl-classification' && a.appliedPresetId === gallery.lastAppliedPresetId)).toBe(true)

    // visible feedback
    expect(screen.getByTestId('prompt-template-applied').textContent).toMatch(/Classification/)
  })

  it('re-applying the same template to the same builtin reuses its fork instead of duplicating', () => {
    render(<PresetsModule />)
    fireEvent.click(screen.getByTestId('prompt-template-apply-tmpl-review'))
    const first = ((ws.meta?.[PROMPT_GALLERY_META_KEY] ?? {}) as any).lastAppliedPresetId
    fireEvent.click(screen.getByTestId('prompt-template-apply-tmpl-review'))
    const second = ((ws.meta?.[PROMPT_GALLERY_META_KEY] ?? {}) as any).lastAppliedPresetId
    expect(second).toBe(first)
    const forks = (ws.meta?.presetForks ?? []) as any[]
    expect(forks.filter(f => f.promptTemplateId === 'tmpl-review' && f.sourcePresetId === 'p-1')).toHaveLength(1)
  })
})
