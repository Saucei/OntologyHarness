# FUNCTIONS.md — Capability inventory (Stage 4)

Generated 2026-11-08T14:01:08.517Z · vision-verified against `C:\Users\Berry\Desktop\Ontology Harness`

## Counts

- Total atomic capabilities: **105**
- Tier T1 (universal): 68 — FN-ARC-001, FN-ARC-002, FN-ARC-003, FN-DAT-001, FN-DAT-002, FN-DAT-003, FN-ONT-001, FN-ONT-002, FN-ONT-003, FN-BLD-001, FN-BLD-003, FN-BLD-004, FN-BLD-006, FN-BLD-009, FN-BLD-014, FN-BLD-015, FN-FLT-001, FN-FLT-002, FN-AIP-001, FN-AIP-002, FN-AIP-004, FN-AIP-005, FN-VRT-003, FN-VRT-006, FN-FDE-001, FN-FDE-002, FN-FDE-003, FN-FDE-004, FN-FDE-005, FN-FDE-006, FN-FDE-007, FN-FDE-008, FN-FDE-009, FN-FDE-010, FN-FDE-012, FN-AST-001, FN-AST-002, FN-AST-003, FN-AST-004, FN-AST-008, FN-AST-010, FN-MCH-001, FN-MCH-003, FN-MCH-005, FN-MCH-006, FN-OBS-001, FN-OBS-002, FN-OBS-004, FN-OBS-005, FN-GEO-001, FN-GEO-002, FN-PLM-001, FN-PLM-002, FN-PLM-003, FN-PEER-002, FN-PEER-003, FN-GOV-001, FN-GOV-002, FN-GOV-003, FN-MKT-001, FN-MKT-002, FN-MKT-003, FN-SCP-001, FN-SCP-002, FN-SCP-004, FN-FNS-001, FN-FNS-002, FN-FNS-003
- Tier T2 (contextual): 31
- Tier T3 (instructional): 6

## Registry

### FN-ARC-001 — Lineage subgraph exploration (pan/zoom/select/group-by)
Tier **T1** · depth 5/breadth 3/reach 3 · score 15.2 · **INAPP**
Entry point: Vertex graph canvas with pan/zoom/select + slate series panel

### FN-ARC-002 — Environment branching & promotion graph (Master/Dev/Feature Y/Feature X/Oct → PROD/UAT)
Tier **T1** · depth 4/breadth 1/reach 2 · score 13.6 · **INAPP**
Entry point: GraphCanvas branch graph overlay: BRANCH_NODES/EDGES + Promote + branch stats (ws.meta.graph)

### FN-ARC-003 — Open in Quiver from graph
Tier **T1** · depth 1/breadth 1/reach 2 · score 10.6 · **INAPP**
Entry point: Open in Quiver

### FN-DAT-001 — Clean transform: cast to Timestamp, filter not-null, drop columns, rename, normalize names
Tier **T1** · depth 5/breadth 4/reach 2 · score 15.4 · **INAPP**
Entry point: DataHub clean panel: applyCleanTransform (cast/filter/drop/rename/normalize) + preview

### FN-DAT-002 — Union node config + preview (500 rows × 11 cols)
Tier **T1** · depth 3/breadth 2/reach 2 · score 12.95 · **INAPP**
Entry point: DataHub union preview (buildUnionPreview: 500 rows × 11 cols)

### FN-DAT-003 — Deploy pipeline / select outputs / compute profile
Tier **T1** · depth 3/breadth 1/reach 2 · score 12.6 · **INAPP**
Entry point: DataHub deploy (validateDeployConfig, compute profile, status badge)

### FN-ONT-001 — Object type CRUD + value-type constraints (WarehouseId/ProductId/BatchId regex + ABV range)
Tier **T1** · depth 6/breadth 3/reach 3 · score 16.2 · **INAPP**
Entry point: Ontology Studio: Validate → value-type dropdown + inline errors

