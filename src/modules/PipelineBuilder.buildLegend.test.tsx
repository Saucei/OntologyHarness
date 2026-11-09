// FN-PLM-001 build settings + FN-PLM-002 legend canvas tests.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

vi.mock('../llm/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../llm/client')>()
  return {
    ...actual,
    llmChat: vi.fn(async () => '{"label":"positive","score":0.9}'),
  }
})

import PipelineBuilder, {
  COMPUTE_PROFILES,
  createBuildSettings,
  validateBuildSettings,
  summarizeBuildSettings,
  describeBuildSettings,
  createLegendMapping,
  validateLegendMapping,
  legendTokenStyle,
  legendBadgeStyle,
  countDeployStatuses,
  deployStatusLabel,
} from './PipelineBuilder'

describe('Build settings helpers (FN-PLM-001)', () => {
  beforeEach(() => { localStorage.clear() })
  afterEach(() => cleanup())

  it('defaults are sane and include External-Databricks', () => {
    const s = createBuildSettings()
    expect(s.mode).toBe('batch')
    expect(s.computeProfile).toBe('standard')
    expect(s.scheduleCadence).toBe('manual')
    expect(s.outputNaming.length).toBeGreaterThan(0)
    expect(COMPUTE_PROFILES.some(p => p.id === 'external-databricks')).toBe(true)
    expect(validateBuildSettings(s)).toEqual([])
    expect(summarizeBuildSettings(s)).toMatch(/"mode": "batch"/)
    expect(describeBuildSettings(s)).toMatch(/batch/)
    expect(describeBuildSettings(s)).toMatch(/Standard/)
  })

  it('validation rejects empty naming, overlong naming and unknown profile/cadence', () => {
    expect(validateBuildSettings(createBuildSettings({ outputNaming: '   ' }))).toContain('Output naming is required')
    expect(validateBuildSettings(createBuildSettings({ outputNaming: 'x'.repeat(81) }))).toContain('Output naming must be 80 characters or fewer')
    expect(validateBuildSettings(createBuildSettings({ outputNaming: 'bad/name!' }))).toContain('Output naming may only contain letters, numbers, spaces and - _ { } .')
    expect(validateBuildSettings(createBuildSettings({ computeProfile: 'nope' as never }))).toContain('Compute profile is unknown')
    expect(validateBuildSettings(createBuildSettings({ scheduleCadence: 'nope' as never }))).toContain('Schedule cadence is unknown')
    expect(validateBuildSettings(createBuildSettings({ mode: 'nope' as never }))).toContain('Mode must be batch or streaming')
    const ok = createBuildSettings({ mode: 'streaming', computeProfile: 'external-databricks', scheduleCadence: 'daily', outputNaming: 'product_build_{date}_{runId}' })
    expect(validateBuildSettings(ok)).toEqual([])
  })

  it('streaming + External-Databricks describes as a valid selection', () => {
    const s = createBuildSettings({ mode: 'streaming', computeProfile: 'external-databricks' })
    expect(describeBuildSettings(s)).toMatch(/streaming/)
    expect(describeBuildSettings(s)).toMatch(/External-Databricks/)
  })
})

