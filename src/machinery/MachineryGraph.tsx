// Machinery state graph (FN-MCH-001/002/003/004/007/008): duration-encoded nodes,
// DAYS edge pills, terminal color coding, transition-nodes toggle,
// metric carousel, History count series for the selected node,
// contextual zoom cards, deviation dotted edges, subprocess frames.
// Glass tokens only — styling via CSS vars + .mnode classes in app.css.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow, Background, Controls, MiniMap, Handle, Position,
  useNodesState, useEdgesState, type Node, type Edge, type ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { appendAudit, appendTrace, ws, patchMeta } from '../store'
import MachineryCarousel from './MachineryCarousel'
import PathExplorer from './PathExplorer'
import DurationHistogram from './DurationHistogram'
import {
  getFixture, buildMachineryGraph, mergePositions, buildHistorySeries,
  formatCount, formatDurationHours, formatDays,
  DEVIATION_FILTERS, computeDeviations, buildZoomCard, zoomCenterForNode, computeSubprocessFrames,
  listMachineryPaths, pathHighlightSets, toggleCheckedPath, filterNodesByDurationRange,
  type MachineryFixtureId, type MachineryMetric, type BuiltMachineryNode, type DeviationFilter,
  type DurationRange,
} from './mach'

function MachineryFrameView({ data }: { data: any }) {
  return (
    <div className="mach-frame" aria-hidden>
      <span className="mach-frame-label">{data.label} · {data.count} nodes</span>
    </div>
  )
}

type Props = {
  fixtureId: MachineryFixtureId
  metric: MachineryMetric
  onMetricChange: (m: MachineryMetric) => void
  showTransitionNodes: boolean
  onToggleTransitionNodes: (v: boolean) => void
}

