import { useState, useEffect } from 'react'
import {
  Download, Users, FileText, GraduationCap,
  MapPin, BookOpen, Clock, CheckCircle, XCircle, DollarSign,
  AlertCircle, BarChart2
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
  EnrollmentStatusPill, PaymentStatusBadge,
  EnrollmentTable, CampusEnrollmentTable, CampusStudentTable, CampusPaymentTable,
  php, isBasicGrade, isCollegeGrade,
} from '../components/SchoolComponents'
import { mockStudents } from '../data/mockStudents'
import { mockEnrollments } from '../data/mockEnrollments'
import { mockPayments } from '../data/mockPayments'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Title, Tooltip, Legend)

export default function Dashboard() {
  const { user } = useAuth()
  const { activeCampuses, currentSchoolYear } = useAppConfig()
  const { campusFilter = 'all' } = useCampusFilter()
  const [loading, setLoading] = useState(true)

  useEffect(() => { const t = setTimeout(() => setLoading(false), 800); return () => clearTimeout(t) }, [])
  useEffect(() => { setLoading(true); const t = setTimeout(() => setLoading(false), 400); return () => clearTimeout(t) }, [campusFilter])

  const isCollegeReg        = user?.role === 'registrar_college'
  const isBasicReg          = user?.role === 'registrar_basic'
  const isPrincipal         = user?.role === 'principal_basic'
  const isAccounting        = user?.role === 'accounting'
  const isAccountingLocked  = isAccounting && user?.campus !== 'all'
  const accountingCampus    = isAccountingLocked ? user.campus : null

  // Campus filtering — accounting locked users always see only their campus
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

  const filteredStudents    = mockStudents.filter(s =>
    isAccountingLocked ? s.academic.campus === accountingCampus : (effectiveCampusFilter === 'all' || campusNames.includes(s.academic.campus))
  )
  const filteredEnrollments = mockEnrollments.filter(e =>
    isAccountingLocked ? e.enrollment.campus === accountingCampus : (effectiveCampusFilter === 'all' || campusNames.includes(e.enrollment.campus))
  )
  const filteredPayments = mockPayments.filter(p =>
    isAccountingLocked ? p.campus === accountingCampus : (effectiveCampusFilter === 'all' || campusNames.includes(p.campus))
  )

  // Enrollment stats
  const enrTotal    = filteredEnrollments.length
  const enrPending         = filteredEnrollments.filter(e => e.status === 'pending').length
  const enrPaymentReceived = filteredEnrollments.filter(e => e.status === 'payment_received').length
  const enrApproved        = filteredEnrollments.filter(e => e.status === 'approved').length
  const enrRejected        = filteredEnrollments.filter(e => e.status === 'rejected').length
  const basicEnr    = filteredEnrollments.filter(e => isBasicGrade(e.enrollment.gradeLevel))
  const collegeEnr  = filteredEnrollments.filter(e => isCollegeGrade(e.enrollment.gradeLevel))

  // Student stats
  const stuTotal   = filteredStudents.length
  const basicStu   = filteredStudents.filter(s => isBasicGrade(s.academic.gradeLevel))
  const collegeStu = filteredStudents.filter(s => isCollegeGrade(s.academic.gradeLevel))

  // Payment stats
  const payRevenue     = filteredPayments.reduce((s, p) => s + p.amountPaid, 0)
  const payOutstanding = filteredPayments.reduce((s, p) => s + p.balance, 0)
  const payTotalFee    = filteredPayments.reduce((s, p) => s + p.totalFee, 0)
  const payPaid        = filteredPayments.filter(p => p.status === 'paid').length
  const payOverdue     = filteredPayments.filter(p => p.status === 'overdue').length
  const collectionRate = payTotalFee > 0 ? Math.round((payRevenue / payTotalFee) * 100) : 0

  // Per-campus stats — uses filtered data so accounting locked users only see their campus
  const campusStats = shownCampuses.map(c => {
    const cs = filteredStudents.filter(s => s.academic.campus === c.name)
    const ce = filteredEnrollments.filter(e => e.enrollment.campus === c.name)
    const cp = filteredPayments.filter(p => p.campus === c.name)
    const rev = cp.reduce((s, p) => s + p.amountPaid, 0)
    const tot = cp.reduce((s, p) => s + p.totalFee, 0)
    return {
      name: c.name, key: c.key,
      students: cs.length,
      basicStu: cs.filter(s => isBasicGrade(s.academic.gradeLevel)).length,
      collegeStu: cs.filter(s => isCollegeGrade(s.academic.gradeLevel)).length,
      enrollments: ce.length,
      pending:          ce.filter(e => e.status === 'pending').length,
      payment_received: ce.filter(e => e.status === 'payment_received').length,
      approved:         ce.filter(e => e.status === 'approved').length,
      rejected:         ce.filter(e => e.status === 'rejected').length,
      revenue: rev,
      outstanding: cp.reduce((s, p) => s + p.balance, 0),
      totalFee: tot,
      collectionRate: tot > 0 ? Math.round((rev / tot) * 100) : 0,
      overdue: cp.filter(p => p.status === 'overdue').length,
    }
  })

  // Chart colors
  const isDark   = document.documentElement.classList.contains('dark')
  const gridClr  = isDark ? '#1f2937' : '#f3f4f6'
  const tickClr  = isDark ? '#9ca3af' : '#6b7280'
  const baseOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { color: tickClr, font: { size: 11 }, boxWidth: 12 } } },
    scales: {
      x: { ticks: { color: tickClr, font: { size: 11 } }, grid: { color: gridClr } },
      y: { ticks: { color: tickClr, font: { size: 11 } }, grid: { color: gridClr }, beginAtZero: true },
    },
  }
  const pieOpts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: tickClr, padding: 12, font: { size: 11 }, boxWidth: 12 } } } }

  const campusShortName = (name) => name.replace(' Campus','').replace(' City','')

  const enrStatusChartData = {
    labels: ['Approved', 'Payment Received', 'Awaiting Payment', 'Rejected'],
    datasets: [{ data: [enrApproved, enrPaymentReceived, enrPending, enrRejected], backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'], borderWidth: 0 }],
  }
  const campusBarData = {
    labels: campusStats.map(c => campusShortName(c.name)),
    datasets: [
      { label: 'Students',    data: campusStats.map(c => c.students),    backgroundColor: '#3b82f6', borderRadius: 4 },
      { label: 'Enrollments', data: campusStats.map(c => c.enrollments), backgroundColor: '#750014', borderRadius: 4 },
    ],
  }
  const revenueBarData = {
    labels: campusStats.map(c => campusShortName(c.name)),
    datasets: [
      { label: 'Collected',   data: campusStats.map(c => c.revenue),      backgroundColor: '#10b981', borderRadius: 4 },
      { label: 'Outstanding', data: campusStats.map(c => c.outstanding),   backgroundColor: '#ef4444', borderRadius: 4 },
    ],
  }

  const handleExport = () => {
    exportMultipleSheets([
      { data: [
          { Metric: 'Campus', Value: campusLabel },
          { Metric: 'School Year', Value: currentSchoolYear },
          { Metric: 'Total Students', Value: stuTotal },
          { Metric: 'Basic Ed Students', Value: basicStu.length },
          { Metric: 'College Students', Value: collegeStu.length },
          { Metric: 'Total Enrollments', Value: enrTotal },
          { Metric: 'Pending Enrollments', Value: enrPending },
          { Metric: 'Approved Enrollments', Value: enrApproved },
          { Metric: 'Rejected Enrollments', Value: enrRejected },
          { Metric: 'Total Revenue', Value: payRevenue },
          { Metric: 'Outstanding Balance', Value: payOutstanding },
          { Metric: 'Collection Rate', Value: `${collectionRate}%` },
          { Metric: 'Overdue Accounts', Value: payOverdue },
        ], sheetName: 'Summary' },
      { data: campusStats.map(c => ({
          'Campus': c.name,
          'Total Students': c.students,
          'Basic Ed Students': c.basicStu,
          'College Students': c.collegeStu,
          'Total Enrollments': c.enrollments,
          'Pending': c.pending,
          'Approved': c.approved,
          'Rejected': c.rejected,
          'Revenue Collected': c.revenue,
          'Outstanding': c.outstanding,
          'Collection Rate': `${c.collectionRate}%`,
          'Overdue': c.overdue,
        })), sheetName: 'Per Campus' },
    ], `CSHC_Dashboard_${campusFilter}_${new Date().toISOString().split('T')[0]}`)
  }

  if (loading) return <SkeletonDashboard />

  // ─── Registrar dashboards ────────────────────────────────────────
  if (isCollegeReg || isBasicReg) {
    return <RegistrarDashboard user={user} currentSchoolYear={currentSchoolYear} isBasicReg={isBasicReg} />
  }

  // ════════════════════════════════════════════════════════════════
  // ADMIN / ACCOUNTING / PRINCIPAL
  // ════════════════════════════════════════════════════════════════
  return (
    <div className="animate-fade-in space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white">
            {user?.role === 'accounting' ? 'Accounting Dashboard' : user?.role === 'principal_basic' ? 'Principal Dashboard' : 'Admin Dashboard'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {currentSchoolYear} · {campusLabel} · Summary Report
          </p>
        </div>
        <button onClick={handleExport}
          className="self-start flex items-center gap-1.5 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium">
          <Download className="w-4 h-4" /> Export Report
        </button>
      </div>

      {/* Campus-locked banner */}
      <CampusBanner user={user} />

      {/* Grand stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Students"    value={stuTotal.toLocaleString()}  sub={campusLabel} border="border-blue-500" icon={<Users className="w-5 h-5 text-blue-500"/>} />
        <StatCard label="Total Enrollments" value={enrTotal.toLocaleString()}  sub={`${enrPending} awaiting payment · ${enrPaymentReceived} ready for review`} border="border-primary" icon={<FileText className="w-5 h-5 text-primary"/>} />
        <StatCard label="Total Revenue"     value={php(payRevenue)} sub={`${collectionRate}% collection rate`} border="border-green-500" highlight="text-green-600 dark:text-green-400" icon={<DollarSign className="w-5 h-5 text-green-500"/>} />
        <StatCard label="Outstanding"       value={php(payOutstanding)} sub={payOverdue > 0 ? `${payOverdue} overdue accounts` : 'No overdue'} border={payOverdue > 0 ? 'border-red-500' : 'border-gray-300'} highlight={payOutstanding > 0 ? 'text-red-500 dark:text-red-400' : undefined} icon={<AlertCircle className={`w-5 h-5 ${payOverdue > 0 ? 'text-red-500' : 'text-gray-400'}`}/>} />
      </div>

      {/* Per-campus strip */}
      {campusStats.length > 1 && !isAccountingLocked && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {campusStats.map(c => (
            <CampusMiniCard key={c.name} campusStat={c} />
          ))}
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-primary" /> Enrollment Status
          </h3>
          <p className="text-xs text-gray-400 mb-4">{campusLabel}</p>
          <div style={{ height: 200 }} className="flex items-center justify-center">
            {enrTotal > 0 ? <Doughnut data={enrStatusChartData} options={pieOpts} /> : <p className="text-sm text-gray-400">No data</p>}
          </div>
        </div>
        {!isAccounting ? (
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500" /> Students & Enrollments by Campus
            </h3>
            <p className="text-xs text-gray-400 mb-4">{currentSchoolYear}</p>
            <div style={{ height: 200 }}><Bar data={campusBarData} options={baseOpts} /></div>
          </div>
        ) : (
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-500" /> Revenue vs Outstanding
            </h3>
            <p className="text-xs text-gray-400 mb-4">{campusLabel} · {currentSchoolYear}</p>
            <div style={{ height: 200 }}><Bar data={revenueBarData} options={{ ...baseOpts, scales: { ...baseOpts.scales, y: { ...baseOpts.scales.y, ticks: { ...baseOpts.scales.y.ticks, callback: (v) => `₱${(v/1000).toFixed(0)}k` } } } }} /></div>
          </div>
        )}
      </div>


      {/* ══ ENROLLMENTS SECTION ══ */}
      {!isAccounting && <SectionPanel
        title="Enrollments Summary"
        icon={<FileText className="w-4 h-4" />}
        colorCls="text-primary dark:text-red-400 bg-red-50 dark:bg-red-900/10"
        pills={[`${enrTotal} total`, enrPending > 0 && `${enrPending} pending`]}
      >
        {/* Status tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[
            { label: 'Total',             val: enrTotal,            color: 'text-gray-800 dark:text-white',        bg: 'bg-gray-50 dark:bg-gray-700/50' },
            { label: 'Awaiting Payment',  val: enrPending,          color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
            { label: 'Payment Received',  val: enrPaymentReceived,  color: 'text-blue-600 dark:text-blue-400',     bg: 'bg-blue-50 dark:bg-blue-900/20' },
            { label: 'Approved',          val: enrApproved,         color: 'text-green-600 dark:text-green-400',   bg: 'bg-green-50 dark:bg-green-900/20' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-xl p-3 text-center`}>
              <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Basic Ed vs College */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {[
            { label: 'Basic Education', icon: <BookOpen className="w-4 h-4 text-emerald-500"/>, enr: basicEnr },
            { label: 'College',         icon: <GraduationCap className="w-4 h-4 text-blue-500"/>, enr: collegeEnr },
          ].map(d => (
            <div key={d.label} className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                {d.icon}
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{d.label}</p>
                <span className="ml-auto text-sm font-bold text-gray-800 dark:text-white">{d.enr.length}</span>
              </div>
              {[
                { label: 'Pending',  val: d.enr.filter(e=>e.status==='pending').length,  cls:'text-yellow-600 dark:text-yellow-400' },
                { label: 'Approved', val: d.enr.filter(e=>e.status==='approved').length, cls:'text-green-600 dark:text-green-400' },
                { label: 'Rejected', val: d.enr.filter(e=>e.status==='rejected').length, cls:'text-red-500 dark:text-red-400' },
              ].map(r => (
                <div key={r.label} className="flex items-center justify-between text-xs py-0.5">
                  <span className="text-gray-500 dark:text-gray-400">{r.label}</span>
                  <span className={`font-semibold ${r.cls}`}>{r.val}</span>
                </div>
              ))}
            </div>
          ))}
        </div>

        <CampusEnrollmentTable campusStats={campusStats} />

        {filteredEnrollments.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Recent Applications</p>
            <EnrollmentTable enrollments={filteredEnrollments} limit={5} />
          </div>
        )}
      </SectionPanel>}

      {/* ══ STUDENTS SECTION ══ */}
      {!isAccounting && <SectionPanel
        title="Students Summary"
        icon={<Users className="w-4 h-4" />}
        colorCls="text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/10"
        pills={[`${stuTotal} total`]}
      >
        {/* Overview tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-gray-800 dark:text-white">{stuTotal}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Total Students</p>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{basicStu.length}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Basic Education</p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{collegeStu.length}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">College</p>
          </div>
        </div>

        <CampusStudentTable campusStats={campusStats} stuTotal={stuTotal} />
      </SectionPanel>}

      {/* ══ PAYMENTS SECTION ══ */}
      {!isPrincipal && (
        <SectionPanel
          title="Payments Summary"
          icon={<DollarSign className="w-4 h-4" />}
          colorCls="text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/10"
          pills={[`${collectionRate}% collected`, payOverdue > 0 && `${payOverdue} overdue`]}
        >
          {/* Stat tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[
              { label: 'Expected',    val: php(payTotalFee),    color: 'text-gray-800 dark:text-white',       bg: 'bg-gray-50 dark:bg-gray-700/50' },
              { label: 'Collected',   val: php(payRevenue),     color: 'text-green-600 dark:text-green-400',  bg: 'bg-green-50 dark:bg-green-900/20' },
              { label: 'Outstanding', val: php(payOutstanding), color: 'text-red-500 dark:text-red-400',      bg: 'bg-red-50 dark:bg-red-900/20' },
              { label: 'Fully Paid',  val: `${payPaid}`,        color: 'text-blue-600 dark:text-blue-400',    bg: 'bg-blue-50 dark:bg-blue-900/20' },
            ].map(s => (
              <div key={s.label} className={`${s.bg} rounded-xl p-3 text-center`}>
                <p className={`text-xl font-bold ${s.color}`}>{s.val}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          <CollectionRateBar rate={collectionRate} collected={payRevenue} expected={payTotalFee} />

          {/* Revenue chart */}
          <div className="bg-gray-50 dark:bg-gray-700/30 rounded-xl p-4 mt-4">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Revenue by Campus</p>
            <div style={{ height: 160 }}>
              <Bar data={revenueBarData} options={{ ...baseOpts, scales: { ...baseOpts.scales, y: { ...baseOpts.scales.y, ticks: { ...baseOpts.scales.y.ticks, callback: (v) => `₱${(v/1000).toFixed(0)}k` } } } }} />
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

// ─── Registrar Dashboards ─────────────────────────────────────────
function RegistrarDashboard({ user, currentSchoolYear, isBasicReg }) {
  const isBasicGradeLocal = (g) => g?.includes('Grade') || ['Nursery','Kindergarten','Preparatory'].some(x => g?.includes(x))

  const students    = isBasicReg
    ? mockStudents.filter(s => isBasicGradeLocal(s.academic.gradeLevel) && s.academic.campus === user.campus)
    : mockStudents.filter(s => (s.academic.gradeLevel.includes('BS') || s.academic.gradeLevel.includes('Year')) && s.academic.campus === user.campus)

  const enrollments = isBasicReg
    ? mockEnrollments.filter(e => isBasicGradeLocal(e.enrollment.gradeLevel) && e.enrollment.campus === user.campus)
    : mockEnrollments.filter(e => (e.enrollment.gradeLevel.includes('BS') || e.enrollment.gradeLevel.includes('Year')) && e.enrollment.campus === user.campus)

  const stats = {
    total:    enrollments.length,
    pending:  enrollments.filter(e=>e.status==='pending').length,
    approved: enrollments.filter(e=>e.status==='approved').length,
    rejected: enrollments.filter(e=>e.status==='rejected').length,
  }

  const accentColor = isBasicReg ? 'text-emerald-600' : 'text-primary'
  const borderColor = isBasicReg ? 'border-emerald-500' : 'border-primary'

  return (
    <div className="animate-fade-in space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white">
          {isBasicReg ? 'Basic Education' : 'College Registrar'} Dashboard
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{currentSchoolYear} · {user.campus}</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Students"    value={students.length}  sub="Assigned campus" border={borderColor} icon={<Users className="w-5 h-5 text-primary"/>} />
        <StatCard label="Pending Review"    value={stats.pending}    sub={`${stats.total > 0 ? Math.round(stats.pending/stats.total*100) : 0}% of total`} border="border-yellow-500" icon={<Clock className="w-5 h-5 text-yellow-500"/>} />
        <StatCard label="Approved"          value={stats.approved}   sub={`${stats.total > 0 ? Math.round(stats.approved/stats.total*100) : 0}% approval rate`} border="border-green-500" icon={<CheckCircle className="w-5 h-5 text-green-500"/>} />
        <StatCard label="Total Enrollments" value={stats.total}      sub={currentSchoolYear} border="border-blue-500" icon={<FileText className="w-5 h-5 text-blue-500"/>} />
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h3 className={`text-sm font-semibold flex items-center gap-2 ${accentColor}`}>
            <FileText className="w-4 h-4" /> Recent Enrollment Applications
          </h3>
          <span className="text-xs text-gray-400">{enrollments.length} total</span>
        </div>
        {enrollments.length === 0
          ? <p className="px-5 py-10 text-center text-sm text-gray-400">No enrollment data for your campus.</p>
          : <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50"><tr>
                  {['Reference','Student','Level / Program','Type','Status','Date'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr></thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {enrollments.map(e => (
                    <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className={`px-4 py-3 font-mono text-xs ${accentColor} whitespace-nowrap`}>{e.referenceNumber}</td>
                      <td className="px-4 py-3 font-medium text-gray-800 dark:text-white whitespace-nowrap">{e.student.firstName} {e.student.lastName}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">{e.enrollment.gradeLevel}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{e.enrollment.studentType}</td>
                      <td className="px-4 py-3 whitespace-nowrap"><EnrollmentStatusPill status={e.status} /></td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">
                        {new Date(e.submittedDate).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>}
      </div>
    </div>
  )
}