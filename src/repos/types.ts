// Repo Lifecycle + Scoped Imports — pure helpers (FN-AST-005/006/007/008).
// No React, no DOM, no store imports: safe to unit-test in isolation.
// Persistence lives in RepoModule via patchMeta/ws.meta —
// this module never touches the ledger; callers log appendTrace/appendAudit.
//
// FN-AST-005 Repo provisioning: Model + Auto-import + agent name/location
//            + Bind to ontology + Agent API name.
// FN-AST-006 Tag and release: semver modal Patch/Minor/Major/Custom
//            + branch|commit selector + "Releasing: x.y.z".
// FN-AST-007 Repository Checks tab: RUNNING/SUCCEEDED dots + durations
//            + Branches/PRs/Tags/Settings tabs.
// FN-AST-008 Scoped imports console: Ontology SDK|Platform tabs
//            + Add (Resource Files/Models) + counts + scope settings
//            (Enable scoped mode / Allow default scope / resources.json).

export const REPO_META_KEY = 'repos';
export const RESOURCES_META_KEY = 'resources';

/* ── FN-AST-005: Repo provisioning ──────────────────────────────────── */

export interface ProvisioningForm {
  /** Agent model id, e.g. `gpt-4o`. */
  model: string;
  /** Auto-import ontology objects into the repo on provision. */
  autoImport: boolean;
  /** Agent display name. */
  agentName: string;
  /** Agent location / workspace path. */
  agentLocation: string;
  /** Bound ontology ObjectType id (empty = unbound). */
  bindOntologyId: string;
  /** Agent API name (slug, e.g. `inventory-agent`). */
  agentApiName: string;
}

export const PROVISIONING_MODELS: readonly string[] = [
  'gpt-4o',
  'gpt-4o-mini',
  'claude-sonnet-4-5',
  'claude-haiku-4-5',
  'llama-3.3-70b-versatile',
  'gemini-2.0-flash',
];

export const DEFAULT_PROVISIONING: ProvisioningForm = {
  model: 'gpt-4o',
  autoImport: true,
  agentName: 'Inventory Agent',
  agentLocation: 'ws/agents/inventory-agent',
  bindOntologyId: 'ot-product',
  agentApiName: 'inventory-agent',
};

export function seedProvisioningForm(): ProvisioningForm {
  return { ...DEFAULT_PROVISIONING };
}

/** Agent API names are lowercase slugs: `^[a-z][a-z0-9-]{2,}$` (≥3 chars). */
export const API_NAME_PATTERN = /^[a-z][a-z0-9-]{2,}$/;

