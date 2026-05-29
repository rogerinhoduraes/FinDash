import { useAuth } from '@/hooks/useAuth'
import { useAccounts } from '@/hooks/useAccounts'
import { formatCurrency, getBankMeta } from '@/lib/formatters'
import useFinanceStore from '@/store/useFinanceStore'

function Sk({ w = '100%', h = 16, r = 8 }) {
  return <div className="sk" style={{ width: w, height: h, borderRadius: r }} />
}

function Money({ value }) {
  const { privacyMode } = useFinanceStore()
  return <span className={'money ' + (privacyMode ? 'blurred' : '')}>{formatCurrency(value)}</span>
}

function ContaCard({ a }) {
  const meta = getBankMeta(a.bank_name ?? a.bank ?? '')
  const isCredit = a.account_type === 'CREDIT'
  const balance = isCredit ? Math.abs(a.balance ?? 0) : (a.balance ?? 0)
  const limit = a.limit ?? 0
  const avail = a.available_limit ?? (limit - balance)
  const util = isCredit && limit > 0 ? (balance / limit) * 100 : 0

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', filter: 'blur(60px)', opacity: 0.3, top: -80, right: -50, background: meta.color, pointerEvents: 'none' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontWeight: 600, fontSize: 15 }}>
          <span className="bank-dot" style={{ background: meta.color, width: 12, height: 12 }} />{meta.label}
        </div>
        <span className="chip">{isCredit ? 'Crédito' : 'Conta corrente'}</span>
      </div>
      <div style={{ marginTop: 22, position: 'relative' }}>
        <div className="faint" style={{ fontSize: 12 }}>{isCredit ? 'Fatura atual' : 'Saldo disponível'}</div>
        <Money value={balance} />
      </div>
      {isCredit ? (
        <div style={{ marginTop: 20 }}>
          <div className="ubar" style={{ height: 8 }}>
            <i style={{ width: util + '%', background: util > 70 ? 'var(--neg)' : meta.color }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
            <StatItem lbl="Limite" val={limit} />
            <StatItem lbl="Disponível" val={avail} />
            <StatItem lbl="Uso" raw={util.toFixed(0) + '%'} color={util > 70 ? 'var(--neg)' : 'var(--text)'} />
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 22, marginTop: 20 }}>
          <StatItem lbl="Tipo" raw="Corrente" />
          <StatItem lbl="Open Finance" raw="Conectado" color="var(--pos)" />
        </div>
      )}
    </div>
  )
}

function StatItem({ lbl, val, raw, color }) {
  const { privacyMode } = useFinanceStore()
  return (
    <div>
      <div className="faint" style={{ fontSize: 11 }}>{lbl}</div>
      {raw
        ? <div className="mono" style={{ fontSize: 14, fontWeight: 600, color: color || 'var(--text)', marginTop: 2 }}>{raw}</div>
        : <span className={'money ' + (privacyMode ? 'blurred' : '')} style={{ fontSize: 14, fontWeight: 600, color }}>{formatCurrency(val)}</span>
      }
    </div>
  )
}

export default function Contas() {
  const { user } = useAuth()
  const { accounts, loading } = useAccounts(user?.uid)
  const checking = accounts.filter((a) => a.account_type !== 'CREDIT')
  const credit   = accounts.filter((a) => a.account_type === 'CREDIT')
  const totalChk  = checking.reduce((s, a) => s + (a.balance ?? 0), 0)
  const totalDebt = credit.reduce((s, a) => s + Math.abs(a.balance ?? 0), 0)

  if (loading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 18 }}>
        {[1,2,3,4,5,6].map((i) => <Sk key={i} w="100%" h={190} r={22} />)}
      </div>
    )
  }

  return (
    <div className="stagger" style={{ display: 'grid', gap: 26 }}>
      {checking.length > 0 && (
        <div>
          <div className="section-head">
            <span className="section-title">Conta corrente &amp; poupança</span>
            <span className="section-sub">saldo total <span className="money">{formatCurrency(totalChk)}</span></span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 18 }}>
            {checking.map((a) => <ContaCard key={a.id} a={a} />)}
          </div>
        </div>
      )}
      {credit.length > 0 && (
        <div>
          <div className="section-head">
            <span className="section-title">Cartões de crédito</span>
            <span className="section-sub">fatura total <span className="money">{formatCurrency(totalDebt)}</span></span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 18 }}>
            {credit.map((a) => <ContaCard key={a.id} a={a} />)}
          </div>
        </div>
      )}
      {accounts.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-faint)' }}>
          Nenhuma conta encontrada. Aguarde a próxima sincronização.
        </div>
      )}
    </div>
  )
}
