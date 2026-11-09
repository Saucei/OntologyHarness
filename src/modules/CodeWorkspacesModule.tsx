// CodeWorkspacesModule — FN-MKT-002 (Code Workspaces) + FN-MKT-003 (tiered templates).
// AIP in Code Workspaces: 11-tool toggles + ephemeral chat history + repo chrome
// (Sync / Propose changes), plus the versioned Agent app templates catalog
// (Intermediate v16 Object query → Advanced v20 with Ontology Actions +
// Automated + application-state variables) with diff summary + Apply.
// UNREGISTERED stub: exported for future registration only — do not touch registry.ts.
// Glass tokens only; light+dark parity via var(--*) tokens.
import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { appendAudit, appendTrace, patchMeta, ws } from '../store';
import {
  AGENT_TEMPLATES,
  REPO_SEED,
  TEMPLATE_V16,
  TEMPLATE_V20,
  WORKSPACE_TOOLS,
  applyAgentTemplate,
  appendChatMessage,
  buildAppliedTemplateMetaPatch,
  buildWorkspaceMetaPatch,
  describeRepo,
  diffTemplates,
  enabledToolCount,
  findTemplate,
  gateReason,
  isEffectivelyEnabled,
  missingDeps,
  readAppliedTemplate,
  readWorkspaceState,
  recordProposal,
  recordSync,
  seedChat,
  toggleWorkspaceTool,
  type AppliedTemplate,
  type AgentTemplate,
  type ChatMessage,
  type WorkspaceState,
} from '../workspaces/catalog';

function logOp(tool: string, detail: string) {
  try {
    appendTrace({ kind: 'tool-call', tool, ok: true, ms: 0, detail });
  } catch {
    /* ledger unavailable in some test envs — UI must not crash */
  }
  try {
    appendAudit({ event: 'code-workspaces', tool, detail });
  } catch {
    /* audit unavailable — UI must not crash */
  }
}

const v16v20Diff = diffTemplates(TEMPLATE_V16, TEMPLATE_V20);