/** Lowercase + collapse whitespace/underscores to hyphens (display helper). */
export function sanitizeApiName(name: string): string {
  return (name ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Validation errors for a provisioning draft (empty = valid). */
export function validateProvisioning(form: ProvisioningForm): string[] {
  const errors: string[] = [];
  if (!form.model.trim()) errors.push('Model is required');
  if (!form.agentName.trim()) errors.push('Agent name is required');
  if (!form.agentLocation.trim()) errors.push('Agent location is required');
  if (!form.bindOntologyId.trim()) errors.push('Bind to ontology is required');
  if (!form.agentApiName.trim()) {
    errors.push('Agent API name is required');
  } else if (!API_NAME_PATTERN.test(form.agentApiName)) {
    errors.push('Agent API name must be a lowercase slug (a–z, 0–9, -) of length ≥3');
  }
  return errors;
}

export function isProvisioningValid(form: ProvisioningForm): boolean {
  return validateProvisioning(form).length === 0;
}

/** One-line summary for headers/status lines. */
export function describeProvisioning(form: ProvisioningForm): string {
  const bind = form.bindOntologyId.trim() || 'unbound';
  return `${form.agentName.trim() || '(unnamed)'} · ${form.model.trim() || 'no model'} · bind ${bind} · api ${form.agentApiName.trim() || '(no api)'}${form.autoImport ? ' · auto-import on' : ' · auto-import off'}`;
}

/* ── FN-AST-006: Tag and release (semver) ───────────────────────────── */

export interface Semver {
  major: number;
  minor: number;
  patch: number;
}

export type BumpKind = 'patch' | 'minor' | 'major' | 'custom';

export const BUMP_KINDS: readonly BumpKind[] = ['patch', 'minor', 'major', 'custom'];

const SEMVER_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)$/;

/** Parse `x.y.z` (optional leading `v`); invalid input returns null. */
export function parseSemver(text: string): Semver | null {
  if (typeof text !== 'string') return null;
  const m = SEMVER_PATTERN.exec(text.trim());
  if (!m) return null;
  const major = Number(m[1]);
  const minor = Number(m[2]);
  const patch = Number(m[3]);
  if (![major, minor, patch].every((n) => Number.isInteger(n) && n >= 0)) return null;
  return { major, minor, patch };
}

export function isSemverText(text: string): boolean {
  return parseSemver(text) !== null;
}

/** `1.2.3` form (no `v` prefix). */
export function formatSemver(v: Semver): string {
  return `${v.major}.${v.minor}.${v.patch}`;
}

/**
 * Bump a semver. Patch/Minor/Major bump the matching segment and reset
 * smaller ones; Custom returns the parsed `custom` text (null when invalid).
 */
export function bumpSemver(current: Semver, kind: BumpKind, custom?: string): Semver | null {
  switch (kind) {
    case 'patch':
      return { major: current.major, minor: current.minor, patch: current.patch + 1 };
    case 'minor':
      return { major: current.major, minor: current.minor + 1, patch: 0 };
    case 'major':
      return { major: current.major + 1, minor: 0, patch: 0 };
    case 'custom':
      return parseSemver(custom ?? '');
    default:
      return null;
  }
}

/** Negative when a < b, 0 when equal, positive when a > b. */
export function compareSemver(a: Semver, b: Semver): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

/** Modal preview line, e.g. `Releasing: 1.2.4`. */
export function releasingLabel(version: Semver): string {
  return `Releasing: ${formatSemver(version)}`;
}

const idSeq = { value: 0 };

function nextId(prefix: string): string {
  idSeq.value += 1;
  return `${prefix}-${Date.now().toString(36)}-${idSeq.value}`;
}

export type ReleaseTargetKind = 'branch' | 'commit';

export interface ReleaseTarget {
  kind: ReleaseTargetKind;
  /** Branch name when kind is `branch`. */
  branch?: string;
  /** Commit sha when kind is `commit`. */
  commit?: string;
  /** Human-readable ref: branch name or commit sha. */
  ref: string;
}

export const RELEASE_BRANCHES: readonly string[] = ['main', 'dev', 'staging'];
export const RELEASE_COMMITS: readonly string[] = ['a1b2c3d', 'e4f5a6b', '7c8d9e0'];

/** Resolve a branch|commit selector into a ReleaseTarget. */
export function resolveReleaseTarget(kind: ReleaseTargetKind, branch: string, commit: string): ReleaseTarget {
  const b = (branch ?? '').trim() || RELEASE_BRANCHES[0] || 'main';
  const c = (commit ?? '').trim() || RELEASE_COMMITS[0] || 'a1b2c3d';
  if (kind === 'commit') return { kind, commit: c, ref: c };
  return { kind, branch: b, ref: b };
}

export function describeReleaseTarget(target: ReleaseTarget): string {
  return target.kind === 'commit' ? `commit ${target.ref}` : `branch ${target.ref}`;
}

export interface ReleaseRecord {
  id: string;
  version: string;
  bump: BumpKind;
  target: ReleaseTarget;
  at: string;
  note?: string;
}

export function createReleaseRecord(input: {
  version: Semver;
  bump: BumpKind;
  target: ReleaseTarget;
  note?: string;
}): ReleaseRecord {
  return {
    id: nextId('rel'),
    version: formatSemver(input.version),
    bump: input.bump,
    target: { ...input.target },
    at: new Date().toISOString(),
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
  };
}

export function describeRelease(record: ReleaseRecord): string {
  return `${record.version} (${record.bump}) · ${describeReleaseTarget(record.target)} · ${record.at}`;
}

/** Seed "current" version shown before any release is recorded. */
export const SEED_CURRENT_VERSION: Semver = { major: 1, minor: 2, patch: 3 };

export function seedCurrentVersion(): Semver {
  return { ...SEED_CURRENT_VERSION };
}

/* ── FN-AST-007: Repository checks ──────────────────────────────────── */

export type CheckStatus = 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'QUEUED' | 'SKIPPED';

export interface RepoCheck {
  id: string;
  name: string;
  status: CheckStatus;
  durationMs: number;
  branch?: string;
  pr?: string;
  detail?: string;
  at?: string;
}

export function seedChecks(): RepoCheck[] {
  const at = new Date().toISOString();
  return [
    { id: 'chk-typecheck', name: 'Typecheck (tsc)', status: 'SUCCEEDED', durationMs: 1200, branch: 'main', detail: 'tsc -b', at },
    { id: 'chk-tests', name: 'Unit tests (vitest)', status: 'SUCCEEDED', durationMs: 3400, branch: 'main', detail: 'vitest run', at },
    { id: 'chk-build', name: 'Build (vite)', status: 'RUNNING', durationMs: 0, branch: 'main', detail: 'vite build', at },
    { id: 'chk-lint', name: 'Lint', status: 'QUEUED', durationMs: 0, branch: 'main', detail: 'eslint', at },
  ];
}

/**
 * Duration cell text: `—` when 0/negative, `120 ms` under a second,
 * `1.2 s` under a minute, else `2m 03s`.
 */
export function formatCheckDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)} s`;
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

export function checkStatusLabel(status: CheckStatus): string {
  return status;
}

/** Pill class for the status dot (glass tokens only). */
export function checkPill(status: CheckStatus): string {
  switch (status) {
    case 'SUCCEEDED':
      return 'pill pill-live';
    case 'RUNNING':
      return 'pill pill-warn';
    case 'FAILED':
      return 'pill pill-danger';
    case 'QUEUED':
    case 'SKIPPED':
    default:
      return 'pill pill-draft';
  }
}

export interface ChecksSummary {
  total: number;
  succeeded: number;
  running: number;
  failed: number;
}

export function summarizeChecks(checks: readonly RepoCheck[]): ChecksSummary {
  return {
    total: checks.length,
    succeeded: checks.filter((c) => c.status === 'SUCCEEDED').length,
    running: checks.filter((c) => c.status === 'RUNNING').length,
    failed: checks.filter((c) => c.status === 'FAILED').length,
  };
}

/**
 * Tot "Run" one check: QUEUED/RUNNING → SUCCEEDED with `durationMs`
 * (default 1200). Pure — input is never mutated; unknown ids return a copy.
 * Already-SUCCEEDED checks are kept as-is (idempotent re-run is a no-op so
 * the list stays stable for the tests); FAILED checks are retried to
 * SUCCEEDED.
 */
export function runCheck(checks: readonly RepoCheck[], id: string, durationMs = 1200): RepoCheck[] {
  return checks.map((c) => {
    if (c.id !== id) return { ...c };
    if (c.status === 'SUCCEEDED' && c.durationMs > 0) return { ...c };
    return { ...c, status: 'SUCCEEDED' as CheckStatus, durationMs, at: new Date().toISOString() };
  });
}

/** Run every QUEUED/RUNNING/FAILED check to SUCCEEDED (keeps prior durations). */
export function runAllChecks(checks: readonly RepoCheck[]): RepoCheck[] {
  return checks.map((c) => {
    if (c.status === 'SUCCEEDED' && c.durationMs > 0) return { ...c };
    return { ...c, status: 'SUCCEEDED' as CheckStatus, durationMs: c.durationMs > 0 ? c.durationMs : 1200, at: new Date().toISOString() };
  });
}

export type RepoTab = 'checks' | 'branches' | 'prs' | 'tags' | 'settings';

export const REPO_TABS: readonly RepoTab[] = ['checks', 'branches', 'prs', 'tags', 'settings'];

export function repoTabLabel(tab: RepoTab): string {
  switch (tab) {
    case 'checks':
      return 'Checks';
    case 'branches':
      return 'Branches';
    case 'prs':
      return 'PRs';
    case 'tags':
      return 'Tags';
    case 'settings':
      return 'Settings';
    default:
      return tab;
  }
}

/* ── FN-AST-008: Scoped imports / resources.json ────────────────────── */

export type ScopeSource = 'sdk' | 'platform';

export type ScopeTab = ScopeSource;

export const SCOPE_TABS: readonly ScopeTab[] = ['sdk', 'platform'];

export function scopeTabLabel(tab: ScopeTab): string {
  return tab === 'sdk' ? 'Ontology SDK' : 'Platform';
}

export type ResourceKind = 'resource-file' | 'model';

export function resourceKindLabel(kind: ResourceKind): string {
  return kind === 'resource-file' ? 'Resource File' : 'Model';
}

export interface ScopedResource {
  id: string;
  name: string;
  kind: ResourceKind;
  source: ScopeSource;
  scope: 'default' | 'custom';
  version?: string;
}

export interface ScopeSettings {
  scopedModeEnabled: boolean;
  allowDefaultScope: boolean;
  resourcesJsonPath: string;
}

export const DEFAULT_SCOPE_SETTINGS: ScopeSettings = {
  scopedModeEnabled: true,
  allowDefaultScope: false,
  resourcesJsonPath: 'resources.json',
};

export function seedScopedResources(): ScopedResource[] {
  return [
    { id: 'res-sdk-file-1', name: 'ontology/client.ts', kind: 'resource-file', source: 'sdk', scope: 'default', version: '1.2.3' },
    { id: 'res-sdk-model-1', name: 'embeddings/text-model', kind: 'model', source: 'sdk', scope: 'custom', version: '1.0.0' },
    { id: 'res-sdk-file-2', name: 'ontology/query.ts', kind: 'resource-file', source: 'sdk', scope: 'custom', version: '1.2.3' },
    { id: 'res-platform-file-1', name: 'workshop/variables.json', kind: 'resource-file', source: 'platform', scope: 'default', version: '0.4.0' },
    { id: 'res-platform-model-1', name: 'llm/summarizer', kind: 'model', source: 'platform', scope: 'custom', version: '2.1.0' },
    { id: 'res-platform-file-2', name: 'agent/tools.json', kind: 'resource-file', source: 'platform', scope: 'custom', version: '0.9.1' },
  ];
}

export function countResources(resources: readonly ScopedResource[]): number {
  return resources.length;
}

export function countBySource(resources: readonly ScopedResource[]): Record<ScopeSource, number> {
  return {
    sdk: resources.filter((r) => r.source === 'sdk').length,
    platform: resources.filter((r) => r.source === 'platform').length,
  };
}

export function filterResources(
  resources: readonly ScopedResource[],
  opts: { source?: ScopeSource | 'all'; query?: string } = {},
): ScopedResource[] {
  const q = (opts.query ?? '').trim().toLowerCase();
  return resources.filter((r) => {
    if (opts.source && opts.source !== 'all' && r.source !== opts.source) return false;
    if (q) {
      const hay = `${r.name} ${r.kind} ${r.scope} ${r.version ?? ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function resourceCountsLabel(resources: readonly ScopedResource[]): string {
  const bySource = countBySource(resources);
  return `${resources.length} imports · ${bySource.sdk} SDK · ${bySource.platform} Platform`;
}

/** Toggle one id in a selection list (pure, returns a new array). */
export function toggleSelection(selected: readonly string[], id: string): string[] {
  return selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id];
}

