# S3-D · UI Audit — axe, Contrast, Keyboard Map, Reduced Motion, Onboarding Wizard

**Role.** Design-systems / a11y engineer. **Context anchors:** `src/tokens.css`, `app.css`, all 12 modules in both themes, `App.tsx` (theme state), `CommandPalette.tsx`, `README.md`.

**Why P2.** "Viewer-friendly" is a shipping requirement. Unverified contrast is a broken promise; first-run is the difference between installed and used.

**Build:**
1. **axe-core** pass per module × theme (light + dark). Fix critical/serious: focus order, labels, canvas node roles, dialog semantics, popover roles (`atch-pop` → `role="dialog"` + Esc-close), kanban cards keyboard operability.
2. **Contrast table** (`DESIGN_TOKENS.md` v2): every `--text-1..3` × `--glass-bg-*` ratio in both themes; AA ≥ 4.5 (body) / ≥ 3 (large/graphics). Adjust tokens, not content.
3. **Keyboard map**: Ctrl/Cmd-K, Alt+1..9 module jump, Esc, arrows in Kanban/lists/palette, Enter activate, `Shift+?` help overlay listing every binding. Verified or documented as missing.
4. **Reduced motion/transparency**: kill `.pulse`, chart transitions, modal spring; `backdrop-filter` off under `prefers-reduced-transparency`; document the media-query contract in tokens.css.
5. **First-run wizard** (3 steps): workspace name → LLM provider (OpenAI / Ollama / skip) → import sample brewery CSV → preset Dataset Triage runs automatically → finished job visible. Skippable, re-runnable from Help menu. Fire nothing to network.

**Acceptance.** axe: 0 critical, 0 serious on all 12 modules both themes (report attached); contrast table signed off; wizard completes on fresh `npm run dev` profile to a completed analyst job < 2 min; `prefers-reduced-motion` verified by OS toggle.

**Output contract.** axe report + fixes list · token contrast table · keyboard cheat-sheet overlay + doc · wizard implementation + gating (`localStorage oh.onboarded`) · screenshots light/dark of wizard.

**Non-goals.** No visual redesign, no new component library, no i18n.
