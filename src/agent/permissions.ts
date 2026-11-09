// Tool permission matrix (FN-FDE-006) — L4 policy over L1 tool defs.
// Categories, per-tool Allow/Ask/Deny, branch-condition If/Else evaluation.
// Persisted in ws.meta[toolPermissions] via patchMeta — no new store APIs.
// + FN-FDE-005/011 Modes (new-lite): tool-carrying PresetMode tool counts
// computed from tool defs cross-checked against TOOL_CATEGORIES — never a
// duplicated tool list. Active mode persists in ws.meta[activeMode].
import { ws, patchMeta } from '../store'
import { TOOLS, type ToolDef } from './tools'
import type { PresetMode } from '../data/presets'

export const META_KEY = 'toolPermissions'

export type PermissionDecision = 'allow' | 'ask' | 'deny'

export type BranchCondition = {
  field: 'branch'
  op: 'is' | 'isNot'
  value: string
}

export type PermissionRule = {
  id: string
  tool: string
  condition: BranchCondition
  ifDecision: PermissionDecision
  elseDecision: PermissionDecision
}

export type ToolPermissionsState = {
  enabled: string[]
  decisions: Record<string, PermissionDecision>
  rules: PermissionRule[]
}

export type ToolCategory = {
  id: string
  label: string
  icon: string
  total: number
}

/** Left-panel categories. Totals mirror the ribbon 0/8 capacity chips. */
export const TOOL_CATEGORIES: ToolCategory[] = [
  { id: 'graph', label: 'Graph', icon: 'graph', total: 8 },
  { id: 'ontology', label: 'Ontology', icon: 'cube', total: 8 },
  { id: 'corpus', label: 'Corpus', icon: 'search', total: 8 },
  { id: 'pipeline', label: 'Pipeline', icon: 'pipeline', total: 8 },
  { id: 'workshop', label: 'Workshop', icon: 'workshop', total: 8 },
]

const DECISIONS: PermissionDecision[] = ['allow', 'ask', 'deny']

export function isPermissionDecision(v: any): v is PermissionDecision {
  return v === 'allow' || v === 'ask' || v === 'deny'
}

export function formatCategoryCount(enabled: number, total: number): string {
  const sel = Math.max(0, Math.min(enabled, total))
  return `${sel}/${total}`
}

export const DEFAULT_RULE: PermissionRule = {
  id: 'rule-master',
  tool: 'pipeline.run',
  condition: { field: 'branch', op: 'is', value: 'master' },
  ifDecision: 'ask',
  elseDecision: 'allow',
}

export function defaultPermissions(): ToolPermissionsState {
  return {
    enabled: [],
    decisions: {},
    rules: [{ ...DEFAULT_RULE, condition: { ...DEFAULT_RULE.condition } }],
  }
}

