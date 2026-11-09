// Permission matrix helpers (FN-FDE-006) — branch-condition If/Else eval,
// per-tool Allow/Ask/Deny, and 0/8 category counts.
import { describe, it, expect, beforeEach } from 'vitest'
import {
  TOOL_CATEGORIES,
  addPermissionRule,
  categoryCounts,
  defaultPermissions,
  evaluatePermission,
  matchesBranch,
  removePermissionRule,
  resolveRule,
  revertPermissionRules,
  setToolDecision,
  toggleToolEnabled,
  type PermissionRule,
} from './permissions'
import { ws } from '../store'

beforeEach(() => {
  ws.meta = {}
  ws.hydrated = true
})

describe('branch-condition eval', () => {
  it('matches `is` / `isNot` against the current branch', () => {
    const cond = { field: 'branch' as const, op: 'is' as const, value: 'master' }
    expect(matchesBranch(cond, 'master')).toBe(true)
    expect(matchesBranch(cond, 'feature/x')).toBe(false)
    expect(matchesBranch({ ...cond, op: 'isNot' }, 'master')).toBe(false)
    expect(matchesBranch({ ...cond, op: 'isNot' }, ' feature/x ')).toBe(true)
  })

  it('resolves the seeded If master → Ask / Else Allow rule', () => {
    const s = defaultPermissions()
    const rule = s.rules[0]
    expect(rule.tool).toBe('pipeline.run')
    expect(resolveRule(rule, 'master')).toBe('ask')
    expect(resolveRule(rule, 'feature/x')).toBe('allow')
  })
})

describe('evaluatePermission', () => {
  it('denies disabled tools, then applies rules before static decisions', () => {
    let s = defaultPermissions()
    // Seed rule targets pipeline.run but it is disabled by default → deny.
    expect(evaluatePermission('pipeline.run', s, { branch: 'master' })).toBe('deny')

    s = toggleToolEnabled(s, 'pipeline.run')
    expect(evaluatePermission('pipeline.run', s, { branch: 'master' })).toBe('ask')
    expect(evaluatePermission('pipeline.run', s, { branch: 'feature/x' })).toBe('allow')

    // A tool without a rule falls back to its static decision, default ask.
    s = toggleToolEnabled(s, 'ontology.list')
    expect(evaluatePermission('ontology.list', s, { branch: 'master' })).toBe('ask')
    s = setToolDecision(s, 'ontology.list', 'allow')
    expect(evaluatePermission('ontology.list', s, { branch: 'master' })).toBe('allow')
    s = setToolDecision(s, 'ontology.list', 'deny')
    expect(evaluatePermission('ontology.list', s, { branch: 'master' })).toBe('deny')
  })

  it('adds and removes rules, first match wins', () => {
    let s = toggleToolEnabled(defaultPermissions(), 'pipeline.run')
    s = addPermissionRule(s, { tool: 'pipeline.run', branch: 'dev', ifDecision: 'allow', elseDecision: 'deny' })
    expect(s.rules).toHaveLength(2)
    // First rule still wins for 'dev' (else → allow), not the appended deny.
    expect(evaluatePermission('pipeline.run', s, { branch: 'dev' })).toBe('allow')
    expect(evaluatePermission('pipeline.run', s, { branch: 'master' })).toBe('ask')

    const id = s.rules[1].id
    const removed = removePermissionRule(s, id)
    expect(removed.rules).toHaveLength(1)
  })

  it('reverts rules to the seeded default', () => {
    let s = addPermissionRule(defaultPermissions(), { tool: 'graph.query', branch: 'main', ifDecision: 'deny', elseDecision: 'ask' })
    expect(s.rules).toHaveLength(2)
    s = revertPermissionRules(s)
    expect(s.rules).toHaveLength(1)
    expect(s.rules[0].condition.value).toBe('master')
  })
})

describe('category counts', () => {
  it('starts at 0/8 per category and tracks enabled tools', () => {
    let s = defaultPermissions()
    const initial = categoryCounts(s)
    expect(initial).toHaveLength(TOOL_CATEGORIES.length)
    for (const c of initial) expect(c.text).toBe('0/8')

    s = toggleToolEnabled(s, 'ontology.list')
    s = toggleToolEnabled(s, 'ontology.get')
    const after = categoryCounts(s)
    const onto = after.find(c => c.id === 'ontology')
    expect(onto?.text).toBe('2/8')
    expect(after.find(c => c.id === 'graph')?.text).toBe('0/8')
  })
})
