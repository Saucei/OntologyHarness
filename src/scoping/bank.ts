// Scoping funnel + guidance question bank — pure helpers (FN-SCP-001/002).
// No React, no DOM, no store imports: safe to unit-test in isolation.
// Reference: corpus-2 scoping tiles (value_for_users, wf_user_needs,
// wf_data_source, wf_data_asset, wf_model, wf_automations, full_workflow)
// and master-prompts/functions/FN-SCP-CANVAS.md.

/** ws.meta key for the persisted funnel + synthesis. */
export const SCOPING_META_KEY = 'scopingFunnel';

export type FunnelColumnId = 'scope' | 'questions' | 'findings';

export interface FunnelColumn {
  id: FunnelColumnId;
  label: string;
  hint: string;
}

/** 3-column funnel: Scope → Questions → Findings. */
export const FUNNEL_COLUMNS: readonly FunnelColumn[] = [
  {
    id: 'scope',
    label: 'Scope',
    hint: 'User Group → External System → Data Connector → Project → Dataset → Object Type',
  },
  {
    id: 'questions',
    label: 'Questions',
    hint: 'Guidance questions driving the funnel',
  },
  {
    id: 'findings',
    label: 'Findings',
    hint: 'Scenario/Model, Automate → Notifications/Machinery, delivery surfaces',
  },
] as const;

export const FUNNEL_COLUMN_IDS: readonly FunnelColumnId[] = ['scope', 'questions', 'findings'];

export type GuidanceCategory =
  | 'value-for-users'
  | 'user-needs'
  | 'data-asset'
  | 'deliverable';

/** Categories from FN-SCP-002: value-for-users bullets, user-needs,
 *  data-asset layering, verbatim deliverable questions. */
export const GUIDANCE_CATEGORIES: readonly GuidanceCategory[] = [
  'value-for-users',
  'user-needs',
  'data-asset',
  'deliverable',
];

export interface GuidanceQuestion {
  id: string;
  category: GuidanceCategory;
  question: string;
}

/** Verbatim guidance question bank (notes +.txt corpus). */
export const GUIDANCE_BANK: readonly GuidanceQuestion[] = [
  { id: 'gb-value-1', category: 'value-for-users', question: 'Who are the primary users and what value does this deliver for them?' },
  { id: 'gb-value-2', category: 'value-for-users', question: 'What is the measurable outcome for users in the first 30 days?' },
  { id: 'gb-value-3', category: 'value-for-users', question: 'How will users know this worked — which bullet points prove value?' },
  { id: 'gb-needs-1', category: 'user-needs', question: 'What user needs (jobs-to-be-done) does this use case serve?' },
  { id: 'gb-needs-2', category: 'user-needs', question: 'Which user groups are in scope and which are explicitly out of scope?' },
  { id: 'gb-needs-3', category: 'user-needs', question: 'What is the full user workflow from trigger to resolution?' },
  { id: 'gb-data-1', category: 'data-asset', question: 'Which external systems feed this use case and what is the data connector?' },
  { id: 'gb-data-2', category: 'data-asset', question: 'Which project, dataset and object type anchor this use case?' },
  { id: 'gb-data-3', category: 'data-asset', question: 'How are data assets layered — source, project, dataset, object type?' },
  { id: 'gb-data-4', category: 'data-asset', question: 'What Scenario/Model logic transforms the data into decisions?' },
  { id: 'gb-del-1', category: 'deliverable', question: 'What Automate → Notifications/Machinery actions ship in the MVP?' },
  { id: 'gb-del-2', category: 'deliverable', question: 'Which delivery surfaces (web, mobile, embed) ship first?' },
  { id: 'gb-del-3', category: 'deliverable', question: 'What is the verbatim deliverable for this milestone?' },
  { id: 'gb-del-4', category: 'deliverable', question: 'What acceptance criteria prove the deliverable is done?' },
];

export interface FunnelCard {
  id: string;
  column: FunnelColumnId;
  title: string;
  detail?: string;
  sourceQuestionId?: string;
}

