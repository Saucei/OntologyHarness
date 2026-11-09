# FN-BLD-TABLE — Object Table column configuration
Tier: T1 · Function IDs: FN-BLD-009, FN-BLD-010, FN-BLD-011, FN-BLD-012, FN-BLD-014, FN-BLD-015

## Reference images
instructor_…1753275160_7+-+Object+Table+Props+Config.1753275160232.png
instructor_…1753275160_…
instructor_…1753349018_10+-+Add+Value.1753349018172.png
instructor_…1753349120_11+-+Add+All+Properties.1753349120287.png
instructor_…1753348883_9+-+Edit+Input+Active+Object+Set.1753348882856.png
instructor_…1760003401_8.3+-+Replace+Object+Table+Variable.1760003401239.png
instructor_…1756895761_Rename+Object+Table.1756895761590.png
we.jpg
…

## What it does
Column config: reorder, add/remove/all, default-sort, filtering toggle, use-variable rename, number-of-columns=1, wrap.

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