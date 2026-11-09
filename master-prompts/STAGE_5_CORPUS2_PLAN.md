# STAGE 5 — Corpus 2 Program Plan ("Operating Foundry for You")

Source: `asset/contact-sheets-2/corpus2-master.png` (72 unique tiles C01–C72, stitched from
`C:\Users\Berry\Desktop\Ontology harness screenshots 2`, 12 exact duplicates removed) +
`notes +.txt` (use-case scoping canon). Vision-verified by 5 parallel subagent passes on the
full-resolution originals; reports folded into `scripts/regen-inventory.mjs` →
`functions.json` / `FUNCTIONS.md` / `UI_GAPS.md` (now 105 functions).

Families uncovered by corpus 1: **ai-fde · agent-studio · machinery · observability · geo ·
pipeline-llm · peer-manager · governance · marketplace · scoping · functions-sdk**.

---

## P0 — Plugin/registry architecture decision (accepted)

Batteries included, standardized battery compartment. All 24 INAPP + future features stay baked-in,
but every module implements the same `HarnessModule` contract as any third-party plugin — see
`master-prompts/ARCHITECTURE_PLUGINS.md` summary:

- **T0 registry refactor** — `src/modules/registry.ts`; `App.tsx` renders from registry; modules
  contribute `agentTools`, `commands`, `persist` keys, `navMenu` entries. No behavior change.
- **T1 resource packs** (no code — zero risk) — presets, themes(tokens), corpus manifests,
  validation rule packs, prompt bundles. Loaded from local folder / URL / GitHub raw. First proof
  packs extracted from existing data: `theme-cream-glass`, `presets-brewery`, `corpus-134`, new
  `corpus-2` manifest.
- **Plugin Manager module** (INSPECT group) — install/enable/disable/version-check/audit; the UI
  mirrors corpus tile C10 (Marketplace product version: outputs, install mode, release channel).
- **T3 code plugins** — design reservation only (esbuild-wasm compile + permission manifest).

## Waves (suggested T1-first execution order)

**W1 — Runtime spine (fn-fde-core)**
1. FN-FDE-001/002/003 sessions, tokenized Outline (turn tree + ~/200K meter), approval cards w/
   Always-allow-this-session → host: AgentConsole.
2. FN-FDE-004 ribbon + count chips; FN-FDE-009 model catalog picker (Providers module upgrade);
   FN-FDE-010 tier pill + keyboard protocol.
3. FN-FDE-005/006/007 Modes-as-tool-bundles + tri-panel tool permission matrix (If/Else
   Allow/Ask on branch conditions) + skill-set modal → host: AgentConsole + tools registry.

**W2 — Authoring (fn-ast-author)**
4. FN-AST-010 prompt editor (tabs, rich-text, "/"-insert) → feeds FN-AIP-002 too.
5. FN-AST-001 inputs; FN-AST-002/003 variable templates + operation chains (Filter → Search
   around) over the object-set graph substrate.
6. FN-AST-004/009 tools binding (Automated pills) + session completion policy.
7. FN-AST-005/006/007/008 repo lifecycle: provisioning form, tag-and-release semver modal,
   Checks tab, scoped imports console.

**W3 — Observability (fn-obs-stack)** — FN-OBS-001..005: diamond timeline, event table with
Updates badges, chat replay Preview|Raw, trace waterfall from `.ohtrace` data, 6-col logs table.

**W4 — Analytics widgets (fn-mch-analytics)**
8. FN-MCH-001/002/003/004/007/008 state graph core (duration nodes, metric carousel, contextual
   zoom, deviations, subprocess frames, transition toggle) → GraphCanvas substrate.
9. FN-MCH-005 path explorer; FN-MCH-006 brushed duration histogram.

**W5 — Maps & pipelines (fn-geo-cop / fn-plm-ext)** — FN-GEO-001..003 map widget + COP rail;
FN-PLM-001..003 build settings + legend graph + Use-LLM node config (reuses AIP template engine).

**W6 — Governance & platform (fn-gov-peer / fn-scp-canvas / fn-fns-sdk)** — FN-GOV-001..003,
FN-PEER-001..003, FN-MKT-001/003 (Plugin Manager UI + tiered agent templates), FN-FNS-001..003,
FN-SCP-001..004 (use-case funnel canvas + guidance bank from notes +.txt).

## Large option list (pick any; ledger keeps counts honest)

Everything below is already registered with breadth/depth/reach + status in `functions.json`
(63 MISSING / 18 PARTIAL / 24 INAPP). Options beyond the waves:

- **Cheap wins (<30 min ea.)** FN-AST-006 tag-and-release modal (semver UI only), FN-AST-009
  session-completion dropdown, FN-FDE-011 thinking card, FN-MCH-002 metric carousel, FN-MCH-008
  transition toggle, FN-FDE-012 prompt-gallery grid.
- **Deep builds (multi-slice)** FN-FDE-006 tool-permission matrix, FN-AST-003 variable chains,
  FN-MCH-005/006 path explorer + histogram, FN-OBS-004 waterfall, FN-GEO-002 COP rail.
- **Theme/IA options** (a) Machinery as Graph mode-tabs vs separate module — recommend tabs;
  (b) Agent Studio as new module vs AgentConsole config drawer — recommend drawer first;
  (c) observability as modal vs page — recommend page (W3).
- **T1 packs to open the door** corpus-2 manifest pack first (zero work after stitch2),
  then theme-cream-glass, presets-brewery, corpus-134 → then Plugin Manager.
- **Later (explicit non-goals for now)** FN-MKT-002 Jupyter/RStudio embedding, T3 code plugins,
  External-Databricks real compute (mock gate only), Peer Manager real sync (mock ack only).

## Acceptance gate per implemented function

`npx vitest run` 24+ / `npx tsc -b` / console clean in the dev tab / update ledger status via
`scripts/regen-inventory.mjs` / light+dark parity via tokens / no new hues / appendTrace on every
mutating action. Reference tolerance ±2px vs corpus tiles where a visual exists.
