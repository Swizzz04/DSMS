/**
 * SchoolComponents.jsx
 * ─────────────────────────────────────────────────────────────────
 * Shared, reusable UI components for the CSHC Admin Portal.
 *
 * EXPORTS (import what you need):
 *
 * ── Primitives ──────────────────────────────────────────────────
 *   php(value)                   — PHP currency formatter
 *   isBasicGrade(gradeLevel)     — true if Basic Ed grade
 *   isCollegeGrade(gradeLevel)   — true if College grade
 *   DEPT_STYLES                  — color map keyed by dept label
 *   PROG_COLORS                  — color array for college programs
 *
 * ── Status Badges ───────────────────────────────────────────────
 *   <EnrollmentStatusPill status />   — pending / payment_received / approved / rejected
 *   <PaymentStatusBadge   status />   — paid / partial / overdue / pending
 *
 * ── Stat Cards ──────────────────────────────────────────────────
 *   <StatCard label value sub border icon highlight />
 *   <CampusMiniCard campusStat />     — compact per-campus strip card
 *
 * ── Section Layout ──────────────────────────────────────────────
 *   <CampusBanner user />                    — campus-locked role banner (inside pages)
 *   <CampusChip    user />                    — campus pill shown in the top Header bar
 *   <SectionPanel title icon colorCls pills>  — titled collapsible section
 *
 * ── Enrollment Cards ────────────────────────────────────────────
 *   <DeptEnrollmentCard   group enrollments />
 *   <ProgramEnrollmentCard program colorIdx enrollments />
 *
 * ── Payment Cards ───────────────────────────────────────────────
 *   <DeptPaymentCard    group payments />
 *   <ProgramPaymentCard program colorIdx payments />
 *
 * ── Tables ──────────────────────────────────────────────────────
 *   <EnrollmentTable enrollments />     — recent enrollment rows
 *   <CampusEnrollmentTable campusStats />
 *   <CampusStudentTable campusStats stuTotal />
 *   <CampusPaymentTable campusStats />
 *
 * ── Collection Rate Bar ─────────────────────────────────────────
 *   <CollectionRateBar rate collected expected />
 */

import { useState } from 'react'
import {
  Clock, CheckCircle, XCircle, AlertCircle, DollarSign, Building2,
  BookOpen, GraduationCap, ChevronDown, ChevronUp,
  MapPin, FileText
} from 'lucide-react'
import { COLLEGE_YEAR_LEVELS } from '../config/appConfig'

// ────────────────────────────────────────────────────────────────
// PRIMITIVES
// ────────────────────────────────────────────────────────────────

/** PHP currency formatter */
export const php = (v) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 0 }).format(v ?? 0)

/** Returns true for Basic Education grade levels */
export function isBasicGrade(g) {
  return g?.includes('Grade') || ['Nursery', 'Kindergarten', 'Preparatory'].some(x => g?.includes(x))
}

/** Returns true for College grade levels */
export function isCollegeGrade(g) {
  return g?.includes('BS') || g?.includes('Year')
}

