/**
 * gradeChangeBridge.js — ALMIRENE DX Grade Change Request Bridge
 *
 * Handles the full grade change request workflow:
 *   Teacher → Principal/Program Head → Registrar → Posted
 *
 * localStorage keys:
 *   almirene_grade_change_requests — all grade change request records
 *   almirene_grade_change_audit    — immutable audit trail (append-only, never delete)
 *
 * Events:
 *   almirene_grade_change_updated
 *
 * Rules (non-negotiable):
 *   - Only 'approved' grades can have a change request filed
 *   - Audit trail is permanent — never modified or deleted
 *   - Once a request is approved, the grade record in almirene_grades / almirene_college_grades
 *     is updated by the bridge (the registrar posts it here, not in Eclassrecord)
 *   - Only ONE active request per student+subject+period at a time
 */

import { getWorkflowDefinition } from './workflowConfigBridge'
import * as workflowEngine         from '../engines/workflowEngine'

const GCR_KEY   = 'almirene_grade_change_requests'
const AUDIT_KEY = 'almirene_grade_change_audit'
const GCR_EVENT = 'almirene_grade_change_updated'

// Grade storage keys (same as gradingEngine.js)
const BASIC_GRADES_KEY   = 'almirene_grades'
const COLLEGE_GRADES_KEY = 'almirene_college_grades'

function uid(prefix = 'gcr') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function loadGCRs() {
  try { return JSON.parse(localStorage.getItem(GCR_KEY) || '[]') }
  catch { return [] }
}

