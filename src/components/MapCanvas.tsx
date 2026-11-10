// MapCanvas — Leaflet-free canvas + cluster/bubble renderer + legend (FN-GEO-001, FN-GEO-003).
// COP facet rail + histogram + linked table (FN-GEO-002 / T-20 via src/cop/facetEngine).
// No tile server; equirectangular projection over the constrained geo subset, glass tokens only.
// Corpus-2 reference: cluster-layer config (Point/Cluster/Choropleth/Line segment,
// geohash property, aggregation, autoscale) + metric cards + Successful/Cancelled/Diverted legend
// + COP faceted filter rail with count checkboxes + histogram date range + map-table linkage.
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { parseGeoPoint, encodeGeohash } from '../data/valueTypes'
import type { GeoPoint } from '../data/valueTypes'
import { appendAudit, appendTrace } from '../store'
import {
  buildHistogramBins,
  buildSelectionAwareFacets,
  clampDateRange,
  dataTimeDomain,
  filterPoints,
  isFiltered,
  linkedFacetValues,
  resolveLinkedSelection,
  toEpoch,
  toggleFacetValue,
  EMPTY_SELECTION,
} from '../cop/facetEngine'
import type { DateRange, FacetSelection } from '../cop/facetEngine'
import GlobeCanvas from './GlobeCanvas'
import type { GlobeMarker } from './GlobeCanvas'
import type { GlobeRotation } from './globe'

export type MapPointInput = GeoPoint | string

export type DispatchStatus = 'Successful' | 'Cancelled' | 'Diverted'

export type MapPoint = {
  id: string
  label: string
  point: MapPointInput
  value?: number
  category?: string
  geohash?: string
  status?: DispatchStatus | string
  /** ISO date string, epoch ms, or Date — feeds the histogram brush (FN-GEO-002). */
  date?: string | number | Date
}

export type AggregatedBubble = {
  id: string
  /** Geohash cell prefix that groups the members. */
  cell: string
  point: GeoPoint
  totalValue: number
  count: number
  labels: string[]
}

export type MapViewport = { zoom: number }

/** Radius for a bubble value; width-scaled from the collection max. */
export function bubbleRadius(value: number, maxValue: number, minRadius = 1.6, maxRadius = 5.2): number {
  const v = Math.max(0, Number(value) || 0)
  const m = Math.max(1, maxValue)
  const t = Math.sqrt(Math.min(1, v / m))
  return Math.round((minRadius + t * (maxRadius - minRadius)) * 100) / 100
}

/* ── Cluster layer config (FN-GEO-001) ─────────────────────────── */

export type LayerType = 'point' | 'cluster' | 'choropleth' | 'line'
export type AggregationMode = 'sum' | 'avg' | 'count' | 'max'

export type ClusterLayerConfig = {
  layerType: LayerType
  /** Name of the geohash property on source points (cosmetic label for the binding). */
  geohashProperty: string
  /** Geohash bucket precision 1–12. */
  precision: number
  aggregation: AggregationMode
  autoscale: boolean
}

export const DEFAULT_CLUSTER_CONFIG: ClusterLayerConfig = {
  layerType: 'point',
  geohashProperty: 'geohash',
  precision: 5,
  aggregation: 'sum',
  autoscale: true,
}

/** Clamp/normalize user-supplied config. */
export function sanitizeClusterConfig(partial: Partial<ClusterLayerConfig>): ClusterLayerConfig {
  const layerType: LayerType =
    partial.layerType === 'cluster' || partial.layerType === 'choropleth' || partial.layerType === 'line' || partial.layerType === 'point'
      ? partial.layerType
      : DEFAULT_CLUSTER_CONFIG.layerType
  const aggregation: AggregationMode =
    partial.aggregation === 'avg' || partial.aggregation === 'count' || partial.aggregation === 'max' || partial.aggregation === 'sum'
      ? partial.aggregation
      : DEFAULT_CLUSTER_CONFIG.aggregation
  const precision = Math.min(12, Math.max(1, Math.floor(Number(partial.precision) || DEFAULT_CLUSTER_CONFIG.precision)))
  const geohashProperty = String(partial.geohashProperty ?? DEFAULT_CLUSTER_CONFIG.geohashProperty).trim() || 'geohash'
  return { layerType, geohashProperty, precision, aggregation, autoscale: partial.autoscale !== false }
}

/** Bubble radius honoring autoscale: data-max when on, fixed ceiling (100) when off. */
export function scaledBubbleRadius(value: number, dataMax: number, autoscale: boolean, fixedMax = 100): number {
  const denom = autoscale ? Math.max(1, dataMax) : fixedMax
  return bubbleRadius(value, denom)
}

function toGeoPoint(input: MapPointInput): GeoPoint | null {
  if (typeof input === 'string') {
    const p = parseGeoPoint(input)
    if (!p) return null
    if (p.lat < -90 || p.lat > 90 || p.lng < -180 || p.lng > 180) return null
    return p
  }
  if (input && Number.isFinite(input.lat) && Number.isFinite(input.lng)) {
    if (input.lat < -90 || input.lat > 90 || input.lng < -180 || input.lng > 180) return null
    return { lat: input.lat, lng: input.lng }
  }
  return null
}

function centroid(points: GeoPoint[]): GeoPoint {
  if (!points.length) return { lat: 0, lng: 0 }
  const lat = points.reduce((a, p) => a + p.lat, 0) / points.length
  const lng = points.reduce((a, p) => a + p.lng, 0) / points.length
  return { lat, lng }
}

/**
 * Aggregation helper: group points by their truncated geohash cell.
 * Each bubble sums `value`, counts members, and centers on the member centroid.
 * Optional `aggregation` sets the bubble total: sum | avg | count | max.
 */
