import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, getBankMeta } from '@/lib/formatters'
import { cn } from '@/lib/utils'

export function AccountCard({ account, loading }) {
  if (loading) {
    return (
      <Card className="space-y-3">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-2 w-full" />
      </Card>
    )
  }

  const { bank_name, balance, limit, available_limit, account_type, status } = account
  const meta = getBankMeta(bank_name)
  const isCard = account_type === 'CREDIT'
  const usedPct = limit ? ((limit - (available_limit ?? limit)) / limit) * 100 : 0

  return (
    <Card className="relative overflow-hidden">
      {/* Bank color strip */}
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl" style={{ backgroundColor: meta.color }} />

      <div className="pl-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{meta.label}</p>
            <p className="text-xs text-muted-foreground capitalize">{account_type?.toLowerCase() ?? 'conta'}</p>
          </div>
          <Badge
            variant={status === 'ACTIVE' ? 'success' : 'secondary'}
            className="text-[10px]"
          >
            {status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
          </Badge>
        </div>

        <div>
          <p className="text-xs text-muted-foreground mb-1">
            {isCard ? 'Fatura atual' : 'Saldo disponível'}
          </p>
          <p
            className={cn(
              'font-mono text-2xl font-bold',
              balance < 0 ? 'text-[#f05c6e]' : 'text-foreground'
            )}
          >
            {formatCurrency(isCard ? Math.abs(balance) : balance)}
          </p>
        </div>

        {isCard && limit && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Limite utilizado</span>
              <span>{formatCurrency(available_limit ?? limit)} disponível</span>
            </div>
            <Progress
              value={usedPct}
              barClassName={usedPct > 80 ? 'bg-[#f05c6e]' : usedPct > 60 ? 'bg-[#f5b731]' : 'bg-[#4fd9c8]'}
            />
            <p className="text-xs text-muted-foreground text-right">
              Limite total: {formatCurrency(limit)}
            </p>
          </div>
        )}
      </div>
    </Card>
  )
}

export function AccountCardSkeleton() {
  return <AccountCard loading />
}
