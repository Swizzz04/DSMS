import { useState, useRef, useEffect, useMemo, lazy, Suspense } from 'react'
import { useReactToPrint } from 'react-to-print'
// jsPDF and html2canvas loaded dynamically when user clicks Download PDF
// Chart.js loaded lazily — only renders when stats section is visible
import {
  Search, Users, Eye, Printer, Download,
  GraduationCap, MapPin, BookOpen, X, ChevronRight,
  Clock, CheckCircle, XCircle, FileText
} from 'lucide-react'
// Students are derived from approved localStorage submissions
// mockStudents / mockEnrollments are cleared — no longer imported
import { useAuth } from '../context/AuthContext'
import { exportToExcel, exportMultipleSheets } from '../utils/exportToExcel'
import PrintableStudent from '../components/PrintableStudent'
import { useLocation } from 'react-router-dom'
import { PROG_COLORS } from '../components/SchoolComponents'
import { useToast, ToastContainer, PageSkeleton, EmptyState, ModalPortal } from '../components/UIComponents'
import { useAppConfig } from '../context/AppConfigContext'
import GradeLevelSelect from '../components/GradeLevelSelect'
import GroupedSelect from '../components/GroupedSelect'
import { useCampusFilter } from '../context/CampusFilterContext'

// Lazy-loaded chart wrapper — only loads chart.js when stats section renders
const LazyBar = lazy(() =>
  Promise.all([import('react-chartjs-2'), import('chart.js')]).then(([m, ChartJS]) => {
    const { Chart: CJS, CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend } = ChartJS
    CJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend)
    return { default: m.Bar }
  })
)
const LazyDoughnut = lazy(() =>
  Promise.all([import('react-chartjs-2'), import('chart.js')]).then(([m, ChartJS]) => {
    ChartJS.Chart.register(ChartJS.ArcElement, ChartJS.Tooltip, ChartJS.Legend)
    return { default: m.Doughnut }
  })
)
const ChartFallback = () => <div className="flex items-center justify-center h-40 text-xs text-[var(--color-text-muted)]">Loading chart...</div>

// ── Shared grade helpers ─────────────────────────────────────────────
// onColor pairs each bg with text that's actually safe on it — bg-[var(--color-success)]
// and bg-[var(--color-info)] are fixed Tailwind colors (white is always safe), but
// bg-primary/bg-secondary are a school's own customizable brand colors and
// need the computed contrast-safe token instead of a hardcoded white.
// Basic Ed departments and their grade levels are NOT defined here — they come
// from the admin-editable config (`basicEdGroups` from useAppConfig(), seeded by
// BASIC_ED_GROUPS in appConfig.js). Only the *look* of each group lives here and
// is applied by position, cycling if an admin adds more groups than styles.
const GROUP_STYLES = [
  { bg: 'bg-[var(--color-success)]', onColor: 'text-[var(--color-text-inverse)]', light: 'bg-[var(--color-success-light)]',   text: 'text-[var(--color-success-text)]',    chartKey: 'success'   },
  { bg: 'bg-[var(--color-info)]',    onColor: 'text-[var(--color-text-inverse)]', light: 'bg-[var(--color-info-light)]',      text: 'text-[var(--color-info-text)]',       chartKey: 'info'      },
  { bg: 'bg-secondary',              onColor: 'text-[var(--color-secondary-contrast)]', light: 'bg-[var(--color-cat-indigo-bg)]', text: 'text-[var(--color-cat-indigo-text)]', chartKey: 'secondary' },
  { bg: 'bg-[var(--color-warning)]', onColor: 'text-[var(--color-text-inverse)]', light: 'bg-[var(--color-cat-orange-bg)]',   text: 'text-[var(--color-cat-orange-text)]', chartKey: 'warning'   },
]

// Short label for chart axes / compact cards: a configured `short` wins, then
// the full label if it is short already, otherwise initials ("Junior High School" → "JHS")
// or a trimmed single word ("Pre-Elementary" → "Pre-Elem.").
function shortGroupLabel(group) {
  if (group.short) return group.short
  const label = String(group.label || '')
  if (label.length <= 10) return label
  const words = label.split(/\s+/).filter(Boolean)
  if (words.length > 1) return words.map(w => w[0].toUpperCase()).join('')
  return `${label.slice(0, 8)}.`   // one long word, e.g. "Pre-Elementary" → "Pre-Elem."
}

// Column header for one grade level: "Grade 7" → "G7"; anything else (Nursery,
// Kindergarten, a school's own level) → its first word, trimmed to 6 characters when longer than 7.
function shortGradeLabel(grade) {
  const m = /^grade\s+(\d+)$/i.exec(String(grade).trim())
  if (m) return `G${m[1]}`
  const w = String(grade).trim().split(/\s+/)[0]
  return w.length > 7 ? w.slice(0, 6) : w
}

// Config groups ({ label, options }) → display groups ({ label, short, grades, …style }).
function buildBasicGroups(basicEdGroups) {
  return (basicEdGroups || []).map((g, i) => ({
    ...GROUP_STYLES[i % GROUP_STYLES.length],
    label:  g.label,
    short:  shortGroupLabel(g),
    grades: g.options || [],
  }))
}

// Chart.js draws on a <canvas>, which cannot resolve CSS var() strings — it
// needs real colour values. Read the live tokens from :root and re-read them
// whenever the theme (class) or the brand colours (inline style) change.
function readChartColors() {
  const css = getComputedStyle(document.documentElement)
  const v = (name) => css.getPropertyValue(name).trim() || 'currentColor'
  return {
    grid:      v('--color-border'),
    tick:      v('--color-text-muted'),
    primary:   v('--color-primary'),
    secondary: v('--color-secondary'),
    secondaryLight: v('--color-secondary-light'),
    success:   v('--color-success'),
    warning:   v('--color-warning'),
    error:     v('--color-error'),
    info:      v('--color-info'),
  }
}
function useChartColors() {
  const [colors, setColors] = useState(readChartColors)
  useEffect(() => {
    const refresh = () => setColors(prev => {
      const next = readChartColors()
      return JSON.stringify(prev) === JSON.stringify(next) ? prev : next
    })
    const obs = new MutationObserver(refresh)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] })
    refresh()
    return () => obs.disconnect()
  }, [])
  return colors
}
const makeChartOpts = (c) => ({
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { labels: { color: c.tick, font: { size: 11 } } } },
  scales: { x: { ticks: { color: c.tick }, grid: { color: c.grid } }, y: { ticks: { color: c.tick }, grid: { color: c.grid } } },
})
const makePieOpts = (c) => ({
  ...makeChartOpts(c), scales: undefined,
  plugins: { legend: { position: 'bottom', labels: { color: c.tick, padding: 12 } } },
})

