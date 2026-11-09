# FN-BLD-SPLIT — Section splitting & add-widget block
Tier: T1 · Function IDs: FN-BLD-001, FN-BLD-003

## Reference images
instructor_…1753264093_1+-+Add+Widget.1753264093409.png
instructor_…1753347673_1+-+Add+New+Section.1753347673715.png
instructor_…1753347959_2.2+-+Add+OST+Widget.1753347959727.png
instructor_…1753348468_6+-+Fill+space.1753348468467.png

## What it does
Split-section dropdown (New section above/below/on left/on right) + empty-section "Add widget"/"Set layout" dashed affordance. Both are zero-definition empty-container flows.

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