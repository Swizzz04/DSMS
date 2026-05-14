/**
 * gradingEngine.js
 * ─────────────────────────────────────────────────────────────────
 * Complete grading computation engine for Basic Education.
 * Follows DepEd grading standards with configurable periods
 * (Quarterly Q1-Q4 or Trimester T1-T3).
 *
 * Steps (from DepEd reference):
 *   1. Teacher enters raw scores per component (WW, PT, QA)
 *   2. System computes Percentage Score = (score / total) × 100
 *   3. System applies component weights based on subject area
 *   4. Initial Grade = sum of weighted scores
 *   5. Transmute using DepEd Transmutation Table → Final Grade
 *
 * Usage:
 *   import { computeGrade, transmute, WEIGHT_TABLES, SUBJECT_AREAS } from './gradingEngine'
 *   const result = computeGrade({ ww: { score: 145, total: 160 }, pt: {...}, qa: {...} }, 'language')
 *   // → { wwPS: 90.63, ptPS: 83.33, qaPS: 90, wwWS: 27.19, ptWS: 41.67, qaWS: 18, initial: 86.86, transmuted: 91 }
 * ─────────────────────────────────────────────────────────────────
 */

// ═══════════════════════════════════════════════════════════════
// 1. SUBJECT AREAS & COMPONENT WEIGHT TABLES
// ═══════════════════════════════════════════════════════════════

/** Subject area categories — teacher selects one when entering grades */
export const SUBJECT_AREAS = [
  { id: 'language',     label: 'Language / Filipino / Reading & Writing / Civics / AP / Christian Living / Values' },
  { id: 'science_math', label: 'Science / Mathematics' },
  { id: 'hele_mapeh',   label: 'HELE / MAPEH / TLE / EPP / Computer' },
  { id: 'shs_core',    label: 'SHS — Core Subjects' },
  { id: 'shs_applied', label: 'SHS — Applied & Specialized Subjects' },
  { id: 'shs_research',label: 'SHS — Research Subjects' },
]

/**
 * Component weight tables per subject area
 * WW = Written Works, PT = Performance Task, QA = Quarterly Assessment
 * All values are decimals (0.30 = 30%)
 */
export const WEIGHT_TABLES = {
  language:     { ww: 0.30, pt: 0.50, qa: 0.20 },
  science_math: { ww: 0.40, pt: 0.40, qa: 0.20 },
  hele_mapeh:   { ww: 0.20, pt: 0.60, qa: 0.20 },
  shs_core:     { ww: 0.25, pt: 0.50, qa: 0.25 },
  shs_applied:  { ww: 0.25, pt: 0.45, qa: 0.30 },
  shs_research: { ww: 0.35, pt: 0.40, qa: 0.25 },
}


// ═══════════════════════════════════════════════════════════════
// 2. DepEd TRANSMUTATION TABLE
// ═══════════════════════════════════════════════════════════════

/**
 * DepEd Transmutation Table — maps Initial Grade to Transmuted Grade
 * Each entry: [minInitial, maxInitial, transmutedGrade]
 * Sorted from highest to lowest
 */
const TRANSMUTATION_TABLE = [
  [100,    100,    100],
  [98.40,  99.99,  99],
  [96.80,  98.39,  98],
  [95.20,  96.79,  97],
  [93.60,  95.19,  96],
  [92.00,  93.59,  95],
  [90.40,  91.99,  94],
  [88.80,  90.39,  93],
  [87.20,  88.79,  92],
  [85.60,  87.19,  91],
  [84.00,  85.59,  90],
  [82.40,  83.99,  89],
  [80.80,  82.39,  88],
  [79.20,  80.79,  87],
  [77.60,  79.19,  86],
  [76.00,  77.59,  85],
  [74.40,  75.99,  84],
  [72.80,  74.39,  83],
  [71.20,  72.79,  82],
  [69.60,  71.19,  81],
  [68.00,  69.59,  80],
  [66.40,  67.99,  79],
  [64.80,  66.39,  78],
  [63.20,  64.79,  77],
  [61.60,  63.19,  76],
  [60.00,  61.59,  75],
  [56.00,  59.99,  74],
  [52.00,  55.99,  73],
  [48.00,  51.99,  72],
  [44.00,  47.99,  71],
  [40.00,  43.99,  70],
  [36.00,  39.99,  69],
  [32.00,  35.99,  68],
  [28.00,  31.99,  67],
  [24.00,  27.99,  66],
  [20.00,  23.99,  65],
  [16.00,  19.99,  64],
  [12.00,  15.99,  63],
  [8.00,   11.99,  62],
  [4.00,   7.99,   61],
  [0,      3.99,   60],
]

