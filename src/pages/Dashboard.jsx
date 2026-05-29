import { useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useAccounts } from '@/hooks/useAccounts'
import { useTransactions } from '@/hooks/useTransactions'
import { useBills } from '@/hooks/useBills'
import { useInvestments } from '@/hooks/useInvestments'
import { formatCurrency, formatDate, getBankMeta } from '@/lib/formatters'
import { differenceInDays, parseISO, format, subMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import useFinanceStore from '@/store/useFinanceStore'
import { RadialScore } from '@/components/charts/RadialScoreChart'
import { CompositionBar } from '@/components/charts/CompositionBar'
import { CashflowTideChart } from '@/components/charts/CashflowTideChart'
import { LineMultiChart } from '@/components/charts/LineMultiChart'
import { Sparkline } from '@/components/charts/SparklineChart'

function Sk({ w = '100%', h = 16, r = 8, style }) {
  return <div className="sk" style={{ width: w, height: h, borderRadius: r, ...style }} />
}

function Money({ value, style, className = '' }) {
  const { privacyMode } = useFinanceStore()
  return (
    <span className={'money ' + (privacyMode ? 'blurred ' : '') + className} style={style}>
      {formatCurrency(value)}
    </span>
  )
}

function BankDot({ bank, size = 9 }) {
  const meta = getBankMeta(bank)
  return <span className="bank-dot" style={{ background: meta.color, width: size, height: size }} />
}

function SectionHead({ title, sub, right }) {
  return (
    <div className="section-head">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span className="section-title">{title}</span>
        {sub && <span className="section-sub">{sub}</span>}
      </div>
      {right}
    </div>
  )
}

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

  const kpis = useMemo(() => {
    const checking = accounts.filter((a) => a.account_type !== 'CREDIT').reduce((s, a) => s + (a.balance ?? 0), 0)
    const cardDebt = accounts.filter((a) => a.account_type === 'CREDIT').reduce((s, a) => s + Math.abs(a.balance ?? 0), 0)
    const totalLimit = accounts.filter((a) => a.account_type === 'CREDIT').reduce((s, a) => s + (a.limit ?? 0), 0)
    const invested = investments.filter((i) => !['REDEEMED','RESGATADO','TOTAL_WITHDRAWAL','PARTIAL_WITHDRAWAL'].includes(i.status)).reduce((s, i) => s + (i.balance ?? i.value ?? 0), 0)
    const net = checking + invested - cardDebt
    const util = totalLimit > 0 ? (cardDebt / totalLimit) * 100 : 0

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
    const monthTx = transactions.filter((t) => (t.date ?? '') >= monthStart)
    const income  = monthTx.filter((t) => (t.amount ?? 0) > 0).reduce((s, t) => s + Math.abs(t.amount), 0)
    const expense = monthTx.filter((t) => (t.amount ?? 0) < 0).reduce((s, t) => s + Math.abs(t.amount), 0)

    return { checking, cardDebt, totalLimit, invested, net, util, income, expense }
  }, [accounts, investments, transactions])

  const savingsRate = kpis.income > 0 ? (kpis.income - kpis.expense) / kpis.income : 0
  const fundMonths = kpis.expense > 0 ? kpis.checking / kpis.expense : 0
  const sSavings = Math.min(100, savingsRate * 300)
  const sUtil = 100 - kpis.util
  const sFund = Math.min(100, (fundMonths / 3) * 100)
  const score = Math.round(0.5 * sSavings + 0.3 * sUtil + 0.2 * sFund)

  const recentTx = useMemo(() => transactions.slice(0, 5), [transactions])
  const upcomingBills = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const byBank = {}
    for (const b of bills) {
      if ((b.due_date ?? '') < today) continue
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
    const now = new Date()
    return Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(now, 5 - i)
      const s = startOfMonth(d), e = endOfMonth(d)
      return transactions.filter((t) => {
        const dt = t.date ? parseISO(t.date) : null
        return dt && isWithinInterval(dt, { start: s, end: e }) && (t.amount ?? 0) > 0
      }).reduce((sum, t) => sum + Math.abs(t.amount), 0)
    })
  }, [transactions])

  const expenseSparkData = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(now, 5 - i)
      const s = startOfMonth(d), e = endOfMonth(d)
      return transactions.filter((t) => {
        const dt = t.date ? parseISO(t.date) : null
        return dt && isWithinInterval(dt, { start: s, end: e }) && (t.amount ?? 0) < 0
      }).reduce((sum, t) => sum + Math.abs(t.amount), 0)
    })
  }, [transactions])

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

      {/* HERO ROW */}
      <div className="g-hero">
        {/* Net worth */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 100% at 100% 0%, var(--accent-dim), transparent 55%)', pointerEvents: 'none' }} />
          {loading ? (
            <div style={{ position: 'relative' }}>
              <Sk w="30%" h={13} /><Sk w="55%" h={52} style={{ marginTop: 16 }} /><Sk w="100%" h={14} r={99} style={{ marginTop: 28 }} /><Sk w="80%" h={40} style={{ marginTop: 16 }} />
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="eyebrow">Patrimônio líquido</span>
                <span className="chip"><span style={{ width: 8, height: 8, borderRadius: 99, background: 'var(--pos)', marginRight: 2 }} />conta + invest. − dívida</span>
              </div>
              <div style={{ marginTop: 10 }}>
                <Money value={kpis.net} style={{ fontSize: 'clamp(26px, 3.5vw, 46px)', fontWeight: 800, letterSpacing: '-.03em', fontFamily: 'var(--font-display)', display: 'block', lineHeight: 1.05 }} />
              </div>
              <div style={{ marginTop: 26 }}>
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
          {loading ? <Sk w={150} h={150} r={99} /> : (
            <div style={{ textAlign: 'center', width: '100%' }}>
              <div className="eyebrow" style={{ marginBottom: 6 }}>Saúde financeira</div>
              <div style={{ display: 'grid', placeItems: 'center' }}>
                <RadialScore score={score} />
              </div>
              <div style={{ display: 'grid', gap: 9, marginTop: 14, textAlign: 'left' }}>
                <Factor label="Poupança" pct={Math.round(savingsRate * 100) + '%'} val={Math.round(sSavings)} />
                <Factor label="Crédito usado" pct={Math.round(kpis.util) + '%'} val={Math.round(sUtil)} invert />
                <Factor label="Reserva" pct={fundMonths.toFixed(1) + ' meses'} val={Math.round(sFund)} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* KPI STATS */}
      <div className="g-3">
        {/* Income */}
        <div className="card">
          {tLoading ? (<><Sk w="40%" h={12} /><Sk w="70%" h={30} style={{ marginTop: 14 }} /><Sk w="100%" h={30} style={{ marginTop: 18 }} /></>) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="eyebrow">Receitas do mês</span>
              </div>
              <div style={{ marginTop: 12 }}>
                <Money value={kpis.income} style={{ fontSize: 'clamp(18px, 2vw, 27px)', fontWeight: 700, letterSpacing: '-.02em' }} />
              </div>
              <div style={{ marginTop: 16 }}><Sparkline data={incomeSparkData} color="var(--pos)" /></div>
            </>
          )}
        </div>

        {/* Expenses */}
        <div className="card">
          {tLoading ? (<><Sk w="40%" h={12} /><Sk w="70%" h={30} style={{ marginTop: 14 }} /><Sk w="100%" h={30} style={{ marginTop: 18 }} /></>) : (
            <>
              <div className="eyebrow">Despesas do mês</div>
              <div style={{ marginTop: 12 }}>
                <Money value={kpis.expense} style={{ fontSize: 'clamp(18px, 2vw, 27px)', fontWeight: 700, letterSpacing: '-.02em' }} />
              </div>
              <div style={{ marginTop: 16 }}><Sparkline data={expenseSparkData} color="var(--neg)" /></div>
            </>
          )}
        </div>

        {/* Credit util */}
        {loading ? <div className="card"><Sk w="40%" h={12} /><Sk w="60%" h={30} style={{ marginTop: 14 }} /><Sk w="100%" h={10} r={99} style={{ marginTop: 20 }} /></div> : (
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

      {/* ACCOUNT RAIL */}
      <div className="card">
        <SectionHead title="Suas contas" sub={accounts.length + ' conectadas'} right={<button className="btn" onClick={() => navigate('/contas')}>Ver todas <ChevR /></button>} />
        {loading ? (
          <div className="acct-rail">{[1,2,3,4].map((i) => <div key={i} className="acct-card"><Sk w="60%" h={14} /><Sk w="80%" h={26} style={{ marginTop: 24 }} /></div>)}</div>
        ) : (
          <div style={{ position: 'relative' }}>
            <div className="acct-rail">
              {accounts.map((a) => <AccountMiniCard key={a.id} a={a} privacyMode={privacyMode} />)}
            </div>
            {accounts.length > 3 && (
              <div style={{ position: 'absolute', right: 0, top: 0, bottom: 14, width: 60, background: 'linear-gradient(to right, transparent, var(--surface))', pointerEvents: 'none', borderRadius: '0 var(--r-lg) var(--r-lg) 0' }} />
            )}
          </div>
        )}
      </div>

      {/* CASHFLOW + UPCOMING */}
      <div className="g-wide-l">
        <div className="card">
          <SectionHead title="Fluxo de caixa" sub="6 meses" right={<div style={{ display: 'flex', gap: 14 }}><Legend color="var(--pos)" label="Entradas" /><Legend color="var(--neg)" label="Saídas" /></div>} />
          {tLoading ? <Sk w="100%" h={220} /> : <CashflowTideChart transactions={transactions} />}
        </div>
        <div className="card">
          <SectionHead title="Próximas faturas" right={<button className="btn" onClick={() => navigate('/faturas')}>Faturas <ChevR /></button>} />
          <div style={{ display: 'grid', gap: 10 }}>
            {bLoading ? [1,2,3].map((i) => <Sk key={i} w="100%" h={62} r={14} />) : upcomingBills.length === 0 ? (
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
          <SectionHead title="Últimas transações" right={<button className="btn" onClick={() => navigate('/transacoes')}>Ver tudo <ChevR /></button>} />
          <div style={{ display: 'grid', gap: 2 }}>
            {tLoading ? [1,2,3,4,5].map((i) => <Sk key={i} w="100%" h={44} r={10} />) : recentTx.map((t) => <TxRow key={t.id} t={t} privacyMode={privacyMode} />)}
          </div>
        </div>
        <div className="card">
          <SectionHead title="Evolução das faturas" sub="12 meses" right={<div style={{ display: 'flex', gap: 14 }}>{billSeries.map((s) => <Legend key={s.label} color={s.color} label={s.label} />)}</div>} />
          {bLoading ? <Sk w="100%" h={230} /> : <LineMultiChart series={billSeries} months={monthLabels} />}
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
        <span className="bank-dot" style={{ background: meta.color, width: 11, height: 11 }} />{meta.label}
      </div>
      <div className="faint" style={{ fontSize: 11, marginTop: 2 }}>{isCredit ? 'Cartão de crédito' : 'Conta corrente'}</div>
      <div style={{ marginTop: 26 }}>
        <div className="faint" style={{ fontSize: 11 }}>{isCredit ? 'Fatura atual' : 'Saldo'}</div>
        <span className={'money' + (privacyMode ? ' blurred' : '')} style={{ fontSize: 23, fontWeight: 700 }}>{formatCurrency(balance)}</span>
      </div>
      {isCredit && (
        <div style={{ marginTop: 14 }}>
          <div className="ubar"><i style={{ width: util + '%', background: util > 70 ? 'var(--neg)' : meta.color }} /></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7 }} className="faint">
            <span style={{ fontSize: 11 }}>{util.toFixed(0)}% usado</span>
            <span style={{ fontSize: 11 }}>livre <span className={'money' + (privacyMode ? ' blurred' : '')}>{formatCurrency((a.limit ?? 0) - balance)}</span></span>
          </div>
        </div>
      )}
    </div>
  )
}

function TxRow({ t, privacyMode }) {
  const isInflow = (t.amount ?? 0) > 0
  const meta = getBankMeta(t.bank ?? '')
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 8px', borderRadius: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <span style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', background: 'var(--surface-2)', border: '1px solid var(--border)', color: isInflow ? 'var(--pos)' : 'var(--text-muted)', flexShrink: 0 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
            {isInflow ? <path d="M12 5v14M5 12l7 7 7-7" /> : <path d="M12 19V5M5 12l7-7 7 7" />}
          </svg>
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.description}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, marginTop: 2 }} className="faint">
            <BankDot bank={t.bank} />{t.bank} · {t.date ? formatDate(t.date, 'dd/MM') : ''}
          </div>
        </div>
      </div>
      <span className={'money ' + (privacyMode ? 'blurred ' : '')} style={{ fontSize: 14, fontWeight: 600, color: isInflow ? 'var(--pos)' : 'var(--text)', whiteSpace: 'nowrap', flexShrink: 0, paddingLeft: 10 }}>
        {isInflow ? '+' : ''}{formatCurrency(Math.abs(t.amount ?? 0))}
      </span>
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
