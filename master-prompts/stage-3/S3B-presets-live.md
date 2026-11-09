# S3-B · Presets — Live Dispatch, Persisted Forks, Real Stats

**Role.** Product engineer. **Context anchors:** `src/modules/PresetsModule.tsx` (Run queues job only), `src/jobs.ts` (jobs store), `src/agent/orchestrator.ts` (provider dispatch path), `src/llm/client.ts` (`routeModel`, streaming), `src/store.ts`.

**Why P2.** Presets are the on-ramp for non-expert users; dead Run buttons and in-memory forks erode trust.

**Build:**
1. **Live dispatch**: "Run preset" executes through the orchestrator — build prompt from `{inputs[], systemPrompt, userTemplate}` (dataset picker auto-appears for `needsInput: dataset`; question box otherwise). Dry-run toggle writes plan to the card; live run streams tokens into the card (idle→running→done states, no modal).
2. **Preset schema v2** (`src/data/presets.ts`): `{id, name, desc, icon, needsInput?, systemPrompt, userTemplate, tools[], workerId, outputSchema?, builtin?}` — validated on save; all 8 builtins migrated.
3. **Fork persistence**: forks stored in `ws.meta.presetForks` (SQLite/localStorage); show lineage ("forked from Lineage Audit"); rename/delete/revert-to-builtin actions.
4. **Real stats per preset**: `runs, okCount, avgTokens, avgLatencyMs` computed from traces (`kind:'preset-run'` tagged with presetId); library re-sorts by Most used / Highest success; badge "● live" when executed this session.
5. **Outcome wiring**: completing a preset attaches the produced artifact(s) to the auto-created analyst job (schema v2 attachments) — jobs and presets become one loop.

**Acceptance.** Run Dataset Triage against the brew CSV → card shows streaming, terminal state, linked job with dataset attached; fork Lineage Audit → restart → fork persists with lineage note; stats column updates after 3 runs; archive button hides a custom preset without deleting traces.

**Output contract.** preset schema + migration · runner (invoke orchestrator) · inline run UI states · stats aggregation (trace query) · fork CRUD · tests: schema validator, fork round-trip, stats aggregator.

**Non-goals.** No preset marketplace, no scheduling/cron, no multi-worker presets (swarms already cover).
