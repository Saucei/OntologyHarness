# P2 · Corpus Manifest — Gold-Standard Parse (vision/OCR)

**Role.** Multimodal-pipeline engineer. Context: `scripts/parse-manifest.mjs` — keyword heuristics only; no per-image understanding; 99 files lumped as "learning-docs"; no click-through viewing; `ManifestView.tsx` shows a flat list.

**Why P2.** The reference library is the design DNA of this product; an unread corpus = a copy of nothing.

**Build:**
1. Vision pass per image (batch, cheap vision model or local BLIP/LLaVA via Ollama): emit `{file, app, feature, uiElements[], annotations[], quality, recreateAs[]}` to `manifest.json` v2.
2. OCR (tesseract or vision-model) to extract text snippets → stored under `text` for full-text search in app (powers corpus.search in agent tools).
3. Thumbnails: 256px webp for each image; Manifest view → click-through lightbox with metadata panel.
4. Re-tag: split "learning-docs" lump into sub-features (Workshop steps, Ontology Manager flow, AIP Logic test, Vertex config…) using extracted text, not filenames.
5. Dedup detection via perceptual hash (dHash) → mark duplicates.

**Acceptance.** 100% of 134 files get ≥ 90% confidence tag or `review` flag; search "object table" returns the Workshop images; lightbox opens image + tags.

**Output contract.** Vision pipeline script · manifest v2 schema · thumbnails · searchable corpus index.
