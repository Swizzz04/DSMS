/**
 * Dashboard.jsx — CSHC Admin Portal
 * ─────────────────────────────────────────────────────────────────
 * Rev. 4 UI Cleanup:
 *  - All hardcoded bg-white/bg-gray-800 panels → .card primitive
 *  - All stat tiles → .stat-card primitive (left-border accent + hover lift)
 *  - Chart panels use .card + CSS token colors for grid/tick
 *  - Header title uses .text-display / .text-heading scale
 *  - Export button uses .btn .btn-ghost (matches design system)
 *  - Page wrapper uses .page-enter for smooth entrance
 *  - Stat card grid uses .stagger for cascade entrance
 *  - Per-campus strip uses .animate-fade-in-up
 *  - Section panels via SectionPanel from SchoolComponents (unchanged)
 *  - No gradients, no shadow-2xl, no hover:scale, no backdrop-blur
 *  - Storage event: e.key === 'cshc_submissions' || e.key === null (✅ fixed)
 *  - Dark mode: all color tokens auto-flip via CSS variables in .dark
 *  - Mobile-first: base mobile, sm:/md:/lg: for desktop
 * ─────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Download, Users, FileText, GraduationCap,
  MapPin, BookOpen, Clock, CheckCircle, DollarSign,
  AlertCircle, BarChart2, TrendingUp
} from 'lucide-react'
import { Bar, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale,
  BarElement, ArcElement,
  PointElement, LineElement,
  Title, Tooltip, Legend
} from 'chart.js'
import { useAuth } from '../context/AuthContext'
import { useCampusFilter } from '../context/CampusFilterContext'
import { useAppConfig } from '../context/AppConfigContext'
import { exportMultipleSheets } from '../utils/exportToExcel'
import { SkeletonDashboard } from '../components/UIComponents'
import {
  StatCard, CampusMiniCard, SectionPanel, CollectionRateBar, CampusBanner,
  EnrollmentStatusPill,
  EnrollmentTable, CampusEnrollmentTable, CampusStudentTable, CampusPaymentTable,
  php, isBasicGrade, isCollegeGrade,
} from '../components/SchoolComponents'

ChartJS.register(
  CategoryScale, LinearScale, BarElement, ArcElement,
  PointElement, LineElement, Title, Tooltip, Legend
)

// ── Load real data from localStorage bridge ──────────────────────
function loadSubmissions() {
  try { return JSON.parse(localStorage.getItem('cshc_submissions') || '[]') } catch { return [] }
}

// ── Derive isDark from DOM (chart colors need this synchronously) ─
function getIsDark() {
  return document.documentElement.classList.contains('dark')
}

// ── Chart theme tokens ────────────────────────────────────────────
function chartTheme() {
  const dark = getIsDark()
  return {
    gridClr: dark ? '#2a2d3e' : '#e8e8e4',   // --color-border tokens
    tickClr: dark ? '#6a6a78' : '#8a8a8a',   // --color-text-muted tokens
    tooltipBg: dark ? '#1a1d27' : '#ffffff',
    tooltipBorder: dark ? '#2a2d3e' : '#e8e8e4',
    tooltipTitle: dark ? '#f0f0ee' : '#1a1a1a',
    tooltipBody: dark ? '#a8a8b0' : '#4a4a4a',
  }
}

// ─────────────────────────────────────────────────────────────────
// MAIN DASHBOARD EXPORT
// ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user } = useAuth()
  const { activeCampuses, currentSchoolYear } = useAppConfig()
  const { campusFilter = 'all' } = useCampusFilter()
  const [loading, setLoading] = useState(true)
  const [submissions, setSubmissions] = useState(loadSubmissions)

  // ── Reload when any tab updates enrollments ───────────────────
  useEffect(() => {
    const reload = () => setSubmissions(loadSubmissions())
    // ✅ FIX: Only reload when cshc_submissions key changes
    const handleStorage = (e) => {
      if (e.key === 'cshc_submissions' || e.key === null) reload()
    }
    window.addEventListener('cshc_enrollment_updated', reload)
    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener('cshc_enrollment_updated', reload)
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  // Initial load shimmer
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 800)
    return () => clearTimeout(t)
  }, [])

  // Campus filter change shimmer
  useEffect(() => {
    setLoading(true)
    const t = setTimeout(() => setLoading(false), 400)
    return () => clearTimeout(t)
  }, [campusFilter])

  // ── Role flags ────────────────────────────────────────────────
  const isCollegeReg   = user?.role === 'registrar_college'
  const isBasicReg     = user?.role === 'registrar_basic'
  const isPrincipal    = user?.role === 'principal_basic'
  const isProgramHead  = user?.role === 'program_head'
  const isAccounting   = user?.role === 'accounting'
  const isAccountingLocked = isAccounting && user?.campus !== 'all'
  const accountingCampus   = isAccountingLocked ? user.campus : null

  // ── Campus scope ──────────────────────────────────────────────
  const effectiveCampusFilter = isAccountingLocked
    ? activeCampuses.find(c => c.name === accountingCampus)?.key || campusFilter
    : campusFilter

  const shownCampuses = isAccountingLocked
    ? activeCampuses.filter(c => c.name === accountingCampus)
    : effectiveCampusFilter === 'all'
      ? activeCampuses
      : activeCampuses.filter(c => c.key === effectiveCampusFilter)

  const campusNames = shownCampuses.map(c => c.name)
  const campusLabel = isAccountingLocked
    ? accountingCampus
    : effectiveCampusFilter === 'all'
      ? 'All Campuses'
      : (activeCampuses.find(c => c.key === effectiveCampusFilter)?.name || effectiveCampusFilter)

  const inScope = useCallback((campusName) =>
    isAccountingLocked
      ? campusName === accountingCampus
      : effectiveCampusFilter === 'all'
        ? true
        : campusNames.includes(campusName),
  [isAccountingLocked, accountingCampus, effectiveCampusFilter, campusNames])

  // ── Derived data ──────────────────────────────────────────────
  const filteredEnrollments = submissions.filter(s => inScope(s.enrollment?.campus || ''))

  const filteredPayments = submissions
    .filter(s =>
      inScope(s.enrollment?.campus || '') &&
      (s.status === 'payment_received' || s.status === 'approved') &&
      (s.amountPaid > 0 || s.paymentHistory?.length > 0)
    )
    .map(s => ({
      campus:     s.enrollment?.campus || '',
      gradeLevel: s.enrollment?.gradeLevel || '',
      totalFee:   s.totalFee   || 0,
      amountPaid: s.amountPaid || 0,
      balance:    s.balance    || 0,
      status:     (s.balance || 0) <= 0 ? 'paid' : 'partial',
    }))

  const filteredStudents = submissions
    .filter(s => inScope(s.enrollment?.campus || '') && s.status === 'approved')
    .map(s => ({
      academic: {
        campus:     s.enrollment?.campus || '',
        gradeLevel: s.enrollment?.gradeLevel || '',
      }
    }))

  // ── Enrollment stats ──────────────────────────────────────────
  const enrTotal           = filteredEnrollments.length
  const enrPending         = filteredEnrollments.filter(e => e.status === 'pending').length
  const enrPaymentReceived = filteredEnrollments.filter(e => e.status === 'payment_received').length
  const enrApproved        = filteredEnrollments.filter(e => e.status === 'approved').length
  const enrRejected        = filteredEnrollments.filter(e => e.status === 'rejected').length
  const basicEnr           = filteredEnrollments.filter(e => isBasicGrade(e.enrollment?.gradeLevel))
  const collegeEnr         = filteredEnrollments.filter(e => isCollegeGrade(e.enrollment?.gradeLevel))

  // ── Student stats ─────────────────────────────────────────────
  const stuTotal   = filteredStudents.length
  const basicStu   = filteredStudents.filter(s => isBasicGrade(s.academic.gradeLevel))
  const collegeStu = filteredStudents.filter(s => isCollegeGrade(s.academic.gradeLevel))

  // ── Payment stats ─────────────────────────────────────────────
  const payRevenue     = filteredPayments.reduce((s, p) => s + p.amountPaid, 0)
  const payOutstanding = filteredPayments.reduce((s, p) => s + p.balance, 0)
  const payTotalFee    = filteredPayments.reduce((s, p) => s + p.totalFee, 0)
  const payPaid        = filteredPayments.filter(p => p.status === 'paid').length
  const payOverdue     = filteredPayments.filter(p => p.status === 'overdue').length
  const collectionRate = payTotalFee > 0 ? Math.round((payRevenue / payTotalFee) * 100) : 0

  // ── Per-campus stats ──────────────────────────────────────────
  const campusStats = shownCampuses.map(c => {
    const cs  = filteredStudents.filter(s => s.academic.campus === c.name)
    const ce  = filteredEnrollments.filter(e => e.enrollment?.campus === c.name)
    const cp  = filteredPayments.filter(p => p.campus === c.name)
    const rev = cp.reduce((s, p) => s + p.amountPaid, 0)
    const tot = cp.reduce((s, p) => s + p.totalFee, 0)
    return {
      name: c.name, key: c.key,
      students:         cs.length,
      basicStu:         cs.filter(s => isBasicGrade(s.academic.gradeLevel)).length,
      collegeStu:       cs.filter(s => isCollegeGrade(s.academic.gradeLevel)).length,
      enrollments:      ce.length,
      pending:          ce.filter(e => e.status === 'pending').length,
      payment_received: ce.filter(e => e.status === 'payment_received').length,
      approved:         ce.filter(e => e.status === 'approved').length,
      rejected:         ce.filter(e => e.status === 'rejected').length,
      revenue:          rev,
      outstanding:      cp.reduce((s, p) => s + p.balance, 0),
      totalFee:         tot,
      collectionRate:   tot > 0 ? Math.round((rev / tot) * 100) : 0,
      overdue:          cp.filter(p => p.status === 'overdue').length,
    }
  })

  // ── Chart config ──────────────────────────────────────────────
  const { gridClr, tickClr } = chartTheme()

  const baseOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: tickClr,
          font: { size: 11, family: 'Inter, sans-serif' },
          boxWidth: 10,
          boxHeight: 10,
          padding: 14,
        }
      },
      tooltip: { mode: 'index', intersect: false }
    },
    scales: {
      x: {
        ticks: { color: tickClr, font: { size: 11 } },
        grid:  { color: gridClr },
      },
      y: {
        ticks: { color: tickClr, font: { size: 11 } },
        grid:  { color: gridClr },
        beginAtZero: true,
      },
    },
  }

  const pieOpts = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: tickClr,
          padding: 14,
          font: { size: 11, family: 'Inter, sans-serif' },
          boxWidth: 10,
          boxHeight: 10,
        }
      },
      tooltip: { mode: 'index', intersect: false }
    }
  }

  const campusShortName = (name) => name.replace(' Campus', '').replace(' City', '')

  const enrStatusChartData = {
    labels: ['Approved', 'Payment Received', 'Awaiting Payment', 'Rejected'],
    datasets: [{
      data: [enrApproved, enrPaymentReceived, enrPending, enrRejected],
      backgroundColor: ['#16a34a', '#2563eb', '#d97706', '#dc2626'],
      borderWidth: 0,
      hoverOffset: 6,
    }],
  }

  const campusBarData = {
    labels: campusStats.map(c => campusShortName(c.name)),
    datasets: [
      { label: 'Students',    data: campusStats.map(c => c.students),    backgroundColor: '#2563eb', borderRadius: 4 },
      { label: 'Enrollments', data: campusStats.map(c => c.enrollments), backgroundColor: '#750014', borderRadius: 4 },
    ],
  }

  const revenueBarData = {
    labels: campusStats.map(c => campusShortName(c.name)),
    datasets: [
      { label: 'Collected',   data: campusStats.map(c => c.revenue),    backgroundColor: '#16a34a', borderRadius: 4 },
      { label: 'Outstanding', data: campusStats.map(c => c.outstanding), backgroundColor: '#dc2626', borderRadius: 4 },
    ],
  }

  // ── Export ────────────────────────────────────────────────────
  const handleExport = () => {
    exportMultipleSheets([
      {
        data: [
          { Metric: 'Campus',              Value: campusLabel },
          { Metric: 'School Year',         Value: currentSchoolYear },
          { Metric: 'Total Students',      Value: stuTotal },
          { Metric: 'Basic Ed Students',   Value: basicStu.length },
          { Metric: 'College Students',    Value: collegeStu.length },
          { Metric: 'Total Enrollments',   Value: enrTotal },
          { Metric: 'Pending',             Value: enrPending },
          { Metric: 'Approved',            Value: enrApproved },
          { Metric: 'Rejected',            Value: enrRejected },
          { Metric: 'Total Revenue',       Value: payRevenue },
          { Metric: 'Outstanding Balance', Value: payOutstanding },
          { Metric: 'Collection Rate',     Value: `${collectionRate}%` },
          { Metric: 'Overdue Accounts',    Value: payOverdue },
        ],
        sheetName: 'Summary',
      },
      {
        data: campusStats.map(c => ({
          'Campus':             c.name,
          'Total Students':     c.students,
          'Basic Ed Students':  c.basicStu,
          'College Students':   c.collegeStu,
          'Total Enrollments':  c.enrollments,
          'Pending':            c.pending,
          'Approved':           c.approved,
          'Rejected':           c.rejected,
          'Revenue Collected':  c.revenue,
          'Outstanding':        c.outstanding,
          'Collection Rate':    `${c.collectionRate}%`,
          'Overdue':            c.overdue,
        })),
        sheetName: 'Per Campus',
      },
    ], `CSHC_Dashboard_${campusFilter}_${new Date().toISOString().split('T')[0]}`)
  }

  // ── Loading state ─────────────────────────────────────────────
  if (loading) return <SkeletonDashboard />

  // ── Registrar dashboards ──────────────────────────────────────
  if (isCollegeReg || isBasicReg) {
    return (
      <RegistrarDashboard
        user={user}
        currentSchoolYear={currentSchoolYear}
        isBasicReg={isBasicReg}
      />
    )
  }

  // ── Dashboard title helper ────────────────────────────────────
  const dashboardTitle = () => {
    if (user?.role === 'accounting')      return 'Accounting Dashboard'
    if (user?.role === 'principal_basic') return 'Principal Dashboard'
    if (user?.role === 'admin')           return 'Owner Dashboard'
    if (isProgramHead)                    return 'Program Head Dashboard'
    return 'Admin Dashboard'
  }

  // ═════════════════════════════════════════════════════════════
  // ADMIN / ACCOUNTING / PRINCIPAL LAYOUT
  // ═════════════════════════════════════════════════════════════
  return (
    <div className="page-enter space-y-5">

      {/* ── Page header ──────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-display text-[var(--color-text-primary)]">
            {dashboardTitle()}
          </h1>
          <p className="text-body text-[var(--color-text-muted)] mt-1">
            {currentSchoolYear} · {campusLabel} · Summary Report
          </p>
        </div>

        <button
          onClick={handleExport}
          className="btn btn-ghost self-start"
        >
          <Download className="w-4 h-4" />
          Export Report
        </button>
      </div>

      {/* ── Campus-locked banner ──────────────────────────────── */}
      <CampusBanner user={user} />

      {/* ── Grand stat cards ──────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger">

        {/* Total Students */}
        <div className="stat-card animate-fade-in" style={{ borderLeftColor: '#2563eb' }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-caption font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
              Total Students
            </p>
            <Users className="w-4 h-4 text-blue-500 opacity-80" />
          </div>
          <p className="text-2xl font-bold text-[var(--color-text-primary)]">
            {stuTotal.toLocaleString()}
          </p>
          <p className="text-caption text-[var(--color-text-muted)] mt-1">{campusLabel}</p>
        </div>

        {/* Total Enrollments */}
        <div className="stat-card animate-fade-in" style={{ borderLeftColor: 'var(--color-primary)' }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-caption font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
              Total Enrollments
            </p>
            <FileText className="w-4 h-4 text-[var(--color-primary)] opacity-80" />
          </div>
          <p className="text-2xl font-bold text-[var(--color-text-primary)]">
            {enrTotal.toLocaleString()}
          </p>
          <p className="text-caption text-[var(--color-text-muted)] mt-1">
            {enrPending > 0 ? `${enrPending} awaiting payment` : 'No pending'}
            {enrPaymentReceived > 0 ? ` · ${enrPaymentReceived} ready` : ''}
          </p>
        </div>

        {/* Total Revenue */}
        <div className="stat-card animate-fade-in" style={{ borderLeftColor: 'var(--color-success)' }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-caption font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
              Total Revenue
            </p>
            <TrendingUp className="w-4 h-4 text-[var(--color-success)] opacity-80" />
          </div>
          <p className="text-2xl font-bold text-[var(--color-success)]">
            {php(payRevenue)}
          </p>
          <p className="text-caption text-[var(--color-text-muted)] mt-1">
            {collectionRate}% collection rate
          </p>
        </div>

        {/* Outstanding */}
        <div
          className="stat-card animate-fade-in"
          style={{ borderLeftColor: payOverdue > 0 ? 'var(--color-error)' : 'var(--color-border-strong)' }}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-caption font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
              Outstanding
            </p>
            <AlertCircle className={`w-4 h-4 opacity-80 ${payOverdue > 0 ? 'text-[var(--color-error)]' : 'text-[var(--color-text-muted)]'}`} />
          </div>
          <p className={`text-2xl font-bold ${payOutstanding > 0 ? 'text-[var(--color-error)]' : 'text-[var(--color-text-primary)]'}`}>
            {php(payOutstanding)}
          </p>
          <p className="text-caption text-[var(--color-text-muted)] mt-1">
            {payOverdue > 0 ? `${payOverdue} overdue accounts` : 'No overdue'}
          </p>
        </div>

      </div>

      {/* ── Per-campus strip ──────────────────────────────────── */}
      {campusStats.length > 1 && !isAccountingLocked && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {campusStats.map((c, i) => (
            <div
              key={c.name}
              className="animate-fade-in-up"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <CampusMiniCard campusStat={c} />
            </div>
          ))}
        </div>
      )}

      {/* ── Charts row ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Enrollment Status Doughnut */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-1">
            <BarChart2 className="w-4 h-4 text-[var(--color-primary)]" />
            <h3 className="text-subheading text-[var(--color-text-primary)]">
              Enrollment Status
            </h3>
          </div>
          <p className="text-caption text-[var(--color-text-muted)] mb-4">{campusLabel}</p>
          <div style={{ height: 200 }} className="flex items-center justify-center">
            {enrTotal > 0
              ? <Doughnut data={enrStatusChartData} options={pieOpts} />
              : <p className="text-small text-[var(--color-text-muted)]">No enrollment data</p>
            }
          </div>
        </div>

        {/* Campus Bar Chart — Students & Enrollments OR Revenue */}
        {!isAccounting ? (
          <div className="card p-5 lg:col-span-2">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-blue-500" />
              <h3 className="text-subheading text-[var(--color-text-primary)]">
                Students &amp; Enrollments by Campus
              </h3>
            </div>
            <p className="text-caption text-[var(--color-text-muted)] mb-4">{currentSchoolYear}</p>
            <div style={{ height: 200 }}>
              <Bar data={campusBarData} options={baseOpts} />
            </div>
          </div>
        ) : (
          <div className="card p-5 lg:col-span-2">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-[var(--color-success)]" />
              <h3 className="text-subheading text-[var(--color-text-primary)]">
                Revenue vs Outstanding
              </h3>
            </div>
            <p className="text-caption text-[var(--color-text-muted)] mb-4">
              {campusLabel} · {currentSchoolYear}
            </p>
            <div style={{ height: 200 }}>
              <Bar
                data={revenueBarData}
                options={{
                  ...baseOpts,
                  scales: {
                    ...baseOpts.scales,
                    y: {
                      ...baseOpts.scales.y,
                      ticks: {
                        ...baseOpts.scales.y.ticks,
                        callback: (v) => `₱${(v / 1000).toFixed(0)}k`,
                      },
                    },
                  },
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ══ ENROLLMENTS SECTION ══════════════════════════════════ */}
      {!isAccounting && (
        <SectionPanel
          title="Enrollments Summary"
          icon={<FileText className="w-4 h-4" />}
          colorCls="text-[var(--color-primary)] dark:text-red-400 bg-[var(--color-primary-light)] dark:bg-red-900/10"
          pills={[
            `${enrTotal} total`,
            enrPending > 0 && `${enrPending} pending`,
          ]}
        >
          {/* Status tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[
              {
                label: 'Total',
                val:   enrTotal,
                color: 'text-[var(--color-text-primary)]',
                bg:    'bg-[var(--color-bg-subtle)] dark:bg-[var(--color-bg-subtle)]',
              },
              {
                label: 'Awaiting Payment',
                val:   enrPending,
                color: 'text-[var(--color-warning)]',
                bg:    'bg-[var(--color-warning-light)] dark:bg-yellow-900/20',
              },
              {
                label: 'Payment Received',
                val:   enrPaymentReceived,
                color: 'text-[var(--color-info)]',
                bg:    'bg-[var(--color-info-light)] dark:bg-blue-900/20',
              },
              {
                label: 'Approved',
                val:   enrApproved,
                color: 'text-[var(--color-success)]',
                bg:    'bg-[var(--color-success-light)] dark:bg-green-900/20',
              },
            ].map(s => (
              <div key={s.label} className={`${s.bg} rounded-[var(--radius-lg)] p-3 text-center`}>
                <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
                <p className="text-caption text-[var(--color-text-muted)] mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Basic Ed vs College breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            {[
              {
                label: 'Basic Education',
                icon:  <BookOpen className="w-4 h-4 text-[var(--color-success)]" />,
                enr:   basicEnr,
              },
              {
                label: 'College',
                icon:  <GraduationCap className="w-4 h-4 text-[var(--color-info)]" />,
                enr:   collegeEnr,
              },
            ].map(d => (
              <div
                key={d.label}
                className="bg-[var(--color-bg-subtle)] dark:bg-[var(--color-bg-subtle)] rounded-[var(--radius-lg)] p-4"
              >
                <div className="flex items-center gap-2 mb-3">
                  {d.icon}
                  <p className="text-small font-semibold text-[var(--color-text-primary)]">
                    {d.label}
                  </p>
                  <span className="ml-auto text-small font-bold text-[var(--color-text-primary)]">
                    {d.enr.length}
                  </span>
                </div>
                {[
                  { label: 'Pending',  val: d.enr.filter(e => e.status === 'pending').length,  cls: 'text-[var(--color-warning)]' },
                  { label: 'Approved', val: d.enr.filter(e => e.status === 'approved').length, cls: 'text-[var(--color-success)]' },
                  { label: 'Rejected', val: d.enr.filter(e => e.status === 'rejected').length, cls: 'text-[var(--color-error)]'   },
                ].map(r => (
                  <div key={r.label} className="flex items-center justify-between text-xs py-0.5">
                    <span className="text-[var(--color-text-muted)]">{r.label}</span>
                    <span className={`font-semibold ${r.cls}`}>{r.val}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <CampusEnrollmentTable campusStats={campusStats} />

          {filteredEnrollments.length > 0 && (
            <div className="mt-4">
              <p className="text-label text-[var(--color-text-muted)] mb-2">
                Recent Applications
              </p>
              <EnrollmentTable enrollments={filteredEnrollments} limit={5} />
            </div>
          )}
        </SectionPanel>
      )}

      {/* ══ STUDENTS SECTION ══════════════════════════════════════ */}
      {!isAccounting && (
        <SectionPanel
          title="Students Summary"
          icon={<Users className="w-4 h-4" />}
          colorCls="text-[var(--color-info)] dark:text-blue-400 bg-[var(--color-info-light)] dark:bg-blue-900/10"
          pills={[`${stuTotal} total`]}
        >
          {/* Overview tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="bg-[var(--color-bg-subtle)] dark:bg-[var(--color-bg-subtle)] rounded-[var(--radius-lg)] p-4 text-center">
              <p className="text-3xl font-bold text-[var(--color-text-primary)]">{stuTotal}</p>
              <p className="text-caption text-[var(--color-text-muted)] mt-1">Total Students</p>
            </div>
            <div className="bg-[var(--color-success-light)] dark:bg-emerald-900/20 rounded-[var(--radius-lg)] p-4 text-center">
              <p className="text-3xl font-bold text-[var(--color-success)]">{basicStu.length}</p>
              <p className="text-caption text-[var(--color-text-muted)] mt-1">Basic Education</p>
            </div>
            <div className="bg-[var(--color-info-light)] dark:bg-blue-900/20 rounded-[var(--radius-lg)] p-4 text-center">
              <p className="text-3xl font-bold text-[var(--color-info)]">{collegeStu.length}</p>
              <p className="text-caption text-[var(--color-text-muted)] mt-1">College</p>
            </div>
          </div>

          <CampusStudentTable campusStats={campusStats} stuTotal={stuTotal} />
        </SectionPanel>
      )}

      {/* ══ PAYMENTS SECTION ══════════════════════════════════════ */}
      {!isPrincipal && !isProgramHead && (
        <SectionPanel
          title="Payments Summary"
          icon={<DollarSign className="w-4 h-4" />}
          colorCls="text-[var(--color-success)] dark:text-green-400 bg-[var(--color-success-light)] dark:bg-green-900/10"
          pills={[
            `${collectionRate}% collected`,
            payOverdue > 0 && `${payOverdue} overdue`,
          ]}
        >
          {/* Stat tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[
              {
                label: 'Expected',
                val:   php(payTotalFee),
                color: 'text-[var(--color-text-primary)]',
                bg:    'bg-[var(--color-bg-subtle)] dark:bg-[var(--color-bg-subtle)]',
              },
              {
                label: 'Collected',
                val:   php(payRevenue),
                color: 'text-[var(--color-success)]',
                bg:    'bg-[var(--color-success-light)] dark:bg-green-900/20',
              },
              {
                label: 'Outstanding',
                val:   php(payOutstanding),
                color: 'text-[var(--color-error)]',
                bg:    'bg-[var(--color-error-light)] dark:bg-red-900/20',
              },
              {
                label: 'Fully Paid',
                val:   `${payPaid}`,
                color: 'text-[var(--color-info)]',
                bg:    'bg-[var(--color-info-light)] dark:bg-blue-900/20',
              },
            ].map(s => (
              <div key={s.label} className={`${s.bg} rounded-[var(--radius-lg)] p-3 text-center`}>
                <p className={`text-xl font-bold ${s.color}`}>{s.val}</p>
                <p className="text-caption text-[var(--color-text-muted)] mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          <CollectionRateBar
            rate={collectionRate}
            collected={payRevenue}
            expected={payTotalFee}
          />

          {/* Revenue chart */}
          <div className="bg-[var(--color-bg-subtle)] dark:bg-[var(--color-bg-subtle)] rounded-[var(--radius-lg)] p-4 mt-4">
            <p className="text-small font-semibold text-[var(--color-text-primary)] mb-3">
              Revenue by Campus
            </p>
            <div style={{ height: 160 }}>
              <Bar
                data={revenueBarData}
                options={{
                  ...baseOpts,
                  scales: {
                    ...baseOpts.scales,
                    y: {
                      ...baseOpts.scales.y,
                      ticks: {
                        ...baseOpts.scales.y.ticks,
                        callback: (v) => `₱${(v / 1000).toFixed(0)}k`,
                      },
                    },
                  },
                }}
              />
            </div>
          </div>

          <div className="mt-4">
            <CampusPaymentTable campusStats={campusStats} />
          </div>
        </SectionPanel>
      )}

    </div>
  )
}


// ─────────────────────────────────────────────────────────────────
// REGISTRAR DASHBOARD
// Shown to registrar_basic and registrar_college roles.
// Campus-locked, department-scoped view.
// ─────────────────────────────────────────────────────────────────
function RegistrarDashboard({ user, currentSchoolYear, isBasicReg }) {
  const isBasicGradeLocal   = (g) => g?.includes('Grade') || ['Nursery', 'Kindergarten', 'Preparatory'].some(x => g?.includes(x))
  const isCollegeGradeLocal = (g) => g?.includes('BS') || g?.includes('Year')

  const [submissions, setSubmissions] = useState(loadSubmissions)

  // ✅ FIX: Storage event correctly checks cshc_submissions key
  useEffect(() => {
    const reload = () => setSubmissions(loadSubmissions())
    const handleStorage = (e) => {
      if (e.key === 'cshc_submissions' || e.key === null) reload()
    }
    window.addEventListener('cshc_enrollment_updated', reload)
    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener('cshc_enrollment_updated', reload)
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  const campusSubs = submissions.filter(s => s.enrollment?.campus === user.campus)

  const enrollments = campusSubs.filter(s =>
    isBasicReg
      ? isBasicGradeLocal(s.enrollment?.gradeLevel)
      : isCollegeGradeLocal(s.enrollment?.gradeLevel)
  )

  const students = campusSubs
    .filter(s => s.status === 'approved')
    .filter(s =>
      isBasicReg
        ? isBasicGradeLocal(s.enrollment?.gradeLevel)
        : isCollegeGradeLocal(s.enrollment?.gradeLevel)
    )

  const stats = {
    total:            enrollments.length,
    pending:          enrollments.filter(e => e.status === 'pending').length,
    payment_received: enrollments.filter(e => e.status === 'payment_received').length,
    approved:         enrollments.filter(e => e.status === 'approved').length,
  }

  const pct = (n) => stats.total > 0 ? Math.round((n / stats.total) * 100) : 0

  // Brand accents per registrar type
  const accentText   = isBasicReg ? 'text-[var(--color-success)]' : 'text-[var(--color-primary)]'
  const borderLeft   = isBasicReg ? 'var(--color-success)' : 'var(--color-primary)'

  return (
    <div className="page-enter space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-display text-[var(--color-text-primary)]">
          {isBasicReg ? 'Basic Education' : 'College Registrar'} Dashboard
        </h1>
        <p className="text-body text-[var(--color-text-muted)] mt-1">
          {currentSchoolYear} · {user.campus}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger">

        <div className="stat-card animate-fade-in" style={{ borderLeftColor: borderLeft }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-caption font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
              Total Students
            </p>
            <Users className={`w-4 h-4 opacity-80 ${accentText}`} />
          </div>
          <p className="text-2xl font-bold text-[var(--color-text-primary)]">{students.length}</p>
          <p className="text-caption text-[var(--color-text-muted)] mt-1">Approved enrollments</p>
        </div>

        <div className="stat-card animate-fade-in" style={{ borderLeftColor: 'var(--color-warning)' }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-caption font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
              Awaiting Payment
            </p>
            <Clock className="w-4 h-4 text-[var(--color-warning)] opacity-80" />
          </div>
          <p className="text-2xl font-bold text-[var(--color-text-primary)]">{stats.pending}</p>
          <p className="text-caption text-[var(--color-text-muted)] mt-1">{pct(stats.pending)}% of total</p>
        </div>

        <div className="stat-card animate-fade-in" style={{ borderLeftColor: 'var(--color-info)' }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-caption font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
              Payment Received
            </p>
            <DollarSign className="w-4 h-4 text-[var(--color-info)] opacity-80" />
          </div>
          <p className="text-2xl font-bold text-[var(--color-text-primary)]">{stats.payment_received}</p>
          <p className="text-caption text-[var(--color-text-muted)] mt-1">Ready for approval</p>
        </div>

        <div className="stat-card animate-fade-in" style={{ borderLeftColor: 'var(--color-success)' }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-caption font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
              Approved
            </p>
            <CheckCircle className="w-4 h-4 text-[var(--color-success)] opacity-80" />
          </div>
          <p className="text-2xl font-bold text-[var(--color-text-primary)]">{stats.approved}</p>
          <p className="text-caption text-[var(--color-text-muted)] mt-1">{pct(stats.approved)}% approval rate</p>
        </div>

      </div>

      {/* Recent applications table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <h3 className={`text-small font-semibold flex items-center gap-2 ${accentText}`}>
            <FileText className="w-4 h-4" />
            Recent Enrollment Applications
          </h3>
          <span className="text-caption text-[var(--color-text-muted)]">
            {enrollments.length} total
          </span>
        </div>

        {enrollments.length === 0 ? (
          <p className="px-5 py-10 text-center text-small text-[var(--color-text-muted)]">
            No enrollment data for your campus.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-[var(--color-bg-subtle)]">
                <tr>
                  {['Reference', 'Student', 'Level / Program', 'Type', 'Status', 'Date'].map(h => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left text-caption font-semibold text-[var(--color-text-muted)] uppercase tracking-wider whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {enrollments.map(e => (
                  <tr key={e.id} className="table-row">
                    <td className={`px-4 py-3 font-mono text-xs ${accentText} whitespace-nowrap`}>
                      {e.referenceNumber}
                    </td>
                    <td className="px-4 py-3 font-medium text-[var(--color-text-primary)] whitespace-nowrap">
                      {e.student?.firstName} {e.student?.lastName}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)] whitespace-nowrap">
                      {e.enrollment?.gradeLevel}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)] whitespace-nowrap capitalize">
                      {e.enrollment?.studentType}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <EnrollmentStatusPill status={e.status} />
                    </td>
                    <td className="px-4 py-3 text-caption text-[var(--color-text-muted)] whitespace-nowrap">
                      {new Date(e.submittedDate).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}