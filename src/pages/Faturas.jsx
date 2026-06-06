import { useState, useMemo, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useBills } from '@/hooks/useBills'
import { useTransactions } from '@/hooks/useTransactions'
import { formatDate, getBankMeta, translateCategory } from '@/lib/formatters'
import { isInstallment } from '@/lib/categories'
import { differenceInDays, parseISO, format, subMonths, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { LineMultiChart } from '@/components/charts/LineMultiChart'
import { Money } from '@/components/ui/Money'
import { BankDot } from '@/components/ui/BankDot'
import { SectionHead } from '@/components/ui/SectionHead'
import { Skeleton } from '@/components/ui/skeleton'

function statusInfo(status) {
  if (status === 'PAID' || status === 'PAGA') return ['paid', 'Paga']
  if (status === 'DIVERGENCE' || status === 'DIVERGÊNCIA') return ['div', 'Divergência']
  return ['open', 'Aberta']
}

function BillModal({ bill, uid, onClose }) {
  const meta = getBankMeta(bill.bank ?? '')
  const today = new Date().toISOString().slice(0, 10)
  const isFuture = (bill.close_date || bill.due_date || '') > today

  const endDate   = isFuture ? today : (bill.close_date || bill.due_date || '')
  const startDate = useMemo(() => {
    if (!endDate) return ''
    return subDays(parseISO(endDate), isFuture ? 180 : 35).toISOString().slice(0, 10)
  }, [endDate, isFuture])

  const { transactions, loading: txLoading } = useTransactions(uid, {
    maxDocs: 1000,
    startDate,
    endDate,
  })

  const billTxs = useMemo(() => {
    if (!transactions.length) return []
    // Prefer the precise link the ETL already captured (creditCardMetadata.billId),
    // then the account, and only fall back to the bank+sign heuristic — which
    // otherwise lumps every card of the same bank into one bill.
    let matched = transactions.filter((t) => t.bill_id && (t.bill_id === bill.bill_id || t.bill_id === bill.id))
    if (!matched.length) {
      matched = transactions.filter((t) => t.account_id === bill.account_id)
    }
    if (!matched.length) {
      matched = transactions.filter((t) =>
        (t.bank ?? '').toLowerCase().includes((bill.bank ?? '').toLowerCase()) && (t.amount ?? 0) < 0
      )
    }
    if (isFuture) matched = matched.filter(isInstallment)
    return matched.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
  }, [transactions, bill.bill_id, bill.id, bill.account_id, bill.bank, isFuture])

  const regular      = billTxs.filter((t) => !isInstallment(t))
  const installments = billTxs.filter(isInstallment)

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: '22px 24px', borderBottom: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', width: 160, height: 160, borderRadius: '50%', filter: 'blur(50px)', opacity: 0.35, top: -70, right: -30, background: meta.color }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <BankDot bank={bill.bank} size={11} />
                <span style={{ fontWeight: 600 }}>{meta.label}</span>
                <span className={'badge-st ' + statusInfo(bill.status)[0]}>{statusInfo(bill.status)[1]}</span>
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 800, marginTop: 8 }}>
                <Money value={bill.total ?? 0} />
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                {bill.close_date && <span className="faint" style={{ fontSize: 12 }}>Fechamento {formatDate(bill.close_date, 'dd/MM/yyyy')}</span>}
                <span className="faint" style={{ fontSize: 12 }}>Vencimento {bill.due_date ? formatDate(bill.due_date, 'dd/MM/yyyy') : '—'}</span>
                {bill.minimum && <span className="faint" style={{ fontSize: 12 }}>Mínimo <Money value={bill.minimum} /></span>}
              </div>
            </div>
            <button className="icon-btn" onClick={onClose}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 19, height: 19 }}><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 0 8px' }}>
          {txLoading ? (
            <div style={{ padding: 16, display: 'grid', gap: 8 }}>
              {[1,2,3,4].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : billTxs.length === 0 ? (
            <div style={{ padding: '28px 24px', textAlign: 'center' }}>
              <p className="faint" style={{ fontSize: 13 }}>Nenhuma transação detalhada encontrada para este período.</p>
            </div>
          ) : (
            <div style={{ display: 'grid' }}>
              {regular.length > 0 && (
                <div style={{ padding: '16px 24px 8px' }} className="eyebrow">Transações do mês</div>
              )}
              {regular.map(t => (
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 24px', borderBottom: '1px solid var(--border)', fontSize: 13.5 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 500, truncate: true }}>
                      {t.description}
                      {t.installment_number && t.installment_total && (
                        <span className="ml-2 text-[10px] text-muted-foreground font-mono bg-[var(--surface-3)] px-1 rounded">
                          {t.installment_number}/{t.installment_total}
                        </span>
                      )}
                    </div>
                    <div className="faint" style={{ fontSize: 11.5, marginTop: 2 }}>{formatDate(t.date, 'dd MMM')} · {translateCategory(t.category)}</div>
                  </div>
                  <Money value={Math.abs(t.amount)} style={{ fontWeight: 700 }} />
                </div>
              ))}
              {installments.length > 0 && (
                <div style={{ padding: '24px 24px 8px' }} className="eyebrow">Parcelamentos ativos</div>
              )}
              {installments.map(t => (
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 24px', borderBottom: '1px solid var(--border)', fontSize: 13.5 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 500 }}>{t.description}</div>
                    <div className="faint" style={{ fontSize: 11.5, marginTop: 2 }}>{translateCategory(t.category)}</div>
                  </div>
                  <Money value={Math.abs(t.amount)} style={{ fontWeight: 700 }} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Faturas() {
  const { user } = useAuth()
  const uid = user?.uid
  const { bills, loading } = useBills(uid)
  const [selectedBill, setSelectedBill] = useState(null)
  const [tab, setTab] = useState('upcoming')

  const upcoming = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return bills.filter(b => (b.due_date ?? '') >= today).sort((a,b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))
  }, [bills])

  const history = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return bills.filter(b => (b.due_date ?? '') < today).sort((a,b) => (b.due_date ?? '').localeCompare(a.due_date ?? ''))
  }, [bills])

  const chartData = useMemo(() => {
    const now = new Date()
    const months = Array.from({ length: 12 }, (_, i) => format(subMonths(now, 11 - i), 'yyyy-MM'))
    const banks = ['Nubank', 'Inter', 'Santander']
    return banks.map(name => {
      const meta = getBankMeta(name)
      const data = months.map(m => {
        const b = bills.find(x => x.bank?.toLowerCase().includes(name.toLowerCase()) && (x.due_date ?? '').startsWith(m))
        return b ? Math.abs(b.total ?? 0) : 0
      })
      return { label: name, color: meta.color, data }
    })
  }, [bills])

  const monthLabels = useMemo(() => 
    Array.from({ length: 12 }, (_, i) => format(subMonths(new Date(), 11 - i), 'MMM', { locale: ptBR })), 
  [])

  if (loading) return (
    <div style={{ display: 'grid', gap: 20 }}>
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-48 w-full" />
      <div className="grid grid-cols-2 gap-6"><Skeleton className="h-96" /><Skeleton className="h-96" /></div>
    </div>
  )

  return (
    <div className="fade-in grid gap-[22px]">
      <SectionHead 
        title="Faturas" 
        sub="Controle de gastos no cartão"
        right={
          <div className="tabs-mini">
            <button className={tab === 'upcoming' ? 'active' : ''} onClick={() => setTab('upcoming')}>Próximas</button>
            <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>Histórico</button>
          </div>
        }
      />

      <div className="card">
        <SectionHead title="Evolução das Faturas" sub="Últimos 12 meses" />
        <div style={{ height: 220, marginTop: 10 }}>
          <LineMultiChart series={chartData} months={monthLabels} />
        </div>
      </div>

      <div className="grid gap-4">
        {(tab === 'upcoming' ? upcoming : history).map(b => {
          const meta = getBankMeta(b.bank ?? '')
          const [stCls, stLbl] = statusInfo(b.status)
          const days = b.due_date ? differenceInDays(parseISO(b.due_date), new Date()) : 0
          const urgent = tab === 'upcoming' && days >= 0 && days <= 5

          return (
            <div key={b.id} className="card p-0 overflow-hidden hover:scale-[1.005] transition-transform cursor-pointer" onClick={() => setSelectedBill(b)}>
              <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center border border-[var(--border)] bg-[var(--surface-2)]">
                    <BankDot bank={b.bank} size={11} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{meta.label}</div>
                    <div className="faint" style={{ fontSize: 11.5, marginTop: 2 }}>
                      Vencimento {b.due_date ? formatDate(b.due_date, 'dd/MM') : '—'}
                      {urgent && <span style={{ color: 'var(--neg)', fontWeight: 800, marginLeft: 8 }}>VENCE EM {days} DIAS</span>}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <Money value={b.total ?? 0} style={{ fontSize: 18, fontWeight: 800 }} />
                  <div style={{ marginTop: 4 }}><span className={'badge-st ' + stCls}>{stLbl}</span></div>
                </div>
              </div>
              {b.limit && b.total > 0 && (
                <div className="ubar" style={{ height: 3 }}>
                  <i style={{ width: Math.min(100, (Math.abs(b.total) / b.limit) * 100) + '%', background: meta.color }} />
                </div>
              )}
            </div>
          )
        })}
        {(tab === 'upcoming' ? upcoming : history).length === 0 && (
          <div className="py-20 text-center text-muted-foreground opacity-50">Nenhuma fatura encontrada nesta seção.</div>
        )}
      </div>

      {selectedBill && <BillModal bill={selectedBill} uid={uid} onClose={() => setSelectedBill(null)} />}
    </div>
  )
}
