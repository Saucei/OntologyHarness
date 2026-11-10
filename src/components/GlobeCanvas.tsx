// GlobeCanvas — themed 360° orthographic globe for GeoMap (T-36).
// Fully traversable: drag spins the full 360° of longitude and travels pole to
// pole (lat clamped only at ±90 — the poles themselves); wheel / toolbar scale
// it; arrow keys rotate for keyboard access; optional auto-spin drifts through
// a full revolution (~40 s). Land = Natural Earth 110m (public domain), vendored
// same-origin at /geo/land-110m.json so it works offline in the installed app.
// Horizon clipping via d3-geo; marker math from ./globe (d3-compatible formulas).
// Glass tokens only — sphere/land/graticule all read CSS custom properties.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { geoOrthographic, geoPath, geoGraticule10 } from 'd3-geo'
import type { FeatureCollection, MultiPolygon } from 'geojson'
import { appendAudit } from '../store'
import {
  GLOBE_SPIN_DEG_PER_SEC,
  isVisible,
  projectGlobe,
  rotationFromDrag,
  sanitizeRotation,
  type GlobeRotation,
} from './globe'
import type { GeoPoint } from '../data/valueTypes'

/** Land layer: undefined = not yet loaded, null = load failed (graticule-only fallback). */
let landCache: FeatureCollection<MultiPolygon> | null | undefined

function loadLand(): Promise<FeatureCollection<MultiPolygon> | null> {
  if (landCache !== undefined) return Promise.resolve(landCache)
  return fetch('/geo/land-110m.json')
    .then(r => {
      if (!r.ok) throw new Error(`land HTTP ${r.status}`)
      return r.json() as Promise<FeatureCollection<MultiPolygon>>
    })
    .then(d => {
      landCache = d
      return d
    })
    .catch(() => {
      landCache = null
      return null
    })
}

export type GlobeMarker = {
  id: string
  label: string
  point: GeoPoint
  /** Radius in svg user units (same 100-unit space as the flat map). */
  r: number
  isSel: boolean
  title: string
  testid: string
}

export type GlobeCanvasProps = {
  /** Fallback rotation center (data centroid) — used until the user drags. */
  center: GeoPoint
  /** Committed rotation from the controller; null → center on `center`. */
  rotation: GlobeRotation | null
  onRotateCommit: (next: GlobeRotation) => void
  zoom: number
  onZoomDelta: (factor: number) => void
  spin: boolean
  markers: GlobeMarker[]
  /** Line-layer points in fixture order; segments render only when both ends are visible. */
  linePoints: Array<{ id: string; p: GeoPoint }> | null
  onSelect: (id: string) => void
  onSpinToggle: () => void
}

const VIEW = 100
const GLOBE_R = 44
const CX = VIEW / 2
const CY = VIEW / 2
const KEY_ROTATE_DEG = 15

