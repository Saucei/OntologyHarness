// FN-SCP-001–004 ScopingModule — funnel canvas + bank + synthesis + matrix + checklist.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import ScopingModule from './ScopingModule';
import {
  GUIDANCE_BANK,
  SCOPING_CAPABILITIES,
  SCOPING_CHECKLIST_META_KEY,
  SCOPING_MATRIX_META_KEY,
  SCOPING_META_KEY,
  SCOPING_ROLES,
  seedChecklistItems,
} from '../scoping/bank';
import { ws } from '../store';

const readAudit = (): any[] => {
  try {
    return JSON.parse(localStorage.getItem('ontology-harness.audit') ?? '[]');
  } catch {
    return [];
  }
};

beforeEach(() => {
  localStorage.clear();
  ws.meta = {};
  ws.traces.length = 0;
});
afterEach(() => cleanup());

describe('ScopingModule (FN-SCP-001 funnel canvas)', () => {
  it('renders the 3-column funnel with seeded Scope → Questions → Findings cards', () => {
    render(<ScopingModule />);
    expect(screen.getByTestId('scoping-module')).toBeTruthy();
    for (const col of ['scope', 'questions', 'findings'] as const) {
      expect(screen.getByTestId(`scoping-column-${col}`)).toBeTruthy();
      expect(screen.getByTestId(`scoping-input-${col}`)).toBeTruthy();
      expect(screen.getByTestId(`scoping-add-${col}`)).toBeTruthy();
    }
    expect(screen.getByText('Scope · 6', { exact: false })).toBeTruthy();
    expect(screen.getByText('Questions · 2', { exact: false })).toBeTruthy();
    expect(screen.getByText('Findings · 3', { exact: false })).toBeTruthy();
    expect(screen.getByTestId('scoping-card-seed-scope-user')).toBeTruthy();
    expect(screen.getByTestId('scoping-card-seed-f-scenario')).toBeTruthy();
  });

  it('adds, moves and removes cards via buttons and records trace + audit', () => {
    render(<ScopingModule />);

    fireEvent.change(screen.getByTestId('scoping-input-findings'), { target: { value: 'Beta users' } });
    fireEvent.click(screen.getByTestId('scoping-add-findings'));
    const added = screen.getByText('Beta users');
    expect(added).toBeTruthy();
    const card = added.closest('[data-testid^="scoping-card-"]') as HTMLElement;
    const cardId = card?.getAttribute('data-testid')?.replace('scoping-card-', '') ?? '';
    expect(cardId.length).toBeGreaterThan(0);

    fireEvent.click(screen.getByTestId(`scoping-move-left-${cardId}`));
    expect(screen.getByTestId('scoping-column-questions').contains(screen.getByText('Beta users'))).toBe(true);

    fireEvent.click(screen.getByTestId(`scoping-remove-${cardId}`));
    expect(screen.queryByText('Beta users')).toBeFalsy();

    expect(ws.traces.some((t) => t.tool === 'scoping.card.add' && t.ok)).toBe(true);
    expect(ws.traces.some((t) => t.tool === 'scoping.card.move' && t.ok)).toBe(true);
    expect(ws.traces.some((t) => t.tool === 'scoping.card.remove' && t.ok)).toBe(true);
    const audit = readAudit();
    expect(audit.some((a) => a.event === 'scoping' && a.tool === 'scoping.card.add')).toBe(true);

    const persisted = (ws.meta?.[SCOPING_META_KEY] ?? {}) as any;
    expect(Array.isArray(persisted.cards)).toBe(true);
    expect(persisted.cards.some((c: any) => c.title === 'Beta users')).toBe(false);
  });
});

