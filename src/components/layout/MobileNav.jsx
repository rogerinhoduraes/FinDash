import { NavLink, useLocation } from 'react-router-dom'

const NAV = [
  {
    to: '/', label: 'Dashboard',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>,
  },
  {
    to: '/contas', label: 'Contas',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19"/><path d="M16 15h2"/></svg>,
  },
  {
    to: '/transacoes', label: 'Transações',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 7h13l-3-3"/><path d="M17 17H4l3 3"/></svg>,
  },
  {
    to: '/faturas', label: 'Faturas',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-2 2V3z"/><path d="M9 8h6M9 12h6"/></svg>,
  },
  {
    to: '/investimentos', label: 'Carteira',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19V5M4 19h16"/><path d="M8 16l3.5-4 3 2.5L20 7"/></svg>,
  },
]

export function MobileNav() {
  const { pathname } = useLocation()
  return (
    <nav
      style={{
        display: 'none',
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40,
        background: 'color-mix(in oklab, var(--bg-deep) 90%, transparent)',
        backdropFilter: 'blur(14px)',
        borderTop: '1px solid var(--border)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
      className="mobile-nav"
    >
      {NAV.map(({ to, label, icon }) => {
        const isActive = to === '/' ? pathname === '/' : pathname.startsWith(to)
        return (
          <NavLink
            key={to}
            to={to}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 3, padding: '10px 0',
              color: isActive ? 'var(--accent)' : 'var(--text-faint)',
              textDecoration: 'none', transition: 'color .18s',
            }}
          >
            <span style={{ display: 'grid', placeItems: 'center', width: 22, height: 22 }}>
              {icon}
            </span>
            {isActive && (
              <span style={{ fontSize: 10, fontWeight: 600 }}>{label}</span>
            )}
          </NavLink>
        )
      })}
    </nav>
  )
}
