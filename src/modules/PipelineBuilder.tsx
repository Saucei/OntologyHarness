import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Icon } from '../components/Icon'
import { appendAudit, appendTrace, patchMeta, ws } from '../store'
import { PROVIDERS, llmChat, loadSettings, providerById } from '../llm/client'

export type DeployStatus = 'live' | 'building' | 'failed' | 'queued'
export type DatasetState = 'raw' | 'clean' | 'derived' | 'ontology' | 'llm'

type PCard = { id: number; kind: DatasetState; name: string; cols: string; detail: string; status: DeployStatus }

const INITIAL: PCard[] = [
  { id: 1, kind: 'raw', name: 'Raw Dataset 1', cols: '14 cols', detail: 'source_a · table_1 · JDBC', status: 'live' },
  { id: 2, kind: 'raw', name: 'Raw Dataset 2', cols: '14 cols', detail: 'source_a · table_2 · JDBC', status: 'queued' },
  { id: 3, kind: 'clean', name: 'Clean Dataset 1', cols: '14 cols', detail: 'datasource-a · 0 issues', status: 'live' },
  { id: 4, kind: 'clean', name: 'Clean Dataset 2', cols: '11 cols', detail: 'transform-a+b · 0 issues', status: 'building' },
  { id: 5, kind: 'clean', name: 'Clean Dataset 2 (B)', cols: '11 cols', detail: 'datasource-b · SFTP', status: 'queued' },
  { id: 6, kind: 'derived', name: 'Derived Dataset', cols: '9 cols', detail: 'join Bureau ⟗ Union Node', status: 'failed' },
  { id: 7, kind: 'ontology', name: 'Ontology Dataset: Product', cols: '24 objects', detail: '→ Product object type', status: 'live' },
]

const PALETTE = [
  { label: 'Source', hint: 'JDBC / SFTP sync' },
  { label: 'Clean', hint: 'type, dedupe, validate' },
  { label: 'Join', hint: 'left / right datasets' },
  { label: 'Union', hint: 'combine schemas' },
  { label: 'Derive', hint: 'computed columns' },
  { label: 'Use LLM', hint: 'template exec via L0 client' },
  { label: 'Publish', hint: 'back ontology object' },
]

const PREVIEW_ROWS = [
  '| productId | name          | platform | price |',
  '| P-0001    | Sedan S1      | S1       | 24900 |',
  '| P-0002    | Crossover X2  | X2       | 31500 |',
  '| P-0003    | Sedan S1 EV   | S1-EV    | 33900 |',
  '| P-0004    | Pickup P1     | P1       | 38200 |',
]

/** Columns in the preview table that the Use-LLM node can score. Exported for tests. */
export const USE_LLM_COLUMNS = ['productId', 'name', 'platform', 'price'] as const

export type UseLlmConfig = {
  context: string
  negValue: number
  posValue: number
  column: string
  providerId: string
  model: string
  promptTemplate: string
  showConfig: boolean
}

/** Clamp a sentiment threshold to the valid [-1, 1] range (2-decimal rounding). */
export function clampSentiment(value: number): number {
  if (!Number.isFinite(value)) return 0
  const clamped = Math.max(-1, Math.min(1, value))
  return Math.round(clamped * 100) / 100
}

/** Step a sentiment threshold by `delta` (typically ±0.1) with clamping. */
export function stepperStep(value: number, delta: number): number {
  return clampSentiment(clampSentiment(value) + clampSentiment(delta))
}

/** Create a default Use-LLM config. Model/provider come from the L0 registry — never hard-coded. */
export function createUseLlmConfig(overrides: Partial<UseLlmConfig> = {}): UseLlmConfig {
  const fallbackProvider = PROVIDERS[0]
  return {
    context: '',
    negValue: -0.3,
    posValue: 0.3,
    column: USE_LLM_COLUMNS[1],
    providerId: fallbackProvider.id,
    model: fallbackProvider.defaultModel,
    promptTemplate: '',
    showConfig: false,
    ...overrides,
  }
}

/** Validate a Use-LLM config. Returns error strings (empty when valid). */
export function validateUseLlmConfig(config: UseLlmConfig): string[] {
  const errors: string[] = []
  if (!config.context.trim()) errors.push('Business Context is required')
  if (!USE_LLM_COLUMNS.includes(config.column as (typeof USE_LLM_COLUMNS)[number])) errors.push('Input column is not a known preview column')
  if (config.negValue < -1 || config.negValue > 1) errors.push('Negative value must be between -1 and 1')
  if (config.posValue < -1 || config.posValue > 1) errors.push('Positive value must be between -1 and 1')
  if (config.posValue <= config.negValue) errors.push('Positive value must be greater than Negative value')
  if (!PROVIDERS.some(p => p.id === config.providerId)) errors.push('Model provider is unknown')
  if (!config.model.trim()) errors.push('Model is required')
  return errors
}