describe('ScopingModule (FN-SCP-002 guidance bank + synthesis)', () => {
  it('bank lists questions with category + Add; Add appends to Questions', () => {
    render(<ScopingModule />);
    expect(screen.getByTestId('scoping-bank')).toBeTruthy();
    for (const q of GUIDANCE_BANK) {
      const row = screen.getByTestId(`scoping-bank-question-${q.id}`);
      expect(row.textContent).toContain(q.category);
      expect(row.textContent).toContain(q.question);
      expect(screen.getByTestId(`scoping-bank-add-${q.id}`)).toBeTruthy();
    }

    const first = GUIDANCE_BANK[0];
    fireEvent.click(screen.getByTestId(`scoping-bank-add-${first.id}`));
    const col = screen.getByTestId('scoping-column-questions');
    expect(col.textContent).toContain(first.question);
    const found = [...col.querySelectorAll('[data-column="questions"]')].find((el) =>
      el.textContent?.includes(first.question),
    );
    expect(found?.textContent).toContain(first.id);
    expect(ws.traces.some((t) => t.tool === 'scoping.bank.add' && t.ok)).toBe(true);
  });

  it('bank category filter + search narrow the list', () => {
    render(<ScopingModule />);
    fireEvent.change(screen.getByTestId('scoping-bank-category'), { target: { value: 'data-asset' } });
    const visible = screen.getAllByTestId(/^scoping-bank-question-/);
    expect(visible.length).toBe(GUIDANCE_BANK.filter((q) => q.category === 'data-asset').length);
    expect(visible.every((el) => el.textContent?.includes('data-asset'))).toBe(true);

    fireEvent.change(screen.getByTestId('scoping-bank-category'), { target: { value: 'all' } });
    fireEvent.change(screen.getByTestId('scoping-bank-search'), { target: { value: 'measurable outcome' } });
    expect(screen.getAllByTestId(/^scoping-bank-question-/)).toHaveLength(1);
    expect(screen.getByTestId('scoping-bank-question-gb-value-2')).toBeTruthy();
  });

  it('synthesis write-up persists via patchMeta/ws.meta with trace + audit', () => {
    render(<ScopingModule />);
    fireEvent.change(screen.getByTestId('scoping-synthesis-input'), {
      target: { value: 'MVP: triage → Scenario/Model → Automate.' },
    });
    fireEvent.click(screen.getByTestId('scoping-synthesis-save'));
    const persisted = (ws.meta?.[SCOPING_META_KEY] ?? {}) as any;
    expect(persisted.synthesis).toBe('MVP: triage → Scenario/Model → Automate.');
    expect(typeof persisted.updatedAt).toBe('string');
    expect(ws.traces.some((t) => t.tool === 'scoping.synthesis.save' && t.ok)).toBe(true);
    expect(readAudit().some((a) => a.event === 'scoping' && a.tool === 'scoping.synthesis.save')).toBe(true);
  });

  it('rehydrates cards + synthesis from ws.meta on mount', () => {
    ws.meta = {
      [SCOPING_META_KEY]: {
        cards: [{ id: 'persisted-1', column: 'scope', title: 'Persisted scope', detail: 'from meta' }],
        synthesis: 'persisted synthesis',
        updatedAt: new Date().toISOString(),
      },
    };
    render(<ScopingModule />);
    expect(screen.getByTestId('scoping-card-persisted-1')).toBeTruthy();
    expect((screen.getByTestId('scoping-synthesis-input') as HTMLTextAreaElement).value).toBe(
      'persisted synthesis',
    );
  });
});

describe('ScopingModule (FN-SCP-003 permissions matrix)', () => {
  it('renders a capability × role grid with allow/ask/deny cells', () => {
    render(<ScopingModule />);
    expect(screen.getByTestId('scoping-matrix')).toBeTruthy();
    for (const cap of SCOPING_CAPABILITIES) {
      for (const role of SCOPING_ROLES) {
        const cell = screen.getByTestId(`scoping-matrix-cell-${cap.id}-${role.id}`) as HTMLSelectElement;
        expect(cell.tagName).toBe('SELECT');
        expect(['allow', 'ask', 'deny']).toContain(cell.value);
      }
    }
    // Owner defaults to allow; viewer cannot publish.
    expect((screen.getByTestId('scoping-matrix-cell-cap-permissions-owner') as HTMLSelectElement).value).toBe('allow');
    expect((screen.getByTestId('scoping-matrix-cell-cap-delivery-publish-viewer') as HTMLSelectElement).value).toBe('deny');
  });

  it('editing a cell persists to ws.meta.scopingMatrix with trace + audit', () => {
    render(<ScopingModule />);
    fireEvent.change(screen.getByTestId('scoping-matrix-cell-cap-automate-run-viewer'), {
      target: { value: 'ask' },
    });
    expect((screen.getByTestId('scoping-matrix-cell-cap-automate-run-viewer') as HTMLSelectElement).value).toBe('ask');
    const persisted = (ws.meta?.[SCOPING_MATRIX_META_KEY] ?? {}) as any;
    expect(persisted.matrix['cap-automate-run'].viewer).toBe('ask');
    expect(typeof persisted.updatedAt).toBe('string');
    expect(ws.traces.some((t) => t.tool === 'scoping.matrix.set' && t.ok)).toBe(true);
    expect(readAudit().some((a) => a.event === 'scoping' && a.tool === 'scoping.matrix.set')).toBe(true);
  });

  it('rehydrates the matrix from ws.meta.scopingMatrix on mount', () => {
    ws.meta = {
      [SCOPING_MATRIX_META_KEY]: {
        matrix: {
          'cap-scope-view': { owner: 'deny', operator: 'ask', viewer: 'allow', auditor: 'allow' },
        },
        updatedAt: new Date().toISOString(),
      },
    };
    render(<ScopingModule />);
    expect((screen.getByTestId('scoping-matrix-cell-cap-scope-view-owner') as HTMLSelectElement).value).toBe('deny');
    expect((screen.getByTestId('scoping-matrix-cell-cap-scope-view-operator') as HTMLSelectElement).value).toBe('ask');
    // untouched rows fall back to defaults
    expect((screen.getByTestId('scoping-matrix-cell-cap-permissions-owner') as HTMLSelectElement).value).toBe('allow');
  });
});

