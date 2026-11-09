/// <reference types="vite/client" />
// T1 pack loader — discovers in-project packs, validates manifests, applies theme packs.
// Theme law: pack CSS may only assign custom properties; anything else is refused.
// API law: manifest.api must match the registry major (MODULE_API) or the pack is refused.
import { MODULE_API } from '../modules/contract'
import { appendAudit } from '../store'

export type PackKind = 'theme-packs' | 'presets' | 'corpus' | 'rules' | 'prompts'

export type PackManifest = {
  id: string
  name: string
  version: string
  kind: PackKind
  api: string
  author?: string
  description?: string
  entry?: string
}

export type PackUnit = {
  manifest: PackManifest
  /** validated payload text files keyed relative to the pack folder (e.g. 'tokens.css', 'presets.json') */
  files: Record<string, string>
  valid: boolean
  issues: string[]
  source: 'bundled' | 'url' | 'pasted' | 'folder'
  sourceUrl?: string
  jwt: number
}

/** One pack folder discovered on disk (Tauri scan or directory-picker read).
 *  `manifest` is the raw pack.json text; `files` are sibling payload texts keyed
 *  by name relative to the folder (e.g. 'tokens.css'). */
export type FolderPackScanResult = {
  dir: string
  manifest: string
  files: Record<string, string>
}

