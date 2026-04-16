/**
 * GroupedSelect — the STANDARD dropdown for the entire CSHC system.
 *
 * Two modes:
 *
 * 1. NORMAL MODE (default)
 *    Pass flat `options` or grouped `groups`. Used everywhere for status
 *    filters, payment methods, sort options, etc.
 *
 *    <GroupedSelect
 *      value={statusFilter}
 *      onChange={setStatusFilter}
 *      allLabel="All Status"
 *      options={[
 *        { value: 'pending', label: 'Pending' },
 *        { value: 'approved', label: 'Approved' },
 *      ]}
 *    />
 *
 * 2. GRADE LEVEL MODE  (gradeLevel prop)
 *    Builds campus-aware, role-aware grouped grade/program options
 *    internally from AppConfigContext — no manual option list needed.
 *    Drop-in replacement for the old GradeLevelSelect component.
 *
 *    <GroupedSelect
 *      gradeLevel
 *      value={gradeLevelFilter}
 *      onChange={setGradeLevelFilter}
 *      campusFilter={campusKey}
 *      userRole={user?.role}
 *    />
 *
 * Props (normal mode)
 * ───────────────────
 *   value        string          current value ('all' | option value)
 *   onChange     fn              called with new value string
 *   allLabel     string          label for the reset option  (default: 'All')
 *   placeholder  string          trigger text when value === 'all'
 *   options      {value,label}[] flat options (use this OR groups)
 *   groups       {label, options: {value,label}[]}[]  grouped options
 *   disabled     bool
 *   className    string          extra classes on wrapper div
 *
 * Props (grade level mode — added on top of the above)
 * ─────────────────────────────────────────────────────
 *   gradeLevel   bool            enables grade level mode
 *   campusFilter string          campus key: 'all' | 'Carcar' | 'Talisay' | …
 *   userRole     string          'registrar_basic' hides college,
 *                                'registrar_college' hides basic ed
 */

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, X } from 'lucide-react'
import { useAppConfig } from '../context/AppConfigContext'

