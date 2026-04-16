/**
 * UIComponents.jsx — CSHC Admin Portal
 * ─────────────────────────────────────────────────────────────────
 * Rev. 4 UI Cleanup:
 *  - All hardcoded bg-white/bg-gray-800 → var(--color-bg-card)
 *  - All border-gray-* / dark:border-gray-* → var(--color-border)
 *  - All text-gray-* / dark:text-gray-* → var(--color-text-*)
 *  - All bg-gray-50/100/700 → var(--color-bg-subtle) / var(--color-bg-muted)
 *  - shadow-2xl → var(--shadow-modal) on ConfirmDialog
 *  - backdrop-blur-sm removed from ConfirmDialog backdrop
 *  - SkeletonStatCard uses .stat-card token pattern
 *  - SkeletonTable uses token borders
 *  - PageSkeleton uses token backgrounds
 *  - Toasts use semantic token borders (--color-success-border etc.)
 *  - ConfirmDialog uses token-driven colors throughout
 *  - No gradients, no shadow-2xl, no hover:scale, no backdrop-blur
 * ─────────────────────────────────────────────────────────────────
 */
import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  FileText, Users, DollarSign, BarChart3, Search,
  AlertCircle, CheckCircle, XCircle, Info, X, Inbox
} from 'lucide-react'

// ─────────────────────────────────────────────────────
// MODAL PORTAL — renders children directly into document.body,
// escaping any scroll/overflow/stacking-context trap in the layout.
// Use this as the outermost wrapper for every modal backdrop.
// ─────────────────────────────────────────────────────────────────
export function ModalPortal({ children, open = true }) {
  if (!open) return null
  return createPortal(children, document.body)
}

// ─────────────────────────────────────────────────────
// PAGE WRAPPER  — wraps every page with enter animation
// ─────────────────────────────────────────────────────
export function PageWrapper({ children, className = '' }) {
  return (
    <div className={`page-enter ${className}`}>
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────
// SKELETON PRIMITIVES
// ─────────────────────────────────────────────────────
export function SkeletonLine({ width = 'w-full', height = 'h-4', className = '' }) {
  return <div className={`skeleton ${width} ${height} ${className}`} />
}

export function SkeletonAvatar({ size = 'w-9 h-9' }) {
  return <div className={`skeleton ${size} rounded-full flex-shrink-0`} />
}

// Single stat card skeleton
export function SkeletonStatCard() {
  return (
    <div
      className="rounded-[var(--radius-xl)] p-5 border-l-4"
      style={{
        backgroundColor: 'var(--color-bg-card)',
        borderColor: 'var(--color-border)',
        borderLeftColor: 'var(--color-border-strong)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <SkeletonLine width="w-1/3" height="h-3" className="mb-3" />
      <SkeletonLine width="w-1/2" height="h-8" className="mb-3" />
      <SkeletonLine width="w-2/3" height="h-3" />
    </div>
  )
}

// 4-column stats row
export function SkeletonStatsRow() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 stagger">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="animate-fade-in">
          <SkeletonStatCard />
        </div>
      ))}
    </div>
  )
}

// Table row skeleton
export function SkeletonTableRow({ cols = 7 }) {
  return (
    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
      <td className="px-4 py-3"><SkeletonLine width="w-24" height="h-4" /></td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <SkeletonAvatar />
          <div className="space-y-1.5 flex-1">
            <SkeletonLine width="w-28" height="h-3.5" />
            <SkeletonLine width="w-36" height="h-3" />
          </div>
        </div>
      </td>
      {[...Array(cols - 2)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <SkeletonLine width="w-20" height="h-4" />
        </td>
      ))}
    </tr>
  )
}

