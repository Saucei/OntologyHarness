import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MODULES, moduleById } from './modules/registry'
import type { HarnessModule } from './modules/contract'
import CommandPalette, { type PaletteItem } from './components/CommandPalette'
import { ws, estimateSpend, patchMeta } from './store'
import Wizard from './components/Wizard'
import { Icon, type IconName } from './components/Icon'

export type ModuleId = string
const NAV: HarnessModule[] = MODULES

type Theme = 'light' | 'dark' | 'auto'

export default function App() {
  const [module, setModule] = useState<ModuleId>('graph')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('ontology-harness.theme') as Theme) || 'auto')
  const [wizard, setWizard] = useState(() => !localStorage.getItem('ontology-harness.onboarded'))
  const [deskOpen, setDeskOpen] = useState(false)
  const [navCtx, setNavCtx] = useState<{ id: ModuleId; x: number; y: number } | null>(null)

  useEffect(() => {
    const root = document.documentElement
    const apply = (t: Exclude<Theme, 'auto'>) => { root.dataset.theme = t }
    if (theme === 'auto') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      apply(mq.matches ? 'dark' : 'light')
      const h = (e: MediaQueryListEvent) => apply(e.matches ? 'dark' : 'light')
      mq.addEventListener('change', h)
      localStorage.setItem('ontology-harness.theme', 'auto')
      return () => mq.removeEventListener('change', h)
    }
    apply(theme)
    localStorage.setItem('ontology-harness.theme', theme)
  }, [theme])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen(v => !v) }
      else if (e.altKey && /^[1-9]$/.test(e.key)) { e.preventDefault(); const target = NAV[Number(e.key) - 1]; if (target) setModule(target.id) }
    }
    const nav = (e: Event) => { const d = (e as CustomEvent).detail; if (d?.module) setModule(d.module as ModuleId) }
    window.addEventListener('keydown', h)
    window.addEventListener('oh:navigate', nav)
    return () => { window.removeEventListener('keydown', h); window.removeEventListener('oh:navigate', nav) }
  }, [])

  const paletteItems: PaletteItem[] = useMemo(
    () => NAV.map(n => ({ id: n.id, label: n.label, hint: n.hint, icon: n.icon, run: () => setModule(n.id), terms: (n.keywords ?? []).join(' ') })),
    []
  )

  const [navOrderLocal, setNavOrderLocal] = useState<ModuleId[]>(() => {
    const saved = (ws.meta as any)?.navOrder as string[] | undefined
    if (saved?.length) {
      const valid = saved.filter(s => NAV.some(n => n.id === s)) as ModuleId[]
      for (const n of NAV) if (!valid.includes(n.id)) valid.push(n.id)
      return valid
    }
    return NAV.map(n => n.id)
  })
  // Late-hydrate sync (Tauri WS meta resolves asynchronously): accept the saved order exactly
  // once, then mark synced — local edits must never echo back through patchMeta → recompute
  // → setNavOrderLocal, which created a ref-churn flip-flop (reorder commands compounding).
  const [navSynced, setNavSynced] = useState(false)
  const savedNavOrder = (ws.meta as any)?.navOrder as string[] | undefined
  useEffect(() => {
    if (navSynced || !savedNavOrder?.length) return
    setNavSynced(true)
    setNavOrderLocal(prev => {
      const valid = savedNavOrder.filter(s => NAV.some(n => n.id === s)) as ModuleId[]
      for (const n of NAV) if (!valid.includes(n.id)) valid.push(n.id)
      if (valid.length === prev.length && valid.every((v, i) => v === prev[i])) return prev
      return valid
    })
  }, [savedNavOrder, navSynced])
  // Persist the local order to WS meta (dehydrated writes are identity-cheap; content is what matters).
  useEffect(() => { if (navOrderLocal.length) patchMeta({ navOrder: navOrderLocal }) }, [navOrderLocal])

  const openPalette = useCallback(() => setPaletteOpen(true), [])
  const spend = useMemo(() => estimateSpend(ws.traces as any[]), [ws.traces.length])
  const [favIds, setFavIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('ontology-harness.favorites') ?? '["graph","workshop","swarms","jobs"]') } catch { return ['graph', 'workshop', 'swarms', 'jobs'] }
  })
  useEffect(() => { localStorage.setItem('ontology-harness.favorites', JSON.stringify(favIds)) }, [favIds])
  const toggleFav = (id: string) => setFavIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  const orderedNav = useMemo(() => {
    const base = navOrderLocal.map(id => NAV.find(n => n.id === id)!).filter(Boolean)
    const faved = base.filter(n => favIds.includes(n.id))
    const rest = base.filter(n => !favIds.includes(n.id))
    return [...faved.map(n => ({ ...n, section: undefined as string | undefined })), ...rest]
  }, [navOrderLocal, favIds])
  const currentModule = NAV.find(n => n.id === module)

  const moveNav = (target: ModuleId, dir: 1 | -1) => {
    setNavOrderLocal(prev => {
      const i = prev.indexOf(target)
      const j = Math.min(prev.length - 1, Math.max(0, i + dir))
      if (i === j || i === -1) return prev
      const next = [...prev]; const [item] = next.splice(i, 1); next.splice(j, 0, item)
      return next
    })
  }
  const resetNav = () => { setNavOrderLocal(NAV.map(n => n.id)) }

  const finishWizard = () => { localStorage.setItem('ontology-harness.onboarded', '1'); setWizard(false) }
  const runWizard = () => { setWizard(true) }

  return (
    <div className="app-shell">
      <div className="mesh" />
      <aside className="sidebar glass-strong">
        <div className="brand">
          <div className="brand-mark">
            <svg viewBox="0 0 64 64" width="26" height="26"><rect width="64" height="64" rx="14" fill="#16a34a"/><circle cx="20" cy="32" r="7" fill="none" stroke="#fff" strokeWidth="4"/><circle cx="44" cy="16" r="5" fill="#fff"/><circle cx="44" cy="48" r="5" fill="#fff"/><path d="M25 29 L40 18 M25 35 L40 46" stroke="#fff" strokeWidth="4" strokeLinecap="round"/></svg>
          </div>
          <div>
            <div className="brand-name">Ontology Harness</div>
            <div className="brand-sub">Foundry-class workbench</div>
          </div>
        </div>

        <nav className="nav">
          {orderedNav.map((n, i) => (
            <div key={n.id}>
              {n.section && orderedNav[i - 1]?.section !== n.section && <div className="nav-section">{n.section}</div>}
              <button
                className={`nav-item ${module === n.id ? 'active' : ''}`}
                onClick={() => setModule(n.id)}
                onContextMenu={e => { e.preventDefault(); setNavCtx({ id: n.id, x: e.clientX, y: e.clientY }) }}
                title={`${n.hint} · Right-click: move, open, reset`}
              >
                <Icon name={n.icon} size={17} />
                <span>{n.label}</span>
                {favIds.includes(n.id) && <span className="chip fav-chip">★</span>}
                {module === n.id && <i className="nav-pip" />}
              </button>
            </div>
          ))}
        </nav>

        <div className="side-foot">
          <button className="palette-trigger" onClick={openPalette}>
            <Icon name="search" size={14} />
            <span>Search apps & objects…</span>
            <kbd>Ctrl K</kbd>
          </button>
          <button className="palette-trigger" onClick={() => setDeskOpen(v => !v)} title="Keyboard shortcuts">
            <Icon name="doc" size={14} />
            <span>Shortcuts</span>
            <kbd>Alt+1–9</kbd>
          </button>
          <div className="theme-toggle" role="group" aria-label="Theme">
            {([['light', 'sun'], ['dark', 'moon'], ['auto', 'monitor']] as [Theme, IconName][]).map(([t, ic]) => (
              <button key={t} className={`theme-btn ${theme === t ? 'active' : ''}`} onClick={() => setTheme(t)} title={t === 'auto' ? 'Follow system' : `${t} mode`} aria-pressed={theme === t}>
                <Icon name={ic} size={14} />
              </button>
            ))}
          </div>
          <div className="env-row"><span className="dot dot-green" /> PROD · Foundry-class</div>
          <div className="env-row"><span className="dot dot-lime" /> UAT · synced 2h ago</div>
          <div className="env-row" title="Estimated 24h spend across all LLM calls (local estimate)"><span className="dot" style={{ background: '#38bdf8' }} /> ≈ ${spend.cost.toFixed(2)} · {spend.calls} calls · {spend.tokens.toLocaleString()} tok / 24h</div>
        </div>
      </aside>

      <main className="content" key={module}>
        <div className="crumbs glass-faint" aria-label="Breadcrumb">
          <span className="crumb" onClick={() => setModule('graph')} style={{ color: 'var(--text-dim)' }}>Ontology Harness</span>
          <span className="crumb-sep">›</span>
          <strong className="crumb-current">{currentModule?.label}</strong>
          <span className="crumb-hint">{currentModule?.hint}</span>
        </div>
        {currentModule && <currentModule.Component />}
      </main>

      {paletteOpen && <CommandPalette items={paletteItems} onClose={() => setPaletteOpen(false)} />}
      {navCtx && (
        <div className="palette-overlay" style={{ background: 'transparent', backdropFilter: 'none' }} onMouseDown={() => setNavCtx(null)} onContextMenu={e => { e.preventDefault(); setNavCtx(null) }}>
          <div className="glass-strong fade-in" role="menu" aria-label={`Options for ${navCtx.id}`} style={{ position: 'fixed', left: Math.min(navCtx.x, window.innerWidth - 250), top: Math.min(navCtx.y, window.innerHeight - 260), minWidth: 220, padding: 6, borderRadius: 'var(--r-sm)', zIndex: 60 }} onMouseDown={e => e.stopPropagation()}>
            <div className="chip-mono" style={{ padding: '4px 8px', fontSize: 9, color: 'var(--text-dim)' }}>{NAV.find(n => n.id === navCtx.id)?.label}</div>
            <button className="nav-item" role="menuitem" onClick={() => { setModule(navCtx.id); setNavCtx(null) }}><Icon name="arrow" size={13} /> Open</button>
            <button className="nav-item" role="menuitem" onClick={() => { toggleFav(navCtx.id); setNavCtx(null) }}><Icon name="check" size={13} /> {favIds.includes(navCtx.id) ? 'Un-pin favorite' : 'Pin to favorites (survives reorder)'}</button>
            <button className="nav-item" role="menuitem" onClick={() => { moveNav(navCtx.id, -1); setNavCtx(null) }}><Icon name="arrow" size={13} /> Move up</button>
            <button className="nav-item" role="menuitem" onClick={() => { moveNav(navCtx.id, 1); setNavCtx(null) }}><Icon name="arrow" size={13} /> Move down</button>
            <div style={{ borderTop: '1px solid rgba(34,197,94,.25)', marginTop: 4, paddingTop: 4 }}>
              <button className="nav-item" role="menuitem" onClick={() => { resetNav(); setNavCtx(null) }}><Icon name="refresh" size={13} /> Reset order</button>
            </div>
          </div>
        </div>
      )}
      {deskOpen && <ShortcutDesk onClose={() => setDeskOpen(false)} onWizard={runWizard} />}
      {wizard && <Wizard onDone={finishWizard} onGo={m => { finishWizard(); setModule(m as any) }} />}
    </div>
  )
}