export interface ScopingState {
  cards: FunnelCard[];
  synthesis: string;
}

export interface AddCardInput {
  column: FunnelColumnId;
  title: string;
  detail?: string;
  sourceQuestionId?: string;
}

let idSeq = 0;
function nextCardId(): string {
  idSeq += 1;
  return `card-${Date.now().toString(36)}-${idSeq}-${Math.random().toString(36).slice(2, 7)}`;
}

function isColumnId(v: unknown): v is FunnelColumnId {
  return v === 'scope' || v === 'questions' || v === 'findings';
}

/** Seed cards mirroring the corpus-2 funnel tiles. */
export function seedFunnelCards(): FunnelCard[] {
  return [
    { id: 'seed-scope-user', column: 'scope', title: 'User Group', detail: 'Primary personas for the use case' },
    { id: 'seed-scope-system', column: 'scope', title: 'External System', detail: 'Source system of record' },
    { id: 'seed-scope-connector', column: 'scope', title: 'Data Connector', detail: 'Ingest path into the project' },
    { id: 'seed-scope-project', column: 'scope', title: 'Project', detail: 'Foundry project boundary' },
    { id: 'seed-scope-dataset', column: 'scope', title: 'Dataset', detail: 'Canonical dataset backing the use case' },
    { id: 'seed-scope-object', column: 'scope', title: 'Object Type', detail: 'Ontology objects the workflow acts on' },
    { id: 'seed-q-value', column: 'questions', title: 'What value does this deliver for users?' },
    { id: 'seed-q-data', column: 'questions', title: 'How are data assets layered from source to object type?' },
    { id: 'seed-f-scenario', column: 'findings', title: 'Scenario/Model', detail: 'Decision logic over the object graph' },
    { id: 'seed-f-automate', column: 'findings', title: 'Automate → Notifications/Machinery', detail: 'Automated actions on triggers' },
    { id: 'seed-f-surface', column: 'findings', title: 'Delivery surface', detail: 'Where users act on findings' },
  ];
}

/** Cards in a single column, in stored order. */
export function cardsInColumn(cards: readonly FunnelCard[], column: FunnelColumnId): FunnelCard[] {
  return cards.filter((c) => c.column === column);
}

export function countsByColumn(
  cards: readonly FunnelCard[],
): Record<FunnelColumnId, number> {
  const counts: Record<FunnelColumnId, number> = { scope: 0, questions: 0, findings: 0 };
  for (const c of cards) {
    if (isColumnId(c.column)) counts[c.column] += 1;
  }
  return counts;
}

/** Append a card to a column. Empty/blank titles are ignored. */
export function addCard(cards: readonly FunnelCard[], input: AddCardInput): FunnelCard[] {
  const title = input.title.trim();
  if (!title || !isColumnId(input.column)) return [...cards];
  const card: FunnelCard = {
    id: nextCardId(),
    column: input.column,
    title,
    ...(input.detail?.trim() ? { detail: input.detail.trim() } : {}),
    ...(input.sourceQuestionId ? { sourceQuestionId: input.sourceQuestionId } : {}),
  };
  return [...cards, card];
}

export function removeCard(cards: readonly FunnelCard[], id: string): FunnelCard[] {
  return cards.filter((c) => c.id !== id);
}

/** Move a card to a target column. No-op (same content) when id is unknown. */
export function moveCard(
  cards: readonly FunnelCard[],
  id: string,
  target: FunnelColumnId,
): FunnelCard[] {
  if (!isColumnId(target)) return [...cards];
  return cards.map((c) => (c.id === id ? { ...c, column: target } : c));
}

/** Move a card one column left/right along the funnel. Clamps at the ends. */
export function moveCardBy(
  cards: readonly FunnelCard[],
  id: string,
  direction: -1 | 1,
): FunnelCard[] {
  const card = cards.find((c) => c.id === id);
  if (!card) return [...cards];
  const idx = FUNNEL_COLUMN_IDS.indexOf(card.column);
  const nextIdx = Math.min(FUNNEL_COLUMN_IDS.length - 1, Math.max(0, idx + direction));
  if (nextIdx === idx) return [...cards];
  return moveCard(cards, id, FUNNEL_COLUMN_IDS[nextIdx]);
}

