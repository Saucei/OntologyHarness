# T-18 — Map Component + Geo Typing (harness change)

**Layer:** L2/L3 · **Functions:** FN-GEO-001 (substrate) · **Host:** new Map module / GraphCanvas mode
**Architecture:** `master-prompts/ARCHITECTURE_LAYERS.md` · **Plugins:** `ARCHITECTURE_PLUGINS.md`
**Harness prerequisites:** `HARNESS_CHANGE_MAP.md` — GeoPoint/Geohash value types (L2) + MapCanvas (L3) · **Goal:** `GOALS.md`

## Scope
Implement FN-GEO-001 (substrate) in new Map module / GraphCanvas mode. GeoPoint/Geohash value types (L2) + MapCanvas (L3).

Files: valueTypes.ts geo, MapCanvas.tsx, geo test fixtures, tests.
Theme: glass tokens only, no new hues. Light+dark parity. `appendTrace` + `appendAudit` on every mutating action.
Ledger: after shipping, update `scripts/regen-inventory.mjs` for the function(s) above and re-run it; update `GOALS.md` status.
Parallel-safe: only edit the files listed under Files.

## Acceptance (must all pass)
- `npx tsc -b` clean
- `npx vitest run` green (add ≥2 tests for any new helper)
- Browser console clean in dev tab; reference tolerance ±2px vs corpus tiles where a visual exists
- Rollback: revert of this slice must leave the app buildable; no destructive schema moves without a memo in this file.
