/**
 * Clearance.jsx — ALMIRENE DX
 * Student Clearance Management — Standalone Page
 *
 * Role-scoped views:
 *   accounting        → sees only Accounting department queue (auto-blocked by balance)
 *   registrar_basic   → sees all clearances, can sign Registrar dept
 *   registrar_college → sees all clearances, can sign Registrar dept
 *   principal_basic   → sees all, can sign Admin Office dept
 *   program_head      → sees all, can sign Admin Office dept
 *   technical_admin   → sees everything, can sign any dept, override, export
 *
 * Rules:
 *   - Accounting clearance is auto-driven by payment balance — cannot be manually overridden
 *   - Sign-off is permanent once given — no unsigning
 *   - isFullyCleared only when ALL 5 departments are cleared AND no unpaid balance
 *
 * Bridge: src/utils/documentBridge.js (getClearances, updateDepartmentClearance, etc.)
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ShieldCheck, Shield, Clock, CheckCircle, AlertCircle,
  Search, ChevronRight, X, Info, User, Building2,
  Filter, Eye, CreditCard, BookOpen, Users, Plus, RefreshCw,
} from 'lucide-react'
import { useAuth }      from '../context/AuthContext'
import { useAppConfig } from '../context/AppConfigContext'
import {
  PageSkeleton, useToast, ToastContainer, ConfirmDialog, ModalPortal
} from '../components/UIComponents'
import {
  getClearances, getClearanceById, createClearance, updateDepartmentClearance,
  checkAccountingStatus, CLEARANCE_DEPARTMENTS,
} from '../utils/documentBridge'

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps a user role to the department ID they are responsible for signing.
 * technical_admin and registrar roles can sign any department.
 */
