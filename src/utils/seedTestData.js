/**
 * seedTestData.js — DEV-ONLY test data for walking every page in every role.
 * ─────────────────────────────────────────────────────────────────────────────
 * Loaded from main.jsx under `import.meta.env.DEV`, so it never reaches a
 * production bundle. Plain .js (no JSX). No UI, console commands only:
 *
 *   almireneSeed.packA()    people + enrollments + payments (Step 1)
 *   almireneSeed.packClearance()  clearances in every stage, per campus (needs packA first)
 *   almireneSeed.packSigners()    Librarian and Guidance Counselor logins per campus
 *   almireneSeed.packTeachers()   subject teachers per campus (Math, English, Science, ...) + college instructors
 *   almireneSeed.packLoads()      sections, students placed in sections, Subject Load (needs packA + packTeachers)
 *   almireneSeed.packReasons()    "Transfer without Guidance" clearance reason (Carcar + Talisay; run before packClearance)
 *   almireneSeed.status()   what is seeded right now (console table)
 *   almireneSeed.clear()    removes ONLY seeded records (seed_* / mock_stu_* ids)
 *   almireneSeed.help()     list the commands
 *
 * Later steps add packB … packF to this same file (subject loads, grades,
 * attendance, documents/clearance, grade-change/INC requests).
 *
 * Design rules
 *  - Idempotent: running a pack twice changes nothing the second time.
 *  - Every seeded record has an id starting with `seed_` and `_seed: true`, so
 *    clear() never touches records you created by hand.
 *  - Records use the REAL shapes the pages read (nested `student` / `enrollment`
 *    in almirene_submissions) — no extra fields the public form does not send,
 *    so gaps in the real flow show up in testing instead of being hidden.
 *  - Fees follow the app's own rules: discounts apply to TUITION only, and the
 *    enrollment fee is the minimum down payment and is NEVER added to the
 *    grand total (same as the Enrollments fee-assessment modal).
 *  - Campuses, school year, fees and discounts are read from appConfig /
 *    almirene_app_config, nothing is hardcoded here.
 *
 * KNOWN GAP (logged, mirrored on purpose): the Enrollments page only writes
 * almirene_submissions, but DocumentRequests / documentBridge / teacherFormsBridge
 * read almirene_students, which no page ever fills. So pack A mirrors every
 * APPROVED student into almirene_students (same `id`) to make those pages
 * testable. Remove the mirror once the app converts approved enrollments itself.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  CAMPUSES,
  FEE_STRUCTURE,
  DEFAULT_DISCOUNTS,
  BASIC_ED_GROUPS,
  SCHOOL_YEARS,
  getCurrentSchoolYear,
  getDefaultClearanceReasons,
  computeStudentBill,
  computeCollegeFee,
  getLoadStatus,
} from '../config/appConfig'
import { getGradingFramework, getSubjectAreaOptions, DEFAULT_GRADING_FRAMEWORKS } from '../engines/gradingEngine'
import {
  getClearanceReasons,
  getClearanceRequirements,
  saveClearanceReasons,
  resetClearanceReasons,
  normalizeReason,
} from './clearanceConfigBridge'

// ── Storage keys (all almirene_*) ──────────────────────────────────────────────
const SUBMISSIONS_KEY = 'almirene_submissions'
const STUDENTS_KEY    = 'almirene_students'
const STUDENT_CTR_KEY = 'almirene_student_id_counter'
const CLEARANCE_KEY   = 'almirene_clearance'
const APP_CONFIG_KEY  = 'almirene_app_config'
const WEBSITE_KEY     = 'almirene_website_content'
const SUBJECT_LOAD_KEY   = 'almirene_subject_loads'
const SUBJECT_LOAD_EVENT = 'almirene_subject_load_updated'

const SEED_PREFIX = 'seed_'
const LEGACY_SEED_PREFIX = 'mock_stu_' // written by the older seedGradeTestData.js

// ── Small storage helpers ──────────────────────────────────────────────────────
function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

function isSeedRecord(r) {
  const id = String(r?.id || '')
  return r?._seed === true || id.startsWith(SEED_PREFIX) || id.startsWith(LEGACY_SEED_PREFIX)
}

// ── Live config (saved settings win over source defaults) ──────────────────────
function getConfig() {
  const saved = read(APP_CONFIG_KEY, {}) || {}
  return {
    campuses:    saved.campuses    || CAMPUSES,
    schoolYears: saved.schoolYears || null,
    fees:        Array.isArray(saved.feeStructure) && saved.feeStructure.length ? saved.feeStructure : FEE_STRUCTURE,
    discounts:   saved.discounts   || DEFAULT_DISCOUNTS,
  }
}

function getReferencePrefix() {
  const site = read(WEBSITE_KEY, {}) || {}
  const p = typeof site.referenceNumberPrefix === 'string' ? site.referenceNumberPrefix.trim() : ''
  return (p || 'ALMIRENE').toUpperCase()
}

// ── Deterministic people ───────────────────────────────────────────────────────
const SURNAMES = [
  'Reyes', 'Santos', 'Garcia', 'Mendoza', 'Fernandez', 'Villanueva', 'Espinosa', 'Navarro',
  'Pascual', 'Aquino', 'Bautista', 'Ramos', 'Cruz', 'Lopez', 'Torres', 'Rivera', 'Castillo',
  'Domingo', 'Gonzales', 'Aguilar', 'Delos Santos', 'Salazar', 'Tan', 'Uy', 'Lim', 'Abella',
  'Cabahug', 'Dacillo', 'Ouano', 'Sabellano',
]
const FEMALE = [
  'Angela', 'Catherine', 'Elena', 'Grace', 'Iris', 'Maria', 'Jasmine', 'Kristine', 'Louisa',
  'Nadine', 'Patricia', 'Rhea', 'Sofia', 'Trisha', 'Bea', 'Danica', 'Hazel', 'Mikaela',
]
const MALE = [
  'Brian', 'Daniel', 'Franco', 'Henry', 'James', 'Carlo', 'Miguel', 'Nathan', 'Paolo',
  'Rafael', 'Vince', 'Joshua', 'Ethan', 'Kyle', 'Lance', 'Marco', 'Noel', 'Oscar',
]
const PREV_SCHOOLS = ['St. Jude Learning Center', 'Holy Family Academy', 'Bright Minds School', 'Sunrise Christian School']

function pad(n, width) {
  return String(n).padStart(width, '0')
}

function personFor(i, birthYear) {
  const female = i % 2 === 0
  const first  = (female ? FEMALE : MALE)[(i * 5) % FEMALE.length]
  const last   = SURNAMES[(i * 7 + 2) % SURNAMES.length]
  const middle = SURNAMES[(i * 11 + 5) % SURNAMES.length]
  const month  = (i * 5) % 12 + 1
  const day    = (i * 7) % 28 + 1
  const birthDate = `${birthYear}-${pad(month, 2)}-${pad(day, 2)}`

  const bd = new Date(birthDate)
  const now = new Date()
  let age = now.getFullYear() - bd.getFullYear()
  if (now.getMonth() < bd.getMonth() || (now.getMonth() === bd.getMonth() && now.getDate() < bd.getDate())) age--

  return {
    first, middle, last, birthDate, age: String(age),
    gender: female ? 'Female' : 'Male',
    phone:  `09${170000000 + i * 7919}`,
  }
}

// ── Roster ─────────────────────────────────────────────────────────────────────
// Row code:  <outcome>[+discountId][!type]
//   A  approved, paid in full          Ap approved, partial payments
//   Ad approved, down payment only     Pm payment_received (waiting for registrar)
//   Pe pending (waiting for accounting) R  rejected
//   +sib / +eb / +top ...  discount id from the configured discounts
//   !T transferee, !R returnee, !X transferee with missing documents
const ROSTER = [
  { campus: 'Carcar',   grade: 'Grade 7',                 birthYear: 2013, rows: ['A', 'A', 'A', 'Ap', 'Ap', 'Ap+sibling', 'Ad', 'Ad', 'A+early_bird', 'Ap'] },
  { campus: 'Carcar',   grade: 'Grade 10',                birthYear: 2010, rows: ['A', 'Ap', 'Ap', 'Ad', 'Pm', 'Pe'] },
  { campus: 'Carcar',   grade: 'BS Criminology - 1st Year', birthYear: 2008, rows: ['A', 'Ap', 'Ap', 'Ad!X', 'Pm', 'Pe!T'] },
  { campus: 'Carcar',   grade: 'BS Criminology - 3rd Year', birthYear: 2006, rows: ['A', 'Ap', 'Ad', 'R'] },
  { campus: 'Talisay',  grade: 'Grade 7',                 birthYear: 2013, rows: ['A', 'Ap', 'Ap', 'Ad', 'Ad', 'Pe!T'] },
  { campus: 'Talisay',  grade: 'Grade 11',                birthYear: 2009, rows: ['A', 'Ap', 'Ad', 'Pm'] },
  { campus: 'Talisay',  grade: 'BS Nursing - 1st Year',   birthYear: 2008, rows: ['A', 'Ap+scholar', 'Ap', 'Ad', 'Pm', 'Pe'] },
  { campus: 'Talisay',  grade: 'BS HRM - 2nd Year',       birthYear: 2007, rows: ['A', 'Ap', 'Ad!R'] },
  { campus: 'Bohol',    grade: 'Grade 7',                 birthYear: 2013, rows: ['A', 'Ap', 'Ap', 'Ad', 'Pe'] },
  { campus: 'Bohol',    grade: 'Grade 9',                 birthYear: 2011, rows: ['A', 'Ap', 'Ad', 'R'] },
]

function parseRow(code) {
  const [head, typeFlag = ''] = code.split('!')
  const [outcome, discountId = ''] = head.split('+')
  return { outcome, discountId, typeFlag }
}

// ── Fees (mirrors Enrollments.jsx fee-assessment modal) ────────────────────────
function findFeeEntry(fees, gradeLevel, campusName) {
  const [programName, yearLevel = ''] = gradeLevel.split(' - ')
  return fees.find(f => {
    if (!f.program) {
      return (f.gradeLevel === gradeLevel || f.gradeLevel === programName) &&
             (f.campus === 'all' || f.campus === campusName)
    }
    return f.program === programName &&
           f.campus === campusName &&
           (!yearLevel || f.yearLevel === yearLevel) &&
           (!f.semester || f.semester === '1st') // public form sends no semester → page defaults to 1st
  }) || null
}

function buildBill(feeEntry, isCollege, discounts, studentType) {
  if (!feeEntry) return null
  const discountInputs = discounts.map(d => ({ name: d.name, rate: d.defaultRate, type: d.type || 'percentage' }))

  if (isCollege && feeEntry.tuitionRatePerUnit != null) {
    const units    = feeEntry.typicalUnits    || 0
    const labUnits = feeEntry.typicalLabUnits || 0
    const computed = computeCollegeFee(feeEntry, units, labUnits, studentType)
    let remaining  = computed.tuition
    const discountBreakdown = []
    for (const d of discountInputs) {
      if (!d.rate || d.rate <= 0) continue
      const deduction = d.type === 'fixed' ? Math.min(d.rate, remaining) : remaining * (d.rate / 100)
      discountBreakdown.push({ name: d.name, type: d.type, rate: d.rate, deduction })
      remaining -= deduction
    }
    const tuitionAfterDiscount = Math.max(0, remaining)
    return {
      originalTuition: computed.tuition,
      tuitionAfterDiscount,
      totalDiscount: computed.tuition - tuitionAfterDiscount,
      lab: computed.lab,
      enrollment: computed.enrollment,
      misc: computed.misc,
      books: 0,
      other: 0,
      // enrollment fee is the minimum down payment — NEVER part of the grand total
      grandTotal: tuitionAfterDiscount + computed.lab + computed.misc,
      discountBreakdown,
      units,
      labUnits,
      loadStatus: getLoadStatus(units, feeEntry.typicalUnits),
    }
  }

  const breakdown = {
    tuition:    feeEntry.tuition    || 0,
    enrollment: feeEntry.enrollment || 0,
    misc:       feeEntry.misc       || 0,
    lab:        feeEntry.lab        || 0,
    books:      feeEntry.books      || 0,
    other:      feeEntry.other      || 0,
    total: 0,
  }
  const bill = computeStudentBill(breakdown, discountInputs)
  // computeStudentBill() adds the enrollment fee; the rule says it must not be in the total
  bill.grandTotal = bill.tuitionAfterDiscount + breakdown.misc + breakdown.lab + breakdown.books + breakdown.other
  return bill
}

// ── Payment plans ──────────────────────────────────────────────────────────────
const METHODS = ['Cash', 'GCash', 'Bank Transfer']

function round2(n) {
  return Math.round(n * 100) / 100
}

function buildPayments(outcome, bill, seq, baseDate) {
  if (!bill) return { amountPaid: 0, balance: 0, history: [] }
  const total   = bill.grandTotal
  // enrollment fee = minimum down payment (never more than what is actually owed, e.g. a full scholar)
  const minimum = Math.min(bill.enrollment > 0 ? bill.enrollment : 1000, total)

  let schedule // list of amounts
  if (outcome === 'A')                        schedule = [total]
  else if (outcome === 'Ap')                  schedule = [minimum, round2((total - minimum) * 0.4)]
  else if (outcome === 'Ad' || outcome === 'Pm') schedule = [minimum]
  else                                        schedule = []

  // a scholarship can leave nothing to pay
  schedule = schedule.filter(a => a > 0)

  const paymentFor = ['tuition', 'misc',
    ...(bill.lab   > 0 ? ['lab']   : []),
    ...(bill.books > 0 ? ['books'] : []),
    ...(bill.other > 0 ? ['other'] : []),
  ]

  const history = schedule.map((amount, k) => {
    const date = new Date(baseDate.getTime() + k * 21 * 86400000) // installments ~3 weeks apart
    return {
      id: k + 1,
      amount,
      method: METHODS[(seq + k) % METHODS.length],
      date: date.toISOString(),
      orNumber: `OR-${String(date.getFullYear()).slice(-2)}${pad(date.getMonth() + 1, 2)}-${1000 + seq * 3 + k}`,
      notes: '',
      paymentFor,
    }
  })
  const amountPaid = round2(history.reduce((sum, h) => sum + h.amount, 0))
  return { amountPaid, balance: Math.max(0, round2(total - amountPaid)), history }
}

// ── PACK A: people, enrollments, payments ──────────────────────────────────────
export function packA() {
  const cfg        = getConfig()
  const schoolYear = getCurrentSchoolYear(cfg.schoolYears || undefined)
  const prefix     = getReferencePrefix()
  const year       = schoolYear.split('-')[0]

  // Remove records written by the older seedGradeTestData.js — pack A recreates Carcar Grade 7
  const subs = read(SUBMISSIONS_KEY, [])
  const legacy = subs.filter(s => String(s.id || '').startsWith(LEGACY_SEED_PREFIX)).length
  let submissions = subs.filter(s => !String(s.id || '').startsWith(LEGACY_SEED_PREFIX))

  const students = read(STUDENTS_KEY, [])
  const submissionIds = new Set(submissions.map(s => s.id))
  const studentIds    = new Set(students.map(s => s.id))

  let studentCounter = parseInt(localStorage.getItem(STUDENT_CTR_KEY) || '0', 10) || 0
  const nowMs = Date.now()
  const skipped = []
  let seq = 0
  let created = 0
  let mirrored = 0

  ROSTER.forEach(group => {
    const campus = cfg.campuses.find(c => c.key === group.campus && c.isActive !== false)
    if (!campus) {
      skipped.push(`${group.campus} / ${group.grade} (campus not found or inactive)`)
      seq += group.rows.length
      return
    }
    const isCollege   = !!campus.college && group.grade.includes(' - ')
    const department  = isCollege ? 'college' : 'basicEd'
    const feeEntry    = findFeeEntry(cfg.fees, group.grade, campus.name)
    const [program, yearLevel] = group.grade.split(' - ')

    group.rows.forEach(code => {
      const i  = seq++
      const id = `${SEED_PREFIX}stu_${pad(i + 1, 4)}`
      const { outcome, discountId, typeFlag } = parseRow(code)

      if (submissionIds.has(id)) return // idempotent

      const person = personFor(i, group.birthYear)
      const studentType = typeFlag === 'T' || typeFlag === 'X' ? 'Transferee' : typeFlag === 'R' ? 'Returnee' : 'New'
      const discount = cfg.discounts.find(d => d.id === discountId && d.isActive !== false)
      const bill = outcome === 'R' || outcome === 'Pe'
        ? null // no assessment yet
        : buildBill(feeEntry, isCollege, discount ? [discount] : [], studentType)

      const approvedOrPaid = outcome !== 'Pe' && outcome !== 'R'
      const recent  = outcome === 'Pe' || outcome === 'Pm'
      const baseMs  = recent
        ? nowMs - (i % 6) * 86400000                            // last few days (Today / This Week filters)
        : new Date(`${year}-06-${pad(1 + (i % 20), 2)}T09:00:00+08:00`).getTime()
      const submittedDate = new Date(baseMs).toISOString()
      const paymentBase   = new Date(baseMs + 3600000)

      const pay = approvedOrPaid ? buildPayments(outcome, bill, i, paymentBase) : { amountPaid: 0, balance: 0, history: [] }
      const status = outcome === 'Pe' ? 'pending'
        : outcome === 'Pm' ? 'payment_received'
        : outcome === 'R'  ? 'rejected'
        : 'approved'

      const lastName = person.last
      const record = {
        id,
        _seed: true,
        referenceNumber: `${prefix}-${year}-S${pad(i + 1, 4)}`,
        status,
        source: i % 7 === 0 ? 'admin' : 'website',
        submittedDate,
        updatedAt: submittedDate,

        student: {
          firstName: person.first,
          middleName: person.middle,
          lastName,
          birthDate: person.birthDate,
          age: person.age,
          placeOfBirth: campus.address ? campus.address.split(',')[1]?.trim() || '' : '',
          gender: person.gender,
          civilStatus: 'Single',
          religion: 'Roman Catholic',
          nationality: 'Filipino',
          address: `Purok ${1 + (i % 7)}, ${campus.address || ''}`.trim(),
          email: `${person.first}.${lastName}${i + 1}@example.com`.toLowerCase().replace(/\s+/g, ''),
          contactNumber: person.phone,
        },

        enrollment: {
          campus: campus.name,
          gradeLevel: group.grade,
          studentType,
          schoolYear,
        },

        father:   { name: `Roberto ${lastName}`, occupation: 'Driver',    contactNumber: `09${180000000 + i * 4111}` },
        mother:   { name: `Luzviminda ${lastName}`, occupation: 'Vendor', contactNumber: `09${190000000 + i * 3571}` },
        guardian: { name: '', relationship: '', contactNumber: '' },

        previousSchool: studentType === 'New'
          ? { name: '', address: '', lastGrade: '', schoolYear: '', elementary: null, juniorHigh: null, seniorHigh: null, lastCollege: null }
          : { name: PREV_SCHOOLS[i % PREV_SCHOOLS.length], address: 'Cebu City', lastGrade: isCollege ? '' : 'Previous grade', schoolYear: `${Number(year) - 1}-${year}`, elementary: null, juniorHigh: null, seniorHigh: null, lastCollege: null },
      }

      if (bill) {
        record.feeBreakdown     = bill
        record.totalFee         = bill.grandTotal
        record.amountPaid       = pay.amountPaid
        record.balance          = pay.balance
        record.discountsApplied = discount ? [{ id: discount.id, name: discount.name, rate: discount.defaultRate, type: discount.type || 'percentage' }] : []
      }
      if (pay.history.length) {
        record.paymentHistory  = pay.history
        record.paymentMethod   = pay.history[pay.history.length - 1].method
        record.lastPaymentDate = pay.history[pay.history.length - 1].date
        record.updatedAt       = pay.history[pay.history.length - 1].date
      }

      submissions.push(record)
      submissionIds.add(id)
      created++

      // ── Mirror approved students into almirene_students (see KNOWN GAP above) ──
      if (status === 'approved' && !studentIds.has(id)) {
        studentCounter += 1
        const missingDocs = typeFlag === 'X'
        students.push({
          id,
          _seed: true,
          studentId: `${year}${pad(studentCounter, 6)}`,
          campusKey: campus.key,
          campusName: campus.name,
          schoolYear,
          department,
          firstName: person.first,
          middleName: person.middle,
          lastName,
          suffix: '',
          birthDate: person.birthDate,
          gender: person.gender,
          address: record.student.address,
          contactNumber: person.phone,
          email: record.student.email,
          gradeLevel: group.grade,
          section: null,
          sectionId: null,
          studentType,
          program: isCollege ? program : null,
          yearLevel: isCollege ? yearLevel : null,
          semester: isCollege ? '1st' : null,
          documents: { birthCertificate: true, form138: true, goodMoral: !missingDocs, others: [] },
          documentStatus: missingDocs ? 'incomplete' : 'complete',
          status: missingDocs ? 'temporarily_enrolled' : 'officially_enrolled',
          enrollmentId: id,
          referenceNo: record.referenceNumber,
          totalFee: record.totalFee || 0,
          amountPaid: record.amountPaid || 0,
          balance: record.balance || 0,
          createdAt: submittedDate,
          updatedAt: record.updatedAt,
        })
        studentIds.add(id)
        mirrored++
      }
    })
  })

  write(SUBMISSIONS_KEY, submissions)
  write(STUDENTS_KEY, students)
  localStorage.setItem(STUDENT_CTR_KEY, String(studentCounter))
  try { window.dispatchEvent(new CustomEvent('almirene_new_submission', { detail: { seeded: true } })) } catch { /* not in a browser */ }

  console.log(`[almireneSeed] packA — ${created} enrollments created, ${mirrored} students mirrored into almirene_students (school year ${schoolYear}).`)
  if (legacy) console.log(`[almireneSeed] removed ${legacy} older mock_stu_* record(s) from the previous seed script.`)
  if (skipped.length) console.warn('[almireneSeed] skipped:', skipped)
  console.log('[almireneSeed] Refresh the page, then log in with any account (see the plan).')
  return { created, mirrored, skipped }
}

