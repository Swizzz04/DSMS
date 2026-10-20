/**
 * documentBridge.js — ALMIRENE DX Document Requests & Student Clearance
 *
 * Two bridges in one file — they're tightly coupled.
 * Swap localStorage calls for API calls when ASP.NET backend is ready.
 *
 * localStorage keys:
 *   almirene_documents  — document request records
 *   almirene_clearance  — clearance records per student per school year
 *   almirene_document_catalog — per-campus document list, prices and clearance rule.
 *                               The technical admin sets up the documents (list, clearance rule, formats).
 *                               Accounting and admin set the prices only (Fees tab).
 *   almirene_document_trash   — deleted documents, restorable for DOCUMENT_TRASH_RETENTION_DAYS
 *
 * Events:
 *   almirene_documents_updated
 *   almirene_clearance_updated
 *   almirene_document_catalog_updated
 */

import { getWorkflowDefinition } from './workflowConfigBridge'
import * as workflowEngine       from '../engines/workflowEngine'
import { isOrNumberUsed }        from './orNumbers'
import { DOCUMENT_PAYMENT_METHODS, DEFAULT_DOCUMENT_TYPES, DOCUMENT_TRASH_RETENTION_DAYS } from '../config/appConfig'

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const DOC_KEY       = 'almirene_documents'
const CLEAR_KEY     = 'almirene_clearance'
const DOC_EVENT     = 'almirene_documents_updated'
const CLEAR_EVENT   = 'almirene_clearance_updated'
const CATALOG_KEY   = 'almirene_document_catalog'
const CATALOG_EVENT = 'almirene_document_catalog_updated'
const TRASH_KEY     = 'almirene_document_trash'   // deleted documents, kept for DOCUMENT_TRASH_RETENTION_DAYS

function uid(prefix = 'doc') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

// ── Document types per department ──────────────────────────────
// Defaults live in appConfig.js. These two stay exported for anything that wants
// the unedited list; pages should call getDocumentTypes(campusKey, department),
// which returns the campus's own prices once the technical admin has set them.
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
 * Falls back to the defaults until the technical admin edits the campus's list.
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

// Who may open the fee configuration. Everyone here sets prices (saveDocumentFees);
// only the technical admin sets up the document list itself.
const CATALOG_ROLES = ['accounting', 'admin', 'technical_admin']
const NOT_ALLOWED   = 'You are not allowed to change document fees.'

/** Error raised when the list changed (another user added or removed a document) since the caller loaded it. */
function listChangedError() {
  const err = new Error('The document list was changed by someone else. The list has been refreshed. Please review it and save again.')
  err.code = 'LIST_CHANGED'
  return err
}

/**
 * Save edits to a campus's document list for one department (technical admin only).
 *
 * Merges into the CURRENT list, so a document another user added in the meantime is never
 * lost. Rows with an id update that document; rows with no id are new documents.
 * It never removes a document: deleting goes through removeDocumentType (the trash).
 * A row whose id is no longer in the list was deleted by someone else, so it throws
 * an error whose code is 'LIST_CHANGED' and writes nothing.
 * Requests already recorded keep the label and fee they were recorded with.
 *
 * @param {string} campusKey
 * @param {'basicEd'|'college'} department
 * @param {Array}  types  [{ id?, label, fee, requiresClearance }]
 * @param {object} user   must be the technical admin (accounting / admin set prices with saveDocumentFees)
 * @returns {Array} the saved list
 */
