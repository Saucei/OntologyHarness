# FN-DEPLOY-DAG — Pipeline Builder deploy + Clean transform
Tier: T2 · Function IDs: FN-DAT-001, FN-DAT-002, FN-DAT-003

## Reference images
pipeline_overview.png
instructor_…1749655488_Clean+Bureau+Transform.1749655488778.png
instructor_…1749821009_Clean+Office+Goods+Transform.1749821009187.png
instructor_…1749823347_Union+Datasets+-+1.1749823346778.png
instructor_…1749823757_Union+Node.1749823756830.png
instructor_…1759877719_Screenshot+2025-10-07+at+5.53.57PM.1759877719520.png
instructor_edwj6mfetvohj7wqvtfscik6h_public_1699554578_Screenshot+2023-11-08+at+13.21.50.1699554577987.png

## What it does
Cast/filter/drop/rename/normalize transforms; union node config + preview; deploy with compute profile (Extra small warm pool).

## Build spec
1. Add the entry point in the right module (Workshop / Data Hub / Graph / Ontology Studio).
2. Wire state into `src/store.ts` (persist to SQLite via `ws_set_table `) or `meta` key if small.
3. Keyboard: Ctrl+Shift+D for Test-Your-Function equivalent; Escape closes panels.
4. ARIA: role=dialog on inspectors, aria-label on icon-only buttons.
5. Logging: appendTrace(kind: "tool-call", detail: "<op>") on every mutating action.
6. Acceptance: screenshot diff vs reference within ±2 px; console clean; build green.

## Output contract
Provide: component code · store mutation · screenshot(s) light+dark · one-line changelog · failing-then-passing test.

## Non-goals
Do NOT resurrect removed features; no new hues; no cloud; no multi-user.