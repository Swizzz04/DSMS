/**
 * sectionCapacity.js — who is in which section, and whether a section has room.
 * Pure functions (no React, no localStorage). The seats per section come from
 * config/appConfig.js getSectionCapacity(); this file only counts and decides.
 *
 * A "record" is a flat student: { campus, gradeLevel, schoolYear, section, status? }.
 * Students already assigned to a section count toward it, for the same campus, level and
 * school year. Withdrawn, rejected, declined and cancelled records never take a seat.
 */

export const INACTIVE_STATUSES = ['rejected', 'declined', 'cancelled', 'withdrawn']

/** Enrollment submissions → flat records. */
export function toSectionRecords(submissions) {
  return (submissions || []).map(s => ({
    campus:     s.enrollment?.campus || s.campusName || s.campus || '',
    gradeLevel: s.enrollment?.gradeLevel || s.gradeLevel || '',
    schoolYear: s.enrollment?.schoolYear || s.schoolYear || '',
    section:    s.enrollment?.section || s.section || '',
    status:     s.status || '',
  }))
}

/** { [sectionName]: headCount } for one level at one campus in one school year. */
export function countBySection(records, { campus, level, schoolYear }) {
  const counts = {}
  ;(records || []).forEach(r => {
    if (!r.section) return
    if (INACTIVE_STATUSES.includes(r.status)) return
    if (r.campus !== campus || r.gradeLevel !== level) return
    if (schoolYear && r.schoolYear !== schoolYear) return
    counts[r.section] = (counts[r.section] || 0) + 1
  })
  return counts
}

/**
 * One entry per section name for a dropdown or a settings note.
 *   full = no seat left (count >= capacity);  over = more students than seats
 * `current` is the section the student already has: it is never "full" for that student,
 * because they are already counted in it.
 */
export function sectionStatuses(names, counts, capacity, current = '') {
  return (names || []).map(name => {
    const count = counts?.[name] || 0
    const mine  = name === current
    return {
      name,
      count,
      capacity,
      full: !mine && count >= capacity,
      over: count > capacity,
      seatsLeft: Math.max(0, capacity - count),
    }
  })
}

/** Section names that hold more students than the limit allows (for the Settings note). */
export function overCapacity(names, counts, capacity) {
  const all = new Set([...(names || []), ...Object.keys(counts || {})])
  return [...all]
    .filter(name => (counts?.[name] || 0) > capacity)
    .map(name => ({ name, count: counts[name], capacity }))
}

/** Can this student be put into `section`? A student already in it can always stay. */
export function canAssign(counts, capacity, section, current = '') {
  if (!section) return true                    // clearing a section is always allowed
  if (section === current) return true
  return (counts?.[section] || 0) < capacity
}
