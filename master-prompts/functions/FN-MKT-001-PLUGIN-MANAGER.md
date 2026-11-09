# FN-MKT-001 — Plugin Manager (Tauri Marketplace product-version page → pack manager)

**Cluster:** FN-SCP-CANVAS / marketplace family · **Tier:** T1 · **Contract:** `src/modules/contract.ts` (MODULE_API 1.0)
**Architecture:** `master-prompts/ARCHITECTURE_PLUGINS.md` (normative) · Plan: `master-prompts/STAGE_5_CORPUS2_PLAN.md` §P0

## Reference (corpus 2, tile `2025-11-04-155649-custom-widgets-marketplace-custom-widgets-published-pn.png`)
A product-version page for marketplace items: *outputs*, *install mode*, *release channel*,
published state. Our mirror: installed packs grid + pack detail (manifest fields, compatibility,
contents, "Adds N features" ledger impact, live theme preview) + install flow (local folder /
URL / GitHub raw) + enable/disable. The UI must feel like the rest of the Harness: glass cards,
hairline rows, chip badges, no new hues.

## Scope (this slice)
1. **Pack loader** (`src/packs/loader.ts`): discover `packs/*/pack.json` at build time
   (Vite `import.meta.glob` raw), validate manifest schema + `api` semver vs `MODULE_API`,
   expose validated units + issues. Refused packs never render enabled.
2. **Pack kinds** — `theme-packs | presets | corpus | rules | prompts`. Theme packs may only
   assign CSS custom properties (theme law); enforced by a loader lint + tests. Preset packs
   conform to `src/data/presets.ts` `Preset` schema (`validatePreset`). Corpus packs embed a
   `manifest.json` in the existing `Manifest` schema (totalFiles/categories/entries).
3. **4 proof packs** (self-contained in `packs/`, dev + bundled-build safe):
   - `theme-cream-glass` — warm accent variant, opt-in, both `[data-theme]` modes.
   - `presets-brewery` — 3 domain presets validating against `validatePreset`.
   - `corpus-134` — snapshot of the real corpus-1 manifest.
   - `corpus-2` — generated from `asset/corpus-2/index.json` (72 tiles → 11 families).
4. **Plugin Manager module** (`src/modules/PluginManager.tsx`, registry id `plugins`, INSPECT):
   pack cards (name, version, kind badge, enabled toggle, source chip, remove for session
   packs), detail pane (description, author, API compat row, contents preview, corpus counts,
   swatch preview for themes), install bar (URL/GitHub raw via `fetch` + paste-JSON fallback),
   disabled-with-message on invalid packs, `appendAudit` on install/enable/disable.

## Non-goals (explicitly ledgered)
- T2 contributed agent tools, T3 code modules — design reservations only.
- Tauri-side `%APPDATA%` folder scan (requires Rust command); the in-project `packs/` glob ships
  now, folder scan gains an UI hint. URL install must degrade gracefully when offline/CORS blocks.
- Rewriting `ManifestView` to consume pack corpora (the manifest schema is shared instead).

## Acceptance
- `npx vitest run`: pack loader tests (schema reject, semver reject, theme tokens-only lint,
  corpus-2 = 72 tiles, presets pass `validatePreset`) ≥ 6 new cases; suite stays green.
- `npx tsc -b` clean; `npm run build` green; console clean in dev tab.
- Browser: nav shows 14 modules; Plugin Manager lists 4 packs; enabling `theme-cream-glass`
  visibly warms accents in light AND dark and is reversible; corpus-2 card shows 72-file counts;
  ledger regen runs (FN-MKT-001 → PARTIAL with honest entry note).
