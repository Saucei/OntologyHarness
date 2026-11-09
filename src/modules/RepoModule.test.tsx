// T-11 FN-AST-005/006/007/008 — RepoModule: provisioning, semver modal, checks, scoped imports.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import RepoModule from './RepoModule';
import { REPO_META_KEY, RESOURCES_META_KEY, SEED_CURRENT_VERSION, formatSemver } from '../repos/types';
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

describe('RepoModule (FN-AST-005: provisioning form)', () => {
  it('renders model + auto-import + bind + API name and provisions with trace + audit', () => {
    render(<RepoModule />);
    expect(screen.getByTestId('repo-module')).toBeTruthy();
    expect(screen.getByTestId('repo-form-model')).toBeTruthy();
    expect(screen.getByTestId('repo-form-autoimport')).toBeTruthy();
    expect(screen.getByTestId('repo-form-bind')).toBeTruthy();
    expect(screen.getByTestId('repo-form-api-name')).toBeTruthy();

    fireEvent.change(screen.getByTestId('repo-form-agent-name'), { target: { value: 'Custom Agent' } });
    fireEvent.change(screen.getByTestId('repo-form-api-name'), { target: { value: 'custom-agent' } });
    fireEvent.click(screen.getByTestId('repo-provision-submit'));

    const persisted = (ws.meta?.[REPO_META_KEY] ?? {}) as any;
    expect(persisted.provisioning.agentApiName).toBe('custom-agent');
    expect(typeof persisted.currentVersion).toBe('string');
    expect(ws.traces.some((t) => t.tool === 'repo.provision.submit' && t.ok)).toBe(true);
    expect(readAudit().some((a) => a.event === 'repos' && a.tool === 'repo.provision.submit')).toBe(true);
    expect(screen.getByTestId('repo-status').textContent).toContain('Custom Agent');
  });

  it('blocks invalid provisioning and surfaces the validation error', () => {
    render(<RepoModule />);
    fireEvent.change(screen.getByTestId('repo-form-agent-name'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('repo-provision-submit'));
    expect(screen.getByTestId('repo-provision-errors').textContent).toContain('Agent name is required');
    expect(screen.getByTestId('repo-status').textContent).toContain('Provisioning blocked');
    expect(ws.traces.some((t) => t.tool === 'repo.provision.submit' && !t.ok)).toBe(true);
  });
});

describe('RepoModule (FN-AST-006: tag-and-release semver modal)', () => {
  it('previews Releasing: x.y.z by bump and confirms with trace + audit + version bump', () => {
    render(<RepoModule />);
    expect(screen.getByTestId('repo-current-version').textContent).toContain(formatSemver(SEED_CURRENT_VERSION));

    fireEvent.click(screen.getByTestId('repo-release-open'));
    expect(screen.getByTestId('repo-release-modal')).toBeTruthy();
    // default patch: 1.2.3 → 1.2.4
    expect(screen.getByTestId('repo-release-preview').textContent).toBe('Releasing: 1.2.4');

    fireEvent.click(screen.getByTestId('repo-release-bump-minor'));
    expect(screen.getByTestId('repo-release-preview').textContent).toBe('Releasing: 1.3.0');

    fireEvent.click(screen.getByTestId('repo-release-bump-custom'));
    fireEvent.change(screen.getByTestId('repo-release-custom'), { target: { value: '3.1.0' } });
    expect(screen.getByTestId('repo-release-preview').textContent).toBe('Releasing: 3.1.0');

    fireEvent.change(screen.getByTestId('repo-release-target-kind'), { target: { value: 'commit' } });
    fireEvent.click(screen.getByTestId('repo-release-confirm'));

    const persisted = (ws.meta?.[REPO_META_KEY] ?? {}) as any;
    expect(persisted.currentVersion).toBe('3.1.0');
    expect(Array.isArray(persisted.releases)).toBe(true);
    expect(persisted.releases[0].version).toBe('3.1.0');
    expect(persisted.releases[0].bump).toBe('custom');
    expect(persisted.releases[0].target.kind).toBe('commit');
    expect(ws.traces.some((t) => t.tool === 'repo.release.confirm' && t.ok)).toBe(true);
    expect(readAudit().some((a) => a.event === 'repos' && a.tool === 'repo.release.confirm')).toBe(true);
    expect(screen.getByTestId('repo-current-version').textContent).toContain('3.1.0');
    expect(screen.getByTestId('repo-release-list')).toBeTruthy();
  });

  it('custom version rejects invalid semver and keeps the modal open', () => {
    render(<RepoModule />);
    fireEvent.click(screen.getByTestId('repo-release-open'));
    fireEvent.click(screen.getByTestId('repo-release-bump-custom'));
    fireEvent.change(screen.getByTestId('repo-release-custom'), { target: { value: 'nope' } });
    expect(screen.getByTestId('repo-release-preview').textContent).toMatch(/Invalid version/);
    fireEvent.click(screen.getByTestId('repo-release-confirm'));
    expect(screen.getByTestId('repo-release-error')).toBeTruthy();
    expect(screen.getByTestId('repo-release-modal')).toBeTruthy();
    expect(ws.traces.some((t) => t.tool === 'repo.release.confirm' && !t.ok)).toBe(true);
  });
});

describe('RepoModule (FN-AST-007: Checks tab list + run)', () => {
  it('shows status dots + durations, switches tabs, and Run flips a check to SUCCEEDED', () => {
    render(<RepoModule />);
    for (const tab of ['checks', 'branches', 'prs', 'tags', 'settings'] as const) {
      expect(screen.getByTestId(`repo-tab-${tab}`)).toBeTruthy();
    }
    expect(screen.getByTestId('repo-checks-panel')).toBeTruthy();

    const rows = screen.getAllByTestId(/^repo-check-row-/);
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByTestId('repo-checks-summary').textContent).toContain('succeeded');

    // run the queued lint check (seed: QUEUED → SUCCEEDED with a duration)
    fireEvent.click(screen.getByTestId('repo-check-run-chk-lint'));
    const persisted = (ws.meta?.[REPO_META_KEY] ?? {}) as any;
    const lint = persisted.checks.find((c: any) => c.id === 'chk-lint');
    expect(lint.status).toBe('SUCCEEDED');
    expect(lint.durationMs).toBeGreaterThan(0);
    expect(ws.traces.some((t) => t.tool === 'repo.checks.run' && t.ok)).toBe(true);
    expect(readAudit().some((a) => a.event === 'repos' && a.tool === 'repo.checks.run')).toBe(true);
    expect(screen.getByTestId('repo-check-duration-chk-lint').textContent).not.toBe('—');

    // switch to Branches — checks panel hides, branch list shows
    fireEvent.click(screen.getByTestId('repo-tab-branches'));
    expect(screen.getByTestId('repo-tab-panel-branches').textContent).toContain('main');
  });
});

