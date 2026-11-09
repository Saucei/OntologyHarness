# T-02 — Modes (tool-carrying) + Adds N tools + Thinking card

**Layer:** L1/L4 · **Functions:** FN-FDE-005, FN-FDE-011 · **Host:** AgentConsole
**Architecture:** `master-prompts/ARCHITECTURE_LAYERS.md` · **Plugins:** `ARCHITECTURE_PLUGINS.md`
**Harness prerequisites:** `HARNESS_CHANGE_MAP.md` — permissions matrix T-03 (modes compute tool counts from tool defs) · **Goal:** `GOALS.md`

## Scope
Implement FN-FDE-005, FN-FDE-011 in AgentConsole. permissions matrix T-03 (modes compute tool counts from tool defs).

Files: src/agent/permissions.ts (new-lite), AgentConsole mode popover, tests.
Theme: glass tokens only, no new hues. Light+dark parity. `appendTrace` + `appendAudit` on every mutating action.
Ledger: after shipping, update `scripts/regen-inventory.mjs` for the function(s) above and re-run it; update `GOALS.md` status.
Parallel-safe: only edit the files listed under Files.

## Acceptance (must all pass)
- `npx tsc -b` clean
- `npx vitest run` green (add ≥2 tests for any new helper)
- Browser console clean in dev tab; reference tolerance ±2px vs corpus tiles where a visual exists
- Rollback: revert of this slice must leave the app buildable; no destructive schema moves without a memo in this file.
