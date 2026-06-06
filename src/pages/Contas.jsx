import { useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useAccounts } from '@/hooks/useAccounts'
import { useBills } from '@/hooks/useBills'
import { getBankMeta } from '@/lib/formatters'
import { Money } from '@/components/ui/Money'
import { BankDot } from '@/components/ui/BankDot'
import { Skeleton } from '@/components/ui/skeleton'
import { SectionHead } from '@/components/ui/SectionHead'

function StatItem({ lbl, val, raw, color }) {
  return (
    <div>
      <div className="faint" style={{ fontSize: 11 }}>{lbl}</div>
      {raw
        ? <div className="mono" style={{ fontSize: 14, fontWeight: 600, color: color || 'var(--text)', marginTop: 2 }}>{raw}</div>
        : <Money value={val} style={{ fontSize: 14, fontWeight: 600, color }} />
      }
    </div>
  )
}

function ContaCard({ a }) {
  const meta = getBankMeta(a.bank_name ?? a.bank ?? '')
  const isCredit = a.account_type === 'CREDIT'
  const balance = isCredit ? Math.abs(a.balance ?? 0) : (a.balance ?? 0)

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', filter: 'blur(60px)', opacity: 0.26, top: -80, right: -50, background: meta.color, pointerEvents: 'none' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontWeight: 600, fontSize: 15 }}>
          <BankDot bank={a.bank_name ?? a.bank} size={12} />{meta.label}
        </div>
        <span className="chip">{isCredit ? 'Crédito' : 'Conta corrente'}</span>
      </div>
      <div style={{ marginTop: 22, position: 'relative' }}>
        <div className="faint" style={{ fontSize: 12 }}>Saldo disponível</div>
        <Money value={balance} style={{ fontSize: 24, fontWeight: 700 }} />
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
  const balance = Math.abs(a.balance ?? 0)
  const limit = a.limit ?? 0
  const today = new Date().toISOString().slice(0, 10)

  const myLabel = meta.label.toLowerCase()
  const cardBills = useMemo(() =>
    bills
      .filter((b) => {
        if (b.account_id && a.account_id && b.account_id === a.account_id) return true
        const billLabel = getBankMeta(b.bank ?? '').label.toLowerCase()
        if (billLabel === myLabel) return true
        const billBank = (b.bank ?? '').toLowerCase()
        const accBank  = (a.bank_name ?? a.bank ?? '').toLowerCase()
        return billBank && accBank && (billBank.includes(accBank) || accBank.includes(billBank))
      })
      .sort((x, y) => (x.due_date ?? '').localeCompare(y.due_date ?? '')),
    [bills, a.account_id, myLabel, a.bank_name, a.bank]
  )

  const currentBill = cardBills.find((b) => (b.due_date ?? '') >= today && b.status !== 'PAID' && b.status !== 'PAGA') ?? null
  const futureBills = currentBill
    ? cardBills.filter((b) => (b.due_date ?? '') > (currentBill.due_date ?? '') && (b.due_date ?? '') >= today && b.status !== 'PAID' && b.status !== 'PAGA')
    : []
  const futureTotal = futureBills.reduce((s, b) => s + (b.total ?? 0), 0)

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ position: 'absolute', width: 220, height: 220, borderRadius: '50%', filter: 'blur(70px)', opacity: 0.25, top: -90, right: -60, background: meta.color, pointerEvents: 'none' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontWeight: 600, fontSize: 15 }}>
          <BankDot bank={a.bank_name ?? a.bank} size={12} />{meta.label}
        </div>
        <span className="chip">Cartão de crédito</span>
      </div>

      <div className="g-2" style={{ marginTop: 24, position: 'relative' }}>
        <div>
          <div className="faint" style={{ fontSize: 12 }}>Fatura atual</div>
          <Money value={balance} style={{ fontSize: 26, fontWeight: 700 }} />
          <div className="ubar" style={{ marginTop: 12, height: 6 }}>
            <i style={{ width: Math.min(100, (balance / limit) * 100) + '%', background: meta.color }} />
          </div>
        </div>
        <div>
          <div className="faint" style={{ fontSize: 12 }}>Próximas faturas</div>
          <Money value={futureTotal} style={{ fontSize: 20, fontWeight: 700 }} />
          <div className="faint" style={{ fontSize: 11, marginTop: 4 }}>{futureBills.length} fatura{futureBills.length !== 1 ? 's' : ''} em aberto</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 28, marginTop: 24, borderTop: '1px solid var(--border)', paddingTop: 18 }}>
        <StatItem lbl="Limite total" val={limit} />
        <StatItem lbl="Disponível" val={limit - balance} color="var(--pos)" />
        {currentBill && <StatItem lbl="Vencimento" raw={currentBill.due_date?.split('-').reverse().slice(0, 2).join('/')} />}
      </div>
    </div>
  )
}

export default function Contas() {
  const { user } = useAuth()
  const uid = user?.uid
  const { accounts, loading: aLoading } = useAccounts(uid)
  const { bills, loading: bLoading } = useBills(uid)

  const checking = useMemo(() => accounts.filter((a) => a.account_type !== 'CREDIT'), [accounts])
  const cards = useMemo(() => accounts.filter((a) => a.account_type === 'CREDIT'), [accounts])

  const loading = aLoading || bLoading

  return (
    <div className="fade-in grid gap-[22px]">
      <SectionHead title="Contas e Cartões" sub={`${accounts.length} conexões ativas`} />

      <div style={{ display: 'grid', gap: 14 }}>
        <div className="eyebrow" style={{ marginLeft: 4 }}>Contas Correntes</div>
        <div className="g-2">
          {loading
            ? [1, 2].map((i) => <Skeleton key={i} className="h-[180px] w-full rounded-[14px]" />)
            : checking.length === 0
              ? <p className="faint" style={{ fontSize: 13 }}>Nenhuma conta corrente conectada.</p>
              : checking.map((a) => <ContaCard key={a.id} a={a} />)}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 14 }}>
        <div className="eyebrow" style={{ marginLeft: 4 }}>Cartões de Crédito</div>
        <div className="g-2">
          {loading
            ? [1, 2].map((i) => <Skeleton key={i} className="h-[220px] w-full rounded-[14px]" />)
            : cards.length === 0
              ? <p className="faint" style={{ fontSize: 13 }}>Nenhum cartão de crédito conectado.</p>
              : cards.map((a) => <CreditCard key={a.id} a={a} bills={bills} />)}
        </div>
      </div>
    </div>
  )
}
