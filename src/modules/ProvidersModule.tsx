import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import {
  PROVIDERS, loadSettings, saveSettings, isTauriApp, llmChat, saveSecret, hasSecret, deleteSecret,
  CATALOG_TABS, REASONING_TIERS, applyReasoningTier, catalogEntryForModel, catalogForTab,
  formatContextTokens, formatRate, getReasoningTier,
  type CatalogTab, type ModelCatalogEntry, type ProviderSettings, type ReasoningTierId, type TaskClass,
} from '../llm/client'
import { appendAudit, appendTrace } from '../store'

type TestState = 'idle' | 'testing' | 'ok' | 'fail'

const ROUTE_CLASSES: { id: TaskClass; label: string; hint: string }[] = [
  { id: 'reasoning', label: 'Reasoning', hint: 'agent planning, verification' },
  { id: 'extraction', label: 'Extraction', hint: 'structured output, classification' },
  { id: 'code', label: 'Code', hint: 'config/transform generation' },
  { id: 'cheap', label: 'Cheap', hint: 'high-volume simple tasks' },
]

export default function ProvidersModule() {
  const [settings, setSettings] = useState<ProviderSettings>(() => loadSettings())
  const [keyHas, setKeyHas] = useState<boolean>(() => loadSettings().hasKey)
  const [secretDraft, setSecretDraft] = useState('')
  const [testState, setTestState] = useState<TestState>('idle')
  const [testMessage, setTestMessage] = useState('')
  const [savedFlash, setSavedFlash] = useState(false)
  // FN-FDE-009 catalog
  const [catalogTab, setCatalogTab] = useState<CatalogTab>('palantir')

  useEffect(() => { hasSecret(settings.providerId).then(setKeyHas) }, [settings.providerId])

  const active = useMemo(() => PROVIDERS.find(p => p.id === settings.providerId) ?? PROVIDERS[0], [settings.providerId])
  const tauri = isTauriApp()
  const runtime = tauri ? 'Tauri native · keys in Windows Credential Manager' : 'Browser fallback · keys in localStorage'
  const configured = active.requiresKey ? keyHas || settings.apiKey.trim().length > 0 : true

  const entries = useMemo(() => catalogForTab(catalogTab), [catalogTab])
  const selected: ModelCatalogEntry | null = useMemo(
    () => catalogEntryForModel(settings.model, settings.providerId),
    [settings.model, settings.providerId],
  )
  const tier = getReasoningTier(settings.reasoningTier)

  const persist = (next: ProviderSettings) => {
    saveSettings({ ...next, hasKey: active.requiresKey ? keyHas || next.apiKey.trim().length > 0 || next.hasKey : true })
    setSavedFlash(true)
    window.setTimeout(() => setSavedFlash(false), 900)
  }

  const update = (patch: Partial<ProviderSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch }
      if (patch.providerId) {
        const spec = PROVIDERS.find(p => p.id === patch.providerId)!
        next.baseUrl = spec.baseUrl; next.model = spec.defaultModel; next.apiKey = ''; setKeyHas(false)
      }
      persist(next)
      return next
    })
  }

  const pickCatalogEntry = (entry: ModelCatalogEntry) => {
    const spec = PROVIDERS.find(p => p.id === entry.providerId)
    const next: ProviderSettings = spec
      ? { ...settings, providerId: entry.providerId, baseUrl: spec.baseUrl, model: entry.model, apiKey: settings.providerId === entry.providerId ? settings.apiKey : '' }
      : { ...settings, model: entry.model }
    setSettings(next)
    persist(next)
    appendTrace({ kind: 'tool-call', tool: 'model.catalog.pick', ok: true, ms: 0, detail: `${entry.model} via ${entry.providerId}` })
    appendAudit({ event: 'model-pick', model: entry.model, provider: entry.providerId, tab: entry.tab })
  }

  const pickTier = (id: ReasoningTierId) => {
    const next = applyReasoningTier(settings, id)
    setSettings(next)
    persist(next)
    appendTrace({ kind: 'tool-call', tool: 'model.tier.pick', ok: true, ms: 0, detail: `${id} temp=${next.temperature} max=${next.maxTokens}` })
    appendAudit({ event: 'reasoning-tier', tier: id, effort: getReasoningTier(id).effort })
  }

  const saveKey = async () => {
    if (!secretDraft.trim()) return
    if (tauri) await saveSecret(settings.providerId, secretDraft)
    const next = { ...settings, apiKey: tauri ? '' : secretDraft.trim(), hasKey: true }
    setSettings(next); persist(next); setKeyHas(true); setSecretDraft('')
    appendTrace({ kind: 'tool-call', tool: 'provider.key.save', ok: true, ms: 0, detail: settings.providerId })
    appendAudit({ event: 'provider-key-save', provider: settings.providerId })
  }
  const removeKey = async () => {
    await deleteSecret(settings.providerId)
    const next = { ...settings, apiKey: '', hasKey: false }
    setSettings(next); persist(next); setKeyHas(false)
    appendTrace({ kind: 'tool-call', tool: 'provider.key.delete', ok: true, ms: 0, detail: settings.providerId })
    appendAudit({ event: 'provider-key-delete', provider: settings.providerId })
  }

  const testConnection = async () => {
    setTestState('testing'); setTestMessage('')
    const effective = tauri ? { ...settings, apiKey: '' } : settings
    try {
      const reply = await llmChat(effective, [{ role: 'user', content: 'Reply with exactly: ONTOLOGY_HARNESS_OK' }])
      setTestState('ok')
      setTestMessage(reply.slice(0, 200))
    } catch (e) {
      setTestState('fail')
      setTestMessage(String(e instanceof Error ? e.message : e).slice(0, 300))
    }
  }

  return (
    <div className="module fade-in">
      <div className="module-head glass-strong">
        <div>
          <div className="module-title"><Icon name="server" size={18} /> LLM Providers &amp; Agent Settings</div>
          <div className="module-sub">Gateway: {runtime} · {PROVIDERS.length} providers</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className={`chip ${configured ? '' : 'chip-mono'}`} style={configured ? {} : { background: 'rgba(245,158,11,.18)', borderColor: 'rgba(245,158,11,.4)', color: '#92400e' }}>
            {configured ? '● configured' : '○ key required'}
          </span>
          {savedFlash && <span className="chip"><Icon name="check" size={11} /> saved</span>}
        </div>
      </div>

      <div className="module-body">
        <div className="glass panel" style={{ width: 250, flexShrink: 0 }}>
          <div className="panel-title">Providers</div>
          {PROVIDERS.map(p => (
            <button key={p.id} className={`nav-item ${settings.providerId === p.id ? 'active' : ''}`} style={{ width: '100%' }} onClick={() => update({ providerId: p.id })}>
              <span style={{ fontSize: 15 }}>{p.local ? '💻' : '☁️'}</span>
              <span style={{ flex: 1, textAlign: 'left' }}>{p.label}<br /><small style={{ fontWeight: 400, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: 9 }}>{p.kind === 'anthropic' ? 'messages API' : 'chat/completions'}</small></span>
            </button>
          ))}
        </div>

        <div className="glass panel" style={{ flex: 1, overflow: 'auto' }}>
          <div className="panel-title">{active.label} — configuration {active.docsUrl && <a href={active.docsUrl} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: 'var(--green-700)' }}>get keys ↗</a>}</div>

          <div className="label">Base URL</div>
          <input className="input" value={settings.baseUrl} onChange={e => update({ baseUrl: e.target.value })} spellCheck={false} />

          <div className="label">Default model</div>
          <input className="input" value={settings.model} onChange={e => update({ model: e.target.value })} spellCheck={false} />
          <div className="module-sub" style={{ marginTop: 3 }}>e.g. {active.modelHint}</div>

          <div className="label">Agent routing — model per task class (optional; blank = default)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {ROUTE_CLASSES.map(rc => (
              <div key={rc.id}>
                <input className="input" placeholder={`${rc.label} — ${active.modelHint.split(',')[0]}`} value={settings.routeModels[rc.id] ?? ''} onChange={e => update({ routeModels: { ...settings.routeModels, [rc.id]: e.target.value } })} style={{ fontSize: 10.5 }} title={rc.hint} />
                <div className="module-sub" style={{ fontSize: 8.5, marginTop: 2 }}>{rc.label} · {rc.hint}</div>
              </div>
            ))}
          </div>

          <div className="label">{active.keyLabel}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input" type="password" autoComplete="off" value={secretDraft} placeholder={keyHas ? '•••••••• (stored)' : active.keyPlaceholder} onChange={e => setSecretDraft(e.target.value)} spellCheck={false} onKeyDown={e => e.key === 'Enter' && saveKey()} />
            <button className="btn" onClick={saveKey} disabled={!secretDraft.trim()}><Icon name="check" size={13} /> Save</button>
            {keyHas && <button className="btn btn-danger" onClick={removeKey} title="Delete stored credential"><Icon name="trash" size={13} /></button>}
          </div>
          <div className="module-sub" style={{ marginTop: 3 }}>{tauri ? 'Stored in Windows Credential Manager via native gateway — never written to disk by the app, never logged.' : 'Development fallback: stored in localStorage on this device only.'}</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 4 }}>
            <div>
              <div className="label">Temperature · {settings.temperature.toFixed(2)}</div>
              <input type="range" min={0} max={1} step={0.05} value={settings.temperature} onChange={e => update({ temperature: Number(e.target.value) })} style={{ width: '100%', accentColor: 'var(--green-600)' }} />
            </div>
            <div>
              <div className="label">Max tokens · {settings.maxTokens}</div>
              <input type="range" min={64} max={8192} step={64} value={settings.maxTokens} onChange={e => update({ maxTokens: Number(e.target.value) })} style={{ width: '100%', accentColor: 'var(--green-600)' }} />
            </div>
          </div>

          <div className="label">Reasoning tier · {tier.label} ({tier.effort})</div>
          <div role="radiogroup" aria-label="Reasoning tier" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {REASONING_TIERS.map(t => {
              const on = tier.id === t.id
              return (
                <button
                  key={t.id}
                  role="radio"
                  aria-checked={on}
                  className={on ? 'btn' : 'btn btn-ghost'}
                  title={t.description}
                  onClick={() => pickTier(t.id)}
                  style={
                    on
                      ? { background: 'var(--glass-bg-strong)', borderColor: 'var(--glass-border-strong)', color: 'var(--text)' }
                      : { background: 'transparent', borderColor: 'transparent', color: 'var(--text-dim)' }
                  }
                >
                  {t.label} · {t.effort}
                </button>
              )
            })}
          </div>
          <div className="module-sub" style={{ marginTop: 3 }}>{tier.description} · applies temperature + max tokens.</div>

          <div className="label">Agent system prompt (applied to all calls)</div>
          <textarea className="input" style={{ minHeight: 90, fontFamily: 'var(--font-mono)', fontSize: 10.5 }} value={settings.systemPrompt} onChange={e => update({ systemPrompt: e.target.value })} spellCheck={false} />

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12 }}>
            <button className="btn btn-primary" onClick={testConnection} disabled={testState === 'testing' || !configured}>
              <Icon name="refresh" size={13} /> {testState === 'testing' ? 'Testing…' : 'Test connection'}
            </button>
            {testState === 'ok' && <span className="chip"><Icon name="check" size={11} /> reachable</span>}
            {testState === 'fail' && <span className="chip" style={{ background: 'rgba(220,38,38,.12)', borderColor: 'rgba(220,38,38,.4)', color: '#b91c1c' }}>failed</span>}
          </div>
          {testMessage && (
            <div className="glass-faint" style={{ marginTop: 10, padding: '8px 10px', fontFamily: 'var(--font-mono)', fontSize: 10, whiteSpace: 'pre-wrap', maxHeight: 120, overflow: 'auto' }}>
              {testState === 'fail' ? '⚠ ' : '→ '}{testMessage}
            </div>
          )}
        </div>

        {/* FN-FDE-009 model catalog detail pane — glass tokens only */}
        <div className="glass panel" style={{ width: 300, flexShrink: 0, overflow: 'auto' }} aria-label="Model catalog">
          <div className="panel-title">Model catalog</div>
          <div role="tablist" aria-label="Catalog source" style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            {CATALOG_TABS.map(t => {
              const on = catalogTab === t.id
              return (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={on}
                  className={on ? 'btn' : 'btn btn-ghost'}
                  title={t.hint}
                  onClick={() => setCatalogTab(t.id)}
                  style={
                    on
                      ? { background: 'var(--glass-bg-strong)', borderColor: 'var(--glass-border-strong)', color: 'var(--text)', padding: '5px 10px', fontSize: 11 }
                      : { background: 'transparent', borderColor: 'transparent', color: 'var(--text-dim)', padding: '5px 10px', fontSize: 11 }
                  }
                >
                  {t.label}
                </button>
              )
            })}
          </div>
          <div className="module-sub" style={{ marginBottom: 8 }}>{CATALOG_TABS.find(t => t.id === catalogTab)?.hint}</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {entries.map(e => {
              const isActive = selected?.id === e.id
              return (
                <button
                  key={e.id}
                  className="preset-mini"
                  aria-pressed={isActive}
                  onClick={() => pickCatalogEntry(e)}
                  style={
                    isActive
                      ? { background: 'linear-gradient(120deg, rgba(34,197,94,.2), rgba(34,197,94,.06))', borderColor: 'var(--glass-border-strong)' }
                      : undefined
                  }
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700 }}>
                    {e.label}
                    {isActive && <span className="chip" style={{ fontSize: 8.5 }}>active</span>}
                  </span>
                  <small style={{ fontFamily: 'var(--font-mono)' }}>{e.providerId} · {e.model}</small>
                  <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                    {e.classes.slice(0, 2).map(c => (
                      <span key={c} className="chip chip-mono" style={{ fontSize: 8.5, padding: '1px 7px' }}>{c}</span>
                    ))}
                    <span className="chip chip-mono" style={{ fontSize: 8.5, padding: '1px 7px' }}>$ {e.cost}</span>
                    <span className="chip chip-mono" style={{ fontSize: 8.5, padding: '1px 7px' }}>{e.speed}</span>
                  </span>
                </button>
              )
            })}
          </div>

          {selected ? (
            <div className="glass-faint" style={{ marginTop: 10, padding: '10px 12px' }} aria-label={`Details for ${selected.label}`}>
              <div style={{ fontWeight: 700, fontSize: 12 }}>{selected.label}</div>
              <div className="module-sub" style={{ fontFamily: 'var(--font-mono)' }}>{selected.providerId} · {selected.model}</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', margin: '8px 0' }}>
                {selected.classes.map(c => (
                  <span key={c} className="chip" style={{ fontSize: 9 }}>{c}</span>
                ))}
                <span className="chip" style={{ fontSize: 9 }}>Cost · {selected.cost}</span>
                <span className="chip" style={{ fontSize: 9 }}>Speed · {selected.speed}</span>
                {selected.supportsReasoning && <span className="chip" style={{ fontSize: 9 }}>Reasoning</span>}
              </div>
              <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 10px', fontSize: 11 }}>
                <div><dt className="module-sub">Context</dt><dd className="chip-mono" style={{ margin: 0 }}>{formatContextTokens(selected.contextTokens)} tok</dd></div>
                <div><dt className="module-sub">Max output</dt><dd className="chip-mono" style={{ margin: 0 }}>{formatContextTokens(selected.maxOutputTokens)} tok</dd></div>
                <div><dt className="module-sub">TPM</dt><dd className="chip-mono" style={{ margin: 0 }}>{formatRate(selected.tpm)}/min</dd></div>
                <div><dt className="module-sub">RPM</dt><dd className="chip-mono" style={{ margin: 0 }}>{formatRate(selected.rpm)}/min</dd></div>
              </dl>
            </div>
          ) : (
            <div className="glass-faint" style={{ marginTop: 10, padding: '10px 12px' }}>
              <div className="module-sub">Custom model <span className="chip-mono">{settings.model}</span> — not in the catalog. Pick an entry to apply provider + model.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
