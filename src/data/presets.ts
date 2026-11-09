// Preset schema v2 — one preset = prompt + tools + worker + output schema.
export type PresetMode = { id: string; label: string; tools: string[] }
export type Preset = {
  id: string; name: string; desc: string; icon: string
  /** 'dataset' prompts for a dataset picker; omitted = free-text question */
  needsInput?: 'dataset' | 'question'
  systemPrompt: string
  userTemplate: string
  tools: string[]
  workerId: string
  outputSchema?: string
  builtin?: boolean
  /** Tool-carrying modes (FN-FDE-004 ribbon counts; L1 schema ext. per HARNESS_CHANGE_MAP). */
  modes?: PresetMode[]
  /** Skill Set Configurations (FN-FDE-007) — optional; presets without skills still load. */
  skills?: Skill[]
  /** Documentation attach bags (FN-FDE-008) — optional; presets without bags still load. */
  documentationBags?: DocumentationBag[]
  /** FN-FDE-012 gallery provenance — set when a template Apply forks/updates this preset. */
  sourcePresetId?: string
  promptTemplateId?: string
}

/** One curated skill row in the Skill Set Configurations modal (FN-FDE-007). */
export type Skill = {
  id: string
  label: string
  description: string
  enabled: boolean
}

/** One attachable documentation bundle/page (FN-FDE-008). */
export type DocumentationBag = {
  id: string
  label: string
  kind: 'custom' | 'foundry'
  enabled: boolean
}

