import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import { PROVIDERS } from '../llm/client'
import { workerStats, ws, setWorkers } from '../store'

type Worker = {
  id: string; name: string; role: string; model: string; provider: string
  tools: string[]; status: 'idle' | 'working' | 'error'
  stats: { runs: number; success: number; latencyMs: number; costUsd: number }
}

const SEED: Worker[] = [
  { id: 'wk-1', name: 'Scribe', role: 'Documentation & summarization', model: 'claude-haiku-4-5', provider: 'anthropic', tools: ['corpus.search'], status: 'idle', stats: { runs: 412, success: 98.1, latencyMs: 640, costUsd: 3.2 } },
  { id: 'wk-2', name: 'Watchman', role: 'Lineage & freshness SLA monitor', model: 'gpt-4o-mini', provider: 'openai', tools: ['graph.query'], status: 'working', stats: { runs: 1204, success: 99.4, latencyMs: 380, costUsd: 9.7 } },
  { id: 'wk-3', name: 'Forge', role: 'Pipeline & transform authoring', model: 'qwen2.5-coder-32b', provider: 'ollama', tools: ['pipeline.run'], status: 'idle', stats: { runs: 287, success: 94.3, latencyMs: 1500, costUsd: 0 } },
  { id: 'wk-4', name: 'Sage', role: 'Ontology alignment & value types', model: 'claude-sonnet-4-5', provider: 'anthropic', tools: ['ontology.get', 'ontology.update'], status: 'idle', stats: { runs: 158, success: 96.8, latencyMs: 840, costUsd: 6.1 } },
  { id: 'wk-5', name: 'Sentinel', role: 'Data quality & constraint sweeps', model: 'llama-3.3-70b-versatile', provider: 'groq', tools: ['corpus.search'], status: 'error', stats: { runs: 733, success: 91.2, latencyMs: 290, costUsd: 2.4 } },
  { id: 'wk-6', name: 'Herald', role: 'Stakeholder briefings & exec summaries', model: 'gemini-2.0-flash', provider: 'gemini', tools: ['corpus.search'], status: 'idle', stats: { runs: 96, success: 97.9, latencyMs: 510, costUsd: 0.8 } },
]

const STATUS: Record<Worker['status'], { label: string; cls: string }> = {
  idle: { label: 'idle', cls: 'dot-green' },
  working: { label: 'working', cls: 'dot-lime' },
  error: { label: 'error', cls: 'dot-red' },
}

export default function WorkersModule() {
  const [workers, setWorkersState] = useState(() => (ws.workers && ws.workers.length ? ws.workers : SEED))
  useEffect(() => { setWorkers(workers) }, [workers])
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState({ name: '', role: '', model: PROVIDERS[0].defaultModel, provider: 'openai', tools: 'corpus.search' })
  // Prefer real numbers from the trace ledger when at least one live swarm has run.
  const merged: (Worker & { liveStats: boolean })[] = useMemo(() => workers.map((w: any) => {
    const live = workerStats(w.name)
    return live ? { ...w, stats: { runs: live.runs, success: live.success, latencyMs: live.latencyMs, costUsd: w.stats?.costUsd ?? 0 }, liveStats: true } : { ...w, liveStats: false }
  }), [workers, ws.traces.length])

  const addWorker = () => {
    if (!draft.name.trim()) return
    setWorkersState(prev => [...prev, {
      id: `wk-${Date.now().toString(36)}`, name: draft.name.trim(), role: draft.role.trim() || 'General-purpose worker',
      model: draft.model, provider: draft.provider,
      tools: draft.tools.split(',').map(s => s.trim()).filter(Boolean),
      status: 'idle', stats: { runs: 0, success: 100, latencyMs: 0, costUsd: 0 },
    }])
    setAdding(false); setDraft({ name: '', role: '', model: PROVIDERS[0].defaultModel, provider: 'openai', tools: 'corpus.search' })
  }

  return (
    <div className="module fade-in">
      <div className="module-head glass-strong">
        <div>
          <div className="module-title"><Icon name="users" size={18} /> AI Workers — Dedicated Crew</div>
          <div className="module-sub">{workers.length} workers · models bound per role · stats over 30 days · local definitions</div>
        </div>
        <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={() => setAdding(v => !v)}><Icon name="plus" size={13} /> New worker</button>
      </div>

      {adding && (
        <div className="glass-strong fade-in" style={{ padding: 12, borderRadius: 'var(--r-md)', display: 'grid', gridTemplateColumns: '1.2fr 1.6fr 1fr 1fr 1.2fr auto', gap: 8, alignItems: 'end' }}>
          <div><div className="label">Name</div><input className="input" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Cartographer" autoFocus /></div>
          <div><div className="label">Role</div><input className="input" value={draft.role} onChange={e => setDraft({ ...draft, role: e.target.value })} placeholder="Ontology mapping specialist" /></div>
          <div><div className="label">Provider</div><select className="input" value={draft.provider} onChange={e => setDraft({ ...draft, provider: e.target.value })}>{PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select></div>
          <div><div className="label">Model</div><input className="input" value={draft.model} onChange={e => setDraft({ ...draft, model: e.target.value })} /></div>
          <div><div className="label">Tools (comma sep)</div><input className="input" value={draft.tools} onChange={e => setDraft({ ...draft, tools: e.target.value })} /></div>
          <button className="btn btn-primary" onClick={addWorker}><Icon name="check" size={13} /> Add</button>
        </div>
      )}

      <div className="worker-grid">
        {merged.map(w => (
          <div key={w.id} className="glass wcard">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="wcard-avatar">{w.name.slice(0, 2).toUpperCase()}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 13 }}>{w.name}</div>
                <div className="module-sub" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.role}</div>
              </div>
              <span className="env-row" style={{ marginLeft: 'auto' }}><span className={`dot ${STATUS[w.status].cls}`} />{STATUS[w.status].label}</span>
            </div>
            <div className="wcard-model">{w.provider} · <code>{w.model}</code>{(w as any).liveStats && <span className="chip" style={{ marginLeft: 6, fontSize: 8 }}>● live stats</span>}</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', margin: '6px 0' }}>{w.tools.map(t => <span key={t} className="chip chip-mono" style={{ fontSize: 9 }}>{t}</span>)}</div>
            <div className="wcard-stats">
              <div><strong>{w.stats.runs.toLocaleString()}</strong><small>runs</small></div>
              <div><strong>{w.stats.success}%</strong><small>success</small></div>
              <div><strong>{w.stats.latencyMs}ms</strong><small>avg latency</small></div>
              <div><strong>${w.stats.costUsd.toFixed(2)}</strong><small>30d cost</small></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
