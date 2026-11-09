// Gold-standard corpus parse — resumable vision+OCR pipeline (S3-C).
// Heuristic pass (existing filename rules) → vision tagging → OCR → manifest v2.
// Run with a paid provider key or local Ollama vision model; skips already-done images.
import { readdirSync, statSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const SRC = 'C:\\Users\\Berry\\Desktop\\Ontology Harness'
const OUT = new URL('../public/manifest.json', import.meta.url)
const THUMBS = new URL('../public/thumbs/', import.meta.url)
mkdirSync(THUMBS, { recursive: true })

// ── pass 1: heuristics (from parse-manifest.mjs) ─────────────────
const RULES = [
  ['architecture-lineage', /pipeline_overview|branches-1|vertex_overview|system_graph/i, 'Vertex / pipeline lineage diagrams'],
  ['application-building', /workshop|widget|object\+table|property\+list|button\+group|section|chart|bar\+chart|pie\+chart|ost|row\+height|filter\+widget|select\+widget|input\+object\+set|object\+set|rename\+object\+table|rename\+header|rename\+filter|layout|fill\+space|max\+height|add\+value|add\+all\+propert/i, 'Workshop application building'],
  ['data-integration', /join|union|code\+repo|repositor|dataset|filter|clean|transform|pipeline\+build/i, 'Code Repositories / Pipeline Builder'],
  ['aip-logic', /\baip\b|logic|llm|preview\+run|semantic\+search|debug/i, 'AIP Logic / LLM functions'],
  ['ontology-layer', /ont\+man|object\+explor|automate|workflow\+lineage|value\+types|ontology.manager/i, 'Ontology Manager / Object Explorer'],
]
const categorize = f => {
  for (const [cat, re, note] of RULES) if (re.test(f)) return { category: cat, note }
  return { category: 'learning-docs', note: 'Browser capture (training context inferred)' }
}

// ── pass 2: vision tagging via any OpenAI-compatible endpoint ────
const VISION_SYSTEM = `You tag screenshots of a Palantir Foundry-style data platform.
Answer in strict JSON only:
{"app":"<module or screen, e.g. Workshop Module Editor, Vertex Graph, AIP Logic","features":["<short kebab features>"],"uiElements":["<key UI elements visible>"],"textSnippet":"<verbatim readable words OCR'd, max 200 chars>","confidence":0.0-1.0}
Keep every array ≤ 6 items. confidence reflects how legible the image is.`

async function visionCall(imagePath, endpoint, model, apiKey) {
  const b64 = readFileSync(imagePath).toString('base64')
  const ext = imagePath.split('.').pop().toLowerCase()
  const mime = ext === 'png' ? 'image/png' : 'image/jpeg'
  const body = {
    model,
    messages: [
      { role: 'system', content: VISION_SYSTEM },
      { role: 'user', content: [{ type: 'text', text: 'Tag this screenshot.' }, { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } }] },
    ],
    temperature: 0,
    response_format: { type: 'json_object' },
  }
  const res = await fetch(`${endpoint.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}) },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`vision ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const j = await res.json()
  const text = j?.choices?.[0]?.message?.content ?? '{}'
  try { return JSON.parse(text) } catch { return { app: 'unknown', features: [], uiElements: [], textSnippet: text.slice(0, 200), confidence: 0 } }
}

// ── thumbnails via Sharp (optional) or skip with warning ─────────
async function thumbnail(file) {
  try {
    const sharp = (await import('sharp')).default
    const target = new URL(`./${file.replace(/\./g, '_')}.webp`, THUMBS)
    await sharp(join(SRC, file)).resize(256).webp({ quality: 70 }).toFile(target)
    return true
  } catch { return false }
}

// ── main ──────────────────────────────────────────────────────────
const files = readdirSync(SRC).filter(f => /\.(png|jpe?g)$/i.test(f)).map(f => ({ file: f, bytes: statSync(join(SRC, f)).size }))

let prev = { entries: [] }
try { prev = JSON.parse(readFileSync(OUT, 'utf8')) } catch {}
const done = new Map(prev.entries?.map(e => [e.file, e]) ?? [])

const flags = { vision: process.argv.includes('--vision'), endpoint: process.env.VISION_BASE ?? 'http://localhost:11434/v1', model: process.env.VISION_MODEL ?? 'qwen2-vl', key: process.env.VISION_KEY ?? '' }

const entries = []
for (const { file, bytes } of files) {
  const heuristics = categorize(file)
  const prevEntry = done.get(file)
  if (prevEntry?.vision?.confidence > 0.8) { entries.push(prevEntry); continue } // resume: already done
  const entry = { file, bytes, category: heuristics.category, note: heuristics.note, heuristic: heuristics, vision: null, dhash: null }
  if (flags.vision) {
    try {
      const v = await visionCall(join(SRC, file), flags.endpoint, flags.model, flags.key)
      entry.vision = { app: v.app, features: v.features ?? [], uiElements: v.uiElements ?? [], textSnippet: (v.textSnippet ?? '').slice(0, 200), confidence: Number(v.confidence ?? 0) }
      if (entry.vision.confidence < 0.6) entry.review = true
      console.log(`  ✓ ${file} → ${entry.vision.app} (${entry.vision.confidence})`)
    } catch (e) {
      console.log(`  ✗ ${file}: ${String(e).slice(0, 80)}`)
      entry.vision = { app: 'error', features: [], uiElements: [], textSnippet: '', confidence: 0 }
      entry.review = true
    }
  }
  // thumbnail (best-effort)
  await thumbnail(file)
  entries.push(entry)
}

const byCat = {}
for (const e of entries) (byCat[e.category] ??= []).push(e.file)
const manifest = { generatedAt: new Date().toISOString(), source: SRC, version: 2, visionEndpoint: flags.endpoint, visionModel: flags.model, totalFiles: entries.length, categories: Object.fromEntries(Object.entries(byCat).map(([k, v]) => [k, { count: v.length, files: v }])), entries }
writeFileSync(OUT, JSON.stringify(manifest, null, 2))
console.log(`\nParsed ${entries.length} files (v2) → public/manifest.json · vision: ${flags.vision ? `${flags.model} @ ${flags.endpoint}` : 'heuristic only'}`)