export function saveDocumentTypes(campusKey, department, types, user) {
  if (!CATALOG_ROLES.includes(user?.role)) throw new Error(NOT_ALLOWED)
  if (user?.role !== 'technical_admin') throw new Error('Only the technical admin can change the document list. You can set prices.')
  if (!campusKey) throw new Error('Campus is missing.')
  if (!Array.isArray(types) || types.length === 0) throw new Error('There is nothing to save.')

  const dept    = normDept(department)
  const current = getDocumentTypes(campusKey, dept)
  const known   = new Set(current.map(t => t.id))

  const edits = new Map()    // id → cleaned row, for documents already in the list
  const added = []           // cleaned rows for new documents
  types.forEach(t => {
    const label = String(t.label ?? '').trim()
    if (!label) throw new Error('Every document needs a name.')
    if (label.length > 60) throw new Error(`Keep "${label.slice(0, 20)}…" under 60 characters.`)

    const fee = Number(t.fee)
    if (!Number.isFinite(fee) || fee < 0) throw new Error(`Enter a valid fee for "${label}".`)
    const base = { label, fee: Math.round(fee * 100) / 100, requiresClearance: !!t.requiresClearance }

    const id = String(t.id ?? '').trim()
    if (!id) {
      const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30) || 'document'
      added.push({ id: `custom_${slug}_${Math.random().toString(36).slice(2, 6)}`, ...base })
    } else if (known.has(id)) {
      edits.set(id, { id, ...base })
    } else {
      throw listChangedError()
    }
  })

  const merged = [...current.map(t => edits.get(t.id) ?? t), ...added]

  // Names must stay unique across the whole merged list
  const seen = new Set()
  merged.forEach(t => {
    const key = t.label.toLowerCase()
    if (seen.has(key)) throw new Error(`"${t.label}" is listed twice.`)
    seen.add(key)
  })

  const all = loadCatalog()
  all[campusKey] = { ...(all[campusKey] || {}), [dept]: merged }
  saveCatalog(all)
  return merged.map(t => ({ ...t }))
}

/**
 * Accounting / admin set prices. Updates the fee of the documents named in `fees` on the
 * campus's CURRENT list, so a document the technical admin added or removed in the meantime
 * is never overwritten.
 *
 * If a document named in `fees` is no longer in the list (the technical admin deleted it), nothing is
 * saved and an error with code 'LIST_CHANGED' is thrown, so the caller can refresh and ask again.
 *
 * @param {Object<string,number>} fees  { [documentTypeId]: fee }
 * @returns {Array} the saved list
 */
export function saveDocumentFees(campusKey, department, fees, user) {
  if (!CATALOG_ROLES.includes(user?.role)) throw new Error(NOT_ALLOWED)
  if (!campusKey) throw new Error('Campus is missing.')
  const dept = normDept(department)
  const list = getDocumentTypes(campusKey, dept)
  const ids  = new Set(list.map(t => t.id))
  if (Object.keys(fees || {}).some(id => !ids.has(id))) throw listChangedError()
  const next = list.map(t => {
    if (!(t.id in (fees || {}))) return t
    const fee = Number(fees[t.id])
    if (!Number.isFinite(fee) || fee < 0) throw new Error(`Enter a valid fee for "${t.label}".`)
    return { ...t, fee: Math.round(fee * 100) / 100 }
  })
  const all = loadCatalog()
  all[campusKey] = { ...(all[campusKey] || {}), [dept]: next }
  saveCatalog(all)
  return next.map(t => ({ ...t }))
}

/** The technical admin decides whether a document needs the student's clearance. */
export function setDocumentClearance(campusKey, department, documentTypeId, requiresClearance, user) {
  const dept = normDept(department)
  assertCanManageDocuments(user, dept)
  const list = getDocumentTypes(campusKey, dept)
  if (!list.some(t => t.id === documentTypeId)) throw new Error('This document is no longer in the list.')
  const all = loadCatalog()
  all[campusKey] = { ...(all[campusKey] || {}), [dept]: list.map(t => t.id === documentTypeId ? { ...t, requiresClearance: !!requiresClearance } : t) }
  saveCatalog(all)
}

