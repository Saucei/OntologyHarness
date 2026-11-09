import { useEffect, useMemo, useState } from 'react'
import { Icon, type IconName } from '../components/Icon'
import { validateWorkshop } from '../workshop/validate'
import { ws, patchMeta } from '../store'

type Widget = { id: number; kind: string; label: string; binding: string; icon: IconName; columns?: { property: string; type: string }[]; filteringEnabled?: boolean; rowHeight?: 'auto' | 'absolute' | 'flex'; px?: number; colWidth?: number }
type Section = { id: number; name: string; widgets: Widget[]; splitting?: 'columns' | 'rows' | 'tabs' | 'flow' | 'toolbar' | 'loop' | null; headerStyle?: 'Subheader' | 'Header'; headerHidden?: boolean; titleVariable?: string; collapsed?: boolean; bgColor?: string }

const BG_SWATCHES = [
  { id: 'default', label: 'Default', light: '#faf7ef', dark: '#1b2320' },
  { id: 'mint', label: 'Mint', light: '#e8f5e9', dark: '#1f2b23' },
  { id: 'amber', label: 'Amber', light: '#fff3e0', dark: '#2b2418' },
  { id: 'indigo', label: 'Indigo', light: '#eef2ff', dark: '#1d2233' },
] as const

const WIDGET_PALETTE: { kind: string; label: string; icon: IconName }[] = [
  { kind: 'object-table', label: 'Object Table', icon: 'table' },
  { kind: 'filter', label: 'Filter', icon: 'filter' },
  { kind: 'property-list', label: 'Property List', icon: 'list' },
  { kind: 'button-group', label: 'Button Group', icon: 'button' },
  { kind: 'bar-chart', label: 'Bar Chart', icon: 'chart' },
  { kind: 'pie-chart', label: 'Pie Chart', icon: 'chart' },
]

const SECTION_LAYOUTS = [
  { id: 'columns', label: 'Columns', icon: 'kanban' as IconName },
  { id: 'rows', label: 'Rows', icon: 'list' as IconName },
  { id: 'tabs', label: 'Tabs', icon: 'layers' as IconName },
  { id: 'flow', label: 'Flow', icon: 'arrow' as IconName },
  { id: 'toolbar', label: 'Toolbar', icon: 'button' as IconName },
  { id: 'loop', label: 'Loop', icon: 'refresh' as IconName },
] as const

const INITIAL_SECTIONS: Section[] = [
  { id: 1, name: 'Header · Order Overview', widgets: [
    { id: 11, kind: 'button-group', label: 'Order overview actions', binding: 'Button group 1 · Auto (max) height', icon: 'button' },
  ]},
  { id: 2, name: 'Filters', widgets: [
    { id: 21, kind: 'filter', label: 'Filter · [yourUsername] Order', binding: 'Input: Object Set · multi-select', icon: 'filter' },
  ]},
  { id: 3, name: 'Main panel', widgets: [
    { id: 31, kind: 'object-table', label: 'Object Table 1', binding: 'Active object set · renamed: Orders', icon: 'table' },
    { id: 32, kind: 'property-list', label: 'Property List 2', binding: 'Input: Object table 1 Active object', icon: 'list' },
    { id: 33, kind: 'bar-chart', label: 'Demand by SKU', binding: 'Group by Style · Sum(abv)', icon: 'chart' },
  ]},
]

const MODULE_NAME = 'Order Overview'
const publishedOf = (): any[] => (ws.meta?.workshop?.published as any[]) ?? []
const SEED_ROWS = [
  { id: 'O-1042', customer: 'Hops Republic', status: 'Open', total: '44.0 bbl' },
  { id: 'O-1041', customer: 'Dockside Brew Co', status: 'In production', total: '38.5 bbl' },
  { id: 'O-1038', customer: 'Cedar & Rye', status: 'Shipped', total: '52.0 bbl' },
  { id: 'O-1033', customer: 'Meridian Cellars', status: 'Open', total: '29.5 bbl' },
]

