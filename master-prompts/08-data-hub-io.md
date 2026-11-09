# P1 · Data Hub I/O — Round-Trip, Profiling & Validation

**Role.** Data-engineering lead. Context: `DataHub.tsx` — CSV path works (verified 8-row test); XLSX path installed but untested; in-memory only; spec (UI_MASTER_PROMPT v2.1) promises round-trip hash identity.

**Why P1.** Import/export is the analyst's front door; trust collapses if hashes don't match.

**Build:**
1. Round-trip proof: import CSV → export CSV → re-import → deep-equal compare (hash of canonical serialization); show ✓/✗ badge with diff rows if mismatch.
2. XLSX: verify SheetJS path end-to-end (multi-sheet picker, sheet name logged); test with real .xlsx fixture in CI.
3. Profiling panel: per column — null %, distinct count, min/max/mean, top-5 values; blocking issues (>50% null) flagged red; exported into job artifact.
4. Schema mapping wizard for mismatched columns on re-import into an existing dataset: map → coerce → report.
5. Dataset persistence via store (from 02): datasets list view with sizes + hashes; delete with refcount check (blocks if a job references it).
6. Export: CSV/JSON/XLSX + SHA-256 manifest sidecar (`export.json` with source hash, row count, generated-at).

**Acceptance.** Brewery CSV → export → reimport → identical hash badge; xlsx fixture imports multi-sheet; profiling flags a deliberately nuil-heavy column; dataset referenced by a job can't be deleted.

**Output contract.** Round-trip util + tests · profiler · mapping wizard · manifest sidecar spec.
