// FN-SCP-001–004 — pure bank helpers (no React, no store).
import { describe, it, expect } from 'vitest';
import {
  CHECKLIST_PHASES,
  FUNNEL_COLUMNS,
  FUNNEL_COLUMN_IDS,
  GUIDANCE_BANK,
  GUIDANCE_CATEGORIES,
  SCOPING_CAPABILITIES,
  SCOPING_CHECKLIST_META_KEY,
  SCOPING_DECISIONS,
  SCOPING_MATRIX_META_KEY,
  SCOPING_META_KEY,
  SCOPING_ROLES,
  addCard,
  addQuestionToFunnel,
  buildChecklistPatch,
  buildScopingMatrixPatch,
  buildScopingMetaPatch,
  cardsInColumn,
  checklistCounts,
  checklistInPhase,
  countsByColumn,
  defaultScopingMatrix,
  filterBankByCategory,
  getMatrixCell,
  matrixCounts,
  moveCard,
  moveCardBy,
  queryBank,
  readChecklist,
  readScopingMatrix,
  readScopingState,
  removeCard,
  searchBank,
  seedChecklistItems,
  seedFunnelCards,
  setChecklistAssignee,
  setMatrixCell,
  toggleChecklistItem,
} from './bank';

describe('scoping bank helpers', () => {
  it('exposes a 3-column funnel and a categorised guidance bank', () => {
    expect(FUNNEL_COLUMNS.map((c) => c.id)).toEqual(['scope', 'questions', 'findings']);
    expect([...FUNNEL_COLUMN_IDS]).toEqual(['scope', 'questions', 'findings']);
    expect(GUIDANCE_CATEGORIES).toEqual(['value-for-users', 'user-needs', 'data-asset', 'deliverable']);
    expect(GUIDANCE_BANK.length).toBeGreaterThanOrEqual(10);
    for (const q of GUIDANCE_BANK) {
      expect(GUIDANCE_CATEGORIES).toContain(q.category);
      expect(q.question.trim().length).toBeGreaterThan(0);
    }
  });

  it('seed funnel mirrors the corpus-2 card graph across all three columns', () => {
    const seed = seedFunnelCards();
    const counts = countsByColumn(seed);
    expect(counts.scope).toBeGreaterThanOrEqual(4);
    expect(counts.questions).toBeGreaterThanOrEqual(1);
    expect(counts.findings).toBeGreaterThanOrEqual(2);
    expect(cardsInColumn(seed, 'scope').map((c) => c.title)).toContain('User Group');
    expect(cardsInColumn(seed, 'scope').map((c) => c.title)).toContain('Dataset');
    expect(cardsInColumn(seed, 'findings').map((c) => c.title)).toContain('Scenario/Model');
    // seed returns fresh copies, not shared state
    seed[0].title = 'MUTATED';
    expect(seedFunnelCards()[0].title).not.toBe('MUTATED');
  });

  it('add/remove/move cards without mutating the input array', () => {
    const seed = seedFunnelCards();
    const added = addCard(seed, { column: 'scope', title: '  Beta users  ' });
    expect(added).toHaveLength(seed.length + 1);
    expect(seed).toHaveLength(seed.length);
    const last = added[added.length - 1];
    expect(last.title).toBe('Beta users');
    expect(last.column).toBe('scope');

    // blank titles are a no-op
    expect(addCard(seed, { column: 'scope', title: '   ' })).toHaveLength(seed.length);

    const removed = removeCard(added, last.id);
    expect(removed).toHaveLength(seed.length);
    expect(removed.some((c) => c.id === last.id)).toBe(false);

    const moved = moveCard(added, last.id, 'findings');
    expect(moved.find((c) => c.id === last.id)?.column).toBe('findings');
    expect(added.find((c) => c.id === last.id)?.column).toBe('scope');

    const stepped = moveCardBy(added, last.id, 1);
    expect(stepped.find((c) => c.id === last.id)?.column).toBe('questions');
    // clamps at the right edge
    const atEnd = moveCardBy(moved, last.id, 1);
    expect(atEnd.find((c) => c.id === last.id)?.column).toBe('findings');
    // stepped-left comes back
    expect(moveCardBy(stepped, last.id, -1).find((c) => c.id === last.id)?.column).toBe('scope');
  });

  it('filters + searches the bank by category and text', () => {
    const byCat = filterBankByCategory(GUIDANCE_BANK, 'data-asset');
    expect(byCat.length).toBeGreaterThanOrEqual(1);
    expect(byCat.every((q) => q.category === 'data-asset')).toBe(true);
    expect(filterBankByCategory(GUIDANCE_BANK, 'all')).toHaveLength(GUIDANCE_BANK.length);

    expect(searchBank(GUIDANCE_BANK, 'BETa')).toHaveLength(0);
    const hit = searchBank(GUIDANCE_BANK, 'users');
    expect(hit.length).toBeGreaterThanOrEqual(1);
    expect(searchBank(GUIDANCE_BANK, '')).toHaveLength(GUIDANCE_BANK.length);

    expect(queryBank(GUIDANCE_BANK, { category: 'deliverable', query: 'mvp' })).toHaveLength(1);
    expect(queryBank(GUIDANCE_BANK)).toHaveLength(GUIDANCE_BANK.length);
  });

  it('adds a bank question to the Questions column with provenance', () => {
    const seed = seedFunnelCards();
    const q = GUIDANCE_BANK[0];
    const next = addQuestionToFunnel(seed, q);
    expect(next).toHaveLength(seed.length + 1);
    const card = next[next.length - 1];
    expect(card.column).toBe('questions');
    expect(card.title).toBe(q.question);
    expect(card.sourceQuestionId).toBe(q.id);
  });

  it('reads persisted state via ws.meta with seed fallback and round-trips the patch', () => {
    expect(readScopingState({}).cards.length).toBeGreaterThan(0);
    expect(readScopingState(null).synthesis).toBe('');
    expect(readScopingState({ [SCOPING_META_KEY]: 'garbage' }).cards.length).toBeGreaterThan(0);

    const cards = seedFunnelCards();
    const meta = { ...buildScopingMetaPatch(cards, 'round-trip synthesis') };
    const back = readScopingState(meta);
    expect(back.cards).toEqual(cards);
    expect(back.synthesis).toBe('round-trip synthesis');
    // malformed rows are dropped, valid rows survive
    const mixed = readScopingState({
      [SCOPING_META_KEY]: { cards: [{ id: 'x', column: 'scope', title: 'ok' }, { id: 'y' }], synthesis: 's' },
    });
    expect(mixed.cards).toHaveLength(1);
    expect(mixed.cards[0].title).toBe('ok');
  });

  it('defaults the permissions matrix with allow/ask/deny across roles × capabilities', () => {
    expect(SCOPING_ROLES.map((r) => r.id)).toEqual(['owner', 'operator', 'viewer', 'auditor']);
    expect(SCOPING_DECISIONS).toEqual(['allow', 'ask', 'deny']);
    expect(SCOPING_CAPABILITIES.length).toBeGreaterThanOrEqual(4);
    const m = defaultScopingMatrix();
    // Owner can do everything; viewers can only view scope.
    for (const cap of SCOPING_CAPABILITIES) {
      expect(m[cap.id].owner).toBe('allow');
      expect(SCOPING_DECISIONS).toContain(m[cap.id].operator);
      expect(SCOPING_DECISIONS).toContain(m[cap.id].viewer);
      expect(SCOPING_DECISIONS).toContain(m[cap.id].auditor);
    }
    expect(m['cap-scope-view'].viewer).toBe('allow');
    expect(m['cap-scope-edit'].viewer).toBe('deny');
    const counts = matrixCounts(m);
    expect(counts.allow + counts.ask + counts.deny).toBe(SCOPING_CAPABILITIES.length * SCOPING_ROLES.length);
  });

  it('sets matrix cells immutably and round-trips via ws.meta.scopingMatrix', () => {
    const m = defaultScopingMatrix();
    const next = setMatrixCell(m, 'cap-automate-run', 'viewer', 'allow');
    expect(next['cap-automate-run'].viewer).toBe('allow');
    expect(m['cap-automate-run'].viewer).toBe('deny'); // input untouched
    expect(getMatrixCell(next, 'cap-automate-run', 'viewer')).toBe('allow');
    expect(getMatrixCell(next, 'nope', 'viewer')).toBe('deny');
    // invalid edits are no-ops
    expect(setMatrixCell(m, 'nope', 'viewer', 'allow')).toBe(m);

    const meta = { ...buildScopingMatrixPatch(next) };
    expect(meta[SCOPING_MATRIX_META_KEY]).toBeTruthy();
    const back = readScopingMatrix(meta);
    expect(back).toEqual(next);
    // garbage meta falls back to defaults; invalid persisted decisions are sanitised
    expect(readScopingMatrix({})).toEqual(defaultScopingMatrix());
    expect(readScopingMatrix({ [SCOPING_MATRIX_META_KEY]: 'garbage' })['cap-scope-view'].owner).toBe('allow');
    const dirty = readScopingMatrix({
      [SCOPING_MATRIX_META_KEY]: { matrix: { 'cap-scope-view': { owner: 'bogus', viewer: 'allow' }, unknown: {} } },
    });
    expect(dirty['cap-scope-view'].owner).toBe('allow'); // bogus dropped → default
    expect(dirty['cap-scope-view'].viewer).toBe('allow'); // valid survives
  });

  it('seeds, toggles and reassigns the MVP/steering/beta checklist immutably', () => {
    expect(CHECKLIST_PHASES.map((p) => p.id)).toEqual(['mvp', 'steering', 'beta']);
    const seed = seedChecklistItems();
    expect(seed.length).toBeGreaterThanOrEqual(6);
    for (const phase of ['mvp', 'steering', 'beta'] as const) {
      expect(checklistInPhase(seed, phase).length).toBeGreaterThanOrEqual(1);
    }
    const first = seed[0];
    const toggled = toggleChecklistItem(seed, first.id);
    expect(toggled.find((i) => i.id === first.id)?.done).toBe(!first.done);
    expect(seed.find((i) => i.id === first.id)?.done).toBe(first.done);
    const reassigned = setChecklistAssignee(seed, first.id, '  operator  ');
    expect(reassigned.find((i) => i.id === first.id)?.assignee).toBe('operator');
    const counts = checklistCounts(toggled);
    expect(counts.total).toBe(seed.length);
    expect(counts.done).toBe(seed.filter((i) => i.done).length + 1);
  });

  it('round-trips the checklist via ws.meta with seed fallback', () => {
    expect(readChecklist({}).length).toBeGreaterThan(0);
    expect(readChecklist(null).length).toBeGreaterThan(0);
    const seed = seedChecklistItems();
    const next = toggleChecklistItem(seed, seed[0].id);
    const meta = { ...buildChecklistPatch(next) };
    expect(meta[SCOPING_CHECKLIST_META_KEY]).toBeTruthy();
    expect(readChecklist(meta)).toEqual(next);
    const dirty = readChecklist({
      [SCOPING_CHECKLIST_META_KEY]: { items: [{ id: 'ok', label: 'kept', phase: 'mvp', assignee: 'owner', done: true }, { id: 'bad' }] },
    });
    expect(dirty).toHaveLength(1);
    expect(dirty[0]).toEqual({ id: 'ok', label: 'kept', phase: 'mvp', assignee: 'owner', done: true });
  });
});
