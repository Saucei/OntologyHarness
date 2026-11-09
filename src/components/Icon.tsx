export type IconName = 'graph' | 'cube' | 'pipeline' | 'workshop' | 'spark' | 'doc' | 'search' | 'plus' | 'x' | 'check' | 'arrow' | 'table' | 'filter' | 'chart' | 'button' | 'list' | 'refresh' | 'trash' | 'download' | 'server' | 'database' | 'users' | 'kanban' | 'layers' | 'sun' | 'moon' | 'monitor'

const P: Record<IconName, React.ReactNode> = {
  graph: <><circle cx="6" cy="12" r="2.4"/><circle cx="12" cy="6" r="2.4"/><circle cx="18" cy="12" r="2.4"/><circle cx="12" cy="18" r="2.4"/><path d="M8 11l2.2-3.6M9.6 18.6l6.8-9.2M14.4 6l-2 8.4"/></>,
  cube: <><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"/><path d="M12 12l8-4.5M12 12L4 7.5M12 12v9"/></>,
  pipeline: <><circle cx="5" cy="6" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 7l3.4 3.4M14 13.5l3.4 3.4"/></>,
  workshop: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11"/></>,
  spark: <><path d="M12 2l2.2 6.2L20 10l-5.8 1.8L12 18l-2.2-6.2L4 10l5.8-1.8L12 2z"/></>,
  doc: <><path d="M7 3h7l4 4v14a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 016 21V4.5A1.5 1.5 0 017.5 3z"/><path d="M14 3v4h4M9.5 12h5M9.5 16h5"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></>,
  plus: <><path d="M12 5v14M5 12h14"/></>,
  x: <><path d="M6 6l12 12M18 6L6 18"/></>,
  check: <><path d="M4 12.5l5 5L20 6.5"/></>,
  arrow: <><path d="M5 12h14M13 6l6 6-6 6"/></>,
  table: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M9 10v9"/></>,
  filter: <><path d="M4 6h16l-6 7v5l-4-2v-3L4 6z"/></>,
  chart: <><path d="M4 19h16"/><path d="M7 15l4-5 4 3 5-7"/></>,
  button: <><rect x="3" y="8" width="18" height="8" rx="4"/></>,
  list: <><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></>,
  refresh: <><path d="M20 11A8 8 0 105.6 6.4M4 4v5h5"/></>,
  trash: <><path d="M4 7h16M9 7V4h6v3M6 7l1.5 14h9L18 7"/></>,
  download: <><path d="M12 3v12M7 10l5 5 5-5M4 20h16"/></>,
  server: <><rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/></>,
  database: <><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/></>,
  users: <><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0111 0"/><circle cx="17" cy="9.5" r="2.5"/><path d="M15.5 14.6a4.5 4.5 0 015 4.4"/></>,
  kanban: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9.5 4v16M15.5 4v16"/></>,
  layers: <><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/></>,
  sun: <><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M19.8 4.2L18 6M6 18l-1.8 1.8"/></>,
  moon: <><path d="M20 13.5A8.5 8.5 0 1110.5 4a7 7 0 009.5 9.5z"/></>,
  monitor: <><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M9 20h6M12 16v4"/></>,
}

export function Icon({ name, size = 16, style }: { name: IconName; size?: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={style}>
      {P[name]}
    </svg>
  )
}
