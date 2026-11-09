// Agent inputs + session completion policy (FN-AST-001, FN-AST-009) and
// pre-computed variables + templates (FN-AST-002).
// Typed agent inputs (string/number/boolean/option, Required/Optional) and
// the session completion policy (maxTurns, requireVerification, dryRunDefault)
// are persisted in ws.meta via patchMeta — no new store APIs.
// Reference tiles (corpus-2): new-agent-input-settings.png (Inputs list + Type
// + Required/Optional) and session-completion-options.png (Stays open / Ends
// after first valid output).
import { ws, patchMeta } from '../store'
import { GRAPH_EDGES, GRAPH_NODES } from './graph'

export const INPUTS_META_KEY = 'agentInputs'
export const POLICY_META_KEY = 'agentCompletionPolicy'
/** Meta key for pre-computed variable templates (FN-AST-002). */
export const TEMPLATES_META_KEY = 'agentVariables_templates'
export const VARIABLES_TEMPLATES_META_KEY = TEMPLATES_META_KEY
export const PRECOMPUTED_VARIABLES_META_KEY = TEMPLATES_META_KEY
export const AGENT_VARIABLES_TEMPLATES_META_KEY = TEMPLATES_META_KEY

/** The four typed inputs supported by the agent-studio Inputs tile. */
export type InputType = 'string' | 'number' | 'boolean' | 'option'

export type AgentInput = {
  id: string
  name: string
  type: InputType
  required: boolean
  /** Default value for preview/session start; stored as a JSON-safe primitive. */
  defaultValue?: string | number | boolean
  /** Allowed values — only meaningful when type === 'option'. */
  options: string[]
}

export type CompletionMode = 'stays-open' | 'first-valid-output'

export type CompletionPolicy = {
  mode: CompletionMode
  maxTurns: number
  requireVerification: boolean
  dryRunDefault: boolean
}

/** Allowed max-turns window. The orchestrator hop cap is 8, so the default aligns with it. */
export const MIN_MAX_TURNS = 1
export const MAX_MAX_TURNS = 30
export const DEFAULT_MAX_TURNS = 8

export const INPUT_TYPES: Array<{ id: InputType; label: string }> = [
  { id: 'string', label: 'String' },
  { id: 'number', label: 'Number' },
  { id: 'boolean', label: 'Boolean' },
  { id: 'option', label: 'Option' },
]

export const COMPLETION_MODES: Array<{ id: CompletionMode; label: string; description: string }> = [
  {
    id: 'stays-open',
    label: 'Stays open',
    description: 'The session will remain open for user messages. Ideal for conversational agents.',
  },
  {
    id: 'first-valid-output',
    label: 'Ends after first valid output',
    description: 'The session will complete when the agent produces its first valid structured output.',
  },
]

const INPUT_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/

