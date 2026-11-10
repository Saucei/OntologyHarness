# GOALS — Goals & Tasks Tracking

Single index of every remaining goal/task. Update status as slices land (ledger stays `functions.json`).
Last regen: 2026-11-10 — **105 functions: 86 INAPP / 7 PARTIAL / 12 MISSING**.

Layers: L0 Model → L1 Application → L2 Ontology → L3 Foundry → L4 FDEs ([layers doc](ARCHITECTURE_LAYERS.md)).
Harness prerequisites: [HARNESS_CHANGE_MAP.md](HARNESS_CHANGE_MAP.md). Plugins: [ARCHITECTURE_PLUGINS.md](ARCHITECTURE_PLUGINS.md).

## Goal index

| Goal | Theme | Functions | Tasks | Done |
|---|---|---|---|---|
| GOAL-01 | FDE Runtime Shell (finish) | FN-FDE-004, 005, 006, 007, 008, 009, 010, 011, 012 | T-01..T-06 | T-01/T-02/T-03/T-04/T-05/T-06 ✅ |
| GOAL-02 | Agent Studio Authoring | FN-AST-001..010 | T-07..T-11 | T-07/T-08/T-09/T-10/T-11 ✅ |
| GOAL-03 | Session Observability | FN-OBS-001..005 | T-12..T-14 | T-12/T-13/T-14 ✅ |
| GOAL-04 | Machinery Analytics | FN-MCH-001..008 | T-15..T-17 | T-15/T-16/T-17 ✅ |
| GOAL-05 | Geo / COP | FN-GEO-001..003 | T-18..T-20 | T-18/T-19/T-20 ✅ |
| GOAL-06 | Pipeline LLM | FN-PLM-001..003 | T-21..T-22 | T-21/T-22 ✅ |
| GOAL-07 | Governance & Peering | FN-GOV-001..003, FN-PEER-001..003 | T-23..T-24 | T-23/T-24 ✅ |
| GOAL-08 | Scoping & Platform | FN-SCP-001..004, FN-MKT-002/003 | T-25..T-27 | T-25/T-26/T-27 + FN-MKT-001 (T-32) ✅ |
| GOAL-09 | Functions SDK & corpus-1 closeout | FN-FNS-001..003, FN-AIP-*, FN-ARC-002, FN-DAT-*, FN-VRT-*, FN-ONT-003, FN-BLD-017, FN-FLT-006/007 | T-28..T-32 | T-31/T-32 ✅ |
| GOAL-10 | Production Line Editing & Re-Seed (user-directed) | FN-ARC-002 canvas, FN-MCH fixtures, ontology/value-type seeds | T-33 | T-33 ✅ |

## Task index (each task has its own master prompt in `master-prompts/tasks/`)

