/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║               CSHC CENTRAL CONFIGURATION FILE                   ║
 * ║                                                                  ║
 * ║  SINGLE SOURCE OF TRUTH — every campus, role, feature, and      ║
 * ║  subject is defined here. Pages READ from this config and        ║
 * ║  auto-adapt. Never hardcode a campus name or role in page logic. ║
 * ║                                                                  ║
 * ║  To add a campus       → add to CAMPUSES array                  ║
 * ║  To add a role         → add to ROLE_DEFINITIONS + SYSTEM_USERS ║
 * ║  To add a program      → add to campus.college.programs          ║
 * ║  To add subjects       → add to campus.subjects                  ║
 * ║  To change fees        → update FEE_STRUCTURE (per campus)       ║
 * ║  To add a school year  → add to SCHOOL_YEARS                    ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Runtime edits (via Settings page) are persisted to localStorage
 * and override these defaults automatically.
 */

// ─────────────────────────────────────────────────────────────────────
// SCHOOL IDENTITY
// ─────────────────────────────────────────────────────────────────────
export const SCHOOL_INFO = {
  name:          'Cebu Sacred Heart College',
  abbreviation:  'CSHC',
  address:       'Cebu, Philippines',
  website:       'www.cshc.edu.ph',
  timezone:      'Asia/Manila',
  currency:      'PHP',
  currencySymbol:'₱',
  dateFormat:    'MM/DD/YYYY',
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
    id: 1, year: '2025-2026', status: 'completed', isCurrent: false,
    basicEd: { startDate: '2025-06-01', endDate: '2026-03-31', events: [] },
    college: { startDate: '2025-08-01', endDate: '2026-05-31', events: [] },
  },
  {
    id: 2, year: '2026-2027', status: 'active', isCurrent: true,
    basicEd: { startDate: '2026-06-01', endDate: '2027-03-31', events: [] },
    college: { startDate: '2026-08-01', endDate: '2027-05-31', events: [] },
  },
  {
    id: 3, year: '2027-2028', status: 'upcoming', isCurrent: false,
    basicEd: { startDate: '2027-06-01', endDate: '2028-03-31', events: [] },
    college: { startDate: '2027-08-01', endDate: '2028-05-31', events: [] },
  },
]


// ─────────────────────────────────────────────────────────────────────
// DISCOUNT TYPES
// Default discount types available at all campuses.
// Accounting can add custom types via Settings.
// Applied cascading: each % applied to the remaining amount after previous discounts.
// Applies to TUITION FEE ONLY unless otherwise noted.
// ─────────────────────────────────────────────────────────────────────
export const DEFAULT_DISCOUNTS = [
  {
    id:          'early_bird',
    name:        'Early Bird',
    description: 'For students who enroll within the early enrollment period',
    type:        'percentage',
    defaultRate: 10,
    appliesTo:   'tuition',
    isCustom:    false,
    isActive:    true,
  },
  {
    id:          'top_achiever',
    name:        'Top Achiever / Academic Excellence',
    description: 'For students with outstanding academic performance',
    type:        'percentage',
    defaultRate: 15,
    appliesTo:   'tuition',
    isCustom:    false,
    isActive:    true,
  },
  {
    id:          'sibling',
    name:        'Sibling Discount',
    description: 'For students with a sibling currently enrolled in the school',
    type:        'percentage',
    defaultRate: 10,
    appliesTo:   'tuition',
    isCustom:    false,
    isActive:    true,
  },
  {
    id:          'scholar',
    name:        'Scholar / Full Scholar',
    description: 'For students with a scholarship grant',
    type:        'percentage',
    defaultRate: 100,
    appliesTo:   'tuition',
    isCustom:    false,
    isActive:    true,
  },
  {
    id:          'employee_child',
    name:        'Employee / Faculty Child',
    description: 'For children of current school employees or faculty',
    type:        'percentage',
    defaultRate: 20,
    appliesTo:   'tuition',
    isCustom:    false,
    isActive:    true,
  },
]

// ─────────────────────────────────────────────────────────────────────
// ROLE DEFINITIONS
// Defines every possible role in the system.
// Each campus declares which roles it actually uses in CAMPUSES below.
// ─────────────────────────────────────────────────────────────────────
export const ROLE_DEFINITIONS = {
  admin: {
    label:       'School Owner',
    description: 'High-level overview of all campuses — Dashboard, Reports, and Enrollments (read-only)',
    color:       'bg-primary/10 text-primary dark:bg-primary/20 dark:text-red-300',
    permissions: ['dashboard', 'reports', 'enrollments'],
    campusScoped: false,
  },
  technical_admin: {
    label:       'Super Admin',
    description: 'System-wide access — manages all campus users, school website content, branding, and system configuration',
    color:       'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
    permissions: ['dashboard', 'settings', 'users', 'website_cms'],
    campusScoped: false,
  },
  system_admin: {
    label:       'System Admin',
    description: 'Campus-level IT support — manages user accounts and settings for their assigned campus only',
    color:       'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200',
    permissions: ['dashboard', 'settings', 'users'],
    campusScoped: true,
  },
  principal_basic: {
    label:       'Basic Ed Principal',
    description: 'Assigns teachers, advisers, and special roles in Basic Ed',
    color:       'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    permissions: ['dashboard', 'students', 'subject_load', 'teacher_assignment'],
    campusScoped: true,
  },
  program_head: {
    label:       'Program Head (College)',
    description: 'Assigns college instructors and subject loads for college dept',
    color:       'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
    permissions: ['dashboard', 'students', 'subject_load', 'teacher_assignment'],
    campusScoped: true,
  },
  registrar_basic: {
    label:       'Basic Ed Registrar',
    description: 'Processes forms and manages Basic Ed student records',
    color:       'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    permissions: ['dashboard', 'enrollments', 'students', 'grades', 'form_requests', 'reports'],
    campusScoped: true,
  },
  registrar_college: {
    label:       'College Registrar',
    description: 'Processes forms, manages college student records, and enters final grades',
    color:       'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    permissions: ['dashboard', 'enrollments', 'students', 'grades', 'form_requests', 'reports'],
    campusScoped: true,
  },
  accounting: {
    label:       'Accounting Officer',
    description: 'Records payments, adjusts fees, and generates income reports',
    color:       'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    permissions: ['dashboard', 'payments', 'reports', 'settings'],
    campusScoped: true,
  },
  teacher: {
    label:       'Teacher',
    description: 'Teaches assigned subjects in Basic Ed and/or College. Submits grades, views student records, and checks subject load assignments.',
    color:       'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
    permissions: ['dashboard', 'grades', 'students', 'subject_load'],
    campusScoped: true,
  },
  student: {
    label:       'Student',
    description: 'Views own grades and requests forms from their campus registrar',
    color:       'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
    permissions: ['my_grades', 'form_requests'],
    campusScoped: true,
  },
}

// ─────────────────────────────────────────────────────────────────────
// PERMISSION SYSTEM
// Default page + tab access per role. Super admin can customize per user.
// If user.permissions exists, it overrides these defaults.
// ─────────────────────────────────────────────────────────────────────

/** All available pages in the system */
export const ALL_PAGES = [
  { id: 'dashboard',    label: 'Dashboard',    icon: 'LayoutDashboard' },
  { id: 'enrollments',  label: 'Enrollments',  icon: 'FileText' },
  { id: 'students',     label: 'Students',     icon: 'Users' },
  { id: 'payments',     label: 'Payments',     icon: 'DollarSign' },
  { id: 'reports',      label: 'Reports',      icon: 'BarChart2' },
  { id: 'settings',     label: 'Settings',     icon: 'Settings' },
  { id: 'subject-load', label: 'Subject Load', icon: 'BookOpen' },
  { id: 'grades',       label: 'Grades',       icon: 'ClipboardList' },
]

/** All available settings tabs */
export const ALL_TABS = [
  { id: 'users',      label: 'Users',          forRoles: ['technical_admin', 'system_admin'] },
  { id: 'schoolInfo', label: 'School Info',     forRoles: ['technical_admin'] },
  { id: 'schoolYear', label: 'School Year',     forRoles: ['principal_basic', 'program_head'] },
  { id: 'grades',     label: 'Grade Levels',    forRoles: ['principal_basic', 'program_head'] },
  { id: 'fees',       label: 'Fee Structure',   forRoles: ['accounting'] },
  { id: 'discounts',  label: 'Discounts',       forRoles: ['accounting'] },
  { id: 'receipt',    label: 'Receipt',          forRoles: ['accounting'] },
]

