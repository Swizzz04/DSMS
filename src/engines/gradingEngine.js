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
 * DepEd Transmutation Table (DO 8, s.2015) — maps Initial Grade to Transmuted Grade
 * Each entry: [minInitial, maxInitial, transmutedGrade]
 * Sorted from highest to lowest
 *
 * This is the DEFAULT / fallback table, verified against the official DO 8, s.2015
 * annex. Schools can override this via Settings → School Year → Transmutation
 * Table (stored in localStorage, see getTransmutationTable()/saveTransmutationTable()
 * below) — e.g. to enter DepEd's DO 015, s.2026 "adjusted" transmutation table for
 * SY 2026-2027, once the school has the official breakpoints from the DepEd Order's
 * annex. That adjusted table is NOT hardcoded here — publicly available summaries
 * agree on the anchor point (Initial Grade 70.00 → Transmuted 75) but disagree on
 * exact interior breakpoints, and grade cutoffs are too high-stakes to guess at.
 */
export const DEFAULT_TRANSMUTATION_TABLE = [
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
 * Transmute an initial grade to a final grade using a DepEd transmutation table.
 * @param {number} initialGrade - The computed initial grade (0-100)
 * @param {Array<[number,number,number]>} [table] - Transmutation table to use.
 *   Defaults to DEFAULT_TRANSMUTATION_TABLE (DO 8, s.2015). Pass a school-configured
 *   override (see getTransmutationTable()) to use a different table without
 *   changing this pure function.
 * @returns {number} The transmuted grade (60-100)
 */
export function transmute(initialGrade, table = DEFAULT_TRANSMUTATION_TABLE) {
  if (initialGrade >= 100) return 100
  if (initialGrade < 0) return 60

  for (const [min, max, grade] of table) {
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
 * Compute a single subject grade for one grading period.
 *
 * Internally resolves the live-configured 'do8_2015' grading framework
 * (see Section 3C below) and delegates to computeGradeUniversal() — so
 * editing component weights or the transmutation table via Settings takes
 * effect here automatically, with zero changes needed at call sites. The
 * return shape (wwPS/ptPS/qaPS/wwWS/ptWS/qaWS/transmuted/...) is kept
 * exactly as before for backward compatibility with existing UI code.
 *
 * @param {Object} scores - Raw scores
 *   { ww: { score, total }, pt: { score, total }, qa: { score, total } }
 * @param {string} subjectArea - Key from SUBJECT_AREAS (e.g. 'language', 'science_math')
 * @param {Array<[number,number,number]>} [table] - Explicit transmutation table
 *   override. Only needed to FORCE a specific table (e.g. from a pure module
 *   like exportEClassRecord.js); normally omit this and let the framework's
 *   own configured table (or the school-wide default) apply automatically.
 * @returns {Object} Complete grade breakdown
 */
export function computeGrade(scores, subjectArea, table) {
  const framework = getGradingFramework('do8_2015') || DEFAULT_GRADING_FRAMEWORKS[0]
  const effectiveFramework = table ? { ...framework, transmutationTable: table } : framework
  const weights = effectiveFramework.subjectGroups.find(g => g.id === subjectArea)?.weights
  if (!weights) throw new Error(`Unknown subject area: ${subjectArea}`)

  const result = computeGradeUniversal(scores, effectiveFramework, subjectArea)

  return {
    // Percentage scores
    wwPS: result.breakdown.ww?.pct ?? 0,
    ptPS: result.breakdown.pt?.pct ?? 0,
    qaPS: result.breakdown.qa?.pct ?? 0,
    // Weighted scores
    wwWS: result.breakdown.ww?.weighted ?? 0,
    ptWS: result.breakdown.pt?.weighted ?? 0,
    qaWS: result.breakdown.qa?.weighted ?? 0,
    // Weights used
    weights,
    // Grades
    initial: result.initial,
    transmuted: result.final,
    // Status
    passed: result.passed,
    remarks: result.remarks,
  }
}


// ═══════════════════════════════════════════════════════════════
// 3B. DepEd ORDER NO. 015, s.2026 GRADING (WW / PT / EX)
// ═══════════════════════════════════════════════════════════════
/**
 * DO 015, s.2026 ("Revised Guidelines on Classroom Assessment, Grading
 * System, and Awards and Recognition") restructures the Basic Ed grading
 * components effective SY 2026-2027, alongside the three-term calendar
 * shift in DO 009, s.2026:
 *
 *   - Written Works (WW)      → renamed Written/Oral Works (WW) — same role
 *   - Performance Tasks (PT)  → renamed Product/Performance Tasks (PT)
 *   - Quarterly Assessment (QA) → replaced by Examinations (EX), which is
 *     itself computed from THREE sub-assessments in a fixed internal split:
 *     Summative Test 1 (30%) + Summative Test 2 (30%) + Term Exam (40%).
 *
 * Component weights also changed and are grouped differently than the old
 * WEIGHT_TABLES (see SUBJECT_GROUPS_2026 / WEIGHT_TABLES_2026 below) — e.g.
 * "Language / Science / Math" are no longer split into separate weight
 * groups; DO 015 gives Core Subjects (incl. Science & Math) one weight set
 * and EPP/TLE/MAPEH another.
 *
 * Some subject groups (SHS Research Electives, SHS Work Immersion) have NO
 * Examinations component at all — ex weight is 0/absent and is simply
 * skipped in the Initial Grade sum.
 *
 * IMPORTANT: Kindergarten–Grade 3 (Key Stage 1) moves to a DESCRIPTIVE
 * (qualitative, non-numerical) grading system under DO 015 and should NOT
 * use this — or any — numerical computation path. Grade 2 has a documented
 * transitional exception where numerical grading still applies; this is a
 * school/DepEd-policy nuance, not something this engine decides — the
 * calling page should gate which grade levels use computeGrade2026() at all.
 *
 * The Initial Grade → Transmuted Grade step still uses transmute() with
 * whatever table is passed in (see getTransmutationTable()) — DO 015
 * introduces its own "adjusted" transmutation table for SY 2026-2027, but
 * its exact breakpoints are NOT hardcoded in this file (see the note on
 * DEFAULT_TRANSMUTATION_TABLE above). Configure it via Settings once you
 * have the official DepEd annex.
 */

/** Subject/learning-area groups under DO 015, s.2026 (Grades 4-12) */
export const SUBJECT_GROUPS_2026 = [
  { id: 'core',                 label: 'English / Filipino / Mathematics / Science / AP / GMRC / Values Education (Grades 4-10)' },
  { id: 'mapeh_tle',            label: 'EPP / TLE / Music / Arts / PE & Health — MAPEH (Grades 4-10)' },
  { id: 'shs_core',             label: 'SHS — Core Subjects / Other Academic Electives' },
  { id: 'shs_field_exposure',   label: 'SHS — Field Exposure / Arts Apprenticeship / Creative Production & Innovation' },
  { id: 'shs_research',         label: 'SHS — Research Electives / Design & Innovation' },
  { id: 'shs_work_immersion',   label: 'SHS — Work Immersion' },
]

/**
 * Component weight tables per DO 015, s.2026 subject group.
 * ex: null means this group has NO Examinations component (skipped entirely
 * in computeGrade2026 — Initial Grade is WW + PT only).
 * examSplit is the fixed internal ST1/ST2/TE breakdown of the ex weight,
 * per DO 015 (all groups that HAVE an ex component use the same 30/30/40
 * split, except shs_field_exposure which uses Term Exam only per the order).
 */
export const WEIGHT_TABLES_2026 = {
  core:               { ww: 0.20, pt: 0.50, ex: 0.30, examSplit: { st1: 0.30, st2: 0.30, te: 0.40 } },
  mapeh_tle:          { ww: 0.20, pt: 0.60, ex: 0.20, examSplit: { st1: 0.30, st2: 0.30, te: 0.40 } },
  shs_core:           { ww: 0.20, pt: 0.50, ex: 0.30, examSplit: { st1: 0.30, st2: 0.30, te: 0.40 } },
  shs_field_exposure: { ww: 0.15, pt: 0.70, ex: 0.15, examSplit: { te: 1.00 } }, // TE only, no ST1/ST2
  shs_research:       { ww: 0.40, pt: 0.60, ex: null },
  shs_work_immersion: { ww: 0.20, pt: 0.80, ex: null },
}

/**
 * Compute the Examinations (EX) percentage score from its internal
 * sub-assessments, per the fixed split in the subject group's weight table.
 * @param {Object} exScores - { st1: {score,total}, st2: {score,total}, te: {score,total} }
 *   Only the keys present in the group's examSplit are read (e.g. shs_field_exposure
 *   only reads `te`).
 * @param {Object} examSplit - e.g. { st1: 0.30, st2: 0.30, te: 0.40 }
 * @returns {number} Examinations percentage score (0-100)
 */
export function computeExamsPercentage(exScores, examSplit) {
  let total = 0
  for (const [key, weight] of Object.entries(examSplit)) {
    const s = exScores?.[key]
    const pct = s && s.total > 0 ? (s.score / s.total) * 100 : 0
    total += pct * weight
  }
  return total
}

/**
 * Compute a single subject grade for one grading period under DO 015, s.2026.
 *
 * @param {Object} scores - Raw scores
 *   { ww: { score, total }, pt: { score, total }, ex: { st1: {score,total}, st2: {score,total}, te: {score,total} } | null }
 *   `ex` may be omitted entirely for subject groups with no Examinations component.
 * @param {string} subjectGroup - Key from SUBJECT_GROUPS_2026
 * @param {Array<[number,number,number]>} [table] - Transmutation table override.
 * @returns {Object} Complete grade breakdown (same shape as computeGrade(), keyed ww/pt/ex)
 */
/**
 * Compute a single subject grade for one grading period under DO 015, s.2026.
 * Internally resolves the live-configured 'do015_2026' framework and delegates
 * to computeGradeUniversal() — see computeGrade()'s docstring above for why.
 *
 * @param {Object} scores - Raw scores
 *   { ww: { score, total }, pt: { score, total }, ex: { st1: {score,total}, st2: {score,total}, te: {score,total} } | null }
 *   `ex` may be omitted entirely for subject groups with no Examinations component.
 * @param {string} subjectGroup - Key from SUBJECT_GROUPS_2026
 * @param {Array<[number,number,number]>} [table] - Explicit transmutation table override.
 * @returns {Object} Complete grade breakdown (same shape as computeGrade(), keyed ww/pt/ex)
 */
export function computeGrade2026(scores, subjectGroup, table) {
  const framework = getGradingFramework('do015_2026') || DEFAULT_GRADING_FRAMEWORKS[1]
  const effectiveFramework = table ? { ...framework, transmutationTable: table } : framework
  const weights = effectiveFramework.subjectGroups.find(g => g.id === subjectGroup)?.weights
  if (!weights) throw new Error(`Unknown DO 015 subject group: ${subjectGroup}`)

  const result = computeGradeUniversal(scores, effectiveFramework, subjectGroup)

  return {
    wwPS: result.breakdown.ww?.pct ?? 0,
    ptPS: result.breakdown.pt?.pct ?? 0,
    exPS: result.breakdown.ex?.pct ?? null,
    wwWS: result.breakdown.ww?.weighted ?? 0,
    ptWS: result.breakdown.pt?.weighted ?? 0,
    exWS: result.breakdown.ex?.weighted ?? null,
    weights,
    initial: result.initial,
    transmuted: result.final,
    passed: result.passed,
    remarks: result.remarks,
  }
}


// ═══════════════════════════════════════════════════════════════
// 3C. UNIVERSAL CONFIGURABLE GRADING FRAMEWORK
// ═══════════════════════════════════════════════════════════════
/**
 * The SUBJECT_AREAS/WEIGHT_TABLES (DO 8) and SUBJECT_GROUPS_2026/WEIGHT_TABLES_2026
 * (DO 015) constants above are hardcoded snapshots of two specific DepEd orders.
 * Every time DepEd revises the grading system — renames components, changes
 * weights, changes which subjects get an exam component, or (per DepEd's own
 * stated plan) removes transmutation entirely for zero-based grading — those
 * constants would need a code change and a new deploy.
 *
 * This section makes ALL of that data-driven instead: a "Grading Framework" is
 * a JSON-shaped config object — components, per-subject-group weights, and
 * whether transmutation is used at all — stored in localStorage and edited by
 * the Super Admin via Settings → School Year → Grading Frameworks. A future
 * DepEd change becomes an edit in that screen, not a code change here.
 *
 * Framework shape:
 * {
 *   id: string, label: string,
 *   components: [
 *     { key: 'ww', label: 'Written Works' },
 *     { key: 'ex', label: 'Examinations', subcomponents: [
 *         { key: 'st1', label: 'Summative Test 1', weight: 0.30 }, ...
 *     ]},  // subcomponents is optional — omit for a plain single-score component
 *   ],
 *   subjectGroups: [
 *     { id: 'core', label: '...', weights: { ww: 0.20, pt: 0.50, ex: 0.30 } },
 *     // a component key can be omitted/0 from a group's weights to mean
 *     // "this subject group has no such component" (e.g. no exams)
 *   ],
 *   useTransmutation: boolean,  // false = zero-based grading: Initial Grade IS the Final Grade
 *   transmutationTable: Array<[min,max,grade]> | null,  // null = fall back to the
 *     // school-wide override from getTransmutationTable(), then DEFAULT_TRANSMUTATION_TABLE
 * }
 */

const GRADING_FRAMEWORKS_KEY = 'almirene_grading_frameworks'
const COLLEGE_GRADING_FRAMEWORKS_KEY = 'almirene_college_grading_frameworks'

/** Seed data — built from the verified DO 8, s.2015 and DO 015, s.2026 constants above. */
export const DEFAULT_GRADING_FRAMEWORKS = [
  {
    id: 'do8_2015',
    label: 'DepEd Order No. 8, s.2015 (WW / PT / QA)',
    components: [
      { key: 'ww', label: 'Written Works' },
      { key: 'pt', label: 'Performance Tasks' },
      { key: 'qa', label: 'Quarterly Assessment' },
    ],
    subjectGroups: SUBJECT_AREAS.map(a => ({ id: a.id, label: a.label, weights: { ...WEIGHT_TABLES[a.id] } })),
    useTransmutation: true,
    transmutationTable: null,
  },
  {
    id: 'do015_2026',
    label: 'DepEd Order No. 015, s.2026 (WW / PT / EX)',
    components: [
      { key: 'ww', label: 'Written/Oral Works' },
      { key: 'pt', label: 'Product/Performance Tasks' },
      { key: 'ex', label: 'Examinations', subcomponents: [
          { key: 'st1', label: 'Summative Test 1', weight: 0.30 },
          { key: 'st2', label: 'Summative Test 2', weight: 0.30 },
          { key: 'te',  label: 'Term Exam',        weight: 0.40 },
      ]},
    ],
    subjectGroups: SUBJECT_GROUPS_2026.map(g => {
      const w = WEIGHT_TABLES_2026[g.id]
      const weights = { ww: w.ww, pt: w.pt }
      if (w.ex != null) weights.ex = w.ex
      const group = { id: g.id, label: g.label, weights }
      // SHS Field Exposure etc. use Term Exam only, not the standard ST1/ST2/TE
      // split — carry that override through so computeGradeUniversal respects it.
      if (w.examSplit && (w.examSplit.st1 == null || w.examSplit.st2 == null)) {
        group.subcomponentOverrides = {
          ex: Object.entries(w.examSplit).map(([key, weight]) => ({
            key, weight, label: key === 'te' ? 'Term Exam' : key === 'st1' ? 'Summative Test 1' : 'Summative Test 2',
          })),
        }
      }
      return group
    }),
    useTransmutation: true,
    transmutationTable: null,
  },
]

/**
 * Get all configured grading frameworks. Seeds DEFAULT_GRADING_FRAMEWORKS into
 * localStorage on first read if nothing's been saved yet, so Settings has
 * something to display and edit immediately.
 */
export function getGradingFrameworks() {
  try {
    const saved = JSON.parse(localStorage.getItem(GRADING_FRAMEWORKS_KEY) || 'null')
    if (Array.isArray(saved) && saved.length > 0) return saved
  } catch { /* fall through to seed */ }
  const seeded = DEFAULT_GRADING_FRAMEWORKS.map(f => ({ ...f, components: [...f.components], subjectGroups: f.subjectGroups.map(g => ({ ...g, weights: { ...g.weights } })) }))
  localStorage.setItem(GRADING_FRAMEWORKS_KEY, JSON.stringify(seeded))
  return seeded
}

/** Get a single framework by id, or null if it doesn't exist. */
export function getGradingFramework(id) {
  return getGradingFrameworks().find(f => f.id === id) || null
}

/** Replace the full list of frameworks (used by the Settings editor's Save). */
export function saveGradingFrameworks(frameworks) {
  localStorage.setItem(GRADING_FRAMEWORKS_KEY, JSON.stringify(frameworks))
  window.dispatchEvent(new CustomEvent('almirene_grading_frameworks_updated'))
}

/** Insert or update a single framework by id. */
export function saveGradingFramework(framework) {
  const all = getGradingFrameworks()
  const idx = all.findIndex(f => f.id === framework.id)
  if (idx >= 0) all[idx] = framework
  else all.push(framework)
  saveGradingFrameworks(all)
}

/** Remove a framework by id. Refuses to delete the last remaining framework. */
export function deleteGradingFramework(id) {
  const all = getGradingFrameworks()
  if (all.length <= 1) return false
  saveGradingFrameworks(all.filter(f => f.id !== id))
  return true
}

/**
 * Compute a subject grade using ANY grading framework — the fully generic
 * replacement for computeGrade()/computeGrade2026(). Works for any number of
 * components, any weight split, any subject group, and respects the
 * framework's own useTransmutation flag (zero-based grading support).
 *
 * @param {Object} scores - Keyed by component key. A component with
 *   subcomponents (e.g. 'ex') expects a nested object: { st1: {score,total}, ... }.
 *   A plain component (e.g. 'ww') expects { score, total } directly.
 * @param {Object} framework - A grading framework object (see shape above).
 * @param {string} subjectGroupId - Which of the framework's subjectGroups to use.
 * @returns {Object} { breakdown: { [componentKey]: {pct, weighted} | null }, initial,
 *   final, usedTransmutation, passed, remarks }
 */
export function computeGradeUniversal(scores, framework, subjectGroupId) {
  const group = framework.subjectGroups.find(g => g.id === subjectGroupId)
  if (!group) throw new Error(`Unknown subject group "${subjectGroupId}" for framework "${framework.id}"`)

  const breakdown = {}
  let initial = 0

  for (const comp of framework.components) {
    const weight = group.weights[comp.key]
    if (!weight) { breakdown[comp.key] = null; continue }

    let pct
    if (comp.subcomponents?.length) {
      // A subject group can override which sub-assessments apply and their
      // split via group.subcomponentOverrides[comp.key] (e.g. SHS Field
      // Exposure uses Term Exam only, not the standard ST1/ST2/TE split).
      const effectiveSubs = group.subcomponentOverrides?.[comp.key] || comp.subcomponents
      pct = effectiveSubs.reduce((sum, sub) => {
        const s = scores?.[comp.key]?.[sub.key]
        const p = s && s.total > 0 ? (s.score / s.total) * 100 : 0
        return sum + p * sub.weight
      }, 0)
    } else {
      const s = scores?.[comp.key]
      pct = s && s.total > 0 ? (s.score / s.total) * 100 : 0
    }

    const weighted = pct * weight
    breakdown[comp.key] = { pct: Math.round(pct * 100) / 100, weighted: Math.round(weighted * 100) / 100 }
    initial += weighted
  }

  initial = Math.round(initial * 100) / 100
  const useTransmutation = framework.useTransmutation !== false

  let final
  if (useTransmutation) {
    const table = framework.transmutationTable || getTransmutationTable()
    final = transmute(initial, table)
  } else {
    // Zero-based grading: the Initial Grade IS the Final Grade — no lookup table.
    final = Math.round(Math.min(100, Math.max(0, initial)))
  }

  return {
    breakdown,
    initial,
    final,
    usedTransmutation: useTransmutation,
    passed: final >= 75,
    remarks: final >= 75 ? 'Passed' : 'Failed',
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
const TRANSMUTATION_CONFIG_KEY = 'almirene_transmutation_table'

/**
 * Get the school's configured transmutation table, falling back to
 * DEFAULT_TRANSMUTATION_TABLE (DO 8, s.2015) if none has been saved.
 * This is the "config" half of the config-driven transmutation feature —
 * pages/hooks call this and pass the result into transmute()/computeGrade()
 * so the engine functions themselves stay pure (no localStorage reads inside them).
 */
export function getTransmutationTable() {
  try {
    const saved = JSON.parse(localStorage.getItem(TRANSMUTATION_CONFIG_KEY) || 'null')
    if (Array.isArray(saved) && saved.length > 0) return saved
  } catch { /* fall through to default */ }
  return DEFAULT_TRANSMUTATION_TABLE
}

/** Save a school-customized transmutation table. Pass null/[] to reset to default. */
export function saveTransmutationTable(table) {
  if (!table || table.length === 0) {
    localStorage.removeItem(TRANSMUTATION_CONFIG_KEY)
  } else {
    localStorage.setItem(TRANSMUTATION_CONFIG_KEY, JSON.stringify(table))
  }
  window.dispatchEvent(new CustomEvent('almirene_transmutation_table_updated'))
}

/** True if the school has a custom transmutation table saved (vs. using the default). */
export function hasCustomTransmutationTable() {
  try {
    const saved = JSON.parse(localStorage.getItem(TRANSMUTATION_CONFIG_KEY) || 'null')
    return Array.isArray(saved) && saved.length > 0
  } catch { return false }
}

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

/**
 * Save or update a grade record (draft).
 *
 * @param {object} record — must include a `scores` object keyed by component
 *   ({ [key]: { score, total } }), matching whatever components `framework`
 *   defines for record.subjectArea.
 * @param {object} framework — the grading framework record.scores was entered
 *   against. Previously this always computed against the DO 8, s.2015
 *   framework regardless of what was actually configured (via the computeGrade
 *   wrapper) — meaning a school on DO 015, s.2026 (or any custom framework)
 *   could see one grade live on screen and have a DIFFERENT one silently
 *   persisted. Falls back to the DO 8, s.2015 defaults only when the given
 *   framework's component keys don't match what was entered — same rule the
 *   live on-screen preview already follows (see Eclassrecord.jsx's
 *   frameworkMatchesEntryUI) — rather than guessing at a mismatched shape.
 */
export function saveGradeRecord(record, framework) {
  const grades = getGrades()
  const now = new Date().toISOString()

  // Check if exists (same student + subject + period + schoolYear)
  const idx = grades.findIndex(g =>
    g.studentId === record.studentId &&
    g.subjectId === record.subjectId &&
    g.period === record.period &&
    g.schoolYear === record.schoolYear
  )

  const enteredKeys   = Object.keys(record.scores || {}).sort().join(',')
  const frameworkKeys = framework?.components?.map(c => c.key).sort().join(',')
  const effectiveFramework = (framework && frameworkKeys === enteredKeys)
    ? framework
    : (getGradingFramework('do8_2015') || DEFAULT_GRADING_FRAMEWORKS[0])

  const result = computeGradeUniversal(record.scores, effectiveFramework, record.subjectArea)

  const full = {
    ...record,
    initial:    result.initial,
    transmuted: result.final,
    passed:     result.passed,
    breakdown:  result.breakdown,
    updatedAt:  now,
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

/**
 * Default college grading frameworks — same idea as DEFAULT_GRADING_FRAMEWORKS
 * for Basic Ed, but flatter: college applies one weight split to every course
 * uniformly (no per-subject-group variation the way WW/PT/QA differs by
 * subject area in Basic Ed), so each framework is just a components list
 * (each with its own weight) plus a point scale. Add/duplicate frameworks in
 * Settings → Grading Frameworks → College Grading for when CHED revises
 * either the Prelim/Midterm/Finals split or the point scale.
 */
export const DEFAULT_COLLEGE_GRADING_FRAMEWORKS = [
  {
    id: 'ched_standard',
    label: 'CHED Standard (Prelim/Midterm/Finals)',
    components: [
      { key: 'prelim',  label: 'Prelim',  weight: 0.30 },
      { key: 'midterm', label: 'Midterm', weight: 0.30 },
      { key: 'finals',  label: 'Finals',  weight: 0.40 },
    ],
    scale: COLLEGE_GRADE_SCALE,
  },
]

/**
 * Get the saved college grading frameworks, seeding localStorage on first
 * read. If almirene_college_grading_frameworks isn't set yet but the earlier
 * single-config key (almirene_college_grading_config, pre-multi-framework)
 * is, migrate it into the first framework instead of discarding it.
 */
export function getCollegeGradingFrameworks() {
  try {
    const saved = JSON.parse(localStorage.getItem(COLLEGE_GRADING_FRAMEWORKS_KEY) || 'null')
    if (Array.isArray(saved) && saved.length) return saved
  } catch { /* fall through to seed */ }

  let seeded = DEFAULT_COLLEGE_GRADING_FRAMEWORKS.map(f => ({ ...f, components: f.components.map(c => ({ ...c })), scale: f.scale.map(r => ({ ...r })) }))
  try {
    const legacy = JSON.parse(localStorage.getItem('almirene_college_grading_config') || 'null')
    if (legacy && legacy.weights && Array.isArray(legacy.scale)) {
      seeded = [{
        id: 'ched_standard',
        label: 'CHED Standard (Prelim/Midterm/Finals)',
        components: [
          { key: 'prelim',  label: 'Prelim',  weight: legacy.weights.prelim  ?? 0.30 },
          { key: 'midterm', label: 'Midterm', weight: legacy.weights.midterm ?? 0.30 },
          { key: 'finals',  label: 'Finals',  weight: legacy.weights.finals  ?? 0.40 },
        ],
        scale: legacy.scale.map(r => ({ ...r })),
      }]
    }
  } catch { /* ignore — use default */ }

  localStorage.setItem(COLLEGE_GRADING_FRAMEWORKS_KEY, JSON.stringify(seeded))
  return seeded
}

/** Look up a single college grading framework by id. */
export function getCollegeGradingFramework(id) {
  return getCollegeGradingFrameworks().find(f => f.id === id) || null
}

/** Replace the full list of college grading frameworks (used by the Settings editor's Save). */
export function saveCollegeGradingFrameworks(frameworks) {
  localStorage.setItem(COLLEGE_GRADING_FRAMEWORKS_KEY, JSON.stringify(frameworks))
  window.dispatchEvent(new CustomEvent('almirene_college_grading_frameworks_updated'))
}

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
 * Returns the matching scale entry or null if input is invalid.
 *
 * @param {number|string} semesterGrade
 * @param {Array} scale — defaults to the first saved/configured college framework's scale
 * @returns {{ grade: string, descriptor: string } | null}
 */
export function getPointGrade(semesterGrade, scale = getCollegeGradingFrameworks()[0].scale) {
  if (semesterGrade === null || semesterGrade === undefined || semesterGrade === '') return null
  const num = Number(semesterGrade)
  if (isNaN(num)) return null
  for (const row of scale) {
    if (num >= row.min && num <= row.max) return row
  }
  return { grade: '5.00', descriptor: 'Failed' }
}

/**
 * Compute the college semester grade from a scores object keyed by component
 * (e.g. { prelim: 88, midterm: 90, finals: 85 }). Weights and the point scale
 * come from the given framework (see getCollegeGradingFramework/
 * getCollegeGradingFrameworks) — configurable via Settings, defaulting to
 * CHED Standard (Prelim 30% + Midterm 30% + Finals 40%) — rather than being
 * fixed in code, so a CHED revision to the components, split, or scale
 * doesn't need a code change. Works for any component count/shape the
 * framework defines, not just exactly three.
 *
 * @param {object} scores — { [componentKey]: number|string } — 0–100 each
 * @param {object} framework — defaults to the first saved/configured college grading framework
 * @returns {{ semesterGrade, pointGrade, descriptor, passed } | null}
 *   Returns null if any of the framework's components is missing a score
 *   (allows partial entry without crashing)
 */
export function computeCollegeGrade(scores, framework = getCollegeGradingFrameworks()[0]) {
  const comps = framework.components
  const hasAll = comps.every(c => scores?.[c.key] !== '' && scores?.[c.key] != null)
  if (!hasAll) return null

  let semesterGrade = 0
  for (const c of comps) {
    const val = Math.min(100, Math.max(0, Number(scores[c.key]) || 0))
    semesterGrade += val * (c.weight || 0)
  }
  semesterGrade  = Math.round(semesterGrade * 100) / 100
  const scaleRow = getPointGrade(semesterGrade, framework.scale)

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
 * Auto-computes point grade from record.scores (see computeCollegeGrade).
 * Special grades (INC, DRP, 4.00) override computed grade.
 *
 * @param {object} record — must include a `scores` object keyed by component
 * @param {object} framework — the framework record.scores was entered against;
 *   defaults to the first saved/configured one if not passed
 */
export function saveCollegeGradeRecord(record, framework = getCollegeGradingFrameworks()[0]) {
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
    : computeCollegeGrade(record.scores, framework)

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