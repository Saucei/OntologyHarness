# P2 · Graph Depth — Export, Expansion & Action Links

**Role.** Visualization engineer. Context: `GraphCanvas.tsx` — static 13-node seed; "Open in Quiver" button does nothing; selection can't spawn jobs/exports.

**Why P2.** The lineage canvas is the product's centerpiece; shallow graph = shallow insight.

**Build:**
1. Subgraph export: selected node(s) or full graph → `.json` (Cytoscape-compatible) + PNG of viewport + SVG; includes metadata (selection, filters, generated-at).
2. Node expansion: double-click Warehouse → lazy-load its datasets (from workspace) merging into graph; collapse on second double-click; expansion state in store.
3. Selection → action: right-click/selection-bar on nodes: "Create job from selection", "Export subgraph", "Send to swarm (Lineage Audit)".
4. Minimap UX: region highlight + click-to-jump; zoom-to-fit on module enter; remember camera per workspace.
5. Node styling consistency: status ring (fresh/stale/failing) from data-quality flags once available; legend panel.

**Acceptance.** Double-click Warehouse 1 → 3 dataset nodes appear; export SVG of hops→IPA path; create job from selected nodes → Kanban shows it with link chips.

**Output contract.** Export utils · expansion controller · context menu · camera state persistence · legend component.
