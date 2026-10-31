/**
 * Guidance.jsx — ALMIRENE DX Guidance records
 *
 * One page, three ways to see it (decided by getGuidanceAccess in appConfig.js):
 *   - Editor   the Guidance role, or any account with the Guidance module duty.
 *              Referrals, Incidents, Testing and Activity. Adds, edits, closes.
 *   - Viewer   Principal / Program Head (their own level) and Super Admin (one campus at a time).
 *              Same lists, read only. Activity is for editors and Super Admin only.
 *   - Teacher  a teacher who is not an editor. Sends referral requests and follows their status.
 *              Never sees any Guidance record.
 *
 * PRIVACY: this page never asks for or shows free text. Counseling notes are not stored.
 * The only typed value is the case number, a short reference code to the school's own file.
 * No export on purpose: Guidance data is sensitive and an export cannot be taken back.
 *
 * All storage goes through guidanceBridge.js. Flat colors and CSS variables only.
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  HeartHandshake, Plus, Search, X, Pencil, Trash2, Info, AlertCircle, School,
  Send, RotateCcw, Check, Clock, Eye, Lock,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useAppConfig } from '../context/AppConfigContext'
import { useCampusFilter } from '../context/CampusFilterContext'
import {
  useToast, ToastContainer, PageSkeleton, ModalPortal, ConfirmDialog,
} from '../components/UIComponents'
import { useTablePaging, SortTh, Pager } from '../components/DataTable'
import GroupedSelect from '../components/GroupedSelect'
import DatePicker from '../components/DatePicker'
import {
  getGuidanceAccess, todayYMD, CLEARANCE_DEPARTMENT_SCOPES,
  GUIDANCE_REFERRAL_SOURCES, GUIDANCE_REFERRAL_REASONS, GUIDANCE_REFERRAL_STATUSES,
  GUIDANCE_INCIDENT_CATEGORIES, GUIDANCE_SANCTIONS, GUIDANCE_INCIDENT_STATUSES,
  GUIDANCE_TESTS, GUIDANCE_TEST_TRACKS,
} from '../config/appConfig'
import {
  getGuidanceRecords, getGuidanceAudit, getGuidanceStudents,
  createGuidanceRecord, updateGuidanceRecord, setGuidanceStatus,
  deleteGuidanceRecord, canDeleteGuidanceRecord, describeGuidanceRecord, isFollowUpDue,
  getReferralStudents, createReferralRequest, getMyReferralRequests, withdrawReferralRequest,
} from '../utils/guidanceBridge'

// ─────────────────────────────────────────────────────────────────────────────
// SMALL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const INPUT_CLASS = 'w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition'

const fmtDate = (ymd) => {
  if (!ymd) return '—'
  try { return new Date(`${ymd}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
  catch { return '—' }
}
const fmtDateTime = (iso) => {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) }
  catch { return '—' }
}
const toOptions = (list) => list.map(x => ({ value: x.id, label: x.label }))
const levelLabel = (id) => CLEARANCE_DEPARTMENT_SCOPES.find(s => s.id === id)?.label || id

const TONES = {
  warning: 'bg-[var(--color-warning-light)] text-[var(--color-warning-text)] border-[var(--color-warning-border)]',
  info:    'bg-[var(--color-info-light)] text-[var(--color-info-text)] border-[var(--color-info-border)]',
  success: 'bg-[var(--color-success-light)] text-[var(--color-success-text)] border-[var(--color-success-border)]',
  neutral: 'bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)] border-[var(--color-border)]',
}
const STATUS_TONE = {
  requested: 'warning', open: 'info', in_progress: 'info', closed: 'neutral', resolved: 'success',
  sent: 'warning', received: 'info',
}

function Pill({ tone = 'neutral', children }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border whitespace-nowrap ${TONES[tone]}`}>
      {children}
    </span>
  )
}
const StatusPill = ({ status, label }) => <Pill tone={STATUS_TONE[status] || 'neutral'}>{label}</Pill>

const DueBadge = () => (
  <Pill tone="warning"><Clock size={11} aria-hidden="true" /> Follow-up due</Pill>
)

function FieldError({ children }) {
  return children ? <p className="text-xs text-[var(--color-error-text)] mt-1" role="alert">{children}</p> : null
}

// What each status can move to. Closed records are locked until reopened.
const TRANSITIONS = {
  referral: {
    requested:   [{ to: 'open', label: 'Accept', done: 'Referral accepted.' }, { to: 'closed', label: 'Decline', done: 'Referral declined.' }],
    open:        [{ to: 'in_progress', label: 'Start', done: 'Marked in progress.' }, { to: 'closed', label: 'Close', done: 'Referral closed.' }],
    in_progress: [{ to: 'closed', label: 'Close', done: 'Referral closed.' }],
    closed:      [{ to: 'open', label: 'Reopen', done: 'Referral reopened.' }],
  },
  incident: {
    open:     [{ to: 'resolved', label: 'Resolve', done: 'Incident resolved.' }],
    resolved: [{ to: 'open', label: 'Reopen', done: 'Incident reopened.' }],
  },
}
const KIND_NOUN = { referral: 'referral', incident: 'incident', testing: 'test result' }
const isLocked = (kind, status) => (kind === 'referral' && status === 'closed') || (kind === 'incident' && status === 'resolved')

// ─────────────────────────────────────────────────────────────────────────────
// STUDENT PICKER — searchable list (GroupedSelect has no search)
// ─────────────────────────────────────────────────────────────────────────────

function StudentPicker({ students, value, onChange, locked = false, error }) {
  const [q, setQ] = useState('')
  const selected = students.find(s => String(s.id) === String(value))
  const matches = useMemo(() => {
    const t = q.trim().toLowerCase()
    const list = t ? students.filter(s => s.name.toLowerCase().includes(t) || String(s.studentNo).includes(t)) : students
    return list.slice(0, 30)
  }, [students, q])

  if (selected) {
    return (
      <div>
        <div className="flex items-center gap-3 px-3 py-2.5 border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)]">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{selected.name}</p>
            <p className="text-xs text-[var(--color-text-muted)] truncate">
              <span className="font-mono">{selected.studentNo || '—'}</span>{selected.gradeLevel ? ` · ${selected.gradeLevel}` : ''}
            </p>
          </div>
          {locked
            ? <Lock size={14} className="text-[var(--color-text-muted)] shrink-0" aria-label="Student cannot be changed" />
            : <button type="button" onClick={() => onChange('')} className="btn btn-ghost text-xs py-1.5 px-3">Change</button>}
        </div>
        <FieldError>{error}</FieldError>
      </div>
    )
  }

  return (
    <div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" aria-hidden="true" />
        <input
          type="text" value={q} onChange={e => setQ(e.target.value)}
          placeholder="Search student name or number…"
          aria-label="Search student"
          className={`${INPUT_CLASS} pl-9`}
        />
      </div>
      <ul className="mt-2 max-h-48 overflow-y-auto border border-[var(--color-border)] rounded-xl divide-y divide-[var(--color-border)]">
        {matches.length === 0 && (
          <li className="px-3 py-4 text-sm text-center text-[var(--color-text-muted)]">No student found.</li>
        )}
        {matches.map(s => (
          <li key={s.id}>
            <button type="button" onClick={() => onChange(s.id)}
              className="w-full text-left px-3 py-2.5 hover:bg-[var(--color-bg-subtle)] transition">
              <span className="block text-sm font-medium text-[var(--color-text-primary)]">{s.name}</span>
              <span className="block text-xs text-[var(--color-text-muted)]">
                <span className="font-mono">{s.studentNo || '—'}</span>{s.gradeLevel ? ` · ${s.gradeLevel}` : ''}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {students.length > matches.length && !q && (
        <p className="text-xs text-[var(--color-text-muted)] mt-1">Showing the first {matches.length}. Type to narrow down.</p>
      )}
      <FieldError>{error}</FieldError>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// RECORD MODAL — add / edit a referral, incident or test result (editors)
// ─────────────────────────────────────────────────────────────────────────────

function initialForm(kind, record) {
  if (record) {
    if (kind === 'referral') return { studentId: record.studentId, date: record.date, source: record.source, reason: record.reason, followUpDate: record.followUpDate || '', caseNo: record.caseNo || '' }
    if (kind === 'incident') return { studentId: record.studentId, date: record.date, category: record.category, sanction: record.sanction, caseNo: record.caseNo || '' }
    return { studentId: record.studentId, date: record.date, testId: record.testId, result: String(record.result ?? '') }
  }
  const base = { studentId: '', date: todayYMD() }
  if (kind === 'referral') return { ...base, source: '', reason: '', followUpDate: '', caseNo: '' }
  if (kind === 'incident') return { ...base, category: '', sanction: '', caseNo: '' }
  return { ...base, testId: '', result: '' }
}

function SelectField({ label, value, onChange, options, placeholder, error, required = true }) {
  return (
    <div>
      <label className="form-label">{label}{required && <span className="text-[var(--color-error-text)]"> *</span>}</label>
      <GroupedSelect
        value={value || 'all'}
        onChange={v => onChange(v === 'all' ? '' : v)}
        allLabel={placeholder}
        options={options}
      />
      <FieldError>{error}</FieldError>
    </div>
  )
}

function RecordModal({ kind, record, students, onSubmit, onClose }) {
  const editing = !!record
  const [form, setForm] = useState(() => initialForm(kind, record))
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: undefined })) }
  const test = GUIDANCE_TESTS.find(t => t.id === form.testId)

  const submit = () => {
    setSaving(true)
    const res = onSubmit(form)
    setSaving(false)
    if (res && res.ok === false) setErrors(res.errors || {})
  }

  return (
    <ModalPortal onClose={onClose}>
      <div className="modal-backdrop">
        <div className="modal-panel">
          <div className="modal-header">
            <h3 className="text-base font-bold text-[var(--color-text-primary)]">
              {editing ? 'Edit' : 'Add'} {KIND_NOUN[kind]}
            </h3>
            <button type="button" onClick={onClose} className="icon-btn icon-btn-ghost" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 space-y-4 overflow-y-auto">
            <div>
              <label className="form-label">Student <span className="text-[var(--color-error-text)]">*</span></label>
              <StudentPicker students={students} value={form.studentId} onChange={v => set('studentId', v)} locked={editing} error={errors.studentId} />
            </div>

            <div>
              <label className="form-label">Date <span className="text-[var(--color-error-text)]">*</span></label>
              <DatePicker value={form.date} onChange={v => set('date', v)} placeholder="Select date" />
              <FieldError>{errors.date}</FieldError>
            </div>

            {kind === 'referral' && (
              <>
                <SelectField label="Referred by" value={form.source} onChange={v => set('source', v)} options={toOptions(GUIDANCE_REFERRAL_SOURCES)} placeholder="Choose who referred…" error={errors.source} />
                <SelectField label="Reason" value={form.reason} onChange={v => set('reason', v)} options={toOptions(GUIDANCE_REFERRAL_REASONS)} placeholder="Choose a reason…" error={errors.reason} />
                <div>
                  <label className="form-label">Follow-up date <span className="text-[var(--color-text-muted)] font-normal">(optional)</span></label>
                  <DatePicker value={form.followUpDate} onChange={v => set('followUpDate', v)} placeholder="Select date" />
                  <FieldError>{errors.followUpDate}</FieldError>
                </div>
              </>
            )}

            {kind === 'incident' && (
              <>
                <SelectField label="Category" value={form.category} onChange={v => set('category', v)} options={toOptions(GUIDANCE_INCIDENT_CATEGORIES)} placeholder="Choose a category…" error={errors.category} />
                <SelectField label="Sanction" value={form.sanction} onChange={v => set('sanction', v)} options={toOptions(GUIDANCE_SANCTIONS)} placeholder="Choose a sanction…" error={errors.sanction} />
              </>
            )}

            {kind === 'testing' && (
              <>
                <SelectField
                  label="Test" value={form.testId}
                  onChange={v => { setForm(f => ({ ...f, testId: v, result: '' })); setErrors(e => ({ ...e, testId: undefined, result: undefined })) }}
                  options={GUIDANCE_TESTS.map(t => ({ value: t.id, label: t.label }))}
                  placeholder="Choose a test…" error={errors.testId}
                />
                {test?.resultType === 'score' && (
                  <div>
                    <label className="form-label">Score <span className="text-[var(--color-error-text)]">*</span></label>
                    <input
                      type="number" inputMode="decimal" min={test.min} max={test.max} step="any"
                      value={form.result} onChange={e => set('result', e.target.value)}
                      placeholder={`${test.min} to ${test.max}`} className={INPUT_CLASS} aria-label="Score"
                    />
                    <FieldError>{errors.result}</FieldError>
                  </div>
                )}
                {test?.resultType === 'track' && (
                  <SelectField label="Result" value={form.result} onChange={v => set('result', v)} options={toOptions(GUIDANCE_TEST_TRACKS)} placeholder="Choose a result…" error={errors.result} />
                )}
              </>
            )}

            {kind !== 'testing' && (
              <div>
                <label className="form-label">Case no. <span className="text-[var(--color-text-muted)] font-normal">(optional)</span></label>
                <input
                  type="text" maxLength={20} value={form.caseNo}
                  onChange={e => set('caseNo', e.target.value.replace(/[^A-Za-z0-9-]/g, ''))}
                  placeholder="e.g. GN-2026-014" className={`${INPUT_CLASS} font-mono`} aria-label="Case number"
                />
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  A reference code only, to find the school's own file. Do not type names or details.
                </p>
                <FieldError>{errors.caseNo}</FieldError>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-cancel">Cancel</button>
            <button type="button" onClick={submit} disabled={saving} className="btn-submit">
              {editing ? 'Save changes' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERIC LIST — table on wide screens, cards on a phone
// ─────────────────────────────────────────────────────────────────────────────

function RecordList({ rows, columns, sorters, defaultSort, descFirst = [], resetOn = [], noun, mobileCard, empty }) {
  const paging = useTablePaging(rows, { sorters, defaultSort, descFirst, resetOn })
  if (rows.length === 0) return empty
  return (
    <div className="card-section border border-[var(--color-border)]">
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full [&_th]:!px-3 [&_td]:!px-3">
          <thead className="bg-[var(--color-bg-subtle)]">
            <tr>
              {columns.map(c => c.sortKey
                ? <SortTh key={c.key} label={c.label} sortKey={c.sortKey} sort={paging.sort} onSort={paging.onSort} />
                : <th key={c.key} scope="col" className="th">{c.label}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {paging.rows.map(r => (
              <tr key={r.id} className="table-row">
                {columns.map(c => <td key={c.key} className="td">{c.cell(r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="md:hidden divide-y divide-[var(--color-border)]">
        {paging.rows.map(r => <li key={r.id} className="p-4">{mobileCard(r)}</li>)}
      </ul>
      <Pager page={paging.page} pageCount={paging.pageCount} total={paging.total} onPage={paging.setPage}
        pageSize={paging.pageSize} onPageSize={paging.setPageSize} noun={noun} />
    </div>
  )
}

const bySt  = (a, b) => a.studentName.localeCompare(b.studentName)
const byStr = (k) => (a, b) => String(a[k] || '').localeCompare(String(b[k] || ''))
const REFERRAL_SORTERS = { student: bySt, date: byStr('date'), reason: byStr('reasonLabel'), followUp: (a, b) => (a.followUp || '9999').localeCompare(b.followUp || '9999'), status: byStr('statusLabel') }
const INCIDENT_SORTERS = { student: bySt, date: byStr('date'), category: byStr('categoryLabel'), sanction: byStr('sanctionLabel'), status: byStr('statusLabel') }
const TESTING_SORTERS  = { student: bySt, date: byStr('date'), test: byStr('testLabel') }
const ACTIVITY_SORTERS = { when: byStr('at'), who: byStr('byName'), action: byStr('actionLabel'), student: bySt }

function StudentCell({ row }) {
  return (
    <span className="block">
      <span className="block text-sm font-semibold text-[var(--color-text-primary)]">{row.studentName}</span>
      <span className="block text-xs text-[var(--color-text-muted)]">
        <span className="font-mono">{row.studentNo || '—'}</span>{row.grade ? ` · ${row.grade}` : ''}
      </span>
    </span>
  )
}

function Fact({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">{label}</dt>
      <dd className="text-sm text-[var(--color-text-primary)]">{children || '—'}</dd>
    </div>
  )
}

// Buttons that act on one record
function RowActions({ kind, row, canAct, onStatus, onEdit, onDelete }) {
  if (!canAct) return null
  const moves = TRANSITIONS[kind]?.[row.status] || []
  const editable = !isLocked(kind, row.status)
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {moves.map(m => (
        <button key={m.to} type="button" onClick={() => onStatus(kind, row, m)}
          className="btn btn-ghost text-xs py-1.5 px-3 gap-1">
          {m.to === 'closed' || m.to === 'resolved' ? <Check size={13} aria-hidden="true" /> : m.label === 'Reopen' ? <RotateCcw size={13} aria-hidden="true" /> : null}
          {m.label}
        </button>
      ))}
      {editable && (
        <button type="button" onClick={() => onEdit(kind, row)} className="icon-btn icon-btn-ghost" aria-label={`Edit ${KIND_NOUN[kind]} for ${row.studentName}`} title="Edit">
          <Pencil size={15} />
        </button>
      )}
      {row.canDelete && (
        <button type="button" onClick={() => onDelete(kind, row)} className="icon-btn icon-btn-ghost text-[var(--color-error-text)]" aria-label={`Delete ${KIND_NOUN[kind]} for ${row.studentName}`} title="Delete">
          <Trash2 size={15} />
        </button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// WORKSPACE — editors and viewers
// ─────────────────────────────────────────────────────────────────────────────

function GuidanceWorkspace({ user, access }) {
  const { currentSchoolYear, schoolYears, activeCampuses } = useAppConfig()
  const { campusFilter = 'all' } = useCampusFilter()
  const { toasts, addToast, removeToast } = useToast()

  const isTechAdmin = user.role === 'technical_admin'
  const campus = isTechAdmin
    ? activeCampuses.find(c => c.key === campusFilter)
    : activeCampuses.find(c => c.key === user.campusKey)
  const campusKey  = campus?.key  || ''
  const campusName = campus?.name || ''

  const [tab, setTab]                 = useState('referral')
  const [schoolYear, setSchoolYear]   = useState(currentSchoolYear)
  const [search, setSearch]           = useState('')
  const [levelFilter, setLevelFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dueOnly, setDueOnly]         = useState(false)
  const [tick, setTick]               = useState(0)
  const [modal, setModal]             = useState(null)     // { kind, record|null }
  const [confirm, setConfirm]         = useState(null)     // { kind, row }

  const isCurrentYear = schoolYear === currentSchoolYear
  const canAct = access.canEdit && isCurrentYear
  const canSeeActivity = access.canEdit || isTechAdmin
  const yearOptions = (schoolYears || []).map(y => ({ value: y.year, label: y.year }))

  // Live refresh: this window, other tabs, and students changing
  useEffect(() => {
    const refresh = () => setTick(t => t + 1)
    const onStorage = (e) => { if (e.key === null || e.key === 'almirene_guidance_records' || e.key === 'almirene_students') refresh() }
    window.addEventListener('almirene_guidance_updated', refresh)
    window.addEventListener('almirene_students_updated', refresh)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('almirene_guidance_updated', refresh)
      window.removeEventListener('almirene_students_updated', refresh)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  // Switching campus or school year closes anything open for the previous view
  useEffect(() => { setModal(null); setConfirm(null) }, [campusKey, schoolYear])
  // Filters belong to a tab
  useEffect(() => { setStatusFilter('all'); setDueOnly(false) }, [tab])

  // ── Data (every read goes through the bridge, which checks access) ──
  const students = useMemo(
    () => getGuidanceStudents(user, { campusKey }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, campusKey, tick]
  )
  const studentMap = useMemo(() => new Map(students.map(s => [String(s.id), s])), [students])
  const pickerStudents = useMemo(
    () => students.filter(s => !s.schoolYear || s.schoolYear === currentSchoolYear),
    [students, currentSchoolYear]
  )

  const rawReferrals = useMemo(() => getGuidanceRecords(user, 'referral', { campusKey, schoolYear }), // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, campusKey, schoolYear, tick])
  const rawIncidents = useMemo(() => getGuidanceRecords(user, 'incident', { campusKey, schoolYear }), // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, campusKey, schoolYear, tick])
  const rawTesting   = useMemo(() => getGuidanceRecords(user, 'testing',  { campusKey, schoolYear }), // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, campusKey, schoolYear, tick])
  const rawAudit     = useMemo(() => (canSeeActivity ? getGuidanceAudit(user, { campusKey }) : []), // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, campusKey, canSeeActivity, tick])

  const decorate = useCallback((kind, r) => {
    const st = studentMap.get(String(r.studentId))
    const d = describeGuidanceRecord(kind, r)
    return {
      id: r.id, raw: r, status: r.status, level: r.level,
      studentName: st?.name || 'Student not found', studentNo: st?.studentNo || '', grade: st?.gradeLevel || '',
      date: r.date, caseNo: r.caseNo || '',
      statusLabel: d.status || '', result: d.result || '',
      reasonLabel: d.reason || '', categoryLabel: d.category || '', sanctionLabel: d.sanction || '', testLabel: d.test || '',
      sourceLabel: d.source || '',
      followUp: r.followUpDate || '', due: kind === 'referral' && isFollowUpDue(r),
      canDelete: canAct && canDeleteGuidanceRecord(user, kind, r, campusKey),
    }
  }, [studentMap, canAct, user, campusKey])

  const q = search.trim().toLowerCase()
  const passes = useCallback((row) =>
    (!q || row.studentName.toLowerCase().includes(q) || String(row.studentNo).toLowerCase().includes(q)) &&
    (levelFilter === 'all' || row.level === levelFilter) &&
    (statusFilter === 'all' || row.status === statusFilter),
  [q, levelFilter, statusFilter])

  const allReferrals = useMemo(() => rawReferrals.map(r => decorate('referral', r)), [rawReferrals, decorate])
  const allIncidents = useMemo(() => rawIncidents.map(r => decorate('incident', r)), [rawIncidents, decorate])
  const allTesting   = useMemo(() => rawTesting.map(r => decorate('testing', r)), [rawTesting, decorate])

  const referrals = useMemo(() => allReferrals.filter(r => passes(r) && (!dueOnly || r.due)), [allReferrals, passes, dueOnly])
  const incidents = useMemo(() => allIncidents.filter(passes), [allIncidents, passes])
  const testing   = useMemo(() => allTesting.filter(r => (!q || r.studentName.toLowerCase().includes(q) || String(r.studentNo).toLowerCase().includes(q)) && (levelFilter === 'all' || r.level === levelFilter)), [allTesting, q, levelFilter])

  const activity = useMemo(() => rawAudit.map(e => {
    const st = studentMap.get(String(e.studentId))
    const statuses = e.kind === 'incident' ? GUIDANCE_INCIDENT_STATUSES : GUIDANCE_REFERRAL_STATUSES
    const actionLabel = e.action === 'created' ? 'Added'
      : e.action === 'edited' ? 'Edited'
      : e.action === 'deleted' ? 'Deleted'
      : `Status: ${statuses.find(s => s.id === e.status)?.label || e.status || ''}`
    return {
      id: e.id, at: e.at, byName: e.byName || '—', actionLabel, level: e.level,
      kindLabel: KIND_NOUN[e.kind] || e.kind,
      studentName: st?.name || 'Student not found', studentNo: st?.studentNo || '', grade: st?.gradeLevel || '',
    }
  }).filter(r => (!q || r.studentName.toLowerCase().includes(q)) && (levelFilter === 'all' || r.level === levelFilter)),
  [rawAudit, studentMap, q, levelFilter])

  // ── Stats ──
  const requestsWaiting = allReferrals.filter(r => r.status === 'requested').length
  const openReferrals   = allReferrals.filter(r => r.status === 'open' || r.status === 'in_progress').length
  const dueCount        = allReferrals.filter(r => r.due).length
  const openIncidents   = allIncidents.filter(r => r.status === 'open').length
  const stats = [
    ...(access.canEdit ? [{ label: 'Requests to review', value: requestsWaiting, tone: 'text-[var(--color-warning-text)]' }] : []),
    { label: 'Open referrals', value: openReferrals, tone: 'text-[var(--color-info-text)]' },
    { label: 'Follow-ups due', value: dueCount, tone: 'text-[var(--color-warning-text)]' },
    { label: 'Open incidents', value: openIncidents, tone: 'text-[var(--color-info-text)]' },
  ]

  // ── Actions ──
  const report = (res, okMessage) => {
    if (res.ok) addToast(okMessage, 'success')
    else addToast(res.message || 'Something went wrong.', 'error')
    setTick(t => t + 1)
    return res
  }

  const handleStatus = (kind, row, move) => {
    report(setGuidanceStatus(user, kind, row.id, move.to, campusKey), move.done)
  }
  const handleSubmit = (form) => {
    const { kind, record } = modal
    const res = record
      ? updateGuidanceRecord(user, kind, record.id, form, campusKey)
      : createGuidanceRecord(user, kind, { ...form, schoolYear: currentSchoolYear }, campusKey)
    if (res.ok) {
      addToast(record ? 'Changes saved.' : `${KIND_NOUN[kind][0].toUpperCase()}${KIND_NOUN[kind].slice(1)} added.`, 'success')
      setModal(null)
      setTick(t => t + 1)
    } else if (!res.errors || Object.keys(res.errors).length === 0) {
      addToast(res.message || 'Something went wrong.', 'error')
    }
    return res
  }
  const handleDelete = () => {
    const { kind, row } = confirm
    report(deleteGuidanceRecord(user, kind, row.id, campusKey), 'Record deleted.')
    setConfirm(null)
  }

  // ── Gates ──
  if (isTechAdmin && !campus) {
    return (
      <div className="page-enter space-y-5">
        <div>
          <h1 className="text-display text-[var(--color-text-primary)]">Guidance</h1>
          <p className="text-body text-[var(--color-text-muted)] mt-1">{currentSchoolYear}</p>
        </div>
        <div className="max-w-xl card p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
              <School className="w-5 h-5 text-[var(--color-primary-readable)]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Select a campus first</h2>
              <p className="text-sm text-[var(--color-text-muted)] mt-1">
                Guidance records belong to one campus. Choose the campus you want to look at from the Campus menu at the top of the page.
              </p>
            </div>
          </div>
        </div>
        <ToastContainer toasts={toasts} removeToast={removeToast} />
      </div>
    )
  }
  if (!campus) {
    return (
      <div className="page-enter space-y-5">
        <h1 className="text-display text-[var(--color-text-primary)]">Guidance</h1>
        <div className="flex items-start gap-3 px-4 py-3.5 bg-[var(--color-warning-light)] border border-[var(--color-warning-border)] rounded-xl">
          <AlertCircle className="w-5 h-5 text-[var(--color-warning-text)] shrink-0 mt-0.5" />
          <p className="text-sm text-[var(--color-warning-text)]">
            Your account is not linked to an active campus. Ask your Technical Administrator to check your campus in Settings → Users.
          </p>
        </div>
        <ToastContainer toasts={toasts} removeToast={removeToast} />
      </div>
    )
  }

  // ── Tabs and filters ──
  const tabs = [
    { id: 'referral', label: 'Referrals', count: allReferrals.length },
    { id: 'incident', label: 'Incidents', count: allIncidents.length },
    { id: 'testing',  label: 'Testing',   count: allTesting.length },
    ...(canSeeActivity ? [{ id: 'activity', label: 'Activity', count: null }] : []),
  ]
  const shownTab = tabs.some(t => t.id === tab) ? tab : 'referral'
  const statusOptions =
    shownTab === 'referral' ? toOptions(GUIDANCE_REFERRAL_STATUSES)
    : shownTab === 'incident' ? toOptions(GUIDANCE_INCIDENT_STATUSES)
    : []
  const hasFilters = q !== '' || levelFilter !== 'all' || statusFilter !== 'all' || dueOnly
  const clearFilters = () => { setSearch(''); setLevelFilter('all'); setStatusFilter('all'); setDueOnly(false) }
  const resetOn = [q, levelFilter, statusFilter, dueOnly, schoolYear, campusKey]
  const noun = KIND_NOUN[shownTab] || 'entry'

  const emptyBox = (title, text) => (
    <div className="card p-12 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[var(--color-bg-subtle)] flex items-center justify-center mx-auto mb-4">
        <HeartHandshake size={28} className="text-[var(--color-text-muted)] opacity-50" />
      </div>
      <p className="text-subheading text-[var(--color-text-primary)]">{title}</p>
      <p className="text-small text-[var(--color-text-muted)] mt-1">{text}</p>
      {hasFilters && <button type="button" onClick={clearFilters} className="btn btn-ghost text-xs mt-4">Clear search and filters</button>}
    </div>
  )
  const emptyFor = (what) => emptyBox(
    hasFilters ? `No ${what} match` : `No ${what} yet`,
    hasFilters ? 'Nothing matches the search or filters.' : (canAct ? 'Use the Add button to record the first one.' : 'Nothing has been recorded for this school year.')
  )

  const actions = (kind) => (r) => (
    <RowActions kind={kind} row={r} canAct={canAct} onStatus={handleStatus}
      onEdit={(k, row) => setModal({ kind: k, record: row.raw })}
      onDelete={(k, row) => setConfirm({ kind: k, row })} />
  )
  const referralActions = actions('referral')
  const incidentActions = actions('incident')
  const testingActions  = actions('testing')

  const referralColumns = [
    { key: 'student', label: 'Student', sortKey: 'student', cell: r => <StudentCell row={r} /> },
    { key: 'date', label: 'Date', sortKey: 'date', cell: r => <span className="text-[var(--color-text-secondary)]">{fmtDate(r.date)}</span> },
    { key: 'source', label: 'Referred by', cell: r => r.sourceLabel },
    { key: 'reason', label: 'Reason', sortKey: 'reason', cell: r => <span className="block">{r.reasonLabel}{r.caseNo && <span className="block mt-0.5 font-mono text-xs text-[var(--color-text-muted)]">{r.caseNo}</span>}</span> },
    { key: 'followUp', label: 'Follow-up', sortKey: 'followUp', cell: r => (
      <span className="block">{fmtDate(r.followUp)}{r.due && <span className="block mt-1"><DueBadge /></span>}</span>
    ) },
    { key: 'status', label: 'Status', sortKey: 'status', cell: r => <StatusPill status={r.status} label={r.statusLabel} /> },
    ...(canAct ? [{ key: 'actions', label: '', cell: referralActions }] : []),
  ]
  const incidentColumns = [
    { key: 'student', label: 'Student', sortKey: 'student', cell: r => <StudentCell row={r} /> },
    { key: 'date', label: 'Date', sortKey: 'date', cell: r => <span className="text-[var(--color-text-secondary)]">{fmtDate(r.date)}</span> },
    { key: 'category', label: 'Category', sortKey: 'category', cell: r => <span className="block">{r.categoryLabel}{r.caseNo && <span className="block mt-0.5 font-mono text-xs text-[var(--color-text-muted)]">{r.caseNo}</span>}</span> },
    { key: 'sanction', label: 'Sanction', sortKey: 'sanction', cell: r => r.sanctionLabel },
    { key: 'status', label: 'Status', sortKey: 'status', cell: r => <StatusPill status={r.status} label={r.statusLabel} /> },
    ...(canAct ? [{ key: 'actions', label: '', cell: incidentActions }] : []),
  ]
  const testingColumns = [
    { key: 'student', label: 'Student', sortKey: 'student', cell: r => <StudentCell row={r} /> },
    { key: 'date', label: 'Date', sortKey: 'date', cell: r => <span className="text-[var(--color-text-secondary)]">{fmtDate(r.date)}</span> },
    { key: 'test', label: 'Test', sortKey: 'test', cell: r => r.testLabel },
    { key: 'result', label: 'Result', cell: r => <span className="font-semibold">{r.result}</span> },
    ...(canAct ? [{ key: 'actions', label: '', cell: testingActions }] : []),
  ]
  const activityColumns = [
    { key: 'when', label: 'When', sortKey: 'when', cell: r => <span className="text-[var(--color-text-secondary)] whitespace-nowrap">{fmtDateTime(r.at)}</span> },
    { key: 'who', label: 'Who', sortKey: 'who', cell: r => r.byName },
    { key: 'action', label: 'Action', sortKey: 'action', cell: r => r.actionLabel },
    { key: 'kind', label: 'Record', cell: r => <span className="capitalize">{r.kindLabel}</span> },
    { key: 'student', label: 'Student', sortKey: 'student', cell: r => <StudentCell row={r} /> },
  ]

  const cardTop = (r, extra) => (
    <div className="flex items-start justify-between gap-3">
      <StudentCell row={r} />
      {extra}
    </div>
  )

  return (
    <div className="page-enter space-y-5">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-display text-[var(--color-text-primary)]">Guidance</h1>
          <p className="text-body text-[var(--color-text-muted)] mt-1 flex flex-wrap items-center gap-2">
            <span>{schoolYear} · {campusName}</span>
            {!access.canEdit && <Pill><Eye size={11} aria-hidden="true" /> View only</Pill>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start">
          {yearOptions.length > 1 && (
            <GroupedSelect className="w-36" value={schoolYear} onChange={v => setSchoolYear(v === 'all' ? currentSchoolYear : v)} allLabel="School year" options={yearOptions} />
          )}
          {access.canEdit && shownTab !== 'activity' && (
            <button type="button" onClick={() => setModal({ kind: shownTab, record: null })} disabled={!isCurrentYear}
              title={isCurrentYear ? undefined : 'Records can only be added in the current school year'}
              className="btn btn-primary gap-1.5 text-sm shrink-0">
              <Plus size={15} /> Add {KIND_NOUN[shownTab]}
            </button>
          )}
        </div>
      </div>

      {/* ── Privacy note ─────────────────────────────────────────────── */}
      <div className="flex items-start gap-2.5 p-4 rounded-xl bg-[var(--color-info-light)] border border-[var(--color-info-border)]">
        <Info size={15} className="text-[var(--color-info-text)] shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-sm text-[var(--color-text-secondary)]">
          Guidance records hold no counseling notes. Use the case number to find the school's own file.
          {access.canEdit && !isCurrentYear && ' Earlier school years are read only.'}
          {!access.canEdit && ' You can read these records but not change them.'}
        </p>
      </div>

      {/* ── Stats ────────────────────────────────────────────────────── */}
      <div className={`grid grid-cols-2 ${stats.length === 4 ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-3`}>
        {stats.map(s => (
          <div key={s.label} className="stat-card text-center py-4">
            <p className={`text-2xl font-bold ${s.tone}`}>{s.value}</p>
            <p className="text-caption text-[var(--color-text-muted)] mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────── */}
      <div className="flex gap-2 border-b border-[var(--color-border)] overflow-x-auto" role="tablist">
        {tabs.map(t => (
          <button key={t.id} type="button" role="tab" aria-selected={shownTab === t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px whitespace-nowrap ${
              shownTab === t.id
                ? 'border-[var(--color-primary-readable)] text-[var(--color-primary-readable)]'
                : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}>
            {t.label}{t.count != null && <span className="text-xs opacity-70">({t.count})</span>}
          </button>
        ))}
      </div>

      {/* ── Filters ──────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row gap-3 md:items-center">
        <div className="flex-1 flex items-center gap-2 border border-[var(--color-border)] rounded-[var(--radius-md)] bg-[var(--color-bg-card)] px-3 focus-within:ring-2 focus-within:ring-[var(--color-border-focus)] transition-shadow">
          <Search size={14} className="text-[var(--color-text-muted)] shrink-0" aria-hidden="true" />
          <input
            className="flex-1 min-w-0 py-[0.5625rem] text-sm bg-transparent outline-none text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
            placeholder="Search student name or number…" value={search} onChange={e => setSearch(e.target.value)} aria-label="Search records" />
        </div>
        {access.levels.length > 1 && (
          <GroupedSelect className="md:w-48" value={levelFilter} onChange={setLevelFilter} allLabel="All departments"
            options={access.levels.map(l => ({ value: l, label: levelLabel(l) }))} />
        )}
        {statusOptions.length > 0 && (
          <GroupedSelect className="md:w-44" value={statusFilter} onChange={setStatusFilter} allLabel="Any status" options={statusOptions} />
        )}
        {shownTab === 'referral' && (
          <button type="button" onClick={() => setDueOnly(v => !v)} aria-pressed={dueOnly}
            className={`btn text-xs py-2 px-4 shrink-0 whitespace-nowrap gap-1.5 ${dueOnly ? 'btn-primary' : 'btn-ghost'}`}>
            <Clock size={13} aria-hidden="true" /> Follow-ups due ({dueCount})
          </button>
        )}
      </div>

      {/* ── Lists ────────────────────────────────────────────────────── */}
      {shownTab === 'referral' && (
        <RecordList rows={referrals} columns={referralColumns} sorters={REFERRAL_SORTERS}
          defaultSort={{ key: 'date', dir: 'desc' }} descFirst={['date']} resetOn={resetOn} noun="referral"
          empty={emptyFor('referrals')}
          mobileCard={r => (
            <div className="space-y-3">
              {cardTop(r, <StatusPill status={r.status} label={r.statusLabel} />)}
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                <Fact label="Date">{fmtDate(r.date)}</Fact>
                <Fact label="Referred by">{r.sourceLabel}</Fact>
                <Fact label="Reason">{r.reasonLabel}</Fact>
                <Fact label="Follow-up">{r.followUp ? fmtDate(r.followUp) : ''}</Fact>
                <Fact label="Case no.">{r.caseNo && <span className="font-mono text-xs">{r.caseNo}</span>}</Fact>
              </dl>
              {r.due && <DueBadge />}
              {referralActions(r)}
            </div>
          )} />
      )}
      {shownTab === 'incident' && (
        <RecordList rows={incidents} columns={incidentColumns} sorters={INCIDENT_SORTERS}
          defaultSort={{ key: 'date', dir: 'desc' }} descFirst={['date']} resetOn={resetOn} noun="incident"
          empty={emptyFor('incidents')}
          mobileCard={r => (
            <div className="space-y-3">
              {cardTop(r, <StatusPill status={r.status} label={r.statusLabel} />)}
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                <Fact label="Date">{fmtDate(r.date)}</Fact>
                <Fact label="Category">{r.categoryLabel}</Fact>
                <Fact label="Sanction">{r.sanctionLabel}</Fact>
                <Fact label="Case no.">{r.caseNo && <span className="font-mono text-xs">{r.caseNo}</span>}</Fact>
              </dl>
              {incidentActions(r)}
            </div>
          )} />
      )}
      {shownTab === 'testing' && (
        <RecordList rows={testing} columns={testingColumns} sorters={TESTING_SORTERS}
          defaultSort={{ key: 'date', dir: 'desc' }} descFirst={['date']} resetOn={resetOn} noun="test result"
          empty={emptyFor('test results')}
          mobileCard={r => (
            <div className="space-y-3">
              {cardTop(r, <span className="text-sm font-bold text-[var(--color-text-primary)]">{r.result}</span>)}
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                <Fact label="Date">{fmtDate(r.date)}</Fact>
                <Fact label="Test">{r.testLabel}</Fact>
              </dl>
              {testingActions(r)}
            </div>
          )} />
      )}
      {shownTab === 'activity' && (
        <RecordList rows={activity} columns={activityColumns} sorters={ACTIVITY_SORTERS}
          defaultSort={{ key: 'when', dir: 'desc' }} descFirst={['when']} resetOn={resetOn} noun="entry"
          empty={emptyBox('No activity yet', 'Every add, edit, status change and delete is listed here. It never shows record details.')}
          mobileCard={r => (
            <div className="space-y-2">
              {cardTop(r, <span className="text-xs font-semibold text-[var(--color-text-secondary)]">{r.actionLabel}</span>)}
              <p className="text-xs text-[var(--color-text-muted)]">
                <span className="capitalize">{r.kindLabel}</span> · {r.byName} · {fmtDateTime(r.at)}
              </p>
            </div>
          )} />
      )}

      {/* ── Modals ───────────────────────────────────────────────────── */}
      {modal && (
        <RecordModal kind={modal.kind} record={modal.record} students={pickerStudents}
          onSubmit={handleSubmit} onClose={() => setModal(null)} />
      )}
      <ConfirmDialog
        open={!!confirm}
        title="Delete this record?"
        message={confirm?.kind === 'testing'
          ? 'This test result will be removed. The deletion is noted in Activity.'
          : 'Delete only a record entered by mistake. To end a case, close it instead. The deletion is noted in Activity.'}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirm(null)}
      />
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TEACHER VIEW — send a referral, follow its status, nothing else
// ─────────────────────────────────────────────────────────────────────────────

function ReferralRequestModal({ students, onSubmit, onClose }) {
  const [form, setForm] = useState({ studentId: '', date: todayYMD(), reason: '' })
  const [errors, setErrors] = useState({})
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: undefined })) }
  const submit = () => {
    const res = onSubmit(form)
    if (res && res.ok === false) setErrors(res.errors || {})
  }
  return (
    <ModalPortal onClose={onClose}>
      <div className="modal-backdrop">
        <div className="modal-panel">
          <div className="modal-header">
            <h3 className="text-base font-bold text-[var(--color-text-primary)]">Refer a student to Guidance</h3>
            <button type="button" onClick={onClose} className="icon-btn icon-btn-ghost" aria-label="Close"><X className="w-5 h-5" /></button>
          </div>
          <div className="p-5 space-y-4 overflow-y-auto">
            <div>
              <label className="form-label">Student <span className="text-[var(--color-error-text)]">*</span></label>
              <StudentPicker students={students} value={form.studentId} onChange={v => set('studentId', v)} error={errors.studentId} />
            </div>
            <div>
              <label className="form-label">Date <span className="text-[var(--color-error-text)]">*</span></label>
              <DatePicker value={form.date} onChange={v => set('date', v)} placeholder="Select date" />
              <FieldError>{errors.date}</FieldError>
            </div>
            <SelectField label="Reason" value={form.reason} onChange={v => set('reason', v)} options={toOptions(GUIDANCE_REFERRAL_REASONS)} placeholder="Choose a reason…" error={errors.reason} />
            <p className="text-xs text-[var(--color-text-muted)]">
              Choose a reason only. Do not write details here. Guidance will contact you through the school's usual channels.
            </p>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-cancel">Cancel</button>
            <button type="button" onClick={submit} className="btn-submit gap-1.5"><Send size={14} aria-hidden="true" /> Send referral</button>
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}

