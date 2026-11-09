// T-32 — T1 folder install: PluginManager folder flow with mocked Tauri invoke.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'

const manifests = {
  'my-presets': JSON.stringify({ id: 'folder-presets', name: 'Folder Presets', version: '1.2.0', kind: 'presets', api: '^1.0' }),
}
const presetsPayload = JSON.stringify([{ id: 'p-9', name: 'Folder preset', systemPrompt: 's', userTemplate: 'u' }])

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async (cmd: string) => {
    if (cmd === 'list_local_packs') {
      return [{ dir: 'my-presets', manifest: manifests['my-presets'], files: { 'presets.json': presetsPayload } }]
    }
    throw new Error(`unexpected command ${cmd}`)
  }),
}))

import PluginManager from './PluginManager'
import { ws } from '../store'

const readAudit = (): any[] => {
  try {
    return JSON.parse(localStorage.getItem('ontology-harness.audit') ?? '[]')
  } catch {
    return []
  }
}

beforeEach(() => {
  localStorage.clear()
  ws.meta = {}
  ws.traces.length = 0
})
afterEach(() => cleanup())

describe('PluginManager folder flow (T-32)', () => {
  it('renders folder install controls without breaking URL/paste install', () => {
    render(<PluginManager />)
    expect(screen.getByTestId('folder-install-panel')).toBeTruthy()
    expect(screen.getByTestId('folder-install-btn').textContent).toMatch(/Install from folder/)
    expect(screen.getByTestId('folder-scan-btn').textContent).toMatch(/Scan folder/)
    expect(screen.getByTestId('folder-install-input')).toBeTruthy()
    // existing URL/paste install surface still present
    expect(screen.getByText(/Fetch \+ validate/)).toBeTruthy()
    expect(screen.getByText(/Paste JSON/)).toBeTruthy()
  })

  it('scan discovers packs via mocked invoke, then install persists + traces/audits', async () => {
    render(<PluginManager />)
    fireEvent.click(screen.getByTestId('folder-scan-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('folder-scan-list')).toBeTruthy()
    })
    expect(screen.getByTestId('folder-scan-list').textContent).toContain('Folder Presets')
    expect(screen.getByTestId('folder-install-my-presets')).toBeTruthy()
    expect(ws.traces.some(t => t.tool === 'plugin.folder.scan' && t.ok)).toBe(true)

    fireEvent.click(screen.getByTestId('folder-install-my-presets'))

    await waitFor(() => {
      expect(screen.getByText(/from local folder/)).toBeTruthy()
    })
    const records = (ws.meta?.customPacks ?? []) as any[]
    expect(records.some(r => r.source === 'folder' && r.sourceUrl === 'my-presets' && typeof r.files?.['presets.json'] === 'string')).toBe(true)
    expect(ws.traces.some(t => t.tool === 'plugin.folder.install' && t.ok)).toBe(true)
    expect(readAudit().some(a => a.action === 'plugin:install' && a.target === 'folder-presets')).toBe(true)

    // installed pack card appears in the grid
    expect(document.body.textContent).toContain('Folder Presets')
    expect(document.body.textContent).toContain('custom')
  })
})
