import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { formatCurrency } from '@/lib/formatters'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { useMemo } from 'react'
import { format, subMonths, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function CashFlowBarChart({ transactions = [] }) {
  const data = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(now, 5 - i)
      const start = startOfMonth(d)
      const end = endOfMonth(d)
      const monthTxs = transactions.filter((t) => {
        const dt = t.date ? parseISO(t.date) : null
        return dt && isWithinInterval(dt, { start, end })
      })
      const entradas = monthTxs.filter((t) => (t.amount ?? 0) > 0).reduce((s, t) => s + t.amount, 0)
      const saidas = Math.abs(monthTxs.filter((t) => (t.amount ?? 0) < 0).reduce((s, t) => s + t.amount, 0))
      return { month: format(d, 'MMM/yy', { locale: ptBR }), Entradas: entradas, Saídas: saidas }
    })
  }, [transactions])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Entradas vs Saídas (6 meses)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} aria-label="Gráfico de barras: entradas e saídas mensais">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
            <YAxis tickFormatter={(v) => `R$${v / 1000}k`} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
            <Tooltip
              formatter={(v, name) => [formatCurrency(v), name]}
              contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8 }}
              labelStyle={{ color: 'var(--foreground)' }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Entradas" fill="#4fd9c8" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Saídas"   fill="#f05c6e" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
