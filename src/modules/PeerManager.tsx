// PeerManager — T-24 Peer Manager + Mapping Wizard (FN-PEER-001/002/003).
// UNREGISTERED stub: exported for future registration only — do not import in registry.ts.
// Connections home (C11) · topology overview + peering jobs (C12) · 3-step mapping wizard (C13).
// Per master-prompts/functions/FN-GOV-PEER.md: topology + Start export / Send Ack + mapping wizard.
// Glass tokens only (var(--*) / .glass / .btn / .chip / .pill); light+dark parity via tokens.
// Every mutating action records appendTrace(kind: "tool-call") + appendAudit.

import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import { appendAudit, appendTrace, patchMeta, ws } from '../store'
import {
  TARGET_PROPERTY_OPTIONS,
  PEER_FIXTURE_CONNECTIONS,
  PEER_FIXTURE_JOBS,
  PEER_FIXTURE_SOURCES,
  WIZARD_STEPS,
  WIZARD_STEP_LABELS,
  buildPropertyMap,
  canProceedWizard,
  canSendAck,
  canStartExport,
  createEmptyWizardState,
  filterJobsByStatus,
  jobHealthForConnection,
  nextWizardStep,
  prevWizardStep,
  searchConnections,
  sendAck,
  setDoNotMap,
  sortJobsByUpdatedDesc,
  startExport,
  summarizeMapping,
  topologySummary,
  updatePropertyMapRow,
  validatePropertyMap,
  type PeerConnection,
  type PeeringJob,
  type PeeringJobStatus,
  type PeerSource,
  type PropertyTransform,
  type WizardState,
  type WizardStep,
} from '../peer/mapping'

export interface PeerManagerProps {
  connections?: PeerConnection[]
  jobs?: PeeringJob[]
  sources?: PeerSource[]
}

function logOp(tool: string, detail: string, ok = true) {
  try {
    appendTrace({ kind: 'tool-call', tool, ok, ms: 0, detail })
  } catch {
    /* ledger unavailable in some test envs — UI must not crash */
  }
  try {
    appendAudit({ event: tool, detail, ok })
  } catch {
    /* audit unavailable — UI must not crash */
  }
}

const STATUS_PILL: Record<string, string> = {
  connected: 'pill pill-live',
  disconnected: 'pill pill-draft',
  degraded: 'pill pill-warn',
  queued: 'pill pill-draft',
  idle: 'pill pill-draft',
  exporting: 'pill pill-warn',
  'awaiting-ack': 'pill pill-warn',
  acknowledged: 'pill pill-live',
  completed: 'pill pill-live',
  failed: 'pill pill-danger',
}

const pillFor = (status: string) => STATUS_PILL[status] ?? 'pill pill-draft'

function readPersisted<T>(key: string, fallback: T): T {
  const v = (ws.meta?.[key] as T | undefined) ?? undefined
  return v !== undefined && v !== null ? v : fallback
}