describe('Legend canvas helpers (FN-PLM-002)', () => {
  beforeEach(() => { localStorage.clear() })
  afterEach(() => cleanup())

  it('default mapping covers every dataset state with glass-token colors', () => {
    const m = createLegendMapping()
    expect(Object.keys(m)).toHaveLength(5)
    expect(validateLegendMapping(m)).toEqual([])
    expect(m.ontology).toBe('green')
    // Every token maps to a style (glass tokens only, no hex literals)
    for (const t of ['green', 'neutral', 'warn', 'danger', 'info'] as const) {
      const style = legendTokenStyle(t)
      expect(style.background).toBeTruthy()
      expect(style.color).toBeTruthy()
      expect(style.borderColor).toBeTruthy()
      expect(String(style.background)).not.toMatch(/#[0-9a-f]{3,6}/i)
    }
    expect(validateLegendMapping({ ...m, raw: '' as never })).toContain('Legend color for raw is required')
  })

  it('badge style resolves through the mapping and status counts are exact', () => {
    const m = createLegendMapping()
    const ontologyStyle = legendBadgeStyle('ontology', m)
    const rawStyle = legendBadgeStyle('raw', m)
    expect(ontologyStyle).toEqual(legendTokenStyle('green'))
    expect(rawStyle).toEqual(legendTokenStyle('neutral'))
    expect(ontologyStyle).not.toEqual(rawStyle)

    const counts = countDeployStatuses([
      { status: 'live' }, { status: 'live' }, { status: 'building' }, { status: 'failed' }, { status: 'queued' }, { status: 'queued' }, { status: 'queued' },
    ])
    expect(counts).toEqual({ live: 2, building: 1, failed: 1, queued: 3 })
    expect(deployStatusLabel('live')).toBe('Live')
    expect(deployStatusLabel('building')).toBe('Building')
    expect(deployStatusLabel('failed')).toBe('Failed')
    expect(deployStatusLabel('queued')).toBe('Queued')
  })
})

describe('PipelineBuilder build settings modal + legend canvas', () => {
  beforeEach(() => { localStorage.clear() })
  afterEach(() => cleanup())

  it('header exposes Build settings; modal edits mode/profile/cadence/naming and Escape closes it', () => {
    render(<PipelineBuilder />)
    expect(screen.getByLabelText('Open build settings')).toBeTruthy()
    expect(screen.getByTestId('build-settings-summary')).toBeTruthy()
    expect(screen.queryByTestId('build-settings-modal')).toBeNull()

    fireEvent.click(screen.getByLabelText('Open build settings'))
    const modal = screen.getByTestId('build-settings-modal')
    expect(modal.getAttribute('role')).toBe('dialog')
    expect(modal.getAttribute('aria-label')).toMatch(/Build settings/)

    // Batch/streaming toggle
    expect(screen.getByLabelText('Mode Batch')).toBeTruthy()
    expect(screen.getByLabelText('Mode Streaming')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Mode Streaming'))
    expect(screen.getByLabelText('Mode Streaming').getAttribute('aria-pressed')).toBe('true')

    // Compute profile select includes External-Databricks
    const compute = screen.getByLabelText('Compute profile') as HTMLSelectElement
    expect(compute.innerHTML).toMatch(/External-Databricks/)
    fireEvent.change(compute, { target: { value: 'external-databricks' } })
    expect(compute.value).toBe('external-databricks')

    // Schedule cadence
    const cadence = screen.getByLabelText('Schedule cadence') as HTMLSelectElement
    fireEvent.change(cadence, { target: { value: 'daily' } })
    expect(cadence.value).toBe('daily')

    // Output naming
    const naming = screen.getByLabelText('Output naming') as HTMLInputElement
    fireEvent.change(naming, { target: { value: 'custom_build_{date}' } })
    expect(naming.value).toBe('custom_build_{date}')

    // Cancel closes; reopening restores the persisted (unsaved) state
    fireEvent.click(screen.getByLabelText('Cancel build settings'))
    expect(screen.queryByTestId('build-settings-modal')).toBeNull()

    fireEvent.click(screen.getByLabelText('Open build settings'))
    fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' })
    expect(screen.queryByTestId('build-settings-modal')).toBeNull()
  })

  it('Save build settings persists and invalid output naming shows an alert', () => {
    render(<PipelineBuilder />)
    fireEvent.click(screen.getByLabelText('Open build settings'))
    fireEvent.change(screen.getByLabelText('Output naming'), { target: { value: '   ' } })
    fireEvent.click(screen.getByLabelText('Save build settings'))
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toMatch(/Output naming is required/)
    expect(screen.queryByTestId('build-settings-modal')).not.toBeNull()

    fireEvent.change(screen.getByLabelText('Output naming'), { target: { value: 'product_build_{date}_{runId}' } })
    fireEvent.click(screen.getByLabelText('Save build settings'))
    expect(screen.queryByTestId('build-settings-modal')).toBeNull()
    expect(screen.getByTestId('build-settings-summary').textContent).toMatch(/batch/)
  })

  it('Legend canvas renders mapping selects, deploy chips with counts, badges and Save applies the mapping', () => {
    render(<PipelineBuilder />)
    const canvas = screen.getByTestId('legend-canvas')
    expect(canvas.getAttribute('aria-label')).toMatch(/Legend canvas/)
    expect(canvas.getAttribute('role')).toBe('region')

    // Chips Live/Building/Failed/Queued with counts (7 seeded cards: 3 live, 1 building, 1 failed, 2 queued)
    expect(screen.getByTestId('legend-chip-live').textContent).toMatch(/Live/)
    expect(screen.getByTestId('legend-chip-live').textContent).toMatch(/3/)
    expect(screen.getByTestId('legend-chip-building').textContent).toMatch(/1/)
    expect(screen.getByTestId('legend-chip-failed').textContent).toMatch(/1/)
    expect(screen.getByTestId('legend-chip-queued').textContent).toMatch(/2/)

    // Dataset-state mapping selects
    for (const state of ['raw', 'clean', 'derived', 'ontology', 'llm']) {
      expect(screen.getByLabelText(`Legend color for ${state}`)).toBeTruthy()
    }
    expect(screen.getByTestId('legend-select-ontology')).toBeTruthy()
    // Deployed badges on cards
    expect(document.querySelector('[data-testid^="deploy-badge-"]')).toBeTruthy()
    expect(screen.getByTestId('legend-preview')).toBeTruthy()

    // Changing the draft does not move applied badges until Save applies the mapping
    const appliedBefore = screen.getByTestId('legend-applied-ontology').textContent
    fireEvent.change(screen.getByLabelText('Legend color for ontology'), { target: { value: 'danger' } })
    expect(screen.getByTestId('legend-applied-ontology').textContent).toBe(appliedBefore)

    fireEvent.click(screen.getByLabelText('Save legend mapping'))
    expect(screen.getByTestId('legend-applied-ontology').textContent).toMatch(/danger/)
  })

  it('Use-LLM panel is still intact (no regression)', () => {
    render(<PipelineBuilder />)
    expect(screen.getByLabelText('Business Context')).toBeTruthy()
    expect(screen.getByTestId('use-llm-panel')).toBeTruthy()
    expect(screen.getByTestId('pipeline-preview')).toBeTruthy()
  })
})
