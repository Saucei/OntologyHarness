// Provider registry + client — native gateway in Tauri, direct fetch in browser dev.
// Keys: Windows Credential Manager (Tauri) or localStorage (browser). Never logged.
import { isTauri, appendTrace, patchMeta, ws } from '../store'

export type ProviderKind = 'openai' | 'anthropic'
export type TaskClass = 'reasoning' | 'extraction' | 'code' | 'cheap'

export type ProviderSpec = {
  id: string; label: string; kind: ProviderKind
  baseUrl: string; defaultModel: string; modelHint: string
  keyLabel: string; keyPlaceholder: string; docsUrl: string
  requiresKey: boolean; local?: boolean
}

export const PROVIDERS: ProviderSpec[] = [
  { id: 'openai', label: 'OpenAI', kind: 'openai', baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini', modelHint: 'gpt-4o, gpt-4o-mini, o4-mini…',
    keyLabel: 'OPENAI_API_KEY', keyPlaceholder: 'sk-…', docsUrl: 'https://platform.openai.com/api-keys', requiresKey: true },
  { id: 'anthropic', label: 'Anthropic', kind: 'anthropic', baseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-sonnet-4-5', modelHint: 'claude-sonnet-4-5, claude-haiku-4-5…',
    keyLabel: 'ANTHROPIC_API_KEY', keyPlaceholder: 'sk-ant-…', docsUrl: 'https://console.anthropic.com/settings/keys', requiresKey: true },
  { id: 'openrouter', label: 'OpenRouter', kind: 'openai', baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'anthropic/claude-sonnet-4.5', modelHint: 'any vendor/model slug',
    keyLabel: 'OPENROUTER_API_KEY', keyPlaceholder: 'sk-or-…', docsUrl: 'https://openrouter.ai/keys', requiresKey: true },
  { id: 'groq', label: 'Groq', kind: 'openai', baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile', modelHint: 'llama-3.3-70b-versatile…',
    keyLabel: 'GROQ_API_KEY', keyPlaceholder: 'gsk_…', docsUrl: 'https://console.groq.com/keys', requiresKey: true },
  { id: 'gemini', label: 'Google Gemini', kind: 'openai', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-2.0-flash', modelHint: 'gemini-2.0-flash, gemini-2.5-pro…',
    keyLabel: 'GEMINI_API_KEY', keyPlaceholder: 'AIza…', docsUrl: 'https://aistudio.google.com/apikey', requiresKey: true },
  { id: 'ollama', label: 'Ollama (local)', kind: 'openai', baseUrl: 'http://localhost:11434/v1',
    defaultModel: 'llama3.1', modelHint: 'llama3.1, qwen2.5-coder, mistral…',
    keyLabel: 'OLLAMA_API_KEY (unused)', keyPlaceholder: 'leave blank', docsUrl: 'https://ollama.com', requiresKey: false, local: true },
  { id: 'azure-openai', label: 'Azure OpenAI', kind: 'openai', baseUrl: 'https://YOUR-RESOURCE.openai.azure.com/openai/deployments/YOUR-DEPLOYMENT',
    defaultModel: 'gpt-4o-mini', modelHint: 'deployment name goes in base URL',
    keyLabel: 'AZURE_OPENAI_API_KEY', keyPlaceholder: 'azure key…', docsUrl: 'https://learn.microsoft.com/azure/ai-services/openai/', requiresKey: true },
  { id: 'custom', label: 'Custom (OpenAI-compatible)', kind: 'openai', baseUrl: 'http://localhost:8080/v1',
    defaultModel: 'local-model', modelHint: 'any /chat/completions endpoint',
    keyLabel: 'API_KEY (optional)', keyPlaceholder: 'optional', docsUrl: '', requiresKey: false },
]

export type RouteModels = Partial<Record<TaskClass, string>>

export type ReasoningTierId = 'fast' | 'balanced' | 'deep'

