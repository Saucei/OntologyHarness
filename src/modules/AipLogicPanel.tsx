import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { composerTriggerQuery, detectComposerTrigger, loadSettings, providerById, llmChatStream, type ChatMessage } from '../llm/client'
import { OBJECT_TYPES } from '../data/ontology'
import { retrieve, buildGroundedPrompt, type ScoredChunk } from '../aip/retrieval'
import { ws, patchMeta, appendTrace, appendAudit } from '../store'
import { loadAgentInputs } from '../agent/variables'

type TraceStep = { label: string; detail: string; ms: string; ok: boolean }

const CANNED_ANSWER =
  'The recommended treatment for pulmonary tuberculosis involves a regimen of isoniazid, rifampin, pyrazinamide and ethambutol for 2 months, followed by isoniazid + rifampin for 4 months. Intensive-phase adherence is critical; pyridoxine supplements prevent neuropathy. [1][2] Source: Clinical Guidelines · TB §14–27.'

const STORAGE_ID = 'aipLogics'

// ── FN-AST-010 System prompt editor ───────────────────────────────
// Tabs (System / Developer / Examples) + rich-text toolbar
// (bold/italic/code/list) + cascading "/" menu. Persisted in
// ws.meta[aipPromptEditor] via patchMeta — no new store APIs.
export const PROMPT_EDITOR_META_KEY = 'aipPromptEditor'
export const PROMPT_TAB_META_KEY = 'aipPromptTab'

export type PromptTabId = 'system' | 'developer' | 'examples'
export type PromptFormatKind = 'bold' | 'italic' | 'code' | 'list'

export const PROMPT_TABS: Array<{ id: PromptTabId; label: string }> = [
  { id: 'system', label: 'System' },
  { id: 'developer', label: 'Developer' },
  { id: 'examples', label: 'Examples' },
]

export type PromptEditorState = Record<PromptTabId, string>

const DEFAULT_SYSTEM_PROMPT =
  'You are a clinical-ops assistant. Using the retrieved guideline chunks, answer concisely with citations:\n\nQuestion: What is the recommended treatment for Tuberculosis?'

export function defaultPromptEditor(): PromptEditorState {
  return { system: DEFAULT_SYSTEM_PROMPT, developer: '', examples: '' }
}

function isPromptTabId(v: any): v is PromptTabId {
  return v === 'system' || v === 'developer' || v === 'examples'
}

/** Load + sanitize prompt editor tabs from ws.meta; defaults when unset. */
export function loadPromptEditor(): PromptEditorState {
  const raw = (ws.meta as Record<string, any>)?.[PROMPT_EDITOR_META_KEY]
  const d = defaultPromptEditor()
  if (!raw || typeof raw !== 'object') return { ...d }
  return {
    system: typeof raw.system === 'string' ? raw.system : d.system,
    developer: typeof raw.developer === 'string' ? raw.developer : d.developer,
    examples: typeof raw.examples === 'string' ? raw.examples : d.examples,
  }
}

export function savePromptEditor(state: PromptEditorState): void {
  patchMeta({ [PROMPT_EDITOR_META_KEY]: state })
}

export type MarkdownResult = { text: string; selStart: number; selEnd: number }

/**
 * Rich-text toolbar edit. Bold/Italic/Code wrap the selection (or drop a
 * caret pair when empty). List toggles "- " prefixes on the touched lines.
 */
