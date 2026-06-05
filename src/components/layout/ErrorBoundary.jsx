import { Component } from 'react'

/**
 * Catches render/runtime errors in the page subtree so a single broken page
 * degrades to an inline message instead of white-screening the whole app.
 * Keyed by route (see AppLayout) so navigating away clears the error.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Page render error:', error, info?.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="card p-8 grid gap-4 max-w-xl mx-auto mt-10 text-center">
          <div style={{ fontSize: 28 }}>⚠️</div>
          <div>
            <h2 className="font-bold text-lg">Algo quebrou nesta página</h2>
            <p className="text-sm text-muted-foreground mt-1">
              O restante do app continua funcionando. Detalhe técnico abaixo.
            </p>
          </div>
          <pre className="text-[11px] text-left whitespace-pre-wrap break-words bg-[var(--surface-2)] border border-[var(--border)] rounded-lg p-3 max-h-48 overflow-auto">
            {String(this.state.error?.message ?? this.state.error)}
          </pre>
          <button className="btn primary justify-self-center px-5" onClick={() => window.location.reload()}>
            Recarregar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
