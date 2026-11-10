// Single source of truth for the production-line graph — used by GraphCanvas (render)
// AND agent tools (query/reason). T-33: automotive assembly line with industry-typical
// figures (stamping 4 s/panel · ~4,800 spot welds/body · paint oven 9.5 h · takt 58 s).

export type GraphNode = { id: string; label: string; sub: string; icon: string; kind: 'warehouse' | 'material' | 'stage' | 'product' | 'customer' }
export type GraphEdge = { id: string; source: string; target: string; label: string; weight: number }

export const GRAPH_NODES: GraphNode[] = [
  { id: 'wh', label: 'Distribution Center', sub: 'Warehouse · 3 regions', icon: '🏭', kind: 'warehouse' },
  { id: 'steel', label: 'Steel Coil', sub: 'Raw Material · $0.92/lb', icon: '🧱', kind: 'material' },
  { id: 'resin', label: 'Polymer Resin', sub: 'Raw Material · $1.35/lb', icon: '🧪', kind: 'material' },
  { id: 'stamping', label: 'Stamping Cell', sub: 'Process · 4 s/panel · STG-010', icon: '⚙️', kind: 'stage' },
  { id: 'weld', label: 'Body Weld', sub: 'Process · ~4,800 spot welds/body · STG-020', icon: '🤖', kind: 'stage' },
  { id: 'paint', label: 'Paint Shop', sub: 'Process · e-coat + oven 9.5 h · STG-030', icon: '🎨', kind: 'stage' },
  { id: 'trim', label: 'Trim & Chassis', sub: 'Process · takt 58 s · STG-040', icon: '🔧', kind: 'stage' },
  { id: 'marriage', label: 'Final Assembly (Marriage)', sub: 'Process · takt 60 s · STG-050', icon: '🚗', kind: 'stage' },
  { id: 'test', label: 'Test & Inspection', sub: 'Process · 15 min/unit · STG-060', icon: '✅', kind: 'stage' },
  { id: 'model-a', label: 'Sedan S1', sub: 'Vehicle Model · 41.8k units/yr', icon: '🚙', kind: 'product' },
  { id: 'model-b', label: 'Crossover X2', sub: 'Vehicle Model · 38.2k units/yr', icon: '🚐', kind: 'product' },
  { id: 'cust', label: '60 Dealers', sub: 'Dealer Network · Midwest region', icon: '🧑‍💼', kind: 'customer' },
]

export const GRAPH_EDGES: GraphEdge[] = [
  { id: 'e1', source: 'wh', target: 'steel', label: 'reorder @ 40', weight: 4 },
  { id: 'e2', source: 'wh', target: 'resin', label: 'reorder @ 25', weight: 2 },
  { id: 'e3', source: 'steel', target: 'stamping', label: '210 coils/day', weight: 4 },
  { id: 'e4', source: 'stamping', target: 'weld', label: '5 panels/body', weight: 3 },
  { id: 'e5', source: 'weld', target: 'paint', label: '1 body/min', weight: 3 },
  { id: 'e6', source: 'paint', target: 'trim', label: '9.5 h oven', weight: 4 },
  { id: 'e7', source: 'trim', target: 'marriage', label: '58 s takt', weight: 3 },
  { id: 'e8', source: 'marriage', target: 'test', label: '60 s takt', weight: 3 },
  { id: 'e9', source: 'resin', target: 'trim', label: '38 kg/unit', weight: 1.5 },
  { id: 'e10', source: 'test', target: 'model-a', label: '41.8k/yr', weight: 3 },
  { id: 'e11', source: 'test', target: 'model-b', label: '38.2k/yr', weight: 3 },
  { id: 'e12', source: 'model-a', target: 'cust', label: 'dealer orders', weight: 3 },
  { id: 'e13', source: 'model-b', target: 'cust', label: 'dealer orders', weight: 3 },
]

export type GraphSlice = { nodes: GraphNode[]; edges: GraphEdge[]; focus: string | null }

/** BFS slice around a focus node (depth 1-2), or the whole graph. */
export function queryGraph(args: { focus?: string; depth?: number; kind?: GraphNode['kind'] } = {}): GraphSlice {
  const depth = Math.min(Math.max(args.depth ?? 2, 1), 3)
  if (!args.focus && !args.kind) return { nodes: GRAPH_NODES, edges: GRAPH_EDGES, focus: null }
  const seedIds = new Set<string>()
  if (args.kind) GRAPH_NODES.filter(n => n.kind === args.kind).forEach(n => seedIds.add(n.id))
  if (args.focus) {
    const f = args.focus.trim().toLowerCase()
    for (const n of GRAPH_NODES) {
      if (n.id.toLowerCase() === f || n.label.toLowerCase().includes(f)) seedIds.add(n.id)
    }
    if (seedIds.size === 0) return { nodes: [], edges: [], focus: args.focus }
  }
  const keep = new Set(seedIds)
  let frontier = [...seedIds]
  for (let d = 0; d < depth; d++) {
    const next: string[] = []
    for (const e of GRAPH_EDGES) {
      if (frontier.includes(e.source) && !keep.has(e.target)) { keep.add(e.target); next.push(e.target) }
      if (frontier.includes(e.target) && !keep.has(e.source)) { keep.add(e.source); next.push(e.source) }
    }
    frontier = next
  }
  return {
    nodes: GRAPH_NODES.filter(n => keep.has(n.id)),
    edges: GRAPH_EDGES.filter(e => keep.has(e.source) && keep.has(e.target)),
    focus: args.focus ?? null,
  }
}
