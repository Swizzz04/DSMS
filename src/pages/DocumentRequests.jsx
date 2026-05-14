/**
 * DocumentRequests.jsx — ALMIRENE DX
 * Document Requests & Student Clearance
 *
 * Roles:
 *   registrar_basic   — sees Basic Ed requests, manages workflow, releases docs
 *   registrar_college — sees College requests, manages workflow, releases docs
 *   accounting        — sees "for_payment" queue, confirms fee payments
 *   principal_basic   — signs Admin Office clearance
 *   program_head      — signs Admin Office clearance (college)
 *   technical_admin   — sees everything
 */

import { useState, useEffect, useCallback } from 'react'
import {
  FileText, Plus, Search, Filter, ChevronDown,
  Check, X, Clock, AlertCircle, Package, Send,
  User, CreditCard, Eye, RotateCcw, CheckCircle,
  ClipboardList, ShieldCheck, Building2, BookOpen,
} from 'lucide-react'
import { useAuth }      from '../context/AuthContext'
import { useAppConfig } from '../context/AppConfigContext'
import GroupedSelect    from '../components/GroupedSelect'
import { ConfirmDialog, useToast, ToastContainer, ModalPortal, PageSkeleton } from '../components/UIComponents'
import {
  getRequests, getRequestById, createRequest,
  updateStatus, recordPayment, releaseDocument, cancelRequest,
  getClearances, getClearanceById, createClearance, updateDepartmentClearance,
  checkAccountingStatus, isFullyCleared, linkClearanceToRequest,
  BASIC_ED_DOCUMENT_TYPES, COLLEGE_DOCUMENT_TYPES,
  REQUEST_STATUSES, CLEARANCE_DEPARTMENTS,
  getDocumentActions, advanceDocumentStep, getDocumentStepDef,
} from '../utils/documentBridge'
import { getStudents } from '../utils/enrollmentBridge'

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_STYLE = {
  requested:   'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  processing:  'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  for_payment: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  ready:       'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  released:    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  cancelled:   'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
}

const STATUS_ICON = {
  requested:   Clock,
  processing:  RotateCcw,
  for_payment: CreditCard,
  ready:       Package,
  released:    CheckCircle,
  cancelled:   X,
}

