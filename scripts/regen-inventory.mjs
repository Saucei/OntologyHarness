// Regenerate functions.json + UI_GAPS.md from ALL vision-verified data collected in this session.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const out = new URL('../functions.json', import.meta.url)
const gapsOut = new URL('../UI_GAPS.md', import.meta.url)
const functionsMd = new URL('../FUNCTIONS.md', import.meta.url)
const promptsDir = new URL('../master-prompts/functions/', import.meta.url)
mkdirSync(promptsDir, { recursive: true })

// ── aggregated vision report (from subagent runs) ───────────────────────────────
// Each entry: [imageSubstring, capabilityCluster, visible functions]
const VISION = [
  ['pipeline_overview.png', 'C-PIPE', 'JDBC/SFTP ingestion → clean/schema → canonical transforms → ontology datasets → workflow/ML/apps; Source Systems → Datasource → Transform A+B → Ontology → Workflow'],
  ['branches-1.png', 'C-BRANCH', 'PROD/UAT lanes; master/dev/feature branches; merge/promotion graph'],
  ['vertex_overview-system_graph.png', 'C-GRAPH', 'Explore sub-graph; group/remove series; trace ingredients→products→customers; open in Quiver'],
  ['instructor_…1749655488_Clean+Bureau', 'C-CLEAN', 'Cast to Timestamp; filter rows where order_id is not null; normalize column names'],
  ['instructor_…1749821009_Clean+Office', 'C-CLEAN', 'Cast dueDateTime; filter orderId not null; drop orderPlacementDate; rename dueDateTime; normalize names'],
  ['instructor_…1749823347_Union+Datasets', 'C-UNION', 'Open transform toolbar; select/add node; edit/preview; wire left/right inputs'],
  ['instructor_…1749823757_Union+Node', 'C-UNION', 'Preview union table; browse 500 rows × 11 cols; search/sort columns'],
  ['instructor_…1759877719_Screenshot+2025-10-07', 'C-DEPLOY', 'Deploy pipeline; select outputs to build; compute profile; view changes'],
  ['instructor_…1759958481_Screenshot+2025-10-08', 'C-ONTO', 'Dependents list; create first Workshop module; create new link type'],
  ['instructor_…1760116709_Screenshot+2025-10-10', 'C-DISPLAY', 'Display tab of widget setup; row-height Flex=1'],
  ['announcement.jpg', '', '', ''], // intentionally unused
]

