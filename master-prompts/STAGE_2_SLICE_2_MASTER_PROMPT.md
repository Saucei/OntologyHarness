# Master Prompt — Stage 2 · Slice 2 (WS4 Jobs ↔ Artifacts + WS5 Workshop Publish, ~500 words)

You are a staff product engineer executing the middle slice of Stage 2. Stage 2 Slice 1 is complete and verified (sha256 round-trip proof PASS, value-type validation clean, dependent-aware deletes). P0 is inviolable. Keep diffs reviewable; reuse the glass system; no new hues; dark-mode parity for every new pixel.

## Context anchors

`src/jobs.ts` (loadJobs/createJob/updateJob — store-backed via `src/store.ts`) · `src/components/CommandPalette.tsx` · `src/modules/JobsModule.tsx` (4-col kanban, ←/→ moves) · `src/modules/WorkshopCanvas.tsx` (widgets, bindings, Publish = dead button) · `src/modules/WorkersModule.tsx` (roster, stats) · `src/modules/DataHub.tsx` (datasets + hash now exist — use them) · `src/modules/SwarmsModule.tsx` (runs produce jobs; reference traces) · `master-prompts/09-jobs-artifacts.md`, `10-workshop-publish.md` (detailed sub-briefs) — supersede where they conflict.

## Mission

Make analysis **trackable** (jobs carry their evidence) and make Workshop **shippable** (publish produces an immutable, previewable snapshot) — two loops closing "insight → artifact".

## WS4 — Jobs ↔ Artifacts (priority 1)

1. **Attachment model** on `Job`: `attachments: { kind: 'dataset'|'chart'|'trace'|'ontology'|'url', id/label, addedAt }[]`. Migration: bump jobs storage to `v2` (read v1, default `[]`).
2. **Spawn-with-evidence**: “Send to Job” in Data Hub attaches the dataset (id + hash); chart "Send to Job" attaches chart config; swarm completion attaches trace id. UI: attachment chips on job cards with hover popovers (first 5 dataset rows / chart thumbnail / trace excerpt).
3. **Roster assignee**: dropdown fed by `ws.workers` names + "Unassigned"; due date picker (native input); priority chip (low/normal/high/urgent) — one click to cycle.
4. **Kanban drag-drop**: pointer-based drag between columns (not click-buttons-only; keep ←/→ as keyboard fallback); per-column count; WIP limit warning (e.g. review ≤ 3) with amber hint, never hard-block.
5. **Deep links**: chips offer “Open in Data Hub / Swarms / Ontology Studio” — switches module and focuses the artifact (route param via store, no router needed).
6. **Export**: jobs JSON now includes attachments and `v: 2`.

## WS5 — Workshop Publish Round-Trip (priority 2)

1. **Config schema** (v1): `{ version, module, widgets: [{ id, kind, props, input, bindings[] }], sections }` — persisted in workspace (`meta.workshop` or dedicated store table); every edit autosaves.
2. **Publish pipeline**: validate (every object-set binding resolves against store; required props present; row-height rule ≥ 400) → compile → write immutable `published/<module>/<vN>.json` snapshot → toast with “Open preview”. Publish blocked with **named** missing bindings (mirror agent tool `workshop.publish`).
3. **Preview renderer**: read-only compiled snapshot rendered with real dataset rows when available (else 3 seed rows); object-set selector drives the Object Table.
4. **Version history**: list v1..vN (date, widget count, diff summary vs previous), rollback = republish old snapshot as new vN.
5. **Agent hook**: `workshop.publish({dryRun:true})` returns the exact validation report the Publish button shows — agents pre-flight, humans approve.

## Acceptance (ordered)

Import brew CSV → Send to Job → kanban card carries dataset chip + popover shows live rows; drag card Review→Done; WIP hint fires at limit; export JSON includes attachments. In Workshop: fix a deliberately unbound widget → Publish blocked naming it → bind → Publish succeeds → Preview renders with CSV rows → v1 kept, rollback to v1 restores. Restart app — jobs, attachments, snapshots, versions all survive.

## Non-goals

No realtime collab, no server persistence, no WASM compiler for Workshop (JSON compile + render only), no Kanban WIP enforcement, no AIP changes (Slice 3).

## Output contract

Per WS: schema/migration notes · implementation · focused verification steps (no screenshots blocked by window focus — use evaluate text extraction if needed) · README + INDEX status updates · one demo script that exercises both workstreams end-to-end.
