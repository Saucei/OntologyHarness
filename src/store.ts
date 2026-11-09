// Workspace store — single cache hydrated once at boot from Windows-Credential-
// Manager-adjacent SQLite (Tauri) or localStorage (browser dev). Debounced autosave.
import { OBJECT_TYPES, type ObjectType } from './data/ontology'
import type { Job } from './jobs'

export type Trace = {
  at?: string
  kind: 'llm-call' | 'swarm-worker' | 'agent-step' | 'tool-call' | 'preset-run'
  provider?: string; model?: string; taskClass?: string
  ok: boolean; ms: number
  tokensIn?: number; tokensOut?: number
  worker?: string; tool?: string; detail?: string
  runId?: string; runName?: string; stepIdx?: number
}

export type WsCache = {
  jobs: Job[]
  workers: any[] | null
  objectTypes: ObjectType[]
  datasets: any[]
  traces: Trace[]
  meta: Record<string, any>
  hydrated: boolean
}

const cache: WsCache = { jobs: [], workers: null, objectTypes: OBJECT_TYPES, datasets: [], traces: [], meta: {}, hydrated: false }

export const isTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

const LS = {
  jobs: 'ontology-harness.jobs',
  workers: 'ontology-harness.workers',
  objectTypes: 'ontology-harness.objectTypes',
  datasets: 'ontology-harness.datasets',
  traces: 'ontology-harness.traces',
  meta: 'ontology-harness.meta',
}

const readJobsLs = (): Job[] | null => {
  try { const r = localStorage.getItem(LS.jobs); return r ? JSON.parse(r) : null } catch { return null }
}

export async function initWorkspace(): Promise<WsCache> {
  if (cache.hydrated) return cache
  try {
    if (isTauri()) {
      const { invoke } = await import('@tauri-apps/api/core')
      const snap = await invoke<any>('ws_load')
      cache.jobs = Array.isArray(snap.jobs) && snap.jobs.length ? snap.jobs : (readJobsLs() ?? [])
      cache.workers = Array.isArray(snap.workers) && snap.workers.length ? snap.workers : null
      cache.objectTypes = Array.isArray(snap.objectTypes) && snap.objectTypes.length ? snap.objectTypes : OBJECT_TYPES
      cache.datasets = Array.isArray(snap.datasets) ? snap.datasets : []
      cache.traces = Array.isArray(snap.traces) ? snap.traces : []
      cache.meta = snap.meta && typeof snap.meta === 'object' ? snap.meta : {}
    } else {
      const read = (k: string) => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : null } catch { return null } }
      cache.jobs = readJobsLs() ?? []
      cache.workers = read(LS.workers)
      cache.objectTypes = read(LS.objectTypes) ?? OBJECT_TYPES
      cache.datasets = read(LS.datasets) ?? []
      cache.traces = read(LS.traces) ?? []
      cache.meta = read(LS.meta) ?? {}
    }
  } catch (e) {
    console.warn('[workspace] hydration fell back to local:', e)
    cache.jobs = readJobsLs() ?? []
    cache.objectTypes = OBJECT_TYPES
  }
  cache.hydrated = true
  return cache
}

/* ── debounced persist ─────────────────────────────────────────── */
let persistTimer: number | null = null
function schedulePersist() {
  if (persistTimer) window.clearTimeout(persistTimer)
  persistTimer = window.setTimeout(() => { persistNow().catch(e => console.warn('[workspace] persist failed', e)) }, 400)
}

export async function persistNow() {
  if (!cache.hydrated) return
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core')
    await Promise.allSettled([
      invoke('ws_save_jobs', { jobs: cache.jobs }),
      invoke('ws_save_workers', { workers: cache.workers ?? [] }),
      invoke('ws_save_object_types', { objectTypes: cache.objectTypes }),
      invoke('ws_save_datasets', { datasets: cache.datasets }),
      invoke('ws_save_meta', { meta: cache.meta }),
    ])
  } else {
    localStorage.setItem(LS.jobs, JSON.stringify(cache.jobs))
    localStorage.setItem(LS.workers, JSON.stringify(cache.workers ?? []))
    localStorage.setItem(LS.objectTypes, JSON.stringify(cache.objectTypes))
    localStorage.setItem(LS.datasets, JSON.stringify(cache.datasets))
    localStorage.setItem(LS.meta, JSON.stringify(cache.meta))
  }
}

