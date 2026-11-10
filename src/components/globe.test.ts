// globe.ts pure math tests (T-36) — spherical trig must agree with d3-geo.
import { describe, it, expect } from 'vitest'
import { geoOrthographic } from 'd3-geo'
import {
  clampLat,
  normalizeLng,
  sanitizeRotation,
  rotationFromDrag,
  isVisible,
  cosAngularDistance,
  projectGlobe,
  displayRotation,
  GLOBE_DEG_PER_PX,
} from './globe'

describe('globe math (T-36 fully-traversable orthographic globe)', () => {
  it('clamps latitude to the poles and wraps longitude into (-180, 180]', () => {
    expect(clampLat(95)).toBe(90)
    expect(clampLat(-95)).toBe(-90)
    expect(clampLat(Number.NaN)).toBe(0)
    expect(normalizeLng(370)).toBe(10)
    expect(normalizeLng(-190)).toBe(170)
    expect(normalizeLng(-180)).toBe(180)
    expect(normalizeLng(Number.NaN)).toBe(0)
  })

  it('sanitizes garbage rotations defensively', () => {
    expect(sanitizeRotation(null)).toEqual({ lat: 0, lng: 0 })
    expect(sanitizeRotation({ lat: 120, lng: 400 })).toEqual({ lat: 90, lng: 400 })
    expect(displayRotation({ lat: 120, lng: 400 })).toEqual({ lat: 90, lng: 40 })
  })

  it('maps drag deltas to rotation: pull right → center west, pull down → center north', () => {
    expect(rotationFromDrag({ lat: 0, lng: 0 }, 100, -50)).toEqual({ lat: -20, lng: -40 })
    expect(rotationFromDrag({ lat: 0, lng: 0 }, 0, 0)).toEqual({ lat: 0, lng: 0 })
    expect(rotationFromDrag({ lat: 0, lng: 0 }, 0, 500).lat).toBe(90)
    expect(rotationFromDrag({ lat: 0, lng: 0 }, 0, -500).lat).toBe(-90)
    expect(GLOBE_DEG_PER_PX).toBeGreaterThan(0)
  })

  it('visibility: near hemisphere true, antipode false, poles reachable at lat ±90', () => {
    const rot = { lat: 0, lng: 0 }
    expect(isVisible({ lat: 0, lng: 0 }, rot)).toBe(true)
    expect(isVisible({ lat: 0, lng: 90 }, rot)).toBe(true)
    expect(isVisible({ lat: 0, lng: 180 }, rot)).toBe(false)
    expect(isVisible({ lat: 0, lng: -180 }, rot)).toBe(false)
    // Pole traversal: centering on the north pole brings polar points near-side.
    const north = { lat: 90, lng: 0 }
    expect(isVisible({ lat: 89, lng: 0 }, north)).toBe(true)
    expect(isVisible({ lat: -89, lng: 0 }, north)).toBe(false)
  })

  it('cosAngularDistance is 1 at center, -1 at antipode, 0 at the horizon', () => {
    const rot = { lat: 0, lng: 0 }
    expect(cosAngularDistance({ lat: 0, lng: 0 }, rot)).toBeCloseTo(1, 9)
    expect(cosAngularDistance({ lat: 0, lng: 180 }, rot)).toBeCloseTo(-1, 9)
    expect(cosAngularDistance({ lat: 0, lng: 90 }, rot)).toBeCloseTo(0, 9)
    expect(cosAngularDistance({ lat: 0, lng: -90 }, rot)).toBeCloseTo(0, 9)
  })

  it('projects the view center to the sphere center and the equator 90° east to +x', () => {
    const rot = { lat: 0, lng: 0 }
    const center = projectGlobe({ lat: 0, lng: 0 }, rot, 44)!
    expect(center.x).toBeCloseTo(0, 9)
    expect(center.y).toBeCloseTo(0, 9)
    const east = projectGlobe({ lat: 0, lng: 90 }, rot, 44)
    expect(east).not.toBeNull()
    expect(east!.x).toBeCloseTo(44, 6)
    expect(east!.y).toBeCloseTo(0, 6)
    const north = projectGlobe({ lat: 90, lng: 0 }, rot, 44)
    expect(north!.x).toBeCloseTo(0, 6)
    expect(north!.y).toBeCloseTo(-44, 6)
  })

  it('returns null for far-hemisphere points so callers can cull markers', () => {
    expect(projectGlobe({ lat: 0, lng: 180 }, { lat: 0, lng: 0 }, 44)).toBeNull()
    expect(projectGlobe({ lat: -10, lng: 0 }, { lat: 89, lng: 0 }, 44)).toBeNull()
  })

  it('agrees with d3-geo geoOrthographic (same formulas, independent check)', () => {
    const rot = { lat: 22, lng: -37 }
    const R = 44
    const d3 = geoOrthographic().rotate([-rot.lng, -rot.lat]).translate([0, 0]).scale(R)
    for (const p of [
      { lat: 0, lng: 0 },
      { lat: 45, lng: 15 },
      { lat: -30, lng: 20 },
      { lat: 60, lng: -100 },
    ]) {
      expect(isVisible(p, rot)).toBe(true)
      const mine = projectGlobe(p, rot, R)!
      const theirs = d3([p.lng, p.lat]) as [number, number]
      expect(Math.abs(mine.x - theirs[0])).toBeLessThan(1e-6)
      expect(Math.abs(mine.y - theirs[1])).toBeLessThan(1e-6)
    }
  })
})
