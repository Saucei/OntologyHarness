// Grounded retrieval tests (S3-G) — pins Slice 3: TB grounds, Mars refuses.
import { describe, it, expect } from 'vitest'
import { retrieve, buildGroundedPrompt } from './retrieval'
import { CORPUS } from './corpus'

describe('grounded retrieval', () => {
  it('TB question grounds with the TB regimen as the top hit', () => {
    const r = retrieve('What is the recommended treatment for Tuberculosis?')
    expect(r.grounded).toBe(true)
    if (r.grounded) {
      expect(r.hits[0].id).toBe('chunk-tb-1')
      expect(r.hits.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('TB abbreviation expands (synonym) and still grounds', () => {
    const r = retrieve('TB treatment guidelines for adults')
    expect(r.grounded).toBe(true)
  })

  it('Mars radiation question refuses pre-LLM', () => {
    const r = retrieve('What is the recommended radiation shielding for a Mars colony?')
    expect(r.grounded).toBe(false)
    if (!r.grounded) expect(r.threshold).toBeGreaterThan(r.best)
  })

  it('grounded prompt injects [n] markers with bodies and sources', () => {
    const r = retrieve('What is the recommended treatment for Tuberculosis?')
    expect(r.grounded).toBe(true)
    const prompt = buildGroundedPrompt('BASE: answer with citations', r.grounded ? r.hits : [])
    expect(prompt).toContain('[1] Pulmonary TB — standard regimen')
    expect(prompt).toMatch(/isoniazid/)
  })

  it('corpus is non-empty and every chunk has a stable id and source body', () => {
    expect(CORPUS.length).toBeGreaterThanOrEqual(8)
    for (const c of CORPUS) {
      expect(c.id).toMatch(/^chunk-/)
      expect(c.title.trim()).not.toBe('')
      expect(c.body.trim().length).toBeGreaterThan(80)
    }
  })
})
