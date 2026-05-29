import { useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useInvestments } from '@/hooks/useInvestments'
import { formatCurrency, translateInvestmentType } from '@/lib/formatters'
import { DonutChart } from '@/components/charts/DonutChart'
import useFinanceStore from '@/store/useFinanceStore'

const INACTIVE = ['REDEEMED','RESGATADO','TOTAL_WITHDRAWAL','PARTIAL_WITHDRAWAL']

const CLS_COLOR = {
  'FII':           'var(--nubank)',
  'Tesouro Direto':'var(--accent)',
  'Renda Fixa':    'var(--pos)',
  'CDB':           'var(--pos)',
  'LCI':           'var(--pos)',
  'LCA':           'var(--pos)',
  'Ações':         'var(--santander)',
  'ETF':           'var(--santander)',
  'Outros':        'var(--inter)',
  'Fundo de Investimento': 'var(--inter)',
  'Criptomoedas':  'var(--warn)',
}
function clsColor(type) { return CLS_COLOR[type] || 'var(--text-faint)' }

function Sk({ w = '100%', h = 16, r = 8 }) {
  return <div className="sk" style={{ width: w, height: h, borderRadius: r }} />
}

export default function Investimentos() {
  const { user } = useAuth()
  const { investments, loading } = useInvestments(user?.uid)
  const { privacyMode } = useFinanceStore()
  const [filter, setFilter] = useState('all')

  const active = investments.filter((i) => !INACTIVE.includes(i.status))
  const total = active.reduce((s, i) => s + (i.balance ?? i.value ?? 0), 0)

  const byClass = useMemo(() => {
    const map = {}
    active.forEach((i) => {
      const k = translateInvestmentType(i.type) ?? 'Outros'
      map[k] = (map[k] || 0) + (i.balance ?? i.value ?? 0)
    })
    return map
  }, [active])

  const donutData = Object.entries(byClass)
    .map(([label, value]) => ({ label, value, color: clsColor(label) }))
    .sort((a, b) => b.value - a.value)

  const classes = Object.keys(byClass)
  const shown = filter === 'all' ? investments : investments.filter((i) => translateInvestmentType(i.type) === filter)

  if (loading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.6fr)', gap: 18 }}>
        <Sk w="100%" h={300} r={22} />
        <Sk w="100%" h={300} r={22} />
      </div>
    )
  }

  if (!loading && active.length === 0) {
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
    <div className="stagger" style={{ display: 'grid', gap: 18 }}>
      <div className="g-inv">
        {/* Donut */}
        <div className="card" style={{ display: 'grid', placeItems: 'center', alignContent: 'center' }}>
          <DonutChart
            data={donutData}
            size={210}
            centerLabel="Carteira total"
            centerValue={<span className={'money ' + (privacyMode ? 'blurred' : '')}>{formatCurrency(total)}</span>}
          />
          <div style={{ display: 'grid', gap: 8, marginTop: 22, width: '100%' }}>
            {donutData.map((d) => (
              <div key={d.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="bank-dot" style={{ background: d.color, borderRadius: 3 }} />{d.label}
                </span>
                <span className="mono muted" style={{ whiteSpace: 'nowrap', fontSize: 12 }}>
                  {((d.value / (total || 1)) * 100).toFixed(0)}% · <span className={'money ' + (privacyMode ? 'blurred' : '')}>{formatCurrency(d.value)}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
              <div>
                <div className="eyebrow">Valor total</div>
                <span className={'money ' + (privacyMode ? 'blurred' : '')} style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-display)', whiteSpace: 'nowrap' }}>{formatCurrency(total)}</span>
              </div>
              <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 22 }}>
                <div className="eyebrow">Posições ativas</div>
                <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-display)' }}>{active.length}</div>
              </div>
            </div>
          </div>

          <div className="tab-row" style={{ display: 'inline-flex', marginBottom: 6 }}>
            <div className={'tab' + (filter === 'all' ? ' active' : '')} onClick={() => setFilter('all')}>Tudo</div>
            {classes.map((c) => (
              <div key={c} className={'tab' + (filter === c ? ' active' : '')} onClick={() => setFilter(c)}>{c}</div>
            ))}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="tbl" style={{ marginTop: 8 }}>
              <thead>
                <tr>
                  <th>Ativo</th><th>Tipo</th><th className="num">Qtd.</th><th className="num">Valor</th><th className="num">% carteira</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {shown.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-faint)' }}>Nenhum ativo encontrado</td></tr>
                ) : shown.map((inv) => {
                  const isActive = !INACTIVE.includes(inv.status)
                  const val = inv.balance ?? inv.value ?? 0
                  const pct = isActive && total ? (val / total) * 100 : 0
                  const type = translateInvestmentType(inv.type)
                  return (
                    <tr key={inv.id} style={{ opacity: isActive ? 1 : 0.5 }}>
                      <td style={{ fontWeight: 600 }}>{inv.ticker}</td>
                      <td><span className="cat"><span className="bank-dot" style={{ background: clsColor(type) }} />{type}</span></td>
                      <td className="num mono faint">{inv.quantity ?? '—'}</td>
                      <td className="num"><span className={'money ' + (privacyMode ? 'blurred' : '')} style={{ fontWeight: 600 }}>{formatCurrency(val)}</span></td>
                      <td className="num mono faint">{isActive ? pct.toFixed(1) + '%' : '—'}</td>
                      <td><span className={'badge-st ' + (isActive ? 'paid' : 'open')}>{isActive ? 'Ativo' : 'Resgatado'}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
