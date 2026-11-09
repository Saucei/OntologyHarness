# UI Master Prompt — Ontology Harness v2.1 (amended)

> **Amendment (v2.1): the original transparent white/green glass theme is retained and evolved — not migrated to blue.** The blue accent family in the palette section below now reads as: greens remain the identity hue; warm creams become the secondary surface family; a fully designed dark mode is added (deep green-charcoal, not blue-slate). All other v2 requirements stand (import/export, graphing, Swarms, AI Workers, Presets, Analyst Jobs, command palette, density modes).

You are a principal product designer and design-systems engineer rebuilding the interface of **Ontology Harness**, a standalone desktop workbench whose single purpose is to make people working in the AI space faster, calmer, and measurably more productive. Every pixel must reduce an analyst's cognitive load. Augment, don't decorate: import data, export data, graph data, and turn analysis into executable analyst jobs.

## Mission & principles

The UI is the product. Optimize for flow (import → analyze → decide → export/publish), not for demo screenshots. Prefer visible system status, one-click reversal, and progressive disclosure over modal clutter. Density is a feature for power users; calm spacing is a feature for 6-hour sessions. Nothing on screen may compete with the user's current objective; every panel must answer "what can I do here and what did it just do?"

## Design language: macOS × Windows 11, unified

Fuse the two systems honestly, not collage them:
- **From macOS:** frosted translucency layered over content (vibrancy), spatial depth, continuous corner radii (14–18 px windows, 10–12 buttons), buttery 160–220 ms spring motion, refined typography (Inter standing in for SF Pro; hierarchy via weight/size, never caps-lock shouting), traffic-light-safe title bar, generous whitespace, stage-managed panels.
- **From Windows 11:** Mica/Acrylic backdrop materials, Segoe UI Variable rhythm (x-height, 14px base), Fluent-style iconography (thin-stroke, rounded terminals), Snap-Layout-inspired multi-pane tiling, 8px corner discipline on cards, taskbar-grade status glyphs, and built-in reduced-transparency fallback for weaker GPUs.
- Unify with one token set, one motion curve (cubic-bezier(.2,0,0,1)), one icon grid. If a panel feels "Mac" and the next "PC", it is wrong.

## Palette & theme system

- **Light (primary):** whites (`#FCFCFA`) and creams (`#FAF7EF`, `#F7F3EA` warm paper) as surfaces; deep ink text (`#1E2A38`); **blue family** as the only saturated accent — `#2F6FED` primary, `#1F4E79` deep, `#7FB3F0` soft, `#E8EFFA` wash. Secondary tints: sage success `#2E9E6B`, amber caution `#C77414`, muted red `#C4443C` — always desaturated, always AA on their surfaces.
- **Dark (optional):** not inverted light — a designed contrast: base `#10151C`, panels `#171E27`/`#1E2630`, warm charcoal (`#211F1B`) alt surfaces, text `#E8E6DF` (warm off-white, never pure `#FFF`), accent `#6EA8FF`, borders `rgba(125,170,255,.14)`. Reduce glow; increase separation via tonal steps, not borders.
- Tokens: `--bg`, `--surface-1..3`, `--text-1..3`, `--accent`, `--accent-soft`, `--ring`. Ship **light / dark / system-auto**, per-window override, instant switch (no reload), persisted per workspace. Maintain ≥ 4.5:1 body contrast and ≥ 3:1 for large graphics; verify with axe. Honor `prefers-reduced-motion` and `prefers-reduced-transparency`.

## Information architecture — new spine

Keep the existing seven modules; add a first-class intelligence layer:
1. **Agentic Swarms** — a control room for orchestrated multi-agent runs. Canvas of swarm topology (orchestrator, worker nodes, tool edges), live run panel (pause/resume/stop), streamed step log, token + cost meter, and success telemetry. Swarm templates ship prebuilt.
2. **AI Workers** — a directory of dedicated worker profiles: name, model, role, system prompt, tools, avatar glyph, live status (idle/working/error), 30-day stats (runs, success rate, avg latency, cost), editable in place.
3. **Presets** — a gallery of one-click task presets: *Dataset Triage*, *Ontology Alignment*, *Lineage Audit*, *Workshop Module Review*, *AIP Logic Draft*, *Executive Summary*, *Data Quality Sweep*. Each preset = prompt + tools + worker + output schema. Users can fork and save custom presets.
4. **Analyst Jobs** — every chart, graph selection, or dataset can spawn a job card: title, owner, status (backlog/in-progress/review/done), due, linked artifacts, activity feed. Kanban + list views.

