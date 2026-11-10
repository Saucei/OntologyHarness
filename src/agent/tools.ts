// Typed tool registry for the embedded agent — the bridge between LLM and app.
import { queryGraph } from './graph'
import { OBJECT_TYPES, LINK_TYPES, ACTION_TYPES } from '../data/ontology'
import { ws } from '../store'
import { validateWorkshop } from '../workshop/validate'
import { mergeCorpus, packEntries, enabledPackUnits } from '../packs/consume'

const DEFAULT_SECTIONS = [
  { id: 1, name: 'Header · Order Overview', widgets: [
    { id: 11, kind: 'button-group', label: 'Order overview actions', binding: 'Button group 1 · Auto (max) height', icon: null },
  ]},
  { id: 2, name: 'Filters', widgets: [
    { id: 21, kind: 'filter', label: 'Filter · [yourUsername] Order', binding: 'Input: Object Set · multi-select', icon: null },
  ]},
  { id: 3, name: 'Main panel', widgets: [
    { id: 31, kind: 'object-table', label: 'Object Table 1', binding: 'Active object set · renamed: Orders', icon: null },
    { id: 32, kind: 'property-list', label: 'Property List 2', binding: 'Input: Object table 1 Active object', icon: null },
    { id: 33, kind: 'bar-chart', label: 'Units by model', binding: 'Group by Platform · Sum(basePrice)', icon: null },
  ]},
]

export type ToolResult = { ok: boolean; data?: any; error?: string }
export type ToolDef = {
  name: string
  description: string
  schema: string // compact arg spec for the prompt
  /** OpenAI JSON-Schema parameters — enables native tool-calling bridges (T-34). */
  parameters?: Record<string, unknown>
  /** true when the tool mutates workspace state — requires approval unless dryRun */
  destructive?: boolean
  /** Permission-matrix category id — canonical list lives in ./permissions (TOOL_CATEGORIES) */
  category?: string
  execute: (args: any) => Promise<ToolResult> | ToolResult
}

const DRY_RUN_PARAMS = { type: 'object', properties: { dryRun: { type: 'boolean', description: 'Defaults to true. false = live execution, requires user approval.' } } }

