import { useEffect, useRef, useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useEtlRuns } from '@/hooks/useEtlRuns'
import { useNewTransactions } from '@/hooks/useNewTransactions'
import { useTransactions } from '@/hooks/useTransactions'
import { useClassificationRules } from '@/hooks/useClassificationRules'
import { useCustomCategories } from '@/hooks/useCustomCategories'
import { formatCurrency, formatDate, translateCategory } from '@/lib/formatters'
import useFinanceStore from '@/store/useFinanceStore'
import { CATEGORIES, compareCategories, merchantKey } from '@/lib/categories'
import { doc, writeBatch } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Select } from '@/components/ui/select'

const NAV_SYSTEM = [
  {
    to: '/classificacao', label: 'Classificação',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 6h16M4 12h10M4 18h7"/><path d="m15 15 2 2 4-4"/>
      </svg>
    ),
  },
  {
    to: '/configuracoes', label: 'Configurações',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3.2"/>
        <path d="M19.4 13a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 4.6 13H4a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V2a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.4.9z"/>
      </svg>
    ),
  },
]

function AvatarMenu() {
  const { user, signOut } = useAuth()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, right: 0 })
  const triggerRef = useRef(null)
  const popRef = useRef(null)

  const place = () => {
    const r = triggerRef.current?.getBoundingClientRect()
    if (r) setPos({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) })
  }

  useEffect(() => {
    if (!open) return
    place()
    const onDown = (e) => {
      if (triggerRef.current?.contains(e.target)) return
      if (popRef.current?.contains(e.target)) return
      setOpen(false)
    }
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  // Close the menu whenever navigation happens.
  useEffect(() => { setOpen(false) }, [pathname])

  const initials = (user?.displayName ?? user?.email ?? 'U')
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  const name = user?.displayName ?? user?.email?.split('@')[0] ?? 'Você'

  return (
    <div className="avatar-menu">
      <button
        ref={triggerRef}
        className="avatar avatar-trigger"
        onClick={() => setOpen((v) => !v)}
        title="Conta e ajustes"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {user?.photoURL ? (
          <img src={user.photoURL} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : initials}
      </button>

      {open && createPortal(
        <div
          ref={popRef}
          className="avatar-pop"
          role="menu"
          style={{ position: 'fixed', top: pos.top, right: pos.right }}
        >
          <div className="avatar-pop-head">
            <div className="apop-name">{name}</div>
            {user?.email && <div className="apop-mail">{user.email}</div>}
          </div>
          {NAV_SYSTEM.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              role="menuitem"
              className={({ isActive }) => 'apop-item' + (isActive ? ' active' : '')}
            >
              {icon}
              <span>{label}</span>
            </NavLink>
          ))}
          <div className="apop-sep" />
          <button className="apop-item danger" onClick={signOut} role="menuitem">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            <span>Sair</span>
          </button>
        </div>,
        document.body
      )}
    </div>
  )
}

