import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon, type IconName } from './Icon'

export type PaletteItem = { id: string; label: string; hint: string; icon: IconName; run: () => void; terms?: string }

export default function CommandPalette({ items, onClose }: { items: PaletteItem[]; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(
    () => items.filter(i => (i.label + ' ' + i.hint + ' ' + (i.terms ?? '')).toLowerCase().includes(q.toLowerCase())),
    [items, q]
  )

  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => { setSel(0) }, [q])

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(s + 1, filtered.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(s - 1, 0)) }
    else if (e.key === 'Enter' && filtered[sel]) { filtered[sel].run(); onClose() }
    else if (e.key === 'Escape') onClose()
  }

  return (
    <div className="palette-overlay" onMouseDown={onClose}>
      <div className="palette glass-strong fade-in" onMouseDown={e => e.stopPropagation()} role="dialog" aria-label="Command palette">
        <div className="palette-input">
          <Icon name="search" size={18} />
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} onKeyDown={onKey} placeholder="Search apps, object types, actions…" aria-label="Search" />
          <kbd>ESC</kbd>
        </div>
        <div className="palette-list">
          {filtered.length === 0 && <div className="palette-item" style={{ cursor: 'default', color: 'var(--text-dim)' }}>No matches for “{q}”</div>}
          {filtered.map((item, i) => (
            <button key={item.id} className={`palette-item ${i === sel ? 'sel' : ''}`} onMouseEnter={() => setSel(i)} onClick={() => { item.run(); onClose() }}>
              <Icon name={item.icon} size={16} />
              {item.label}
              <small>{item.hint}</small>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
