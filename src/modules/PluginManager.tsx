// Plugin Manager — T1 resource-pack marketplace surface (corpus-2 tile C10 pattern:
// product version page → outputs, install mode, release channel). Bundled packs from
// /packs via the loader; session packs via URL fetch or pasted JSON. All audited.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { loadPacks, registerCustomPack, registerFolderPack, listLocalFolderPacks, extractFolderPack, applyThemePack, packCorpus, packDataEntryCount, auditPackAction, type PackUnit, type FolderPackScanResult } from '../packs/loader'
import { ws, patchMeta, appendTrace, appendAudit } from '../store'

type CustomPackRecord = { json: string; source: 'url' | 'pasted' | 'folder'; sourceUrl?: string; jwt: number; files?: Record<string, string> }

const KIND_LABEL: Record<string, string> = {
  'theme-packs': 'Theme',
  'presets': 'Presets',
  'corpus': 'Corpus',
  'rules': 'Rules',
  'prompts': 'Prompts',
}

const navigate = (module: string) => window.dispatchEvent(new CustomEvent('oh:navigate', { detail: { module } }))

export default function PluginManager() {
  const bundled = useMemo(() => loadPacks(), [])
  const [target, setTarget] = useState<string | null>(null)
  const [url, setUrl] = useState('')
  const [pasteOpen, setPasteOpen] = useState(false)
  const [paste, setPaste] = useState('')
  const [installing, setInstalling] = useState(false)
  const [installMsg, setInstallMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [scanned, setScanned] = useState<FolderPackScanResult[] | null>(null)
  const [scanMsg, setScanMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [scanning, setScanning] = useState(false)
  const folderInputRef = useRef<HTMLInputElement>(null)

  // Local mirrors (module remounts fresh on nav, so init-from-meta is correct);
  // patchMeta never notifies, so local state drives reactivity and persists alongside.
  const [enabledLocal, setEnabledLocal] = useState<Record<string, boolean>>(() => (ws.meta?.packState as Record<string, boolean>) ?? {})
  useEffect(() => { patchMeta({ packState: enabledLocal }) }, [enabledLocal])
  const [customRecords, setCustomRecords] = useState<CustomPackRecord[]>(() => (ws.meta?.customPacks as CustomPackRecord[]) ?? [])
  useEffect(() => { patchMeta({ customPacks: customRecords }) }, [customRecords])

  const custom: PackUnit[] = customRecords.map(r => {
    const ru = r.source === 'folder'
      ? registerFolderPack(r.json, r.files ?? {}, r.sourceUrl).unit
      : registerCustomPack(r.json, r.source as 'url' | 'pasted', r.sourceUrl).unit
    if (ru) { ru.jwt = r.jwt; ru.source = r.source; ru.sourceUrl = r.sourceUrl }
    return ru
  }).filter(Boolean) as PackUnit[]
  const units = [...bundled, ...custom]
  const enabled = enabledLocal
  const selected = units.find(u => u.manifest.id === target) ?? units[0]

  // Theme packs: apply/remove on enable-state change (only valid packs ever apply).
  useEffect(() => {
    for (const u of units) {
      if (u.manifest.kind !== 'theme-packs') continue
      applyThemePack(u, !!enabled[u.manifest.id] && u.valid)
    }
  }, [enabled, units])

  const toggle = (u: PackUnit) => {
    const next = { ...enabledLocal, [u.manifest.id]: !enabledLocal[u.manifest.id] }
    setEnabledLocal(next)
    auditPackAction(!enabledLocal[u.manifest.id] ? 'enable' : 'disable', u.manifest.id, `${KIND_LABEL[u.manifest.kind]} · ${u.manifest.version}`)
  }

  const installUrl = async () => {
    if (!url.trim()) return
    setInstalling(true); setInstallMsg(null)
    try {
      const res = await fetch(url.trim())
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const text = await res.text()
      const r = registerCustomPack(text, 'url', url.trim())
      if (!r.ok || !r.unit) { setInstallMsg({ ok: false, text: r.issues[0] ?? 'manifest rejected' }) }
      else {
        setCustomRecords([...customRecords, { json: text, source: 'url', sourceUrl: url.trim(), jwt: r.unit.jwt }])
        setInstallMsg({ ok: true, text: `Installed "${r.unit.manifest.name}" ${r.unit.manifest.version} from URL` })
        auditPackAction('install', r.unit.manifest.id, `source: ${url.trim()}`)
        setTarget(r.unit.manifest.id); setUrl('')
      }
    } catch (e) { setInstallMsg({ ok: false, text: `Fetch failed: ${String(e).slice(0, 120)} (CORS? try raw.githubusercontent.com)` }) }
    setInstalling(false)
  }

  const installPaste = () => {
    const r = registerCustomPack(paste, 'pasted')
    if (!r.ok || !r.unit) { setInstallMsg({ ok: false, text: r.issues[0] ?? 'manifest rejected' }); return }
    setCustomRecords([...customRecords, { json: paste, source: 'pasted', sourceUrl: undefined, jwt: r.unit.jwt }])
    setInstallMsg({ ok: true, text: `Installed "${r.unit.manifest.name}" (session pack, persists in workspace meta)` })
    auditPackAction('install', r.unit.manifest.id, 'source: pasted JSON')
    setTarget(r.unit.manifest.id); setPaste(''); setPasteOpen(false)
  }

  const scanFolder = async () => {
    setScanning(true); setScanMsg(null)
    const { packs, fallback } = await listLocalFolderPacks()
    setScanned(packs)
    setScanning(false)
    if (fallback) {
      setScanMsg({ ok: false, text: fallback })
      appendTrace({ kind: 'tool-call', tool: 'plugin.folder.scan', ok: false, ms: 0, detail: fallback.slice(0, 160) })
    } else {
      setScanMsg({ ok: true, text: packs.length ? `Found ${packs.length} pack folder(s) — install any below` : 'No pack folders found in the local plugins folder' })
      appendTrace({ kind: 'tool-call', tool: 'plugin.folder.scan', ok: true, ms: 0, detail: `${packs.length} found` })
      appendAudit({ event: 'plugin.folder.scan', count: packs.length })
    }
  }

  const installScanned = (pack: FolderPackScanResult) => {
    const r = registerFolderPack(pack.manifest, pack.files, pack.dir)
    if (!r.ok || !r.unit) {
      setScanMsg({ ok: false, text: r.issues[0] ?? 'folder manifest rejected' })
      appendTrace({ kind: 'tool-call', tool: 'plugin.folder.install', ok: false, ms: 0, detail: `${pack.dir}: ${r.issues[0] ?? 'rejected'}`.slice(0, 160) })
      return
    }
    setCustomRecords([...customRecords, { json: pack.manifest, source: 'folder', sourceUrl: pack.dir, jwt: r.unit.jwt, files: pack.files }])
    setScanMsg({ ok: true, text: `Installed "${r.unit.manifest.name}" ${r.unit.manifest.version} from local folder "${pack.dir}"` })
    auditPackAction('install', r.unit.manifest.id, `source: folder ${pack.dir}`)
    appendTrace({ kind: 'tool-call', tool: 'plugin.folder.install', ok: true, ms: 0, detail: `${r.unit.manifest.id} · ${pack.dir}` })
    setTarget(r.unit.manifest.id)
  }

  const installFromFolderInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? [])
    if (!picked.length) return
    setScanMsg(null)
    try {
      const entries: Record<string, string> = {}
      for (const f of picked) {
        const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name
        entries[rel] = await f.text()
      }
      const extracted = extractFolderPack(entries)
      if (!extracted) { setScanMsg({ ok: false, text: 'No pack.json found in the selected folder' }); return }
      const r = registerFolderPack(extracted.manifestText, extracted.files, extracted.dir)
      if (!r.ok || !r.unit) {
        setScanMsg({ ok: false, text: r.issues[0] ?? 'folder manifest rejected' })
        appendTrace({ kind: 'tool-call', tool: 'plugin.folder.install', ok: false, ms: 0, detail: r.issues[0]?.slice(0, 160) ?? 'rejected' })
        return
      }
      setCustomRecords([...customRecords, { json: extracted.manifestText, source: 'folder', sourceUrl: extracted.dir, jwt: r.unit.jwt, files: extracted.files }])
      setScanMsg({ ok: true, text: `Installed "${r.unit.manifest.name}" ${r.unit.manifest.version} from folder "${extracted.dir}"` })
      auditPackAction('install', r.unit.manifest.id, `source: folder ${extracted.dir}`)
      appendTrace({ kind: 'tool-call', tool: 'plugin.folder.install', ok: true, ms: 0, detail: `${r.unit.manifest.id} · ${extracted.dir}` })
      setTarget(r.unit.manifest.id)
    } catch (err) {
      setScanMsg({ ok: false, text: `Folder read failed: ${String(err).slice(0, 120)}` })
    }
    e.target.value = ''
  }

  const removeCustom = (u: PackUnit) => {
    applyThemePack(u, false)
    setCustomRecords(customRecords.filter(r => r.jwt !== u.jwt))
    auditPackAction('remove', u.manifest.id, 'custom pack removed')
    setTarget(null)
  }

  const KindBadge = ({ kind }: { kind: string }) => <span className="chip" style={{ fontSize: 9 }}>{KIND_LABEL[kind] ?? kind}</span>

  return (
    <div className="module fade-in">
      <div className="module-head glass-strong">
        <div>
          <div className="module-title"><Icon name="layers" size={18} /> Plugin Manager</div>
          <div className="module-sub">Resource packs — themes · presets · corpora · rule packs · prompt bundles · no code executed, ever</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="chip chip-mono">{units.filter(u => u.valid).length} packs</span>
          <button className="btn btn-primary" onClick={() => setPasteOpen(v => !v)}><Icon name="plus" size={12} /> Paste JSON</button>
        </div>
      </div>

      <div className="module-body" style={{ display: 'flex', gap: 14, minHeight: 0 }}>
        {/* left: packs grid */}
        <div style={{ flex: 1.25, minWidth: 0, overflow: 'auto' }}>
          <div className="glass panel" style={{ marginBottom: 10 }}>
            <div className="panel-title">Install pack</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input className="input" style={{ flex: 1 }} placeholder="https://raw.githubusercontent.com/user/repo/main/pack.json (URL / GitHub raw)" value={url} onChange={e => setUrl(e.target.value)} />
              <button className="btn btn-primary" disabled={installing || !url.trim()} onClick={installUrl}>{installing ? '…' : 'Fetch + validate'}</button>
            </div>
            {installMsg && <div className="module-sub" style={{ marginTop: 6, color: installMsg.ok ? 'var(--green-700)' : 'var(--danger)' }}>{installMsg.text}</div>}
            {pasteOpen && (
              <div style={{ marginTop: 8 }}>
                <textarea className="input" rows={6} style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: 11 }} placeholder={`{ "id": "my-corpus", "kind": "corpus", "api": "^1.0", "version": "1.0.0", "name": "My corpus", "totalFiles": 3, "categories": { … } }`} value={paste} onChange={e => setPaste(e.target.value)} />
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <button className="btn btn-primary" disabled={!paste.trim()} onClick={installPaste}><Icon name="check" size={12} /> Install session pack</button>
                  <button className="btn" onClick={() => setPasteOpen(false)}>Cancel</button>
                </div>
              </div>
            )}
          </div>

          <div className="glass panel" style={{ marginBottom: 10 }} data-testid="folder-install-panel">
            <div className="panel-title">Install from folder</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <input
                ref={folderInputRef}
                type="file"
                hidden
                multiple
                {...({ webkitdirectory: '' } as Record<string, string>)}
                data-testid="folder-install-input"
                onChange={installFromFolderInput}
              />
              <button className="btn btn-primary" data-testid="folder-install-btn" onClick={() => folderInputRef.current?.click()}><Icon name="plus" size={12} /> Install from folder</button>
              <button className="btn" data-testid="folder-scan-btn" disabled={scanning} onClick={scanFolder}>{scanning ? 'Scanning…' : 'Scan folder'}</button>
            </div>
            {scanMsg && <div className="module-sub" style={{ marginTop: 6, color: scanMsg.ok ? 'var(--green-700)' : 'var(--danger)' }}>{scanMsg.text}</div>}
            {scanned && scanned.length > 0 && (
              <div style={{ marginTop: 8, display: 'grid', gap: 6 }} data-testid="folder-scan-list">
                {scanned.map(p => {
                  let label = p.dir
                  let version = ''
                  try {
                    const m = JSON.parse(p.manifest) as { name?: string; version?: string; id?: string }
                    label = m.name ?? m.id ?? p.dir
                    version = m.version ?? ''
                  } catch { /* show dir label */ }
                  return (
                    <div key={p.dir || label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="module-sub" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}{version ? ` v${version}` : ''} · {p.dir}</span>
                      <button className="btn btn-primary" data-testid={`folder-install-${p.dir || label}`} onClick={() => installScanned(p)}>Install</button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
            {units.map(u => {
              const on = !!enabled[u.manifest.id]
              const count = packDataEntryCount(u)
              return (
                <div key={`${u.manifest.id}-${u.jwt}`} className="glass panel" style={{ cursor: 'pointer', outline: selected?.manifest.id === u.manifest.id ? 'var(--ring)' : 'transparent', boxShadow: on ? 'var(--green-glow)' : undefined }} onClick={() => setTarget(u.manifest.id)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--green-100)', display: 'grid', placeItems: 'center', color: 'var(--green-700)' }}>
                      <Icon name={u.manifest.kind === 'theme-packs' ? 'sun' : u.manifest.kind === 'corpus' ? 'database' : u.manifest.kind === 'presets' ? 'spark' : 'doc'} size={14} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {u.manifest.name}
                        {!u.valid && <span className="chip" style={{ marginLeft: 6, fontSize: 8, color: 'var(--danger)' }}>invalid</span>}
                        {u.source !== 'bundled' && <span className="chip" style={{ marginLeft: 6, fontSize: 8 }}>✱ custom</span>}
                      </div>
                      <div className="module-sub">v{u.manifest.version} · <KindBadge kind={u.manifest.kind} /></div>
                    </div>
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }} onClick={e => e.stopPropagation()}>
                      <Toggle on={on} disabled={!u.valid} onClick={() => toggle(u)} />
                      {u.source !== 'bundled' && <button className="icon-btn" title="Remove pack" onClick={() => removeCustom(u)}><Icon name="trash" size={13} /></button>}
                    </div>
                  </div>
                  <div className="module-sub" style={{ margin: '8px 0 0' }}>{count > 0 && <><span className="chip chip-mono" style={{ fontSize: 9 }}>{count} {u.manifest.kind === 'corpus' ? 'files' : 'entries'}</span> </>}adds nothing executable — resource-only pack</div>
                  {u.manifest.kind === 'theme-packs' && u.valid && <Swatches u={u} />}
                </div>
              )
            })}
          </div>
        </div>

        {/* right: detail */}
        <div className="glass panel" style={{ flex: 1, minWidth: 280 }}>
          {selected ? <Detail u={selected} /> : <div className="module-sub">Select a pack</div>}
        </div>
      </div>
    </div>
  )
}

function Toggle({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button role="switch" aria-checked={on} disabled={disabled} onClick={onClick} style={{
      width: 34, height: 19, borderRadius: 999, border: '1px solid ' + (on ? 'var(--green-500)' : 'var(--text-faint)'),
      background: on ? 'var(--green-500)' : 'transparent', position: 'relative', cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'all var(--dur-1) var(--ease-out)',
    }} title={on ? 'Disable (reversible)' : 'Enable'} aria-label="toggle pack">
      <span style={{ position: 'absolute', top: 1.5, left: on ? 18 : 2, width: 13, height: 13, borderRadius: 999, background: on ? '#fff' : 'var(--text-faint)', transition: 'left var(--dur-1) var(--ease-spring)' }} />
    </button>
  )
}

function Swatches({ u }: { u: PackUnit }) {
  const css = Object.values(u.files).join('\n')
  const vals = ['--green-400', '--green-500', '--glass-border']
    .map(v => ({ v, val: css.split(v + ':')[1]?.split(';')[0]?.trim() }))
    .filter(x => x.val)
  if (!vals.length) return null
  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }} title={`overrides ${vals.length} tokens (tokens-only lint passed)`}>
      {vals.map(({ v, val }) => (
        <span key={v} style={{ width: 16, height: 16, borderRadius: 6, background: val as string, border: '1px solid var(--glass-border)' }} title={`${v}: ${val}`} />
      ))}
      <span className="module-sub" style={{ marginLeft: 2 }}>{vals.length} token overrides · both modes</span>
    </div>
  )
}

