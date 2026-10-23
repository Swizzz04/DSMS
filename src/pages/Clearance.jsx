/**
 * Clearance.jsx — ALMIRENE DX
 * Student Clearance Management — Standalone Page
 *
 * Who signs what (config/appConfig.js → CLEARANCE_DEPARTMENT_SIGNERS + user.clearanceDuties):
 *   librarian         → Library
 *   accounting        → Accounting (auto-clears at zero balance; may sign manually, with a
 *                       note, while a balance is owing)
 *   registrar_*       → Registrar
 *   guidance          → Guidance
 *   principal / program_head → Admin Office
 *   technical_admin   → any department
 *   any account       → plus the extra departments set in Settings → Users
 *                       (e.g. a teacher who is also the guidance in-charge)
 *   Departments sign in any order; Admin Office signs last.
 *
 * Rules:
 *   - Accounting auto-clears when the LIVE balance (almirene_submissions) is zero
 *   - Accounting may sign manually with a note while a balance is owing, so the student can
 *     still enroll next term. The balance at sign-off is recorded on the clearance.
 *   - GRADUATION clearance needs a zero balance — accounting cannot sign it while one is owing
 *   - A student that cannot be found is never auto-cleared; accounting verifies manually
 *   - Sign-off is permanent once given — no unsigning
 *   - isFullyCleared when ALL 5 departments are cleared (and, for graduation, no balance)
 *
 * Bridge: src/utils/documentBridge.js (getClearances, updateDepartmentClearance, etc.)
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ShieldCheck, Shield, Clock, CheckCircle, AlertCircle,
  Search, ChevronRight, X, Info, User, Building2,
  Filter, Eye, CreditCard, BookOpen, Users, Plus, RefreshCw,
} from 'lucide-react'
import { useAuth }      from '../context/AuthContext'
import { useAppConfig } from '../context/AppConfigContext'
import { getClearanceDepartments, CLEARANCE_LAST_DEPARTMENT } from '../config/appConfig'
import { getStudents } from '../utils/enrollmentBridge'
import {
  PageSkeleton, useToast, ToastContainer, ModalPortal
} from '../components/UIComponents'
import ClearanceSignDialog from '../components/documents/ClearanceSignDialog'
import {
  getClearances, getClearanceById, createClearance,
  checkAccountingStatus, CLEARANCE_DEPARTMENTS,
  getClearanceBalance, clearanceRequiresZeroBalance,
  getSignableDepartments, getClearanceWaitingOn,
} from '../utils/documentBridge'

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const DEPT_ICONS = {
  library:   BookOpen,
  accounting: CreditCard,
  registrar:  ShieldCheck,
  guidance:   Users,
  admin:      Building2,
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric'
  })
}

function fmtDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

function getClearedCount(clearance) {
  return CLEARANCE_DEPARTMENTS.filter(d => clearance.departments[d.id]?.cleared).length
}

/** "Library, Guidance" / "Library, Guidance +1" — what a clearance is waiting on. */
function waitingLabel(clearance) {
  const names = getClearanceWaitingOn(clearance).map(d => d.label)
  if (!names.length) return ''
  return names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ')
}

