// src/components/UIComponents.jsx
import { useState, useEffect, useCallback } from 'react'
import {
  FileText, Users, DollarSign, BarChart3, Search,
  AlertCircle, CheckCircle, XCircle, Info, X, Inbox
} from 'lucide-react'

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
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border-l-4 border-gray-200 dark:border-gray-700 shadow">
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
    <tr className="border-b border-gray-100 dark:border-gray-700">
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
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden animate-fade-in">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/40">
        <SkeletonLine width="w-40" height="h-4" />
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
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
          ? <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-1">{title}</h1>
          : <SkeletonLine width="w-48" height="h-8" className="mb-2" />
        }
        <SkeletonLine width="w-72" height="h-4" />
      </div>
      <SkeletonStatsRow />
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <SkeletonLine key={i} height="h-10" />)}
        </div>
      </div>
      <SkeletonTable />
    </div>
  )
}

// ─────────────────────────────────────────────────────
// EMPTY STATES
// ─────────────────────────────────────────────────────
const EMPTY_CONFIG = {
  enrollments: { icon: FileText,  title: 'No enrollments found',      iconClass: 'text-yellow-400', bgClass: 'bg-yellow-50 dark:bg-yellow-900/20' },
  students:    { icon: Users,     title: 'No students found',         iconClass: 'text-blue-400',   bgClass: 'bg-blue-50 dark:bg-blue-900/20'   },
  payments:    { icon: DollarSign,title: 'No payment records found',  iconClass: 'text-green-400',  bgClass: 'bg-green-50 dark:bg-green-900/20' },
  reports:     { icon: BarChart3, title: 'No data available',         iconClass: 'text-purple-400', bgClass: 'bg-purple-50 dark:bg-purple-900/20'},
  search:      { icon: Search,    title: 'No results match',          iconClass: 'text-gray-400',   bgClass: 'bg-gray-100 dark:bg-gray-700/50'  },
  default:     { icon: Inbox,     title: 'Nothing here yet',          iconClass: 'text-gray-400',   bgClass: 'bg-gray-100 dark:bg-gray-700/50'  },
}

export function EmptyState({ type = 'default', message, onClear, clearLabel = 'Clear filters' }) {
  const cfg = EMPTY_CONFIG[type] || EMPTY_CONFIG.default
  const Icon = cfg.icon
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 animate-fade-in">
      <div className={`w-20 h-20 rounded-full ${cfg.bgClass} flex items-center justify-center mb-5`}>
        <Icon className={`w-9 h-9 ${cfg.iconClass}`} />
      </div>
      <h3 className="text-base font-semibold text-gray-700 dark:text-gray-200 mb-2 text-center">
        {cfg.title}
      </h3>
      <p className="text-sm text-gray-400 dark:text-gray-500 text-center max-w-xs leading-relaxed mb-5">
        {message || 'Try adjusting your search or filter criteria.'}
      </p>
      {onClear && (
        <button
          onClick={onClear}
          className="px-5 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-accent-burgundy transition-colors active:scale-95"
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
  success: { icon: CheckCircle, wrap: 'bg-white dark:bg-gray-800 border border-green-200 dark:border-green-700',  iconCls: 'text-green-500', textCls: 'text-gray-800 dark:text-white' },
  error:   { icon: XCircle,     wrap: 'bg-white dark:bg-gray-800 border border-red-200 dark:border-red-700',    iconCls: 'text-red-500',   textCls: 'text-gray-800 dark:text-white' },
  warning: { icon: AlertCircle, wrap: 'bg-white dark:bg-gray-800 border border-yellow-200 dark:border-yellow-700', iconCls: 'text-yellow-500',textCls: 'text-gray-800 dark:text-white' },
  info:    { icon: Info,        wrap: 'bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700',  iconCls: 'text-blue-500',  textCls: 'text-gray-800 dark:text-white' },
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
      className={`flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg max-w-xs w-full
        ${cfg.wrap} ${leaving ? 'toast-out' : 'toast-in'}`}
    >
      <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${cfg.iconCls}`} />
      <p className={`text-sm font-medium flex-1 leading-snug ${cfg.textCls}`}>{message}</p>
      <button onClick={dismiss} className="flex-shrink-0 text-gray-300 hover:text-gray-500 dark:hover:text-gray-400 transition-colors mt-0.5">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

export function ToastContainer({ toasts, onRemove }) {
  return (
    <div className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-[9999] flex flex-col-reverse gap-2 pointer-events-none">
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
  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 w-full max-w-sm animate-scale-in">
        <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 mx-auto
          ${danger ? 'bg-red-100 dark:bg-red-900/30' : 'bg-amber-100 dark:bg-amber-900/30'}`}>
          <AlertCircle className={`w-7 h-7 ${danger ? 'text-red-500' : 'text-amber-500'}`} />
        </div>
        <h3 className="text-lg font-bold text-gray-800 dark:text-white text-center mb-2">{title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center leading-relaxed mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2
              ${danger
                ? 'bg-red-500 hover:bg-red-600 disabled:bg-red-300'
                : 'bg-primary hover:bg-accent-burgundy disabled:bg-primary/60'
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
    </div>
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