export default function WorkshopCanvas() {
  const saved = (ws.meta?.workshop as any)?.sections as Section[] | undefined
  const [sections, setSections] = useState<Section[]>(() => saved ?? INITIAL_SECTIONS)
  const [selected, setSelected] = useState<{ s: number; w: number } | null>({ s: 3, w: 31 })
  const [errors, setErrors] = useState<string[] | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [publishedVersion, setPublishedVersion] = useState<number>(() => Math.max(0, ...publishedOf().map((s: any) => s.v ?? 0)))

  // Autosave module config to the workspace (survives restart via SQLite/localStorage).
  useEffect(() => {
    patchMeta({ workshop: { ...(ws.meta?.workshop ?? {}), name: MODULE_NAME, sections } })
  }, [sections])

  const widgets = useMemo(() => sections.flatMap(s => s.widgets), [sections])
  const validation = useMemo(() => validateWorkshop(sections, MODULE_NAME), [sections])
  const published = publishedOf()

  const addWidget = (kind: string, label: string, icon: IconName) =>
    setSections(prev => prev.map((s, i) => i === prev.length - 1 ? { ...s, widgets: [...s.widgets, { id: Date.now(), kind, label, binding: kind === 'object-table' ? 'Active object set · renamed: Orders' : 'unbound · set Input Object Set', icon }] } : s))
  const addSection = () => setSections(prev => [...prev, { id: Date.now(), name: `Section ${prev.length + 1}`, widgets: [], splitting: null }])
  const splitSection = (id: number, dir: 'columns' | 'rows') =>
    setSections(prev => prev.map(s => s.id === id ? { ...s, splitting: dir } : s))
  const setSectionLayout = (id: number, layout: Section['splitting']) =>
    setSections(prev => prev.map(s => s.id === id ? { ...s, splitting: layout } : s))
  const setHeaderStyle = (id: number, style: Section['headerStyle']) =>
    setSections(prev => prev.map(s => s.id === id ? { ...s, headerStyle: style } : s))
  const setHeaderHidden = (id: number, hidden: boolean) =>
    setSections(prev => prev.map(s => s.id === id ? { ...s, headerHidden: hidden } : s))
  const setTitleVariable = (id: number, titleVariable: string) =>
    setSections(prev => prev.map(s => s.id === id ? { ...s, titleVariable } : s))
  const setCollapsed = (id: number, collapsed: boolean) =>
    setSections(prev => prev.map(s => s.id === id ? { ...s, collapsed } : s))
  const setBgColor = (id: number, bgId: string) =>
    setSections(prev => prev.map(s => s.id === id ? { ...s, bgColor: bgId === 'default' ? undefined : bgId } : s))
  const removeWidget = (sid: number, wid: number) =>
    setSections(prev => prev.map(s => s.id === sid ? { ...s, widgets: s.widgets.filter(w => w.id !== wid) } : s))
  const updateBinding = (wid: number, binding: string) =>
    setSections(prev => prev.map(s => ({ ...s, widgets: s.widgets.map(w => w.id === wid ? { ...w, binding } : w) })))
  const addColumn = (wid: number, property: string, type: string) =>
    setSections(prev => prev.map(s => ({ ...s, widgets: s.widgets.map(w => w.id === wid ? { ...w, columns: [...(w.columns ?? []), { property, type }] } : w) })))
  const removeAllColumns = (wid: number) =>
    setSections(prev => prev.map(s => ({ ...s, widgets: s.widgets.map(w => w.id === wid ? { ...w, columns: [] } : w) })))
  const moveColumn = (wid: number, index: number, dir: 1 | -1) =>
    setSections(prev => prev.map(s => ({
      ...s,
      widgets: s.widgets.map(w => {
        if (w.id !== wid || !w.columns) return w
        const cols = [...w.columns]
        const j = Math.min(cols.length - 1, Math.max(0, index + dir))
        if (j === index) return w
        const [item] = cols.splice(index, 1)
        cols.splice(j, 0, item)
        return { ...w, columns: cols }
      }),
    })))
  const setFiltering = (wid: number, on: boolean) =>
    setSections(prev => prev.map(s => ({ ...s, widgets: s.widgets.map(w => w.id === wid ? { ...w, filteringEnabled: on } : w) })))
  const setRowHeight = (wid: number, rh: 'auto' | 'absolute' | 'flex') =>
    setSections(prev => prev.map(s => ({ ...s, widgets: s.widgets.map(w => w.id === wid ? { ...w, rowHeight: rh } : w) })))
  const setPx = (wid: number, px: number) =>
    setSections(prev => prev.map(s => ({ ...s, widgets: s.widgets.map(w => w.id === wid ? { ...w, px } : w) })))
  const setColWidth = (wid: number, colWidth: number) =>
    setSections(prev => prev.map(s => ({ ...s, widgets: s.widgets.map(w => w.id === wid ? { ...w, colWidth } : w) })))

  const selectedWidget = sections.flatMap(s => s.widgets.map(w => ({ s, w }))).find(x => x.w.id === selected?.w)

  const publish = () => {
    const v = validateWorkshop(sections, MODULE_NAME)
    if (!v.ok) { setErrors(v.issues); setNotice(null); return }
    setErrors(null)
    const nextV = Math.max(0, ...publishedOf().map((s: any) => s.v ?? 0)) + 1
    const snapshot = { v: nextV, name: MODULE_NAME, publishedAt: new Date().toISOString(), sections, widgetCount: widgets.length }
    patchMeta({ workshop: { ...(ws.meta?.workshop ?? {}), published: [...publishedOf(), snapshot] } })
    setPublishedVersion(nextV)
    setNotice(`Published ${MODULE_NAME} v${nextV} · ${widgets.length} widget(s)`)
    setShowPreview(true)
  }
  const rollback = (snap: any) => {
    const nextV = Math.max(0, ...publishedOf().map((s: any) => s.v ?? 0)) + 1
    patchMeta({ workshop: { ...(ws.meta?.workshop ?? {}), published: [...publishedOf(), { ...snap, v: nextV, name: MODULE_NAME, publishedAt: new Date().toISOString(), note: `rollback of v${snap.v}` }] } })
    setSections(snap.sections)
    setPublishedVersion(nextV)
    setShowHistory(false)
    setNotice(`Rolled back to v${snap.v} as v${nextV}`)
  }

  const previewRows: any[] = useMemo(() => (ws.datasets[0]?.rows?.slice(0, 8) ?? SEED_ROWS), [])

  return (
    <div className="module fade-in">
      <div className="module-head glass-strong">
        <div>
          <div className="module-title"><Icon name="workshop" size={18} /> Workshop Canvas · {MODULE_NAME}</div>
          <div className="module-sub">Module editor — widgets bind to object sets · config autosaves to workspace</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {publishedVersion > 0 && <span className="chip chip-mono">v{publishedVersion} live</span>}
          {notice && <span className="chip"><Icon name="check" size={11} /> {notice}</span>}
          <button className="btn" onClick={() => setShowHistory(true)}><Icon name="doc" size={13} /> History <span className="chip chip-mono" style={{ fontSize: 9 }}>{published.length}</span></button>
          <button className="btn" onClick={addSection}><Icon name="plus" size={13} /> Add section</button>
          <button className="btn" onClick={() => setShowPreview(true)}><Icon name="arrow" size={13} /> Preview</button>
          <button className="btn btn-primary" onClick={publish}><Icon name="check" size={13} /> Publish module</button>
        </div>
      </div>

      {/* Publish blockers */}
      {errors && (
        <div className="glass-strong fade-in" style={{ padding: '10px 14px', borderRadius: 'var(--r-sm)', borderColor: 'rgba(220,38,38,.5)' }}>
          <div className="panel-title" style={{ color: '#b91c1c' }}><Icon name="x" size={13} /> Publish blocked — fix {errors.length} issue(s)<button className="btn btn-ghost" style={{ padding: '2px 6px', marginLeft: 8 }} onClick={() => setErrors(null)}><Icon name="x" size={12} /></button></div>
          {errors.map((e, i) => <div key={i} className="module-sub" style={{ color: '#b91c1c' }}>· {e}</div>)}
        </div>
      )}

      <div className="module-body">
        {/* Palette */}
        <div className="ws-palette">
          <div className="glass panel" style={{ height: '100%' }}>
            <div className="panel-title">Layout tree</div>
            <div role="tree" aria-label="Layout tree" tabIndex={0} style={{ outline: 'none' }}>
              <div role="treeitem" aria-expanded style={{ padding: '3px 2px', fontSize: 11.5, fontWeight: 700, color: 'var(--green-800)' }}>
                <Icon name="doc" size={12} /> {MODULE_NAME}
              </div>
              {sections.map(section => (
                <div key={section.id} role="treeitem"
                  aria-expanded={!section.collapsed}
                  aria-selected={selected?.s === section.id && (selected?.w ?? 0) < 0}
                  tabIndex={-1}
                  onClick={() => setSelected({ s: section.id, w: -1 })}
                  onKeyDown={e => {
                    if ((e.key === 'ArrowRight' || e.key === 'Enter') && section.widgets.length > 0) { const w0 = section.widgets[0]; setSelected({ s: section.id, w: w0.id }) }
                    if (e.key === 'ArrowLeft') setSelected({ s: section.id, w: -1 })
                  }}
                  style={{ padding: '2px 2px 2px 12px', fontSize: 11, cursor: 'pointer', borderRadius: 6,
                    background: selected?.s === section.id ? 'rgba(34,139,34,.09)' : 'transparent' }}>
                  <Icon name="kanban" size={11} /> {section.name}{section.collapsed ? ' ·' : ''}
                  <span className="chip chip-mono" style={{ fontSize: 8, marginLeft: 4 }}>{section.widgets.length}</span>
                </div>
              ))}
              {sections.flatMap(section => section.collapsed ? [] : section.widgets.map(w => (
                <div key={w.id} role="treeitem" aria-selected={selected?.w === w.id} tabIndex={-1}
                  onClick={() => setSelected({ s: section.id, w: w.id })}
                  onKeyDown={e => { if (e.key === 'ArrowLeft') setSelected({ s: section.id, w: -1 }) }}
                  style={{ padding: '2px 2px 2px 26px', fontSize: 10.5, cursor: 'pointer', borderRadius: 6, color: w.kind === 'object-table' ? 'var(--green-800)' : 'var(--text-dim)',
                    background: selected?.w === w.id ? 'rgba(34,139,34,.14)' : 'transparent', fontWeight: selected?.w === w.id ? 700 : 400 }}>
                  <Icon name={w.icon} size={10} /> {w.label}
                </div>
              )))}
            </div>
            <div className="panel-title" style={{ borderTop: '1px solid var(--stroke)', marginTop: 10, paddingTop: 8 }}>Widgets · Add</div>
            {WIDGET_PALETTE.map(w => (
              <button key={w.kind} className="ws-widget" style={{ width: '100%', cursor: 'pointer', textAlign: 'left' }} onClick={() => addWidget(w.kind, w.label, w.icon)}>
                <Icon name={w.icon} size={14} /> {w.label} <small>add →</small>
              </button>
            ))}
            <div className="panel-title" style={{ marginTop: 12 }}>Object set</div>
            <div className="chip" style={{ width: '100%', justifyContent: 'center' }}>[yourUsername] Order · multi-select</div>
            <div className="panel-title" style={{ marginTop: 12 }}>Validation</div>
            <div className="module-sub" style={{ color: validation.ok ? 'var(--green-700)' : '#b91c1c' }}>
              {validation.ok ? `✓ ready to publish · ${validation.boundCount}/${validation.widgetCount} bound` : `✗ ${validation.issues.length} blocker(s) — see Publish`}
            </div>
          </div>
        </div>

        {/* Canvas */}
        <div className="ws-canvas glass">
          {sections.map(section => (
            <div key={section.id} className={section.bgColor && section.bgColor !== 'default' ? `ws-section ws-bg-${section.bgColor}` : 'ws-section'} data-section={section.id}>
              <div className="ws-section-h" style={{ marginBottom: section.headerHidden ? 2 : undefined }}>
                <button className="icon-btn" title={section.collapsed ? 'Expand section' : 'Collapse section'} onClick={() => setCollapsed(section.id, !section.collapsed)} aria-label={section.collapsed ? 'Expand section' : 'Collapse section'} aria-expanded={!section.collapsed} style={{ padding: '1px 4px' }}>
                  <Icon name={section.collapsed ? 'arrow' : 'list'} size={12} style={section.collapsed ? { transform: 'rotate(-45deg)' } : undefined} />
                </button>
                <span style={{ visibility: section.headerHidden ? 'hidden' : 'visible' }}>{section.name}{section.splitting ? ` · ${section.splitting}` : ''}</span>
                <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>{section.widgets.length} widget(s)</span>
                  <span style={{ display: 'flex', gap: 3 }} role="group" aria-label="Section background">
                    {BG_SWATCHES.map(sw => (
                      <button key={sw.id} className="icon-btn" title={sw.label} aria-label={`Background ${sw.label}`} aria-pressed={(section.bgColor ?? 'default') === sw.id}
                        onClick={() => setBgColor(section.id, sw.id)}
                        style={{ width: 12, height: 12, padding: 0, borderRadius: '50%', border: (section.bgColor ?? 'default') === sw.id ? '2px solid var(--green-700)' : '1px solid var(--stroke)', background: sw.light, minWidth: 12 }} />
                    ))}
                  </span>
                  <button className="icon-btn" title={`Section: ${section.headerStyle ?? 'Subheader'}`} onClick={() => setHeaderStyle(section.id, section.headerStyle === 'Header' ? 'Subheader' : 'Header')} aria-label="Toggle header style"><Icon name="list" size={13} /></button>
                  <button className="icon-btn" title={section.headerHidden ? 'Show section header' : 'Hide section header'} onClick={() => setHeaderHidden(section.id, !section.headerHidden)} aria-label="Toggle section header"><Icon name={section.headerHidden ? 'doc' : 'x'} size={13} /></button>
                  <button className="icon-btn" title="Split vertical" onClick={() => setSectionLayout(section.id, section.splitting === 'columns' ? null : 'columns')} aria-label="Split vertical"><Icon name="layers" size={13} /></button>
                  <button className="icon-btn" title="Split horizontal" onClick={() => setSectionLayout(section.id, section.splitting === 'rows' ? null : 'rows')} aria-label="Split horizontal"><Icon name="list" size={13} /></button>
                  {section.splitting && <button className="icon-btn" title="Remove split" onClick={() => setSectionLayout(section.id, null)} aria-label="Remove split"><Icon name="x" size={12} /></button>}
                </span>
              </div>
              {!section.collapsed && (
                <>
              {section.splitting && (
                <div style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>
                  Split {section.splitting === 'columns' ? 'left / right' : 'top / bottom'} · add widgets to either pane
                </div>
              )}
              {section.widgets.length === 0 && (
                <div className="dashed-empty" style={{ padding: '14px 12px', textAlign: 'center', color: 'var(--text-dim)', marginBottom: 8, borderRadius: 10 }}>
                  <div style={{ fontWeight: 700, color: 'var(--green-800)', marginBottom: 4 }}>+ Add widget</div>
                  <button className="btn" style={{ margin: '0 auto' }} onClick={() => setSelected({ s: section.id, w: -1 })}><Icon name="layers" size={13} /> Set layout</button>
                </div>
              )}
              <div className={section.splitting === 'columns' ? 'ws-split-2col' : section.splitting === 'rows' ? 'ws-split-2row' : undefined}>
                {section.widgets.map(w => (
                  <div key={w.id} className="ws-widget" role="button" tabIndex={0}
                  onClick={() => setSelected({ s: section.id, w: w.id })}
                  style={selected?.w === w.id ? { borderColor: 'var(--green-600)', boxShadow: 'var(--green-glow)' } : {}}>
                  <Icon name={w.icon} size={14} /> {w.label} <small>{w.binding}</small>
                  {w.kind === 'object-table' && (
                    <span className="chip" style={{ fontSize: 8, padding: '0 6px', marginLeft: 6 }}>{w.columns?.length ?? 0} cols{w.filteringEnabled ? ' · filter' : ''}</span>
                  )}
                  <button className="btn btn-ghost" style={{ padding: '2px 6px' }} onClick={e => { e.stopPropagation(); removeWidget(section.id, w.id) }} aria-label="Remove widget"><Icon name="x" size={12} /></button>
                </div>
              ))}
              </div>
              </>
              )}
              {section.collapsed && section.widgets.length > 0 && (
                <div style={{ fontSize: 9.5, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', padding: '2px 0 4px' }}>
                  {section.widgets.length} widget(s) hidden — expand to edit
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Config */}
        <div className="ws-config glass panel">
          <div className="panel-title">Widget setup</div>
          {selected?.w === -1 ? (
            <>
              <div className="module-sub" style={{ marginBottom: 8 }}>Empty section — choose a layout primitive:</div>
              <div className="label">Section title (use variable)</div>
              <input className="input" placeholder="[yourUsername] Orders" onChange={e => {
                const sec = sections.find(s => s.id === selected?.s); if (sec) setTitleVariable(sec.id, e.target.value)
              }} spellCheck={false} />
              <div className="label">Layout</div>
              {SECTION_LAYOUTS.map(l => (
                <button key={l.id} className="ws-widget" style={{ width: '100%', textAlign: 'left' }} onClick={() => { const { s } = selected; setSectionLayout(s, l.id as any); }}>
                  <Icon name={l.icon} size={14} /> {l.label} <small>{l.id}</small>
                </button>
              ))}
            </>
          ) : selectedWidget ? (
            <>
              <div className="label">Widget</div>
              <div style={{ fontWeight: 700 }}>{selectedWidget.w.label}</div>
              <div className="label">Input object set / binding</div>
              <input className="input" value={selectedWidget.w.binding} onChange={e => updateBinding(selectedWidget.w.id, e.target.value)} spellCheck={false} />
              <div className="label">Display</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                {['Auto (max)', 'Absolute', 'Flex'].map(d => {
                  const key = d === 'Auto (max)' ? 'auto' : d === 'Absolute' ? 'absolute' : 'flex'
                  const active = selectedWidget.w.rowHeight === key || (!selectedWidget.w.rowHeight && key === 'auto')
                  return <button key={d} className={`btn ${active ? 'btn-primary' : ''}`} style={{ fontSize: 10, padding: '6px 4px' }} onClick={() => setRowHeight(selectedWidget.w.id, key as 'auto' | 'absolute' | 'flex')}>{d}</button>
                })}
              </div>
              {(selectedWidget.w.rowHeight === 'absolute' || (!selectedWidget.w.rowHeight && false)) && (
                <div className="label">Height (px)
                  <input type="number" className="input" style={{ width: '100%', marginTop: 4 }} value={selectedWidget.w.px ?? 600} min={120} max={2000} onChange={e => setPx(selectedWidget.w.id, Number(e.target.value) || 600)} />
                </div>
              )}
              {(selectedWidget.w.rowHeight === 'flex' || (!selectedWidget.w.rowHeight && false)) && (
                <div className="label">Column width flex
                  <input type="range" min={1} max={4} step={1} value={selectedWidget.w.colWidth ?? 1} onChange={e => setColWidth(selectedWidget.w.id, Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--green-600)', marginTop: 4 }} />
                  <div className="module-sub">flex: {selectedWidget.w.colWidth ?? 1}</div>
                </div>
              )}
              {selectedWidget.w.kind === 'filter' && (
                <>
                  <div className="panel-title" style={{ marginTop: 10 }}>Filter behaviour</div>
                  <div className="label">Input object set</div>
                  <input className="input" value={selectedWidget.w.binding} onChange={e => updateBinding(selectedWidget.w.id, e.target.value)} spellCheck={false} />
                  <div className="label">Output variable</div>
                  <input className="input" defaultValue={selectedWidget.w.id === 21 ? 'Order Filters' : 'Filtered Orders'} spellCheck={false} />
                  <div className="label">Component type</div>
                  <select className="input" defaultValue="Multi-select dropdown">
                    <option>Multi-select dropdown</option><option>Dropdown</option><option>Pills</option><option>Checkboxes</option>
                  </select>
                  <label className="env-row" style={{ cursor: 'pointer', userSelect: 'none', padding: '6px 8px', borderRadius: 'var(--r-sm)', marginTop: 8 }}>
                    <input type="checkbox" defaultChecked title="Allow users to add/remove filters in the published app" /> Allow users to add / remove filters
                  </label>
                  <div className="label">Properties exposed</div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{['Item Name','Assignee','Status','Due Date'].map(p => <span key={p} className="chip chip-mono" style={{ fontSize: 9 }}>{p}</span>)}</div>
                </>
              )}
                {selectedWidget.w.kind === 'object-table' && (<>
                  <div className="panel-title" style={{ marginTop: 10 }}>Column Configuration</div>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                    <button className="btn" style={{ fontSize: 10, padding: '5px 8px' }} onClick={() => addColumn(selectedWidget.w.id, 'Item Name', 'string')}>+ Add Item Name</button>
                    <button className="btn" style={{ fontSize: 10, padding: '5px 8px' }} onClick={() => addColumn(selectedWidget.w.id, 'Order Status', 'enum')}>+ Add Status</button>
                    <button className="btn" style={{ fontSize: 10, padding: '5px 8px' }} onClick={() => addColumn(selectedWidget.w.id, 'Due Date', 'timestamp')}>+ Add Date</button>
                    <button className="btn btn-danger" style={{ fontSize: 10, padding: '5px 8px' }} onClick={() => removeAllColumns(selectedWidget.w.id)}>Remove all</button>
                  </div>
                  <label className="env-row" style={{ cursor: 'pointer', userSelect: 'none', padding: '6px 8px', borderRadius: 'var(--r-sm)', margin: '0 0 8px' }} title="Enable object table filtering">
                    <input type="checkbox" checked={!!selectedWidget.w.filteringEnabled} onChange={e => setFiltering(selectedWidget.w.id, e.target.checked)} /> Enable object table filtering
                  </label>
                  {(selectedWidget.w.columns ?? []).length === 0 && <div className="dashed-empty" style={{ padding: '10px 8px', textAlign: 'center', borderRadius: 8, fontSize: 11 }}>No columns bound yet — add from the ORDER schema</div>}
                  {(selectedWidget.w.columns ?? []).map((c, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', borderRadius: 6, fontSize: 11 }}>
                      <strong style={{ flex: 1 }}>{c.property}</strong>
                      <span className="chip chip-mono" style={{ fontSize: 8 }}>{c.type}</span>
                      <button className="icon-btn" title="Move up" onClick={() => moveColumn(selectedWidget.w.id, i, -1)}>▲</button>
                      <button className="icon-btn" title="Move down" onClick={() => moveColumn(selectedWidget.w.id, i, 1)}>▼</button>
                    </div>
                  ))}
                </>
              )}
              <div className="label">Properties</div>
              {['Item Name', 'Order Status', 'Due Date', 'Total (bbl)'].map(p => (
                <label key={p} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 2px', fontSize: 11.5 }}>
                  <input type="checkbox" defaultChecked={p !== 'Due Date'} /> {p}
                </label>
              ))}
            </>
          ) : <div className="module-sub">Select a widget to configure it.</div>}
        </div>
      </div>

      {/* ── Preview modal ─────────────────────────────────── */}
      {showPreview && (
        <div className="palette-overlay" onMouseDown={() => setShowPreview(false)}>
          <div className="glass-strong fade-in" style={{ width: 720, maxWidth: '94vw', maxHeight: '80vh', overflow: 'auto', padding: 16, borderRadius: 'var(--r-md)' }} onMouseDown={e => e.stopPropagation()}>
            <div className="module-title" style={{ fontSize: 14, justifyContent: 'space-between' }}>
              <span>{MODULE_NAME} · Preview {publishedVersion > 0 ? `v${publishedVersion}` : '(draft)'}</span>
              <button className="btn btn-ghost" onClick={() => setShowPreview(false)}><Icon name="x" size={14} /></button>
            </div>
            <div className="module-sub" style={{ marginBottom: 8 }}>Published snapshot rendered read-only · object-set selector drives the table</div>
            <div className="ws-section" style={{ marginBottom: 8 }}>
              <div className="ws-section-h"><span>Order table · live rows</span><span>{previewRows.length} row(s)</span></div>
              <table className="tbl">
                <thead><tr>{Object.keys(previewRows[0] ?? {}).slice(0, 5).map(k => <th key={k}>{k}</th>)}</tr></thead>
                <tbody>{previewRows.map((r, i) => <tr key={i}>{Object.keys(r).slice(0, 5).map(k => <td key={k}>{String(r[k])}</td>)}</tr>)}</tbody>
              </table>
            </div>
            <div className="ws-section">
              <div className="ws-section-h"><span>Property list · active object</span></div>
              <div className="module-sub" style={{ padding: 8 }}>Item Name · Order Status · Total (bbl) — bound to Object table 1 Active object</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
              <button className="btn" onClick={() => setShowPreview(false)}>Close</button>
              <button className="btn btn-primary" onClick={publish}><Icon name="check" size={13} /> Publish</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Version history ───────────────────────────────── */}
      {showHistory && (
        <div className="palette-overlay" onMouseDown={() => setShowHistory(false)}>
          <div className="glass-strong fade-in" style={{ width: 520, maxWidth: '94vw', maxHeight: '70vh', overflow: 'auto', padding: 16, borderRadius: 'var(--r-md)' }} onMouseDown={e => e.stopPropagation()}>
            <div className="module-title" style={{ fontSize: 14, justifyContent: 'space-between' }}>
              <span>Version history</span>
              <button className="btn btn-ghost" onClick={() => setShowHistory(false)}><Icon name="x" size={14} /></button>
            </div>
            {published.length === 0 && <div className="module-sub" style={{ marginTop: 8 }}>No published versions yet. Publish v1 to start history.</div>}
            {[...published].reverse().map((s: any) => (
              <div key={s.v} className="trace-step" style={{ alignItems: 'center' }}>
                <div>
                  <strong>v{s.v} — {s.widgetCount} widget(s)</strong>{s.note ? ` · ${s.note}` : ''}<br />
                  <span style={{ color: 'var(--text-dim)' }}>{new Date(s.publishedAt).toLocaleString()}</span>
                </div>
                <button className="btn" style={{ marginLeft: 'auto' }} onClick={() => rollback(s)}><Icon name="refresh" size={12} /> Roll back</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
