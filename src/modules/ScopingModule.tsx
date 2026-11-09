// ScopingModule — FN-SCP-001 (use-case funnel canvas) + FN-SCP-002 (guidance
// prompt bank). UNREGISTERED stub: exported for future registration only —
// layer invariants forbid adding it to registry.ts in this slice.
// Glass tokens only; light+dark parity via var(--*) tokens.
import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { appendAudit, appendTrace, patchMeta, ws } from '../store';
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
  addCard as addCardPure,
  addQuestionToFunnel,
  buildChecklistPatch,
  buildScopingMetaPatch,
  buildScopingMatrixPatch,
  cardsInColumn,
  checklistCounts,
  checklistInPhase,
  countsByColumn,
  matrixCounts,
  moveCardBy,
  queryBank,
  readChecklist,
  readScopingMatrix,
  readScopingState,
  removeCard as removeCardPure,
  setChecklistAssignee,
  setMatrixCell,
  toggleChecklistItem,
  type ChecklistItem,
  type FunnelCard,
  type FunnelColumnId,
  type GuidanceCategory,
  type GuidanceQuestion,
  type ScopingDecision,
  type ScopingMatrix,
  type ScopingRoleId,
} from '../scoping/bank';

function logOp(tool: string, detail: string) {
  try {
    appendTrace({ kind: 'tool-call', tool, ok: true, ms: 0, detail });
  } catch {
    /* ledger unavailable in some test envs — UI must not crash */
  }
  try {
    appendAudit({ event: 'scoping', tool, detail });
  } catch {
    /* audit unavailable — UI must not crash */
  }
}