/** Put a campus's department list back to the defaults. */
export function resetDocumentTypes(campusKey, department, user) {
  if (!CATALOG_ROLES.includes(user?.role)) throw new Error(NOT_ALLOWED)
  if (user?.role !== 'technical_admin') throw new Error('Only the technical admin can change the document list. You can set prices.')
  const all  = loadCatalog()
  const dept = normDept(department)
  if (all[campusKey]) {
    delete all[campusKey][dept]
    if (Object.keys(all[campusKey]).length === 0) delete all[campusKey]
    saveCatalog(all)
  }
}

/**
 * The technical admin adds a document the school issues (for example "Certificate of Indigency").
 * It joins the campus list at ₱0; accounting sets the price on the Fees tab.
 *
 * @param {object} data { label, requiresClearance? }
 * @returns {object} the new document type
 */
export function addDocumentType(campusKey, department, data, user) {
  const dept = normDept(department)
  assertCanManageDocuments(user, dept)
  if (!campusKey) throw new Error('Campus is missing.')

  const label = String(data?.label ?? '').trim()
  if (!label) throw new Error('Enter the document name.')
  if (label.length > 60) throw new Error('Keep the document name under 60 characters.')

  const list = getDocumentTypes(campusKey, dept)
  if (list.some(t => t.label.toLowerCase() === label.toLowerCase())) throw new Error(`"${label}" is already in the list.`)

  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30) || 'document'
  const created = { id: `custom_${slug}_${Math.random().toString(36).slice(2, 6)}`, label, fee: 0, requiresClearance: !!data?.requiresClearance }

  const all = loadCatalog()
  all[campusKey] = { ...(all[campusKey] || {}), [dept]: [...list, created] }
  saveCatalog(all)
  return { ...created }
}

// ── Deleted documents (kept for DOCUMENT_TRASH_RETENTION_DAYS, then removed for good) ──
//   almirene_document_trash: { [campusKey]: { [department]: [ { type, template, deletedAt, deletedBy } ] } }
//   The document leaves the campus list at once, so every page stops offering it.
//   Its uploaded format (if any) travels with it, so a restore brings everything back.

const DAY_MS = 24 * 60 * 60 * 1000

function loadTrash() {
  let data
  try { data = JSON.parse(localStorage.getItem(TRASH_KEY) || '{}') || {} }
  catch { data = {} }
  // Drop anything older than the retention period
  const cutoff = Date.now() - DOCUMENT_TRASH_RETENTION_DAYS * DAY_MS
  let changed = false
  Object.keys(data).forEach(campus => Object.keys(data[campus] || {}).forEach(dept => {
    const kept = (data[campus][dept] || []).filter(e => new Date(e.deletedAt).getTime() > cutoff)
    if (kept.length !== (data[campus][dept] || []).length) { data[campus][dept] = kept; changed = true }
  }))
  if (changed) { try { localStorage.setItem(TRASH_KEY, JSON.stringify(data)) } catch { /* retried on the next write */ } }
  return data
}

function saveTrash(data) {
  try {
    localStorage.setItem(TRASH_KEY, JSON.stringify(data))
  } catch {
    throw new Error('Browser storage is full. Remove a format you no longer use, then try again.')
  }
  window.dispatchEvent(new CustomEvent(CATALOG_EVENT))
}

// Who sets up WHICH documents the school issues (add, delete, restore, clearance): the technical admin.
// `dept` is kept so every caller reads the same; the rule is the same for both departments.
// eslint-disable-next-line no-unused-vars
function assertCanManageDocuments(user, dept) {
  if (user?.role !== 'technical_admin') throw new Error('Only the technical admin can set up the documents.')
}

/**
 * Delete a document from the campus list. It moves to "Deleted documents" and can be
 * restored for DOCUMENT_TRASH_RETENTION_DAYS days. At least one document always stays.
 * Requests already filed keep the label and fee they were recorded with.
 *
 * @param {object} [options] { template } the document's uploaded format, kept so a restore brings it back
 */