// ── PACK: clearances in every stage ────────────────────────────────────────────
// Built with the REAL bridge (createClearance / updateDepartmentClearance), so the
// records follow the app's own rules: live balance, accounting auto-clear, the
// "signed with a balance" note, graduation needing a zero balance.
//
// Needs packA first (it uses the seeded, approved students and their balances).
// Re-running replaces the previously seeded clearances.
//
// Per campus (one set each), "next up" = whose turn it is:
//   1  paid     For: Form 137              nothing signed          -> Library (registrar)
//   2  owing    For: Transfer Credentials  nothing signed          -> Library
//   3  owing    General Clearance          Library                 -> ACCOUNTING with a note
//   4  paid     For: Transcript of Records Library (+ auto acct)   -> Registrar
//   5  owing    For: Form 137              Lib, Acct(note), Reg    -> Guidance
//   6  paid     For: Honorable Dismissal   Lib, Reg, Guidance      -> ADMIN OFFICE (principal / program head)
//   7  owing    General Clearance          all five                -> fully cleared WITH balance
//   8  owing    Graduation Clearance       Library                 -> accounting BLOCKED (balance owing)
//   9  paid     Graduation Clearance       Lib, Reg, Guidance      -> Admin Office
//   10 unknown  For: Form 137              Library                 -> accounting must verify (student not found)
//   11 owing    Transfer without Guidance  Library                 -> Registrar or ACCOUNTING (any order), no Guidance column  *
//   12 owing    Transfer without Guidance  Library, Registrar      -> ACCOUNTING with a note, no Guidance column               *
//   * only where packReasons added that reason (Carcar and Talisay, Basic Ed students); Bohol skips them.
//     Their requirement list is the reason's OWN list, so later edits to the standard list do not reach them.

