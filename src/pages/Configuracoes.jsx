import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useEtlRuns } from '@/hooks/useEtlRuns'
import { useTransactions } from '@/hooks/useTransactions'
import { useCustomCategories } from '@/hooks/useCustomCategories'
import { useExcludedCategories } from '@/hooks/useExcludedCategories'
import { db, auth } from '@/lib/firebase'
import { doc, setDoc } from 'firebase/firestore'
import { updateProfile } from 'firebase/auth'
import { formatDate, translateCategory } from '@/lib/formatters'
import useFinanceStore from '@/store/useFinanceStore'
import { SectionHead } from '@/components/ui/SectionHead'
import { BankDot } from '@/components/ui/BankDot'
import { Skeleton } from '@/components/ui/skeleton'

function Pref({ label, desc, on, onClick }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <div style={{ fontWeight: 500, fontSize: 14 }}>{label}</div>
        <div className="faint" style={{ fontSize: 12 }}>{desc}</div>
      </div>
      <div onClick={onClick} style={{ width: 46, height: 26, borderRadius: 99, background: on ? 'var(--accent)' : 'var(--surface-3)', cursor: 'pointer', padding: 3, transition: 'background .2s', flexShrink: 0 }}>
        <div style={{ width: 20, height: 20, borderRadius: 99, background: on ? 'var(--accent-ink)' : 'var(--text-faint)', transform: on ? 'translateX(20px)' : 'none', transition: 'transform .2s' }} />
      </div>
    </div>
  )
}

function MiniStat({ lbl, val, color }) {
  return (
    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px' }}>
      <div className="eyebrow">{lbl}</div>
      <div className="mono" style={{ fontSize: 20, fontWeight: 700, marginTop: 6, color: color || 'var(--text)' }}>{val}</div>
    </div>
  )
}

