# P0 · Agentic Tool-Use Loop & Orchestrator

**Role.** You are a senior AI-infrastructure engineer. Context: `AGENTIC_MASTER_PROMPT.md` (the contract), `src-tauri/src/llm.rs` (gateway), `src/llm/client.ts` (provider router), modules (`GraphCanvas`, `OntologyStudio`, `PipelineBuilder`, `WorkshopCanvas`, `ManifestView`).

**Why P0.** Without this, "agentic" is a label. The harness must let the model *call tools against the app itself* and verify outcomes — that is the product's differentiator.

**Build:**
1. Rust `orchestrator.rs` or TS `src/agent/`: planner loop — `observe → plan → act → verify → report`, max 8 tool hops, token budget cap, `dryRun: true` default.
2. Typed tool registry with JSON schemas: `graph.query` (return subgraph from seed/store), `ontology.get|create|update`, `pipeline.run(dryRun)`, `workshop.publish(dryRun)`, `corpus.search` (manifest.json), `aip.preview`. Each returns `{ok, data|error, traceId}`.
3. Tool-call parsing: OpenAI-compatible `tools[]` / function calling; Anthropic `tool_use`; provider-gated.
4. Approval gate: destructive/live actions render a diff + Confirm/Reject in the UI before execution; everything logged to an audit trail.
5. Agent chat surface (new module `Agent Console`): streaming transcript, tool-call cards, pause/abort, token cost.

**Acceptance.** Ask "what backs the Belgian Ale product and does its lineage reach Warehouse 1?" → agent calls `graph.query` twice, answers with IDs, shows the call trace. `dryRun` blocks a publish until confirmed. Malformed tool call → rejected and re-planned.

**Output contract.** Tool schemas file · orchestrator · console UI · 5 scripted eval prompts with expected traces.