## Data import & export (non-negotiable, first-class)

- **Import:** drag-and-drop CSV, JSON, Parquet, XLSX, or folder scans; an import wizard with schema inference, column-type confirmation, key/dedup preview, and provenance capture (source path, hash, timestamp). Never import silently — always show a 5-row preview and row count before commit.
- **Export:** CSV/JSON/XLSX snapshots, chart images (PNG/SVG), lineage subgraphs (JSON), swarm traces (JSONL), and formatted PDF briefings. Exports respect current filters/selection and include a manifest header (source, filters, generated-at, tool version).
- Round-trip guarantee: importing an export must reproduce the identical dataset hash.

## Graphing for analysts

One graphing engine used everywhere (canvas, jobs, reports): time series (forecast/actual overlay), grouped/stacked bars, histogram, pie/donut, scatter, box plot, and **lineage-aware graph views** with expand/collapse. Auto-suggest chart type from column types. Every chart: title, subtitle with unit, source line, export button (PNG/SVG/copy), and "Send to Job" / "Send to Swarm" quick actions. Zero chart junk: no 3-D, no gridline noise, labels never collide at density.

## Interaction, layout, motion

Three-region shell: sidebar (nav + workspace switcher) · canvas · inspector (contextual; collapsible). Command palette everywhere (Ctrl/Cmd-K) with fuzzy search across workers, presets, jobs, datasets. Keyboard-complete: arrows navigate, Enter inspects, Alt+E export, Alt+S swarm. Motion: 160–220ms ease-out, transform/opacity only; selected graph nodes pulse subtly; streaming text renders without layout thrash. Compact/comfortable density modes.

## Typography, icons, empty states

Type ramp: 11/12/13/15/20/28px; body 13px; numeric and IDs always mono (IBM Plex Mono). Icon stroke 1.6px, round caps, 24px grid, single accent weight. Empty states teach, never scold: each lists (a) what this area does, (b) a sample action ("Import your first CSV", "Launch the Dataset Triage preset"), (c) a docs link. First-run experience: a 3-step wizard (choose workspace → connect an LLM provider or Ollama → import a sample dataset) that ends with one preset executed for real, so the user sees a finished analyst job in under two minutes.

## Motion & micro-feedback

Hover lifts 1px; primary buttons show a 2px accent ring on focus-visible; long operations stream progress into a persistent status bar (step, elapsed, cancel) instead of blocking. Success is a quiet checkmark + 200ms fade, never a modal. Destructive actions use inline undo toasts (5s), not confirmation dialogs, except schema deletes which require typing the object type name.

## State & data model

Layout state (panel sizes, active module, density, theme) persists per workspace to `workspace.json`; swarm runs persist as JSONL traces for replay; jobs reference artifacts by immutable IDs, not paths. All destructive operations emit compensating-event entries to an append-only audit log shown under Jobs → Activity.

## Surface hierarchy

Z-order: canvas < panels < inspector < command palette < transient toasts. Palette and toasts always float above frosted scrims (30–40% black). The sidebar collapses to icon rail at <1180px; the inspector auto-collapses below 980px into a bottom sheet.

## Non-goals & quality bar

No decorative gradients beyond the single accent family; no stock illustrations; no purple-pink neon. Dark mode must be designed, not inverted. All text legible at 100% zoom on 13″ laptops. Every action is keyboard-reachable and screen-reader labeled.

## Output contract

Return, in order: (1) token map + palette with contrast ratios, (2) component inventory + variant matrices, (3) annotated wireframes of the four new sections, (4) import/export round-trip spec, (5) graphing API sketch, (6) swarm/preset data model, (7) migration plan from the transparent white/green scheme, (8) acceptance checklist: axe pass, 4.5:1 contrast, round-trip proof, swarm dry-run, one-click preset → job creation. Then implement in slices with screenshots against the spec.
