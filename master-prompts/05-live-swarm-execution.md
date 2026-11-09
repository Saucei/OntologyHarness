# P0 · Live Swarm Execution (replacing simulation)

**Role.** Agent-systems engineer. Depends on: 01 (tool loop), 04 (streaming/routing). Context: `src/modules/SwarmsModule.tsx` (simulated steps), `WorkersModule.tsx` (static stats), `src/jobs.ts` (job auto-create).

**Why P0.** The flagship feature must be real: workers that actually reason, not a typed animation.

**Build:**
1. Swarm runtime: orchestrator emits typed `SwarmPlan` (tasks with workerId, objective, toolAllowlist, outputSchema). Executed via orchestrator from 01 with `dryRun` respecting swarm-level mode toggle (dry vs live).
2. Worker execution = real `llmChatStream` calls with worker's system prompt + model + tools; each worker returns schema-validated JSON (retry once on parse failure).
3. Live mode requires explicit "Live execution" switch with cost estimate modal (uses routing table for token estimation); dry mode = plan only, no LLM spend.
4. Pause/resume: checkpoint plan state to store between steps; resume continues from checkpoint (not restart).
5. Worker stats auto-computed from telemetry (runs, success %, latency p50, cost) → Workers module renders real numbers; status flips idle/working/error by actual runs.
6. On completion: verified artifacts linked into the analyst job (see 09).

**Acceptance.** Live "Dataset Triage" on the brewery CSV with a configured provider → workers produce real JSON (profile stats, type issues), verifier summarizes, job opens with artifacts attached; killing app mid-run → resume picks up at checkpoint; stats in Workers screen move from seed to real.

**Output contract.** Swarm runtime · worker executor · checkpoint format · stats aggregation query · updated Swarms UI states.
