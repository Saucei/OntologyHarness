// FN-AST-004 Tools binding + FN-AST-010 System prompt editor — pure helpers
// plus the two host panels (AgentConsole tools binding, AipLogicPanel
// prompt editor tabs/toolbar/cascading "/" menu). Glass tokens only;
// every persisted mutation patches ws.meta with appendTrace + appendAudit.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

import AipLogicPanel, {
  applyMarkdown,
  applySlashInsert,
  filterSlashItems,
  nextSlashIndex,
  slashItems,
} from './AipLogicPanel'
import AgentConsole, {
  isBindingToolPermitted,
  loadToolBindings,
  TOOL_BINDING_META_KEY,
  TOOL_BINDING_TYPES,
} from './AgentConsole'
import { ws } from '../store'
import { defaultPermissions, toggleToolEnabled, type ToolPermissionsState } from '../agent/permissions'

const readAudit = (): any[] => {
  try { return JSON.parse(localStorage.getItem('ontology-harness.audit') ?? '[]') } catch { return [] }
}

beforeEach(() => {
  localStorage.clear()
  ws.meta = {}
  ws.traces.length = 0
  ws.hydrated = true
})
afterEach(() => cleanup())

describe('prompt editor helpers (FN-AST-010)', () => {
  it('applyMarkdown wraps selections for bold/italic/code and drops a caret pair when empty', () => {
    const bold = applyMarkdown('hello world', 0, 5, 'bold')
    expect(bold.text).toBe('**hello** world')
    expect([bold.selStart, bold.selEnd]).toEqual([2, 7])

    const italic = applyMarkdown('hello world', 6, 11, 'italic')
    expect(italic.text).toBe('hello *world*')
    expect([italic.selStart, italic.selEnd]).toEqual([7, 12])

    const code = applyMarkdown('hello world', 0, 5, 'code')
    expect(code.text).toBe('`hello` world')

    const empty = applyMarkdown('hi', 2, 2, 'bold')
    expect(empty.text).toBe('hi****')
    expect([empty.selStart, empty.selEnd]).toEqual([4, 4])
  })

  it('applyMarkdown toggles "- " list prefixes on the touched lines', () => {
    const listed = applyMarkdown('one\ntwo', 0, 7, 'list')
    expect(listed.text).toBe('- one\n- two')

    const unlisted = applyMarkdown('- one\n- two', 0, 11, 'list')
    expect(unlisted.text).toBe('one\ntwo')
  })

  it('slash helpers filter by query, replace the trigger token, and wrap navigation', () => {
    const items = slashItems([{ name: 'input1' }, { name: 'includePartnerFlights' }])
    expect(items.some(i => i.id === 'tool-apply-action')).toBe(true)
    expect(items.some(i => i.insert === '$input1')).toBe(true)

    expect(filterSlashItems(items, 'app').map(i => i.id)).toContain('tool-apply-action')
    expect(filterSlashItems(items, '')).toHaveLength(items.length)

    const inserted = applySlashInsert('hello /app', 10, { insert: '{{apply-action:}}' })
    expect(inserted.text).toBe('hello {{apply-action:}}')
    expect(inserted.cursorPos).toBe('hello {{apply-action:}}'.length)

    expect(nextSlashIndex(0, 1, 3)).toBe(1)
    expect(nextSlashIndex(2, 1, 3)).toBe(0)
    expect(nextSlashIndex(0, -1, 3)).toBe(2)
    expect(nextSlashIndex(0, 1, 0)).toBe(0)
  })
})

describe('tools binding permission gate (FN-AST-004)', () => {
  it('isBindingToolPermitted follows evaluatePermission + free-form bindings', () => {
    const s0 = defaultPermissions()
    expect(isBindingToolPermitted('pipeline.run', s0)).toBe(false)

    const s1 = toggleToolEnabled(s0, 'pipeline.run')
    // Seeded rule: If branch master → Ask / Else Allow → permitted either way.
    expect(isBindingToolPermitted('pipeline.run', s1)).toBe(true)
    expect(isBindingToolPermitted('graph.query', s1)).toBe(false)
    // Free-form (Custom / SQL) tool names are not gated by the registry matrix.
    expect(isBindingToolPermitted('', s1)).toBe(true)
    expect(isBindingToolPermitted('my-custom-tool', s1)).toBe(true)

    const sDeny: ToolPermissionsState = {
      enabled: ['pipeline.run'],
      decisions: { 'pipeline.run': 'deny' },
      rules: [],
    }
    expect(isBindingToolPermitted('pipeline.run', sDeny)).toBe(false)
  })
})

