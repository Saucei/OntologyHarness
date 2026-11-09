# Harness Change Map — What must exist before the missing features can land

Read with `master-prompts/ARCHITECTURE_LAYERS.md` (L0 Model → L1 Application → L2 Ontology → L3 Foundry → L4 FDEs)
and `master-prompts/ARCHITECTURE_PLUGINS.md` (T0 registry, T1 packs). This document names every
harness-level capability gap that blocks one or more remaining `FN-*` functions. Each row states the
gap, which functions it unblocks, which layer hosts it, and the minimal change.

## Cross-cutting (all layers)

| Gap | Blocks | Host | Minimal change |
|---|---|---|---|
| No **map component** (canvas + markers/bubbles) | FN-GEO-001, FN-GEO-003 | L3 Foundry | New `src/components/MapCanvas.tsx` (Leaflet-free dark canvas + bubble renderer + legend). No tile server; use the graph canvas pattern. |
| No **facet filter engine** (checkbox-count rails + histogram range) | FN-GEO-002, FN-FLT-006/007 | L3 Foundry | `src/filters/facetEngine.ts` — counts per value, intersect filters, date-histogram brush result. |
| No **geo property typing** | FN-GEO-001, FN-ONT-001, FN-GOV-003 | L2 Ontology | Extend `src/data/valueTypes.ts` with `GeoPoint`/`Geohash` types + validation. |
| No **event/trace schema + store** | FN-OBS-001..005 | L3 Foundry (read) / L4 trace write | `src/observability/types.ts` (AgentEvent / InternalEvent / Span / LogRow) fed from existing `appendTrace` + `.ohtrace` export; new `ObservabilityModule` page (not modal). |
| No **interactive histogram/brushing primitive** | FN-MCH-006, FN-GEO-002 | L3 Foundry | `src/components/HistogramBrush.tsx` — brushed range brackets, callback filter (mirrors the duration-distribution tile). |
| No **state-graph analytics layer** | FN-MCH-001..008 | L2 Ontology + L3 Foundry | Duration metrics on `GraphCanvas` nodes/edges + metric carousel + programmatic deviation/path computations (no new graph lib needed). |
| No **tool-permission rule engine** | FN-FDE-005, FN-FDE-006, FN-AST-004 | L4 FDE (policy) over L1 tool defs | `src/agent/permissions.ts` — categories, per-tool Allow/Ask/Deny, branch-condition If/Else evaluation. Extends `src/agent/tools.ts` (currently flat registry). |
| No **mode/skill bundles** | FN-FDE-004/005/007/008, FN-FDE-012 | L1 Application | Extend `Preset` schema (`src/data/presets.ts`) with `modes`, `skills`, `documentationBags` + pack-based skill registry; Modes list + `Adds N tools` computed from tool defs. |
| No **variable/session policy model** | FN-AST-001..003, FN-AST-009, FN-AST-010 | L1 Application | `src/agent/variables.ts` — typed inputs, pre-computed variables (object-set ops), session-completion policy (`staysOpen \| endsAfterOutput`). Chains reuse the object-set graph substrate. |
| No **repo/workspace lifecycle abstraction** | FN-AST-005/006/007, FN-MKT-002 | L3 Foundry | `src/repos/types.ts` — repo provisioning form state, semver tag/release model, checks list, sync/propose actions (mocked git). |
| No **scoped resource manifest** | FN-AST-008, FN-FNS-001..003 | L3 Foundry | `resources.json` scope model + import counts; SDK publish path. |
| No **governance/history substrate** | FN-GOV-001/002/003, FN-PEER-* | L2 Ontology + L3 Foundry | Transaction log + rollback snapshots + health-check rules (extend `workshop/validate.ts` precedent) + peering job state machine. |
| No **scoping canvas + guidance bank** | FN-SCP-001..004 | L3 Foundry | Card-graph renderer on `GraphCanvas` substrate + verbatim question bank from `notes +.txt`. |
| No **functions SDK execution** | FN-FNS-001..003, FN-AIP-001/002/005 | L1 Application | `LanguageModels` shim (createChatCompletion over `llmChat`) so AIP functions run inside the harness. |
| No **pipeline LLM node runtime** | FN-PLM-001/003 | L1 Application | Template config + `Use LLM` node execution via L0 client. |
| No **verification gate discipline** for new slices | all new | L3 Foundry | `nik check` = `tsc` + `vitest` + dev-tab console clean + ledger regen + light/dark token check. Already the standard; kept as harness rule. |

## Layer-by-layer summary

- **L0 (Model)** — needs the model catalog picker (FN-FDE-009) as the only L0 UI growth; no substrate change. Keys, routing, traces already work.
- **L1 (Application)** — is where most missing work concentrates: modes/skills, variables, system-prompt editor (rich text + `/`-insert), functions SDK shim, Use-LLM pipeline nodes, prompt gallery. Reuses preset schema and L0 client; no harness rewrite required, mostly new panels + a permissions/variables model.
- **L2 (Ontology)** — needs geo typing, branch/versioning, health-check rules, mapping-wizard property maps. Extends `valueTypes`, datasets, transaction log. No L0 knowledge allowed.
- **L3 (Foundry)** — needs map canvas, histogram, facet engine, observability page, machinery graph analytics, repo views, peer manager, scoping canvas. All render/interaction; no reasoning decisions.
- **L4 (FDEs)** — needs session/approval (done), then modes, permission matrix, skill-set modal, tiered agent templates. Extends tools registry + orchestrator approval path.

## What does NOT need to change

- Provider client (`src/llm/client.ts`), workspace persistence (`src/store.ts`), registry contract (`HarnessModule`), pack loader, theme tokens — all stable. New features compose on top.
- Orchestrator's observe→plan→act→verify loop and dryRun/approval gates — extension point for T2 agent tools, not a rewrite.

## Execution model

Break each missing cluster into **one GOAL** (theme) → **2–4 TASKS** (slices), each with its own master prompt in `master-prompts/tasks/`. Every task prompt states: layer, functions, harness prerequisite from this map, files to touch, acceptance gate, and a rollback note. See `master-prompts/GOALS.md` for the tracking index.
