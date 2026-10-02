/**
 * ErrorBoundary.jsx — keeps one broken page from blanking the whole app.
 *
 * Without a boundary, any error thrown while rendering (for example one
 * malformed record in localStorage) unmounts the entire React tree and the
 * user is left staring at a white screen with no way back. With it, only the
 * page content is replaced by a friendly message; the sidebar and header stay
 * usable, so the user can navigate away or reload.
 *
 * Usage (App.jsx wraps every routed page):
 *   <ErrorBoundary resetKey={location.pathname}>…page…</ErrorBoundary>
 *
 * `resetKey` — when it changes (the user navigated to another page) the
 * boundary clears itself and tries to render again.
 *
 * Error boundaries must be class components — React has no hook equivalent.
 */
import { Component } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Dev console only — nothing sensitive is shown to the user
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary]', error, info?.componentStack)
    }
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="page-enter flex items-center justify-center py-10 px-4">
        <div className="card-section w-full max-w-md p-6 text-center">
          <div
            className="mx-auto mb-4 w-12 h-12 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'var(--color-error-light)', color: 'var(--color-error)' }}
          >
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
            This page ran into a problem
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-2">
            Something unexpected happened while loading this page. Your data has
            not been changed. Try reloading, or go back to the dashboard.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center mt-5">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="btn btn-primary gap-1.5"
            >
              <RefreshCw className="w-4 h-4" /> Reload page
            </button>
            <a href="/dashboard" className="btn btn-ghost gap-1.5">
              <Home className="w-4 h-4" /> Go to dashboard
            </a>
          </div>
        </div>
      </div>
    )
  }
}
