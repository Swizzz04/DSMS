/**
 * attendanceBridge.js — ALMIRENE DX Attendance Data Bridge
 *
 * All attendance reads and writes go through this file.
 * Swap localStorage calls for API calls when ASP.NET backend is ready.
 *
 * localStorage key: almirene_attendance
 * Event:            almirene_attendance_updated
 *
 * Location: src/utils/attendanceBridge.js
 */

import {
  computeStudentAttendance,
  getAtRiskStudents,
  DEFAULT_ATTENDANCE_CONFIG,
} from '../engines/attendanceEngine'

const ATTENDANCE_KEY   = 'almirene_attendance'
const ATTENDANCE_EVENT = 'almirene_attendance_updated'

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function load() {
  try { return JSON.parse(localStorage.getItem(ATTENDANCE_KEY) || '[]') }
  catch { return [] }
}

function save(data) {
  localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(data))
  window.dispatchEvent(new CustomEvent(ATTENDANCE_EVENT))
}

function uid() {
  return `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function getDayOfWeek(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' })
}

/** Get attendance config from app config or use defaults */
function getAttendanceConfig() {
  try {
    const cfg = JSON.parse(localStorage.getItem('cshc_app_config') || '{}')
    return { ...DEFAULT_ATTENDANCE_CONFIG, ...(cfg.attendanceConfig ?? {}) }
  } catch {
    return DEFAULT_ATTENDANCE_CONFIG
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get attendance records with optional filters.
 *
 * @param {object} filters — {
 *   campusKey, schoolYear, sectionId, subjectId,
 *   date, studentId, teacherId, department
 * }
 */
export function getAttendance(filters = {}) {
  let records = load()
  if (filters.campusKey)  records = records.filter(r => r.campusKey  === filters.campusKey)
  if (filters.schoolYear) records = records.filter(r => r.schoolYear === filters.schoolYear)
  if (filters.sectionId)  records = records.filter(r => r.sectionId  === filters.sectionId)
  if (filters.subjectId)  records = records.filter(r => r.subjectId  === filters.subjectId)
  if (filters.date)       records = records.filter(r => r.date       === filters.date)
  if (filters.studentId)  records = records.filter(r => r.studentId  === filters.studentId)
  if (filters.teacherId)  records = records.filter(r => r.teacherId  === filters.teacherId)
  if (filters.department) records = records.filter(r => r.department === filters.department)
  return records
}

/**
 * Get all attendance records for a section on a specific date.
 */
export function getAttendanceByDate(sectionId, date, subjectId = null) {
  return load().filter(r =>
    r.sectionId === sectionId &&
    r.date      === date &&
    (subjectId ? r.subjectId === subjectId : true)
  )
}

/**
 * Save or update a single attendance record.
 * If a record already exists for the same student+date+subject, it updates it.
 *
 * @param {object} record
 * @returns {object} — saved record
 */
export function saveAttendanceRecord(record) {
  const all = load()
  const now = new Date().toISOString()

  const idx = all.findIndex(r =>
    r.studentId  === record.studentId &&
    r.date       === record.date &&
    r.sectionId  === record.sectionId &&
    (record.subjectId ? r.subjectId === record.subjectId : !r.subjectId)
  )

  const full = {
    ...record,
    dayOfWeek:  record.dayOfWeek  || getDayOfWeek(record.date),
    updatedAt:  now,
    recordedAt: record.recordedAt || now,
  }

  if (idx >= 0) {
    all[idx] = { ...all[idx], ...full }
  } else {
    full.id = record.id || uid()
    all.push(full)
  }

  save(all)
  return full
}

/**
 * Save an entire section's attendance for one day in a single write.
 * Much more efficient than calling saveAttendanceRecord() in a loop.
 *
 * @param {object[]} records — full attendance records for the day
 */
export function saveBulkAttendance(records) {
  const all  = load()
  const now  = new Date().toISOString()

  records.forEach(record => {
    const idx = all.findIndex(r =>
      r.studentId  === record.studentId &&
      r.date       === record.date &&
      r.sectionId  === record.sectionId &&
      (record.subjectId ? r.subjectId === record.subjectId : !r.subjectId)
    )

    const full = {
      ...record,
      id:         record.id        || uid(),
      dayOfWeek:  record.dayOfWeek || getDayOfWeek(record.date),
      updatedAt:  now,
      recordedAt: record.recordedAt || now,
    }

    if (idx >= 0) all[idx] = { ...all[idx], ...full }
    else all.push(full)
  })

  save(all)
}

/**
 * Get attendance summary for a single student across all their records.
 *
 * @param {string}      studentId
 * @param {string}      schoolYear
 * @param {string|null} subjectId — null for Basic Ed daily; subject ID for college
 * @returns {{ totalDays, present, absent, late, excused, absenceEquivalent, attendancePercent, isAtRisk }}
 */
export function getStudentAttendanceSummary(studentId, schoolYear, subjectId = null) {
  const records = load().filter(r =>
    r.studentId  === studentId &&
    r.schoolYear === schoolYear &&
    (subjectId ? r.subjectId === subjectId : true)
  )
  return computeStudentAttendance(records, getAttendanceConfig())
}

/**
 * Get all at-risk students for a section.
 *
 * @param {string} campusKey
 * @param {string} schoolYear
 * @param {string} sectionId
 * @returns {object[]} — sorted by lowest attendance percent first
 */
export function getAtRiskStudentsForSection(campusKey, schoolYear, sectionId) {
  const records = getAttendance({ campusKey, schoolYear, sectionId })
  return getAtRiskStudents(records, getAttendanceConfig())
}

/**
 * Check if attendance has already been recorded for a section on a given date.
 * Used to show "already recorded" indicator in the teacher UI.
 */
export function isAttendanceRecorded(sectionId, date, subjectId = null) {
  return load().some(r =>
    r.sectionId === sectionId &&
    r.date      === date &&
    (subjectId ? r.subjectId === subjectId : true)
  )
}

/**
 * Delete attendance records for a specific date+section (for correction).
 * Only allowed on the same day — enforced in the UI.
 */
export function deleteAttendanceForDate(sectionId, date, subjectId = null) {
  const filtered = load().filter(r => !(
    r.sectionId === sectionId &&
    r.date      === date &&
    (subjectId ? r.subjectId === subjectId : true)
  ))
  save(filtered)
}

/**
 * Get all dates when attendance was recorded for a section.
 * Used for the calendar view.
 */
export function getRecordedDates(sectionId, schoolYear, subjectId = null) {
  const records = load().filter(r =>
    r.sectionId  === sectionId &&
    r.schoolYear === schoolYear &&
    (subjectId ? r.subjectId === subjectId : true)
  )
  return [...new Set(records.map(r => r.date))].sort()
}

/**
 * Get today's date string in YYYY-MM-DD format.
 */
export function getTodayString() {
  return today()
}