const REGISTRY = [
  // ── Architecture & Lineage ──
  { id: 'FN-ARC-001', family: 'architecture-lineage', name: 'Lineage subgraph exploration (pan/zoom/select/group-by)', breadth: 3, depth: 5, reach: 3, status: 'INAPP', entry: 'Vertex graph canvas with pan/zoom/select + slate series panel' },
  { id: 'FN-ARC-002', family: 'architecture-lineage', name: 'Environment branching & promotion graph (Master/Dev/Feature Y/Feature X/Oct → PROD/UAT)', breadth: 1, depth: 4, reach: 2, status: 'INAPP', entry: 'GraphCanvas branch graph overlay: BRANCH_NODES/EDGES + Promote + branch stats (ws.meta.graph)' },
  { id: 'FN-ARC-003', family: 'architecture-lineage', name: 'Open in Quiver from graph', breadth: 1, depth: 1, reach: 2, status: 'INAPP', entry: 'Open in Quiver' },

  // ── Data integration ──
  { id: 'FN-DAT-001', family: 'data-integration', name: 'Clean transform: cast to Timestamp, filter not-null, drop columns, rename, normalize names', breadth: 4, depth: 5, reach: 2, status: 'INAPP', entry: 'DataHub clean panel: applyCleanTransform (cast/filter/drop/rename/normalize) + preview' },
  { id: 'FN-DAT-002', family: 'data-integration', name: 'Union node config + preview (500 rows × 11 cols)', breadth: 2, depth: 3, reach: 2, status: 'INAPP', entry: 'DataHub union preview (buildUnionPreview: 500 rows × 11 cols)' },
  { id: 'FN-DAT-003', family: 'data-integration', name: 'Deploy pipeline / select outputs / compute profile', breadth: 1, depth: 3, reach: 2, status: 'INAPP', entry: 'DataHub deploy (validateDeployConfig, compute profile, status badge)' },

  // ── ontology layer ──
  { id: 'FN-ONT-001', family: 'ontology-layer', name: 'Object type CRUD + value-type constraints (WarehouseId/ProductId/BatchId regex + ABV range)', breadth: 3, depth: 6, reach: 3, status: 'INAPP', entry: 'Ontology Studio: Validate → value-type dropdown + inline errors' },
  { id: 'FN-ONT-002', family: 'ontology-layer', name: 'Object Explorer / search by property + dependents', breadth: 2, depth: 3, reach: 2, status: 'PARTIAL', entry: 'Dependents list + create Workshop module from dependents panel' },
  { id: 'FN-ONT-003', family: 'ontology-layer', name: 'Link type create + toggle', breadth: 2, depth: 2, reach: 2, status: 'INAPP', entry: 'OntologyStudio link create dialog + enabled toggle (createManagedLink)' },

  // ── Workshop / app building ──
  { id: 'FN-BLD-001', family: 'application-building', name: 'Add widget to section (Add widget / Set layout)', breadth: 11, depth: 2, reach: 1, status: 'INAPP', entry: 'Add widget + Set layout inline on section' },
  { id: 'FN-BLD-002', family: 'application-building', name: 'Object Set title widget (bind Active Object Set)', breadth: 2, depth: 2, reach: 1, status: 'INAPP', entry: 'Input object set picker (Object table 1 Active object)' },
  { id: 'FN-BLD-003', family: 'application-building', name: 'Add section / split section / new above-below / move', breadth: 8, depth: 2, reach: 1, status: 'INAPP', entry: 'Add section + split columns/rows + layout picker' },
  { id: 'FN-BLD-004', family: 'application-building', name: 'DIMENSIONS: Row height Auto(max) / Absolute / Flex + px + resize', breadth: 4, depth: 3, reach: 1, status: 'INAPP', entry: '' },
  { id: 'FN-BLD-005', family: 'application-building', name: 'Fill space / column width (Absolute/Flex)+resize', breadth: 2, depth: 2, reach: 1, status: 'INAPP', entry: '' },
  { id: 'FN-BLD-006', family: 'application-building', name: 'SECTION HEADER toggle · Style (Subheader/Header) · TITLE use variable · Icon', breadth: 4, depth: 3, reach: 1, status: 'PARTIAL', entry: 'header style + eye toggle + title variable' },
  { id: 'FN-BLD-007', family: 'application-building', name: 'Color / background override per widget (Light gray 4 …)', breadth: 2, depth: 2, reach: 1, status: 'INAPP', entry: '4 swatches inline on section header · persists' },
  { id: 'FN-BLD-008', family: 'application-building', name: 'Collapsible section + icon to expand/collapse', breadth: 2, depth: 2, reach: 1, status: 'INAPP', entry: 'chevron collapse · tree prunes · persisted' },
  { id: 'FN-BLD-009', family: 'application-building', name: 'Object Table: add column / Add all properties / Remove all properties / reorder / default sort', breadth: 4, depth: 3, reach: 1, status: 'INAPP', entry: 'Column config panel' },
  { id: 'FN-BLD-010', family: 'application-building', name: 'Object Table: rename column + use variable toggle', breadth: 2, depth: 2, reach: 1, status: 'INAPP', entry: 'Column config rename arrow' },
  { id: 'FN-BLD-011', family: 'application-building', name: 'Object Table: Enable object table filtering toggle', breadth: 2, depth: 2, reach: 1, status: 'INAPP', entry: 'Enable object table filtering toggle' },
  { id: 'FN-BLD-012', family: 'application-building', name: 'INPUT DATA: clear object set variable (X) + enable filtering', breadth: 2, depth: 2, reach: 1, status: 'PARTIAL', entry: 'X icon on object set picker' },
  { id: 'FN-BLD-013', family: 'application-building', name: 'Layout tree: page/section/widget click-to-select + breadcrumb', breadth: 2, depth: 2, reach: 1, status: 'INAPP', entry: 'role=tree · arrow-key expand + select' },
  { id: 'FN-BLD-014', family: 'application-building', name: 'Save and publish / View', breadth: 3, depth: 2, reach: 2, status: 'INAPP', entry: 'Save and publish' },
  { id: 'FN-BLD-015', family: 'application-building', name: 'Property List widget: Add all properties / Number of columns=1 / wrap', breadth: 3, depth: 2, reach: 1, status: 'PARTIAL', entry: 'NUMBER OF COLUMNS = 1' },
  { id: 'FN-BLD-016', family: 'application-building', name: 'Edit variable window (rename / type / root object)', breadth: 2, depth: 1, reach: 1, status: 'INAPP', entry: 'Edit variable' },
  { id: 'FN-BLD-017', family: 'application-building', name: 'Enable favoriting (page)', breadth: 1, depth: 1, reach: 0, status: 'INAPP', entry: 'OntologyStudio favorites Star page (toggleFavoriteId, All/Favorites view, ws.meta.ontologyFavorites)' },

  // ── Filters ──
  { id: 'FN-FLT-001', family: 'filters', name: 'Add filter widget to section', breadth: 4, depth: 2, reach: 1, status: 'INAPP', entry: '' },
  { id: 'FN-FLT-002', family: 'filters', name: 'Configure filters: On property / Using variable / On a link', breadth: 4, depth: 4, reach: 2, status: 'INAPP', entry: '' },
  { id: 'FN-FLT-003', family: 'filters', name: 'Filter widget output = variable (Order Filters) + rename via Rename variable', breadth: 2, depth: 2, reach: 1, status: 'INAPP', entry: '' },
  { id: 'FN-FLT-004', family: 'filters', name: 'Toggle "allow users to add and remove filters"', breadth: 2, depth: 1, reach: 1, status: 'INAPP', entry: '' },
  { id: 'FN-FLT-005', family: 'filters', name: 'Multi-select dropdown (change to Multi-Select Component)', breadth: 1, depth: 1, reach: 0, status: 'INAPP', entry: '' },
  { id: 'FN-FLT-006', family: 'filters', name: 'Filter list Vertical vs Pills layout', breadth: 1, depth: 1, reach: 0, status: 'INAPP', entry: 'OntologyStudio filter variants: Vertical/Pills layout toggle (ws.meta.filterVariant)' },
  { id: 'FN-FLT-007', family: 'filters', name: 'Filter default value + unit prefix/suffix + validation', breadth: 1, depth: 1, reach: 0, status: 'INAPP', entry: 'OntologyStudio filter variants: default value + prefix/suffix + validateFilterVariant' },

  // ── AIP ──
  { id: 'FN-AIP-001', family: 'aip-logic', name: 'Semantic search block: select Embedding property, 10 results, query=userQuestion', breadth: 3, depth: 4, reach: 2, status: 'PARTIAL', entry: 'Semantic search block with embeddings drop-down' },
  { id: 'FN-AIP-002', family: 'aip-logic', name: 'Use LLM block: Instructions/LLM instructions + task prompt with variable interpolation', breadth: 3, depth: 4, reach: 2, status: 'PARTIAL', entry: 'Use LLM block with variable interpolation' },
  { id: 'FN-AIP-003', family: 'aip-logic', name: 'Single completion / GPT-4o / Allow corrections output-enforcement toggle', breadth: 1, depth: 2, reach: 1, status: 'INAPP', entry: 'Use LLM block' },
  { id: 'FN-AIP-004', family: 'aip-logic', name: 'Preview run (Ctrl+Shift+D) inside logic editor', breadth: 3, depth: 3, reach: 2, status: 'INAPP', entry: 'Preview run' },
  { id: 'FN-AIP-005', family: 'aip-logic', name: 'Publish function (binds to ontology: 1 Object → API name) + documentation + version config', breadth: 2, depth: 2, reach: 2, status: 'PARTIAL', entry: 'Publish dialog with ontology bind' },
  { id: 'FN-AIP-006', family: 'aip-logic', name: 'Current User/custom context & permission scope', breadth: 1, depth: 1, reach: 0, status: 'MISSING', entry: '' },
  { id: 'FN-AIP-007', family: 'aip-logic', name: 'Add as test case → test-case list + re-run', breadth: 2, depth: 2, reach: 1, status: 'MISSING', entry: '' },

  // ── Vertex / knowledge graph ──
  { id: 'FN-VRT-001', family: 'vertex', name: 'Vertex graph: create & name graph; graph-type picker in New menu', breadth: 2, depth: 1, reach: 1, status: 'MISSING', entry: '' },
  { id: 'FN-VRT-002', family: 'vertex', name: 'Add objects to graph: select all / invert selection / add selected (Ctrl+A)', breadth: 1, depth: 2, reach: 1, status: 'MISSING', entry: '' },
  { id: 'FN-VRT-003', family: 'vertex', name: 'Search Around menu: relation / function / saved search around', breadth: 1, depth: 3, reach: 1, status: 'MISSING', entry: '' },
  { id: 'FN-VRT-004', family: 'vertex', name: 'Graph layout picker (Radial/Auto/Hierarchy/Grid/Circular)', breadth: 1, depth: 1, reach: 0, status: 'MISSING', entry: '' },
  { id: 'FN-VRT-005', family: 'vertex', name: 'Graph layers: node layer / edge layer / include-as-styling', breadth: 1, depth: 2, reach: 1, status: 'MISSING', entry: '' },
  { id: 'FN-VRT-006', family: 'vertex', name: 'Save as template (5-step wizard: params → search→layers→graph→defaults)', breadth: 1, depth: 5, reach: 1, status: 'MISSING', entry: '' },
  { id: 'FN-VRT-007', family: 'vertex', name: 'Time-series @demand + ale_demand_forecast in side panel', breadth: 1, depth: 2, reach: 0, status: 'MISSING', entry: '' },
  { id: 'FN-VRT-008', family: 'vertex', name: 'Open in Quiver from graph (exports)', breadth: 1, depth: 1, reach: 1, status: 'INAPP', entry: '' },

  // ══ Corpus 2 (72 tiles, asset/corpus-2) ══
  // ── AI FDE runtime (agent chat shell) ──
  { id: 'FN-FDE-001', family: 'ai-fde', name: 'Session manager dropdown (New session / switch / delete)', breadth: 4, depth: 2, reach: 2, status: 'INAPP', entry: 'Agent Console Session Manager dropdown + persisted sessions + per-row delete' },
  { id: 'FN-FDE-002', family: 'ai-fde', name: 'Conversation Outline: tokenized turn tree + nested tool rows + token meter (~33.1K / 200K)', breadth: 3, depth: 4, reach: 2, status: 'INAPP', entry: 'Agent Console Outline panel: turn tree + nested Args/Result + live token meter' },
  { id: 'FN-FDE-003', family: 'ai-fde', name: 'Tool approval card: Reject / Allow / Always allow for this session + JSON payload + copy', breadth: 5, depth: 3, reach: 2, status: 'INAPP', entry: 'Agent Console approval card: JSON + copy + per-session always-allow list' },
  { id: 'FN-FDE-004', family: 'ai-fde', name: 'Composer attachment ribbon: Modes/Skills/Documentation/Files/Ontology/Functions + per-type count chips + lit "7" pill', breadth: 4, depth: 3, reach: 2, status: 'INAPP', entry: 'Agent Console composer ribbon + 0/8 count chips + lit fx 7 pill from preset.modes[]' },
  { id: 'FN-FDE-005', family: 'ai-fde', name: 'Mode selector: tool-carrying modes (Transform data/Modify ontology/Write functions/Exploration/Governance/OSDK React/Platform Q&A) + segmented sub-modes + "Adds 26 tools"', breadth: 4, depth: 4, reach: 2, status: 'INAPP', entry: 'AgentConsole modes popover: 7 modes + segmented sub-modes + verbatim Adds N tools pills' },
  { id: 'FN-FDE-006', family: 'ai-fde', name: 'Tool permission matrix (3-panel): categories 0/8 counts, per-tool checkboxes, If/Else rules "on branches master → Ask / else Allow", Revert/+Add, Allow|Ask', breadth: 4, depth: 5, reach: 2, status: 'INAPP', entry: 'AgentConsole tri-panel permission matrix + If/Else rule engine' },
  { id: 'FN-FDE-007', family: 'ai-fde', name: 'Skill set configurations modal (Models | Skills | Tool approvals) with enabled toggles + Apply to current session', breadth: 3, depth: 3, reach: 2, status: 'INAPP', entry: 'AgentConsole skill modal (draft toggles, Apply to session, ws.meta agentSkills)' },
  { id: 'FN-FDE-008', family: 'ai-fde', name: 'Documentation attach popover (Custom docs vs Foundry documentation bundles/pages)', breadth: 2, depth: 2, reach: 2, status: 'INAPP', entry: 'AgentConsole docs popover (Custom docs / Foundry bundles, live counts, ws.meta agentDocs)' },
  { id: 'FN-FDE-009', family: 'ai-fde', name: 'Model catalog picker: Palantir|Registered|More tabs + detail pane (Class/Cost/Speed chips, ctx/max-out/TPM/RPM)', breadth: 4, depth: 3, reach: 2, status: 'INAPP', entry: 'Providers catalog tabs + detail pane (Class/Cost/Speed, ctx/TPM/RPM)' },
  { id: 'FN-FDE-010', family: 'ai-fde', name: 'Reasoning-tier pill ("Balanced • GPT-6.1 Sol (Medium)") + keyboard protocol Enter/Shift+Enter/Ctrl+Enter + "/" and "$" triggers', breadth: 3, depth: 2, reach: 1, status: 'INAPP', entry: 'AgentConsole tier pill + Enter/Shift+Enter/Ctrl+Enter + / $ triggers' },
  { id: 'FN-FDE-011', family: 'ai-fde', name: 'Thinking collapsible card in agent turns', breadth: 2, depth: 1, reach: 1, status: 'INAPP', entry: 'AgentConsole thinking-card (transcript Thinking message per prompt)' },
  { id: 'FN-FDE-012', family: 'ai-fde', name: 'Prompt template gallery: Classification/Sentiment/Summarization/Entity extraction/Translation/Empty', breadth: 2, depth: 2, reach: 2, status: 'INAPP', entry: 'PresetsModule gallery grid: 6 templates + Apply writes into active preset (ws.meta)' },

  // ── Agent Studio (authoring) ──
  { id: 'FN-AST-001', family: 'agent-studio', name: 'Agent Inputs editor: typed String + Required|Optional segmented + rename/delete', breadth: 3, depth: 2, reach: 2, status: 'INAPP', entry: 'AgentInputsDrawer: typed inputs editor (name, type, Required/Optional, add/delete)' },
  { id: 'FN-AST-002', family: 'agent-studio', name: 'Pre-computed variables: template cards (Define object set / Compute from function / Apply actions) + operation search + category tiles', breadth: 3, depth: 3, reach: 2, status: 'INAPP', entry: 'AgentInputsDrawer template cards: search + Use apply ({input}) + count/sum/text evaluation' },
  { id: 'FN-AST-003', family: 'agent-studio', name: 'Variable operation chains: start set → Filter object set → Search around (link traversal picker) + typed output chip + Problems bar', breadth: 4, depth: 5, reach: 2, status: 'INAPP', entry: 'AgentInputsDrawer chain builder: Filter (11 ops) + SearchAround BFS + typed output + Problems bar' },
  { id: 'FN-AST-004', family: 'agent-studio', name: 'Tools binding: Apply actions / Call function / Ontology SQL / Custom tool (+ Automated no-confirm pills)', breadth: 4, depth: 3, reach: 2, status: 'INAPP', entry: 'AgentConsole tools binding panel: 4 tool types + Automated pill, permission-aware (per Tool permissions matrix)' },
  { id: 'FN-AST-005', family: 'agent-studio', name: 'Repo provisioning: Model + Auto-import + agent name/location + Bind to ontology + Agent API name', breadth: 2, depth: 2, reach: 1, status: 'INAPP', entry: 'RepoModule provisioning form (validateProvisioning, sanitizeApiName)' },
  { id: 'FN-AST-006', family: 'agent-studio', name: 'Tag and release: semver modal Patch/Minor/Major/Custom + branch|commit selector + "Releasing: x.y.z"', breadth: 2, depth: 2, reach: 1, status: 'INAPP', entry: 'RepoModule tag-and-release modal (bumpSemver, Releasing label, branch|commit target)' },
  { id: 'FN-AST-007', family: 'agent-studio', name: 'Repository Checks tab: RUNNING/SUCCEEDED dots + durations + Branches/PRs/Tags/Settings tabs', breadth: 2, depth: 2, reach: 1, status: 'INAPP', entry: 'RepoModule Checks tab (runCheck/runAllChecks + tabs Branches/PRs/Tags/Settings)' },
  { id: 'FN-AST-008', family: 'agent-studio', name: 'Scoped imports console: Ontology SDK|Platform tabs + Add ▾ (Resource Files/Models) + counts + scope settings (Enable scoped mode / Allow default scope / resources.json)', breadth: 3, depth: 3, reach: 1, status: 'INAPP', entry: 'RepoModule scoped imports console (resources.json parse/stringify, Enable-scoped/Allow-default)' },
  { id: 'FN-AST-009', family: 'agent-studio', name: 'Session completion policy: Stays open | Ends after first valid output', breadth: 2, depth: 1, reach: 1, status: 'INAPP', entry: 'AgentInputsDrawer session completion (mode, maxTurns, verification, dryRunDefault)' },
  { id: 'FN-AST-010', family: 'agent-studio', name: 'System prompt editor: tabs (System prompt | Initial user message) + rich-text toolbar + "/"-insert Inputs/Variables cascading menu', breadth: 4, depth: 3, reach: 2, status: 'INAPP', entry: 'AipLogicPanel prompt editor: System/Developer/Examples tabs + toolbar + keyboard-aware SlashComposer cascade' },

  // ── Machinery (state-transition analytics) ──
  { id: 'FN-MCH-001', family: 'machinery', name: 'State-transition graph: duration-encoded nodes + DAYS edge pills + terminal color coding', breadth: 2, depth: 4, reach: 1, status: 'INAPP', entry: 'GraphCanvas machinery mode: duration nodes + DAYS pills + terminal tones' },
  { id: 'FN-MCH-002', family: 'machinery', name: 'Metric carousel: Historical count | Current count | Historical duration', breadth: 2, depth: 2, reach: 1, status: 'INAPP', entry: 'MachineryCarousel: Historical/Current/Duration cycling with Trace+Audit' },
  { id: 'FN-MCH-003', family: 'machinery', name: 'Contextual zoom: node → stat-card expansion (3 stat rows) + zoom chip', breadth: 1, depth: 3, reach: 1, status: 'INAPP', entry: 'MachineryGraph zoom card (sub-state table + camera centering)' },
  { id: 'FN-MCH-004', family: 'machinery', name: 'Deviations toggle + dotted deviation edges + Deviations|Included segmented', breadth: 1, depth: 2, reach: 1, status: 'INAPP', entry: 'MachineryGraph deviation filter (All/Deviations/On time) + dotted deviation edges' },
  { id: 'FN-MCH-005', family: 'machinery', name: 'Path explorer panel: checked path rows + counts + proportional bars + sort', breadth: 1, depth: 4, reach: 1, status: 'INAPP', entry: 'PathExplorer: checked path rows + duration bars + click-to-highlight (ws.meta persisted)' },
  { id: 'FN-MCH-006', family: 'machinery', name: 'Duration distribution histogram: brushed range brackets filtering graph', breadth: 1, depth: 3, reach: 1, status: 'INAPP', entry: 'DurationHistogram: brush (drag + sliders + Clear + Esc) dims non-matching nodes/edges' },
  { id: 'FN-MCH-007', family: 'machinery', name: 'Subprocess grouping frames + floating zoom chip (Inpatient Encounter [State ])', breadth: 1, depth: 2, reach: 1, status: 'INAPP', entry: 'MachineryGraph subprocess frames toggle (grouped + padded bounds)' },
  { id: 'FN-MCH-008', family: 'machinery', name: 'Transition nodes toggle + History count series', breadth: 1, depth: 1, reach: 1, status: 'INAPP', entry: 'MachineryGraph transition toggle + selection history sparkline' },

  // ── Session observability ──
  { id: 'FN-OBS-001', family: 'observability', name: 'Session debugging timeline: Agent/Internal event diamonds + click-to-filter + ⌘-click multi + date chip', breadth: 2, depth: 3, reach: 1, status: 'INAPP', entry: 'ObservabilityModule diamond timeline (Agent/Internal, click + ⌘ multi, date chip)' },
  { id: 'FN-OBS-002', family: 'observability', name: 'Event table: Time|Type|Updates(↻⚡ badges)|Payload + Type filter + payload search', breadth: 2, depth: 3, reach: 1, status: 'INAPP', entry: 'ObservabilityModule event table (Updates badges, Type filter, payload search)' },
  { id: 'FN-OBS-003', family: 'observability', name: 'Chat replay panel (Session view) Preview|Raw with tool-call chips', breadth: 1, depth: 2, reach: 1, status: 'INAPP', entry: 'ObservabilityModule replay panel (Preview|Raw, Ran <tool> lines + status chips)' },
  { id: 'FN-OBS-004', family: 'observability', name: 'Trace waterfall: nested spans (VM workload/exec function/user code/POST /compute/LLM) + zoom + colored LLM spans', breadth: 2, depth: 4, reach: 1, status: 'INAPP', entry: 'ObservabilityModule waterfall: span bars scaled to session + zoom +/-/Reset + LLM colored spans' },
  { id: 'FN-OBS-005', family: 'observability', name: 'Logs table: 6 cols + tags/parameters chips + wildcard search + Copy as JSON', breadth: 2, depth: 3, reach: 1, status: 'INAPP', entry: 'ObservabilityModule logs panel (6 cols, wildcard search, Copy as JSON + clipboard fallback)' },

  // ── Geo / COP ──
  { id: 'FN-GEO-001', family: 'geo', name: 'Map cluster-layer config: Point/Cluster/Choropleth/Line segment + geohash property + aggregation + autoscale', breadth: 2, depth: 4, reach: 2, status: 'INAPP', entry: 'MapCanvas cluster config (Layer/Agg/Precision/Autoscale) + geohash aggregation' },
  { id: 'FN-GEO-002', family: 'geo', name: 'COP faceted filter rail: checkbox-count facets (up to 731 k) + histogram date range + typeahead + map-table linkage', breadth: 3, depth: 4, reach: 1, status: 'INAPP', entry: 'MapModule facet rail + HistogramBrush + map-table linkage (facetEngine)' },
  { id: 'FN-GEO-003', family: 'geo', name: 'Metric cards over map with aggregate bubbles + legend', breadth: 2, depth: 2, reach: 1, status: 'INAPP', entry: 'MapModule metric cards (Successful/Cancelled/Diverted) + bubble legend' },

  // ── Pipeline Builder LL extension ──
  { id: 'FN-PLM-001', family: 'pipeline-llm', name: 'Build settings: Batch vs Streaming + compute Standard/Lightweight/External-Databricks', breadth: 2, depth: 3, reach: 2, status: 'INAPP', entry: 'PipelineBuilder build-settings modal (batch/streaming, compute profiles, cadence, naming)' },
  { id: 'FN-PLM-002', family: 'pipeline-llm', name: 'Graph canvas: legend color mapping + Add data/Reusables + per-node deploy status', breadth: 2, depth: 3, reach: 1, status: 'INAPP', entry: 'PipelineBuilder legend canvas + per-card deploy badges (Live/Building/Failed/Queued)' },
  { id: 'FN-PLM-003', family: 'pipeline-llm', name: 'Use LLM node template config: business Context + neg/pos steppers + column picker + model + Show configurations', breadth: 2, depth: 4, reach: 2, status: 'INAPP', entry: 'PipelineBuilder Use-LLM panel (Context, steppers, column/model pickers, config JSON)' },

  // ── Peer Manager ──
  { id: 'FN-PEER-001', family: 'peer-manager', name: 'Peer connections home: connection table + job health', breadth: 1, depth: 2, reach: 1, status: 'INAPP', entry: 'PeerManager connections home (search, classification status, job health)' },
  { id: 'FN-PEER-002', family: 'peer-manager', name: 'Connection overview: Local/Remote topology + security classification + peering jobs (Start export / Send Ack)', breadth: 1, depth: 3, reach: 1, status: 'INAPP', entry: 'PeerManager overview: topology chips + gated Start export / Send Ack jobs (state machine)' },
  { id: 'FN-PEER-003', family: 'peer-manager', name: 'Ontology mapping wizard: Map properties → Configure peering → Summary + Do not map property', breadth: 1, depth: 4, reach: 1, status: 'INAPP', entry: 'PeerManager 3-step wizard (Select → Map → Review) + Do not map; ws.meta.peerMapping' },

  // ── Governance / history ──
  { id: 'FN-GOV-001', family: 'governance', name: 'Ontology Manager main-branch updates: review/rebase incoming changes + resource-type nav with counts', breadth: 2, depth: 3, reach: 2, status: 'INAPP', entry: 'OntologyStudio gov-branch-bar: pending count, review panel, rebase onto main' },
  { id: 'FN-GOV-002', family: 'governance', name: 'Dataset transactions history: RIDs + job details + Rollback to transaction + Force snapshot + date-range job metrics', breadth: 2, depth: 3, reach: 1, status: 'INAPP', entry: 'OntologyStudio + DataHub RID history: Force snapshot (RID-…), restore, rolled-back pending' },
  { id: 'FN-GOV-003', family: 'governance', name: 'Health Checks: data-quality gating (warn support teams / block unsatisfactory assets)', breadth: 2, depth: 3, reach: 2, status: 'INAPP', entry: 'Health Checks panels: 8 ontology rules + 5 dataset gates with Pass/Fail pills' },

  // ── Marketplace / platform ──
  { id: 'FN-MKT-001', family: 'marketplace', name: 'Marketplace product version page: outputs + install mode + release channel (base for Plugin Manager)', breadth: 2, depth: 3, reach: 2, status: 'INAPP', entry: 'Plugin Manager T1 folder scan + install (Tauri list_local_packs %APPDATA%) + URL/paste install' },
  { id: 'FN-MKT-002', family: 'marketplace', name: 'AIP in Code Workspaces: 11-tool toggles + ephemeral chat history + repo chrome (Sync/Propose changes)', breadth: 2, depth: 3, reach: 1, status: 'INAPP', entry: 'CodeWorkspacesModule: 11 gated tools + ephemeral chat + Sync/Propose repo chrome' },
  { id: 'FN-MKT-003', family: 'marketplace', name: 'Tiered agent app templates: Intermediate v16 Object query → Advanced v20 8 tools w/ Ontology Actions + Automated + application-state variables', breadth: 3, depth: 3, reach: 2, status: 'INAPP', entry: 'CodeWorkspacesModule v16→v20 tiered templates: diff summary + Apply maps tools + automated' },

  // ── Solution Design / scoping ──
  { id: 'FN-SCP-001', family: 'scoping', name: 'Use-case funnel canvas: card-graph (User Group, External System→Data Connector→Project→Dataset→Object Type, Scenario/Model, Automate→Notifications/Machinery, surfaces)', breadth: 3, depth: 4, reach: 2, status: 'INAPP', entry: 'ScopingModule 3-column funnel canvas (Scope→Questions→Findings, 11 seed cards)' },
  { id: 'FN-SCP-002', family: 'scoping', name: 'Guidance prompt bank: value-for-users bullets, user-needs, data-asset layering, verbatim deliverable questions', breadth: 2, depth: 2, reach: 2, status: 'INAPP', entry: 'ScopingModule guidance bank panel (14 questions, 4 categories, search + Add)' },
  { id: 'FN-SCP-003', family: 'scoping', name: 'Permissions matrix deliverable: user groups × resources access grid', breadth: 2, depth: 2, reach: 1, status: 'INAPP', entry: 'ScopingModule matrix grid: 6 capabilities × 4 roles allow/ask/deny (ws.meta.scopingMatrix)' },
  { id: 'FN-SCP-004', family: 'scoping', name: 'Scoping checklist: MVP criteria, steering cadence, beta users, data controls (Health Checks)', breadth: 2, depth: 2, reach: 2, status: 'INAPP', entry: 'ScopingModule checklist: MVP/steering/beta phases, assignees, done/total chips' },

  // ── Functions LLM SDK ──
  { id: 'FN-FNS-001', family: 'functions-sdk', name: 'Function authoring: LanguageModels GPT_4 createChatCompletion w/ systemPrompt + roles + temperature', breadth: 3, depth: 3, reach: 2, status: 'MISSING', entry: 'Agent Console LLM client exists' },
  { id: 'FN-FNS-002', family: 'functions-sdk', name: 'Ontology completions demo: write AI summary into object property via action + action logs', breadth: 2, depth: 3, reach: 2, status: 'MISSING', entry: '' },
  { id: 'FN-FNS-003', family: 'functions-sdk', name: 'Function-backed Workshop variable: USERPROMPT/SYSTEMPROMPT/TEMPERATURE binds + recompute policy (Only when triggered by an event)', breadth: 2, depth: 4, reach: 2, status: 'MISSING', entry: '' },
]

