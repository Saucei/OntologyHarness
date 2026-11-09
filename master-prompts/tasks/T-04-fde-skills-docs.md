# T-04 — Skill Set Modal + Documentation Attach — MASTER PROMPT

**Layer:** L1-APPLICATION (session application in L4) · **Functions:** FN-FDE-007, FN-FDE-008 · **Host:** Agent Console composer ribbon + Presets · **Status:** ready to implement
**Architecture:** `master-prompts/ARCHITECTURE_LAYERS.md` · **Plugins:** `ARCHITECTURE_PLUGINS.md` · **Prerequisites:** `master-prompts/HARNESS_CHANGE_MAP.md` (preset schema `skills[]` + `documentationBags`) · **Index:** `master-prompts/GOALS.md`

## 1. Why this task, and where it sits

The composer ribbon (FN-FDE-004) shipped as static chips; its source notes popovers are "from T-04". Two chips — Skills and Documentation — sit at `0/8` and open nothing. Every visible count in the ribbon must become an affordance, and the doctrine applies: it is not the AI model, it is what you do with it. Skills and documentation are exactly that layer, so this task converts counts into curations. It is the only open door left in the Agent Console shell: sessions, Outline, approvals, ribbon, permission matrix, and catalog all shipped (T-01/T-03/T-05). Build T-04 so the console stops looking finished-but-decorative.

## 2. Corpus ground truth (FN-FDE-007/008)

From the corpus-2 tiles and `FN-FDE-CORE.md`: the Skill Set Configurations modal is a centred dialog with three tabs — **Models | Skills | Tool approvals** — each row with an enabled toggle; the footer holds `Cancel` and `Apply to current session`. The Documentation affordance is a popover with two groups: **Custom docs** and **Foundry documentation bundles/pages**, each entry toggleable. Dismiss on outside click and `Escape`. Glass tokens only (`--glass-*`, `--text*`, `--green-*`); no new hues; light and dark parity via tokens alone. Keep verbatim corpus strings verbatim.

## 3. Data model — edit this first, braid it in

In `src/data/presets.ts` add `Skill { id, label, description, enabled }` and `DocumentationBag { id, label, kind: 'custom' | 'foundry', enabled }`; extend `Preset` with optional `skills?` and `documentationBags?`. Seed at least three skills and four bags (two custom, two foundry) across `PRESET_SEED` so counts are non-zero. Add pure helpers: `presetSkills`, `setSkillEnabled`, `presetDocBags`, `setDocBagEnabled`, `skillsCount`, `docsCount`. Keep the schema additive — presets without these fields must still load. Do **not** touch `contract.ts`, `registry.ts`, or layer types.

## 4. Skill modal (FN-FDE-007) — the main surface

Clicking the **Skills** ribbon chip opens the Skill Set Configurations modal (`data-testid="skill-modal"`): tabs **Models | Skills | Tool approvals**. Models joins `MODEL_CATALOG` from `src/llm/client.ts` by id — never duplicate the strings. Skills: rows with label, description, and enabled toggle. Tool approvals is a read-only mirror of the active session's permission decisions from `src/agent/permissions.ts` (edits stay in the tri-panel matrix; reflect, don't fork). Footer: `Cancel` discards; `Apply to current session` commits toggles. Until commit they are drafts. Apply writes `agentSkills.*` to `ws.meta` via `patchMeta`, records `appendTrace({kind:'skill-apply'})` + `appendAudit({event:'skill-apply'})`, and shows a transient confirmation. `Escape`/outside click discard. Reactivity rule: `patchMeta` does not notify subscribers — mirror persisted state locally from `ws.meta` in `useEffect`, as nav order and the Plugin Manager already do.

## 5. Documentation popover (FN-FDE-008)

Clicking the **Documentation** chip opens a popover with the two corpus groups — **Custom docs** and **Foundry documentation** — each seeded to `8` so the chip reads `8/8`. Toggling attaches/detaches a bag; counts update live; every toggle calls `appendTrace` + `appendAudit`. Dismiss on `Escape`/outside click. No file-upload machinery — attach/detach affordance over seeded bags only.

## 6. Scope discipline

Files: `src/data/presets.ts`, `src/modules/AgentConsole.tsx`, new coverage in `src/data/presets.test.ts`, styles in `src/app.css` via existing classes only. No new deps, no new fonts, no forks: work in-place on the existing ribbon and leave the permission matrix and tier pill exactly as shipped.

## 7. Acceptance gates (all must pass)

`npx tsc -b` clean · `npx vitest run` green with ≥3 new tests (toggle semantics, counts, apply-vs-cancel, doc kinds) · modal/popover open/close and counts survive reload via `ws.meta` · dev-tab console clean · ledger regenerated and `GOALS.md` flipped by the main agent at reconciliation. Rollback: reverting this slice must leave build + tests green. Report files changed and test counts when done.
