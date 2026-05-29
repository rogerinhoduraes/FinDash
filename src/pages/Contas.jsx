import { useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useAccounts } from '@/hooks/useAccounts'
import { useBills } from '@/hooks/useBills'
import { formatCurrency, getBankMeta } from '@/lib/formatters'
import { differenceInDays, parseISO } from 'date-fns'
import useFinanceStore from '@/store/useFinanceStore'

function Sk({ w = '100%', h = 16, r = 8 }) {
  return <div className="sk" style={{ width: w, height: h, borderRadius: r }} />
}

function Money({ value, style }) {
  const { privacyMode } = useFinanceStore()
  return <span className={'money ' + (privacyMode ? 'blurred' : '')} style={style}>{formatCurrency(value)}</span>
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
        <div className="faint" style={{ fontSize: 12 }}>Saldo disponível</div>
        <Money value={balance} />
      </div>
      <div style={{ display: 'flex', gap: 22, marginTop: 20 }}>
        <StatItem lbl="Tipo" raw="Corrente" />
        <StatItem lbl="Open Finance" raw="Conectado" color="var(--pos)" />
      </div>
    </div>
  )
}

function CreditCard({ a, bills }) {
  const meta = getBankMeta(a.bank_name ?? a.bank ?? '')
  const limit = a.limit ?? 0
  const avail = a.available_limit ?? 0
  const today = new Date().toISOString().slice(0, 10)

  // Match bills to this card.
  // account_id can differ between ETL runs (Pluggy regenerates IDs on reconnect),
  // so canonical bank label via getBankMeta is the stable key.
  const myLabel = meta.label.toLowerCase()
  const cardBills = useMemo(() =>
    bills
      .filter((b) => {
        if (b.account_id && a.account_id && b.account_id === a.account_id) return true
        const billLabel = getBankMeta(b.bank ?? '').label.toLowerCase()
        if (billLabel === myLabel) return true
        // last resort: substring match on raw bank name
        const billBank = (b.bank ?? '').toLowerCase()
        const accBank  = (a.bank_name ?? a.bank ?? '').toLowerCase()
        return billBank && accBank && (billBank.includes(accBank) || accBank.includes(billBank))
      })
      .sort((x, y) => (x.due_date ?? '').localeCompare(y.due_date ?? '')),
    [bills, a.account_id, myLabel, a.bank_name, a.bank]
  )

  // Current bill = earliest open future bill; fallback = most recent bill regardless of status/date
  const currentBill = cardBills.find(
    (b) => (b.due_date ?? '') >= today && b.status !== 'PAID' && b.status !== 'PAGA'
  ) ?? [...cardBills].reverse().find(Boolean)

  // Future installments = open future bills after the current bill
  const futureBills = cardBills.filter(
    (b) =>
      (b.due_date ?? '') > (currentBill?.due_date ?? today) &&
      b.status !== 'PAID' && b.status !== 'PAGA'
  )
  const futureTotal = futureBills.reduce((s, b) => s + (b.total ?? 0), 0)

  const currentAmount = currentBill?.total ?? Math.abs(a.balance ?? 0)
  const util = limit > 0 ? (currentAmount / limit) * 100 : 0

  const daysUntilDue = currentBill?.due_date
    ? differenceInDays(parseISO(currentBill.due_date), new Date())
    : null

  const isPastDue = daysUntilDue !== null && daysUntilDue < 0
  const isPaid    = currentBill?.status === 'PAID' || currentBill?.status === 'PAGA'
  const urgent    = daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= 5

  return (
    <div className="card" style={{ overflow: 'hidden', borderColor: urgent ? 'var(--neg)' : 'var(--border)' }}>
      <div style={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', filter: 'blur(60px)', opacity: 0.3, top: -80, right: -50, background: meta.color, pointerEvents: 'none' }} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontWeight: 600, fontSize: 15 }}>
          <span className="bank-dot" style={{ background: meta.color, width: 12, height: 12 }} />{meta.label}
        </div>
        <span className="chip">Crédito</span>
      </div>

      {/* Fatura atual */}
      <div style={{ marginTop: 18, position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span className="eyebrow">Fatura atual</span>
            {isPaid && <span className="badge-st paid" style={{ fontSize: 10, padding: '1px 6px' }}>Paga</span>}
          </div>
          {daysUntilDue !== null && (
            <span className="faint" style={{ fontSize: 11 }}>
              {isPaid ? 'paga' : daysUntilDue === 0 ? 'vence hoje' : daysUntilDue === 1 ? 'vence amanhã' : isPastDue ? `venceu há ${Math.abs(daysUntilDue)}d` : `vence em ${daysUntilDue}d`}
              {currentBill?.due_date ? ` · ${currentBill.due_date.slice(8)}.${currentBill.due_date.slice(5,7)}` : ''}
            </span>
          )}
        </div>
        <Money value={currentAmount} style={{ fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 800, display: 'block', marginTop: 4, lineHeight: 1.1 }} />
      </div>

      {/* Utilization bar */}
      {limit > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="ubar" style={{ height: 7 }}>
            <i style={{ width: Math.min(util, 100) + '%', background: util > 70 ? 'var(--neg)' : meta.color }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            <StatItem lbl="Limite" val={limit} />
            <StatItem lbl="Disponível" val={Math.max(0, avail || limit - currentAmount)} />
            <StatItem lbl="Uso" raw={util.toFixed(0) + '%'} color={util > 70 ? 'var(--neg)' : 'var(--text)'} />
          </div>
        </div>
      )}

      {/* Parcelamentos futuros */}
      {futureTotal > 0.005 && (
        <div style={{
          marginTop: 16, padding: '12px 14px', borderRadius: 12,
          background: 'var(--surface-2)', border: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: 3 }}>Parcelamentos futuros</div>
              <div className="faint" style={{ fontSize: 11 }}>{futureBills.length} fatura{futureBills.length !== 1 ? 's' : ''} · próx. {futureBills[0]?.due_date?.slice(8)}.{futureBills[0]?.due_date?.slice(5,7)}</div>
            </div>
            <Money value={futureTotal} style={{ fontWeight: 700, fontSize: 15 }} />
          </div>
          {/* Mini timeline */}
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            {futureBills.slice(0, 6).map((b) => (
              <div key={b.id} style={{
                background: 'var(--surface-3)', borderRadius: 8, padding: '4px 8px',
                fontSize: 11, display: 'flex', gap: 5, alignItems: 'center',
              }}>
                <span className="faint">{b.due_date?.slice(5, 7)}/{b.due_date?.slice(2, 4)}</span>
                <Money value={b.total ?? 0} style={{ fontWeight: 600, fontSize: 11 }} />
              </div>
            ))}
            {futureBills.length > 6 && (
              <div style={{ background: 'var(--surface-3)', borderRadius: 8, padding: '4px 8px', fontSize: 11 }} className="faint">
                +{futureBills.length - 6}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Contas() {
  const { user } = useAuth()
  const { accounts, loading: accLoading } = useAccounts(user?.uid)
  const { bills, loading: billsLoading } = useBills(user?.uid)
  const { privacyMode } = useFinanceStore()

  const loading = accLoading || billsLoading

  const checking = accounts.filter((a) => a.account_type !== 'CREDIT' && Math.abs(Number(a.balance ?? 0)) >= 0.005)
  const credit   = accounts.filter((a) => a.account_type === 'CREDIT' && (Math.abs(Number(a.balance ?? 0)) >= 0.005 || Number(a.limit ?? 0) > 0))

  const totalChk  = checking.reduce((s, a) => s + (a.balance ?? 0), 0)
  const totalDebt = credit.reduce((s, a) => s + Math.abs(a.balance ?? 0), 0)

  if (loading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 18 }}>
        {[1,2,3,4,5,6].map((i) => <Sk key={i} w="100%" h={220} r={22} />)}
      </div>
    )
  }

  return (
    <div className="stagger" style={{ display: 'grid', gap: 26 }}>
      {checking.length > 0 && (
        <div>
          <div className="section-head">
            <span className="section-title">Conta corrente &amp; poupança</span>
            <span className="section-sub">saldo total <span className={'money ' + (privacyMode ? 'blurred' : '')}>{formatCurrency(totalChk)}</span></span>
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
            <span className="section-sub">fatura total <span className={'money ' + (privacyMode ? 'blurred' : '')}>{formatCurrency(totalDebt)}</span></span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 18 }}>
            {credit.map((a) => <CreditCard key={a.id} a={a} bills={bills} />)}
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
