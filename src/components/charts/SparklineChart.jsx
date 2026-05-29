import { useMemo } from 'react'

export function Sparkline({ data = [], color = 'var(--accent)', width = 240, height = 36 }) {
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const px = (i) => (i / (data.length - 1)) * width
  const py = (v) => height - ((v - min) / range) * (height - 4) - 2
  const line = data.map((v, i) => `${i === 0 ? 'M' : 'L'} ${px(i)} ${py(v)}`).join(' ')
  const area = `${line} L ${width} ${height} L 0 ${height} Z`
  const gid = useMemo(() => 'sg' + Math.random().toString(36).slice(2, 7), [])

  return (
    <svg width={width} height={height} style={{ display: 'block', width: '100%' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
