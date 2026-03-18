/**
 * enrollmentBridge.js
 * ─────────────────────────────────────────────────────────────────
 * Shared bridge between the school website enrollment form and the
 * CSHC Admin Portal.
 *
 * HOW IT WORKS (no backend required):
 * 1. Website form (enrollment.js) calls submitToAdminPortal(formData)
 *    → normalizes the data → saves to localStorage key 'cshc_submissions'
 *
 * 2. Admin portal reads 'cshc_submissions' on load and merges them
 *    into the live enrollment list via useBridgeEnrollments() hook.
 *
 * Both the website and the admin portal must be on the same domain
 * (or localhost) for localStorage sharing to work.
 * When a real backend is added, only this file needs to change.
 */

const STORAGE_KEY  = 'cshc_submissions'
const COUNTER_KEY  = 'cshc_ref_counter'

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
  return `CSHC-${year}-W${String(counter).padStart(4, '0')}`
  // W prefix = from Website, to distinguish from admin-created entries
}

// ── Normalize raw website form data into portal format ──────────
function normalizeFormData(raw, refNum) {
  const campusKey  = raw.campus || ''
  const gradeRaw   = raw.gradeLevel || ''
  const typeRaw    = raw.studentType || ''

  // Calculate age from birthDate
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
    id:              refNum,                    // use refNum as ID for website submissions
    referenceNumber: refNum,
    status:          'pending',
    source:          'website',                 // flag: came from enrollment form
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
      // College detailed history
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

// ────────────────────────────────────────────────────────────────
// PUBLIC API — used by the WEBSITE enrollment.js
// ────────────────────────────────────────────────────────────────

/**
 * Called by enrollment.js on form submit.
 * Saves the normalized enrollment to localStorage.
 *
 * @param {Object} rawFormData  — Object.fromEntries(new FormData(form))
 * @returns {{ success: boolean, referenceNumber: string }}
 */
export function submitToAdminPortal(rawFormData) {
  try {
    const refNum     = generateReferenceNumber()
    const normalized = normalizeFormData(rawFormData, refNum)

    // Load existing submissions
    const existing = getWebsiteSubmissions()
    existing.push(normalized)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing))

    // Dispatch event so admin portal (if open in same browser) updates live
    window.dispatchEvent(new CustomEvent('cshc_new_submission', {
      detail: { referenceNumber: refNum }
    }))

    return { success: true, referenceNumber: refNum }
  } catch (err) {
    console.error('[CSHC Bridge] Failed to save submission:', err)
    return { success: false, referenceNumber: null }
  }
}

// ────────────────────────────────────────────────────────────────
// PUBLIC API — used by the ADMIN PORTAL
// ────────────────────────────────────────────────────────────────

/**
 * Returns all website submissions from localStorage.
 * @returns {Array}
 */
export function getWebsiteSubmissions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

/**
 * Updates the status of a website submission (approve/reject).
 * @param {string} referenceNumber
 * @param {'approved'|'rejected'|'pending'} newStatus
 */
export function updateSubmissionStatus(referenceNumber, newStatus) {
  try {
    const submissions = getWebsiteSubmissions()
    const idx = submissions.findIndex(s => s.referenceNumber === referenceNumber)
    if (idx !== -1) {
      submissions[idx].status = newStatus
      submissions[idx].updatedAt = new Date().toISOString()
      localStorage.setItem(STORAGE_KEY, JSON.stringify(submissions))
      return true
    }
    return false
  } catch {
    return false
  }
}

/**
 * Deletes a website submission (e.g., after it's been formally processed).
 * @param {string} referenceNumber
 */
export function deleteSubmission(referenceNumber) {
  try {
    const submissions = getWebsiteSubmissions().filter(
      s => s.referenceNumber !== referenceNumber
    )
    localStorage.setItem(STORAGE_KEY, JSON.stringify(submissions))
    return true
  } catch {
    return false
  }
}

/**
 * Clears ALL website submissions (admin utility).
 */
export function clearAllSubmissions() {
  localStorage.removeItem(STORAGE_KEY)
}

/**
 * Returns count of unreviewed (pending) website submissions.
 */
export function getPendingCount() {
  return getWebsiteSubmissions().filter(s => s.status === 'pending').length
}