export function ScopingModule() {
  const initial = useMemo(() => readScopingState(ws.meta), []);
  const [cards, setCards] = useState<FunnelCard[]>(() => initial.cards);
  const [synthesis, setSynthesis] = useState<string>(() => initial.synthesis);
  const [drafts, setDrafts] = useState<Record<FunnelColumnId, string>>({
    scope: '',
    questions: '',
    findings: '',
  });
  const [bankCategory, setBankCategory] = useState<GuidanceCategory | 'all'>('all');
  const [bankQuery, setBankQuery] = useState('');
  const [matrix, setMatrix] = useState<ScopingMatrix>(() => readScopingMatrix(ws.meta));
  const [checklist, setChecklist] = useState<ChecklistItem[]>(() => readChecklist(ws.meta));

  const counts = countsByColumn(cards);
  const visibleBank = queryBank(GUIDANCE_BANK, { category: bankCategory, query: bankQuery });
  const mCounts = matrixCounts(matrix);
  const cCounts = checklistCounts(checklist);

  const persist = (nextCards: FunnelCard[], nextSynthesis: string) => {
    patchMeta(buildScopingMetaPatch(nextCards, nextSynthesis));
  };

  const commit = (nextCards: FunnelCard[], tool: string, detail: string, nextSynthesis?: string) => {
    setCards(nextCards);
    persist(nextCards, nextSynthesis ?? synthesis);
    logOp(tool, detail);
  };

  const addCardToColumn = (column: FunnelColumnId) => {
    const title = drafts[column].trim();
    if (!title) return;
    const next = addCardPure(cards, { column, title });
    setDrafts((d) => ({ ...d, [column]: '' }));
    commit(next, 'scoping.card.add', `${column}: ${title} (${next.length} cards)`);
  };

  const removeCard = (id: string) => {
    const target = cards.find((c) => c.id === id);
    if (!target) return;
    const next = removeCardPure(cards, id);
    commit(next, 'scoping.card.remove', `${target.column}: ${target.title}`);
  };

  const moveCard = (id: string, direction: -1 | 1) => {
    const target = cards.find((c) => c.id === id);
    if (!target) return;
    const next = moveCardBy(cards, id, direction);
    const after = next.find((c) => c.id === id);
    if (!after || after.column === target.column) return;
    commit(next, 'scoping.card.move', `${target.title}: ${target.column} -> ${after.column}`);
  };

  const addFromBank = (q: GuidanceQuestion) => {
    const next = addQuestionToFunnel(cards, q);
    commit(next, 'scoping.bank.add', `questions: ${q.question} (${q.category})`);
  };

  const saveSynthesis = () => {
    persist(cards, synthesis);
    logOp('scoping.synthesis.save', `synthesis ${synthesis.length} chars`);
  };

  const changeMatrixCell = (capabilityId: string, role: ScopingRoleId, decision: ScopingDecision) => {
    const next = setMatrixCell(matrix, capabilityId, role, decision);
    setMatrix(next);
    patchMeta(buildScopingMatrixPatch(next));
    logOp('scoping.matrix.set', `${capabilityId} × ${role} → ${decision}`);
  };

  const toggleItem = (id: string) => {
    const target = checklist.find((it) => it.id === id);
    if (!target) return;
    const next = toggleChecklistItem(checklist, id);
    setChecklist(next);
    patchMeta(buildChecklistPatch(next));
    logOp('scoping.checklist.toggle', `${id} → ${!target.done ? 'done' : 'open'} (${target.phase})`);
  };

  const changeAssignee = (id: string, assignee: string) => {
    const next = setChecklistAssignee(checklist, id, assignee);
    setChecklist(next);
    patchMeta(buildChecklistPatch(next));
    logOp('scoping.checklist.assign', `${id} → ${assignee.trim() || '(unassigned)'}`);
  };

  return (
    <div className="module fade-in" data-testid="scoping-module" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="module-head glass-strong">
        <div>
          <div className="module-title">
            <Icon name="graph" size={18} /> Scoping — Funnel Canvas + Guidance Bank
          </div>
          <div className="module-sub">
            Scope → Questions → Findings · {cards.length} cards · synthesis persists via ws.meta[{SCOPING_META_KEY}]
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          <span className="chip">Scope {counts.scope}</span>
          <span className="chip">Questions {counts.questions}</span>
          <span className="chip">Findings {counts.findings}</span>
        </div>
      </div>

      {/* ——— FN-SCP-001: 3-column funnel canvas ——— */}
      <div
        data-testid="scoping-funnel"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, alignItems: 'start' }}
      >
        {FUNNEL_COLUMNS.map((col) => {
          const colCards = cardsInColumn(cards, col.id);
          const colIdx = FUNNEL_COLUMN_IDS.indexOf(col.id);
          const prevCol = colIdx > 0 ? FUNNEL_COLUMNS[colIdx - 1] : null;
          const nextCol = colIdx < FUNNEL_COLUMNS.length - 1 ? FUNNEL_COLUMNS[colIdx + 1] : null;
          return (
            <section
              key={col.id}
              className="glass panel"
              data-testid={`scoping-column-${col.id}`}
              aria-label={`${col.label} column`}
              style={{ display: 'flex', flexDirection: 'column', minHeight: 0, maxHeight: 520 }}
            >
              <div className="panel-title">
                <span>
                  {col.label} · {colCards.length}
                </span>
                <span className="chip chip-mono">{col.id}</span>
              </div>
              <p className="module-sub" style={{ margin: '0 0 8px' }}>
                {col.hint}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflow: 'auto', minHeight: 0, flex: 1 }}>
                {colCards.map((card) => (
                  <article
                    key={card.id}
                    data-testid={`scoping-card-${card.id}`}
                    data-column={card.column}
                    className="glass-faint"
                    style={{ padding: '8px 10px' }}
                  >
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <strong style={{ flex: 1, fontSize: 12, minWidth: 0 }}>{card.title}</strong>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ padding: '2px 8px', fontSize: 10 }}
                        aria-label={`Remove ${card.title}`}
                        data-testid={`scoping-remove-${card.id}`}
                        onClick={() => removeCard(card.id)}
                      >
                        <Icon name="x" size={12} /> Remove
                      </button>
                    </div>
                    {card.detail && (
                      <p className="module-sub" style={{ margin: '4px 0 0' }}>
                        {card.detail}
                      </p>
                    )}
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6 }}>
                      {prevCol && (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ padding: '2px 8px', fontSize: 10 }}
                          aria-label={`Move ${card.title} to ${prevCol.label}`}
                          data-testid={`scoping-move-left-${card.id}`}
                          onClick={() => moveCard(card.id, -1)}
                        >
                          ← {prevCol.label}
                        </button>
                      )}
                      {nextCol && (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ padding: '2px 8px', fontSize: 10 }}
                          aria-label={`Move ${card.title} to ${nextCol.label}`}
                          data-testid={`scoping-move-right-${card.id}`}
                          onClick={() => moveCard(card.id, 1)}
                        >
                          {nextCol.label} →
                        </button>
                      )}
                      {card.sourceQuestionId && <span className="chip chip-mono">{card.sourceQuestionId}</span>}
                    </div>
                  </article>
                ))}
                {colCards.length === 0 && (
                  <p className="module-sub" style={{ margin: 0 }}>
                    No cards yet — add one below or pull from the bank.
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <input
                  className="input"
                  style={{ flex: 1, padding: '6px 8px', fontSize: 11 }}
                  placeholder={`Add ${col.label} card…`}
                  aria-label={`New ${col.label} card title`}
                  data-testid={`scoping-input-${col.id}`}
                  value={drafts[col.id]}
                  onChange={(e) => setDrafts((d) => ({ ...d, [col.id]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addCardToColumn(col.id);
                  }}
                />
                <button
                  type="button"
                  className="btn"
                  aria-label={`Add ${col.label} card`}
                  data-testid={`scoping-add-${col.id}`}
                  onClick={() => addCardToColumn(col.id)}
                >
                  <Icon name="plus" size={12} /> Add
                </button>
              </div>
            </section>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, alignItems: 'start' }}>
        {/* ——— FN-SCP-002: guidance question bank ——— */}
        <section className="glass panel" data-testid="scoping-bank" aria-label="Guidance question bank" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="panel-title">
            <span>
              Guidance bank · {visibleBank.length} of {GUIDANCE_BANK.length}
            </span>
            <span className="chip">FN-SCP-002</span>
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <select
              className="input"
              style={{ width: 150, padding: '6px 8px', fontSize: 11 }}
              aria-label="Category filter"
              data-testid="scoping-bank-category"
              value={bankCategory}
              onChange={(e) => {
                setBankCategory(e.target.value as GuidanceCategory | 'all');
                logOp('scoping.bank.filter', `category=${e.target.value}`);
              }}
            >
              <option value="all">All categories</option>
              {GUIDANCE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              className="input"
              style={{ flex: 1, padding: '6px 8px', fontSize: 11 }}
              placeholder="Search questions…"
              aria-label="Search bank"
              data-testid="scoping-bank-search"
              value={bankQuery}
              onChange={(e) => setBankQuery(e.target.value)}
            />
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflow: 'auto' }}>
            {visibleBank.map((q) => (
              <li
                key={q.id}
                data-testid={`scoping-bank-question-${q.id}`}
                className="glass-faint"
                style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '7px 9px' }}
              >
                <span className="chip chip-mono" style={{ flexShrink: 0 }}>
                  {q.category}
                </span>
                <span style={{ flex: 1, fontSize: 11.5, minWidth: 0 }}>{q.question}</span>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ padding: '4px 10px', fontSize: 10, flexShrink: 0 }}
                  aria-label={`Add to Questions: ${q.question}`}
                  data-testid={`scoping-bank-add-${q.id}`}
                  onClick={() => addFromBank(q)}
                >
                  Add
                </button>
              </li>
            ))}
            {visibleBank.length === 0 && (
              <li className="module-sub" style={{ margin: 0 }}>
                No bank questions match the current filter.
              </li>
            )}
          </ul>
        </section>

        {/* ——— Synthesis write-up (persisted via patchMeta/ws.meta) ——— */}
        <section className="glass panel" data-testid="scoping-synthesis" aria-label="Synthesis write-up" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="panel-title">
            <span>Synthesis write-up</span>
            <span className="chip chip-mono">ws.meta · {SCOPING_META_KEY}</span>
          </div>
          <textarea
            className="input"
            style={{ minHeight: 120, resize: 'vertical', fontSize: 12 }}
            placeholder="Synthesise the funnel: scope, key questions, findings…"
            aria-label="Synthesis write-up"
            data-testid="scoping-synthesis-input"
            value={synthesis}
            onChange={(e) => setSynthesis(e.target.value)}
          />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
            <span className="module-sub">{synthesis.length} chars</span>
            <button
              type="button"
              className="btn btn-primary"
              style={{ marginLeft: 'auto' }}
              aria-label="Save synthesis"
              data-testid="scoping-synthesis-save"
              onClick={saveSynthesis}
            >
              <Icon name="check" size={12} /> Save synthesis
            </button>
          </div>
        </section>
      </div>

      {/* ——— FN-SCP-003: permissions matrix (rows=capability cards, cols=roles) ——— */}
      <section
        className="glass panel"
        data-testid="scoping-matrix"
        aria-label="Permissions matrix"
        style={{ display: 'flex', flexDirection: 'column' }}
      >
        <div className="panel-title">
          <span>
            Permissions matrix · {SCOPING_CAPABILITIES.length} capabilities × {SCOPING_ROLES.length} roles
          </span>
          <span className="chip">FN-SCP-003</span>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
          <span className="chip">allow {mCounts.allow}</span>
          <span className="chip">ask {mCounts.ask}</span>
          <span className="chip">deny {mCounts.deny}</span>
          <span className="chip chip-mono" style={{ marginLeft: 'auto' }}>
            ws.meta · {SCOPING_MATRIX_META_KEY}
          </span>
        </div>
        <div
          role="grid"
          aria-label="Capability × role permissions"
          style={{
            display: 'grid',
            gridTemplateColumns: `minmax(170px, 1.6fr) repeat(${SCOPING_ROLES.length}, minmax(104px, 1fr))`,
            gap: 6,
            alignItems: 'center',
            overflowX: 'auto',
          }}
        >
          <div className="module-sub" style={{ margin: 0, fontWeight: 600 }}>
            Capability
          </div>
          {SCOPING_ROLES.map((role) => (
            <div key={role.id} style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <span style={{ fontSize: 11, fontWeight: 600 }}>{role.label}</span>
              <span className="module-sub" style={{ margin: 0 }}>
                {role.hint}
              </span>
            </div>
          ))}
          {SCOPING_CAPABILITIES.map((cap) => (
            <div key={cap.id} style={{ display: 'contents' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, padding: '6px 8px' }} className="glass-faint">
                <span style={{ fontSize: 11.5, fontWeight: 600 }}>{cap.label}</span>
                <span className="module-sub" style={{ margin: 0 }}>
                  {cap.hint}
                </span>
              </div>
              {SCOPING_ROLES.map((role) => (
                <select
                  key={`${cap.id}-${role.id}`}
                  className="input"
                  style={{ padding: '6px 8px', fontSize: 11, width: '100%' }}
                  aria-label={`${cap.label} for ${role.label}`}
                  data-testid={`scoping-matrix-cell-${cap.id}-${role.id}`}
                  value={matrix[cap.id]?.[role.id] ?? 'deny'}
                  onChange={(e) => changeMatrixCell(cap.id, role.id, e.target.value as ScopingDecision)}
                >
                  {SCOPING_DECISIONS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ——— FN-SCP-004: MVP / steering / beta checklist ——— */}
      <section
        className="glass panel"
        data-testid="scoping-checklist"
        aria-label="MVP steering beta checklist"
        style={{ display: 'flex', flexDirection: 'column' }}
      >
        <div className="panel-title">
          <span>
            Milestone checklist · {cCounts.done}/{cCounts.total} done
          </span>
          <span className="chip">FN-SCP-004</span>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
          {CHECKLIST_PHASES.map((p) => (
            <span key={p.id} className="chip">
              {p.label} {cCounts.byPhase[p.id].done}/{cCounts.byPhase[p.id].total}
            </span>
          ))}
          <span className="chip chip-mono" style={{ marginLeft: 'auto' }}>
            ws.meta · {SCOPING_CHECKLIST_META_KEY}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, alignItems: 'start' }}>
          {CHECKLIST_PHASES.map((phase) => {
            const items = checklistInPhase(checklist, phase.id);
            return (
              <div
                key={phase.id}
                data-testid={`scoping-checklist-phase-${phase.id}`}
                style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}
              >
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 600 }}>{phase.label}</span>
                  <span className="chip chip-mono">{phase.id}</span>
                  <span className="module-sub" style={{ margin: 0 }}>
                    {phase.hint}
                  </span>
                </div>
                {items.map((item) => (
                  <label
                    key={item.id}
                    data-testid={`scoping-check-item-${item.id}`}
                    className="glass-faint"
                    style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '7px 9px', cursor: 'pointer' }}
                  >
                    <input
                      type="checkbox"
                      aria-label={`Mark done: ${item.label}`}
                      data-testid={`scoping-check-${item.id}`}
                      checked={item.done}
                      onChange={() => toggleItem(item.id)}
                      style={{ marginTop: 2 }}
                    />
                    <span style={{ flex: 1, fontSize: 11.5, minWidth: 0 }}>
                      <span style={{ textDecoration: item.done ? 'line-through' : 'none' }}>{item.label}</span>
                      <span style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center' }}>
                        <span className="chip chip-mono">{phase.id}</span>
                        <input
                          className="input"
                          style={{ flex: 1, padding: '2px 6px', fontSize: 10, minWidth: 0 }}
                          placeholder="Assignee"
                          aria-label={`Assignee for ${item.label}`}
                          data-testid={`scoping-check-assignee-${item.id}`}
                          value={item.assignee}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => changeAssignee(item.id, e.target.value)}
                        />
                      </span>
                    </span>
                  </label>
                ))}
                {items.length === 0 && (
                  <p className="module-sub" style={{ margin: 0 }}>
                    No items in this phase.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/** Future registry entry — UNREGISTERED in this slice (do not import in registry.ts). */
export const scopingModuleDefinition = {
  id: 'scoping',
  label: 'Scoping',
  hint: 'Use-case funnel canvas + guidance question bank',
  section: 'WORK' as const,
  layer: 'L3-FOUNDRY' as const,
  Component: ScopingModule,
};

export default ScopingModule;
