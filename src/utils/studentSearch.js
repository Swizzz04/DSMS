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

  const digitsOnly = /^\d+$/.test(q)
  const words = q.split(/[\s,]+/).filter(Boolean)

  const matched = (students || []).filter(s => {
    if (level && s.gradeLevel !== level) return false          // exact match, never .includes()
    if (!q) return true
    if (digitsOnly) return norm(s.studentNo).startsWith(q)     // student numbers: prefix match
    const name = norm(s.name)
    return words.every(w => name.includes(w))                  // "cruz ma" finds "Cruz, Maria"
  })

  return {
    total: matched.length,
    rows: matched.slice(0, limit).map(s => ({ id: s.id, studentNo: s.studentNo, name: s.name })),
  }
}
