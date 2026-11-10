// T-33 seed-revision migration tests — existing installs drop brewery-era rows once.
import { describe, it, expect } from 'vitest'
import { runSeedMigration, SEEDS_REV } from './seedMigration'
import { ws } from '../store'

describe('T-33 seed-revision migration', () => {
  it('re-seeds jobs + objectTypes once, then no-ops', () => {
    ws.hydrated = true
    ws.meta = {}
    expect(runSeedMigration()).toBe(true)
    expect(ws.meta.seedsRev).toBe(SEEDS_REV)
    // No brewery-era content survives.
    expect(ws.jobs.some(j => /belgian|brewery|\bipa\b/i.test(j.title))).toBe(false)
    expect(ws.objectTypes.some(t => t.id === 'ot-recipe')).toBe(false)
    // Automotive seeds present.
    expect(ws.jobs.some(j => j.title.includes('supplier CSV'))).toBe(true)
    expect(ws.objectTypes[0].name).toBe('Distribution Center')
    expect(ws.objectTypes.some(t => t.id === 'ot-process')).toBe(true)
    // Idempotent.
    expect(runSeedMigration()).toBe(false)
  })

  it('skips when already migrated', () => {
    ws.hydrated = true
    ws.meta = { seedsRev: SEEDS_REV }
    expect(runSeedMigration()).toBe(false)
  })

  it('refuses to run before hydration', () => {
    const wasHydrated = ws.hydrated
    ws.hydrated = false
    expect(runSeedMigration()).toBe(false)
    ws.hydrated = wasHydrated
  })
})