export function questionToCard(q: GuidanceQuestion): FunnelCard {
  return {
    id: nextCardId(),
    column: 'questions',
    title: q.question,
    detail: q.category,
    sourceQuestionId: q.id,
  };
}

/** Append a bank question to the Questions column. */
export function addQuestionToFunnel(
  cards: readonly FunnelCard[],
  q: GuidanceQuestion,
): FunnelCard[] {
  return [...cards, questionToCard(q)];
}

/** Filter the bank by category ('all' = no filter). */
export function filterBankByCategory(
  bank: readonly GuidanceQuestion[],
  category: GuidanceCategory | 'all',
): GuidanceQuestion[] {
  if (category === 'all') return [...bank];
  return bank.filter((q) => q.category === category);
}

/** Case-insensitive substring search over question text + category. */
export function searchBank(
  bank: readonly GuidanceQuestion[],
  query: string,
): GuidanceQuestion[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...bank];
  return bank.filter(
    (q) =>
      q.question.toLowerCase().includes(needle) ||
      q.category.toLowerCase().includes(needle),
  );
}

export interface BankQuery {
  category?: GuidanceCategory | 'all';
  query?: string;
}

export function queryBank(
  bank: readonly GuidanceQuestion[],
  { category = 'all', query = '' }: BankQuery = {},
): GuidanceQuestion[] {
  return searchBank(filterBankByCategory(bank, category), query);
}

/** Read persisted funnel + synthesis from ws.meta (seed fallback). */
export function readScopingState(meta: unknown): ScopingState {
  if (meta && typeof meta === 'object') {
    const raw = (meta as Record<string, unknown>)[SCOPING_META_KEY];
    if (raw && typeof raw === 'object') {
      const obj = raw as Record<string, unknown>;
      const rawCards = Array.isArray(obj.cards) ? obj.cards : null;
      if (rawCards) {
        const cards: FunnelCard[] = [];
        for (const r of rawCards) {
          if (!r || typeof r !== 'object') continue;
          const o = r as Record<string, unknown>;
          if (typeof o.id !== 'string' || typeof o.title !== 'string' || !isColumnId(o.column)) continue;
          const card: FunnelCard = { id: o.id, column: o.column, title: o.title };
          if (typeof o.detail === 'string' && o.detail) card.detail = o.detail;
          if (typeof o.sourceQuestionId === 'string' && o.sourceQuestionId) {
            card.sourceQuestionId = o.sourceQuestionId;
          }
          cards.push(card);
        }
        const synthesis = typeof obj.synthesis === 'string' ? obj.synthesis : '';
        return { cards, synthesis };
      }
    }
  }
  return { cards: seedFunnelCards(), synthesis: '' };
}

/** Build the patchMeta payload for funnel + synthesis. */
export function buildScopingMetaPatch(
  cards: readonly FunnelCard[],
  synthesis: string,
): Record<string, unknown> {
  return {
    [SCOPING_META_KEY]: {
      cards: [...cards],
      synthesis,
      updatedAt: new Date().toISOString(),
    },
  };
}

/* ── FN-SCP-003: permissions matrix (rows=capability cards, cols=roles) ──
 * Persisted under ws.meta[SCOPING_MATRIX_META_KEY]. Pure helpers only. */

/** ws.meta key for the permissions matrix (FN-SCP-003). */
export const SCOPING_MATRIX_META_KEY = 'scopingMatrix';

export type ScopingDecision = 'allow' | 'ask' | 'deny';

export type ScopingRoleId = 'owner' | 'operator' | 'viewer' | 'auditor';

export interface ScopingRole {
  id: ScopingRoleId;
  label: string;
  hint: string;
}

/** Matrix columns: roles. */
export const SCOPING_ROLES: readonly ScopingRole[] = [
  { id: 'owner', label: 'Owner', hint: 'Full control' },
  { id: 'operator', label: 'Operator', hint: 'Runs scenarios + automations' },
  { id: 'viewer', label: 'Viewer', hint: 'Read-only' },
  { id: 'auditor', label: 'Auditor', hint: 'Read + attest' },
] as const;