// The configured reason that packReasons adds (its id starts with seed_, so clear() can find it)
const SEED_REASON_ID    = 'seed_transfer_no_guidance'
const SEED_REASON_LABEL = 'Transfer without Guidance'

const CLEARANCE_SCENARIOS = [
  { pool: 'paid',    reason: 'For: Form 137',              sign: [] },
  { pool: 'owing',   reason: 'For: Transfer Credentials',  sign: [] },
  { pool: 'owing',   reason: 'General Clearance',          sign: ['library'] },
  { pool: 'paid',    reason: 'For: Transcript of Records', sign: ['library'] },
  { pool: 'owing',   reason: 'For: Form 137',              sign: ['library', 'accounting', 'registrar'] },
  { pool: 'paid',    reason: 'For: Honorable Dismissal',   sign: ['library', 'registrar', 'guidance'] },
  { pool: 'owing',   reason: 'General Clearance',          sign: ['library', 'accounting', 'registrar', 'guidance', 'admin'] },
  { pool: 'owing',   reason: 'Graduation Clearance',       sign: ['library'], graduation: true },
  { pool: 'paid',    reason: 'Graduation Clearance',       sign: ['library', 'registrar', 'guidance'], graduation: true },
  { pool: 'unknown', reason: 'For: Form 137',              sign: ['library'] },
  // Basic Ed students only: the reason lives in the Basic Ed list. Skipped where packReasons did not add it.
  { pool: 'owing',   reason: SEED_REASON_LABEL, reasonId: SEED_REASON_ID, scope: 'basicEd', sign: ['library'] },
  { pool: 'owing',   reason: SEED_REASON_LABEL, reasonId: SEED_REASON_ID, scope: 'basicEd', sign: ['library', 'registrar'] },
]

