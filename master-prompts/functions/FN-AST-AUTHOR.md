# FN-AST-AUTHOR — Agent Studio authoring (inputs · variables/chains · tools · repo lifecycle)
Tier: T1 · Function IDs: FN-AST-001, FN-AST-002, FN-AST-003, FN-AST-004, FN-AST-005, FN-AST-006, FN-AST-007, FN-AST-008, FN-AST-009, FN-AST-010

## Reference images
instructor_…1759958481_Screenshot+2025-10-08+at+4.19.52PM.1759958480924.png
instructor_…1756895979_2-+Overview.1756895979445.png
instructor_1769010682_Step+1.2+-+Ont+man.1769010682432.png (as seen)

## What it does
Agent definition: typed Inputs (Required/Optional), Pre-computed variables from templates, variable operation chains (Filter → Search around link traversal, typed output, Problems bar), Tools binding (Apply actions/Call function/Ontology SQL/Custom tool + Automated), repo provisioning (model + Auto-import + bind to ontology + Agent API name), Tag-and-release semver modal, Checks tab, scoped imports console (resources.json), Session completion policy, rich-text system prompt editor with "/"-insert.

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