export function aggregateByGeohash(points: MapPoint[], precision = 5, aggregation: AggregationMode = 'sum'): AggregatedBubble[] {
  const prec = Math.min(12, Math.max(1, Math.floor(precision) || 5))
  const groups = new Map<string, { pts: Array<{ p: GeoPoint; v: number; label: string }> }>()
  for (const mp of points) {
    const p = toGeoPoint(mp.point)
    if (!p) continue
    const cell = (mp.geohash ?? encodeGeohash(p.lat, p.lng, prec)).toLowerCase().slice(0, prec)
    const entry = groups.get(cell) ?? { pts: [] }
    entry.pts.push({ p, v: Math.max(0, Number(mp.value) || 0), label: mp.label })
    groups.set(cell, entry)
  }
  const out: AggregatedBubble[] = []
  for (const [cell, g] of groups) {
    const sum = g.pts.reduce((a, x) => a + x.v, 0)
    const totalValue =
      aggregation === 'avg' ? sum / Math.max(1, g.pts.length)
      : aggregation === 'count' ? g.pts.length
      : aggregation === 'max' ? Math.max(0, ...g.pts.map(x => x.v))
      : sum
    out.push({
      id: `cell-${cell}`,
      cell,
      point: centroid(g.pts.map(x => x.p)),
      totalValue: Math.round(totalValue * 100) / 100,
      count: g.pts.length,
      labels: g.pts.map(x => x.label),
    })
  }
  out.sort((a, b) => b.totalValue - a.totalValue)
  return out
}

/* ── Metric cards (FN-GEO-003): Successful / Cancelled / Diverted ── */

export type StatusSummary = Record<DispatchStatus, { count: number; value: number }>
export type MetricCard = { label: DispatchStatus | 'Total'; count: number; value: number; share: number }

const STATUSES: DispatchStatus[] = ['Successful', 'Cancelled', 'Diverted']

export function summarizeDispatch(points: MapPoint[]): StatusSummary {
  const out: StatusSummary = {
    Successful: { count: 0, value: 0 },
    Cancelled: { count: 0, value: 0 },
    Diverted: { count: 0, value: 0 },
  }
  for (const p of points) {
    const s = String(p.status ?? '')
    if ((STATUSES as string[]).includes(s)) {
      out[s as DispatchStatus].count += 1
      out[s as DispatchStatus].value += Math.max(0, Number(p.value) || 0)
    }
  }
  return out
}

/** Metric cards over the map: one per dispatch status + Total (share = count share of all points). */
export function buildMetricCards(points: MapPoint[]): MetricCard[] {
  const summary = summarizeDispatch(points)
  const total = points.length
  const cards: MetricCard[] = STATUSES.map(label => ({
    label,
    count: summary[label].count,
    value: Math.round(summary[label].value * 100) / 100,
    share: total ? Math.round((summary[label].count / total) * 1000) / 10 : 0,
  }))
  const totalValue = Math.round(cards.reduce((a, c) => a + c.value, 0) * 100) / 100
  cards.push({ label: 'Total', count: total, value: totalValue, share: total ? 100 : 0 })
  return cards
}

export type ProjectedPoint = { x: number; y: number; point: GeoPoint }

/** Equirectangular projection (`width` × `height` view units) fitting `[minLng..maxLng] × [minLat..maxLat]`. Inverse of y. */
export function projectPoint(p: GeoPoint, width: number, height: number, bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number }): ProjectedPoint {
  const dLng = bounds.maxLng - bounds.minLng || 1
  const dLat = bounds.maxLat - bounds.minLat || 1
  const x = ((p.lng - bounds.minLng) / dLng) * width
  const y = ((bounds.maxLat - p.lat) / dLat) * height
  return { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, point: p }
}

function computeBounds(points: GeoPoint[], pad = 0.15) {
  if (!points.length) return { minLat: -90, maxLat: 90, minLng: -180, maxLng: 180 }
  const lats = points.map(p => p.lat)
  const lngs = points.map(p => p.lng)
  let minLat = Math.min(...lats)
  let maxLat = Math.max(...lats)
  let minLng = Math.min(...lngs)
  let maxLng = Math.max(...lngs)
  if (maxLat - minLat < 0.01) { minLat -= 0.05; maxLat += 0.05 }
  if (maxLng - minLng < 0.01) { minLng -= 0.05; maxLng += 0.05 }
  const dLat = (maxLat - minLat) * pad
  const dLng = (maxLng - minLng) * pad
  return { minLat: Math.max(-90, minLat - dLat), maxLat: Math.min(90, maxLat + dLat), minLng: Math.max(-180, minLng - dLng), maxLng: Math.min(180, maxLng + dLng) }
}

const MAP_W = 100
const MAP_H = 62.5

/* ── Cluster-layer config panel ────────────────────────────────── */

export type ClusterLayerConfigPanelProps = {
  config: ClusterLayerConfig
  onChange: (next: ClusterLayerConfig) => void
}

