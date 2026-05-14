/**
 * enrollmentBridge.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared bridge between the school website enrollment form and the
 * ALMIRENE DX Admin Portal.
 *
 * ── SECTION 1: WEBSITE SUBMISSION BRIDGE (original — preserved) ──────────────
 *   Used by the school website enrollment.js and the Enrollments page.
 *   Storage key: 'almirene_submissions'  (legacy key — do not rename until backend)
 *
 * ── SECTION 2: WORKFLOW ENGINE INTEGRATION (new) ─────────────────────────────
 *   Used by the new workflow-driven enrollment management.
 *   Storage key: 'almirene_enrollments'
 *   All stage transitions go through workflowEngine.validateTransition()
 *   and workflowEngine.executeTransition() — zero hardcoded role checks.
 *
 * Migration plan:
 *   When Enrollments.jsx is refactored to use Section 2, Section 1 can be
 *   retired. Until then, both coexist safely — different storage keys.
 */

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1: WEBSITE SUBMISSION BRIDGE (original — do not modify)
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY  = 'almirene_submissions'
const COUNTER_KEY  = 'almirene_ref_counter'

// ── Campus name mapping (website value → portal name) ──────────
const CAMPUS_MAP = {
  talisay: 'Talisay City Campus',
  carcar:  'Carcar City Campus',
  bohol:   'Bohol Campus',
}

// ── Grade level mapping (website option value → portal label) ──
const GRADE_MAP = {
  nursery:       'Nursery',
  kindergarten:  'Kindergarten',
  preparatory:   'Preparatory',
  grade1:        'Grade 1',
  grade2:        'Grade 2',
  grade3:        'Grade 3',
  grade4:        'Grade 4',
  grade5:        'Grade 5',
  grade6:        'Grade 6',
  grade7:        'Grade 7',
  grade8:        'Grade 8',
  grade9:        'Grade 9',
  grade10:       'Grade 10',
  grade11:       'Grade 11',
  grade12:       'Grade 12',
  bsnursing1:    'BS Nursing - 1st Year',
  bsnursing2:    'BS Nursing - 2nd Year',
  bsnursing3:    'BS Nursing - 3rd Year',
  bsnursing4:    'BS Nursing - 4th Year',
  bshrm1:        'BS HRM - 1st Year',
  bshrm2:        'BS HRM - 2nd Year',
  bshrm3:        'BS HRM - 3rd Year',
  bshrm4:        'BS HRM - 4th Year',
  bstourism1:    'BS Tourism - 1st Year',
  bstourism2:    'BS Tourism - 2nd Year',
  bstourism3:    'BS Tourism - 3rd Year',
  bstourism4:    'BS Tourism - 4th Year',
  bscrim1:       'BS Criminology - 1st Year',
  bscrim2:       'BS Criminology - 2nd Year',
  bscrim3:       'BS Criminology - 3rd Year',
  bscrim4:       'BS Criminology - 4th Year',
}

// ── Student type mapping ────────────────────────────────────────
const TYPE_MAP = {
  new:        'New',
  transferee: 'Transferee',
  returnee:   'Returnee',
}

// ── Generate sequential reference number ───────────────────────
function generateReferenceNumber() {
  const year = new Date().getFullYear()
  const stored = localStorage.getItem(COUNTER_KEY)
  const counter = stored ? parseInt(stored, 10) + 1 : 1000
  localStorage.setItem(COUNTER_KEY, counter.toString())
  return `ALMIRENE-${year}-W${String(counter).padStart(4, '0')}`
}