export type ProviderSettings = {
  providerId: string
  baseUrl: string
  model: string
  /** In Tauri: empty after save (key lives in Credential Manager). In browser: literal key. */
  apiKey: string
  hasKey: boolean
  temperature: number
  maxTokens: number
  systemPrompt: string
  routeModels: RouteModels
  /** Reasoning-tier preset id (FN-FDE-010). Optional for backward compat — defaults to 'balanced'. */
  reasoningTier?: ReasoningTierId
}

export const DEFAULT_SYSTEM_PROMPT =
  'You are the embedded agent of Ontology Harness, a desktop workbench for ontology-centric data work. ' +
  'Be terse, precise and citation-first. Never fabricate dataset paths, object IDs or property names — cite only identifiers present in the provided context. ' +
  'End answers with: Action · Evidence (IDs) · Verification · Next step.'

const STORAGE_KEY = 'ontology-harness.llm'

export const isTauriApp = isTauri

export function defaultSettings(): ProviderSettings {
  const p = PROVIDERS[0]
  return { providerId: p.id, baseUrl: p.baseUrl, model: p.defaultModel, apiKey: '', hasKey: false, temperature: 0.2, maxTokens: 1024, systemPrompt: DEFAULT_SYSTEM_PROMPT, routeModels: {}, reasoningTier: 'balanced' }
}

export function loadSettings(): ProviderSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = { ...defaultSettings(), ...JSON.parse(raw) }
      if (isTauri()) parsed.apiKey = '' // never rehydrate a secret from disk
      return parsed
    }
  } catch { /* corrupt → reset */ }
  return defaultSettings()
}

export function saveSettings(s: ProviderSettings) {
  // In Tauri the raw key is stored via key_save() — persist only the manifest + hasKey.
  const toStore = isTauri() ? { ...s, apiKey: '' } : s
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore))
  patchMeta({ llm: { providerId: s.providerId, model: s.model, hasKey: s.hasKey } })
}

/** Save the secret through the native credential store (Tauri) or localStorage (browser). */
export async function saveSecret(providerId: string, apiKey: string): Promise<void> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core')
    if (apiKey.trim()) await invoke('key_save', { provider: providerId, secret: apiKey.trim() })
    else await invoke('key_delete', { provider: providerId })
  }
  // browser fallback: the key travels in settings.apiKey → localStorage via saveSettings
}

export async function hasSecret(providerId: string): Promise<boolean> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core')
    return invoke<boolean>('key_has', { provider: providerId }).catch(() => false)
  }
  return loadSettings().apiKey.trim().length > 0
}

export async function deleteSecret(providerId: string): Promise<void> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('key_delete', { provider: providerId }).catch(() => {})
  }
}

export function providerById(id: string): ProviderSpec {
  return PROVIDERS.find(p => p.id === id) ?? PROVIDERS[0]
}

/** Per-task-class model routing. Empty override → the provider default model. */
export function routeModel(settings: ProviderSettings, taskClass: TaskClass): string {
  return settings.routeModels[taskClass]?.trim() || settings.model
}

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

function buildPayload(settings: ProviderSettings, messages: ChatMessage[], taskClass: TaskClass = 'reasoning') {
  const spec = providerById(settings.providerId)
  return {
    provider: spec.kind,
    providerId: spec.id,
    baseUrl: settings.baseUrl,
    apiKey: settings.apiKey, // '' in Tauri → gateway reads Credential Manager
    model: routeModel(settings, taskClass),
    system: settings.systemPrompt.trim() || undefined,
    messages,
    temperature: settings.temperature,
    maxTokens: settings.maxTokens,
  }
}

/** Non-streaming chat — retries/backoff happen inside the Rust gateway for Tauri. */
export async function llmChat(settings: ProviderSettings, messages: ChatMessage[], taskClass: TaskClass = 'reasoning'): Promise<string> {
  const payload = buildPayload(settings, messages, taskClass)
  const t0 = performance.now()
  try {
    let out: string
    if (isTauri()) {
      const { invoke } = await import('@tauri-apps/api/core')
      out = await invoke<string>('llm_chat', { req: payload })
    } else {
      out = await browserChat(payload)
    }
    appendTrace({ kind: 'llm-call', provider: payload.providerId, model: payload.model, taskClass, ok: true, ms: Math.round(performance.now() - t0), tokensIn: undefined, tokensOut: out.length })
    return out
  } catch (e) {
    appendTrace({ kind: 'llm-call', provider: payload.providerId, model: payload.model, taskClass, ok: false, ms: Math.round(performance.now() - t0), detail: String(e).slice(0, 200) })
    throw e
  }
}

