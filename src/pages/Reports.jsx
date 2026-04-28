import { useState, useMemo, useRef } from 'react'
import {
  BarChart2, TrendingUp, Download, Calendar, DollarSign,
  Users, CheckCircle, Clock, ChevronDown, BookOpen,
  GraduationCap, ArrowUpRight, FileText, Filter, Search,
  Eye, Printer, X, Receipt, Tag, CreditCard, History
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useAppConfig } from '../context/AppConfigContext'
import { useCampusFilter } from '../context/CampusFilterContext'
import { exportToExcel, exportMultipleSheets } from '../utils/exportToExcel'
import { useToast, ToastContainer, PageSkeleton, ModalPortal } from '../components/UIComponents'
import { CampusBanner, DeptToggle } from '../components/SchoolComponents'
import { BASIC_ED_GROUPS, COLLEGE_YEAR_LEVELS } from '../config/appConfig'
import GroupedSelect from '../components/GroupedSelect'
import DatePicker from '../components/DatePicker'

// ─────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────
const php = n => `₱${(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`

const isCollege = g => g && !['nursery','kindergarten','preparatory','grade 1','grade 2',
  'grade 3','grade 4','grade 5','grade 6','grade 7','grade 8','grade 9','grade 10',
  'grade 11','grade 12'].includes(g.toLowerCase())

// Get date boundaries for a period
function getPeriodRange(period, referenceDate = new Date()) {
  const now = referenceDate
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  if (period === 'daily') {
    return { start: today, end: new Date(today.getTime() + 86400000 - 1), label: 'Today' }
  }
  if (period === 'weekly') {
    const day = today.getDay()
    const start = new Date(today); start.setDate(today.getDate() - day)
    const end   = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23,59,59,999)
    return { start, end, label: 'This Week' }
  }
  if (period === 'monthly') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    return { start, end, label: start.toLocaleString('default', { month: 'long', year: 'numeric' }) }
  }
  if (period === 'quarterly') {
    const q = Math.floor(now.getMonth() / 3)
    const start = new Date(now.getFullYear(), q * 3, 1)
    const end   = new Date(now.getFullYear(), q * 3 + 3, 0, 23, 59, 59, 999)
    const labels = ['Q1 (Jan–Mar)', 'Q2 (Apr–Jun)', 'Q3 (Jul–Sep)', 'Q4 (Oct–Dec)']
    return { start, end, label: `${labels[q]} ${now.getFullYear()}` }
  }
  // custom
  return null
}

function filterByPeriod(transactions, period, customStart, customEnd) {
  if (period === 'all') return transactions
  let range
  if (period === 'custom' && customStart && customEnd) {
    range = {
      start: new Date(customStart),
      end:   new Date(new Date(customEnd).getTime() + 86400000 - 1),
    }
  } else {
    range = getPeriodRange(period)
  }
  if (!range) return transactions
  return transactions.filter(t => {
    const d = new Date(t.date || t.paymentDate || t.lastPaymentDate || t.submittedDate)
    return d >= range.start && d <= range.end
  })
}

