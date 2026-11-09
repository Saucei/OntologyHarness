// Canonical hashing for import/export round-trip proof.
// Canonicalization: column order as declared, keys sorted, CRLF/LF normalized,
// numbers stringified with up to 6 significant decimals.

export type HashableDataset = { columns: { name: string; type: string }[]; rows: Record<string, string | number>[] }

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}

export function canonicalize(ds: HashableDataset): string {
  const cols = ds.columns.map(c => c.name)
  const norm = (v: string | number) => (typeof v === 'number' ? String(Math.round(v * 1e6) / 1e6) : String(v).replace(/\r\n|\n/g, '\n'))
  const lines = ds.rows.map(r => cols.map(c => norm(r[c] ?? '')).join('\u0001')).sort()
  return [cols.join('\u0001'), ...lines].join('\u0002')
}

export async function datasetHash(ds: HashableDataset): Promise<string> {
  return sha256Hex(canonicalize(ds))
}

/** Compare two canonical datasets; returns diff info for the UI. */
export function diffSummary(a: HashableDataset, b: HashableDataset): { equal: boolean; detail: string } {
  const colsA = a.columns.map(c => c.name).join(',')
  const colsB = b.columns.map(c => c.name).join(',')
  if (colsA !== colsB) return { equal: false, detail: `column mismatch: [${colsA}] vs [${colsB}]` }
  if (a.rows.length !== b.rows.length) return { equal: false, detail: `row count: ${a.rows.length} vs ${b.rows.length}` }
  const rowA = a.rows.map(r => a.columns.map(c => String(r[c.name])).join('|')).sort()
  const rowB = b.rows.map(r => b.columns.map(c => String(r[c.name])).join('|')).sort()
  for (let i = 0; i < rowA.length; i++) {
    if (rowA[i] !== rowB[i]) return { equal: false, detail: `first mismatch at row ${i + 1}` }
  }
  return { equal: true, detail: 'identical' }
}

/** Sidecar manifest written next to every export. */
export function exportManifest(sourceName: string, ds: HashableDataset, hash: string) {
  return JSON.stringify({
    tool: 'Ontology Harness',
    source: sourceName,
    columns: ds.columns.map(c => c.name),
    rows: ds.rows.length,
    hash,
    generatedAt: new Date().toISOString(),
  }, null, 2)
}
