import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import { mergeCorpus, packEntries, enabledPackUnits } from '../packs/consume'

type Manifest = {
  generatedAt: string
  source: string
  totalFiles: number
  categories: Record<string, { count: number; files: string[] }>
  version?: number
  entries?: ManifestEntry[]
}

export type ManifestEntry = {
  file: string
  category: string
  note: string
  bytes: number
  vision?: { app: string; features: string[]; uiElements: string[]; textSnippet: string; confidence: number } | null
  review?: boolean
}

const CATEGORY_META: Record<string, { label: string; desc: string }> = {
  'architecture-lineage': { label: 'Architecture & Lineage', desc: 'Pipeline overviews, branch promotion graphs, Vertex lineage exports' },
  'ontology-layer': { label: 'Ontology Layer', desc: 'Ontology Manager, Object Explorer, value types, Automate' },
  'data-integration': { label: 'Data Integration', desc: 'Code Repositories, Pipeline Builder nodes, dataset sync' },
  'application-building': { label: 'Application Building', desc: 'Workshop modules, widgets, section layout, object-set binding' },
  'aip-logic': { label: 'AIP & LLM Logic', desc: 'Logic functions, preview runs, semantic search, debuggers' },
  'learning-docs': { label: 'Learning & Docs', desc: 'Instructor-led course captures and green-box step annotations' },
}