/** Compose the prompt (system + user) for the Use-LLM template. */
export function buildUseLlmPrompt(config: UseLlmConfig): { system: string; user: string; template: string } {
  const system =
    `You are a sentiment scorer for a data pipeline. Business context: ${config.context.trim() || '(not set)'} ` +
    `Score the "${config.column}" column: negative below ${config.negValue.toFixed(2)}, ` +
    `positive above ${config.posValue.toFixed(2)}, neutral in between. ` +
    'Return JSON lines: {"label":"negative"|"neutral"|"positive","score":number}.'
  const user =
    `Score column "${config.column}" for each row of the preview table. ` +
    `Thresholds: negative < ${config.negValue.toFixed(2)}, positive > ${config.posValue.toFixed(2)}. ` +
    'Return one JSON object per row, in order.'
  const template = `${system}\n\n${user}`
  return { system, user, template }
}

/** Serializable summary for the "Show configurations" preview. */
export function summarizeUseLlmConfig(config: UseLlmConfig): string {
  return JSON.stringify(
    {
      context: config.context,
      negValue: config.negValue,
      posValue: config.posValue,
      column: config.column,
      providerId: config.providerId,
      model: config.model,
      promptTemplate: config.promptTemplate,
    },
    null,
    2,
  )
}

/* ── FN-PLM-001 Build settings ─────────────────────────────────────── */

export type BuildMode = 'batch' | 'streaming'
export type ComputeProfileId = 'standard' | 'high-throughput' | 'external-databricks' | 'serverless'
export type ScheduleCadence = 'manual' | 'hourly' | 'daily' | 'weekly'

export type BuildSettings = {
  mode: BuildMode
  computeProfile: ComputeProfileId
  scheduleCadence: ScheduleCadence
  outputNaming: string
}

export const COMPUTE_PROFILES: Array<{ id: ComputeProfileId; label: string; hint: string }> = [
  { id: 'standard', label: 'Standard', hint: 'small / dev' },
  { id: 'high-throughput', label: 'High Throughput', hint: 'large batch' },
  { id: 'external-databricks', label: 'External-Databricks', hint: 'reuse external workspace' },
  { id: 'serverless', label: 'Serverless', hint: 'burst compute' },
]

export const SCHEDULE_CADENCES: Array<{ id: ScheduleCadence; label: string }> = [
  { id: 'manual', label: 'Manual' },
  { id: 'hourly', label: 'Hourly' },
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
]

export const BUILD_MODES: Array<{ id: BuildMode; label: string }> = [
  { id: 'batch', label: 'Batch' },
  { id: 'streaming', label: 'Streaming' },
]

/** Create default build settings (FN-PLM-001). */
export function createBuildSettings(overrides: Partial<BuildSettings> = {}): BuildSettings {
  return {
    mode: 'batch',
    computeProfile: 'standard',
    scheduleCadence: 'manual',
    outputNaming: 'product_build_{date}_{runId}',
    ...overrides,
  }
}

/** Validate build settings. Returns error strings (empty when valid). */
export function validateBuildSettings(settings: BuildSettings): string[] {
  const errors: string[] = []
  if (settings.mode !== 'batch' && settings.mode !== 'streaming') errors.push('Mode must be batch or streaming')
  if (!COMPUTE_PROFILES.some(p => p.id === settings.computeProfile)) errors.push('Compute profile is unknown')
  if (!SCHEDULE_CADENCES.some(s => s.id === settings.scheduleCadence)) errors.push('Schedule cadence is unknown')
  const naming = settings.outputNaming.trim()
  if (!naming) errors.push('Output naming is required')
  else if (naming.length > 80) errors.push('Output naming must be 80 characters or fewer')
  else if (!/^[a-z0-9 _\-{}.]+$/i.test(naming)) errors.push('Output naming may only contain letters, numbers, spaces and - _ { } .')
  return errors
}

/** Serializable summary for the build settings preview / log line. */
export function summarizeBuildSettings(settings: BuildSettings): string {
  return JSON.stringify(settings, null, 2)
}

/** Human-readable one-line summary of build settings (used in the log strip). */
export function describeBuildSettings(settings: BuildSettings): string {
  const profile = COMPUTE_PROFILES.find(p => p.id === settings.computeProfile)?.label ?? settings.computeProfile
  const cadence = SCHEDULE_CADENCES.find(s => s.id === settings.scheduleCadence)?.label ?? settings.scheduleCadence
  return `${settings.mode} · ${profile} · ${cadence} · ${settings.outputNaming.trim()}`
}

/* ── FN-PLM-002 Legend canvas ──────────────────────────────────────── */

