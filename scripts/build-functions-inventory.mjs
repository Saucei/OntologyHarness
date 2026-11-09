// Inventory builder (Stage 4) — merges heuristic tags + vision-verified observations (if present)
// into a deduplicated function registry + gap ledger.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const manifest = JSON.parse(readFileSync(new URL('../public/manifest.json', import.meta.url), 'utf8'))
const visionPath = new URL('../public/vision.json', import.meta.url)
const vision = existsSync(visionPath) ? JSON.parse(readFileSync(visionPath, 'utf8')) : null

const FAMILY_LABEL = {
  'architecture-lineage': 'Architecture & Lineage',
  'data-integration': 'Data Integration',
  'application-building': 'Application Building',
  'aip-logic': 'AIP & LLM Logic',
  'ontology-layer': 'Ontology Layer',
  'learning-docs': 'Learning & Docs',
}

// Curated, evidence-linked function registry seeded from verified screenshots.
// Each entry references the screenshots that show the function.
const REGISTRY = [
  // Application Building (Workshop)
  { id: 'FN-BLD-001', family: 'application-building', name: 'Add widget to section', breadth: 6, depth: 3, reach: 1, status: 'INAPP', refs: ['instructor_…1753264093_1+-+Add+Widget…png'] },
  { id: 'FN-BLD-002', family: 'application-building', name: 'Select / add widget filter list', breadth: 3, depth: 2, reach: 1, status: 'INAPP', refs: ['…1753276825_2+-+Select+Widget…png'] },
  { id: 'FN-BLD-003', family: 'application-building', name: 'Add new section (with Layout)', breadth: 4, depth: 3, reach: 1, status: 'INAPP', refs: ['…1753347673_1+-+Add+New+Section…png'] },
  { id: 'FN-BLD-004', family: 'application-building', name: 'Section formatting (Subheader, Background, Height override)', breadth: 5, depth: 4, reach: 1, status: 'PARTIAL', refs: ['…1753347742_2.1+-+Section+Formatting…png','…1753284008_10+-+Change+Filter+…'] },
  { id: 'FN-BLD-005', family: 'application-building', name: 'Set section height (Fill space / Auto max)', breadth: 3, depth: 2, reach: 1, status: 'PARTIAL', refs: ['…1753348468_6+-+Fill+space…','…1753348616_6.1+-+Auto+max+height…'] },
  { id: 'FN-BLD-006', family: 'application-building', name: 'Add OST widget (Object Set Table)', breadth: 2, depth: 3, reach: 1, status: 'MISSING', refs: ['…1753347959_2.2+-+Add+OST+Widget…png'] },
  { id: 'FN-BLD-007', family: 'application-building', name: 'Set Input Object Set on widget', breadth: 4, depth: 3, reach: 2, status: 'INAPP', refs: ['…1753348110_4+-+Input+Object+Set…png','…1753348883_9+-+Edit+Input+Active+Object+Set…'] },
  { id: 'FN-BLD-008', family: 'application-building', name: 'Create / rename Object Set variable', breadth: 6, depth: 4, reach: 2, status: 'PARTIAL', refs: ['…1753265591_4+-+Add+New+Object+set…png','…1753278791_8+-+Create+new+Object+Set+Variable…','…1753266737_6+-+Rename+variable…'] },
  { id: 'FN-BLD-009', family: 'application-building', name: 'Rename Object Table / Title column', breadth: 3, depth: 2, reach: 1, status: 'INAPP', refs: ['…1756895761_Rename+Object+Table…png','…1756895979_2-+Overview…png','…1769013741_8.1+-+Change+Title+Column+name…'] },
  { id: 'FN-BLD-010', family: 'application-building', name: 'Add all properties / Add value to table', breadth: 3, depth: 2, reach: 1, status: 'INAPP', refs: ['…1753349018_10+-+Add+Value…','…1753349120_11+-+Add+All+Properties…'] },
  { id: 'FN-BLD-011', family: 'application-building', name: 'Layout overview / column width split', breadth: 2, depth: 2, reach: 1, status: 'MISSING', refs: ['…1769015410_Step+4.3+-+Layout+Overview…png'] },
  { id: 'FN-BLD-012', family: 'application-building', name: 'Change to Multi-Select component', breadth: 1, depth: 1, reach: 0, status: 'PARTIAL', refs: ['…1753277831_5.5+Change+to+Multi-Select…'] },
  { id: 'FN-BLD-013', family: 'application-building', name: 'Replace Object Table variable', breadth: 1, depth: 1, reach: 1, status: 'MISSING', refs: ['…1760003401_8.3+-+Replace+Object+Table+Variable…'] },

  // Layout & formatting
  { id: 'FN-LAY-001', family: 'application-building', name: 'Collapsible section (expand/collapse icon, default open)', breadth: 2, depth: 3, reach: 1, status: 'MISSING', refs: ['…1753284314_10.1+-+…','…dgfhjjsj.jpg'] },
  { id: 'FN-LAY-002', family: 'application-building', name: 'Row Height control (Auto max / Absolute / Flex)', breadth: 5, depth: 3, reach: 1, status: 'MISSING', refs: ['…1753282447_9+-+Change+Filter+Colour…','…SharedScreenshot.jpg'] },
  { id: 'FN-LAY-003', family: 'application-building', name: 'Background colour override per widget/filter', breadth: 2, depth: 2, reach: 0, status: 'MISSING', refs: ['…1753282447_9+-+Change+Filter+Colour…png'] },
  { id: 'FN-LAY-004', family: 'application-building', name: 'Filter list layout (Vertical / Pills) + allow user add/remove', breadth: 4, depth: 3, reach: 1, status: 'INAPP', refs: ['…1753278376_6+-+Allow+Users+to+Add+Filters…png'] },

  // Ontology layer
  { id: 'FN-ONT-001', family: 'ontology-layer', name: 'Object type CRUD + value type constraints', breadth: 6, depth: 5, reach: 3, status: 'INAPP', refs: ['…1769010682_Step+1.2+-+Ont+man…png'] },
  { id: 'FN-ONT-002', family: 'ontology-layer', name: 'Object Explorer search/filter by property', breadth: 1, depth: 2, reach: 2, status: 'PARTIAL', refs: ['…1769013741_…'] },

  // Data integration
  { id: 'FN-DAT-001', family: 'data-integration', name: 'Pipeline builder: Clean transform (cast/filter/rename/normalize)', breadth: 4, depth: 4, reach: 2, status: 'MISSING', refs: ['…1749655488_Clean+Bureau+Transform…','…1749821009_Clean+Office+Goods+Transform…'] },
  { id: 'FN-DAT-002', family: 'data-integration', name: 'Union node configuration + preview 500 rows', breadth: 3, depth: 3, reach: 2, status: 'MISSING', refs: ['…1749823347_Union+Datasets+-+1…png','…1749823757_Union+Node…png'] },
  { id: 'FN-DAT-003', family: 'data-integration', name: 'Filter by variable / output rename', breadth: 4, depth: 3, reach: 2, status: 'PARTIAL', refs: ['…1753278970_8.1+-+Filter+using+Variable…','…1769083231_7+-+Rename+Filter+Output…'] },

  // AIP / assist
  { id: 'FN-AIP-001', family: 'aip-logic', name: 'Test Your Function (preview run, ctrl+shift+D)', breadth: 5, depth: 3, reach: 2, status: 'INAPP', refs: ['…1750079495_Use+LLM+Block+Overview…png','adfg.jpg','afhdafhbcxvbz.jpg','…1962335…'] },
  { id: 'FN-AIP-002', family: 'aip-logic', name: 'Use LLM block configuration (GPT-4o, Allow corrections)', breadth: 2, depth: 2, reach: 2, status: 'PARTIAL', refs: ['…1750079495_Use+LLM+Block+Overvie…png'] },
  { id: 'FN-AIP-003', family: 'aip-logic', name: 'Semantic search / RAG object-set retrieval', breadth: 3, depth: 4, reach: 2, status: 'PARTIAL', refs: ['…1750079495_…','afdjgtsyhgd.jpg'] },
  { id: 'FN-AIP-004', family: 'aip-logic', name: 'Function inputs (userQuestion string) composition', breadth: 4, depth: 3, reach: 2, status: 'PARTIAL', refs: ['agfdgfksjgzbvx.jpg','…1962334…'] },
  { id: 'FN-AIP-005', family: 'aip-logic', name: 'Application wrap: AIP response into app + TB sample app', breadth: 3, depth: 3, reach: 1, status: 'MISSING', refs: ['adhadshdf.jpg','dfgjdfhjds.jpg','…1717696092_000f…'] },

  // Architecture / ops
  { id: 'FN-ARC-001', family: 'architecture-lineage', name: 'Lineage subgraph exploration / group by / remove series', breadth: 2, depth: 4, reach: 3, status: 'INAPP', refs: ['…vertex_overview-system_graph.png'] },
  { id: 'FN-ARC-002', family: 'architecture-lineage', name: 'Environment branching / promotion graph (PROD/UAT/FY/…)', breadth: 1, depth: 3, reach: 2, status: 'MISSING', refs: ['…branches-1.png'] },

  // Learning / docs captures
  { id: 'FN-LEARN-001', family: 'learning-docs', name: 'Workshop course screenshots (widget flows)', breadth: 35, depth: 1, reach: 0, status: 'INSTRUCTIONAL', refs: ['many…'] },
]

