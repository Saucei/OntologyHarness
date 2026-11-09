# Master Prompt Index — Ontology Harness (priority order)

Sorted by dependency + leverage: P0 makes the harness real, P1 makes it useful, P2 makes it excellent, P3 makes it shippable. Each file is a standalone brief an AI agent or engineer can execute against the codebase.

| # | File | Topic | Priority |
|---|---|---|---|
| 01 | `01-agentic-tool-loop.md` | Agentic tool-use loop & orchestrator (typed tools, dryRun, approvals) | P0 |
| 02 | `02-persistence-workspace.md` | Workspace persistence (SQLite/JSON), datasets/jobs/workers/traces survive restart | P0 |
| 03 | `03-secrets-keyring.md` | Move API keys from localStorage → OS credential store (Windows Credential Manager) via Tauri | P0 |
| 04 | `04-llm-streaming-hardening.md` | Streaming responses, retries, timeouts, per-worker model routing | P0 |
| 05 | `05-live-swarm-execution.md` | Replace simulated swarm steps with real LLM worker calls + approval gates | P0 |
| 06 | `06-aip-grounded-runtime.md` | AIP Logic grounded runtime: retrieval over corpus, real citations, publish | P1 · **done (slice 3)** — 10-chunk seed corpus, BM25-style retrieval (unique path Tauri+browser), cite-or-refuse policy enforced pre-LLM, [n] citation chips → source highlight, per-chunk scores in debugger, publishable + replayable logics persisted in workspace meta |
| 07 | `07-ontology-persistence.md` | Ontology Studio CRUD persistence + value-type validation | P1 · **done (slice 1)** — registry-bound property types, Validate clean, dependents+typed-name delete, JSON export/import, store-persisted |
| 08 | `08-data-hub-io.md` | Round-trip hash guarantee, XLSX verification, profiling stats, schema-mapping | P1 · **partial (slice 1)** — sha256 provenance, ✓ round-trip proof in UI, profiling panel, XLSX sheet picker, dataset persistence + refcount delete, JSON+manifest export. *Mapping wizard deferred.* |
| 09 | `09-jobs-artifacts.md` | Analyst Jobs ↔ artifacts linking, worker-roster assignee, editable fields | P1 · **done (slice 2)** — attachment chips w/ previews (dataset rows), roster dropdown, date/priority, **drag-drop kanban**, WIP warn on Review, JSON export v2, deep links (Jobs→Data Hub/Studio/Swarms) |
| 10 | `10-workshop-publish.md` | Workshop real publish round-trip + persisted widget configs | P1 · **done (slice 2)** — shared validator (`src/workshop/validate.ts`) for UI + agent tool, config autosave, immutable `vN` snapshots, **block → fix → publish** verified, live preview w/ dataset rows, rollback (`v2` via republish) |
| 11 | `11-swarm-telemetry.md` | Swarm run history (JSONL), replay, cost/token aggregation, export | P2 |
| 12 | `12-presets-live.md` | Presets actually dispatch to provider; fork persistence; real success stats | P2 |
| 13 | `13-manifest-phase1.md` | Gold-standard corpus parse: vision/OCR, thumbnails, click-through viewer | P2 |
| 14 | `14-ui-a11y-audit.md` | axe pass, contrast, keyboard nav, reduced-motion, onboarding wizard | P2 |
| 15 | `15-graph-depth.md` | Subgraph export, node expansion, graph selection → job, minimap UX | P2 |
| 16 | `16-packaging-release.md` | `tauri:build` installer, mac .icns, CSP, updater, signing notes | P3 |
| 17 | `17-tests-ci.md` | Unit + integration tests, CI workflow, acceptance checklist runner | P3 |

**Dependency notes:** 01 depends on 02+03 for anything beyond dry-run; 05 depends on 01+04; 12 depends on 05; 16/17 last.

**Stage 2 charters:** `STAGE_2_MASTER_PROMPT.md` (Stage 2 — P1 “real → valuable”) · `STAGE_2_SLICE_2_MASTER_PROMPT.md` · `STAGE_2_SLICE_3_MASTER_PROMPT.md`. **Stage 2 COMPLETE.**

**Stage 4 charter:** `STAGE_4_FUNCTION_INVENTORY.md` (~960 words) — inventory pipeline: parse/group reference corpus by capability family → extract atomic functions with image citation → score by breadth/depth/reach → T1/T2/T3 tiers → map to modules with BUILT/PARTIAL/MISSING/INSTRUCTIONAL/REJECTED ledger → per-cluster master prompts in `master-prompts/functions/` → palette search terms from corpus phrasing. Produces `FUNCTIONS.md`, `functions.json`, `UI_GAPS.md`, and end-to-end acceptance on at least one T1 function.

**Stage 3 prompts:** `stage-3/INDEX.md` — one master prompt per section, P2/P3 punch list: `S3A` swarm telemetry/replay/cost caps · `S3B` presets live dispatch + forks + stats · `S3C` gold corpus parse (vision/OCR, thumbnails, search) · `S3D` a11y/axe/contrast/onboarding wizard · `S3E` graph depth (export, expansion, selection→job, camera) · `S3F` packaging (installer, CSP, icons, updater) · `S3G` tests + CI + acceptance runner. Stage-3 definition of done: import → live swarm → replay → fork preset → ship installer, on one fresh profile.

Anchors (current code): `src/data/presets.ts` (schema v2) · `src/modules/SwarmsModule.tsx` (runId ledger, budget) · `src/workshop/validate.ts` (publish validator) · `src/lib/hash.ts` (sha256 round-trip) · `src/aip/retrieval.ts` (BM25 cite-or-refuse) · `scripts/acceptance.mjs` + `ACCEPTANCE_REPORT.md` (11/11) · `.github/workflows/ci.yml` · `RELEASE.md`.
