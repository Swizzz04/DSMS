/**
 * guidanceBridge.js — ALMIRENE DX Guidance records bridge (plain .js, never .jsx)
 *
 * Referrals, incidents and testing results kept by the Guidance in-charge.
 *
 * STORAGE KEY: almirene_guidance_records
 * Shape:  { [campusKey]: { referrals: [], incidents: [], testing: [], audit: [] } }
 * Records belong to the CAMPUS, not to an account, so they survive a change of
 * Guidance in-charge (a new hire, or the duty moving to another teacher).
 *
 * EVENT: almirene_guidance_updated
 *
 * PRIVACY RULES (non-negotiable)
 *   - Counseling notes are never stored. Records hold only list choices, dates, a number
 *     and a short case-number code. Every record is built from a WHITELIST of fields, so
 *     an extra field such as "notes" sent by a page is silently dropped.
 *   - A record stores the student's id, school year and level only. Names and grades are
 *     read from almirene_students when shown, never copied here.
 *   - Reads and writes check the account's access (getGuidanceAccess in appConfig.js):
 *       view    the Guidance page, limited to the levels the account may see
 *       edit    the Guidance role, or any account with the Guidance module duty,
 *               and only inside their own campus. Super Admin, Principal and Program Head read only.
 *   - Referrals and incidents are closed / resolved, never deleted. A wrong entry may be
 *     deleted only by the account that created it, and only while it is still "open".
 *     Testing entries may be deleted by any editor of the campus.
 *   - Teachers (who are not editors) may send a referral REQUEST: student, date and a reason
 *     category only. It starts as "requested", is not an open case, and Guidance accepts it
 *     (open) or declines it (closed). The teacher sees only their own requests and a simple
 *     status (Sent / Received / Closed), and may withdraw a request that is still "requested".
 *   - Every create / edit / status change / delete is written to an append-only audit list
 *     (who, when, what, which student). The audit never holds record content.
 *   - The only thing other modules may ask is hasOpenCase(): a yes/no and a count, no details.
 */

import {
  getGuidanceAccess, todayYMD,
  GUIDANCE_REFERRAL_SOURCES, GUIDANCE_REFERRAL_REASONS, GUIDANCE_REFERRAL_STATUSES,
  GUIDANCE_INCIDENT_CATEGORIES, GUIDANCE_SANCTIONS, GUIDANCE_INCIDENT_STATUSES,
  GUIDANCE_TESTS, GUIDANCE_TEST_TRACKS, GUIDANCE_CASE_NO_PATTERN,
} from '../config/appConfig'

const STORAGE_KEY  = 'almirene_guidance_records'
const STUDENTS_KEY = 'almirene_students'
const EVENT        = 'almirene_guidance_updated'
const AUDIT_LIMIT  = 5000

/** Record kinds. `closed` is the status that ends a case; testing has no status. */
export const GUIDANCE_KINDS = {
  referral: { bucket: 'referrals', statuses: GUIDANCE_REFERRAL_STATUSES, closed: 'closed',   prefix: 'gref' },
  incident: { bucket: 'incidents', statuses: GUIDANCE_INCIDENT_STATUSES, closed: 'resolved', prefix: 'ginc' },
  testing:  { bucket: 'testing',   statuses: null,                       closed: null,       prefix: 'gtst' },
}

// ─────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────

