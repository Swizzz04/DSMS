/**
 * StatusPage.jsx — shared layout for full-page states (404, offline, …).
 *
 * One look for every "something is not as expected" screen: an icon badge,
 * an optional large code, a title, a message, optional detail and actions.
 * Tokens only — it follows light/dark and never depends on the school's
 * brand colours.
 *
 * tone: 'neutral' | 'warning' | 'error'
 */
const TONES = {
  neutral: {
    bg: 'var(--color-bg-subtle)',
    fg: 'var(--color-text-secondary)',
    border: 'var(--color-border)',
  },
  warning: {
    bg: 'var(--color-warning-light)',
    fg: 'var(--color-warning-text)',
    border: 'var(--color-warning-border)',
  },
  error: {
    bg: 'var(--color-error-light)',
    fg: 'var(--color-error-text)',
    border: 'var(--color-error-border)',
  },
}

export default function StatusPage({
  icon: Icon,
  code,
  title,
  message,
  tone = 'neutral',
  detail,
  children,
  fullScreen = false,
}) {
  const t = TONES[tone] || TONES.neutral

  const card = (
    <div className="page-enter card-section w-full max-w-md p-6 sm:p-8 text-center">
      {Icon && (
        <div
          className="mx-auto mb-4 w-14 h-14 rounded-full flex items-center justify-center border"
          style={{ backgroundColor: t.bg, color: t.fg, borderColor: t.border }}
          aria-hidden="true"
        >
          <Icon className="w-7 h-7" />
        </div>
      )}

      {code && (
        <p
          className="text-6xl sm:text-7xl font-extrabold tracking-tight leading-none mb-2 text-[var(--color-text-muted)]"
          aria-hidden="true"
        >
          {code}
        </p>
      )}

      <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">{title}</h1>
      {message && (
        <p className="text-sm text-[var(--color-text-muted)] mt-2">{message}</p>
      )}

      {detail && (
        <p
          className="mt-4 mx-auto max-w-full rounded-lg border px-3 py-2 text-xs font-mono break-all text-[var(--color-text-secondary)] bg-[var(--color-bg-subtle)] border-[var(--color-border)]"
        >
          {detail}
        </p>
      )}

      {children && (
        <div className="flex flex-col sm:flex-row gap-2 justify-center mt-6">{children}</div>
      )}
    </div>
  )

  if (fullScreen) {
    return (
      <div className="min-h-dvh flex items-center justify-center px-4 py-10 bg-[var(--color-bg-page)]">
        {card}
      </div>
    )
  }
  return <div className="flex items-center justify-center py-8 sm:py-12 px-1">{card}</div>
}