/**
 * Transmute an initial grade to a final grade using DepEd table
 * @param {number} initialGrade - The computed initial grade (0-100)
 * @returns {number} The transmuted grade (60-100)
 */
export function transmute(initialGrade) {
  if (initialGrade >= 100) return 100
  if (initialGrade < 0) return 60

  for (const [min, max, grade] of TRANSMUTATION_TABLE) {
    if (initialGrade >= min && initialGrade <= max) {
      return grade
    }
  }
  return 60 // fallback
}


// ═══════════════════════════════════════════════════════════════
// 3. GRADE COMPUTATION ENGINE
// ═══════════════════════════════════════════════════════════════

/**
 * Compute a single subject grade for one grading period
 *
 * @param {Object} scores - Raw scores
 *   { ww: { score, total }, pt: { score, total }, qa: { score, total } }
 * @param {string} subjectArea - Key from SUBJECT_AREAS (e.g. 'language', 'science_math')
 * @returns {Object} Complete grade breakdown
 */
export function computeGrade(scores, subjectArea) {
  const weights = WEIGHT_TABLES[subjectArea]
  if (!weights) throw new Error(`Unknown subject area: ${subjectArea}`)

  // Step 2: Percentage Score per component
  const wwPS = scores.ww.total > 0 ? (scores.ww.score / scores.ww.total) * 100 : 0
  const ptPS = scores.pt.total > 0 ? (scores.pt.score / scores.pt.total) * 100 : 0
  const qaPS = scores.qa.total > 0 ? (scores.qa.score / scores.qa.total) * 100 : 0

  // Step 3: Weighted Score per component
  const wwWS = wwPS * weights.ww
  const ptWS = ptPS * weights.pt
  const qaWS = qaPS * weights.qa

  // Step 4: Initial Grade
  const initial = wwWS + ptWS + qaWS

  // Step 5: Transmuted Grade
  const transmuted = transmute(initial)

  return {
    // Percentage scores
    wwPS: Math.round(wwPS * 100) / 100,
    ptPS: Math.round(ptPS * 100) / 100,
    qaPS: Math.round(qaPS * 100) / 100,
    // Weighted scores
    wwWS: Math.round(wwWS * 100) / 100,
    ptWS: Math.round(ptWS * 100) / 100,
    qaWS: Math.round(qaWS * 100) / 100,
    // Weights used
    weights,
    // Grades
    initial: Math.round(initial * 100) / 100,
    transmuted,
    // Status
    passed: transmuted >= 75,
    remarks: transmuted >= 75 ? 'Passed' : 'Failed',
  }
}


// ═══════════════════════════════════════════════════════════════
// 4. COMPOSITE SUBJECTS (MAPEH + TLE)
// ═══════════════════════════════════════════════════════════════

/**
 * Composite subject definitions
 * These subjects are split into sub-subjects with different teachers.
 * The system auto-merges their grades.
 *
 * MAPEH: All levels (Elementary, JHS, SHS)
 * TLE: Junior High + Senior High only
 * HELE: Elementary only (Home Economics & Livelihood Education)
 */
