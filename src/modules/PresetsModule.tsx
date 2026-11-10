import { useMemo, useState } from 'react'
import { Icon, type IconName } from '../components/Icon'
import { PRESET_SEED, validatePreset, composePrompt, applyPromptTemplate, findPromptTemplate, readPromptGalleryState, PROMPT_GALLERY_META_KEY, PROMPT_TEMPLATES, type Preset, type PromptTemplate } from '../data/presets'
import { ws, patchMeta, appendTrace, appendAudit } from '../store'
import { enabledPackPresets } from '../packs/consume'
import { loadSettings } from '../llm/client'
import { runAgent, type AgentStep } from '../agent/orchestrator'
import { createJob } from '../jobs'

type RunState = { phase: 'idle' | 'running' | 'done' | 'error'; output?: string; steps: AgentStep[]; jobId?: string; error?: string }

const FORK_KEY = 'presetForks'
const forkStore = (): Preset[] => ((ws.meta?.[FORK_KEY] as Preset[]) ?? [])

export default function PresetsModule() {
  const [forks, setForks] = useState<Preset[]>(() => forkStore())
  const [sort, setSort] = useState<'default' | 'most-used' | 'highest-success'>('default')
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameTo, setRenameTo] = useState('')
  const [chosenDataset, setChosenDataset] = useState<Record<string, string>>({})
  const [questions, setQuestions] = useState<Record<string, string>>({})
  const [runs, setRuns] = useState<Record<string, RunState>>({})
  // FN-FDE-012 Prompt Template Gallery — active preset + last Apply, persisted in ws.meta.
  const [activePresetId, setActivePresetId] = useState<string>(() => readPromptGalleryState(ws.meta).activePresetId ?? PRESET_SEED[0].id)
  const [lastApplied, setLastApplied] = useState<{ templateId: string; presetId: string; appliedPresetId: string } | null>(() => {
    const g = readPromptGalleryState(ws.meta)
    return g.lastTemplateId && g.lastAppliedPresetId ? { templateId: g.lastTemplateId, presetId: g.activePresetId ?? PRESET_SEED[0].id, appliedPresetId: g.lastAppliedPresetId } : null
  })

  const settings = useMemo(() => loadSettings(), [])

  const presets = useMemo(() => {
    // T-36: enabled packs (bundled AND custom-installed) contribute presets.
    return [...PRESET_SEED, ...forks, ...enabledPackPresets()]
  }, [forks])

  /** Live stats aggregated from the trace ledger, grouped by preset. */
  const stats = useMemo(() => {
    const m = new Map<string, { runs: number; ok: number; ms: number; tokens: number }>()
    for (const t of ws.traces as any[]) {
      if (t.kind !== 'preset-run' || !t.detail) continue
      const id = String(t.detail).split('·')[0].trim()
      const s = m.get(id) ?? { runs: 0, ok: 0, ms: 0, tokens: 0 }
      s.runs += 1
      if (t.ok) s.ok += 1
      s.ms += t.ms ?? 0
      s.tokens += (t.tokensOut ?? 0)
      m.set(id, s)
    }
    return m
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws.traces.length, runs])

  const sorted = useMemo(() => {
    const arr = [...presets]
    if (sort === 'most-used') arr.sort((a, b) => (stats.get(b.id)?.runs ?? 0) - (stats.get(a.id)?.runs ?? 0))
    if (sort === 'highest-success') arr.sort((a, b) => {
      const sa = stats.get(a.id), sb = stats.get(b.id)
      return (sb?.runs ? sb.ok / sb.runs : 0) - (sa?.runs ? sa.ok / sa.runs : 0)
    })
    return arr
  }, [presets, sort, stats])

  const setForksPersist = (next: Preset[]) => { setForks(next); patchMeta({ [FORK_KEY]: next }) }

  const run = async (p: Preset) => {
    if (runs[p.id]?.phase === 'running') return
    setRuns(r => ({ ...r, [p.id]: { phase: 'running', steps: [] } }))

    const t0 = performance.now()
    const ds = p.needsInput === 'dataset' ? ws.datasets.find((d: any) => d.id === chosenDataset[p.id]) : undefined
    const datasetJson = ds ? JSON.stringify({ name: ds.name, hash: ds.hash, columns: ds.columns.map((c: any) => c.name), sample: ds.rows?.slice(0, 8) }) : undefined
    const question = questions[p.id]?.trim() || p.userTemplate.replace(/\{\{(DATASET|QUESTION)\}\}/g, '').trim()
    const composed = composePrompt(p, datasetJson, question)

    try {
      const result = await runAgent(composed.user, {
        settings: { ...settings, systemPrompt: composed.system },
        onStep: s => setRuns(r => ({ ...r, [p.id]: { ...(r[p.id] ?? { phase: 'running', steps: [] }), phase: 'running', steps: [...(r[p.id]?.steps ?? []), s] } })),
      })
      const ms = Math.round(performance.now() - t0)
      appendTrace({ kind: 'preset-run', provider: settings.providerId, model: settings.model, taskClass: 'reasoning', ok: true, ms, tokensOut: Math.ceil(result.answer.length / 4), detail: `${p.id} · ${p.name}` })
      const job = createJob({
        title: p.name, source: `Preset · ${p.name}`, tags: ['preset'], status: 'review',
        attachments: ds ? [{ kind: 'dataset', id: ds.id, label: ds.name, hash: ds.hash, addedAt: new Date().toISOString() }] : [],
        activity: [{ at: 'now', text: `Preset completed · ${result.hops} hop(s) · ${result.steps.length} tool call(s)` }] as any,
      })
      setRuns(r => ({ ...r, [p.id]: { phase: 'done', output: result.answer, steps: result.steps, jobId: job.id } }))
    } catch (e) {
      const ms = Math.round(performance.now() - t0)
      appendTrace({ kind: 'preset-run', provider: settings.providerId, model: settings.model, ok: false, ms, detail: `${p.id} · ${String(e).slice(0, 120)}` })
      setRuns(r => ({ ...r, [p.id]: { phase: 'error', steps: r[p.id]?.steps ?? [], error: String(e) } }))
    }
  }

  const fork = (p: Preset) => {
    const f: Preset = { ...p, id: `p-custom-${Date.now().toString(36)}`, name: `${p.name} (copy)`, builtin: false }
    const check = validatePreset(f)
    if (!check.ok) return
    setForksPersist([...forks, f])
  }
  const removeFork = (id: string) => setForksPersist(forks.filter(f => f.id !== id))
  const renameFork = (id: string) => {
    if (!renameTo.trim()) { setRenameId(null); return }
    setForksPersist(forks.map(f => f.id === id ? { ...f, name: renameTo.trim() } : f))
    setRenameId(null)
  }

  const selectActivePreset = (id: string) => {
    setActivePresetId(id)
    patchMeta({ [PROMPT_GALLERY_META_KEY]: { ...readPromptGalleryState(ws.meta), activePresetId: id } })
  }

  /** FN-FDE-012: write the template's prompt into the active preset. Builtins are
      forked (reused on re-apply); forks are updated in place. Persists via
      patchMeta/ws.meta and records appendTrace + appendAudit. */
  const applyTemplate = (template: PromptTemplate) => {
    const target = presets.find(p => p.id === activePresetId) ?? presets[0] ?? PRESET_SEED[0]
    const next = applyPromptTemplate(target, template)
    const check = validatePreset(next)
    if (!check.ok) {
      appendTrace({ kind: 'tool-call', tool: 'prompt-template.apply', ok: false, ms: 0, detail: `${template.id} -> ${target.id} · ${check.errors.join('; ')}` })
      appendAudit({ event: 'prompt-template-apply', templateId: template.id, category: template.category, presetId: target.id, ok: false, errors: check.errors })
      return
    }
    let appliedPresetId: string
    if (target.builtin) {
      const existing = forks.find(f => f.sourcePresetId === target.id && f.promptTemplateId === template.id)
      if (existing) {
        appliedPresetId = existing.id
        setForksPersist(forks.map(f => f.id === existing.id ? { ...f, systemPrompt: next.systemPrompt, userTemplate: next.userTemplate, outputSchema: next.outputSchema } : f))
      } else {
        const forked: Preset = { ...next, id: `p-custom-${Date.now().toString(36)}`, name: `${target.name} · ${template.name}`, builtin: false }
        appliedPresetId = forked.id
        setForksPersist([...forks, forked])
      }
    } else {
      appliedPresetId = target.id
      setForksPersist(forks.map(f => f.id === target.id ? { ...next, name: f.name } : f))
    }
    patchMeta({ [PROMPT_GALLERY_META_KEY]: { activePresetId: target.id, lastTemplateId: template.id, lastAppliedPresetId: appliedPresetId, appliedAt: new Date().toISOString() } })
    setLastApplied({ templateId: template.id, presetId: target.id, appliedPresetId })
    appendTrace({ kind: 'tool-call', tool: 'prompt-template.apply', ok: true, ms: 0, detail: `${template.id} -> ${target.id} (${appliedPresetId})` })
    appendAudit({ event: 'prompt-template-apply', templateId: template.id, category: template.category, presetId: target.id, appliedPresetId })
  }

  const activePreset = presets.find(p => p.id === activePresetId) ?? presets[0] ?? PRESET_SEED[0]
  const appliedTemplate = lastApplied ? findPromptTemplate(lastApplied.templateId) : undefined

  return (
    <div className="module fade-in">
      <div className="module-head glass-strong">
        <div>
          <div className="module-title"><Icon name="layers" size={18} /> Preset Library — Run, Don’t Queue</div>
          <div className="module-sub">Live dispatch through the orchestrator · forks persist · stats from the trace ledger</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="module-sub">Sort</span>
          <select className="input" style={{ width: 150 }} value={sort} onChange={e => setSort(e.target.value as any)}>
            <option value="default">Curated</option>
            <option value="most-used">Most used</option>
            <option value="highest-success">Highest success</option>
          </select>
        </div>
      </div>

      {/* FN-FDE-012 Prompt Template Gallery — 6 cards, glass tokens only */}
      <div data-testid="prompt-template-gallery" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
        <div className="glass-strong" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '10px 13px' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="spark" size={16} /> Prompt Template Gallery
              <span className="chip">{PROMPT_TEMPLATES.length} templates</span>
            </div>
            <div className="module-sub">Apply writes the template into the active preset’s prompt · builtins fork, forks update in place</div>
          </div>
          <label className="module-sub" htmlFor="prompt-gallery-active-preset" style={{ marginLeft: 'auto' }}>Active preset</label>
          <select id="prompt-gallery-active-preset" aria-label="Active preset" className="input" style={{ width: 180 }} value={activePreset.id} onChange={e => selectActivePreset(e.target.value)}>
            {presets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {appliedTemplate && lastApplied && (
            <span className="chip" data-testid="prompt-template-applied" style={{ fontSize: 9 }}>
              Applied {appliedTemplate.name} → {activePreset.name}
            </span>
          )}
        </div>
        <div className="preset-grid" style={{ flex: 'none' }} role="list" aria-label="Prompt templates">
          {PROMPT_TEMPLATES.map(t => (
            <div key={t.id} role="listitem" data-testid={`prompt-template-card-${t.id}`} className="glass preset-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="preset-icon"><Icon name="doc" size={16} /></div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 12.5 }}>{t.name}</div>
                  <span className="chip chip-mono" style={{ fontSize: 8.5 }}>{t.category}</span>
                </div>
              </div>
              <p className="module-sub" style={{ margin: '8px 0', minHeight: 30 }}>{t.desc}</p>
              <div className="glass-faint" style={{ padding: '6px 8px', marginBottom: 8, fontSize: 9.5, maxHeight: 110, overflow: 'auto', fontFamily: 'var(--font-mono)', whiteSpace: 'pre-wrap' }}>
                <div style={{ color: 'var(--text-dim)' }}>SYSTEM · {t.systemPrompt}</div>
                <div style={{ marginTop: 4 }}>USER · {t.userTemplate}</div>
              </div>
              <button
                className="btn btn-primary"
                style={{ justifyContent: 'center', marginTop: 'auto' }}
                aria-label={`Apply ${t.name} template to ${activePreset.name}`}
                data-testid={`prompt-template-apply-${t.id}`}
                onClick={() => applyTemplate(t)}
              >
                <Icon name="arrow" size={12} /> Apply
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="preset-grid">
        {sorted.map(p => {
          const s = stats.get(p.id)
          const st = runs[p.id]
          const live = (s?.runs ?? 0) > 0
          const isFork = !p.builtin
          const dsSelected = chosenDataset[p.id]
          const needsDataset = p.needsInput === 'dataset'
          const datasetMissing = needsDataset && (ws.datasets as any[]).length === 0
          const canRun = st?.phase !== 'running' && !datasetMissing && (!needsDataset || dsSelected) && (needsDataset || true)

          return (
            <div key={p.id} className="glass preset-card" style={st?.phase === 'running' ? { boxShadow: 'var(--green-glow)' } : {}}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="preset-icon"><Icon name={p.icon as IconName} size={17} /></div>
                <div style={{ minWidth: 0 }}>
                  {renameId === p.id ? (
                    <span style={{ display: 'flex', gap: 4 }}>
                      <input className="input" style={{ padding: '2px 6px', fontSize: 11 }} value={renameTo} onChange={e => setRenameTo(e.target.value)} onKeyDown={e => e.key === 'Enter' && renameFork(p.id)} autoFocus />
                      <button className="btn btn-primary" style={{ padding: '2px 8px' }} onClick={() => renameFork(p.id)}><Icon name="check" size={11} /></button>
                    </span>
                  ) : (
                    <div style={{ fontWeight: 800, fontSize: 12.5 }}>{p.name}{isFork && <span className="chip" style={{ marginLeft: 6, fontSize: 8 }}>fork</span>}{live && <span className="chip" style={{ marginLeft: 4, fontSize: 8 }}>{s!.runs} run{s!.runs > 1 ? 's' : ''}</span>}</div>
                  )}
                  <div className="module-sub">worker: {p.workerId.replace('wk-', '')}</div>
                </div>
              </div>
              <p className="module-sub" style={{ margin: '8px 0', minHeight: 30 }}>{p.desc}</p>

              {needsDataset && (
                <select className="input" style={{ fontSize: 10.5, marginBottom: 6 }} value={dsSelected ?? ''} onChange={e => setChosenDataset({ ...chosenDataset, [p.id]: e.target.value })}>
                  <option value="">{datasetMissing ? 'No datasets imported yet — go to Data Hub' : 'Pick a dataset…'}</option>
                  {(ws.datasets as any[]).map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              )}
              {!needsDataset && (
                <textarea className="input" style={{ minHeight: 44, fontSize: 10.5, marginBottom: 6 }} placeholder="Focus / question…" value={questions[p.id] ?? ''} onChange={e => setQuestions({ ...questions, [p.id]: e.target.value })} />
              )}

              {/* Run state */}
              {st && (
                <div className="glass-faint" style={{ padding: '6px 8px', marginBottom: 6, fontSize: 9.5, maxHeight: 110, overflow: 'auto', fontFamily: 'var(--font-mono)' }}>
                  {st.phase === 'running' && <div><span className="pulse-dot" /> running… {st.steps.length} tool call{st.steps.length !== 1 ? 's' : ''}</div>}
                  {st.phase === 'error' && <div style={{ color: '#b91c1c' }}>⚠ {st.error}</div>}
                  {st.phase === 'done' && <div style={{ color: 'var(--green-800)' }}>✓ done · job {st.jobId}<pre style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>{st.output?.slice(0, 400)}{(st.output ?? '').length > 400 ? '…' : ''}</pre></div>}
                </div>
              )}

              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                {p.tools.map(t => <span key={t} className="chip chip-mono" style={{ fontSize: 9 }}>{t}</span>)}
                {s && <span className="chip" style={{ fontSize: 8.5 }}>ok {Math.round((s.ok / Math.max(1, s.runs)) * 100)}% · {(s.ms / Math.max(1, s.runs) / 1000).toFixed(1)}s avg</span>}
              </div>

              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={!canRun} onClick={() => run(p)}>
                  <Icon name="arrow" size={12} /> {st?.phase === 'running' ? 'Running…' : 'Run preset'}
                </button>
                <button className="btn" onClick={() => fork(p)} title="Fork as custom preset"><Icon name="plus" size={12} /></button>
                {isFork && <button className="btn" onClick={() => { setRenameId(p.id); setRenameTo(p.name) }} title="Rename fork"><Icon name="doc" size={12} /></button>}
                {isFork && <button className="btn btn-danger" onClick={() => removeFork(p.id)} title="Delete fork (traces kept)"><Icon name="trash" size={12} /></button>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