export const PRESET_SEED: Preset[] = [
  { id: 'p-1', name: 'Dataset Triage', needsInput: 'dataset', icon: 'table',
    desc: 'Profile, type-check and dedup an incoming dataset; flag schema drift against the ontology.',
    systemPrompt: 'You are a data-quality agent. Given dataset profile facts, output: (1) schema drift vs ontology, (2) null/outlier issues, (3) dedup estimate, (4) 3 recommended actions. Terse bullets.',
    userTemplate: 'Profile this dataset and triage it against our ontology:\n{{DATASET}}',
    tools: ['corpus.search', 'graph.query'], workerId: 'wk-scribe', outputSchema: 'triage-report', builtin: true,
    modes: [
      { id: 'explore', label: 'Exploration', tools: ['corpus.search', 'graph.query'] },
      { id: 'govern', label: 'Governance', tools: ['ontology.list'] },
    ],
    skills: [
      { id: 'skill-triage', label: 'Dataset Triage', description: 'Profile null/outlier/drift and rank fixes.', enabled: true },
      { id: 'skill-lineage', label: 'Lineage Trace', description: 'Walk upstream/downstream and verify hashes.', enabled: true },
      { id: 'skill-ontology', label: 'Ontology Propose', description: 'Draft object/link types from a raw schema.', enabled: true },
      { id: 'skill-report', label: 'Report Writer', description: 'Assemble terse evidence-first reports.', enabled: false },
    ],
    documentationBags: [
      { id: 'docs-custom-triage', label: 'Triage runbook', kind: 'custom', enabled: true },
      { id: 'docs-custom-ontology', label: 'Ontology notes', kind: 'custom', enabled: true },
      { id: 'docs-custom-lineage', label: 'Lineage checklist', kind: 'custom', enabled: true },
      { id: 'docs-custom-runbook', label: 'Agent runbook', kind: 'custom', enabled: true },
      { id: 'docs-foundry-models', label: 'Model catalog docs', kind: 'foundry', enabled: true },
      { id: 'docs-foundry-graph', label: 'Graph query pages', kind: 'foundry', enabled: true },
      { id: 'docs-foundry-pipeline', label: 'Pipeline guides', kind: 'foundry', enabled: true },
      { id: 'docs-foundry-workshop', label: 'Workshop docs', kind: 'foundry', enabled: true },
    ] },
  { id: 'p-2', name: 'Ontology Alignment', needsInput: 'dataset', icon: 'cube',
    desc: 'Propose object/link types and value types from a raw schema.',
    systemPrompt: 'You are a knowledge engineer. Propose Object Types, Link Types and Value Types for the dataset. Output as compact YAML.',
    userTemplate: 'Propose ontology mappings for:\n{{DATASET}}',
    tools: ['ontology.get', 'ontology.list'], workerId: 'wk-sage', outputSchema: 'ontology-yaml', builtin: true,
    modes: [
      { id: 'transform', label: 'Transform data', tools: ['ontology.get', 'aip.preview'] },
      { id: 'modify-ontology', label: 'Modify ontology', tools: ['ontology.get', 'ontology.list'] },
    ] },
  { id: 'p-3', name: 'Lineage Audit', needsInput: 'question', icon: 'graph',
    desc: 'Trace upstream/downstream relations; verify hash & freshness SLAs.',
    systemPrompt: 'You are a lineage auditor. Trace the given object/product through the lineage graph; output relations verified, hash matches, freshness SLA status, and any breaks.',
    userTemplate: 'Audit lineage for: {{QUESTION}}',
    tools: ['graph.query'], workerId: 'wk-watchman', outputSchema: 'audit-matrix', builtin: true },
  { id: 'p-4', name: 'AIP Logic Draft', needsInput: 'question', icon: 'spark',
    desc: 'Generate a Logic function + test set from a plain-language spec.',
    systemPrompt: 'You are an AIP Logic author. Draft the logic function (retrieval, prompt, output schema) and 3 eval cases from the spec. Output: SYSTEM PROMPT · OUTPUT SCHEMA · EVALS.',
    userTemplate: 'Draft the logic function for: {{QUESTION}}',
    tools: ['aip.preview'], workerId: 'wk-sage', outputSchema: 'logic-draft', builtin: true,
    modes: [{ id: 'write-functions', label: 'Write functions', tools: ['pipeline.run', 'graph.query'] }] },
  { id: 'p-5', name: 'Workshop Module Review', needsInput: 'dataset', icon: 'workshop',
    desc: 'Pre-publish review: bindings, layout, a11y, blocking issues.',
    systemPrompt: 'You are a Workshop reviewer. Review the module config: binding integrity, object sets, layout, publish blockers. Output verdict + blocking fixes.',
    userTemplate: 'Review this Workshop module:\n{{DATASET}}',
    tools: ['corpus.search'], workerId: 'wk-sentinel', outputSchema: 'review-verdict', builtin: true,
    modes: [{ id: 'osdk-react', label: 'OSDK React', tools: ['workshop.publish', 'corpus.search'] }] },
  { id: 'p-6', name: 'Data Quality Sweep', needsInput: 'dataset', icon: 'filter',
    desc: 'NULL/outlier/distribution/constraint scorecard per dataset.',
    systemPrompt: 'You are a DQ sweep agent. Produce a scorecard: null %, distinct counts, outliers, failed constraints. Output one row per failing check.',
    userTemplate: 'Score this dataset for data quality:\n{{DATASET}}',
    tools: ['corpus.search'], workerId: 'wk-sentinel', outputSchema: 'dq-scorecard', builtin: true },
  { id: 'p-7', name: 'Executive Summary', needsInput: 'question', icon: 'doc',
    desc: 'One-page brief of runs, jobs and lineage changes this week.',
    systemPrompt: 'You are an exec-brief writer. One page: completed jobs, blocked items, cost, top risks. Cite job IDs. No speculation.',
    userTemplate: 'Write this week’s exec brief focusing on: {{QUESTION}}',
    tools: ['corpus.search'], workerId: 'wk-herald', outputSchema: 'briefing', builtin: true },
  { id: 'p-8', name: 'Pipeline PR Review', needsInput: 'question', icon: 'pipeline',
    desc: 'Review a transform diff: schema safety, perf, rollback plan.',
    systemPrompt: 'You are a pipeline reviewer. Assess schema safety, performance, rollback. Output approve/request-changes + top 3 risks.',
    userTemplate: 'Review this pipeline diff: {{QUESTION}}',
    tools: ['pipeline.run'], workerId: 'wk-forge', outputSchema: 'review-comments', builtin: true,
    modes: [{ id: 'platform-qa', label: 'Platform Q&A', tools: ['pipeline.run', 'workshop.publish'] }] },
]

