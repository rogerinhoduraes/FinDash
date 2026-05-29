import { useState } from 'react'
import { CheckCircle, AlertTriangle, Clock } from 'lucide-react'
import { formatCurrency, formatDate, getBankMeta } from '@/lib/formatters'
import { Dialog } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { differenceInDays, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'

function StatusIcon({ status }) {
  if (status === 'PAID' || status === 'PAGA')
    return <CheckCircle className="h-4 w-4 text-[#4fd9c8]" aria-label="Paga" />
  if (status === 'DIVERGENCE' || status === 'DIVERGÊNCIA')
    return <AlertTriangle className="h-4 w-4 text-[#f5b731]" aria-label="Divergência" />
  return <Clock className="h-4 w-4 text-muted-foreground" aria-label="Em aberto" />
}

function statusLabel(status) {
  if (status === 'PAID' || status === 'PAGA') return 'Paga'
  if (status === 'DIVERGENCE' || status === 'DIVERGÊNCIA') return 'Divergência'
  return 'Em aberto'
}

export function BillsTable({ bills = [], loading }) {
  const [selected, setSelected] = useState(null)
  const today = new Date()

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
      </div>
    )
  }

  const sorted = [...bills].sort((a, b) => {
    const da = a.due_date ? parseISO(a.due_date) : new Date(0)
    const db_ = b.due_date ? parseISO(b.due_date) : new Date(0)
    return db_ - da
  })

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm" aria-label="Tabela de faturas">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Banco</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Vencimento</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden sm:table-cell">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Total</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-12 text-center text-muted-foreground">
                  Nenhuma fatura encontrada
                </td>
              </tr>
            ) : (
              sorted.map((bill) => {
                const meta = getBankMeta(bill.bank)
                const dueDate = bill.due_date ? parseISO(bill.due_date) : null
                const daysLeft = dueDate ? differenceInDays(dueDate, today) : null
                const isUrgent = daysLeft !== null && daysLeft >= 0 && daysLeft <= 5 && bill.status !== 'PAID' && bill.status !== 'PAGA'

                return (
                  <tr
                    key={bill.id}
                    onClick={() => setSelected(bill)}
                    className={cn(
                      'border-b border-border/50 cursor-pointer transition-colors',
                      isUrgent ? 'bg-[#f5b731]/5 hover:bg-[#f5b731]/10' : 'hover:bg-muted/20'
                    )}
                  >
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-medium text-white"
                        style={{ backgroundColor: meta.color }}
                      >
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {formatDate(bill.due_date)}
                        {isUrgent && (
                          <span className="text-[10px] text-[#f5b731]">
                            {daysLeft === 0 ? 'Vence hoje' : `${daysLeft}d`}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <div className="flex items-center gap-1.5">
                        <StatusIcon status={bill.status} />
                        <span className="text-xs">{statusLabel(bill.status)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium text-[#f05c6e]">
                      {formatCurrency(bill.total)}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {selected && (() => {
        const items = selected.items ?? []
        const isInstallment = (item) =>
          item.is_installment ?? /\b\d+\s*\/\s*\d+\b|PARC\b|PARCELA\b|PARCELAMENTO\b/i.test(item.description ?? '')
        const installments = items.filter(isInstallment)
        const regular = items.filter((i) => !isInstallment(i))
        const sumInstallments = installments.reduce((s, i) => s + (i.amount ?? 0), 0)
        const sumRegular = regular.reduce((s, i) => s + (i.amount ?? 0), 0)

        return (
          <Dialog
            open={!!selected}
            onClose={() => setSelected(null)}
            title={`Fatura ${getBankMeta(selected.bank).label} — ${formatDate(selected.due_date)}`}
          >
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="font-mono font-semibold text-[#f05c6e]">{formatCurrency(selected.total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <div className="flex items-center gap-1.5">
                  <StatusIcon status={selected.status} />
                  <span>{statusLabel(selected.status)}</span>
                </div>
              </div>

              {regular.length > 0 && (
                <div className="border-t border-border pt-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Compras à vista</span>
                    <span className="font-mono text-xs text-muted-foreground">{formatCurrency(sumRegular)}</span>
                  </div>
                  {regular.map((item, i) => (
                    <div key={i} className="flex justify-between">
                      <span className="text-muted-foreground text-xs">{item.description}</span>
                      <span className="font-mono text-xs">{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>
              )}

              {installments.length > 0 && (
                <div className="border-t border-border pt-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Parcelamentos</span>
                    <span className="font-mono text-xs text-muted-foreground">{formatCurrency(sumInstallments)}</span>
                  </div>
                  {installments.map((item, i) => (
                    <div key={i} className="flex justify-between">
                      <span className="text-muted-foreground text-xs">{item.description}</span>
                      <span className="font-mono text-xs">{formatCurrency(item.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Dialog>
        )
      })()}
    </>
  )
}
