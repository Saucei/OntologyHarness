# Master Prompt — Stage 2 · Slice 3 (WS1 AIP Grounded Runtime + Stage Acceptance, ~500 words)

You are a staff applied-AI engineer completing Stage 2. Slices 1–2 are verified: sha256 round-trip proof, value-type validation, Jobs↔artifacts with drag-drop kanban, Workshop publish round-trip (block→fix→publish→rollback). P0 inviolable. Stage 2 closes when a grounded, publishable AIP logic answers a real question with real citations and the whole acceptance pack passes.

## Context anchors

`src/llm/client.ts` (streaming + routing) · `src-tauri/src/llm.rs` (SSE gateway) · `src/store.ts` (meta + traces) · `src/modules/AipLogicPanel.tsx` (currently simulated / ungrounded) · `src/modules/AgentConsole.tsx` (tool loop — do not regress) · `src/modules/ManifestView.tsx` (manifest only has filenames — no OCR yet, so seed the corpus ourselves) · `master-prompts/06-aip-grounded-runtime.md` · `UI_MASTER_PROMPT.md` (glass system, dark parity).

## Non-negotiable design decision

A single honest retrieval path, BM25-style ranking in TypeScript (token overlap with length normalization + phrase bonus; works identically in Tauri and browser; no native deps, no FTS5 divergence). Document rusqlite FTS5 as an upgrade path; do not dual-implement retrieval.

## Build

1. **Corpus seed** (`src/aip/corpus.ts`): 10–12 authoritative chunks mirroring the product’s domain — clinical TB guideline excerpt (isoniazid/rifampin/pyrazinamide/ethambutol, 2-month intensive + 4-month continuation, pyridoxine note), Foundry/Workshop knowledge (widget binding, object sets, preview run, ontology datasets, lineage semantics), plus the brewery domain glossary (Belgian Ale, IPA, batch, bbl, ABV). Each chunk: `{id, title, source, body}` with stable citation IDs (`chunk-tb-1` …).
2. **Retrieval** (`src/aip/retrieval.ts`): `retrieve(query, k=6)` → scored hits `{chunk, score}`; threshold-gated: if best score < TRESHOLD (tune ~0.28 of normalized max), return `grounded: false` — the UI must show **“insufficient grounding in corpus — refusing to answer”** and make **zero LLM calls** (log to trace as `blocked`).
3. **Grounded chain**: inject top-k into the system prompt with `[1..6]` markers; instruct the model to cite inline `[n]`; stream tokens; parse `[n]` → citation chips under the result.
4. **Citation UI**: chips `[1]…[n]` are buttons; clicking scrolls/highlights the matching source in a **Sources** panel (title, source, 300-char excerpt, score). Excerpt shown verbatim, never paraphrased.
5. **Debugger**: retrieval step shows real scores per chunk + token estimate + model + latency; final step logs citation count; `blocked` reason visible if refused.
6. **Publish**: “Publish function” writes `{v:1, name, systemPrompt, question, k, publishedAt}` to `ws.meta.aipLogics`; panel lists published logics with replay + archive (archive ≠ delete; keep for audit). Validation fails visibly if grounding failed this run.

## Acceptance (ordered)

Live preview on TB question → answer cites `[1]`/`[2]` (chips render; click → source excerpt + score). Mars/exoplanets question → refusal, **no network call**, debugger shows `blocked`. Publish → restart → logic still listed; replay reproduces identical pipeline. axe: no new critical issues. Refusal still refuses after publish.

## Non-goals

No vector DB, no embeddings API, no OCR (13 ships that later), no agent-loop changes, no new providers.

## Output contract

corpus + retrieval + grounded chain + citation UI + debugger + publish/replay · INDEX/README status · demo script (TB cite, Mars refuse, publish, restart, replay) · one paragraph on FTS5 upgrade path. Small diffs; never regress P0.
