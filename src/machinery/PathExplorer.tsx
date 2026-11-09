// Path Explorer (FN-MCH-005): checked path rows with duration/length bars,
// click to highlight the path on the state graph.
// Pure render + callbacks; trace/audit live in the MachineryGraph handlers.
import { useMemo } from 'react'
import { formatCount, formatDays, pathBarWidthPct, type MachineryPath } from './mach'

type Props = {
  paths: MachineryPath[]
  checked: string[]
  selectedId: string | null
  onToggleChecked: (id: string) => void
  onSelect: (id: string | null) => void
}

export default function PathExplorer({ paths, checked, selectedId, onToggleChecked, onSelect }: Props) {
  const maxDuration = useMemo(() => {
    const ds = paths.map(p => p.totalDurationDays).filter((v): v is number => v !== null)
    return ds.length ? Math.max(...ds) : null
  }, [paths])

  if (!paths.length) {
    return (
      <div data-testid="path-explorer" role="group" aria-label="Path explorer" className="module-sub" style={{ padding: '4px 2px' }}>
        No paths — this graph has no source nodes.
      </div>
    )
  }

  return (
    <div data-testid="path-explorer" role="group" aria-label="Path explorer" style={{ display: 'grid', gap: 2 }}>
      <div className="panel-title" style={{ marginBottom: 4 }}>
        <span>Paths</span>
        <span className="chip chip-mono">{checked.length} checked</span>
      </div>
      <div style={{ display: 'grid', gap: 2, maxHeight: 320, overflowY: 'auto', paddingRight: 2 }}>
        {paths.map(p => {
          const isChecked = checked.includes(p.id)
          const isSelected = selectedId === p.id
          const barValue = p.totalDurationDays ?? p.totalCount
          const barMax = maxDuration ?? Math.max(1, ...paths.map(q => q.totalCount ?? 0))
          const dimmed = checked.length > 0 && !isChecked && !isSelected
          return (
            <button
              key={p.id}
              type="button"
              data-testid={`path-row-${p.id}`}
              aria-pressed={isSelected}
              aria-label={`Highlight path ${p.title}`}
              onClick={() => onSelect(isSelected ? null : p.id)}
              className={`mach-path-row ${isSelected || isChecked ? 'is-active' : ''} ${dimmed ? 'is-dimmed' : ''}`}
              title={`${p.title} · ${p.hopCount} hops · ${p.totalDurationDays !== null ? formatDays(p.totalDurationDays) : '--'} · count ${formatCount(p.totalCount)}`}
            >
              <input
                type="checkbox"
                checked={isChecked}
                aria-label={`Include path ${p.title}`}
                data-testid={`path-check-${p.id}`}
                onChange={e => { e.stopPropagation(); onToggleChecked(p.id) }}
                onClick={e => e.stopPropagation()}
                style={{ accentColor: 'var(--green-700)', flexShrink: 0 }}
              />
              <span className="mach-path-title">{p.title}</span>
              <span className="mach-path-meta" aria-hidden>
                <span className="mach-path-count">{formatCount(p.totalCount)}</span>
                <span className="mach-path-bar-track">
                  <span className="mach-path-bar" style={{ width: `${pathBarWidthPct(barValue, barMax)}%` }} />
                </span>
              </span>
              <span className="mach-path-sub">
                {p.hopCount} {p.hopCount === 1 ? 'hop' : 'hops'} · {p.totalDurationDays !== null ? formatDays(p.totalDurationDays) : '--'}
              </span>
            </button>
          )
        })}
      </div>
      <div className="mach-path-foot module-sub">
        {selectedId ? `${paths.find(p => p.id === selectedId)?.title ?? selectedId} highlighted · click again to clear` : 'Click a row to highlight its path.'}
      </div>
    </div>
  )
}