/** Validate a preset definition (used on fork/save and in tests). */
export function validatePreset(p: Partial<Preset>): { ok: boolean; errors: string[] } {
  const errors: string[] = []
  if (!p.id?.trim()) errors.push('id required')
  if (!p.name?.trim()) errors.push('name required')
  if (!p.systemPrompt?.trim() || p.systemPrompt.length < 20) errors.push('systemPrompt too short (≥20 chars)')
  if (!p.userTemplate?.trim() || !/\{\{(DATASET|QUESTION)\}\}/.test(p.userTemplate)) errors.push('userTemplate must contain {{DATASET}} or {{QUESTION}}')
  if (!p.tools?.length) errors.push('at least one tool required')
  if (!p.workerId?.trim()) errors.push('workerId required')
  return { ok: errors.length === 0, errors }
}

/** Compose the effective prompt from template + chosen inputs. */
export function composePrompt(p: Preset, datasetJson?: string, question?: string): { system: string; user: string } {
  const body = p.userTemplate
    .replace('{{DATASET}}', datasetJson ?? '(no dataset attached)')
    .replace('{{QUESTION}}', question ?? '(no question provided)')
  return { system: p.systemPrompt, user: body }
}

/** Composer attachment ribbon types (FN-FDE-004). Totals = available picks per type. */
export type RibbonTypeId = 'modes' | 'skills' | 'documentation' | 'files' | 'ontology' | 'functions'
export type RibbonType = { id: RibbonTypeId; label: string; icon: string; total: number }
export const RIBBON_TYPES: RibbonType[] = [
  { id: 'modes', label: 'Modes', icon: 'layers', total: 8 },
  { id: 'skills', label: 'Skills', icon: 'spark', total: 8 },
  { id: 'documentation', label: 'Documentation', icon: 'doc', total: 8 },
  { id: 'files', label: 'Files', icon: 'database', total: 8 },
  { id: 'ontology', label: 'Ontology', icon: 'cube', total: 8 },
  { id: 'functions', label: 'Functions', icon: 'button', total: 8 },
]

/** "0/8"-style per-type count chip text. */
export function formatRibbonCount(selected: number, total: number): string {
  const sel = Math.max(0, Math.min(selected, total))
  return `${sel}/${total}`
}

/** Total unique tools carried by preset modes (the lit ribbon pill — seeds sum to 7). */
export function ribbonTotalTools(presets: Preset[] = PRESET_SEED): number {
  const tools = new Set<string>()
  for (const p of presets) for (const m of p.modes ?? []) for (const t of m.tools) tools.add(t)
  return tools.size
}

/** Per-type count rows for the ribbon footer. */
export function ribbonCounts(selected: Partial<Record<RibbonTypeId, number>> = {}) {
  return RIBBON_TYPES.map(t => {
    const sel = Math.max(0, selected[t.id] ?? 0)
    return { id: t.id, label: t.label, icon: t.icon, selected: sel, total: t.total, text: formatRibbonCount(sel, t.total) }
  })
}

/* ── FN-FDE-007/008 skill + documentation helpers ──────────────────
   Pure, additive: presets that predate skills/documentationBags still
   load — the bank defaults to empty (counts 0), never to throws. */

/** Defensive copy of a preset's skills; [] when the preset has none. */
export function presetSkills(preset?: Preset | null): Skill[] {
  return (preset?.skills ?? []).map(s => ({ ...s }))
}

/** Set one skill's enabled flag; returns a new array (never mutates). */
export function setSkillEnabled(skills: Skill[], id: string, enabled: boolean): Skill[]
/** Preset form: set one skill's enabled flag by preset, returning the new skill list. */
export function setSkillEnabled(preset: Preset | null | undefined, id: string, enabled: boolean): Skill[]
export function setSkillEnabled(
  input: Skill[] | Preset | null | undefined,
  id: string,
  enabled: boolean,
): Skill[] {
  const list = Array.isArray(input) ? input : presetSkills(input as Preset | null | undefined)
  return list.map(s => (s.id === id ? { ...s, enabled } : s))
}

/** Defensive copy of a preset's documentation bags; [] when the preset has none. */
export function presetDocBags(preset?: Preset | null): DocumentationBag[] {
  return (preset?.documentationBags ?? []).map(b => ({ ...b }))
}

