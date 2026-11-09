// Cop facet engine — pure helpers for the COP facet rail (FN-GEO-002 / T-20).
// No React, no DOM, no store imports. All functions are total and side-effect free.
// Consumers: MapCanvas FacetRail + HistogramBrush + linked table (MapModule COP view).
// Glass tokens + light/dark parity live in the view layer, not here.

/** Minimal shape a point needs to participate in faceted filtering. */
export type FacetablePoint = {
  id: string
  label?: string
  category?: string
  status?: string
  /** ISO date string, epoch ms, or Date. Points without a parseable date are
   *  never excluded by a null range, but ARE excluded once a concrete date
   *  range is set (they cannot be proven in-range). */
  date?: string | number | Date
  value?: number
}

export type Facet = { value: string; count: number; totalValue: number }
export type FacetGroups = { categories: Facet[]; statuses: Facet[] }
export type DateRange = [number, number] | null

export type FacetSelection = {
  /** Empty array = no category filter (all categories pass). */
  categories: string[]
  /** Empty array = no status filter (all statuses pass). */
  statuses: string[]
  /** Null = no date filter (all dates pass). */
  dateRange: DateRange
}

export const EMPTY_SELECTION: FacetSelection = { categories: [], statuses: [], dateRange: null }

/** Parse any supported date value to epoch ms; null when unparseable. */
export function toEpoch(date?: string | number | Date | null): number | null {
  if (date === null || date === undefined || date === '') return null
  if (date instanceof Date) {
    const t = date.getTime()
    return Number.isFinite(t) ? t : null
  }
  if (typeof date === 'number') {
    return Number.isFinite(date) ? date : null
  }
  const t = Date.parse(String(date))
  return Number.isFinite(t) ? t : null
}

/** Epoch ms for a point, or null when it has no parseable date. */
export function pointTime(p: FacetablePoint): number | null {
  return toEpoch(p.date)
}

/** Min/max epoch across dated points; null when no point has a parseable date. */
export function dataTimeDomain(points: FacetablePoint[]): [number, number] | null {
  let lo = Infinity
  let hi = -Infinity
  let seen = false
  for (const p of points) {
    const t = pointTime(p)
    if (t === null) continue
    seen = true
    if (t < lo) lo = t
    if (t > hi) hi = t
  }
  return seen ? [lo, hi] : null
}

