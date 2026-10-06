/**
 * INCCompletion.jsx — ALMIRENE DX
 *
 * INC (Incomplete) Grade Completion tracking page.
 * Workflow: INC Recorded → Completion Period Open → Requirements Submitted →
 *           Teacher Evaluated → Final Grade Posted (or → Auto-Failed if deadline passes)
 *
 * Records are created AUTOMATICALLY — not via a "New" button here — when a
 * teacher submits a College grade with a special grade of "INC" in
 * e-Class Record. This page is where that INC gets tracked through to
 * resolution (a real final grade posted, or auto-failed at 5.00 if the
 * student never completes the requirements before the deadline).
 *
 * Roles & what they see:
 *   teacher            — Drive their own students' INC records through every step.
 *   program_head       — View-only (per the inc_completion workflow's own
 *                        permissions — every actionable step is teacher-driven).
 *   registrar_college  — View-only, export.
 *   technical_admin     — Full access to all records + audit trail.
 *
 * Rule: Audit trail tab is read-only and permanent. Never editable.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Hourglass, Search, CheckCircle, X, Clock,
  AlertCircle, Eye, History, Calendar, FileCheck,
  ClipboardCheck, Send, ArrowRight, Shield,
} from 'lucide-react'
import { useAuth }      from '../context/AuthContext'
import { useAppConfig } from '../context/AppConfigContext'
import GroupedSelect    from '../components/GroupedSelect'
import {
  ConfirmDialog, useToast, ToastContainer, ModalPortal, PageSkeleton
} from '../components/UIComponents'
import {
  getINCCompletions, getINCCompletionById, getINCActions, advanceINCStep,
  markAutoFailed, isOverdue, getINCAuditTrail, getAllINCAuditEntries,
  INC_STATUSES, getINCStepDef,
} from '../utils/incCompletionBridge'

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const COLOR_MAP = {
  yellow: 'bg-[var(--color-pending-bg)] text-[var(--color-pending-text)]',
  blue:   'bg-[var(--color-info-light)] text-[var(--color-info-text)]',
  indigo: 'bg-[var(--color-cat-indigo-bg)] text-[var(--color-cat-indigo-text)]',
  purple: 'bg-[var(--color-cat-purple-bg)] text-[var(--color-cat-purple-text)]',
  green:  'bg-[var(--color-success-light)] text-[var(--color-success-text)]',
  red:    'bg-[var(--color-error-light)] text-[var(--color-error-text)]',
  gray:   'bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)]',
}

function StatusBadge({ record }) {
  const stepDef = getINCStepDef(record)
  const fallback = INC_STATUSES.find(s => s.id === record.status)
  const label = stepDef?.label ?? fallback?.label ?? record.status
  const color = stepDef?.color ?? fallback?.color ?? 'gray'
  const Icon = record.status === 'auto_failed' ? X
             : record.status === 'registrar_posted' ? CheckCircle
             : Clock
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${COLOR_MAP[color] ?? COLOR_MAP.gray}`}>
      <Icon size={10} />
      {label}
    </span>
  )
}

function fmtDate(iso, opts) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-PH', opts || { month: 'short', day: 'numeric', year: 'numeric' })
}

function DeadlineTag({ record }) {
  const overdue = isOverdue(record)
  const resolved = ['registrar_posted', 'auto_failed'].includes(record.status)
  if (resolved) return <span className="text-[var(--color-text-muted)]">—</span>
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${overdue ? 'text-[var(--color-error-text)]' : 'text-[var(--color-text-secondary)]'}`}>
      <Calendar size={11} />
      {fmtDate(record.deadline)}
      {overdue && <span className="ml-1 font-bold">Overdue</span>}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// RECORD DETAIL DRAWER
// ─────────────────────────────────────────────────────────────────────────────

function INCDrawer({ record: initialRecord, currentUser, onUpdate, onClose }) {
  const [record, setRecord]           = useState(initialRecord)
  const [note, setNote]               = useState('')
  const [completionGrade, setCompletionGrade] = useState('')
  const [completionSpecial, setCompletionSpecial] = useState('')
  const [autoFailConfirm, setAutoFailConfirm] = useState(false)
  const [audit, setAudit]             = useState([])
  const [busy, setBusy]               = useState(false)
  const { toasts, addToast, removeToast } = useToast()

  useEffect(() => {
    setAudit(getINCAuditTrail(record.id))
  }, [record.id])

  const actions   = getINCActions(currentUser, record)
  const hasAction = (id) => actions.some(a => a.id === id)
  const overdue   = isOverdue(record)
  const resolved  = ['registrar_posted', 'auto_failed'].includes(record.status)

  const refresh = () => {
    const fresh = getINCCompletionById(record.id)
    if (fresh) setRecord(fresh)
    onUpdate()
  }

  const runAction = (actionId, extra = {}) => {
    setBusy(true)
    try {
      advanceINCStep(record.id, actionId, extra, currentUser)
      addToast('Updated.', 'success')
      setNote('')
      refresh()
    } catch (err) {
      addToast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleSubmitGrade = () => {
    if (!completionGrade.trim() && !completionSpecial) {
      addToast('Enter the completion grade.', 'error')
      return
    }
    runAction('submit_grade', {
      completionGrade,
      completionSpecialGrade: completionSpecial || null,
    })
  }

  const handleAutoFail = () => {
    setBusy(true)
    try {
      markAutoFailed(record.id, currentUser?.name || 'System')
      addToast('Marked as auto-failed (5.00).', 'success')
      setAutoFailConfirm(false)
      refresh()
    } catch (err) {
      addToast(err.message, 'error')
      setAutoFailConfirm(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalPortal>
      <div className="modal-backdrop">
        <div className="modal-panel" style={{ maxWidth: '40rem' }}>
          {/* Header */}
          <div className="flex items-start justify-between p-5 border-b border-[var(--color-border)]">
            <div>
              <h3 className="text-base font-bold text-[var(--color-text-primary)]">INC Completion</h3>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                {record.studentName} · {record.subjectName}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge record={record} />
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--color-bg-subtle)] transition">
                <X size={16} className="text-[var(--color-text-muted)]" />
              </button>
            </div>
          </div>

          <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
            {overdue && !resolved && (
              <div className="flex items-start gap-2 p-3 bg-[var(--color-error-light)] border border-[var(--color-error-border)] rounded-xl text-xs text-[var(--color-error-text)]">
                <AlertCircle size={13} className="shrink-0 mt-0.5" />
                <span>
                  <strong>Deadline passed</strong> ({fmtDate(record.deadline)}) without a posted grade.
                  This student can still be completed normally, or marked auto-failed below.
                </span>
              </div>
            )}

            {/* Details grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                ['Student',    record.studentName],
                ['Subject',    record.subjectName],
                ['Semester',   record.semester],
                ['School Year', record.schoolYear],
                ['Teacher',    record.teacherName],
                ['Deadline',   <DeadlineTag key="dl" record={record} />],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">{label}</p>
                  <p className="text-sm text-[var(--color-text-primary)] mt-0.5">{value}</p>
                </div>
              ))}
            </div>

            {/* Step-specific action panel */}
            {!resolved && (
              <div className="p-4 rounded-xl bg-[var(--color-bg-subtle)] border border-[var(--color-border)] space-y-3">
                {hasAction('open_completion') && (
                  <>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      INC recorded. Open the completion period once the student is ready to make up the requirements.
                    </p>
                    <button onClick={() => runAction('open_completion')} disabled={busy}
                      className="btn btn-primary text-sm gap-1.5 disabled:opacity-50">
                      <Calendar size={14} /> Open Completion Period
                    </button>
                  </>
                )}

                {hasAction('requirements_received') && (
                  <>
                    <label className="text-xs font-semibold text-[var(--color-text-secondary)] block">
                      Note <span className="font-normal text-[var(--color-text-muted)]">(optional)</span>
                    </label>
                    <textarea
                      className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-card)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary resize-none"
                      rows={2} placeholder="e.g. Submitted make-up exam and project on..."
                      value={note} onChange={e => setNote(e.target.value)} />
                    <button onClick={() => runAction('requirements_received', { note })} disabled={busy}
                      className="btn btn-primary text-sm gap-1.5 disabled:opacity-50">
                      <FileCheck size={14} /> Mark Requirements Received
                    </button>
                  </>
                )}

                {hasAction('evaluate') && (
                  <>
                    <label className="text-xs font-semibold text-[var(--color-text-secondary)] block">
                      Evaluation Note <span className="font-normal text-[var(--color-text-muted)]">(optional)</span>
                    </label>
                    <textarea
                      className="w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-card)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary resize-none"
                      rows={2} placeholder="e.g. Make-up exam scored 82%, project satisfactory."
                      value={note} onChange={e => setNote(e.target.value)} />
                    <button onClick={() => runAction('evaluate', { note })} disabled={busy}
                      className="btn btn-primary text-sm gap-1.5 disabled:opacity-50">
                      <ClipboardCheck size={14} /> Evaluate Requirements
                    </button>
                  </>
                )}

                {hasAction('submit_grade') && (
                  <>
                    <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">
                      Final Grade *
                    </label>
                    <input
                      className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-card)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition font-mono"
                      placeholder="e.g. 1.75" value={completionGrade}
                      onChange={e => setCompletionGrade(e.target.value)} disabled={!!completionSpecial} />
                    <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mt-2 mb-1">
                      Special Grade Override <span className="font-normal text-[var(--color-text-muted)]">(optional)</span>
                    </label>
                    <GroupedSelect
                      value={completionSpecial || 'all'}
                      onChange={v => setCompletionSpecial(v === 'all' ? '' : v)}
                      options={[
                        { value: 'DRP',  label: 'DRP — Dropped' },
                        { value: '4.00', label: '4.00 — Conditional Failure' },
                      ]}
                      allLabel="None — use numeric grade above"
                      placeholder="None"
                    />
                    <button onClick={handleSubmitGrade} disabled={busy}
                      className="btn btn-primary text-sm gap-1.5 disabled:opacity-50 mt-2">
                      <Send size={14} /> Submit Final Grade
                    </button>
                  </>
                )}

                {overdue && (
                  <button onClick={() => setAutoFailConfirm(true)} disabled={busy}
                    className="btn text-sm bg-[var(--color-error)] text-[var(--color-text-inverse)] hover:brightness-90 gap-1.5 disabled:opacity-50">
                    <X size={14} /> Mark as Auto-Failed (5.00)
                  </button>
                )}
              </div>
            )}

            {resolved && (
              <div className={`p-4 rounded-xl border text-sm ${
                record.status === 'auto_failed'
                  ? 'bg-[var(--color-error-light)] border-[var(--color-error-border)] text-[var(--color-error-text)]'
                  : 'bg-[var(--color-success-light)] border-[var(--color-success-border)] text-[var(--color-success-text)]'
              }`}>
                {record.status === 'auto_failed'
                  ? 'Deadline passed without completion. Final grade posted as 5.00 (Failed).'
                  : `Resolved. Final grade posted: ${record.completionSpecialGrade || record.completionGrade}.`}
              </div>
            )}

            {/* Status history */}
            <div>
              <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">History</p>
              <div className="space-y-2">
                {record.statusHistory.map((h, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <ArrowRight size={11} className="text-[var(--color-text-muted)] mt-0.5 shrink-0" />
                    <div>
                      <span className="text-[var(--color-text-primary)]">{h.note}</span>
                      <span className="text-[var(--color-text-muted)]"> — {h.by}, {fmtDate(h.at, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {audit.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <History size={12} /> Audit Trail
                </p>
                <div className="space-y-1.5">
                  {audit.map((e, i) => (
                    <p key={i} className="text-[11px] text-[var(--color-text-muted)]">
                      <code className="font-mono">{e.action.toUpperCase()}</code> — {e.detail} ({e.by}, {fmtDate(e.at, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })})
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>

          <ConfirmDialog
            open={autoFailConfirm}
            title="Mark as Auto-Failed?"
            message={`This will permanently set ${record.studentName}'s grade for ${record.subjectName} to 5.00 (Failed) since the completion deadline has passed. This cannot be undone. Proceed?`}
            confirmLabel="Mark Auto-Failed"
            danger
            onConfirm={handleAutoFail}
            onCancel={() => setAutoFailConfirm(false)}
          />

          <ToastContainer toasts={toasts} removeToast={removeToast} />
        </div>
      </div>
    </ModalPortal>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function INCCompletion() {
  const { user }       = useAuth()
  const { currentSchoolYear, activeCampuses } = useAppConfig()

  const campusKey  = user?.campusKey || activeCampuses?.[0]?.key || ''
  const schoolYear = currentSchoolYear?.year || '2025-2026'

  const [records,       setRecords]       = useState([])
  const [loading,       setLoading]       = useState(true)
  const [statusFilter,  setStatusFilter]  = useState('all')
  const [search,        setSearch]        = useState('')
  const [selected,      setSelected]      = useState(null)
  const [activeTab,     setActiveTab]     = useState('records') // 'records' | 'audit'
  const [auditAll,      setAuditAll]      = useState([])
  const { toasts, addToast, removeToast } = useToast()

  const role         = user?.role
  const isTeacher    = role === 'teacher'
  const isSuperAdmin = role === 'technical_admin'

  const loadData = useCallback(() => {
    const filters = { campusKey, schoolYear }
    if (isTeacher) filters.teacherId = user?.id
    if (statusFilter !== 'all') filters.status = statusFilter
    setRecords(getINCCompletions(filters))
    if (isSuperAdmin) setAuditAll(getAllINCAuditEntries(campusKey))
    setLoading(false)
  }, [campusKey, schoolYear, statusFilter, isTeacher, isSuperAdmin, user?.id])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => {
    const h = () => loadData()
    window.addEventListener('almirene_inc_completion_updated', h)
    return () => window.removeEventListener('almirene_inc_completion_updated', h)
  }, [loadData])

  const filtered = records.filter(r => {
    if (!search) return true
    const q = search.toLowerCase()
    return r.studentName?.toLowerCase().includes(q) || r.subjectName?.toLowerCase().includes(q)
  })

  const counts = {}
  INC_STATUSES.forEach(s => {
    counts[s.id] = records.filter(r => r.status === s.id).length
  })
  const pending = records.filter(r => !['registrar_posted', 'auto_failed'].includes(r.status)).length
  const overdueCount = records.filter(r => isOverdue(r)).length

  if (loading) return <PageSkeleton />

  return (
    <div className="page-enter space-y-5">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)]">
            INC Grade Completion
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
            {schoolYear} · {pending > 0 ? `${pending} pending` : 'No pending INC records'}
            {overdueCount > 0 && <span className="text-[var(--color-error-text)] font-semibold"> · {overdueCount} overdue</span>}
          </p>
        </div>
      </div>

      <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-[var(--color-info-light)] border border-[var(--color-info-border)] text-xs text-[var(--color-info-text)]">
        <Shield size={13} className="shrink-0 mt-0.5" />
        <span>
          INC records are created automatically when a teacher submits a College grade marked <strong>INC</strong> in e-Class Record —
          there's no manual "New" button here. Track each one through to a posted final grade, or mark it auto-failed if the completion deadline passes.
        </span>
      </div>

      {/* Tabs (Super Admin gets audit trail tab) */}
      {isSuperAdmin && (
        <div className="flex gap-1 p-1 bg-[var(--color-bg-subtle)] rounded-xl w-fit">
          {[{ id: 'records', label: 'Records', icon: Hourglass }, { id: 'audit', label: 'Audit Trail', icon: History }].map(tab => (
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

      {/* ── RECORDS TAB ── */}
      {activeTab === 'records' && (
        <>
          {/* Status filter chips */}
          <div className="flex flex-wrap gap-2">
            {[{ id: 'all', label: `All (${records.length})` }, ...INC_STATUSES.map(s => ({ id: s.id, label: `${s.label} (${counts[s.id] || 0})` }))].map(f => (
              <button key={f.id} onClick={() => setStatusFilter(f.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors
                  ${statusFilter === f.id
                    ? 'bg-primary text-[var(--color-primary-contrast)] border-primary'
                    : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary-readable)]'}`}>
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

          {/* Records list */}
          {filtered.length === 0 ? (
            <div className="card p-10 text-center">
              <Hourglass size={40} className="mx-auto mb-3 text-[var(--color-text-muted)] opacity-40" />
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">No INC records found</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                Records appear here automatically when a College grade is submitted as INC.
              </p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="hidden sm:grid grid-cols-[1fr_120px_150px_120px_80px_60px] gap-3 px-4 py-2.5 border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)] text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                <span>Student / Subject</span>
                <span>Semester</span>
                <span>Status</span>
                <span>Deadline</span>
                <span>Filed</span>
                <span></span>
              </div>

              <div className="divide-y divide-[var(--color-border)]">
                {filtered.map(r => (
                  <div key={r.id}
                    className="grid grid-cols-1 sm:grid-cols-[1fr_120px_150px_120px_80px_60px] gap-2 sm:gap-3 px-4 py-3 hover:bg-[var(--color-bg-subtle)]/50 transition-colors items-center">
                    <div>
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">{r.studentName}</p>
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{r.subjectName}</p>
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)] hidden sm:block">{r.semester}</p>
                    <div className="hidden sm:block"><StatusBadge record={r} /></div>
                    <div className="hidden sm:block"><DeadlineTag record={r} /></div>
                    <p className="text-xs text-[var(--color-text-muted)] hidden sm:block">
                      {fmtDate(r.createdAt, { month: 'short', day: 'numeric' })}
                    </p>
                    <div className="flex justify-end">
                      <button onClick={() => setSelected(r)}
                        className="p-2 rounded-lg hover:bg-[var(--color-bg-subtle)] transition text-[var(--color-text-muted)] hover:text-[var(--color-primary-readable)]">
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
                    ${entry.action === 'posted' ? 'bg-[var(--color-success-light)] text-[var(--color-success-text)]'
                    : entry.action === 'auto_failed' ? 'bg-[var(--color-error-light)] text-[var(--color-error-text)]'
                    : 'bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)]'}`}>
                    {entry.action.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[var(--color-text-primary)]">{entry.detail}</p>
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                      {entry.by} · {fmtDate(entry.at, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · Record: <code className="font-mono">{entry.requestId}</code>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {selected && (
        <INCDrawer
          record={selected}
          currentUser={user}
          onUpdate={() => {
            loadData()
            const fresh = getINCCompletionById(selected.id)
            if (fresh) setSelected(fresh); else setSelected(null)
          }}
          onClose={() => setSelected(null)}
        />
      )}

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  )
}
