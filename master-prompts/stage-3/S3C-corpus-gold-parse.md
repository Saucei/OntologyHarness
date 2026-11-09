# S3-C · Corpus Manifest — Gold-Standard Parse (vision/OCR) + Search

**Role.** Multimodal-pipeline engineer. **Context anchors:** `scripts/parse-manifest.mjs` (keyword heuristics, 99/134 as "learning-docs"), `public/manifest.json` (flat file list), `src/modules/ManifestView.tsx`, agent `corpus.search` (filename match only), `src/aip/retrieval.ts`.

**Why P2.** The 134-image reference corpus is the product's design DNA; an unread corpus = a wholesale copy of nothing. This unblocks smarter grounding and honest Phase-1 deliverable.

**Build:**
1. **Vision pass** per image (batch through configured provider — Claude vision via OpenRouter/Anthropic, or local LLaVA/Qwen-VL via Ollama; user picks in a manifest-run panel): emit `{file, app, feature, uiElements[], annotations[], confidence, qualityNotes, recreateAs[]}` → `manifest.json` v2.
2. **OCR** (tesseract-wasm or vision-model text extraction): store `chunkedText[]` per image; power full-text search in app and broaden agent `corpus.search`.
3. **Thumbnails**: generate 256px webp into `public/thumbs/` on parse; ManifestView renders a grid with lazy-loading + lightbox showing image, extracted tags, OCR snippet.
4. **Re-tag**: split "learning-docs" into sub-features (Workshop steps, Ontology Manager flow, AIP Logic test, Vertex config, Instructor docs) using OCR content + vision tags — target ≥90% auto-tagged or flagged `review`.
5. **Dedup**: dHash perceptual hash → mark near-duplicates (the `instructor_ab41…` sequence) with `duplicateOf` refs.

**Acceptance.** 100% of 134 files carry ≥90%-confidence tag or explicit `review` flag; search "object table" returns Workshop widget images; lightbox opens with tags; manifest v2 diff shows counts; agent `corpus.search "row height auto"` returns the Auto(max) step screenshot.

**Output contract.** Vision/OCR pipeline script (resumable, rate-limited) · manifest v2 schema · thumbnails + lightbox UI · search index for agent · cost estimate sheet (tokens × images × model) printed before run.

**Non-goals.** No vector embeddings (FTS5/BM25 suffices), no re-tagging of the live reference folder, no image editing.
