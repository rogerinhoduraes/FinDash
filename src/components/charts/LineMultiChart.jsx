import { useState, useEffect } from 'react'
import { formatCurrency } from '@/lib/formatters'

function useTip() {
  const [tip, setTip] = useState(null)
  const node = tip ? (
    <div className="tip" style={{ left: tip.x, top: tip.y }}>
      {tip.lbl && <div className="t-lbl">{tip.lbl}</div>}
      <div className="t-val">{tip.val}</div>
    </div>
  ) : null
  return [node, setTip]
}

export function LineMultiChart({ series = [], months = [], height = 230 }) {
  const [draw, setDraw] = useState(0)
  const [hoverX, setHoverX] = useState(null)
  const [tipNode, setTip] = useTip()
  useEffect(() => { const t = setTimeout(() => setDraw(1), 100); return () => clearTimeout(t) }, [])

  if (!series.length || !months.length) return null

  const all = series.flatMap((s) => s.data)
  const maxV = Math.max(...all, 1) * 1.12
  const H = height
  const px = (i) => (i / (months.length - 1)) * 100
  const py = (v) => H - (v / maxV) * (H - 16) - 4
  const pathFor = (data) => data.map((v, i) => `${i === 0 ? 'M' : 'L'} ${px(i)} ${py(v)}`).join(' ')

  return (
    <div style={{ position: 'relative' }}>
      <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" width="100%" height={H} style={{ overflow: 'visible' }}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const fx = (e.clientX - rect.left) / rect.width
          const idx = Math.max(0, Math.min(months.length - 1, Math.round(fx * (months.length - 1))))
          setHoverX(idx)
          setTip({
            x: e.clientX, y: rect.top + 12,
            lbl: months[idx],
            val: series.map((s) => `${s.label}: ${formatCurrency(s.data[idx])}`).join('   '),
          })
        }}
        onMouseLeave={() => { setHoverX(null); setTip(null) }}
      >
        {[0.25, 0.5, 0.75].map((g) => (
          <line key={g} x1="0" y1={H * g} x2="100" y2={H * g} stroke="var(--border)" strokeWidth="0.25" vectorEffect="non-scaling-stroke" />
        ))}
        {hoverX !== null && (
          <line x1={px(hoverX)} y1="0" x2={px(hoverX)} y2={H} stroke="var(--border-strong)" strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
        )}
        {series.map((s, si) => (
          <g key={si}>
            <path d={pathFor(s.data)} fill="none" stroke={s.color} strokeWidth="2" vectorEffect="non-scaling-stroke"
              strokeLinejoin="round" strokeLinecap="round"
              style={{ strokeDasharray: 1000, strokeDashoffset: 1000 * (1 - draw), transition: `stroke-dashoffset 1.1s ease ${si * 0.12}s` }}
            />
            {hoverX !== null && (
              <circle cx={px(hoverX)} cy={py(s.data[hoverX])} r="3.4" fill="var(--surface)" stroke={s.color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
            )}
          </g>
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        {months.map((m, i) => (
          <span key={i} className="faint" style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)' }}>{m}</span>
        ))}
      </div>
      {tipNode}
    </div>
  )
}
