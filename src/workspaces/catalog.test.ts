// T-27 FN-MKT-002/003 — pure helpers: 11 toggles + history + gating, v16/v20 templates.
import { describe, it, expect } from 'vitest';
import {
  AGENT_TEMPLATES,
  WORKSPACE_TOOLS,
  applyAgentTemplate,
  buildWorkspaceMetaPatch,
  diffTemplates,
  enabledToolCount,
  findTemplate,
  formatToggleEvent,
  gateReason,
  isEffectivelyEnabled,
  missingDeps,
  readWorkspaceState,
  recordProposal,
  recordSync,
  toggleWorkspaceTool,
  seedWorkspaceState,
  TEMPLATE_V16,
  TEMPLATE_V20,
  WORKSPACE_META_KEY,
  appendChatMessage,
  seedChat,
} from './catalog';

describe('workspace catalog (FN-MKT-002: 11 tools)', () => {
  it('ships exactly 11 workspace tools with unique ids', () => {
    expect(WORKSPACE_TOOLS).toHaveLength(11);
    expect(new Set(WORKSPACE_TOOLS.map((t) => t.id)).size).toBe(11);
    expect(WORKSPACE_TOOLS.map((t) => t.id)).toEqual([
      'workspace.read',
      'workspace.search',
      'workspace.git',
      'workspace.write',
      'workspace.edit',
      'workspace.lint',
      'workspace.test',
      'workspace.build',
      'workspace.sync',
      'workspace.propose',
      'workspace.deploy',
    ]);
  });

  it('toggle flips enablement and appends a newest-first history event without mutating input', () => {
    const seed = seedWorkspaceState();
    expect(enabledToolCount(seed)).toBe(7);
    const on = toggleWorkspaceTool(seed, 'workspace.build', true);
    expect(on.enabled['workspace.build']).toBe(true);
    expect(seed.enabled['workspace.build']).toBe(false); // input untouched
    expect(on.history).toHaveLength(1);
    expect(on.history[0].toolId).toBe('workspace.build');
    expect(on.history[0].enabled).toBe(true);
    expect(formatToggleEvent(on.history[0])).toContain('workspace.build → enabled');

    const off = toggleWorkspaceTool(on, 'workspace.build');
    expect(off.enabled['workspace.build']).toBe(false);
    expect(off.history).toHaveLength(2);
    expect(off.history[0].enabled).toBe(false); // newest first
    expect(off.history[1].enabled).toBe(true);

    // unknown ids are a no-op (still a copy)
    const same = toggleWorkspaceTool(seed, 'workspace.nope', true);
    expect(same.history).toHaveLength(0);
    expect(same.enabled).toEqual(seed.enabled);
    expect(same).not.toBe(seed);
  });

  it('enablement gating: deps must be effectively enabled (write needs read, deploy needs build+test)', () => {
    const seed = seedWorkspaceState();
    // seed: read on → write effectively on
    expect(isEffectivelyEnabled(seed, 'workspace.write')).toBe(true);
    // deploy is off by default and gated behind build+test
    expect(seed.enabled['workspace.deploy']).toBe(false);
    expect(isEffectivelyEnabled(seed, 'workspace.deploy')).toBe(false);
    expect(missingDeps(seed, 'workspace.deploy')).toEqual(expect.arrayContaining(['workspace.build']));
    expect(gateReason(seed, 'workspace.deploy')).toMatch(/workspace\.build/);

    // disabling read gates write + test even though their raw flags stay on
    const noRead = toggleWorkspaceTool(seed, 'workspace.read', false);
    expect(noRead.enabled['workspace.write']).toBe(true); // raw flag unchanged
    expect(isEffectivelyEnabled(noRead, 'workspace.write')).toBe(false);
    expect(missingDeps(noRead, 'workspace.write')).toEqual(['workspace.read']);

    // build→deploy chain: enabling both unblocks deploy flag but dep chain still needs build+test flags
    let withBuild = toggleWorkspaceTool(seed, 'workspace.build', true);
    withBuild = toggleWorkspaceTool(withBuild, 'workspace.deploy', true);
    expect(isEffectivelyEnabled(withBuild, 'workspace.deploy')).toBe(true);
    expect(gateReason(withBuild, 'workspace.deploy')).toBeNull();

    // propose needs write+git: disabling git gates it
    let withPropose = toggleWorkspaceTool(seed, 'workspace.propose', true);
    expect(isEffectivelyEnabled(withPropose, 'workspace.propose')).toBe(true);
    withPropose = toggleWorkspaceTool(withPropose, 'workspace.git', false);
    expect(isEffectivelyEnabled(withPropose, 'workspace.propose')).toBe(false);
    expect(missingDeps(withPropose, 'workspace.propose')).toEqual(['workspace.git']);
  });

  it('repo chrome: recordSync / recordProposal update stub state; readWorkspaceState round-trips', () => {
    const seed = seedWorkspaceState();
    const synced = recordSync(seed);
    expect(synced.repoLastSyncAt).toBeTruthy();
    expect(seed.repoLastSyncAt).toBeNull();
    const proposed = recordProposal(synced);
    expect(proposed.changesProposed).toBe(1);
    expect(proposed.repoLastSyncAt).toBe(synced.repoLastSyncAt);

    const patch = buildWorkspaceMetaPatch(proposed);
    const back = readWorkspaceState({ [WORKSPACE_META_KEY]: (patch[WORKSPACE_META_KEY] as any) });
    expect(back).toEqual(proposed);

    // empty meta → seed
    expect(readWorkspaceState({})).toEqual(seed);
    expect(readWorkspaceState(null)).toEqual(seed);
  });

  it('ephemeral chat: seed + append (blank ignored)', () => {
    const seed = seedChat();
    expect(seed.length).toBeGreaterThanOrEqual(2);
    const next = appendChatMessage(seed, '  hello workspace  ');
    expect(next[next.length - 1].text).toBe('hello workspace');
    expect(next[next.length - 1].role).toBe('user');
    expect(appendChatMessage(seed, '   ')).toHaveLength(seed.length);
    expect(seed).not.toContain(next[next.length - 1]);
  });
});