/** Default permissions per role — used when user.permissions is not set */
export const DEFAULT_PERMISSIONS = {
  admin:             { pages: ['dashboard', 'enrollments', 'reports'],                                         tabs: [] },
  technical_admin:   { pages: ['dashboard', 'settings'],                                                       tabs: ['users', 'schoolInfo'] },
  system_admin:      { pages: ['dashboard', 'settings'],                                                       tabs: ['users'] },
  registrar_basic:   { pages: ['dashboard', 'enrollments', 'students'],                                        tabs: [] },
  registrar_college: { pages: ['dashboard', 'enrollments', 'students', 'subject-load'],                        tabs: [] },
  accounting:        { pages: ['dashboard', 'enrollments', 'payments', 'reports', 'settings'],                 tabs: ['fees', 'discounts', 'receipt'] },
  principal_basic:   { pages: ['dashboard', 'enrollments', 'students', 'subject-load', 'settings'],            tabs: ['schoolYear', 'grades'] },
  program_head:      { pages: ['dashboard', 'enrollments', 'students', 'subject-load', 'settings'],            tabs: ['schoolYear', 'grades'] },
  teacher:           { pages: ['dashboard', 'grades', 'students', 'subject-load'],                      tabs: [] },
}

/** Get effective permissions for a user (custom or default) */
export function getUserPermissions(user) {
  if (!user) return { pages: [], tabs: [] }
  if (user.permissions) return user.permissions
  return DEFAULT_PERMISSIONS[user.role] || { pages: ['dashboard'], tabs: [] }
}
// ─────────────────────────────────────────────────────────────────────
export const COLLEGE_YEAR_LEVELS = ['1st Year', '2nd Year', '3rd Year', '4th Year']

export const BASIC_ED_GROUPS = [
  { label: 'Pre-Elementary', options: ['Nursery', 'Kindergarten', 'Preparatory'] },
  { label: 'Elementary',     options: ['Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6'] },
  { label: 'Junior High School', options: ['Grade 7','Grade 8','Grade 9','Grade 10'] },
  { label: 'Senior High School', options: ['Grade 11','Grade 12'] },
]

// ─────────────────────────────────────────────────────────────────────
// CAMPUSES
// This is the heart of the per-campus config.
// Every feature reads from here — if a campus doesn't declare a role
// or feature, it simply won't appear for that campus.
//
// ADDING A NEW CAMPUS: copy one entry, change the values, done.
// The entire system (sidebar, filters, dropdowns, grade selects)
// will automatically reflect the new campus with zero code changes.
// ─────────────────────────────────────────────────────────────────────
export const CAMPUSES = [

  // ── TALISAY CITY CAMPUS ─────────────────────────────────────────
  // ⚠ Workflow not yet confirmed — fields marked with [TBC] are
  //   placeholders based on typical CSHC structure. Update once
  //   Talisay staff confirms their workflow.
  {
    id:   1,
    key:  'Talisay',
    name: 'Talisay City Campus',
    address:       'Lawaan 1, Talisay City, Cebu',
    contactNumber: '032-123-4567',
    email:         'talisay@cshc.edu.ph',
    isActive:      true,
    workflowConfirmed: false,   // ← set true once Talisay confirms their workflow

    // Departments this campus operates
    hasBasicEd:  true,
    hasCollege:  true,          // Talisay has Nursing, HRM, Tourism

    // Roles that exist at this campus
    // Remove a role key if that campus doesn't have that position
    roles: {
      hasPrincipal:   true,     // [TBC] Basic Ed Principal
      hasProgramHead: true,     // [TBC] College Program Head
      hasRegistrarBasic:   true,
      hasRegistrarCollege: true,
      hasAccounting:  true,
    },

    // College department config (only relevant if hasCollege: true)
    college: {
      programs: ['BS Nursing', 'BS HRM', 'BS Tourism'],
      hasSemesters: true,       // [TBC] college uses semester system
      semestersPerYear: 2,
    },

    // Basic Ed grading config [TBC — awaiting Talisay confirmation]
    grading: {
      basicEd: {
        system:      'percentage', // 'percentage' | 'letter' | 'point'
        passingGrade: 75,
        scale: [
          { min: 90, max: 100, descriptor: 'Outstanding',       points: 1.0 },
          { min: 85, max: 89,  descriptor: 'Very Satisfactory', points: 1.5 },
          { min: 80, max: 84,  descriptor: 'Satisfactory',      points: 2.0 },
          { min: 75, max: 79,  descriptor: 'Fairly Satisfactory',points: 2.5 },
          { min: 0,  max: 74,  descriptor: 'Did Not Meet',      points: 3.0 },
        ],
      },
      college: {
        system:       'point',    // [TBC]
        passingGrade: 75,
        scale: [
          { min: 97, max: 100, grade: '1.0', descriptor: 'Excellent' },
          { min: 93, max: 96,  grade: '1.25', descriptor: 'Superior' },
          { min: 89, max: 92,  grade: '1.5',  descriptor: 'Very Good' },
          { min: 85, max: 88,  grade: '1.75', descriptor: 'Good' },
          { min: 81, max: 84,  grade: '2.0',  descriptor: 'Meritorious' },
          { min: 77, max: 80,  grade: '2.25', descriptor: 'Very Satisfactory' },
          { min: 75, max: 76,  grade: '2.5',  descriptor: 'Satisfactory' },
          { min: 0,  max: 74,  grade: '5.0',  descriptor: 'Failed' },
        ],
      },
    },

    // Special roles assigned per school year by the Principal [TBC]
    specialRoles: {
      available: [
        'TLE In-Charge',
        'Clinic In-Charge',
        'Science Lab In-Charge',
        'Prefect of Discipline (POD)',
        'Guidance Designate',
        'Library In-Charge',
      ],
      fixed: ['Prefect of Discipline (POD)', 'Guidance Designate'],
      // ↑ Fixed = person changes only if they resign, not reassigned yearly
    },

    // Form request types available to students of this campus [TBC]
    formRequests: {
      basicEd: [
        'Enrollment Form',
        'Report Card',
        'Certificate of Enrollment',
        'Good Moral Certificate',
        'Transfer Credentials',
        'Form 137',
        'Form 138',
      ],
      college: [
        'Certificate of Enrollment',
        'Certificate of Grades',
        'Transcript of Records',
        'Good Moral Certificate',
        'Honorable Dismissal',
        'Certification',
      ],
    },

    // Payment config
    payment: {
      acceptedMethods: ['Cash', 'Bank Transfer'],
      allowInstallment: true,
      installmentNote: 'Monthly payment schedule set per student by Accounting',
    },

    departments: ['Basic Education', 'Senior High School', 'College'],
    collegePrograms: ['BS Nursing', 'BS HRM', 'BS Tourism'], // kept for backward compat
  },

  // ── CARCAR CITY CAMPUS ──────────────────────────────────────────
  // ✅ Workflow CONFIRMED based on detailed discussion
  {
    id:   2,
    key:  'Carcar',
    name: 'Carcar City Campus',
    address:       'Valladolid, Carcar City, Cebu',
    contactNumber: '032-234-5678',
    email:         'carcar@cshc.edu.ph',
    isActive:      true,
    workflowConfirmed: true,    // ← confirmed

    hasBasicEd:  true,
    hasCollege:  true,          // Only BS Criminology

    roles: {
      hasPrincipal:        true,  // Also teaches in college + basic ed
      hasProgramHead:      true,  // Also teaches in college
      hasRegistrarBasic:   true,  // Also teaches; processes basic ed forms
      hasRegistrarCollege: true,  // Also teaches; processes college forms + enters final grades
      hasAccounting:       true,  // Per-campus; handles all payments + income reports
    },

    college: {
      programs:        ['BS Criminology'],
      hasSemesters:    true,
      semestersPerYear: 2,
    },

    grading: {
      basicEd: {
        system:       'percentage',
        passingGrade: 75,
        scale: [
          { min: 90, max: 100, descriptor: 'Outstanding',        points: 1.0 },
          { min: 85, max: 89,  descriptor: 'Very Satisfactory',  points: 1.5 },
          { min: 80, max: 84,  descriptor: 'Satisfactory',       points: 2.0 },
          { min: 75, max: 79,  descriptor: 'Fairly Satisfactory', points: 2.5 },
          { min: 0,  max: 74,  descriptor: 'Did Not Meet',       points: 3.0 },
        ],
      },
      college: {
        system:       'point',
        passingGrade: 75,
        scale: [
          { min: 97, max: 100, grade: '1.0',  descriptor: 'Excellent' },
          { min: 93, max: 96,  grade: '1.25', descriptor: 'Superior' },
          { min: 89, max: 92,  grade: '1.5',  descriptor: 'Very Good' },
          { min: 85, max: 88,  grade: '1.75', descriptor: 'Good' },
          { min: 81, max: 84,  grade: '2.0',  descriptor: 'Meritorious' },
          { min: 77, max: 80,  grade: '2.25', descriptor: 'Very Satisfactory' },
          { min: 75, max: 76,  grade: '2.5',  descriptor: 'Satisfactory' },
          { min: 0,  max: 74,  grade: '5.0',  descriptor: 'Failed' },
        ],
      },
    },

    specialRoles: {
      available: [
        'TLE In-Charge',
        'Clinic In-Charge',
        'Science Lab In-Charge',
        'Prefect of Discipline (POD)',
        'Guidance Designate',
      ],
      fixed: ['Prefect of Discipline (POD)', 'Guidance Designate'],
    },

    formRequests: {
      basicEd: [
        'Enrollment Form',
        'Report Card',
        'Certificate of Enrollment',
        'Good Moral Certificate',
        'Transfer Credentials',
        'Form 137',
        'Form 138',
      ],
      college: [
        'Certificate of Enrollment',
        'Certificate of Grades',
        'Transcript of Records',
        'Good Moral Certificate',
        'Honorable Dismissal',
        'Certification',
      ],
    },

    payment: {
      acceptedMethods:  ['Cash', 'Bank Transfer'],
      allowInstallment: true,
      installmentNote:  'Monthly payment schedule set per student by Accounting',
    },

    departments: ['Basic Education', 'Senior High School', 'College'],
    collegePrograms: ['BS Criminology'],
  },

  // ── BOHOL CAMPUS ────────────────────────────────────────────────
  // ⚠ Workflow not yet confirmed — fields marked with [TBC] are
  //   placeholders. Bohol has NO college department.
  //   Update once Bohol staff confirms their workflow.
  {
    id:   3,
    key:  'Bohol',
    name: 'Bohol Campus',
    address:       'Tagbilaran City, Bohol',
    contactNumber: '038-345-6789',
    email:         'bohol@cshc.edu.ph',
    isActive:      true,
    workflowConfirmed: false,   // ← set true once Bohol confirms

    hasBasicEd:  true,
    hasCollege:  false,         // Bohol has NO college department

    roles: {
      hasPrincipal:        true,  // [TBC]
      hasProgramHead:      false, // No college = no program head
      hasRegistrarBasic:   true,
      hasRegistrarCollege: false, // No college = no college registrar
      hasAccounting:       true,
    },

    college: null, // No college department

    grading: {
      basicEd: {
        system:       'percentage', // [TBC]
        passingGrade: 75,
        scale: [
          { min: 90, max: 100, descriptor: 'Outstanding',        points: 1.0 },
          { min: 85, max: 89,  descriptor: 'Very Satisfactory',  points: 1.5 },
          { min: 80, max: 84,  descriptor: 'Satisfactory',       points: 2.0 },
          { min: 75, max: 79,  descriptor: 'Fairly Satisfactory', points: 2.5 },
          { min: 0,  max: 74,  descriptor: 'Did Not Meet',       points: 3.0 },
        ],
      },
      college: null, // No college grading
    },

    specialRoles: {
      available: [
        'TLE In-Charge',
        'Clinic In-Charge',
        'Science Lab In-Charge',
        'Prefect of Discipline (POD)',
        'Guidance Designate',
      ],
      fixed: ['Prefect of Discipline (POD)', 'Guidance Designate'],
    },

    formRequests: {
      basicEd: [
        'Enrollment Form',
        'Report Card',
        'Certificate of Enrollment',
        'Good Moral Certificate',
        'Transfer Credentials',
        'Form 137',
        'Form 138',
      ],
      college: [], // No college forms
    },

    payment: {
      acceptedMethods:  ['Cash', 'Bank Transfer'], // [TBC]
      allowInstallment: true,
      installmentNote:  'Monthly payment schedule set per student by Accounting',
    },

    departments: ['Basic Education', 'Junior High School'],
    collegePrograms: [],
  },
]

