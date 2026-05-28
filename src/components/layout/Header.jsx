import { Sun, Moon, LogOut, User } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import useFinanceStore from '@/store/useFinanceStore'
import { useEtlRuns } from '@/hooks/useEtlRuns'
import { formatRelativeTime } from '@/lib/formatters'
import { Badge } from '@/components/ui/badge'
import { useState } from 'react'

export function Header() {
  const { user, signOut } = useAuth()
  const { theme, toggleTheme } = useFinanceStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const { latest } = useEtlRuns(user?.uid, 1)

  const statusVariant = latest?.status === 'success' ? 'success'
    : latest?.status === 'error' ? 'danger'
    : 'warning'

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-card px-4 md:px-6">
      {/* ETL status */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {latest ? (
          <>
            <Badge variant={statusVariant}>
              {latest.status === 'success' ? 'Atualizado' : latest.status === 'error' ? 'Erro' : 'Processando'}
            </Badge>
            <span className="hidden sm:inline">{formatRelativeTime(latest.completedAt ?? latest.startedAt)}</span>
          </>
        ) : (
          <Badge variant="secondary">Aguardando ETL</Badge>
        )}
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Alternar tema"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-accent"
            aria-label="Menu do usuário"
          >
            {user?.photoURL ? (
              <img src={user.photoURL} alt="Avatar" className="h-7 w-7 rounded-full object-cover" />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground font-medium">
                {user?.displayName?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? <User className="h-3 w-3" />}
              </div>
            )}
            <span className="hidden sm:block text-sm font-medium">
              {user?.displayName?.split(' ')[0] ?? user?.email?.split('@')[0]}
            </span>
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-10 z-20 min-w-40 rounded-xl border border-border bg-card p-1 shadow-lg">
              <button
                onClick={() => { signOut(); setMenuOpen(false) }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