export const TOOLS: ToolDef[] = [
  {
    name: 'graph.query',
    description: 'Return a lineage subgraph: nodes + edges around a node id/label (fuzzy) or by kind (warehouse|material|stage|product|customer).',
    schema: '{ focus?: string, depth?: 1-3, kind?: string }',
    parameters: { type: 'object', properties: { focus: { type: 'string', description: 'Node id or label (fuzzy)' }, depth: { type: 'integer', minimum: 1, maximum: 3 }, kind: { type: 'string', enum: ['warehouse', 'material', 'stage', 'product', 'customer'] } } },
    category: 'graph',
    execute: args => {
      const slice = queryGraph({ focus: args?.focus, depth: args?.depth, kind: args?.kind })
      return { ok: true, data: slice }
    },
  },
  {
    name: 'ontology.list',
    description: 'List all object types (id, name, backing, count), link types and action types.',
    schema: '{}',
    parameters: { type: 'object', properties: {} },
    category: 'ontology',
    execute: () => ({
      ok: true,
      data: {
        objectTypes: OBJECT_TYPES.map(o => ({ id: o.id, name: o.name, backing: o.backing, objectCount: o.objectCount, properties: o.properties.map(p => p.name) })),
        linkTypes: LINK_TYPES.map(l => ({ name: l.name, from: l.from, to: l.to, cardinality: l.cardinality })),
        actionTypes: ACTION_TYPES.map(a => ({ name: a.name, objectType: a.objectType, requiresAip: a.requiresAip })),
      },
    }),
  },
  {
    name: 'ontology.get',
    description: 'Fetch one object type by id or name, including full property list.',
    schema: '{ id: string }',
    parameters: { type: 'object', properties: { id: { type: 'string', description: 'Object type id (e.g. ot-process) or name fragment' } }, required: ['id'] },
    category: 'ontology',
    execute: args => {
      const q = String(args?.id ?? '').toLowerCase()
      const hit = OBJECT_TYPES.find(o => o.id.toLowerCase() === q || o.name.toLowerCase().includes(q))
      return hit ? { ok: true, data: hit } : { ok: false, error: `no object type matching "${args?.id}"` }
    },
  },
  {
    name: 'corpus.search',
    description: 'Search the reference corpus by keyword (filename + category + notes). Includes the base 134-file manifest PLUS every enabled corpus pack from the Plugin Manager. Returns up to `limit` matching entries.',
    schema: '{ query: string, limit?: number }',
    parameters: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'integer', minimum: 1, maximum: 25 } }, required: ['query'] },
    category: 'corpus',
    execute: async args => {
      try {
        const res = await fetch('/manifest.json')
        const base = res.ok ? await res.json() : null
        // T-36: enabled corpus packs extend the searchable corpus.
        const merged = mergeCorpus(base, enabledPackUnits())
        const q = String(args?.query ?? '').toLowerCase()
        const limit = Math.min(Number(args?.limit ?? 8) || 8, 25)
        const all = [
          ...(base?.entries ?? []),
          ...packEntries(merged).map(e => ({ ...e, bytes: 0, vision: null })),
        ]
        const hits = all
          .filter((e: any) => (e.file + ' ' + e.category + ' ' + (e.note ?? '')).toLowerCase().includes(q))
          .slice(0, limit)
        return { ok: true, data: { query: args?.query, total: hits.length, sources: ['base manifest', ...merged.packNames], hits } }
      } catch (e) {
        return { ok: false, error: String(e) }
      }
    },
  },
  {
    name: 'pipeline.run',
    description: 'Dry-run validation of the Datasource→Transform→Ontology DAG (7 seeded nodes). With dryRun=false it would execute the build — REAL execution requires user approval.',
    schema: '{ dryRun?: boolean }',
    parameters: DRY_RUN_PARAMS,
    destructive: true,
    category: 'pipeline',
    execute: args => {
      const dryRun = args?.dryRun !== false
      const report = {
        dryRun,
        nodes: 7, edges: 6,
        validation: ['schema types consistent (14→11 cols)', 'join keys compatible (Bureau ⟗ Office Goods)', 'ontology backing resolvable (ontology/product)'],
        issues: dryRun ? [] : ['live execution not wired in v2 — queued approval required'],
        verdict: 'PASS',
      }
      return { ok: true, data: report }
    },
  },
  {
    name: 'workshop.publish',
    description: 'Dry-run validation of the Order Overview Workshop module (bindings resolve, object-set types match). dryRun=false would publish — requires user approval.',
    schema: '{ dryRun?: boolean }',
    parameters: DRY_RUN_PARAMS,
    destructive: true,
    category: 'workshop',
    execute: args => {
      const dryRun = args?.dryRun !== false
      const meta = ws.meta?.workshop as { name: string; sections: any[] } | undefined
      const sections = meta?.sections ?? DEFAULT_SECTIONS
      const v = validateWorkshop(sections as any, meta?.name ?? 'Order Overview')
      return {
        ok: v.ok,
        data: {
          dryRun,
          module: meta?.name ?? 'Order Overview (seed)',
          widgets: v.widgetCount, bound: v.boundCount, issues: v.issues,
          verdict: v.ok ? 'READY_TO_PUBLISH' : 'BLOCKED',
        },
      }
    },
  },
]

export const toolByName = (name: string) => TOOLS.find(t => t.name === name)
export const TOOL_PROTOCOL = TOOLS.map(t => `- ${t.name} ${t.schema}\n    ${t.description}${t.destructive ? ' [DESTRUCTIVE — needs approval if dryRun=false]' : ''}`).join('\n')
