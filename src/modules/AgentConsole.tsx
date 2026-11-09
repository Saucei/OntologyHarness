import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { runAgent, type AgentStep, type ApprovalRequest } from '../agent/orchestrator'
import { MODEL_CATALOG, applyReasoningTier, composerTriggerQuery, detectComposerTrigger, getReasoningTier, loadSettings, nextReasoningTier, providerById, resolveComposerAction, saveSettings, tierPillLabel, type ReasoningTierId } from '../llm/client'
import {
  TOKEN_BUDGET,
  createSession,
  defaultGreeting,
  deriveTitle,
  estimateTokens,
  formatTokens,
  getActiveSession,
  isAllowlisted,
  loadSessionState,
  messageTokens,
  removeSession,
  saveSessionState,
  stepTokens,
  totalSessionTokens,
  type SessionMessage,
  type SessionState,
} from '../agent/sessions'
import { appendAudit, appendTrace, patchMeta, ws } from '../store'
import { MODE_SEGMENTS, PRESET_SEED, RIBBON_TYPES, allPresetModes, docsCount, filterModesBySegment, formatRibbonCount, presetDocBags, presetSkills, ribbonTotalTools, setDocBagEnabled, setSkillEnabled, skillsCount, type DocumentationBag, type ModeSegment, type PresetMode, type RibbonTypeId, type Skill } from '../data/presets'
import { TOOLS } from '../agent/tools'
import {
  ACTIVE_MODE_META_KEY,
  TOOL_CATEGORIES,
  addPermissionRule,
  addsToolsLabel,
  buildActiveMode,
  categoryCounts,
  evaluatePermission,
  loadActiveMode,
  loadToolPermissions,
  modeToolNames,
  removePermissionRule,
  revertPermissionRules,
  saveToolPermissions,
  setToolDecision,
  toggleToolEnabled,
  type ActiveModeState,
  type PermissionDecision,
  type ToolPermissionsState,
} from '../agent/permissions'
import type { IconName } from '../components/Icon'
import { AgentInputsDrawer } from './AgentInputsDrawer'
import { loadAgentInputs } from '../agent/variables'

type PendingApproval = ApprovalRequest & { resolve: (ok: boolean) => void }

const SUGGESTIONS = [
  'What backs the Belgian Ale product, and does its lineage reach Warehouse 1?',
  'Which reference screenshots show Workshop widget configuration?',
  'List every object type and its backing dataset',
  'Dry-run workshop.publish for the Order Overview module and report',
]

function truncate(text: string, max = 64): string {
  const one = text.replace(/\s+/g, ' ').trim()
  return one.length > max ? `${one.slice(0, max)}…` : one
}

// ── FN-FDE-007/008 local mirrors ──────────────────────────────────────
// patchMeta never notifies subscribers; initial state mirrors ws.meta and a
// useEffect persists local changes, exactly the Plugin Manager pattern.
type EnabledMap = Record<string, boolean>

function toEnabledMap(items: Array<{ id: string; enabled: boolean }>): EnabledMap {
  const m: EnabledMap = {}
  for (const it of items) m[it.id] = it.enabled
  return m
}

/** Overlay a ws.meta persisted shape (id→enabled map or full item list) on preset defaults. */
function applyEnabledMap<T extends { id: string; enabled: boolean }>(defaults: T[], persisted: any): T[] {
  const map: EnabledMap = {}
  if (Array.isArray(persisted)) {
    for (const p of persisted) if (p && typeof p.id === 'string') map[p.id] = !!p.enabled
  } else if (persisted && typeof persisted === 'object') {
    for (const [k, v] of Object.entries(persisted as Record<string, any>)) map[k] = !!v
  }
  return defaults.map(d => (d.id in map ? { ...d, enabled: map[d.id] } : d))
}

/** Default model toggles keyed by MODEL_CATALOG id: only the active model starts enabled. */
function defaultModelMap(activeModel: string): EnabledMap {
  const m: EnabledMap = {}
  for (const e of MODEL_CATALOG) m[e.id] = e.model === (activeModel ?? '').trim()
  return m
}

function applyModelMap(persisted: any, activeModel: string): EnabledMap {
  if (persisted && typeof persisted === 'object' && !Array.isArray(persisted)) {
    return { ...defaultModelMap(activeModel), ...(persisted as EnabledMap) }
  }
  return defaultModelMap(activeModel)
}

// ── FN-AST-004 Tools binding ─────────────────────────────────────
// Tool types: Apply action / Call function / Ontology SQL / Custom tool.
// Permission-aware: a binding whose underlying registry tool resolves to
// `deny` via evaluatePermission (disabled or Deny) is disabled in the UI
// and cannot be added. Free-form bindings (empty/unknown toolName, e.g.
// Custom tool + Ontology SQL) are not gated by the registry matrix.
// Persisted in ws.meta[agentToolBindings] via patchMeta — no new store APIs.
export const TOOL_BINDING_META_KEY = 'agentToolBindings'

export type ToolBindingType = 'apply-action' | 'call-function' | 'ontology-sql' | 'custom-tool'

export type ToolBinding = {
  id: string
  name: string
  type: ToolBindingType
  /** Registry tool name (TOOLS) when bound; '' for free-form Custom/SQL. */
  toolName: string
  /** Type-specific config (action name / function path / SQL / endpoint). */
  config: string
  automated: boolean
}

export const TOOL_BINDING_TYPES: Array<{ id: ToolBindingType; label: string; placeholder: string; hint: string }> = [
  { id: 'apply-action', label: 'Apply action', placeholder: 'e.g. workshop.publish', hint: 'Binds an ontology action' },
  { id: 'call-function', label: 'Call function', placeholder: 'e.g. functions.run', hint: 'Binds an AIP function' },
  { id: 'ontology-sql', label: 'Ontology SQL', placeholder: 'e.g. SELECT * FROM ontology.product', hint: 'Binds a read-only SQL query' },
  { id: 'custom-tool', label: 'Custom tool', placeholder: 'e.g. my-custom-tool', hint: 'Binds a custom-defined tool' },
]

export function isToolBindingType(v: any): v is ToolBindingType {
  return v === 'apply-action' || v === 'call-function' || v === 'ontology-sql' || v === 'custom-tool'
}

export function toolBindingTypeLabel(type: ToolBindingType): string {
  return TOOL_BINDING_TYPES.find(t => t.id === type)?.label ?? type
}

