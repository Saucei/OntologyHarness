// Module registry — the single source of truth for navigation, palette, breadcrumbs,
// Alt+1…9 and (later) resource-pack/plugin discovery. Order here = default nav order =
// Alt+N mapping. Nothing else in the app should hard-code a module id.
import type { HarnessModule, ModuleSection, HarnessLayer } from './contract'
import GraphCanvas from './GraphCanvas'
import OntologyStudio from './OntologyStudio'
import PipelineBuilder from './PipelineBuilder'
import WorkshopCanvas from './WorkshopCanvas'
import AipLogicPanel from './AipLogicPanel'
import ManifestView from './ManifestView'
import ProvidersModule from './ProvidersModule'
import DataHub from './DataHub'
import SwarmsModule from './SwarmsModule'
import WorkersModule from './WorkersModule'
import PresetsModule from './PresetsModule'
import JobsModule from './JobsModule'
import AgentConsole from './AgentConsole'
import PluginManager from './PluginManager'
import MapModule from './MapModule'
import { ObservabilityModule } from './ObservabilityModule'
import PeerManager from './PeerManager'
import ScopingModule from './ScopingModule'
import CodeWorkspacesModule from './CodeWorkspacesModule'
import RepoModule from './RepoModule'

const M = (m: HarnessModule): HarnessModule => {
  const layers: HarnessLayer[] = ['L0-MODEL', 'L1-APPLICATION', 'L2-ONTOLOGY', 'L3-FOUNDRY', 'L4-FDE']
  if (!layers.includes(m.layer)) throw new Error(`Module ${m.id} declares no valid layer (must be one of ${layers.join(' | ')})`)
  if (m.apiVersion && !m.apiVersion.startsWith('1.')) throw new Error(`Module ${m.id} built against unsupported API ${m.apiVersion}`)
  return m
}

const WORK: HarnessModule[] = [
  M({ id: 'graph', label: 'Lineage Graph', icon: 'graph', hint: 'Vertex-style ontology & dataset graph', section: 'WORK' as ModuleSection, layer: 'L2-ONTOLOGY' as HarnessLayer, Component: GraphCanvas, keywords: ['graph', 'vertex', 'ontology graph', 'lineage', 'explore'] }),
  M({ id: 'studio', label: 'Ontology Studio', icon: 'cube', hint: 'Object types, links, actions, value types', section: 'WORK' as ModuleSection, layer: 'L2-ONTOLOGY' as HarnessLayer, Component: OntologyStudio, keywords: ['object type', 'links', 'actions', 'value types', 'schema'] }),
  M({ id: 'pipeline', label: 'Pipeline Builder', icon: 'pipeline', hint: 'Clean → transform → derive datasets', section: 'WORK' as ModuleSection, layer: 'L3-FOUNDRY' as HarnessLayer, Component: PipelineBuilder, keywords: ['pipeline', 'transform', 'flow', 'dataset'] }),
  M({ id: 'workshop', label: 'Workshop Canvas', icon: 'workshop', hint: 'Build object-backed app modules', section: 'WORK' as ModuleSection, layer: 'L3-FOUNDRY' as HarnessLayer, Component: WorkshopCanvas, keywords: ['workshop', 'widgets', 'app', 'sections', 'object table'] }),
  M({ id: 'data', label: 'Data Hub', icon: 'database', hint: 'Import, graph & export datasets', section: 'WORK' as ModuleSection, layer: 'L2-ONTOLOGY' as HarnessLayer, Component: DataHub, keywords: ['datasets', 'import', 'export', 'rows', 'csv'] }),
  M({ id: 'scoping', label: 'Scoping', icon: 'layers', hint: 'Use-case funnel canvas + guidance bank', section: 'WORK' as ModuleSection, layer: 'L3-FOUNDRY' as HarnessLayer, Component: ScopingModule, keywords: ['scoping', 'funnel', 'guidance', 'canvas', 'bank'] }),
  M({ id: 'code-workspaces', label: 'Code Workspaces', icon: 'monitor', hint: 'AIP code workspaces: 11-tool toggles + tiered agent templates', section: 'WORK' as ModuleSection, layer: 'L3-FOUNDRY' as HarnessLayer, Component: CodeWorkspacesModule, keywords: ['code', 'workspaces', 'tools', 'templates', 'v16', 'v20'] }),
  M({ id: 'repos', label: 'Repo Lifecycle', icon: 'list', hint: 'Provisioning · Tag & release · Checks · Scoped imports', section: 'WORK' as ModuleSection, layer: 'L3-FOUNDRY' as HarnessLayer, Component: RepoModule, keywords: ['repos', 'provisioning', 'release', 'checks', 'imports', 'semver'] }),
]

