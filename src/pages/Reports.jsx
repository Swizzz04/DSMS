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
import { exportMultipleSheets } from '../utils/exportToExcel'
import { useToast, ToastContainer, PageSkeleton, ModalPortal } from '../components/UIComponents'
import { DeptToggle } from '../components/SchoolComponents'
import GroupedSelect from '../components/GroupedSelect'
import DatePicker from '../components/DatePicker'

// ─────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────
const php = n => `₱${(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`

// One list of fee components for every tag, filter chip and receipt line.
const FEE_LABELS = { tuition: 'Tuition Fee', misc: 'Misc Fee', lab: 'Lab Fee', books: 'Books', other: 'Other Fees' }
const FEE_FILTER_KEYS = ['tuition', 'misc', 'lab', 'books']

// Selected state for filter chips. Brand colours cannot be trusted here: the default
// primary is near-white and a school's saved secondary can equal the card colour in dark
// mode, which hides the chip. Inverting the page's own text/card colours is always readable.
const CHIP_ACTIVE = 'bg-[var(--color-text-primary)] text-[var(--color-bg-card)] shadow-sm'

// A transaction's date lives under different keys depending on how it was recorded.
const txDateOf = tx => tx.date || tx.paymentDate || tx.lastPaymentDate || tx.submittedDate
// Never prints "Invalid Date" — a missing or unparseable date shows a dash.
const fmtDate = (d, opts = { month: 'short', day: 'numeric', year: 'numeric' }) => {
  const x = d ? new Date(d) : null
  return x && !isNaN(x) ? x.toLocaleDateString('en-PH', opts) : '—'
}

