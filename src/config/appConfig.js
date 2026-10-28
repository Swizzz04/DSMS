/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║               ALMIRENE DX CENTRAL CONFIGURATION FILE                   ║
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
  name:          'Sample Academy',
  abbreviation:  '',
  address:       'City, Province, Philippines',
  website:       '',
  timezone:      'Asia/Manila',
  currency:      'PHP',
  currencySymbol:'₱',
  dateFormat:    'MM/DD/YYYY',
  academicStart: 'August',
  academicEnd:   'May',
  primaryColor:  '#F4FAFC',
  secondaryColor:'#212121',
}

// Generic defaults for the School Info / Website Content settings tab —
// used by its "Reset to Default" action. Mirrors public/site_data.js's
// DEFAULTS (the public site's own fallback content) so both sides agree on
// what "default" means — they can't literally share one JS module since
// public/ is a separate plain-script site with no bundler, but keeping the
// two in sync here is a deliberate, documented duplication, not drift.
export const DEFAULT_WEBSITE_CONTENT = {
  schoolName:  'Sample Academy',
  motto:       'A great place to learn and grow.',
  email:       'info@example.edu.ph',
  phone:       '(032) XXX-XXXX',
  website:     '',
  logoUrl:     '',
  schoolYear:  '2025–2026',
  // Platform default is 'ALMIRENE' — a school client can override this in
  // Settings → School Info → General Information once they're onboarded.
  // Used as the prefix on enrollment reference numbers (e.g. ALMIRENE-2026-W1000)
  // by both public/enrollmentBridge.website.js and src/utils/enrollmentBridge.js —
  // keep those two in sync with this default the same way DEFAULT_WEBSITE_CONTENT
  // itself is deliberately mirrored in public/site_data.js's DEFAULTS.
  referenceNumberPrefix: 'ALMIRENE',
  primaryColor:   '#F4FAFC',
  secondaryColor: '#212121',
  portalLabel:  'School Management Portal',
  supportLabel: 'Contact IT Support',
  mission: 'To enhance virtue, develop competence, promote excellence, and inspire service in all academic levels of the institution.',
  vision:  'We envision producing graduates who are values-driven, critical thinkers, service-oriented, and globally competitive.',
  goals: [
    'Consistent pursuit of academic excellence.',
    'Faithful adherence to core values and virtue.',
    'Learning environment conducive to holistic formation.',
    'Continuous faculty development.',
  ],
  coreValues: ['Integrity', 'Excellence', 'Service'],
  programs: [
    { id: 1, title: 'Pre-Elementary',      age: 'Ages 3-5',   description: 'Nurturing young minds through play-based learning.', features: ['Nursery','Kindergarten','Preparatory'], highlight: false },
    { id: 2, title: 'Elementary',          age: 'Grades 1-6', description: 'Building strong foundations in academics and character.', features: ['Core subjects mastery','Values education'], highlight: false },
    { id: 3, title: 'Junior High School',  age: 'Grades 7-10',description: 'Preparing students through the K-12 curriculum.', features: ['Enhanced curriculum','Career guidance'], highlight: false },
    { id: 4, title: 'Senior High School',  age: 'Grades 11-12',description: 'Specialized tracks for college and career readiness.', features: ['General Academic Strand'], highlight: false },
  ],
  requirements: [
    { id: 1, icon: '📄', title: 'Birth Certificate',      desc: 'Original and photocopy (PSA issued)' },
    { id: 2, icon: '📋', title: 'Report Card',             desc: 'Form 138 (previous school records)'  },
    { id: 3, icon: '🎓', title: 'Good Moral Certificate', desc: 'From previous school attended'        },
    { id: 4, icon: '🪪', title: '2x2 ID Photos',          desc: 'Recent photos (white background)'     },
  ],
  steps: [
    { id: 1, title: 'Submit Online Form',  desc: 'Fill out the online enrollment form or visit any campus registrar.' },
    { id: 2, title: 'Submit Requirements', desc: 'Provide all necessary documents to the registrar.' },
    { id: 3, title: 'Pay Down Payment',    desc: 'Proceed to Accounting for assessment and initial payment.' },
    { id: 4, title: 'Registrar Approval',  desc: 'Receive your class schedule once enrollment is approved.' },
  ],
  faq: [
    { id: 1, q: 'What are the tuition fees?', a: 'Tuition fees vary by campus and program. Please contact the Registrar\'s Office for detailed fee schedules.' },
    { id: 2, q: 'Do you offer scholarships?', a: 'Yes, we offer scholarships based on academic performance and financial need. Inquire at the Admissions Office for eligibility.' },
    { id: 3, q: 'Can I enroll online?', a: 'Yes! Submit your form online, then visit any campus to complete requirements and payment.' },
  ],
}