export function applyMarkdown(
  text: string,
  selStart: number,
  selEnd: number,
  kind: PromptFormatKind,
): MarkdownResult {
  const start = Math.max(0, Math.min(Math.floor(selStart) || 0, text.length))
  const end = Math.max(start, Math.min(Math.floor(selEnd) || 0, text.length))
  const selected = text.slice(start, end)
  if (kind === 'bold') {
    if (!selected) {
      return { text: text.slice(0, start) + '****' + text.slice(end), selStart: start + 2, selEnd: start + 2 }
    }
    return { text: text.slice(0, start) + '**' + selected + '**' + text.slice(end), selStart: start + 2, selEnd: end + 2 }
  }
  if (kind === 'italic') {
    if (!selected) {
      return { text: text.slice(0, start) + '**' + text.slice(end), selStart: start + 1, selEnd: start + 1 }
    }
    return { text: text.slice(0, start) + '*' + selected + '*' + text.slice(end), selStart: start + 1, selEnd: end + 1 }
  }
  if (kind === 'code') {
    if (!selected) {
      return { text: text.slice(0, start) + '``' + text.slice(end), selStart: start + 1, selEnd: start + 1 }
    }
    return { text: text.slice(0, start) + '`' + selected + '`' + text.slice(end), selStart: start + 1, selEnd: end + 1 }
  }
  // list — expand block to full line boundaries, then toggle prefixes.
  const lineStart = text.lastIndexOf('\n', Math.max(0, start - 1)) + 1
  const blockEndIdx = text.indexOf('\n', end)
  const blockEnd = blockEndIdx === -1 ? text.length : blockEndIdx
  const block = text.slice(lineStart, blockEnd)
  const lines = block.split('\n')
  const allListed = lines.length > 0 && lines.every(l => l.startsWith('- '))
  const nextLines = allListed
    ? lines.map(l => (l.startsWith('- ') ? l.slice(2) : l))
    : lines.map(l => (l.startsWith('- ') ? l : `- ${l}`))
  const next = nextLines.join('\n')
  const touchedCount = Math.max(1, text.slice(lineStart, end).split('\n').length)
  const touched = lines.slice(0, touchedCount)
  const changed = touched.filter(l => (allListed ? l.startsWith('- ') : !l.startsWith('- '))).length
  const delta = allListed ? -2 * changed : 2 * changed
  const firstChanged = allListed ? lines[0]?.startsWith('- ') : !lines[0]?.startsWith('- ')
  const selStart2 = start + (firstChanged ? (allListed ? -2 : 2) : 0)
  return {
    text: text.slice(0, lineStart) + next + text.slice(blockEnd),
    selStart: Math.max(lineStart, selStart2),
    selEnd: Math.max(start, end + delta),
  }
}

// ── Cascading "/" menu ──────────────────────────────────────────
// Groups (Tools / Variables / Docs); Tools mirrors the four FN-AST-004
// binding types. Filtered by the trigger query, inserted at the caret.
export type SlashGroupId = 'tools' | 'variables' | 'docs'

export const SLASH_GROUPS: Array<{ id: SlashGroupId; label: string }> = [
  { id: 'tools', label: 'Tools' },
  { id: 'variables', label: 'Variables' },
  { id: 'docs', label: 'Docs' },
]

export type SlashItem = {
  id: string
  label: string
  insert: string
  group: SlashGroupId
  hint?: string
}

export function slashGroupLabel(group: SlashGroupId): string {
  return SLASH_GROUPS.find(g => g.id === group)?.label ?? group
}

export function slashItems(variables: Array<{ name: string }> = []): SlashItem[] {
  const items: SlashItem[] = [
    { id: 'tool-apply-action', label: 'Apply action', insert: '{{apply-action:}}', group: 'tools', hint: 'Bind an ontology action' },
    { id: 'tool-call-function', label: 'Call function', insert: '{{call-function:}}', group: 'tools', hint: 'Bind an AIP function' },
    { id: 'tool-ontology-sql', label: 'Ontology SQL', insert: '{{ontology-sql:}}', group: 'tools', hint: 'Bind a read-only SQL query' },
    { id: 'tool-custom-tool', label: 'Custom tool', insert: '{{custom-tool:}}', group: 'tools', hint: 'Bind a custom-defined tool' },
  ]
  for (const v of variables) {
    const name = (v?.name ?? '').trim()
    if (!name) continue
    items.push({ id: `var-${name}`, label: `$${name}`, insert: `$${name}`, group: 'variables', hint: `Variable ${name}` })
  }
  items.push(
    { id: 'doc-cite', label: 'Cite sources', insert: '[cite: [n]]', group: 'docs', hint: 'Require inline [n] citations' },
    { id: 'doc-refuse', label: 'Cite-or-refuse', insert: 'Cite-or-refuse: answer only with grounded citations; refuse otherwise.', group: 'docs', hint: 'Inline grounding policy' },
  )
  return items
}

/** Case-insensitive substring filter over label/hint/id; empty query → all. */
export function filterSlashItems(items: SlashItem[], query: string): SlashItem[] {
  const q = (query ?? '').trim().toLowerCase()
  if (!q) return [...items]
  return items.filter(
    it =>
      it.label.toLowerCase().includes(q) ||
      (it.hint ?? '').toLowerCase().includes(q) ||
      it.id.toLowerCase().includes(q),
  )
}

/**
 * Replace the active "/query" trigger token ending at cursorPos with the
 * item's insert text. Falls back to a plain insert when no trigger is found.
 */
