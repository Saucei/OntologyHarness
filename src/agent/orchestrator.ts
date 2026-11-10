// Agent orchestrator — observe → plan → act → verify → report.
// Provider-agnostic: OpenAI-kind providers get NATIVE tool-calling (T-34 bridge —
// small local models like LFM2.5 are hard-trained on their native call template and
// ignore text protocols); every provider keeps the compact <tool>...</tool> text
// protocol as fallback, so hosted and anthropic models work unchanged.
import { loadSettings, llmChat, llmChatTools, providerById, appToolName, isTauriApp, type NativeToolCall, type ProviderSettings } from '../llm/client'
import { TOOLS, TOOL_PROTOCOL, toolByName } from './tools'
import { appendTrace, appendAudit } from '../store'

export type AgentStep = { tool: string; args: any; result: any; ok: boolean; ms: number }
export type AgentResult = { answer: string; steps: AgentStep[]; hops: number; aborted: boolean }

export type ApprovalRequest = { tool: string; args: any; reason: string }
export type ApprovalHandler = (req: ApprovalRequest) => Promise<boolean>

const MAX_HOPS = 8

const SYSTEM_RULES = `Rules:
- Never invent IDs, backing datasets or paths — if missing, call corpus.search or ontology.list first.
- dryRun defaults to true; only pass dryRun=false when the user explicitly asked for it (that requires their approval).
- Cite real identifiers from tool results. End with: Action · Evidence (IDs) · Verification · Next step.
- When no tool is needed, answer directly.`

const SYSTEM_PREAMBLE = `You are the embedded agent of Ontology Harness. You may call tools to ground answers in real app data.

Protocol: to call a tool, output EXACTLY one block, then STOP and wait:
<tool>{"name": "tool.name", "args": { ... }}</tool>
You will then receive <tool_result>{...}</tool_result>. Use it. Repeat until you can answer.
${SYSTEM_RULES}
- When calling a tool, output no other text.

Available tools:
${TOOL_PROTOCOL}`

const SYSTEM_PREAMBLE_NATIVE = `You are the embedded agent of Ontology Harness. Ground answers in real app data by calling the provided tools (native function calling). You will receive results as <tool_result> user messages.

${SYSTEM_RULES}`

type ParsedCall = { name?: string; args?: any }

export async function runAgent(userPrompt: string, opts: {
  settings?: ProviderSettings
  onStep?: (step: AgentStep) => void
  onToken?: (tok: string) => void
  onApproval?: ApprovalHandler
  signal?: AbortSignal
} = {}): Promise<AgentResult> {
  const settings = opts.settings ?? loadSettings()
  const useNative = providerById(settings.providerId).kind === 'openai'
  const steps: AgentStep[] = []
  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'user', content: userPrompt },
  ]

  /** Execute one parsed tool call: approval gate → run → trace → feed result back. */
  const executeCall = async (parsed: ParsedCall): Promise<void> => {
    const tool = parsed.name ? toolByName(parsed.name) : undefined
    if (!tool) {
      messages.push({ role: 'user', content: `<tool_result>{"ok":false,"error":"unknown tool \"${parsed.name}\". Available: ${TOOLS.map(t => t.name).join(', ')}</tool_result>` })
      return
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
        return
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

  for (let hop = 0; hop < MAX_HOPS; hop++) {
    if (opts.signal?.aborted) return { answer: '(aborted by operator)', steps, hops: hop, aborted: true }

    let reply: string
    let nativeCalls: NativeToolCall[] = []
    if (useNative) {
      const r = await llmChatTools(settings, [{ role: 'system', content: SYSTEM_PREAMBLE_NATIVE }, ...messages], TOOLS, 'reasoning')
      reply = r.content
      nativeCalls = r.toolCalls
    } else {
      reply = await llmChat(settings, [{ role: 'system', content: SYSTEM_PREAMBLE }, ...messages], 'reasoning')
    }
    messages.push({ role: 'assistant', content: reply || nativeCalls.map(c => `[called ${appToolName(c.name)}]`).join('; ') })

    // Native tool calls (T-34) — parsed by the provider/Ollama from the model's own template.
    if (nativeCalls.length > 0) {
      for (const c of nativeCalls.slice(0, 3)) {
        await executeCall({ name: appToolName(c.name), args: c.args })
      }
      continue
    }

    // Text-protocol fallback — <tool>{"name": "...", "args": {...}}</tool>
    const match = reply.match(/<tool>([\s\S]*?)<\/tool>/)
    if (!match) {
      // Final answer — no more tool calls.
      return { answer: reply.trim(), steps, hops: hop + 1, aborted: false }
    }

    let parsed: ParsedCall = {}
    try { parsed = JSON.parse(match[1].trim()) } catch {
      messages.push({ role: 'user', content: '<tool_result>{"ok":false,"error":"invalid JSON inside <tool> — re-emit the block exactly as {"name":"...","args":{...}}</tool_result>' })
      continue
    }

    await executeCall(parsed)
  }

  return { answer: '(hop limit reached — see tool trace)', steps, hops: MAX_HOPS, aborted: false }
}

export function isLiveCapable(): boolean {
  const s = loadSettings()
  const spec = s.providerId
  // heuristic: a key is configured (tauri: hasKey flag) or browser key present
  return s.hasKey || (!isTauriApp() && s.apiKey.trim().length > 0) || spec === 'ollama' || spec === 'custom'
}

// Rollback note: T-34 is additive — set providerId to an anthropic provider (or revert
// this file) to restore the pure text-protocol loop; the bridge touches only the
// OpenAI-kind turn function and the new llm_chat_tools Rust command.
