/**
 * documentBridge.js — ALMIRENE DX Document Requests & Student Clearance
 *
 * Two bridges in one file — they're tightly coupled.
 * Swap localStorage calls for API calls when ASP.NET backend is ready.
 *
 * localStorage keys:
 *   almirene_documents  — document request records
 *   almirene_clearance  — clearance records per student per school year
 *
 * Events:
 *   almirene_documents_updated
 *   almirene_clearance_updated
 */

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const DOC_KEY       = 'almirene_documents'
const CLEAR_KEY     = 'almirene_clearance'
const DOC_EVENT     = 'almirene_documents_updated'
const CLEAR_EVENT   = 'almirene_clearance_updated'

function uid(prefix = 'doc') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

// ── Document types per department ──────────────────────────────
export const BASIC_ED_DOCUMENT_TYPES = [
  { id: 'enrollment_form',       label: 'Enrollment Form',                  requiresClearance: false, fee: 0   },
  { id: 'form138',               label: 'Report Card (Form 138)',            requiresClearance: false, fee: 0   },
  { id: 'certificate_enrollment',label: 'Certificate of Enrollment',         requiresClearance: false, fee: 50  },
  { id: 'good_moral',            label: 'Good Moral Certificate',            requiresClearance: false, fee: 50  },
  { id: 'transfer_credentials',  label: 'Transfer Credentials',              requiresClearance: true,  fee: 100 },
  { id: 'form137',               label: 'Form 137 (Permanent Record)',        requiresClearance: true,  fee: 0   },
  { id: 'form138_transfer',      label: 'Form 138 (for Transfer)',            requiresClearance: true,  fee: 0   },
]

export const COLLEGE_DOCUMENT_TYPES = [
  { id: 'certificate_enrollment',label: 'Certificate of Enrollment',         requiresClearance: false, fee: 50  },
  { id: 'certificate_grades',    label: 'Certificate of Grades',             requiresClearance: false, fee: 50  },
  { id: 'transcript',            label: 'Transcript of Records',             requiresClearance: true,  fee: 200 },
  { id: 'good_moral',            label: 'Good Moral Certificate',            requiresClearance: false, fee: 50  },
  { id: 'honorable_dismissal',   label: 'Honorable Dismissal',               requiresClearance: true,  fee: 100 },
  { id: 'certification',         label: 'Certification',                     requiresClearance: false, fee: 50  },
  { id: 'cor',                   label: 'Certificate of Registration (COR)', requiresClearance: false, fee: 0   },
]

export const REQUEST_STATUSES = [
  { id: 'requested',   label: 'Requested',        color: 'yellow' },
  { id: 'processing',  label: 'Processing',        color: 'blue'   },
  { id: 'for_payment', label: 'For Payment',       color: 'orange' },
  { id: 'ready',       label: 'Ready for Pickup',  color: 'indigo' },
  { id: 'released',    label: 'Released',          color: 'green'  },
  { id: 'cancelled',   label: 'Cancelled',         color: 'gray'   },
]

export const CLEARANCE_DEPARTMENTS = [
  { id: 'library',   label: 'Library',      autoFromPayment: false },
  { id: 'accounting',label: 'Accounting',   autoFromPayment: true  },
  { id: 'registrar', label: 'Registrar',    autoFromPayment: false },
  { id: 'guidance',  label: 'Guidance',     autoFromPayment: false },
  { id: 'admin',     label: 'Admin Office', autoFromPayment: false },
]

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function loadDocs() {
  try { return JSON.parse(localStorage.getItem(DOC_KEY) || '[]') }
  catch { return [] }
}

function saveDocs(data) {
  localStorage.setItem(DOC_KEY, JSON.stringify(data))
  window.dispatchEvent(new CustomEvent(DOC_EVENT))
}

function loadClearances() {
  try { return JSON.parse(localStorage.getItem(CLEAR_KEY) || '[]') }
  catch { return [] }
}

function saveClearances(data) {
  localStorage.setItem(CLEAR_KEY, JSON.stringify(data))
  window.dispatchEvent(new CustomEvent(CLEAR_EVENT))
}