/** Append a new scoped import (pure). */
export function addScopedResource(
  resources: readonly ScopedResource[],
  input: { name: string; kind: ResourceKind; source: ScopeSource; scope?: 'default' | 'custom'; version?: string },
): ScopedResource[] {
  const name = input.name.trim();
  if (!name) return [...resources];
  const entry: ScopedResource = {
    id: nextId('res'),
    name,
    kind: input.kind,
    source: input.source,
    scope: input.scope ?? 'custom',
    ...(input.version?.trim() ? { version: input.version.trim() } : {}),
  };
  return [...resources, entry];
}

/* ── resources.json scope model ─────────────────────────────────────── */

export interface ResourcesJson {
  version: string;
  imports: ScopedResource[];
  settings: ScopeSettings;
}

export function buildResourcesJson(
  resources: readonly ScopedResource[],
  settings: ScopeSettings = { ...DEFAULT_SCOPE_SETTINGS },
  version = '1.0.0',
): ResourcesJson {
  return {
    version,
    imports: resources.map((r) => ({ ...r })),
    settings: { ...settings },
  };
}

export function stringifyResourcesJson(json: ResourcesJson): string {
  return JSON.stringify({ version: json.version, imports: json.imports, settings: json.settings }, null, 2);
}

/**
 * Parse a resources.json payload: JSON string, `{ version?, imports: [...],
 * settings? }`, or a bare imports array. Invalid input yields null (never
 * throws) so the console renders its empty state instead of crashing.
 */