export const COMPOSITE_SUBJECTS = {
  MAPEH: {
    label: 'MAPEH',
    subSubjects: [
      { id: 'music_arts', label: 'Music & Arts', weight: 0.50 },
      { id: 'pe_health',  label: 'PE & Health',  weight: 0.50 },
    ],
    mergeMethod: 'average',
    levels: ['elementary', 'jhs', 'shs'],
  },
  TLE: {
    label: 'TLE',
    subSubjects: [
      { id: 'tle', label: 'TLE',       weight: 0.70 },
      { id: 'computer', label: 'Computer',  weight: 0.30 },
    ],
    mergeMethod: 'weighted',
    levels: ['jhs', 'shs'], // Junior High + Senior High only
  },
  HELE: {
    label: 'HELE',
    subSubjects: [
      { id: 'hele', label: 'HELE',      weight: 0.70 },
      { id: 'computer', label: 'Computer',  weight: 0.30 },
    ],
    mergeMethod: 'weighted',
    levels: ['elementary'], // Elementary only
  },
}

/**
 * Detect education level from grade level string
 * @param {string} gradeLevel - e.g. 'Grade 3', 'Grade 7', 'Grade 11'
 * @returns {string} 'elementary' | 'jhs' | 'shs'
 */
export function detectEducationLevel(gradeLevel) {
  const gl = (gradeLevel || '').toLowerCase()
  const num = parseInt(gl.replace(/[^0-9]/g, '')) || 0
  if (num >= 1 && num <= 6) return 'elementary'
  if (num >= 7 && num <= 10) return 'jhs'
  if (num >= 11 && num <= 12) return 'shs'
  if (gl.includes('kinder') || gl.includes('nursery') || gl.includes('prep')) return 'elementary'
  return 'jhs' // default
}

/**
 * Check if a subject name is a composite subject
 * @param {string} subjectName
 * @returns {Object|null} The composite config or null
 */
export function getCompositeConfig(subjectName) {
  return COMPOSITE_SUBJECTS[(subjectName || '').toUpperCase().trim()] ?? null
}

/**
 * Get sub-subjects for a composite subject
 * @param {string} subjectName - e.g. 'MAPEH', 'TLE', or 'HELE'
 * @returns {Array} Sub-subject configs or empty array
 */
export function getSubSubjects(subjectName) {
  const config = getCompositeConfig(subjectName)
  return config ? config.subSubjects : []
}

/**
 * Check if a subject is a sub-subject of a composite
 * @param {string} subjectName - e.g. 'Music & Arts', 'TLE', 'HELE', 'Computer'
 * @returns {Object|null} { parent: 'MAPEH', subSubject: {...} } or null
 */
export function getParentComposite(subjectName) {
  const lower = (subjectName || '').toLowerCase().trim()
  for (const [parentKey, config] of Object.entries(COMPOSITE_SUBJECTS)) {
    const found = config.subSubjects.find(ss => ss.label.toLowerCase() === lower)
    if (found) return { parent: parentKey, parentLabel: config.label, subSubject: found }
  }
  return null
}

/**
 * Compute merged grade for a composite subject
 * @param {Object} subGrades - { sub_id: transmutedGrade, ... }
 * @param {string} compositeKey - 'MAPEH', 'TLE', or 'HELE'
 * @returns {number} Merged transmuted grade
 */
export function computeCompositeGrade(subGrades, compositeKey) {
  const config = COMPOSITE_SUBJECTS[compositeKey]
  if (!config) return 0

  if (config.mergeMethod === 'average') {
    const grades = config.subSubjects.map(ss => subGrades[ss.id]).filter(g => g != null && g > 0)
    if (grades.length === 0) return 0
    return Math.round(grades.reduce((a, b) => a + b, 0) / grades.length)
  }

  if (config.mergeMethod === 'weighted') {
    let total = 0, hasAny = false
    config.subSubjects.forEach(ss => {
      const g = subGrades[ss.id]
      if (g != null && g > 0) { total += g * ss.weight; hasAny = true }
    })
    return hasAny ? Math.round(total) : 0
  }

  return 0
}

/**
 * Compute MAPEH grade — average of sub-subject transmuted grades
 */