const T = (n) => Math.log10(n + 1)
const scored = REGISTRY.map(r => ({ ...r, score: Number((r.depth + 2*T(r.breadth) + 3*Math.min(1 + r.reach, 3)).toFixed(2)), tier: 'T3' }))
for (const r of scored) r.tier = r.score >= 9 ? 'T1' : r.score >= 5.5 ? 'T2' : 'T3'

const byTier = { T1: scored.filter(r => r.tier === 'T1'), T2: scored.filter(r => r.tier === 'T2'), T3: scored.filter(r => r.tier === 'T3') }
const functionsMdPath = functionsMd
const functionsMdSrc = [
  '# FUNCTIONS.md — Capability inventory (Stage 4)',
  '',
  `Generated ${new Date().toISOString()} · vision-verified against \`C:\\Users\\Berry\\Desktop\\Ontology Harness\``,
  '',
  '## Counts',
  '',
  `- Total atomic capabilities: **${scored.length}**`,
  `- Tier T1 (universal): ${byTier.T1.length} — ${byTier.T1.map(r=>r.id).join(', ')}`,
  `- Tier T2 (contextual): ${byTier.T2.length}`,
  `- Tier T3 (instructional): ${byTier.T3.length}`,
  '',
  '## Registry',
  '',
  ...[...byTier.T1, ...byTier.T2, ...byTier.T3].map(r => `### ${r.id} — ${r.name}\nTier **${r.tier}** · depth ${r.depth}/breadth ${r.breadth}/reach ${r.reach} · score ${r.score} · **${r.status}**\nEntry point: ${r.entry || '—'}\n`),
].join('\n')
writeFileSync(functionsMdPath, functionsMdSrc)

