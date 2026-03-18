import { useState, useEffect } from 'react'
import {
  Search, DollarSign, Eye, Download, Receipt, Clock,
  CheckCircle, AlertCircle, XCircle, ChevronRight,
  MapPin, BookOpen, GraduationCap, ChevronDown, ChevronUp,
  TrendingUp, Banknote, X, CreditCard
} from 'lucide-react'
import { mockPayments } from '../data/mockPayments'
import { useAuth } from '../context/AuthContext'
import { useAppConfig } from '../context/AppConfigContext'
import { useCampusFilter } from '../context/CampusFilterContext'
import { exportToExcel, exportMultipleSheets } from '../utils/exportToExcel'
import { PageSkeleton, EmptyState, useToast, ToastContainer } from '../components/UIComponents'
import GradeLevelSelect from '../components/GradeLevelSelect'
import { BASIC_ED_GROUPS, COLLEGE_YEAR_LEVELS } from '../config/appConfig'
import {
  DeptPaymentCard,
  ProgramPaymentCard,
  PaymentStatusBadge as StatusBadge,
  DEPT_STYLES, PROG_COLORS,
  CampusBanner,
} from '../components/SchoolComponents'


// ── helpers ────────────────────────────────────────────────────────
const php = (n) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 0 }).format(n ?? 0)

function isBasicEd(g) {
  return g && (g.includes('Grade') || ['Nursery','Kindergarten','Preparatory'].some(x => g.includes(x)))
}
function isCollege(g) {
  return g && (g.includes('BS') || g.includes('Year'))
}

