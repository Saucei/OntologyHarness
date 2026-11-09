// Value-type registry — schema-level constraints for ontology properties.
// Constrained types enforce format AND range; primitives are always accepted.
export type ValueType = {
  id: string
  label: string
  description: string
  pattern?: RegExp
  min?: number
  max?: number
  kind: 'primitive' | 'constrained'
  sample: string
}

export const VALUE_TYPES: ValueType[] = [
  { id: 'String', label: 'String', description: 'Free text', kind: 'primitive', sample: 'Belgian Ale' },
  { id: 'Integer', label: 'Integer', description: 'Whole numbers', kind: 'primitive', pattern: /^-?\d+$/, sample: '40' },
  { id: 'Decimal', label: 'Decimal', description: 'Floating point', kind: 'primitive', pattern: /^-?\d+(\.\d+)?$/, sample: '6.2' },
  { id: 'Boolean', label: 'Boolean', description: 'true / false', kind: 'primitive', pattern: /^(true|false)$/i, sample: 'true' },
  { id: 'Timestamp', label: 'Timestamp', description: 'ISO-8601 instant', kind: 'primitive', pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, sample: '2026-11-04T10:18:00Z' },
  { id: 'ValueType/GeoPoint', label: 'GeoPoint', description: 'lat,lng · lat -90..90, lng -180..180', kind: 'constrained', pattern: /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/, sample: '40.7128,-74.0060' },
  { id: 'ValueType/Geohash', label: 'Geohash', description: 'geohash · 1–12 chars, base32 excl a/i/l/o', kind: 'constrained', pattern: /^[0-9b-hjkmnp-z]{1,12}$/i, sample: 'dqcjq' },
  { id: 'ValueType/WarehouseId', label: 'WarehouseId', description: 'WH-### · three digits', kind: 'constrained', pattern: /^WH-\d{3}$/, sample: 'WH-001' },
  { id: 'ValueType/MaterialId', label: 'MaterialId', description: 'MAT-#### · four digits', kind: 'constrained', pattern: /^MAT-\d{4}$/, sample: 'MAT-1042' },
  { id: 'ValueType/RecipeId', label: 'RecipeId', description: 'R-4 alphanumerics', kind: 'constrained', pattern: /^R-[A-Z0-9]{4}$/, sample: 'R-A4F2' },
  { id: 'ValueType/ProductId', label: 'ProductId', description: 'P-#### · four digits', kind: 'constrained', pattern: /^P-\d{4}$/, sample: 'P-0001' },
  { id: 'ValueType/CustomerId', label: 'CustomerId', description: 'C-#### · four digits', kind: 'constrained', pattern: /^C-\d{4}$/, sample: 'C-0030' },
  { id: 'ValueType/BatchId', label: 'BatchId', description: 'B-#### · four digits', kind: 'constrained', pattern: /^B-\d{4}$/, sample: 'B-1842' },
  { id: 'ValueType/ABV', label: 'ABV', description: 'Alcohol by volume · 0–15', kind: 'constrained', min: 0, max: 15, pattern: /^\d+(\.\d+)?$/, sample: '6.2' },
]

export const PRIMITIVES = VALUE_TYPES.filter(t => t.kind === 'primitive')

/** Validate a literal sample against a value type. Constrained types enforce pattern + range. */
export function validateValue(typeId: string, raw: string): { ok: boolean; error?: string } {
  const t = VALUE_TYPES.find(v => v.id === typeId)
  if (!t) return { ok: false, error: `unknown value type "${typeId}"` }
  const v = raw.trim()
  if (t.pattern && !t.pattern.test(v)) return { ok: false, error: `${t.label} expects ${t.description} — got "${v}"` }
  if (t.id === 'ValueType/GeoPoint') {
    const p = parseGeoPoint(v)
    if (!p) return { ok: false, error: `${t.label} expects lat,lng — got "${v}"` }
    if (p.lat < -90 || p.lat > 90) return { ok: false, error: `${t.label} latitude out of range -90..90 — got ${p.lat}` }
    if (p.lng < -180 || p.lng > 180) return { ok: false, error: `${t.label} longitude out of range -180..180 — got ${p.lng}` }
    return { ok: true }
  }
  if (t.id === 'ValueType/Geohash' && !isValidGeohash(v)) return { ok: false, error: `${t.label} expects ${t.description} — got "${v}"` }
  if (t.min !== undefined || t.max !== undefined) {
    const n = Number(v)
    if (Number.isNaN(n)) return { ok: false, error: `${t.label} expects a number — got "${v}"` }
    if (t.min !== undefined && n < t.min) return { ok: false, error: `${t.label} below minimum ${t.min}` }
    if (t.max !== undefined && n > t.max) return { ok: false, error: `${t.label} above maximum ${t.max}` }
  }
  return { ok: true }
}

