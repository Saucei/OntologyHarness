# P1 · Analyst Jobs ↔ Artifacts & Roster Linking

**Role.** Product engineer. Context: `JobsModule.tsx`, `jobs.ts` — jobs carry only a `source` string; assignee free-typed; no attachments.

**Why P1.** Jobs are the promise "insight becomes done" — untraceable jobs break the chain.

**Build:**
1. Artifact links on a job: dataset refs, chart refs (DataHub config), swarm run traceId, ontology object IDs, URL refs. UI: attachment chips with preview popover (first 5 rows / chart thumbnail / trace excerpt).
2. Assignee picker: dropdown fed by AI Workers roster (or "Unassigned"); due date = date input; priority chip (low/normal/high/urgent).
3. Kanban polish: drag between columns (pointer events, not just ←/→); WIP limits per column with warning; column totals; filter bar (tag, owner, priority, due).
4. Activity: every artifact link/unlink, status move, assignee change → activity entry; export includes links.
5. Deep links: "Open in Data Hub" / "Open in Swarms" from chips → switches module + focuses artifact.

**Acceptance.** Spawn job from imported CSV → chart auto-attached; drag card between columns; link a swarm trace → popover shows trace; reassign Berry→Sentinel; export shows all links.

**Output contract.** Job schema v2 migration · artifact registry · drag-drop impl · filter/totals UI · export format update.