export type LegendToken = 'green' | 'neutral' | 'warn' | 'danger' | 'info'
export type LegendMapping = Record<DatasetState, LegendToken>

export const DATASET_STATES: DatasetState[] = ['raw', 'clean', 'derived', 'ontology', 'llm']
export const DEPLOY_STATUSES: DeployStatus[] = ['live', 'building', 'failed', 'queued']

export const LEGEND_TOKENS: Array<{ id: LegendToken; label: string }> = [
  { id: 'green', label: 'Green (Live)' },
  { id: 'neutral', label: 'Neutral (Queued)' },
  { id: 'warn', label: 'Amber (Building)' },
  { id: 'danger', label: 'Red (Failed)' },
  { id: 'info', label: 'Blue (Info)' },
]

/** Create the default dataset-state → deployed-badge colour mapping. */
export function createLegendMapping(overrides: Partial<LegendMapping> = {}): LegendMapping {
  return {
    raw: 'neutral',
    clean: 'info',
    derived: 'warn',
    ontology: 'green',
    llm: 'green',
    ...overrides,
  }
}

/** Validate a legend mapping. Returns error strings (empty when valid). */
export function validateLegendMapping(mapping: LegendMapping): string[] {
  const errors: string[] = []
  for (const state of DATASET_STATES) {
    const token = mapping[state]
    if (!token) errors.push(`Legend color for ${state} is required`)
    else if (!LEGEND_TOKENS.some(t => t.id === token)) errors.push(`Legend color for ${state} is unknown`)
  }
  return errors
}

/**
 * Glass-token-only badge style for a legend token.
 * Maps each token to the existing desaturated palette tokens (no new hues).
 */
export function legendTokenStyle(token: LegendToken): CSSProperties {
  switch (token) {
    case 'green':
      return { background: 'rgba(34,197,94,.14)', color: 'var(--green-800)', borderColor: 'rgba(34,197,94,.5)' }
    case 'neutral':
      return { background: 'rgba(5,46,22,.06)', color: 'var(--text-dim)', borderColor: 'rgba(5,46,22,.2)' }
    case 'warn':
      return { background: 'var(--warn-bg)', color: 'var(--warn)', borderColor: 'var(--warn-bd)' }
    case 'danger':
      return { background: 'var(--danger-bg)', color: 'var(--danger)', borderColor: 'var(--danger-bd)' }
    case 'info':
      return { background: 'var(--info-bg)', color: 'var(--info)', borderColor: 'var(--info-bd)' }
    default:
      return { background: 'var(--glass-bg-faint)', color: 'var(--text-dim)', borderColor: 'var(--glass-border)' }
  }
}

/** Deployed-badge style for a dataset state under the given mapping. */
export function legendBadgeStyle(state: DatasetState, mapping: LegendMapping): CSSProperties {
  return legendTokenStyle(mapping[state] ?? 'neutral')
}

/** Chip label for a deploy status (corpus tile wording). */
export function deployStatusLabel(status: DeployStatus): string {
  switch (status) {
    case 'live': return 'Live'
    case 'building': return 'Building'
    case 'failed': return 'Failed'
    case 'queued': return 'Queued'
    default: return status
  }
}

/** Count cards per deploy status for the Live/Building/Failed/Queued chips. */
export function countDeployStatuses(cards: Array<{ status: DeployStatus }>): Record<DeployStatus, number> {
  const counts: Record<DeployStatus, number> = { live: 0, building: 0, failed: 0, queued: 0 }
  for (const c of cards) counts[c.status] += 1
  return counts
}

