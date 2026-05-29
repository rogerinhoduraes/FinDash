import { useState, useEffect } from 'react'

export function RadialScore({ score, size = 168 }) {
  const [draw, setDraw] = useState(0)
  useEffect(() => { const t = setTimeout(() => setDraw(1), 150); return () => clearTimeout(t) }, [])

  const stroke = 12
  const r = (size - stroke) / 2
  const cx = size / 2, cy = size / 2
  const arc = 0.75
  const circ = 2 * Math.PI * r
  const dash = circ * arc
  const val = (score / 100) * dash * draw
  const color = score >= 75 ? 'var(--pos)' : score >= 50 ? 'var(--accent)' : 'var(--neg)'
  const label = score >= 75 ? 'Saudável' : score >= 50 ? 'Atenção' : 'Crítico'
  const displayScore = Math.round(score * draw)

  return (
    <div style={{ position: 'relative', display: 'grid', placeItems: 'center', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(135deg)' }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${val} ${circ}`} strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1.3s cubic-bezier(.3,.8,.3,1)', filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>
      <div style={{ position: 'absolute', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 44, fontWeight: 800, lineHeight: 1, color }}>
          {displayScore}
        </div>
        <div className="eyebrow" style={{ marginTop: 4, color }}>{label}</div>
      </div>
    </div>
  )
}