function uid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`
}

/** Seeded inputs so a fresh agent shows the corpus-2 Inputs tile populated. */
export function defaultInputs(): AgentInput[] {
  return [
    { id: 'in-input1', name: 'input1', type: 'string', required: true, options: [] },
    { id: 'in-includePartnerFlights', name: 'includePartnerFlights', type: 'boolean', required: false, options: [] },
  ]
}

export function defaultCompletionPolicy(): CompletionPolicy {
  return {
    mode: 'stays-open',
    maxTurns: DEFAULT_MAX_TURNS,
    requireVerification: true,
    dryRunDefault: true,
  }
}

export function isInputType(v: any): v is InputType {
  return v === 'string' || v === 'number' || v === 'boolean' || v === 'option'
}

export function isCompletionMode(v: any): v is CompletionMode {
  return v === 'stays-open' || v === 'first-valid-output'
}

export function clampMaxTurns(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_MAX_TURNS
  return Math.min(MAX_MAX_TURNS, Math.max(MIN_MAX_TURNS, Math.floor(n)))
}

export function inputTypeLabel(type: InputType): string {
  return INPUT_TYPES.find(t => t.id === type)?.label ?? type
}

export function completionModeLabel(mode: CompletionMode): string {
  return COMPLETION_MODES.find(m => m.id === mode)?.label ?? mode
}

/** First free `inputN` name (n starting at 1) so new inputs match the tile's `input1` convention. */
export function nextInputName(inputs: AgentInput[]): string {
  const taken = new Set(inputs.map(i => i.name))
  let n = 1
  while (taken.has(`input${n}`)) n++
  return `input${n}`
}

export function createInput(inputs: AgentInput[] = [], partial: Partial<AgentInput> = {}): AgentInput {
  return {
    id: partial.id ?? uid(),
    name: partial.name ?? nextInputName(inputs),
    type: partial.type ?? 'string',
    required: partial.required ?? true,
    options: partial.options ?? [],
    ...(partial.defaultValue !== undefined ? { defaultValue: partial.defaultValue } : {}),
  }
}

/* ── immutable list edits ──────────────────────────────────────────── */

export function addInput(inputs: AgentInput[], partial: Partial<AgentInput> = {}): AgentInput[] {
  return [...inputs, createInput(inputs, partial)]
}

export function removeInput(inputs: AgentInput[], id: string): AgentInput[] {
  return inputs.filter(i => i.id !== id)
}

export function updateInput(inputs: AgentInput[], id: string, patch: Partial<AgentInput>): AgentInput[] {
  return inputs.map(i => (i.id === id ? { ...i, ...patch, id: i.id } : i))
}

/* ── load / save (ws.meta via patchMeta) ───────────────────────────── */

function sanitizeInput(raw: any): AgentInput | null {
  if (!raw || typeof raw !== 'object') return null
  if (typeof raw.id !== 'string' || !raw.id) return null
  const type: InputType = isInputType(raw.type) ? raw.type : 'string'
  const options: string[] = Array.isArray(raw.options)
    ? Array.from(new Set<string>((raw.options as unknown[]).filter((x): x is string => typeof x === 'string' && x.trim().length > 0)))
    : []
  const out: AgentInput = {
    id: raw.id,
    name: typeof raw.name === 'string' ? raw.name : '',
    type,
    required: typeof raw.required === 'boolean' ? raw.required : true,
    options,
  }
  if (typeof raw.defaultValue === 'string' || typeof raw.defaultValue === 'number' || typeof raw.defaultValue === 'boolean') {
    out.defaultValue = raw.defaultValue
  }
  return out
}

/** Load + sanitize typed inputs from ws.meta; defaults when the key was never written. */
export function loadAgentInputs(): AgentInput[] {
  const raw = (ws.meta as Record<string, any>)?.[INPUTS_META_KEY]
  if (raw === undefined || raw === null) return defaultInputs()
  if (!Array.isArray(raw)) return defaultInputs()
  const out: AgentInput[] = []
  const seen = new Set<string>()
  for (const r of raw) {
    const c = sanitizeInput(r)
    if (!c || seen.has(c.id)) continue
    seen.add(c.id)
    out.push(c)
  }
  return out
}

export function saveAgentInputs(inputs: AgentInput[]): void {
  patchMeta({ [INPUTS_META_KEY]: inputs })
}

/** Load + sanitize the session completion policy from ws.meta; defaults when unset. */
export function loadCompletionPolicy(): CompletionPolicy {
  const raw = (ws.meta as Record<string, any>)?.[POLICY_META_KEY]
  const d = defaultCompletionPolicy()
  if (!raw || typeof raw !== 'object') return d
  return {
    mode: isCompletionMode(raw.mode) ? raw.mode : d.mode,
    maxTurns: typeof raw.maxTurns === 'number' ? clampMaxTurns(raw.maxTurns) : d.maxTurns,
    requireVerification: typeof raw.requireVerification === 'boolean' ? raw.requireVerification : d.requireVerification,
    dryRunDefault: typeof raw.dryRunDefault === 'boolean' ? raw.dryRunDefault : d.dryRunDefault,
  }
}

export function saveCompletionPolicy(policy: CompletionPolicy): void {
  patchMeta({ [POLICY_META_KEY]: policy })
}

/** Merge a patch into a policy, clamping maxTurns into the allowed window. */
export function updateCompletionPolicy(policy: CompletionPolicy, patch: Partial<CompletionPolicy>): CompletionPolicy {
  const merged = { ...policy, ...patch }
  merged.maxTurns = clampMaxTurns(merged.maxTurns)
  return merged
}

/* ── validation ─────────────────────────────────────────────────────── */

function isEmptyValue(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '')
}

function defaultValueError(input: AgentInput, i: number): string | null {
  const v = input.defaultValue
  if (v === undefined) return null
  if (input.type === 'number' && !Number.isFinite(Number(v))) {
    return `inputs[${i}] ("${input.name}"): default value must be a number`
  }
  if (input.type === 'boolean' && typeof v !== 'boolean') {
    return `inputs[${i}] ("${input.name}"): default value must be a boolean`
  }
  if (input.type === 'option' && input.options.length > 0 && !input.options.includes(String(v))) {
    return `inputs[${i}] ("${input.name}"): default value must be one of its options`
  }
  return null
}

/** Human-readable errors for the inputs list; empty array means valid. */
export function validateInputs(inputs: AgentInput[]): string[] {
  const errors: string[] = []
  const seenNames = new Set<string>()
  inputs.forEach((input, i) => {
    const name = input.name.trim()
    if (!name) {
      errors.push(`inputs[${i}]: name is required`)
    } else {
      if (!INPUT_NAME_RE.test(name)) {
        errors.push(`inputs[${i}]: name "${input.name}" must be a valid identifier (letter/_ first, then letters, digits, _)`)
      }
      if (seenNames.has(name)) {
        errors.push(`inputs[${i}]: duplicate input name "${name}"`)
      }
      seenNames.add(name)
    }
    if (input.type === 'option') {
      const distinct = Array.from(new Set(input.options.map(o => o.trim()).filter(Boolean)))
      if (distinct.length < 2) {
        errors.push(`inputs[${i}] ("${input.name}"): option inputs need at least 2 distinct options`)
      }
    }
    const defErr = defaultValueError(input, i)
    if (defErr) errors.push(defErr)
  })
  return errors
}

/** Human-readable errors for the completion policy; empty array means valid. */
export function validateCompletionPolicy(policy: CompletionPolicy): string[] {
  const errors: string[] = []
  if (!isCompletionMode(policy.mode)) errors.push('policy: mode must be "stays-open" or "first-valid-output"')
  if (!Number.isInteger(policy.maxTurns) || policy.maxTurns < MIN_MAX_TURNS || policy.maxTurns > MAX_MAX_TURNS) {
    errors.push(`policy: maxTurns must be an integer between ${MIN_MAX_TURNS} and ${MAX_MAX_TURNS}`)
  }
  if (typeof policy.requireVerification !== 'boolean') errors.push('policy: requireVerification must be a boolean')
  if (typeof policy.dryRunDefault !== 'boolean') errors.push('policy: dryRunDefault must be a boolean')
  return errors
}

/* ── value coercion + session-start defaults ────────────────────────── */

/** Coerce one raw value to the input's declared type (round-trips through defaults). */
export function coerceInputValue(input: AgentInput, raw: unknown): string | number | boolean {
  switch (input.type) {
    case 'number':
      return Number(raw)
    case 'boolean':
      return raw === true || raw === 'true'
    case 'string':
    case 'option':
      return typeof raw === 'string' ? raw : String(raw ?? '')
  }
}

/** Default values keyed by input name — what a new session starts with. */
export function defaultValues(inputs: AgentInput[]): Record<string, unknown> {
  const values: Record<string, unknown> = {}
  for (const input of inputs) {
    if (input.defaultValue !== undefined) values[input.name] = coerceInputValue(input, input.defaultValue)
  }
  return values
}

/** Validate a value map against the declared inputs (required + per-type checks). */
export function validateInputValues(inputs: AgentInput[], values: Record<string, unknown>): string[] {
  const errors: string[] = []
  for (const input of inputs) {
    const value = values[input.name]
    if (input.required && isEmptyValue(value)) {
      errors.push(`input "${input.name}" is required`)
      continue
    }
    if (isEmptyValue(value)) continue
    if (input.type === 'number' && !Number.isFinite(Number(value))) {
      errors.push(`input "${input.name}" must be a number`)
    } else if (input.type === 'boolean' && typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
      errors.push(`input "${input.name}" must be a boolean`)
    } else if (input.type === 'option' && !input.options.includes(String(value))) {
      errors.push(`input "${input.name}" must be one of: ${input.options.join(', ')}`)
    }
  }
  return errors
}

/* ── summary ────────────────────────────────────────────────────────── */

/** One-line policy summary chip text, e.g. "Stays open · max 8 turns · verification required · dry-run on". */
export function formatPolicySummary(policy: CompletionPolicy): string {
  const parts = [
    completionModeLabel(policy.mode),
    `max ${policy.maxTurns} turns`,
    policy.requireVerification ? 'verification required' : 'verification optional',
    `dry-run ${policy.dryRunDefault ? 'on' : 'off'}`,
  ]
  return parts.join(' · ')
}

/* ── Pre-computed variables + templates (FN-AST-002) ──────────────────
 * A pre-computed variable is derived from a template before a session runs:
 * `template` is a reusable string with `{input}` (or `{name}`) placeholders,
 * `compute` says how the raw input folds into a single value
 * (count of items, sum of numbers, or rendered text), and `output` names
 * the output type/format of the computed value (e.g. "number" / "string").
 * Templates persist in ws.meta under `agentVariables_templates`.
 */

export type PrecomputedComputeType = 'count' | 'sum' | 'text'
export type ComputeType = PrecomputedComputeType

export type PrecomputedCompute = { type: PrecomputedComputeType }
export type VariableTemplateCompute = PrecomputedCompute

export type PrecomputedVariable = {
  /** Stable id for list keys; assigned on create/load when missing. */
  id?: string
  name: string
  template: string
  compute: PrecomputedCompute
  output: string
}

export type VariableTemplate = PrecomputedVariable
export type AgentVariableTemplate = PrecomputedVariable
export type PrecomputedTemplate = PrecomputedVariable

export const PRECOMPUTED_COMPUTE_TYPES: Array<{ id: PrecomputedComputeType; label: string }> = [
  { id: 'count', label: 'Count' },
  { id: 'sum', label: 'Sum' },
  { id: 'text', label: 'Text' },
]

export function isPrecomputedComputeType(v: any): v is PrecomputedComputeType {
  return v === 'count' || v === 'sum' || v === 'text'
}

export function isComputeType(v: any): v is PrecomputedComputeType {
  return isPrecomputedComputeType(v)
}

/** Default output type for a compute kind. */
export function defaultOutputForCompute(type: PrecomputedComputeType): string {
  return type === 'text' ? 'string' : 'number'
}

export function computeTypeLabel(type: PrecomputedComputeType): string {
  return PRECOMPUTED_COMPUTE_TYPES.find(t => t.id === type)?.label ?? type
}

/** Seeded templates so a fresh agent shows the template-cards section populated. */
export function defaultPrecomputedVariables(): PrecomputedVariable[] {
  return [
    { id: 'tpl-countSummary', name: 'countSummary', template: '{input} item(s) found', compute: { type: 'count' }, output: 'number' },
    { id: 'tpl-totalSummary', name: 'totalSummary', template: 'Total: {input}', compute: { type: 'sum' }, output: 'number' },
    { id: 'tpl-greeting', name: 'greeting', template: 'Hello {input} — welcome back', compute: { type: 'text' }, output: 'string' },
  ]
}

export function defaultTemplates(): PrecomputedVariable[] {
  return defaultPrecomputedVariables()
}

export function defaultVariableTemplates(): PrecomputedVariable[] {
  return defaultPrecomputedVariables()
}

/* ── create / immutable list edits ──────────────────────────────────── */

export function createPrecomputedVariable(
  list: PrecomputedVariable[] = [],
  partial: Partial<PrecomputedVariable> & { compute?: Partial<PrecomputedCompute> } = {},
): PrecomputedVariable {
  const type: PrecomputedComputeType = partial.compute && isPrecomputedComputeType(partial.compute.type)
    ? partial.compute.type
    : 'text'
  const taken = new Set(list.map(v => v.name))
  let n = 1
  let name = partial.name?.trim() ?? ''
  if (!name) {
    while (taken.has(`template${n}`)) n++
    name = `template${n}`
  }
  return {
    id: partial.id ?? uid(),
    name,
    template: partial.template ?? '{input}',
    compute: { type },
    output: partial.output?.trim() ? partial.output : defaultOutputForCompute(type),
  }
}

export const createTemplate = createPrecomputedVariable
export const createVariableTemplate = createPrecomputedVariable

export function addPrecomputedVariable(list: PrecomputedVariable[], partial: Partial<PrecomputedVariable> = {}): PrecomputedVariable[] {
  return [...list, createPrecomputedVariable(list, partial)]
}

export const addTemplate = addPrecomputedVariable
export const addVariableTemplate = addPrecomputedVariable

export function removePrecomputedVariable(list: PrecomputedVariable[], id: string): PrecomputedVariable[] {
  return list.filter(v => (v.id ?? v.name) !== id && v.name !== id)
}

export const removeTemplate = removePrecomputedVariable
export const removeVariableTemplate = removePrecomputedVariable

export function updatePrecomputedVariable(list: PrecomputedVariable[], id: string, patch: Partial<PrecomputedVariable>): PrecomputedVariable[] {
  return list.map(v => ((v.id ?? v.name) === id || v.name === id ? { ...v, ...patch, id: v.id ?? id } : v))
}

export const updateTemplate = updatePrecomputedVariable
export const updateVariableTemplate = updatePrecomputedVariable

/* ── load / save (ws.meta via patchMeta) ────────────────────────────── */

function sanitizePrecomputedVariable(raw: any): PrecomputedVariable | null {
  if (!raw || typeof raw !== 'object') return null
  const name = typeof raw.name === 'string' ? raw.name.trim() : ''
  if (!name) return null
  const rawCompute = raw.compute && typeof raw.compute === 'object' ? (raw.compute as any).type : raw.compute
  const type: PrecomputedComputeType = isPrecomputedComputeType(rawCompute) ? rawCompute : 'text'
  const output = typeof raw.output === 'string' && raw.output.trim() ? raw.output : defaultOutputForCompute(type)
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : uid(),
    name,
    template: typeof raw.template === 'string' ? raw.template : '{input}',
    compute: { type },
    output,
  }
}

/** Load + sanitize pre-computed variable templates from ws.meta (`agentVariables_templates`). */
export function loadPrecomputedVariables(): PrecomputedVariable[] {
  const raw = (ws.meta as Record<string, any>)?.[TEMPLATES_META_KEY]
  if (raw === undefined || raw === null) return defaultPrecomputedVariables()
  if (!Array.isArray(raw)) return defaultPrecomputedVariables()
  const out: PrecomputedVariable[] = []
  const seenIds = new Set<string>()
  const seenNames = new Set<string>()
  for (const r of raw) {
    const c = sanitizePrecomputedVariable(r)
    if (!c) continue
    const key = c.id ?? c.name
    if (seenIds.has(key) || seenNames.has(c.name)) continue
    seenIds.add(key)
    seenNames.add(c.name)
    out.push(c)
  }
  return out
}

export const loadTemplates = loadPrecomputedVariables
export const loadVariableTemplates = loadPrecomputedVariables
export const loadAgentVariableTemplates = loadPrecomputedVariables
export const loadAgentVariablesTemplates = loadPrecomputedVariables

export function savePrecomputedVariables(vars: PrecomputedVariable[]): void {
  patchMeta({ [TEMPLATES_META_KEY]: vars })
}

export const saveTemplates = savePrecomputedVariables
export const saveVariableTemplates = savePrecomputedVariables
export const saveAgentVariablesTemplates = savePrecomputedVariables

/* ── validation ─────────────────────────────────────────────────────── */

/** Human-readable errors for the templates list; empty array means valid. */
export function validatePrecomputedVariables(vars: PrecomputedVariable[]): string[] {
  const errors: string[] = []
  const seenNames = new Set<string>()
  vars.forEach((v, i) => {
    const name = (v.name ?? '').trim()
    if (!name) {
      errors.push(`templates[${i}]: name is required`)
    } else {
      if (!INPUT_NAME_RE.test(name)) {
        errors.push(`templates[${i}]: name "${v.name}" must be a valid identifier (letter/_ first, then letters, digits, _)`)
      }
      if (seenNames.has(name)) {
        errors.push(`templates[${i}]: duplicate template name "${name}"`)
      }
      seenNames.add(name)
    }
    if (!v.compute || !isPrecomputedComputeType(v.compute.type)) {
      errors.push(`templates[${i}] ("${v.name}"): compute.type must be "count", "sum", or "text"`)
    }
    if (typeof v.template !== 'string') {
      errors.push(`templates[${i}] ("${v.name}"): template must be a string`)
    }
    if (typeof v.output !== 'string' || !v.output.trim()) {
      errors.push(`templates[${i}] ("${v.name}"): output is required`)
    }
  })
  return errors
}

export const validateTemplates = validatePrecomputedVariables
export const validateVariableTemplates = validatePrecomputedVariables

/* ── template rendering ({input} substitution) ──────────────────────── */

/**
 * Render a template string, substituting `{input}` (and any `{name}`
 * placeholders when `input` is a record). Unknown placeholders are left
 * untouched so a partially-bound template stays visible.
 * Examples: renderTemplate('Hello {input}', 'EWR') === 'Hello EWR'
 */
export function renderTemplate(template: string, input?: unknown): string {
  const tpl = typeof template === 'string' ? template : String(template ?? '')
  return tpl.replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (match, key: string) => {
    if (input && typeof input === 'object' && !Array.isArray(input)) {
      const record = input as Record<string, unknown>
      if (Object.prototype.hasOwnProperty.call(record, key)) {
        return String(record[key] ?? '')
      }
      if (key === 'input') return ''
      return match
    }
    if (key === 'input') {
      if (input === undefined || input === null) return ''
      if (Array.isArray(input)) return input.map(v => String(v ?? '')).join(', ')
      return String(input)
    }
    return match
  })
}

export const renderVariableTemplate = renderTemplate
export const renderPrecomputedTemplate = renderTemplate
export const substituteTemplate = renderTemplate

/* ── evaluation helpers (count / sum / text) ────────────────────────── */

/** Count of items in the input: array length, record keys, comma/space tokens, else 0/1. */
export function countInputValues(input: unknown): number {
  if (input === undefined || input === null) return 0
  if (Array.isArray(input)) return input.length
  if (typeof input === 'string') {
    const t = input.trim()
    if (!t) return 0
    const tokens = t.split(/[\s,]+/).filter(Boolean)
    return tokens.length || 1
  }
  if (typeof input === 'number') return Number.isFinite(input) ? 1 : 0
  if (typeof input === 'object') return Object.keys(input as Record<string, unknown>).length
  return 1
}

/** Sum of numeric values: array items, record values, numbers in text, or a single number. */
export function sumInputValues(input: unknown): number {
  if (input === undefined || input === null) return 0
  if (typeof input === 'number') return Number.isFinite(input) ? input : 0
  if (Array.isArray(input)) {
    return input.reduce<number>((acc, v) => acc + (Number.isFinite(Number(v)) ? Number(v) : 0), 0)
  }
  if (typeof input === 'string') {
    const nums = input.match(/-?\d+(?:\.\d+)?/g)
    if (!nums) return 0
    return nums.reduce<number>((acc, s) => acc + Number(s), 0)
  }
  if (typeof input === 'object') {
    return Object.values(input as Record<string, unknown>).reduce<number>(
      (acc, v) => acc + (Number.isFinite(Number(v)) ? Number(v) : 0),
      0,
    )
  }
  const n = Number(input)
  return Number.isFinite(n) ? n : 0
}

export const computeCount = countInputValues
export const computeSum = sumInputValues

type TemplateOrVariable = PrecomputedVariable | string

function asVariable(t: TemplateOrVariable): PrecomputedVariable {
  if (typeof t === 'string') return { name: 'template', template: t, compute: { type: 'text' }, output: 'string' }
  return t
}

/**
 * Raw computed value for a variable: a number for count/sum, rendered text for text.
 */
export function computePrecomputedVariable(variable: TemplateOrVariable, input?: unknown): string | number {
  const v = asVariable(variable)
  switch (v.compute?.type) {
    case 'count':
      return countInputValues(input)
    case 'sum':
      return sumInputValues(input)
    case 'text':
    default:
      return renderTemplate(v.template ?? '{input}', input)
  }
}

export const computeTemplate = computePrecomputedVariable
export const computeVariable = computePrecomputedVariable

/**
 * Evaluate a pre-computed variable to its final `output` string.
 * For count/sum the computed number is substituted into `{input}` when the
 * template uses that placeholder; otherwise the number itself is the output.
 * For text the template is rendered directly against the input.
 */
export function evaluatePrecomputedVariable(variable: TemplateOrVariable, input?: unknown): string {
  const v = asVariable(variable)
  const computed = computePrecomputedVariable(v, input)
  if (v.compute?.type === 'text' || !v.compute) {
    return typeof computed === 'string' ? computed : String(computed)
  }
  const tpl = v.template ?? ''
  if (tpl && tpl.includes('{input}')) return renderTemplate(tpl, computed)
  if (tpl && /\{[A-Za-z_][A-Za-z0-9_]*\}/.test(tpl)) return renderTemplate(tpl, { input: computed })
  return String(computed)
}

export const evaluateTemplate = evaluatePrecomputedVariable
export const evaluateVariable = evaluatePrecomputedVariable
export const applyPrecomputedVariable = evaluatePrecomputedVariable

/** Apply a template (string or variable) to an input — alias kept for the drawer `apply-template` action. */
export function applyTemplate(variable: TemplateOrVariable, input?: unknown): string {
  if (typeof variable === 'string') return renderTemplate(variable, input)
  return evaluatePrecomputedVariable(variable, input)
}

/** Evaluate every variable against one input, keyed by variable name. */
export function evaluatePrecomputedVariables(vars: PrecomputedVariable[], input?: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  for (const v of vars) out[v.name] = evaluatePrecomputedVariable(v, input)
  return out
}

export const evaluateTemplates = evaluatePrecomputedVariables

/* ── search / filter ────────────────────────────────────────────────── */

/** Case-insensitive search over name, template, output and compute type; empty query returns all. */
export function filterPrecomputedVariables(vars: PrecomputedVariable[], query: string): PrecomputedVariable[] {
  const q = query.trim().toLowerCase()
  if (!q) return [...vars]
  return vars.filter(v =>
    v.name.toLowerCase().includes(q) ||
    (v.template ?? '').toLowerCase().includes(q) ||
    (v.output ?? '').toLowerCase().includes(q) ||
    (v.compute?.type ?? '').toLowerCase().includes(q),
  )
}

export const searchPrecomputedVariables = filterPrecomputedVariables
export const filterTemplates = filterPrecomputedVariables
export const searchTemplates = filterPrecomputedVariables
export const filterVariableTemplates = filterPrecomputedVariables

/* ── Variable operation chains (FN-AST-003) ────────────────────────────
 * A chain is an ordered list of object-set ops over the graph substrate:
 * `Filter` predicates narrow the current set, `SearchAround` walks links
 * (edges) from the current set to discover neighbouring objects. Config
 * persists in ws.meta under `agentVariables_chains` via patchMeta — no new
 * store APIs. Evaluation is pure: it never touches ws/store.
 */

/** Meta key for variable operation chains (FN-AST-003). */
export const CHAINS_META_KEY = 'agentVariables_chains'
export const VARIABLE_CHAINS_META_KEY = CHAINS_META_KEY
export const VARIABLE_OPERATION_CHAINS_META_KEY = CHAINS_META_KEY

/** A graph object — mirrors GraphNode but stays structural so tests can pass
 * small hand-rolled graphs without importing the seed. */
export type ChainObject = {
  id: string
  label?: string
  sub?: string
  kind?: string
  [key: string]: unknown
}

/** A graph link — mirrors GraphEdge. */
export type ChainEdge = {
  id: string
  source: string
  target: string
  label?: string
  weight?: number
}

export type FilterOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'exists'
  | 'notExists'

export const FILTER_OPERATORS: Array<{ id: FilterOperator; label: string }> = [
  { id: 'equals', label: 'Equals' },
  { id: 'notEquals', label: 'Not equals' },
  { id: 'contains', label: 'Contains' },
  { id: 'startsWith', label: 'Starts with' },
  { id: 'endsWith', label: 'Ends with' },
  { id: 'gt', label: 'Greater than' },
  { id: 'gte', label: 'Greater or equal' },
  { id: 'lt', label: 'Less than' },
  { id: 'lte', label: 'Less or equal' },
  { id: 'exists', label: 'Exists' },
  { id: 'notExists', label: 'Not exists' },
]

export type SearchDirection = 'outgoing' | 'incoming' | 'both'

export const SEARCH_DIRECTIONS: Array<{ id: SearchDirection; label: string }> = [
  { id: 'outgoing', label: 'Outgoing' },
  { id: 'incoming', label: 'Incoming' },
  { id: 'both', label: 'Both' },
]

export const GRAPH_NODE_KINDS: Array<{ id: string; label: string }> = [
  { id: 'warehouse', label: 'Warehouse' },
  { id: 'material', label: 'Material' },
  { id: 'recipe', label: 'Recipe' },
  { id: 'product', label: 'Product' },
  { id: 'customer', label: 'Customer' },
]

export const CHAIN_STEP_TYPES: Array<{ id: ChainStepType; label: string }> = [
  { id: 'filter', label: 'Filter' },
  { id: 'searchAround', label: 'Search around' },
]

export type FilterConfig = {
  /** Graph field to predicate on (`id` / `label` / `sub` / `kind`). */
  field: string
  operator: FilterOperator
  /** Comparison value — ignored by `exists` / `notExists`. */
  value?: string | number | boolean
}

export type SearchAroundConfig = {
  /** Which link direction to walk. */
  direction: SearchDirection
  /** Hops to walk (1..3). */
  depth: number
  /** Optional result-kind constraint — empty means any kind. */
  targetKind?: string
}

export type ChainStepType = 'filter' | 'searchAround'

export type ChainStep =
  | { id: string; type: 'filter'; config: FilterConfig }
  | { id: string; type: 'searchAround'; config: SearchAroundConfig }

export type VariableChain = {
  /** Stable id for list keys; assigned on create/load when missing. */
  id?: string
  name: string
  steps: ChainStep[]
}

export type VariableOperationChain = VariableChain
export type OperationChain = VariableChain

export const CHAIN_FILTER_FIELDS: string[] = ['id', 'label', 'sub', 'kind']

/** Allowed SearchAround depth window. */
export const MIN_CHAIN_DEPTH = 1
export const MAX_CHAIN_DEPTH = 3

export function isChainStepType(v: any): v is ChainStepType {
  return v === 'filter' || v === 'searchAround'
}

export function isFilterOperator(v: any): v is FilterOperator {
  return FILTER_OPERATORS.some(o => o.id === v)
}

export function isSearchDirection(v: any): v is SearchDirection {
  return v === 'outgoing' || v === 'incoming' || v === 'both'
}

export function isGraphNodeKind(v: any): boolean {
  return typeof v === 'string' && GRAPH_NODE_KINDS.some(k => k.id === v)
}

export function isFilterField(v: any): boolean {
  return typeof v === 'string' && CHAIN_FILTER_FIELDS.includes(v)
}

export function chainStepTypeLabel(type: ChainStepType): string {
  return CHAIN_STEP_TYPES.find(t => t.id === type)?.label ?? type
}

/* ── chain defaults + create ── */

export function defaultFilterConfig(): FilterConfig {
  return { field: 'kind', operator: 'equals', value: 'material' }
}

export function defaultSearchAroundConfig(): SearchAroundConfig {
  return { direction: 'outgoing', depth: 1, targetKind: 'recipe' }
}

export function createChainStep(
  type: ChainStepType,
  partial?: Partial<FilterConfig> | Partial<SearchAroundConfig>,
): ChainStep {
  if (type === 'searchAround') {
    const cfg = (partial as Partial<SearchAroundConfig> | undefined) ?? {}
    return {
      id: uid(),
      type: 'searchAround',
      config: {
        direction: isSearchDirection(cfg.direction) ? cfg.direction! : 'outgoing',
        depth: typeof cfg.depth === 'number' && Number.isFinite(cfg.depth) ? Math.min(MAX_CHAIN_DEPTH, Math.max(MIN_CHAIN_DEPTH, Math.floor(cfg.depth))) : 1,
        targetKind: typeof cfg.targetKind === 'string' ? cfg.targetKind : 'recipe',
      },
    }
  }
  const cfg = (partial as Partial<FilterConfig> | undefined) ?? {}
  return {
    id: uid(),
    type: 'filter',
    config: {
      field: isFilterField(cfg.field) ? cfg.field! : 'kind',
      operator: isFilterOperator(cfg.operator) ? cfg.operator! : 'equals',
      value: cfg.value !== undefined ? cfg.value : 'material',
    },
  }
}

export function createVariableChain(partial: Partial<VariableChain> = {}): VariableChain {
  const name = typeof partial.name === 'string' && partial.name.trim() ? partial.name.trim() : 'chain1'
  return {
    id: partial.id ?? uid(),
    name,
    steps: Array.isArray(partial.steps) ? [...partial.steps] : [createChainStep('filter'), createChainStep('searchAround')],
  }
}

/** Seeded chain: materials → linked recipes, so a fresh drawer shows a valid, runnable chain. */
export function defaultVariableChain(): VariableChain {
  return {
    id: 'chain-material-recipes',
    name: 'materialRecipes',
    steps: [
      { id: 'chain-step-filter-1', type: 'filter', config: { field: 'kind', operator: 'equals', value: 'material' } },
      { id: 'chain-step-search-1', type: 'searchAround', config: { direction: 'outgoing', depth: 1, targetKind: 'recipe' } },
    ],
  }
}

export function defaultVariableChains(): VariableChain[] {
  return [defaultVariableChain()]
}

export const defaultChains = defaultVariableChains

/* ── immutable list edits (chains + steps) ── */

export function addChainStep(chain: VariableChain, type: ChainStepType, partial?: Partial<FilterConfig> | Partial<SearchAroundConfig>): VariableChain {
  return { ...chain, steps: [...chain.steps, createChainStep(type, partial)] }
}

export function removeChainStep(chain: VariableChain, stepId: string): VariableChain {
  return { ...chain, steps: chain.steps.filter(s => s.id !== stepId) }
}

export function updateChainName(chain: VariableChain, name: string): VariableChain {
  return { ...chain, name }
}

export function updateChainStepFilter(chain: VariableChain, stepId: string, patch: Partial<FilterConfig>): VariableChain {
  return {
    ...chain,
    steps: chain.steps.map(s =>
      s.id === stepId && s.type === 'filter' ? { ...s, config: { ...s.config, ...patch } } : s,
    ),
  }
}

export function updateChainStepSearchAround(chain: VariableChain, stepId: string, patch: Partial<SearchAroundConfig>): VariableChain {
  return {
    ...chain,
    steps: chain.steps.map(s =>
      s.id === stepId && s.type === 'searchAround' ? { ...s, config: { ...s.config, ...patch } } : s,
    ),
  }
}

export function setChainStepType(chain: VariableChain, stepId: string, type: ChainStepType): VariableChain {
  return {
    ...chain,
    steps: chain.steps.map(s => {
      if (s.id !== stepId || s.type === type) return s
      return type === 'filter'
        ? { id: s.id, type: 'filter' as const, config: defaultFilterConfig() }
        : { id: s.id, type: 'searchAround' as const, config: defaultSearchAroundConfig() }
    }),
  }
}

export function moveChainStep(chain: VariableChain, stepId: string, direction: 'up' | 'down'): VariableChain {
  const idx = chain.steps.findIndex(s => s.id === stepId)
  const target = direction === 'up' ? idx - 1 : idx + 1
  if (idx < 0 || target < 0 || target >= chain.steps.length) return chain
  const steps = [...chain.steps]
  const [moved] = steps.splice(idx, 1)
  steps.splice(target, 0, moved)
  return { ...chain, steps }
}

export function reorderChainSteps(chain: VariableChain, fromIndex: number, toIndex: number): VariableChain {
  if (fromIndex < 0 || fromIndex >= chain.steps.length || toIndex < 0 || toIndex >= chain.steps.length) return chain
  const steps = [...chain.steps]
  const [moved] = steps.splice(fromIndex, 1)
  steps.splice(toIndex, 0, moved)
  return { ...chain, steps }
}

/* ── typed output derivation ── */

/** Output type after a step list: Filter preserves the input set; SearchAround
 * narrows to `ObjectSet(kind)` when a targetKind constrains the walk. */
export function deriveChainOutput(steps: ChainStep[]): string {
  let current = 'ObjectSet'
  for (const step of steps ?? []) {
    if (!step) continue
    if (step.type === 'searchAround') {
      const kind = step.config?.targetKind?.trim()
      current = kind ? `ObjectSet(${kind})` : 'ObjectSet'
    }
  }
  return current
}

/** Per-step output types — what each step yields after it runs. */
export function deriveChainStepOutputs(chain: VariableChain): string[] {
  const steps = chain?.steps ?? []
  return steps.map((_, i) => deriveChainOutput(steps.slice(0, i + 1)))
}

/** One-line chip text for the chain header, e.g. "materialRecipes → ObjectSet(recipe) · 2 steps". */
export function chainOutputSummary(chain: VariableChain): string {
  const output = deriveChainOutput(chain?.steps ?? [])
  return `${chain?.name ?? 'chain'} → ${output} · ${(chain?.steps ?? []).length} step(s)`
}

/* ── validation ───────────────────────────────────────────────────────── */

function filterValueError(step: ChainStep, i: number): string | null {
  if (step.type !== 'filter') return null
  const cfg = step.config ?? ({} as FilterConfig)
  const op = cfg.operator
  if (op === 'exists' || op === 'notExists') return null
  const v = cfg.value
  if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) {
    return `steps[${i}]: filter.value is required for operator "${op}"`
  }
  if (['gt', 'gte', 'lt', 'lte'].includes(op) && !Number.isFinite(Number(v))) {
    return `steps[${i}]: filter.value must be a number for operator "${op}"`
  }
  return null
}

/** Human-readable errors for one chain; empty array means valid (no Problems). */
export function validateChain(chain: VariableChain): string[] {
  const errors: string[] = []
  if (!chain || typeof chain !== 'object') return ['chain: chain is required']
  const name = (chain.name ?? '').trim()
  if (!name) {
    errors.push('chain: name is required')
  } else if (!INPUT_NAME_RE.test(name)) {
    errors.push(`chain: name "${name}" must be a valid identifier (letter/_ first, then letters, digits, _)`)
  }
  if (!Array.isArray(chain.steps) || chain.steps.length === 0) {
    errors.push('chain: at least one step is required')
    return errors
  }
  chain.steps.forEach((step, i) => {
    if (!step || !isChainStepType(step.type)) {
      errors.push(`steps[${i}]: type must be "filter" or "searchAround"`)
      return
    }
    if (step.type === 'filter') {
      const cfg = step.config ?? ({} as FilterConfig)
      if (!isFilterField(cfg.field)) {
        errors.push(`steps[${i}]: filter.field must be one of ${CHAIN_FILTER_FIELDS.join(', ')}`)
      }
      if (!isFilterOperator(cfg.operator)) {
        errors.push(`steps[${i}]: filter.operator must be one of ${FILTER_OPERATORS.map(o => o.id).join(', ')}`)
      } else {
        const vErr = filterValueError(step, i)
        if (vErr) errors.push(vErr)
      }
    } else {
      const cfg = step.config ?? ({} as SearchAroundConfig)
      if (!isSearchDirection(cfg.direction)) {
        errors.push(`steps[${i}]: searchAround.direction must be "outgoing", "incoming", or "both"`)
      }
      if (!Number.isInteger(cfg.depth) || cfg.depth < MIN_CHAIN_DEPTH || cfg.depth > MAX_CHAIN_DEPTH) {
        errors.push(`steps[${i}]: searchAround.depth must be an integer between ${MIN_CHAIN_DEPTH} and ${MAX_CHAIN_DEPTH}`)
      }
      const kind = cfg.targetKind
      if (kind !== undefined && kind !== null && String(kind).trim() !== '' && !isGraphNodeKind(kind)) {
        errors.push(`steps[${i}]: searchAround.targetKind must be one of ${GRAPH_NODE_KINDS.map(k => k.id).join(', ')}`)
      }
    }
  })
  return errors
}

/** Errors for a chain list: per-chain validation plus duplicate names. */
export function validateChains(chains: VariableChain[]): string[] {
  const errors: string[] = []
  const seenNames = new Set<string>()
  for (const chain of chains ?? []) {
    for (const e of validateChain(chain)) errors.push(e)
    const name = (chain?.name ?? '').trim()
    if (name) {
      if (seenNames.has(name)) errors.push(`chains: duplicate chain name "${name}"`)
      seenNames.add(name)
    }
  }
  return errors
}

/* ── pure evaluation ──────────────────────────────────────────────────── */

function chainFieldValue(obj: ChainObject, field: string): unknown {
  if (!obj || typeof obj !== 'object') return undefined
  if (field === 'label' && obj.label === undefined && obj.name !== undefined) return obj.name
  return (obj as Record<string, unknown>)[field]
}

function isPresent(value: unknown): boolean {
  return value !== undefined && value !== null && !(typeof value === 'string' && value.trim() === '')
}

function matchesFilter(obj: ChainObject, cfg: FilterConfig): boolean {
  const raw = chainFieldValue(obj, cfg.field)
  const op = cfg.operator
  if (op === 'exists') return isPresent(raw)
  if (op === 'notExists') return !isPresent(raw)
  if (!isPresent(raw)) return false
  const value = cfg.value
  // Numeric comparison when both sides parse — keeps `value: 3` and `value: '3'` consistent.
  const rawNum = Number(raw)
  const valNum = Number(value)
  const bothNumeric = Number.isFinite(rawNum) && Number.isFinite(valNum) && String(raw).trim() !== '' && String(value).trim() !== ''
  if (['gt', 'gte', 'lt', 'lte'].includes(op)) {
    if (!bothNumeric) return false
    if (op === 'gt') return rawNum > valNum
    if (op === 'gte') return rawNum >= valNum
    if (op === 'lt') return rawNum < valNum
    return rawNum <= valNum
  }
  const s = String(raw).toLowerCase()
  const v = String(value ?? '').toLowerCase()
  switch (op) {
    case 'equals':
      return bothNumeric ? rawNum === valNum : s === v
    case 'notEquals':
      return bothNumeric ? rawNum !== valNum : s !== v
    case 'contains':
      return s.includes(v)
    case 'startsWith':
      return s.startsWith(v)
    case 'endsWith':
      return s.endsWith(v)
    default:
      return false
  }
}

function traverseSearchAround(
  current: ChainObject[],
  cfg: SearchAroundConfig,
  nodes: ChainObject[],
  edges: ChainEdge[],
): ChainObject[] {
  const depth = typeof cfg.depth === 'number' && Number.isFinite(cfg.depth)
    ? Math.min(5, Math.max(1, Math.floor(cfg.depth)))
    : 1
  const direction: SearchDirection = isSearchDirection(cfg.direction) ? cfg.direction : 'both'
  const targetKind = typeof cfg.targetKind === 'string' ? cfg.targetKind.trim() : ''
  const nodeById = new Map<string, ChainObject>()
  for (const n of nodes ?? []) {
    if (n?.id) nodeById.set(n.id, n)
  }
  for (const obj of current) {
    if (obj?.id && !nodeById.has(obj.id)) nodeById.set(obj.id, obj)
  }
  const visited = new Set<string>(current.map(o => o.id).filter(Boolean))
  const discovered: string[] = []
  let frontier = Array.from(visited)
  for (let hop = 0; hop < depth && frontier.length > 0; hop++) {
    const next: string[] = []
    const inFrontier = new Set(frontier)
    for (const e of edges ?? []) {
      if (!e?.source || !e?.target) continue
      const hit =
        (direction !== 'incoming' && inFrontier.has(e.source)) ||
        (direction !== 'outgoing' && inFrontier.has(e.target))
      if (!hit) continue
      const candidate = direction === 'outgoing' && inFrontier.has(e.source) ? e.target
        : direction === 'incoming' && inFrontier.has(e.target) ? e.source
        : inFrontier.has(e.source) && !inFrontier.has(e.target) ? e.target : e.source
      if (!candidate || visited.has(candidate)) continue
      visited.add(candidate)
      next.push(candidate)
      discovered.push(candidate)
    }
    frontier = next
  }
  const out: ChainObject[] = []
  for (const id of discovered) {
    const node = nodeById.get(id) ?? { id }
    if (targetKind && node.kind !== targetKind) continue
    out.push(node)
  }
  return out
}

/**
 * Pure chain evaluator: folds Filter predicates + SearchAround traversals left
 * to right. Defaults to the graph substrate (GRAPH_NODES / GRAPH_EDGES) so
 * `evaluateChain(chain, GRAPH_NODES)` runs the drawer Apply path; tests pass
 * small hand-rolled graphs. Never touches ws/store.
 */
export function evaluateChain(
  chain: VariableChain,
  inputObjects: ChainObject[],
  nodes: ChainObject[] = GRAPH_NODES,
  edges: ChainEdge[] = GRAPH_EDGES,
): ChainObject[] {
  let current = Array.isArray(inputObjects) ? [...inputObjects] : []
  for (const step of chain?.steps ?? []) {
    if (!step) continue
    if (step.type === 'filter') {
      current = current.filter(o => matchesFilter(o, step.config ?? defaultFilterConfig()))
    } else if (step.type === 'searchAround') {
      current = traverseSearchAround(current, step.config ?? defaultSearchAroundConfig(), nodes ?? GRAPH_NODES, edges ?? GRAPH_EDGES)
    }
  }
  return current
}

export const runChain = evaluateChain
export const applyChain = evaluateChain

/* ── load / save (ws.meta via patchMeta) ────────────────────────────── */

function sanitizeChainStep(raw: any): ChainStep | null {
  if (!raw || typeof raw !== 'object') return null
  const id = typeof raw.id === 'string' && raw.id ? raw.id : uid()
  if (raw.type === 'searchAround') {
    const c = (raw.config ?? {}) as Partial<SearchAroundConfig>
    const depth = typeof c.depth === 'number' && Number.isFinite(c.depth)
      ? Math.min(MAX_CHAIN_DEPTH, Math.max(MIN_CHAIN_DEPTH, Math.floor(c.depth)))
      : 1
    return {
      id,
      type: 'searchAround',
      config: {
        direction: isSearchDirection(c.direction) ? c.direction : 'outgoing',
        depth,
        targetKind: typeof c.targetKind === 'string' ? c.targetKind : 'recipe',
      },
    }
  }
  // Default to Filter for unknown/absent types so corrupt rows stay editable.
  const c = (raw.config ?? {}) as Partial<FilterConfig>
  return {
    id,
    type: 'filter',
    config: {
      field: isFilterField(c.field) ? c.field! : 'kind',
      operator: isFilterOperator(c.operator) ? c.operator! : 'equals',
      value: c.value !== undefined && c.value !== null ? c.value : 'material',
    },
  }
}

function sanitizeVariableChain(raw: any): VariableChain | null {
  if (!raw || typeof raw !== 'object') return null
  const name = typeof raw.name === 'string' ? raw.name.trim() : ''
  if (!name) return null
  const rawSteps = Array.isArray(raw.steps) ? raw.steps : []
  const steps: ChainStep[] = []
  for (const r of rawSteps) {
    const s = sanitizeChainStep(r)
    if (s) steps.push(s)
  }
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : uid(),
    name,
    steps: steps.length > 0 ? steps : [createChainStep('filter')],
  }
}

/** Load + sanitize variable chains from ws.meta (`agentVariables_chains`); defaults when never written. */
export function loadVariableChains(): VariableChain[] {
  const raw = (ws.meta as Record<string, any>)?.[CHAINS_META_KEY]
  if (raw === undefined || raw === null) return defaultVariableChains()
  if (!Array.isArray(raw)) return defaultVariableChains()
  const out: VariableChain[] = []
  const seenIds = new Set<string>()
  const seenNames = new Set<string>()
  for (const r of raw) {
    const c = sanitizeVariableChain(r)
    if (!c) continue
    const key = c.id ?? c.name
    if (seenIds.has(key) || seenNames.has(c.name)) continue
    seenIds.add(key)
    seenNames.add(c.name)
    out.push(c)
  }
  return out.length > 0 ? out : defaultVariableChains()
}

export const loadChains = loadVariableChains
export const loadVariableOperationChains = loadVariableChains

export function saveVariableChains(chains: VariableChain[]): void {
  patchMeta({ [CHAINS_META_KEY]: chains })
}

export const saveChains = saveVariableChains
export const saveVariableOperationChains = saveVariableChains
