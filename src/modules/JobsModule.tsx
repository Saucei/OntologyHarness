import { useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import { loadJobs, updateJob, createJob, exportJobsJson, STATUS_META, PRIORITY_META, PRIORITY_ORDER, type Job, type JobStatus, type JobAttachment, type JobPriority } from '../jobs'
import { ws, setFocus } from '../store'

const ORDER: JobStatus[] = ['backlog', 'progress', 'review', 'done']
const WIP_LIMIT = 3
const isoDue = (due: string) => {
  const t = Date.parse(due); if (!Number.isNaN(t)) return new Date(t).toISOString().slice(0, 10)
  const t2 = Date.parse(`${due} ${new Date().getFullYear()}`); if (!Number.isNaN(t2)) return new Date(t2).toISOString().slice(0, 10)
  return ''
}

function nextPriority(p?: JobPriority): JobPriority {
  const i = PRIORITY_ORDER.indexOf((p ?? 'normal') as JobPriority)
  return PRIORITY_ORDER[(i + 1) % PRIORITY_ORDER.length]
}

export default function JobsModule() {
  const [jobs, setJobs] = useState<Job[]>(() => loadJobs())
  const [newTitle, setNewTitle] = useState('')
  const [dropCol, setDropCol] = useState<JobStatus | null>(null)
  const [openPop, setOpenPop] = useState<string | null>(null)

  const roster = useMemo(() => ['Unassigned', ...ws.workers?.map((w: any) => w.name) ?? [], 'Berry'].filter((v, i, a) => a.indexOf(v) === i), [])

  const refresh = (next: Job[]) => setJobs(next)
  const move = (job: Job, dir: 1 | -1) => {
    const i = ORDER.indexOf(job.status)
    const nextCol = ORDER[Math.min(ORDER.length - 1, Math.max(0, i + dir))]
    if (nextCol === job.status) return
    refresh(updateJob(job.id, { status: nextCol }, `Moved ${STATUS_META[job.status].label} → ${STATUS_META[nextCol].label}`))
  }
  const dropOn = (jobId: string, col: JobStatus) => {
    const job = jobs.find(j => j.id === jobId)
    if (!job || job.status === col) { setDropCol(null); return }
    refresh(updateJob(jobId, { status: col }, `Dragged ${STATUS_META[job.status].label} → ${STATUS_META[col].label}`))
    setDropCol(null)
  }
  const addJob = () => {
    if (!newTitle.trim()) return
    createJob({ title: newTitle.trim(), source: 'Manual entry' })
    setJobs(loadJobs()); setNewTitle('')
  }
  const exportJson = () => {
    const url = URL.createObjectURL(new Blob([exportJobsJson()], { type: 'application/json' }))
    const a = document.createElement('a'); a.href = url; a.download = 'ontology-harness-jobs.json'; a.click(); URL.revokeObjectURL(url)
  }
  const navigate = (module: string, ref?: string) => {
    if (ref) setFocus(module, ref)
    window.dispatchEvent(new CustomEvent('oh:navigate', { detail: { module } }))
  }

  return (
    <div className="module fade-in">
      <div className="module-head glass-strong">
        <div>
          <div className="module-title"><Icon name="kanban" size={18} /> Analyst Jobs — From Insight to Done</div>
          <div className="module-sub">Drag between columns · artifacts attached to every job · WIP guard on Review</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <input className="input" style={{ width: 220 }} placeholder="New job title…" value={newTitle} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && addJob()} />
          <button className="btn" onClick={addJob}><Icon name="plus" size={13} /> Add</button>
          <button className="btn" onClick={exportJson}><Icon name="download" size={13} /> Export JSON</button>
        </div>
      </div>

      <div className="kanban">
        {ORDER.map(col => {
          const colJobs = jobs.filter(j => j.status === col)
          const wipHit = col === 'review' && colJobs.length > WIP_LIMIT
          return (
            <div key={col} className={`kcol ${dropCol === col ? 'drop-target' : ''}`} onDragOver={e => { e.preventDefault(); setDropCol(col) }} onDragLeave={() => setDropCol(null)} onDrop={() => dropOn(jobDragId, col)}>
              <div className="kcol-h"><span className="dot" style={{ background: STATUS_META[col].dot }} />{STATUS_META[col].label}<span className="chip chip-mono" style={{ marginLeft: 'auto' }}>{colJobs.length}</span>{wipHit && <span className="wip-warn" title="Review queue beyond WIP limit">⚠ WIP</span>}</div>
              <div className="kcol-body">
                {colJobs.map(j => (
                  <div key={j.id} className="kcard glass-faint" draggable onDragStart={() => { jobDragId = j.id }} onDragEnd={() => { jobDragId = ''; setDropCol(null) }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                      <div style={{ fontWeight: 700, fontSize: 11.5, lineHeight: 1.35, flex: 1 }}>{j.title}</div>
                      <button className="priority-chip" style={{ color: PRIORITY_META[j.priority ?? 'normal'].cls, borderColor: PRIORITY_META[j.priority ?? 'normal'].cls }} title="Click to cycle priority" onClick={() => refresh(updateJob(j.id, { priority: nextPriority(j.priority) }, `Priority → ${PRIORITY_META[nextPriority(j.priority)].label}`))}>{PRIORITY_META[j.priority ?? 'normal'].label}</button>
                    </div>
                    <div className="module-sub" style={{ margin: '4px 0 6px' }}>{j.source}</div>

                    {/* Attachments */}
                    {j.attachments.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                        {j.attachments.map((a, i) => (
                          <span key={i} className="atch-wrap">
                            <button className="atch" onClick={() => setOpenPop(openPop === `${j.id}-${i}` ? null : `${j.id}-${i}`)} title={`${a.kind} · ${a.label}`}>
                              <Icon name={a.kind === 'dataset' ? 'database' : a.kind === 'trace' ? 'graph' : a.kind === 'chart' ? 'chart' : a.kind === 'ontology' ? 'cube' : 'arrow'} size={11} /> {a.label.slice(0, 26)}
                            </button>
                            {openPop === `${j.id}-${i}` && <AttachmentPop a={a} onOpen={navigateFor(a, navigate)} />}
                          </span>
                        ))}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>{j.tags.map(t => <span key={t} className="chip chip-mono" style={{ fontSize: 9 }}>{t}</span>)}</div>
                    <div className="kcard-controls">
                      <select className="mini-select" value={j.owner} onChange={e => refresh(updateJob(j.id, { owner: e.target.value }, `Assignee → ${e.target.value}`))} aria-label="Assignee">
                        {roster.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <input type="date" className="mini-select" value={isoDue(j.due)} onChange={e => refresh(updateJob(j.id, { due: e.target.value }, `Due → ${e.target.value}`))} aria-label="Due date" />
                      <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost" style={{ padding: '2px 7px' }} onClick={() => move(j, -1)} aria-label="Move back">←</button>
                        <button className="btn btn-ghost" style={{ padding: '2px 7px' }} onClick={() => move(j, 1)} aria-label="Move forward">→</button>
                      </span>
                    </div>
                    <div className="kcard-feed">{j.activity.slice(-2).map((a, i) => <div key={i}><b>{a.at}</b> — {a.text}</div>)}</div>
                  </div>
                ))}
                {colJobs.length === 0 && <div className="module-sub" style={{ padding: '14px 6px', textAlign: 'center', opacity: .7 }}>Nothing here. Drop a card or use ←/→</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* module-level drag id (avoids state re-renders during drag) */
let jobDragId = ''

function navigateFor(a: JobAttachment, navigate: (m: string, ref?: string) => void) {
  switch (a.kind) {
    case 'dataset': return () => navigate('data', a.id)
    case 'trace': return () => navigate('swarms')
    case 'ontology': return () => navigate('studio', a.id)
    default: return () => navigate('aip')
  }
}

function AttachmentPop({ a, onOpen }: { a: JobAttachment; onOpen: () => void }) {
  const ds = a.kind === 'dataset' ? ws.datasets.find((d: any) => d.id === a.id) : null
  return (
    <div className="atch-pop glass-strong" role="dialog">
      <div className="panel-title" style={{ marginBottom: 4 }}>{a.kind} · {a.label}</div>
      {a.hash && <div className="module-sub chip-mono" style={{ fontSize: 9 }}>sha256 {String(a.hash).slice(0, 16)}…</div>}
      {ds && (
        <table className="tbl" style={{ marginTop: 6 }}>
          <thead><tr>{ds.columns.slice(0, 4).map((c: any) => <th key={c.name}>{c.name}</th>)}</tr></thead>
          <tbody>{ds.rows.slice(0, 5).map((r: any, i: number) => <tr key={i}>{ds.columns.slice(0, 4).map((c: any) => <td key={c.name}>{String(r[c.name])}</td>)}</tr>)}</tbody>
        </table>
      )}
      {a.kind === 'trace' && <div className="module-sub" style={{ marginTop: 4 }}>Swarm trace recorded in the ledger — open Agentic Swarms for the full run replay.</div>}
      {a.kind === 'ontology' && <div className="module-sub" style={{ marginTop: 4 }}>Ontology reference — open Ontology Studio to inspect object/link types.</div>}
      <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} onClick={onOpen}><Icon name="arrow" size={12} /> Open</button>
    </div>
  )
}
