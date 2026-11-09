# FN-SCP-CANVAS — Solution Design: use-case funnel canvas + guidance bank
Tier: T2 · Function IDs: FN-SCP-001, FN-SCP-002, FN-SCP-003, FN-SCP-004, FN-MKT-001, FN-MKT-003

## Reference images
instructor_…1759958481_Screenshot+2025-10-08+at+4.19.52PM.1759958480924.png
instructor_…1756895979_2-+Overview.1756895979445.png
instructor_1769010682_Step+1.2+-+Ont+man.1769010682432.png (as seen)

## What it does
Scoping canvas of typed capability cards (User Group, External System→Data Connector→Project→Dataset→Object Type, Scenario/Model, Automate→Notifications/Machinery, delivery surfaces) with dashed group frames + verbatim guidance-question bank + permissions matrix + MVP/steering/beta checklist; Marketplace product-version page doubles as the Plugin Manager UI; tiered agent app templates.

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