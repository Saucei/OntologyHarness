// T-27 FN-MKT-002/003 — CodeWorkspacesModule: 11 toggles + history + gating + v16/v20 Apply.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import CodeWorkspacesModule from './CodeWorkspacesModule';
import { APPLIED_TEMPLATE_META_KEY, TEMPLATE_V20, WORKSPACE_META_KEY, WORKSPACE_TOOLS } from '../workspaces/catalog';
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

describe('CodeWorkspacesModule (FN-MKT-002: 11-tool toggles + history + gating)', () => {
  it('renders 11 tool toggles and the repo chrome (Sync / Propose changes)', () => {
    render(<CodeWorkspacesModule />);
    expect(screen.getByTestId('code-workspaces-module')).toBeTruthy();
    expect(screen.getByTestId('cw-repo').textContent).toContain('ontology-harness');
    expect(screen.getByTestId('cw-sync').textContent).toMatch(/Sync/);
    expect(screen.getByTestId('cw-propose').textContent).toMatch(/Propose/);
    for (const tool of WORKSPACE_TOOLS) {
      expect(screen.getByTestId(`cw-tool-${tool.id}`)).toBeTruthy();
      expect(screen.getByTestId(`cw-toggle-${tool.id}`)).toBeTruthy();
    }
    expect(screen.getAllByTestId(/^cw-toggle-workspace\./)).toHaveLength(11);
  });

  it('toggling a tool persists via ws.meta and records trace + audit + history', () => {
    render(<CodeWorkspacesModule />);
    const build = screen.getByTestId('cw-toggle-workspace.build') as HTMLInputElement;
    expect(build.checked).toBe(false);
    fireEvent.click(build);
    expect((screen.getByTestId('cw-toggle-workspace.build') as HTMLInputElement).checked).toBe(true);

    const persisted = (ws.meta?.[WORKSPACE_META_KEY] ?? {}) as any;
    expect(persisted.enabled['workspace.build']).toBe(true);
    expect(Array.isArray(persisted.history)).toBe(true);
    expect(persisted.history.some((h: any) => h.toolId === 'workspace.build' && h.enabled === true)).toBe(true);

    expect(ws.traces.some((t) => t.tool === 'workspace.tool.toggle' && t.ok)).toBe(true);
    const audit = readAudit();
    expect(audit.some((a) => a.event === 'code-workspaces' && a.tool === 'workspace.tool.toggle')).toBe(true);
    expect(screen.getByTestId('cw-history').textContent).toContain('workspace.build');
  });

  it('gating disables deploy while build+test are off (and blocks enabling it)', () => {
    render(<CodeWorkspacesModule />);
    const deploy = screen.getByTestId('cw-toggle-workspace.deploy') as HTMLInputElement;
    // Seed has build off → deploy toggle is disabled and labelled gated.
    expect(deploy.disabled).toBe(true);
    expect(deploy.title).toMatch(/workspace\.build|workspace\.test/);
    expect(screen.getByTestId('cw-tool-workspace.deploy').textContent).toMatch(/needs workspace\.build/);

    // Seed has test on, so enabling build satisfies deploy's deps
    // (build + test) and unblocks the deploy toggle.
    fireEvent.click(screen.getByTestId('cw-toggle-workspace.build'));
    expect((screen.getByTestId('cw-toggle-workspace.deploy') as HTMLInputElement).disabled).toBe(false);
    // Propose stays gated until its flag is on; sync needs git but git is on in seed.
    fireEvent.click(screen.getByTestId('cw-toggle-workspace.build'));
    // Reversible: toggle back off works even when gated.
    expect((screen.getByTestId('cw-toggle-workspace.build') as HTMLInputElement).checked).toBe(false);
  });

  it('ephemeral chat appends a message (not persisted to ws.meta)', () => {
    render(<CodeWorkspacesModule />);
    fireEvent.change(screen.getByTestId('cw-chat-input'), { target: { value: 'hello ephemeral' } });
    fireEvent.click(screen.getByTestId('cw-chat-send'));
    expect(screen.getByTestId('cw-chat').textContent).toContain('hello ephemeral');
    expect(JSON.stringify(ws.meta)).not.toContain('hello ephemeral');
    expect(ws.traces.some((t) => t.tool === 'workspace.chat.send' && t.ok)).toBe(true);
  });
});

describe('CodeWorkspacesModule (FN-MKT-003: tiered templates v16/v20 + Apply)', () => {
  it('shows versioned v16 + v20 cards, the v16→v20 diff summary, and Apply persists + logs', () => {
    render(<CodeWorkspacesModule />);
    for (const t of ['template-v16-intermediate', 'template-v20-advanced'] as const) {
      const card = screen.getByTestId(`cw-template-${t}`);
      expect(card.textContent).toMatch(/v16|v20/);
      expect(screen.getByTestId(`cw-apply-${t}`)).toBeTruthy();
    }
    const v20card = screen.getByTestId('cw-template-template-v20-advanced');
    expect(v20card.textContent).toContain('8 tools');
    expect(v20card.textContent).toContain('ontology.update');
    expect(v20card.textContent).toMatch(/Automated/i);

    const diff = screen.getByTestId('cw-diff');
    expect(diff.textContent).toMatch(/v16 → v20/);
    expect(diff.textContent).toMatch(/\+4 tools/);
    expect(diff.textContent).toMatch(/automated off → on/);

    fireEvent.click(screen.getByTestId('cw-apply-template-v20-advanced'));

    const applied = (ws.meta?.[APPLIED_TEMPLATE_META_KEY] ?? {}) as any;
    expect(applied.templateId).toBe('template-v20-advanced');
    expect(applied.version).toBe(20);
    expect(applied.summary).toContain('v16 → v20');

    // Apply mapped v20 tools onto the workspace enablement map.
    const persisted = (ws.meta?.[WORKSPACE_META_KEY] ?? {}) as any;
    expect(persisted.enabled['workspace.write']).toBe(true);
    expect(persisted.enabled['workspace.test']).toBe(true);
    expect(persisted.enabled['workspace.build']).toBe(false);
    expect(persisted.enabled['workspace.deploy']).toBe(false);
    expect(persisted.history.some((h: any) => String(h.toolId ?? '').startsWith('workspace.'))).toBe(true);

    expect(ws.traces.some((t) => t.tool === 'workspace.template.apply' && t.ok)).toBe(true);
    expect(readAudit().some((a) => a.event === 'code-workspaces' && a.tool === 'workspace.template.apply')).toBe(true);
    expect(screen.getByTestId('cw-applied').textContent).toMatch(/v20/);
    expect(screen.getByTestId('cw-status').textContent).toMatch(/Applied Advanced v20/);
    void TEMPLATE_V20;
  });

  it('Sync records lastSync via ws.meta + trace/audit; Propose is gated until write+git+propose are on', () => {
    render(<CodeWorkspacesModule />);
    // Seed: propose flag off → propose is gated.
    fireEvent.click(screen.getByTestId('cw-propose'));
    expect(screen.getByTestId('cw-status').textContent).toMatch(/Cannot propose/);
    expect(ws.traces.some((t) => t.tool === 'workspace.repo.propose.gated')).toBe(true);

    fireEvent.click(screen.getByTestId('cw-sync'));
    const persisted = (ws.meta?.[WORKSPACE_META_KEY] ?? {}) as any;
    expect(typeof persisted.repoLastSyncAt).toBe('string');
    expect(screen.getByTestId('cw-repo').textContent).toContain('synced');
    expect(ws.traces.some((t) => t.tool === 'workspace.repo.sync' && t.ok)).toBe(true);
  });
});
