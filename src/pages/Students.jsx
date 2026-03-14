import { useState, useRef, useEffect } from 'react'
import { useReactToPrint } from 'react-to-print'
import {
  Search, Users, Eye, Printer, Download,
  GraduationCap, MapPin, BookOpen, X, ChevronRight,
  Clock, CheckCircle, XCircle, FileText
} from 'lucide-react'
import { Bar, Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend } from 'chart.js'
import { mockStudents } from '../data/mockStudents'
import { mockEnrollments } from '../data/mockEnrollments'
import { useAuth } from '../context/AuthContext'
import { exportToExcel, exportMultipleSheets } from '../utils/exportToExcel'
import PrintableStudent from '../components/PrintableStudent'
import { useLocation } from 'react-router-dom'
import { useToast, ToastContainer, PageSkeleton, EmptyState } from '../components/UIComponents'
import { useAppConfig } from '../context/AppConfigContext'
import GradeLevelSelect from '../components/GradeLevelSelect'
import { useCampusFilter } from '../context/CampusFilterContext'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend)

// ── Shared grade helpers ─────────────────────────────────────────────
const BASIC_GROUPS = [
  { label: 'Pre-Elementary', short: 'Pre-Elem', grades: ['Nursery','Kindergarten','Preparatory'],
    bg: 'bg-emerald-600', light: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300', bar: '#059669' },
  { label: 'Elementary', short: 'Elem', grades: ['Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6'],
    bg: 'bg-blue-600', light: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', bar: '#2563eb' },
  { label: 'Junior High School', short: 'JHS', grades: ['Grade 7','Grade 8','Grade 9','Grade 10'],
    bg: 'bg-secondary', light: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-300', bar: '#080c42' },
  { label: 'Senior High School', short: 'SHS', grades: ['Grade 11','Grade 12'],
    bg: 'bg-primary', light: 'bg-red-100 dark:bg-red-900/30', text: 'text-primary dark:text-red-300', bar: '#750014' },
]
const YEAR_LEVELS = ['1st Year','2nd Year','3rd Year','4th Year']

function isBasicEd(g) { return g.includes('Grade') || ['Nursery','Kindergarten','Preparatory'].some(x => g.includes(x)) }
function isCollege(g) { return g.includes('BS') || g.includes('Year') }

const chartOpts = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { labels: { color: '#9ca3af', font: { size: 11 } } } },
  scales: { x: { ticks: { color: '#9ca3af' }, grid: { color: '#374151' } }, y: { ticks: { color: '#9ca3af' }, grid: { color: '#374151' } } },
}
const pieOpts = { ...chartOpts, scales: undefined, plugins: { legend: { position: 'bottom', labels: { color: '#9ca3af', padding: 12 } } } }

function StatusDot({ status }) {
  const map = {
    pending:  { cls: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: <Clock className="w-3 h-3" />, label: 'Pending' },
    approved: { cls: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',   icon: <CheckCircle className="w-3 h-3" />, label: 'Approved' },
    rejected: { cls: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',           icon: <XCircle className="w-3 h-3" />, label: 'Rejected' },
  }
  const cfg = map[status] || map.pending
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>{cfg.icon}{cfg.label}</span>
}

// ── Per-campus Basic Ed block (mirrors registrar_basic dashboard) ────
function CampusBasicEdBlock({ campus, allStudents, allEnrollments, currentSchoolYear }) {
  const campusStudents    = allStudents.filter(s => s.academic.campus === campus.name && isBasicEd(s.academic.gradeLevel))
  const campusEnrollments = allEnrollments.filter(e => e.enrollment.campus === campus.name && isBasicEd(e.enrollment.gradeLevel))

  const groupStats = BASIC_GROUPS.map(group => ({
    ...group,
    total: campusStudents.filter(s => group.grades.includes(s.academic.gradeLevel)).length,
    byGrade: group.grades.reduce((acc, g) => {
      acc[g] = campusStudents.filter(s => s.academic.gradeLevel === g).length
      return acc
    }, {}),
  }))

  const enrollStats = {
    total:    campusEnrollments.length,
    pending:  campusEnrollments.filter(e => e.status === 'pending').length,
    approved: campusEnrollments.filter(e => e.status === 'approved').length,
    rejected: campusEnrollments.filter(e => e.status === 'rejected').length,
  }

  const groupBarData = {
    labels: BASIC_GROUPS.map(g => g.short),
    datasets: [{ label: 'Students', data: groupStats.map(g => g.total), backgroundColor: BASIC_GROUPS.map(g => g.bar), borderRadius: 6 }],
  }
  const enrollStatusData = {
    labels: ['Approved','Pending','Rejected'],
    datasets: [{ data: [enrollStats.approved, enrollStats.pending, enrollStats.rejected], backgroundColor: ['#10b981','#f59e0b','#ef4444'], borderWidth: 0 }],
  }

  return (
    <div className="space-y-4">
      {/* Campus identity card — emerald, same as registrar_basic */}
      <div className="bg-gradient-to-r from-emerald-700 to-emerald-500 rounded-2xl p-5 text-white shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <MapPin className="w-4 h-4 opacity-80" />
              <span className="text-sm font-medium opacity-80">Basic Education</span>
            </div>
            <h2 className="text-xl font-bold">{campus.name}</h2>
            <p className="text-sm opacity-70 mt-1">Basic Education Department · {currentSchoolYear}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-sm opacity-70">Grade levels</p>
            <p className="text-3xl font-bold">15</p>
            <p className="text-xs opacity-70 mt-0.5">Nursery → Grade 12</p>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Total Students',    value: campusStudents.length,  border: 'border-emerald-500', icon: <Users className="w-5 h-5 text-emerald-500"/>,       sub: 'All grade levels' },
          { label: 'Pending Review',    value: enrollStats.pending,    border: 'border-yellow-500',  icon: <Clock className="w-5 h-5 text-yellow-500"/>,        sub: `${enrollStats.total > 0 ? Math.round(enrollStats.pending/enrollStats.total*100) : 0}% of total` },
          { label: 'Approved',          value: enrollStats.approved,   border: 'border-green-500',   icon: <CheckCircle className="w-5 h-5 text-green-500"/>,   sub: `${enrollStats.total > 0 ? Math.round(enrollStats.approved/enrollStats.total*100) : 0}% approval rate` },
          { label: 'Total Enrollments', value: enrollStats.total,      border: 'border-blue-500',    icon: <FileText className="w-5 h-5 text-blue-500"/>,       sub: currentSchoolYear },
        ].map(({ label, value, border, icon, sub }) => (
          <div key={label} className={`bg-white dark:bg-gray-800 rounded-xl p-4 border-l-4 ${border} shadow-sm`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
              <div className="opacity-80">{icon}</div>
            </div>
            <p className="text-2xl font-bold text-gray-800 dark:text-white">{value}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* Department cards — identical layout to registrar_basic */}
      <div>
        <h2 className="text-base font-semibold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-emerald-600" /> Students by Department
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {groupStats.map((group) => {
            const maxVal = Math.max(...Object.values(group.byGrade), 1)
            return (
              <div key={group.label} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                <div className={`${group.bg} px-4 py-3 text-white`}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wider opacity-90">{group.label}</p>
                    <span className="text-2xl font-bold">{group.total}</span>
                  </div>
                </div>
                <div className="p-3 space-y-1.5">
                  {group.grades.map(g => {
                    const count = group.byGrade[g] || 0
                    return (
                      <div key={g} className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400 w-20 truncate flex-shrink-0">{g}</span>
                        <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                          <div className={`h-full rounded-full ${group.bg} opacity-80`} style={{ width: count > 0 ? `${(count/maxVal)*100}%` : '0%' }} />
                        </div>
                        <span className={`text-xs font-bold w-4 text-right ${count > 0 ? group.text : 'text-gray-300 dark:text-gray-600'}`}>
                          {count || '—'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">Students by Department</h3>
          <div style={{ height: 220 }}>
            <Bar data={groupBarData} options={{ ...chartOpts, plugins: { legend: { display: false } }, scales: { ...chartOpts.scales, y: { ...chartOpts.scales.y, beginAtZero: true } } }} />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">Enrollment Status</h3>
          {enrollStats.total > 0 ? (
            <div style={{ height: 220 }} className="flex items-center justify-center">
              <Doughnut data={enrollStatusData} options={pieOpts} />
            </div>
          ) : (
            <div className="flex items-center justify-center h-56 text-sm text-gray-400">No enrollment data</div>
          )}
        </div>
      </div>

      {/* Recent enrollments table — same as registrar_basic */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-600" /> Recent Enrollment Applications
          </h3>
          <span className="text-xs text-gray-400">{campusEnrollments.length} total</span>
        </div>
        {campusEnrollments.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-gray-400">No enrollment applications found for this campus.</p>
        ) : (
          <>
            {/* Mobile */}
            <ul className="md:hidden divide-y divide-gray-100 dark:divide-gray-700">
              {campusEnrollments.slice(0, 8).map(e => (
                <li key={e.id} className="px-4 py-3 flex items-start gap-3">
                  <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <GraduationCap className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{e.student.firstName} {e.student.lastName}</p>
                      <StatusDot status={e.status} />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{e.enrollment.gradeLevel} · {e.enrollment.studentType}</p>
                    <p className="text-xs font-mono text-emerald-600 dark:text-emerald-400">{e.referenceNumber}</p>
                  </div>
                </li>
              ))}
            </ul>
            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    {['Reference','Student Name','Grade Level','Student Type','Status','Date Submitted'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {campusEnrollments.map(e => (
                    <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-4 py-3 font-mono text-xs text-emerald-600 dark:text-emerald-400 whitespace-nowrap">{e.referenceNumber}</td>
                      <td className="px-4 py-3 font-medium text-gray-800 dark:text-white whitespace-nowrap">{e.student.firstName} {e.student.lastName}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">{e.enrollment.gradeLevel}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{e.enrollment.studentType}</td>
                      <td className="px-4 py-3 whitespace-nowrap"><StatusDot status={e.status} /></td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">
                        {new Date(e.submittedDate).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Per-campus College block (mirrors registrar_college dashboard) ────
function CampusCollegeBlock({ campus, allStudents, allEnrollments, currentSchoolYear }) {
  const programs          = campus.collegePrograms || []
  const campusStudents    = allStudents.filter(s => s.academic.campus === campus.name && isCollege(s.academic.gradeLevel))
  const campusEnrollments = allEnrollments.filter(e => e.enrollment.campus === campus.name && isCollege(e.enrollment.gradeLevel))

  const programStats = programs.reduce((acc, prog) => {
    const students = campusStudents.filter(s => s.academic.gradeLevel.startsWith(prog))
    acc[prog] = {
      total: students.length,
      byYear: YEAR_LEVELS.reduce((y, yr) => {
        y[yr] = students.filter(s => s.academic.gradeLevel === `${prog} - ${yr}`).length
        return y
      }, {}),
    }
    return acc
  }, {})

  const enrollStats = {
    total:    campusEnrollments.length,
    pending:  campusEnrollments.filter(e => e.status === 'pending').length,
    approved: campusEnrollments.filter(e => e.status === 'approved').length,
    rejected: campusEnrollments.filter(e => e.status === 'rejected').length,
  }

  const progColors = ['bg-primary','bg-secondary','bg-light-secondary','bg-blue-500']

  const programBarData = {
    labels: programs,
    datasets: [
      { label: '1st Year', data: programs.map(p => programStats[p]?.byYear['1st Year'] || 0), backgroundColor: '#750014' },
      { label: '2nd Year', data: programs.map(p => programStats[p]?.byYear['2nd Year'] || 0), backgroundColor: '#080c42' },
      { label: '3rd Year', data: programs.map(p => programStats[p]?.byYear['3rd Year'] || 0), backgroundColor: '#202682' },
      { label: '4th Year', data: programs.map(p => programStats[p]?.byYear['4th Year'] || 0), backgroundColor: '#6b7280' },
    ],
  }
  const enrollStatusData = {
    labels: ['Approved','Pending','Rejected'],
    datasets: [{ data: [enrollStats.approved, enrollStats.pending, enrollStats.rejected], backgroundColor: ['#10b981','#f59e0b','#ef4444'], borderWidth: 0 }],
  }

  if (programs.length === 0) return null

  return (
    <div className="space-y-4">
      {/* Campus identity card — dark blue, same as registrar_college */}
      <div className="bg-gradient-to-r from-secondary to-light-secondary rounded-2xl p-5 text-white shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <MapPin className="w-4 h-4 opacity-80" />
              <span className="text-sm font-medium opacity-80">College Department</span>
            </div>
            <h2 className="text-xl font-bold">{campus.name}</h2>
            <p className="text-sm opacity-70 mt-1">College Department · {currentSchoolYear}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-sm opacity-70">Programs offered</p>
            <p className="text-3xl font-bold">{programs.length}</p>
            <div className="flex flex-wrap justify-end gap-1 mt-2">
              {programs.map(p => <span key={p} className="text-xs bg-white/20 px-2 py-0.5 rounded-full">{p}</span>)}
            </div>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Total Students',    value: campusStudents.length,  border: 'border-primary',     icon: <Users className="w-5 h-5 text-primary"/>,            sub: 'All programs combined' },
          { label: 'Pending Review',    value: enrollStats.pending,    border: 'border-yellow-500',  icon: <Clock className="w-5 h-5 text-yellow-500"/>,         sub: `${enrollStats.total > 0 ? Math.round(enrollStats.pending/enrollStats.total*100) : 0}% of total` },
          { label: 'Approved',          value: enrollStats.approved,   border: 'border-green-500',   icon: <CheckCircle className="w-5 h-5 text-green-500"/>,    sub: `${enrollStats.total > 0 ? Math.round(enrollStats.approved/enrollStats.total*100) : 0}% approval rate` },
          { label: 'Total Enrollments', value: enrollStats.total,      border: 'border-blue-500',    icon: <FileText className="w-5 h-5 text-blue-500"/>,        sub: currentSchoolYear },
        ].map(({ label, value, border, icon, sub }) => (
          <div key={label} className={`bg-white dark:bg-gray-800 rounded-xl p-4 border-l-4 ${border} shadow-sm`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
              <div className="opacity-80">{icon}</div>
            </div>
            <p className="text-2xl font-bold text-gray-800 dark:text-white">{value}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* Program cards — identical to registrar_college */}
      <div>
        <h2 className="text-base font-semibold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-primary" /> Program Overview
        </h2>
        <div className={`grid gap-4 ${programs.length === 1 ? 'grid-cols-1 max-w-sm' : programs.length === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
          {programs.map((prog, idx) => {
            const pd = programStats[prog]
            const color = progColors[idx % progColors.length]
            const maxCount = Math.max(...YEAR_LEVELS.map(y => pd.byYear[y]), 1)
            return (
              <div key={prog} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                <div className={`${color} px-5 py-4 text-white`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium opacity-80 uppercase tracking-wider">Program</p>
                      <h3 className="text-lg font-bold leading-tight mt-0.5">{prog}</h3>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold">{pd.total}</p>
                      <p className="text-xs opacity-80">students</p>
                    </div>
                  </div>
                </div>
                <div className="p-4 space-y-2">
                  {YEAR_LEVELS.map(yr => (
                    <div key={yr} className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 dark:text-gray-400 w-14 flex-shrink-0">{yr}</span>
                      <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                        <div className={`h-full rounded-full ${color} transition-all duration-500`}
                          style={{ width: maxCount > 0 ? `${(pd.byYear[yr] / maxCount) * 100}%` : '0%' }} />
                      </div>
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 w-5 text-right">{pd.byYear[yr] || 0}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">Students by Program & Year</h3>
          <div style={{ height: 240 }}>
            <Bar data={programBarData} options={{ ...chartOpts, scales: { ...chartOpts.scales, x: { ...chartOpts.scales.x, stacked: false }, y: { ...chartOpts.scales.y, stacked: false, beginAtZero: true } } }} />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">Enrollment Status</h3>
          {enrollStats.total > 0 ? (
            <div style={{ height: 240 }} className="flex items-center justify-center">
              <Doughnut data={enrollStatusData} options={pieOpts} />
            </div>
          ) : (
            <div className="flex items-center justify-center h-60 text-sm text-gray-400">No enrollment data</div>
          )}
        </div>
      </div>

      {/* Recent enrollments */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" /> Recent Enrollment Applications
          </h3>
          <span className="text-xs text-gray-400">{campusEnrollments.length} total</span>
        </div>
        {campusEnrollments.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-gray-400">No enrollment applications found for this campus.</div>
        ) : (
          <>
            {/* Mobile */}
            <ul className="md:hidden divide-y divide-gray-100 dark:divide-gray-700">
              {campusEnrollments.slice(0, 8).map(e => (
                <li key={e.id} className="px-4 py-3 flex items-start gap-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <GraduationCap className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{e.student.firstName} {e.student.lastName}</p>
                      <StatusDot status={e.status} />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{e.enrollment.gradeLevel} · {e.enrollment.studentType}</p>
                    <p className="text-xs font-mono text-primary dark:text-red-400">{e.referenceNumber}</p>
                  </div>
                </li>
              ))}
            </ul>
            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    {['Reference','Student Name','Program & Year','Type','Status','Date'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {campusEnrollments.map(e => (
                    <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-4 py-3 font-mono text-xs text-primary dark:text-red-400 whitespace-nowrap">{e.referenceNumber}</td>
                      <td className="px-4 py-3 font-medium text-gray-800 dark:text-white whitespace-nowrap">{e.student.firstName} {e.student.lastName}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">{e.enrollment.gradeLevel}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{e.enrollment.studentType}</td>
                      <td className="px-4 py-3 whitespace-nowrap"><StatusDot status={e.status} /></td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">
                        {new Date(e.submittedDate).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
export default function Students() {
  const { user } = useAuth()
  const { activeCampuses, currentSchoolYear } = useAppConfig()
  const location = useLocation()
  const { toasts, addToast, removeToast } = useToast()
  const [students]                              = useState(mockStudents)
  const [enrollments]                           = useState(mockEnrollments)
  const [searchQuery, setSearchQuery]           = useState('')
  const [statusFilter, setStatusFilter]         = useState('all')
  const [gradeLevelFilter, setGradeLevelFilter] = useState('all')
  const [selectedStudent, setSelectedStudent]   = useState(null)
  const [showModal, setShowModal]               = useState(false)
  const [studentToPrint, setStudentToPrint]     = useState(null)
  const printRef = useRef()
  const { campusFilter } = useCampusFilter()
  const [loading, setLoading] = useState(true)

  useEffect(() => { const t = setTimeout(() => setLoading(false), 700); return () => clearTimeout(t) }, [])
  useEffect(() => {
    setLoading(true); setGradeLevelFilter('all')
    const t = setTimeout(() => setLoading(false), 400)
    return () => clearTimeout(t)
  }, [campusFilter])

  useEffect(() => {
    if (location.state?.openStudent) {
      setSelectedStudent(location.state.openStudent); setShowModal(true)
      window.history.replaceState({}, '')
    }
  }, [location.state])

  const isCampusLocked = user?.role === 'registrar_college' || user?.role === 'registrar_basic'
  const effectiveCampusFilter = isCampusLocked ? user.campus : campusFilter

  const roleFiltered = students.filter(s => {
    if (user?.role === 'admin') return true
    const g = s.academic.gradeLevel, c = s.academic.campus
    if (user?.role === 'registrar_basic')   return isBasicEd(g) && c === user.campus
    if (user?.role === 'principal_basic')   return isBasicEd(g) && (user.campus === 'all' || c === user.campus)
    if (user?.role === 'registrar_college') return isCollege(g) && c === user.campus
    return true
  })

  const filtered = roleFiltered.filter(s => {
    const name = `${s.personal.firstName} ${s.personal.lastName}`.toLowerCase()
    return (
      (name.includes(searchQuery.toLowerCase()) || s.studentId.toLowerCase().includes(searchQuery.toLowerCase())) &&
      (statusFilter === 'all' || s.status === statusFilter) &&
      (effectiveCampusFilter === 'all' || s.academic.campus.includes(effectiveCampusFilter)) &&
      (gradeLevelFilter === 'all' || s.academic.gradeLevel.includes(gradeLevelFilter))
    )
  })

  const stats = {
    total:     roleFiltered.length,
    active:    roleFiltered.filter(s => s.status === 'active').length,
    graduated: roleFiltered.filter(s => s.status === 'graduated').length,
    inactive:  roleFiltered.filter(s => s.status === 'inactive').length,
  }

  const programBreakdown = user?.role === 'registrar_college'
    ? roleFiltered.reduce((acc, s) => {
        const program = s.academic.gradeLevel.split(' - ')[0]
        if (!acc[program]) acc[program] = { total: 0, byYear: {} }
        acc[program].total++
        const year = s.academic.gradeLevel.split(' - ')[1] || 'Unknown'
        acc[program].byYear[year] = (acc[program].byYear[year] || 0) + 1
        return acc
      }, {})
    : null

  const basicBreakdown = user?.role === 'registrar_basic'
    ? BASIC_GROUPS.map(group => ({
        ...group,
        total: roleFiltered.filter(s => group.grades.includes(s.academic.gradeLevel)).length,
        byGrade: group.grades.reduce((acc, g) => { acc[g] = roleFiltered.filter(s => s.academic.gradeLevel === g).length; return acc }, {}),
      }))
    : null

  const StatusBadge = ({ status }) => {
    const map = {
      active:    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      graduated: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      inactive:  'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    }
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[status] || map.inactive}`}>{status.charAt(0).toUpperCase()+status.slice(1)}</span>
  }

  const fmtDate = (d) => new Date(d).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' })
  const handlePrint = useReactToPrint({ contentRef: printRef, documentTitle: `Student_Profile_${studentToPrint?.studentId}`, onAfterPrint: () => setStudentToPrint(null) })
  const handlePrintClick = (s) => { setStudentToPrint(s); setTimeout(() => { if (printRef.current) handlePrint() }, 300) }

  const handleExport = () => {
    const data = filtered.map(s => ({
      'Student ID': s.studentId, 'Full Name': `${s.personal.firstName} ${s.personal.middleName} ${s.personal.lastName}`,
      'Email': s.personal.email, 'Contact': s.personal.contactNumber,
      'Campus': s.academic.campus, 'Program / Grade': s.academic.gradeLevel,
      'Section': s.academic.section, 'Year Level': s.academic.yearLevel,
      'School Year': s.academic.schoolYear, 'Status': s.status.toUpperCase(),
      'Enrolled': new Date(s.enrollmentDate).toLocaleDateString(),
    }))
    const campusTag = isCampusLocked ? user.campus.replace(/\s+/g,'_') + '_' : ''
    const deptTag   = user?.role === 'registrar_college' ? 'College_' : user?.role === 'registrar_basic' ? 'BasicEd_' : ''
    exportToExcel(data, `Students_${campusTag}${deptTag}${new Date().toISOString().split('T')[0]}`, 'Students')
    addToast(`Exported ${data.length} student records!`, 'success')
  }

  const hasFilters = searchQuery || statusFilter !== 'all' || gradeLevelFilter !== 'all'
  const clearFilters = () => { setSearchQuery(''); setStatusFilter('all'); setGradeLevelFilter('all') }
  const campusKeyForGradeSelect = isCampusLocked ? (activeCampuses.find(c => c.name === user.campus)?.key || 'all') : effectiveCampusFilter

  if (loading) return <PageSkeleton title="Students" />

  // ══════════════════════════════════════════════════════════════════
  // ADMIN: per-campus registrar-style blocks
  // ══════════════════════════════════════════════════════════════════
  if (user?.role === 'admin') {
    const shownCampuses = campusFilter !== 'all'
      ? activeCampuses.filter(c => c.key === campusFilter)
      : activeCampuses

    const handleAdminExport = () => {
      exportMultipleSheets(
        activeCampuses.map(campus => ({
          data: students.filter(s => s.academic.campus === campus.name).map(s => ({
            'Student ID': s.studentId,
            'Name': `${s.personal.firstName} ${s.personal.lastName}`,
            'Grade/Program': s.academic.gradeLevel,
            'Section': s.academic.section,
            'Department': isBasicEd(s.academic.gradeLevel) ? 'Basic Ed' : 'College',
            'Status': s.status,
          })),
          sheetName: campus.key,
        })),
        `CSHC_All_Campuses_Students_${new Date().toISOString().split('T')[0]}`
      )
    }

    return (
      <div className="animate-fade-in space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white">Students</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {currentSchoolYear} · School-wide student overview across all campuses
            </p>
          </div>
          <button onClick={handleAdminExport}
            className="self-start sm:self-auto flex items-center gap-1.5 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium">
            <Download className="w-4 h-4" /> Export All
          </button>
        </div>

        {/* One block per campus, each split into Basic Ed + College */}
        {shownCampuses.map((campus, i) => (
          <div key={campus.key} className="space-y-6">
            {/* Campus divider label */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
              <span className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 px-2">
                {campus.name}
              </span>
              <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
            </div>

            {campus.hasBasicEd && (
              <CampusBasicEdBlock
                campus={campus}
                allStudents={students}
                allEnrollments={enrollments}
                currentSchoolYear={currentSchoolYear}
              />
            )}

            {campus.hasCollege && campus.collegePrograms?.length > 0 && (
              <CampusCollegeBlock
                campus={campus}
                allStudents={students}
                allEnrollments={enrollments}
                currentSchoolYear={currentSchoolYear}
              />
            )}
          </div>
        ))}

        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════
  // NON-ADMIN ROLES
  // ══════════════════════════════════════════════════════════════════
  return (
    <div className="animate-fade-in space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white">
          {user?.role === 'registrar_college' ? 'College Students' : user?.role === 'registrar_basic' ? 'Basic Ed Students' : 'Students'}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {user?.role === 'registrar_college' ? 'All enrolled college students for your campus'
            : user?.role === 'registrar_basic' ? 'All enrolled basic education students for your campus'
            : 'View and manage enrolled students'}
        </p>
      </div>

      {isCampusLocked && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${user?.role === 'registrar_basic' ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' : 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800'}`}>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${user?.role === 'registrar_basic' ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-purple-100 dark:bg-purple-900/40'}`}>
            <MapPin className={`w-4 h-4 ${user?.role === 'registrar_basic' ? 'text-emerald-600 dark:text-emerald-400' : 'text-purple-600 dark:text-purple-400'}`} />
          </div>
          <div>
            <p className={`text-sm font-semibold ${user?.role === 'registrar_basic' ? 'text-emerald-800 dark:text-emerald-200' : 'text-purple-800 dark:text-purple-200'}`}>
              Viewing: {user.campus} — {user?.role === 'registrar_basic' ? 'Basic Education Department' : 'College Department'}
            </p>
            <p className={`text-xs ${user?.role === 'registrar_basic' ? 'text-emerald-600 dark:text-emerald-400' : 'text-purple-600 dark:text-purple-400'}`}>
              Showing {user?.role === 'registrar_basic' ? 'basic education' : 'college'} students from your assigned campus only
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Total Students', value: stats.total,     border: 'border-primary',   sub: isCampusLocked ? user.campus : (campusFilter !== 'all' ? activeCampuses.find(c=>c.key===campusFilter)?.name||campusFilter : 'All Campuses'), subCls: 'text-gray-400 dark:text-gray-500' },
          { label: 'Active',         value: stats.active,    border: 'border-green-500', sub: `${stats.total>0?Math.round(stats.active/stats.total*100):0}% of total`, subCls: 'text-green-600 dark:text-green-400' },
          { label: 'Graduated',      value: stats.graduated, border: 'border-blue-500',  sub: 'Completed studies',      subCls: 'text-blue-600 dark:text-blue-400' },
          { label: 'Inactive',       value: stats.inactive,  border: 'border-gray-400',  sub: 'Not currently enrolled', subCls: 'text-gray-500 dark:text-gray-400' },
        ].map(({ label, value, border, sub, subCls }) => (
          <div key={label} className={`bg-white dark:bg-gray-800 rounded-xl p-4 border-l-4 ${border} shadow-sm`}>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-white">{value}</p>
            <p className={`text-xs mt-1 ${subCls}`}>{sub}</p>
          </div>
        ))}
      </div>

      {programBreakdown && Object.keys(programBreakdown).length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Students by Program & Year Level</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Program</th>
                  {YEAR_LEVELS.map(yr => <th key={yr} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{yr}</th>)}
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {Object.entries(programBreakdown).map(([program, data]) => (
                  <tr key={program} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-5 py-3 font-medium text-gray-800 dark:text-white">{program}</td>
                    {YEAR_LEVELS.map(yr => (
                      <td key={yr} className="px-4 py-3">
                        {data.byYear[yr] ? <span className="inline-flex items-center justify-center w-7 h-7 bg-primary/10 dark:bg-primary/20 text-primary dark:text-red-300 text-xs font-bold rounded-full">{data.byYear[yr]}</span>
                          : <span className="text-gray-300 dark:text-gray-600">—</span>}
                      </td>
                    ))}
                    <td className="px-4 py-3"><span className="inline-flex items-center px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-bold rounded-full">{data.total}</span></td>
                  </tr>
                ))}
                <tr className="bg-gray-50 dark:bg-gray-700/50 font-semibold">
                  <td className="px-5 py-3 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">Total</td>
                  {YEAR_LEVELS.map(yr => <td key={yr} className="px-4 py-3 text-gray-700 dark:text-gray-200">{Object.values(programBreakdown).reduce((s, d) => s + (d.byYear[yr] || 0), 0) || '—'}</td>)}
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{Object.values(programBreakdown).reduce((s, d) => s + d.total, 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {basicBreakdown && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Students by Department & Grade Level</h2>
          </div>
          <div className="md:hidden p-4 grid grid-cols-2 gap-3">
            {basicBreakdown.map(group => (
              <div key={group.label} className="rounded-xl overflow-hidden border border-gray-100 dark:border-gray-700">
                <div className={`${group.bg} px-3 py-2 text-white flex items-center justify-between`}>
                  <span className="text-xs font-bold uppercase tracking-wide">{group.short}</span>
                  <span className="text-lg font-bold">{group.total}</span>
                </div>
                <div className="p-2 space-y-1">
                  {group.grades.map(g => (
                    <div key={g} className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{g}</span>
                      <span className={`text-xs font-semibold ml-2 ${group.byGrade[g] > 0 ? group.text : 'text-gray-300 dark:text-gray-600'}`}>{group.byGrade[g] || '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Department</th>
                  {['Nursery','Kinder','Prep','G1','G2','G3','G4','G5','G6','G7','G8','G9','G10','G11','G12'].map(h => (
                    <th key={h} className="px-2 py-2.5 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
                  ))}
                  <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {basicBreakdown.map(group => (
                  <tr key={group.label} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-5 py-3"><span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${group.light} ${group.text}`}>{group.label}</span></td>
                    {['Nursery','Kindergarten','Preparatory','Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6','Grade 7','Grade 8','Grade 9','Grade 10','Grade 11','Grade 12'].map(g => (
                      <td key={g} className="px-2 py-3 text-center">
                        {group.byGrade[g] > 0
                          ? <span className={`inline-flex items-center justify-center w-6 h-6 ${group.light} ${group.text} text-xs font-bold rounded-full`}>{group.byGrade[g]}</span>
                          : <span className="text-gray-200 dark:text-gray-700 text-xs">—</span>}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-center"><span className={`inline-flex items-center px-2 py-0.5 ${group.light} ${group.text} text-xs font-bold rounded-full`}>{group.total}</span></td>
                  </tr>
                ))}
                <tr className="bg-gray-50 dark:bg-gray-700/50">
                  <td className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Total</td>
                  {['Nursery','Kindergarten','Preparatory','Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6','Grade 7','Grade 8','Grade 9','Grade 10','Grade 11','Grade 12'].map(g => {
                    const n = basicBreakdown.reduce((s, grp) => s + (grp.byGrade[g] || 0), 0)
                    return <td key={g} className="px-2 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-200">{n || '—'}</td>
                  })}
                  <td className="px-4 py-3 text-center text-xs font-bold text-gray-800 dark:text-white">{basicBreakdown.reduce((s, g) => s + g.total, 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search by name or Student ID…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-primary outline-none transition" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-primary outline-none">
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="graduated">Graduated</option>
            <option value="inactive">Inactive</option>
          </select>
          <div className="col-span-1">
            <GradeLevelSelect value={gradeLevelFilter} onChange={setGradeLevelFilter} campusFilter={campusKeyForGradeSelect} userRole={user?.role} />
          </div>
          <div className="col-span-2 flex gap-2">
            {hasFilters && <button onClick={clearFilters} className="flex-1 px-3 py-2.5 text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition">Clear</button>}
            <button onClick={handleExport} className="flex-1 px-3 py-2.5 text-sm bg-primary text-white rounded-lg hover:bg-accent-burgundy transition flex items-center justify-center gap-1.5">
              <Download className="w-4 h-4" /> Export
            </button>
          </div>
        </div>
      </div>

      {/* Student table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        {filtered.length === 0 ? <EmptyState type={hasFilters ? 'search' : 'students'} onClear={hasFilters ? clearFilters : undefined} /> : (
          <>
            <ul className="md:hidden divide-y divide-gray-100 dark:divide-gray-700">
              {filtered.map(s => (
                <li key={s.id}>
                  <button onClick={() => { setSelectedStudent(s); setShowModal(true) }} className="w-full text-left px-4 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0"><Users className="w-5 h-5 text-primary" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-gray-800 dark:text-white truncate">{s.personal.firstName} {s.personal.lastName}</span>
                        <StatusBadge status={s.status} />
                      </div>
                      <p className="text-xs font-mono text-primary dark:text-red-400 mb-0.5">{s.studentId}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <span>{s.academic.gradeLevel}</span><span>•</span><span className="truncate">{s.academic.campus.replace(' Campus','')}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    {['Student ID','Student Name',user?.role==='registrar_college'?'Program & Year':'Grade Level','Section',user?.role!=='registrar_college'?'Campus':null,'Status','Enrolled','Actions'].filter(Boolean).map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filtered.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-4 py-3 text-sm font-mono font-medium text-primary dark:text-red-400 whitespace-nowrap">{s.studentId}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0"><Users className="w-4 h-4 text-primary" /></div>
                          <div>
                            <p className="text-sm font-medium text-gray-800 dark:text-white">{s.personal.firstName} {s.personal.lastName}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{s.personal.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">{s.academic.gradeLevel}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">{s.academic.section}</td>
                      {user?.role !== 'registrar_college' && <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">{s.academic.campus}</td>}
                      <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={s.status} /></td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">{fmtDate(s.enrollmentDate)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <button onClick={() => { setSelectedStudent(s); setShowModal(true) }} className="inline-flex items-center gap-1 text-sm text-primary dark:text-red-400 hover:text-accent-burgundy font-medium transition">
                            <Eye className="w-4 h-4" /> View
                          </button>
                          <button onClick={() => handlePrintClick(s)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"><Printer className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-400 dark:text-gray-500">
              Showing {filtered.length} of {roleFiltered.length} student{roleFiltered.length !== 1 ? 's' : ''}
            </div>
          </>
        )}
      </div>

      {showModal && selectedStudent && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-[9999] p-0 sm:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-5xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0"><Users className="w-6 h-6 text-primary" /></div>
                <div className="min-w-0">
                  <h2 className="text-base sm:text-xl font-bold text-gray-800 dark:text-white truncate">{selectedStudent.personal.firstName} {selectedStudent.personal.lastName}</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{selectedStudent.studentId}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => handlePrintClick(selectedStudent)} className="p-2 bg-primary text-white rounded-lg hover:bg-accent-burgundy transition"><Printer className="w-4 h-4" /></button>
                <button onClick={() => setShowModal(false)} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={selectedStudent.status} />
                <span className="text-xs text-gray-500 dark:text-gray-400">Enrolled: {fmtDate(selectedStudent.enrollmentDate)}</span>
              </div>
              <Section title="Personal Information" icon={<Users className="w-4 h-4"/>}>
                <Grid cols={3} fields={[
                  ['Full Name', `${selectedStudent.personal.firstName} ${selectedStudent.personal.middleName} ${selectedStudent.personal.lastName}`, true],
                  ['Birth Date / Age', `${new Date(selectedStudent.personal.birthDate).toLocaleDateString()} (${selectedStudent.personal.age} yrs)`],
                  ['Gender', selectedStudent.personal.gender], ['Place of Birth', selectedStudent.personal.placeOfBirth],
                  ['Religion', selectedStudent.personal.religion], ['Nationality', selectedStudent.personal.nationality],
                  ['Contact', selectedStudent.personal.contactNumber], ['Email', selectedStudent.personal.email, true],
                  ['Address', selectedStudent.personal.address, true],
                ]} />
              </Section>
              <Section title="Academic Information" icon={<GraduationCap className="w-4 h-4"/>}>
                <Grid cols={3} fields={[
                  ['Campus', selectedStudent.academic.campus], ['Program / Grade Level', selectedStudent.academic.gradeLevel],
                  ['Section', selectedStudent.academic.section], ['Student Type', selectedStudent.academic.studentType],
                  ['School Year', selectedStudent.academic.schoolYear], ['Year Level', selectedStudent.academic.yearLevel],
                ]} />
              </Section>
              <Section title="Parent / Guardian" icon={<Users className="w-4 h-4"/>}>
                <div className="space-y-4">
                  {[['Father', selectedStudent.parents.father], ['Mother', selectedStudent.parents.mother]].map(([lbl, p]) => (
                    <div key={lbl}>
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">{lbl}</p>
                      <Grid cols={3} fields={[['Name', p.name], ['Occupation', p.occupation], ['Contact', p.contactNumber]]} />
                    </div>
                  ))}
                </div>
              </Section>
              <Section title="Previous School" icon={<BookOpen className="w-4 h-4"/>}>
                <Grid cols={2} fields={[['School Name', selectedStudent.previousSchool.name], ['Last Grade', selectedStudent.previousSchool.lastGrade], ['School Year', selectedStudent.previousSchool.schoolYear], ['Address', selectedStudent.previousSchool.address, true]]} />
              </Section>
            </div>
            <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-gray-50 dark:bg-gray-700/30 flex-shrink-0">
              <button onClick={() => setShowModal(false)} className="px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition font-medium">Close</button>
              <button onClick={() => handlePrintClick(selectedStudent)} className="px-5 py-2.5 text-sm bg-primary text-white rounded-xl hover:bg-accent-burgundy transition flex items-center justify-center gap-2 font-medium">
                <Printer className="w-4 h-4" /> Print PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {studentToPrint && <div style={{ display: 'none' }}><PrintableStudent ref={printRef} student={studentToPrint} key={studentToPrint.id} /></div>}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  )
}

function Section({ title, icon, children }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-700/40 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2 mb-3">{icon}{title}</h3>
      {children}
    </div>
  )
}
function Grid({ fields, cols = 2 }) {
  const colClass = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3' }[cols] || 'sm:grid-cols-2'
  return (
    <div className={`grid grid-cols-1 ${colClass} gap-x-6 gap-y-3`}>
      {fields.map(([label, value, full]) => (
        <div key={label} className={full ? 'sm:col-span-full' : ''}>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{label}</p>
          <p className="text-sm font-medium text-gray-800 dark:text-white">{value || '—'}</p>
        </div>
      ))}
    </div>
  )
}