// T-33 seed-revision migration — replaces stale brewery-era seed data ONCE.
// Existing installs keep old localStorage rows (jobs/objectTypes) forever; bumping
// SEEDS_REV re-seeds them from the current canonical seeds so de-seeded content
// (Belgian Ale) actually disappears for existing users. Persisted as
// `meta.seedsRev` so it works identically in browser (localStorage) and Tauri (SQLite).
import { OBJECT_TYPES } from './ontology'
import { SEED as SEED_JOBS } from '../jobs'
import { ws, patchMeta, setJobs, setObjectTypes } from '../store'

/** Bump when canonical seeds change in a way existing installs must pick up. */
export const SEEDS_REV = 2

/** True when a migration ran this boot. */
export function runSeedMigration(): boolean {
  if (!ws.hydrated) return false
  if ((ws.meta?.seedsRev ?? 0) >= SEEDS_REV) return false
  setJobs(SEED_JOBS.map(j => ({ ...j, tags: [...j.tags], activity: [...j.activity], attachments: [...j.attachments] })))
  setObjectTypes(OBJECT_TYPES.map(t => ({ ...t, properties: t.properties.map(p => ({ ...p })) })))
  patchMeta({ seedsRev: SEEDS_REV })
  return true
}
