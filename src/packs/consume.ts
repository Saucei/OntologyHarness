// consume.ts — T-36 pack consumption: makes enabled plugins take effect outside
// the Plugin Manager. Reads the persisted workspace meta (packState + customPacks),
// re-materializes the active PackUnits exactly the way PluginManager does, and
// provides the pure merge helpers its consumers (Corpus Manifest view, corpus.search
// agent tool, Preset Library) call. No pack code is ever executed — data only.
import { loadPacks, registerCustomPack, registerFolderPack, packCorpus, packPresets, type PackUnit, type PackCorpusManifest } from './loader'
import type { Preset } from '../data/presets'
import { ws } from '../store'

/** Mirror of PluginManager's persisted custom-pack record. */
export type CustomPackRecord = { json: string; source: 'url' | 'pasted' | 'folder'; sourceUrl?: string; jwt: number; files?: Record<string, string> }

/** Persisted enable toggles (packId → on/off). */
export function readPackState(): Record<string, boolean> {
  return ((ws.meta?.packState as Record<string, boolean>) ?? {})
}

/** Re-materialize session packs (URL / pasted / folder) from workspace meta. */
export function customPackUnits(): PackUnit[] {
  const records = ((ws.meta?.customPacks as CustomPackRecord[]) ?? [])
  return records.map(r => {
    const ru = r.source === 'folder'
      ? registerFolderPack(r.json, r.files ?? {}, r.sourceUrl).unit
      : registerCustomPack(r.json, r.source as 'url' | 'pasted', r.sourceUrl).unit
    if (ru) { ru.jwt = r.jwt; ru.source = r.source; ru.sourceUrl = r.sourceUrl }
    return ru
  }).filter(Boolean) as PackUnit[]
}

/** Every known pack: bundled + session-installed. */
export function allPackUnits(): PackUnit[] {
  return [...loadPacks(), ...customPackUnits()]
}

/** Valid packs whose enable toggle is ON — the packs that must take effect. */
export function enabledPackUnits(): PackUnit[] {
  const state = readPackState()
  return allPackUnits().filter(u => u.valid && state[u.manifest.id] === true)
}

/** Enabled presets-kind packs → validated Preset[] (Preset Library merge). */
export function enabledPackPresets(): Preset[] {
  return packPresets(enabledPackUnits())
}

export type MergedCorpus = {
  /** Category → files, base manifest first, then pack files, deduped by file name. */
  categories: Record<string, { count: number; files: string[] }>
  /** Unique file count across base + packs. */
  totalFiles: number
  /** file → pack name, present only for pack-sourced files. */
  fileSource: Record<string, string>
  /** Display names of the packs that contributed. */
  packNames: string[]
}

/**
 * Merge the base corpus manifest with enabled corpus-kind packs.
 * Base files win on name collisions; pack-added files carry their pack label.
 */
export function mergeCorpus(base: Pick<PackCorpusManifest, 'categories'> | null, units: PackUnit[]): MergedCorpus {
  const categories: Record<string, { count: number; files: string[] }> = {}
  const fileSource: Record<string, string> = {}
  const seen = new Set<string>()
  const push = (cat: string, files: string[], packName: string | null) => {
    const bucket = categories[cat] ?? { count: 0, files: [] }
    for (const f of files) {
      if (seen.has(f)) continue
      seen.add(f)
      bucket.files.push(f)
      bucket.count += 1
      if (packName) fileSource[f] = packName
    }
    categories[cat] = bucket
  }
  if (base) for (const [cat, c] of Object.entries(base.categories ?? {})) push(cat, c.files ?? [], null)
  const packs = units.filter(u => u.valid && u.manifest.kind === 'corpus')
  for (const u of packs) {
    const m = packCorpus(u)
    if (!m) continue
    for (const [cat, c] of Object.entries(m.categories ?? {})) push(cat, c.files ?? [], u.manifest.name)
  }
  return {
    categories,
    totalFiles: seen.size,
    fileSource,
    packNames: packs.map(u => u.manifest.name),
  }
}

/** Pack-sourced files as search-friendly entries (note: "pack: <name>"). */
export function packEntries(merged: MergedCorpus): Array<{ file: string; category: string; note: string }> {
  const out: Array<{ file: string; category: string; note: string }> = []
  for (const [cat, c] of Object.entries(merged.categories)) {
    for (const f of c.files) {
      const src = merged.fileSource[f]
      if (src) out.push({ file: f, category: cat, note: `pack: ${src}` })
    }
  }
  return out
}

/** Where each pack kind takes effect — surfaced in the Plugin Manager detail pane. */
export const PACK_LANDING: Record<string, string> = {
  'theme-packs': 'Global theme — CSS custom properties, both modes',
  'corpus': 'Corpus Manifest view + corpus.search agent tool',
  'presets': 'Preset Library cards (runnable presets)',
  'rules': 'Reserved — no consumer wired yet',
  'prompts': 'Reserved — no consumer wired yet',
}