export function parseResourcesJson(input: unknown): ResourcesJson | null {
  let value: unknown = input;
  if (typeof input === 'string') {
    const text = input.trim();
    if (!text) return null;
    try {
      value = JSON.parse(text);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== 'object') return null;
  const obj = value as Record<string, unknown>;
  const rawImports: unknown = Array.isArray(value)
    ? value
    : Array.isArray(obj.imports)
      ? obj.imports
      : null;
  if (!rawImports) return null;
  const imports: ScopedResource[] = [];
  for (const item of rawImports as unknown[]) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    if (typeof r.name !== 'string' || !r.name.trim()) continue;
    if (r.kind !== 'resource-file' && r.kind !== 'model') continue;
    if (r.source !== 'sdk' && r.source !== 'platform') continue;
    imports.push({
      id: typeof r.id === 'string' && r.id.trim() ? r.id : nextId('res'),
      name: r.name,
      kind: r.kind as ResourceKind,
      source: r.source as ScopeSource,
      scope: r.scope === 'default' ? 'default' : 'custom',
      ...(typeof r.version === 'string' && r.version.trim() ? { version: r.version } : {}),
    });
  }
  const settings = ((): ScopeSettings => {
    const raw = obj.settings;
    if (!raw || typeof raw !== 'object') return { ...DEFAULT_SCOPE_SETTINGS };
    const s = raw as Record<string, unknown>;
    return {
      scopedModeEnabled: typeof s.scopedModeEnabled === 'boolean' ? s.scopedModeEnabled : DEFAULT_SCOPE_SETTINGS.scopedModeEnabled,
      allowDefaultScope: typeof s.allowDefaultScope === 'boolean' ? s.allowDefaultScope : DEFAULT_SCOPE_SETTINGS.allowDefaultScope,
      resourcesJsonPath: typeof s.resourcesJsonPath === 'string' && s.resourcesJsonPath.trim()
        ? s.resourcesJsonPath
        : DEFAULT_SCOPE_SETTINGS.resourcesJsonPath,
    };
  })();
  return {
    version: typeof obj.version === 'string' && obj.version.trim() ? obj.version : '1.0.0',
    imports,
    settings,
  };
}