function StatusDot({ status }) {
  const map = {
    pending:  { cls: 'bg-[var(--color-pending-bg)] text-[var(--color-pending-text)]', icon: <Clock className="w-3 h-3" />, label: 'Pending' },
    approved: { cls: 'bg-[var(--color-success-light)] text-[var(--color-success-text)]',   icon: <CheckCircle className="w-3 h-3" />, label: 'Approved' },
    rejected: { cls: 'bg-[var(--color-error-light)] text-[var(--color-error-text)]',           icon: <XCircle className="w-3 h-3" />, label: 'Rejected' },
  }
  const cfg = map[status] || map.pending
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>{cfg.icon}{cfg.label}</span>
}

// Raw submissions (every status). The admin campus blocks show pending /
// approved / rejected counts and a recent-applications table, so they need the
// original record shape ({ student, enrollment, referenceNumber, submittedDate })
// — NOT the approved-only normalised students used by the rest of this page.
function loadRawSubmissions() {
  try { return JSON.parse(localStorage.getItem('almirene_submissions') || '[]') }
  catch { return [] }
}

// ── Per-campus Basic Ed block (mirrors registrar_basic dashboard) ────
function CampusBasicEdBlock({ campus, allStudents, allEnrollments, currentSchoolYear }) {
  const { isBasicGrade, basicEdGroups } = useAppConfig()
  const BASIC_GROUPS = useMemo(() => buildBasicGroups(basicEdGroups), [basicEdGroups])
  const gradeCount = BASIC_GROUPS.reduce((n, g) => n + g.grades.length, 0)
  const allGrades  = BASIC_GROUPS.flatMap(g => g.grades)
  const gradeRange = allGrades.length ? `${allGrades[0]} → ${allGrades[allGrades.length - 1]}` : ''
  const chart = useChartColors()
  const chartOpts = makeChartOpts(chart)
  const pieOpts = makePieOpts(chart)
  const campusStudents    = allStudents.filter(s => s.academic.campus === campus.name && isBasicGrade(s.academic.gradeLevel))
  const campusEnrollments = allEnrollments.filter(e => e.enrollment?.campus === campus.name && isBasicGrade(e.enrollment?.gradeLevel))

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
    datasets: [{ label: 'Students', data: groupStats.map(g => g.total), backgroundColor: BASIC_GROUPS.map(g => chart[g.chartKey]), borderRadius: 6 }],
  }
  const enrollStatusData = {
    labels: ['Approved','Pending','Rejected'],
    datasets: [{ data: [enrollStats.approved, enrollStats.pending, enrollStats.rejected], backgroundColor: [chart.success, chart.warning, chart.error], borderWidth: 0 }],
  }

  return (
    <div className="space-y-4">
      {/* Campus identity card — success green, same as registrar_basic */}
      <div className="bg-[var(--color-success)] rounded-2xl p-5 text-[var(--color-text-inverse)] shadow-sm">
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
            <p className="text-3xl font-bold">{gradeCount}</p>
            <p className="text-xs opacity-70 mt-0.5">{gradeRange}</p>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Total Students',    value: campusStudents.length,  border: 'border-[var(--color-success)]', icon: <Users className="w-5 h-5 text-[var(--color-success-text)]"/>,       sub: 'All grade levels' },
          { label: 'Pending Review',    value: enrollStats.pending,    border: 'border-[var(--color-warning)]',  icon: <Clock className="w-5 h-5 text-[var(--color-pending-text)]"/>,        sub: `${enrollStats.total > 0 ? Math.round(enrollStats.pending/enrollStats.total*100) : 0}% of total` },
          { label: 'Approved',          value: enrollStats.approved,   border: 'border-[var(--color-success)]',   icon: <CheckCircle className="w-5 h-5 text-[var(--color-success-text)]"/>,   sub: `${enrollStats.total > 0 ? Math.round(enrollStats.approved/enrollStats.total*100) : 0}% approval rate` },
          { label: 'Total Enrollments', value: enrollStats.total,      border: 'border-[var(--color-info)]',    icon: <FileText className="w-5 h-5 text-[var(--color-info-text)]"/>,       sub: currentSchoolYear },
        ].map(({ label, value, border, icon, sub }) => (
          <div key={label} className={`bg-[var(--color-bg-card)] rounded-xl p-4 border-l-4 ${border} shadow-sm`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
              <div className="opacity-80">{icon}</div>
            </div>
            <p className="text-2xl font-bold text-[var(--color-text-primary)]">{value}</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* Department cards — identical layout to registrar_basic */}
      <div>
        <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-[var(--color-success-text)]" /> Students by Department
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {groupStats.map((group) => {
            const maxVal = Math.max(...Object.values(group.byGrade), 1)
            return (
              <div key={group.label} className="card-section">
                <div className={`${group.bg} px-4 py-3 ${group.onColor}`}>
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
                        <span className="text-xs text-[var(--color-text-muted)] w-20 truncate flex-shrink-0">{g}</span>
                        <div className="flex-1 bg-[var(--color-bg-subtle)] rounded-full h-1.5 overflow-hidden">
                          <div className={`h-full rounded-full ${group.bg} opacity-80`} style={{ width: count > 0 ? `${(count/maxVal)*100}%` : '0%' }} />
                        </div>
                        <span className={`text-xs font-bold w-4 text-right ${count > 0 ? group.text : 'text-[var(--color-text-muted)] opacity-50'}`}>
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
        <div className="bg-[var(--color-bg-card)] rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Students by Department</h3>
          <div style={{ height: 220 }}>
            <Suspense fallback={<ChartFallback />}><LazyBar data={groupBarData} options={{ ...chartOpts, plugins: { legend: { display: false } }, scales: { ...chartOpts.scales, y: { ...chartOpts.scales.y, beginAtZero: true } } }} /></Suspense>
          </div>
        </div>
        <div className="bg-[var(--color-bg-card)] rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Enrollment Status</h3>
          {enrollStats.total > 0 ? (
            <div style={{ height: 220 }} className="flex items-center justify-center">
              <Suspense fallback={<ChartFallback />}><LazyDoughnut data={enrollStatusData} options={pieOpts} /></Suspense>
            </div>
          ) : (
            <div className="flex items-center justify-center h-56 text-sm text-[var(--color-text-muted)]">No enrollment data</div>
          )}
        </div>
      </div>

      {/* Recent enrollments table — same as registrar_basic */}
      <div className="card-section">
        <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
            <FileText className="w-4 h-4 text-[var(--color-success-text)]" /> Recent Enrollment Applications
          </h3>
          <span className="text-xs text-[var(--color-text-muted)]">{campusEnrollments.length} total</span>
        </div>
        {campusEnrollments.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-[var(--color-text-muted)]">No enrollment applications found for this campus.</p>
        ) : (
          <>
            {/* Mobile */}
            <ul className="md:hidden divide-y divide-[var(--color-border)]">
              {campusEnrollments.slice(0, 8).map(e => (
                <li key={e.id} className="px-4 py-3 flex items-start gap-3">
                  <div className="w-8 h-8 bg-[var(--color-success-light)] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <GraduationCap className="w-4 h-4 text-[var(--color-success-text)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{e.student?.firstName} {e.student?.lastName}</p>
                      <StatusDot status={e.status} />
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{e.enrollment.gradeLevel} · {e.enrollment.studentType}</p>
                    <p className="text-xs font-mono text-[var(--color-success-text)]">{e.referenceNumber}</p>
                  </div>
                </li>
              ))}
            </ul>
            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[color-mix(in_srgb,var(--color-bg-subtle)_50%,transparent)]">
                  <tr>
                    {['Reference','Student Name','Grade Level','Student Type','Status','Date Submitted'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {campusEnrollments.map(e => (
                    <tr key={e.id} className="hover:bg-[color-mix(in_srgb,var(--color-bg-subtle)_30%,transparent)]">
                      <td className="px-4 py-3 font-mono text-xs text-[var(--color-success-text)] whitespace-nowrap">{e.referenceNumber}</td>
                      <td className="px-4 py-3 font-medium text-[var(--color-text-primary)] whitespace-nowrap">{e.student?.firstName} {e.student?.lastName}</td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)] whitespace-nowrap">{e.enrollment.gradeLevel}</td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)] whitespace-nowrap">{e.enrollment.studentType}</td>
                      <td className="px-4 py-3 whitespace-nowrap"><StatusDot status={e.status} /></td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)] whitespace-nowrap text-xs">
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
  const { isCollegeGrade, collegeYearLevels: YEAR_LEVELS } = useAppConfig()
  const chart = useChartColors()
  const chartOpts = makeChartOpts(chart)
  const pieOpts = makePieOpts(chart)
  const programs          = campus.collegePrograms || []
  const campusStudents    = allStudents.filter(s => s.academic.campus === campus.name && isCollegeGrade(s.academic.gradeLevel))
  const campusEnrollments = allEnrollments.filter(e => e.enrollment?.campus === campus.name && isCollegeGrade(e.enrollment?.gradeLevel))

  const programStats = programs.reduce((acc, prog) => {
    const students = campusStudents.filter(s => s.academic.gradeLevel.split(' - ')[0] === prog)
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

  // Solid-fill-safe text per background. These keys mirror PROG_COLORS.bg in
  // SchoolComponents.jsx; they go away when PROG_COLORS carries its own `on`
  // field (planned with the SchoolComponents migration).
  const ON_COLOR_FOR_BG = {
    'bg-primary':         'text-[var(--color-primary-contrast)]',
    'bg-secondary':       'text-[var(--color-secondary-contrast)]',
    // bg-light-secondary is a fixed neutral that is mid-gray in light mode and
    // near-white in dark mode, so its text must flip: card colour does exactly that.
    'bg-light-secondary': 'text-[var(--color-bg-card)]',
    'bg-violet-600':      'text-[var(--color-text-inverse)]',
  }
  const progColors = PROG_COLORS.map(c => c.bg)

  const yearColors = [chart.primary, chart.secondary, chart.secondaryLight, chart.info]
  const programBarData = {
    labels: programs,
    datasets: YEAR_LEVELS.map((yr, i) => ({
      label: yr,
      data: programs.map(p => programStats[p]?.byYear[yr] || 0),
      backgroundColor: yearColors[i % yearColors.length],
    })),
  }
  const enrollStatusData = {
    labels: ['Approved','Pending','Rejected'],
    datasets: [{ data: [enrollStats.approved, enrollStats.pending, enrollStats.rejected], backgroundColor: [chart.success, chart.warning, chart.error], borderWidth: 0 }],
  }

  if (programs.length === 0) return null

  return (
    <div className="space-y-4">
      {/* Campus identity card — dark blue, same as registrar_college */}
      <div className="bg-secondary rounded-2xl p-5 text-[var(--color-secondary-contrast)] shadow-sm">
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
              {programs.map(p => <span key={p} className="text-xs bg-[color-mix(in_srgb,var(--color-secondary-contrast)_20%,transparent)] px-2 py-0.5 rounded-full">{p}</span>)}
            </div>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Total Students',    value: campusStudents.length,  border: 'border-[var(--color-primary-readable)]',     icon: <Users className="w-5 h-5 text-[var(--color-primary-readable)]"/>,            sub: 'All programs combined' },
          { label: 'Pending Review',    value: enrollStats.pending,    border: 'border-[var(--color-warning)]',  icon: <Clock className="w-5 h-5 text-[var(--color-pending-text)]"/>,         sub: `${enrollStats.total > 0 ? Math.round(enrollStats.pending/enrollStats.total*100) : 0}% of total` },
          { label: 'Approved',          value: enrollStats.approved,   border: 'border-[var(--color-success)]',   icon: <CheckCircle className="w-5 h-5 text-[var(--color-success-text)]"/>,    sub: `${enrollStats.total > 0 ? Math.round(enrollStats.approved/enrollStats.total*100) : 0}% approval rate` },
          { label: 'Total Enrollments', value: enrollStats.total,      border: 'border-[var(--color-info)]',    icon: <FileText className="w-5 h-5 text-[var(--color-info-text)]"/>,        sub: currentSchoolYear },
        ].map(({ label, value, border, icon, sub }) => (
          <div key={label} className={`bg-[var(--color-bg-card)] rounded-xl p-4 border-l-4 ${border} shadow-sm`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
              <div className="opacity-80">{icon}</div>
            </div>
            <p className="text-2xl font-bold text-[var(--color-text-primary)]">{value}</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* Program cards — identical to registrar_college */}
      <div>
        <h2 className="text-base font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-[var(--color-primary-readable)]" /> Program Overview
        </h2>
        <div className={`grid gap-4 ${programs.length === 1 ? 'grid-cols-1 max-w-sm' : programs.length === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
          {programs.map((prog, idx) => {
            const pd = programStats[prog]
            const color = progColors[idx % progColors.length]
            const onColor = ON_COLOR_FOR_BG[color] || 'text-[var(--color-text-inverse)]'
            const maxCount = Math.max(...YEAR_LEVELS.map(y => pd.byYear[y]), 1)
            return (
              <div key={prog} className="card-section">
                <div className={`${color} px-5 py-4 ${onColor}`}>
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
                      <span className="text-xs text-[var(--color-text-muted)] w-14 flex-shrink-0">{yr}</span>
                      <div className="flex-1 bg-[var(--color-bg-subtle)] rounded-full h-2 overflow-hidden">
                        <div className={`h-full rounded-full ${color} transition-all duration-500`}
                          style={{ width: maxCount > 0 ? `${(pd.byYear[yr] / maxCount) * 100}%` : '0%' }} />
                      </div>
                      <span className="text-xs font-semibold text-[var(--color-text-secondary)] w-5 text-right">{pd.byYear[yr] || 0}</span>
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
        <div className="bg-[var(--color-bg-card)] rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Students by Program & Year</h3>
          <div style={{ height: 240 }}>
            <Suspense fallback={<ChartFallback />}><LazyBar data={programBarData} options={{ ...chartOpts, scales: { ...chartOpts.scales, x: { ...chartOpts.scales.x, stacked: false }, y: { ...chartOpts.scales.y, stacked: false, beginAtZero: true } } }} /></Suspense>
          </div>
        </div>
        <div className="bg-[var(--color-bg-card)] rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Enrollment Status</h3>
          {enrollStats.total > 0 ? (
            <div style={{ height: 240 }} className="flex items-center justify-center">
              <Suspense fallback={<ChartFallback />}><LazyDoughnut data={enrollStatusData} options={pieOpts} /></Suspense>
            </div>
          ) : (
            <div className="flex items-center justify-center h-60 text-sm text-[var(--color-text-muted)]">No enrollment data</div>
          )}
        </div>
      </div>

      {/* Recent enrollments */}
      <div className="card-section">
        <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
            <FileText className="w-4 h-4 text-[var(--color-primary-readable)]" /> Recent Enrollment Applications
          </h3>
          <span className="text-xs text-[var(--color-text-muted)]">{campusEnrollments.length} total</span>
        </div>
        {campusEnrollments.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-[var(--color-text-muted)]">No enrollment applications found for this campus.</div>
        ) : (
          <>
            {/* Mobile */}
            <ul className="md:hidden divide-y divide-[var(--color-border)]">
              {campusEnrollments.slice(0, 8).map(e => (
                <li key={e.id} className="px-4 py-3 flex items-start gap-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <GraduationCap className="w-4 h-4 text-[var(--color-primary-readable)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{e.student?.firstName} {e.student?.lastName}</p>
                      <StatusDot status={e.status} />
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{e.enrollment.gradeLevel} · {e.enrollment.studentType}</p>
                    <p className="text-xs font-mono text-[var(--color-primary-readable)]">{e.referenceNumber}</p>
                  </div>
                </li>
              ))}
            </ul>
            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[color-mix(in_srgb,var(--color-bg-subtle)_50%,transparent)]">
                  <tr>
                    {['Reference','Student Name','Program & Year','Type','Status','Date'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {campusEnrollments.map(e => (
                    <tr key={e.id} className="hover:bg-[color-mix(in_srgb,var(--color-bg-subtle)_30%,transparent)]">
                      <td className="px-4 py-3 font-mono text-xs text-[var(--color-primary-readable)] whitespace-nowrap">{e.referenceNumber}</td>
                      <td className="px-4 py-3 font-medium text-[var(--color-text-primary)] whitespace-nowrap">{e.student?.firstName} {e.student?.lastName}</td>
                      <td className="px-4 py-3 text-[var(--color-text-secondary)] whitespace-nowrap">{e.enrollment.gradeLevel}</td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)] whitespace-nowrap">{e.enrollment.studentType}</td>
                      <td className="px-4 py-3 whitespace-nowrap"><StatusDot status={e.status} /></td>
                      <td className="px-4 py-3 text-[var(--color-text-muted)] whitespace-nowrap text-xs">
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
// ── Normalise almirene_submissions → student shape ────────────────────
function normaliseSubmissions() {
  try {
    const subs = JSON.parse(localStorage.getItem('almirene_submissions') || '[]')
    return subs
      .filter(s => s.status === 'approved')
      .map(s => {
        const st = s.student || {}
        const en = s.enrollment || {}
        const gradeLevel = en.gradeLevel || ''
        const yearPart = gradeLevel.split(' - ')[1] || ''
        return {
          id:             s.id || s.referenceNumber,
          studentId:      s.referenceNumber || s.id || '',
          status:         'active',
          enrollmentDate: s.updatedAt || s.submittedDate || new Date().toISOString(),
          personal: {
            firstName:     st.firstName     || '',
            middleName:    st.middleName     || '',
            lastName:      st.lastName       || '',
            fullName:      st.fullName       || `${st.lastName || ''}, ${st.firstName || ''} ${st.middleName || ''}`.trim(),
            birthDate:     st.birthDate      || '',
            age:           st.age            || '',
            placeOfBirth:  st.placeOfBirth   || '',
            gender:        st.gender         || '',
            religion:      st.religion       || '',
            nationality:   st.nationality    || '',
            contactNumber: st.contactNumber  || '',
            email:         st.email          || '',
            address:       st.address        || '',
          },
          academic: {
            campus:      en.campus      || '',
            gradeLevel,
            studentType: en.studentType || '',
            schoolYear:  en.schoolYear  || '',
            semester:    en.semester    || '',
            yearLevel:   yearPart,
            section:     '',
          },
          parents: {
            father: {
              name:          (s.father || s.parents?.father)?.name          || '',
              occupation:    (s.father || s.parents?.father)?.occupation    || '',
              contactNumber: (s.father || s.parents?.father)?.contactNumber || '',
            },
            mother: {
              name:          (s.mother || s.parents?.mother)?.name          || '',
              occupation:    (s.mother || s.parents?.mother)?.occupation    || '',
              contactNumber: (s.mother || s.parents?.mother)?.contactNumber || '',
            },
          },
          guardian: s.guardian || {},
          previousSchool: s.previousSchool || { name: '', address: '', lastGrade: '', schoolYear: '' },
          // pass through payment info for reference
          totalFee:   s.totalFee   || 0,
          amountPaid: s.amountPaid || 0,
          balance:    s.balance    || 0,
        }
      })
  } catch { return [] }
}

export default function Students() {
  const { user } = useAuth()
  const { activeCampuses, currentSchoolYear, isBasicGrade, isCollegeGrade, basicEdGroups, collegeYearLevels: YEAR_LEVELS } = useAppConfig()
  const BASIC_GROUPS = useMemo(() => buildBasicGroups(basicEdGroups), [basicEdGroups])
  const allBasicGrades = BASIC_GROUPS.flatMap(g => g.grades)
  const location = useLocation()
  const { toasts, addToast, removeToast } = useToast()
  // Load approved submissions and normalise into student shape
  const [students, setStudents] = useState(() => normaliseSubmissions())
  const [enrollments, setEnrollments] = useState(() => loadRawSubmissions())

  useEffect(() => {
    const reload = () => { setStudents(normaliseSubmissions()); setEnrollments(loadRawSubmissions()) }
    const handleStorage = (e) => {
      if (e.key === 'almirene_submissions' || e.key === null) reload()
    }
    window.addEventListener('almirene_enrollment_updated', reload)
    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener('almirene_enrollment_updated', reload)
      window.removeEventListener('storage', handleStorage)
    }
  }, [])
  const [searchQuery, setSearchQuery]           = useState('')
  const [statusFilter, setStatusFilter]         = useState('all')
  const [gradeLevelFilter, setGradeLevelFilter] = useState('all')
  const [selectedStudent, setSelectedStudent]   = useState(null)
  const [showModal, setShowModal]               = useState(false)
  const [studentToPrint, setStudentToPrint]     = useState(null)
  const printRef = useRef()
  const { campusFilter } = useCampusFilter()
  const [loading, setLoading] = useState(true)

  useEffect(() => { const t = setTimeout(() => setLoading(false), 150); return () => clearTimeout(t) }, [])
  useEffect(() => {
    setLoading(true); setGradeLevelFilter('all')
    const t = setTimeout(() => setLoading(false), 100)
    return () => clearTimeout(t)
  }, [campusFilter])

  useEffect(() => {
    if (location.state?.openStudent) {
      setSelectedStudent(location.state.openStudent); setShowModal(true)
      window.history.replaceState({}, '')
    }
  }, [location.state])

  const isCampusLocked = user?.role === 'registrar_college' || user?.role === 'registrar_basic' || user?.role === 'principal_basic' || user?.role === 'program_head'
  // Both Basic Ed roles share the same Basic Ed views (breakdown table, banner, export tag)
  const isBasicRole = user?.role === 'registrar_basic' || user?.role === 'principal_basic'
  const effectiveCampusFilter = isCampusLocked ? user.campus : campusFilter
  // The header filter holds a campus KEY ('Talisay'); a locked role holds the
  // campus NAME. Resolve both to the name so the comparison below is exact.
  const effectiveCampusName = effectiveCampusFilter === 'all'
    ? 'all'
    : (activeCampuses.find(c => c.key === effectiveCampusFilter || c.name === effectiveCampusFilter)?.name ?? effectiveCampusFilter)

  const roleFiltered = students.filter(s => {
    if (user?.role === 'admin' || user?.role === 'technical_admin') return true
    const g = s.academic.gradeLevel, c = s.academic.campus
    if (user?.role === 'registrar_basic')   return isBasicGrade(g) && c === user.campus
    if (user?.role === 'principal_basic')   return isBasicGrade(g) && c === user.campus
    if (user?.role === 'program_head')      return isCollegeGrade(g) && c === user.campus
    if (user?.role === 'registrar_college') return isCollegeGrade(g) && c === user.campus
    return true
  })

  const filtered = roleFiltered.filter(s => {
    const name = `${s.personal.firstName} ${s.personal.lastName}`.toLowerCase()
    return (
      (name.includes(searchQuery.toLowerCase()) || s.studentId.toLowerCase().includes(searchQuery.toLowerCase())) &&
      (statusFilter === 'all' || s.status === statusFilter) &&
      (effectiveCampusName === 'all' || s.academic.campus === effectiveCampusName) &&
      (gradeLevelFilter === 'all' || s.academic.gradeLevel === gradeLevelFilter)
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

  const basicBreakdown = isBasicRole
    ? BASIC_GROUPS.map(group => ({
        ...group,
        total: roleFiltered.filter(s => group.grades.includes(s.academic.gradeLevel)).length,
        byGrade: group.grades.reduce((acc, g) => { acc[g] = roleFiltered.filter(s => s.academic.gradeLevel === g).length; return acc }, {}),
      }))
    : null

  const StatusBadge = ({ status }) => {
    const map = {
      active:    'bg-[var(--color-success-light)] text-[var(--color-success-text)]',
      graduated: 'bg-[var(--color-info-light)] text-[var(--color-info-text)]',
      inactive:  'bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)]',
    }
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[status] || map.inactive}`}>{status.charAt(0).toUpperCase()+status.slice(1)}</span>
  }

  const fmtDate = (d) => new Date(d).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' })
  const handlePrint = useReactToPrint({ contentRef: printRef, documentTitle: `Student_Profile_${studentToPrint?.studentId}`, onAfterPrint: () => setStudentToPrint(null) })
  const handlePrintClick = (s) => { setStudentToPrint(s); setTimeout(() => { if (printRef.current) handlePrint() }, 300) }

  // ── Download as PDF (no print dialog) ──────────────────────
  const [isDownloading, setIsDownloading] = useState(false)
  const handleDownloadPDF = async (s) => {
    if (isDownloading) return
    setIsDownloading(true)
    setStudentToPrint(s)

    // Wait for the PrintableStudent component to render in the off-screen wrapper
    await new Promise(resolve => setTimeout(resolve, 500))

    try {
      // Load heavy PDF libraries only when needed (~1MB total, not on page load)
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ])

      const el = printRef.current
      if (!el) throw new Error('Print ref not ready')

      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff', // print output is always light (Rev.16 exception, like PrintableStudent)
      })

      // Validate canvas actually captured something
      if (canvas.width === 0 || canvas.height === 0) {
        throw new Error('Captured empty canvas')
      }

      // Build PDF — A4 portrait, fit-to-width
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()
      const imgWidth = pdfWidth
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      const imgData = canvas.toDataURL('image/png', 1.0)

      if (imgHeight <= pdfHeight) {
        // Fits on one page
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)
      } else {
        // Multi-page: slice vertically
        let heightLeft = imgHeight
        let position = 0
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pdfHeight
        while (heightLeft > 0) {
          position = heightLeft - imgHeight
          pdf.addPage()
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
          heightLeft -= pdfHeight
        }
      }

      pdf.save(`Student_Profile_${s.studentId}.pdf`)
      addToast('PDF downloaded!', 'success')
    } catch (err) {
      console.error('[ALMIRENE] PDF download failed:', err)
      addToast('Failed to download PDF. Please try again.', 'error')
    } finally {
      setStudentToPrint(null)
      setIsDownloading(false)
    }
  }

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
    const deptTag   = user?.role === 'registrar_college' ? 'College_' : isBasicRole ? 'BasicEd_' : ''
    exportToExcel(data, `Students_${campusTag}${deptTag}${new Date().toISOString().split('T')[0]}`, 'Students')
    addToast(`Exported ${data.length} student records!`, 'success')
  }

  const bannerTone = isBasicRole
    ? { box: 'bg-[var(--color-success-light)] border-[var(--color-success-border)]', text: 'text-[var(--color-success-text)]' }
    : { box: 'bg-[var(--color-cat-purple-bg)] border-[var(--color-cat-purple-border)]', text: 'text-[var(--color-cat-purple-text)]' }
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
            'Department': isBasicGrade(s.academic.gradeLevel) ? 'Basic Ed' : 'College',
            'Status': s.status,
          })),
          sheetName: campus.key,
        })),
        `ALMIRENE_All_Campuses_Students_${new Date().toISOString().split('T')[0]}`
      )
    }

    return (
      <div className="animate-fade-in space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)]">Students</h1>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              {currentSchoolYear} · School-wide student overview across all campuses
            </p>
          </div>
          <button onClick={handleAdminExport}
            className="self-start sm:self-auto flex items-center gap-1.5 px-4 py-2 text-sm bg-primary text-[var(--color-primary-contrast)] rounded-lg hover:bg-[var(--color-primary-hover)] transition font-medium">
            <Download className="w-4 h-4" /> Export All
          </button>
        </div>

        {/* One block per campus, each split into Basic Ed + College */}
        {shownCampuses.map((campus, i) => (
          <div key={campus.key} className="space-y-6">
            {/* Campus divider label */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-[var(--color-border)]" />
              <span className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)] px-2">
                {campus.name}
              </span>
              <div className="flex-1 h-px bg-[var(--color-border)]" />
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
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)]">
          {(user?.role === 'registrar_college' || user?.role === 'program_head') ? 'College Students' : (user?.role === 'registrar_basic' || user?.role === 'principal_basic') ? 'Basic Ed Students' : 'Students'}
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          {(user?.role === 'registrar_college' || user?.role === 'program_head') ? 'All enrolled college students for your campus'
            : (user?.role === 'registrar_basic' || user?.role === 'principal_basic') ? 'All enrolled basic education students for your campus'
            : 'View and manage enrolled students'}
        </p>
      </div>

      {isCampusLocked && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${bannerTone.box}`}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-[var(--color-bg-card)]">
            <MapPin className={`w-4 h-4 ${bannerTone.text}`} />
          </div>
          <div>
            <p className={`text-sm font-semibold ${bannerTone.text}`}>
              Viewing: {user.campus} — {isBasicRole ? 'Basic Education Department' : 'College Department'}
            </p>
            <p className={`text-xs ${bannerTone.text}`}>
              Showing {isBasicRole ? 'basic education' : 'college'} students from your assigned campus only
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Total Students', value: stats.total,     border: 'border-[var(--color-primary-readable)]',   sub: isCampusLocked ? user.campus : (campusFilter !== 'all' ? activeCampuses.find(c=>c.key===campusFilter)?.name||campusFilter : 'All Campuses'), subCls: 'text-[var(--color-text-muted)]' },
          { label: 'Active',         value: stats.active,    border: 'border-[var(--color-success)]', sub: `${stats.total>0?Math.round(stats.active/stats.total*100):0}% of total`, subCls: 'text-[var(--color-success-text)]' },
          { label: 'Graduated',      value: stats.graduated, border: 'border-[var(--color-info)]',  sub: 'Completed studies',      subCls: 'text-[var(--color-info-text)]' },
          { label: 'Inactive',       value: stats.inactive,  border: 'border-[var(--color-border-strong)]',  sub: 'Not currently enrolled', subCls: 'text-[var(--color-text-muted)]' },
        ].map(({ label, value, border, sub, subCls }) => (
          <div key={label} className={`bg-[var(--color-bg-card)] rounded-xl p-4 border-l-4 ${border} shadow-sm`}>
            <p className="text-xs text-[var(--color-text-muted)] mb-1">{label}</p>
            <p className="text-2xl font-bold text-[var(--color-text-primary)]">{value}</p>
            <p className={`text-xs mt-1 ${subCls}`}>{sub}</p>
          </div>
        ))}
      </div>

      {programBreakdown && Object.keys(programBreakdown).length > 0 && (
        <div className="card-section">
          <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-[var(--color-primary-readable)]" />
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Students by Program & Year Level</h2>
          </div>
          <div className="min-w-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[400px]">
              <thead className="bg-[color-mix(in_srgb,var(--color-bg-subtle)_50%,transparent)]">
                <tr>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Program</th>
                  {YEAR_LEVELS.map(yr => <th key={yr} className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">{yr}</th>)}
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {Object.entries(programBreakdown).map(([program, data]) => (
                  <tr key={program} className="hover:bg-[color-mix(in_srgb,var(--color-bg-subtle)_30%,transparent)]">
                    <td className="px-5 py-3 font-medium text-[var(--color-text-primary)]">{program}</td>
                    {YEAR_LEVELS.map(yr => (
                      <td key={yr} className="px-4 py-3">
                        {data.byYear[yr] ? <span className="inline-flex items-center justify-center w-7 h-7 bg-primary/10 dark:bg-primary/20 text-[var(--color-primary-readable)] text-xs font-bold rounded-full">{data.byYear[yr]}</span>
                          : <span className="text-[var(--color-text-muted)] opacity-50">—</span>}
                      </td>
                    ))}
                    <td className="px-4 py-3"><span className="inline-flex items-center px-2 py-0.5 bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)] text-xs font-bold rounded-full">{data.total}</span></td>
                  </tr>
                ))}
                <tr className="bg-[color-mix(in_srgb,var(--color-bg-subtle)_50%,transparent)] font-semibold">
                  <td className="px-5 py-3 text-xs uppercase tracking-wider text-[var(--color-text-muted)]">Total</td>
                  {YEAR_LEVELS.map(yr => <td key={yr} className="px-4 py-3 text-[var(--color-text-primary)]">{Object.values(programBreakdown).reduce((s, d) => s + (d.byYear[yr] || 0), 0) || '—'}</td>)}
                  <td className="px-4 py-3 text-[var(--color-text-primary)]">{Object.values(programBreakdown).reduce((s, d) => s + d.total, 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          </div>
        </div>
      )}

      {basicBreakdown && (
        <div className="card-section">
          <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[var(--color-success-text)]" />
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Students by Department & Grade Level</h2>
          </div>
          <div className="md:hidden p-4 grid grid-cols-2 gap-3">
            {basicBreakdown.map(group => (
              <div key={group.label} className="rounded-xl overflow-hidden border border-[var(--color-border)]">
                <div className={`${group.bg} px-3 py-2 ${group.onColor} flex items-center justify-between`}>
                  <span className="text-xs font-bold uppercase tracking-wide">{group.short}</span>
                  <span className="text-lg font-bold">{group.total}</span>
                </div>
                <div className="p-2 space-y-1">
                  {group.grades.map(g => (
                    <div key={g} className="flex items-center justify-between">
                      <span className="text-xs text-[var(--color-text-muted)] truncate">{g}</span>
                      <span className={`text-xs font-semibold ml-2 ${group.byGrade[g] > 0 ? group.text : 'text-[var(--color-text-muted)] opacity-50'}`}>{group.byGrade[g] || '—'}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[color-mix(in_srgb,var(--color-bg-subtle)_50%,transparent)]">
                <tr>
                  <th className="px-5 py-2.5 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Department</th>
                  {allBasicGrades.map(g => (
                    <th key={g} title={g} className="px-2 py-2.5 text-center text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">{shortGradeLabel(g)}</th>
                  ))}
                  <th className="px-4 py-2.5 text-center text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {basicBreakdown.map(group => (
                  <tr key={group.label} className="hover:bg-[color-mix(in_srgb,var(--color-bg-subtle)_30%,transparent)]">
                    <td className="px-5 py-3"><span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${group.light} ${group.text}`}>{group.label}</span></td>
                    {allBasicGrades.map(g => (
                      <td key={g} className="px-2 py-3 text-center">
                        {group.byGrade[g] > 0
                          ? <span className={`inline-flex items-center justify-center w-6 h-6 ${group.light} ${group.text} text-xs font-bold rounded-full`}>{group.byGrade[g]}</span>
                          : <span className="text-[var(--color-text-muted)] opacity-40 text-xs">—</span>}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-center"><span className={`inline-flex items-center px-2 py-0.5 ${group.light} ${group.text} text-xs font-bold rounded-full`}>{group.total}</span></td>
                  </tr>
                ))}
                <tr className="bg-[color-mix(in_srgb,var(--color-bg-subtle)_50%,transparent)]">
                  <td className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Total</td>
                  {allBasicGrades.map(g => {
                    const n = basicBreakdown.reduce((s, grp) => s + (grp.byGrade[g] || 0), 0)
                    return <td key={g} className="px-2 py-3 text-center text-xs font-semibold text-[var(--color-text-primary)]">{n || '—'}</td>
                  })}
                  <td className="px-4 py-3 text-center text-xs font-bold text-[var(--color-text-primary)]">{basicBreakdown.reduce((s, g) => s + g.total, 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-[var(--color-bg-card)] rounded-xl p-4 shadow-sm space-y-3">
        <div className="relative">
          <Search className="search-icon" />
          <input type="text" placeholder="Search by name or Student ID…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-primary outline-none transition" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <GroupedSelect
            value={statusFilter}
            onChange={setStatusFilter}
            allLabel="All Status"
            options={[
              { value: 'active',    label: 'Active'    },
              { value: 'graduated', label: 'Graduated' },
              { value: 'inactive',  label: 'Inactive'  },
            ]}
          />
          <div className="col-span-1">
            <GradeLevelSelect value={gradeLevelFilter} onChange={setGradeLevelFilter} campusFilter={campusKeyForGradeSelect} userRole={user?.role} />
          </div>
          <div className="col-span-2 flex gap-2">
            {hasFilters && <button onClick={clearFilters} className="flex-1 px-3 py-2.5 text-sm text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-subtle)] transition">Clear</button>}
            <button onClick={handleExport} className="flex-1 px-3 py-2.5 text-sm bg-primary text-[var(--color-primary-contrast)] rounded-lg hover:bg-[var(--color-primary-hover)] transition flex items-center justify-center gap-1.5">
              <Download className="w-4 h-4" /> Export
            </button>
          </div>
        </div>
      </div>

      {/* Student table */}
      <div className="card-section">
        {filtered.length === 0 ? <EmptyState type={hasFilters ? 'search' : 'students'} onClear={hasFilters ? clearFilters : undefined} /> : (
          <>
            <ul className="md:hidden divide-y divide-[var(--color-border)]">
              {filtered.map(s => (
                <li key={s.id}>
                  <button onClick={() => { setSelectedStudent(s); setShowModal(true) }} className="w-full text-left px-4 py-4 hover:bg-[color-mix(in_srgb,var(--color-bg-subtle)_50%,transparent)] transition flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0"><Users className="w-5 h-5 text-[var(--color-primary-readable)]" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{s.personal.firstName} {s.personal.lastName}</span>
                        <StatusBadge status={s.status} />
                      </div>
                      <p className="text-xs font-mono text-[var(--color-primary-readable)] mb-0.5">{s.studentId}</p>
                      <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                        <span>{s.academic.gradeLevel}</span>
                        {!isCampusLocked && (<>
                          <span>•</span>
                          <span className="truncate">{s.academic.campus.replace(' Campus','')}</span>
                        </>)}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)] flex-shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[var(--color-bg-subtle)]">
                  <tr>
                    {['Student ID','Student Name',user?.role==='registrar_college'?'Program & Year':'Grade Level','Section',!isCampusLocked?'Campus':null,'Status','Enrolled','Actions'].filter(Boolean).map(h => (
                      <th key={h} className="th">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {filtered.map(s => (
                    <tr key={s.id} className="hover:bg-[color-mix(in_srgb,var(--color-bg-subtle)_50%,transparent)] transition-colors">
                      <td className="px-4 py-3 text-sm font-mono font-medium text-[var(--color-primary-readable)] whitespace-nowrap">{s.studentId}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0"><Users className="w-4 h-4 text-[var(--color-primary-readable)]" /></div>
                          <div>
                            <p className="text-sm font-medium text-[var(--color-text-primary)]">{s.personal.firstName} {s.personal.lastName}</p>
                            <p className="text-xs text-[var(--color-text-muted)]">{s.personal.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--color-text-secondary)] whitespace-nowrap">{s.academic.gradeLevel}</td>
                      <td className="px-4 py-3 text-sm text-[var(--color-text-muted)] whitespace-nowrap">{s.academic.section}</td>
                      {!isCampusLocked && <td className="px-4 py-3 text-sm text-[var(--color-text-secondary)] whitespace-nowrap">{s.academic.campus}</td>}
                      <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={s.status} /></td>
                      <td className="px-4 py-3 text-sm text-[var(--color-text-muted)] whitespace-nowrap">{fmtDate(s.enrollmentDate)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <button onClick={() => { setSelectedStudent(s); setShowModal(true) }} className="inline-flex items-center gap-1 text-sm text-[var(--color-primary-readable)] hover:text-[var(--color-primary-hover)] font-medium transition">
                            <Eye className="w-4 h-4" /> View
                          </button>
                          <button onClick={() => handlePrintClick(s)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition"><Printer className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
              Showing {filtered.length} of {roleFiltered.length} student{roleFiltered.length !== 1 ? 's' : ''}
            </div>
          </>
        )}
      </div>

      {showModal && selectedStudent && (
        <ModalPortal>
        <div className="modal-backdrop">
          <div className="bg-[var(--color-bg-card)] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-5xl max-h-[92vh] flex flex-col">
            <div className="modal-header">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0"><Users className="w-6 h-6 text-[var(--color-primary-readable)]" /></div>
                <div className="min-w-0">
                  <h2 className="text-base sm:text-xl font-bold text-[var(--color-text-primary)] truncate">{selectedStudent.personal.firstName} {selectedStudent.personal.lastName}</h2>
                  <p className="text-xs text-[var(--color-text-muted)]">{selectedStudent.studentId}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => handleDownloadPDF(selectedStudent)}
                  disabled={isDownloading}
                  title="Download as PDF"
                  className="p-2 bg-primary text-[var(--color-primary-contrast)] rounded-lg hover:bg-[var(--color-primary-hover)] transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDownloading
                    ? <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    : <Download className="w-4 h-4" />
                  }
                </button>
                <button onClick={() => setShowModal(false)} className="icon-btn-ghost"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={selectedStudent.status} />
                <span className="text-xs text-[var(--color-text-muted)]">Enrolled: {fmtDate(selectedStudent.enrollmentDate)}</span>
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
                      <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">{lbl}</p>
                      <Grid cols={3} fields={[['Name', p.name], ['Occupation', p.occupation], ['Contact', p.contactNumber]]} />
                    </div>
                  ))}
                </div>
              </Section>
              <Section title="Previous School" icon={<BookOpen className="w-4 h-4"/>}>
                <Grid cols={2} fields={[['School Name', selectedStudent.previousSchool.name], ['Last Grade', selectedStudent.previousSchool.lastGrade], ['School Year', selectedStudent.previousSchool.schoolYear], ['Address', selectedStudent.previousSchool.address, true]]} />
              </Section>
            </div>
            <div className="px-5 py-4 border-t border-[var(--color-border)] flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-[var(--color-bg-subtle)] flex-shrink-0">
              <button onClick={() => setShowModal(false)} className="btn-cancel">Close</button>
              <button onClick={() => handlePrintClick(selectedStudent)} className="px-5 py-2.5 text-sm bg-primary text-[var(--color-primary-contrast)] rounded-xl hover:bg-[var(--color-primary-hover)] transition flex items-center justify-center gap-2 font-medium">
                <Printer className="w-4 h-4" /> Print PDF
              </button>
            </div>
          </div>
        </div>
      </ModalPortal>
      )}

      {studentToPrint && (
        <div
          data-print-wrapper
          style={{
            position: 'fixed',
            left: '-10000px',
            top: 0,
            width: 'auto',
            zIndex: -1,
            pointerEvents: 'none',
          }}
          aria-hidden="true"
        >
          <PrintableStudent ref={printRef} student={studentToPrint} key={studentToPrint.id} />
        </div>
      )}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  )
}

function Section({ title, icon, children }) {
  return (
    <div className="bg-[var(--color-bg-subtle)] rounded-xl p-4">
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2 mb-3">{icon}{title}</h3>
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
          <p className="text-xs text-[var(--color-text-muted)] mb-0.5">{label}</p>
          <p className="text-sm font-medium text-[var(--color-text-primary)]">{value || '—'}</p>
        </div>
      ))}
    </div>
  )
}