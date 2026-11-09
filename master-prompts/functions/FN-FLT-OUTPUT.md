# FN-FLT-OUTPUT — Filter → output-variable plumbing
Tier: T1 · Function IDs: FN-FLT-001, FN-FLT-002, FN-FLT-003, FN-FLT-004, FN-FLT-005, FN-FLT-006, FN-FLT-007

## Reference images
instructor_…1753277310_3+-+Set+Object+Set.1753277309680.png
instructor_…1753266737_6+-+Rename+variable.1753266737653.png
instructor_…1753278970_8.1+-+Filter+using+Variable.1753278970436.png
instructor_…1753278376_6+-+Allow+Users+to+Add+Filters.1753278375787.png
instructor_…1753277831_5.5+Change+to+Multi-Select+Component.1753277831511.png
instructor_…1769083231_7+-+Rename+Filter+Output.1769083231085.png
sagsadg.jpg
sdhj.jpg
sfgjsdsf.jpg

## What it does
Filter list widget → Order Filters output variable → Rename variable → object-set variable using that filter → current value shown; multi-select dropdown default; clear/typed values.

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