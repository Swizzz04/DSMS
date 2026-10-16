/**
 * documentBridge.js — ALMIRENE DX Document Requests & Student Clearance
 *
 * Two bridges in one file — they're tightly coupled.
 * Swap localStorage calls for API calls when ASP.NET backend is ready.
 *
 * localStorage keys:
 *   almirene_documents  — document request records
 *   almirene_clearance  — clearance records per student per school year
 *   almirene_document_catalog — per-campus document types and prices (set by accounting)
 *
 * Events:
 *   almirene_documents_updated
 *   almirene_clearance_updated
 *   almirene_document_catalog_updated
 */

import { getWorkflowDefinition } from './workflowConfigBridge'
import * as workflowEngine       from '../engines/workflowEngine'
import { isOrNumberUsed }        from './orNumbers'
import { DOCUMENT_PAYMENT_METHODS, DEFAULT_DOCUMENT_TYPES } from '../config/appConfig'

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const DOC_KEY       = 'almirene_documents'
const CLEAR_KEY     = 'almirene_clearance'
const DOC_EVENT     = 'almirene_documents_updated'
const CLEAR_EVENT   = 'almirene_clearance_updated'
const CATALOG_KEY   = 'almirene_document_catalog'
const CATALOG_EVENT = 'almirene_document_catalog_updated'

function uid(prefix = 'doc') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

// ── Document types per department ──────────────────────────────
// Defaults live in appConfig.js. These two stay exported for anything that wants
// the unedited list; pages should call getDocumentTypes(campusKey, department),
// which returns the campus's own prices when accounting has set them.
export const BASIC_ED_DOCUMENT_TYPES = DEFAULT_DOCUMENT_TYPES.basicEd
export const COLLEGE_DOCUMENT_TYPES  = DEFAULT_DOCUMENT_TYPES.college

function loadCatalog() {
  try { return JSON.parse(localStorage.getItem(CATALOG_KEY) || '{}') || {} }
  catch { return {} }
}

function saveCatalog(data) {
  localStorage.setItem(CATALOG_KEY, JSON.stringify(data))
  window.dispatchEvent(new CustomEvent(CATALOG_EVENT))
}

const normDept = (d) => (d === 'college' ? 'college' : 'basicEd')

/**
 * Document types (with this campus's prices) for a department.
 * Falls back to the defaults until accounting edits the campus's list.
 */
export function getDocumentTypes(campusKey, department = 'basicEd') {
  const dept   = normDept(department)
  const custom = loadCatalog()?.[campusKey]?.[dept]
  const list   = Array.isArray(custom) ? custom : DEFAULT_DOCUMENT_TYPES[dept]
  return list.map(t => ({ ...t }))
}

/** True when the campus has its own list for this department (not the defaults). */
export function hasCustomDocumentTypes(campusKey, department = 'basicEd') {
  return Array.isArray(loadCatalog()?.[campusKey]?.[normDept(department)])
}

const CATALOG_ROLES = ['accounting', 'admin', 'technical_admin']

/**
 * Save a campus's document list for one department.
 * Replaces the whole list (rows can be edited, added or removed).
 * Requests already recorded keep the label and fee they were recorded with.
 *
 * @param {string} campusKey
 * @param {'basicEd'|'college'} department
 * @param {Array}  types  [{ id?, label, fee, requiresClearance }]
 * @param {object} user   must be accounting / admin / technical_admin
 * @returns {Array} the saved list
 */
