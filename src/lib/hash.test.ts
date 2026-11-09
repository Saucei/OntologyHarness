// Round-trip + hashing tests (S3-G) — pins Stage 2 Slice 1 behavior.
import { describe, it, expect } from 'vitest'
import { canonicalize, datasetHash, diffSummary, type HashableDataset } from './hash'

const BREWERY: HashableDataset = {
  columns: [
    { name: 'sku', type: 'string' },
    { name: 'style', type: 'string' },
    { name: 'demand_bbl', type: 'number' },
  ],
  rows: [
    { sku: 'P-0001', style: 'Belgian Ale', demand_bbl: 220 },
    { sku: 'P-0002', style: 'IPA', demand_bbl: 211 },
    { sku: 'P-0003', style: 'DC Ale', demand_bbl: 158 },
  ],
}

const csvRoundTrip = (ds: HashableDataset): HashableDataset => {
  const head = ds.columns.map(c => c.name).join(',')
  const body = ds.rows.map(r => ds.columns.map(c => String(r[c.name])).join(',')).join('\n')
  const lines = (head + '\n' + body).split('\n')
  const headers = lines[0].split(',')
  return {
    columns: ds.columns,
    rows: lines.slice(1).map(l => {
      const vals = l.split(',')
      return Object.fromEntries(headers.map((h, i) => [h, ds.columns[i]?.type === 'number' ? Number(vals[i]) : vals[i]]))
    }),
  }
}

describe('canonicalization & hashing', () => {
  it('canonical form is deterministic regardless of row order', () => {
    const a = canonicalize(BREWERY)
    const b = canonicalize({ ...BREWERY, rows: [...BREWERY.rows].reverse() })
    expect(a).toBe(b)
  })

  it('hash is a 64-hex SHA-256 digest', async () => {
    const h = await datasetHash(BREWERY)
    expect(h).toMatch(/^[0-9a-f]{64}$/)
  })

  it('hash survives a CSV round-trip (the verified Slice 1 acceptance)', async () => {
    const original = await datasetHash(BREWERY)
    const roundTripped = csvRoundTrip(BREWERY)
    const after = await datasetHash(roundTripped)
    expect(after).toBe(original)
    expect(diffSummary(BREWERY, roundTripped)).toEqual({ equal: true, detail: 'identical' })
  })

  it('mutation changes the hash and diffSummary reports where', async () => {
    const mutated = { ...BREWERY, rows: BREWERY.rows.map((r, i) => (i === 1 ? { ...r, demand_bbl: 999 } : r)) }
    expect(await datasetHash(mutated)).not.toBe(await datasetHash(BREWERY))
    expect(diffSummary(BREWERY, mutated).equal).toBe(false)
  })

  it('column mismatch is reported', () => {
    const fewer = { columns: BREWERY.columns.slice(0, 2), rows: BREWERY.rows.map(r => ({ sku: r.sku, style: r.style })) }
    const d = diffSummary(BREWERY, fewer as any)
    expect(d.equal).toBe(false)
    expect(d.detail).toMatch(/column mismatch/)
  })
})