// ─────────────────────────────────────────────────────────────────────
// GRADE SECTIONS (per campus in future — currently shared)
// ─────────────────────────────────────────────────────────────────────
export const GRADE_SECTIONS = {
  'Grade 7':  ['St. Francis', 'St. John', 'St. Peter'],
  'Grade 8':  ['St. Francis', 'St. John', 'St. Peter', 'St. Paul'],
  'Grade 9':  ['St. Francis', 'St. John', 'St. Peter'],
  'Grade 10': ['St. Francis', 'St. John', 'St. Peter'],
  'Grade 11': ['STEM', 'ABM', 'HUMSS'],
  'Grade 12': ['STEM', 'ABM', 'HUMSS'],
}

// ─────────────────────────────────────────────────────────────────────
// FEE STRUCTURE (per campus, per grade level)
// campus: 'all'  → applies to all campuses
// campus: 'Carcar City Campus' → only that campus
// ─────────────────────────────────────────────────────────────────────
export const FEE_STRUCTURE = [
  // Basic Education — shared across all campuses until campus-specific fees are set
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
  // ── College — unit-based, per campus ──────────────────────────
  // Tuition  = tuitionRatePerUnit × units enrolled  (unit-based, varies per yr+sem)
  // Lab Fee  = labRatePerUnit × lab units enrolled  (unit-based, varies per yr+sem)
  // Enrollment Fee = fixed per semester
  // Misc Fee       = fixed per semester
  //
  // Fields:
  //   tuitionRatePerUnit  — ₱ per unit for lecture/regular subjects
  //   labRatePerUnit      — ₱ per unit for laboratory subjects (0 if no lab)
  //   typicalUnits        — typical total units this semester (for fee preview only)
  //   typicalLabUnits     — typical lab units this semester (for fee preview only)
  //   enrollment          — fixed enrollment fee (charged 1st sem only typically)
  //   misc                — fixed misc fee per semester
  //
  // Actual tuition is computed at enrollment time:
  //   tuition = tuitionRatePerUnit × actualUnits
  //   lab     = labRatePerUnit × actualLabUnits

  // BS Criminology — Carcar City Campus
  { id: 16, program: 'BS Criminology', yearLevel: '1st Year', semester: '1st',
    tuitionRatePerUnit: 900,  labRatePerUnit: 200, typicalUnits: 21, typicalLabUnits: 3,
    enrollment: 2500, misc: 1800, campus: 'Carcar City Campus' },
  { id: 17, program: 'BS Criminology', yearLevel: '1st Year', semester: '2nd',
    tuitionRatePerUnit: 900,  labRatePerUnit: 200, typicalUnits: 21, typicalLabUnits: 3,
    enrollment: 0,    misc: 1800, campus: 'Carcar City Campus' },
  { id: 18, program: 'BS Criminology', yearLevel: '2nd Year', semester: '1st',
    tuitionRatePerUnit: 950,  labRatePerUnit: 220, typicalUnits: 21, typicalLabUnits: 4,
    enrollment: 2500, misc: 1800, campus: 'Carcar City Campus' },
  { id: 19, program: 'BS Criminology', yearLevel: '2nd Year', semester: '2nd',
    tuitionRatePerUnit: 950,  labRatePerUnit: 220, typicalUnits: 21, typicalLabUnits: 4,
    enrollment: 0,    misc: 1800, campus: 'Carcar City Campus' },
  { id: 20, program: 'BS Criminology', yearLevel: '3rd Year', semester: '1st',
    tuitionRatePerUnit: 1000, labRatePerUnit: 250, typicalUnits: 21, typicalLabUnits: 4,
    enrollment: 2500, misc: 2000, campus: 'Carcar City Campus' },
  { id: 21, program: 'BS Criminology', yearLevel: '3rd Year', semester: '2nd',
    tuitionRatePerUnit: 1000, labRatePerUnit: 250, typicalUnits: 21, typicalLabUnits: 4,
    enrollment: 0,    misc: 2000, campus: 'Carcar City Campus' },
  { id: 22, program: 'BS Criminology', yearLevel: '4th Year', semester: '1st',
    tuitionRatePerUnit: 1050, labRatePerUnit: 280, typicalUnits: 18, typicalLabUnits: 3,
    enrollment: 2500, misc: 2000, campus: 'Carcar City Campus' },
  { id: 23, program: 'BS Criminology', yearLevel: '4th Year', semester: '2nd',
    tuitionRatePerUnit: 1050, labRatePerUnit: 280, typicalUnits: 18, typicalLabUnits: 3,
    enrollment: 0,    misc: 2000, campus: 'Carcar City Campus' },

  // BS Nursing — Talisay City Campus [TBC — update rates once confirmed]
  { id: 24, program: 'BS Nursing', yearLevel: '1st Year', semester: '1st',
    tuitionRatePerUnit: 1500, labRatePerUnit: 500, typicalUnits: 24, typicalLabUnits: 6,
    enrollment: 5000, misc: 3500, campus: 'Talisay City Campus' },
  { id: 25, program: 'BS Nursing', yearLevel: '1st Year', semester: '2nd',
    tuitionRatePerUnit: 1500, labRatePerUnit: 500, typicalUnits: 24, typicalLabUnits: 6,
    enrollment: 0,    misc: 3500, campus: 'Talisay City Campus' },
  { id: 26, program: 'BS Nursing', yearLevel: '2nd Year', semester: '1st',
    tuitionRatePerUnit: 1600, labRatePerUnit: 550, typicalUnits: 24, typicalLabUnits: 8,
    enrollment: 5000, misc: 3500, campus: 'Talisay City Campus' },
  { id: 27, program: 'BS Nursing', yearLevel: '2nd Year', semester: '2nd',
    tuitionRatePerUnit: 1600, labRatePerUnit: 550, typicalUnits: 24, typicalLabUnits: 8,
    enrollment: 0,    misc: 3500, campus: 'Talisay City Campus' },
  { id: 28, program: 'BS Nursing', yearLevel: '3rd Year', semester: '1st',
    tuitionRatePerUnit: 1700, labRatePerUnit: 600, typicalUnits: 24, typicalLabUnits: 9,
    enrollment: 5000, misc: 4000, campus: 'Talisay City Campus' },
  { id: 29, program: 'BS Nursing', yearLevel: '3rd Year', semester: '2nd',
    tuitionRatePerUnit: 1700, labRatePerUnit: 600, typicalUnits: 24, typicalLabUnits: 9,
    enrollment: 0,    misc: 4000, campus: 'Talisay City Campus' },
  { id: 30, program: 'BS Nursing', yearLevel: '4th Year', semester: '1st',
    tuitionRatePerUnit: 1800, labRatePerUnit: 650, typicalUnits: 21, typicalLabUnits: 9,
    enrollment: 5000, misc: 4000, campus: 'Talisay City Campus' },
  { id: 31, program: 'BS Nursing', yearLevel: '4th Year', semester: '2nd',
    tuitionRatePerUnit: 1800, labRatePerUnit: 650, typicalUnits: 21, typicalLabUnits: 9,
    enrollment: 0,    misc: 4000, campus: 'Talisay City Campus' },

  // BS Tourism — Talisay City Campus [TBC]
  { id: 32, program: 'BS Tourism', yearLevel: '1st Year', semester: '1st',
    tuitionRatePerUnit: 1000, labRatePerUnit: 200, typicalUnits: 21, typicalLabUnits: 3,
    enrollment: 4000, misc: 2500, campus: 'Talisay City Campus' },
  { id: 33, program: 'BS Tourism', yearLevel: '1st Year', semester: '2nd',
    tuitionRatePerUnit: 1000, labRatePerUnit: 200, typicalUnits: 21, typicalLabUnits: 3,
    enrollment: 0,    misc: 2500, campus: 'Talisay City Campus' },
  { id: 34, program: 'BS Tourism', yearLevel: '2nd Year', semester: '1st',
    tuitionRatePerUnit: 1050, labRatePerUnit: 220, typicalUnits: 21, typicalLabUnits: 3,
    enrollment: 4000, misc: 2500, campus: 'Talisay City Campus' },
  { id: 35, program: 'BS Tourism', yearLevel: '2nd Year', semester: '2nd',
    tuitionRatePerUnit: 1050, labRatePerUnit: 220, typicalUnits: 21, typicalLabUnits: 3,
    enrollment: 0,    misc: 2500, campus: 'Talisay City Campus' },
  { id: 36, program: 'BS Tourism', yearLevel: '3rd Year', semester: '1st',
    tuitionRatePerUnit: 1100, labRatePerUnit: 240, typicalUnits: 21, typicalLabUnits: 3,
    enrollment: 4000, misc: 2800, campus: 'Talisay City Campus' },
  { id: 37, program: 'BS Tourism', yearLevel: '3rd Year', semester: '2nd',
    tuitionRatePerUnit: 1100, labRatePerUnit: 240, typicalUnits: 21, typicalLabUnits: 3,
    enrollment: 0,    misc: 2800, campus: 'Talisay City Campus' },
  { id: 38, program: 'BS Tourism', yearLevel: '4th Year', semester: '1st',
    tuitionRatePerUnit: 1150, labRatePerUnit: 260, typicalUnits: 18, typicalLabUnits: 3,
    enrollment: 4000, misc: 2800, campus: 'Talisay City Campus' },
  { id: 39, program: 'BS Tourism', yearLevel: '4th Year', semester: '2nd',
    tuitionRatePerUnit: 1150, labRatePerUnit: 260, typicalUnits: 18, typicalLabUnits: 3,
    enrollment: 0,    misc: 2800, campus: 'Talisay City Campus' },

  // BS HRM — Talisay City Campus [TBC]
  { id: 40, program: 'BS HRM', yearLevel: '1st Year', semester: '1st',
    tuitionRatePerUnit: 1000, labRatePerUnit: 180, typicalUnits: 21, typicalLabUnits: 3,
    enrollment: 4000, misc: 2500, campus: 'Talisay City Campus' },
  { id: 41, program: 'BS HRM', yearLevel: '1st Year', semester: '2nd',
    tuitionRatePerUnit: 1000, labRatePerUnit: 180, typicalUnits: 21, typicalLabUnits: 3,
    enrollment: 0,    misc: 2500, campus: 'Talisay City Campus' },
  { id: 42, program: 'BS HRM', yearLevel: '2nd Year', semester: '1st',
    tuitionRatePerUnit: 1050, labRatePerUnit: 200, typicalUnits: 21, typicalLabUnits: 3,
    enrollment: 4000, misc: 2500, campus: 'Talisay City Campus' },
  { id: 43, program: 'BS HRM', yearLevel: '2nd Year', semester: '2nd',
    tuitionRatePerUnit: 1050, labRatePerUnit: 200, typicalUnits: 21, typicalLabUnits: 3,
    enrollment: 0,    misc: 2500, campus: 'Talisay City Campus' },
  { id: 44, program: 'BS HRM', yearLevel: '3rd Year', semester: '1st',
    tuitionRatePerUnit: 1100, labRatePerUnit: 220, typicalUnits: 21, typicalLabUnits: 3,
    enrollment: 4000, misc: 2800, campus: 'Talisay City Campus' },
  { id: 45, program: 'BS HRM', yearLevel: '3rd Year', semester: '2nd',
    tuitionRatePerUnit: 1100, labRatePerUnit: 220, typicalUnits: 21, typicalLabUnits: 3,
    enrollment: 0,    misc: 2800, campus: 'Talisay City Campus' },
  { id: 46, program: 'BS HRM', yearLevel: '4th Year', semester: '1st',
    tuitionRatePerUnit: 1150, labRatePerUnit: 240, typicalUnits: 18, typicalLabUnits: 3,
    enrollment: 4000, misc: 2800, campus: 'Talisay City Campus' },
  { id: 47, program: 'BS HRM', yearLevel: '4th Year', semester: '2nd',
    tuitionRatePerUnit: 1150, labRatePerUnit: 240, typicalUnits: 18, typicalLabUnits: 3,
    enrollment: 0,    misc: 2800, campus: 'Talisay City Campus' },
]

