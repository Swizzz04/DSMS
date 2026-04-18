import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Search, FileText, CheckCircle, XCircle, Clock, Eye,
  Download, User, ChevronRight, GraduationCap, MapPin,
  BookOpen, X, Filter, Users, TrendingUp, ChevronDown, ChevronUp, Globe, DollarSign, CreditCard,
  Printer, Receipt, Percent, Tag, AlertCircle, Info, History, ArrowRight, Banknote, Phone, Mail,
  CalendarDays, BadgeCheck, CircleDollarSign, Wallet, ClipboardList
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { exportToExcel, exportMultipleSheets } from '../utils/exportToExcel'
import { useLocation } from 'react-router-dom'
import { useToast, ToastContainer, ConfirmDialog, PageSkeleton, EmptyState, ModalPortal } from '../components/UIComponents'
import { useAppConfig } from '../context/AppConfigContext'
import { getFeeBreakdown, computeStudentBill, computeCollegeFee, getLoadStatus, DEFAULT_DISCOUNTS, BASIC_ED_GROUPS, COLLEGE_YEAR_LEVELS } from '../config/appConfig'
import GradeLevelSelect from '../components/GradeLevelSelect'
import GroupedSelect from '../components/GroupedSelect'
import { useCampusFilter } from '../context/CampusFilterContext'
import {
  DeptEnrollmentCard as DeptCard,
  ProgramEnrollmentCard as ProgramCard,
  EnrollmentStatusPill as StatusPill,
  DEPT_STYLES, PROG_COLORS,
  CampusBanner,
} from '../components/SchoolComponents'

// ── helpers ────────────────────────────────────────────────────────
function isBasicEd(g) {
  return g && (g.includes('Grade') || ['Nursery','Kindergarten','Preparatory'].some(x => g.includes(x)))
}
function isCollege(g) {
  return g && (g.includes('BS') || g.includes('Year'))
}

const php = n => `₱${(n||0).toLocaleString('en-PH',{minimumFractionDigits:2})}`

