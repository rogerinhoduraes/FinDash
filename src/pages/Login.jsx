import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export default function Login() {
  const { user, signInGoogle, error } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) navigate('/')
  }, [user, navigate])

  async function handleGoogle() {
    setLoading(true)
    try { await signInGoogle() } finally { setLoading(false) }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'grid', placeItems: 'center',
      background: 'var(--bg)', padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 32 }}>

        {/* Brand */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <div className="brand-mark" style={{ width: 52, height: 52, borderRadius: 16, fontSize: 26 }}>₣</div>
          <div style={{ textAlign: 'center' }}>
            <div className="brand-name" style={{ fontSize: 26, justifyContent: 'center' }}>
              Fin<b>Dash</b>
            </div>
            <div className="eyebrow" style={{ marginTop: 6, letterSpacing: '.1em' }}>
              Suas finanças, em tempo real
            </div>
          </div>
        </div>

        {/* Card */}
        <div className="card" style={{ borderRadius: 'var(--r-xl)', padding: '28px 26px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, letterSpacing: '-.02em' }}>
              Entrar no FinDash
            </div>
            <div style={{ color: 'var(--text-faint)', fontSize: 13, marginTop: 4 }}>
              Use sua conta Google para acessar
            </div>
          </div>

          {error && (
            <div style={{
              background: 'var(--neg-dim)', border: '1px solid var(--neg)',
              borderRadius: 10, padding: '10px 13px',
              color: 'var(--neg)', fontSize: 13,
            }}>
              {error}
            </div>
          )}

          <button
            className="btn primary"
            onClick={handleGoogle}
            disabled={loading}
            style={{ width: '100%', padding: '12px 16px', fontSize: 14, borderRadius: 13, justifyContent: 'center', gap: 10 }}
          >
            {loading ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }}>
                <path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
                <path fill="currentColor" fillOpacity=".9" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" fillOpacity=".75" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" fillOpacity=".6" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" fillOpacity=".5" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            {loading ? 'Entrando…' : 'Continuar com Google'}
          </button>

          <div style={{ textAlign: 'center', color: 'var(--text-faint)', fontSize: 11.5 }}>
            Acesso restrito · apenas contas autorizadas
          </div>
        </div>

      </div>
    </div>
  )
}
