// Corpus seed — authoritative-ish chunks for grounded AIP previews.
// In production these come from OCR/FTS5 of the reference library (see 13);
// this seed makes the grounded path real end-to-end today.

export type CorpusChunk = { id: string; title: string; source: string; body: string }

export const CORPUS: CorpusChunk[] = [
  {
    id: 'chunk-tb-1', title: 'Pulmonary TB — standard regimen', source: 'Clinical Guidelines · TB §14–19',
    body: 'The recommended treatment for pulmonary tuberculosis is a 2-month intensive phase of isoniazid, rifampin, pyrazinamide and ethambutol (HRZE), followed by a 4-month continuation phase of isoniazid plus rifampin (HR). Total duration is 6 months for drug-susceptible disease. Directly observed therapy improves completion rates materially.',
  },
  {
    id: 'chunk-tb-2', title: 'TB safety — pyridoxine & hepatic monitoring', source: 'Clinical Guidelines · TB §20–23',
    body: 'Isoniazid causes peripheral neuropathy in a dose-dependent manner; supplement pyridoxine 10–25 mg daily in pregnancy, diabetes, renal impairment, HIV and malnutrition. Baseline and monthly hepatic panel for all patients on HRZE. Stop isoniazid if ALT exceeds 3× ULN with symptoms or 5× ULN without.',
  },
  {
    id: 'chunk-tb-3', title: 'TB — adherence & drug resistance', source: 'Clinical Guidelines · TB §24–27',
    body: 'Non-adherence selects for multidrug-resistant TB. Intensify adherence support: DOT, fixed-dose combinations, SMS reminders, social worker follow-up. Suspect resistance when smear-positive at 3 months, or contact with MDR-TB. Obtain Xpert MTB/RIF before modifying therapy.',
  },
  {
    id: 'chunk-ws-1', title: 'Workshop — object sets & bindings', source: 'Platform Docs · Workshop',
    body: 'Workshop widgets render ontology data via object sets. Every widget must declare an Input Object Set binding (an object set query or a variable holding one). Object Table binds a table to an object set; Property List binds to the active object; Filter widgets narrow the set; Button Group triggers actions. Unbound widgets are rejected at publish time.',
  },
  {
    id: 'chunk-ws-2', title: 'Workshop — publish & preview', source: 'Platform Docs · Workshop',
    body: 'Preview Run renders the module with current variable values — ontology edits are NOT applied. Publish validates bindings (all object sets resolve, prop types match), then writes an immutable module snapshot versioned v1, v2, …. Rollback republishes a prior snapshot as a new version. Row height Auto (max) sizes to grid content.',
  },
  {
    id: 'chunk-ws-3', title: 'Ontology — object types & value types', source: 'Platform Docs · Ontology Manager',
    body: 'Object types map to backing datasets via object type definition. Properties bind to value types (semantic primitives with constraints, e.g. WarehouseId matches ^WH-\d{3}$). Link types declare cardinality between object types. Action types bind functions to objects, enabling operational edits with permissions. Value types are declared once and reused across the ontology.',
  },
  {
    id: 'chunk-ont-1', title: 'Lineage — datasets to ontology', source: 'Platform Docs · Lineage',
    body: 'Datasets flow raw → clean → derived → ontology via pipelines. Ontology datasets back object types; derived datasets aggregate clean datasets across projects by Project Reference. Lineage graphs are computed from build metadata: every derived cell traces to raw source rows. Stale or failing builds surface as node health flags.',
  },
  {
    id: 'chunk-brew-1', title: 'Belgian Ale — brewery reference', source: 'Brewery Ops · Catalog',
    body: 'Belgian Ale SKUs (P-0001 class) brew from Malt, Hops and Corn bills of material; demand peaks April–July. Recipe IDs use the form R-A4F2 (4 alphanumerics). Batch IDs B-1842. ABV is typically 6.0–6.5% — track above 8 within the constraint (max 15). Reorder point triggers at 40 bbl storage minimum.',
  },
  {
    id: 'chunk-brew-2', title: 'IPA & hop dosing', source: 'Brewery Ops · Production',
    body: 'IPA recipes (NYC IPA 36 bbl, PIT IPA 34 bbl, DC IPA 35 bbl) demand late hop additions; hop utilization falls above 170°F at knockout. Malt:hops ratio for IPA is roughly 4:1 by weight. IPA demand 211.18 bbl trailing 90 days; Belgian Ale 220.77 bbl — the Belgian SKU governs raw material contracts.',
  },
  {
    id: 'chunk-ops-1', title: 'Executive briefing — cadence', source: 'Internal · Ops Review',
    body: 'Weekly executive brief: jobs completed vs WIP, swarm pass rate, lineage health (failing/stale nodes), cost per job, top blockers. Keep to one page. Claim only what the ledger shows; cite job IDs and dataset hashes. Flag overdue jobs with named owners. No speculation beyond the data.',
  },
]

/** Flat lookup for citation rendering. */
export const chunkById = (id: string) => CORPUS.find(c => c.id === id)