// ADMIN PAYMENTS OVERVIEW
// ════════════════════════════════════════════════════════════════════
function AdminPaymentsOverview({ payments, campusFilter, activeCampuses, currentSchoolYear, addToast }) {
  const shownCampuses   = campusFilter !== 'all'
    ? activeCampuses.filter(c => c.key === campusFilter)
    : activeCampuses
  const isSingleCampus  = shownCampuses.length === 1

  const allShown        = shownCampuses.flatMap(c => payments.filter(p => p.campus === c.name))
  const grandRevenue    = allShown.reduce((s, p) => s + p.amountPaid, 0)
  const grandOutstanding= allShown.reduce((s, p) => s + p.balance, 0)
  const grandTotalFee   = allShown.reduce((s, p) => s + p.totalFee, 0)
  const grandPaid       = allShown.filter(p => p.status === 'paid').length
  const grandOverdue    = allShown.filter(p => p.status === 'overdue').length

  const handleExport = () => {
    const sheets = shownCampuses.flatMap(campus => {
      const campusPayments = payments.filter(p => p.campus === campus.name)
      const result = []

      if (campus.hasBasicEd) {
        const rows = []
        BASIC_ED_GROUPS.forEach(group => {
          group.options.forEach(grade => {
            const gp = campusPayments.filter(p => p.gradeLevel === grade)
            if (gp.length > 0) rows.push({
              Department: group.label, 'Grade Level': grade, Students: gp.length,
              'Total Fees': gp.reduce((s, p) => s + p.totalFee, 0),
              'Collected':  gp.reduce((s, p) => s + p.amountPaid, 0),
              'Outstanding': gp.reduce((s, p) => s + p.balance, 0),
              'Paid': gp.filter(p => p.status === 'paid').length,
              'Partial': gp.filter(p => p.status === 'partial').length,
              'Overdue': gp.filter(p => p.status === 'overdue').length,
            })
          })
        })
        if (rows.length) result.push({ data: rows, sheetName: `${campus.key}_BasicEd` })
      }

      if (campus.hasCollege && campus.collegePrograms?.length) {
        const rows = []
        campus.collegePrograms.forEach(prog => {
          COLLEGE_YEAR_LEVELS.forEach(yr => {
            const key = `${prog} - ${yr}`
            const gp  = campusPayments.filter(p => p.gradeLevel === key)
            if (gp.length > 0) rows.push({
              Program: prog, 'Year Level': yr, Students: gp.length,
              'Total Fees': gp.reduce((s, p) => s + p.totalFee, 0),
              'Collected':  gp.reduce((s, p) => s + p.amountPaid, 0),
              'Outstanding': gp.reduce((s, p) => s + p.balance, 0),
              'Paid': gp.filter(p => p.status === 'paid').length,
              'Partial': gp.filter(p => p.status === 'partial').length,
              'Overdue': gp.filter(p => p.status === 'overdue').length,
            })
          })
        })
        if (rows.length) result.push({ data: rows, sheetName: `${campus.key}_College` })
      }

      return result
    })

    if (sheets.length) {
      exportMultipleSheets(sheets, `CSHC_Payments_${campusFilter !== 'all' ? campusFilter : 'All'}_${new Date().toISOString().split('T')[0]}`)
      addToast('Payment summary exported!', 'success')
    }
  }

  return (
    <div className="animate-fade-in space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white">Payments</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {currentSchoolYear} · {isSingleCampus ? `${shownCampuses[0].name} payment overview` : 'School-wide income and payment overview'}
          </p>
        </div>
        <button onClick={handleExport}
          className="self-start sm:self-auto flex items-center gap-1.5 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium">
          <Download className="w-4 h-4" /> Export
        </button>
      </div>

      {/* Grand stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Total Revenue',     value: php(grandRevenue),    border: 'border-green-500',  icon: <TrendingUp className="w-5 h-5 text-green-500"/>, sub: `${grandTotalFee > 0 ? Math.round((grandRevenue/grandTotalFee)*100) : 0}% collected`, cls: 'text-green-600 dark:text-green-400' },
          { label: 'Outstanding',       value: php(grandOutstanding),border: 'border-red-400',    icon: <Banknote className="w-5 h-5 text-red-400"/>,    sub: 'Pending collection', cls: 'text-red-500 dark:text-red-400' },
          { label: 'Fully Paid',        value: grandPaid,            border: 'border-blue-500',   icon: <CheckCircle className="w-5 h-5 text-blue-500"/>, sub: `${allShown.length > 0 ? Math.round((grandPaid/allShown.length)*100) : 0}% of students`, cls: 'text-blue-600 dark:text-blue-400' },
          { label: 'Overdue Accounts',  value: grandOverdue,         border: 'border-orange-400', icon: <AlertCircle className="w-5 h-5 text-orange-400"/>,sub: 'Requires follow-up', cls: grandOverdue > 0 ? 'text-orange-500 dark:text-orange-400' : 'text-gray-400' },
        ].map(({ label, value, border, icon, sub, cls }) => (
          <div key={label} className={`bg-white dark:bg-gray-800 rounded-xl p-4 border-l-4 ${border} shadow-sm`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
              {icon}
            </div>
            <p className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">{value}</p>
            <p className={`text-xs mt-1 font-medium ${cls}`}>{sub}</p>
          </div>
        ))}
      </div>

      {/* Collection rate bar (only when showing all or single campus) */}
      {grandTotalFee > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Overall Collection Rate</h3>
            <span className="text-sm font-bold text-gray-700 dark:text-gray-200">
              {Math.round((grandRevenue / grandTotalFee) * 100)}%
            </span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
            <div className="bg-green-500 h-full rounded-full transition-all duration-700"
              style={{ width: `${(grandRevenue / grandTotalFee) * 100}%` }} />
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-400">
            <span>Collected: <span className="font-semibold text-green-600 dark:text-green-400">{php(grandRevenue)}</span></span>
            <span>Total Expected: <span className="font-semibold text-gray-600 dark:text-gray-300">{php(grandTotalFee)}</span></span>
          </div>

          {/* Campus mini-bars */}
          {!isSingleCampus && (
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 space-y-2">
              {shownCampuses.map(campus => {
                const cp  = payments.filter(p => p.campus === campus.name)
                const cr  = cp.reduce((s, p) => s + p.amountPaid, 0)
                const ctf = cp.reduce((s, p) => s + p.totalFee, 0)
                const pct = ctf > 0 ? Math.round((cr / ctf) * 100) : 0
                return (
                  <div key={campus.key} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 dark:text-gray-400 w-36 flex-shrink-0 truncate">{campus.name}</span>
                    <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                      <div className="bg-green-500 h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 w-10 text-right">{pct}%</span>
                    <span className="text-xs text-green-600 dark:text-green-400 w-28 text-right hidden sm:block">{php(cr)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
        <span className="font-medium">Bar legend:</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> Collected</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-600 inline-block" /> Outstanding</span>
      </div>

      {/* Per-campus sections */}
      {shownCampuses.map(campus => {
        const campusPayments  = payments.filter(p => p.campus === campus.name)
        const campusRevenue   = campusPayments.reduce((s, p) => s + p.amountPaid, 0)
        const campusTotalFee  = campusPayments.reduce((s, p) => s + p.totalFee, 0)
        const basicPayments   = campusPayments.filter(p => isBasicEd(p.gradeLevel))
        const collegePayments = campusPayments.filter(p => isCollege(p.gradeLevel))

        return (
          <div key={campus.key} className="space-y-4">
            {/* Campus divider */}
            {!isSingleCampus && (
              <div className="flex items-center gap-3 pt-2">
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
                <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-full">
                  <MapPin className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                  <span className="text-xs font-bold uppercase tracking-widest text-gray-600 dark:text-gray-300">{campus.name}</span>
                  <span className="text-xs text-green-600 dark:text-green-400 font-semibold">· {php(campusRevenue)} collected</span>
                </div>
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
              </div>
            )}

            {/* Campus income summary strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total Expected', value: php(campusTotalFee),                                        cls: 'text-gray-700 dark:text-gray-200' },
                { label: 'Collected',      value: php(campusRevenue),                                         cls: 'text-green-600 dark:text-green-400' },
                { label: 'Outstanding',    value: php(campusPayments.reduce((s,p)=>s+p.balance,0)),           cls: 'text-red-500 dark:text-red-400' },
                { label: 'Collection Rate',value: `${campusTotalFee>0?Math.round((campusRevenue/campusTotalFee)*100):0}%`, cls: 'text-blue-600 dark:text-blue-400' },
              ].map(({ label, value, cls }) => (
                <div key={label} className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm text-center">
                  <p className="text-xs text-gray-400 mb-1">{label}</p>
                  <p className={`text-base font-bold ${cls}`}>{value}</p>
                </div>
              ))}
            </div>

            {/* Basic Education */}
            {campus.hasBasicEd && basicPayments.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
                    <BookOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h2 className="text-sm font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider">Basic Education</h2>
                  <span className="text-xs text-green-600 dark:text-green-400 font-semibold">
                    · {php(basicPayments.reduce((s,p)=>s+p.amountPaid,0))} collected
                  </span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {BASIC_ED_GROUPS.map(group => (
                    <DeptPaymentCard key={group.label} group={group} payments={basicPayments} />
                  ))}
                </div>
              </div>
            )}

            {/* College */}
            {campus.hasCollege && campus.collegePrograms?.length > 0 && collegePayments.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-primary/10 dark:bg-primary/20 rounded-lg flex items-center justify-center">
                    <GraduationCap className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <h2 className="text-sm font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider">College</h2>
                  <span className="text-xs text-green-600 dark:text-green-400 font-semibold">
                    · {php(collegePayments.reduce((s,p)=>s+p.amountPaid,0))} collected
                  </span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {campus.collegePrograms.map((prog, idx) => (
                    <ProgramPaymentCard key={prog} program={prog} colorIdx={idx} payments={collegePayments} />
                  ))}
                </div>
              </div>
            )}

            {!campus.hasCollege && (
              <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl text-sm text-gray-400">
                <GraduationCap className="w-4 h-4" /> No college department at this campus
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
export default function Payments() {
  const { user } = useAuth()
  const { activeCampuses, currentSchoolYear } = useAppConfig()

  // Campus-locked accounting: scope all data to user.campus
  const isAccountingLocked = user?.role === 'accounting' && user?.campus !== 'all'
  const accountingCampus   = isAccountingLocked ? user.campus : null

  const [payments]                          = useState(mockPayments)
  const [searchQuery, setSearchQuery]       = useState('')
  const [statusFilter, setStatusFilter]     = useState('all')
  const [gradeLevelFilter, setGradeLevelFilter] = useState('all')
  const [selectedPayment, setSelectedPayment] = useState(null)
  const [showModal, setShowModal]           = useState(false)
  const { campusFilter } = useCampusFilter()
  const [loading, setLoading]               = useState(true)
  const { toasts, addToast, removeToast }   = useToast()

  useEffect(() => { const t = setTimeout(() => setLoading(false), 700); return () => clearTimeout(t) }, [])
  useEffect(() => {
    setLoading(true); setGradeLevelFilter('all')
    const t = setTimeout(() => setLoading(false), 400)
    return () => clearTimeout(t)
  }, [campusFilter])

  if (loading) return <PageSkeleton title="Payments" />

  // ── Admin: full overview ─────────────────────────────────────
  if (user?.role === 'admin') {
    return (
      <>
        <AdminPaymentsOverview
          payments={payments}
          campusFilter={campusFilter}
          activeCampuses={activeCampuses}
          currentSchoolYear={currentSchoolYear}
          addToast={addToast}
        />
        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </>
    )
  }

  // ── Accounting: detailed list view ─────────────────────────────
  // Campus-locked accounting sees only their campus; global accounting respects campusFilter
  const baseCampusFilter = isAccountingLocked
    ? accountingCampus
    : (campusFilter !== 'all' ? activeCampuses.find(c => c.key === campusFilter)?.name : null)

  const filtered = payments.filter(p =>
    (p.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
     p.studentId.toLowerCase().includes(searchQuery.toLowerCase())) &&
    (statusFilter === 'all' || p.status === statusFilter) &&
    (!baseCampusFilter || p.campus === baseCampusFilter) &&
    (gradeLevelFilter === 'all' || p.gradeLevel === gradeLevelFilter || p.gradeLevel.startsWith(gradeLevelFilter + ' -'))
  )

  const stats = {
    revenue:     filtered.reduce((s, p) => s + p.amountPaid, 0),
    outstanding: filtered.reduce((s, p) => s + p.balance, 0),
    totalFee:    filtered.reduce((s, p) => s + p.totalFee, 0),
    paid:        filtered.filter(p => p.status === 'paid').length,
    overdue:     filtered.filter(p => p.status === 'overdue').length,
  }
  const collectionRate = stats.totalFee > 0 ? Math.round((stats.revenue / stats.totalFee) * 100) : 0

  const handleExport = () => {
    const data = filtered.map(p => ({
      'Student ID': p.studentId, 'Student Name': p.studentName,
      'Campus': p.campus, 'Grade / Program': p.gradeLevel,
      'Total Fee': p.totalFee, 'Amount Paid': p.amountPaid, 'Balance': p.balance,
      'Status': p.status.toUpperCase(), 'Payment Method': p.paymentMethod || '—',
      'Last Payment': p.lastPaymentDate ? new Date(p.lastPaymentDate).toLocaleDateString() : '—',
      'Due Date': new Date(p.dueDate).toLocaleDateString(),
    }))
    exportToExcel(data, `Payments_${new Date().toISOString().split('T')[0]}`, 'Payments')
    addToast(`Exported ${data.length} records!`, 'success')
  }

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white">Payments</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {isAccountingLocked ? `${accountingCampus} · Payment records` : 'Track and manage student payment records'}
          </p>
        </div>
        <button onClick={handleExport}
          className="self-start flex items-center gap-1.5 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium">
          <Download className="w-4 h-4" /> Export
        </button>
      </div>

      {/* Campus-locked banner */}
      <CampusBanner user={user} />

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label:'Total Revenue',    value:php(stats.revenue),     bg:'bg-green-600',   icon:<DollarSign className="w-5 h-5"/>, sub:'Collected payments' },
          { label:'Outstanding',      value:php(stats.outstanding), bg:'bg-yellow-500',  icon:<Clock className="w-5 h-5"/>,     sub:'Pending collection' },
          { label:'Fully Paid',       value:stats.paid,             bg:'bg-blue-600',    icon:<CheckCircle className="w-5 h-5"/>,sub:'Students' },
          { label:'Overdue',          value:stats.overdue,          bg:'bg-red-600',     icon:<AlertCircle className="w-5 h-5"/>,sub:'Requires follow-up' },
        ].map(({ label, value, bg, icon, sub }) => (
          <div key={label} className={`${bg} rounded-xl p-4 text-white shadow-sm`}>
            <div className="flex items-center justify-between mb-2 opacity-80">{icon}<CheckCircle className="w-4 h-4 opacity-50" /></div>
            <p className="text-xs opacity-80 mb-1">{label}</p>
            <p className="text-xl font-bold">{value}</p>
            <p className="text-xs opacity-70 mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search student name or ID…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-primary outline-none transition" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-primary outline-none">
            <option value="all">All Status</option>
            <option value="paid">Paid</option>
            <option value="partial">Partial</option>
            <option value="overdue">Overdue</option>
            <option value="pending">Pending</option>
          </select>
          <div>
            <GradeLevelSelect value={gradeLevelFilter} onChange={setGradeLevelFilter}
              campusFilter={isAccountingLocked
                ? (activeCampuses.find(c => c.name === accountingCampus)?.key || 'all')
                : campusFilter}
              userRole={user?.role} />
          </div>
          <div className="col-span-2 flex justify-end">
            <button onClick={handleExport}
              className="px-4 py-2.5 text-sm bg-primary text-white rounded-lg hover:bg-accent-burgundy transition flex items-center gap-1.5 font-medium">
              <Download className="w-4 h-4" /> Export Records
            </button>
          </div>
        </div>
      </div>

      {/* Payment list */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        {filtered.length === 0 ? <EmptyState type="search" /> : (
          <>
            {/* Mobile cards */}
            <ul className="md:hidden divide-y divide-gray-100 dark:divide-gray-700">
              {filtered.map(p => (
                <li key={p.id}>
                  <button onClick={() => { setSelectedPayment(p); setShowModal(true) }}
                    className="w-full text-left px-4 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition flex items-start gap-3">
                    <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Receipt className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-gray-800 dark:text-white truncate">{p.studentName}</span>
                        <StatusBadge status={p.status} />
                      </div>
                      <p className="text-xs font-mono text-primary dark:text-red-400">{p.studentId}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-gray-500 dark:text-gray-400">{p.gradeLevel}</span>
                        <span className="text-sm font-bold text-green-600 dark:text-green-400">{php(p.amountPaid)}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
                  </button>
                </li>
              ))}
            </ul>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    {['Student','Campus','Grade / Program','Total Fee','Paid','Balance','Status','Last Payment','Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filtered.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="text-sm font-medium text-gray-800 dark:text-white">{p.studentName}</p>
                        <p className="text-xs font-mono text-primary dark:text-red-400">{p.studentId}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">{p.campus}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">{p.gradeLevel}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200 whitespace-nowrap font-medium">{php(p.totalFee)}</td>
                      <td className="px-4 py-3 text-sm text-green-600 dark:text-green-400 whitespace-nowrap font-semibold">{php(p.amountPaid)}</td>
                      <td className="px-4 py-3 text-sm whitespace-nowrap font-semibold">
                        <span className={p.balance > 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-400'}>{p.balance > 0 ? php(p.balance) : '—'}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={p.status} /></td>
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {p.lastPaymentDate ? new Date(p.lastPaymentDate).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button onClick={() => { setSelectedPayment(p); setShowModal(true) }}
                          className="inline-flex items-center gap-1 text-sm text-primary dark:text-red-400 hover:text-accent-burgundy font-medium transition">
                          <Eye className="w-4 h-4" /> View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-400">
              Showing {filtered.length} of {payments.length} records
            </div>
          </>
        )}
      </div>

      {/* Payment detail modal */}
      {showModal && selectedPayment && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-[9999] p-0 sm:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <Receipt className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-gray-800 dark:text-white truncate">{selectedPayment.studentName}</h2>
                  <p className="text-xs font-mono text-primary dark:text-red-400">{selectedPayment.studentId}</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={selectedPayment.status} />
                <span className="text-xs text-gray-500 dark:text-gray-400">{selectedPayment.campus} · {selectedPayment.gradeLevel}</span>
              </div>

              {/* Fee summary */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Total Fee',    value: php(selectedPayment.totalFee),    cls: 'text-gray-800 dark:text-white'        },
                  { label: 'Amount Paid',  value: php(selectedPayment.amountPaid),  cls: 'text-green-600 dark:text-green-400'   },
                  { label: 'Balance',      value: php(selectedPayment.balance),     cls: selectedPayment.balance > 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-400' },
                ].map(({ label, value, cls }) => (
                  <div key={label} className="bg-gray-50 dark:bg-gray-700/40 rounded-xl p-3 text-center">
                    <p className="text-xs text-gray-400 mb-1">{label}</p>
                    <p className={`text-base font-bold ${cls}`}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Progress */}
              {selectedPayment.totalFee > 0 && (
                <div>
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                    <span>Payment Progress</span>
                    <span>{Math.round((selectedPayment.amountPaid / selectedPayment.totalFee) * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                    <div className="bg-green-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${(selectedPayment.amountPaid / selectedPayment.totalFee) * 100}%` }} />
                  </div>
                </div>
              )}

              {/* Payment details */}
              <div className="bg-gray-50 dark:bg-gray-700/40 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
                  <CreditCard className="w-4 h-4" /> Payment Details
                </h3>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  {[
                    ['Payment Method', selectedPayment.paymentMethod || '—'],
                    ['Due Date', selectedPayment.dueDate ? new Date(selectedPayment.dueDate).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}) : '—'],
                    ['Last Payment', selectedPayment.lastPaymentDate ? new Date(selectedPayment.lastPaymentDate).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}) : '—'],
                    ['Installments', selectedPayment.paymentHistory.length],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                      <p className="font-medium text-gray-800 dark:text-white">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment history */}
              {selectedPayment.paymentHistory.length > 0 && (
                <div className="bg-gray-50 dark:bg-gray-700/40 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
                    <Receipt className="w-4 h-4" /> Payment History
                  </h3>
                  <div className="space-y-2">
                    {selectedPayment.paymentHistory.map(h => (
                      <div key={h.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-600 last:border-0">
                        <div>
                          <p className="text-xs font-mono text-primary dark:text-red-400">{h.orNumber}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{h.method} · {new Date(h.date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</p>
                          {h.notes && <p className="text-xs text-gray-400 italic mt-0.5">{h.notes}</p>}
                        </div>
                        <p className="text-sm font-bold text-green-600 dark:text-green-400">{php(h.amount)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 flex-shrink-0">
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition font-medium">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  )
}