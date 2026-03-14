import { useState, useEffect } from 'react'
import {
  Search, FileText, CheckCircle, XCircle, Clock, Eye,
  Download, User, ChevronRight, GraduationCap, MapPin,
  BookOpen, X, Filter, Users, TrendingUp, ChevronDown, ChevronUp
} from 'lucide-react'
import { mockEnrollments } from '../data/mockEnrollments'
import { useAuth } from '../context/AuthContext'
import { exportToExcel, exportMultipleSheets } from '../utils/exportToExcel'
import { useLocation } from 'react-router-dom'
import { useToast, ToastContainer, ConfirmDialog, PageSkeleton, EmptyState } from '../components/UIComponents'
import { useAppConfig } from '../context/AppConfigContext'
import GradeLevelSelect from '../components/GradeLevelSelect'
import { useCampusFilter } from '../context/CampusFilterContext'
import { BASIC_ED_GROUPS, COLLEGE_YEAR_LEVELS } from '../config/appConfig'

// ── helpers ────────────────────────────────────────────────────────
function isBasicEd(g) {
  return g && (g.includes('Grade') || ['Nursery','Kindergarten','Preparatory'].some(x => g.includes(x)))
}
function isCollege(g) {
  return g && (g.includes('BS') || g.includes('Year'))
}