/** Department color styles keyed by label */
export const DEPT_STYLES = {
  'Pre-Elementary':    { bg: 'bg-emerald-600', lightBg: 'bg-emerald-50 dark:bg-emerald-900/20', light: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-700', text: 'text-emerald-700 dark:text-emerald-300' },
  'Elementary':        { bg: 'bg-blue-600',    lightBg: 'bg-blue-50 dark:bg-blue-900/20',       light: 'bg-blue-50 dark:bg-blue-900/20',       border: 'border-blue-200 dark:border-blue-700',       text: 'text-blue-700 dark:text-blue-300'       },
  'Junior High School':{ bg: 'bg-indigo-700',  lightBg: 'bg-indigo-50 dark:bg-indigo-900/20',   light: 'bg-indigo-50 dark:bg-indigo-900/20',   border: 'border-indigo-200 dark:border-indigo-700',   text: 'text-indigo-700 dark:text-indigo-300'   },
  'Senior High School':{ bg: 'bg-primary',     lightBg: 'bg-red-50 dark:bg-red-900/20',         light: 'bg-red-50 dark:bg-red-900/20',         border: 'border-red-200 dark:border-red-700',         text: 'text-primary dark:text-red-300'         },
}

/** College program color palette */
export const PROG_COLORS = [
  { bg: 'bg-primary',         lightBg: 'bg-red-50 dark:bg-red-900/20',        light: 'bg-red-50 dark:bg-red-900/20',        border: 'border-red-200 dark:border-red-700',       text: 'text-primary dark:text-red-300'        },
  { bg: 'bg-secondary',       lightBg: 'bg-indigo-50 dark:bg-indigo-900/20',  light: 'bg-indigo-50 dark:bg-indigo-900/20',  border: 'border-indigo-200 dark:border-indigo-700', text: 'text-indigo-700 dark:text-indigo-300'  },
  { bg: 'bg-light-secondary', lightBg: 'bg-blue-50 dark:bg-blue-900/20',      light: 'bg-blue-50 dark:bg-blue-900/20',      border: 'border-blue-200 dark:border-blue-700',     text: 'text-blue-700 dark:text-blue-300'      },
  { bg: 'bg-violet-600',      lightBg: 'bg-violet-50 dark:bg-violet-900/20',  light: 'bg-violet-50 dark:bg-violet-900/20',  border: 'border-violet-200 dark:border-violet-700', text: 'text-violet-700 dark:text-violet-300'  },
]

// ────────────────────────────────────────────────────────────────
// STATUS BADGES
// ────────────────────────────────────────────────────────────────

/**
 * Enrollment status pill — pending / approved / rejected
 * Usage: <EnrollmentStatusPill status="pending" />
 */
export function EnrollmentStatusPill({ status }) {
  const map = {
    pending:           { cls: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',   icon: <Clock className="w-3 h-3" />,        label: 'Awaiting Payment'   },
    payment_received:  { cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',           icon: <DollarSign className="w-3 h-3" />,   label: 'Payment Received'   },
    approved:          { cls: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',       icon: <CheckCircle className="w-3 h-3" />,  label: 'Approved'           },
    rejected:          { cls: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',               icon: <XCircle className="w-3 h-3" />,      label: 'Rejected'           },
  }
  const cfg = map[status] || map.pending
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
      {cfg.icon}{cfg.label}
    </span>
  )
}

/**
 * Payment status badge — paid / partial / overdue / pending
 * Usage: <PaymentStatusBadge status="paid" />
 */
export function PaymentStatusBadge({ status }) {
  const map = {
    paid:    { cls: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',     Icon: CheckCircle },
    partial: { cls: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', Icon: Clock       },
    overdue: { cls: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',             Icon: AlertCircle },
    pending: { cls: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',            Icon: XCircle     },
  }
  const { cls, Icon } = map[status] || map.pending
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      <Icon className="w-3 h-3" />{status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown'}
    </span>
  )
}

// ────────────────────────────────────────────────────────────────
// STAT CARDS
// ────────────────────────────────────────────────────────────────

/**
 * Standard stat card with left border accent.
 * Usage:
 *   <StatCard
 *     label="Total Students" value="1,234"
 *     sub="All campuses" border="border-blue-500"
 *     icon={<Users className="w-5 h-5 text-blue-500"/>}
 *   />
 */
export function StatCard({ label, value, sub, border, icon, highlight }) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl p-4 border-l-4 ${border} shadow-sm`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{label}</p>
        <div className="opacity-80">{icon}</div>
      </div>
      <p className={`text-2xl font-bold ${highlight || 'text-gray-800 dark:text-white'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

/**
 * Compact per-campus card for the campus strip in Dashboard.
 * Expects a campusStat object: { name, students, enrollments, collectionRate }
 * Usage: <CampusMiniCard campusStat={c} />
 */
export function CampusMiniCard({ campusStat: c }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 bg-secondary/10 dark:bg-secondary/30 rounded-lg flex items-center justify-center flex-shrink-0">
          <MapPin className="w-3.5 h-3.5 text-secondary dark:text-blue-400" />
        </div>
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 truncate">{c.name}</p>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-lg font-bold text-gray-800 dark:text-white">{c.students}</p>
          <p className="text-xs text-gray-400">Students</p>
        </div>
        <div>
          <p className="text-lg font-bold text-gray-800 dark:text-white">{c.enrollments}</p>
          <p className="text-xs text-gray-400">Enrolled</p>
        </div>
        <div>
          <p className="text-lg font-bold text-green-600 dark:text-green-400">
            {c.collectionRate != null ? `${c.collectionRate}%` : '—'}
          </p>
          <p className="text-xs text-gray-400">Collected</p>
        </div>
      </div>
      {c.collectionRate != null && (
        <div className="mt-3 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full transition-all duration-700"
            style={{ width: `${c.collectionRate}%` }} />
        </div>
      )}
    </div>
  )
}


// ────────────────────────────────────────────────────────────────
// CAMPUS BANNER
// ────────────────────────────────────────────────────────────────

/**
 * Campus-locked banner shown to users who are scoped to a specific campus.
 * Automatically picks the right color and message based on the user's role.
 *
 * Usage: <CampusBanner user={user} />
 *
 * Shows for: registrar_basic, registrar_college, accounting (campus !== 'all')
 * Hidden for: admin, principal_basic, accounting with campus === 'all'
 */
export function CampusBanner({ user }) {
  if (!user) return null

  const isRegistrarBasic   = user.role === 'registrar_basic'
  const isRegistrarCollege = user.role === 'registrar_college'
  const isAccounting       = user.role === 'accounting' && user.campus !== 'all'

  if (!isRegistrarBasic && !isRegistrarCollege && !isAccounting) return null

  const config = {
    registrar_basic: {
      bg:      'bg-emerald-50 dark:bg-emerald-900/20',
      border:  'border-emerald-200 dark:border-emerald-700',
      iconBg:  'bg-emerald-600',
      title:   `text-emerald-800 dark:text-emerald-200`,
      sub:     `text-emerald-600 dark:text-emerald-400`,
      label:   'Basic Education Registrar',
      message: 'Showing Basic Education enrollments for your assigned campus only',
    },
    registrar_college: {
      bg:      'bg-purple-50 dark:bg-purple-900/20',
      border:  'border-purple-200 dark:border-purple-700',
      iconBg:  'bg-purple-600',
      title:   'text-purple-800 dark:text-purple-200',
      sub:     'text-purple-600 dark:text-purple-400',
      label:   'College Registrar',
      message: 'Showing College enrollments for your assigned campus only',
    },
    accounting: {
      bg:      'bg-amber-50 dark:bg-amber-900/20',
      border:  'border-amber-200 dark:border-amber-700',
      iconBg:  'bg-amber-500',
      title:   'text-amber-800 dark:text-amber-200',
      sub:     'text-amber-600 dark:text-amber-400',
      label:   'Accounting Officer',
      message: 'You are only authorized to view and manage data for this campus',
    },
  }

  const cfg = config[user.role] || config.accounting

  return (
    <div className={`${cfg.bg} border ${cfg.border} rounded-xl px-5 py-3.5 flex items-center gap-3`}>
      <div className={`w-9 h-9 ${cfg.iconBg} rounded-xl flex items-center justify-center flex-shrink-0`}>
        <MapPin className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${cfg.title}`}>
          {user.campus}
          <span className="font-normal opacity-70"> — {cfg.label}</span>
        </p>
        <p className={`text-xs mt-0.5 ${cfg.sub}`}>{cfg.message}</p>
      </div>
      <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${cfg.iconBg} bg-opacity-10`}>
        <Building2 className={`w-3.5 h-3.5 ${cfg.sub}`} />
        <span className={`text-xs font-semibold ${cfg.sub}`}>Campus Locked</span>
      </div>
    </div>
  )
}


// ────────────────────────────────────────────────────────────────
// CAMPUS CHIP  (Header top bar indicator)
// ────────────────────────────────────────────────────────────────

/**
 * Compact campus pill shown in the Header navigation bar.
 * Replaces the campus picker for users locked to a single campus.
 *
 * Each role gets its own accent color so it's immediately clear who is logged in.
 *
 * Usage: <CampusChip user={user} />
 *
 * Shows for: registrar_basic, registrar_college, accounting (campus !== 'all')
 * Hidden for: admin, principal_basic, global accounting
 */
export function CampusChip({ user }) {
  if (!user) return null

  const isLocked =
    user.role === 'registrar_basic'   ||
    user.role === 'registrar_college' ||
    (user.role === 'accounting' && user.campus !== 'all')

  if (!isLocked) return null

  const colors = {
    registrar_basic:   'bg-emerald-500 border-emerald-500 text-white',
    registrar_college: 'bg-purple-600  border-purple-600  text-white',
    accounting:        'bg-amber-500   border-amber-500   text-white',
  }

  const cls = colors[user.role] || colors.accounting

  // Shorten campus name to fit the chip
  const shortName = user.campus
    .replace(' City Campus', '')
    .replace(' Campus', '')

  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg border ${cls} flex-shrink-0`}>
      <MapPin className="w-4 h-4 flex-shrink-0" />
      <span className="text-xs font-semibold max-w-[110px] truncate">{shortName}</span>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// SECTION PANEL
// ────────────────────────────────────────────────────────────────

/**
 * Titled section wrapper used on Dashboard to group Enrollments /
 * Students / Payments summaries.
 *
 * Usage:
 *   <SectionPanel
 *     title="Enrollments Summary"
 *     icon={<FileText className="w-4 h-4" />}
 *     colorCls="text-primary bg-red-50 dark:bg-red-900/10"
 *     pills={['24 total', '5 pending']}
 *   >
 *     ...content...
 *   </SectionPanel>
 */
export function SectionPanel({ title, icon, colorCls, pills, children }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
      <div className={`px-5 py-3.5 flex items-center gap-2.5 border-b border-gray-100 dark:border-gray-700 ${colorCls}`}>
        <div className="opacity-90">{icon}</div>
        <h3 className="text-sm font-bold uppercase tracking-wider">{title}</h3>
        {pills?.filter(Boolean).length > 0 && (
          <div className="ml-auto flex items-center gap-3">
            {pills.filter(Boolean).map((p, i) => (
              <span key={i} className="text-xs font-semibold opacity-90">{p}</span>
            ))}
          </div>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// COLLECTION RATE BAR
// ────────────────────────────────────────────────────────────────

/**
 * Full-width collection rate progress bar with label.
 * Usage: <CollectionRateBar rate={71} collected={957500} expected={1345000} />
 */
export function CollectionRateBar({ rate, collected, expected }) {
  const color = rate >= 75 ? 'bg-green-500' : rate >= 50 ? 'bg-yellow-500' : 'bg-red-500'
  const textColor = rate >= 75 ? 'text-green-600 dark:text-green-400' : rate >= 50 ? 'text-yellow-600' : 'text-red-500'
  return (
    <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Overall Collection Rate</p>
        <span className={`text-sm font-bold ${textColor}`}>{rate}%</span>
      </div>
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${rate}%` }} />
      </div>
      <div className="flex justify-between text-xs text-gray-400 mt-1.5">
        <span>Collected: {php(collected)}</span>
        <span>Expected: {php(expected)}</span>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// ENROLLMENT CARDS
// ────────────────────────────────────────────────────────────────

/**
 * Collapsible Basic Education department card showing per-grade
 * enrollment counts with stacked progress bars.
 *
 * Usage:
 *   <DeptEnrollmentCard group={group} enrollments={filteredEnrollments} />
 *
 * group shape: { label: 'Elementary', options: ['Grade 1', ...] }
 * enrollments: mockEnrollments array (filtered by campus if needed)
 */
export function DeptEnrollmentCard({ group, enrollments }) {
  const [expanded, setExpanded] = useState(true)
  const style = DEPT_STYLES[group.label] || DEPT_STYLES['Elementary']

  const gradeData = group.options.map(grade => {
    const gradeEnr = enrollments.filter(e => e.enrollment.gradeLevel === grade)
    return {
      grade,
      total:    gradeEnr.length,
      pending:  gradeEnr.filter(e => e.status === 'pending' || e.status === 'payment_received').length,
      approved: gradeEnr.filter(e => e.status === 'approved').length,
      rejected: gradeEnr.filter(e => e.status === 'rejected').length,
    }
  })

  const deptTotal    = gradeData.reduce((s, r) => s + r.total, 0)
  const deptPending  = gradeData.reduce((s, r) => s + r.pending, 0)
  const deptApproved = gradeData.reduce((s, r) => s + r.approved, 0)
  const deptRejected = gradeData.reduce((s, r) => s + r.rejected, 0)
  const maxCount     = Math.max(...gradeData.map(r => r.total), 1)

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-2xl shadow-sm border ${style.border} overflow-hidden`}>
      {/* Header */}
      <div onClick={() => setExpanded(e => !e)}
        className={`${style.lightBg} px-5 py-4 flex items-center justify-between gap-4 cursor-pointer select-none hover:opacity-90 transition`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-9 h-9 ${style.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <div className="text-left min-w-0">
            <p className={`text-sm font-bold ${style.text}`}>{group.label}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {group.options.length} grade level{group.options.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="hidden sm:flex items-center gap-1.5">
            <span className="text-xs font-bold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 px-2.5 py-1 rounded-full shadow-sm">
              {deptTotal} total
            </span>
            {deptPending  > 0 && <span className="text-xs font-semibold text-yellow-700 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/40 px-2 py-1 rounded-full">{deptPending} pending</span>}
            {deptApproved > 0 && <span className="text-xs font-semibold text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/40 px-2 py-1 rounded-full">{deptApproved} approved</span>}
          </div>
          <span className={`sm:hidden text-sm font-bold ${style.text}`}>{deptTotal}</span>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </div>

      {/* Grade rows */}
      {expanded && (
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {gradeData.map(row => (
            <div key={row.grade} className="px-5 py-3 flex items-center gap-4">
              <div className="w-28 flex-shrink-0">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{row.grade}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                  {row.total > 0 ? (
                    <div className="h-full flex rounded-full overflow-hidden">
                      <div className="bg-green-500 h-full transition-all duration-500" style={{ width: `${(row.approved / maxCount) * 100}%` }} />
                      <div className="bg-yellow-400 h-full transition-all duration-500" style={{ width: `${(row.pending / maxCount) * 100}%` }} />
                      <div className="bg-red-400 h-full transition-all duration-500"   style={{ width: `${(row.rejected / maxCount) * 100}%` }} />
                    </div>
                  ) : (
                    <div className="h-full bg-gray-200 dark:bg-gray-600 rounded-full w-full" />
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {row.total === 0 ? (
                  <span className="text-xs text-gray-300 dark:text-gray-600 w-16 text-right">No data</span>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Total</span>
                      <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white text-xs font-bold rounded-full">{row.total}</span>
                    </div>
                    {row.pending  > 0 && <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs font-bold rounded-full">{row.pending}</span>}
                    {row.approved > 0 && <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold rounded-full">{row.approved}</span>}
                    {row.rejected > 0 && <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-bold rounded-full">{row.rejected}</span>}
                  </>
                )}
              </div>
            </div>
          ))}
          {/* Subtotal */}
          <div className={`px-5 py-3 ${style.lightBg} flex items-center justify-between`}>
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{group.label} Total</span>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-gray-800 dark:text-white">{deptTotal}</span>
              <div className="flex items-center gap-1.5 text-xs">
                {deptPending  > 0 && <span className="text-yellow-600 dark:text-yellow-400 font-semibold">{deptPending} pending</span>}
                {deptApproved > 0 && <span className="text-green-600 dark:text-green-400 font-semibold">{deptApproved} approved</span>}
                {deptRejected > 0 && <span className="text-red-500 dark:text-red-400 font-semibold">{deptRejected} rejected</span>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Collapsible College program card showing per-year-level
 * enrollment counts with stacked progress bars.
 *
 * Usage:
 *   <ProgramEnrollmentCard program="BS Nursing" colorIdx={0} enrollments={filteredEnrollments} />
 */
export function ProgramEnrollmentCard({ program, colorIdx, enrollments }) {
  const [expanded, setExpanded] = useState(true)
  const style = PROG_COLORS[colorIdx % PROG_COLORS.length]

  const yearData = COLLEGE_YEAR_LEVELS.map(yr => {
    const key   = `${program} - ${yr}`
    const yrEnr = enrollments.filter(e => e.enrollment.gradeLevel === key)
    return {
      yr,
      total:    yrEnr.length,
      pending:  yrEnr.filter(e => e.status === 'pending').length,
      approved: yrEnr.filter(e => e.status === 'approved').length,
      rejected: yrEnr.filter(e => e.status === 'rejected').length,
    }
  })

  const progTotal    = yearData.reduce((s, r) => s + r.total, 0)
  const progPending  = yearData.reduce((s, r) => s + r.pending, 0)
  const progApproved = yearData.reduce((s, r) => s + r.approved, 0)
  const progRejected = yearData.reduce((s, r) => s + r.rejected, 0)
  const maxCount     = Math.max(...yearData.map(r => r.total), 1)

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-2xl shadow-sm border ${style.border} overflow-hidden`}>
      {/* Header */}
      <div onClick={() => setExpanded(e => !e)}
        className={`${style.lightBg} px-5 py-4 flex items-center justify-between gap-4 cursor-pointer select-none hover:opacity-90 transition`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-9 h-9 ${style.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
            <GraduationCap className="w-4 h-4 text-white" />
          </div>
          <div className="text-left min-w-0">
            <p className={`text-sm font-bold ${style.text} truncate`}>{program}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">College · {COLLEGE_YEAR_LEVELS.length} year levels</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="hidden sm:flex items-center gap-1.5">
            <span className="text-xs font-bold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 px-2.5 py-1 rounded-full shadow-sm">
              {progTotal} total
            </span>
            {progPending  > 0 && <span className="text-xs font-semibold text-yellow-700 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/40 px-2 py-1 rounded-full">{progPending} pending</span>}
            {progApproved > 0 && <span className="text-xs font-semibold text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/40 px-2 py-1 rounded-full">{progApproved} approved</span>}
          </div>
          <span className={`sm:hidden text-sm font-bold ${style.text}`}>{progTotal}</span>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </div>

      {/* Year rows */}
      {expanded && (
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {yearData.map(row => (
            <div key={row.yr} className="px-5 py-3 flex items-center gap-4">
              <div className="w-28 flex-shrink-0">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{row.yr}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                  {row.total > 0 ? (
                    <div className="h-full flex rounded-full overflow-hidden">
                      <div className="bg-green-500 h-full transition-all duration-500" style={{ width: `${(row.approved / maxCount) * 100}%` }} />
                      <div className="bg-yellow-400 h-full transition-all duration-500" style={{ width: `${(row.pending / maxCount) * 100}%` }} />
                      <div className="bg-red-400 h-full transition-all duration-500"   style={{ width: `${(row.rejected / maxCount) * 100}%` }} />
                    </div>
                  ) : (
                    <div className="h-full bg-gray-200 dark:bg-gray-600 rounded-full w-full" />
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {row.total === 0 ? (
                  <span className="text-xs text-gray-300 dark:text-gray-600">No data</span>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Total</span>
                      <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white text-xs font-bold rounded-full">{row.total}</span>
                    </div>
                    {row.pending  > 0 && <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs font-bold rounded-full">{row.pending}</span>}
                    {row.approved > 0 && <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold rounded-full">{row.approved}</span>}
                    {row.rejected > 0 && <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-bold rounded-full">{row.rejected}</span>}
                  </>
                )}
              </div>
            </div>
          ))}
          {/* Subtotal */}
          <div className={`px-5 py-3 ${style.lightBg} flex items-center justify-between`}>
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{program} Total</span>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-gray-800 dark:text-white">{progTotal}</span>
              <div className="flex items-center gap-1.5 text-xs">
                {progPending  > 0 && <span className="text-yellow-600 dark:text-yellow-400 font-semibold">{progPending} pending</span>}
                {progApproved > 0 && <span className="text-green-600 dark:text-green-400 font-semibold">{progApproved} approved</span>}
                {progRejected > 0 && <span className="text-red-500 dark:text-red-400 font-semibold">{progRejected} rejected</span>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// PAYMENT CARDS
// ────────────────────────────────────────────────────────────────

/** Internal grade/year-level row used inside payment cards */
function PaymentGradeRow({ label, payments }) {
  const revenue     = payments.reduce((s, p) => s + p.amountPaid, 0)
  const outstanding = payments.reduce((s, p) => s + p.balance, 0)
  const totalFee    = payments.reduce((s, p) => s + p.totalFee, 0)
  const paid        = payments.filter(p => p.status === 'paid').length
  const partial     = payments.filter(p => p.status === 'partial').length
  const overdue     = payments.filter(p => p.status === 'overdue').length
  const pending     = payments.filter(p => p.status === 'pending').length

  return (
    <div className="px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="w-32 flex-shrink-0">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{label}</span>
        <p className="text-xs text-gray-400 dark:text-gray-500">{payments.length} student{payments.length !== 1 ? 's' : ''}</p>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
            {totalFee > 0 ? (
              <div className="h-full flex rounded-full overflow-hidden">
                <div className="bg-green-500 h-full transition-all duration-500" style={{ width: `${(revenue / totalFee) * 100}%` }} />
                <div className="bg-gray-300 dark:bg-gray-600 h-full transition-all duration-500" style={{ width: `${(outstanding / totalFee) * 100}%` }} />
              </div>
            ) : (
              <div className="h-full w-full bg-gray-200 dark:bg-gray-600 rounded-full" />
            )}
          </div>
          <span className="text-xs text-gray-400 w-10 text-right flex-shrink-0">
            {totalFee > 0 ? Math.round((revenue / totalFee) * 100) : 0}%
          </span>
        </div>
      </div>
      <div className="flex items-center gap-4 flex-shrink-0 sm:w-64 justify-between">
        <div className="text-right">
          <p className="text-xs text-gray-400">Collected</p>
          <p className="text-sm font-bold text-green-600 dark:text-green-400">{php(revenue)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">Outstanding</p>
          <p className={`text-sm font-bold ${outstanding > 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-400'}`}>
            {outstanding > 0 ? php(outstanding) : '—'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {paid    > 0 && <span className="text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded-full">{paid} paid</span>}
        {partial > 0 && <span className="text-xs font-semibold bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-1.5 py-0.5 rounded-full">{partial} partial</span>}
        {overdue > 0 && <span className="text-xs font-semibold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-1.5 py-0.5 rounded-full">{overdue} overdue</span>}
        {pending > 0 && <span className="text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded-full">{pending} unpaid</span>}
      </div>
    </div>
  )
}

/**
 * Collapsible Basic Education department payment card.
 *
 * Usage:
 *   <DeptPaymentCard group={group} payments={filteredPayments} />
 *
 * group shape: { label: 'Elementary', options: ['Grade 1', ...] }
 * payments: mockPayments array (filtered by campus if needed)
 */
export function DeptPaymentCard({ group, payments }) {
  const [expanded, setExpanded] = useState(true)
  const style = DEPT_STYLES[group.label] || DEPT_STYLES['Elementary']

  const deptPayments    = payments.filter(p => group.options.includes(p.gradeLevel))
  const deptRevenue     = deptPayments.reduce((s, p) => s + p.amountPaid, 0)
  const deptOutstanding = deptPayments.reduce((s, p) => s + p.balance, 0)
  const deptTotalFee    = deptPayments.reduce((s, p) => s + p.totalFee, 0)
  const maxRevenue      = Math.max(...group.options.map(g =>
    payments.filter(p => p.gradeLevel === g).reduce((s, p) => s + p.amountPaid, 0)
  ), 1)

  if (deptPayments.length === 0) return null

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-2xl shadow-sm border ${style.border} overflow-hidden`}>
      <div onClick={() => setExpanded(e => !e)}
        className={`${style.light} px-5 py-4 flex items-center justify-between gap-4 cursor-pointer select-none hover:opacity-90 transition`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-9 h-9 ${style.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <div className="text-left min-w-0">
            <p className={`text-sm font-bold ${style.text}`}>{group.label}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{deptPayments.length} student{deptPayments.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="hidden sm:block text-right">
            <p className="text-xs text-gray-400">Collected</p>
            <p className="text-sm font-bold text-green-600 dark:text-green-400">{php(deptRevenue)}</p>
          </div>
          {deptOutstanding > 0 && (
            <div className="hidden sm:block text-right">
              <p className="text-xs text-gray-400">Outstanding</p>
              <p className="text-sm font-bold text-red-500 dark:text-red-400">{php(deptOutstanding)}</p>
            </div>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </div>

      {expanded && (
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {group.options.map(grade => {
            const gradePayments = payments.filter(p => p.gradeLevel === grade)
            if (gradePayments.length === 0) return null
            return <PaymentGradeRow key={grade} label={grade} payments={gradePayments} maxRevenue={maxRevenue} />
          })}
          {/* Dept total footer */}
          <div className={`px-5 py-3 ${style.light} flex flex-wrap items-center justify-between gap-2`}>
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{group.label} Total</span>
            <div className="flex items-center gap-4">
              <div className="text-right"><p className="text-xs text-gray-400">Total Fees</p><p className="text-sm font-bold text-gray-700 dark:text-gray-200">{php(deptTotalFee)}</p></div>
              <div className="text-right"><p className="text-xs text-gray-400">Collected</p><p className="text-sm font-bold text-green-600 dark:text-green-400">{php(deptRevenue)}</p></div>
              <div className="text-right"><p className="text-xs text-gray-400">Outstanding</p><p className={`text-sm font-bold ${deptOutstanding > 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-300'}`}>{deptOutstanding > 0 ? php(deptOutstanding) : '—'}</p></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Collapsible College program payment card.
 *
 * Usage:
 *   <ProgramPaymentCard program="BS Nursing" colorIdx={0} payments={filteredPayments} />
 */
export function ProgramPaymentCard({ program, colorIdx, payments }) {
  const [expanded, setExpanded] = useState(true)
  const style = PROG_COLORS[colorIdx % PROG_COLORS.length]

  const progPayments    = payments.filter(p => p.gradeLevel.startsWith(program))
  const progRevenue     = progPayments.reduce((s, p) => s + p.amountPaid, 0)
  const progOutstanding = progPayments.reduce((s, p) => s + p.balance, 0)
  const progTotalFee    = progPayments.reduce((s, p) => s + p.totalFee, 0)
  const maxRevenue      = Math.max(...COLLEGE_YEAR_LEVELS.map(yr =>
    payments.filter(p => p.gradeLevel === `${program} - ${yr}`).reduce((s, p) => s + p.amountPaid, 0)
  ), 1)

  if (progPayments.length === 0) return null

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-2xl shadow-sm border ${style.border} overflow-hidden`}>
      <div onClick={() => setExpanded(e => !e)}
        className={`${style.light} px-5 py-4 flex items-center justify-between gap-4 cursor-pointer select-none hover:opacity-90 transition`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-9 h-9 ${style.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
            <GraduationCap className="w-4 h-4 text-white" />
          </div>
          <div className="text-left min-w-0">
            <p className={`text-sm font-bold ${style.text} truncate`}>{program}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{progPayments.length} student{progPayments.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="hidden sm:block text-right">
            <p className="text-xs text-gray-400">Collected</p>
            <p className="text-sm font-bold text-green-600 dark:text-green-400">{php(progRevenue)}</p>
          </div>
          {progOutstanding > 0 && (
            <div className="hidden sm:block text-right">
              <p className="text-xs text-gray-400">Outstanding</p>
              <p className="text-sm font-bold text-red-500 dark:text-red-400">{php(progOutstanding)}</p>
            </div>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </div>

      {expanded && (
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {COLLEGE_YEAR_LEVELS.map(yr => {
            const key = `${program} - ${yr}`
            const yrPayments = payments.filter(p => p.gradeLevel === key)
            if (yrPayments.length === 0) return null
            return <PaymentGradeRow key={yr} label={yr} payments={yrPayments} maxRevenue={maxRevenue} />
          })}
          {/* Program total footer */}
          <div className={`px-5 py-3 ${style.light} flex flex-wrap items-center justify-between gap-2`}>
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{program} Total</span>
            <div className="flex items-center gap-4">
              <div className="text-right"><p className="text-xs text-gray-400">Total Fees</p><p className="text-sm font-bold text-gray-700 dark:text-gray-200">{php(progTotalFee)}</p></div>
              <div className="text-right"><p className="text-xs text-gray-400">Collected</p><p className="text-sm font-bold text-green-600 dark:text-green-400">{php(progRevenue)}</p></div>
              <div className="text-right"><p className="text-xs text-gray-400">Outstanding</p><p className={`text-sm font-bold ${progOutstanding > 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-300'}`}>{progOutstanding > 0 ? php(progOutstanding) : '—'}</p></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// TABLES
// ────────────────────────────────────────────────────────────────

/**
 * Recent enrollment applications table (last N rows).
 * Usage: <EnrollmentTable enrollments={filteredEnrollments} limit={5} accentColor="text-primary" />
 */
export function EnrollmentTable({ enrollments, limit = 10, accentColor = 'text-primary dark:text-red-400' }) {
  const rows = limit ? enrollments.slice(0, limit) : enrollments
  if (rows.length === 0) return (
    <p className="px-5 py-10 text-center text-sm text-gray-400">No enrollment data found.</p>
  )
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-700/50">
          <tr>
            {['Reference','Student','Level / Program','Type','Status','Date'].map(h => (
              <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {rows.map(e => (
            <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
              <td className={`px-4 py-3 font-mono text-xs ${accentColor} whitespace-nowrap`}>{e.referenceNumber}</td>
              <td className="px-4 py-3 font-medium text-gray-800 dark:text-white whitespace-nowrap">{e.student.firstName} {e.student.lastName}</td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">{e.enrollment.gradeLevel}</td>
              <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{e.enrollment.studentType}</td>
              <td className="px-4 py-3 whitespace-nowrap"><EnrollmentStatusPill status={e.status} /></td>
              <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">
                {new Date(e.submittedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Per-campus enrollment summary table.
 * campusStats shape: [{ name, enrollments, pending, approved, rejected }]
 * Usage: <CampusEnrollmentTable campusStats={campusStats} />
 */
export function CampusEnrollmentTable({ campusStats }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-700">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-700/50">
          <tr>{['Campus','Total','Awaiting Payment','Payment Received','Approved','Rejected','Approval Rate'].map(h => (
            <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
          ))}</tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {campusStats.map(c => {
            const rate = c.enrollments > 0 ? Math.round((c.approved / c.enrollments) * 100) : 0
            const paymentReceived = c.payment_received ?? 0
            return (
              <tr key={c.name} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                <td className="px-4 py-3 font-medium text-gray-800 dark:text-white whitespace-nowrap">{c.name}</td>
                <td className="px-4 py-3 font-bold text-gray-700 dark:text-gray-200">{c.enrollments}</td>
                <td className="px-4 py-3 text-yellow-600 dark:text-yellow-400 font-semibold">{c.pending}</td>
                <td className="px-4 py-3 text-blue-600 dark:text-blue-400 font-semibold">{paymentReceived}</td>
                <td className="px-4 py-3 text-green-600 dark:text-green-400 font-semibold">{c.approved}</td>
                <td className="px-4 py-3 text-red-500 dark:text-red-400 font-semibold">{c.rejected}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden min-w-[60px]">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: `${rate}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 w-9">{rate}%</span>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Per-campus student summary table.
 * campusStats shape: [{ name, students, basicStu, collegeStu }]
 * Usage: <CampusStudentTable campusStats={campusStats} stuTotal={total} />
 */
export function CampusStudentTable({ campusStats, stuTotal }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-700">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-700/50">
          <tr>{['Campus','Total','Basic Ed','College','Share'].map(h => (
            <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
          ))}</tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {campusStats.map(c => {
            const share = stuTotal > 0 ? Math.round((c.students / stuTotal) * 100) : 0
            return (
              <tr key={c.name} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                <td className="px-4 py-3 font-medium text-gray-800 dark:text-white whitespace-nowrap">{c.name}</td>
                <td className="px-4 py-3 font-bold text-gray-800 dark:text-white">{c.students}</td>
                <td className="px-4 py-3 text-emerald-600 dark:text-emerald-400">{c.basicStu}</td>
                <td className="px-4 py-3 text-blue-600 dark:text-blue-400">{c.collegeStu}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden min-w-[60px]">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${share}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 w-9">{share}%</span>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Per-campus payment summary table.
 * campusStats shape: [{ name, totalFee, revenue, outstanding, collectionRate, overdue }]
 * Usage: <CampusPaymentTable campusStats={campusStats} />
 */
export function CampusPaymentTable({ campusStats }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-700">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-700/50">
          <tr>{['Campus','Expected','Collected','Outstanding','Collection Rate','Overdue'].map(h => (
            <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
          ))}</tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {campusStats.map(c => (
            <tr key={c.name} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
              <td className="px-4 py-3 font-medium text-gray-800 dark:text-white whitespace-nowrap">{c.name}</td>
              <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">{php(c.totalFee)}</td>
              <td className="px-4 py-3 text-green-600 dark:text-green-400 font-semibold whitespace-nowrap">{php(c.revenue)}</td>
              <td className="px-4 py-3 text-red-500 dark:text-red-400 whitespace-nowrap">{php(c.outstanding)}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden min-w-[60px]">
                    <div className={`h-full rounded-full ${c.collectionRate >= 75 ? 'bg-green-500' : c.collectionRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${c.collectionRate}%` }} />
                  </div>
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 w-9">{c.collectionRate}%</span>
                </div>
              </td>
              <td className="px-4 py-3">
                {c.overdue > 0
                  ? <span className="text-xs font-semibold text-red-500">{c.overdue} accts</span>
                  : <span className="text-xs text-gray-300 dark:text-gray-600">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}