export default function ManifestView() {
  const [manifest, setManifest] = useState<Manifest | null>(null)
  const [error, setError] = useState<string | null>(null)

  // T-36 plugin consumption: enabled corpus packs merge into this manifest.
  // Module remounts fresh on nav (same pattern as PluginManager's init-from-meta).
  const packUnits = useMemo(() => enabledPackUnits(), [])
  const merged = useMemo(() => mergeCorpus(manifest, packUnits), [manifest, packUnits])

  useEffect(() => {
    fetch('/manifest.json').then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json()
    }).then(setManifest).catch(e => setError(String(e)))
  }, [])

  const max = manifest ? Math.max(1, ...Object.values(merged.categories).map(c => c.count)) : 1
  const [query, setQuery] = useState('')
  const [openFile, setOpenFile] = useState<string | null>(null)

  const allEntries = useMemo<ManifestEntry[]>(() => {
    if (!manifest) return []
    const base = manifest.entries ?? Object.entries(manifest.categories).flatMap(([cat, c]) => c.files.map(f => ({ file: f, category: cat, note: '', bytes: 0, vision: null })))
    const baseFiles = new Set(base.map(e => e.file))
    const fromPacks = packEntries(merged)
      .filter(e => !baseFiles.has(e.file))
      .map(e => ({ ...e, bytes: 0, vision: null }))
    return [...base, ...fromPacks]
  }, [manifest, merged])

  const matchedEntries = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return []
    return allEntries.filter(e => (e.file + ' ' + e.category + ' ' + (e.vision?.app ?? '') + ' ' + (e.vision?.features ?? []).join(' ') + ' ' + (e.vision?.textSnippet ?? '') + ' ' + e.note).toLowerCase().includes(q)).slice(0, 40)
  }, [allEntries, query])

  return (
    <div className="module fade-in">
      <div className="module-head glass-strong">
        <div>
          <div className="module-title"><Icon name="doc" size={18} /> Corpus Manifest</div>
          <div className="module-sub">Phase 1+2 output — every reference image parsed & categorized by <code>scripts/parse-manifest.mjs</code></div>
        </div>
        {manifest && merged.packNames.length > 0 && (
          <span className="chip" style={{ marginLeft: 'auto', color: 'var(--green-700)', borderColor: 'var(--green-500)' }} title={`Enabled corpus packs: ${merged.packNames.join(', ')}`}>
            packs on: {merged.packNames.join(', ')}
          </span>
        )}
        {manifest && <span className="chip chip-mono" style={{ marginLeft: merged.packNames.length ? 0 : 'auto' }}>{merged.totalFiles} files · {new Date(manifest.generatedAt).toLocaleDateString()}</span>}
      </div>

      <div className="module-body">
        <div className="glass panel" style={{ flex: 1, overflow: 'auto' }}>
          {error && <div className="module-sub">Could not load manifest.json — {error}. Run <code>npm run manifest</code>.</div>}
          <div className="module-sub" style={{ marginBottom: 8 }}>Phase 1+2 output (v{manifest?.version ?? 1}) — <code>scripts/parse-manifest.mjs</code> heuristics · <code>parse-manifest-v2.mjs --vision</code> adds vision tags · <code>VISION_BASE</code>/<code>VISION_MODEL</code> pick the endpoint.</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input className="input" placeholder="Full-text search: vision app · features · OCR snippet · filename…" value={query} onChange={e => setQuery(e.target.value)} />
            {query && <span className="chip chip-mono">{matchedEntries.length} hit(s)</span>}
          </div>

          {query && (
            <div className="manifest-grid" style={{ marginBottom: 10, maxHeight: 380 }}>
              {matchedEntries.map(e => (
                <button key={e.file} className="glass-faint manifest-card" style={{ padding: 10, textAlign: 'left', width: '100%', cursor: 'pointer' }} onClick={() => setOpenFile(e.file)} title={e.file}>
                  <h4 style={{ fontSize: 9.5, wordBreak: 'break-all' }}>{e.file}</h4>
                  {e.vision ? (
                    <>
                      <div className="chip" style={{ marginBottom: 3 }}>{e.vision.app}</div>
                      <div className="module-sub" style={{ fontSize: 8.5 }}>{e.vision.features?.join(' · ')}</div>
                      {e.vision.textSnippet && <div style={{ fontSize: 8.5, color: 'var(--text-dim)', marginTop: 3 }}>“{e.vision.textSnippet}”</div>}
                    </>
                  ) : (
                    <div className="module-sub" style={{ fontSize: 8.5 }}>{e.category} · heuristic</div>
                  )}
                </button>
              ))}
            </div>
          )}

          <div className="manifest-grid">
            {manifest && Object.entries(merged.categories).sort((a, b) => b[1].count - a[1].count).map(([key, cat]) => (
              <div key={key} className="glass-faint manifest-card" style={{ padding: 12 }}>
                <h4>{CATEGORY_META[key]?.label ?? key} <span className="chip chip-mono">{cat.count}</span></h4>
                <div className="module-sub" style={{ marginBottom: 6 }}>{CATEGORY_META[key]?.desc}</div>
                <div className="bar" style={{ width: `${(cat.count / max) * 100}%` }} />
                <ul>{cat.files.slice(0, 40).map(f => <li key={f}><button className="btn btn-ghost" style={{ padding: '1px 4px', fontSize: 9.5, fontFamily: 'var(--font-mono)', textAlign: 'left' }} onClick={() => setOpenFile(f)}>{f}</button>{merged.fileSource[f] && <span className="chip" style={{ fontSize: 8, marginLeft: 4 }} title={`from enabled pack: ${merged.fileSource[f]}`}>pack</span>}</li>)}</ul>
                {cat.files.length > 40 && <div className="module-sub" style={{ marginTop: 4 }}>+{cat.files.length - 40} more</div>}
              </div>
            ))}
          </div>
          {manifest && <div className="module-sub" style={{ marginTop: 10 }}>Source: <code>{manifest.source}</code></div>}
        </div>
      </div>

      {/* Lightbox for any corpus image */}
      {openFile && (
        <div className="palette-overlay" onMouseDown={() => setOpenFile(null)}>
          <div className="glass-strong fade-in" style={{ width: 780, maxWidth: '94vw', maxHeight: '85vh', overflow: 'auto', padding: 16, borderRadius: 'var(--r-md)' }} onMouseDown={e => e.stopPropagation()}>
            <div className="module-title" style={{ fontSize: 12.5, justifyContent: 'space-between', wordBreak: 'break-all' }}>
              <span>{openFile}</span>
              <button className="btn btn-ghost" onClick={() => setOpenFile(null)}><Icon name="x" size={14} /></button>
            </div>
            {(() => {
              const e = allEntries.find(x => x.file === openFile)
              return (
                <>
                  {e?.vision ? (
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div className="chip" style={{ alignSelf: 'flex-start' }}>{e.vision.app} · conf {e.vision.confidence}</div>
                      {e.vision.features?.length > 0 && <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{e.vision.features.map(f => <span key={f} className="chip chip-mono" style={{ fontSize: 9 }}>{f}</span>)}</div>}
                      {e.vision.textSnippet && <div className="glass-faint" style={{ padding: 8, fontSize: 10.5 }}>“{e.vision.textSnippet}”</div>}
                    </div>
                  ) : <div className="module-sub" style={{ marginTop: 8 }}>Heuristic tagging only — run <code>node scripts/parse-manifest-v2.mjs --vision</code> with a vision endpoint for semantic tags + OCR.</div>}
                  {e?.review && <div className="chip" style={{ marginTop: 6, background: 'rgba(245,158,11,.18)', borderColor: 'rgba(245,158,11,.45)', color: '#92400e' }}>⚠ flagged for review (low confidence)</div>}
                  {e?.note && <div className="module-sub" style={{ marginTop: 6 }}>{e.note}</div>}
                  <div className="module-sub" style={{ marginTop: 10 }}>Category: <code>{e?.category ?? '—'}</code> · {((e?.bytes ?? 0) / 1024).toFixed(0)} KB</div>
                </>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
