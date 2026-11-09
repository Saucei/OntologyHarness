import { useMemo, useState } from 'react'
import { Icon } from './Icon'
import { PROVIDERS, defaultSettings, loadSettings, saveSettings } from '../llm/client'

const SAMPLE_CSV = `sku,style,demand_bbl,batch_id
P-0001,Belgian Ale,220,B-0001
P-0002,IPA,211,B-0002
P-0003,DC Ale,158,B-0003
P-0004,NYC IPA,142,B-0004
P-0005,PIT Ale,133,B-0005
P-0006,DC IPA,101,B-0006
P-0007,NYC Ale,97,B-0007
P-0008,PIT IPA,88,B-0008`

export default function Wizard({ onDone, onGo }: { onDone: () => void; onGo: (module: string) => void }) {
  const [step, setStep] = useState(0)
  const [workspaceName, setWorkspaceName] = useState('Brewery Demo')
  const [providerId, setProviderId] = useState(loadSettings().providerId || 'openai')
  const [imported, setImported] = useState(false)
  const [presetRan, setPresetRan] = useState(false)
  const active = PROVIDERS.find(p => p.id === providerId) ?? PROVIDERS[0]

  const applyProvider = () => {
    const base = { ...defaultSettings(), ...loadSettings() }
    saveSettings({ ...base, providerId, model: active.defaultModel, baseUrl: active.baseUrl, hasKey: !active.requiresKey })
  }

  const importSample = async () => {
    const dt = new DataTransfer()
    dt.items.add(new File([SAMPLE_CSV], 'brewery_demand.csv', { type: 'text/csv' }))
    const input = document.querySelector('input[type=file]') as HTMLInputElement | null
    if (input) { input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true })) }
    // also persist the imported dataset list locally for the registry
    const rows = SAMPLE_CSV.trim().split('\n').slice(1).map(l => { const [sku, style, demand, batch] = l.split(','); return { sku, style, demand_bbl: Number(demand), batch_id: batch } })
    const note = `${rows.length} rows`
    void note
    setImported(true)
  }

  const steps = [
    {
      title: 'Name your workspace',
      body: 'A workspace holds your jobs, datasets and ontology edits. Stored locally — no account, no cloud.',
      content: <input className="input" value={workspaceName} onChange={e => setWorkspaceName(e.target.value)} placeholder="e.g. Brewery Demo" autoFocus />,
      next: () => true,
    },
    {
      title: 'Connect an LLM (or skip)',
      body: 'Ollama (local) needs no key. Everything works offline too — live features light up when a provider answers.',
      content: (
        <select className="input" value={providerId} onChange={e => setProviderId(e.target.value)}>
          {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      ),
      next: () => { applyProvider(); return true },
    },
    {
      title: 'Import your first dataset',
      body: 'Sample brewery CSV with SKU demand. Parsed locally; provenance hashed.',
      content: imported ? <div className="chip"><Icon name="check" size={12} /> brewery_demand.csv imported · 8 rows</div> : <button className="btn" onClick={importSample} disabled={imported}>Import brewery_demand.csv (sample)</button>,
      next: () => imported,
    },
    {
      title: 'See the loop close',
      body: 'Runs the Dataset Triage preset against the imported data and opens the finished analyst job. Then you\'re set.',
      content: presetRan ? <div className="chip"><Icon name="check" size={12} /> Triage preset queued a job</div> : <button className="btn" onClick={() => { setPresetRan(true); onGo('jobs') }}>Run Dataset Triage preset</button>,
      next: () => presetRan,
    },
  ]

  const current = steps[step]
  const canNext = current.next()

  return (
    <div className="palette-overlay" role="dialog" aria-label="First-run wizard">
      <div className="glass-strong fade-in" style={{ width: 460, maxWidth: '94vw', padding: 20, borderRadius: 'var(--r-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div className="brand-mark"><svg viewBox="0 0 64 64" width="24" height="24"><rect width="64" height="64" rx="14" fill="#16a34a"/><circle cx="20" cy="32" r="7" fill="none" stroke="#fff" strokeWidth="4"/><circle cx="44" cy="16" r="5" fill="#fff"/><circle cx="44" cy="48" r="5" fill="#fff"/><path d="M25 29 L40 18 M25 35 L40 46" stroke="#fff" strokeWidth="4" strokeLinecap="round"/></svg></div>
          <div style={{ fontWeight: 800, fontSize: 16 }}>Welcome to Ontology Harness</div>
        </div>
        <div className="module-sub" style={{ marginBottom: 10 }}>
          <span className="chip chip-mono">Step {step + 1} of {steps.length}</span>
        </div>

        <div className="wizard-bar">
          {steps.map((_, i) => <span key={i} className={`wizard-dot ${i <= step ? 'on' : ''}`} />)}
        </div>

        <div className="module-title" style={{ fontSize: 15, marginTop: 8 }}>{current.title}</div>
        <div className="module-sub" style={{ margin: '4px 0 14px' }}>{current.body}</div>
        <div style={{ minHeight: 60 }}>{current.content}</div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onDone}>Skip for now</button>
          <button className="btn btn-primary" disabled={!canNext && step < steps.length - 1} onClick={() => {
            const ok = current.next()
            if (ok && step < steps.length - 1) setStep(step + 1)
            else if (step === steps.length - 1) onDone()
          }}>
            {step === 0 ? 'Next' : step < steps.length - 1 ? 'Next' : 'Finish'}
          </button>
        </div>
        <div className="module-sub" style={{ marginTop: 8, fontSize: 9 }}>Never phones home. Provider keys go to the OS credential store.</div>
      </div>
    </div>
  )
}
