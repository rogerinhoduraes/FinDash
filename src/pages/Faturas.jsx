import { useState, useMemo, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useBills } from '@/hooks/useBills'
import { useTransactions } from '@/hooks/useTransactions'
import { formatCurrency, formatDate, getBankMeta, translateCategory } from '@/lib/formatters'
import { differenceInDays, parseISO, format, subMonths, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { LineMultiChart } from '@/components/charts/LineMultiChart'
import useFinanceStore from '@/store/useFinanceStore'

function Sk({ w = '100%', h = 16, r = 8 }) {
  return <div className="sk" style={{ width: w, height: h, borderRadius: r }} />
}

function statusInfo(status) {
  if (status === 'PAID' || status === 'PAGA') return ['paid', 'Paga']
  if (status === 'DIVERGENCE' || status === 'DIVERGÊNCIA') return ['div', 'Divergência']
  return ['open', 'Aberta']
}

const INSTALLMENT_RE = /\b\d+\s*\/\s*\d+\b|PARC\b|PARCELA\b/i

function BillModal({ bill, uid, onClose }) {
  const { privacyMode } = useFinanceStore()
  const meta = getBankMeta(bill.bank ?? '')

  const today = new Date().toISOString().slice(0, 10)
  const isFuture = (bill.close_date || bill.due_date || '') > today

  // For past bills: search the 35-day window before close/due date
  // For future bills: search the past 6 months to find installments still active
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
    // Match by account_id first
    let matched = transactions.filter((t) => t.account_id === bill.account_id)
    if (!matched.length) {
      // Fallback: same bank, debit (expense) transactions
      matched = transactions.filter((t) =>
        (t.bank ?? '').toLowerCase().includes((bill.bank ?? '').toLowerCase()) && (t.amount ?? 0) < 0
      )
    }
    // For future bills keep only installments; for past bills keep all
    if (isFuture) matched = matched.filter((t) => INSTALLMENT_RE.test(t.description ?? ''))
    return matched.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
  }, [transactions, bill.account_id, bill.bank, isFuture])

  const regular      = billTxs.filter((t) => !INSTALLMENT_RE.test(t.description ?? ''))
  const installments = billTxs.filter((t) =>  INSTALLMENT_RE.test(t.description ?? ''))

  const txTotal = billTxs.reduce((s, t) => s + Math.abs(t.amount ?? 0), 0)

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: '22px 24px', borderBottom: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', width: 160, height: 160, borderRadius: '50%', filter: 'blur(50px)', opacity: 0.35, top: -70, right: -30, background: meta.color }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="bank-dot" style={{ background: meta.color, width: 11, height: 11 }} />
                <span style={{ fontWeight: 600 }}>{meta.label}</span>
                <span className={'badge-st ' + statusInfo(bill.status)[0]}>{statusInfo(bill.status)[1]}</span>
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 800, marginTop: 8 }}>
                <span className={'money ' + (privacyMode ? 'blurred' : '')}>{formatCurrency(bill.total ?? 0)}</span>
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                {bill.close_date && <span className="faint" style={{ fontSize: 12 }}>Fechamento {formatDate(bill.close_date, 'dd/MM/yyyy')}</span>}
                <span className="faint" style={{ fontSize: 12 }}>Vencimento {bill.due_date ? formatDate(bill.due_date, 'dd/MM/yyyy') : '—'}</span>
                {bill.minimum && <span className="faint" style={{ fontSize: 12 }}>Mínimo <span className={'money ' + (privacyMode ? 'blurred' : '')}>{formatCurrency(bill.minimum)}</span></span>}
              </div>
            </div>
            <button className="icon-btn" onClick={onClose}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 19, height: 19 }}><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 0 8px' }}>
          {txLoading ? (
            <div style={{ padding: 16, display: 'grid', gap: 8 }}>
              {[1,2,3,4].map((i) => <Sk key={i} h={40} r={8} />)}
            </div>
          ) : billTxs.length === 0 ? (
            <div style={{ padding: '28px 24px', textAlign: 'center' }}>
              <p className="faint" style={{ fontSize: 13 }}>
                {isFuture
                  ? 'Nenhum parcelamento ativo encontrado nos últimos 6 meses para este cartão.'
                  : 'Nenhuma transação encontrada para o período desta fatura.'}
              </p>
              <p className="faint" style={{ fontSize: 11.5, marginTop: 6 }}>{startDate} → {endDate}</p>
            </div>
          ) : (
            <>
              {isFuture && (
                <div style={{ padding: '12px 24px 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="badge-st open" style={{ fontSize: 11 }}>Fatura futura</span>
                  <span className="faint" style={{ fontSize: 12 }}>Parcelamentos ativos que provavelmente compõem esta fatura</span>
                </div>
              )}
              {regular.length > 0 && (
                <>
                  <div className="eyebrow" style={{ padding: '14px 24px 8px' }}>Compras · {regular.length}</div>
                  <table className="tbl">
                    <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th className="num">Valor</th></tr></thead>
                    <tbody>
                      {regular.map((t) => (
                        <tr key={t.id}>
                          <td className="mono faint" style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{t.date ? formatDate(t.date, 'dd/MM') : '—'}</td>
                          <td style={{ fontWeight: 500, fontSize: 13 }}>{t.description}</td>
                          <td><span className="cat" style={{ fontSize: 11 }}>{translateCategory(t.category)}</span></td>
                          <td className="num"><span className={'money ' + (privacyMode ? 'blurred' : '')} style={{ fontWeight: 600 }}>{formatCurrency(Math.abs(t.amount ?? 0))}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
              {installments.length > 0 && (
                <>
                  <div className="eyebrow" style={{ padding: '14px 24px 8px' }}>Parcelamentos · {installments.length}</div>
                  <table className="tbl">
                    <thead><tr><th>Data</th><th>Descrição</th><th className="num">Valor</th></tr></thead>
                    <tbody>
                      {installments.map((t) => (
                        <tr key={t.id}>
                          <td className="mono faint" style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{t.date ? formatDate(t.date, 'dd/MM') : '—'}</td>
                          <td style={{ fontWeight: 500, fontSize: 13 }}>{t.description}</td>
                          <td className="num"><span className={'money ' + (privacyMode ? 'blurred' : '')} style={{ fontWeight: 600 }}>{formatCurrency(Math.abs(t.amount ?? 0))}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
              <div style={{ padding: '12px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="faint" style={{ fontSize: 12 }}>{billTxs.length} lançamentos encontrados</span>
                <span style={{ fontWeight: 700, fontSize: 14 }}>
                  Total: <span className={'money ' + (privacyMode ? 'blurred' : '')}>{formatCurrency(txTotal)}</span>
                </span>
              </div>
            </>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '14px 24px', borderTop: '1px solid var(--border)' }}>
          <button className="btn" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  )
}

export default function Faturas() {
  const { user } = useAuth()
  const { bills, loading } = useBills(user?.uid)
  const [open, setOpen] = useState(null)
  const [sortDir, setSortDir] = useState('desc')
  const { privacyMode } = useFinanceStore()

  const sorted = useMemo(() =>
    [...bills].sort((a, b) => {
      const cmp = (a.due_date ?? '').localeCompare(b.due_date ?? '')
      return sortDir === 'asc' ? cmp : -cmp
    }),
    [bills, sortDir]
  )

  const billSeries = useMemo(() => {
    const bankNames = ['Nubank', 'Santander', 'Inter']
    const now = new Date()
    const months = Array.from({ length: 12 }, (_, i) => subMonths(now, 11 - i))
    return bankNames.map((name) => {
      const meta = getBankMeta(name)
      const data = months.map((d) => {
        const m = format(d, 'yyyy-MM')
        const bill = bills.find((b) => b.bank?.toLowerCase().includes(name.toLowerCase()) && (b.due_date ?? '').startsWith(m))
        return bill ? Math.abs(bill.total ?? 0) : 0
      })
      return { label: name, color: meta.color, data }
    })
  }, [bills])

  const monthLabels = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => format(subMonths(new Date(), 11 - i), 'MMM', { locale: ptBR })),
    [])

  if (loading) {
    return (
      <div style={{ display: 'grid', gap: 18 }}>
        <div className="card"><Sk w="100%" h={240} /></div>
        {[1,2,3].map((i) => <Sk key={i} w="100%" h={70} r={16} />)}
      </div>
    )
  }

  return (
    <div className="stagger" style={{ display: 'grid', gap: 18 }}>
      <div className="card">
        <div className="section-head">
          <span className="section-title">Histórico de faturas</span>
          <span className="section-sub">12 meses por banco</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 14 }}>
            {billSeries.map((s) => (
              <span key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <span className="bank-dot" style={{ background: s.color, borderRadius: 99 }} />{s.label}
              </span>
            ))}
          </div>
        </div>
        <LineMultiChart series={billSeries} months={monthLabels} height={240} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="eyebrow">Lista de faturas · {bills.length}</span>
        <button
          className="btn"
          onClick={() => setSortDir((d) => d === 'asc' ? 'desc' : 'asc')}
          style={{ gap: 6 }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
            {sortDir === 'asc'
              ? <><path d="M3 8h13M3 12h9M3 16h5"/><path d="m17 8 4 4-4 4"/></>
              : <><path d="M3 8h13M3 12h9M3 16h5"/><path d="m21 12-4-4-4 4"/></>
            }
          </svg>
          {sortDir === 'asc' ? 'Mais antigas' : 'Mais recentes'}
        </button>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {sorted.map((b) => {
          const meta = getBankMeta(b.bank ?? '')
          const dueDate = b.due_date ? parseISO(b.due_date) : null
          const days = dueDate ? differenceInDays(dueDate, new Date()) : 0
          const urgent = (b.status !== 'PAID' && b.status !== 'PAGA') && days >= 0 && days <= 5
          const [cls, lbl] = statusInfo(b.status)
          return (
            <div key={b.id} className="card row between" style={{ padding: '18px 22px', cursor: 'pointer', borderColor: urgent ? 'var(--warn)' : 'var(--border)', flexWrap: 'wrap', gap: 14 }} onClick={() => setOpen(b)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
                <div style={{ width: 46, height: 46, borderRadius: 13, background: meta.color, display: 'grid', placeItems: 'center', color: 'white', flexShrink: 0 }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22 }}><path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-2 2V3z"/><path d="M9 8h6M9 12h6"/></svg>
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 15 }}>{meta.label}</span>
                    <span className={'badge-st ' + cls}>{lbl}</span>
                    {urgent && <span className="badge-st urgent">urgente</span>}
                  </div>
                  <div className="faint" style={{ fontSize: 12.5, marginTop: 4 }}>
                    Vencimento {b.due_date ? formatDate(b.due_date) : '—'} · {(b.items ?? []).length} lançamentos
                  </div>
                </div>
              </div>
              <div className="bill-row-right" style={{ display: 'flex', alignItems: 'center', gap: 22, flexShrink: 0 }}>
                <span className={'money ' + (privacyMode ? 'blurred' : '')} style={{ fontSize: 19, fontWeight: 700 }}>{formatCurrency(b.total ?? 0)}</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="faint" style={{ width: 18, height: 18 }}><path d="m9 18 6-6-6-6"/></svg>
              </div>
            </div>
          )
        })}
      </div>

      {open && <BillModal bill={open} uid={user?.uid} onClose={() => setOpen(null)} />}
    </div>
  )
}
