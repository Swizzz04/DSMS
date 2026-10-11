import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Search, DollarSign, Eye, Download, Receipt, Clock,
  CheckCircle, AlertCircle, XCircle, ChevronRight,
  MapPin, BookOpen, GraduationCap, ChevronDown, ChevronUp,
  TrendingUp, Banknote, X, CreditCard, Printer, Plus, Calendar,
  FileText, Users, Filter, Tag, Building2
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useAppConfig } from '../context/AppConfigContext'
import { useCampusFilter } from '../context/CampusFilterContext'
import { exportToExcel, exportMultipleSheets } from '../utils/exportToExcel'
import { PageSkeleton, EmptyState, useToast, ToastContainer, ModalPortal, ExportButton } from '../components/UIComponents'
import GroupedSelect from '../components/GroupedSelect'
import SchoolLogo from '../components/SchoolLogo'
import DatePicker from '../components/DatePicker'
import { BASIC_ED_GROUPS, COLLEGE_YEAR_LEVELS, computeDefaultDueDate, isPastDue, daysPast, toYMD, todayYMD } from '../config/appConfig'
import { isOrNumberUsed } from '../utils/orNumbers'
import {
  DeptPaymentCard,
  ProgramPaymentCard,
  PaymentStatusBadge as StatusBadge,
  DEPT_STYLES, PROG_COLORS
} from '../components/SchoolComponents'


// ── helpers ────────────────────────────────────────────────────────
const php = (n) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 0 }).format(n ?? 0)

/**
 * Reads school name + brand colors from almirene_website_content (School Info
 * settings), the same source Sidebar.jsx / Login.jsx already read from.
 * Falls back to whatever --color-primary/--color-secondary are currently
 * applied on the page (set by themeInitializer.js) if no brand color has
 * been configured yet — never hardcodes a specific school's colors.
 */
function getSchoolBrand() {
  let name = 'School Management System'
  let logo = ''
  let primaryColor = '#F4FAFC'
  let secondaryColor = '#212121'
  try {
    const saved = JSON.parse(localStorage.getItem('almirene_website_content') || '{}')
    if (saved.schoolName)     name = saved.schoolName
    if (saved.logoUrl)        logo = saved.logoUrl
    if (saved.primaryColor)   primaryColor = saved.primaryColor
    else if (typeof document !== 'undefined') {
      const v = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim()
      if (v) primaryColor = v
    }
    if (saved.secondaryColor) secondaryColor = saved.secondaryColor
    else if (typeof document !== 'undefined') {
      const v = getComputedStyle(document.documentElement).getPropertyValue('--color-secondary').trim()
      if (v) secondaryColor = v
    }
  } catch {}
  return { name, logo, primaryColor, secondaryColor }
}