// ─────────────────────────────────────────────────────────────────────
// STAT CARD
// ─────────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon, border, cls }) {
  return (
    <div className={`bg-[var(--color-bg-card)] rounded-xl p-4 border-l-4 ${border} shadow-sm`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-[var(--color-text-muted)] font-medium uppercase tracking-wide">{label}</p>
        {icon}
      </div>
      <p className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">{value}</p>
      {sub && <p className={`text-xs mt-1 font-medium ${cls}`}>{sub}</p>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// TRANSACTION DETAIL MODAL
// ─────────────────────────────────────────────────────────────────────
function TxDetailModal({ tx, onClose, onPrint }) {
  if (!tx) return null
  const php = n => `₱${(n||0).toLocaleString('en-PH',{minimumFractionDigits:2})}`
  const fb  = tx.feeBreakdown || {}
  const FEE_LABELS = { tuition:'Tuition Fee', misc:'Misc Fee', lab:'Lab Fee', books:'Books', other:'Other Fees' }
  const txDate = tx.date || tx.paymentDate || tx.lastPaymentDate
  const fmtDate = d => d ? new Date(d).toLocaleDateString('en-PH',{month:'long',day:'numeric',year:'numeric'}) : '—'

  return (
    <ModalPortal>
      <div className="modal-backdrop">
        <div className="bg-[var(--color-bg-card)] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[92vh] flex flex-col shadow-[var(--shadow-modal)]">
          {/* Header */}
          <div className="modal-header">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                <Receipt className="w-4 h-4 text-primary"/>
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-[var(--color-text-primary)] truncate">Transaction Detail</h2>
                <p className="text-xs font-mono text-primary dark:text-red-400">{tx.orNumber || '—'}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] rounded-lg hover:bg-[var(--color-bg-subtle)] transition">
              <X className="w-5 h-5"/>
            </button>
          </div>

          <div className="overflow-y-auto flex-1 p-5 space-y-4">
            {/* Student info */}
            <div className="bg-[var(--color-bg-subtle)] rounded-xl p-4 space-y-2">
              <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5"/> Student & Payment
              </h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {[
                  ['Student Name', tx.studentName],
                  ['Reference #',  tx.refNum],
                  ['Grade / Program', tx.gradeLevel],
                  ['Campus',       tx.campus],
                  ['Student Type', tx.studentType || '—'],
                  ['Semester',     tx.semester    || '—'],
                  ['School Year',  tx.schoolYear  || '—'],
                  ['Status',       tx.subStatus   || '—'],
                ].map(([label, val]) => (
                  <div key={label}>
                    <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
                    <p className="font-medium text-[var(--color-text-primary)]">{val || '—'}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* This payment */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5"/> This Payment
              </h3>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-muted)]">OR Number</span>
                  <span className="font-mono font-semibold text-primary dark:text-red-400">{tx.orNumber || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-muted)]">Date</span>
                  <span className="font-medium text-[var(--color-text-primary)]">{fmtDate(txDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-muted)]">Method</span>
                  <span className="font-medium text-[var(--color-text-primary)]">{tx.method || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-muted)]">Payment Covers</span>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {(tx.paymentFor?.length > 0 ? tx.paymentFor : ['tuition']).map(k => (
                      <span key={k} className="text-[10px] px-1.5 py-0.5 bg-secondary/10 dark:bg-secondary/30 text-secondary dark:text-blue-300 rounded font-medium">
                        {FEE_LABELS[k] || k}
                      </span>
                    ))}
                  </div>
                </div>
                {tx.notes && (
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-muted)]">Notes</span>
                    <span className="text-[var(--color-text-secondary)] text-right max-w-[200px]">{tx.notes}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base border-t border-blue-200 dark:border-blue-700 pt-2 mt-1">
                  <span className="text-[var(--color-text-primary)]">Amount Paid</span>
                  <span className="font-mono text-primary dark:text-red-400">{php(tx.amount)}</span>
                </div>
              </div>
              {tx.discountsApplied?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-blue-200 dark:border-blue-700">
                  {tx.discountsApplied.map((d, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-[10px] font-medium">
                      <Tag className="w-2.5 h-2.5"/> {d.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Fee breakdown */}
            {fb.grandTotal > 0 && (
              <div className="bg-[var(--color-bg-subtle)] rounded-xl p-4">
                <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <BarChart2 className="w-3.5 h-3.5"/> Fee Assessment
                </h3>
                <div className="space-y-1.5 text-xs">
                  {(fb.originalTuition || 0) > 0 && (
                    <div className="flex justify-between text-[var(--color-text-primary)]">
                      <span>Original Tuition</span><span className="font-mono">{php(fb.originalTuition)}</span>
                    </div>
                  )}
                  {(fb.totalDiscount || 0) > 0 && (
                    <div className="flex justify-between text-green-600 dark:text-green-400">
                      <span>Discount</span><span className="font-mono">– {php(fb.totalDiscount)}</span>
                    </div>
                  )}
                  {(fb.lab   || 0) > 0 && <div className="flex justify-between text-[var(--color-text-secondary)]"><span>Lab Fee</span><span className="font-mono">{php(fb.lab)}</span></div>}
                  {(fb.misc  || 0) > 0 && <div className="flex justify-between text-[var(--color-text-secondary)]"><span>Misc Fee</span><span className="font-mono">{php(fb.misc)}</span></div>}
                  {(fb.books || 0) > 0 && <div className="flex justify-between text-[var(--color-text-secondary)]"><span>Books</span><span className="font-mono">{php(fb.books)}</span></div>}
                  <div className="flex justify-between font-bold text-[var(--color-text-primary)] border-t border-[var(--color-border)] pt-2 mt-1 text-sm">
                    <span>Grand Total</span><span className="font-mono text-primary dark:text-red-400">{php(fb.grandTotal)}</span>
                  </div>
                  <div className="flex justify-between text-green-600 dark:text-green-400">
                    <span>Total Paid</span><span className="font-mono">{php(tx.totalFee - tx.balance)}</span>
                  </div>
                  {(tx.balance || 0) > 0 && (
                    <div className="flex justify-between text-amber-600 dark:text-amber-400 font-semibold">
                      <span>Remaining Balance</span><span className="font-mono">{php(tx.balance)}</span>
                    </div>
                  )}
                  {(tx.balance || 0) <= 0 && tx.totalFee > 0 && (
                    <p className="text-green-600 dark:text-green-400 font-semibold text-center pt-1">✓ Fully Paid</p>
                  )}
                </div>
              </div>
            )}

            {/* All payment history */}
            {tx.allPayments?.length > 1 && (
              <div>
                <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide flex items-center gap-1.5 mb-2">
                  <History className="w-3.5 h-3.5"/> Full Payment History
                </h3>
                <div className="space-y-2">
                  {tx.allPayments.map((h, i) => {
                    const isThis = h.orNumber && h.orNumber === tx.orNumber
                    return (
                      <div key={i} className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs ${isThis ? 'bg-primary/10 dark:bg-primary/20 border border-primary/30' : 'bg-[var(--color-bg-subtle)]'}`}>
                        <div>
                          <p className={`font-mono font-semibold ${isThis ? 'text-primary dark:text-red-400' : 'text-[var(--color-text-secondary)]'}`}>
                            {h.orNumber || '—'}
                            {isThis && <span className="ml-1.5 text-[10px] bg-primary text-white px-1.5 py-0.5 rounded-full">This</span>}
                          </p>
                          <p className="text-[var(--color-text-muted)] mt-0.5">
                            {h.method || '—'} · {h.date ? new Date(h.date).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'}) : '—'}
                          </p>
                        </div>
                        <span className="font-mono font-bold text-green-600 dark:text-green-400">{php(h.amount)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="modal-footer">
            <button onClick={onClose}
              className="btn-cancel">
              Close
            </button>
            <button onClick={() => onPrint(tx)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm bg-primary text-white rounded-xl hover:bg-[#4a0009] transition font-semibold shadow-sm">
              <Printer className="w-4 h-4"/> Print Receipt
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}

// ─────────────────────────────────────────────────────────────────────
// TRANSACTION RECEIPT MODAL (print-ready)
// ─────────────────────────────────────────────────────────────────────
function TxReceiptModal({ tx, cashierName, schoolYear, onClose }) {
  const receiptRef = useRef(null)
  if (!tx) return null
  const php = n => `₱${(n||0).toLocaleString('en-PH',{minimumFractionDigits:2})}`
  const fb  = tx.feeBreakdown || {}
  const FEE_LABELS = { tuition:'Tuition Fee', misc:'Misc Fee', lab:'Lab Fee', books:'Books', other:'Other Fees' }
  const txDate = tx.date || tx.paymentDate || tx.lastPaymentDate
  const dateStr = txDate ? new Date(txDate).toLocaleDateString('en-PH',{year:'numeric',month:'long',day:'numeric'}) : '—'
  const totalPaidSoFar = tx.totalFee - tx.balance

  const ReceiptCopy = ({ copyLabel }) => (
    <div className="receipt-copy border border-gray-300 rounded-lg p-5 bg-white text-gray-900" style={{fontFamily:'Georgia,serif',fontSize:'13px'}}>
      {/* Header */}
      <div className="text-center mb-3 pb-3 border-b-2 border-double border-gray-400">
        <p className="font-bold text-sm uppercase tracking-wide" style={{color:'var(--color-primary)'}}>{'Cebu Sacred Heart College, Inc.'}</p>
        <p className="text-xs text-gray-500">{tx.campus}</p>
        <p className="text-xs text-gray-500">School Year {schoolYear}</p>
        <div className="mt-2 inline-block border border-gray-400 px-3 py-0.5 rounded text-xs font-bold uppercase tracking-wider text-gray-700">
          Official Receipt
        </div>
      </div>

      {/* OR + Date */}
      <div className="flex justify-between text-xs mb-3">
        <div><span className="text-gray-500">OR No.: </span><span className="font-bold font-mono">{tx.orNumber || '—'}</span></div>
        <div className="text-right"><span className="text-gray-500">Date: </span><span className="font-semibold">{dateStr}</span></div>
      </div>

      {/* Student info */}
      <div className="bg-[var(--color-bg-subtle)] rounded p-3 mb-3 text-xs space-y-1">
        <div className="flex gap-2"><span className="text-gray-500 w-20 flex-shrink-0">Student:</span><span className="font-bold">{tx.studentName}</span></div>
        <div className="flex gap-2"><span className="text-gray-500 w-20 flex-shrink-0">Ref. No.:</span><span className="font-mono">{tx.refNum}</span></div>
        <div className="flex gap-2"><span className="text-gray-500 w-20 flex-shrink-0">Program:</span><span>{tx.gradeLevel}</span></div>
        {tx.semester && <div className="flex gap-2"><span className="text-gray-500 w-20 flex-shrink-0">Semester:</span><span>{tx.semester}</span></div>}
      </div>

      {/* Fee breakdown */}
      <table className="w-full text-xs mb-3">
        <thead><tr className="border-b border-gray-300">
          <th className="text-left py-1 text-gray-500 font-normal">Description</th>
          <th className="text-right py-1 text-gray-500 font-normal">Amount</th>
        </tr></thead>
        <tbody>
          {fb.tuitionAfterDiscount > 0 && <tr><td className="py-1">Tuition Fee{fb.totalDiscount > 0 ? ' (after discount)' : ''}</td><td className="py-1 text-right font-mono">{php(fb.tuitionAfterDiscount ?? fb.originalTuition ?? 0)}</td></tr>}
          {(fb.lab   || 0) > 0 && <tr><td className="py-1 text-gray-600">Lab Fee</td><td className="py-1 text-right font-mono">{php(fb.lab)}</td></tr>}
          {(fb.misc  || 0) > 0 && <tr><td className="py-1 text-gray-600">Misc Fee</td><td className="py-1 text-right font-mono">{php(fb.misc)}</td></tr>}
          {(fb.books || 0) > 0 && <tr><td className="py-1 text-gray-600">Books</td><td className="py-1 text-right font-mono">{php(fb.books)}</td></tr>}
          {!fb.grandTotal && <tr><td className="py-1">{(tx.paymentFor?.length > 0 ? tx.paymentFor : ['tuition']).map(k => FEE_LABELS[k]||k).join(', ')}</td><td className="py-1 text-right font-mono">{php(tx.amount)}</td></tr>}
          <tr><td className="py-1 text-gray-500">Payment Method</td><td className="py-1 text-right">{tx.method || '—'}</td></tr>
          {tx.notes && <tr><td className="py-1 text-gray-500">Notes</td><td className="py-1 text-right text-gray-600">{tx.notes}</td></tr>}
        </tbody>
      </table>

      {/* Totals */}
      <div className="border-t border-gray-300 pt-2 mb-3 space-y-1 text-xs">
        {tx.totalFee > 0 && <div className="flex justify-between"><span className="text-gray-500">Total Assessment:</span><span className="font-mono">{php(tx.totalFee)}</span></div>}
        <div className="flex justify-between font-bold text-sm border-t border-gray-300 pt-1 mt-1">
          <span style={{color:'var(--color-primary)'}}>Amount This Payment:</span>
          <span className="font-mono" style={{color:'var(--color-primary)'}}>{php(tx.amount)}</span>
        </div>
        {tx.totalFee > 0 && <div className="flex justify-between"><span className="text-gray-500">Total Paid to Date:</span><span className="font-mono font-semibold text-green-700">{php(totalPaidSoFar)}</span></div>}
        {tx.totalFee > 0 && <div className="flex justify-between"><span className="text-gray-500">Remaining Balance:</span><span className={`font-mono font-semibold ${(tx.balance||0) > 0 ? 'text-red-600' : 'text-green-700'}`}>{(tx.balance||0) > 0 ? php(tx.balance) : '₱0.00 — Fully Paid ✓'}</span></div>}
      </div>

      {/* Signatures */}
      <div className="border-t border-dashed border-gray-300 pt-3 text-xs text-center text-gray-500">
        <div className="flex justify-between items-end mt-4">
          <div className="text-center">
            <div className="border-t border-gray-400 pt-1 w-32">
              <p className="font-semibold text-gray-700">{cashierName || 'Accounting Officer'}</p>
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
    w.document.write(`<!DOCTYPE html><html><head><title>Receipt — ${tx.studentName}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Georgia, serif; font-size: 13px; color: #111; background: #fff; }
        .print-page { width: 100%; padding: 16px; }
        .receipt-pair { display: flex; gap: 16px; }
        .receipt-copy { flex: 1; border: 1px solid #999; border-radius: 8px; padding: 20px; }
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
          <div className="modal-header">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <Receipt className="w-4 h-4 text-green-600 dark:text-green-400"/>
              </div>
              <div>
                <h2 className="text-sm font-bold text-[var(--color-text-primary)]">Print Receipt</h2>
                <p className="text-xs text-[var(--color-text-muted)]">{tx.studentName} · OR# {tx.orNumber || '—'}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] rounded-lg hover:bg-[var(--color-bg-subtle)] transition">
              <X className="w-5 h-5"/>
            </button>
          </div>
          <div className="overflow-y-auto flex-1 p-5" ref={receiptRef}>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1"><ReceiptCopy copyLabel="School Copy"/></div>
              <div className="hidden sm:block w-px border-l-2 border-dashed border-[var(--color-border)]"/>
              <div className="flex-1"><ReceiptCopy copyLabel="Student Copy"/></div>
            </div>
          </div>
          <div className="modal-footer">
            <button onClick={onClose}
              className="btn-cancel">
              Close
            </button>
            <button onClick={handlePrint}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm bg-primary text-white rounded-xl hover:bg-[#4a0009] transition font-semibold shadow-sm">
              <Printer className="w-4 h-4"/> Print (2 copies)
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}

// ─────────────────────────────────────────────────────────────────────
// TRANSACTION ROW
// ─────────────────────────────────────────────────────────────────────
function TxRow({ tx, onView, onPrint }) {
  const d = new Date(tx.date || tx.paymentDate || tx.lastPaymentDate)
  const fmt = d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
  const FEE_LABELS = {
    tuition: 'Tuition Fee',
    misc:    'Misc Fee',
    lab:     'Lab Fee',
    books:   'Books',
    other:   'Other Fees',
  }
  const feeTags = tx.paymentFor && tx.paymentFor.length > 0
    ? tx.paymentFor.map(k => FEE_LABELS[k] || k)
    : ['Tuition Fee']
  return (
    <tr className="hover:bg-[var(--color-bg-subtle)]/30 transition">
      <td className="px-4 py-3 text-xs font-mono text-primary dark:text-red-400">{tx.orNumber || '—'}</td>
      <td className="px-4 py-3 text-sm font-medium text-[var(--color-text-primary)]">{tx.studentName}</td>
      <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">{tx.gradeLevel}</td>
      <td className="px-4 py-3">
        {feeTags.length > 0
          ? <div className="flex flex-wrap gap-1">
              {feeTags.map(tag => (
                <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-secondary/10 dark:bg-secondary/30 text-secondary dark:text-blue-300 rounded font-medium">
                  {tag}
                </span>
              ))}
            </div>
          : <span className="text-xs text-[var(--color-text-muted)]">—</span>
        }
      </td>
      <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">{tx.method || '—'}</td>
      <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">{fmt}</td>
      <td className="px-4 py-3 text-sm font-bold text-green-600 dark:text-green-400 text-right font-mono">{php(tx.amount)}</td>
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onView(tx)}
            className="inline-flex items-center gap-1 text-xs px-2 py-1.5 text-primary dark:text-red-400 hover:bg-primary/10 dark:hover:bg-primary/20 rounded-lg font-medium transition"
            title="View details">
            <Eye className="w-3.5 h-3.5"/> Details
          </button>
          <button
            onClick={() => onPrint(tx)}
            className="inline-flex items-center gap-1 text-xs px-2 py-1.5 bg-primary text-white hover:bg-[#4a0009] rounded-lg font-medium transition"
            title="Print receipt">
            <Printer className="w-3.5 h-3.5"/> Receipt
          </button>
        </div>
      </td>
    </tr>
  )
}

// ─────────────────────────────────────────────────────────────────────
// GRADE BREAKDOWN TABLE
// ─────────────────────────────────────────────────────────────────────
function GradeBreakdownTable({ rows }) {
  if (!rows.length) return (
    <div className="text-center py-8 text-[var(--color-text-muted)] text-sm">No payment data for this period</div>
  )
  return (
    <div className="min-w-0">
    <div className="overflow-x-auto">
      <table className="w-full min-w-[400px]">
        <thead className="bg-[var(--color-bg-subtle)]">
          <tr>
            {['Grade / Program', 'Students', 'Fully Paid', 'Partial', 'Collected'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-[var(--color-bg-subtle)]/30 transition">
              <td className="px-4 py-3 text-sm font-medium text-[var(--color-text-primary)]">{r.label}</td>
              <td className="px-4 py-3 text-sm text-[var(--color-text-secondary)]">{r.students}</td>
              <td className="px-4 py-3 text-sm text-green-600 dark:text-green-400 font-medium">{r.paid}</td>
              <td className="px-4 py-3 text-sm text-amber-600 dark:text-amber-400">{r.partial}</td>
              <td className="px-4 py-3 text-sm font-semibold text-green-600 dark:text-green-400">{php(r.collected)}</td>
            </tr>
          ))}
          {/* Totals row */}
          <tr className="bg-[var(--color-bg-subtle)]/50 font-bold">
            <td className="px-4 py-3 text-sm text-[var(--color-text-primary)]">Total</td>
            <td className="px-4 py-3 text-sm text-[var(--color-text-primary)]">{rows.reduce((s,r)=>s+r.students,0)}</td>
            <td className="px-4 py-3 text-sm text-green-600 dark:text-green-400">{rows.reduce((s,r)=>s+r.paid,0)}</td>
            <td className="px-4 py-3 text-sm text-amber-600 dark:text-amber-400">{rows.reduce((s,r)=>s+r.partial,0)}</td>
            <td className="px-4 py-3 text-sm text-green-600 dark:text-green-400">{php(rows.reduce((s,r)=>s+r.collected,0))}</td>
          </tr>
        </tbody>
      </table>
    </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// PAYMENT METHOD BREAKDOWN
// ─────────────────────────────────────────────────────────────────────
function MethodBreakdown({ transactions }) {
  const groups = {}
  transactions.forEach(tx => {
    const m = tx.method || 'Unknown'
    if (!groups[m]) groups[m] = { count: 0, total: 0 }
    groups[m].count++
    groups[m].total += tx.amount || 0
  })
  const total = transactions.reduce((s, tx) => s + (tx.amount || 0), 0)

  return (
    <div className="space-y-3">
      {Object.entries(groups).map(([method, data]) => {
        const pct = total > 0 ? Math.round((data.total / total) * 100) : 0
        return (
          <div key={method}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-lg">{method === 'Cash' ? '💵' : '🏦'}</span>
                <span className="text-sm font-medium text-[var(--color-text-primary)]">{method}</span>
                <span className="text-xs text-[var(--color-text-muted)]">{data.count} transaction{data.count !== 1 ? 's' : ''}</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-[var(--color-text-primary)]">{php(data.total)}</span>
                <span className="text-xs text-[var(--color-text-muted)] ml-2">{pct}%</span>
              </div>
            </div>
            <div className="w-full bg-[var(--color-bg-subtle)] rounded-full h-2">
              <div className="bg-primary h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }} />
            </div>
          </div>
        )
      })}
      {Object.keys(groups).length === 0 && (
        <p className="text-sm text-[var(--color-text-muted)] text-center py-4">No transactions in this period</p>
      )}
    </div>
  )
}


// ─────────────────────────────────────────────────────────────────────
// TRANSACTION DETAIL MODAL
// ─────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────
// MAIN REPORTS PAGE
// ─────────────────────────────────────────────────────────────────────
export default function Reports() {
  const { user } = useAuth()
  const { activeCampuses, currentSchoolYear, feeStructure } = useAppConfig()

  // Cashier name — campus-scoped (from accounting's settings)
  const cashierName = (() => {
    try {
      const campusKey = user?.campus?.replace(/ (City |)Campus$/i, '').replace(/[^a-zA-Z]/g, '') || 'all'
      const cfg = JSON.parse(localStorage.getItem(`cshc_campus_cfg_${campusKey}`) || '{}')
      return cfg.cashierName || user?.name || 'Accounting Officer'
    } catch { return user?.name || 'Accounting Officer' }
  })()
  const { campusFilter } = useCampusFilter()
  const { toasts, addToast, removeToast } = useToast()

  const [period,      setPeriod]      = useState('monthly')
  const [deptFilter,  setDeptFilter]  = useState('all')   // 'all' | 'basic_ed' | 'college'
  const [feeTypeFilter, setFeeTypeFilter] = useState('all')  // 'all' | 'tuition' | 'misc' | 'lab' | 'books'
  const [gradeFilter, setGradeFilter] = useState('all')   // 'all' | specific grade/program
  const [customStart, setCustomStart] = useState('')
  const [customEnd,   setCustomEnd]   = useState('')
  const [showCustom,  setShowCustom]  = useState(false)
  const [txSearch,    setTxSearch]    = useState('')
  const [selectedTx,  setSelectedTx]  = useState(null)   // tx open in detail modal
  const [receiptTx,   setReceiptTx]   = useState(null)   // tx open in receipt modal

  const isAccountingLocked = user?.role === 'accounting' && user?.campus !== 'all'
  const effectiveCampus    = isAccountingLocked ? user.campus : campusFilter

  // Load all payment submissions from localStorage bridge
  const allPayments = useMemo(() => {
    try {
      const subs = JSON.parse(localStorage.getItem('cshc_submissions') || '[]')
      return subs.filter(s =>
        // Must have payment status
        (s.status === 'payment_received' || s.status === 'approved') &&
        // Must have an actual recorded payment (amount > 0 AND paymentHistory exists)
        (s.amountPaid > 0 || (s.paymentHistory && s.paymentHistory.length > 0)) &&
        // Campus scope
        (effectiveCampus === 'all' || s.enrollment?.campus === effectiveCampus)
      )
    } catch { return [] }
  }, [effectiveCampus])

  // Extract all individual transactions from payment history
  const allTransactions = useMemo(() => {
    const txs = []
    allPayments.forEach(sub => {
      const name = sub.student?.fullName ||
        `${(sub.student?.lastName || '').toUpperCase()}, ${(sub.student?.firstName || '').toUpperCase()}`
      const grade  = sub.enrollment?.gradeLevel || ''
      const campus = sub.enrollment?.campus     || ''
      // Use paymentHistory array if available, else create one entry
      const hist = sub.paymentHistory?.length
        ? sub.paymentHistory
        : sub.amountPaid > 0
          ? [{ amount: sub.amountPaid, method: sub.paymentMethod, date: sub.lastPaymentDate || sub.updatedAt || sub.submittedDate, orNumber: sub.paymentHistory?.[0]?.orNumber }]
          : []
      hist.forEach(h => txs.push({
        ...h,
        paymentFor:       h.paymentFor || [],   // what this payment covers
        studentName:      name,
        gradeLevel:       grade,
        campus,
        refNum:           sub.referenceNumber,
        totalFee:         sub.totalFee         || 0,
        balance:          sub.balance          || 0,
        subStatus:        sub.status,
        // Full fee breakdown for detail view
        feeBreakdown:     sub.feeBreakdown     || null,
        discountsApplied: sub.discountsApplied || [],
        semester:         sub.enrollment?.semester    || '',
        studentType:      sub.enrollment?.studentType || '',
        schoolYear:       sub.enrollment?.schoolYear  || '',
        allPayments:      sub.paymentHistory   || [],
        enrollmentFee:    sub.feeBreakdown?.enrollment || 0,
      }))
    })
    return txs
  }, [allPayments])

  // Filter transactions by selected period
  const periodRange   = period !== 'custom' ? getPeriodRange(period) : null
  const periodLabel   = period === 'custom'
    ? (customStart && customEnd ? `${customStart} to ${customEnd}` : 'Custom Range')
    : periodRange?.label || ''

  const filteredTxs = useMemo(() => {
    let txs = filterByPeriod(allTransactions, period, customStart, customEnd)
    if (feeTypeFilter !== 'all') {
      txs = txs.filter(tx => {
        // Use the paymentFor array recorded by accounting at time of payment
        if (tx.paymentFor && tx.paymentFor.length > 0) {
          return tx.paymentFor.includes(feeTypeFilter)
        }
        // Fallback for old records without paymentFor: default to tuition
        return feeTypeFilter === 'tuition'
      })
    }
    return txs
  }, [allTransactions, period, customStart, customEnd, feeTypeFilter])

  // Stats for the filtered period
  const totalCollected  = filteredTxs.reduce((s, tx) => s + (tx.amount || 0), 0)
  const uniqueStudents  = new Set(filteredTxs.map(tx => tx.refNum)).size
  const fullyPaid       = allPayments.filter(s => {
    const hist = s.paymentHistory?.length
      ? s.paymentHistory
      : s.amountPaid > 0 ? [{ date: s.lastPaymentDate || s.submittedDate }] : []
    return s.balance <= 0 && filterByPeriod(hist, period, customStart, customEnd).length > 0
  }).length
  const partialPaid     = uniqueStudents - fullyPaid
  const cashTotal       = filteredTxs.filter(t => t.method === 'Cash').reduce((s,t)=>s+(t.amount||0),0)
  const bankTotal       = filteredTxs.filter(t => t.method !== 'Cash' && t.method).reduce((s,t)=>s+(t.amount||0),0)

  // Build grade option lists for filter dropdowns
  const basicEdGrades  = BASIC_ED_GROUPS.flatMap(g => g.options || g.grades || [])
  // College options: build from fee structure filtered by CURRENT campus
  const collegeProgramsFromFees = [...new Set(
    (feeStructure || [])
      .filter(f => f.program &&
        (effectiveCampus === 'all' || f.campus === effectiveCampus)
      )
      .map(f => `${f.program} - ${f.yearLevel}`)
  )]
  const collegeProgramsFromData = [...new Set(
    allPayments.map(s => s.enrollment?.gradeLevel || '').filter(g => isCollege(g))
  )]
  // Merge both, deduplicate, sort by program then year level
  const yearOrder = { '1st Year': 1, '2nd Year': 2, '3rd Year': 3, '4th Year': 4 }
  const collegePrograms = [...new Set([...collegeProgramsFromFees, ...collegeProgramsFromData])]
    .sort((a, b) => {
      const [progA, yrA] = a.split(' - ')
      const [progB, yrB] = b.split(' - ')
      if (progA !== progB) return progA.localeCompare(progB)
      return (yearOrder[yrA] || 9) - (yearOrder[yrB] || 9)
    })

  // Reset gradeFilter when dept changes
  const handleDeptChange = (dept) => {
    setDeptFilter(dept)
    setGradeFilter('all')
  }

  // Grade level breakdown — respects dept + grade filters
  const gradeRows = useMemo(() => {
    const map = {}
    allPayments.forEach(sub => {
      const grade = sub.enrollment?.gradeLevel || 'Unknown'
      // Dept filter
      if (deptFilter === 'basic_ed' && isCollege(grade)) return
      if (deptFilter === 'college'  && !isCollege(grade)) return
      // Grade filter
      if (gradeFilter !== 'all' && grade !== gradeFilter) return

      if (!map[grade]) map[grade] = { students: 0, paid: 0, partial: 0, collected: 0, outstanding: 0 }
      const r = map[grade]
      r.students++
      const paidInPeriod = filterByPeriod(
        sub.paymentHistory || (sub.amountPaid > 0 ? [{ amount: sub.amountPaid, date: sub.lastPaymentDate || sub.submittedDate }] : []),
        period, customStart, customEnd
      ).reduce((s, h) => s + (h.amount || 0), 0)
      r.collected   += paidInPeriod
      r.outstanding += sub.balance || 0
      if (sub.balance <= 0) r.paid++; else r.partial++
    })
    return Object.entries(map)
      .map(([label, d]) => ({ label, ...d }))
      .filter(r => r.collected > 0 || r.outstanding > 0)
      .sort((a, b) => b.collected - a.collected)
  }, [allPayments, period, customStart, customEnd, deptFilter, gradeFilter])

  // Export
  const handleExport = () => {
    const summaryData = [{
      'Period':            periodLabel,
      'Campus':            effectiveCampus === 'all' ? 'All Campuses' : effectiveCampus,
      'Total Collected':   totalCollected,
      'Transactions':      filteredTxs.length,
      'Students':          uniqueStudents,
      'Fully Paid':        fullyPaid,
      'Partial':           partialPaid,
      'Cash':              cashTotal,
      'Bank Transfer':     bankTotal,
    }]

    const txData = filteredTxs.map(tx => ({
      'OR Number':     tx.orNumber || '—',
      'Student Name':  tx.studentName,
      'Grade/Program': tx.gradeLevel,
      'Method':        tx.method || '—',
      'Date':          new Date(tx.date || tx.paymentDate || '').toLocaleDateString('en-PH'),
      'Amount':        tx.amount || 0,
    }))

    const breakdownData = gradeRows.map(r => ({
      'Grade/Program': r.label,
      'Students':      r.students,
      'Fully Paid':    r.paid,
      'Partial':       r.partial,
      'Collected':     r.collected,

    }))

    exportMultipleSheets([
      { data: summaryData,   sheetName: 'Summary'     },
      { data: breakdownData, sheetName: 'By Grade'    },
      { data: txData,        sheetName: 'Transactions' },
    ], `CSHC_Income_Report_${period}_${new Date().toISOString().split('T')[0]}`)
    addToast('Income report exported!', 'success')
  }

  return (
    <div className="animate-fade-in space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)] flex items-center gap-2">
            <BarChart2 className="w-7 h-7 text-primary"/> Income Reports
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {currentSchoolYear} · {isAccountingLocked ? user.campus : 'All Campuses'}
          </p>
        </div>
        <button onClick={handleExport}
          className="self-start flex items-center gap-1.5 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium shadow-sm">
          <Download className="w-4 h-4"/> Export Report
        </button>
      </div>

      <CampusBanner user={user} />

      {/* Period selector */}
      <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary flex-shrink-0"/>
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">Report Period:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { val: 'daily',     label: 'Today'    },
              { val: 'weekly',    label: 'This Week' },
              { val: 'monthly',   label: 'This Month'},
              { val: 'quarterly', label: 'This Quarter'},
              { val: 'all',       label: 'All Time'  },
              { val: 'custom',    label: 'Custom'    },
            ].map(opt => (
              <button key={opt.val}
                onClick={() => { setPeriod(opt.val); setShowCustom(opt.val === 'custom') }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition
                  ${period === opt.val
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)]'
                  }`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom date range */}
        {showCustom && (
          <div className="flex flex-col sm:flex-row gap-3 mt-3 pt-3 border-t border-[var(--color-border)]">
            <div className="flex-1">
              <DatePicker label="From" value={customStart} onChange={setCustomStart} placeholder="Start date" />
            </div>
            <div className="flex-1">
              <DatePicker label="To" value={customEnd} onChange={setCustomEnd} placeholder="End date" />
            </div>
          </div>
        )}

        {/* Period label */}
        <div className="mt-2 flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
          <Filter className="w-3 h-3"/>
          Showing: <span className="font-semibold text-primary dark:text-red-400">{periodLabel}</span>
          {filteredTxs.length > 0 && <span>· {filteredTxs.length} transaction{filteredTxs.length !== 1 ? 's' : ''}</span>}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Total Collected" value={php(totalCollected)}
          sub={`${filteredTxs.length} transaction${filteredTxs.length !== 1 ? 's' : ''}`}
          icon={<TrendingUp className="w-5 h-5 text-green-500"/>}
          border="border-green-500" cls="text-green-600 dark:text-green-400"/>
        <StatCard label="Students Paid" value={uniqueStudents}
          sub="in selected period"
          icon={<Users className="w-5 h-5 text-blue-500"/>}
          border="border-blue-500" cls="text-blue-600 dark:text-blue-400"/>
        <StatCard label="Fully Paid" value={fullyPaid}
          sub={`${uniqueStudents > 0 ? Math.round(fullyPaid/uniqueStudents*100) : 0}% of students`}
          icon={<CheckCircle className="w-5 h-5 text-emerald-500"/>}
          border="border-emerald-500" cls="text-emerald-600 dark:text-emerald-400"/>
        <StatCard label="Partial Payment" value={Math.max(0, partialPaid)}
          sub="balance still due"
          icon={<Clock className="w-5 h-5 text-amber-500"/>}
          border="border-amber-500" cls="text-amber-600 dark:text-amber-400"/>
      </div>

      {/* Main content — 2 col on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Grade level breakdown — 2/3 width */}
        <div className="lg:col-span-2 bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--color-border)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary"/>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Income by Grade Level / Program</h3>
              </div>
              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Department toggle */}
                <DeptToggle value={deptFilter} onChange={handleDeptChange} />
                {/* Grade / Program dropdown — visible when dept is selected */}
                {deptFilter !== 'all' && (
                  <GroupedSelect
                    value={gradeFilter}
                    onChange={setGradeFilter}
                    allLabel={`All ${deptFilter === 'basic_ed' ? 'Grades' : 'Year Levels'}`}
                    groups={
                      deptFilter === 'basic_ed'
                        ? BASIC_ED_GROUPS.map(group => ({
                            label: group.label,
                            options: (group.options || group.grades || []).map(g => ({ value: g, label: g })),
                          }))
                        : [{ label: 'College Programs', options: collegePrograms.map(p => ({ value: p, label: p })) }]
                    }
                  />
                )}
                {/* Clear filter */}
                {(deptFilter !== 'all' || gradeFilter !== 'all') && (
                  <button onClick={() => { setDeptFilter('all'); setGradeFilter('all') }}
                    className="text-xs px-2 py-1 bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)] rounded-lg hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 transition flex items-center gap-1">
                    ✕ Clear
                  </button>
                )}
              </div>
            </div>
            {/* Active filter label */}
            {(deptFilter !== 'all' || gradeFilter !== 'all') && (
              <p className="text-xs text-[var(--color-text-muted)] mt-2 flex items-center gap-1">
                <Filter className="w-3 h-3"/>
                Filtered by: <span className="font-semibold text-primary dark:text-red-400 ml-0.5">
                  {deptFilter === 'basic_ed' ? 'Basic Education' : 'College'}
                  {gradeFilter !== 'all' ? ` · ${gradeFilter}` : ''}
                </span>
                <span className="ml-1 text-[var(--color-text-muted)]">
                  · {gradeRows.reduce((s,r)=>s+r.students,0)} student{gradeRows.reduce((s,r)=>s+r.students,0)!==1?'s':''}
                </span>
              </p>
            )}
          </div>
          <GradeBreakdownTable rows={gradeRows}/>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Payment method breakdown */}
          <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="w-4 h-4 text-primary"/>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">By Payment Method</h3>
            </div>
            <MethodBreakdown transactions={filteredTxs}/>
          </div>

          {/* Quick totals */}
          <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <ArrowUpRight className="w-4 h-4 text-primary"/>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Quick Summary</h3>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Cash collected',         val: php(cashTotal),    cls: 'text-green-600 dark:text-green-400' },
                { label: 'Bank Transfer collected', val: php(bankTotal),   cls: 'text-blue-600 dark:text-blue-400' },
                { label: 'Total collected',         val: php(totalCollected), cls: 'text-[var(--color-text-primary)] font-bold text-base' },
              ].map(({ label, val, cls }) => (
                <div key={label} className="flex justify-between items-center">
                  <span className="text-xs text-[var(--color-text-muted)]">{label}</span>
                  <span className={`text-sm font-semibold font-mono ${cls}`}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Individual Transactions */}
      <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--color-border)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary"/>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Individual Transactions</h3>
              <span className="text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-subtle)] px-2 py-0.5 rounded-full">
                {filteredTxs.length}
              </span>
            </div>
            {/* Fee type filter */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-[var(--color-text-muted)] font-medium">Filter by fee:</span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { val: 'all',     label: 'All'      },
                  { val: 'tuition', label: 'Tuition'  },
                  { val: 'misc',    label: 'Misc Fee'  },
                  { val: 'lab',     label: 'Lab Fee'   },
                  { val: 'books',   label: 'Books'     },
                ].map(opt => (
                  <button key={opt.val}
                    onClick={() => setFeeTypeFilter(opt.val)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition
                      ${feeTypeFilter === opt.val
                        ? 'bg-secondary text-white dark:bg-secondary'
                        : 'bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)]'
                      }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {/* Search + active filter label row */}
          <div className="flex flex-col sm:flex-row gap-2 mt-3 pt-3 border-t border-[var(--color-border)]">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)]"/>
              <input
                value={txSearch} onChange={e => setTxSearch(e.target.value)}
                placeholder="Search student name or OR #..."
                className="w-full pl-8 pr-3 py-2 text-xs border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:border-primary transition"
              />
            </div>
            {(txSearch || feeTypeFilter !== 'all') && (
              <button
                onClick={() => { setTxSearch(''); setFeeTypeFilter('all') }}
                className="text-xs px-3 py-1.5 text-[var(--color-text-muted)] hover:text-red-500 border border-[var(--color-border)] rounded-lg transition whitespace-nowrap">
                ✕ Clear filters
              </button>
            )}
          </div>
          {feeTypeFilter !== 'all' && (
            <p className="text-xs text-[var(--color-text-muted)] mt-2 flex items-center gap-1">
              <Filter className="w-3 h-3"/>
              Showing transactions with <span className="font-semibold text-secondary dark:text-blue-300 ml-0.5">{
                { tuition: 'Tuition', misc: 'Misc Fee', lab: 'Lab Fee', books: 'Books' }[feeTypeFilter]
              }</span> component
            </p>
          )}
        </div>
        {(() => {
          const q = txSearch.toLowerCase()
          const displayTxs = [...filteredTxs]
            .sort((a, b) => new Date(b.date || b.paymentDate || 0) - new Date(a.date || a.paymentDate || 0))
            .filter(tx =>
              !q ||
              (tx.studentName || '').toLowerCase().includes(q) ||
              (tx.orNumber || '').toLowerCase().includes(q)
            )
          const displayTotal = displayTxs.reduce((s, tx) => s + (tx.amount || 0), 0)
          return displayTxs.length === 0 ? (
          <div className="py-12 text-center">
            <BarChart2 className="w-10 h-10 text-[var(--color-text-muted)] opacity-50 mx-auto mb-3"/>
            <p className="text-sm text-[var(--color-text-muted)]">No transactions found for this period</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">Try selecting a different period or check that payments have been recorded</p>
          </div>
        ) : (
          <div className="min-w-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead className="bg-[var(--color-bg-subtle)]">
                <tr>
                  {['OR Number', 'Student Name', 'Grade / Program', 'Payment Covers', 'Method', 'Date', 'Amount', 'Actions'].map(h => (
                    <th key={h} className={`px-4 py-3 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide ${h === 'Amount' ? 'text-right' : 'text-left'}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {displayTxs.map((tx, i) => <TxRow key={i} tx={tx} onView={t => setSelectedTx(t)} onPrint={t => setReceiptTx(t)}/>)}
              </tbody>
              <tfoot className="bg-[var(--color-bg-subtle)] border-t-2 border-[var(--color-border)]">
                <tr>
                  <td colSpan={7} className="px-4 py-3 text-sm font-bold text-[var(--color-text-primary)]">
                    {txSearch ? `Showing ${displayTxs.length} of ${filteredTxs.length} transactions` : 'Total for period'}
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-green-600 dark:text-green-400 text-right font-mono">
                    {php(displayTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          </div>
        )
        })()}
      </div>

      {/* Transaction Detail Modal */}
      {selectedTx && (
        <TxDetailModal
          tx={selectedTx}
          onClose={() => setSelectedTx(null)}
          onPrint={(tx) => { setSelectedTx(null); setReceiptTx(tx) }}
        />
      )}

      {/* Transaction Receipt Modal */}
      {receiptTx && (
        <TxReceiptModal
          tx={receiptTx}
          cashierName={cashierName}
          schoolYear={currentSchoolYear}
          onClose={() => setReceiptTx(null)}
        />
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast}/>
    </div>
  )
}