import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatPercent } from '@/lib/formatters'
import { cn } from '@/lib/utils'

const TYPE_COLORS = {
  FII:    { label: 'FII',     variant: 'success' },
  TESOURO:{ label: 'Tesouro', variant: 'default' },
  CDB:    { label: 'CDB',     variant: 'warning' },
  ACAO:   { label: 'Ação',    variant: 'nubank' },
}

export function InvestmentCard({ investment, totalPortfolio }) {
  const { ticker, type, quantity, value, balance, status } = investment
  const meta = TYPE_COLORS[type?.toUpperCase()] ?? { label: type, variant: 'secondary' }
  const pct = totalPortfolio ? (balance / totalPortfolio) * 100 : 0
  const INACTIVE = ['REDEEMED', 'RESGATADO', 'TOTAL_WITHDRAWAL', 'PARTIAL_WITHDRAWAL']
  const isActive = !INACTIVE.includes(status)

  return (
    <Card className={cn('space-y-2', !isActive && 'opacity-60')}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold">{ticker}</span>
          <Badge variant={meta.variant} className="text-[10px]">{meta.label}</Badge>
        </div>
        <Badge variant={isActive ? 'success' : 'secondary'} className="text-[10px]">
          {isActive ? 'Ativo' : 'Resgatado'}
        </Badge>
      </div>

      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Saldo atual</p>
          <p className="font-mono text-xl font-bold text-[#4fd9c8]">
            {formatCurrency(balance ?? value)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">% carteira</p>
          <p className="font-mono text-sm font-semibold">{formatPercent(pct)}</p>
        </div>
      </div>

      {quantity && (
        <p className="text-xs text-muted-foreground">
          {quantity} {quantity === 1 ? 'cota' : 'cotas'} · {formatCurrency(value)} p/ cota
        </p>
      )}
    </Card>
  )
}
