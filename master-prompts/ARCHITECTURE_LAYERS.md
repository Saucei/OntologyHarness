# ARCHITECTURE — The Layer Stack (Master Prompt)

> Normative for every future slice. Companion to `ARCHITECTURE_PLUGINS.md` (T0–T3 contract).
> One sentence the whole program must satisfy:
>
> **It is not the AI model. It is what you do with it.**

## 1. The stack (in the order given)

```
L0  AI MODEL            the swappable commodity substrate
                       providers · keys · model ids · task-class routing · spend · traces
                          ↑ depends on nothing above it
L1  APPLICATION LAYERS  what you build *with* the model
                       AIP logic functions · presets · prompt templates · grounded retrieval
                          ↑ composed over ontology
L2  ONTOLOGY            the shared semantic truth
                       object types · links · actions · value types · backing datasets
                          ↑ rendered / transformed by the platform
L3  FOUNDRY             the platform bed (the workbench itself)
                       workspace shell · workshop · pipelines · lineage · corpus · plugins
                          ↑ operated by agents
L4  FDEs                Foundry-Deployable Entities — the operators on the stack
                       Agent Console · swarms · workers · analyst jobs
                       observe → plan → act → verify · approvals · audit
```

Reading `AI model > application layers > ontology > foundry > FDEs` as bottom → top stacking.
**Dependency arrows point downward** (higher layers may use lower layers; lower layers never
know about higher ones), with one sanctioned exception in §3.

## 2. Why this ordering (the doctrine)

- **The model is replaceable.** OpenAI, Anthropic, Gemini, Ollama, Azure, custom — all sit
  behind `src/llm/client.ts` `loadSettings()` / `llmChat()` / `llmChatStream()`. No module may
  hard-code a model slug, a base URL, or a key lookup outside that client.
- **The differentiation is in L1/L2/L4.** Prompt design, grounding, tool policy, ontology shape
  and FDE orchestration survive a model swap. When a user changes providers in L0, everything
  above must keep working without a code change.
- **Ontology is shared truth, not a view.** L1 composes over it, L3 renders it, L4 acts on it.
  No layer invents its own copy of object types — `src/data/ontology.ts` is the single source.
- **Foundry is the bed, not the brain.** L3 (shell, workshop, pipelines, plugins) provides
  surface and services; it makes no tool-calling or reasoning decisions.
- **FDEs are operators, not owners.** An FDE proposes, the approval gate disposes. L4 never
  bypasses L0's provider registry and never writes ontology except through audited actions.

## 3. Dependency rules (enforced by review + tests, not by hope)

| From → To | Rule |
|---|---|
| L0 → anyone above | **FORBIDDEN.** `src/llm/*` knows only provider specs, settings, streams, traces. No ontology, no tools, no UI. |
| L1 → L0, L2 | **ALLOWED.** May import provider client + ontology data + retrieval. May not import workshop / pipeline UI or agent orchestrator. |
| L2 → L0 | **FORBIDDEN.** Ontology has zero LLM knowledge. A file under `src/data/ontology*` or `valueTypes*` must never mention a model. |
| L3 → L2, L0 (via client), L1 data | **ALLOWED.** Shell + builders render ontology, surface app configs, and route model calls through the L0 client. L3 makes no agent decisions. |
| L4 → L3 tools, L2, L1, L0 (client) | **ALLOWED — the only layer that composes all of them.** All live writes go through the approval gate + `appendAudit`. |
| L4 → hard-coded model names | **FORBIDDEN.** FDEs read `loadSettings()`; the UI shows the resolved `${spec.label} · ${model}` chip from the client, never a literal. |
| L1/L4 → L3 catalogs (packs, corpus) | **SANCTIONED INVERSION.** Foundry (L3) injects library content downward into apps/agents (e.g. `packPresets()` feeding the Presets library). Injection is data-only, never code, and stays behind `src/packs/loader.ts` validation. |

### The module layer map (registry `layer` field is the machine-readable truth)

| Layer | Modules (ids) | Code home |
|---|---|---|
| **L0-MODEL** | `providers` | `src/llm/client.ts`, `src/llm/ProvidersModule` |
| **L1-APPLICATION** | `aip`, `presets` | `src/aip/retrieval.ts`, `src/data/presets.ts` |
| **L2-ONTOLOGY** | `graph`, `studio`, `data` | `src/data/ontology.ts`, `src/data/valueTypes.ts` |
| **L3-FOUNDRY** | `workshop`, `pipeline`, `manifest`, `plugins` | shell `App.tsx`, `src/components/*`, `src/packs/loader.ts` |
| **L4-FDE** | `agent`, `swarms`, `workers`, `jobs` | `src/agent/orchestrator.ts`, `src/agent/tools.ts` |

`layer` (dependency stack) is **orthogonal** to `section` (`WORK | INTELLIGENCE | INSPECT`,
the navigation grouping). A module declares both; section never implies layer.

## 4. Room for growth (what each layer absorbs next)

- **L0** absorbs: model catalog picker (FN-FDE-009), reasoning-tier pill, per-task-class routing UI, TPM/RPM budgets. Nothing here may grow app or ontology concepts.
- **L1** absorbs: skill sets (FN-FDE-007), Modes (FN-FDE-005), prompt template gallery (FN-FDE-012), variable chains (FN-AST-002/003) — all are *application-layer* compositions.
- **L2** absorbs: branching/versioning (FN-GOV-001), health checks (FN-GOV-003), mapping wizard (FN-PEER-003), machinery state-graphs (FN-MCH-*) as ontology analytics.
- **L3** absorbs: Machinery widgets, Geo/COP maps, observability stack (FN-OBS-*), scoped-imports console (FN-AST-008). New L3 modules register through `ModuleContributions` (T1–T3 in `ARCHITECTURE_PLUGINS.md`).
- **L4** absorbs: session manager + Outline + approval cards (FN-FDE-001/002/003, in flight), tool-permission matrix (FN-FDE-006), tiered agent templates (FN-MKT-003). Versioned FDE identities (`v16.0`/`v20.0` in corpus) belong here.

## 5. Audit checklist for any new module or slice

1. Declare `layer` in `registry.ts` and justify it against the table above in the PR description.
2. Confirm the dependency table — add an import and check which layer that edge creates.
3. If L0 code changed: does every L1/L4 call path still work with a *different* provider selected?
4. If L2 changed: do L1 grounding, L3 rendering and L4 tools all still resolve the same object types?
5. If L4 changed: are approvals + audit intact for every destructive tool path?
6. Cross-reference the capability ledger (`functions.json` / `UI_GAPS.md`) — a new layer concept
   without an `FN-*` ledger entry is out of scope by definition.

## 6. Acceptance (this master prompt, recorded for the ledger)

- `HarnessModule.layer` is required; `registry.ts` `M()` throws on invalid layer; every one of the
  14 modules declares exactly one of the five layers and all five layers are represented.
- `registry.test.ts` asserts the layer invariants (L0 singleton, L1 = aip+presets,
  L2 = graph+studio+data, L4 = agent+swarms+workers+jobs).
- `npx vitest run` green, `npx tsc -b` clean, console clean.

> Short version for the wall: **model is the battery, application is the circuit,
> ontology is the map, Foundry is the yard, FDEs are the drivers. Build the circuit,
> the map and the drivers well — the battery takes care of itself.**
