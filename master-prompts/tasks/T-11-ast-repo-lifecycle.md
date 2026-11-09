# T-11 — Repo Lifecycle (provisioning / release / checks / scoped imports)

**Layer:** L3 · **Functions:** FN-AST-005/006/007/008 · **Host:** new RepoModule or Workshop subview
**Architecture:** `master-prompts/ARCHITECTURE_LAYERS.md` · **Plugins:** `ARCHITECTURE_PLUGINS.md`
**Harness prerequisites:** `HARNESS_CHANGE_MAP.md` — src/repos/types.ts + resources.json scope model · **Goal:** `GOALS.md`

## Scope
Implement FN-AST-005/006/007/008 in new RepoModule or Workshop subview. src/repos/types.ts + resources.json scope model.

Files: repos/types.ts, provisioning form, tag-release modal, checks tab, scoped imports console, tests.
Theme: glass tokens only, no new hues. Light+dark parity. `appendTrace` + `appendAudit` on every mutating action.
Ledger: after shipping, update `scripts/regen-inventory.mjs` for the function(s) above and re-run it; update `GOALS.md` status.
Parallel-safe: only edit the files listed under Files.

## Acceptance (must all pass)
- `npx tsc -b` clean
- `npx vitest run` green (add ≥2 tests for any new helper)
- Browser console clean in dev tab; reference tolerance ±2px vs corpus tiles where a visual exists
- Rollback: revert of this slice must leave the app buildable; no destructive schema moves without a memo in this file.
