# ARCHITECTURE — Plugins & Extensibility (P0, accepted)

> Part of Stage 5 (`STAGE_5_CORPUS2_PLAN.md` § P0). Decision: **batteries included, but the
> battery compartment is standardized.** This document is the normative contract + roadmap for
> how anything enters the Harness. Written after the T0 registry refactor verified green.

## 0. The decision in one line

Every module — baked-in or community — implements **one** `HarnessModule` contract. No second
integration path is ever added. New features connect the same way reference-marketplace products
connect in Foundry: tiles on an ontology of apps, content via a marketplace, no forks required.

### The two extremes we rejected

| Extreme | Why rejected |
|---|---|
| Pure baked-in (pre-T0: everything hard-wired in `App.tsx`) | Every feature = core edit; theme drift; community cannot contribute; module count doesn't scale |
| Out-of-process plugin host (VS-Code-style extension host) | Huge IPC surface, sandbox packaging pain, wrong size for a desktop workbench |

## 1. Tier model

| Tier | What it is | Status |
|---|---|---|
| **T0 — Registry refactor** | All modules declared through `src/modules/registry.ts`; `App.tsx` renders from the registry; contributions flow through `ModuleContributions` | ✅ **DONE** (this slice). 13 modules, Alt+1–9 canonical order, palette keywords, guard tests |
| **T1 — Resource packs (no code)** | Preset packs, theme packs (tokens only), corpus manifests, validation rule packs, master-prompt bundles — JSON/asset folders from disk / URL / GitHub raw | Next. Zero code execution risk |
| **T2 — Contributed agent tools** | Pack declares tool schemas; runtime registers into the existing tool registry with existing dryRun/approval-gate defaults; audit via `appendTrace`/`appendAudit` | Design reserved now; gated like built-in tools |
| **T3 — Code modules** | Trusted capability code compiled in-app; permission manifest per pack; restricted React context | **Design reservation only** — no promise, no ships date |

## 2. The contract (implemented — `src/modules/contract.ts`)

```ts
export interface HarnessModule {
  id: string                 // stable — favorites, navOrder, oh:navigate, Alt+keys key off this
  label: string              // nav + breadcrumb
  icon: IconName
  hint: string
  section: 'WORK' | 'INTELLIGENCE' | 'INSPECT'
  Component: FC
  keywords?: string[]        // Ctrl+K palette (label+hint always searched too)
  apiVersion?: string        // registry refuses modules built against a different major
  contributes?: ModuleContributions
}

export interface ModuleContributions {
  commands?: ModuleCommand[]
  agentTools?: AgentToolSnippet[]
  presets?: unknown[]        // T1 attach points — typed when each tier lands
  themePacks?: unknown[]
  corpusPacks?: unknown[]
  rulePacks?: unknown[]
}

export const MODULE_API = '1.0'
```

Registry rules (enforced in `src/modules/registry.ts` + `registry.test.ts`):
- ids unique, kebab-case, `label`/`hint` non-trivial; icon uniqueness within a section (≤1 intentional reuse).
- sections contiguous: WORK → INTELLIGENCE → INSPECT. Flat registry order **is** default nav order **is** Alt+1–9.
- `MODULE_API` major must match; mismatch = module refused (graceful toast, never a crash).

## 3. T1 pack format (what "PR a folder" looks like)

```
<pack-folder>/
  pack.json          # manifest — schema below
  <payload assets>   # presets/*.json, tokens.css, corpus/index.json, rules/*.json, prompts/*.md
```

```json
{
  "id": "theme-cream-glass",
  "name": "Cream Glass Theme Pack",
  "version": "1.0.0",
  "kind": "theme-packs",
  "api": "^1.0",
  "author": "...",
  "description": "...",
  "entry": "tokens.css"
}
```

- `kind ∈ packs/themes · packs/presets · packs/corpus · packs/rules · packs/prompts`
- Loader validates manifest schema + `api` semver, then registers payload into the module's
  `contributes.*` surface; invalid packs are disabled with a toast + audit entry.
