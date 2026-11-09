// Code Workspaces + tiered agent templates — pure helpers (FN-MKT-002/003).
// No React, no DOM, no store imports: safe to unit-test in isolation.
// Persistence lives in CodeWorkspacesModule via patchMeta/ws.meta —
// this module never touches the ledger; callers log appendTrace/appendAudit.
//
// FN-MKT-002 (Code Workspaces): 11-tool toggles + ephemeral chat history +
// repo chrome (Sync / Propose changes). Enablement gating: a workspace tool
// with `requires` is only *effectively* enabled when every dependency is
// effectively enabled.
// FN-MKT-003 (tiered templates): Intermediate v16 "Object query" and
// Advanced v20 (8 tools + Ontology Actions + Automated + app-state variables),
// with versioned diff summary + Apply onto the workspace enablement map.

export const WORKSPACE_META_KEY = 'codeWorkspaces';
export const APPLIED_TEMPLATE_META_KEY = 'appliedAgentTemplate';

/** Repo chrome stub (FN-MKT-002). */
export const REPO_SEED = {
  name: 'ontology-harness',
  branch: 'main',
  hint: 'Workspace stub — repo chrome is mocked, no network',
} as const;

export type WorkspaceToolCategory = 'read' | 'write' | 'verify' | 'ship';

export interface WorkspaceTool {
  id: string;
  label: string;
  desc: string;
  category: WorkspaceToolCategory;
  /** True when the tool mutates repo state (requires approval in a live app). */
  destructive?: boolean;
  /** Dependency tool ids — this tool is gated until every dep is enabled. */
  requires?: readonly string[];
}

/** The canonical 11 workspace tools (FN-MKT-002). Gating mirrors a real
 *  code workspace: write/edit need read; build needs write+test; deploy
 *  needs build+test; sync needs git; propose needs write+git; lint needs search. */
export const WORKSPACE_TOOLS: readonly WorkspaceTool[] = [
  { id: 'workspace.read', label: 'Read files', desc: 'Read repo files into context', category: 'read' },
  { id: 'workspace.search', label: 'Search code', desc: 'Grep symbols + filenames across the repo', category: 'read' },
  { id: 'workspace.git', label: 'Git ops', desc: 'Status, diff, stage, commit plumbing', category: 'read' },
  { id: 'workspace.write', label: 'Write files', desc: 'Create / overwrite files', category: 'write', destructive: true, requires: ['workspace.read'] },
  { id: 'workspace.edit', label: 'Edit files', desc: 'Patch hunks inside existing files', category: 'write', destructive: true, requires: ['workspace.read'] },
  { id: 'workspace.lint', label: 'Lint checks', desc: 'Type + lint pass over staged files', category: 'verify', requires: ['workspace.search'] },
  { id: 'workspace.test', label: 'Run tests', desc: 'Vitest run over the workspace', category: 'verify', requires: ['workspace.read'] },
  { id: 'workspace.build', label: 'Build', desc: 'Typecheck + bundle the workspace', category: 'verify', requires: ['workspace.write', 'workspace.test'] },
  { id: 'workspace.sync', label: 'Sync repo', desc: 'Fetch + rebase onto origin branch', category: 'ship', destructive: true, requires: ['workspace.git'] },
  { id: 'workspace.propose', label: 'Propose changes', desc: 'Open a change proposal from the working tree', category: 'ship', destructive: true, requires: ['workspace.write', 'workspace.git'] },
  { id: 'workspace.deploy', label: 'Deploy', desc: 'Ship the built workspace to the target env', category: 'ship', destructive: true, requires: ['workspace.build', 'workspace.test'] },
];

export const WORKSPACE_TOOL_IDS: readonly string[] = WORKSPACE_TOOLS.map((t) => t.id);

export function workspaceToolById(id: string): WorkspaceTool | undefined {
  return WORKSPACE_TOOLS.find((t) => t.id === id);
}

export interface ToggleEvent {
  /** Stable event id. For tool toggles: `tol-<toolId>-<seq>`; for template applies: `tpl-<templateId>-<seq>`. */
  id: string;
  /** Workspace tool id, or `template:<templateId>` for an Apply roll-up. */
  toolId: string;
  /** Enabled flag after the event. */
  enabled: boolean;
  /** ISO timestamp. */
  at: string;
  /** Optional extra context (e.g. template diff summary for Apply events). */
  detail?: string;
}