| Task | Title | Layer | Functions | Master prompt | Status |
|---|---|---|---|---|---|
| T-01 | FDE Composer Ribbon + Count Chips | L4 | FN-FDE-004 | `tasks/T-01-fde-ribbon.md` | DONE |
| T-02 | Modes (tool-carrying) + `Adds N tools` | L1/L4 | FN-FDE-005, FN-FDE-011 | `tasks/T-02-fde-modes.md` | DONE |
| T-03 | Tool Permission Matrix (If/Else Allow/Ask) | L4 | FN-FDE-006 | `tasks/T-03-fde-permission-matrix.md` | DONE |
| T-04 | Skill Set Modal + Documentation Attach | L1 | FN-FDE-007, FN-FDE-008 | `tasks/T-04-fde-skills-docs.md` | DONE |
| T-05 | Model Catalog Picker + Reasoning Tier + Keyboard Protocol | L0/L1 | FN-FDE-009, FN-FDE-010, FN-FDE-012 | `tasks/T-05-fde-model-catalog.md` | DONE |
| T-06 | Prompt Template Gallery | L1 | FN-FDE-012 (standalone half) | `tasks/T-06-fde-prompt-gallery.md` | DONE |
| T-07 | Agent Inputs + Session Completion Policy | L1 | FN-AST-001, FN-AST-009 | `tasks/T-07-ast-inputs-policy.md` | DONE |
| T-08 | Pre-computed Variables + Templates | L1 | FN-AST-002 | `tasks/T-08-ast-variables-templates.md` | DONE |
| T-09 | Variable Operation Chains | L1/L2 | FN-AST-003 | `tasks/T-09-ast-variable-chains.md` | DONE |
| T-10 | Tools Binding + System Prompt Editor | L1 | FN-AST-004, FN-AST-010 | `tasks/T-10-ast-tools-prompteditor.md` | DONE |
| T-11 | Repo Lifecycle (provisioning / release / checks / scoped imports) | L3 | FN-AST-005/006/007/008 | `tasks/T-11-ast-repo-lifecycle.md` | DONE |
| T-12 | Observability Timeline + Event Table | L3 | FN-OBS-001, FN-OBS-002 | `tasks/T-12-obs-timeline-events.md` | DONE |
| T-13 | Session Replay + Logs Table | L3 | FN-OBS-003, FN-OBS-005 | `tasks/T-13-obs-replay-logs.md` | DONE |
| T-14 | Trace Waterfall | L3 | FN-OBS-004 | `tasks/T-14-obs-waterfall.md` | DONE |
| T-15 | Machinery State-Graph Core | L2/L3 | FN-MCH-001, FN-MCH-002, FN-MCH-008 | `tasks/T-15-mch-core.md` | DONE |
| T-16 | Machinery Zooms, Deviations, Subprocesses | L3 | FN-MCH-003, FN-MCH-004, FN-MCH-007 | `tasks/T-16-mch-zooms-deviations.md` | DONE |
| T-17 | Path Explorer + Duration Histogram | L3 | FN-MCH-005, FN-MCH-006 | `tasks/T-17-mch-paths-histogram.md` | DONE |
| T-18 | Map Component + Geo Typing (harness change) | L2/L3 | FN-GEO-001 (substrate) | `tasks/T-18-geo-map-substrate.md` | DONE |
| T-19 | Cluster Layers + Bubble/Metric Cards | L3 | FN-GEO-001, FN-GEO-003 | `tasks/T-19-geo-cluster-bubbles.md` | DONE |
| T-20 | COP Facet Rail (filters + histogram + linkage) | L3 | FN-GEO-002 | `tasks/T-20-geo-cop-rail.md` | DONE |
| T-21 | Pipeline Build Settings + Legend Canvas | L3 | FN-PLM-001, FN-PLM-002 | `tasks/T-21-pipeline-build-legend.md` | DONE |
| T-22 | Use-LLM Node Template Config | L1 | FN-PLM-003 | `tasks/T-22-pipeline-use-llm-node.md` | DONE |
| T-23 | Branching, History & Health Gates | L2/L3 | FN-GOV-001/002/003 | `tasks/T-23-governance-history-health.md` | DONE |
| T-24 | Peer Manager + Mapping Wizard | L3 | FN-PEER-001/002/003 | `tasks/T-24-peer-manager-wizard.md` | DONE |
| T-25 | Scoping Funnel Canvas + Guidance Bank | L3 | FN-SCP-001/002 | `tasks/T-25-scoping-canvas-bank.md` | DONE |
| T-26 | Scoping Matrix + Checklist | L3 | FN-SCP-003/004 | `tasks/T-26-scoping-matrix-checklist.md` | DONE |
| T-27 | Code Workspaces + Tiered Agent Templates | L3/L4 | FN-MKT-002/003 | `tasks/T-27-platform-workspaces-templates.md` | DONE |
| T-28 | Functions SDK + Ontology Completions | L1 | FN-FNS-001/002/003 | `tasks/T-28-functions-sdk-completions.md` | TODO |
| T-29 | AIP Logic Hardening | L1 | FN-AIP-001/002/005/006/007 | `tasks/T-29-aip-hardening.md` | TODO |
| T-30 | Vertex Expansion | L2/L3 | FN-VRT-001..007 | `tasks/T-30-vertex-expansion.md` | TODO |
| T-31 | Data & Link Closeout | L2/L3 | FN-ARC-002, FN-DAT-001/002/003, FN-ONT-003, FN-BLD-017, FN-FLT-006/007 | `tasks/T-31-data-link-closeout.md` | DONE |
| T-32 | T1 Folder Install (Tauri `%APPDATA%` scan) | L3 | FN-MKT-001 (finish) | `tasks/T-32-plugin-folder-install.md` | DONE |
| T-33 | Production Line Editor + Automotive Re-Seed (de-brewery) | L2/L3 | FN-ARC-002, FN-MCH-001/002/008 (substrate) | `tasks/T-33-production-line-editor.md` | DONE |

## Completed (reference)

- W1 Slice 1 (FN-FDE-001/002/003) — Agent Console sessions + Outline + approval cards ✅
- T0 registry, T1 packs, Layer stack — see architecture docs ✅

## Rules

- A task ends when: master prompt gates pass (`tsc`, `vitest`, console clean, ledger regen, light/dark tokens), and this file's Status is flipped to DONE with the slice name + commits.
- Tasks run **one at a time per layer**; parallel across layers needs explicit "parallel-safe" note in the master prompt (file boundaries disjoint).
- If a master prompt's harness prerequisite from `HARNESS_CHANGE_MAP.md` is unmet, the task starts with the prerequisite slice instead — no skipping.