// Full table skeleton
export function SkeletonTable({ rows = 6, cols = 7 }) {
  return (
    <div className="card overflow-hidden animate-fade-in">
      <div
        className="px-5 py-4 border-b"
        style={{
          borderColor: 'var(--color-border)',
          backgroundColor: 'var(--color-bg-subtle)',
        }}
      >
        <SkeletonLine width="w-40" height="h-4" />
      </div>
      <table className="w-full">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-subtle)' }}>
            {[...Array(cols)].map((_, i) => (
              <th key={i} className="px-4 py-3 text-left">
                <SkeletonLine width="w-16" height="h-3" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...Array(rows)].map((_, i) => (
            <SkeletonTableRow key={i} cols={cols} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Full page skeleton (header + stats + filter bar + table)
export function PageSkeleton({ title = '' }) {
  return (
    <div className="animate-fade-in space-y-6">
      <div>
        {title
          ? <h1 className="text-display" style={{ color: 'var(--color-text-primary)' }}>{title}</h1>
          : <SkeletonLine width="w-48" height="h-8" className="mb-2" />
        }
        <SkeletonLine width="w-72" height="h-4" />
      </div>
      <SkeletonStatsRow />
      <div className="card p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <SkeletonLine key={i} height="h-10" />)}
        </div>
      </div>
      <SkeletonTable />
    </div>
  )
}


// Chart placeholder skeleton
export function SkeletonChart({ height = '300px' }) {
  return (
    <div className="card p-5 animate-fade-in">
      <SkeletonLine width="w-40" height="h-5" className="mb-4" />
      <div className="skeleton rounded-[var(--radius-lg)] w-full" style={{ height }} />
    </div>
  )
}

// Dashboard-specific skeleton (stat cards + charts)
export function SkeletonDashboard() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page title */}
      <div>
        <SkeletonLine width="w-56" height="h-8" className="mb-2" />
        <SkeletonLine width="w-80" height="h-4" />
      </div>
      {/* Stat cards */}
      <SkeletonStatsRow />
      {/* Analytics header */}
      <div className="card p-4 flex items-center justify-between">
        <SkeletonLine width="w-40" height="h-6" />
        <div className="flex gap-2">
          <SkeletonLine width="w-20" height="h-9" />
          <SkeletonLine width="w-20" height="h-9" />
        </div>
      </div>
      {/* Analytics summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="skeleton rounded-[var(--radius-xl)] h-28 animate-fade-in" />
        ))}
      </div>
      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 stagger">
        {[...Array(4)].map((_, i) => (
          <SkeletonChart key={i} />
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────
// EMPTY STATES
// ─────────────────────────────────────────────────────
const EMPTY_CONFIG = {
  enrollments: {
    icon: FileText,
    title: 'No enrollments found',
    iconColor: 'var(--color-warning)',
    bgStyle: { backgroundColor: 'var(--color-warning-light)' },
  },
  students: {
    icon: Users,
    title: 'No students found',
    iconColor: 'var(--color-info)',
    bgStyle: { backgroundColor: 'var(--color-info-light)' },
  },
  payments: {
    icon: DollarSign,
    title: 'No payment records found',
    iconColor: 'var(--color-success)',
    bgStyle: { backgroundColor: 'var(--color-success-light)' },
  },
  reports: {
    icon: BarChart3,
    title: 'No data available',
    iconColor: '#7c3aed',
    bgStyle: { backgroundColor: 'rgba(124, 58, 237, 0.08)' },
  },
  search: {
    icon: Search,
    title: 'No results match',
    iconColor: 'var(--color-text-muted)',
    bgStyle: { backgroundColor: 'var(--color-bg-muted)' },
  },
  default: {
    icon: Inbox,
    title: 'Nothing here yet',
    iconColor: 'var(--color-text-muted)',
    bgStyle: { backgroundColor: 'var(--color-bg-muted)' },
  },
}

export function EmptyState({ type = 'default', message, onClear, clearLabel = 'Clear filters' }) {
  const cfg = EMPTY_CONFIG[type] || EMPTY_CONFIG.default
  const Icon = cfg.icon
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 animate-fade-in">
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
        style={cfg.bgStyle}
      >
        <Icon className="w-9 h-9" style={{ color: cfg.iconColor }} />
      </div>
      <h3
        className="text-base font-semibold mb-2 text-center"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {cfg.title}
      </h3>
      <p
        className="text-sm text-center max-w-xs leading-relaxed mb-5"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {message || 'Try adjusting your search or filter criteria.'}
      </p>
      {onClear && (
        <button
          onClick={onClear}
          className="btn btn-primary"
        >
          {clearLabel}
        </button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────
// TOAST SYSTEM
// ─────────────────────────────────────────────────────
const TOAST_CFG = {
  success: {
    icon: CheckCircle,
    iconColor: 'var(--color-success)',
    borderColor: 'var(--color-success-border)',
  },
  error: {
    icon: XCircle,
    iconColor: 'var(--color-error)',
    borderColor: 'var(--color-error-border)',
  },
  warning: {
    icon: AlertCircle,
    iconColor: 'var(--color-warning)',
    borderColor: 'var(--color-warning-border)',
  },
  info: {
    icon: Info,
    iconColor: 'var(--color-info)',
    borderColor: 'var(--color-info-border)',
  },
}

function SingleToast({ id, type = 'success', message, onRemove }) {
  const [leaving, setLeaving] = useState(false)
  const cfg = TOAST_CFG[type] || TOAST_CFG.info
  const Icon = cfg.icon

  const dismiss = useCallback(() => {
    setLeaving(true)
    setTimeout(() => onRemove(id), 280)
  }, [id, onRemove])

  useEffect(() => {
    const t = setTimeout(dismiss, 3800)
    return () => clearTimeout(t)
  }, [dismiss])

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-[var(--radius-xl)] max-w-xs w-full
        ${leaving ? 'toast-out' : 'toast-in'}`}
      style={{
        backgroundColor: 'var(--color-bg-card)',
        border: `1px solid ${cfg.borderColor}`,
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: cfg.iconColor }} />
      <p className="text-sm font-medium flex-1 leading-snug" style={{ color: 'var(--color-text-primary)' }}>
        {message}
      </p>
      <button
        onClick={dismiss}
        className="flex-shrink-0 mt-0.5 transition-colors"
        style={{ color: 'var(--color-text-muted)' }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--color-text-secondary)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-muted)'}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

export function ToastContainer({ toasts, onRemove }) {
  return (
    <div className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-[10000] flex flex-col-reverse gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto">
          <SingleToast {...t} onRemove={onRemove} />
        </div>
      ))}
    </div>
  )
}

export function useToast() {
  const [toasts, setToasts] = useState([])
  const addToast = useCallback((message, type = 'success') => {
    setToasts(prev => [...prev, { id: Date.now() + Math.random(), message, type }])
  }, [])
  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])
  return { toasts, addToast, removeToast }
}

// ─────────────────────────────────────────────────────
// CONFIRM DIALOG  — replaces window.confirm()
// ─────────────────────────────────────────────────────
export function ConfirmDialog({
  open, title, message,
  onConfirm, onCancel,
  confirmLabel = 'Confirm',
  danger = false,
  loading = false,
}) {
  useEffect(() => {
    if (open) document.body.classList.add('modal-open')
    else document.body.classList.remove('modal-open')
    return () => document.body.classList.remove('modal-open')
  }, [open])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 animate-fade-in">
      {/* Backdrop — no backdrop-blur */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(0,0,0,0.50)' }}
        onClick={onCancel}
      />
      {/* Panel */}
      <div
        className="relative rounded-[var(--radius-2xl)] p-6 w-full max-w-sm animate-scale-in"
        style={{
          backgroundColor: 'var(--color-bg-card)',
          boxShadow: 'var(--shadow-modal)',
        }}
      >
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center mb-4 mx-auto"
          style={{
            backgroundColor: danger ? 'var(--color-error-light)' : 'var(--color-warning-light)',
          }}
        >
          <AlertCircle
            className="w-7 h-7"
            style={{ color: danger ? 'var(--color-error)' : 'var(--color-warning)' }}
          />
        </div>
        <h3
          className="text-lg font-bold text-center mb-2"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {title}
        </h3>
        <p
          className="text-sm text-center leading-relaxed mb-6"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {message}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="btn btn-ghost flex-1 py-2.5"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 px-4 py-2.5 rounded-[var(--radius-md)] text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2
              ${danger
                ? 'bg-[var(--color-error)] hover:bg-red-700 disabled:opacity-50'
                : 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50'
              }`}
          >
            {loading && (
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─────────────────────────────────────────────────────
// LOADING BUTTON
// ─────────────────────────────────────────────────────
export function LoadingButton({ loading, children, className = '', ...props }) {
  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      className={`flex items-center justify-center gap-2 transition-all duration-200
        disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
    >
      {loading && (
        <svg className="animate-spin w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      )}
      {children}
    </button>
  )
}

// ─────────────────────────────────────────────────────
// EXPORT BUTTON
// Standard green export-to-Excel button used across all pages.
//
// Props
// ─────
//   onClick    fn       export handler
//   label      string   button text  (default: 'Export')
//   size       string   'sm' | 'md'  (default: 'md')
//   className  string   extra classes
//
// Usage (filter bar, replaces inline button):
//   <ExportButton onClick={handleExport} />
//
// Usage (compact, inside tight grids):
//   <ExportButton onClick={handleExport} size="sm" label="Export Excel" />
// ─────────────────────────────────────────────────────
export function ExportButton({ onClick, label = 'Export', size = 'md', className = '', disabled = false }) {
  const sizecls = size === 'sm'
    ? 'px-3 py-2 text-xs gap-1.5'
    : 'px-4 py-2 text-sm gap-1.5'

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center font-medium whitespace-nowrap
        rounded-[var(--radius-md)] transition-colors
        disabled:opacity-50 disabled:cursor-not-allowed
        ${sizecls} ${className}`}
      style={{
        backgroundColor: 'var(--color-success)',
        color: '#ffffff',
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.backgroundColor = '#15803d' }}
      onMouseLeave={e => { if (!disabled) e.currentTarget.style.backgroundColor = 'var(--color-success)' }}
    >
      {/* Download icon — inline SVG so no lucide import needed in UIComponents */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className={size === 'sm' ? 'w-3.5 h-3.5 flex-shrink-0' : 'w-4 h-4 flex-shrink-0'}
        viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      {label}
    </button>
  )
}