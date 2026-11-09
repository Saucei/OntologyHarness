# FN-BLD-SPLIT — Section splitting & Add-widget block

Tier T1 · Function IDs FN-BLD-001, FN-BLD-003 · Estimate: medium

## When this applies
Any empty or near-empty section in the Workshop canvas. Two paths:
(A) Split-section dropdown on a section header → explode it into above/below / left/right columns or rows with absolute/flex sizing.
(B) Dashed "Add widget" / "Set layout" affordance inside the empty section (matches the reference exactly).

## Reference affordances to mirror exactly
- Dashed border box with "+ Add widget" and "Set layout" button in the *exact* position — top-left of empty section, vertically centered.
- On non-empty sections, the same pair appears in the section header right edge.
- Split-section control: a segmented control in the section header (left column / right column / above / below) with icons, disabled siblings when a split is available.
- After split: left column gets selected automatically; focus moves into the widget-picker search (empty set ready).
- Layout choices for the new section come from the same layout-picker used elsewhere (Columns / Rows / Tabs / Flow / Toolbar / Loop).

## Build scope
1. Workshop canvas sections get `splitting` state: `null | 'columns' | 'rows'`.
2. New toolbar item in section header (three icon buttons): Add section above · Add section below · Split section (only when not already split).
3. New inline block in empty section: dashed card, centered text "Add widget" + button "Set layout" (with icon).
4. Set layout opens the shared layout-picker (same component used by Section settings) — Columns/Rows/Tabs/Flow/Toolbar/Loop.
5. When no widget exists, the inline block replaces the children area; once a widget is added it disappears entirely.
6. Keyboard: Alt+W (add widget to empty section) · Alt+L (open layout picker) · Alt+S (split highlighted section).
7. ARIA role="region" for the section with aria-label="Section: <name>"; role="button" + aria-label on all affordances.
8. Persist: write `splitting` into `meta.workshop.sections[]` (already persisted via patchMeta).

## Fail-safe
- Splitting a section that already contains widgets → only split the *empty column* after split (left empty), never duplicate widgets.
- Splitting a section with no widgets → no widgets duplicated; both columns identical state (both empty).
- Escape closes inline block without destructive effect.

## Acceptance
- Empty section shows dashed "+ Add widget / Set layout" block; delete it once a widget is added.
- Split produces two sections with a draggable divider (absolute→flex migration).
- Screenshot diff vs `instructor_…1753264093` and `1753347673` (empty stage) — pixel tolerance ±2px, text verbatim ("Add widget", "Set layout").
- Build green, console clean, reduced-motion respected.

## Non-goals
Do not duplicate Section-settings panel features here (header toggle, icon, background) — those belong to FN-BLD-006.
