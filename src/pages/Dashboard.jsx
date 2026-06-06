import { useMemo, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useAccounts } from '@/hooks/useAccounts'
import { useTransactions } from '@/hooks/useTransactions'
import { useBills } from '@/hooks/useBills'
import { useInvestments } from '@/hooks/useInvestments'
import { formatDate, getBankMeta } from '@/lib/formatters'
import { differenceInDays, parseISO, format, subMonths, addMonths, startOfMonth, endOfMonth, isWithinInterval, isSameMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import useFinanceStore from '@/store/useFinanceStore'
import { RadialScore } from '@/components/charts/RadialScoreChart'
import { CompositionBar } from '@/components/charts/CompositionBar'
import { CashflowTideChart } from '@/components/charts/CashflowTideChart'
import { LineMultiChart } from '@/components/charts/LineMultiChart'
import { Sparkline } from '@/components/charts/SparklineChart'
import { Money } from '@/components/ui/Money'
import { BankDot } from '@/components/ui/BankDot'
import { SectionHead } from '@/components/ui/SectionHead'
import { Skeleton } from '@/components/ui/skeleton'
import { calculateKpis, calculateHealthScore } from '@/lib/finance'

function Factor({ label, pct, val, invert }) {
  const color = invert
    ? (val > 70 ? 'var(--pos)' : val > 40 ? 'var(--warn)' : 'var(--neg)')
    : (val > 70 ? 'var(--pos)' : val > 40 ? 'var(--accent)' : 'var(--neg)')
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5, whiteSpace: 'nowrap' }}>
        <span className="muted">{label}</span>
        <span className="mono faint">{pct}</span>
      </div>
      <div className="ubar"><i style={{ width: val + '%', background: color }} /></div>
    </div>
  )
}