export const SCOPING_ROLE_IDS: readonly ScopingRoleId[] = [
  'owner',
  'operator',
  'viewer',
  'auditor',
] as const;

export const SCOPING_DECISIONS: readonly ScopingDecision[] = ['allow', 'ask', 'deny'] as const;

export interface ScopingCapability {
  id: string;
  label: string;
  hint: string;
}

/** Matrix rows: capability cards mirroring the funnel tiles. */
export const SCOPING_CAPABILITIES: readonly ScopingCapability[] = [
  { id: 'cap-scope-view', label: 'View scope (User Group → Object Type)', hint: 'Read the funnel' },
  { id: 'cap-scope-edit', label: 'Edit scope cards', hint: 'Add / move scope cards' },
  { id: 'cap-scenario-run', label: 'Run Scenario/Model', hint: 'Evaluate decision logic' },
  { id: 'cap-automate-run', label: 'Run Automate → Notifications/Machinery', hint: 'Trigger automated actions' },
  { id: 'cap-delivery-publish', label: 'Publish delivery surface', hint: 'Ship web / mobile / embed' },
  { id: 'cap-permissions', label: 'Manage permissions matrix', hint: 'Edit allow / ask / deny' },
] as const;

/** capabilityId → roleId → decision. Missing cells fall back to 'deny'. */
export type ScopingMatrix = Record<string, Record<ScopingRoleId, ScopingDecision>>;

function isScopingRoleId(v: unknown): v is ScopingRoleId {
  return v === 'owner' || v === 'operator' || v === 'viewer' || v === 'auditor';
}

function isScopingDecision(v: unknown): v is ScopingDecision {
  return v === 'allow' || v === 'ask' || v === 'deny';
}

function isCapabilityId(v: unknown): v is string {
  return typeof v === 'string' && SCOPING_CAPABILITIES.some((c) => c.id === v);
}

/** Sensible defaults: owner all-allow, operator runs the loop, viewer reads. */
export function defaultScopingMatrix(): ScopingMatrix {
  const matrix: ScopingMatrix = {};
  for (const cap of SCOPING_CAPABILITIES) {
    matrix[cap.id] = { owner: 'allow', operator: 'deny', viewer: 'deny', auditor: 'deny' };
  }
  matrix['cap-scope-view'] = { owner: 'allow', operator: 'allow', viewer: 'allow', auditor: 'allow' };
  matrix['cap-scope-edit'] = { owner: 'allow', operator: 'ask', viewer: 'deny', auditor: 'deny' };
  matrix['cap-scenario-run'] = { owner: 'allow', operator: 'allow', viewer: 'deny', auditor: 'ask' };
  matrix['cap-automate-run'] = { owner: 'allow', operator: 'ask', viewer: 'deny', auditor: 'ask' };
  matrix['cap-delivery-publish'] = { owner: 'allow', operator: 'deny', viewer: 'deny', auditor: 'deny' };
  matrix['cap-permissions'] = { owner: 'allow', operator: 'deny', viewer: 'deny', auditor: 'ask' };
  return matrix;
}

/** Read a single cell; unknown ids default to 'deny'. */
export function getMatrixCell(
  matrix: ScopingMatrix,
  capabilityId: string,
  role: ScopingRoleId,
): ScopingDecision {
  if (!isCapabilityId(capabilityId) || !isScopingRoleId(role)) return 'deny';
  return matrix[capabilityId]?.[role] ?? 'deny';
}

/** Immutably set one cell; unknown capability/role/decision is a no-op. */
export function setMatrixCell(
  matrix: ScopingMatrix,
  capabilityId: string,
  role: ScopingRoleId,
  decision: ScopingDecision,
): ScopingMatrix {
  if (!isCapabilityId(capabilityId) || !isScopingRoleId(role) || !isScopingDecision(decision)) {
    return matrix;
  }
  const next: ScopingMatrix = { ...matrix };
  next[capabilityId] = { ...(next[capabilityId] ?? defaultScopingMatrix()[capabilityId]), [role]: decision };
  return next;
}

