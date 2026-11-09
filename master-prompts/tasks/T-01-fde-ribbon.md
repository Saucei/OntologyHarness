# T-01 — FDE Composer Ribbon + Count Chips

**Layer:** L4 · **Functions:** FN-FDE-004 · **Host:** AgentConsole
**Architecture:** `master-prompts/ARCHITECTURE_LAYERS.md` · **Plugins:** `ARCHITECTURE_PLUGINS.md`
**Harness prerequisites:** `HARNESS_CHANGE_MAP.md` — mode/skill bundles (L1 schema ext.) — static chips first, popovers from T-04 · **Goal:** `GOALS.md`

## Scope
Implement FN-FDE-004 in AgentConsole. mode/skill bundles (L1 schema ext.) — static chips first, popovers from T-04.

Files: src/modules/AgentConsole.tsx, src/data/presets.ts (preset.modes[]), tests.
Theme: glass tokens only, no new hues. Light+dark parity. `appendTrace` + `appendAudit` on every mutating action.
Ledger: after shipping, update `scripts/regen-inventory.mjs` for the function(s) above and re-run it; update `GOALS.md` status.
Parallel-safe: only edit the files listed under Files.

## Acceptance (must all pass)
- `npx tsc -b` clean
- `npx vitest run` green (add ≥2 tests for any new helper)
- Browser console clean in dev tab; reference tolerance ±2px vs corpus tiles where a visual exists
- Rollback: revert of this slice must leave the app buildable; no destructive schema moves without a memo in this file.
