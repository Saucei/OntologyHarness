import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow, Background, Controls, MiniMap, Handle, Position,
  useNodesState, useEdgesState, type Node, type Edge, type ReactFlowInstance, MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { toPng } from 'html-to-image'
import { Icon } from '../components/Icon'
import { OBJECT_TYPES } from '../data/ontology'
import { ws, patchMeta, setFocus, appendTrace, appendAudit } from '../store'
import { createJob } from '../jobs'
import MachineryGraph from '../machinery/MachineryGraph'
import { getFixture, type MachineryFixtureId, type MachineryMetric } from '../machinery/mach'

/* ── FN-ARC-002 — Environment branching & promotion graph (pure helpers) ──
   Master/Dev/Feature Y/Feature X/Oct sources → PROD/UAT promotion targets.
   Additive overlay; lineage baseNodes/baseEdges unchanged. */

export type BranchNode = {
  id: string
  name: string
  kind: 'source' | 'target'
  env: 'master' | 'dev' | 'feature' | 'uat' | 'prod'
}

export const BRANCH_NODES: BranchNode[] = [
  { id: 'master', name: 'Master', kind: 'source', env: 'master' },
  { id: 'dev', name: 'Dev', kind: 'source', env: 'dev' },
  { id: 'feature-y', name: 'Feature Y', kind: 'source', env: 'feature' },
  { id: 'feature-x', name: 'Feature X', kind: 'source', env: 'feature' },
  { id: 'oct', name: 'Oct', kind: 'source', env: 'dev' },
  { id: 'prod', name: 'PROD', kind: 'target', env: 'prod' },
  { id: 'uat', name: 'UAT', kind: 'target', env: 'uat' },
]

export const BRANCH_EDGES: Array<{ from: string; to: string; label: string }> = [
  { from: 'master', to: 'prod', label: 'promote' },
  { from: 'dev', to: 'prod', label: 'promote' },
  { from: 'feature-y', to: 'uat', label: 'promote' },
  { from: 'feature-x', to: 'uat', label: 'promote' },
  { from: 'oct', to: 'prod', label: 'promote' },
  { from: 'oct', to: 'uat', label: 'promote' },
]

/** True when there is a direct promotion edge from → to. */
export function isPromotable(fromId: string, toId: string): boolean {
  return BRANCH_EDGES.some(e => e.from === fromId && e.to === toId)
}

/** Shortest promotion path via BFS (includes endpoints), or null when unreachable. */
export function promotionPath(fromId: string, toId: string): string[] | null {
  if (fromId === toId) return [fromId]
  const queue: string[][] = [[fromId]]
  const seen = new Set([fromId])
  while (queue.length) {
    const path = queue.shift()!
    const last = path[path.length - 1]
    for (const e of BRANCH_EDGES.filter(e => e.from === last)) {
      if (e.to === toId) return [...path, e.to]
      if (!seen.has(e.to)) {
        seen.add(e.to)
        queue.push([...path, e.to])
      }
    }
  }
  return null
}

/** Counts of sources / targets / promotion edges for the overlay header. */
export function branchGraphStats(): { sources: number; targets: number; edges: number } {
  return {
    sources: BRANCH_NODES.filter(n => n.kind === 'source').length,
    targets: BRANCH_NODES.filter(n => n.kind === 'target').length,
    edges: BRANCH_EDGES.length,
  }
}

