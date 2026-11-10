// Machinery helpers — FN-MCH-001/002/008 (failing-then-passing coverage).
import { describe, it, expect } from 'vitest'
import {
  getFixture, buildMachineryGraph, nodeTone, isTerminal, durationTone,
  formatDays, formatEdgeDays, formatDurationHours, formatCount,
  formatNodeMetricValue, formatEdgeMetricValue,
  cycleMetric, nextMetric, prevMetric, MACHINERY_METRICS,
  nodeWidthForValue, buildHistorySeries, mergePositions, summarizeFixture,
  expectedEdgeDurationDays, edgeDurationDays, computeDeviations, filterDeviations,
  buildZoomCard, zoomCenterForNode, computeSubprocessFrames,
  listMachineryPaths, toggleCheckedPath, pathHighlightSets, pathBarWidthPct,
  durationDomain, buildDurationHistogram, normalizeDurationRange, nodeInDurationRange,
  filterNodesByDurationRange, filterFixtureByDurationRange,
} from './mach'

describe('fixtures (corpus-2 tiles)', () => {
  it('Patient Journey carries tile durations 103/14/40/7/4 and terminal flags', () => {
    const f = getFixture('patient-journey')
    const byId = Object.fromEntries(f.nodes.map(n => [n.id, n]))
    expect(byId.referred.durationDays).toBe(103)
    expect(byId['on-waitlist'].durationDays).toBe(14)
    expect(byId.booked.durationDays).toBe(40)
    expect(byId.cancelled.durationDays).toBe(7)
    expect(byId['did-not-attend'].durationDays).toBe(4)
    expect(isTerminal(byId.cancelled)).toBe(true)
    expect(isTerminal(byId.booked)).toBe(false)
    expect(f.edges.some(e => e.id === 'e-waitlist-booked' && e.durationDays === 14)).toBe(true)
  })

  it('Approval Process carries tile counts and zoom durations', () => {
    const f = getFixture('approval-process')
    const byId = Object.fromEntries(f.nodes.map(n => [n.id, n]))
    expect(byId.draft.historicalCount).toBe(215)
    expect(byId.draft.currentCount).toBe(16)
    expect(byId.draft.durationHours).toBe(43) // 1d 19h
    expect(byId['in-review'].durationHours).toBe(775) // 32d 7h
    expect(byId.approved.historicalCount).toBe(58)
    expect(isTerminal(byId.approved)).toBe(true)
    expect(f.edges.find(e => e.id === 'e-draft-submitted')?.count).toBe(175)
  })
})

describe('formatting + terminal color coding (FN-MCH-001)', () => {
  it('formats node days, edge DAYS pills, and zoom hours', () => {
    expect(formatDays(103)).toBe('103 days')
    expect(formatDays(null)).toBe('--')
    expect(formatEdgeDays(40)).toBe('40 DAYS')
    expect(formatEdgeDays(undefined)).toBe('--')
    expect(formatDurationHours(43)).toBe('1d 19h')
    expect(formatDurationHours(775)).toBe('32d 7h')
    expect(formatDurationHours(null, null)).toBe('--')
    expect(formatCount(2128)).toBe('2,128')
    expect(formatCount(null)).toBe('--')
  })

  it('terminal states stay green even when long; non-terminals encode SLA', () => {
    const f = getFixture('patient-journey')
    const byId = Object.fromEntries(f.nodes.map(n => [n.id, n]))
    expect(nodeTone(byId.referred)).toBe('sla-breach') // 103d non-terminal
    expect(nodeTone(byId.booked)).toBe('sla-breach') // 40d non-terminal
    expect(nodeTone(byId['on-waitlist'])).toBe('sla-warn') // 14d non-terminal
    expect(nodeTone(byId.cancelled)).toBe('terminal-ok') // 7d terminal
    expect(nodeTone(byId.attended)).toBe('neutral') // terminal with no metric
    expect(durationTone(40)).toBe('sla-breach')
    expect(durationTone(14)).toBe('sla-warn')
    expect(durationTone(4)).toBe('ok')
    expect(durationTone(null)).toBe('neutral')
  })
})

