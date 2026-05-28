import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, CreditCard, ArrowLeftRight,
  Receipt, TrendingUp, Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/',              label: 'Dashboard',    icon: LayoutDashboard },
  { to: '/contas',        label: 'Contas',       icon: CreditCard },
  { to: '/transacoes',    label: 'Transações',   icon: ArrowLeftRight },
  { to: '/faturas',       label: 'Faturas',      icon: Receipt },
  { to: '/investimentos', label: 'Invest.',      icon: TrendingUp },
  { to: '/configuracoes', label: 'Config.',      icon: Settings },
]

export function MobileNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex border-t border-border bg-card">
      {NAV.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            cn(
              'flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
              isActive ? 'text-primary' : 'text-muted-foreground'
            )
          }
        >
          <Icon className="h-5 w-5" />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
