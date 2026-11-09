# P1 · Ontology Studio Persistence & Validation

**Role.** Knowledge-engineering lead. Depends on: 02 (workspace store). Context: `OntologyStudio.tsx` — CRUD exists but all edits die on refresh; value types listed but never enforced.

**Why P1.** The ontology IS the product; an ontology that evaporates on refresh cannot anchor agents, swarms or lineage.

**Build:**
1. Persist object/link/action types + properties + value types to workspace store; load on boot (seed only on first run).
2. Value-type registry: define primitives + constrained types (e.g. `ValueType/WarehouseId` = string matching `^WH-\d{3}$`; `abv` = decimal 0–15). Property editor binds to value types; inline validation messages; invalid save blocked with explanation.
3. Backing preview: selecting a property shows 3 sample values from the backing dataset (mocked from seed for now; real rows when 02's dataset store lands).
4. Delete safety: typed confirmation (type object-type name) when links/actions reference it; shows dependents first.
5. Import/export: ontology subset as JSON (schema doc: objectType/linkType/actionType/valueType) — feeds other harnesses.

**Acceptance.** Create `QualityIssue` type → restart → still there; enter abv=99 → blocked with message; export JSON → re-import on clean profile → identical hashes.

**Output contract.** Store schema diff · value-type engine · validated editor · JSON export format with version tag.