describe('metric carousel (FN-MCH-002)', () => {
  it('orders Historical count | Current count | Historical duration and cycles', () => {
    expect(MACHINERY_METRICS.map(m => m.label)).toEqual(['Historical count', 'Current count', 'Historical duration'])
    expect(nextMetric('historical-count')).toBe('current-count')
    expect(nextMetric('current-count')).toBe('historical-duration')
    expect(nextMetric('historical-duration')).toBe('historical-count')
    expect(prevMetric('historical-count')).toBe('historical-duration')
    expect(cycleMetric('current-count', -1)).toBe('historical-count')
  })

  it('node + edge values switch with metric', () => {
    const f = getFixture('approval-process')
    const draft = f.nodes.find(n => n.id === 'draft')!
    expect(formatNodeMetricValue(draft, 'historical-count')).toBe('215')
    expect(formatNodeMetricValue(draft, 'current-count')).toBe('16')
    expect(formatNodeMetricValue(draft, 'historical-duration')).toBe('1d 19h')
    const edge = f.edges.find(e => e.id === 'e-draft-submitted')!
    expect(formatEdgeMetricValue(edge, 'historical-count')).toBe('175')
    expect(formatEdgeMetricValue(edge, 'historical-duration')).toBe('39 HRS')
    const patientEdge = getFixture('patient-journey').edges.find(e => e.id === 'e-booked-attended')!
    expect(formatEdgeMetricValue(patientEdge, 'historical-duration')).toBe('40 DAYS')
    expect(formatEdgeMetricValue(patientEdge, 'historical-count')).toBe('1,210')
  })
})

describe('graph builder + transition toggle (FN-MCH-008)', () => {
  it('transition nodes split every edge when on, vanish when off', () => {
    const on = buildMachineryGraph('patient-journey', 'historical-duration', true)
    const off = buildMachineryGraph('patient-journey', 'historical-duration', false)
    expect(off.nodes.filter(n => n.data.kind === 'transition')).toHaveLength(0)
    expect(on.nodes.filter(n => n.data.kind === 'transition')).toHaveLength(getFixture('patient-journey').edges.length)
    expect(on.edges.length).toBe(getFixture('patient-journey').edges.length * 2)
    expect(off.edges.length).toBe(getFixture('patient-journey').edges.length)
  })

  it('edge pills show DAYS in duration view and counts otherwise', () => {
    const dur = buildMachineryGraph('patient-journey', 'historical-duration', false)
    const waitlistBooked = dur.edges.find(e => e.id === 'e-waitlist-booked')!
    expect(waitlistBooked.label).toBe('14 DAYS')
    expect(waitlistBooked.data.tone).toBe('sla-warn')
    const cnt = buildMachineryGraph('approval-process', 'historical-count', false)
    expect(cnt.edges.find(e => e.id === 'e-draft-submitted')!.label).toBe('175')
  })

  it('node width encodes magnitude monotonically (Approval count view)', () => {
    expect(nodeWidthForValue(215, 215)).toBeGreaterThan(nodeWidthForValue(49, 215))
    expect(nodeWidthForValue(49, 215)).toBeGreaterThanOrEqual(150)
    expect(nodeWidthForValue(null, 215)).toBe(150)
    expect(nodeWidthForValue(215, 215)).toBeLessThanOrEqual(280)
  })

  it('history series ends at historicalCount and is deterministic', () => {
    const f = getFixture('approval-process')
    const draft = f.nodes.find(n => n.id === 'draft')!
    const a = buildHistorySeries(draft, 12)
    const b = buildHistorySeries(draft, 12)
    expect(a).toHaveLength(12)
    expect(a[11]).toBe(215)
    expect(a).toEqual(b)
    expect(buildHistorySeries(getFixture('patient-journey').nodes.find(n => n.id === 'attended')!)).toEqual([])
  })

  it('mergePositions preserves dragged positions across metric rebuilds', () => {
    const first = buildMachineryGraph('patient-journey', 'historical-count', false)
    const moved = first.nodes.map(n => (n.id === 'booked' ? { ...n, position: { x: 999, y: 999 } } : n))
    const rebuilt = buildMachineryGraph('patient-journey', 'historical-duration', false)
    const merged = mergePositions(moved, rebuilt.nodes)
    expect(merged.find(n => n.id === 'booked')!.position).toEqual({ x: 999, y: 999 })
    expect(merged.find(n => n.id === 'booked')!.data.metricValue).toBe('40 days')
  })

  it('summarizeFixture aggregates terminals and totals', () => {
    const s = summarizeFixture(getFixture('approval-process'))
    expect(s.nodeCount).toBe(5)
    expect(s.terminalCount).toBe(2)
    expect(s.totalHistorical).toBe(659)
    expect(s.totalCurrent).toBe(16 + 96 + 49 + 58)
  })
})

