// T-34 agent orchestrator tests — native tool-calling bridge + text-protocol fallback.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runAgent } from './orchestrator'
import type { NativeChatResult } from '../llm/client'

vi.mock('../llm/client', async importOriginal => {
  const actual = await importOriginal<typeof import('../llm/client')>()
  return {
    ...actual,
    loadSettings: vi.fn(() => ({ ...actual.defaultSettings(), providerId: 'ollama', model: 'lfm2.5-2.6b-heretic:latest' })),
    llmChat: vi.fn(),
    llmChatTools: vi.fn(),
    providerById: vi.fn((id: string) => ({ ...actual.providerById(id) })),
    isTauriApp: vi.fn(() => false),
  }
})

import { llmChat, llmChatTools, providerById } from '../llm/client'

const mockChatTools = llmChatTools as ReturnType<typeof vi.fn>
const mockChat = llmChat as ReturnType<typeof vi.fn>

const native = (content: string, calls: Array<{ name: string; args?: any }>): NativeChatResult => ({
  content,
  toolCalls: calls.map(c => ({ name: c.name, args: c.args ?? {} })),
})

describe('runAgent — native tool-calling bridge (T-34)', () => {
  beforeEach(() => {
    mockChatTools.mockReset()
    mockChat.mockReset()
    ;(providerById as ReturnType<typeof vi.fn>).mockImplementation((id: string) => ({ id, kind: 'openai' }))
  })

  it('executes a native tool call, feeds the result back, returns the final answer', async () => {
    mockChatTools
      .mockResolvedValueOnce(native('', [{ name: 'ontology_get', args: { id: 'Process Stage' } }]))
      .mockResolvedValueOnce(native('Process Stage (ot-process) has 4 properties: stageId, name, taktSeconds, lineId.\nAction · Evidence (IDs) · Verification · Next step.', []))

    const steps: any[] = []
    const result = await runAgent('How many properties does Process Stage have?', { settings: { ...({} as any), providerId: 'ollama' }, onStep: s => steps.push(s) })

    expect(result.hops).toBe(2)
    expect(result.steps).toHaveLength(1)
    expect(result.steps[0].tool).toBe('ontology.get') // underscore → dot mapping
    expect(result.steps[0].ok).toBe(true)
    expect(result.steps[0].result.data.id).toBe('ot-process')
    expect(result.steps[0].result.data.properties.length).toBeGreaterThan(2)
    expect(result.answer).toContain('4 properties')
    // The tool registry was sent for native calling.
    const defs = mockChatTools.mock.calls[0][2]
    expect(defs.length).toBeGreaterThanOrEqual(6)
    expect(defs.every((d: any) => !!d.parameters)).toBe(true)
  })

  it('declines live destructive execution without approval and keeps going', async () => {
    mockChatTools
      .mockResolvedValueOnce(native('', [{ name: 'pipeline_run', args: { dryRun: false } }]))
      .mockResolvedValueOnce(native('Stopped — live execution declined.', []))

    const declined: any[] = []
    const result = await runAgent('Run the pipeline live', {
      settings: { ...({} as any), providerId: 'ollama' },
      onStep: s => declined.push(s),
      onApproval: () => Promise.resolve(false),
    })

    expect(declined[0].ok).toBe(false)
    expect(declined[0].result.error).toBe('declined')
    // The declined result was fed back to the model before the final answer.
    const secondTurnMessages = mockChatTools.mock.calls[1][1]
    expect(JSON.stringify(secondTurnMessages)).toContain('user declined live execution')
    expect(result.answer).toContain('declined')
  })

  it('honors an approval when granted', async () => {
    mockChatTools
      .mockResolvedValueOnce(native('', [{ name: 'workshop_publish', args: { dryRun: false } }]))
      .mockResolvedValueOnce(native('Workshop validated.', []))

    const result = await runAgent('Publish the workshop module', {
      settings: { ...({} as any), providerId: 'ollama' },
      onApproval: () => Promise.resolve(true),
    })

    expect(result.steps[0].ok).toBe(true)
    expect(result.steps[0].result.data.dryRun).toBe(false)
  })
})

describe('runAgent — <tool> text protocol (fallback + anthropic)', () => {
  beforeEach(() => {
    mockChatTools.mockReset()
    mockChat.mockReset()
    ;(providerById as ReturnType<typeof vi.fn>).mockImplementation((id: string) => ({ id, kind: 'openai' }))
  })

  it('uses the text protocol for non-openai providers', async () => {
    ;(providerById as ReturnType<typeof vi.fn>).mockImplementation((id: string) => ({ id, kind: 'anthropic' }))
    mockChat
      .mockResolvedValueOnce('<tool>{"name": "ontology.list", "args": {}}</tool>')
      .mockResolvedValueOnce('6 object types found. Action · Evidence (IDs) · Verification · Next step.')

    const result = await runAgent('List the object types', { settings: { ...({} as any), providerId: 'anthropic' } })

    expect(mockChatTools).not.toHaveBeenCalled()
    expect(result.steps[0].tool).toBe('ontology.list')
    expect(result.steps[0].result.data.objectTypes.length).toBeGreaterThan(3)
    expect(result.hops).toBe(2)
  })

  it('falls back to the text protocol when a native provider emits it instead of tool_calls', async () => {
    mockChatTools
      .mockResolvedValueOnce(native('<tool>{"name": "graph.query", "args": {"kind": "stage"}}</tool>', []))
      .mockResolvedValueOnce(native('Found 6 process stages.', []))

    const result = await runAgent('Show the stages', { settings: { ...({} as any), providerId: 'ollama' } })

    expect(result.steps[0].tool).toBe('graph.query')
    expect(result.steps[0].ok).toBe(true)
    expect(result.answer).toContain('6 process stages')
  })

  it('coaches the model after invalid JSON inside <tool> and survives to the hop limit', async () => {
    mockChatTools.mockResolvedValue(native('<tool>not json</tool>', []))
    const result = await runAgent('Do a thing', { settings: { ...({} as any), providerId: 'ollama' } })
    expect(result.hops).toBe(8)
    expect(result.answer).toContain('hop limit')
    expect(mockChatTools).toHaveBeenCalledTimes(8)
  })
})
