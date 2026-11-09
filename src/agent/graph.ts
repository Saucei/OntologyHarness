// Single source of truth for the production-line graph — used by GraphCanvas (render)
// AND agent tools (query/reason). In a real deployment this is derived from the store;
// here it's the curated seed mirroring vertex_overview-system_graph.png.

export type GraphNode = { id: string; label: string; sub: string; kind: 'warehouse' | 'material' | 'recipe' | 'product' | 'customer' }
export type GraphEdge = { id: string; source: string; target: string; label: string; weight: number }

export const GRAPH_NODES: GraphNode[] = [
  { id: 'wh', label: 'Warehouse 1', sub: 'Warehouse · 3 sites', kind: 'warehouse' },
  { id: 'malt', label: 'Malt', sub: 'Raw Material · $1.94/lb', kind: 'material' },
  { id: 'hops', label: 'Hops', sub: 'Raw Material · $11.2/lb', kind: 'material' },
  { id: 'corn', label: 'Corn', sub: 'Raw Material · $0.71/lb', kind: 'material' },
  { id: 'nyc-ale', label: 'NYC Ale', sub: 'Recipe · 40 bbl', kind: 'recipe' },
  { id: 'dc-ale', label: 'DC Ale', sub: 'Recipe · 39 bbl', kind: 'recipe' },
  { id: 'pit-ale', label: 'PIT Ale', sub: 'Recipe · 40 bbl', kind: 'recipe' },
  { id: 'nyc-ipa', label: 'NYC IPA', sub: 'Recipe · 36 bbl', kind: 'recipe' },
  { id: 'pit-ipa', label: 'PIT IPA', sub: 'Recipe · 34 bbl', kind: 'recipe' },
  { id: 'dc-ipa', label: 'DC IPA', sub: 'Recipe · 35 bbl', kind: 'recipe' },
  { id: 'belgian', label: 'Belgian Ale', sub: 'Product · 220.77 bbl demand', kind: 'product' },
  { id: 'ipa', label: 'IPA', sub: 'Product · 211.18 bbl demand', kind: 'product' },
  { id: 'cust', label: '30 Customers', sub: 'Customer · IMPRESSIONS segment', kind: 'customer' },
]

export const GRAPH_EDGES: GraphEdge[] = [
  { id: 'e1', source: 'wh', target: 'malt', label: '37', weight: 4 },
  { id: 'e2', source: 'wh', target: 'hops', label: '3/39', weight: 3 },
  { id: 'e3', source: 'wh', target: 'corn', label: '7', weight: 1.5 },
  { id: 'e4', source: 'malt', target: 'nyc-ale', label: '', weight: 3 }, { id: 'e5', source: 'malt', target: 'dc-ale', label: '', weight: 3 },
  { id: 'e6', source: 'malt', target: 'pit-ale', label: '', weight: 4 }, { id: 'e7', source: 'malt', target: 'nyc-ipa', label: '', weight: 3 }, { id: 'e8', source: 'malt', target: 'dc-ipa', label: '', weight: 2 },
  { id: 'e9', source: 'hops', target: 'nyc-ale', label: '', weight: 1 }, { id: 'e10', source: 'hops', target: 'dc-ale', label: '', weight: 1 }, { id: 'e11', source: 'hops', target: 'pit-ale', label: '', weight: 1 },
  { id: 'e12', source: 'hops', target: 'nyc-ipa', label: '', weight: 1 }, { id: 'e13', source: 'hops', target: 'pit-ipa', label: '', weight: 1 }, { id: 'e14', source: 'hops', target: 'dc-ipa', label: '', weight: 1 },
  { id: 'e15', source: 'corn', target: 'nyc-ale', label: '', weight: 1.5 }, { id: 'e16', source: 'corn', target: 'pit-ipa', label: '', weight: 1.5 },
  { id: 'e17', source: 'nyc-ale', target: 'belgian', label: '2 Recipes', weight: 1 }, { id: 'e18', source: 'dc-ale', target: 'belgian', label: '2 Recipes', weight: 3 }, { id: 'e19', source: 'pit-ale', target: 'belgian', label: '2 Recipes', weight: 3 },
  { id: 'e20', source: 'nyc-ipa', target: 'ipa', label: '2 Recipes', weight: 1 }, { id: 'e21', source: 'pit-ipa', target: 'ipa', label: '2 Recipes', weight: 1 }, { id: 'e22', source: 'dc-ipa', target: 'ipa', label: '2 Recipes', weight: 1 },
  { id: 'e23', source: 'belgian', target: 'cust', label: '220.77', weight: 5 }, { id: 'e24', source: 'ipa', target: 'cust', label: '211.18', weight: 3 },
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
