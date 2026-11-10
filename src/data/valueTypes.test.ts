// Value-type + schema validation tests (S3-G) — pins Stage 2 Slice 1 behavior.
import { describe, it, expect } from 'vitest'
import { validateValue, validateObjectType } from './valueTypes'

describe('validateValue', () => {
  it('constrained patterns are enforced', () => {
    expect(validateValue('ValueType/WarehouseId', 'WH-001').ok).toBe(true)
    expect(validateValue('ValueType/WarehouseId', 'warehouse-1').ok).toBe(false)
    expect(validateValue('ValueType/ProductId', 'P-0001').ok).toBe(true)
    expect(validateValue('ValueType/ProductId', 'XB-441').ok).toBe(false)
  })

  it('VIN is 17 chars excluding I/O/Q', () => {
    expect(validateValue('ValueType/VIN', '1HGCM82633A004352').ok).toBe(true)
    expect(validateValue('ValueType/VIN', '1HGCM82633A0O4352').ok).toBe(false)
    expect(validateValue('ValueType/VIN', 'short').ok).toBe(false)
  })

  it('unknown types fail closed', () => {
    expect(validateValue('nope/Foo', 'x').ok).toBe(false)
  })
})

describe('validateObjectType', () => {
  it('experiment: duplicate properties block', () => {
    const issues = validateObjectType({
      id: 'x', name: 'X', backing: 'derived/x',
      properties: [{ name: 'a', type: 'String', indexed: true }, { name: 'a', type: 'String', indexed: false }],
    })
    expect(issues.some(i => /duplicate property/.test(i.message))).toBe(true)
  })

  it('seed fixture validates clean', () => {
    const issues = validateObjectType({
      id: 'ot-product', name: 'Vehicle Model', backing: 'ontology/product',
      properties: [
        { name: 'productId', type: 'ValueType/ProductId', indexed: true },
        { name: 'vin', type: 'ValueType/VIN', indexed: false },
      ],
    })
    expect(issues.length).toBe(0)
  })

  it('warns on missing indexed prop', () => {
    const issues = validateObjectType({ id: 'x', name: 'X', backing: 'derived/x', properties: [{ name: 'a', type: 'String', indexed: false }] })
    expect(issues.some(i => /no title/.test(i.message))).toBe(true)
  })
})
