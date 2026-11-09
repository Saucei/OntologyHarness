// Shared Workshop module validation — used by the Publish button AND the agent tool,
// so a human and an agent get the same verdict on the same config.
export type WsWidget = { id: number; kind: string; label: string; binding: string; icon: any }
export type WsSection = { id: number; name: string; widgets: WsWidget[] }
export type WsValidation = { ok: boolean; issues: string[]; widgetCount: number; boundCount: number }

export function validateWorkshop(sections: WsSection[], moduleName: string): WsValidation {
  const widgets = sections.flatMap(s => s.widgets)
  const issues: string[] = []
  if (!moduleName.trim()) issues.push('module has no name')
  if (widgets.length === 0) issues.push('module has no widgets')
  for (const w of widgets) {
    if (!w.binding || /unbound|set input object set/i.test(w.binding)) {
      issues.push(`${w.kind} "${w.label}" — input object set not bound`)
    }
  }
  // Object Table must declare an object-set query. "Active object" alone is a
  // property-list binding (single object), so it is rejected here; a valid
  // binding says "object set" (or an object-set query id like OrderSet).
  const tables = widgets.filter(w => w.kind === 'object-table')
  for (const t of tables) {
    const declaresSet = /object[\s_-]?set/i.test(t.binding) || /(^|\b)queryset\b/i.test(t.binding) || /(^|\b)orderset\b/i.test(t.binding)
    if (!declaresSet) issues.push(`object-table "${t.label}" — bind to an Object Set (single-object bindings invalid for tables)`)
  }
  return { ok: issues.length === 0, issues, widgetCount: widgets.length, boundCount: widgets.length - issues.length }
}
