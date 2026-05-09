/**
 * attendanceEngine.js — ALMIRENE DX Attendance Engine
 *
 * Pure functions ONLY. No localStorage. No React. Config always as parameter.
 * All computation happens here — attendanceBridge.js handles storage.
 *
 * Location: src/engines/attendanceEngine.js
 */

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT CONFIG (used when no school config is set)
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_ATTENDANCE_CONFIG = {
  minAttendancePercent:  80,
  maxAbsencesBeforeFlag: 3,
  latesPerAbsence:       3,
  excusedAbsenceCounts:  true,
  alertRecipients:       ['parent', 'adviser'],
  reportFormat:          'deped_sf2',
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE COMPUTATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute attendance statistics for one student across a set of records.
 *
 * @param {object[]} records        — attendance records for this student
 * @param {object}   attendanceConfig
 * @returns {{
 *   totalDays, present, absent, late, excused,
 *   absenceEquivalent, attendancePercent,
 *   isAtRisk, shouldNotify, consecutiveAbsences
 * }}
 */
export function computeStudentAttendance(records, attendanceConfig) {
  const cfg = { ...DEFAULT_ATTENDANCE_CONFIG, ...attendanceConfig }

  const totalDays = records.length
  const present   = records.filter(r => r.status === 'present').length
  const absent    = records.filter(r => r.status === 'absent').length
  const late      = records.filter(r => r.status === 'late').length
  const excused   = records.filter(r => r.status === 'excused').length

  // Absence equivalent — excused may or may not count depending on config
  const countedAbsences = cfg.excusedAbsenceCounts ? (absent + excused) : absent
  const absenceEquivalent = countedAbsences + Math.floor(late / cfg.latesPerAbsence)

  const attendancePercent = totalDays > 0
    ? Math.round(((totalDays - absenceEquivalent) / totalDays) * 10000) / 100
    : 100

  const isAtRisk = attendancePercent < cfg.minAttendancePercent

  // Consecutive absences — check last N records sorted by date
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date))
  let consecutiveAbsences = 0
  let maxConsecutive = 0
  for (const r of sorted) {
    const isAbsent = r.status === 'absent' || (cfg.excusedAbsenceCounts && r.status === 'excused')
    if (isAbsent) {
      consecutiveAbsences++
      if (consecutiveAbsences > maxConsecutive) maxConsecutive = consecutiveAbsences
    } else {
      consecutiveAbsences = 0
    }
  }

  const shouldNotify = maxConsecutive >= cfg.maxAbsencesBeforeFlag

  return {
    totalDays,
    present,
    absent,
    late,
    excused,
    absenceEquivalent,
    attendancePercent,
    isAtRisk,
    shouldNotify,
    consecutiveAbsences: maxConsecutive,
  }
}

/**
 * Get at-risk students from a set of attendance records (all students, one section).
 *
 * @param {object[]} allRecords     — all attendance records for the section
 * @param {object}   attendanceConfig
 * @returns {object[]}              — list of { studentId, studentName, stats }
 */
export function getAtRiskStudents(allRecords, attendanceConfig) {
  const cfg = { ...DEFAULT_ATTENDANCE_CONFIG, ...attendanceConfig }

  // Group by studentId
  const byStudent = {}
  allRecords.forEach(r => {
    if (!byStudent[r.studentId]) {
      byStudent[r.studentId] = { studentId: r.studentId, studentName: r.studentName, records: [] }
    }
    byStudent[r.studentId].records.push(r)
  })

  return Object.values(byStudent)
    .map(s => ({
      studentId:   s.studentId,
      studentName: s.studentName,
      stats:       computeStudentAttendance(s.records, cfg),
    }))
    .filter(s => s.stats.isAtRisk)
    .sort((a, b) => a.stats.attendancePercent - b.stats.attendancePercent)
}

/**
 * Check if an alert should fire for a student based on consecutive absences.
 *
 * @param {object}   student
 * @param {object[]} attendanceHistory — records for this student
 * @param {object}   attendanceConfig
 * @returns {boolean}
 */