// ─────────────────────────────────────────────────────────────────────
// SCHOOL YEARS
// ─────────────────────────────────────────────────────────────────────
export const SCHOOL_YEARS = [
  {
    id: 1, year: '2025-2026', status: 'completed', isCurrent: false,
    gradingPeriodType: 'quarterly',  // 'quarterly' or 'trimester'
    gradingFramework:  'do8_2015',   // 'do8_2015' (WW/PT/QA) or 'do015_2026' (WW/PT/EX) — see Settings → School Year
    collegeGradingFramework: 'ched_standard', // see Settings → Grading Frameworks → College Grading
    basicEd: { startDate: '2025-06-01', endDate: '2026-03-31', events: [] },
    college: { startDate: '2025-08-01', endDate: '2026-05-31', events: [] },
  },
  {
    id: 2, year: '2026-2027', status: 'active', isCurrent: true,
    gradingPeriodType: 'quarterly',
    gradingFramework:  'do8_2015',
    collegeGradingFramework: 'ched_standard',
    basicEd: { startDate: '2026-06-01', endDate: '2027-03-31', events: [] },
    college: { startDate: '2026-08-01', endDate: '2027-05-31', events: [] },
  },
  {
    id: 3, year: '2027-2028', status: 'upcoming', isCurrent: false,
    gradingPeriodType: 'quarterly',
    gradingFramework:  'do8_2015',
    collegeGradingFramework: 'ched_standard',
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
    color:       'bg-primary/10 text-[var(--color-primary-readable)] dark:bg-primary/20 dark:text-red-300',
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
    permissions: ['dashboard', 'e-class-record', 'teacher-forms', 'students', 'subject_load'],
    campusScoped: true,
  },
  librarian: {
    label:       'Librarian',
    description: 'Signs the Library department of student clearances',
    color:       'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    permissions: ['dashboard', 'clearance'],
    campusScoped: true,
  },
  guidance: {
    label:       'Guidance Counselor',
    description: 'Signs the Guidance department of student clearances',
    color:       'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
    permissions: ['dashboard', 'clearance'],
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
  // ── Management ──
  { id: 'enrollments',  label: 'Enrollments',  icon: 'FileText' },
  { id: 'students',     label: 'Students',     icon: 'Users' },
  { id: 'payments',     label: 'Payments',     icon: 'DollarSign' },
  { id: 'document-requests',      label: 'Document Requests',      icon: 'FileText' },
  { id: 'clearance',                label: 'Clearance',               icon: 'ShieldCheck' },
  // ── Analytics ──
  { id: 'reports',      label: 'Reports',      icon: 'BarChart2' },
  // ── System ──
  { id: 'settings',     label: 'Settings',     icon: 'Settings' },
  // ── Academic ──
  { id: 'subject-load', label: 'Subject Load', icon: 'BookOpen' },
  { id: 'e-class-record', label: 'e-Class Record', icon: 'ClipboardList' },
  { id: 'teacher-forms',      label: 'Teacher Forms',      icon: 'FileText'     },
  { id: 'grade-change-requests',  label: 'Grade Change Requests',  icon: 'FileEdit'   },
  { id: 'inc-completion',           label: 'INC Completion',          icon: 'Hourglass'  },
  { id: 'attendance',               label: 'Attendance',              icon: 'Calendar'   },
]

/** All available settings tabs */
export const ALL_TABS = [
  { id: 'users',         label: 'Users',          forRoles: ['technical_admin', 'system_admin'] },
  { id: 'schoolInfo',    label: 'School Info',     forRoles: ['technical_admin'] },
  { id: 'formTemplates', label: 'Form Templates',  forRoles: ['technical_admin'] },
  { id: 'schoolYear',    label: 'School Year',     forRoles: ['principal_basic', 'program_head'] },
  { id: 'grades',        label: 'Grade Levels',    forRoles: ['principal_basic', 'program_head'] },
  { id: 'fees',          label: 'Fee Structure',   forRoles: ['accounting'] },
  { id: 'discounts',     label: 'Discounts',       forRoles: ['accounting'] },
  { id: 'receipt',       label: 'Receipt & Payment', forRoles: ['accounting'] },
  { id: 'workflow',      label: 'Workflow Config',  forRoles: ['technical_admin'] },
]

/** Default permissions per role — used when user.permissions is not set */
export const DEFAULT_PERMISSIONS = {
  admin:             { pages: ['dashboard', 'enrollments', 'reports', 'inc-completion'],                      tabs: [] },
  technical_admin:   { pages: ['dashboard', 'enrollments', 'students', 'payments', 'document-requests', 'clearance', 'reports', 'settings', 'subject-load', 'e-class-record', 'teacher-forms'], tabs: ['users', 'schoolInfo', 'formTemplates', 'workflow'] },
  system_admin:      { pages: ['dashboard', 'settings'],                                                       tabs: ['users'] },
  registrar_basic:   { pages: ['dashboard', 'enrollments', 'students', 'document-requests', 'clearance', 'grade-change-requests'], tabs: [] },
  registrar_college: { pages: ['dashboard', 'enrollments', 'students', 'document-requests', 'clearance', 'subject-load', 'grade-change-requests', 'inc-completion'], tabs: [] },
  accounting:        { pages: ['dashboard', 'enrollments', 'payments', 'document-requests', 'clearance', 'reports', 'settings'], tabs: ['fees', 'discounts', 'receipt'] },
  principal_basic:   { pages: ['dashboard', 'enrollments', 'students', 'clearance', 'settings', 'subject-load', 'grade-change-requests', 'attendance'], tabs: ['schoolYear', 'grades'] },
  program_head:      { pages: ['dashboard', 'enrollments', 'students', 'clearance', 'settings', 'subject-load', 'grade-change-requests', 'inc-completion', 'attendance'], tabs: ['schoolYear', 'grades'] },
  teacher:           { pages: ['dashboard', 'students', 'subject-load', 'e-class-record', 'teacher-forms', 'grade-change-requests', 'inc-completion', 'attendance'], tabs: [] },
  librarian:         { pages: ['dashboard', 'clearance'], tabs: [] },
  guidance:          { pages: ['dashboard', 'clearance'], tabs: [] },
}

// ─────────────────────────────────────────────────────────────────────
// STUDENT CLEARANCE — who signs which department
// Single source of truth (the clearance page, the bridge and Settings all read it).
//   • A role signs the departments listed for it here.
//   • A small school can give ANY account extra duties on top of its own role
//     (user.clearanceDuties, set in Settings → Users). Example: a teacher who is
//     also the guidance in-charge signs Guidance while still working as a teacher.
//   • Super Admin can sign any department.
//   • Departments sign in any order, except the LAST department, which opens only
//     once every other department has signed.
// ─────────────────────────────────────────────────────────────────────
export const CLEARANCE_DEPARTMENT_SIGNERS = {
  library:    ['librarian'],
  accounting: ['accounting'],
  registrar:  ['registrar_basic', 'registrar_college'],
  guidance:   ['guidance'],
  admin:      ['principal_basic', 'program_head'],
}

/** Departments an account can be given as an extra duty (Settings → Users). */
export const CLEARANCE_DUTY_OPTIONS = [
  { id: 'library',    label: 'Library'      },
  { id: 'accounting', label: 'Accounting'   },
  { id: 'registrar',  label: 'Registrar'    },
  { id: 'guidance',   label: 'Guidance'     },
  { id: 'admin',      label: 'Admin Office' },
]

/** The department that signs last — it opens only after all the others have signed. */
export const CLEARANCE_LAST_DEPARTMENT = 'admin'

// ─────────────────────────────────────────────────────────────────────
// CLEARANCE REQUIREMENTS — what a student must clear, and who signs each one
//
// The Technical Admin edits these lists (Settings → Workflow → Clearance); the
// Clearance page, its columns and its progress all read them. These are only the
// STARTING lists, used until the school saves its own. They reproduce the five
// fixed departments the system used before, so nothing changes until someone edits.
//
// One list per department of the school: 'basicEd' and 'college'.
//
// A requirement:
//   id               stable key, also stored on each clearance (e.g. 'library')
//   label            column / row title
//   icon             icon name the page maps to a lucide icon
//   signer.type      one of CLEARANCE_SIGNER_TYPES below
//   signer.roles     (role)            any account holding one of these roles signs
//   signer.userIds   (user)            any of these accounts signs
//   signer.subject   (subject_teacher) text matched inside the subject name,
//                                      e.g. "Math" matches "Mathematics" and "Core Mathematics"
//   order            'any' = can be signed at any time
//                    'after_others' = opens only when every 'any' requirement is signed
//   required         false = shown and signable, but does not hold the clearance back
//   autoFromPayment  Accounting-style check: clears on its own when the live balance is zero
// ─────────────────────────────────────────────────────────────────────

/** Where a requirement's signer comes from. */
export const CLEARANCE_SIGNER_TYPES = [
  { id: 'role',                label: 'Anyone with a role',                 hint: 'e.g. the Librarian or the Registrar' },
  { id: 'user',                label: 'Specific accounts',                  hint: 'e.g. the one person who handles Guidance' },
  { id: 'student_instructors', label: "The student's subject instructors",  hint: 'One signature per subject the student takes, from Subject Load' },
  { id: 'subject_teacher',     label: 'Teacher of a named subject',         hint: "e.g. the student's Math teacher, from Subject Load" },
  { id: 'section_adviser',     label: "The student's section adviser",      hint: 'From the adviser set in Subject Load' },
]

/**
 * Roles that may sign a teacher-based requirement (subject instructor, subject teacher,
 * section adviser) when nobody has been assigned in Subject Load yet. They sign on behalf
 * and must leave a note; the sign-off is marked "signed on behalf" so the gap stays visible.
 * Super Admin can always do this.
 */
export const CLEARANCE_UNASSIGNED_FALLBACK_ROLES = ['principal_basic', 'program_head']

export const CLEARANCE_ORDER_OPTIONS = [
  { id: 'any',          label: 'Any time' },
  { id: 'after_others', label: 'Only after every other requirement is signed' },
]

/** The school departments that each have their own requirements list. */
export const CLEARANCE_DEPARTMENT_SCOPES = [
  { id: 'basicEd', label: 'Basic Education' },
  { id: 'college', label: 'College'         },
]

/** Signer types whose people come from Subject Load (not from a fixed role or account). */
export const CLEARANCE_TEACHER_SIGNER_TYPES = ['student_instructors', 'subject_teacher', 'section_adviser']

/**
 * Roles the Technical Admin may pick as signers of a requirement.
 * Everything except the admin-side roles that never sign student clearances, and the student.
 */
const CLEARANCE_NON_SIGNER_ROLES = ['technical_admin', 'system_admin', 'admin', 'student']
export const CLEARANCE_SIGNABLE_ROLES = Object.keys(ROLE_DEFINITIONS).filter(r => !CLEARANCE_NON_SIGNER_ROLES.includes(r))

/**
 * Icons a requirement can show in the Clearance table. The ids must match the icon map in
 * pages/Clearance.jsx; 'default' falls back to the generic shield.
 */
export const CLEARANCE_ICON_OPTIONS = [
  { id: 'default',     label: 'Shield (general)'   },
  { id: 'library',     label: 'Book'               },
  { id: 'accounting',  label: 'Credit card'        },
  { id: 'registrar',   label: 'Shield with check'  },
  { id: 'guidance',    label: 'People'             },
  { id: 'admin',       label: 'Building'           },
  { id: 'instructors', label: 'Graduation cap'     },
  { id: 'adviser',     label: 'Person with check'  },
]

function defaultClearanceRequirements() {
  const byRoles = (id, label, icon, extra = {}) => ({
    id, label, icon,
    signer: { type: 'role', roles: [...(CLEARANCE_DEPARTMENT_SIGNERS[id] || [])] },
    order: 'any', required: true, autoFromPayment: false,
    ...extra,
  })
  return [
    byRoles('library',    'Library',      'library'),
    byRoles('accounting', 'Accounting',   'accounting', { autoFromPayment: true }),
    byRoles('registrar',  'Registrar',    'registrar'),
    byRoles('guidance',   'Guidance',     'guidance'),
    byRoles('admin',      'Admin Office', 'admin',      { order: 'after_others' }),
  ]
}

/** Starting requirements per school department. Fresh copies, safe to edit. */
export function getDefaultClearanceRequirements(scope) {
  return CLEARANCE_DEPARTMENT_SCOPES.some(s => s.id === scope) ? defaultClearanceRequirements() : []
}

// ─────────────────────────────────────────────────────────────────────
// CLEARANCE REASONS — why a clearance is being opened
//
// The Registrar picks one when starting a clearance (Clearance page -> New Clearance).
// The Technical Admin edits the list per school department in Settings -> Workflow Config ->
// Student Clearance -> Reasons. These are only the STARTING reasons, used until the school saves
// its own.
//
//   id                  stable key, stored on each clearance
//   label               what the Registrar sees, and what the clearance shows as its reason
//   requiresZeroBalance true = Accounting cannot sign while a balance is owing
//   requirements        optional. Left out, the reason uses the department's standard requirements
//                       list. When present, it is this reason's OWN list (same shape as a
//                       requirement list above), e.g. Transfer skipping Guidance.
// ─────────────────────────────────────────────────────────────────────
function defaultClearanceReasons() {
  return [
    { id: 'graduation', label: 'Graduation Clearance',           requiresZeroBalance: true  },
    { id: 'transfer',   label: 'Transfer / Honorable Dismissal', requiresZeroBalance: false },
    { id: 'transcript', label: 'Transcript of Records',          requiresZeroBalance: false },
    { id: 'credential', label: 'Release of Credentials',         requiresZeroBalance: false },
    { id: 'general',    label: 'General Clearance',              requiresZeroBalance: false },
  ]
}

/** Starting reasons per school department. Fresh copies, safe to edit. */
export function getDefaultClearanceReasons(scope) {
  return CLEARANCE_DEPARTMENT_SCOPES.some(s => s.id === scope) ? defaultClearanceReasons() : []
}

/**
 * The clearance setup in use, per department, read straight from storage (clearanceConfigBridge imports this
 * file, so this file cannot import it back). Every campus has its own setup, saved under
 * campuses[campusKey]; a campus with nothing saved uses the old school-wide setup, else the standard lists.
 * With no campusKey, every campus's setup (and the default) is returned, so "does anyone use X" questions
 * cover the whole school.
 * @returns {{ scope:string, requirements:object[], reasons:object[] }[]}
 */
function readClearanceViews(campusKey) {
  let raw = {}
  try { raw = JSON.parse(localStorage.getItem('almirene_clearance_requirements') || '{}') || {} } catch { raw = {} }
  const items = (v) => (Array.isArray(v) && v.length ? v : null)
  const keys = campusKey ? [campusKey] : [null, ...Object.keys(raw.campuses || {})]
  const out = []
  keys.forEach(ck => CLEARANCE_DEPARTMENT_SCOPES.forEach(sc => {
    const own = ck ? raw.campuses?.[ck]?.[sc.id] : null
    const shared = raw[sc.id]
    out.push({
      scope: sc.id,
      requirements: items(own?.requirements) || items(shared?.requirements) || getDefaultClearanceRequirements(sc.id),
      reasons:      items(own?.reasons)      || items(shared?.reasons)      || [],
    })
  }))
  return out
}

/** Every requirement list in a view: the department's own list plus any list a reason brings. */
function lists(view) {
  return [view.requirements, ...view.reasons.filter(r => Array.isArray(r?.requirements) && r.requirements.length).map(r => r.requirements)]
}

/**
 * What an account can be given as an extra clearance duty (Settings -> Users), built from the
 * clearance requirements configured for that account's campus. A requirement that exists in both
 * departments is one option. Only requirements with a fixed signer (a role or specific accounts)
 * are offered: teacher-based ones follow Subject Load. Without a campus, every campus's
 * requirements are included.
 * @param {string} [campusKey]
 * @returns {{id:string, label:string, scopes:string[], roles:string[], userIds:string[]}[]}
 */
export function getClearanceDutyOptions(campusKey) {
  const byId = new Map()
  readClearanceViews(campusKey).forEach(view => {
    lists(view).forEach(list => list.forEach(r => {
      const type = r?.signer?.type || 'role'
      if (!r?.id || (type !== 'role' && type !== 'user')) return
      const e = byId.get(r.id) || { id: r.id, label: r.label || r.id, scopes: [], roles: [], userIds: [] }
      if (!e.scopes.includes(view.scope)) e.scopes.push(view.scope)
      if (type === 'role') (r.signer.roles || []).forEach(x => { if (!e.roles.includes(x)) e.roles.push(x) })
      if (type === 'user') (r.signer.userIds || []).forEach(x => { if (!e.userIds.includes(String(x))) e.userIds.push(String(x)) })
      byId.set(r.id, e)
    }))
  })
  return [...byId.values()]
}

/**
 * Clearance requirements this user may sign: from their role, from being a named signer,
 * plus any extra duties on the account. Super Admin may sign all of them.
 * @returns {string[]} requirement ids
 */
export function getClearanceDepartments(user) {
  if (!user) return []
  const options = getClearanceDutyOptions(user.campusKey || undefined)
  const all = options.map(o => o.id)
  if (user.role === 'technical_admin') return all
  const fromRole = options
    .filter(o => o.roles.includes(user.role) || (user.id != null && o.userIds.includes(String(user.id))))
    .map(o => o.id)
  const extra = Array.isArray(user.clearanceDuties) ? user.clearanceDuties.filter(id => all.includes(id)) : []
  return all.filter(id => fromRole.includes(id) || extra.includes(id))
}

/**
 * Get effective permissions for a user — resolves the 3-tier system (Section 7.2):
 *   Tier 1: per-user custom override (user.permissions, set in Settings → Users)
 *   Tier 2: role-level config (Settings → Role Permissions, saved via saveRolePermissions)
 *   Tier 3: hardcoded DEFAULT_PERMISSIONS — baseline, never changes without a code deploy
 *
 * technical_admin (Super Admin) always bypasses all three tiers and gets every
 * page + tab — per Section 7.1, "Cannot be restricted."
 */
/**
 * Duties that bring a whole role's pages and tabs with them. One person keeps ONE
 * account (their own role) and the duty adds the other role's modules on top, so a
 * teacher who is also the guidance in-charge can use the Guidance pages.
 *
 * Only roles that are clearly a single job are listed. Accounting, Registrar and
 * Admin Office duties add the Clearance page only: handing someone the whole
 * accounting or registrar module (payments, records) is a bigger decision, so it
 * is done on purpose with a custom permission set in Settings → Users.
 */
export const CLEARANCE_DUTY_ROLE_ACCESS = {
  library:  'librarian',
  guidance: 'guidance',
}

/**
 * True when the clearance setup at this campus (any campus when none is given) includes a teacher-based
 * signer: the student's instructors, the teacher of a subject, a section adviser.
 */
function clearanceUsesTeacherSigners(campusKey) {
  try {
    return readClearanceViews(campusKey).some(view =>
      lists(view).some(list => list.some(r => CLEARANCE_TEACHER_SIGNER_TYPES.includes(r?.signer?.type))))
  } catch { return false }
}

export function getUserPermissions(user) {
  const base = resolveUserPermissions(user)
  const duties = Array.isArray(user?.clearanceDuties) ? user.clearanceDuties : []
  // A teacher needs the Clearance page as soon as a requirement is signed by teachers
  // (the page then shows them only the clearances they are part of).
  const teacherSigns = user?.role === 'teacher' && clearanceUsesTeacherSigners(user.campusKey || undefined)
  if (!user || user.role === 'technical_admin' || (!duties.length && !teacherSigns)) return base

  // Whatever the account's own tier gave it stays; duties only ADD.
  const pages = [...(base.pages || []), 'clearance']
  const tabs  = [...(base.tabs  || [])]
  duties.forEach(duty => {
    const dutyRole = CLEARANCE_DUTY_ROLE_ACCESS[duty]
    if (!dutyRole) return
    // Uses the role's saved permissions (Settings → Role Permissions) when there are any
    const rp = resolveUserPermissions({ role: dutyRole })
    pages.push(...(rp.pages || []))
    tabs.push(...(rp.tabs || []))
  })
  return { ...base, pages: [...new Set(pages)], tabs: [...new Set(tabs)] }
}

function resolveUserPermissions(user) {
  if (!user) return { pages: [], tabs: [] }

  // Super Admin: full, non-restrictable access — checked before any tier
  if (user.role === 'technical_admin') {
    return {
      pages: ALL_PAGES.map(p => p.id),
      tabs: ALL_TABS.map(t => t.id),
    }
  }

  // Tier 1: per-user custom override
  if (user.permissions) return user.permissions

  // Tier 2: role-level config saved in Settings → Role Permissions
  const rolePerms = getRolePermissions()
  if (rolePerms && rolePerms[user.role]) return rolePerms[user.role]

  // Tier 3: hardcoded defaults
  return DEFAULT_PERMISSIONS[user.role] || { pages: ['dashboard'], tabs: [] }
}

/** Save role-level permissions to almirene_app_config */
export function saveRolePermissions(rolePermissions) {
  try {
    const cfg = JSON.parse(localStorage.getItem('almirene_app_config') || '{}')
    cfg.rolePermissions = rolePermissions
    localStorage.setItem('almirene_app_config', JSON.stringify(cfg))
    window.dispatchEvent(new CustomEvent('almirene_app_config_updated'))
    return true
  } catch { return false }
}

/** Get current role permissions (from config or defaults) */
export function getRolePermissions() {
  try {
    const cfg = JSON.parse(localStorage.getItem('almirene_app_config') || '{}')
    if (cfg.rolePermissions) return cfg.rolePermissions
  } catch {}
  return DEFAULT_PERMISSIONS
}

/**
 * Is this role inherently scoped to a single campus (vs. seeing all campuses)?
 * This is a role-identity fact, not a configurable permission — it's used for
 * UI like the campus-lock banner/chip, not access control. Kept as one shared
 * list so it can't drift between the places that need it.
 */
export function isCampusLockedRole(user) {
  if (!user) return false
  return (
    user.role === 'registrar_basic'   ||
    user.role === 'registrar_college' ||
    user.role === 'principal_basic'   ||
    user.role === 'program_head'      ||
    user.role === 'system_admin'      ||
    user.role === 'teacher'           ||
    (user.role === 'accounting' && user.campus !== 'all')
  )
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
  //   placeholders based on typical school structure. Update once
  //   Talisay staff confirms their workflow.
  {
    id:   1,
    key:  'Talisay',
    name: 'Talisay City Campus',
    address:       'Lawaan 1, Talisay City, Cebu',
    contactNumber: '032-123-4567',
    email:         '',
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
    email:         '',
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
    email:         '',
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
export { SYSTEM_USERS } from './users'

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
    librarian:           true,
    guidance:            true,
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

/**
 * Is this a Basic Ed grade level?  (single source of truth — never copy this)
 * Exact, case-insensitive match against the configured Basic Ed levels, so
 * "Grade 1" can never match "Grade 10" and a renamed/added level works with
 * zero code changes.
 *
 * In components prefer the live-config version from useAppConfig():
 *   const { isBasicGrade } = useAppConfig()
 * It already knows about levels an admin edited in Settings. Call this one
 * directly only outside React, passing `groupsOverride` (config.basicEdGroups).
 */
export function isBasicGrade(gradeLevel, groupsOverride) {
  if (!gradeLevel) return false
  const g = String(gradeLevel).trim().toLowerCase()
  return getAllBasicEdGrades(groupsOverride).some(x => String(x).trim().toLowerCase() === g)
}

/**
 * Is this a College grade level?  College levels are stored as
 * "<Program> - <Year Level>" (e.g. "BS Nursing - 1st Year"), so this checks the
 * level ends with one of the configured year levels. Same live-config note as
 * isBasicGrade: in components use `const { isCollegeGrade } = useAppConfig()`.
 */
export function isCollegeGrade(gradeLevel, yearLevelsOverride) {
  if (!gradeLevel) return false
  const g = String(gradeLevel).trim().toLowerCase()
  return (yearLevelsOverride || COLLEGE_YEAR_LEVELS)
    .some(y => g.endsWith(String(y).trim().toLowerCase()))
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

/**
 * Default minimum down payment (PHP) collected when accounting marks an
 * enrollment as paid. Campuses can override it in Settings → Receipt & Payment
 * (stored in almirene_campus_cfg_{campusKey}.minimumPayment).
 */
export const DEFAULT_MINIMUM_PAYMENT = 500

/**
 * Payment methods the cashier can record when confirming a document fee
 * (Document Requests → Confirm Payment). Matches the methods offered on the
 * Payments page.
 */
export const DOCUMENT_PAYMENT_METHODS = ['Cash', 'Bank Transfer']

/**
 * Purposes offered when a document request is recorded. "Other" lets the
 * person type their own. Edit this list to change the dropdown everywhere.
 */
export const DOCUMENT_REQUEST_PURPOSES = [
  'Employment',
  'Scholarship application',
  'Further studies / transfer',
  'Board exam / licensure',
  'Overseas / visa application',
  'Personal records',
]

/**
 * Document formats (Document Requests → Formats / Print).
 * The registrar uploads a PDF or image of a format once, places the fields on it,
 * and every request is then filled in automatically.
 */
// Deleted documents can be restored for this many days, then they are removed for good
export const DOCUMENT_TRASH_RETENTION_DAYS = 30

export const DOCUMENT_FORMAT_LIMITS = {
  maxFileMB:      10,    // largest PDF / image accepted
  renderWidthPx:  1240,  // the page is stored as an image this wide (about A4 at 150 dpi)
  jpegQuality:    0.82,
  defaultPageWidthPt: 595.28,   // A4 width, used for image uploads that carry no page size
}

/**
 * Fields the registrar can place on a format. `sample` is only used in the editor preview.
 * Add a field here and it appears in the Formats editor and fills on every printout.
 */
export const DOCUMENT_FORMAT_FIELDS = [
  { group: 'Student',  key: 'student_name',            label: 'Student name (First Last)',  sample: 'Maria Dela Cruz' },
  { group: 'Student',  key: 'student_name_upper',      label: 'Student name (UPPERCASE)',   sample: 'MARIA DELA CRUZ' },
  { group: 'Student',  key: 'student_name_last_first', label: 'Student name (LAST, FIRST)', sample: 'DELA CRUZ, MARIA' },
  { group: 'Student',  key: 'student_id',              label: 'Student ID',                 sample: '2026-1001' },
  { group: 'Student',  key: 'grade_level',             label: 'Grade level / program',      sample: 'Grade 10' },
  { group: 'Student',  key: 'year_graduated',          label: 'Year graduated',             sample: '2023' },
  { group: 'Request',  key: 'document_type',           label: 'Document requested',         sample: 'Good Moral Certificate' },
  { group: 'Request',  key: 'purpose',                 label: 'Purpose',                    sample: 'Employment' },
  { group: 'Request',  key: 'requestor_name',          label: 'Requested by',               sample: 'Maria Dela Cruz' },
  { group: 'Request',  key: 'date_requested',          label: 'Date requested',             sample: 'October 15, 2026' },
  { group: 'Request',  key: 'school_year',             label: 'School year',                sample: '2026-2027' },
  { group: 'Date issued', key: 'date_today',           label: 'Date (October 16, 2026)',    sample: 'October 16, 2026' },
  { group: 'Date issued', key: 'date_given',           label: 'Date (16th day of October, 2026)', sample: '16th day of October, 2026' },
  { group: 'Date issued', key: 'day_today',            label: 'Day only (16th)',            sample: '16th' },
  { group: 'Date issued', key: 'month_today',          label: 'Month only (October)',       sample: 'October' },
  { group: 'Date issued', key: 'year_today',           label: 'Year only (2026)',           sample: '2026' },
  { group: 'Payment',  key: 'or_number',               label: 'OR number',                  sample: 'OR-2610-0001' },
  { group: 'Payment',  key: 'amount_paid',             label: 'Amount paid',                sample: '₱50.00' },
  { group: 'School',   key: 'school_name',             label: 'School name',                sample: 'Sample School' },
  { group: 'School',   key: 'campus_name',             label: 'Campus',                     sample: 'Carcar City Campus' },
  { group: 'School',   key: 'prepared_by',             label: 'Prepared by (logged-in registrar)', sample: 'Registrar Name' },
]

/**
 * Default document catalog for Document Requests (labels, fees, clearance).
 * These are only the starting point: accounting sets each campus's own prices
 * (and can add or remove documents) in Settings → Fees → Document Fees.
 * A fee of 0 means the document is free.
 */
export const DEFAULT_DOCUMENT_TYPES = {
  basicEd: [
    { id: 'enrollment_form',        label: 'Enrollment Form',                  requiresClearance: false, fee: 0   },
    { id: 'form138',                label: 'Report Card (Form 138)',           requiresClearance: false, fee: 0   },
    { id: 'certificate_enrollment', label: 'Certificate of Enrollment',        requiresClearance: false, fee: 50  },
    { id: 'good_moral',             label: 'Good Moral Certificate',           requiresClearance: false, fee: 50  },
    { id: 'transfer_credentials',   label: 'Transfer Credentials',             requiresClearance: true,  fee: 100 },
    { id: 'form137',                label: 'Form 137 (Permanent Record)',      requiresClearance: true,  fee: 0   },
    { id: 'form138_transfer',       label: 'Form 138 (for Transfer)',          requiresClearance: true,  fee: 0   },
  ],
  college: [
    { id: 'certificate_enrollment', label: 'Certificate of Enrollment',        requiresClearance: false, fee: 50  },
    { id: 'certificate_grades',     label: 'Certificate of Grades',            requiresClearance: false, fee: 50  },
    { id: 'transcript',             label: 'Transcript of Records',            requiresClearance: true,  fee: 200 },
    { id: 'good_moral',             label: 'Good Moral Certificate',           requiresClearance: false, fee: 50  },
    { id: 'honorable_dismissal',    label: 'Honorable Dismissal',              requiresClearance: true,  fee: 100 },
    { id: 'certification',          label: 'Certification',                    requiresClearance: false, fee: 50  },
    { id: 'cor',                    label: 'Certificate of Registration (COR)', requiresClearance: false, fee: 0  },
  ],
}

/**
 * Minimum payment for a campus. Accepts a campus name ('Carcar City Campus')
 * or key ('Carcar'). Falls back to DEFAULT_MINIMUM_PAYMENT when unset/invalid.
 * Reads localStorage directly so it works outside React (same pattern as
 * the per-campus cashier name / discounts).
 */
export function getMinimumPayment(campusNameOrKey) {
  try {
    const key = !campusNameOrKey || campusNameOrKey === 'all'
      ? 'all'
      : String(campusNameOrKey).replace(/ (City |)Campus$/i, '').replace(/[^a-zA-Z]/g, '')
    // Campus-specific value first, then the school-wide ('all') value, then default
    for (const k of key === 'all' ? ['all'] : [key, 'all']) {
      const cfg = JSON.parse(localStorage.getItem(`almirene_campus_cfg_${k}`) || '{}')
      const n = Number(cfg.minimumPayment)
      if (Number.isFinite(n) && n > 0) return n
    }
    return DEFAULT_MINIMUM_PAYMENT
  } catch { return DEFAULT_MINIMUM_PAYMENT }
}

// ─────────────────────────────────────────────────────────────────────
// PAYMENT DUE DATE
// Each campus decides how a student's default due date is set
// (Settings → Receipt & Payment → Payment Due Date):
//   mode 'exam'  → the first exam on the school calendar that is still ahead
//                  (events whose name contains "exam"), minus offsetDays
//   mode 'fixed' → one fixed date
// If no exam is scheduled, the fixed date (when set) is used as a fallback.
// A student's due date can later be moved (promissory note) — that override
// is stored on the student's record, never here.
// All dates are plain 'YYYY-MM-DD' strings (local time, no timezone drift).
// ─────────────────────────────────────────────────────────────────────
export const DEFAULT_DUE_DATE_POLICY = { mode: 'exam', offsetDays: 0, fixedDate: '' }

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Today as 'YYYY-MM-DD' in local time */
export function todayYMD() { return ymd(new Date()) }

/** Any date / ISO string → 'YYYY-MM-DD' (local). '' when empty or invalid. */
export function toYMD(value) {
  if (!value) return ''
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const d = new Date(value)
  return isNaN(d) ? '' : ymd(d)
}

/** 'YYYY-MM-DD' minus N days */
export function shiftDays(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return ymd(d)
}

/** Whole days from dateStr to today (positive = dateStr is in the past) */
export function daysPast(dateStr, today = todayYMD()) {
  if (!dateStr) return 0
  return Math.round((new Date(today + 'T12:00:00') - new Date(dateStr + 'T12:00:00')) / 86400000)
}

/** A balance is overdue the day AFTER its due date */
export function isPastDue(dueDate, today = todayYMD()) {
  return !!dueDate && dueDate < today
}

/** Due-date policy for a campus (name or key); falls back to the school-wide ('all') setting, then defaults */
export function getDueDatePolicy(campusNameOrKey) {
  const key = !campusNameOrKey || campusNameOrKey === 'all'
    ? 'all'
    : String(campusNameOrKey).replace(/ (City |)Campus$/i, '').replace(/[^a-zA-Z]/g, '')
  try {
    for (const k of key === 'all' ? ['all'] : [key, 'all']) {
      const cfg = JSON.parse(localStorage.getItem(`almirene_campus_cfg_${k}`) || '{}')
      if (cfg.dueDatePolicy) {
        const p = cfg.dueDatePolicy
        return {
          mode:       p.mode === 'fixed' ? 'fixed' : 'exam',
          offsetDays: Math.max(0, parseInt(p.offsetDays, 10) || 0),
          fixedDate:  toYMD(p.fixedDate),
        }
      }
    }
  } catch { /* fall through */ }
  return { ...DEFAULT_DUE_DATE_POLICY }
}

/** First exam event on/after fromDate for a school year + department ('basicEd' | 'college') */
export function findNextExam(schoolYears, schoolYear, department, fromDate = todayYMD()) {
  const years = schoolYears || SCHOOL_YEARS
  const sy = years.find(y => y.year === schoolYear) || years.find(y => y.isCurrent) || years[0]
  const events = (sy?.[department]?.events || [])
    .filter(e => /exam/i.test(e.name || '') && e.startDate && e.startDate >= fromDate)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
  return events[0] || null
}

/** Longest promissory-note extension (days) accounting can grant without a warning */
export const DEFAULT_MAX_EXTENSION_DAYS = 60

/** Quick-pick reasons for a due-date extension (promissory note). 'other' requires a typed remark. */
export const EXTENSION_REASONS = [
  { value: 'financial',   label: 'Financial difficulty' },
  { value: 'remittance',  label: 'Waiting for remittance (OFW / family abroad)' },
  { value: 'income',      label: 'Waiting for harvest / seasonal income' },
  { value: 'scholarship', label: 'Waiting for scholarship / grant release' },
  { value: 'emergency',   label: 'Medical / family emergency' },
  { value: 'other',       label: 'Other (specify)' },
]

/** Quick-extend buttons in the Extend Due Date modal (days) */
export const EXTENSION_QUICK_DAYS = [7, 14, 30]

/**
 * Work out a due date from an explicit policy (so Settings can preview unsaved edits).
 * @returns {{ date: string, source: 'exam'|'fallback'|'fixed'|'none', exam: object|null }}
 *   source 'fallback' = exam mode but no upcoming exam, so the fixed date was used;
 *   source 'none'     = nothing to base a date on (the student would show "Not set").
 */
export function resolveDueDate(policy, { department, schoolYear, schoolYears, fromDate } = {}) {
  const from  = toYMD(fromDate) || todayYMD()
  const fixed = toYMD(policy?.fixedDate)
  if (policy?.mode === 'exam') {
    const exam = findNextExam(schoolYears, schoolYear, department, from)
    if (exam) {
      const off = Math.max(0, parseInt(policy.offsetDays, 10) || 0)
      const due = shiftDays(exam.startDate, -off)
      return { date: due < from ? exam.startDate : due, source: 'exam', exam }
    }
    return fixed ? { date: fixed, source: 'fallback', exam: null } : { date: '', source: 'none', exam: null }
  }
  return fixed ? { date: fixed, source: 'fixed', exam: null } : { date: '', source: 'none', exam: null }
}

/**
 * Default due date for a student, per the campus policy.
 * @returns {string} 'YYYY-MM-DD', or '' when no date can be worked out
 */
export function computeDefaultDueDate(args = {}) {
  return resolveDueDate(getDueDatePolicy(args.campusName), args).date
}

/**
 * The due date for an enrollment submission: the one saved on the record,
 * otherwise worked out from the campus policy. Pass the live isCollegeGrade
 * from useAppConfig() so admin-edited grade lists are respected.
 */
export function getSubmissionDueDate(sub, { schoolYears, isCollegeGrade } = {}) {
  if (sub?.dueDate) return toYMD(sub.dueDate)
  const grade = sub?.enrollment?.gradeLevel || ''
  return computeDefaultDueDate({
    campusName: sub?.enrollment?.campus,
    department: isCollegeGrade?.(grade) ? 'college' : 'basicEd',
    schoolYear: sub?.enrollment?.schoolYear,
    schoolYears,
    fromDate:   sub?.paymentHistory?.[0]?.date || sub?.lastPaymentDate || sub?.updatedAt || sub?.submittedDate,
  })
}

/** paid → nothing left; overdue → balance left AND past due date; partial → balance left, still on time */
export function getPaymentStatus(balance, dueDate) {
  if ((balance || 0) <= 0) return 'paid'
  return isPastDue(dueDate) ? 'overdue' : 'partial'
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
// DEFAULT SUBJECTS — moved to ./defaultSubjects.js
// ─────────────────────────────────────────────────────────────────────
export { DEFAULT_BASIC_ED_SUBJECTS, DEFAULT_COLLEGE_SUBJECTS } from './defaultSubjects'