export default function PipelineBuilder() {
  const [cards, setCards] = useState<PCard[]>(INITIAL)
  const [log, setLog] = useState<string[]>(['[build] 0 issues · 7 nodes resolved · lineage OK'])
  const [running, setRunning] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [config, setConfig] = useState<UseLlmConfig>(() => {
    const saved = (ws.meta?.pipelineUseLlm as UseLlmConfig | undefined) ?? null
    return saved ? createUseLlmConfig(saved) : createUseLlmConfig()
  })
  const [applyError, setApplyError] = useState<string | null>(null)
  const [llmBusy, setLlmBusy] = useState(false)
  const [llmOutput, setLlmOutput] = useState<string>('')
  const [llmError, setLlmError] = useState<string | null>(null)
  /* FN-PLM-001 build settings + FN-PLM-002 legend (persisted via patchMeta). */
  const [buildSettings, setBuildSettings] = useState<BuildSettings>(() => {
    const saved = (ws.meta?.pipelineBuildSettings as BuildSettings | undefined) ?? null
    return saved ? createBuildSettings(saved) : createBuildSettings()
  })
  const [settingsDraft, setSettingsDraft] = useState<BuildSettings>(buildSettings)
  const [showBuildSettings, setShowBuildSettings] = useState(false)
  const [settingsError, setSettingsError] = useState<string | null>(null)
  const [legend, setLegend] = useState<LegendMapping>(() => {
    const saved = (ws.meta?.pipelineLegend as LegendMapping | undefined) ?? null
    return saved ? createLegendMapping(saved) : createLegendMapping()
  })
  const [legendDraft, setLegendDraft] = useState<LegendMapping>(legend)
  const [legendError, setLegendError] = useState<string | null>(null)

  const statusCounts = useMemo(() => countDeployStatuses(cards), [cards])

  /** Model picker options derived from the L0 provider registry (no hard-coded model names). */
  const modelOptions = useMemo(() => {
    const ids = PROVIDERS.map(p => p.defaultModel)
    if (!ids.includes(config.model)) ids.push(config.model)
    return Array.from(new Set(ids))
  }, [config.model])

  const persistConfig = (next: UseLlmConfig) => {
    setConfig(next)
    patchMeta({ pipelineUseLlm: next })
  }

  const addNode = (label: string) => {
    const kind: DatasetState = label === 'Use LLM' ? 'llm' : 'derived'
    const id = Date.now()
    const detail =
      label === 'Use LLM'
        ? `Use LLM · ${config.column} · ${config.model}`
        : 'draft · configure inputs'
    setCards(prev => [...prev, { id, kind, name: `${label} Node`, cols: '— cols', detail, status: 'queued' }])
    if (kind === 'llm') setSelectedId(id)
    setLog(l => [...l, `[add] ${label} node appended to DAG`])
    appendTrace({ kind: 'tool-call', tool: 'pipeline.add-node', ok: true, ms: 0, detail: label })
    appendAudit({ event: 'pipeline.add-node', label, kind })
  }

  const run = () => {
    setRunning(true)
    setLog(l => [...l, '[run] Building… validating schemas', '[run] ✓ 134 source files indexed by manifest', '[run] ✓ ontology dataset backfilled · 24 objects', `[run] ${describeBuildSettings(buildSettings)}`])
    appendTrace({ kind: 'tool-call', tool: 'pipeline.build', ok: true, ms: 0, detail: describeBuildSettings(buildSettings) })
    appendAudit({ event: 'pipeline.build', settings: buildSettings })
    window.setTimeout(() => setRunning(false), 900)
  }

  const persistBuildSettings = (next: BuildSettings) => {
    setBuildSettings(next)
    setSettingsDraft(next)
    patchMeta({ pipelineBuildSettings: next })
  }

  const openBuildSettings = () => {
    setSettingsDraft(buildSettings)
    setSettingsError(null)
    setShowBuildSettings(true)
    appendTrace({ kind: 'tool-call', tool: 'pipeline.build-settings.open', ok: true, ms: 0, detail: describeBuildSettings(buildSettings) })
    appendAudit({ event: 'pipeline.build-settings.open' })
  }

  const closeBuildSettings = () => {
    setShowBuildSettings(false)
    setSettingsError(null)
    appendTrace({ kind: 'tool-call', tool: 'pipeline.build-settings.close', ok: true, ms: 0, detail: 'closed' })
    appendAudit({ event: 'pipeline.build-settings.close' })
  }

  const saveBuildSettings = () => {
    const errors = validateBuildSettings(settingsDraft)
    if (errors.length > 0) {
      setSettingsError(errors[0])
      appendTrace({ kind: 'tool-call', tool: 'pipeline.build-settings.save', ok: false, ms: 0, detail: errors.join('; ') })
      appendAudit({ event: 'pipeline.build-settings.save', ok: false, errors })
      return
    }
    setSettingsError(null)
    persistBuildSettings(settingsDraft)
    setShowBuildSettings(false)
    setLog(l => [...l, `[build-settings] saved · ${describeBuildSettings(settingsDraft)}`])
    appendTrace({ kind: 'tool-call', tool: 'pipeline.build-settings.save', ok: true, ms: 0, detail: describeBuildSettings(settingsDraft) })
    appendAudit({ event: 'pipeline.build-settings.save', ok: true, settings: settingsDraft })
  }

  const persistLegend = (next: LegendMapping) => {
    setLegend(next)
    setLegendDraft(next)
    patchMeta({ pipelineLegend: next })
  }

  const saveLegend = () => {
    const errors = validateLegendMapping(legendDraft)
    if (errors.length > 0) {
      setLegendError(errors[0])
      appendTrace({ kind: 'tool-call', tool: 'pipeline.legend.save', ok: false, ms: 0, detail: errors.join('; ') })
      appendAudit({ event: 'pipeline.legend.save', ok: false, errors })
      return
    }
    setLegendError(null)
    persistLegend(legendDraft)
    setLog(l => [...l, `[legend] saved · ${DATASET_STATES.map(s => `${s}=${legendDraft[s]}`).join(' · ')}`])
    appendTrace({ kind: 'tool-call', tool: 'pipeline.legend.save', ok: true, ms: 0, detail: DATASET_STATES.map(s => `${s}=${legendDraft[s]}`).join(' ') })
    appendAudit({ event: 'pipeline.legend.save', ok: true, mapping: legendDraft })
  }

  const removeCard = (id: number) => {
    const removed = cards.find(c => c.id === id)
    setCards(prev => prev.filter(c => c.id !== id))
    if (selectedId === id) setSelectedId(null)
    appendTrace({ kind: 'tool-call', tool: 'pipeline.remove-node', ok: true, ms: 0, detail: removed?.name ?? String(id) })
    appendAudit({ event: 'pipeline.remove-node', id, name: removed?.name })
  }

  const handleApply = () => {
    const errors = validateUseLlmConfig(config)
    if (errors.length > 0) {
      setApplyError(errors[0])
      appendTrace({ kind: 'tool-call', tool: 'pipeline.use-llm.apply', ok: false, ms: 0, detail: errors.join('; ') })
      appendAudit({ event: 'pipeline.use-llm.apply', ok: false, errors })
      return
    }
    setApplyError(null)
    persistConfig({ ...config, showConfig: config.showConfig })
    setCards(prev => {
      const detail = `Use LLM · ${config.column} · ${config.model}`
      const idx = selectedId != null ? prev.findIndex(c => c.id === selectedId && c.kind === 'llm') : -1
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], detail }
        return next
      }
      return [...prev, { id: Date.now(), kind: 'llm', name: 'Use LLM Node', cols: '— cols', detail, status: 'queued' }]
    })
    setLog(l => [...l, `[use-llm] applied · column=${config.column} · model=${config.model} · neg=${config.negValue} · pos=${config.posValue}`])
    appendTrace({ kind: 'tool-call', tool: 'pipeline.use-llm.apply', ok: true, ms: 0, detail: `${config.column} · ${config.model}` })
    appendAudit({ event: 'pipeline.use-llm.apply', ok: true, column: config.column, model: config.model, providerId: config.providerId, negValue: config.negValue, posValue: config.posValue })
  }

  const handleCreatePrompt = () => {
    const { template } = buildUseLlmPrompt(config)
    persistConfig({ ...config, promptTemplate: template })
    setApplyError(null)
    setLog(l => [...l, `[use-llm] prompt created · ${template.length} chars`])
    appendTrace({ kind: 'tool-call', tool: 'pipeline.use-llm.create-prompt', ok: true, ms: 0, detail: `${config.column} · ${template.length} chars` })
    appendAudit({ event: 'pipeline.use-llm.create-prompt', column: config.column, chars: template.length })
  }

  const handleToggleConfig = () => {
    const next = !config.showConfig
    persistConfig({ ...config, showConfig: next })
    appendTrace({ kind: 'tool-call', tool: 'pipeline.use-llm.show-config', ok: true, ms: 0, detail: next ? 'shown' : 'hidden' })
    appendAudit({ event: 'pipeline.use-llm.show-config', shown: next })
  }

  const handleRunLlm = async () => {
    if (llmBusy) return
    const errors = validateUseLlmConfig(config)
    if (errors.length > 0) {
      setLlmError(errors.join('; '))
      appendTrace({ kind: 'tool-call', tool: 'pipeline.use-llm.run', ok: false, ms: 0, detail: errors.join('; ') })
      appendAudit({ event: 'pipeline.use-llm.run', ok: false, errors })
      return
    }
    setLlmBusy(true)
    setLlmError(null)
    setLlmOutput('')
    const { system, user } = buildUseLlmPrompt(config)
    try {
      const base = loadSettings()
      const spec = providerById(config.providerId)
      const settings = { ...base, providerId: config.providerId, baseUrl: spec.baseUrl, model: config.model, systemPrompt: system }
      const out = await llmChat(settings, [{ role: 'user', content: user }], 'extraction')
      setLlmOutput(out)
      setLog(l => [...l, `[use-llm] scored · column=${config.column} · ${out.length} chars`])
      appendAudit({ event: 'pipeline.use-llm.run', ok: true, column: config.column, model: config.model })
    } catch (e) {
      const msg = String(e instanceof Error ? e.message : e)
      setLlmError(msg.slice(0, 400))
      setLog(l => [...l, `[use-llm] run failed · ${msg.slice(0, 120)}`])
      appendAudit({ event: 'pipeline.use-llm.run', ok: false, error: msg.slice(0, 200) })
    } finally {
      setLlmBusy(false)
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (showBuildSettings) {
        setShowBuildSettings(false)
        setSettingsError(null)
        appendTrace({ kind: 'tool-call', tool: 'pipeline.build-settings.close', ok: true, ms: 0, detail: 'escape' })
        appendAudit({ event: 'pipeline.build-settings.close', via: 'escape' })
        return
      }
      if (config.showConfig) persistConfig({ ...config, showConfig: false })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [config, showBuildSettings])

  const stepControl = (label: string, value: number, onStep: (delta: number) => void) => (
    <div className="use-llm-stepper">
      <span className="use-llm-stepper-label">{label}</span>
      <button type="button" className="btn btn-ghost" aria-label={`Decrease ${label}`} onClick={() => onStep(-0.1)}><Icon name="x" size={11} /></button>
      <span className="use-llm-stepper-value" aria-label={`${label} value`} data-testid={`stepper-${label.replace(/\s+/g, '-').toLowerCase()}`}>{value.toFixed(2)}</span>
      <button type="button" className="btn btn-ghost" aria-label={`Increase ${label}`} onClick={() => onStep(0.1)}><Icon name="plus" size={11} /></button>
    </div>
  )

  return (
    <div className="module fade-in">
      <div className="module-head glass-strong">
        <div>
          <div className="module-title"><Icon name="pipeline" size={18} /> Pipeline Builder</div>
          <div className="module-sub">Datasource → Transform → Ontology · mirrors the reference corpus DAG</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="chip chip-mono">branch: master → UAT → oct</span>
          <span className="chip chip-mono" data-testid="build-settings-summary" title={summarizeBuildSettings(buildSettings)}>{describeBuildSettings(buildSettings)}</span>
          <button className="btn" onClick={openBuildSettings} aria-label="Open build settings"><Icon name="server" size={13} /> Build settings</button>
          <button className="btn btn-primary" onClick={run} disabled={running}><Icon name="refresh" size={13} /> {running ? 'Building…' : 'Build'}</button>
        </div>
      </div>

      <div className="module-body">
        <div className="pipe-palette">
          <div className="glass panel" style={{ height: '100%' }}>
            <div className="panel-title">Palette</div>
            {PALETTE.map(p => (
              <div key={p.label} className="pipe-node" role="button" tabIndex={0} onClick={() => addNode(p.label)} onKeyDown={e => e.key === 'Enter' && addNode(p.label)} title={`Add ${p.label} node`}>
                + {p.label}<div style={{ fontWeight: 400, fontSize: 9, color: 'var(--text-dim)' }}>{p.hint}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="pipe-canvas glass">
          <div className="pipe-row">
            {cards.map((c, i) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  className={`pcard ${c.kind}${selectedId === c.id ? ' selected' : ''}`}
                  onClick={() => c.kind === 'llm' && setSelectedId(c.id)}
                  role={c.kind === 'llm' ? 'button' : undefined}
                  tabIndex={c.kind === 'llm' ? 0 : undefined}
                  onKeyDown={e => { if (c.kind === 'llm' && (e.key === 'Enter' || e.key === ' ')) setSelectedId(c.id) }}
                >
                  <h4>{c.name}</h4>
                  <div className="cols">{c.cols}</div>
                  <div className="module-sub" style={{ margin: '4px 0' }}>{c.detail}</div>
                  <div className="io">
                    <span className="chip">{c.kind}</span>
                    <span
                      className="deploy-badge chip"
                      data-testid={`deploy-badge-${c.id}`}
                      data-status={c.status}
                      style={legendBadgeStyle(c.kind, legend)}
                      title={`${deployStatusLabel(c.status)} · ${c.kind} → ${legend[c.kind]}`}
                    >{deployStatusLabel(c.status)}</span>
                    <button className="btn btn-ghost" style={{ padding: '2px 6px' }} onClick={e => { e.stopPropagation(); removeCard(c.id) }} aria-label="Remove node"><Icon name="x" size={12} /></button>
                  </div>
                  {c.kind === 'llm' && (
                    <button className="btn" style={{ marginTop: 6, padding: '3px 8px', fontSize: 10 }} onClick={e => { e.stopPropagation(); setSelectedId(c.id) }} aria-label="Configure Use LLM node">Configure Use LLM node</button>
                  )}
                </div>
                {i < cards.length - 1 && <div className="parrow">→</div>}
              </div>
            ))}
          </div>
          <div className="legend-canvas glass-faint" data-testid="legend-canvas" role="region" aria-label="Legend canvas">
            <div className="legend-head">
              <span className="panel-title" style={{ margin: 0 }}>Legend canvas <span className="chip chip-mono">FN-PLM-002</span></span>
              <div className="legend-chips" aria-label="Deploy status counts">
                {DEPLOY_STATUSES.map(s => (
                  <span key={s} className="chip legend-chip" data-testid={`legend-chip-${s}`} title={`Deploy status: ${deployStatusLabel(s)}`}>
                    {deployStatusLabel(s)} <strong className="chip-mono">{statusCounts[s]}</strong>
                  </span>
                ))}
              </div>
              <button className="btn btn-primary legend-save" onClick={saveLegend} aria-label="Save legend mapping">Save legend mapping</button>
            </div>
            <div className="legend-mapping" aria-label="Dataset state to badge color mapping">
              {DATASET_STATES.map(state => (
                <label key={state} className="legend-row">
                  <span className="legend-state">{state}</span>
                  <select
                    className="input legend-select"
                    aria-label={`Legend color for ${state}`}
                    data-testid={`legend-select-${state}`}
                    value={legendDraft[state]}
                    onChange={e => setLegendDraft({ ...legendDraft, [state]: e.target.value as LegendToken })}
                  >
                    {LEGEND_TOKENS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                  <span className="deploy-badge chip legend-preview-badge" data-testid={`legend-preview-${state}`} style={legendBadgeStyle(state, legendDraft)}>{deployStatusLabel(statusCounts.live > 0 ? 'live' : 'queued')}</span>
                </label>
              ))}
            </div>
            {legendError && <div role="alert" className="legend-error">{legendError}</div>}
            <div className="legend-preview" data-testid="legend-preview">
              <span className="legend-label">Deployed badge preview ·</span>{' '}
              {DATASET_STATES.map(state => (
                <span key={state} className="deploy-badge chip" data-testid={`legend-applied-${state}`} style={legendBadgeStyle(state, legend)}>{state} → {legend[state]}</span>
              ))}
            </div>
          </div>
          <div className="ppreview" data-testid="pipeline-preview">
            {PREVIEW_ROWS.map((r, i) => <div key={i}>{r}</div>)}
            <div style={{ marginTop: 6, borderTop: '1px solid rgba(34,197,94,.25)', paddingTop: 4 }}>{log.map((l, i) => <div key={i}>{l}</div>)}</div>
          </div>
        </div>

        <div className="glass panel use-llm-panel" data-testid="use-llm-panel" role="region" aria-label="Use LLM node configuration">
          <div className="panel-title">Use LLM node <span className="chip chip-mono">FN-PLM-003</span></div>

          <div className="label" id="use-llm-context-label">Business Context</div>
          <textarea
            className="input"
            aria-labelledby="use-llm-context-label"
            aria-label="Business Context"
            placeholder="e.g. Score product sentiment for retail analytics"
            value={config.context}
            onChange={e => setConfig({ ...config, context: e.target.value })}
            style={{ minHeight: 56, resize: 'vertical', fontSize: 11 }}
          />

          <div className="label">Sentiment thresholds</div>
          {stepControl('Negative value', config.negValue, d => setConfig({ ...config, negValue: stepperStep(config.negValue, d) }))}
          {stepControl('Positive value', config.posValue, d => setConfig({ ...config, posValue: stepperStep(config.posValue, d) }))}

          <div className="label" id="use-llm-column-label">Input column</div>
          <select
            className="input"
            aria-labelledby="use-llm-column-label"
            aria-label="Input column"
            value={config.column}
            onChange={e => setConfig({ ...config, column: e.target.value })}
          >
            {USE_LLM_COLUMNS.map(col => <option key={col} value={col}>{col}</option>)}
          </select>

          <div className="label" id="use-llm-provider-label">Model provider</div>
          <select
            className="input"
            aria-labelledby="use-llm-provider-label"
            aria-label="Model provider"
            value={config.providerId}
            onChange={e => {
              const spec = providerById(e.target.value)
              setConfig({ ...config, providerId: spec.id, model: spec.defaultModel })
            }}
          >
            {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>

          <div className="label" id="use-llm-model-label">Model</div>
          <select
            className="input"
            aria-labelledby="use-llm-model-label"
            aria-label="Model"
            value={config.model}
            onChange={e => {
              const model = e.target.value
              const owner = PROVIDERS.find(p => p.defaultModel === model)
              setConfig({ ...config, model, providerId: owner ? owner.id : config.providerId })
            }}
          >
            {modelOptions.map(m => <option key={m} value={m}>{m}</option>)}
          </select>

          <div className="use-llm-actions">
            <button className="btn" onClick={handleToggleConfig} aria-expanded={config.showConfig} aria-label="Show configurations">Show configurations</button>
            <button className="btn" onClick={handleCreatePrompt} aria-label="Create prompt">Create prompt</button>
            <button className="btn btn-primary" onClick={handleApply} aria-label="Apply">Apply</button>
          </div>

          {applyError && <div role="alert" className="use-llm-error">{applyError}</div>}

          {config.promptTemplate && (
            <div>
              <div className="label">Prompt template</div>
              <textarea className="input" aria-label="Prompt template" readOnly value={config.promptTemplate} style={{ minHeight: 64, fontFamily: 'var(--font-mono)', fontSize: 9.5 }} />
            </div>
          )}

          {config.showConfig && (
            <div>
              <div className="label">Configuration</div>
              <pre className="use-llm-config-preview" data-testid="use-llm-config-preview">{summarizeUseLlmConfig(config)}</pre>
            </div>
          )}

          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleRunLlm} disabled={llmBusy} aria-label="Run Use LLM node">
              <Icon name="spark" size={12} /> {llmBusy ? 'Running…' : 'Run Use LLM node'}
            </button>
          </div>

          <div className="label">Preview</div>
          <div className="use-llm-preview" data-testid="use-llm-preview">
            <div className="module-sub">Column: {config.column} · neg &lt; {config.negValue.toFixed(2)} · pos &gt; {config.posValue.toFixed(2)}</div>
            <div style={{ marginTop: 6 }}>
              {PREVIEW_ROWS.slice(1).map((r, i) => <div key={i} className="use-llm-preview-row">{r}</div>)}
            </div>
            {llmError && <div role="alert" className="use-llm-error" style={{ marginTop: 6 }}>⚠ {llmError}</div>}
            {llmOutput && <pre className="use-llm-output">{llmOutput}</pre>}
            {!llmOutput && !llmError && <div className="module-sub" style={{ marginTop: 6 }}>Run to score rows via the L0 client.</div>}
          </div>
        </div>
      </div>

      {/* FN-PLM-001 Build settings modal */}
      {showBuildSettings && (
        <div className="palette-overlay" onMouseDown={closeBuildSettings}>
          <div
            className="glass-strong fade-in build-settings-modal"
            role="dialog"
            aria-label="Build settings"
            data-testid="build-settings-modal"
            onMouseDown={e => e.stopPropagation()}
          >
            <div className="build-settings-head">
              <span className="module-title" style={{ fontSize: 14 }}>Build settings <span className="chip chip-mono">FN-PLM-001</span></span>
              <button type="button" className="btn btn-ghost" onClick={closeBuildSettings} aria-label="Close build settings"><Icon name="x" size={14} /></button>
            </div>

            <div className="label" id="build-mode-label">Mode</div>
            <div className="build-mode-toggle" role="group" aria-labelledby="build-mode-label">
              {BUILD_MODES.map(m => (
                <button
                  key={m.id}
                  type="button"
                  className="btn build-mode-btn"
                  aria-label={`Mode ${m.label}`}
                  data-testid={`build-mode-${m.id}`}
                  aria-pressed={settingsDraft.mode === m.id}
                  onClick={() => setSettingsDraft({ ...settingsDraft, mode: m.id })}
                >{m.label}</button>
              ))}
            </div>

            <div className="label" id="build-compute-label">Compute profile</div>
            <select
              className="input"
              aria-labelledby="build-compute-label"
              aria-label="Compute profile"
              data-testid="build-compute-profile"
              value={settingsDraft.computeProfile}
              onChange={e => setSettingsDraft({ ...settingsDraft, computeProfile: e.target.value as ComputeProfileId })}
            >
              {COMPUTE_PROFILES.map(p => <option key={p.id} value={p.id}>{p.label} — {p.hint}</option>)}
            </select>

            <div className="label" id="build-cadence-label">Schedule cadence</div>
            <select
              className="input"
              aria-labelledby="build-cadence-label"
              aria-label="Schedule cadence"
              data-testid="build-schedule-cadence"
              value={settingsDraft.scheduleCadence}
              onChange={e => setSettingsDraft({ ...settingsDraft, scheduleCadence: e.target.value as ScheduleCadence })}
            >
              {SCHEDULE_CADENCES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>

            <div className="label" id="build-naming-label">Output naming</div>
            <input
              className="input chip-mono"
              aria-labelledby="build-naming-label"
              aria-label="Output naming"
              data-testid="build-output-naming"
              value={settingsDraft.outputNaming}
              onChange={e => setSettingsDraft({ ...settingsDraft, outputNaming: e.target.value })}
              spellCheck={false}
            />
            <div className="module-sub">Pattern: e.g. product_build_{'{date}'}_{'{runId}'} — letters, numbers, spaces and - _ {'{ }'} . only.</div>

            {settingsError && <div role="alert" className="build-settings-error">{settingsError}</div>}

            <div className="build-settings-actions">
              <button className="btn" onClick={closeBuildSettings} aria-label="Cancel build settings">Cancel</button>
              <button className="btn btn-primary" onClick={saveBuildSettings} aria-label="Save build settings">Save build settings</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
