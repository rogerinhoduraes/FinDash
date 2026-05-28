import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, CreditCard, ArrowLeftRight,
  Receipt, TrendingUp, Settings, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import useFinanceStore from '@/store/useFinanceStore'

const NAV = [
  { to: '/',              label: 'Dashboard',    icon: LayoutDashboard },
  { to: '/contas',        label: 'Contas',       icon: CreditCard },
  { to: '/transacoes',    label: 'Transações',   icon: ArrowLeftRight },
  { to: '/faturas',       label: 'Faturas',      icon: Receipt },
  { to: '/investimentos', label: 'Investimentos',icon: TrendingUp },
  { to: '/configuracoes', label: 'Configurações',icon: Settings },
]

export function Sidebar() {
  const collapsed = useFinanceStore((s) => s.sidebarCollapsed)
  const toggle = useFinanceStore((s) => s.toggleSidebar)

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col border-r border-border bg-card transition-all duration-300',
        collapsed ? 'w-16' : 'w-56'
      )}
    >
      {/* Logo */}
      <div className={cn('flex h-16 items-center border-b border-border px-4', collapsed && 'justify-center')}>
        {!collapsed && (
          <span className="text-lg font-bold text-primary">Fin<span className="text-foreground">Dash</span></span>
        )}
        {collapsed && <span className="text-lg font-bold text-primary">F</span>}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 p-2">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                collapsed && 'justify-center px-2'
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" aria-label={label} />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={toggle}
        className="m-2 flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-accent"
        aria-label={collapsed ? 'Expandir sidebar' : 'Recolher sidebar'}
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
    </aside>
  )
}
