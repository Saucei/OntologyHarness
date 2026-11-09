# FN-BLD-HI — Layout tree click-to-select + Section style

Tier T2 · Function IDs FN-BLD-013, FN-BLD-007, FN-BLD-008 · Estimate: medium

## When this applies
Workshop canvas (build). These three together make the canvas navigable without hunting small hit-targets.

## Build scope
1. **Layout tree** — pinned at top of the left palette:
   - Page → Sections → Widgets
   - Each row: icon + name, indent by depth
   - Click = select (same state used by canvas selection + config panel)
   - Selected node highlighted, expand/collapse chevrons
   - Keyboard: ↑↓ move, ←/→ collapse/expand, Enter select
   - ARIA role="tree", role="treeitem", aria-expanded
2. **Color override** — 4 swatches in section header (only on hover/focus, or always visible in expanded state):
   - `#faf7ef` (default cream), `#e8f5e9` (mint), `#fff3e0` (amber), `#eef2ff` (indigo-50)
   - Chosen background on `.ws-section`, dark mode uses `#1b2320`–`#212b25` variants
   - Persists in `meta.workshop.sections[]` alongside splitting/headerStyle
3. **Collapsible section** — chevron in section header toggles `collapsed`:
   - Collapsed = children hidden, header stays, count badge visible
   - Expanded with header visible matches `unstyled` button in reference (expanded = shows rows)
   - Persists same way

## Fail-safe
- Collapsed section with selected widget → config panel still shows; canvas selection outline hides.
- Color changes never alter binding state; no destructive ops.
- Tree selection never triggers publish/save side effects.

## Acceptance
- Clicking tree item selects canvas widget identical to direct click.
- Color swatch wins visual precedence over default; survives reload (persists via patchMeta).
- Chevron collapses/expand children instantly; node count badge always visible.
- Build green, console clean, reduced-motion respected.

## Non-goals
No drag-to-reorder in tree (explicit future FN); no color-wheel picker; no gradients.
