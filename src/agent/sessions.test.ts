// Token + allowlist helpers for FN-FDE-001/002/003 — computed from actual
// message/tool lengths, never a hard-coded budget string.
import { describe, it, expect, beforeEach } from 'vitest'
import {
  estimateTokens,
  estimateValueTokens,
  formatTokens,
  totalSessionTokens,
  isAllowlisted,
  deriveTitle,
  createSession,
  removeSession,
} from './sessions'
import { ws } from '../store'

beforeEach(() => {
  ws.meta = {}
  ws.hydrated = true
})

describe('token estimates', () => {
  it('estimates ~4 chars per token', () => {
    expect(estimateTokens('')).toBe(0)
    expect(estimateTokens('abcd')).toBe(1)
    expect(estimateTokens('a'.repeat(40))).toBe(10)
  })

  it('formats k-style footer numbers like ~33.1K', () => {
    expect(formatTokens(320)).toBe('320')
    expect(formatTokens(33100)).toBe('33.1K')
    expect(formatTokens(200000)).toBe('200.0K')
  })

  it('total grows with actual message and tool-arg lengths', () => {
    const s = createSession()
    const empty = totalSessionTokens(s, 'System prompt')
    s.messages.push({ id: 1, role: 'user', text: 'a'.repeat(40) })
    s.messages.push({
      id: 2, role: 'assistant', text: 'answer',
      steps: [{ tool: 'ontology.list', args: { q: 'x'.repeat(20) }, result: { ok: true, data: 'y'.repeat(40) }, ok: true, ms: 12 }],
    })
    const grown = totalSessionTokens(s, 'System prompt')
    expect(grown).toBeGreaterThan(empty)
    expect(totalSessionTokens(s, 'System prompt')).toBe(
      estimateTokens('System prompt') + 10 + estimateTokens('answer') + estimateValueTokens({ q: 'x'.repeat(20) }) + estimateValueTokens({ ok: true, data: 'y'.repeat(40) }),
    )
  })
})

describe('session allowlist + titles', () => {
  it('checks allowlist membership by tool name', () => {
    expect(isAllowlisted(['pipeline.run'], 'pipeline.run')).toBe(true)
    expect(isAllowlisted(['pipeline.run'], 'workshop.publish')).toBe(false)
    expect(isAllowlisted([], 'pipeline.run')).toBe(false)
  })

  it('derives a short title from the first user turn', () => {
    expect(deriveTitle([])).toBe('New session')
    expect(deriveTitle([{ id: 1, role: 'user', text: 'What backs Crossover X2?' }])).toBe('What backs Crossover X2?')
    expect(deriveTitle([{ id: 1, role: 'user', text: 'a'.repeat(50) }]).length).toBeLessThanOrEqual(37)
  })

  it('keeps at least one session on remove', () => {
    const a = createSession()
    const state = { sessions: [a], activeId: a.id }
    expect(removeSession(state, a.id)).toBe(state)
  })
})
