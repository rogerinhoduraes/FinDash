import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useEtlRuns } from '@/hooks/useEtlRuns'
import { db, auth } from '@/lib/firebase'
import { doc, setDoc } from 'firebase/firestore'
import { updateProfile } from 'firebase/auth'
import { formatDate } from '@/lib/formatters'
import useFinanceStore from '@/store/useFinanceStore'

function getBankColor(bank) {
  const b = (bank ?? '').toLowerCase()
  if (b.includes('nubank')) return 'var(--nubank)'
  if (b.includes('santander')) return 'var(--santander)'
  if (b.includes('inter')) return 'var(--inter)'
  return 'var(--text-faint)'
}

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
  const [displayName, setDisplayName] = useState(user?.displayName ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (user?.displayName && !displayName) setDisplayName(user.displayName)
  }, [user?.displayName])
  const [syncing, setSyncing] = useState(false)
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
      const res = await fetch('https://forceetl-lp2z3bmcqa-uc.a.run.app', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      })
      const data = await res.json().catch(() => ({}))
      setMsg(res.ok ? (data.message ?? 'Solicitação enviada. Dados serão atualizados em breve.') : 'Erro ao acionar. Tente via GitHub Actions.')
    } catch { setMsg('Erro de rede. ETL atualiza automaticamente a cada hora.') }
    finally { setSyncing(false) }
  }

  const successRuns = runs.filter((r) => r.status === 'success').length
  const latestRun = runs[0]
  const latestTime = latestRun?.startedAt
  const latestLabel = latestTime ? formatDate(latestTime?.toDate ? latestTime.toDate() : new Date(latestTime), 'dd/MM HH:mm') : '--:--'

  return (
    <div className="stagger g-split" style={{ alignItems: 'start' }}>
      <div style={{ display: 'grid', gap: 18 }}>
        {/* Profile */}
        <div className="card">
          <div className="section-head" style={{ marginBottom: 18 }}>
            <span className="section-title">Perfil</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
            <div style={{ width: 54, height: 54, borderRadius: 16, background: 'linear-gradient(135deg,var(--nubank),var(--inter))', display: 'grid', placeItems: 'center', color: 'white', fontWeight: 700, fontSize: 18, fontFamily: 'var(--font-display)', flexShrink: 0 }}>
              {displayName.split(' ').map((s) => s[0]).slice(0, 2).join('')}
            </div>
            <div>
              <div style={{ fontWeight: 600 }}>{user?.displayName || displayName}</div>
              <div className="faint" style={{ fontSize: 12.5 }}>{user?.email}</div>
            </div>
          </div>
          <label className="eyebrow" style={{ display: 'block', marginBottom: 8 }}>Nome de exibição</label>
          <input className="fd-input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          {msg && <div className="faint" style={{ fontSize: 12.5, marginTop: 8, color: 'var(--pos)' }}>{msg}</div>}
          <button className="btn primary" style={{ marginTop: 14, width: '100%' }} onClick={saveProfile} disabled={saving || !displayName.trim() || displayName === (user?.displayName ?? '')}>
            {saving ? 'Salvando…' : 'Salvar alterações'}
          </button>
        </div>

        {/* Prefs */}
        <div className="card">
          <div className="section-head" style={{ marginBottom: 16 }}>
            <span className="section-title">Preferências</span>
          </div>
          <div style={{ display: 'grid', gap: 16 }}>
            <Pref label="Tema escuro" desc="Persistido entre sessões" on={theme === 'dark'} onClick={toggleTheme} />
            <div style={{ height: 1, background: 'var(--border)' }} />
            <Pref label="Modo privacidade" desc="Oculta todos os valores monetários" on={privacyMode} onClick={togglePrivacy} />
          </div>
        </div>
      </div>

      {/* Sync + ETL log */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18 }}>Sincronização de dados</h2>
            <div className="faint" style={{ fontSize: 12.5, marginTop: 3 }}>Pipeline ETL via Pluggy Open Finance · 3 bancos</div>
          </div>
          <button className="btn primary" onClick={forceEtl} disabled={syncing} style={{ flexShrink: 0 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }} className={syncing ? 'spin' : ''}><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>
            {syncing ? 'Sincronizando…' : 'Sincronizar agora'}
          </button>
        </div>

        <div className="g-3" style={{ gap: 12, marginBottom: 18 }}>
          <MiniStat lbl="Última execução" val={latestLabel} />
          <MiniStat lbl="Execuções recentes" val={runs.length} />
          <MiniStat lbl="Taxa de sucesso" val={runs.length ? Math.round(successRuns / runs.length * 100) + '%' : '—'} color="var(--pos)" />
        </div>

        <div className="eyebrow" style={{ marginBottom: 10 }}>Histórico de execuções</div>
        {runsLoading ? (
          <div style={{ display: 'grid', gap: 8 }}>{[1,2,3].map((i) => <div key={i} className="sk" style={{ height: 44, borderRadius: 8 }} />)}</div>
        ) : (
          <table className="tbl">
            <thead><tr><th>Início</th><th>Banco</th><th>Status</th><th className="num">Transações</th></tr></thead>
            <tbody>
              {runs.map((r, i) => {
                const t = r.startedAt?.toDate ? r.startedAt.toDate() : r.startedAt ? new Date(r.startedAt) : null
                return (
                  <tr key={r.id ?? i}>
                    <td className="mono faint" style={{ whiteSpace: 'nowrap', fontSize: 12.5 }}>{t ? formatDate(t, 'dd/MM HH:mm') : '—'}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13 }}>
                        <span className="bank-dot" style={{ background: getBankColor(r.bank) }} />{r.bank ?? '—'}
                      </div>
                    </td>
                    <td>
                      {r.status === 'success'
                        ? <span className="badge-st paid">sucesso</span>
                        : <span className="badge-st div">erro</span>
                      }
                    </td>
                    <td className="num mono">{r.counts?.transactions ?? '—'}</td>
                  </tr>
                )
              })}
              {runs.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', padding: 24, color: 'var(--text-faint)' }}>Nenhuma execução encontrada</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
