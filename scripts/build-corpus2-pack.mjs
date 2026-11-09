// Build corpus pack manifests from real data — run: node scripts/build-corpus2-pack.mjs
// 1) packs/corpus-2/manifest.json from asset/corpus-2/index.json (72 tiles, evidence-honest categories)
// 2) packs/corpus-134/manifest.json = byte snapshot of the live public/manifest.json (corpus 1)
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs'

const idx = JSON.parse(readFileSync(new URL('../asset/corpus-2/index.json', import.meta.url), 'utf8'))

// Filename → family map (explicit rules, mirrors the ledger's families from the 5 vision passes).
const RULES = [
  ['governance', /foundry-branching/],
  ['pipeline-llm', /pipeline-builder|20d2c76e|31fa4007/],
  ['lineage', /data-lineage|workflow-lineage/],
  ['workspaces', /code-workspaces/],
  ['marketplace', /marketplace/],
  ['peer-manager', /peer-manager/],
  ['observability', /aip-observability|session-debugging|session-logs|session-trace/],
  ['machinery', /machinery/],
  ['agent-apps', /2c7aba76|61762c0b|e5a01e61|flight-agent-sample-inputs/],
  ['functions-sdk', /7e5b82e6|96fbc727|a9a7ffa6|^download\./],
  ['ai-fde', /ai-fde|model-selector/],
  ['prompting', /b9781d16/],
  ['scoping', /instructor_/],
  ['agent-studio', /add-tool-options|add-variable-templates|create-repository|enable-scoped|import-model|new-agent-input|open-scope|prompt-input-reference|repository-checks|session-completion|system-prompt-editor|tag-and-release|variable-operation-chains/],
]

const cat = (file) => {
  for (const [name, re] of RULES) if (re.test(file)) return name
  return 'reference-misc'
}

const categories = {}
const entries = []
for (const t of idx) {
  const c = cat(t.src)
  categories[c] ??= { count: 0, files: [] }
  categories[c].count++
  categories[c].files.push(`${t.num} ${t.src}`)
  entries.push({ file: `${t.num} ${t.src}`, category: c, note: t.copy === t.src ? '' : 'duplicate-removed copy name', bytes: t.w * t.h, vision: null })
}

const manifest = {
  generatedAt: new Date().toISOString(),
  source: 'C:\\Users\\Berry\\Desktop\\Ontology harness screenshots 2 (via stitch2.mjs) · 12 byte-identical dupes skipped',
  totalFiles: idx.length,
  categories,
  version: 2,
  entries,
}

mkdirSync(new URL('../packs/corpus-2/', import.meta.url), { recursive: true })
writeFileSync(new URL('../packs/corpus-2/manifest.json', import.meta.url), JSON.stringify(manifest, null, 2))
// corpus-1 snapshot — honest as-built copy of the live manifest
copyFileSync(new URL('../public/manifest.json', import.meta.url), new URL('../packs/corpus-134/manifest.json', import.meta.url))
console.log(`corpus-2 manifest: ${manifest.totalFiles} tiles, ${Object.keys(categories).length} categories; corpus-134 snapshot: 134 files`)