export type StreamHandlers = { onToken?: (chunk: string) => void; onDone?: (full: string, usage?: any) => void; onError?: (message: string) => void }

/** Streaming chat. In Tauri, tokens arrive as `llm-token` events from the Rust gateway. */
export async function llmChatStream(settings: ProviderSettings, messages: ChatMessage[], handlers: StreamHandlers, taskClass: TaskClass = 'reasoning'): Promise<string> {
  const payload = buildPayload(settings, messages, taskClass)
  const t0 = performance.now()
  let full = ''
  try {
    if (isTauri()) {
      const [{ invoke }, { listen }] = await Promise.all([import('@tauri-apps/api/core'), import('@tauri-apps/api/event')])
      const unlisten = await listen<{ chunk: string; done: boolean; usage?: any }>('llm-token', e => {
        if (e.payload.done) handlers.onDone?.(full, e.payload.usage)
        else { full += e.payload.chunk; handlers.onToken?.(e.payload.chunk) }
      })
      try { full = await invoke<string>('llm_chat_stream', { req: payload }) }
      finally { unlisten() }
    } else {
      full = await browserChatStream(payload, handlers.onToken)
    }
    appendTrace({ kind: 'llm-call', provider: payload.providerId, model: payload.model, taskClass, ok: true, ms: Math.round(performance.now() - t0), tokensOut: full.length })
    return full
  } catch (e) {
    const msg = String(e instanceof Error ? e.message : e)
    appendTrace({ kind: 'llm-call', provider: payload.providerId, model: payload.model, taskClass, ok: false, ms: Math.round(performance.now() - t0), detail: msg.slice(0, 200) })
    handlers.onError?.(msg)
    throw e
  }
}

/* ── browser fallback (direct fetch, CORS permitting) ─────────── */
async function browserChat(payload: any): Promise<string> {
  if (payload.provider === 'anthropic') {
    const res = await fetch(`${payload.baseUrl.replace(/\/$/, '')}/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': payload.apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: payload.model, max_tokens: payload.maxTokens, temperature: payload.temperature, system: payload.system, messages: payload.messages }),
    })
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`)
    const j = await res.json()
    return j?.content?.[0]?.text ?? '(empty response)'
  }
  const msgs = payload.system ? [{ role: 'system', content: payload.system }, ...payload.messages] : payload.messages
  const res = await fetch(`${payload.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(payload.apiKey.trim() ? { authorization: `Bearer ${payload.apiKey.trim()}` } : {}) },
    body: JSON.stringify({ model: payload.model, messages: msgs, temperature: payload.temperature, max_tokens: payload.maxTokens }),
  })
  if (!res.ok) throw new Error(`Provider ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const j = await res.json()
  return j?.choices?.[0]?.message?.content ?? '(empty response)'
}

async function browserChatStream(payload: any, onToken?: (c: string) => void): Promise<string> {
  const msgs = payload.system ? [{ role: 'system', content: payload.system }, ...payload.messages] : payload.messages
  const url = payload.provider === 'anthropic' ? `${payload.baseUrl.replace(/\/$/, '')}/messages` : `${payload.baseUrl.replace(/\/$/, '')}/chat/completions`
  const headers: Record<string, string> = payload.provider === 'anthropic'
    ? { 'content-type': 'application/json', 'x-api-key': payload.apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }
    : { 'content-type': 'application/json', ...(payload.apiKey.trim() ? { authorization: `Bearer ${payload.apiKey.trim()}` } : {}) }
  const body = payload.provider === 'anthropic'
    ? { model: payload.model, max_tokens: payload.maxTokens, temperature: payload.temperature, system: payload.system, messages: payload.messages, stream: true }
    : { model: payload.model, messages: msgs, temperature: payload.temperature, max_tokens: payload.maxTokens, stream: true }

  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
  if (!res.ok || !res.body) throw new Error(`Provider ${res.status}: ${(await res.text()).slice(0, 300)}`)

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = '', out = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    let idx: number
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).trim(); buf = buf.slice(idx + 1)
      if (!line.startsWith('data:')) continue
      const data = line.slice(5).trim()
      if (data === '[DONE]') continue
      try {
        const v = JSON.parse(data)
        const tok = v?.choices?.[0]?.delta?.content ?? v?.delta?.text ?? ''
        if (tok) { out += tok; onToken?.(tok) }
      } catch { /* partial frame */ }
    }
  }
  return out
}