describe('tiered templates (FN-MKT-003: v16/v20)', () => {
  it('catalog carries versioned v16 (Object query) and v20 (8 tools + actions + automated + variables)', () => {
    expect(AGENT_TEMPLATES).toHaveLength(2);
    expect(TEMPLATE_V16.version).toBe(16);
    expect(TEMPLATE_V16.tier).toBe('intermediate');
    expect(TEMPLATE_V16.name).toBe('Object query');
    expect(TEMPLATE_V20.version).toBe(20);
    expect(TEMPLATE_V20.tier).toBe('advanced');
    expect(TEMPLATE_V20.tools).toHaveLength(8);
    expect(TEMPLATE_V20.ontologyActions.length).toBeGreaterThan(0);
    expect(TEMPLATE_V20.automated).toBe(true);
    expect(TEMPLATE_V20.variables.length).toBeGreaterThan(TEMPLATE_V16.variables.length);
    expect(findTemplate('template-v20-advanced')?.version).toBe(20);
    expect(findTemplate('nope')).toBeUndefined();
  });

  it('diffTemplates summarizes added/removed tools, actions, variables and the automated flip', () => {
    const diff = diffTemplates(TEMPLATE_V16, TEMPLATE_V20);
    expect(diff.addedTools).toEqual(['workspace.write', 'workspace.edit', 'workspace.test', 'ontology.list']);
    expect(diff.removedTools).toEqual([]);
    expect(diff.addedActions).toContain('ontology.update');
    expect(diff.addedActions).toContain('ontology.link');
    expect(diff.automatedChange).toBe('automated off → on');
    expect(diff.summary).toContain('v16 → v20');
    expect(diff.summary).toContain('+4 tools');
    // reverse diff is the inverse
    const back = diffTemplates(TEMPLATE_V20, TEMPLATE_V16);
    expect(back.removedTools).toEqual(diff.addedTools);
    expect(back.summary).toContain('v20 → v16');
  });

  it('Apply maps template tools onto the workspace enablement map and records history per change', () => {
    const seed = seedWorkspaceState();
    const applied = applyAgentTemplate(seed, TEMPLATE_V20);
    // v20 wants: read/search/write/edit/test on; git/lint/build/sync/propose/deploy off
    for (const id of ['workspace.read', 'workspace.search', 'workspace.write', 'workspace.edit', 'workspace.test']) {
      expect(applied.enabled[id]).toBe(true);
    }
    for (const id of ['workspace.git', 'workspace.lint', 'workspace.build', 'workspace.sync', 'workspace.propose', 'workspace.deploy']) {
      expect(applied.enabled[id]).toBe(false);
    }
    // input untouched
    expect(seed.enabled['workspace.git']).toBe(true);
    // history records each changed tool (git + lint flip off from the seed)
    expect(applied.history.length).toBeGreaterThanOrEqual(2);
    expect(applied.history.every((h) => h.detail?.includes('template-v20-advanced'))).toBe(true);

    // v16 apply: only read/search stay on among workspace tools
    const v16 = applyAgentTemplate(seed, TEMPLATE_V16);
    expect(v16.enabled['workspace.read']).toBe(true);
    expect(v16.enabled['workspace.search']).toBe(true);
    expect(v16.enabled['workspace.write']).toBe(false);
    expect(v16.enabled['workspace.deploy']).toBe(false);
  });
});
