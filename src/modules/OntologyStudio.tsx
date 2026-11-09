import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { OBJECT_TYPES, LINK_TYPES, ACTION_TYPES, type ObjectType } from '../data/ontology'
import { VALUE_TYPES, validateObjectType, type SchemaIssue } from '../data/valueTypes'
import { ws, setObjectTypes, consumeFocus, appendTrace, appendAudit, patchMeta } from '../store'

type Tab = 'objects' | 'links' | 'actions'

/* ── FN-ONT-003 — link type create + toggle (pure helpers) ── */
export type LinkDraft = { name: string; from: string; to: string; cardinality: string; enabled: boolean }
export type ManagedLink = { id: string; from: string; to: string; name: string; cardinality: string; enabled: boolean }

/** Validate a link draft against the current object types. Empty = valid. */
export function validateLinkDraft(draft: LinkDraft, objects: ObjectType[]): string[] {
  const errs: string[] = []
  if (!draft.name.trim()) errs.push('Link name is required')
  if (!objects.some(o => o.id === draft.from)) errs.push('From object type is unknown')
  if (!objects.some(o => o.id === draft.to)) errs.push('To object type is unknown')
  if (draft.from === draft.to) errs.push('From and To must differ')
  if (!draft.cardinality.trim()) errs.push('Cardinality is required')
  return errs
}

/** Create a managed link from a draft (deterministic id). */
export function createManagedLink(draft: LinkDraft, now: number): ManagedLink {
  return { id: `lt-new-${now}`, name: draft.name.trim(), from: draft.from, to: draft.to, cardinality: draft.cardinality.trim(), enabled: draft.enabled }
}

/* ── FN-BLD-017 — favorites Star page (pure helpers) ── */
export function toggleFavoriteId(favorites: string[], id: string): string[] {
  return favorites.includes(id) ? favorites.filter(x => x !== id) : [...favorites, id]
}

export function isFavorite(favorites: string[], id: string): boolean {
  return favorites.includes(id)
}

/* ── FN-FLT-006/007 — filter variants (pure helpers) ── */
export type FilterVariantConfig = { layout: 'vertical' | 'pills'; defaultValue: string; prefix: string; suffix: string }

/** Validate filter default + prefix/suffix. Empty = valid. */
export function validateFilterVariant(cfg: FilterVariantConfig): string[] {
  const errs: string[] = []
  if (cfg.layout !== 'vertical' && cfg.layout !== 'pills') errs.push('Layout must be vertical or pills')
  if (cfg.prefix.length > 8) errs.push('Prefix must be 8 chars or fewer')
  if (cfg.suffix.length > 8) errs.push('Suffix must be 8 chars or fewer')
  if (cfg.defaultValue && cfg.prefix && !cfg.defaultValue.startsWith(cfg.prefix)) errs.push(`Default value must start with prefix "${cfg.prefix}"`)
  if (cfg.defaultValue && cfg.suffix && !cfg.defaultValue.endsWith(cfg.suffix)) errs.push(`Default value must end with suffix "${cfg.suffix}"`)
  return errs
}

/** Format a filter value with prefix/suffix (used for the variant preview). */
export function formatFilterValue(value: string, prefix: string, suffix: string): string {
  const v = value.trim()
  if (!v) return ''
  const withPrefix = prefix && !v.startsWith(prefix) ? `${prefix}${v}` : v
  return suffix && !withPrefix.endsWith(suffix) ? `${withPrefix}${suffix}` : withPrefix
}

/* ── FN-GOV-001/002/003 — governance helpers (pure, glass-tokens only at render) ──
   main-branch review/rebase · RID history + Force snapshot · Health Checks gating.
   Reference: master-prompts/functions/FN-GOV-PEER.md + packs/corpus-2 governance
   tile C04 (foundry branching). Every mutating action logs appendTrace + appendAudit. */

export type PendingChangeKind = 'add' | 'edit' | 'rename' | 'delete'
export type PendingChange = { id: string; kind: PendingChangeKind; label: string; detail: string }

/** Diff working tree vs main baseline → reviewer list for the review step. */
export function computePendingChanges(baseline: ObjectType[], current: ObjectType[]): PendingChange[] {
  const baseById = new Map(baseline.map(o => [o.id, o]))
  const currById = new Map(current.map(o => [o.id, o]))
  const out: PendingChange[] = []
  for (const c of current) {
    const b = baseById.get(c.id)
    if (!b) {
      out.push({ id: c.id, kind: 'add', label: `Add “${c.name}”`, detail: `new object type ${c.id}` })
    } else if (b.name !== c.name) {
      out.push({ id: c.id, kind: 'rename', label: `Rename “${b.name}” → “${c.name}”`, detail: `object type ${c.id}` })
    } else if (JSON.stringify(b) !== JSON.stringify(c)) {
      out.push({ id: c.id, kind: 'edit', label: `Edit “${c.name}”`, detail: `object type ${c.id} changed` })
    }
  }
  for (const b of baseline) {
    if (!currById.has(b.id)) {
      out.push({ id: b.id, kind: 'delete', label: `Delete “${b.name}”`, detail: `object type ${b.id} removed` })
    }
  }
  return out
}