/* ── FN-FDE-009 model catalog: Palantir | Registered | More ────────
   L0-only data; no network. Stats are reference values for the
   detail pane (ctx / max-out / TPM / RPM) — glass tokens only. */

export type CatalogTab = 'palantir' | 'registered' | 'more'
export type CostTier = 'Free' | 'Low' | 'Medium' | 'High'
export type SpeedTier = 'Slow' | 'Medium' | 'Fast' | 'Very fast'
export type ModelClass = TaskClass | 'vision'

export type ModelCatalogEntry = {
  id: string
  label: string
  providerId: string
  model: string
  tab: CatalogTab
  classes: ModelClass[]
  cost: CostTier
  speed: SpeedTier
  contextTokens: number
  maxOutputTokens: number
  tpm: number
  rpm: number
  supportsReasoning: boolean
}

export const CATALOG_TABS: { id: CatalogTab; label: string; hint: string }[] = [
  { id: 'palantir', label: 'Palantir', hint: 'curated frontier models' },
  { id: 'registered', label: 'Registered', hint: 'provider-registered defaults' },
  { id: 'more', label: 'More', hint: 'custom, local + open-router slugs' },
]

export const MODEL_CATALOG: ModelCatalogEntry[] = [
  // Palantir — curated
  { id: 'palantir-claude-sonnet', label: 'Claude Sonnet 4.5', providerId: 'anthropic', model: 'claude-sonnet-4-5', tab: 'palantir', classes: ['reasoning', 'code'], cost: 'High', speed: 'Medium', contextTokens: 200_000, maxOutputTokens: 64_000, tpm: 1_000_000, rpm: 500, supportsReasoning: true },
  { id: 'palantir-gpt-4o', label: 'GPT-4o', providerId: 'openai', model: 'gpt-4o', tab: 'palantir', classes: ['reasoning', 'vision'], cost: 'High', speed: 'Medium', contextTokens: 128_000, maxOutputTokens: 16_384, tpm: 2_000_000, rpm: 1000, supportsReasoning: true },
  { id: 'palantir-o4-mini', label: 'o4-mini', providerId: 'openai', model: 'o4-mini', tab: 'palantir', classes: ['reasoning', 'code'], cost: 'Medium', speed: 'Fast', contextTokens: 200_000, maxOutputTokens: 100_000, tpm: 2_000_000, rpm: 1000, supportsReasoning: true },
  { id: 'palantir-gemini-pro', label: 'Gemini 2.5 Pro', providerId: 'gemini', model: 'gemini-2.5-pro', tab: 'palantir', classes: ['reasoning', 'vision'], cost: 'High', speed: 'Slow', contextTokens: 1_000_000, maxOutputTokens: 65_536, tpm: 4_000_000, rpm: 150, supportsReasoning: true },
  { id: 'palantir-haiku', label: 'Claude Haiku 4.5', providerId: 'anthropic', model: 'claude-haiku-4-5', tab: 'palantir', classes: ['cheap', 'extraction'], cost: 'Medium', speed: 'Fast', contextTokens: 200_000, maxOutputTokens: 64_000, tpm: 1_000_000, rpm: 2000, supportsReasoning: false },
  // Registered — provider defaults
  { id: 'registered-gpt-4o-mini', label: 'GPT-4o mini', providerId: 'openai', model: 'gpt-4o-mini', tab: 'registered', classes: ['cheap', 'extraction'], cost: 'Low', speed: 'Very fast', contextTokens: 128_000, maxOutputTokens: 16_384, tpm: 2_000_000, rpm: 5000, supportsReasoning: false },
  { id: 'registered-llama-70b', label: 'Llama 3.3 70B', providerId: 'groq', model: 'llama-3.3-70b-versatile', tab: 'registered', classes: ['reasoning', 'cheap'], cost: 'Low', speed: 'Very fast', contextTokens: 128_000, maxOutputTokens: 8192, tpm: 6_000_000, rpm: 1000, supportsReasoning: false },
  { id: 'registered-gemini-flash', label: 'Gemini 2.0 Flash', providerId: 'gemini', model: 'gemini-2.0-flash', tab: 'registered', classes: ['cheap', 'extraction', 'vision'], cost: 'Low', speed: 'Very fast', contextTokens: 1_000_000, maxOutputTokens: 8192, tpm: 4_000_000, rpm: 1500, supportsReasoning: false },
  { id: 'registered-llama31', label: 'Llama 3.1 (local)', providerId: 'ollama', model: 'llama3.1', tab: 'registered', classes: ['cheap', 'code'], cost: 'Free', speed: 'Fast', contextTokens: 128_000, maxOutputTokens: 4096, tpm: 0, rpm: 0, supportsReasoning: false },
  { id: 'registered-gpt4o-mini-azure', label: 'GPT-4o mini (Azure)', providerId: 'azure-openai', model: 'gpt-4o-mini', tab: 'registered', classes: ['cheap', 'extraction'], cost: 'Low', speed: 'Very fast', contextTokens: 128_000, maxOutputTokens: 16_384, tpm: 2_000_000, rpm: 5000, supportsReasoning: false },
  // More — custom / local / router slugs
  { id: 'more-openrouter-claude', label: 'Claude Sonnet 4.5 (OpenRouter)', providerId: 'openrouter', model: 'anthropic/claude-sonnet-4.5', tab: 'more', classes: ['reasoning', 'code'], cost: 'High', speed: 'Medium', contextTokens: 200_000, maxOutputTokens: 64_000, tpm: 1_000_000, rpm: 500, supportsReasoning: true },
  { id: 'more-qwen-coder', label: 'Qwen 2.5 Coder 32B (local)', providerId: 'ollama', model: 'qwen2.5-coder-32b', tab: 'more', classes: ['code'], cost: 'Free', speed: 'Medium', contextTokens: 128_000, maxOutputTokens: 8192, tpm: 0, rpm: 0, supportsReasoning: false },
  { id: 'more-custom', label: 'Custom local model', providerId: 'custom', model: 'local-model', tab: 'more', classes: ['cheap'], cost: 'Free', speed: 'Fast', contextTokens: 128_000, maxOutputTokens: 4096, tpm: 0, rpm: 0, supportsReasoning: false },
]