// ─────────────────────────────────────────────────────────────────────
// SYSTEM USERS
// ─────────────────────────────────────────────────────────────────────
export const SYSTEM_USERS = [
  {
    id: 1, name: 'School Owner',
    email: 'admin@cshc.edu.ph',
    passwordHash: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
    role: 'admin', campus: 'all', status: 'active', lastLogin: '2026-03-05T10:30:00',
  },
  {
    // Technical Administrator — full system access
    // Email: techadmin@cshc.edu.ph  Password: techadmin123
    id: 17, name: 'Technical Administrator',
    email: 'techadmin@cshc.edu.ph',
    passwordHash: '06b1a9074f0294f16e452d437b6d5ef1072de4080c67a11924cb6256f0a3768b',
    role: 'technical_admin', campus: 'all', status: 'active', lastLogin: null,
  },
  // ── System Admins (campus-locked) ─────────────────────────────
  {
    // System Admin — Carcar campus IT
    // Email: sysadmin.carcar@cshc.edu.ph  Password: sysadmin123
    id: 30, name: 'Carcar System Admin',
    email: 'sysadmin.carcar@cshc.edu.ph',
    passwordHash: 'beca88f0e2c27d8d8c093bd80b2f7f6245466f97b00f3cc8c78ca4049278cc9a',
    role: 'system_admin', campus: 'Carcar City Campus', campusKey: 'Carcar',
    status: 'active', lastLogin: null,
  },
  {
    // System Admin — Talisay campus IT
    // Email: sysadmin.talisay@cshc.edu.ph  Password: sysadmin123
    id: 31, name: 'Talisay System Admin',
    email: 'sysadmin.talisay@cshc.edu.ph',
    passwordHash: 'beca88f0e2c27d8d8c093bd80b2f7f6245466f97b00f3cc8c78ca4049278cc9a',
    role: 'system_admin', campus: 'Talisay City Campus', campusKey: 'Talisay',
    status: 'active', lastLogin: null,
  },
  {
    // System Admin — Bohol campus IT
    // Email: sysadmin.bohol@cshc.edu.ph  Password: sysadmin123
    id: 32, name: 'Bohol System Admin',
    email: 'sysadmin.bohol@cshc.edu.ph',
    passwordHash: 'beca88f0e2c27d8d8c093bd80b2f7f6245466f97b00f3cc8c78ca4049278cc9a',
    role: 'system_admin', campus: 'Bohol Campus', campusKey: 'Bohol',
    status: 'active', lastLogin: null,
  },
  // ── Talisay ─────────────────────────────────────────────────────
  {
    id: 2, name: 'Talisay Basic Ed Registrar',
    email: 'registrar.basic@cshc.edu.ph',
    passwordHash: 'e62d4aac050d801ca012d4bf47071efa53beccbe78bbc73593a0cdfe6da8d8b7',
    role: 'registrar_basic', campus: 'Talisay City Campus', campusKey: 'Talisay',
    status: 'active', lastLogin: '2026-03-05T09:15:00',
  },
  {
    id: 3, name: 'Talisay College Registrar',
    email: 'registrar.college.talisay@cshc.edu.ph',
    passwordHash: 'e62d4aac050d801ca012d4bf47071efa53beccbe78bbc73593a0cdfe6da8d8b7',
    role: 'registrar_college', campus: 'Talisay City Campus', campusKey: 'Talisay',
    status: 'active', lastLogin: '2026-03-04T14:20:00',
  },
  {
    id: 9, name: 'Talisay Accounting Officer',
    email: 'accounting.talisay@cshc.edu.ph',
    passwordHash: 'e33aaf52d546e1633eb40bf31a738dfd24e67d25ae44ada3d793464324b5bc97',
    role: 'accounting', campus: 'Talisay City Campus', campusKey: 'Talisay',
    status: 'active', lastLogin: null,
  },
  {
    id: 12, name: 'Talisay Principal',
    email: 'principal.talisay@cshc.edu.ph',
    passwordHash: '3549f22fb8622a6d216ef2dcd592e04ed1f1e604cef032d7e5c425e8e72a878e',
    role: 'principal_basic', campus: 'Talisay City Campus', campusKey: 'Talisay',
    status: 'active', lastLogin: null,
  },
  {
    id: 13, name: 'Talisay Program Head',
    email: 'programhead.talisay@cshc.edu.ph',
    passwordHash: '3549f22fb8622a6d216ef2dcd592e04ed1f1e604cef032d7e5c425e8e72a878e',
    role: 'program_head', campus: 'Talisay City Campus', campusKey: 'Talisay',
    status: 'active', lastLogin: null,
  },
  // ── Carcar ──────────────────────────────────────────────────────
  {
    id: 7, name: 'Carcar Basic Ed Registrar',
    email: 'registrar.basic.carcar@cshc.edu.ph',
    passwordHash: 'e62d4aac050d801ca012d4bf47071efa53beccbe78bbc73593a0cdfe6da8d8b7',
    role: 'registrar_basic', campus: 'Carcar City Campus', campusKey: 'Carcar',
    status: 'active', lastLogin: '2026-03-04T08:30:00',
  },
  {
    id: 6, name: 'Carcar College Registrar',
    email: 'registrar.college@cshc.edu.ph',
    passwordHash: 'e62d4aac050d801ca012d4bf47071efa53beccbe78bbc73593a0cdfe6da8d8b7',
    role: 'registrar_college', campus: 'Carcar City Campus', campusKey: 'Carcar',
    status: 'active', lastLogin: '2026-03-04T14:20:00',
  },
  {
    id: 10, name: 'Carcar Accounting Officer',
    email: 'accounting.carcar@cshc.edu.ph',
    passwordHash: 'e33aaf52d546e1633eb40bf31a738dfd24e67d25ae44ada3d793464324b5bc97',
    role: 'accounting', campus: 'Carcar City Campus', campusKey: 'Carcar',
    status: 'active', lastLogin: null,
  },
  {
    id: 14, name: 'Carcar Principal',
    email: 'principal.carcar@cshc.edu.ph',
    passwordHash: '3549f22fb8622a6d216ef2dcd592e04ed1f1e604cef032d7e5c425e8e72a878e',
    role: 'principal_basic', campus: 'Carcar City Campus', campusKey: 'Carcar',
    status: 'active', lastLogin: null,
  },
  {
    id: 15, name: 'Carcar Program Head',
    email: 'programhead.carcar@cshc.edu.ph',
    passwordHash: '3549f22fb8622a6d216ef2dcd592e04ed1f1e604cef032d7e5c425e8e72a878e',
    role: 'program_head', campus: 'Carcar City Campus', campusKey: 'Carcar',
    status: 'active', lastLogin: null,
  },
  // ── Bohol ───────────────────────────────────────────────────────
  {
    id: 8, name: 'Bohol Basic Ed Registrar',
    email: 'registrar.basic.bohol@cshc.edu.ph',
    passwordHash: 'e62d4aac050d801ca012d4bf47071efa53beccbe78bbc73593a0cdfe6da8d8b7',
    role: 'registrar_basic', campus: 'Bohol Campus', campusKey: 'Bohol',
    status: 'active', lastLogin: '2026-03-03T07:45:00',
  },
  {
    id: 11, name: 'Bohol Accounting Officer',
    email: 'accounting.bohol@cshc.edu.ph',
    passwordHash: 'e33aaf52d546e1633eb40bf31a738dfd24e67d25ae44ada3d793464324b5bc97',
    role: 'accounting', campus: 'Bohol Campus', campusKey: 'Bohol',
    status: 'active', lastLogin: null,
  },
  {
    id: 16, name: 'Bohol Principal',
    email: 'principal.bohol@cshc.edu.ph',
    passwordHash: '3549f22fb8622a6d216ef2dcd592e04ed1f1e604cef032d7e5c425e8e72a878e',
    role: 'principal_basic', campus: 'Bohol Campus', campusKey: 'Bohol',
    status: 'active', lastLogin: null,
  },
  // ── Bohol Principal ─────────────────────────────────────────────
  {
    id: 18, name: 'Bohol Principal',
    email: 'principal.bohol@cshc.edu.ph',
    passwordHash: '3549f22fb8622a6d216ef2dcd592e04ed1f1e604cef032d7e5c425e8e72a878e',
    role: 'principal_basic', campus: 'Bohol Campus', campusKey: 'Bohol',
    status: 'active', lastLogin: null,
  },
  // ── Teacher accounts (all campuses) ────────────────────────────
  // Password for all: teacher123
  // SHA-256 of 'teacher123': cde383eee8ee7a4400adf7a15f716f179a2eb97646b37e089eb8d6d04e663416
  // Carcar teachers
  {
    id: 19, name: 'Maria Santos',
    email: 'teacher.santos@cshc.edu.ph',
    passwordHash: 'cde383eee8ee7a4400adf7a15f716f179a2eb97646b37e089eb8d6d04e663416',
    role: 'teacher', campus: 'Carcar City Campus', campusKey: 'Carcar',
    status: 'active', lastLogin: null,
  },
  {
    id: 20, name: 'Juan dela Cruz',
    email: 'teacher.delacruz@cshc.edu.ph',
    passwordHash: 'cde383eee8ee7a4400adf7a15f716f179a2eb97646b37e089eb8d6d04e663416',
    role: 'teacher', campus: 'Carcar City Campus', campusKey: 'Carcar',
    status: 'active', lastLogin: null,
  },
  {
    id: 21, name: 'Ana Reyes',
    email: 'teacher.reyes@cshc.edu.ph',
    passwordHash: 'cde383eee8ee7a4400adf7a15f716f179a2eb97646b37e089eb8d6d04e663416',
    role: 'teacher', campus: 'Carcar City Campus', campusKey: 'Carcar',
    status: 'active', lastLogin: null,
  },
  {
    id: 22, name: 'Pedro Bautista',
    email: 'teacher.bautista@cshc.edu.ph',
    passwordHash: 'cde383eee8ee7a4400adf7a15f716f179a2eb97646b37e089eb8d6d04e663416',
    role: 'teacher', campus: 'Carcar City Campus', campusKey: 'Carcar',
    status: 'active', lastLogin: null,
  },
  // Talisay teachers
  {
    id: 40, name: 'Rosa Fernandez',
    email: 'teacher.fernandez@cshc.edu.ph',
    passwordHash: 'cde383eee8ee7a4400adf7a15f716f179a2eb97646b37e089eb8d6d04e663416',
    role: 'teacher', campus: 'Talisay City Campus', campusKey: 'Talisay',
    status: 'active', lastLogin: null,
  },
  {
    id: 41, name: 'Carlos Mendoza',
    email: 'teacher.mendoza@cshc.edu.ph',
    passwordHash: 'cde383eee8ee7a4400adf7a15f716f179a2eb97646b37e089eb8d6d04e663416',
    role: 'teacher', campus: 'Talisay City Campus', campusKey: 'Talisay',
    status: 'active', lastLogin: null,
  },
  // Bohol teachers
  {
    id: 42, name: 'Elena Villanueva',
    email: 'teacher.villanueva@cshc.edu.ph',
    passwordHash: 'cde383eee8ee7a4400adf7a15f716f179a2eb97646b37e089eb8d6d04e663416',
    role: 'teacher', campus: 'Bohol Campus', campusKey: 'Bohol',
    status: 'active', lastLogin: null,
  },
  {
    id: 43, name: 'Ramon Espinosa',
    email: 'teacher.espinosa@cshc.edu.ph',
    passwordHash: 'cde383eee8ee7a4400adf7a15f716f179a2eb97646b37e089eb8d6d04e663416',
    role: 'teacher', campus: 'Bohol Campus', campusKey: 'Bohol',
    status: 'active', lastLogin: null,
  },
]