/* ── Geo substrate (L2) ─────────────────────────────────────────── */
/** Geographic point as `{ lat, lng }` (decimal degrees). */
export type GeoPoint = { lat: number; lng: number }

const GEO_POINT_PATTERN = /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/
const GEOHASH_PATTERN = /^[0-9b-hjkmnp-z]{1,12}$/i
const GEOHASH_ALPHABET = '0123456789bcdefghjkmnpqrstuvwxyz'

/** Parse `"lat,lng"` text into a GeoPoint; returns null when unparseable. */
export function parseGeoPoint(raw: string): GeoPoint | null {
  const v = raw.trim()
  if (!GEO_POINT_PATTERN.test(v)) return null
  const [a, b] = v.split(',')
  const lat = Number(a.trim())
  const lng = Number(b.trim())
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null
  return { lat, lng }
}

/** Serialize a GeoPoint as `"lat,lng"`. */
export function formatGeoPoint(p: GeoPoint): string {
  return `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`
}

/** True when `raw` is a valid geohash (1–12 chars, base32 excl a/i/l/o). */
export function isValidGeohash(raw: string): boolean {
  return GEOHASH_PATTERN.test(raw.trim())
}

/** Encode a GeoPoint as a geohash of the given precision (1–12, default 6). */
export function encodeGeohash(lat: number, lng: number, precision = 6): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error('encodeGeohash: lat/lng must be finite')
  if (lat < -90 || lat > 90) throw new Error(`encodeGeohash: latitude out of range -90..90 — got ${lat}`)
  if (lng < -180 || lng > 180) throw new Error(`encodeGeohash: longitude out of range -180..180 — got ${lng}`)
  const prec = Math.min(12, Math.max(1, Math.floor(precision)))
  let latMin = -90, latMax = 90, lngMin = -180, lngMax = 180
  let hash = ''
  let evenBit = true
  while (hash.length < prec) {
    let cd = 0
    for (let i = 0; i < 5; i++) {
      if (evenBit) {
        const mid = (lngMin + lngMax) / 2
        if (lng >= mid) { cd |= 1 << (4 - i); lngMin = mid } else { lngMax = mid }
      } else {
        const mid = (latMin + latMax) / 2
        if (lat >= mid) { cd |= 1 << (4 - i); latMin = mid } else { latMax = mid }
      }
      evenBit = !evenBit
    }
    hash += GEOHASH_ALPHABET[cd]
  }
  return hash
}

/** Decode a geohash cell to its center point + error bounds (degrees). */
export function decodeGeohash(hash: string): { lat: number; lng: number; latError: number; lngError: number } {
  const h = hash.trim().toLowerCase()
  if (!isValidGeohash(h)) throw new Error(`decodeGeohash: invalid geohash "${hash}"`)
  let latMin = -90, latMax = 90, lngMin = -180, lngMax = 180
  let evenBit = true
  for (const ch of h) {
    const cd = GEOHASH_ALPHABET.indexOf(ch)
    if (cd === -1) throw new Error(`decodeGeohash: invalid geohash "${hash}"`)
    for (let i = 0; i < 5; i++) {
      const mask = 1 << (4 - i)
      if (evenBit) { if (cd & mask) lngMin = (lngMin + lngMax) / 2; else lngMax = (lngMin + lngMax) / 2 } else { if (cd & mask) latMin = (latMin + latMax) / 2; else latMax = (latMin + latMax) / 2 }
      evenBit = !evenBit
    }
  }
  return { lat: (latMin + latMax) / 2, lng: (lngMin + lngMax) / 2, latError: (latMax - latMin) / 2, lngError: (lngMax - lngMin) / 2 }
}

export type SchemaIssue = { severity: 'error' | 'warn'; where: string; message: string }
export function validateObjectType(ot: {
  id: string; name: string; backing: string; properties: { name: string; type: string; indexed: boolean }[]
}): SchemaIssue[] {
  const issues: SchemaIssue[] = []
  if (!ot.name.trim()) issues.push({ severity: 'error', where: ot.id, message: 'Object type has no name' })
  if (!/^[a-z0-9_/.-]+$/i.test(ot.backing)) issues.push({ severity: 'warn', where: ot.id, message: `backing "${ot.backing}" should be a lowercase project path` })
  const seen = new Map<string, number>()
  for (const p of ot.properties) {
    seen.set(p.name, (seen.get(p.name) ?? 0) + 1)
    if (!VALUE_TYPES.find(v => v.id === p.type)) issues.push({ severity: 'error', where: `${ot.id}.${p.name}`, message: `unknown value type "${p.type}"` })
  }
  for (const [name, count] of seen) if (count > 1) issues.push({ severity: 'error', where: ot.id, message: `duplicate property "${name}" ×${count}` })
  if (!ot.properties.some(p => p.indexed)) issues.push({ severity: 'warn', where: ot.id, message: 'no title/indexed property — search will be slow' })
  return issues
}
