import { useCallback, useEffect, useRef, useState } from 'react'
import { ReactFlow, Background, Controls, Handle, Position, useNodesState, useEdgesState, type Node, type Edge } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Icon } from '../components/Icon'
import { loadSettings, providerById, llmChat } from '../llm/client'
import { appendTrace, consumeFocus, ws, patchMeta } from '../store'
import { createJob } from '../jobs'

type SwarmTemplate = { id: string; name: string; desc: string; workers: string[]; tools: string[]; cost: string; outcome: string }

const TEMPLATES: SwarmTemplate[] = [
  { id: 'sw-1', name: 'Dataset Triage', desc: 'Profile, type-check and dedup an incoming dataset; flag schema drift against the ontology.', workers: ['Profiler', 'Type Checker', 'Deduper'], tools: ['corpus.search', 'graph.query'], cost: '~18k tokens', outcome: 'Triage report + ontology alignment notes' },
  { id: 'sw-2', name: 'Lineage Audit', desc: 'Walk an object type’s upstream graph; verify hashes, permissions and freshness end-to-end.', workers: ['Graph Walker', 'Hash Verifier', 'Freshness SLA'], tools: ['graph.query'], cost: '~24k tokens', outcome: 'Audit table · pass/fail per relation' },
  { id: 'sw-3', name: 'Data Quality Sweep', desc: 'NULL rates, outliers, distribution shift and constraint violations across clean datasets.', workers: ['Profiler', 'Outlier Scout', 'Constraint Checker'], tools: ['corpus.search'], cost: '~30k tokens', outcome: 'DQ scorecard + failing checks' },
  { id: 'sw-4', name: 'Workshop Module Review', desc: 'Static review of a Workshop module: widget bindings, object sets, layout, publish blockers.', workers: ['Binding Checker', 'Layout Auditor', 'A11y Scout'], tools: ['corpus.search'], cost: '~15k tokens', outcome: 'Review verdict + blocking fixes' },
  { id: 'sw-5', name: 'AIP Logic Draft', desc: 'Draft an AIP Logic function from a spec: retrieval, prompt, output schema, test cases.', workers: ['Prompt Smith', 'Schema Designer', 'Test Author'], tools: ['aip.preview'], cost: '~12k tokens', outcome: 'Runnable Logic draft + eval set' },
  { id: 'sw-6', name: 'Executive Summary', desc: 'Compress a week of swarm runs, jobs and lineage changes into a one-page brief.', workers: ['Synthesizer', 'Fact Checker'], tools: ['corpus.search'], cost: '~8k tokens', outcome: 'Briefing PDF-ready markdown' },
]

const tplNodes = (t: SwarmTemplate): Node[] => {
  const positions = [{ x: 40, y: 160 }, { x: 300, y: 40 }, { x: 300, y: 160 }, { x: 300, y: 280 }, { x: 560, y: 160 }]
  const nodes: Node[] = [
    { id: 'orch', position: positions[0], type: 'glass', data: { label: '🧠 Orchestrator', sub: `${t.name} · plan → delegate → verify` } },
    ...t.workers.slice(0, 3).map((w, i) => ({ id: `w${i}`, position: positions[i + 1], type: 'glass', data: { label: `🤖 ${w}`, sub: t.tools[i % t.tools.length] ?? 'tools' } })),
    ...(t.workers.length > 3 ? [{ id: 'w3', position: positions[4], type: 'glass' as const, data: { label: `🤖 ${t.workers[3]}`, sub: t.tools[0] } }] : []),
    { id: 'verify', position: { x: 580, y: 60 }, type: 'glass', data: { label: '✅ Verifier', sub: 'verify → report' } },
  ]
  return nodes
}
const tplEdges = (t: SwarmTemplate): Edge[] =>
  t.workers.slice(0, 3).flatMap((_, i) => [
    { id: `e-orch-w${i}`, source: 'orch', target: `w${i}`, style: { stroke: '#15803d', strokeWidth: 2, opacity: .8 }, animated: true },
    { id: `e-w${i}-v`, source: `w${i}`, target: 'verify', style: { stroke: '#15803d', strokeDasharray: '5 4', opacity: .6 } },
  ])

