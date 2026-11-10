// T-33 graph areas — pure helpers for user-editable production-line graphs.
// Canonical automotive seed lives in agent/graph.ts (single source of truth);
// this module shapes it into per-area, serializable state persisted at
// ws.meta.graphAreas = { rev, activeId, areas: [{ id, title, nodes, edges }] }.
import { GRAPH_NODES, GRAPH_EDGES } from '../agent/graph'

export type PersistNode = { id: string; x: number; y: number; label: string; sub: string }
export type PersistEdge = { id: string; source: string; target: string; label: string; width: number }
export type GraphArea = { id: string; title: string; nodes: PersistNode[]; edges: PersistEdge[] }
export type GraphAreasState = { rev: number; activeId: string; areas: GraphArea[] }

/** Bump to force-reseed areas for existing installs (T-33 layout change). */
export const AREAS_REV = 1
export const DEFAULT_AREA_ID = 'line-1'
export const DEFAULT_AREA_TITLE = 'Assembly Line'

/** Seed layout — linear chain with material fan-in and model fan-out. */
const SEED_POSITIONS: Record<string, { x: number; y: number }> = {
  wh: { x: 0, y: 240 },
  steel: { x: 260, y: 100 },
  resin: { x: 260, y: 400 },
  stamping: { x: 520, y: 100 },
  weld: { x: 780, y: 100 },
  paint: { x: 1040, y: 100 },
  trim: { x: 1300, y: 240 },
  marriage: { x: 1560, y: 240 },
  test: { x: 1820, y: 240 },
  'model-a': { x: 2080, y: 100 },
  'model-b': { x: 2080, y: 380 },
  cust: { x: 2340, y: 240 },
}

/** Default area derived from the canonical automotive graph. */
export function defaultArea(): GraphArea {
  return {
    id: DEFAULT_AREA_ID,
    title: DEFAULT_AREA_TITLE,
    nodes: GRAPH_NODES.map(n => ({
      id: n.id,
      x: SEED_POSITIONS[n.id]?.x ?? 0,
      y: SEED_POSITIONS[n.id]?.y ?? 0,
      label: `${n.icon} ${n.label}`,
      sub: n.sub,
    })),
    edges: GRAPH_EDGES.map(e => ({ id: e.id, source: e.source, target: e.target, label: e.label, width: e.weight })),
  }
}

/** Initial areas state, or the persisted one when its rev matches. */
export function initAreasState(persisted: unknown): GraphAreasState {
  const p = persisted as GraphAreasState | undefined
  if (p && p.rev === AREAS_REV && Array.isArray(p.areas) && p.areas.length > 0) return p
  const seed = defaultArea()
  return { rev: AREAS_REV, activeId: seed.id, areas: [seed] }
}

/** Empty user area with a stable unique id. */
export function newArea(existing: GraphArea[]): GraphArea {
  const n = existing.filter(a => a.id.startsWith('area-')).length + 1
  return { id: `area-${Date.now().toString(36)}-${n}`, title: `New Area ${n}`, nodes: [], edges: [] }
}

let nodeSeq = 0
/** Unique node id for user-added stages. */
export function nextNodeId(): string {
  nodeSeq += 1
  return `stg-${Date.now().toString(36)}-${nodeSeq}`
}

/** Unique edge id for a user connection. */
export function nextEdgeId(): string {
  nodeSeq += 1
  return `e-user-${Date.now().toString(36)}-${nodeSeq}`
}

/** True when an equivalent relation (same source+target) already exists. */
export function edgeExists(edges: PersistEdge[], source: string, target: string): boolean {
  return edges.some(e => e.source === source && e.target === target)
}

/** Node id → ontology object type (seed ids only; user stages have none yet). */
export const NODE_TO_OBJECT_TYPE: Record<string, string> = {
  wh: 'ot-warehouse',
  steel: 'ot-raw-material',
  resin: 'ot-raw-material',
  stamping: 'ot-process',
  weld: 'ot-process',
  paint: 'ot-process',
  trim: 'ot-process',
  marriage: 'ot-process',
  test: 'ot-process',
  'model-a': 'ot-product',
  'model-b': 'ot-product',
  cust: 'ot-customer',
}

/** Replace one node's fields immutably. */
export function withNode(nodes: PersistNode[], id: string, patch: Partial<PersistNode>): PersistNode[] {
  return nodes.map(n => (n.id === id ? { ...n, ...patch } : n))
}

/** Drop a node and every relation touching it. */
export function removeNode(nodes: PersistNode[], edges: PersistEdge[], id: string): { nodes: PersistNode[]; edges: PersistEdge[] } {
  return {
    nodes: nodes.filter(n => n.id !== id),
    edges: edges.filter(e => e.source !== id && e.target !== id),
  }
}