function fmtPeso(n) {
  return `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function getProgressPct(clearance) {
  return Math.round((getClearedCount(clearance) / CLEARANCE_DEPARTMENTS.length) * 100)
}

// ─────────────────────────────────────────────────────────────────────────────
// DEPARTMENT CHIP — compact inline dept status
// ─────────────────────────────────────────────────────────────────────────────

function DeptChip({ deptId, info, compact = false }) {
  const dept    = CLEARANCE_DEPARTMENTS.find(d => d.id === deptId)
  const Icon    = DEPT_ICONS[deptId] ?? Shield
  const cleared = info?.cleared === true

  if (compact) {
    return (
      <span
        title={`${dept?.label}: ${cleared ? `Cleared by ${info.clearedBy}` : 'Pending'}`}
        className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[9px] font-bold
          ${cleared
            ? 'bg-[var(--color-success-light)] text-[var(--color-success)] border border-[var(--color-success-border)]'
            : 'bg-[var(--color-bg-muted)] text-[var(--color-text-muted)] border border-[var(--color-border)]'}`}
      >
        {dept?.label[0]}
      </span>
    )
  }

  return (
    <div className={`flex items-center gap-2 p-2.5 rounded-xl border transition-colors
      ${cleared
        ? 'bg-[var(--color-success-light)] border-[var(--color-success-border)]'
        : 'bg-[var(--color-bg-page)] border-[var(--color-border)]'}`}>
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0
        ${cleared ? 'bg-[var(--color-success)] text-white' : 'bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]'}`}>
        <Icon size={13} />
      </div>
      <div className="min-w-0">
        <p className={`text-xs font-semibold truncate
          ${cleared ? 'text-[var(--color-success)]' : 'text-[var(--color-text-secondary)]'}`}>
          {dept?.label}
        </p>
        {cleared && (
          <p className="text-[10px] text-[var(--color-text-muted)] truncate">{info.clearedBy}</p>
        )}
      </div>
      {cleared
        ? <CheckCircle size={13} className="text-[var(--color-success)] ml-auto shrink-0" />
        : <Clock size={13} className="text-[var(--color-text-muted)] ml-auto shrink-0" />}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CLEARANCE DETAIL DRAWER
// ─────────────────────────────────────────────────────────────────────────────

function ClearanceDrawer({ clearance, currentUser, onUpdate, onClose }) {
  const [confirmDept, setConfirmDept] = useState(null)
  const { toasts, addToast, removeToast } = useToast()

  // Live balance, read fresh from the payment records every render
  const balInfo      = getClearanceBalance(clearance)
  const owing        = balInfo.found && balInfo.balance > 0
  const zeroRequired = clearanceRequiresZeroBalance(clearance)

  const pct       = getProgressPct(clearance)
  const clearedN  = getClearedCount(clearance)

  // The workflow engine decides who can sign what, in which order (role + step + blocking rules)
  const signable = getSignableDepartments(currentUser, clearance)

  // Accounting cannot sign a graduation clearance while a balance is owing
  const accountingBlocked = zeroRequired && owing

  return (
    <ModalPortal>
      <div className="modal-backdrop">
        <div className="modal-panel" style={{ maxWidth: '38rem' }}>
          {/* Header */}
          <div className="flex items-start justify-between p-5 border-b border-[var(--color-border)]">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-base font-bold text-[var(--color-text-primary)]">
                  Student Clearance
                </h3>
                {clearance.isFullyCleared
                  ? <span className="badge badge-approved">Fully Cleared</span>
                  : <span className="badge badge-pending">In Progress</span>}
              </div>
              <p className="text-xs text-[var(--color-text-muted)]">
                {clearance.studentName} · {clearance.schoolYear}
              </p>
            </div>
            <button
              onClick={onClose}
              className="icon-btn-ghost"
              aria-label="Close drawer"
            >
              <X size={16} />
            </button>
          </div>

          <div className="p-5 space-y-5 overflow-y-auto" style={{ maxHeight: '70vh' }}>
            {/* Progress bar */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
                  Clearance Progress
                </span>
                <span className="text-xs font-bold text-[var(--color-text-primary)]">
                  {clearedN} / {CLEARANCE_DEPARTMENTS.length} departments
                </span>
              </div>
              <div className="h-2 bg-[var(--color-bg-subtle)] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: clearance.isFullyCleared
                      ? 'var(--color-success)'
                      : pct >= 60 ? 'var(--color-warning)' : 'var(--color-primary)'
                  }}
                />
              </div>
              {owing && (
                <div className="flex items-start gap-1.5 mt-2 text-xs text-[var(--color-error)]">
                  <AlertCircle size={12} className="shrink-0 mt-0.5" />
                  <span>
                    Outstanding balance: <strong>{fmtPeso(balInfo.balance)}</strong>.{' '}
                    {zeroRequired
                      ? 'Graduation clearance cannot be signed by accounting until this is fully paid.'
                      : 'Accounting may still sign with a note so the student can continue; the balance stays on record.'}
                  </span>
                </div>
              )}
              {!balInfo.found && (
                <div className="flex items-start gap-1.5 mt-2 text-xs text-[var(--color-warning)]">
                  <AlertCircle size={12} className="shrink-0 mt-0.5" />
                  <span>Balance not found for this student — accounting must verify it manually and add a note.</span>
                </div>
              )}
              <button
                onClick={() => {
                  checkAccountingStatus(clearance.id)
                  onUpdate()
                  addToast('Accounting status refreshed.', 'success')
                }}
                className="mt-2 flex items-center gap-1.5 text-xs text-[var(--color-info)] hover:underline"
              >
                <RefreshCw size={11} /> Re-check accounting status
              </button>
            </div>

            {/* Clearance info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {[
                ['Student',    clearance.studentName],
                ['Campus',     clearance.campusKey],
                ['School Year',clearance.schoolYear],
                ['Reason',     clearance.reason || 'General Clearance'],
                ['Requested',  fmtDate(clearance.createdAt)],
                ['Completed',  clearance.isFullyCleared ? fmtDate(clearance.completedAt) : '—'],
              ].map(([label, value]) => (
                <div key={label} className="bg-[var(--color-bg-subtle)] rounded-xl p-3">
                  <p className="text-label text-[var(--color-text-muted)] mb-0.5">{label}</p>
                  <p className="font-medium text-[var(--color-text-primary)]">{value}</p>
                </div>
              ))}
            </div>

            {/* Department sign-off grid */}
            <div>
              <p className="text-label text-[var(--color-text-muted)] mb-3">Department Sign-offs</p>
              <div className="space-y-2">
                {CLEARANCE_DEPARTMENTS.map(dept => {
                  const info    = clearance.departments[dept.id] ?? {}
                  const cleared = info.cleared === true
                  const isAuto  = dept.autoFromPayment
                  const canSignDept = signable.includes(dept.id)
                  const Icon    = DEPT_ICONS[dept.id] ?? Shield

                  return (
                    <div
                      key={dept.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-colors
                        ${cleared
                          ? 'bg-[var(--color-success-light)] border-[var(--color-success-border)]'
                          : 'bg-[var(--color-bg-page)] border-[var(--color-border)]'}`}
                    >
                      {/* Icon */}
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0
                        ${cleared ? 'bg-[var(--color-success)] text-white' : 'bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]'}`}>
                        <Icon size={15} />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className={`text-sm font-semibold ${cleared ? 'text-[var(--color-success)]' : 'text-[var(--color-text-primary)]'}`}>
                            {dept.label}
                          </p>
                          {isAuto && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--color-info-light)] text-[var(--color-info)] border border-[var(--color-info-border)] font-semibold">
                              AUTO
                            </span>
                          )}
                        </div>
                        {cleared
                          ? <>
                              <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                                {info.clearedBy} · {fmtDateTime(info.clearedAt)}
                              </p>
                              {info.withBalance && (
                                <p className="text-[11px] text-[var(--color-warning)] mt-0.5 font-semibold">
                                  Cleared with balance of {fmtPeso(info.balanceAtSignoff)}
                                </p>
                              )}
                              {info.balanceUnverified && (
                                <p className="text-[11px] text-[var(--color-warning)] mt-0.5 font-semibold">
                                  Balance verified manually
                                </p>
                              )}
                              {info.note && (
                                <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5 break-words">
                                  Note: {info.note}
                                </p>
                              )}
                            </>
                          : <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                              {dept.id === 'accounting' && accountingBlocked
                                ? 'Blocked — balance owing'
                                : dept.id === CLEARANCE_LAST_DEPARTMENT && getClearanceWaitingOn(clearance).some(d => d.id !== CLEARANCE_LAST_DEPARTMENT)
                                  ? 'Opens after the other departments sign'
                                  : 'Pending'}
                            </p>
                        }
                      </div>

                      {/* Action */}
                      {cleared
                        ? <CheckCircle size={16} className="text-[var(--color-success)] shrink-0" />
                        : canSignDept
                          ? (
                            <button
                              onClick={() => setConfirmDept(dept.id)}
                              className="btn btn-primary text-xs py-1.5 px-3 shrink-0"
                            >
                              {dept.id === 'accounting' && (owing || !balInfo.found) ? 'Sign with note' : 'Sign'}
                            </button>
                          )
                          : <Clock size={16} className="text-[var(--color-text-muted)] shrink-0" />
                      }
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Fully cleared banner */}
            {clearance.isFullyCleared && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-[var(--color-success-light)] border border-[var(--color-success-border)]">
                <ShieldCheck size={20} className="text-[var(--color-success)] shrink-0" />
                <div>
                  <p className="text-sm font-bold text-[var(--color-success)]">Fully Cleared</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    All departments cleared on {fmtDate(clearance.completedAt)}.
                    Registrar may now release requested credentials.
                  </p>
                </div>
              </div>
            )}
          </div>

          <ToastContainer toasts={toasts} removeToast={removeToast} />
        </div>
      </div>

      {confirmDept && (
        <ClearanceSignDialog
          clearance={clearance}
          deptId={confirmDept}
          user={currentUser}
          onClose={() => setConfirmDept(null)}
          onSigned={(_fresh, label) => { addToast(`${label} clearance signed.`, 'success'); onUpdate() }}
          onError={(msg) => addToast(msg, 'error')}
        />
      )}
    </ModalPortal>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CLEARANCE CARD — list item
// ─────────────────────────────────────────────────────────────────────────────

function ClearanceCard({ clearance, user, onSelect }) {
  const pct      = getProgressPct(clearance)
  const clearedN = getClearedCount(clearance)

  // Highlight if this card has something this user can act on
  const needsMySign = getSignableDepartments(user, clearance).length > 0

  return (
    <div
      className={`card card-hover cursor-pointer transition-all p-4 ${
        needsMySign ? 'border-[var(--color-warning-border)]' : ''
      }`}
      onClick={() => onSelect(clearance)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onSelect(clearance)}
      aria-label={`View clearance for ${clearance.studentName}`}
    >
      <div className="flex items-start gap-3">
        {/* Avatar circle */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm
          ${clearance.isFullyCleared
            ? 'bg-[var(--color-success-light)] text-[var(--color-success)]'
            : 'bg-[var(--color-secondary)] text-[var(--color-secondary-contrast)]'}`}>
          {clearance.studentName.charAt(0)}
        </div>

        <div className="flex-1 min-w-0">
          {/* Name + status */}
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-[var(--color-text-primary)] truncate">
              {clearance.studentName}
            </p>
            {clearance.isFullyCleared
              ? <span className="badge badge-approved shrink-0">Cleared</span>
              : needsMySign
                ? <span className="badge badge-pending shrink-0">Needs your sign</span>
                : <span className="badge" style={{
                    background: 'var(--color-bg-subtle)',
                    color: 'var(--color-text-muted)',
                    border: '1px solid var(--color-border)'
                  }}>Waiting on {waitingLabel(clearance)}</span>
            }
          </div>

          {/* Reason + date */}
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">
            {clearance.reason || 'General Clearance'} · {fmtDate(clearance.createdAt)}
          </p>

          {/* Progress */}
          <div className="mt-2.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                {CLEARANCE_DEPARTMENTS.map(d => (
                  <DeptChip
                    key={d.id}
                    deptId={d.id}
                    info={clearance.departments[d.id]}
                    compact
                  />
                ))}
              </div>
              <span className="text-[10px] text-[var(--color-text-muted)] font-semibold">
                {clearedN}/{CLEARANCE_DEPARTMENTS.length}
              </span>
            </div>
            <div className="h-1 bg-[var(--color-bg-subtle)] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  backgroundColor: clearance.isFullyCleared
                    ? 'var(--color-success)'
                    : pct >= 60 ? 'var(--color-warning)' : 'var(--color-primary)'
                }}
              />
            </div>
          </div>
        </div>

        <ChevronRight size={14} className="text-[var(--color-text-muted)] shrink-0 mt-1" />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STATS BAR
