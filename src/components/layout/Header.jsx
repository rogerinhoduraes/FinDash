import { useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useEtlRuns } from '@/hooks/useEtlRuns'
import { formatDate } from '@/lib/formatters'
import useFinanceStore from '@/store/useFinanceStore'

const PAGE_META = {
  '/':              ['Visão geral',       'Dashboard'],
  '/contas':        ['Open Finance',      'Contas conectadas'],
  '/transacoes':    ['Movimentações',     'Transações'],
  '/faturas':       ['Cartões de crédito','Faturas'],
  '/investimentos': ['Carteira',          'Investimentos'],
  '/configuracoes': ['Conta & dados',     'Configurações'],
}

export function Topbar() {
  const { user, signOut } = useAuth()
  const uid = user?.uid
  const { pathname } = useLocation()
  const { theme, toggleTheme, privacyMode, togglePrivacy } = useFinanceStore()
  const { latest, runs } = useEtlRuns(uid, 1)

  const [kicker, title] = PAGE_META[pathname] ?? ['FinDash', 'Painel']
  const firstName = user?.displayName?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'Você'
  const displayTitle = pathname === '/' ? `Bom dia, ${firstName}` : title

  const syncTime = latest?.completedAt ?? latest?.startedAt
  const syncLabel = syncTime
    ? formatDate(syncTime?.toDate ? syncTime.toDate() : new Date(syncTime), 'dd/MM HH:mm')
    : '--:--'

  const initials = (user?.displayName ?? user?.email ?? 'U')
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <header className="topbar">
      <div>
        <div className="page-kicker">{kicker}</div>
        <h1>{displayTitle}</h1>
      </div>

      <div className="topbar-actions">
        <div className="status-pill" title="Última sincronização">
          <span className="dot" />
          <span>Sincronizado</span>
          <span className="ts">{syncLabel}</span>
        </div>

        <button
          className={'icon-btn' + (privacyMode ? ' on' : '')}
          onClick={togglePrivacy}
          title={privacyMode ? 'Exibir valores' : 'Ocultar valores'}
        >
          {privacyMode ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9.9 5.2A9.5 9.5 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.3 9.3 0 0 0 4.4-1.1"/>
              <path d="M3 3l18 18"/>
              <path d="M9.5 9.6a3 3 0 0 0 4.2 4.2"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          )}
        </button>

        <button
          className="icon-btn"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
        >
          {theme === 'dark' ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4"/>
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>
            </svg>
          )}
        </button>

        <button
          className="avatar"
          onClick={signOut}
          title="Sair da conta"
          style={{ cursor: 'pointer', border: 'none', padding: 0 }}
        >
          {user?.photoURL ? (
            <img src={user.photoURL} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
          ) : initials}
        </button>
      </div>
    </header>
  )
}