### FN-ONT-002 — Object Explorer / search by property + dependents
Tier **T1** · depth 3/breadth 2/reach 2 · score 12.95 · **PARTIAL**
Entry point: Dependents list + create Workshop module from dependents panel

### FN-ONT-003 — Link type create + toggle
Tier **T1** · depth 2/breadth 2/reach 2 · score 11.95 · **INAPP**
Entry point: OntologyStudio link create dialog + enabled toggle (createManagedLink)

### FN-BLD-001 — Add widget to section (Add widget / Set layout)
Tier **T1** · depth 2/breadth 11/reach 1 · score 10.16 · **INAPP**
Entry point: Add widget + Set layout inline on section

### FN-BLD-003 — Add section / split section / new above-below / move
Tier **T1** · depth 2/breadth 8/reach 1 · score 9.91 · **INAPP**
Entry point: Add section + split columns/rows + layout picker

### FN-BLD-004 — DIMENSIONS: Row height Auto(max) / Absolute / Flex + px + resize
Tier **T1** · depth 3/breadth 4/reach 1 · score 10.4 · **INAPP**
Entry point: —

### FN-BLD-006 — SECTION HEADER toggle · Style (Subheader/Header) · TITLE use variable · Icon
Tier **T1** · depth 3/breadth 4/reach 1 · score 10.4 · **PARTIAL**
Entry point: header style + eye toggle + title variable

### FN-BLD-009 — Object Table: add column / Add all properties / Remove all properties / reorder / default sort
Tier **T1** · depth 3/breadth 4/reach 1 · score 10.4 · **INAPP**
Entry point: Column config panel

### FN-BLD-014 — Save and publish / View
Tier **T1** · depth 2/breadth 3/reach 2 · score 12.2 · **INAPP**
Entry point: Save and publish

### FN-BLD-015 — Property List widget: Add all properties / Number of columns=1 / wrap
Tier **T1** · depth 2/breadth 3/reach 1 · score 9.2 · **PARTIAL**
Entry point: NUMBER OF COLUMNS = 1

### FN-FLT-001 — Add filter widget to section
Tier **T1** · depth 2/breadth 4/reach 1 · score 9.4 · **INAPP**
Entry point: —

### FN-FLT-002 — Configure filters: On property / Using variable / On a link
Tier **T1** · depth 4/breadth 4/reach 2 · score 14.4 · **INAPP**
Entry point: —

### FN-AIP-001 — Semantic search block: select Embedding property, 10 results, query=userQuestion
Tier **T1** · depth 4/breadth 3/reach 2 · score 14.2 · **PARTIAL**
Entry point: Semantic search block with embeddings drop-down

### FN-AIP-002 — Use LLM block: Instructions/LLM instructions + task prompt with variable interpolation
Tier **T1** · depth 4/breadth 3/reach 2 · score 14.2 · **PARTIAL**
Entry point: Use LLM block with variable interpolation

### FN-AIP-004 — Preview run (Ctrl+Shift+D) inside logic editor
Tier **T1** · depth 3/breadth 3/reach 2 · score 13.2 · **INAPP**
Entry point: Preview run

### FN-AIP-005 — Publish function (binds to ontology: 1 Object → API name) + documentation + version config
Tier **T1** · depth 2/breadth 2/reach 2 · score 11.95 · **PARTIAL**
Entry point: Publish dialog with ontology bind

### FN-VRT-003 — Search Around menu: relation / function / saved search around
Tier **T1** · depth 3/breadth 1/reach 1 · score 9.6 · **MISSING**
Entry point: —

### FN-VRT-006 — Save as template (5-step wizard: params → search→layers→graph→defaults)
Tier **T1** · depth 5/breadth 1/reach 1 · score 11.6 · **MISSING**
Entry point: —