/** Get student payment balance from almirene_students (or almirene_submissions fallback) */
function getStudentBalance(studentId) {
  try {
    const students = JSON.parse(localStorage.getItem('almirene_students') || '[]')
    const student  = students.find(s => s.id === studentId)
    if (student) return student.balance ?? 0
  } catch {}
  return 0
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENT REQUEST BRIDGE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get document requests with optional filters.
 * @param {object} filters — { campusKey, schoolYear, status, studentId, department }
 */
export function getRequests(filters = {}) {
  let records = loadDocs()
  if (filters.campusKey)  records = records.filter(r => r.campusKey   === filters.campusKey)
  if (filters.schoolYear) records = records.filter(r => r.schoolYear  === filters.schoolYear)
  if (filters.status)     records = records.filter(r => r.status      === filters.status)
  if (filters.studentId)  records = records.filter(r => r.studentId   === filters.studentId)
  if (filters.department) records = records.filter(r => r.department  === filters.department)
  return records.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

/**
 * Get a single request by ID.
 */
export function getRequestById(id) {
  return loadDocs().find(r => r.id === id) ?? null
}

/**
 * Create a new document request.
 * @param {object} data
 */
export function createRequest(data) {
  const docs = loadDocs()
  const now  = new Date().toISOString()

  const record = {
    id:            uid('doc'),
    studentId:     data.studentId,
    studentName:   data.studentName,
    studentGrade:  data.studentGrade  ?? '',
    campusKey:     data.campusKey,
    campusName:    data.campusName    ?? '',
    schoolYear:    data.schoolYear,
    department:    data.department    ?? 'basicEd',

    documentType:  data.documentType,
    documentLabel: data.documentLabel ?? data.documentType,
    purpose:       data.purpose       ?? '',
    requestedBy:   data.requestedBy   ?? 'admin', // 'student' | 'parent' | 'admin'
    requestorName: data.requestorName ?? '',

    // Fee
    fee:           data.fee           ?? 0,
    paidAt:        null,

    // Clearance requirement
    requiresClearance: data.requiresClearance ?? false,
    clearanceId:   null,

    // Workflow
    status:        'requested',
    statusHistory: [{
      status: 'requested',
      by:     data.createdBy     ?? 'system',
      byName: data.createdByName ?? 'System',
      note:   'Request submitted',
      at:     now,
    }],

    // Release info
    claimSlip:     null,
    releasedTo:    null,
    releasedAt:    null,

    createdAt:     now,
    updatedAt:     now,
  }

  docs.push(record)
  saveDocs(docs)
  return record
}

/**
 * Move a request to a new status.
 * @param {string} id
 * @param {string} status
 * @param {string} byName
 * @param {string} [note]
 */
export function updateStatus(id, status, byName, note = '') {
  const docs = loadDocs()
  const idx  = docs.findIndex(r => r.id === id)
  if (idx < 0) throw new Error(`Document request "${id}" not found.`)

  const now = new Date().toISOString()
  docs[idx] = {
    ...docs[idx],
    status,
    statusHistory: [
      ...docs[idx].statusHistory,
      { status, by: byName, byName, note, at: now },
    ],
    updatedAt: now,
  }
  saveDocs(docs)
  return docs[idx]
}

/**
 * Accounting confirms processing fee paid.
 */
export function recordPayment(id, byName) {
  const docs = loadDocs()
  const idx  = docs.findIndex(r => r.id === id)
  if (idx < 0) throw new Error(`Document request "${id}" not found.`)

  const now = new Date().toISOString()
  docs[idx] = {
    ...docs[idx],
    paidAt:    now,
    status:    'ready',
    statusHistory: [
      ...docs[idx].statusHistory,
      { status: 'ready', by: byName, byName, note: 'Processing fee confirmed.', at: now },
    ],
    updatedAt: now,
  }
  saveDocs(docs)
  return docs[idx]
}

/**
 * Release a document to the student/parent.
 * Blocked if requiresClearance and clearance not fully complete.
 */
export function releaseDocument(id, { releasedTo, claimSlip, byName }) {
  const docs = loadDocs()
  const idx  = docs.findIndex(r => r.id === id)
  if (idx < 0) throw new Error(`Document request "${id}" not found.`)

  const record = docs[idx]

  // Guard — clearance required
  if (record.requiresClearance && record.clearanceId) {
    if (!isFullyCleared(record.clearanceId)) {
      throw new Error('Student clearance is not yet complete. Cannot release this document.')
    }
  }

  const now = new Date().toISOString()
  docs[idx] = {
    ...record,
    status:     'released',
    releasedTo,
    claimSlip:  claimSlip ?? null,
    releasedAt: now,
    statusHistory: [
      ...record.statusHistory,
      { status: 'released', by: byName, byName, note: `Released to: ${releasedTo}`, at: now },
    ],
    updatedAt: now,
  }
  saveDocs(docs)
  return docs[idx]
}

/**
 * Cancel a request.
 */
export function cancelRequest(id, byName, reason = '') {
  return updateStatus(id, 'cancelled', byName, reason)
}

// ─────────────────────────────────────────────────────────────────────────────
// CLEARANCE BRIDGE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get clearances with optional filters.
 */
export function getClearances(filters = {}) {
  let records = loadClearances()
  if (filters.campusKey)  records = records.filter(r => r.campusKey  === filters.campusKey)
  if (filters.schoolYear) records = records.filter(r => r.schoolYear === filters.schoolYear)
  if (filters.studentId)  records = records.filter(r => r.studentId  === filters.studentId)
  if (filters.isFullyCleared !== undefined)
    records = records.filter(r => r.isFullyCleared === filters.isFullyCleared)
  return records.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

/**
 * Get a single clearance record by ID.
 */
export function getClearanceById(id) {
  return loadClearances().find(r => r.id === id) ?? null
}

/**
 * Create a new clearance record for a student.
 * Accounting cleared status is auto-set based on payment balance.
 * @param {string} studentId
 * @param {string} studentName
 * @param {string} campusKey
 * @param {string} schoolYear
 * @param {string} [reason] — optional context (e.g. "Transfer out", "Graduation")
 */
export function createClearance(studentId, studentName, campusKey, schoolYear, reason = '') {
  // Check for existing active clearance for this student+SY
  const existing = loadClearances().find(
    r => r.studentId === studentId && r.schoolYear === schoolYear && !r.isFullyCleared
  )
  if (existing) return existing  // Return existing rather than duplicating

  const now     = new Date().toISOString()
  const balance = getStudentBalance(studentId)

  const departments = {}
  CLEARANCE_DEPARTMENTS.forEach(dept => {
    const autoCleared = dept.autoFromPayment && balance === 0
    departments[dept.id] = {
      cleared:   autoCleared,
      clearedBy: autoCleared ? 'System (auto — no balance)' : null,
      clearedAt: autoCleared ? now : null,
    }
  })

  const record = {
    id:              uid('clr'),
    studentId,
    studentName,
    campusKey,
    schoolYear,
    reason,
    departments,
    hasUnpaidBalance: balance > 0,
    isFullyCleared:   false,
    requestedAt:      now,
    completedAt:      null,
    createdAt:        now,
    updatedAt:        now,
  }

  const all = loadClearances()
  all.push(record)
  saveClearances(all)
  return record
}

/**
 * Sign off a single department clearance.
 * Immutable once signed — cannot be reversed (use Super Admin override only).
 * Auto-evaluates isFullyCleared after each sign-off.
 *
 * @param {string} clearanceId
 * @param {string} deptId — e.g. 'library', 'accounting'
 * @param {string} clearedByName
 */
export function updateDepartmentClearance(clearanceId, deptId, clearedByName) {
  const all = loadClearances()
  const idx = all.findIndex(r => r.id === clearanceId)
  if (idx < 0) throw new Error(`Clearance "${clearanceId}" not found.`)

  const record = all[idx]
  if (record.departments[deptId]?.cleared) {
    throw new Error(`${deptId} clearance is already signed. Cannot unsign.`)
  }

  const now = new Date().toISOString()
  record.departments[deptId] = {
    cleared:   true,
    clearedBy: clearedByName,
    clearedAt: now,
  }

  // Re-evaluate isFullyCleared
  record.isFullyCleared = evaluateFullyClear(record)
  if (record.isFullyCleared) record.completedAt = now
  record.updatedAt = now

  all[idx] = record
  saveClearances(all)
  return record
}

/**
 * Re-check accounting clearance status based on current payment balance.
 * Called whenever a payment is recorded or updated.
 *
 * @param {string} clearanceId
 */
export function checkAccountingStatus(clearanceId) {
  const all = loadClearances()
  const idx = all.findIndex(r => r.id === clearanceId)
  if (idx < 0) return null

  const record  = all[idx]
  const balance = getStudentBalance(record.studentId)
  const now     = new Date().toISOString()

  record.hasUnpaidBalance = balance > 0

  if (balance === 0 && !record.departments.accounting?.cleared) {
    record.departments.accounting = {
      cleared:   true,
      clearedBy: 'System (auto — balance settled)',
      clearedAt: now,
    }
  } else if (balance > 0 && record.departments.accounting?.clearedBy?.startsWith('System')) {
    // If auto-cleared by system but balance came back (edge case), reset it
    record.departments.accounting = {
      cleared:   false,
      clearedBy: null,
      clearedAt: null,
    }
  }

  record.isFullyCleared = evaluateFullyClear(record)
  if (record.isFullyCleared && !record.completedAt) record.completedAt = now
  record.updatedAt = now

  all[idx] = record
  saveClearances(all)
  return record
}

/**
 * Check if a clearance record is fully cleared.
 * @param {string} clearanceId
 * @returns {boolean}
 */
export function isFullyCleared(clearanceId) {
  const record = getClearanceById(clearanceId)
  if (!record) return false
  return evaluateFullyClear(record)
}

/** Internal helper — evaluates all department cleared statuses */
function evaluateFullyClear(record) {
  if (record.hasUnpaidBalance) return false
  return CLEARANCE_DEPARTMENTS.every(dept => record.departments[dept.id]?.cleared === true)
}

/**
 * Link a clearance record to a document request.
 * Called when a clearance-required document request is created.
 */
export function linkClearanceToRequest(requestId, clearanceId) {
  const docs = loadDocs()
  const idx  = docs.findIndex(r => r.id === requestId)
  if (idx < 0) return
  docs[idx].clearanceId = clearanceId
  docs[idx].updatedAt   = new Date().toISOString()
  saveDocs(docs)
}

/**
 * Get pending clearance count for a specific department.
 * Used by Sidebar badge or dashboard count.
 */
export function getPendingClearanceCount(deptId, campusKey) {
  return loadClearances().filter(
    r => r.campusKey === campusKey &&
         !r.isFullyCleared &&
         !r.departments[deptId]?.cleared
  ).length
}

/**
 * Get pending document requests count.
 * Used by Sidebar badge.
 */
export function getPendingRequestsCount(campusKey) {
  return loadDocs().filter(
    r => r.campusKey === campusKey &&
         !['released', 'cancelled'].includes(r.status)
  ).length
}

// Normalise legacy 'ready' → 'ready_for_pickup' to match workflow engine step ID
function normaliseStatus(status) {
  return status === 'ready' ? 'ready_for_pickup' : status
}

// ─────────────────────────────────────────────────────────────────────────────
// WORKFLOW ENGINE INTEGRATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get available actions for a user on a document request.
 * Reads from the 'document_request' workflow definition.
 * Returns [] if no actions available at this step for this role.
 */
export function getDocumentActions(user, request) {
  const workflowDef = getWorkflowDefinition('document_request', request.campusKey || 'all')
  if (!workflowDef) return []
  const step = normaliseStatus(request.status)
  return workflowEngine.getAvailableActions(user, step, request, workflowDef)
}

/**
 * Advance a document request through the workflow.
 * Calls updateStatus internally — single source of truth.
 * When backend is ready, swap the updateStatus call for an API call.
 */
export function advanceDocumentStep(requestId, actionId, note = '', user) {
  const request = getRequestById(requestId)
  if (!request) throw new Error(`Document request "${requestId}" not found.`)

  const workflowDef = getWorkflowDefinition('document_request', request.campusKey || 'all')
  if (!workflowDef) throw new Error('Document request workflow not configured.')

  const currentStep = normaliseStatus(request.status)
  const stepDef     = workflowEngine.getStep(currentStep, workflowDef)
  if (!stepDef) throw new Error(`Unknown step: ${currentStep}`)

  const action = stepDef.actions.find(a => a.id === actionId)
  if (!action) throw new Error(`Action "${actionId}" not available at step "${currentStep}".`)

  const nextStep = action.nextStep
  if (!nextStep) throw new Error(`Action "${actionId}" has no nextStep defined.`)

  // Check workflow conditions
  const blocked = (stepDef.conditions || []).find(c =>
    c.type === 'block_if' && c.actionId === actionId && evaluateCondition(c, request)
  )
  if (blocked) throw new Error(blocked.reason || 'This action is currently blocked.')

  // Handle release action specially (needs releasedTo etc.)
  if (nextStep === 'released') {
    releaseDocument(requestId, {
      releasedTo: request.releasedTo || note || 'Student',
      claimSlip:  request.claimSlip || '',
      byName:     user?.name || 'System',
    })
  } else {
    updateStatus(requestId, nextStep, user?.name || 'System', note)
  }

  return getRequestById(requestId)
}

function evaluateCondition(condition, request) {
  const val = request[condition.field]
  switch (condition.operator) {
    case 'equals':     return val === condition.value
    case 'not_equals': return val !== condition.value
    default:           return false
  }
}

/**
 * Get the current step definition from the workflow for display purposes.
 * Returns null if workflow not found.
 */
export function getDocumentStepDef(request) {
  const workflowDef = getWorkflowDefinition('document_request', request.campusKey || 'all')
  if (!workflowDef) return null
  return workflowEngine.getStep(normaliseStatus(request.status), workflowDef)
}


// ─────────────────────────────────────────────────────────────────────────────
// CLEARANCE WORKFLOW ENGINE INTEGRATION
// ─────────────────────────────────────────────────────────────────────────────

// Map clearance department state to workflow step ID
// The workflow is sequential: initiated → library → accounting → registrar → guidance → admin_office → fully_cleared
const DEPT_STEP_ORDER = ['library', 'accounting', 'registrar', 'guidance', 'admin_office']
const DEPT_TO_STEP_ID = {
  library:     'library',
  accounting:  'accounting',
  registrar:   'registrar',
  guidance:    'guidance',
  admin:       'admin_office',  // bridge uses 'admin', workflow uses 'admin_office'
}
const STEP_TO_DEPT_ID = {
  library:     'library',
  accounting:  'accounting',
  registrar:   'registrar',
  guidance:    'guidance',
  admin_office:'admin',
}

/**
 * Derive the current workflow step from the clearance's department sign-off state.
 * The step = the first department not yet cleared (in order).
 * If all cleared → 'fully_cleared'. If none started → 'initiated'.
 */
function getClearanceCurrentStep(clearance) {
  if (clearance.isFullyCleared) return 'fully_cleared'
  for (const deptId of DEPT_STEP_ORDER) {
    const bridgeDept = deptId === 'admin_office' ? 'admin' : deptId
    if (!clearance.departments?.[bridgeDept]?.cleared) {
      return deptId  // this is the next dept to clear
    }
  }
  return 'fully_cleared'
}

/**
 * Get available actions for a user on a clearance.
 * Reads from the 'student_clearance' workflow definition.
 */
export function getClearanceActions(user, clearance) {
  const workflowDef = getWorkflowDefinition('student_clearance', clearance.campusKey || 'all')
  if (!workflowDef) return []
  if (clearance.isFullyCleared) return []
  const step = getClearanceCurrentStep(clearance)
  // Build a surrogate record the engine can evaluate conditions against
  const surrogate = {
    ...clearance,
    currentStep:    step,
    paymentBalance: clearance.hasUnpaidBalance ? 1 : 0,
  }
  return workflowEngine.getAvailableActions(user, step, surrogate, workflowDef)
}

/**
 * Advance a clearance through the workflow by signing the current department.
 * Routes to updateDepartmentClearance internally.
 */
export function advanceClearanceStep(clearanceId, actionId, note = '', user) {
  const clearance = getClearanceById(clearanceId)
  if (!clearance) throw new Error(`Clearance "${clearanceId}" not found.`)
  if (clearance.isFullyCleared) throw new Error('Clearance is already fully cleared.')

  const workflowDef = getWorkflowDefinition('student_clearance', clearance.campusKey || 'all')
  if (!workflowDef) throw new Error('Student clearance workflow not configured.')

  const currentStep = getClearanceCurrentStep(clearance)
  const stepDef     = workflowEngine.getStep(currentStep, workflowDef)
  if (!stepDef) throw new Error(`Unknown clearance step: ${currentStep}`)

  const action = stepDef.actions.find(a => a.id === actionId)
  if (!action) throw new Error(`Action "${actionId}" not available at step "${currentStep}".`)

  // Check blocking conditions (e.g. unpaid balance blocks accounting)
  const surrogate = { ...clearance, paymentBalance: clearance.hasUnpaidBalance ? 1 : 0 }
  const blocked = (stepDef.conditions || []).find(c =>
    c.type === 'block_if' && evaluateClearanceCondition(c, surrogate)
  )
  if (blocked) throw new Error(blocked.reason || 'This action is currently blocked.')

  // Map step ID → dept ID and sign it
  const deptId = STEP_TO_DEPT_ID[currentStep] || currentStep
  updateDepartmentClearance(clearanceId, deptId, user?.name || 'System', note)
  return getClearanceById(clearanceId)
}

function evaluateClearanceCondition(condition, record) {
  const val = record[condition.field]
  switch (condition.operator) {
    case 'greater_than': return Number(val) > Number(condition.value)
    case 'equals':       return val === condition.value
    case 'not_equals':   return val !== condition.value
    default:             return false
  }
}

/**
 * Get the current workflow step definition for display (label, color).
 */
export function getClearanceStepDef(clearance) {
  const workflowDef = getWorkflowDefinition('student_clearance', clearance.campusKey || 'all')
  if (!workflowDef) return null
  const step = getClearanceCurrentStep(clearance)
  return workflowEngine.getStep(step, workflowDef)
}

/**
 * Get the derived current step ID for a clearance (for display/filtering).
 */
export function getClearanceStep(clearance) {
  return getClearanceCurrentStep(clearance)
}