import { TrendingUp, TrendingDown } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'

export function KpiCard({ title, value, icon: Icon, trend, trendLabel, loading, className, negative }) {
  if (loading) {
    return (
      <Card className={cn('space-y-3', className)}>
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-3 w-1/3" />
      </Card>
    )
  }

  const isPositive = typeof trend === 'number' ? trend >= 0 : !negative
  const TrendIcon = trend >= 0 ? TrendingUp : TrendingDown

  return (
    <Card className={cn('group relative overflow-hidden', className)}>
      {/* Background decoration */}
      <div className="absolute -right-4 -top-4 opacity-5 transition-opacity group-hover:opacity-10">
        {Icon && <Icon className="h-24 w-24" />}
      </div>

      <div className="relative space-y-2">
        <div className="flex items-center gap-2">
          {Icon && (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="h-4 w-4 text-primary" />
            </div>
          )}
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
        </div>

        <p
          className={cn(
            'font-mono text-2xl font-bold tracking-tight',
            negative && value < 0 ? 'text-[#f05c6e]' : 'text-foreground'
          )}
        >
          {formatCurrency(value)}
        </p>

        {trendLabel && (
          <div className={cn('flex items-center gap-1 text-xs', isPositive ? 'text-[#4fd9c8]' : 'text-[#f05c6e]')}>
            <TrendIcon className="h-3 w-3" />
            <span>{trendLabel}</span>
          </div>
        )}
      </div>
    </Card>
  )
}
