// Analyst Jobs — store-backed (SQLite via Rust in Tauri / localStorage in browser).
// Schema v2: jobs carry artifacts (datasets, charts, traces, ontology refs).
import { ws, setJobs } from './store'

export type JobStatus = 'backlog' | 'progress' | 'review' | 'done'
export type JobActivity = { at: string; text: string }
export type JobAttachmentKind = 'dataset' | 'chart' | 'trace' | 'ontology' | 'url'
export type JobAttachment = { kind: JobAttachmentKind; id: string; label: string; hash?: string; addedAt: string }
export type Job = {
  v?: number
  id: string
  title: string
  source: string
  status: JobStatus
  owner: string
  due: string
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  tags: string[]
  createdAt: string
  activity: JobActivity[]
  attachments: JobAttachment[]
}

const now = () => new Date().toISOString()
const stamp = () => new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export const SEED: Job[] = [
  { id: 'job-001', title: 'Reconcile supplier CSV against ontology', source: 'Import · supplier_parts.csv', status: 'progress', owner: 'Berry', due: 'Fri 13 Nov', priority: 'high', tags: ['ontology', 'data-quality'], createdAt: now(),
    activity: [{ at: stamp(), text: 'Job created from Data Hub import · 1,204 rows' }], attachments: [{ kind: 'dataset', id: 'seed-supplier', label: 'supplier_parts.csv', hash: 'a1b2c3d4e5f6', addedAt: now() }] },
  { id: 'job-002', title: 'Lineage audit — Assembly line process family', source: 'Swarm · Lineage Audit', status: 'review', owner: 'Berry', due: 'Wed 11 Nov', priority: 'urgent', tags: ['lineage'], createdAt: now(),
    activity: [{ at: stamp(), text: 'Swarm completed in 4m 12s · 14/14 relations verified' }], attachments: [{ kind: 'trace', id: 'swarm-seed-1', label: 'Lineage Audit run · 4m 12s', addedAt: now() }] },
  { id: 'job-003', title: 'Draft AIP Logic — throughput forecast summarizer', source: 'Preset · AIP Logic Draft', status: 'backlog', owner: 'Unassigned', due: 'Next sprint', priority: 'normal', tags: ['aip', 'llm'], createdAt: now(),
    activity: [{ at: stamp(), text: 'Preset forked · worker claude-sonnet-4-5 assigned' }], attachments: [] },
  { id: 'job-004', title: 'Workshop module review — Order Overview v1.3', source: 'Preset · Workshop Module Review', status: 'done', owner: 'Berry', due: 'Closed', priority: 'low', tags: ['workshop'], createdAt: now(),
    activity: [{ at: stamp(), text: 'Review passed · published v1.3 · 0 blockers' }], attachments: [{ kind: 'ontology', id: 'ot-product', label: 'Vehicle Model object type', addedAt: now() }] },
]

/** v1→v2 migration: fill attachments/priority defaults. */
function migrate(jobs: any[]): Job[] {
  return jobs.map(j => ({
    v: 2,
    priority: 'normal' as const,
    tags: [],
    activity: [],
    ...j,
    attachments: Array.isArray(j.attachments) ? j.attachments : [],
  }))
}

export function loadJobs(): Job[] {
  if (!ws.hydrated) return SEED
  if (ws.jobs.length === 0) setJobs(SEED) // first-ever run: seed
  const migrated = migrate(ws.jobs)
  if (migrated.some((j, i) => j !== ws.jobs[i] && (ws.jobs[i].attachments === undefined))) setJobs(migrated)
  return migrated
}

export function saveJobs(jobs: Job[]) {
  setJobs(jobs)
}

export function createJob(partial: Partial<Job> & { title: string }): Job {
  const job: Job = {
    v: 2,
    id: `job-${Date.now().toString(36)}`,
    source: partial.source ?? 'Manual',
    status: partial.status ?? 'backlog',
    owner: partial.owner ?? 'Berry',
    due: partial.due ?? 'Unscheduled',
    priority: partial.priority ?? 'normal',
    tags: partial.tags ?? [],
    createdAt: now(),
    activity: [{ at: stamp(), text: partial.activity?.[0]?.text ?? `Job created · ${partial.source ?? 'manual'}` }],
    attachments: partial.attachments ?? [],
    title: partial.title,
  }
  setJobs([job, ...loadJobs()])
  return job
}

export function updateJob(id: string, patch: Partial<Job>, activityText?: string): Job[] {
  const next = loadJobs().map(j => {
    if (j.id !== id) return j
    const updated = { ...j, ...patch }
    if (activityText) updated.activity = [...j.activity, { at: stamp(), text: activityText }]
    return updated
  })
  setJobs(next)
  return next
}

export function attachToJob(jobId: string, attachment: Omit<JobAttachment, 'addedAt'>, activityText?: string): Job[] {
  return updateJob(jobId, { attachments: [...(loadJobs().find(j => j.id === jobId)?.attachments ?? []), { ...attachment, addedAt: now() }] }, activityText ?? `Attached ${attachment.kind} · ${attachment.label}`)
}

export function exportJobsJson(): string {
  return JSON.stringify({ v: 2, exportedAt: now(), tool: 'Ontology Harness v2', jobs: loadJobs() }, null, 2)
}

export const PRIORITY_META = {
  low: { label: 'LOW', cls: '#94a3b8' },
  normal: { label: 'NORMAL', cls: '#2563eb' },
  high: { label: 'HIGH', cls: '#d97706' },
  urgent: { label: 'URGENT', cls: '#dc2626' },
} as const
export type JobPriority = keyof typeof PRIORITY_META
export const PRIORITY_ORDER: JobPriority[] = ['low', 'normal', 'high', 'urgent']

export const STATUS_META: Record<JobStatus, { label: string; dot: string }> = {
  backlog: { label: 'Backlog', dot: '#94a3b8' },
  progress: { label: 'In Progress', dot: '#eab308' },
  review: { label: 'Review', dot: '#38bdf8' },
  done: { label: 'Done', dot: '#16a34a' },
}