// ─────────────────────────────────────────────────────────────────────────────

function StatsBar({ clearances, user, showMine }) {
  const total    = clearances.length
  const cleared  = clearances.filter(c => c.isFullyCleared).length
  const pending  = total - cleared
  const needsMe  = showMine
    ? clearances.filter(c => getSignableDepartments(user, c).length > 0).length
    : 0

  const stats = [
    { label: 'Total',    value: total,   color: 'text-[var(--color-text-primary)]' },
    { label: 'Cleared',  value: cleared, color: 'text-[var(--color-success)]' },
    { label: 'Pending',  value: pending, color: 'text-[var(--color-warning)]' },
    ...(showMine ? [{ label: 'Needs My Sign', value: needsMe, color: 'text-[var(--color-primary-readable)]' }] : []),
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map(stat => (
        <div key={stat.label} className="stat-card text-center py-4">
          <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          <p className="text-caption text-[var(--color-text-muted)] mt-1">{stat.label}</p>
        </div>
      ))}
    </div>
  )
}


// ─────────────────────────────────────────────────────────────────────────────
// NEW CLEARANCE MODAL — registrar / tech admin initiates manually
// ─────────────────────────────────────────────────────────────────────────────

const CLEARANCE_REASONS = [
  { value: 'graduation',      label: 'Graduation Clearance' },
  { value: 'transfer',        label: 'Transfer / Honorable Dismissal' },
  { value: 'transcript',      label: 'Transcript of Records' },
  { value: 'credential',      label: 'Release of Credentials' },
  { value: 'general',         label: 'General Clearance' },
]