/** Preview text for the `resources.json` pane. */
export function resourcesJsonPreview(
  resources: readonly ScopedResource[],
  settings: ScopeSettings = { ...DEFAULT_SCOPE_SETTINGS },
  version = '1.0.0',
): string {
  return stringifyResourcesJson(buildResourcesJson(resources, settings, version));
}

/* ── Aggregate lifecycle state + persistence helpers ────────────────── */

export interface RepoLifecycleState {
  provisioning: ProvisioningForm;
  releases: ReleaseRecord[];
  checks: RepoCheck[];
  currentVersion: Semver;
  resources: ScopedResource[];
  scopeSettings: ScopeSettings;
  selectedResourceIds: string[];
}

export function seedRepoLifecycleState(): RepoLifecycleState {
  return {
    provisioning: seedProvisioningForm(),
    releases: [],
    checks: seedChecks(),
    currentVersion: seedCurrentVersion(),
    resources: seedScopedResources(),
    scopeSettings: { ...DEFAULT_SCOPE_SETTINGS },
    selectedResourceIds: [],
  };
}

function sanitizeProvisioning(raw: unknown): ProvisioningForm {
  if (!raw || typeof raw !== 'object') return seedProvisioningForm();
  const o = raw as Record<string, unknown>;
  const seed = seedProvisioningForm();
  return {
    model: typeof o.model === 'string' && o.model.trim() ? o.model : seed.model,
    autoImport: typeof o.autoImport === 'boolean' ? o.autoImport : seed.autoImport,
    agentName: typeof o.agentName === 'string' ? o.agentName : seed.agentName,
    agentLocation: typeof o.agentLocation === 'string' ? o.agentLocation : seed.agentLocation,
    bindOntologyId: typeof o.bindOntologyId === 'string' ? o.bindOntologyId : seed.bindOntologyId,
    agentApiName: typeof o.agentApiName === 'string' ? o.agentApiName : seed.agentApiName,
  };
}