// ADMIN PAYMENTS OVERVIEW
// ════════════════════════════════════════════════════════════════════
function AdminPaymentsOverview({ payments, campusFilter, activeCampuses, currentSchoolYear, addToast, onRecordPayment }) {
  const { isBasicGrade, isCollegeGrade } = useAppConfig()
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
              'Overdue': gp.filter(p => p.status === 'overdue').length
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
              'Overdue': gp.filter(p => p.status === 'overdue').length
            })
          })
        })
        if (rows.length) result.push({ data: rows, sheetName: `${campus.key}_College` })
      }

      return result
    })

    if (sheets.length) {
      exportMultipleSheets(sheets, `ALMIRENE_Payments_${campusFilter !== 'all' ? campusFilter : 'All'}_${new Date().toISOString().split('T')[0]}`)
      addToast('Payment summary exported!', 'success')
    }
  }

  return (
    <div className="animate-fade-in space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)]">Payments</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {currentSchoolYear} · {isSingleCampus ? `${shownCampuses[0].name} payment overview` : 'School-wide income and payment overview'}
          </p>
        </div>
        <button onClick={handleExport}
          className="self-start sm:self-auto flex items-center gap-1.5 px-4 py-2 text-sm bg-primary text-[var(--color-primary-contrast)] rounded-lg hover:bg-[var(--color-primary-hover)] transition font-medium">
          <Download className="w-4 h-4" /> Export
        </button>
      </div>

      {/* Grand stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Total Revenue',     value: php(grandRevenue),    border: 'border-[var(--color-success)]',  icon: <TrendingUp className="w-5 h-5 text-[var(--color-success-text)]"/>, sub: `${grandTotalFee > 0 ? Math.round((grandRevenue/grandTotalFee)*100) : 0}% collected`, cls: 'text-[var(--color-success-text)]' },
          { label: 'Outstanding',       value: php(grandOutstanding),border: 'border-[var(--color-error)]',    icon: <Banknote className="w-5 h-5 text-[var(--color-error-text)]"/>,    sub: 'Pending collection', cls: 'text-[var(--color-error-text)]' },
          { label: 'Fully Paid',        value: grandPaid,            border: 'border-[var(--color-info)]',   icon: <CheckCircle className="w-5 h-5 text-[var(--color-info-text)]"/>, sub: `${allShown.length > 0 ? Math.round((grandPaid/allShown.length)*100) : 0}% of students`, cls: 'text-[var(--color-info-text)]' },
          { label: 'Overdue Accounts',  value: grandOverdue,         border: 'border-[var(--color-warning)]', icon: <AlertCircle className="w-5 h-5 text-[var(--color-warning-text)]"/>,sub: 'Requires follow-up', cls: grandOverdue > 0 ? 'text-[var(--color-warning-text)]' : 'text-[var(--color-text-muted)]' },
        ].map(({ label, value, border, icon, sub, cls }) => (
          <div key={label} className={`bg-[var(--color-bg-card)] rounded-xl p-4 border-l-4 ${border} shadow-sm`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
              {icon}
            </div>
            <p className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">{value}</p>
            <p className={`text-xs mt-1 font-medium ${cls}`}>{sub}</p>
          </div>
        ))}
      </div>

      {/* Collection rate bar (only when showing all or single campus) */}
      {grandTotalFee > 0 && (
        <div className="bg-[var(--color-bg-card)] rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Overall Collection Rate</h3>
            <span className="text-sm font-bold text-[var(--color-text-primary)]">
              {Math.round((grandRevenue / grandTotalFee) * 100)}%
            </span>
          </div>
          <div className="w-full bg-[var(--color-bg-subtle)] rounded-full h-3 overflow-hidden">
            <div className="bg-[var(--color-success)] h-full rounded-full transition-all duration-700"
              style={{ width: `${(grandRevenue / grandTotalFee) * 100}%` }} />
          </div>
          <div className="flex justify-between mt-2 text-xs text-[var(--color-text-muted)]">
            <span>Collected: <span className="font-semibold text-[var(--color-success-text)]">{php(grandRevenue)}</span></span>
            <span>Total Expected: <span className="font-semibold text-[var(--color-text-secondary)]">{php(grandTotalFee)}</span></span>
          </div>

          {/* Campus mini-bars */}
          {!isSingleCampus && (
            <div className="mt-4 pt-4 border-t border-[var(--color-border)] space-y-2">
              {shownCampuses.map(campus => {
                const cp  = payments.filter(p => p.campus === campus.name)
                const cr  = cp.reduce((s, p) => s + p.amountPaid, 0)
                const ctf = cp.reduce((s, p) => s + p.totalFee, 0)
                const pct = ctf > 0 ? Math.round((cr / ctf) * 100) : 0
                return (
                  <div key={campus.key} className="flex items-center gap-3">
                    <span className="text-xs text-[var(--color-text-muted)] w-36 flex-shrink-0 truncate">{campus.name}</span>
                    <div className="flex-1 bg-[var(--color-bg-subtle)] rounded-full h-2 overflow-hidden">
                      <div className="bg-[var(--color-success)] h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-[var(--color-text-secondary)] w-10 text-right">{pct}%</span>
                    <span className="text-xs text-[var(--color-success-text)] w-28 text-right hidden sm:block">{php(cr)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-[var(--color-text-muted)]">
        <span className="font-medium">Bar legend:</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[var(--color-success)] inline-block" /> Collected</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[var(--color-border-strong)] inline-block" /> Outstanding</span>
      </div>

      {/* Per-campus sections */}
      {shownCampuses.map(campus => {
        const campusPayments  = payments.filter(p => p.campus === campus.name)
        const campusRevenue   = campusPayments.reduce((s, p) => s + p.amountPaid, 0)
        const campusTotalFee  = campusPayments.reduce((s, p) => s + p.totalFee, 0)
        const basicPayments   = campusPayments.filter(p => isBasicGrade(p.gradeLevel))
        const collegePayments = campusPayments.filter(p => isCollegeGrade(p.gradeLevel))

        return (
          <div key={campus.key} className="space-y-4">
            {/* Campus divider */}
            {!isSingleCampus && (
              <div className="flex items-center gap-3 pt-2">
                <div className="flex-1 h-px bg-[var(--color-border)]" />
                <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-bg-subtle)] rounded-full">
                  <MapPin className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                  <span className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-secondary)]">{campus.name}</span>
                  <span className="text-xs text-[var(--color-success-text)] font-semibold">· {php(campusRevenue)} collected</span>
                </div>
                <div className="flex-1 h-px bg-[var(--color-border)]" />
              </div>
            )}

            {/* Campus income summary strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total Expected', value: php(campusTotalFee),                                        cls: 'text-[var(--color-text-primary)]' },
                { label: 'Collected',      value: php(campusRevenue),                                         cls: 'text-[var(--color-success-text)]' },
                { label: 'Outstanding',    value: php(campusPayments.reduce((s,p)=>s+p.balance,0)),           cls: 'text-[var(--color-error-text)]' },
                { label: 'Collection Rate',value: `${campusTotalFee>0?Math.round((campusRevenue/campusTotalFee)*100):0}%`, cls: 'text-[var(--color-info-text)]' },
              ].map(({ label, value, cls }) => (
                <div key={label} className="bg-[var(--color-bg-card)] rounded-xl p-3 shadow-sm text-center">
                  <p className="text-xs text-[var(--color-text-muted)] mb-1">{label}</p>
                  <p className={`text-base font-bold ${cls}`}>{value}</p>
                </div>
              ))}
            </div>

            {/* Basic Education */}
            {campus.hasBasicEd && basicPayments.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-[var(--color-success-light)] rounded-lg flex items-center justify-center">
                    <BookOpen className="w-3.5 h-3.5 text-[var(--color-success-text)]" />
                  </div>
                  <h2 className="text-sm font-bold text-[var(--color-text-primary)] uppercase tracking-wider">Basic Education</h2>
                  <span className="text-xs text-[var(--color-success-text)] font-semibold">
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
                    <GraduationCap className="w-3.5 h-3.5 text-[var(--color-primary-readable)]" />
                  </div>
                  <h2 className="text-sm font-bold text-[var(--color-text-primary)] uppercase tracking-wider">College</h2>
                  <span className="text-xs text-[var(--color-success-text)] font-semibold">
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
              <div className="flex items-center gap-2 px-4 py-3 bg-[var(--color-bg-subtle)] rounded-xl text-sm text-[var(--color-text-muted)]">
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

// ── OR Number generator ───────────────────────────────────────────
// Status comes from the balance and the due date:
//   paid     → nothing left to pay
//   overdue  → balance left AND the due date has passed
//   partial  → balance left, still within the due date
function derivePaymentStatus(balance, dueDate) {
  if ((balance || 0) <= 0) return 'paid'
  return isPastDue(dueDate) ? 'overdue' : 'partial'
}

const fmtLongDate = (d) => d
  ? new Date((toYMD(d) || '') + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  : '—'
const fmtShortDate = (d) => d
  ? new Date((toYMD(d) || '') + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  : '—'

function generateOR(prefix = 'OR') {
  const now = new Date()
  const yr  = now.getFullYear().toString().slice(-2)
  const mo  = String(now.getMonth() + 1).padStart(2, '0')
  const rnd = Math.floor(Math.random() * 9000 + 1000)
  return `${prefix}-${yr}${mo}-${rnd}`
}

// ── Receipt Preview + Print ───────────────────────────────────────
function ReceiptPreview({ payment, newTransaction, schoolName, cashierName, schoolYear, onClose, onPrint }) {
  const receiptRef = useRef(null)
  const totalPaidAfter = payment.amountPaid + newTransaction.amount
  const balanceAfter   = payment.totalFee - totalPaidAfter
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
  const timeStr = now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })

  const ReceiptCopy = ({ copyLabel }) => (
    <div className="receipt-copy border border-[var(--color-border)] rounded-lg p-5 bg-[var(--color-bg-card)] text-[var(--color-text-primary)]" style={{ fontFamily: 'Georgia, serif', fontSize: '13px' }}>
      {/* Header */}
      <div className="text-center mb-3 pb-3 border-b-2 border-double border-[var(--color-border-strong)]">
        <div className="flex justify-center mb-1">
          <SchoolLogo src={getSchoolBrand().logo} alt="School Logo" size="sm" surface="light" style={{ height: 52, width: 52, objectFit: 'contain' }} />
        </div>
        <p className="font-bold text-sm uppercase tracking-wide" style={{ color: 'var(--color-primary)' }}>{schoolName}</p>
        <p className="text-xs text-[var(--color-text-muted)]">{payment.campus}</p>
        <p className="text-xs text-[var(--color-text-muted)]">School Year {schoolYear}</p>
        <div className="mt-2 inline-block border border-[var(--color-border-strong)] px-3 py-0.5 rounded text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
          Official Receipt
        </div>
      </div>

      {/* OR info row */}
      <div className="flex justify-between text-xs mb-3">
        <div>
          <span className="text-[var(--color-text-muted)]">OR No.: </span>
          <span className="font-bold font-mono">{newTransaction.orNumber}</span>
        </div>
        <div className="text-right">
          <div><span className="text-[var(--color-text-muted)]">Date: </span><span className="font-semibold">{dateStr}</span></div>
          <div><span className="text-[var(--color-text-muted)]">Time: </span><span className="font-semibold">{timeStr}</span></div>
        </div>
      </div>

      {/* Student info */}
      <div className="bg-[var(--color-bg-subtle)] rounded p-3 mb-3 text-xs space-y-1">
        <div className="flex gap-2">
          <span className="text-[var(--color-text-muted)] w-20 flex-shrink-0">Student:</span>
          <span className="font-bold">{payment.studentName}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-[var(--color-text-muted)] w-20 flex-shrink-0">Ref. No.:</span>
          <span className="font-mono">{payment.studentId}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-[var(--color-text-muted)] w-20 flex-shrink-0">Program:</span>
          <span>{payment.gradeLevel}</span>
        </div>
      </div>

      {/* Payment breakdown */}
      <table className="w-full text-xs mb-3">
        <thead>
          <tr className="border-b border-[var(--color-border)]">
            <th className="text-left py-1 text-[var(--color-text-muted)] font-normal">Description</th>
            <th className="text-right py-1 text-[var(--color-text-muted)] font-normal">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="py-1">{newTransaction.notes || 'Tuition / Miscellaneous Fee'}</td>
            <td className="py-1 text-right font-mono font-bold">₱{newTransaction.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
          </tr>
          <tr>
            <td className="py-1 text-[var(--color-text-muted)]">Payment Method</td>
            <td className="py-1 text-right">{newTransaction.method}</td>
          </tr>
        </tbody>
      </table>

      {/* Totals */}
      <div className="border-t border-[var(--color-border)] pt-2 mb-3 space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-[var(--color-text-muted)]">Total Fee:</span>
          <span className="font-mono">₱{payment.totalFee.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--color-text-muted)]">Previously Paid:</span>
          <span className="font-mono">₱{payment.amountPaid.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="flex justify-between font-bold text-sm border-t border-[var(--color-border)] pt-1 mt-1">
          <span style={{ color: 'var(--color-primary)' }}>Amount This Payment:</span>
          <span className="font-mono" style={{ color: 'var(--color-primary)' }}>₱{newTransaction.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--color-text-muted)]">Total Paid:</span>
          <span className="font-mono font-semibold text-[var(--color-success-text)]">₱{totalPaidAfter.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--color-text-muted)]">Remaining Balance:</span>
          <span className={`font-mono font-semibold ${balanceAfter > 0 ? 'text-[var(--color-error-text)]' : 'text-[var(--color-success-text)]'}`}>
            ₱{balanceAfter.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-dashed border-[var(--color-border)] pt-3 text-xs text-center text-[var(--color-text-muted)]">
        <div className="flex justify-between items-end mt-4">
          <div className="text-center">
            <div className="border-t border-[var(--color-border-strong)] pt-1 w-32">
              <p className="font-semibold text-[var(--color-text-secondary)]">{cashierName}</p>
              <p>Cashier / Accounting</p>
            </div>
          </div>
          <div className="text-center">
            <div className="border-t border-[var(--color-border-strong)] pt-1 w-32">
              <p className="italic text-[var(--color-text-muted)]">Received by</p>
              <p>Student / Parent</p>
            </div>
          </div>
        </div>
        <p className="mt-3 text-[var(--color-text-muted)] text-[10px]">{copyLabel} — Thank you for your payment!</p>
      </div>
    </div>
  )

  const handlePrint = () => {
    const printContent = receiptRef.current?.innerHTML
    if (!printContent) return
    const { primaryColor, secondaryColor } = getSchoolBrand()
    const w = window.open('', '_blank', 'width=700,height=900')
    w.document.write(`<!DOCTYPE html><html><head><title>Official Receipt - ${payment.studentName}</title>
      <style>
        :root { --color-primary: ${primaryColor}; --color-secondary: ${secondaryColor}; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Georgia, serif; font-size: 13px; color: #111; background: #fff; }
        .print-page { width: 100%; padding: 16px; }
        .receipt-pair { display: flex; gap: 16px; }
        .receipt-copy { flex: 1; border: 1px solid #999; border-radius: 8px; padding: 20px; }
        .cut-line { border-top: 1px dashed #aaa; margin: 16px 0; text-align: center; font-size: 10px; color: #aaa; padding-top: 4px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 3px 0; }
        @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
      </style></head><body>
      <div class="print-page">${printContent}</div>
      <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 800); }<\/script>
      </body></html>`)
    w.document.close()
    if (onPrint) onPrint()
  }

  return (
    <ModalPortal>
    <div className="modal-backdrop-center">
      <div className="bg-[var(--color-bg-card)] rounded-2xl w-full max-w-3xl max-h-[94vh] flex flex-col shadow-[var(--shadow-modal)]">
        {/* Header */}
        <div className="modal-header">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-[var(--color-primary-readable)]" />
            <h2 className="text-base font-bold text-[var(--color-text-primary)]">Receipt Preview</h2>
            <span className="text-xs text-[var(--color-text-muted)] ml-1">— 2 copies per page</span>
          </div>
          <button onClick={onClose} className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] rounded-lg hover:bg-[var(--color-bg-subtle)] transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Preview area */}
        <div className="overflow-y-auto flex-1 p-5 bg-[var(--color-bg-muted)]">
          <div ref={receiptRef} className="receipt-pair flex gap-4">
            <div className="flex-1"><ReceiptCopy copyLabel="School Copy" /></div>
            <div className="flex-1"><ReceiptCopy copyLabel="Student Copy" /></div>
          </div>
          <p className="text-center text-xs text-[var(--color-text-muted)] mt-3 flex items-center justify-center gap-1">
            <span className="inline-block w-10 border-t border-dashed border-[var(--color-border)]"></span>
            cut here
            <span className="inline-block w-10 border-t border-dashed border-[var(--color-border)]"></span>
          </p>
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-[var(--color-border)] bg-[var(--color-bg-subtle)] flex justify-between items-center flex-shrink-0">
          <button onClick={onClose} className="btn-cancel">
            Close
          </button>
          <button onClick={handlePrint}
            className="flex items-center gap-2 px-6 py-2.5 text-sm bg-primary text-[var(--color-primary-contrast)] rounded-xl hover:bg-[var(--color-primary-hover)] transition font-semibold shadow-sm">
            <Printer className="w-4 h-4" /> Print Receipt
          </button>
        </div>
      </div>
    </div>
  </ModalPortal>
  )
}

// ── Record Payment Modal ──────────────────────────────────────────
function RecordPaymentModal({ payment, onClose, onSave, cashierName, schoolYear }) {
  const { isCollegeGrade } = useAppConfig()
  const [amount,     setAmount]     = useState('')
  const [method,     setMethod]     = useState('Cash')
  const [orNumber,   setOrNumber]   = useState(generateOR('OR'))
  const [notes,      setNotes]      = useState('')
  const [paymentFor, setPaymentFor] = useState([])
  const [errors,     setErrors]     = useState({})
  const [saving,     setSaving]     = useState(false)

  const maxAmount = payment.totalFee - payment.amountPaid

  // Build fee component options from the payment's fee breakdown
  const fb = payment.feeBreakdown
  const isCollegePay = payment.gradeLevel ? isCollegeGrade(payment.gradeLevel) : false

  const feeOptions = fb ? [
    { key: 'tuition',  label: 'Tuition Fee',  amount: fb.tuitionAfterDiscount || fb.originalTuition || 0 },
    { key: 'misc',     label: 'Misc Fee',      amount: fb.misc   || 0 },
    isCollegePay && fb.lab   > 0 && { key: 'lab',   label: 'Lab Fee',   amount: fb.lab   },
    !isCollegePay && fb.books > 0 && { key: 'books', label: 'Books',     amount: fb.books },
    fb.other > 0               && { key: 'other',  label: 'Other Fees',amount: fb.other },
  ].filter(Boolean) : [
    { key: 'tuition',  label: 'Tuition Fee',  amount: 0 },
    { key: 'misc',     label: 'Misc Fee',      amount: 0 },
  ]

  // Auto-select all fee components by default when modal first opens
  // (Using useEffect with empty deps is correct; useState initializer doesn't re-run on feeOptions change)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const [_init] = useState(() => feeOptions.map(o => o.key))
  // Sync paymentFor to feeOptions on mount
  useEffect(() => { setPaymentFor(feeOptions.map(o => o.key)) }, []) // eslint-disable-line

  const toggleFeeFor = (key) =>
    setPaymentFor(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])

  const validate = () => {
    const e = {}
    const amt = parseFloat(amount)
    if (!amount || isNaN(amt) || amt <= 0)         e.amount   = 'Enter a valid amount'
    if (amt > maxAmount + 0.01)                     e.amount   = `Max payable is ₱${maxAmount.toLocaleString()}`
    if (!orNumber.trim())                           e.orNumber = 'OR number is required'
    else if (isOrNumberUsed(orNumber))              e.orNumber = 'This OR number is already used on another payment'
    if (paymentFor.length === 0)                    e.paymentFor = 'Select at least one fee type'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = () => {
    if (!validate()) return
    setSaving(true)
    setTimeout(() => {
      onSave({
        amount:     parseFloat(amount),
        method,
        orNumber:   orNumber.trim(),
        notes:      notes.trim(),
        paymentFor: paymentFor.length > 0 ? paymentFor : ['tuition'],
        date:       new Date().toISOString()
      })
    }, 600)
  }

  const paidPct = payment.totalFee > 0 ? Math.round((payment.amountPaid / payment.totalFee) * 100) : 0
  const newPct  = amount && !isNaN(parseFloat(amount))
    ? Math.min(100, Math.round(((payment.amountPaid + parseFloat(amount)) / payment.totalFee) * 100))
    : paidPct

  return (
    <ModalPortal>
    <div className="modal-backdrop">
      <div className="bg-[var(--color-bg-card)] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[94vh] flex flex-col shadow-[var(--shadow-modal)]">
        {/* Header */}
        <div className="modal-header">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 bg-[var(--color-success-light)] rounded-full flex items-center justify-center flex-shrink-0">
              <DollarSign className="w-5 h-5 text-[var(--color-success-text)]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-[var(--color-text-primary)] truncate">Record Payment</h2>
              <p className="text-xs text-[var(--color-text-muted)] truncate">{payment.studentName} · {payment.studentId}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] rounded-lg hover:bg-[var(--color-bg-subtle)] transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Fee summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[
              { label: 'Total Fee',   value: `₱${payment.totalFee.toLocaleString()}`,   cls: 'text-[var(--color-text-primary)]' },
              { label: 'Paid',        value: `₱${payment.amountPaid.toLocaleString()}`,  cls: 'text-[var(--color-success-text)]' },
              { label: 'Balance',     value: `₱${(payment.totalFee - payment.amountPaid).toLocaleString()}`, cls: 'text-[var(--color-error-text)]' },
            ].map(({ label, value, cls }) => (
              <div key={label} className="bg-[var(--color-bg-subtle)] rounded-xl p-3 text-center">
                <p className="text-[10px] text-[var(--color-text-muted)] mb-0.5 uppercase tracking-wide">{label}</p>
                <p className={`text-sm font-bold ${cls}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Progress bar — live preview */}
          <div>
            <div className="flex justify-between text-xs text-[var(--color-text-muted)] mb-1">
              <span>Payment progress</span>
              <span>{newPct}%</span>
            </div>
            <div className="h-2.5 bg-[var(--color-bg-subtle)] rounded-full overflow-hidden">
              <div className="h-full bg-[var(--color-success)] rounded-full transition-all duration-300" style={{ width: `${newPct}%` }} />
            </div>
          </div>

          {/* Amount input */}
          <div>
            <label className="form-label">
              Amount to Record <span className="text-[var(--color-error-text)]">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] font-semibold text-sm">₱</span>
              <input
                type="number" min="1" max={maxAmount} step="0.01"
                value={amount} onChange={e => setAmount(e.target.value)}
                placeholder={`Max: ₱${maxAmount.toLocaleString()}`}
                className={`w-full pl-7 pr-4 py-2.5 text-sm border rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none transition
                  ${errors.amount ? 'border-[var(--color-error)] focus:ring-[var(--color-error)]' : 'border-[var(--color-border)] focus:border-[var(--color-primary-readable)] focus:ring-2 focus:ring-primary/20'}`}
              />
            </div>
            {errors.amount && <p className="text-xs text-[var(--color-error-text)] mt-1">{errors.amount}</p>}
            {/* Quick amount buttons */}
            <div className="flex gap-2 mt-2 flex-wrap">
              {[500, 1000, 2000, 5000].filter(v => v <= maxAmount + 1).map(v => (
                <button key={v} onClick={() => setAmount(String(v))}
                  className="text-xs px-2.5 py-1 bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)] rounded-lg hover:bg-primary hover:text-[var(--color-primary-contrast)] transition font-medium">
                  ₱{v.toLocaleString()}
                </button>
              ))}
              <button onClick={() => setAmount(String(maxAmount))}
                className="text-xs px-2.5 py-1 bg-[var(--color-success-light)] text-[var(--color-success-text)] rounded-lg hover:opacity-90 hover:text-[var(--color-text-inverse)] transition font-medium">
                Full Balance
              </button>
            </div>
          </div>

          {/* Payment method */}
          <div>
            <label className="form-label">Payment Method</label>
            <div className="flex gap-2">
              {['Cash', 'Bank Transfer'].map(m => (
                <button key={m} onClick={() => setMethod(m)}
                  className={`flex-1 py-2.5 text-sm font-semibold rounded-xl border transition
                    ${method === m
                      ? 'bg-primary text-[var(--color-primary-contrast)] border-primary'
                      : 'bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-primary-readable)]'
                    }`}>
                  {m === 'Cash' ? '💵' : '🏦'} {m}
                </button>
              ))}
            </div>
          </div>

          {/* OR Number */}
          <div>
            <label className="form-label">
              OR Number <span className="text-[var(--color-error-text)]">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text" value={orNumber} onChange={e => setOrNumber(e.target.value)}
                className={`flex-1 px-3 py-2.5 text-sm font-mono border rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none transition
                  ${errors.orNumber ? 'border-[var(--color-error)]' : 'border-[var(--color-border)] focus:border-[var(--color-primary-readable)] focus:ring-2 focus:ring-primary/20'}`}
              />
              <button onClick={() => setOrNumber(generateOR('OR'))}
                className="px-3 py-2.5 text-xs bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)] rounded-xl hover:bg-[var(--color-bg-muted)] transition font-medium whitespace-nowrap">
                Generate
              </button>
            </div>
            {errors.orNumber && <p className="text-xs text-[var(--color-error-text)] mt-1">{errors.orNumber}</p>}
          </div>

          {/* Payment For */}
          <div>
            <label className="form-label">
              Payment For <span className="text-[var(--color-error-text)]">*</span>
              <span className="ml-1 font-normal text-[var(--color-text-muted)]">(select all that apply)</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {feeOptions.map(opt => {
                const checked = paymentFor.includes(opt.key)
                return (
                  <button key={opt.key} type="button"
                    onClick={() => toggleFeeFor(opt.key)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition
                      ${checked
                        ? 'border-[var(--color-primary-readable)] bg-primary/5 dark:bg-primary/10'
                        : 'border-[var(--color-border)] hover:border-primary/50 bg-[var(--color-bg-subtle)]'
                      }`}>
                    <div className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border-2 transition
                      ${checked ? 'bg-primary border-primary' : 'border-[var(--color-border-strong)]'}`}>
                      {checked && <CheckCircle className="w-2.5 h-2.5 text-[var(--color-primary-contrast)]"/>}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-xs font-semibold truncate ${checked ? 'text-[var(--color-primary-readable)]' : 'text-[var(--color-text-primary)]'}`}>
                        {opt.label}
                      </p>
                      {opt.amount > 0 && (
                        <p className="text-[10px] text-[var(--color-text-muted)] font-mono">₱{opt.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
            {paymentFor.length === 0 && (
              <p className="text-xs text-[var(--color-error-text)] mt-1">Please select at least one fee type</p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="form-label">Notes (optional)</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Monthly installment — March, Down payment..."
              className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary-readable)] focus:ring-2 focus:ring-primary/20 transition"
            />
          </div>

          {/* Cashier info */}
          <div className="bg-[var(--color-warning-light)] border border-[var(--color-warning-border)] rounded-xl px-4 py-2.5 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-[var(--color-warning-text)] flex-shrink-0" />
            <p className="text-xs text-[var(--color-warning-text)]">
              Recorded by: <span className="font-semibold">{cashierName}</span> · {new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button onClick={onClose} className="btn-cancel">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm bg-[var(--color-success)] text-[var(--color-text-inverse)] rounded-xl hover:opacity-90 transition font-semibold disabled:opacity-60 shadow-sm">
            {saving
              ? <><span className="w-4 h-4 border-2 border-[var(--color-bg-card)] border-t-white rounded-full animate-spin" /> Saving...</>
              : <><CheckCircle className="w-4 h-4" /> Record Payment & Preview Receipt</>
            }
          </button>
        </div>
      </div>
    </div>
  </ModalPortal>
  )
}

// ─────────────────────────────────────────────────────────────────────
// TAB 1 — PAYMENT RECORDS
// ─────────────────────────────────────────────────────────────────────

// ── Department Toggle ─────────────────────────────────────────────
// Reusable All / Basic Ed / College pill-toggle
// value: 'all' | 'basic' | 'college'
function DeptToggle({ value, onChange }) {
  const tabs = [
    { id: 'all',     label: 'All'      },
    { id: 'basic',   label: 'Basic Ed' },
    { id: 'college', label: 'College'  },
  ]
  return (
    <div className="inline-flex items-stretch border border-[var(--color-border)] rounded-lg overflow-hidden flex-shrink-0">
      {tabs.map((t, idx) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={[
            'px-3 py-2 text-sm font-semibold transition whitespace-nowrap touch-manipulation',
            idx > 0 && 'border-l border-[var(--color-border)]',
            value === t.id
              ? t.id === 'all'
                ? 'bg-primary text-[var(--color-primary-contrast)]'
                : t.id === 'basic'
                  ? 'bg-[var(--color-success)] text-[var(--color-text-inverse)]'
                  : 'bg-secondary text-[var(--color-secondary-contrast)]'
              : 'bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)]',
          ].filter(Boolean).join(' ')}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// TAB 1 — PAYMENT RECORDS
// ─────────────────────────────────────────────────────────────────────
function PaymentRecordsTab({ payments, campusName, exportToExcel, addToast }) {
  const { isBasicGrade, isCollegeGrade } = useAppConfig()
  const [search,      setSearch]      = useState('')
  const [deptFilter,  setDeptFilter]  = useState('all')
  const [yearFilter,  setYearFilter]  = useState('all')
  const [methodFilter,setMethodFilter]= useState('all')
  const [feeFilter,   setFeeFilter]   = useState('all')
  const [dateFrom,    setDateFrom]    = useState('')
  const [dateTo,      setDateTo]      = useState('')

  const FEE_LABELS = { tuition:'Tuition Fee', misc:'Misc Fee', lab:'Lab Fee', books:'Books', other:'Other Fees' }

  // Reset yearFilter when dept changes
  const handleDeptChange = (dept) => { setDeptFilter(dept); setYearFilter('all') }

  // Basic Ed — all groups from static config (all grades always shown)
  const basicEdGroups = BASIC_ED_GROUPS.map(group => ({
    label: group.label,
    options: group.options.map(g => ({ value: g, label: g }))
  }))

  // College — all programs × all year levels (prop, falls back to empty)
  const collegeGroups = (collegePrograms || []).map(prog => ({
    label: prog,
    options: COLLEGE_YEAR_LEVELS.map(yr => ({ value: `${prog} - ${yr}`, label: yr }))
  }))

  // Flatten all payment history entries
  const allTx = payments.flatMap(p =>
    (p.paymentHistory || []).map(h => ({
      ...h,
      studentName:  p.studentName,
      gradeLevel:   p.gradeLevel,
      campus:       p.campus,
      refNum:       p.studentId,
      totalFee:     p.totalFee,
      balance:      p.balance
    }))
  ).sort((a,b) => new Date(b.date||0) - new Date(a.date||0))

  const filtered = allTx.filter(tx => {
    const name = (tx.studentName||'').toLowerCase()
    const or   = (tx.orNumber||'').toLowerCase()
    const q    = search.toLowerCase()
    if (q && !name.includes(q) && !or.includes(q)) return false
    if (deptFilter === 'basic'   && !isBasicGrade(tx.gradeLevel)) return false
    if (deptFilter === 'college' && !isCollegeGrade(tx.gradeLevel)) return false
    if (yearFilter !== 'all' && tx.gradeLevel !== yearFilter) return false
    if (methodFilter !== 'all' && tx.method !== methodFilter) return false
    if (feeFilter !== 'all') {
      const pf = tx.paymentFor || []
      if (!pf.includes(feeFilter)) return false
    }
    if (dateFrom && new Date(tx.date) < new Date(dateFrom)) return false
    if (dateTo   && new Date(tx.date) > new Date(dateTo + 'T23:59:59')) return false
    return true
  })

  const totalFiltered = filtered.reduce((s,t) => s + (t.amount||0), 0)
  const basicTotal    = allTx.filter(tx => isBasicGrade(tx.gradeLevel)).reduce((s,t) => s + (t.amount||0), 0)
  const collegeTotal  = allTx.filter(tx => isCollegeGrade(tx.gradeLevel)).reduce((s,t) => s + (t.amount||0), 0)

  const hasFilters = search || deptFilter !== 'all' || yearFilter !== 'all' || methodFilter !== 'all' || feeFilter !== 'all' || dateFrom || dateTo
  const clearAll   = () => { setSearch(''); setDeptFilter('all'); setYearFilter('all'); setMethodFilter('all'); setFeeFilter('all'); setDateFrom(''); setDateTo('') }

  const handleExport = () => {
    const data = filtered.map(tx => ({
      'OR Number':     tx.orNumber || '—',
      'Reference #':   tx.refNum,
      'Student Name':  tx.studentName,
      'Department':    isCollegeGrade(tx.gradeLevel) ? 'College' : 'Basic Ed',
      'Grade/Program': tx.gradeLevel,
      'Payment For':   (tx.paymentFor||[]).map(k=>FEE_LABELS[k]||k).join(', ') || '—',
      'Method':        tx.method || '—',
      'Date':          tx.date ? new Date(tx.date).toLocaleDateString('en-PH') : '—',
      'Amount':        tx.amount || 0,
      'Notes':         tx.notes || ''
    }))
    exportToExcel(data, `Payment_Records_${new Date().toISOString().split('T')[0]}`, 'Payment Records')
    addToast('Payment records exported!', 'success')
  }

  const fmtDate = d => d ? new Date(d).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'}) : '—'
  const phpFmt  = n => `₱${(n||0).toLocaleString('en-PH',{minimumFractionDigits:2})}`

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] p-4 shadow-sm space-y-3">

        {/* Row 1: Dept toggle + year sub-filter + Method + Fee + Search + Export */}
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center flex-wrap">
          <DeptToggle value={deptFilter} onChange={handleDeptChange} />
          {deptFilter === 'college' && collegeGroups.length > 0 && (
            <div className="flex-shrink-0 min-w-[180px]">
              <GroupedSelect
                value={yearFilter}
                onChange={setYearFilter}
                allLabel="All Programs & Years"
                groups={collegeGroups}
              />
            </div>
          )}
          {deptFilter === 'basic' && basicEdGroups.length > 0 && (
            <div className="flex-shrink-0 min-w-[160px]">
              <GroupedSelect
                value={yearFilter}
                onChange={setYearFilter}
                allLabel="All Grades"
                groups={basicEdGroups}
              />
            </div>
          )}
          <div className="flex-shrink-0 min-w-[130px]">
            <GroupedSelect
              value={methodFilter}
              onChange={setMethodFilter}
              allLabel="All Methods"
              options={[
                { value: 'Cash',          label: '💵 Cash'          },
                { value: 'Bank Transfer', label: '🏦 Bank Transfer' },
              ]}
            />
          </div>
          <div className="flex-shrink-0 min-w-[130px]">
            <GroupedSelect
              value={feeFilter}
              onChange={setFeeFilter}
              allLabel="All Fee Types"
              options={[
                { value: 'tuition', label: 'Tuition Fee' },
                { value: 'misc',    label: 'Misc Fee'    },
                { value: 'lab',     label: 'Lab Fee'     },
                { value: 'books',   label: 'Books'       },
              ]}
            />
          </div>
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)]"/>
            <input value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="Search student or OR #..."
              className="w-full pl-8 pr-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary-readable)] transition"/>
          </div>
          <ExportButton onClick={handleExport} size="sm" />
        </div>

        {/* Date range row */}
        <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-[var(--color-border)]">
          <div className="flex-1">
            <DatePicker label="From" value={dateFrom} onChange={setDateFrom} placeholder="Start date" />
          </div>
          <div className="flex-1">
            <DatePicker label="To" value={dateTo} onChange={setDateTo} placeholder="End date" />
          </div>
          {hasFilters && (
            <button onClick={clearAll}
              className="text-xs px-3 py-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-error-text)] border border-[var(--color-border)] rounded-lg transition whitespace-nowrap">
              ✕ Clear all
            </button>
          )}
        </div>

        {/* Dept mini-summary (only when All is selected) */}
        {deptFilter === 'all' && (basicTotal > 0 || collegeTotal > 0) && (
          <div className="flex gap-3 pt-1">
            <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
              <span className="w-2 h-2 rounded-full bg-[var(--color-success)] inline-block"/>
              Basic Ed: <span className="font-semibold text-[var(--color-text-primary)] font-mono">{phpFmt(basicTotal)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
              <span className="w-2 h-2 rounded-full bg-secondary inline-block"/>
              College: <span className="font-semibold text-[var(--color-text-primary)] font-mono">{phpFmt(collegeTotal)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[var(--color-primary-readable)]"/>
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">
              {deptFilter === 'basic' ? 'Basic Ed Transactions' : deptFilter === 'college' ? 'College Transactions' : 'All Transactions'}
            </span>
            <span className="text-xs bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)] px-2 py-0.5 rounded-full">{filtered.length}</span>
            {yearFilter !== 'all' && (
              <span className="text-xs bg-primary/10 text-[var(--color-primary-readable)] px-2 py-0.5 rounded-full font-medium">{yearFilter}</span>
            )}
          </div>
          <span className="text-sm font-bold text-[var(--color-success-text)] font-mono">{phpFmt(totalFiltered)}</span>
        </div>
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-[var(--color-text-muted)]">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-30"/>
            <p className="text-sm">No transactions match your filters</p>
          </div>
        ) : (
          <div className="min-w-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px]">
              <thead className="bg-[var(--color-bg-subtle)]">
                <tr>
                  {['OR Number','Student Name','Dept','Grade/Program','Payment For','Method','Date','Amount'].map(h => (
                    <th key={h} className={`px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide ${h==='Amount'?'text-right':'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {filtered.map((tx,i) => {
                  const isBasic = isBasicGrade(tx.gradeLevel)
                  return (
                  <tr key={i} className="hover:bg-[var(--color-bg-subtle)]/30 transition">
                    <td className="px-4 py-3 text-xs font-mono text-[var(--color-primary-readable)]">{tx.orNumber||'—'}</td>
                    <td className="px-4 py-3 text-sm font-medium text-[var(--color-text-primary)]">{tx.studentName}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap
                        ${isBasic
                          ? 'bg-[var(--color-success-light)] text-[var(--color-success-text)]'
                          : 'bg-[var(--color-info-light)] text-[var(--color-info-text)]'
                        }`}>
                        {isBasic ? 'Basic Ed' : 'College'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">{tx.gradeLevel}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(tx.paymentFor||['tuition']).map(k => (
                          <span key={k} className="text-[10px] px-1.5 py-0.5 bg-secondary/10 dark:bg-secondary/30 text-[var(--color-secondary-readable)] rounded font-medium">
                            {FEE_LABELS[k]||k}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">{tx.method||'—'}</td>
                    <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">{fmtDate(tx.date)}</td>
                    <td className="px-4 py-3 text-sm font-bold text-[var(--color-success-text)] text-right font-mono">{phpFmt(tx.amount)}</td>
                  </tr>
                  )
                })}
              </tbody>
              <tfoot className="bg-[var(--color-bg-subtle)] border-t-2 border-[var(--color-border)]">
                <tr>
                  <td colSpan={7} className="px-4 py-3 text-sm font-bold text-[var(--color-text-primary)]">Total</td>
                  <td className="px-4 py-3 text-sm font-bold text-[var(--color-success-text)] text-right font-mono">{phpFmt(totalFiltered)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// TAB 2 — STUDENT BALANCE
// ─────────────────────────────────────────────────────────────────────
function StudentBalanceTab({ payments, collegePrograms, exportToExcel, addToast }) {
  const { isBasicGrade, isCollegeGrade } = useAppConfig()
  const [search,     setSearch]     = useState('')
  const [deptFilter, setDeptFilter] = useState('all')
  const [yearFilter, setYearFilter] = useState('all')
  const [sortBy,     setSortBy]     = useState('balance_desc')

  const phpFmt  = n => `₱${(n||0).toLocaleString('en-PH',{minimumFractionDigits:2})}`
  const fmtDate = d => fmtShortDate(d)

  const handleDeptChange = (dept) => { setDeptFilter(dept); setYearFilter('all') }

  // Basic Ed — all grades from static config
  const basicEdGroups = BASIC_ED_GROUPS.map(group => ({
    label: group.label,
    options: group.options.map(g => ({ value: g, label: g }))
  }))

  // College — all programs × all year levels from static config
  const collegeGroups = collegePrograms.map(prog => ({
    label: prog,
    options: COLLEGE_YEAR_LEVELS.map(yr => ({ value: `${prog} - ${yr}`, label: yr }))
  }))

  // Only students with remaining balance
  const withBalance = payments.filter(p => p.balance > 0)

  const filtered = withBalance.filter(p => {
    const matchSearch = !search || p.studentName.toLowerCase().includes(search.toLowerCase()) ||
      p.studentId.toLowerCase().includes(search.toLowerCase())
    const matchDept   = deptFilter === 'all' ||
      (deptFilter === 'basic'   && isBasicGrade(p.gradeLevel)) ||
      (deptFilter === 'college' && isCollegeGrade(p.gradeLevel))
    const matchYear   = yearFilter === 'all' || p.gradeLevel === yearFilter
    return matchSearch && matchDept && matchYear
  }).sort((a,b) => {
    if (sortBy === 'balance_desc') return b.balance - a.balance
    if (sortBy === 'balance_asc')  return a.balance - b.balance
    if (sortBy === 'name')         return a.studentName.localeCompare(b.studentName)
    if (sortBy === 'oldest')       return new Date(a.submittedDate||0) - new Date(b.submittedDate||0)
    if (sortBy === 'due')          return (a.dueDate || '9999-12-31').localeCompare(b.dueDate || '9999-12-31')
    return 0
  })

  const totalOutstanding = filtered.reduce((s,p) => s+p.balance, 0)
  const overdue          = filtered.filter(p => p.status === 'overdue')

  // Dept subtotals for all-mode display
  const basicOut   = withBalance.filter(p => isBasicGrade(p.gradeLevel)).reduce((s,p) => s+p.balance, 0)
  const collegeOut = withBalance.filter(p => isCollegeGrade(p.gradeLevel)).reduce((s,p) => s+p.balance, 0)

  const handleExport = () => {
    const data = filtered.map(p => ({
      'Reference #':   p.studentId,
      'Student Name':  p.studentName,
      'Department':    isCollegeGrade(p.gradeLevel) ? 'College' : 'Basic Ed',
      'Grade/Program': p.gradeLevel,
      'Campus':        p.campus,
      'Total Fee':     p.totalFee,
      'Amount Paid':   p.amountPaid,
      'Balance':       p.balance,
      'Due Date':      p.dueDate || '',
      'Days Overdue':  p.status === 'overdue' ? daysPast(p.dueDate) : 0,
      'Status':        p.status === 'overdue' ? 'Overdue' : 'Partial'
    }))
    exportToExcel(data, `Student_Balances_${new Date().toISOString().split('T')[0]}`, 'Balances')
    addToast('Student balances exported!', 'success')
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label:'Students with Balance', value: withBalance.length, icon:<Users className="w-5 h-5 text-[var(--color-warning-text)]"/>, border:'border-[var(--color-warning)]', cls:'text-[var(--color-warning-text)]' },
          { label:'Total Outstanding',     value: phpFmt(totalOutstanding), icon:<DollarSign className="w-5 h-5 text-[var(--color-error-text)]"/>, border:'border-[var(--color-error)]', cls:'text-[var(--color-error-text)]' },
          { label:'Overdue',               value: overdue.length, icon:<AlertCircle className="w-5 h-5 text-[var(--color-warning-text)]"/>, border:'border-[var(--color-warning)]', cls:'text-[var(--color-warning-text)]' },
        ].map(({label,value,icon,border,cls}) => (
          <div key={label} className={`bg-[var(--color-bg-card)] rounded-xl p-4 border-l-4 ${border} shadow-sm`}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-[var(--color-text-muted)] font-medium">{label}</p>
              {icon}
            </div>
            <p className={`text-xl font-bold ${cls}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] p-4 shadow-sm space-y-3">
        {/* Single row: Dept toggle + year sub-filter + Sort + Search + Export */}
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center flex-wrap">
          <DeptToggle value={deptFilter} onChange={handleDeptChange} />
          {deptFilter === 'college' && collegeGroups.length > 0 && (
            <div className="flex-shrink-0 min-w-[180px]">
              <GroupedSelect
                value={yearFilter}
                onChange={setYearFilter}
                allLabel="All Programs & Years"
                groups={collegeGroups}
              />
            </div>
          )}
          {deptFilter === 'basic' && basicEdGroups.length > 0 && (
            <div className="flex-shrink-0 min-w-[160px]">
              <GroupedSelect
                value={yearFilter}
                onChange={setYearFilter}
                allLabel="All Grades"
                groups={basicEdGroups}
              />
            </div>
          )}
          <div className="flex-shrink-0 min-w-[160px]">
            <GroupedSelect
              value={sortBy}
              onChange={setSortBy}
              allLabel="Sort: Highest Balance"
              options={[
                { value: 'balance_desc', label: 'Highest Balance' },
                { value: 'balance_asc',  label: 'Lowest Balance'  },
                { value: 'name',         label: 'Name A–Z'        },
                { value: 'due',          label: 'Earliest Due Date' },
                { value: 'oldest',       label: 'Oldest First'    },
              ]}
            />
          </div>
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)]"/>
            <input value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="Search student name or reference #..."
              className="w-full pl-8 pr-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary-readable)] transition"/>
          </div>
          <ExportButton onClick={handleExport} size="sm" />
        </div>
        {/* Dept mini breakdown — shown in all-mode when data exists */}
        {deptFilter === 'all' && (basicOut > 0 || collegeOut > 0) && (
          <div className="flex gap-4 pt-1 border-t border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[var(--color-success)] inline-block"/>
              Basic Ed: <span className="font-semibold text-[var(--color-warning-text)] font-mono">{phpFmt(basicOut)}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-secondary inline-block"/>
              College: <span className="font-semibold text-[var(--color-warning-text)] font-mono">{phpFmt(collegeOut)}</span>
            </span>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-center gap-2 flex-wrap">
          <Users className="w-4 h-4 text-[var(--color-primary-readable)]"/>
          <span className="text-sm font-semibold text-[var(--color-text-primary)]">
            {deptFilter === 'basic' ? 'Basic Ed Students with Balance' : deptFilter === 'college' ? 'College Students with Balance' : 'Students with Outstanding Balance'}
          </span>
          <span className="text-xs bg-[var(--color-warning-light)] text-[var(--color-warning-text)] px-2 py-0.5 rounded-full">{filtered.length}</span>
          {yearFilter !== 'all' && (
            <span className="text-xs bg-primary/10 text-[var(--color-primary-readable)] px-2 py-0.5 rounded-full font-medium">{yearFilter}</span>
          )}
        </div>
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-[var(--color-text-muted)]">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-[var(--color-success-text)] opacity-60"/>
            <p className="text-sm font-medium text-[var(--color-success-text)]">
              {yearFilter !== 'all' ? `No students with balance in ${yearFilter}` : deptFilter !== 'all' ? `No ${deptFilter === 'basic' ? 'Basic Ed' : 'College'} students with balance` : 'All students are fully paid!'}
            </p>
          </div>
        ) : (
          <div className="min-w-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[580px]">
              <thead className="bg-[var(--color-bg-subtle)]">
                <tr>
                  {['Student','Dept','Grade/Program','Total Fee','Paid','Balance','Due Date','Status'].map(h=>(
                    <th key={h} className={`px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide ${['Total Fee','Paid','Balance'].includes(h)?'text-right':'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {filtered.map((p,i) => {
                  const paidPct = p.totalFee > 0 ? Math.round((p.amountPaid/p.totalFee)*100) : 0
                  const isOld   = p.status === 'overdue'
                  const isBasic = isBasicGrade(p.gradeLevel)
                  return (
                    <tr key={i} className={`transition ${isOld ? 'bg-[var(--color-error-light)] hover:bg-[var(--color-error-light)]' : 'hover:bg-[var(--color-bg-subtle)]/30'}`}>
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-[var(--color-text-primary)]">{p.studentName}</p>
                        <p className="text-xs text-[var(--color-text-muted)] font-mono">{p.studentId}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap
                          ${isBasic
                            ? 'bg-[var(--color-success-light)] text-[var(--color-success-text)]'
                            : 'bg-[var(--color-info-light)] text-[var(--color-info-text)]'
                          }`}>
                          {isBasic ? 'Basic Ed' : 'College'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">{p.gradeLevel}</td>
                      <td className="px-4 py-3 text-sm font-mono text-right text-[var(--color-text-primary)]">{phpFmt(p.totalFee)}</td>
                      <td className="px-4 py-3 text-right">
                        <p className="text-sm font-mono text-[var(--color-success-text)]">{phpFmt(p.amountPaid)}</p>
                        <div className="w-full bg-[var(--color-bg-subtle)] rounded-full h-1 mt-1">
                          <div className="bg-[var(--color-success)] h-full rounded-full" style={{width:`${paidPct}%`}}/>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-right font-mono text-[var(--color-warning-text)]">{phpFmt(p.balance)}</td>
                      <td className="px-4 py-3 text-xs text-center text-[var(--color-text-muted)] whitespace-nowrap">
                        {p.dueDate ? fmtDate(p.dueDate) : '—'}
                        {isOld && <span className="block text-[10px] text-[var(--color-error-text)]">{daysPast(p.dueDate)}d late</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] px-2 py-1 rounded-full font-semibold ${isOld
                          ? 'bg-[var(--color-error-light)] text-[var(--color-error-text)]'
                          : 'bg-[var(--color-warning-light)] text-[var(--color-warning-text)]'}`}>
                          {isOld ? 'Overdue' : 'Partial'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="bg-[var(--color-bg-subtle)] border-t-2 border-[var(--color-border)]">
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-sm font-bold text-[var(--color-text-primary)]">Total Outstanding</td>
                  <td className="px-4 py-3 text-sm font-bold text-[var(--color-warning-text)] text-right font-mono">{phpFmt(totalOutstanding)}</td>
                  <td colSpan={2}/>
                </tr>
              </tfoot>
            </table>
          </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SOATab({ payments, cashierName, schoolYear, campusName, exportToExcel, addToast }) {
  const [search,      setSearch]      = useState('')
  const [selectedStudent, setSelected]= useState(null)

  const fmtDate = d => d ? new Date(d).toLocaleDateString('en-PH',{month:'long',day:'numeric',year:'numeric'}) : '—'
  const FEE_LABELS = { tuition:'Tuition Fee', misc:'Misc Fee', lab:'Lab Fee', books:'Books', other:'Other Fees' }

  const filtered = payments.filter(p =>
    !search || p.studentName.toLowerCase().includes(search.toLowerCase()) ||
    p.studentId.toLowerCase().includes(search.toLowerCase())
  )

  const handlePrint = () => {
    if (!selectedStudent) return
    const p     = selectedStudent
    const fb    = p.feeBreakdown || {}
    const hist  = p.paymentHistory || []
    const { name: schoolName, primaryColor, secondaryColor } = getSchoolBrand()
    let runningBalance = p.totalFee
    const rows = hist.map(h => {
      runningBalance -= (h.amount||0)
      return `<tr>
        <td>${h.orNumber||'—'}</td>
        <td>${h.date ? new Date(h.date).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'}) : '—'}</td>
        <td>${h.method||'—'}</td>
        <td>${(h.paymentFor||['tuition']).map(k=>FEE_LABELS[k]||k).join(', ')}</td>
        <td>${h.notes||'—'}</td>
        <td style="text-align:right">${php(h.amount)}</td>
        <td style="text-align:right;color:${runningBalance<=0?'green':'#b45309'}">${php(Math.max(0,runningBalance))}</td>
      </tr>`
    }).join('')

    const win = window.open('','_blank','width=900,height=700')
    win.document.write(`<!DOCTYPE html><html><head><title>SOA — ${p.studentName}</title>
    <style>
      :root { --color-primary: ${primaryColor}; --color-secondary: ${secondaryColor}; }
      * { font-family: Arial, sans-serif; margin: 0; padding: 0; box-sizing: border-box; }
      body { padding: 32px; color: #111; font-size: 13px; }
      .header { text-align: center; border-bottom: 3px solid var(--color-primary); padding-bottom: 16px; margin-bottom: 20px; }
      .school-name { font-size: 20px; font-weight: bold; color: var(--color-primary); }
      .soa-title { font-size: 15px; font-weight: bold; margin: 6px 0; color: var(--color-secondary); letter-spacing: 2px; text-transform: uppercase; }
      .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin-bottom: 20px; padding: 16px; background: #f8f4ed; border-radius: 8px; }
      .info-row { display: flex; gap: 6px; font-size: 12px; }
      .info-label { color: #666; min-width: 110px; }
      .info-value { font-weight: 600; }
      .fee-box { background: #fff7f0; border: 1px solid #e5c99a; border-radius: 8px; padding: 14px; margin-bottom: 20px; }
      .fee-box h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: var(--color-primary); margin-bottom: 10px; }
      .fee-row { display: flex; justify-content: space-between; font-size: 12px; padding: 3px 0; }
      .fee-row.total { border-top: 2px solid var(--color-primary); margin-top: 6px; padding-top: 8px; font-weight: bold; font-size: 14px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th { background: var(--color-secondary); color: white; padding: 8px 10px; text-align: left; font-size: 11px; text-transform: uppercase; }
      td { padding: 8px 10px; border-bottom: 1px solid #eee; }
      tr:last-child td { border-bottom: none; }
      .balance-box { margin-top: 20px; padding: 14px; border-radius: 8px; text-align: right; }
      .balance-box.paid { background: #ecfdf5; border: 2px solid #10b981; }
      .balance-box.due  { background: #fffbeb; border: 2px solid #f59e0b; }
      .balance-label { font-size: 12px; color: #555; }
      .balance-amt { font-size: 22px; font-weight: bold; }
      .footer { margin-top: 40px; display: flex; justify-content: space-between; font-size: 11px; color: #888; border-top: 1px solid #ddd; padding-top: 12px; }
      .sig-line { text-align: center; width: 180px; }
      .sig-line .line { border-top: 1px solid #333; margin-bottom: 4px; padding-top: 8px; margin-top: 40px; }
      @media print { body { padding: 16px; } }
    </style></head><body>
    <div class="header">
      <div class="school-name">${schoolName}</div>
      <div class="soa-title">Statement of Account</div>
      <div style="font-size:12px;color:#555">School Year ${schoolYear} · ${campusName}</div>
    </div>

    <div class="info-grid">
      <div class="info-row"><span class="info-label">Student Name:</span><span class="info-value">${p.studentName}</span></div>
      <div class="info-row"><span class="info-label">Reference #:</span><span class="info-value" style="color:var(--color-primary)">${p.studentId}</span></div>
      <div class="info-row"><span class="info-label">Grade/Program:</span><span class="info-value">${p.gradeLevel}</span></div>
      <div class="info-row"><span class="info-label">Student Type:</span><span class="info-value">${p.studentType||'—'}</span></div>
      ${p.semester ? `<div class="info-row"><span class="info-label">Semester:</span><span class="info-value">${p.semester}</span></div>` : ''}
      <div class="info-row"><span class="info-label">Date Generated:</span><span class="info-value">${new Date().toLocaleDateString('en-PH',{month:'long',day:'numeric',year:'numeric'})}</span></div>
    </div>

    <div class="fee-box">
      <h3>Fee Assessment</h3>
      ${fb.originalTuition > 0 ? `<div class="fee-row"><span>Original Tuition</span><span>${php(fb.originalTuition)}</span></div>` : ''}
      ${(fb.totalDiscount||0) > 0 ? `<div class="fee-row" style="color:#dc2626"><span>Discount Applied</span><span>- ${php(fb.totalDiscount)}</span></div>` : ''}
      ${fb.misc > 0 ? `<div class="fee-row"><span>Misc Fee</span><span>${php(fb.misc)}</span></div>` : ''}
      ${fb.lab > 0 ? `<div class="fee-row"><span>Lab Fee</span><span>${php(fb.lab)}</span></div>` : ''}
      ${fb.books > 0 ? `<div class="fee-row"><span>Books</span><span>${php(fb.books)}</span></div>` : ''}
      ${fb.other > 0 ? `<div class="fee-row"><span>Other Fees</span><span>${php(fb.other)}</span></div>` : ''}
      <div class="fee-row total"><span>Grand Total</span><span style="color:var(--color-primary)">${php(p.totalFee)}</span></div>
    </div>

    <h3 style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:var(--color-secondary);margin-bottom:10px">Payment History</h3>
    <table>
      <thead><tr><th>OR Number</th><th>Date</th><th>Method</th><th>Payment For</th><th>Notes</th><th style="text-align:right">Amount</th><th style="text-align:right">Running Balance</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="7" style="text-align:center;color:#888;padding:20px">No payments recorded yet</td></tr>'}</tbody>
    </table>

    <div class="balance-box ${p.balance<=0?'paid':'due'}">
      <div class="balance-label">${p.balance<=0 ? '✓ Account Fully Settled' : 'Remaining Balance'}</div>
      <div class="balance-amt" style="color:${p.balance<=0?'#059669':'#d97706'}">${php(p.balance)}</div>
    </div>

    <div class="footer">
      <div class="sig-line"><div class="line"></div><div>${cashierName||'Accounting Officer'}</div><div>Accounting / Cashier</div></div>
      <div style="text-align:right;font-size:10px;color:#aaa">This SOA is computer-generated.<br/>For concerns, contact the Accounting Office.</div>
    </div>

    <script>window.onload = () => { window.print() }<\/script>
    </body></html>`)
    win.document.close()
    addToast('SOA sent to printer!', 'success')
  }

  const handleExportSOA = () => {
    if (!selectedStudent) return
    const p = selectedStudent
    const hist = p.paymentHistory || []
    let runBal = p.totalFee
    const data = hist.map(h => {
      runBal -= (h.amount||0)
      return {
        'OR Number':      h.orNumber||'—',
        'Date':           h.date ? new Date(h.date).toLocaleDateString('en-PH') : '—',
        'Method':         h.method||'—',
        'Payment For':    (h.paymentFor||['tuition']).map(k=>FEE_LABELS[k]||k).join(', '),
        'Notes':          h.notes||'',
        'Amount Paid':    h.amount||0,
        'Running Balance':Math.max(0,runBal)
      }
    })
    exportToExcel(data, `SOA_${p.studentName.replace(/,\s*/g,'_')}_${new Date().toISOString().split('T')[0]}`, 'SOA')
    addToast('SOA exported to Excel!', 'success')
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* Student selector */}
      <div className="lg:col-span-1 bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--color-border)]">
          <p className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">Select Student</p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)]"/>
            <input value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="Search name or ref #..."
              className="w-full pl-8 pr-3 py-2 text-xs border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary-readable)] transition"/>
          </div>
        </div>
        <div className="divide-y divide-[var(--color-border)] max-h-[500px] overflow-y-auto">
          {filtered.map((p,i) => (
            <button key={i} onClick={()=>setSelected(p)}
              className={`w-full text-left px-4 py-3 transition flex items-start gap-3 ${selectedStudent?.studentId===p.studentId
                ? 'bg-primary/5 dark:bg-primary/10 border-l-2 border-[var(--color-primary-readable)]'
                : 'hover:bg-[var(--color-bg-subtle)]/30'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-[var(--color-text-inverse)]
                ${p.balance<=0 ? 'bg-[var(--color-success)]' : 'bg-[var(--color-warning)]'}`}>
                {p.studentName.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-xs font-semibold truncate ${selectedStudent?.studentId===p.studentId ? 'text-[var(--color-primary-readable)]' : 'text-[var(--color-text-primary)]'}`}>
                  {p.studentName}
                </p>
                <p className="text-[10px] text-[var(--color-text-muted)] truncate">{p.gradeLevel}</p>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-[10px] font-mono text-[var(--color-text-muted)]">{p.studentId}</span>
                  <span className={`text-[10px] font-bold font-mono ${p.balance<=0 ? 'text-[var(--color-success-text)]' : 'text-[var(--color-warning-text)]'}`}>
                    {p.balance<=0 ? 'PAID' : `Bal: ${php(p.balance)}`}
                  </span>
                </div>
              </div>
            </button>
          ))}
          {filtered.length===0 && (
            <div className="py-8 text-center text-[var(--color-text-muted)] text-sm">No students found</div>
          )}
        </div>
      </div>

      {/* SOA Preview */}
      <div className="lg:col-span-2">
        {!selectedStudent ? (
          <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm h-full flex items-center justify-center py-20">
            <div className="text-center text-[var(--color-text-muted)]">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-30"/>
              <p className="text-sm font-medium">Select a student to view SOA</p>
              <p className="text-xs mt-1">Choose from the list on the left</p>
            </div>
          </div>
        ) : (() => {
          const p   = selectedStudent
          const fb  = p.feeBreakdown || {}
          const hist= p.paymentHistory || []
          let runBal= p.totalFee
          return (
            <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden">
              {/* SOA Header */}
              <div className="bg-primary px-6 py-5 text-[var(--color-primary-contrast)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[3px] opacity-70 mb-1">Statement of Account</p>
                    <h2 className="text-lg font-bold">{p.studentName}</h2>
                    <p className="text-xs opacity-80 mt-1">{p.gradeLevel} {p.semester ? `· ${p.semester}` : ''}</p>
                    <p className="text-xs opacity-70 font-mono mt-0.5">{p.studentId}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold
                      ${p.balance<=0 ? 'bg-[var(--color-success)] text-[var(--color-success-text)] border border-[var(--color-success)]' : 'bg-[var(--color-warning)] text-[var(--color-warning-text)] border border-[var(--color-warning)]'}`}>
                      {p.balance<=0 ? <CheckCircle className="w-3 h-3"/> : <Clock className="w-3 h-3"/>}
                      {p.balance<=0 ? 'Fully Paid' : 'Has Balance'}
                    </div>
                    <p className="text-xs opacity-60 mt-2">SY {selectedStudent.schoolYear||'2025–2026'}</p>
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-4">
                {/* Fee breakdown */}
                {(fb.originalTuition||0) > 0 && (
                  <div className="bg-[var(--color-warning-light)] border border-[var(--color-warning-border)] rounded-xl p-4">
                    <h3 className="text-xs font-semibold text-[var(--color-warning-text)] uppercase tracking-wide mb-3">Fee Assessment</h3>
                    <div className="space-y-1.5 text-xs">
                      {[
                        ['Original Tuition', fb.originalTuition],
                        fb.totalDiscount > 0 && ['Discount Applied', -fb.totalDiscount, 'text-[var(--color-error-text)]'],
                        fb.misc   > 0 && ['Misc Fee', fb.misc],
                        fb.lab    > 0 && ['Lab Fee',  fb.lab],
                        fb.books  > 0 && ['Books',    fb.books],
                        fb.other  > 0 && ['Other',    fb.other],
                      ].filter(Boolean).map(([label, val, cls='']) => (
                        <div key={label} className="flex justify-between">
                          <span className="text-[var(--color-text-secondary)]">{label}</span>
                          <span className={`font-mono font-semibold ${cls||'text-[var(--color-text-primary)]'}`}>
                            {val < 0 ? `- ${php(-val)}` : php(val)}
                          </span>
                        </div>
                      ))}
                      <div className="flex justify-between font-bold text-sm pt-2 border-t border-[var(--color-warning-border)]">
                        <span className="text-[var(--color-text-primary)]">Grand Total</span>
                        <span className="font-mono text-[var(--color-primary-readable)]">{php(p.totalFee)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Payment history */}
                <div>
                  <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">Payment History</h3>
                  {hist.length===0 ? (
                    <p className="text-sm text-[var(--color-text-muted)] text-center py-4">No payments recorded yet</p>
                  ) : (
                    <div className="min-w-0">
                    <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
                      <table className="w-full min-w-[460px]">
                        <thead className="bg-[var(--color-bg-subtle)]">
                          <tr>
                            {['OR #','Date','Method','Payment For','Amount','Balance'].map(h=>(
                              <th key={h} className={`px-3 py-2.5 text-xs font-semibold text-[var(--color-text-muted)] uppercase ${['Amount','Balance'].includes(h)?'text-right':'text-left'}`}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border)]">
                          {hist.map((h,idx) => {
                            runBal -= (h.amount||0)
                            const bal = Math.max(0, runBal)
                            return (
                              <tr key={idx} className="hover:bg-[var(--color-bg-subtle)]/30 transition">
                                <td className="px-3 py-2.5 text-xs font-mono text-[var(--color-primary-readable)]">{h.orNumber||'—'}</td>
                                <td className="px-3 py-2.5 text-xs text-[var(--color-text-muted)]">
                                  {h.date ? new Date(h.date).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'}) : '—'}
                                </td>
                                <td className="px-3 py-2.5 text-xs text-[var(--color-text-muted)]">{h.method||'—'}</td>
                                <td className="px-3 py-2.5">
                                  <div className="flex flex-wrap gap-0.5">
                                    {(h.paymentFor||['tuition']).map(k=>(
                                      <span key={k} className="text-[9px] px-1 py-0.5 bg-secondary/10 dark:bg-secondary/30 text-[var(--color-secondary-readable)] rounded font-medium">{FEE_LABELS[k]||k}</span>
                                    ))}
                                  </div>
                                </td>
                                <td className="px-3 py-2.5 text-xs font-bold text-[var(--color-success-text)] text-right font-mono">{php(h.amount)}</td>
                                <td className={`px-3 py-2.5 text-xs font-bold text-right font-mono ${bal<=0 ? 'text-[var(--color-success-text)]' : 'text-[var(--color-warning-text)]'}`}>{php(bal)}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    </div>
                  )}
                </div>

                {/* Balance summary */}
                <div className={`rounded-xl p-4 flex items-center justify-between ${p.balance<=0
                  ? 'bg-[var(--color-success-light)] border border-[var(--color-success-border)]'
                  : 'bg-[var(--color-warning-light)] border border-[var(--color-warning-border)]'}`}>
                  <div>
                    <p className={`text-xs font-semibold uppercase tracking-wide ${p.balance<=0 ? 'text-[var(--color-success-text)]' : 'text-[var(--color-warning-text)]'}`}>
                      {p.balance<=0 ? '✓ Account Fully Settled' : 'Remaining Balance'}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Total paid: {php(p.amountPaid)}</p>
                  </div>
                  <span className={`text-2xl font-bold font-mono ${p.balance<=0 ? 'text-[var(--color-success-text)]' : 'text-[var(--color-warning-text)]'}`}>
                    {php(p.balance)}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-1">
                  <button onClick={handlePrint}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm bg-primary text-[var(--color-primary-contrast)] rounded-xl hover:bg-[var(--color-primary-hover)] transition font-semibold shadow-sm">
                    <Printer className="w-4 h-4"/> Print SOA
                  </button>
                  <ExportButton onClick={handleExportSOA} label="Export Excel" className="flex-1 py-2.5 rounded-xl font-semibold shadow-sm" />
                </div>
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}


// ─────────────────────────────────────────────────────────────────────
// EXTEND DUE DATE — promissory note
// A student who cannot pay on time submits a promissory note; accounting
// moves that student's due date and the reason is kept on record.
// ─────────────────────────────────────────────────────────────────────
function ExtendDueDateModal({ payment, onClose, onSave }) {
  const [newDate,  setNewDate]  = useState('')
  const [reason,   setReason]   = useState('')
  const [noteRef,  setNoteRef]  = useState('')
  const [errors,   setErrors]   = useState({})

  const current = payment.dueDate || ''
  const minDate = current && current > todayYMD() ? current : todayYMD()

  const validate = () => {
    const e = {}
    if (!newDate)                    e.date   = 'Pick the new due date'
    else if (newDate <= minDate)     e.date   = current && current > todayYMD()
      ? 'The new date must be later than the current due date'
      : 'The new date must be after today'
    if (reason.trim().length < 5)    e.reason = 'Enter the reason (e.g. promissory note details)'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = () => {
    if (!validate()) return
    onSave({ newDate, reason: reason.trim(), noteRef: noteRef.trim() })
  }

  return (
    <ModalPortal>
    <div className="modal-backdrop">
      <div className="bg-[var(--color-bg-card)] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[94vh] flex flex-col shadow-[var(--shadow-modal)]">
        <div className="modal-header">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 bg-[var(--color-warning-light)] rounded-full flex items-center justify-center flex-shrink-0">
              <Calendar className="w-5 h-5 text-[var(--color-warning-text)]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-[var(--color-text-primary)] truncate">Extend Due Date</h2>
              <p className="text-xs text-[var(--color-text-muted)] truncate">{payment.studentName} · {payment.studentId}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] rounded-lg hover:bg-[var(--color-bg-subtle)] transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[var(--color-bg-subtle)] border border-[var(--color-border)] rounded-xl p-3 text-center">
              <p className="text-[10px] text-[var(--color-text-muted)] mb-0.5 uppercase tracking-wide">Current Due Date</p>
              <p className="text-sm font-bold text-[var(--color-text-primary)]">{fmtShortDate(current)}</p>
            </div>
            <div className="bg-[var(--color-bg-subtle)] border border-[var(--color-border)] rounded-xl p-3 text-center">
              <p className="text-[10px] text-[var(--color-text-muted)] mb-0.5 uppercase tracking-wide">Balance</p>
              <p className="text-sm font-bold text-[var(--color-warning-text)]">{php(payment.balance)}</p>
            </div>
          </div>

          <div>
            <DatePicker label="New Due Date" value={newDate} onChange={v => { setNewDate(v); setErrors(p => ({ ...p, date: '' })) }} />
            {errors.date && <p className="text-xs text-[var(--color-error-text)] mt-1">{errors.date}</p>}
          </div>

          <div>
            <label className="form-label">Reason / Promissory Note <span className="text-[var(--color-error-text)]">*</span></label>
            <textarea rows={3} value={reason} onChange={e => { setReason(e.target.value); setErrors(p => ({ ...p, reason: '' })) }}
              placeholder="e.g. Parent submitted a promissory note — will pay after harvest season"
              className={`w-full px-3 py-2.5 text-sm rounded-xl border bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none transition resize-none
                ${errors.reason ? 'border-[var(--color-error)]' : 'border-[var(--color-border)] focus:border-[var(--color-primary-readable)] focus:ring-2 focus:ring-primary/20'}`} />
            {errors.reason && <p className="text-xs text-[var(--color-error-text)] mt-1">{errors.reason}</p>}
          </div>

          <div>
            <label className="form-label">Promissory Note No. (optional)</label>
            <input type="text" value={noteRef} onChange={e => setNoteRef(e.target.value)} placeholder="e.g. PN-2026-014"
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary-readable)] focus:ring-2 focus:ring-primary/20 transition" />
          </div>
        </div>

        <div className="modal-footer gap-3">
          <button onClick={onClose} className="btn-cancel">Cancel</button>
          <button onClick={handleSave}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm bg-primary text-[var(--color-primary-contrast)] rounded-xl hover:bg-[var(--color-primary-hover)] transition font-semibold shadow-sm">
            <Calendar className="w-4 h-4" /> Save New Due Date
          </button>
        </div>
      </div>
    </div>
  </ModalPortal>
  )
}

export default function Payments() {
  const { user } = useAuth()
  const { activeCampuses, currentSchoolYear, campusProgramsMap, isBasicGrade, isCollegeGrade, schoolYears } = useAppConfig()

  const isAccountingLocked = user?.role === 'accounting' && user?.campus !== 'all'
  const accountingCampus   = isAccountingLocked ? user.campus : null

  const cashierName = (() => {
    try {
      const campusKey = user?.campus?.replace(/ (City |)Campus$/i, '').replace(/[^a-zA-Z]/g, '') || 'all'
      const campusCfg = JSON.parse(localStorage.getItem(`almirene_campus_cfg_${campusKey}`) || '{}')
      return campusCfg.cashierName || user?.name || 'Accounting Officer'
    } catch { return user?.name || 'Accounting Officer' }
  })()

  const [activeTab, setActiveTab]                   = useState('records')
  const [payments, setPayments]                     = useState([])
  const [showRecordModal, setShowRecordModal]       = useState(false)
  const [showReceiptModal, setShowReceiptModal]     = useState(false)
  const [pendingTransaction, setPendingTransaction] = useState(null)
  const [searchQuery, setSearchQuery]               = useState('')
  const [deptFilter, setDeptFilter]                 = useState('all')
  const [yearFilter, setYearFilter]                 = useState('all')
  const [statusFilter, setStatusFilter]             = useState('all')
  const [gradeLevelFilter, setGradeLevelFilter]     = useState('all')
  const [selectedPayment, setSelectedPayment]       = useState(null)
  const [showModal, setShowModal]                   = useState(false)
  const [showExtendModal, setShowExtendModal]     = useState(false)
  const { campusFilter } = useCampusFilter()
  const [loading, setLoading]                       = useState(true)
  const { toasts, addToast, removeToast }           = useToast()

  const baseCampusFilter = isAccountingLocked
    ? accountingCampus
    : (campusFilter !== 'all' ? activeCampuses.find(c => c.key === campusFilter)?.name : null)

  useEffect(() => {
    const load = () => {
      try {
        const subs = JSON.parse(localStorage.getItem('almirene_submissions') || '[]')
        const paid = subs.filter(s =>
          (s.status === 'payment_received' || s.status === 'approved') &&
          (s.amountPaid > 0 || s.paymentHistory?.length > 0) &&
          (!baseCampusFilter || s.enrollment?.campus === baseCampusFilter)
        ).map(s => {
          const gradeLevel  = s.enrollment?.gradeLevel || ''
          const campus      = s.enrollment?.campus     || ''
          const history     = s.paymentHistory || (s.amountPaid > 0 ? [{
            id: 1, amount: s.amountPaid, method: s.paymentMethod,
            date: s.lastPaymentDate || s.updatedAt || s.submittedDate,
            orNumber: '', notes: '', paymentFor: ['tuition']
          }] : [])
          // Due date: the one saved on the record (set at enrollment or moved by a
          // promissory note); otherwise worked out from the campus policy.
          const dueDate = s.dueDate || computeDefaultDueDate({
            campusName: campus,
            department: isCollegeGrade(gradeLevel) ? 'college' : 'basicEd',
            schoolYear: s.enrollment?.schoolYear,
            schoolYears,
            fromDate:   history[0]?.date || s.lastPaymentDate || s.submittedDate,
          })
          const balance = s.balance || 0
          return {
            studentId:      s.referenceNumber,
            studentName:    s.student?.fullName ||
              `${(s.student?.lastName||'').toUpperCase()}, ${(s.student?.firstName||'').toUpperCase()}`,
            gradeLevel,
            campus,
            semester:       s.enrollment?.semester    || '',
            studentType:    s.enrollment?.studentType || '',
            schoolYear:     s.enrollment?.schoolYear  || '',
            totalFee:       s.totalFee    || 0,
            amountPaid:     s.amountPaid  || 0,
            balance,
            dueDate,
            dueDateExtensions: s.dueDateExtensions || [],
            status:         derivePaymentStatus(balance, dueDate),
            paymentMethod:  s.paymentMethod || '',
            paymentHistory: history,
            feeBreakdown:     s.feeBreakdown     || null,
            discountsApplied: s.discountsApplied || [],
            lastPaymentDate:  s.lastPaymentDate  || s.updatedAt,
            submittedDate:    s.submittedDate
          }
        })
        // Always replace — otherwise switching to a campus with no payments keeps showing the previous list
        setPayments(paid)
      } catch {}
      const t = setTimeout(() => setLoading(false), 100)
      return () => clearTimeout(t)
    }
    load()
    const handleStorage = (e) => {
      if (e.key === 'almirene_submissions' || e.key === null) load()
    }
    window.addEventListener('almirene_enrollment_updated', load)
    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener('almirene_enrollment_updated', load)
      window.removeEventListener('storage', handleStorage)
    }
  }, [baseCampusFilter, schoolYears, isCollegeGrade])
  useEffect(() => {
    setLoading(true); setGradeLevelFilter('all')
    const t = setTimeout(() => setLoading(false), 100)
    return () => clearTimeout(t)
  }, [campusFilter])

  if (loading) return <PageSkeleton title="Payments" />

  const handleRecordPayment = (payment) => {
    setSelectedPayment(payment)
    setShowRecordModal(true)
  }

  const handleSavePayment = (transaction) => {
    // Safety net: an OR number identifies exactly one payment
    if (isOrNumberUsed(transaction.orNumber)) {
      addToast('That OR number is already used on another payment.', 'error')
      return
    }

    const newEntry = {
      id:         Date.now(),
      amount:     transaction.amount,
      method:     transaction.method,
      date:       transaction.date,
      orNumber:   transaction.orNumber,
      notes:      transaction.notes,
      paymentFor: transaction.paymentFor || ['tuition']
    }

    try {
      const subs = JSON.parse(localStorage.getItem('almirene_submissions') || '[]')
      const idx  = subs.findIndex(s => s.referenceNumber === selectedPayment.studentId)
      if (idx !== -1) {
        const sub            = subs[idx]
        const newAmountPaid  = (sub.amountPaid || 0) + transaction.amount
        const newBalance     = Math.max(0, (sub.totalFee || 0) - newAmountPaid)
        // The enrollment STATUS is never changed here. Approving an enrollment is the
        // registrar's decision — a full payment must not skip it, and a partial payment
        // must not pull an already-approved student back to "payment received".
        subs[idx] = {
          ...sub,
          amountPaid:      newAmountPaid,
          balance:         newBalance,
          paymentMethod:   transaction.method,
          lastPaymentDate: transaction.date,
          paymentHistory:  [...(sub.paymentHistory || []), newEntry]
        }
        localStorage.setItem('almirene_submissions', JSON.stringify(subs))
        localStorage.setItem('almirene_status_update', JSON.stringify({ ts: Date.now() }))
        window.dispatchEvent(new Event('almirene_enrollment_updated'))
      }
    } catch (e) {
      console.error('Failed to persist payment to localStorage:', e)
    }

    setPayments(prev => prev.map(p => {
      if (p.studentId !== selectedPayment.studentId) return p
      const newAmountPaid = p.amountPaid + transaction.amount
      const newBalance    = Math.max(0, p.totalFee - newAmountPaid)
      return {
        ...p,
        amountPaid:      newAmountPaid,
        balance:         newBalance,
        status:          derivePaymentStatus(newBalance, p.dueDate),
        paymentMethod:   transaction.method,
        lastPaymentDate: transaction.date,
        paymentHistory:  [...(p.paymentHistory || []), newEntry]
      }
    }))
    setSelectedPayment(prev => {
      const newBalance = Math.max(0, prev.totalFee - prev.amountPaid - transaction.amount)
      return {
        ...prev,
        amountPaid: prev.amountPaid + transaction.amount,
        balance:    newBalance,
        status:     derivePaymentStatus(newBalance, prev.dueDate),
      }
    })
    setPendingTransaction(transaction)
    setShowRecordModal(false)
    setShowReceiptModal(true)
  }

  // Promissory note: move this student's due date and keep the reason on record
  const handleExtendDueDate = ({ newDate, reason, noteRef }) => {
    const ext = {
      id:     Date.now(),
      from:   selectedPayment.dueDate || '',
      to:     newDate,
      reason,
      noteRef,
      by:     user?.name || 'Accounting',
      date:   new Date().toISOString(),
    }
    try {
      const subs = JSON.parse(localStorage.getItem('almirene_submissions') || '[]')
      const idx  = subs.findIndex(s => s.referenceNumber === selectedPayment.studentId)
      if (idx !== -1) {
        subs[idx] = {
          ...subs[idx],
          dueDate: newDate,
          dueDateExtensions: [...(subs[idx].dueDateExtensions || []), ext],
        }
        localStorage.setItem('almirene_submissions', JSON.stringify(subs))
        window.dispatchEvent(new Event('almirene_enrollment_updated'))
      }
    } catch (e) {
      console.error('Failed to save due date extension:', e)
    }
    const apply = (p) => ({
      ...p,
      dueDate: newDate,
      dueDateExtensions: [...(p.dueDateExtensions || []), ext],
      status: derivePaymentStatus(p.balance, newDate),
    })
    setPayments(prev => prev.map(p => p.studentId === selectedPayment.studentId ? apply(p) : p))
    setSelectedPayment(prev => apply(prev))
    setShowExtendModal(false)
    addToast(`Due date moved to ${fmtShortDate(newDate)}.`, 'success')
  }

  if (user?.role === 'admin' || user?.role === 'technical_admin') {
    return (
      <>
        <AdminPaymentsOverview
          payments={payments}
          campusFilter={campusFilter}
          activeCampuses={activeCampuses}
          currentSchoolYear={currentSchoolYear}
          addToast={addToast}
          onRecordPayment={handleRecordPayment}
        />
        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </>
    )
  }

  // Dept + other filters applied to the payment list
  // All college programs available at current campus scope
  // Raw college program names (e.g. 'BS Criminology') scoped to current campus
  // campusProgramsMap stores 'Prog - Year' strings, so we extract unique program names
  const mainCollegePrograms = (() => {
    const getRaw = (entries) =>
      [...new Set(entries.map(e => e.split(' - ').slice(0, -1).join(' - ')).filter(Boolean))]
    if (baseCampusFilter) {
      const campus = activeCampuses.find(c => c.name === baseCampusFilter)
      if (!campus?.hasCollege) return []
      const entries = campusProgramsMap?.[campus.key] || []
      return getRaw(entries)
    }
    const all = activeCampuses
      .filter(c => c.hasCollege)
      .flatMap(c => campusProgramsMap?.[c.key] || [])
    return getRaw(all)
  })()

  // Static option groups — all grades/year levels always shown
  const mainBasicEdGroups = BASIC_ED_GROUPS.map(group => ({
    label: group.label,
    options: group.options.map(g => ({ value: g, label: g }))
  }))
  // One group per program, options are year levels
  const mainCollegeGroups = mainCollegePrograms.map(prog => ({
    label: prog,
    options: COLLEGE_YEAR_LEVELS.map(yr => ({ value: `${prog} - ${yr}`, label: yr }))
  }))

  const handleMainDeptChange = (dept) => { setDeptFilter(dept); setYearFilter('all'); setGradeLevelFilter('all') }

  const filtered = payments.filter(p =>
    (p.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
     p.studentId.toLowerCase().includes(searchQuery.toLowerCase())) &&
    (deptFilter === 'all' ||
      (deptFilter === 'basic'   && isBasicGrade(p.gradeLevel)) ||
      (deptFilter === 'college' && isCollegeGrade(p.gradeLevel))
    ) &&
    (yearFilter === 'all' || p.gradeLevel === yearFilter) &&
    (statusFilter === 'all' || p.status === statusFilter) &&
    (!baseCampusFilter || p.campus === baseCampusFilter) &&
    (gradeLevelFilter === 'all' || p.gradeLevel === gradeLevelFilter || p.gradeLevel.startsWith(gradeLevelFilter + ' -'))
  )

  const stats = {
    revenue:     filtered.reduce((s, p) => s + p.amountPaid, 0),
    outstanding: filtered.reduce((s, p) => s + p.balance, 0),
    totalFee:    filtered.reduce((s, p) => s + p.totalFee, 0),
    paid:        filtered.filter(p => p.status === 'paid').length,
    overdue:     filtered.filter(p => p.status === 'overdue').length
  }
  const collectionRate = stats.totalFee > 0 ? Math.round((stats.revenue / stats.totalFee) * 100) : 0

  const handleExport = () => {
    const data = filtered.map(p => ({
      'Student ID': p.studentId, 'Student Name': p.studentName,
      'Department': isCollegeGrade(p.gradeLevel) ? 'College' : 'Basic Ed',
      'Campus': p.campus, 'Grade / Program': p.gradeLevel,
      'Total Fee': p.totalFee, 'Amount Paid': p.amountPaid, 'Balance': p.balance,
      'Status': p.status.toUpperCase(), 'Payment Method': p.paymentMethod || '—',
      'Last Payment': p.lastPaymentDate ? new Date(p.lastPaymentDate).toLocaleDateString() : '—'
    }))
    exportToExcel(data, `Payments_${new Date().toISOString().split('T')[0]}`, 'Payments')
    addToast(`Exported ${data.length} records!`, 'success')
  }

  const TABS = [
    { id: 'records',  label: 'Payment Records',     icon: <FileText className="w-4 h-4"/>  },
    { id: 'balances', label: 'Student Balances',    icon: <Users    className="w-4 h-4"/>  },
    { id: 'soa',      label: 'Statement of Account',icon: <Receipt  className="w-4 h-4"/> },
  ]


  return (
    <div className="animate-fade-in space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)]">Payments</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          {isAccountingLocked ? `${accountingCampus} · Payment management` : 'Track and manage student payment records'}
        </p>
      </div>


      {/* Tab navigation */}
      <div className="flex gap-1 bg-[var(--color-bg-subtle)] p-1 rounded-xl border border-[var(--color-border)] overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition whitespace-nowrap flex-1 justify-center
              ${activeTab === tab.id
                ? 'bg-[var(--color-bg-card)] text-[var(--color-primary-readable)] shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              }`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB: Payment Records ── */}
      {activeTab === 'records' && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {[
              { label:'Total Revenue',    value:php(stats.revenue),     border:'border-[var(--color-success)]', icon:<TrendingUp className="w-5 h-5 text-[var(--color-success-text)]"/>, sub:'Collected payments',   cls:'text-[var(--color-success-text)]' },
              { label:'Outstanding',      value:php(stats.outstanding), border:'border-[var(--color-warning)]', icon:<Clock className="w-5 h-5 text-[var(--color-warning-text)]"/>,      sub:'Pending collection',   cls:'text-[var(--color-warning-text)]' },
              { label:'Fully Paid',       value:stats.paid,             border:'border-[var(--color-info)]',  icon:<CheckCircle className="w-5 h-5 text-[var(--color-info-text)]"/>, sub:'Students',             cls:'text-[var(--color-info-text)]' },
              { label:'Overdue',          value:stats.overdue,          border:'border-[var(--color-error)]',   icon:<AlertCircle className="w-5 h-5 text-[var(--color-error-text)]"/>,  sub:'Requires follow-up',   cls:stats.overdue > 0 ? 'text-[var(--color-error-text)]' : 'text-[var(--color-text-muted)]' },
            ].map(({ label, value, border, icon, sub, cls }) => (
              <div key={label} className={`bg-[var(--color-bg-card)] rounded-xl p-4 border-l-4 ${border} shadow-sm`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-[var(--color-text-muted)] font-medium">{label}</p>
                  {icon}
                </div>
                <p className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">{value}</p>
                <p className={`text-xs mt-1 font-medium ${cls}`}>{sub}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="bg-[var(--color-bg-card)] rounded-xl p-4 shadow-sm space-y-3">
            {/* Row 1: Dept toggle + year sub-filter + Status + Search + Export */}
            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center flex-wrap">
              {/* Dept toggle */}
              <DeptToggle value={deptFilter} onChange={handleMainDeptChange} />
              {/* Year/grade sub-filter — appears only when a dept is selected */}
              {deptFilter === 'college' && mainCollegeGroups.length > 0 && (
                <div className="flex-shrink-0 min-w-[180px]">
                  <GroupedSelect
                    value={yearFilter}
                    onChange={setYearFilter}
                    allLabel="All Programs & Years"
                    groups={mainCollegeGroups}
                  />
                </div>
              )}
              {deptFilter === 'basic' && mainBasicEdGroups.length > 0 && (
                <div className="flex-shrink-0 min-w-[160px]">
                  <GroupedSelect
                    value={yearFilter}
                    onChange={setYearFilter}
                    allLabel="All Grades"
                    groups={mainBasicEdGroups}
                  />
                </div>
              )}
              {/* Status filter */}
              <div className="flex-shrink-0 min-w-[130px]">
                <GroupedSelect
                  value={statusFilter}
                  onChange={setStatusFilter}
                  allLabel="All Status"
                  options={[
                    { value: 'paid',    label: 'Paid'    },
                    { value: 'partial', label: 'Partial' },
                    { value: 'overdue', label: 'Overdue' },
                  ]}
                />
              </div>
              {/* Search — grows to fill remaining space */}
              <div className="relative flex-1 min-w-[160px]">
                <Search className="search-icon" />
                <input type="text" placeholder="Search student name or ID…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-primary outline-none transition" />
              </div>
              {/* Export */}
              <ExportButton onClick={handleExport} />
            </div>
          </div>

          {/* Payment list */}
          <div className="card-section">
            {filtered.length === 0 ? <EmptyState type="search" /> : (
              <>
                {/* Mobile cards */}
                <ul className="md:hidden divide-y divide-[var(--color-border)]">
                  {filtered.map(p => (
                    <li key={p.studentId}>
                      <button onClick={() => { setSelectedPayment(p); setShowModal(true) }}
                        className="w-full text-left px-4 py-4 hover:bg-[var(--color-bg-subtle)]/50 transition flex items-start gap-3">
                        <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Receipt className="w-4 h-4 text-[var(--color-primary-readable)]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-0.5">
                            <span className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{p.studentName}</span>
                            <StatusBadge status={p.status} />
                          </div>
                          <p className="text-xs font-mono text-[var(--color-primary-readable)]">{p.studentId}</p>
                          {p.balance > 0 && p.dueDate && (
                            <p className={`text-[11px] mt-0.5 ${p.status === 'overdue' ? 'text-[var(--color-error-text)] font-semibold' : 'text-[var(--color-text-muted)]'}`}>
                              Due {fmtShortDate(p.dueDate)}{p.status === 'overdue' ? ` · ${daysPast(p.dueDate)}d overdue` : ''}
                            </p>
                          )}
                          <div className="flex items-center justify-between mt-1">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold
                                ${isBasicGrade(p.gradeLevel)
                                  ? 'bg-[var(--color-success-light)] text-[var(--color-success-text)]'
                                  : 'bg-[var(--color-info-light)] text-[var(--color-info-text)]'
                                }`}>
                                {isBasicGrade(p.gradeLevel) ? 'Basic Ed' : 'College'}
                              </span>
                              <span className="text-xs text-[var(--color-text-muted)]">{p.gradeLevel}</span>
                            </div>
                            <span className="text-sm font-bold text-[var(--color-success-text)]">{php(p.amountPaid)}</span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)] flex-shrink-0 mt-1" />
                      </button>
                    </li>
                  ))}
                </ul>

                {/* Desktop table */}
                <div className="hidden md:block min-w-0">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[960px]">
                      <thead className="bg-[var(--color-bg-subtle)]">
                        <tr>
                          {['Student','Dept',!isAccountingLocked?'Campus':null,'Grade / Program','Total Fee','Paid','Balance','Status','Due Date','Last Payment','Actions'].filter(Boolean).map(h => (
                            <th key={h} className="th">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border)]">
                        {filtered.map(p => {
                          const isBasic = isBasicGrade(p.gradeLevel)
                          return (
                          <tr key={p.studentId} className="hover:bg-[var(--color-bg-subtle)]/50 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <p className="text-sm font-medium text-[var(--color-text-primary)]">{p.studentName}</p>
                              <p className="text-xs font-mono text-[var(--color-primary-readable)]">{p.studentId}</p>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold
                                ${isBasic
                                  ? 'bg-[var(--color-success-light)] text-[var(--color-success-text)]'
                                  : 'bg-[var(--color-info-light)] text-[var(--color-info-text)]'
                                }`}>
                                {isBasic ? 'Basic Ed' : 'College'}
                              </span>
                            </td>
                            {!isAccountingLocked && <td className="px-4 py-3 text-sm text-[var(--color-text-secondary)] whitespace-nowrap">{p.campus}</td>}
                            <td className="px-4 py-3 text-sm text-[var(--color-text-secondary)] whitespace-nowrap">{p.gradeLevel}</td>
                            <td className="px-4 py-3 text-sm text-[var(--color-text-primary)] whitespace-nowrap font-medium">{php(p.totalFee)}</td>
                            <td className="px-4 py-3 text-sm text-[var(--color-success-text)] whitespace-nowrap font-semibold">{php(p.amountPaid)}</td>
                            <td className="px-4 py-3 text-sm whitespace-nowrap font-semibold">
                              <span className={p.balance > 0 ? 'text-[var(--color-error-text)]' : 'text-[var(--color-text-muted)]'}>{p.balance > 0 ? php(p.balance) : '—'}</span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={p.status} /></td>
                            <td className="px-4 py-3 text-xs whitespace-nowrap">
                              {p.balance > 0 && p.dueDate ? (
                                <span className={p.status === 'overdue' ? 'text-[var(--color-error-text)] font-semibold' : 'text-[var(--color-text-secondary)]'}>
                                  {fmtShortDate(p.dueDate)}
                                  {p.status === 'overdue' && <span className="block text-[10px] font-normal">{daysPast(p.dueDate)}d overdue</span>}
                                </span>
                              ) : <span className="text-[var(--color-text-muted)]">—</span>}
                            </td>
                            <td className="px-4 py-3 text-xs text-[var(--color-text-muted)] whitespace-nowrap">
                              {p.lastPaymentDate ? new Date(p.lastPaymentDate).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <button onClick={() => { setSelectedPayment(p); setShowModal(true) }}
                                  className="inline-flex items-center gap-1 text-sm text-[var(--color-primary-readable)] hover:text-[var(--color-primary-hover)] font-medium transition">
                                  <Eye className="w-4 h-4" /> View
                                </button>
                                {p.status !== 'paid' && (
                                  <button onClick={() => handleRecordPayment(p)}
                                    className="inline-flex items-center gap-1 text-xs text-[var(--color-text-inverse)] bg-[var(--color-success)] hover:opacity-90 px-2.5 py-1 rounded-lg font-medium transition">
                                    <Plus className="w-3.5 h-3.5" /> Pay
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="px-4 py-3 border-t border-[var(--color-border)] text-xs text-[var(--color-text-muted)] flex items-center gap-2 flex-wrap">
                  Showing {filtered.length} of {payments.length} records
                  {yearFilter !== 'all' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-[var(--color-primary-readable)] rounded-full font-medium">
                      {yearFilter}
                      <button onClick={() => setYearFilter('all')} className="hover:text-[var(--color-error-text)] transition">×</button>
                    </span>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Payment detail modal */}
          {showModal && selectedPayment && (
            <ModalPortal>
            <div className="modal-backdrop">
              <div className="bg-[var(--color-bg-card)] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[92vh] flex flex-col">
                <div className="modal-header">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <Receipt className="w-5 h-5 text-[var(--color-primary-readable)]" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-base font-bold text-[var(--color-text-primary)] truncate">{selectedPayment.studentName}</h2>
                      <p className="text-xs font-mono text-[var(--color-primary-readable)]">{selectedPayment.studentId}</p>
                    </div>
                  </div>
                  <button onClick={() => setShowModal(false)}
                    className="icon-btn-ghost">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="overflow-y-auto flex-1 p-5 space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={selectedPayment.status} />
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold
                      ${isBasicGrade(selectedPayment.gradeLevel)
                        ? 'bg-[var(--color-success-light)] text-[var(--color-success-text)]'
                        : 'bg-[var(--color-info-light)] text-[var(--color-info-text)]'
                      }`}>
                      {isBasicGrade(selectedPayment.gradeLevel) ? 'Basic Ed' : 'College'}
                    </span>
                    <span className="text-xs text-[var(--color-text-muted)]">{selectedPayment.campus} · {selectedPayment.gradeLevel}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { label: 'Total Fee',    value: php(selectedPayment.totalFee),    cls: 'text-[var(--color-text-primary)]'        },
                      { label: 'Amount Paid',  value: php(selectedPayment.amountPaid),  cls: 'text-[var(--color-success-text)]'   },
                      { label: 'Balance',      value: php(selectedPayment.balance),     cls: selectedPayment.balance > 0 ? 'text-[var(--color-error-text)]' : 'text-[var(--color-text-muted)]' },
                    ].map(({ label, value, cls }) => (
                      <div key={label} className="bg-[var(--color-bg-subtle)] rounded-xl p-3 text-center">
                        <p className="text-xs text-[var(--color-text-muted)] mb-1">{label}</p>
                        <p className={`text-base font-bold ${cls}`}>{value}</p>
                      </div>
                    ))}
                  </div>

                  {selectedPayment.totalFee > 0 && (
                    <div>
                      <div className="flex justify-between text-xs text-[var(--color-text-muted)] mb-1">
                        <span>Payment Progress</span>
                        <span>{Math.round((selectedPayment.amountPaid / selectedPayment.totalFee) * 100)}%</span>
                      </div>
                      <div className="w-full bg-[var(--color-bg-subtle)] rounded-full h-2.5 overflow-hidden">
                        <div className="bg-[var(--color-success)] h-full rounded-full transition-all duration-500"
                          style={{ width: `${(selectedPayment.amountPaid / selectedPayment.totalFee) * 100}%` }} />
                      </div>
                    </div>
                  )}

                  <div className="bg-[var(--color-bg-subtle)] rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
                      <CreditCard className="w-4 h-4" /> Payment Details
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                      {[
                        ['Payment Method', selectedPayment.paymentMethod || '—'],
                        ['Due Date', selectedPayment.balance > 0 && selectedPayment.dueDate
                          ? `${fmtLongDate(selectedPayment.dueDate)}${selectedPayment.status === 'overdue' ? ` (${daysPast(selectedPayment.dueDate)}d overdue)` : ''}`
                          : (selectedPayment.balance > 0 ? 'Not set' : '—')],
                        ['Last Payment', selectedPayment.lastPaymentDate ? new Date(selectedPayment.lastPaymentDate).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}) : '—'],
                        ['Installments', selectedPayment.paymentHistory.length],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <p className="text-xs text-[var(--color-text-muted)] mb-0.5">{label}</p>
                          <p className="font-medium text-[var(--color-text-primary)]">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {(selectedPayment.dueDateExtensions || []).length > 0 && (
                    <div className="bg-[var(--color-bg-subtle)] rounded-xl p-4">
                      <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
                        <Calendar className="w-4 h-4" /> Due Date Extensions
                      </h3>
                      <div className="space-y-2">
                        {selectedPayment.dueDateExtensions.map(x => (
                          <div key={x.id} className="py-2 border-b border-[var(--color-border)] last:border-0">
                            <p className="text-xs font-semibold text-[var(--color-text-primary)]">
                              {fmtShortDate(x.from)} → {fmtShortDate(x.to)}
                              {x.noteRef && <span className="ml-2 font-mono font-normal text-[var(--color-primary-readable)]">{x.noteRef}</span>}
                            </p>
                            <p className="text-xs text-[var(--color-text-muted)] italic mt-0.5">{x.reason}</p>
                            <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{x.by} · {fmtShortDate(x.date)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedPayment.paymentHistory.length > 0 && (
                    <div className="bg-[var(--color-bg-subtle)] rounded-xl p-4">
                      <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
                        <Receipt className="w-4 h-4" /> Payment History
                      </h3>
                      <div className="space-y-2">
                        {selectedPayment.paymentHistory.map(h => (
                          <div key={h.id} className="flex items-center justify-between py-2 border-b border-[var(--color-border)] last:border-0">
                            <div>
                              <p className="text-xs font-mono text-[var(--color-primary-readable)]">{h.orNumber}</p>
                              <p className="text-xs text-[var(--color-text-muted)]">{h.method} · {new Date(h.date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</p>
                              {h.notes && <p className="text-xs text-[var(--color-text-muted)] italic mt-0.5">{h.notes}</p>}
                            </div>
                            <p className="text-sm font-bold text-[var(--color-success-text)]">{php(h.amount)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="px-5 py-4 border-t border-[var(--color-border)] bg-[var(--color-bg-subtle)] flex justify-between items-center gap-3 flex-shrink-0">
                  <button onClick={() => setShowModal(false)}
                    className="btn-cancel">
                    Close
                  </button>
                  {(user?.role === 'accounting' || (user?.role === 'admin' || user?.role === 'technical_admin')) && selectedPayment.status !== 'paid' && (
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <button onClick={() => setShowExtendModal(true)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-xl hover:bg-[var(--color-bg-subtle)] transition font-semibold">
                        <Calendar className="w-4 h-4" /> Extend Due Date
                      </button>
                      <button onClick={() => { setShowModal(false); handleRecordPayment(selectedPayment) }}
                        className="flex items-center gap-2 px-5 py-2.5 text-sm bg-[var(--color-success)] text-[var(--color-text-inverse)] rounded-xl hover:opacity-90 transition font-semibold shadow-sm">
                        <Plus className="w-4 h-4" /> Record Payment
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </ModalPortal>
          )}
        </>
      )}

      {/* ── TAB: Student Balances ── */}
      {activeTab === 'balances' && (
        <StudentBalanceTab
          payments={filtered}
          collegePrograms={mainCollegePrograms}
          exportToExcel={exportToExcel}
          addToast={addToast}
        />
      )}

      {/* ── TAB: Statement of Account ── */}
      {activeTab === 'soa' && (
        <SOATab
          payments={filtered}
          cashierName={cashierName}
          schoolYear={currentSchoolYear}
          campusName={isAccountingLocked ? accountingCampus : 'All Campuses'}
          exportToExcel={exportToExcel}
          addToast={addToast}
        />
      )}

      {/* Record Payment Modal */}
      {showRecordModal && selectedPayment && (
        <RecordPaymentModal
          payment={selectedPayment}
          onClose={() => setShowRecordModal(false)}
          onSave={handleSavePayment}
          cashierName={cashierName}
          schoolYear={currentSchoolYear}
        />
      )}

      {/* Extend Due Date Modal */}
      {showExtendModal && selectedPayment && (
        <ExtendDueDateModal
          payment={selectedPayment}
          onClose={() => setShowExtendModal(false)}
          onSave={handleExtendDueDate}
        />
      )}

      {/* Receipt Preview Modal */}
      {showReceiptModal && selectedPayment && pendingTransaction && (
        <ReceiptPreview
          payment={selectedPayment}
          newTransaction={pendingTransaction}
          schoolName={getSchoolBrand().name}
          cashierName={cashierName}
          schoolYear={currentSchoolYear}
          onClose={() => { setShowReceiptModal(false); setPendingTransaction(null); addToast('Payment recorded successfully!', 'success') }}
          onPrint={() => addToast('Receipt sent to printer!', 'success')}
        />
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  )
}