export function CodeWorkspacesModule() {
  const [state, setState] = useState<WorkspaceState>(() => readWorkspaceState(ws.meta));
  const [applied, setApplied] = useState<AppliedTemplate | null>(() => readAppliedTemplate(ws.meta));
  // Ephemeral chat — memory only, never persisted (FN-MKT-002).
  const [chat, setChat] = useState<ChatMessage[]>(() => seedChat());
  const [draft, setDraft] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const enabledCount = useMemo(() => enabledToolCount(state), [state]);

  const persistState = (next: WorkspaceState) => {
    setState(next);
    patchMeta(buildWorkspaceMetaPatch(next));
  };

  const onToggle = (toolId: string, next: boolean) => {
    // Enablement gating: block enabling a gated tool and explain why.
    if (next && missingDeps(state, toolId).length > 0) {
      const reason = gateReason(state, toolId) ?? 'dependencies missing';
      setMsg(`Cannot enable ${toolId} — ${reason}`);
      logOp('workspace.tool.gated', `${toolId}: ${reason}`);
      return;
    }
    const nextState = toggleWorkspaceTool(state, toolId, next);
    persistState(nextState);
    logOp('workspace.tool.toggle', `${toolId} → ${next ? 'enabled' : 'disabled'} (${nextState.history.length} events)`);
    setMsg(null);
  };

  const onSync = () => {
    const next = recordSync(state);
    persistState(next);
    logOp('workspace.repo.sync', describeRepo(next));
    setMsg(`Synced ${REPO_SEED.name} @ ${REPO_SEED.branch}`);
  };

  const onPropose = () => {
    if (!isEffectivelyEnabled(state, 'workspace.propose')) {
      const reason = gateReason(state, 'workspace.propose') ?? 'propose tool disabled';
      setMsg(`Cannot propose — ${reason} (enable workspace.propose: write + git)`);
      logOp('workspace.repo.propose.gated', reason);
      return;
    }
    const next = recordProposal(state);
    persistState(next);
    logOp('workspace.repo.propose', `${REPO_SEED.name} · ${REPO_SEED.branch} · proposal ${next.changesProposed}`);
    setMsg(`Proposed changes (${next.changesProposed})`);
  };

  const onApplyTemplate = (template: AgentTemplate) => {
    const from = applied ? (findTemplate(applied.templateId) ?? TEMPLATE_V16) : TEMPLATE_V16;
    const diff = applied ? diffTemplates(from, template) : v16v20Diff;
    const next = applyAgentTemplate(state, template);
    persistState(next);
    const record: AppliedTemplate = {
      templateId: template.id,
      version: template.version,
      tier: template.tier,
      appliedAt: new Date().toISOString(),
      summary: diff.summary,
    };
    setApplied(record);
    patchMeta(buildAppliedTemplateMetaPatch(record));
    logOp('workspace.template.apply', `${template.id} v${template.version} · ${diff.summary}`);
    setMsg(`Applied ${template.label} · ${template.name}`);
  };

  const onSendChat = () => {
    const text = draft.trim();
    if (!text) return;
    setChat((prev) => appendChatMessage(prev, text));
    setDraft('');
    logOp('workspace.chat.send', `${text.slice(0, 80)} (${chat.length + 1} msgs, ephemeral)`);
  };

  return (
    <div className="module fade-in" data-testid="code-workspaces-module" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* ——— Repo chrome (FN-MKT-002) ——— */}
      <div className="module-head glass-strong">
        <div>
          <div className="module-title">
            <Icon name="workshop" size={18} /> Code Workspaces — AIP tool gating
          </div>
          <div className="module-sub" data-testid="cw-repo">
            {describeRepo(state)} · {enabledCount}/11 tools enabled
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          <span className="chip chip-mono">{REPO_SEED.name} · {REPO_SEED.branch}</span>
          <button
            type="button"
            className="btn"
            aria-label="Sync repo"
            data-testid="cw-sync"
            onClick={onSync}
          >
            <Icon name="refresh" size={12} /> Sync
          </button>
          <button
            type="button"
            className="btn btn-primary"
            aria-label="Propose changes"
            data-testid="cw-propose"
            onClick={onPropose}
          >
            <Icon name="arrow" size={12} /> Propose changes
          </button>
        </div>
      </div>

      {msg && (
        <div role="status" data-testid="cw-status" className="chip" style={{ alignSelf: 'flex-start' }}>
          {msg}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, alignItems: 'start' }}>
        {/* ——— 11-tool toggles + history (FN-MKT-002) ——— */}
        <section className="glass panel" data-testid="cw-tools" aria-label="Workspace tools" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="panel-title">
            <span>Workspace tools · {enabledCount}/11 enabled</span>
            <span className="chip">FN-MKT-002</span>
          </div>
          <p className="module-sub" style={{ margin: '0 0 8px' }}>
            Gated tools stay off until their dependencies are enabled. Disabling a dependency gates its dependents.
          </p>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {WORKSPACE_TOOLS.map((tool) => {
              const enabled = Boolean(state.enabled[tool.id]);
              const effective = isEffectivelyEnabled(state, tool.id);
              const missing = missingDeps(state, tool.id);
              // Block *enabling* while deps are missing; a tool that is already on
              // can always be turned off (so gating never traps the user).
              const blocked = !enabled && missing.length > 0;
              const reason = blocked ? (gateReason(state, tool.id) ?? missing.join(', ')) : null;
              return (
                <li
                  key={tool.id}
                  data-testid={`cw-tool-${tool.id}`}
                  className="glass-faint"
                  style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '7px 9px' }}
                >
                  <input
                    type="checkbox"
                    checked={enabled}
                    disabled={blocked}
                    title={reason ?? tool.desc}
                    aria-label={`Enable ${tool.label} (${tool.id})`}
                    data-testid={`cw-toggle-${tool.id}`}
                    onChange={(e) => onToggle(tool.id, e.target.checked)}
                  />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: 12 }}>{tool.label}</strong>
                      <code className="chip chip-mono" style={{ fontSize: 9 }}>{tool.id}</code>
                      <span className="chip chip-mono" style={{ fontSize: 9 }}>{tool.category}</span>
                      {tool.destructive && <span className="pill pill-warn">mutates repo</span>}
                      {enabled && !effective && <span className="pill pill-danger">gated</span>}
                      {blocked && <span className="pill pill-warn">needs {missing.join(', ')}</span>}
                    </span>
                    <span className="module-sub" style={{ display: 'block', marginTop: 2 }}>
                      {tool.desc}
                      {tool.requires && tool.requires.length > 0 ? ` · requires ${tool.requires.join(', ')}` : ''}
                      {reason ? ` · ${reason}` : ''}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        {/* ——— History + ephemeral chat (FN-MKT-002) ——— */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <section className="glass panel" data-testid="cw-history" aria-label="Toggle history" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="panel-title">
              <span>Toggle history · {state.history.length} events</span>
              <span className="chip chip-mono">newest first</span>
            </div>
            {state.history.length === 0 ? (
              <p className="module-sub" style={{ margin: 0 }}>No toggles yet — every toggle appends an event here and to the trace ledger.</p>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 220, overflow: 'auto' }}>
                {state.history.map((h) => (
                  <li key={h.id} data-testid={`cw-history-item-${h.toolId}-${h.id}`} className="glass-faint" style={{ padding: '5px 8px', fontSize: 11 }}>
                    <code className="chip chip-mono" style={{ fontSize: 9 }}>{h.toolId}</code>{' '}
                    <strong>{h.enabled ? 'enabled' : 'disabled'}</strong>
                    {h.detail && <span className="module-sub"> · {h.detail}</span>}
                    <span className="module-sub chip-mono" style={{ display: 'block', fontSize: 9 }}>{h.at}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="glass panel" data-testid="cw-chat" aria-label="Ephemeral chat" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="panel-title">
              <span>Ephemeral chat · {chat.length} messages</span>
              <span className="chip chip-mono">not persisted</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflow: 'auto', marginBottom: 8 }}>
              {chat.map((m) => (
                <div key={m.id} data-testid={`cw-chat-msg-${m.id}`} className="glass-faint" style={{ padding: '6px 8px', fontSize: 11.5 }}>
                  <span className="chip chip-mono" style={{ fontSize: 9 }}>{m.role}</span> {m.text}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                className="input"
                style={{ flex: 1, padding: '6px 8px', fontSize: 11 }}
                placeholder="Message the workspace agent (ephemeral)…"
                aria-label="Chat message"
                data-testid="cw-chat-input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') onSendChat(); }}
              />
              <button type="button" className="btn btn-primary" aria-label="Send chat message" data-testid="cw-chat-send" onClick={onSendChat}>
                <Icon name="arrow" size={12} /> Send
              </button>
            </div>
          </section>
        </div>
      </div>

      {/* ——— Tiered agent app templates (FN-MKT-003) ——— */}
      <section className="glass panel" data-testid="cw-templates" aria-label="Tiered agent templates" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="panel-title">
          <span>Tiered agent app templates · {AGENT_TEMPLATES.length} versions</span>
          <span className="chip">FN-MKT-003</span>
        </div>
        <div className="glass-faint" data-testid="cw-diff" style={{ padding: '8px 10px', fontSize: 11.5 }}>
          <strong>Diff v16 → v20</strong> · {v16v20Diff.summary}
          {applied && (
            <span className="chip" data-testid="cw-applied" style={{ marginLeft: 8 }}>
              Applied {findTemplate(applied.templateId)?.label ?? applied.templateId} · v{applied.version} · {applied.appliedAt}
            </span>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, alignItems: 'stretch' }}>
          {AGENT_TEMPLATES.map((t) => (
            <article key={t.id} data-testid={`cw-template-${t.id}`} className="glass-faint" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <Icon name={t.tier === 'advanced' ? 'spark' : 'graph'} size={16} />
                <strong>{t.label} — {t.name}</strong>
                <span className="chip chip-mono">v{t.version}</span>
                <span className="chip chip-mono">{t.tier}</span>
                {applied?.templateId === t.id && <span className="pill pill-live">applied</span>}
              </div>
              <p className="module-sub" style={{ margin: 0 }}>{t.desc}</p>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {t.tools.map((tool) => (
                  <span key={tool} className="chip chip-mono" style={{ fontSize: 9 }}>{tool}</span>
                ))}
              </div>
              <div className="module-sub" style={{ margin: 0 }}>
                Ontology actions: {t.ontologyActions.join(', ') || 'none'} · Automated: {t.automated ? 'on' : 'off'} · Variables: {t.variables.join(', ')}
              </div>
              <div className="glass-faint" style={{ padding: '6px 8px', fontSize: 9.5, maxHeight: 120, overflow: 'auto', fontFamily: 'var(--font-mono)', whiteSpace: 'pre-wrap' }}>
                <div style={{ color: 'var(--text-dim)' }}>SYSTEM · {t.systemPrompt}</div>
                <div style={{ marginTop: 4 }}>USER · {t.userTemplate}</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ justifyContent: 'center', flex: 1, marginTop: 'auto' }}
                  aria-label={`Apply ${t.label} ${t.name} template`}
                  data-testid={`cw-apply-${t.id}`}
                  onClick={() => onApplyTemplate(t)}
                >
                  <Icon name="check" size={12} /> Apply
                </button>
                <span className="chip chip-mono" style={{ alignSelf: 'center' }}>{t.tools.length} tools</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

/** Future registry entry — UNREGISTERED in this slice (do not import in registry.ts). */
export const codeWorkspacesModuleDefinition = {
  id: 'code-workspaces',
  label: 'Code Workspaces',
  hint: 'AIP code workspaces: 11-tool toggles + tiered agent templates',
  section: 'WORK' as const,
  layer: 'L3-FOUNDRY' as const,
  Component: CodeWorkspacesModule,
};

export default CodeWorkspacesModule;
