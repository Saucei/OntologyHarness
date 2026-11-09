# P2 · UI Audit — Accessibility, Contrast & Onboarding

**Role.** Design-systems/a11y engineer. Context: v2 added dark mode + 5 modules quickly; accessibility, contrast and first-run experience unverified.

**Why P2.** "Viewer-friendly" was a core requirement; unverified contrast is a broken promise.

**Build:**
1. axe-core run against every module (light + dark): fix all critical/serious violations (focus order, labels, roles, ARIA on canvas nodes, kanban cards, dialogs).
2. Contrast verification: compute ratios for every `--text-*` on every `--glass-bg-*` pairing in both themes; adjust tokens until AA (≥4.5 normal / ≥3 large) passes; document in `DESIGN_TOKENS.md` v2 (now cream+green).
3. Keyboard map: verify Ctrl/Cmd-K, arrows in kanban/lists, Enter/Space activation, Esc closes palette/dialogs, Alt+1..9 module switching; publish shortcut cheat-sheet (Ctrl/Cmd+?).
4. `prefers-reduced-motion` + `prefers-reduced-transparency` media queries: kill pulse/blur/slide under reduced prefs; fallbacks documented.
5. First-run wizard (3 steps): workspace name → connect provider or choose Ollama → import sample CSV → runs Dataset Triage preset (dry) and shows the finished job; skippable, re-openable from Help.

**Acceptance.** axe: 0 critical, 0 serious on all 12 modules in both themes; contrast table checked in; wizard completes to a real completed job in <2 minutes on a fresh profile.

**Output contract.** axe report · updated tokens · keyboard map doc · onboarding flow + analytics events (local only).
