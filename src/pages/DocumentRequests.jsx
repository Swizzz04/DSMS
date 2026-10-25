/**
 * DocumentRequests.jsx — ALMIRENE DX
 * Document Requests
 * (Student Clearance is worked on the Clearance page; a request's drawer shows its status
 *  and links there.)
 *
 * Roles:
 *   registrar_basic   — sees Basic Ed requests, manages workflow, releases docs
 *   registrar_college — sees College requests, manages workflow, releases docs
 *   accounting        — sees "for_payment" queue, confirms fee payments
 *   principal_basic   — signs Admin Office clearance
 *   program_head      — signs Admin Office clearance (college)
 *   technical_admin   — sees everything; the only role that opens Formats (sets up the documents)
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileText, Plus, Search, Filter, ChevronDown,
  Check, X, Clock, AlertCircle, Package, Send,
  User, CreditCard, Eye, RotateCcw, CheckCircle,
  ClipboardList, ShieldCheck, Building2, BookOpen, Receipt, Printer, GraduationCap, Tag, Trash2, Upload,
} from 'lucide-react'
import { useAuth }      from '../context/AuthContext'
import { useAppConfig } from '../context/AppConfigContext'
import { useCampusFilter } from '../context/CampusFilterContext'
import GroupedSelect    from '../components/GroupedSelect'
import { SortTh, Pager, useTablePaging } from '../components/DataTable'
import DatePicker       from '../components/DatePicker'
import { ConfirmDialog, useToast, ToastContainer, ModalPortal, PageSkeleton } from '../components/UIComponents'
import {
  getRequests, getRequestById, createRequest, createGraduateRequest,
  updateStatus, confirmDocumentPayment, releaseDocument, cancelRequest,
  getClearanceById, createClearance,
  checkAccountingStatus, isFullyCleared, linkClearanceToRequest,
  getClearanceWaitingOn,
  getDocumentTypes, hasCustomDocumentTypes, saveDocumentTypes, saveDocumentFees, resetDocumentTypes,
  removeDocumentType,
  REQUEST_STATUSES, CLEARANCE_DEPARTMENTS,
  getDocumentActions, advanceDocumentStep, getDocumentStepDef, statusMatches, clearanceBlocksRelease,
} from '../utils/documentBridge'
import { getStudents } from '../utils/enrollmentBridge'
import { suggestOrNumber, isOrNumberUsed } from '../utils/orNumbers'
import { printReceiptHtml } from '../utils/printReceipt'
import FormatsTab from '../components/documents/FormatsTab'
import PrintTab, { getPrintJob, isPrintable, PrintPreviewModal, hasFormat } from '../components/documents/PrintTab'
import { getTemplate, removeTemplate } from '../utils/documentTemplates'
import { DOCUMENT_PAYMENT_METHODS, DOCUMENT_REQUEST_PURPOSES, DOCUMENT_TRASH_RETENTION_DAYS } from '../config/appConfig'

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

// Years offered for "year graduated": this year back 40 years. Built from the
// clock, so it moves forward by itself every January.
const graduationYears = () => {
  const y = new Date().getFullYear()
  return Array.from({ length: 41 }, (_, i) => String(y - i))
}

// The day a timestamp falls on in the user's own time zone, as YYYY-MM-DD
const localYMD = (iso) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const peso = n => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const STATUS_STYLE = {
  requested:   'bg-[var(--color-pending-bg)] text-[var(--color-pending-text)]',
  processing:  'bg-[var(--color-info-light)] text-[var(--color-info-text)]',
  for_payment: 'bg-[var(--color-warning-light)] text-[var(--color-warning-text)]',
  ready:       'bg-[var(--color-cat-indigo-bg)] text-[var(--color-cat-indigo-text)]',
  released:    'bg-[var(--color-success-light)] text-[var(--color-success-text)]',
  cancelled:   'bg-[var(--color-border)] text-[var(--color-text-secondary)]',
}

const STATUS_ICON = {
  requested:   Clock,
  processing:  RotateCcw,
  for_payment: CreditCard,
  ready:       Package,
  released:    CheckCircle,
  cancelled:   X,
}

// A stored request can hold the legacy 'ready' or the workflow id 'ready_for_pickup'
const STATUS_KEY_ALIAS = { ready_for_pickup: 'ready' }
const statusKey = (s) => STATUS_KEY_ALIAS[s] ?? s

function getStatusStyle(request) {
  return STATUS_STYLE[statusKey(request?.status)] ?? STATUS_STYLE.cancelled
}

// Label follows the (admin-configurable) workflow step, with a static fallback
function getStatusLabel(request) {
  let stepLabel
  try { stepLabel = getDocumentStepDef(request)?.label } catch { /* workflow not configured */ }
  return stepLabel
    ?? REQUEST_STATUSES.find(s => s.id === statusKey(request?.status))?.label
    ?? request?.status
    ?? ''
}