describe('RepoModule (FN-AST-008: scoped imports console)', () => {
  it('tabs/counts/selection/settings/resources.json all persist with trace + audit', () => {
    render(<RepoModule />);
    expect(screen.getByTestId('repo-scoped')).toBeTruthy();
    expect(screen.getByTestId('repo-scope-tab-sdk')).toBeTruthy();
    expect(screen.getByTestId('repo-scope-tab-platform')).toBeTruthy();
    expect(screen.getByTestId('repo-scoped-counts').textContent).toContain('total');
    expect(screen.getByTestId('repo-scope-json').textContent).toContain('res-sdk-file-1');

    // toggle a selection
    fireEvent.click(screen.getByTestId('repo-scoped-toggle-res-sdk-file-1'));
    let persisted = (ws.meta?.[RESOURCES_META_KEY] ?? {}) as any;
    expect(persisted.selectedResourceIds).toContain('res-sdk-file-1');
    expect(ws.traces.some((t) => t.tool === 'repo.scope.select' && t.ok)).toBe(true);

    // toggle a scope setting
    fireEvent.click(screen.getByTestId('repo-scope-allow-default'));
    persisted = (ws.meta?.[RESOURCES_META_KEY] ?? {}) as any;
    expect(persisted.scopeSettings.allowDefaultScope).toBe(true);
    expect(ws.traces.some((t) => t.tool === 'repo.scope.setting' && t.ok)).toBe(true);

    // switch to Platform + add a model
    fireEvent.click(screen.getByTestId('repo-scope-tab-platform'));
    const before = (ws.meta?.[RESOURCES_META_KEY] as any)?.resources?.length ?? 6;
    fireEvent.click(screen.getByTestId('repo-scoped-add-model'));
    persisted = (ws.meta?.[RESOURCES_META_KEY] ?? {}) as any;
    expect(persisted.resources.length).toBe(before + 1);
    const added = persisted.resources[persisted.resources.length - 1];
    expect(added.kind).toBe('model');
    expect(added.source).toBe('platform');
    expect(ws.traces.some((t) => t.tool === 'repo.scope.add' && t.ok)).toBe(true);
    expect(readAudit().some((a) => a.event === 'repos' && a.tool === 'repo.scope.add')).toBe(true);
  });
});
