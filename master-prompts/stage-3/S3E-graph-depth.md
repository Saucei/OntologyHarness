# S3-E · Graph Depth — Export, Expansion, Selection→Action, Camera UX

**Role.** Visualization engineer. **Context anchors:** `src/modules/GraphCanvas.tsx` (React Flow; static 13-node seed; "Open in Quiver" is a dead button), `src/agent/graph.ts` (shared seed data), `src/jobs.ts` (attachments), `src/store.ts`.

**Why P2.** The lineage canvas is the product's centerpiece. Right now it is a poster — it must manipulate real state and spawn real work.

**Build:**
1. **Subgraph export**: selection (lasso via React Flow `onSelectionChange` or box-select) or full graph → JSON (Cytoscape-compatible shape) · PNG (html-to-image of the flow viewport) · SVG. Every export gets a manifest footer (selection ids, filter, generated-at, tool version).
2. **Node expansion**: double-click a Warehouse → lazy-generate dataset children from the store (imported datasets with matching provenance) merged into the flow; collapse on dbl-click; expansion state persisted in `ws.meta.graph.expanded`.
3. **Selection → action bar**: on selection show floating bar with three actions — "Create job" (job with dataset/trace attachments prefilled from selection kinds), "Export subgraph", "Send to Swarm → Lineage Audit" (presets by selection kind).
4. **Camera UX**: minimap click-to-jump; `fitView` on module entry only; remember pan/zoom per workspace in meta; legend panel (kind colors, edge weights).
5. **Status rings**: node ring color from data-quality flags you already compute in Data Hub profiling (green/amber/red); tooltip shows null % + freshness; ring animates only on change.

**Acceptance.** Import brew CSV → double-click Warehouse 1 → new dataset nodes merge in; lasso-select hops→IPA path → export SVG + "Create job" → kanban shows job with attachment chips; minimap click re-centers; restart preserves camera; ring flips red after importing a >50%-null column for a related node.

**Output contract.** Export utils (JSON/PNG/SVG) · expansion controller + merge logic · selection action bar · camera persistence · legend · tests for export schema + selection→job mapping.

**Non-goals.** No server-side graph compute, no graph diffing engine, no layout algorithm swap (keep seeded layout), no styling redesign.
