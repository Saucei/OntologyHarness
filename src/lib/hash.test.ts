// Round-trip + hashing tests (S3-G) — pins Stage 2 Slice 1 behavior.
import { describe, it, expect } from 'vitest'
import { canonicalize, datasetHash, diffSummary, type HashableDataset } from './hash'

const UNITS: HashableDataset = {
  columns: [
    { name: 'unit_id', type: 'string' },
    { name: 'model_id', type: 'string' },
    { name: 'stage_id', type: 'string' },
  ],
  rows: [
    { unit_id: 'U-0001', model_id: 'P-0001', stage_id: 'STG-060' },
    { unit_id: 'U-0002', model_id: 'P-0002', stage_id: 'STG-050' },
    { unit_id: 'U-0003', model_id: 'P-0001', stage_id: 'STG-060' },
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
    const a = canonicalize(UNITS)
    const b = canonicalize({ ...UNITS, rows: [...UNITS.rows].reverse() })
    expect(a).toBe(b)
  })

  it('hash is a 64-hex SHA-256 digest', async () => {
    const h = await datasetHash(UNITS)
    expect(h).toMatch(/^[0-9a-f]{64}$/)
  })

  it('hash survives a CSV round-trip (the verified Slice 1 acceptance)', async () => {
    const original = await datasetHash(UNITS)
    const roundTripped = csvRoundTrip(UNITS)
    const after = await datasetHash(roundTripped)
    expect(after).toBe(original)
    expect(diffSummary(UNITS, roundTripped)).toEqual({ equal: true, detail: 'identical' })
  })

  it('mutation changes the hash and diffSummary reports where', async () => {
    const mutated = { ...UNITS, rows: UNITS.rows.map((r, i) => (i === 1 ? { ...r, stage_id: 'STG-010' } : r)) }
    expect(await datasetHash(mutated)).not.toBe(await datasetHash(UNITS))
    expect(diffSummary(UNITS, mutated).equal).toBe(false)
  })

  it('column mismatch is reported', () => {
    const fewer = { columns: UNITS.columns.slice(0, 2), rows: UNITS.rows.map(r => ({ unit_id: r.unit_id, model_id: r.model_id })) }
    const d = diffSummary(UNITS, fewer as any)
    expect(d.equal).toBe(false)
    expect(d.detail).toMatch(/column mismatch/)
  })
})
