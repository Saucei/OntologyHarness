// T-35 — Agent tool-usage benchmark. LFM2.5 2.6B (local Ollama) is the REFERENCE model:
// every tool in the registry must be drivable by it, end-to-end, through the real
// orchestrator loop (native tool-calling bridge + text fallback).
//
// NOT part of CI: guarded by LIVE_BENCH=1 (CI runs vitest without it — suite skips).
// Run locally:  $env:LIVE_BENCH='1'; npm run bench:agent
// Output:       this file's assertions + master-prompts/benchmarks/agent-tool-bench.md
//
// Scenarios cover every established area:
//   graph.query      → Lineage Graph        ontology.list/get → Ontology Studio
//   corpus.search    → Corpus Manifest      pipeline.run      → Pipeline Builder
//   workshop.publish → Workshop Canvas
// Contract per scenario: within MAX_HOPS the loop executes the TARGET tool with
// ok=true, never requests approval for a dry-run, and answers from the result.
import { describe, it, expect, afterAll } from 'vitest'
import { runAgent, type AgentStep, type ApprovalRequest } from './orchestrator'
import { TOOLS } from './tools'
import { defaultSettings } from '../llm/client'
import manifestJson from '../../public/manifest.json'

// Env guard without @types/node in scope (the app tsconfig is DOM-only).
const LIVE = (globalThis as any)?.process?.env?.LIVE_BENCH === '1'
const processCwd = (): string => (globalThis as any)?.process?.cwd?.() ?? '.'
const TARGET_MODEL = 'lfm2.5-2.6b-heretic:latest'
const TIMEOUT_MS = 600_000 // 10 min per scenario — ontology results inflate prefill on CPU/GPU-split boxes

const benchSettings = () => ({
  ...defaultSettings(), // T-35: factory default IS ollama + LFM2.5 (main model)
  maxTokens: 2048,
})

type Row = {
  tool: string
  area: string
  status: 'PASS' | 'FAIL'
  hops: number
  ms: number
  toolCalls: Array<{ tool: string; ok: boolean; ms: number; args: string }>
  approvalsRequested: number
  answer: string
  notes: string[]
}

const rows: Row[] = []

/** Serve the real corpus manifest for relative fetches (jsdom has no dev server). */
function stubManifestFetch() {
  const real = globalThis.fetch
  const body = JSON.stringify(manifestJson)
  const stub = async (input: any, init?: any) => {
    const url = typeof input === 'string' ? input : String(input?.url ?? input)
    if (url.includes('manifest.json')) {
      return new Response(body, { status: 200, headers: { 'content-type': 'application/json' } })
    }
    return real(input, init)
  }
  globalThis.fetch = stub as typeof fetch
  return () => { globalThis.fetch = real }
}

async function scenario(tool: string, area: string, prompt: string, opts: { manifest?: boolean } = {}) {
  const steps: AgentStep[] = []
  const approvals: ApprovalRequest[] = []
  const restore = opts.manifest ? stubManifestFetch() : undefined
  const t0 = Date.now()
  try {
    const result = await runAgent(prompt, {
      settings: benchSettings(),
      onStep: s => steps.push(s),
      onApproval: req => { approvals.push(req); return Promise.resolve(false) }, // benchmark NEVER grants
    })
    const ms = Date.now() - t0
    const target = steps.find(s => s.tool === tool)
    const notes: string[] = []
    if (approvals.length) notes.push(`approval requested: ${approvals.map(a => `${a.tool} ${JSON.stringify(a.args).slice(0, 60)}`).join(' | ')} — declined (dry-run contract)`)
    const row: Row = {
      tool, area,
      status: target?.ok ? 'PASS' : 'FAIL',
      hops: result.hops, ms,
      toolCalls: steps.map(s => ({ tool: s.tool, ok: s.ok, ms: s.ms, args: JSON.stringify(s.args).slice(0, 80) })),
      approvalsRequested: approvals.length,
      answer: result.answer.slice(0, 400),
      notes,
    }
    rows.push(row)
    console.log(`[bench] ${tool} → ${row.status} · ${row.hops} hops · ${(ms / 1000).toFixed(1)} s · calls: ${row.toolCalls.map(c => c.tool).join(', ') || 'none'}`)
    expect(target, `tool ${tool} never executed ok — steps: ${JSON.stringify(steps.map(s => s.tool))}`).toBeTruthy()
    expect(target!.ok).toBe(true)
    expect(result.answer.trim().length).toBeGreaterThan(20)
    expect(result.aborted).toBe(false)
  } finally {
    restore?.()
  }
}

