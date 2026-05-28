import { useAuth } from '@/hooks/useAuth'
import { useBills } from '@/hooks/useBills'
import { BillsTable } from '@/components/tables/BillsTable'
import { BillsLineChart } from '@/components/charts/BillsLineChart'

export default function Faturas() {
  const { user } = useAuth()
  const { bills, loading } = useBills(user?.uid)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Faturas</h1>
        <p className="text-sm text-muted-foreground">Clique em uma fatura para ver detalhes</p>
      </div>
      <BillsLineChart bills={bills} loading={loading} />
      <BillsTable bills={bills} loading={loading} />
    </div>
  )
}
