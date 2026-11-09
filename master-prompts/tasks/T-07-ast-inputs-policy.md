# T-07 — Agent Inputs + Session Completion Policy

**Layer:** L1 · **Functions:** FN-AST-001, FN-AST-009 · **Host:** AgentConsole (new config drawer)
**Architecture:** `master-prompts/ARCHITECTURE_LAYERS.md` · **Plugins:** `ARCHITECTURE_PLUGINS.md`
**Harness prerequisites:** `HARNESS_CHANGE_MAP.md` — src/agent/variables.ts (typed inputs + policy) · **Goal:** `GOALS.md`

## Scope
Implement FN-AST-001, FN-AST-009 in AgentConsole (new config drawer). src/agent/variables.ts (typed inputs + policy).

Files: src/agent/variables.ts, AgentConsole config drawer, tests.
Theme: glass tokens only, no new hues. Light+dark parity. `appendTrace` + `appendAudit` on every mutating action.
Ledger: after shipping, update `scripts/regen-inventory.mjs` for the function(s) above and re-run it; update `GOALS.md` status.
Parallel-safe: only edit the files listed under Files.

## Acceptance (must all pass)
- `npx tsc -b` clean
- `npx vitest run` green (add ≥2 tests for any new helper)
- Browser console clean in dev tab; reference tolerance ±2px vs corpus tiles where a visual exists
- Rollback: revert of this slice must leave the app buildable; no destructive schema moves without a memo in this file.
