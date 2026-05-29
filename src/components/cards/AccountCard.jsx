import { getBankMeta, formatCurrency, formatDate } from '@/lib/formatters'
import useFinanceStore from '@/store/useFinanceStore'

export function AccountCard({ account }) {
  const { privacyMode } = useFinanceStore()
  const { bank_name, balance, limit, available_limit, account_type, name } = account
  const meta = getBankMeta(bank_name)
  const isCredit = account_type === 'CREDIT'
  const usedPct = limit ? Math.min(100, ((limit - (available_limit ?? limit)) / limit) * 100) : 0
  const limitColor = usedPct > 80 ? 'var(--negative)' : usedPct > 60 ? 'var(--warning)' : 'var(--positive)'

  const displayValue = privacyMode ? '••.•••,••' : formatCurrency(Math.abs(balance ?? 0))

  return (
    <div
      className="snap-start flex-shrink-0 flex flex-col"
      style={{
        width: 240,
        background: 'var(--bg-surface)',
        border: '0.5px solid var(--border)',
        borderRadius: 'var(--radius-xl)',
        padding: '20px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Top color strip */}
      <div
        style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          height: 3, background: meta.color,
          borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
        }}
      />

      {/* Bank name */}
      <div className="flex items-center justify-between mt-1">
        <span
          className="text-[11px] font-semibold uppercase tracking-widest"
          style={{ color: meta.color }}
        >
          {meta.label}
        </span>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded-full"
          style={{
            background: meta.color + '18',
            color: meta.color,
            fontWeight: 500,
          }}
        >
          {isCredit ? 'Crédito' : 'Conta'}
        </span>
      </div>

      {/* Account name */}
      {name && (
        <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--text-hint)' }}>
          {name}
        </p>
      )}

      {/* Balance */}
      <p
        className="font-mono mt-4 text-[22px] font-bold"
        style={{ color: 'var(--text-primary)' }}
      >
        {displayValue}
      </p>

      {/* Credit: progress bar */}
      {isCredit && limit ? (
        <div className="mt-4 space-y-2">
          <div
            className="h-1.5 rounded-full overflow-hidden"
            style={{ background: 'var(--bg-input)' }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${usedPct}%`, background: limitColor }}
            />
          </div>
          <div className="flex justify-between">
            <span className="text-[10px]" style={{ color: 'var(--text-hint)' }}>
              {privacyMode ? '••%' : `${usedPct.toFixed(1)}% usado`}
            </span>
            <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
              {privacyMode ? 'R$ ••' : formatCurrency(available_limit ?? 0)} disp.
            </span>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <span className="text-[11px]" style={{ color: 'var(--text-hint)' }}>
            Saldo disponível
          </span>
        </div>
      )}
    </div>
  )
}

export function AccountCardSkeleton() {
  return (
    <div
      className="snap-start flex-shrink-0"
      style={{ width: 220, height: 148, borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}
    >
      <div className="skeleton w-full h-full" />
    </div>
  )
}
