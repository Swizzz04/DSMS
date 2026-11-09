/**
 * studentSearch.js — the student search rule, in one place (plain .js)
 * ─────────────────────────────────────────────────────────────────────────────
 * A search box does NOT list every student. It asks for a text (name or student number), a grade
 * level, or both, and returns a short page of rows that carry only what the list shows:
 * id, student number and name. The grade level is a FILTER, not a column.
 *
 * Today this runs on the loaded list. When the backend arrives, searchStudents() becomes one call
 * with the same inputs and the same small result:
 *
 *   GET /api/students/search?q=<text>&gradeLevel=<level>&limit=20
 *   → { total, rows: [{ id, studentNo, name }] }
 *
 * Suggested query (ASP.NET Core 8 + MySQL 8): select only id, student_no, last_name, first_name;
 * `student_no LIKE 'q%'` when q is all digits, otherwise `last_name LIKE 'q%' OR first_name LIKE 'q%'`
 * (prefix matches can use an index); `grade_level = @gradeLevel` when given; always ORDER BY
 * last_name, first_name with LIMIT. Indexes: (student_no), (grade_level, last_name, first_name).
 */

import { STUDENT_SEARCH } from '../config/appConfig'

const norm = (v) => String(v ?? '').trim().toLowerCase()

/** True when the text is enough to search (or a grade level is chosen). */
export function hasSearchCriteria(query, gradeLevel) {
  return norm(query).length >= STUDENT_SEARCH.minChars || (!!gradeLevel && gradeLevel !== 'all')
}

/**
 * @param {Array} students     [{ id, studentNo, name, gradeLevel }]
 * @param {{ query?: string, gradeLevel?: string, limit?: number }} criteria
 * @returns {{ total: number, rows: Array<{ id, studentNo, name }> }}
 */
export function searchStudents(students, { query = '', gradeLevel = '', limit = STUDENT_SEARCH.limit } = {}) {
  const q = norm(query)
  const level = gradeLevel && gradeLevel !== 'all' ? gradeLevel : ''
  if (!hasSearchCriteria(q, level)) return { total: 0, rows: [] }

  // A student number may be typed or pasted with spaces or dashes ("2026 000132", "2026-000132")
  const compact = q.replace(/[\s-]/g, '')
  const digitsOnly = /^\d+$/.test(compact)
  const words = q.split(/[\s,]+/).filter(Boolean)

  const matched = (students || []).filter(s => {
    if (level && s.gradeLevel !== level) return false          // exact match, never .includes()
    if (!q) return true
    if (digitsOnly) return norm(s.studentNo).replace(/[\s-]/g, '').startsWith(compact)   // student numbers: prefix match
    const name = norm(s.name)
    return words.every(w => name.includes(w))                  // "cruz ma" finds "Cruz, Maria"
  })

  return {
    total: matched.length,
    rows: matched.slice(0, limit).map(s => ({ id: s.id, studentNo: s.studentNo, name: s.name })),
  }
}

/**
 * Grade / year level filter options for a list of students, shared by every student picker and list.
 * Only levels that have students are offered, with how many each one has. Basic Ed levels follow the
 * order set in Settings; College levels ("Program - 1st Year") are grouped by program. The option value is
 * the exact stored level, so filters compare with === and never with .includes().
 *
 * @param {string[]} levels            one grade level per student (blank ones are skipped)
 * @param {Array}    basicEdGroups     [{ label, options: [level] }] in Settings order
 * @param {string[]} collegeYearLevels ["1st Year", "2nd Year", ...] in Settings order
 * @returns {Array<{ label, options: [{ value, label }] }>}  ready for GroupedSelect `groups`
 */
export function buildGradeLevelGroups(levels, basicEdGroups = [], collegeYearLevels = []) {
  const counts = new Map()
  ;(levels || []).forEach(l => { if (l) counts.set(l, (counts.get(l) || 0) + 1) })

  const used = new Set()
  const groups = (basicEdGroups || []).map(g => ({
    label: g.label,
    options: (g.options || []).filter(o => counts.has(o)).map(o => { used.add(o); return { value: o, label: `${o} (${counts.get(o)})` } }),
  })).filter(g => g.options.length)

  const yearRank = (lvl) => {
    const i = collegeYearLevels.indexOf(lvl.split(' - ').slice(1).join(' - '))
    return i < 0 ? 999 : i
  }
  const byProgram = new Map()
  ;[...counts.keys()].filter(l => !used.has(l)).forEach(l => {
    const program = l.includes(' - ') ? l.split(' - ')[0] : 'College'
    if (!byProgram.has(program)) byProgram.set(program, [])
    byProgram.get(program).push(l)
  })
  ;[...byProgram.keys()].sort((a, b) => a.localeCompare(b)).forEach(program => {
    const options = byProgram.get(program)
      .sort((a, b) => yearRank(a) - yearRank(b) || a.localeCompare(b))
      .map(l => ({ value: l, label: `${l.includes(' - ') ? l.split(' - ').slice(1).join(' - ') : l} (${counts.get(l)})` }))
    groups.push({ label: program, options })
  })
  return groups
}
