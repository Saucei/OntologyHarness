// Agent inputs + session completion config drawer (FN-AST-001, FN-AST-009)
// plus pre-computed variables + templates (FN-AST-002) and variable
// operation chains (FN-AST-003: Filter → Search around over the graph substrate).
// Slide-over panel mirroring the corpus-2 agent-studio Configuration tile:
// typed Inputs list (Type + Required/Optional), template cards, chain
// builder, and Session completion policy (maxTurns, requireVerification,
// dryRunDefault).
// Glass tokens only.
// Every mutating action persists via patchMeta (ws.meta) and records
// appendTrace + appendAudit.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { appendAudit, appendTrace } from '../store'
import { GRAPH_NODES } from '../agent/graph'
import {
  CHAIN_FILTER_FIELDS,
  CHAIN_STEP_TYPES,
  CHAINS_META_KEY,
  COMPLETION_MODES,
  FILTER_OPERATORS,
  GRAPH_NODE_KINDS,
  INPUT_TYPES,
  PRECOMPUTED_COMPUTE_TYPES,
  SEARCH_DIRECTIONS,
  addChainStep,
  addInput,
  addPrecomputedVariable,
  chainOutputSummary,
  chainStepTypeLabel,
  completionModeLabel,
  computeTypeLabel,
  defaultOutputForCompute,
  defaultValues,
  defaultVariableChains,
  deriveChainOutput,
  deriveChainStepOutputs,
  evaluateChain,
  evaluatePrecomputedVariable,
  filterPrecomputedVariables,
  formatPolicySummary,
  inputTypeLabel,
  loadAgentInputs,
  loadCompletionPolicy,
  loadPrecomputedVariables,
  loadVariableChains,
  moveChainStep,
  removeChainStep,
  removeInput,
  removePrecomputedVariable,
  saveAgentInputs,
  saveCompletionPolicy,
  savePrecomputedVariables,
  saveVariableChains,
  setChainStepType,
  updateChainName,
  updateChainStepFilter,
  updateChainStepSearchAround,
  updateCompletionPolicy,
  updateInput,
  validateChain,
  validateCompletionPolicy,
  validateInputs,
  type AgentInput,
  type ChainStepType,
  type CompletionPolicy,
  type InputType,
  type PrecomputedComputeType,
  type PrecomputedVariable,
  type VariableChain,
} from '../agent/variables'

type Props = { open: boolean; onClose: () => void }

const SEG_ACTIVE: React.CSSProperties = {
  background: 'var(--glass-bg-strong)',
  borderColor: 'var(--glass-border-strong)',
  color: 'var(--text)',
  padding: '4px 12px',
  fontSize: 11,
}
const SEG_IDLE: React.CSSProperties = {
  background: 'transparent',
  borderColor: 'transparent',
  color: 'var(--text-dim)',
  padding: '4px 12px',
  fontSize: 11,
}

