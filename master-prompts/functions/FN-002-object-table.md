# FN-BLD-TABLE — Object Table column configuration

Tier T1 · Function IDs FN-BLD-009, FN-BLD-010, FN-BLD-011, FN-BLD-012 · Estimate: medium-large

## When this applies
Workshop canvas → Object Table widget (any of type object-table). The properties side panel gets a Columns tab (above classic Widget setup) that exactly mirrors the reference layout.

## Reference affordances to mirror exactly
1. Header: "Column Configuration" title + "Set default sort" + "Add column" + overflow menu.
2. Action buttons in header row:
   - "Add all properties" (fills column list with every ORDER property, preserves order In DB sequence).
   - "Remove all properties" (trash icon, confirm inline).
   - "Enable inline editing" toggle (disabled → info tip why it's disabled: read-only table source).
3. Each column row: drag handle (6 dots), property name, type chip, rename arrow. Products/Customers/etc.
4. Drag-to-reorder via ▲▼ move buttons (drag handle optional; keyboard Alt+↑/Alt+↓ can be added later); undo = Ctrl+Z on table snapshot.
5. Section-owned toggle "Enable object table filtering" (INPUT DATA header) — identical placement/shape as current workshop screen.
6. Empty state: dashed box centered: "Add column" button.

## Build scope
1. New tab strip in the Inspector: "Widget setup" | "Column Configuration".
2. Column visibility = property name source of truth: `meta.workshop.widgets[id].columns` (array of {propertyId, name, type, order, aliases[]}).
3. Drag-reorder updates all sequence references (visible-fields list re-renders).
4. "Remove all properties" asks inline confirmation (button transforms to "Confirm Remove" with a second click).
5. Keyboard: Tab cycles rows, Alt+↑/Alt+↓ reorders, Ctrl+A select all, Delete removes selected.
6. Column rows show property type as chip: integer/String/enum/timestamp.
7. Filtering toggle in INPUT DATA section already exists in UI — bind it to `meta.workshop.widgets[id].filteringEnabled`. Enabling on save = silent append; no cross-section coupling.

## Fail-safe
- Bulk remove with rows still bound to actions → blocked with reason ("Column X referenced by action 'Archive order'").
- Removing last column → show info banner "Table will render empty" but do not block.
- Renames must be unique within table (block duplicates inline).

## Acceptance
- Add all properties populates the property list in one click.
- Drag reorder persists after reload.
- Enable filtering toggle flips without full page reload.
- Screenshot diff vs `instructor_…1753275160_7+-+Object+Table+Props+Config` — tolerance ±2px on hit targets.
- Build green, console clean.

## Non-goals
Do not touch Section height/flex/scroll here — that's FN-BLD-004/005. Column width belongs to FN-BLD-013/Layout tree (later slice).
