// Phase 1+2 of the master prompt, automated: parse the reference corpus,
// categorize by heuristics + curated overrides, emit manifest.json.
import { readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const SRC = 'C:\\Users\\Berry\\Desktop\\Ontology Harness'
const OUT = new URL('../public/manifest.json', import.meta.url)

const RULES = [
  ['architecture-lineage', /pipeline_overview|branches-1|vertex_overview|system_graph/i, 'Vertex / pipeline lineage diagrams'],
  ['ontology-layer', /ont\+man|object\+explor|automate|workflow\+lineage|value\+types|ontology.manager/i, 'Ontology Manager / Object Explorer'],
  ['data-integration', /join|union|code\+repo|repositor|dataset|filter|clean|transform|pipeline\+build/i, 'Code Repositories / Pipeline Builder'],
  ['application-building', /workshop|widget|object\+table|property\+list|button\+group|section|chart|bar\+chart|pie\+chart|ost|row\+height|filter\+widget|select\+widget|input\+object\+set|object\+set|rename\+object\+table|rename\+header|rename\+filter|layout|fill\+space|max\+height|add\+value|add\+all\+propert/i, 'Workshop application building'],
  ['aip-logic', /\baip\b|logic|llm|preview\+run|semantic\+search|debug/i, 'AIP Logic / LLM functions'],
  ['learning-docs', /instructor|screenshot|course|e2e|speedrun/i, 'Instructor-led training captures'],
]

const stats = readdirSync(SRC).filter(f => /\.(png|jpe?g)$/i.test(f)).map(f => {
  const s = statSync(join(SRC, f))
  let category = 'learning-docs', note = 'Browser capture (training context inferred)'
  let matched = false
  for (const [cat, re, n] of RULES) if (re.test(f)) { category = cat; note = n; matched = true; break }
  return { file: f, category, note, bytes: s.size }
})

const summary = {}
for (const s of stats) (summary[s.category] ??= []).push(s.file)

const manifest = {
  generatedAt: new Date().toISOString(),
  source: SRC,
  totalFiles: stats.length,
  categories: Object.fromEntries(Object.entries(summary).map(([k, v]) => [k, { count: v.length, files: v }])),
  entries: stats,
}
writeFileSync(OUT, JSON.stringify(manifest, null, 2))
console.log('Parsed', stats.length, 'files →', OUT.pathname)
for (const [k, v] of Object.entries(summary)) console.log(` ${k}: ${v.length}`)
