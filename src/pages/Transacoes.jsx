import { useAuth } from '@/hooks/useAuth'
import { useTransactions } from '@/hooks/useTransactions'
import { TransactionsTable } from '@/components/tables/TransactionsTable'

export default function Transacoes() {
  const { user } = useAuth()
  const { transactions, loading } = useTransactions(user?.uid, { maxDocs: 500 })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Transações</h1>
        <p className="text-sm text-muted-foreground">{loading ? 'Carregando...' : `${transactions.length} transações`}</p>
      </div>
      <TransactionsTable transactions={transactions} loading={loading} />
    </div>
  )
}