const SEED_SIGNERS = {
  library:    'Seed Librarian',
  accounting: 'Seed Accounting Officer',
  registrar:  'Seed Registrar',
  guidance:   'Seed Guidance Counselor',
  admin:      'Seed Principal',
}

function dropSeedClearances() {
  const all  = read(CLEARANCE_KEY, [])
  const keep = all.filter(r => r?._seed !== true)
  if (keep.length !== all.length) {
    write(CLEARANCE_KEY, keep)
    try { window.dispatchEvent(new CustomEvent('almirene_clearance_updated')) } catch { /* not in a browser */ }
  }
  return all.length - keep.length
}

export async function packClearance() {
  const bridge = await import('./documentBridge')
  const schoolYear = getCurrentSchoolYear()

  const students = read(STUDENTS_KEY, []).filter(isSeedRecord)
  if (!students.length) {
    console.warn('[almireneSeed] packClearance — no seeded students found. Run almireneSeed.packA() first.')
    return { created: 0 }
  }

  const removed = dropSeedClearances()
  const campusKeys = [...new Set(students.map(st => st.campusKey).filter(Boolean))].sort()

  const summary = {}
  let created = 0
  const skipped = []

  campusKeys.forEach(campusKey => {
    // Split this campus's students by their LIVE balance (same read the app uses)
    const paid = [], owing = []
    students
      .filter(st => st.campusKey === campusKey)
      .sort((a, b) => String(a.id).localeCompare(String(b.id)))
      .forEach(st => {
        const info = bridge.getClearanceBalance({ studentId: st.id })
        if (!info.found) return
        ;(info.balance > 0 ? owing : paid).push(st)
      })
    const pools = { paid, owing }

    summary[campusKey] = 0
    // Scenarios tied to a department pick their students first (they need a specific kind of student);
    // the rest take what is left. idx keeps the scenario number used in messages.
    const ordered = CLEARANCE_SCENARIOS.map((sc, idx) => ({ sc, idx })).sort((a, b) => (b.sc.scope ? 1 : 0) - (a.sc.scope ? 1 : 0))
    ordered.forEach(({ sc, idx }) => {
      let studentId, studentName
      if (sc.pool === 'unknown') {
        // A student the payment records do not know about
        studentId   = `${SEED_PREFIX}ghost_${campusKey}`
        studentName = `Unlisted, Student ${campusKey}`
      } else {
        // A scenario that needs a configured reason only runs where that reason exists (not an error elsewhere)
        if (sc.reasonId && !getClearanceReasons(sc.scope || 'basicEd', campusKey).some(r => r.id === sc.reasonId)) return
        // A scenario tied to a department takes the first student of that department
        const list = pools[sc.pool]
        const at   = sc.scope ? list.findIndex(s => s.department === sc.scope) : 0
        const st   = at >= 0 ? list.splice(at, 1)[0] : undefined
        if (!st) { skipped.push(`${campusKey} #${idx + 1} (${sc.pool}${sc.scope ? `, ${sc.scope}` : ''}) — not enough ${sc.pool} students`); return }
        studentId   = st.id
        studentName = `${st.lastName}, ${st.firstName}`
      }

      try {
        const rec = bridge.createClearance(
          studentId, studentName, campusKey, schoolYear, sc.reason,
          {
            ...(sc.graduation ? { requiresZeroBalance: true } : {}),
            ...(sc.reasonId ? { reasonId: sc.reasonId } : {}),
          },
        )
        sc.sign.forEach(dept => {
          // Accounting signs with a note whenever a balance is owing (the app's rule)
          const note = dept === 'accounting' ? 'Seed: approved by the principal — payment plan' : ''
          bridge.updateDepartmentClearance(rec.id, dept, SEED_SIGNERS[dept], note)
        })

        // Tag it so clear() removes only seeded clearances
        const all = read(CLEARANCE_KEY, [])
        const i = all.findIndex(r => r.id === rec.id)
        if (i >= 0) { all[i]._seed = true; write(CLEARANCE_KEY, all) }

        created++
        summary[campusKey]++
      } catch (err) {
        skipped.push(`${campusKey} #${idx + 1}: ${err.message}`)
      }
    })
  })

  try { window.dispatchEvent(new CustomEvent('almirene_clearance_updated')) } catch { /* not in a browser */ }

  console.log(`[almireneSeed] packClearance — ${created} clearances created for ${schoolYear}` +
    (removed ? ` (replaced ${removed} earlier seeded one${removed !== 1 ? 's' : ''})` : '') + '.')
  console.table(summary)
  if (skipped.length) console.warn('[almireneSeed] skipped:', skipped)
  console.log('[almireneSeed] Refresh the page. Each campus has the stages listed at the top of packClearance (11 and 12 only where packReasons ran).')
  return { created, skipped }
}

// ── PACK: clearance signer accounts ────────────────────────────────────────────
// One Librarian and one Guidance Counselor per campus, added to the saved user list.
// Password for every seeded account: signer123
// Login emails:  librarian.<campus>@school.edu.ph
//                guidance.<campus>@school.edu.ph          (campus key in lower case)
// A teacher who is ALSO Guidance in-charge is NOT a separate account: it is the same
// teacher login with the extra clearance duty "guidance" (Settings → Users). packTeachers
// gives that duty to each campus's Math teacher.
// Log out and back in after seeding so the session picks up the account.