export function PeerManager({ connections: connectionsProp, jobs: jobsProp, sources: sourcesProp }: PeerManagerProps = {}) {
  const [connections, setConnections] = useState<PeerConnection[]>(() =>
    connectionsProp ?? readPersisted<PeerConnection[]>('peerConnections', PEER_FIXTURE_CONNECTIONS),
  )
  const [jobs, setJobs] = useState<PeeringJob[]>(() => jobsProp ?? readPersisted<PeeringJob[]>('peerJobs', PEER_FIXTURE_JOBS))
  const sources = useMemo<PeerSource[]>(() => sourcesProp ?? PEER_FIXTURE_SOURCES, [sourcesProp])
  const [selectedId, setSelectedId] = useState<string>(() => connections[0]?.id ?? '')
  const [query, setQuery] = useState('')
  const [jobFilter, setJobFilter] = useState<PeeringJobStatus | 'all'>('all')
  const [wizard, setWizard] = useState<WizardState>(() => createEmptyWizardState())
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardErrors, setWizardErrors] = useState<string[]>([])
  const [lastAction, setLastAction] = useState<string | null>(null)

  const visibleConnections = useMemo(() => searchConnections(connections, query), [connections, query])
  const selected = connections.find((c) => c.id === selectedId) ?? connections[0]
  const selectedJobs = useMemo(
    () => sortJobsByUpdatedDesc(filterJobsByStatus(jobs.filter((j) => j.connectionId === selected?.id), jobFilter)),
    [jobs, selected?.id, jobFilter],
  )
  const summary = useMemo(() => summarizeMapping(wizard.rows), [wizard.rows])
  const mappingValidation = useMemo(() => validatePropertyMap(wizard.rows), [wizard.rows])
  const wizardCheck = useMemo(() => canProceedWizard(wizard), [wizard])

  useEffect(() => {
    if (!wizardOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeWizard('escape')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardOpen])

  const setMsg = (m: string) => setLastAction(m)

  /* ── connections home (FN-PEER-001) ── */
  const viewConnection = (id: string) => {
    setSelectedId(id)
    logOp('peer.view', `connection ${id}`)
  }

  const toggleConnect = (conn: PeerConnection) => {
    const nextStatus = conn.status === 'connected' ? 'disconnected' : 'connected'
    const next = connections.map((c) => (c.id === conn.id ? { ...c, status: nextStatus } as PeerConnection : c))
    setConnections(next)
    patchMeta({ peerConnections: next })
    const tool = nextStatus === 'connected' ? 'peer.connect' : 'peer.disconnect'
    logOp(tool, `connection ${conn.id} (${conn.name}) -> ${nextStatus}`)
    setMsg(`${nextStatus === 'connected' ? 'Connected to' : 'Disconnected from'} ${conn.name}`)
  }

  /* ── peering jobs (FN-PEER-002) ── */
  const onStartExport = (job: PeeringJob) => {
    try {
      const next = startExport(job)
      const nextJobs = jobs.map((j) => (j.id === job.id ? next : j))
      setJobs(nextJobs)
      patchMeta({ peerJobs: nextJobs })
      logOp('peer.job.start-export', `job ${job.id} ${job.status} -> exporting`)
      setMsg(`Start export: ${job.id} now exporting`)
    } catch (e) {
      logOp('peer.job.start-export', `job ${job.id} failed: ${String(e).slice(0, 120)}`, false)
      setMsg(`Cannot start export for ${job.id}: ${String(e).slice(0, 80)}`)
    }
  }

  const onSendAck = (job: PeeringJob) => {
    try {
      const next = sendAck(job)
      const nextJobs = jobs.map((j) => (j.id === job.id ? next : j))
      setJobs(nextJobs)
      patchMeta({ peerJobs: nextJobs })
      logOp('peer.job.send-ack', `job ${job.id} awaiting-ack -> acknowledged`)
      setMsg(`Ack sent for ${job.id}`)
    } catch (e) {
      logOp('peer.job.send-ack', `job ${job.id} failed: ${String(e).slice(0, 120)}`, false)
      setMsg(`Cannot send Ack for ${job.id}: ${String(e).slice(0, 80)}`)
    }
  }

  /* ── mapping wizard (FN-PEER-003: Select source → Map properties → Review) ── */
  const openWizard = () => {
    const fresh = createEmptyWizardState()
    setWizard(fresh)
    setWizardErrors([])
    setWizardOpen(true)
    logOp('peer.wizard.open', `step=select connections=${connections.length}`)
    logOp('peer.wizard.step', 'step=select')
  }

  const closeWizard = (reason: string) => {
    setWizardOpen(false)
    logOp('peer.wizard.close', `reason=${reason}`)
  }

  const chooseSource = (sourceId: string) => {
    const source = sources.find((s) => s.id === sourceId)
    if (!source) return
    const rows = buildPropertyMap(source.properties)
    setWizard({ step: 'map', sourceId, rows })
    setWizardErrors([])
    logOp('peer.wizard.select-source', `source=${sourceId} (${source.name}) props=${source.properties.length}`)
    logOp('peer.wizard.step', 'step=map')
  }

  const updateRow = (sourceProp: string, patch: Partial<{ targetProp: string | null; transform: PropertyTransform }>) => {
    setWizard((w) => ({ ...w, rows: updatePropertyMapRow(w.rows, sourceProp, patch) }))
    logOp('peer.wizard.map', `${sourceProp} -> ${patch.targetProp ?? '(unmapped)'}${patch.transform ? ` transform=${patch.transform}` : ''}`)
  }

  const toggleDoNotMap = (sourceProp: string, checked: boolean) => {
    setWizard((w) => ({ ...w, rows: setDoNotMap(w.rows, sourceProp, checked) }))
    logOp('peer.wizard.map', `${sourceProp} doNotMap=${checked}`)
  }

  const goNext = () => {
    const check = canProceedWizard(wizard)
    if (!check.ok) {
      setWizardErrors(check.errors)
      logOp('peer.wizard.step', `step=${wizard.step} blocked: ${check.errors.join('; ')}`, false)
      return
    }
    const next = nextWizardStep(wizard.step)
    setWizard((w) => ({ ...w, step: next }))
    setWizardErrors([])
    logOp('peer.wizard.step', `step=${next}`)
  }

  const goBack = () => {
    const prev = prevWizardStep(wizard.step)
    setWizard((w) => ({ ...w, step: prev }))
    setWizardErrors([])
    logOp('peer.wizard.step', `step=${prev}`)
  }

  const finishWizard = () => {
    const check = canProceedWizard(wizard)
    if (!check.ok) {
      setWizardErrors(check.errors)
      logOp('peer.wizard.finish', `blocked: ${check.errors.join('; ')}`, false)
      return
    }
    const saved = { sourceId: wizard.sourceId, rows: wizard.rows, connectionId: selected?.id ?? null, finishedAt: new Date().toISOString() }
    patchMeta({ peerMapping: saved })
    // A finished mapping queues a new peering job on the selected connection.
    if (selected) {
      const job: PeeringJob = {
        id: `job-${Date.now().toString(36)}`,
        connectionId: selected.id,
        status: 'queued',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        progress: 0,
      }
      const nextJobs = [job, ...jobs]
      setJobs(nextJobs)
      patchMeta({ peerJobs: nextJobs })
      logOp('peer.job.create', `job ${job.id} queued for ${selected.id} from mapping ${wizard.sourceId}`)
    }
    logOp('peer.wizard.finish', `source=${wizard.sourceId} mapped=${summary.mapped}/${summary.total} doNotMap=${summary.doNotMap} coverage=${summary.coveragePct}%`)
    setMsg(`Mapping finished: ${summary.mapped}/${summary.total} mapped (${summary.coveragePct}% coverage)`)
    setWizardOpen(false)
  }

  const activeJobs = jobs.filter((j) => j.status === 'queued' || j.status === 'exporting' || j.status === 'awaiting-ack').length

  return (
    <div className="module fade-in" data-testid="peer-manager">
      <div className="module-head glass-strong">
        <div>
          <div className="module-title"><Icon name="users" size={18} /> Peer Manager</div>
          <div className="module-sub">Connections home · topology + peering jobs · 3-step ontology mapping — corpus-2 C11–C13 (FN-PEER-001/002/003)</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="chip chip-mono">{connections.length} connections</span>
          <span className="chip">{activeJobs} active jobs</span>
          <button className="btn btn-primary" data-testid="peer-open-wizard" onClick={openWizard}>
            <Icon name="plus" size={12} /> New mapping
          </button>
        </div>
      </div>

      {lastAction && (
        <div className="glass-faint" role="status" data-testid="peer-action-msg" style={{ padding: '7px 12px', fontSize: 11 }}>
          {lastAction}
        </div>
      )}

      <div style={{ overflow: 'auto', minHeight: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* ——— FN-PEER-001: connections home ——— */}
        <section className="glass panel" data-testid="peer-connections-home" aria-label="Peer connections">
          <div className="panel-title">
            <span>Peer connections</span>
            <input
              className="input"
              style={{ width: 200, padding: '4px 8px' }}
              placeholder="Search connections…"
              aria-label="Search connections"
              data-testid="peer-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div style={{ overflow: 'auto' }}>
            <table className="tbl" aria-label="Connection table">
              <thead>
                <tr>
                  <th scope="col">Connection</th>
                  <th scope="col">Remote</th>
                  <th scope="col">Classification</th>
                  <th scope="col">Status</th>
                  <th scope="col">Job health</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleConnections.map((c) => {
                  const health = jobHealthForConnection(jobs, c.id)
                  const isSelected = c.id === selected?.id
                  return (
                    <tr key={c.id} data-testid={`peer-connection-row-${c.id}`} className={isSelected ? 'selected' : undefined}>
                      <td style={{ fontWeight: 700 }}>{c.name}</td>
                      <td className="chip-mono" style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5 }}>{c.remote}</td>
                      <td><span className="chip">{c.classification}</span></td>
                      <td><span className={pillFor(c.status)}>{c.status}</span></td>
                      <td>
                        <span className={health.health === 'attention' ? 'pill pill-warn' : health.health === 'healthy' ? 'pill pill-live' : 'pill pill-draft'}>
                          {health.label}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button className="btn" style={{ padding: '3px 8px', fontSize: 10.5 }} data-testid={`peer-overview-${c.id}`} aria-label={`Overview for ${c.name}`} onClick={() => viewConnection(c.id)}>
                            Overview
                          </button>
                          <button
                            className={c.status === 'connected' ? 'btn' : 'btn btn-primary'}
                            style={{ padding: '3px 8px', fontSize: 10.5 }}
                            data-testid={`peer-connect-${c.id}`}
                            aria-label={`${c.status === 'connected' ? 'Disconnect' : 'Connect'} ${c.name}`}
                            onClick={() => toggleConnect(c)}
                          >
                            {c.status === 'connected' ? 'Disconnect' : 'Connect'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {visibleConnections.length === 0 && (
                  <tr><td colSpan={6} style={{ color: 'var(--text-dim)' }}>No connections match “{query}”.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ——— FN-PEER-002: topology overview + peering jobs ——— */}
        {selected && (
          <section className="glass panel" data-testid="peer-topology-overview" aria-label="Connection overview">
            <div className="panel-title">
              <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                Overview · {selected.name}
                <span className="chip">{selected.classification}</span>
                <span className={pillFor(selected.status)}>{selected.status}</span>
              </span>
              <span className="chip chip-mono" data-testid="peer-topology-summary">
                {topologySummary(selected).total} nodes ({topologySummary(selected).localCount} local / {topologySummary(selected).remoteCount} remote)
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="glass-faint" style={{ padding: '8px 10px' }} data-testid="peer-local-topology">
                <div className="panel-title" style={{ marginBottom: 6 }}>Local topology</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {selected.localTopology.map((n) => (
                    <span key={n.id} className="chip" title={n.kind}>{n.label} <span style={{ opacity: 0.7 }}>· {n.kind}</span></span>
                  ))}
                  {selected.localTopology.length === 0 && <span className="module-sub">No local nodes</span>}
                </div>
              </div>
              <div className="glass-faint" style={{ padding: '8px 10px' }} data-testid="peer-remote-topology">
                <div className="panel-title" style={{ marginBottom: 6 }}>Remote topology</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {selected.remoteTopology.map((n) => (
                    <span key={n.id} className="chip" title={n.kind}>{n.label} <span style={{ opacity: 0.7 }}>· {n.kind}</span></span>
                  ))}
                  {selected.remoteTopology.length === 0 && <span className="module-sub">No remote nodes</span>}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <span className="panel-title" style={{ marginBottom: 0 }}>Peering jobs · {selectedJobs.length}</span>
              <label style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 10, color: 'var(--text-dim)' }}>
                Status
                <select className="input" style={{ width: 'auto', padding: '3px 6px' }} aria-label="Job status filter" data-testid="peer-job-filter" value={jobFilter} onChange={(e) => setJobFilter(e.target.value as PeeringJobStatus | 'all')}>
                  <option value="all">All</option>
                  <option value="idle">idle</option>
                  <option value="queued">queued</option>
                  <option value="exporting">exporting</option>
                  <option value="awaiting-ack">awaiting-ack</option>
                  <option value="acknowledged">acknowledged</option>
                  <option value="completed">completed</option>
                  <option value="failed">failed</option>
                </select>
              </label>
              <button className="btn" style={{ padding: '3px 8px', fontSize: 10.5 }} data-testid="peer-open-wizard-overview" onClick={openWizard}>
                <Icon name="plus" size={11} /> Map properties
              </button>
            </div>
            <div style={{ overflow: 'auto' }}>
              <table className="tbl" aria-label="Peering jobs">
                <thead>
                  <tr>
                    <th scope="col">Job</th>
                    <th scope="col">Status</th>
                    <th scope="col">Progress</th>
                    <th scope="col">Updated</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedJobs.map((j) => (
                    <tr key={j.id} data-testid={`peer-job-row-${j.id}`}>
                      <td className="chip-mono" style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5 }}>{j.id}{j.lastError && <div style={{ color: 'var(--danger)', fontSize: 9 }}>{j.lastError}</div>}</td>
                      <td><span className={pillFor(j.status)}>{j.status}</span></td>
                      <td>
                        <div className="meter" style={{ width: 90 }} aria-label={`Progress ${j.progress}%`}><div className="meter-fill" style={{ width: `${j.progress}%` }} /></div>
                      </td>
                      <td className="chip-mono" style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>{j.updatedAt.slice(0, 10)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button className="btn btn-primary" style={{ padding: '3px 8px', fontSize: 10.5 }} disabled={!canStartExport(j)} data-testid={`peer-job-start-${j.id}`} aria-label={`Start export ${j.id}`} onClick={() => onStartExport(j)}>
                            Start export
                          </button>
                          <button className="btn" style={{ padding: '3px 8px', fontSize: 10.5 }} disabled={!canSendAck(j)} data-testid={`peer-job-ack-${j.id}`} aria-label={`Send Ack ${j.id}`} onClick={() => onSendAck(j)}>
                            Send Ack
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {selectedJobs.length === 0 && <tr><td colSpan={5} style={{ color: 'var(--text-dim)' }}>No peering jobs for this connection.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ——— FN-PEER-003: 3-step mapping wizard ——— */}
        {wizardOpen && (
          <section className="glass-strong panel" role="dialog" aria-label="Ontology mapping wizard" data-testid="peer-mapping-wizard">
            <div className="panel-title">
              <span>Ontology mapping wizard</span>
              <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 10 }} data-testid="peer-wizard-close" aria-label="Close mapping wizard" onClick={() => closeWizard('button')}>
                <Icon name="x" size={12} /> Close
              </button>
            </div>
            <div className="wizard-bar" aria-hidden>
              {WIZARD_STEPS.map((s) => (
                <div key={s} className={`wizard-dot ${WIZARD_STEPS.indexOf(s) <= WIZARD_STEPS.indexOf(wizard.step) ? 'on' : ''}`} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }} role="list" aria-label="Wizard steps">
              {WIZARD_STEPS.map((s) => (
                <span key={s} role="listitem" aria-current={wizard.step === s ? 'step' : undefined} className={wizard.step === s ? 'chip' : 'chip chip-mono'} style={wizard.step === s ? { boxShadow: 'var(--green-glow)' } : { opacity: 0.65 }}>
                  {WIZARD_STEPS.indexOf(s) + 1}. {WIZARD_STEP_LABELS[s]}
                </span>
              ))}
            </div>

            {wizard.step === 'select' && (
              <div data-testid="peer-wizard-step-select" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="module-sub">Step 1 — Select source. Choose the ontology, object type or dataset whose properties you will map into the local ontology.</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                  {sources.map((s) => {
                    const active = wizard.sourceId === s.id
                    return (
                      <button
                        key={s.id}
                        type="button"
                        className="glass-faint"
                        style={{ textAlign: 'left', padding: '10px 12px', cursor: 'pointer', color: 'var(--text)', border: active ? '1px solid var(--green-600)' : undefined, boxShadow: active ? 'var(--green-glow)' : undefined }}
                        data-testid={`peer-source-${s.id}`}
                        aria-pressed={active}
                        aria-label={`Select source ${s.name}`}
                        onClick={() => chooseSource(s.id)}
                      >
                        <div style={{ fontWeight: 800, fontSize: 12 }}>{s.name}{active && <span className="chip" style={{ marginLeft: 6, fontSize: 8 }}>selected</span>}</div>
                        <div className="module-sub">{s.kind} · {s.properties.length} properties</div>
                        <div className="chip-mono" style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-dim)', marginTop: 4 }}>{s.properties.join(', ')}</div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {wizard.step === 'map' && (
              <div data-testid="peer-wizard-step-map" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="module-sub">
                  Step 2 — Map properties for <strong>{sources.find((s) => s.id === wizard.sourceId)?.name ?? wizard.sourceId}</strong>. Exact-name matches are suggested. Tick “Do not map property” to exclude a row.
                </div>
                <div style={{ overflow: 'auto' }}>
                  <table className="tbl" aria-label="Property map">
                    <thead>
                      <tr><th scope="col">Source property</th><th scope="col">Target property</th><th scope="col">Transform</th><th scope="col">Do not map</th></tr>
                    </thead>
                    <tbody>
                      {wizard.rows.map((r) => (
                        <tr key={r.sourceProp} data-testid={`peer-map-row-${r.sourceProp}`}>
                          <td className="chip-mono" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{r.sourceProp}</td>
                          <td>
                            <select
                              className="input"
                              style={{ width: 170, padding: '3px 6px' }}
                              aria-label={`Target for ${r.sourceProp}`}
                              data-testid={`peer-map-target-${r.sourceProp}`}
                              disabled={r.doNotMap}
                              value={r.targetProp ?? ''}
                              onChange={(e) => updateRow(r.sourceProp, { targetProp: e.target.value === '' ? null : e.target.value })}
                            >
                              <option value="">— unmapped —</option>
                              {TARGET_PROPERTY_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </td>
                          <td>
                            <select
                              className="input"
                              style={{ width: 110, padding: '3px 6px' }}
                              aria-label={`Transform for ${r.sourceProp}`}
                              data-testid={`peer-map-transform-${r.sourceProp}`}
                              disabled={r.doNotMap}
                              value={r.transform}
                              onChange={(e) => updateRow(r.sourceProp, { transform: e.target.value as PropertyTransform })}
                            >
                              <option value="identity">identity</option>
                              <option value="lowercase">lowercase</option>
                              <option value="uppercase">uppercase</option>
                              <option value="trim">trim</option>
                            </select>
                          </td>
                          <td>
                            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11 }}>
                              <input type="checkbox" data-testid={`peer-map-donotmap-${r.sourceProp}`} aria-label={`Do not map ${r.sourceProp}`} checked={r.doNotMap} onChange={(e) => toggleDoNotMap(r.sourceProp, e.target.checked)} />
                              Do not map
                            </label>
                          </td>
                        </tr>
                      ))}
                      {wizard.rows.length === 0 && <tr><td colSpan={4} style={{ color: 'var(--text-dim)' }}>Select a source first.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {wizard.step === 'review' && (
              <div data-testid="peer-wizard-step-review" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="module-sub">Step 3 — Review. Confirm the mapping before it queues a peering job on {selected?.name ?? 'the selected connection'}.</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} data-testid="peer-mapping-summary">
                  <span className="chip chip-mono">{summary.mapped}/{summary.total} mapped</span>
                  <span className="chip">{summary.doNotMap} do not map</span>
                  <span className="chip">{summary.unmapped} unmapped</span>
                  <span className="chip chip-mono">{summary.coveragePct}% coverage</span>
                  <span className="chip">{sources.find((s) => s.id === wizard.sourceId)?.name ?? wizard.sourceId}</span>
                </div>
                <div style={{ overflow: 'auto' }}>
                  <table className="tbl" aria-label="Mapping review">
                    <thead><tr><th scope="col">Source</th><th scope="col">Target</th><th scope="col">Transform</th></tr></thead>
                    <tbody>
                      {wizard.rows.map((r) => (
                        <tr key={r.sourceProp}>
                          <td className="chip-mono" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{r.sourceProp}</td>
                          <td>{r.doNotMap ? <span className="pill pill-draft">Do not map</span> : r.targetProp ?? <span className="pill pill-warn">unmapped</span>}</td>
                          <td>{r.transform}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!mappingValidation.ok && (
                  <div className="glass-faint" role="alert" data-testid="peer-wizard-errors" style={{ padding: '7px 10px', color: 'var(--danger)', fontSize: 11 }}>
                    {mappingValidation.errors.join(' · ')}
                  </div>
                )}
              </div>
            )}

            {(wizard.step !== 'review') && wizardErrors.length > 0 && (
              <div className="glass-faint" role="alert" data-testid="peer-wizard-errors" style={{ padding: '7px 10px', color: 'var(--danger)', fontSize: 11, marginTop: 8 }}>
                {wizardErrors.join(' · ')}
              </div>
            )}
            {wizard.step === 'review' && wizardErrors.length > 0 && !mappingValidation.ok && (
              <div style={{ display: 'none' }} />
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button className="btn" disabled={wizard.step === 'select'} data-testid="peer-wizard-back" onClick={goBack}>Back</button>
              <span style={{ flex: 1 }} />
              {wizard.step !== 'review' ? (
                <button className="btn btn-primary" data-testid="peer-wizard-next" disabled={wizard.step === 'select' && !wizard.sourceId} onClick={goNext}>
                  Next <Icon name="arrow" size={12} />
                </button>
              ) : (
                <button className="btn btn-primary" data-testid="peer-wizard-finish" disabled={!wizardCheck.ok} onClick={finishWizard}>
                  <Icon name="check" size={12} /> Finish mapping
                </button>
              )}
            </div>
            <div className="module-sub" style={{ marginTop: 6 }}>
              Wizard actions are traced + audited (peer.wizard.*). Escape closes. Glass tokens only.
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

export const peerManagerModuleDefinition = {
  id: 'peer-manager',
  label: 'Peer Manager',
  hint: 'Peer connections, topology + peering jobs, 3-step mapping wizard',
  section: 'INSPECT' as const,
  layer: 'L3-FOUNDRY' as const,
  Component: PeerManager,
}

export default PeerManager
