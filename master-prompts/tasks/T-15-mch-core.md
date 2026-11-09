# T-15 — Machinery State-Graph Core

**Layer:** L2/L3 · **Functions:** FN-MCH-001, FN-MCH-002, FN-MCH-008 · **Host:** GraphCanvas (Machinery mode)
**Architecture:** `master-prompts/ARCHITECTURE_LAYERS.md` · **Plugins:** `ARCHITECTURE_PLUGINS.md`
**Harness prerequisites:** `HARNESS_CHANGE_MAP.md` — duration metrics on nodes/edges + metric carousel · **Goal:** `GOALS.md`

## Scope
Implement FN-MCH-001, FN-MCH-002, FN-MCH-008 in GraphCanvas (Machinery mode). duration metrics on nodes/edges + metric carousel.

Files: GraphCanvas machinery mode, carousel, transition toggle, tests.
Theme: glass tokens only, no new hues. Light+dark parity. `appendTrace` + `appendAudit` on every mutating action.
Ledger: after shipping, update `scripts/regen-inventory.mjs` for the function(s) above and re-run it; update `GOALS.md` status.
Parallel-safe: only edit the files listed under Files.

## Acceptance (must all pass)
- `npx tsc -b` clean
- `npx vitest run` green (add ≥2 tests for any new helper)
- Browser console clean in dev tab; reference tolerance ±2px vs corpus tiles where a visual exists
- Rollback: revert of this slice must leave the app buildable; no destructive schema moves without a memo in this file.
