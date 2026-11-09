// The ONE way anything gets into the Harness. Baked-in modules and future T1 resource packs
// implement this same contract — no second integration path, ever.
import type { FC } from 'react'
import type { IconName } from '../components/Icon'

export type ModuleSection = 'WORK' | 'INTELLIGENCE' | 'INSPECT'

/** The layer stack — one dimension orthogonal to `section` (nav grouping).
 *  L0 AI MODEL → L1 APPLICATION → L2 ONTOLOGY → L3 FOUNDRY → L4 FDEs.
 *  See master-prompts/ARCHITECTURE_LAYERS.md for the normative rules. */
export type HarnessLayer = 'L0-MODEL' | 'L1-APPLICATION' | 'L2-ONTOLOGY' | 'L3-FOUNDRY' | 'L4-FDE'

/** Bottom→top stacking order (dependency arrows point downward). */
export const LAYER_ORDER: HarnessLayer[] = ['L0-MODEL', 'L1-APPLICATION', 'L2-ONTOLOGY', 'L3-FOUNDRY', 'L4-FDE']

/** Agent-tool contribution (T2 later; declared now so the shape is fixed). */
export interface AgentToolSnippet {
  name: string
  description: string
  args: Record<string, { type: 'string' | 'number' | 'boolean'; required?: boolean }>
  run: (args: Record<string, unknown>) => Promise<{ ok: boolean; data: unknown }>
}

export interface ModuleCommand { id: string; label: string; run: () => void; kb?: string }

/** Optional contribution surfaces — all additive, all optional, all still baked-in. */
export interface ModuleContributions {
  commands?: ModuleCommand[]
  agentTools?: AgentToolSnippet[]
  /** T1 resource packs (presets / themes / corpora / rule packs) are attached here in a later slice. */
  presets?: unknown[]
  themePacks?: unknown[]
  corpusPacks?: unknown[]
  rulePacks?: unknown[]
}

export interface HarnessModule {
  id: string                 // stable — favorites, navOrder, oh:navigate deep links key off this
  label: string              // nav + breadcrumb title
  icon: IconName
  hint: string               // breadcrumb hint + palette description
  section: ModuleSection
  Component: FC
  keywords?: string[]        // Ctrl+K palette terms (label + hint always searched too)
  /** Dependency stack layer — L0 model → L1 app → L2 ontology → L3 foundry → L4 FDEs. */
  layer: HarnessLayer
  /** Pack/plugin contract guard: registry refuses modules built against a different major. */
  apiVersion?: string
  contributes?: ModuleContributions
}

/** Registry API version — packs/modules must satisfy this major. */
export const MODULE_API = '1.0'