// ── Normalize raw website form data into portal format ──────────
function normalizeFormData(raw, refNum) {
  const campusKey  = raw.campus || ''
  const gradeRaw   = raw.gradeLevel || ''
  const typeRaw    = raw.studentType || ''

  let age = ''
  if (raw.birthDate) {
    const bd    = new Date(raw.birthDate)
    const today = new Date()
    let a = today.getFullYear() - bd.getFullYear()
    if (today.getMonth() < bd.getMonth() ||
       (today.getMonth() === bd.getMonth() && today.getDate() < bd.getDate())) {
      a--
    }
    age = String(a)
  }

  return {
    id:              refNum,
    referenceNumber: refNum,
    status:          'pending',
    source:          'website',
    submittedDate:   new Date().toISOString(),

    student: {
      firstName:     raw.firstName     || '',
      middleName:    raw.middleName    || '',
      lastName:      raw.lastName      || '',
      birthDate:     raw.birthDate     || '',
      age:           age,
      placeOfBirth:  raw.birthPlace    || '',
      gender:        raw.gender        ? raw.gender.charAt(0).toUpperCase() + raw.gender.slice(1) : '',
      civilStatus:   raw.civilStatus   ? raw.civilStatus.charAt(0).toUpperCase() + raw.civilStatus.slice(1) : '',
      religion:      raw.religion      || '',
      nationality:   raw.nationality   ? raw.nationality.charAt(0).toUpperCase() + raw.nationality.slice(1) : '',
      address:       raw.address       || '',
      email:         raw.email         || '',
      contactNumber: raw.contactNumber || '',
    },

    enrollment: {
      campus:      CAMPUS_MAP[campusKey]  || campusKey,
      gradeLevel:  GRADE_MAP[gradeRaw]    || gradeRaw,
      studentType: TYPE_MAP[typeRaw]      || typeRaw,
      schoolYear:  raw.schoolYear         || '2025-2026',
    },

    father: {
      name:          raw.fatherName       || '',
      occupation:    raw.fatherOccupation || '',
      contactNumber: raw.fatherContact    || '',
    },

    mother: {
      name:          raw.motherName       || '',
      occupation:    raw.motherOccupation || '',
      contactNumber: raw.motherContact    || '',
    },

    guardian: {
      name:          raw.guardianName     || '',
      relationship:  raw.guardianRelation || '',
      contactNumber: raw.guardianContact  || '',
    },

    previousSchool: {
      name:       raw.lastSchool       || raw.elementarySchool || '',
      address:    raw.schoolAddress    || raw.elementaryAddress || '',
      lastGrade:  raw.lastGrade        || '',
      schoolYear: raw.lastSchoolYear   || '',
      elementary: raw.elementarySchool ? {
        name:    raw.elementarySchool   || '',
        address: raw.elementaryAddress  || '',
        year:    raw.elementaryYear     || '',
      } : null,
      juniorHigh: raw.juniorHighSchool ? {
        name:    raw.juniorHighSchool   || '',
        address: raw.juniorHighAddress  || '',
        year:    raw.juniorHighYear     || '',
      } : null,
      seniorHigh: raw.seniorHighSchool ? {
        name:    raw.seniorHighSchool   || '',
        address: raw.seniorHighAddress  || '',
        year:    raw.seniorHighYear     || '',
      } : null,
      lastCollege: raw.lastCollegeSchool ? {
        name:    raw.lastCollegeSchool  || '',
        address: raw.lastCollegeAddress || '',
        year:    raw.lastCollegeYear    || '',
      } : null,
    },
  }
}

// ── PUBLIC API: WEBSITE ─────────────────────────────────────────

/**
 * Called by enrollment.js on form submit.
 */
export function submitToAdminPortal(rawFormData) {
  try {
    const refNum     = generateReferenceNumber()
    const normalized = normalizeFormData(rawFormData, refNum)
    const existing   = getWebsiteSubmissions()
    existing.push(normalized)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing))
    window.dispatchEvent(new CustomEvent('almirene_new_submission', {
      detail: { referenceNumber: refNum }
    }))
    return { success: true, referenceNumber: refNum }
  } catch (err) {
    console.error('[ALMIRENE Bridge] Failed to save submission:', err)
    return { success: false, referenceNumber: null }
  }
}

// ── PUBLIC API: ADMIN PORTAL ────────────────────────────────────

export function getWebsiteSubmissions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function updateSubmissionStatus(referenceNumber, newStatus) {
  try {
    const submissions = getWebsiteSubmissions()
    const idx = submissions.findIndex(s => s.referenceNumber === referenceNumber)
    if (idx !== -1) {
      submissions[idx].status    = newStatus
      submissions[idx].updatedAt = new Date().toISOString()
      localStorage.setItem(STORAGE_KEY, JSON.stringify(submissions))
      return true
    }
    return false
  } catch { return false }
}

export function deleteSubmission(referenceNumber) {
  try {
    const submissions = getWebsiteSubmissions().filter(
      s => s.referenceNumber !== referenceNumber
    )
    localStorage.setItem(STORAGE_KEY, JSON.stringify(submissions))
    return true
  } catch { return false }
}

export function clearAllSubmissions() {
  localStorage.removeItem(STORAGE_KEY)
}