describe('AipLogicPanel prompt editor (FN-AST-010)', () => {
  it('renders tabs + toolbar and formats a selection with Bold', () => {
    render(<AipLogicPanel />)
    for (const tab of ['system', 'developer', 'examples']) {
      expect(screen.getByTestId(`prompt-tab-${tab}`)).toBeTruthy()
    }
    expect(screen.getByTestId('prompt-toolbar')).toBeTruthy()

    const ta = screen.getByTestId('prompt-editor') as HTMLTextAreaElement
    ta.setSelectionRange(0, 3)
    fireEvent.click(screen.getByTestId('prompt-fmt-bold'))
    expect(ta.value.startsWith('**You**')).toBe(true)
    expect(ws.traces.some(t => t.tool === 'prompt.format' && t.ok)).toBe(true)
    expect(readAudit().some(a => a.event === 'prompt-format')).toBe(true)
  })

  it('tab switch persists per-tab text via ws.meta with trace + audit', () => {
    render(<AipLogicPanel />)
    fireEvent.click(screen.getByTestId('prompt-tab-developer'))
    expect((screen.getByTestId('prompt-editor') as HTMLTextAreaElement).value).toBe('')

    fireEvent.change(screen.getByTestId('prompt-editor'), { target: { value: 'dev notes' } })
    expect((ws.meta?.aipPromptEditor as any)?.developer).toBe('dev notes')
    expect(ws.traces.some(t => t.tool === 'prompt.tab' && t.ok)).toBe(true)
    expect(readAudit().some(a => a.event === 'prompt-tab')).toBe(true)
  })

  it('"/" opens the cascading menu; arrows navigate and Enter inserts the active item', () => {
    render(<AipLogicPanel />)
    const ta = screen.getByTestId('prompt-editor') as HTMLTextAreaElement

    // Bare "/" → group menu; Enter opens the Tools submenu; ArrowDown picks Call function.
    fireEvent.change(ta, { target: { value: '/' } })
    expect(screen.getByTestId('prompt-editor-menu')).toBeTruthy()
    expect(screen.getByTestId('slash-group-tools')).toBeTruthy()

    fireEvent.keyDown(ta, { key: 'Enter' })
    expect(screen.getByTestId('slash-submenu')).toBeTruthy()

    fireEvent.keyDown(ta, { key: 'ArrowDown' })
    fireEvent.keyDown(ta, { key: 'Enter' })
    expect(ta.value).toBe('{{call-function:}}')
    expect(ws.traces.some(t => t.tool === 'prompt.slash-insert' && t.ok)).toBe(true)
    expect(readAudit().some(a => a.event === 'prompt-slash-insert')).toBe(true)
  })

  it('query-filtered "/" inserts at the caret (variable from agent inputs)', () => {
    render(<AipLogicPanel />)
    const ta = screen.getByTestId('aip-question') as HTMLTextAreaElement
    fireEvent.change(ta, { target: { value: 'hello /input' } })
    expect(screen.getByTestId('aip-question-menu')).toBeTruthy()

    ta.setSelectionRange(12, 12)
    fireEvent.keyDown(ta, { key: 'Enter' })
    expect(ta.value).toBe('hello $input1')
    expect(ws.traces.some(t => t.tool === 'prompt.slash-insert' && t.ok)).toBe(true)
  })
})

describe('AgentConsole tools binding (FN-AST-004)', () => {
  const allowPipeline = () => {
    ws.meta = { toolPermissions: { enabled: ['pipeline.run'], decisions: {}, rules: [] } }
  }

  it('renders the four tool types and a permission-disabled tool option', () => {
    allowPipeline()
    render(<AgentConsole />)
    const typeSelect = screen.getByTestId('tool-binding-type') as HTMLSelectElement
    expect(typeSelect).toBeTruthy()
    expect(TOOL_BINDING_TYPES.map(t => t.label)).toEqual(['Apply action', 'Call function', 'Ontology SQL', 'Custom tool'])

    const toolSelect = screen.getByTestId('tool-binding-tool') as HTMLSelectElement
    const pipelineOption = toolSelect.querySelector('option[value="pipeline.run"]') as HTMLOptionElement
    const graphOption = toolSelect.querySelector('option[value="graph.query"]') as HTMLOptionElement
    expect(pipelineOption.disabled).toBe(false)
    expect(graphOption.disabled).toBe(true)
  })

  it('Add persists the binding via ws.meta with trace + audit; automated toggles too', () => {
    allowPipeline()
    render(<AgentConsole />)
    fireEvent.change(screen.getByTestId('tool-binding-tool'), { target: { value: 'pipeline.run' } })

    const add = screen.getByTestId('tool-binding-add') as HTMLButtonElement
    expect(add.disabled).toBe(false)
    fireEvent.click(add)

    expect(loadToolBindings()).toHaveLength(1)
    expect(loadToolBindings()[0].toolName).toBe('pipeline.run')
    expect(((ws.meta?.[TOOL_BINDING_META_KEY] ?? []) as any[]).length).toBe(1)
    expect(ws.traces.some(t => t.tool === 'tools-binding.add' && t.ok)).toBe(true)
    expect(readAudit().some(a => a.event === 'tools-binding-add')).toBe(true)

    const row = screen.getByTestId(/tool-binding-row-/)
    expect(row).toBeTruthy()

    const automatedBtn = screen.getByTestId(/tool-binding-automated-/)
    fireEvent.click(automatedBtn)
    expect(loadToolBindings()[0].automated).toBe(true)
    expect(ws.traces.some(t => t.tool === 'tools-binding.automated' && t.ok)).toBe(true)
    expect(readAudit().some(a => a.event === 'tools-binding-automated')).toBe(true)
  })
})