- Install sources (Plugin Manager): local folder, URL, GitHub raw link. All audited.

## 4. Guardrails (non-negotiable)

1. **Theme law** — packs may only consume `tokens.css` CSS variables. A pack validator lint
   (pattern of `workshop/validate.ts`) makes this mechanical; raw hex passes only through tokens.
2. **API semver** — `api: "^1.0"`; registry disables on major mismatch with a user-visible note.
3. **Execution gates** — T2 tool contributions inherit the orchestrator's dryRun/approval-gate
   defaults; T2 packs can never weaken the gate without explicit user confirmation per session.
4. **Ledger discipline** — every plugged-in capability enters `functions.json`/`UI_GAPS.md` with
   `entry: 'plugin'` so function-first accounting stays honest. If a pack adds a visible screen,
   it gets an `FN-*` id like everything else.
5. **CSP unreachable** — no `eval` of remote code ever; T3 is deliberately out of the running
   until a signed/curated trust model exists.

## 5. Plugin Manager (UI spec — mirrors corpus tile C10, Marketplace product version page)

New **INSPECT** module, registry id `plugins`:
- Grid of installed packs: name, version, kind badge, enable/disable toggle, source chip, remove.
- "Install pack" flow: local folder / URL / GitHub raw → validate → enable.
- Detail pane per pack: manifest fields, contents preview, `Adds N features` ledger impact line,
  version + API compatibility rows, "Accessible in" scope display (which modulesconsume it).
- Theme-pack cards render a live 4-swatch preview (light + dark pair) — tile C10's outputs row.

## 6. First proof packs (T1 smoke)

| Pack | Source of truth | Status |
|---|---|---|
| `packs/theme-cream-glass` | Design tokens override CSS (tokens-only lint enforced; both `[data-theme]` modes) | ✅ **ships** — toggle verified in browser (warm `#63966b` ↦ core `#22c55e` revert, both directions, persisted in `ws.meta.packState`) |
| `packs/corpus-134` | Byte snapshot of `public/manifest.json` (134 files) | ✅ **ships** via `scripts/build-corpus2-pack.mjs` |
| `packs/corpus-2` | `asset/corpus-2/index.json` (72 tiles → 15 categories) | ✅ **ships** via `scripts/build-corpus2-pack.mjs` |

Plugin Manager module registered (`plugins`, INSPECT): pack cards + detail pane + URL/GitHub-raw
install (`fetch` with CORS note) + pasted-JSON session packs (persisted in `ws.meta.customPacks`)
+ remove + audit. Folder-scan install beyond the in-project glob remains queued (needs a Tauri
command). Suite: 35/35 incl. loader validation, semver guard, theme tokens-only lint, corpus
counts, preset validation.

## 7. Sequencing notes

- T0 landed **between** corpus-2 ingestion and W1 — exactly as planned (no slice interrupted).
- T1 does not block W1: W1 (FN-FDE-CORE slice 1) can proceed right after the Plugin Manager smoke,
  since the 9 corpus-2 master prompts are already written.
- T3 stays a paragraph in this document until there's a real contributor asking for it.

## 8. Acceptance (T0, recorded here for the ledger)

- `npx vitest run` → **29/29** (5 new registry contract tests).
- `npx tsc -b` → clean. `npm run build` → ✓ 3.74s.
- Browser: nav count 13, sections grouped, favorites ★ pin/un-pin + persist, right-click
  Move up/down verified one-hop, Reset order restores canonical, Alt+6 → AIP Logic, palette
  keyword search ("kanban" → Analyst Jobs) via real keystrokes, console clean.
- **Regression found & fixed during verification**: `navOrder` echo loop (`navModuleIds` memo ↔
  `setNavOrderLocal` ↔ `patchMeta`) could compound reorder commands; refactored to single-source
  local state + exactly-once late-hydrate sync in `App.tsx`.
