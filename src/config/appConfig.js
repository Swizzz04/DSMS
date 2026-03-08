/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║               CSHC CENTRAL CONFIGURATION FILE                   ║
 * ║                                                                  ║
 * ║  This is the SINGLE SOURCE OF TRUTH for the entire application. ║
 * ║  All campuses, programs, grade levels, fees, school years,      ║
 * ║  and users are defined here.                                     ║
 * ║                                                                  ║
 * ║  To add a campus:    → add to CAMPUSES array                    ║
 * ║  To add a program:   → add to campus.collegePrograms            ║
 * ║  To add a grade:     → add to BASIC_ED_GROUPS                   ║
 * ║  To change fees:     → update FEE_STRUCTURE                     ║
 * ║  To add a user:      → add to SYSTEM_USERS                      ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 *  Runtime edits (via Settings page) are persisted to localStorage
 *  and override these defaults automatically.
 */

// ─────────────────────────────────────────────────────────────────────
// SCHOOL IDENTITY
// ─────────────────────────────────────────────────────────────────────
export const SCHOOL_INFO = {
  name:         'Cebu Sacred Heart College',
  abbreviation: 'CSHC',
  address:      'Cebu, Philippines',
  website:      'www.cshc.edu.ph',
  timezone:     'Asia/Manila',
  currency:     'PHP',
  currencySymbol: '₱',
  dateFormat:   'MM/DD/YYYY',
  academicStart: 'August',
  academicEnd:   'May',
  primaryColor:  '#750014',
  secondaryColor:'#080c42',
}

// ─────────────────────────────────────────────────────────────────────
// SCHOOL YEARS
// ─────────────────────────────────────────────────────────────────────
export const SCHOOL_YEARS = [
  {
    id: 1,
    year: '2025-2026',
    startDate: '2025-08-01',
    endDate: '2026-05-31',
    status: 'completed',
    isCurrent: false,
  },
  {
    id: 2,
    year: '2026-2027',
    startDate: '2026-08-01',
    endDate: '2027-05-31',
    status: 'active',
    isCurrent: true,
  },
  {
    id: 3,
    year: '2027-2028',
    startDate: '2027-08-01',
    endDate: '2028-05-31',
    status: 'upcoming',
    isCurrent: false,
  },
]

// ─────────────────────────────────────────────────────────────────────
// CAMPUSES
// Each campus declares which departments it offers and which
// college programs (if any) are available there.
// ─────────────────────────────────────────────────────────────────────
export const CAMPUSES = [
  {
    id: 1,
    key: 'Talisay',                       // short key used in dropdowns/filters
    name: 'Talisay City Campus',
    address: 'Talisay City, Cebu',
    contactNumber: '032-123-4567',
    email: 'talisay@cshc.edu.ph',
    isActive: true,
    departments: ['Basic Education', 'Senior High School', 'College'],
    // ↓ Add or remove programs here — Enrollments/Students update automatically
    collegePrograms: ['BS Nursing', 'BS Tourism', 'BS HRM'],
  },
  {
    id: 2,
    key: 'Carcar',
    name: 'Carcar City Campus',
    address: 'Carcar City, Cebu',
    contactNumber: '032-234-5678',
    email: 'carcar@cshc.edu.ph',
    isActive: true,
    departments: ['Basic Education', 'Senior High School', 'College'],
    collegePrograms: ['BS Criminology'],
  },
  {
    id: 3,
    key: 'Bohol',
    name: 'Bohol Campus',
    address: 'Tagbilaran City, Bohol',
    contactNumber: '038-345-6789',
    email: 'bohol@cshc.edu.ph',
    isActive: true,
    departments: ['Basic Education', 'Senior High School'],
    collegePrograms: [],                   // no college at this campus
  },
]

// ─────────────────────────────────────────────────────────────────────
// COLLEGE YEAR LEVELS
// Applied to every college program automatically
// ─────────────────────────────────────────────────────────────────────
export const COLLEGE_YEAR_LEVELS = ['1st Year', '2nd Year', '3rd Year', '4th Year']