const baseNodes: Node[] = [
  { id: 'wh', position: { x: 0, y: 240 }, data: { label: '🏭 Warehouse 1', sub: 'Warehouse · 3 sites' }, type: 'glass' },
  { id: 'malt', position: { x: 230, y: 60 }, data: { label: '🌾 Malt', sub: 'Raw Material · $1.94/lb' }, type: 'glass' },
  { id: 'hops', position: { x: 230, y: 200 }, data: { label: '🌿 Hops', sub: 'Raw Material · $11.2/lb' }, type: 'glass' },
  { id: 'corn', position: { x: 230, y: 340 }, data: { label: '🌽 Corn', sub: 'Raw Material · $0.71/lb' }, type: 'glass' },
  { id: 'nyc-ale', position: { x: 470, y: -40 }, data: { label: '📜 NYC Ale', sub: 'Recipe · 40 bbl' }, type: 'glass' },
  { id: 'dc-ale', position: { x: 470, y: 70 }, data: { label: '📜 DC Ale', sub: 'Recipe · 39 bbl' }, type: 'glass' },
  { id: 'pit-ale', position: { x: 470, y: 180 }, data: { label: '📜 PIT Ale', sub: 'Recipe · 40 bbl' }, type: 'glass' },
  { id: 'nyc-ipa', position: { x: 470, y: 290 }, data: { label: '📜 NYC IPA', sub: 'Recipe · 36 bbl' }, type: 'glass' },
  { id: 'pit-ipa', position: { x: 470, y: 400 }, data: { label: '📜 PIT IPA', sub: 'Recipe · 34 bbl' }, type: 'glass' },
  { id: 'dc-ipa', position: { x: 470, y: 510 }, data: { label: '📜 DC IPA', sub: 'Recipe · 35 bbl' }, type: 'glass' },
  { id: 'belgian', position: { x: 730, y: 60 }, data: { label: '🍺 Belgian Ale', sub: 'Product · 220.77 bbl demand' }, type: 'glass' },
  { id: 'ipa', position: { x: 730, y: 330 }, data: { label: '🍺 IPA', sub: 'Product · 211.18 bbl demand' }, type: 'glass' },
  { id: 'cust', position: { x: 980, y: 180 }, data: { label: '🧑‍💼 30 Customers', sub: 'Customer · IMPRESSIONS segment' }, type: 'glass' },
]

const mkEdge = (id: string, source: string, target: string, label?: string, width = 2): Edge => ({
  id, source, target, label,
  style: { stroke: '#15803d', strokeWidth: width, opacity: 0.75 },
  markerEnd: { type: MarkerType.ArrowClosed, color: '#15803d' },
})

const baseEdges: Edge[] = [
  mkEdge('e1', 'wh', 'malt', '37', 4), mkEdge('e2', 'wh', 'hops', '3 / 39', 3), mkEdge('e3', 'wh', 'corn', '7', 1.5),
  mkEdge('e4', 'malt', 'nyc-ale', '', 3), mkEdge('e5', 'malt', 'dc-ale', '', 3), mkEdge('e6', 'malt', 'pit-ale', '', 4),
  mkEdge('e7', 'malt', 'nyc-ipa', '', 3), mkEdge('e8', 'malt', 'dc-ipa', '', 2),
  mkEdge('e9', 'hops', 'nyc-ale'), mkEdge('e10', 'hops', 'dc-ale'), mkEdge('e11', 'hops', 'pit-ale'),
  mkEdge('e12', 'hops', 'nyc-ipa'), mkEdge('e13', 'hops', 'pit-ipa'), mkEdge('e14', 'hops', 'dc-ipa'),
  mkEdge('e15', 'corn', 'nyc-ale', '', 1.5), mkEdge('e16', 'corn', 'pit-ipa', '', 1.5),
  mkEdge('e17', 'nyc-ale', 'belgian', '2 Recipes'), mkEdge('e18', 'dc-ale', 'belgian', '2 Recipes', 3), mkEdge('e19', 'pit-ale', 'belgian', '2 Recipes', 3),
  mkEdge('e20', 'nyc-ipa', 'ipa', '2 Recipes'), mkEdge('e21', 'pit-ipa', 'ipa', '2 Recipes'), mkEdge('e22', 'dc-ipa', 'ipa', '2 Recipes'),
  mkEdge('e23', 'belgian', 'cust', '220.77', 5), mkEdge('e24', 'ipa', 'cust', '211.18', 3),
]