// ── write per-cluster master prompts ──
const clusters = {
  'FN-BLD-SPLIT': { title: 'Section splitting & add-widget block', ids: ['FN-BLD-001','FN-BLD-003'], tier: 'T1', description: 'Split-section dropdown (New section above/below/on left/on right) + empty-section "Add widget"/"Set layout" dashed affordance. Both are zero-definition empty-container flows.' },
  'FN-BLD-TABLE': { title: 'Object Table column configuration', ids: ['FN-BLD-009','FN-BLD-010','FN-BLD-011','FN-BLD-012','FN-BLD-014','FN-BLD-015'], tier: 'T1', description: 'Column config: reorder, add/remove/all, default-sort, filtering toggle, use-variable rename, number-of-columns=1, wrap.' },
  'FN-FLT-OUTPUT': { title: 'Filter → output-variable plumbing', ids: ['FN-FLT-001','FN-FLT-002','FN-FLT-003','FN-FLT-004','FN-FLT-005','FN-FLT-006','FN-FLT-007'], tier: 'T1', description: 'Filter list widget → Order Filters output variable → Rename variable → object-set variable using that filter → current value shown; multi-select dropdown default; clear/typed values.' },
  'FN-AIP-RAG': { title: 'Semantic-search + LLM composition', ids: ['FN-AIP-001','FN-AIP-002','FN-AIP-003','FN-AIP-004','FN-AIP-005','FN-AIP-007'], tier: 'T1', description: 'Semantic-search block (Embedding property, 10 results) → Use LLM block (GPT-4o, single completion, Allow corrections) → Preview run → Publish with ontology binding + version config + documentation.' },
  'FN-VRT-TEMPLATE': { title: 'Vertex knowledge-graph create + save-as-template', ids: ['FN-VRT-001','FN-VRT-002','FN-VRT-003','FN-VRT-004','FN-VRT-005','FN-VRT-006','FN-VRT-007'], tier: 'T2', description: 'Create graph → add objects (select-all/invert) → search-around → layout picker → layers (node/edge/include-as-styling) → 5-step Save-as-template wizard → time-series side panel.' },
  'FN-DEPLOY-DAG': { title: 'Pipeline Builder deploy + Clean transform', ids: ['FN-DAT-001','FN-DAT-002','FN-DAT-003'], tier: 'T2', description: 'Cast/filter/drop/rename/normalize transforms; union node config + preview; deploy with compute profile (Extra small warm pool).' },
  'FN-CONTEXT': { title: 'Ontology Manager: dependents + create first Workshop module', ids: ['FN-ONT-001','FN-ONT-002','FN-ONT-003'], tier: 'T2', description: 'Ontology Manager overview → dependents list → "Create your first Workshop module" → create new link type; value-type constraints.' },

  // ── Corpus 2 clusters ──
  'FN-FDE-CORE': { title: 'AI FDE runtime shell (sessions · outline · approval · ribbon · tool matrix · skills · model catalog)', ids: ['FN-FDE-001','FN-FDE-002','FN-FDE-003','FN-FDE-004','FN-FDE-005','FN-FDE-006','FN-FDE-007','FN-FDE-008','FN-FDE-009','FN-FDE-010','FN-FDE-011'], tier: 'T1', description: 'Agent chat shell upgrade: session manager, tokenized conversation Outline with tool rows + budget meter, tool-approval cards (Always allow for this session), attachment ribbon with per-type count chips, tool-carrying Modes ("Adds 26 tools"), tri-panel tool permission matrix with If/Else Allow/Ask rules on branch conditions, skill-set configurations modal, documentation attach, model catalog picker with detail pane, reasoning-tier pill + keyboard protocol.' },
  'FN-AST-AUTHOR': { title: 'Agent Studio authoring (inputs · variables/chains · tools · repo lifecycle)', ids: ['FN-AST-001','FN-AST-002','FN-AST-003','FN-AST-004','FN-AST-005','FN-AST-006','FN-AST-007','FN-AST-008','FN-AST-009','FN-AST-010'], tier: 'T1', description: 'Agent definition: typed Inputs (Required/Optional), Pre-computed variables from templates, variable operation chains (Filter → Search around link traversal, typed output, Problems bar), Tools binding (Apply actions/Call function/Ontology SQL/Custom tool + Automated), repo provisioning (model + Auto-import + bind to ontology + Agent API name), Tag-and-release semver modal, Checks tab, scoped imports console (resources.json), Session completion policy, rich-text system prompt editor with "/"-insert.' },
  'FN-MCH-ANALYTICS': { title: 'Machinery state-transition analytics (8 functions)', ids: ['FN-MCH-001','FN-MCH-002','FN-MCH-003','FN-MCH-004','FN-MCH-005','FN-MCH-006','FN-MCH-007','FN-MCH-008'], tier: 'T2', description: 'State-graph widget family on the existing graph substrate: duration-encoded nodes, DAYS edge pills, metric carousel (Historical count|Current count|Historical duration), contextual-zoom stat cards, deviation dotted edges, path explorer with checked rows + bars, brushed duration histogram, subprocess frames + floating zoom chips, transition-nodes toggle.' },
  'FN-OBS-STACK': { title: 'Session observability stack (timeline · event table · replay · waterfall · logs)', ids: ['FN-OBS-001','FN-OBS-002','FN-OBS-003','FN-OBS-004','FN-OBS-005'], tier: 'T2', description: 'Session debug page from the trace ledger: diamond timeline (Agent vs Internal, click-to-filter), event table with Updates badges + Type filter, chat replay with Preview|Raw, waterfall spans with colored LLM spans, 6-column logs table with wildcard search + Copy as JSON.' },
  'FN-GEO-COP': { title: 'Geo maps & common operating picture', ids: ['FN-GEO-001','FN-GEO-002','FN-GEO-003'], tier: 'T2', description: 'Map family: cluster-layer config (Point/Cluster/Choropleth/Line segment, geohash, aggregation, autoscale), COP faceted filter rail with count checkboxes + histogram date range, metric cards over map with aggregate bubbles.' },
  'FN-PLM-EXT': { title: 'Pipeline Builder LL extensions (build settings · legend graph · Use LLM node)', ids: ['FN-PLM-001','FN-PLM-002','FN-PLM-003'], tier: 'T2', description: 'Batch vs Streaming build settings with compute profiles incl. External-Databricks; legend-driven node coloring + Add data/Reusables + per-node deploy status; template-driven Use LLM node (business Context, sentiment value steppers, column picker).' },
  'FN-GOV-PEER': { title: 'Governance: branching, dataset history, Peer Manager', ids: ['FN-GOV-001','FN-GOV-002','FN-GOV-003','FN-PEER-001','FN-PEER-002','FN-PEER-003'], tier: 'T2', description: 'Ontology Manager main-branch review/rebase; dataset transaction history w/ Rollback + Force snapshot; Health Checks gating; Peer Manager connections (topology, peering jobs Start export/Send Ack) and 3-step ontology mapping wizard.' },
  'FN-SCP-CANVAS': { title: 'Solution Design: use-case funnel canvas + guidance bank', ids: ['FN-SCP-001','FN-SCP-002','FN-SCP-003','FN-SCP-004','FN-MKT-001','FN-MKT-003'], tier: 'T2', description: 'Scoping canvas of typed capability cards (User Group, External System→Data Connector→Project→Dataset→Object Type, Scenario/Model, Automate→Notifications/Machinery, delivery surfaces) with dashed group frames + verbatim guidance-question bank + permissions matrix + MVP/steering/beta checklist; Marketplace product-version page doubles as the Plugin Manager UI; tiered agent app templates.' },
  'FN-FNS-SDK': { title: 'Functions LLM SDK surface', ids: ['FN-FNS-001','FN-FNS-002','FN-FNS-003'], tier: 'T2', description: 'createChatCompletion function authoring form (systemPrompt, roles, temperature), ontology completions writing AI properties with action logs, function-backed Workshop variables with recompute-on-event policy.' },
}