// Glass tokens only; mutating actions appendTrace + appendAudit.
export function ClusterLayerConfigPanel({ config, onChange }: ClusterLayerConfigPanelProps) {
  const update = useCallback((patch: Partial<ClusterLayerConfig>) => {
    const next = sanitizeClusterConfig({ ...config, ...patch })
    onChange(next)
    appendTrace({
      kind: 'tool-call',
      tool: 'map.layer.config',
      ok: true,
      ms: 0,
      detail: `${next.layerType} · ${next.geohashProperty} · ${next.aggregation} · p${next.precision}${next.autoscale ? ' · autoscale' : ''}`,
    })
    appendAudit({ event: 'map.layer.config', ...next })
  }, [config, onChange])

  return (
    <div
      className="glass-strong"
      role="dialog"
      aria-label="Cluster layer config"
      data-testid="cluster-layer-config"
      style={{ padding: '10px 12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, alignItems: 'end' }}
    >
      <label style={{ display: 'block' }}>
        <span className="label" style={{ margin: '0 0 4px' }}>Layer type</span>
        <select
          aria-label="Layer type"
          className="input"
          value={config.layerType}
          onChange={e => update({ layerType: e.target.value as LayerType })}
        >
          <option value="point">Point</option>
          <option value="cluster">Cluster</option>
          <option value="choropleth">Choropleth</option>
          <option value="line">Line segment</option>
        </select>
      </label>
      <label style={{ display: 'block' }}>
        <span className="label" style={{ margin: '0 0 4px' }}>Geohash property</span>
        <input
          aria-label="Geohash property"
          className="input chip-mono"
          value={config.geohashProperty}
          onChange={e => update({ geohashProperty: e.target.value })}
          placeholder="geohash"
        />
      </label>
      <label style={{ display: 'block' }}>
        <span className="label" style={{ margin: '0 0 4px' }}>Aggregation</span>
        <select
          aria-label="Aggregation"
          className="input"
          value={config.aggregation}
          onChange={e => update({ aggregation: e.target.value as AggregationMode })}
        >
          <option value="sum">Sum</option>
          <option value="avg">Avg</option>
          <option value="count">Count</option>
          <option value="max">Max</option>
        </select>
      </label>
      <label style={{ display: 'block' }}>
        <span className="label" style={{ margin: '0 0 4px' }}>Precision · {config.precision}</span>
        <input
          aria-label="Precision"
          className="input"
          type="range"
          min={1}
          max={12}
          value={config.precision}
          onChange={e => update({ precision: Number(e.target.value) })}
        />
      </label>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 'var(--fs-ui)', fontWeight: 600, color: 'var(--text-dim)' }}>
        <input
          aria-label="Autoscale"
          type="checkbox"
          checked={config.autoscale}
          onChange={e => update({ autoscale: e.target.checked })}
        />
        Autoscale
      </label>
    </div>
  )
}

/* ── COP facet rail + histogram + linked table (FN-GEO-002 / T-20) ────
   Pure filter/histogram/linkage logic lives in src/cop/facetEngine.ts.
   Views here only render + log (appendTrace + appendAudit on every
   mutating action). Glass tokens only; light+dark parity via tokens. */

const fmtDay = (t: number) => new Date(t).toISOString().slice(0, 10)

export type HistogramBrushProps = {
  points: MapPoint[]
  range: DateRange
  onChange: (next: DateRange) => void
  binCount?: number
  /** When set, the brush filters the *linked* selection too (map-table sync). */
  selectedId?: string | null
}