describe('deviation edges (FN-MCH-004)', () => {
  it('expected duration is the median of observed edge durations', () => {
    const f = getFixture('patient-journey') // 14,7,40,40,4 -> median 14
    expect(expectedEdgeDurationDays(f)).toBe(14)
    expect(edgeDurationDays(f.edges.find(e => e.id === 'e-booked-attended')!)).toBe(40)
    expect(edgeDurationDays(f.edges.find(e => e.id === 'e-referred-waitlist')!)).toBe(null)
  })

  it('flags far-from-median edges as deviations with delta stats', () => {
    const rows = computeDeviations(getFixture('patient-journey'))
    const byId = Object.fromEntries(rows.map(r => [r.edgeId, r]))
    expect(byId['e-booked-attended'].isDeviation).toBe(true) // 40 vs 14
    expect(byId['e-booked-attended'].deltaDays).toBe(26)
    expect(byId['e-waitlist-booked'].isDeviation).toBe(false) // exactly median
    expect(byId['e-booked-cancelled'].isDeviation).toBe(false) // 7 vs 14 (50%, not >50%)
  })

  it('segmented tabs filter All / Deviations / On time', () => {
    const rows = computeDeviations(getFixture('patient-journey'))
    expect(filterDeviations(rows, 'all')).toHaveLength(rows.length)
    expect(filterDeviations(rows, 'deviations').every(r => r.isDeviation)).toBe(true)
    expect(filterDeviations(rows, 'on-time').every(r => !r.isDeviation)).toBe(true)
    expect(filterDeviations(rows, 'deviations').length + filterDeviations(rows, 'on-time').length).toBe(rows.length)
  })

  it('graph builder dotted-styles deviation edges and filters them', () => {
    const dev = buildMachineryGraph('patient-journey', 'historical-duration', false, { deviationFilter: 'deviations' })
    expect(dev.edges.length).toBeGreaterThan(0)
    expect(dev.edges.length).toBeLessThan(getFixture('patient-journey').edges.length)
    expect(dev.edges.every(e => e.data.isDeviation === true)).toBe(true)
    expect(dev.edges.every(e => e.style.strokeDasharray === '6 4')).toBe(true)
    expect(dev.edges.every(e => e.style.stroke === 'var(--danger)')).toBe(true)
    const all = buildMachineryGraph('patient-journey', 'historical-duration', false, { deviationFilter: 'all' })
    expect(all.edges.length).toBe(getFixture('patient-journey').edges.length)
  })
})

describe('contextual zoom cards (FN-MCH-003)', () => {
  it('zoom card carries sub-state counts from outgoing edges', () => {
    const f = getFixture('patient-journey')
    const card = buildZoomCard(f, 'booked')!
    expect(card.label).toBe('booked')
    expect(card.subStates.map(s => s.nodeId).sort()).toEqual(['attended', 'cancelled', 'did-not-attend'])
    expect(card.subStates.find(s => s.nodeId === 'attended')!.count).toBe(1210)
    expect(card.outgoingEdgeIds).toHaveLength(3)
    expect(card.incomingEdgeIds).toContain('e-waitlist-booked')
  })

  it('zoom card for terminal has no sub-states; unknown node is null', () => {
    const f = getFixture('approval-process')
    expect(buildZoomCard(f, 'approved')!.subStates).toEqual([])
    expect(buildZoomCard(f, 'approved')!.terminal).toBe(true)
    expect(buildZoomCard(f, 'nope')).toBe(null)
  })

  it('zoomCenterForNode centers on the node with default zoom 1.1', () => {
    expect(zoomCenterForNode({ x: 100, y: 50 })).toEqual({ x: 210, y: 82, zoom: 1.1 })
    expect(zoomCenterForNode({ x: 0, y: 0 }, { zoom: 1.4 })).toEqual({ x: 110, y: 32, zoom: 1.4 })
  })
})

