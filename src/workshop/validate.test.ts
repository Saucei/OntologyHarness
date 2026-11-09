// Workshop validator tests (S3-G) — pins Slice 2 "block → fix → publish".
import { describe, it, expect } from 'vitest'
import { validateWorkshop, type WsSection } from './validate'

const sections: WsSection[] = [
  { id: 1, name: 'Main', widgets: [
    { id: 1, kind: 'object-table', label: 'Object Table 1', binding: 'Active object set · renamed: Orders', icon: 'table' as any },
    { id: 2, kind: 'property-list', label: 'Property List 2', binding: 'Input: Object table 1 Active object', icon: 'list' as any },
  ]},
]

describe('validateWorkshop', () => {
  it('clean config is publishable', () => {
    const v = validateWorkshop(sections, 'Order Overview')
    expect(v.ok).toBe(true)
    expect(v.widgetCount).toBe(2)
  })

  it('unbound widget blocks with its name', () => {
    const bad: WsSection[] = [{ id: 1, name: 'Main', widgets: [{ id: 1, kind: 'object-table', label: 'Object Table', binding: 'unbound · set Input Object Set', icon: 'table' as any }] }]
    const v = validateWorkshop(bad, 'M')
    expect(v.ok).toBe(false)
    expect(v.issues.join(' ')).toMatch(/Object Table/)
  })

  it('empty module blocks', () => {
    expect(validateWorkshop([], 'M').ok).toBe(false)
    expect(validateWorkshop(sections, '').ok).toBe(false)
  })

  it('object-table must bind to an object set, not a property-list binding', () => {
    const bad: WsSection[] = [{ id: 1, name: 'Main', widgets: [{ id: 1, kind: 'object-table', label: 'T', binding: 'Active object · Property binding', icon: 'table' as any }] }]
    const v = validateWorkshop(bad, 'M')
    expect(v.ok).toBe(false)
  })
})