// ─────────────────────────────────────────────────────────────────────
// DERIVED HELPERS
// These functions read from CAMPUSES so all logic stays in one place.
// ─────────────────────────────────────────────────────────────────────

/** Get campus object by key */
export function getCampusByKey(key, override) {
  return (override || CAMPUSES).find(c => c.key === key) ?? null
}

/** Get campus object by full name */
export function getCampusByName(name, override) {
  return (override || CAMPUSES).find(c => c.name === name) ?? null
}

/** Does a campus have a specific role? */
export function campusHasRole(campusKey, roleKey, override) {
  const campus = getCampusByKey(campusKey, override)
  if (!campus) return false
  const roleMap = {
    principal_basic:     campus.roles?.hasPrincipal,
    program_head:        campus.roles?.hasProgramHead,
    registrar_basic:     campus.roles?.hasRegistrarBasic,
    registrar_college:   campus.roles?.hasRegistrarCollege,
    accounting:          campus.roles?.hasAccounting,
    teacher_basic:       campus.hasBasicEd,
    instructor_college:  campus.hasCollege,
    teacher:             true,  // teachers can teach both Basic Ed and College
  }
  return roleMap[roleKey] ?? false
}

/** Get all college grades (program + year) for a campus */
export function getCampusCollegeGrades(campusKey, override) {
  const campus = getCampusByKey(campusKey, override)
  if (!campus?.hasCollege) return []
  return (campus.college?.programs ?? campus.collegePrograms ?? []).flatMap(prog =>
    COLLEGE_YEAR_LEVELS.map(yr => `${prog} - ${yr}`)
  )
}

