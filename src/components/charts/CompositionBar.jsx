import { useState, useEffect } from 'react'
import { formatCurrency } from '@/lib/formatters'
import useFinanceStore from '@/store/useFinanceStore'

export function CompositionBar({ segments = [] }) {
  const [draw, setDraw] = useState(0)
  const { privacyMode } = useFinanceStore()
  useEffect(() => { const t = setTimeout(() => setDraw(1), 120); return () => clearTimeout(t) }, [])

  const total = segments.reduce((a, s) => a + s.value, 0) || 1
  return (
    <div>
      <div style={{ display: 'flex', height: 14, borderRadius: 99, overflow: 'hidden', background: 'var(--surface-3)', gap: 2 }}>
        {segments.map((s, i) => (
          <div key={i} title={s.label}
            style={{ width: `${(s.value / total) * 100 * draw}%`, background: s.color, transition: 'width 1s cubic-bezier(.3,.8,.3,1)' }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 18, marginTop: 14, flexWrap: 'wrap' }}>
        {segments.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="bank-dot" style={{ background: s.color, borderRadius: 3 }} />
            <div>
              <div className="faint" style={{ fontSize: 11 }}>{s.label}</div>
              <div className={'money' + (privacyMode ? ' blurred' : '')} style={{ fontSize: 14, fontWeight: 600 }}>{formatCurrency(s.value)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
