// T-32 — T1 folder install: loader folder-parse + scan normalization.
import { describe, it, expect, vi } from 'vitest'
import { parseFolderScan, extractFolderPack, registerFolderPack, listLocalFolderPacks } from './loader'

const presetsManifest = JSON.stringify({
  id: 'folder-presets',
  name: 'Folder Presets',
  version: '1.2.0',
  kind: 'presets',
  api: '^1.0',
})
const presetsPayload = JSON.stringify([{ id: 'p-9', name: 'Folder preset', systemPrompt: 's', userTemplate: 'u' }])

const themeManifest = JSON.stringify({
  id: 'folder-theme',
  name: 'Folder Theme',
  version: '1.0.0',
  kind: 'theme-packs',
  api: '^1.0',
})
const themeCss = ':root { --green-500: #123456; }'

describe('T-32 loader folder-parse helpers', () => {
  it('registerFolderPack accepts a presets folder (manifest + payload)', () => {
    const r = registerFolderPack(presetsManifest, { 'presets.json': presetsPayload }, 'my-presets')
    expect(r.ok).toBe(true)
    expect(r.unit?.manifest.id).toBe('folder-presets')
    expect(r.unit?.source).toBe('folder')
    expect(r.unit?.sourceUrl).toBe('my-presets')
    expect(r.unit?.files['presets.json']).toBeTruthy()
  })

  it('registerFolderPack accepts theme packs (unlike bare-JSON) but still enforces tokens-only lint + requires payload', () => {
    const ok = registerFolderPack(themeManifest, { 'tokens.css': themeCss }, 'my-theme')
    expect(ok.ok).toBe(true)
    expect(ok.unit?.manifest.kind).toBe('theme-packs')

    const noCss = registerFolderPack(themeManifest, {}, 'my-theme')
    expect(noCss.ok).toBe(false)
    expect(noCss.issues.join(' ')).toMatch(/\.css payload/)

    const badCss = registerFolderPack(themeManifest, { 'tokens.css': '.nav { color: red }' }, 'my-theme')
    expect(badCss.ok).toBe(false)

    const noPayload = registerFolderPack(presetsManifest, {}, 'my-presets')
    expect(noPayload.ok).toBe(false)
    expect(noPayload.issues[0]).toMatch(/payload/)
  })

  it('registerFolderPack rejects unknown api major / bad manifest (same pipeline as bundled)', () => {
    const badApi = registerFolderPack(
      JSON.stringify({ id: 'folder-x', name: 'X', version: '1.0.0', kind: 'presets', api: '^2.0' }),
      { 'presets.json': presetsPayload },
      'x',
    )
    expect(badApi.ok).toBe(false)
    expect(badApi.issues[0]).toMatch(/major 2 unsupported/)

    const badJson = registerFolderPack('{not json', {}, 'x')
    expect(badJson.ok).toBe(false)
  })

  it('extractFolderPack strips the pack directory prefix and keeps payloads relative', () => {
    const extracted = extractFolderPack({
      'my-pack/pack.json': presetsManifest,
      'my-pack/presets.json': presetsPayload,
      'my-pack/notes.txt': 'hello',
    })
    expect(extracted).not.toBeNull()
    expect(extracted!.dir).toBe('my-pack')
    expect(extracted!.manifestText).toBe(presetsManifest)
    expect(extracted!.files['presets.json']).toBe(presetsPayload)
    expect(extracted!.files['notes.txt']).toBe('hello')

    // bare pack.json (no prefix) also works
    const bare = extractFolderPack({ 'pack.json': presetsManifest, 'presets.json': presetsPayload })
    expect(bare?.dir).toBe('')
    expect(bare?.files['presets.json']).toBe(presetsPayload)

    expect(extractFolderPack({ 'readme.md': 'no manifest here' })).toBeNull()
  })

  it('parseFolderScan normalizes array / {packs} / alias shapes and drops manifest-less entries', () => {
    const fromArray = parseFolderScan([
      { dir: 'a', manifest: presetsManifest, files: { 'presets.json': presetsPayload } },
      { dir: 'b', manifestText: themeManifest, files: { 'tokens.css': themeCss } },
      { dir: 'nope', files: {} },
      'garbage',
    ])
    expect(fromArray).toHaveLength(2)
    expect(fromArray.map(p => p.dir)).toEqual(['a', 'b'])
    expect(fromArray[1].manifest).toBe(themeManifest)

    const wrapped = parseFolderScan({ packs: [{ dir: 'a', manifest: presetsManifest, files: {} }] })
    expect(wrapped).toHaveLength(1)

    expect(parseFolderScan(null)).toEqual([])
  })
})

describe('listLocalFolderPacks (browser-safe fallback)', () => {
  it('returns empty + fallback note when invoke is unavailable (no Tauri runtime)', async () => {
    vi.resetModules()
    vi.doMock('@tauri-apps/api/core', () => ({
      invoke: vi.fn(async () => { throw new Error('no runtime') }),
    }))
    const mod = await import('./loader')
    const res = await mod.listLocalFolderPacks()
    expect(res.packs).toEqual([])
    expect(res.fallback).toMatch(/desktop app|browser dev/i)
    vi.doUnmock('@tauri-apps/api/core')
    vi.resetModules()
  })
})