const NODE_TO_OBJECT_TYPE: Record<string, string> = {
  wh: 'ot-warehouse', malt: 'ot-raw-material', hops: 'ot-raw-material', corn: 'ot-raw-material',
  'nyc-ale': 'ot-recipe', 'dc-ale': 'ot-recipe', 'pit-ale': 'ot-recipe', 'nyc-ipa': 'ot-recipe', 'pit-ipa': 'ot-recipe', 'dc-ipa': 'ot-recipe',
  belgian: 'ot-product', ipa: 'ot-product', cust: 'ot-customer',
}

function GlassNode({ data, selected }: any) {
  const status: string = data.status ?? ''
  return (
    <div className={`gnode ${selected ? 'selected pulse' : ''} ${status}`}>
      <Handle type="target" position={Position.Left} />
      <div>{data.label}<small>{data.sub}</small></div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
const nodeTypes = { glass: GlassNode }

const isBlank = (v: unknown) => v === '' || v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v))
const worstNullPct = (ds: any): number => {
  const cols: string[] = (ds.columns ?? []).map((c: any) => c.name)
  if (!cols.length || !ds.rows?.length) return 0
  return Math.max(...cols.map(c => Math.round((ds.rows.filter((r: any) => isBlank(r[c])).length / ds.rows.length) * 100)))
}

