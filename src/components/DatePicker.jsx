/**
 * DatePicker.jsx
 * ─────────────────────────────────────────────────────────────────
 * Custom themed date picker using CSS variables from index.css.
 * Colors follow whatever the super admin configures in System Branding.
 *
 * Key features:
 *   - Portal-rendered dropdown (works inside modals without clipping)
 *   - Infinite year navigation (prev/next decade buttons)
 *   - Responsive positioning (auto-flips if near bottom of viewport)
 *   - Click outside to close
 *   - Today shortcut button
 *
 * Usage:
 *   <DatePicker value="2026-06-01" onChange={setDate} />
 *   <DatePicker value={date} onChange={setDate} label="Start Date" />
 * ─────────────────────────────────────────────────────────────────
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}
function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay()
}
function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function toYMD(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export default function DatePicker({
  value = '',
  onChange,
  placeholder = 'Select date',
  label,
  className = '',
  disabled = false,
}) {
  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(() => value ? new Date(value + 'T00:00:00').getFullYear() : new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(() => value ? new Date(value + 'T00:00:00').getMonth() : new Date().getMonth())
  const [showYearPicker, setShowYearPicker] = useState(false)
  const [yearPageStart, setYearPageStart] = useState(() => {
    const y = value ? new Date(value + 'T00:00:00').getFullYear() : new Date().getFullYear()
    return Math.floor(y / 20) * 20
  })
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 280 })

  const triggerRef = useRef(null)
  const panelRef = useRef(null)

  // Position the dropdown relative to trigger
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const panelHeight = 360
    const spaceBelow = window.innerHeight - rect.bottom
    const goUp = spaceBelow < panelHeight && rect.top > panelHeight

    setDropPos({
      top: goUp ? rect.top - panelHeight - 4 + window.scrollY : rect.bottom + 6 + window.scrollY,
      left: Math.max(8, Math.min(rect.left + window.scrollX, window.innerWidth - 288)),
      width: 280,
    })
  }, [])

  // Close on click outside
  useEffect(() => {
    if (!open) return
    updatePosition()
    const handleClick = (e) => {
      if (triggerRef.current?.contains(e.target)) return
      if (panelRef.current?.contains(e.target)) return
      setOpen(false)
      setShowYearPicker(false)
    }
    const handleScroll = () => updatePosition()
    document.addEventListener('mousedown', handleClick)
    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [open, updatePosition])

  // Sync view to value
  useEffect(() => {
    if (value) {
      const d = new Date(value + 'T00:00:00')
      setViewYear(d.getFullYear())
      setViewMonth(d.getMonth())
    }
  }, [value])

  const today = new Date()
  const todayStr = toYMD(today.getFullYear(), today.getMonth(), today.getDate())
  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth)

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) } else setViewMonth(m => m - 1) }
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) } else setViewMonth(m => m + 1) }

  const selectDate = (day) => {
    onChange?.(toYMD(viewYear, viewMonth, day))
    setOpen(false)
    setShowYearPicker(false)
  }

  // Year range — 20 years per page with prev/next navigation
  const yearRange = Array.from({ length: 20 }, (_, i) => yearPageStart + i)

  // Calendar grid
  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const panel = open && createPortal(
    <div
      ref={panelRef}
      className="fixed z-[9999] bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl shadow-lg p-3 animate-fade-in"
      style={{ top: dropPos.top, left: dropPos.left, width: dropPos.width, position: 'absolute' }}
    >
      {showYearPicker ? (
        <div>
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={() => setYearPageStart(p => p - 20)}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[var(--color-bg-subtle)] transition text-[var(--color-text-secondary)]">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-semibold text-[var(--color-text-primary)]">{yearPageStart} — {yearPageStart + 19}</span>
            <button type="button" onClick={() => setYearPageStart(p => p + 20)}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[var(--color-bg-subtle)] transition text-[var(--color-text-secondary)]">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {yearRange.map(y => (
              <button key={y} type="button"
                onClick={() => { setViewYear(y); setShowYearPicker(false) }}
                className={`py-2 rounded-lg text-xs font-medium transition ${
                  y === viewYear ? 'bg-primary text-white'
                  : y === today.getFullYear() ? 'bg-primary/10 text-primary font-bold'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)]'
                }`}
              >{y}</button>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-[var(--color-border)] flex justify-center">
            <button type="button" onClick={() => setShowYearPicker(false)} className="text-[11px] font-medium text-primary hover:underline">Back to Calendar</button>
          </div>
        </div>
      ) : (
        <>
          {/* Month/Year header */}
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={prevMonth}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--color-bg-subtle)] transition text-[var(--color-text-secondary)]">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => { setYearPageStart(Math.floor(viewYear / 20) * 20); setShowYearPicker(true) }}
              className="text-sm font-semibold text-[var(--color-text-primary)] hover:text-primary transition px-2 py-1 rounded-lg hover:bg-primary/5">
              {MONTHS[viewMonth]} {viewYear}
            </button>
            <button type="button" onClick={nextMonth}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--color-bg-subtle)] transition text-[var(--color-text-secondary)]">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map(d => (
              <div key={d} className="text-center text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider py-1">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((day, idx) => {
              if (day === null) return <div key={`e-${idx}`} />
              const dateStr = toYMD(viewYear, viewMonth, day)
              const isSelected = dateStr === value
              const isToday = dateStr === todayStr
              return (
                <button key={day} type="button" onClick={() => selectDate(day)}
                  className={`w-full aspect-square flex items-center justify-center rounded-lg text-xs font-medium transition ${
                    isSelected ? 'bg-primary text-white shadow-sm'
                    : isToday ? 'bg-primary/10 text-primary font-bold'
                    : 'text-[var(--color-text-primary)] hover:bg-[var(--color-bg-subtle)]'
                  }`}
                >{day}</button>
              )
            })}
          </div>

          {/* Today shortcut */}
          <div className="mt-2 pt-2 border-t border-[var(--color-border)] flex justify-center">
            <button type="button"
              onClick={() => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); selectDate(today.getDate()) }}
              className="text-[11px] font-medium text-primary hover:underline">Today</button>
          </div>
        </>
      )}
    </div>,
    document.body
  )

  return (
    <div className={`relative ${className}`} ref={triggerRef}>
      {label && <label className="form-label">{label}</label>}
      <button
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) { setOpen(v => !v); setTimeout(updatePosition, 0) } }}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm border rounded-xl outline-none transition
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-[var(--color-border-strong)]'}
          ${open ? 'border-[var(--color-border-focus)] ring-2 ring-[var(--color-secondary-muted)]' : 'border-[var(--color-border)]'}
          bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)]`}
      >
        <span className={value ? '' : 'text-[var(--color-text-muted)]'}>{value ? formatDate(value) : placeholder}</span>
        <Calendar className="w-4 h-4 text-[var(--color-text-muted)] flex-shrink-0" />
      </button>
      {panel}
    </div>
  )
}