export type OntologySnapshot = { id: string; at: string; objectCount: number; objects: ObjectType[] }

/** Capture a deep copy of the current ontology state as a RID restore point. */
export function makeOntologySnapshot(objects: ObjectType[], at: string = new Date().toISOString()): OntologySnapshot {
  const ms = Number.isNaN(Date.parse(at)) ? 0 : Date.parse(at)
  const id = `RID-${ms.toString(36).toUpperCase()}-${objects.length}types`
  return { id, at, objectCount: objects.length, objects: JSON.parse(JSON.stringify(objects)) }
}

export type HealthCheck = { id: string; label: string; pass: boolean; detail: string }

/** Validation rules for the Health Checks gate (pass/fail per rule). */
export function getHealthChecks(objects: ObjectType[]): HealthCheck[] {
  const ids = new Set(objects.map(o => o.id))
  const unnamed = objects.filter(o => !o.name.trim()).map(o => o.id)
  const badBacking = objects.filter(o => !/^[A-Za-z0-9_\/.-]+$/.test(o.backing)).map(o => o.id)
  const knownTypes = new Set(VALUE_TYPES.map(v => v.id))
  const unknownRefs = objects.flatMap(o => o.properties.filter(p => !knownTypes.has(p.type)).map(p => `${o.id}.${p.name}`))
  const dupes = objects.flatMap(o => {
    const seen = new Set<string>(); const d: string[] = []
    for (const p of o.properties) { if (seen.has(p.name)) d.push(`${o.id}.${p.name}`); seen.add(p.name) }
    return d
  })
  const noTitle = objects.filter(o => !o.properties.some(p => p.indexed)).map(o => o.id)
  const badLinks = LINK_TYPES.filter(l => !ids.has(l.from) || !ids.has(l.to)).map(l => l.name)
  const badActions = ACTION_TYPES.filter(a => !ids.has(a.objectType)).map(a => a.name)

  const pass = (id: string, label: string, ok: boolean, detailPass: string, detailFail: string): HealthCheck =>
    ({ id, label, pass: ok, detail: ok ? detailPass : detailFail })

  return [
    pass('ontology-nonempty', 'Ontology has object types', objects.length > 0, `${objects.length} object type(s)`, 'no object types defined'),
    pass('names-present', 'Object types named', unnamed.length === 0, 'all object types named', `unnamed: ${unnamed.join(', ')}`),
    pass('backing-paths-valid', 'Backing paths valid', badBacking.length === 0, 'all backing paths are project paths', `invalid backing: ${badBacking.join(', ')}`),
    pass('value-types-known', 'Value types known', unknownRefs.length === 0, 'all property types resolve', `unknown types: ${unknownRefs.join(', ')}`),
    pass('no-duplicate-properties', 'No duplicate properties', dupes.length === 0, 'no duplicate property names', `duplicates: ${dupes.join(', ')}`),
    pass('title-property', 'Title (indexed) property present', noTitle.length === 0, 'every object type has an indexed title property', `missing title property: ${noTitle.join(', ')}`),
    pass('link-endpoints-resolve', 'Link endpoints resolve', badLinks.length === 0, 'all link endpoints exist', `broken links: ${badLinks.join(', ')}`),
    pass('actions-resolve', 'Actions resolve', badActions.length === 0, 'all actions bind to an object type', `orphan actions: ${badActions.join(', ')}`),
  ]
}

const cloneTypes = (types: ObjectType[]): ObjectType[] => JSON.parse(JSON.stringify(types)) as ObjectType[]

