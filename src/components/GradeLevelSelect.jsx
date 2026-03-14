/**
 * GradeLevelSelect — shared across Enrollments, Students, Payments
 *
 * Renders a grouped dropdown (via portal so it's never clipped by table
 * stacking contexts) that shows only the grade levels available at the
 * currently-selected campus:
 *
 *   All Campuses  → Basic Ed groups (Pre-Elem / Elem / JHS / SHS)
 *                   + college programs from every campus that hasCollege
 *
 *   Specific campus → same Basic Ed groups (every campus has Pre-Elem → SHS)
 *                     + that campus's college programs only (or none for Bohol)
 *
 * Props
 * ─────
 *   value        string   current selected value  ('all' | grade string)
 *   onChange     fn       called with new value
 *   campusFilter string   global campus key ('all' | 'Talisay' | …)
 *   userRole     string   hides college for registrar_basic,
 *                         hides basicEd for registrar_college
 */

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, X } from 'lucide-react'
import { useAppConfig } from '../context/AppConfigContext'

export default function GradeLevelSelect({ value, onChange, campusFilter = 'all', userRole = 'admin' }) {
  const { activeCampuses, basicEdGroups, campusProgramsMap } = useAppConfig()
  const [open, setOpen]       = useState(false)
  const [dropPos, setDropPos] = useState({})
  const triggerRef = useRef(null)
  const panelRef   = useRef(null)

  const isBasicOnly   = userRole === 'registrar_basic'
  const isCollegeOnly = userRole === 'registrar_college'

  // ── Build grouped options based on campusFilter ──────────────────
  const groups = []

  // Basic Ed groups — shown unless role is college-only
  if (!isCollegeOnly) {
    ;(basicEdGroups || []).forEach(g => groups.push(g))
  }

  // College programs — shown unless role is basic-only
  if (!isBasicOnly) {
    if (campusFilter === 'all') {
      // Merge programs from every campus that has a college dept
      const allPrograms = [
        ...new Set(
          activeCampuses
            .filter(c => c.hasCollege && (campusProgramsMap?.[c.key]?.length ?? 0) > 0)
            .flatMap(c => campusProgramsMap[c.key])
        ),
      ]
      if (allPrograms.length > 0) {
        groups.push({ label: 'College (All Campuses)', options: allPrograms })
      }
    } else {
      const campus = activeCampuses.find(c => c.key === campusFilter)
      if (campus?.hasCollege) {
        const programs = campusProgramsMap?.[campusFilter] ?? []
        if (programs.length > 0) {
          groups.push({ label: `College — ${campus.name}`, options: programs })
        }
      }
    }
  }

  // Flatten for search / display
  const allOptions = groups.flatMap(g => g.options)
  const selectedLabel = value === 'all' ? 'All Grades' : value

  // ── Position panel under trigger ────────────────────────────────
  const openDropdown = () => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setDropPos({
      top:   rect.bottom + window.scrollY + 4,
      left:  rect.left   + window.scrollX,
      width: rect.width,
    })
    setOpen(true)
  }

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (
        panelRef.current  && !panelRef.current.contains(e.target) &&
        triggerRef.current && !triggerRef.current.contains(e.target)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const select = (val) => { onChange(val); setOpen(false) }

  // ── Trigger button ───────────────────────────────────────────────
  const trigger = (
    <button
      ref={triggerRef}
      type="button"
      onClick={() => open ? setOpen(false) : openDropdown()}
      className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 dark:border-gray-600
        rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white text-sm
        focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-colors
        hover:border-primary/60"
    >
      <span className={`truncate ${value === 'all' ? 'text-gray-500 dark:text-gray-400' : 'font-medium'}`}>
        {selectedLabel}
      </span>
      <div className="flex items-center gap-1 ml-2 flex-shrink-0">
        {value !== 'all' && (
          <X
            className="w-3.5 h-3.5 text-gray-400 hover:text-primary"
            onClick={(e) => { e.stopPropagation(); select('all') }}
          />
        )}
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>
    </button>
  )

  // ── Dropdown panel (portal) ──────────────────────────────────────
  const panel = open && createPortal(
    <div
      ref={panelRef}
      style={{ top: dropPos.top, left: dropPos.left, width: dropPos.width, minWidth: 200 }}
      className="fixed z-[9999] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
        rounded-xl shadow-2xl overflow-hidden"
    >
      {/* "All Grades" option */}
      <button
        onClick={() => select('all')}
        className={`w-full text-left px-4 py-2.5 text-sm transition-colors
          ${value === 'all'
            ? 'bg-primary/10 text-primary dark:text-red-300 font-semibold'
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
      >
        All Grades
      </button>

      {/* Grouped options */}
      <div className="max-h-72 overflow-y-auto">
        {groups.map((group) => (
          <div key={group.label}>
            {/* Group header */}
            <div className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-700/60 sticky top-0">
              {group.label}
            </div>
            {/* Options */}
            {group.options.map((opt) => (
              <button
                key={opt}
                onClick={() => select(opt)}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors
                  ${value === opt
                    ? 'bg-primary/10 text-primary dark:text-red-300 font-semibold'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
              >
                {opt}
              </button>
            ))}
          </div>
        ))}

        {groups.length === 0 && (
          <p className="px-4 py-4 text-sm text-gray-400 text-center">No grades available</p>
        )}
      </div>
    </div>,
    document.body
  )

  return (
    <div className="relative">
      {trigger}
      {panel}
    </div>
  )
}