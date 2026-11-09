// Machinery metric carousel (FN-MCH-002): Historical count | Current count | Historical duration.
import { useCallback } from 'react'
import { appendAudit, appendTrace } from '../store'
import { MACHINERY_METRICS, cycleMetric, type MachineryMetric } from './mach'

type Props = {
  metric: MachineryMetric
  onChange: (m: MachineryMetric) => void
}

export default function MachineryCarousel({ metric, onChange }: Props) {
  const emit = useCallback((m: MachineryMetric, via: string) => {
    appendTrace({ kind: 'tool-call', tool: 'machinery.carousel', ok: true, ms: 0, detail: `${metric} -> ${m} via ${via}` })
    appendAudit({ event: 'machinery.carousel', from: metric, to: m, via })
    onChange(m)
  }, [metric, onChange])

  return (
    <div
      className="mach-carousel glass-strong"
      role="group"
      aria-label="Metric carousel"
      data-testid="machinery-carousel"
      onKeyDown={e => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault()
          emit(cycleMetric(metric, e.key === 'ArrowRight' ? 1 : -1), e.key)
        }
      }}
    >
      <button
        type="button"
        className="btn btn-ghost"
        aria-label="Previous metric"
        data-testid="metric-prev"
        onClick={() => emit(cycleMetric(metric, -1), 'prev')}
      >
        ‹
      </button>
      <div role="tablist" aria-label="Metric" style={{ display: 'flex', gap: 4, flex: 1, justifyContent: 'center' }}>
        {MACHINERY_METRICS.map(m => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={metric === m.id}
            aria-pressed={metric === m.id}
            data-testid={`metric-${m.id}`}
            className={`btn ${metric === m.id ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => emit(m.id, 'pill')}
            style={{ whiteSpace: 'nowrap' }}
          >
            {m.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="btn btn-ghost"
        aria-label="Next metric"
        data-testid="metric-next"
        onClick={() => emit(cycleMetric(metric, 1), 'next')}
      >
        ›
      </button>
    </div>
  )
}