const MANIFEST_GLOB = import.meta.glob('/packs/*/pack.json', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>
const PAYLOAD_GLOB = import.meta.glob('/packs/*/*', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>

const KINDS: PackKind[] = ['theme-packs', 'presets', 'corpus', 'rules', 'prompts']

export class PackError extends Error {
  constructor(message: string) { super(message); this.name = 'PackError' }
}

/** Theme law lint — every declaration must assign a --custom property. */
export function lintThemeCss(css: string): string[] {
  const issues: string[] = []
  const blockRe = /([^{}]+)\{([^}]*)\}/g
  let m: RegExpExecArray | null
  while ((m = blockRe.exec(css))) {
    const sel = m[1].replace(/\/\*[\s\S]*?\*\//g, '').trim()
    if (!sel) continue
    if (!/^(:root|html|\[data-theme[^\]]*?\])/.test(sel)) issues.push(`selector not a theme root: "${sel.slice(0, 40)}"`)
    for (const decl of m[2].split(';')) {
      const d = decl.replace(/\/\*[\s\S]*?\*\//g, '').trim()
      if (!d) continue
      if (!/^--[a-zA-Z0-9-]+\s*:/.test(d)) issues.push(`non-token declaration refused: "${d.slice(0, 44)}"`)
    }
  }
  return issues
}

function parseManifest(text: string): { manifest?: PackManifest; issue?: string } {
  let raw: unknown
  try { raw = JSON.parse(text) } catch (e) { return { issue: `pack.json is not valid JSON (${e})` } }
  const r = raw as Record<string, unknown>
  const req = ['id', 'name', 'version', 'kind', 'api'] as const
  const missing = req.filter(k => typeof r[k] !== 'string' || !(r[k] as string).length)
  if (missing.length) return { issue: `missing manifest fields: ${missing.join(', ')}` }
  if (!/^[a-z][a-z0-9-]*$/.test(r.id as string)) return { issue: `bad pack id "${r.id}" (kebab-case required)` }
  if (!KINDS.includes(r.kind as PackKind)) return { issue: `unknown kind "${r.kind}" (allowed: ${KINDS.join(' | ')})` }
  const m = /^(~|\^)?(\d+)\./.exec(r.api as string)
  if (!m) return { issue: `api must look like "^1.0" (got "${r.api}")` }
  const packMajor = Number(m[2])
  const selfMajor = Number(MODULE_API.split('.')[0])
  if (packMajor !== selfMajor) return { issue: `api major ${packMajor} unsupported — this build is MODULE_API ${selfMajor}.x` }
  return { manifest: r as unknown as PackManifest }
}

function buildUnit(manifest: PackManifest, files: Record<string, string>, source: PackUnit['source'], sourceUrl?: string): PackUnit {
  const unit: PackUnit = { manifest, files, valid: true, issues: [], source, sourceUrl, jwt: Date.now() }
  if (manifest.kind === 'theme-packs') {
    const cssPaths = Object.keys(files).filter(k => k.endsWith('.css'))
    if (!cssPaths.length) { unit.valid = false; unit.issues.push('theme pack ships no .css payload') }
    for (const p of cssPaths) unit.issues.push(...lintThemeCss(files[p]).map(i => `${p}: ${i}`))
    if (unit.issues.length) unit.valid = false
  }
  if (manifest.kind === 'presets' || manifest.kind === 'rules' || manifest.kind === 'prompts') {
    const jsonPath = Object.keys(files).find(k => k.endsWith('.json') && !k.endsWith('pack.json'))
    if (!jsonPath) { unit.valid = false; unit.issues.push('no data payload .json in pack') }
  }
  if (manifest.kind === 'corpus') {
    const has = Object.keys(files).some(k => k.endsWith('.json') && !k.endsWith('pack.json'))
    if (!has) { unit.valid = false; unit.issues.push('corpus pack ships no manifest payload') }
  }
  return unit
}

/** In-project packs (dev + bundled build safe via Vite raw glob). */
export function loadPacks(): PackUnit[] {
  const out: PackUnit[] = []
  for (const [path, text] of Object.entries(MANIFEST_GLOB)) {
    const dir = path.slice('/packs/'.length).split('/')[0]
    const parsed = parseManifest(text as string)
    if (parsed.issue || !parsed.manifest) {
      out.push({ manifest: { id: dir, name: dir, version: '0.0.0', kind: 'prompts', api: '0' } as PackManifest, files: {}, valid: false, issues: [parsed.issue!], source: 'bundled', jwt: 0 })
      continue
    }
    const files: Record<string, string> = {}
    for (const [p, t] of Object.entries(PAYLOAD_GLOB)) {
      if (p === path || !p.startsWith(`/packs/${dir}/`)) continue
      const rel = p.slice(`/packs/${dir}/`.length)
      if (rel.endsWith('/')) continue
      files[rel] = t as string
    }
    out.push(buildUnit(parsed.manifest, files, 'bundled'))
  }
  return out.sort((a, b) => a.manifest.id.localeCompare(b.manifest.id))
}

/** Register a session pack from pasted JSON (single-file pack: manifest + optional inline `data`). */
export function registerCustomPack(jsonText: string, source: 'url' | 'pasted', sourceUrl?: string): { ok: boolean; unit?: PackUnit; issues: string[] } {
  const parsed = parseManifest(jsonText)
  if (parsed.issue || !parsed.manifest) return { ok: false, issues: [parsed.issue ?? 'invalid manifest'] }
  const m = parsed.manifest
  if (m.kind === 'theme-packs') {
    return { ok: false, issues: ['theme packs cannot be installed as bare JSON — bundle a full pack folder (ships tokens.css)'] }
  }
  const files: Record<string, string> = {}
  try {
    const raw = JSON.parse(jsonText) as Record<string, unknown>
    if (m.kind === 'corpus') {
      // A pasted full manifest (with categories/totalFiles) or {corpus: "<json string>"}
      const looksLikeManifest = !!raw.categories && !!raw.totalFiles
      if (looksLikeManifest) files['manifest.json'] = jsonText
      else if (typeof raw.corpus === 'string') files['manifest.json'] = raw.corpus as string
    } else {
      const payload = raw.data ?? raw.presets
      if (payload != null) files['data.json'] = JSON.stringify(payload, null, 2)
    }
  } catch { /* payload optional — validation below decides */ }
  const unit = buildUnit(m, files, source, sourceUrl)
  return { ok: unit.valid, unit: unit.valid ? unit : undefined, issues: unit.issues }
}

/** Normalize a raw `list_local_packs` payload into FolderPackScanResult[].
 *  Accepts a bare array, `{ packs: [...] }`, or a single pack object; skips
 *  entries without a manifest. Tolerant of `manifestText` / `folder` aliases. */
export function parseFolderScan(raw: unknown): FolderPackScanResult[] {
  const list: unknown[] = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as { packs?: unknown }).packs)
      ? ((raw as { packs: unknown[] }).packs as unknown[])
      : raw && typeof raw === 'object' && typeof (raw as { manifest?: unknown }).manifest === 'string'
        ? [raw]
        : []
  const out: FolderPackScanResult[] = []
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue
    const e = entry as Record<string, unknown>
    const manifest = (e.manifest as string) ?? (e.manifestText as string)
    if (typeof manifest !== 'string' || !manifest.length) continue
    const dir = typeof e.dir === 'string' ? e.dir : typeof e.folder === 'string' ? e.folder : ''
    const filesRaw = (e.files as Record<string, string>) ?? {}
    const files: Record<string, string> = {}
    if (filesRaw && typeof filesRaw === 'object') {
      for (const [k, v] of Object.entries(filesRaw)) {
        if (k === 'pack.json' || k.endsWith('/pack.json')) continue
        if (typeof v === 'string') files[k] = v
      }
    }
    out.push({ dir, manifest, files })
  }
  return out.sort((a, b) => a.dir.localeCompare(b.dir))
}

/** Extract { manifestText, files, dir } from a relative-path→text map (directory picker).
 *  Keys may be bare ("pack.json") or prefixed ("my-pack/pack.json", "C:\\...\\pack.json").
 *  Returns null when no pack.json is present. */
