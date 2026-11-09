# FN-FDE-CORE — AI FDE runtime shell (sessions · outline · approval · ribbon · tool matrix · skills · model catalog)
Tier: T1 · Function IDs: FN-FDE-001, FN-FDE-002, FN-FDE-003, FN-FDE-004, FN-FDE-005, FN-FDE-006, FN-FDE-007, FN-FDE-008, FN-FDE-009, FN-FDE-010, FN-FDE-011

## Reference images
instructor_…1759958481_Screenshot+2025-10-08+at+4.19.52PM.1759958480924.png
instructor_…1756895979_2-+Overview.1756895979445.png
instructor_1769010682_Step+1.2+-+Ont+man.1769010682432.png (as seen)

## What it does
Agent chat shell upgrade: session manager, tokenized conversation Outline with tool rows + budget meter, tool-approval cards (Always allow for this session), attachment ribbon with per-type count chips, tool-carrying Modes ("Adds 26 tools"), tri-panel tool permission matrix with If/Else Allow/Ask rules on branch conditions, skill-set configurations modal, documentation attach, model catalog picker with detail pane, reasoning-tier pill + keyboard protocol.

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