function ShortcutDesk({ onClose, onWizard }: { onClose: () => void; onWizard: () => void }) {
  const rows: [string, string][] = [
    ['Ctrl / Cmd + K', 'Command palette'],
    ['Alt + 1…9', 'Jump to module'],
    ['Esc', 'Close dialog / palette'],
    ['Enter / Space', 'Activate focused control'],
    ['← / →', 'Kanban: move job back/forward'],
    ['Shift + ? (soon)', 'This cheat sheet'],
  ]
  return (
    <div className="palette-overlay" onMouseDown={onClose}>
      <div className="glass-strong fade-in" style={{ width: 420, padding: 16, borderRadius: 'var(--r-md)' }} onMouseDown={e => e.stopPropagation()} role="dialog" aria-label="Keyboard shortcuts">
        <div className="module-title" style={{ fontSize: 14, justifyContent: 'space-between' }}>
          <span>Keyboard shortcuts</span>
          <button className="btn btn-ghost" onClick={onClose} aria-label="Close"><Icon name="x" size={14} /></button>
        </div>
        {rows.map(([k, d], i) => (
          <div key={i} className="legend-row" style={{ justifyContent: 'space-between', padding: '4px 2px' }}><kbd>{k}</kbd><span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{d}</span></div>
        ))}
        <div style={{ borderTop: '1px solid rgba(34,197,94,.25)', marginTop: 8, paddingTop: 8 }}>
          <div className="module-sub">Accessibility — axe: 0 critical/serious across local modules · dark mode is a designed mate (deep green-charcoal) · reduced motion/transparency via OS settings.</div>
          <button className="btn" style={{ marginTop: 8 }} onClick={() => { onClose(); onWizard() }}>Re-run first-run wizard</button>
        </div>
      </div>
    </div>
  )
}