export function extractFolderPack(entries: Record<string, string>): { manifestText: string; files: Record<string, string>; dir: string } | null {
  let manifestKey: string | null = null
  for (const k of Object.keys(entries)) {
    const norm = k.replace(/\\/g, '/')
    if (norm === 'pack.json' || norm.endsWith('/pack.json')) {
      // Prefer the shallowest pack.json when several exist.
      if (manifestKey === null) manifestKey = k
      else {
        const curDepth = manifestKey.replace(/\\/g, '/').split('/').filter(Boolean).length
        const depth = norm.split('/').filter(Boolean).length
        if (depth < curDepth) manifestKey = k
      }
    }
  }
  if (manifestKey === null) return null
  const normKey = manifestKey.replace(/\\/g, '/')
  const dir = normKey.includes('/') ? normKey.slice(0, normKey.lastIndexOf('/')) : ''
  const prefix = dir ? `${dir}/` : ''
  const files: Record<string, string> = {}
  for (const [k, v] of Object.entries(entries)) {
    const norm = k.replace(/\\/g, '/')
    if (norm === normKey) continue
    if (prefix && norm.startsWith(prefix)) files[norm.slice(prefix.length)] = v
    else if (!prefix && !norm.includes('/')) files[norm] = v
  }
  // If the picker returned nested subfolders, keep names relative to the pack root.
  return { manifestText: entries[manifestKey], files, dir }
}

/** Register a full on-disk pack folder: pack.json text + sibling payload files.
 *  Unlike bare-JSON install, theme packs are allowed (tokens.css is present).
 *  Validates via the same parseManifest + buildUnit pipeline as bundled packs. */
export function registerFolderPack(manifestText: string, files: Record<string, string>, sourceUrl?: string): { ok: boolean; unit?: PackUnit; issues: string[] } {
  const parsed = parseManifest(manifestText)
  if (parsed.issue || !parsed.manifest) return { ok: false, issues: [parsed.issue ?? 'invalid manifest'] }
  const clean: Record<string, string> = {}
  for (const [k, v] of Object.entries(files)) {
    if (k === 'pack.json' || k.endsWith('/pack.json')) continue
    clean[k] = v
  }
  const unit = buildUnit(parsed.manifest, clean, 'folder', sourceUrl)
  return { ok: unit.valid, unit: unit.valid ? unit : undefined, issues: unit.issues }
}

/** Scan the local plugins folder via the Tauri `list_local_packs` command.
 *  Browser-safe: when there is no Tauri runtime (Vite dev), resolves with an
 *  empty list + a human-readable `fallback` note instead of throwing. */
export async function listLocalFolderPacks(): Promise<{ packs: FolderPackScanResult[]; fallback?: string }> {
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    const raw = await (invoke as (cmd: string) => Promise<unknown>)('list_local_packs')
    return { packs: parseFolderScan(raw) }
  } catch {
    return {
      packs: [],
      fallback: 'Local folder scan needs the desktop app (no Tauri runtime in browser dev). Use "Install from folder" to pick a pack directory instead.',
    }
  }
}

/* ── theme application ─────────────────────────────────────────────────────── */
const themeStyleId = (packId: string) => `oh-pack-${packId}`

export function applyThemePack(pack: PackUnit, on: boolean) {
  const id = themeStyleId(pack.manifest.id)
  let el = document.getElementById(id) as HTMLStyleElement | null
  if (!on) { el?.remove(); return }
  if (el) return
  el = document.createElement('style')
  el.id = id
  el.textContent = Object.entries(pack.files).filter(([k]) => k.endsWith('.css')).map(([, v]) => v).join('\n')
  document.head.appendChild(el)
}

export function auditPackAction(action: 'install' | 'enable' | 'disable' | 'remove', packId: string, detail = '') {
  appendAudit({
    at: new Date().toISOString(),
    actor: 'user',
    action: `plugin:${action}`,
    target: packId,
    detail,
  })
}

/* ── typed payload consumers ───────────────────────────────────────────────── */
import type { Preset } from '../data/presets'
import { validatePreset } from '../data/presets'

export type PackCorpusManifest = { generatedAt: string; source: string; totalFiles: number; categories: Record<string, { count: number; files: string[] }> }

/** Validated pack presets (presets-kind packs, enabled ones only filtered by caller). */
export function packPresets(units: PackUnit[]): Preset[] {
  const out: Preset[] = []
  for (const u of units) {
    if (!u.valid || u.manifest.kind !== 'presets') continue
    try {
      const path = Object.keys(u.files).find(k => k.endsWith('.json') && !k.endsWith('pack.json'))
      if (!path) continue
      const arr = JSON.parse(u.files[path]) as unknown
      if (Array.isArray(arr)) for (const p of arr) { const v = validatePreset(p as Preset); if (v.ok) out.push(p as Preset) }
    } catch { /* malformed payload stays invisible */ }
  }
  return out
}

/** Corpus manifest embedded in a corpus-kind pack. */
export function packCorpus(u: PackUnit): PackCorpusManifest | null {
  if (!u.valid || u.manifest.kind !== 'corpus') return null
  try { return JSON.parse(u.files['manifest.json']) as PackCorpusManifest } catch { return null }
}

export function packDataEntryCount(u: PackUnit): number {
  const c = packCorpus(u)
  if (c) return c.totalFiles ?? Object.keys(c.categories ?? {}).length
  if (u.manifest.kind === 'presets') try { return (JSON.parse(u.files['data.json']) as unknown[]).length } catch { return 0 }
  return 0
}
