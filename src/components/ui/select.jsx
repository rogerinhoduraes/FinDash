import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'

export function Select({ value, onChange, options = [], placeholder = 'Selecionar...', className }) {
  return (
    <div className="relative">
      <select
        value={value ?? ''}
        onChange={(e) => onChange?.(e.target.value || null)}
        className={cn(
          'h-9 w-full appearance-none rounded-lg border border-border bg-background px-3 pr-8 text-sm',
          'focus:outline-none focus:ring-2 focus:ring-ring',
          className
        )}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-2.5 h-4 w-4 text-muted-foreground" />
    </div>
  )
}