function sanitizeReleases(raw: unknown): ReleaseRecord[] {
  if (!Array.isArray(raw)) return [];
  const out: ReleaseRecord[] = [];
  for (const item of raw as unknown[]) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    if (typeof o.version !== 'string' || !parseSemver(o.version)) continue;
    if (typeof o.at !== 'string') continue;
    const tgt = o.target && typeof o.target === 'object' ? (o.target as Record<string, unknown>) : null;
    if (!tgt || typeof tgt.ref !== 'string' || (tgt.kind !== 'branch' && tgt.kind !== 'commit')) continue;
    out.push({
      id: typeof o.id === 'string' && o.id ? o.id : nextId('rel'),
      version: o.version,
      bump: (['patch', 'minor', 'major', 'custom'] as string[]).includes(o.bump as string) ? (o.bump as BumpKind) : 'patch',
      target: {
        kind: tgt.kind as ReleaseTargetKind,
        ref: tgt.ref,
        ...(typeof tgt.branch === 'string' ? { branch: tgt.branch } : {}),
        ...(typeof tgt.commit === 'string' ? { commit: tgt.commit } : {}),
      },
      at: o.at,
      ...(typeof o.note === 'string' && o.note ? { note: o.note } : {}),
    });
  }
  return out;
}

function sanitizeChecks(raw: unknown): RepoCheck[] {
  if (!Array.isArray(raw)) return seedChecks();
  const statuses: CheckStatus[] = ['RUNNING', 'SUCCEEDED', 'FAILED', 'QUEUED', 'SKIPPED'];
  const out: RepoCheck[] = [];
  for (const item of raw as unknown[]) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    if (typeof o.id !== 'string' || typeof o.name !== 'string') continue;
    if (!statuses.includes(o.status as CheckStatus)) continue;
    out.push({
      id: o.id,
      name: o.name,
      status: o.status as CheckStatus,
      durationMs: typeof o.durationMs === 'number' && Number.isFinite(o.durationMs) ? Math.max(0, o.durationMs) : 0,
      ...(typeof o.branch === 'string' ? { branch: o.branch } : {}),
      ...(typeof o.pr === 'string' ? { pr: o.pr } : {}),
      ...(typeof o.detail === 'string' ? { detail: o.detail } : {}),
      ...(typeof o.at === 'string' ? { at: o.at } : {}),
    });
  }
  return out.length ? out : seedChecks();
}

