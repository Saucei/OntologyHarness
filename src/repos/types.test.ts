// T-11 FN-AST-005/006/007/008 — pure helpers: provisioning, semver, checks, scoped imports.
import { describe, it, expect } from 'vitest';
import {
  addScopedResource,
  buildRepoMetaPatch,
  buildResourcesJson,
  buildResourcesMetaPatch,
  bumpSemver,
  compareSemver,
  countBySource,
  filterResources,
  formatCheckDuration,
  formatSemver,
  isSemverText,
  parseResourcesJson,
  parseSemver,
  readRepoLifecycleState,
  releasingLabel,
  repoTabLabel,
  resolveReleaseTarget,
  resourceCountsLabel,
  resourcesJsonPreview,
  runAllChecks,
  runCheck,
  sanitizeApiName,
  seedRepoLifecycleState,
  stringifyResourcesJson,
  summarizeChecks,
  toggleSelection,
  validateProvisioning,
  REPO_META_KEY,
  RESOURCES_META_KEY,
} from './types';

describe('repos provisioning (FN-AST-005: model + auto-import + bind + API name)', () => {
  it('seeds a valid provisioning form and validates fields + API slug', () => {
    const seed = seedRepoLifecycleState().provisioning;
    expect(validateProvisioning(seed)).toEqual([]);

    expect(validateProvisioning({ ...seed, agentName: '  ' })).toContain('Agent name is required');
    expect(validateProvisioning({ ...seed, bindOntologyId: '' })).toContain('Bind to ontology is required');
    expect(validateProvisioning({ ...seed, agentApiName: 'Bad Name!' })).toContain(
      'Agent API name must be a lowercase slug (a–z, 0–9, -) of length ≥3',
    );
    expect(validateProvisioning({ ...seed, agentApiName: 'ab' })).toHaveLength(1);
    expect(sanitizeApiName('Inventory Agent_007')).toBe('inventory-agent-007');
  });
});

