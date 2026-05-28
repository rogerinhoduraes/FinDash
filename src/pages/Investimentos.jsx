import { useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useInvestments } from '@/hooks/useInvestments'
import { InvestmentCard } from '@/components/cards/InvestmentCard'
import { InvestmentDonutChart } from '@/components/charts/InvestmentDonutChart'
import { KpiCard } from '@/components/cards/KpiCard'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatPercent } from '@/lib/formatters'
import { TrendingUp } from 'lucide-react'

export default function Investimentos() {
  const { user } = useAuth()
  const { investments, loading } = useInvestments(user?.uid)

  const active = investments.filter((i) => i.status !== 'REDEEMED' && i.status !== 'RESGATADO')
  const total = active.reduce((s, i) => s + (i.balance ?? i.value ?? 0), 0)

  const byType = useMemo(() => {
    const map = {}
    active.forEach((i) => {
      const k = i.type?.toUpperCase() ?? 'OUTROS'
      if (!map[k]) map[k] = []
      map[k].push(i)
    })
    return map
  }, [active])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Investimentos</h1>
        <p className="text-sm text-muted-foreground">{active.length} ativos</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard title="Total investido" value={total} icon={TrendingUp} loading={loading} />
        <InvestmentDonutChart investments={investments} />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm" aria-label="Tabela de investimentos">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Ticker</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Tipo</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground hidden sm:table-cell">Qtd</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Valor</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground hidden sm:table-cell">% carteira</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground hidden sm:table-cell">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}><td colSpan={6} className="p-2"><Skeleton className="h-10 w-full" /></td></tr>
              ))
            ) : investments.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-muted-foreground">
                  Nenhum investimento encontrado
                </td>
              </tr>
            ) : (
              investments.map((inv) => {
                const isActive = inv.status !== 'REDEEMED' && inv.status !== 'RESGATADO'
                const pct = total ? ((inv.balance ?? inv.value ?? 0) / total) * 100 : 0
                return (
                  <tr key={inv.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-mono font-semibold">{inv.ticker}</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="text-[10px]">{inv.type}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell text-muted-foreground">
                      {inv.quantity ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium text-[#4fd9c8]">
                      {formatCurrency(inv.balance ?? inv.value)}
                    </td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell text-muted-foreground">
                      {formatPercent(pct)}
                    </td>
                    <td className="px-4 py-3 text-center hidden sm:table-cell">
                      <Badge variant={isActive ? 'success' : 'secondary'} className="text-[10px]">
                        {isActive ? 'Ativo' : 'Resgatado'}
                      </Badge>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Cards by type */}
      {Object.keys(byType).length > 0 && (
        <div className="space-y-4">
          {Object.entries(byType).map(([type, items]) => (
            <section key={type}>
              <h2 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wide">{type}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((inv) => (
                  <InvestmentCard key={inv.id} investment={inv} totalPortfolio={total} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