export function catalogForTab(tab: CatalogTab): ModelCatalogEntry[] {
  return MODEL_CATALOG.filter(e => e.tab === tab)
}

export function catalogEntryForModel(model: string, providerId?: string): ModelCatalogEntry | null {
  const m = model.trim()
  if (!m) return null
  if (providerId) {
    const exact = MODEL_CATALOG.find(e => e.model === m && e.providerId === providerId)
    if (exact) return exact
  }
  return MODEL_CATALOG.find(e => e.model === m) ?? null
}

/** 128000 -> "128K", 1000000 -> "1M", 500 -> "500". */
export function formatContextTokens(n: number): string {
  if (n >= 1_000_000) {
    const v = n / 1_000_000
    return `${Number.isInteger(v) ? v.toFixed(0) : v.toFixed(1)}M`
  }
  if (n >= 1_000) return `${Math.round(n / 1000)}K`
  return String(n)
}

/** 1000000 -> "1,000,000"; 0 (local) -> "—". */
export function formatRate(n: number): string {
  if (!n || n <= 0) return '—'
  return n.toLocaleString('en-US')
}

/* ── FN-FDE-010 reasoning-tier presets ─────────────────────────── */

export type ReasoningTierPreset = {
  id: ReasoningTierId
  label: string
  effort: 'Low' | 'Medium' | 'High'
  temperature: number
  maxTokens: number
  description: string
}

