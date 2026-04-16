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
function AdminPaymentsOverview({ payments, campusFilter, activeCampuses, currentSchoolYear, addToast, onRecordPayment }) {
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
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)]">Payments</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
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
            <div className="bg-green-500 h-full rounded-full transition-all duration-700"
              style={{ width: `${(grandRevenue / grandTotalFee) * 100}%` }} />
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-400">
            <span>Collected: <span className="font-semibold text-green-600 dark:text-green-400">{php(grandRevenue)}</span></span>
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
                      <div className="bg-green-500 h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-[var(--color-text-secondary)] w-10 text-right">{pct}%</span>
                    <span className="text-xs text-green-600 dark:text-green-400 w-28 text-right hidden sm:block">{php(cr)}</span>
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
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> Collected</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[var(--color-border-strong)] inline-block" /> Outstanding</span>
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
                <div className="flex-1 h-px bg-[var(--color-border)]" />
                <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-bg-subtle)] rounded-full">
                  <MapPin className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                  <span className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-secondary)]">{campus.name}</span>
                  <span className="text-xs text-green-600 dark:text-green-400 font-semibold">· {php(campusRevenue)} collected</span>
                </div>
                <div className="flex-1 h-px bg-[var(--color-border)]" />
              </div>
            )}

            {/* Campus income summary strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total Expected', value: php(campusTotalFee),                                        cls: 'text-[var(--color-text-primary)]' },
                { label: 'Collected',      value: php(campusRevenue),                                         cls: 'text-green-600 dark:text-green-400' },
                { label: 'Outstanding',    value: php(campusPayments.reduce((s,p)=>s+p.balance,0)),           cls: 'text-red-500 dark:text-red-400' },
                { label: 'Collection Rate',value: `${campusTotalFee>0?Math.round((campusRevenue/campusTotalFee)*100):0}%`, cls: 'text-blue-600 dark:text-blue-400' },
              ].map(({ label, value, cls }) => (
                <div key={label} className="bg-[var(--color-bg-card)] rounded-xl p-3 shadow-sm text-center">
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
                  <h2 className="text-sm font-bold text-[var(--color-text-primary)] uppercase tracking-wider">Basic Education</h2>
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
                  <h2 className="text-sm font-bold text-[var(--color-text-primary)] uppercase tracking-wider">College</h2>
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
              <div className="flex items-center gap-2 px-4 py-3 bg-[var(--color-bg-subtle)] rounded-xl text-sm text-gray-400">
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
    <div className="receipt-copy border border-gray-300 rounded-lg p-5 bg-white text-gray-900" style={{ fontFamily: 'Georgia, serif', fontSize: '13px' }}>
      {/* Header */}
      <div className="text-center mb-3 pb-3 border-b-2 border-double border-gray-400">
        <div className="flex justify-center mb-1">
          <img src="/cshclogo.png" alt="CSHC" style={{ height: 52, width: 52, objectFit: 'contain' }} />
        </div>
        <p className="font-bold text-sm uppercase tracking-wide" style={{ color: '#750014' }}>{schoolName}</p>
        <p className="text-xs text-gray-500">{payment.campus}</p>
        <p className="text-xs text-gray-500">School Year {schoolYear}</p>
        <div className="mt-2 inline-block border border-gray-400 px-3 py-0.5 rounded text-xs font-bold uppercase tracking-wider text-gray-700">
          Official Receipt
        </div>
      </div>

      {/* OR info row */}
      <div className="flex justify-between text-xs mb-3">
        <div>
          <span className="text-gray-500">OR No.: </span>
          <span className="font-bold font-mono">{newTransaction.orNumber}</span>
        </div>
        <div className="text-right">
          <div><span className="text-gray-500">Date: </span><span className="font-semibold">{dateStr}</span></div>
          <div><span className="text-gray-500">Time: </span><span className="font-semibold">{timeStr}</span></div>
        </div>
      </div>

      {/* Student info */}
      <div className="bg-[var(--color-bg-subtle)] rounded p-3 mb-3 text-xs space-y-1">
        <div className="flex gap-2">
          <span className="text-gray-500 w-20 flex-shrink-0">Student:</span>
          <span className="font-bold">{payment.studentName}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-gray-500 w-20 flex-shrink-0">Student ID:</span>
          <span className="font-mono">{payment.studentId}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-gray-500 w-20 flex-shrink-0">Program:</span>
          <span>{payment.gradeLevel}</span>
        </div>
      </div>

      {/* Payment breakdown */}
      <table className="w-full text-xs mb-3">
        <thead>
          <tr className="border-b border-gray-300">
            <th className="text-left py-1 text-gray-500 font-normal">Description</th>
            <th className="text-right py-1 text-gray-500 font-normal">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="py-1">{newTransaction.notes || 'Tuition / Miscellaneous Fee'}</td>
            <td className="py-1 text-right font-mono font-bold">₱{newTransaction.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
          </tr>
          <tr>
            <td className="py-1 text-gray-500">Payment Method</td>
            <td className="py-1 text-right">{newTransaction.method}</td>
          </tr>
        </tbody>
      </table>

      {/* Totals */}
      <div className="border-t border-gray-300 pt-2 mb-3 space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-500">Total Fee:</span>
          <span className="font-mono">₱{payment.totalFee.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Previously Paid:</span>
          <span className="font-mono">₱{payment.amountPaid.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="flex justify-between font-bold text-sm border-t border-gray-300 pt-1 mt-1">
          <span style={{ color: '#750014' }}>Amount This Payment:</span>
          <span className="font-mono" style={{ color: '#750014' }}>₱{newTransaction.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Total Paid:</span>
          <span className="font-mono font-semibold text-green-700">₱{totalPaidAfter.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Remaining Balance:</span>
          <span className={`font-mono font-semibold ${balanceAfter > 0 ? 'text-red-600' : 'text-green-700'}`}>
            ₱{balanceAfter.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-dashed border-gray-300 pt-3 text-xs text-center text-gray-500">
        <div className="flex justify-between items-end mt-4">
          <div className="text-center">
            <div className="border-t border-gray-400 pt-1 w-32">
              <p className="font-semibold text-gray-700">{cashierName}</p>
              <p>Cashier / Accounting</p>
            </div>
          </div>
          <div className="text-center">
            <div className="border-t border-gray-400 pt-1 w-32">
              <p className="italic text-gray-400">Received by</p>
              <p>Student / Parent</p>
            </div>
          </div>
        </div>
        <p className="mt-3 text-gray-400 text-[10px]">{copyLabel} — Thank you for your payment!</p>
      </div>
    </div>
  )

  const handlePrint = () => {
    const printContent = receiptRef.current?.innerHTML
    if (!printContent) return
    const w = window.open('', '_blank', 'width=700,height=900')
    w.document.write(`<!DOCTYPE html><html><head><title>Official Receipt - ${payment.studentName}</title>
      <style>
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
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4">
      <div className="bg-[var(--color-bg-card)] rounded-2xl w-full max-w-3xl max-h-[94vh] flex flex-col shadow-[var(--shadow-modal)]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)] flex-shrink-0">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-primary" />
            <h2 className="text-base font-bold text-[var(--color-text-primary)]">Receipt Preview</h2>
            <span className="text-xs text-gray-400 ml-1">— 2 copies per page</span>
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
          <p className="text-center text-xs text-gray-400 mt-3 flex items-center justify-center gap-1">
            <span className="inline-block w-10 border-t border-dashed border-gray-300"></span>
            cut here
            <span className="inline-block w-10 border-t border-dashed border-gray-300"></span>
          </p>
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-[var(--color-border)] bg-[var(--color-bg-subtle)] flex justify-between items-center flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2.5 text-sm text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-xl hover:bg-[var(--color-bg-subtle)] transition font-medium">
            Close
          </button>
          <button onClick={handlePrint}
            className="flex items-center gap-2 px-6 py-2.5 text-sm bg-primary text-white rounded-xl hover:bg-accent-burgundy transition font-semibold shadow-sm">
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
  const isCollegePay = payment.gradeLevel
    ? !['nursery','kindergarten','preparatory','grade 1','grade 2','grade 3','grade 4',
        'grade 5','grade 6','grade 7','grade 8','grade 9','grade 10','grade 11','grade 12']
        .includes((payment.gradeLevel || '').toLowerCase())
    : false

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
        date:       new Date().toISOString(),
      })
    }, 600)
  }

  const paidPct = payment.totalFee > 0 ? Math.round((payment.amountPaid / payment.totalFee) * 100) : 0
  const newPct  = amount && !isNaN(parseFloat(amount))
    ? Math.min(100, Math.round(((payment.amountPaid + parseFloat(amount)) / payment.totalFee) * 100))
    : paidPct

  return (
    <ModalPortal>
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-[9998] p-0 sm:p-4">
      <div className="bg-[var(--color-bg-card)] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[94vh] flex flex-col shadow-[var(--shadow-modal)]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)] flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0">
              <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
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
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Total Fee',   value: `₱${payment.totalFee.toLocaleString()}`,   cls: 'text-[var(--color-text-primary)]' },
              { label: 'Paid',        value: `₱${payment.amountPaid.toLocaleString()}`,  cls: 'text-green-600 dark:text-green-400' },
              { label: 'Balance',     value: `₱${(payment.totalFee - payment.amountPaid).toLocaleString()}`, cls: 'text-red-500 dark:text-red-400' },
            ].map(({ label, value, cls }) => (
              <div key={label} className="bg-[var(--color-bg-subtle)] rounded-xl p-3 text-center">
                <p className="text-[10px] text-gray-400 mb-0.5 uppercase tracking-wide">{label}</p>
                <p className={`text-sm font-bold ${cls}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Progress bar — live preview */}
          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Payment progress</span>
              <span>{newPct}%</span>
            </div>
            <div className="h-2.5 bg-[var(--color-bg-subtle)] rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full transition-all duration-300" style={{ width: `${newPct}%` }} />
            </div>
          </div>

          {/* Amount input */}
          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5">
              Amount to Record <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-sm">₱</span>
              <input
                type="number" min="1" max={maxAmount} step="0.01"
                value={amount} onChange={e => setAmount(e.target.value)}
                placeholder={`Max: ₱${maxAmount.toLocaleString()}`}
                className={`w-full pl-7 pr-4 py-2.5 text-sm border rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none transition
                  ${errors.amount ? 'border-red-400 focus:ring-red-400/30' : 'border-[var(--color-border)] focus:border-primary focus:ring-2 focus:ring-primary/20'}`}
              />
            </div>
            {errors.amount && <p className="text-xs text-red-500 mt-1">{errors.amount}</p>}
            {/* Quick amount buttons */}
            <div className="flex gap-2 mt-2 flex-wrap">
              {[500, 1000, 2000, 5000].filter(v => v <= maxAmount + 1).map(v => (
                <button key={v} onClick={() => setAmount(String(v))}
                  className="text-xs px-2.5 py-1 bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)] rounded-lg hover:bg-primary hover:text-white transition font-medium">
                  ₱{v.toLocaleString()}
                </button>
              ))}
              <button onClick={() => setAmount(String(maxAmount))}
                className="text-xs px-2.5 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-600 hover:text-white transition font-medium">
                Full Balance
              </button>
            </div>
          </div>

          {/* Payment method */}
          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5">Payment Method</label>
            <div className="flex gap-2">
              {['Cash', 'Bank Transfer'].map(m => (
                <button key={m} onClick={() => setMethod(m)}
                  className={`flex-1 py-2.5 text-sm font-semibold rounded-xl border transition
                    ${method === m
                      ? 'bg-primary text-white border-primary'
                      : 'bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-primary'
                    }`}>
                  {m === 'Cash' ? '💵' : '🏦'} {m}
                </button>
              ))}
            </div>
          </div>

          {/* OR Number */}
          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5">
              OR Number <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text" value={orNumber} onChange={e => setOrNumber(e.target.value)}
                className={`flex-1 px-3 py-2.5 text-sm font-mono border rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none transition
                  ${errors.orNumber ? 'border-red-400' : 'border-[var(--color-border)] focus:border-primary focus:ring-2 focus:ring-primary/20'}`}
              />
              <button onClick={() => setOrNumber(generateOR('OR'))}
                className="px-3 py-2.5 text-xs bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)] rounded-xl hover:bg-[var(--color-bg-muted)] transition font-medium whitespace-nowrap">
                Generate
              </button>
            </div>
            {errors.orNumber && <p className="text-xs text-red-500 mt-1">{errors.orNumber}</p>}
          </div>

          {/* Payment For */}
          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5">
              Payment For <span className="text-red-500">*</span>
              <span className="ml-1 font-normal text-gray-400">(select all that apply)</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {feeOptions.map(opt => {
                const checked = paymentFor.includes(opt.key)
                return (
                  <button key={opt.key} type="button"
                    onClick={() => toggleFeeFor(opt.key)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition
                      ${checked
                        ? 'border-primary bg-primary/5 dark:bg-primary/10'
                        : 'border-[var(--color-border)] hover:border-primary/50 bg-[var(--color-bg-subtle)]'
                      }`}>
                    <div className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border-2 transition
                      ${checked ? 'bg-primary border-primary' : 'border-[var(--color-border-strong)]'}`}>
                      {checked && <CheckCircle className="w-2.5 h-2.5 text-white"/>}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-xs font-semibold truncate ${checked ? 'text-primary dark:text-red-400' : 'text-[var(--color-text-primary)]'}`}>
                        {opt.label}
                      </p>
                      {opt.amount > 0 && (
                        <p className="text-[10px] text-gray-400 font-mono">₱{opt.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
            {paymentFor.length === 0 && (
              <p className="text-xs text-red-500 mt-1">Please select at least one fee type</p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5">Notes (optional)</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Monthly installment — March, Down payment..."
              className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
            />
          </div>

          {/* Cashier info */}
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-4 py-2.5 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Recorded by: <span className="font-semibold">{cashierName}</span> · {new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[var(--color-border)] bg-[var(--color-bg-subtle)] flex gap-3 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2.5 text-sm text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-xl hover:bg-[var(--color-bg-subtle)] transition font-medium">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm bg-green-600 text-white rounded-xl hover:bg-green-700 transition font-semibold disabled:opacity-60 shadow-sm">
            {saving
              ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Saving...</>
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
                ? 'bg-[#750014] text-white'
                : t.id === 'basic'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-[#080c42] text-white'
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
    options: group.options.map(g => ({ value: g, label: g })),
  }))

  // College — all programs × all year levels (prop, falls back to empty)
  const collegeGroups = (collegePrograms || []).map(prog => ({
    label: prog,
    options: COLLEGE_YEAR_LEVELS.map(yr => ({ value: `${prog} - ${yr}`, label: yr })),
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
      balance:      p.balance,
    }))
  ).sort((a,b) => new Date(b.date||0) - new Date(a.date||0))

  const filtered = allTx.filter(tx => {
    const name = (tx.studentName||'').toLowerCase()
    const or   = (tx.orNumber||'').toLowerCase()
    const q    = search.toLowerCase()
    if (q && !name.includes(q) && !or.includes(q)) return false
    if (deptFilter === 'basic'   && !isBasicEd(tx.gradeLevel)) return false
    if (deptFilter === 'college' && !isCollege(tx.gradeLevel)) return false
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
  const basicTotal    = allTx.filter(tx => isBasicEd(tx.gradeLevel)).reduce((s,t) => s + (t.amount||0), 0)
  const collegeTotal  = allTx.filter(tx => isCollege(tx.gradeLevel)).reduce((s,t) => s + (t.amount||0), 0)

  const hasFilters = search || deptFilter !== 'all' || yearFilter !== 'all' || methodFilter !== 'all' || feeFilter !== 'all' || dateFrom || dateTo
  const clearAll   = () => { setSearch(''); setDeptFilter('all'); setYearFilter('all'); setMethodFilter('all'); setFeeFilter('all'); setDateFrom(''); setDateTo('') }

  const handleExport = () => {
    const data = filtered.map(tx => ({
      'OR Number':     tx.orNumber || '—',
      'Reference #':   tx.refNum,
      'Student Name':  tx.studentName,
      'Department':    isCollege(tx.gradeLevel) ? 'College' : 'Basic Ed',
      'Grade/Program': tx.gradeLevel,
      'Payment For':   (tx.paymentFor||[]).map(k=>FEE_LABELS[k]||k).join(', ') || '—',
      'Method':        tx.method || '—',
      'Date':          tx.date ? new Date(tx.date).toLocaleDateString('en-PH') : '—',
      'Amount':        tx.amount || 0,
      'Notes':         tx.notes || '',
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"/>
            <input value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="Search student or OR #..."
              className="w-full pl-8 pr-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:border-primary transition"/>
          </div>
          <ExportButton onClick={handleExport} size="sm" />
        </div>

        {/* Date range row */}
        <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-[var(--color-border)]">
          <div className="flex items-center gap-2 flex-1">
            <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0"/>
            <label className="text-xs text-gray-400 whitespace-nowrap">From:</label>
            <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}
              className="flex-1 px-2 py-1.5 text-xs border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:border-primary transition"/>
          </div>
          <div className="flex items-center gap-2 flex-1">
            <label className="text-xs text-gray-400 whitespace-nowrap">To:</label>
            <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}
              className="flex-1 px-2 py-1.5 text-xs border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:border-primary transition"/>
          </div>
          {hasFilters && (
            <button onClick={clearAll}
              className="text-xs px-3 py-1.5 text-gray-400 hover:text-red-500 border border-[var(--color-border)] rounded-lg transition whitespace-nowrap">
              ✕ Clear all
            </button>
          )}
        </div>

        {/* Dept mini-summary (only when All is selected) */}
        {deptFilter === 'all' && (basicTotal > 0 || collegeTotal > 0) && (
          <div className="flex gap-3 pt-1">
            <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"/>
              Basic Ed: <span className="font-semibold text-[var(--color-text-primary)] font-mono">{phpFmt(basicTotal)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
              <span className="w-2 h-2 rounded-full bg-[#080c42] dark:bg-blue-400 inline-block"/>
              College: <span className="font-semibold text-[var(--color-text-primary)] font-mono">{phpFmt(collegeTotal)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary"/>
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">
              {deptFilter === 'basic' ? 'Basic Ed Transactions' : deptFilter === 'college' ? 'College Transactions' : 'All Transactions'}
            </span>
            <span className="text-xs bg-[var(--color-bg-subtle)] text-gray-500 px-2 py-0.5 rounded-full">{filtered.length}</span>
            {yearFilter !== 'all' && (
              <span className="text-xs bg-primary/10 text-primary dark:text-red-300 px-2 py-0.5 rounded-full font-medium">{yearFilter}</span>
            )}
          </div>
          <span className="text-sm font-bold text-green-600 dark:text-green-400 font-mono">{phpFmt(totalFiltered)}</span>
        </div>
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
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
                  const isBasic = isBasicEd(tx.gradeLevel)
                  return (
                  <tr key={i} className="hover:bg-[var(--color-bg-subtle)]/30 transition">
                    <td className="px-4 py-3 text-xs font-mono text-primary dark:text-red-400">{tx.orNumber||'—'}</td>
                    <td className="px-4 py-3 text-sm font-medium text-[var(--color-text-primary)]">{tx.studentName}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap
                        ${isBasic
                          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                          : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        }`}>
                        {isBasic ? 'Basic Ed' : 'College'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">{tx.gradeLevel}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(tx.paymentFor||['tuition']).map(k => (
                          <span key={k} className="text-[10px] px-1.5 py-0.5 bg-secondary/10 dark:bg-secondary/30 text-secondary dark:text-blue-300 rounded font-medium">
                            {FEE_LABELS[k]||k}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">{tx.method||'—'}</td>
                    <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">{fmtDate(tx.date)}</td>
                    <td className="px-4 py-3 text-sm font-bold text-green-600 dark:text-green-400 text-right font-mono">{phpFmt(tx.amount)}</td>
                  </tr>
                  )
                })}
              </tbody>
              <tfoot className="bg-[var(--color-bg-subtle)] border-t-2 border-[var(--color-border)]">
                <tr>
                  <td colSpan={7} className="px-4 py-3 text-sm font-bold text-[var(--color-text-primary)]">Total</td>
                  <td className="px-4 py-3 text-sm font-bold text-green-600 dark:text-green-400 text-right font-mono">{phpFmt(totalFiltered)}</td>
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
  const [search,     setSearch]     = useState('')
  const [deptFilter, setDeptFilter] = useState('all')
  const [yearFilter, setYearFilter] = useState('all')
  const [sortBy,     setSortBy]     = useState('balance_desc')

  const phpFmt  = n => `₱${(n||0).toLocaleString('en-PH',{minimumFractionDigits:2})}`
  const fmtDate = d => d ? new Date(d).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'}) : '—'

  const handleDeptChange = (dept) => { setDeptFilter(dept); setYearFilter('all') }

  // Basic Ed — all grades from static config
  const basicEdGroups = BASIC_ED_GROUPS.map(group => ({
    label: group.label,
    options: group.options.map(g => ({ value: g, label: g })),
  }))

  // College — all programs × all year levels from static config
  const collegeGroups = collegePrograms.map(prog => ({
    label: prog,
    options: COLLEGE_YEAR_LEVELS.map(yr => ({ value: `${prog} - ${yr}`, label: yr })),
  }))

  // Only students with remaining balance
  const withBalance = payments.filter(p => p.balance > 0)

  const filtered = withBalance.filter(p => {
    const matchSearch = !search || p.studentName.toLowerCase().includes(search.toLowerCase()) ||
      p.studentId.toLowerCase().includes(search.toLowerCase())
    const matchDept   = deptFilter === 'all' ||
      (deptFilter === 'basic'   && isBasicEd(p.gradeLevel)) ||
      (deptFilter === 'college' && isCollege(p.gradeLevel))
    const matchYear   = yearFilter === 'all' || p.gradeLevel === yearFilter
    return matchSearch && matchDept && matchYear
  }).sort((a,b) => {
    if (sortBy === 'balance_desc') return b.balance - a.balance
    if (sortBy === 'balance_asc')  return a.balance - b.balance
    if (sortBy === 'name')         return a.studentName.localeCompare(b.studentName)
    if (sortBy === 'oldest')       return new Date(a.submittedDate||0) - new Date(b.submittedDate||0)
    return 0
  })

  const daysSince = d => d ? Math.floor((Date.now() - new Date(d)) / 86400000) : 0

  const totalOutstanding = filtered.reduce((s,p) => s+p.balance, 0)
  const overdue          = filtered.filter(p => daysSince(p.submittedDate) > 30)

  // Dept subtotals for all-mode display
  const basicOut   = withBalance.filter(p => isBasicEd(p.gradeLevel)).reduce((s,p) => s+p.balance, 0)
  const collegeOut = withBalance.filter(p => isCollege(p.gradeLevel)).reduce((s,p) => s+p.balance, 0)

  const handleExport = () => {
    const data = filtered.map(p => ({
      'Reference #':   p.studentId,
      'Student Name':  p.studentName,
      'Department':    isCollege(p.gradeLevel) ? 'College' : 'Basic Ed',
      'Grade/Program': p.gradeLevel,
      'Campus':        p.campus,
      'Total Fee':     p.totalFee,
      'Amount Paid':   p.amountPaid,
      'Balance':       p.balance,
      'Days Since Enrollment': daysSince(p.submittedDate),
      'Status':        daysSince(p.submittedDate) > 30 ? 'Overdue' : 'Partial',
    }))
    exportToExcel(data, `Student_Balances_${new Date().toISOString().split('T')[0]}`, 'Balances')
    addToast('Student balances exported!', 'success')
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label:'Students with Balance', value: withBalance.length, icon:<Users className="w-5 h-5 text-amber-500"/>, border:'border-amber-400', cls:'text-amber-600 dark:text-amber-400' },
          { label:'Total Outstanding',     value: phpFmt(totalOutstanding), icon:<DollarSign className="w-5 h-5 text-red-500"/>, border:'border-red-400', cls:'text-red-500 dark:text-red-400' },
          { label:'Overdue (>30 days)',    value: overdue.length, icon:<AlertCircle className="w-5 h-5 text-orange-500"/>, border:'border-orange-400', cls:'text-orange-600 dark:text-orange-400' },
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
                { value: 'oldest',       label: 'Oldest First'    },
              ]}
            />
          </div>
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"/>
            <input value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="Search student name or reference #..."
              className="w-full pl-8 pr-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:border-primary transition"/>
          </div>
          <ExportButton onClick={handleExport} size="sm" />
        </div>
        {/* Dept mini breakdown — shown in all-mode when data exists */}
        {deptFilter === 'all' && (basicOut > 0 || collegeOut > 0) && (
          <div className="flex gap-4 pt-1 border-t border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"/>
              Basic Ed: <span className="font-semibold text-amber-600 dark:text-amber-400 font-mono">{phpFmt(basicOut)}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#080c42] dark:bg-blue-400 inline-block"/>
              College: <span className="font-semibold text-amber-600 dark:text-amber-400 font-mono">{phpFmt(collegeOut)}</span>
            </span>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-center gap-2 flex-wrap">
          <Users className="w-4 h-4 text-primary"/>
          <span className="text-sm font-semibold text-[var(--color-text-primary)]">
            {deptFilter === 'basic' ? 'Basic Ed Students with Balance' : deptFilter === 'college' ? 'College Students with Balance' : 'Students with Outstanding Balance'}
          </span>
          <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full">{filtered.length}</span>
          {yearFilter !== 'all' && (
            <span className="text-xs bg-primary/10 text-primary dark:text-red-300 px-2 py-0.5 rounded-full font-medium">{yearFilter}</span>
          )}
        </div>
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-400 opacity-60"/>
            <p className="text-sm font-medium text-green-600 dark:text-green-400">
              {yearFilter !== 'all' ? `No students with balance in ${yearFilter}` : deptFilter !== 'all' ? `No ${deptFilter === 'basic' ? 'Basic Ed' : 'College'} students with balance` : 'All students are fully paid!'}
            </p>
          </div>
        ) : (
          <div className="min-w-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[580px]">
              <thead className="bg-[var(--color-bg-subtle)]">
                <tr>
                  {['Student','Dept','Grade/Program','Total Fee','Paid','Balance','Days','Status'].map(h=>(
                    <th key={h} className={`px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide ${['Total Fee','Paid','Balance'].includes(h)?'text-right':'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {filtered.map((p,i) => {
                  const days    = daysSince(p.submittedDate)
                  const paidPct = p.totalFee > 0 ? Math.round((p.amountPaid/p.totalFee)*100) : 0
                  const isOld   = days > 30
                  const isBasic = isBasicEd(p.gradeLevel)
                  return (
                    <tr key={i} className={`transition ${isOld ? 'bg-red-50/40 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20' : 'hover:bg-[var(--color-bg-subtle)]/30'}`}>
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-[var(--color-text-primary)]">{p.studentName}</p>
                        <p className="text-xs text-gray-400 font-mono">{p.studentId}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap
                          ${isBasic
                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                            : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          }`}>
                          {isBasic ? 'Basic Ed' : 'College'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">{p.gradeLevel}</td>
                      <td className="px-4 py-3 text-sm font-mono text-right text-[var(--color-text-primary)]">{phpFmt(p.totalFee)}</td>
                      <td className="px-4 py-3 text-right">
                        <p className="text-sm font-mono text-green-600 dark:text-green-400">{phpFmt(p.amountPaid)}</p>
                        <div className="w-full bg-[var(--color-bg-subtle)] rounded-full h-1 mt-1">
                          <div className="bg-green-500 h-full rounded-full" style={{width:`${paidPct}%`}}/>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-right font-mono text-amber-600 dark:text-amber-400">{phpFmt(p.balance)}</td>
                      <td className="px-4 py-3 text-xs text-center text-[var(--color-text-muted)]">{days}d</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] px-2 py-1 rounded-full font-semibold ${isOld
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                          : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'}`}>
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
                  <td className="px-4 py-3 text-sm font-bold text-amber-600 dark:text-amber-400 text-right font-mono">{phpFmt(totalOutstanding)}</td>
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
      * { font-family: Arial, sans-serif; margin: 0; padding: 0; box-sizing: border-box; }
      body { padding: 32px; color: #111; font-size: 13px; }
      .header { text-align: center; border-bottom: 3px solid #750014; padding-bottom: 16px; margin-bottom: 20px; }
      .school-name { font-size: 20px; font-weight: bold; color: #750014; }
      .soa-title { font-size: 15px; font-weight: bold; margin: 6px 0; color: #080c42; letter-spacing: 2px; text-transform: uppercase; }
      .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin-bottom: 20px; padding: 16px; background: #f8f4ed; border-radius: 8px; }
      .info-row { display: flex; gap: 6px; font-size: 12px; }
      .info-label { color: #666; min-width: 110px; }
      .info-value { font-weight: 600; }
      .fee-box { background: #fff7f0; border: 1px solid #e5c99a; border-radius: 8px; padding: 14px; margin-bottom: 20px; }
      .fee-box h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #750014; margin-bottom: 10px; }
      .fee-row { display: flex; justify-content: space-between; font-size: 12px; padding: 3px 0; }
      .fee-row.total { border-top: 2px solid #750014; margin-top: 6px; padding-top: 8px; font-weight: bold; font-size: 14px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th { background: #080c42; color: white; padding: 8px 10px; text-align: left; font-size: 11px; text-transform: uppercase; }
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
      <div class="school-name">Cebu Sacred Heart College, Inc.</div>
      <div class="soa-title">Statement of Account</div>
      <div style="font-size:12px;color:#555">School Year ${schoolYear} · ${campusName}</div>
    </div>

    <div class="info-grid">
      <div class="info-row"><span class="info-label">Student Name:</span><span class="info-value">${p.studentName}</span></div>
      <div class="info-row"><span class="info-label">Reference #:</span><span class="info-value" style="color:#750014">${p.studentId}</span></div>
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
      <div class="fee-row total"><span>Grand Total</span><span style="color:#750014">${php(p.totalFee)}</span></div>
    </div>

    <h3 style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#080c42;margin-bottom:10px">Payment History</h3>
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
        'Running Balance':Math.max(0,runBal),
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"/>
            <input value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="Search name or ref #..."
              className="w-full pl-8 pr-3 py-2 text-xs border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:border-primary transition"/>
          </div>
        </div>
        <div className="divide-y divide-[var(--color-border)] max-h-[500px] overflow-y-auto">
          {filtered.map((p,i) => (
            <button key={i} onClick={()=>setSelected(p)}
              className={`w-full text-left px-4 py-3 transition flex items-start gap-3 ${selectedStudent?.studentId===p.studentId
                ? 'bg-primary/5 dark:bg-primary/10 border-l-2 border-primary'
                : 'hover:bg-[var(--color-bg-subtle)]/30'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white
                ${p.balance<=0 ? 'bg-green-500' : 'bg-amber-500'}`}>
                {p.studentName.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-xs font-semibold truncate ${selectedStudent?.studentId===p.studentId ? 'text-primary dark:text-red-400' : 'text-[var(--color-text-primary)]'}`}>
                  {p.studentName}
                </p>
                <p className="text-[10px] text-gray-400 truncate">{p.gradeLevel}</p>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-[10px] font-mono text-gray-400">{p.studentId}</span>
                  <span className={`text-[10px] font-bold font-mono ${p.balance<=0 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    {p.balance<=0 ? 'PAID' : `Bal: ${php(p.balance)}`}
                  </span>
                </div>
              </div>
            </button>
          ))}
          {filtered.length===0 && (
            <div className="py-8 text-center text-gray-400 text-sm">No students found</div>
          )}
        </div>
      </div>

      {/* SOA Preview */}
      <div className="lg:col-span-2">
        {!selectedStudent ? (
          <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm h-full flex items-center justify-center py-20">
            <div className="text-center text-gray-400">
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
              <div className="bg-gradient-to-r from-primary to-accent-burgundy px-6 py-5 text-white">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[3px] opacity-70 mb-1">Statement of Account</p>
                    <h2 className="text-lg font-bold">{p.studentName}</h2>
                    <p className="text-xs opacity-80 mt-1">{p.gradeLevel} {p.semester ? `· ${p.semester}` : ''}</p>
                    <p className="text-xs opacity-70 font-mono mt-0.5">{p.studentId}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold
                      ${p.balance<=0 ? 'bg-green-500/20 text-green-200 border border-green-400/30' : 'bg-amber-500/20 text-amber-200 border border-amber-400/30'}`}>
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
                  <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                    <h3 className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide mb-3">Fee Assessment</h3>
                    <div className="space-y-1.5 text-xs">
                      {[
                        ['Original Tuition', fb.originalTuition],
                        fb.totalDiscount > 0 && ['Discount Applied', -fb.totalDiscount, 'text-red-500'],
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
                      <div className="flex justify-between font-bold text-sm pt-2 border-t border-amber-200 dark:border-amber-700">
                        <span className="text-[var(--color-text-primary)]">Grand Total</span>
                        <span className="font-mono text-primary dark:text-red-400">{php(p.totalFee)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Payment history */}
                <div>
                  <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">Payment History</h3>
                  {hist.length===0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">No payments recorded yet</p>
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
                                <td className="px-3 py-2.5 text-xs font-mono text-primary dark:text-red-400">{h.orNumber||'—'}</td>
                                <td className="px-3 py-2.5 text-xs text-[var(--color-text-muted)]">
                                  {h.date ? new Date(h.date).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'}) : '—'}
                                </td>
                                <td className="px-3 py-2.5 text-xs text-[var(--color-text-muted)]">{h.method||'—'}</td>
                                <td className="px-3 py-2.5">
                                  <div className="flex flex-wrap gap-0.5">
                                    {(h.paymentFor||['tuition']).map(k=>(
                                      <span key={k} className="text-[9px] px-1 py-0.5 bg-secondary/10 dark:bg-secondary/30 text-secondary dark:text-blue-300 rounded font-medium">{FEE_LABELS[k]||k}</span>
                                    ))}
                                  </div>
                                </td>
                                <td className="px-3 py-2.5 text-xs font-bold text-green-600 dark:text-green-400 text-right font-mono">{php(h.amount)}</td>
                                <td className={`px-3 py-2.5 text-xs font-bold text-right font-mono ${bal<=0 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>{php(bal)}</td>
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
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700'
                  : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700'}`}>
                  <div>
                    <p className={`text-xs font-semibold uppercase tracking-wide ${p.balance<=0 ? 'text-green-700 dark:text-green-300' : 'text-amber-700 dark:text-amber-300'}`}>
                      {p.balance<=0 ? '✓ Account Fully Settled' : 'Remaining Balance'}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">Total paid: {php(p.amountPaid)}</p>
                  </div>
                  <span className={`text-2xl font-bold font-mono ${p.balance<=0 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    {php(p.balance)}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-1">
                  <button onClick={handlePrint}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm bg-primary text-white rounded-xl hover:bg-accent-burgundy transition font-semibold shadow-sm">
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


export default function Payments() {
  const { user } = useAuth()
  const { activeCampuses, currentSchoolYear, campusProgramsMap } = useAppConfig()

  const isAccountingLocked = user?.role === 'accounting' && user?.campus !== 'all'
  const accountingCampus   = isAccountingLocked ? user.campus : null

  const cashierName = (() => {
    try {
      const campusKey = user?.campus?.replace(/ (City |)Campus$/i, '').replace(/[^a-zA-Z]/g, '') || 'all'
      const campusCfg = JSON.parse(localStorage.getItem(`cshc_campus_cfg_${campusKey}`) || '{}')
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
  const { campusFilter } = useCampusFilter()
  const [loading, setLoading]                       = useState(true)
  const { toasts, addToast, removeToast }           = useToast()

  const baseCampusFilter = isAccountingLocked
    ? accountingCampus
    : (campusFilter !== 'all' ? activeCampuses.find(c => c.key === campusFilter)?.name : null)

  useEffect(() => {
    const load = () => {
      try {
        const subs = JSON.parse(localStorage.getItem('cshc_submissions') || '[]')
        const paid = subs.filter(s =>
          (s.status === 'payment_received' || s.status === 'approved') &&
          (s.amountPaid > 0 || s.paymentHistory?.length > 0) &&
          (!baseCampusFilter || s.enrollment?.campus === baseCampusFilter)
        ).map(s => ({
          studentId:      s.referenceNumber,
          studentName:    s.student?.fullName ||
            `${(s.student?.lastName||'').toUpperCase()}, ${(s.student?.firstName||'').toUpperCase()}`,
          gradeLevel:     s.enrollment?.gradeLevel  || '',
          campus:         s.enrollment?.campus      || '',
          semester:       s.enrollment?.semester    || '',
          studentType:    s.enrollment?.studentType || '',
          schoolYear:     s.enrollment?.schoolYear  || '',
          totalFee:       s.totalFee    || 0,
          amountPaid:     s.amountPaid  || 0,
          balance:        s.balance     || 0,
          status:         s.balance <= 0 ? 'paid' : 'partial',
          paymentMethod:  s.paymentMethod || '',
          paymentHistory: s.paymentHistory || (s.amountPaid > 0 ? [{
            id: 1, amount: s.amountPaid, method: s.paymentMethod,
            date: s.lastPaymentDate || s.updatedAt || s.submittedDate,
            orNumber: '', notes: '', paymentFor: ['tuition'],
          }] : []),
          feeBreakdown:     s.feeBreakdown     || null,
          discountsApplied: s.discountsApplied || [],
          lastPaymentDate:  s.lastPaymentDate  || s.updatedAt,
          submittedDate:    s.submittedDate,
        }))
        if (paid.length > 0) setPayments(paid)
      } catch {}
      const t = setTimeout(() => setLoading(false), 500)
      return () => clearTimeout(t)
    }
    load()
    const handleStorage = (e) => {
      if (e.key === 'cshc_submissions' || e.key === null) load()
    }
    window.addEventListener('cshc_enrollment_updated', load)
    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener('cshc_enrollment_updated', load)
      window.removeEventListener('storage', handleStorage)
    }
  }, [baseCampusFilter])
  useEffect(() => {
    setLoading(true); setGradeLevelFilter('all')
    const t = setTimeout(() => setLoading(false), 400)
    return () => clearTimeout(t)
  }, [campusFilter])

  if (loading) return <PageSkeleton title="Payments" />

  const handleRecordPayment = (payment) => {
    setSelectedPayment(payment)
    setShowRecordModal(true)
  }

  const handleSavePayment = (transaction) => {
    const newEntry = {
      id:         Date.now(),
      amount:     transaction.amount,
      method:     transaction.method,
      date:       transaction.date,
      orNumber:   transaction.orNumber,
      notes:      transaction.notes,
      paymentFor: transaction.paymentFor || ['tuition'],
    }

    try {
      const subs = JSON.parse(localStorage.getItem('cshc_submissions') || '[]')
      const idx  = subs.findIndex(s => s.referenceNumber === selectedPayment.studentId)
      if (idx !== -1) {
        const sub            = subs[idx]
        const newAmountPaid  = (sub.amountPaid || 0) + transaction.amount
        const newBalance     = Math.max(0, (sub.totalFee || 0) - newAmountPaid)
        subs[idx] = {
          ...sub,
          amountPaid:      newAmountPaid,
          balance:         newBalance,
          status:          newBalance <= 0 ? 'approved' : 'payment_received',
          paymentMethod:   transaction.method,
          lastPaymentDate: transaction.date,
          paymentHistory:  [...(sub.paymentHistory || []), newEntry],
        }
        localStorage.setItem('cshc_submissions', JSON.stringify(subs))
        localStorage.setItem('cshc_status_update', JSON.stringify({ ts: Date.now() }))
        window.dispatchEvent(new Event('cshc_enrollment_updated'))
      }
    } catch (e) {
      console.error('Failed to persist payment to localStorage:', e)
    }

    setPayments(prev => prev.map(p => {
      if (p.studentId !== selectedPayment.studentId) return p
      const newAmountPaid = p.amountPaid + transaction.amount
      const newBalance    = p.totalFee - newAmountPaid
      const newStatus     = newBalance <= 0 ? 'paid' : 'partial'
      return {
        ...p,
        amountPaid:      newAmountPaid,
        balance:         Math.max(0, newBalance),
        status:          newStatus,
        paymentMethod:   transaction.method,
        lastPaymentDate: transaction.date,
        paymentHistory:  [...(p.paymentHistory || []), newEntry],
      }
    }))
    setSelectedPayment(prev => ({
      ...prev,
      amountPaid: prev.amountPaid + transaction.amount,
      balance:    Math.max(0, prev.totalFee - prev.amountPaid - transaction.amount),
    }))
    setPendingTransaction(transaction)
    setShowRecordModal(false)
    setShowReceiptModal(true)
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
    options: group.options.map(g => ({ value: g, label: g })),
  }))
  // One group per program, options are year levels
  const mainCollegeGroups = mainCollegePrograms.map(prog => ({
    label: prog,
    options: COLLEGE_YEAR_LEVELS.map(yr => ({ value: `${prog} - ${yr}`, label: yr })),
  }))

  const handleMainDeptChange = (dept) => { setDeptFilter(dept); setYearFilter('all'); setGradeLevelFilter('all') }

  const filtered = payments.filter(p =>
    (p.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
     p.studentId.toLowerCase().includes(searchQuery.toLowerCase())) &&
    (deptFilter === 'all' ||
      (deptFilter === 'basic'   && isBasicEd(p.gradeLevel)) ||
      (deptFilter === 'college' && isCollege(p.gradeLevel))
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
    overdue:     filtered.filter(p => p.status === 'overdue').length,
  }
  const collectionRate = stats.totalFee > 0 ? Math.round((stats.revenue / stats.totalFee) * 100) : 0

  const handleExport = () => {
    const data = filtered.map(p => ({
      'Student ID': p.studentId, 'Student Name': p.studentName,
      'Department': isCollege(p.gradeLevel) ? 'College' : 'Basic Ed',
      'Campus': p.campus, 'Grade / Program': p.gradeLevel,
      'Total Fee': p.totalFee, 'Amount Paid': p.amountPaid, 'Balance': p.balance,
      'Status': p.status.toUpperCase(), 'Payment Method': p.paymentMethod || '—',
      'Last Payment': p.lastPaymentDate ? new Date(p.lastPaymentDate).toLocaleDateString() : '—',
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

      <CampusBanner user={user} />

      {/* Tab navigation */}
      <div className="flex gap-1 bg-[var(--color-bg-subtle)] p-1 rounded-xl border border-[var(--color-border)] overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition whitespace-nowrap flex-1 justify-center
              ${activeTab === tab.id
                ? 'bg-[var(--color-bg-subtle)] text-primary dark:text-red-400 shadow-sm'
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
              { label:'Total Revenue',    value:php(stats.revenue),     border:'border-green-500', icon:<TrendingUp className="w-5 h-5 text-green-500"/>, sub:'Collected payments',   cls:'text-green-600 dark:text-green-400' },
              { label:'Outstanding',      value:php(stats.outstanding), border:'border-amber-400', icon:<Clock className="w-5 h-5 text-amber-400"/>,      sub:'Pending collection',   cls:'text-amber-500 dark:text-amber-400' },
              { label:'Fully Paid',       value:stats.paid,             border:'border-blue-500',  icon:<CheckCircle className="w-5 h-5 text-blue-500"/>, sub:'Students',             cls:'text-blue-600 dark:text-blue-400' },
              { label:'Overdue',          value:stats.overdue,          border:'border-red-400',   icon:<AlertCircle className="w-5 h-5 text-red-400"/>,  sub:'Requires follow-up',   cls:stats.overdue > 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-400' },
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
                    { value: 'pending', label: 'Pending' },
                  ]}
                />
              </div>
              {/* Search — grows to fill remaining space */}
              <div className="relative flex-1 min-w-[160px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" placeholder="Search student name or ID…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-primary outline-none transition" />
              </div>
              {/* Export */}
              <ExportButton onClick={handleExport} />
            </div>
          </div>

          {/* Payment list */}
          <div className="bg-[var(--color-bg-card)] rounded-xl shadow-sm overflow-hidden">
            {filtered.length === 0 ? <EmptyState type="search" /> : (
              <>
                {/* Mobile cards */}
                <ul className="md:hidden divide-y divide-[var(--color-border)]">
                  {filtered.map(p => (
                    <li key={p.studentId}>
                      <button onClick={() => { setSelectedPayment(p); setShowModal(true) }}
                        className="w-full text-left px-4 py-4 hover:bg-[var(--color-bg-subtle)]/50 transition flex items-start gap-3">
                        <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Receipt className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-0.5">
                            <span className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{p.studentName}</span>
                            <StatusBadge status={p.status} />
                          </div>
                          <p className="text-xs font-mono text-primary dark:text-red-400">{p.studentId}</p>
                          <div className="flex items-center justify-between mt-1">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold
                                ${isBasicEd(p.gradeLevel)
                                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                }`}>
                                {isBasicEd(p.gradeLevel) ? 'Basic Ed' : 'College'}
                              </span>
                              <span className="text-xs text-[var(--color-text-muted)]">{p.gradeLevel}</span>
                            </div>
                            <span className="text-sm font-bold text-green-600 dark:text-green-400">{php(p.amountPaid)}</span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
                      </button>
                    </li>
                  ))}
                </ul>

                {/* Desktop table */}
                <div className="hidden md:block min-w-0">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[860px]">
                      <thead className="bg-[var(--color-bg-subtle)]">
                        <tr>
                          {['Student','Dept',!isAccountingLocked?'Campus':null,'Grade / Program','Total Fee','Paid','Balance','Status','Last Payment','Actions'].filter(Boolean).map(h => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border)]">
                        {filtered.map(p => {
                          const isBasic = isBasicEd(p.gradeLevel)
                          return (
                          <tr key={p.studentId} className="hover:bg-[var(--color-bg-subtle)]/50 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <p className="text-sm font-medium text-[var(--color-text-primary)]">{p.studentName}</p>
                              <p className="text-xs font-mono text-primary dark:text-red-400">{p.studentId}</p>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold
                                ${isBasic
                                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                }`}>
                                {isBasic ? 'Basic Ed' : 'College'}
                              </span>
                            </td>
                            {!isAccountingLocked && <td className="px-4 py-3 text-sm text-[var(--color-text-secondary)] whitespace-nowrap">{p.campus}</td>}
                            <td className="px-4 py-3 text-sm text-[var(--color-text-secondary)] whitespace-nowrap">{p.gradeLevel}</td>
                            <td className="px-4 py-3 text-sm text-[var(--color-text-primary)] whitespace-nowrap font-medium">{php(p.totalFee)}</td>
                            <td className="px-4 py-3 text-sm text-green-600 dark:text-green-400 whitespace-nowrap font-semibold">{php(p.amountPaid)}</td>
                            <td className="px-4 py-3 text-sm whitespace-nowrap font-semibold">
                              <span className={p.balance > 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-400'}>{p.balance > 0 ? php(p.balance) : '—'}</span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={p.status} /></td>
                            <td className="px-4 py-3 text-xs text-[var(--color-text-muted)] whitespace-nowrap">
                              {p.lastPaymentDate ? new Date(p.lastPaymentDate).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <button onClick={() => { setSelectedPayment(p); setShowModal(true) }}
                                  className="inline-flex items-center gap-1 text-sm text-primary dark:text-red-400 hover:text-[#4a0009] font-medium transition">
                                  <Eye className="w-4 h-4" /> View
                                </button>
                                {p.status !== 'paid' && (
                                  <button onClick={() => handleRecordPayment(p)}
                                    className="inline-flex items-center gap-1 text-xs text-white bg-green-600 hover:bg-green-700 px-2.5 py-1 rounded-lg font-medium transition">
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
                <div className="px-4 py-3 border-t border-[var(--color-border)] text-xs text-gray-400 flex items-center gap-2 flex-wrap">
                  Showing {filtered.length} of {payments.length} records
                  {yearFilter !== 'all' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary dark:text-red-300 rounded-full font-medium">
                      {yearFilter}
                      <button onClick={() => setYearFilter('all')} className="hover:text-red-600 transition">×</button>
                    </span>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Payment detail modal */}
          {showModal && selectedPayment && (
            <ModalPortal>
            <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-[9999] p-0 sm:p-4">
              <div className="bg-[var(--color-bg-card)] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[92vh] flex flex-col">
                <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)] flex-shrink-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <Receipt className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-base font-bold text-[var(--color-text-primary)] truncate">{selectedPayment.studentName}</h2>
                      <p className="text-xs font-mono text-primary dark:text-red-400">{selectedPayment.studentId}</p>
                    </div>
                  </div>
                  <button onClick={() => setShowModal(false)}
                    className="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] rounded-lg hover:bg-[var(--color-bg-subtle)] transition">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="overflow-y-auto flex-1 p-5 space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={selectedPayment.status} />
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold
                      ${isBasicEd(selectedPayment.gradeLevel)
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                        : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      }`}>
                      {isBasicEd(selectedPayment.gradeLevel) ? 'Basic Ed' : 'College'}
                    </span>
                    <span className="text-xs text-[var(--color-text-muted)]">{selectedPayment.campus} · {selectedPayment.gradeLevel}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Total Fee',    value: php(selectedPayment.totalFee),    cls: 'text-[var(--color-text-primary)]'        },
                      { label: 'Amount Paid',  value: php(selectedPayment.amountPaid),  cls: 'text-green-600 dark:text-green-400'   },
                      { label: 'Balance',      value: php(selectedPayment.balance),     cls: selectedPayment.balance > 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-400' },
                    ].map(({ label, value, cls }) => (
                      <div key={label} className="bg-[var(--color-bg-subtle)] rounded-xl p-3 text-center">
                        <p className="text-xs text-gray-400 mb-1">{label}</p>
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
                        <div className="bg-green-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${(selectedPayment.amountPaid / selectedPayment.totalFee) * 100}%` }} />
                      </div>
                    </div>
                  )}

                  <div className="bg-[var(--color-bg-subtle)] rounded-xl p-4">
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
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
                          <p className="font-medium text-[var(--color-text-primary)]">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {selectedPayment.paymentHistory.length > 0 && (
                    <div className="bg-[var(--color-bg-subtle)] rounded-xl p-4">
                      <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
                        <Receipt className="w-4 h-4" /> Payment History
                      </h3>
                      <div className="space-y-2">
                        {selectedPayment.paymentHistory.map(h => (
                          <div key={h.id} className="flex items-center justify-between py-2 border-b border-[var(--color-border)] last:border-0">
                            <div>
                              <p className="text-xs font-mono text-primary dark:text-red-400">{h.orNumber}</p>
                              <p className="text-xs text-[var(--color-text-muted)]">{h.method} · {new Date(h.date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</p>
                              {h.notes && <p className="text-xs text-gray-400 italic mt-0.5">{h.notes}</p>}
                            </div>
                            <p className="text-sm font-bold text-green-600 dark:text-green-400">{php(h.amount)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="px-5 py-4 border-t border-[var(--color-border)] bg-[var(--color-bg-subtle)] flex justify-between items-center gap-3 flex-shrink-0">
                  <button onClick={() => setShowModal(false)}
                    className="px-4 py-2.5 text-sm text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-xl hover:bg-[var(--color-bg-subtle)] transition font-medium">
                    Close
                  </button>
                  {(user?.role === 'accounting' || (user?.role === 'admin' || user?.role === 'technical_admin')) && selectedPayment.status !== 'paid' && (
                    <button onClick={() => { setShowModal(false); handleRecordPayment(selectedPayment) }}
                      className="flex items-center gap-2 px-5 py-2.5 text-sm bg-green-600 text-white rounded-xl hover:bg-green-700 transition font-semibold shadow-sm">
                      <Plus className="w-4 h-4" /> Record Payment
                    </button>
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

      {/* Receipt Preview Modal */}
      {showReceiptModal && selectedPayment && pendingTransaction && (
        <ReceiptPreview
          payment={selectedPayment}
          newTransaction={pendingTransaction}
          schoolName="Cebu Sacred Heart College, Inc."
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