// Duration histogram with brush filter (FN-MCH-006): minimal brush mirroring
// the COP HistogramBrush pattern (pointer drag + From/To sliders + clear +
// Escape). Filters machinery nodes by duration range. Glass tokens only.
import { useCallback, useMemo, useRef } from 'react'
import { appendAudit, appendTrace } from '../store'
import {
  buildDurationHistogram, durationDomain, normalizeDurationRange,
  type DurationRange, type MachineryFixture, type MachineryNode,
} from './mach'

type Props = {
  nodes: MachineryNode[]
  fixtureId: MachineryFixture['id']
  range: DurationRange
  binCount?: number
  onChange: (next: DurationRange) => void
}

export default function DurationHistogram({ nodes, fixtureId, range, binCount = 12, onChange }: Props) {
  const domain = useMemo(() => durationDomain(nodes), [nodes])
  const bins = useMemo(() => buildDurationHistogram(nodes, binCount, domain), [nodes, binCount, domain])
  const maxCount = useMemo(() => Math.max(1, ...bins.map(b => b.count)), [bins])
  const brushRef = useRef<HTMLDivElement | null>(null)
  const dragStart = useRef<number | null>(null)

  const commit = useCallback((next: DurationRange, via: string) => {
    const clamped = domain ? normalizeDurationRange(next, domain) : null
    onChange(clamped)
    const detail = clamped ? `${Math.round(clamped[0])}..${Math.round(clamped[1])} days` : 'cleared'
    appendTrace({ kind: 'tool-call', tool: 'machinery.duration.brush', ok: true, ms: 0, detail: `${via} · ${detail}` })
    appendAudit({ event: 'machinery.duration.brush', range: clamped, via, fixture: fixtureId })
  }, [domain, onChange, fixtureId])

  const valueAt = useCallback((e: React.PointerEvent) => {
    const el = brushRef.current
    if (!el || !domain) return null
    const rect = el.getBoundingClientRect()
    const t = (e.clientX - rect.left) / Math.max(1, rect.width)
    const lo = Math.min(domain[0], domain[1])
    const hi = Math.max(domain[0], domain[1])
    return lo + Math.min(1, Math.max(0, t)) * (hi - lo)
  }, [domain])

  const onPointerDown = (e: React.PointerEvent) => {
    if (!domain) return
    dragStart.current = valueAt(e)
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragStart.current === null || !domain) return
    const v = valueAt(e)
    if (v === null) return
    onChange(normalizeDurationRange([Math.min(dragStart.current, v), Math.max(dragStart.current, v)], domain))
  }
  const onPointerUp = (e: React.PointerEvent) => {
    if (dragStart.current === null || !domain) return
    const v = valueAt(e) ?? dragStart.current
    const next: DurationRange = [Math.min(dragStart.current, v), Math.max(dragStart.current, v)]
    dragStart.current = null
    commit(next, 'brush')
  }

  const setStart = (v: number) => {
    if (!domain) return
    const base: DurationRange = range ?? domain
    commit([v, base[1]], 'slider')
  }
  const setEnd = (v: number) => {
    if (!domain) return
    const base: DurationRange = range ?? domain
    commit([base[0], v], 'slider')
  }

  if (!domain || bins.length === 0) {
    return (
      <div data-testid="duration-histogram" role="group" aria-label="Duration histogram" className="glass-faint" style={{ padding: '8px 10px', fontSize: 11, color: 'var(--text-dim)' }}>
        No durations — duration brush unavailable
      </div>
    )
  }

  const lo = Math.min(domain[0], domain[1])
  const hi = Math.max(domain[0], domain[1])
  const brushLeft = range ? ((Math.min(range[0], range[1]) - lo) / (hi - lo || 1)) * 100 : 0
  const brushWidth = range ? ((Math.max(range[0], range[1]) - Math.min(range[0], range[1])) / (hi - lo || 1)) * 100 : 100

  return (
    <div
      data-testid="duration-histogram"
      role="group"
      aria-label="Duration histogram"
      onKeyDown={e => { if (e.key === 'Escape') commit(null, 'escape') }}
      style={{ display: 'grid', gap: 6 }}
    >
      <div className="panel-title" style={{ marginBottom: 0 }}>
        <span>Duration</span>
        <span className="chip chip-mono">{range ? `${Math.round(Math.min(range[0], range[1]))}–${Math.round(Math.max(range[0], range[1]))}d` : 'all'}</span>
      </div>
      <div
        ref={brushRef}
        aria-label="Duration brush"
        data-testid="duration-histogram-area"
        style={{
          position: 'relative',
          height: 56,
          borderRadius: 'var(--r-sm)',
          border: '1px solid var(--glass-border)',
          background: 'var(--glass-bg-faint)',
          overflow: 'hidden',
          cursor: 'crosshair',
          touchAction: 'none',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {/* bins — glass tokens only */}
        <div aria-hidden style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', gap: 1, padding: '4px 3px 2px' }}>
          {bins.map((b, i) => (
            <div
              key={i}
              title={`${Math.round(b.start)}–${Math.round(b.end)}d · ${b.count}`}
              style={{
                flex: 1,
                height: `${Math.max(4, (b.count / maxCount) * 100)}%`,
                background: 'var(--green-400)',
                opacity: range ? (b.end < Math.min(range[0], range[1]) || b.start > Math.max(range[0], range[1]) ? 0.22 : 0.85) : 0.55,
                borderRadius: 2,
              }}
            />
          ))}
        </div>
        {range && (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `${brushLeft}%`,
              width: `${Math.max(2, brushWidth)}%`,
              borderLeft: '2px solid var(--green-600)',
              borderRight: '2px solid var(--green-600)',
              background: 'rgba(34, 197, 94, 0.12)',
            }}
          />
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <label style={{ display: 'block' }}>
          <span className="label" style={{ margin: '0 0 2px' }}>From</span>
          <input
            aria-label="Duration start"
            data-testid="duration-range-start"
            className="input chip-mono"
            type="range"
            min={lo}
            max={hi}
            value={range ? Math.min(range[0], range[1]) : lo}
            onChange={e => setStart(Number(e.target.value))}
          />
        </label>
        <label style={{ display: 'block' }}>
          <span className="label" style={{ margin: '0 0 2px' }}>To</span>
          <input
            aria-label="Duration end"
            data-testid="duration-range-end"
            className="input chip-mono"
            type="range"
            min={lo}
            max={hi}
            value={range ? Math.max(range[0], range[1]) : hi}
            onChange={e => setEnd(Number(e.target.value))}
          />
        </label>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span className="chip-mono" style={{ fontSize: 10, color: 'var(--text-dim)' }} aria-live="polite">
          {range ? `${Math.round(Math.min(range[0], range[1]))}..${Math.round(Math.max(range[0], range[1]))} days` : 'all durations'}
        </span>
        <button className="btn" aria-label="Clear duration filter" data-testid="duration-histogram-clear" onClick={() => commit(null, 'clear')} style={{ padding: '3px 10px', fontSize: 11 }}>
          Clear
        </button>
      </div>
    </div>
  )
}
