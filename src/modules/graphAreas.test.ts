// T-33 graph areas — pure helper tests (seed derivation, persistence shape, editing ops).
import { describe, it, expect } from 'vitest'
import {
  defaultArea, initAreasState, newArea, nextNodeId, nextEdgeId, edgeExists,
  withNode, removeNode, NODE_TO_OBJECT_TYPE, AREAS_REV, DEFAULT_AREA_ID,
} from './graphAreas'

describe('T-33 graph areas', () => {
  it('derives the automotive seed from the canonical graph', () => {
    const a = defaultArea()
    expect(a.id).toBe(DEFAULT_AREA_ID)
    expect(a.nodes.length).toBe(12)
    expect(a.edges.length).toBe(13)
    expect(a.nodes.some(n => /belgian|brewery|\bale\b|\bipa\b/i.test(n.label))).toBe(false)
    expect(a.nodes.find(n => n.id === 'paint')?.sub).toContain('9.5 h')
    expect(edgeExists(a.edges, 'paint', 'trim')).toBe(true)
    // All node ids unique; all edges reference existing nodes.
    expect(new Set(a.nodes.map(n => n.id)).size).toBe(a.nodes.length)
    const ids = new Set(a.nodes.map(n => n.id))
    for (const e of a.edges) {
      expect(ids.has(e.source), `edge ${e.id} source`).toBe(true)
      expect(ids.has(e.target), `edge ${e.id} target`).toBe(true)
    }
  })

  it('initAreasState reseeds on stale/missing state and keeps fresh persisted state', () => {
    const fresh = initAreasState(undefined)
    expect(fresh.rev).toBe(AREAS_REV)
    expect(fresh.activeId).toBe(DEFAULT_AREA_ID)

    const persisted = { rev: AREAS_REV, activeId: 'x', areas: [{ id: 'x', title: 'Mine', nodes: [], edges: [] }] }
    expect(initAreasState(persisted).activeId).toBe('x')

    const stale = initAreasState({ rev: 0, activeId: 'old', areas: [{ id: 'old', title: 'Old', nodes: [], edges: [] }] })
    expect(stale.activeId).toBe(DEFAULT_AREA_ID)
    expect(stale.areas[0].nodes.length).toBe(12)

    // Empty areas list falls back to the seed rather than a dead activeId.
    expect(initAreasState({ rev: AREAS_REV, activeId: 'gone', areas: [] }).areas.length).toBe(1)
  })

  it('area creation yields unique empty areas', () => {
    const base = defaultArea()
    const a1 = newArea(base ? [base] : [])
    const a2 = newArea([base, a1])
    expect(a1.id).toMatch(/^area-/)
    expect(a2.id).not.toBe(a1.id)
    expect(a1.nodes).toEqual([])
    expect(a1.edges).toEqual([])
  })

  it('node + edge editing helpers are immutable and id generators unique', () => {
    const base = defaultArea()
    const newId = nextNodeId()
    const grown = { ...base, nodes: [...base.nodes, { id: newId, x: 50, y: 50, label: 'QC Check', sub: 'Process · new' }] }
    expect(base.nodes.length).toBe(12)
    expect(grown.nodes.length).toBe(13)

    const renamed = withNode(grown.nodes, newId, { label: 'QC Gate' })
    expect(renamed.find(n => n.id === newId)?.label).toBe('QC Gate')
    expect(grown.nodes.find(n => n.id === newId)?.label).toBe('QC Check')

    const stripped = removeNode(grown.nodes, grown.edges, 'paint')
    expect(stripped.nodes.length).toBe(12)
    expect(stripped.edges.some(e => e.source === 'paint' || e.target === 'paint')).toBe(false)
    expect(edgeExists(stripped.edges, 'paint', 'trim')).toBe(false)

    expect(nextEdgeId()).not.toBe(nextEdgeId())
    expect(nextNodeId()).not.toBe(newId)
  })

  it('maps seed node ids to ontology object types', () => {
    expect(NODE_TO_OBJECT_TYPE['wh']).toBe('ot-warehouse')
    expect(NODE_TO_OBJECT_TYPE['steel']).toBe('ot-raw-material')
    expect(NODE_TO_OBJECT_TYPE['paint']).toBe('ot-process')
    expect(NODE_TO_OBJECT_TYPE['model-b']).toBe('ot-product')
    expect(NODE_TO_OBJECT_TYPE['cust']).toBe('ot-customer')
    expect(NODE_TO_OBJECT_TYPE['user-made-stage']).toBeUndefined()
  })
})