function NewClearanceModal({ campusKey, schoolYear, currentUser, onSave, onClose }) {
  const [studentSearch, setStudentSearch] = useState('')
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [reason, setReason] = useState('general')
  const [saving, setSaving] = useState(false)
  const { toasts, addToast, removeToast } = useToast()
  const { isBasicGrade } = useAppConfig()

  // Students come from the student records (they carry the school ID), scoped to the
  // campus and school year. A department registrar only sees their own students;
  // the technical admin sees both.
  const studentDept = (st) => st?.department || (isBasicGrade?.(st?.gradeLevel) ? 'basicEd' : 'college')
  const lockedDept  = currentUser?.role === 'registrar_basic' ? 'basicEd'
                    : currentUser?.role === 'registrar_college' ? 'college' : null
  const allStudents = (getStudents({ campusKey, schoolYear }) || [])
    .filter(st => !lockedDept || studentDept(st) === lockedDept)

  // Results appear from the first letter typed
  const q = studentSearch.trim().toLowerCase()
  const filtered = q
    ? allStudents.filter(st =>
        st.firstName?.toLowerCase().includes(q) ||
        st.lastName?.toLowerCase().includes(q) ||
        `${st.lastName || ''}, ${st.firstName || ''}`.toLowerCase().includes(q) ||
        String(st.studentId || '').toLowerCase().includes(q)
      ).slice(0, 30)
    : []

  const selectedBalance = selectedStudent ? getClearanceBalance({ studentId: selectedStudent.id }) : null

  const handleSave = () => {
    if (!selectedStudent) { addToast('Please select a student.', 'error'); return }
    setSaving(true)
    try {
      // One open clearance per student per school year — open the existing one instead
      const existing = getClearances({ schoolYear, studentId: selectedStudent.id }).find(c => !c.isFullyCleared)
      if (existing) { onSave(existing, true); return }

      const reasonLabel = CLEARANCE_REASONS.find(r => r.value === reason)?.label ?? reason
      const record = createClearance(
        selectedStudent.id,
        `${selectedStudent.lastName}, ${selectedStudent.firstName}`,
        campusKey,
        schoolYear,
        reasonLabel,
        { requiresZeroBalance: reason === 'graduation' }
      )
      onSave(record, false)
    } catch (err) {
      addToast(err.message, 'error')
      setSaving(false)
    }
  }

  return (
    <ModalPortal>
      <div className="modal-backdrop">
        <div className="modal-panel" style={{ maxWidth: '32rem', maxHeight: '92dvh' }}>
          <div className="flex items-center justify-between p-5 border-b border-[var(--color-border)] shrink-0">
            <div>
              <h2 className="text-base font-bold text-[var(--color-text-primary)]">
                New Student Clearance
              </h2>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                Initiate a clearance record for a student
              </p>
            </div>
            <button onClick={onClose} className="icon-btn-ghost" aria-label="Close">
              <X size={16} />
            </button>
          </div>

          {/* Scrolls on small screens, so the footer buttons always stay on screen */}
          <div className="p-5 space-y-4 flex-1 min-h-0 overflow-y-auto">
            {/* Student search */}
            <div>
              <label className="text-label text-[var(--color-text-muted)] block mb-1.5">
                Student *
              </label>
              {selectedStudent ? (
                <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-[var(--color-success-border)] bg-[var(--color-success-light)]">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                      {selectedStudent.lastName}, {selectedStudent.firstName}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      School ID {selectedStudent.studentId || '—'} · {selectedStudent.gradeLevel || '—'}
                    </p>
                    {selectedBalance && (
                      <p className={`text-xs font-semibold mt-0.5 ${selectedBalance.found && selectedBalance.balance > 0 ? 'text-[var(--color-warning-text)]' : 'text-[var(--color-text-muted)]'}`}>
                        {!selectedBalance.found
                          ? 'Balance not found'
                          : selectedBalance.balance > 0
                            ? `Balance owing: ${fmtPeso(selectedBalance.balance)}`
                            : 'No balance'}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedStudent(null)}
                    className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition-colors shrink-0"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2 border border-[var(--color-border)] rounded-[var(--radius-md)] bg-[var(--color-bg-card)] px-3 focus-within:ring-2 focus-within:ring-[var(--color-border-focus)] transition-shadow">
                    <Search size={14} className="text-[var(--color-text-muted)] shrink-0" />
                    <input
                      className="flex-1 py-[0.5625rem] text-sm bg-transparent outline-none text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
                      placeholder="Search by name or school ID..."
                      value={studentSearch}
                      onChange={e => setStudentSearch(e.target.value)}
                      autoFocus
                    />
                  </div>

                  {/* Results — in the page flow, so they always show under the field */}
                  {filtered.length > 0 && (
                    <div
                      className="mt-1.5 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl overflow-y-auto max-h-56"
                      role="listbox"
                      aria-label="Matching students"
                    >
                      {filtered.map(st => (
                        <button
                          key={st.id}
                          type="button"
                          role="option"
                          onClick={() => { setSelectedStudent(st); setStudentSearch('') }}
                          className="w-full text-left px-4 py-2.5 hover:bg-[var(--color-bg-subtle)] transition-colors border-b border-[var(--color-border)] last:border-b-0"
                        >
                          <span className="block text-sm font-medium text-[var(--color-text-primary)]">
                            {st.lastName}, {st.firstName}
                          </span>
                          <span className="block text-xs text-[var(--color-text-muted)] mt-0.5">
                            School ID {st.studentId || '—'} · {st.gradeLevel || '—'}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  {q && filtered.length === 0 && (
                    <p className="text-xs text-[var(--color-text-muted)] mt-1.5 pl-1">
                      No students found{campusKey ? ` in ${campusKey}` : ''}
                      {lockedDept ? ` (${lockedDept === 'college' ? 'College' : 'Basic Ed'} only)` : ''}.
                    </p>
                  )}
                  {!q && (
                    <p className="text-xs text-[var(--color-text-muted)] mt-1.5 pl-1">
                      Type a name or school ID, then pick the student from the list.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Reason */}
            <div>
              <label className="text-label text-[var(--color-text-muted)] block mb-1.5">
                Reason for Clearance *
              </label>
              <div className="grid grid-cols-1 gap-1.5">
                {CLEARANCE_REASONS.map(r => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setReason(r.value)}
                    className={`text-left px-3 py-2.5 rounded-xl border text-sm transition-colors
                      ${reason === r.value
                        ? 'bg-[var(--color-secondary)] border-[var(--color-secondary)] text-[var(--color-secondary-contrast)] font-semibold'
                        : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary-readable)]'}`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Accounting note */}
            <div className="flex items-start gap-2 p-3 rounded-xl bg-[var(--color-info-light)] border border-[var(--color-info-border)] text-xs text-[var(--color-info)]">
              <Info size={12} className="shrink-0 mt-0.5" />
              Accounting clears automatically when the student has no balance. Otherwise accounting can sign with a note.
              {reason === 'graduation' && ' Graduation clearance needs a zero balance — it cannot be signed while one is owing.'}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 p-5 border-t border-[var(--color-border)] shrink-0">
            {!selectedStudent && (
              <span className="text-xs text-[var(--color-text-muted)] mr-auto">Pick a student to continue.</span>
            )}
            <button onClick={onClose} className="btn btn-ghost text-sm">Cancel</button>
            <button
              onClick={handleSave}
              disabled={saving || !selectedStudent}
              className="btn btn-primary text-sm gap-1.5 disabled:opacity-50"
            >
              <Plus size={14} />
              {saving ? 'Creating...' : 'Create Clearance'}
            </button>
          </div>
          <ToastContainer toasts={toasts} removeToast={removeToast} />
        </div>
      </div>
    </ModalPortal>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function Clearance() {
  const { user }       = useAuth()
  const { currentSchoolYear, activeCampuses } = useAppConfig()

  const campusKey  = user?.campusKey || activeCampuses?.[0]?.key || ''
  // currentSchoolYear is already the year string (e.g. '2026-2027'), not an object
  const schoolYear = currentSchoolYear || '2026-2027'
  const role       = user?.role

  // Which departments can this account sign? (their role + any extra duties; Super Admin: all)
  const isSuperAdmin = role === 'technical_admin'
  const myDepts      = getClearanceDepartments(user)
  const showMine     = myDepts.length > 0
  const myDeptLabels = myDepts.map(id => CLEARANCE_DEPARTMENTS.find(d => d.id === id)?.label).filter(Boolean)
  const pureAccounting = !isSuperAdmin && myDepts.length === 1 && myDepts[0] === 'accounting'
  const isRegistrar  = ['registrar_basic', 'registrar_college', 'technical_admin'].includes(role)

  const [clearances,   setClearances]   = useState([])
  const [loading,      setLoading]      = useState(true)
  const [filter,       setFilter]       = useState('pending')  // 'pending' | 'cleared' | 'all'
  const [search,       setSearch]       = useState('')
  const [selected,     setSelected]     = useState(null)
  const [showNew,      setShowNew]      = useState(false)
  const { toasts, addToast, removeToast } = useToast()

  const loadData = useCallback(() => {
    try {
      let all = getClearances({ campusKey, schoolYear })

      // Accounting role: only show clearances where accounting dept hasn't cleared yet
      if (pureAccounting) {
        all = all.filter(c => !c.departments.accounting?.cleared)
      }

      setClearances(all)
    } catch (err) {
      addToast('Failed to load clearance records.', 'error')
    } finally {
      setLoading(false)
    }
  }, [campusKey, schoolYear, pureAccounting])

  useEffect(() => { loadData() }, [loadData])

  // Opened from a document request ("Open in Clearance page"): /clearance?id=<clearanceId>
  const [searchParams, setSearchParams] = useSearchParams()
  const openId = searchParams.get('id')
  useEffect(() => {
    if (!openId || loading) return
    const rec = getClearanceById(openId)
    if (rec) setSelected(rec)
    else addToast('That clearance record was not found.', 'error')
    setSearchParams({}, { replace: true })
  }, [openId, loading])

  useEffect(() => {
    const handler = () => loadData()
    window.addEventListener('almirene_clearance_updated', handler)
    return () => window.removeEventListener('almirene_clearance_updated', handler)
  }, [loadData])

  // Apply filter + search
  const filtered = useMemo(() => {
    let list = clearances

    if (filter === 'pending') list = list.filter(c => !c.isFullyCleared)
    else if (filter === 'cleared') list = list.filter(c => c.isFullyCleared)

    // For non-admin roles with a specific dept: "needs-me" filter
    if (filter === 'needs-me' && showMine) {
      list = list.filter(c => getSignableDepartments(user, c).length > 0)
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(c =>
        c.studentName?.toLowerCase().includes(q) ||
        c.reason?.toLowerCase().includes(q)
      )
    }

    return list
  }, [clearances, filter, search, showMine, user])

  const filterOptions = [
    { id: 'all',     label: `All (${clearances.length})` },
    { id: 'pending', label: `Pending (${clearances.filter(c => !c.isFullyCleared).length})` },
    { id: 'cleared', label: `Cleared (${clearances.filter(c => c.isFullyCleared).length})` },
    ...(showMine ? [{
      id: 'needs-me',
      label: `Needs My Sign (${clearances.filter(c => getSignableDepartments(user, c).length > 0).length})`
    }] : []),
  ]


  if (loading) return <PageSkeleton />

  return (
    <div className="page-enter space-y-5">
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-display text-[var(--color-text-primary)]">Student Clearance</h1>
          <p className="text-body text-[var(--color-text-muted)] mt-1">
            {schoolYear}
            {!isSuperAdmin && myDeptLabels.length > 0 && (
              <span className="ml-2 badge" style={{
                background: 'var(--color-secondary-muted)',
                color: 'var(--color-secondary)',
                border: '1px solid var(--color-secondary)',
                display: 'inline-flex'
              }}>
                {myDeptLabels.join(' + ')} — My {myDeptLabels.length > 1 ? 'Departments' : 'Department'}
              </span>
            )}
          </p>
        </div>
        {(isRegistrar || isSuperAdmin) && (
          <button
            onClick={() => setShowNew(true)}
            className="btn btn-primary gap-1.5 text-sm shrink-0"
          >
            <Plus size={15} /> New Clearance
          </button>
        )}
      </div>

      {/* ── Role notice ───────────────────────────────────────────────────── */}
      {!isSuperAdmin && myDeptLabels.length > 0 && (
        <div className="flex items-start gap-2.5 p-4 rounded-xl bg-[var(--color-info-light)] border border-[var(--color-info-border)]">
          <Info size={15} className="text-[var(--color-info)] shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-semibold text-[var(--color-info)]">Your role: </span>
            <span className="text-[var(--color-text-secondary)]">
              You can sign off the <strong>{myDeptLabels.join(', ')}</strong> clearance for each student.
              Departments can sign in any order, except Admin Office, which signs last once the others are done.
              Once signed, it cannot be reversed. All other departments are managed by their respective officers.
            </span>
          </div>
        </div>
      )}

      {myDepts.includes('accounting') && !isSuperAdmin && (
        <div className="flex items-start gap-2.5 p-4 rounded-xl bg-[var(--color-warning-light)] border border-[var(--color-warning-border)]">
          <AlertCircle size={15} className="text-[var(--color-warning)] shrink-0 mt-0.5" />
          <p className="text-sm text-[var(--color-text-secondary)]">
            <span className="font-semibold text-[var(--color-warning)]">Accounting note: </span>
            Clearance is auto-granted when the live payment balance is zero. If a student still owes,
            you may sign with a note so they can continue to the next term; the balance stays on record.
            Graduation clearances cannot be signed until the balance is fully paid.
          </p>
        </div>
      )}

      {/* ── Stats ─────────────────────────────────────────────────────────── */}
      <StatsBar clearances={clearances} user={user} showMine={showMine} />

      {/* ── Filters + Search ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Filter chips */}
        <div className="flex flex-wrap gap-2">
          {filterOptions.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`btn text-xs py-2 px-4 ${
                filter === f.id ? 'btn-primary' : 'btn-ghost'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="sm:ml-auto sm:w-64 flex items-center gap-2 border border-[var(--color-border)] rounded-[var(--radius-md)] bg-[var(--color-bg-card)] px-3 focus-within:ring-2 focus-within:ring-[var(--color-border-focus)] transition-shadow">
          <Search size={14} className="text-[var(--color-text-muted)] shrink-0" />
          <input
            className="flex-1 py-[0.5625rem] text-sm bg-transparent outline-none text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
            placeholder="Search student name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Search clearances"
          />
        </div>
      </div>

      {/* ── Clearance list ────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-bg-subtle)] flex items-center justify-center mx-auto mb-4">
            <ShieldCheck size={28} className="text-[var(--color-text-muted)] opacity-50" />
          </div>
          <p className="text-subheading text-[var(--color-text-primary)]">
            {filter === 'needs-me' ? 'Nothing needs your signature' : 'No clearance records found'}
          </p>
          <p className="text-small text-[var(--color-text-muted)] mt-1">
            {filter === 'pending'
              ? 'All students are fully cleared for this school year.'
              : filter === 'needs-me'
                ? 'All clearances in your department are signed.'
                : 'Clearance records are created when students request credentials.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 stagger">
          {filtered.map(clr => (
            <ClearanceCard
              key={clr.id}
              clearance={clr}
              user={user}
              onSelect={c => setSelected(c)}
            />
          ))}
        </div>
      )}

      {/* ── New clearance modal ─────────────────────────────────────────────── */}
      {showNew && (
        <NewClearanceModal
          campusKey={campusKey}
          schoolYear={schoolYear}
          currentUser={user}
          onSave={(record, existed) => {
            setShowNew(false)
            loadData()
            addToast(existed
              ? 'This student already has an open clearance — opened it.'
              : 'Clearance record created.', existed ? 'info' : 'success')
            setSelected(record)
          }}
          onClose={() => setShowNew(false)}
        />
      )}

      {/* ── Detail drawer ─────────────────────────────────────────────────── */}
      {selected && (
        <ClearanceDrawer
          clearance={selected}
          currentUser={user}
          onUpdate={() => {
            loadData()
            // Refresh selected record
            const fresh = getClearanceById(selected.id)
            if (fresh) setSelected(fresh)
          }}
          onClose={() => setSelected(null)}
        />
      )}

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  )
}