function bindingUid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`
}

export function defaultToolBindings(): ToolBinding[] {
  return []
}

export function createToolBinding(partial: Partial<ToolBinding> = {}): ToolBinding {
  return {
    id: partial.id ?? bindingUid(),
    name: partial.name ?? '',
    type: partial.type && isToolBindingType(partial.type) ? partial.type : 'apply-action',
    toolName: partial.toolName ?? '',
    config: partial.config ?? '',
    automated: partial.automated ?? false,
  }
}

export function addToolBinding(bindings: ToolBinding[], partial: Partial<ToolBinding> = {}): ToolBinding[] {
  return [...bindings, createToolBinding(partial)]
}

export function removeToolBinding(bindings: ToolBinding[], id: string): ToolBinding[] {
  return bindings.filter(b => b.id !== id)
}

export function updateToolBinding(bindings: ToolBinding[], id: string, patch: Partial<ToolBinding>): ToolBinding[] {
  return bindings.map(b => (b.id === id ? { ...b, ...patch, id: b.id } : b))
}

function sanitizeBinding(raw: any): ToolBinding | null {
  if (!raw || typeof raw !== 'object') return null
  if (typeof raw.id !== 'string' || !raw.id) return null
  return {
    id: raw.id,
    name: typeof raw.name === 'string' ? raw.name : '',
    type: isToolBindingType(raw.type) ? raw.type : 'apply-action',
    toolName: typeof raw.toolName === 'string' ? raw.toolName : '',
    config: typeof raw.config === 'string' ? raw.config : '',
    automated: raw.automated === true,
  }
}

/** Load + sanitize tools bindings from ws.meta; defaults when the key was never written. */
export function loadToolBindings(): ToolBinding[] {
  const raw = (ws.meta as Record<string, any>)?.[TOOL_BINDING_META_KEY]
  if (raw === undefined || raw === null) return defaultToolBindings()
  if (!Array.isArray(raw)) return defaultToolBindings()
  const out: ToolBinding[] = []
  const seen = new Set<string>()
  for (const r of raw) {
    const c = sanitizeBinding(r)
    if (!c || seen.has(c.id)) continue
    seen.add(c.id)
    out.push(c)
  }
  return out
}

export function saveToolBindings(bindings: ToolBinding[]): void {
  patchMeta({ [TOOL_BINDING_META_KEY]: bindings })
}

/**
 * Permission gate for one registry tool name. Free-form toolNames
 * ('' or not in TOOLS) are not gated — custom/SQL bindings bind free text.
 */
export function isBindingToolPermitted(
  toolName: string,
  permissions: ToolPermissionsState,
  branch = 'master',
): boolean {
  const name = (toolName ?? '').trim()
  if (!name) return true
  if (!TOOLS.some(t => t.name === name)) return true
  return evaluatePermission(name, permissions, { branch }) !== 'deny'
}

export function isBindingEffectivelyEnabled(
  binding: ToolBinding,
  permissions: ToolPermissionsState,
  branch = 'master',
): boolean {
  return isBindingToolPermitted(binding.toolName, permissions, branch)
}

export function bindingDisabledReason(
  binding: Pick<ToolBinding, 'toolName'>,
  permissions: ToolPermissionsState,
  branch = 'master',
): string | null {
  const name = (binding.toolName ?? '').trim()
  if (!name || !TOOLS.some(t => t.name === name)) return null
  const decision = evaluatePermission(name, permissions, { branch })
  return decision === 'deny' ? `${name} resolves to Deny (disabled or not permitted)` : null
}

type SkillTab = 'models' | 'skills' | 'approvals'
const SKILL_TABS: Array<{ id: SkillTab; label: string }> = [
  { id: 'models', label: 'Models' },
  { id: 'skills', label: 'Skills' },
  { id: 'approvals', label: 'Tool approvals' },
]
const DOC_KINDS: Array<{ kind: DocumentationBag['kind']; label: string }> = [
  { kind: 'custom', label: 'Custom docs' },
  { kind: 'foundry', label: 'Foundry documentation' },
]

export default function AgentConsole() {
  const settings = useMemo(() => loadSettings(), [])
  const spec = providerById(settings.providerId)
  // FN-FDE-010 reasoning tier — persisted in settings.reasoningTier.
  const [tierId, setTierId] = useState<ReasoningTierId>(() => (settings.reasoningTier ?? 'balanced') as ReasoningTierId)
  const tier = getReasoningTier(tierId)
  const effectiveSettings = useMemo(
    () => applyReasoningTier({ ...settings }, tierId),
    [settings, tierId],
  )

  const [sessionState, setSessionState] = useState<SessionState>(() =>
    loadSessionState(defaultGreeting(settings.model, spec.label)),
  )
  const [input, setInput] = useState('')
  const [running, setRunning] = useState(false)
  const [pendingSteps, setPendingSteps] = useState<AgentStep[]>([])
  const [approval, setApproval] = useState<PendingApproval | null>(null)
  const [alwaysAllow, setAlwaysAllow] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [ribbonActive, setRibbonActive] = useState<RibbonTypeId>('modes')
  // Tool permission matrix (FN-FDE-006) — persisted in ws.meta[toolPermissions].
  const [permissions, setPermissions] = useState<ToolPermissionsState>(() => loadToolPermissions())
  const [permCategory, setPermCategory] = useState<string>(TOOL_CATEGORIES[0]?.id ?? 'graph')
  const [ruleTool, setRuleTool] = useState<string>(TOOLS[0]?.name ?? 'pipeline.run')
  const [ruleBranch, setRuleBranch] = useState('master')
  const [ruleIf, setRuleIf] = useState<'allow' | 'ask'>('ask')
  const [ruleElse, setRuleElse] = useState<'allow' | 'ask'>('allow')
  // Skill Set Configurations (FN-FDE-007) + Documentation attach (FN-FDE-008).
  // Applied state mirrors ws.meta.agentSkills / agentDocs / agentModels; the
  // modal edits drafts until Apply commits them (Cancel discards).
  const activePreset = PRESET_SEED[0]
  const [skills, setSkills] = useState<Skill[]>(() => applyEnabledMap(presetSkills(activePreset), (ws.meta as any)?.agentSkills))
  const [docs, setDocs] = useState<DocumentationBag[]>(() => applyEnabledMap(presetDocBags(activePreset), (ws.meta as any)?.agentDocs))
  const [models, setModels] = useState<EnabledMap>(() => applyModelMap((ws.meta as any)?.agentModels, settings.model))
  // Local mirrors → ws.meta (patchMeta does not notify; local state drives reactivity).
  useEffect(() => { patchMeta({ agentSkills: toEnabledMap(skills) }) }, [skills])
  useEffect(() => { patchMeta({ agentDocs: toEnabledMap(docs) }) }, [docs])
  useEffect(() => { patchMeta({ agentModels: models }) }, [models])
  const [skillModalOpen, setSkillModalOpen] = useState(false)
  const [skillTab, setSkillTab] = useState<SkillTab>('skills')
  const [draftSkills, setDraftSkills] = useState<Skill[]>([])
  const [draftModels, setDraftModels] = useState<EnabledMap>({})
  const [docsOpen, setDocsOpen] = useState(false)
  const [skillsMsg, setSkillsMsg] = useState<string | null>(null)
  // FN-FDE-005 Modes + FN-FDE-011 Thinking — active mode mirrors ws.meta[activeMode].
  const [modesOpen, setModesOpen] = useState(false)
  const [modeSegment, setModeSegment] = useState<ModeSegment>('all')
  const [activeMode, setActiveMode] = useState<ActiveModeState>(() => loadActiveMode())
  const [thinking, setThinking] = useState<string | null>(() => loadActiveMode().thinking || null)
  // FN-AST-004 Tools binding (Apply action / Call function / Ontology SQL /
  // Custom tool + Automated) — persisted in ws.meta[agentToolBindings].
  // Draft fields hold the pending binding until Add commits it.
  const [bindings, setBindings] = useState<ToolBinding[]>(() => loadToolBindings())
  const [bindingType, setBindingType] = useState<ToolBindingType>('apply-action')
  const [bindingToolName, setBindingToolName] = useState<string>(TOOLS[0]?.name ?? '')
  const [bindingConfig, setBindingConfig] = useState('')
  const [bindingName, setBindingName] = useState('')
  const [bindingAutomated, setBindingAutomated] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)
  const ribbonRef = useRef<HTMLDivElement>(null)
  const skillsTimerRef = useRef<number | null>(null)
  // Agent inputs + session completion drawer (FN-AST-001, FN-AST-009).
  const [inputsDrawerOpen, setInputsDrawerOpen] = useState(false)
  const [inputsCount, setInputsCount] = useState(() => loadAgentInputs().length)
  useEffect(() => () => { if (skillsTimerRef.current) window.clearTimeout(skillsTimerRef.current) }, [])
  useEffect(() => { patchMeta({ [ACTIVE_MODE_META_KEY]: activeMode }) }, [activeMode])
  // Modal + docs/modes popover dismiss on Escape / outside click (drafts discarded).
  useEffect(() => {
    if (!skillModalOpen && !docsOpen && !modesOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (skillModalOpen) setSkillModalOpen(false)
      if (docsOpen) setDocsOpen(false)
      if (modesOpen) setModesOpen(false)
    }
    const onPointer = (e: MouseEvent) => {
      if (skillModalOpen && modalRef.current && !modalRef.current.contains(e.target as Node)) setSkillModalOpen(false)
      if (docsOpen && ribbonRef.current && !ribbonRef.current.contains(e.target as Node)) setDocsOpen(false)
      if (modesOpen && ribbonRef.current && !ribbonRef.current.contains(e.target as Node)) setModesOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onPointer)
    }
  }, [skillModalOpen, docsOpen, modesOpen])
  const idRef = useRef(1)
  const scrollRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const allowlistRef = useRef<string[]>([])
  const copyTimerRef = useRef<number | null>(null)

  const active = getActiveSession(sessionState)
  const messages = active.messages
  const allSteps: AgentStep[] = useMemo(() => {
    const flat: AgentStep[] = []
    for (const m of messages) if (m.steps?.length) flat.push(...(m.steps as AgentStep[]))
    flat.push(...pendingSteps)
    return flat
  }, [messages, pendingSteps])

  const systemTokens = useMemo(() => estimateTokens(settings.systemPrompt), [settings.systemPrompt])
  const totalTokens = useMemo(
    () => totalSessionTokens(active, settings.systemPrompt, pendingSteps as any),
    [active, settings.systemPrompt, pendingSteps],
  )
  const usagePct = Math.min(100, (totalTokens / TOKEN_BUDGET) * 100)
  const ribbonToolTotal = useMemo(() => ribbonTotalTools(PRESET_SEED), [])
  const presetModes = useMemo(() => allPresetModes(PRESET_SEED), [])
  const visibleModes = useMemo(() => filterModesBySegment(presetModes, modeSegment), [presetModes, modeSegment])

  const nextId = useCallback(() => idRef.current++, [])

  const scrollDown = useCallback(
    () =>
      requestAnimationFrame(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      }),
    [],
  )

  // Persist sessions + live allowlist mirror whenever state changes.
  useEffect(() => {
    saveSessionState(sessionState)
  }, [sessionState])

  useEffect(() => {
    allowlistRef.current = active.allowlist
  }, [active.allowlist, active.id])

  // Escape closes the session menu; click-away closes it too.
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    const onPointer = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onPointer)
    }
  }, [menuOpen])

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current)
    }
  }, [])

  const patchActiveSession = useCallback(
    (mutate: (s: typeof active) => typeof active) => {
      setSessionState(prev => ({
        ...prev,
        sessions: prev.sessions.map(s => (s.id === prev.activeId ? mutate(s) : s)),
      }))
    },
    [],
  )

  const switchSession = (id: string) => {
    if (running || id === sessionState.activeId) return
    setMenuOpen(false)
    setError(null)
    setSessionState(prev => ({ ...prev, activeId: id }))
    scrollDown()
  }

  const newSession = () => {
    if (running) return
    setMenuOpen(false)
    setError(null)
    setInput('')
    const s = createSession(defaultGreeting(settings.model, spec.label))
    setSessionState(prev => ({ sessions: [s, ...prev.sessions], activeId: s.id }))
    scrollDown()
  }

  const deleteSession = (id: string) => {
    if (running) return
    if (id === sessionState.activeId) setMenuOpen(false)
    setSessionState(prev => removeSession(prev, id))
  }

  // Composer attachment ribbon (FN-FDE-004) — Skills opens the Skill Set
  // Configurations modal (FN-FDE-007); Documentation opens the bags popover (FN-FDE-008);
  // Modes opens the tool-carrying modes popover (FN-FDE-005).
  const countsFor = useCallback(
    (id: RibbonTypeId) => (id === 'skills' ? skillsCount(skills) : id === 'documentation' ? docsCount(docs) : id === 'modes' ? activeMode.tools.length : 0),
    [skills, docs, activeMode],
  )
  const onRibbonPress = useCallback(
    (id: RibbonTypeId) => {
      if (running) return
      setRibbonActive(id)
      appendTrace({ kind: 'tool-call', tool: `ribbon.${id}`, ok: true, ms: 0, detail: `composer ribbon ${id}` })
      appendAudit({ event: 'ribbon-select', ribbon: id, totalTools: ribbonToolTotal })
      if (id === 'skills') {
        // Draft snapshot — Apply commits, Cancel/Escape/outside discard.
        setDraftSkills(skills)
        setDraftModels(models)
        setSkillTab('skills')
        setSkillModalOpen(true)
      } else if (id === 'documentation') {
        setDocsOpen(o => !o)
        setModesOpen(false)
      } else if (id === 'modes') {
        setModesOpen(o => !o)
        setDocsOpen(false)
      }
    },
    [running, ribbonToolTotal, skills, models],
  )

  // FN-FDE-005/011 mode select — attach mode tools to the session, persist
  // in ws.meta via patchMeta, trace + audit, and surface the reasoning
  // summary as a Thinking card in the transcript.
  const selectMode = useCallback(
    (mode: PresetMode) => {
      if (running) return
      const next = buildActiveMode(mode, input, TOOLS)
      setActiveMode(next)
      setThinking(next.thinking)
      setModesOpen(false)
      patchMeta({ [ACTIVE_MODE_META_KEY]: next })
      appendTrace({ kind: 'tool-call', tool: `mode.select.${mode.id}`, ok: true, ms: 0, detail: `${mode.label} · ${addsToolsLabel(mode, TOOLS)} · ${next.tools.join(', ')}` })
      appendAudit({ event: 'mode-select', mode: mode.id, label: mode.label, tools: next.tools, session: active.id })
      const thinkMsg: SessionMessage = { id: nextId(), role: 'assistant', text: `Thinking · ${next.thinking}` }
      patchActiveSession(s => ({ ...s, messages: [...s.messages, thinkMsg], updatedAt: new Date().toISOString() }))
      scrollDown()
    },
    [running, input, active.id, nextId, patchActiveSession, scrollDown],
  )

  const clearMode = useCallback(() => {
    if (running) return
    const next: ActiveModeState = { modeId: null, label: null, tools: [], thinking: '' }
    setActiveMode(next)
    setThinking(null)
    setModesOpen(false)
    patchMeta({ [ACTIVE_MODE_META_KEY]: next })
    appendTrace({ kind: 'tool-call', tool: 'mode.clear', ok: true, ms: 0, detail: 'active mode cleared' })
    appendAudit({ event: 'mode-clear', session: active.id })
  }, [running, active.id])

  // Apply drafts to the session: persist agentSkills.*/agentModels via patchMeta
  // (the local-mirror effects re-assert the same maps), telemetry + confirmation.
  const applySkills = useCallback(() => {
    setSkills(draftSkills)
    setModels(draftModels)
    patchMeta({ agentSkills: toEnabledMap(draftSkills), agentModels: draftModels })
    appendTrace({ kind: 'skill-apply', ok: true, ms: 0, detail: `skills ${skillsCount(draftSkills)} enabled · models ${Object.values(draftModels).filter(Boolean).length} enabled` } as any)
    appendAudit({ event: 'skill-apply', skills: toEnabledMap(draftSkills), models: draftModels, session: active.id })
    setSkillModalOpen(false)
    setSkillsMsg('Skills applied to current session')
    if (skillsTimerRef.current) window.clearTimeout(skillsTimerRef.current)
    skillsTimerRef.current = window.setTimeout(() => setSkillsMsg(null), 2500)
  }, [draftSkills, draftModels, active.id])

  // Documentation attach/detach — live (counts update immediately, persisted via the mirror effect).
  const onDocToggle = useCallback(
    (id: string) => {
      if (running) return
      const bag = docs.find(b => b.id === id)
      if (!bag) return
      const enabled = !bag.enabled
      setDocs(setDocBagEnabled(docs, id, enabled))
      appendTrace({ kind: 'tool-call', tool: `docs.toggle.${id}`, ok: true, ms: 0, detail: `${bag.label} (${bag.kind}) ${enabled ? 'attached' : 'detached'}` })
      appendAudit({ event: 'docs-toggle', bag: id, kind: bag.kind, enabled })
    },
    [running, docs],
  )

  // FN-FDE-010 tier pill — click cycles Fast → Balanced → Deep (persists + traces).
  const cycleTier = useCallback(() => {
    if (running) return
    const next = nextReasoningTier(tierId)
    setTierId(next)
    saveSettings(applyReasoningTier({ ...settings }, next))
    appendTrace({ kind: 'tool-call', tool: `model.tier.pick`, ok: true, ms: 0, detail: `${next} (${getReasoningTier(next).effort})` })
    appendAudit({ event: 'reasoning-tier', tier: next, effort: getReasoningTier(next).effort })
  }, [running, tierId, settings])

  // Tool permission matrix (FN-FDE-006) — tri-panel triage over ws.meta.
  const permCounts = useMemo(() => categoryCounts(permissions, TOOLS), [permissions])
  const permTools = useMemo(() => TOOLS.filter(t => (t.category ?? '') === permCategory), [permCategory])

  const persistPermissions = useCallback((next: ToolPermissionsState, op: string, detail: string) => {
    setPermissions(next)
    saveToolPermissions(next)
    appendTrace({ kind: 'tool-call', tool: `permissions.${op}`, ok: true, ms: 0, detail })
    appendAudit({ event: 'permission-change', op, detail })
  }, [])

  const onPermToggle = useCallback(
    (tool: string) => {
      const next = toggleToolEnabled(permissions, tool)
      persistPermissions(next, 'toggle', `${tool} ${next.enabled.includes(tool) ? 'enabled' : 'disabled'}`)
    },
    [permissions, persistPermissions],
  )

  const onPermDecision = useCallback(
    (tool: string, decision: PermissionDecision) => {
      const next = setToolDecision(permissions, tool, decision)
      persistPermissions(next, 'decision', `${tool} → ${decision}`)
    },
    [permissions, persistPermissions],
  )

  const onPermCategory = useCallback(
    (id: string) => {
      if (running) return
      setPermCategory(id)
      appendTrace({ kind: 'tool-call', tool: `permissions.category.${id}`, ok: true, ms: 0, detail: `permission category ${id}` })
      appendAudit({ event: 'permission-category', category: id })
    },
    [running],
  )

  const onPermAddRule = useCallback(() => {
    if (running || !ruleTool) return
    const next = addPermissionRule(permissions, { tool: ruleTool, branch: ruleBranch, ifDecision: ruleIf, elseDecision: ruleElse })
    persistPermissions(next, 'rule-add', `${ruleTool} If branch ${ruleBranch.trim() || 'master'} → ${ruleIf} / Else ${ruleElse}`)
  }, [permissions, persistPermissions, ruleTool, ruleBranch, ruleIf, ruleElse, running])

  const onPermRemoveRule = useCallback(
    (id: string) => {
      if (running) return
      const next = removePermissionRule(permissions, id)
      persistPermissions(next, 'rule-remove', `rule ${id}`)
    },
    [permissions, persistPermissions, running],
  )

  const onPermRevert = useCallback(() => {
    if (running) return
    const next = revertPermissionRules(permissions)
    persistPermissions(next, 'revert', 'rules reverted to If master → Ask / Else Allow')
  }, [permissions, persistPermissions, running])

  // FN-AST-004 Tools binding — every persisted mutation patches ws.meta and
  // appends trace + audit. Draft type/tool/config edits trace as draft ops.
  const persistBindings = useCallback((next: ToolBinding[], op: string, detail: string) => {
    setBindings(next)
    saveToolBindings(next)
    appendTrace({ kind: 'tool-call', tool: `tools-binding.${op}`, ok: true, ms: 0, detail })
    appendAudit({ event: 'tools-binding-' + op, detail, count: next.length })
  }, [])

  const onBindingType = useCallback(
    (type: ToolBindingType) => {
      if (running) return
      setBindingType(type)
      appendTrace({ kind: 'tool-call', tool: 'tools-binding.draft-type', ok: true, ms: 0, detail: `tool type ${toolBindingTypeLabel(type)}` })
      appendAudit({ event: 'tools-binding-draft-type', type })
    },
    [running],
  )

  const onBindingTool = useCallback(
    (toolName: string) => {
      if (running) return
      setBindingToolName(toolName)
      appendTrace({ kind: 'tool-call', tool: 'tools-binding.draft-tool', ok: true, ms: 0, detail: `tool ${toolName || '(free-form)'}` })
      appendAudit({ event: 'tools-binding-draft-tool', toolName: toolName || '(free-form)' })
    },
    [running],
  )

  const onBindingAutomatedDraft = useCallback(() => {
    if (running) return
    setBindingAutomated(prev => {
      const next = !prev
      appendTrace({ kind: 'tool-call', tool: 'tools-binding.draft-automated', ok: true, ms: 0, detail: `automated ${next ? 'on' : 'off'}` })
      appendAudit({ event: 'tools-binding-draft-automated', automated: next })
      return next
    })
  }, [running])

  const onBindingAdd = useCallback(() => {
    if (running) return
    const toolName = bindingToolName.trim()
    const config = bindingConfig.trim()
    if (!toolName && !config) return
    if (toolName && !isBindingToolPermitted(toolName, permissions)) return
    const name = bindingName.trim() || toolName || config || toolBindingTypeLabel(bindingType)
    const next = addToolBinding(bindings, { name, type: bindingType, toolName, config, automated: bindingAutomated })
    persistBindings(next, 'add', `${toolBindingTypeLabel(bindingType)} · ${name} · ${toolName || config}${bindingAutomated ? ' · automated' : ''}`)
    setBindingConfig('')
    setBindingName('')
    setBindingAutomated(false)
  }, [bindings, bindingType, bindingToolName, bindingConfig, bindingName, bindingAutomated, permissions, persistBindings, running])

  const onBindingRemove = useCallback(
    (id: string) => {
      if (running) return
      const target = bindings.find(b => b.id === id)
      const next = removeToolBinding(bindings, id)
      persistBindings(next, 'remove', `${target ? `${toolBindingTypeLabel(target.type)} · ${target.name}` : id}`)
    },
    [bindings, persistBindings, running],
  )

  const onBindingAutomatedToggle = useCallback(
    (id: string) => {
      if (running) return
      const target = bindings.find(b => b.id === id)
      if (!target) return
      const automated = !target.automated
      const next = updateToolBinding(bindings, id, { automated })
      persistBindings(next, 'automated', `${target.name} automated ${automated ? 'on' : 'off'}`)
    },
    [bindings, persistBindings, running],
  )

  const send = async (text: string) => {
    if (!text.trim() || running) return
    setRunning(true)
    setError(null)
    setCopied(false)
    // FN-FDE-011: surface the mode's reasoning summary before any tool calls.
    if (activeMode.modeId) {
      const picked = presetModes.find(m => m.id === activeMode.modeId)
      if (picked) setThinking(buildActiveMode(picked, text, TOOLS).thinking)
    }
    const userMsg: SessionMessage = { id: nextId(), role: 'user', text }
    patchActiveSession(s => {
      const nextMessages = [...s.messages, userMsg]
      const needsTitle = s.title === 'New session'
      return {
        ...s,
        messages: nextMessages,
        title: needsTitle ? deriveTitle(nextMessages) : s.title,
        updatedAt: new Date().toISOString(),
      }
    })
    setInput('')
    const pending: AgentStep[] = []
    setPendingSteps([])
    scrollDown()
    try {
      const result = await runAgent(text, {
        settings: effectiveSettings,
        onStep: s => {
          pending.push(s)
          setPendingSteps([...pending])
          scrollDown()
        },
        onApproval: req => {
          // Per-session allowlist — approved tools skip the card entirely.
          if (isAllowlisted(allowlistRef.current, req.tool)) return Promise.resolve(true)
          return new Promise<boolean>(resolve => {
            setAlwaysAllow(false)
            setCopied(false)
            setApproval({ ...req, resolve })
          })
        },
      })
      const assistantMsg: SessionMessage = {
        id: nextId(),
        role: 'assistant',
        text: result.answer,
        steps: result.steps.length ? (result.steps as any) : pending.length ? (pending as any) : undefined,
      }
      patchActiveSession(s => ({ ...s, messages: [...s.messages, assistantMsg], updatedAt: new Date().toISOString() }))
    } catch (e) {
      const msg = String(e instanceof Error ? e.message : e)
      setError(msg)
      const assistantMsg: SessionMessage = {
        id: nextId(),
        role: 'assistant',
        text: `⚠ Agent error: ${msg}`,
        steps: pending.length ? (pending as any) : undefined,
      }
      patchActiveSession(s => ({ ...s, messages: [...s.messages, assistantMsg], updatedAt: new Date().toISOString() }))
    } finally {
      setRunning(false)
      setPendingSteps([])
      scrollDown()
    }
  }

  // Composer keyboard protocol (FN-FDE-010): Enter send · Shift+Enter newline · Ctrl/Cmd+Enter send.
  const onComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const action = resolveComposerAction(e)
    if (action === 'send') {
      e.preventDefault()
      void send(input)
    }
    // 'newline' → leave default so Shift+Enter inserts a line break.
  }

  const approve = (decision: boolean) => {
    if (!approval) return
    if (decision && alwaysAllow) {
      const tool = approval.tool
      allowlistRef.current = Array.from(new Set([...allowlistRef.current, tool]))
      patchActiveSession(s => ({
        ...s,
        allowlist: Array.from(new Set([...s.allowlist, tool])),
        updatedAt: new Date().toISOString(),
      }))
    }
    approval.resolve(decision)
    setApproval(null)
    setAlwaysAllow(false)
  }

  const approvalJson = approval ? JSON.stringify(approval.args, null, 2) : ''
  const activeTrigger = detectComposerTrigger(input)
  const triggerInfo = composerTriggerQuery(input)
  const copyJson = async () => {
    if (!approvalJson) return
    try {
      await navigator.clipboard.writeText(approvalJson)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = approvalJson
      document.body.appendChild(ta)
      ta.select()
      try {
        document.execCommand('copy')
      } catch {
        /* clipboard unavailable — copy is best-effort in sandboxed contexts */
      }
      document.body.removeChild(ta)
    }
    setCopied(true)
    if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current)
    copyTimerRef.current = window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="module fade-in">
      <div className="module-head glass-strong">
        <div>
          <div className="module-title">
            <Icon name="spark" size={18} /> Agent Console — Ontology Harness Agent
          </div>
          <div className="module-sub">observe → plan → act → verify → report · max 8 hops · dryRun default · approvals for live runs</div>
        </div>
        <span className="chip" style={{ marginLeft: 'auto' }}>
          {spec.label} · {settings.model}
        </span>
        <button
          className="btn"
          onClick={cycleTier}
          disabled={running}
          aria-label={`Reasoning tier: ${tierPillLabel(tierId, settings.model)}. Activate to cycle tier.`}
          data-testid="tier-pill"
          title="Click to cycle reasoning tier (Fast → Balanced → Deep)"
          style={{ background: 'var(--glass-bg-strong)', borderColor: 'var(--glass-border-strong)', color: 'var(--text)', padding: '5px 12px', fontSize: 11 }}
        >
          <Icon name="spark" size={12} />
          {tierPillLabel(tierId, settings.model)}
        </button>
      </div>

      {/* Session Manager bar */}
      <div
        className="glass-strong"
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', flexWrap: 'wrap' }}
      >
        <div ref={menuRef} style={{ position: 'relative', display: 'inline-flex' }}>
          <button
            className="btn"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={`Session: ${active.title}`}
            disabled={running}
            onClick={() => setMenuOpen(o => !o)}
            style={{ maxWidth: 320 }}
          >
            <Icon name="list" size={13} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{active.title}</span>
            <span className="chip chip-mono" style={{ padding: '0px 6px' }}>
              {sessionState.sessions.length}
            </span>
            <span aria-hidden>{menuOpen ? '▴' : '▾'}</span>
          </button>
          {menuOpen && (
            <div
              role="menu"
              aria-label="Session manager"
              className="glass-strong"
              style={{
                position: 'absolute',
                zIndex: 40,
                left: 0,
                top: 'calc(100% + 6px)',
                width: 340,
                maxWidth: '90vw',
                maxHeight: 320,
                overflow: 'auto',
                padding: 6,
              }}
            >
              <button
                role="menuitem"
                className="palette-item"
                onClick={newSession}
                style={{ background: 'rgba(34,197,94,.14)', borderColor: 'var(--glass-border-strong)' }}
              >
                <Icon name="plus" size={13} />
                New session
                <small>{running ? 'unavailable while running' : 'starts a blank conversation'}</small>
              </button>
              <div style={{ borderTop: '1px solid rgba(34,197,94,.18)', margin: '6px 0' }} />
              {sessionState.sessions.map(s => {
                const isActive = s.id === active.id
                const firstUser = s.messages.find(m => m.role === 'user')
                return (
                  <div
                    key={s.id}
                    role="menuitemradio"
                    aria-checked={isActive}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 8px',
                      borderRadius: 10,
                      border: '1px solid transparent',
                      background: isActive ? 'rgba(34,197,94,.16)' : 'transparent',
                      borderColor: isActive ? 'var(--glass-border-strong)' : 'transparent',
                      marginBottom: 4,
                    }}
                  >
                    <button
                      className="preset-mini"
                      style={{ flex: 1, minWidth: 0, marginBottom: 0, padding: '4px 6px' }}
                      disabled={running}
                      onClick={() => switchSession(s.id)}
                      title={firstUser ? firstUser.text : 'No messages yet'}
                    >
                      <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</strong>
                      <small>
                        {s.messages.length} message(s) · {s.messages.reduce((n, m) => n + (m.steps?.length ?? 0), 0)} tool call(s) ·{' '}
                        {new Date(s.updatedAt).toLocaleTimeString()}
                        {s.allowlist.length ? ` · allow ${s.allowlist.join(', ')}` : ''}
                      </small>
                    </button>
                    <button
                      className="icon-btn"
                      aria-label={`Delete session ${s.title}`}
                      disabled={running || sessionState.sessions.length <= 1}
                      onClick={() => deleteSession(s.id)}
                      title={sessionState.sessions.length <= 1 ? 'Keep at least one session' : 'Delete session'}
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        <button className="btn btn-ghost" disabled={running} onClick={newSession} aria-label="New session">
          <Icon name="plus" size={13} /> New session
        </button>
        <button
          className="btn btn-ghost"
          disabled={running || sessionState.sessions.length <= 1}
          onClick={() => deleteSession(active.id)}
          aria-label={`Delete session ${active.title}`}
          title={sessionState.sessions.length <= 1 ? 'Keep at least one session' : 'Delete current session'}
        >
          <Icon name="trash" size={13} /> Delete
        </button>
        <button
          className="btn btn-ghost"
          disabled={running}
          onClick={() => {
            appendTrace({ kind: 'tool-call', tool: 'inputs.open', ok: true, ms: 0, detail: 'agent inputs drawer opened' })
            appendAudit({ event: 'inputs-open', session: active.id })
            setInputsDrawerOpen(true)
          }}
          aria-label="Configure agent inputs and session completion"
          data-testid="agent-inputs-open"
          title="Typed inputs + session completion policy"
        >
          <Icon name="layers" size={13} /> Inputs ({inputsCount})
        </button>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span className="module-sub" style={{ marginTop: 0 }}>
            {messages.length} message(s) · {active.allowlist.length ? `Always allow: ${active.allowlist.join(', ')}` : 'No always-allowed tools'}
          </span>
          <span className="chip chip-mono" title="Outline token estimate (computed from actual message lengths)">
            ~{formatTokens(totalTokens)} / {formatTokens(TOKEN_BUDGET)} tokens
          </span>
        </div>
      </div>

      <div className="aip-wrap" style={{ gridTemplateColumns: '1fr 380px' }}>
        {/* Chat */}
        <div className="glass panel" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div ref={scrollRef} style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 10, padding: 2 }}>
            {messages.map(m => (
              <div key={m.id} id={`chat-msg-${m.id}`} className={m.role === 'user' ? 'chat-bubble chat-user' : 'chat-bubble chat-assistant'}>
                {m.text}
              </div>
            ))}
            {/* FN-FDE-011 Thinking card — reasoning summary of the plan before tool calls. */}
            {(thinking || activeMode.modeId) && (
              <div
                data-testid="thinking-card"
                role="status"
                aria-label="Thinking"
                className="glass-strong"
                style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon name="spark" size={13} />
                  <strong>Thinking</strong>
                  <span className="chip chip-mono" style={{ background: 'var(--glass-bg-strong)', borderColor: 'var(--glass-border-strong)', color: 'var(--text)' }}>
                    {activeMode.label ?? 'plan'}
                  </span>
                  {activeMode.tools.length > 0 && (
                    <span className="chip chip-mono" data-testid="thinking-tools" style={{ background: 'var(--glass-bg-strong)', borderColor: 'var(--glass-border-strong)', color: 'var(--text)' }}>
                      {activeMode.tools.length} tool(s) attached
                    </span>
                  )}
                </div>
                <div className="module-sub" style={{ marginTop: 0 }}>{thinking ?? activeMode.thinking}</div>
                {activeMode.tools.length > 0 && (
                  <div className="module-sub" style={{ marginTop: 0 }}>Tools: {activeMode.tools.join(', ')}</div>
                )}
              </div>
            )}
            {running && !pendingSteps.length && (
              <div className="chat-bubble chat-assistant">
                <span className="pulse-dot" /> thinking / calling tools…
              </div>
            )}
            {running && pendingSteps.length > 0 && (
              <div className="chat-bubble chat-assistant">
                <span className="pulse-dot" /> calling tools… {pendingSteps.length} call(s) so far
              </div>
            )}
          </div>

          {/* Tool Approval card */}
          {approval && (
            <div
              className="approval-card"
              role="dialog"
              aria-label={`Tool approval for ${approval.tool}`}
              style={{ background: 'var(--glass-bg-strong)', borderColor: 'var(--glass-border-strong)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="button" size={14} />
                <strong>
                  Tool: {approval.tool}
                </strong>
                <button
                  className="btn btn-ghost"
                  style={{ marginLeft: 'auto', padding: '4px 10px', fontSize: 11 }}
                  onClick={copyJson}
                  aria-label="Copy tool payload JSON"
                >
                  <Icon name={copied ? 'check' : 'doc'} size={13} />
                  {copied ? 'Copied' : 'Copy JSON'}
                </button>
              </div>
              <div className="module-sub">{approval.reason}</div>
              <pre aria-label="Tool payload JSON">{approvalJson}</pre>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                  color: 'var(--text-dim)',
                  margin: '6px 0 8px',
                  cursor: 'pointer',
                }}
              >
                <input type="checkbox" checked={alwaysAllow} onChange={e => setAlwaysAllow(e.target.checked)} />
                Always allow {approval.tool} for this session
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-danger" style={{ flex: 1, justifyContent: 'center' }} onClick={() => approve(false)}>
                  <Icon name="x" size={13} /> Reject
                </button>
                <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => approve(true)}>
                  <Icon name="check" size={13} /> Allow
                </button>
              </div>
              <div className="module-sub" style={{ marginTop: 6 }}>
                Waiting for tool approval… {alwaysAllow ? ' Will allow this tool for the rest of the session.' : 'Tick the box to skip this prompt next time.'}
              </div>
            </div>
          )}
          {error && (
            <div className="module-sub" style={{ color: 'var(--danger)', margin: '4px 2px' }}>
              ⚠ {error}
            </div>
          )}

          {/* Composer attachment ribbon (FN-FDE-004) */}
          <div
            role="toolbar"
            aria-label="Composer attachment ribbon"
            data-testid="ribbon"
            ref={ribbonRef}
            className="glass-faint"
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 8px', marginTop: 8, flexWrap: 'wrap', position: 'relative' }}
          >
            {RIBBON_TYPES.map(t => {
              const isActive = ribbonActive === t.id
              const count = formatRibbonCount(countsFor(t.id), t.total)
              return (
                <button
                  key={t.id}
                  className={isActive ? 'btn' : 'btn btn-ghost'}
                  aria-pressed={isActive}
                  aria-label={`${t.label} attachments ${count}`}
                  disabled={running}
                  onClick={() => onRibbonPress(t.id)}
                  style={
                    isActive
                      ? { background: 'var(--glass-bg-strong)', borderColor: 'var(--glass-border-strong)', color: 'var(--text)' }
                      : { background: 'transparent', borderColor: 'transparent', color: 'var(--text-dim)' }
                  }
                >
                  <Icon name={t.icon as IconName} size={13} />
                  {t.label}
                </button>
              )
            })}
            <button className="btn btn-ghost" aria-label="More attachment types" disabled={running} onClick={() => onRibbonPress('functions')} style={{ background: 'transparent', borderColor: 'transparent', color: 'var(--text-dim)' }}>
              …
            </button>
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
              <button className="icon-btn" aria-label="Attach branch context" disabled={running} onClick={() => onRibbonPress('modes')} title="Branch context">
                <Icon name="graph" size={14} />
              </button>
              <button className="icon-btn" aria-label="Attach link" disabled={running} onClick={() => onRibbonPress('functions')} title="Attach link">
                <Icon name="doc" size={14} />
              </button>
            </span>
            {/* Documentation attach popover (FN-FDE-008) */}
            {docsOpen && (
              <div
                data-testid="docs-popover"
                role="dialog"
                aria-label="Documentation"
                className="glass-strong"
                style={{
                  position: 'absolute',
                  zIndex: 40,
                  left: 0,
                  top: 'calc(100% + 6px)',
                  width: 340,
                  maxWidth: '90vw',
                  maxHeight: 320,
                  overflow: 'auto',
                  padding: 10,
                }}
              >
                {DOC_KINDS.map(g => (
                  <div key={g.kind} style={{ marginBottom: 8 }}>
                    <div className="panel-title" style={{ marginBottom: 4 }}>{g.label}</div>
                    {docs.filter(b => b.kind === g.kind).map(b => (
                      <label
                        key={b.id}
                        className="palette-item"
                        style={{ cursor: running ? 'not-allowed' : 'pointer' }}
                      >
                        <input
                          type="checkbox"
                          checked={b.enabled}
                          disabled={running}
                          onChange={() => onDocToggle(b.id)}
                          aria-label={`${b.label} (${b.kind})`}
                        />
                        {b.label}
                        <small>{b.enabled ? 'attached' : 'detached'}</small>
                      </label>
                    ))}
                  </div>
                ))}
                <div className="module-sub">Attach/detach seeded documentation bags — counts update live.</div>
              </div>
            )}
            {/* Modes popover (FN-FDE-005) — tool-carrying PresetMode list with segmented sub-modes. */}
            {modesOpen && (
              <div
                data-testid="modes-popover"
                role="dialog"
                aria-label="Modes"
                className="glass-strong"
                style={{
                  position: 'absolute',
                  zIndex: 40,
                  left: 0,
                  top: 'calc(100% + 6px)',
                  width: 360,
                  maxWidth: '90vw',
                  maxHeight: 360,
                  overflow: 'auto',
                  padding: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div role="tablist" aria-label="Mode segments" data-testid="mode-segments" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {MODE_SEGMENTS.map(s => {
                    const isActive = modeSegment === s.id
                    return (
                      <button
                        key={s.id}
                        role="tab"
                        aria-selected={isActive}
                        aria-pressed={isActive}
                        data-testid={`mode-segment-${s.id}`}
                        aria-label={`Segment ${s.label}`}
                        disabled={running}
                        onClick={() => setModeSegment(s.id)}
                        className={isActive ? 'btn' : 'btn btn-ghost'}
                        style={
                          isActive
                            ? { background: 'var(--glass-bg-strong)', borderColor: 'var(--glass-border-strong)', color: 'var(--text)', padding: '4px 12px', fontSize: 11 }
                            : { background: 'transparent', borderColor: 'transparent', color: 'var(--text-dim)', padding: '4px 12px', fontSize: 11 }
                        }
                      >
                        {s.label}
                      </button>
                    )
                  })}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {visibleModes.map(m => {
                    const isActive = activeMode.modeId === m.id
                    const adds = addsToolsLabel(m, TOOLS)
                    return (
                      <button
                        key={m.id}
                        className={`palette-item${isActive ? ' active' : ''}`}
                        aria-pressed={isActive}
                        aria-label={`${m.label} mode — ${adds}`}
                        data-testid={`mode-${m.id}`}
                        disabled={running}
                        onClick={() => selectMode(m)}
                        style={
                          isActive
                            ? { background: 'var(--glass-bg-strong)', borderColor: 'var(--glass-border-strong)', color: 'var(--text)' }
                            : { background: 'transparent', borderColor: 'transparent', color: 'var(--text)' }
                        }
                      >
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
                          <span>{m.label}</span>
                          <small style={{ marginLeft: 0 }}>{modeToolNames(m.tools, TOOLS).join(', ') || 'no attached tools'}</small>
                        </span>
                        <span className="chip chip-mono" data-testid={`mode-${m.id}-adds`} style={{ background: 'var(--glass-bg-strong)', borderColor: 'var(--glass-border-strong)', color: 'var(--text)' }}>
                          {adds}
                        </span>
                      </button>
                    )
                  })}
                  {visibleModes.length === 0 && (
                    <div className="module-sub">No modes in this segment.</div>
                  )}
                </div>
                {activeMode.modeId && (
                  <button
                    className="btn btn-ghost"
                    aria-label="Clear active mode"
                    data-testid="mode-clear"
                    disabled={running}
                    onClick={clearMode}
                    style={{ background: 'transparent', borderColor: 'transparent', color: 'var(--text-dim)', fontSize: 11 }}
                  >
                    Clear active mode ({activeMode.label})
                  </button>
                )}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'flex-start' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <textarea
                className="input"
                rows={1}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onComposerKeyDown}
                placeholder="Ask the agent — try: what backs IPA?"
                disabled={running}
                autoFocus
                aria-label="Ask the agent"
                style={{ resize: 'vertical', minHeight: 36, fontFamily: 'var(--font-ui)' }}
                data-testid="composer-input"
              />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="module-sub" style={{ fontSize: 9, marginTop: 0 }}>
                  <kbd className="chip-mono" style={{ opacity: 0.85 }}>Enter</kbd> send · <kbd className="chip-mono" style={{ opacity: 0.85 }}>Shift+Enter</kbd> newline · <kbd className="chip-mono" style={{ opacity: 0.85 }}>Ctrl+Enter</kbd> send · <kbd className="chip-mono" style={{ opacity: 0.85 }}>/</kbd> prompt · <kbd className="chip-mono" style={{ opacity: 0.85 }}>$</kbd> variable
                </span>
                {activeTrigger && (
                  <span className="chip" role="status" data-testid="composer-trigger" style={{ background: 'var(--glass-bg-strong)', borderColor: 'var(--glass-border-strong)', color: 'var(--text)' }}>
                    {activeTrigger === '/' ? `Prompt/docs — ${triggerInfo?.query ?? ''}` : `Variable — ${triggerInfo?.query ?? ''}`}
                  </span>
                )}
              </div>
            </div>
            <button className="btn btn-primary" disabled={running || !input.trim()} onClick={() => send(input)} aria-label="Send message">
              <Icon name="arrow" size={14} />
            </button>
          </div>

          {/* Per-type count chips + lit "7" pill (FN-FDE-004) */}
          <div
            aria-label="Attachment counts"
            data-testid="ribbon-counts"
            style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}
          >
            <span aria-hidden style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--text-dim)' }}>
              <Icon name="filter" size={13} />
            </span>
            {RIBBON_TYPES.map(t => {
              const count = formatRibbonCount(countsFor(t.id), t.total)
              return (
                <span key={t.id} className="chip chip-mono" aria-label={`${t.label}: ${count} attached`} title={`${t.label} ${count}`}>
                  <Icon name={t.icon as IconName} size={11} />
                  {count}
                </span>
              )
            })}
            <span aria-hidden style={{ width: 1, height: 18, background: 'var(--glass-border)' }} />
            <span
              className="chip chip-mono"
              data-testid="ribbon-lit-7"
              aria-label={`${ribbonToolTotal} tools attached`}
              title={`${ribbonToolTotal} tools attached`}
              style={{
                background: 'var(--glass-bg-strong)',
                borderColor: 'var(--glass-border-strong)',
                color: 'var(--text)',
                fontWeight: 700,
                boxShadow: 'var(--glass-shadow)',
              }}
            >
              <Icon name="button" size={11} />
              fx {ribbonToolTotal}
            </span>
          </div>
          {skillsMsg && (
            <div role="status" data-testid="skill-confirm" className="chip" style={{ marginTop: 6, background: 'var(--glass-bg-strong)', borderColor: 'var(--glass-border-strong)', color: 'var(--text)' }}>
              {skillsMsg}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            {SUGGESTIONS.map(s => (
              <button key={s} className="chip" style={{ cursor: 'pointer' }} onClick={() => send(s)} disabled={running}>
                {s.slice(0, 52)}
                {s.length > 52 ? '…' : ''}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation Outline */}
        <div className="glass panel" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <div className="panel-title">
            <span>Outline</span>
            <span className="chip chip-mono">
              {allSteps.length} tool call(s)
            </span>
          </div>
          <div style={{ flex: 1, overflow: 'auto', minHeight: 0, paddingRight: 2 }}>
            {/* System prompt row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px' }} title="Estimated from the live system prompt length">
              <span
                aria-hidden
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  border: '1px solid var(--glass-border-strong)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  color: 'var(--green-800)',
                  background: 'rgba(34,197,94,.12)',
                }}
              >
                i
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>System Prompt</span>
              <span className="chip chip-mono" style={{ marginLeft: 'auto' }}>
                {systemTokens}
              </span>
            </div>

            {messages.map(m => {
              const tokens = messageTokens(m)
              const isUser = m.role === 'user'
              return (
                <div key={m.id}>
                  <button
                    type="button"
                    title={m.text}
                    onClick={() => document.getElementById(`chat-msg-${m.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      textAlign: 'left',
                      padding: '6px 4px',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text)',
                    }}
                  >
                    {isUser ? (
                      <span
                        aria-hidden
                        title="User turn"
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          border: '2px solid var(--green-600)',
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <span
                        aria-hidden
                        title="Assistant turn"
                        style={{
                          width: 10,
                          height: 10,
                          transform: 'rotate(45deg)',
                          background: 'var(--green-600)',
                          flexShrink: 0,
                          margin: '0 1px',
                        }}
                      />
                    )}
                    <span style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {truncate(m.text, 56)}
                    </span>
                    <span className="chip chip-mono">{tokens}</span>
                  </button>

                  {/* Nested tool rows under the assistant turn that produced them */}
                  {(m.steps ?? []).map((s, i) => {
                    const t = stepTokens(s as any)
                    return (
                      <div key={`${m.id}-tool-${i}`} style={{ borderLeft: '2px solid rgba(34,197,94,.3)', marginLeft: 9, paddingLeft: 10 }}>
                        <details className="tool-card" open={false}>
                          <summary>
                            <span className={(s as AgentStep).ok ? 'trace-ok' : 'trace-fail'}>{(s as AgentStep).ok ? '✓' : '✗'}</span>
                            <code>Tool: {(s as AgentStep).tool}</code>
                            <span className="chip chip-mono" style={{ marginLeft: 'auto' }}>
                              {t}
                            </span>
                          </summary>
                          <div className="tool-args">
                            <div className="label">Args</div>
                            <pre>{JSON.stringify((s as AgentStep).args, null, 2)}</pre>
                          </div>
                          <div className="tool-args">
                            <div className="label">Result · {(s as AgentStep).ms}ms</div>
                            <pre>{JSON.stringify((s as AgentStep).result, null, 2)}</pre>
                          </div>
                        </details>
                      </div>
                    )
                  })}
                </div>
              )
            })}

            {/* In-flight steps (live outline while tools run) */}
            {pendingSteps.length > 0 && (
              <div>
                {pendingSteps.map((s, i) => {
                  const t = stepTokens(s as any)
                  return (
                    <div key={`pending-${i}`} style={{ borderLeft: '2px solid rgba(34,197,94,.3)', marginLeft: 9, paddingLeft: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 4px', fontSize: 12 }}>
                        <span className={s.ok ? 'trace-ok' : 'trace-fail'}>{s.ok ? '✓' : '✗'}</span>
                        <code style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Tool: {s.tool}</code>
                        <span className="chip chip-mono" style={{ marginLeft: 'auto' }}>
                          {t}
                        </span>
                      </div>
                      <div className="tool-args" style={{ padding: '0 4px 6px' }}>
                        <pre>{JSON.stringify(s.args, null, 2)}</pre>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {messages.length <= 1 && pendingSteps.length === 0 && (
              <div className="module-sub">Turns and tool calls will appear here with per-row token estimates. Destructive tools pause for your approval.</div>
            )}
          </div>

          {/* Budget meter footer */}
          <div style={{ borderTop: '1px solid rgba(34,197,94,.18)', padding: '10px 4px 4px', marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="meter" style={{ flex: 1 }} aria-label={`Context usage ${formatTokens(totalTokens)} of ${formatTokens(TOKEN_BUDGET)} tokens`}>
                <div className="meter-fill" style={{ width: `${Math.max(2, usagePct)}%` }} />
              </div>
              <span className="module-sub chip-mono" style={{ marginTop: 0, whiteSpace: 'nowrap' }}>
                ~{formatTokens(totalTokens)} / {formatTokens(TOKEN_BUDGET)} tokens
              </span>
            </div>
            <div className="module-sub">Computed from actual message + tool-call lengths at 4 chars/token.</div>
          </div>
        </div>
      </div>

      {/* Tool permission matrix — tri-panel (FN-FDE-006, ref. C42 ai-fde-tools-menu) */}
      <div
        className="glass panel"
        data-testid="permission-matrix"
        aria-label="Tool permission matrix"
        style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="panel-title" style={{ marginBottom: 0 }}>
            <span>Tool Permissions</span>
          </div>
          <span className="chip chip-mono">{permissions.enabled.length}/{TOOLS.length} tools · {permissions.rules.length} rule(s)</span>
          <button
            className="btn btn-ghost"
            onClick={onPermRevert}
            disabled={running}
            aria-label="Revert permission rules"
            style={{ marginLeft: 'auto' }}
          >
            <Icon name="refresh" size={13} /> Revert
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 340px', gap: 10, minHeight: 0 }}>
          {/* Left: categories with n/8 counts */}
          <div
            data-testid="permission-categories"
            aria-label="Tool categories"
            className="glass-faint"
            style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 8, minHeight: 0 }}
          >
            {permCounts.map(c => {
              const isActive = permCategory === c.id
              return (
                <button
                  key={c.id}
                  className={`palette-item${isActive ? ' active' : ''}`}
                  aria-pressed={isActive}
                  aria-label={`${c.label}: ${c.text} enabled`}
                  disabled={running}
                  onClick={() => onPermCategory(c.id)}
                  style={isActive ? { background: 'var(--glass-bg-strong)', borderColor: 'var(--glass-border-strong)', color: 'var(--text)' } : undefined}
                >
                  <Icon name={c.icon as IconName} size={14} />
                  {c.label}
                  <span className="chip chip-mono">{c.text}</span>
                </button>
              )
            })}
          </div>

          {/* Middle: per-tool checkboxes + Allow/Ask/Deny */}
          <div
            data-testid="permission-tools"
            aria-label={`Tools in ${permCategory}`}
            style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}
          >
            {permTools.length === 0 && (
              <div className="module-sub">No tools in this category.</div>
            )}
            {permTools.map(t => {
              const enabled = permissions.enabled.includes(t.name)
              const decision = permissions.decisions[t.name] ?? 'ask'
              return (
                <div key={t.name} className="glass-faint" style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: running ? 'not-allowed' : 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={enabled}
                      disabled={running}
                      onChange={() => onPermToggle(t.name)}
                      aria-label={`Enable ${t.name}`}
                    />
                    <code style={{ fontSize: 12 }}>{t.name}</code>
                    {t.destructive && <span className="chip">destructive</span>}
                    <span className="module-sub" style={{ marginLeft: 'auto', marginTop: 0 }}>{t.schema}</span>
                  </label>
                  <div role="group" aria-label={`Permission for ${t.name}`} style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {(['allow', 'ask', 'deny'] as PermissionDecision[]).map(d => {
                      const isActive = decision === d
                      return (
                        <button
                          key={d}
                          className={isActive ? 'btn' : 'btn btn-ghost'}
                          aria-pressed={isActive}
                          aria-label={`${t.name}: ${d}`}
                          disabled={running || !enabled}
                          onClick={() => onPermDecision(t.name, d)}
                          style={
                            isActive
                              ? { background: 'var(--glass-bg-strong)', borderColor: 'var(--glass-border-strong)', color: 'var(--text)', padding: '2px 10px', fontSize: 11 }
                              : { background: 'transparent', borderColor: 'transparent', color: 'var(--text-dim)', padding: '2px 10px', fontSize: 11 }
                          }
                        >
                          {d === 'allow' ? 'Allow' : d === 'ask' ? 'Ask' : 'Deny'}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Right: If/Else rule builder */}
          <div
            data-testid="permission-rules"
            aria-label="Permission rules"
            className="glass-faint"
            style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10, minHeight: 0 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>Rules</span>
              <span className="chip chip-mono">{permissions.rules.length}</span>
            </div>

            {permissions.rules.length === 0 && (
              <div className="module-sub">No rules — tools use their static Allow/Ask/Deny.</div>
            )}
            {permissions.rules.map(r => (
              <div key={r.id} className="glass-faint" style={{ padding: '6px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <code style={{ fontSize: 11 }}>{r.tool}</code>
                  <div className="module-sub" style={{ marginTop: 2 }}>
                    If on branch <strong>{r.condition.value}</strong> → {r.ifDecision === 'allow' ? 'Allow' : r.ifDecision === 'ask' ? 'Ask' : 'Deny'} · Else {r.elseDecision === 'allow' ? 'Allow' : r.elseDecision === 'ask' ? 'Ask' : 'Deny'}
                  </div>
                </div>
                <button
                  className="icon-btn"
                  aria-label={`Remove rule for ${r.tool}`}
                  disabled={running}
                  onClick={() => onPermRemoveRule(r.id)}
                  title="Remove rule"
                >
                  <Icon name="trash" size={13} />
                </button>
              </div>
            ))}

            <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="module-sub" style={{ marginTop: 0 }}>Tool</label>
              <select
                className="input"
                value={ruleTool}
                disabled={running}
                onChange={e => setRuleTool(e.target.value)}
                aria-label="Rule tool"
              >
                {TOOLS.map(t => (
                  <option key={t.name} value={t.name}>{t.name}</option>
                ))}
              </select>
              <label className="module-sub" style={{ marginTop: 0 }}>If on branch</label>
              <input
                className="input"
                value={ruleBranch}
                disabled={running}
                onChange={e => setRuleBranch(e.target.value)}
                placeholder="master"
                aria-label="Rule branch"
              />
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="module-sub" style={{ marginTop: 0, marginRight: 'auto' }}>If →</span>
                {(['allow', 'ask'] as const).map(d => (
                  <button
                    key={`if-${d}`}
                    className={ruleIf === d ? 'btn' : 'btn btn-ghost'}
                    aria-pressed={ruleIf === d}
                    disabled={running}
                    onClick={() => setRuleIf(d)}
                    style={ruleIf === d ? { background: 'var(--glass-bg-strong)', borderColor: 'var(--glass-border-strong)', color: 'var(--text)', padding: '2px 10px', fontSize: 11 } : { background: 'transparent', borderColor: 'transparent', color: 'var(--text-dim)', padding: '2px 10px', fontSize: 11 }}
                  >
                    {d === 'allow' ? 'Allow' : 'Ask'}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="module-sub" style={{ marginTop: 0, marginRight: 'auto' }}>Else →</span>
                {(['allow', 'ask'] as const).map(d => (
                  <button
                    key={`else-${d}`}
                    className={ruleElse === d ? 'btn' : 'btn btn-ghost'}
                    aria-pressed={ruleElse === d}
                    disabled={running}
                    onClick={() => setRuleElse(d)}
                    style={ruleElse === d ? { background: 'var(--glass-bg-strong)', borderColor: 'var(--glass-border-strong)', color: 'var(--text)', padding: '2px 10px', fontSize: 11 } : { background: 'transparent', borderColor: 'transparent', color: 'var(--text-dim)', padding: '2px 10px', fontSize: 11 }}
                  >
                    {d === 'allow' ? 'Allow' : 'Ask'}
                  </button>
                ))}
              </div>
              <button className="btn btn-primary" onClick={onPermAddRule} disabled={running || !ruleTool} aria-label="Add rule" style={{ justifyContent: 'center' }}>
                <Icon name="plus" size={13} /> + Add
              </button>
            </div>
          </div>
        </div>

        <div className="module-sub">Left: categories · Middle: per-tool enable + Allow/Ask/Deny · Right: If branch is master → Ask / Else Allow · Revert resets rules.</div>
      </div>

      {/* FN-AST-004 Tools binding — Apply action / Call function / Ontology SQL / Custom tool + Automated. */}
      <div
        className="glass panel"
        data-testid="tool-bindings"
        aria-label="Tools binding"
        style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="panel-title" style={{ marginBottom: 0 }}>
            <span>Tools binding</span>
          </div>
          <span className="chip chip-mono">{bindings.length} bound</span>
          <span className="module-sub" style={{ marginTop: 0 }}>Apply action · Call function · Ontology SQL · Custom tool</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, alignItems: 'end' }}>
          <div>
            <label className="module-sub" style={{ marginTop: 0, display: 'block' }}>Tool type</label>
            <select
              className="input"
              value={bindingType}
              disabled={running}
              onChange={e => onBindingType(e.target.value as ToolBindingType)}
              aria-label="Tool type"
              data-testid="tool-binding-type"
            >
              {TOOL_BINDING_TYPES.map(t => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="module-sub" style={{ marginTop: 0, display: 'block' }}>Registry tool (permission-aware)</label>
            <select
              className="input"
              value={bindingToolName}
              disabled={running}
              onChange={e => onBindingTool(e.target.value)}
              aria-label="Registry tool"
              data-testid="tool-binding-tool"
            >
              <option value="">(free-form config)</option>
              {TOOLS.map(t => {
                const permitted = isBindingToolPermitted(t.name, permissions)
                return (
                  <option key={t.name} value={t.name} disabled={!permitted}>
                    {t.name}{permitted ? '' : ' · Deny'}
                  </option>
                )
              })}
            </select>
          </div>
          <div>
            <label className="module-sub" style={{ marginTop: 0, display: 'block' }}>Config</label>
            <input
              className="input"
              value={bindingConfig}
              disabled={running}
              onChange={e => setBindingConfig(e.target.value)}
              placeholder={TOOL_BINDING_TYPES.find(t => t.id === bindingType)?.placeholder ?? ''}
              aria-label="Tool config"
              data-testid="tool-binding-config"
            />
          </div>
          <div>
            <label className="module-sub" style={{ marginTop: 0, display: 'block' }}>Name (optional)</label>
            <input
              className="input"
              value={bindingName}
              disabled={running}
              onChange={e => setBindingName(e.target.value)}
              placeholder="Binding name"
              aria-label="Binding name"
              data-testid="tool-binding-name"
            />
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              className={bindingAutomated ? 'btn' : 'btn btn-ghost'}
              aria-pressed={bindingAutomated}
              aria-label="Automated"
              data-testid="tool-binding-automated"
              disabled={running}
              onClick={onBindingAutomatedDraft}
              style={
                bindingAutomated
                  ? { background: 'var(--glass-bg-strong)', borderColor: 'var(--glass-border-strong)', color: 'var(--text)' }
                  : { background: 'transparent', borderColor: 'transparent', color: 'var(--text-dim)' }
              }
            >
              Automated
            </button>
            <button
              className="btn btn-primary"
              onClick={onBindingAdd}
              disabled={running || (!bindingToolName.trim() && !bindingConfig.trim()) || (bindingToolName.trim() !== '' && !isBindingToolPermitted(bindingToolName, permissions))}
              aria-label="Add binding"
              data-testid="tool-binding-add"
              style={{ justifyContent: 'center' }}
            >
              <Icon name="plus" size={13} /> Add
            </button>
          </div>
        </div>

        <div className="module-sub" style={{ marginTop: 0 }}>
          {TOOL_BINDING_TYPES.find(t => t.id === bindingType)?.hint}
          {bindingToolName.trim() !== '' && !isBindingToolPermitted(bindingToolName, permissions)
            ? ' · Registry tool resolves to Deny — enable it in the permission matrix first.'
            : ''}
        </div>

        {bindings.length === 0 ? (
          <div className="module-sub">No tools bound — pick a tool type and Add.</div>
        ) : (
          bindings.map(b => {
            const disabledReason = bindingDisabledReason(b, permissions)
            const effectivelyEnabled = isBindingEffectivelyEnabled(b, permissions)
            return (
              <div
                key={b.id}
                className="glass-faint"
                data-testid={`tool-binding-row-${b.id}`}
                aria-label={`Binding ${b.name}: ${toolBindingTypeLabel(b.type)}${disabledReason ? `, disabled: ${disabledReason}` : ''}`}
                style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', opacity: effectivelyEnabled ? 1 : 0.6 }}
              >
                <span className="chip chip-mono" style={{ background: 'var(--glass-bg-strong)', borderColor: 'var(--glass-border-strong)', color: 'var(--text)' }}>
                  {toolBindingTypeLabel(b.type)}
                </span>
                <span style={{ minWidth: 0 }}>
                  <strong>{b.name}</strong>
                  <span className="module-sub" style={{ display: 'block', marginTop: 0 }}>
                    {b.toolName || '(free-form)'} · {b.config || 'no config'}
                  </span>
                </span>
                {disabledReason ? (
                  <span className="chip" role="status" data-testid={`tool-binding-disabled-${b.id}`} style={{ background: 'var(--glass-bg-strong)', borderColor: 'var(--glass-border-strong)', color: 'var(--text)' }}>
                    Disabled — {disabledReason}
                  </span>
                ) : null}
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                  <button
                    className={b.automated ? 'btn' : 'btn btn-ghost'}
                    aria-pressed={b.automated}
                    aria-label={`Automated for ${b.name}`}
                    data-testid={`tool-binding-automated-${b.id}`}
                    disabled={running || !effectivelyEnabled}
                    onClick={() => onBindingAutomatedToggle(b.id)}
                    style={
                      b.automated
                        ? { background: 'var(--glass-bg-strong)', borderColor: 'var(--glass-border-strong)', color: 'var(--text)', padding: '2px 10px', fontSize: 11 }
                        : { background: 'transparent', borderColor: 'transparent', color: 'var(--text-dim)', padding: '2px 10px', fontSize: 11 }
                    }
                  >
                    Automated
                  </button>
                  <button
                    className="icon-btn"
                    aria-label={`Remove binding ${b.name}`}
                    data-testid={`tool-binding-delete-${b.id}`}
                    disabled={running}
                    onClick={() => onBindingRemove(b.id)}
                    title="Remove binding"
                  >
                    <Icon name="trash" size={13} />
                  </button>
                </span>
              </div>
            )
          })
        )}
      </div>

      {/* Skill Set Configurations modal (FN-FDE-007) — centred dialog, draft toggles until Apply. */}
      {skillModalOpen && (
        <div
          className="palette-overlay"
          data-testid="skill-modal-backdrop"
          onMouseDown={e => { if (e.target === e.currentTarget) setSkillModalOpen(false) }}
          style={{ paddingTop: 0, alignItems: 'center' }}
        >
          <div
            ref={modalRef}
            data-testid="skill-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Skill Set Configurations"
            className="glass-strong"
            style={{ width: 'min(640px, 92vw)', maxHeight: '80vh', display: 'flex', flexDirection: 'column', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 12px 8px' }}>
              <strong>Skill Set Configurations</strong>
              <button className="icon-btn" style={{ marginLeft: 'auto' }} onClick={() => setSkillModalOpen(false)} aria-label="Close Skill Set Configurations">
                <Icon name="x" size={14} />
              </button>
            </div>
            <div role="tablist" aria-label="Skill Set Configurations" style={{ display: 'flex', gap: 4, padding: '8px 12px', borderTop: '1px solid var(--glass-border)', borderBottom: '1px solid var(--glass-border)' }}>
              {SKILL_TABS.map(t => {
                const isActive = skillTab === t.id
                return (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={isActive}
                    className={isActive ? 'btn' : 'btn btn-ghost'}
                    onClick={() => setSkillTab(t.id)}
                    style={
                      isActive
                        ? { background: 'var(--glass-bg-strong)', borderColor: 'var(--glass-border-strong)', color: 'var(--text)', padding: '4px 12px', fontSize: 11 }
                        : { background: 'transparent', borderColor: 'transparent', color: 'var(--text-dim)', padding: '4px 12px', fontSize: 11 }
                    }
                  >
                    {t.label}
                  </button>
                )
              })}
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: 12, minHeight: 0 }}>
              {skillTab === 'models' && (
                <div>
                  {MODEL_CATALOG.map(e => (
                    <label
                      key={e.id}
                      className="palette-item"
                      style={{ cursor: 'pointer' }}
                    >
                      <input
                        type="checkbox"
                        checked={!!draftModels[e.id]}
                        onChange={ev => setDraftModels(prev => ({ ...prev, [e.id]: ev.target.checked }))}
                        aria-label={`Enable ${e.label}`}
                      />
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                        <span>{e.label}{e.model === settings.model ? ' · current' : ''}</span>
                        <small style={{ marginLeft: 0 }}>{e.model} · {e.cost} · {e.speed}</small>
                      </span>
                      <small>{draftModels[e.id] ? 'enabled' : 'disabled'}</small>
                    </label>
                  ))}
                </div>
              )}
              {skillTab === 'skills' && (
                <div>
                  {draftSkills.map(s => (
                    <label
                      key={s.id}
                      className="palette-item"
                      style={{ cursor: 'pointer' }}
                    >
                      <input
                        type="checkbox"
                        checked={s.enabled}
                        onChange={ev => setDraftSkills(prev => setSkillEnabled(prev, s.id, ev.target.checked))}
                        aria-label={`Enable ${s.label}`}
                      />
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                        <span>{s.label}</span>
                        <small style={{ marginLeft: 0 }}>{s.description}</small>
                      </span>
                      <small>{s.enabled ? 'enabled' : 'disabled'}</small>
                    </label>
                  ))}
                  {draftSkills.length === 0 && (
                    <div className="module-sub">No skills for this preset.</div>
                  )}
                </div>
              )}
              {skillTab === 'approvals' && (
                <div>
                  <div className="module-sub" style={{ marginTop: 0, marginBottom: 6 }}>Read-only mirror of the tool permission decisions — edit in the matrix above.</div>
                  {TOOLS.map(t => {
                    const enabled = permissions.enabled.includes(t.name)
                    const decision = permissions.decisions[t.name] ?? 'ask'
                    return (
                      <div key={t.name} className="palette-item" aria-label={`${t.name}: ${enabled ? 'enabled' : 'disabled'}, ${decision}`} style={{ cursor: 'default' }}>
                        <input type="checkbox" checked={enabled} disabled aria-label={`${t.name} enabled (read-only)`} />
                        <code style={{ fontSize: 12 }}>{t.name}</code>
                        <small>{decision === 'allow' ? 'Allow' : decision === 'ask' ? 'Ask' : 'Deny'}</small>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '10px 12px', borderTop: '1px solid var(--glass-border)' }}>
              <button className="btn btn-ghost" onClick={() => setSkillModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={applySkills} aria-label="Apply to current session">Apply to current session</button>
            </div>
          </div>
        </div>
      )}

      {/* Agent inputs + session completion drawer (FN-AST-001, FN-AST-009) */}
      <AgentInputsDrawer
        open={inputsDrawerOpen}
        onClose={() => {
          setInputsDrawerOpen(false)
          setInputsCount(loadAgentInputs().length)
        }}
      />
    </div>
  )
}
