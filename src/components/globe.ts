// globe.ts — pure orthographic-globe math for GeoMap's globe view (T-36).
// No DOM, no d3: everything here is unit-testable spherical trig. The formulas
// intentionally match d3-geo's geoOrthographic raw projection so marker
// positions agree exactly with the d3-rendered land/graticule paths:
//   x   = cos(φ)·sin(λ−λ0)
//   yUp = cos(φ0)·sin(φ) − sin(φ0)·cos(φ)·cos(λ−λ0)
//   visible ⇔ sin(φ0)·sin(φ) + cos(φ0)·cos(φ)·cos(λ−λ0) > 0
// Screen y is down in SVG, so y = −radius·yUp relative to the sphere center.
import type { GeoPoint } from '../data/valueTypes'

export type GlobeRotation = { lat: number; lng: number }

/** Drag sensitivity in degrees per pixel (matches a ~250 px half-globe swipe ≈ 100°). */
export const GLOBE_DEG_PER_PX = 0.4
/** Auto-spin speed in degrees per second (one full revolution ≈ 40 s). */
export const GLOBE_SPIN_DEG_PER_SEC = 9

const rad = (d: number) => (d * Math.PI) / 180

/** Clamp a latitude into [-90, 90]; non-finite input → 0. */
export function clampLat(lat: number): number {
  if (!Number.isFinite(lat)) return 0
  return Math.min(90, Math.max(-90, lat))
}

/** Wrap a longitude into (−180, 180]. Non-finite input → 0. */
export function normalizeLng(lng: number): number {
  if (!Number.isFinite(lng)) return 0
  let l = lng % 360
  if (l > 180) l -= 360
  if (l <= -180) l += 360
  return l
}

/** Defensive rotation cleanup (persisted/meta-sourced values can be garbage). */
export function sanitizeRotation(r: Partial<GlobeRotation> | null | undefined): GlobeRotation {
  return { lat: clampLat(Number(r?.lat)), lng: Number(r?.lng) || 0 }
}

/**
 * Drag → rotation. Grabbing the surface and pulling right (dx > 0) spins the
 * view center westward (lng decreases); pulling down (dy > 0) tilts the view
 * center northward (lat increases), clamped at the poles.
 */
export function rotationFromDrag(rot: GlobeRotation, dxPx: number, dyPx: number, degPerPx = GLOBE_DEG_PER_PX): GlobeRotation {
  return {
    lat: clampLat(rot.lat + dyPx * degPerPx),
    lng: rot.lng - dxPx * degPerPx,
  }
}

/** cos of the angular distance between the point and the view center. > 0 → near hemisphere. */
export function cosAngularDistance(p: GeoPoint, rot: GlobeRotation): number {
  const φ = rad(p.lat)
  const φ0 = rad(rot.lat)
  const Δλ = rad(p.lng - rot.lng)
  return Math.sin(φ0) * Math.sin(φ) + Math.cos(φ0) * Math.cos(φ) * Math.cos(Δλ)
}

/** True when the point is on the visible (near) hemisphere of the globe. */
export function isVisible(p: GeoPoint, rot: GlobeRotation): boolean {
  return cosAngularDistance(p, rot) > 0
}

/**
 * Orthographic projection of a geo point, relative to the sphere center, in
 * SVG user units (y down). Returns null when the point is on the far
 * hemisphere — callers must skip those markers entirely.
 */
export function projectGlobe(p: GeoPoint, rot: GlobeRotation, radius: number): { x: number; y: number } | null {
  if (!isVisible(p, rot)) return null
  const φ = rad(p.lat)
  const φ0 = rad(rot.lat)
  const Δλ = rad(p.lng - rot.lng)
  const x = Math.cos(φ) * Math.sin(Δλ)
  const yUp = Math.cos(φ0) * Math.sin(φ) - Math.sin(φ0) * Math.cos(φ) * Math.cos(Δλ)
  return { x: radius * x, y: -radius * yUp }
}

/** Normalized rotation for display (lat clamped, lng wrapped). */
export function displayRotation(rot: GlobeRotation): GlobeRotation {
  return { lat: clampLat(rot.lat), lng: normalizeLng(rot.lng) }
}
