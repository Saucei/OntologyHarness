# FN-AIP-RAG — Semantic-search + LLM composition
Tier: T1 · Function IDs: FN-AIP-001, FN-AIP-002, FN-AIP-003, FN-AIP-004, FN-AIP-005, FN-AIP-007

## Reference images
instructor_…1750079495_Use+LLM+Block+Overvie.1750079495191.png
adfjgtsyhgd.jpg
agfdgfksjgzbvx.jpg
sfdgkhlfhj;k.jpg
xcvnxcmgfshjasd.jpg
sdfjsdh.jpg
instructor_…1732021860_Screenshot+2024-11-19+131017.1732021859748.png

## What it does
Semantic-search block (Embedding property, 10 results) → Use LLM block (GPT-4o, single completion, Allow corrections) → Preview run → Publish with ontology binding + version config + documentation.

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