import { cn } from '@/lib/utils'

export function Card({ className, children, ...props }) {
  return (
    <div
      className={cn('rounded-xl border border-border bg-card p-6 shadow-sm', className)}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ className, children, ...props }) {
  return <div className={cn('mb-4 flex items-center justify-between', className)} {...props}>{children}</div>
}

export function CardTitle({ className, children, ...props }) {
  return <h3 className={cn('text-sm font-medium text-muted-foreground', className)} {...props}>{children}</h3>
}

export function CardContent({ className, children, ...props }) {
  return <div className={cn(className)} {...props}>{children}</div>
}
