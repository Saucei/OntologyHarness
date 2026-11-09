# S3-A · Swarm Telemetry, Replay & Cost Control

**Role.** Observability engineer (desktop). **Depends on:** Stage 2 workspace (`src/store.ts` traces ledger), live swarms (`SwarmsModule.tsx`), Job artifacts (`jobs.ts`).

**Why P2.** Agent trust = auditability. Today swarms append traces but nobody can replay, compare, or cap them.

**Build:**
1. **Ledger schema** (`traces` table): extend with `runId`, `stepIdx`, `planHash`, `promptHash`, `toolName?`, `tokensIn/Out`. Swarms emits one trace per worker step + verifier, sharing `runId = swarm-<ts>`.
2. **Runs view** (tab in Swarms): list run history — status (done/aborted/blocked), template, duration, tokens, cost est. (tokens × routing-table price map), pass/fail per worker; expand → step-by-step replay **read-only from the ledger, zero LLM calls**.
3. **Replay UI**: step scrubber; each step shows prompt hash, input, output; no network.
4. **Cost caps**: per-run token budget (settings, default 30k); at 80% → amber warning; at 100% → abort with `budget_exhausted` marker in log + ledger. Daily spend meter in sidebar footer (sum of last-24h traces × price).
5. **Prompt/version pinning**: log `promptHash` + model; two runs of same template with different models → side-by-side diff of token/latency/verdict.

**Acceptance.** Dry-run Lineage Audit → ledger shows N worker steps with runId; replay renders identical output with network off; exceeding cap aborts mid-run with marker; two runs of same template render side-by-side cost/latency delta.

**Output contract.** Ledger migration + `ws_append_trace` call-site changes · Runs tab UI · replay engine · budget enforcer + sidebar meter · price map for routed models · tests for abort-at-cap.

**Non-goals.** No cloud telemetry, no prompt management UI, no A/B testing framework (pinning exists to compare, not to automate).
