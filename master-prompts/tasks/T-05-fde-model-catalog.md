# T-05 — Model Catalog Picker + Reasoning Tier + Keyboard Protocol

**Layer:** L0/L1 · **Functions:** FN-FDE-009, FN-FDE-010 · **Host:** ProvidersModule
**Architecture:** `master-prompts/ARCHITECTURE_LAYERS.md` · **Plugins:** `ARCHITECTURE_PLUGINS.md`
**Harness prerequisites:** `HARNESS_CHANGE_MAP.md` — model catalog API (Palantir/Registered/More) — L0 only · **Goal:** `GOALS.md`

## Scope
Implement FN-FDE-009, FN-FDE-010 in ProvidersModule. model catalog API (Palantir/Registered/More) — L0 only.

Files: src/llm/client.ts (catalog + tier presets), ProvidersModule detail pane, AgentConsole tier pill, tests.
Theme: glass tokens only, no new hues. Light+dark parity. `appendTrace` + `appendAudit` on every mutating action.
Ledger: after shipping, update `scripts/regen-inventory.mjs` for the function(s) above and re-run it; update `GOALS.md` status.
Parallel-safe: only edit the files listed under Files.

## Acceptance (must all pass)
- `npx tsc -b` clean
- `npx vitest run` green (add ≥2 tests for any new helper)
- Browser console clean in dev tab; reference tolerance ±2px vs corpus tiles where a visual exists
- Rollback: revert of this slice must leave the app buildable; no destructive schema moves without a memo in this file.