export interface WorkspaceState {
  enabled: Record<string, boolean>;
  history: ToggleEvent[];
  /** Last Sync timestamp (ISO) or null when never synced. */
  repoLastSyncAt: string | null;
  /** Number of Propose actions recorded. */
  changesProposed: number;
}

let idSeq = 0;
function nextEventId(kind: string, toolId: string): string {
  idSeq += 1;
  return `${kind}-${toolId.replace(/[^a-z0-9]+/gi, '-')}-${Date.now().toString(36)}-${idSeq}`;
}

function isoNow(): string {
  return new Date().toISOString();
}

/** Seed enablement: read/search/git + write/edit/lint/test on; build/sync/propose/deploy off. */
export function seedWorkspaceState(): WorkspaceState {
  const enabled: Record<string, boolean> = {};
  for (const t of WORKSPACE_TOOLS) {
    enabled[t.id] = ['workspace.read', 'workspace.search', 'workspace.git', 'workspace.write', 'workspace.edit', 'workspace.lint', 'workspace.test'].includes(t.id);
  }
  return { enabled, history: [], repoLastSyncAt: null, changesProposed: 0 };
}

export function enabledToolCount(state: WorkspaceState): number {
  let n = 0;
  for (const t of WORKSPACE_TOOLS) if (state.enabled[t.id]) n += 1;
  return n;
}

export function effectivelyEnabledToolCount(state: WorkspaceState): number {
  let n = 0;
  for (const t of WORKSPACE_TOOLS) if (isEffectivelyEnabled(state, t.id)) n += 1;
  return n;
}

/** Direct dependencies of `toolId` that are not (transitively) effectively enabled. */
export function missingDeps(state: WorkspaceState, toolId: string): string[] {
  const tool = workspaceToolById(toolId);
  if (!tool || !tool.requires) return [];
  const missing: string[] = [];
  for (const dep of tool.requires) {
    if (!isEffectivelyEnabled(state, dep)) missing.push(dep);
  }
  return missing;
}

/** Gating reason for a toggle attempt, or null when the tool may be enabled. */
export function gateReason(state: WorkspaceState, toolId: string): string | null {
  const missing = missingDeps(state, toolId);
  if (missing.length === 0) return null;
  return `Requires ${missing.join(', ')} (enable dependencies first)`;
}

/**
 * Effective enablement: the raw flag is on AND every dependency is
 * (transitively) effectively enabled. Cycle-safe via the `seen` set.
 */
export function isEffectivelyEnabled(state: WorkspaceState, toolId: string, seen: ReadonlySet<string> = new Set()): boolean {
  if (!workspaceToolById(toolId)) return false;
  if (seen.has(toolId)) return true; // cycle guard: break, treat as satisfied
  if (!state.enabled[toolId]) return false;
  const next = new Set(seen);
  next.add(toolId);
  const tool = workspaceToolById(toolId);
  for (const dep of tool?.requires ?? []) {
    if (!isEffectivelyEnabled(state, dep, next)) return false;
  }
  return true;
}

/**
 * Flip (or set) one tool toggle. Pure: input state is never mutated.
 * Unknown tool ids return a copy of the state with no history entry.
 * History is newest-first, capped at 50 events.
 */
export function toggleWorkspaceTool(state: WorkspaceState, toolId: string, nextEnabled?: boolean): WorkspaceState {
  if (!workspaceToolById(toolId)) return { ...state, enabled: { ...state.enabled }, history: [...state.history] };
  const current = Boolean(state.enabled[toolId]);
  const enabled = nextEnabled ?? !current;
  if (enabled === current) return { ...state, enabled: { ...state.enabled }, history: [...state.history] };
  const event: ToggleEvent = { id: nextEventId('tol', toolId), toolId, enabled, at: isoNow() };
  const history = [event, ...state.history].slice(0, 50);
  return { ...state, enabled: { ...state.enabled, [toolId]: enabled }, history };
}