/** Get all basic ed grade levels (flat list) */
export function getAllBasicEdGrades(groupsOverride) {
  return (groupsOverride || BASIC_ED_GROUPS).flatMap(g => g.options)
}

/** Get current school year string */
export function getCurrentSchoolYear(yearsOverride) {
  const years = yearsOverride || SCHOOL_YEARS
  return (years.find(y => y.isCurrent) || years[0])?.year || '2026-2027'
}

/** Get total fee for a grade level at a campus */
export function getTotalFee(gradeLevel, campusName, feesOverride) {
  const fees = feesOverride || FEE_STRUCTURE
  const programBase = gradeLevel.split(' - ')[0]
  const fee = fees.find(f =>
    (f.gradeLevel === gradeLevel || f.gradeLevel === programBase) &&
    (f.campus === 'all' || f.campus === campusName)
  )
  if (!fee) return 0
  return fee.tuition + fee.enrollment + fee.misc + (fee.lab || 0) + (fee.books || 0) + (fee.other || 0)
}

/**
 * Get fee breakdown for a grade level — use this for discount computation.
 * Returns individual fields so discounts can be applied to tuition only,
 * leaving enrollment, misc, lab, books, and other fees untouched.
 */
export function getFeeBreakdown(gradeLevel, campusName, feesOverride) {
  const fees = feesOverride || FEE_STRUCTURE
  const programBase = gradeLevel.split(' - ')[0]
  const fee = fees.find(f =>
    (f.gradeLevel === gradeLevel || f.gradeLevel === programBase) &&
    (f.campus === 'all' || f.campus === campusName)
  )
  if (!fee) return { tuition: 0, enrollment: 0, misc: 0, lab: 0, books: 0, other: 0, total: 0 }
  const tuition    = fee.tuition    || 0
  const enrollment = fee.enrollment || 0
  const misc       = fee.misc       || 0
  const lab        = fee.lab        || 0
  const books      = fee.books      || 0
  const other      = fee.other      || 0
  return { tuition, enrollment, misc, lab, books, other, total: tuition + enrollment + misc + lab + books + other }
}

/**
 * Compute final student bill after applying discounts.
 * Discounts apply to TUITION ONLY — enrollment, misc, lab, books, other are fixed.
 *
 * @param {object} feeBreakdown  — from getFeeBreakdown()
 * @param {Array}  discounts     — active discounts [{ name, rate, type }]
 * @returns {{ tuitionAfterDiscount, totalDiscount, grandTotal, breakdown }}
 */
export function computeStudentBill(feeBreakdown, discounts = []) {
  const discountResult = applyDiscountsCascading(feeBreakdown.tuition, discounts)
  const fixedFees = feeBreakdown.enrollment + feeBreakdown.misc +
                    (feeBreakdown.lab || 0) + (feeBreakdown.books || 0) + (feeBreakdown.other || 0)
  return {
    originalTuition:     feeBreakdown.tuition,
    tuitionAfterDiscount: discountResult.finalAmount,
    totalDiscount:        discountResult.totalDeducted,
    enrollment:           feeBreakdown.enrollment,
    misc:                 feeBreakdown.misc,
    lab:                  feeBreakdown.lab || 0,
    books:                feeBreakdown.books || 0,
    other:                feeBreakdown.other || 0,
    grandTotal:           discountResult.finalAmount + fixedFees,
    discountBreakdown:    discountResult.breakdown,
  }
}