function StatusBadge({ status }) {
  const map = {
    pending:          { cls: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: <Clock className="w-3 h-3"/>,        label: 'Awaiting Payment'  },
    payment_received: { cls: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',         icon: <DollarSign className="w-3 h-3"/>,    label: 'Payment Received'  },
    approved:         { cls: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',     icon: <CheckCircle className="w-3 h-3"/>,   label: 'Approved'          },
    rejected:         { cls: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',             icon: <XCircle className="w-3 h-3"/>,       label: 'Rejected'          },
  }
  const cfg = map[status] || map.pending
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>{cfg.icon}{cfg.label}</span>
}

// ── Admin Overview ─────────────────────────────────────────────────
function AdminEnrollmentOverview({ enrollments, campusFilter, activeCampuses, currentSchoolYear, addToast }) {
  const shownCampuses = campusFilter !== 'all'
    ? activeCampuses.filter(c => c.key === campusFilter)
    : activeCampuses

  const isSingleCampus = shownCampuses.length === 1
  const selectedCampus = isSingleCampus ? shownCampuses[0] : null

  const getCampusEnr = (campusName) =>
    enrollments.filter(e => e.enrollment.campus === campusName)

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
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)]">Enrollments</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Total Enrollments', value: grandTotal,    border: 'border-primary',    sub: isSingleCampus ? selectedCampus.name : 'All Campuses',          cls: 'text-gray-400' },
          { label: 'Pending Review',    value: grandPending,  border: 'border-yellow-500', sub: grandTotal > 0 ? `${Math.round(grandPending/grandTotal*100)}% needs action` : '—', cls: 'text-yellow-600 dark:text-yellow-400' },
          { label: 'Approved',          value: grandApproved, border: 'border-green-500',  sub: grandTotal > 0 ? `${Math.round(grandApproved/grandTotal*100)}% approval rate` : '—', cls: 'text-green-600 dark:text-green-400' },
          { label: 'Rejected',          value: grandRejected, border: 'border-red-400',    sub: grandTotal > 0 ? `${Math.round(grandRejected/grandTotal*100)}% rejection rate` : '—', cls: 'text-red-500 dark:text-red-400' },
        ].map(({ label, value, border, sub, cls }) => (
          <div key={label} className={`bg-[var(--color-bg-card)] rounded-xl p-4 border-l-4 ${border} shadow-sm`}>
            <p className="text-xs text-[var(--color-text-muted)] mb-1">{label}</p>
            <p className="text-2xl font-bold text-[var(--color-text-primary)]">{value}</p>
            <p className={`text-xs mt-1 font-medium ${cls}`}>{sub}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-4 text-xs text-[var(--color-text-muted)]">
        <span className="font-medium">Progress bar legend:</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> Payment Received</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> Approved</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-400 inline-block" /> Pending</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-400 inline-block" /> Rejected</span>
      </div>

      {shownCampuses.map(campus => {
        const campusEnr = getCampusEnr(campus.name)
        const basicEnr  = campusEnr.filter(e => isBasicEd(e.enrollment.gradeLevel))
        const collegeEnr = campusEnr.filter(e => isCollege(e.enrollment.gradeLevel))

        return (
          <div key={campus.key} className="space-y-4">
            {!isSingleCampus && (
              <div className="flex items-center gap-3 pt-2">
                <div className="flex-1 h-px bg-[var(--color-border)]" />
                <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-bg-subtle)] rounded-full">
                  <MapPin className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                  <span className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-secondary)]">
                    {campus.name}
                  </span>
                  <span className="text-xs text-[var(--color-text-muted)]">· {campusEnr.length} enrollments</span>
                </div>
                <div className="flex-1 h-px bg-[var(--color-border)]" />
              </div>
            )}

            {campus.hasBasicEd && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
                    <BookOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h2 className="text-sm font-bold text-[var(--color-text-primary)] uppercase tracking-wider">
                    Basic Education
                  </h2>
                  <span className="text-xs text-[var(--color-text-muted)]">· {basicEnr.length} total enrollments</span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {BASIC_ED_GROUPS.map(group => (
                    <DeptCard key={group.label} group={group} enrollments={basicEnr} />
                  ))}
                </div>
              </div>
            )}

            {campus.hasCollege && campus.collegePrograms?.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-primary/10 dark:bg-primary/20 rounded-lg flex items-center justify-center">
                    <GraduationCap className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <h2 className="text-sm font-bold text-[var(--color-text-primary)] uppercase tracking-wider">
                    College
                  </h2>
                  <span className="text-xs text-[var(--color-text-muted)]">
                    · {campus.collegePrograms.length} program{campus.collegePrograms.length !== 1 ? 's' : ''} · {collegeEnr.length} total enrollments
                  </span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {campus.collegePrograms.map((prog, idx) => (
                    <ProgramCard key={prog} program={prog} colorIdx={idx} enrollments={collegeEnr} />
                  ))}
                </div>
              </div>
            )}

            {!campus.hasCollege && (
              <div className="flex items-center gap-2 px-4 py-3 bg-[var(--color-bg-subtle)] rounded-xl text-sm text-[var(--color-text-muted)]">
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
// RECEIPT PRINT MODAL
// Shown after accounting records payment — prints two-copy receipt
// ════════════════════════════════════════════════════════════════════
function ReceiptModal({ enrollment, paymentData, cashierName, schoolYear, onClose }) {
  const receiptRef = useRef(null)
  const studentName = formatStudentName(enrollment.student, { short: true })
  const gradeLevel  = enrollment.enrollment.gradeLevel || ''
  const campus      = enrollment.enrollment.campus || ''
  const now         = new Date()
  const dateStr     = now.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
  const timeStr     = now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })
  const bill        = paymentData.feeBreakdown
  const totalFee    = paymentData.totalFee || 0
  const amtPaid     = paymentData.amountPaid || 0
  const balance     = paymentData.balance || 0

  const ReceiptCopy = ({ copyLabel }) => (
    <div className="receipt-copy border border-gray-300 rounded-lg p-5 bg-white text-gray-900" style={{ fontFamily: 'Georgia, serif', fontSize: '13px' }}>
      {/* Header */}
      <div className="text-center mb-3 pb-3 border-b-2 border-double border-gray-400">
        <p className="font-bold text-sm uppercase tracking-wide" style={{ color: '#750014' }}>Cebu Sacred Heart College, Inc.</p>
        <p className="text-xs text-gray-500">{campus}</p>
        <p className="text-xs text-gray-500">School Year {schoolYear}</p>
        <div className="mt-2 inline-block border border-gray-400 px-3 py-0.5 rounded text-xs font-bold uppercase tracking-wider text-gray-700">
          Official Receipt
        </div>
      </div>

      {/* OR + Date row */}
      <div className="flex justify-between text-xs mb-3">
        <div>
          <span className="text-gray-500">OR No.: </span>
          <span className="font-bold font-mono">{paymentData.orNumber}</span>
        </div>
        <div className="text-right">
          <div><span className="text-gray-500">Date: </span><span className="font-semibold">{dateStr}</span></div>
          <div><span className="text-gray-500">Time: </span><span className="font-semibold">{timeStr}</span></div>
        </div>
      </div>

      {/* Student info */}
      <div className="bg-[var(--color-bg-subtle)] rounded p-3 mb-3 text-xs space-y-1">
        <div className="flex gap-2"><span className="text-gray-500 w-20 flex-shrink-0">Student:</span><span className="font-bold">{studentName}</span></div>
        <div className="flex gap-2"><span className="text-gray-500 w-20 flex-shrink-0">Ref. No.:</span><span className="font-mono">{enrollment.referenceNumber}</span></div>
        <div className="flex gap-2"><span className="text-gray-500 w-20 flex-shrink-0">Program:</span><span>{gradeLevel}</span></div>
        <div className="flex gap-2"><span className="text-gray-500 w-20 flex-shrink-0">Type:</span><span>{enrollment.enrollment.studentType}</span></div>
      </div>

      {/* Fee breakdown */}
      <table className="w-full text-xs mb-3">
        <thead>
          <tr className="border-b border-gray-300">
            <th className="text-left py-1 text-gray-500 font-normal">Description</th>
            <th className="text-right py-1 text-gray-500 font-normal">Amount</th>
          </tr>
        </thead>
        <tbody>
          {bill && (
            <>
              <tr>
                <td className="py-1">Tuition Fee{bill.totalDiscount > 0 ? ' (after discount)' : ''}</td>
                <td className="py-1 text-right font-mono">{php(bill.tuitionAfterDiscount ?? bill.originalTuition ?? 0)}</td>
              </tr>
              {(bill.lab || 0) > 0 && (
                <tr><td className="py-1 text-gray-600">Lab Fee</td><td className="py-1 text-right font-mono">{php(bill.lab)}</td></tr>
              )}
              {(bill.misc || 0) > 0 && (
                <tr><td className="py-1 text-gray-600">Misc Fee</td><td className="py-1 text-right font-mono">{php(bill.misc)}</td></tr>
              )}
              {(bill.books || 0) > 0 && (
                <tr><td className="py-1 text-gray-600">Books</td><td className="py-1 text-right font-mono">{php(bill.books)}</td></tr>
              )}
              {(bill.other || 0) > 0 && (
                <tr><td className="py-1 text-gray-600">Other Fees</td><td className="py-1 text-right font-mono">{php(bill.other)}</td></tr>
              )}
              {bill.totalDiscount > 0 && (
                <tr className="text-green-700">
                  <td className="py-1 italic">Discount ({paymentData.discountsApplied?.map(d => d.name).join(', ')})</td>
                  <td className="py-1 text-right font-mono">-{php(bill.totalDiscount)}</td>
                </tr>
              )}
            </>
          )}
          {!bill && (
            <tr>
              <td className="py-1">{paymentData.notes || 'School Fees'}</td>
              <td className="py-1 text-right font-mono">{php(amtPaid)}</td>
            </tr>
          )}
          <tr>
            <td className="py-1 text-gray-500">Payment Method</td>
            <td className="py-1 text-right">{paymentData.paymentMethod}</td>
          </tr>
          {paymentData.notes && (
            <tr>
              <td className="py-1 text-gray-500">Notes</td>
              <td className="py-1 text-right text-gray-600">{paymentData.notes}</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Totals */}
      <div className="border-t border-gray-300 pt-2 mb-3 space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-500">Total Assessment:</span>
          <span className="font-mono">{php(totalFee)}</span>
        </div>
        <div className="flex justify-between font-bold text-sm border-t border-gray-300 pt-1 mt-1">
          <span style={{ color: '#750014' }}>Amount Received:</span>
          <span className="font-mono" style={{ color: '#750014' }}>{php(amtPaid)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Remaining Balance:</span>
          <span className={`font-mono font-semibold ${balance > 0 ? 'text-red-600' : 'text-green-700'}`}>
            {balance > 0 ? php(balance) : '₱0.00 — Fully Paid ✓'}
          </span>
        </div>
      </div>

      {/* Footer / Signatures */}
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
    const w = window.open('', '_blank', 'width=780,height=900')
    w.document.write(`<!DOCTYPE html><html><head><title>Receipt — ${studentName}</title>
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
  }

  return (
    <ModalPortal>
      <div className="modal-backdrop">
        <div className="bg-[var(--color-bg-card)] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[95vh] flex flex-col shadow-[var(--shadow-modal)]">
          {/* Header */}
          <div className="modal-header">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <Receipt className="w-5 h-5 text-green-600 dark:text-green-400"/>
              </div>
              <div>
                <h2 className="text-sm font-bold text-[var(--color-text-primary)]">Payment Receipt</h2>
                <p className="text-xs text-[var(--color-text-muted)]">{studentName} · OR# {paymentData.orNumber}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] rounded-lg hover:bg-[var(--color-bg-subtle)] transition">
              <X className="w-5 h-5"/>
            </button>
          </div>

          {/* Success banner */}
          <div className="mx-5 mt-4 flex items-center gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl px-4 py-3">
            <BadgeCheck className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0"/>
            <div>
              <p className="text-sm font-semibold text-green-800 dark:text-green-200">Payment recorded successfully!</p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                {php(amtPaid)} received · Balance: {balance > 0 ? php(balance) : 'Fully paid ✓'} · Registrar notified
              </p>
            </div>
          </div>

          {/* Preview (two copies side by side on screen) */}
          <div className="overflow-y-auto flex-1 p-5" ref={receiptRef}>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <ReceiptCopy copyLabel="School Copy" />
              </div>
              <div className="hidden sm:block w-px bg-dashed border-l-2 border-dashed border-[var(--color-border)]" />
              <div className="flex-1">
                <ReceiptCopy copyLabel="Student Copy" />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="modal-footer">
            <button onClick={onClose}
              className="btn-cancel">
              Close
            </button>
            <button onClick={handlePrint}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm bg-primary text-white rounded-xl hover:bg-[#4a0009] transition font-semibold shadow-sm">
              <Printer className="w-4 h-4"/> Print Receipt (2 copies)
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}

// ════════════════════════════════════════════════════════════════════
// ACCOUNTING DETAIL DRAWER
// Slide-in panel for accounting to see full student info + payment
// history + fee breakdown for a payment_received enrollment
// ════════════════════════════════════════════════════════════════════
function AccountingDetailDrawer({ enrollment, onClose, onPrintReceipt, cashierName, schoolYear }) {
  if (!enrollment) return null
  const e = enrollment
  const name = formatStudentName(e.student, { short: true })
  const hasFee = !!e.feeBreakdown
  const hasHistory = e.paymentHistory?.length > 0
  const fmtDate = (d) => new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <ModalPortal>
      <div className="modal-backdrop">
        <div className="bg-[var(--color-bg-card)] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-xl max-h-[92vh] flex flex-col shadow-[var(--shadow-modal)]">
          {/* Header */}
          <div className="modal-header">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-primary"/>
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-[var(--color-text-primary)] truncate">{name}</h2>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono text-primary dark:text-red-400">{e.referenceNumber}</span>
                  <StatusBadge status={e.status}/>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] rounded-lg hover:bg-[var(--color-bg-subtle)] transition flex-shrink-0">
              <X className="w-5 h-5"/>
            </button>
          </div>

          <div className="overflow-y-auto flex-1 p-5 space-y-4">

            {/* Enrollment Info */}
            <div className="bg-[var(--color-bg-subtle)] rounded-xl p-4 space-y-2">
              <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide flex items-center gap-1.5 mb-3">
                <GraduationCap className="w-3.5 h-3.5"/> Enrollment Details
              </h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {[
                  ['Grade / Program', e.enrollment.gradeLevel],
                  ['Campus', e.enrollment.campus],
                  ['Student Type', e.enrollment.studentType],
                  ['School Year', e.enrollment.schoolYear],
                  ...(e.enrollment.semester ? [['Semester', e.enrollment.semester]] : []),
                ].map(([label, val]) => (
                  <div key={label}>
                    <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
                    <p className="font-medium text-[var(--color-text-primary)]">{val || '—'}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Student Contact Info */}
            <div className="bg-[var(--color-bg-subtle)] rounded-xl p-4">
              <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide flex items-center gap-1.5 mb-3">
                <User className="w-3.5 h-3.5"/> Student Info
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0"/>
                  <span className="font-semibold text-[var(--color-text-primary)]">{formatStudentName(e.student)}</span>
                </div>
                {e.student.contactNumber && (
                  <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                    <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0"/>
                    <span>{e.student.contactNumber}</span>
                  </div>
                )}
                {e.student.email && (
                  <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                    <Mail className="w-3.5 h-3.5 text-gray-400 flex-shrink-0"/>
                    <span className="truncate">{e.student.email}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-[var(--color-text-muted)] text-xs">
                  <CalendarDays className="w-3.5 h-3.5 flex-shrink-0"/>
                  <span>Submitted {fmtDate(e.submittedDate)}</span>
                </div>
              </div>
            </div>

            {/* Fee Breakdown — only if assessment was done */}
            {hasFee && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-4">
                <h3 className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide flex items-center gap-1.5 mb-3">
                  <ClipboardList className="w-3.5 h-3.5"/> Fee Assessment
                </h3>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-[var(--color-text-primary)]">
                    <span>Original Tuition</span>
                    <span className="font-mono">{php(e.feeBreakdown.originalTuition || 0)}</span>
                  </div>
                  {(e.feeBreakdown.totalDiscount || 0) > 0 && (
                    <div className="flex justify-between text-green-600 dark:text-green-400">
                      <span>Discount applied</span>
                      <span className="font-mono">– {php(e.feeBreakdown.totalDiscount)}</span>
                    </div>
                  )}
                  {(e.feeBreakdown.lab || 0) > 0 && (
                    <div className="flex justify-between text-[var(--color-text-secondary)]">
                      <span>Lab Fee</span><span className="font-mono">{php(e.feeBreakdown.lab)}</span>
                    </div>
                  )}
                  {(e.feeBreakdown.misc || 0) > 0 && (
                    <div className="flex justify-between text-[var(--color-text-secondary)]">
                      <span>Misc Fee</span><span className="font-mono">{php(e.feeBreakdown.misc)}</span>
                    </div>
                  )}
                  {(e.feeBreakdown.books || 0) > 0 && (
                    <div className="flex justify-between text-[var(--color-text-secondary)]">
                      <span>Books</span><span className="font-mono">{php(e.feeBreakdown.books)}</span>
                    </div>
                  )}
                  {(e.feeBreakdown.enrollment || 0) > 0 && (
                    <div className="flex justify-between text-amber-600 dark:text-amber-400">
                      <span>Enrollment fee (min. payment)</span>
                      <span className="font-mono">{php(e.feeBreakdown.enrollment)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-[var(--color-text-primary)] border-t border-blue-200 dark:border-blue-700 pt-2 mt-1 text-sm">
                    <span>Grand Total</span>
                    <span className="font-mono text-primary dark:text-red-400">{php(e.feeBreakdown.grandTotal || e.totalFee || 0)}</span>
                  </div>
                </div>
                {/* Discounts applied tags */}
                {e.discountsApplied?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-blue-200 dark:border-blue-700">
                    {e.discountsApplied.map((d, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-[10px] font-medium">
                        <Tag className="w-2.5 h-2.5"/> {d.name} ({d.type === 'fixed' ? php(d.rate) : `${d.rate}%`})
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Payment Summary */}
            {(e.amountPaid > 0 || e.totalFee > 0) && (
              <div className="bg-[var(--color-bg-subtle)] rounded-xl p-4">
                <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide flex items-center gap-1.5 mb-3">
                  <Wallet className="w-3.5 h-3.5"/> Payment Summary
                </h3>
                <div className="space-y-2">
                  {/* Progress bar */}
                  {e.totalFee > 0 && (
                    <div>
                      <div className="flex justify-between text-xs text-[var(--color-text-muted)] mb-1">
                        <span>{php(e.amountPaid || 0)} paid</span>
                        <span>{Math.min(100, Math.round(((e.amountPaid || 0) / e.totalFee) * 100))}%</span>
                      </div>
                      <div className="h-2 bg-[var(--color-border)] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${(e.balance || 0) <= 0 ? 'bg-green-500' : 'bg-blue-500'}`}
                          style={{ width: `${Math.min(100, Math.round(((e.amountPaid || 0) / e.totalFee) * 100))}%` }}
                        />
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs mt-2">
                    <div className="bg-[var(--color-bg-subtle)] rounded-lg p-2">
                      <p className="text-gray-400">Total Fee</p>
                      <p className="font-semibold font-mono text-[var(--color-text-primary)] text-sm">{php(e.totalFee || 0)}</p>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2">
                      <p className="text-green-500">Paid</p>
                      <p className="font-semibold font-mono text-green-700 dark:text-green-300 text-sm">{php(e.amountPaid || 0)}</p>
                    </div>
                    <div className={`rounded-lg p-2 ${(e.balance || 0) > 0 ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-green-50 dark:bg-green-900/20'}`}>
                      <p className={(e.balance || 0) > 0 ? 'text-amber-500' : 'text-green-500'}>Balance</p>
                      <p className={`font-semibold font-mono text-sm ${(e.balance || 0) > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-green-700 dark:text-green-300'}`}>
                        {(e.balance || 0) > 0 ? php(e.balance) : 'Paid ✓'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Payment History */}
            {hasHistory && (
              <div>
                <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide flex items-center gap-1.5 mb-2">
                  <History className="w-3.5 h-3.5"/> Payment History
                </h3>
                <div className="space-y-2">
                  {e.paymentHistory.map((h, i) => (
                    <div key={i} className="flex items-start gap-3 bg-[var(--color-bg-subtle)] rounded-xl p-3">
                      <div className="w-7 h-7 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <CircleDollarSign className="w-3.5 h-3.5 text-green-600 dark:text-green-400"/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-[var(--color-text-primary)] font-mono">{php(h.amount)}</span>
                          <span className="text-xs text-[var(--color-text-muted)]">{h.method}</span>
                        </div>
                        {h.orNumber && (
                          <p className="text-xs text-primary dark:text-red-400 font-mono">OR# {h.orNumber}</p>
                        )}
                        {h.notes && (
                          <p className="text-xs text-[var(--color-text-muted)] truncate">{h.notes}</p>
                        )}
                        <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                          {h.date ? new Date(h.date).toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Status note if still pending */}
            {e.status === 'payment_received' && (
              <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl px-4 py-3 text-xs text-blue-700 dark:text-blue-300">
                <ArrowRight className="w-3.5 h-3.5 flex-shrink-0"/>
                Payment recorded. This enrollment is now with the Registrar for approval.
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="modal-footer">
            <button onClick={onClose}
              className="btn-cancel">
              Close
            </button>
            {e.status === 'payment_received' && e.paymentHistory?.length > 0 && (
              <button
                onClick={() => onPrintReceipt(e)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm bg-primary text-white rounded-xl hover:bg-[#4a0009] transition font-semibold shadow-sm">
                <Printer className="w-4 h-4"/> Print Receipt
              </button>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}

// ════════════════════════════════════════════════════════════════════
// FEE ASSESSMENT MODAL
// Opened by accounting when marking an enrollment as paid.
// ════════════════════════════════════════════════════════════════════
function FeeAssessmentModal({ enrollment, campusDiscounts, feeStructure, onConfirm, onClose }) {
  const e    = enrollment
  const name = formatStudentName(e.student, {short: true})
  const gradeLevel   = e.enrollment.gradeLevel  || ''
  const campusName   = e.enrollment.campus       || ''
  const studentType  = e.enrollment.studentType  || 'New'
  const isCollege    = !['nursery','kindergarten','preparatory','grade','senior','junior'].some(k =>
    gradeLevel.toLowerCase().startsWith(k)
  ) && gradeLevel !== ''
  const isTransferee = studentType.toLowerCase().includes('transfer')

  const gradeParts  = gradeLevel.split(' - ')
  const programName = gradeParts[0]
  const yearLevel   = gradeParts[1] || ''

  const semesterRaw = e.enrollment.semester || ''
  const semKey = semesterRaw.toLowerCase().includes('2nd') ? '2nd'
    : semesterRaw.toLowerCase().includes('summer') ? 'summer'
    : '1st'

  const feeEntry = feeStructure?.find(f => {
    if (!f.program) {
      return (f.gradeLevel === gradeLevel || f.gradeLevel === programName) &&
             (f.campus === 'all' || f.campus === campusName)
    }
    const programMatch  = f.program   === programName
    const campusMatch   = f.campus    === campusName
    const yearMatch     = !yearLevel  || f.yearLevel === yearLevel
    const semMatch      = !f.semester || f.semester  === semKey
    return programMatch && campusMatch && yearMatch && semMatch
  }) || null

  const [actualUnits,    setActualUnits]    = useState(feeEntry?.typicalUnits    || 0)
  const [actualLabUnits, setActualLabUnits] = useState(feeEntry?.typicalLabUnits || 0)
  const [selectedDiscounts, setSelectedDiscounts] = useState([])
  const toggleDiscount = (d) => {
    setSelectedDiscounts(prev =>
      prev.some(x => x.id === d.id) ? prev.filter(x => x.id !== d.id) : [...prev, d]
    )
  }

  const [amountPaid, setAmountPaid] = useState('')
  const [payMethod,  setPayMethod]  = useState('Cash')
  const [orNumber,   setOrNumber]   = useState(`OR-${new Date().getFullYear().toString().slice(-2)}${String(new Date().getMonth()+1).padStart(2,'0')}-${Math.floor(Math.random()*9000+1000)}`)
  const [notes,      setNotes]      = useState('')
  const [errors,     setErrors]     = useState({})

  // ── Bill computation ──────────────────────────────────────────
  const bill = (() => {
    if (!feeEntry) return null
    const discountInputs = selectedDiscounts.map(d => ({
      name: d.name, rate: d.defaultRate, type: d.type || 'percentage'
    }))

    if (isCollege && feeEntry.tuitionRatePerUnit != null) {
      const computed = computeCollegeFee(feeEntry, actualUnits, actualLabUnits, studentType)
      let remaining = computed.tuition
      const discBreakdown = []
      for (const d of discountInputs) {
        if (!d.rate || d.rate <= 0) continue
        const isFixed   = d.type === 'fixed'
        const deduction = isFixed ? Math.min(d.rate, remaining) : remaining * (d.rate / 100)
        discBreakdown.push({ name: d.name, type: d.type, rate: d.rate, deduction })
        remaining -= deduction
      }
      const tuitionAfterDiscount = Math.max(0, remaining)
      const totalDiscount = computed.tuition - tuitionAfterDiscount
      const grandTotal = tuitionAfterDiscount + computed.lab + computed.misc
      return {
        originalTuition: computed.tuition,
        tuitionAfterDiscount,
        totalDiscount,
        lab:           computed.lab,
        enrollment:    computed.enrollment,
        misc:          computed.misc,
        books:         0,
        other:         0,
        grandTotal,
        discountBreakdown: discBreakdown,
        units:         actualUnits,
        labUnits:      actualLabUnits,
        loadStatus:    getLoadStatus(actualUnits, feeEntry.typicalUnits),
      }
    } else {
      const breakdown = {
        tuition:    feeEntry.tuition    || 0,
        enrollment: feeEntry.enrollment || 0,
        misc:       feeEntry.misc       || 0,
        lab:        feeEntry.lab        || 0,
        books:      feeEntry.books      || 0,
        other:      feeEntry.other      || 0,
        total: 0,
      }
      const b = computeStudentBill(breakdown, discountInputs)
      b.grandTotal = b.tuitionAfterDiscount + breakdown.misc + breakdown.lab + breakdown.books + breakdown.other
      return b
    }
  })()

  const balance    = bill ? bill.grandTotal - (parseFloat(amountPaid)||0) : 0
  const minPayment = bill?.enrollment || 1

  const validate = () => {
    const errs = {}
    const paid = parseFloat(amountPaid)
    if (!amountPaid || paid <= 0) errs.amount = 'Enter a valid amount'
    else if (bill && paid < minPayment - 0.01)
      errs.amount = `Minimum payment is ${php(minPayment)} (enrollment fee)`
    else if (bill && paid > bill.grandTotal + 0.01)
      errs.amount = `Cannot exceed grand total ${php(bill.grandTotal)}`
    if (!orNumber.trim()) errs.or = 'OR number is required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleConfirm = () => {
    if (!validate()) return
    onConfirm({
      feeBreakdown:      bill,
      totalFee:          bill?.grandTotal || 0,
      amountPaid:        parseFloat(amountPaid),
      balance:           Math.max(0, (bill?.grandTotal||0) - parseFloat(amountPaid)),
      paymentMethod:     payMethod,
      orNumber:          orNumber.trim(),
      notes:             notes.trim(),
      discountsApplied:  selectedDiscounts.map(d => ({ id: d.id, name: d.name, rate: d.defaultRate, type: d.type || 'percentage' })),
      paymentDate:       new Date().toISOString(),
    })
  }

  return (
    <ModalPortal>
    <div className="modal-backdrop">
      <div className="bg-[var(--color-bg-card)] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[95vh] flex flex-col shadow-[var(--shadow-modal)]">
        {/* Header */}
        <div className="modal-header">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
              <Receipt className="w-5 h-5 text-primary"/>
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-[var(--color-text-primary)] truncate">Fee Assessment & Payment</h2>
              <p className="text-xs text-[var(--color-text-muted)] truncate">
                {name} · {gradeLevel}
                {yearLevel && ` · ${yearLevel}`}
                {semesterRaw && ` · ${semesterRaw}`}
                · <span className="font-medium">{studentType}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] rounded-lg hover:bg-[var(--color-bg-subtle)] transition flex-shrink-0">
            <X className="w-5 h-5"/>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {/* No fee entry warning */}
          {!feeEntry && (
            <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5"/>
              <div className="text-xs text-amber-700 dark:text-amber-300">
                <p className="font-semibold">No fee entry found for:</p>
                <p className="mt-0.5">{gradeLevel} {yearLevel ? `· ${yearLevel}` : ''} {semesterRaw ? `· ${semesterRaw}` : ''} @ {campusName}</p>
                <p className="mt-1 text-amber-600 dark:text-amber-400">
                  Please configure the fee structure in <strong>Settings → Fee Structure</strong> for this program, year level, and semester.
                </p>
              </div>
            </div>
          )}

          {/* College unit inputs */}
          {isCollege && feeEntry?.tuitionRatePerUnit != null && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-3 flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5"/> Unit Load
                {isTransferee && <span className="ml-1 px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-[10px] font-medium">Transferee</span>}
                {bill?.loadStatus && bill.loadStatus !== 'Regular' && (
                  <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-medium
                    ${bill.loadStatus === 'Underload' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'}`}>
                    {bill.loadStatus}
                  </span>
                )}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-blue-600 dark:text-blue-400 mb-1">
                    Lecture Units <span className="text-gray-400">(typical: {feeEntry.typicalUnits})</span>
                  </label>
                  <input type="number" min="0" max="40" value={actualUnits}
                    onChange={e => setActualUnits(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-blue-200 dark:border-blue-700 rounded-lg bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-blue-400 transition text-center font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs text-blue-600 dark:text-blue-400 mb-1">
                    Lab Units <span className="text-gray-400">(typical: {feeEntry.typicalLabUnits})</span>
                  </label>
                  <input type="number" min="0" max="20" value={actualLabUnits}
                    onChange={e => setActualLabUnits(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-blue-200 dark:border-blue-700 rounded-lg bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-blue-400 transition text-center font-mono font-bold"
                  />
                </div>
              </div>
              <p className="text-[10px] text-blue-500 dark:text-blue-400 mt-2">
                Rate: {php(feeEntry.tuitionRatePerUnit)}/unit · Lab: {php(feeEntry.labRatePerUnit)}/unit
              </p>
            </div>
          )}

          {/* Fee breakdown */}
          {bill && (
            <div className="bg-[var(--color-bg-subtle)] rounded-xl p-4 space-y-2">
              <h3 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-3">Fee Breakdown</h3>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--color-text-secondary)]">
                  Tuition {isCollege ? `(${actualUnits} units × ${php(feeEntry?.tuitionRatePerUnit||0)})` : ''}
                </span>
                <span className="font-mono">{php(bill.originalTuition)}</span>
              </div>
              {bill.discountBreakdown?.map((d, i) => (
                <div key={i} className="flex justify-between text-xs text-red-500 dark:text-red-400 pl-3">
                  <span>— {d.name} ({d.type === 'fixed' ? php(d.rate) : `${d.rate}%`} off)</span>
                  <span className="font-mono">- {php(d.deduction)}</span>
                </div>
              ))}
              {bill.totalDiscount > 0 && (
                <div className="flex justify-between text-sm font-semibold text-green-600 dark:text-green-400 border-t border-dashed border-[var(--color-border)] pt-2">
                  <span>Tuition after discount</span>
                  <span className="font-mono">{php(bill.tuitionAfterDiscount)}</span>
                </div>
              )}
              {[
                { label: 'Lab Fee' + (isCollege ? ` (${actualLabUnits} units × ${php(feeEntry?.labRatePerUnit||0)})` : ''), val: bill.lab },
                { label: 'Misc Fee',   val: bill.misc  },
                { label: 'Books',      val: bill.books },
                { label: 'Other Fees', val: bill.other },
              ].filter(f => f.val > 0).map(f => (
                <div key={f.label} className="flex justify-between text-sm">
                  <span className="text-[var(--color-text-secondary)]">{f.label} <span className="text-xs text-gray-400">(fixed)</span></span>
                  <span className="font-mono">{php(f.val)}</span>
                </div>
              ))}
              <div className="flex justify-between text-base font-bold text-[var(--color-text-primary)] border-t-2 border-[var(--color-border-strong)] pt-2 mt-1">
                <span>Grand Total</span>
                <span className="font-mono text-primary dark:text-red-400">{php(bill.grandTotal)}</span>
              </div>
              {bill.enrollment > 0 && (
                <div className="flex justify-between text-xs text-amber-600 dark:text-amber-400 mt-1">
                  <span>Minimum payment required (enrollment fee)</span>
                  <span className="font-mono font-semibold">{php(bill.enrollment)}</span>
                </div>
              )}
              {bill.totalDiscount > 0 && (
                <p className="text-xs text-green-600 dark:text-green-400 text-right">
                  Saved {php(bill.totalDiscount)} on tuition!
                </p>
              )}
            </div>
          )}

          {/* Discount selector */}
          {campusDiscounts?.filter(d => d.isActive).length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5"/> Apply Discounts <span className="font-normal text-gray-400">(optional)</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {campusDiscounts.filter(d => d.isActive).map(d => {
                  const selected = selectedDiscounts.some(x => x.id === d.id)
                  return (
                    <button key={d.id} onClick={() => toggleDiscount(d)}
                      className={`text-left px-3 py-2.5 rounded-xl border text-xs transition flex items-start gap-2
                        ${selected
                          ? 'border-primary bg-primary/5 dark:bg-primary/10'
                          : 'border-[var(--color-border)] hover:border-primary/50'
                        }`}>
                      <div className={`w-4 h-4 rounded flex-shrink-0 mt-0.5 flex items-center justify-center border transition
                        ${selected ? 'bg-primary border-primary' : 'border-[var(--color-border-strong)]'}`}>
                        {selected && <CheckCircle className="w-3 h-3 text-white"/>}
                      </div>
                      <div>
                        <p className={`font-semibold ${selected ? 'text-primary dark:text-red-400' : 'text-[var(--color-text-primary)]'}`}>
                          {d.name}
                        </p>
                        <p className="text-gray-400">
                          {d.type === 'fixed' ? `₱${d.defaultRate.toLocaleString()} off tuition` : `${d.defaultRate}% off tuition`}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Payment input */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">Payment Details</h3>

            {/* Amount */}
            <div>
              <label className="form-label">
                Amount Paid Now <span className="text-red-500">*</span>
                {bill && <span className="ml-1 font-normal text-gray-400">(grand total: {php(bill.grandTotal)})</span>}
              </label>
              {bill?.enrollment > 0 && (
                <div className="flex items-center gap-1.5 mb-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg px-3 py-2">
                  <Info className="w-3.5 h-3.5 flex-shrink-0"/>
                  Minimum payment: <strong>{php(bill.enrollment)}</strong> — whatever is paid now is deducted from the grand total
                </div>
              )}
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-sm">₱</span>
                <input type="number" min="1" value={amountPaid}
                  onChange={e => setAmountPaid(e.target.value)}
                  placeholder="Enter amount"
                  className={`w-full pl-7 pr-4 py-2.5 text-sm border rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none transition
                    ${errors.amount ? 'border-red-400' : 'border-[var(--color-border)] focus:border-primary focus:ring-2 focus:ring-primary/20'}`}
                />
              </div>
              {errors.amount && <p className="text-xs text-red-500 mt-1">{errors.amount}</p>}
              {/* Quick amount buttons */}
              <div className="flex gap-2 mt-2 flex-wrap">
                {bill?.enrollment > 0 && (
                  <button onClick={() => setAmountPaid(String(bill.enrollment))}
                    className="text-xs px-2.5 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-lg hover:bg-amber-500 hover:text-white transition font-medium border border-amber-300 dark:border-amber-700">
                    Min ₱{bill.enrollment.toLocaleString()}
                  </button>
                )}
                {[500,1000,2000,5000].filter(v => !bill?.enrollment || v !== bill.enrollment).map(v => (
                  <button key={v} onClick={() => setAmountPaid(String(v))}
                    className="text-xs px-2.5 py-1 bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)] rounded-lg hover:bg-primary hover:text-white transition font-medium">
                    ₱{v.toLocaleString()}
                  </button>
                ))}
                {bill && (
                  <button onClick={() => setAmountPaid(String(bill.grandTotal))}
                    className="text-xs px-2.5 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-600 hover:text-white transition font-medium">
                    Full ₱{bill.grandTotal.toLocaleString()}
                  </button>
                )}
              </div>
              {/* Live balance */}
              {bill && amountPaid && parseFloat(amountPaid) > 0 && (
                <div className="mt-2 flex justify-between text-xs">
                  <span className="text-gray-400">Remaining balance after this payment:</span>
                  <span className={`font-mono font-semibold ${balance > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
                    {balance > 0 ? php(balance) : 'Fully paid ✓'}
                  </span>
                </div>
              )}
            </div>

            {/* Payment method */}
            <div>
              <label className="form-label">Payment Method</label>
              <div className="flex gap-2">
                {['Cash','Bank Transfer'].map(m => (
                  <button key={m} onClick={() => setPayMethod(m)}
                    className={`flex-1 py-2.5 text-sm font-semibold rounded-xl border transition
                      ${payMethod === m ? 'bg-primary text-white border-primary' : 'bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-primary'}`}>
                    {m === 'Cash' ? '💵' : '🏦'} {m}
                  </button>
                ))}
              </div>
            </div>

            {/* OR number */}
            <div>
              <label className="form-label">
                OR Number <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <input type="text" value={orNumber} onChange={e => setOrNumber(e.target.value)}
                  className={`flex-1 px-3 py-2.5 text-sm font-mono border rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none transition
                    ${errors.or ? 'border-red-400' : 'border-[var(--color-border)] focus:border-primary focus:ring-2 focus:ring-primary/20'}`}
                />
                <button onClick={() => setOrNumber(`OR-${new Date().getFullYear().toString().slice(-2)}${String(new Date().getMonth()+1).padStart(2,'0')}-${Math.floor(Math.random()*9000+1000)}`)
                }
                  className="px-3 py-2.5 text-xs bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)] rounded-xl hover:bg-[var(--color-bg-muted)] transition font-medium whitespace-nowrap">
                  Generate
                </button>
              </div>
              {errors.or && <p className="text-xs text-red-500 mt-1">{errors.or}</p>}
            </div>

            {/* Notes */}
            <div>
              <label className="form-label">Notes (optional)</label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="e.g. Down payment, Monthly installment — March..."
                className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button onClick={onClose}
            className="btn-cancel">
            Cancel
          </button>
          <button onClick={handleConfirm}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm bg-green-600 text-white rounded-xl hover:bg-green-700 transition font-semibold shadow-sm">
            <CheckCircle className="w-4 h-4"/> Confirm Payment & Update Status
          </button>
        </div>
      </div>
    </div>
  </ModalPortal>
  )
}

// ── Name formatter ─────────────────────────────────────────────────
function formatStudentName(student, opts = {}) {
  if (!student) return ''
  if (student.fullName && !opts.short) return student.fullName
  const last  = (student.lastName   || '').trim().toUpperCase()
  const first = (student.firstName  || '').trim().toUpperCase()
  const mid   = (student.middleName || '').trim().toUpperCase()
  if (!last && !first) return ''
  if (opts.short) return last ? `${last}, ${first}` : first
  return mid ? `${last}, ${first} ${mid}` : `${last}, ${first}`
}

function toTitleCase(str) {
  if (!str) return ''
  return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
}

// ════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ════════════════════════════════════════════════════════════════════
export default function Enrollments() {
  const { user } = useAuth()
  const { activeCampuses, currentSchoolYear, feeStructure } = useAppConfig()

  const campusDiscounts = (() => {
    try {
      const campusKey = user?.campus?.replace(/ (City |)Campus$/i,'').replace(/[^a-zA-Z]/g,'') || 'all'
      const cfg = JSON.parse(localStorage.getItem(`cshc_campus_cfg_${campusKey}`) || '{}')
      return cfg.discounts || DEFAULT_DISCOUNTS
    } catch { return DEFAULT_DISCOUNTS }
  })()

  // Cashier name for receipts (campus-scoped)
  const cashierName = (() => {
    try {
      const campusKey = user?.campus?.replace(/ (City |)Campus$/i,'').replace(/[^a-zA-Z]/g,'') || 'all'
      const cfg = JSON.parse(localStorage.getItem(`cshc_campus_cfg_${campusKey}`) || '{}')
      return cfg.cashierName || user?.name || 'Accounting Officer'
    } catch { return user?.name || 'Accounting Officer' }
  })()

  const location = useLocation()
  const { toasts, addToast, removeToast } = useToast()

  const getWebSubs = () => {
    try { return JSON.parse(localStorage.getItem('cshc_submissions') || '[]') } catch { return [] }
  }

  const filterByCampus = (subs) => {
    const campus = user?.campus
    if (!campus || campus === 'all') return subs
    return subs.filter(s => {
      const subCampus = s.enrollment?.campus || s.campusName || ''
      return subCampus === campus || subCampus.includes(campus) || campus.includes(subCampus)
    })
  }

  const buildEnrollments = () => filterByCampus(getWebSubs())

  const [enrollments, setEnrollments]         = useState(buildEnrollments)
  const [websiteSubmissions, setWebsiteSubs]  = useState(() => filterByCampus(getWebSubs()))
  const [websiteCount, setWebsiteCount]       = useState(() => {
    const subs = filterByCampus(getWebSubs())
    const role = user?.role
    if (role === 'registrar_basic')   return subs.filter(s => s.status === 'payment_received' && isBasicEd(s.enrollment?.gradeLevel || '')).length
    if (role === 'registrar_college') return subs.filter(s => s.status === 'payment_received' && isCollege(s.enrollment?.gradeLevel || '')).length
    if (role === 'accounting')        return subs.filter(s => s.status === 'pending').length
    return subs.filter(s => s.status === 'pending' || s.status === 'payment_received').length
  })

  const getActionableCount = (subs) => {
    const role = user?.role
    if (role === 'registrar_basic')
      return subs.filter(s => s.status === 'payment_received' && isBasicEd(s.enrollment?.gradeLevel || '')).length
    if (role === 'registrar_college')
      return subs.filter(s => s.status === 'payment_received' && isCollege(s.enrollment?.gradeLevel || '')).length
    if (role === 'accounting')
      return subs.filter(s => s.status === 'pending').length
    return subs.filter(s => s.status === 'pending' || s.status === 'payment_received').length
  }

  const loadBridge = useCallback(() => {
    const subs = filterByCampus(getWebSubs())
    setWebsiteSubs(subs)
    setWebsiteCount(getActionableCount(subs))
    setEnrollments(subs)
  }, [user?.campus, user?.role])

  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === 'cshc_submissions' || e.key === null) {
        loadBridge()
      }
    }
    window.addEventListener('cshc_new_submission', loadBridge)
    window.addEventListener('storage', handleStorage)
    const t = setInterval(loadBridge, 10000)
    return () => {
      window.removeEventListener('cshc_new_submission', loadBridge)
      window.removeEventListener('storage', handleStorage)
      clearInterval(t)
    }
  }, [loadBridge])

  const updateWebsiteStatus = (refNum, newStatus) => {
    try {
      const raw  = localStorage.getItem('cshc_submissions')
      const subs = raw ? JSON.parse(raw) : []
      const updated = subs.map(s =>
        (s.referenceNumber === refNum || s.id === refNum)
          ? { ...s, status: newStatus, updatedAt: new Date().toISOString() }
          : s
      )
      localStorage.setItem('cshc_submissions', JSON.stringify(updated))
      localStorage.setItem('cshc_status_update', JSON.stringify({ refNum, newStatus, ts: Date.now() }))
      loadBridge()
    } catch {}
  }
  const approveWebsite  = (refNum) => updateWebsiteStatus(refNum, 'approved')
  const rejectWebsite   = (refNum) => updateWebsiteStatus(refNum, 'rejected')
  const markPaidWebsite = (refNum) => updateWebsiteStatus(refNum, 'payment_received')

  const defaultStatus = () => {
    if (user?.role === 'registrar_basic' || user?.role === 'registrar_college') return 'payment_received'
    return 'all'
  }
  const [searchQuery, setSearchQuery]             = useState('')
  const [statusFilter, setStatusFilter]           = useState(defaultStatus)
  const [timeFilter, setTimeFilter]               = useState('all')
  const [gradeLevelFilter, setGradeLevelFilter]   = useState('all')
  const [selectedEnrollment, setSelectedEnrollment] = useState(null)
  const [showModal, setShowModal]                 = useState(false)
  const [showFeeModal, setShowFeeModal]           = useState(false)
  const [feeModalEnroll, setFeeModalEnroll]       = useState(null)
  const [showReceiptModal, setShowReceiptModal]   = useState(false)
  const [receiptData, setReceiptData]             = useState(null)       // { enrollment, paymentData }
  const [showDetailDrawer, setShowDetailDrawer]   = useState(false)
  const [drawerEnrollment, setDrawerEnrollment]   = useState(null)
  const [confirm, setConfirm]                     = useState({ open: false, type: null, id: null })
  const [actionLoading, setActionLoading]         = useState(false)
  const { campusFilter } = useCampusFilter()
  const [loading, setLoading] = useState(true)

  useEffect(() => { const t = setTimeout(() => setLoading(false), 150); return () => clearTimeout(t) }, [])
  useEffect(() => {
    setLoading(true); setGradeLevelFilter('all')
    const t = setTimeout(() => setLoading(false), 100)
    return () => clearTimeout(t)
  }, [campusFilter])

  useEffect(() => {
    if (location.state?.openEnrollment) {
      setSelectedEnrollment(location.state.openEnrollment); setShowModal(true)
      window.history.replaceState({}, '')
    }
  }, [location.state])

  const isCampusLocked = user?.role === 'registrar_college' || user?.role === 'registrar_basic' || (user?.role === 'accounting' && user?.campus !== 'all')
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

  // ── Non-admin: role-scoped list view ─────────────────────────
  const roleFiltered = enrollments.filter(e => {
    const g = e.enrollment.gradeLevel, c = e.enrollment.campus
    if (user?.role === 'accounting') {
      const campusMatch = user?.campus === 'all' || c === user.campus
      return campusMatch && (e.status === 'pending' || e.status === 'payment_received')
    }
    if (user?.role === 'registrar_basic')   return isBasicEd(g) && c === user.campus
    if (user?.role === 'registrar_college') return isCollege(g) && c === user.campus
    return true
  })

  const filtered = roleFiltered.filter(e => {
    const name = formatStudentName(e.student, {short: true}).toLowerCase()
    const matchSearch = name.includes(searchQuery.toLowerCase()) || e.referenceNumber.toLowerCase().includes(searchQuery.toLowerCase())
    const matchStatus = statusFilter === 'all' || e.status === statusFilter
    const matchCampus = isCampusLocked || effectiveCampusFilter === 'all' || e.enrollment.campus.includes(effectiveCampusFilter)
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

  const STATUS_ORDER = { pending: 0, payment_received: 1, approved: 2, rejected: 3 }
  const sorted = [...filtered].sort((a, b) => {
    const diff = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9)
    if (diff !== 0) return diff
    return new Date(a.submittedDate) - new Date(b.submittedDate)
  })

  const stats = {
    total:            roleFiltered.length,
    pending:          roleFiltered.filter(e => e.status === 'pending').length,
    payment_received: roleFiltered.filter(e => e.status === 'payment_received').length,
    approved:         roleFiltered.filter(e => e.status === 'approved').length,
    rejected:         roleFiltered.filter(e => e.status === 'rejected').length,
  }

  const canMarkPayment = (e) =>
    (user?.role === 'technical_admin' || user?.role === 'accounting') && e.status === 'pending'

  const canApproveReject = (e) =>
    (user?.role === 'technical_admin') ||
    (user?.role === 'registrar_basic'   && e.status === 'payment_received' && isBasicEd(e.enrollment.gradeLevel)) ||
    (user?.role === 'registrar_college' && e.status === 'payment_received' && isCollege(e.enrollment.gradeLevel))

  const handleApprove     = (id) => setConfirm({ open: true, type: 'approve',      id })
  const handleReject      = (id) => setConfirm({ open: true, type: 'reject',       id })
  const handleMarkPayment = (id) => {
    const enr = enrollments.find(e => e.id === id)
    if (!enr) return
    setFeeModalEnroll(enr)
    setShowFeeModal(true)
  }

  // Open accounting detail drawer
  const handleViewAccountingDetail = (enrollment) => {
    setDrawerEnrollment(enrollment)
    setShowDetailDrawer(true)
  }

  // Reprint receipt: reconstruct paymentData from enrollment's saved payment history
  const handleReprintReceipt = (enrollment) => {
    const lastPayment = enrollment.paymentHistory?.[enrollment.paymentHistory.length - 1]
    if (!lastPayment) return
    setReceiptData({
      enrollment,
      paymentData: {
        feeBreakdown:     enrollment.feeBreakdown,
        totalFee:         enrollment.totalFee,
        amountPaid:       lastPayment.amount,
        balance:          enrollment.balance,
        paymentMethod:    lastPayment.method,
        orNumber:         lastPayment.orNumber || '—',
        notes:            lastPayment.notes,
        discountsApplied: enrollment.discountsApplied || [],
        paymentDate:      lastPayment.date,
      }
    })
    setShowReceiptModal(true)
    setShowDetailDrawer(false)
  }

  const handleFeeAssessmentConfirm = (paymentData) => {
    const id  = feeModalEnroll.id
    const ref = feeModalEnroll.referenceNumber

    const updatedFields = {
      status:           'payment_received',
      totalFee:         paymentData.totalFee,
      amountPaid:       paymentData.amountPaid,
      balance:          paymentData.balance,
      feeBreakdown:     paymentData.feeBreakdown,
      discountsApplied: paymentData.discountsApplied,
      paymentHistory:   [{
        id:         1,
        amount:     paymentData.amountPaid,
        method:     paymentData.paymentMethod,
        date:       paymentData.paymentDate,
        orNumber:   paymentData.orNumber,
        notes:      paymentData.notes,
        paymentFor: ['tuition', 'misc',
          ...(paymentData.feeBreakdown?.lab   > 0 ? ['lab']   : []),
          ...(paymentData.feeBreakdown?.books > 0 ? ['books'] : []),
          ...(paymentData.feeBreakdown?.other > 0 ? ['other'] : []),
        ],
      }],
      lastPaymentDate: paymentData.paymentDate,
      paymentMethod:   paymentData.paymentMethod,
    }

    setEnrollments(prev => prev.map(e => e.id === id ? { ...e, ...updatedFields } : e))

    const isWebsite = websiteSubmissions.some(s => s.id === id || s.referenceNumber === ref)
    if (isWebsite) {
      try {
        const raw  = localStorage.getItem('cshc_submissions')
        const subs = raw ? JSON.parse(raw) : []
        const updated = subs.map(s =>
          (s.id === id || s.referenceNumber === ref)
            ? { ...s, ...updatedFields, updatedAt: new Date().toISOString() }
            : s
        )
        localStorage.setItem('cshc_submissions', JSON.stringify(updated))
        localStorage.setItem('cshc_status_update', JSON.stringify({ refNum: ref, newStatus: 'payment_received', ts: Date.now() }))
      } catch {}
    }

    setShowFeeModal(false)
    setFeeModalEnroll(null)
    window.dispatchEvent(new CustomEvent('cshc_enrollment_updated'))
    loadBridge()

    // Show receipt modal right after payment is confirmed
    const updatedEnrollment = { ...feeModalEnroll, ...updatedFields }
    setReceiptData({ enrollment: updatedEnrollment, paymentData })
    setShowReceiptModal(true)
  }

  const confirmAction = () => {
    setActionLoading(true)
    setTimeout(() => {
      let newStatus
      if (confirm.type === 'approve')           newStatus = 'approved'
      else if (confirm.type === 'reject')       newStatus = 'rejected'
      else if (confirm.type === 'mark_payment') newStatus = 'payment_received'

      setEnrollments(prev => prev.map(e => e.id === confirm.id ? { ...e, status: newStatus } : e))
      if (selectedEnrollment?.id === confirm.id) setSelectedEnrollment(prev => ({ ...prev, status: newStatus }))

      const isWebsite = websiteSubmissions.some(s => s.id === confirm.id || s.referenceNumber === confirm.id)
      if (isWebsite) {
        if (confirm.type === 'approve')           approveWebsite(confirm.id)
        else if (confirm.type === 'reject')       rejectWebsite(confirm.id)
        else if (confirm.type === 'mark_payment') markPaidWebsite(confirm.id)
      }

      const toastMsg = {
        approve:      'Enrollment approved! ✓',
        reject:       'Enrollment rejected.',
        mark_payment: 'Payment recorded — registrar has been notified.',
      }
      addToast(toastMsg[confirm.type], confirm.type === 'approve' ? 'success' : confirm.type === 'mark_payment' ? 'success' : 'error')
      window.dispatchEvent(new CustomEvent('cshc_enrollment_updated'))
      setConfirm({ open: false, type: null, id: null }); setActionLoading(false)
    }, 800)
  }

  const handleExport = () => {
    const data = sorted.map(e => ({
      'Reference #': e.referenceNumber, 'Student Name': formatStudentName(e.student),
      'Email': e.student.email, 'Campus': e.enrollment.campus,
      'Grade / Program': e.enrollment.gradeLevel, 'Student Type': e.enrollment.studentType,
      'School Year': e.enrollment.schoolYear, 'Status': e.status.toUpperCase(),
      'Date Submitted': new Date(e.submittedDate).toLocaleDateString(),
      ...(user?.role === 'accounting' ? {
        'Total Fee': e.totalFee || '',
        'Amount Paid': e.amountPaid || '',
        'Balance': e.balance || '',
        'OR Number': e.paymentHistory?.[0]?.orNumber || '',
      } : {}),
    }))
    exportToExcel(data, `Enrollments_${new Date().toISOString().split('T')[0]}`, 'Enrollments')
    addToast(`Exported ${data.length} records!`, 'success')
  }

  const hasFilters = searchQuery || statusFilter !== defaultStatus() || timeFilter !== 'all' || gradeLevelFilter !== 'all'
  const clearFilters = () => { setSearchQuery(''); setStatusFilter('all'); setTimeFilter('all'); setGradeLevelFilter('all') }
  const fmtDate = (d) => new Date(d).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })

  // ── Accounting: today's collection summary bar ──
  const todayCollected = user?.role === 'accounting'
    ? roleFiltered
        .filter(e => {
          const lp = e.lastPaymentDate || e.updatedAt
          return lp && new Date(lp).toDateString() === new Date().toDateString()
        })
        .reduce((s, e) => s + (e.amountPaid || 0), 0)
    : 0
  const todayCount = user?.role === 'accounting'
    ? roleFiltered.filter(e => {
        const lp = e.lastPaymentDate || e.updatedAt
        return lp && new Date(lp).toDateString() === new Date().toDateString() && e.status === 'payment_received'
      }).length
    : 0

  return (
    <div className="animate-fade-in space-y-5">
      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)]">
            {user?.role === 'accounting' ? 'Enrollment Payments'
              : user?.role === 'registrar_college' ? 'College Enrollments'
              : 'Basic Ed Enrollments'}
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {user?.role === 'accounting'
              ? 'Record and manage student payments for enrollment'
              : 'Review and manage enrollment applications'}
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button onClick={handleExport}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-[#4a0009] transition font-medium">
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      {/* Campus-locked banner */}
      <CampusBanner user={user} />

      {/* ── Accounting: Today's collection summary ── */}
      {user?.role === 'accounting' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="col-span-2 sm:col-span-2 bg-gradient-to-br from-primary to-[#4a0009] rounded-xl p-4 text-white shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Banknote className="w-4 h-4 opacity-80"/>
              <p className="text-xs font-medium opacity-80">Today's Collection</p>
            </div>
            <p className="text-2xl font-bold font-mono">{php(todayCollected)}</p>
            <p className="text-xs opacity-70 mt-1">{todayCount} payment{todayCount !== 1 ? 's' : ''} processed today</p>
          </div>
          <div className="bg-[var(--color-bg-card)] rounded-xl p-4 border-l-4 border-yellow-500 shadow-sm">
            <p className="text-xs text-[var(--color-text-muted)] mb-1">Awaiting Payment</p>
            <p className="text-2xl font-bold text-[var(--color-text-primary)]">{stats.pending}</p>
            <p className="text-xs text-yellow-600 dark:text-yellow-400 font-medium mt-1">Needs recording</p>
          </div>
          <div className="bg-[var(--color-bg-card)] rounded-xl p-4 border-l-4 border-blue-500 shadow-sm">
            <p className="text-xs text-[var(--color-text-muted)] mb-1">Payment Recorded</p>
            <p className="text-2xl font-bold text-[var(--color-text-primary)]">{stats.payment_received}</p>
            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-1">With registrar</p>
          </div>
        </div>
      )}

      {/* Non-accounting stat cards */}
      {user?.role !== 'accounting' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[
            { label:'Total Enrollments',  value:stats.total,            border:'border-primary',    sub:'All submissions',     cls:'text-gray-400' },
            { label:'Awaiting Payment',   value:stats.pending,          border:'border-yellow-500', sub:'Pending payment at Accounting', cls:'text-yellow-600 dark:text-yellow-400' },
            { label:'Payment Received',   value:stats.payment_received, border:'border-blue-500',   sub:'Ready for registrar review', cls:'text-blue-600 dark:text-blue-400' },
            { label:'Approved',           value:stats.approved,         border:'border-green-500',  sub:stats.total>0?`${Math.round(stats.approved/stats.total*100)}% approval rate`:'—', cls:'text-green-600 dark:text-green-400' },
          ].map(({ label, value, border, sub, cls }) => (
            <div key={label} className={`bg-[var(--color-bg-card)] rounded-xl p-4 border-l-4 ${border} shadow-sm`}>
              <p className="text-xs text-[var(--color-text-muted)] mb-1">{label}</p>
              <p className="text-2xl font-bold text-[var(--color-text-primary)]">{value}</p>
              <p className={`text-xs mt-1 font-medium ${cls}`}>{sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Website Submissions Banner ── */}
      {websiteCount > 0 && (() => {
        const isRegistrar = user?.role === 'registrar_basic' || user?.role === 'registrar_college'
        if (isRegistrar) return (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl px-5 py-3.5 flex items-center gap-3">
            <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-green-800 dark:text-green-200">
                {websiteCount} enrollment{websiteCount !== 1 ? 's' : ''} paid and ready for your approval
              </p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                Payment has been confirmed by Accounting — please review and approve or reject below
              </p>
            </div>
          </div>
        )
        return (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-5 py-3.5 flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <DollarSign className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                {websiteCount} enrollment{websiteCount !== 1 ? 's' : ''} awaiting payment recording
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                These students submitted online and are waiting — click <strong>Record Payment</strong> to process
              </p>
            </div>
          </div>
        )
      })()}

      {/* ── Search + Filters ── */}
      <div className="bg-[var(--color-bg-card)] rounded-xl p-4 shadow-sm space-y-3">
        <div className="relative">
          <Search className="search-icon" />
          <input type="text" placeholder="Search by name or reference number…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-primary outline-none transition" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <GroupedSelect
            value={statusFilter}
            onChange={setStatusFilter}
            allLabel="All Status"
            options={[
              { value: 'pending',          label: 'Awaiting Payment' },
              { value: 'payment_received', label: 'Payment Received' },
              { value: 'approved',         label: 'Approved'         },
              { value: 'rejected',         label: 'Rejected'         },
            ]}
          />
          <GroupedSelect
            value={timeFilter}
            onChange={setTimeFilter}
            allLabel="All Time"
            options={[
              { value: 'today', label: 'Today'      },
              { value: 'week',  label: 'This Week'  },
              { value: 'month', label: 'This Month' },
            ]}
          />
          <div>
            <GradeLevelSelect value={gradeLevelFilter} onChange={setGradeLevelFilter}
              campusFilter={isCampusLocked ? (activeCampuses.find(c => c.name === user.campus)?.key || 'all') : effectiveCampusFilter}
              userRole={user?.role} />
          </div>
          <div className="flex gap-2">
            {hasFilters && <button onClick={clearFilters} className="flex-1 px-3 py-2.5 text-sm text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-subtle)] transition">Clear</button>}
            <button onClick={handleExport} className="flex-1 px-3 py-2.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center justify-center gap-1.5 font-medium">
              <Download className="w-4 h-4" /> Export
            </button>
          </div>
        </div>
        {hasFilters && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs text-[var(--color-text-muted)] flex items-center gap-1"><Filter className="w-3 h-3"/>Filters:</span>
            {searchQuery              && <Pill label={`"${searchQuery}"`}  onRemove={() => setSearchQuery('')} />}
            {statusFilter!=='all'     && <Pill label={statusFilter}         onRemove={() => setStatusFilter('all')} />}
            {timeFilter!=='all'       && <Pill label={timeFilter}           onRemove={() => setTimeFilter('all')} />}
            {gradeLevelFilter!=='all' && <Pill label={gradeLevelFilter}     onRemove={() => setGradeLevelFilter('all')} />}
            <button onClick={clearFilters} className="text-xs text-primary hover:text-[#4a0009] font-medium transition">Clear all</button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--color-text-muted)]">
          Showing <span className="font-semibold text-[var(--color-text-secondary)]">{sorted.length}</span> of <span className="font-semibold">{roleFiltered.length}</span> enrollment{roleFiltered.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* ── Enrollment List ── */}
      <div className="card-section">
        {sorted.length === 0 ? <EmptyState type={hasFilters ? 'search' : 'enrollments'} onClear={hasFilters ? clearFilters : undefined} /> : (
          <>
            {/* ── Mobile card list ── */}
            <ul className="md:hidden divide-y divide-[var(--color-border)]">
              {sorted.map(e => (
                <li key={e.id}>
                  {user?.role === 'accounting' ? (
                    // Accounting mobile card — now tappable to open detail drawer
                    <div
                      className={`px-4 py-4 transition ${e.status === 'payment_received' ? 'bg-[var(--color-bg-subtle)]/50' : 'active:bg-[var(--color-bg-subtle)]'}`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Status indicator dot */}
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-2 ${
                          e.status === 'pending' ? 'bg-yellow-500' :
                          e.status === 'payment_received' ? 'bg-blue-500' : 'bg-[var(--color-border-strong)]'
                        }`}/>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <span className="text-sm font-semibold text-[var(--color-text-primary)] leading-tight">{formatStudentName(e.student, {short: true})}</span>
                            <StatusBadge status={e.status} />
                          </div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-xs font-mono text-primary dark:text-red-400">{e.referenceNumber}</p>
                            {e.source === 'website' && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                <Globe className="w-2.5 h-2.5" /> Web
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[var(--color-text-muted)] mb-2">
                            {e.enrollment.gradeLevel} · {e.enrollment.campus.replace(' City Campus','').replace(' Campus','')}
                          </p>
                          {/* Show payment summary if already recorded */}
                          {e.status === 'payment_received' && e.amountPaid > 0 && (
                            <div className="flex items-center gap-3 mb-2 text-xs">
                              <span className="text-green-600 dark:text-green-400 font-semibold">{php(e.amountPaid)} paid</span>
                              {(e.balance || 0) > 0 && <span className="text-amber-500">· {php(e.balance)} balance</span>}
                            </div>
                          )}
                          {/* Action buttons */}
                          <div className="flex gap-2 flex-wrap">
                            {canMarkPayment(e) && (
                              <button onClick={() => handleMarkPayment(e.id)}
                                className="text-xs px-3 py-2 bg-blue-600 text-white rounded-lg font-semibold flex items-center gap-1.5 hover:bg-blue-700 active:bg-blue-800 transition touch-manipulation">
                                <DollarSign className="w-3 h-3"/> Record Payment
                              </button>
                            )}
                            {e.status === 'payment_received' && (
                              <button onClick={() => handleViewAccountingDetail(e)}
                                className="text-xs px-3 py-2 bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)] rounded-lg font-medium flex items-center gap-1.5 hover:bg-[var(--color-bg-muted)] transition touch-manipulation">
                                <Eye className="w-3 h-3"/> Details
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => { setSelectedEnrollment(e); setShowModal(true) }}
                      className="w-full text-left px-4 py-4 hover:bg-[var(--color-bg-subtle)]/50 transition flex items-start gap-3">
                      <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"><User className="w-4 h-4 text-primary" /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-0.5">
                          <span className="text-sm font-semibold text-[var(--color-text-primary)]">{formatStudentName(e.student, {short: true})}</span>
                          <StatusBadge status={e.status} />
                        </div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-xs font-mono text-primary dark:text-red-400">{e.referenceNumber}</p>
                          {e.source === 'website' && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                              <Globe className="w-2.5 h-2.5" /> Web
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-2 text-xs text-[var(--color-text-muted)]">
                          <span>{e.enrollment.gradeLevel}</span><span>•</span><span>{e.enrollment.campus.replace(' Campus','')}</span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
                    </button>
                  )}
                </li>
              ))}
            </ul>

            {/* ── Desktop table ── */}
            <div className="hidden md:block min-w-0">
              <div className="overflow-x-auto">
                <table className={`w-full min-w-[${user?.role === 'accounting' ? '760' : '700'}px]`}>
                  <thead className="bg-[var(--color-bg-subtle)]">
                    <tr>
                      {user?.role === 'accounting'
                        ? ['Reference','Student Name','Grade / Program','Date Submitted','Status','Fee / Paid','Actions'].map(h => (
                            <th key={h} className="th">{h}</th>
                          ))
                        : ['Reference','Student Name',!isCampusLocked?'Campus':null,'Grade / Program','Date Submitted','Status','Actions'].filter(Boolean).map(h => (
                            <th key={h} className="th">{h}</th>
                          ))
                      }
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {sorted.map(e => (
                      <tr key={e.id} className={`hover:bg-[var(--color-bg-subtle)]/50 transition-colors ${e.status === 'payment_received' || e.status === 'approved' || e.status === 'rejected' ? 'opacity-70' : ''}`}>
                        {/* Reference */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="text-sm font-mono font-medium text-primary dark:text-red-400">{e.referenceNumber}</p>
                          {e.source === 'website' && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 mt-0.5">
                              <Globe className="w-2.5 h-2.5" /> Online
                            </span>
                          )}
                        </td>
                        {/* Student Name */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="text-sm font-medium text-[var(--color-text-primary)]">{formatStudentName(e.student, {short: true})}</p>
                          <p className="text-xs text-[var(--color-text-muted)]">{e.student.email}</p>
                        </td>
                        {/* Campus — only for non-accounting, non-campus-locked */}
                        {user?.role !== 'accounting' && !isCampusLocked && (
                          <td className="px-4 py-3 text-sm text-[var(--color-text-secondary)] whitespace-nowrap">{e.enrollment.campus}</td>
                        )}
                        {/* Grade / Program */}
                        <td className="px-4 py-3 text-sm text-[var(--color-text-secondary)] whitespace-nowrap">{e.enrollment.gradeLevel}</td>
                        {/* Date */}
                        <td className="px-4 py-3 text-xs text-[var(--color-text-muted)] whitespace-nowrap">{fmtDate(e.submittedDate)}</td>
                        {/* Status */}
                        <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={e.status} /></td>
                        {/* Fee/Paid — accounting only */}
                        {user?.role === 'accounting' && (
                          <td className="px-4 py-3 whitespace-nowrap">
                            {e.totalFee > 0 ? (
                              <div className="text-xs">
                                <p className="font-mono text-[var(--color-text-secondary)]">{php(e.amountPaid || 0)} <span className="text-gray-400">of {php(e.totalFee)}</span></p>
                                {(e.balance || 0) > 0 && (
                                  <p className="text-amber-600 dark:text-amber-400 font-medium">{php(e.balance)} balance</p>
                                )}
                                {(e.balance || 0) <= 0 && e.totalFee > 0 && (
                                  <p className="text-green-600 dark:text-green-400 font-medium">Fully paid ✓</p>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                        )}
                        {/* Actions */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {/* Non-accounting: View button */}
                            {user?.role !== 'accounting' && (
                              <button onClick={() => { setSelectedEnrollment(e); setShowModal(true) }}
                                className="inline-flex items-center gap-1 text-sm text-primary dark:text-red-400 hover:text-[#4a0009] font-medium transition">
                                <Eye className="w-4 h-4" /> View
                              </button>
                            )}
                            {/* Accounting: Record Payment */}
                            {canMarkPayment(e) && (
                              <button onClick={() => handleMarkPayment(e.id)}
                                className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 bg-blue-600 text-white hover:bg-blue-700 font-semibold transition rounded-lg shadow-sm">
                                <DollarSign className="w-3.5 h-3.5" /> Record Payment
                              </button>
                            )}
                            {/* Accounting: View details for paid entries */}
                            {user?.role === 'accounting' && e.status === 'payment_received' && (
                              <button onClick={() => handleViewAccountingDetail(e)}
                                className="inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] font-medium transition">
                                <Eye className="w-4 h-4" /> View
                              </button>
                            )}
                            {/* Registrar/Admin: Approve */}
                            {canApproveReject(e) && (
                              <button onClick={() => handleApprove(e.id)}
                                className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-200 transition font-medium">
                                Approve
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Detail modal (registrar / admin view) ── */}
      {showModal && selectedEnrollment && user?.role !== 'accounting' && (
        <ModalPortal>
        <div className="modal-backdrop">
          <div className="bg-[var(--color-bg-card)] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-3xl max-h-[92vh] flex flex-col">
            <div className="modal-header">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0"><FileText className="w-5 h-5 text-primary" /></div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-[var(--color-text-primary)] truncate">{formatStudentName(selectedEnrollment.student, {short: true})}</h2>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-mono text-primary dark:text-red-400">{selectedEnrollment.referenceNumber}</p>
                    {selectedEnrollment.source === 'website' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        <Globe className="w-3 h-3" /> Submitted Online
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="icon-btn-ghost"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={selectedEnrollment.status} />
                <span className="text-xs text-[var(--color-text-muted)]">Submitted: {fmtDate(selectedEnrollment.submittedDate)}</span>
              </div>
              <InfoSection title="Enrollment Details" icon={<GraduationCap className="w-4 h-4"/>}>
                <InfoGrid fields={[['Campus', selectedEnrollment.enrollment.campus],['Grade / Program', selectedEnrollment.enrollment.gradeLevel],['Student Type', selectedEnrollment.enrollment.studentType],['School Year', selectedEnrollment.enrollment.schoolYear]]} />
              </InfoSection>
              <InfoSection title="Student Information" icon={<User className="w-4 h-4"/>}>
                <InfoGrid fields={[['Full Name', formatStudentName(selectedEnrollment.student), true],['Birthdate / Age', selectedEnrollment.student.birthDate ? `${new Date(selectedEnrollment.student.birthDate).toLocaleDateString()} (${selectedEnrollment.student.age || '?'} yrs)` : '—'],['Gender', selectedEnrollment.student.gender],['Religion', selectedEnrollment.student.religion],['Nationality', selectedEnrollment.student.nationality],['Contact', selectedEnrollment.student.contactNumber],['Email', selectedEnrollment.student.email, true],['Address', selectedEnrollment.student.address, true]]} />
              </InfoSection>
              <InfoSection title="Parents / Guardian" icon={<User className="w-4 h-4"/>}>
                <div className="space-y-3">
                  {[['Father', selectedEnrollment.father],['Mother', selectedEnrollment.mother],['Guardian', selectedEnrollment.guardian]].map(([lbl, p]) => p && p.name && p.name !== 'N/A' && (
                    <div key={lbl}>
                      <p className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wide mb-1.5">{lbl}</p>
                      <InfoGrid fields={[['Name', p.name],['Contact', p.contactNumber],['Occupation', p.occupation || '—']]} />
                    </div>
                  ))}
                </div>
              </InfoSection>
              <InfoSection title="Previous School" icon={<BookOpen className="w-4 h-4"/>}>
                <InfoGrid fields={
                  Object.entries(selectedEnrollment.previousSchool || {})
                    .flatMap(([k, v]) => {
                      if (v === null || v === undefined) return []
                      if (typeof v === 'object' && !Array.isArray(v)) {
                        const label = k.replace(/([A-Z])/g,' $1').replace(/^./,s=>s.toUpperCase())
                        return Object.entries(v)
                          .filter(([,val]) => val)
                          .map(([subK, subV]) => [
                            `${label} — ${subK.replace(/([A-Z])/g,' $1').replace(/^./,s=>s.toUpperCase())}`,
                            String(subV)
                          ])
                      }
                      return [[k.replace(/([A-Z])/g,' $1').replace(/^./,s=>s.toUpperCase()), String(v || '—')]]
                    })
                } />
              </InfoSection>
            </div>
            <div className="px-5 py-4 border-t border-[var(--color-border)] bg-[var(--color-bg-subtle)] flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center gap-3 flex-shrink-0">
              <button onClick={() => setShowModal(false)} className="btn-cancel">Close</button>
              <div className="flex gap-2">
                {canMarkPayment(selectedEnrollment) && (
                  <button onClick={() => handleMarkPayment(selectedEnrollment.id)}
                    className="flex-1 sm:flex-none px-5 py-2.5 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition flex items-center justify-center gap-2 font-medium">
                    <CreditCard className="w-4 h-4" /> Record Payment
                  </button>
                )}
                {canApproveReject(selectedEnrollment) && (
                  <button onClick={() => handleApprove(selectedEnrollment.id)}
                    className="flex-1 sm:flex-none px-5 py-2.5 text-sm bg-green-600 text-white rounded-xl hover:bg-green-700 transition flex items-center justify-center gap-2 font-medium">
                    <CheckCircle className="w-4 h-4" /> Approve Enrollment
                  </button>
                )}
                {selectedEnrollment.status === 'approved' && (
                  <div className="px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                    <CheckCircle className="w-4 h-4" /> Enrollment Approved
                  </div>
                )}
                {selectedEnrollment.status === 'rejected' && (
                  <div className="px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                    <XCircle className="w-4 h-4" /> Enrollment Rejected
                  </div>
                )}
                {selectedEnrollment.status === 'payment_received' && !canApproveReject(selectedEnrollment) && (
                  <div className="px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                    <DollarSign className="w-4 h-4" /> Payment Received — Awaiting Registrar
                  </div>
                )}
                {selectedEnrollment.status === 'pending' && !canMarkPayment(selectedEnrollment) && !canApproveReject(selectedEnrollment) && (
                  <div className="px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">
                    <Clock className="w-4 h-4" /> Awaiting Payment at Accounting
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </ModalPortal>
      )}

      <ConfirmDialog open={confirm.open}
        title={confirm.type === 'approve' ? 'Approve Enrollment' : confirm.type === 'mark_payment' ? 'Record Payment' : 'Reject Enrollment'}
        message={confirm.type === 'approve' ? 'Are you sure you want to approve this enrollment?' : 'Are you sure you want to reject this enrollment?'}
        confirmLabel={confirm.type === 'approve' ? 'Approve' : confirm.type === 'mark_payment' ? 'Record Payment' : 'Reject'}
        confirmClass={confirm.type === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
        loading={actionLoading} onConfirm={confirmAction}
        onCancel={() => setConfirm({ open: false, type: null, id: null })} />

      {/* Fee Assessment Modal */}
      {showFeeModal && feeModalEnroll && (
        <FeeAssessmentModal
          enrollment={feeModalEnroll}
          campusDiscounts={campusDiscounts}
          feeStructure={feeStructure}
          onConfirm={handleFeeAssessmentConfirm}
          onClose={() => { setShowFeeModal(false); setFeeModalEnroll(null) }}
        />
      )}

      {/* Receipt Modal — auto-shown after payment + re-printable from detail drawer */}
      {showReceiptModal && receiptData && (
        <ReceiptModal
          enrollment={receiptData.enrollment}
          paymentData={receiptData.paymentData}
          cashierName={cashierName}
          schoolYear={currentSchoolYear}
          onClose={() => { setShowReceiptModal(false); setReceiptData(null); addToast('Payment recorded — registrar has been notified! ✓', 'success'); window.dispatchEvent(new CustomEvent('cshc_enrollment_updated')); loadBridge() }}
        />
      )}

      {/* Accounting Detail Drawer */}
      {showDetailDrawer && drawerEnrollment && (
        <AccountingDetailDrawer
          enrollment={drawerEnrollment}
          onClose={() => { setShowDetailDrawer(false); setDrawerEnrollment(null) }}
          onPrintReceipt={handleReprintReceipt}
          cashierName={cashierName}
          schoolYear={currentSchoolYear}
        />
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  )
}

// ── Shared sub-components ──────────────────────────────────────────
function Pill({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary dark:bg-primary/20 dark:text-red-300 text-xs font-medium rounded-full">
      {label}<button onClick={onRemove} className="hover:text-[#4a0009] transition"><X className="w-3 h-3" /></button>
    </span>
  )
}
function InfoSection({ title, icon, children }) {
  return (
    <div className="bg-[var(--color-bg-subtle)] rounded-xl p-4">
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2 mb-3">{icon}{title}</h3>
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
          <p className="text-xs text-[var(--color-text-muted)] mb-0.5">{label}</p>
          <p className="text-sm font-medium text-[var(--color-text-primary)]">{value || '—'}</p>
        </div>
      ))}
    </div>
  )
}