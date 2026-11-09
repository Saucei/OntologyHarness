// FN-PLM-003 Use-LLM node — helpers + form (L0 client exec, no hard-coded model).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'

vi.mock('../llm/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../llm/client')>()
  return {
    ...actual,
    llmChat: vi.fn(async () => '{"label":"positive","score":0.9}'),
  }
})

import PipelineBuilder, {
  USE_LLM_COLUMNS,
  buildUseLlmPrompt,
  clampSentiment,
  createUseLlmConfig,
  stepperStep,
  summarizeUseLlmConfig,
  validateUseLlmConfig,
} from './PipelineBuilder'
import { PROVIDERS } from '../llm/client'

describe('Use-LLM helpers (FN-PLM-003)', () => {
  beforeEach(() => { localStorage.clear() })
  afterEach(() => cleanup())

  it('defaults come from the L0 registry, never a hard-coded model', () => {
    const cfg = createUseLlmConfig()
    expect(cfg.providerId).toBe(PROVIDERS[0].id)
    expect(cfg.model).toBe(PROVIDERS[0].defaultModel)
    expect(cfg.model.length).toBeGreaterThan(0)
    expect(USE_LLM_COLUMNS).toContain(cfg.column)
    expect(cfg.negValue).toBeLessThan(cfg.posValue)
  })

  it('stepper clamps to [-1, 1] and rejects inverted thresholds', () => {
    expect(clampSentiment(5)).toBe(1)
    expect(clampSentiment(-5)).toBe(-1)
    expect(stepperStep(0.95, 0.1)).toBe(1)
    expect(stepperStep(-0.95, -0.1)).toBe(-1)
    expect(stepperStep(0.3, 0.1)).toBe(0.4)

    const bad = createUseLlmConfig({ context: 'sentiment', negValue: 0.5, posValue: 0.2 })
    expect(validateUseLlmConfig(bad)).toContain('Positive value must be greater than Negative value')

    const empty = createUseLlmConfig({ context: '   ' })
    expect(validateUseLlmConfig(empty)).toContain('Business Context is required')

    const good = createUseLlmConfig({ context: 'retail sentiment', negValue: -0.3, posValue: 0.3 })
    expect(validateUseLlmConfig(good)).toEqual([])
  })

  it('prompt builder embeds context, column and thresholds', () => {
    const cfg = createUseLlmConfig({ context: 'retail sentiment', column: 'name', negValue: -0.3, posValue: 0.3 })
    const { system, user } = buildUseLlmPrompt(cfg)
    expect(system).toMatch(/retail sentiment/)
    expect(system).toMatch(/name/)
    expect(system).toMatch(/-0\.30/)
    expect(system).toMatch(/0\.30/)
    expect(user).toMatch(/name/)
    expect(summarizeUseLlmConfig(cfg)).toMatch(/"column": "name"/)
  })
})

describe('PipelineBuilder Use-LLM form', () => {
  beforeEach(() => { localStorage.clear() })
  afterEach(() => cleanup())

  it('renders Context, steppers, column picker, model picker, Show configurations, Apply/Create prompt and preview', () => {
    render(<PipelineBuilder />)
    expect(screen.getByLabelText('Business Context')).toBeTruthy()
    expect(screen.getByLabelText('Decrease Negative value')).toBeTruthy()
    expect(screen.getByLabelText('Increase Positive value')).toBeTruthy()
    expect(screen.getByTestId('stepper-negative-value')).toBeTruthy()
    expect(screen.getByTestId('stepper-positive-value')).toBeTruthy()
    expect(screen.getByLabelText('Input column')).toBeTruthy()
    expect(screen.getByLabelText('Model provider')).toBeTruthy()
    expect(screen.getByLabelText('Model')).toBeTruthy()
    expect(screen.getByLabelText('Show configurations')).toBeTruthy()
    expect(screen.getByLabelText('Create prompt')).toBeTruthy()
    expect(screen.getByLabelText('Apply')).toBeTruthy()
    expect(screen.getByTestId('use-llm-preview')).toBeTruthy()
    expect(screen.getByTestId('use-llm-panel')).toBeTruthy()
    // Palette advertises the Use-LLM tile (corpus-2 pipeline-llm)
    expect(screen.getAllByText(/Use LLM/).length).toBeGreaterThan(0)
  })

  it('Show configurations toggles JSON; steppers update values; invalid Apply shows alert', () => {
    render(<PipelineBuilder />)
    expect(screen.queryByTestId('use-llm-config-preview')).toBeNull()

    fireEvent.click(screen.getByLabelText('Show configurations'))
    expect(screen.getByTestId('use-llm-config-preview')).toBeTruthy()
    expect(screen.getByTestId('use-llm-config-preview').textContent).toMatch(/"providerId"/)

    fireEvent.click(screen.getByLabelText('Show configurations'))
    expect(screen.queryByTestId('use-llm-config-preview')).toBeNull()

    const negBefore = screen.getByTestId('stepper-negative-value').textContent
    fireEvent.click(screen.getByLabelText('Increase Negative value'))
    expect(screen.getByTestId('stepper-negative-value').textContent).not.toBe(negBefore)

    // Empty context → Apply must surface the first validation error without throwing.
    fireEvent.click(screen.getByLabelText('Apply'))
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toMatch(/Business Context/)
  })

  it('Create prompt composes the template; Run executes via the mocked L0 client', async () => {
    render(<PipelineBuilder />)
    fireEvent.change(screen.getByLabelText('Business Context'), { target: { value: 'retail sentiment' } })
    fireEvent.click(screen.getByLabelText('Create prompt'))
    expect(screen.getByLabelText('Prompt template')).toBeTruthy()
    expect((screen.getByLabelText('Prompt template') as HTMLTextAreaElement).value).toMatch(/retail sentiment/)

    fireEvent.click(screen.getByLabelText('Run Use LLM node'))
    await waitFor(() => expect(screen.getByTestId('use-llm-preview').textContent).toMatch(/positive/))
  })
})
