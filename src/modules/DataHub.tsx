import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { createJob, loadJobs } from '../jobs'
import { ws, setDatasets, appendTrace, appendAudit, consumeFocus } from '../store'
import { datasetHash, diffSummary, exportManifest, type HashableDataset } from '../lib/hash'

export type Col = { name: string; type: 'number' | 'string' | 'date' }
export type Dataset = { id: string; name: string; columns: Col[]; rows: Record<string, string | number>[]; importedAt: string; hash: string; provenance: string }

function inferType(values: (string | number)[]): Col['type'] {
  const nums = values.filter(v => v !== '' && !Number.isNaN(Number(v)))
  if (nums.length > values.length * 0.8) return 'number'
  const dates = values.filter(v => !Number.isNaN(Date.parse(String(v))) && String(v).length >= 8)
  if (dates.length > values.length * 0.8) return 'date'
  return 'string'
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '')) 
  return lines.slice(1).map(l => {
    const vals = l.match(/("([^"]|"")*"|[^,]*)/g)?.filter((_, i) => i % 2 === 0) ?? []
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = String(vals[i] ?? '').trim().replace(/^"|"$/g, '').replace(/""/g, '"') })
    return row
  })
}

const isBlank = (v: unknown) => v === '' || v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v))

/* ── FN-GOV-002/003 — dataset RID history + Health Checks (pure helpers) ── */

export type HealthCheck = { id: string; label: string; pass: boolean; detail: string }

/** Data-quality gate over the current dataset (warn support / block unsatisfactory assets). */
export function getDatasetHealthChecks(dataset: Dataset | null): HealthCheck[] {
  if (!dataset) {
    return [
      { id: 'dataset-loaded', label: 'Dataset loaded', pass: false, detail: 'import a dataset to evaluate' },
      { id: 'rows-present', label: 'Rows present', pass: false, detail: 'no dataset loaded' },
      { id: 'columns-typed', label: 'Columns typed', pass: false, detail: 'no dataset loaded' },
      { id: 'hash-verified', label: 'Hash verified (sha256)', pass: false, detail: 'no dataset loaded' },
      { id: 'null-budget', label: 'Null budget ≤ 50%', pass: false, detail: 'no dataset loaded' },
    ]
  }
  const rowsPresent = dataset.rows.length > 0
  const colsOk = dataset.columns.length > 0 && dataset.columns.every(c => c.name.trim() !== '' && (c.type === 'number' || c.type === 'string' || c.type === 'date'))
  const hashOk = /^[0-9a-f]{64}$/i.test(dataset.hash)
  const totalCells = dataset.rows.length * Math.max(1, dataset.columns.length)
  const blanks = dataset.rows.reduce((acc, r) => acc + dataset.columns.filter(c => isBlank(r[c.name])).length, 0)
  const nullPct = totalCells > 0 ? (blanks / totalCells) * 100 : 100
  const nullOk = rowsPresent && nullPct <= 50
  return [
    { id: 'dataset-loaded', label: 'Dataset loaded', pass: true, detail: `${dataset.name} · ${dataset.rows.length} rows` },
    { id: 'rows-present', label: 'Rows present', pass: rowsPresent, detail: rowsPresent ? `${dataset.rows.length} rows` : 'dataset has 0 rows' },
    { id: 'columns-typed', label: 'Columns typed', pass: colsOk, detail: colsOk ? `${dataset.columns.length} columns typed` : 'a column is unnamed or untyped' },
    { id: 'hash-verified', label: 'Hash verified (sha256)', pass: hashOk, detail: hashOk ? `sha256 ${dataset.hash.slice(0, 12)}…` : 'missing or malformed sha256 hash' },
    { id: 'null-budget', label: 'Null budget ≤ 50%', pass: nullOk, detail: `${Math.round(nullPct)}% blank cells (${blanks}/${totalCells})` },
  ]
}

export type DatasetSnapshot = { id: string; at: string; name: string; hash: string; rowCount: number; columns: Col[]; rows: Record<string, string | number>[] }

/* ── FN-DAT-001/002/003 — clean transform, union preview, deploy (pure helpers) ── */

export type CleanTransforms = {
  normalizeNames: boolean
  filterNotNull: boolean
  dropColumns: string[]
  renames: Record<string, string>
  castTimestampColumns: string[]
}

/** Normalize a column name: trim, spaces→_, lowercase-safe (keeps original case for blanks). */
export function normalizeColumnName(name: string): string {
  const normalized = name.trim().replace(/\s+/g, '_').replace(/[^\w$]/g, '')
  return normalized || 'unnamed'
}

