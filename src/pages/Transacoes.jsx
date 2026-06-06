import { useState, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useTransactions } from '@/hooks/useTransactions'
import { useAccounts } from '@/hooks/useAccounts'
import { useCustomCategories } from '@/hooks/useCustomCategories'
import { formatDate, getBankMeta, translateCategory } from '@/lib/formatters'
import { CATEGORIES, compareCategories } from '@/lib/categories'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Money } from '@/components/ui/Money'
import { BankDot } from '@/components/ui/BankDot'
import { SectionHead } from '@/components/ui/SectionHead'
import { Skeleton } from '@/components/ui/skeleton'

const PAGE_SIZE = 15

function exportCSV(rows) {
  const head = ['Data', 'Descrição', 'Categoria', 'Banco', 'Valor']
  const lines = rows.map((t) => [
    formatDate(t.date), 
    `"${(t.description ?? '').replace(/"/g, '""')}"`, 
    t.category ?? '', 
    t.bank ?? '', 
    (t.amount ?? 0).toFixed(2)
  ].join(','))
  const csv = [head.join(','), ...lines].join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `transacoes_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function Transacoes() {
  const { user } = useAuth()
  const uid = user?.uid
  const { transactions, loading: tLoading } = useTransactions(uid, { maxDocs: 10000 })
  const { accounts, loading: aLoading } = useAccounts(uid)
  const { customCategories } = useCustomCategories(uid)
  
  const [tab, setTab] = useState('cartao')
  const [editingTxId, setEditingTxId] = useState(null)
  const [optimisticCats, setOptimisticCats] = useState({})
  
  const [q, setQ] = useState('')
  const [bank, setBank] = useState('')
  const [type, setType] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(0)

  const allCategories = useMemo(() => [
    ...CATEGORIES,
    ...customCategories.map((c) => ({ key: c.key, pt: c.label })),
  ].sort(compareCategories), [customCategories])

  async function handleCategoryChange(tx, newCat) {
    setEditingTxId(null)
    const current = optimisticCats[tx.id] ?? tx.category
    if (!newCat || newCat === current) return
    setOptimisticCats((prev) => ({ ...prev, [tx.id]: newCat }))
    try {
      await updateDoc(doc(db, `users/${uid}/transactions`, tx.id), { category: newCat })
    } catch (err) {
      console.error('Error updating category:', err)
      setOptimisticCats((prev) => { const n = { ...prev }; delete n[tx.id]; return n })
    }
  }

  const loading = tLoading || aLoading

  const accountTypeMap = useMemo(() => {
    const map = {}
    accounts.forEach((a) => { map[a.account_id ?? a.id] = a.account_type })
    return map
  }, [accounts])

  const sourceFiltered = useMemo(() => {
    return transactions.filter((t) => {
      const accType = t.account_type || accountTypeMap[t.account_id] || 'BANK'
      const isCredit = accType === 'CREDIT'
      return tab === 'cartao' ? isCredit : !isCredit
    })
  }, [transactions, accountTypeMap, tab])

  const filtered = useMemo(() => {
    let list = sourceFiltered
    if (q) {
      const lowQ = q.toLowerCase()
      list = list.filter((t) => 
        (t.description ?? '').toLowerCase().includes(lowQ) || 
        (t.category ?? '').toLowerCase().includes(lowQ)
      )
    }
    if (bank) list = list.filter((t) => (t.bank ?? '').toLowerCase().includes(bank.toLowerCase()))
    if (type === 'entrada') list = list.filter((t) => (t.amount ?? 0) > 0)
    if (type === 'saida')   list = list.filter((t) => (t.amount ?? 0) < 0)
    if (dateFrom) list = list.filter((t) => (t.date ?? '') >= dateFrom)
    if (dateTo)   list = list.filter((t) => (t.date ?? '') <= dateTo)
    return list
  }, [sourceFiltered, q, bank, type, dateFrom, dateTo])

  const pages = Math.ceil(filtered.length / PAGE_SIZE) || 1
  const rows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalIn  = filtered.filter((t) => (t.amount ?? 0) > 0).reduce((s, t) => s + Math.abs(t.amount), 0)
  const totalOut = filtered.filter((t) => (t.amount ?? 0) < 0).reduce((s, t) => s + Math.abs(t.amount), 0)

  const creditCount = transactions.filter((t) => (t.account_type || accountTypeMap[t.account_id] || 'BANK') === 'CREDIT').length
  const bankCount   = transactions.filter((t) => (t.account_type || accountTypeMap[t.account_id] || 'BANK') !== 'CREDIT').length

  return (
    <div className="fade-in grid gap-[22px]">
      <SectionHead 
        title="Transações" 
        sub={`${filtered.length} filtradas`}
        right={
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2">
              <span className="chip"><span className="h-2 w-2 rounded-full bg-[var(--pos)]" /> <Money value={totalIn} className="ml-1" /></span>
              <span className="chip"><span className="h-2 w-2 rounded-full bg-[var(--neg)]" /> <Money value={totalOut} className="ml-1" /></span>
            </div>
            <button className="btn primary flex items-center gap-2" onClick={() => exportCSV(filtered)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-[15px] w-[15px]"><path d="M12 3v12M7 11l5 5 5-5M5 21h14" /></svg>
              Exportar
            </button>
          </div>
        }
      />

      {/* Tabs */}
      <div className="tab-row" style={{ width: 'fit-content' }}>
        <button className={'tab' + (tab === 'cartao' ? ' active' : '')} onClick={() => { setTab('cartao'); setPage(0) }}>
          Cartão <span className="nav-badge ml-1.5">{creditCount}</span>
        </button>
        <button className={'tab' + (tab === 'banco' ? ' active' : '')} onClick={() => { setTab('banco'); setPage(0) }}>
          Conta corrente <span className="nav-badge ml-1.5">{bankCount}</span>
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="filter-grid">
          <div className="search-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
            <input className="fd-input" placeholder="Buscar por descrição ou categoria…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0) }} />
          </div>
          <select className="fd-select" value={bank} onChange={(e) => { setBank(e.target.value); setPage(0) }}>
            <option value="">Todos os bancos</option>
            <option value="Nubank">Nubank</option>
            <option value="Santander">Santander</option>
            <option value="Inter">Inter</option>
          </select>
          <select className="fd-select" value={type} onChange={(e) => { setType(e.target.value); setPage(0) }}>
            <option value="">Entrada e saída</option>
            <option value="entrada">Entradas</option>
            <option value="saida">Saídas</option>
          </select>
          <div className="flex gap-2">
            <input className="fd-input w-full" type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(0) }} title="De" />
            <input className="fd-input w-full" type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(0) }} title="Até" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="grid gap-2 p-5">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <Skeleton key={i} className="h-[44px] w-full rounded-[10px]" />)}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Data</th><th>Descrição</th><th>Categoria</th><th>Banco</th><th className="num">Valor</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={5} className="py-10 text-center text-muted-foreground opacity-50">Nenhuma transação encontrada.</td></tr>
                ) : rows.map((t) => {
                  const isInflow = (t.amount ?? 0) > 0
                  const meta = getBankMeta(t.bank ?? '')
                  const displayCat = optimisticCats[t.id] ?? t.category
                  return (
                    <tr key={t.id}>
                      <td className="mono faint text-[11px] whitespace-nowrap">{t.date ? formatDate(t.date, 'dd/MM/yy') : '—'}</td>
                      <td className="font-medium">
                        {t.description}
                        {t.installment_number && t.installment_total && (
                          <span className="ml-2 text-[10px] text-muted-foreground font-mono bg-muted/50 px-1 rounded">
                            {t.installment_number}/{t.installment_total}
                          </span>
                        )}
                      </td>
                      <td>
                        {editingTxId === t.id ? (
                          <select
                            autoFocus
                            className="fd-select h-7 py-0 px-2 text-[11px]"
                            value={displayCat ?? 'Others'}
                            onChange={(e) => handleCategoryChange(t, e.target.value)}
                            onBlur={() => setEditingTxId(null)}
                          >
                            {allCategories.map((c) => (
                              <option key={c.key} value={c.key}>{c.pt}</option>
                            ))}
                          </select>
                        ) : (
                          <span
                            className="cat cursor-pointer group"
                            title="Editar categoria"
                            onClick={() => setEditingTxId(t.id)}
                          >
                            <span className="h-2 w-2 rounded-full bg-muted-foreground/30 mr-1.5" />
                            {translateCategory(displayCat)}
                            <span className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity">✎</span>
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5 text-[13px]">
                          <BankDot bank={t.bank} size={9} />
                          {meta.label}
                        </div>
                      </td>
                      <td className="num">
                        <Money 
                          value={Math.abs(t.amount ?? 0)} 
                          style={{ fontWeight: 700, color: isInflow ? 'var(--pos)' : 'var(--text)' }}
                          showSymbol={false}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-between p-5 pt-3">
          <span className="faint text-[12.5px]">{filtered.length} resultado(s) · página {page + 1} de {pages}</span>
          <div className="flex gap-2">
            <button className="btn" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Anterior</button>
            <button className="btn" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>Próxima</button>
          </div>
        </div>
      </div>
    </div>
  )
}