// ── Internal hook: builds grade-level groups from config ─────────────
// Always called (never conditionally) to satisfy React Rules of Hooks.
// Returns empty array when enabled=false.
function useGradeLevelGroups(campusFilter = 'all', userRole = 'admin', enabled = true) {
  const { activeCampuses, basicEdGroups, campusProgramsMap } = useAppConfig()

  if (!enabled) return []

  const isBasicOnly   = userRole === 'registrar_basic'
  const isCollegeOnly = userRole === 'registrar_college'

  const groups = []

  if (!isCollegeOnly) {
    ;(basicEdGroups || []).forEach(g => groups.push(g))
  }

  if (!isBasicOnly) {
    if (campusFilter === 'all') {
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

  return groups
}

// ── Shared positioning logic ──────────────────────────────────────────
function useDropdownPosition(triggerRef, open) {
  const [dropPos, setDropPos] = useState({})

  const updatePos = () => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const vw   = window.innerWidth
    const vh   = window.innerHeight
    const PAD  = 8
    const mobile = vw < 640

    if (mobile) {
      setDropPos({
        top:    rect.bottom + 4,
        left:   PAD,
        width:  vw - PAD * 2,
        maxH:   Math.min(vh * 0.6, vh - rect.bottom - PAD),
        mobile: true,
      })
    } else {
      const w = Math.max(Math.min(rect.width, vw - PAD * 2), Math.min(220, vw - PAD * 2))
      let   l = rect.left
      if (l + w > vw - PAD) l = vw - w - PAD
      if (l < PAD) l = PAD
      setDropPos({
        top:    rect.bottom + 4,
        left:   l,
        width:  w,
        maxH:   Math.min(300, vh - rect.bottom - PAD),
        mobile: false,
      })
    }
  }

  return { dropPos, updatePos }
}

// ── Main component ────────────────────────────────────────────────────
export default function GroupedSelect({
  // common
  value      = 'all',
  onChange,
  allLabel   = 'All',
  placeholder,
  disabled   = false,
  className  = '',
  // normal mode
  options,
  groups: groupsProp = [],
  // grade level mode
  gradeLevel   = false,
  campusFilter = 'all',
  userRole     = 'admin',
}) {
  const [open, setOpen]     = useState(false)
  const triggerRef          = useRef(null)
  const panelRef            = useRef(null)
  const { dropPos, updatePos } = useDropdownPosition(triggerRef, open)

  // Grade level mode: build groups from config hook
  // Normal mode: use props
  // Always call the hook unconditionally (Rules of Hooks)
  // Pass enabled=false when not in grade level mode so it returns [] immediately
  const gradeLevelGroups = useGradeLevelGroups(campusFilter, userRole, gradeLevel)

  // Resolve final groups
  // Grade level groups contain raw strings as options; normal groups contain {value, label} objects
  const resolvedGroups = gradeLevel
    ? gradeLevelGroups
    : options
      ? [{ label: '__flat__', options }]
      : groupsProp

  // "All" reset label
  const allText = gradeLevel ? 'All Grades' : (placeholder || allLabel)

  // Find display label for current value
  const selectedLabel = (() => {
    if (value === 'all') return allText
    if (gradeLevel) {
      // options are raw strings
      for (const g of resolvedGroups) {
        if (g.options?.includes(value)) return value
      }
      return value
    }
    // normal mode: options are {value, label} objects
    for (const g of resolvedGroups) {
      const opt = g.options?.find(o => o.value === value)
      if (opt) return opt.label
    }
    return value
  })()

  // Close on outside click, reposition on scroll/resize
  useEffect(() => {
    if (!open) return
    const handleClick = (e) => {
      if (
        panelRef.current   && !panelRef.current.contains(e.target) &&
        triggerRef.current && !triggerRef.current.contains(e.target)
      ) setOpen(false)
    }
    const handleScroll = () => {
      if (!triggerRef.current) return
      const rect = triggerRef.current.getBoundingClientRect()
      if (rect.bottom < 0 || rect.top > window.innerHeight) {
        setOpen(false)
      } else {
        updatePos()
      }
    }
    document.addEventListener('mousedown', handleClick)
    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', updatePos)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', updatePos)
    }
  }, [open])

  const openDropdown = () => { updatePos(); setOpen(true) }
  const select = (val) => { onChange?.(val); setOpen(false) }

  return (
    <div className={`relative ${className}`}>
      {/* ── Trigger button ── */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => open ? setOpen(false) : openDropdown()}
        className={`w-full flex items-center justify-between px-3 py-2 border
          rounded-lg bg-[var(--color-bg-subtle)] text-sm outline-none transition-colors
          ${disabled
            ? 'border-[var(--color-border)] opacity-50 cursor-not-allowed text-gray-400'
            : 'border-[var(--color-border)] text-[var(--color-text-primary)] hover:border-primary/60 focus:ring-2 focus:ring-primary focus:border-transparent'
          }`}
      >
        <span className={`truncate ${value === 'all' ? 'text-[var(--color-text-muted)]' : 'font-medium'}`}>
          {selectedLabel}
        </span>
        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
          {value !== 'all' && (
            <X
              className="w-3.5 h-3.5 text-gray-400 hover:text-primary transition-colors"
              onClick={(e) => { e.stopPropagation(); select('all') }}
            />
          )}
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* ── Dropdown panel via portal ── */}
      {open && createPortal(
        <div
          ref={panelRef}
          style={{
            position: 'fixed',
            top:      dropPos.top,
            left:     dropPos.left,
            width:    dropPos.width,
            minWidth: dropPos.mobile ? undefined : 220,
          }}
          className="z-[9999] bg-[var(--color-bg-card)] border border-[var(--color-border)]
            rounded-xl shadow-[var(--shadow-modal)] overflow-hidden"
        >
          {/* Reset / "All" option */}
          <button
            onClick={() => select('all')}
            className={`w-full text-left px-4 py-2.5 text-sm transition-colors
              ${value === 'all'
                ? 'bg-primary/10 text-primary dark:text-red-300 font-semibold'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)]'
              }`}
          >
            {allText}
          </button>

          {/* Grouped options */}
          <div className="overflow-y-auto" style={{ maxHeight: dropPos.maxH || 300 }}>
            {resolvedGroups.map((group) => (
              <div key={group.label}>
                {/* Group header — hidden for flat (unnamed) groups */}
                {group.label !== '__flat__' && (
                  <div className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider
                    text-[var(--color-text-muted)] bg-[var(--color-bg-subtle)]/60 sticky top-0">
                    {group.label}
                  </div>
                )}
                {/* Options */}
                {(group.options || []).map((opt) => {
                  // Grade level mode: opt is a raw string
                  // Normal mode: opt is { value, label }
                  const optValue = gradeLevel ? opt : opt.value
                  const optLabel = gradeLevel ? opt : opt.label
                  return (
                    <button
                      key={optValue}
                      onClick={() => select(optValue)}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors
                        ${value === optValue
                          ? 'bg-primary/10 text-primary dark:text-red-300 font-semibold'
                          : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)]'
                        }`}
                    >
                      {optLabel}
                    </button>
                  )
                })}
              </div>
            ))}

            {resolvedGroups.length === 0 && (
              <p className="px-4 py-4 text-sm text-gray-400 text-center">
                {gradeLevel ? 'No grades available' : 'No options available'}
              </p>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}