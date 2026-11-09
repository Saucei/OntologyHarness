# T-06 — Prompt Template Gallery (Classification/Sentiment/…)

**Layer:** L1 · **Functions:** FN-FDE-012 · **Host:** AgentConsole or Presets
**Architecture:** `master-prompts/ARCHITECTURE_LAYERS.md` · **Plugins:** `ARCHITECTURE_PLUGINS.md`
**Harness prerequisites:** `HARNESS_CHANGE_MAP.md` — reuse T-04 docs/preset schema · **Goal:** `GOALS.md`

## Scope
Implement FN-FDE-012 in AgentConsole or Presets. reuse T-04 docs/preset schema.

Files: PresetsModule gallery grid (6 cards), pack loader if needed, tests.
Theme: glass tokens only, no new hues. Light+dark parity. `appendTrace` + `appendAudit` on every mutating action.
Ledger: after shipping, update `scripts/regen-inventory.mjs` for the function(s) above and re-run it; update `GOALS.md` status.
Parallel-safe: only edit the files listed under Files.

## Acceptance (must all pass)
- `npx tsc -b` clean
- `npx vitest run` green (add ≥2 tests for any new helper)
- Browser console clean in dev tab; reference tolerance ±2px vs corpus tiles where a visual exists
- Rollback: revert of this slice must leave the app buildable; no destructive schema moves without a memo in this file.