function sanitizeResources(raw: unknown): ScopedResource[] {
  if (!Array.isArray(raw)) return seedScopedResources();
  const out: ScopedResource[] = [];
  for (const item of raw as unknown[]) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    if (typeof o.name !== 'string' || !o.name.trim()) continue;
    if (o.kind !== 'resource-file' && o.kind !== 'model') continue;
    if (o.source !== 'sdk' && o.source !== 'platform') continue;
    out.push({
      id: typeof o.id === 'string' && o.id ? o.id : nextId('res'),
      name: o.name,
      kind: o.kind as ResourceKind,
      source: o.source as ScopeSource,
      scope: o.scope === 'default' ? 'default' : 'custom',
      ...(typeof o.version === 'string' && o.version ? { version: o.version } : {}),
    });
  }
  return out.length ? out : seedScopedResources();
}

function sanitizeScopeSettings(raw: unknown): ScopeSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SCOPE_SETTINGS };
  const o = raw as Record<string, unknown>;
  return {
    scopedModeEnabled: typeof o.scopedModeEnabled === 'boolean' ? o.scopedModeEnabled : DEFAULT_SCOPE_SETTINGS.scopedModeEnabled,
    allowDefaultScope: typeof o.allowDefaultScope === 'boolean' ? o.allowDefaultScope : DEFAULT_SCOPE_SETTINGS.allowDefaultScope,
    resourcesJsonPath: typeof o.resourcesJsonPath === 'string' && o.resourcesJsonPath.trim()
      ? o.resourcesJsonPath
      : DEFAULT_SCOPE_SETTINGS.resourcesJsonPath,
  };
}

/** Read persisted lifecycle state from ws.meta (seed fallback, sanitized). */
export function readRepoLifecycleState(meta: unknown): RepoLifecycleState {
  const seed = seedRepoLifecycleState();
  if (!meta || typeof meta !== 'object') return seed;
  const record = meta as Record<string, unknown>;
  const repoRaw = record[REPO_META_KEY] && typeof record[REPO_META_KEY] === 'object'
    ? (record[REPO_META_KEY] as Record<string, unknown>)
    : null;
  const resRaw = record[RESOURCES_META_KEY] && typeof record[RESOURCES_META_KEY] === 'object'
    ? (record[RESOURCES_META_KEY] as Record<string, unknown>)
    : null;
  const currentVersion = repoRaw && parseSemver(typeof repoRaw.currentVersion === 'string' ? (repoRaw.currentVersion as string) : '')
    ? parseSemver(repoRaw.currentVersion as string)!
    : seed.currentVersion;
  const selectedRaw = resRaw?.selectedResourceIds;
  const selectedResourceIds = Array.isArray(selectedRaw)
    ? (selectedRaw as unknown[]).filter((s): s is string => typeof s === 'string')
    : [];
  return {
    provisioning: sanitizeProvisioning(repoRaw?.provisioning),
    releases: sanitizeReleases(repoRaw?.releases),
    checks: sanitizeChecks(repoRaw?.checks),
    currentVersion,
    resources: sanitizeResources(resRaw?.resources),
    scopeSettings: sanitizeScopeSettings(resRaw?.scopeSettings),
    selectedResourceIds,
  };
}

/** patchMeta payload for provisioning / releases / checks / current version. */
export function buildRepoMetaPatch(state: RepoLifecycleState): Record<string, unknown> {
  return {
    [REPO_META_KEY]: {
      provisioning: { ...state.provisioning },
      releases: state.releases.map((r) => ({ ...r, target: { ...r.target } })),
      checks: state.checks.map((c) => ({ ...c })),
      currentVersion: formatSemver(state.currentVersion),
    },
  };
}

/** patchMeta payload for scoped resources / settings / selection. */
export function buildResourcesMetaPatch(state: RepoLifecycleState): Record<string, unknown> {
  return {
    [RESOURCES_META_KEY]: {
      resources: state.resources.map((r) => ({ ...r })),
      scopeSettings: { ...state.scopeSettings },
      selectedResourceIds: [...state.selectedResourceIds],
    },
  };
}