for (const [id, c] of Object.entries(clusters)) {
  const prompt = [
    `# ${id} — ${c.title}`,
    `Tier: ${c.tier} · Function IDs: ${c.ids.join(', ')}`,
    '',
    '## Reference images',
    ...id === 'FN-BLD-SPLIT'
      ? ['instructor_…1753264093_1+-+Add+Widget.1753264093409.png', 'instructor_…1753347673_1+-+Add+New+Section.1753347673715.png', 'instructor_…1753347959_2.2+-+Add+OST+Widget.1753347959727.png', 'instructor_…1753348468_6+-+Fill+space.1753348468467.png']
      : id === 'FN-BLD-TABLE'
      ? ['instructor_…1753275160_7+-+Object+Table+Props+Config.1753275160232.png', 'instructor_…1753275160_…', 'instructor_…1753349018_10+-+Add+Value.1753349018172.png', 'instructor_…1753349120_11+-+Add+All+Properties.1753349120287.png', 'instructor_…1753348883_9+-+Edit+Input+Active+Object+Set.1753348882856.png', 'instructor_…1760003401_8.3+-+Replace+Object+Table+Variable.1760003401239.png', 'instructor_…1756895761_Rename+Object+Table.1756895761590.png', 'we.jpg', '…']
      : id === 'FN-FLT-OUTPUT'
      ? ['instructor_…1753277310_3+-+Set+Object+Set.1753277309680.png', 'instructor_…1753266737_6+-+Rename+variable.1753266737653.png', 'instructor_…1753278970_8.1+-+Filter+using+Variable.1753278970436.png', 'instructor_…1753278376_6+-+Allow+Users+to+Add+Filters.1753278375787.png', 'instructor_…1753277831_5.5+Change+to+Multi-Select+Component.1753277831511.png', 'instructor_…1769083231_7+-+Rename+Filter+Output.1769083231085.png', 'sagsadg.jpg', 'sdhj.jpg', 'sfgjsdsf.jpg']
      : id === 'FN-AIP-RAG'
      ? ['instructor_…1750079495_Use+LLM+Block+Overvie.1750079495191.png', 'adfjgtsyhgd.jpg', 'agfdgfksjgzbvx.jpg', 'sfdgkhlfhj;k.jpg', 'xcvnxcmgfshjasd.jpg', 'sdfjsdh.jpg', 'instructor_…1732021860_Screenshot+2024-11-19+131017.1732021859748.png']
      : id === 'FN-VRT-TEMPLATE'
      ? ['qwtqeruyart.jpg', 'wqayryeqfc.jpg', 'wqeytqeray.jpg', 'xcvbn,kydjuthsyrgdrf.jpg', 'retyuyiijuhtsgr.jpg', 'sagsadg.jpg', 'vertex_overview-system_graph.png', 'branches-1.png']
      : id === 'FN-DEPLOY-DAG'
      ? ['pipeline_overview.png', 'instructor_…1749655488_Clean+Bureau+Transform.1749655488778.png', 'instructor_…1749821009_Clean+Office+Goods+Transform.1749821009187.png', 'instructor_…1749823347_Union+Datasets+-+1.1749823346778.png', 'instructor_…1749823757_Union+Node.1749823756830.png', 'instructor_…1759877719_Screenshot+2025-10-07+at+5.53.57PM.1759877719520.png', 'instructor_edwj6mfetvohj7wqvtfscik6h_public_1699554578_Screenshot+2023-11-08+at+13.21.50.1699554577987.png']
      : ['instructor_…1759958481_Screenshot+2025-10-08+at+4.19.52PM.1759958480924.png', 'instructor_…1756895979_2-+Overview.1756895979445.png', 'instructor_1769010682_Step+1.2+-+Ont+man.1769010682432.png (as seen)'],
    '',
    '## What it does',
    c.description,
    '',
    '## Build spec',
    '1. Add the entry point in the right module (Workshop / Data Hub / Graph / Ontology Studio).',
    '2. Wire state into `src/store.ts` (persist to SQLite via `ws_set_table \`) or `meta` key if small.',
    '3. Keyboard: Ctrl+Shift+D for Test-Your-Function equivalent; Escape closes panels.',
    '4. ARIA: role=dialog on inspectors, aria-label on icon-only buttons.',
    '5. Logging: appendTrace(kind: "tool-call", detail: "<op>") on every mutating action.',
    '6. Acceptance: screenshot diff vs reference within ±2 px; console clean; build green.',
    '',
    '## Output contract',
    'Provide: component code · store mutation · screenshot(s) light+dark · one-line changelog · failing-then-passing test.',
    '',
    '## Non-goals',
    'Do NOT resurrect removed features; no new hues; no cloud; no multi-user.',
  ].join('\n')
  writeFileSync(new URL(`../master-prompts/functions/${id}.md`, import.meta.url), prompt)
}

