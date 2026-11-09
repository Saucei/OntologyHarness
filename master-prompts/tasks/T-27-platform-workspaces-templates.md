# T-27 — Code Workspaces + Tiered Agent Templates

**Layer:** L3/L4 · **Functions:** FN-MKT-002/003 · **Host:** new Workspace stub / AgentConsole templates
**Architecture:** `master-prompts/ARCHITECTURE_LAYERS.md` · **Plugins:** `ARCHITECTURE_PLUGINS.md`
**Harness prerequisites:** `HARNESS_CHANGE_MAP.md` — workspace tool gating (mock) + template versions · **Goal:** `GOALS.md`

## Scope
Implement FN-MKT-002/003 in new Workspace stub / AgentConsole templates. workspace tool gating (mock) + template versions.

Files: JCW stub with 11-tool toggles + history, v16/v20 templates, tests.
Theme: glass tokens only, no new hues. Light+dark parity. `appendTrace` + `appendAudit` on every mutating action.
Ledger: after shipping, update `scripts/regen-inventory.mjs` for the function(s) above and re-run it; update `GOALS.md` status.
Parallel-safe: only edit the files listed under Files.

## Acceptance (must all pass)
- `npx tsc -b` clean
- `npx vitest run` green (add ≥2 tests for any new helper)
- Browser console clean in dev tab; reference tolerance ±2px vs corpus tiles where a visual exists
- Rollback: revert of this slice must leave the app buildable; no destructive schema moves without a memo in this file.