export default function Configuracoes() {
  const { user } = useAuth()
  const uid = user?.uid
  const { runs, loading: runsLoading } = useEtlRuns(uid, 20)
  const { theme, toggleTheme, privacyMode, togglePrivacy } = useFinanceStore()
  // includeExcluded so we can still see / count categories that are already hidden
  const { transactions } = useTransactions(uid, { maxDocs: 10000, includeExcluded: true })
  const { customCategories } = useCustomCategories(uid)
  const { excludedCategories, addExcluded, removeExcluded } = useExcludedCategories(uid)
  const [displayName, setDisplayName] = useState(user?.displayName ?? '')
  const [saving, setSaving] = useState(false)
  const [pickCat, setPickCat] = useState('')

  useEffect(() => {
    if (user?.displayName && !displayName) setDisplayName(user.displayName)
  }, [user?.displayName])
  const [syncing, setSyncing] = useState(false)
  const [normalizing, setNormalizing] = useState(false)
  const [msg, setMsg] = useState('')

  async function saveProfile() {
    setSaving(true); setMsg('')
    try {
      await updateProfile(auth.currentUser, { displayName })
      await setDoc(doc(db, 'users', uid, 'profile', 'data'), { displayName }, { merge: true })
      setMsg('Salvo!')
    } catch (e) { setMsg('Erro: ' + e.message) }
    finally { setSaving(false) }
  }

  async function forceEtl() {
    setSyncing(true); setMsg('')
    try {
      const token = await auth.currentUser.getIdToken()
      const baseUrl = import.meta.env.VITE_FIREBASE_FUNCTIONS_URL || `https://us-central1-${import.meta.env.VITE_FIREBASE_PROJECT_ID}.cloudfunctions.net`
      const res = await fetch(`${baseUrl}/forceEtl`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      })
      const data = await res.json().catch(() => ({}))
      setMsg(res.ok ? (data.message || 'Solicitação enviada. Dados serão atualizados em breve.') : 'Erro ao acionar.')
    } catch { setMsg('Erro de rede.') }
    finally { setSyncing(false) }
  }

  async function runNormalization() {
    if (!confirm('Deseja normalizar todo o banco de dados? Isso aplicará as regras mais recentes de nomes de bancos e metadados a registros antigos.')) return
    setNormalizing(true); setMsg('')
    try {
      const token = await auth.currentUser.getIdToken()
      const baseUrl = import.meta.env.VITE_FIREBASE_FUNCTIONS_URL || `https://us-central1-${import.meta.env.VITE_FIREBASE_PROJECT_ID}.cloudfunctions.net`
      const res = await fetch(`${baseUrl}/normalizeDatabase`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setMsg(`Sucesso! ${data.stats.transactions} transações, ${data.stats.accounts} contas e ${data.stats.bills} faturas normalizadas.`)
      } else {
        setMsg('Erro na normalização: ' + (data.error || 'Erro desconhecido'))
      }
    } catch { setMsg('Erro de rede ao normalizar.') }
    finally { setNormalizing(false) }
  }

  // Count transactions per category (across the whole base) for the picker + chips
  const catCounts = useMemo(() => {
    const m = new Map()
    for (const t of transactions) {
      const c = t.category || 'Others'
      m.set(c, (m.get(c) ?? 0) + 1)
    }
    return m
  }, [transactions])

  // Every category the user could exclude: those present in transactions + custom ones
  const allCategories = useMemo(() => {
    const set = new Set(catCounts.keys())
    customCategories.forEach((c) => set.add(c.key))
    return [...set]
      .map((key) => ({ key, label: translateCategory(key), count: catCounts.get(key) ?? 0 }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt', { sensitivity: 'base' }))
  }, [catCounts, customCategories])

  const stats = useMemo(() => {
    const s = { checking: 0, credit: 0, items: 0 }
    for (const r of runs) {
      s.checking += (r.stats?.accounts?.checked ?? 0)
      s.credit += (r.stats?.credit_cards?.checked ?? 0)
      s.items += (r.stats?.transactions?.added ?? 0)
    }
    return s
  }, [runs])

  return (
    <div className="fade-in grid gap-[22px]">
      <SectionHead title="Configurações" sub="Perfil e preferências do sistema" />

      <div className="g-wide-l">
        <div className="card">
          <SectionHead title="Preferências" />
          <div style={{ display: 'grid', gap: 20, marginTop: 12 }}>
            <Pref label="Tema Escuro" desc="Premium charcoal e oklch colors" on={theme === 'dark'} onClick={toggleTheme} />
            <Pref label="Modo Privacidade" desc="Oculta valores financeiros com desfoque" on={privacyMode} onClick={togglePrivacy} />
          </div>
        </div>

        <div className="card">
          <SectionHead title="Perfil" />
          <div style={{ display: 'grid', gap: 14, marginTop: 14 }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <span className="eyebrow">Nome de exibição</span>
              <input className="fd-input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Seu nome" />
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <span className="eyebrow">E-mail</span>
              <input className="fd-input" value={user?.email ?? ''} disabled style={{ opacity: 0.5 }} />
            </div>
            <div style={{ marginTop: 6 }}>
              <button className="btn primary px-8" disabled={saving} onClick={saveProfile}>{saving ? 'Salvando...' : 'Salvar Alterações'}</button>
              {msg && <span style={{ marginLeft: 16, fontSize: 13, color: msg.includes('Erro') ? 'var(--neg)' : 'var(--pos)' }}>{msg}</span>}
            </div>
          </div>
        </div>

        <div className="card">
          <SectionHead title="Exclusão de Categorias" sub="Ocultar do sistema" />
          <p className="faint" style={{ fontSize: 13, lineHeight: 1.6 }}>Transações nestas categorias serão ignoradas em todos os cálculos e gráficos (Dashboard, Análise, etc). Útil para remover transferências internas ou categorias ruidosas.</p>
          
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <select className="fd-select" value={pickCat} onChange={(e) => setPickCat(e.target.value)}>
              <option value="">Selecione uma categoria para excluir...</option>
              {allCategories.filter(c => !excludedCategories.includes(c.key)).map(c => (
                <option key={c.key} value={c.key}>{c.label} ({c.count} txs)</option>
              ))}
            </select>
            <button className="btn" disabled={!pickCat} onClick={() => { addExcluded(pickCat); setPickCat('') }}>Excluir</button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
            {excludedCategories.length === 0 ? (
              <span className="faint" style={{ fontSize: 12, fontStyle: 'italic' }}>Nenhuma categoria excluída.</span>
            ) : excludedCategories.map(key => (
              <span key={key} className="chip" style={{ background: 'var(--surface-3)', padding: '6px 12px', fontSize: 12 }}>
                {translateCategory(key)}
                <button style={{ marginLeft: 8, background: 'none', border: 'none', color: 'var(--neg)', cursor: 'pointer', fontWeight: 800 }} onClick={() => removeExcluded(key)}>×</button>
              </span>
            ))}
          </div>
        </div>
        <div className="card">
          <SectionHead title="Manutenção do Banco" sub="Limpeza e normalização" />
          <p className="faint" style={{ fontSize: 13, lineHeight: 1.6 }}>Corrige nomes de bancos, extrai metadados de parcelas faltantes e atualiza as chaves de mercadores em registros antigos.</p>
          <div style={{ marginTop: 18 }}>
            <button className="btn h-10 px-6" disabled={normalizing} onClick={runNormalization}>
              {normalizing ? 'Normalizando...' : 'Normalizar Base Histórica'}
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <SectionHead title="Pipeline Open Finance" sub="Status do ETL" 
          right={<button className="btn h-8" disabled={syncing} onClick={forceEtl}>{syncing ? 'Acionando...' : 'Sincronizar agora'}</button>} />
        
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <MiniStat lbl="Contas" val={stats.checking} />
          <MiniStat lbl="Cartões" val={stats.credit} />
          <MiniStat lbl="Novos itens" val={stats.items} color="var(--accent)" />
        </div>

        <div className="eyebrow mb-3">Histórico de execuções</div>
        <div className="overflow-x-auto" style={{ border: '1px solid var(--border)', borderRadius: 12 }}>
          <table className="tbl">
            <thead><tr><th>Início</th><th className="num">Duração</th><th>Status</th><th>Bancos</th></tr></thead>
            <tbody>
              {runsLoading ? [1,2,3].map(i => <tr key={i}><td colSpan={4}><Skeleton className="h-6 w-full" /></td></tr>) : 
               runs.map(r => (
                <tr key={r.id}>
                  <td className="mono faint">{formatDate(r.startedAt, 'dd/MM HH:mm')}</td>
                  <td className="num mono faint">{Math.round((r.finishedAt?.seconds - r.startedAt?.seconds) || 0)}s</td>
                  <td><span className={'badge-st ' + (r.status === 'COMPLETED' ? 'paid' : 'open')}>{r.status === 'COMPLETED' ? 'Sucesso' : 'Erro'}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {(r.banks || []).map(b => (
                        <BankDot key={b} bank={b} size={8} />
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {!runsLoading && runs.length === 0 && (
                <tr><td colSpan={4}><p className="faint" style={{ fontSize: 13 }}>Nenhuma execução registrada.</p></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
