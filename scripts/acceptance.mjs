// Acceptance runner (S3-G) — deterministic checks against the app's own logic modules.
// Exercises the Stage 2 verified contracts headlessly and writes ACCEPTANCE_REPORT.md.
import { writeFileSync } from 'node:fs'

const results = []
const check = (name, ok, detail = '') => results.push({ name, ok: !!ok, detail })

// Runs inside the same module graph the app uses (tsx/vitest preload this file).
const { datasetHash, diffSummary, canonicalize } = await import('../src/lib/hash.ts')
const { validateObjectType } = await import('../src/data/valueTypes.ts')
const { validateWorkshop } = await import('../src/workshop/validate.ts')
const { retrieve } = await import('../src/aip/retrieval.ts')

// 1. Round-trip hash (Stage 2 Slice 1 acceptance)
const BREWERY = {
  columns: [{ name: 'sku', type: 'string' }, { name: 'style', type: 'string' }, { name: 'demand_bbl', type: 'number' }],
  rows: [
    { sku: 'P-0001', style: 'Belgian Ale', demand_bbl: 220 },
    { sku: 'P-0002', style: 'IPA', demand_bbl: 211 },
    { sku: 'P-0003', style: 'DC Ale', demand_bbl: 158 },
  ],
}
const before = await datasetHash(BREWERY)
const after = await datasetHash({ columns: BREWERY.columns, rows: [...BREWERY.rows].reverse() })
check('Round-trip: CSV hash stable across row permutations', before === after, before.slice(0, 12))
check('Round-trip: diffSummary equal on clone', diffSummary(BREWERY, BREWERY).equal)
check('Canonical: deterministic string', canonicalize(BREWERY) === canonicalize({ ...BREWERY, rows: [...BREWERY.rows].reverse() }))

// 2. Ontology validation (Slice 1)
const issues = validateObjectType({
  id: 'ot-product', name: 'Product', backing: 'ontology/product',
  properties: [{ name: 'productId', type: 'ValueType/ProductId', indexed: true }, { name: 'abv', type: 'ValueType/ABV', indexed: false }],
})
check('Ontology: seed product schema validates clean', issues.length === 0, `${issues.length} issues`)
const badType = validateObjectType({ id: 'x', name: 'X', backing: 'derived/x', properties: [{ name: 'a', type: 'nope/Foo', indexed: true }] })
check('Ontology: unknown value type blocked', badType.some(i => /unknown value type/.test(i.message)))

// 3. Workshop validate — block → fix → ok (Slice 2)
const okWs = validateWorkshop([{ id: 1, name: 'Main', widgets: [{ id: 1, kind: 'object-table', label: 'T', binding: 'Active object set · renamed: Orders', icon: 'table' }] }], 'M')
check('Workshop: bound config publishes', okWs.ok, `${okWs.widgetCount} widgets`)
const blocked = validateWorkshop([{ id: 1, name: 'Main', widgets: [{ id: 1, kind: 'object-table', label: 'T', binding: 'unbound · set Input Object Set', icon: 'table' }] }], 'M')
check('Workshop: unbound blocks with named issue', !blocked.ok && blocked.issues.join(' ').includes('T'))

// 4. Grounded retrieval — TB cites, Mars refuses (Slice 3)
const tb = retrieve('What is the recommended treatment for Tuberculosis?')
check('AIP: TB question grounds (chunk-tb-1 top)', tb.grounded && tb.hits[0].id === 'chunk-tb-1', tb.grounded ? `best=${tb.best}` : 'refused?!')
const mars = retrieve('What is the recommended radiation shielding for a Mars colony?')
check('AIP: Mars question refused pre-LLM', !mars.grounded && mars.threshold > mars.best, `best=${mars.best}`)

// 5. Jobs migration (Slice 2)
globalThis.window = { setTimeout, clearTimeout, localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } }
globalThis.localStorage = globalThis.window.localStorage
globalThis.document = { documentElement: { dataset: {} } }
const { loadJobs, createJob } = await import('../src/jobs.ts')
const { ws } = await import('../src/store.ts')
ws.hydrated = true
ws.jobs = [ { id: 'job-v1', title: 'Old', source: 'manual', status: 'backlog', owner: 'x', due: 'soon', tags: [], createdAt: new Date().toISOString(), activity: [] } ]
const migrated = loadJobs()
check('Jobs: v1 migrates to v2 with attachments[]', migrated.every(j => Array.isArray(j.attachments) && j.v === 2))
const job = createJob({ title: 'Acceptance job', attachments: [{ kind: 'dataset', id: 'ds-x', label: 'x.csv', hash: 'abc123', addedAt: new Date().toISOString() }] })
check('Jobs: createJob echoes attachments', job.attachments[0].hash === 'abc123')

const passed = results.filter(r => r.ok).length
const lines = [
  '# Acceptance Report',
  '',
  `Generated: ${new Date().toISOString()} · passed **${passed}/${results.length}**`,
  '',
  '| Check | Result | Detail |',
  '|---|---|---|',
  ...results.map(r => `| ${r.name} | ${r.ok ? '✅ PASS' : '❌ FAIL'} | ${r.detail} |`),
  '',
]
writeFileSync(new URL('../ACCEPTANCE_REPORT.md', import.meta.url), lines.join('\n'))
console.log(lines.join('\n'))
if (passed !== results.length) process.exitCode = 1