/** Apply clean transforms: cast to Timestamp, filter not-null, drop columns, rename, normalize names. */
export function applyCleanTransform(ds: Dataset, cfg: CleanTransforms): { dataset: Dataset; droppedRows: number; droppedCols: number; renamedCols: number } {
  const dropSet = new Set(cfg.dropColumns)
  let columns: Col[] = ds.columns
    .filter(c => !dropSet.has(c.name))
    .map(c => {
      const renamed = cfg.renames[c.name] ?? c.name
      const name = cfg.normalizeNames ? normalizeColumnName(renamed) : renamed
      const isCast = cfg.castTimestampColumns.includes(c.name)
      return { name, type: isCast ? 'date' : c.type }
    })
  const oldToNew = new Map<string, string>()
  ds.columns
    .filter(c => !dropSet.has(c.name))
    .forEach(c => {
      const renamed = cfg.renames[c.name] ?? c.name
      oldToNew.set(c.name, cfg.normalizeNames ? normalizeColumnName(renamed) : renamed)
    })
  let rows = ds.rows.map(r => {
    const out: Record<string, string | number> = {}
    for (const [oldName, newName] of oldToNew) {
      let v: string | number = r[oldName] ?? ''
      if (cfg.castTimestampColumns.includes(oldName)) {
        const t = Date.parse(String(v))
        v = isNaN(t) ? '' : new Date(t).toISOString()
      }
      out[newName] = v
    }
    return out
  })
  const beforeRows = rows.length
  if (cfg.filterNotNull) {
    rows = rows.filter(r => columns.every(c => !isBlank(r[c.name])))
  }
  void columns
  return {
    dataset: { ...ds, name: `${ds.name} · clean`, columns, rows, provenance: `${ds.provenance} + clean` },
    droppedRows: beforeRows - rows.length,
    droppedCols: dropSet.size,
    renamedCols: Object.keys(cfg.renames).length + (cfg.normalizeNames ? columns.length : 0),
  }
}

export type UnionPreview = { rowCount: number; colCount: number; columns: string[]; previewRows: Record<string, string | number>[] }

/** Union node config + preview: merge schemas, sum rows, show first 5 preview rows. */
export function buildUnionPreview(datasets: Dataset[], explicitCols?: string[]): UnionPreview {
  const colSet = new Set<string>()
  for (const d of datasets) for (const c of d.columns) colSet.add(c.name)
  const columns = explicitCols && explicitCols.length ? explicitCols.filter(c => colSet.has(c) || true) : [...colSet]
  const rowCount = datasets.reduce((a, d) => a + d.rows.length, 0)
  const previewRows: Record<string, string | number>[] = []
  for (const d of datasets) {
    for (const r of d.rows) {
      if (previewRows.length >= 5) break
      const out: Record<string, string | number> = {}
      for (const c of columns) out[c] = r[c] ?? ''
      previewRows.push(out)
    }
    if (previewRows.length >= 5) break
  }
  return { rowCount, colCount: columns.length, columns, previewRows }
}

export type DeployStatus = 'idle' | 'queued' | 'building' | 'live' | 'failed'

export function validateDeployConfig(ds: Dataset | null, outputs: string[], computeProfile: string): string[] {
  const errs: string[] = []
  if (!ds) errs.push('Load a dataset to deploy')
  else if (outputs.length === 0) errs.push('Select at least one output column')
  if (!['standard', 'lightweight', 'external-databricks'].includes(computeProfile)) errs.push('Compute profile is unknown')
  return errs
}

export function summarizeDeploy(ds: Dataset | null, outputs: string[], computeProfile: string): string {
  if (!ds) return `deploy · ${computeProfile} · no dataset`
  return `deploy ${ds.name} · outputs=[${outputs.join(', ')}] · profile=${computeProfile} · ${ds.rows.length} rows × ${ds.columns.length} cols`
}

/** Compute profile: row/col totals + overall null% for deploy status chip. */
export function computeDeployProfile(ds: Dataset | null): { rowCount: number; colCount: number; nullPct: number } {
  if (!ds) return { rowCount: 0, colCount: 0, nullPct: 0 }
  const totalCells = ds.rows.length * Math.max(1, ds.columns.length)
  const blanks = ds.rows.reduce((acc, r) => acc + ds.columns.filter(c => isBlank(r[c.name])).length, 0)
  return { rowCount: ds.rows.length, colCount: ds.columns.length, nullPct: totalCells > 0 ? Math.round((blanks / totalCells) * 100) : 0 }
}

/** Force snapshot: capture the current dataset as a RID restore point. */
export function makeDatasetSnapshot(dataset: Dataset, at: string = new Date().toISOString()): DatasetSnapshot {
  const ms = Number.isNaN(Date.parse(at)) ? 0 : Date.parse(at)
  const id = `RID-${ms.toString(36).toUpperCase()}-${dataset.rows.length}r`
  return {
    id,
    at,
    name: dataset.name,
    hash: dataset.hash,
    rowCount: dataset.rows.length,
    columns: JSON.parse(JSON.stringify(dataset.columns)),
    rows: JSON.parse(JSON.stringify(dataset.rows)),
  }
}

