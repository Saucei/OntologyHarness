# T-19 — Cluster Layers + Bubble/Metric Cards

**Layer:** L3 · **Functions:** FN-GEO-001, FN-GEO-003 · **Host:** Map module
**Architecture:** `master-prompts/ARCHITECTURE_LAYERS.md` · **Plugins:** `ARCHITECTURE_PLUGINS.md`
**Harness prerequisites:** `HARNESS_CHANGE_MAP.md` — cluster render + legend from T-18 · **Goal:** `GOALS.md`

## Scope
Implement FN-GEO-001, FN-GEO-003 in Map module. cluster render + legend from T-18.

Files: cluster-layer config panel, bubbles + legend, metric cards, tests.
Theme: glass tokens only, no new hues. Light+dark parity. `appendTrace` + `appendAudit` on every mutating action.
Ledger: after shipping, update `scripts/regen-inventory.mjs` for the function(s) above and re-run it; update `GOALS.md` status.
Parallel-safe: only edit the files listed under Files.

## Acceptance (must all pass)
- `npx tsc -b` clean
- `npx vitest run` green (add ≥2 tests for any new helper)
- Browser console clean in dev tab; reference tolerance ±2px vs corpus tiles where a visual exists
- Rollback: revert of this slice must leave the app buildable; no destructive schema moves without a memo in this file.