### FN-FDE-001 — Session manager dropdown (New session / switch / delete)
Tier **T1** · depth 2/breadth 4/reach 2 · score 12.4 · **INAPP**
Entry point: Agent Console Session Manager dropdown + persisted sessions + per-row delete

### FN-FDE-002 — Conversation Outline: tokenized turn tree + nested tool rows + token meter (~33.1K / 200K)
Tier **T1** · depth 4/breadth 3/reach 2 · score 14.2 · **INAPP**
Entry point: Agent Console Outline panel: turn tree + nested Args/Result + live token meter

### FN-FDE-003 — Tool approval card: Reject / Allow / Always allow for this session + JSON payload + copy
Tier **T1** · depth 3/breadth 5/reach 2 · score 13.56 · **INAPP**
Entry point: Agent Console approval card: JSON + copy + per-session always-allow list

### FN-FDE-004 — Composer attachment ribbon: Modes/Skills/Documentation/Files/Ontology/Functions + per-type count chips + lit "7" pill
Tier **T1** · depth 3/breadth 4/reach 2 · score 13.4 · **INAPP**
Entry point: Agent Console composer ribbon + 0/8 count chips + lit fx 7 pill from preset.modes[]

### FN-FDE-005 — Mode selector: tool-carrying modes (Transform data/Modify ontology/Write functions/Exploration/Governance/OSDK React/Platform Q&A) + segmented sub-modes + "Adds 26 tools"
Tier **T1** · depth 4/breadth 4/reach 2 · score 14.4 · **INAPP**
Entry point: AgentConsole modes popover: 7 modes + segmented sub-modes + verbatim Adds N tools pills

### FN-FDE-006 — Tool permission matrix (3-panel): categories 0/8 counts, per-tool checkboxes, If/Else rules "on branches master → Ask / else Allow", Revert/+Add, Allow|Ask
Tier **T1** · depth 5/breadth 4/reach 2 · score 15.4 · **INAPP**
Entry point: AgentConsole tri-panel permission matrix + If/Else rule engine

### FN-FDE-007 — Skill set configurations modal (Models | Skills | Tool approvals) with enabled toggles + Apply to current session
Tier **T1** · depth 3/breadth 3/reach 2 · score 13.2 · **INAPP**
Entry point: AgentConsole skill modal (draft toggles, Apply to session, ws.meta agentSkills)

### FN-FDE-008 — Documentation attach popover (Custom docs vs Foundry documentation bundles/pages)
Tier **T1** · depth 2/breadth 2/reach 2 · score 11.95 · **INAPP**
Entry point: AgentConsole docs popover (Custom docs / Foundry bundles, live counts, ws.meta agentDocs)

### FN-FDE-009 — Model catalog picker: Hosted|Registered|More tabs + detail pane (Class/Cost/Speed chips, ctx/max-out/TPM/RPM)
Tier **T1** · depth 3/breadth 4/reach 2 · score 13.4 · **INAPP**
Entry point: Providers catalog tabs + detail pane (Class/Cost/Speed, ctx/TPM/RPM)

### FN-FDE-010 — Reasoning-tier pill ("Balanced • GPT-6.1 Sol (Medium)") + keyboard protocol Enter/Shift+Enter/Ctrl+Enter + "/" and "$" triggers
Tier **T1** · depth 2/breadth 3/reach 1 · score 9.2 · **INAPP**
Entry point: AgentConsole tier pill + Enter/Shift+Enter/Ctrl+Enter + / $ triggers

### FN-FDE-012 — Prompt template gallery: Classification/Sentiment/Summarization/Entity extraction/Translation/Empty
Tier **T1** · depth 2/breadth 2/reach 2 · score 11.95 · **INAPP**
Entry point: PresetsModule gallery grid: 6 templates + Apply writes into active preset (ws.meta)

### FN-AST-001 — Agent Inputs editor: typed String + Required|Optional segmented + rename/delete
Tier **T1** · depth 2/breadth 3/reach 2 · score 12.2 · **INAPP**
Entry point: AgentInputsDrawer: typed inputs editor (name, type, Required/Optional, add/delete)