describe('subprocess frames (FN-MCH-007)', () => {
  it('groups Outpatient Activity nodes into one padded frame', () => {
    const f = getFixture('patient-journey')
    const frames = computeSubprocessFrames(f)
    const out = frames.find(fr => fr.label === 'Outpatient Activity [first]')!
    expect(out.nodeIds).toContain('on-waitlist')
    expect(out.nodeIds).toContain('booked')
    expect(out.nodeIds).toContain('attended')
    expect(out.bounds.width).toBeGreaterThan(0)
    expect(out.bounds.height).toBeGreaterThan(0)
    expect(out.bounds.x).toBeLessThanOrEqual(540)
    expect(out.bounds.x).toBeLessThanOrEqual(f.positions['on-waitlist'].x)
    expect(out.bounds.y).toBe(f.positions.cancelled.y - 24)
  })

  it('frames cover every member and respect custom padding', () => {
    const f = getFixture('patient-journey')
    const frames = computeSubprocessFrames(f, f.positions, { padding: 10 })
    for (const fr of frames) {
      for (const id of fr.nodeIds) {
        const p = f.positions[id]
        expect(p.x).toBeGreaterThanOrEqual(fr.bounds.x)
        expect(p.y).toBeGreaterThanOrEqual(fr.bounds.y)
        expect(p.x + 220).toBeLessThanOrEqual(fr.bounds.x + fr.bounds.width)
        expect(p.y + 64).toBeLessThanOrEqual(fr.bounds.y + fr.bounds.height)
      }
    }
    expect(frames.reduce((a, fr) => a + fr.nodeIds.length, 0)).toBe(f.nodes.length)
  })
})