function MachineryNodeView({ data, selected }: { data: any; selected?: boolean }) {
  const dim = data.dimmed ? ' mnode--dimmed' : ''
  const hl = data.highlighted ? ' mnode--highlighted' : ''
  if (data.kind === 'transition') {
    return (
      <div className={`mnode mnode-transition ${selected ? 'selected' : ''}${dim}`} title={data.label}>
        <Handle type="target" position={Position.Left} />
        <span aria-hidden>⇄</span>
        <Handle type="source" position={Position.Right} />
      </div>
    )
  }
  const tone: string = data.tone ?? 'neutral'
  return (
    <div className={`mnode mnode--${tone} ${selected ? 'selected' : ''}${dim}${hl}`}>
      <Handle type="target" position={Position.Left} />
      <div className="mnode-label">{data.label}</div>
      <div className="mnode-pill">
        <span className="mnode-swatch" aria-hidden>⊞</span>
        <span className="mnode-value">{data.metricValue}</span>
      </div>
      <small className="mnode-sub">
        {data.terminal ? 'terminal' : data.metric === 'historical-duration' ? `hist ${formatCount(data.historicalCount)} · curr ${formatCount(data.currentCount)}` : data.metric === 'current-count' ? `duration ${formatDurationHours(data.durationHours, data.durationDays)}` : `duration ${formatDurationHours(data.durationHours, data.durationDays)}`}
      </small>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

const nodeTypes = { machinery: MachineryNodeView, 'machinery-frame': MachineryFrameView }

export default function MachineryGraph({ fixtureId, metric, onMetricChange, showTransitionNodes, onToggleTransitionNodes }: Props) {
  const fixture = getFixture(fixtureId)
  const [deviationFilter, setDeviationFilter] = useState<DeviationFilter>('all')
  const [showSubprocessFrames, setShowSubprocessFrames] = useState(true)
  // Path explorer (FN-MCH-005) + duration histogram brush (FN-MCH-006).
  const persisted = ((ws.meta?.graph as any)?.machinery ?? {}) as { checkedPaths?: string[]; selectedPath?: string | null; durationRange?: DurationRange }
  const [checkedPaths, setCheckedPaths] = useState<string[]>(() => persisted.checkedPaths ?? [])
  const [selectedPathId, setSelectedPathId] = useState<string | null>(() => persisted.selectedPath ?? null)
  const [durationRange, setDurationRange] = useState<DurationRange>(() => persisted.durationRange ?? null)
  const paths = useMemo(() => listMachineryPaths(fixture), [fixture])
  const highlight = useMemo(() => pathHighlightSets(paths, checkedPaths, selectedPathId), [paths, checkedPaths, selectedPathId])
  const pathActive = highlight.nodeIds.size > 0 || highlight.edgeIds.size > 0
  const durationPassIds = useMemo(() => new Set(filterNodesByDurationRange(fixture.nodes, durationRange).map(n => n.id)), [fixture, durationRange])
  const persistMachPanels = useCallback((patch: { checkedPaths?: string[]; selectedPath?: string | null; durationRange?: DurationRange }) => {
    const prev = ((ws.meta?.graph as any)?.machinery ?? {}) as Record<string, unknown>
    patchMeta({ graph: { ...(ws.meta?.graph ?? {}), machinery: { ...prev, ...patch } } })
  }, [])
  const builtRaw = useMemo(() => buildMachineryGraph(fixtureId, metric, showTransitionNodes, { deviationFilter }), [fixtureId, metric, showTransitionNodes, deviationFilter])
  const built = useMemo(() => {
    // Decorate nodes/edges for path highlight + duration brush dimming (FN-MCH-005/006).
    const durActive = durationRange !== null
    const nodePass = (id: string) => !durActive || durationPassIds.has(id)
    const nodes = builtRaw.nodes.map(n => {
      if (n.id.startsWith('t-')) {
        const base = n.id.slice(2)
        const onPath = highlight.edgeIds.has(n.id) || highlight.edgeIds.has(base)
        const dimmed = pathActive && !onPath
        return { ...n, data: { ...n.data, dimmed: Boolean(dimmed), highlighted: Boolean(pathActive && onPath) } }
      }
      const onPath = highlight.nodeIds.has(n.id)
      const dimmed = (pathActive && !onPath) || (durActive && !durationPassIds.has(n.id))
      const highlighted = pathActive && onPath && nodePass(n.id)
      return { ...n, data: { ...n.data, dimmed: Boolean(dimmed) || undefined, highlighted: highlighted || undefined } }
    })
    const edges = builtRaw.edges.map(e => {
      let base = e.id
      if (!highlight.edgeIds.has(e.id) && (e.id.endsWith('-a') || e.id.endsWith('-b'))) base = e.id.slice(0, -2)
      const onPath = highlight.edgeIds.has(e.id) || highlight.edgeIds.has(base)
      const endpointsPass = nodePass(e.source) && nodePass(e.target)
      const dimmed = (pathActive && !onPath) || (durActive && !endpointsPass)
      const highlighted = pathActive && onPath && endpointsPass
      if (!dimmed && !highlighted) return e
      return {
        ...e,
        style: {
          ...e.style,
          opacity: dimmed ? 0.1 : 1,
          ...(highlighted ? { strokeWidth: (Number(e.style.strokeWidth) || 2) + 1.5 } : {}),
        },
      }
    })
    return { nodes, edges }
  }, [builtRaw, highlight, pathActive, durationRange, durationPassIds])
  const frames = useMemo(() => computeSubprocessFrames(fixture), [fixture])
  const deviations = useMemo(() => computeDeviations(fixture), [fixture])
  const devCount = deviations.filter(d => d.isDeviation).length
  const visibleFlowNodes = useMemo<Node[]>(() => {
    const stateNodes = built.nodes as unknown as Node[]
    if (!showSubprocessFrames) return stateNodes
    const frameNodes: Node[] = frames.map(f => ({
      id: `frame-${f.key}`,
      type: 'machinery-frame',
      position: { x: f.bounds.x, y: f.bounds.y },
      draggable: false,
      selectable: false,
      style: { width: f.bounds.width, height: f.bounds.height, zIndex: -1 } as any,
      data: { label: f.label, count: f.nodeIds.length },
    } as unknown as Node))
    return [...frameNodes, ...stateNodes]
  }, [built, frames, showSubprocessFrames])
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(visibleFlowNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(built.edges as unknown as Edge[])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const flowRef = useRef<ReactFlowInstance | null>(null)

  // Rebuild labels/metric/toggle without losing dragged positions (skip synthetic frame nodes).
  useEffect(() => {
    setNodes(prev => {
      const prevState = prev.filter(n => n.type === 'machinery')
      const merged = mergePositions(prevState, built.nodes as unknown as Node[])
      if (!showSubprocessFrames) return merged
      const frameNodes: Node[] = frames.map(f => ({
        id: `frame-${f.key}`,
        type: 'machinery-frame',
        position: { x: f.bounds.x, y: f.bounds.y },
        draggable: false,
        selectable: false,
        style: { width: f.bounds.width, height: f.bounds.height, zIndex: -1 } as any,
        data: { label: f.label, count: f.nodeIds.length },
      } as unknown as Node))
      return [...frameNodes, ...merged]
    })
  }, [built, frames, showSubprocessFrames, setNodes])
  useEffect(() => {
    setEdges(built.edges as unknown as Edge[])
  }, [built, setEdges])

  // Reset selection + deviation filter when fixture switches.
  useEffect(() => { setSelectedId(null); setDeviationFilter('all'); setSelectedPathId(null); setCheckedPaths([]); setDurationRange(null) }, [fixtureId])

  // Escape clears selection (FN-MCH-ANALYTICS keyboard contract).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (selectedId || selectedPathId)) { setSelectedId(null); setSelectedPathId(null); persistMachPanels({ selectedPath: null }) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId, selectedPathId, persistMachPanels])

  const onNodeClick = useCallback((_: unknown, node: Node) => {
    if (node.type === 'machinery-frame') return
    setSelectedId(node.id)
    appendTrace({ kind: 'tool-call', tool: 'machinery.node-select', ok: true, ms: 0, detail: node.id })
    appendAudit({ event: 'machinery.node-select', id: node.id, fixture: fixtureId })
    // Contextual zoom: center camera on the selected state node (FN-MCH-003).
    if (!node.id.startsWith('t-')) {
      const card = buildZoomCard(getFixture(fixtureId), node.id)
      if (card) {
        appendTrace({ kind: 'tool-call', tool: 'machinery.zoom-card', ok: true, ms: 0, detail: `${node.id} subStates=${card.subStates.length}` })
        appendAudit({ event: 'machinery.zoom-card', id: node.id, subStates: card.subStates.length, fixture: fixtureId })
      }
      const target = zoomCenterForNode(node.position ?? { x: 0, y: 0 })
      flowRef.current?.setCenter(target.x, target.y, { zoom: target.zoom, duration: 400 })
    }
  }, [fixtureId])

  const onDeviationFilter = useCallback((f: DeviationFilter) => {
    setDeviationFilter(f)
    appendTrace({ kind: 'tool-call', tool: 'machinery.deviation-filter', ok: true, ms: 0, detail: `${deviationFilter} -> ${f}` })
    appendAudit({ event: 'machinery.deviation-filter', from: deviationFilter, to: f, fixture: fixtureId })
  }, [deviationFilter, fixtureId])

  const onToggleFrames = useCallback(() => {
    const next = !showSubprocessFrames
    appendTrace({ kind: 'tool-call', tool: 'machinery.toggle-subprocess-frames', ok: true, ms: 0, detail: `${showSubprocessFrames} -> ${next}` })
    appendAudit({ event: 'machinery.toggle-subprocess-frames', from: showSubprocessFrames, to: next, fixture: fixtureId })
    setShowSubprocessFrames(next)
  }, [showSubprocessFrames, fixtureId])

  const onTogglePath = useCallback((id: string) => {
    const next = toggleCheckedPath(checkedPaths, id)
    appendTrace({ kind: 'tool-call', tool: 'machinery.path.toggle', ok: true, ms: 0, detail: `${id} ${next.includes(id) ? 'checked' : 'unchecked'} (${next.length})` })
    appendAudit({ event: 'machinery.path.toggle', id, checked: next.includes(id), checkedPaths: next, fixture: fixtureId })
    setCheckedPaths(next)
    persistMachPanels({ checkedPaths: next })
  }, [checkedPaths, fixtureId, persistMachPanels])

  const onSelectPath = useCallback((id: string | null) => {
    appendTrace({ kind: 'tool-call', tool: 'machinery.path.select', ok: true, ms: 0, detail: id ?? 'cleared' })
    appendAudit({ event: 'machinery.path.select', id, fixture: fixtureId })
    setSelectedPathId(id)
    persistMachPanels({ selectedPath: id })
  }, [fixtureId, persistMachPanels])

  const onDurationChange = useCallback((next: DurationRange) => {
    setDurationRange(next)
    persistMachPanels({ durationRange: next })
  }, [persistMachPanels])

  const closeZoomCard = useCallback(() => {
    appendTrace({ kind: 'tool-call', tool: 'machinery.zoom-card-close', ok: true, ms: 0, detail: selectedId ?? '' })
    appendAudit({ event: 'machinery.zoom-card-close', id: selectedId ?? '', fixture: fixtureId })
    setSelectedId(null)
  }, [selectedId, fixtureId])

  const onInit = useCallback((instance: ReactFlowInstance) => { flowRef.current = instance }, [])

  const toggle = useCallback(() => {
    const next = !showTransitionNodes
    appendTrace({ kind: 'tool-call', tool: 'machinery.toggle-transition-nodes', ok: true, ms: 0, detail: `${showTransitionNodes} -> ${next}` })
    appendAudit({ event: 'machinery.toggle-transition-nodes', from: showTransitionNodes, to: next, fixture: fixtureId })
    onToggleTransitionNodes(next)
  }, [showTransitionNodes, onToggleTransitionNodes, fixtureId])

  const selectedNode = (nodes.find(n => n.id === selectedId) as unknown as BuiltMachineryNode | undefined)?.data ?? null
  const zoomCard = useMemo(() => (selectedId && !selectedId.startsWith('t-') && !selectedId.startsWith('frame-') ? buildZoomCard(fixture, selectedId) : null), [fixture, selectedId])
  const history = useMemo(() => (selectedNode ? buildHistorySeries({ id: selectedId ?? '', label: selectedNode.label, kind: 'state', terminal: selectedNode.terminal, durationDays: selectedNode.durationDays, durationHours: selectedNode.durationHours, historicalCount: selectedNode.historicalCount, currentCount: selectedNode.currentCount } as any, 12) : []), [selectedId, selectedNode])
  const maxHist = Math.max(1, ...history)
  const spark = history.map((v, i) => `${(i / Math.max(1, history.length - 1)) * 100},${100 - (v / maxHist) * 90 - 5}`).join(' ')

  return (
    <div className="module fade-in" data-testid="machinery-graph" aria-label={`${fixture.title} state graph`}>
      <div className="module-head glass-strong" style={{ padding: '8px 12px' }}>
        <span className="module-sub" style={{ fontWeight: 700, letterSpacing: '.06em' }}>SHOW</span>
        <button
          type="button"
          className="btn"
          role="switch"
          aria-checked={showTransitionNodes}
          aria-label="Transition nodes"
          data-testid="toggle-transition-nodes"
          onClick={toggle}
          style={showTransitionNodes ? {} : { opacity: .55 }}
        >
          {showTransitionNodes ? '◉' : '◎'} Transition nodes
        </button>
        <button
          type="button"
          className="btn"
          role="switch"
          aria-checked={showSubprocessFrames}
          aria-label="Subprocess frames"
          data-testid="toggle-subprocess-frames"
          onClick={onToggleFrames}
          style={showSubprocessFrames ? {} : { opacity: .55 }}
        >
          {showSubprocessFrames ? '◉' : '◎'} Subprocess frames
        </button>
        <div className="mach-seg" role="tablist" aria-label="Deviation filter" data-testid="deviation-filter">
          {DEVIATION_FILTERS.map(f => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={deviationFilter === f.id}
              data-testid={`deviation-${f.id}`}
              className={`btn ${deviationFilter === f.id ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => onDeviationFilter(f.id)}
            >
              {f.label}{f.id === 'deviations' ? ` (${devCount})` : ''}
            </button>
          ))}
        </div>
        <span className="chip chip-mono">{fixture.title} [State] · {built.nodes.length} nodes · {built.edges.length} edges · {devCount} deviations · {paths.length} paths</span>
        <span className="module-sub" style={{ marginLeft: 'auto' }}>{fixture.subtitle}</span>
      </div>

      <div className="module-body">
        <div className="graph-wrap glass" style={{ position: 'relative' }}>
          <ReactFlow
            nodes={nodes} edges={edges} nodeTypes={nodeTypes}
            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onNodeClick={onNodeClick}
            onInit={onInit}
            fitView fitViewOptions={{ padding: 0.12 }} minZoom={0.4} maxZoom={1.6}
            nodesDraggable nodesConnectable={false}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="var(--green-200)" gap={22} size={1.4} />
            <Controls showInteractive={false} />
            <MiniMap nodeColor={() => 'var(--green-600)'} maskColor="rgba(240,253,244,.55)" onClick={(_, p) => flowRef.current?.setCenter(p.x, p.y, { zoom: 1.2, duration: 400 })} />
          </ReactFlow>

          <div className="graph-legend glass-faint" aria-hidden>
            <div className="panel-title" style={{ marginBottom: 4 }}>Legend</div>
            <div className="legend-row"><i className="mnode-legend-dot mnode--terminal-ok" /> terminal state (incl. Approved / Cancelled)</div>
            <div className="legend-row"><i className="mnode-legend-dot mnode--sla-breach" /> non-terminal ≥30 days</div>
            <div className="legend-row"><i className="mnode-legend-dot mnode--sla-warn" /> non-terminal ≥10 days</div>
            <div className="legend-row"><i className="mnode-legend-dot mnode--in-progress" /> in progress &lt;10 days</div>
            <div className="legend-row"><i className="mnode-legend-dot mnode--neutral" /> unknown / muted</div>
            <div className="legend-row" style={{ opacity: .7 }}>pill: DAYS in duration view · count otherwise</div>
          </div>

          {zoomCard ? (
            <div className="mach-zoom-card glass-strong" role="dialog" aria-label={`Zoom card ${zoomCard.label}`} data-testid="zoom-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 800 }}>{zoomCard.label}</span>
                <span className="chip chip-mono">{zoomCard.terminal ? 'terminal' : zoomCard.kind}</span>
                <button type="button" className="btn btn-ghost" aria-label="Close zoom card" data-testid="zoom-card-close" onClick={closeZoomCard} style={{ marginLeft: 'auto', padding: '2px 6px' }}>✕</button>
              </div>
              <div className="module-sub">{formatDurationHours(zoomCard.durationHours, zoomCard.durationDays)} · hist {formatCount(zoomCard.historicalCount)} · curr {formatCount(zoomCard.currentCount)}</div>
              <div className="label" style={{ marginTop: 6 }}>Sub-states ({zoomCard.subStates.length})</div>
              {zoomCard.subStates.length ? (
                <table className="tbl"><tbody>
                  {zoomCard.subStates.map(s => <tr key={s.nodeId}><td>{s.label}{s.terminal ? ' · terminal' : ''}</td><td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatCount(s.count)}</td></tr>)}
                </tbody></table>
              ) : <div className="module-sub">No outgoing transitions.</div>}
            </div>
          ) : null}

          <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 20, minWidth: 360 }}>
            <MachineryCarousel metric={metric} onChange={onMetricChange} />
          </div>
        </div>

        <div className="graph-side" style={{ overflowY: 'auto', minHeight: 0 }}>
          <div className="glass panel" role="group" aria-label="Duration histogram panel" data-testid="machinery-duration-panel">
            <DurationHistogram nodes={fixture.nodes} fixtureId={fixtureId} range={durationRange} onChange={onDurationChange} />
          </div>
          <div className="glass panel" role="group" aria-label="Path explorer panel" data-testid="machinery-paths-panel">
            <PathExplorer paths={paths} checked={checkedPaths} selectedId={selectedPathId} onToggleChecked={onTogglePath} onSelect={onSelectPath} />
          </div>
          <div className="glass panel" style={{ flex: 1 }} role="dialog" aria-label="Node details" data-testid="machinery-detail">
            <div className="panel-title">Selection</div>
            {selectedNode ? (
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{selectedNode.label}</div>
                <div className="module-sub" style={{ marginBottom: 8 }}>
                  {selectedNode.terminal ? 'terminal · ' : ''}{selectedNode.metricValue} · {selectedNode.metric}
                </div>
                <table className="tbl"><tbody>
                  <tr><td>Historical count</td><td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatCount(selectedNode.historicalCount)}</td></tr>
                  <tr><td>Current count</td><td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatCount(selectedNode.currentCount)}</td></tr>
                  <tr><td>Historical duration</td><td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatDurationHours(selectedNode.durationHours, selectedNode.durationDays)}{selectedNode.durationDays !== null && selectedNode.durationDays !== undefined && Math.round(selectedNode.durationDays) >= 5 ? ` · ${formatDays(selectedNode.durationDays)}` : ''}</td></tr>
                  {selectedNode.subprocess ? <tr><td>Subprocess</td><td style={{ textAlign: 'right' }}>{selectedNode.subprocess}</td></tr> : null}
                </tbody></table>
                {history.length ? (
                  <div style={{ marginTop: 8 }}>
                    <div className="label">History count series</div>
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: 56, display: 'block' }} aria-label="History count series" role="img">
                      <polyline points={spark} fill="none" style={{ stroke: 'var(--green-700)' }} strokeWidth={2} vectorEffect="non-scaling-stroke" />
                    </svg>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                      <span>{history[0]}</span><span>{history[history.length - 1]}</span>
                    </div>
                  </div>
                ) : <div className="module-sub" style={{ marginTop: 4 }}>No history series for this node.</div>}
              </div>
            ) : <div className="module-sub">Click a state node to inspect duration, counts and its history series. Escape clears.</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
