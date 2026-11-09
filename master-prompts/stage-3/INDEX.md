# Stage 3 Index — Ontology Harness (one master prompt per section)

Stage 1 = P0 (gateway/workspace/agent loop) · Stage 2 = P1 (value: round-trip, jobs↔artifacts, workshop publish, grounded AIP) · **Stage 3 = P2/P3 (excellence → shippable)**.

Each file is standalone: role · context anchors in *this* repo · why-now · numbered build steps · ordered acceptance · output contract. Work top-to-bottom; S3-A/S3-B are the consumer-facing wins, S3-F/S3-G are the release gate.

| # | File | Section | Priority |
|---|---|---|---|
| A | `S3A-swarm-telemetry.md` | Swarm ledger: run history, replay, cost caps, prompt pinning | P2 |
| B | `S3B-presets-live.md` | Presets: live dispatch, persisted forks, real success stats | P2 |
| C | `S3C-corpus-gold-parse.md` | Gold-standard corpus parse: vision/OCR, thumbnails, search | P2 |
| D | `S3D-a11y-onboarding.md` | axe audit, contrast, keyboard map, reduced-motion, 3-step wizard | P2 |
| E | `S3E-graph-depth.md` | Graph: subgraph export, node expansion, selection→job, camera UX | P2 |
| F | `S3F-packaging-release.md` | `tauri:build` installer, CSP, icons, updater decision | P3 |
| G | `S3G-tests-ci.md` | Vitest + integration, CI workflow, acceptance runner | P3 |

**Dependencies:** A/B need Stage 2's trace ledger (done). C feeds the AIP grounded runtime (done) and agent `corpus.search`. D touches everything — run after feature freeze. E depends on nothing upstream. F blocked by D's a11y pass if WCAG tagging is a release goal. G last.

**Stage-3 definition of done:** fresh profile → import brew CSV → live swarm → replay the run → fork a preset → ship an installer. That single script exercises A, B, C, E, F.