export function removeDocumentType(campusKey, department, documentTypeId, user, options = {}) {
  const dept = normDept(department)
  assertCanManageDocuments(user, dept)

  const list = getDocumentTypes(campusKey, dept)
  const type = list.find(t => t.id === documentTypeId)
  if (!type) return
  if (list.length <= 1) throw new Error('Keep at least one document in the list.')

  // Trash first: if storage is full nothing has been removed yet
  const trash = loadTrash()
  trash[campusKey] = {
    ...(trash[campusKey] || {}),
    [dept]: [
      ...(trash[campusKey]?.[dept] || []),
      { type, template: options.template ?? null, deletedAt: new Date().toISOString(), deletedBy: user?.name ?? '' },
    ],
  }
  saveTrash(trash)

  const all = loadCatalog()
  all[campusKey] = { ...(all[campusKey] || {}), [dept]: list.filter(t => t.id !== documentTypeId) }
  saveCatalog(all)
}

/** The deleted documents of a campus + department, newest first, with the days they have left. */
export function getDeletedDocuments(campusKey, department) {
  const dept = normDept(department)
  return (loadTrash()?.[campusKey]?.[dept] || [])
    .map(e => {
      const left = Math.ceil((new Date(e.deletedAt).getTime() + DOCUMENT_TRASH_RETENTION_DAYS * DAY_MS - Date.now()) / DAY_MS)
      return {
        ...e.type,
        deletedAt: e.deletedAt,
        deletedBy: e.deletedBy,
        daysLeft:  Math.max(1, left),
        hasFormat: !!e.template,
      }
    })
    .sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt))
}

/**
 * Put a deleted document back in the campus list.
 * If another document now has its name, pass newLabel; without it this throws an error
 * whose code is 'NAME_IN_USE'.
 *
 * @returns {{ type: object, template: object|null }} the restored document and its saved format (for the caller to save again)
 */
export function restoreDocumentType(campusKey, department, documentTypeId, user, newLabel) {
  const dept = normDept(department)
  assertCanManageDocuments(user, dept)

  const trash = loadTrash()
  const entries = trash?.[campusKey]?.[dept] || []
  const entry = entries.find(e => e.type.id === documentTypeId)
  if (!entry) throw new Error('This document is no longer in the deleted list.')

  const label = String(newLabel ?? entry.type.label).trim()
  if (!label) throw new Error('Enter the document name.')
  const list = getDocumentTypes(campusKey, dept)
  if (list.some(t => t.label.toLowerCase() === label.toLowerCase())) {
    const err = new Error(`A document named "${label}" already exists. Choose another name.`)
    err.code = 'NAME_IN_USE'
    throw err
  }

  const restored = { ...entry.type, label }
  const all = loadCatalog()
  all[campusKey] = { ...(all[campusKey] || {}), [dept]: [...list, restored] }
  saveCatalog(all)

  trash[campusKey][dept] = entries.filter(e => e !== entry)
  try { saveTrash(trash) } catch { /* the document is back; the leftover copy expires by itself */ }
  return { type: { ...restored }, template: entry.template ?? null }
}

/** Remove a deleted document for good (frees the storage its format used). */
export function purgeDeletedDocument(campusKey, department, documentTypeId, user) {
  const dept = normDept(department)
  assertCanManageDocuments(user, dept)
  const trash = loadTrash()
  const entries = trash?.[campusKey]?.[dept] || []
  if (!entries.some(e => e.type.id === documentTypeId)) return
  trash[campusKey][dept] = entries.filter(e => e.type.id !== documentTypeId)
  saveTrash(trash)
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

  // Guard — clearance required. A request that needs clearance but has no clearance
  // record linked is blocked too, so it can never be released by skipping the record.
  if (record.requiresClearance) {
    if (!record.clearanceId) {
      throw new Error('This document needs the student\'s clearance, but no clearance record is linked to the request. Start the clearance first.')
    }
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