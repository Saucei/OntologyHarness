# T-16 — Machinery Zooms, Deviations, Subprocesses

**Layer:** L3 · **Functions:** FN-MCH-003, FN-MCH-004, FN-MCH-007 · **Host:** GraphCanvas machinery mode
**Architecture:** `master-prompts/ARCHITECTURE_LAYERS.md` · **Plugins:** `ARCHITECTURE_PLUGINS.md`
**Harness prerequisites:** `HARNESS_CHANGE_MAP.md` — deviation/path computations · **Goal:** `GOALS.md`

## Scope
Implement FN-MCH-003, FN-MCH-004, FN-MCH-007 in GraphCanvas machinery mode. deviation/path computations.

Files: contextual zoom cards, deviation edges + segmented, subprocess frames, tests.
Theme: glass tokens only, no new hues. Light+dark parity. `appendTrace` + `appendAudit` on every mutating action.
Ledger: after shipping, update `scripts/regen-inventory.mjs` for the function(s) above and re-run it; update `GOALS.md` status.
Parallel-safe: only edit the files listed under Files.

## Acceptance (must all pass)
- `npx tsc -b` clean
- `npx vitest run` green (add ≥2 tests for any new helper)
- Browser console clean in dev tab; reference tolerance ±2px vs corpus tiles where a visual exists
- Rollback: revert of this slice must leave the app buildable; no destructive schema moves without a memo in this file.
