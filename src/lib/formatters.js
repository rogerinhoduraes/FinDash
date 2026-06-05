import { format, formatDistanceToNow, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { BANK_META, INVESTMENT_TYPE_PT, CATEGORY_PT } from './constants'
import { toNumber, mapValue } from './utils'

/**
 * Standard BRL currency formatter.
 */
export function formatCurrency(value, options = {}) {
  const v = toNumber(value)
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    ...options,
  }).format(v)
}

/**
 * Normalizes and formats a date from multiple sources (string, Date, Firebase Timestamp).
 */
export function formatDate(date, fmt = 'dd/MM/yyyy') {
  if (!date) return '—'
  const d = date?.toDate?.() ?? (typeof date === 'string' ? parseISO(date) : new Date(date))
  // date-fns format() throws "Invalid time value" on an unparseable date; an
  // unparseable value must never crash the render — fall back to a dash.
  if (!(d instanceof Date) || isNaN(d.getTime())) return '—'
  return format(d, fmt, { locale: ptBR })
}

/**
 * Relative time formatter (e.g., "há 2 horas").
 */
export function formatRelativeTime(date) {
  if (!date) return null
  const d = date?.toDate?.() ?? (typeof date === 'string' ? parseISO(date) : new Date(date))
  if (!(d instanceof Date) || isNaN(d.getTime())) return null
  return formatDistanceToNow(d, { locale: ptBR, addSuffix: true })
}

/**
 * Percentage formatter.
 */
export function formatPercent(value, decimals = 1) {
  return `${toNumber(value).toFixed(decimals)}%`
}

/**
 * Returns bank metadata (label, color, bg class) based on name detection.
 */
export function getBankMeta(bankName) {
  const key = (bankName ?? '').toLowerCase().replace(/\s+/g, '')
  if (BANK_META[key]) return BANK_META[key]
  
  // Fuzzy matching for known banks
  if (key.includes('nubank') || key.includes('nupagamentos') || key.includes('nufinanceira') || key.startsWith('nuco') || key === 'nu') return BANK_META['nubank']
  if (key.includes('santander')) return BANK_META['santander']
  if (key.includes('bancointer') || (key.includes('inter') && !key.includes('internet') && !key.includes('international'))) return BANK_META['inter']
  
  return { label: bankName ?? 'Banco', color: '#64748b', light: '#94a3b8', bg: 'bg-slate-500' }
}

export function getBankColor(bankName) {
  return getBankMeta(bankName).color
}

export function translateInvestmentType(type) {
  return mapValue(type, INVESTMENT_TYPE_PT)
}

export function translateCategory(cat) {
  return mapValue(cat, CATEGORY_PT)
}
