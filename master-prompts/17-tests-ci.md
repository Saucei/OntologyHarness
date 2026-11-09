# P3 · Tests & CI — Acceptance Infrastructure

**Role.** Test/QA engineer. Context: zero tests; all verification so far was manual browser screenshots.

**Why P3.** Locks in everything the prompts above built; prevents regressions as the harness grows.

**Build:**
1. Unit (vitest): parsing (CSV/JSON/XLSX inference), round-trip hash util, job store transitions, value-type validators, preset schema check, swarm plan validator, routing table. Target ≥ 70% logic coverage.
2. Component (vitest + testing-library): Kanban move logic, provider settings persistence (mocked credential store), AIP citation renderer.
3. Integration (tauri-driver / WebDriver on debug binary): boot → import fixture CSV → job created; swarm dry-run → ledger written; provider test-connection mocked.
4. CI (GitHub Actions, windows-latest): tsc, vite build, cargo check, vitest run, artifact upload of installer when tagged; status badge in README.
5. Acceptance runner: script executing the manual checklists from prompts 01–14, outputting PASS/FAIL matrix to `ACCEPTANCE_REPORT.md`.

**Acceptance.** Fresh clone → `npm ci && npm run verify` → green; PR CI blocks merge on failure; acceptance report regenerates deterministically.

**Output contract.** vitest suites · CI workflow · verify script · ACCEPTANCE_REPORT template.