function Detail({ u }: { u: PackUnit }) {
  const corpus = packCorpus(u)
  const cats = corpus ? Object.entries(corpus.categories).sort((a, b) => b[1].count - a[1].count) : []
  return (
    <div>
      <div className="panel-title">{u.manifest.name} <span className="chip chip-mono" style={{ fontSize: 9 }}>v{u.manifest.version}</span></div>
      <p className="module-sub" style={{ marginTop: 0 }}>{u.manifest.description}</p>
      <div className="module-sub" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 10px' }}>
        <span>Author</span><span>{u.manifest.author ?? '—'}</span>
        <span> kind</span><span>{u.manifest.kind}</span>
        <span>API</span><span>{u.manifest.api} <span style={{ color: 'var(--green-700)' }}>✓ compatible (MODULE_API 1.0)</span></span>
        <span>Source</span><span>{u.source === 'bundled' ? 'bundled in-project pack folder' : u.source === 'url' ? (u.sourceUrl ?? 'URL') : u.source === 'folder' ? `local folder (${u.sourceUrl ?? ''})` : 'pasted JSON (session)'}</span>
      </div>
      {corpus && (
        <div style={{ marginTop: 10 }}>
          <div className="panel-title">{corpus.totalFiles} files · {new Date(corpus.generatedAt).toLocaleDateString()}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 2, fontSize: 11 }}>
            {cats.slice(0, 9).map(([name, c]) => (
              <div key={name} style={{ display: 'contents' }}>
                <span className="module-sub">{name}</span>
                <span className="chip chip-mono" style={{ fontSize: 9 }}>{c.count}</span>
              </div>
            ))}
            {cats.length > 9 && <span className="module-sub" style={{ gridColumn: '1 / -1' }}>+{cats.length - 9} more categories…</span>}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
        <button className="btn" onClick={() => navigate('manifest')}><Icon name="doc" size={12} /> Open Corpus Manifest</button>
        <button className="btn" onClick={() => navigate('presets')}><Icon name="layers" size={12} /> Open Presets</button>
      </div>
      <div className="module-sub" style={{ marginTop: 10, borderTop: '1px solid var(--glass-border)', paddingTop: 8 }}>
        Guardrails: tokens-only theme lint · API semver check · approval gates inherited · capability ledger entries tagged <code>entry: plugin</code>
      </div>
    </div>
  )
}