/**
 * Compute college semester fee.
 *
 * Works for ALL student types:
 *   - Regular:    actualUnits = typicalUnits (full load)
 *   - Transferee underload: actualUnits < typicalUnits  → lower tuition
 *   - Transferee overload:  actualUnits > typicalUnits  → higher tuition
 *   Rate per unit is the SAME regardless of load — only the unit count differs.
 *
 * @param {object} feeEntry      - FEE_STRUCTURE entry for this program+year+semester
 * @param {number} actualUnits   - Actual lecture units enrolled (null = use typicalUnits)
 * @param {number} actualLabUnits- Actual lab units enrolled    (null = use typicalLabUnits)
 * @param {string} studentType   - 'regular' | 'transferee' | 'returnee' (informational only)
 * @returns {{ tuition, lab, enrollment, misc, total, units, labUnits, isUnderload, isOverload }}
 */
export function computeCollegeFee(feeEntry, actualUnits, actualLabUnits, studentType = 'regular') {
  if (!feeEntry) return {
    tuition: 0, lab: 0, enrollment: 0, misc: 0, total: 0,
    units: 0, labUnits: 0, isUnderload: false, isOverload: false,
  }
  const units      = actualUnits    ?? feeEntry.typicalUnits    ?? 0
  const labUnits   = actualLabUnits ?? feeEntry.typicalLabUnits ?? 0
  const typical    = feeEntry.typicalUnits    ?? 0
  const typicalLab = feeEntry.typicalLabUnits ?? 0

  const tuition = (feeEntry.tuitionRatePerUnit ?? 0) * units
  const lab     = (feeEntry.labRatePerUnit     ?? 0) * labUnits
  const enroll  = feeEntry.enrollment ?? 0
  const misc    = feeEntry.misc       ?? 0

  // semTotal = tuition + lab + misc only
  // enrollment fee is a separate one-time charge, NOT included in sem total
  const semTotal = tuition + lab + misc

  return {
    tuition,
    lab,
    enrollment:  enroll,   // shown separately — not in semTotal
    misc,
    semTotal,              // what shows as "Sem Total" in the fee table
    total:       semTotal, // alias for backward compat
    grandTotal:  semTotal + enroll, // full amount due this semester including enrollment fee
    units,
    labUnits,
    isUnderload: units < typical,
    isOverload:  units > typical,
    typical,
    typicalLab,
    studentType,
  }
}

/** Preview using typical units — used in fee structure display */
export function previewCollegeFee(feeEntry) {
  return computeCollegeFee(feeEntry, feeEntry?.typicalUnits, feeEntry?.typicalLabUnits)
}

/**
 * Determine load status label for display.
 * @returns 'Regular' | 'Underload' | 'Overload'
 */
export function getLoadStatus(actualUnits, typicalUnits) {
  if (actualUnits == null || typicalUnits == null) return 'Regular'
  if (actualUnits < typicalUnits) return 'Underload'
  if (actualUnits > typicalUnits) return 'Overload'
  return 'Regular'
}

/** Calculate cascading discounts — supports both % and fixed ₱ types */
export function applyDiscountsCascading(tuitionFee, discounts = []) {
  let remaining = tuitionFee
  const breakdown = []
  for (const d of discounts) {
    if (!d.rate || d.rate <= 0) continue
    const isFixed   = d.type === 'fixed'
    const deduction = isFixed ? Math.min(d.rate, remaining) : remaining * (d.rate / 100)
    breakdown.push({ name: d.name, type: d.type || 'percentage', rate: d.rate, deduction, remaining: remaining - deduction })
    remaining -= deduction
  }
  return { original: tuitionFee, totalDeducted: tuitionFee - remaining, finalAmount: Math.max(0, remaining), breakdown }
}

/** Get college semester fee entry */
export function getCollegeSemFee(program, yearLevel, semester, campusName, feesOverride) {
  const fees = feesOverride || FEE_STRUCTURE
  return fees.find(f =>
    f.program === program &&
    f.yearLevel === yearLevel &&
    f.semester === semester &&
    f.campus === campusName
  ) ?? null
}

/** Get fee entry for a grade level at a campus */
export function getFeeEntry(gradeLevel, campusName, feesOverride) {
  const fees = feesOverride || FEE_STRUCTURE
  const programBase = gradeLevel.split(' - ')[0]
  return fees.find(f =>
    (f.gradeLevel === gradeLevel || f.gradeLevel === programBase) &&
    (f.campus === 'all' || f.campus === campusName)
  ) ?? null
}

/** Get grading scale for a campus + department */
export function getGradingScale(campusKey, department = 'basicEd', override) {
  const campus = getCampusByKey(campusKey, override)
  return campus?.grading?.[department]?.scale ?? []
}

/** Get passing grade for a campus + department */
export function getPassingGrade(campusKey, department = 'basicEd', override) {
  const campus = getCampusByKey(campusKey, override)
  return campus?.grading?.[department]?.passingGrade ?? 75
}

/** Get available form request types for a campus + department */
export function getFormRequestTypes(campusKey, department = 'basicEd', override) {
  const campus = getCampusByKey(campusKey, override)
  return campus?.formRequests?.[department] ?? []
}

/** Get special roles available at a campus */
export function getSpecialRoles(campusKey, override) {
  const campus = getCampusByKey(campusKey, override)
  return {
    available: campus?.specialRoles?.available ?? [],
    fixed:     campus?.specialRoles?.fixed ?? [],
  }
}

/** Get accepted payment methods at a campus */
export function getPaymentMethods(campusKey, override) {
  const campus = getCampusByKey(campusKey, override)
  return campus?.payment?.acceptedMethods ?? ['Cash']
}

/** Check if a campus workflow has been confirmed */
export function isWorkflowConfirmed(campusKey, override) {
  const campus = getCampusByKey(campusKey, override)
  return campus?.workflowConfirmed ?? false
}

/** Get campus programs map (used by GradeLevelSelect) */
export function buildCampusProgramsMap(campusesOverride) {
  const campuses = campusesOverride || CAMPUSES
  return Object.fromEntries(
    campuses.map(c => [
      c.key,
      (c.college?.programs ?? c.collegePrograms ?? [])
        .flatMap(prog => COLLEGE_YEAR_LEVELS.map(yr => `${prog} - ${yr}`))
    ])
  )
}
// ─────────────────────────────────────────────────────────────────────
// DEFAULT SUBJECTS
// Starting curriculum for each level. Principal / Program Head can
// add or remove subjects from the Subject Load page at any time.
// Changes are saved to localStorage under cshc_subject_loads and
// override these defaults automatically — same pattern as fee structure.
// ─────────────────────────────────────────────────────────────────────

