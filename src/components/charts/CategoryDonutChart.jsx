import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { formatCurrency, formatPercent } from '@/lib/formatters'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { useMemo } from 'react'
import { parseISO, isThisMonth } from 'date-fns'

const COLORS = [
  '#8a05be', '#ec0000', '#ff7a00', '#4fd9c8', '#f5b731',
  '#c8f564', '#6366f1', '#ec4899', '#14b8a6', '#f97316',
]

export function CategoryDonutChart({ transactions = [] }) {
  const data = useMemo(() => {
    const thisMonth = transactions.filter((t) => {
      if ((t.amount ?? 0) >= 0) return false
      const dt = t.date ? parseISO(t.date) : null
      return dt && isThisMonth(dt)
    })
    const map = {}
    thisMonth.forEach((t) => {
      const cat = t.category ?? 'Outros'
      map[cat] = (map[cat] ?? 0) + Math.abs(t.amount)
    })
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [transactions])

  const total = data.reduce((s, d) => s + d.value, 0)

  if (!data.length) {
    return (
      <Card>
        <CardHeader><CardTitle>Gastos por Categoria (mês atual)</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-center h-40 text-muted-foreground text-sm">
          Sem dados para o mês atual
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gastos por Categoria (mês atual)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart aria-label="Gráfico de rosca: distribuição por categoria">
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v, name) => [
                `${formatCurrency(v)} (${formatPercent((v / total) * 100)})`,
                name,
              ]}
              contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8 }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              formatter={(value, entry) => `${value} (${formatPercent((entry.payload.value / total) * 100)})`}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