function TeacherReferrals({ user }) {
  const { currentSchoolYear, activeCampuses } = useAppConfig()
  const { toasts, addToast, removeToast } = useToast()
  const [tick, setTick] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const [withdrawing, setWithdrawing] = useState(null)

  const campus = activeCampuses.find(c => c.key === user.campusKey)

  useEffect(() => {
    const refresh = () => setTick(t => t + 1)
    const onStorage = (e) => { if (e.key === null || e.key === 'almirene_guidance_records' || e.key === 'almirene_students') refresh() }
    window.addEventListener('almirene_guidance_updated', refresh)
    window.addEventListener('almirene_students_updated', refresh)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('almirene_guidance_updated', refresh)
      window.removeEventListener('almirene_students_updated', refresh)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const students = useMemo(() => getReferralStudents(user, { schoolYear: currentSchoolYear }), // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, currentSchoolYear, tick])
  const requests = useMemo(() => getMyReferralRequests(user, { schoolYear: currentSchoolYear }), // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, currentSchoolYear, tick])

  const handleSend = (form) => {
    const res = createReferralRequest(user, { ...form, schoolYear: currentSchoolYear })
    if (res.ok) { addToast('Referral sent to Guidance.', 'success'); setShowModal(false); setTick(t => t + 1) }
    else if (!res.errors || Object.keys(res.errors).length === 0) addToast(res.message || 'Something went wrong.', 'error')
    return res
  }
  const handleWithdraw = () => {
    const res = withdrawReferralRequest(user, withdrawing.id)
    addToast(res.ok ? 'Referral withdrawn.' : res.message, res.ok ? 'success' : 'error')
    setWithdrawing(null)
    setTick(t => t + 1)
  }

  const columns = [
    { key: 'student', label: 'Student', sortKey: 'student', cell: r => (
      <span className="block">
        <span className="block text-sm font-semibold text-[var(--color-text-primary)]">{r.studentName}</span>
        <span className="block text-xs text-[var(--color-text-muted)]">{r.gradeLevel || '—'}</span>
      </span>
    ) },
    { key: 'date', label: 'Date', sortKey: 'date', cell: r => <span className="text-[var(--color-text-secondary)]">{fmtDate(r.date)}</span> },
    { key: 'reason', label: 'Reason', cell: r => r.reasonLabel },
    { key: 'status', label: 'Status', sortKey: 'status', cell: r => <StatusPill status={r.status} label={r.statusLabel} /> },
    { key: 'actions', label: '', cell: r => r.canWithdraw && (
      <button type="button" onClick={() => setWithdrawing(r)} className="btn btn-ghost text-xs py-1.5 px-3">Withdraw</button>
    ) },
  ]
  const rows = requests.map(r => ({ ...r, student: r.studentName }))
  const sorters = { student: (a, b) => a.studentName.localeCompare(b.studentName), date: byStr('date'), status: byStr('statusLabel') }

  if (!campus) {
    return (
      <div className="page-enter space-y-5">
        <h1 className="text-display text-[var(--color-text-primary)]">Guidance</h1>
        <div className="flex items-start gap-3 px-4 py-3.5 bg-[var(--color-warning-light)] border border-[var(--color-warning-border)] rounded-xl">
          <AlertCircle className="w-5 h-5 text-[var(--color-warning-text)] shrink-0 mt-0.5" />
          <p className="text-sm text-[var(--color-warning-text)]">Your account is not linked to an active campus. Ask your Technical Administrator to check your campus in Settings → Users.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-enter space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-display text-[var(--color-text-primary)]">Guidance</h1>
          <p className="text-body text-[var(--color-text-muted)] mt-1">{currentSchoolYear} · {campus.name}</p>
        </div>
        <button type="button" onClick={() => setShowModal(true)} className="btn btn-primary gap-1.5 text-sm shrink-0 self-start">
          <Send size={15} aria-hidden="true" /> Refer a student
        </button>
      </div>

      <div className="flex items-start gap-2.5 p-4 rounded-xl bg-[var(--color-info-light)] border border-[var(--color-info-border)]">
        <Info size={15} className="text-[var(--color-info-text)] shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-sm text-[var(--color-text-secondary)]">
          Send a referral when a student may need Guidance. You will see below that it was sent, received or closed.
          You will not see what Guidance records, and no notes are kept in the system.
        </p>
      </div>

      <RecordList rows={rows} columns={columns} sorters={sorters}
        defaultSort={{ key: 'date', dir: 'desc' }} descFirst={['date']} noun="referral"
        empty={(
          <div className="card p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[var(--color-bg-subtle)] flex items-center justify-center mx-auto mb-4">
              <HeartHandshake size={28} className="text-[var(--color-text-muted)] opacity-50" />
            </div>
            <p className="text-subheading text-[var(--color-text-primary)]">No referrals sent yet</p>
            <p className="text-small text-[var(--color-text-muted)] mt-1">Use "Refer a student" when a student needs Guidance.</p>
          </div>
        )}
        mobileCard={r => (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <span className="block">
                <span className="block text-sm font-semibold text-[var(--color-text-primary)]">{r.studentName}</span>
                <span className="block text-xs text-[var(--color-text-muted)]">{r.gradeLevel || '—'}</span>
              </span>
              <StatusPill status={r.status} label={r.statusLabel} />
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
              <Fact label="Date">{fmtDate(r.date)}</Fact>
              <Fact label="Reason">{r.reasonLabel}</Fact>
            </dl>
            {r.canWithdraw && <button type="button" onClick={() => setWithdrawing(r)} className="btn btn-ghost text-xs py-1.5 px-3">Withdraw</button>}
          </div>
        )} />

      {showModal && <ReferralRequestModal students={students} onSubmit={handleSend} onClose={() => setShowModal(false)} />}
      <ConfirmDialog
        open={!!withdrawing}
        title="Withdraw this referral?"
        message="Guidance has not received it yet. It will be removed from their list."
        confirmLabel="Withdraw"
        danger
        onConfirm={handleWithdraw}
        onCancel={() => setWithdrawing(null)}
      />
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function Guidance() {
  const { user } = useAuth()
  const access = useMemo(() => getGuidanceAccess(user), [user])

  if (!user) return <PageSkeleton title="Guidance" />
  if (!access.canView) {
    return (
      <div className="page-enter space-y-5">
        <h1 className="text-display text-[var(--color-text-primary)]">Guidance</h1>
        <div className="flex items-start gap-3 px-4 py-3.5 bg-[var(--color-warning-light)] border border-[var(--color-warning-border)] rounded-xl">
          <AlertCircle className="w-5 h-5 text-[var(--color-warning-text)] shrink-0 mt-0.5" />
          <p className="text-sm text-[var(--color-warning-text)]">You do not have access to Guidance.</p>
        </div>
      </div>
    )
  }
  return access.canRefer
    ? <TeacherReferrals user={user} />
    : <GuidanceWorkspace user={user} access={access} />
}