export default function GraphCanvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState(baseNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(baseEdges)
  const [selected, setSelected] = useState<string | null>('belgian')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [seriesMode, setSeriesMode] = useState<'demand' | 'forecast'>('demand')
  const [expanded, setExpanded] = useState<boolean>(() => !!(ws.meta?.graph as any)?.expandedWarehouse)
  const [notice, setNotice] = useState<string | null>(null)
  const flowRef = useRef<ReactFlowInstance | null>(null)

  // Machinery mode (FN-MCH-001/002/008) — additive; default lineage preserves existing behavior.
  type GraphMode = 'lineage' | MachineryFixtureId
  const initMach = (ws.meta?.graph as any)?.machinery as
    | { mode?: GraphMode; metric?: MachineryMetric; showTransitionNodes?: boolean }
    | undefined
  const [mode, setMode] = useState<GraphMode>(() => initMach?.mode ?? 'lineage')
  const [machMetric, setMachMetric] = useState<MachineryMetric>(() => initMach?.metric ?? 'historical-duration')
  const [showTransitionNodes, setShowTransitionNodes] = useState<boolean>(() => initMach?.showTransitionNodes ?? true)

  /* FN-ARC-002 — branch/promotion overlay state (persisted in ws.meta.graph) */
  const [showBranches, setShowBranches] = useState<boolean>(() => !!(ws.meta?.graph as any)?.showBranchOverlay)
  const [selectedEnv, setSelectedEnv] = useState<string>(() => (ws.meta?.graph as any)?.selectedEnv ?? 'master')
  const [promotedEnvs, setPromotedEnvs] = useState<string[]>(() => ((ws.meta?.graph as any)?.promotedEnvs as string[]) ?? [])

  const toggleBranches = useCallback(() => {
    setShowBranches(prev => {
      const next = !prev
      patchMeta({ graph: { ...(ws.meta?.graph ?? {}), showBranchOverlay: next } })
      appendTrace({ kind: 'tool-call', tool: 'graph.branch-overlay.toggle', ok: true, ms: 0, detail: next ? 'shown' : 'hidden' })
      appendAudit({ event: 'graph.branch-overlay.toggle', shown: next })
      return next
    })
  }, [])

  const selectEnv = useCallback((id: string) => {
    setSelectedEnv(id)
    patchMeta({ graph: { ...(ws.meta?.graph ?? {}), selectedEnv: id } })
    appendTrace({ kind: 'tool-call', tool: 'graph.branch.select', ok: true, ms: 0, detail: id })
    appendAudit({ event: 'graph.branch.select', id })
  }, [])

  const promoteEnv = useCallback((targetId: string) => {
    const path = promotionPath(selectedEnv, targetId)
    if (!path) {
      appendTrace({ kind: 'tool-call', tool: 'graph.branch.promote', ok: false, ms: 0, detail: `no path ${selectedEnv} -> ${targetId}` })
      appendAudit({ event: 'graph.branch.promote', ok: false, from: selectedEnv, to: targetId })
      return
    }
    setPromotedEnvs(prev => {
      const next = prev.includes(targetId) ? prev : [...prev, targetId]
      patchMeta({ graph: { ...(ws.meta?.graph ?? {}), promotedEnvs: next } })
      return next
    })
    appendTrace({ kind: 'tool-call', tool: 'graph.branch.promote', ok: true, ms: 0, detail: `promoted ${selectedEnv} -> ${targetId} via ${path.join(' -> ')}` })
    appendAudit({ event: 'graph.branch.promote', ok: true, from: selectedEnv, to: targetId, path })
  }, [selectedEnv])

  const persistMachinery = useCallback((next: { mode?: GraphMode; metric?: MachineryMetric; showTransitionNodes?: boolean }) => {
    const prev = ((ws.meta?.graph as any)?.machinery ?? {}) as Record<string, unknown>
    patchMeta({ graph: { ...(ws.meta?.graph ?? {}), machinery: { ...prev, mode, metric: machMetric, showTransitionNodes, ...next } } })
  }, [mode, machMetric, showTransitionNodes])

  const switchMode = useCallback((next: GraphMode) => {
    appendTrace({ kind: 'tool-call', tool: 'graph.mode-switch', ok: true, ms: 0, detail: `${mode} -> ${next}` })
    appendAudit({ event: 'graph.mode-switch', from: mode, to: next })
    setMode(next)
    patchMeta({ graph: { ...(ws.meta?.graph ?? {}), machinery: { mode: next, metric: machMetric, showTransitionNodes } } })
  }, [mode, machMetric, showTransitionNodes])

  const onMachMetricChange = useCallback((m: MachineryMetric) => {
    setMachMetric(m)
    patchMeta({ graph: { ...(ws.meta?.graph ?? {}), machinery: { mode, metric: m, showTransitionNodes } } })
  }, [mode, showTransitionNodes])

  const onToggleTransitionNodes = useCallback((v: boolean) => {
    setShowTransitionNodes(v)
    patchMeta({ graph: { ...(ws.meta?.graph ?? {}), machinery: { mode, metric: machMetric, showTransitionNodes: v } } })
  }, [mode, machMetric])

  const machFixture = mode === 'lineage' ? null : getFixture(mode)

  const onNodeClick = useCallback((_: any, node: Node) => setSelected(node.id), [])
  const onSelectionChange = useCallback(({ nodes: sel }: { nodes: Node[] }) => setSelectedIds(sel.map(n => n.id)), [])

  const savedDatasets = (ws.datasets as any[]) ?? []

  /** Toggle warehouse expansion: merge saved datasets as children of wh. */
  const toggleWarehouse = useCallback(() => {
    if (expanded) {
      setNodes(prev => prev.filter(n => !n.id.startsWith('ds-')))
      setEdges(prev => prev.filter(e => !e.id.startsWith('e-ds-')))
      setExpanded(false)
      patchMeta({ graph: { ...(ws.meta?.graph ?? {}), expandedWarehouse: false } })
      return
    }
    const children: Node[] = savedDatasets.map((d, i) => ({
      id: `ds-${d.id}`,
      position: { x: -150, y: 480 + i * 90 },
      type: 'glass',
      data: {
        label: `🗄 ${d.name}`,
        sub: `${d.rowCount ?? d.rows?.length ?? '?'} rows · sha256 ${String(d.hash).slice(0, 8)}`,
        status: worstNullPct(d) > 50 ? 'status-bad' : 'status-ok',
      },
    }))
    const childEdges: Edge[] = savedDatasets.map((d, i) => mkEdge(`e-ds-${i}-wh`, `ds-${d.id}`, 'wh', 'feeds', 1.5))
    setNodes(prev => [...prev, ...children])
    setEdges(prev => [...prev, ...childEdges])
    setExpanded(true)
    patchMeta({ graph: { ...(ws.meta?.graph ?? {}), expandedWarehouse: true } })
    if (savedDatasets.length === 0) setNotice('No saved datasets yet — import one in Data Hub, then double-click Warehouse 1 again.')
  }, [expanded, setNodes, setEdges, savedDatasets])

  // Re-expand on mount if previously expanded.
  useEffect(() => {
    if (expanded && !nodes.some(n => n.id.startsWith('ds-'))) toggleWarehouse()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onNodeDoubleClick = useCallback((_: any, node: Node) => { if (node.id === 'wh') toggleWarehouse() }, [toggleWarehouse])

  const onMoveEnd = useCallback((_: any, viewport: { x: number; y: number; zoom: number }) => {
    patchMeta({ graph: { ...(ws.meta?.graph ?? {}), camera: viewport } })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onInit = useCallback((instance: ReactFlowInstance) => {
    flowRef.current = instance
    const cam = (ws.meta?.graph as any)?.camera
    if (cam) instance.setViewport(cam, { duration: 0 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selNode = nodes.find(n => n.id === selected)
  const objectTypes = OBJECT_TYPES

  const bars = useMemo(() => Array.from({ length: 40 }, (_, i) => {
    const seasonal = Math.pow(Math.max(0, Math.sin(i / 4.4 - 1.1)), 2.2)
    const noise = (Math.sin(i * 12.9898) * 43758.5453) % 1
    return seriesMode === 'demand' ? Math.round(seasonal * 480 + Math.abs(noise) * 60) : Math.round(seasonal * 390 + Math.abs(noise) * 45)
  }), [seriesMode])

  const download = (filename: string, content: string, mime: string) => {
    const url = URL.createObjectURL(new Blob([content], { type: mime }))
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url)
  }

  const exportSvg = () => {
    const pad = 80
    const minX = Math.min(...nodes.map(n => n.position.x)) - pad
    const maxX = Math.max(...nodes.map(n => n.position.x + 190)) + pad
    const minY = Math.min(...nodes.map(n => n.position.y)) - pad
    const maxY = Math.max(...nodes.map(n => n.position.y + 60)) + pad
    const nodeById = Object.fromEntries(nodes.map(n => [n.id, n]))
    const parts: string[] = []
    parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${maxX - minX} ${maxY - minY}" font-family="Inter, sans-serif">`)
    parts.push(`<rect x="${minX}" y="${minY}" width="${maxX - minX}" height="${maxY - minY}" fill="#fdfcf8"/>`)
    for (const e of edges) {
      const a = nodeById[e.source], b = nodeById[e.target]; if (!a || !b) continue
      parts.push(`<line x1="${a.position.x + 190}" y1="${a.position.y + 28}" x2="${b.position.x}" y2="${b.position.y + 28}" stroke="#15803d" stroke-opacity="0.7" stroke-width="${Math.min(6, 1 + Number(e.style?.strokeWidth ?? 2))}"/>`)
    }
    for (const n of nodes) {
      parts.push(`<g><rect x="${n.position.x}" y="${n.position.y}" rx="12" width="190" height="56" fill="#f0fdf4" stroke="#16a34a" stroke-opacity="0.4"/>`)
      parts.push(`<text x="${n.position.x + 14}" y="${n.position.y + 24}" font-size="13" font-weight="700" fill="#052e16">${String((n.data as any).label).replace(/</g, '&lt;')}</text>`)
      parts.push(`<text x="${n.position.x + 14}" y="${n.position.y + 42}" font-size="9" fill="#166534">${String((n.data as any).sub).replace(/</g, '&lt;')}</text></g>`)
    }
    parts.push('</svg>')
    download('production-line-graph.svg', parts.join(''), 'image/svg+xml')
    setNotice('SVG exported · position-accurate from live canvas')
  }

  const exportPng = async () => {
    const el = document.querySelector('.graph-wrap') as HTMLElement | null
    if (!el) return
    try {
      const dataUrl = await toPng(el, { backgroundColor: '#fdfcf8', cacheBust: true })
      const a = document.createElement('a'); a.href = dataUrl; a.download = 'production-line-graph.png'; a.click()
      setNotice('PNG exported · includes current layout')
    } catch (e) {
      setNotice(`PNG export failed: ${String(e).slice(0, 80)}`)
    }
  }

  const createJobFromSelection = () => {
    if (selectedIds.length === 0) return
    const attachments = selectedIds.map(id => {
      if (id.startsWith('ds-')) { const dsId = id.slice(3); const ds = savedDatasets.find((d: any) => d.id === dsId); return ds ? { kind: 'dataset' as const, id: ds.id, label: ds.name, hash: ds.hash, addedAt: new Date().toISOString() } : null }
      const ot = NODE_TO_OBJECT_TYPE[id]; return ot ? { kind: 'ontology' as const, id: ot, label: ot, addedAt: new Date().toISOString() } : null
    }).filter(Boolean) as any[]
    const job = createJob({ title: `Graph selection review — ${selectedIds.length} node(s)`, source: 'Lineage Graph · selection', tags: ['lineage', 'graph-selection'], attachments, activity: [{ at: 'now', text: `Job spawned from graph selection (${selectedIds.join(', ')})` }] as any })
    setNotice(`Job ${job.id} created with ${attachments.length} attachment(s)`)
  }

  const sendToSwarm = () => {
    setFocus('swarms', 'sw-2')
    window.dispatchEvent(new CustomEvent('oh:navigate', { detail: { module: 'swarms' } }))
  }

  // Rollback note: machinery is additive under mode !== 'lineage'; lineage
  // baseNodes/baseEdges and all lineage handlers are unchanged, so reverting
  // this slice is a pure deletion of the machinery branch + imports.
  if (mode !== 'lineage' && machFixture) {
    return (
      <div className="module fade-in">
        <div className="module-head glass-strong">
          <div>
            <div className="module-title"><Icon name="graph" size={18} /> {machFixture.title} [State] · Machinery</div>
            <div className="module-sub">{machFixture.subtitle}</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <div className="graph-mode-switch" role="group" aria-label="Graph mode">
              <button type="button" className="graph-mode-btn" aria-pressed={false} data-testid="mode-lineage" onClick={() => switchMode('lineage')}>Lineage</button>
              <button type="button" className="graph-mode-btn" aria-pressed={mode === 'patient-journey'} data-testid="mode-patient-journey" onClick={() => switchMode('patient-journey')}>Patient Journey</button>
              <button type="button" className="graph-mode-btn" aria-pressed={mode === 'approval-process'} data-testid="mode-approval-process" onClick={() => switchMode('approval-process')}>Approval Process</button>
            </div>
            <span className="chip chip-mono">FN-MCH-001 · 002 · 005 · 006 · 008</span>
          </div>
        </div>
        <MachineryGraph
          fixtureId={mode}
          metric={machMetric}
          onMetricChange={onMachMetricChange}
          showTransitionNodes={showTransitionNodes}
          onToggleTransitionNodes={onToggleTransitionNodes}
        />
      </div>
    )
  }

  return (
    <div className="module fade-in">
      <div className="module-head glass-strong">
        <div>
          <div className="module-title"><Icon name="graph" size={18} /> Production Line › View sub-graph</div>
          <div className="module-sub">Vertex-style ontology lineage · {nodes.length} nodes · {edges.length} relations · double-click Warehouse to {expanded ? 'collapse' : 'expand'} datasets</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="graph-mode-switch" role="group" aria-label="Graph mode">
            <button type="button" className="graph-mode-btn" aria-pressed={mode === 'lineage'} data-testid="mode-lineage" onClick={() => switchMode('lineage')}>Lineage</button>
            <button type="button" className="graph-mode-btn" aria-pressed={mode === 'patient-journey'} data-testid="mode-patient-journey" onClick={() => switchMode('patient-journey')}>Patient Journey</button>
            <button type="button" className="graph-mode-btn" aria-pressed={mode === 'approval-process'} data-testid="mode-approval-process" onClick={() => switchMode('approval-process')}>Approval Process</button>
          </div>
          <span className="chip chip-mono">graph: production-line</span>
          <button className="btn" data-testid="branch-overlay-toggle" aria-expanded={showBranches} aria-label="Toggle branch promotion graph" onClick={toggleBranches}><Icon name="graph" size={13} /> Branch graph</button>
          <button className="btn" onClick={() => setNodes(baseNodes)}><Icon name="refresh" size={13} /> Reset</button>
          <button className="btn" onClick={exportSvg}><Icon name="download" size={13} /> SVG</button>
          <button className="btn" onClick={exportPng}><Icon name="download" size={13} /> PNG</button>
        </div>
      </div>

      {/* FN-ARC-002 — branch & promotion overlay (Master/Dev/Feature Y/Feature X/Oct → PROD/UAT) */}
      {showBranches && (
        <div className="glass panel fade-in" data-testid="branch-overlay" role="region" aria-label="Branch and promotion graph" style={{ margin: '0 0 8px' }}>
          <div className="panel-title">Branches <span className="chip chip-mono">FN-ARC-002</span>
            <span className="chip chip-mono" style={{ marginLeft: 'auto' }}>{branchGraphStats().sources} sources · {branchGraphStats().targets} targets · {branchGraphStats().edges} edges</span>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {BRANCH_NODES.map(n => (
              <button key={n.id} data-testid={`branch-node-${n.id}`} aria-pressed={selectedEnv === n.id} className={`btn ${selectedEnv === n.id ? 'btn-primary' : ''}`} style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => selectEnv(n.id)}>
                {n.name}{promotedEnvs.includes(n.id) ? ' ✓' : ''}<small style={{ marginLeft: 4, opacity: .7 }}>{n.kind}</small>
              </button>
            ))}
          </div>
          <div className="module-sub" style={{ marginTop: 8 }}>
            {BRANCH_EDGES.map(e => {
              const from = BRANCH_NODES.find(n => n.id === e.from)?.name ?? e.from
              const to = BRANCH_NODES.find(n => n.id === e.to)?.name ?? e.to
              const active = selectedEnv === e.from
              return <span key={`${e.from}-${e.to}`} className="chip chip-mono" style={{ margin: '0 4px 4px 0', opacity: active ? 1 : .65 }}>{from} → {to} · {e.label}</span>
            })}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
            <span className="module-sub">Promote {BRANCH_NODES.find(n => n.id === selectedEnv)?.name ?? selectedEnv} →</span>
            {BRANCH_NODES.filter(n => n.kind === 'target').map(t => (
              <button key={t.id} className="btn" data-testid={`branch-promote-${t.id}`} disabled={!isPromotable(selectedEnv, t.id) || promotedEnvs.includes(t.id)} onClick={() => promoteEnv(t.id)}>
                {t.name}{promotedEnvs.includes(t.id) ? ' ✓ promoted' : ''}
              </button>
            ))}
            <span className="chip chip-mono">{promotedEnvs.length} promoted</span>
          </div>
        </div>
      )}

      <div className="module-body">
        <div className="graph-wrap glass" style={{ position: 'relative' }}>
          <ReactFlow
            nodes={nodes} edges={edges} nodeTypes={nodeTypes}
            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onNodeClick={onNodeClick}
            onSelectionChange={onSelectionChange}
            onNodeDoubleClick={onNodeDoubleClick}
            onInit={onInit} onMoveEnd={onMoveEnd}
            fitView fitViewOptions={{ padding: 0.12 }} minZoom={0.4} maxZoom={1.6} nodesDraggable nodesConnectable={false}
            selectionOnDrag multiSelectionKeyCode="Shift"
          >
            <Background color="#bbf7d0" gap={22} size={1.4} />
            <Controls showInteractive={false} />
            <MiniMap nodeColor={() => '#16a34a'} maskColor="rgba(240,253,244,.55)" onClick={(_, p) => flowRef.current?.setCenter(p.x, p.y, { zoom: 1.2, duration: 400 })} />
          </ReactFlow>

          {/* Selection action bar */}
          {selectedIds.length > 0 && (
            <div className="graph-actionbar glass-strong fade-in" role="toolbar" aria-label="Selection actions">
              <span className="chip chip-mono">{selectedIds.length} selected</span>
              <button className="btn btn-primary" onClick={createJobFromSelection}><Icon name="kanban" size={12} /> Create job</button>
              <button className="btn" onClick={sendToSwarm}><Icon name="spark" size={12} /> Send to Swarm</button>
              <button className="btn" onClick={exportSvg}><Icon name="download" size={12} /> SVG</button>
            </div>
          )}

          {/* Legend */}
          <div className="graph-legend glass-faint" aria-hidden>
            <div className="panel-title" style={{ marginBottom: 4 }}>Legend</div>
            <div className="legend-row"><i style={{ background: '#16a34a' }} /> Warehouse / facility</div>
            <div className="legend-row"><i style={{ background: '#22c55e' }} /> Raw materials</div>
            <div className="legend-row"><i style={{ background: '#15803d' }} /> Recipes</div>
            <div className="legend-row"><i style={{ background: '#052e16' }} /> Products</div>
            <div className="legend-row"><i style={{ background: '#fff', border: '2px solid #16a34a' }} /> Imported dataset (ring: green ok / red &gt;50% null)</div>
            <div className="legend-row" style={{ opacity: .7 }}>edge width ∝ flow volume · Shift-drag to lasso</div>
          </div>

          {notice && <div className="chip" style={{ position: 'absolute', top: 10, right: 10 }}>{notice}</div>}
        </div>

        <div className="graph-side">
          <div className="glass panel" style={{ flex: 1 }}>
            <div className="panel-title">Selection</div>
            {selNode ? (
              <>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{selNode.data.label as string}</div>
                <div className="module-sub" style={{ marginBottom: 8 }}>{selNode.data.sub as string}</div>
                <div className="label">Object type</div>
                <div className="chip">{(selNode.data.sub as string).split(' · ')[0]}</div>
                <div className="label">Downstream links</div>
                <table className="tbl"><tbody>
                  {edges.filter(e => e.source === selNode.id).slice(0, 6).map(e => (
                    <tr key={e.id}><td>{String(e.label || '→')}</td><td style={{ textAlign: 'right', color: 'var(--text-dim)' }}>{e.target}</td></tr>
                  ))}
                </tbody></table>
              </>
            ) : <div className="module-sub">Click a node to inspect it. Shift-drag to lasso multiple.</div>}
          </div>

          <div className="glass panel" style={{ height: 220 }}>
            <div className="panel-title">
              Series · Belgian Ale
              <span style={{ display: 'flex', gap: 4 }}>
                {(['demand', 'forecast'] as const).map(m => (
                  <button key={m} className={`btn btn-ghost`} style={seriesMode === m ? { background: 'rgba(34,197,94,.2)', color: 'var(--green-800)' } : {}} onClick={() => setSeriesMode(m)}>{m === 'demand' ? '@demand' : 'forecast'}</button>
                ))}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 110, padding: '4px 2px' }}>
              {bars.map((v, i) => (
                <div key={i} title={`${v} bbl`} style={{ flex: 1, height: `${(v / 520) * 100}%`, minHeight: 2, background: i >= bars.length - 7 ? '#f59e0b' : '#052e16', borderRadius: '2px 2px 0 0', opacity: 0.9 }} />
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}><span>2021</span><span>April</span><span>July</span></div>
            <div className="module-sub" style={{ marginTop: 6 }}>{seriesMode === 'demand' ? '@demand BELGIAN ALE · actuals' : 'ale_demand_forecast · model output'}</div>
          </div>

          <div className="glass panel">
            <div className="panel-title">Object types</div>
            {objectTypes.slice(0, 4).map(t => <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', fontSize: 11, fontWeight: 600 }}><span>{t.icon}</span>{t.name}<span style={{ marginLeft: 'auto', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>{t.objectCount}</span></div>)}
          </div>
        </div>
      </div>
    </div>
  )
}