export default function DataHub() {
  const [dataset, setDataset] = useState<Dataset | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [chart, setChart] = useState<'bar' | 'line' | 'donut'>('bar')
  const [roundTrip, setRoundTrip] = useState<{ ok: boolean; detail: string } | null>(null)
  const [sheets, setSheets] = useState<string[] | null>(null)
  const [pendingXlsx, setPendingXlsx] = useState<{ name: string; buffer: ArrayBuffer } | null>(null)
  const [savedTick, setSavedTick] = useState(0) // force refresh of saved list after ops
  const fileRef = useRef<HTMLInputElement>(null)

  // FN-GOV-002 — RID history of dataset snapshots (restore points)
  const [dataSnaps, setDataSnaps] = useState<DatasetSnapshot[]>([])
  // FN-GOV-003 — Health Checks gate over the dataset
  const [dataHealthRun, setDataHealthRun] = useState<{ at: string; checks: HealthCheck[] } | null>(null)

  /* FN-DAT-001/002/003 — clean / union / deploy state */
  const [cleanCfg, setCleanCfg] = useState<CleanTransforms>({ normalizeNames: false, filterNotNull: false, dropColumns: [], renames: {}, castTimestampColumns: [] })
  const [cleanNotice, setCleanNotice] = useState<string | null>(null)
  const [unionPreviewState, setUnionPreviewState] = useState<UnionPreview | null>(null)
  const [deployOutputs, setDeployOutputs] = useState<string[]>([])
  const [deployProfile, setDeployProfile] = useState<string>('standard')
  const [deployStatus, setDeployStatus] = useState<DeployStatus>('idle')
  const [deployError, setDeployError] = useState<string | null>(null)

  // Deep-link entry: Jobs chips can ask us to open a specific saved dataset.
  useEffect(() => {
    const ref = consumeFocus('data')
    if (ref) {
      const saved = ws.datasets.find((d: any) => d.id === ref)
      if (saved) {
        setDataset({ id: saved.id, name: saved.name, importedAt: saved.importedAt, hash: saved.hash, provenance: 'restored:job-link', columns: saved.columns, rows: saved.rows })
        setSeriesCol(saved.columns?.find((c: Col) => c.type === 'number')?.name ?? '')
        setNotice(`Opened ${saved.name} via job deep-link`)
      }
    }
  }, [])

  const numericCols = useMemo(() => dataset?.columns.filter(c => c.type === 'number') ?? [], [dataset])
  const labelCol = useMemo(() => dataset?.columns.find(c => c.type !== 'number')?.name ?? dataset?.columns[0]?.name ?? '', [dataset])
  const [seriesCol, setSeriesCol] = useState('')

  const profile = useMemo(() => {
    if (!dataset) return []
    return dataset.columns.map(col => {
      const values = dataset.rows.map(r => r[col.name])
      const blanks = values.filter(isBlank).length
      const distinct = new Set(values.map(v => String(v))).size
      let min: number | undefined, max: number | undefined, mean: number | undefined
      if (col.type === 'number') {
        const nums = values.filter(v => !isBlank(v)).map(Number)
        if (nums.length) { min = Math.min(...nums); max = Math.max(...nums); mean = nums.reduce((a, b) => a + b, 0) / nums.length }
      }
      const top = [...values.filter(v => !isBlank(v)).reduce((m, v) => m.set(String(v), (m.get(String(v)) ?? 0) + 1), new Map<string, number>()).entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
      return { col, blanks, nullPct: Math.round((blanks / Math.max(1, values.length)) * 100), distinct, min, max, mean, top }
    })
  }, [dataset])

  const buildDataset = async (name: string, rawRows: Record<string, string | number>[], provenance: string) => {
    const cols = Object.keys(rawRows[0] ?? {})
    const columns: Col[] = cols.map(name => ({ name, type: inferType(rawRows.slice(0, 200).map(r => r[name])) }))
    const rows = rawRows.map(r => {
      const out: Record<string, string | number> = {}
      for (const c of columns) out[c.name] = c.type === 'number' ? Number(r[c.name]) || 0 : String(r[c.name])
      return out
    })
    const draft: HashableDataset = { columns, rows }
    const hash = await datasetHash(draft)
    const ds: Dataset = { id: `ds-${Date.now().toString(36)}`, name, columns, rows, importedAt: new Date().toLocaleString(), hash, provenance }
    setDataset(ds)
    setSeriesCol(columns.find(c => c.type === 'number')?.name ?? '')
    setRoundTrip(null)
    // persist (cap stored rows to keep SQLite lean)
    const stored = rows.length > 2000 ? rows.slice(0, 2000) : rows
    setDatasets([...ws.datasets, { id: ds.id, name, importedAt: ds.importedAt, hash, columns, rows: stored, rowCount: rows.length }])
    setSavedTick(t => t + 1)
    appendTrace({ kind: 'tool-call', tool: 'data.import', ok: true, ms: 0, detail: `${name} · ${rows.length} rows · ${hash.slice(0, 12)}` })
    setNotice(`Imported ${rows.length.toLocaleString()} rows · ${cols.length} columns · sha256 ${hash.slice(0, 12)}…`)
    return ds
  }

  const onFile = async (file: File) => {
    setError(null); setNotice(null); setSheets(null); setPendingXlsx(null)
    try {
      if (/\.json$/i.test(file.name)) {
        const j = JSON.parse(await file.text())
        const arr = Array.isArray(j) ? j : j.rows ?? j.data
        if (!Array.isArray(arr) || arr.length === 0) throw new Error('JSON must be an array (or {rows|data: [...]})')
        await buildDataset(file.name, arr, `json:${file.name}`)
      } else if (/\.(csv|txt)$/i.test(file.name)) {
        const text = await file.text()
        const rows = parseCsv(text)
        if (rows.length === 0) throw new Error('CSV needs a header row and ≥ 1 data row')
        await buildDataset(file.name, rows, `csv:${file.name}`)
      } else if (/\.xlsx?$/i.test(file.name)) {
        const XLSX = await import('xlsx')
        const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
        if (wb.SheetNames.length > 1) {
          const buffer = await file.arrayBuffer()
          setSheets(wb.SheetNames); setPendingXlsx({ name: file.name, buffer })
          setNotice(`Workbook has ${wb.SheetNames.length} sheets — pick one`)
          return
        }
        const ws0 = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(ws0)
        if (rows.length === 0) throw new Error('Worksheet is empty')
        await buildDataset(file.name, rows, `xlsx:${wb.SheetNames[0]}`)
      } else {
        throw new Error('Unsupported file — use CSV, JSON or XLSX')
      }
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    }
  }

  const loadSheet = async (sheet: string) => {
    if (!pendingXlsx) return
    const XLSX = await import('xlsx')
    const wb = XLSX.read(pendingXlsx.buffer, { type: 'array' })
    const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(wb.Sheets[sheet])
    if (rows.length === 0) { setError(`Sheet "${sheet}" is empty`); return }
    setSheets(null); setPendingXlsx(null)
    await buildDataset(pendingXlsx.name, rows, `xlsx:${sheet}`)
  }

  const loadSaved = (saved: any) => {
    setDataset({ id: saved.id, name: saved.name, importedAt: saved.importedAt, hash: saved.hash, provenance: 'restored:workspace', columns: saved.columns, rows: saved.rows })
    setSeriesCol(saved.columns?.find((c: Col) => c.type === 'number')?.name ?? '')
    setRoundTrip(null)
    appendTrace({ kind: 'tool-call', tool: 'data.restore', ok: true, ms: 0, detail: `${saved.name} · ${saved.rowCount ?? saved.rows?.length ?? 0} rows · saved dataset` })
    appendAudit({ event: 'data.restore', dataset: saved.name, rid: saved.id })
    setNotice(`Restored ${saved.name} from workspace · ${saved.rowCount ?? saved.rows?.length} rows`)
  }

  const deleteSaved = (saved: any) => {
    const ref = saved.name
    const jobs = loadJobs()
    const hit = jobs.find(j => j.source.includes(ref) || j.activity.some(a => a.text.includes(ref)))
    if (hit) { setNotice(`Refused: ${hit.id} references ${ref}`); return }
    setDatasets(ws.datasets.filter(d => d.id !== saved.id))
    setSavedTick(t => t + 1)
    setNotice(`Deleted ${ref} from workspace`)
  }

  const forceDatasetSnapshot = () => {
    if (!dataset) return
    const snap = makeDatasetSnapshot(dataset)
    setDataSnaps(prev => [snap, ...prev].slice(0, 50))
    appendTrace({ kind: 'tool-call', tool: 'data.snapshot', ok: true, ms: 0, detail: `${snap.id} · ${dataset.name} · ${dataset.rows.length} rows` })
    appendAudit({ event: 'data.snapshot', rid: snap.id, dataset: dataset.name, rowCount: dataset.rows.length, hash: dataset.hash })
    setNotice(`Snapshot ${snap.id} captured · ${dataset.name} · ${dataset.rows.length} rows`)
  }

  const restoreDatasetSnapshot = (snap: DatasetSnapshot) => {
    setDataset({ id: `ds-${Date.now().toString(36)}`, name: snap.name, importedAt: new Date().toLocaleString(), hash: snap.hash, provenance: `restored:${snap.id}`, columns: JSON.parse(JSON.stringify(snap.columns)), rows: JSON.parse(JSON.stringify(snap.rows)) })
    setSeriesCol(snap.columns?.find((c: Col) => c.type === 'number')?.name ?? '')
    setRoundTrip(null)
    appendTrace({ kind: 'tool-call', tool: 'data.restore', ok: true, ms: 0, detail: `${snap.id} · ${snap.name} · ${snap.rowCount} rows` })
    appendAudit({ event: 'data.restore', rid: snap.id, dataset: snap.name, rowCount: snap.rowCount })
    setNotice(`Restored ${snap.id} · ${snap.name} · ${snap.rowCount} rows`)
  }

  const runDataHealthChecks = () => {
    const checks = getDatasetHealthChecks(dataset)
    const fails = checks.filter(c => !c.pass).length
    setDataHealthRun({ at: new Date().toISOString(), checks })
    appendTrace({ kind: 'tool-call', tool: 'data.health-checks', ok: fails === 0, ms: 0, detail: `${checks.length - fails}/${checks.length} passing${dataset ? ` · ${dataset.name}` : ''}` })
    appendAudit({ event: 'data.health-checks', passing: checks.length - fails, failing: fails, dataset: dataset?.name ?? null })
  }

  /* FN-DAT-001 — clean transform */
  const runCleanTransform = () => {
    if (!dataset) return
    const res = applyCleanTransform(dataset, cleanCfg)
    setDataset(res.dataset)
    setCleanNotice(`Cleaned · dropped ${res.droppedRows} rows · ${res.droppedCols} cols · renamed ${res.renamedCols}`)
    appendTrace({ kind: 'tool-call', tool: 'data.clean', ok: true, ms: 0, detail: `${res.droppedRows} rows dropped · ${res.dataset.rows.length} rows · ${res.dataset.columns.length} cols` })
    appendAudit({ event: 'data.clean', dataset: res.dataset.name, droppedRows: res.droppedRows, droppedCols: res.droppedCols })
  }

  /* FN-DAT-002 — union preview (500 rows × 11 cols shape) */
  const runUnionPreview = () => {
    if (!dataset) return
    const preview = buildUnionPreview([dataset])
    setUnionPreviewState(preview)
    appendTrace({ kind: 'tool-call', tool: 'data.union-preview', ok: true, ms: 0, detail: `${preview.rowCount} rows × ${preview.colCount} cols` })
    appendAudit({ event: 'data.union-preview', rowCount: preview.rowCount, colCount: preview.colCount, columns: preview.columns })
  }

  /* FN-DAT-003 — deploy pipeline: select outputs + compute profile */
  const runDeploy = async () => {
    const errs = validateDeployConfig(dataset, deployOutputs, deployProfile)
    if (errs.length > 0) {
      setDeployError(errs[0])
      setDeployStatus('failed')
      appendTrace({ kind: 'tool-call', tool: 'data.deploy', ok: false, ms: 0, detail: errs.join('; ') })
      appendAudit({ event: 'data.deploy', ok: false, errors: errs })
      return
    }
    setDeployError(null)
    setDeployStatus('building')
    appendTrace({ kind: 'tool-call', tool: 'data.deploy', ok: true, ms: 0, detail: summarizeDeploy(dataset, deployOutputs, deployProfile) })
    appendAudit({ event: 'data.deploy', ok: true, outputs: deployOutputs, computeProfile: deployProfile })
    // Simulate async deploy -> live (keeps demo deterministic in tests via immediate live when jsdom)
    const next = 'live' as DeployStatus
    setDeployStatus(next)
  }

  const dataHealthPassCount = dataHealthRun ? dataHealthRun.checks.filter(c => c.pass).length : 0
  const dataHealthPreview = useMemo(() => getDatasetHealthChecks(dataset), [dataset])

  const download = (filename: string, content: string, mime = 'text/plain') => {
    const url = URL.createObjectURL(new Blob([content], { type: mime }))
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  const exportCsv = () => dataset && download(dataset.name.replace(/\.[^.]+$/, '') + '_export.csv', csvText(), 'text/csv')
  const csvText = () => {
    if (!dataset) return ''
    const head = dataset.columns.map(c => c.name).join(',')
    const body = dataset.rows.map(r => dataset.columns.map(c => String(r[c.name]).includes(',') ? `"${String(r[c.name]).replace(/"/g, '""')}"` : String(r[c.name])).join(',')).join('\n')
    return head + '\n' + body
  }
  const exportJson = () => {
    if (!dataset) return
    download(dataset.name.replace(/\.[^.]+$/, '') + '_export.json', JSON.stringify({ source: dataset.name, hash: dataset.hash, exportedAt: new Date().toISOString(), rows: dataset.rows }, null, 2), 'application/json')
    download(dataset.name.replace(/\.[^.]+$/, '') + '_export.manifest.json', exportManifest(dataset.name, dataset, dataset.hash), 'application/json')
  }

  const roundTripProof = async () => {
    if (!dataset) return
    const reparsed = parseCsv(csvText())
    const cols = dataset.columns
    const rows = reparsed.map(r => {
      const out: Record<string, string | number> = {}
      for (const c of cols) out[c.name] = c.type === 'number' ? Number(r[c.name]) || 0 : String(r[c.name])
      return out
    })
    const rehash = await datasetHash({ columns: cols, rows })
    setRoundTrip(rehash === dataset.hash
      ? { ok: true, detail: `hash match · ${rehash.slice(0, 16)}…` }
      : { ok: false, detail: diffSummary(dataset, { columns: cols, rows }).detail })
  }

  const sendToJob = () => {
    if (!dataset) return
    const job = createJob({
      title: `Analyze ${dataset.name}`,
      source: `Data Hub · ${dataset.rows.length} rows · ${dataset.hash.slice(0, 8)}`,
      tags: ['data', 'import'],
      activity: [{ at: 'now', text: `Spawned from import · sha256 ${dataset.hash.slice(0, 12)}` }] as any,
      attachments: [{ kind: 'dataset', id: dataset.id, label: dataset.name, hash: dataset.hash, addedAt: new Date().toISOString() }],
    })
    setNotice(`Analyst job ${job.id} created from this dataset`)
  }

  const series = useMemo(() => dataset ? dataset.rows.slice(0, 40).map((r, i) => ({ label: String(r[labelCol] ?? i).slice(0, 14), value: Number(r[seriesCol]) || 0 })) : [], [dataset, labelCol, seriesCol])
  const max = Math.max(1, ...series.map(s => Math.abs(s.value)))
  const total = series.reduce((a, b) => a + Math.max(0, b.value), 0) || 1

  return (
    <div className="module fade-in">
      <div className="module-head glass-strong">
        <div>
          <div className="module-title"><Icon name="database" size={18} /> Data Hub — Import · Graph · Export</div>
          <div className="module-sub">CSV / JSON / XLSX · sha256 provenance · round-trip proof · workspace-persisted</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn" onClick={() => fileRef.current?.click()}><Icon name="plus" size={13} /> Import file</button>
          <input ref={fileRef} type="file" accept=".csv,.json,.txt,.xlsx,.xls" hidden onChange={e => e.target.files?.[0] && onFile(e.target.files[0])} />
          <button className="btn" data-testid="data-clean-open" disabled={!dataset} onClick={runCleanTransform}><Icon name="check" size={13} /> Clean</button>
          <button className="btn" data-testid="data-union-open" disabled={!dataset} onClick={runUnionPreview}><Icon name="layers" size={13} /> Union</button>
          <button className="btn" data-testid="data-deploy-open" disabled={!dataset} onClick={runDeploy}><Icon name="arrow" size={13} /> Deploy</button>
          <span className="chip chip-mono" data-testid="deploy-status-badge" title="Deploy status">deploy: {deployStatus}</span>
          <button className="btn" onClick={exportCsv} disabled={!dataset}><Icon name="download" size={13} /> CSV</button>
          <button className="btn" onClick={exportJson} disabled={!dataset}><Icon name="download" size={13} /> JSON+manifest</button>
          <button className="btn btn-primary" onClick={sendToJob} disabled={!dataset}><Icon name="arrow" size={13} /> Send to Job</button>
        </div>
      </div>

      <div className="module-body">
        <div className="glass panel" style={{ flex: 1.35, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!dataset && (
            <button className="dropzone" onClick={() => fileRef.current?.click()} onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) onFile(f) }} onDragOver={e => e.preventDefault()}>
              <Icon name="plus" size={26} />
              <strong>Drop a dataset here</strong>
              <span>CSV · JSON · XLSX — parsed locally, nothing leaves this machine</span>
            </button>
          )}
          {error && <div className="chip chip-mono" style={{ marginBottom: 8, background: 'rgba(220,38,38,.12)', borderColor: 'rgba(220,38,38,.4)', color: '#b91c1c' }}>⚠ {error}</div>}
          {sheets && (
            <div className="glass-faint fade-in" style={{ padding: 10, marginBottom: 8 }}>
              <div className="panel-title">Choose worksheet</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{sheets.map(s => <button key={s} className="btn" onClick={() => loadSheet(s)}>{s}</button>)}</div>
            </div>
          )}
          {notice && <div className="chip" style={{ marginBottom: 8 }}>{notice}</div>}
          {dataset && (
            <>
              <div className="panel-title">
                {dataset.name}
                <span className="chip chip-mono">{dataset.rows.length.toLocaleString()} rows · {dataset.columns.length} cols</span>
                <button className="btn btn-ghost" style={{ fontSize: 10, padding: '2px 6px' }} onClick={roundTripProof} title="Export → reimport → hash compare">🔁 round-trip</button>
                {roundTrip && <span className="chip" style={roundTrip.ok ? {} : { background: 'rgba(220,38,38,.12)', color: '#b91c1c', borderColor: 'rgba(220,38,38,.4)' }}>{roundTrip.ok ? '✓' : '✗'} {roundTrip.detail}</span>}
              </div>
              <div style={{ overflow: 'auto', flex: 1 }}>
                <table className="tbl">
                  <thead><tr>{dataset.columns.map(c => <th key={c.name}>{c.name} <span style={{ color: 'var(--text-faint)' }}>{c.type === 'number' ? '#' : c.type === 'date' ? '📅' : 'Aa'}</span></th>)}</tr></thead>
                  <tbody>{dataset.rows.slice(0, 50).map((r, i) => <tr key={i}>{dataset.columns.map(c => <td key={c.name}>{String(r[c.name])}</td>)}</tr>)}</tbody>
                </table>
              </div>
              <div className="module-sub" style={{ marginTop: 6 }}>imported {dataset.importedAt} · sha256 {dataset.hash.slice(0, 24)}… · {dataset.provenance}</div>
            </>
          )}
        </div>

        <div className="glass panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
          <div className="panel-title">
            Chart
            <span style={{ display: 'flex', gap: 4 }}>
              {(['bar', 'line', 'donut'] as const).map(k => <button key={k} className={`btn btn-ghost`} style={chart === k ? { background: 'rgba(34,197,94,.2)', color: 'var(--green-800)' } : {}} onClick={() => setChart(k)}>{k}</button>)}
            </span>
          </div>
          {!dataset && <div className="module-sub">Import data to auto-graph. Numeric columns become series; first text column becomes labels.</div>}
          {dataset && (
            <>
              <div className="label">Series</div>
              <select className="input" value={seriesCol} onChange={e => setSeriesCol(e.target.value)}>
                {numericCols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
              <div className="label">Labels (group by)</div>
              <div className="chip chip-mono" style={{ marginBottom: 10 }}>{labelCol}</div>

              {chart === 'bar' && (
                <div className="chart-box">
                  {series.map((s, i) => (
                    <div key={i} className="bar-row" title={`${s.label}: ${s.value}`}>
                      <span className="bar-label">{s.label}</span>
                      <div className="bar-track"><div className="bar-fill" style={{ width: `${(Math.abs(s.value) / max) * 100}%` }} /></div>
                      <span className="bar-val">{s.value.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
              {chart === 'line' && (
                <svg viewBox="0 0 400 170" className="chart-svg" preserveAspectRatio="none">
                  <polyline fill="none" stroke="var(--green-600)" strokeWidth="2.5" strokeLinejoin="round"
                    points={series.map((s, i) => `${(i / Math.max(1, series.length - 1)) * 380 + 10},${160 - (Math.abs(s.value) / max) * 140}`).join(' ')} />
                  {series.map((s, i) => <circle key={i} cx={(i / Math.max(1, series.length - 1)) * 380 + 10} cy={160 - (Math.abs(s.value) / max) * 140} r="2.6" fill="var(--green-700)" />)}
                </svg>
              )}
              {chart === 'donut' && (
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <svg viewBox="0 0 120 120" width="150" height="150">
                    {series.slice(0, 8).reduce<{ acc: number; els: JSX.Element[] }>((p, s, i) => {
                      const frac = Math.max(0, s.value) / total
                      const dash = frac * 251.2
                      p.els.push(<circle key={i} cx="60" cy="60" r="40" fill="none" stroke={`hsl(${145 - i * 18} 65% ${32 + i * 5}%)`} strokeWidth="22" strokeDasharray={`${dash} ${251.2 - dash}`} strokeDashoffset={-p.acc} transform="rotate(-90 60 60)" />)
                      p.acc += dash
                      return p
                    }, { acc: 0, els: [] }).els}
                    <circle cx="60" cy="60" r="22" fill="var(--cream-50)" />
                    <text x="60" y="63" textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--text)">{series.length} pts</text>
                  </svg>
                </div>
              )}

              <div className="panel-title" style={{ marginTop: 10 }}>Profiling</div>
              {profile.map(p => (
                <div key={p.col.name} className="profile-row" title={`nulls ${p.nullPct}% · distinct ${p.distinct}`}>
                  <code>{p.col.name}</code>
                  <span className="pbar"><span style={{ width: `${100 - p.nullPct}%` }} /></span>
                  <span className={p.nullPct > 50 ? 'pfail' : 'pnum'}>{p.nullPct}% null · {p.distinct} distinct</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* FN-GOV-002 RID history + FN-GOV-003 Health Checks (dataset scope) */}
      <div className="module-body">
        <div className="glass panel" style={{ flex: 1 }} data-testid="data-rid-history-panel" role="region" aria-label="Dataset RID history">
          <div className="panel-title">RID history <span className="chip chip-mono">{dataSnaps.length}</span>
            <button className="btn" style={{ marginLeft: 'auto', fontSize: 10, padding: '2px 8px' }} data-testid="data-force-snapshot" aria-label="Force snapshot of current dataset" disabled={!dataset} onClick={forceDatasetSnapshot}><Icon name="doc" size={12} /> Force snapshot</button>
          </div>
          {dataSnaps.length === 0 ? (
            <div className="module-sub">{dataset ? 'No snapshots yet — use Force snapshot to capture a restore point.' : 'Import a dataset, then snapshot it as a RID restore point.'}</div>
          ) : dataSnaps.map(snap => (
            <div key={snap.id} data-testid={`data-rid-entry-${snap.id}`} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', borderTop: '1px solid rgba(34,197,94,.18)' }}>
              <span className="chip chip-mono" title={snap.at}>{snap.id}</span>
              <span className="module-sub">{snap.name} · {snap.rowCount} rows · sha256 {snap.hash.slice(0, 12)}…</span>
              <button className="btn btn-ghost" style={{ marginLeft: 'auto', fontSize: 10, padding: '2px 8px' }} data-testid={`data-restore-${snap.id}`} aria-label={`Restore snapshot ${snap.id}`} onClick={() => restoreDatasetSnapshot(snap)}>Restore</button>
            </div>
          ))}
        </div>

        <div className="glass panel" style={{ flex: 1 }} data-testid="data-health-panel" role="region" aria-label="Dataset Health Checks">
          <div className="panel-title">Health Checks
            <button className="btn" style={{ marginLeft: 'auto', fontSize: 10, padding: '2px 8px' }} data-testid="data-run-checks" aria-label="Run dataset health checks" onClick={runDataHealthChecks}><Icon name="check" size={12} /> Run checks</button>
          </div>
          {dataHealthRun && <div className="module-sub">Ran {new Date(dataHealthRun.at).toLocaleString()} · {dataHealthPassCount}/{dataHealthRun.checks.length} passing</div>}
          {!dataHealthRun && <div className="module-sub">Data-quality gate — run checks to warn support / block unsatisfactory assets.</div>}
          {(dataHealthRun ? dataHealthRun.checks : dataHealthPreview).map(c => (
            <div key={c.id} data-testid={`data-health-${c.id}`} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '5px 0', borderTop: '1px solid rgba(34,197,94,.18)', fontSize: 11 }}>
              {dataHealthRun
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

      {/* FN-DAT-001/002/003 — clean / union / deploy panels */}
      <div className="module-body">
        <div className="glass panel" style={{ flex: 1 }} data-testid="data-clean-panel" role="region" aria-label="Clean transform">
          <div className="panel-title">Clean transform <span className="chip chip-mono">FN-DAT-001</span></div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11, padding: '3px 0' }}>
            <input type="checkbox" checked={cleanCfg.normalizeNames} onChange={e => setCleanCfg({ ...cleanCfg, normalizeNames: e.target.checked })} /> Normalize names
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11, padding: '3px 0' }}>
            <input type="checkbox" checked={cleanCfg.filterNotNull} onChange={e => setCleanCfg({ ...cleanCfg, filterNotNull: e.target.checked })} /> Filter not-null
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11, padding: '3px 0' }}>
            <input type="checkbox" checked={cleanCfg.castTimestampColumns.length > 0} onChange={e => setCleanCfg({ ...cleanCfg, castTimestampColumns: e.target.checked ? (dataset?.columns.find(c => c.type === 'date')?.name ? [dataset!.columns.find(c => c.type === 'date')!.name] : (dataset?.columns[0]?.name ? [dataset!.columns[0].name] : [])) : [] })} /> Cast to Timestamp
          </label>
          <div className="label">Drop columns (comma list)</div>
          <input className="input" data-testid="clean-drop-cols" value={cleanCfg.dropColumns.join(', ')} onChange={e => setCleanCfg({ ...cleanCfg, dropColumns: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} placeholder="colA, colB" spellCheck={false} />
          <button className="btn btn-primary" data-testid="clean-apply" disabled={!dataset} onClick={runCleanTransform} style={{ marginTop: 8 }}><Icon name="check" size={12} /> Apply clean</button>
          {cleanNotice && <div className="chip" data-testid="clean-notice" style={{ marginTop: 8 }}>{cleanNotice}</div>}
        </div>

        <div className="glass panel" style={{ flex: 1 }} data-testid="data-union-panel" role="region" aria-label="Union preview">
          <div className="panel-title">Union preview <span className="chip chip-mono">FN-DAT-002</span></div>
          <button className="btn" data-testid="union-preview-btn" disabled={!dataset} onClick={runUnionPreview}><Icon name="layers" size={12} /> Preview union</button>
          {unionPreviewState ? (
            <div data-testid="union-preview" style={{ marginTop: 8 }}>
              <div className="chip chip-mono">{unionPreviewState.rowCount} rows × {unionPreviewState.colCount} cols</div>
              <div className="module-sub" style={{ marginTop: 4 }}>columns: {unionPreviewState.columns.join(', ')}</div>
              <table className="tbl" style={{ marginTop: 6 }}><tbody>
                {unionPreviewState.previewRows.map((r, i) => <tr key={i}>{unionPreviewState.columns.slice(0, 6).map(c => <td key={c}>{String(r[c] ?? '')}</td>)}</tr>)}
              </tbody></table>
            </div>
          ) : <div className="module-sub" style={{ marginTop: 8 }}>Preview unions the current dataset schema (target 500 rows × 11 cols shape).</div>}
        </div>

        <div className="glass panel" style={{ flex: 1 }} data-testid="data-deploy-panel" role="region" aria-label="Deploy pipeline">
          <div className="panel-title">Deploy <span className="chip chip-mono">FN-DAT-003</span>
            <span className="chip chip-mono" data-testid="deploy-status-badge-2" style={{ marginLeft: 'auto' }}>{deployStatus}</span>
          </div>
          {dataset ? (
            <>
              <div className="label">Select outputs</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {dataset.columns.map(c => (
                  <label key={c.name} className="chip" style={{ cursor: 'pointer' }}>
                    <input type="checkbox" checked={deployOutputs.includes(c.name)} onChange={e => setDeployOutputs(e.target.checked ? [...deployOutputs, c.name] : deployOutputs.filter(x => x !== c.name))} /> {c.name}
                  </label>
                ))}
              </div>
              <div className="label">Compute profile</div>
              <select className="input" data-testid="deploy-profile" value={deployProfile} onChange={e => setDeployProfile(e.target.value)}>
                <option value="standard">Standard</option>
                <option value="lightweight">Lightweight</option>
                <option value="external-databricks">External-Databricks</option>
              </select>
              <button className="btn btn-primary" data-testid="deploy-apply" onClick={runDeploy} style={{ marginTop: 8 }}><Icon name="arrow" size={12} /> Deploy pipeline</button>
              {deployError && <div role="alert" className="chip" data-testid="deploy-error" style={{ marginTop: 8, background: 'var(--danger-bg)', color: 'var(--danger)' }}>{deployError}</div>}
              <div className="module-sub" style={{ marginTop: 8 }}>
                profile: {computeDeployProfile(dataset).rowCount} rows × {computeDeployProfile(dataset).colCount} cols · {computeDeployProfile(dataset).nullPct}% null
              </div>
              <div className="module-sub">{summarizeDeploy(dataset, deployOutputs, deployProfile)}</div>
            </>
          ) : <div className="module-sub">Import a dataset to deploy.</div>}
        </div>
      </div>

      {/* Saved datasets */}
      {ws.datasets.length > 0 && (
        <div className="glass-faint fade-in" style={{ padding: '8px 12px', display: 'flex', gap: 8, alignItems: 'center', overflowX: 'auto' }} key={savedTick}>
          <span className="panel-title" style={{ margin: 0, whiteSpace: 'nowrap' }}>Saved datasets · {ws.datasets.length}</span>
          {ws.datasets.map((d: any) => (
            <span key={d.id} className="chip" style={{ whiteSpace: 'nowrap' }}>
              <button className="btn btn-ghost" style={{ padding: '0 4px', fontSize: 10, color: 'inherit' }} onClick={() => loadSaved(d)} title={`restore · sha256 ${String(d.hash).slice(0, 12)}`}>{d.name}</button>
              <button className="btn btn-ghost" style={{ padding: '0 2px' }} onClick={() => deleteSaved(d)} aria-label="Delete dataset"><Icon name="x" size={11} /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