describe('ScopingModule (FN-SCP-004 milestone checklist)', () => {
  it('renders MVP/steering/beta phases with checkable items, assignee + phase chips', () => {
    render(<ScopingModule />);
    expect(screen.getByTestId('scoping-checklist')).toBeTruthy();
    for (const phase of ['mvp', 'steering', 'beta'] as const) {
      const section = screen.getByTestId(`scoping-checklist-phase-${phase}`);
      expect(section).toBeTruthy();
      expect(section.textContent).toContain(phase);
    }
    for (const item of seedChecklistItems()) {
      expect(screen.getByTestId(`scoping-check-item-${item.id}`)).toBeTruthy();
      expect((screen.getByTestId(`scoping-check-${item.id}`) as HTMLInputElement).checked).toBe(false);
      const assignee = screen.getByTestId(`scoping-check-assignee-${item.id}`) as HTMLInputElement;
      expect(assignee.value).toBe(item.assignee);
      expect(screen.getByTestId(`scoping-check-item-${item.id}`).textContent).toContain(item.phase);
    }
  });

  it('toggling + reassigning persists via patchMeta with trace + audit', () => {
    render(<ScopingModule />);
    const id = 'chk-mvp-scope';
    fireEvent.click(screen.getByTestId(`scoping-check-${id}`));
    expect((screen.getByTestId(`scoping-check-${id}`) as HTMLInputElement).checked).toBe(true);
    fireEvent.change(screen.getByTestId(`scoping-check-assignee-${id}`), { target: { value: 'auditor' } });

    const persisted = (ws.meta?.[SCOPING_CHECKLIST_META_KEY] ?? {}) as any;
    expect(Array.isArray(persisted.items)).toBe(true);
    const row = persisted.items.find((i: any) => i.id === id);
    expect(row.done).toBe(true);
    expect(row.assignee).toBe('auditor');
    expect(typeof persisted.updatedAt).toBe('string');
    expect(ws.traces.some((t) => t.tool === 'scoping.checklist.toggle' && t.ok)).toBe(true);
    expect(ws.traces.some((t) => t.tool === 'scoping.checklist.assign' && t.ok)).toBe(true);
    expect(readAudit().some((a) => a.event === 'scoping' && a.tool === 'scoping.checklist.toggle')).toBe(true);
    expect(readAudit().some((a) => a.event === 'scoping' && a.tool === 'scoping.checklist.assign')).toBe(true);
  });

  it('rehydrates the checklist from ws.meta on mount', () => {
    const custom = [
      { id: 'chk-mvp-scope', label: 'Scope locked', phase: 'mvp' as const, assignee: 'auditor', done: true },
      { id: 'chk-beta-cohort', label: 'Beta cohort onboarded', phase: 'beta' as const, assignee: 'operator', done: false },
    ];
    ws.meta = {
      [SCOPING_CHECKLIST_META_KEY]: { items: custom, updatedAt: new Date().toISOString() },
    };
    render(<ScopingModule />);
    expect((screen.getByTestId('scoping-check-chk-mvp-scope') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByTestId('scoping-check-assignee-chk-mvp-scope') as HTMLInputElement).value).toBe('auditor');
    expect(screen.queryByTestId('scoping-check-steer-value')).toBeFalsy();
  });
});