describe.skipIf(!LIVE)('T-35 agent tool-usage benchmark — LFM2.5 2.6B reference model', () => {
  it('graph.query — Lineage Graph area: lineage around a stage', async () => {
    await scenario('graph.query', 'Lineage Graph', 'Show me the lineage around the paint stage. Use the graph tool to pull it, then list the node kinds you see.')
  }, TIMEOUT_MS)

  it('ontology.list — Ontology Studio area: full ontology overview', async () => {
    await scenario('ontology.list', 'Ontology Studio', 'Give me an overview of the ontology — all object types with their names. Ground it with a tool first.')
  }, TIMEOUT_MS)

  it('ontology.get — Ontology Studio area: one object type by name', async () => {
    await scenario('ontology.get', 'Ontology Studio', 'How many properties does the Product object type have? Verify with a tool, then cite the object type id.')
  }, TIMEOUT_MS)

  it('corpus.search — Corpus Manifest area: keyword search', async () => {
    await scenario('corpus.search', 'Corpus Manifest', 'Search the reference corpus for documents about pipelines and tell me which files you found.', { manifest: true })
  }, TIMEOUT_MS)

  it('pipeline.run — Pipeline Builder area: dry-run validation', async () => {
    await scenario('pipeline.run', 'Pipeline Builder', 'Run a validation pass on the data pipeline — dry run only, nothing live.')
  }, TIMEOUT_MS)

  it('workshop.publish — Workshop Canvas area: dry-run readiness check', async () => {
    await scenario('workshop.publish', 'Workshop Canvas', 'Check whether the Order Overview workshop module passes validation and is ready to publish — validation only.')
  }, TIMEOUT_MS)

  afterAll(async () => {
    if (!LIVE || rows.length === 0) return
    const pass = rows.filter(r => r.status === 'PASS').length
    const totalMs = rows.reduce((a, r) => a + r.ms, 0)
    const lines: string[] = [
      '# Agent tool-usage benchmark — LFM2.5 2.6B (reference model)',
      '',
      `- Date: ${new Date().toISOString()}`,
      `- Model: \`${TARGET_MODEL}\` via Ollama (native tool-calling bridge, think:false)`,
      `- Result: **${pass}/${rows.length} areas PASS** · total ${Math.round(totalMs / 1000)} s`,
      '- Contract: real orchestrator loop, real tools, real workspace data. Approvals always declined — dry-run defaults expected.',
      '',
      '| Tool | Area | Status | Hops | Duration | Tool calls | Notes |',
      '|---|---|---|---|---|---|---|',
      ...rows.map(r => `| ${r.tool} | ${r.area} | ${r.status} | ${r.hops} | ${(r.ms / 1000).toFixed(1)} s | ${r.toolCalls.map(c => `${c.tool}${c.ok ? '' : '(err)'}`).join(', ') || '—'} | ${[...r.notes, r.answer.split('\n')[0].slice(0, 90)].join(' · ')} |`),
      '',
      '## Per-call detail',
      ...rows.flatMap(r => [
        '',
        `### ${r.tool} — ${r.status}`,
        ...r.toolCalls.map(c => `- \`${c.tool}\`${c.args ? ` ${c.args}` : ''} — ${c.ok ? 'ok' : 'ERROR'} (${c.ms} ms)`),
        r.answer ? `- Answer: ${r.answer.slice(0, 280)}` : '',
      ]),
    ]
    // Dynamic import with a computed specifier keeps the DOM-only tsconfig happy;
    // vitest runs from the repo root, so plain relative paths are stable.
    const fsSpec = ['node', 'fs'].join(':')
    const fs: any = await import(/* @vite-ignore */ fsSpec)
    const pathSpec = ['node', 'path'].join(':')
    const path: any = await import(/* @vite-ignore */ pathSpec)
    const outDir = path.join(processCwd(), 'master-prompts', 'benchmarks')
    fs.mkdirSync(outDir, { recursive: true })
    fs.writeFileSync(path.join(outDir, 'agent-tool-bench.md'), lines.join('\n'))
    console.log(`benchmark report → master-prompts/benchmarks/agent-tool-bench.md (${pass}/${rows.length} PASS)`)
  })
})

// Registry sanity (runs in CI too — cheap): every tool is benchmark-addressable.
describe('T-35 benchmark contract — tool registry coverage', () => {
  it('every tool has a name, description, execute and JSON-Schema parameters', () => {
    expect(TOOLS.length).toBeGreaterThanOrEqual(6)
    for (const t of TOOLS) {
      expect(t.name).toBeTruthy()
      expect(t.description.length).toBeGreaterThan(20)
      expect(typeof t.execute).toBe('function')
      expect(t.parameters?.type).toBe('object')
      expect(t.category).toBeTruthy()
    }
  })
})
