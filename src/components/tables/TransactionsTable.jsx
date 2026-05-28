import { useState, useMemo } from 'react'
import { formatCurrency, formatDate, getBankMeta } from '@/lib/formatters'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { parseISO, isWithinInterval } from 'date-fns'

const PAGE_SIZE = 50

function exportCSV(rows) {
  const header = ['Data', 'Descrição', 'Categoria', 'Banco', 'Valor']
  const lines = rows.map((t) => [
    formatDate(t.date),
    `"${(t.description ?? '').replace(/"/g, '""')}"`,
    t.category ?? '',
    t.bank ?? '',
    (t.amount ?? 0).toFixed(2),
  ])
  const csv = [header, ...lines].map((r) => r.join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `transacoes_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function TransactionsTable({ transactions = [], loading }) {
  const [search, setSearch] = useState('')
  const [bankFilter, setBankFilter] = useState(null)
  const [catFilter, setCatFilter] = useState(null)
  const [typeFilter, setTypeFilter] = useState(null)
  const [page, setPage] = useState(0)

  const banks = useMemo(() => {
    const s = new Set(transactions.map((t) => t.bank).filter(Boolean))
    return [...s].map((b) => ({ value: b, label: b }))
  }, [transactions])

  const categories = useMemo(() => {
    const s = new Set(transactions.map((t) => t.category).filter(Boolean))
    return [...s].sort().map((c) => ({ value: c, label: c }))
  }, [transactions])

  const filtered = useMemo(() => {
    let list = transactions
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((t) => (t.description ?? '').toLowerCase().includes(q))
    }
    if (bankFilter) list = list.filter((t) => t.bank === bankFilter)
    if (catFilter) list = list.filter((t) => t.category === catFilter)
    if (typeFilter === 'entrada') list = list.filter((t) => (t.amount ?? 0) > 0)
    if (typeFilter === 'saida') list = list.filter((t) => (t.amount ?? 0) < 0)
    return list
  }, [transactions, search, bankFilter, catFilter, typeFilter])

  const pages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Buscar descrição..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0) }}
          className="max-w-xs"
        />
        <Select
          value={bankFilter}
          onChange={(v) => { setBankFilter(v); setPage(0) }}
          options={banks}
          placeholder="Todos os bancos"
          className="w-40"
        />
        <Select
          value={catFilter}
          onChange={(v) => { setCatFilter(v); setPage(0) }}
          options={categories}
          placeholder="Categoria"
          className="w-40"
        />
        <Select
          value={typeFilter}
          onChange={(v) => { setTypeFilter(v); setPage(0) }}
          options={[{ value: 'entrada', label: 'Entradas' }, { value: 'saida', label: 'Saídas' }]}
          placeholder="Tipo"
          className="w-32"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportCSV(filtered)}
          className="ml-auto"
        >
          <Download className="h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm" aria-label="Tabela de transações">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Data</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Descrição</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden sm:table-cell">Categoria</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Banco</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Valor</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-muted-foreground">
                  Nenhuma transação encontrada
                </td>
              </tr>
            ) : (
              pageRows.map((t) => {
                const bankMeta = getBankMeta(t.bank)
                const positive = (t.amount ?? 0) > 0
                return (
                  <tr key={t.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(t.date)}
                    </td>
                    <td className="px-4 py-3 max-w-xs truncate">{t.description}</td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <Badge variant="secondary" className="text-[10px]">{t.category ?? '—'}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-medium text-white"
                        style={{ backgroundColor: bankMeta.color }}
                      >
                        {bankMeta.label}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-right font-mono font-medium ${positive ? 'text-[#4fd9c8]' : 'text-[#f05c6e]'}`}>
                      {positive ? '+' : ''}{formatCurrency(t.amount)}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{filtered.length} transações · página {page + 1} de {pages}</span>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" disabled={page === pages - 1} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
