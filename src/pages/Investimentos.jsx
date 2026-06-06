import { useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useInvestments } from '@/hooks/useInvestments'
import { translateInvestmentType, getBankMeta } from '@/lib/formatters'
import { DonutChart } from '@/components/charts/DonutChart'
import useFinanceStore from '@/store/useFinanceStore'
import { Money } from '@/components/ui/Money'
import { BankDot } from '@/components/ui/BankDot'
import { Skeleton } from '@/components/ui/skeleton'
import { SectionHead } from '@/components/ui/SectionHead'
import { INVESTMENT_CLS_COLOR as CLS_COLOR, INVESTMENT_INACTIVE_STATUS as INACTIVE } from '@/lib/constants'

function clsColor(type) { return CLS_COLOR[type] || 'var(--text-faint)' }

function BankSection({ bankName, investments, total, typeFilter }) {
  const meta = getBankMeta(bankName)
  const visible = investments.filter((i) =>
    !INACTIVE.includes(i.status) || Math.abs(Number(i.balance ?? i.value ?? 0)) >= 0.005
  )
  const shown = (typeFilter === 'all' ? visible : visible.filter((i) => translateInvestmentType(i.type) === typeFilter))
  const bankTotal = investments
    .filter((i) => !INACTIVE.includes(i.status))
    .reduce((s, i) => s + (i.balance ?? i.value ?? 0), 0)

  if (shown.length === 0) return null

  return (
    <div style={{ marginBottom: 8 }}>
      {/* Bank header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', borderRadius: '12px 12px 0 0',
        background: 'var(--surface-2)', borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <BankDot bank={bankName} size={11} />
          <span style={{ fontWeight: 700, fontSize: 14 }}>{meta.label}</span>
          <span className="faint" style={{ fontSize: 12 }}>{shown.length} ativo{shown.length !== 1 ? 's' : ''}</span>
        </div>
        <Money value={bankTotal} style={{ fontWeight: 700, fontSize: 15 }} />
      </div>

      {/* Investments table for this bank */}
      <div style={{ overflowX: 'auto', borderRadius: '0 0 12px 12px', border: '1px solid var(--border)', borderTop: 'none' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Ativo</th><th>Tipo</th><th className="num">Qtd.</th>
              <th className="num">Valor</th><th className="num">% carteira</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((inv) => {
              const isActive = !INACTIVE.includes(inv.status)
              const val = inv.balance ?? inv.value ?? 0
              const pct = isActive && total ? (val / total) * 100 : 0
              const type = translateInvestmentType(inv.type)
              return (
                <tr key={inv.id} style={{ opacity: isActive ? 1 : 0.45 }}>
                  <td style={{ fontWeight: 600 }}>{inv.ticker || inv.name || '—'}</td>
                  <td>
                    <span className="cat">
                      <span className="bank-dot" style={{ background: clsColor(type) }} />
                      {type}
                    </span>
                  </td>
                  <td className="num mono faint">{inv.quantity ?? '—'}</td>
                  <td className="num">
                    <Money value={val} style={{ fontWeight: 600 }} />
                  </td>
                  <td className="num mono faint">{isActive ? pct.toFixed(1) + '%' : '—'}</td>
                  <td><span className={'badge-st ' + (isActive ? 'paid' : 'open')}>{isActive ? 'Ativo' : 'Resgatado'}</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function Investimentos() {
  const { user } = useAuth()
  const { investments, loading } = useInvestments(user?.uid)
  const { privacyMode } = useFinanceStore()
  const [typeFilter, setTypeFilter] = useState('all')
  const [bankFilter, setBankFilter] = useState('all')

  const active = useMemo(() => investments.filter((i) => !INACTIVE.includes(i.status)), [investments])
  const total  = useMemo(() => active.reduce((s, i) => s + (i.balance ?? i.value ?? 0), 0), [active])

  // All unique banks that have active investments
  const banks = useMemo(() => {
    const seen = new Set()
    active.forEach((i) => { if (i.bank) seen.add(i.bank) })
    return [...seen].sort()
  }, [active])

  // All unique classes across active investments
  const classes = useMemo(() => {
    const seen = new Set()
    active.forEach((i) => seen.add(translateInvestmentType(i.type) ?? 'Outros'))
    return [...seen].sort()
  }, [active])

  // Donut data — always full portfolio, by class
  const donutData = useMemo(() => {
    const map = {}
    active.forEach((i) => {
      const k = translateInvestmentType(i.type) ?? 'Outros'
      map[k] = (map[k] || 0) + (i.balance ?? i.value ?? 0)
    })
    return Object.entries(map)
      .map(([label, value]) => ({ label, value, color: clsColor(label) }))
      .sort((a, b) => b.value - a.value)
  }, [active])

  // Investments filtered by bank selector
  const bankFiltered = useMemo(() =>
    bankFilter === 'all' ? investments : investments.filter((i) => i.bank === bankFilter),
    [investments, bankFilter]
  )

  // Group bank-filtered investments by bank for display
  const byBank = useMemo(() => {
    const map = {}
    bankFiltered.forEach((i) => {
      const key = i.bank || 'Outros'
      if (!map[key]) map[key] = []
      map[key].push(i)
    })
    return Object.entries(map).sort((a, b) => {
      const ta = a[1].filter(i => !INACTIVE.includes(i.status)).reduce((s, i) => s + (i.balance ?? i.value ?? 0), 0)
      const tb = b[1].filter(i => !INACTIVE.includes(i.status)).reduce((s, i) => s + (i.balance ?? i.value ?? 0), 0)
      return tb - ta
    })
  }, [bankFiltered])

  if (loading) {
    return (
      <div className="fade-in grid gap-[22px]">
        <Skeleton className="h-[44px] w-[40%] rounded-[10px]" />
        <div className="g-inv">
          <Skeleton className="h-[300px] w-full rounded-[22px]" />
          <Skeleton className="h-[300px] w-full rounded-[22px]" />
        </div>
      </div>
    )
  }

  if (active.length === 0) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: 320 }}>
        <div style={{ textAlign: 'center', maxWidth: 380 }}>
          <div style={{ width: 56, height: 56, borderRadius: 18, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'grid', placeItems: 'center', margin: '0 auto 18px' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--text-faint)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ width: 26, height: 26 }}>
              <path d="M4 19V5M4 19h16"/><path d="M8 16l3.5-4 3 2.5L20 7"/>
            </svg>
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, fontFamily: 'var(--font-display)', marginBottom: 8 }}>Nenhum ativo encontrado</div>
          <div className="faint" style={{ fontSize: 13.5, lineHeight: 1.6 }}>
            Seus investimentos aparecem aqui automaticamente via Open Finance.<br />
            Certifique-se de que suas contas de investimento estão conectadas e sincronizadas pelo pipeline ETL.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fade-in grid gap-[22px]">
      <SectionHead title="Meus Investimentos" sub={`${active.length} ativos em carteira`} />
      
      <div className="g-inv">
        {/* Donut — composição por classe */}
        <div className="card" style={{ display: 'grid', placeItems: 'center', alignContent: 'center' }}>
          <DonutChart
            data={donutData}
            size={210}
            centerLabel="Carteira total"
            centerValue={<Money value={total} />}
          />
          <div style={{ display: 'grid', gap: 8, marginTop: 22, width: '100%' }}>
            {donutData.map((d) => (
              <div key={d.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="bank-dot" style={{ background: d.color, borderRadius: 3 }} />{d.label}
                </span>
                <span className="mono muted" style={{ whiteSpace: 'nowrap', fontSize: 12 }}>
                  {((d.value / (total || 1)) * 100).toFixed(0)}% · <Money value={d.value} />
                </span>
              </div>
            ))}
          </div>

          {/* Totais por banco */}
          {banks.length > 1 && (
            <div style={{ width: '100%', marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--border)', display: 'grid', gap: 8 }}>
              <div className="eyebrow" style={{ marginBottom: 4 }}>Por banco</div>
              {banks.map((b) => {
                const meta = getBankMeta(b)
                const bTotal = active.filter(i => i.bank === b).reduce((s, i) => s + (i.balance ?? i.value ?? 0), 0)
                return (
                  <div key={b} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <BankDot bank={b} />{meta.label}
                    </span>
                    <Money value={bTotal} style={{ fontSize: 12 }} className="muted" />
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Tabela com filtros */}
        <div className="card">
          {/* Totais */}
          <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', marginBottom: 18 }}>
            <div>
              <div className="eyebrow">Valor total</div>
              <Money value={total} style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-display)', whiteSpace: 'nowrap' }} />
            </div>
            <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 22 }}>
              <div className="eyebrow">Posições ativas</div>
              <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-display)' }}>{active.length}</div>
            </div>
            <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 22 }}>
              <div className="eyebrow">Bancos</div>
              <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-display)' }}>{banks.length}</div>
            </div>
          </div>

          {/* Filtro por banco */}
          {banks.length > 1 && (
            <div className="tab-row" style={{ display: 'inline-flex', marginBottom: 10 }}>
              <button type="button" className={'tab' + (bankFilter === 'all' ? ' active' : '')} onClick={() => setBankFilter('all')}>Todos</button>
              {banks.map((b) => {
                const meta = getBankMeta(b)
                return (
                  <button type="button" key={b} className={'tab' + (bankFilter === b ? ' active' : '')} onClick={() => setBankFilter(b)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <BankDot bank={b} size={7} />
                    {meta.label}
                  </button>
                )
              })}
            </div>
          )}

          {/* Filtro por classe */}
          <div className="tab-row" style={{ display: 'inline-flex', marginBottom: 16 }}>
            <button type="button" className={'tab' + (typeFilter === 'all' ? ' active' : '')} onClick={() => setTypeFilter('all')}>Tudo</button>
            {classes.map((c) => (
              <button type="button" key={c} className={'tab' + (typeFilter === c ? ' active' : '')} onClick={() => setTypeFilter(c)}>{c}</button>
            ))}
          </div>

          {/* Seções por banco */}
          {byBank.map(([bankName, invs]) => (
            <BankSection
              key={bankName}
              bankName={bankName}
              investments={invs}
              total={total}
              typeFilter={typeFilter}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