/** Attach/detach one documentation bag; returns a new array (never mutates). */
export function setDocBagEnabled(bags: DocumentationBag[], id: string, enabled: boolean): DocumentationBag[]
/** Preset form: attach/detach one bag by preset, returning the new bag list. */
export function setDocBagEnabled(preset: Preset | null | undefined, id: string, enabled: boolean): DocumentationBag[]
export function setDocBagEnabled(
  input: DocumentationBag[] | Preset | null | undefined,
  id: string,
  enabled: boolean,
): DocumentationBag[] {
  const list = Array.isArray(input) ? input : presetDocBags(input as Preset | null | undefined)
  return list.map(b => (b.id === id ? { ...b, enabled } : b))
}

/** Enabled skills in a list (or a preset). */
export function skillsCount(skills: Skill[]): number
export function skillsCount(preset: Preset | null | undefined): number
export function skillsCount(input: Skill[] | Preset | null | undefined): number {
  const list = Array.isArray(input) ? input : presetSkills(input as Preset | null | undefined)
  return list.filter(s => s.enabled).length
}

/** Enabled documentation bags in a list (or a preset). */
export function docsCount(bags: DocumentationBag[]): number
export function docsCount(preset: Preset | null | undefined): number
export function docsCount(input: DocumentationBag[] | Preset | null | undefined): number {
  const list = Array.isArray(input) ? input : presetDocBags(input as Preset | null | undefined)
  return list.filter(b => b.enabled).length
}

/* ── FN-FDE-005 Modes (tool-carrying) helpers ───────────────────────
   Modes are sourced from PresetMode sets carried by presets — never a
   duplicated tool list. Tool counts are computed in permissions.ts from
   the mode's tools set cross-checked against TOOL_CATEGORIES. */

export type ModeSegment = 'all' | 'data' | 'build' | 'govern'

export const MODE_SEGMENTS: Array<{ id: ModeSegment; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'data', label: 'Data' },
  { id: 'build', label: 'Build' },
  { id: 'govern', label: 'Govern' },
]

/** Segmented sub-mode bucket for a mode id (grouping only — tools stay on the mode). */
export function modeSegmentFor(modeId: string): Exclude<ModeSegment, 'all'> {
  switch (modeId) {
    case 'write-functions':
    case 'osdk-react':
      return 'build'
    case 'govern':
    case 'platform-qa':
      return 'govern'
    default:
      return 'data'
  }
}

/** All distinct tool-carrying modes across presets, deduped by id with deduped tools. */
export function allPresetModes(presets: Preset[] = PRESET_SEED): PresetMode[] {
  const seen = new Set<string>()
  const out: PresetMode[] = []
  for (const p of presets) {
    for (const m of p.modes ?? []) {
      if (seen.has(m.id)) continue
      seen.add(m.id)
      out.push({ ...m, tools: [...new Set(m.tools)] })
    }
  }
  return out
}

/** Modes in one segmented sub-mode bucket ('all' = no filter). */
export function filterModesBySegment(modes: PresetMode[], segment: ModeSegment): PresetMode[] {
  if (segment === 'all') return [...modes]
  return modes.filter(m => modeSegmentFor(m.id) === segment)
}

/* ── FN-FDE-012 Prompt Template Gallery ────────────────────────────
   Six curated prompt templates (corpus-2 prompt-gallery tile). Pure
   helpers only — persistence lives in PresetsModule via patchMeta/ws.meta. */

export type PromptTemplateCategory =
  | 'Classification' | 'Sentiment' | 'Extraction'
  | 'Summarization' | 'Scoring' | 'Review'