const SIGNER_PASSWORD_HASH = '491efa0cce8491f8bd3d49c70283359643214e62a9e87e79a7cba13cac6d2c9f' // sha256("signer123")

// Every seeded account carries `_seedPack` ('signers' | 'teachers'), so one pack never deletes the
// accounts of another. Accounts seeded before this field existed count as 'signers'.
// pack = undefined removes every seeded account (used by clear()).
function dropSeedUsers(pack) {
  const cfg = read(APP_CONFIG_KEY, {}) || {}
  if (!Array.isArray(cfg.systemUsers)) return 0
  const keep = cfg.systemUsers.filter(u => {
    if (u?._seed !== true) return true
    return pack ? (u._seedPack || 'signers') !== pack : false
  })
  const removed = cfg.systemUsers.length - keep.length
  if (removed) {
    cfg.systemUsers = keep
    write(APP_CONFIG_KEY, cfg)
    try { window.dispatchEvent(new CustomEvent('almirene_app_config_updated')) } catch { /* not in a browser */ }
  }
  return removed
}

export async function packSigners() {
  const { SYSTEM_USERS } = await import('../config/users')
  const removed = dropSeedUsers('signers')
  const cfg  = read(APP_CONFIG_KEY, {}) || {}
  const base = Array.isArray(cfg.systemUsers) && cfg.systemUsers.length
    ? cfg.systemUsers
    : SYSTEM_USERS.map(u => ({ ...u }))

  let nextId = Math.max(0, ...base.map(u => Number(u.id) || 0)) + 1
  const added = []
  getConfig().campuses.forEach(c => {
    const k = String(c.key).toLowerCase()
    const mk = (name, email, role, extra = {}) => ({
      id: nextId++, name, email, passwordHash: SIGNER_PASSWORD_HASH,
      role, campus: c.name, campusKey: c.key, status: 'active', lastLogin: null, _seed: true, _seedPack: 'signers', ...extra,
    })
    added.push(
      mk(`${c.key} Librarian`,         `librarian.${k}@school.edu.ph`,        'librarian'),
      mk(`${c.key} Guidance Counselor`, `guidance.${k}@school.edu.ph`,         'guidance'),
    )
  })

  cfg.systemUsers = [...base, ...added]
  write(APP_CONFIG_KEY, cfg)
  try { window.dispatchEvent(new CustomEvent('almirene_app_config_updated')) } catch { /* not in a browser */ }

  console.log(`[almireneSeed] packSigners — ${added.length} accounts added` + (removed ? ` (replaced ${removed} earlier seeded)` : '') + '. Password for all: signer123')
  console.table(added.map(u => ({ email: u.email, role: u.role, campus: u.campusKey, extraDuties: (u.clearanceDuties || []).join(', ') })))
  console.log('[almireneSeed] Log out and back in, then open Clearance.')
  return { added: added.length }
}

// ── PACK: subject teachers ─────────────────────────────────────────────────────
// Per campus: five Basic Ed subject teachers and, for a campus that offers college
// programs, two college instructors. Subject Load (pack "loads", next step) assigns
// them by `_seedArea`; every account carries it so that pack never guesses from names.
//
// Fixed ids (9101 and up, by campus order and slot) so Subject Load assignments keep
// pointing at the same account when this pack is run again.
// Password for every seeded teacher: teacher123 (same as the built-in teacher accounts)
// Accounts are ordinary teachers with a PERSON'S name (e.g. "Ramon Dizon"), never a subject:
// what each one teaches comes from Subject Load, like a real school. The console table lists who
// teaches what. Login emails:  teacher.<surname>.<campus>@school.edu.ph   (e.g. teacher.dizon.talisay@school.edu.ph)
// The Math teacher of each campus is ALSO the Guidance in-charge: the same login with the extra
// clearance duty "guidance" (Settings → Users), so one account teaches and signs Guidance.
// Log out and back in after seeding so the session picks up the account.

const TEACHER_PASSWORD_HASH = 'cde383eee8ee7a4400adf7a15f716f179a2eb97646b37e089eb8d6d04e663416' // sha256("teacher123")
const TEACHER_ID_BASE = 9100

// area -> what the account is called. `covers` is for the console table only.
// Teacher names, by campus order and slot (campus 1 takes the first 7, campus 2 the next 7, ...).
// Surnames are distinct from each other and from the built-in accounts, so logins never clash.
const TEACHER_PEOPLE = [
  ['Ramon', 'Dizon'], ['Lourdes', 'Macaraeg'], ['Elmer', 'Quizon'], ['Cecilia', 'Almonte'], ['Rodel', 'Tumulak'], ['Marites', 'Gaviola'], ['Arnel', 'Sombilon'],
  ['Josefina', 'Lumapas'], ['Dante', 'Pacana'], ['Corazon', 'Villaflor'], ['Nestor', 'Cabaluna'], ['Amparo', 'Mangubat'], ['Teodoro', 'Ybanez'], ['Remedios', 'Catubig'],
  ['Vicente', 'Bacalso'], ['Gloria', 'Rosales'], ['Ernesto', 'Alcoseba'], ['Felisa', 'Tabotabo'], ['Alfredo', 'Lapinig'], ['Natividad', 'Verallo'], ['Gregorio', 'Seno'],
]

const BASIC_ED_TEACHER_AREAS = [
  { area: 'math',    label: 'Math Teacher',                     covers: 'Mathematics, Core Mathematics' },
  { area: 'english', label: 'English Teacher',                  covers: 'English, Core English, communication' },
  { area: 'science', label: 'Science Teacher',                  covers: 'Science, Earth and Life Science' },
  { area: 'filipino', label: 'Filipino / AP / EsP Teacher',     covers: 'Filipino, Araling Panlipunan, EsP, social studies' },
  { area: 'mapeh',   label: 'MAPEH / TLE / Computer Teacher',   covers: 'Music & Arts, PE & Health, TLE, Computer' },
]
const COLLEGE_TEACHER_AREAS = [
  { area: 'college1', label: 'College Instructor 1', covers: 'first half of each college subject list' },
  { area: 'college2', label: 'College Instructor 2', covers: 'second half of each college subject list' },
]

function collegeProgramsOf(campus) {
  const list = campus?.college?.programs ?? campus?.collegePrograms ?? []
  return Array.isArray(list) ? list : []
}

function hasCollegePrograms(campus) {
  return collegeProgramsOf(campus).length > 0
}

export async function packTeachers() {
  const { SYSTEM_USERS } = await import('../config/users')
  const removed = dropSeedUsers('teachers')
  const cfg  = read(APP_CONFIG_KEY, {}) || {}
  const base = Array.isArray(cfg.systemUsers) && cfg.systemUsers.length
    ? cfg.systemUsers
    : SYSTEM_USERS.map(u => ({ ...u }))

  const takenIds = new Set(base.map(u => String(u.id)))
  const added = []
  const skipped = []

  getConfig().campuses.forEach((c, campusIndex) => {
    if (c.isActive === false) return
    const k = String(c.key).toLowerCase()
    const areas = [...BASIC_ED_TEACHER_AREAS, ...(hasCollegePrograms(c) ? COLLEGE_TEACHER_AREAS : [])]
    areas.forEach((a, slot) => {
      const id = TEACHER_ID_BASE + (campusIndex + 1) * 10 + slot + 1
      if (takenIds.has(String(id))) { skipped.push(`${c.key} ${a.label} (id ${id} already used by another account)`); return }
      takenIds.add(String(id))
      const person = TEACHER_PEOPLE[(campusIndex * 7 + slot) % TEACHER_PEOPLE.length]
      added.push({
        id,
        name: `${person[0]} ${person[1]}`,
        email: `teacher.${person[1].toLowerCase()}.${k}@school.edu.ph`,
        passwordHash: TEACHER_PASSWORD_HASH,
        role: 'teacher', campus: c.name, campusKey: c.key,
        status: 'active', lastLogin: null,
        _seed: true, _seedPack: 'teachers', _seedArea: a.area,
        // One teacher per campus also signs Guidance, the way a real small school does it (same login, extra duty)
        ...(a.area === 'math' ? { clearanceDuties: ['guidance'] } : {}),
      })
    })
  })

  cfg.systemUsers = [...base, ...added]
  write(APP_CONFIG_KEY, cfg)
  try { window.dispatchEvent(new CustomEvent('almirene_app_config_updated')) } catch { /* not in a browser */ }

  const coversOf = Object.fromEntries([...BASIC_ED_TEACHER_AREAS, ...COLLEGE_TEACHER_AREAS].map(a => [a.area, a.covers]))
  console.log(`[almireneSeed] packTeachers — ${added.length} teacher account(s) added` + (removed ? ` (replaced ${removed} earlier seeded)` : '') + '. Password for all: teacher123')
  console.table(added.map(u => ({ id: u.id, email: u.email, campus: u.campusKey, teaches: coversOf[u._seedArea], alsoSigns: (u.clearanceDuties || []).join(', ') })))
  if (skipped.length) console.warn('[almireneSeed] skipped:', skipped)
  console.log('[almireneSeed] Next: almireneSeed.packLoads() assigns them to subjects (added in the next step).')
  return { added: added.length, skipped }
}

