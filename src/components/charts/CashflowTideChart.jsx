import { useState, useEffect } from 'react'
import { formatCurrency } from '@/lib/formatters'
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

function useTip() {
  const [tip, setTip] = useState(null)
  const node = tip ? (
    <div className="tip" style={{ left: tip.x, top: tip.y }}>
      {tip.lbl && <div className="t-lbl">{tip.lbl}</div>}
      <div className="t-val" style={{ color: tip.color || 'var(--text)' }}>{tip.val}</div>
    </div>
  ) : null
  return [node, setTip]
}

export function CashflowTideChart({ transactions = [], height = 220 }) {
  const [draw, setDraw] = useState(0)
  const [tipNode, setTip] = useTip()
  useEffect(() => { const t = setTimeout(() => setDraw(1), 100); return () => clearTimeout(t) }, [])

  const now = new Date()
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(now, 5 - i)
    return {
      label: format(d, 'MMM', { locale: ptBR }),
      start: startOfMonth(d),
      end: endOfMonth(d),
    }
  })

  const data = months.map(({ label, start, end }) => {
    const monthTxs = transactions.filter((t) => {
      const dt = t.date ? parseISO(t.date) : null
      return dt && isWithinInterval(dt, { start, end })
    })
    const income  = monthTxs.filter((t) => (t.amount ?? 0) > 0).reduce((s, t) => s + Math.abs(t.amount), 0)
    const expense = monthTxs.filter((t) => (t.amount ?? 0) < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
    return { label, income, expense }
  })

  const maxV = Math.max(...data.map((d) => Math.max(d.income, d.expense)), 1) * 1.1
  const gap = 100 / data.length
  const bw = gap * 0.30

  const maxLabel = maxV > 1 ? formatCurrency(maxV / 1.1, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : ''

  return (
    <div style={{ position: 'relative', paddingLeft: 52 }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 48, bottom: 22, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-end', paddingRight: 6 }}>
        <span className="faint" style={{ fontSize: 10, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{maxLabel}</span>
        <span className="faint" style={{ fontSize: 10, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>0</span>
        <span className="faint" style={{ fontSize: 10, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{maxLabel}</span>
      </div>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" width="100%" height={height} style={{ overflow: 'visible' }}>
        <line x1="0" y1={height / 2} x2="100" y2={height / 2} stroke="var(--border-strong)" strokeWidth="0.3" vectorEffect="non-scaling-stroke" />
        {data.map(({ label, income, expense }, i) => {
          const xc = gap * i + gap / 2
          const ih = (income  / maxV) * (height / 2 - 8) * draw
          const eh = (expense / maxV) * (height / 2 - 8) * draw
          const net = income - expense
          const yr = new Date().getFullYear()
          const mIdx = (new Date().getMonth() - 5 + i + 12) % 12
          const yearHint = mIdx > new Date().getMonth() ? yr - 1 : yr
          return (
            <g key={i}
              onMouseMove={(e) => setTip({ x: e.clientX, y: e.clientY, lbl: `${label}/${yearHint} · saldo ${net >= 0 ? '+' : '−'}${formatCurrency(Math.abs(net))}`, val: `↑ ${formatCurrency(income)}   ↓ ${formatCurrency(expense)}`, color: net >= 0 ? 'var(--pos)' : 'var(--neg)' })}
              onMouseLeave={() => setTip(null)}
              style={{ cursor: 'pointer' }}
            >
              <rect x={xc - gap / 2} y="0" width={gap} height={height} fill="transparent" />
              <rect x={xc - bw / 2} y={height / 2 - ih} width={bw} height={ih} rx="1.4" fill="var(--pos)" style={{ transition: 'all .9s cubic-bezier(.3,.8,.3,1)' }} />
              <rect x={xc - bw / 2} y={height / 2} width={bw} height={eh} rx="1.4" fill="var(--neg)" style={{ transition: 'all .9s cubic-bezier(.3,.8,.3,1)' }} opacity="0.85" />
            </g>
          )
        })}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 6 }}>
        {data.map((d, i) => {
          const mIdx = (new Date().getMonth() - 5 + i + 12) % 12
          const yr = new Date().getFullYear()
          const yearHint = mIdx > new Date().getMonth() ? yr - 1 : yr
          return (
            <span key={i} className="faint" style={{ fontSize: 10, fontFamily: 'var(--font-mono)' }}>{d.label}/{String(yearHint).slice(2)}</span>
          )
        })}
      </div>
      {tipNode}
    </div>
  )
}
