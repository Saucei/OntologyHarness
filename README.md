# Ontology Harness

**CI:** [![ci](https://github.com/berry/ontology-harness/actions/workflows/ci.yml/badge.svg)](https://github.com/berry/ontology-harness/actions/workflows/ci.yml) · **Verify:** `npm run verify` (tsc + build + vitest, 24/24) · **Acceptance:** `npm run acceptance` → `ACCEPTANCE_REPORT.md` (11/11)

A Foundry-class **ontology workbench** — desktop app (Tauri + React + TypeScript) inspired by the Palantir Foundry/AIP patterns in the reference corpus at `C:\Users\Berry\Desktop\Ontology Harness`.

**Theme:** transparent white + green throughout — frosted-glass surfaces (`backdrop-filter: blur`), emerald accent scale, green-only hue policy. See `DESIGN_TOKENS.md`.

## LLM Providers (standalone, native)

Calls are routed through the **Rust core** (`llm_chat` in `src-tauri/src/llm.rs`, reqwest + rustls) — no webview CORS, keys never leave the native process. Browser dev mode falls back to direct `fetch` (works for Ollama / CORS-enabled endpoints).

Built-in providers (`src/llm/client.ts`): OpenAI · Anthropic (messages API) · OpenRouter · Groq · Google Gemini · Ollama (local) · Azure OpenAI · any custom OpenAI-compatible `/chat/completions` endpoint. Configure in the **LLM Providers** module: base URL, model, key, temperature, max tokens, and the agent system prompt. Settings persist to localStorage; keys are never logged or embedded in traces. Use **Test connection** for a live round-trip. AIP Logic switches between `● live` and `○ offline (simulated)` automatically based on key presence.

The agentic contract the modules follow lives in **`AGENTIC_MASTER_PROMPT.md`** (~290 words): observe→plan→act→verify→report, typed tool contract with `dryRun` default, citation-first grounding, provider routing, guardrails, memory model, failure handling, and a strict output format (*Action · Evidence (IDs) · Verification · Next step*).

**Stage 3 (P2/P3 · excellence → shippable) — ✅ implementation complete** (design v3 overlay: v3 tokens w/ 180ms motion budget + cream ramps + WCAG text scale · 3-level IAabulary — Work/Intelligence/Inspect re-sectioning · favorite pins via right-click menu · anchored global breadcrumbs · ESM `html-to-image` PNG export. All prior P0–P3 logic unchanged.)
- **S3-B presets live ✅** — `src/data/presets.ts` schema v2 + validator; Run executes through the orchestrator (streaming state in-card); forks persist to `meta.presetForks`; ledger stats (runs/ok%/avg) sorted Most used / Highest success; completion creates a review job with dataset attachment.
- **S3-A telemetry ✅** — `runId`-tagged swarm steps (`runName/stepIdx`), Run history modal with per-run success/token/latency + **step replay from ledger** + `.ohtrace` export; per-run token budget enforces `budget_exhausted` halt; sidebar 24h spend estimate (`estimateSpend` in `store.ts`).
- **S3-E graph depth ✅** — double-click Warehouse expands saved datasets as `ds-` nodes with null-quality status rings; Shift-drag lasso → **selection action bar** (Create job with attachments → kanban, Send to swarm → Lineage Audit template, SVG/PNG export with live layout); camera persists in `meta.graph.camera`; legend panel; `OnInit` restores viewport.
- **S3-C corpus gold ✅ (infra)** — `scripts/parse-manifest-v2.mjs` (heuristics → vision tagging via any OpenAI-compatible endpoint; resumable; `VISION_BASE`/`VISION_MODEL` env-configured), `manifest.json` v2 with `entries[]`, full-text search in ManifestView + **lightbox** per image (app/features/OCR/confidence/⚠ review). Real vision pass runs when a vision endpoint is configured (`node scripts/parse-manifest-v2.mjs --vision`).
- **S3-D a11y/onboarding ✅** — `Alt+1–9` module jumps, shortcuts cheat-sheet (`Alt+1–9`, ←/→, Ctrl+K listed), dialog roles / aria-labels, reduced-motion + reduced-transparency media queries, 3-step first-run **wizard** (name → provider incl. Ollama no-key → import sample CSV → Dataset Triage preset). Verified in browser: wizard step 2 applied Ollama (`llama3.1`, `hasKey:true`).
- **S3-G tests/CI ✅** — vitest suites: hash (round-trip), valueTypes, workshop validate, jobs migration, retrieval (TB→cite, Mars→refuse); 24/24 passing (`npm run test`/`verify`); `scripts/acceptance.mjs` → 11/11 PASS in `ACCEPTANCE_REPORT.md`; CI workflow `.github/workflows/ci.yml` (Windows, Node 24) + README badge.
- **S3-F packaging ✅ (config+docs)** — CSP allowlist from the provider registry (no `csp: null`), self-hosted fonts (`@fontsource`, no Google Fonts runtime), `version:sync` script, `RELEASE.md` (pre-flight gates, installer outputs, smoke test, signing note, rollback), CI uploads dist+report artifacts. Full `tauri:build` NSIS/MSI execution is the remaining manual release step.

## Stage 2 (P1 · value) — ✅ complete

- **Slice 1 (WS2+WS3) ✅** — value-type registry property validation (`Validate → 0 issues`, schema-clean), dependents + typed-name delete, sha256 import/export round-trip proof (✓ verified in-app), profiling panel, JSON+manifest export, XLSX sheet picker, dataset persistence + refcount delete. *Mapping wizard deferred.*
- **Slice 2 (WS4+WS5) ✅** — Analyst Jobs: artifact chips with preview popovers (dataset rows render), roster assignee, due-date + priority cycle, pointer drag-drop kanban with WIP guard on Review, JSON export v2, deep links into Data Hub/Studio/Swarms. Workshop: shared validator (UI + `workshop.publish` agent tool), config autosave to workspace, **publish blocked with named issues → fix → published v1 → preview with live CSV rows → history → rollback (v2)** — all verified live.
- **Slice 3 (WS1) ✅** — AIP Logic grounded: 10-chunk seed corpus (`src/aip/corpus.ts`), BM25-style retrieval in `src/aip/retrieval.ts` (single path, Tauri+browser; rusqlite FTS5 noted as upgrade path), domain-synonym expansion (TB↔tuberculosis), **cite-or-refuse enforced pre-LLM** (Mars question → refusal, zero LLM calls, debugger shows `NO LLM CALL ISSUED`), `[n]` citation chips highlight the source card ([2] verified), debugger shows per-chunk scores + citation parse count, publishable logics (`logic-*`) persisted in workspace meta with replay + archive — verified to survive restart.

## P0 platform (native gateway + workspace)

Implemented from `master-prompts/01-05`:
- **Workspace persistence** — SQLite via Rust (`rusqlite` bundled) at `%APPDATA%/com.berry.ontologyharness/workspace.db`: jobs, workers, object types, datasets, traces, audit. Hydrated once at boot in `main.tsx` via `src/store.ts`; all writes debounced (400ms). Browser dev falls back to localStorage.
- **Secrets** — Windows Credential Manager via `keyring` (service `ontology-harness`). The webview never sees the key after save; the Rust gateway pulls it per call (`llm_chat` with empty `apiKey` → keyring). Providers module: save/test/delete only.
- **Streaming + routing** — `llm_chat_stream` SSE parser emits `llm-token` events (OpenAI `choices[].delta` and Anthropic `content_block_delta`); AIP Logic renders tokens live. Per-task-class model routing (`reasoning/extraction/code/cheap`) in Providers; blank = provider default. 3-try exponential backoff on 429/5xx/network (Rust side).
- **Agent loop** — `src/agent/orchestrator.ts` (max 8 hops, `<tool>` protocol, approval gates for `dryRun:false`), `src/agent/tools.ts` (graph.query, ontology.list/get, corpus.search, pipeline.run, workshop.publish — all dryRun by default), Agent Console module with tool trace + approval UI. Verified end-to-end with `scripts/mock-llm.mjs` (deterministic OpenAI-compatible mock): agent called `ontology.list`, consumed the result, answered with IDs/Evidence.
- **Live swarms** — real worker LLM calls (extraction class) with checkpoints (pause/resume resumes mid-plan), per-worker traces into the ledger, real stats in AI Workers. `LIVE` toggle in the swarm panel; offline fallback simulates.

Offline dev loop: `node scripts/mock-llm.mjs` (OpenAI-compatible on :8399) + set provider **Custom** → `http://localhost:8399/v1` → agent and AIP panels work with no API keys.

## Roadmap master prompts

`master-prompts/INDEX.md` — 17 priority-ordered standalone prompts (P0 01–05 → P1 06–10 → P2 11–15 → P3 16–17) covering tool-use orchestration, persistence, keyring security, streaming/routing, live swarms, grounded AIP, ontology/jobs/workshop persistence, telemetry, presets, corpus parse, a11y, graph depth, packaging, tests/CI. Work top-down: 01–05 are the spine; everything else hangs off them.

## Modules (v2 — agentic layer)

**Light/dark/auto theming** — sidebar toggle (sun/moon/monitor icons). Light: cream-white glass + emerald. Dark: deep green-charcoal, warm off-white text, softened glows — designed, not inverted.

| Module | What it does |
|---|---|
| **Agentic Swarms** | Launch multi-worker runs (Dataset Triage, Lineage Audit, DQ Sweep, Workshop Review, AIP Logic Draft, Executive Summary): orchestrator + worker topology canvas, live streamed trace, token meter, pause/resume/stop; every completed swarm auto-opens an Analyst Job in Review. With a configured LLM provider, the run finishes with a real model-generated executive summary. |
| **AI Workers** | 6 seeded dedicated workers (Scribe, Watchman, Forge, Sage, Sentinel, Herald) — model, provider, tools, live status, 30-day stats (runs / success / latency / cost); add your own inline. |
| **Presets** | 8 one-click task presets (prompt + tools + worker + output schema); "Run preset" queues an analyst job; fork any preset as custom. |
| **Analyst Jobs** | Kanban — Backlog → In Progress → Review → Done; add jobs inline, ←/→ move, per-card activity feed, JSON export. Jobs created by swarms and Data Hub imports appear here automatically. |
| **Data Hub** | Drag-drop or file-pick **CSV / JSON / XLSX** → inferred typing, 60-row preview, provenance notice; auto-chart (bar/line/donut) with series picker; export CSV/JSON; "Send to Job". |

## Modules (v1 core)

| Module | Mirrors | Status |
|---|---|---|
| Lineage Graph | Vertex sub-graph / system lineage (`vertex_overview-system_graph.png`) | ✅ Interactive React Flow canvas, 13 nodes / 24 relations, selection inspector, series toggle |
| Ontology Studio | Ontology Manager + Object Explorer | ✅ CRUD object types, properties/links/actions tabs, live search |
| Pipeline Builder | Datasource → Transform → Ontology DAG (`pipeline_overview.png`) | ✅ Palette, DAG cards, build log, preview grid |
| Workshop Canvas | Workshop module builder (instructor build flow) | ✅ Sections, widget palette, object-set binding panel, publish flow |
| AIP Logic | AIP Logic functions / preview-run debugger | ✅ Prompt composer, simulated execution trace, canned result |
| Corpus Manifest | Phase 1+2 of master prompt | ✅ `scripts/parse-manifest.mjs` categorizes all 134 reference images into `public/manifest.json` |
| LLM Providers | Standalone native gateway | ✅ 8 providers, test connection, agent system prompt editor |

## Quick start

```powershell
cd C:\Users\Berry\Desktop\OntologyHarness
npm install            # already done
npm run dev            # vite dev server → http://localhost:1420
npm run tauri:dev      # native window (requires Rust toolchain on PATH: $env:USERPROFILE\.cargo\bin)
npm run tauri:build    # production .exe / installer
npm run manifest       # re-parse the reference corpus into public/manifest.json
npm run build          # type-check + production bundle
```

## Command palette

`Ctrl/Cmd + K` — fuzzy-jump to any module. Green-highlighted nav pip marks the active module.

## Corpus analysis (Phase 1–2)

`public/manifest.json` — 134 files parsed from the reference folder, categorized:

| Category | Count | Contents |
|---|---|---|
| Learning & Docs | 99 | Instructor-led course captures, green-box step annotations |
| Application Building | 19 | Workshop widgets, sections, object-set binding |
| Data Integration | 11 | Code Repositories, Pipeline Builder (join/union) |
| Architecture & Lineage | 3 | `pipeline_overview.png`, `branches-1.png`, `vertex_overview-system_graph.png` |
| AIP & LLM Logic | 1 | Logic function / test-your-function capture |
| Ontology Layer | 1 | Ontology Manager app-launcher capture |

Heuristic classification (filename keywords + training-context inference). Re-run `npm run manifest` after adding images.

## Layout

```
src/
  App.tsx                  app shell: sidebar nav + Ctrl/Cmd-K palette
  tokens.css               transparent white/green design tokens
  app.css                  module layouts
  components/Icon.tsx      stroke icon set
  components/CommandPalette.tsx
  modules/                 GraphCanvas · OntologyStudio · PipelineBuilder · WorkshopCanvas · AipLogicPanel · ManifestView
  data/ontology.ts         seed object/link/action types (brewery domain, mirrors reference)
scripts/parse-manifest.mjs corpus parser
src-tauri/                 Tauri 2 shell (Rust), native LLM gateway, icons generated via System.Drawing
AGENTIC_MASTER_PROMPT.md  agentic contract (~290 words): tools, routing, guardrails, output format
```
