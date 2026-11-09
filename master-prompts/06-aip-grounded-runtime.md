# P1 · AIP Logic Grounded Runtime

**Role.** Applied-AI engineer (RAG). Depends on: 04 (streaming), preferably 02 (persistence for traces). Context: `AipLogicPanel.tsx` (scripted), corpus at `public/manifest.json` (134 images), no real document retrieval exists.

**Why P1.** AIP Logic is the heart of the "AIP" story — it must answer from *your* content with citations, not hallucinate TB guidelines.

**Build:**
1. Local retrieval: build a chunked index from (a) reference-library OCR text (see 13) + (b) workspace datasets + (c) object type descriptions. Store in SQLite FTS5 (or JSON + MiniSearch — pick FTS5).
2. Retrieval step: embed user question? No embeddings infra — use FTS5/BM25 top-k 6 with highlighted snippets. Note honest limitation; mark vector search as optional future upgrade.
3. Grounded chain: retrieve → inject chunks into prompt with `[1..6]` markers → LLM answers with mandatory inline citations → UI renders citation chips; clicking chip scrolls to source panel (image or text).
4. Publish: "Publish function" writes the logic (name, prompt, retrieval config, schema) into workspace; Parameter inputs (question + maxChunks) validated; unpublish = archive, not delete.
5. Debugger: real trace — retrieval hit list w/ scores, prompt tokens, model, latency, cited chunk IDs.

**Acceptance.** Ask the TB question → answer cites actual chunks; "nonsense question about Mars" → "insufficient grounding in corpus" refusal, no fabrication. Published function replays identically on second run.

**Output contract.** FTS index builder · retrieval module · grounded prompt template · citation UI · publish schema.