const INTELLIGENCE: HarnessModule[] = [
  M({ id: 'aip', label: 'AIP Logic', icon: 'spark', hint: 'Compose, preview & run LLM logic functions', section: 'INTELLIGENCE' as ModuleSection, layer: 'L1-APPLICATION' as HarnessLayer, Component: AipLogicPanel, keywords: ['llm', 'logic', 'grounded', 'publish'] }),
  M({ id: 'agent', label: 'Agent Console', icon: 'spark', hint: 'Tool-using agent: observe → plan → act → verify', section: 'INTELLIGENCE' as ModuleSection, layer: 'L4-FDE' as HarnessLayer, Component: AgentConsole, keywords: ['agent', 'tools', 'runs', 'budget'] }),
  M({ id: 'swarms', label: 'Agentic Swarms', icon: 'graph', hint: 'Orchestrate multi-agent runs', section: 'INTELLIGENCE' as ModuleSection, layer: 'L4-FDE' as HarnessLayer, Component: SwarmsModule, keywords: ['swarm', 'multi-agent', 'checkpoints'] }),
  M({ id: 'workers', label: 'AI Workers', icon: 'users', hint: 'Dedicated worker profiles & stats', section: 'INTELLIGENCE' as ModuleSection, layer: 'L4-FDE' as HarnessLayer, Component: WorkersModule, keywords: ['workers', 'profiles', 'skills'] }),
  M({ id: 'presets', label: 'Presets', icon: 'layers', hint: 'One-click task presets', section: 'INTELLIGENCE' as ModuleSection, layer: 'L1-APPLICATION' as HarnessLayer, Component: PresetsModule, keywords: ['presets', 'templates', 'dispatch'] }),
  M({ id: 'jobs', label: 'Analyst Jobs', icon: 'kanban', hint: 'Kanban for analysis work', section: 'INTELLIGENCE' as ModuleSection, layer: 'L4-FDE' as HarnessLayer, Component: JobsModule, keywords: ['jobs', 'kanban', 'tasks', 'board'] }),
]

const INSPECT: HarnessModule[] = [
  M({ id: 'providers', label: 'LLM Providers', icon: 'server', hint: 'Provider endpoints, keys, agent prompt', section: 'INSPECT' as ModuleSection, layer: 'L0-MODEL' as HarnessLayer, Component: ProvidersModule, keywords: ['providers', 'models', 'keys', 'spend', 'endpoints'] }),
  M({ id: 'manifest', label: 'Corpus Manifest', icon: 'doc', hint: 'Parsed reference-library analysis', section: 'INSPECT' as ModuleSection, layer: 'L3-FOUNDRY' as HarnessLayer, Component: ManifestView, keywords: ['corpus', 'manifest', 'screenshots', 'reference'] }),
  M({ id: 'map', label: 'Geo Map', icon: 'database', hint: 'Cluster layers, bubbles, metric cards', section: 'INSPECT' as ModuleSection, layer: 'L3-FOUNDRY' as HarnessLayer, Component: MapModule, keywords: ['map', 'geo', 'cluster', 'bubbles', 'choropleth', 'geohash'] }),
  M({ id: 'observability', label: 'Observability', icon: 'chart', hint: 'Session events, timeline, trace table', section: 'INSPECT' as ModuleSection, layer: 'L3-FOUNDRY' as HarnessLayer, Component: ObservabilityModule, keywords: ['observability', 'timeline', 'events', 'trace', 'debug', 'ohtrace'] }),
  M({ id: 'plugins', label: 'Plugin Manager', icon: 'layers', hint: 'Resource packs: themes · presets · corpora · rules', section: 'INSPECT' as ModuleSection, layer: 'L3-FOUNDRY' as HarnessLayer, Component: PluginManager, keywords: ['plugins', 'packs', 'marketplace', 'themes', 'presets', 'extensions'] }),
  M({ id: 'peer-manager', label: 'Peer Manager', icon: 'users', hint: 'Peer connections, topology + peering jobs, 3-step mapping wizard', section: 'INSPECT' as ModuleSection, layer: 'L3-FOUNDRY' as HarnessLayer, Component: PeerManager, keywords: ['peer', 'manager', 'connections', 'topology', 'mapping', 'wizard'] }),
]

/** Flat registry in canonical order. This exact order drives Alt+1…9. */
export const MODULES: HarnessModule[] = [...WORK, ...INTELLIGENCE, ...INSPECT]

export const moduleById = (id: string): HarnessModule | undefined => MODULES.find(m => m.id === id)
export const moduleIds = (): string[] => MODULES.map(m => m.id)
/** Modules in a single layer stack layer (dependency axis, orthogonal to nav section). */
export const modulesInLayer = (layer: HarnessLayer): HarnessModule[] => MODULES.filter(m => m.layer === layer)