function uid(prefix) { return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` }
const sameId = (a, b) => a != null && b != null && String(a) === String(b)

function readAll() {
  try {
    const v = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {}
  } catch { return {} }
}
function writeAll(all) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  window.dispatchEvent(new CustomEvent(EVENT))
}
function campusBucket(all, campusKey) {
  const c = all[campusKey] || {}
  return {
    referrals: Array.isArray(c.referrals) ? c.referrals : [],
    incidents: Array.isArray(c.incidents) ? c.incidents : [],
    testing:   Array.isArray(c.testing)   ? c.testing   : [],
    audit:     Array.isArray(c.audit)     ? c.audit     : [],
  }
}
function readStudents() {
  try {
    const v = JSON.parse(localStorage.getItem(STUDENTS_KEY) || '[]')
    return Array.isArray(v) ? v : []
  } catch { return [] }
}

function fail(message, errors = {}) { return { ok: false, message, errors } }

const isYMD = (s) => {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  // Compare the parts in UTC only. Parsing in local time and reading back in UTC shifts the
  // day for anyone east of UTC (the Philippines is UTC+8) and rejects every date.
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

/**
 * Resolve the campus an account may READ for. Super Admin has no campus of their own,
 * so a campus must be passed. Everyone else is limited to their own campus.
 * @returns {{access, campusKey}|null}
 */
function readContext(user, campusKey) {
  const access = getGuidanceAccess(user)
  if (!access.canView) return null
  if (user.role === 'technical_admin') return campusKey ? { access, campusKey } : null
  if (!user.campusKey) return null
  if (campusKey && campusKey !== user.campusKey) return null
  return { access, campusKey: user.campusKey }
}

/** Same as readContext, but the account must also be allowed to edit, in its own campus. */
function writeContext(user, campusKey) {
  const ctx = readContext(user, campusKey || user?.campusKey)
  if (!ctx || !ctx.access.canEdit) return null
  if (user.campusKey !== ctx.campusKey) return null
  return ctx
}

const labelOf = (list, id) => list.find(x => x.id === id)?.label || ''
const inList  = (list, id) => list.some(x => x.id === id)

/**
 * Validate and build the EDITABLE fields of a record from input. Unknown fields are ignored,
 * which is what keeps free text out of the system.
 * @returns {{values: object, errors: object}}
 */
function buildFields(kind, input = {}) {
  const errors = {}
  const values = {}
  const today = todayYMD()

  if (!isYMD(input.date)) errors.date = 'Choose a valid date.'
  else if (input.date > today) errors.date = 'The date cannot be in the future.'
  else values.date = input.date

  const caseNo = input.caseNo == null ? '' : String(input.caseNo).trim()
  if (kind !== 'testing') {
    if (caseNo && !GUIDANCE_CASE_NO_PATTERN.test(caseNo)) {
      errors.caseNo = 'Use up to 20 letters, numbers or dashes (a reference code, not a description).'
    } else values.caseNo = caseNo
  }

  if (kind === 'referral') {
    if (!inList(GUIDANCE_REFERRAL_SOURCES, input.source)) errors.source = 'Choose who referred the student.'
    else values.source = input.source
    if (!inList(GUIDANCE_REFERRAL_REASONS, input.reason)) errors.reason = 'Choose a reason.'
    else values.reason = input.reason
    const fu = input.followUpDate || ''
    if (fu && !isYMD(fu)) errors.followUpDate = 'Choose a valid follow-up date.'
    else if (fu && values.date && fu < values.date) errors.followUpDate = 'The follow-up cannot be before the referral date.'
    else values.followUpDate = fu
  }

  if (kind === 'incident') {
    if (!inList(GUIDANCE_INCIDENT_CATEGORIES, input.category)) errors.category = 'Choose a category.'
    else values.category = input.category
    if (!inList(GUIDANCE_SANCTIONS, input.sanction)) errors.sanction = 'Choose a sanction.'
    else values.sanction = input.sanction
  }

  if (kind === 'testing') {
    const test = GUIDANCE_TESTS.find(t => t.id === input.testId)
    if (!test) errors.testId = 'Choose a test.'
    else {
      values.testId = test.id
      values.resultType = test.resultType
      if (test.resultType === 'score') {
        const n = typeof input.result === 'number' ? input.result : (String(input.result ?? '').trim() === '' ? NaN : Number(input.result))
        if (!Number.isFinite(n) || n < test.min || n > test.max) errors.result = `Enter a score from ${test.min} to ${test.max}.`
        else values.result = n
      } else {
        if (!inList(GUIDANCE_TEST_TRACKS, input.result)) errors.result = 'Choose a result.'
        else values.result = input.result
      }
    }
  }

  return { values, errors }
}

function auditEntry(user, action, kind, record, extra = {}) {
  return {
    id: uid('gaud'),
    at: new Date().toISOString(),
    byId: user.id,
    byName: user.name || '',
    action,                       // 'created' | 'edited' | 'status' | 'deleted'
    kind,
    recordId: record.id,
    studentId: record.studentId,
    level: record.level,
    ...extra,                     // e.g. { status } — never record content
  }
}
function pushAudit(bucket, entry) {
  bucket.audit.push(entry)
  if (bucket.audit.length > AUDIT_LIMIT) bucket.audit.splice(0, bucket.audit.length - AUDIT_LIMIT)
}

function save(all, campusKey, bucket) {
  all[campusKey] = bucket
  writeAll(all)
}

// ─────────────────────────────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────────────────────────────

/**
 * Records of one kind the account may see.
 * @param {object} user
 * @param {'referral'|'incident'|'testing'} kind
 * @param {{campusKey?:string, schoolYear?:string, studentId?:string|number, status?:string}} [filters]
 *   Super Admin must pass campusKey; everyone else is limited to their own campus.
 * @returns {object[]} newest first
 */
export function getGuidanceRecords(user, kind, filters = {}) {
  const def = GUIDANCE_KINDS[kind]
  if (!def) return []
  const ctx = readContext(user, filters.campusKey)
  if (!ctx) return []
  const list = campusBucket(readAll(), ctx.campusKey)[def.bucket]
  return list
    .filter(r => ctx.access.levels.includes(r.level))
    .filter(r => !filters.schoolYear || r.schoolYear === filters.schoolYear)
    .filter(r => filters.studentId == null || sameId(r.studentId, filters.studentId))
    .filter(r => !filters.status || r.status === filters.status)
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''))
}

/** Audit trail the account may see (levels respected), newest first. */
export function getGuidanceAudit(user, { campusKey, studentId } = {}) {
  const ctx = readContext(user, campusKey)
  if (!ctx) return []
  return campusBucket(readAll(), ctx.campusKey).audit
    .filter(e => ctx.access.levels.includes(e.level))
    .filter(e => studentId == null || sameId(e.studentId, studentId))
    .slice()
    .reverse()
}

/**
 * Students the account may pick or see on the Guidance page: their campus, the levels
 * they may see, optionally one school year. Only the fields the page needs.
 * @returns {{id, studentNo, name, gradeLevel, section, department, schoolYear}[]}
 */
export function getGuidanceStudents(user, { campusKey, schoolYear } = {}) {
  const ctx = readContext(user, campusKey)
  if (!ctx) return []
  return readStudents()
    .filter(s => s.campusKey === ctx.campusKey)
    .filter(s => ctx.access.levels.includes(s.department))
    .filter(s => !schoolYear || s.schoolYear === schoolYear)
    .map(toStudentOption)
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** The few student fields the Guidance screens need. No birth date, address or contact details. */
function toStudentOption(s) {
  return {
    id: s.id,
    studentNo: s.studentId || '',
    name: [s.lastName, s.firstName].filter(Boolean).join(', ') || s.name || `Student ${s.id}`,
    gradeLevel: s.gradeLevel || '',
    section: s.section || '',
    department: s.department,
    schoolYear: s.schoolYear || '',
  }
}

/**
 * True when a referral's follow-up date is today or past and the case is still going.
 * A request waiting for Guidance, and a closed referral, are never "due".
 */
export function isFollowUpDue(referral) {
  if (!referral || !referral.followUpDate) return false
  if (referral.status === 'closed' || referral.status === 'requested') return false
  return referral.followUpDate <= todayYMD()
}

/**
 * Status only, for other modules (the Guidance clearance slot). No permission needed on
 * purpose: it returns a yes/no and a count, never who, why or what.
 * An open case is a referral that is accepted and not closed, or an incident that is not
 * resolved. A teacher's request still waiting for Guidance is not a case yet.
 * @returns {{hasOpenCase:boolean, openCount:number}}
 */
export function hasOpenCase(studentId, campusKey) {
  if (studentId == null || !campusKey) return { hasOpenCase: false, openCount: 0 }
  const b = campusBucket(readAll(), campusKey)
  const openCount =
    b.referrals.filter(r => sameId(r.studentId, studentId) && r.status !== 'closed' && r.status !== 'requested').length +
    b.incidents.filter(r => sameId(r.studentId, studentId) && r.status !== 'resolved').length
  return { hasOpenCase: openCount > 0, openCount }
}

/** Plain-words label for a record's list fields, for tables and exports. */
export function describeGuidanceRecord(kind, r) {
  if (!r) return {}
  if (kind === 'referral') return {
    source: labelOf(GUIDANCE_REFERRAL_SOURCES, r.source),
    reason: labelOf(GUIDANCE_REFERRAL_REASONS, r.reason),
    status: labelOf(GUIDANCE_REFERRAL_STATUSES, r.status),
  }
  if (kind === 'incident') return {
    category: labelOf(GUIDANCE_INCIDENT_CATEGORIES, r.category),
    sanction: labelOf(GUIDANCE_SANCTIONS, r.sanction),
    status:   labelOf(GUIDANCE_INCIDENT_STATUSES, r.status),
  }
  const test = GUIDANCE_TESTS.find(t => t.id === r.testId)
  return {
    test: test?.label || '',
    result: r.resultType === 'score' ? String(r.result) : labelOf(GUIDANCE_TEST_TRACKS, r.result),
  }
}

// ─────────────────────────────────────────────────────────────────────
// WRITE
// ─────────────────────────────────────────────────────────────────────

/**
 * Add a record.
 * input (referral): studentId, schoolYear, date, source, reason, followUpDate?, caseNo?
 * input (incident): studentId, schoolYear, date, category, sanction, caseNo?
 * input (testing):  studentId, schoolYear, date, testId, result
 * @returns {{ok:true, record}|{ok:false, message, errors}}
 */
export function createGuidanceRecord(user, kind, input = {}, campusKey) {
  const def = GUIDANCE_KINDS[kind]
  if (!def) return fail('Unknown record type.')
  const ctx = writeContext(user, campusKey)
  if (!ctx) return fail('You cannot add Guidance records here.')

  const student = readStudents().find(s => sameId(s.id, input.studentId) && s.campusKey === ctx.campusKey)
  if (!student) return fail('Choose a student from this campus.', { studentId: 'Choose a student.' })
  if (!ctx.access.levels.includes(student.department)) return fail('You cannot add records for this student.')
  if (!input.schoolYear || typeof input.schoolYear !== 'string') return fail('The school year is missing.', { schoolYear: 'Missing school year.' })

  const { values, errors } = buildFields(kind, input)
  if (Object.keys(errors).length) return fail('Check the highlighted fields.', errors)

  const now = new Date().toISOString()
  const record = {
    id: uid(def.prefix),
    studentId: student.id,
    schoolYear: input.schoolYear,
    level: student.department,
    ...values,
    ...(def.statuses ? { status: 'open', closedAt: null } : {}),
    createdBy: user.id,
    createdByName: user.name || '',
    createdAt: now,
    updatedAt: now,
  }

  const all = readAll()
  const bucket = campusBucket(all, ctx.campusKey)
  bucket[def.bucket].push(record)
  pushAudit(bucket, auditEntry(user, 'created', kind, record))
  save(all, ctx.campusKey, bucket)
  return { ok: true, record }
}

/** Find a record the account may change; returns { ctx, all, bucket, record, def } or { error }. */
function locate(user, kind, id, campusKey) {
  const def = GUIDANCE_KINDS[kind]
  if (!def) return { error: fail('Unknown record type.') }
  const ctx = writeContext(user, campusKey)
  if (!ctx) return { error: fail('You cannot change Guidance records here.') }
  const all = readAll()
  const bucket = campusBucket(all, ctx.campusKey)
  const record = bucket[def.bucket].find(r => r.id === id)
  if (!record || !ctx.access.levels.includes(record.level)) return { error: fail('That record was not found.') }
  return { ctx, all, bucket, record, def }
}

/**
 * Change the editable fields of a record (not the student, school year or status).
 * A closed / resolved record is locked: reopen it first. Unknown fields are ignored.
 */
export function updateGuidanceRecord(user, kind, id, patch = {}, campusKey) {
  const found = locate(user, kind, id, campusKey)
  if (found.error) return found.error
  const { ctx, all, bucket, record, def } = found
  if (def.closed && record.status === def.closed) return fail('This record is closed. Reopen it to change it.')

  const { values, errors } = buildFields(kind, { ...record, ...patch })
  if (Object.keys(errors).length) return fail('Check the highlighted fields.', errors)

  Object.assign(record, values, { updatedAt: new Date().toISOString() })
  pushAudit(bucket, auditEntry(user, 'edited', kind, record))
  save(all, ctx.campusKey, bucket)
  return { ok: true, record }
}

/**
 * Move a referral or incident to another status (open → in progress → closed, or open → resolved).
 * Closing / resolving stamps closedAt; reopening clears it. Cases are closed, never deleted.
 */
export function setGuidanceStatus(user, kind, id, status, campusKey) {
  const found = locate(user, kind, id, campusKey)
  if (found.error) return found.error
  const { ctx, all, bucket, record, def } = found
  if (!def.statuses) return fail('This record type has no status.')
  if (!inList(def.statuses, status)) return fail('Unknown status.')
  if (status === 'requested') return fail('A request can only be sent by a teacher.')
  if (record.status === status) return { ok: true, record }

  record.status = status
  record.closedAt = status === def.closed ? new Date().toISOString() : null
  record.updatedAt = new Date().toISOString()
  pushAudit(bucket, auditEntry(user, 'status', kind, record, { status }))
  save(all, ctx.campusKey, bucket)
  return { ok: true, record }
}

/**
 * Whether the account could delete this record right now (for showing or hiding the button).
 *   referral / incident  only the account that created it, and only while it is still 'open'
 *   testing              any editor of the campus
 */
export function canDeleteGuidanceRecord(user, kind, record, campusKey) {
  const def = GUIDANCE_KINDS[kind]
  if (!def || !record) return false
  const ctx = writeContext(user, campusKey)
  if (!ctx || !ctx.access.levels.includes(record.level)) return false
  if (kind === 'testing') return true
  return record.status === 'open' && sameId(record.createdBy, user.id)
}

/** Delete a record the account is allowed to delete (see canDeleteGuidanceRecord). The audit keeps a note that it happened. */
export function deleteGuidanceRecord(user, kind, id, campusKey) {
  const found = locate(user, kind, id, campusKey)
  if (found.error) return found.error
  const { ctx, all, bucket, record, def } = found
  if (!canDeleteGuidanceRecord(user, kind, record, campusKey)) {
    return fail(kind === 'testing'
      ? 'You cannot delete this record.'
      : 'Only the person who entered a record can delete it, and only while it is still open. Close it instead.')
  }
  bucket[def.bucket] = bucket[def.bucket].filter(r => r.id !== id)
  pushAudit(bucket, auditEntry(user, 'deleted', kind, record))
  save(all, ctx.campusKey, bucket)
  return { ok: true }
}

// ─────────────────────────────────────────────────────────────────────
// TEACHER REFERRAL REQUESTS
// A teacher who is not a Guidance editor can send a request and follow its status. Nothing
// else of the Guidance records is visible to them.
// ─────────────────────────────────────────────────────────────────────

/** What a teacher sees as the status of a request they sent. */
export const TEACHER_REQUEST_STATUS = {
  requested:   { id: 'sent',     label: 'Sent'     },
  open:        { id: 'received', label: 'Received' },
  in_progress: { id: 'received', label: 'Received' },
  closed:      { id: 'closed',   label: 'Closed'   },
}

function referContext(user) {
  const access = getGuidanceAccess(user)
  if (!access.canRefer || !user.campusKey) return null
  return { access, campusKey: user.campusKey }
}

/**
 * Students a teacher may send a referral for: their own campus, optionally one school year.
 * (Teachers already have the Students page, so this shows them nothing new.)
 */
export function getReferralStudents(user, { schoolYear } = {}) {
  const ctx = referContext(user)
  if (!ctx) return []
  return readStudents()
    .filter(s => s.campusKey === ctx.campusKey)
    .filter(s => !schoolYear || s.schoolYear === schoolYear)
    .map(toStudentOption)
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Send a referral request to Guidance.
 * input: studentId, schoolYear, date, reason  (anything else is ignored)
 * @returns {{ok:true, record}|{ok:false, message, errors}}
 */
export function createReferralRequest(user, input = {}) {
  const ctx = referContext(user)
  if (!ctx) return fail('You cannot send referrals here.')

  const student = readStudents().find(s => sameId(s.id, input.studentId) && s.campusKey === ctx.campusKey)
  if (!student) return fail('Choose a student from your campus.', { studentId: 'Choose a student.' })
  if (!input.schoolYear || typeof input.schoolYear !== 'string') return fail('The school year is missing.', { schoolYear: 'Missing school year.' })

  const { values, errors } = buildFields('referral', { date: input.date, source: 'teacher', reason: input.reason })
  if (Object.keys(errors).length) return fail('Check the highlighted fields.', errors)

  const now = new Date().toISOString()
  const record = {
    id: uid(GUIDANCE_KINDS.referral.prefix),
    studentId: student.id,
    schoolYear: input.schoolYear,
    level: student.department,
    ...values,
    status: 'requested',
    closedAt: null,
    createdBy: user.id,
    createdByName: user.name || '',
    createdAt: now,
    updatedAt: now,
  }

  const all = readAll()
  const bucket = campusBucket(all, ctx.campusKey)
  bucket.referrals.push(record)
  pushAudit(bucket, auditEntry(user, 'created', 'referral', record, { status: 'requested' }))
  save(all, ctx.campusKey, bucket)
  return { ok: true, record }
}

/**
 * The requests this teacher sent, newest first, with only what they need: the student, the
 * date, the reason they chose and the simple status. Nothing Guidance adds later is exposed.
 * @returns {{id, studentId, studentName, gradeLevel, date, reason, reasonLabel, status, statusLabel, canWithdraw}[]}
 */
export function getMyReferralRequests(user, { schoolYear } = {}) {
  const ctx = referContext(user)
  if (!ctx) return []
  const students = readStudents()
  return campusBucket(readAll(), ctx.campusKey).referrals
    .filter(r => sameId(r.createdBy, user.id))
    .filter(r => !schoolYear || r.schoolYear === schoolYear)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    .map(r => {
      const s = students.find(x => sameId(x.id, r.studentId))
      const shown = TEACHER_REQUEST_STATUS[r.status] || TEACHER_REQUEST_STATUS.open
      return {
        id: r.id,
        studentId: r.studentId,
        studentName: s ? toStudentOption(s).name : 'Student not found',
        gradeLevel: s?.gradeLevel || '',
        date: r.date,
        reason: r.reason,
        reasonLabel: labelOf(GUIDANCE_REFERRAL_REASONS, r.reason),
        status: shown.id,
        statusLabel: shown.label,
        canWithdraw: r.status === 'requested',
      }
    })
}

/** A teacher takes back a request that Guidance has not accepted yet. The audit notes it. */
export function withdrawReferralRequest(user, id) {
  const ctx = referContext(user)
  if (!ctx) return fail('You cannot change referrals here.')
  const all = readAll()
  const bucket = campusBucket(all, ctx.campusKey)
  const record = bucket.referrals.find(r => r.id === id && sameId(r.createdBy, user.id))
  if (!record) return fail('That request was not found.')
  if (record.status !== 'requested') return fail('Guidance has already received this request, so it cannot be withdrawn.')
  bucket.referrals = bucket.referrals.filter(r => r.id !== id)
  pushAudit(bucket, auditEntry(user, 'deleted', 'referral', record))
  save(all, ctx.campusKey, bucket)
  return { ok: true }
}

// ─────────────────────────────────────────────────────────────────────
// MAINTENANCE (seed tool and tests only — not for pages)
// ─────────────────────────────────────────────────────────────────────

/** Remove every Guidance record of one campus, or all campuses. Used by the seed tool's clear(). */
export function clearGuidanceRecords(campusKey) {
  if (!campusKey) { localStorage.removeItem(STORAGE_KEY); window.dispatchEvent(new CustomEvent(EVENT)); return }
  const all = readAll()
  delete all[campusKey]
  writeAll(all)
}
