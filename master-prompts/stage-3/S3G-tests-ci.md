# S3-G · Tests & CI — Acceptance Infrastructure

**Role.** Test/QA engineer. **Context anchors:** zero tests today; all verification was manual browser screenshots; existing verified behaviors to pin: round-trip hash, value-type validation, workshop validator, agent tool registry, jobs migration.

**Why P3.** Every Stage 2/3 fix must survive the next refactor. Manual screenshotting doesn't scale; this is the quality floor for a release-tagged harness.

**Build:**
1. **Unit (vitest)**: `hash.test.ts` (canonicalize/hash/diffSummary — import CSV→export→reimport → identical hash), `valueTypes.test.ts` (validateObjectType catches unknown types, dup props, missing indexed prop), `workshopValidate.test.ts` (unbound blocked, table-binds-set rule), `jobs.test.ts` (v1→v2 migration, attachToJob adds attachment + activity, WIP-independent), `retrieval.test.ts` (TB query → grounded with tb-1; Mars query → refusal), `presetSchema.test.ts`.
2. **Component (vitest + @testing-library/react + jsdom)**: Kanban card renders chips; priority cycles on click; Providers routing fields persist (mock `invoke`); citations parse from streamed answer (mock fetch SSE).
3. **Integration (tauri-driver / WebDriver on debug binary)**: boot → import fixture CSV → dataset appears in Data Hub → Send to Job → kanban shows card. (If WebDriver unavailable in CI, document as manual release smoke test instead — don't block CI.)
4. **CI (`.github/workflows/ci.yml`)**, windows-latest: `npm ci` → `npx tsc -b` → `npm run build` → `npx vitest run` → artifact upload of `dist/`; cache node_modules; badge in README.
5. **Acceptance runner** (`scripts/acceptance.mjs`): executes Stage 2 checklist — round-trip hash PASS, validate PASS (0 issues), publish blocked-then-ok PASS, refusal PASS, restart persistence PASS — writes `ACCEPTANCE_REPORT.md` (machine-readable + human summary).

**Acceptance.** Fresh clone: `npm ci && npm run verify` → green; CI badge passes on PR; acceptance report regenerates deterministically against seed fixtures; coverage ≥ 70% on logic modules (`src/lib`, `src/aip`, `src/data`, `src/workshop`, `src/agent`).

**Output contract.** vitest suites + fixtures · CI workflow + badge · `verify` script · acceptance runner + report template · testing guide in README (how to run, how to add fixtures).

**Non-goals.** No E2E browser farm, no visual regression snapshots, no load/perf testing, no coverage theatre above logic layer.