// Auto-tally unresolved images (best-effort substring match across registry refs).
const refTokens = REGISTRY.flatMap(r => r.refs.map(v => v.replace(/…/g, '').split(' ').pop()))
const isResolved = f => refTokens.some(tok => tok.length >= 12 && f.includes(tok))
const unresolved = manifest.entries.filter(e => !isResolved(e.file))
const byCat = {}
for (const e of unresolved) (byCat[e.category] ??= []).push(e.file)

const T = (n) => `${Math.round(Math.log10(n + 1) * 100) / 100}`
const scored = REGISTRY.map(r => ({ ...r, score: r.depth + 2 * T(r.breadth) + 3 * Math.min(r.reach, 3), tier: undefined }))
for (const r of scored) {
  r.tier = r.score >= 9 ? 'T1' : r.score >= 5 ? 'T2' : 'T3'
}
const byTier = { T1: scored.filter(r => r.tier === 'T1'), T2: scored.filter(r => r.tier === 'T2'), T3: scored.filter(r => r.tier === 'T3') }

const md = [
  '# FUNCTIONS — Reference-corpus capability inventory (Stage 4)',
  '',
  `Generated from \`public/manifest.json\` (${manifest.totalFiles} files) + vision-verified entries.`,
  '',
  '## Counts by capability family',
  '',
  ...Object.entries(byCat).map(([k, v]) => `- **${FAMILY_LABEL[k] ?? k}**: ${v.length} unresolved images held for review (listed at bottom)`),
  `- **Resolved entries**: ${scored.length} atomic capabilities`,
  '',
  '## Tier summary',
  '',
  `- **T1 universal** (${byTier.T1.length}): ${byTier.T1.map(r => r.id).join(', ')}`,
  `- **T2 contextual** (${byTier.T2.length})`,
  `- **T3 instructional** (${byTier.T3.length})`,
  '',
  '## Registry (sorted by tier)',
  '',
  ...[...byTier.T1, ...byTier.T2, ...byTier.T3].map(r => {
    const statusGlyph = { INAPP: '🟢', PARTIAL: '🟡', MISSING: '🔴', INSTRUCTIONAL: '⚪' }[r.status] ?? '⚪'
    return `### ${r.id} — ${r.name}\n${statusGlyph} ${r.status} · Tier ${r.tier} · depth ${r.depth}/breadth ${r.breadth}/reach ${r.reach}\nRefs: ${r.refs.join(' · ')}\n`
  }),
  '',
  '## Unresolved images by category',
  ...Object.entries(byCat).map(([k, v]) => `### ${k} (${v.length})\n${v.map(f => `- ${f}`).join('\n')}`),
].join('\n')
writeFileSync(new URL('../FUNCTIONS.md', import.meta.url), md)

const json = { version: 2, generatedAt: new Date().toISOString(), totalFiles: manifest.totalFiles, registry: scored, unresolved: byCat }
writeFileSync(new URL('../functions.json', import.meta.url), JSON.stringify(json, null, 2))

console.log('Wrote FUNCTIONS.md + functions.json')
console.log('Tier counts:', Object.fromEntries(Object.entries(byTier).map(([k, v]) => [k, v.length])))
console.log('Unresolved by category:', Object.fromEntries(Object.entries(byCat).map(([k, v]) => [k, v.length])))
