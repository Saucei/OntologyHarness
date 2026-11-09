// Generate per-task master prompts. Run: node scripts/gen-tasks.mjs
import { writeFileSync, mkdirSync } from 'node:fs'
mkdirSync(new URL('../master-prompts/tasks/', import.meta.url), { recursive: true })

const TASKS = [
  { id: 'T-01', slug: 'fde-ribbon', layer: 'L4', fns: 'FN-FDE-004', title: 'FDE Composer Ribbon + Count Chips', host: 'AgentConsole', harness: 'mode/skill bundles (L1 schema ext.) — static chips first, popovers from T-04', files: 'src/modules/AgentConsole.tsx, src/data/presets.ts (preset.modes[]), tests' },
  { id: 'T-02', slug: 'fde-modes', layer: 'L1/L4', fns: 'FN-FDE-005, FN-FDE-011', title: 'Modes (tool-carrying) + Adds N tools + Thinking card', host: 'AgentConsole', harness: 'permissions matrix T-03 (modes compute tool counts from tool defs)', files: 'src/agent/permissions.ts (new-lite), AgentConsole mode popover, tests' },
  { id: 'T-03', slug: 'fde-permission-matrix', layer: 'L4', fns: 'FN-FDE-006', title: 'Tool Permission Matrix (If/Else Allow/Ask)', host: 'AgentConsole + tools registry', harness: 'src/agent/permissions.ts — categories, Allow/Ask/Deny, branch-condition eval', files: 'src/agent/permissions.ts, src/agent/tools.ts (category metadata), AgentConsole tri-panel UI, tests' },
  { id: 'T-04', slug: 'fde-skills-docs', layer: 'L1', fns: 'FN-FDE-007, FN-FDE-008', title: 'Skill Set Modal + Documentation Attach', host: 'AgentConsole + Presets', harness: 'preset schema: skills[] + documentationBags (L1 ext)', files: 'src/data/presets.ts, AgentConsole skill modal + docs popover, tests' },
  { id: 'T-05', slug: 'fde-model-catalog', layer: 'L0/L1', fns: 'FN-FDE-009, FN-FDE-010', title: 'Model Catalog Picker + Reasoning Tier + Keyboard Protocol', host: 'ProvidersModule', harness: 'model catalog API (Palantir/Registered/More) — L0 only', files: 'src/llm/client.ts (catalog + tier presets), ProvidersModule detail pane, AgentConsole tier pill, tests' },
  { id: 'T-06', slug: 'fde-prompt-gallery', layer: 'L1', fns: 'FN-FDE-012', title: 'Prompt Template Gallery (Classification/Sentiment/…)', host: 'AgentConsole or Presets', harness: 'reuse T-04 docs/preset schema', files: 'PresetsModule gallery grid (6 cards), pack loader if needed, tests' },
  { id: 'T-07', slug: 'ast-inputs-policy', layer: 'L1', fns: 'FN-AST-001, FN-AST-009', title: 'Agent Inputs + Session Completion Policy', host: 'AgentConsole (new config drawer)', harness: 'src/agent/variables.ts (typed inputs + policy)', files: 'src/agent/variables.ts, AgentConsole config drawer, tests' },
  { id: 'T-08', slug: 'ast-variables-templates', layer: 'L1', fns: 'FN-AST-002', title: 'Pre-computed Variables + Templates', host: 'AgentConsole config drawer', harness: 'variables.ts template ops', files: 'variables.ts (templates), config drawer template cards + search, tests' },
  { id: 'T-09', slug: 'ast-variable-chains', layer: 'L1/L2', fns: 'FN-AST-003', title: 'Variable Operation Chains (Filter → Search around)', host: 'AgentConsole config drawer', harness: 'object-set ops (Filter, SearchAround) over graph substrate', files: 'variables.ts chains, chain builder UI with typed output + Problems bar, tests' },
  { id: 'T-10', slug: 'ast-tools-prompteditor', layer: 'L1', fns: 'FN-AST-004, FN-AST-010', title: 'Tools Binding + System Prompt Editor', host: 'AgentConsole / AipLogicPanel', harness: 'tool types (Apply actions/Call function/SQL/Custom) + rich-text /-insert; permission-aware', files: 'Agent tools binding UI, prompt editor tabs + toolbar + cascading menu, tests' },
  { id: 'T-11', slug: 'ast-repo-lifecycle', layer: 'L3', fns: 'FN-AST-005/006/007/008', title: 'Repo Lifecycle (provisioning / release / checks / scoped imports)', host: 'new RepoModule or Workshop subview', harness: 'src/repos/types.ts + resources.json scope model', files: 'repos/types.ts, provisioning form, tag-release modal, checks tab, scoped imports console, tests' },
  { id: 'T-12', slug: 'obs-timeline-events', layer: 'L3', fns: 'FN-OBS-001, FN-OBS-002', title: 'Observability Timeline + Event Table', host: 'new Observability module', harness: 'src/observability/types.ts fed from appendTrace/.ohtrace', files: 'observability/types.ts, timeline diamonds + click-filter, event table + Type filter, tests' },
  { id: 'T-13', slug: 'obs-replay-logs', layer: 'L3', fns: 'FN-OBS-003, FN-OBS-005', title: 'Session Replay + Logs Table', host: 'Observability module', harness: 'log row schema reuse T-12', files: 'replay Preview|Raw + chips, 6-col logs + * wildcard + Copy as JSON, tests' },
  { id: 'T-14', slug: 'obs-waterfall', layer: 'L3', fns: 'FN-OBS-004', title: 'Trace Waterfall', host: 'Observability module', harness: 'span schema from T-12 (.ohtrace spans)', files: 'waterfall renderer + zoom + LLM color, tests' },
  { id: 'T-15', slug: 'mch-core', layer: 'L2/L3', fns: 'FN-MCH-001, FN-MCH-002, FN-MCH-008', title: 'Machinery State-Graph Core', host: 'GraphCanvas (Machinery mode)', harness: 'duration metrics on nodes/edges + metric carousel', files: 'GraphCanvas machinery mode, carousel, transition toggle, tests' },
  { id: 'T-16', slug: 'mch-zooms-deviations', layer: 'L3', fns: 'FN-MCH-003, FN-MCH-004, FN-MCH-007', title: 'Machinery Zooms, Deviations, Subprocesses', host: 'GraphCanvas machinery mode', harness: 'deviation/path computations', files: 'contextual zoom cards, deviation edges + segmented, subprocess frames, tests' },
  { id: 'T-17', slug: 'mch-paths-histogram', layer: 'L3', fns: 'FN-MCH-005, FN-MCH-006', title: 'Path Explorer + Duration Histogram', host: 'GraphCanvas machinery mode', harness: 'HistogramBrush primitive (L3)', files: 'path explorer panel, histogram brush filter, tests' },
  { id: 'T-18', slug: 'geo-map-substrate', layer: 'L2/L3', fns: 'FN-GEO-001 (substrate)', title: 'Map Component + Geo Typing (harness change)', host: 'new Map module / GraphCanvas mode', harness: 'GeoPoint/Geohash value types (L2) + MapCanvas (L3)', files: 'valueTypes.ts geo, MapCanvas.tsx, geo test fixtures, tests' },
  { id: 'T-19', slug: 'geo-cluster-bubbles', layer: 'L3', fns: 'FN-GEO-001, FN-GEO-003', title: 'Cluster Layers + Bubble/Metric Cards', host: 'Map module', harness: 'cluster render + legend from T-18', files: 'cluster-layer config panel, bubbles + legend, metric cards, tests' },
  { id: 'T-20', slug: 'geo-cop-rail', layer: 'L3', fns: 'FN-GEO-002', title: 'COP Facet Rail (filters + histogram + linkage)', host: 'COP view (Map module)', harness: 'facetEngine + HistogramBrush (L3)', files: 'filtered rail, count facets, date histogram, map-table linkage, tests' },
  { id: 'T-21', slug: 'pipeline-build-legend', layer: 'L3', fns: 'FN-PLM-001, FN-PLM-002', title: 'Pipeline Build Settings + Legend Canvas', host: 'PipelineBuilder', harness: 'build settings schema (batch/streaming, compute profiles)', files: 'build settings modal, legend color mapping, deploy status badges, tests' },
  { id: 'T-22', slug: 'pipeline-use-llm-node', layer: 'L1', fns: 'FN-PLM-003', title: 'Use-LLM Node Template Config', host: 'PipelineBuilder', harness: 'LLM template exec via L0 client', files: 'node config form (context, steppers, picker, model), tests' },
  { id: 'T-23', slug: 'governance-history-health', layer: 'L2/L3', fns: 'FN-GOV-001/002/003', title: 'Branching, History + Health Gates', host: 'Ontology Studio / DataHub', harness: 'transaction log + rollback + validate rules', files: 'main-branch review/rebase, RID history + Force snapshot, Health Checks panel, tests' },
  { id: 'T-24', slug: 'peer-manager-wizard', layer: 'L3', fns: 'FN-PEER-001/002/003', title: 'Peer Manager + Mapping Wizard', host: 'new PeerManager module', harness: 'peering job state machine + property map', files: 'connections home, topology overview + jobs, 3-step mapping wizard, tests' },
  { id: 'T-25', slug: 'scoping-canvas-bank', layer: 'L3', fns: 'FN-SCP-001/002', title: 'Scoping Funnel Canvas + Guidance Bank', host: 'new Scoping module', harness: 'card-graph renderer on GraphCanvas + notes.txt bank', files: 'funnel canvas, guidance question bank panel, tests' },
  { id: 'T-26', slug: 'scoping-matrix-checklist', layer: 'L3', fns: 'FN-SCP-003/004', title: 'Scoping Matrix + Checklist', host: 'Scoping module', harness: 'grid deliverable renderer', files: 'permissions matrix grid, MVP/steering/beta checklist, tests' },
  { id: 'T-27', slug: 'platform-workspaces-templates', layer: 'L3/L4', fns: 'FN-MKT-002/003', title: 'Code Workspaces + Tiered Agent Templates', host: 'new Workspace stub / AgentConsole templates', harness: 'workspace tool gating (mock) + template versions', files: 'JCW stub with 11-tool toggles + history, v16/v20 templates, tests' },
  { id: 'T-28', slug: 'functions-sdk-completions', layer: 'L1', fns: 'FN-FNS-001/002/003', title: 'Functions SDK + Ontology Completions', host: 'new Functions module / Workshop', harness: 'LanguageModels shim over llmChat', files: 'function authoring form, completions demo + logs, workshop variable binds, tests' },
  { id: 'T-29', slug: 'aip-hardening', layer: 'L1', fns: 'FN-AIP-001/002/005/006/007', title: 'AIP Logic Hardening', host: 'AipLogicPanel', harness: 'grounding: embeddings, interpolation, publish, test cases', files: 'AIP: ranking, render, gates, test-case list' },
  { id: 'T-30', slug: 'vertex-expansion', layer: 'L2/L3', fns: 'FN-VRT-001..007', title: 'Vertex Expansion', host: 'GraphCanvas', harness: 'graph create/search/layout/layers/template', files: 'vertex mode additions, wizard, side panel chart, tests' },
  { id: 'T-31', slug: 'data-link-closeout', layer: 'L2/L3', fns: 'FN-ARC-002, FN-DAT-001/002/003, FN-ONT-003, FN-BLD-017, FN-FLT-006/007', title: 'Data & Link Closeout', host: 'various', harness: 'small widgets/prefs', files: 'branch graph, clean/union/deploy, link create, fav page, filter variants, tests' },
  { id: 'T-32', slug: 'plugin-folder-install', layer: 'L3', fns: 'FN-MKT-001', title: 'T1 Folder Install (Tauri appdata scan)', host: 'PluginManager', harness: 'Rust fs command for %APPDATA%/OntologyHarness/plugins', files: 'tauri lib.rs command, PluginManager local-folder install, tests' },
]