export type PromptTemplate = {
  id: string
  name: string
  category: PromptTemplateCategory
  desc: string
  systemPrompt: string
  userTemplate: string
  outputSchema?: string
}

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  { id: 'tmpl-classification', name: 'Classification', category: 'Classification',
    desc: 'Assign exactly one label from a candidate set, with confidence and evidence.',
    systemPrompt: 'You are a classifier. Assign exactly one label from the candidate set. Output: LABEL · confidence 0-1 · one-line evidence quote. Never invent a label outside the set.',
    userTemplate: 'Classify {{QUESTION}} into the candidate labels. Output one label, confidence 0-1, and a one-line evidence quote.',
    outputSchema: 'classification' },
  { id: 'tmpl-sentiment', name: 'Sentiment', category: 'Sentiment',
    desc: 'Score sentiment on a -1..1 scale with the driving phrase.',
    systemPrompt: 'You are a sentiment scorer. Score the text from -1 (very negative) to 1 (very positive). Output: SCORE · polarity · the phrase that drove the score. Terse, no speculation.',
    userTemplate: 'Score the sentiment of {{QUESTION}} from -1 to 1. Output the score, polarity, and driving phrase.',
    outputSchema: 'sentiment' },
  { id: 'tmpl-extraction', name: 'Extraction', category: 'Extraction',
    desc: 'Pull named fields/entities into a flat key-value list.',
    systemPrompt: 'You are an extraction agent. Extract only facts present in the text; never infer. Output one key: value per line, or NONE when a field is absent.',
    userTemplate: 'Extract the requested fields from {{QUESTION}}. Output key: value lines only.',
    outputSchema: 'extraction' },
  { id: 'tmpl-summarization', name: 'Summarization', category: 'Summarization',
    desc: 'Faithful short summary: key points, then open questions.',
    systemPrompt: 'You are a summarizer. Summarize faithfully with no added facts. Output: KEY POINTS (bullets) · OPEN QUESTIONS. Keep it under 150 words.',
    userTemplate: 'Summarize {{QUESTION}}. Output key points as bullets, then open questions.',
    outputSchema: 'summary' },
  { id: 'tmpl-scoring', name: 'Scoring', category: 'Scoring',
    desc: 'Rubric score 0-100 with per-criterion justification.',
    systemPrompt: 'You are a scoring agent. Score against the rubric 0-100. Output: SCORE · per-criterion justification · top fix. Be strict and evidence-first.',
    userTemplate: 'Score {{QUESTION}} against the rubric (0-100). Output the score, per-criterion justification, and the top fix.',
    outputSchema: 'score' },
  { id: 'tmpl-review', name: 'Review', category: 'Review',
    desc: 'Approve / request-changes verdict with blocking issues first.',
    systemPrompt: 'You are a reviewer. Output verdict approve or request-changes, then blocking issues first, then nits. Cite the exact place each issue touches.',
    userTemplate: 'Review {{QUESTION}}. Output approve or request-changes, with blocking issues first.',
    outputSchema: 'review-verdict' },
]

/** ws.meta key for the gallery's persisted state (active preset + last Apply). */
export const PROMPT_GALLERY_META_KEY = 'promptTemplateGallery'

export type PromptGalleryState = {
  activePresetId?: string
  lastTemplateId?: string
  lastAppliedPresetId?: string
  appliedAt?: string
}

/** Defensive read of the gallery state from ws.meta (never throws). */
export function readPromptGalleryState(meta?: Record<string, any> | null): PromptGalleryState {
  const raw = (meta?.[PROMPT_GALLERY_META_KEY] ?? {}) as Record<string, any>
  if (!raw || typeof raw !== 'object') return {}
  const out: PromptGalleryState = {}
  if (typeof raw.activePresetId === 'string') out.activePresetId = raw.activePresetId
  if (typeof raw.lastTemplateId === 'string') out.lastTemplateId = raw.lastTemplateId
  if (typeof raw.lastAppliedPresetId === 'string') out.lastAppliedPresetId = raw.lastAppliedPresetId
  if (typeof raw.appliedAt === 'string') out.appliedAt = raw.appliedAt
  return out
}

/** Find a gallery template by id (undefined when unknown). */
export function findPromptTemplate(id?: string | null): PromptTemplate | undefined {
  return PROMPT_TEMPLATES.find(t => t.id === id)
}

/** Write a template's prompt into a preset (new object — source never mutated). */
export function applyPromptTemplate(preset: Preset, template: PromptTemplate): Preset {
  return {
    ...preset,
    systemPrompt: template.systemPrompt,
    userTemplate: template.userTemplate,
    ...(template.outputSchema ? { outputSchema: template.outputSchema } : {}),
    sourcePresetId: preset.sourcePresetId ?? preset.id,
    promptTemplateId: template.id,
  }
}
