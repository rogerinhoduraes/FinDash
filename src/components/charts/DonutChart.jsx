import { useState, useEffect } from 'react'
import { formatCurrency } from '@/lib/formatters'

function useTip() {
  const [tip, setTip] = useState(null)
  const node = tip ? (
    <div className="tip" style={{ left: tip.x, top: tip.y }}>
      {tip.lbl && <div className="t-lbl">{tip.lbl}</div>}
      <div className="t-val" style={{ color: tip.color }}>{tip.val}</div>
    </div>
  ) : null
  return [node, setTip]
}

export function DonutChart({ data = [], size = 200, thickness = 26, centerLabel, centerValue }) {
  const [tipNode, setTip] = useTip()
  const [hover, setHover] = useState(null)
  const [draw, setDraw] = useState(0)
  useEffect(() => { const t = setTimeout(() => setDraw(1), 80); return () => clearTimeout(t) }, [])

  const total = data.reduce((a, d) => a + d.value, 0) || 1
  const r = (size - thickness) / 2
  const cx = size / 2, cy = size / 2
  const circ = 2 * Math.PI * r
  let offset = 0
  const segs = data.map((d) => {
    const frac = d.value / total
    const len = frac * circ
    const s = { ...d, frac, dash: len, off: offset }
    offset += len
    return s
  })

  return (
    <div style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {segs.map((s, i) => {
          const active = hover === i
          return (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none"
              stroke={s.color} strokeWidth={active ? thickness + 5 : thickness}
              strokeDasharray={`${s.dash * draw} ${circ}`}
              strokeDashoffset={-s.off * draw}
              style={{ transition: 'stroke-dasharray 1s cubic-bezier(.3,.8,.3,1),stroke-width .2s', cursor: 'pointer', opacity: hover === null || active ? 1 : 0.4 }}
              strokeLinecap="butt"
              onMouseMove={(e) => { setHover(i); setTip({ x: e.clientX, y: e.clientY, lbl: s.label, val: formatCurrency(s.value) + ` · ${(s.frac * 100).toFixed(0)}%`, color: s.color }) }}
              onMouseLeave={() => { setHover(null); setTip(null) }}
            />
          )
        })}
      </svg>
      <div style={{ position: 'absolute', textAlign: 'center' }}>
        <div className="eyebrow" style={{ marginBottom: 4 }}>{centerLabel}</div>
        <div className="money" style={{ fontSize: 22, fontWeight: 700 }}>{centerValue}</div>
      </div>
      {tipNode}
    </div>
  )
}
