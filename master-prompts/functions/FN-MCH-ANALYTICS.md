# FN-MCH-ANALYTICS — Machinery state-transition analytics (8 functions)
Tier: T2 · Function IDs: FN-MCH-001, FN-MCH-002, FN-MCH-003, FN-MCH-004, FN-MCH-005, FN-MCH-006, FN-MCH-007, FN-MCH-008

## Reference images
instructor_…1759958481_Screenshot+2025-10-08+at+4.19.52PM.1759958480924.png
instructor_…1756895979_2-+Overview.1756895979445.png
instructor_1769010682_Step+1.2+-+Ont+man.1769010682432.png (as seen)

## What it does
State-graph widget family on the existing graph substrate: duration-encoded nodes, DAYS edge pills, metric carousel (Historical count|Current count|Historical duration), contextual-zoom stat cards, deviation dotted edges, path explorer with checked rows + bars, brushed duration histogram, subprocess frames + floating zoom chips, transition-nodes toggle.

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