function bucketFacets(rows: Array<{ value: string; amount: number }>): Facet[] {
  const map = new Map<string, Facet>()
  for (const r of rows) {
    const f = map.get(r.value) ?? { value: r.value, count: 0, totalValue: 0 }
    f.count += 1
    f.totalValue += r.amount
    map.set(r.value, f)
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
}

/** Raw facet groups with count badges + summed value, sorted count-desc then alpha. */
export function buildFacets(points: FacetablePoint[]): FacetGroups {
  const cats: Array<{ value: string; amount: number }> = []
  const stats: Array<{ value: string; amount: number }> = []
  for (const p of points) {
    const amount = Math.max(0, Number(p.value) || 0)
    if (p.category !== undefined && String(p.category) !== '') cats.push({ value: String(p.category), amount })
    if (p.status !== undefined && String(p.status) !== '') stats.push({ value: String(p.status), amount })
  }
  return { categories: bucketFacets(cats), statuses: bucketFacets(stats) }
}

/**
 * Selection-aware facet groups: each dimension's counts respect the OTHER
 * dimensions' active filters (standard faceted-search behavior), so badges
 * stay useful while a filter is active. Date range applies to both.
 */
export function buildSelectionAwareFacets(points: FacetablePoint[], sel: Partial<FacetSelection>): FacetGroups {
  const categories = sel.categories ?? []
  const statuses = sel.statuses ?? []
  const range = sel.dateRange ?? null
  const passesDate = (p: FacetablePoint) => {
    if (!range) return true
    const t = pointTime(p)
    return t !== null && t >= range[0] && t <= range[1]
  }
  const cats: Array<{ value: string; amount: number }> = []
  const stats: Array<{ value: string; amount: number }> = []
  for (const p of points) {
    if (!passesDate(p)) continue
    const amount = Math.max(0, Number(p.value) || 0)
    const cat = p.category === undefined ? '' : String(p.category)
    const stat = p.status === undefined ? '' : String(p.status)
    if ((statuses.length === 0 || statuses.includes(stat)) && cat !== '') cats.push({ value: cat, amount })
    if ((categories.length === 0 || categories.includes(cat)) && stat !== '') stats.push({ value: stat, amount })
  }
  return { categories: bucketFacets(cats), statuses: bucketFacets(stats) }
}

/** True when any dimension actively filters. */
export function isFiltered(sel: Partial<FacetSelection>): boolean {
  return (sel.categories?.length ?? 0) > 0 || (sel.statuses?.length ?? 0) > 0 || sel.dateRange !== null
}

/** Filter points by facet selection (category AND status AND date-range, all inclusive). */
export function filterPoints<T extends FacetablePoint>(points: T[], sel: Partial<FacetSelection>): T[] {
  const categories = sel.categories ?? []
  const statuses = sel.statuses ?? []
  const range = sel.dateRange ?? null
  return points.filter(p => {
    const cat = p.category === undefined ? '' : String(p.category)
    const stat = p.status === undefined ? '' : String(p.status)
    if (categories.length && !categories.includes(cat)) return false
    if (statuses.length && !statuses.includes(stat)) return false
    if (range) {
      const t = pointTime(p)
      if (t === null || t < range[0] || t > range[1]) return false
    }
    return true
  })
}

/** Toggle a facet value in a list (returns a new array, input untouched). */
export function toggleFacetValue(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter(v => v !== value) : [...list, value]
}

/** Clamp/normalize a candidate range into a domain; null stays null. */
export function clampDateRange(range: DateRange, domain: [number, number] | null): DateRange {
  if (!range || !domain) return null
  const lo = Math.min(domain[0], domain[1])
  const hi = Math.max(domain[0], domain[1])
  const a = Math.min(hi, Math.max(lo, Number(range[0])))
  const b = Math.min(hi, Math.max(lo, Number(range[1])))
  return [Math.min(a, b), Math.max(a, b)]
}

export type HistogramBin = { start: number; end: number; count: number }

/** Equal-width histogram bins over the dated points; [] when no dated points. */
export function buildHistogramBins(points: FacetablePoint[], binCount = 12, domain?: [number, number] | null): HistogramBin[] {
  const dom = domain ?? dataTimeDomain(points)
  if (!dom) return []
  const bins = Math.min(60, Math.max(1, Math.floor(binCount) || 12))
  const lo = Math.min(dom[0], dom[1])
  const hi = Math.max(dom[0], dom[1])
  const span = hi - lo || 1
  const width = span / bins
  const out: HistogramBin[] = Array.from({ length: bins }, (_, i) => ({
    start: lo + i * width,
    end: lo + (i + 1) * width,
    count: 0,
  }))
  for (const p of points) {
    const t = pointTime(p)
    if (t === null) continue
    let idx = Math.floor((t - lo) / width)
    if (t === hi) idx = bins - 1
    if (idx < 0 || idx >= bins) continue
    out[idx].count += 1
  }
  return out
}

/* ── Map-table linkage selection ─────────────────────────────────── */

/** Find the linked point by id, or null (e.g. selection filtered out). */
export function resolveLinkedSelection<T extends FacetablePoint>(points: T[], selectedId: string | null | undefined): T | null {
  if (!selectedId) return null
  return points.find(p => p.id === selectedId) ?? null
}

/** Facet values of the linked point — used to highlight matching rail checkboxes. */
export function linkedFacetValues(p: FacetablePoint | null): { category: string | null; status: string | null } {
  if (!p) return { category: null, status: null }
  return {
    category: p.category === undefined || String(p.category) === '' ? null : String(p.category),
    status: p.status === undefined || String(p.status) === '' ? null : String(p.status),
  }
}

/** Ids to highlight in the table (just the linked id when it survives filtering). */
export function highlightedIds(filtered: FacetablePoint[], selectedId: string | null | undefined): string[] {
  const linked = resolveLinkedSelection(filtered, selectedId)
  return linked ? [linked.id] : []
}
