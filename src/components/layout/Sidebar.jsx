import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useEtlRuns } from '@/hooks/useEtlRuns'
import { formatDate } from '@/lib/formatters'
import { useBills } from '@/hooks/useBills'
import { differenceInDays, parseISO } from 'date-fns'

const NAV = [
  {
    to: '/', label: 'Dashboard', kicker: 'Visão geral',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="9" rx="1.5"/>
        <rect x="14" y="3" width="7" height="5" rx="1.5"/>
        <rect x="14" y="12" width="7" height="9" rx="1.5"/>
        <rect x="3" y="16" width="7" height="5" rx="1.5"/>
      </svg>
    ),
  },
  {
    to: '/contas', label: 'Contas', kicker: 'Open Finance',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2.5" y="5" width="19" height="14" rx="2.5"/>
        <path d="M2.5 10h19"/><path d="M16 15h2"/>
      </svg>
    ),
  },
  {
    to: '/transacoes', label: 'Transações', kicker: 'Movimentações',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 7h13l-3-3"/><path d="M17 17H4l3 3"/>
      </svg>
    ),
  },
  {
    to: '/faturas', label: 'Faturas', kicker: 'Cartões de crédito',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-2 2V3z"/>
        <path d="M9 8h6M9 12h6"/>
      </svg>
    ),
  },
  {
    to: '/investimentos', label: 'Investimentos', kicker: 'Carteira',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19V5M4 19h16"/><path d="M8 16l3.5-4 3 2.5L20 7"/>
      </svg>
    ),
  },
  {
    to: '/configuracoes', label: 'Configurações', kicker: 'Conta & dados',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3.2"/>
        <path d="M19.4 13a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 4.6 13H4a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V2a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.4.9z"/>
      </svg>
    ),
  },
]

export function Sidebar() {
  const { user, signOut } = useAuth()
  const uid = user?.uid
  const { latest } = useEtlRuns(uid, 1)
  const { bills } = useBills(uid)
  const { pathname } = useLocation()

  const urgentCount = bills.filter((b) => {
    if (b.status === 'PAID' || b.status === 'PAGA') return false
    const d = b.due_date ? parseISO(b.due_date) : null
    if (!d) return false
    const days = differenceInDays(d, new Date())
    return days >= 0 && days <= 5
  }).length

  const syncTime = latest?.completedAt ?? latest?.startedAt
  const syncLabel = syncTime
    ? formatDate(syncTime?.toDate ? syncTime.toDate() : new Date(syncTime), 'dd/MM HH:mm')
    : '--:--'

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">₣</div>
        <div className="brand-name">Fin<b>Dash</b></div>
      </div>

      <div className="nav-label">Geral</div>
      {NAV.slice(0, 5).map(({ to, label, icon }) => {
        const isActive = to === '/' ? pathname === '/' : pathname.startsWith(to)
        return (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={() => 'nav-item' + (isActive ? ' active' : '')}
          >
            {icon}
            <span>{label}</span>
            {to === '/faturas' && urgentCount > 0 && (
              <span className="nav-badge">{urgentCount}</span>
            )}
          </NavLink>
        )
      })}

      <div className="nav-label">Sistema</div>
      {NAV.slice(5).map(({ to, label, icon }) => {
        const isActive = pathname.startsWith(to)
        return (
          <NavLink
            key={to}
            to={to}
            className={() => 'nav-item' + (isActive ? ' active' : '')}
          >
            {icon}
            <span>{label}</span>
          </NavLink>
        )
      })}

      <div className="sidebar-foot">
        <div className="sync-card">
          <div className="row gap-sm">
            <span className="live-dot" />
            <span className="lbl">Open Finance</span>
          </div>
          <div className="ts">Sync {syncLabel}</div>
        </div>
        <button
          onClick={signOut}
          className="nav-item"
          style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', marginTop: 4, color: 'var(--text-faint)' }}
          title="Sair da conta"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18, flexShrink: 0 }}>
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          <span>Sair</span>
        </button>
      </div>
    </aside>
  )
}
