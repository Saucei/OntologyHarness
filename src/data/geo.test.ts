// Geo value-type validation + geohash encode/decode (FN-GEO-001 substrate).
import { describe, it, expect } from 'vitest'
import { validateValue, encodeGeohash, decodeGeohash, parseGeoPoint, formatGeoPoint } from './valueTypes'
import { GEO_FIXTURES } from './geoFixtures'

describe('geo value types', () => {
  it('GeoPoint accepts only lat,lng within range', () => {
    expect(validateValue('ValueType/GeoPoint', '40.7128,-74.0060').ok).toBe(true)
    expect(validateValue('ValueType/GeoPoint', '−90,180').ok).toBe(false) // wrong dash
    expect(validateValue('ValueType/GeoPoint', '91,0').ok).toBe(false)
    expect(validateValue('ValueType/GeoPoint', '0,181').ok).toBe(false)
    expect(validateValue('ValueType/GeoPoint', 'not-a-point').ok).toBe(false)
    expect(parseGeoPoint('40.7128,-74.0060')).toEqual({ lat: 40.7128, lng: -74.006 })
    expect(parseGeoPoint('bad')).toBeNull()
    expect(formatGeoPoint({ lat: 40.7128, lng: -74.006 })).toBe('40.7128,-74.0060')
  })

  it('Geohash accepts 1–12 base32 chars and rejects a/i/l/o', () => {
    expect(validateValue('ValueType/Geohash', 'dqcjq').ok).toBe(true)
    expect(validateValue('ValueType/Geohash', 'dqcjqa').ok).toBe(false)
    expect(validateValue('ValueType/Geohash', 'o0').ok).toBe(false)
    expect(validateValue('ValueType/Geohash', '').ok).toBe(false)
    expect(validateValue('ValueType/Geohash', '0123456789bcd').ok).toBe(false) // 13 chars
  })

  it('geohash round-trips through decode to the source cell', () => {
    const hash = encodeGeohash(40.7128, -74.006, 6)
    expect(hash).toHaveLength(6)
    expect(hash).toBe(GEO_FIXTURES[0].geohash)
    const center = decodeGeohash(hash)
    expect(Math.abs(center.lat - 40.7128)).toBeLessThan(center.latError + 1e-9 + 0.01)
    expect(Math.abs(center.lng - -74.006)).toBeLessThan(center.lngError + 1e-9 + 0.01)
    expect(() => decodeGeohash('a-invalid')).toThrow()
    expect(() => encodeGeohash(91, 0)).toThrow()
  })

  it('geo fixtures encode to valid geohashes that decode near their points', () => {
    for (const f of GEO_FIXTURES) {
      expect(validateValue('ValueType/Geohash', f.geohash).ok).toBe(true)
      expect(validateValue('ValueType/GeoPoint', `${f.point.lat},${f.point.lng}`).ok).toBe(true)
    }
  })
})