export function getPendingCount() {
  return getWebsiteSubmissions().filter(s => s.status === 'pending').length
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2: WORKFLOW ENGINE INTEGRATION
// New functions for the full enrollment lifecycle with workflow engine.
// Storage key: 'almirene_enrollments' | Event: 'almirene_enrollments_updated'
// ─────────────────────────────────────────────────────────────────────────────

import * as workflowEngine from '../engines/workflowEngine'
import {
  getWorkflowDefinition,
  appendAuditEntry,
} from './workflowConfigBridge'

const ENROLLMENT_KEY   = 'almirene_enrollments'
const STUDENT_KEY      = 'almirene_students'
const ALM_REF_KEY      = 'almirene_ref_counter'
const ENROLLMENT_EVENT = 'almirene_enrollments_updated'
const STUDENT_EVENT    = 'almirene_students_updated'

function loadEnrollments() {
  try { return JSON.parse(localStorage.getItem(ENROLLMENT_KEY) || '[]') }
  catch { return [] }
}

function saveEnrollments(data) {
  localStorage.setItem(ENROLLMENT_KEY, JSON.stringify(data))
  window.dispatchEvent(new CustomEvent(ENROLLMENT_EVENT))
}

function loadStudents() {
  try { return JSON.parse(localStorage.getItem(STUDENT_KEY) || '[]') }
  catch { return [] }
}

function saveStudents(data) {
  localStorage.setItem(STUDENT_KEY, JSON.stringify(data))
  window.dispatchEvent(new CustomEvent(STUDENT_EVENT))
}

function almUid(prefix = 'enr') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

function almRefNo(campusKey, source) {
  const year       = new Date().getFullYear()
  const ctrKey     = `${campusKey}_${year}_${source}`
  let counters     = {}
  try { counters = JSON.parse(localStorage.getItem(ALM_REF_KEY) || '{}') }
  catch { counters = {} }
  counters[ctrKey] = (counters[ctrKey] ?? 0) + 1
  localStorage.setItem(ALM_REF_KEY, JSON.stringify(counters))
  const seq = String(counters[ctrKey]).padStart(4, '0')
  return `ALMIRENE-${year}-${source === 'website' ? 'W' : 'A'}${seq}`
}

function getWorkflowId(department) {
  return department === 'college' ? 'enrollment_college' : 'enrollment_basic_ed'
}

// ── READS ───────────────────────────────────────────────────────

/**
 * Get workflow-managed enrollments.
 * @param {object} filters — { campusKey, schoolYear, currentStep, department, source }
 */
export function getEnrollments(filters = {}) {
  let records = loadEnrollments()
  if (filters.campusKey)   records = records.filter(r => r.campusKey   === filters.campusKey)
  if (filters.schoolYear)  records = records.filter(r => r.schoolYear  === filters.schoolYear)
  if (filters.currentStep) records = records.filter(r => r.currentStep === filters.currentStep)
  if (filters.department)  records = records.filter(r => r.department  === filters.department)
  if (filters.source)      records = records.filter(r => r.source      === filters.source)
  return records.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

export function getEnrollmentById(id) {
  return loadEnrollments().find(r => r.id === id) ?? null
}

// ── CREATES ─────────────────────────────────────────────────────

/**
 * Create a new enrollment (admin walk-in). Resolves workflow initial step.
 */
export function createEnrollment(data) {
  const workflowId  = getWorkflowId(data.department ?? 'basicEd')
  const workflowDef = getWorkflowDefinition(workflowId, data.campusKey ?? 'all')
  const initialStep = workflowEngine.getInitialStep(workflowDef)?.id ?? 'pre_registered'
  const now         = new Date().toISOString()

  const createdBy     = data._createdBy     ?? 'system'
  const createdByName = data._createdByName ?? 'System'
  const createdByRole = data._createdByRole ?? 'registrar_basic'

  const record = {
    ...data,
    id:              almUid('enr'),
    referenceNo:     almRefNo(data.campusKey, 'admin'),
    workflowId,
    workflowVersion: workflowDef?.version ?? 1,
    currentStep:     initialStep,
    previousStep:    null,
    source:          data.source ?? 'admin',
    stageHistory:    [{
      step: initialStep, fromStep: null,
      by: createdBy, byName: createdByName, byRole: createdByRole,
      note: 'Record created', at: now,
    }],
    assessedFees: data.assessedFees ?? 0,
    discount:     data.discount     ?? null,
    netFee:       data.netFee       ?? 0,
    amountPaid:   data.amountPaid   ?? 0,
    balance:      data.balance      ?? 0,
    convertedToStudentId: null,
    createdAt: now, updatedAt: now,
  }

  delete record._createdBy
  delete record._createdByName
  delete record._createdByRole

  const all = loadEnrollments()
  all.push(record)
  saveEnrollments(all)
  return record
}

// ── WORKFLOW TRANSITIONS (main function — replaces all old status updates) ───

/**
 * Advance an enrollment through the workflow.
 * All stage transitions go through here — no exceptions.
 *
 * @param {string} enrollmentId
 * @param {string} actionId      — e.g. 'approve_enrollment', 'reject', 'send_assessment'
 * @param {string} note          — required when action.requiresNote is true
 * @param {object} user          — current authenticated user from useAuth()
 * @param {object} [extraData]   — additional field updates (assessedFees, amountPaid, etc.)
 * @returns {object}             — updated enrollment record
 * @throws {Error}               — on validation failure or missing workflow
 */
export function advanceEnrollmentStep(enrollmentId, actionId, note, user, extraData = {}) {
  const records = loadEnrollments()
  const idx     = records.findIndex(r => r.id === enrollmentId)
  if (idx < 0) throw new Error(`Enrollment "${enrollmentId}" not found.`)

  const record      = records[idx]
  const workflowDef = getWorkflowDefinition(record.workflowId, record.campusKey)
  if (!workflowDef)  throw new Error(`Workflow "${record.workflowId}" not found for campus "${record.campusKey}". Run initializeDefaults() first.`)

  // 1. Validate — engine checks role, action, and all conditions
  const { valid, reason } = workflowEngine.validateTransition(
    user, record.currentStep, actionId, record, workflowDef
  )
  if (!valid) throw new Error(reason)

  // 2. Execute — engine returns new state (does NOT save)
  const { updatedRecord, auditEntry, notificationTrigger } =
    workflowEngine.executeTransition(
      user, record.currentStep, actionId, note, record, workflowDef
    )

  // 3. Merge extra domain-specific field updates
  const merged = { ...updatedRecord, ...extraData, updatedAt: new Date().toISOString() }

  // 4. Auto-create student record when officially enrolled
  if (merged.currentStep === 'officially_enrolled' && !merged.convertedToStudentId) {
    const student = convertToStudent(merged)
    merged.convertedToStudentId = student.id
  }

  // 5. Save
  records[idx] = merged
  saveEnrollments(records)

  // 6. Append immutable audit entry
  appendAuditEntry(auditEntry)

  // 7. Fire notification trigger
  if (notificationTrigger) {
    window.dispatchEvent(new CustomEvent('almirene_notification_trigger', {
      detail: { triggerId: notificationTrigger, record: merged }
    }))
  }

  return merged
}

/**
 * Update enrollment fields without advancing the step.
 * For in-step saves (e.g. typing fee amounts before clicking confirm).
 */
export function updateEnrollmentFields(id, changes) {
  const records = loadEnrollments()
  const idx     = records.findIndex(r => r.id === id)
  if (idx < 0) throw new Error(`Enrollment "${id}" not found.`)
  records[idx] = { ...records[idx], ...changes, updatedAt: new Date().toISOString() }
  saveEnrollments(records)
  return records[idx]
}

export function deleteEnrollment(id) {
  saveEnrollments(loadEnrollments().filter(r => r.id !== id))
}

// ── STUDENT RECORD CREATION ─────────────────────────────────────

/**
 * Convert an approved enrollment to a permanent student record.
 * Called automatically by advanceEnrollmentStep when step = 'officially_enrolled'.
 */
export function convertToStudent(enrollment) {
  const now      = new Date().toISOString()
  const students = loadStudents()

  if (enrollment.convertedToStudentId) {
    return students.find(s => s.id === enrollment.convertedToStudentId) ?? null
  }

  const missingDocs = enrollment.studentType === 'Transferee' &&
    enrollment.documents &&
    Object.values(enrollment.documents).some(v => v === false)

  const student = {
    id:            almUid('stu'),
    studentId:     generateStudentId(enrollment.campusKey, enrollment.schoolYear),
    campusKey:     enrollment.campusKey,
    campusName:    enrollment.campusName ?? enrollment.campus ?? '',
    schoolYear:    enrollment.schoolYear,
    department:    enrollment.department,
    firstName:     enrollment.firstName,
    middleName:    enrollment.middleName ?? '',
    lastName:      enrollment.lastName,
    suffix:        enrollment.suffix ?? '',
    birthDate:     enrollment.birthDate ?? null,
    gender:        enrollment.gender ?? null,
    address:       enrollment.address ?? '',
    contactNumber: enrollment.contactNumber ?? '',
    email:         enrollment.email ?? '',
    gradeLevel:    enrollment.gradeLevel,
    section:       enrollment.section ?? null,
    sectionId:     enrollment.sectionId ?? null,
    studentType:   enrollment.studentType,
    program:       enrollment.program ?? null,
    yearLevel:     enrollment.yearLevel ?? null,
    semester:      enrollment.semester ?? null,
    documents:     enrollment.documents ?? { birthCertificate: true, form138: true, goodMoral: true, others: [] },
    documentStatus: missingDocs ? 'incomplete' : 'complete',
    status:        missingDocs ? 'temporarily_enrolled' : 'officially_enrolled',
    enrollmentId:  enrollment.id,
    referenceNo:   enrollment.referenceNo,
    totalFee:      enrollment.netFee ?? 0,
    amountPaid:    enrollment.amountPaid ?? 0,
    balance:       (enrollment.netFee ?? 0) - (enrollment.amountPaid ?? 0),
    createdAt: now, updatedAt: now,
  }

  students.push(student)
  saveStudents(students)
  return student
}

function generateStudentId(campusKey, schoolYear) {
  const year   = schoolYear ? schoolYear.split('-')[0] : new Date().getFullYear()
  const ctrKey = `student_${campusKey}_${year}`
  let counters = {}
  try { counters = JSON.parse(localStorage.getItem(ALM_REF_KEY) || '{}') }
  catch { counters = {} }
  counters[ctrKey] = (counters[ctrKey] ?? 0) + 1
  localStorage.setItem(ALM_REF_KEY, JSON.stringify(counters))
  return `${year}-${String(counters[ctrKey]).padStart(5, '0')}`
}

// ── STUDENT READS & UPDATES ─────────────────────────────────────

export function getStudents(filters = {}) {
  let records = loadStudents()
  if (filters.campusKey)  records = records.filter(r => r.campusKey  === filters.campusKey)
  if (filters.schoolYear) records = records.filter(r => r.schoolYear === filters.schoolYear)
  if (filters.department) records = records.filter(r => r.department === filters.department)
  if (filters.status)     records = records.filter(r => r.status     === filters.status)
  return records.sort((a, b) => a.lastName.localeCompare(b.lastName))
}

export function getStudentById(id) {
  return loadStudents().find(s => s.id === id) ?? null
}

export function updateStudent(id, changes) {
  const students = loadStudents()
  const idx      = students.findIndex(s => s.id === id)
  if (idx < 0) throw new Error(`Student "${id}" not found.`)

  if (changes.documents) {
    const docs     = { ...students[idx].documents, ...changes.documents }
    const complete = Object.values(docs).every(v => v === true || Array.isArray(v))
    changes.documentStatus = complete ? 'complete' : 'incomplete'
    if (complete && students[idx].status === 'temporarily_enrolled') {
      changes.status = 'officially_enrolled'
    }
  }

  students[idx] = { ...students[idx], ...changes, updatedAt: new Date().toISOString() }
  saveStudents(students)
  return students[idx]
}

// ── PERMISSION HELPERS ──────────────────────────────────────────

/** Get available workflow actions for a user on an enrollment record */
export function getEnrollmentActions(user, enrollment) {
  const workflowDef = getWorkflowDefinition(enrollment.workflowId, enrollment.campusKey)
  if (!workflowDef) return []
  return workflowEngine.getAvailableActions(user, enrollment.currentStep, enrollment, workflowDef)
}

/** Get the step definition for an enrollment's current step */
export function getEnrollmentCurrentStep(enrollment) {
  const workflowDef = getWorkflowDefinition(enrollment.workflowId, enrollment.campusKey)
  return workflowDef ? workflowEngine.getStep(enrollment.currentStep, workflowDef) : null
}

/** Get progress percentage for an enrollment */
export function getEnrollmentProgress(enrollment) {
  const workflowDef = getWorkflowDefinition(enrollment.workflowId, enrollment.campusKey)
  return workflowDef ? workflowEngine.getProgress(enrollment.currentStep, workflowDef) : 0
}