export function computeMAPEH(subGrades) {
  return computeCompositeGrade(subGrades, 'MAPEH')
}

/**
 * Compute TLE grade — TLE 70% + Computer 30% (Junior/Senior High)
 */
export function computeTLE(tleGrade, computerGrade) {
  return computeCompositeGrade({ tle: tleGrade, computer: computerGrade }, 'TLE')
}

/**
 * Compute HELE grade — HELE 70% + Computer 30% (Elementary)
 */
export function computeHELE(heleGrade, computerGrade) {
  return computeCompositeGrade({ hele: heleGrade, computer: computerGrade }, 'HELE')
}


// ═══════════════════════════════════════════════════════════════
// 5. HONORS CLASSIFICATION
// ═══════════════════════════════════════════════════════════════

/**
 * Determine honors classification from general average
 * @param {number} generalAverage - The student's general average (transmuted)
 * @returns {string|null} Honors label or null
 */
export function getHonors(generalAverage) {
  if (generalAverage >= 98) return 'With Highest Honors'
  if (generalAverage >= 95) return 'With High Honors'
  if (generalAverage >= 90) return 'With Honors'
  return null
}


// ═══════════════════════════════════════════════════════════════
// 6. GRADING PERIODS
// ═══════════════════════════════════════════════════════════════

/** Available grading period configurations */
export const GRADING_PERIODS = {
  quarterly: [
    { id: 'Q1', label: '1st Quarter' },
    { id: 'Q2', label: '2nd Quarter' },
    { id: 'Q3', label: '3rd Quarter' },
    { id: 'Q4', label: '4th Quarter' },
  ],
  trimester: [
    { id: 'T1', label: '1st Trimester' },
    { id: 'T2', label: '2nd Trimester' },
    { id: 'T3', label: '3rd Trimester' },
  ],
}

/**
 * Compute Final Grade from multiple period grades
 * Final = average of all period transmuted grades
 * @param {number[]} periodGrades - Array of transmuted grades per period
 * @returns {Object} { finalGrade, passed, remarks, honors }
 */
export function computeFinalGrade(periodGrades) {
  const valid = periodGrades.filter(g => g != null && g > 0)
  if (valid.length === 0) return { finalGrade: 0, passed: false, remarks: 'Incomplete', honors: null }

  const finalGrade = Math.round(valid.reduce((a, b) => a + b, 0) / valid.length)
  return {
    finalGrade,
    passed: finalGrade >= 75,
    remarks: finalGrade >= 75 ? 'Passed' : 'Failed',
    honors: getHonors(finalGrade),
  }
}

/**
 * Compute General Average from all subject final grades
 * @param {number[]} subjectFinalGrades - Array of final grades per subject
 * @returns {Object} { generalAverage, passed, honors }
 */
export function computeGeneralAverage(subjectFinalGrades) {
  const valid = subjectFinalGrades.filter(g => g != null && g > 0)
  if (valid.length === 0) return { generalAverage: 0, passed: false, honors: null }

  const generalAverage = Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 100) / 100
  return {
    generalAverage,
    passed: generalAverage >= 75,
    honors: getHonors(generalAverage),
  }
}


// ═══════════════════════════════════════════════════════════════
// 7. DATA STRUCTURES
// ═══════════════════════════════════════════════════════════════

/**
 * Grade record shape — one per student per subject per grading period
 * Stored in localStorage via gradeBridge
 *
 * {
 *   id:            string,        // unique ID
 *   studentId:     string,        // student ID
 *   studentName:   string,        // for display
 *   subjectId:     string,        // subject identifier
 *   subjectName:   string,        // e.g. "Filipino"
 *   subjectArea:   string,        // key from SUBJECT_AREAS
 *   sectionId:     string,        // section ID
 *   campusKey:     string,        // campus
 *   schoolYear:    string,        // e.g. "2025-2026"
 *   period:        string,        // e.g. "Q1", "T2"
 *   teacherId:     number,        // teacher user ID
 *   teacherName:   string,
 *
 *   // Raw scores
 *   ww: { score: number, total: number },
 *   pt: { score: number, total: number },
 *   qa: { score: number, total: number },
 *
 *   // Computed (by engine)
 *   initial:       number,        // initial grade
 *   transmuted:    number,        // final transmuted grade
 *   passed:        boolean,
 *
 *   // Workflow
 *   status:        'draft' | 'submitted' | 'approved',
 *   submittedAt:   string | null, // ISO date
 *   approvedAt:    string | null,
 *   approvedBy:    string | null, // principal/registrar name
 *
 *   createdAt:     string,        // ISO date
 *   updatedAt:     string,        // ISO date
 * }
 */