export function saveDocumentTypes(campusKey, department, types, user) {
  if (!CATALOG_ROLES.includes(user?.role)) throw new Error('You are not allowed to change document fees.')
  if (!campusKey) throw new Error('Campus is missing.')
  if (!Array.isArray(types) || types.length === 0) throw new Error('Keep at least one document.')

  const seenLabels = new Set()
  const seenIds    = new Set()
  const clean = types.map(t => {
    const label = String(t.label ?? '').trim()
    if (!label) throw new Error('Every document needs a name.')
    const key = label.toLowerCase()
    if (seenLabels.has(key)) throw new Error(`"${label}" is listed twice.`)
    seenLabels.add(key)

    const fee = Number(t.fee)
    if (!Number.isFinite(fee) || fee < 0) throw new Error(`Enter a valid fee for "${label}".`)

    let id = String(t.id ?? '').trim()
    if (!id || seenIds.has(id)) {
      const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30) || 'document'
      id = `custom_${slug}_${Math.random().toString(36).slice(2, 6)}`
    }
    seenIds.add(id)

    return { id, label, fee: Math.round(fee * 100) / 100, requiresClearance: !!t.requiresClearance }
  })

  const all  = loadCatalog()
  const dept = normDept(department)
  all[campusKey] = { ...(all[campusKey] || {}), [dept]: clean }
  saveCatalog(all)
  return clean.map(t => ({ ...t }))
}

/** Put a campus's department list back to the defaults. */
export function resetDocumentTypes(campusKey, department, user) {
  if (!CATALOG_ROLES.includes(user?.role)) throw new Error('You are not allowed to change document fees.')
  const all  = loadCatalog()
  const dept = normDept(department)
  if (all[campusKey]) {
    delete all[campusKey][dept]
    if (Object.keys(all[campusKey]).length === 0) delete all[campusKey]
    saveCatalog(all)
  }
}

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
  if (filters.status)     records = records.filter(r => statusMatches(r.status, filters.status))
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
    payment:       null,   // set by confirmDocumentPayment(): { orNumber, amount, method, receivedBy, ... }

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
 * File a request for a graduate (a former student who walks in to the registrar).
 * Graduates are no longer active students, so the details are typed in.
 * It follows the normal document flow: it starts at Requested, the registrar
 * prepares it, marks it For Payment (which notifies accounting), accounting
 * confirms the payment, and the registrar releases it. A document with no fee
 * skips the payment step, like any other request.
 *
 * @param {object} data { department:'basicEd'|'college', documentType, firstName, lastName,
 *                        formerStudentId?, lastLevel?, yearGraduated?, purpose?, campusKey,
 *                        campusName?, schoolYear }
 * @param {object} user  the logged-in user (recorded in the history)
 */
