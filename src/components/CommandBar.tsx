// Shared CommandBar — every module gets the same top action row.
import { Icon, type IconName } from './Icon'

export type CommandAction = { label: string; icon: IconName; primary?: boolean; onClick: () => void; disabled?: boolean; title?: string }

export function CommandBar({ actions, right }: { actions: CommandAction[]; right?: React.ReactNode }) {
  return (
    <div className="commandbar" role="toolbar" aria-label="Module actions">
      {actions.map((a, i) => (
        <button key={i} className={`btn ${a.primary ? 'btn-primary' : ''}`} onClick={a.onClick} disabled={a.disabled} title={a.title ?? a.label}>
          <Icon name={a.icon} size={13} /> {a.label}
        </button>
      ))}
      {right && <span className="commandbar-right">{right}</span>}
    </div>
  )
}