export function applySlashInsert(
  text: string,
  cursorPos: number,
  item: Pick<SlashItem, 'insert'>,
): { text: string; cursorPos: number } {
  const caret = Math.max(0, Math.min(Math.floor(cursorPos) || 0, text.length))
  const lineStart = text.lastIndexOf('\n', Math.max(0, caret - 1)) + 1
  const line = text.slice(lineStart, caret)
  const m = line.match(/(?:^|\s)(\/\S*)$/)
  if (!m) {
    return { text: text.slice(0, caret) + item.insert + text.slice(caret), cursorPos: caret + item.insert.length }
  }
  const tokenStart = lineStart + (line.length - m[1].length)
  return {
    text: text.slice(0, tokenStart) + item.insert + text.slice(caret),
    cursorPos: tokenStart + item.insert.length,
  }
}

/** Wrap-around index for ArrowUp/Down navigation. */
export function nextSlashIndex(current: number, delta: number, count: number): number {
  if (!Number.isFinite(count) || count <= 0) return 0
  const c = Number.isFinite(current) ? Math.floor(current) : 0
  const d = Number.isFinite(delta) ? Math.floor(delta) : 0
  return (((c + d) % count) + count) % count
}

export type SlashKey = 'up' | 'down' | 'confirm' | 'dismiss' | 'none'

/** Map a keyboard event key to a slash-menu action. */
export function slashKeyAction(key: string): SlashKey {
  switch (key) {
    case 'ArrowDown':
      return 'down'
    case 'ArrowUp':
      return 'up'
    case 'Enter':
      return 'confirm'
    case 'Escape':
      return 'dismiss'
    default:
      return 'none'
  }
}

/**
 * Keyboard-aware composer with a cascading "/" menu (FN-AST-010).
 * "/" opens the menu (same trigger protocol as the AgentConsole composer),
 * ArrowUp/ArrowDown navigate, ArrowRight opens a group submenu, ArrowLeft
 * goes back, Enter inserts the active item, Escape dismisses.
 */
