# T-09 — Variable Operation Chains (Filter → Search around)

**Layer:** L1/L2 · **Functions:** FN-AST-003 · **Host:** AgentConsole config drawer
**Architecture:** `master-prompts/ARCHITECTURE_LAYERS.md` · **Plugins:** `ARCHITECTURE_PLUGINS.md`
**Harness prerequisites:** `HARNESS_CHANGE_MAP.md` — object-set ops (Filter, SearchAround) over graph substrate · **Goal:** `GOALS.md`

## Scope
Implement FN-AST-003 in AgentConsole config drawer. object-set ops (Filter, SearchAround) over graph substrate.

Files: variables.ts chains, chain builder UI with typed output + Problems bar, tests.
Theme: glass tokens only, no new hues. Light+dark parity. `appendTrace` + `appendAudit` on every mutating action.
Ledger: after shipping, update `scripts/regen-inventory.mjs` for the function(s) above and re-run it; update `GOALS.md` status.
Parallel-safe: only edit the files listed under Files.

## Acceptance (must all pass)
- `npx tsc -b` clean
- `npx vitest run` green (add ≥2 tests for any new helper)
- Browser console clean in dev tab; reference tolerance ±2px vs corpus tiles where a visual exists
- Rollback: revert of this slice must leave the app buildable; no destructive schema moves without a memo in this file.
