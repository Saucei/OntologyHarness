// RepoModule — FN-AST-005 (provisioning) + FN-AST-006 (tag & release)
// + FN-AST-007 (checks) + FN-AST-008 (scoped imports / resources.json).
// UNREGISTERED stub: exported for future registration only — do not touch registry.ts.
// Glass tokens only; light+dark parity via var(--*) tokens.
import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { appendAudit, appendTrace, patchMeta, ws } from '../store';
import { OBJECT_TYPES } from '../data/ontology';
import {
  BUMP_KINDS,
  PROVISIONING_MODELS,
  RELEASE_BRANCHES,
  RELEASE_COMMITS,
  REPO_TABS,
  SCOPE_TABS,
  buildRepoMetaPatch,
  buildResourcesMetaPatch,
  bumpSemver,
  addScopedResource,
  checkPill,
  countBySource,
  createReleaseRecord,
  filterResources,
  formatCheckDuration,
  formatSemver,
  readRepoLifecycleState,
  releasingLabel,
  repoTabLabel,
  resolveReleaseTarget,
  resourceCountsLabel,
  resourceKindLabel,
  resourcesJsonPreview,
  runAllChecks,
  runCheck,
  scopeTabLabel,
  summarizeChecks,
  toggleSelection,
  validateProvisioning,
  type BumpKind,
  type ProvisioningForm,
  type ReleaseTargetKind,
  type RepoLifecycleState,
  type RepoTab,
  type ResourceKind,
  type ScopeSource,
  type ScopeTab,
} from '../repos/types';

function logOp(tool: string, detail: string, ok = true) {
  try {
    appendTrace({ kind: 'tool-call', tool, ok, ms: 0, detail });
  } catch {
    /* ledger unavailable in some test envs — UI must not crash */
  }
  try {
    appendAudit({ event: 'repos', tool, detail, ok });
  } catch {
    /* audit unavailable — UI must not crash */
  }
}