function SlashComposer(props: {
  value: string
  onChange: (v: string) => void
  ariaLabel: string
  testId: string
  minHeight?: number
  textareaRef?: { current: HTMLTextAreaElement | null }
  onInsert?: (item: SlashItem) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [openGroup, setOpenGroup] = useState<SlashGroupId | null>(null)
  const innerRef = useRef<HTMLTextAreaElement | null>(null)
  const ref = props.textareaRef ?? innerRef
  const variables = useMemo(() => loadAgentInputs(), [])
  const allItems = useMemo(() => slashItems(variables), [variables])
  const query = composerTriggerQuery(props.value)?.query ?? ''
  const rootGroups = SLASH_GROUPS.filter(g => allItems.some(it => it.group === g.id))
  const filtered = useMemo(() => filterSlashItems(allItems, query), [allItems, query])
  const submenuItems = useMemo(
    () => (openGroup ? filterSlashItems(allItems.filter(it => it.group === openGroup), query) : []),
    [allItems, openGroup, query],
  )
  const visibleCount = openGroup ? submenuItems.length : query ? filtered.length : rootGroups.length
  const activeItem = openGroup ? submenuItems[Math.min(activeIndex, Math.max(0, submenuItems.length - 1))] : filtered[Math.min(activeIndex, Math.max(0, filtered.length - 1))]

  const closeMenu = useCallback(() => {
    setMenuOpen(false)
    setOpenGroup(null)
    setActiveIndex(0)
  }, [])

  const insertActive = useCallback(() => {
    if (!activeItem) return
    const ta = ref.current
    const caret = ta?.selectionStart ?? props.value.length
    const next = applySlashInsert(props.value, caret, activeItem)
    props.onChange(next.text)
    props.onInsert?.(activeItem)
    closeMenu()
    requestAnimationFrame(() => {
      const el = ref.current
      if (el) {
        el.focus()
        try { el.setSelectionRange(next.cursorPos, next.cursorPos) } catch { /* selection API unavailable */ }
      }
    })
  }, [activeItem, props, ref, closeMenu])

  const onTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value
    props.onChange(v)
    if (detectComposerTrigger(v) === '/') {
      setMenuOpen(true)
      setOpenGroup(null)
      setActiveIndex(0)
    } else {
      closeMenu()
    }
  }

  const onTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!menuOpen) return
    const key = e.key
    if (key === 'ArrowRight' && !openGroup && !query && rootGroups.length > 0) {
      e.preventDefault()
      setOpenGroup(rootGroups[Math.min(activeIndex, rootGroups.length - 1)]?.id ?? null)
      setActiveIndex(0)
      return
    }
    if (key === 'ArrowLeft' && openGroup) {
      e.preventDefault()
      setOpenGroup(null)
      setActiveIndex(0)
      return
    }
    const action = slashKeyAction(key)
    if (action === 'up' || action === 'down') {
      e.preventDefault()
      setActiveIndex(i => nextSlashIndex(i, action === 'down' ? 1 : -1, visibleCount))
    } else if (action === 'confirm') {
      e.preventDefault()
      if (!openGroup && !query) {
        setOpenGroup(rootGroups[Math.min(activeIndex, rootGroups.length - 1)]?.id ?? null)
        setActiveIndex(0)
      } else {
        insertActive()
      }
    } else if (action === 'dismiss') {
      e.preventDefault()
      if (openGroup) {
        setOpenGroup(null)
        setActiveIndex(0)
      } else {
        closeMenu()
      }
    }
  }

  const openSubmenu = (group: SlashGroupId) => {
    setOpenGroup(group)
    setActiveIndex(0)
  }

  const showGroups = menuOpen && !openGroup && !query
  const showItems = menuOpen && (openGroup !== null || query !== '')

  return (
    <div style={{ position: 'relative' }}>
      <textarea
        ref={ref}
        className="input aip-textarea"
        style={props.minHeight !== undefined ? { minHeight: props.minHeight } : undefined}
        value={props.value}
        onChange={onTextareaChange}
        onKeyDown={onTextareaKeyDown}
        aria-label={props.ariaLabel}
        aria-expanded={menuOpen}
        data-testid={props.testId}
      />
      {showGroups && (
        <div
          role="listbox"
          aria-label="Insert"
          data-testid={`${props.testId}-menu`}
          className="glass-strong"
          style={{
            position: 'absolute',
            zIndex: 40,
            left: 0,
            top: 'calc(100% + 6px)',
            width: 280,
            maxWidth: '90vw',
            maxHeight: 280,
            overflow: 'auto',
            padding: 6,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          {rootGroups.map((g, i) => {
            const isActive = i === activeIndex
            const count = allItems.filter(it => it.group === g.id).length
            return (
              <button
                key={g.id}
                role="option"
                aria-selected={isActive}
                data-testid={`slash-group-${g.id}`}
                aria-label={`${g.label} — ${count} item(s)`}
                onClick={() => openSubmenu(g.id)}
                onMouseEnter={() => setActiveIndex(i)}
                className={`palette-item${isActive ? ' active' : ''}`}
                style={
                  isActive
                    ? { background: 'var(--glass-bg-strong)', borderColor: 'var(--glass-border-strong)', color: 'var(--text)' }
                    : undefined
                }
              >
                {g.label}
                <small>{count}</small>
                <span aria-hidden>→</span>
              </button>
            )
          })}
          <div className="module-sub" style={{ padding: '4px 8px 2px' }}>/ opens · ↑↓ navigate · → submenu · Enter selects · Esc closes</div>
        </div>
      )}
      {showItems && (
        <div
          role="listbox"
          aria-label={openGroup ? `${slashGroupLabel(openGroup)} — insert` : 'Insert matching items'}
          data-testid={openGroup ? 'slash-submenu' : `${props.testId}-menu`}
          className="glass-strong"
          style={{
            position: 'absolute',
            zIndex: 40,
            left: 0,
            top: 'calc(100% + 6px)',
            width: 300,
            maxWidth: '90vw',
            maxHeight: 280,
            overflow: 'auto',
            padding: 6,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          {openGroup && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 8px 6px' }}>
              <button
                className="btn btn-ghost"
                aria-label="Back to insert groups"
                data-testid="slash-back"
                onClick={() => {
                  setOpenGroup(null)
                  setActiveIndex(0)
                }}
                style={{ padding: '2px 8px', fontSize: 11 }}
              >
                ← {slashGroupLabel(openGroup)}
              </button>
            </div>
          )}
          {(openGroup ? submenuItems : filtered).length === 0 && (
            <div className="module-sub" style={{ padding: '4px 8px' }}>No matches.</div>
          )}
          {(openGroup ? submenuItems : filtered).map((it, i) => {
            const isActive = i === activeIndex
            return (
              <button
                key={it.id}
                role="option"
                aria-selected={isActive}
                data-testid={`slash-item-${it.id}`}
                aria-label={`${it.label}${it.hint ? ` — ${it.hint}` : ''}`}
                onClick={insertActive}
                onMouseEnter={() => setActiveIndex(i)}
                className={`palette-item${isActive ? ' active' : ''}`}
                style={
                  isActive
                    ? { background: 'var(--glass-bg-strong)', borderColor: 'var(--glass-border-strong)', color: 'var(--text)' }
                    : undefined
                }
              >
                <span style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0, flex: 1 }}>
                  <span>{it.label}</span>
                  <small style={{ marginLeft: 0 }}>{slashGroupLabel(it.group)}{it.hint ? ` · ${it.hint}` : ''}</small>
                </span>
                <code style={{ fontSize: 10 }}>{it.insert}</code>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function AipLogicPanel() {
  const [editor, setEditor] = useState<PromptEditorState>(() => loadPromptEditor())
  const [promptTab, setPromptTab] = useState<PromptTabId>(() => {
    const raw = (ws.meta as Record<string, any>)?.[PROMPT_TAB_META_KEY]
    return isPromptTabId(raw) ? raw : 'system'
  })
  const prompt = editor.system
  const setPrompt = useCallback((v: string) => setEditor(prev => ({ ...prev, system: v })), [])
  const [question, setQuestion] = useState('What is the recommended treatment for Tuberculosis?')
  const promptTaRef = useRef<HTMLTextAreaElement | null>(null)
  useEffect(() => { savePromptEditor(editor) }, [editor])
  const [running, setRunning] = useState(false)
  const [trace, setTrace] = useState<TraceStep[]>([])
  const [answer, setAnswer] = useState<string | null>(null)
  const [mode, setMode] = useState<'live' | 'offline'>('offline')
  const [notice, setNotice] = useState<string | null>(null)
  const [sources, setSources] = useState<ScoredChunk[]>([])
  const [highlight, setHighlight] = useState<number | null>(null)
  const [published, setPublished] = useState<any[]>(() => ((ws.meta?.[STORAGE_ID] as any[]) ?? []))
  const sourceRefs = useRef<(HTMLDivElement | null)[]>([])

  const settings = useMemo(() => loadSettings(), [])
  const spec = providerById(settings.providerId)
  const liveReady = spec.requiresKey ? (settings.hasKey || settings.apiKey.trim().length > 0) : true

  useEffect(() => { setMode(liveReady ? 'live' : 'offline') }, [liveReady])

  const runOffline = () => {
    const r = retrieve(question)
    setSources(r.hits)
    setTrace([
      { label: 'Retrieve corpus', detail: r.grounded ? `${r.hits.length} hits · best ${r.best}` : `best ${r.best} < threshold ${r.threshold} — refusing`, ms: '0.01s', ok: r.grounded },
      { label: 'Use LLM (simulated)', detail: 'No provider configured — canned cited answer', ms: '0.00s', ok: true },
    ])
    if (!r.grounded) {
      setAnswer('I cannot answer this from the available corpus (best retrieval score below threshold). Refusing to fabricate an answer.')
      setNotice('Refusal — insufficient grounding. Configure a provider or narrow the question to the corpus.')
      setRunning(false)
      return
    }
    setAnswer(CANNED_ANSWER)
    setNotice('Offline mode — configured providers get real grounded output.')
    setRunning(false)
  }

  const runLive = async () => {
    const started = performance.now()
    setAnswer('')
    const r = retrieve(question)
    setSources(r.hits)

    if (!r.grounded) {
      appendTrace({ kind: 'llm-call', ok: false, ms: Math.round(performance.now() - started), detail: `grounding refused · best=${r.best}` })
      setTrace([
        { label: 'Retrieve corpus', detail: `best score ${r.best} < threshold — NO LLM CALL ISSUED`, ms: '0.01s', ok: false },
        { label: 'Refuse', detail: 'inline policy: answer only with grounded citations', ms: '0.00s', ok: false },
      ])
      setAnswer('I cannot answer this from the available corpus (retrieval confidence too low). Refusing to fabricate an answer.')
      setNotice('Refusal — insufficient grounding. Ask about the TB regimen, Workshop bindings, or ontology lineage.')
      setRunning(false)
      return
    }

    setTrace([
      { label: 'Retrieve corpus', detail: `${r.hits.length} hits · best ${r.best} · k=6`, ms: '0.01s', ok: true },
      { label: `Use LLM · ${settings.model}`, detail: `${spec.label} · grounded prompt · temp ${settings.temperature}`, ms: '…', ok: true },
    ])
    const groundedSystem = buildGroundedPrompt(prompt, r.hits)
    try {
      const messages: ChatMessage[] = [{ role: 'user', content: question }]
      let acc = ''
      await llmChatStream({ ...settings, systemPrompt: groundedSystem }, messages, {
        onToken: chunk => { acc += chunk; setAnswer(acc) },
      }, 'reasoning')
      const secs = ((performance.now() - started) / 1000).toFixed(2)
      const citationCount = (acc.match(/\[\d+\]/g) ?? []).length
      setTrace(prev => [
        ...prev.slice(0, 2),
        { label: 'Citations', detail: `${citationCount} inline [n] markers parsed`, ms: `${secs}s`, ok: citationCount > 0 },
      ])
      appendAudit({ event: 'aip-preview', question: question.slice(0, 200), citations: citationCount, chunks: r.hits.map(h => h.id) })
      setNotice(null)
    } catch (e) {
      setTrace(prev => [...prev, { label: 'LLM call failed', detail: String(e instanceof Error ? e.message : e).slice(0, 160), ms: '—', ok: false }])
      setNotice('Provider call failed — see debugger trace.')
    } finally {
      setRunning(false)
    }
  }

  const run = () => {
    setRunning(true); setAnswer(null); setTrace([]); setNotice(null); setSources([]); setHighlight(null)
    if (mode === 'live') runLive(); else { runOffline(); window.setTimeout(() => setRunning(false), 400) }
  }

  const [showPublish, setShowPublish] = useState(false)
  const [publishField, setPublishField] = useState({ apiName: 'yourUsernameOntologyAugmentedGeneration', targetObject: 'ot-product', versionConfig: 'Manual', documentation: 'Grounded TB answer generator for TB literature', bindingVar: 'Filtered Orders' })
  const publish = () => {
    const r = retrieve(question)
    if (!r.grounded) { setNotice('Cannot publish — last run refused (no grounding). Fix the question first.'); return }
    setShowPublish(true)
  }
  const confirmPublish = () => {
    const logic = { v: 1, id: `logic-${Date.now().toString(36)}`, name: question.slice(0, 80), systemPrompt: prompt, question, k: 6, binding: publishField, publishedAt: new Date().toISOString(), archived: false }
    const next = [...published, logic]
    patchMeta({ [STORAGE_ID]: next })
    setPublished(next)
    appendAudit({ event: 'aip-publish', id: logic.id, question: question.slice(0, 120), apiName: publishField.apiName, targetObject: publishField.targetObject, versionConfig: publishField.versionConfig })
    setShowPublish(false)
    setNotice(`Published logic ${logic.id} · bound to ${publishField.targetObject} · replay from the list below`)
  }
  const archive = (id: string) => {
    const next = published.map(p => p.id === id ? { ...p, archived: true } : p)
    patchMeta({ [STORAGE_ID]: next })
    setPublished(next)
  }
  const replay = (logic: any) => { setQuestion(logic.question); setPrompt(logic.systemPrompt) }

  // FN-AST-010 prompt editor mutations — persisted via patchMeta (mirror
  // effect above) with appendTrace + appendAudit on every mutation.
  const onPromptTab = (tab: PromptTabId) => {
    if (tab === promptTab) return
    setPromptTab(tab)
    patchMeta({ [PROMPT_TAB_META_KEY]: tab })
    appendTrace({ kind: 'tool-call', tool: 'prompt.tab', ok: true, ms: 0, detail: `prompt tab ${tab}` })
    appendAudit({ event: 'prompt-tab', tab })
  }

  const applyFormat = (kind: PromptFormatKind) => {
    const ta = promptTaRef.current
    const text = editor[promptTab]
    const selStart = ta?.selectionStart ?? text.length
    const selEnd = ta?.selectionEnd ?? text.length
    const next = applyMarkdown(text, selStart, selEnd, kind)
    setEditor(prev => ({ ...prev, [promptTab]: next.text }))
    appendTrace({ kind: 'tool-call', tool: 'prompt.format', ok: true, ms: 0, detail: `${kind} on ${promptTab}` })
    appendAudit({ event: 'prompt-format', kind, tab: promptTab })
    requestAnimationFrame(() => {
      const el = promptTaRef.current
      if (el) {
        el.focus()
        try { el.setSelectionRange(next.selStart, next.selEnd) } catch { /* selection API unavailable */ }
      }
    })
  }

  const onSlashInsert = useCallback((item: SlashItem, where: string) => {
    appendTrace({ kind: 'tool-call', tool: 'prompt.slash-insert', ok: true, ms: 0, detail: `${item.label} → ${where}` })
    appendAudit({ event: 'prompt-slash-insert', item: item.id, insert: item.insert, where })
  }, [])

  const jumpToSource = (idx: number) => {
    setHighlight(idx)
    const el = sourceRefs.current[idx - 1]
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  const citationMarkers = (answer?.match(/\[\d+\]/g) ?? []).map(m => Number(m.slice(1, -1))).filter(n => n >= 1 && n <= sources.length)

  return (
    <div className="module fade-in">
      <div className="module-head glass-strong">
        <div>
          <div className="module-title"><Icon name="spark" size={18} /> AIP Logic · Grounded Recommended Treatment</div>
          <div className="module-sub">cite-or-refuse · retrieve → ground → stream → cite → publish</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="chip" title={liveReady ? 'Calls the configured provider with grounding' : 'No key — simulated grounded output'}>{mode === 'live' ? `● live · ${spec.label}` : '○ offline (simulated)'}</span>
          <button className="btn" onClick={publish}><Icon name="check" size={13} /> Publish function</button>
          <button className="btn btn-primary" onClick={run} disabled={running}><Icon name="spark" size={13} /> {running ? 'Running…' : 'Preview run'}</button>
        </div>
      </div>

      <div className="aip-wrap" style={{ gridTemplateColumns: '1fr 340px' }}>
        {/* Editor + output */}
        <div className="aip-editor glass panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="panel-title">Function inputs</div>
          <SlashComposer
            value={question}
            onChange={setQuestion}
            ariaLabel="User question"
            testId="aip-question"
            minHeight={80}
            onInsert={item => onSlashInsert(item, 'question')}
          />
          <div className="panel-title">LLM prompt (grounded — [n] markers injected)</div>
          <div role="tablist" aria-label="Prompt editor tabs" data-testid="prompt-tabs" style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
            {PROMPT_TABS.map(t => {
              const isActive = promptTab === t.id
              return (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={isActive}
                  aria-pressed={isActive}
                  data-testid={`prompt-tab-${t.id}`}
                  aria-label={`Prompt tab ${t.label}`}
                  onClick={() => onPromptTab(t.id)}
                  className={isActive ? 'btn' : 'btn btn-ghost'}
                  style={
                    isActive
                      ? { background: 'var(--glass-bg-strong)', borderColor: 'var(--glass-border-strong)', color: 'var(--text)', padding: '4px 12px', fontSize: 11 }
                      : { background: 'transparent', borderColor: 'transparent', color: 'var(--text-dim)', padding: '4px 12px', fontSize: 11 }
                  }
                >
                  {t.label}
                </button>
              )
            })}
          </div>
          <div role="toolbar" aria-label="Prompt formatting" data-testid="prompt-toolbar" className="glass-faint" style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '6px 8px', marginBottom: 6, flexWrap: 'wrap' }}>
            {(['bold', 'italic', 'code', 'list'] as const).map(kind => (
              <button
                key={kind}
                className="btn btn-ghost"
                data-testid={`prompt-fmt-${kind}`}
                aria-label={`${kind[0].toUpperCase()}${kind.slice(1)}`}
                title={`${kind[0].toUpperCase()}${kind.slice(1)}`}
                onMouseDown={e => e.preventDefault()}
                onClick={() => applyFormat(kind)}
                style={{ padding: '2px 10px', fontSize: 11 }}
              >
                {kind === 'bold' ? <strong>B</strong> : kind === 'italic' ? <em>I</em> : kind === 'code' ? <code>&lt;/&gt;</code> : 'List'}
              </button>
            ))}
            <span className="module-sub" style={{ marginLeft: 'auto', marginTop: 0 }}>/ inserts · ↑↓ navigate · Enter selects</span>
          </div>
          <SlashComposer
            value={editor[promptTab]}
            onChange={v => setEditor(prev => ({ ...prev, [promptTab]: v }))}
            ariaLabel="LLM prompt"
            testId="prompt-editor"
            textareaRef={promptTaRef}
            onInsert={item => onSlashInsert(item, promptTab)}
          />
          <div className="panel-title" style={{ marginTop: 10 }}>Result {answer && <span className="chip"><Icon name="check" size={11} /> Ran</span>}</div>
          <div className="glass-faint" style={{ minHeight: 90, maxHeight: 190, overflow: 'auto', padding: '10px 12px', fontSize: 11.5, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {answer ?? (running ? 'Awaiting model output…' : 'Preview output will appear here. Ontology edits are not applied during preview runs.')}
            {answer && citationMarkers.length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {[...new Set(citationMarkers)].sort((a, b) => a - b).map(n => (
                  <button key={n} className="cite-chip" onClick={() => jumpToSource(n)}>[{n}] {sources[n - 1]?.title?.slice(0, 26)}</button>
                ))}
              </div>
            )}
          </div>
          {notice && <div className="module-sub" style={{ marginTop: 6, color: '#92400e' }}>{notice}</div>}

          {/* Published logics */}
          {published.filter(p => !p.archived).length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div className="panel-title">Published functions <span className="chip chip-mono">{published.filter(p => !p.archived).length}</span></div>
              {published.filter(p => !p.archived).map(logic => (
                <div key={logic.id} className="trace-step" style={{ alignItems: 'center' }}>
                  <Icon name="doc" size={13} />
                  <span style={{ minWidth: 0 }}><strong>{logic.name.slice(0, 70)}</strong><br /><span style={{ color: 'var(--text-dim)', fontSize: 9 }}>{logic.id} · {new Date(logic.publishedAt).toLocaleDateString()}</span></span>
                  <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost" style={{ padding: '2px 7px', fontSize: 10 }} onClick={() => replay(logic)}>Replay</button>
                    <button className="btn btn-ghost" style={{ padding: '2px 7px', fontSize: 10 }} onClick={() => archive(logic.id)}>Archive</button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Publish dialog */}
        {showPublish && (
          <div className="palette-overlay" onMouseDown={() => setShowPublish(false)}>
            <div className="glass-strong fade-in" style={{ width: 520, maxWidth: '94vw', padding: 16, borderRadius: 'var(--r-md)' }} onMouseDown={e => e.stopPropagation()} role="dialog" aria-label="Publish logic">
              <div className="module-title" style={{ fontSize: 14, justifyContent: 'space-between' }}>
                <span>Publish function · Ontology bound</span>
                <button className="btn btn-ghost" onClick={() => setShowPublish(false)}><Icon name="x" size={14} /></button>
              </div>
              <div className="label">Bind to object set</div>
              <select className="input" value={publishField.targetObject} onChange={e => setPublishField({ ...publishField, targetObject: e.target.value })}>
                {OBJECT_TYPES.map(o => <option key={o.id} value={o.id}>{o.name} ({o.backing})</option>)}
              </select>
              <div className="label">API name</div>
              <input className="input" value={publishField.apiName} onChange={e => setPublishField({ ...publishField, apiName: e.target.value })} spellCheck={false} />
              <div className="label">Version config</div>
              <select className="input" value={publishField.versionConfig} onChange={e => setPublishField({ ...publishField, versionConfig: e.target.value })}><option>Manual</option><option>Automatic</option></select>
              <div className="label">Documentation</div>
              <textarea className="input" style={{ minHeight: 60 }} value={publishField.documentation} onChange={e => setPublishField({ ...publishField, documentation: e.target.value })} spellCheck={false} />
              <div className="label">Output variable</div>
              <input className="input" value={publishField.bindingVar} onChange={e => setPublishField({ ...publishField, bindingVar: e.target.value })} spellCheck={false} />
              <div className="module-sub" style={{ marginTop: 6 }}>1 object will be written · preview is discarded — only the named API name ships.</div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <button className="btn" onClick={() => setShowPublish(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={confirmPublish}><Icon name="check" size={13} /> Publish</button>
              </div>
            </div>
          </div>
        )}

        {/* Sources + debugger */}
        <div className="glass panel" style={{ overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            <div className="panel-title">Sources <span className="chip chip-mono">{sources.length}</span></div>
            {sources.length === 0 && <div className="module-sub">Retrieved chunks will appear here with scores. Click a [n] chip in the answer to jump.</div>}
            {sources.map((s, i) => (
              <div key={s.id} ref={el => { sourceRefs.current[i] = el }} className={`source-card ${highlight === i + 1 ? 'source-hit' : ''}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <strong style={{ fontSize: 10.5 }}>[{i + 1}] {s.title}</strong>
                  <span className="chip chip-mono" style={{ fontSize: 8 }}>{s.score.toFixed(2)}</span>
                </div>
                <div className="module-sub" style={{ fontSize: 8.5 }}>{s.source}</div>
                <div className="module-sub" style={{ fontSize: 9.5, marginTop: 2 }}>{s.body.slice(0, 220)}…</div>
              </div>
            ))}
          </div>

          <div>
            <div className="panel-title">Debugger <span className="chip chip-mono">{trace.length} step(s)</span></div>
            {trace.length === 0 && <div className="module-sub">Run a preview to see retrieval scores, model call and citation count. Weak grounding refuses before the LLM is called.</div>}
            {trace.map((s, i) => (
              <div key={i} className="trace-step fade-in">
                <span className="trace-ok" style={s.ok ? {} : { color: '#b91c1c' }}>{s.ok ? '✓' : '✗'}</span>
                <span><strong>{s.label}</strong><br /><span style={{ color: 'var(--text-dim)' }}>{s.detail}</span></span>
                <span className="t">{s.ms}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
