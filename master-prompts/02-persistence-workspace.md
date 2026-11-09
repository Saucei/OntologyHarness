# P0 · Workspace Persistence Layer

**Role.** Senior storage engineer. Context: all modules currently hold state in-memory / localStorage (`src/jobs.ts`, `WorkersModule`, `DataHub`, `OntologyStudio` edits, swarm logs). README + UI_MASTER_PROMPT v2.1 require `workspace.json` semantics.

**Why P0.** A harness that forgets is a demo. Jobs, workers, datasets, configs, traces must survive restart.

**Build (choose with user — default: SQLite via Rust):**
- Rust `storage.rs` with `rusqlite` (bundled) exposing `load_workspace`, `save_workspace`, `append_trace`, `upsert_dataset`. Tables: `workspace(meta)`, `jobs`, `workers`, `datasets` (meta + row pointer), `traces`, `object_types`, `links`, `actions`, `audit`.
- Frontend: `src/store.ts` — single workspace store; replace every direct localStorage/in-memory write with the store; hydrate on boot; dirty-flag autosave debounced 500ms.
- Round-trip: export/import full workspace (`.ohw` = zip of json+manifest) for backup/migration.

**Acceptance.** Create an object type, a job, import CSV, tweak a worker → restart app → all present. Delete `.ohw` → clean empty state with seed option. No data loss on crash during save (atomic write via temp+rename).

**Output contract.** Schema DDL · storage.rs · store.ts refactor diff · migration note for existing localStorage users.
