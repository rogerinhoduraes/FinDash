import { useState, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useTransactions } from '@/hooks/useTransactions'
import { useAccounts } from '@/hooks/useAccounts'
import { formatCurrency, formatDate, getBankMeta, translateCategory } from '@/lib/formatters'
import useFinanceStore from '@/store/useFinanceStore'

const PAGE_SIZE = 50

function exportCSV(rows) {
  const head = ['Data','Descrição','Categoria','Banco','Valor']
  const lines = rows.map((t) => [formatDate(t.date), `"${(t.description ?? '').replace(/"/g,'""')}"`, t.category ?? '', t.bank ?? '', (t.amount ?? 0).toFixed(2)].join(','))
  const csv = [head.join(','), ...lines].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = `transacoes_${new Date().toISOString().slice(0,10)}.csv`; a.click()
  URL.revokeObjectURL(url)
}

function Sk({ w = '100%', h = 16, r = 8 }) {
  return <div className="sk" style={{ width: w, height: h, borderRadius: r }} />
}

export default function Transacoes() {
  const { user } = useAuth()
  const { transactions, loading: tLoading } = useTransactions(user?.uid, { maxDocs: 10000 })
  const { accounts, loading: aLoading } = useAccounts(user?.uid)
  const { privacyMode } = useFinanceStore()
  const [tab, setTab] = useState('banco')
  const [q, setQ] = useState('')
  const [bank, setBank] = useState('')
  const [type, setType] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(0)

  const loading = tLoading || aLoading

  const accountTypeMap = useMemo(() => {
    const map = {}
    accounts.forEach((a) => { map[a.account_id ?? a.id] = a.account_type })
    return map
  }, [accounts])

  const sourceFiltered = useMemo(() => {
    return transactions.filter((t) => {
      const isCredit = accountTypeMap[t.account_id] === 'CREDIT'
      return tab === 'cartao' ? isCredit : !isCredit
    })
  }, [transactions, accountTypeMap, tab])

  const filtered = useMemo(() => {
    let list = sourceFiltered
    if (q) list = list.filter((t) => (t.description ?? '').toLowerCase().includes(q.toLowerCase()))
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

  const creditCount = transactions.filter((t) => accountTypeMap[t.account_id] === 'CREDIT').length
  const bankCount   = transactions.length - creditCount

  return (
    <div className="fade-up" style={{ display: 'grid', gap: 18 }}>
      {/* Tabs + totals */}
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div className="tab-row">
          <div className={'tab' + (tab === 'banco' ? ' active' : '')} onClick={() => { setTab('banco'); setPage(0) }}>
            Conta corrente <span className="nav-badge" style={{ marginLeft: 6 }}>{bankCount}</span>
          </div>
          <div className={'tab' + (tab === 'cartao' ? ' active' : '')} onClick={() => { setTab('cartao'); setPage(0) }}>
            Cartão <span className="nav-badge" style={{ marginLeft: 6 }}>{creditCount}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span className="chip"><span style={{ width: 8, height: 8, borderRadius: 99, background: 'var(--pos)' }} />entradas <span className={'money ' + (privacyMode ? 'blurred' : '')} style={{ marginLeft: 4 }}>{formatCurrency(totalIn)}</span></span>
          <span className="chip"><span style={{ width: 8, height: 8, borderRadius: 99, background: 'var(--neg)' }} />saídas <span className={'money ' + (privacyMode ? 'blurred' : '')} style={{ marginLeft: 4 }}>{formatCurrency(totalOut)}</span></span>
          <button className="btn primary" onClick={() => exportCSV(filtered)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}><path d="M12 3v12M7 11l5 5 5-5M5 21h14" /></svg>
            CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: 16 }}>
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
          <select className="fd-select" value="" onChange={() => {}} style={{ visibility: 'hidden' }} aria-hidden />
          <input className="fd-input" type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(0) }} title="De" />
          <input className="fd-input" type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(0) }} title="Até" />
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: '8px 8px 14px' }}>
        {loading ? (
          <div style={{ padding: 16, display: 'grid', gap: 8 }}>
            {[1,2,3,4,5].map((i) => <Sk key={i} h={44} r={8} />)}
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Data</th><th>Descrição</th><th>Categoria</th><th>Banco</th><th className="num">Valor</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--text-faint)' }}>Nenhuma transação encontrada.</td></tr>
              ) : rows.map((t) => {
                const isInflow = (t.amount ?? 0) > 0
                const meta = getBankMeta(t.bank ?? '')
                return (
                  <tr key={t.id}>
                    <td className="mono faint" style={{ whiteSpace: 'nowrap' }}>{t.date ? formatDate(t.date, 'dd/MM/yy') : '—'}</td>
                    <td style={{ fontWeight: 500 }}>{t.description}</td>
                    <td><span className="cat"><span className="bank-dot" style={{ background: 'var(--text-faint)' }} />{translateCategory(t.category)}</span></td>
                    <td><div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}><span className="bank-dot" style={{ background: meta.color }} />{meta.label}</div></td>
                    <td className="num"><span className={'money ' + (privacyMode ? 'blurred' : '')} style={{ fontWeight: 600, color: isInflow ? 'var(--pos)' : 'var(--text)' }}>{isInflow ? '+' : ''}{formatCurrency(Math.abs(t.amount ?? 0))}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 14px 4px' }}>
          <span className="faint" style={{ fontSize: 12.5 }}>{filtered.length} resultado(s) · página {page + 1} de {pages}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Anterior</button>
            <button className="btn" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>Próxima</button>
          </div>
        </div>
      </div>
    </div>
  )
}
