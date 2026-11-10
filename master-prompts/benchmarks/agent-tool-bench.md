# Agent tool-usage benchmark — LFM2.5 2.6B (reference model)

- Date: 2026-11-10T12:40:11.349Z
- Model: `lfm2.5-2.6b-heretic:latest` via Ollama (native tool-calling bridge, think:false)
- Result: **6/6 areas PASS** · total 1125 s
- Contract: real orchestrator loop, real tools, real workspace data. Approvals always declined — dry-run defaults expected.

| Tool | Area | Status | Hops | Duration | Tool calls | Notes |
|---|---|---|---|---|---|---|
| graph.query | Lineage Graph | PASS | 5 | 335.8 s | graph.query, ontology.list, graph.query, graph.query | The graph query around the **paint stage (STG-030)** returned the following lineage and no |
| ontology.list | Ontology Studio | PASS | 2 | 168.2 s | ontology.list | The ontology contains the following object types (all retrieved from the ontology registry |
| ontology.get | Ontology Studio | PASS | 3 | 114.9 s | ontology.list, ontology.get | The Product object type is **ot-product** (Vehicle Model). According to the ontology, it h |
| corpus.search | Corpus Manifest | PASS | 3 | 333.6 s | corpus.search, corpus.search, ontology.list | I found the following documents in the reference corpus related to pipelines: |
| pipeline.run | Pipeline Builder | PASS | 2 | 81.4 s | pipeline.run | The dry run validation completed successfully. |
| workshop.publish | Workshop Canvas | PASS | 2 | 90.7 s | workshop.publish | The Order Overview workshop module has been validated and is ready to publish. |

## Per-call detail

### graph.query — PASS
- `graph.query` {"focus":"paint stage","depth":5} — ok (0 ms)
- `ontology.list` {} — ok (0 ms)
- `graph.query` {"focus":"paint","depth":3,"kind":"process"} — ok (0 ms)
- `graph.query` {"focus":"paint stage","depth":3,"kind":"stage"} — ok (0 ms)
- Answer: The graph query around the **paint stage (STG-030)** returned the following lineage and node kinds.

**Lineage around the Paint Stage (STG-030):**

- **weld (STG-020)** → **paint (STG-030)** → **trim (STG-040)** → **marriage (STG-050)** → **test (STG-060)**
- **paint (STG-030)** 

### ontology.list — PASS
- `ontology.list` {} — ok (0 ms)
- Answer: The ontology contains the following object types (all retrieved from the ontology registry):

| ID | Name | Backing | Object Count |
|---|---|---|---|
| **ot-warehouse** | Distribution Center | derived/warehouse_dim | 3 |
| **ot-raw-material** | Raw Material | derived/raw_materia

### ontology.get — PASS
- `ontology.list` {} — ok (0 ms)
- `ontology.get` {"id":"ot-product"} — ok (0 ms)
- Answer: The Product object type is **ot-product** (Vehicle Model). According to the ontology, it has the following properties:

- **productId** (ValueType/ProductId)
- **name** (String)
- **platform** (String)
- **basePrice** (Decimal)

That's **4 properties** total.

**Verification:** T

### corpus.search — PASS
- `corpus.search` {"query":"pipelines","limit":20} — ok (2 ms)
- `corpus.search` {"query":"pipeline","limit":20} — ok (1 ms)
- `ontology.list` {} — ok (0 ms)
- Answer: I found the following documents in the reference corpus related to pipelines:

**Files found (14 total):**

- **pipeline_overview.png** – Architecture lineage diagram (Vertex / pipeline lineage)
- **branches-1.png** – Vertex / pipeline lineage diagrams
- **instructor_6rv9eqj974u5

### pipeline.run — PASS
- `pipeline.run` {"dryRun":true} — ok (0 ms)
- Answer: The dry run validation completed successfully.

**Validation Result: PASS**

- **Pipeline:** `pipeline_run` (dry run)
- **Nodes:** 7
- **Edges:** 6
- **Schema Check:** Types consistent (14 → 11 columns)
- **Join Keys:** Bureau ↔ Office Goods (compatible)
- **Ontology Backing:** R

### workshop.publish — PASS
- `workshop.publish` {"dryRun":true} — ok (1 ms)
- Answer: The Order Overview workshop module has been validated and is ready to publish.

**Result:** The module "Order Overview (seed)" (ID: Order Overview) passed validation with no issues. The validation report shows:

- **Verdict:** READY_TO_PUBLISH
- **Widgets:** 5
- **Bound:** 5
- **