// ── UI_GAPS.md ──
const byStatus = { MISSING: [], PARTIAL: [], INAPP: [] }
for (const r of scored) (byStatus[r.status] ??= []).push(r)
const md = [
  '# UI_GAPS.md — Missing / partial / shipped function ledger',
  '',
  `Generated ${new Date().toISOString()} from vision-verified inventory.`,
  '',
  '## BLOCKING (MISSING) — must ship before calling Stage 4 done',
  ...byStatus.MISSING.map(r => `- **${r.id} · ${r.name}** (breadth ${r.breadth}, reach ${r.reach})`),
  '',
  '## PARTIAL — works but incomplete semantics',
  ...byStatus.PARTIAL.map(r => `- **${r.id} · ${r.name}**`),
  '',
  '## INAPP — verified in current build',
  ...byStatus.INAPP.map(r => `- **${r.id} · ${r.name}**`),
].join('\n')
writeFileSync(gapsOut, md)

// ── write functions.json ──
const json = { version: 3, generatedAt: new Date().toISOString(), registry: scored }
writeFileSync(out, JSON.stringify(json, null, 2))
console.log('FUNCTIONS.md, functions.json, UI_GAPS.md, master-prompts/functions/*.md written')
console.log('MISSING:', byStatus.MISSING.length, 'PARTIAL:', byStatus.PARTIAL.length, 'INAPP:', byStatus.INAPP.length)
