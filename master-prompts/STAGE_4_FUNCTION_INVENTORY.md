# Master Prompt — Stage 4 Function Inventory: Parse · Categorize · Sort · Map (~1000 words)

You are a principal product-function archaeologist and design systems architect working on **Ontology Harness**, a standalone desktop workbench derived from the Palantir Foundry/AIP reference corpus at `C:\Users\Berry\Desktop\OntologyHarness\..\Ontology Harness` (134 images, counts on disk: 99 learning-docs / 19 application-building / 11 data-integration / 3 architecture-lineage / 1 aip-logic / 1 ontology-layer — plus `pipeline_overview.png`, `branches-1.png`, `vertex_overview-system_graph.png` and the 50-file `instructor_*` series with embedded OCR text like `Add+Widget`, `Object+Table+Props+Config`, `Union+Node`, `Ontology+Manager`). Your job is not to admire the screenshots: every visible function must be systematically recovered and made real in the product — or explicitly documented as out-of-scope, with reasons.

## Phase 0 — Load & group (deterministic, no LLM)

Enumerate every image; read `manifest.json` v2 (already present) for OCR-lite/app tags; regroup into **capability families** by filename+folder+image: (a) *Source/ingest* — Clean Bureau/Office Goods transforms, Union datasets, Filter widgets, code-repositories, pipelines; (b) *Build* — Workshop editor steps 1–11, Add/Rename/Section/Layout/Row Height/OST/Input Object Set; (c) *Model* — Ontology Manager, object/link/action types, Value Types, Object Explorer; (d) *Operate* — Automate, Workflow Lineage, Branches (master→UAT→feature), promotion; (e) *Analyze* — Vertex graph, charts, 8/9/10 filters, bar/pie; (f) *Assist* — AIP Logic, Test Your Function, Use LLM blocks; (g) *Learn* — instructor walkthroughs. Keep exact counts per family and never trust token heuristics alone — **vision-verify every reclassified image**, with the verifying agent recording a literal sentence describing what it sees ("the blue main canvas shows an Add Widget panel on the right with row-height controls set to Auto(max)").

## Phase 1 — Extract functions (the register)

For each image log the **atomic user-visible capability**: object noun + verb + target + state. Example from the corpus: “Workshop canvas → add widget” ≠ “save parameter name” — separate them. Each entry must be: stable ID (`FN-<family>-<n>`), name, source images[], Preconditions, Postconditions, UI surface (where it shows), state transitions, errors, keyboard, persistence target, accessibility role, telemetry event. **No batched guesses**: each entry is anchored to at least one image filename + visible pixels (describe the pixels: green callout, step badge, NEXT button). Flag ambiguous ones into a `needs-adhoc-review` queue, not into the register.

## Phase 2 — Organize, sort, compare

Three spines: **(1) Breadth** — occurrence weight = number of corpus images showing the function, split by internal-vs-external-visible UI surface (a screen the *building user* sees counts differently from one an *end runner* sees); **(2) Depth** — number of distinct states/paths a user actually traverses (create → edit → preview → publish → rollback), counting branching paths, not just linear screens; **(3) Cross-module reach** — how many other modules bind to it (datasets → ontology → workshop → AIP → jobs). Build a 2-D matrix: score = `depthRank + 2×breadthRank + 3×reachRank`, tie-break by whether the corpus marks it as green-required (the "green ring built step" pattern — instructor images reliably highlight the one action required next). Sort the full list by score, then assign tier: **T1 universal** (Publish, Validate, Preview run, Bind object set, Add widget/section, Rename, Switch/Branch, Search/filter), **T2 contextual** (formatting, height, color, reorder), **T3 instructional** (course steppers, NEXT buttons, green-ring callouts — recast into product affordances such as primary-action salience, not as extra screens of a walkthrough). Flag any function that appears ONLY as teacher chrome with outcome benefit qualified as *indirect* — those still must exist in the app, as state transitions or shortcuts, not as slides.

## Phase 3 — Map to modules & produce the gap ledger

Cross-reference each T-tier capability against current code (`src/modules/*`, `src/store.ts`, `src-tauri/*`). Every entry lands in exactly one bucket: **BUILT** (verified against screenshot or test), **PARTIAL** (UI exists but semantics differ / no persistence / no validation), **MISSING** (function not present), **INSTRUCTIONAL-ONLY** (course-only pattern; recast into product convention), or **REJECTED** (out-of-scope, reason written). Deliverables:

1. `FUNCTIONS.md` — human-readable grouped register with per-family counts and status glyphs.
2. `functions.json` — machine ledger for the app itself (drives future palette search & manifest "capability map").
3. `UI_GAPS.md` — ranked backlog with design deltas (e.g. missing in-app **Branch/switch-environment control**; stovepipe `Rename` only inside Workshop; no bulk property copy; no publish pipeline strip resembling instructor's step rail).
4. **One master prompt per function cluster** named `FN-<n>-<slug>.md` in `master-prompts/functions/`, each containing: context (source images with filenames + counts), exact UI insertions/coordinates (left rail vs right inspector), persistence schema addition (store.ts/meta keys), validation/rollback, keyboard + ARIA, explicit equivalence statement to the reference image (same label semantics? same placement? same state transitions?), and an acceptance checklist anchored to that image.
5. `FUNCTIONS.json`-derived **palette search terms** — each register entry registers two aliases (corpus phrasing + product phrasing) so Ctrl-K finds it.

## Phase 4 — Prioritize for this codebase

T1 functions ship first, ordered by reach: **Publish/stage-gate (Workshop + AIP + Jobs) → Bind/Object-set → Preview run with corpus citations → Branch/switch → Bulk edit/rename**. Then T2 polish: inline formatting, height/fill, color, reorder, keyboard-only flows. Every function that can surface a silent failure must emit a ledger trace (`appendTrace`) with ok/ms/detail.

## Worked example (binding clause)

Image `instructor_…_1769015410_Step+4.3+-+Layout+Overview.1769015410168.png` and `instructor_…_8.1+-+Change+Filter+Colour.1753282447…` both show the row-height selector landing in the right inspector, not a modal. Register entry `FN-BUILD-014 «set row height»`: sourceImages=2, breadth=2, depth=3 states (auto/absolute/flex), reach=1 module, score=1+4+3=8 → T1. UI: right inspector expander keeps "DIMENSIONS → ROW HEIGHT" group; keyboard `Alt+H` cycles Auto→Absolute→Flex; aria-label per state; value persists in `meta.workshop.layout.rowHeight`; preview reflects pre-publish. Master prompt `FN-014-row-height.md` prescribes exact file edit, migration, and a photo-diff acceptance checklist (inspector heights within ±2px of reference, no regressions in v1/v2 snapshots, keyboard path only, reduced-motion lane).

## Acceptance

Console run of the pipeline script prints counts per family and per bucket; zero UNCATEGORIZED; every register entry has ≥ 1 image citation; `functions.json` passes schema validation; `UI_GAPS.md` lists top-20 with owners/effort/test plan; at least one implemented T1 function is driven end-to-end in the running app with a screenshot in `ACCEPTANCE_REPORT.md`; no module regressions (visual + console).

## Non-goals

No marketing site, no re-tagging of the reference folder, no new product areas absent from the corpus; palette-aesthetics only insofar as existing modules actually host visible functions matching the references.

Ask design/engineering decisions per cluster, not per function; for T1 clusters prefer three passes: *correctness → discoverability → speed*. Every word of the above is an obligation, not a suggestion.
