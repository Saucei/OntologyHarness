# Master Prompt — Ontology Harness Stage 2 (P1 · Value, ~500 words)

You are the staff engineer/product designer taking Ontology Harness from “real” to “valuable.” P0 is done: native SQLite workspace, Credential Manager keys, streaming LLM gateway, working agent loop, live swarms. Do not regress these. Stage 2 makes the harness worth opening daily.

## Mission

Close the loop between an analyst’s question and a dependable artifact. Every P1 workstream must end in a demo-able, verified outcome — not a settings page.

## Context anchors

`src-tauri/src/{llm,storage,keys}.rs` (gateway/workspace/secrets) · `src/store.ts` (hydration + debounced autosave) · `src/agent/{orchestrator,tools}.ts` (agent + typed tools) · `src/modules/*` (GraphCanvas, OntologyStudio, PipelineBuilder, WorkshopCanvas, AipLogicPanel, DataHub, JobsModule, SwarmsModule, WorkersModule, ProvidersModule) · `master-prompts/06-10` (detailed sub-briefs) · `UI_MASTER_PROMPT.md` v2.1 (transparent glass, cream/green, designed dark mode).

## Workstreams (strict priority)

1. **AIP Logic grounded runtime (06).** Local retrieval over the corpus (OCR text from 13 when available; interim: manifest entries + dataset blurbs) via SQLite FTS5; top-k 6 with highlighted snippets; answers carry mandatory `[n]` citation chips that scroll to the source panel; “Publish function” writes a versioned logic definition to the workspace; honest refusal on weak grounding; debugger shows real retrieval scores + prompt tokens.
2. **Ontology persistence & validation (07).** Object/link/action types already hydrate from the store — add a value-type registry (`WarehouseId: ^WH-\d{3}$`, `abv: 0–15`, timestamps, decimals), bind properties to value types, block invalid saves with inline explanations; delete flows show dependents and require typing the object name; JSON import/export with schema version.
3. **Data Hub round-trip (08).** SHA-256 canonical hash on import and export; reimport → byte-compare → ✓/✗ badge with diff sample; XLSX multi-sheet picker verified with a real fixture; profiling panel (null %, distinct, min/max/mean, top-5) with >50%-null red flags; schema-mapping wizard for column mismatches; datasets persist with refcount delete protection; CSV/JSON/XLSX export + JSON manifest sidecar (source hash, rows, generated-at).
4. **Jobs ↔ artifacts (09).** Attach datasets, charts, swarm traces and object IDs to jobs (chips with preview popovers); assignee picker fed by the AI Workers roster; due date + priority; drag-drop kanban across columns with WIP limits; JSON export includes attachments; deep-links (“Open in Data Hub”, “Open in Swarms”).
5. **Workshop publish round-trip (10).** Widget config schema + persistence; Publish validates (bindings resolve, required props) → immutable `published/vN` snapshots → in-app preview with dataset rows; version diff + rollback = republish old snapshot; expose `workshop.publish(dryRun)` to the agent for pre-flight.

## Design rules

Reuse, don’t fork: one glass system, one motion curve, existing chips/buttons. Dark mode parity for everything new. No new accent hues. Every mutation is reversible (undo toast or version). Respect the agent contract: tools dryRun by default; anything live needs approval.

## Non-goals

No cloud sync, no multi-user, no mobile, no vector DB migration yet (FTS5 is the honest 80/20), no P2/P3 scope creep.

## Acceptance (all must pass, in order)

Axe: no critical/serious violations in new views; contrast AA. Grounded answer cites a real corpus chunk and refuses weak grounding. Round-trip hash equality on a real CSV. Job auto-attaches the dataset it was spawned from. Workshop publish blocked with a named missing binding, then passes after fix; v1 restores via rollback. Restart app — everything survives.

## Output contract

Per workstream: schema/migrations · implementation · focused tests · light+dark screenshots · one-line changelog. Stage end: regenerate `README.md` and `INDEX.md` statuses; leave the app demo-ready — fresh profile → import brew CSV → grounded AIP answer → publish Order Overview v2 → job from chart → visible in kanban. Small reviewable diffs; never break the P0 gateway.
