import { format, formatDistanceToNow, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function formatCurrency(value, options = {}) {
  const v = typeof value === 'string' ? parseFloat(value) : (value ?? 0)
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    ...options,
  }).format(v)
}

export function formatDate(date, fmt = 'dd/MM/yyyy') {
  if (!date) return '—'
  const d = typeof date === 'string' ? parseISO(date) : date?.toDate?.() ?? new Date(date)
  return format(d, fmt, { locale: ptBR })
}

export function formatRelativeTime(date) {
  if (!date) return null
  const d = date?.toDate?.() ?? (typeof date === 'string' ? parseISO(date) : new Date(date))
  return formatDistanceToNow(d, { locale: ptBR, addSuffix: true })
}

export function formatPercent(value, decimals = 1) {
  return `${(value ?? 0).toFixed(decimals)}%`
}

const BANK_META = {
  nubank:   { label: 'Nubank',   color: '#8a05be', light: '#c77dff', bg: 'bg-[#8a05be]' },
  santander:{ label: 'Santander',color: '#ec0000', light: '#ff7676', bg: 'bg-[#ec0000]' },
  inter:    { label: 'Inter',    color: '#ff7a00', light: '#ffb369', bg: 'bg-[#ff7a00]' },
}

export function getBankMeta(bankName) {
  const key = (bankName ?? '').toLowerCase().replace(/\s+/g, '')
  return BANK_META[key] ?? { label: bankName ?? 'Banco', color: '#64748b', light: '#94a3b8', bg: 'bg-slate-500' }
}

export function getBankColor(bankName) {
  return getBankMeta(bankName).color
}

export function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}