// School name is white-label content, never hardcoded (same source as Payments / Enrollments).
function getSchoolName() {
  try { return JSON.parse(localStorage.getItem('almirene_website_content') || '{}').schoolName || '' }
  catch { return '' }
}
const escHtml = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

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
      end:   new Date(new Date(customEnd).getTime() + 86400000 - 1)
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
  const fb  = tx.feeBreakdown || {}
  const txDate = txDateOf(tx)
  const fmtLong = d => fmtDate(d, { month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <ModalPortal>
      <div className="modal-backdrop">
        <div className="bg-[var(--color-bg-card)] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[92vh] flex flex-col shadow-[var(--shadow-modal)]">
          {/* Header */}
          <div className="modal-header">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                <Receipt className="w-4 h-4 text-[var(--color-primary-readable)]"/>
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-[var(--color-text-primary)] truncate">Transaction Detail</h2>
                <p className="text-xs font-mono text-[var(--color-primary-readable)]">{tx.orNumber || '—'}</p>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
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
            <div className="bg-[var(--color-info-light)] border border-[var(--color-info-border)] rounded-xl p-4">
              <h3 className="text-xs font-semibold text-[var(--color-info-text)] uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5"/> This Payment
              </h3>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-muted)]">OR Number</span>
                  <span className="font-mono font-semibold text-[var(--color-primary-readable)]">{tx.orNumber || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-muted)]">Date</span>
                  <span className="font-medium text-[var(--color-text-primary)]">{fmtLong(txDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-muted)]">Method</span>
                  <span className="font-medium text-[var(--color-text-primary)]">{tx.method || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-muted)]">Payment Covers</span>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {(tx.paymentFor?.length > 0 ? tx.paymentFor : ['tuition']).map(k => (
                      <span key={k} className="text-[10px] px-1.5 py-0.5 bg-secondary/10 dark:bg-secondary/30 text-[var(--color-secondary-readable)] rounded font-medium">
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
                <div className="flex justify-between font-bold text-base border-t border-[var(--color-info-border)] pt-2 mt-1">
                  <span className="text-[var(--color-text-primary)]">Amount Paid</span>
                  <span className="font-mono text-[var(--color-primary-readable)]">{php(tx.amount)}</span>
                </div>
              </div>
              {tx.discountsApplied?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-[var(--color-info-border)]">
                  {tx.discountsApplied.map((d, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-[var(--color-success-light)] text-[var(--color-success-text)] rounded-full text-[10px] font-medium">
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
                    <div className="flex justify-between text-[var(--color-success-text)]">
                      <span>Discount</span><span className="font-mono">– {php(fb.totalDiscount)}</span>
                    </div>
                  )}
                  {(fb.lab   || 0) > 0 && <div className="flex justify-between text-[var(--color-text-secondary)]"><span>Lab Fee</span><span className="font-mono">{php(fb.lab)}</span></div>}
                  {(fb.misc  || 0) > 0 && <div className="flex justify-between text-[var(--color-text-secondary)]"><span>Misc Fee</span><span className="font-mono">{php(fb.misc)}</span></div>}
                  {(fb.books || 0) > 0 && <div className="flex justify-between text-[var(--color-text-secondary)]"><span>Books</span><span className="font-mono">{php(fb.books)}</span></div>}
                  <div className="flex justify-between font-bold text-[var(--color-text-primary)] border-t border-[var(--color-border)] pt-2 mt-1 text-sm">
                    <span>Grand Total</span><span className="font-mono text-[var(--color-primary-readable)]">{php(fb.grandTotal)}</span>
                  </div>
                  <div className="flex justify-between text-[var(--color-success-text)]">
                    <span>Total Paid</span><span className="font-mono">{php(tx.totalFee - tx.balance)}</span>
                  </div>
                  {(tx.balance || 0) > 0 && (
                    <div className="flex justify-between text-[var(--color-warning-text)] font-semibold">
                      <span>Remaining Balance</span><span className="font-mono">{php(tx.balance)}</span>
                    </div>
                  )}
                  {(tx.balance || 0) <= 0 && tx.totalFee > 0 && (
                    <p className="text-[var(--color-success-text)] font-semibold text-center pt-1">✓ Fully Paid</p>
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
                          <p className={`font-mono font-semibold ${isThis ? 'text-[var(--color-primary-readable)]' : 'text-[var(--color-text-secondary)]'}`}>
                            {h.orNumber || '—'}
                            {isThis && <span className="ml-1.5 text-[10px] bg-primary text-[var(--color-primary-contrast)] px-1.5 py-0.5 rounded-full">This</span>}
                          </p>
                          <p className="text-[var(--color-text-muted)] mt-0.5">
                            {h.method || '—'} · {fmtDate(h.date)}
                          </p>
                        </div>
                        <span className="font-mono font-bold text-[var(--color-success-text)]">{php(h.amount)}</span>
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
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm bg-primary text-[var(--color-primary-contrast)] rounded-xl hover:bg-[var(--color-primary-hover)] transition font-semibold shadow-sm">
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
function TxReceiptModal({ tx, cashierName, schoolName, schoolYear, onClose, onPopupBlocked }) {
  const receiptRef = useRef(null)
  if (!tx) return null
  const fb  = tx.feeBreakdown || {}
  const dateStr = fmtDate(txDateOf(tx), { year: 'numeric', month: 'long', day: 'numeric' })
  const totalPaidSoFar = tx.totalFee - tx.balance

  const ReceiptCopy = ({ copyLabel }) => (
    <div className="receipt-copy border border-[var(--color-border)] rounded-lg p-5 bg-[var(--color-bg-card)] text-[var(--color-text-primary)]" style={{fontFamily:'Georgia,serif',fontSize:'13px'}}>
      {/* Header */}
      <div className="text-center mb-3 pb-3 border-b-2 border-double border-[var(--color-border-strong)]">
        {schoolName && <p className="font-bold text-sm uppercase tracking-wide text-[var(--color-text-primary)]">{schoolName}</p>}
        <p className="text-xs text-[var(--color-text-muted)]">{tx.campus}</p>
        <p className="text-xs text-[var(--color-text-muted)]">School Year {schoolYear}</p>
        <div className="mt-2 inline-block border border-[var(--color-border-strong)] px-3 py-0.5 rounded text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
          Official Receipt
        </div>
      </div>

      {/* OR + Date */}
      <div className="flex justify-between text-xs mb-3">
        <div><span className="text-[var(--color-text-muted)]">OR No.: </span><span className="font-bold font-mono">{tx.orNumber || '—'}</span></div>
        <div className="text-right"><span className="text-[var(--color-text-muted)]">Date: </span><span className="font-semibold">{dateStr}</span></div>
      </div>

      {/* Student info */}
      <div className="bg-[var(--color-bg-subtle)] rounded p-3 mb-3 text-xs space-y-1">
        <div className="flex gap-2"><span className="text-[var(--color-text-muted)] w-20 flex-shrink-0">Student:</span><span className="font-bold">{tx.studentName}</span></div>
        <div className="flex gap-2"><span className="text-[var(--color-text-muted)] w-20 flex-shrink-0">Ref. No.:</span><span className="font-mono">{tx.refNum}</span></div>
        <div className="flex gap-2"><span className="text-[var(--color-text-muted)] w-20 flex-shrink-0">Program:</span><span>{tx.gradeLevel}</span></div>
        {tx.semester && <div className="flex gap-2"><span className="text-[var(--color-text-muted)] w-20 flex-shrink-0">Semester:</span><span>{tx.semester}</span></div>}
      </div>

      {/* Fee breakdown */}
      <table className="w-full text-xs mb-3">
        <thead><tr className="border-b border-[var(--color-border)]">
          <th className="text-left py-1 text-[var(--color-text-muted)] font-normal">Description</th>
          <th className="text-right py-1 text-[var(--color-text-muted)] font-normal">Amount</th>
        </tr></thead>
        <tbody>
          {fb.tuitionAfterDiscount > 0 && <tr><td className="py-1">Tuition Fee{fb.totalDiscount > 0 ? ' (after discount)' : ''}</td><td className="py-1 text-right font-mono">{php(fb.tuitionAfterDiscount ?? fb.originalTuition ?? 0)}</td></tr>}
          {(fb.lab   || 0) > 0 && <tr><td className="py-1 text-[var(--color-text-secondary)]">Lab Fee</td><td className="py-1 text-right font-mono">{php(fb.lab)}</td></tr>}
          {(fb.misc  || 0) > 0 && <tr><td className="py-1 text-[var(--color-text-secondary)]">Misc Fee</td><td className="py-1 text-right font-mono">{php(fb.misc)}</td></tr>}
          {(fb.books || 0) > 0 && <tr><td className="py-1 text-[var(--color-text-secondary)]">Books</td><td className="py-1 text-right font-mono">{php(fb.books)}</td></tr>}
          {!fb.grandTotal && <tr><td className="py-1">{(tx.paymentFor?.length > 0 ? tx.paymentFor : ['tuition']).map(k => FEE_LABELS[k]||k).join(', ')}</td><td className="py-1 text-right font-mono">{php(tx.amount)}</td></tr>}
          <tr><td className="py-1 text-[var(--color-text-muted)]">Payment Method</td><td className="py-1 text-right">{tx.method || '—'}</td></tr>
          {tx.notes && <tr><td className="py-1 text-[var(--color-text-muted)]">Notes</td><td className="py-1 text-right text-[var(--color-text-secondary)]">{tx.notes}</td></tr>}
        </tbody>
      </table>

      {/* Totals */}
      <div className="border-t border-[var(--color-border)] pt-2 mb-3 space-y-1 text-xs">
        {tx.totalFee > 0 && <div className="flex justify-between"><span className="text-[var(--color-text-muted)]">Total Assessment:</span><span className="font-mono">{php(tx.totalFee)}</span></div>}
        <div className="flex justify-between font-bold text-sm border-t border-[var(--color-border)] pt-1 mt-1">
          <span className="text-[var(--color-text-primary)]">Amount This Payment:</span>
          <span className="font-mono text-[var(--color-text-primary)]">{php(tx.amount)}</span>
        </div>
        {tx.totalFee > 0 && <div className="flex justify-between"><span className="text-[var(--color-text-muted)]">Total Paid to Date:</span><span className="font-mono font-semibold text-[var(--color-success-text)]">{php(totalPaidSoFar)}</span></div>}
        {tx.totalFee > 0 && <div className="flex justify-between"><span className="text-[var(--color-text-muted)]">Remaining Balance:</span><span className={`font-mono font-semibold ${(tx.balance||0) > 0 ? 'text-[var(--color-error-text)]' : 'text-[var(--color-success-text)]'}`}>{(tx.balance||0) > 0 ? php(tx.balance) : '₱0.00 — Fully Paid ✓'}</span></div>}
      </div>

      {/* Signatures */}
      <div className="border-t border-dashed border-[var(--color-border)] pt-3 text-xs text-center text-[var(--color-text-muted)]">
        <div className="flex justify-between items-end mt-4">
          <div className="text-center">
            <div className="border-t border-[var(--color-border-strong)] pt-1 w-32">
              <p className="font-semibold text-[var(--color-text-secondary)]">{cashierName || 'Accounting Officer'}</p>
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
    // The popup is a blank document: it has no Tailwind and none of our CSS variables.
    // Carry over the app's stylesheets and the brand colours set on <html>. The popup
    // has no `dark` class, so a receipt always prints on the light theme.
    const appStyles = [...document.querySelectorAll('link[rel="stylesheet"], style')].map(n => n.outerHTML).join('\n')
    const rootStyle = escHtml(document.documentElement.getAttribute('style') || '')
    const w = window.open('', '_blank', 'width=780,height=900')
    if (!w) { onPopupBlocked?.(); return }
    w.document.write(`<!DOCTYPE html><html style="${rootStyle}"><head><meta charset="utf-8"><title>Receipt — ${escHtml(tx.studentName)}</title>
      ${appStyles}
      <style>
        body { margin: 0; font-family: Georgia, serif; font-size: 13px; background: var(--color-bg-card); color: var(--color-text-primary); }
        .print-page { width: 100%; padding: 16px; }
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
              <div className="w-9 h-9 bg-[var(--color-success-light)] rounded-full flex items-center justify-center">
                <Receipt className="w-4 h-4 text-[var(--color-success-text)]"/>
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
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm bg-primary text-[var(--color-primary-contrast)] rounded-xl hover:bg-[var(--color-primary-hover)] transition font-semibold shadow-sm">
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
  const fmt = fmtDate(txDateOf(tx))
  const feeTags = tx.paymentFor && tx.paymentFor.length > 0
    ? tx.paymentFor.map(k => FEE_LABELS[k] || k)
    : ['Tuition Fee']
  return (
    <tr className="hover:bg-[color-mix(in_srgb,var(--color-bg-subtle)_30%,transparent)] transition">
      <td className="px-4 py-3 text-xs font-mono text-[var(--color-primary-readable)]">{tx.orNumber || '—'}</td>
      <td className="px-4 py-3 text-sm font-medium text-[var(--color-text-primary)]">{tx.studentName}</td>
      <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">{tx.gradeLevel}</td>
      <td className="px-4 py-3">
        {feeTags.length > 0
          ? <div className="flex flex-wrap gap-1">
              {feeTags.map(tag => (
                <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-secondary/10 dark:bg-secondary/30 text-[var(--color-secondary-readable)] rounded font-medium">
                  {tag}
                </span>
              ))}
            </div>
          : <span className="text-xs text-[var(--color-text-muted)]">—</span>
        }
      </td>
      <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">{tx.method || '—'}</td>
      <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">{fmt}</td>
      <td className="px-4 py-3 text-sm font-bold text-[var(--color-success-text)] text-right font-mono">{php(tx.amount)}</td>
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onView(tx)}
            className="inline-flex items-center gap-1 text-xs px-2 py-1.5 text-[var(--color-primary-readable)] hover:bg-primary/10 dark:hover:bg-primary/20 rounded-lg font-medium transition"
            title="View details">
            <Eye className="w-3.5 h-3.5"/> Details
          </button>
          <button
            onClick={() => onPrint(tx)}
            className="inline-flex items-center gap-1 text-xs px-2 py-1.5 bg-primary text-[var(--color-primary-contrast)] hover:bg-[var(--color-primary-hover)] rounded-lg font-medium transition"
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
            <tr key={i} className="hover:bg-[color-mix(in_srgb,var(--color-bg-subtle)_30%,transparent)] transition">
              <td className="px-4 py-3 text-sm font-medium text-[var(--color-text-primary)]">{r.label}</td>
              <td className="px-4 py-3 text-sm text-[var(--color-text-secondary)]">{r.students}</td>
              <td className="px-4 py-3 text-sm text-[var(--color-success-text)] font-medium">{r.paid}</td>
              <td className="px-4 py-3 text-sm text-[var(--color-warning-text)]">{r.partial}</td>
              <td className="px-4 py-3 text-sm font-semibold text-[var(--color-success-text)]">{php(r.collected)}</td>
            </tr>
          ))}
          {/* Totals row */}
          <tr className="bg-[color-mix(in_srgb,var(--color-bg-subtle)_50%,transparent)] font-bold">
            <td className="px-4 py-3 text-sm text-[var(--color-text-primary)]">Total</td>
            <td className="px-4 py-3 text-sm text-[var(--color-text-primary)]">{rows.reduce((s,r)=>s+r.students,0)}</td>
            <td className="px-4 py-3 text-sm text-[var(--color-success-text)]">{rows.reduce((s,r)=>s+r.paid,0)}</td>
            <td className="px-4 py-3 text-sm text-[var(--color-warning-text)]">{rows.reduce((s,r)=>s+r.partial,0)}</td>
            <td className="px-4 py-3 text-sm text-[var(--color-success-text)]">{php(rows.reduce((s,r)=>s+r.collected,0))}</td>
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
  const { activeCampuses, currentSchoolYear, feeStructure, isBasicGrade, isCollegeGrade, basicEdGroups, collegeYearLevels } = useAppConfig()
  const schoolName = getSchoolName()

  // Cashier name — campus-scoped (from accounting's settings)
  const cashierName = (() => {
    try {
      const campusKey = user?.campus?.replace(/ (City |)Campus$/i, '').replace(/[^a-zA-Z]/g, '') || 'all'
      const cfg = JSON.parse(localStorage.getItem(`almirene_campus_cfg_${campusKey}`) || '{}')
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
  // The header filter holds a campus KEY ('Talisay'); accounting's locked campus and every
  // submission hold the campus NAME. Resolve to the name so the comparisons are exact.
  const effectiveCampusName = effectiveCampus === 'all'
    ? 'all'
    : (activeCampuses.find(c => c.key === effectiveCampus || c.name === effectiveCampus)?.name ?? effectiveCampus)

  // Load all payment submissions from localStorage bridge
  const allPayments = useMemo(() => {
    try {
      const subs = JSON.parse(localStorage.getItem('almirene_submissions') || '[]')
      return subs.filter(s =>
        // Must have payment status
        (s.status === 'payment_received' || s.status === 'approved') &&
        // Must have an actual recorded payment (amount > 0 AND paymentHistory exists)
        (s.amountPaid > 0 || (s.paymentHistory && s.paymentHistory.length > 0)) &&
        // Campus scope
        (effectiveCampusName === 'all' || s.enrollment?.campus === effectiveCampusName)
      )
    } catch { return [] }
  }, [effectiveCampusName])

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
        enrollmentFee:    sub.feeBreakdown?.enrollment || 0
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
  // Fully paid = students in THIS filtered set whose balance is cleared, so
  // paid + partial always adds up to the students shown (it used to ignore the fee filter).
  const fullyPaid       = new Set(
    filteredTxs.filter(tx => tx.totalFee > 0 && tx.balance <= 0).map(tx => tx.refNum)
  ).size
  const partialPaid     = uniqueStudents - fullyPaid
  const cashTotal       = filteredTxs.filter(t => t.method === 'Cash').reduce((s,t)=>s+(t.amount||0),0)
  const bankTotal       = filteredTxs.filter(t => t.method !== 'Cash' && t.method).reduce((s,t)=>s+(t.amount||0),0)

  // Build grade option lists for filter dropdowns
  // College options: build from fee structure filtered by CURRENT campus
  const collegeProgramsFromFees = [...new Set(
    (feeStructure || [])
      .filter(f => f.program &&
        (effectiveCampusName === 'all' || f.campus === effectiveCampusName)
      )
      .map(f => `${f.program} - ${f.yearLevel}`)
  )]
  const collegeProgramsFromData = [...new Set(
    allPayments.map(s => s.enrollment?.gradeLevel || '').filter(g => isCollegeGrade(g))
  )]
  // Merge both, deduplicate, sort by program then year level
  const yearRank = yr => { const i = collegeYearLevels.indexOf(yr); return i === -1 ? 999 : i }
  const collegePrograms = [...new Set([...collegeProgramsFromFees, ...collegeProgramsFromData])]
    .sort((a, b) => {
      const [progA, yrA] = a.split(' - ')
      const [progB, yrB] = b.split(' - ')
      if (progA !== progB) return progA.localeCompare(progB)
      return yearRank(yrA) - yearRank(yrB)
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
      if (deptFilter === 'basic_ed' && !isBasicGrade(grade)) return
      if (deptFilter === 'college'  && !isCollegeGrade(grade)) return
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
  }, [allPayments, period, customStart, customEnd, deptFilter, gradeFilter, isBasicGrade, isCollegeGrade])

  // Export
  const handleExport = () => {
    const summaryData = [{
      'Period':            periodLabel,
      'Campus':            effectiveCampusName === 'all' ? 'All Campuses' : effectiveCampusName,
      'Total Collected':   totalCollected,
      'Transactions':      filteredTxs.length,
      'Students':          uniqueStudents,
      'Fully Paid':        fullyPaid,
      'Partial':           partialPaid,
      'Cash':              cashTotal,
      'Bank Transfer':     bankTotal
    }]

    const txData = filteredTxs.map(tx => ({
      'OR Number':     tx.orNumber || '—',
      'Student Name':  tx.studentName,
      'Grade/Program': tx.gradeLevel,
      'Method':        tx.method || '—',
      'Date':          fmtDate(txDateOf(tx)),
      'Amount':        tx.amount || 0
    }))

    const breakdownData = gradeRows.map(r => ({
      'Grade/Program': r.label,
      'Students':      r.students,
      'Fully Paid':    r.paid,
      'Partial':       r.partial,
      'Collected':     r.collected

    }))

    exportMultipleSheets([
      { data: summaryData,   sheetName: 'Summary'     },
      { data: breakdownData, sheetName: 'By Grade'    },
      { data: txData,        sheetName: 'Transactions' },
    ], `ALMIRENE_Income_Report_${period}_${new Date().toISOString().split('T')[0]}`)
    addToast('Income report exported!', 'success')
  }

  return (
    <div className="animate-fade-in space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)] flex items-center gap-2">
            <BarChart2 className="w-7 h-7 text-[var(--color-primary-readable)]"/> Income Reports
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {currentSchoolYear} · {effectiveCampusName === 'all' ? 'All Campuses' : effectiveCampusName}
          </p>
        </div>
        <button onClick={handleExport}
          className="self-start flex items-center gap-1.5 px-4 py-2 text-sm bg-primary text-[var(--color-primary-contrast)] rounded-lg hover:bg-[var(--color-primary-hover)] transition font-medium shadow-sm">
          <Download className="w-4 h-4"/> Export Report
        </button>
      </div>


      {/* Period selector */}
      <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[var(--color-primary-readable)] flex-shrink-0"/>
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
                    ? CHIP_ACTIVE
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
          Showing: <span className="font-semibold text-[var(--color-primary-readable)]">{periodLabel}</span>
          {filteredTxs.length > 0 && <span>· {filteredTxs.length} transaction{filteredTxs.length !== 1 ? 's' : ''}</span>}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Total Collected" value={php(totalCollected)}
          sub={`${filteredTxs.length} transaction${filteredTxs.length !== 1 ? 's' : ''}`}
          icon={<TrendingUp className="w-5 h-5 text-[var(--color-success-text)]"/>}
          border="border-[var(--color-success)]" cls="text-[var(--color-success-text)]"/>
        <StatCard label="Students Paid" value={uniqueStudents}
          sub="in selected period"
          icon={<Users className="w-5 h-5 text-[var(--color-info-text)]"/>}
          border="border-[var(--color-info)]" cls="text-[var(--color-info-text)]"/>
        <StatCard label="Fully Paid" value={fullyPaid}
          sub={`${uniqueStudents > 0 ? Math.round(fullyPaid/uniqueStudents*100) : 0}% of students`}
          icon={<CheckCircle className="w-5 h-5 text-[var(--color-success-text)]"/>}
          border="border-[var(--color-success)]" cls="text-[var(--color-success-text)]"/>
        <StatCard label="Partial Payment" value={partialPaid}
          sub="balance still due"
          icon={<Clock className="w-5 h-5 text-[var(--color-warning-text)]"/>}
          border="border-[var(--color-warning)]" cls="text-[var(--color-warning-text)]"/>
      </div>

      {/* Main content — 2 col on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Grade level breakdown — 2/3 width */}
        <div className="lg:col-span-2 bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--color-border)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[var(--color-primary-readable)]"/>
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
                        ? basicEdGroups.map(group => ({
                            label: group.label,
                            options: (group.options || group.grades || []).map(g => ({ value: g, label: g }))
                          }))
                        : [{ label: 'College Programs', options: collegePrograms.map(p => ({ value: p, label: p })) }]
                    }
                  />
                )}
                {/* Clear filter */}
                {(deptFilter !== 'all' || gradeFilter !== 'all') && (
                  <button onClick={() => { setDeptFilter('all'); setGradeFilter('all') }}
                    className="text-xs px-2 py-1 bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)] rounded-lg hover:bg-[var(--color-error-light)] hover:text-[var(--color-error-text)] transition flex items-center gap-1">
                    ✕ Clear
                  </button>
                )}
              </div>
            </div>
            {/* Active filter label */}
            {(deptFilter !== 'all' || gradeFilter !== 'all') && (
              <p className="text-xs text-[var(--color-text-muted)] mt-2 flex items-center gap-1">
                <Filter className="w-3 h-3"/>
                Filtered by: <span className="font-semibold text-[var(--color-primary-readable)] ml-0.5">
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
              <DollarSign className="w-4 h-4 text-[var(--color-primary-readable)]"/>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">By Payment Method</h3>
            </div>
            <MethodBreakdown transactions={filteredTxs}/>
          </div>

          {/* Quick totals */}
          <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <ArrowUpRight className="w-4 h-4 text-[var(--color-primary-readable)]"/>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Quick Summary</h3>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Cash collected',         val: php(cashTotal),    cls: 'text-[var(--color-success-text)]' },
                { label: 'Bank Transfer collected', val: php(bankTotal),   cls: 'text-[var(--color-info-text)]' },
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
              <FileText className="w-4 h-4 text-[var(--color-primary-readable)]"/>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Individual Transactions</h3>
              <span className="text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-subtle)] px-2 py-0.5 rounded-full">
                {filteredTxs.length}
              </span>
            </div>
            {/* Fee type filter */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-[var(--color-text-muted)] font-medium">Filter by fee:</span>
              <div className="flex flex-wrap gap-1.5">
                {[{ val: 'all', label: 'All' }, ...FEE_FILTER_KEYS.map(k => ({ val: k, label: FEE_LABELS[k] }))].map(opt => (
                  <button key={opt.val}
                    onClick={() => setFeeTypeFilter(opt.val)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition
                      ${feeTypeFilter === opt.val
                        ? CHIP_ACTIVE
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
                className="w-full pl-8 pr-3 py-2 text-xs border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary-readable)] transition"
              />
            </div>
            {(txSearch || feeTypeFilter !== 'all') && (
              <button
                onClick={() => { setTxSearch(''); setFeeTypeFilter('all') }}
                className="text-xs px-3 py-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-error-text)] border border-[var(--color-border)] rounded-lg transition whitespace-nowrap">
                ✕ Clear filters
              </button>
            )}
          </div>
          {feeTypeFilter !== 'all' && (
            <p className="text-xs text-[var(--color-text-muted)] mt-2 flex items-center gap-1">
              <Filter className="w-3 h-3"/>
              Showing transactions with <span className="font-semibold text-[var(--color-secondary-readable)] ml-0.5">{FEE_LABELS[feeTypeFilter]}</span> component
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
                  <td className="px-4 py-3 text-sm font-bold text-[var(--color-success-text)] text-right font-mono">
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
          schoolName={schoolName}
          schoolYear={currentSchoolYear}
          onClose={() => setReceiptTx(null)}
          onPopupBlocked={() => addToast('Allow pop-ups for this site to print the receipt.', 'error')}
        />
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast}/>
    </div>
  )
}