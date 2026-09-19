/**
 * incCompletionBridge.js — ALMIRENE DX INC Grade Completion Bridge
 *
 * Handles the INC (Incomplete) grade completion tracking workflow:
 *   INC Recorded → Completion Period Open → Requirements Submitted →
 *   Teacher Evaluated → Final Grade Posted  (or → Auto-Failed if deadline passes)
 *
 * localStorage keys:
 *   almirene_inc_completions      — all INC completion tracking records
 *   almirene_inc_completion_audit — immutable audit trail (append-only, never delete)
 *
 * Events:
 *   almirene_inc_completion_updated
 *
 * Rules (non-negotiable):
 *   - Records are created AUTOMATICALLY when a teacher submits a College grade
 *     with specialGrade === 'INC' (see recordINC(), called from Eclassrecord.jsx
 *     handleCollegeSubmit()) — not manually created by a form on this page.
 *   - Only ONE active completion record per student+subject+semester at a time.
 *   - Once resolved (posted or auto-failed), the underlying college grade record
 *     in almirene_college_grades is updated by THIS bridge — same pattern as
 *     gradeChangeBridge.js's postCorrectedGrade().
 *   - "Must complete within one semester" (Section 5.2) — deadline is computed
 *     by the caller (who has the actual school year end date) and passed in;
 *     falls back to a ~4-month approximation if omitted. No server-side cron
 *     exists in a client-side/localStorage app, so overdue records are
 *     surfaced for a MANUAL "Mark as Auto-Failed" action rather than a truly
 *     automatic background transition.
 */

import { getWorkflowDefinition } from './workflowConfigBridge'
import * as workflowEngine       from '../engines/workflowEngine'

const INC_KEY    = 'almirene_inc_completions'
const AUDIT_KEY  = 'almirene_inc_completion_audit'
const INC_EVENT  = 'almirene_inc_completion_updated'

const COLLEGE_GRADES_KEY = 'almirene_college_grades'

function uid(prefix = 'inc') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function loadINCs() {
  try { return JSON.parse(localStorage.getItem(INC_KEY) || '[]') }
  catch { return [] }
}

function saveINCs(data) {
  localStorage.setItem(INC_KEY, JSON.stringify(data))
  window.dispatchEvent(new CustomEvent(INC_EVENT))
}

function loadAudit() {
  try { return JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]') }
  catch { return [] }
}

function appendAudit(entry) {
  const audit = loadAudit()
  audit.push(entry)
  localStorage.setItem(AUDIT_KEY, JSON.stringify(audit))
  // No event — audit is silent
}

/** Update the actual grade record in almirene_college_grades once resolved. */
function postFinalGrade(record, resolution) {
  // resolution: { pointGrade, specialGrade } — specialGrade null unless DRP/4.00
  try {
    const grades = JSON.parse(localStorage.getItem(COLLEGE_GRADES_KEY) || '[]')
    const idx = grades.findIndex(g =>
      g.studentId  === record.studentId  &&
      g.subjectId  === record.subjectId  &&
      g.schoolYear === record.schoolYear &&
      g.semester   === record.semester
    )
    if (idx < 0) return false

    const now = new Date().toISOString()
    grades[idx].pointGrade   = resolution.pointGrade
    grades[idx].specialGrade = resolution.specialGrade ?? null
    grades[idx].changeHistory = [...(grades[idx].changeHistory || []), {
      changedAt:  now,
      changedBy:  resolution.by,
      oldGrade:   'INC',
      newGrade:   resolution.specialGrade || resolution.pointGrade,
      reason:     resolution.reason,
      requestId:  record.id,
    }]
    grades[idx].updatedAt = now

    localStorage.setItem(COLLEGE_GRADES_KEY, JSON.stringify(grades))
    window.dispatchEvent(new CustomEvent('almirene_college_grades_updated'))
    return true
  } catch { return false }
}