### FN-AST-002 — Pre-computed variables: template cards (Define object set / Compute from function / Apply actions) + operation search + category tiles
Tier **T1** · depth 3/breadth 3/reach 2 · score 13.2 · **INAPP**
Entry point: AgentInputsDrawer template cards: search + Use apply ({input}) + count/sum/text evaluation

### FN-AST-003 — Variable operation chains: start set → Filter object set → Search around (link traversal picker) + typed output chip + Problems bar
Tier **T1** · depth 5/breadth 4/reach 2 · score 15.4 · **INAPP**
Entry point: AgentInputsDrawer chain builder: Filter (11 ops) + SearchAround BFS + typed output + Problems bar

### FN-AST-004 — Tools binding: Apply actions / Call function / Ontology SQL / Custom tool (+ Automated no-confirm pills)
Tier **T1** · depth 3/breadth 4/reach 2 · score 13.4 · **INAPP**
Entry point: AgentConsole tools binding panel: 4 tool types + Automated pill, permission-aware (per Tool permissions matrix)

### FN-AST-008 — Scoped imports console: Ontology SDK|Platform tabs + Add ▾ (Resource Files/Models) + counts + scope settings (Enable scoped mode / Allow default scope / resources.json)
Tier **T1** · depth 3/breadth 3/reach 1 · score 10.2 · **INAPP**
Entry point: RepoModule scoped imports console (resources.json parse/stringify, Enable-scoped/Allow-default)

### FN-AST-010 — System prompt editor: tabs (System prompt | Initial user message) + rich-text toolbar + "/"-insert Inputs/Variables cascading menu
Tier **T1** · depth 3/breadth 4/reach 2 · score 13.4 · **INAPP**
Entry point: AipLogicPanel prompt editor: System/Developer/Examples tabs + toolbar + keyboard-aware SlashComposer cascade

### FN-MCH-001 — State-transition graph: duration-encoded nodes + DAYS edge pills + terminal color coding
Tier **T1** · depth 4/breadth 2/reach 1 · score 10.95 · **INAPP**
Entry point: GraphCanvas machinery mode: duration nodes + DAYS pills + terminal tones

### FN-MCH-003 — Contextual zoom: node → stat-card expansion (3 stat rows) + zoom chip
Tier **T1** · depth 3/breadth 1/reach 1 · score 9.6 · **INAPP**
Entry point: MachineryGraph zoom card (sub-state table + camera centering)

### FN-MCH-005 — Path explorer panel: checked path rows + counts + proportional bars + sort
Tier **T1** · depth 4/breadth 1/reach 1 · score 10.6 · **INAPP**
Entry point: PathExplorer: checked path rows + duration bars + click-to-highlight (ws.meta persisted)

### FN-MCH-006 — Duration distribution histogram: brushed range brackets filtering graph
Tier **T1** · depth 3/breadth 1/reach 1 · score 9.6 · **INAPP**
Entry point: DurationHistogram: brush (drag + sliders + Clear + Esc) dims non-matching nodes/edges

### FN-OBS-001 — Session debugging timeline: Agent/Internal event diamonds + click-to-filter + ⌘-click multi + date chip
Tier **T1** · depth 3/breadth 2/reach 1 · score 9.95 · **INAPP**
Entry point: ObservabilityModule diamond timeline (Agent/Internal, click + ⌘ multi, date chip)

### FN-OBS-002 — Event table: Time|Type|Updates(↻⚡ badges)|Payload + Type filter + payload search
Tier **T1** · depth 3/breadth 2/reach 1 · score 9.95 · **INAPP**
Entry point: ObservabilityModule event table (Updates badges, Type filter, payload search)