describe('repos semver + release target (FN-AST-006: Patch/Minor/Major/Custom + branch|commit)', () => {
  it('parses and bumps semvers; custom requires valid text', () => {
    expect(parseSemver('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 });
    expect(parseSemver('v2.0.0')).toEqual({ major: 2, minor: 0, patch: 0 });
    expect(parseSemver('not-a-version')).toBeNull();
    expect(isSemverText('1.0.0')).toBe(true);

    const base = { major: 1, minor: 2, patch: 3 };
    expect(formatSemver(bumpSemver(base, 'patch')!)).toBe('1.2.4');
    expect(formatSemver(bumpSemver(base, 'minor')!)).toBe('1.3.0');
    expect(formatSemver(bumpSemver(base, 'major')!)).toBe('2.0.0');
    expect(formatSemver(bumpSemver(base, 'custom', '3.1.0')!)).toBe('3.1.0');
    expect(bumpSemver(base, 'custom', 'nope')).toBeNull();
    expect(releasingLabel({ major: 1, minor: 2, patch: 4 })).toBe('Releasing: 1.2.4');
    expect(compareSemver({ major: 1, minor: 2, patch: 4 }, base)).toBeGreaterThan(0);
    // input untouched
    expect(base).toEqual({ major: 1, minor: 2, patch: 3 });
  });

  it('resolves branch|commit targets to a readable ref', () => {
    expect(resolveReleaseTarget('branch', 'dev', 'abc')).toEqual({ kind: 'branch', branch: 'dev', ref: 'dev' });
    expect(resolveReleaseTarget('commit', 'dev', 'e4f5a6b')).toEqual({ kind: 'commit', commit: 'e4f5a6b', ref: 'e4f5a6b' });
  });
});

describe('repos checks (FN-AST-007: list + run + durations + tabs)', () => {
  it('formats durations, summarizes, and runs a check to SUCCEEDED without mutating input', () => {
    expect(formatCheckDuration(0)).toBe('—');
    expect(formatCheckDuration(120)).toBe('120 ms');
    expect(formatCheckDuration(1200)).toBe('1.2 s');
    expect(formatCheckDuration(123000)).toBe('2m 03s');

    const seed = seedRepoLifecycleState().checks;
    const summary = summarizeChecks(seed);
    expect(summary.total).toBe(seed.length);
    expect(summary.succeeded).toBeGreaterThanOrEqual(1);
    expect(summary.running).toBeGreaterThanOrEqual(1);

    expect(repoTabLabel('checks')).toBe('Checks');
    expect(repoTabLabel('prs')).toBe('PRs');

    const target = seed.find((c) => c.status === 'QUEUED');
    expect(target).toBeTruthy();
    const next = runCheck(seed, target!.id);
    const ran = next.find((c) => c.id === target!.id)!;
    expect(ran.status).toBe('SUCCEEDED');
    expect(ran.durationMs).toBeGreaterThan(0);
    // input untouched
    expect(seed.find((c) => c.id === target!.id)!.status).toBe('QUEUED');

    const all = runAllChecks(seed);
    expect(all.every((c) => c.status === 'SUCCEEDED')).toBe(true);
    expect(all.every((c) => c.durationMs > 0)).toBe(true);
  });
});

describe('repos scoped imports + resources.json (FN-AST-008)', () => {
  it('counts, filters, toggles selection and appends imports', () => {
    const resources = seedRepoLifecycleState().resources;
    expect(resources.length).toBeGreaterThanOrEqual(4);
    const bySource = countBySource(resources);
    expect(bySource.sdk + bySource.platform).toBe(resources.length);
    expect(resources.length).toBeGreaterThan(0);
    expect(resourceCountsLabel(resources)).toContain('imports');

    const sdkOnly = filterResources(resources, { source: 'sdk' });
    expect(sdkOnly.length).toBe(bySource.sdk);
    expect(sdkOnly.every((r) => r.source === 'sdk')).toBe(true);
    expect(filterResources(resources, { query: 'ontology' }).length).toBeGreaterThanOrEqual(1);

    expect(toggleSelection([], 'a')).toEqual(['a']);
    expect(toggleSelection(['a'], 'a')).toEqual([]);
    expect(toggleSelection(['a'], 'b')).toEqual(['a', 'b']);

    expect(addScopedResource(resources, { name: '  ', kind: 'model', source: 'sdk' })).toHaveLength(resources.length);
    const added = addScopedResource(resources, { name: 'sdk/new.ts', kind: 'resource-file', source: 'sdk' });
    expect(added).toHaveLength(resources.length + 1);
    expect(resources).toHaveLength(resources.length);
  });

  it('buildResourcesJson → stringify → parse round-trips; invalid input → null', () => {
    const state = seedRepoLifecycleState();
    const json = buildResourcesJson(state.resources, state.scopeSettings);
    const text = stringifyResourcesJson(json);
    const back = parseResourcesJson(text);
    expect(back).not.toBeNull();
    expect(back!.imports).toHaveLength(state.resources.length);
    expect(back!.settings).toEqual(state.scopeSettings);
    expect(back!.version).toBe('1.0.0');

    // bare-array form + object form both parse; bad input returns null
    expect(parseResourcesJson(JSON.stringify(state.resources))?.imports).toHaveLength(state.resources.length);
    expect(parseResourcesJson('not json')).toBeNull();
    expect(parseResourcesJson(null)).toBeNull();
    expect(resourcesJsonPreview(state.resources, state.scopeSettings)).toContain('"resources.json"'.length ? 'ontology/client.ts' : '');
  });

  it('meta patches round-trip through readRepoLifecycleState', () => {
    const seed = seedRepoLifecycleState();
    const next = {
      ...seed,
      provisioning: { ...seed.provisioning, agentApiName: 'custom-agent' },
      selectedResourceIds: ['res-sdk-file-1'],
    };
    const repoPatch = buildRepoMetaPatch(next);
    const resPatch = buildResourcesMetaPatch(next);
    expect(repoPatch[REPO_META_KEY]).toBeTruthy();
    expect(resPatch[RESOURCES_META_KEY]).toBeTruthy();
    const back = readRepoLifecycleState({ ...repoPatch, ...resPatch });
    expect(back.provisioning.agentApiName).toBe('custom-agent');
    expect(back.selectedResourceIds).toEqual(['res-sdk-file-1']);
    expect(back.resources).toHaveLength(seed.resources.length);
    // empty meta → seed
    expect(readRepoLifecycleState({}).provisioning).toEqual(seed.provisioning);
  });
});