/** Count decisions across every capability × role cell. */
export function matrixCounts(
  matrix: ScopingMatrix,
): Record<ScopingDecision, number> {
  const counts: Record<ScopingDecision, number> = { allow: 0, ask: 0, deny: 0 };
  for (const cap of SCOPING_CAPABILITIES) {
    for (const role of SCOPING_ROLE_IDS) {
      counts[getMatrixCell(matrix, cap.id, role)] += 1;
    }
  }
  return counts;
}

/** Read persisted matrix from ws.meta (defaults merged over sanitised rows). */
export function readScopingMatrix(meta: unknown): ScopingMatrix {
  const defaults = defaultScopingMatrix();
  if (!meta || typeof meta !== 'object') return defaults;
  const raw = (meta as Record<string, unknown>)[SCOPING_MATRIX_META_KEY];
  if (!raw || typeof raw !== 'object') return defaults;
  const rows = (raw as Record<string, unknown>).matrix ?? raw;
  if (!rows || typeof rows !== 'object' || Array.isArray(rows)) return defaults;
  const out: ScopingMatrix = {};
  for (const cap of SCOPING_CAPABILITIES) {
    out[cap.id] = { ...defaults[cap.id] };
    const row = (rows as Record<string, unknown>)[cap.id];
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    for (const role of SCOPING_ROLE_IDS) {
      const v = (row as Record<string, unknown>)[role];
      if (isScopingDecision(v)) out[cap.id][role] = v;
    }
  }
  return out;
}

/** Build the patchMeta payload for the matrix. */
export function buildScopingMatrixPatch(matrix: ScopingMatrix): Record<string, unknown> {
  const clean: ScopingMatrix = {};
  for (const cap of SCOPING_CAPABILITIES) {
    clean[cap.id] = { ...matrix[cap.id] };
  }
  return {
    [SCOPING_MATRIX_META_KEY]: {
      matrix: clean,
      updatedAt: new Date().toISOString(),
    },
  };
}

/* ── FN-SCP-004: MVP / steering / beta checklist ──
 * Persisted under ws.meta[SCOPING_CHECKLIST_META_KEY]. Pure helpers only. */

/** ws.meta key for the checklist (FN-SCP-004). */
export const SCOPING_CHECKLIST_META_KEY = 'scopingChecklist';

export type ChecklistPhaseId = 'mvp' | 'steering' | 'beta';

export interface ChecklistPhase {
  id: ChecklistPhaseId;
  label: string;
  hint: string;
}

/** Checklist phases: MVP → Steering → Beta. */
export const CHECKLIST_PHASES: readonly ChecklistPhase[] = [
  { id: 'mvp', label: 'MVP', hint: 'Smallest shippable loop' },
  { id: 'steering', label: 'Steering', hint: 'Review + sign-off gates' },
  { id: 'beta', label: 'Beta', hint: 'Cohort rollout + hardening' },
] as const;

export const CHECKLIST_PHASE_IDS: readonly ChecklistPhaseId[] = ['mvp', 'steering', 'beta'] as const;

export interface ChecklistItem {
  id: string;
  label: string;
  phase: ChecklistPhaseId;
  assignee: string;
  done: boolean;
}

function isChecklistPhaseId(v: unknown): v is ChecklistPhaseId {
  return v === 'mvp' || v === 'steering' || v === 'beta';
}