### FN-OBS-004 — Trace waterfall: nested spans (VM workload/exec function/user code/POST /compute/LLM) + zoom + colored LLM spans
Tier **T1** · depth 4/breadth 2/reach 1 · score 10.95 · **INAPP**
Entry point: ObservabilityModule waterfall: span bars scaled to session + zoom +/-/Reset + LLM colored spans

### FN-OBS-005 — Logs table: 6 cols + tags/parameters chips + wildcard search + Copy as JSON
Tier **T1** · depth 3/breadth 2/reach 1 · score 9.95 · **INAPP**
Entry point: ObservabilityModule logs panel (6 cols, wildcard search, Copy as JSON + clipboard fallback)

### FN-GEO-001 — Map cluster-layer config: Point/Cluster/Choropleth/Line segment + geohash property + aggregation + autoscale
Tier **T1** · depth 4/breadth 2/reach 2 · score 13.95 · **INAPP**
Entry point: MapCanvas cluster config (Layer/Agg/Precision/Autoscale) + geohash aggregation

### FN-GEO-002 — COP faceted filter rail: checkbox-count facets (up to 731 k) + histogram date range + typeahead + map-table linkage
Tier **T1** · depth 4/breadth 3/reach 1 · score 11.2 · **INAPP**
Entry point: MapModule facet rail + HistogramBrush + map-table linkage (facetEngine)

### FN-PLM-001 — Build settings: Batch vs Streaming + compute Standard/Lightweight/External-Databricks
Tier **T1** · depth 3/breadth 2/reach 2 · score 12.95 · **INAPP**
Entry point: PipelineBuilder build-settings modal (batch/streaming, compute profiles, cadence, naming)

### FN-PLM-002 — Graph canvas: legend color mapping + Add data/Reusables + per-node deploy status
Tier **T1** · depth 3/breadth 2/reach 1 · score 9.95 · **INAPP**
Entry point: PipelineBuilder legend canvas + per-card deploy badges (Live/Building/Failed/Queued)

### FN-PLM-003 — Use LLM node template config: business Context + neg/pos steppers + column picker + model + Show configurations
Tier **T1** · depth 4/breadth 2/reach 2 · score 13.95 · **INAPP**
Entry point: PipelineBuilder Use-LLM panel (Context, steppers, column/model pickers, config JSON)

### FN-PEER-002 — Connection overview: Local/Remote topology + security classification + peering jobs (Start export / Send Ack)
Tier **T1** · depth 3/breadth 1/reach 1 · score 9.6 · **INAPP**
Entry point: PeerManager overview: topology chips + gated Start export / Send Ack jobs (state machine)

### FN-PEER-003 — Ontology mapping wizard: Map properties → Configure peering → Summary + Do not map property
Tier **T1** · depth 4/breadth 1/reach 1 · score 10.6 · **INAPP**
Entry point: PeerManager 3-step wizard (Select → Map → Review) + Do not map; ws.meta.peerMapping

### FN-GOV-001 — Ontology Manager main-branch updates: review/rebase incoming changes + resource-type nav with counts
Tier **T1** · depth 3/breadth 2/reach 2 · score 12.95 · **INAPP**
Entry point: OntologyStudio gov-branch-bar: pending count, review panel, rebase onto main

### FN-GOV-002 — Dataset transactions history: RIDs + job details + Rollback to transaction + Force snapshot + date-range job metrics
Tier **T1** · depth 3/breadth 2/reach 1 · score 9.95 · **INAPP**
Entry point: OntologyStudio + DataHub RID history: Force snapshot (RID-…), restore, rolled-back pending

### FN-GOV-003 — Health Checks: data-quality gating (warn support teams / block unsatisfactory assets)
Tier **T1** · depth 3/breadth 2/reach 2 · score 12.95 · **INAPP**
Entry point: Health Checks panels: 8 ontology rules + 5 dataset gates with Pass/Fail pills