function GlassNode({ data, selected }: any) {
  return (
    <div className={`gnode ${selected ? 'selected pulse' : ''}`} style={{ minWidth: 150 }}>
      <Handle type="target" position={Position.Left} />
      <div>{data.label}<small>{data.sub}</small></div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
const nodeTypes = { glass: GlassNode }

const SNAP: Record<string, string> = {
  Profiler: 'Compute row count, column types, null %, distinct count for every column.',
  'Type Checker': 'Verify every column matches the intended value type; list coercions needed.',
  Deduper: 'Find likely duplicate rows/keys; estimate duplicate rate and join keys.',
  'Graph Walker': 'Trace upstream lineage from the target object to raw sources; list edges traversed.',
  'Hash Verifier': 'Re-compute dataset hashes; flag stale or mismatched artifacts.',
  'Freshness SLA': 'Check last-updated timestamps vs SLAs; flag breaches.',
  'Outlier Scout': 'Detect outliers via IQR per numeric column; list worst offenders.',
  'Constraint Checker': 'Validate NOT NULL / uniqueness / FK constraints; count violations.',
  'Binding Checker': 'Check every widget binding resolves to a real object set / property.',
  'Layout Auditor': 'Audit sections, row heights, and fill-space usage for layout debt.',
  'A11y Scout': 'Check contrast, keyboard access and labelling of the module.',
  'Prompt Smith': 'Draft the system prompt for the logic function.',
  'Schema Designer': 'Design the output schema (typed fields + citations).',
  'Test Author': 'Write 3 eval prompts + expected properties.',
  Synthesizer: 'Compress runs and jobs into a one-page brief.',
  'Fact Checker': 'Verify every claim against the ledger; strike unverifiable ones.',
}

export default function SwarmsModule() {
  const [template, setTemplate] = useState<SwarmTemplate>(TEMPLATES[0])
  const [nodes, setNodes, onNodesChange] = useNodesState(tplNodes(TEMPLATES[0]))
  const [edges, setEdges] = useEdgesState(tplEdges(TEMPLATES[0]))
  const [running, setRunning] = useState<'idle' | 'running' | 'paused' | 'done'>('idle')
  const [log, setLog] = useState<string[]>(['[idle] swarm not started — pick a template and press Launch'])
  const [tokens, setTokens] = useState(0)
  const [liveMode, setLiveMode] = useState(false)
  const [budget, setBudget] = useState<number>(() => Number(ws.meta?.swarmBudget ?? 30000))
  const [showHistory, setShowHistory] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  const historyCount = () => new Set((ws.traces as any[]).filter(t => t.runId).map(t => t.runId)).size
  const runHistory = () => {
    const map = new Map<string, { runId: string; runName: string; calls: number; tokens: number; ms: number; failed: number; steps: any[] }>()
    for (const t of ws.traces as any[]) {
      if (t.kind !== 'swarm-worker' || !t.runId) continue
      const cur: { runId: string; runName: string; calls: number; tokens: number; ms: number; failed: number; steps: any[] } = map.get(t.runId) ?? { runId: t.runId, runName: t.runName || 'unknown run', calls: 0, tokens: 0, ms: 0, failed: 0, steps: [] }
      cur.calls += 1
      cur.tokens += (t.tokensIn ?? 0) + (t.tokensOut ?? 0)
      cur.ms += t.ms ?? 0
      if (!t.ok) cur.failed += 1
      cur.steps.push(t)
      map.set(t.runId, cur)
    }
    return [...map.values()].sort((a, b) => b.ms - a.ms)
  }
  const exportRun = (r: any) => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ runId: r.runId, runName: r.runName, steps: r.steps }, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a'); a.href = url; a.download = `${r.runId}.ohtrace.json`; a.click(); URL.revokeObjectURL(url)
  }

  const pauseRef = useRef(false)
  const cursorRef = useRef(0)
  const findingsRef = useRef<string[]>([])
  const spentRef = useRef(0)
  const runIdRef = useRef('')
  const settings = loadSettings()
  const spec = providerById(settings.providerId)
  const liveReady = spec.requiresKey ? settings.hasKey : true
  const effectiveLive = liveMode && liveReady

  const selectTemplate = (t: SwarmTemplate) => {
    setTemplate(t)
    setNodes(tplNodes(t)); setEdges(tplEdges(t))
    setRunning('idle'); setTokens(0); cursorRef.current = 0; pauseRef.current = false; findingsRef.current = []
    setLog([`[template] ${t.name} loaded — ${t.workers.length} workers · ${t.cost} est.`])
  }

  const runSimulated = useCallback(() => {
    const rid = runIdRef.current
    const steps = [
      `[plan] decomposed into ${template.workers.length} worker tasks · DAG validated`,
      ...template.workers.map(w => `[worker:${w}] ✓ complete (simulated)`),
      '[verify] cross-check passed · 0 contradictions · manifest updated',
    ]
    let i = 0
    const timer = window.setInterval(() => {
      if (pauseRef.current) { window.clearInterval(timer); setRunning('paused'); setLog(l => [...l, '[pause] swarm paused — resume to continue']); return }
      i += 1
      const simTokens = 900 + Math.floor(Math.random() * 1400)
      spentRef.current += simTokens
      const workerIdx = Math.min(i - 1, template.workers.length - 1)
      if (i >= 1 && i <= template.workers.length) {
        appendTrace({ kind: 'swarm-worker', worker: template.workers[workerIdx], provider: 'simulated', model: 'simulated', taskClass: 'extraction', ok: true, ms: 10, tokensOut: simTokens, runId: rid, runName: template.name, stepIdx: i })
      }
      setTokens(t => t + simTokens)
      if (i <= steps.length) {
        setLog(l => [...l, steps[i - 1]])
      } else {
        window.clearInterval(timer)
        setRunning('done')
        setLog(l => [...l, `[done] ${template.name} complete · [offline] simulated`])
        const job = createJob({ title: `Swarm: ${template.name}`, source: `Agentic Swarms · ${template.workers.length} workers (simulated)`, tags: ['swarm'], status: 'review', activity: [{ at: 'now', text: `Swarm finished · ${template.cost}` }] as any, attachments: [{ kind: 'trace', id: `trace-${Date.now().toString(36)}`, label: `${template.name} run · simulated`, addedAt: new Date().toISOString() }] })
        setLog(l => [...l, `[job] analyst job ${job.id} opened for review`])
      }
    }, 600)
    return timer
  }, [template])

  const runLive = useCallback(async () => {
    const t = template
    setLog(l => [...l, `[live] provider: ${spec.label} · model: ${settings.model} · ${t.workers.length} worker calls`])
    const plan = t.workers.map((w, i) => ({ w, i, prompt: `You are ${w}, a specialist agent on the "${t.name}" swarm.\nObjective: ${t.desc}\nYour task: ${SNAP[w] ?? 'Apply your specialty to the objective.'}\nReply with compact JSON only, shape: {"worker":"${w}","findings":["…"],"confidence":0.0-1.0}` }))

    let i = cursorRef.current
    for (; i < plan.length; i++) {
      if (pauseRef.current) { setRunning('paused'); cursorRef.current = i; setLog(l => [...l, `[pause] checkpointed before ${plan[i].w} — resume to continue`]); return }
      if (spentRef.current >= budget) {
        setRunning('idle')
        setLog(l => [...l, `[budget] halt — budget_exhausted · ${spentRef.current.toLocaleString()}/${budget.toLocaleString()} tokens`])
        return
      }
      const { w, prompt } = plan[i]
      const started = performance.now()
      setLog(l => [...l, `[worker:${w}] started…`])
      try {
        const reply = await llmChat(settings, [{ role: 'user', content: prompt }], 'extraction')
        const ms = Math.round(performance.now() - started)
        setTokens(tk => tk + Math.ceil(reply.length / 4))
        const estTokens = Math.ceil((prompt.length + reply.length) / 4)
        spentRef.current += estTokens
        appendTrace({ kind: 'swarm-worker', worker: w, provider: spec.id, model: settings.model, taskClass: 'extraction', ok: true, ms, tokensOut: Math.ceil(reply.length / 4), tokensIn: Math.ceil(prompt.length / 4), runId: runIdRef.current, runName: t.name, stepIdx: i + 1 })
        cursorRef.current = i + 1
        let findings = reply
        try { findings = (JSON.parse(reply.match(/\{[\s\S]*\}/)?.[0] ?? reply).findings ?? []).join(' · ') } catch { /* prose reply */ }
        findingsRef.current.push(`${w}: ${String(findings).slice(0, 300)}`)
        setLog(l => [...l, `[worker:${w}] ✓ ${ms}ms — ${String(findings).slice(0, 110)}`])
      } catch (e) {
        const ms = Math.round(performance.now() - started)
        appendTrace({ kind: 'swarm-worker', worker: w, provider: spec.id, model: settings.model, taskClass: 'extraction', ok: false, ms, detail: String(e).slice(0, 160), runId: runIdRef.current, runName: t.name, stepIdx: i + 1 })
        setLog(l => [...l, `[worker:${w}] ✗ ${String(e).slice(0, 160)} — continuing`])
      }
    }

    if (pauseRef.current) { setRunning('paused'); return }
    cursorRef.current = plan.length
    setLog(l => [...l, '[verify] orchestrator synthesising…'])
    try {
      const context = findingsRef.current.length
        ? `Worker findings:\n${findingsRef.current.map(f => `- ${f}`).join('\n')}`
        : `Worker reports for the "${template.name}" swarm (no structured findings captured).`
      const summary = await llmChat(settings, [{ role: 'user', content: `${context}\n\nSynthesise in 3 terse bullet lines: what's true, what's flagged, what to do next.` }], 'reasoning')
      setLog(l => [...l, `[summary] ${summary.slice(0, 300)}`])
    } catch (e) {
      setLog(l => [...l, `[summary] provider error: ${String(e).slice(0, 120)}`])
    }
    setRunning('done')
    const job = createJob({ title: `Swarm: ${template.name}`, source: `Agentic Swarms · LIVE · ${template.workers.length} workers · ${spec.label}`, tags: ['swarm', 'live'], status: 'review', activity: [{ at: 'now', text: `Live swarm finished on ${spec.label}` }] as any, attachments: [{ kind: 'trace', id: `trace-${Date.now().toString(36)}`, label: `${template.name} run · LIVE on ${spec.label}`, addedAt: new Date().toISOString() }] })
    setLog(l => [...l, `[job] analyst job ${job.id} opened for review`])
  }, [template, settings, spec])

  const launch = () => {
    if (running === 'running') return
    pauseRef.current = false
    if (cursorRef.current >= template.workers.length) { cursorRef.current = 0; findingsRef.current = [] }
    runIdRef.current = `run-${Date.now().toString(36)}`
    spentRef.current = 0
    setRunning('running'); setTokens(0)
    setLog(l => [...l, `[launch] orchestrator initialised · objective: ${template.name} · mode: ${effectiveLive ? 'LIVE' : 'OFFLINE (simulated)'}`])
    if (effectiveLive) {
      runLive().catch(e => { setRunning('idle'); setLog(l => [...l, `[abort] ${String(e).slice(0, 200)}`]) })
    } else {
      runSimulated()
    }
  }

  const pause = () => {
    if (running !== 'running') return
    pauseRef.current = true
    if (!effectiveLive) setLog(l => [...l, '[pause] will halt after current step'])
  }
  const resume = () => {
    if (running !== 'paused') return
    pauseRef.current = false
    setRunning('running')
    setLog(l => [...l, '[resume] continuing from checkpoint'])
    if (effectiveLive) runLive().catch(e => setLog(l => [...l, `[abort] ${String(e).slice(0, 160)}`]))
  }
  const stop = () => { pauseRef.current = true; cursorRef.current = 0; setRunning('idle'); setLog(l => [...l, '[abort] swarm stopped by operator · artifacts kept to ledger']) }

  // Deep-link entry from Graph action bar ("Send to Swarm").
  useEffect(() => {
    const ref = consumeFocus('swarms')
    if (ref) {
      const t = TEMPLATES.find(x => x.id === ref || x.name === ref)
      if (t) selectTemplate(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => () => { pauseRef.current = true }, [])

  return (
    <div className="module fade-in">
      <div className="module-head glass-strong">
        <div>
          <div className="module-title"><Icon name="graph" size={18} /> Agentic Swarms — Orchestration Control Room</div>
          <div className="module-sub">Dry runs by default · verify before publish · every run opens an analyst job</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="chip">{effectiveLive ? `● live · ${spec.label}` : '○ offline'}</span>
          {liveReady && (
            <label className="env-row" style={{ cursor: 'pointer', userSelect: 'none' }} title="Real worker LLM calls (spends tokens)">
              <input type="checkbox" checked={liveMode} onChange={e => setLiveMode(e.target.checked)} /> LIVE
            </label>
          )}
          {running === 'running' ? <button className="btn" onClick={pause}>❚❚ Pause</button> : running === 'paused' ? <button className="btn" onClick={resume}>▶ Resume</button> : null}
          <label className="env-row" style={{ gap: 6 }} title="Per-run token budget (hard stop)">
            budget
            <input type="number" className="mini-select" style={{ width: 76 }} value={budget} min={1000} step={1000} onChange={e => { const v = Number(e.target.value) || 30000; setBudget(v); patchMeta({ swarmBudget: v }) }} />
          </label>
          <button className="btn" onClick={() => setShowHistory(true)}><Icon name="doc" size={13} /> Run history <span className="chip chip-mono" style={{ fontSize: 9 }}>{historyCount()}</span></button>
          <button className="btn btn-primary" onClick={launch} disabled={running === 'running'}><Icon name="spark" size={13} /> Launch swarm</button>
          {running !== 'idle' && <button className="btn btn-danger" onClick={stop}><Icon name="x" size={13} /> Stop</button>}
        </div>
      </div>

      <div className="module-body">
        <div className="glass panel" style={{ width: 265, flexShrink: 0, overflow: 'auto' }}>
          <div className="panel-title">Swarm templates <span className="chip">{TEMPLATES.length}</span></div>
          {TEMPLATES.map(t => (
            <button key={t.id} className={`preset-mini ${template.id === t.id ? 'active' : ''}`} onClick={() => selectTemplate(t)}>
              <strong>{t.name}</strong>
              <small>{t.desc}</small>
              <span className="chip-mono" style={{ fontSize: 9, color: 'var(--text-dim)' }}>{t.cost} · {t.workers.length} workers</span>
            </button>
          ))}
        </div>

        <div className="graph-wrap glass" style={{ flex: 1.3 }}>
          <ReactFlow key={template.id} nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} fitView fitViewOptions={{ padding: 0.2 }} minZoom={0.5} maxZoom={1.4} nodesConnectable={false}>
            <Background color="rgba(110,231,183,.25)" gap={20} size={1.2} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>

        <div className="glass panel" style={{ width: 330, display: 'flex', flexDirection: 'column', minWidth: 260 }}>
          <div className="panel-title">Live trace <span className="chip chip-mono">{running}</span></div>
          <div className="swarm-log">{log.map((l, i) => <div key={i}>{l}</div>)}</div>
          <div className="label">Token meter</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color: 'var(--green-700)' }}>{tokens.toLocaleString()}</div>
          <div className="meter"><div className="meter-fill" style={{ width: `${Math.min(100, (tokens / 30000) * 100)}%` }} /></div>
          <div className="module-sub" style={{ marginTop: 4 }}>{template.outcome}</div>
        </div>
      </div>

      {/* ── Run history (ledger replay, zero network) ─────────── */}
      {showHistory && (
        <div className="palette-overlay" onMouseDown={() => setShowHistory(false)}>
          <div className="glass-strong fade-in" style={{ width: 640, maxWidth: '94vw', maxHeight: '75vh', overflow: 'auto', padding: 16, borderRadius: 'var(--r-md)' }} onMouseDown={e => e.stopPropagation()}>
            <div className="module-title" style={{ fontSize: 14, justifyContent: 'space-between' }}>
              <span>Run history — ledger replay</span>
              <button className="btn btn-ghost" onClick={() => setShowHistory(false)}><Icon name="x" size={14} /></button>
            </div>
            {runHistory().length === 0 && <div className="module-sub" style={{ marginTop: 8 }}>No swarm runs recorded yet. Launch one (offline or live) to populate the ledger.</div>}
            {runHistory().map(r => (
              <div key={r.runId} className="trace-step" style={{ alignItems: 'flex-start', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                  <strong>{r.runName}</strong>
                  <span className="chip chip-mono" style={{ fontSize: 8 }}>{r.runId}</span>
                  <span className={r.failed ? 'chip chip-mono' : 'chip'} style={r.failed ? { background: 'rgba(220,38,38,.12)', color: '#b91c1c', borderColor: 'rgba(220,38,38,.4)' } : {}}>{r.failed ? `${r.failed} failed` : '✓ ok'}</span>
                  <span className="module-sub">{r.calls} calls · {r.tokens.toLocaleString()} tok · {(r.ms / 1000).toFixed(1)}s</span>
                  <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                    <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 10 }} onClick={() => setExpanded(expanded === r.runId ? null : r.runId)}>{expanded === r.runId ? 'Hide' : 'Replay'}</button>
                    <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 10 }} onClick={() => exportRun(r)}>.ohtrace</button>
                  </span>
                </div>
                {expanded === r.runId && (
                  <div style={{ width: '100%', marginTop: 6, borderTop: '1px solid rgba(34,197,94,.2)', paddingTop: 6 }}>
                    {r.steps.sort((a, b) => (a.stepIdx ?? 0) - (b.stepIdx ?? 0)).map((s: any, i: number) => (
                      <div key={i} className="module-sub" style={{ fontFamily: 'var(--font-mono)', fontSize: 9, padding: '1px 0' }}>
                        [{s.stepIdx}] {s.worker} · {s.ok ? 'ok' : 'FAIL'} · {s.ms}ms · {(s.tokensIn ?? 0) + (s.tokensOut ?? 0)} tok · {s.detail ? String(s.detail).slice(0, 80) : (s.model ?? '')}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