const DEPT_STYLES = {
  'Pre-Elementary': {
    bg: 'bg-emerald-600', lightBg: 'bg-emerald-50 dark:bg-emerald-900/20',
    border: 'border-emerald-300 dark:border-emerald-700',
    text: 'text-emerald-700 dark:text-emerald-300',
    badge: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
    bar: 'bg-emerald-500', dot: 'bg-emerald-400',
  },
  'Elementary': {
    bg: 'bg-blue-600', lightBg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-300 dark:border-blue-700',
    text: 'text-blue-700 dark:text-blue-300',
    badge: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
    bar: 'bg-blue-500', dot: 'bg-blue-400',
  },
  'Junior High School': {
    bg: 'bg-indigo-700', lightBg: 'bg-indigo-50 dark:bg-indigo-900/20',
    border: 'border-indigo-300 dark:border-indigo-700',
    text: 'text-indigo-700 dark:text-indigo-300',
    badge: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300',
    bar: 'bg-indigo-500', dot: 'bg-indigo-400',
  },
  'Senior High School': {
    bg: 'bg-primary', lightBg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-300 dark:border-red-700',
    text: 'text-primary dark:text-red-300',
    badge: 'bg-red-100 dark:bg-red-900/40 text-primary dark:text-red-300',
    bar: 'bg-primary', dot: 'bg-red-400',
  },
}
const PROG_COLORS = [
  { bg: 'bg-primary',       lightBg: 'bg-red-50 dark:bg-red-900/20',     border: 'border-red-300 dark:border-red-700',     text: 'text-primary dark:text-red-300',     badge: 'bg-red-100 dark:bg-red-900/40 text-primary dark:text-red-300',           bar: 'bg-primary'       },
  { bg: 'bg-secondary',     lightBg: 'bg-indigo-50 dark:bg-indigo-900/20', border: 'border-indigo-300 dark:border-indigo-700', text: 'text-indigo-700 dark:text-indigo-300', badge: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300', bar: 'bg-secondary'     },
  { bg: 'bg-light-secondary',lightBg: 'bg-blue-50 dark:bg-blue-900/20',  border: 'border-blue-300 dark:border-blue-700',   text: 'text-blue-700 dark:text-blue-300',   badge: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',       bar: 'bg-light-secondary'},
  { bg: 'bg-violet-600',    lightBg: 'bg-violet-50 dark:bg-violet-900/20',border: 'border-violet-300 dark:border-violet-700',text: 'text-violet-700 dark:text-violet-300',badge: 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300',bar: 'bg-violet-500'    },
]

function StatusBadge({ status }) {
  const map = {
    pending:  { cls: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: <Clock className="w-3 h-3"/>, label: 'Pending' },
    approved: { cls: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',   icon: <CheckCircle className="w-3 h-3"/>, label: 'Approved' },
    rejected: { cls: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',           icon: <XCircle className="w-3 h-3"/>, label: 'Rejected' },
  }
  const cfg = map[status] || map.pending
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>{cfg.icon}{cfg.label}</span>
}

// ── Department Card (Basic Ed) ─────────────────────────────────────
function DeptCard({ group, enrollments }) {
  const [expanded, setExpanded] = useState(true)
  const style = DEPT_STYLES[group.label] || DEPT_STYLES['Elementary']

  const gradeData = group.options.map(grade => {
    const gradeEnr = enrollments.filter(e => e.enrollment.gradeLevel === grade)
    return {
      grade,
      total:    gradeEnr.length,
      pending:  gradeEnr.filter(e => e.status === 'pending').length,
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
      {/* Card header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className={`w-full ${style.lightBg} px-5 py-4 flex items-center justify-between gap-4 hover:opacity-90 transition`}
      >
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

        {/* Summary pills */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="hidden sm:flex items-center gap-1.5">
            <span className="text-xs font-bold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 px-2.5 py-1 rounded-full shadow-sm">
              {deptTotal} total
            </span>
            {deptPending > 0 && (
              <span className="text-xs font-semibold text-yellow-700 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/40 px-2 py-1 rounded-full">
                {deptPending} pending
              </span>
            )}
            {deptApproved > 0 && (
              <span className="text-xs font-semibold text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/40 px-2 py-1 rounded-full">
                {deptApproved} approved
              </span>
            )}
          </div>
          {/* Mobile: just total */}
          <span className={`sm:hidden text-sm font-bold ${style.text}`}>{deptTotal}</span>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {/* Grade level rows */}
      {expanded && (
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {gradeData.map(row => (
            <div key={row.grade} className="px-5 py-3 flex items-center gap-4">
              {/* Grade name */}
              <div className="w-28 flex-shrink-0">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{row.grade}</span>
              </div>

              {/* Progress bar */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                    {row.total > 0 ? (
                      <div className="h-full flex rounded-full overflow-hidden">
                        <div className="bg-green-500 h-full transition-all duration-500" style={{ width: `${(row.approved / maxCount) * 100}%` }} />
                        <div className="bg-yellow-400 h-full transition-all duration-500" style={{ width: `${(row.pending / maxCount) * 100}%` }} />
                        <div className="bg-red-400 h-full transition-all duration-500" style={{ width: `${(row.rejected / maxCount) * 100}%` }} />
                      </div>
                    ) : (
                      <div className="h-full bg-gray-200 dark:bg-gray-600 rounded-full" style={{ width: '100%' }} />
                    )}
                  </div>
                </div>
              </div>

              {/* Count badges */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {row.total === 0 ? (
                  <span className="text-xs text-gray-300 dark:text-gray-600 w-16 text-right">No data</span>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Total</span>
                      <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white text-xs font-bold rounded-full">{row.total}</span>
                    </div>
                    {row.pending > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs font-bold rounded-full" title="Pending">{row.pending}</span>
                    )}
                    {row.approved > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold rounded-full" title="Approved">{row.approved}</span>
                    )}
                    {row.rejected > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-bold rounded-full" title="Rejected">{row.rejected}</span>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}

          {/* Dept subtotal row */}
          <div className={`px-5 py-3 ${style.lightBg} flex items-center justify-between`}>
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {group.label} Total
            </span>
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

// ── College Program Card ───────────────────────────────────────────
function ProgramCard({ program, colorIdx, enrollments }) {
  const [expanded, setExpanded] = useState(true)
  const style = PROG_COLORS[colorIdx % PROG_COLORS.length]

  const yearData = COLLEGE_YEAR_LEVELS.map(yr => {
    const key    = `${program} - ${yr}`
    const yrEnr  = enrollments.filter(e => e.enrollment.gradeLevel === key)
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
      {/* Card header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className={`w-full ${style.lightBg} px-5 py-4 flex items-center justify-between gap-4 hover:opacity-90 transition`}
      >
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
            {progPending > 0 && (
              <span className="text-xs font-semibold text-yellow-700 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/40 px-2 py-1 rounded-full">
                {progPending} pending
              </span>
            )}
            {progApproved > 0 && (
              <span className="text-xs font-semibold text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/40 px-2 py-1 rounded-full">
                {progApproved} approved
              </span>
            )}
          </div>
          <span className={`sm:hidden text-sm font-bold ${style.text}`}>{progTotal}</span>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {/* Year level rows */}
      {expanded && (
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {yearData.map(row => (
            <div key={row.yr} className="px-5 py-3 flex items-center gap-4">
              <div className="w-28 flex-shrink-0">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{row.yr}</span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                    {row.total > 0 ? (
                      <div className="h-full flex rounded-full overflow-hidden">
                        <div className="bg-green-500 h-full transition-all duration-500" style={{ width: `${(row.approved / maxCount) * 100}%` }} />
                        <div className="bg-yellow-400 h-full transition-all duration-500" style={{ width: `${(row.pending / maxCount) * 100}%` }} />
                        <div className="bg-red-400 h-full transition-all duration-500" style={{ width: `${(row.rejected / maxCount) * 100}%` }} />
                      </div>
                    ) : (
                      <div className="h-full w-full bg-gray-200 dark:bg-gray-600 rounded-full" />
                    )}
                  </div>
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
                    {row.pending > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs font-bold rounded-full" title="Pending">{row.pending}</span>
                    )}
                    {row.approved > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold rounded-full" title="Approved">{row.approved}</span>
                    )}
                    {row.rejected > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-bold rounded-full" title="Rejected">{row.rejected}</span>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}

          {/* Program subtotal */}
          <div className={`px-5 py-3 ${style.lightBg} flex items-center justify-between`}>
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {program} Total
            </span>
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

// ── Admin Overview ─────────────────────────────────────────────────
function AdminEnrollmentOverview({ enrollments, campusFilter, activeCampuses, currentSchoolYear, addToast }) {
  // Resolve which campus(es) to show
  const shownCampuses = campusFilter !== 'all'
    ? activeCampuses.filter(c => c.key === campusFilter)
    : activeCampuses

  // Shown campus — if one campus selected, focus on it; otherwise show all
  const isSingleCampus = shownCampuses.length === 1
  const selectedCampus = isSingleCampus ? shownCampuses[0] : null

  const getCampusEnr = (campusName) =>
    enrollments.filter(e => e.enrollment.campus === campusName)

  // Grand totals across shown campuses
  const allShownEnr = shownCampuses.flatMap(c => getCampusEnr(c.name))
  const grandTotal    = allShownEnr.length
  const grandPending  = allShownEnr.filter(e => e.status === 'pending').length
  const grandApproved = allShownEnr.filter(e => e.status === 'approved').length
  const grandRejected = allShownEnr.filter(e => e.status === 'rejected').length

  const handleExport = () => {
    const sheets = shownCampuses.flatMap(campus => {
      const campusEnr = getCampusEnr(campus.name)
      const result = []

      if (campus.hasBasicEd) {
        const rows = []
        BASIC_ED_GROUPS.forEach(group => {
          group.options.forEach(grade => {
            const gradeEnr = campusEnr.filter(e => e.enrollment.gradeLevel === grade)
            rows.push({
              Department: group.label, 'Grade Level': grade,
              Total: gradeEnr.length,
              Pending:  gradeEnr.filter(e => e.status === 'pending').length,
              Approved: gradeEnr.filter(e => e.status === 'approved').length,
              Rejected: gradeEnr.filter(e => e.status === 'rejected').length,
            })
          })
        })
        result.push({ data: rows, sheetName: `${campus.key}_BasicEd` })
      }

      if (campus.hasCollege && campus.collegePrograms?.length) {
        const rows = []
        campus.collegePrograms.forEach(prog => {
          COLLEGE_YEAR_LEVELS.forEach(yr => {
            const key = `${prog} - ${yr}`
            const yrEnr = campusEnr.filter(e => e.enrollment.gradeLevel === key)
            rows.push({
              Program: prog, 'Year Level': yr,
              Total: yrEnr.length,
              Pending:  yrEnr.filter(e => e.status === 'pending').length,
              Approved: yrEnr.filter(e => e.status === 'approved').length,
              Rejected: yrEnr.filter(e => e.status === 'rejected').length,
            })
          })
        })
        result.push({ data: rows, sheetName: `${campus.key}_College` })
      }

      return result
    })

    if (sheets.length) {
      exportMultipleSheets(sheets, `CSHC_Enrollment_${campusFilter !== 'all' ? campusFilter : 'All'}_${new Date().toISOString().split('T')[0]}`)
      addToast('Enrollment summary exported!', 'success')
    }
  }

  return (
    <div className="animate-fade-in space-y-6">

      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white">Enrollments</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {currentSchoolYear} ·{' '}
            {isSingleCampus
              ? `${selectedCampus.name} enrollment overview`
              : 'School-wide enrollment overview across all campuses'}
          </p>
        </div>
        <button onClick={handleExport}
          className="self-start sm:self-auto flex items-center gap-1.5 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium">
          <Download className="w-4 h-4" /> Export
        </button>
      </div>

      {/* ── Grand stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Total Enrollments', value: grandTotal,    border: 'border-primary',    sub: isSingleCampus ? selectedCampus.name : 'All Campuses',          cls: 'text-gray-400' },
          { label: 'Pending Review',    value: grandPending,  border: 'border-yellow-500', sub: grandTotal > 0 ? `${Math.round(grandPending/grandTotal*100)}% needs action` : '—', cls: 'text-yellow-600 dark:text-yellow-400' },
          { label: 'Approved',          value: grandApproved, border: 'border-green-500',  sub: grandTotal > 0 ? `${Math.round(grandApproved/grandTotal*100)}% approval rate` : '—', cls: 'text-green-600 dark:text-green-400' },
          { label: 'Rejected',          value: grandRejected, border: 'border-red-400',    sub: grandTotal > 0 ? `${Math.round(grandRejected/grandTotal*100)}% rejection rate` : '—', cls: 'text-red-500 dark:text-red-400' },
        ].map(({ label, value, border, sub, cls }) => (
          <div key={label} className={`bg-white dark:bg-gray-800 rounded-xl p-4 border-l-4 ${border} shadow-sm`}>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-white">{value}</p>
            <p className={`text-xs mt-1 font-medium ${cls}`}>{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Legend ── */}
      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
        <span className="font-medium">Progress bar legend:</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> Approved</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-400 inline-block" /> Pending</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-400 inline-block" /> Rejected</span>
      </div>

      {/* ── Per-campus sections ── */}
      {shownCampuses.map(campus => {
        const campusEnr = getCampusEnr(campus.name)
        const basicEnr  = campusEnr.filter(e => isBasicEd(e.enrollment.gradeLevel))
        const collegeEnr = campusEnr.filter(e => isCollege(e.enrollment.gradeLevel))

        return (
          <div key={campus.key} className="space-y-4">

            {/* Campus label — only show divider when showing multiple campuses */}
            {!isSingleCampus && (
              <div className="flex items-center gap-3 pt-2">
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-full">
                  <MapPin className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                  <span className="text-xs font-bold uppercase tracking-widest text-gray-600 dark:text-gray-300">
                    {campus.name}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">· {campusEnr.length} enrollments</span>
                </div>
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
              </div>
            )}

            {/* ── Basic Education section ── */}
            {campus.hasBasicEd && (
              <div className="space-y-3">
                {/* Section label */}
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
                    <BookOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h2 className="text-sm font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                    Basic Education
                  </h2>
                  <span className="text-xs text-gray-400 dark:text-gray-500">· {basicEnr.length} total enrollments</span>
                </div>

                {/* Department cards — 1 per dept group, 2 columns on lg */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {BASIC_ED_GROUPS.map(group => (
                    <DeptCard
                      key={group.label}
                      group={group}
                      enrollments={basicEnr}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ── College section ── */}
            {campus.hasCollege && campus.collegePrograms?.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-primary/10 dark:bg-primary/20 rounded-lg flex items-center justify-center">
                    <GraduationCap className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <h2 className="text-sm font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                    College
                  </h2>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    · {campus.collegePrograms.length} program{campus.collegePrograms.length !== 1 ? 's' : ''} · {collegeEnr.length} total enrollments
                  </span>
                </div>

                {/* Program cards */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {campus.collegePrograms.map((prog, idx) => (
                    <ProgramCard
                      key={prog}
                      program={prog}
                      colorIdx={idx}
                      enrollments={collegeEnr}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* No college notice for Bohol */}
            {!campus.hasCollege && (
              <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl text-sm text-gray-400 dark:text-gray-500">
                <GraduationCap className="w-4 h-4" />
                No college department at this campus
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════════
export default function Enrollments() {
  const { user } = useAuth()
  const { activeCampuses, currentSchoolYear } = useAppConfig()
  const location = useLocation()
  const { toasts, addToast, removeToast } = useToast()
  const [enrollments, setEnrollments]           = useState(mockEnrollments)
  const [searchQuery, setSearchQuery]           = useState('')
  const [statusFilter, setStatusFilter]         = useState('all')
  const [timeFilter, setTimeFilter]             = useState('all')
  const [gradeLevelFilter, setGradeLevelFilter] = useState('all')
  const [selectedEnrollment, setSelectedEnrollment] = useState(null)
  const [showModal, setShowModal]               = useState(false)
  const [confirm, setConfirm]                   = useState({ open: false, type: null, id: null })
  const [actionLoading, setActionLoading]       = useState(false)
  const { campusFilter } = useCampusFilter()
  const [loading, setLoading] = useState(true)

  useEffect(() => { const t = setTimeout(() => setLoading(false), 700); return () => clearTimeout(t) }, [])
  useEffect(() => {
    setLoading(true); setGradeLevelFilter('all')
    const t = setTimeout(() => setLoading(false), 400)
    return () => clearTimeout(t)
  }, [campusFilter])

  useEffect(() => {
    if (location.state?.openEnrollment) {
      setSelectedEnrollment(location.state.openEnrollment); setShowModal(true)
      window.history.replaceState({}, '')
    }
  }, [location.state])

  const isCampusLocked = user?.role === 'registrar_college' || user?.role === 'registrar_basic'
  const effectiveCampusFilter = isCampusLocked ? user.campus : campusFilter

  if (loading) return <PageSkeleton title="Enrollments" />

  // ── Admin: full overview UI ─────────────────────────────────────
  if (user?.role === 'admin') {
    return (
      <>
        <AdminEnrollmentOverview
          enrollments={enrollments}
          campusFilter={campusFilter}
          activeCampuses={activeCampuses}
          currentSchoolYear={currentSchoolYear}
          addToast={addToast}
        />
        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </>
    )
  }

  // ── Non-admin: registrar list view ─────────────────────────────
  const roleFiltered = enrollments.filter(e => {
    if (user?.role === 'accounting') return false
    const g = e.enrollment.gradeLevel, c = e.enrollment.campus
    if (user?.role === 'registrar_basic') {
      return isBasicEd(g) && c === user.campus
    }
    if (user?.role === 'registrar_college') {
      return isCollege(g) && c === user.campus
    }
    return true
  })

  const filtered = roleFiltered.filter(e => {
    const name = `${e.student.firstName} ${e.student.lastName}`.toLowerCase()
    const matchSearch = name.includes(searchQuery.toLowerCase()) || e.referenceNumber.toLowerCase().includes(searchQuery.toLowerCase())
    const matchStatus = statusFilter === 'all' || e.status === statusFilter
    const matchCampus = effectiveCampusFilter === 'all' || e.enrollment.campus.includes(effectiveCampusFilter)
    const matchGrade  = gradeLevelFilter === 'all' || e.enrollment.gradeLevel.includes(gradeLevelFilter)
    let matchTime = true
    if (timeFilter !== 'all') {
      const d = new Date(e.submittedDate), now = new Date()
      if (timeFilter === 'today') matchTime = d.toDateString() === now.toDateString()
      if (timeFilter === 'week')  matchTime = d >= new Date(now - 7 * 86400000)
      if (timeFilter === 'month') matchTime = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }
    return matchSearch && matchStatus && matchCampus && matchGrade && matchTime
  })

  const stats = {
    total: roleFiltered.length, pending: roleFiltered.filter(e=>e.status==='pending').length,
    approved: roleFiltered.filter(e=>e.status==='approved').length, rejected: roleFiltered.filter(e=>e.status==='rejected').length,
  }

  const handleApprove = (id) => setConfirm({ open: true, type: 'approve', id })
  const handleReject  = (id) => setConfirm({ open: true, type: 'reject',  id })
  const confirmAction = () => {
    setActionLoading(true)
    setTimeout(() => {
      setEnrollments(prev => prev.map(e => e.id === confirm.id ? { ...e, status: confirm.type === 'approve' ? 'approved' : 'rejected' } : e))
      if (selectedEnrollment?.id === confirm.id) setSelectedEnrollment(prev => ({ ...prev, status: confirm.type === 'approve' ? 'approved' : 'rejected' }))
      addToast(confirm.type === 'approve' ? 'Enrollment approved!' : 'Enrollment rejected.', confirm.type === 'approve' ? 'success' : 'error')
      setConfirm({ open: false, type: null, id: null }); setActionLoading(false)
    }, 800)
  }

  const handleExport = () => {
    const data = filtered.map(e => ({
      'Reference #': e.referenceNumber, 'Student Name': `${e.student.firstName} ${e.student.lastName}`,
      'Email': e.student.email, 'Campus': e.enrollment.campus,
      'Grade / Program': e.enrollment.gradeLevel, 'Student Type': e.enrollment.studentType,
      'School Year': e.enrollment.schoolYear, 'Status': e.status.toUpperCase(),
      'Date Submitted': new Date(e.submittedDate).toLocaleDateString(),
    }))
    exportToExcel(data, `Enrollments_${new Date().toISOString().split('T')[0]}`, 'Enrollments')
    addToast(`Exported ${data.length} records!`, 'success')
  }

  const hasFilters = searchQuery || statusFilter !== 'all' || timeFilter !== 'all' || gradeLevelFilter !== 'all'
  const clearFilters = () => { setSearchQuery(''); setStatusFilter('all'); setTimeFilter('all'); setGradeLevelFilter('all') }
  const fmtDate = (d) => new Date(d).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white">
            {user?.role === 'registrar_college' ? 'College Enrollments' : 'Basic Ed Enrollments'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Review and manage enrollment applications</p>
        </div>
      </div>

      {isCampusLocked && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${user?.role === 'registrar_basic' ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' : 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800'}`}>
          <MapPin className={`w-4 h-4 flex-shrink-0 ${user?.role === 'registrar_basic' ? 'text-emerald-600' : 'text-purple-600'}`} />
          <div>
            <p className={`text-sm font-semibold ${user?.role === 'registrar_basic' ? 'text-emerald-800 dark:text-emerald-200' : 'text-purple-800 dark:text-purple-200'}`}>
              Viewing: {user.campus} — {user?.role === 'registrar_basic' ? 'Basic Education' : 'College Department'}
            </p>
            <p className={`text-xs ${user?.role === 'registrar_basic' ? 'text-emerald-600 dark:text-emerald-400' : 'text-purple-600 dark:text-purple-400'}`}>
              Showing enrollments for your assigned campus only
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label:'Total Enrollments', value:stats.total,    border:'border-primary',    sub:'All submissions',     cls:'text-gray-400' },
          { label:'Pending Review',    value:stats.pending,  border:'border-yellow-500', sub:stats.total>0?`${Math.round(stats.pending/stats.total*100)}% of total`:'—', cls:'text-yellow-600 dark:text-yellow-400' },
          { label:'Approved',          value:stats.approved, border:'border-green-500',  sub:stats.total>0?`${Math.round(stats.approved/stats.total*100)}% approval rate`:'—', cls:'text-green-600 dark:text-green-400' },
          { label:'Rejected',          value:stats.rejected, border:'border-red-400',    sub:stats.total>0?`${Math.round(stats.rejected/stats.total*100)}% rejection rate`:'—', cls:'text-red-500 dark:text-red-400' },
        ].map(({ label, value, border, sub, cls }) => (
          <div key={label} className={`bg-white dark:bg-gray-800 rounded-xl p-4 border-l-4 ${border} shadow-sm`}>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-white">{value}</p>
            <p className={`text-xs mt-1 font-medium ${cls}`}>{sub}</p>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search by name or reference number…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-primary outline-none transition" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-primary outline-none">
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <select value={timeFilter} onChange={e => setTimeFilter(e.target.value)}
            className="px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-primary outline-none">
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
          <div>
            <GradeLevelSelect value={gradeLevelFilter} onChange={setGradeLevelFilter}
              campusFilter={isCampusLocked ? (activeCampuses.find(c => c.name === user.campus)?.key || 'all') : effectiveCampusFilter}
              userRole={user?.role} />
          </div>
          <div className="flex gap-2">
            {hasFilters && <button onClick={clearFilters} className="flex-1 px-3 py-2.5 text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition">Clear</button>}
            <button onClick={handleExport} className="flex-1 px-3 py-2.5 text-sm bg-primary text-white rounded-lg hover:bg-accent-burgundy transition flex items-center justify-center gap-1.5">
              <Download className="w-4 h-4" /> Export
            </button>
          </div>
        </div>
        {hasFilters && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1"><Filter className="w-3 h-3"/>Filters:</span>
            {searchQuery              && <Pill label={`"${searchQuery}"`}  onRemove={() => setSearchQuery('')} />}
            {statusFilter!=='all'     && <Pill label={statusFilter}         onRemove={() => setStatusFilter('all')} />}
            {timeFilter!=='all'       && <Pill label={timeFilter}           onRemove={() => setTimeFilter('all')} />}
            {gradeLevelFilter!=='all' && <Pill label={gradeLevelFilter}     onRemove={() => setGradeLevelFilter('all')} />}
            <button onClick={clearFilters} className="text-xs text-primary hover:text-accent-burgundy font-medium transition">Clear all</button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Showing <span className="font-semibold text-gray-700 dark:text-gray-300">{filtered.length}</span> of <span className="font-semibold">{roleFiltered.length}</span> enrollment{roleFiltered.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        {filtered.length === 0 ? <EmptyState type={hasFilters ? 'search' : 'enrollments'} onClear={hasFilters ? clearFilters : undefined} /> : (
          <>
            <ul className="md:hidden divide-y divide-gray-100 dark:divide-gray-700">
              {filtered.map(e => (
                <li key={e.id}>
                  <button onClick={() => { setSelectedEnrollment(e); setShowModal(true) }}
                    className="w-full text-left px-4 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition flex items-start gap-3">
                    <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"><User className="w-4 h-4 text-primary" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-gray-800 dark:text-white">{e.student.firstName} {e.student.lastName}</span>
                        <StatusBadge status={e.status} />
                      </div>
                      <p className="text-xs font-mono text-primary dark:text-red-400 mb-1">{e.referenceNumber}</p>
                      <div className="flex flex-wrap gap-x-2 text-xs text-gray-500 dark:text-gray-400">
                        <span>{e.enrollment.gradeLevel}</span><span>•</span><span>{e.enrollment.campus.replace(' Campus','')}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    {['Reference','Student Name','Campus','Grade / Program','Date Submitted','Status','Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filtered.map(e => (
                    <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-4 py-3 text-sm font-mono font-medium text-primary dark:text-red-400 whitespace-nowrap">{e.referenceNumber}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="text-sm font-medium text-gray-800 dark:text-white">{e.student.firstName} {e.student.lastName}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{e.student.email}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">{e.enrollment.campus}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">{e.enrollment.gradeLevel}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{fmtDate(e.submittedDate)}</td>
                      <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={e.status} /></td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button onClick={() => { setSelectedEnrollment(e); setShowModal(true) }}
                            className="inline-flex items-center gap-1 text-sm text-primary dark:text-red-400 hover:text-accent-burgundy font-medium transition">
                            <Eye className="w-4 h-4" /> View
                          </button>
                          {e.status === 'pending' && (
                            <>
                              <button onClick={() => handleApprove(e.id)} className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-200 transition font-medium">Approve</button>
                              <button onClick={() => handleReject(e.id)}  className="text-xs px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 transition font-medium">Reject</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Detail modal */}
      {showModal && selectedEnrollment && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-[9999] p-0 sm:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-3xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0"><FileText className="w-5 h-5 text-primary" /></div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-gray-800 dark:text-white truncate">{selectedEnrollment.student.firstName} {selectedEnrollment.student.lastName}</h2>
                  <p className="text-xs font-mono text-primary dark:text-red-400">{selectedEnrollment.referenceNumber}</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={selectedEnrollment.status} />
                <span className="text-xs text-gray-500 dark:text-gray-400">Submitted: {fmtDate(selectedEnrollment.submittedDate)}</span>
              </div>
              <InfoSection title="Enrollment Details" icon={<GraduationCap className="w-4 h-4"/>}>
                <InfoGrid fields={[['Campus', selectedEnrollment.enrollment.campus],['Grade / Program', selectedEnrollment.enrollment.gradeLevel],['Student Type', selectedEnrollment.enrollment.studentType],['School Year', selectedEnrollment.enrollment.schoolYear]]} />
              </InfoSection>
              <InfoSection title="Student Information" icon={<User className="w-4 h-4"/>}>
                <InfoGrid fields={[['Full Name', `${selectedEnrollment.student.firstName} ${selectedEnrollment.student.middleName} ${selectedEnrollment.student.lastName}`, true],['Birthdate / Age', `${new Date(selectedEnrollment.student.birthDate).toLocaleDateString()} (${selectedEnrollment.student.age} yrs)`],['Gender', selectedEnrollment.student.gender],['Religion', selectedEnrollment.student.religion],['Nationality', selectedEnrollment.student.nationality],['Contact', selectedEnrollment.student.contactNumber],['Email', selectedEnrollment.student.email, true],['Address', selectedEnrollment.student.address, true]]} />
              </InfoSection>
              <InfoSection title="Parents / Guardian" icon={<User className="w-4 h-4"/>}>
                <div className="space-y-3">
                  {[['Father', selectedEnrollment.father],['Mother', selectedEnrollment.mother],['Guardian', selectedEnrollment.guardian]].map(([lbl, p]) => p && p.name && p.name !== 'N/A' && (
                    <div key={lbl}>
                      <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">{lbl}</p>
                      <InfoGrid fields={[['Name', p.name],['Contact', p.contactNumber],['Occupation', p.occupation || '—']]} />
                    </div>
                  ))}
                </div>
              </InfoSection>
              <InfoSection title="Previous School" icon={<BookOpen className="w-4 h-4"/>}>
                <InfoGrid fields={Object.entries(selectedEnrollment.previousSchool).map(([k, v]) => [k.replace(/([A-Z])/g,' $1').replace(/^./,s=>s.toUpperCase()), v])} />
              </InfoSection>
            </div>
            <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center gap-3 flex-shrink-0">
              <button onClick={() => setShowModal(false)} className="px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition font-medium">Close</button>
              {selectedEnrollment.status === 'pending' && (
                <div className="flex gap-2">
                  <button onClick={() => handleReject(selectedEnrollment.id)} className="flex-1 sm:flex-none px-5 py-2.5 text-sm bg-red-600 text-white rounded-xl hover:bg-red-700 transition flex items-center justify-center gap-2 font-medium"><XCircle className="w-4 h-4" /> Reject</button>
                  <button onClick={() => handleApprove(selectedEnrollment.id)} className="flex-1 sm:flex-none px-5 py-2.5 text-sm bg-green-600 text-white rounded-xl hover:bg-green-700 transition flex items-center justify-center gap-2 font-medium"><CheckCircle className="w-4 h-4" /> Approve</button>
                </div>
              )}
              {selectedEnrollment.status !== 'pending' && (
                <div className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 ${selectedEnrollment.status === 'approved' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>
                  {selectedEnrollment.status === 'approved' ? <><CheckCircle className="w-4 h-4" /> Enrollment Approved</> : <><XCircle className="w-4 h-4" /> Enrollment Rejected</>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog open={confirm.open}
        title={confirm.type === 'approve' ? 'Approve Enrollment' : 'Reject Enrollment'}
        message={confirm.type === 'approve' ? 'Are you sure you want to approve this enrollment?' : 'Are you sure you want to reject this enrollment?'}
        confirmLabel={confirm.type === 'approve' ? 'Approve' : 'Reject'}
        confirmClass={confirm.type === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
        loading={actionLoading} onConfirm={confirmAction}
        onCancel={() => setConfirm({ open: false, type: null, id: null })} />

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  )
}

function Pill({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary dark:bg-primary/20 dark:text-red-300 text-xs font-medium rounded-full">
      {label}<button onClick={onRemove} className="hover:text-accent-burgundy transition"><X className="w-3 h-3" /></button>
    </span>
  )
}
function InfoSection({ title, icon, children }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-700/40 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2 mb-3">{icon}{title}</h3>
      {children}
    </div>
  )
}
function InfoGrid({ fields, cols = 2 }) {
  const colCls = { 2:'sm:grid-cols-2', 3:'sm:grid-cols-3' }[cols] || 'sm:grid-cols-2'
  return (
    <div className={`grid grid-cols-1 ${colCls} gap-x-6 gap-y-2`}>
      {fields.map(([label, value, full]) => (
        <div key={label} className={full ? 'sm:col-span-full' : ''}>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{label}</p>
          <p className="text-sm font-medium text-gray-800 dark:text-white">{value || '—'}</p>
        </div>
      ))}
    </div>
  )
}