export const REASONING_TIERS: ReasoningTierPreset[] = [
  { id: 'fast', label: 'Fast', effort: 'Low', temperature: 0.0, maxTokens: 512, description: 'Low effort, short answers' },
  { id: 'balanced', label: 'Balanced', effort: 'Medium', temperature: 0.2, maxTokens: 2048, description: 'Default balance of depth + speed' },
  { id: 'deep', label: 'Deep', effort: 'High', temperature: 0.4, maxTokens: 4096, description: 'High effort, long chains' },
]

export const DEFAULT_REASONING_TIER: ReasoningTierId = 'balanced'

export function getReasoningTier(id?: ReasoningTierId | string | null): ReasoningTierPreset {
  return REASONING_TIERS.find(t => t.id === id) ?? REASONING_TIERS.find(t => t.id === DEFAULT_REASONING_TIER)!
}

export function nextReasoningTier(current: ReasoningTierId): ReasoningTierId {
  const idx = REASONING_TIERS.findIndex(t => t.id === current)
  const next = idx === -1 ? 1 : (idx + 1) % REASONING_TIERS.length
  return REASONING_TIERS[next].id
}

/** "Balanced • gpt-4o-mini (Medium)" — the Agent Console tier pill text. */
export function tierPillLabel(tierId: ReasoningTierId | string | null | undefined, model: string): string {
  const tier = getReasoningTier(typeof tierId === 'string' ? (tierId as ReasoningTierId) : undefined)
  return `${tier.label} • ${model || 'no model'} (${tier.effort})`
}

/** Patch a settings object with a tier's temperature / maxTokens. Pure. */
export function applyReasoningTier(settings: ProviderSettings, tierId: ReasoningTierId): ProviderSettings {
  const tier = getReasoningTier(tierId)
  return { ...settings, reasoningTier: tier.id, temperature: tier.temperature, maxTokens: tier.maxTokens }
}

/* ── Composer keyboard protocol (FN-FDE-010) ─────────────────────
   Enter = send · Shift+Enter = newline · Ctrl/Cmd+Enter = send.
   "/" = prompt/docs trigger · "$" = variable trigger. */

export type ComposerAction = 'send' | 'newline' | 'none'
export type ComposerTrigger = '/' | '$'

export function resolveComposerAction(e: {
  key: string
  shiftKey?: boolean
  ctrlKey?: boolean
  metaKey?: boolean
}): ComposerAction {
  if (e.key !== 'Enter') return 'none'
  if (e.shiftKey) return 'newline'
  return 'send'
}

/**
 * Trigger active when the input ends with a bare "/" or "$" token
 * (or a token starting with the trigger, e.g. "/mode"). Whitespace-
 * and start-of-input anchored so "a/b" does not fire.
 */
export function detectComposerTrigger(value: string): ComposerTrigger | null {
  if (!value) return null
  const last = value.split('\n').pop() ?? ''
  const tokens = last.trim().split(/\s+/)
  const tok = tokens[tokens.length - 1] ?? ''
  if (tok.startsWith('/') && tok.length <= 32) return '/'
  if (tok.startsWith('$') && tok.length <= 32) return '$'
  return null
}

export function composerTriggerQuery(value: string): { trigger: ComposerTrigger; query: string } | null {
  const trigger = detectComposerTrigger(value)
  if (!trigger) return null
  const last = value.split('\n').pop() ?? ''
  const tokens = last.trim().split(/\s+/)
  const tok = tokens[tokens.length - 1] ?? ''
  return { trigger, query: tok.slice(1) }
}
