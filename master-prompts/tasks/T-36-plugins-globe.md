# T-36 — Plugin consumption + GeoMap 360° traversable globe

**Layer:** L3-FOUNDRY / plugin subsystem + geo substrate · **Status:** DONE (2026-11-10)
**Date opened:** 2026-11-10 · **Requested by:** user ("plugins dont make a difference when being enabled, as well as the geomap has no map, implement a globe in the geomap, that is consistent with the theme of the app, make a 360* view of the map scalable, with google map data, use online globe data if needed" — refined: "it must be fully traversable on the geomap section of the app")

## Problem 1 — enabled plugins had no effect

`PluginManager` persisted `ws.meta.packState` but the only consumer was theme packs
(`applyThemePack`). Bundled packs are 2 corpus + 1 theme — so the visible toggles did
nothing. `ManifestView` fetched `/manifest.json` only; `corpus.search` ditto;
`PresetsModule` merged **bundled** presets packs only (none exist bundled) and ignored
custom-installed packs.

### Fix — `src/packs/consume.ts` (new consumption layer)

- `enabledPackUnits()` — re-materializes bundled + custom packs from `ws.meta`
  (`customPacks` + `packState`), filters valid ∧ enabled. Same rematerialization
  PluginManager uses.
- `enabledPackPresets()` — validated presets from enabled presets-kind packs.
- `mergeCorpus(base, units)` — pure merge: base categories first, pack files appended,
  deduped by file name (base wins), pack-sourced files labeled in `fileSource`.
- `packEntries(merged)` — pack files as search entries (`note: "pack: <name>"`).
- `PACK_LANDING` — per-kind landing-zone documentation surfaced in the Plugin Manager
  detail pane ("Lands in: …"); rules/prompts honestly marked "Reserved — no consumer yet".

### Consumers wired

1. **Corpus Manifest** (`ManifestView.tsx`) — merged category grid (pack files carry a
   `pack` chip), full-text search spans pack entries, lightbox resolves pack files,
   header shows `packs on: <names>` chip + merged file count.
2. **`corpus.search` agent tool** (`tools.ts`) — searches base manifest + all enabled
   corpus packs; result payload includes `sources: ['base manifest', …packNames]`.
3. **Preset Library** (`PresetsModule.tsx`) — `enabledPackPresets()` replaces the
   bundled-only merge; custom presets packs now contribute runnable presets.
4. **Plugin Manager** — "Lands in" row per pack.

Browser-verified: enabling Corpus 134 + Corpus 2 grows the manifest 134 → **206 files**
with **72 pack-badged entries**; disabling reverts. Dedupe verified (Corpus 134 ⊂ base →
adds 0 files, no duplicates).

## Problem 2 — GeoMap had no map; globe requested

The flat canvas was a graticule-only equirectangular projection over the data bounds —
no coastlines, no tiles. User asked for a themed, scalable, 360° globe.

### Fix — fully traversable orthographic globe

- **Data**: Natural Earth 110m land (public domain), vendored same-origin at
  `public/geo/land-110m.json` (207 KB, 127 polygons) — works offline in the installed
  app, no CSP change. Google tiles need an API key + per-tile attribution; open data
  chosen instead (documented for the user).
- **Math**: `src/components/globe.ts` — d3-compatible orthographic formulas
  (x = cosφ·sin(λ−λ0), yUp = cosφ0·sinφ − sinφ0·cosφ·cos(λ−λ0), visibility = cos of
  angular distance > 0). Pure, unit-tested, cross-checked against `d3-geo` to 1e-6.
- **Component**: `src/components/GlobeCanvas.tsx` — d3-geo `geoOrthographic` +
  `geoPath` + `geoGraticule10`; sphere/land/graticule all glass tokens (no new hues).
- **Fully traversable** (per user's follow-up):
  - Drag rotates through unbounded longitude (full 360°+) and latitude clamped only at
    ±90° — the poles themselves; every point on Earth reachable.
  - Zoom-aware drag sensitivity (0.4°/px ÷ zoom) for fine control when scaled in.
  - Wheel zoom (non-passive native listener), toolbar +/−/Reset shared with flat view.
  - Auto-spin toggle (⟳) — continuous 360° drift at 9°/s, pauses while dragging.
  - Keyboard traversal: arrow keys rotate ±15°.
  - Far-hemisphere markers culled (`projectGlobe → null`) with an "N on far side" chip;
    rotation brings any marker around.
- **Integration** (`MapCanvas.tsx`): `◍ Globe / ▭ Flat` toolbar toggle; `initialView`
  prop — **GeoMap opens directly on the globe** (`MapModule` passes `"globe"`),
  default rotation = data centroid so fixtures face the viewer. All COP features
  (facet rail, histogram, linked table, metric cards, cluster/point/line layers) work
  in both views; choropleth falls back to centroid bubbles on the sphere (rect cells
  can't wrap a globe — noted in code).
- **Robustness fixes found in browser verification**: drag-end committed a stale
  render-closure rotation (React 18 batching) — now the drag ref carries the
  authoritative value; `setPointerCapture` wrapped (synthetic pointerIds throw);
  pre-existing invalid `height="auto"` SVG attribute removed.

## Tests (+19)

- `globe.test.ts` (8): clamps/wraps, drag mapping + pole clamp, visibility/horizon,
  projection orientation, far-side null, d3-geo agreement to 1e-6.
- `consume.test.ts` (5): enabled-pack selection (bundled+custom, toggle off), presets
  surfacing, corpus merge/dedupe/labeling, PACK_LANDING coverage.
- `MapCanvas.globe.test.tsx` (6): toggle both ways with stable testids, `initialView`,
  full traversal to far hemisphere and back, spin+reset, keyboard rotation, zoom in
  globe mode. Suite total: 371 passed / 6 skipped (live bench).

## Debug log

- React 18 event batching made synchronous browser probes read stale state — all
  interactive verification re-done with dispatch/read in separate round-trips.
- rAF-driven auto-spin is suspended in unfocused/occluded browser panes; verified
  working after `tabs.focus` (standard visibility behavior, not a bug).
- First synthetic-drag probe: `setPointerCapture(1)` throws `InvalidPointerId` in
  Chromium for non-active pointers — try/catch + ref-based commit fix.

## Gate results (2026-11-10)

1. ✅ `npx tsc -b` exit 0.
2. ✅ `npx vitest run` — 371 passed / 6 skipped (live bench), +19 vs T-35.
3. ✅ `npm run build` exit 0.
4. ✅ Browser-verified on :1420 — globe traversal (drag 80°/160° exact, wheel 1.25×,
   spin 9°/s, reset), plugin enable → 134→206 files, no console errors.
5. ✅ Commit → push → CI green (see run for SHA) · GOALS.md row DONE.