describe('path explorer (FN-MCH-005)', () => {
  it('lists source-to-every-node paths with hops, durations and counts', () => {
    const f = getFixture('patient-journey')
    const paths = listMachineryPaths(f)
    expect(paths.length).toBe(7)
    const single = paths.find(p => p.nodeIds.length === 1)!
    expect(single.title).toBe('referred')
    expect(single.hopCount).toBe(0)
    expect(single.totalDurationDays).toBe(103)
    const direct = paths.find(p => p.title === 'referred → on waitlist')!
    expect(direct.edgeIds).toEqual(['e-referred-waitlist'])
    const long = paths.find(p => p.endNodeId === 'attended')!
    expect(long.nodeIds).toEqual(['referred', 'on-waitlist', 'booked', 'attended'])
    expect(long.hopCount).toBe(3)
    expect(long.totalDurationDays).toBe(103 + 14 + 40) // attended has no duration
    expect(long.terminal).toBe(true)
    expect(typeof long.id).toBe('string')
    // sorted count-desc
    for (let i = 1; i < paths.length; i++) {
      expect(paths[i].totalCount ?? 0).toBeLessThanOrEqual(paths[i - 1].totalCount ?? 0)
    }
  })

  it('approval paths title direct edges with an arrow and multi-hop with ellipsis', () => {
    const paths = listMachineryPaths(getFixture('approval-process'))
    expect(paths.length).toBe(7)
    expect(paths.some(p => p.title === 'Draft → Cancelled')).toBe(true)
    expect(paths.some(p => p.title === 'Draft ••• Approved')).toBe(true)
    const toApproved = paths.find(p => p.title === 'Draft ••• Approved')!
    expect(toApproved.nodeIds).toEqual(['draft', 'submitted', 'in-review', 'approved'])
    expect(toApproved.flowCount).toBe(58)
    expect(toApproved.totalCount).toBe(58)
    expect(toApproved.totalDurationDays).toBeCloseTo(43 / 24 + 39 / 24 + 775 / 24, 1)
  })

  it('checked toggle + highlight sets union checked and selected paths', () => {
    const paths = listMachineryPaths(getFixture('approval-process'))
    const cancelled = paths.find(p => p.title === 'Draft → Cancelled')!
    expect(toggleCheckedPath([], cancelled.id)).toEqual([cancelled.id])
    expect(toggleCheckedPath([cancelled.id], cancelled.id)).toEqual([])
    const hl = pathHighlightSets(paths, [cancelled.id], null)
    expect(hl.nodeIds.has('draft')).toBe(true)
    expect(hl.edgeIds.has('e-draft-cancelled')).toBe(true)
    expect(hl.nodeIds.has('approved')).toBe(false)
    const empty = pathHighlightSets(paths, [], null)
    expect(empty.nodeIds.size).toBe(0)
    expect(empty.edgeIds.size).toBe(0)
    const sel = pathHighlightSets(paths, [], cancelled.id)
    expect(sel.nodeIds.has('cancelled')).toBe(true)
  })

  it('path bars scale monotonically against the max', () => {
    expect(pathBarWidthPct(100, 100)).toBe(100)
    expect(pathBarWidthPct(50, 100)).toBe(50)
    expect(pathBarWidthPct(null, 100)).toBe(0)
    expect(pathBarWidthPct(200, 100)).toBe(100)
    expect(pathBarWidthPct(0, 0)).toBe(2)
  })
})

describe('duration histogram + brush filter (FN-MCH-006)', () => {
  it('domain spans min..max node durations and bins cover every dated node', () => {
    const f = getFixture('patient-journey') // 103, 14, 40, 7, null, 4
    expect(durationDomain(f.nodes)).toEqual([4, 103])
    const bins = buildDurationHistogram(f.nodes, 12)
    expect(bins).toHaveLength(12)
    expect(bins.reduce((a, b) => a + b.count, 0)).toBe(5)
    expect(bins[0].start).toBe(4)
    expect(bins[bins.length - 1].end).toBeCloseTo(103, 6)
    expect(durationDomain(getFixture('patient-journey').nodes.filter(n => n.id === 'attended'))).toBe(null)
    expect(buildDurationHistogram(getFixture('patient-journey').nodes.filter(n => n.id === 'attended'))).toEqual([])
  })

  it('null range keeps everything; a set range excludes unknown durations', () => {
    const f = getFixture('patient-journey')
    expect(filterNodesByDurationRange(f.nodes, null)).toHaveLength(6)
    const kept = filterNodesByDurationRange(f.nodes, [0, 14])
    expect(kept.map(n => n.id).sort()).toEqual(['cancelled', 'did-not-attend', 'on-waitlist'])
    expect(nodeInDurationRange(f.nodes.find(n => n.id === 'attended')!, [0, 999])).toBe(false)
    expect(nodeInDurationRange(f.nodes.find(n => n.id === 'attended')!, null)).toBe(true)
    const narrowed = filterFixtureByDurationRange(f, [0, 14])
    expect(narrowed.nodes.map(n => n.id).sort()).toEqual(['cancelled', 'did-not-attend', 'on-waitlist'])
    expect(narrowed.edges.every(e => narrowed.nodes.some(n => n.id === e.source) && narrowed.nodes.some(n => n.id === e.target))).toBe(true)
  })

  it('normalize clamps out-of-domain ranges and keeps null null', () => {
    expect(normalizeDurationRange(null, [4, 103])).toBe(null)
    expect(normalizeDurationRange([-50, 500], [4, 103])).toEqual([4, 103])
    expect(normalizeDurationRange([50, 10], [4, 103])).toEqual([10, 50])
    expect(normalizeDurationRange([10, 20], null)).toBe(null)
  })
})
