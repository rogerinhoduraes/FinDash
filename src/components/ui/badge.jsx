import { cn } from '@/lib/utils'

const variants = {
  default:  'bg-primary/20 text-primary border border-primary/30',
  success:  'bg-[#4fd9c8]/20 text-[#4fd9c8] border border-[#4fd9c8]/30',
  danger:   'bg-[#f05c6e]/20 text-[#f05c6e] border border-[#f05c6e]/30',
  warning:  'bg-[#f5b731]/20 text-[#f5b731] border border-[#f5b731]/30',
  nubank:   'bg-[#8a05be]/20 text-[#c77dff] border border-[#8a05be]/30',
  santander:'bg-[#ec0000]/20 text-[#ff7676] border border-[#ec0000]/30',
  inter:    'bg-[#ff7a00]/20 text-[#ffb369] border border-[#ff7a00]/30',
  secondary:'bg-secondary text-secondary-foreground',
}

export function Badge({ className, variant = 'default', children, ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-medium',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}