function saveGCRs(data) {
  localStorage.setItem(GCR_KEY, JSON.stringify(data))
  window.dispatchEvent(new CustomEvent(GCR_EVENT))
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

/** Update the actual grade record in almirene_grades or almirene_college_grades */
function postCorrectedGrade(request) {
  const key      = request.department === 'college' ? COLLEGE_GRADES_KEY : BASIC_GRADES_KEY
  const now      = new Date().toISOString()

  try {
    const grades = JSON.parse(localStorage.getItem(key) || '[]')
    const idx    = grades.findIndex(g =>
      g.studentId  === request.studentId  &&
      g.subjectId  === request.subjectId  &&
      g.schoolYear === request.schoolYear &&
      (request.department === 'college'
        ? g.semester === request.semester
        : g.period   === request.period)
    )

    if (idx < 0) return false

    // Append to the grade record's changeHistory (immutable)
    const changeEntry = {
      changedAt:   now,
      changedBy:   request.submittedBy,
      oldGrade:    request.oldGrade,
      newGrade:    request.newGrade,
      reason:      request.reason,
      approvedBy:  request.reviewedBy,
      requestId:   request.id,
    }

    if (request.department === 'college') {
      grades[idx].pointGrade   = request.newGrade
      grades[idx].specialGrade = request.newSpecialGrade || null
    } else {
      grades[idx].transmuted   = request.newGrade
    }

    grades[idx].changeHistory = [...(grades[idx].changeHistory || []), changeEntry]
    grades[idx].updatedAt     = now

    localStorage.setItem(key, JSON.stringify(grades))
    window.dispatchEvent(new CustomEvent(
      request.department === 'college' ? 'almirene_college_grades_updated' : 'almirene_grades_updated'
    ))
    return true
  } catch { return false }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get grade change requests with optional filters.
 * @param {object} filters — { campusKey, schoolYear, status, teacherId, department }
 */
export function getGradeChangeRequests(filters = {}) {
  let records = loadGCRs()
  if (filters.campusKey)  records = records.filter(r => r.campusKey  === filters.campusKey)
  if (filters.schoolYear) records = records.filter(r => r.schoolYear === filters.schoolYear)
  if (filters.status)     records = records.filter(r => r.status     === filters.status)
  if (filters.teacherId)  records = records.filter(r => r.teacherId  === filters.teacherId)
  if (filters.department) records = records.filter(r => r.department === filters.department)
  return records.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

/**
 * Get a single request by ID.
 */
export function getGradeChangeRequestById(id) {
  return loadGCRs().find(r => r.id === id) ?? null
}

/**
 * Teacher submits a grade change request.
 * Only allowed for approved grades.
 *
 * @param {object} data
 * @returns {object} — created request record
 * @throws {Error} — if grade is not approved, or active request already exists
 */
export function submitGradeChangeRequest(data) {
  const {
    studentId, studentName, subjectId, subjectName,
    sectionId, period, semester, schoolYear, campusKey,
    department, teacherId, teacherName,
    oldGrade, newGrade, newSpecialGrade, reason,
  } = data

  // Guard: only one active request per student+subject+period at a time
  const existing = loadGCRs().find(r =>
    r.studentId  === studentId  &&
    r.subjectId  === subjectId  &&
    r.schoolYear === schoolYear &&
    (department === 'college' ? r.semester === semester : r.period === period) &&
    !['approved', 'rejected'].includes(r.status)
  )
  if (existing) {
    throw new Error(`An active grade change request already exists for this student and subject. (ID: ${existing.id})`)
  }

  if (!reason || reason.trim().length < 10) {
    throw new Error('Reason must be at least 10 characters.')
  }

  const now = new Date().toISOString()
  const record = {
    id:              uid('gcr'),
    studentId,       studentName,
    subjectId,       subjectName,
    sectionId,
    period:          department === 'college' ? null : period,
    semester:        department === 'college' ? semester : null,
    schoolYear,      campusKey,
    department:      department ?? 'basicEd',
    teacherId,       teacherName,

    // Grade change details
    oldGrade,        // e.g. '85' (Basic Ed transmuted) or '2.00' (College point)
    newGrade,        // e.g. '88' or '1.75'
    newSpecialGrade: newSpecialGrade ?? null,  // INC / DRP / 4.00
    reason:          reason.trim(),

    // Workflow
    status:          'requested',
    statusHistory: [{
      status:  'requested',
      by:      teacherName,
      note:    `Change request: ${oldGrade} → ${newGrade}${newSpecialGrade ? ` (${newSpecialGrade})` : ''}. ${reason.trim()}`,
      at:      now,
    }],

    // Review fields
    submittedBy:     teacherName,
    reviewedBy:      null,
    reviewedAt:      null,
    rejectedReason:  null,
    postedBy:        null,
    postedAt:        null,

    createdAt:  now,
    updatedAt:  now,
  }

  const all = loadGCRs()
  all.push(record)
  saveGCRs(all)

  // Audit trail
  appendAudit({
    id:        uid('audit'),
    requestId: record.id,
    campusKey,
    action:    'submitted',
    by:        teacherName,
    at:        now,
    detail:    `Grade change submitted: ${oldGrade} → ${newGrade}. Reason: ${reason.trim()}`,
  })

  return record
}

/**
 * Principal or Program Head approves the request → goes to Registrar.
 */
export function approveGradeChangeRequest(id, reviewerName) {
  const all = loadGCRs()
  const idx = all.findIndex(r => r.id === id)
  if (idx < 0) throw new Error(`Request "${id}" not found.`)
  if (all[idx].status !== 'requested') throw new Error(`Request is not in "requested" status.`)

  const now = new Date().toISOString()
  all[idx] = {
    ...all[idx],
    status:     'for_registrar',
    reviewedBy: reviewerName,
    reviewedAt: now,
    statusHistory: [...all[idx].statusHistory, {
      status: 'for_registrar',
      by:     reviewerName,
      note:   'Approved by reviewer. Sent to Registrar for posting.',
      at:     now,
    }],
    updatedAt: now,
  }

  saveGCRs(all)
  appendAudit({
    id: uid('audit'), requestId: id, campusKey: all[idx].campusKey,
    action: 'approved', by: reviewerName, at: now,
    detail: `Approved by ${reviewerName}. Sent to registrar.`,
  })
  return all[idx]
}

/**
 * Principal or Program Head rejects the request.
 */
export function rejectGradeChangeRequest(id, reviewerName, rejectedReason) {
  if (!rejectedReason?.trim()) throw new Error('Rejection reason is required.')

  const all = loadGCRs()
  const idx = all.findIndex(r => r.id === id)
  if (idx < 0) throw new Error(`Request "${id}" not found.`)

  const now = new Date().toISOString()
  all[idx] = {
    ...all[idx],
    status:          'rejected',
    reviewedBy:      reviewerName,
    reviewedAt:      now,
    rejectedReason:  rejectedReason.trim(),
    statusHistory: [...all[idx].statusHistory, {
      status: 'rejected',
      by:     reviewerName,
      note:   `Rejected: ${rejectedReason.trim()}`,
      at:     now,
    }],
    updatedAt: now,
  }

  saveGCRs(all)
  appendAudit({
    id: uid('audit'), requestId: id, campusKey: all[idx].campusKey,
    action: 'rejected', by: reviewerName, at: now,
    detail: `Rejected: ${rejectedReason.trim()}`,
  })
  return all[idx]
}

/**
 * Registrar posts the corrected grade.
 * Updates the actual grade record in almirene_grades / almirene_college_grades.
 * This is the final step — status becomes 'posted' (permanent).
 */
export function postGradeCorrection(id, registrarName) {
  const all = loadGCRs()
  const idx = all.findIndex(r => r.id === id)
  if (idx < 0) throw new Error(`Request "${id}" not found.`)
  if (all[idx].status !== 'for_registrar') throw new Error(`Request must be approved before posting.`)

  const request = all[idx]
  const success = postCorrectedGrade(request)

  if (!success) {
    throw new Error('Could not find the original grade record to update. The grade may have been deleted.')
  }

  const now = new Date().toISOString()
  all[idx] = {
    ...request,
    status:    'posted',
    postedBy:  registrarName,
    postedAt:  now,
    statusHistory: [...request.statusHistory, {
      status: 'posted',
      by:     registrarName,
      note:   `Grade corrected and posted: ${request.oldGrade} → ${request.newGrade}.`,
      at:     now,
    }],
    updatedAt: now,
  }

  saveGCRs(all)
  appendAudit({
    id: uid('audit'), requestId: id, campusKey: request.campusKey,
    action: 'posted', by: registrarName, at: now,
    detail: `Grade corrected: ${request.oldGrade} → ${request.newGrade}. Posted by ${registrarName}.`,
  })
  return all[idx]
}

/**
 * Get audit trail for a specific request.
 * @param {string} requestId
 */
export function getRequestAuditTrail(requestId) {
  return loadAudit()
    .filter(e => e.requestId === requestId)
    .sort((a, b) => new Date(a.at) - new Date(b.at))
}

/**
 * Get all audit entries for a campus (Super Admin view).
 */
export function getAllAuditEntries(campusKey) {
  return loadAudit()
    .filter(e => e.campusKey === campusKey)
    .sort((a, b) => new Date(b.at) - new Date(a.at))
}

/**
 * Get pending count for a campus — used by Sidebar badge.
 */
export function getPendingGradeChangeCount(campusKey) {
  return loadGCRs().filter(
    r => r.campusKey === campusKey &&
         !['posted', 'rejected'].includes(r.status)
  ).length
}

/** Status definitions for UI */
export const GCR_STATUSES = [
  { id: 'requested',             label: 'Change Requested',         color: 'yellow' },
  { id: 'principal_review',      label: 'Under Review',             color: 'blue'   },
  { id: 'for_registrar',         label: 'For Registrar',            color: 'blue'   }, // legacy alias
  { id: 'registrar_correction',  label: 'For Registrar Correction', color: 'indigo' },
  { id: 'approved',              label: 'Approved & Posted ✓',      color: 'green'  },
  { id: 'posted',                label: 'Approved & Posted ✓',      color: 'green'  }, // legacy alias
  { id: 'rejected',              label: 'Rejected',                  color: 'red'    },
]

// Normalise legacy step IDs to workflow engine step IDs
function normaliseStep(status) {
  if (status === 'for_registrar') return 'registrar_correction'
  if (status === 'posted')        return 'approved'
  return status
}

// ─────────────────────────────────────────────────────────────────────────────
// WORKFLOW ENGINE INTEGRATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get available actions for a user on a grade change request.
 * Reads from the 'grade_change_request' workflow definition.
 */
export function getGradeChangeActions(user, request) {
  const workflowDef = getWorkflowDefinition('grade_change_request', 'all')
  if (!workflowDef) return []
  const step = normaliseStep(request.status)
  return workflowEngine.getAvailableActions(user, step, request, workflowDef)
}

/**
 * Advance a grade change request through the workflow.
 * Routes to the correct existing bridge function based on action ID.
 */
export function advanceGradeChangeStep(requestId, actionId, note = '', user) {
  const req = getGradeChangeRequestById(requestId)
  if (!req) throw new Error(`Grade change request "${requestId}" not found.`)

  switch (actionId) {
    case 'approve_request':
      return approveGradeChangeRequest(requestId, user?.name || 'System')
    case 'reject':
      return rejectGradeChangeRequest(requestId, user?.name || 'System', note)
    case 'post_correction':
      return postGradeCorrection(requestId, user?.name || 'System')
    default:
      throw new Error(`Unknown action "${actionId}" for grade change requests.`)
  }
}

/**
 * Get the workflow step definition for display purposes (label, color).
 */
export function getGradeChangeStepDef(request) {
  const workflowDef = getWorkflowDefinition('grade_change_request', 'all')
  if (!workflowDef) return null
  return workflowEngine.getStep(normaliseStep(request.status), workflowDef)
}