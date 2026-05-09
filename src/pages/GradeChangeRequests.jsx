/**
 * GradeChangeRequests.jsx — ALMIRENE DX
 *
 * Grade Change Request management page.
 * Workflow: Teacher submits → Principal/Program Head reviews → Registrar posts
 *
 * Roles & what they see:
 *   teacher            — Submit new requests for their own approved grades.
 *                        View status of their submitted requests.
 *   principal_basic    — Review Basic Ed requests (approve / reject)
 *   program_head       — Review College requests (approve / reject)
 *   registrar_basic    — Post approved Basic Ed corrections
 *   registrar_college  — Post approved College corrections
 *   technical_admin    — Full access to all requests + audit trail
 *
 * Rule: Audit trail tab is read-only and permanent. Never editable.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  FileEdit, Plus, Search, CheckCircle, X, Clock,
  AlertCircle, Eye, ChevronRight, History,
  Shield, BookOpen, Send, ArrowRight, Info,
} from 'lucide-react'
import { useAuth }      from '../context/AuthContext'
import { useAppConfig } from '../context/AppConfigContext'
import GroupedSelect    from '../components/GroupedSelect'
import {
  ConfirmDialog, useToast, ToastContainer, ModalPortal, PageSkeleton
} from '../components/UIComponents'
import {
  getGradeChangeRequests, submitGradeChangeRequest,
  approveGradeChangeRequest, rejectGradeChangeRequest,
  postGradeCorrection, getRequestAuditTrail, getAllAuditEntries,
  GCR_STATUSES,
} from '../utils/gradeChangeBridge'
import { getAllGrades } from '../engines/gradingEngine'

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_STYLE = {
  requested:     'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  for_registrar: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  posted:        'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  rejected:      'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
}

function StatusBadge({ status }) {
  const def = GCR_STATUSES.find(s => s.id === status)
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_STYLE[status] ?? ''}`}>
      {status === 'requested'     && <Clock size={10} />}
      {status === 'for_registrar' && <ArrowRight size={10} />}
      {status === 'posted'        && <CheckCircle size={10} />}
      {status === 'rejected'      && <X size={10} />}
      {def?.label ?? status}
    </span>
  )
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function GradeTag({ grade, department }) {
  if (!grade) return <span className="text-[var(--color-text-muted)]">—</span>
  const isCollege = department === 'college'
  const num = Number(grade)
  const passed = isCollege ? (!isNaN(num) && num <= 3.00) : (!isNaN(num) && num >= 75)
  return (
    <span className={`font-mono font-bold text-sm ${passed ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
      {grade}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// NEW REQUEST MODAL (Teacher submits)
// ─────────────────────────────────────────────────────────────────────────────

function NewRequestModal({ campusKey, schoolYear, currentUser, onSave, onClose }) {
  const [step,           setStep]           = useState(1) // 1=select grade, 2=fill details
  const [selectedGrade,  setSelectedGrade]  = useState(null)
  const [newGrade,       setNewGrade]       = useState('')
  const [newSpecial,     setNewSpecial]     = useState('')
  const [reason,         setReason]         = useState('')
  const [saving,         setSaving]         = useState(false)
  const [search,         setSearch]         = useState('')
  const { toasts, addToast, removeToast }   = useToast()

  // Load this teacher's approved grades
  const basicGrades = getAllGrades({ teacherId: currentUser?.id, campusKey, schoolYear, status: 'approved' })

  // Read college grades directly (college engine may not be appended yet)
  const collGrades = (() => {
    try {
      const all = JSON.parse(localStorage.getItem('cshc_college_grades') || '[]')
      return all.filter(g =>
        (currentUser?.id ? g.teacherId === currentUser.id : true) &&
        g.campusKey  === campusKey &&
        g.schoolYear === schoolYear &&
        g.status     === 'approved'
      )
    } catch { return [] }
  })()

  const allApproved = [
    ...basicGrades.map(g => ({ ...g, department: 'basicEd', displayGrade: String(g.transmuted ?? '') })),
    ...collGrades .map(g => ({ ...g, department: 'college',  displayGrade: g.specialGrade || g.pointGrade || '' })),
  ]

  const filtered = search
    ? allApproved.filter(g =>
        g.studentName?.toLowerCase().includes(search.toLowerCase()) ||
        g.subjectName?.toLowerCase().includes(search.toLowerCase())
      )
    : allApproved

  const handleSubmit = () => {
    if (!newGrade.trim() && !newSpecial) { addToast('Enter the corrected grade.', 'error'); return }
    if (reason.trim().length < 10) { addToast('Reason must be at least 10 characters.', 'error'); return }
    setSaving(true)
    try {
      submitGradeChangeRequest({
        studentId:    selectedGrade.studentId,
        studentName:  selectedGrade.studentName,
        subjectId:    selectedGrade.subjectId,
        subjectName:  selectedGrade.subjectName,
        sectionId:    selectedGrade.sectionId,
        period:       selectedGrade.period,
        semester:     selectedGrade.semester,
        schoolYear,
        campusKey,
        department:   selectedGrade.department,
        teacherId:    currentUser?.id,
        teacherName:  currentUser?.name,
        oldGrade:     selectedGrade.displayGrade,
        newGrade:     newGrade.trim(),
        newSpecialGrade: newSpecial || null,
        reason,
      })
      onSave()
    } catch (err) {
      addToast(err.message, 'error')
      setSaving(false)
    }
  }

  return (
    <ModalPortal>
      <div className="modal-backdrop">
        <div className="modal-panel" style={{ maxWidth: '38rem' }}>
          <div className="flex items-center justify-between p-5 border-b border-[var(--color-border)]">
            <div>
              <h2 className="text-base font-bold text-[var(--color-text-primary)]">New Grade Change Request</h2>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                Step {step} of 2 — {step === 1 ? 'Select the grade to correct' : 'Provide correction details'}
              </p>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--color-bg-subtle)] transition">
              <X size={16} className="text-[var(--color-text-muted)]" />
            </button>
          </div>

          <div className="p-5 max-h-[65vh] overflow-y-auto">
            {/* ── Step 1: Select the grade to correct ── */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl text-xs text-amber-800 dark:text-amber-300">
                  <AlertCircle size={13} className="shrink-0 mt-0.5" />
                  Only <strong>approved</strong> grades can have a change request. Draft or submitted grades should be edited directly in e-Class Record.
                </div>

                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                  <input className="w-full pl-9 pr-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition"
                    placeholder="Search by student or subject..." value={search}
                    onChange={e => setSearch(e.target.value)} />
                </div>

                {filtered.length === 0 ? (
                  <div className="text-center py-8">
                    <BookOpen size={32} className="mx-auto mb-2 text-[var(--color-text-muted)] opacity-40" />
                    <p className="text-sm text-[var(--color-text-muted)]">No approved grades found.</p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">Only grades with status "approved" appear here.</p>
                  </div>
                ) : (
                  <div className="space-y-1 max-h-72 overflow-y-auto">
                    {filtered.map(g => (
                      <button key={`${g.id}`} onClick={() => { setSelectedGrade(g); setStep(2) }}
                        className="w-full text-left flex items-center justify-between p-3 rounded-xl border border-[var(--color-border)] hover:border-primary hover:bg-[var(--color-bg-subtle)] transition-colors">
                        <div>
                          <p className="text-sm font-medium text-[var(--color-text-primary)]">{g.studentName}</p>
                          <p className="text-xs text-[var(--color-text-muted)]">
                            {g.subjectName} · {g.department === 'college' ? g.semester : g.period} ·
                            <span className={`ml-1 font-mono font-bold ${g.department === 'college' ? (Number(g.displayGrade) <= 3 ? 'text-green-600' : 'text-red-500') : (Number(g.displayGrade) >= 75 ? 'text-green-600' : 'text-red-500')}`}>
                              {g.displayGrade}
                            </span>
                          </p>
                        </div>
                        <ChevronRight size={14} className="text-[var(--color-text-muted)]" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Step 2: Fill in correction details ── */}
            {step === 2 && selectedGrade && (
              <div className="space-y-4">
                {/* Selected grade card */}
                <div className="p-4 rounded-xl bg-[var(--color-bg-subtle)] border border-[var(--color-border)]">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Grade to Correct</p>
                    <button onClick={() => setStep(1)} className="text-xs text-primary hover:underline">Change</button>
                  </div>
                  <p className="text-sm font-bold text-[var(--color-text-primary)]">{selectedGrade.studentName}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {selectedGrade.subjectName} · {selectedGrade.department === 'college' ? selectedGrade.semester : selectedGrade.period}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-[var(--color-text-muted)]">Current grade:</span>
                    <GradeTag grade={selectedGrade.displayGrade} department={selectedGrade.department} />
                  </div>
                </div>

                {/* New grade */}
                <div>
                  <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
                    Corrected Grade *
                  </label>
                  <input
                    className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition font-mono"
                    placeholder={selectedGrade.department === 'college' ? 'e.g. 1.75' : 'e.g. 88'}
                    value={newGrade}
                    onChange={e => setNewGrade(e.target.value)}
                  />
                </div>

                {/* Special grade (college only) */}
                {selectedGrade.department === 'college' && (
                  <div>
                    <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
                      Special Grade Override <span className="font-normal text-[var(--color-text-muted)]">(optional)</span>
                    </label>
                    <GroupedSelect
                      value={newSpecial || 'all'}
                      onChange={v => setNewSpecial(v === 'all' ? '' : v)}
                      options={[
                        { value: 'INC',  label: 'INC — Incomplete' },
                        { value: 'DRP',  label: 'DRP — Dropped' },
                        { value: '4.00', label: '4.00 — Conditional Failure' },
                      ]}
                      allLabel="None — use numeric grade above"
                      placeholder="None"
                    />
                  </div>
                )}

                {/* Reason */}
                <div>
                  <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
                    Reason for Correction * <span className="font-normal text-[var(--color-text-muted)]">(min 10 characters)</span>
                  </label>
                  <textarea
                    className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition resize-none"
                    rows={3}
                    placeholder="e.g. Encoding error — actual score was 92, not 85. Supporting paper enclosed."
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                  />
                  <p className={`text-[10px] mt-0.5 ${reason.trim().length < 10 ? 'text-amber-600 dark:text-amber-400' : 'text-[var(--color-text-muted)]'}`}>
                    {reason.trim().length} / 10 minimum characters
                  </p>
                </div>

                {/* Preview */}
                {(newGrade.trim() || newSpecial) && (
                  <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-xl text-sm">
                    <span className="text-[var(--color-text-muted)] text-xs">Change preview:</span>
                    <GradeTag grade={selectedGrade.displayGrade} department={selectedGrade.department} />
                    <ArrowRight size={14} className="text-[var(--color-text-muted)]" />
                    <GradeTag grade={newSpecial || newGrade.trim()} department={selectedGrade.department} />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 p-5 border-t border-[var(--color-border)]">
            <button onClick={onClose} className="btn btn-ghost text-sm">Cancel</button>
            {step === 2 && (
              <button onClick={handleSubmit}
                disabled={saving || (!newGrade.trim() && !newSpecial) || reason.trim().length < 10}
                className="btn btn-primary text-sm gap-1.5 disabled:opacity-50">
                <Send size={14} /> Submit Request
              </button>
            )}
          </div>
          <ToastContainer toasts={toasts} removeToast={removeToast} />
        </div>
      </div>
    </ModalPortal>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// REQUEST DETAIL DRAWER
// ─────────────────────────────────────────────────────────────────────────────

function RequestDrawer({ request, currentUser, onUpdate, onClose }) {
  const [rejectModal,   setRejectModal]   = useState(false)
  const [rejectReason,  setRejectReason]  = useState('')
  const [postConfirm,   setPostConfirm]   = useState(false)
  const [audit,         setAudit]         = useState([])
  const { toasts, addToast, removeToast } = useToast()

  const role = currentUser?.role
  const canApprove = (['principal_basic', 'program_head', 'technical_admin'].includes(role))
    && request.status === 'requested'
  const canPost    = (['registrar_basic', 'registrar_college', 'technical_admin'].includes(role))
    && request.status === 'for_registrar'

  useEffect(() => {
    setAudit(getRequestAuditTrail(request.id))
  }, [request.id])

  const handleApprove = () => {
    try {
      approveGradeChangeRequest(request.id, currentUser?.name)
      addToast('Request approved. Sent to registrar for posting.', 'success')
      onUpdate()
    } catch (err) { addToast(err.message, 'error') }
  }

  const handleReject = () => {
    if (!rejectReason.trim()) { addToast('Please provide a rejection reason.', 'error'); return }
    try {
      rejectGradeChangeRequest(request.id, currentUser?.name, rejectReason)
      addToast('Request rejected.', 'success')
      setRejectModal(false)
      onUpdate()
    } catch (err) { addToast(err.message, 'error') }
  }

  const handlePost = () => {
    try {
      postGradeCorrection(request.id, currentUser?.name)
      addToast('Grade correction posted successfully.', 'success')
      setPostConfirm(false)
      onUpdate()
    } catch (err) { addToast(err.message, 'error'); setPostConfirm(false) }
  }

  return (
    <ModalPortal>
      <div className="modal-backdrop">
        <div className="modal-panel" style={{ maxWidth: '40rem' }}>
          {/* Header */}
          <div className="flex items-start justify-between p-5 border-b border-[var(--color-border)]">
            <div>
              <h3 className="text-base font-bold text-[var(--color-text-primary)]">Grade Change Request</h3>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                {request.studentName} · {request.subjectName}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={request.status} />
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--color-bg-subtle)] transition">
                <X size={16} className="text-[var(--color-text-muted)]" />
              </button>
            </div>
          </div>

          <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
            {/* Details grid */}
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Student',       request.studentName],
                ['Subject',       request.subjectName],
                ['Period',        request.department === 'college' ? request.semester : request.period],
                ['Department',    request.department === 'college' ? 'College' : 'Basic Ed'],
                ['Submitted By',  request.submittedBy],
                ['Filed On',      fmtDate(request.createdAt)],
              ].map(([label, value]) => (
                <div key={label} className="bg-[var(--color-bg-subtle)] rounded-xl p-3">
                  <p className="text-[10px] text-[var(--color-text-muted)] font-medium uppercase tracking-wide">{label}</p>
                  <p className="text-sm text-[var(--color-text-primary)] font-medium mt-0.5">{value}</p>
                </div>
              ))}
            </div>

            {/* Grade change */}
            <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-page)]">
              <p className="text-xs font-semibold text-[var(--color-text-secondary)] mb-3">Proposed Correction</p>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-[10px] text-[var(--color-text-muted)] mb-1">Current</p>
                  <GradeTag grade={request.oldGrade} department={request.department} />
                </div>
                <ArrowRight size={18} className="text-[var(--color-text-muted)]" />
                <div className="text-center">
                  <p className="text-[10px] text-[var(--color-text-muted)] mb-1">Corrected</p>
                  <GradeTag grade={request.newSpecialGrade || request.newGrade} department={request.department} />
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
                <p className="text-[10px] text-[var(--color-text-muted)] font-medium uppercase tracking-wide mb-1">Reason</p>
                <p className="text-sm text-[var(--color-text-primary)]">{request.reason}</p>
              </div>
              {request.rejectedReason && (
                <div className="mt-3 pt-3 border-t border-red-200 dark:border-red-800">
                  <p className="text-[10px] text-red-600 dark:text-red-400 font-semibold uppercase tracking-wide mb-1">Rejection Reason</p>
                  <p className="text-sm text-red-700 dark:text-red-300">{request.rejectedReason}</p>
                </div>
              )}
            </div>

            {/* Audit trail */}
            {audit.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-[var(--color-text-secondary)] mb-2 flex items-center gap-1">
                  <History size={12} /> Audit Trail
                  <span className="text-[10px] font-normal text-[var(--color-text-muted)] ml-1">(permanent — read only)</span>
                </p>
                <div className="space-y-2">
                  {audit.map((entry, i) => (
                    <div key={i} className="flex items-start gap-3 text-xs">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                      <div>
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold mr-1
                          ${entry.action === 'posted' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : entry.action === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                          {entry.action.toUpperCase()}
                        </span>
                        <span className="text-[var(--color-text-muted)]">{entry.detail}</span>
                        <p className="text-[var(--color-text-muted)] mt-0.5">{entry.by} · {fmtDate(entry.at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            {(canApprove || canPost) && (
              <div className="border-t border-[var(--color-border)] pt-4 flex flex-wrap gap-2">
                {canApprove && (
                  <>
                    <button onClick={handleApprove}
                      className="btn btn-primary text-xs gap-1.5">
                      <CheckCircle size={13} /> Approve — Send to Registrar
                    </button>
                    <button onClick={() => setRejectModal(true)}
                      className="btn text-xs gap-1.5 border border-red-200 text-red-600 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/20">
                      <X size={13} /> Reject Request
                    </button>
                  </>
                )}
                {canPost && (
                  <button onClick={() => setPostConfirm(true)}
                    className="btn btn-primary text-xs gap-1.5">
                    <FileEdit size={13} /> Post Grade Correction
                  </button>
                )}
              </div>
            )}
          </div>

          <ToastContainer toasts={toasts} removeToast={removeToast} />
        </div>
      </div>

      {/* Reject modal */}
      {rejectModal && (
        <ModalPortal>
          <div className="modal-backdrop" style={{ zIndex: 10001 }}>
            <div className="modal-panel" style={{ maxWidth: '26rem', zIndex: 10002 }}>
              <div className="p-5">
                <h3 className="text-sm font-bold text-[var(--color-text-primary)] mb-3">Reject Grade Change Request</h3>
                <textarea
                  className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary resize-none"
                  rows={3} placeholder="Reason for rejection (required)..."
                  value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                />
                <div className="flex justify-end gap-2 mt-3">
                  <button onClick={() => setRejectModal(false)} className="btn btn-ghost text-sm">Cancel</button>
                  <button onClick={handleReject} disabled={!rejectReason.trim()}
                    className="btn text-sm bg-red-600 text-white hover:bg-red-700 gap-1.5 disabled:opacity-50">
                    <X size={13} /> Confirm Rejection
                  </button>
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      <ConfirmDialog
        open={postConfirm}
        title="Post Grade Correction"
        message={`This will permanently update ${request.studentName}'s grade for ${request.subjectName} from ${request.oldGrade} to ${request.newSpecialGrade || request.newGrade}. The audit trail will record this action permanently. Proceed?`}
        confirmLabel="Post Correction"
        danger={false}
        onConfirm={handlePost}
        onCancel={() => setPostConfirm(false)}
      />
    </ModalPortal>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function GradeChangeRequests() {
  const { user }       = useAuth()
  const { currentSchoolYear, activeCampuses } = useAppConfig()

  const campusKey  = user?.campusKey || activeCampuses?.[0]?.key || ''
  const schoolYear = currentSchoolYear?.year || '2025-2026'

  const [requests,      setRequests]      = useState([])
  const [loading,       setLoading]       = useState(true)
  const [statusFilter,  setStatusFilter]  = useState('all')
  const [search,        setSearch]        = useState('')
  const [showNew,       setShowNew]       = useState(false)
  const [selected,      setSelected]      = useState(null)
  const [activeTab,     setActiveTab]     = useState('requests') // 'requests' | 'audit'
  const [auditAll,      setAuditAll]      = useState([])
  const { toasts, addToast, removeToast } = useToast()

  const role        = user?.role
  const isTeacher   = role === 'teacher'
  const isReviewer  = ['principal_basic', 'program_head', 'technical_admin'].includes(role)
  const isRegistrar = ['registrar_basic', 'registrar_college', 'technical_admin'].includes(role)
  const isSuperAdmin = role === 'technical_admin'

  const loadData = useCallback(() => {
    const filters = { campusKey, schoolYear }
    if (isTeacher) filters.teacherId = user?.id
    if (statusFilter !== 'all') filters.status = statusFilter
    setRequests(getGradeChangeRequests(filters))
    if (isSuperAdmin) setAuditAll(getAllAuditEntries(campusKey))
    setLoading(false)
  }, [campusKey, schoolYear, statusFilter, isTeacher, isSuperAdmin, user?.id])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => {
    const h = () => loadData()
    window.addEventListener('almirene_grade_change_updated', h)
    return () => window.removeEventListener('almirene_grade_change_updated', h)
  }, [loadData])

  const filtered = requests.filter(r => {
    if (!search) return true
    const q = search.toLowerCase()
    return r.studentName?.toLowerCase().includes(q) || r.subjectName?.toLowerCase().includes(q)
  })

  const counts = {}
  GCR_STATUSES.forEach(s => { counts[s.id] = requests.filter(r => r.status === s.id).length })
  const pending = requests.filter(r => !['posted', 'rejected'].includes(r.status)).length

  if (loading) return <PageSkeleton />

  return (
    <div className="page-enter space-y-5">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)]">
            Grade Change Requests
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
            {schoolYear} · {pending > 0 ? `${pending} pending` : 'No pending requests'}
          </p>
        </div>
        {isTeacher && (
          <button onClick={() => setShowNew(true)} className="btn btn-primary gap-1.5 text-sm shrink-0">
            <Plus size={15} /> New Request
          </button>
        )}
      </div>

      {/* Compliance notice */}
      <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 text-xs text-blue-800 dark:text-blue-300">
        <Shield size={13} className="shrink-0 mt-0.5" />
        <span>
          <strong>Compliance Notice:</strong> All grade change requests and audit trail entries are permanent and cannot be modified or deleted. Every action is timestamped and attributed.
        </span>
      </div>

      {/* Tabs (Super Admin gets audit trail tab) */}
      {isSuperAdmin && (
        <div className="flex gap-1 p-1 bg-[var(--color-bg-subtle)] rounded-xl w-fit">
          {[{ id: 'requests', label: 'Requests', icon: FileEdit }, { id: 'audit', label: 'Audit Trail', icon: History }].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                ${activeTab === tab.id
                  ? 'bg-[var(--color-bg-card)] text-[var(--color-text-primary)] shadow-sm'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'}`}>
              <tab.icon size={14} />{tab.label}
            </button>
          ))}
        </div>
      )}

      {/* ── REQUESTS TAB ── */}
      {activeTab === 'requests' && (
        <>
          {/* Status filter chips */}
          <div className="flex flex-wrap gap-2">
            {[{ id: 'all', label: `All (${requests.length})` }, ...GCR_STATUSES.map(s => ({ id: s.id, label: `${s.label} (${counts[s.id] || 0})` }))].map(f => (
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
            <input className="w-full pl-9 pr-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition"
              placeholder="Search by student or subject..." value={search}
              onChange={e => setSearch(e.target.value)} />
          </div>

          {/* Requests list */}
          {filtered.length === 0 ? (
            <div className="card p-10 text-center">
              <FileEdit size={40} className="mx-auto mb-3 text-[var(--color-text-muted)] opacity-40" />
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">No requests found</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                {isTeacher ? 'Click "New Request" to file a grade correction.' : 'No grade change requests to review.'}
              </p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="hidden sm:grid grid-cols-[1fr_150px_100px_90px_80px_60px] gap-3 px-4 py-2.5 border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)] text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                <span>Student / Subject</span>
                <span>Change</span>
                <span>Period</span>
                <span>Status</span>
                <span>Filed</span>
                <span></span>
              </div>

              <div className="divide-y divide-[var(--color-border)]">
                {filtered.map(req => (
                  <div key={req.id}
                    className="grid grid-cols-1 sm:grid-cols-[1fr_150px_100px_90px_80px_60px] gap-2 sm:gap-3 px-4 py-3 hover:bg-[var(--color-bg-subtle)]/50 transition-colors items-center">
                    <div>
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">{req.studentName}</p>
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{req.subjectName}</p>
                    </div>
                    <div className="hidden sm:flex items-center gap-1.5">
                      <GradeTag grade={req.oldGrade} department={req.department} />
                      <ArrowRight size={12} className="text-[var(--color-text-muted)]" />
                      <GradeTag grade={req.newSpecialGrade || req.newGrade} department={req.department} />
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)] hidden sm:block">
                      {req.department === 'college' ? req.semester : req.period}
                    </p>
                    <div className="hidden sm:block"><StatusBadge status={req.status} /></div>
                    <p className="text-xs text-[var(--color-text-muted)] hidden sm:block">
                      {new Date(req.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                    </p>
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

      {/* ── AUDIT TRAIL TAB (Super Admin only) ── */}
      {activeTab === 'audit' && isSuperAdmin && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)] flex items-center gap-2">
            <History size={14} className="text-[var(--color-text-muted)]" />
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">System-Wide Audit Trail</p>
            <span className="text-xs text-[var(--color-text-muted)] ml-auto">{auditAll.length} entries · Read-only</span>
          </div>
          {auditAll.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-[var(--color-text-muted)]">No audit entries yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-border)] max-h-[60vh] overflow-y-auto">
              {auditAll.map((entry, i) => (
                <div key={i} className="px-4 py-3 flex items-start gap-3">
                  <div className={`mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0
                    ${entry.action === 'posted' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : entry.action === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    : entry.action === 'approved' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
                    {entry.action.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[var(--color-text-primary)]">{entry.detail}</p>
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                      {entry.by} · {fmtDate(entry.at)} · Request: <code className="font-mono">{entry.requestId}</code>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showNew && (
        <NewRequestModal
          campusKey={campusKey}
          schoolYear={schoolYear}
          currentUser={user}
          onSave={() => { setShowNew(false); loadData(); addToast('Grade change request submitted.', 'success') }}
          onClose={() => setShowNew(false)}
        />
      )}

      {selected && (
        <RequestDrawer
          request={selected}
          currentUser={user}
          onUpdate={() => {
            loadData()
            // Refresh selected record
            const fresh = getGradeChangeRequests({ campusKey, schoolYear }).find(r => r.id === selected.id)
            if (fresh) setSelected(fresh); else setSelected(null)
          }}
          onClose={() => setSelected(null)}
        />
      )}

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  )
}