// ── PACK: sections + Subject Load ──────────────────────────────────────────────
// Uses the REAL Subject Load bridge (sections are generated by the app itself), then:
//   1. splits sections where SPLIT_SECTIONS says so (so a grade with 10 students gets 2 sections)
//   2. places every seeded student in a section (almirene_students.sectionId / section)
//   3. assigns a teacher to every subject of each level that has seeded students, by subject area
//   4. assigns a class adviser to every Basic Ed section, rotating through the Basic Ed teachers
//   5. assigns college instructors per section (1st half of the list -> instructor 1, 2nd half -> 2)
//   6. sets each subject's Subject Area (drives the grade weights in the e-Class Record)
// ...except the deliberate GAPS below, which stay unassigned so the "nobody assigned, Principal /
// Program Head signs on behalf" path can be tested.
//
// Needs packA and packTeachers first. Re-running replaces what this pack wrote earlier.
// It never overwrites a teacher you assigned by hand: only empty cells are filled.

// Campus key -> max students per section. Original value is remembered and restored by clear().
const SPLIT_SECTIONS = { Carcar: 5 }

const LOAD_GAPS = {
  subjects: [{ campus: 'Bohol',   grade: 'Grade 9', subject: 'Science' }],
  advisers: [{ campus: 'Talisay', grade: 'Grade 7' }],
  college:  [{ campus: 'Talisay', program: 'BS HRM', yearLevel: '2nd Year', last: true }],
}

const SENIOR_HIGH_GRADES = new Set(BASIC_ED_GROUPS.find(g => g.label === 'Senior High School')?.options || [])

// Which seeded teacher covers a subject (null = not mapped, left unassigned and reported)
function teacherAreaFor(subject) {
  const s = String(subject).toLowerCase()
  if (/math/.test(s)) return 'math'
  if (/science|earth and life|research|inquiries/.test(s)) return 'science'
  if (/filipino|araling|panlipunan|\besp\b|edukasyon|values|mother tongue|personal development|culture|politics|komunikasyon|pananaliksik/.test(s)) return 'filipino'
  if (/english|communication|reading and writing/.test(s)) return 'english'
  if (/music|arts|\bpe\b|physical|health|tle|hele|computer|technology|media and information/.test(s)) return 'mapeh'
  return null
}

// The grading engine's Subject Area id for a subject (see SUBJECT_AREAS in gradingEngine.js)
function engineAreaFor(subject, teacherArea, grade) {
  if (SENIOR_HIGH_GRADES.has(grade)) {
    if (/research|inquiries/i.test(subject)) return 'shs_research'
    if (/empowerment technology/i.test(subject)) return 'shs_applied'
    return 'shs_core'
  }
  if (teacherArea === 'math' || teacherArea === 'science') return 'science_math'
  if (teacherArea === 'mapeh') return 'hele_mapeh'
  return 'language'
}

function readLoads() { return read(SUBJECT_LOAD_KEY, {}) || {} }

function writeLoads(all) {
  write(SUBJECT_LOAD_KEY, all)
  try { window.dispatchEvent(new CustomEvent(SUBJECT_LOAD_EVENT)) } catch { /* not in a browser */ }
}

// Remove every seeded load / adviser / college load, and (unless keepSectionSetup) put maxPerSection back.
// packLoads keeps the section setup so a re-run reuses the same sections and student placements;
// clear() restores it. Returns how many rows were removed.
function dropSeedLoads(keepSectionSetup = false) {
  const all = readLoads()
  let removed = 0
  Object.values(all).forEach(byYear => Object.values(byYear || {}).forEach(cy => {
    if (!cy || typeof cy !== 'object') return
    ;['basicEdLoads', 'basicEdAdvisers', 'collegeLoads'].forEach(k => {
      if (!Array.isArray(cy[k])) return
      const keep = cy[k].filter(l => l?._seed !== true)
      removed += cy[k].length - keep.length
      cy[k] = keep
    })
    if (cy._seedMeta && !keepSectionSetup) {
      if (Number.isFinite(cy._seedMeta.prevMaxPerSection)) cy.maxPerSection = cy._seedMeta.prevMaxPerSection
      delete cy._seedMeta
      removed += 1
    }
  }))
  if (removed) writeLoads(all)
  return removed
}