for (const t of TASKS) {
  const body = `# ${t.id} — ${t.title}

**Layer:** ${t.layer} · **Functions:** ${t.fns} · **Host:** ${t.host}
**Architecture:** \`master-prompts/ARCHITECTURE_LAYERS.md\` · **Plugins:** \`ARCHITECTURE_PLUGINS.md\`
**Harness prerequisites:** \`HARNESS_CHANGE_MAP.md\` — ${t.harness} · **Goal:** \`GOALS.md\`

## Scope
Implement ${t.fns} in ${t.host}. ${t.harness}.

Files: ${t.files}.
Theme: glass tokens only, no new hues. Light+dark parity. \`appendTrace\` + \`appendAudit\` on every mutating action.
Ledger: after shipping, update \`scripts/regen-inventory.mjs\` for the function(s) above and re-run it; update \`GOALS.md\` status.
Parallel-safe: only edit the files listed under Files.

## Acceptance (must all pass)
- \`npx tsc -b\` clean
- \`npx vitest run\` green (add ≥2 tests for any new helper)
- Browser console clean in dev tab; reference tolerance ±2px vs corpus tiles where a visual exists
- Rollback: revert of this slice must leave the app buildable; no destructive schema moves without a memo in this file.
`
  writeFileSync(new URL(`../master-prompts/tasks/${t.id}-${t.slug}.md`, import.meta.url), body)
}
console.log(`Wrote ${TASKS.length} task prompts`)