function Legend({ color, label }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
      <span className="bank-dot" style={{ background: color, borderRadius: 99 }} />{label}
    </span>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const uid = user?.uid
  const navigate = useNavigate()
  const { privacyMode } = useFinanceStore()
  const { accounts, loading: aLoading } = useAccounts(uid)
  const { transactions, loading: tLoading } = useTransactions(uid, { maxDocs: 5000 })
  const { bills, loading: bLoading } = useBills(uid)
  const { investments, loading: iLoading } = useInvestments(uid)
  const scrollRef = useRef(null)

  const loading = aLoading || iLoading

  // Dashboard is scoped to a selected month, defaulting to the current month.
  const [selectedMonth, setSelectedMonth] = useState(() => startOfMonth(new Date()))
  const isCurrentMonth = isSameMonth(selectedMonth, new Date())
  const monthLabel = (() => {
    const l = format(selectedMonth, "MMMM 'de' yyyy", { locale: ptBR })
    return l.charAt(0).toUpperCase() + l.slice(1)
  })()
  const goPrevMonth = () => setSelectedMonth((m) => startOfMonth(subMonths(m, 1)))
  const goNextMonth = () => setSelectedMonth((m) => (isSameMonth(m, new Date()) ? m : startOfMonth(addMonths(m, 1))))

  const monthTxAll = useMemo(() => {
    const s = startOfMonth(selectedMonth), e = endOfMonth(selectedMonth)
    return transactions.filter((t) => {
      const d = t.date ? parseISO(t.date) : null
      return d && isWithinInterval(d, { start: s, end: e })
    })
  }, [transactions, selectedMonth])

  const monthIncome  = useMemo(() => monthTxAll.filter((t) => (t.amount ?? 0) > 0).reduce((s, t) => s + Math.abs(t.amount), 0), [monthTxAll])
  const monthExpense = useMemo(() => monthTxAll.filter((t) => (t.amount ?? 0) < 0).reduce((s, t) => s + Math.abs(t.amount), 0), [monthTxAll])

  const kpis = useMemo(() => calculateKpis(accounts, investments), [accounts, investments])
  const health = useMemo(() => calculateHealthScore(kpis, monthIncome, monthExpense), [kpis, monthIncome, monthExpense])

  const monthNet = monthIncome - monthExpense

  // Split accounts into checking vs credit cards, hiding zero-value entries.
  const checkingAccounts = useMemo(
    () => accounts.filter((a) => a.account_type !== 'CREDIT' && Math.abs(a.balance ?? 0) >= 0.005),
    [accounts]
  )
  const creditCards = useMemo(
    () => accounts.filter((a) => a.account_type === 'CREDIT' && Math.abs(a.balance ?? 0) >= 0.005),
    [accounts]
  )

  const recentTx = useMemo(() =>
    monthTxAll.filter((t) => Math.abs(Number(t.amount ?? 0)) >= 0.005).slice(0, 5),
    [monthTxAll]
  )
  const upcomingBills = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const byBank = {}
    for (const b of bills) {
      if ((b.due_date ?? '') < today) continue
      if (Math.abs(b.total ?? 0) < 0.005) continue
      const key = (b.bank ?? 'unknown').toLowerCase()
      if (!byBank[key] || (b.due_date ?? '') < (byBank[key].due_date ?? '')) {
        byBank[key] = b
      }
    }
    return Object.values(byBank).sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))
  }, [bills])

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

  const incomeSparkData = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(selectedMonth, 5 - i)
      const s = startOfMonth(d), e = endOfMonth(d)
      return transactions.filter((t) => {
        const dt = t.date ? parseISO(t.date) : null
        return dt && isWithinInterval(dt, { start: s, end: e }) && (t.amount ?? 0) > 0
      }).reduce((sum, t) => sum + Math.abs(t.amount), 0)
    })
  }, [transactions, selectedMonth])

  const expenseSparkData = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(selectedMonth, 5 - i)
      const s = startOfMonth(d), e = endOfMonth(d)
      return transactions.filter((t) => {
        const dt = t.date ? parseISO(t.date) : null
        return dt && isWithinInterval(dt, { start: s, end: e }) && (t.amount ?? 0) < 0
      }).reduce((sum, t) => sum + Math.abs(t.amount), 0)
    })
  }, [transactions, selectedMonth])

  useEffect(() => {
    if (loading) return
    const el = scrollRef.current
    if (!el) return
    const id = setTimeout(() => {
      const stag = el.querySelector('.stagger')
      if (stag) { [...stag.children].forEach((ch, i) => { ch.style.animationDelay = (i * 0.05) + 's' }); stag.classList.add('anim-in') }
      el.querySelectorAll('.fade-up').forEach((e) => e.classList.add('anim-in'))
    }, 30)
    return () => clearTimeout(id)
  }, [loading])

  return (
    <div className="stagger" ref={scrollRef} style={{ display: 'grid', gap: 18, minWidth: 0 }}>

      {/* MONTH SELECTOR */}
      <SectionHead
        title="Resumo do mês"
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {!isCurrentMonth && (
              <button className="btn" style={{ fontSize: 12, padding: '3px 10px' }} onClick={() => setSelectedMonth(startOfMonth(new Date()))}>Voltar ao mês atual</button>
            )}
            <button className="btn" aria-label="Mês anterior" onClick={goPrevMonth} style={{ padding: '6px 10px' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <span style={{ minWidth: 150, textAlign: 'center', fontWeight: 600, fontSize: 14, textTransform: 'capitalize' }}>{monthLabel}</span>
            <button className="btn" aria-label="Próximo mês" onClick={goNextMonth} disabled={isCurrentMonth} style={{ padding: '6px 10px', opacity: isCurrentMonth ? 0.4 : 1, cursor: isCurrentMonth ? 'not-allowed' : 'pointer' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}><path d="m9 18 6-6-6-6"/></svg>
            </button>
          </div>
        }
      />

      {/* HERO ROW */}
      <div className="g-hero">
        {/* Net worth */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 100% at 100% 0%, var(--accent-dim), transparent 55%)', pointerEvents: 'none' }} />
          {loading ? (
            <div style={{ position: 'relative' }}>
              <Skeleton className="h-[13px] w-[30%]" /><Skeleton className="mt-4 h-[52px] w-[55%]" /><Skeleton className="mt-7 h-[14px] w-full rounded-full" /><Skeleton className="mt-4 h-[40px] w-[80%]" />
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <span className="eyebrow">Patrimônio líquido</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, flexShrink: 0 }}>
                  <span className={'delta ' + (monthNet >= 0 ? 'up' : 'down')} style={{ fontSize: 12.5 }}>
                    {monthNet >= 0 ? '▲' : '▼'} {monthNet >= 0 ? '+' : '−'}<Money value={Math.abs(monthNet)} />
                  </span>
                  <span className="faint">no mês</span>
                </span>
              </div>
              <div style={{ marginTop: 10 }}>
                <Money value={kpis.net} style={{ fontSize: 'clamp(28px, 3.7vw, 48px)', fontWeight: 800, letterSpacing: '-.03em', fontFamily: 'var(--font-display)', display: 'block', lineHeight: 1.04 }} />
                <div className="faint" style={{ fontSize: 12, marginTop: 7 }}>conta corrente + investimentos − dívida de cartão</div>
              </div>
              <div style={{ marginTop: 22 }}>
                <CompositionBar segments={[
                  { label: 'Conta corrente', value: kpis.checking, color: 'var(--accent)' },
                  { label: 'Investimentos', value: kpis.invested, color: 'var(--nubank)' },
                  { label: 'Dívida de cartão', value: kpis.cardDebt, color: 'var(--neg)' },
                ]} />
              </div>
            </div>
          )}
        </div>

        {/* Health score */}
        <div className="card" style={{ display: 'grid', placeItems: 'center', alignContent: 'center' }}>
          {loading ? <Skeleton className="h-[150px] w-[150px] rounded-full" /> : (
            <div style={{ textAlign: 'center', width: '100%' }}>
              <div className="eyebrow" style={{ marginBottom: 6 }}>Saúde financeira</div>
              <div style={{ display: 'grid', placeItems: 'center' }}>
                <RadialScore score={health.score} />
              </div>
              <div style={{ display: 'grid', gap: 9, marginTop: 14, textAlign: 'left' }}>
                <Factor {...health.factors.savings} />
                <Factor {...health.factors.util} />
                <Factor {...health.factors.fund} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* KPI STATS */}
      <div className="g-3">
        {/* Income */}
        <div className="card">
          {tLoading ? (<><Skeleton className="h-[12px] w-[40%]" /><Skeleton className="mt-3.5 h-[30px] w-[70%]" /><Skeleton className="mt-[18px] h-[30px] w-full" /></>) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="eyebrow">Receitas do mês</span>
              </div>
              <div style={{ marginTop: 12 }}>
                <Money value={monthIncome} style={{ fontSize: 'clamp(18px, 2vw, 27px)', fontWeight: 700, letterSpacing: '-.02em' }} />
              </div>
              <div style={{ marginTop: 16 }}><Sparkline data={incomeSparkData} color="var(--pos)" /></div>
            </>
          )}
        </div>

        {/* Expenses */}
        <div className="card">
          {tLoading ? (<><Skeleton className="h-[12px] w-[40%]" /><Skeleton className="mt-3.5 h-[30px] w-[70%]" /><Skeleton className="mt-[18px] h-[30px] w-full" /></>) : (
            <>
              <div className="eyebrow">Despesas do mês</div>
              <div style={{ marginTop: 12 }}>
                <Money value={monthExpense} style={{ fontSize: 'clamp(18px, 2vw, 27px)', fontWeight: 700, letterSpacing: '-.02em' }} />
              </div>
              <div style={{ marginTop: 16 }}><Sparkline data={expenseSparkData} color="var(--neg)" /></div>
            </>
          )}
        </div>

        {/* Credit util */}
        {loading ? <div className="card"><Skeleton className="h-[12px] w-[40%]" /><Skeleton className="mt-3.5 h-[30px] w-[60%]" /><Skeleton className="mt-5 h-[10px] w-full rounded-full" /></div> : (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="eyebrow">Utilização de crédito</span>
              <span className="delta" style={{ color: kpis.util > 70 ? 'var(--neg)' : kpis.util > 40 ? 'var(--warn)' : 'var(--pos)' }}>{kpis.util.toFixed(0)}%</span>
            </div>
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <Money value={kpis.totalLimit - kpis.cardDebt} style={{ fontSize: 'clamp(18px, 2vw, 27px)', fontWeight: 700 }} />
              <span className="faint" style={{ fontSize: 13 }}>disponível</span>
            </div>
            <div className="ubar" style={{ marginTop: 18, height: 9 }}>
              <i style={{ width: kpis.util + '%', background: kpis.util > 70 ? 'var(--neg)' : 'linear-gradient(90deg, var(--accent), var(--warn))' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }} className="faint">
              <span style={{ fontSize: 11.5 }}>Usado <Money value={kpis.cardDebt} className="mono" /></span>
              <span style={{ fontSize: 11.5 }}>Limite <Money value={kpis.totalLimit} className="mono" /></span>
            </div>
          </div>
        )}
      </div>

      {/* ACCOUNTS */}
      <div className="card">
        <SectionHead title="Suas contas" sub={checkingAccounts.length + (checkingAccounts.length !== 1 ? ' contas' : ' conta')} right={<button className="btn" onClick={() => navigate('/contas')}>Ver todas <ChevR /></button>} />
        {loading ? (
          <div className="acct-rail">{[1,2,3,4].map((i) => <div key={i} className="acct-card"><Skeleton className="h-[14px] w-[60%]" /><Skeleton className="mt-6 h-[26px] w-[80%]" /></div>)}</div>
        ) : checkingAccounts.length === 0 ? (
          <p className="faint" style={{ fontSize: 13 }}>Nenhuma conta com saldo.</p>
        ) : (
          <div style={{ position: 'relative' }}>
            <div className="acct-rail">
              {checkingAccounts.map((a) => <AccountMiniCard key={a.id} a={a} privacyMode={privacyMode} />)}
            </div>
            {checkingAccounts.length > 3 && (
              <div style={{ position: 'absolute', right: 0, top: 0, bottom: 14, width: 60, background: 'linear-gradient(to right, transparent, var(--surface))', pointerEvents: 'none', borderRadius: '0 var(--r-lg) var(--r-lg) 0' }} />
            )}
          </div>
        )}
      </div>

      {/* CREDIT CARDS */}
      {!loading && creditCards.length > 0 && (
        <div className="card">
          <SectionHead title="Cartões de crédito" sub={creditCards.length + (creditCards.length !== 1 ? ' cartões' : ' cartão')} right={<button className="btn" onClick={() => navigate('/cartao-credito')}>Ver todos <ChevR /></button>} />
          <div style={{ position: 'relative' }}>
            <div className="acct-rail">
              {creditCards.map((a) => <AccountMiniCard key={a.id} a={a} privacyMode={privacyMode} />)}
            </div>
            {creditCards.length > 3 && (
              <div style={{ position: 'absolute', right: 0, top: 0, bottom: 14, width: 60, background: 'linear-gradient(to right, transparent, var(--surface))', pointerEvents: 'none', borderRadius: '0 var(--r-lg) var(--r-lg) 0' }} />
            )}
          </div>
        </div>
      )}

      {/* CASHFLOW + UPCOMING */}
      <div className="g-wide-l">
        <div className="card">
          <SectionHead title="Fluxo de caixa" sub="6 meses" right={<div style={{ display: 'flex', gap: 14 }}><Legend color="var(--pos)" label="Entradas" /><Legend color="var(--neg)" label="Saídas" /></div>} />
          {tLoading ? <Skeleton className="h-[220px] w-full" /> : <CashflowTideChart transactions={transactions} endMonth={selectedMonth} />}
        </div>
        <div className="card">
          <SectionHead title="Próximas faturas" right={<button className="btn" onClick={() => navigate('/faturas')}>Faturas <ChevR /></button>} />
          <div style={{ display: 'grid', gap: 10 }}>
            {bLoading ? [1,2,3].map((i) => <Skeleton key={i} className="h-[62px] w-full rounded-[14px]" />) : upcomingBills.length === 0 ? (
              <p className="faint" style={{ fontSize: 13 }}>Nenhuma fatura próxima</p>
            ) : upcomingBills.map((b) => {
              const days = b.due_date ? differenceInDays(parseISO(b.due_date), new Date()) : 0
              const urgent = days >= 0 && days <= 5
              const meta = getBankMeta(b.bank)
              const dueLabel = days === 0 ? 'vence hoje' : days === 1 ? 'vence amanhã' : `vence em ${days} dias`
              return (
                <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderRadius: 14, background: urgent ? 'var(--neg-dim)' : 'var(--surface-2)', border: '1px solid ' + (urgent ? 'var(--neg)' : 'var(--border)') }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500 }}>
                      <BankDot bank={b.bank} />{meta.label}
                    </div>
                    <div className="faint" style={{ fontSize: 12, marginTop: 3 }}>
                      {dueLabel} · {b.due_date ? formatDate(b.due_date, 'dd/MM') : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <Money value={b.total ?? 0} style={{ fontSize: 16, fontWeight: 700 }} />
                    {urgent && <div className="delta down" style={{ fontSize: 11, justifyContent: 'flex-end', display: 'flex' }}>urgente</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* RECENT TX + BILL EVOLUTION */}
      <div className="g-wide-r">
        <div className="card">
          <SectionHead title="Transações do mês" sub={monthLabel} right={<button className="btn" onClick={() => navigate('/transacoes')}>Ver tudo <ChevR /></button>} />
          <div style={{ display: 'grid', gap: 2 }}>
            {tLoading
              ? [1,2,3,4,5].map((i) => <Skeleton key={i} className="h-[44px] w-full rounded-[10px]" />)
              : recentTx.length === 0
                ? <p className="faint" style={{ fontSize: 13, padding: '8px 8px' }}>Nenhuma transação neste mês</p>
                : recentTx.map((t) => <TxRow key={t.id} t={t} privacyMode={privacyMode} />)}
          </div>
        </div>
        <div className="card">
          <SectionHead title="Evolução das faturas" sub="12 meses" right={<div style={{ display: 'flex', gap: 14 }}>{billSeries.map((s) => <Legend key={s.label} color={s.color} label={s.label} />)}</div>} />
          {bLoading ? <Skeleton className="h-[230px] w-full" /> : <LineMultiChart series={billSeries} months={monthLabels} />}
        </div>
      </div>
    </div>
  )
}

function AccountMiniCard({ a, privacyMode }) {
  const meta = getBankMeta(a.bank_name ?? a.bank ?? '')
  const isCredit = a.account_type === 'CREDIT'
  const balance = isCredit ? Math.abs(a.balance ?? 0) : (a.balance ?? 0)
  const util = isCredit && a.limit ? (balance / a.limit) * 100 : 0
  return (
    <div className="acct-card">
      <div className="glow" style={{ background: meta.color }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontWeight: 600, fontSize: 13.5, position: 'relative' }}>
        <BankDot bank={a.bank_name ?? a.bank} size={11} />{meta.label}
      </div>
      <div className="faint" style={{ fontSize: 11, marginTop: 2 }}>{isCredit ? 'Cartão de crédito' : 'Conta corrente'}</div>
      <div style={{ marginTop: 26 }}>
        <div className="faint" style={{ fontSize: 11 }}>{isCredit ? 'Fatura atual' : 'Saldo'}</div>
        <Money value={balance} style={{ fontSize: 23, fontWeight: 700 }} />
      </div>
      {isCredit && (
        <div style={{ marginTop: 14 }}>
          <div className="ubar"><i style={{ width: util + '%', background: util > 70 ? 'var(--neg)' : meta.color }} /></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7 }} className="faint">
            <span style={{ fontSize: 11 }}>{util.toFixed(0)}% usado</span>
            <span style={{ fontSize: 11 }}>livre <Money value={(a.limit ?? 0) - balance} /></span>
          </div>
        </div>
      )}
    </div>
  )
}

function TxRow({ t }) {
  const isInflow = (t.amount ?? 0) > 0
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 8px', borderRadius: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <span style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', background: 'var(--surface-2)', border: '1px solid var(--border)', color: isInflow ? 'var(--pos)' : 'var(--text-muted)', flexShrink: 0 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
            {isInflow ? <path d="M12 5v14M5 12l7 7 7-7" /> : <path d="M12 19V5M5 12l7-7 7 7" />}
          </svg>
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {t.description}
            {t.installment_number && t.installment_total && (
              <span className="ml-2 text-[9px] text-muted-foreground font-mono bg-[var(--surface-3)] px-1 rounded align-middle">
                {t.installment_number}/{t.installment_total}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, marginTop: 2 }} className="faint">
            <BankDot bank={t.bank} />{t.bank} · {t.date ? formatDate(t.date, 'dd/MM') : ''}
          </div>
        </div>
      </div>
      <Money 
        value={Math.abs(t.amount ?? 0)} 
        style={{ fontSize: 14, fontWeight: 600, color: isInflow ? 'var(--pos)' : 'var(--text)', whiteSpace: 'nowrap', flexShrink: 0, paddingLeft: 10 }}
        showSymbol={false}
      />
    </div>
  )
}

function ChevR() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}
