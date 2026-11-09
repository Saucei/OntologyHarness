# T-03 — Tool Permission Matrix (If/Else Allow/Ask)

**Layer:** L4 · **Functions:** FN-FDE-006 · **Host:** AgentConsole + tools registry
**Architecture:** `master-prompts/ARCHITECTURE_LAYERS.md` · **Plugins:** `ARCHITECTURE_PLUGINS.md`
**Harness prerequisites:** `HARNESS_CHANGE_MAP.md` — src/agent/permissions.ts — categories, Allow/Ask/Deny, branch-condition eval · **Goal:** `GOALS.md`

## Scope
Implement FN-FDE-006 in AgentConsole + tools registry. src/agent/permissions.ts — categories, Allow/Ask/Deny, branch-condition eval.

Files: src/agent/permissions.ts, src/agent/tools.ts (category metadata), AgentConsole tri-panel UI, tests.
Theme: glass tokens only, no new hues. Light+dark parity. `appendTrace` + `appendAudit` on every mutating action.
Ledger: after shipping, update `scripts/regen-inventory.mjs` for the function(s) above and re-run it; update `GOALS.md` status.
Parallel-safe: only edit the files listed under Files.

## Acceptance (must all pass)
- `npx tsc -b` clean
- `npx vitest run` green (add ≥2 tests for any new helper)
- Browser console clean in dev tab; reference tolerance ±2px vs corpus tiles where a visual exists
- Rollback: revert of this slice must leave the app buildable; no destructive schema moves without a memo in this file.
