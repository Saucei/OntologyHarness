# FN-VRT-TEMPLATE — Vertex knowledge-graph create + save-as-template
Tier: T2 · Function IDs: FN-VRT-001, FN-VRT-002, FN-VRT-003, FN-VRT-004, FN-VRT-005, FN-VRT-006, FN-VRT-007

## Reference images
qwtqeruyart.jpg
wqayryeqfc.jpg
wqeytqeray.jpg
xcvbn,kydjuthsyrgdrf.jpg
retyuyiijuhtsgr.jpg
sagsadg.jpg
vertex_overview-system_graph.png
branches-1.png

## What it does
Create graph → add objects (select-all/invert) → search-around → layout picker → layers (node/edge/include-as-styling) → 5-step Save-as-template wizard → time-series side panel.

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