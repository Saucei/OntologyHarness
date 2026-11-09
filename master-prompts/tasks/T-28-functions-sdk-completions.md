# T-28 — Functions SDK + Ontology Completions

**Layer:** L1 · **Functions:** FN-FNS-001/002/003 · **Host:** new Functions module / Workshop
**Architecture:** `master-prompts/ARCHITECTURE_LAYERS.md` · **Plugins:** `ARCHITECTURE_PLUGINS.md`
**Harness prerequisites:** `HARNESS_CHANGE_MAP.md` — LanguageModels shim over llmChat · **Goal:** `GOALS.md`

## Scope
Implement FN-FNS-001/002/003 in new Functions module / Workshop. LanguageModels shim over llmChat.

Files: function authoring form, completions demo + logs, workshop variable binds, tests.
Theme: glass tokens only, no new hues. Light+dark parity. `appendTrace` + `appendAudit` on every mutating action.
Ledger: after shipping, update `scripts/regen-inventory.mjs` for the function(s) above and re-run it; update `GOALS.md` status.
Parallel-safe: only edit the files listed under Files.

## Acceptance (must all pass)
- `npx tsc -b` clean
- `npx vitest run` green (add ≥2 tests for any new helper)
- Browser console clean in dev tab; reference tolerance ±2px vs corpus tiles where a visual exists
- Rollback: revert of this slice must leave the app buildable; no destructive schema moves without a memo in this file.
