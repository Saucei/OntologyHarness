// Session + token helpers for AgentConsole (FN-FDE-001/002/003).
// Sessions persist in ws.meta[agentSessions] so they survive reload
// via the existing debounced ws_save_meta path — no new store APIs.
import { ws, patchMeta } from '../store'

export const META_KEY = 'agentSessions'
export const TOKEN_BUDGET = 200_000

export type SessionStep = { tool: string; args: any; result: any; ok: boolean; ms: number }
export type SessionMessage = { id: number; role: 'user' | 'assistant'; text: string; steps?: SessionStep[] }
export type AgentSession = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messages: SessionMessage[]
  allowlist: string[]
}
export type SessionState = { sessions: AgentSession[]; activeId: string }

/** Rough 4-chars-per-token estimate — the same heuristic used by the outline budget. */
export function estimateTokens(text: string): number {
  if (!text) return 0
  return Math.max(1, Math.ceil(text.length / 4))
}

/** Token estimate for a JSON-serializable value (args/result blobs). */
export function estimateValueTokens(value: any): number {
  if (value === null || value === undefined) return 0
  try {
    return estimateTokens(JSON.stringify(value) ?? '')
  } catch {
    return estimateTokens(String(value))
  }
}

/** 33100 -> "33.1K", 320 -> "320". Matches the "~33.1K / 200K tokens" footer style. */
export function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return String(Math.round(n))
}

export function messageTokens(msg: SessionMessage): number {
  return estimateTokens(msg.text)
}

export function stepTokens(step: SessionStep): number {
  return estimateValueTokens(step.args) + estimateValueTokens(step.result)
}

/**
 * Computed from actual message + tool-call lengths plus the live system
 * prompt length — never a hard-coded constant. Includes in-flight steps
 * passed in via extraSteps so the footer meter moves while tools run.
 */
export function totalSessionTokens(session: AgentSession, systemPrompt: string, extraSteps: SessionStep[] = []): number {
  let total = estimateTokens(systemPrompt)
  for (const m of session.messages) {
    total += messageTokens(m)
    for (const s of m.steps ?? []) total += stepTokens(s)
  }
  for (const s of extraSteps) total += stepTokens(s)
  return total
}

export function isAllowlisted(allowlist: string[], tool: string): boolean {
  return allowlist.includes(tool)
}

function uid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`
}

export function defaultGreeting(model: string, label: string): SessionMessage {
  return {
    id: 0,
    role: 'assistant',
    text: `Ontology Harness agent online. Model: ${model} (${label}). Tools: graph.query · ontology.list · ontology.get · corpus.search · pipeline.run · workshop.publish. Ask anything.`,
  }
}

export function deriveTitle(messages: SessionMessage[]): string {
  const firstUser = messages.find(m => m.role === 'user')
  if (!firstUser) return 'New session'
  const text = firstUser.text.trim().replace(/\s+/g, ' ')
  if (!text) return 'New session'
  return text.length > 36 ? `${text.slice(0, 36)}…` : text
}

export function createSession(greeting?: SessionMessage): AgentSession {
  const now = new Date().toISOString()
  return {
    id: uid(),
    title: 'New session',
    createdAt: now,
    updatedAt: now,
    messages: greeting ? [{ ...greeting }] : [],
    allowlist: [],
  }
}

function isSession(value: any): value is AgentSession {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.id === 'string' &&
    Array.isArray(value.messages) &&
    Array.isArray(value.allowlist)
  )
}

export function getActiveSession(state: SessionState): AgentSession {
  return state.sessions.find(s => s.id === state.activeId) ?? state.sessions[0]
}

/** Load + sanitize { sessions, activeId } from ws.meta; always returns >= 1 session. */
export function loadSessionState(greeting?: SessionMessage): SessionState {
  const raw = ws.meta?.[META_KEY] as any
  if (raw && Array.isArray(raw.sessions) && raw.sessions.length > 0) {
    const sessions: AgentSession[] = []
    for (const s of raw.sessions) {
      if (!isSession(s)) continue
      sessions.push({
        id: s.id,
        title: typeof s.title === 'string' && s.title ? s.title : 'New session',
        createdAt: typeof s.createdAt === 'string' ? s.createdAt : new Date().toISOString(),
        updatedAt: typeof s.updatedAt === 'string' ? s.updatedAt : new Date().toISOString(),
        messages: Array.isArray(s.messages) ? s.messages : [],
        allowlist: Array.isArray(s.allowlist) ? s.allowlist.filter((x: any) => typeof x === 'string') : [],
      })
    }
    if (sessions.length > 0) {
      const activeId = typeof raw.activeId === 'string' && sessions.some(s => s.id === raw.activeId) ? raw.activeId : sessions[0].id
      return { sessions, activeId }
    }
  }
  const seed = createSession(greeting)
  return { sessions: [seed], activeId: seed.id }
}

export function saveSessionState(state: SessionState): void {
  patchMeta({ [META_KEY]: { sessions: state.sessions, activeId: state.activeId } })
}

export function removeSession(state: SessionState, id: string): SessionState {
  if (state.sessions.length <= 1) return state
  const sessions = state.sessions.filter(s => s.id !== id)
  const activeId = state.activeId === id ? sessions[0].id : state.activeId
  return { sessions, activeId }
}
