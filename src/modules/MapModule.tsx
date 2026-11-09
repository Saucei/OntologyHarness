// Map module (unregistered substrate) — FN-GEO-001 detail + FN-GEO-003 + FN-GEO-002.
// Cluster-layer config panel + aggregated bubbles + metric cards over the map,
// plus the COP facet rail (count badges), brushable date histogram, and linked
// filtered-points table — clicking a facet filters map bubbles + table together.
// Deliberately NOT wired into the registry (prefer unregistered per T-19).
import { useMemo, useState } from 'react'
import MapCanvas, { ClusterLayerConfigPanel, DEFAULT_CLUSTER_CONFIG } from '../components/MapCanvas'
import type { ClusterLayerConfig, MapPoint } from '../components/MapCanvas'
import { GEO_FIXTURES } from '../data/geoFixtures'
import { filterPoints, EMPTY_SELECTION } from '../cop/facetEngine'
import type { FacetSelection } from '../cop/facetEngine'

/** Demo dispatches: geo fixtures + dispatch status for Successful/Cancelled/Diverted cards. */
// Deterministic dates spread across the reference window (corpus-2 COP tile, 2025-10-08).
const FIXTURE_DATES = [
  '2025-10-01T00:00:00Z',
  '2025-10-02T00:00:00Z',
  '2025-10-03T00:00:00Z',
  '2025-10-04T00:00:00Z',
  '2025-10-05T00:00:00Z',
  '2025-10-06T00:00:00Z',
  '2025-10-07T00:00:00Z',
  '2025-10-08T00:00:00Z',
]

export const DISPATCH_FIXTURES: MapPoint[] = [
  ...GEO_FIXTURES.map((f, i) => ({
    id: f.id,
    label: f.label,
    point: f.point,
    value: f.value,
    category: f.category,
    geohash: f.geohash,
    status: i === 5 ? ('Cancelled' as const) : i === 7 ? ('Diverted' as const) : ('Successful' as const),
    date: FIXTURE_DATES[i % FIXTURE_DATES.length],
  })),
]

export default function MapModule() {
  const [config, setConfig] = useState<ClusterLayerConfig>({ ...DEFAULT_CLUSTER_CONFIG, layerType: 'cluster', precision: 4 })
  const [facetSelection, setFacetSelection] = useState<FacetSelection>(() => ({ ...EMPTY_SELECTION }))
  const filteredCount = useMemo(() => filterPoints(DISPATCH_FIXTURES, facetSelection).length, [facetSelection])

  return (
    <div className="module fade-in">
      <div className="module-head glass-strong">
        <div>
          <div className="module-title">Geo map · cluster + bubbles</div>
          <div className="module-sub">{filteredCount}/{DISPATCH_FIXTURES.length} points · {config.layerType} · {config.aggregation} · p{config.precision} · {facetSelection.categories.length + facetSelection.statuses.length + (facetSelection.dateRange ? 1 : 0)} filters</div>
        </div>
      </div>
      <div style={{ marginBottom: 10 }}>
        <ClusterLayerConfigPanel config={config} onChange={setConfig} />
      </div>
      <MapCanvas
        points={DISPATCH_FIXTURES}
        title="Geo substrate map"
        config={config}
        onConfigChange={setConfig}
        facetSelection={facetSelection}
        onFacetChange={setFacetSelection}
        showFacetRail
        showTable
      />
    </div>
  )
}