export default function GlobeCanvas({
  center,
  rotation,
  onRotateCommit,
  zoom,
  onZoomDelta,
  spin,
  markers,
  linePoints,
  onSelect,
  onSpinToggle,
}: GlobeCanvasProps) {
  const fallback = useMemo<GlobeRotation>(() => ({ lat: center.lat, lng: center.lng }), [center.lat, center.lng])
  const [liveRot, setLiveRot] = useState<GlobeRotation>(() => sanitizeRotation(rotation ?? fallback))
  const [land, setLand] = useState<FeatureCollection<MultiPolygon> | null | undefined>(landCache)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const dragRef = useRef<{ px: number; py: number; rot: GlobeRotation; moved: boolean } | null>(null)
  const dragRefLive = useRef(false)

  // Adopt controller-committed rotation (view toggle, reset) when it changes.
  useEffect(() => {
    if (rotation) setLiveRot(sanitizeRotation(rotation))
  }, [rotation])

  useEffect(() => {
    if (land !== undefined) return
    let on = true
    loadLand().then(d => { if (on) setLand(d) })
    return () => { on = false }
  }, [land])

  // Auto-spin — continuous 360° drift; pauses while the user is dragging.
  useEffect(() => {
    if (!spin) return
    let raf = 0
    let last = performance.now()
    const tick = (t: number) => {
      const dt = Math.min(0.1, (t - last) / 1000)
      last = t
      if (!dragRefLive.current) setLiveRot(r => ({ lat: r.lat, lng: r.lng + dt * GLOBE_SPIN_DEG_PER_SEC }))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [spin])

  // Wheel zoom needs a non-passive native listener to preventDefault.
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const h = (e: WheelEvent) => {
      e.preventDefault()
      onZoomDelta(e.deltaY < 0 ? 1.12 : 1 / 1.12)
    }
    el.addEventListener('wheel', h, { passive: false })
    return () => el.removeEventListener('wheel', h)
  }, [onZoomDelta])

  const commit = useCallback((next: GlobeRotation) => {
    onRotateCommit(next)
    appendAudit({ event: 'map.rotate', lat: Math.round(next.lat * 10) / 10, lng: Math.round(next.lng * 10) / 10 })
  }, [onRotateCommit])

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    dragRefLive.current = true
    dragRef.current = { px: e.clientX, py: e.clientY, rot: liveRot, moved: false }
    // Synthetic events (automation) have no active pointerId — capture is best-effort.
    try { (e.currentTarget as Element).setPointerCapture?.(e.pointerId) } catch { /* no active pointer */ }
  }
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = dragRef.current
    if (!d) return
    const dx = e.clientX - d.px
    const dy = e.clientY - d.py
    if (Math.abs(dx) + Math.abs(dy) > 2) d.moved = true
    // Finer control when scaled in: degrees-per-pixel divided by zoom.
    // The ref carries the authoritative latest rotation — state may batch/delay,
    // so pointerup must never commit a stale closure value.
    d.rot = rotationFromDrag(d.rot, dx, dy, 0.4 / Math.max(0.6, zoom))
    setLiveRot(d.rot)
  }
  const endDrag = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = dragRef.current
    dragRef.current = null
    dragRefLive.current = false
    if (d?.moved) commit(d.rot)
    try { (e.currentTarget as Element).releasePointerCapture?.(e.pointerId) } catch { /* no active pointer */ }
  }

  const onKeyDown = (e: React.KeyboardEvent<SVGSVGElement>) => {
    const step = KEY_ROTATE_DEG
    let next: GlobeRotation | null = null
    if (e.key === 'ArrowLeft') next = { ...liveRot, lng: liveRot.lng - step }
    else if (e.key === 'ArrowRight') next = { ...liveRot, lng: liveRot.lng + step }
    else if (e.key === 'ArrowUp') next = { lat: Math.min(90, liveRot.lat + step), lng: liveRot.lng }
    else if (e.key === 'ArrowDown') next = { lat: Math.max(-90, liveRot.lat - step), lng: liveRot.lng }
    if (!next) return
    e.preventDefault()
    setLiveRot(next)
    commit(next)
  }

  const projRadius = GLOBE_R * zoom
  const projection = useMemo(
    () => geoOrthographic().rotate([-liveRot.lng, -liveRot.lat]).translate([CX, CY]).scale(projRadius).clipAngle(90),
    [liveRot.lat, liveRot.lng, projRadius],
  )
  const path = useMemo(() => geoPath(projection), [projection])
  const graticule = useMemo(() => path(geoGraticule10()) ?? undefined, [path])

  const spherePath = useMemo(() => path({ type: 'Sphere' } as const) ?? undefined, [path])
  const landPath = useMemo(() => (land ? path(land) ?? undefined : undefined), [path, land])

  const linePath = useMemo(() => {
    if (!linePoints || linePoints.length < 2) return ''
    const runs: string[] = []
    let cur: string[] = []
    for (const lp of linePoints) {
      const pos = projectGlobe(lp.p, liveRot, projRadius)
      if (!pos) {
        if (cur.length >= 2) runs.push(cur.join(' '))
        cur = []
        continue
      }
      cur.push(`${(CX + pos.x).toFixed(2)},${(CY + pos.y).toFixed(2)}`)
    }
    if (cur.length >= 2) runs.push(cur.join(' '))
    return runs.join(' ')
  }, [linePoints, liveRot, projRadius])

  const placed = markers
    .map(m => ({ m, pos: projectGlobe(m.point, liveRot, projRadius) }))
    .filter((x): x is { m: GlobeMarker; pos: { x: number; y: number } } => x.pos !== null)
  const hidden = markers.length - placed.length

  return (
    <div style={{ position: 'relative', lineHeight: 0 }} data-testid="globe-wrap">
      <svg
        ref={svgRef}
        data-testid="globe-svg"
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        width="100%"
        role="application"
        aria-label={`Globe view — drag to rotate through 360°, arrow keys rotate, scroll to zoom. Facing lat ${Math.round(liveRot.lat)}, lng ${Math.round(liveRot.lng)}. ${placed.length} of ${markers.length} markers visible.`}
        style={{ display: 'block', aspectRatio: '1 / 1', touchAction: 'none', cursor: dragRef.current ? 'grabbing' : 'grab', outline: 'none' }}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
      >
        {/* ocean sphere — glass tokens only */}
        <path d={spherePath} style={{ fill: 'var(--glass-bg-strong)', stroke: 'var(--glass-border-strong)' }} strokeWidth={0.4} />
        {/* graticule */}
        {graticule && <path d={graticule} fill="none" style={{ stroke: 'var(--glass-border)' }} strokeWidth={0.15} strokeOpacity={0.55} />}
        {/* Natural Earth land — green glass */}
        {landPath && (
          <path
            d={landPath}
            data-testid="globe-land"
            style={{ fill: 'var(--green-400)', fillOpacity: 0.34, stroke: 'var(--green-100)' }}
            strokeWidth={0.22}
            strokeOpacity={0.75}
          />
        )}
        {/* line layer — visible segments only */}
        {linePath && (
          <polyline
            points={linePath}
            data-testid="map-line"
            fill="none"
            style={{ stroke: 'var(--green-100)', strokeWidth: 0.45, strokeOpacity: 0.8 }}
          />
        )}
        {/* markers — same testids as the flat view for linked behavior */}
        {placed.map(({ m, pos }) => (
          <g key={m.id} data-testid={m.testid} transform={`translate(${(CX + pos.x).toFixed(2)} ${(CY + pos.y).toFixed(2)})`}>
            <title>{m.title}</title>
            <circle
              r={m.r}
              style={{
                fill: 'var(--green-400)',
                fillOpacity: m.isSel ? 0.55 : 0.3,
                stroke: 'var(--green-100)',
                strokeWidth: m.isSel ? 0.45 : 0.28,
                cursor: 'pointer',
              }}
              onPointerDown={e => e.stopPropagation()}
              onClick={() => onSelect(m.id)}
              tabIndex={0}
              role="button"
              aria-label={`${m.label} — value ${m.title}`}
            />
            <text
              y={m.r + 3.2}
              textAnchor="middle"
              style={{ fill: 'var(--green-50)', fontSize: 2.2, fontFamily: 'var(--font-mono)', pointerEvents: 'none' }}
            >
              {m.label.length > 18 ? `${m.label.slice(0, 17)}…` : m.label}
            </text>
          </g>
        ))}
      </svg>
      {/* status chips */}
      <div style={{ position: 'absolute', right: 8, bottom: 8, display: 'flex', gap: 4, lineHeight: 1.4 }}>
        {!land && land !== undefined && (
          <span className="chip chip-mono" style={{ fontSize: 9, background: 'var(--glass-bg-strong)' }} title="Land layer failed to load — graticule only">no land layer</span>
        )}
        {hidden > 0 && (
          <span className="chip chip-mono" style={{ fontSize: 9, background: 'var(--glass-bg-strong)' }} title="Markers on the far hemisphere — rotate the globe to reach them">{hidden} on far side</span>
        )}
        <span className="chip chip-mono" style={{ fontSize: 9, background: 'var(--glass-bg-strong)' }} data-testid="globe-rotation">
          {Math.round(liveRot.lat)}°, {Math.round(((liveRot.lng % 360) + 540) % 360 - 180)}°
        </span>
      </div>
      <button
        className="btn"
        aria-label="Toggle auto-spin"
        aria-pressed={spin}
        data-testid="globe-spin-toggle"
        onClick={onSpinToggle}
        style={{ position: 'absolute', left: 8, bottom: 8, padding: '3px 10px', fontSize: 11 }}
        title="Slow 360° auto-rotation"
      >
        {spin ? '⏸ spin' : '⟳ spin'}
      </button>
    </div>
  )
}