### FN-MKT-001 — Marketplace product version page: outputs + install mode + release channel (base for Plugin Manager)
Tier **T1** · depth 3/breadth 2/reach 2 · score 12.95 · **INAPP**
Entry point: Plugin Manager T1 folder scan + install (Tauri list_local_packs %APPDATA%) + URL/paste install

### FN-MKT-002 — AIP in Code Workspaces: 11-tool toggles + ephemeral chat history + repo chrome (Sync/Propose changes)
Tier **T1** · depth 3/breadth 2/reach 1 · score 9.95 · **INAPP**
Entry point: CodeWorkspacesModule: 11 gated tools + ephemeral chat + Sync/Propose repo chrome

### FN-MKT-003 — Tiered agent app templates: Intermediate v16 Object query → Advanced v20 8 tools w/ Ontology Actions + Automated + application-state variables
Tier **T1** · depth 3/breadth 3/reach 2 · score 13.2 · **INAPP**
Entry point: CodeWorkspacesModule v16→v20 tiered templates: diff summary + Apply maps tools + automated

### FN-SCP-001 — Use-case funnel canvas: card-graph (User Group, External System→Data Connector→Project→Dataset→Object Type, Scenario/Model, Automate→Notifications/Machinery, surfaces)
Tier **T1** · depth 4/breadth 3/reach 2 · score 14.2 · **INAPP**
Entry point: ScopingModule 3-column funnel canvas (Scope→Questions→Findings, 11 seed cards)

### FN-SCP-002 — Guidance prompt bank: value-for-users bullets, user-needs, data-asset layering, verbatim deliverable questions
Tier **T1** · depth 2/breadth 2/reach 2 · score 11.95 · **INAPP**
Entry point: ScopingModule guidance bank panel (14 questions, 4 categories, search + Add)

### FN-SCP-004 — Scoping checklist: MVP criteria, steering cadence, beta users, data controls (Health Checks)
Tier **T1** · depth 2/breadth 2/reach 2 · score 11.95 · **INAPP**
Entry point: ScopingModule checklist: MVP/steering/beta phases, assignees, done/total chips

### FN-FNS-001 — Function authoring: LanguageModels GPT_4 createChatCompletion w/ systemPrompt + roles + temperature
Tier **T1** · depth 3/breadth 3/reach 2 · score 13.2 · **MISSING**
Entry point: Agent Console LLM client exists

### FN-FNS-002 — Ontology completions demo: write AI summary into object property via action + action logs
Tier **T1** · depth 3/breadth 2/reach 2 · score 12.95 · **MISSING**
Entry point: —

### FN-FNS-003 — Function-backed Workshop variable: USERPROMPT/SYSTEMPROMPT/TEMPERATURE binds + recompute policy (Only when triggered by an event)
Tier **T1** · depth 4/breadth 2/reach 2 · score 13.95 · **MISSING**
Entry point: —

### FN-BLD-002 — Object Set title widget (bind Active Object Set)
Tier **T2** · depth 2/breadth 2/reach 1 · score 8.95 · **INAPP**
Entry point: Input object set picker (Object table 1 Active object)

### FN-BLD-005 — Fill space / column width (Absolute/Flex)+resize
Tier **T2** · depth 2/breadth 2/reach 1 · score 8.95 · **INAPP**
Entry point: —

### FN-BLD-007 — Color / background override per widget (Light gray 4 …)
Tier **T2** · depth 2/breadth 2/reach 1 · score 8.95 · **INAPP**
Entry point: 4 swatches inline on section header · persists

### FN-BLD-008 — Collapsible section + icon to expand/collapse
Tier **T2** · depth 2/breadth 2/reach 1 · score 8.95 · **INAPP**
Entry point: chevron collapse · tree prunes · persisted

### FN-BLD-010 — Object Table: rename column + use variable toggle
Tier **T2** · depth 2/breadth 2/reach 1 · score 8.95 · **INAPP**
Entry point: Column config rename arrow

