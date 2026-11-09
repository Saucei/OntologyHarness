# P2 · Swarm Telemetry, Replay & Cost Control

**Role.** Observability engineer. Depends on: 02, 05. Context: swarms run once and vanish into a `job`; tokens are simulated; no history.

**Why P2.** Trust in agents = auditability. This makes swarms debuggable, budgetable, comparable.

**Build:**
1. Run ledger: every swarm execution persisted — plan JSON, per-step inputs/outputs/tokens/latency/model/provider, verifier verdict, final artifacts.
2. Runs view (tab in Swarms): list with status, cost, duration, worker breakdown; expand to full trace; filter by template/outcome.
3. Replay: re-render any past run step-by-step (no LLM calls — read from ledger); shareable `run.ohtrace` bundle export.
4. Cost controls: per-run budget cap (abort at limit), daily spend meter in sidebar, per-template cost trending; alert at 80%.
5. Prompt/version pinning: each step records prompt hash + model id — regression-compare runs across model swaps.

**Acceptance.** Dry-run audit shows 4 steps in ledger; replay renders without network; exceeding cap aborts with "budget exhausted" marker; two runs of same template differ visibly in token/cost.

**Output contract.** Ledger schema · runs UI · replay engine · budget enforcer · `run.ohtrace` format.