export function AgentInputsDrawer({ open, onClose }: Props) {
  const [inputs, setInputs] = useState<AgentInput[]>(() => loadAgentInputs())
  const [policy, setPolicy] = useState<CompletionPolicy>(() => loadCompletionPolicy())
  const [templates, setTemplates] = useState<PrecomputedVariable[]>(() => loadPrecomputedVariables())
  const [templateQuery, setTemplateQuery] = useState('')
  const [applyInput, setApplyInput] = useState('')
  const [appliedOutput, setAppliedOutput] = useState<{ name: string; output: string } | null>(null)
  const [newTemplateName, setNewTemplateName] = useState('')
  const [newTemplateText, setNewTemplateText] = useState('{input}')
  const [newTemplateCompute, setNewTemplateCompute] = useState<PrecomputedComputeType>('text')
  const [newTemplateOutput, setNewTemplateOutput] = useState('string')
  const [chains, setChains] = useState<VariableChain[]>(() => loadVariableChains())
  const [newChainStepType, setNewChainStepType] = useState<ChainStepType>('filter')
  const [chainResult, setChainResult] = useState<{ count: number; output: string; ids: string[] } | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(() => loadAgentInputs()[0]?.id ?? null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Refresh from ws.meta each time the drawer (re)opens — it may have been
  // edited in another mount.
  useEffect(() => {
    if (!open) return
    const fresh = loadAgentInputs()
    setInputs(fresh)
    setPolicy(loadCompletionPolicy())
    setTemplates(loadPrecomputedVariables())
    setChains(loadVariableChains())
    setSelectedId(prev => (prev && fresh.some(i => i.id === prev) ? prev : (fresh[0]?.id ?? null)))
  }, [open])

  // Escape closes the drawer.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const errors = useMemo(() => [...validateInputs(inputs), ...validateCompletionPolicy(policy)], [inputs, policy])
  const selected = inputs.find(i => i.id === selectedId) ?? inputs[0] ?? null

  // Commit path: local state + ws.meta persistence + trace + audit.
  const commitInputs = (next: AgentInput[], op: string, detail: string) => {
    setInputs(next)
    saveAgentInputs(next)
    appendTrace({ kind: 'tool-call', tool: `inputs.${op}`, ok: true, ms: 0, detail })
    appendAudit({ event: `inputs-${op}`, detail, inputs: next.map(i => i.name) })
    // Keep the selection valid after adds/removes.
    setSelectedId(prev => (prev && next.some(i => i.id === prev) ? prev : (next[0]?.id ?? null)))
  }

  const commitPolicy = (next: CompletionPolicy, detail: string) => {
    setPolicy(next)
    saveCompletionPolicy(next)
    appendTrace({ kind: 'tool-call', tool: 'policy.update', ok: true, ms: 0, detail })
    appendAudit({ event: 'policy-update', detail, policy: { ...next } })
  }

  // Template commit path: list state + ws.meta (`agentVariables_templates`)
  // persistence + trace + audit, mirroring commitInputs/commitPolicy.
  const commitTemplates = (next: PrecomputedVariable[], op: string, detail: string) => {
    setTemplates(next)
    savePrecomputedVariables(next)
    appendTrace({ kind: 'tool-call', tool: `templates.${op}`, ok: true, ms: 0, detail })
    appendAudit({ event: `templates-${op}`, detail, templates: next.map(t => t.name) })
  }

  // Chain commit path (FN-AST-003): chain state + ws.meta
  // (`agentVariables_chains`) persistence + trace + audit. The drawer edits a
  // single active chain (chains[0]); every step add/remove/reorder/config
  // change and the rename flow through here so trace + audit stay complete.
  const activeChain: VariableChain = chains[0] ?? defaultVariableChains()[0]
  const chainStepOutputs = useMemo(() => deriveChainStepOutputs(activeChain), [activeChain])
  const chainTypedOutput = useMemo(() => deriveChainOutput(activeChain.steps), [activeChain])
  const chainErrors = useMemo(() => validateChain(activeChain), [activeChain])

  const commitChains = (next: VariableChain[], op: string, detail: string) => {
    setChains(next)
    saveVariableChains(next)
    setChainResult(null)
    appendTrace({ kind: 'tool-call', tool: `chains.${op}`, ok: true, ms: 0, detail })
    appendAudit({ event: `chains-${op}`, detail, chains: next.map(c => c.name), chain: activeChain.name })
  }

  const commitActiveChain = (next: VariableChain, op: string, detail: string) => {
    commitChains([next], op, detail)
  }

  // chains.apply: pure evaluation of the active chain over the graph
  // substrate — for Filter this narrows GRAPH_NODES, SearchAround walks links.
  const applyChain = () => {
    const result = evaluateChain(activeChain, GRAPH_NODES)
    const ids = result.map(o => o.id)
    setChainResult({ count: result.length, output: chainTypedOutput, ids })
    saveVariableChains(chains)
    appendTrace({ kind: 'tool-call', tool: 'chains.apply', ok: true, ms: 0, detail: `applied chain "${activeChain.name}" → ${chainTypedOutput} (${result.length} object(s): ${ids.join(', ')})` })
    appendAudit({ event: 'chains-apply', detail: `applied chain "${activeChain.name}" → ${chainTypedOutput} (${result.length} object(s))`, chain: activeChain.name, output: chainTypedOutput, count: result.length, ids, action: 'apply-chain' })
  }

  // apply-template: evaluate one card against the apply input (or the
  // selected input's default) and surface the rendered output.
  const applyTemplateCard = (tpl: PrecomputedVariable) => {
    const fallback = selected?.defaultValue !== undefined ? String(selected.defaultValue) : ''
    const inputValue = applyInput !== '' ? applyInput : fallback
    const output = evaluatePrecomputedVariable(tpl, inputValue)
    setAppliedOutput({ name: tpl.name, output })
    savePrecomputedVariables(templates)
    appendTrace({ kind: 'tool-call', tool: 'templates.apply-template', ok: true, ms: 0, detail: `applied template "${tpl.name}" → ${output}` })
    appendAudit({ event: 'templates-apply-template', detail: `applied template "${tpl.name}" → ${output}`, template: tpl.name, output, action: 'apply-template' })
  }

  const filteredTemplates = useMemo(
    () => filterPrecomputedVariables(templates, templateQuery),
    [templates, templateQuery],
  )

  if (!open) return null

  const nameDefault = selected?.defaultValue
  const optionsText = selected ? selected.options.join(', ') : ''

  return (
    <div
      className="palette-overlay"
      data-testid="agent-inputs-drawer-backdrop"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ paddingTop: 0, alignItems: 'stretch', justifyContent: 'flex-end' }}
    >
      <div
        ref={panelRef}
        data-testid="agent-inputs-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Agent inputs and session completion"
        className="glass-strong"
        style={{
          width: 'min(440px, 94vw)',
          height: '100vh',
          maxHeight: '100vh',
          overflow: 'auto',
          borderRadius: 'var(--r-md) 0 0 var(--r-md)',
          borderRight: 'none',
          display: 'flex',
          flexDirection: 'column',
          padding: 14,
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="layers" size={16} />
          <strong>Configuration</strong>
          <span className="chip chip-mono">{inputs.length} input(s)</span>
          <button className="icon-btn" style={{ marginLeft: 'auto' }} onClick={onClose} aria-label="Close agent inputs">
            <Icon name="x" size={14} />
          </button>
        </div>

        {errors.length > 0 && (
          <div role="alert" data-testid="agent-inputs-errors" className="glass-faint" style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {errors.map((e, i) => (
              <div key={i} className="module-sub" style={{ marginTop: 0, color: 'var(--danger)' }}>{e}</div>
            ))}
          </div>
        )}

        {/* ── Inputs (FN-AST-001) ─────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600 }} aria-label="Inputs">Inputs</span>
          <button
            className="btn btn-ghost"
            style={{ ...SEG_IDLE, marginLeft: 'auto' }}
            aria-label="Add input"
            data-testid="inputs-add"
            disabled={false}
            onClick={() => {
              const next = addInput(inputs)
              const added = next[next.length - 1]
              setSelectedId(added.id)
              commitInputs(next, 'add', `added input "${added.name}"`)
            }}
          >
            <Icon name="plus" size={13} /> Add
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }} aria-label="Inputs list">
          {inputs.map(input => {
            const isSelected = selected?.id === input.id
            return (
              <button
                key={input.id}
                className={`palette-item${isSelected ? ' active' : ''}`}
                aria-pressed={isSelected}
                aria-label={input.name || 'unnamed input'}
                data-testid={`input-row-${input.id}`}
                onClick={() => setSelectedId(input.id)}
                style={isSelected ? { background: 'var(--glass-bg-strong)', borderColor: 'var(--glass-border-strong)', color: 'var(--text)' } : undefined}
              >
                <span className="chip chip-mono" style={{ background: 'var(--glass-bg-strong)', borderColor: 'var(--glass-border-strong)', color: 'var(--text)' }}>
                  {inputTypeLabel(input.type)}
                </span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {input.name}
                  {input.required ? ' *' : ''}
                </span>
                <small>{input.required ? 'Required' : 'Optional'}</small>
              </button>
            )
          })}
          {inputs.length === 0 && <div className="module-sub">No inputs yet — add one to shape the session start.</div>}
        </div>

        {/* ── Selected input editor (matches the Type + Required/Optional tile) ── */}
        {selected && (
          <div className="glass-faint" data-testid="input-editor" style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                className="input"
                value={selected.name}
                placeholder="input1"
                aria-label="Input name"
                data-testid="input-name"
                onChange={e => setInputs(updateInput(inputs, selected.id, { name: e.target.value }))}
                onBlur={() => commitInputs(inputs, 'rename', `renamed input → "${selected.name}"`)}
                style={{ flex: 1 }}
              />
              <button
                className="icon-btn"
                aria-label={`Delete input ${selected.name || 'unnamed'}`}
                data-testid="input-delete"
                onClick={() => commitInputs(removeInput(inputs, selected.id), 'remove', `deleted input "${selected.name}"`)}
                title="Delete input"
              >
                <Icon name="trash" size={14} />
              </button>
            </div>

            <label className="module-sub" style={{ marginTop: 0 }}>Type</label>
            <select
              className="input"
              value={selected.type}
              aria-label="Input type"
              data-testid="input-type"
              onChange={e => {
                const type = e.target.value as InputType
                commitInputs(updateInput(inputs, selected.id, { type }), 'update', `input "${selected.name}" type → ${inputTypeLabel(type)}`)
              }}
            >
              {INPUT_TYPES.map(t => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>

            <div role="group" aria-label="Input requiredness" data-testid="input-requiredness" style={{ display: 'flex', gap: 4 }}>
              {([{ value: true, label: 'Required' }, { value: false, label: 'Optional' }] as const).map(opt => {
                const isActive = selected.required === opt.value
                return (
                  <button
                    key={opt.label}
                    className={isActive ? 'btn' : 'btn btn-ghost'}
                    aria-pressed={isActive}
                    aria-label={opt.label}
                    data-testid={`input-required-${opt.label.toLowerCase()}`}
                    onClick={() => commitInputs(updateInput(inputs, selected.id, { required: opt.value }), 'update', `input "${selected.name}" → ${opt.label}`)}
                    style={{ ...SEG_ACTIVE, flex: 1, justifyContent: 'center', ...(isActive ? {} : SEG_IDLE) }}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>

            {selected.type !== 'boolean' && (
              <>
                <label className="module-sub" style={{ marginTop: 0 }}>
                  {selected.type === 'option' ? 'Options (comma-separated)' : 'Default value'}
                </label>
                <input
                  className="input"
                  value={selected.type === 'option' ? optionsText : (typeof nameDefault === 'string' || typeof nameDefault === 'number' ? String(nameDefault) : '')}
                  placeholder={selected.type === 'option' ? 'EWR, JFK, LHR' : selected.type === 'number' ? '42' : 'Default text'}
                  aria-label={selected.type === 'option' ? 'Options list' : 'Default value'}
                  data-testid="input-default"
                  onChange={e => {
                    const v = e.target.value
                    if (selected.type === 'option') {
                      setInputs(updateInput(inputs, selected.id, { options: v.split(',').map(s => s.trim()).filter(Boolean) }))
                    } else {
                      setInputs(updateInput(inputs, selected.id, { defaultValue: v }))
                    }
                  }}
                  onBlur={() => commitInputs(inputs, 'update', `input "${selected.name}" ${selected.type === 'option' ? 'options' : 'default'} updated`)}
                />
              </>
            )}
            {selected.type === 'boolean' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-dim)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={nameDefault === true}
                  aria-label="Default value for boolean input"
                  data-testid="input-default"
                  onChange={e => commitInputs(updateInput(inputs, selected.id, { defaultValue: e.target.checked }), 'update', `input "${selected.name}" default → ${e.target.checked}`)}
                />
                Default value
              </label>
            )}
          </div>
        )}

        {/* ── Pre-computed variables + templates (FN-AST-002) ─────── */}
        <div data-testid="templates-section" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Pre-computed variables</span>
            <span className="chip chip-mono" data-testid="templates-count" style={{ marginLeft: 'auto', background: 'var(--glass-bg-strong)', borderColor: 'var(--glass-border-strong)', color: 'var(--text)' }}>
              {filteredTemplates.length} template(s)
            </span>
          </div>

          <input
            className="input"
            value={templateQuery}
            placeholder="Search templates…"
            aria-label="Search templates"
            data-testid="template-search"
            onChange={e => setTemplateQuery(e.target.value)}
          />

          <label className="module-sub" style={{ marginTop: 0 }}>Apply with input</label>
          <input
            className="input"
            value={applyInput}
            placeholder="e.g. EWR"
            aria-label="Template apply input"
            data-testid="template-apply-input"
            onChange={e => setApplyInput(e.target.value)}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }} aria-label="Template cards" data-testid="template-cards">
            {filteredTemplates.map(tpl => {
              const tplKey = tpl.id ?? tpl.name
              return (
                <div
                  key={tplKey}
                  className="glass-faint"
                  data-testid={`template-card-${tplKey}`}
                  style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span className="chip chip-mono" style={{ background: 'var(--glass-bg-strong)', borderColor: 'var(--glass-border-strong)', color: 'var(--text)' }}>
                      {computeTypeLabel(tpl.compute.type)}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tpl.name}</span>
                    <span className="chip chip-mono" style={{ marginLeft: 'auto', background: 'var(--glass-bg-strong)', borderColor: 'var(--glass-border-strong)', color: 'var(--text-dim)' }}>
                      {tpl.output}
                    </span>
                  </div>
                  <div className="module-sub" data-testid={`template-text-${tplKey}`} style={{ marginTop: 0, fontFamily: 'var(--font-mono, monospace)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {tpl.template}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="btn btn-ghost"
                      aria-label={`Use template ${tpl.name}`}
                      data-testid={`template-use-${tplKey}`}
                      data-action="apply-template"
                      title="apply-template"
                      onClick={() => applyTemplateCard(tpl)}
                      style={{ ...SEG_IDLE, flex: 1, justifyContent: 'center' }}
                    >
                      Use
                    </button>
                    <button
                      className="btn btn-ghost"
                      aria-label={`Delete template ${tpl.name}`}
                      data-testid={`template-delete-${tplKey}`}
                      onClick={() => commitTemplates(removePrecomputedVariable(templates, tplKey), 'remove', `deleted template "${tpl.name}"`)}
                      style={{ ...SEG_IDLE, flex: 1, justifyContent: 'center' }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )
            })}
            {filteredTemplates.length === 0 && (
              <div className="module-sub" data-testid="template-empty">No templates match your search.</div>
            )}
          </div>

          {appliedOutput && (
            <div role="status" data-testid="apply-template-result" className="glass-faint" style={{ padding: '8px 10px' }}>
              <span className="module-sub" style={{ marginTop: 0 }}>apply-template: {appliedOutput.name} → {appliedOutput.output}</span>
            </div>
          )}

          {/* Add-template editor */}
          <div className="glass-faint" data-testid="template-editor" style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                className="input"
                value={newTemplateName}
                placeholder="templateName"
                aria-label="New template name"
                data-testid="template-new-name"
                onChange={e => setNewTemplateName(e.target.value)}
                style={{ flex: 1 }}
              />
              <button
                className="btn btn-ghost"
                aria-label="Add template"
                data-testid="template-add"
                onClick={() => {
                  const next = addPrecomputedVariable(templates, {
                    name: newTemplateName.trim() || undefined,
                    template: newTemplateText || '{input}',
                    compute: { type: newTemplateCompute },
                    output: newTemplateOutput.trim() || defaultOutputForCompute(newTemplateCompute),
                  })
                  const added = next[next.length - 1]
                  setNewTemplateName('')
                  setNewTemplateText('{input}')
                  setNewTemplateOutput('string')
                  commitTemplates(next, 'add', `added template "${added.name}"`)
                }}
                style={SEG_IDLE}
              >
                <Icon name="plus" size={13} /> Add
              </button>
            </div>
            <input
              className="input"
              value={newTemplateText}
              placeholder="Hello {input}"
              aria-label="New template text"
              data-testid="template-new-template"
              onChange={e => setNewTemplateText(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 6 }}>
              <select
                className="input"
                value={newTemplateCompute}
                aria-label="New template compute type"
                data-testid="template-new-compute"
                onChange={e => {
                  const type = e.target.value as PrecomputedComputeType
                  setNewTemplateCompute(type)
                  setNewTemplateOutput(defaultOutputForCompute(type))
                }}
                style={{ flex: 1 }}
              >
                {PRECOMPUTED_COMPUTE_TYPES.map(t => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
              <input
                className="input"
                value={newTemplateOutput}
                placeholder="string"
                aria-label="New template output"
                data-testid="template-new-output"
                onChange={e => setNewTemplateOutput(e.target.value)}
                style={{ flex: 1 }}
              />
            </div>
          </div>
        </div>

        {/* ── Variable operation chains (FN-AST-003) ─────────────────── */}
        <div data-testid="chain-section" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Variable chains</span>
            <span
              className="chip chip-mono"
              data-testid="chain-output-chip"
              style={{ marginLeft: 'auto', background: 'var(--glass-bg-strong)', borderColor: 'var(--glass-border-strong)', color: 'var(--text)' }}
              title={chainOutputSummary(activeChain)}
            >
              {chainTypedOutput}
            </span>
            <span className="chip chip-mono" data-testid="chain-step-count">
              {activeChain.steps.length} step(s)
            </span>
          </div>

          <label className="module-sub" style={{ marginTop: 0 }}>Chain name</label>
          <input
            className="input"
            value={activeChain.name}
            placeholder="materialRecipes"
            aria-label="Chain name"
            data-testid="chain-name"
            onChange={e => commitActiveChain(updateChainName(activeChain, e.target.value), 'rename', `renamed chain → "${e.target.value}"`)}
          />

          {/* Problems bar — validation errors for the active chain. */}
          <div role={chainErrors.length > 0 ? 'alert' : 'status'} data-testid="chain-problems" className="glass-faint" style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span className="module-sub" style={{ marginTop: 0 }}>
              Problems{chainErrors.length > 0 ? ` (${chainErrors.length})` : ' — none'}
            </span>
            {chainErrors.map((e, i) => (
              <div key={i} className="module-sub" style={{ marginTop: 0, color: 'var(--danger)' }}>{e}</div>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }} aria-label="Chain steps" data-testid="chain-steps">
            {activeChain.steps.map((step, idx) => {
              const stepKey = step.id
              const stepOutput = chainStepOutputs[idx] ?? chainTypedOutput
              const isFirst = idx === 0
              const isLast = idx === activeChain.steps.length - 1
              return (
                <div
                  key={stepKey}
                  className="glass-faint"
                  data-testid={`chain-step-${stepKey}`}
                  style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span className="chip chip-mono" style={{ background: 'var(--glass-bg-strong)', borderColor: 'var(--glass-border-strong)', color: 'var(--text)' }}>
                      {idx + 1}. {chainStepTypeLabel(step.type)}
                    </span>
                    <span className="chip chip-mono" data-testid={`chain-step-output-${stepKey}`} style={{ marginLeft: 'auto', background: 'var(--glass-bg-strong)', borderColor: 'var(--glass-border-strong)', color: 'var(--text-dim)' }}>
                      {stepOutput}
                    </span>
                  </div>

                  <label className="module-sub" style={{ marginTop: 0 }}>Step type</label>
                  <select
                    className="input"
                    value={step.type}
                    aria-label={`Step ${idx + 1} type`}
                    data-testid={`chain-step-type-${stepKey}`}
                    onChange={e => {
                      const type = e.target.value as ChainStepType
                      commitActiveChain(setChainStepType(activeChain, step.id, type), 'update-step', `step ${idx + 1} type → ${chainStepTypeLabel(type)}`)
                    }}
                  >
                    {CHAIN_STEP_TYPES.map(t => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>

                  {step.type === 'filter' && (
                    <>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <select
                          className="input"
                          value={step.config.field}
                          aria-label={`Step ${idx + 1} filter field`}
                          data-testid={`chain-step-field-${stepKey}`}
                          onChange={e => commitActiveChain(updateChainStepFilter(activeChain, step.id, { field: e.target.value }), 'update-step', `step ${idx + 1} filter field → ${e.target.value}`)}
                          style={{ flex: 1 }}
                        >
                          {CHAIN_FILTER_FIELDS.map(f => (
                            <option key={f} value={f}>{f}</option>
                          ))}
                        </select>
                        <select
                          className="input"
                          value={step.config.operator}
                          aria-label={`Step ${idx + 1} filter operator`}
                          data-testid={`chain-step-operator-${stepKey}`}
                          onChange={e => commitActiveChain(updateChainStepFilter(activeChain, step.id, { operator: e.target.value as typeof step.config.operator }), 'update-step', `step ${idx + 1} filter operator → ${e.target.value}`)}
                          style={{ flex: 1 }}
                        >
                          {FILTER_OPERATORS.map(o => (
                            <option key={o.id} value={o.id}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                      <input
                        className="input"
                        value={step.config.value !== undefined ? String(step.config.value) : ''}
                        placeholder="Value (e.g. material)"
                        aria-label={`Step ${idx + 1} filter value`}
                        data-testid={`chain-step-value-${stepKey}`}
                        disabled={step.config.operator === 'exists' || step.config.operator === 'notExists'}
                        onChange={e => commitActiveChain(updateChainStepFilter(activeChain, step.id, { value: e.target.value }), 'update-step', `step ${idx + 1} filter value → ${e.target.value}`)}
                      />
                    </>
                  )}

                  {step.type === 'searchAround' && (
                    <>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <select
                          className="input"
                          value={step.config.direction}
                          aria-label={`Step ${idx + 1} direction`}
                          data-testid={`chain-step-direction-${stepKey}`}
                          onChange={e => commitActiveChain(updateChainStepSearchAround(activeChain, step.id, { direction: e.target.value as typeof step.config.direction }), 'update-step', `step ${idx + 1} direction → ${e.target.value}`)}
                          style={{ flex: 1 }}
                        >
                          {SEARCH_DIRECTIONS.map(d => (
                            <option key={d.id} value={d.id}>{d.label}</option>
                          ))}
                        </select>
                        <input
                          className="input"
                          type="number"
                          min={1}
                          max={3}
                          value={step.config.depth}
                          aria-label={`Step ${idx + 1} depth`}
                          data-testid={`chain-step-depth-${stepKey}`}
                          onChange={e => commitActiveChain(updateChainStepSearchAround(activeChain, step.id, { depth: Number(e.target.value) }), 'update-step', `step ${idx + 1} depth → ${e.target.value}`)}
                          style={{ width: 72 }}
                        />
                        <select
                          className="input"
                          value={step.config.targetKind ?? ''}
                          aria-label={`Step ${idx + 1} target kind`}
                          data-testid={`chain-step-kind-${stepKey}`}
                          onChange={e => commitActiveChain(updateChainStepSearchAround(activeChain, step.id, { targetKind: e.target.value }), 'update-step', `step ${idx + 1} target kind → ${e.target.value || 'any'}`)}
                          style={{ flex: 1 }}
                        >
                          <option value="">Any kind</option>
                          {GRAPH_NODE_KINDS.map(k => (
                            <option key={k.id} value={k.id}>{k.label}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="btn btn-ghost"
                      aria-label={`Move step ${idx + 1} up`}
                      data-testid={`chain-step-up-${stepKey}`}
                      disabled={isFirst}
                      onClick={() => commitActiveChain(moveChainStep(activeChain, step.id, 'up'), 'reorder', `moved step ${idx + 1} (${chainStepTypeLabel(step.type)}) up`)}
                      style={{ ...SEG_IDLE, flex: 1, justifyContent: 'center' }}
                    >
                      Up
                    </button>
                    <button
                      className="btn btn-ghost"
                      aria-label={`Move step ${idx + 1} down`}
                      data-testid={`chain-step-down-${stepKey}`}
                      disabled={isLast}
                      onClick={() => commitActiveChain(moveChainStep(activeChain, step.id, 'down'), 'reorder', `moved step ${idx + 1} (${chainStepTypeLabel(step.type)}) down`)}
                      style={{ ...SEG_IDLE, flex: 1, justifyContent: 'center' }}
                    >
                      Down
                    </button>
                    <button
                      className="btn btn-ghost"
                      aria-label={`Remove step ${idx + 1} (${chainStepTypeLabel(step.type)})`}
                      data-testid={`chain-step-remove-${stepKey}`}
                      onClick={() => commitActiveChain(removeChainStep(activeChain, step.id), 'remove-step', `removed step ${idx + 1} (${chainStepTypeLabel(step.type)})`)}
                      style={{ ...SEG_IDLE, flex: 1, justifyContent: 'center' }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )
            })}
            {activeChain.steps.length === 0 && (
              <div className="module-sub" data-testid="chain-no-steps">No steps yet — add a Filter or Search around step.</div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <select
              className="input"
              value={newChainStepType}
              aria-label="New step type"
              data-testid="chain-new-step-type"
              onChange={e => setNewChainStepType(e.target.value as ChainStepType)}
              style={{ flex: 1 }}
            >
              {CHAIN_STEP_TYPES.map(t => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
            <button
              className="btn btn-ghost"
              aria-label="Add step to chain"
              data-testid="chain-add"
              onClick={() => {
                const next = addChainStep(activeChain, newChainStepType)
                commitActiveChain(next, 'add-step', `added ${chainStepTypeLabel(newChainStepType)} step to chain "${activeChain.name}"`)
              }}
              style={SEG_IDLE}
            >
              <Icon name="plus" size={13} /> Add
            </button>
          </div>

          <button
            className={chainErrors.length > 0 ? 'btn btn-ghost' : 'btn'}
            aria-label={`Apply chain ${activeChain.name}`}
            data-testid="chain-apply"
            disabled={chainErrors.length > 0}
            title={chainErrors.length > 0 ? chainErrors[0] : undefined}
            onClick={applyChain}
            style={{ justifyContent: 'center' }}
          >
            Apply chain
          </button>

          {chainResult && (
            <div role="status" data-testid="chain-apply-result" className="glass-faint" style={{ padding: '8px 10px' }}>
              <span className="module-sub" style={{ marginTop: 0 }}>
                Apply: {activeChain.name} → {chainResult.output} ({chainResult.count} object(s){chainResult.ids.length > 0 ? `: ${chainResult.ids.slice(0, 8).join(', ')}` : ''})
              </span>
            </div>
          )}
        </div>

        {/* ── Session completion (FN-AST-009) ─────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>Session completion</span>
          <span className="chip chip-mono" data-testid="policy-summary" style={{ marginLeft: 'auto', background: 'var(--glass-bg-strong)', borderColor: 'var(--glass-border-strong)', color: 'var(--text)' }}>
            {formatPolicySummary(policy)}
          </span>
        </div>

        <div className="glass-faint" style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label className="module-sub" style={{ marginTop: 0 }}>Completion mode</label>
          <select
            className="input"
            value={policy.mode}
            aria-label="Completion mode"
            data-testid="policy-mode"
            onChange={e => {
              const mode = e.target.value as CompletionPolicy['mode']
              commitPolicy(updateCompletionPolicy(policy, { mode }), `completion mode → ${completionModeLabel(mode)}`)
            }}
          >
            {COMPLETION_MODES.map(m => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
          <div className="module-sub" style={{ marginTop: 0 }}>
            {COMPLETION_MODES.find(m => m.id === policy.mode)?.description}
          </div>

          <label className="module-sub" style={{ marginTop: 0 }}>Max turns</label>
          <input
            className="input"
            type="number"
            min={1}
            max={30}
            value={policy.maxTurns}
            aria-label="Max turns"
            data-testid="policy-max-turns"
            onChange={e => commitPolicy(updateCompletionPolicy(policy, { maxTurns: Number(e.target.value) }), `maxTurns → ${e.target.value}`)}
          />

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-dim)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={policy.requireVerification}
              aria-label="Require verification"
              data-testid="policy-require-verification"
              onChange={e => commitPolicy(updateCompletionPolicy(policy, { requireVerification: e.target.checked }), `requireVerification → ${e.target.checked}`)}
            />
            Require verification before completion
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-dim)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={policy.dryRunDefault}
              aria-label="Dry run by default"
              data-testid="policy-dry-run-default"
              onChange={e => commitPolicy(updateCompletionPolicy(policy, { dryRunDefault: e.target.checked }), `dryRunDefault → ${e.target.checked}`)}
            />
            Dry-run by default (live runs need approval)
          </label>
        </div>

        <div className="module-sub">Session start values: {JSON.stringify(defaultValues(inputs)) || '{}'}</div>
      </div>
    </div>
  )
}