function StatusBadge({ request, status: statusProp }) {
  const status = request?.status ?? statusProp ?? ''
  const StatusIcon = STATUS_ICON[status] ?? Clock
  const styleClass = request ? getStatusStyle(request) : (STATUS_STYLE[status] ?? '')
  const label      = request ? getStatusLabel(request)  : (REQUEST_STATUSES.find(s => s.id === status)?.label ?? status)
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${styleClass}`}>
      <StatusIcon className="w-3 h-3" />
      {label}
    </span>
  )
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─────────────────────────────────────────────────────────────────────────────
// NEW REQUEST MODAL
// ─────────────────────────────────────────────────────────────────────────────

function NewRequestModal({ campusKey, schoolYear, currentUser, onSave, onClose }) {
  const [studentSearch, setStudentSearch] = useState('')
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [docType, setDocType]   = useState('')
  const [purpose, setPurpose]   = useState('')
  const [requestedBy, setRequestedBy] = useState('student')
  const [requestorName, setRequestorName] = useState('')
  const [saving, setSaving] = useState(false)
  const { toasts, addToast, removeToast } = useToast()

  // Load students from enrollmentBridge
  const allStudents = getStudents({ campusKey, schoolYear }) || []
  const filteredStudents = studentSearch.length >= 2
    ? allStudents.filter(s =>
        s.firstName?.toLowerCase().includes(studentSearch.toLowerCase()) ||
        s.lastName?.toLowerCase().includes(studentSearch.toLowerCase()) ||
        s.studentId?.includes(studentSearch)
      ).slice(0, 8)
    : []

  const department = selectedStudent?.department ?? 'basicEd'
  const docTypes   = department === 'college' ? COLLEGE_DOCUMENT_TYPES : BASIC_ED_DOCUMENT_TYPES
  const selectedDoc = docTypes.find(d => d.id === docType)

  const handleSave = () => {
    if (!selectedStudent) { addToast('Please select a student', 'error'); return }
    if (!docType) { addToast('Please select a document type', 'error'); return }
    if (!purpose.trim()) { addToast('Please state the purpose', 'error'); return }
    setSaving(true)

    const record = createRequest({
      studentId:     selectedStudent.id,
      studentName:   `${selectedStudent.lastName}, ${selectedStudent.firstName}`,
      studentGrade:  selectedStudent.gradeLevel,
      campusKey,
      campusName:    selectedStudent.campusName ?? '',
      schoolYear,
      department,
      documentType:  selectedDoc.id,
      documentLabel: selectedDoc.label,
      fee:           selectedDoc.fee,
      requiresClearance: selectedDoc.requiresClearance,
      purpose:       purpose.trim(),
      requestedBy,
      requestorName: requestedBy === 'student' ? selectedStudent.firstName : requestorName,
      createdBy:     currentUser?.name,
      createdByName: currentUser?.name,
    })

    // Auto-create clearance record if required
    if (selectedDoc.requiresClearance) {
      const clr = createClearance(
        selectedStudent.id,
        `${selectedStudent.lastName}, ${selectedStudent.firstName}`,
        campusKey,
        schoolYear,
        `For: ${selectedDoc.label}`
      )
      linkClearanceToRequest(record.id, clr.id)
    }

    setSaving(false)
    onSave()
  }

  return (
    <ModalPortal>
      <div className="modal-backdrop">
        <div className="modal-panel" style={{ maxWidth: '36rem' }}>
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-[var(--color-border)]">
            <div>
              <h2 className="text-base font-bold text-[var(--color-text-primary)]">New Document Request</h2>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Fill in all fields to submit a request</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--color-bg-subtle)] transition">
              <X size={16} className="text-[var(--color-text-muted)]" />
            </button>
          </div>

          <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Student search */}
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
                Student *
              </label>
              {selectedStudent ? (
                <div className="flex items-center justify-between p-3 rounded-xl border border-[var(--color-border)] bg-green-50 dark:bg-green-900/10">
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {selectedStudent.lastName}, {selectedStudent.firstName}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {selectedStudent.gradeLevel} · {selectedStudent.studentId}
                    </p>
                  </div>
                  <button onClick={() => { setSelectedStudent(null); setDocType('') }}
                    className="text-xs text-[var(--color-text-muted)] hover:text-red-500 transition">
                    Change
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                  <input
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition"
                    placeholder="Search by name or student ID..."
                    value={studentSearch}
                    onChange={e => setStudentSearch(e.target.value)}
                  />
                  {filteredStudents.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl shadow-lg overflow-hidden">
                      {filteredStudents.map(s => (
                        <button key={s.id} onClick={() => { setSelectedStudent(s); setStudentSearch(''); setDocType('') }}
                          className="w-full text-left px-4 py-2.5 hover:bg-[var(--color-bg-subtle)] transition text-sm">
                          <span className="font-medium text-[var(--color-text-primary)]">
                            {s.lastName}, {s.firstName}
                          </span>
                          <span className="text-[var(--color-text-muted)] ml-2 text-xs">
                            {s.gradeLevel} · {s.studentId}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  {studentSearch.length >= 2 && filteredStudents.length === 0 && (
                    <p className="text-xs text-[var(--color-text-muted)] mt-1.5 pl-1">No students found.</p>
                  )}
                </div>
              )}
            </div>

            {/* Document type */}
            {selectedStudent && (
              <div>
                <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
                  Document Type *
                </label>
                <GroupedSelect
                  value={docType || 'all'}
                  onChange={v => setDocType(v === 'all' ? '' : v)}
                  options={docTypes.map(d => ({ value: d.id, label: d.label + (d.fee > 0 ? ` — ₱${d.fee}` : '') }))}
                  allLabel="Select document type..."
                  placeholder="Select document type..."
                />
                {selectedDoc?.requiresClearance && (
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-700 dark:text-amber-400">
                    <AlertCircle size={12} />
                    This document requires student clearance before release.
                  </div>
                )}
                {selectedDoc?.fee > 0 && (
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">
                    Processing fee: <strong className="text-[var(--color-text-primary)]">₱{selectedDoc.fee}</strong>
                  </p>
                )}
              </div>
            )}

            {/* Purpose */}
            {docType && (
              <div>
                <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
                  Purpose *
                </label>
                <input
                  className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition"
                  placeholder="e.g. For scholarship application, for employment, for transfer"
                  value={purpose}
                  onChange={e => setPurpose(e.target.value)}
                />
              </div>
            )}

            {/* Requested by */}
            {docType && (
              <div>
                <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
                  Requested By
                </label>
                <div className="flex gap-2">
                  {['student', 'parent', 'admin'].map(opt => (
                    <button key={opt} type="button" onClick={() => setRequestedBy(opt)}
                      className={`flex-1 py-2 text-xs rounded-xl border transition-colors font-medium capitalize
                        ${requestedBy === opt
                          ? 'bg-primary text-white border-primary'
                          : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-primary'}`}>
                      {opt}
                    </button>
                  ))}
                </div>
                {requestedBy === 'parent' && (
                  <input
                    className="w-full mt-2 px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition"
                    placeholder="Parent / guardian name"
                    value={requestorName}
                    onChange={e => setRequestorName(e.target.value)}
                  />
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 p-5 border-t border-[var(--color-border)]">
            <button onClick={onClose} className="btn btn-ghost text-sm">Cancel</button>
            <button onClick={handleSave} disabled={saving || !selectedStudent || !docType || !purpose.trim()}
              className="btn btn-primary text-sm gap-1.5 disabled:opacity-50">
              <Plus size={14} /> Submit Request
            </button>
          </div>
          <ToastContainer toasts={toasts} removeToast={removeToast} />
        </div>
      </div>
    </ModalPortal>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// RELEASE MODAL
// ─────────────────────────────────────────────────────────────────────────────

function ReleaseModal({ request, onRelease, onClose }) {
  const [releasedTo, setReleasedTo] = useState('')
  const [claimSlip,  setClaimSlip]  = useState('')
  const cleared = !request.requiresClearance || isFullyCleared(request.clearanceId)

  return (
    <ModalPortal>
      <div className="modal-backdrop">
        <div className="modal-panel" style={{ maxWidth: '26rem' }}>
          <div className="p-5 border-b border-[var(--color-border)]">
            <h3 className="text-base font-bold text-[var(--color-text-primary)]">Release Document</h3>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{request.documentLabel}</p>
          </div>
          <div className="p-5 space-y-4">
            {!cleared && (
              <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-400">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                Student clearance is not yet complete. This document cannot be released until all departments have cleared the student.
              </div>
            )}
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
                Released To *
              </label>
              <input
                className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition"
                placeholder="Name of person claiming the document"
                value={releasedTo}
                onChange={e => setReleasedTo(e.target.value)}
                disabled={!cleared}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
                Claim Slip No. <span className="font-normal text-[var(--color-text-muted)]">(optional)</span>
              </label>
              <input
                className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition"
                placeholder="e.g. CS-2025-001"
                value={claimSlip}
                onChange={e => setClaimSlip(e.target.value)}
                disabled={!cleared}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 p-5 border-t border-[var(--color-border)]">
            <button onClick={onClose} className="btn btn-ghost text-sm">Cancel</button>
            <button
              disabled={!cleared || !releasedTo.trim()}
              onClick={() => onRelease({ releasedTo: releasedTo.trim(), claimSlip })}
              className="btn btn-primary text-sm gap-1.5 disabled:opacity-50">
              <CheckCircle size={14} /> Confirm Release
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CLEARANCE PANEL
// ─────────────────────────────────────────────────────────────────────────────

function ClearancePanel({ clearanceId, currentUser }) {
  const [clearance, setClearance] = useState(null)
  const [confirming, setConfirming] = useState(null) // dept id being confirmed
  const { toasts, addToast, removeToast } = useToast()

  const load = useCallback(() => {
    if (clearanceId) {
      setClearance(getClearanceById(clearanceId))
    }
  }, [clearanceId])

  useEffect(() => { load() }, [load])

  const handleSign = (deptId) => {
    try {
      updateDepartmentClearance(clearanceId, deptId, currentUser?.name ?? 'Unknown')
      addToast(`${deptId} clearance signed.`, 'success')
      load()
    } catch (err) {
      addToast(err.message, 'error')
    }
    setConfirming(null)
  }

  if (!clearanceId) return null
  if (!clearance)   return <p className="text-xs text-[var(--color-text-muted)] italic">Loading clearance...</p>

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck size={14} className={clearance.isFullyCleared ? 'text-green-500' : 'text-amber-500'} />
        <span className={`text-xs font-semibold ${clearance.isFullyCleared ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
          {clearance.isFullyCleared ? 'Fully Cleared ✓' : 'Clearance In Progress'}
        </span>
      </div>

      {CLEARANCE_DEPARTMENTS.map(dept => {
        const info    = clearance.departments[dept.id] ?? {}
        const cleared = info.cleared === true

        return (
          <div key={dept.id} className={`flex items-center justify-between p-3 rounded-xl border transition-colors
            ${cleared
              ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
              : 'bg-[var(--color-bg-page)] border-[var(--color-border)]'}`}>
            <div className="flex items-center gap-2">
              {cleared
                ? <Check size={13} className="text-green-600 dark:text-green-400 shrink-0" />
                : <Clock size={13} className="text-[var(--color-text-muted)] shrink-0" />
              }
              <div>
                <p className={`text-xs font-medium ${cleared ? 'text-green-700 dark:text-green-400' : 'text-[var(--color-text-primary)]'}`}>
                  {dept.label}
                </p>
                {cleared && (
                  <p className="text-[10px] text-[var(--color-text-muted)]">
                    {info.clearedBy} · {fmtDate(info.clearedAt)}
                  </p>
                )}
              </div>
            </div>
            {!cleared && (
              <button
                onClick={() => setConfirming(dept.id)}
                className="text-xs px-2.5 py-1 rounded-lg border border-primary text-primary hover:bg-primary hover:text-white transition-colors font-medium">
                Sign
              </button>
            )}
          </div>
        )
      })}

      <ConfirmDialog
        open={!!confirming}
        title={`Sign ${CLEARANCE_DEPARTMENTS.find(d => d.id === confirming)?.label} Clearance`}
        message="This action is permanent and cannot be reversed. Are you sure you want to sign this clearance?"
        confirmLabel="Sign Clearance"
        danger={false}
        onConfirm={() => handleSign(confirming)}
        onCancel={() => setConfirming(null)}
      />
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// REQUEST DETAIL DRAWER
// ─────────────────────────────────────────────────────────────────────────────

function RequestDrawer({ request, currentUser, onUpdate, onClose }) {
  const [releaseModal, setReleaseModal] = useState(false)
  const [noteInput,    setNoteInput]    = useState('')
  const { toasts, addToast, removeToast } = useToast()

  const role = currentUser?.role
  const isRegistrar = role === 'registrar_basic' || role === 'registrar_college' || role === 'technical_admin'
  const isAccounting = role === 'accounting' || role === 'technical_admin'

  // Workflow engine determines available actions — no hardcoding
  const availableActions = getDocumentActions(currentUser, request)

  // Convenience helpers for backward-compatible button rendering
  const hasAction = (id) => availableActions.some(a => a.id === id)
  const canProcess        = hasAction('start_processing')
  const canRequirePayment = hasAction('require_payment')
  const canMarkReady      = hasAction('mark_ready')
  const canConfirmPayment = hasAction('confirm_payment')
  const canRelease        = hasAction('release')
  const canCancel         = hasAction('cancel')

  const act = (actionId, note = '') => {
    try {
      advanceDocumentStep(request.id, actionId, note, currentUser)
      const action = availableActions.find(a => a.id === actionId)
      addToast(action ? `${action.label} — done.` : 'Status updated.', 'success')
      onUpdate()
    } catch (err) {
      addToast(err.message, 'error')
    }
  }

  const handleRelease = (data) => {
    try {
      releaseDocument(request.id, { ...data, byName: currentUser?.name })
      addToast('Document released successfully.', 'success')
      setReleaseModal(false)
      onUpdate()
    } catch (err) {
      addToast(err.message, 'error')
    }
  }

  return (
    <ModalPortal>
      <div className="modal-backdrop">
        <div className="modal-panel" style={{ maxWidth: '38rem' }}>
          {/* Header */}
          <div className="flex items-start justify-between p-5 border-b border-[var(--color-border)]">
            <div>
              <h3 className="text-base font-bold text-[var(--color-text-primary)]">{request.documentLabel}</h3>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                {request.studentName} · {request.studentGrade}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge request={request} />
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--color-bg-subtle)] transition">
                <X size={16} className="text-[var(--color-text-muted)]" />
              </button>
            </div>
          </div>

          <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
            {/* Info grid */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['Purpose',      request.purpose],
                ['Requested By', `${request.requestedBy}${request.requestorName ? ` — ${request.requestorName}` : ''}`],
                ['Fee',          request.fee > 0 ? `₱${request.fee}` : 'Free'],
                ['Filed On',     fmtDate(request.createdAt)],
                ...(request.paidAt ? [['Paid On', fmtDate(request.paidAt)]] : []),
                ...(request.releasedTo ? [['Released To', request.releasedTo]] : []),
                ...(request.claimSlip ? [['Claim Slip', request.claimSlip]] : []),
              ].map(([label, value]) => (
                <div key={label} className="bg-[var(--color-bg-subtle)] rounded-xl p-3">
                  <p className="text-[10px] text-[var(--color-text-muted)] font-medium uppercase tracking-wide">{label}</p>
                  <p className="text-sm text-[var(--color-text-primary)] font-medium mt-0.5">{value}</p>
                </div>
              ))}
            </div>

            {/* Clearance panel */}
            {request.requiresClearance && (
              <div className="border border-[var(--color-border)] rounded-xl p-4">
                <p className="text-xs font-semibold text-[var(--color-text-secondary)] mb-3 flex items-center gap-1.5">
                  <ShieldCheck size={13} /> Student Clearance
                </p>
                <ClearancePanel clearanceId={request.clearanceId} currentUser={currentUser} />
              </div>
            )}

            {/* Status history */}
            <div>
              <p className="text-xs font-semibold text-[var(--color-text-secondary)] mb-2">Status History</p>
              <div className="space-y-2">
                {[...request.statusHistory].reverse().map((h, i) => (
                  <div key={i} className="flex items-start gap-3 text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <StatusBadge request={h} />
                        <span className="text-[var(--color-text-muted)]">{fmtDate(h.at)}</span>
                      </div>
                      {h.note && <p className="text-[var(--color-text-muted)] mt-0.5">{h.note}</p>}
                      <p className="text-[var(--color-text-muted)]">by {h.byName}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            {(canProcess || canMarkReady || canRequirePayment || canConfirmPayment || canRelease || canCancel) && (
              <div className="border-t border-[var(--color-border)] pt-4 space-y-3">
                <p className="text-xs font-semibold text-[var(--color-text-secondary)]">Actions</p>

                <div className="flex flex-wrap gap-2">
                  {canProcess && (
                    <button onClick={() => act('start_processing')}
                      className="btn btn-primary text-xs gap-1.5">
                      <RotateCcw size={12} /> Start Processing
                    </button>
                  )}
                  {canMarkReady && (
                    <button onClick={() => act('ready', 'Document prepared.')}
                      className="btn btn-primary text-xs gap-1.5">
                      <Package size={12} /> Mark as Ready
                    </button>
                  )}
                  {canRequirePayment && (
                    <button onClick={() => act('for_payment', `Processing fee of ₱${request.fee} required.`)}
                      className="btn text-xs gap-1.5 border border-orange-300 text-orange-700 hover:bg-orange-50 dark:text-orange-400 dark:border-orange-700 dark:hover:bg-orange-900/20">
                      <CreditCard size={12} /> Require Payment (₱{request.fee})
                    </button>
                  )}
                  {canConfirmPayment && (
                    <button onClick={() => act('confirm_payment')}
                      className="btn btn-primary text-xs gap-1.5">
                      <CheckCircle size={12} /> Confirm Payment
                    </button>
                  )}
                  {canRelease && (
                    <button onClick={() => setReleaseModal(true)}
                      className="btn btn-primary text-xs gap-1.5">
                      <Send size={12} /> Release Document
                    </button>
                  )}
                  {canCancel && (
                    <button onClick={() => act('cancel', noteInput || 'Cancelled by registrar.')}
                      className="btn text-xs gap-1.5 border border-red-200 text-red-600 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/20">
                      <X size={12} /> Cancel
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <ToastContainer toasts={toasts} removeToast={removeToast} />
        </div>
      </div>

      {releaseModal && (
        <ReleaseModal request={request} onRelease={handleRelease} onClose={() => setReleaseModal(false)} />
      )}
    </ModalPortal>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function DocumentRequests() {
  const { user }       = useAuth()
  const { currentSchoolYear, activeCampuses } = useAppConfig()

  const campusKey  = user?.campusKey || activeCampuses?.[0]?.key || ''
  const schoolYear = currentSchoolYear?.year || '2025-2026'

  const [requests,    setRequests]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [activeTab,   setActiveTab]   = useState('requests') // 'requests' | 'clearance'
  const [statusFilter,setStatusFilter]= useState('all')
  const [deptFilter,  setDeptFilter]  = useState('all')
  const [search,      setSearch]      = useState('')
  const [showNew,     setShowNew]     = useState(false)
  const [selected,    setSelected]    = useState(null)
  const { toasts, addToast, removeToast } = useToast()

  const role = user?.role
  const isRegistrar  = ['registrar_basic', 'registrar_college', 'technical_admin'].includes(role)
  const isAccounting = ['accounting', 'technical_admin'].includes(role)

  const loadData = useCallback(() => {
    const filters = { campusKey, schoolYear }
    if (statusFilter !== 'all') filters.status = statusFilter
    setRequests(getRequests(filters))
    setLoading(false)
  }, [campusKey, schoolYear, statusFilter])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => {
    const handler = () => loadData()
    window.addEventListener('almirene_documents_updated', handler)
    return () => window.removeEventListener('almirene_documents_updated', handler)
  }, [loadData])

  // Filter for accounting — only show for_payment queue
  const visibleRequests = requests.filter(r => {
    if (isAccounting && !isRegistrar && r.status !== 'for_payment') return false
    if (search) {
      const q = search.toLowerCase()
      return r.studentName?.toLowerCase().includes(q) || r.documentLabel?.toLowerCase().includes(q)
    }
    return true
  })

  // Status counts
  const counts = {}
  REQUEST_STATUSES.forEach(s => {
    counts[s.id] = requests.filter(r => r.status === s.id || (s.id === 'ready_for_pickup' && r.status === 'ready')).length
  })
  const pending = requests.filter(r => !['released', 'cancelled'].includes(r.status)).length

  if (loading) return <PageSkeleton />

  return (
    <div className="page-enter space-y-5">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)]">
            Document Requests
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
            {schoolYear} · {pending > 0 ? `${pending} pending` : 'All up to date'}
          </p>
        </div>
        {isRegistrar && (
          <button onClick={() => setShowNew(true)} className="btn btn-primary gap-1.5 text-sm shrink-0">
            <Plus size={15} /> New Request
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-[var(--color-bg-subtle)] rounded-xl w-fit">
        {[
          { id: 'requests',  label: 'Requests',  icon: FileText },
          { id: 'clearance', label: 'Clearance', icon: ShieldCheck },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${activeTab === tab.id
                ? 'bg-[var(--color-bg-card)] text-[var(--color-text-primary)] shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'}`}>
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── REQUESTS TAB ── */}
      {activeTab === 'requests' && (
        <>
          {/* Status filter chips */}
          <div className="flex flex-wrap gap-2">
            {[{ id: 'all', label: `All (${requests.length})` }, ...REQUEST_STATUSES.map(s => ({ id: s.id, label: `${s.label} (${counts[s.id] || 0})` }))].map(f => (
              <button key={f.id} onClick={() => setStatusFilter(f.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors
                  ${statusFilter === f.id
                    ? 'bg-primary text-white border-primary'
                    : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-primary'}`}>
                {f.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              className="w-full pl-9 pr-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition"
              placeholder="Search by student or document..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Requests list */}
          {visibleRequests.length === 0 ? (
            <div className="card p-10 text-center">
              <FileText size={40} className="text-[var(--color-text-muted)] mx-auto mb-3 opacity-40" />
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">No requests found</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                {statusFilter !== 'all' ? 'Try a different status filter.' : 'Click "New Request" to add one.'}
              </p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              {/* Table header */}
              <div className="hidden sm:grid grid-cols-[1fr_180px_120px_100px_80px] gap-3 px-4 py-2.5 border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)] text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                <span>Student / Document</span>
                <span>Purpose</span>
                <span>Status</span>
                <span>Filed</span>
                <span></span>
              </div>

              <div className="divide-y divide-[var(--color-border)]">
                {visibleRequests.map(req => (
                  <div key={req.id}
                    className="grid grid-cols-1 sm:grid-cols-[1fr_180px_120px_100px_80px] gap-2 sm:gap-3 px-4 py-3 hover:bg-[var(--color-bg-subtle)]/50 transition-colors items-center">
                    <div>
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">{req.studentName}</p>
                      <p className="text-xs text-[var(--color-text-muted)] flex items-center gap-1 mt-0.5">
                        <FileText size={10} />
                        {req.documentLabel}
                        {req.requiresClearance && (
                          <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                            Clearance
                          </span>
                        )}
                        {req.fee > 0 && (
                          <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                            ₱{req.fee}
                          </span>
                        )}
                      </p>
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)] truncate hidden sm:block">{req.purpose}</p>
                    <div className="hidden sm:block"><StatusBadge request={req} /></div>
                    <p className="text-xs text-[var(--color-text-muted)] hidden sm:block">{fmtDate(req.createdAt)}</p>
                    <div className="flex justify-end">
                      <button onClick={() => setSelected(req)}
                        className="p-2 rounded-lg hover:bg-[var(--color-bg-subtle)] transition text-[var(--color-text-muted)] hover:text-primary">
                        <Eye size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── CLEARANCE TAB ── */}
      {activeTab === 'clearance' && (
        <ClearanceTab campusKey={campusKey} schoolYear={schoolYear} currentUser={user} />
      )}

      {/* Modals */}
      {showNew && (
        <NewRequestModal
          campusKey={campusKey}
          schoolYear={schoolYear}
          currentUser={user}
          onSave={() => { setShowNew(false); loadData(); addToast('Request submitted.', 'success') }}
          onClose={() => setShowNew(false)}
        />
      )}

      {selected && (
        <RequestDrawer
          request={selected}
          currentUser={user}
          onUpdate={() => {
            loadData()
            // Refresh selected to get updated data
            const fresh = getRequestById(selected.id)
            if (fresh) setSelected(fresh)
          }}
          onClose={() => setSelected(null)}
        />
      )}

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CLEARANCE TAB COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

function ClearanceTab({ campusKey, schoolYear, currentUser }) {
  const [clearances, setClearances] = useState([])
  const [filter, setFilter] = useState('pending') // 'pending' | 'cleared' | 'all'
  const [selected, setSelected] = useState(null)
  const { toasts, addToast, removeToast } = useToast()

  const loadData = useCallback(() => {
    const all = getClearances({ campusKey, schoolYear })
    setClearances(filter === 'pending' ? all.filter(c => !c.isFullyCleared)
                : filter === 'cleared' ? all.filter(c => c.isFullyCleared)
                : all)
  }, [campusKey, schoolYear, filter])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => {
    const h = () => loadData()
    window.addEventListener('almirene_clearance_updated', h)
    return () => window.removeEventListener('almirene_clearance_updated', h)
  }, [loadData])

  const handleSign = (clearanceId, deptId) => {
    try {
      updateDepartmentClearance(clearanceId, deptId, currentUser?.name ?? 'Unknown')
      addToast(`${deptId} clearance signed.`, 'success')
      loadData()
      if (selected?.id === clearanceId) {
        const fresh = getClearances({ campusKey, schoolYear }).find(c => c.id === clearanceId)
        if (fresh) setSelected(fresh)
      }
    } catch (err) {
      addToast(err.message, 'error')
    }
  }

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex gap-2">
        {[{ id: 'pending', label: 'Pending' }, { id: 'cleared', label: 'Cleared' }, { id: 'all', label: 'All' }].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors
              ${filter === f.id
                ? 'bg-primary text-white border-primary'
                : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-primary'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {clearances.length === 0 ? (
        <div className="card p-10 text-center">
          <ShieldCheck size={40} className="text-[var(--color-text-muted)] mx-auto mb-3 opacity-40" />
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">No clearance records</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">Clearance records are created automatically when a clearance-required document is requested.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {clearances.map(clr => {
            const clearedCount = CLEARANCE_DEPARTMENTS.filter(d => clr.departments[d.id]?.cleared).length
            const totalCount   = CLEARANCE_DEPARTMENTS.length

            return (
              <div key={clr.id} className="card p-4 space-y-3">
                {/* Student info */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-[var(--color-text-primary)]">{clr.studentName}</p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{clr.reason || 'General Clearance'} · {fmtDate(clr.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--color-text-muted)]">{clearedCount}/{totalCount}</span>
                    {clr.isFullyCleared
                      ? <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">Cleared ✓</span>
                      : <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">In Progress</span>
                    }
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 bg-[var(--color-bg-subtle)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${(clearedCount / totalCount) * 100}%` }}
                  />
                </div>

                {/* Department sign-off grid */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {CLEARANCE_DEPARTMENTS.map(dept => {
                    const info    = clr.departments[dept.id] ?? {}
                    const cleared = info.cleared === true
                    return (
                      <div key={dept.id}
                        className={`flex flex-col items-center p-2 rounded-xl border text-center transition-colors
                          ${cleared
                            ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                            : 'bg-[var(--color-bg-page)] border-[var(--color-border)]'}`}>
                        {cleared
                          ? <Check size={14} className="text-green-600 dark:text-green-400 mb-1" />
                          : <Clock size={14} className="text-[var(--color-text-muted)] mb-1" />
                        }
                        <p className={`text-[10px] font-medium ${cleared ? 'text-green-700 dark:text-green-400' : 'text-[var(--color-text-secondary)]'}`}>
                          {dept.label}
                        </p>
                        {!cleared && !clr.isFullyCleared && (
                          <button onClick={() => handleSign(clr.id, dept.id)}
                            className="mt-1.5 text-[10px] px-2 py-0.5 rounded-lg border border-primary text-primary hover:bg-primary hover:text-white transition-colors">
                            Sign
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  )
}