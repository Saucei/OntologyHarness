# P2 · Presets — Live Dispatch & Fork Persistence

**Role.** Product engineer. Depends on: 04, 05. Context: `PresetsModule.tsx` — Run only queues a job; forks vanish on reload.

**Why P2.** Presets are the on-ramp for non-expert users; dead "Run" buttons and lost forks erode trust.

**Build:**
1. "Run preset" executes: build prompt from preset template + user-selected inputs (dataset picker when preset declares `needsInput: dataset`); dispatch via orchestrator (dryRun respects a visible toggle on the button); stream progress into the card itself (idle → running → done states, no modal).
2. Persist forks to workspace; show fork lineage ("forked from Lineage Audit · by you"); allow rename/delete/revert-to-builtin.
3. Preset schema v2: `{inputs[], systemPrompt, userTemplate, tools[], workerId, outputSchema, maxTokens}` — validated on save.
4. Success stats per preset from real runs: runs, ok %, avg tokens, avg latency; sort library by "Most used"/"Highest success".
5. Custom preset creation: form UI mirroring builtin definitions (all fields editable) with live prompt preview.

**Acceptance.** Run Dataset Triage on brewery CSV from preset card → completes inline, job opens with artifacts; fork "Lineage Audit" → reload app → fork persists; stats update after three runs.

**Output contract.** Preset schema v2 · inline run UI · persistence · stats aggregation · creation form.