export async function packLoads() {
  const bridge = await import('./subjectLoadBridge')
  const cfg = getConfig()
  const schoolYear = getCurrentSchoolYear(cfg.schoolYears || undefined)
  const users = (read(APP_CONFIG_KEY, {}) || {}).systemUsers || []
  const students = read(STUDENTS_KEY, [])
  const seeded = students.filter(isSeedRecord)

  if (!seeded.length) {
    console.warn('[almireneSeed] packLoads — no seeded students found. Run almireneSeed.packA() first.')
    return { campuses: 0 }
  }

  dropSeedLoads(true) // start from a clean slate so re-running never piles up (sections are kept)

  // Subject Areas come from the school year's grading framework (same list Subject Load shows).
  // An area this seed picks that the framework does not have is left unset, like a real new load.
  const syConfig  = (cfg.schoolYears || SCHOOL_YEARS).find(y => y.year === schoolYear)
  const framework = getGradingFramework(syConfig?.gradingFramework || 'do8_2015') || DEFAULT_GRADING_FRAMEWORKS[0]
  const areaIds   = new Set(getSubjectAreaOptions(framework).options.map(o => o.id))
  let areasSkipped = 0
  const summary = {}
  const warnings = []
  let placed = 0

  cfg.campuses.filter(c => c.isActive !== false).forEach(campus => {
    const key = campus.key
    const mine = seeded.filter(s => s.campusKey === key)
    if (!mine.length) return

    // Teachers of this campus by area
    const byArea = {}
    users.filter(u => u?._seedPack === 'teachers' && u.campusKey === key)
         .forEach(u => { byArea[u._seedArea] = { id: u.id, name: u.name } })
    if (!byArea.math) {
      warnings.push(`${key}: no seeded teachers found. Run almireneSeed.packTeachers() first.`)
      return
    }
    const programs = collegeProgramsOf(campus)

    // 1. sections (the app builds them from approved enrollments)
    let data = bridge.getSubjectLoadData(key, schoolYear, campus.name, programs)
    // Section ids must be the same on every read, or advisers and college loads lose their link
    const idsOf = d => JSON.stringify([d.basicEdSections, d.collegeSections])
    if (idsOf(data) !== idsOf(bridge.getSubjectLoadData(key, schoolYear, campus.name, programs))) {
      warnings.push(`${key}: Subject Load sections are not saved between reads, so advisers and college loads will not stay linked. Apply the subjectLoadBridge.js fix, then run packLoads again.`)
    }
    const prevMax = data._seedMeta?.prevMaxPerSection ?? data.maxPerSection
    if (SPLIT_SECTIONS[key]) {
      bridge.setMaxPerSection(key, schoolYear, campus.name, programs, SPLIT_SECTIONS[key])
      data = bridge.getSubjectLoadData(key, schoolYear, campus.name, programs)
    }
    const max = data.maxPerSection || 40

    // 2. place students in sections, in id order, filling one section before the next
    const groups = new Map()
    mine.forEach(s => {
      const college = s.department === 'college'
      const gKey = college ? `C|${s.program}|${s.yearLevel}` : `B|${s.gradeLevel}`
      if (!groups.has(gKey)) groups.set(gKey, { college, s0: s, list: [] })
      groups.get(gKey).list.push(s)
    })
    groups.forEach(g => {
      const sections = g.college
        ? data.collegeSections?.[g.s0.program]?.[g.s0.yearLevel] || []
        : data.basicEdSections?.[g.s0.gradeLevel] || []
      if (!sections.length) { warnings.push(`${key}: no sections for ${g.college ? `${g.s0.program} ${g.s0.yearLevel}` : g.s0.gradeLevel}`); return }
      g.list.sort((a, b) => String(a.id).localeCompare(String(b.id))).forEach((s, i) => {
        const sec = sections[Math.min(Math.floor(i / max), sections.length - 1)]
        s.sectionId = sec.id
        s.section   = sec.displayName
        placed++
      })
    })

    // 3-5. loads, advisers, college instructors (only into empty cells)
    const madeBasic = new Map()   // 'grade|subject' -> engine area
    const madeAdv   = new Set()   // sectionId
    const madeCol   = new Set()   // 'program|year|sem|sectionId|subject'
    const stat = { sections: 0, subjects: 0, advisers: 0, collegeLoads: 0, gaps: 0, keptYours: 0, unmapped: 0 }
    const basicTeachers = ['math', 'english', 'science', 'filipino', 'mapeh'].map(a => byArea[a]).filter(Boolean)
    let advIndex = 0

    const basicGrades = [...new Set(mine.filter(s => s.department !== 'college').map(s => s.gradeLevel))]
    basicGrades.forEach(grade => {
      const subjects = data.basicEdSubjects?.[grade] || []
      subjects.forEach(subject => {
        const area = teacherAreaFor(subject)
        if (!area || !byArea[area]) { stat.unmapped++; warnings.push(`${key} ${grade}: no teacher mapped for "${subject}"`); return }
        if (LOAD_GAPS.subjects.some(g => g.campus === key && g.grade === grade && g.subject === subject)) { stat.gaps++; return }
        const existing = (data.basicEdLoads || []).find(l => l.gradeLevel === grade && l.subject === subject)
        if (existing?.teacherId) { stat.keptYours++; return }
        bridge.assignBasicEdLoad(key, schoolYear, grade, subject, byArea[area])
        madeBasic.set(`${grade}|${subject}`, engineAreaFor(subject, area, grade))
        stat.subjects++
      })

      ;(data.basicEdSections?.[grade] || []).forEach(sec => {
        stat.sections++
        const teacher = basicTeachers[advIndex++ % basicTeachers.length]
        if (LOAD_GAPS.advisers.some(g => g.campus === key && g.grade === grade)) { stat.gaps++; return }
        const existing = (data.basicEdAdvisers || []).find(a => a.sectionId === sec.id)
        if (existing?.teacherId) { stat.keptYours++; return }
        bridge.assignAdviser(key, schoolYear, grade, sec.id, teacher)
        madeAdv.add(sec.id)
        stat.advisers++
      })
    })

    const collegeGroups = [...groups.values()].filter(g => g.college)
    collegeGroups.forEach(g => {
      const { program, yearLevel } = g.s0
      const semester = g.s0.semester || '1st'
      const subjects = data.collegeSubjects?.[program]?.[yearLevel]?.[semester] || []
      const sections = data.collegeSections?.[program]?.[yearLevel] || []
      const half = Math.ceil(subjects.length / 2)
      sections.forEach(sec => {
        stat.sections++
        subjects.forEach((subject, idx) => {
          const teacher = byArea[idx < half ? 'college1' : 'college2']
          if (!teacher) { stat.unmapped++; return }
          const isGap = LOAD_GAPS.college.some(x => x.campus === key && x.program === program && x.yearLevel === yearLevel && x.last && idx === subjects.length - 1)
          if (isGap) { stat.gaps++; return }
          const existing = (data.collegeLoads || []).find(l =>
            l.program === program && l.yearLevel === yearLevel && l.semester === semester &&
            l.sectionId === sec.id && l.subject === subject)
          if (existing?.teacherId) { stat.keptYours++; return }
          bridge.assignCollegeLoad(key, schoolYear, program, yearLevel, semester, sec.id, subject, teacher)
          madeCol.add(`${program}|${yearLevel}|${semester}|${sec.id}|${subject}`)
          stat.collegeLoads++
        })
      })
    })

    // 6. tag what this run wrote (so clear() removes only it) and set the Subject Area
    const all = readLoads()
    const cy = all[key]?.[schoolYear]
    if (cy) {
      ;(cy.basicEdLoads || []).forEach(l => {
        const area = madeBasic.get(`${l.gradeLevel}|${l.subject}`)
        if (area) {
          l._seed = true
          if (areaIds.has(area)) l.subjectArea = area; else areasSkipped++
        }
      })
      ;(cy.basicEdAdvisers || []).forEach(a => { if (madeAdv.has(a.sectionId)) a._seed = true })
      ;(cy.collegeLoads || []).forEach(l => {
        if (madeCol.has(`${l.program}|${l.yearLevel}|${l.semester}|${l.sectionId}|${l.subject}`)) l._seed = true
      })
      if (SPLIT_SECTIONS[key] && !cy._seedMeta) cy._seedMeta = { prevMaxPerSection: prevMax }
      writeLoads(all)
    }
    summary[key] = stat
  })

  write(STUDENTS_KEY, students)
  if (areasSkipped) {
    warnings.push(`${areasSkipped} subject(s) left without a Subject Area: ${schoolYear} uses the grading framework "${framework.label}", which does not offer the area the seed picked. Set them in Subject Load.`)
  }

  // Open clearances pick up instructor / adviser sign-offs from the new Subject Load
  let synced = 0
  try { synced = (await import('./documentBridge')).syncAllClearances() } catch { /* clearance pack not run */ }

  console.log(`[almireneSeed] packLoads — ${placed} student(s) placed in sections, school year ${schoolYear}.`)
  console.table(summary)
  if (warnings.length) console.warn('[almireneSeed] notes:', warnings)
  console.log('[almireneSeed] Gaps left on purpose: Bohol Grade 9 Science (no teacher), Talisay Grade 7 (no adviser), Talisay BS HRM 2nd Year (last subject, no instructor).')
  if (synced) console.log(`[almireneSeed] ${synced} open clearance(s) updated from Subject Load.`)
  console.log('[almireneSeed] Open Subject Load as Technical Admin and choose a campus.')
  return { placed, summary, warnings }
}

// ── PACK: "Transfer without Guidance" reason ───────────────────────────────────
// A configured clearance reason with its OWN requirements list: the campus's standard Basic Ed list
// without Guidance. Saved through the real bridge (saveClearanceReasons), per campus, for Basic Ed.
//
// Added at Carcar and Talisay. Bohol is left alone on purpose, as the control: its reasons and
// clearances must not change when the other campuses are edited.
//
// A campus that had never saved its own reasons was using the school-wide default. Saving the
// reason first writes that default into the campus (plus this one); clear() puts the campus back
// on the default when nothing else was changed, so a clean campus ends up clean again.
// Re-running replaces the reason (no duplicates). Run packClearance after it to get clearances for it.