export function RepoModule() {
  const [lifecycle, setLifecycle] = useState<RepoLifecycleState>(() => readRepoLifecycleState(ws.meta));
  const [draft, setDraft] = useState<ProvisioningForm>(() => ({ ...lifecycle.provisioning }));
  const [repoTab, setRepoTab] = useState<RepoTab>('checks');
  const [scopeTab, setScopeTab] = useState<ScopeTab>('sdk');
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [bump, setBump] = useState<BumpKind>('patch');
  const [customVersion, setCustomVersion] = useState('');
  const [targetKind, setTargetKind] = useState<ReleaseTargetKind>('branch');
  const [branch, setBranch] = useState<string>(RELEASE_BRANCHES[0] as string);
  const [commit, setCommit] = useState<string>(RELEASE_COMMITS[0] as string);
  const [msg, setMsg] = useState<string | null>(null);

  const draftErrors = useMemo(() => validateProvisioning(draft), [draft]);
  const previewVersion = useMemo(() => bumpSemver(lifecycle.currentVersion, bump, customVersion), [lifecycle.currentVersion, bump, customVersion]);
  const checksSummary = useMemo(() => summarizeChecks(lifecycle.checks), [lifecycle.checks]);
  const bySource = useMemo(() => countBySource(lifecycle.resources), [lifecycle.resources]);
  const visibleResources = useMemo(() => filterResources(lifecycle.resources, { source: scopeTab }), [lifecycle.resources, scopeTab]);
  const resourcesJson = useMemo(
    () => resourcesJsonPreview(lifecycle.resources, lifecycle.scopeSettings),
    [lifecycle.resources, lifecycle.scopeSettings],
  );
  const persistLifecycle = (next: RepoLifecycleState, tool: string, detail: string, ok = true) => {
    setLifecycle(next);
    patchMeta(buildRepoMetaPatch(next));
    patchMeta(buildResourcesMetaPatch(next));
    logOp(tool, detail, ok);
  };

  const setDraftField = (patch: Partial<ProvisioningForm>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  const onProvisioningSubmit = () => {
    const errors = validateProvisioning(draft);
    if (errors.length > 0) {
      setMsg(`Provisioning blocked — ${errors[0]}`);
      logOp('repo.provision.submit', `invalid: ${errors.join('; ')}`, false);
      return;
    }
    const next: RepoLifecycleState = { ...lifecycle, provisioning: { ...draft } };
    persistLifecycle(next, 'repo.provision.submit', `${draft.agentName.trim()} · ${draft.model.trim()} · api ${draft.agentApiName.trim()} · bind ${draft.bindOntologyId.trim()}${draft.autoImport ? ' · auto-import' : ''}`);
    setMsg(`Provisioned ${draft.agentName.trim()} (@ ${draft.model.trim()})`);
  };

  const onReleaseConfirm = () => {
    const version = previewVersion;
    if (!version) {
      setMsg('Tag-and-release blocked — enter a valid semver for a custom release');
      logOp('repo.release.confirm', `invalid custom version "${customVersion.trim()}"`, false);
      return;
    }
    const target = resolveReleaseTarget(targetKind, branch, commit);
    const record = createReleaseRecord({ version, bump, target });
    const next: RepoLifecycleState = {
      ...lifecycle,
      currentVersion: version,
      releases: [record, ...lifecycle.releases],
    };
    persistLifecycle(next, 'repo.release.confirm', `${releasingLabel(version)} · ${target.kind} ${target.ref} · bump ${bump}`);
    setReleaseOpen(false);
    setMsg(`${releasingLabel(version)} (${target.kind} ${target.ref})`);
  };

  const onRunCheck = (id: string) => {
    const target = lifecycle.checks.find((c) => c.id === id);
    if (!target) return;
    const next: RepoLifecycleState = { ...lifecycle, checks: runCheck(lifecycle.checks, id) };
    persistLifecycle(next, 'repo.checks.run', `${target.name} → SUCCEEDED (${formatCheckDuration(1200)})`);
    setMsg(`Ran ${target.name} — SUCCEEDED`);
  };

  const onRunAllChecks = () => {
    const next: RepoLifecycleState = { ...lifecycle, checks: runAllChecks(lifecycle.checks) };
    persistLifecycle(next, 'repo.checks.runAll', `${next.checks.filter((c) => c.status === 'SUCCEEDED').length}/${next.checks.length} checks succeeded`);
    setMsg(`Ran all checks — ${next.checks.length} succeeded`);
  };

  const onToggleScopeSetting = (key: 'scopedModeEnabled' | 'allowDefaultScope', value: boolean) => {
    const next: RepoLifecycleState = { ...lifecycle, scopeSettings: { ...lifecycle.scopeSettings, [key]: value } };
    persistLifecycle(next, 'repo.scope.setting', `${key} → ${value ? 'on' : 'off'}`);
  };

  const onToggleResource = (id: string) => {
    const next: RepoLifecycleState = { ...lifecycle, selectedResourceIds: toggleSelection(lifecycle.selectedResourceIds, id) };
    persistLifecycle(next, 'repo.scope.select', `${id} ${next.selectedResourceIds.includes(id) ? 'selected' : 'deselected'} (${next.selectedResourceIds.length} selected)`);
  };

  const onAddScoped = (kind: ResourceKind) => {
    const label = kind === 'resource-file' ? 'resource-file' : 'model';
    const source: ScopeSource = scopeTab;
    const next: RepoLifecycleState = {
      ...lifecycle,
      resources: addScopedResource(lifecycle.resources, { name: `${label}/new-import-${lifecycle.resources.length + 1}.json`, kind, source }),
    };
    persistLifecycle(next, 'repo.scope.add', `${resourceKindLabel(kind)} → ${source} (${next.resources.length} imports)`);
    setMsg(`Added ${resourceKindLabel(kind)} to ${scopeTabLabel(source)}`);
  };

  return (
    <div className="module fade-in" data-testid="repo-module" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="module-head glass-strong">
        <div>
          <div className="module-title">
            <Icon name="server" size={18} /> Repo Lifecycle
          </div>
          <div className="module-sub" data-testid="repo-head-sub">
            Provisioning · Tag &amp; release · Checks · Scoped imports · v{formatSemver(lifecycle.currentVersion)} · {lifecycle.releases.length} releases · {lifecycle.resources.length} imports
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          <span className="chip chip-mono" data-testid="repo-current-version">v{formatSemver(lifecycle.currentVersion)}</span>
          <span className="chip">FN-AST-005..008</span>
        </div>
      </div>

      {msg && (
        <div role="status" data-testid="repo-status" className="chip" style={{ alignSelf: 'flex-start' }}>
          {msg}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, alignItems: 'start' }}>
        {/* ——— FN-AST-005: Provisioning form ——— */}
        <section className="glass panel" data-testid="repo-provisioning" aria-label="Repo provisioning" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="panel-title">
            <span>Provision repo · Model + Auto-import + bind + Agent API</span>
            <span className="chip">FN-AST-005</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label className="label" htmlFor="repo-form-model">Model</label>
            <select
              id="repo-form-model"
              className="input"
              style={{ padding: '6px 8px', fontSize: 11 }}
              aria-label="Model"
              data-testid="repo-form-model"
              value={draft.model}
              onChange={(e) => setDraftField({ model: e.target.value })}
            >
              {PROVISIONING_MODELS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>

            <label className="label" htmlFor="repo-form-agent-name">Agent name</label>
            <input
              id="repo-form-agent-name"
              className="input"
              style={{ padding: '6px 8px', fontSize: 11 }}
              placeholder="Inventory Agent"
              aria-label="Agent name"
              data-testid="repo-form-agent-name"
              value={draft.agentName}
              onChange={(e) => setDraftField({ agentName: e.target.value })}
            />

            <label className="label" htmlFor="repo-form-agent-location">Agent location</label>
            <input
              id="repo-form-agent-location"
              className="input"
              style={{ padding: '6px 8px', fontSize: 11 }}
              placeholder="ws/agents/inventory-agent"
              aria-label="Agent location"
              data-testid="repo-form-agent-location"
              value={draft.agentLocation}
              onChange={(e) => setDraftField({ agentLocation: e.target.value })}
            />

            <label className="label" htmlFor="repo-form-bind">Bind to ontology</label>
            <select
              id="repo-form-bind"
              className="input"
              style={{ padding: '6px 8px', fontSize: 11 }}
              aria-label="Bind to ontology"
              data-testid="repo-form-bind"
              value={draft.bindOntologyId}
              onChange={(e) => setDraftField({ bindOntologyId: e.target.value })}
            >
              <option value="">Select object type…</option>
              {OBJECT_TYPES.map((t) => (
                <option key={t.id} value={t.id}>{t.name} ({t.id})</option>
              ))}
            </select>

            <label className="label" htmlFor="repo-form-api-name">Agent API name</label>
            <input
              id="repo-form-api-name"
              className="input"
              style={{ padding: '6px 8px', fontSize: 11 }}
              placeholder="inventory-agent"
              aria-label="Agent API name"
              data-testid="repo-form-api-name"
              value={draft.agentApiName}
              onChange={(e) => setDraftField({ agentApiName: e.target.value })}
            />

            <label className="glass-faint" style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '7px 9px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                aria-label="Auto-import"
                data-testid="repo-form-autoimport"
                checked={draft.autoImport}
                onChange={(e) => setDraftField({ autoImport: e.target.checked })}
              />
              <span style={{ fontSize: 11.5, fontWeight: 700 }}>Auto-import</span>
              <span className="module-sub" style={{ margin: 0 }}>Import ontology objects on provision</span>
            </label>

            {draftErrors.length > 0 && (
              <ul data-testid="repo-provision-errors" style={{ margin: '4px 0 0', padding: '0 0 0 16px', fontSize: 10.5, color: 'var(--danger)' }}>
                {draftErrors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}

            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6 }}>
              <button type="button" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} aria-label="Provision repo" data-testid="repo-provision-submit" onClick={onProvisioningSubmit}>
                <Icon name="check" size={12} /> Provision repo
              </button>
              <span className="chip chip-mono">{draft.autoImport ? 'auto-import' : 'manual'}</span>
            </div>
          </div>
        </section>

        {/* ——— FN-AST-006: Tag & release ——— */}
        <section className="glass panel" data-testid="repo-release" aria-label="Tag and release" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="panel-title">
            <span>Tag &amp; release · current v{formatSemver(lifecycle.currentVersion)}</span>
            <span className="chip">FN-AST-006</span>
          </div>
          <p className="module-sub" style={{ margin: '0 0 8px' }}>
            Semver bump (Patch / Minor / Major / Custom) against a branch or commit. Confirming appends a release record and bumps the current version.
          </p>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary" aria-label="Tag and release" data-testid="repo-release-open" onClick={() => { setReleaseOpen(true); logOp('repo.release.open', `current v${formatSemver(lifecycle.currentVersion)}`); }}>
              <Icon name="arrow" size={12} /> Tag &amp; release
            </button>
            <span className="chip chip-mono">{lifecycle.releases.length} releases</span>
          </div>
          {lifecycle.releases.length === 0 ? (
            <p className="module-sub" style={{ marginTop: 8 }}>No releases yet — open the modal to cut the first tag.</p>
          ) : (
            <ul data-testid="repo-release-list" style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 180, overflow: 'auto' }}>
              {lifecycle.releases.map((r) => (
                <li key={r.id} data-testid={`repo-release-item-${r.id}`} className="glass-faint" style={{ padding: '5px 8px', fontSize: 11 }}>
                  <code className="chip chip-mono" style={{ fontSize: 9 }}>v{r.version}</code>{' '}
                  {r.bump} · {r.target.kind} {r.target.ref}
                  <span className="module-sub chip-mono" style={{ display: 'block', fontSize: 9 }}>{r.at}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ——— FN-AST-007: Checks tab ——— */}
      <section className="glass panel" data-testid="repo-checks" aria-label="Repository checks" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="panel-title">
          <span>Repository · Checks, Branches, PRs, Tags, Settings</span>
          <span className="chip">FN-AST-007</span>
        </div>
        <div data-testid="repo-tabs" role="tablist" aria-label="Repository tabs" style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
          {REPO_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={repoTab === tab}
              aria-label={`${repoTabLabel(tab)} tab`}
              data-testid={`repo-tab-${tab}`}
              className={repoTab === tab ? 'btn' : 'btn btn-ghost'}
              style={{ padding: '4px 10px', fontSize: 10 }}
              onClick={() => { setRepoTab(tab); logOp('repo.tab.select', tab); }}
            >
              {repoTabLabel(tab)}
            </button>
          ))}
          <span className="chip chip-mono" style={{ marginLeft: 'auto' }} data-testid="repo-checks-summary">
            {checksSummary.succeeded}/{checksSummary.total} succeeded · {checksSummary.running} running · {checksSummary.failed} failed
          </span>
        </div>

        {repoTab === 'checks' && (
          <div data-testid="repo-checks-panel" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button type="button" className="btn" style={{ padding: '4px 10px', fontSize: 10 }} aria-label="Run all checks" data-testid="repo-checks-run-all" onClick={onRunAllChecks}>
                <Icon name="refresh" size={12} /> Run all
              </button>
              <span className="module-sub" style={{ margin: 0 }}>Each row shows a status dot + duration — Run flips it to SUCCEEDED.</span>
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {lifecycle.checks.map((c) => (
                <li key={c.id} data-testid={`repo-check-row-${c.id}`} className="glass-faint" style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '7px 9px' }}>
                  <span aria-hidden className="dot" style={{ background: c.status === 'SUCCEEDED' ? 'var(--green-600)' : c.status === 'RUNNING' ? 'var(--warn)' : c.status === 'FAILED' ? 'var(--danger)' : 'var(--text-faint)' }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ fontSize: 11.5 }}>{c.name}</strong>
                    {c.detail && <span className="module-sub"> · {c.detail}</span>}
                    <span className={checkPill(c.status)} style={{ marginLeft: 6 }}>{c.status}</span>
                  </span>
                  <span className="chip chip-mono" data-testid={`repo-check-duration-${c.id}`}>{formatCheckDuration(c.durationMs)}</span>
                  <button type="button" className="btn btn-primary" style={{ padding: '4px 10px', fontSize: 10 }} aria-label={`Run ${c.name}`} data-testid={`repo-check-run-${c.id}`} onClick={() => onRunCheck(c.id)}>
                    <Icon name="arrow" size={12} /> Run
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {repoTab !== 'checks' && (
          <p className="module-sub" data-testid={`repo-tab-panel-${repoTab}`} style={{ margin: 0 }}>
            {repoTab === 'branches' && `Branches — main · dev · staging (from ${RELEASE_BRANCHES.join(', ')})`}
            {repoTab === 'prs' && 'PRs — no open pull requests in this mock repo.'}
            {repoTab === 'tags' && `Tags — ${lifecycle.releases.length ? lifecycle.releases.map((r) => `v${r.version}`).join(', ') : `current v${formatSemver(lifecycle.currentVersion)} (no tags yet)`}`}
            {repoTab === 'settings' && `Settings — repo ${draft.agentName.trim() || 'unnamed'} · ${draft.model.trim()} · auto-import ${draft.autoImport ? 'on' : 'off'}`}
          </p>
        )}
      </section>

      {/* ——— FN-AST-008: Scoped imports console ——— */}
      <section className="glass panel" data-testid="repo-scoped" aria-label="Scoped imports console" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="panel-title">
          <span>Scoped imports · {resourceCountsLabel(lifecycle.resources)}</span>
          <span className="chip">FN-AST-008</span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
          <div role="tablist" aria-label="Scoped imports source" data-testid="repo-scope-tabs" style={{ display: 'flex', gap: 4 }}>
            {SCOPE_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={scopeTab === tab}
                aria-label={`${scopeTabLabel(tab)} imports`}
                data-testid={`repo-scope-tab-${tab}`}
                className={scopeTab === tab ? 'btn' : 'btn btn-ghost'}
                style={{ padding: '4px 10px', fontSize: 10 }}
                onClick={() => { setScopeTab(tab); logOp('repo.scope.tab', tab); }}
              >
                {scopeTabLabel(tab)} · {bySource[tab]}
              </button>
            ))}
          </div>
          <span className="chip chip-mono" data-testid="repo-scoped-counts" style={{ marginLeft: 'auto' }}>
            {lifecycle.resources.length} total · {lifecycle.selectedResourceIds.length} selected
          </span>
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
          <button type="button" className="btn" style={{ padding: '4px 10px', fontSize: 10 }} aria-label="Add resource file" data-testid="repo-scoped-add-file" onClick={() => onAddScoped('resource-file')}>
            <Icon name="plus" size={12} /> Add Resource File
          </button>
          <button type="button" className="btn" style={{ padding: '4px 10px', fontSize: 10 }} aria-label="Add model" data-testid="repo-scoped-add-model" onClick={() => onAddScoped('model')}>
            <Icon name="plus" size={12} /> Add Model
          </button>
          <span className="module-sub" style={{ margin: 0 }}>Adds to the {scopeTabLabel(scopeTab)} tab.</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
            <label className="glass-faint" style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '7px 9px', cursor: 'pointer' }}>
              <input type="checkbox" aria-label="Enable scoped mode" data-testid="repo-scope-enabled" checked={lifecycle.scopeSettings.scopedModeEnabled} onChange={(e) => onToggleScopeSetting('scopedModeEnabled', e.target.checked)} />
              <span style={{ fontSize: 11.5, fontWeight: 700 }}>Enable scoped mode</span>
            </label>
            <label className="glass-faint" style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '7px 9px', cursor: 'pointer' }}>
              <input type="checkbox" aria-label="Allow default scope" data-testid="repo-scope-allow-default" checked={lifecycle.scopeSettings.allowDefaultScope} onChange={(e) => onToggleScopeSetting('allowDefaultScope', e.target.checked)} />
              <span style={{ fontSize: 11.5, fontWeight: 700 }}>Allow default scope</span>
            </label>

            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflow: 'auto' }}>
              {visibleResources.map((r) => (
                <li key={r.id} data-testid={`repo-scoped-row-${r.id}`} className="glass-faint" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '7px 9px' }}>
                  <input
                    type="checkbox"
                    aria-label={`Select ${r.name}`}
                    data-testid={`repo-scoped-toggle-${r.id}`}
                    checked={lifecycle.selectedResourceIds.includes(r.id)}
                    onChange={() => onToggleResource(r.id)}
                    style={{ marginTop: 2 }}
                  />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <code className="chip chip-mono" style={{ fontSize: 9 }}>{r.name}</code>
                    <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                      <span className="chip chip-mono" style={{ fontSize: 9 }}>{resourceKindLabel(r.kind)}</span>
                      <span className="chip chip-mono" style={{ fontSize: 9 }}>{r.scope}</span>
                      <span className="chip chip-mono" style={{ fontSize: 9 }}>{scopeTabLabel(r.source)}</span>
                      {r.version && <span className="chip chip-mono" style={{ fontSize: 9 }}>v{r.version}</span>}
                    </span>
                  </span>
                </li>
              ))}
              {visibleResources.length === 0 && (
                <li className="module-sub" style={{ margin: 0 }}>No imports on this tab yet.</li>
              )}
            </ul>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700 }}>resources.json</span>
              <code className="chip chip-mono" style={{ fontSize: 9 }}>{lifecycle.scopeSettings.resourcesJsonPath}</code>
              <span className="module-sub" style={{ marginLeft: 'auto' }}>scoped {lifecycle.scopeSettings.scopedModeEnabled ? 'on' : 'off'} · default {lifecycle.scopeSettings.allowDefaultScope ? 'allowed' : 'blocked'}</span>
            </div>
            <pre data-testid="repo-scope-json" aria-label="resources.json preview" style={{ margin: 0, padding: 10, borderRadius: 'var(--r-sm)', border: '1px solid var(--glass-border)', background: 'var(--glass-bg-strong)', fontFamily: 'var(--font-mono)', fontSize: 10, lineHeight: 1.55, maxHeight: 300, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--text)' }}>
              {resourcesJson}
            </pre>
          </div>
        </div>
      </section>

      {/* ——— FN-AST-006: semver modal ——— */}
      {releaseOpen && (
        <div data-testid="repo-release-modal" role="dialog" aria-modal="true" aria-label="Tag and release" style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'var(--glass-bg-faint)', backdropFilter: 'var(--glass-blur)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="glass-strong" style={{ width: 440, maxWidth: '94vw', padding: 16, borderRadius: 'var(--r-md)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <strong style={{ fontSize: 13 }}>Tag &amp; release</strong>
              <button type="button" className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 10 }} aria-label="Close release modal" data-testid="repo-release-cancel" onClick={() => { setReleaseOpen(false); logOp('repo.release.cancel', 'modal closed'); }}>
                <Icon name="x" size={12} /> Close
              </button>
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {BUMP_KINDS.map((kind) => (
                <label key={kind} className="glass-faint" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', padding: '5px 9px', cursor: 'pointer', fontSize: 11, textTransform: 'capitalize' }}>
                  <input type="radio" name="repo-bump" aria-label={`Bump ${kind}`} data-testid={`repo-release-bump-${kind}`} checked={bump === kind} onChange={() => setBump(kind)} />
                  {kind}
                </label>
              ))}
            </div>
            {bump === 'custom' && (
              <>
                <label className="label" htmlFor="repo-release-custom">Custom version</label>
                <input id="repo-release-custom" className="input" style={{ padding: '6px 8px', fontSize: 11 }} placeholder="1.3.0" aria-label="Custom version" data-testid="repo-release-custom" value={customVersion} onChange={(e) => setCustomVersion(e.target.value)} />
              </>
            )}
            <label className="label" htmlFor="repo-release-target-kind">Release from</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <select id="repo-release-target-kind" className="input" style={{ width: 140, padding: '6px 8px', fontSize: 11 }} aria-label="Release target kind" data-testid="repo-release-target-kind" value={targetKind} onChange={(e) => setTargetKind(e.target.value as ReleaseTargetKind)}>
                <option value="branch">Branch</option>
                <option value="commit">Commit</option>
              </select>
              {targetKind === 'branch' ? (
                <select aria-label="Release branch" data-testid="repo-release-branch" className="input" style={{ padding: '6px 8px', fontSize: 11 }} value={branch} onChange={(e) => setBranch(e.target.value)}>
                  {RELEASE_BRANCHES.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              ) : (
                <select aria-label="Release commit" data-testid="repo-release-commit" className="input" style={{ padding: '6px 8px', fontSize: 11 }} value={commit} onChange={(e) => setCommit(e.target.value)}>
                  {RELEASE_COMMITS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              )}
            </div>
            <div data-testid="repo-release-preview" className="glass-faint" style={{ padding: '8px 10px', fontSize: 12, fontWeight: 700 }} aria-live="polite">
              {previewVersion ? releasingLabel(previewVersion) : 'Invalid version — enter a valid custom semver'}
            </div>
            {bump === 'custom' && !previewVersion && (
              <p data-testid="repo-release-error" style={{ margin: 0, fontSize: 10.5, color: 'var(--danger)' }}>Custom version must be `x.y.z`.</p>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn" aria-label="Cancel release" onClick={() => { setReleaseOpen(false); logOp('repo.release.cancel', 'modal cancelled'); }}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" aria-label="Confirm release" data-testid="repo-release-confirm" onClick={onReleaseConfirm}>
                <Icon name="check" size={12} /> Release
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Future registry entry — UNREGISTERED in this slice (do not import in registry.ts). */
export const repoModuleDefinition = {
  id: 'repos',
  label: 'Repo Lifecycle',
  hint: 'Provisioning · Tag & release · Checks · Scoped imports',
  section: 'WORK' as const,
  layer: 'L3-FOUNDRY' as const,
  Component: RepoModule,
};

export default RepoModule;