/** One-line history text: "workspace.deploy → enabled · 2026-11-08T…". */
export function formatToggleEvent(event: ToggleEvent): string {
  const action = event.enabled ? 'enabled' : 'disabled';
  const base = `${event.toolId} → ${action} · ${event.at}`;
  return event.detail ? `${base} · ${event.detail}` : base;
}

/** Record a Sync action (repo chrome). Pure: returns a new state. */
export function recordSync(state: WorkspaceState): WorkspaceState {
  return { ...state, enabled: { ...state.enabled }, history: [...state.history], repoLastSyncAt: isoNow() };
}

/** Record a Propose-changes action (repo chrome). Pure: returns a new state. */
export function recordProposal(state: WorkspaceState): WorkspaceState {
  return {
    ...state,
    enabled: { ...state.enabled },
    history: [...state.history],
    changesProposed: (state.changesProposed ?? 0) + 1,
  };
}

/** Repo chrome summary line for the module header. */
export function describeRepo(state: WorkspaceState): string {
  const sync = state.repoLastSyncAt ? `synced ${state.repoLastSyncAt}` : 'never synced';
  return `${REPO_SEED.name} · ${REPO_SEED.branch} · ${sync} · ${state.changesProposed ?? 0} proposed`;
}

/* ── Ephemeral chat (FN-MKT-002: "ephemeral chat history") ───────────────
 *  Intentionally NOT persisted to ws.meta — the module keeps it in memory
 *  only so it never leaks across sessions. Helpers are pure. */

export type ChatRole = 'user' | 'agent' | 'system';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  at: string;
}

let chatSeq = 0;
function nextChatId(): string {
  chatSeq += 1;
  return `chat-${Date.now().toString(36)}-${chatSeq}`;
}

/** Seed stub conversation for the workspace chat pane. */
export function seedChat(): ChatMessage[] {
  const at = isoNow();
  return [
    { id: nextChatId(), role: 'system', text: `Workspace "${REPO_SEED.name}" attached on branch ${REPO_SEED.branch}. Ephemeral chat — nothing here is persisted.`, at },
    { id: nextChatId(), role: 'agent', text: 'Tools loaded from the workspace catalog. Toggle any tool to gate it, then Sync or Propose changes.', at },
  ];
}

/** Append a chat message (trimmed). Blank text is ignored. */
export function appendChatMessage(messages: readonly ChatMessage[], text: string, role: ChatRole = 'user'): ChatMessage[] {
  const trimmed = text.trim();
  if (!trimmed) return [...messages];
  return [...messages, { id: nextChatId(), role, text: trimmed, at: isoNow() }];
}

/* ── Tiered agent app templates (FN-MKT-003) ────────────────────────────
 *  Intermediate v16 "Object query" → Advanced v20 (8 tools, Ontology
 *  Actions, Automated, application-state variables). Versioned catalog:
 *  every template carries its version + tier so diffs stay explicit. */

export type AgentTemplateTier = 'intermediate' | 'advanced';
export type AgentTemplateVersion = 16 | 20;

export interface AgentTemplate {
  id: string;
  name: string;
  version: AgentTemplateVersion;
  tier: AgentTemplateTier;
  label: string;
  desc: string;
  tools: readonly string[];
  ontologyActions: readonly string[];
  automated: boolean;
  variables: readonly string[];
  systemPrompt: string;
  userTemplate: string;
}

/** Intermediate v16 — Object query over the ontology (FN-MKT-003). */
export const TEMPLATE_V16: AgentTemplate = {
  id: 'template-v16-intermediate',
  name: 'Object query',
  version: 16,
  tier: 'intermediate',
  label: 'Intermediate v16',
  desc: 'Query objects by property with grounding — read + search only, no writes.',
  tools: ['workspace.read', 'workspace.search', 'graph.query', 'ontology.get'],
  ontologyActions: ['ontology.lookup'],
  automated: false,
  variables: ['$selection', '$objectId'],
  systemPrompt: 'You are an object-query agent. Answer only from the selected objects and their linked properties. Cite object IDs and property names verbatim.',
  userTemplate: 'Query objects for: {{QUESTION}}. Output: matching objects with IDs, supporting properties, and evidence.',
};