export default function OntologyStudio() {
  const [tab, setTab] = useState<Tab>('objects')
  const [selId, setSelId] = useState(OBJECT_TYPES[3].id)
  const [query, setQuery] = useState('')
  const [objects, setObjects] = useState(() => (ws.objectTypes?.length ? ws.objectTypes : OBJECT_TYPES))
  useEffect(() => { setObjectTypes(objects) }, [objects])
  const [issues, setIssues] = useState<SchemaIssue[] | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ name: string; typed: string; dependents: string[] } | null>(null)
  const importRef = useRef<HTMLInputElement>(null)
  const [ioNotice, setIoNotice] = useState<string | null>(null)

  // FN-GOV-001 — main branch baseline + review + rebase
  const [baseline, setBaseline] = useState<ObjectType[]>(() => cloneTypes(ws.objectTypes?.length ? ws.objectTypes : OBJECT_TYPES))
  const [reviewOpen, setReviewOpen] = useState(false)
  const [govNotice, setGovNotice] = useState<string | null>(null)
  // FN-GOV-002 — RID history timeline (restore points)
  const [snapshots, setSnapshots] = useState<OntologySnapshot[]>([])
  // FN-GOV-003 — Health Checks gate
  const [healthRun, setHealthRun] = useState<{ at: string; checks: HealthCheck[] } | null>(null)
  /* FN-ONT-003 — managed link types (seeded from LINK_TYPES, toggleable) */
  const [linkTypes, setLinkTypes] = useState<ManagedLink[]>(() => LINK_TYPES.map(l => ({ ...l, enabled: true })))
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [linkDraft, setLinkDraft] = useState<LinkDraft>(() => ({ name: '', from: objects[0]?.id ?? '', to: objects[1]?.id ?? '', cardinality: 'N ↔ N', enabled: true }))
  const [linkError, setLinkError] = useState<string | null>(null)
  /* FN-BLD-017 — favorites Star page (persisted in ws.meta) */
  const [favorites, setFavorites] = useState<string[]>(() => ((ws.meta?.ontologyFavorites as string[]) ?? []))
  const [starView, setStarView] = useState<'all' | 'favorites'>(() => (ws.meta?.ontologyStarView as 'all' | 'favorites') ?? 'all')
  /* FN-FLT-006/007 — filter variants (persisted in ws.meta) */
  const [filterCfg, setFilterCfg] = useState<FilterVariantConfig>(() => ((ws.meta?.filterVariant as FilterVariantConfig) ?? { layout: 'vertical', defaultValue: '', prefix: '', suffix: '' }))
  const [filterError, setFilterError] = useState<string | null>(null)
  const [filterNotice, setFilterNotice] = useState<string | null>(null)

  // Deep-link entry from Analyst Jobs chips.
  useEffect(() => {
    const ref = consumeFocus('studio')
    if (ref) setSelId(ref)
  }, [])

  const filtered = useMemo(
    () => {
      const q = objects.filter(o => (o.name + o.backing).toLowerCase().includes(query.toLowerCase()))
      return starView === 'favorites' ? q.filter(o => favorites.includes(o.id)) : q
    },
    [objects, query, starView, favorites]
  )
  const sel = objects.find(o => o.id === selId) ?? objects[0]

  const pending = useMemo(() => computePendingChanges(baseline, objects), [baseline, objects])
  const healthRules = useMemo(() => getHealthChecks(objects), [objects])

  const addObjectType = () => {
    const id = `ot-new-${Date.now()}`
    setObjects(prev => [...prev, { id, name: 'New Object Type', icon: '✨', color: '#22c55e', backing: 'derived/new_dataset', objectCount: 0, description: '', properties: [{ name: 'id', type: 'ValueType/Id', indexed: true }] }])
    setSelId(id)
  }

  const dependentsOf = (id: string): string[] => {
    const nameOf = (oid: string) => objects.find(o => o.id === oid)?.name ?? oid
    const out: string[] = []
    for (const l of linkTypes) {
      if (l.from === id || l.to === id) out.push(`link “${l.name}” (${nameOf(l.from)} → ${nameOf(l.to)})`)
    }
    for (const a of ACTION_TYPES) if (a.objectType === id) out.push(`action “${a.name}”`)
    return out
  }
  const requestDelete = () => {
    const deps = dependentsOf(sel.id)
    setConfirmDelete({ name: sel.name, typed: '', dependents: deps })
  }
  const confirmDeleteNow = () => {
    setObjects(prev => prev.filter(o => o.id !== sel.id))
    setConfirmDelete(null)
  }

  const runValidation = () => {
    setIssues(objects.flatMap(validateObjectType))
  }

  const exportJson = () => {
    const payload = { version: 1, exportedAt: new Date().toISOString(), objectTypes: objects, linkTypes: LINK_TYPES, actionTypes: ACTION_TYPES }
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a'); a.href = url; a.download = 'ontology-export.json'; a.click(); URL.revokeObjectURL(url)
  }
  const onImport = async (file: File) => {
    setIoNotice(null)
    try {
      const j = JSON.parse(await file.text())
      if (j?.version !== 1 || !Array.isArray(j.objectTypes)) throw new Error('unsupported ontology export (need {version:1, objectTypes[]})')
      const byId = new Map(objects.map(o => [o.id, o]))
      for (const ot of j.objectTypes) byId.set(ot.id, { ...ot })
      setObjects([...byId.values()])
      setIoNotice(`Imported ${j.objectTypes.length} object types · ${byId.size} total`)
    } catch (e) {
      setIoNotice(`Import failed: ${String(e instanceof Error ? e.message : e)}`)
    }
  }

  /* ── FN-GOV-001: rebase working tree onto main (review precedes in UI; this commits) ── */
  const rebaseOntoMain = () => {
    const count = pending.length
    setBaseline(cloneTypes(objects))
    setReviewOpen(false)
    appendTrace({ kind: 'tool-call', tool: 'ontology.rebase', ok: true, ms: 0, detail: `${count} pending change(s) rebased onto main` })
    appendAudit({ event: 'ontology.rebase', pending: count, objectTypes: objects.length })
    setGovNotice(count > 0 ? `Rebased ${count} change(s) onto main` : 'Already on main — nothing to rebase')
  }

  /* ── FN-GOV-002: Force snapshot the current ontology state as a RID restore point ── */
  const forceSnapshot = () => {
    const snap = makeOntologySnapshot(objects)
    setSnapshots(prev => [snap, ...prev].slice(0, 50))
    appendTrace({ kind: 'tool-call', tool: 'ontology.snapshot', ok: true, ms: 0, detail: `${snap.id} · ${snap.objectCount} object types` })
    appendAudit({ event: 'ontology.snapshot', rid: snap.id, objectCount: snap.objectCount })
    setGovNotice(`Snapshot ${snap.id} captured · ${snap.objectCount} object types`)
  }

  const restoreSnapshot = (snap: OntologySnapshot) => {
    const restored = cloneTypes(snap.objects)
    setObjects(restored)
    setSelId(restored[0]?.id ?? selId)
    appendTrace({ kind: 'tool-call', tool: 'ontology.restore', ok: true, ms: 0, detail: `${snap.id} · ${restored.length} object types` })
    appendAudit({ event: 'ontology.restore', rid: snap.id, objectCount: restored.length })
    setGovNotice(`Restored ${snap.id} · ${restored.length} object types`)
  }

  /* ── FN-GOV-003: run the Health Checks gate over the working ontology ── */
  const runHealthChecks = () => {
    const checks = getHealthChecks(objects)
    const fails = checks.filter(c => !c.pass).length
    setHealthRun({ at: new Date().toISOString(), checks })
    appendTrace({ kind: 'tool-call', tool: 'ontology.health-checks', ok: fails === 0, ms: 0, detail: `${checks.length - fails}/${checks.length} passing` })
    appendAudit({ event: 'ontology.health-checks', passing: checks.length - fails, failing: fails })
  }

  /* ── FN-ONT-003: create / toggle link types ── */
  const openLinkDialog = () => {
    setLinkDraft({ name: '', from: objects[0]?.id ?? '', to: objects[1]?.id ?? '', cardinality: 'N ↔ N', enabled: true })
    setLinkError(null)
    setLinkDialogOpen(true)
    appendTrace({ kind: 'tool-call', tool: 'ontology.link.open', ok: true, ms: 0, detail: 'link dialog opened' })
    appendAudit({ event: 'ontology.link.open' })
  }
  const saveLinkDraft = () => {
    const errs = validateLinkDraft(linkDraft, objects)
    if (errs.length > 0) {
      setLinkError(errs[0])
      appendTrace({ kind: 'tool-call', tool: 'ontology.link.create', ok: false, ms: 0, detail: errs.join('; ') })
      appendAudit({ event: 'ontology.link.create', ok: false, errors: errs })
      return
    }
    const created = createManagedLink(linkDraft, Date.now())
    setLinkTypes(prev => [...prev, created])
    setLinkDialogOpen(false)
    setLinkError(null)
    appendTrace({ kind: 'tool-call', tool: 'ontology.link.create', ok: true, ms: 0, detail: `${created.name} · ${created.from} -> ${created.to}` })
    appendAudit({ event: 'ontology.link.create', ok: true, link: created })
  }
  const toggleLinkEnabled = (id: string) => {
    setLinkTypes(prev => prev.map(l => l.id === id ? { ...l, enabled: !l.enabled } : l))
    const next = linkTypes.find(l => l.id === id)
    appendTrace({ kind: 'tool-call', tool: 'ontology.link.toggle', ok: true, ms: 0, detail: `${id} · ${next ? !next.enabled : ''}` })
    appendAudit({ event: 'ontology.link.toggle', id, enabled: next ? !next.enabled : undefined })
  }

  /* ── FN-BLD-017: favorites Star page ── */
  const toggleFavorite = (id: string) => {
    const next = toggleFavoriteId(favorites, id)
    setFavorites(next)
    patchMeta({ ontologyFavorites: next })
    const name = objects.find(o => o.id === id)?.name ?? id
    appendTrace({ kind: 'tool-call', tool: 'ontology.favorite.toggle', ok: true, ms: 0, detail: `${name} · ${next.includes(id) ? 'starred' : 'unstarrred'}` })
    appendAudit({ event: 'ontology.favorite.toggle', id, name, starred: next.includes(id), count: next.length })
  }
  const setStarViewPersisted = (view: 'all' | 'favorites') => {
    setStarView(view)
    patchMeta({ ontologyStarView: view })
    appendTrace({ kind: 'tool-call', tool: 'ontology.favorite.view', ok: true, ms: 0, detail: view })
    appendAudit({ event: 'ontology.favorite.view', view })
  }

  /* ── FN-FLT-006/007: filter variants save ── */
  const setFilterCfgPersisted = (next: FilterVariantConfig) => {
    setFilterCfg(next)
    patchMeta({ filterVariant: next })
  }
  const saveFilterVariant = () => {
    const errs = validateFilterVariant(filterCfg)
    if (errs.length > 0) {
      setFilterError(errs[0])
      setFilterNotice(null)
      appendTrace({ kind: 'tool-call', tool: 'ontology.filter.save', ok: false, ms: 0, detail: errs.join('; ') })
      appendAudit({ event: 'ontology.filter.save', ok: false, errors: errs })
      return
    }
    setFilterError(null)
    setFilterNotice(`Saved filter · ${filterCfg.layout} · default "${formatFilterValue(filterCfg.defaultValue, filterCfg.prefix, filterCfg.suffix)}"`)
    patchMeta({ filterVariant: filterCfg })
    appendTrace({ kind: 'tool-call', tool: 'ontology.filter.save', ok: true, ms: 0, detail: `${filterCfg.layout} · ${filterCfg.defaultValue}` })
    appendAudit({ event: 'ontology.filter.save', ok: true, layout: filterCfg.layout, defaultValue: filterCfg.defaultValue, prefix: filterCfg.prefix, suffix: filterCfg.suffix })
  }

  const healthPassCount = healthRun ? healthRun.checks.filter(c => c.pass).length : 0

  return (
    <div className="module fade-in">
      <div className="module-head glass-strong">
        <div>
          <div className="module-title"><Icon name="cube" size={18} /> Ontology Studio</div>
          <div className="module-sub">Ontology Manager · object, link & action types · value-type properties</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <div style={{ width: 220 }}><input className="input" placeholder="Search object types…" value={query} onChange={e => setQuery(e.target.value)} /></div>
          <button className="btn" onClick={runValidation} title="Validate schema"><Icon name="check" size={13} /> Validate</button>
          <button className="btn" onClick={exportJson} title="Export ontology JSON"><Icon name="download" size={13} /></button>
          <button className="btn" onClick={() => importRef.current?.click()} title="Import ontology JSON"><Icon name="plus" size={13} /></button>
          <input ref={importRef} type="file" accept=".json" hidden onChange={e => e.target.files?.[0] && onImport(e.target.files[0])} />
          <button className="btn btn-primary" onClick={addObjectType}><Icon name="plus" size={13} /> New object type</button>
        </div>
      </div>

      {/* FN-GOV-001 — main-branch review / rebase bar */}
      <div className="glass-faint fade-in" data-testid="gov-branch-bar" role="region" aria-label="Main branch review and rebase" style={{ padding: '8px 12px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="chip chip-mono">main</span>
        <span className="chip chip-mono" data-testid="gov-pending-count">Pending {pending.length} change(s)</span>
        <button className="btn" data-testid="gov-review-toggle" aria-expanded={reviewOpen} aria-label="Review pending changes" onClick={() => setReviewOpen(v => !v)}><Icon name="list" size={13} /> Review</button>
        <button className="btn btn-primary" data-testid="gov-rebase" aria-label="Rebase onto main" disabled={pending.length === 0} onClick={rebaseOntoMain}><Icon name="refresh" size={13} /> Rebase onto main</button>
        <button className="btn" data-testid="gov-force-snapshot" aria-label="Force snapshot of current ontology" onClick={forceSnapshot}><Icon name="doc" size={13} /> Force snapshot</button>
        {healthRun && <span className="chip chip-mono" data-testid="gov-health-summary">{healthPassCount}/{healthRun.checks.length} health checks passing</span>}
        {govNotice && <span className="chip" data-testid="gov-notice">{govNotice}</span>}
      </div>

      {reviewOpen && (
        <div className="glass panel fade-in" data-testid="gov-review-panel" role="dialog" aria-label="Pending changes review" style={{ padding: '10px 12px' }}>
          <div className="panel-title">Pending changes vs main <span className="chip">{pending.length}</span></div>
          {pending.length === 0 ? (
            <div className="module-sub">No pending changes — working tree matches main.</div>
          ) : (
            <ul style={{ margin: '4px 0 0 18px', fontSize: 11, lineHeight: 1.7 }}>
              {pending.map(p => (
                <li key={p.id} data-testid={`gov-change-${p.id}`}>
                  <span className="chip chip-mono" style={{ marginRight: 6 }}>{p.kind}</span>{p.label}<span className="module-sub" style={{ marginLeft: 6 }}>{p.detail}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="module-body">
        {/* List */}
        <div className="glass panel" style={{ width: 250, flexShrink: 0 }}>
          <div className="panel-title">Object types <span className="chip">{filtered.length}</span></div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }} role="group" aria-label="Favorites view">
            <button className={`btn ${starView === 'all' ? 'btn-primary' : ''}`} style={{ padding: '3px 8px', fontSize: 10 }} data-testid="star-view-all" aria-pressed={starView === 'all'} onClick={() => setStarViewPersisted('all')}>All</button>
            <button className={`btn ${starView === 'favorites' ? 'btn-primary' : ''}`} style={{ padding: '3px 8px', fontSize: 10 }} data-testid="star-view-favorites" aria-pressed={starView === 'favorites'} onClick={() => setStarViewPersisted('favorites')}>★ Favorites ({favorites.length})</button>
          </div>
          {filtered.map(o => (
            <button key={o.id} onClick={() => setSelId(o.id)}
              className={`nav-item ${sel.id === o.id ? 'active' : ''}`}
              style={{ width: '100%' }}>
              <span style={{ fontSize: 15 }}>{o.icon}</span>
              <span style={{ flex: 1 }}><span role="button" tabIndex={0} data-testid={`star-${o.id}`} aria-label={`${isFavorite(favorites, o.id) ? 'Unstar' : 'Star'} ${o.name}`} aria-pressed={isFavorite(favorites, o.id)} onClick={(e) => { e.stopPropagation(); toggleFavorite(o.id) }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); toggleFavorite(o.id) } }} style={{ cursor: 'pointer' }}>{isFavorite(favorites, o.id) ? '★' : '☆'}</span> {o.name}<br /><small style={{ fontWeight: 400, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: 9 }}>{o.backing}</small></span>
              <span className="chip chip-mono">{o.objectCount}</span>
            </button>
          ))}
          {starView === 'favorites' && filtered.length === 0 && <div className="module-sub" style={{ padding: 8 }}>No favorites yet — star an object type to pin it here.</div>}
        </div>

        {/* Detail */}
        <div className="glass panel" style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <div style={{ fontSize: 30 }}>{sel.icon}</div>
            <div>
              <input className="input" style={{ fontSize: 15, fontWeight: 700, border: 'none', background: 'transparent', padding: '2px 6px', width: 280 }} value={sel.name} onChange={e => setObjects(prev => prev.map(o => o.id === sel.id ? { ...o, name: e.target.value } : o))} />
              <div className="module-sub" style={{ paddingLeft: 6 }}>{sel.description || 'No description'} · backed by <code>{sel.backing}</code></div>
            </div>
            <button className="btn btn-danger" style={{ marginLeft: 'auto' }} onClick={requestDelete}><Icon name="trash" size={13} /> Delete</button>
          </div>

          {ioNotice && <div className="chip" style={{ marginBottom: 6 }}>{ioNotice}</div>}

          {issues && (
            <div className="glass-faint fade-in" style={{ padding: '8px 10px', marginBottom: 8, maxHeight: 150, overflow: 'auto' }}>
              <div className="panel-title">Validation — {issues.length} issue(s) {issues.length === 0 && '· schema clean ✓'}<button className="btn btn-ghost" style={{ padding: '2px 6px', fontSize: 10 }} onClick={() => setIssues(null)}><Icon name="x" size={11} /></button></div>
              {issues.map((i, k) => <div key={k} style={{ fontSize: 10.5, padding: '2px 0', color: i.severity === 'error' ? '#b91c1c' : '#92400e' }}><strong>{i.severity.toUpperCase()}</strong> <code>{i.where}</code> — {i.message}</div>)}
            </div>
          )}

          <div style={{ display: 'flex', gap: 6, margin: '10px 0 8px' }}>
            {(['objects', 'links', 'actions'] as Tab[]).map(t => (
              <button key={t} className={`btn ${tab === t ? 'btn-primary' : ''}`} onClick={() => setTab(t)}>
                {t === 'objects' ? 'Properties' : t === 'links' ? 'Link types' : 'Action types'}
              </button>
            ))}
          </div>

          {tab === 'objects' && (
            <table className="tbl">
              <thead><tr><th>Property</th><th>Type</th><th>Indexed</th></tr></thead>
              <tbody>
                {sel.properties.map(p => (
                  <tr key={p.name}><td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{p.name}</td>
                    <td>
                      <select className="input" style={{ padding: '3px 6px', fontSize: 10.5 }} value={p.type} onChange={e => setObjects(prev => prev.map(o => o.id === sel.id ? { ...o, properties: o.properties.map(q => q.name === p.name ? { ...q, type: e.target.value } : q) } : o))}>
                        {VALUE_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}{t.kind === 'constrained' ? ' 🔒' : ''}</option>)}
                      </select>
                    </td>
                    <td>{p.indexed ? '✓ title' : <button className="btn btn-ghost" style={{ padding: '2px 6px', fontSize: 10 }} onClick={() => setObjects(prev => prev.map(o => o.id === sel.id ? { ...o, properties: o.properties.map(q => q.name === p.name ? { ...q, indexed: true } : q) } : o))}>make title</button>}</td></tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === 'links' && (
            <>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <button className="btn btn-primary" data-testid="link-create-open" onClick={openLinkDialog}><Icon name="plus" size={12} /> New link type</button>
                <span className="chip chip-mono">{linkTypes.length} link types</span>
              </div>
              <table className="tbl">
                <thead><tr><th>Relation</th><th>From → To</th><th>Cardinality</th><th>Enabled</th></tr></thead>
                <tbody>
                  {linkTypes.map((l: any) => (
                    <tr key={l.id}><td style={{ fontWeight: 600 }}>{l.name}</td><td>{objects.find(o => o.id === l.from)?.name} → {objects.find(o => o.id === l.to)?.name}</td><td className="chip-mono">{l.cardinality}</td><td><button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 10 }} data-testid={`link-toggle-${l.id}`} aria-pressed={l.enabled !== false} aria-label={`Toggle link ${l.name}`} onClick={() => toggleLinkEnabled(l.id)}>{l.enabled === false ? 'Disabled' : 'Enabled'}</button></td></tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          {tab === 'actions' && (
            <table className="tbl">
              <thead><tr><th>Action</th><th>Object type</th><th>Parameters</th><th>AIP</th></tr></thead>
              <tbody>
                {ACTION_TYPES.map((a: any) => (
                  <tr key={a.id}><td style={{ fontWeight: 600 }}>{a.name}</td><td>{objects.find(o => o.id === a.objectType)?.name ?? a.objectType}</td><td style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>{a.params.join(', ')}</td><td>{a.requiresAip ? <span className="chip">AIP Logic</span> : '—'}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* FN-GOV-002 RID history timeline + FN-GOV-003 Health Checks */}
      <div className="module-body">
        <div className="glass panel" style={{ flex: 1 }} data-testid="rid-history-panel" role="region" aria-label="RID history">
          <div className="panel-title">RID history <span className="chip chip-mono">{snapshots.length}</span></div>
          {snapshots.length === 0 ? (
            <div className="module-sub">No snapshots yet — use Force snapshot to capture a restore point.</div>
          ) : snapshots.map(snap => (
            <div key={snap.id} data-testid={`rid-entry-${snap.id}`} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', borderTop: '1px solid rgba(34,197,94,.18)' }}>
              <span className="chip chip-mono" title={snap.at}>{snap.id}</span>
              <span className="module-sub">{new Date(snap.at).toLocaleString()} · {snap.objectCount} object types</span>
              <button className="btn btn-ghost" style={{ marginLeft: 'auto', fontSize: 10, padding: '2px 8px' }} data-testid={`rid-restore-${snap.id}`} aria-label={`Restore snapshot ${snap.id}`} onClick={() => restoreSnapshot(snap)}>Restore</button>
            </div>
          ))}
        </div>

        <div className="glass panel" style={{ flex: 1 }} data-testid="health-checks-panel" role="region" aria-label="Health Checks">
          <div className="panel-title">Health Checks
            <button className="btn" style={{ marginLeft: 'auto', fontSize: 10, padding: '2px 8px' }} data-testid="health-run-checks" aria-label="Run health checks" onClick={runHealthChecks}><Icon name="check" size={12} /> Run checks</button>
          </div>
          {healthRun && <div className="module-sub">Ran {new Date(healthRun.at).toLocaleString()} · {healthPassCount}/{healthRun.checks.length} passing</div>}
          {!healthRun && <div className="module-sub">Validation rules listed below — run checks to gate this ontology.</div>}
          {(healthRun ? healthRun.checks : healthRules).map(c => (
            <div key={c.id} data-testid={`health-check-${c.id}`} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '5px 0', borderTop: '1px solid rgba(34,197,94,.18)', fontSize: 11 }}>
              {healthRun
                ? (c.pass
                    ? <span className="pill pill-live">Pass</span>
                    : <span className="pill pill-danger">Fail</span>)
                : <span className="pill pill-draft">Pending</span>}
              <span style={{ fontWeight: 600 }}>{c.label}</span>
              <span className="module-sub" style={{ marginLeft: 'auto', textAlign: 'right' }}>{c.detail}</span>
            </div>
          ))}
        </div>
      </div>

      {/* FN-FLT-006/007 — filter variants (Vertical vs Pills + defaults) */}
      <div className="glass panel" data-testid="filter-variants-panel" role="region" aria-label="Filter variants" style={{ marginBottom: 8 }}>
        <div className="panel-title">Filter variants <span className="chip chip-mono">FN-FLT-006 · FN-FLT-007</span>{filterNotice && <span className="chip" data-testid="filter-notice" style={{ marginLeft: 'auto' }}>{filterNotice}</span>}</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <div className="label">Layout</div>
            <div style={{ display: 'flex', gap: 4 }} role="group" aria-label="Filter layout">
              <button className={`btn ${filterCfg.layout === 'vertical' ? 'btn-primary' : ''}`} style={{ padding: '4px 10px', fontSize: 11 }} data-testid="filter-layout-vertical" aria-pressed={filterCfg.layout === 'vertical'} onClick={() => setFilterCfgPersisted({ ...filterCfg, layout: 'vertical' })}>Vertical</button>
              <button className={`btn ${filterCfg.layout === 'pills' ? 'btn-primary' : ''}`} style={{ padding: '4px 10px', fontSize: 11 }} data-testid="filter-layout-pills" aria-pressed={filterCfg.layout === 'pills'} onClick={() => setFilterCfgPersisted({ ...filterCfg, layout: 'pills' })}>Pills</button>
            </div>
          </div>
          <div>
            <div className="label">Default value</div>
            <input className="input" data-testid="filter-default" value={filterCfg.defaultValue} onChange={e => setFilterCfgPersisted({ ...filterCfg, defaultValue: e.target.value })} placeholder="e.g. bbl" spellCheck={false} style={{ width: 140 }} />
          </div>
          <div>
            <div className="label">Prefix</div>
            <input className="input" data-testid="filter-prefix" value={filterCfg.prefix} onChange={e => setFilterCfgPersisted({ ...filterCfg, prefix: e.target.value })} placeholder="pre_" spellCheck={false} style={{ width: 90 }} />
          </div>
          <div>
            <div className="label">Suffix</div>
            <input className="input" data-testid="filter-suffix" value={filterCfg.suffix} onChange={e => setFilterCfgPersisted({ ...filterCfg, suffix: e.target.value })} placeholder="_bbl" spellCheck={false} style={{ width: 90 }} />
          </div>
          <button className="btn btn-primary" data-testid="filter-save" onClick={saveFilterVariant}><Icon name="check" size={12} /> Save filter</button>
        </div>
        {filterError && <div role="alert" className="chip" data-testid="filter-error" style={{ marginTop: 8, background: 'var(--danger-bg)', color: 'var(--danger)' }}>{filterError}</div>}
        <div data-testid={`filter-preview-${filterCfg.layout}`} style={{ marginTop: 8, display: 'flex', gap: filterCfg.layout === 'pills' ? 6 : 0, flexDirection: filterCfg.layout === 'vertical' ? 'column' : 'row', flexWrap: 'wrap' }}>
          <span className="chip chip-mono">preview: {filterCfg.layout}</span>
          <span className="chip">{formatFilterValue(filterCfg.defaultValue, filterCfg.prefix, filterCfg.suffix) || 'empty default'}</span>
          <span className="chip chip-mono">{formatFilterValue('All', filterCfg.prefix, filterCfg.suffix)}</span>
        </div>
      </div>

      {/* FN-ONT-003 — link create dialog */}
      {linkDialogOpen && (
        <div className="palette-overlay" onMouseDown={() => setLinkDialogOpen(false)}>
          <div className="glass-strong fade-in" data-testid="link-create-dialog" role="dialog" aria-label="New link type" style={{ width: 440, padding: 16, borderRadius: 'var(--r-md)' }} onMouseDown={e => e.stopPropagation()}>
            <div className="module-title" style={{ fontSize: 14 }}><Icon name="plus" size={16} /> New link type <span className="chip chip-mono" style={{ marginLeft: 6 }}>FN-ONT-003</span></div>
            <div className="label">Link name</div>
            <input className="input" data-testid="link-name" value={linkDraft.name} onChange={e => setLinkDraft({ ...linkDraft, name: e.target.value })} placeholder="e.g. Supplied By" spellCheck={false} autoFocus />
            <div className="label">From object type</div>
            <select className="input" data-testid="link-from" value={linkDraft.from} onChange={e => setLinkDraft({ ...linkDraft, from: e.target.value })}>
              {objects.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <div className="label">To object type</div>
            <select className="input" data-testid="link-to" value={linkDraft.to} onChange={e => setLinkDraft({ ...linkDraft, to: e.target.value })}>
              {objects.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <div className="label">Cardinality</div>
            <input className="input" data-testid="link-cardinality" value={linkDraft.cardinality} onChange={e => setLinkDraft({ ...linkDraft, cardinality: e.target.value })} spellCheck={false} />
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11, marginTop: 10 }}>
              <input type="checkbox" data-testid="link-enabled" checked={linkDraft.enabled} onChange={e => setLinkDraft({ ...linkDraft, enabled: e.target.checked })} /> Enabled on create
            </label>
            {linkError && <div role="alert" className="chip" data-testid="link-error" style={{ marginTop: 8, background: 'var(--danger-bg)', color: 'var(--danger)' }}>{linkError}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => { setLinkDialogOpen(false); setLinkError(null) }}>Cancel</button>
              <button className="btn btn-primary" data-testid="link-save" onClick={saveLinkDraft}><Icon name="check" size={13} /> Create link</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation — typed-name + dependents */}
      {confirmDelete && (
        <div className="palette-overlay" style={{ alignItems: 'flex-start', paddingTop: '18vh' }} onMouseDown={() => setConfirmDelete(null)}>
          <div className="glass-strong fade-in" style={{ width: 440, padding: 16, borderRadius: 'var(--r-md)' }} onMouseDown={e => e.stopPropagation()}>
            <div className="module-title" style={{ fontSize: 14 }}><Icon name="trash" size={16} /> Delete “{confirmDelete.name}”?</div>
            {confirmDelete.dependents.length > 0 ? (
              <>
                <div className="label">Dependents affected</div>
                <ul style={{ margin: '4px 0 0 18px', fontSize: 11, lineHeight: 1.7 }}>{confirmDelete.dependents.map((d, i) => <li key={i}>{d}</li>)}</ul>
              </>
            ) : <div className="module-sub" style={{ marginTop: 6 }}>No dependents — safe to delete.</div>}
            <div className="label">Type the object type name to confirm</div>
            <input className="input" value={confirmDelete.typed} onChange={e => setConfirmDelete({ ...confirmDelete, typed: e.target.value })} placeholder={confirmDelete.name} autoFocus />
            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn btn-danger" disabled={confirmDelete.typed.trim() !== confirmDelete.name} onClick={confirmDeleteNow}><Icon name="trash" size={13} /> Delete forever</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