function uid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`
}

function isRule(v: any): v is PermissionRule {
  if (!v || typeof v !== 'object') return false
  if (typeof v.id !== 'string' || typeof v.tool !== 'string') return false
  if (!v.condition || v.condition.field !== 'branch') return false
  if (v.condition.op !== 'is' && v.condition.op !== 'isNot') return false
  if (typeof v.condition.value !== 'string') return false
  return isPermissionDecision(v.ifDecision) && isPermissionDecision(v.elseDecision)
}

/** Load + sanitize { enabled, decisions, rules } from ws.meta; always returns a valid state. */
export function loadToolPermissions(): ToolPermissionsState {
  const raw = ws.meta?.[META_KEY] as any
  const fallback = defaultPermissions()
  if (!raw || typeof raw !== 'object') return fallback
  const known = new Set(TOOLS.map(t => t.name))
  const enabled: string[] = Array.isArray(raw.enabled)
    ? Array.from(new Set<string>(raw.enabled.filter((x: any) => typeof x === 'string' && known.has(x))))
    : []
  const decisions: Record<string, PermissionDecision> = {}
  if (raw.decisions && typeof raw.decisions === 'object') {
    for (const [k, v] of Object.entries(raw.decisions as Record<string, any>)) {
      if (known.has(k) && isPermissionDecision(v)) decisions[k] = v
    }
  }
  const rules: PermissionRule[] = Array.isArray(raw.rules)
    ? (raw.rules as unknown[]).filter(isRule).map((r: PermissionRule) => ({
        id: r.id,
        tool: r.tool,
        condition: { field: 'branch' as const, op: r.condition.op, value: r.condition.value },
        ifDecision: r.ifDecision,
        elseDecision: r.elseDecision,
      }))
    : fallback.rules
  return { enabled, decisions, rules }
}

export function saveToolPermissions(state: ToolPermissionsState): void {
  patchMeta({ [META_KEY]: state })
}

/** Enabled-tool counts per category, formatted as "n/8" chips. */
export function categoryCounts(
  state: ToolPermissionsState,
  tools: ToolDef[] = TOOLS,
): { id: string; label: string; icon: string; enabled: number; total: number; text: string }[] {
  const enabledSet = new Set(state.enabled)
  return TOOL_CATEGORIES.map(c => {
    const enabled = tools.filter(t => (t.category ?? '') === c.id && enabledSet.has(t.name)).length
    return { id: c.id, label: c.label, icon: c.icon, enabled, total: c.total, text: formatCategoryCount(enabled, c.total) }
  })
}

/** Tools in one category (middle panel). */
export function toolsInCategory(categoryId: string, tools: ToolDef[] = TOOLS): ToolDef[] {
  return tools.filter(t => (t.category ?? '') === categoryId)
}

/** Evaluate a branch condition against a context branch name. */
export function matchesBranch(condition: BranchCondition, branch: string): boolean {
  const b = (branch ?? '').trim()
  const v = (condition.value ?? '').trim()
  return condition.op === 'is' ? b === v : b !== v
}

/** Resolve one rule's If/Else decision for a branch. */
export function resolveRule(rule: PermissionRule, branch: string): PermissionDecision {
  return matchesBranch(rule.condition, branch) ? rule.ifDecision : rule.elseDecision
}

/**
 * Full evaluation for a tool: disabled → deny; first matching rule wins
 * (If/Else on branch); otherwise the per-tool static decision, default ask.
 */
export function evaluatePermission(
  toolName: string,
  state: ToolPermissionsState,
  ctx: { branch: string } = { branch: '' },
): PermissionDecision {
  if (!state.enabled.includes(toolName)) return 'deny'
  const rule = state.rules.find(r => r.tool === toolName)
  if (rule) return resolveRule(rule, ctx.branch)
  return state.decisions[toolName] ?? 'ask'
}

export function isToolEnabled(state: ToolPermissionsState, toolName: string): boolean {
  return state.enabled.includes(toolName)
}

export function toggleToolEnabled(state: ToolPermissionsState, toolName: string): ToolPermissionsState {
  const enabled = state.enabled.includes(toolName)
    ? state.enabled.filter(n => n !== toolName)
    : [...state.enabled, toolName]
  return { ...state, enabled }
}

export function setToolDecision(
  state: ToolPermissionsState,
  toolName: string,
  decision: PermissionDecision,
): ToolPermissionsState {
  return { ...state, decisions: { ...state.decisions, [toolName]: decision } }
}

export function addPermissionRule(
  state: ToolPermissionsState,
  input: { tool: string; branch: string; ifDecision: PermissionDecision; elseDecision: PermissionDecision },
): ToolPermissionsState {
  const rule: PermissionRule = {
    id: uid(),
    tool: input.tool,
    condition: { field: 'branch', op: 'is', value: input.branch.trim() || 'master' },
    ifDecision: input.ifDecision,
    elseDecision: input.elseDecision,
  }
  return { ...state, rules: [...state.rules, rule] }
}

export function removePermissionRule(state: ToolPermissionsState, id: string): ToolPermissionsState {
  return { ...state, rules: state.rules.filter(r => r.id !== id) }
}

/** Revert rules to the seeded "If branch is master → Ask / Else Allow" default. */
export function revertPermissionRules(state: ToolPermissionsState): ToolPermissionsState {
  return { ...state, rules: defaultPermissions().rules }
}

export { DECISIONS }

/* ── FN-FDE-005 Modes + FN-FDE-011 Thinking (new-lite) ─────────────
   Counts derive from the mode's own tools set validated against TOOLS /
   TOOL_CATEGORIES — no parallel tool lists are maintained here. */

export const ACTIVE_MODE_META_KEY = 'activeMode'

export type ActiveModeState = {
  modeId: string | null
  label: string | null
  tools: string[]
  thinking: string
}

export const EMPTY_ACTIVE_MODE: ActiveModeState = { modeId: null, label: null, tools: [], thinking: '' }

/** Deduped tools of a mode, filtered to tools whose category is known (TOOL_CATEGORIES). */
export function modeToolNames(modeTools: string[], defs: ToolDef[] = TOOLS): string[] {
  const validCategories = new Set(TOOL_CATEGORIES.map(c => c.id))
  const known = new Map<string, ToolDef>()
  for (const t of defs) if (validCategories.has(t.category ?? '')) known.set(t.name, t)
  const seen = new Set<string>()
  const out: string[] = []
  for (const name of modeTools ?? []) {
    if (seen.has(name)) continue
    seen.add(name)
    if (known.has(name)) out.push(name)
  }
  return out
}

/** Number of known tools a mode carries (deduped). */
export function countModeTools(modeTools: string[], defs: ToolDef[] = TOOLS): number {
  return modeToolNames(modeTools, defs).length
}

/** Verbatim Modes pill: "Adds N tools" computed from the mode's tools set. */
export function addsToolsLabel(mode: Pick<PresetMode, 'tools'>, defs: ToolDef[] = TOOLS): string {
  return `Adds ${countModeTools(mode.tools, defs)} tools`
}

/**
 * FN-FDE-011 reasoning summary of the plan before tool calls — deterministic
 * from the mode label + its tools; optionally grounded in the user prompt.
 */
export function thinkingSummary(
  mode: Pick<PresetMode, 'label' | 'tools'>,
  prompt = '',
  defs: ToolDef[] = TOOLS,
): string {
  const tools = modeToolNames(mode.tools, defs)
  const toolText = tools.length ? tools.join(', ') : 'no tools attached'
  const q = (prompt ?? '').trim().replace(/\s+/g, ' ')
  const task = q ? ` · Task: "${q.length > 80 ? `${q.slice(0, 80)}…` : q}"` : ''
  return `Plan with ${mode.label} — inspect ${toolText} before acting · ground in corpus first · verify before reporting${task}`
}

/** Build the persistable active-mode state for a selected PresetMode. */
export function buildActiveMode(mode: PresetMode, prompt = '', defs: ToolDef[] = TOOLS): ActiveModeState {
  const tools = modeToolNames(mode.tools, defs)
  return {
    modeId: mode.id,
    label: mode.label,
    tools,
    thinking: thinkingSummary(mode, prompt, defs),
  }
}

function asActiveMode(raw: any, defs: ToolDef[] = TOOLS): ActiveModeState {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_ACTIVE_MODE }
  const modeId = typeof raw.modeId === 'string' && raw.modeId ? raw.modeId : null
  if (!modeId) return { ...EMPTY_ACTIVE_MODE }
  const label = typeof raw.label === 'string' && raw.label ? raw.label : modeId
  const tools = Array.isArray(raw.tools) ? modeToolNames(raw.tools.filter((x: unknown) => typeof x === 'string'), defs) : []
  const thinking = typeof raw.thinking === 'string' ? raw.thinking : ''
  return { modeId, label, tools, thinking }
}

/** Load + sanitize the persisted active mode from ws.meta; empty when unset. */
export function loadActiveMode(defs: ToolDef[] = TOOLS): ActiveModeState {
  return asActiveMode((ws.meta as Record<string, any>)?.[ACTIVE_MODE_META_KEY], defs)
}

export function saveActiveMode(state: ActiveModeState): void {
  patchMeta({ [ACTIVE_MODE_META_KEY]: state })
}