export function HistogramBrush({ points, range, onChange, binCount = 12, selectedId }: HistogramBrushProps) {
  const domain = useMemo(() => dataTimeDomain(points), [points])
  const bins = useMemo(() => buildHistogramBins(points, binCount, domain), [points, binCount, domain])
  const maxCount = useMemo(() => Math.max(1, ...bins.map(b => b.count)), [bins])
  const brushRef = useRef<HTMLDivElement | null>(null)
  const dragStart = useRef<number | null>(null)

  const commit = useCallback((next: DateRange, via: string) => {
    const clamped = domain ? clampDateRange(next, domain) : null
    onChange(clamped)
    const detail = clamped ? `${fmtDay(clamped[0])}..${fmtDay(clamped[1])}` : 'cleared'
    appendTrace({ kind: 'tool-call', tool: 'cop.histogram.brush', ok: true, ms: 0, detail: `${via} · ${detail}` })
    appendAudit({ event: 'cop.histogram.brush', range: clamped, via, selectedId: selectedId ?? null })
  }, [domain, onChange, selectedId])

  const timeAt = useCallback((e: React.PointerEvent) => {
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
    dragStart.current = timeAt(e)
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragStart.current === null || !domain) return
    const t = timeAt(e)
    if (t === null) return
    onChange([Math.min(dragStart.current, t), Math.max(dragStart.current, t)])
  }
  const onPointerUp = (e: React.PointerEvent) => {
    if (dragStart.current === null || !domain) return
    const t = timeAt(e) ?? dragStart.current
    const next: DateRange = [Math.min(dragStart.current, t), Math.max(dragStart.current, t)]
    dragStart.current = null
    commit(next, 'brush')
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      commit(null, 'escape')
    }
  }

  const setStart = (v: number) => {
    if (!domain) return
    const base: DateRange = range ?? domain
    commit([v, base[1]], 'slider')
  }
  const setEnd = (v: number) => {
    if (!domain) return
    const base: DateRange = range ?? domain
    commit([base[0], v], 'slider')
  }

  if (!domain || bins.length === 0) {
    return (
      <div data-testid="histogram-brush" role="group" aria-label="Date histogram" className="glass-faint" style={{ padding: '8px 10px', fontSize: 11, color: 'var(--text-dim)' }}>
        No dated points — date brush unavailable
      </div>
    )
  }

  const lo = Math.min(domain[0], domain[1])
  const hi = Math.max(domain[0], domain[1])
  const brushLeft = range ? ((Math.min(range[0], range[1]) - lo) / (hi - lo || 1)) * 100 : 0
  const brushWidth = range ? ((Math.max(range[0], range[1]) - Math.min(range[0], range[1])) / (hi - lo || 1)) * 100 : 100

  return (
    <div
      data-testid="histogram-brush"
      role="group"
      aria-label="Date histogram"
      onKeyDown={onKeyDown}
      style={{ display: 'grid', gap: 6 }}
    >
      <div
        ref={brushRef}
        aria-label="Histogram brush"
        data-testid="histogram-brush-area"
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
        {/* bars — glass tokens only */}
        <div aria-hidden style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', gap: 1, padding: '4px 3px 2px' }}>
          {bins.map((b, i) => (
            <div
              key={i}
              title={`${fmtDay(b.start)} · ${b.count}`}
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
            aria-label="Histogram start"
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
            aria-label="Histogram end"
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
          {range ? `${fmtDay(Math.min(range[0], range[1]))}..${fmtDay(Math.max(range[0], range[1]))}` : 'all dates'}
        </span>
        <button className="btn" aria-label="Clear date filter" onClick={() => commit(null, 'clear')} style={{ padding: '3px 10px', fontSize: 11 }}>
          Clear
        </button>
      </div>
    </div>
  )
}

export type FacetRailProps = {
  points: MapPoint[]
  selection: FacetSelection
  onChange: (next: FacetSelection) => void
  selectedId?: string | null
  filteredCount?: number
}

// Filter facets with count badges + brushable date histogram (FN-GEO-002).
// Selection-aware counts: each dimension respects the other filters.
export function FacetRail({ points, selection, onChange, selectedId, filteredCount }: FacetRailProps) {
  const groups = useMemo(() => buildSelectionAwareFacets(points, selection), [points, selection])
  const linked = useMemo(
    () => resolveLinkedSelection(points, selectedId ?? null),
    [points, selectedId],
  )
  const linkedVals = useMemo(() => linkedFacetValues(linked), [linked])

  const toggle = useCallback((dimension: 'categories' | 'statuses', value: string) => {
    const next: FacetSelection = { ...selection, [dimension]: toggleFacetValue(selection[dimension], value) }
    onChange(next)
    const on = next[dimension].includes(value)
    appendTrace({ kind: 'tool-call', tool: 'cop.facet.toggle', ok: true, ms: 0, detail: `${dimension} · ${value} ${on ? 'on' : 'off'}` })
    appendAudit({ event: 'cop.facet.toggle', dimension, value, on, selection: next })
  }, [selection, onChange])

  const clearAll = useCallback(() => {
    onChange({ ...EMPTY_SELECTION })
    appendTrace({ kind: 'tool-call', tool: 'cop.facet.clear', ok: true, ms: 0, detail: 'all facets cleared' })
    appendAudit({ event: 'cop.facet.clear' })
  }, [onChange])

  const renderGroup = (title: string, dimension: 'categories' | 'statuses', facets: typeof groups.categories, linkedVal: string | null) => (
    <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
      <legend className="label" style={{ margin: '0 0 6px' }}>{title}</legend>
      <div style={{ display: 'grid', gap: 4 }}>
        {facets.map(f => {
          const checked = selection[dimension].includes(f.value)
          const isLinked = linkedVal !== null && linkedVal === f.value
          return (
            <label
              key={f.value}
              data-testid={`facet-${dimension}-${f.value}`}
              data-linked={isLinked ? 'true' : undefined}
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 8px',
                borderRadius: 'var(--r-sm)',
                border: '1px solid var(--glass-border)',
                background: isLinked ? 'var(--glass-bg-strong)' : 'transparent',
                boxShadow: isLinked ? 'var(--green-glow)' : 'none',
                cursor: 'pointer',
                fontSize: 'var(--fs-ui)',
              }}
            >
              <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
                <input
                  type="checkbox"
                  aria-label={`Filter by ${title === 'Category' ? 'category' : 'status'} ${f.value} (${f.count})`}
                  checked={checked}
                  onChange={() => toggle(dimension, f.value)}
                />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.value}
                  {isLinked && <span aria-hidden style={{ marginLeft: 6, color: 'var(--green-600)' }}>●</span>}
                </span>
              </span>
              <span className="chip chip-mono" aria-label={`${f.count} matching`}>{f.count}</span>
            </label>
          )
        })}
        {facets.length === 0 && (
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>No values match the current filters</div>
        )}
      </div>
    </fieldset>
  )

  return (
    <div
      role="complementary"
      aria-label="Filter facets"
      data-testid="facet-rail"
      className="glass-strong"
      style={{ padding: '10px 12px', display: 'grid', gap: 12, alignContent: 'start', minWidth: 210, maxWidth: 260 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <strong style={{ fontSize: 'var(--fs-ui)', letterSpacing: '.01em' }}>Filters</strong>
        <span className="chip chip-mono" aria-live="polite">
          {filteredCount ?? filterPoints(points, selection).length}/{points.length}
        </span>
      </div>
      {renderGroup('Category', 'categories', groups.categories, linkedVals.category)}
      {renderGroup('Status', 'statuses', groups.statuses, linkedVals.status)}
      <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: 10 }}>
        <div className="label" style={{ margin: '0 0 6px' }}>Date range</div>
        <HistogramBrush
          points={points}
          range={selection.dateRange}
          selectedId={selectedId ?? null}
          onChange={next => {
            const n = { ...selection, dateRange: next }
            onChange(n)
            appendTrace({ kind: 'tool-call', tool: 'cop.facet.date', ok: true, ms: 0, detail: next ? `${fmtDay(next[0])}..${fmtDay(next[1])}` : 'cleared' })
            appendAudit({ event: 'cop.facet.date', range: next })
          }}
        />
      </div>
      <button className="btn" aria-label="Clear all filters" onClick={clearAll} style={{ padding: '4px 10px', fontSize: 11 }} disabled={!isFiltered(selection)}>
        Clear all
      </button>
    </div>
  )
}

export type CopPointTableProps = {
  points: MapPoint[]
  selectedId?: string | null
  onSelect?: (point: MapPoint) => void
}