// ═══════════════════════════════════════════════════════════════
// 8. LOCALSTORAGE BRIDGE (swap to API later)
// ═══════════════════════════════════════════════════════════════

const GRADES_KEY = 'almirene_grades'

function getGrades() {
  try {
    return JSON.parse(localStorage.getItem(GRADES_KEY) || '[]')
  } catch { return [] }
}

function saveGrades(grades) {
  localStorage.setItem(GRADES_KEY, JSON.stringify(grades))
  window.dispatchEvent(new CustomEvent('almirene_grades_updated'))
}

/** Get all grades, optionally filtered */
export function getAllGrades(filters) {
  let grades = getGrades()
  if (filters) {
    if (filters.teacherId)  grades = grades.filter(g => g.teacherId === filters.teacherId)
    if (filters.studentId)  grades = grades.filter(g => g.studentId === filters.studentId)
    if (filters.subjectId)  grades = grades.filter(g => g.subjectId === filters.subjectId)
    if (filters.sectionId)  grades = grades.filter(g => g.sectionId === filters.sectionId)
    if (filters.campusKey)  grades = grades.filter(g => g.campusKey === filters.campusKey)
    if (filters.schoolYear) grades = grades.filter(g => g.schoolYear === filters.schoolYear)
    if (filters.period)     grades = grades.filter(g => g.period === filters.period)
    if (filters.status)     grades = grades.filter(g => g.status === filters.status)
  }
  return grades
}

