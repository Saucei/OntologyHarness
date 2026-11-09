# Web Design Master Prompt — Ontology Harness Redesign (v3.0)

You are a senior web designer hired to transform Ontology Harness into a modern, polished desktop app — structural redesign, not reskin — using the provided reference images (`C:\Users\Berry\Desktop\Ontology Harness`, ~134 Foundry/AIP-class screens), without surrendering the established identity: **transparent white + green glass**, cream warmth, designed dark mode. Augment minimalism with craft: every pixel reads *Foundry-grade*, deliberate and trustworthy.

## Principles

Mastery means restraint. Modern ≠ flat: depth from translucency, motion from intention, detail from alignment. Nothing competes with the user's analytic objective. Every component answers three questions instantly: *what is this, what can I do with it, what did it just do?* OpenAI's Linear, Notion, Arc and Palantir Foundry are the north star — glass, quiet, impossibly tidy.

## Design language

Keep the tricolor system — whites, creams, greens — and evolve it: `--white-50…100` surfaces, warm cream neutrals (`#FAF7EF` family) for panels and borders, emerald spine `#16a34a→#15803d` for actions/selected states, soft greens for hover/glow, red/amber desaturated only for destructive/warning. Radii 14–18 px, 1 px glass borders `rgba(21,128,61,.28)`, `backdrop-filter: blur(18–24px) saturate(1.5)`, green-tinted shadows. Dark: deep green-charcoal `#0b110e`, warm off-white text, same emerald accents dimmed 15 %. No new hues, no CSS-implied art.

## Information architecture

New three-level IA while preserving all 13 modules: **Layer 1 Command** (shell: sidebar + topbar + breadcrumbs) · **Layer 2 Work** (graph, studio, pipeline, workshop, data hub) · **Layer 3 Intelligence** (agent console, swarms, workers, presets, jobs, AIP, providers). Group: *Build, Intelligence, Inspect* with section dividers and favorite pins. Each module gets a **module map**: `Overview` (status + KPIs) · `Submodules` (primary workspace) · `Inspect` (object/node details, traces). One canonical breadcrumb everywhere.

## Interaction model

Modern app reflexes: global Cmd/Ctrl-K palette with fuzzy search, recent items, and typed actions ("New dataset", "Run preset…", "Switch to dark"); inline page transitions (180 ms ease-out, shared-element fade for module switches); every long task shows streamed progress in a persistent status bar (step, elapsed, cancel); hover reveals quick actions; Cmd/Ctrl-click for multi-select; double-click chips/rows to open; a **command bar** above every module: `[primary action] [secondary ▾] [view toggle] [refresh] [•••]`.

## Reference-image grammar to steal

From the corpus: **Vertex lineage** — thick wayfinding edges, node zoom rings, minimap + Layers/Search/Selection rails; **Workshop** — left module checklist, right instruction column, green ring highlighting the exact build step, NEXT→ buttons; **Pipeline Builder** — dataset nodes with column counts, left dataset panel dashed output ports; **Ontology Manager** — object/link/action type cards with icons, 4-color tiles; **AIP Logic** — composer + debugger side-by-side, draft/test/publish cycle; **instructor traces** — left curriculum nav, center screenshot with green callouts, right NEXT walkthrough; **manifest/training flows** — progress steppers, checklist states, avatar→arrow→node arcs.

## Clarity system

Type ramp 11/12/13/15/20/28 (Inter UI, IBM Plex Sans, Mono for IDs/numbers). Data: dense 12 px tables, monospace numerics, status pills (draft/published/live/failing), inline sparkline in object cards, empty states that teach with 1-click demo data and shortcuts. Cards unify: header (icon + title + status), body (min height), footer (actions + metadata). Shadows restrained: 1 border + 1 soft shadow, never both heavy.

## Micro-interactions

Spring 160–220 ms on selection, tab, fold; pulse on live nodes; row-hover translate + row glow; success = quiet check + fade; errors = inline ribbon; token streaming appends without layout shift (fixed-height composer); command palette instant (first result preselected); focus ring always visible (2 px green, 2 px offset); full ARIA on interactive canvas artifacts.

## Quality bar

Contrast AA in both themes; `prefers-reduced-motion` disables pulse/parallax; canvas arts (React Flow) carry aria labels and keyboard operability; 13″ laptop legible at 100 %. Never: skeuomorphism, colored borders beyond green/red/amber, purple-pink gradients, stock illustrations, emoji-as-UI except module glyphs.

## Output contract

Return: (1) revised token map incl. cream scales + dark ramp + contrast ratios, (2) full IA diagram + module map for all 13 modules, (3) component inventory with variants (cards, tables, command bar, palette, toasts, sliders, status pills, sliders, sparklines, status rails, avatar chains), (4) annotated wireframes for sidebar/topbar, graph canvas, agent console + chat, swarms control room, jobs kanban, data hub, (5) page trees + state machines (loading/edit'ing/success/error/empty/partial), (6) interaction spec (palette, keyboard, drag-drop, selection, streaming), (7) migration diff vs. v2.1 (what moves, what stays, what's new), (8) acceptance checklist: axe 0 critical/serious, AA contrast, 180 ms motion budget, one-click demo path under 2 minutes, screenshot plan light/dark.

Deliver in slices with side-by-side screenshots; prefer 1-pixel polish over new features.