// ─────────────────────────────────────────────────────────────────────
// BASIC EDUCATION GRADE GROUPS
// Add/remove grades or groups here — all dropdowns update everywhere
// ─────────────────────────────────────────────────────────────────────
export const BASIC_ED_GROUPS = [
  {
    label: 'Pre-Elementary',
    options: ['Nursery', 'Kindergarten', 'Preparatory'],
  },
  {
    label: 'Elementary',
    options: ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'],
  },
  {
    label: 'Junior High School',
    options: ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10'],
  },
  {
    label: 'Senior High School',
    options: ['Grade 11', 'Grade 12'],
  },
]

// ─────────────────────────────────────────────────────────────────────
// GRADE LEVEL SECTIONS
// Sections per grade level — used in student records & enrollment forms
// ─────────────────────────────────────────────────────────────────────
export const GRADE_SECTIONS = {
  'Grade 7':  ['St. Francis', 'St. John', 'St. Peter'],
  'Grade 8':  ['St. Francis', 'St. John', 'St. Peter', 'St. Paul'],
  'Grade 9':  ['St. Francis', 'St. John', 'St. Peter'],
  'Grade 10': ['St. Francis', 'St. John', 'St. Peter'],
  'Grade 11': ['STEM', 'ABM', 'HUMSS'],
  'Grade 12': ['STEM', 'ABM', 'HUMSS'],
  // College sections follow program — e.g. 'Nursing 1-A', 'Nursing 1-B'
}

// ─────────────────────────────────────────────────────────────────────
// FEE STRUCTURE
// campus: 'all' means the fee applies to all campuses
// ─────────────────────────────────────────────────────────────────────
export const FEE_STRUCTURE = [
  // Basic Education
  { id: 1,  gradeLevel: 'Nursery',       tuition: 18000, enrollment: 1500, misc: 2000, campus: 'all' },
  { id: 2,  gradeLevel: 'Kindergarten',  tuition: 18000, enrollment: 1500, misc: 2000, campus: 'all' },
  { id: 3,  gradeLevel: 'Preparatory',   tuition: 18000, enrollment: 1500, misc: 2000, campus: 'all' },
  { id: 4,  gradeLevel: 'Grade 1',       tuition: 22000, enrollment: 1500, misc: 2000, campus: 'all' },
  { id: 5,  gradeLevel: 'Grade 2',       tuition: 22000, enrollment: 1500, misc: 2000, campus: 'all' },
  { id: 6,  gradeLevel: 'Grade 3',       tuition: 22000, enrollment: 1500, misc: 2000, campus: 'all' },
  { id: 7,  gradeLevel: 'Grade 4',       tuition: 24000, enrollment: 1500, misc: 2000, campus: 'all' },
  { id: 8,  gradeLevel: 'Grade 5',       tuition: 24000, enrollment: 1500, misc: 2000, campus: 'all' },
  { id: 9,  gradeLevel: 'Grade 6',       tuition: 24000, enrollment: 1500, misc: 2000, campus: 'all' },
  { id: 10, gradeLevel: 'Grade 7',       tuition: 42000, enrollment: 2000, misc: 3000, campus: 'all' },
  { id: 11, gradeLevel: 'Grade 8',       tuition: 42000, enrollment: 2000, misc: 3000, campus: 'all' },
  { id: 12, gradeLevel: 'Grade 9',       tuition: 44000, enrollment: 2000, misc: 3000, campus: 'all' },
  { id: 13, gradeLevel: 'Grade 10',      tuition: 44000, enrollment: 2000, misc: 3000, campus: 'all' },
  { id: 14, gradeLevel: 'Grade 11',      tuition: 48000, enrollment: 2000, misc: 4000, campus: 'all' },
  { id: 15, gradeLevel: 'Grade 12',      tuition: 48000, enrollment: 2000, misc: 4000, campus: 'all' },
  // College — per campus
  { id: 16, gradeLevel: 'BS Nursing',     tuition: 85000, enrollment: 5000, misc: 8000, campus: 'Talisay City Campus' },
  { id: 17, gradeLevel: 'BS Tourism',     tuition: 60000, enrollment: 4000, misc: 6000, campus: 'Talisay City Campus' },
  { id: 18, gradeLevel: 'BS HRM',         tuition: 60000, enrollment: 4000, misc: 6000, campus: 'Talisay City Campus' },
  { id: 19, gradeLevel: 'BS Criminology', tuition: 65000, enrollment: 4000, misc: 6000, campus: 'Carcar City Campus' },
]