// Map-table linkage view: rows are the FILTERED points; the linked row stays
// highlighted in sync with the map selection (and vice versa).
export function CopPointTable({ points, selectedId, onSelect }: CopPointTableProps) {
  const select = useCallback((p: MapPoint) => {
    appendTrace({ kind: 'tool-call', tool: 'cop.table.select', ok: true, ms: 0, detail: `${p.id} · ${p.label}` })
    appendAudit({ event: 'cop.table.select', id: p.id, label: p.label })
    onSelect?.(p)
  }, [onSelect])

  return (
    <div className="glass-strong" role="region" aria-label="Filtered points table" data-testid="cop-table" style={{ padding: '8px 10px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-ui)' }}>
        <caption style={{ textAlign: 'left', fontSize: 10, fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--text-dim)', paddingBottom: 6 }}>
          {points.length} points · {points.length ? fmtDay(toEpoch(points[0].date) ?? Date.now()) === '' ? '' : '' : ''}
          {points.length} filtered · click a row to link it on the map
        </caption>
        <thead>
          <tr>
            {['Label', 'Category', 'Status', 'Value', 'Date'].map(h => (
              <th key={h} scope="col" style={{ textAlign: 'left', padding: '4px 6px', borderBottom: '1px solid var(--glass-border)', color: 'var(--text-dim)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {points.map(p => {
            const isSel = p.id === selectedId
            return (
              <tr
                key={p.id}
                data-testid={`cop-table-row-${p.id}`}
                aria-selected={isSel}
                onClick={() => select(p)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(p) } }}
                tabIndex={0}
                style={{
                  cursor: 'pointer',
                  background: isSel ? 'var(--glass-bg-strong)' : 'transparent',
                  boxShadow: isSel ? 'var(--green-glow)' : 'none',
                }}
              >
                <td style={{ padding: '4px 6px' }}>{p.label}</td>
                <td style={{ padding: '4px 6px' }}>{p.category ?? '—'}</td>
                <td style={{ padding: '4px 6px' }}>{p.status ?? '—'}</td>
                <td className="chip-mono" style={{ padding: '4px 6px' }}>{Number(p.value) || 0}</td>
                <td className="chip-mono" style={{ padding: '4px 6px' }}>{toEpoch(p.date) !== null ? fmtDay(toEpoch(p.date)!) : '—'}</td>
              </tr>
            )
          })}
          {points.length === 0 && (
            <tr><td colSpan={5} style={{ padding: '8px 6px', color: 'var(--text-dim)' }}>No points match the current filters</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

export type MapCanvasProps = {
  points: MapPoint[]
  title?: string
  selectedId?: string | null
  onSelect?: (point: MapPoint) => void
  config?: ClusterLayerConfig
  onConfigChange?: (next: ClusterLayerConfig) => void
  showConfigPanel?: boolean
  showMetrics?: boolean
  /** COP facet rail state (FN-GEO-002). Controlled when provided, otherwise internal. */
  facetSelection?: FacetSelection | null
  onFacetChange?: (next: FacetSelection) => void
  showFacetRail?: boolean
  showTable?: boolean
  /** T-36: open on the fully-traversable globe instead of the flat map. */
  initialView?: 'flat' | 'globe'
}

// Memoized so fixture renders stay stable; heavy projection lives in the SVG below.
export const MapCanvasBase = memo(function MapCanvasBase({
  points,
  title = 'Geo map',
  selectedId: controlledId,
  onSelect,
  config: controlledConfig,
  onConfigChange,
  showConfigPanel = false,
  showMetrics = true,
  facetSelection: controlledFacet,
  onFacetChange,
  showFacetRail = false,
  showTable = false,
  initialView = 'flat',
}: MapCanvasProps) {
  const [internalId, setInternalId] = useState<string | null>(null)
  const [internalConfig, setInternalConfig] = useState<ClusterLayerConfig>(DEFAULT_CLUSTER_CONFIG)
  const [internalFacet, setInternalFacet] = useState<FacetSelection>(() => ({ ...EMPTY_SELECTION }))
  const [viewport, setViewport] = useState<MapViewport>({ zoom: 1 })
  // T-36 globe view: 'flat' keeps the classic equirectangular canvas; 'globe' is the
  // fully traversable 360° orthographic view (drag / arrow keys / auto-spin / wheel zoom).
  const [view, setView] = useState<'flat' | 'globe'>(initialView)
  const [globeRot, setGlobeRot] = useState<GlobeRotation | null>(null)
  const [spin, setSpin] = useState(false)
  const selectedId = controlledId !== undefined ? controlledId : internalId
  const config = controlledConfig ?? internalConfig
  const facetSelection: FacetSelection = controlledFacet ?? internalFacet

  const handleFacetChange = useCallback((next: FacetSelection) => {
    setInternalFacet({ ...next })
    onFacetChange?.(next)
  }, [onFacetChange])

  // Facet filter drives BOTH map bubbles and the linked table (map-table linkage).
  const filteredPoints = useMemo(
    () => filterPoints(points, facetSelection),
    [points, facetSelection],
  )

  const resolved = useMemo(() =>
    filteredPoints
      .map(mp => ({ mp, p: toGeoPoint(mp.point) }))
      .filter((r): r is { mp: MapPoint; p: GeoPoint } => r.p !== null)
      .map(r => ({ ...r.mp, _p: r.p })),
    [filteredPoints],
  )

  const bounds = useMemo(() => computeBounds(resolved.map(r => r._p)), [resolved])
  // Data centroid — default globe rotation center so the data faces the viewer.
  const dataCentroid = useMemo(() => centroid(resolved.map(r => r._p)), [resolved])
  const maxValue = useMemo(() => Math.max(1, ...resolved.map(r => Math.max(0, Number(r.value) || 1))), [resolved])
  const selected = useMemo(() => (selectedId ? resolved.find(r => r.id === selectedId) ?? null : null), [resolved, selectedId])

  // Geohash-bucket aggregation for cluster / choropleth layers (existing helper).
  // Bubbles + metric cards follow the facet filter so clicking a facet
  // filters map bubbles, cards AND the linked table together.
  const bubbles = useMemo(
    () => (config.layerType === 'cluster' || config.layerType === 'choropleth'
      ? aggregateByGeohash(filteredPoints, config.precision, config.aggregation)
      : []),
    [filteredPoints, config.layerType, config.precision, config.aggregation],
  )
  const bubbleMax = useMemo(() => Math.max(1, ...bubbles.map(b => b.totalValue)), [bubbles])
  const metricCards = useMemo(() => buildMetricCards(filteredPoints), [filteredPoints])
  const statusSummary = useMemo(() => summarizeDispatch(filteredPoints), [filteredPoints])

  const select = useCallback((mp: MapPoint) => {
    setInternalId(mp.id)
    appendTrace({ kind: 'tool-call', tool: 'map.canvas.select', ok: true, ms: 0, detail: `${mp.id} · ${mp.label}` })
    appendAudit({ event: 'map.select', id: mp.id, label: mp.label })
    onSelect?.(mp)
  }, [onSelect])

  const handleConfigChange = useCallback((next: ClusterLayerConfig) => {
    setInternalConfig(next)
    onConfigChange?.(next)
  }, [onConfigChange])

  const applyZoom = useCallback((next: (z: number) => number) => {
    setViewport(prev => {
      const zoom = Math.min(4, Math.max(0.6, Math.round(next(prev.zoom) * 100) / 100))
      if (zoom !== prev.zoom) {
        appendTrace({ kind: 'tool-call', tool: 'map.canvas.zoom', ok: true, ms: 0, detail: `zoom=${zoom}` })
        appendAudit({ event: 'map.zoom', zoom })
      }
      return { zoom }
    })
  }, [])

  const reset = useCallback(() => {
    setViewport({ zoom: 1 })
    // Globe mode: re-center on the data and stop the spin (fully resets traversal).
    setGlobeRot({ lat: dataCentroid.lat, lng: dataCentroid.lng })
    setSpin(false)
    appendTrace({ kind: 'tool-call', tool: 'map.canvas.reset', ok: true, ms: 0, detail: 'reset' })
    appendAudit({ event: 'map.reset' })
  }, [dataCentroid])

  const toggleView = useCallback(() => {
    const next = view === 'flat' ? 'globe' : 'flat'
    if (next === 'globe' && !globeRot) setGlobeRot({ lat: dataCentroid.lat, lng: dataCentroid.lng })
    if (next === 'flat') setSpin(false)
    setView(next)
    appendTrace({ kind: 'tool-call', tool: 'map.view.toggle', ok: true, ms: 0, detail: next })
    appendAudit({ event: 'map.view.toggle', view: next })
  }, [view, globeRot, dataCentroid])

  const commitGlobeRotation = useCallback((next: GlobeRotation) => {
    setGlobeRot(next)
    appendTrace({ kind: 'tool-call', tool: 'map.globe.rotate', ok: true, ms: 0, detail: `lat=${Math.round(next.lat)} lng=${Math.round(next.lng)}` })
  }, [])

  const toggleSpin = useCallback(() => {
    const next = !spin
    setSpin(next)
    appendTrace({ kind: 'tool-call', tool: 'map.globe.spin', ok: true, ms: 0, detail: next ? 'on' : 'off' })
    appendAudit({ event: 'map.spin', on: next })
  }, [spin])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedId) {
        setInternalId(null)
        appendTrace({ kind: 'tool-call', tool: 'map.canvas.clear-selection', ok: true, ms: 0, detail: `was=${selectedId}` })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId])

  const centerX = MAP_W / 2
  const centerY = MAP_H / 2
  const scale = viewport.zoom
  const translateX = centerX - centerX * scale
  const translateY = centerY - centerY * scale

  const isAggregated = config.layerType === 'cluster' || config.layerType === 'choropleth'
  const isLine = config.layerType === 'line'
  const linePath = useMemo(() => {
    if (!isLine || resolved.length < 2) return ''
    return resolved.map(r => {
      const pos = projectPoint(r._p, MAP_W, MAP_H, bounds)
      return `${pos.x},${pos.y}`
    }).join(' ')
  }, [isLine, resolved, bounds])

  // T-36 globe markers — same testids/styles as flat so tests + linked COP
  // behavior carry over. Choropleth falls back to centroid bubbles on the
  // sphere (rect cells can't wrap a globe); titles keep the cell detail.
  const globeMarkers = useMemo<GlobeMarker[]>(() => {
    if (isAggregated) {
      return bubbles.map(b => ({
        id: b.id,
        label: `${b.cell} · ${b.count}`,
        point: b.point,
        r: scaledBubbleRadius(b.totalValue, bubbleMax, config.autoscale),
        isSel: false,
        title: `cell ${b.cell} · ${b.count} pts · ${b.totalValue}`,
        testid: `map-bubble-${b.cell}`,
      }))
    }
    return resolved.map(m => {
      const r = bubbleRadius(Number(m.value) || 1, maxValue)
      const isSel = m.id === selectedId
      return {
        id: m.id,
        label: m.label,
        point: m._p,
        r: isSel ? r * 1.25 : r,
        isSel,
        title: `${m.label} · ${m._p.lat.toFixed(4)},${m._p.lng.toFixed(4)} · ${m.value ?? 0}`,
        testid: `map-point-${m.id}`,
      }
    })
  }, [isAggregated, bubbles, bubbleMax, config.autoscale, resolved, maxValue, selectedId])

  const globeLinePoints = useMemo(
    () => (isLine ? resolved.map(r => ({ id: r.id, p: r._p })) : null),
    [isLine, resolved],
  )

  const selectOnGlobe = useCallback((id: string) => {
    const mp = resolved.find(r => r.id === id)
    if (mp) select(mp)
  }, [resolved, select])

  const mapEl = (
      <div
        className="map-canvas"
        role="application"
        aria-label={`${title} — ${resolved.length} points${selected ? ` — ${selected.label} selected` : ''}`}
        data-testid="map-canvas"
        style={{
          position: 'relative',
          borderRadius: 'var(--r-md)',
          overflow: 'hidden',
          border: '1px solid var(--glass-border-strong)',
          boxShadow: 'var(--glass-shadow)',
          background: 'var(--green-ink)',
        }}
      >
        {/* Metric cards over the map (FN-GEO-003) — glass tokens only */}
        {showMetrics && (
          <div
            aria-label="Metric cards"
            data-testid="metric-cards"
            style={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: '70%' }}
          >
            {metricCards.map(c => (
              <div
                key={c.label}
                data-testid={`metric-card-${c.label.toLowerCase()}`}
                className="glass-strong"
                style={{
                  padding: '6px 10px',
                  minWidth: 86,
                  backdropFilter: 'var(--glass-blur)',
                  background: 'var(--glass-bg-strong)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: 'var(--r-sm)',
                }}
              >
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--text-dim)' }}>
                  {c.label}
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', lineHeight: 1.2 }}>
                  {c.count}
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', marginLeft: 6 }} className="chip-mono">
                    {c.value.toFixed(c.value % 1 ? 1 : 0)} · {c.share}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {view === 'flat' && (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage:
                'linear-gradient(var(--glass-border) 1px, transparent 1px), linear-gradient(90deg, var(--glass-border) 1px, transparent 1px)',
              backgroundSize: '10% 10%',
              opacity: 0.35,
              pointerEvents: 'none',
            }}
          />
        )}
        {view === 'flat' ? (
        <svg
          viewBox={`0 0 ${MAP_W} ${MAP_H}`}
          width="100%"
          preserveAspectRatio="xMidYMid meet"
          style={{ display: 'block', aspectRatio: '100 / 62.5' }}
          aria-hidden={false}
        >
          {/* equirectangular graticule (glass tokens only) */}
          {Array.from({ length: 9 }, (_, i) => (
            <line
              key={`v${i}`}
              x1={i * (MAP_W / 8)}
              y1={0}
              x2={i * (MAP_W / 8)}
              y2={MAP_H}
              style={{ stroke: 'var(--glass-border)' }}
              strokeWidth={0.12}
              strokeOpacity={0.5}
            />
          ))}
          {Array.from({ length: 5 }, (_, i) => (
            <line
              key={`h${i}`}
              x1={0}
              y1={i * (MAP_H / 4)}
              x2={MAP_W}
              y2={i * (MAP_H / 4)}
              style={{ stroke: 'var(--glass-border)' }}
              strokeWidth={0.12}
              strokeOpacity={0.5}
            />
          ))}
          <g transform={`translate(${translateX} ${translateY}) scale(${scale})`}>
            {isAggregated && bubbles.map(b => {
              const pos = projectPoint(b.point, MAP_W, MAP_H, bounds)
              const r = scaledBubbleRadius(b.totalValue, bubbleMax, config.autoscale)
              const isChoro = config.layerType === 'choropleth'
              const t = Math.min(1, b.totalValue / Math.max(1, bubbleMax))
              return (
                <g key={b.id} data-testid={`map-bubble-${b.cell}`} transform={`translate(${pos.x} ${pos.y})`}>
                  <title>{`cell ${b.cell} · ${b.count} pts · ${b.totalValue}`}</title>
                  {isChoro && (
                    <rect
                      data-testid={`map-cell-${b.cell}`}
                      x={-r * 2}
                      y={-r * 2}
                      width={r * 4}
                      height={r * 4}
                      rx={0.8}
                      style={{ fill: 'var(--green-400)', fillOpacity: 0.08 + t * 0.3, stroke: 'var(--green-100)', strokeWidth: 0.2 }}
                    />
                  )}
                  <circle
                    r={r}
                    style={{
                      fill: 'var(--green-400)',
                      fillOpacity: isChoro ? 0.12 + t * 0.4 : 0.3,
                      stroke: 'var(--green-100)',
                      strokeWidth: 0.28,
                    }}
                  />
                  <text
                    y={r + 3.2}
                    textAnchor="middle"
                    style={{ fill: 'var(--green-50)', fontSize: 2.2, fontFamily: 'var(--font-mono)' }}
                  >
                    {`${b.cell} · ${b.count}`}
                  </text>
                </g>
              )
            })}
            {isLine && resolved.length >= 2 && (
              <polyline
                points={linePath}
                data-testid="map-line"
                fill="none"
                style={{ stroke: 'var(--green-100)', strokeWidth: 0.45, strokeOpacity: 0.8 }}
              />
            )}
            {!isAggregated && resolved.map(m => {
              const pos = projectPoint(m._p, MAP_W, MAP_H, bounds)
              const r = bubbleRadius(Number(m.value) || 1, maxValue)
              const isSel = m.id === selectedId
              return (
                <g
                  key={m.id}
                  data-testid={`map-point-${m.id}`}
                  transform={`translate(${pos.x} ${pos.y})`}
                >
                  <title>{`${m.label} · ${m._p.lat.toFixed(4)},${m._p.lng.toFixed(4)} · ${m.value ?? 0}`}</title>
                  <circle
                    r={isSel ? r * 1.25 : r}
                    style={{
                      fill: 'var(--green-400)',
                      fillOpacity: isSel ? 0.55 : 0.3,
                      stroke: 'var(--green-100)',
                      strokeWidth: isSel ? 0.45 : 0.28,
                      cursor: 'pointer',
                    }}
                    onClick={() => select(m)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(m) } }}
                    tabIndex={0}
                    role="button"
                    aria-label={`${m.label} — value ${m.value ?? 0}`}
                  />
                  <text
                    y={(isSel ? r * 1.25 : r) + 3.2}
                    textAnchor="middle"
                    style={{ fill: 'var(--green-50)', fontSize: 2.2, fontFamily: 'var(--font-mono)' }}
                  >
                    {m.label.length > 18 ? `${m.label.slice(0, 17)}…` : m.label}
                  </text>
                </g>
              )
            })}
          </g>
        </svg>
        ) : (
          <GlobeCanvas
            center={dataCentroid}
            rotation={globeRot}
            onRotateCommit={commitGlobeRotation}
            zoom={viewport.zoom}
            onZoomDelta={f => applyZoom(z => z * f)}
            spin={spin}
            markers={globeMarkers}
            linePoints={globeLinePoints}
            onSelect={selectOnGlobe}
            onSpinToggle={toggleSpin}
          />
        )}

        {/* controls */}
        <div
          style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4, alignItems: 'center' }}
          role="toolbar"
          aria-label="Map controls"
        >
          <button
            className="btn"
            aria-label={view === 'flat' ? 'Switch to globe view' : 'Switch to flat view'}
            data-testid="map-view-toggle"
            onClick={toggleView}
            style={{ padding: '4px 10px', fontSize: 11 }}
            title={view === 'flat' ? '360° traversable globe' : 'Flat equirectangular map'}
          >
            {view === 'flat' ? '◍ Globe' : '▭ Flat'}
          </button>
          <span className="chip chip-mono" aria-live="polite" style={{ background: 'var(--glass-bg-strong)' }}>{viewport.zoom.toFixed(2)}×</span>
          <button className="btn" aria-label="Zoom in" onClick={() => applyZoom(z => z + 0.25)} style={{ padding: '4px 10px', fontSize: 12 }}>+</button>
          <button className="btn" aria-label="Zoom out" onClick={() => applyZoom(z => z - 0.25)} style={{ padding: '4px 10px', fontSize: 12 }}>−</button>
          <button className="btn" aria-label="Reset map" onClick={reset} style={{ padding: '4px 10px', fontSize: 11 }}>Reset</button>
        </div>

        {/* legend — glass tokens only, no new hues */}
        <div
          className="glass-faint"
          aria-label="Map legend"
          style={{
            position: 'absolute',
            left: 8,
            bottom: 8,
            padding: '8px 10px',
            fontSize: 10,
            lineHeight: 1.6,
            color: 'var(--green-50)',
            backdropFilter: 'var(--glass-blur)',
            background: 'var(--glass-bg)',
          }}
        >
          <div style={{ fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', fontSize: 9, color: 'var(--text)' }}>Legend</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
            {[1, Math.round((isAggregated ? bubbleMax : maxValue) / 2), isAggregated ? bubbleMax : maxValue].map((v, i) => {
              const r = bubbleRadius(v, isAggregated ? bubbleMax : maxValue)
              return (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <svg width={Math.max(14, r * 6)} height={Math.max(14, r * 6)} aria-hidden style={{ overflow: 'visible' }}>
                    <circle cx={Math.max(7, r * 3)} cy={Math.max(7, r * 3)} r={r * 3} style={{ fill: 'var(--green-400)', fillOpacity: 0.3, stroke: 'var(--green-100)' }} strokeWidth={1} />
                  </svg>
                  {Math.round(v)}
                </span>
              )
            })}
          </div>
          <div style={{ color: 'var(--text-dim)' }}>
            bubble ∝ √value · {resolved.length} pts · {view === 'globe' ? 'globe · drag 360° · scroll to zoom' : String(config.layerType)} · {config.aggregation} · p{config.precision}{config.autoscale ? ' · autoscale' : ''} · Escape clears selection
          </div>
          <div data-testid="map-legend-status" style={{ marginTop: 4, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {(['Successful', 'Cancelled', 'Diverted'] as DispatchStatus[]).map(s => (
              <span key={s} style={{ color: 'var(--text)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <svg width={10} height={10} aria-hidden style={{ overflow: 'visible' }}>
                  <circle cx={5} cy={5} r={4}
                    style={{
                      fill: 'var(--green-400)',
                      fillOpacity: s === 'Successful' ? 0.55 : s === 'Diverted' ? 0.3 : 0.14,
                      stroke: 'var(--green-100)',
                    }}
                    strokeWidth={1}
                  />
                </svg>
                {s} · {statusSummary[s].count}
              </span>
            ))}
          </div>
          {selected && (
            <div style={{ marginTop: 4, color: 'var(--text)' }}>
              <strong>{selected.label}</strong>
              <span className="chip-mono" style={{ marginLeft: 6, color: 'var(--text-dim)' }}>
                {selected._p.lat.toFixed(2)}, {selected._p.lng.toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {!resolved.length && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: 11 }}>
            No valid geo points
          </div>
        )}
      </div>
  )

  return (
    <div>
      {(showConfigPanel) && (
        <div style={{ marginBottom: 10 }}>
          <ClusterLayerConfigPanel config={config} onChange={handleConfigChange} />
        </div>
      )}
      {showFacetRail ? (
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <FacetRail
            points={points}
            selection={facetSelection}
            onChange={handleFacetChange}
            selectedId={selectedId ?? null}
            filteredCount={filteredPoints.length}
          />
          <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 10 }}>
            {mapEl}
            {showTable && (
              <CopPointTable points={filteredPoints} selectedId={selectedId ?? null} onSelect={mp => select(mp)} />
            )}
          </div>
        </div>
      ) : (
        <>
          {mapEl}
          {showTable && (
            <div style={{ marginTop: 10 }}>
              <CopPointTable points={filteredPoints} selectedId={selectedId ?? null} onSelect={mp => select(mp)} />
            </div>
          )}
        </>
      )}
    </div>
  )
})

export default MapCanvasBase
