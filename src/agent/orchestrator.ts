// Agent orchestrator — observe → plan → act → verify → report.
// Provider-agnostic: uses a compact <tool>...</tool> protocol so it works on any LLM
// (native tool-calling varies per vendor; this is the lowest-common-denominator contract).
import { loadSettings, llmChat, isTauriApp, type ProviderSettings } from '../llm/client'
import { TOOLS, TOOL_PROTOCOL, toolByName } from './tools'
import { appendTrace, appendAudit } from '../store'

export type AgentStep = { tool: string; args: any; result: any; ok: boolean; ms: number }
export type AgentResult = { answer: string; steps: AgentStep[]; hops: number; aborted: boolean }

export type ApprovalRequest = { tool: string; args: any; reason: string }
export type ApprovalHandler = (req: ApprovalRequest) => Promise<boolean>

const MAX_HOPS = 8

const SYSTEM_PREAMBLE = `You are the embedded agent of Ontology Harness. You may call tools to ground answers in real app data.

Protocol: to call a tool, output EXACTLY one block, then STOP and wait:
<tool>{"name": "tool.name", "args": { ... }}</tool>
You will then receive <tool_result>{...}</tool_result>. Use it. Repeat until you can answer.
Rules:
- Never invent IDs, backing datasets or paths — if missing, call corpus.search or ontology.list first.
- dryRun defaults to true; only pass dryRun=false when the user explicitly asked for it (that requires their approval).
- Cite real identifiers from tool results. End with: Action · Evidence (IDs) · Verification · Next step.
- When no tool is needed, answer directly without <tool> blocks.

Available tools:
${TOOL_PROTOCOL}`

export async function runAgent(userPrompt: string, opts: {
  settings?: ProviderSettings
  onStep?: (step: AgentStep) => void
  onToken?: (tok: string) => void
  onApproval?: ApprovalHandler
  signal?: AbortSignal
} = {}): Promise<AgentResult> {
  const settings = opts.settings ?? loadSettings()
  const steps: AgentStep[] = []
  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'user', content: userPrompt },
  ]

  for (let hop = 0; hop < MAX_HOPS; hop++) {
    if (opts.signal?.aborted) return { answer: '(aborted by operator)', steps, hops: hop, aborted: true }

    const reply = await llmChat(settings, [{ role: 'system', content: SYSTEM_PREAMBLE }, ...messages], 'reasoning')
    messages.push({ role: 'assistant', content: reply })

    const match = reply.match(/<tool>([\s\S]*?)<\/tool>/)
    if (!match) {
      // Final answer — no more tool calls.
      return { answer: reply.trim(), steps, hops: hop + 1, aborted: false }
    }

    let parsed: { name?: string; args?: any } = {}
    try { parsed = JSON.parse(match[1].trim()) } catch {
      messages.push({ role: 'user', content: '<tool_result>{"ok":false,"error":"invalid JSON inside <tool> — re-emit the block exactly as {"name":"...","args":{...}}</tool_result>' })
      continue
    }

    const tool = parsed.name ? toolByName(parsed.name) : undefined
    if (!tool) {
      messages.push({ role: 'user', content: `<tool_result>{"ok":false,"error":"unknown tool \"${parsed.name}\". Available: ${TOOLS.map(t => t.name).join(', ')}</tool_result>` })
      continue
    }

    const args = parsed.args ?? {}
    // Approval gate: destructive tools with dryRun=false need explicit consent.
    const wantsLive = tool.destructive && args?.dryRun === false
    if (wantsLive) {
      const approved = opts.onApproval
        ? await opts.onApproval({ tool: tool.name, args, reason: `${tool.name} requested with dryRun=false (live execution)` })
        : false
      appendAudit({ event: 'approval', tool: tool.name, args, approved })
      if (!approved) {
        messages.push({ role: 'user', content: `<tool_result>{"ok":false,"error":"user declined live execution — rerun with dryRun=true"}</tool_result>` })
        opts.onStep?.({ tool: tool.name, args, result: { ok: false, error: 'declined' }, ok: false, ms: 0 })
        continue
      }
    }

    const t0 = performance.now()
    let result: any
    try { result = await tool.execute(args) } catch (e) { result = { ok: false, error: String(e) } }
    const ms = Math.round(performance.now() - t0)
    const ok = !!result?.ok
    steps.push({ tool: tool.name, args, result, ok, ms })
    appendTrace({ kind: 'tool-call', tool: tool.name, ok, ms, detail: JSON.stringify(args).slice(0, 160) })
    opts.onStep?.(steps[steps.length - 1])

    messages.push({ role: 'user', content: `<tool_result>${JSON.stringify(result).slice(0, 4000)}</tool_result>` })
  }

  return { answer: '(hop limit reached — see tool trace)', steps, hops: MAX_HOPS, aborted: false }
}

export function isLiveCapable(): boolean {
  const s = loadSettings()
  const spec = s.providerId
  // heuristic: a key is configured (tauri: hasKey flag) or browser key present
  return s.hasKey || (!isTauriApp() && s.apiKey.trim().length > 0) || spec === 'ollama' || spec === 'custom'
}