export function shouldSendAlert(student, attendanceHistory, attendanceConfig) {
  const cfg = { ...DEFAULT_ATTENDANCE_CONFIG, ...attendanceConfig }
  const stats = computeStudentAttendance(attendanceHistory, cfg)
  return stats.shouldNotify
}

/**
 * Compute attendance summary for all students in a section for a given date range.
 * Used to build the summary view in the Attendance page.
 *
 * @param {object[]} records        — all records for the section
 * @param {string[]} studentIds     — list of all student IDs in section
 * @param {object}   attendanceConfig
 * @returns {object[]}              — array of { studentId, studentName, stats }
 */
export function computeSectionSummary(records, attendanceConfig) {
  const cfg = { ...DEFAULT_ATTENDANCE_CONFIG, ...attendanceConfig }

  const byStudent = {}
  records.forEach(r => {
    if (!byStudent[r.studentId]) {
      byStudent[r.studentId] = { studentId: r.studentId, studentName: r.studentName, records: [] }
    }
    byStudent[r.studentId].records.push(r)
  })

  return Object.values(byStudent)
    .map(s => ({
      studentId:   s.studentId,
      studentName: s.studentName,
      stats:       computeStudentAttendance(s.records, cfg),
    }))
    .sort((a, b) => a.studentName.localeCompare(b.studentName))
}

/**
 * Get unique school days from a set of records.
 * @param {object[]} records
 * @returns {string[]} — sorted unique date strings 'YYYY-MM-DD'
 */
export function getSchoolDays(records) {
  const days = [...new Set(records.map(r => r.date))].sort()
  return days
}

/**
 * Generate DepEd SF2 report data structure.
 * SF2 = School Form 2 — Daily Attendance of Learners
 *
 * @param {object[]} sectionRecords — all records for a section
 * @param {string}   month          — 'YYYY-MM' e.g. '2025-08'
 * @param {object}   schoolConfig   — { schoolName, teacherName, gradeLevel, section }
 * @returns {object} — SF2 data ready for rendering
 */
export function generateSF2(sectionRecords, month, schoolConfig) {
  // Filter to the given month
  const monthRecords = sectionRecords.filter(r => r.date.startsWith(month))
  const schoolDays   = getSchoolDays(monthRecords)

  // Build student rows
  const byStudent = {}
  monthRecords.forEach(r => {
    if (!byStudent[r.studentId]) {
      byStudent[r.studentId] = {
        studentId:   r.studentId,
        studentName: r.studentName,
        days:        {},
      }
    }
    byStudent[r.studentId].days[r.date] = r.status
  })

  const students = Object.values(byStudent)
    .map(s => {
      const dayStatuses = schoolDays.map(d => s.days[d] ?? null)
      const present     = dayStatuses.filter(st => st === 'present').length
      const absent      = dayStatuses.filter(st => st === 'absent').length
      const late        = dayStatuses.filter(st => st === 'late').length
      const excused     = dayStatuses.filter(st => st === 'excused').length
      return {
        studentId:   s.studentId,
        studentName: s.studentName,
        dayStatuses,
        totals: { present, absent, late, excused, daysOfClass: schoolDays.length },
      }
    })
    .sort((a, b) => a.studentName.localeCompare(b.studentName))

  return {
    schoolConfig,
    month,
    schoolDays,
    students,
    totalDaysOfClass: schoolDays.length,
  }
}

/**
 * Get attendance status color for UI display.
 * @param {string} status
 * @returns {{ bg: string, text: string, label: string }}
 */
export function getStatusStyle(status) {
  return {
    present: { bg: 'bg-green-100 dark:bg-green-900/30',  text: 'text-green-700 dark:text-green-400',  label: 'P' },
    absent:  { bg: 'bg-red-100 dark:bg-red-900/30',     text: 'text-red-700 dark:text-red-400',     label: 'A' },
    late:    { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', label: 'L' },
    excused: { bg: 'bg-blue-100 dark:bg-blue-900/30',   text: 'text-blue-700 dark:text-blue-400',   label: 'E' },
  }[status] ?? { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-500', label: '—' }
}