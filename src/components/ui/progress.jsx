import { cn } from '@/lib/utils'

export function Progress({ value = 0, className, barClassName, ...props }) {
  const pct = Math.min(100, Math.max(0, value))
  return (
    <div className={cn('relative h-2 w-full overflow-hidden rounded-full bg-secondary', className)} {...props}>
      <div
        className={cn('h-full rounded-full bg-primary transition-all duration-500', barClassName)}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
