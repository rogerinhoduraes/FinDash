import { useAuth } from '@/hooks/useAuth'
import { useAccounts } from '@/hooks/useAccounts'
import { AccountCard, AccountCardSkeleton } from '@/components/cards/AccountCard'
import { motion } from 'framer-motion'

export default function Contas() {
  const { user } = useAuth()
  const { accounts, loading } = useAccounts(user?.uid)

  const checking = accounts.filter((a) => a.account_type !== 'CREDIT')
  const credit   = accounts.filter((a) => a.account_type === 'CREDIT')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Contas</h1>
        <p className="text-sm text-muted-foreground">Saldos e limites em tempo real</p>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => <AccountCardSkeleton key={i} />)}
        </div>
      ) : (
        <>
          {checking.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Contas correntes / poupança
              </h2>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              >
                {checking.map((acc) => (
                  <AccountCard key={acc.id} account={acc} />
                ))}
              </motion.div>
            </section>
          )}

          {credit.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Cartões de crédito
              </h2>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              >
                {credit.map((acc) => (
                  <AccountCard key={acc.id} account={acc} />
                ))}
              </motion.div>
            </section>
          )}

          {accounts.length === 0 && (
            <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-border text-muted-foreground">
              Nenhuma conta encontrada. Aguarde a próxima sincronização do ETL.
            </div>
          )}
        </>
      )}
    </div>
  )
}