const REASON_CAMPUSES = ['Carcar', 'Talisay']
const SEED_CONFIG_USER = { role: 'technical_admin', name: 'Seed Technical Administrator' }

export function packReasons() {
  const campuses = getConfig().campuses
  const added = []
  const skipped = []

  REASON_CAMPUSES.forEach(key => {
    if (!campuses.some(c => c.key === key && c.isActive !== false)) { skipped.push(`${key}: campus not found or inactive`); return }
    try {
      const others = getClearanceReasons('basicEd', key).filter(r => r.id !== SEED_REASON_ID)
      // The campus's own standard list, minus Guidance. Read from config, so a customised list is respected.
      const requirements = getClearanceRequirements('basicEd', undefined, key).filter(r => r.id !== 'guidance')
      const reason = { id: SEED_REASON_ID, label: SEED_REASON_LABEL, requiresZeroBalance: false, requirements }
      saveClearanceReasons('basicEd', [...others, reason], SEED_CONFIG_USER, key)
      added.push({ campus: key, reasons: others.length + 1, requirements: requirements.map(r => r.label).join(', ') })
    } catch (err) {
      skipped.push(`${key}: ${err.message}`)
    }
  })

  console.log(`[almireneSeed] packReasons — "${SEED_REASON_LABEL}" saved for Basic Ed at ${added.length} campus(es).`)
  console.table(added)
  if (skipped.length) console.warn('[almireneSeed] skipped:', skipped)
  console.log('[almireneSeed] Next: almireneSeed.packClearance() adds two clearances per campus that use it (Bohol has none, on purpose).')
  return { added: added.length, skipped }
}

// Remove the seeded reason. A campus whose remaining reasons are exactly what it inherits goes back to
// inheriting (resetClearanceReasons); any other campus keeps its list minus the seeded reason.
function dropSeedReasons() {
  let raw = {}
  try { raw = JSON.parse(localStorage.getItem('almirene_clearance_requirements') || '{}') || {} } catch { raw = {} }
  const inheritedList = Array.isArray(raw.basicEd?.reasons) && raw.basicEd.reasons.length
    ? raw.basicEd.reasons
    : getDefaultClearanceReasons('basicEd')
  const inherited = JSON.stringify(inheritedList.map(normalizeReason))

  let removed = 0
  Object.keys(raw.campuses || {}).forEach(key => {
    const saved = raw.campuses[key]?.basicEd?.reasons
    if (!Array.isArray(saved) || !saved.some(r => r?.id === SEED_REASON_ID)) return
    const remaining = saved.filter(r => r?.id !== SEED_REASON_ID).map(normalizeReason)
    try {
      if (!remaining.length || JSON.stringify(remaining) === inherited) resetClearanceReasons('basicEd', SEED_CONFIG_USER, key)
      else saveClearanceReasons('basicEd', remaining, SEED_CONFIG_USER, key)
      removed++
    } catch { /* leave it: better a stray reason than a broken config */ }
  })
  return removed
}

// ── status / clear / help ──────────────────────────────────────────────────────
export function status() {
  const subs = read(SUBMISSIONS_KEY, []).filter(isSeedRecord)
  const stus = read(STUDENTS_KEY, []).filter(isSeedRecord)

  const rows = {}
  subs.forEach(s => {
    const campus = s.enrollment?.campus || '(none)'
    rows[campus] = rows[campus] || { pending: 0, payment_received: 0, approved: 0, rejected: 0, total: 0 }
    rows[campus][s.status] = (rows[campus][s.status] || 0) + 1
    rows[campus].total++
  })

  console.log('[almireneSeed] seeded enrollments (almirene_submissions) by campus:')
  console.table(rows)
  console.log(`[almireneSeed] seeded students mirrored in almirene_students: ${stus.length}`)
  const clrs = read(CLEARANCE_KEY, []).filter(r => r?._seed === true)
  console.log(`[almireneSeed] seeded clearances in almirene_clearance: ${clrs.length}`)
  const accounts = (read(APP_CONFIG_KEY, {}) || {}).systemUsers
  const seededUsers = Array.isArray(accounts) ? accounts.filter(u => u?._seed === true) : []
  const signers  = seededUsers.filter(u => (u._seedPack || 'signers') === 'signers').length
  const teachers = seededUsers.filter(u => u._seedPack === 'teachers').length
  console.log(`[almireneSeed] seeded accounts: ${signers} signer(s), ${teachers} teacher(s)`)
  let loads = 0
  Object.values(readLoads()).forEach(byYear => Object.values(byYear || {}).forEach(cy => {
    ;['basicEdLoads', 'basicEdAdvisers', 'collegeLoads'].forEach(k => { loads += (cy?.[k] || []).filter(l => l?._seed === true).length })
  }))
  const placedStudents = stus.filter(s => s.sectionId).length
  console.log(`[almireneSeed] seeded Subject Load rows: ${loads}; students placed in a section: ${placedStudents}/${stus.length}`)
  const reasonCampuses = REASON_CAMPUSES.filter(k => getClearanceReasons('basicEd', k).some(r => r.id === SEED_REASON_ID))
  const reasonClearances = clrs.filter(r => r.reasonId === SEED_REASON_ID).length
  console.log(`[almireneSeed] "${SEED_REASON_LABEL}" set up at: ${reasonCampuses.join(', ') || '(none)'}; clearances using it: ${reasonClearances}`)
  return { enrollments: subs.length, students: stus.length, clearances: clrs.length, signers, teachers, loads, placedStudents, reasonCampuses, reasonClearances }
}

export function clear() {
  const subs = read(SUBMISSIONS_KEY, [])
  const stus = read(STUDENTS_KEY, [])
  const keepSubs = subs.filter(r => !isSeedRecord(r))
  const keepStus = stus.filter(r => !isSeedRecord(r))
  write(SUBMISSIONS_KEY, keepSubs)
  write(STUDENTS_KEY, keepStus)
  const clrs  = dropSeedClearances()
  const users = dropSeedUsers()
  const loads = dropSeedLoads()
  const reasons = dropSeedReasons()
  console.log(`[almireneSeed] removed ${subs.length - keepSubs.length} enrollment(s), ${stus.length - keepStus.length} student(s), ${clrs} clearance(s), ${users} seeded account(s), ${loads} Subject Load row(s) and the seeded reason at ${reasons} campus(es). Refresh the page.`)
  return { enrollments: subs.length - keepSubs.length, students: stus.length - keepStus.length, clearances: clrs, accounts: users, loads, reasons }
}

export function help() {
  console.log([
    'almireneSeed.packA()   people + enrollments + payments (about 54 students, 3 campuses)',
    'almireneSeed.packClearance()  clearances in every stage, per campus (run packA first)',
    'almireneSeed.packSigners()  Librarian and Guidance Counselor logins (password signer123)',
    'almireneSeed.packTeachers()  subject teachers per campus + college instructors (password teacher123)',
    'almireneSeed.packLoads()  sections, students in sections, Subject Load with 3 deliberate gaps (run packA + packTeachers first)',
    'almireneSeed.packReasons()  "Transfer without Guidance" clearance reason at Carcar + Talisay (run before packClearance)',
    'almireneSeed.status()  what is seeded now',
    'almireneSeed.clear()   remove only seeded records',
    'window.almireneReset() (devTools) wipes ALL almirene_* data back to source defaults',
  ].join('\n'))
}

/** Called from main.jsx under import.meta.env.DEV. */
export function exposeSeedTools() {
  window.almireneSeed = { packA, packClearance, packSigners, packTeachers, packLoads, packReasons, status, clear, help }
  console.log('[ALMIRENE DX dev tools] window.almireneSeed ready — type almireneSeed.help()')
}