/* ── cross-module focus bus (deep links from Analyst Jobs) ─────── */
type Focus = { module: string; ref: string }
let pendingFocus: Focus | null = null
export function setFocus(module: string, ref: string) { pendingFocus = { module, ref } }
export function consumeFocus(module: string): string | null {
  if (pendingFocus?.module === module) { const f = pendingFocus.ref; pendingFocus = null; return f }
  return null
}

/* ── accessors ─────────────────────────────────────────────────── */
export const ws = cache

export function setJobs(jobs: Job[]) { cache.jobs = jobs; schedulePersist() }
export function setWorkers(workers: any[]) { cache.workers = workers; schedulePersist() }
export function setObjectTypes(types: ObjectType[]) { cache.objectTypes = types; schedulePersist() }
export function setDatasets(datasets: any[]) { cache.datasets = datasets; schedulePersist() }
export function patchMeta(patch: Record<string, any>) { cache.meta = { ...cache.meta, ...patch }; schedulePersist() }

export function appendTrace(t: Trace) {
  const entry = { ...t, at: t.at ?? new Date().toISOString() }
  cache.traces.push(entry)
  if (isTauri()) {
    import('@tauri-apps/api/core').then(({ invoke }) => invoke('ws_append_trace', { value: entry }).catch(() => {}))
  } else {
    localStorage.setItem(LS.traces, JSON.stringify(cache.traces.slice(-500)))
  }
}
export function appendAudit(value: Record<string, any>) {
  if (isTauri()) {
    import('@tauri-apps/api/core').then(({ invoke }) => invoke('ws_append_audit', { value }).catch(() => {}))
  } else {
    const r = localStorage.getItem('ontology-harness.audit')
    const audit = r ? JSON.parse(r) : []
    audit.push({ at: new Date().toISOString(), ...value })
    localStorage.setItem('ontology-harness.audit', JSON.stringify(audit.slice(-500)))
  }
}

/** Rough USD price per 1M tokens (input/output) for routing-table estimate. */
const PRICE_PER_M: Record<string, { in: number; out: number }> = {
  'gpt-4o': { in: 2.5, out: 10 }, 'gpt-4o-mini': { in: 0.15, out: 0.6 }, 'o4-mini': { in: 1.1, out: 4.4 },
  'claude-sonnet-4-5': { in: 3, out: 15 }, 'claude-haiku-4-5': { in: 1, out: 5 },
  'llama-3.3-70b-versatile': { in: 0.59, out: 0.79 }, 'gemini-2.0-flash': { in: 0.1, out: 0.4 },
  'llama3.1': { in: 0, out: 0 }, 'qwen2.5-coder-32b': { in: 0, out: 0 },
}
export function estimateSpend(traces: Trace[], sinceMs = 24 * 3600 * 1000): { cost: number; tokens: number; calls: number } {
  const since = Date.now() - sinceMs
  let cost = 0, tokens = 0, calls = 0
  for (const t of traces) {
    if (t.at && Date.parse(t.at) < since) continue
    const pin = PRICE_PER_M[t.model ?? ''] ?? { in: 0, out: 0 }
    const tin = t.tokensIn ?? Math.floor((t.ms || 0) * 0) // unknown split → treat as output-weighted estimate
    const tout = t.tokensOut ?? 0
    cost += ((tin * pin.in) + (tout * pin.out)) / 1_000_000
    tokens += tin + tout
    calls += 1
  }
  return { cost, tokens, calls }
}
/** Aggregate worker stats from the trace ledger (real numbers once swarms run live). */
export function workerStats(workerName: string) {
  const mine = cache.traces.filter(t => t.kind === 'swarm-worker' && t.worker === workerName)
  if (mine.length === 0) return null
  const ok = mine.filter(t => t.ok).length
  const avg = Math.round(mine.reduce((a, t) => a + (t.ms || 0), 0) / mine.length)
  const tokens = mine.reduce((a, t) => a + (t.tokensIn ?? 0) + (t.tokensOut ?? 0), 0)
  return { runs: mine.length, success: Math.round((ok / mine.length) * 1000) / 10, latencyMs: avg, tokens }
}