/** Advanced v20 — 8 tools + Ontology Actions + Automated + app-state variables (FN-MKT-003). */
export const TEMPLATE_V20: AgentTemplate = {
  id: 'template-v20-advanced',
  name: 'Advanced agent app',
  version: 20,
  tier: 'advanced',
  label: 'Advanced v20',
  desc: '8 tools with Ontology Actions, Automated runs and application-state variables bound to the workspace.',
  tools: [
    'workspace.read',
    'workspace.search',
    'workspace.write',
    'workspace.edit',
    'workspace.test',
    'graph.query',
    'ontology.get',
    'ontology.list',
  ],
  ontologyActions: ['ontology.update', 'ontology.link', 'ontology.lookup'],
  automated: true,
  variables: ['$selection', '$objectId', '$branch', '$workspace'],
  systemPrompt: 'You are an advanced workspace agent. Plan with read/search before writing, verify with tests, and ground every claim in ontology IDs. End with Action · Evidence (IDs) · Verification · Next step.',
  userTemplate: 'Run the workspace task for: {{QUESTION}}. Output: changes proposed, ontology actions taken, verification, and next step.',
};

export const AGENT_TEMPLATES: readonly AgentTemplate[] = [TEMPLATE_V16, TEMPLATE_V20];

export function findTemplate(id?: string | null): AgentTemplate | undefined {
  if (!id) return undefined;
  return AGENT_TEMPLATES.find((t) => t.id === id);
}

export interface TemplateDiff {
  fromId: string;
  toId: string;
  addedTools: string[];
  removedTools: string[];
  addedActions: string[];
  removedActions: string[];
  addedVariables: string[];
  removedVariables: string[];
  automatedChange: string;
  /** Human-readable one-liner, e.g. "v16 → v20: +4 tools (…)". */
  summary: string;
}

function setDiff(fromArr: readonly string[], toArr: readonly string[]): { added: string[]; removed: string[] } {
  const from = new Set(fromArr);
  const to = new Set(toArr);
  return {
    added: toArr.filter((x) => !from.has(x)),
    removed: fromArr.filter((x) => !to.has(x)),
  };
}

function fmtList(prefix: string, noun: string, items: readonly string[]): string {
  const label = noun ? ` ${noun}` : '';
  if (items.length === 0) return `${prefix}0${label}`;
  return `${prefix}${items.length}${label} (${items.join(', ')})`;
}

/** Versioned diff between two templates (pure, deterministic order). */
export function diffTemplates(from: AgentTemplate, to: AgentTemplate): TemplateDiff {
  const tools = setDiff(from.tools, to.tools);
  const actions = setDiff(from.ontologyActions, to.ontologyActions);
  const vars = setDiff(from.variables, to.variables);
  const automatedChange =
    from.automated === to.automated
      ? `automated ${from.automated ? 'on' : 'off'} (unchanged)`
      : `automated ${from.automated ? 'on' : 'off'} → ${to.automated ? 'on' : 'off'}`;
  const summary = [
    `v${from.version} → v${to.version}`,
    fmtList('+', 'tools', tools.added),
    fmtList('−', 'tools', tools.removed),
    fmtList('actions +', '', actions.added),
    fmtList('actions −', '', actions.removed),
    automatedChange,
    fmtList('vars +', 'vars', vars.added),
  ].join(' · ');
  return {
    fromId: from.id,
    toId: to.id,
    addedTools: tools.added,
    removedTools: tools.removed,
    addedActions: actions.added,
    removedActions: actions.removed,
    addedVariables: vars.added,
    removedVariables: vars.removed,
    automatedChange,
    summary,
  };
}

/**
 * Apply a template onto a workspace state: every workspace tool is enabled
 * iff the template's tool list contains it (agent-only tools like
 * `graph.query` are ignored for the workspace map). One history event is
 * appended per changed workspace tool so the toggle history stays truthful.
 * Pure — input state is never mutated.
 */
