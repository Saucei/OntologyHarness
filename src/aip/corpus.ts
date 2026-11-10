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
    id: 'chunk-line-1', title: 'Assembly line — stage specs & takt', source: 'Plant Ops · Production Standard',
    body: 'Automotive assembly stages use STG-### identifiers (STG-010 stamping through STG-060 inspection). Stamping presses run a 4-second panel cycle with 20-45 minute die changeovers amortized across the run. Body weld places approximately 4,800 spot welds per body at a 60-second takt. Paint shop e-coat and oven dwell totals 9.5 hours; trim and chassis and final assembly run a 58-60 second takt. Test and inspection averages 15 minutes per unit. Line rate is approximately 950 units per day across two shifts.',
  },
  {
    id: 'chunk-line-2', title: 'Quality loops — rework & repair', source: 'Plant Ops · Quality Manual',
    body: 'Roughly 4 percent of painted bodies require paint rework (3.2 hours average) and about 2 percent of tested units fail final inspection and return to trim via the repair bay (1.5 hours average). Unit identifiers use B-#### form; vehicle VINs are 17 characters excluding I, O and Q. Reorder points trigger at 40 steel coils and 25 resin totes minimum. Dealer orders are sequenced against the 950 units per day line rate.',
  },
  {
    id: 'chunk-ops-1', title: 'Executive briefing — cadence', source: 'Internal · Ops Review',
    body: 'Weekly executive brief: jobs completed vs WIP, swarm pass rate, lineage health (failing/stale nodes), cost per job, top blockers. Keep to one page. Claim only what the ledger shows; cite job IDs and dataset hashes. Flag overdue jobs with named owners. No speculation beyond the data.',
  },
]

/** Flat lookup for citation rendering. */
export const chunkById = (id: string) => CORPUS.find(c => c.id === id)