/** Seed items: 3 per phase mirroring the funnel + matrix gates. */
export function seedChecklistItems(): ChecklistItem[] {
  return [
    { id: 'chk-mvp-scope', label: 'Scope locked: User Group → Object Type pinned', phase: 'mvp', assignee: 'owner', done: false },
    { id: 'chk-mvp-scenario', label: 'Scenario/Model MVP logic runs end-to-end', phase: 'mvp', assignee: 'operator', done: false },
    { id: 'chk-mvp-automate', label: 'Automate MVP action delivers one notification', phase: 'mvp', assignee: 'operator', done: false },
    { id: 'chk-steer-value', label: 'Steering review: value-for-users proof points', phase: 'steering', assignee: 'owner', done: false },
    { id: 'chk-steer-data', label: 'Data asset layering signed off (source → dataset → object)', phase: 'steering', assignee: 'operator', done: false },
    { id: 'chk-steer-perms', label: 'Permissions matrix approved for beta roles', phase: 'steering', assignee: 'owner', done: false },
    { id: 'chk-beta-cohort', label: 'Beta cohort onboarded to delivery surface', phase: 'beta', assignee: 'operator', done: false },
    { id: 'chk-beta-observability', label: 'Observability: audit trail + traces verified', phase: 'beta', assignee: 'auditor', done: false },
    { id: 'chk-beta-rollback', label: 'Rollout memo: rollback path rehearsed', phase: 'beta', assignee: 'owner', done: false },
  ];
}

/** Immutable toggle of one item's done flag; unknown id is a no-op. */
export function toggleChecklistItem(items: readonly ChecklistItem[], id: string): ChecklistItem[] {
  return items.map((it) => (it.id === id ? { ...it, done: !it.done } : it));
}

/** Immutable set of one item's done flag; unknown id is a no-op. */
export function setChecklistDone(items: readonly ChecklistItem[], id: string, done: boolean): ChecklistItem[] {
  return items.map((it) => (it.id === id ? { ...it, done } : it));
}

/** Immutable assignee change; trims whitespace, unknown id is a no-op. */
export function setChecklistAssignee(
  items: readonly ChecklistItem[],
  id: string,
  assignee: string,
): ChecklistItem[] {
  const next = assignee.trim();
  return items.map((it) => (it.id === id ? { ...it, assignee: next } : it));
}

/** Items in one phase, in stored order. */
export function checklistInPhase(items: readonly ChecklistItem[], phase: ChecklistPhaseId): ChecklistItem[] {
  return items.filter((it) => it.phase === phase);
}

/** Overall + per-phase done/total counts. */
export function checklistCounts(
  items: readonly ChecklistItem[],
): { done: number; total: number; byPhase: Record<ChecklistPhaseId, { done: number; total: number }> } {
  const byPhase: Record<ChecklistPhaseId, { done: number; total: number }> = {
    mvp: { done: 0, total: 0 },
    steering: { done: 0, total: 0 },
    beta: { done: 0, total: 0 },
  };
  let done = 0;
  for (const it of items) {
    if (!isChecklistPhaseId(it.phase)) continue;
    byPhase[it.phase].total += 1;
    if (it.done) byPhase[it.phase].done += 1;
    if (it.done) done += 1;
  }
  return { done, total: items.length, byPhase };
}

/** Read persisted checklist from ws.meta (seed fallback; malformed rows dropped). */
export function readChecklist(meta: unknown): ChecklistItem[] {
  if (meta && typeof meta === 'object') {
    const raw = (meta as Record<string, unknown>)[SCOPING_CHECKLIST_META_KEY];
    if (raw && typeof raw === 'object') {
      const obj = raw as Record<string, unknown>;
      const rawItems = Array.isArray(obj.items) ? obj.items : null;
      if (rawItems) {
        const items: ChecklistItem[] = [];
        for (const r of rawItems) {
          if (!r || typeof r !== 'object') continue;
          const o = r as Record<string, unknown>;
          if (typeof o.id !== 'string' || typeof o.label !== 'string' || !isChecklistPhaseId(o.phase)) continue;
          items.push({
            id: o.id,
            label: o.label,
            phase: o.phase,
            assignee: typeof o.assignee === 'string' ? o.assignee : '',
            done: o.done === true,
          });
        }
        return items;
      }
    }
  }
  return seedChecklistItems();
}

/** Build the patchMeta payload for the checklist. */
export function buildChecklistPatch(items: readonly ChecklistItem[]): Record<string, unknown> {
  return {
    [SCOPING_CHECKLIST_META_KEY]: {
      items: [...items],
      updatedAt: new Date().toISOString(),
    },
  };
}
