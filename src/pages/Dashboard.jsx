import { useAuth } from '@/hooks/useAuth'
import { useAccounts } from '@/hooks/useAccounts'
import { useTransactions } from '@/hooks/useTransactions'
import { useBills } from '@/hooks/useBills'
import { useInvestments } from '@/hooks/useInvestments'
import { KpiCard } from '@/components/cards/KpiCard'
import { BillsLineChart } from '@/components/charts/BillsLineChart'
import { CashFlowBarChart } from '@/components/charts/CashFlowBarChart'
import { CategoryDonutChart } from '@/components/charts/CategoryDonutChart'
import { Wallet, CreditCard, BarChart3, TrendingUp } from 'lucide-react'
import { useMemo } from 'react'
import { motion } from 'framer-motion'

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }
const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } }

export default function Dashboard() {
  const { user } = useAuth()
  const uid = user?.uid
  const { accounts, loading: aLoading } = useAccounts(uid)
  const { transactions, loading: tLoading } = useTransactions(uid, { maxDocs: 5000 })
  const { bills, loading: bLoading } = useBills(uid)
  const { investments, loading: iLoading } = useInvestments(uid)

  const kpis = useMemo(() => {
    const checkingBalance = accounts
      .filter((a) => a.account_type !== 'CREDIT')
      .reduce((s, a) => s + (a.balance ?? 0), 0)

    const cardDebt = accounts
      .filter((a) => a.account_type === 'CREDIT')
      .reduce((s, a) => s + Math.abs(Math.min(0, a.balance ?? 0)), 0)

    const availableLimit = accounts
      .filter((a) => a.account_type === 'CREDIT')
      .reduce((s, a) => s + (a.available_limit ?? 0), 0)

    const totalInvested = investments
      .filter((i) => i.status !== 'REDEEMED' && i.status !== 'RESGATADO')
      .reduce((s, i) => s + (i.balance ?? i.value ?? 0), 0)

    return { checkingBalance, cardDebt, availableLimit, totalInvested }
  }, [accounts, investments])

  const anyLoading = aLoading || tLoading || bLoading || iLoading

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão geral das suas finanças</p>
      </div>

      {/* KPI Cards */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 gap-4 lg:grid-cols-4"
      >
        <motion.div variants={fadeUp}>
          <KpiCard
            title="Saldo em conta"
            value={kpis.checkingBalance}
            icon={Wallet}
            loading={aLoading}
          />
        </motion.div>
        <motion.div variants={fadeUp}>
          <KpiCard
            title="Dívida em cartões"
            value={kpis.cardDebt}
            icon={CreditCard}
            loading={aLoading}
            negative
          />
        </motion.div>
        <motion.div variants={fadeUp}>
          <KpiCard
            title="Limite disponível"
            value={kpis.availableLimit}
            icon={BarChart3}
            loading={aLoading}
          />
        </motion.div>
        <motion.div variants={fadeUp}>
          <KpiCard
            title="Total investido"
            value={kpis.totalInvested}
            icon={TrendingUp}
            loading={iLoading}
          />
        </motion.div>
      </motion.div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <BillsLineChart bills={bills} loading={bLoading} />
        <CashFlowBarChart transactions={transactions} loading={tLoading} />
      </div>

      {/* Charts row 2 */}
      <CategoryDonutChart transactions={transactions} loading={tLoading} />
    </div>
  )
}