export const DEFAULT_BASIC_ED_SUBJECTS = {
  'Nursery':       ['Language/Reading Readiness', 'Math Readiness', 'Values Education', 'Music, Arts, PE & Health (MAPEH)'],
  'Kindergarten':  ['Mother Tongue', 'Language/Reading Readiness', 'Math Readiness', 'Values Education', 'Music, Arts, PE & Health (MAPEH)'],
  'Preparatory':   ['Mother Tongue', 'Language/Reading Readiness', 'Math Readiness', 'Values Education', 'Music, Arts, PE & Health (MAPEH)'],
  'Grade 1':       ['Filipino', 'English', 'Mathematics', 'Araling Panlipunan', 'Science', 'Mother Tongue', 'MAPEH', 'Edukasyon sa Pagpapakatao (EsP)', 'Computer'],
  'Grade 2':       ['Filipino', 'English', 'Mathematics', 'Araling Panlipunan', 'Science', 'Mother Tongue', 'MAPEH', 'EsP', 'Computer'],
  'Grade 3':       ['Filipino', 'English', 'Mathematics', 'Araling Panlipunan', 'Science', 'Mother Tongue', 'MAPEH', 'EsP', 'Computer'],
  'Grade 4':       ['Filipino', 'English', 'Mathematics', 'Araling Panlipunan', 'Science', 'MAPEH', 'EsP', 'Computer'],
  'Grade 5':       ['Filipino', 'English', 'Mathematics', 'Araling Panlipunan', 'Science', 'MAPEH', 'EsP', 'Computer'],
  'Grade 6':       ['Filipino', 'English', 'Mathematics', 'Araling Panlipunan', 'Science', 'MAPEH', 'EsP', 'Computer'],
  'Grade 7':       ['Filipino', 'English', 'Mathematics', 'Araling Panlipunan', 'Science', 'MAPEH', 'EsP', 'TLE/EPP', 'Computer'],
  'Grade 8':       ['Filipino', 'English', 'Mathematics', 'Araling Panlipunan', 'Science', 'MAPEH', 'EsP', 'TLE/EPP', 'Computer'],
  'Grade 9':       ['Filipino', 'English', 'Mathematics', 'Araling Panlipunan', 'Science', 'MAPEH', 'EsP', 'TLE/EPP', 'Computer'],
  'Grade 10':      ['Filipino', 'English', 'Mathematics', 'Araling Panlipunan', 'Science', 'MAPEH', 'EsP', 'TLE/EPP', 'Computer'],
  'Grade 11':      ['Core English', 'Core Mathematics', 'Contemporary Philippine Arts', 'Physical Education', 'Personal Development', 'Earth and Life Science', 'Understanding Culture, Society and Politics', 'Empowerment Technology', 'Oral Communication', 'Reading and Writing', 'Komunikasyon at Pananaliksik'],
  'Grade 12':      ['Core English', 'Core Mathematics', 'Physical Education', 'Inquiries, Investigations and Immersion', 'Philippine Politics and Governance', 'Media and Information Literacy', 'Research/Capstone Project'],
}

export const DEFAULT_COLLEGE_SUBJECTS = {
  'BS Criminology': {
    '1st Year': {
      '1st': [
        'Introduction to Criminology',
        'Philippine Criminal Justice System',
        'Criminal Law 1',
        'Law Enforcement Administration',
        'Sociology of Crimes and Ethics',
        'Physical Fitness and Self-Defense 1',
        'English Communication Arts',
        'Mathematics in the Modern World',
      ],
      '2nd': [
        'Criminal Law 2',
        'Crime Detection and Investigation 1',
        'Criminalistics 1 (Dactyloscopy)',
        'Human Behavior and Crisis Management',
        'Physical Fitness and Self-Defense 2',
        'Purposive Communication',
        'Readings in Philippine History',
      ],
    },
    '2nd Year': {
      '1st': [
        'Crime Detection and Investigation 2',
        'Criminalistics 2 (questioned documents)',
        'Forensic Photography',
        'Juvenile Delinquency and Juvenile Justice',
        'Police Organization and Administration',
        'Traffic Management and Accident Investigation',
        'Science, Technology and Society',
        'Art Appreciation',
      ],
      '2nd': [
        'Criminalistics 3 (Firearms & Explosives)',
        'Correctional Administration',
        'Ethics and Human Rights',
        'Public Safety Act and Other Related Laws',
        'Intelligence and Counter-Intelligence',
        'The Contemporary World',
        'Gender and Society',
      ],
    },
    '3rd Year': {
      '1st': [
        'Criminalistics 4 (Polygraphy)',
        'Cyber Crime Investigation',
        'Drug Education and Vice Control',
        'Private Security Administration',
        'Practical Shooting',
        'Rizal and Other Heroes',
        'Research Methods in Criminology',
      ],
      '2nd': [
        'White Collar and Economic Crimes',
        'Penology and Victimology',
        'Special Crimes Investigation',
        'Fire Technology and Arson Investigation',
        'Legal Medicine, Psychiatry and Criminalistics',
        'Research in Criminology (Thesis 1)',
      ],
    },
    '4th Year': {
      '1st': [
        'Seminar in Criminology',
        'Research in Criminology (Thesis 2)',
        'On-The-Job Training / Practicum 1',
        'Criminal Procedure and Court Testimonies',
        'Review for Board Examination 1',
      ],
      '2nd': [
        'On-The-Job Training / Practicum 2',
        'Review for Board Examination 2',
        'Seminar on Current Issues in Criminology',
      ],
    },
  },
  'BS Nursing': {
    '1st Year': {
      '1st': ['Anatomy and Physiology', 'Biochemistry', 'Nutrition and Diet Therapy', 'Fundamentals of Nursing', 'English for Academic Purposes', 'Mathematics in the Modern World'],
      '2nd': ['Microbiology and Parasitology', 'Pharmacology 1', 'Health Assessment', 'Care of Mother and Child 1', 'Purposive Communication'],
    },
    '2nd Year': {
      '1st': ['Pharmacology 2', 'Medical-Surgical Nursing 1', 'Care of Mother and Child 2', 'Psychiatric Nursing', 'Community Health Nursing 1'],
      '2nd': ['Medical-Surgical Nursing 2', 'Pediatric Nursing', 'Communicable Disease Nursing', 'Community Health Nursing 2', 'Research in Nursing 1'],
    },
    '3rd Year': {
      '1st': ['Medical-Surgical Nursing 3', 'Operating Room Nursing', 'Gerontological Nursing', 'Nursing Informatics', 'Research in Nursing 2'],
      '2nd': ['Related Learning Experience (RLE) 1', 'Leadership and Management in Nursing', 'Legal and Ethical Aspects of Nursing'],
    },
    '4th Year': {
      '1st': ['Related Learning Experience (RLE) 2', 'Community Health Nursing 3', 'Review for Nursing Board 1'],
      '2nd': ['Related Learning Experience (RLE) 3', 'Review for Nursing Board 2', 'Capstone Project'],
    },
  },
  'BS HRM': {
    '1st Year': {
      '1st': ['Introduction to Hospitality Industry', 'Food and Beverage Service 1', 'Culinary Arts 1', 'Hotel Operations 1', 'English Communication', 'Mathematics in the Modern World'],
      '2nd': ['Food and Beverage Service 2', 'Culinary Arts 2', 'Front Office Operations', 'Housekeeping Operations', 'Purposive Communication'],
    },
    '2nd Year': {
      '1st': ['Food and Beverage Service 3', 'Culinary Arts 3', 'Events Management 1', 'Tourism and Travel Management', 'Accounting for HRM'],
      '2nd': ['Bar and Beverage Management', 'Events Management 2', 'Catering and Banquet Operations', 'Human Resource Management', 'Research Methods'],
    },
    '3rd Year': {
      '1st': ['Strategic Hospitality Management', 'Revenue Management', 'Customer Relations Management', 'Safety and Sanitation', 'Research in HRM 1'],
      '2nd': ['Practicum 1 (Hotel/Restaurant)', 'Quality Service Management', 'Entrepreneurship in HRM', 'Research in HRM 2'],
    },
    '4th Year': {
      '1st': ['Practicum 2', 'Seminar in HRM', 'Capstone Project 1'],
      '2nd': ['Practicum 3', 'Capstone Project 2', 'Review and Preparation for Industry'],
    },
  },
  'BS Tourism': {
    '1st Year': {
      '1st': ['Introduction to Tourism', 'Tourism Geography', 'Tour Guiding', 'Travel Agency Operations 1', 'English for Tourism', 'Mathematics in the Modern World'],
      '2nd': ['Travel Agency Operations 2', 'Tourism Marketing', 'Hotel and Restaurant Operations', 'Cultural Heritage Tourism', 'Purposive Communication'],
    },
    '2nd Year': {
      '1st': ['Ecotourism', 'Events and Meetings Management', 'Airline Ticketing and Reservation', 'Tourism Economics', 'Research Methods'],
      '2nd': ['Adventure and Sports Tourism', 'Tourism Product Development', 'Tourism Policy and Planning', 'Accounting for Tourism', 'Research in Tourism 1'],
    },
    '3rd Year': {
      '1st': ['Medical and Wellness Tourism', 'Tourism Law and Ethics', 'Risk Management in Tourism', 'Practicum Preparation', 'Research in Tourism 2'],
      '2nd': ['Practicum 1', 'Sustainable Tourism', 'Entrepreneurship in Tourism'],
    },
    '4th Year': {
      '1st': ['Practicum 2', 'Seminar in Tourism', 'Capstone Project 1'],
      '2nd': ['Practicum 3', 'Capstone Project 2', 'Industry Immersion'],
    },
  },
}