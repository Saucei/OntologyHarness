// Geo fixtures — sample points for MapCanvas (FN-GEO-001 substrate).
// Lattice of warehouse / customer sites used by MapCanvas tests + T-19 cluster work.
import { encodeGeohash } from './valueTypes'
import type { GeoPoint } from './valueTypes'

export type GeoFixture = {
  id: string
  label: string
  point: GeoPoint
  /** Aggregation weight (e.g. bbl demand or site count). */
  value: number
  category: string
  geohash: string
}

const seed: Array<[string, string, GeoPoint, number, string]> = [
  ['site-nyc', 'NYC Ale · Warehouse 1', { lat: 40.7128, lng: -74.0060 }, 220.77, 'Recipe'],
  ['site-dc', 'DC Ale', { lat: 38.9072, lng: -77.0369 }, 96.4, 'Recipe'],
  ['site-pit', 'PIT Ale', { lat: 40.4406, lng: -79.9959 }, 171.2, 'Recipe'],
  ['site-ewr', 'Newark Malt', { lat: 40.7357, lng: -74.1724 }, 88.1, 'Raw Material'],
  ['site-iad', 'Dulles Hops', { lat: 38.9537, lng: -77.4489 }, 64.9, 'Raw Material'],
  ['site-cle', 'Cleveland Corn', { lat: 41.4993, lng: -81.6944 }, 42.3, 'Raw Material'],
  ['site-bos', 'Boston Customer', { lat: 42.3601, lng: -71.0589 }, 73.6, 'Customer'],
  ['site-chi', 'Chicago Customer', { lat: 41.8781, lng: -87.6298 }, 58.2, 'Customer'],
]

export const GEO_FIXTURES: GeoFixture[] = seed.map(([id, label, point, value, category]) => ({
  id,
  label,
  point,
  value,
  category,
  geohash: encodeGeohash(point.lat, point.lng, 6),
}))