export function createGraduateRequest(data, user) {
  const role = user?.role
  if (!['registrar_basic', 'registrar_college', 'technical_admin'].includes(role)) {
    throw new Error('Only the registrar can file a graduate request.')
  }
  const department = data.department === 'college' ? 'college' : data.department === 'basicEd' ? 'basicEd' : null
  if (!department) throw new Error('Choose Basic Ed or College graduate.')
  if ((role === 'registrar_basic' && department !== 'basicEd') || (role === 'registrar_college' && department !== 'college')) {
    throw new Error('You can only file requests for your own department.')
  }

  const types = getDocumentTypes(data.campusKey, department)
  const docType = types.find(t => t.id === data.documentType)
  if (!docType) throw new Error('Choose a document.')

  const firstName = String(data.firstName ?? '').trim()
  const lastName  = String(data.lastName ?? '').trim()
  if (!firstName || !lastName) throw new Error('First and last name are required.')
  if (!data.campusKey) throw new Error('Campus is missing.')

  const docs = loadDocs()
  const now  = new Date().toISOString()
  const name = `${lastName}, ${firstName}`
  const byName = user?.name ?? 'System'

  const record = {
    id:            uid('doc'),
    studentId:     String(data.formerStudentId ?? '').trim() || uid('grad'),
    studentName:   name,
    studentGrade:  String(data.lastLevel ?? '').trim(),
    campusKey:     data.campusKey,
    campusName:    data.campusName ?? '',
    schoolYear:    data.schoolYear,
    department,

    isGraduate:    true,
    yearGraduated: String(data.yearGraduated ?? '').trim(),

    documentType:  docType.id,
    documentLabel: docType.label,
    purpose:       String(data.purpose ?? '').trim(),
    requestedBy:   'graduate',
    requestorName: name,

    fee:           docType.fee,
    paidAt:        null,
    payment:       null,

    requiresClearance: docType.requiresClearance,
    clearanceId:   null,

    status:        'requested',
    statusHistory: [{
      status: 'requested',
      by:     user?.id ?? user?.email ?? 'system',
      byName,
      note:   `Graduate request filed by ${byName}`,
      at:     now,
    }],

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
 * Accounting confirms the processing fee was paid.
 *
 * Stores the cashier's record on the request (OR number, amount, method, who
 * received it), then moves the request along the workflow so the status history
 * stays the single trail. The amount is always the request's fee: a document is
 * paid in full or not at all.
 *
 * Everything is checked before anything is written. If the workflow step still
 * fails afterwards, the payment record is removed again.
 *
 * @param {string} requestId
 * @param {{ orNumber: string, method: string, remarks?: string }} details
 * @param {object} user  the logged-in user (needs the confirm_payment action)
 * @returns {object} the updated request
 */
export function confirmDocumentPayment(requestId, { orNumber, method, remarks = '' } = {}, user) {
  const request = getRequestById(requestId)
  if (!request) throw new Error(`Document request "${requestId}" not found.`)

  if (normaliseStatus(request.status) !== 'for_payment') throw new Error('This request is not waiting for payment.')
  if (request.payment) throw new Error('The payment for this request was already confirmed.')

  const fee = Number(request.fee) || 0
  if (fee <= 0) throw new Error('This request has no fee to confirm.')

  const or = String(orNumber ?? '').trim()
  if (!or) throw new Error('OR number is required.')
  if (isOrNumberUsed(or)) throw new Error('This OR number is already used on another payment.')
  if (!DOCUMENT_PAYMENT_METHODS.includes(method)) throw new Error('Choose a payment method.')

  const allowed = getDocumentActions(user, request).some(a => a.id === 'confirm_payment')
  if (!allowed) throw new Error('You are not allowed to confirm this payment.')

  const now = new Date().toISOString()
  const payment = {
    orNumber:       or,
    amount:         fee,
    method,
    remarks:        String(remarks || '').trim(),
    receivedBy:     user?.name ?? 'System',
    receivedById:   user?.id ?? user?.email ?? null,
    receivedByRole: user?.role ?? '',
    campusKey:      request.campusKey,
    campusName:     request.campusName ?? '',
    at:             now,
  }

  const patch = (changes) => saveDocs(loadDocs().map(r => (r.id === requestId ? { ...r, ...changes } : r)))

  patch({ paidAt: now, payment })
  try {
    advanceDocumentStep(
      requestId, 'confirm_payment',
      `OR# ${or} · ${method} · ₱${fee.toLocaleString()}`,
      user
    )
  } catch (err) {
    patch({ paidAt: null, payment: null })
    throw err
  }
  return getRequestById(requestId)
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

/**
 * Requests waiting for accounting to collect payment (status For Payment).
 * Used for accounting's Doc Requests badge.
 */
export function getForPaymentCount(campusKey) {
  return loadDocs().filter(
    r => r.campusKey === campusKey && normaliseStatus(r.status) === 'for_payment' && !r.payment
  ).length
}

/**
 * Requests that are paid and waiting for the registrar to release them.
 * Routed by campus and department so each registrar only sees their own.
 * @param {string} campusKey
 * @param {'basicEd'|'college'|null} [department] null = every department
 */
export function getPaidAwaitingReleaseCount(campusKey, department = null) {
  return loadDocs().filter(
    r => r.campusKey === campusKey &&
         !!r.payment &&
         normaliseStatus(r.status) === 'ready_for_pickup' &&
         (!department || (r.department ?? 'basicEd') === department)   // no department = Basic Ed, same as the list
  ).length
}

// Normalise legacy 'ready' → 'ready_for_pickup' to match workflow engine step ID
export function normaliseStatus(status) {
  return status === 'ready' ? 'ready_for_pickup' : status
}

/**
 * True when a stored status and a filter/tab id mean the same step.
 * Stored requests can hold either the legacy 'ready' or the workflow's
 * 'ready_for_pickup', so a plain === misses half of them.
 */
export function statusMatches(recordStatus, filterId) {
  return normaliseStatus(recordStatus) === normaliseStatus(filterId)
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