export function applyAgentTemplate(state: WorkspaceState, template: AgentTemplate): WorkspaceState {
  const wanted = new Set(template.tools);
  const changed: ToggleEvent[] = [];
  const enabled: Record<string, boolean> = { ...state.enabled };
  for (const tool of WORKSPACE_TOOLS) {
    const next = wanted.has(tool.id);
    const prev = Boolean(state.enabled[tool.id]);
    enabled[tool.id] = next;
    if (next !== prev) {
      changed.push({ id: nextEventId('tpl', tool.id), toolId: tool.id, enabled: next, at: isoNow(), detail: `via ${template.id} (v${template.version})` });
    }
  }
  const history = [...changed, ...state.history].slice(0, 50);
  return { ...state, enabled, history };
}

export interface AppliedTemplate {
  templateId: string;
  version: AgentTemplateVersion;
  tier: AgentTemplateTier;
  appliedAt: string;
  summary: string;
}

export function readAppliedTemplate(meta: unknown): AppliedTemplate | null {
  if (!meta || typeof meta !== 'object') return null;
  const raw = (meta as Record<string, unknown>)[APPLIED_TEMPLATE_META_KEY];
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.templateId !== 'string' || (obj.version !== 16 && obj.version !== 20)) return null;
  const template = findTemplate(obj.templateId);
  if (!template) return null;
  return {
    templateId: obj.templateId,
    version: obj.version as AgentTemplateVersion,
    tier: obj.tier === 'advanced' ? 'advanced' : 'intermediate',
    appliedAt: typeof obj.appliedAt === 'string' ? obj.appliedAt : '',
    summary: typeof obj.summary === 'string' ? obj.summary : '',
  };
}

/** Read persisted workspace state from ws.meta (seed fallback, sanitized). */
export function readWorkspaceState(meta: unknown): WorkspaceState {
  if (meta && typeof meta === 'object') {
    const raw = (meta as Record<string, unknown>)[WORKSPACE_META_KEY];
    if (raw && typeof raw === 'object') {
      const obj = raw as Record<string, unknown>;
      const rawEnabled = obj.enabled && typeof obj.enabled === 'object' ? (obj.enabled as Record<string, unknown>) : {};
      const rawHistory = Array.isArray(obj.history) ? (obj.history as unknown[]) : [];
      const enabled: Record<string, boolean> = {};
      for (const t of WORKSPACE_TOOLS) enabled[t.id] = Boolean(rawEnabled[t.id]) || (typeof rawEnabled[t.id] === 'boolean' ? Boolean(rawEnabled[t.id]) : seedWorkspaceState().enabled[t.id]);
      // Preserve persisted booleans exactly when present; seed otherwise.
      for (const t of WORKSPACE_TOOLS) {
        if (typeof rawEnabled[t.id] === 'boolean') enabled[t.id] = rawEnabled[t.id] as boolean;
      }
      const history: ToggleEvent[] = [];
      for (const r of rawHistory) {
        if (!r || typeof r !== 'object') continue;
        const o = r as Record<string, unknown>;
        if (typeof o.id !== 'string' || typeof o.toolId !== 'string' || typeof o.enabled !== 'boolean' || typeof o.at !== 'string') continue;
        history.push({
          id: o.id,
          toolId: o.toolId,
          enabled: o.enabled,
          at: o.at,
          ...(typeof o.detail === 'string' && o.detail ? { detail: o.detail } : {}),
        });
      }
      return {
        enabled,
        history: history.slice(0, 50),
        repoLastSyncAt: typeof obj.repoLastSyncAt === 'string' ? obj.repoLastSyncAt : null,
        changesProposed: typeof obj.changesProposed === 'number' && Number.isFinite(obj.changesProposed) ? Math.max(0, Math.floor(obj.changesProposed)) : 0,
      };
    }
  }
  return seedWorkspaceState();
}

/** patchMeta payload for the workspace state. */
export function buildWorkspaceMetaPatch(state: WorkspaceState): Record<string, unknown> {
  return {
    [WORKSPACE_META_KEY]: {
      enabled: { ...state.enabled },
      history: state.history.map((h) => ({ ...h })),
      repoLastSyncAt: state.repoLastSyncAt,
      changesProposed: state.changesProposed,
    },
  };
}

/** patchMeta payload for an applied template. */
export function buildAppliedTemplateMetaPatch(applied: AppliedTemplate): Record<string, unknown> {
  return { [APPLIED_TEMPLATE_META_KEY]: { ...applied } };
}
