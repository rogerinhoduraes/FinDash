import { useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useAccounts } from '@/hooks/useAccounts'
import { useTransactions } from '@/hooks/useTransactions'
import { useBills } from '@/hooks/useBills'
import { useCustomCategories } from '@/hooks/useCustomCategories'
import { formatDate, getBankMeta, translateCategory } from '@/lib/formatters'
import { CATEGORIES, compareCategories, isInstallment } from '@/lib/categories'
import { format, subMonths, parseISO, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { LineMultiChart } from '@/components/charts/LineMultiChart'
import { CATEGORY_PALETTE as CAT_COLORS, CATEGORY_INK } from '@/lib/categoryColors'
import { Money } from '@/components/ui/Money'
import { BankDot } from '@/components/ui/BankDot'
import { SectionHead } from '@/components/ui/SectionHead'
import { Skeleton } from '@/components/ui/skeleton'

function CardUtilizacao({ account, bills }) {
  const meta = getBankMeta(account.bank_name ?? account.bank ?? '')
  const limit = account.limit ?? 0
  const used  = Math.abs(account.balance ?? 0)
  const avail = account.available_limit ?? Math.max(0, limit - used)
  const util  = limit > 0 ? (used / limit) * 100 : 0

  const today = new Date().toISOString().slice(0, 10)
  const myLabel = meta.label.toLowerCase()
  const nextBill = bills
    .filter(b => {
      const bLabel = getBankMeta(b.bank ?? '').label.toLowerCase()
      return bLabel === myLabel && (b.due_date ?? '') >= today && b.status !== 'PAID' && b.status !== 'PAGA'
    })
    .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))[0]

  const daysUntil = nextBill?.due_date ? differenceInDays(parseISO(nextBill.due_date), new Date()) : null
  const urgent = daysUntil !== null && daysUntil >= 0 && daysUntil <= 5

  return (
    <div className="card" style={{ overflow: 'hidden', borderColor: urgent ? 'var(--neg)' : 'var(--border)' }}>
      <div style={{ position: 'absolute', width: 180, height: 180, borderRadius: '50%', filter: 'blur(55px)', opacity: 0.25, top: -80, right: -40, background: meta.color, pointerEvents: 'none' }} />
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BankDot bank={account.bank_name ?? account.bank} size={11} />
            <span style={{ fontWeight: 700, fontSize: 15 }}>{meta.label}</span>
          </div>
          <span className="chip">Crédito</span>
        </div>

        <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div>
            <div className="faint" style={{ fontSize: 11, marginBottom: 3 }}>Fatura atual</div>
            <Money value={used} style={{ fontSize: 18, fontWeight: 800, display: 'block' }} />
          </div>
          <div>
            <div className="faint" style={{ fontSize: 11, marginBottom: 3 }}>Disponível</div>
            <Money value={avail} style={{ fontSize: 18, fontWeight: 700, display: 'block' }} />
          </div>
          <div>
            <div className="faint" style={{ fontSize: 11, marginBottom: 3 }}>Limite</div>
            <Money value={limit} style={{ fontSize: 18, fontWeight: 700, display: 'block' }} />
          </div>
        </div>

        {limit > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span className="faint" style={{ fontSize: 11 }}>Utilização</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: util > 70 ? 'var(--neg)' : util > 40 ? 'var(--warn)' : 'var(--pos)' }}>{util.toFixed(0)}%</span>
            </div>
            <div className="ubar" style={{ height: 8 }}>
              <i style={{ width: Math.min(util, 100) + '%', background: util > 70 ? 'var(--neg)' : util > 40 ? 'linear-gradient(90deg,var(--accent),var(--warn))' : meta.color }} />
            </div>
          </div>
        )}

        {nextBill && (
          <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 10, background: urgent ? 'var(--neg-dim)' : 'var(--surface-2)', border: `1px solid ${urgent ? 'var(--neg)' : 'var(--border)'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="faint" style={{ fontSize: 11 }}>
                {daysUntil === 0 ? 'Vence hoje' : daysUntil === 1 ? 'Vence amanhã' : daysUntil > 0 ? `Vence em ${daysUntil}d · ` : ''}
                {nextBill.due_date ? nextBill.due_date.slice(8, 10) + '/' + nextBill.due_date.slice(5, 7) : ''}
              </span>
              <Money value={nextBill.total ?? 0} style={{ fontWeight: 700, fontSize: 13 }} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function CartaoCredito() {
  const { user } = useAuth()
  const uid = user?.uid
  const { accounts, loading: aLoading } = useAccounts(uid)
  const { transactions, loading: tLoading } = useTransactions(uid, { maxDocs: 5000 })
  const { bills, loading: bLoading } = useBills(uid)
  const { customCategories } = useCustomCategories(uid)
  const [editingId, setEditingId] = useState(null)

  const loading = aLoading || tLoading || bLoading

  const cards = useMemo(() => accounts.filter(a => a.account_type === 'CREDIT'), [accounts])
  const cardTxs = useMemo(() => transactions.filter(t => t.account_type === 'CREDIT' && Math.abs(t.amount) >= 0.005), [transactions])

  // Split card spending so installments ("parcelados") get their own section
  // instead of being scattered through the regular purchases.
  const parceladas = useMemo(() => cardTxs.filter(isInstallment), [cardTxs])
  const avulsas    = useMemo(() => cardTxs.filter(t => !isInstallment(t)), [cardTxs])

  const totalUsed = useMemo(() => cards.reduce((s, a) => s + Math.abs(a.balance ?? 0), 0), [cards])
  const totalLimit = useMemo(() => cards.reduce((s, a) => s + (a.limit ?? 0), 0), [cards])

  const allCategories = useMemo(() => [
    ...CATEGORIES,
    ...customCategories.map(c => ({ key: c.key, pt: c.label })),
  ].sort(compareCategories), [customCategories])

  const handleUpdateCat = async (txId, category) => {
    setEditingId(null)
    try {
      await updateDoc(doc(db, `users/${uid}/transactions`, txId), { category })
    } catch (e) {
      console.error(e)
    }
  }

  const renderTxRow = (t) => {
    const meta = getBankMeta(t.bank)
    return (
      <tr key={t.id}>
        <td className="mono faint text-[11px] whitespace-nowrap">{t.date?.split('-').reverse().slice(0, 2).join('/')}</td>
        <td className="font-medium">
          {t.description}
          {t.installment_number && t.installment_total && (
            <span className="ml-2 text-[10px] text-muted-foreground font-mono bg-[var(--surface-3)] px-1 rounded">
              {t.installment_number}/{t.installment_total}
            </span>
          )}
        </td>
        <td>
          {editingId === t.id ? (
            <select className="fd-select h-7 py-0 px-2 text-[11px]" autoFocus onBlur={() => setEditingId(null)}
              value={t.category ?? 'Others'} onChange={(e) => handleUpdateCat(t.id, e.target.value)}>
              {allCategories.map(c => <option key={c.key} value={c.key}>{c.pt}</option>)}
            </select>
          ) : (
            <span className="cat cursor-pointer group" onClick={() => setEditingId(t.id)}>
              {translateCategory(t.category)}
              <span className="ml-1.5 opacity-0 group-hover:opacity-40">✎</span>
            </span>
          )}
        </td>
        <td className="text-[11px]"><div className="flex items-center gap-1.5"><BankDot bank={t.bank} size={7} />{meta.label}</div></td>
        <td className="num"><Money value={Math.abs(t.amount)} style={{ fontWeight: 700 }} showSymbol={false} /></td>
      </tr>
    )
  }

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

  const topCats = useMemo(() => {
    const map = {}
    cardTxs.filter(t => t.amount < 0).forEach(t => {
      const k = t.category || 'Others'
      map[k] = (map[k] || 0) + Math.abs(t.amount)
    })
    return Object.entries(map)
      .map(([key, val]) => ({ key, label: translateCategory(key), value: val }))
      .sort((a,b) => b.value - a.value)
      .slice(0, 5)
  }, [cardTxs])

  if (loading) return (
    <div className="grid gap-[22px]">
      <Skeleton className="h-[52px] w-[55%] rounded-[10px]" />
      <div className="g-3">
        <Skeleton className="h-[110px] w-full rounded-[14px]" />
        <Skeleton className="h-[110px] w-full rounded-[14px]" />
        <Skeleton className="h-[110px] w-full rounded-[14px]" />
      </div>
      <div className="g-2">
        <Skeleton className="h-[180px] w-full rounded-[14px]" />
        <Skeleton className="h-[180px] w-full rounded-[14px]" />
      </div>
      <div className="g-wide-l">
        <Skeleton className="h-[280px] w-full rounded-[14px]" />
        <Skeleton className="h-[280px] w-full rounded-[14px]" />
      </div>
      <Skeleton className="h-[260px] w-full rounded-[14px]" />
    </div>
  )

  return (
    <div className="fade-in grid gap-[22px]">
      <SectionHead title="Cartão de Crédito" sub="Gerenciamento de limites e gastos" />

      <div className="g-3">
        <div className="card">
          <div className="eyebrow">Dívida Atual</div>
          <Money value={totalUsed} style={{ fontSize: 26, fontWeight: 800, fontFamily: 'var(--font-display)' }} />
          <div className="faint" style={{ fontSize: 11, marginTop: 6 }}>Soma das faturas em aberto</div>
        </div>
        <div className="card">
          <div className="eyebrow">Limite Disponível</div>
          <Money value={totalLimit - totalUsed} style={{ fontSize: 26, fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--pos)' }} />
        </div>
        <div className="card">
          <div className="eyebrow">Utilização Geral</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 26, fontWeight: 800, fontFamily: 'var(--font-display)' }}>{totalLimit > 0 ? ((totalUsed / totalLimit) * 100).toFixed(0) : 0}%</span>
            <span className="faint" style={{ fontSize: 13 }}>do total</span>
          </div>
        </div>
      </div>

      <div className="g-2">
        {cards.map(c => <CardUtilizacao key={c.id} account={c} bills={bills} />)}
      </div>

      <div className="g-wide-l">
        <div className="card">
          <SectionHead title="Evolução" sub="12 meses" />
          <div style={{ height: 220, marginTop: 10 }}>
            <LineMultiChart series={chartData} months={monthLabels} />
          </div>
        </div>

        <div className="card">
          <SectionHead title="Gastos por Categoria" sub="No cartão" />
          <div className="grid gap-5 mt-6">
            {topCats.map((c, i) => {
              const color = CAT_COLORS[i % CAT_COLORS.length]
              const pct = (c.value / (totalUsed || 1)) * 100
              return (
                <div key={c.key} style={{ display: 'grid', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{c.label}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span className="faint mono" style={{ fontSize: 11 }}>{pct.toFixed(0)}%</span>
                      <Money value={c.value} style={{ fontSize: 13, fontWeight: 700 }} />
                    </div>
                  </div>
                  <div className="ubar" style={{ height: 5 }}>
                    <i style={{ width: pct + '%', background: color }} />
                  </div>
                </div>
              )
            })}
            {topCats.length === 0 && <div className="py-10 text-center text-muted-foreground opacity-50">Sem gastos classificados.</div>}
          </div>
        </div>
      </div>

      {parceladas.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="p-5 pb-0"><SectionHead title="Compras Parceladas" sub={`${parceladas.length} no cartão`} /></div>
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Banco</th><th className="num">Valor</th></tr>
              </thead>
              <tbody>
                {parceladas.slice(0, 50).map(renderTxRow)}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <div className="p-5 pb-0"><SectionHead title="Lançamentos no Cartão" sub={parceladas.length > 0 ? 'À vista' : 'Recentes'} /></div>
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Banco</th><th className="num">Valor</th></tr>
            </thead>
            <tbody>
              {avulsas.slice(0, 50).map(renderTxRow)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