function StatusBadge({ request, status: statusProp }) {
  const status = statusKey(request?.status ?? statusProp ?? '')
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
  const [levelFilter, setLevelFilter] = useState('all')   // grade level (Basic Ed) or year level (College)
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [docType, setDocType]   = useState('')
  const [purposeChoice, setPurposeChoice] = useState('')   // a listed purpose, or OTHER_PURPOSE
  const [purposeOther,  setPurposeOther]  = useState('')
  const purpose = (purposeChoice === OTHER_PURPOSE ? purposeOther : purposeChoice).trim()
  const [requestedBy, setRequestedBy] = useState('student')
  const [requestorName, setRequestorName] = useState('')
  const [saving, setSaving] = useState(false)
  const { toasts, addToast, removeToast } = useToast()

  // Load students from enrollmentBridge
  // A department registrar only files for their own students (technical admin sees both)
  const { isBasicGrade, basicEdGroups, collegeYearLevels } = useAppConfig()
  const studentDept = (st) => st?.department || (isBasicGrade(st?.gradeLevel) ? 'basicEd' : 'college')
  const lockedDept  = currentUser?.role === 'registrar_basic' ? 'basicEd'
                    : currentUser?.role === 'registrar_college' ? 'college' : null
  const allStudents = (getStudents({ campusKey, schoolYear }) || [])
    .filter(st => !lockedDept || studentDept(st) === lockedDept)
  // Results appear from the first letter typed
  const q = studentSearch.trim().toLowerCase()
  // College levels are stored as "Program - 1st Year"; Basic Ed as "Grade 7". Exact match only.
  const matchesLevel = (st) => levelFilter === 'all'
    || st.gradeLevel === levelFilter
    || String(st.gradeLevel || '').split(' - ').pop() === levelFilter
  const levelGroups = [
    ...(lockedDept !== 'college' ? (basicEdGroups || []).map(g => ({ label: g.label, options: g.options.map(o => ({ value: o, label: o })) })) : []),
    ...(lockedDept !== 'basicEd' ? [{ label: 'College year level', options: (collegeYearLevels || []).map(y => ({ value: y, label: y })) }] : []),
  ]
  const filteredStudents = (q || levelFilter !== 'all')
    ? allStudents.filter(matchesLevel).filter(s => !q ||
        s.firstName?.toLowerCase().includes(q) ||
        s.lastName?.toLowerCase().includes(q) ||
        `${s.lastName || ''}, ${s.firstName || ''}`.toLowerCase().includes(q) ||
        String(s.studentId || '').toLowerCase().includes(q)
      ).slice(0, 30)
    : []

  const department = selectedStudent ? studentDept(selectedStudent) : 'basicEd'
  const docTypes   = getDocumentTypes(campusKey, department)
  const selectedDoc = docTypes.find(d => d.id === docType)
  // No uploaded format → the request can't be filed (the technical admin uploads formats)
  const missingFormat = !!selectedDoc && !hasFormat({ department, documentType: selectedDoc.id }, campusKey)

  const handleSave = () => {
    if (!selectedStudent) { addToast('Please select a student', 'error'); return }
    if (!docType) { addToast('Please select a document type', 'error'); return }
    if (missingFormat) { addToast('This document has no format uploaded yet, so it can\'t be requested.', 'error'); return }
    if (!purpose) { addToast('Please state the purpose', 'error'); return }
    setSaving(true)

    let record
    try {
      record = createRequest({
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
      purpose,
      requestedBy,
      requestorName: requestedBy === 'student' ? selectedStudent.firstName : requestorName,
      createdBy:     currentUser?.name,
      createdByName: currentUser?.name,
      })
    } catch (err) {
      // e.g. the format was removed while this window was open
      addToast(err.message, 'error')
      setSaving(false)
      return
    }

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
            <button onClick={onClose} aria-label="Close" className="p-2 rounded-lg hover:bg-[var(--color-bg-subtle)] transition">
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
                <div className="flex items-center justify-between p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-success-light)]">
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {selectedStudent.lastName}, {selectedStudent.firstName}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {selectedStudent.gradeLevel} · {selectedStudent.studentId}
                    </p>
                  </div>
                  <button onClick={() => { setSelectedStudent(null); setDocType('') }}
                    className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition">
                    Change
                  </button>
                </div>
              ) : (
                <div>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                    <input
                      className="w-full pl-9 pr-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition"
                      placeholder="Search by name or student ID..."
                      value={studentSearch}
                      onChange={e => setStudentSearch(e.target.value)}
                    />
                  </div>
                  <div className="mt-2">
                    <GroupedSelect
                      value={levelFilter}
                      onChange={setLevelFilter}
                      groups={levelGroups}
                      allLabel={lockedDept === 'college' ? 'All year levels' : lockedDept === 'basicEd' ? 'All grade levels' : 'All levels'}
                      placeholder={lockedDept === 'college' ? 'All year levels' : lockedDept === 'basicEd' ? 'All grade levels' : 'All levels'}
                    />
                  </div>
                  {filteredStudents.length > 0 && (
                    <div className="mt-1.5 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl overflow-y-auto max-h-56">
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
                  {(q || levelFilter !== 'all') && filteredStudents.length === 0 && (
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
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-[var(--color-warning-text)]">
                    <AlertCircle size={12} />
                    This document requires student clearance before release.
                  </div>
                )}
                <NoFormatNotice campusKey={campusKey} department={department} documentType={selectedDoc?.id} />
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
                <GroupedSelect
                  value={purposeChoice || 'all'}
                  onChange={v => setPurposeChoice(v === 'all' ? '' : v)}
                  options={[...DOCUMENT_REQUEST_PURPOSES, OTHER_PURPOSE].map(p => ({ value: p, label: p }))}
                  allLabel="Select purpose..."
                  placeholder="Select purpose..."
                />
                {purposeChoice === OTHER_PURPOSE && (
                  <input
                    className="w-full mt-2 px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition"
                    placeholder="Type the purpose"
                    value={purposeOther}
                    onChange={e => setPurposeOther(e.target.value)}
                    autoFocus
                  />
                )}
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
                          ? 'is-selected'
                          : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary-readable)]'}`}>
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
            <button onClick={handleSave} disabled={saving || !selectedStudent || !docType || !purpose || missingFormat}
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

// Shown when the chosen document has no uploaded format: it can't be requested until one is uploaded
function NoFormatNotice({ campusKey, department, documentType }) {
  if (!documentType || hasFormat({ department, documentType }, campusKey)) return null
  return (
    <div className="flex items-start gap-1.5 mt-2 text-xs text-[var(--color-warning-text)]">
      <AlertCircle size={12} className="shrink-0 mt-0.5" />
      <span>No format uploaded for this document yet. It can't be requested until the technical admin uploads one.</span>
    </div>
  )
}

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
              <div className="flex items-start gap-2 p-3 bg-[var(--color-error-light)] border border-[var(--color-error-border)] rounded-xl text-xs text-[var(--color-error-text)]">
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

function ClearancePanel({ clearanceId }) {
  const navigate = useNavigate()
  const [clearance, setClearance] = useState(null)

  const load = useCallback(() => {
    if (clearanceId) {
      setClearance(getClearanceById(clearanceId))
    }
  }, [clearanceId])

  useEffect(() => { load() }, [load])

  // Stay in sync when the clearance is signed on the Clearance page (this or another window)
  useEffect(() => {
    const h = () => load()
    const onStorage = (e) => { if (e.key === 'almirene_clearance' || e.key === null) load() }
    window.addEventListener('almirene_clearance_updated', h)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('almirene_clearance_updated', h)
      window.removeEventListener('storage', onStorage)
    }
  }, [load])

  if (!clearanceId) return null
  if (!clearance)   return <p className="text-xs text-[var(--color-text-muted)] italic">Loading clearance...</p>

  const waitingOn = getClearanceWaitingOn(clearance).map(d => d.label).join(', ')

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck size={14} className={clearance.isFullyCleared ? 'text-[var(--color-success)]' : 'text-[var(--color-warning)]'} />
        <span className={`text-xs font-semibold ${clearance.isFullyCleared ? 'text-[var(--color-success-text)]' : 'text-[var(--color-warning-text)]'}`}>
          {clearance.isFullyCleared ? 'Fully Cleared ✓' : 'Clearance In Progress'}
        </span>
        {waitingOn && (
          <span className="text-[10px] text-[var(--color-text-muted)]">· Waiting on {waitingOn}</span>
        )}
      </div>

      {CLEARANCE_DEPARTMENTS.map(dept => {
        const info    = clearance.departments[dept.id] ?? {}
        const cleared = info.cleared === true

        return (
          <div key={dept.id} className={`flex items-center justify-between p-3 rounded-xl border transition-colors
            ${cleared
              ? 'bg-[var(--color-success-light)] border-[var(--color-success-border)]'
              : 'bg-[var(--color-bg-page)] border-[var(--color-border)]'}`}>
            <div className="flex items-center gap-2 min-w-0">
              {cleared
                ? <Check size={13} className="text-[var(--color-success-text)] shrink-0" />
                : <Clock size={13} className="text-[var(--color-text-muted)] shrink-0" />
              }
              <div className="min-w-0">
                <p className={`text-xs font-medium ${cleared ? 'text-[var(--color-success-text)]' : 'text-[var(--color-text-primary)]'}`}>
                  {dept.label}
                </p>
                {cleared && (
                  <p className="text-[10px] text-[var(--color-text-muted)]">
                    {info.clearedBy} · {fmtDate(info.clearedAt)}
                  </p>
                )}
                {cleared && info.withBalance && (
                  <p className="text-[10px] text-[var(--color-warning-text)] font-semibold">
                    Cleared with balance of ₱{Number(info.balanceAtSignoff || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </p>
                )}
                {cleared && info.balanceUnverified && (
                  <p className="text-[10px] text-[var(--color-warning-text)] font-semibold">Balance verified manually</p>
                )}
                {cleared && info.note && (
                  <p className="text-[10px] text-[var(--color-text-secondary)] break-words">Note: {info.note}</p>
                )}
              </div>
            </div>
          </div>
        )
      })}

      <button
        type="button"
        onClick={() => navigate(`/clearance?id=${encodeURIComponent(clearanceId)}`)}
        className="btn btn-ghost text-xs gap-1.5 w-full justify-center mt-1">
        <ShieldCheck size={12} /> Open in Clearance page
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// GRADUATE REQUEST MODAL (the registrar files a request for a former student)
// ─────────────────────────────────────────────────────────────────

const OTHER_PURPOSE = 'Other'

const GRADUATE_DEPARTMENTS = [
  { id: 'basicEd', label: 'Basic Ed graduate' },
  { id: 'college', label: 'College graduate'  },
]

function RecordGraduateRequestModal({ campusKey, campusName, schoolYear, currentUser, lockedDepartment, onRecorded, onClose }) {
  // A department registrar can only file for their own department; technical admin chooses
  const [department, setDepartment] = useState(lockedDepartment || 'basicEd')
  const [docType,    setDocType]    = useState('')
  const [firstName,  setFirstName]  = useState('')
  const [lastName,   setLastName]   = useState('')
  const [formerId,   setFormerId]   = useState('')
  const [lastLevel,  setLastLevel]  = useState('')   // Basic Ed grade level, or college program
  const [yearLevel,  setYearLevel]  = useState('')   // college year level (1st Year ...)
  const [yearGrad,   setYearGrad]   = useState('')
  const [purposeChoice, setPurposeChoice] = useState('')   // a listed purpose, or OTHER_PURPOSE
  const [purposeOther,  setPurposeOther]  = useState('')
  const [error,      setError]      = useState('')
  const [saving,     setSaving]     = useState(false)
  const { basicEdGroups, getCampus, campuses, collegeYearLevels } = useAppConfig()

  // Last level: Basic Ed grade levels, or this campus's college programs (all programs if the campus lists none)
  const campusPrograms = getCampus?.(campusKey)?.college?.programs ?? []
  const programList    = campusPrograms.length > 0
    ? campusPrograms
    : [...new Set((campuses || []).flatMap(c => c.college?.programs ?? []))]
  const levelGroups = department === 'college'
    ? [{ label: 'Programs', options: programList.map(p => ({ value: p, label: p })) }]
    : (basicEdGroups || []).map(g => ({ label: g.label, options: g.options.map(o => ({ value: o, label: o })) }))

  const purpose = purposeChoice === OTHER_PURPOSE ? purposeOther.trim() : purposeChoice

  const docTypes = getDocumentTypes(campusKey, department)
  const selectedDoc = docTypes.find(d => d.id === docType)
  // No uploaded format → the request can't be filed (the technical admin uploads formats)
  const missingFormat = !!selectedDoc && !hasFormat({ department, documentType: selectedDoc.id }, campusKey)

  const yearOptions = graduationYears().map(y => ({ value: y, label: y }))

  const canSave = !saving && !!selectedDoc && !missingFormat && firstName.trim() !== '' && lastName.trim() !== '' && purpose !== ''

  const pickDepartment = (id) => {
    if (id === department) return
    setDepartment(id)
    setDocType('')   // the document list is different for each department
    setLastLevel('') // and so is the list of levels / programs
    setYearLevel('')
    setError('')
  }

  const handleSave = () => {
    if (!canSave) return
    setSaving(true)
    setError('')
    try {
      const record = createGraduateRequest({
        department,
        documentType:   docType,
        firstName, lastName,
        formerStudentId: formerId,
        // College: "Program - 4th Year" (same format as enrolled students); Basic Ed: the grade level
        lastLevel: department === 'college' ? [lastLevel, yearLevel].filter(Boolean).join(' - ') : lastLevel,
        yearGraduated:  yearGrad,
        purpose,
        campusKey, campusName, schoolYear,
      }, currentUser)

      // Documents that need clearance get a clearance record, same as a registrar request
      if (record.requiresClearance) {
        const clr = createClearance(record.studentId, record.studentName, campusKey, schoolYear, `For: ${record.documentLabel}`)
        linkClearanceToRequest(record.id, clr.id)
      }
      onRecorded(getRequestById(record.id) ?? record)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  const inputCls = 'w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] transition'
  const labelCls = 'text-xs font-semibold text-[var(--color-text-secondary)] block mb-1'

  return (
    <ModalPortal>
      <div className="modal-backdrop">
        <div className="modal-panel" style={{ maxWidth: '36rem' }}>
          <div className="flex items-center justify-between p-5 border-b border-[var(--color-border)]">
            <div>
              <h2 className="text-base font-bold text-[var(--color-text-primary)]">New Graduate Request</h2>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">For a former student asking for a document.</p>
            </div>
            <button onClick={onClose} aria-label="Close" className="p-2 rounded-lg hover:bg-[var(--color-bg-subtle)] transition">
              <X size={16} className="text-[var(--color-text-muted)]" />
            </button>
          </div>

          <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Basic Ed or College (fixed for a department registrar) */}
            {!lockedDepartment && (
            <div>
              <label className={labelCls}>Graduate of *</label>
              <div className="flex gap-2">
                {GRADUATE_DEPARTMENTS.map(d => (
                  <button key={d.id} type="button" onClick={() => pickDepartment(d.id)}
                    className={`flex-1 py-2.5 text-xs rounded-xl border transition-colors font-medium flex items-center justify-center gap-1.5
                      ${department === d.id
                        ? 'is-selected'
                        : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary-readable)]'}`}>
                    <GraduationCap size={14} /> {d.label}
                  </button>
                ))}
              </div>
            </div>
            )}

            {/* Document */}
            <div>
              <label className={labelCls}>Document *</label>
              <GroupedSelect
                value={docType || 'all'}
                onChange={v => setDocType(v === 'all' ? '' : v)}
                options={docTypes.map(d => ({ value: d.id, label: d.fee > 0 ? `${d.label} — ₱${d.fee}` : `${d.label} — Free` }))}
                allLabel="Select document..."
                placeholder="Select document..."
              />
              {selectedDoc?.requiresClearance && (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-[var(--color-warning-text)]">
                  <AlertCircle size={12} />
                  This document requires clearance before release.
                </div>
              )}
              <NoFormatNotice campusKey={campusKey} department={department} documentType={selectedDoc?.id} />
            </div>

            {/* Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>First name *</label>
                <input className={inputCls} value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name" />
              </div>
              <div>
                <label className={labelCls}>Last name *</label>
                <input className={inputCls} value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last name" />
              </div>
            </div>

            {/* Former record */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>
                  Former student ID <span className="font-normal text-[var(--color-text-muted)]">(optional)</span>
                </label>
                <input className={inputCls} value={formerId} onChange={e => setFormerId(e.target.value)} placeholder="If the graduate remembers it" />
              </div>
              <div>
                <label className={labelCls}>
                  {department === 'college' ? 'Program' : 'Last grade level'} <span className="font-normal text-[var(--color-text-muted)]">(optional)</span>
                </label>
                <GroupedSelect
                  value={lastLevel || 'all'}
                  onChange={v => setLastLevel(v === 'all' ? '' : v)}
                  groups={levelGroups}
                  allLabel={department === 'college' ? 'Select program...' : 'Select grade level...'}
                  placeholder={department === 'college' ? 'Select program...' : 'Select grade level...'}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>
                  Year graduated <span className="font-normal text-[var(--color-text-muted)]">(optional)</span>
                </label>
                <GroupedSelect
                  value={yearGrad || 'all'}
                  onChange={v => setYearGrad(v === 'all' ? '' : v)}
                  options={yearOptions}
                  allLabel="Select year..."
                  placeholder="Select year..."
                />
              </div>
              {department === 'college' && (
                <div>
                  <label className={labelCls}>
                    Last year level <span className="font-normal text-[var(--color-text-muted)]">(optional)</span>
                  </label>
                  <GroupedSelect
                    value={yearLevel || 'all'}
                    onChange={v => setYearLevel(v === 'all' ? '' : v)}
                    options={(collegeYearLevels || []).map(y => ({ value: y, label: y }))}
                    allLabel="Select year level..."
                    placeholder="Select year level..."
                  />
                </div>
              )}
            </div>

            {/* Purpose */}
            <div>
              <label className={labelCls}>Purpose *</label>
              <GroupedSelect
                value={purposeChoice || 'all'}
                onChange={v => setPurposeChoice(v === 'all' ? '' : v)}
                options={[...DOCUMENT_REQUEST_PURPOSES, OTHER_PURPOSE].map(p => ({ value: p, label: p }))}
                allLabel="Select purpose..."
                placeholder="Select purpose..."
              />
              {purposeChoice === OTHER_PURPOSE && (
                <input className={`${inputCls} mt-2`} value={purposeOther} onChange={e => setPurposeOther(e.target.value)}
                  placeholder="Type the purpose" autoFocus />
              )}
            </div>

            {selectedDoc && (
              <div className="bg-[var(--color-bg-subtle)] rounded-xl p-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] text-[var(--color-text-muted)] font-medium uppercase tracking-wide">Fee</p>
                  <p className="text-lg font-bold text-[var(--color-text-primary)]">{selectedDoc.fee > 0 ? peso(selectedDoc.fee) : 'Free'}</p>
                </div>
                <p className="text-xs text-[var(--color-text-muted)] text-right">
                  {selectedDoc.fee > 0
                    ? 'After you prepare it, mark it For Payment so accounting can collect.'
                    : 'No fee. Mark it ready for pickup once it is prepared.'}
                </p>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 p-3 bg-[var(--color-error-light)] border border-[var(--color-error-border)] rounded-xl text-xs text-[var(--color-error-text)]">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                {error}
              </div>
            )}
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 p-5 border-t border-[var(--color-border)]">
            <button onClick={onClose} className="btn btn-ghost text-sm">Cancel</button>
            <button onClick={handleSave} disabled={!canSave} className="btn btn-primary text-sm gap-1.5 disabled:opacity-50">
              <Plus size={14} /> Submit Request
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}

// ─────────────────────────────────────────────────────────────────
// CONFIRM PAYMENT MODAL (accounting records the cashier's details)
// ─────────────────────────────────────────────────────────────────

function ConfirmPaymentModal({ request, currentUser, onConfirmed, onClose }) {
  const [orNumber, setOrNumber] = useState(() => suggestOrNumber())
  const [method,   setMethod]   = useState(DOCUMENT_PAYMENT_METHODS[0] || '')
  const [remarks,  setRemarks]  = useState('')
  const [error,    setError]    = useState('')
  const [saving,   setSaving]   = useState(false)

  const orTaken = orNumber.trim() !== '' && isOrNumberUsed(orNumber)
  const canSave = !saving && orNumber.trim() !== '' && !orTaken && !!method

  const handleSave = () => {
    if (!canSave) return
    setSaving(true)
    setError('')
    try {
      confirmDocumentPayment(request.id, { orNumber, method, remarks }, currentUser)
      onConfirmed()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <ModalPortal>
      <div className="modal-backdrop">
        <div className="modal-panel" style={{ maxWidth: '26rem' }}>
          <div className="p-5 border-b border-[var(--color-border)]">
            <h3 className="text-base font-bold text-[var(--color-text-primary)]">Confirm Payment</h3>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              {request.documentLabel} · {request.studentName}
            </p>
          </div>

          <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="bg-[var(--color-bg-subtle)] rounded-xl p-3 text-center">
              <p className="text-[10px] text-[var(--color-text-muted)] font-medium uppercase tracking-wide">Amount to collect</p>
              <p className="text-2xl font-bold text-[var(--color-text-primary)] mt-0.5">{peso(request.fee)}</p>
            </div>

            <div>
              <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
                OR Number *
              </label>
              <input
                className="w-full px-3 py-2.5 text-sm font-mono border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] transition"
                value={orNumber}
                onChange={e => setOrNumber(e.target.value)}
                placeholder="Number on the official receipt"
                autoFocus
              />
              {orTaken && (
                <p className="text-xs text-[var(--color-error-text)] mt-1">
                  This OR number is already used on another payment.
                </p>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
                Payment Method *
              </label>
              <GroupedSelect
                value={method || 'all'}
                onChange={v => setMethod(v === 'all' ? '' : v)}
                allLabel="Select method..."
                placeholder="Select method..."
                options={DOCUMENT_PAYMENT_METHODS.map(m => ({ value: m, label: m }))}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
                Remarks <span className="font-normal text-[var(--color-text-muted)]">(optional)</span>
              </label>
              <input
                className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] transition"
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                placeholder="e.g. paid by parent"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-[var(--color-error-light)] border border-[var(--color-error-border)] rounded-xl text-xs text-[var(--color-error-text)]">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <p className="text-xs text-[var(--color-text-muted)]">
              This records the payment under your name and cannot be undone.
            </p>
          </div>

          <div className="flex justify-end gap-2 p-5 border-t border-[var(--color-border)]">
            <button onClick={onClose} className="btn btn-ghost text-sm">Cancel</button>
            <button onClick={handleSave} disabled={!canSave}
              className="btn btn-primary text-sm gap-1.5 disabled:opacity-50">
              <CheckCircle size={14} /> Confirm Payment
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}

// ─────────────────────────────────────────────────────────────────
// DOCUMENT FEE RECEIPT (one copy; also used to reprint)
// ─────────────────────────────────────────────────────────────────

function DocumentReceiptModal({ request, onPopupBlocked, onClose }) {
  const paperRef = useRef(null)
  const p        = request.payment
  const schoolName = (() => {
    try { return JSON.parse(localStorage.getItem('almirene_website_content') || '{}').schoolName || '' }
    catch { return '' }
  })()
  const when    = new Date(p.at)
  const dateStr = when.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
  const timeStr = when.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })

  const handlePrint = () => {
    printReceiptHtml({
      html:  paperRef.current?.innerHTML,
      title: `Receipt — ${request.studentName}`,
      onBlocked: onPopupBlocked,
    })
  }

  return (
    <ModalPortal>
      <div className="modal-backdrop">
        <div className="modal-panel" style={{ maxWidth: '28rem' }}>
          <div className="p-5 border-b border-[var(--color-border)]">
            <h3 className="text-base font-bold text-[var(--color-text-primary)]">Official Receipt</h3>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">OR# {p.orNumber}</p>
          </div>

          <div className="p-5 max-h-[70vh] overflow-y-auto">
            <div ref={paperRef} className="receipt-paper border border-[var(--color-border-strong)] rounded-xl p-5"
              style={{ fontFamily: 'Georgia, serif', fontSize: '13px' }}>
              <div className="text-center mb-3 pb-3 border-b-2 border-double border-[var(--color-border-strong)]">
                <p className="font-bold text-sm uppercase tracking-wide text-[var(--color-text-primary)]">{schoolName || 'School Name'}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{p.campusName || request.campusName}</p>
                <p className="text-xs text-[var(--color-text-muted)]">School Year {request.schoolYear}</p>
                <div className="mt-2 inline-block border border-[var(--color-border-strong)] px-3 py-0.5 rounded text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  Official Receipt
                </div>
              </div>

              <div className="flex justify-between text-xs mb-3">
                <div>
                  <span className="text-[var(--color-text-muted)]">OR No.: </span>
                  <span className="font-bold font-mono">{p.orNumber}</span>
                </div>
                <div className="text-right">
                  <div><span className="text-[var(--color-text-muted)]">Date: </span><span className="font-semibold">{dateStr}</span></div>
                  <div><span className="text-[var(--color-text-muted)]">Time: </span><span className="font-semibold">{timeStr}</span></div>
                </div>
              </div>

              <div className="bg-[var(--color-bg-subtle)] border border-[var(--color-border)] rounded-lg p-3 mb-3 text-xs space-y-1">
                <div className="flex gap-2"><span className="text-[var(--color-text-muted)] w-20 flex-shrink-0">Student:</span><span className="font-bold">{request.studentName}</span></div>
                <div className="flex gap-2"><span className="text-[var(--color-text-muted)] w-20 flex-shrink-0">Grade:</span><span>{request.studentGrade || '—'}</span></div>
              </div>

              <table className="w-full text-xs mb-4">
                <thead>
                  <tr className="border-b border-[var(--color-border-strong)] text-[var(--color-text-muted)]">
                    <th className="text-left py-1 font-semibold">Description</th>
                    <th className="text-right py-1 font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-1.5">
                      {request.documentLabel}
                      {request.purpose && <span className="block text-[var(--color-text-muted)]">Purpose: {request.purpose}</span>}
                    </td>
                    <td className="py-1.5 text-right align-top">{peso(p.amount)}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[var(--color-border-strong)]">
                    <td className="pt-2 font-bold">Total Paid</td>
                    <td className="pt-2 text-right font-bold text-sm">{peso(p.amount)}</td>
                  </tr>
                  <tr>
                    <td className="pt-1 text-[var(--color-text-muted)]">Payment method</td>
                    <td className="pt-1 text-right">{p.method}</td>
                  </tr>
                </tfoot>
              </table>

              <div className="flex justify-between items-end text-xs mt-6">
                <div className="text-center">
                  <div className="border-t border-[var(--color-border-strong)] pt-1 w-32">
                    <p className="font-semibold">{p.receivedBy}</p>
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
              <p className="mt-3 text-[var(--color-text-muted)] text-[10px] text-center">Thank you for your payment!</p>
            </div>
          </div>

          <div className="flex justify-end gap-2 p-5 border-t border-[var(--color-border)]">
            <button onClick={onClose} className="btn btn-ghost text-sm">Close</button>
            <button onClick={handlePrint} className="btn btn-primary text-sm gap-1.5">
              <Printer size={14} /> Print Receipt
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// REQUEST DETAIL DRAWER
// ─────────────────────────────────────────────────────────────────────────────

function RequestDrawer({ request, currentUser, onUpdate, onClose }) {
  const [printJob,      setPrintJob]     = useState(null)   // filled format, shown in a preview before printing
  const [releaseModal, setReleaseModal] = useState(false)
  const [payModal,     setPayModal]     = useState(false)
  const [receiptModal, setReceiptModal] = useState(false)
  const [noteInput,    setNoteInput]    = useState('')
  const [confirmNoFormat, setConfirmNoFormat] = useState(false)   // warn before processing a document with no format
  const { toasts, addToast, removeToast } = useToast()

  const role = currentUser?.role
  const isRegistrar = role === 'registrar_basic' || role === 'registrar_college' || role === 'technical_admin'
  const isAccounting = role === 'accounting' || role === 'technical_admin'
  const canSetupDocuments = role === 'technical_admin'   // only the technical admin uploads formats

  // Workflow engine determines available actions — no hardcoding
  const availableActions = getDocumentActions(currentUser, request)

  // Convenience helpers for backward-compatible button rendering
  const hasAction = (id) => availableActions.some(a => a.id === id)
  const canProcess        = hasAction('start_processing')
  const canRequirePayment = hasAction('require_payment')
  const canConfirmPayment = hasAction('confirm_payment')
  const canRelease        = hasAction('release')
  const canCancel         = hasAction('cancel')
  // registrars can print once the fee is paid (free documents: once processing has started)
  const canPrint          = isRegistrar && isPrintable(request)
  // The document's format must be uploaded (by the technical admin) before it can be printed
  const isOpen   = !statusMatches(request.status, 'cancelled') && !statusMatches(request.status, 'released')
  const noFormat = isRegistrar && isOpen && !hasFormat(request, request.campusKey || currentUser?.campusKey)
  // Ready for pickup, but the student's clearance is not complete yet
  const waitingClearance = isRegistrar && statusMatches(request.status, 'ready_for_pickup') && clearanceBlocksRelease(request)

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

  const handlePaymentConfirmed = () => {
    setPayModal(false)
    addToast('Payment confirmed.', 'success')
    onUpdate()
    setReceiptModal(true)   // show the receipt right away so it can be printed
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
              <button onClick={onClose} aria-label="Close" className="p-2 rounded-lg hover:bg-[var(--color-bg-subtle)] transition">
                <X size={16} className="text-[var(--color-text-muted)]" />
              </button>
            </div>
          </div>

          <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
            {/* Info grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {[
                ['Purpose',      request.purpose],
                ['Requested By', `${request.requestedBy}${request.requestorName ? ` — ${request.requestorName}` : ''}`],
                ['Fee',          request.fee > 0 ? `₱${Number(request.fee).toLocaleString()}` : 'Free'],
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

            {/* Payment record (set when accounting confirms the fee) */}
            {request.payment && (
              <div className="border border-[var(--color-success-border)] bg-[var(--color-success-light)] rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[var(--color-success-text)] flex items-center gap-1.5">
                      <CheckCircle size={13} /> Fee paid
                    </p>
                    <p className="text-sm font-bold text-[var(--color-text-primary)] mt-1">
                      {peso(request.payment.amount)} · {request.payment.method}
                    </p>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                      OR# <span className="font-mono">{request.payment.orNumber}</span>
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      Received by {request.payment.receivedBy} · {fmtDate(request.payment.at)}
                    </p>
                    {request.payment.remarks && (
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{request.payment.remarks}</p>
                    )}
                  </div>
                  <button onClick={() => setReceiptModal(true)} className="btn btn-ghost text-xs gap-1.5 shrink-0">
                    <Receipt size={12} /> Receipt
                  </button>
                </div>
              </div>
            )}

            {/* Clearance panel */}
            {request.requiresClearance && (
              <div className="border border-[var(--color-border)] rounded-xl p-4">
                <p className="text-xs font-semibold text-[var(--color-text-secondary)] mb-3 flex items-center gap-1.5">
                  <ShieldCheck size={13} /> Student Clearance
                </p>
                <ClearancePanel clearanceId={request.clearanceId} />
              </div>
            )}

            {/* Status history */}
            <div>
              <p className="text-xs font-semibold text-[var(--color-text-secondary)] mb-2">Status History</p>
              <div className="space-y-2">
                {[...request.statusHistory].reverse().map((h, i) => (
                  <div key={i} className="flex items-start gap-3 text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-selected)] mt-1.5 shrink-0" />
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
            {(canPrint || canProcess || canRequirePayment || canConfirmPayment || canRelease || canCancel || noFormat || waitingClearance) && (
              <div className="border-t border-[var(--color-border)] pt-4 space-y-3">
                <p className="text-xs font-semibold text-[var(--color-text-secondary)]">Actions</p>

                {noFormat && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-[var(--color-warning-light)] border border-[var(--color-warning-border)] text-xs text-[var(--color-warning-text)]">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <span>
                      No format is uploaded for {request.documentLabel}, so it can't be printed yet.
                      {canSetupDocuments ? ' Upload one in the Formats tab.' : ' Ask the technical admin to upload one.'}
                    </span>
                  </div>
                )}
                {waitingClearance && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-[var(--color-warning-light)] border border-[var(--color-warning-border)] text-xs text-[var(--color-warning-text)]">
                    <ShieldCheck size={14} className="shrink-0 mt-0.5" />
                    <span>Release is available once the student's clearance is complete.</span>
                  </div>
                )}

                {/* Phone: full-width stacked buttons. Larger screens: one wrapping row. */}
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap [&>button]:w-full [&>button]:justify-center sm:[&>button]:w-auto">
                  {canProcess && (
                    <button onClick={() => (noFormat ? setConfirmNoFormat(true) : act('start_processing'))}
                      className="btn btn-primary text-xs gap-1.5">
                      <RotateCcw size={12} /> Start Processing
                    </button>
                  )}
                  {canRequirePayment && (Number(request.fee) > 0 ? (
                    <button onClick={() => act('require_payment', `Processing fee of ₱${Number(request.fee).toLocaleString()} required.`)}
                      className="btn text-xs gap-1.5 border border-[var(--color-warning-border)] text-[var(--color-warning-text)] hover:bg-[var(--color-warning-light)]">
                      <CreditCard size={12} /> Require Payment (₱{Number(request.fee).toLocaleString()})
                    </button>
                  ) : (
                    // Free document: the workflow passes the payment step on its own
                    <button onClick={() => act('require_payment')}
                      className="btn btn-primary text-xs gap-1.5">
                      <Package size={12} /> Continue — no fee
                    </button>
                  ))}
                  {canConfirmPayment && (
                    <button onClick={() => setPayModal(true)}
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
                  {/* Secondary actions sit at the far end, away from the main action */}
                  {(canPrint || canCancel) && (
                    <div className="flex flex-col gap-2 sm:flex-row sm:ml-auto [&>button]:w-full [&>button]:justify-center sm:[&>button]:w-auto">
                    {canPrint && (
                      <button
                        disabled={noFormat}
                        title={noFormat ? 'No format uploaded for this document' : undefined}
                        onClick={() => {
                          const job = getPrintJob(request, request.campusKey || currentUser?.campusKey, currentUser)
                          if (job) setPrintJob(job)
                          else addToast(`No format uploaded for ${request.documentLabel}. ${canSetupDocuments ? 'Add one in the Formats tab.' : 'Ask the technical admin to add its format.'}`, 'error')
                        }}
                        className="btn btn-ghost text-xs gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed">
                        <Printer size={12} /> Print document
                      </button>
                    )}
                    {canCancel && (
                      <button onClick={() => act('cancel', noteInput || 'Cancelled by registrar.')}
                        className="btn text-xs gap-1.5 border border-[var(--color-error-border)] text-[var(--color-error-text)] hover:bg-[var(--color-error-light)]">
                        <X size={12} /> Cancel
                      </button>
                    )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <ToastContainer toasts={toasts} removeToast={removeToast} />
        </div>
      </div>

      {printJob && (
        <PrintPreviewModal
          request={printJob.request}
          template={printJob.template}
          values={printJob.values}
          addToast={addToast}
          onClose={() => setPrintJob(null)}
        />
      )}

      {releaseModal && (
        <ReleaseModal request={request} onRelease={handleRelease} onClose={() => setReleaseModal(false)} />
      )}

      <ConfirmDialog
        open={confirmNoFormat}
        title="No format uploaded"
        message={`"${request.documentLabel}" has no format uploaded, so it can't be printed. ${canSetupDocuments ? 'Upload one in the Formats tab' : 'Ask the technical admin to upload one'} before you print. Start processing anyway?`}
        confirmLabel="Start processing anyway"
        onConfirm={() => { setConfirmNoFormat(false); act('start_processing') }}
        onCancel={() => setConfirmNoFormat(false)}
      />

      {payModal && (
        <ConfirmPaymentModal
          request={request}
          currentUser={currentUser}
          onConfirmed={handlePaymentConfirmed}
          onClose={() => setPayModal(false)}
        />
      )}

      {receiptModal && request.payment && (
        <DocumentReceiptModal
          request={request}
          onPopupBlocked={() => addToast('Pop-up blocked. Allow pop-ups for this site to print the receipt.', 'error')}
          onClose={() => setReceiptModal(false)}
        />
      )}
    </ModalPortal>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// REQUEST LIST — table on desktop, compact rows on phones
// ─────────────────────────────────────────────────────────────────────────────

const REQUEST_SORTERS = {
  student:  (a, b) => (a.studentName || '').localeCompare(b.studentName || ''),
  document: (a, b) => (a.documentLabel || '').localeCompare(b.documentLabel || ''),
  fee:      (a, b) => (Number(a.fee) || 0) - (Number(b.fee) || 0),
  status:   (a, b) => getStatusLabel(a).localeCompare(getStatusLabel(b)),
  filed:    (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
}

const DEPT_LABEL = { basicEd: 'Basic Ed', college: 'College' }

/** Small flat tag used under the student / document names. */
function RequestTag({ tone = 'neutral', children }) {
  const tones = {
    neutral: 'bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)]',
    warning: 'bg-[var(--color-warning-light)] text-[var(--color-warning-text)]',
    success: 'bg-[var(--color-success-light)] text-[var(--color-success-text)]',
    info:    'bg-[var(--color-info-light)] text-[var(--color-info-text)]',
  }
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap ${tones[tone]}`}>
      {children}
    </span>
  )
}

function fmtFee(fee) {
  return Number(fee) > 0 ? `₱${Number(fee).toLocaleString('en-PH')}` : '—'
}

function RequestsTable({ rows, sort, onSort, onSelect, showDept, isPaidAwaiting }) {
  return (
    <div className="hidden md:block overflow-x-auto">
      <table className="w-full [&_th]:!px-3 [&_td]:!px-3">
        <thead className="bg-[var(--color-bg-subtle)]">
          <tr>
            <SortTh label="Student"  sortKey="student"  sort={sort} onSort={onSort} />
            <SortTh label="Document" sortKey="document" sort={sort} onSort={onSort} />
            <th scope="col" className="th">Purpose</th>
            <SortTh label="Fee"      sortKey="fee"      sort={sort} onSort={onSort} />
            <SortTh label="Status"   sortKey="status"   sort={sort} onSort={onSort} />
            <SortTh label="Filed"    sortKey="filed"    sort={sort} onSort={onSort} />
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {rows.map(req => (
            <tr key={req.id} onClick={() => onSelect(req)} className="table-row cursor-pointer">
              <td className="td">
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); onSelect(req) }}
                  className="text-left rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)]"
                  aria-label={`View request of ${req.studentName}`}
                >
                  <span className="block text-sm font-semibold text-[var(--color-text-primary)]">{req.studentName}</span>
                </button>
                {(showDept || req.isGraduate) && (
                  <span className="flex flex-wrap items-center gap-1 mt-0.5">
                    {showDept && <RequestTag>{DEPT_LABEL[req.department ?? 'basicEd'] ?? req.department}</RequestTag>}
                    {req.isGraduate && <RequestTag>Graduate{req.yearGraduated ? ` ${req.yearGraduated}` : ''}</RequestTag>}
                  </span>
                )}
              </td>
              <td className="td">
                <span className="block text-sm text-[var(--color-text-primary)]">{req.documentLabel}</span>
                {req.requiresClearance && <span className="inline-flex mt-0.5"><RequestTag tone="warning">Needs clearance</RequestTag></span>}
              </td>
              <td className="td text-[var(--color-text-secondary)] max-w-[14rem] truncate" title={req.purpose}>{req.purpose || '—'}</td>
              <td className="td">
                <span className="block text-sm text-[var(--color-text-primary)] tabular-nums">{fmtFee(req.fee)}</span>
                {isPaidAwaiting(req) && <span className="inline-flex mt-0.5"><RequestTag tone="success">Paid · OR# {req.payment.orNumber}</RequestTag></span>}
              </td>
              <td className="td"><StatusBadge request={req} /></td>
              <td className="td text-[var(--color-text-muted)]">{fmtDate(req.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Phone / small-tablet list: one tappable row per request. */
function RequestsMobileList({ rows, onSelect, showDept, isPaidAwaiting }) {
  return (
    <ul className="md:hidden divide-y divide-[var(--color-border)]">
      {rows.map(req => (
        <li key={req.id}>
          <button
            type="button"
            onClick={() => onSelect(req)}
            className="w-full text-left p-4 hover:bg-[var(--color-bg-subtle)] transition-colors"
            aria-label={`View request of ${req.studentName}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-bold text-[var(--color-text-primary)] truncate">{req.studentName}</p>
                <p className="text-xs text-[var(--color-text-muted)] truncate">
                  {req.documentLabel}{req.purpose ? ` · ${req.purpose}` : ''}
                </p>
              </div>
              <StatusBadge request={req} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {req.fee > 0 && <RequestTag tone="info">{fmtFee(req.fee)}</RequestTag>}
              {req.requiresClearance && <RequestTag tone="warning">Needs clearance</RequestTag>}
              {showDept && <RequestTag>{DEPT_LABEL[req.department ?? 'basicEd'] ?? req.department}</RequestTag>}
              {req.isGraduate && <RequestTag>Graduate{req.yearGraduated ? ` ${req.yearGraduated}` : ''}</RequestTag>}
              {isPaidAwaiting(req) && <RequestTag tone="success">Paid · OR# {req.payment.orNumber}</RequestTag>}
              <span className="ml-auto text-xs text-[var(--color-text-muted)]">{fmtDate(req.createdAt)}</span>
            </div>
          </button>
        </li>
      ))}
    </ul>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function DocumentRequests() {
  const { user }       = useAuth()
  const { currentSchoolYear, activeCampuses } = useAppConfig()

  // Campus: a campus user works in their own campus. A user with no campus of their own
  // (admin / technical admin) follows the Campus menu in the header, so formats and fees are
  // set for the campus they picked. With "all campuses" selected, the first campus is shown
  // for the request lists, and Formats / Fees ask for a campus instead of editing a guess.
  const { campusFilter = 'all' } = useCampusFilter()
  const needsCampusPick = !user?.campusKey && campusFilter === 'all'
  const campusKey  = user?.campusKey
    || (campusFilter !== 'all' ? campusFilter : '')
    || activeCampuses?.[0]?.key || ''
  // currentSchoolYear is already the year string (e.g. '2026-2027'), not an object
  const schoolYear = currentSchoolYear || '2026-2027'
  const campusName = activeCampuses?.find(c => c.key === campusKey)?.name ?? user?.campus ?? ''

  const [requests,    setRequests]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [activeTab,   setActiveTab]   = useState('requests') // 'requests' | 'fees' | 'print' | 'formats'
  const [statusFilter,setStatusFilter]= useState('all')
  const [deptFilter,  setDeptFilter]  = useState('all')
  const [docFilter,   setDocFilter]   = useState('all')   // document type (its label)
  const [dateFrom,    setDateFrom]    = useState('')      // date filed, from (YYYY-MM-DD)
  const [dateTo,      setDateTo]      = useState('')      // date filed, to
  const [showFilters, setShowFilters] = useState(false)
  const [paidMine,    setPaidMine]    = useState(false)   // Paid tab: only payments I confirmed
  const [search,      setSearch]      = useState('')
  const [showNew,     setShowNew]     = useState(false)
  const [showRecord,  setShowRecord]  = useState(false)
  const [feesDirty,   setFeesDirty]   = useState(false)   // unsaved edits on the Fees tab
  const [pendingTab,  setPendingTab]  = useState(null)    // tab the user tried to open while edits were unsaved
  const [selected,    setSelected]    = useState(null)
  const { toasts, addToast, removeToast } = useToast()

  const role = user?.role
  const isRegistrar  = ['registrar_basic', 'registrar_college', 'technical_admin'].includes(role)
  const isAccounting = ['accounting', 'technical_admin'].includes(role)
  const canManageFees = ['accounting', 'admin', 'technical_admin'].includes(role)
  // The technical admin sets up the documents (list, clearance rule, formats); nobody else opens Formats
  const canSetupDocuments = role === 'technical_admin'

  const loadData = useCallback(() => {
    // Always load the FULL list for this campus + school year. The status tabs
    // filter it on the client (below), so every tab keeps its count while
    // another tab is selected — and switching tabs needs no reload.
    setRequests(getRequests({ campusKey, schoolYear }))
    setLoading(false)
  }, [campusKey, schoolYear])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => {
    const handler = () => loadData()
    // Another browser tab or window (for example the other account) changed the requests
    const onStorage = (e) => { if (e.key === null || e.key === 'almirene_documents') loadData() }
    window.addEventListener('almirene_documents_updated', handler)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('almirene_documents_updated', handler)
      window.removeEventListener('storage', onStorage)
    }
  }, [loadData])

  // What this role may see: accounting only works the for_payment queue, and
  // each registrar only sees their own department (technical admin sees both).
  const registrarDept = role === 'registrar_basic' ? 'basicEd' : role === 'registrar_college' ? 'college' : null
  const accountingOnly = isAccounting && !isRegistrar
  const scopedRequests = requests.filter(r => {
    // accounting works the For Payment queue and tracks what has been paid
    if (accountingOnly && r.status !== 'for_payment' && !r.payment) return false
    if (registrarDept && (r.department ?? 'basicEd') !== registrarDept) return false
    return true
  })

  // Paid and waiting for the registrar to release
  const isPaidAwaiting = (r) => !!r.payment && statusMatches(r.status, 'ready_for_pickup')
  const awaitingCount  = scopedRequests.filter(isPaidAwaiting).length
  const myId           = user?.id ?? user?.email ?? null
  // The 'Paid · awaiting release' chip disappears once nothing is waiting, so fall back to All
  const activeFilter = statusFilter === 'paid_awaiting' && awaitingCount === 0 ? 'all' : statusFilter

  // The table: status tab + search applied on top of the scoped list
  const visibleRequests = scopedRequests.filter(r => {
    if (activeFilter === 'paid_awaiting') { if (!isPaidAwaiting(r)) return false }
    else if (activeFilter === 'paid') {
      if (!r.payment) return false
      if (paidMine && String(r.payment.receivedById) !== String(myId)) return false
    }
    else if (activeFilter !== 'all' && !statusMatches(r.status, activeFilter)) return false

    // Exact matches only (never .includes) so "Grade 1" can't match "Grade 10"
    if (docFilter   !== 'all' && r.documentLabel !== docFilter)   return false
    if (dateFrom || dateTo) {
      const filed = localYMD(r.createdAt)
      if (dateFrom && filed < dateFrom) return false
      if (dateTo   && filed > dateTo)   return false
    }
    if (deptFilter  !== 'all' && (r.department ?? 'basicEd') !== deptFilter) return false

    if (search) {
      const q = search.toLowerCase()
      return r.studentName?.toLowerCase().includes(q)
          || r.documentLabel?.toLowerCase().includes(q)
          || r.payment?.orNumber?.toLowerCase().includes(q)
    }
    return true
  })

  // Sort + page the filtered list (back to page 1 when a filter or the search changes)
  const { rows, sort, onSort, page, pageCount, total, setPage, pageSize, setPageSize } = useTablePaging(visibleRequests, {
    sorters:     REQUEST_SORTERS,
    defaultSort: { key: 'filed', dir: 'desc' },
    descFirst:   ['filed', 'fee'],
    resetOn:     [activeFilter, paidMine, docFilter, deptFilter, dateFrom, dateTo, search, campusKey],
  })

  // Document choices come from the campus Fees list plus anything already on a request,
  // so a renamed or removed document never goes missing from the filter.
  const uniq = (vals) => [...new Set(vals.filter(Boolean))]
  const natural = (a, b) => a.localeCompare(b, undefined, { numeric: true })
  const showBasic   = registrarDept !== 'college'
  const showCollege = registrarDept !== 'basicEd'

  const docOptions = uniq([
    ...(showBasic   ? getDocumentTypes(campusKey, 'basicEd').map(t => t.label) : []),
    ...(showCollege ? getDocumentTypes(campusKey, 'college').map(t => t.label) : []),
    ...scopedRequests.map(r => r.documentLabel),
  ]).sort(natural)

  const toOpts = (list) => list.map(v => ({ value: v, label: v }))

  const activeFilterCount = [docFilter, deptFilter].filter(v => v !== 'all').length + (dateFrom || dateTo ? 1 : 0)
  const clearFilters = () => { setDocFilter('all'); setDeptFilter('all'); setDateFrom(''); setDateTo('') }

  // Tab counts and the header's "pending" always come from the scoped list —
  // never from the status-filtered one — so they stay put while the user
  // moves between tabs.
  const counts = {}
  REQUEST_STATUSES.forEach(s => {
    counts[s.id] = scopedRequests.filter(r => statusMatches(r.status, s.id)).length
  })
  const paidCount = scopedRequests.filter(r => !!r.payment).length
  const pending = accountingOnly
    ? (counts.for_payment || 0)
    : scopedRequests.filter(r => !['released', 'cancelled'].includes(r.status)).length

  // Opening the page tells the registrar about paid documents to release, or accounting about requests to collect
  const toldRef = useRef(false)
  useEffect(() => {
    if (loading || toldRef.current) return
    if (!registrarDept && !accountingOnly) return
    toldRef.current = true
    if (registrarDept && awaitingCount > 0) {
      addToast(`${awaitingCount} paid document${awaitingCount !== 1 ? 's are' : ' is'} waiting for you to release.`, 'info')
    } else if (accountingOnly && (counts.for_payment || 0) > 0) {
      const n = counts.for_payment
      addToast(`${n} document request${n !== 1 ? 's are' : ' is'} waiting for payment.`, 'info')
    }
  }, [loading, registrarDept, accountingOnly, awaitingCount, counts.for_payment, addToast])

  // Leaving the Fees tab with unsaved edits asks first
  const goToTab = (id) => {
    if (id !== activeTab && activeTab === 'fees' && feesDirty) setPendingTab(id)
    else setActiveTab(id)
  }

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
        <div className="flex flex-wrap gap-2 shrink-0">
          {isRegistrar && (
            <>
              <button onClick={() => setShowRecord(true)} className="btn btn-ghost gap-1.5 text-sm">
                <GraduationCap size={15} /> Graduate Request
              </button>
              <button onClick={() => setShowNew(true)} className="btn btn-primary gap-1.5 text-sm">
                <Plus size={15} /> New Request
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-[var(--color-bg-subtle)] rounded-xl w-fit">
        {[
          { id: 'requests',  label: 'Requests',  icon: FileText },
          ...(isRegistrar ? [{ id: 'print', label: 'Print', icon: Printer }] : []),
          ...(canSetupDocuments ? [{ id: 'formats', label: 'Formats', icon: Upload }] : []),
          ...(canManageFees ? [{ id: 'fees', label: 'Fees', icon: Tag }] : []),
        ].map(tab => (
          <button key={tab.id} onClick={() => goToTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${activeTab === tab.id
                ? 'is-selected shadow-sm'
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
            {[
              { id: 'all', label: `All (${scopedRequests.length})` },
              ...(registrarDept && awaitingCount > 0 ? [{ id: 'paid_awaiting', label: `Paid · awaiting release (${awaitingCount})` }] : []),
              ...REQUEST_STATUSES.map(s => ({ id: s.id, label: `${s.label} (${counts[s.id] || 0})` })),
              ...(isAccounting ? [{ id: 'paid', label: `Paid (${paidCount})` }] : []),
            ].map(f => (
              <button key={f.id} onClick={() => setStatusFilter(f.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors
                  ${activeFilter === f.id
                    ? 'is-selected'
                    : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary-readable)]'}`}>
                {f.label}
              </button>
            ))}
          </div>

          {/* Search + filters */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="relative flex-1 sm:max-w-sm">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition"
                placeholder="Search by student, document or OR number..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button type="button" onClick={() => setShowFilters(v => !v)} aria-expanded={showFilters}
              className={`flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors
                ${showFilters || activeFilterCount > 0
                  ? 'is-selected'
                  : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary-readable)]'}`}>
              <Filter size={14} />
              Filters
              {activeFilterCount > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--color-alert)] text-white text-[10px] font-bold flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
            {activeFilter === 'paid' && (
              <button type="button" onClick={() => setPaidMine(v => !v)} aria-pressed={paidMine}
                className={`px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors
                  ${paidMine
                    ? 'is-selected'
                    : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary-readable)]'}`}>
                Confirmed by me
              </button>
            )}
          </div>

          {showFilters && (
            <div className="card p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">Document type</label>
                  <GroupedSelect value={docFilter} onChange={setDocFilter} options={toOpts(docOptions)}
                    allLabel="All documents" placeholder="All documents" />
                </div>
                {!registrarDept && (
                  <div>
                    <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">Department</label>
                    <GroupedSelect value={deptFilter} onChange={setDeptFilter}
                      options={[{ value: 'basicEd', label: 'Basic Ed' }, { value: 'college', label: 'College' }]}
                      allLabel="All departments" placeholder="All departments" />
                  </div>
                )}
                <div>
                  <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">Filed from</label>
                  <DatePicker value={dateFrom} onChange={setDateFrom} placeholder="Start date" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">Filed to</label>
                  <DatePicker value={dateTo} onChange={setDateTo} placeholder="End date" />
                </div>
              </div>
              {activeFilterCount > 0 && (
                <button type="button" onClick={clearFilters} className="btn btn-ghost text-xs gap-1.5 mt-3">
                  <X size={13} /> Clear filters
                </button>
              )}
            </div>
          )}

          {/* Requests list */}
          {visibleRequests.length === 0 ? (
            <div className="card p-10 text-center">
              <FileText size={40} className="text-[var(--color-text-muted)] mx-auto mb-3 opacity-40" />
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">No requests found</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                {activeFilterCount > 0
                  ? 'Nothing matches your filters. Try clearing some.'
                  : activeFilter !== 'all'
                  ? 'Try a different status filter.'
                  : isRegistrar ? 'Click "New Request" or "Graduate Request" to add one.' : 'Requests appear here once the registrar marks them For Payment.'}
              </p>
            </div>
          ) : (
            <div className="card-section border border-[var(--color-border)]">
              <RequestsTable
                rows={rows}
                sort={sort}
                onSort={onSort}
                onSelect={setSelected}
                showDept={!registrarDept}
                isPaidAwaiting={isPaidAwaiting}
              />
              <RequestsMobileList
                rows={rows}
                onSelect={setSelected}
                showDept={!registrarDept}
                isPaidAwaiting={isPaidAwaiting}
              />
              <Pager page={page} pageCount={pageCount} total={total} onPage={setPage} pageSize={pageSize} onPageSize={setPageSize} noun="request" />
            </div>
          )}
        </>
      )}

      {/* ── PRINT TAB (registrar) ── */}
      {activeTab === 'print' && isRegistrar && (
        <PrintTab
          requests={scopedRequests}
          campusKey={campusKey}
          currentUser={user}
          renderStatus={(r) => <StatusBadge request={r} />}
          onOpenFormats={canSetupDocuments ? () => goToTab('formats') : undefined}
          addToast={addToast}
        />
      )}

      {/* ── FORMATS TAB (technical admin) ── */}
      {activeTab === 'formats' && canSetupDocuments && (
        needsCampusPick
          ? <PickCampusNotice what="document formats" />
          : <FormatsTab key={campusKey} campusKey={campusKey} campusName={campusName} currentUser={user} addToast={addToast} />
      )}

      {/* ── FEES TAB ── */}
      {activeTab === 'fees' && canManageFees && (
        needsCampusPick
          ? <PickCampusNotice what="document fees" />
          : <DocumentFeesTab key={campusKey} campusKey={campusKey} campusName={campusName} currentUser={user} onDirtyChange={setFeesDirty} />
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

      {showRecord && (
        <RecordGraduateRequestModal
          campusKey={campusKey}
          campusName={campusName}
          schoolYear={schoolYear}
          currentUser={user}
          lockedDepartment={registrarDept}
          onRecorded={() => { setShowRecord(false); loadData(); addToast('Graduate request filed.', 'success') }}
          onClose={() => setShowRecord(false)}
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

      <ConfirmDialog
        open={!!pendingTab}
        title="Unsaved fee changes"
        message="You have fee changes that are not saved. If you leave this tab they will be lost."
        confirmLabel="Discard changes"
        danger
        onConfirm={() => { setActiveTab(pendingTab); setPendingTab(null) }}
        onCancel={() => setPendingTab(null)}
      />

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  )
}

// Shown on Formats / Fees when no campus is selected: these are set per campus
function PickCampusNotice({ what }) {
  return (
    <div className="card p-6 text-center">
      <p className="text-sm font-semibold text-[var(--color-text-primary)]">Choose a campus first</p>
      <p className="text-xs text-[var(--color-text-muted)] mt-1">
        {what.charAt(0).toUpperCase() + what.slice(1)} are set for one campus at a time. Pick a campus from the Campus menu at the top of the page.
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENT FEES TAB (accounting sets this campus's prices, on the same page)
// ─────────────────────────────────────────────────────────────────────────────

const FEE_DEPARTMENTS = [
  { id: 'basicEd', label: 'Basic Ed' },
  { id: 'college', label: 'College'  },
]

const toFeeRows = (list) => list.map(t => ({
  _k: t.id, id: t.id, label: t.label, fee: String(t.fee), requiresClearance: !!t.requiresClearance,
}))
// What "unchanged" means — used to tell whether a department has unsaved edits
const feeSnapshot = (rows) => JSON.stringify(rows.map(r => [r.id, r.label.trim(), r.fee.trim(), r.requiresClearance]))

function DocumentFeesTab({ campusKey, campusName, currentUser, onDirtyChange }) {
  const [dept, setDept] = useState('basicEd')
  const load = (d) => toFeeRows(getDocumentTypes(campusKey, d))
  const [drafts, setDrafts] = useState(() => ({ basicEd: load('basicEd'), college: load('college') }))
  // The last saved rows per department (compared with the drafts to know what is unsaved)
  const [saved,  setSaved]  = useState(() => ({ basicEd: load('basicEd'), college: load('college') }))
  const [custom, setCustom] = useState(() => ({ basicEd: hasCustomDocumentTypes(campusKey, 'basicEd'), college: hasCustomDocumentTypes(campusKey, 'college') }))
  const [error, setError]   = useState('')
  const [confirmReset, setConfirmReset] = useState(false)
  const [toRemove, setToRemove] = useState(null)   // saved document the admin wants to delete
  const newKey = useRef(0)
  const { toasts, addToast, removeToast } = useToast()

  // Accounting and admin set prices only. The technical admin sets up the documents and the clearance rule.
  const priceOnly = currentUser?.role !== 'technical_admin'
  const rows    = drafts[dept]
  const isDirty = (d) => feeSnapshot(drafts[d]) !== feeSnapshot(saved[d])
  const anyDirty = isDirty('basicEd') || isDirty('college')

  // Always-current copies for the listeners below (they are set up once)
  const latest = useRef({ drafts, saved })
  latest.current = { drafts, saved }

  // Tell the page, so it can warn before the user leaves this tab
  useEffect(() => { onDirtyChange?.(anyDirty) }, [anyDirty, onDirtyChange])
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange])

  // Also warn before closing or refreshing the browser tab
  useEffect(() => {
    if (!anyDirty) return undefined
    const warn = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [anyDirty])
  const dirty   = isDirty(dept)
  const deptLabel = FEE_DEPARTMENTS.find(d => d.id === dept).label

  const setRows = (updater) => {
    setError('')
    setDrafts(prev => ({ ...prev, [dept]: updater(prev[dept]) }))
  }
  const updateRow = (key, patch) => setRows(rs => rs.map(r => (r._k === key ? { ...r, ...patch } : r)))
  // A saved document is deleted through the trash (after a confirmation); a row that was
  // never saved is simply dropped.
  const requestRemove = (row) => {
    if (row.id) setToRemove(row)
    else setRows(rs => rs.filter(r => r._k !== row._k))
  }
  const addRow    = () => setRows(rs => [...rs, { _k: `new_${newKey.current++}`, id: '', label: '', fee: '', requiresClearance: false }])

  // Digits and a single decimal point only
  const cleanFee = (v) => v.replace(/[^0-9.]/g, '').replace(/(\..*?)\..*/g, '$1')

  const applyLoaded = (d, list) => {
    const fresh = toFeeRows(list)
    setDrafts(prev => ({ ...prev, [d]: fresh }))
    setSaved(prev => ({ ...prev, [d]: fresh }))
    setCustom(prev => ({ ...prev, [d]: hasCustomDocumentTypes(campusKey, d) }))
  }

  // The list changed elsewhere while this department has unsaved edits: take the new list
  // (deleted documents disappear, new ones appear, clearance updates) but keep what the user
  // typed for the documents that are still there.
  const mergeFresh = (d) => {
    const fresh = toFeeRows(getDocumentTypes(campusKey, d))
    setDrafts(prev => {
      const typed = new Map(prev[d].filter(r => r.id).map(r => [r.id, r]))
      const merged = fresh.map(f => {
        const t = typed.get(f.id)
        if (!t) return f
        // Prices-only users type fees; the technical admin also edits the name and clearance
        return priceOnly ? { ...f, fee: t.fee } : { ...f, fee: t.fee, label: t.label, requiresClearance: t.requiresClearance }
      })
      return { ...prev, [d]: [...merged, ...prev[d].filter(r => !r.id)] }   // unsaved new rows stay
    })
    setSaved(prev => ({ ...prev, [d]: fresh }))
    setCustom(prev => ({ ...prev, [d]: hasCustomDocumentTypes(campusKey, d) }))
  }

  // Keep this tab in step with the registrar: same browser tab (custom event) and another
  // browser tab or window (storage event), for example the two-account flow.
  useEffect(() => {
    const refresh = () => ['basicEd', 'college'].forEach(d => {
      const { drafts: dr, saved: sv } = latest.current
      if (feeSnapshot(dr[d]) === feeSnapshot(sv[d])) applyLoaded(d, getDocumentTypes(campusKey, d))
      else mergeFresh(d)
    })
    const onStorage = (e) => { if (e.key === null || e.key === 'almirene_document_catalog') refresh() }
    window.addEventListener('almirene_document_catalog_updated', refresh)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('almirene_document_catalog_updated', refresh)
      window.removeEventListener('storage', onStorage)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campusKey, priceOnly])

  const handleSave = () => {
    try {
      const result = priceOnly
        ? saveDocumentFees(campusKey, dept,
            Object.fromEntries(rows.map(r => [r.id, r.fee.trim() === '' ? NaN : Number(r.fee)])), currentUser)
        : saveDocumentTypes(campusKey, dept, rows.map(r => ({
            id: r.id, label: r.label, requiresClearance: r.requiresClearance,
            fee: r.fee.trim() === '' ? NaN : Number(r.fee),
          })), currentUser)
      applyLoaded(dept, result)
      setError('')
      addToast(`${deptLabel} document fees saved.`, 'success')
    } catch (err) {
      if (err.code === 'LIST_CHANGED') mergeFresh(dept)   // nothing was saved; show the current list, keep the typed fees
      setError(err.message)
    }
  }

  const handleRemoveConfirmed = () => {
    const row = toRemove
    setToRemove(null)
    if (!row) return
    try {
      // The uploaded format travels with the document into "Deleted documents", so a restore brings it back
      removeDocumentType(campusKey, dept, row.id, currentUser, { template: getTemplate(campusKey, dept, row.id) ?? null })
      try { removeTemplate(campusKey, dept, row.id, currentUser) } catch { /* the document is already in the trash with its format */ }
      setDrafts(prev => ({ ...prev, [dept]: prev[dept].filter(r => r.id !== row.id) }))
      setSaved(prev => ({ ...prev, [dept]: prev[dept].filter(r => r.id !== row.id) }))
      setError('')
      addToast(`${row.label} deleted. Restore it from the Formats tab within ${DOCUMENT_TRASH_RETENTION_DAYS} days.`, 'success')
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDiscard = () => { applyLoaded(dept, getDocumentTypes(campusKey, dept)); setError('') }

  const handleReset = () => {
    try {
      resetDocumentTypes(campusKey, dept, currentUser)
      applyLoaded(dept, getDocumentTypes(campusKey, dept))
      setConfirmReset(false)
      setError('')
      addToast(`${deptLabel} document fees reset to defaults.`, 'info')
    } catch (err) {
      setConfirmReset(false)
      setError(err.message)
    }
  }

  const inputCls = 'w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-border-focus)] transition'

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-[var(--color-text-primary)]">Document fees</h2>
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
          {campusName ? `${campusName} · ` : ''}Set the price of each document. Use 0 for a free document.
          Changes apply to new requests only; requests already recorded keep their price.
          {priceOnly && ' Documents and the clearance rule are set up by the technical admin.'}
        </p>
      </div>

      {/* Basic Ed / College */}
      <div className="flex gap-2 max-w-sm">
        {FEE_DEPARTMENTS.map(d => (
          <button key={d.id} type="button" onClick={() => { setDept(d.id); setError('') }}
            className={`flex-1 py-2.5 text-xs rounded-xl border transition-colors font-medium flex items-center justify-center gap-1.5
              ${dept === d.id
                ? 'is-selected'
                : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary-readable)]'}`}>
            {d.label}
            {isDirty(d.id) && <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-warning)]" aria-label="Unsaved changes" />}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className={`hidden sm:grid ${priceOnly ? 'grid-cols-[1fr_9rem_10rem]' : 'grid-cols-[1fr_9rem_10rem_2.5rem]'} gap-3 px-4 py-2.5 border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)] text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide`}>
          <span>Document</span>
          <span>Fee (₱)</span>
          <span>Clearance</span>
          {!priceOnly && <span></span>}
        </div>

        <div className="divide-y divide-[var(--color-border)]">
          {rows.map(r => (
            <div key={r._k} className={`flex flex-col gap-2 sm:grid ${priceOnly ? 'sm:grid-cols-[1fr_9rem_10rem]' : 'sm:grid-cols-[1fr_9rem_10rem_2.5rem]'} sm:gap-3 sm:items-center px-4 py-3`}>
              {priceOnly
                ? <p className="text-sm font-medium text-[var(--color-text-primary)] py-1">{r.label}</p>
                : <input className={inputCls} value={r.label} aria-label="Document name" maxLength={60}
                    onChange={e => updateRow(r._k, { label: e.target.value })} placeholder="Document name" />}
              <div className="flex items-center gap-2 sm:contents">
                <div className="relative w-32 sm:w-auto">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--color-text-muted)]">₱</span>
                  <input className={`${inputCls} pl-7 font-mono`} inputMode="decimal" value={r.fee} aria-label="Fee"
                    onChange={e => updateRow(r._k, { fee: cleanFee(e.target.value) })} placeholder="0" />
                </div>
                {priceOnly ? (
                  // Read only for accounting / admin: the technical admin decides this
                  <span className="flex-1 sm:flex-none text-xs text-[var(--color-text-muted)] px-1">
                    {r.requiresClearance ? 'Needs clearance' : 'No clearance'}
                  </span>
                ) : (
                  <button type="button" onClick={() => updateRow(r._k, { requiresClearance: !r.requiresClearance })}
                    aria-pressed={r.requiresClearance}
                    className={`flex-1 sm:flex-none py-2.5 px-3 text-xs rounded-xl border transition-colors font-medium
                      ${r.requiresClearance
                        ? 'is-selected'
                        : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary-readable)]'}`}>
                    {r.requiresClearance ? 'Needs clearance' : 'No clearance'}
                  </button>
                )}
                {!priceOnly && (
                  <button type="button" onClick={() => requestRemove(r)} aria-label={`Delete ${r.label || 'document'}`}
                    className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg hover:bg-[var(--color-error-light)] transition text-[var(--color-text-muted)] hover:text-[var(--color-error-text)]">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          ))}
          {rows.length === 0 && (
            <p className="px-4 py-6 text-center text-xs text-[var(--color-text-muted)]">
              {priceOnly ? 'No documents yet. The technical admin adds them.' : 'No documents yet. Add one below.'}
            </p>
          )}
        </div>

        {!priceOnly && (
          <div className="px-4 py-3 border-t border-[var(--color-border)]">
            <button type="button" onClick={addRow} className="btn btn-ghost text-xs gap-1.5">
              <Plus size={14} /> Add document
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-[var(--color-error-light)] border border-[var(--color-error-border)] rounded-xl text-xs text-[var(--color-error-text)]">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          {custom[dept] && !priceOnly && (
            <button type="button" onClick={() => setConfirmReset(true)} className="btn btn-ghost text-xs gap-1.5">
              <RotateCcw size={13} /> Reset to defaults
            </button>
          )}
        </div>
        <div className="flex flex-col-reverse sm:flex-row gap-2">
          {dirty && <button type="button" onClick={handleDiscard} className="btn btn-ghost text-sm">Discard changes</button>}
          <button type="button" onClick={handleSave} disabled={!dirty} className="btn btn-primary text-sm gap-1.5 disabled:opacity-50">
            <Check size={14} /> Save {deptLabel} fees
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmReset}
        title={`Reset ${deptLabel} fees`}
        message={`This puts every ${deptLabel} document back to the default list and prices for this campus, and removes any documents you added. Requests already recorded are not affected.`}
        confirmLabel="Reset to defaults"
        danger
        onConfirm={handleReset}
        onCancel={() => setConfirmReset(false)}
      />

      <ConfirmDialog
        open={!!toRemove}
        title="Delete this document?"
        message={toRemove
          ? `"${toRemove.label}" will be removed from the document list for this campus. You can restore it from the Formats tab for ${DOCUMENT_TRASH_RETENTION_DAYS} days, with its price and uploaded format. Requests already filed for it stay as history.`
          : ''}
        confirmLabel="Delete document"
        danger
        onConfirm={handleRemoveConfirmed}
        onCancel={() => setToRemove(null)}
      />
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  )
}