/** Rough one-semester deadline if the caller doesn't pass an exact one. */
function approximateDeadline(fromISO) {
  const d = new Date(fromISO)
  d.setMonth(d.getMonth() + 4)
  return d.toISOString()
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get INC completion records with optional filters.
 * @param {object} filters — { campusKey, schoolYear, status, teacherId, semester }
 */
export function getINCCompletions(filters = {}) {
  let records = loadINCs()
  if (filters.campusKey)  records = records.filter(r => r.campusKey  === filters.campusKey)
  if (filters.schoolYear) records = records.filter(r => r.schoolYear === filters.schoolYear)
  if (filters.status)     records = records.filter(r => r.status     === filters.status)
  if (filters.teacherId)  records = records.filter(r => r.teacherId  === filters.teacherId)
  if (filters.semester)   records = records.filter(r => r.semester   === filters.semester)
  return records.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

export function getINCCompletionById(id) {
  return loadINCs().find(r => r.id === id) ?? null
}

/**
 * Auto-create an INC completion record. Called from Eclassrecord.jsx when a
 * teacher submits a College grade with specialGrade === 'INC'. Silently does
 * nothing if an active (non-final) record already exists for this exact
 * student+subject+semester — safe to call on every submit without creating
 * duplicates on resubmission.
 *
 * @param {object} data
 * @param {string} [data.deadline] — ISO date string. If omitted, defaults to
 *   ~4 months from now (approximating "one semester").
 * @returns {object|null} — the created record, or null if one already existed
 */
export function recordINC(data) {
  const {
    studentId, studentName, subjectId, subjectName, sectionId,
    semester, schoolYear, campusKey, teacherId, teacherName, deadline,
  } = data

  const existing = loadINCs().find(r =>
    r.studentId  === studentId  &&
    r.subjectId  === subjectId  &&
    r.schoolYear === schoolYear &&
    r.semester   === semester   &&
    !['registrar_posted', 'auto_failed'].includes(r.status)
  )
  if (existing) return null

  const now = new Date().toISOString()
  const record = {
    id: uid('inc'),
    studentId, studentName, subjectId, subjectName, sectionId,
    semester, schoolYear, campusKey, teacherId, teacherName,

    originalGrade:          'INC',
    completionGrade:        null,
    completionSpecialGrade: null,
    requirementsNote:       null,
    evaluationNote:         null,
    deadline:               deadline || approximateDeadline(now),

    status: 'inc_recorded',
    statusHistory: [{
      status: 'inc_recorded',
      by:     teacherName,
      note:   'INC recorded during grade submission.',
      at:     now,
    }],

    createdAt: now,
    updatedAt: now,
  }

  const all = loadINCs()
  all.push(record)
  saveINCs(all)

  appendAudit({
    id: uid('audit'), requestId: record.id, campusKey,
    action: 'inc_recorded', by: teacherName, at: now,
    detail: `INC recorded for ${studentName} — ${subjectName}, ${semester}.`,
  })

  return record
}

/** Teacher opens the completion period (student may now submit requirements). */
export function openCompletionPeriod(id, teacherName) {
  const all = loadINCs()
  const idx = all.findIndex(r => r.id === id)
  if (idx < 0) throw new Error(`INC completion record "${id}" not found.`)
  if (all[idx].status !== 'inc_recorded') throw new Error('Completion period already open or further along.')

  const now = new Date().toISOString()
  all[idx] = {
    ...all[idx],
    status: 'completion_open',
    statusHistory: [...all[idx].statusHistory, {
      status: 'completion_open', by: teacherName, note: 'Completion period opened.', at: now,
    }],
    updatedAt: now,
  }
  saveINCs(all)
  appendAudit({
    id: uid('audit'), requestId: id, campusKey: all[idx].campusKey,
    action: 'completion_open', by: teacherName, at: now,
    detail: `Completion period opened by ${teacherName}.`,
  })
  return all[idx]
}

/** Teacher marks that the student has turned in completion requirements. */
export function markRequirementsReceived(id, teacherName, note = '') {
  const all = loadINCs()
  const idx = all.findIndex(r => r.id === id)
  if (idx < 0) throw new Error(`INC completion record "${id}" not found.`)
  if (all[idx].status !== 'completion_open') throw new Error('Completion period is not open.')

  const now = new Date().toISOString()
  all[idx] = {
    ...all[idx],
    status: 'requirements_submitted',
    requirementsNote: note.trim() || null,
    statusHistory: [...all[idx].statusHistory, {
      status: 'requirements_submitted', by: teacherName,
      note: note.trim() ? `Requirements received: ${note.trim()}` : 'Requirements received.',
      at: now,
    }],
    updatedAt: now,
  }
  saveINCs(all)
  appendAudit({
    id: uid('audit'), requestId: id, campusKey: all[idx].campusKey,
    action: 'requirements_received', by: teacherName, at: now,
    detail: `Requirements received. ${note.trim()}`,
  })
  return all[idx]
}

/** Teacher evaluates the submitted requirements. */
export function evaluateRequirements(id, teacherName, note = '') {
  const all = loadINCs()
  const idx = all.findIndex(r => r.id === id)
  if (idx < 0) throw new Error(`INC completion record "${id}" not found.`)
  if (all[idx].status !== 'requirements_submitted') throw new Error('Requirements have not been submitted yet.')

  const now = new Date().toISOString()
  all[idx] = {
    ...all[idx],
    status: 'teacher_evaluated',
    evaluationNote: note.trim() || null,
    statusHistory: [...all[idx].statusHistory, {
      status: 'teacher_evaluated', by: teacherName,
      note: note.trim() ? `Evaluated: ${note.trim()}` : 'Requirements evaluated.',
      at: now,
    }],
    updatedAt: now,
  }
  saveINCs(all)
  appendAudit({
    id: uid('audit'), requestId: id, campusKey: all[idx].campusKey,
    action: 'evaluated', by: teacherName, at: now,
    detail: `Evaluated by ${teacherName}. ${note.trim()}`,
  })
  return all[idx]
}

/**
 * Teacher submits the final completion grade. This is the terminal happy-path
 * step — updates the actual college grade record, replacing INC with the
 * real final grade. Final and permanent, like postGradeCorrection() in
 * gradeChangeBridge.js.
 *
 * @param {string} completionGrade — numeric point grade (e.g. "1.75"), OR
 *   a special override (e.g. "DRP", "4.00") passed via completionSpecialGrade.
 */
export function submitCompletionGrade(id, teacherName, completionGrade, completionSpecialGrade = null) {
  const all = loadINCs()
  const idx = all.findIndex(r => r.id === id)
  if (idx < 0) throw new Error(`INC completion record "${id}" not found.`)
  if (all[idx].status !== 'teacher_evaluated') throw new Error('Requirements must be evaluated before submitting a final grade.')
  if (!completionGrade?.trim() && !completionSpecialGrade) throw new Error('Enter the completion grade.')

  const record = all[idx]
  const success = postFinalGrade(record, {
    pointGrade:   completionSpecialGrade ? null : completionGrade.trim(),
    specialGrade: completionSpecialGrade || null,
    by:           teacherName,
    reason:       'INC completed',
  })
  if (!success) {
    throw new Error('Could not find the original college grade record to update. It may have been deleted.')
  }

  const now = new Date().toISOString()
  all[idx] = {
    ...record,
    status: 'registrar_posted',
    completionGrade:        completionSpecialGrade ? null : completionGrade.trim(),
    completionSpecialGrade: completionSpecialGrade || null,
    statusHistory: [...record.statusHistory, {
      status: 'registrar_posted', by: teacherName,
      note: `Final grade posted: ${completionSpecialGrade || completionGrade.trim()}.`,
      at: now,
    }],
    updatedAt: now,
  }
  saveINCs(all)
  appendAudit({
    id: uid('audit'), requestId: id, campusKey: record.campusKey,
    action: 'posted', by: teacherName, at: now,
    detail: `INC resolved: ${completionSpecialGrade || completionGrade.trim()}. Posted by ${teacherName}.`,
  })
  return all[idx]
}

/**
 * Manually mark a record as auto-failed (5.00) — used when the completion
 * deadline has passed. Manual because a client-side/localStorage app has no
 * background job runner to do this automatically; the UI surfaces overdue
 * records and a teacher/registrar confirms the action.
 */
export function markAutoFailed(id, byName) {
  const all = loadINCs()
  const idx = all.findIndex(r => r.id === id)
  if (idx < 0) throw new Error(`INC completion record "${id}" not found.`)
  if (['registrar_posted', 'auto_failed'].includes(all[idx].status)) {
    throw new Error('This record is already resolved.')
  }

  const record = all[idx]
  const success = postFinalGrade(record, {
    pointGrade: '5.00', specialGrade: null, by: byName, reason: 'INC completion deadline passed',
  })
  if (!success) {
    throw new Error('Could not find the original college grade record to update. It may have been deleted.')
  }

  const now = new Date().toISOString()
  all[idx] = {
    ...record,
    status: 'auto_failed',
    completionGrade: '5.00',
    statusHistory: [...record.statusHistory, {
      status: 'auto_failed', by: byName,
      note: 'Completion deadline passed without a posted grade. Marked 5.00 (Failed).',
      at: now,
    }],
    updatedAt: now,
  }
  saveINCs(all)
  appendAudit({
    id: uid('audit'), requestId: id, campusKey: record.campusKey,
    action: 'auto_failed', by: byName, at: now,
    detail: `Deadline passed — auto-failed at 5.00. Marked by ${byName}.`,
  })
  return all[idx]
}

/** True if a record is past its deadline and not yet resolved. */
export function isOverdue(record) {
  if (['registrar_posted', 'auto_failed'].includes(record.status)) return false
  if (!record.deadline) return false
  return new Date() > new Date(record.deadline)
}

export function getINCAuditTrail(requestId) {
  return loadAudit()
    .filter(e => e.requestId === requestId)
    .sort((a, b) => new Date(a.at) - new Date(b.at))
}

export function getAllINCAuditEntries(campusKey) {
  return loadAudit()
    .filter(e => e.campusKey === campusKey)
    .sort((a, b) => new Date(b.at) - new Date(a.at))
}

/** Pending count for a campus — for Sidebar badge. */
export function getPendingINCCount(campusKey) {
  return loadINCs().filter(
    r => r.campusKey === campusKey &&
         !['registrar_posted', 'auto_failed'].includes(r.status)
  ).length
}

/** Status definitions for UI */
export const INC_STATUSES = [
  { id: 'inc_recorded',            label: 'INC Recorded',            color: 'yellow' },
  { id: 'completion_open',         label: 'Completion Period Open',  color: 'blue'   },
  { id: 'requirements_submitted',  label: 'Requirements Submitted',  color: 'indigo' },
  { id: 'teacher_evaluated',       label: 'Evaluated — Pending Grade', color: 'purple' },
  { id: 'registrar_posted',        label: 'Completed ✓',             color: 'green'  },
  { id: 'auto_failed',             label: 'Auto-Failed (5.00) ✗',    color: 'red'    },
]

// ─────────────────────────────────────────────────────────────────────────────
// WORKFLOW ENGINE INTEGRATION
// ─────────────────────────────────────────────────────────────────────────────

/** Get available actions for a user on an INC completion record. */
export function getINCActions(user, record) {
  const workflowDef = getWorkflowDefinition('inc_completion', 'all')
  if (!workflowDef) return []
  return workflowEngine.getAvailableActions(user, record.status, record, workflowDef)
}

/**
 * Advance an INC completion record through the workflow.
 * Routes to the correct bridge function based on action ID.
 * `extra` carries action-specific payload (note, completionGrade, etc.)
 */
export function advanceINCStep(recordId, actionId, extra = {}, user) {
  const record = getINCCompletionById(recordId)
  if (!record) throw new Error(`INC completion record "${recordId}" not found.`)

  switch (actionId) {
    case 'open_completion':
      return openCompletionPeriod(recordId, user?.name || 'System')
    case 'requirements_received':
      return markRequirementsReceived(recordId, user?.name || 'System', extra.note || '')
    case 'evaluate':
      return evaluateRequirements(recordId, user?.name || 'System', extra.note || '')
    case 'submit_grade':
      return submitCompletionGrade(recordId, user?.name || 'System', extra.completionGrade || '', extra.completionSpecialGrade || null)
    default:
      throw new Error(`Unknown action "${actionId}" for INC completion.`)
  }
}

/** Get the workflow step definition for display purposes (label, color). */
export function getINCStepDef(record) {
  const workflowDef = getWorkflowDefinition('inc_completion', 'all')
  if (!workflowDef) return null
  return workflowEngine.getStep(record.status, workflowDef)
}