/** Save or update a grade record (draft) */
export function saveGradeRecord(record) {
  const grades = getGrades()
  const now = new Date().toISOString()

  // Check if exists (same student + subject + period + schoolYear)
  const idx = grades.findIndex(g =>
    g.studentId === record.studentId &&
    g.subjectId === record.subjectId &&
    g.period === record.period &&
    g.schoolYear === record.schoolYear
  )

  // Compute grades
  const computed = computeGrade(
    { ww: record.ww, pt: record.pt, qa: record.qa },
    record.subjectArea
  )

  const full = {
    ...record,
    initial: computed.initial,
    transmuted: computed.transmuted,
    passed: computed.passed,
    updatedAt: now,
  }

  if (idx >= 0) {
    // Update existing
    grades[idx] = { ...grades[idx], ...full }
  } else {
    // New record
    full.id = `grade_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    full.createdAt = now
    full.status = full.status || 'draft'
    full.submittedAt = null
    full.approvedAt = null
    full.approvedBy = null
    grades.push(full)
  }

  saveGrades(grades)
  return full
}

/** Submit grades for a section+subject+period (teacher → principal/registrar) */
export function submitGrades(teacherId, subjectId, sectionId, period, schoolYear) {
  const grades = getGrades()
  const now = new Date().toISOString()
  let count = 0

  grades.forEach(g => {
    if (g.teacherId === teacherId && g.subjectId === subjectId &&
        g.sectionId === sectionId && g.period === period &&
        g.schoolYear === schoolYear && g.status === 'draft') {
      g.status = 'submitted'
      g.submittedAt = now
      count++
    }
  })

  saveGrades(grades)
  return count
}

/** Approve grades (principal/registrar approves submitted grades) */
export function approveGrades(subjectId, sectionId, period, schoolYear, approverName) {
  const grades = getGrades()
  const now = new Date().toISOString()
  let count = 0

  grades.forEach(g => {
    if (g.subjectId === subjectId && g.sectionId === sectionId &&
        g.period === period && g.schoolYear === schoolYear &&
        g.status === 'submitted') {
      g.status = 'approved'
      g.approvedAt = now
      g.approvedBy = approverName
      count++
    }
  })

  saveGrades(grades)
  return count
}

/** Delete a draft grade record */
export function deleteGradeRecord(gradeId) {
  const grades = getGrades().filter(g => g.id !== gradeId || g.status !== 'draft')
  saveGrades(grades)
}

/** Get grade summary for a student across all subjects and periods */
export function getStudentGradeSummary(studentId, schoolYear) {
  const grades = getAllGrades({ studentId, schoolYear })

  // Group by subject
  const bySubject = {}
  grades.forEach(g => {
    if (!bySubject[g.subjectId]) {
      bySubject[g.subjectId] = { subjectName: g.subjectName, subjectArea: g.subjectArea, periods: {} }
    }
    bySubject[g.subjectId].periods[g.period] = {
      transmuted: g.transmuted,
      initial: g.initial,
      passed: g.passed,
      status: g.status,
    }
  })

  // Compute final grades per subject
  const subjects = Object.entries(bySubject).map(([subjectId, data]) => {
    const periodGrades = Object.values(data.periods).map(p => p.transmuted).filter(g => g > 0)
    const final = computeFinalGrade(periodGrades)
    return {
      subjectId,
      subjectName: data.subjectName,
      subjectArea: data.subjectArea,
      periods: data.periods,
      ...final,
    }
  })

  // General average
  const allFinals = subjects.map(s => s.finalGrade).filter(g => g > 0)
  const general = computeGeneralAverage(allFinals)

  return { subjects, ...general }
}

// ═══════════════════════════════════════════════════════════════
// 9. COLLEGE GRADING ENGINE (CHED Standard)
//    Append this entire section to the END of gradingEngine.js
// ═══════════════════════════════════════════════════════════════

/**
 * College Grade Scale — 1.00 to 5.00 (CHED-aligned)
 * Each entry: { min, max, grade, descriptor }
 * Percentage input is 0–100 (semester grade before conversion)
 */
export const COLLEGE_GRADE_SCALE = [
  { min: 96, max: 100, grade: '1.00', descriptor: 'Excellent'         },
  { min: 93, max: 95,  grade: '1.25', descriptor: 'Very Good'         },
  { min: 90, max: 92,  grade: '1.50', descriptor: 'Very Good'         },
  { min: 87, max: 89,  grade: '1.75', descriptor: 'Good'              },
  { min: 84, max: 86,  grade: '2.00', descriptor: 'Good'              },
  { min: 81, max: 83,  grade: '2.25', descriptor: 'Satisfactory'      },
  { min: 78, max: 80,  grade: '2.50', descriptor: 'Satisfactory'      },
  { min: 76, max: 77,  grade: '2.75', descriptor: 'Passing'           },
  { min: 75, max: 75,  grade: '3.00', descriptor: 'Passing (Minimum)' },
  { min: 0,  max: 74,  grade: '5.00', descriptor: 'Failed'            },
]

/** College semester options */
export const COLLEGE_SEMESTERS = [
  { id: '1st_sem', label: '1st Semester' },
  { id: '2nd_sem', label: '2nd Semester' },
  { id: 'summer',  label: 'Summer Term'  },
]

/** Special grade codes that override computed point grades */
export const SPECIAL_GRADES = [
  { value: 'INC',  label: 'INC — Incomplete'           },
  { value: 'DRP',  label: 'DRP — Dropped'              },
  { value: '4.00', label: '4.00 — Conditional Failure' },
]

/**
 * Convert a semester grade (0–100) to a point grade row.
 * Returns the matching COLLEGE_GRADE_SCALE entry or null if input is invalid.
 *
 * @param {number|string} semesterGrade
 * @returns {{ grade: string, descriptor: string } | null}
 */
export function getPointGrade(semesterGrade) {
  if (semesterGrade === null || semesterGrade === undefined || semesterGrade === '') return null
  const num = Number(semesterGrade)
  if (isNaN(num)) return null
  for (const row of COLLEGE_GRADE_SCALE) {
    if (num >= row.min && num <= row.max) return row
  }
  return { grade: '5.00', descriptor: 'Failed' }
}

/**
 * Compute the college semester grade from Prelim, Midterm, and Finals.
 * Weights: Prelim 30% + Midterm 30% + Finals 40%
 *
 * @param {number|string} prelim   — 0–100
 * @param {number|string} midterm  — 0–100
 * @param {number|string} finals   — 0–100
 * @returns {{ semesterGrade, pointGrade, descriptor, passed } | null}
 *   Returns null if any input is missing (allows partial entry without crashing)
 */
export function computeCollegeGrade(prelim, midterm, finals) {
  const hasAll = prelim !== '' && prelim != null &&
                 midterm !== '' && midterm != null &&
                 finals !== '' && finals != null

  if (!hasAll) return null

  const p = Math.min(100, Math.max(0, Number(prelim)  || 0))
  const m = Math.min(100, Math.max(0, Number(midterm) || 0))
  const f = Math.min(100, Math.max(0, Number(finals)  || 0))

  const semesterGrade = Math.round((p * 0.30 + m * 0.30 + f * 0.40) * 100) / 100
  const scaleRow      = getPointGrade(semesterGrade)

  return {
    semesterGrade,
    pointGrade:  scaleRow?.grade      ?? '5.00',
    descriptor:  scaleRow?.descriptor ?? 'Failed',
    passed:      scaleRow ? Number(scaleRow.grade) <= 3.00 : false,
  }
}

/**
 * Get Latin Honor classification from a GWA.
 * @param {number} gwa
 * @returns {string | null}
 */
export function getLatinHonor(gwa) {
  const g = Number(gwa)
  if (isNaN(g)) return null
  if (g >= 1.00 && g <= 1.20) return 'Summa Cum Laude'
  if (g >= 1.21 && g <= 1.45) return 'Magna Cum Laude'
  if (g >= 1.46 && g <= 1.75) return 'Cum Laude'
  return null
}

/**
 * Compute General Weighted Average from subject grades.
 * @param {Array<{ pointGrade: string, units: number }>} subjects
 * @returns {number | null}
 */
export function computeGWA(subjects) {
  let totalPoints = 0, totalUnits = 0
  subjects.forEach(s => {
    const grade = Number(s.pointGrade)
    if (!isNaN(grade) && s.units > 0) {
      totalPoints += grade * s.units
      totalUnits  += s.units
    }
  })
  if (totalUnits === 0) return null
  return Math.round((totalPoints / totalUnits) * 100) / 100
}


// ─────────────────────────────────────────────────────────────────────────────
// COLLEGE GRADE BRIDGE (swap for API when backend is ready)
// Storage key: almirene_college_grades
// ─────────────────────────────────────────────────────────────────────────────

const COLLEGE_GRADES_KEY = 'almirene_college_grades'
const COLLEGE_DRAFT_KEY  = 'almirene_college_draft'

function getCollegeGradesAll() {
  try { return JSON.parse(localStorage.getItem(COLLEGE_GRADES_KEY) || '[]') }
  catch { return [] }
}

function saveCollegeGradesAll(grades) {
  localStorage.setItem(COLLEGE_GRADES_KEY, JSON.stringify(grades))
  window.dispatchEvent(new CustomEvent('almirene_college_grades_updated'))
}

/** Get college grades with optional filters */
export function getCollegeGrades(filters = {}) {
  let grades = getCollegeGradesAll()
  if (filters.teacherId)  grades = grades.filter(g => g.teacherId  === filters.teacherId)
  if (filters.studentId)  grades = grades.filter(g => g.studentId  === filters.studentId)
  if (filters.subjectId)  grades = grades.filter(g => g.subjectId  === filters.subjectId)
  if (filters.sectionId)  grades = grades.filter(g => g.sectionId  === filters.sectionId)
  if (filters.campusKey)  grades = grades.filter(g => g.campusKey  === filters.campusKey)
  if (filters.schoolYear) grades = grades.filter(g => g.schoolYear === filters.schoolYear)
  if (filters.semester)   grades = grades.filter(g => g.semester   === filters.semester)
  if (filters.status)     grades = grades.filter(g => g.status     === filters.status)
  return grades
}

/**
 * Save or update a college grade record (draft).
 * Auto-computes point grade from Prelim/Midterm/Finals.
 * Special grades (INC, DRP, 4.00) override computed grade.
 */
export function saveCollegeGradeRecord(record) {
  const grades = getCollegeGradesAll()
  const now    = new Date().toISOString()

  const idx = grades.findIndex(g =>
    g.studentId  === record.studentId  &&
    g.subjectId  === record.subjectId  &&
    g.semester   === record.semester   &&
    g.schoolYear === record.schoolYear
  )

  // Only compute if no special grade override
  const computed = record.specialGrade
    ? null
    : computeCollegeGrade(record.prelim, record.midterm, record.finals)

  const full = {
    ...record,
    department:    'college',
    semesterGrade: computed?.semesterGrade ?? null,
    pointGrade:    record.specialGrade || computed?.pointGrade || null,
    descriptor:    record.specialGrade
      ? SPECIAL_GRADES.find(s => s.value === record.specialGrade)?.label ?? record.specialGrade
      : computed?.descriptor ?? null,
    passed: record.specialGrade
      ? false  // INC, DRP, 4.00 are all not fully passing
      : (computed?.passed ?? false),
    updatedAt: now,
  }

  if (idx >= 0) {
    // Only update if record is still in draft
    if (grades[idx].status !== 'draft') return grades[idx] // locked — no edit
    grades[idx] = { ...grades[idx], ...full }
  } else {
    full.id          = `cgrade_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    full.createdAt   = now
    full.status      = 'draft'
    full.submittedAt = null
    full.approvedAt  = null
    full.approvedBy  = null
    grades.push(full)
  }

  saveCollegeGradesAll(grades)
  return full
}

