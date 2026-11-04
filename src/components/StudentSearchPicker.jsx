/**
 * StudentSearchPicker — pick ONE student by name or student number, narrowed by grade level
 * ─────────────────────────────────────────────────────────────────────────────
 * Built for a big school: it never lists every student. The list stays empty until the person
 * types a few characters or picks a grade level, waits a moment after typing, and shows a short
 * page of rows with just the name and the student number. Grade level is a filter above the list,
 * not text on each row. See utils/studentSearch.js for the rule and the matching backend call.
 *
 * Props
 *   students   [{ id, studentNo, name, gradeLevel }]  the students this person may pick from
 *   value      the chosen student's id ('' = none)
 *   onChange   (id) => void       called with '' when the person taps "Change"
 *   locked     the chosen student cannot be changed (editing an existing record)
 *   error      message shown under the field
 *
 * Mobile-first: the search box and the grade filter stack on a phone and sit side by side from sm.
 * No native select, colors from CSS variables only.
 */

import { useState, useEffect, useMemo } from 'react'
import { Search, Lock } from 'lucide-react'
import GroupedSelect from './GroupedSelect'
import { useAppConfig } from '../context/AppConfigContext'
import { STUDENT_SEARCH } from '../config/appConfig'
import { searchStudents, hasSearchCriteria } from '../utils/studentSearch'

const INPUT_CLASS = 'w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition'

/** The text, delayed until the person pauses typing */
function useDebounced(value, ms) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

export default function StudentSearchPicker({ students, value, onChange, locked = false, error }) {
  const { basicEdGroups } = useAppConfig()
  const [text, setText]   = useState('')
  const [level, setLevel] = useState('all')
  const query = useDebounced(text, STUDENT_SEARCH.debounceMs)

  const selected = useMemo(
    () => (students || []).find(s => String(s.id) === String(value)),
    [students, value]
  )

  // Grade level filter: only levels that have students here, in the order set in Settings,
  // with how many students each one has. Levels that are not Basic Ed (College) go in their own group.
  const levelGroups = useMemo(() => {
    const counts = new Map()
    ;(students || []).forEach(s => { if (s.gradeLevel) counts.set(s.gradeLevel, (counts.get(s.gradeLevel) || 0) + 1) })
    const used = new Set()
    const groups = (basicEdGroups || []).map(g => ({
      label: g.label,
      options: (g.options || []).filter(o => counts.has(o)).map(o => { used.add(o); return { value: o, label: `${o} (${counts.get(o)})` } }),
    })).filter(g => g.options.length)
    const rest = [...counts.keys()].filter(l => !used.has(l)).sort((a, b) => a.localeCompare(b))
    if (rest.length) groups.push({ label: 'College', options: rest.map(o => ({ value: o, label: `${o} (${counts.get(o)})` })) })
    return groups
  }, [students, basicEdGroups])

  const ready   = hasSearchCriteria(query, level)
  const waiting = text.trim() !== query.trim()          // still typing: do not flash "No student found"
  const result  = useMemo(
    () => searchStudents(students, { query, gradeLevel: level }),
    [students, query, level]
  )

  if (selected) {
    return (
      <div>
        <div className="flex items-center gap-3 px-3 py-2.5 border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)]">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{selected.name}</p>
            <p className="text-xs text-[var(--color-text-muted)] truncate">
              <span className="font-mono">{selected.studentNo || '—'}</span>{selected.gradeLevel ? ` · ${selected.gradeLevel}` : ''}
            </p>
          </div>
          {locked
            ? <Lock size={14} className="text-[var(--color-text-muted)] shrink-0" aria-label="Student cannot be changed" />
            : <button type="button" onClick={() => onChange('')} className="btn btn-ghost text-xs py-1.5 px-3">Change</button>}
        </div>
        {error && <p className="text-xs text-[var(--color-error-text)] mt-1" role="alert">{error}</p>}
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" aria-hidden="true" />
          <input
            type="text" value={text} onChange={e => setText(e.target.value)}
            placeholder="Search by name or student number…"
            aria-label="Search student by name or student number"
            className={`${INPUT_CLASS} pl-9`}
          />
        </div>
        <div className="sm:w-52 shrink-0">
          <GroupedSelect value={level} onChange={setLevel} allLabel="All grade levels" groups={levelGroups} />
        </div>
      </div>

      <ul className="mt-2 max-h-48 overflow-y-auto border border-[var(--color-border)] rounded-xl divide-y divide-[var(--color-border)]" aria-live="polite">
        {!ready && (
          <li className="px-3 py-4 text-sm text-center text-[var(--color-text-muted)]">
            Type at least {STUDENT_SEARCH.minChars} letters of a name, or a student number, or choose a grade level.
          </li>
        )}
        {ready && waiting && (
          <li className="px-3 py-4 text-sm text-center text-[var(--color-text-muted)]">Searching…</li>
        )}
        {ready && !waiting && result.rows.length === 0 && (
          <li className="px-3 py-4 text-sm text-center text-[var(--color-text-muted)]">No student found.</li>
        )}
        {ready && !waiting && result.rows.map(s => (
          <li key={s.id}>
            <button type="button" onClick={() => onChange(s.id)}
              className="w-full flex items-center justify-between gap-3 text-left px-3 py-2.5 hover:bg-[var(--color-bg-subtle)] transition">
              <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">{s.name}</span>
              <span className="text-xs font-mono text-[var(--color-text-muted)] shrink-0">{s.studentNo || '—'}</span>
            </button>
          </li>
        ))}
      </ul>
      {ready && !waiting && result.total > result.rows.length && (
        <p className="text-xs text-[var(--color-text-muted)] mt-1">
          Showing the first {result.rows.length} of {result.total}. Type more or pick a grade level to narrow down.
        </p>
      )}
      {error && <p className="text-xs text-[var(--color-error-text)] mt-1" role="alert">{error}</p>}
    </div>
  )
}