// ─────────────────────────────────────────────────────────────────────
// SYSTEM USERS & ROLES
// ─────────────────────────────────────────────────────────────────────
export const ROLE_DEFINITIONS = {
  admin: {
    label: 'Administrator',
    description: 'Full access to all modules and settings',
    color: 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-red-300',
    permissions: ['dashboard','enrollments','students','payments','reports','settings'],
  },
  registrar_basic: {
    label: 'Basic Ed Registrar',
    description: 'Manages Basic Education and SHS enrollments',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    permissions: ['dashboard','enrollments','students','reports'],
  },
  registrar_college: {
    label: 'College Registrar',
    description: 'Manages College-level enrollments only',
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    permissions: ['dashboard','enrollments','students','reports'],
  },
  accounting: {
    label: 'Accounting Officer',
    description: 'Manages payments and financial records',
    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    permissions: ['dashboard','payments','reports'],
  },
}

export const SYSTEM_USERS = [
  {
    id: 1,
    name: 'Admin User',
    email: 'admin@cshc.edu.ph',
    password: 'admin123',
    role: 'admin',
    campus: 'all',
    status: 'active',
    lastLogin: '2026-03-05T10:30:00',
  },
  {
    id: 2,
    name: 'Basic Ed Registrar',
    email: 'registrar.basic@cshc.edu.ph',
    password: 'registrar123',
    role: 'registrar_basic',
    campus: 'Talisay City Campus',
    status: 'active',
    lastLogin: '2026-03-05T09:15:00',
  },
  {
    id: 3,
    name: 'College Registrar',
    email: 'registrar.college@cshc.edu.ph',
    password: 'registrar123',
    role: 'registrar_college',
    campus: 'Carcar City Campus',
    status: 'active',
    lastLogin: '2026-03-04T14:20:00',
  },
  {
    id: 4,
    name: 'Accounting Officer',
    email: 'accounting@cshc.edu.ph',
    password: 'accounting123',
    role: 'accounting',
    campus: 'all',
    status: 'active',
    lastLogin: '2026-03-05T08:00:00',
  },
]

// ─────────────────────────────────────────────────────────────────────
// DERIVED HELPERS  (computed from the config above — don't edit these)
// ─────────────────────────────────────────────────────────────────────

/** Returns all college grade strings for a campus key, e.g. 'Talisay'
 *  → ['BS Nursing - 1st Year', 'BS Nursing - 2nd Year', ...]
 */
export function getCampusCollegeGrades(campusKey, campusesOverride) {
  const list = campusesOverride || CAMPUSES
  const campus = list.find(c => c.key === campusKey)
  if (!campus) return []
  return campus.collegePrograms.flatMap(program =>
    COLLEGE_YEAR_LEVELS.map(yr => `${program} - ${yr}`)
  )
}

/** All basic-ed grade options as a flat array */
export function getAllBasicEdGrades(groupsOverride) {
  const groups = groupsOverride || BASIC_ED_GROUPS
  return groups.flatMap(g => g.options)
}

/** Get the active school year string */
export function getCurrentSchoolYear(yearsOverride) {
  const years = yearsOverride || SCHOOL_YEARS
  return (years.find(y => y.isCurrent) || years[0])?.year || '2026-2027'
}

/** Get total fee for a grade level and campus */
export function getTotalFee(gradeLevel, campusName, feesOverride) {
  const fees = feesOverride || FEE_STRUCTURE
  // Match by program name (without year level suffix)
  const programBase = gradeLevel.split(' - ')[0]
  const fee = fees.find(f =>
    (f.gradeLevel === gradeLevel || f.gradeLevel === programBase) &&
    (f.campus === 'all' || f.campus === campusName)
  )
  if (!fee) return 0
  return fee.tuition + fee.enrollment + fee.misc
}