/** Submit college grades for a subject+section+semester (instructor → program head) */
export function submitCollegeGrades(teacherId, subjectId, sectionId, semester, schoolYear) {
  const grades = getCollegeGradesAll()
  const now = new Date().toISOString()
  let count = 0

  grades.forEach(g => {
    if (
      g.teacherId  === teacherId  &&
      g.subjectId  === subjectId  &&
      g.sectionId  === sectionId  &&
      g.semester   === semester   &&
      g.schoolYear === schoolYear &&
      g.status     === 'draft'
    ) {
      g.status      = 'submitted'
      g.submittedAt = now
      count++
    }
  })

  saveCollegeGradesAll(grades)
  return count
}

/** Approve college grades (program head → registrar) */
export function approveCollegeGrades(subjectId, sectionId, semester, schoolYear, approverName) {
  const grades = getCollegeGradesAll()
  const now = new Date().toISOString()
  let count = 0

  grades.forEach(g => {
    if (
      g.subjectId  === subjectId  &&
      g.sectionId  === sectionId  &&
      g.semester   === semester   &&
      g.schoolYear === schoolYear &&
      g.status     === 'submitted'
    ) {
      g.status     = 'approved'
      g.approvedAt = now
      g.approvedBy = approverName
      count++
    }
  })

  saveCollegeGradesAll(grades)
  return count
}

/** Load college draft scores (auto-save, survives refresh) */
export function loadCollegeDraftScores() {
  try { return JSON.parse(localStorage.getItem(COLLEGE_DRAFT_KEY) || '{}') }
  catch { return {} }
}

/** Save college draft scores */
export function saveCollegeDraftScores(data) {
  localStorage.setItem(COLLEGE_DRAFT_KEY, JSON.stringify(data))
}