### FN-BLD-011 — Object Table: Enable object table filtering toggle
Tier **T2** · depth 2/breadth 2/reach 1 · score 8.95 · **INAPP**
Entry point: Enable object table filtering toggle

### FN-BLD-012 — INPUT DATA: clear object set variable (X) + enable filtering
Tier **T2** · depth 2/breadth 2/reach 1 · score 8.95 · **PARTIAL**
Entry point: X icon on object set picker

### FN-BLD-013 — Layout tree: page/section/widget click-to-select + breadcrumb
Tier **T2** · depth 2/breadth 2/reach 1 · score 8.95 · **INAPP**
Entry point: role=tree · arrow-key expand + select

### FN-BLD-016 — Edit variable window (rename / type / root object)
Tier **T2** · depth 1/breadth 2/reach 1 · score 7.95 · **INAPP**
Entry point: Edit variable

### FN-FLT-003 — Filter widget output = variable (Order Filters) + rename via Rename variable
Tier **T2** · depth 2/breadth 2/reach 1 · score 8.95 · **INAPP**
Entry point: —

### FN-FLT-004 — Toggle "allow users to add and remove filters"
Tier **T2** · depth 1/breadth 2/reach 1 · score 7.95 · **INAPP**
Entry point: —

### FN-AIP-003 — Single completion / GPT-4o / Allow corrections output-enforcement toggle
Tier **T2** · depth 2/breadth 1/reach 1 · score 8.6 · **INAPP**
Entry point: Use LLM block

### FN-AIP-007 — Add as test case → test-case list + re-run
Tier **T2** · depth 2/breadth 2/reach 1 · score 8.95 · **MISSING**
Entry point: —

### FN-VRT-001 — Vertex graph: create & name graph; graph-type picker in New menu
Tier **T2** · depth 1/breadth 2/reach 1 · score 7.95 · **MISSING**
Entry point: —

### FN-VRT-002 — Add objects to graph: select all / invert selection / add selected (Ctrl+A)
Tier **T2** · depth 2/breadth 1/reach 1 · score 8.6 · **MISSING**
Entry point: —

### FN-VRT-005 — Graph layers: node layer / edge layer / include-as-styling
Tier **T2** · depth 2/breadth 1/reach 1 · score 8.6 · **MISSING**
Entry point: —

### FN-VRT-007 — Time-series @demand + ale_demand_forecast in side panel
Tier **T2** · depth 2/breadth 1/reach 0 · score 5.6 · **MISSING**
Entry point: —

### FN-VRT-008 — Open in Quiver from graph (exports)
Tier **T2** · depth 1/breadth 1/reach 1 · score 7.6 · **INAPP**
Entry point: —

### FN-FDE-011 — Thinking collapsible card in agent turns
Tier **T2** · depth 1/breadth 2/reach 1 · score 7.95 · **INAPP**
Entry point: AgentConsole thinking-card (transcript Thinking message per prompt)

### FN-AST-005 — Repo provisioning: Model + Auto-import + agent name/location + Bind to ontology + Agent API name
Tier **T2** · depth 2/breadth 2/reach 1 · score 8.95 · **INAPP**
Entry point: RepoModule provisioning form (validateProvisioning, sanitizeApiName)

### FN-AST-006 — Tag and release: semver modal Patch/Minor/Major/Custom + branch|commit selector + "Releasing: x.y.z"
Tier **T2** · depth 2/breadth 2/reach 1 · score 8.95 · **INAPP**
Entry point: RepoModule tag-and-release modal (bumpSemver, Releasing label, branch|commit target)

### FN-AST-007 — Repository Checks tab: RUNNING/SUCCEEDED dots + durations + Branches/PRs/Tags/Settings tabs
Tier **T2** · depth 2/breadth 2/reach 1 · score 8.95 · **INAPP**
Entry point: RepoModule Checks tab (runCheck/runAllChecks + tabs Branches/PRs/Tags/Settings)