const ROLE_DEPT_MAP = {
  accounting:        'accounting',
  principal_basic:   'admin',
  program_head:      'admin',
  // registrar + technical_admin can sign any — handled separately
}

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

  const role       = currentUser?.role
  const isSuperAdmin = role === 'technical_admin'
  const isRegistrar  = ['registrar_basic', 'registrar_college', 'technical_admin'].includes(role)
  const myDept     = ROLE_DEPT_MAP[role] ?? null

  const pct       = getProgressPct(clearance)
  const clearedN  = getClearedCount(clearance)

  /**
   * Can the current user sign a specific department?
   * - Super admin: any dept
   * - Registrar: registrar dept only
   * - Accounting: accounting dept only (but it's auto — they can confirm if auto missed)
   * - Principal/program head: admin dept only
   */
  function canSign(deptId) {
    if (clearance.isFullyCleared) return false
    const deptInfo = clearance.departments[deptId]
    if (deptInfo?.cleared) return false
    // Accounting is auto — accounting staff can still manually confirm
    if (isSuperAdmin) return true
    if (isRegistrar && deptId === 'registrar') return true
    if (myDept && deptId === myDept) return true
    return false
  }

  const handleSign = () => {
    if (!confirmDept) return
    try {
      updateDepartmentClearance(clearance.id, confirmDept, currentUser?.name ?? 'Unknown')
      addToast(`${CLEARANCE_DEPARTMENTS.find(d => d.id === confirmDept)?.label} clearance signed.`, 'success')
      setConfirmDept(null)
      onUpdate()
    } catch (err) {
      addToast(err.message, 'error')
      setConfirmDept(null)
    }
  }

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
              {clearance.hasUnpaidBalance && (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-[var(--color-error)]">
                  <AlertCircle size={12} />
                  Student has an unpaid balance — accounting clearance blocked until settled.
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
            <div className="grid grid-cols-2 gap-2 text-xs">
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
                  const signable = canSign(dept.id)
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
                          ? <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                              {info.clearedBy} · {fmtDateTime(info.clearedAt)}
                            </p>
                          : <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">Pending</p>
                        }
                      </div>

                      {/* Action */}
                      {cleared
                        ? <CheckCircle size={16} className="text-[var(--color-success)] shrink-0" />
                        : signable
                          ? (
                            <button
                              onClick={() => setConfirmDept(dept.id)}
                              className="btn btn-primary text-xs py-1.5 px-3 shrink-0"
                            >
                              Sign
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

      <ConfirmDialog
        open={!!confirmDept}
        title={`Sign ${CLEARANCE_DEPARTMENTS.find(d => d.id === confirmDept)?.label} Clearance`}
        message="This action is permanent and cannot be reversed. Once signed, it cannot be undone without Super Admin intervention. Are you sure?"
        confirmLabel="Sign Clearance"
        danger={false}
        onConfirm={handleSign}
        onCancel={() => setConfirmDept(null)}
      />
    </ModalPortal>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CLEARANCE CARD — list item
// ─────────────────────────────────────────────────────────────────────────────

function ClearanceCard({ clearance, myDept, onSelect }) {
  const pct      = getProgressPct(clearance)
  const clearedN = getClearedCount(clearance)

  // Highlight if this card has something this user can act on
  const myDeptInfo  = myDept ? clearance.departments[myDept] : null
  const needsMySign = myDept && !myDeptInfo?.cleared && !clearance.isFullyCleared

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
            : 'bg-[var(--color-primary-muted)] text-[var(--color-primary)]'}`}>
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
                ? <span className="badge badge-pending shrink-0">Needs Sign</span>
                : <span className="badge" style={{
                    background: 'var(--color-bg-subtle)',
                    color: 'var(--color-text-muted)',
                    border: '1px solid var(--color-border)'
                  }}>In Progress</span>
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

function StatsBar({ clearances, myDept }) {
  const total    = clearances.length
  const cleared  = clearances.filter(c => c.isFullyCleared).length
  const pending  = total - cleared
  const needsMe  = myDept
    ? clearances.filter(c => !c.isFullyCleared && !c.departments[myDept]?.cleared).length
    : 0

  const stats = [
    { label: 'Total',    value: total,   color: 'text-[var(--color-text-primary)]' },
    { label: 'Cleared',  value: cleared, color: 'text-[var(--color-success)]' },
    { label: 'Pending',  value: pending, color: 'text-[var(--color-warning)]' },
    ...(myDept ? [{ label: 'Needs My Sign', value: needsMe, color: 'text-[var(--color-primary)]' }] : []),
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

  // Load enrolled students from localStorage
  const allStudents = (() => {
    try {
      const subs = JSON.parse(localStorage.getItem('cshc_submissions') || '[]')
      return subs
        .filter(s => s.status === 'approved')
        .map(s => ({
          id:         s.id,
          name:       `${s.student?.lastName || ''}, ${s.student?.firstName || ''}`.trim(),
          gradeLevel: s.enrollment?.gradeLevel || '',
          studentId:  s.studentId || s.id,
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
    } catch { return [] }
  })()

  const filtered = studentSearch.length >= 2
    ? allStudents.filter(s =>
        s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
        s.studentId?.includes(studentSearch)
      ).slice(0, 8)
    : []

  const handleSave = () => {
    if (!selectedStudent) { addToast('Please select a student.', 'error'); return }
    setSaving(true)
    try {
      const reasonLabel = CLEARANCE_REASONS.find(r => r.value === reason)?.label ?? reason
      const record = createClearance(
        selectedStudent.id,
        selectedStudent.name,
        campusKey,
        schoolYear,
        reasonLabel
      )
      onSave(record)
    } catch (err) {
      addToast(err.message, 'error')
      setSaving(false)
    }
  }

  return (
    <ModalPortal>
      <div className="modal-backdrop">
        <div className="modal-panel" style={{ maxWidth: '32rem' }}>
          <div className="flex items-center justify-between p-5 border-b border-[var(--color-border)]">
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

          <div className="p-5 space-y-4">
            {/* Student search */}
            <div>
              <label className="text-label text-[var(--color-text-muted)] block mb-1.5">
                Student *
              </label>
              {selectedStudent ? (
                <div className="flex items-center justify-between p-3 rounded-xl border border-[var(--color-success-border)] bg-[var(--color-success-light)]">
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {selectedStudent.name}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {selectedStudent.gradeLevel}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedStudent(null)}
                    className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition-colors"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 border border-[var(--color-border)] rounded-[var(--radius-md)] bg-[var(--color-bg-card)] px-3 focus-within:ring-2 focus-within:ring-[var(--color-border-focus)] transition-shadow">
                  <Search size={14} className="text-[var(--color-text-muted)] shrink-0" />
                  <input
                    className="flex-1 py-[0.5625rem] text-sm bg-transparent outline-none text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
                    placeholder="Search by name or student ID..."
                    value={studentSearch}
                    onChange={e => setStudentSearch(e.target.value)}
                    autoFocus
                  />
                  {filtered.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl shadow-[var(--shadow-lg)] overflow-hidden">
                      {filtered.map(s => (
                        <button
                          key={s.id}
                          onClick={() => { setSelectedStudent(s); setStudentSearch('') }}
                          className="w-full text-left px-4 py-2.5 hover:bg-[var(--color-bg-subtle)] transition-colors text-sm"
                        >
                          <span className="font-medium text-[var(--color-text-primary)]">{s.name}</span>
                          <span className="text-[var(--color-text-muted)] ml-2 text-xs">{s.gradeLevel}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {studentSearch.length >= 2 && filtered.length === 0 && (
                    <p className="text-xs text-[var(--color-text-muted)] mt-1.5 pl-1">No students found.</p>
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
                        ? 'bg-[var(--color-primary-muted)] border-[var(--color-primary)] text-[var(--color-primary)] font-semibold'
                        : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary)]'}`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Accounting note */}
            <div className="flex items-start gap-2 p-3 rounded-xl bg-[var(--color-info-light)] border border-[var(--color-info-border)] text-xs text-[var(--color-info)]">
              <Info size={12} className="shrink-0 mt-0.5" />
              Accounting clearance will be auto-set based on the student's current payment balance.
            </div>
          </div>

          <div className="flex justify-end gap-2 p-5 border-t border-[var(--color-border)]">
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
  const schoolYear = currentSchoolYear?.year || '2025-2026'
  const role       = user?.role

  // What department does this user sign off?
  const myDept      = ROLE_DEPT_MAP[role] ?? null
  const isSuperAdmin = role === 'technical_admin'
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
      if (role === 'accounting' && !isSuperAdmin) {
        all = all.filter(c => !c.departments.accounting?.cleared)
      }

      setClearances(all)
    } catch (err) {
      addToast('Failed to load clearance records.', 'error')
    } finally {
      setLoading(false)
    }
  }, [campusKey, schoolYear, role, isSuperAdmin])

  useEffect(() => { loadData() }, [loadData])

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
    if (filter === 'needs-me' && myDept) {
      list = list.filter(c => !c.isFullyCleared && !c.departments[myDept]?.cleared)
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(c =>
        c.studentName?.toLowerCase().includes(q) ||
        c.reason?.toLowerCase().includes(q)
      )
    }

    return list
  }, [clearances, filter, search, myDept])

  const filterOptions = [
    { id: 'all',     label: `All (${clearances.length})` },
    { id: 'pending', label: `Pending (${clearances.filter(c => !c.isFullyCleared).length})` },
    { id: 'cleared', label: `Cleared (${clearances.filter(c => c.isFullyCleared).length})` },
    ...(myDept ? [{
      id: 'needs-me',
      label: `Needs My Sign (${clearances.filter(c => !c.isFullyCleared && !c.departments[myDept]?.cleared).length})`
    }] : []),
  ]

  const myDeptLabel = CLEARANCE_DEPARTMENTS.find(d => d.id === myDept)?.label

  if (loading) return <PageSkeleton />

  return (
    <div className="page-enter space-y-5">
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-display text-[var(--color-text-primary)]">Student Clearance</h1>
          <p className="text-body text-[var(--color-text-muted)] mt-1">
            {schoolYear}
            {myDeptLabel && (
              <span className="ml-2 badge" style={{
                background: 'var(--color-primary-muted)',
                color: 'var(--color-primary)',
                border: '1px solid var(--color-primary)',
                display: 'inline-flex'
              }}>
                {myDeptLabel} — My Department
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
      {myDept && !isSuperAdmin && (
        <div className="flex items-start gap-2.5 p-4 rounded-xl bg-[var(--color-info-light)] border border-[var(--color-info-border)]">
          <Info size={15} className="text-[var(--color-info)] shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-semibold text-[var(--color-info)]">Your role: </span>
            <span className="text-[var(--color-text-secondary)]">
              You can sign off the <strong>{myDeptLabel}</strong> clearance for each student.
              Once signed, it cannot be reversed. All other departments are managed by their
              respective officers.
            </span>
          </div>
        </div>
      )}

      {role === 'accounting' && (
        <div className="flex items-start gap-2.5 p-4 rounded-xl bg-[var(--color-warning-light)] border border-[var(--color-warning-border)]">
          <AlertCircle size={15} className="text-[var(--color-warning)] shrink-0 mt-0.5" />
          <p className="text-sm text-[var(--color-text-secondary)]">
            <span className="font-semibold text-[var(--color-warning)]">Accounting note: </span>
            Clearance is auto-granted when payment balance is zero. Students with unpaid balances
            are blocked automatically. You can manually confirm if auto-detection missed a payment.
          </p>
        </div>
      )}

      {/* ── Stats ─────────────────────────────────────────────────────────── */}
      <StatsBar clearances={clearances} myDept={myDept} />

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
              myDept={myDept}
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
          onSave={(record) => {
            setShowNew(false)
            loadData()
            addToast('Clearance record created.', 'success')
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