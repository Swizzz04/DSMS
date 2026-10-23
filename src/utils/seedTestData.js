/**
 * seedTestData.js — DEV-ONLY test data for walking every page in every role.
 * ─────────────────────────────────────────────────────────────────────────────
 * Loaded from main.jsx under `import.meta.env.DEV`, so it never reaches a
 * production bundle. Plain .js (no JSX). No UI, console commands only:
 *
 *   almireneSeed.packA()    people + enrollments + payments (Step 1)
 *   almireneSeed.packClearance()  clearances in every stage, per campus (needs packA first)
 *   almireneSeed.packSigners()    Librarian, Guidance and a teacher-with-Guidance-duty login per campus
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
  getCurrentSchoolYear,
  computeStudentBill,
  computeCollegeFee,
  getLoadStatus,
} from '../config/appConfig'

// ── Storage keys (all almirene_*) ──────────────────────────────────────────────
const SUBMISSIONS_KEY = 'almirene_submissions'
const STUDENTS_KEY    = 'almirene_students'
const STUDENT_CTR_KEY = 'almirene_student_id_counter'
const CLEARANCE_KEY   = 'almirene_clearance'
const APP_CONFIG_KEY  = 'almirene_app_config'
const WEBSITE_KEY     = 'almirene_website_content'

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
    CLEARANCE_SCENARIOS.forEach((sc, idx) => {
      let studentId, studentName
      if (sc.pool === 'unknown') {
        // A student the payment records do not know about
        studentId   = `${SEED_PREFIX}ghost_${campusKey}`
        studentName = `Unlisted, Student ${campusKey}`
      } else {
        const st = pools[sc.pool].shift()
        if (!st) { skipped.push(`${campusKey} #${idx + 1} (${sc.pool}) — not enough ${sc.pool} students`); return }
        studentId   = st.id
        studentName = `${st.lastName}, ${st.firstName}`
      }

      try {
        const rec = bridge.createClearance(
          studentId, studentName, campusKey, schoolYear, sc.reason,
          sc.graduation ? { requiresZeroBalance: true } : {},
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
  console.log('[almireneSeed] Refresh the page. Each campus has the 10 stages listed at the top of packClearance.')
  return { created, skipped }
}

// ── PACK: clearance signer accounts ────────────────────────────────────────────
// One Librarian, one Guidance Counselor and one Teacher who ALSO signs Guidance
// (a small-school "two hats" account) per campus, added to the saved user list.
// Password for every seeded account: signer123
// Login emails:  librarian.<campus>@school.edu.ph
//                guidance.<campus>@school.edu.ph
//                teacher.guidance.<campus>@school.edu.ph   (campus key in lower case)
// Log out and back in after seeding so the session picks up the account.

const SIGNER_PASSWORD_HASH = '491efa0cce8491f8bd3d49c70283359643214e62a9e87e79a7cba13cac6d2c9f' // sha256("signer123")

function dropSeedUsers() {
  const cfg = read(APP_CONFIG_KEY, {}) || {}
  if (!Array.isArray(cfg.systemUsers)) return 0
  const keep = cfg.systemUsers.filter(u => u?._seed !== true)
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
  const removed = dropSeedUsers()
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
      role, campus: c.name, campusKey: c.key, status: 'active', lastLogin: null, _seed: true, ...extra,
    })
    added.push(
      mk(`${c.key} Librarian`,         `librarian.${k}@school.edu.ph`,        'librarian'),
      mk(`${c.key} Guidance Counselor`, `guidance.${k}@school.edu.ph`,         'guidance'),
      mk(`${c.key} Teacher (Guidance in-charge)`, `teacher.guidance.${k}@school.edu.ph`, 'teacher', { clearanceDuties: ['guidance'] }),
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
  return { enrollments: subs.length, students: stus.length, clearances: clrs.length }
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
  console.log(`[almireneSeed] removed ${subs.length - keepSubs.length} enrollment(s), ${stus.length - keepStus.length} student(s), ${clrs} clearance(s) and ${users} seeded account(s). Refresh the page.`)
  return { enrollments: subs.length - keepSubs.length, students: stus.length - keepStus.length, clearances: clrs, accounts: users }
}

export function help() {
  console.log([
    'almireneSeed.packA()   people + enrollments + payments (about 54 students, 3 campuses)',
    'almireneSeed.packClearance()  clearances in every stage, per campus (run packA first)',
    'almireneSeed.packSigners()  Librarian, Guidance and teacher-with-Guidance-duty logins (password signer123)',
    'almireneSeed.status()  what is seeded now',
    'almireneSeed.clear()   remove only seeded records',
    'window.almireneReset() (devTools) wipes ALL almirene_* data back to source defaults',
  ].join('\n'))
}

/** Called from main.jsx under import.meta.env.DEV. */
export function exposeSeedTools() {
  window.almireneSeed = { packA, packClearance, packSigners, status, clear, help }
  console.log('[ALMIRENE DX dev tools] window.almireneSeed ready — type almireneSeed.help()')
}