### FN-AST-009 — Session completion policy: Stays open | Ends after first valid output
Tier **T2** · depth 1/breadth 2/reach 1 · score 7.95 · **INAPP**
Entry point: AgentInputsDrawer session completion (mode, maxTurns, verification, dryRunDefault)

### FN-MCH-002 — Metric carousel: Historical count | Current count | Historical duration
Tier **T2** · depth 2/breadth 2/reach 1 · score 8.95 · **INAPP**
Entry point: MachineryCarousel: Historical/Current/Duration cycling with Trace+Audit

### FN-MCH-004 — Deviations toggle + dotted deviation edges + Deviations|Included segmented
Tier **T2** · depth 2/breadth 1/reach 1 · score 8.6 · **INAPP**
Entry point: MachineryGraph deviation filter (All/Deviations/On time) + dotted deviation edges

### FN-MCH-007 — Subprocess grouping frames + floating zoom chip (Inpatient Encounter [State ])
Tier **T2** · depth 2/breadth 1/reach 1 · score 8.6 · **INAPP**
Entry point: MachineryGraph subprocess frames toggle (grouped + padded bounds)

### FN-MCH-008 — Transition nodes toggle + History count series
Tier **T2** · depth 1/breadth 1/reach 1 · score 7.6 · **INAPP**
Entry point: MachineryGraph transition toggle + selection history sparkline

### FN-OBS-003 — Chat replay panel (Session view) Preview|Raw with tool-call chips
Tier **T2** · depth 2/breadth 1/reach 1 · score 8.6 · **INAPP**
Entry point: ObservabilityModule replay panel (Preview|Raw, Ran <tool> lines + status chips)

### FN-GEO-003 — Metric cards over map with aggregate bubbles + legend
Tier **T2** · depth 2/breadth 2/reach 1 · score 8.95 · **INAPP**
Entry point: MapModule metric cards (Successful/Cancelled/Diverted) + bubble legend

### FN-PEER-001 — Peer connections home: connection table + job health
Tier **T2** · depth 2/breadth 1/reach 1 · score 8.6 · **INAPP**
Entry point: PeerManager connections home (search, classification status, job health)

### FN-SCP-003 — Permissions matrix deliverable: user groups × resources access grid
Tier **T2** · depth 2/breadth 2/reach 1 · score 8.95 · **INAPP**
Entry point: ScopingModule matrix grid: 6 capabilities × 4 roles allow/ask/deny (ws.meta.scopingMatrix)

### FN-BLD-017 — Enable favoriting (page)
Tier **T3** · depth 1/breadth 1/reach 0 · score 4.6 · **INAPP**
Entry point: OntologyStudio favorites Star page (toggleFavoriteId, All/Favorites view, ws.meta.ontologyFavorites)

### FN-FLT-005 — Multi-select dropdown (change to Multi-Select Component)
Tier **T3** · depth 1/breadth 1/reach 0 · score 4.6 · **INAPP**
Entry point: —

### FN-FLT-006 — Filter list Vertical vs Pills layout
Tier **T3** · depth 1/breadth 1/reach 0 · score 4.6 · **INAPP**
Entry point: OntologyStudio filter variants: Vertical/Pills layout toggle (ws.meta.filterVariant)

### FN-FLT-007 — Filter default value + unit prefix/suffix + validation
Tier **T3** · depth 1/breadth 1/reach 0 · score 4.6 · **INAPP**
Entry point: OntologyStudio filter variants: default value + prefix/suffix + validateFilterVariant

### FN-AIP-006 — Current User/custom context & permission scope
Tier **T3** · depth 1/breadth 1/reach 0 · score 4.6 · **MISSING**
Entry point: —

### FN-VRT-004 — Graph layout picker (Radial/Auto/Hierarchy/Grid/Circular)
Tier **T3** · depth 1/breadth 1/reach 0 · score 4.6 · **MISSING**
Entry point: —
