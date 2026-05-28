import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { formatCurrency, getBankColor } from '@/lib/formatters'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { useMemo } from 'react'
import { format, parseISO, subMonths, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const BANKS = ['Nubank', 'Santander', 'Inter']

export function BillsLineChart({ bills = [], loading }) {
  const data = useMemo(() => {
    const now = new Date()
    const months = Array.from({ length: 12 }, (_, i) => {
      const d = subMonths(now, 11 - i)
      return { month: format(d, 'MMM/yy', { locale: ptBR }), date: startOfMonth(d) }
    })

    return months.map(({ month, date }) => {
      const row = { month }
      BANKS.forEach((bank) => {
        const bill = bills.find(
          (b) =>
            b.bank?.toLowerCase() === bank.toLowerCase() &&
            b.due_date &&
            format(parseISO(b.due_date), 'yyyy-MM') === format(date, 'yyyy-MM')
        )
        row[bank] = bill ? Math.abs(bill.total ?? 0) : 0
      })
      return row
    })
  }, [bills])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evolução das Faturas (12 meses)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data} aria-label="Gráfico de linha: evolução das faturas por banco">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
            <YAxis tickFormatter={(v) => `R$${v / 1000}k`} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
            <Tooltip
              formatter={(v, name) => [formatCurrency(v), name]}
              contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8 }}
              labelStyle={{ color: 'var(--foreground)' }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {BANKS.map((bank) => (
              <Line
                key={bank}
                type="monotone"
                dataKey={bank}
                stroke={getBankColor(bank)}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
