import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { formatCurrency, formatPercent, translateInvestmentType } from '@/lib/formatters'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { useMemo } from 'react'

const CLASS_COLORS = {
  'FII':            '#4fd9c8',
  'Ações':          '#f05c6e',
  'CDB':            '#8a05be',
  'Tesouro Direto': '#f5b731',
  'Renda Fixa':     '#f5b731',
  'LCI':            '#22c55e',
  'LCA':            '#10b981',
  'ETF':            '#60a5fa',
  'Fundo de Investimento': '#a78bfa',
  'Outros':         '#64748b',
}

export function InvestmentDonutChart({ investments = [] }) {
  const data = useMemo(() => {
    const map = {}
    investments
      .filter((i) => i.status !== 'REDEEMED' && i.status !== 'RESGATADO')
      .forEach((i) => {
        const cls = translateInvestmentType(i.type) ?? 'Outros'
        map[cls] = (map[cls] ?? 0) + (i.balance ?? i.value ?? 0)
      })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [investments])

  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <Card>
      <CardHeader><CardTitle>Distribuição por Classe</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <PieChart aria-label="Distribuição dos investimentos por classe de ativo">
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={CLASS_COLORS[entry.name] ?? '#6366f1'} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v) => [formatCurrency(v), '']}
              contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8 }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              formatter={(value, entry) =>
                `${value} — ${formatPercent(total ? (entry.payload.value / total) * 100 : 0)}`
              }
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
