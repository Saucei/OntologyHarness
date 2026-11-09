# Ontology Harness

> **⚠️ Development build demo — debugging & testing phase.** Ontology Harness (v0.0.2)
> is an early demonstration build of a desktop workbench. It is **not** a production
> product: features may change without notice, bugs exist, and it has not been
> audited for security, performance, or data safety. Please use it only for
> development, evaluation, and demos — do not store real production data or rely
> on it for operational workflows. No warranties are offered, express or implied.

---

## In one sentence

Ontology Harness is a desktop application that takes an off-the-shelf large
language model and turns it into a working, auditable, ontology-driven agent —
so the model does the thinking, but the *product* is everything around it.

**"It's not the AI model — it's what you do with it."** That's the design
principle behind the whole project, and it's why the app is built in layers.

## The problem we solve

LLM demos are easy; LLM *products* are hard. Left to themselves, models give
you a chat box. Real work needs:

- **Structure** — what objects exist, how they link, what actions are allowed
- **Control** — which tools an agent may call, and when it must ask permission
- **Evidence** — a trace of every step, so a human can replay and audit a session
- **Reuse** — presets, templates, and packs that turn one good workflow into a
  repeatable product

Ontology Harness is a single desktop workbench that does all four, using your
own LLM provider key, with no cloud account and no hosted service in between.

## How it works — the five layers

```
L4  FDE agents        — sessions, tool approvals, skills, thinking cards
L3  Foundry platform  — pipelines, maps, observability, governance, peering
L2  Ontology          — object types, links, value types, the graph itself
L1  Application       — presets, prompt gallery, logic functions
L0  AI model          — any OpenAI-compatible provider you bring your own key for
```

Dependencies only point *downward*. The model (L0) is a commodity you swap at
will. The value is in the layers above it: the ontology you model (L2), the
platform services that run on it (L3), and the agents that act through it (L4).
Every module in the app declares the layer it lives on, and the registry
enforces it.

## What you can do in this demo (a 5-minute tour)

Open the app, dismiss the welcome wizard, and then:

1. **Agent Console** — start a session. Send a prompt and watch the *Outline*
   fill with tool calls. Try the **Skills** ribbon chip (skill-set modal), the
   **Modes** popover (*"Adds N tools"*), and the **Tools permission matrix**
   with its `If on master → Ask` rule.
2. **Observability** — every action you just took is here: a diamond timeline
   of agent vs. internal events, a session replay (Preview | Raw), a logs table
   with wildcard search + **Copy as JSON**, and a trace waterfall. This is the
   audit trail a reviewer would use.
3. **Lineage Graph → Patient Journey** — the *Machinery* view: state nodes
   sized by duration, `40 DAYS` edge pills, deviation edges, a Path Explorer,
   and a brushable duration histogram. It's designed to answer "where does
   work wait longest?"
4. **Geo Map** — cluster bubbles over a synthetic map with Successful /
   Cancelled / Diverted metric cards and a faceted filter rail with a date
   histogram. Map, filter, and table stay linked.
5. **Pipeline Builder** — build settings (batch vs. streaming, compute
   profiles incl. External Databricks), a legend canvas with deploy statuses,
   and the *Use LLM* node template (business context, sentiment steppers,
   column + model picker).
6. **Code Workspaces / Repo Lifecycle / Peer Manager / Scoping** — the newest
   surfaces: 11 gated workspace tools with v16→v20 tiered templates, repo
   provisioning + tag-and-release + checks, peer connections with a 3-step
   property-mapping wizard, and a scoping funnel canvas with guidance bank.
7. **Plugin Manager** — install *resource packs* (themes, preset packs, corpus
   packs — by URL, pasted JSON, or local folder) without rebuilding the app.

## What state is it in?

| | |
|---|---|
| Version | **0.0.2-demo** (development build demo) |
| Shell | Tauri 2 (Rust) + React + TypeScript, ships as a desktop app |
| Modules | 20 (Work → Intelligence → Inspect) |
| Corpus functions implemented | **86 of 105** referenced screens INAPP · 7 partial · 12 remaining |
| Automated tests | **329 passing** (`npm run verify` = tsc + build + vitest) |
| Theme | Frosted-glass green/cream, designed light + dark pairs |

The 19 remaining functions are small, well-scoped pieces (Vertex graph
templating, Functions SDK bindings, a few AIP hardening items). They are the
honest, deliberate remainder — see `FUNCTIONS.md` / `UI_GAPS.md` for the
function-by-function ledger, and `master-prompts/GOALS.md` for the task board.

## Run the demo

**Prerequisites:** Node.js 20+, Rust (only for the desktop build).

```bash
npm install
npm run dev          # web demo at http://localhost:1420
npm run tauri:dev    # native desktop window (hot reload)
npm run tauri:build  # installer bundles (NSIS setup.exe + MSI) in src-tauri/target/release/bundle
npm run verify       # tsc + production build + full test suite
```

An LLM provider key is optional for the demo: without one the app runs in
offline/simulation mode for everything except live agent calls. OpenAI,
Anthropic, OpenRouter, Groq, Gemini, Azure, and local Ollama are supported —
keys stay on your machine (OS credential store for the native app) and are
never logged.

## Why build it this way

- **One contract for everything.** Built-in modules and future plugins
  implement the same `HarnessModule` contract. No second integration path.
- **Resource packs, not rebuilds.** Themes, presets, and corpora ship as
  packs the Plugin Manager can install at runtime.
- **Ledger-driven development.** Every visible function from the reference
  corpora is tracked in `functions.json` with an honest status. The product
  ships when the ledger says so — not when a roadmap says so.
- **Local-first.** Workspaces, jobs, andtraces live in a local SQLite store.
  Nothing phones home; the machine is the database.

## Project structure

```
src/               React app (modules, agent, machinery, observability, cop, workspaces…)
src-tauri/         Rust core (SQLite workspace, LLM proxy, OS keyring)
master-prompts/    Layer/plugin architecture docs + GOALS.md task board
asset/             Reference screenshot corpora (what "done" looks like)
packs/            Shipped resource packs (theme, presets, corpus packs)
scripts/           Ledger regen, inventory builders, version sync
```

## Roadmap

- Close the last 19 corpus functions (AIP hardening, Vertex templates, Functions SDK)
- Version bump policy: `0.x` while in demo; real releases start at `1.0.0`
- Signed installers + update channel (Tauri updater scaffold exists in config)

---
*Ontology Harness is a demonstration build for evaluation and development.
It is an original product with its own architecture; no third-party platform
code or design assets are bundled.*