function NotificationsMenu({ uid }) {
  const { pathname } = useLocation()
  const { items, count } = useNewTransactions(uid)
  const { transactions } = useTransactions(uid, { maxDocs: 5000 })
  const { saveRule } = useClassificationRules(uid)
  const { customCategories } = useCustomCategories(uid)
  
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, right: 0 })
  const [isClassifying, setIsClassifying] = useState(null) // key
  const [saving, setSaving] = useState(null) // key
  
  const triggerRef = useRef(null)
  const popRef = useRef(null)

  const allCategories = useMemo(() => [
    ...CATEGORIES,
    ...customCategories.map(c => ({ key: c.key, pt: c.label, custom: true })),
  ].sort(compareCategories), [customCategories])

  const options = useMemo(() => allCategories.map(c => ({ value: c.key, label: c.pt })), [allCategories])

  const place = () => {
    const r = triggerRef.current?.getBoundingClientRect()
    if (r) setPos({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) })
  }

  useEffect(() => {
    if (!open) return
    place()
    const onDown = (e) => {
      if (triggerRef.current?.contains(e.target)) return
      if (popRef.current?.contains(e.target)) return
      setOpen(false)
    }
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  // Close on navigation.
  useEffect(() => { 
    setOpen(false)
    setIsClassifying(null)
  }, [pathname])

  async function handleQuickClassify(it, category) {
    if (!uid || saving || !category) return
    setSaving(it.key)
    try {
      const pattern = it.key // it.key is already the merchantKey
      // Find all transactions matching this merchant fingerprint
      const toUpdate = transactions.filter(t =>
        merchantKey(t.description) === pattern
      )

      if (toUpdate.length > 0) {
        // Process in batches of 500
        for (let i = 0; i < toUpdate.length; i += 500) {
          const batch = writeBatch(db)
          toUpdate.slice(i, i + 500).forEach(t => {
            batch.update(doc(db, `users/${uid}/transactions`, t.id), { category })
          })
          await batch.commit()
        }
      }
      
      await saveRule({ pattern, category })
      setIsClassifying(null)
    } catch (err) {
      console.error('Quick classify error:', err)
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="avatar-menu">
      <button
        ref={triggerRef}
        className={'icon-btn' + (count > 0 ? ' has-alert' : '')}
        onClick={() => setOpen((v) => !v)}
        title={count > 0 ? `${count} nova(s) transação(ões) para classificar` : 'Sem novidades para classificar'}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{ position: 'relative' }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {count > 0 && (
          <span
            style={{
              position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, padding: '0 4px',
              borderRadius: 999, background: 'var(--neg, #e5484d)', color: '#fff',
              fontSize: 10, fontWeight: 700, lineHeight: '16px', textAlign: 'center',
              boxShadow: '0 0 0 2px var(--surface)',
            }}
          >
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && createPortal(
        <div
          ref={popRef}
          className="avatar-pop"
          role="menu"
          style={{ position: 'fixed', top: pos.top, right: pos.right, width: 420, maxWidth: 'calc(100vw - 16px)' }}
        >
          <div className="avatar-pop-head" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
            <div className="apop-name">Novas transações</div>
            <div className="apop-mail" style={{ margin: 0 }}>{count} para classificar</div>
          </div>
          <div className="apop-sep" />

          {count === 0 ? (
            <div style={{ padding: '20px 12px', textAlign: 'center', color: 'var(--text-faint)', fontSize: 12.5 }}>
              Nenhum recebedor novo aguardando classificação este mês. 🎉
            </div>
          ) : (
            <div style={{ maxHeight: 380, overflowY: 'auto', display: 'grid', gap: 2 }}>
              {items.map((it) => (
                <div key={it.key} className="apop-item" style={{ alignItems: 'center', gap: 12, cursor: 'default' }}>
                  <NavLink
                    to="/classificacao"
                    role="menuitem"
                    style={{ minWidth: 0, flex: 1, textDecoration: 'none', color: 'inherit' }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', lineHeight: 1.4 }}>
                      {it.description || '—'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span>{it.bank ?? '—'}</span>
                      <span>·</span>
                      <span>{it.date ? formatDate(it.date, 'dd/MM') : '—'}</span>
                      {it.count > 1 && (<><span>·</span><span>{it.count}×</span></>)}
                    </div>
                  </NavLink>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, fontFamily: 'var(--font-mono)', color: it.total < 0 ? 'var(--neg)' : 'var(--pos)' }}>
                      {formatCurrency(it.total)}
                    </span>
                    
                    {isClassifying === it.key ? (
                      <Select
                        className="h-8 py-0 px-2 text-xs w-32"
                        placeholder="Cat..."
                        options={options}
                        onChange={(val) => handleQuickClassify(it, val)}
                        disabled={saving === it.key}
                      />
                    ) : (
                      <button
                        className="btn icon-btn"
                        style={{ width: 28, height: 28, padding: 0, borderRadius: 6, background: 'var(--surface-3)' }}
                        onClick={(e) => { e.preventDefault(); setIsClassifying(it.key) }}
                        title="Classificar rapidamente"
                      >
                        {saving === it.key ? (
                          <svg className="animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14, opacity: 0.7 }}>
                            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
                            <path d="M12 5v14M5 12h14" />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {count > 0 && (
            <>
              <div className="apop-sep" />
              <NavLink to="/classificacao" role="menuitem" className="apop-item" style={{ justifyContent: 'center', color: 'var(--accent)', fontWeight: 600 }}>
                Ver todas na central de classificação
              </NavLink>
            </>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}

const PAGE_META = {
  '/':              ['Visão geral',       'Dashboard'],
  '/contas':        ['Open Finance',      'Contas conectadas'],
  '/transacoes':    ['Movimentações',     'Transações'],
  '/faturas':       ['Cartões de crédito','Faturas'],
  '/investimentos': ['Carteira',          'Investimentos'],
  '/analise':       ['Inteligência financeira', 'Análise'],
  '/configuracoes': ['Conta & dados',     'Configurações'],
  '/etl-status':    ['Pipeline de dados',  'Monitoramento ETL'],
}

export function Topbar() {
  const { user } = useAuth()
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

        <NotificationsMenu uid={uid} />

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

        <AvatarMenu />
      </div>
    </header>
  )
}
