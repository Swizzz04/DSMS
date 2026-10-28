/**
 * ClearanceRequirementsEditor.jsx — Settings → Workflow Config → Clearance
 * Location: src/components/settings/ClearanceRequirementsEditor.jsx
 *
 * The Technical Admin decides what a student must clear and who signs each item.
 * One list per school department (Basic Education / College), saved separately.
 *
 * Flow
 *   edit the list  →  Save  →  validate  →  dry-run against real students
 *   →  warn if any student would end up with ZERO required sign-offs
 *   →  saveClearanceRequirements  →  syncAllClearances()  →  almirene_clearance_config_updated
 *
 * Rules enforced (ALMIRENE DX)
 *  - NO native <select>: GroupedSelect everywhere
 *  - NO window.confirm: ConfirmDialog
 *  - Modals through ModalPortal
 *  - Every option list comes from appConfig.js
 *  - Colors only through CSS variables, no gradients
 *  - Mobile-first: one column on phones, list + preview side by side from lg
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  Plus, Trash2, Pencil, ArrowUp, ArrowDown, Save, RotateCcw, X, Info,
  AlertCircle, Check, ShieldCheck, Shield, BookOpen, CreditCard, Building2,
  Users, GraduationCap, UserCheck, Presentation, Undo2, ArrowLeft, ArrowRight,
} from 'lucide-react'
import GroupedSelect from '../GroupedSelect'
import { ConfirmDialog, ModalPortal, useToast, ToastContainer } from '../UIComponents'
import { useAuth } from '../../context/AuthContext'
import { useAppConfig } from '../../context/AppConfigContext'
import {
  CLEARANCE_SIGNER_TYPES,
  CLEARANCE_ORDER_OPTIONS,
  CLEARANCE_DEPARTMENT_SCOPES,
  CLEARANCE_TEACHER_SIGNER_TYPES,
  CLEARANCE_SIGNABLE_ROLES,
  CLEARANCE_ICON_OPTIONS,
  ROLE_DEFINITIONS,
} from '../../config/appConfig'
import { DEFAULT_BASIC_ED_SUBJECTS, DEFAULT_COLLEGE_SUBJECTS } from '../../config/defaultSubjects'
import {
  getClearanceRequirements,
  hasCustomClearanceRequirements,
  saveClearanceRequirements,
  resetClearanceRequirements,
  validateRequirements,
  normalizeRequirement,
  makeRequirementId,
  analyzeClearanceCoverage,
  readStudentsForClearance,
  getClearanceReasons,
  hasCustomClearanceReasons,
  saveClearanceReasons,
  resetClearanceReasons,
  validateReasons,
  normalizeReason,
} from '../../utils/clearanceConfigBridge'
import { syncAllClearances } from '../../utils/documentBridge'

const CONFIG_EVENT = 'almirene_clearance_config_updated'
const OTHER_SUBJECT = '__other__'

const INPUT_CLS = 'w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition'
const CHECK_CLS = 'w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-primary-readable)] focus:ring-primary'

// Keep in step with the icon map in pages/Clearance.jsx (ids come from CLEARANCE_ICON_OPTIONS)
const ICONS = {
  library: BookOpen, accounting: CreditCard, registrar: ShieldCheck, guidance: Users,
  admin: Building2, instructors: GraduationCap, adviser: UserCheck,
}
const SIGNER_ICONS = {
  student_instructors: GraduationCap, subject_teacher: Presentation, section_adviser: UserCheck,
}
const iconFor = (req) => ICONS[req?.icon] || ICONS[req?.id] || SIGNER_ICONS[req?.signer?.type] || Shield

// ─────────────────────────────────────────────────────────────────────────────
// SMALL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const clone = (v) => JSON.parse(JSON.stringify(v))
const same  = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const scopeLabel = (id) => CLEARANCE_DEPARTMENT_SCOPES.find(s => s.id === id)?.label || id
const roleLabel  = (r) => ROLE_DEFINITIONS[r]?.label || r
const plural = (n, one, many) => `${n} ${n === 1 ? one : (many || `${one}s`)}`

/** One department's editable setup: its standard requirements, and its reasons (a reason may carry its own list). */
const loadScope = (scope, campusKey) => ({
  requirements: clone(getClearanceRequirements(scope, undefined, campusKey)),
  reasons:      clone(getClearanceReasons(scope, campusKey)),
})
const loadAll = (campusKey) => Object.fromEntries(CLEARANCE_DEPARTMENT_SCOPES.map(s => [s.id, loadScope(s.id, campusKey)]))

/** Every distinct subject name for one department, for the "Teacher of a named subject" picker. */
function subjectNamesFor(scope) {
  const out = new Set()
  const walk = (node) => {
    if (Array.isArray(node)) node.forEach(n => { if (typeof n === 'string') out.add(n) })
    else if (node && typeof node === 'object') Object.values(node).forEach(walk)
  }
  walk(scope === 'college' ? DEFAULT_COLLEGE_SUBJECTS : DEFAULT_BASIC_ED_SUBJECTS)
  return [...out].sort((a, b) => a.localeCompare(b))
}

/** One-line description of who signs a requirement. */
function signerSummary(req, userName) {
  const s = req.signer || {}
  switch (s.type) {
    case 'role': {
      const names = (s.roles || []).map(roleLabel)
      return names.length ? names.join(', ') : 'No role chosen yet'
    }
    case 'user': {
      const names = (s.userIds || []).map(id => userName(id))
      return names.length ? names.join(', ') : 'No account chosen yet'
    }
    case 'student_instructors': return "Each of the student's subject instructors, one signature per subject"
    case 'subject_teacher':     return s.subject ? `The student's ${s.subject} teacher` : 'No subject chosen yet'
    case 'section_adviser':     return "The student's section adviser"
    default:                    return ''
  }
}

function Chip({ children, tone = 'neutral' }) {
  const toneCls = {
    neutral: 'bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)] border-[var(--color-border)]',
    info:    'bg-[var(--color-info-light)] text-[var(--color-info-text)] border-[var(--color-info-border)]',
    warn:    'bg-[var(--color-warning-light)] text-[var(--color-warning-text)] border-[var(--color-warning-border)]',
  }[tone]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${toneCls}`}>
      {children}
    </span>
  )
}

function CheckRow({ checked, onChange, label, hint, disabled = false }) {
  return (
    <label className={`flex items-start gap-3 px-3 py-2.5 rounded-xl border text-sm transition-colors
      ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      ${checked && !disabled ? 'border-[var(--color-primary-readable)] bg-[var(--color-bg-subtle)]' : 'border-[var(--color-border)]'}`}>
      <input type="checkbox" className={`${CHECK_CLS} mt-0.5`} checked={checked} disabled={disabled}
        onChange={e => onChange(e.target.checked)} />
      <span className="min-w-0">
        <span className="block text-[var(--color-text-primary)] font-medium">{label}</span>
        {hint && <span className="block text-xs text-[var(--color-text-muted)] mt-0.5">{hint}</span>}
      </span>
    </label>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// EDIT / ADD MODAL
// ─────────────────────────────────────────────────────────────────────────────

function RequirementModal({ initial, isNew, scope, existingIds, users, onSave, onClose }) {
  const subjectNames = useMemo(() => subjectNamesFor(scope), [scope])

  const [label,   setLabel]   = useState(initial.label || '')
  const [icon,    setIcon]    = useState(initial.icon || 'default')
  const [type,    setType]    = useState(initial.signer?.type || 'role')
  const [roles,   setRoles]   = useState(initial.signer?.roles || [])
  const [userIds, setUserIds] = useState((initial.signer?.userIds || []).map(String))
  const [subject, setSubject] = useState(initial.signer?.subject || '')
  const [subjectChoice, setSubjectChoice] = useState(() => {
    const s = initial.signer?.subject || ''
    if (!s) return 'all'
    return subjectNames.includes(s) ? s : OTHER_SUBJECT
  })
  const [order,    setOrder]    = useState(initial.order || 'any')
  const [required, setRequired] = useState(initial.required !== false)
  const [auto,     setAuto]     = useState(!!initial.autoFromPayment)
  const [error,    setError]    = useState('')

  const typeInfo   = CLEARANCE_SIGNER_TYPES.find(t => t.id === type)
  const fixedType  = type === 'role' || type === 'user'
  const typeGroups = useMemo(() => ([
    { label: 'Fixed signers',     options: CLEARANCE_SIGNER_TYPES.filter(t => !CLEARANCE_TEACHER_SIGNER_TYPES.includes(t.id)).map(t => ({ value: t.id, label: t.label })) },
    { label: 'From Subject Load', options: CLEARANCE_SIGNER_TYPES.filter(t =>  CLEARANCE_TEACHER_SIGNER_TYPES.includes(t.id)).map(t => ({ value: t.id, label: t.label })) },
  ].filter(g => g.options.length)), [])

  const subjectGroups = useMemo(() => ([
    { label: scopeLabel(scope), options: subjectNames.map(n => ({ value: n, label: n })) },
    { label: 'Not in the list',  options: [{ value: OTHER_SUBJECT, label: 'Other (type a keyword)…' }] },
  ]), [scope, subjectNames])

  const toggle = (list, setList, v) => setList(list.includes(v) ? list.filter(x => x !== v) : [...list, v])

  const submit = () => {
    const name = label.trim()
    if (!name) return setError('Give the requirement a name, e.g. Library.')
    if (type === 'role' && !roles.length) return setError('Choose at least one role that signs it.')
    if (type === 'user' && !userIds.length) return setError('Choose at least one account that signs it.')
    if (type === 'subject_teacher' && !subject.trim()) return setError('Choose the subject whose teacher signs it, or type a keyword.')

    const id = initial.id || makeRequirementId(name, existingIds)
    onSave(normalizeRequirement({
      id, label: name, icon,
      signer: type === 'role' ? { type, roles }
            : type === 'user' ? { type, userIds }
            : type === 'subject_teacher' ? { type, subject: subject.trim() }
            : { type },
      order, required,
      autoFromPayment: fixedType ? auto : false,
    }))
  }

  return (
    <ModalPortal onClose={onClose}>
      <div className="modal-backdrop">
        <div className="modal-panel" style={{ maxWidth: '36rem' }}>
          <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)] shrink-0">
            <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
              {isNew ? 'Add requirement' : 'Edit requirement'} · {scopeLabel(scope)}
            </h3>
            <button type="button" aria-label="Close" onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-[var(--color-bg-subtle)] transition">
              <X className="w-4 h-4 text-[var(--color-text-muted)]" />
            </button>
          </div>

          <div className="p-4 space-y-4 overflow-y-auto">
            {error && (
              <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-[var(--color-error-light)] text-xs text-[var(--color-error-text)]">
                <AlertCircle size={13} className="shrink-0 mt-0.5" /> {error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="form-label">Name <span className="text-[var(--color-error)]">*</span></label>
                <input className={INPUT_CLS} value={label} onChange={e => setLabel(e.target.value)}
                  placeholder="e.g. Library" maxLength={40} autoFocus />
              </div>
              <div>
                <label className="form-label">Icon</label>
                <GroupedSelect
                  value={icon === 'default' ? 'all' : icon}
                  onChange={v => setIcon(v === 'all' ? 'default' : v)}
                  allLabel="Shield (general)"
                  options={CLEARANCE_ICON_OPTIONS.filter(o => o.id !== 'default').map(o => ({ value: o.id, label: o.label }))}
                />
              </div>
            </div>

            <div>
              <label className="form-label">Who signs it</label>
              <GroupedSelect
                value={type}
                onChange={v => { if (v !== 'all') { setType(v); if (!(v === 'role' || v === 'user')) setAuto(false) } }}
                allLabel="Choose who signs…"
                groups={typeGroups}
              />
              {typeInfo?.hint && <p className="text-xs text-[var(--color-text-muted)] mt-1">{typeInfo.hint}</p>}
            </div>

            {type === 'role' && (
              <div>
                <label className="form-label">Roles that can sign</label>
                <div className="flex flex-wrap gap-1.5">
                  {CLEARANCE_SIGNABLE_ROLES.map(r => {
                    const on = roles.includes(r)
                    return (
                      <button key={r} type="button" onClick={() => toggle(roles, setRoles, r)}
                        className={`px-2.5 py-1 rounded-lg text-xs border transition-colors
                          ${on ? 'is-selected' : 'bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-primary-readable)]'}`}>
                        {roleLabel(r)}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {type === 'user' && (
              <div>
                <label className="form-label">Accounts that can sign</label>
                <div className="max-h-52 overflow-y-auto rounded-xl border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
                  {users.length === 0 && (
                    <p className="px-3 py-4 text-sm text-[var(--color-text-muted)] text-center">No accounts yet. Add users in Settings → Users.</p>
                  )}
                  {users.map(u => {
                    const on = userIds.includes(String(u.id))
                    return (
                      <label key={u.id} className={`flex items-center gap-3 px-3 py-2 text-sm cursor-pointer ${on ? 'bg-[var(--color-bg-subtle)]' : ''}`}>
                        <input type="checkbox" className={CHECK_CLS} checked={on}
                          onChange={() => toggle(userIds, setUserIds, String(u.id))} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[var(--color-text-primary)] truncate">{u.name}</span>
                          <span className="block text-[11px] text-[var(--color-text-muted)] truncate">
                            {roleLabel(u.role)}{u.campus ? ` · ${u.campus}` : ''}
                          </span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )}

            {type === 'subject_teacher' && (
              <div className="space-y-2">
                <label className="form-label">Subject</label>
                <GroupedSelect
                  value={subjectChoice}
                  allLabel="Choose a subject…"
                  groups={subjectGroups}
                  onChange={v => {
                    setSubjectChoice(v)
                    if (v === 'all') setSubject('')
                    else if (v === OTHER_SUBJECT) setSubject('')
                    else setSubject(v)
                  }}
                />
                {subjectChoice === OTHER_SUBJECT && (
                  <input className={INPUT_CLS} value={subject} onChange={e => setSubject(e.target.value)}
                    placeholder="e.g. Math" maxLength={60} />
                )}
                <p className="text-xs text-[var(--color-text-muted)]">
                  Matches any of the student's subjects whose name contains this text, so "Math" also finds "Core Mathematics".
                </p>
              </div>
            )}

            <div>
              <label className="form-label">When it opens</label>
              <GroupedSelect
                value={order}
                onChange={v => { if (v !== 'all') setOrder(v) }}
                allLabel="Choose when it opens…"
                options={CLEARANCE_ORDER_OPTIONS.map(o => ({ value: o.id, label: o.label }))}
              />
            </div>

            <div className="space-y-2">
              <CheckRow checked={required} onChange={setRequired} label="Required"
                hint="Turn off to show it and let it be signed without holding the clearance back." />
              <CheckRow checked={auto} onChange={setAuto} disabled={!fixedType}
                label="Clear automatically when the balance is zero"
                hint={fixedType ? 'For Accounting-style checks. The signer can still add a note when a balance is owing.' : 'Only available for a role or account signer.'} />
            </div>
          </div>

          <div className="flex gap-2 p-4 border-t border-[var(--color-border)] shrink-0">
            <button type="button" onClick={onClose} className="btn-cancel">Cancel</button>
            <button type="button" onClick={submit} data-modal-primary className="btn-action">
              {isNew ? 'Add requirement' : 'Done'}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PREVIEW — what real students would get from the draft
// ─────────────────────────────────────────────────────────────────────────────

function CoveragePanel({ coverage, scope, listName }) {
  if (!coverage) return null
  const sizes = Object.keys(coverage.counts).map(Number).sort((a, b) => a - b)

  return (
    <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] space-y-3">
      <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide flex items-center gap-1">
        <Users size={11} /> What students would get
      </p>
      {listName && <p className="text-xs font-semibold text-[var(--color-text-primary)] -mt-1.5">{listName}</p>}

      {coverage.total === 0 ? (
        <p className="text-xs text-[var(--color-text-muted)]">
          No {scopeLabel(scope)} students on file yet, so there is nothing to check this list against.
        </p>
      ) : (
        <>
          <p className="text-xs text-[var(--color-text-muted)]">
            Checked against {plural(coverage.total, 'student')} in {scopeLabel(scope)}.
          </p>
          <ul className="space-y-1.5">
            {sizes.map(n => (
              <li key={n}
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs border
                  ${n === 0
                    ? 'bg-[var(--color-error-light)] text-[var(--color-error-text)] border-[var(--color-error)]'
                    : 'bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)] border-[var(--color-border)]'}`}>
                <span className="font-semibold">{plural(n, 'required sign-off')}</span>
                <span>{plural(coverage.counts[n], 'student')}</span>
              </li>
            ))}
          </ul>

          {coverage.zeroCount > 0 && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-[var(--color-warning-light)] border border-[var(--color-warning-border)] text-xs text-[var(--color-warning-text)]">
              <AlertCircle size={13} className="shrink-0 mt-0.5" />
              <span>
                {plural(coverage.zeroCount, 'student')} would have nothing to sign, so their clearance could never be completed.
                {` For example: ${coverage.zero.slice(0, 3).map(z => z.name).join('; ')}.`}
              </span>
            </div>
          )}
        </>
      )}

      {coverage.issues.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-1.5">Subject Load gaps</p>
          <ul className="space-y-1">
            {coverage.issues.slice(0, 5).map(i => (
              <li key={`${i.requirementId}|${i.code}`} className="text-xs text-[var(--color-text-secondary)]">
                {i.message} <span className="text-[var(--color-text-muted)]">({plural(i.count, 'student')})</span>
              </li>
            ))}
            {coverage.issues.length > 5 && (
              <li className="text-xs text-[var(--color-text-muted)]">and {coverage.issues.length - 5} more</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// REASON MODAL — add / rename a reason for clearance
// ─────────────────────────────────────────────────────────────────────────────

function ReasonModal({ initial, isNew, existingIds, otherLabels, onSave, onClose }) {
  const [label, setLabel] = useState(initial.label || '')
  const [zero,  setZero]  = useState(!!initial.requiresZeroBalance)
  const [error, setError] = useState('')

  const submit = () => {
    const name = label.trim()
    if (!name) return setError('Give the reason a name, e.g. Graduation Clearance.')
    if (otherLabels.includes(name.toLowerCase())) return setError(`There is already a reason called "${name}".`)
    // Keeps its own requirements list (if it has one); a new reason starts on the standard list
    onSave(normalizeReason({
      ...initial,
      id: initial.id || makeRequirementId(name, existingIds),
      label: name,
      requiresZeroBalance: zero,
    }))
  }

  return (
    <ModalPortal onClose={onClose}>
      <div className="modal-backdrop">
        <div className="modal-panel" style={{ maxWidth: '30rem' }}>
          <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)] shrink-0">
            <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
              {isNew ? 'Add reason for clearance' : 'Edit reason'}
            </h3>
            <button type="button" aria-label="Close" onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-[var(--color-bg-subtle)] transition">
              <X className="w-4 h-4 text-[var(--color-text-muted)]" />
            </button>
          </div>

          <div className="p-4 space-y-4 overflow-y-auto">
            {error && (
              <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-[var(--color-error-light)] text-xs text-[var(--color-error-text)]">
                <AlertCircle size={13} className="shrink-0 mt-0.5" /> {error}
              </div>
            )}

            <div>
              <label className="form-label">Name <span className="text-[var(--color-error)]">*</span></label>
              <input className={INPUT_CLS} value={label} onChange={e => setLabel(e.target.value)}
                placeholder="e.g. Transfer / Honorable Dismissal" maxLength={60} autoFocus />
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                The Registrar picks this when starting a clearance, and it shows as the clearance's reason.
              </p>
            </div>

            <CheckRow checked={zero} onChange={setZero} label="Needs a zero balance"
              hint="Accounting cannot sign this clearance while the student owes a balance." />

            {isNew && (
              <p className="text-xs text-[var(--color-text-muted)]">
                A new reason uses the standard requirements. After adding it, press "Customize for this reason" if it needs a different list.
              </p>
            )}
          </div>

          <div className="flex gap-2 p-4 border-t border-[var(--color-border)] shrink-0">
            <button type="button" onClick={onClose} className="btn-cancel">Cancel</button>
            <button type="button" onClick={submit} data-modal-primary className="btn-action">
              {isNew ? 'Add reason' : 'Done'}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function ClearanceRequirementsEditor({ campusKey, campusName }) {
  const { user } = useAuth()
  const { systemUsers } = useAppConfig()
  const { toasts, addToast, removeToast } = useToast()

  const [scope,  setScope]  = useState(CLEARANCE_DEPARTMENT_SCOPES[0].id)
  const [target, setTarget] = useState('standard')   // 'standard' or a reason id: whose requirements are on screen
  const [saved,  setSaved]  = useState(() => loadAll(campusKey))   // what is stored for this campus
  const [drafts, setDrafts] = useState(() => loadAll(campusKey))   // what is being edited: { [scope]: { requirements, reasons } }
  const [tick,   setTick]   = useState(0)             // bumps when the stored config or students change

  const [modal,        setModal]        = useState(null)   // requirement modal: { mode:'add'|'edit', index }
  const [reasonModal,  setReasonModal]  = useState(null)   // reason modal:      { mode:'add'|'edit' }
  const [removeIndex,  setRemoveIndex]  = useState(null)
  const [removeReason, setRemoveReason] = useState(false)
  const [useStandard,  setUseStandard]  = useState(false)  // confirm: drop a reason's own list
  const [discardOpen,  setDiscardOpen]  = useState(false)
  const [resetOpen,    setResetOpen]    = useState(false)
  const [zeroWarning,  setZeroWarning]  = useState(null)   // [{ name, cov }] awaiting a decision
  const [saveErrors,   setSaveErrors]   = useState([])
  const [isSaving,     setIsSaving]     = useState(false)

  const sd      = drafts[scope] || { requirements: [], reasons: [] }
  const isAdmin = user?.role === 'technical_admin'

  // What is on screen: the standard list, or one reason (which either has its own list or uses the standard one)
  const reasonIndex  = target === 'standard' ? -1 : sd.reasons.findIndex(r => r.id === target)
  const activeReason = reasonIndex >= 0 ? sd.reasons[reasonIndex] : null
  const customized   = !!activeReason && Array.isArray(activeReason.requirements)
  const readOnly     = !!activeReason && !customized          // a reason on the standard list: shown, edited under "Standard list"
  const draft        = customized ? activeReason.requirements : sd.requirements
  const listName     = activeReason ? (customized ? activeReason.label : `${activeReason.label} (standard list)`) : 'Standard list'

  const dirtyOf  = (id) => !same(drafts[id], saved[id])
  const isDirty  = dirtyOf(scope)
  const isCustom = hasCustomClearanceRequirements(scope, campusKey) || hasCustomClearanceReasons(scope, campusKey)

  // Refs let the storage listener compare without re-subscribing on every keystroke
  const draftsRef = useRef(drafts); draftsRef.current = drafts
  const savedRef  = useRef(saved);  savedRef.current  = saved

  // Another tab or page saved the config: refresh every department the admin has not touched
  useEffect(() => {
    const handler = () => {
      const fresh = loadAll(campusKey)
      const nextDrafts = { ...draftsRef.current }
      CLEARANCE_DEPARTMENT_SCOPES.forEach(s => {
        if (same(draftsRef.current[s.id], savedRef.current[s.id])) nextDrafts[s.id] = clone(fresh[s.id])
      })
      setSaved(fresh)
      setDrafts(nextDrafts)
      setTick(t => t + 1)
    }
    window.addEventListener(CONFIG_EVENT, handler)
    return () => window.removeEventListener(CONFIG_EVENT, handler)
  }, [campusKey])

  // Accounts that can be picked as signers: anyone active except students
  const accounts = useMemo(
    () => (systemUsers || []).filter(u => u.role !== 'student' && u.status !== 'inactive'),
    [systemUsers],
  )
  const userName = useCallback(
    (id) => (systemUsers || []).find(u => String(u.id) === String(id))?.name || `Account ${id}`,
    [systemUsers],
  )

  // Dry run against real students for the list on screen. Only changes when that list (or stored data) changes.
  // Only this campus's students count: the setup belongs to the campus.
  const campusStudents = () => readStudentsForClearance().filter(st => st.campusKey === campusKey)
  const coverage = useMemo(() => {
    try { return analyzeClearanceCoverage(scope, draft, campusStudents()) } catch { return null }
  }, [scope, draft, tick, campusKey])   // eslint-disable-line react-hooks/exhaustive-deps

  // ── editing the drafts ────────────────────────────────────────────────────
  const patchScope = (patch) => setDrafts(d => ({ ...d, [scope]: { ...d[scope], ...patch } }))
  const patchReason = (id, patch) => patchScope({ reasons: sd.reasons.map(r => (r.id === id ? { ...r, ...patch } : r)) })

  /** Replace the list on screen (never called while it is read-only). */
  const setList = (list) => {
    if (customized) patchReason(activeReason.id, { requirements: list })
    else patchScope({ requirements: list })
  }

  const move = (index, delta) => {
    const to = index + delta
    if (to < 0 || to >= draft.length) return
    const next = [...draft]
    ;[next[index], next[to]] = [next[to], next[index]]
    setList(next)
  }

  const moveReason = (delta) => {
    const to = reasonIndex + delta
    if (reasonIndex < 0 || to < 0 || to >= sd.reasons.length) return
    const next = [...sd.reasons]
    ;[next[reasonIndex], next[to]] = [next[to], next[reasonIndex]]
    patchScope({ reasons: next })
  }

  const handleModalSave = (req) => {
    if (modal.mode === 'add') setList([...draft, req])
    else setList(draft.map((r, i) => (i === modal.index ? req : r)))
    setModal(null)
  }

  const handleReasonSave = (reason) => {
    if (reasonModal.mode === 'add') {
      patchScope({ reasons: [...sd.reasons, reason] })
      setTarget(reason.id)                       // jump straight to the new reason
    } else {
      patchReason(activeReason.id, { label: reason.label, requiresZeroBalance: reason.requiresZeroBalance })
    }
    setReasonModal(null)
  }

  /** Give a reason its own list, starting from a copy of the standard one. */
  const customize = () => patchReason(activeReason.id, { requirements: clone(sd.requirements) })

  const dropOwnList = () => {
    const { requirements: _gone, ...rest } = activeReason
    patchScope({ reasons: sd.reasons.map(r => (r.id === activeReason.id ? rest : r)) })
    setUseStandard(false)
  }

  const switchScope = (id) => { setScope(id); setTarget('standard'); setSaveErrors([]) }

  // ── save / reset / discard ────────────────────────────────────────────────
  const requestSave = () => {
    if (!isDirty || isSaving) return
    const errors = [...validateRequirements(sd.requirements), ...validateReasons(sd.reasons)]
    setSaveErrors(errors)
    if (errors.length) return

    // Every list a clearance could use must leave a student with something to sign
    const problems = []
    const students = campusStudents()
    const std = analyzeClearanceCoverage(scope, sd.requirements, students)
    if (std.zeroCount > 0) problems.push({ name: 'Standard list', cov: std })
    sd.reasons.forEach(r => {
      if (!Array.isArray(r.requirements)) return
      const c = analyzeClearanceCoverage(scope, r.requirements, students)
      if (c.zeroCount > 0) problems.push({ name: r.label, cov: c })
    })
    if (problems.length) { setZeroWarning(problems); return }
    doSave()
  }

  const doSave = () => {
    setZeroWarning(null)
    setIsSaving(true)
    try {
      saveClearanceRequirements(scope, sd.requirements, user, campusKey)
      saveClearanceReasons(scope, sd.reasons, user, campusKey)
      const updated = syncAllClearances()
      // The bridge already announced the change when it stored the lists. Announce again now that the
      // open clearances are rewritten, so pages that listen reload the synced records, not the old ones.
      window.dispatchEvent(new CustomEvent(CONFIG_EVENT))
      addToast(
        `${campusName || 'Campus'} · ${scopeLabel(scope)} clearance saved. ${updated === 0 ? 'No open clearances needed changes.' : `${plural(updated, 'open clearance')} updated.`}`,
        'success',
      )
      setSaveErrors([])
    } catch (err) {
      addToast(err.message || 'Could not save the clearance setup.', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const doReset = () => {
    setResetOpen(false)
    try {
      resetClearanceRequirements(scope, user, campusKey)
      resetClearanceReasons(scope, user, campusKey)
      const updated = syncAllClearances()
      window.dispatchEvent(new CustomEvent(CONFIG_EVENT))
      setDrafts(d => ({ ...d, [scope]: loadScope(scope, campusKey) }))
      setTarget('standard')
      setSaveErrors([])
      addToast(`${campusName || 'Campus'} · ${scopeLabel(scope)} clearance is back to the default setup. ${plural(updated, 'open clearance')} updated.`, 'success')
    } catch (err) {
      addToast(err.message || 'Could not reset.', 'error')
    }
  }

  const doDiscard = () => {
    setDiscardOpen(false)
    setDrafts(d => ({ ...d, [scope]: clone(saved[scope]) }))
    setTarget('standard')
    setSaveErrors([])
  }

  const removing = removeIndex != null ? draft[removeIndex] : null

  if (!campusKey) {
    return (
      <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-[var(--color-info-light)] border border-[var(--color-info-border)] text-sm text-[var(--color-info-text)]">
        <Info size={15} className="shrink-0 mt-0.5" />
        Select a campus first. Each campus has its own clearance setup.
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-[var(--color-info-light)] border border-[var(--color-info-border)] text-sm text-[var(--color-info-text)]">
        <Info size={15} className="shrink-0 mt-0.5" />
        Only the Technical Administrator can change the clearance requirements.
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* ── Heading ─────────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
          Student Clearance{campusName ? ` · ${campusName}` : ''}
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
          Choose what a student must clear and who signs each item at this campus. Add a reason for clearance when different requirements are needed. Basic Education and College each have their own setup. Other campuses are not affected.
        </p>
      </div>

      {/* ── Scope tabs ──────────────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 rounded-xl bg-[var(--color-bg-subtle)] w-full sm:w-auto sm:inline-flex">
        {CLEARANCE_DEPARTMENT_SCOPES.map(s => (
          <button key={s.id} type="button" onClick={() => switchScope(s.id)}
            className={`flex-1 sm:flex-none sm:px-5 py-1.5 text-xs font-semibold rounded-lg transition-colors inline-flex items-center justify-center gap-1.5
              ${scope === s.id
                ? 'bg-[var(--color-bg-card)] text-[var(--color-text-primary)] shadow-sm'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'}`}>
            {s.label}
            {dirtyOf(s.id) && <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-warning)]" title="Unsaved changes" />}
          </button>
        ))}
      </div>

      {/* ── Banners ─────────────────────────────────────────────────────── */}
      {isDirty && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--color-warning-light)] border border-[var(--color-warning-border)] text-xs text-[var(--color-warning-text)]">
          <AlertCircle size={13} className="shrink-0" />
          Unsaved changes. Open clearances keep using the last saved setup until you save.
        </div>
      )}
      {saveErrors.length > 0 && (
        <div className="px-3 py-2 rounded-xl bg-[var(--color-error-light)] text-xs text-[var(--color-error-text)] space-y-1">
          {saveErrors.map((e, i) => (
            <p key={i} className="flex items-start gap-2"><AlertCircle size={13} className="shrink-0 mt-0.5" /> {e}</p>
          ))}
        </div>
      )}

      {/* ── Reason chips: Standard list · each reason · + Add reason ────── */}
      <div>
        <p className="form-label">Reason for clearance</p>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setTarget('standard')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors
              ${target === 'standard' ? 'is-selected' : 'bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-primary-readable)]'}`}>
            Standard list
          </button>
          {sd.reasons.map(r => (
            <button key={r.id} type="button" onClick={() => setTarget(r.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors inline-flex items-center gap-1.5
                ${target === r.id ? 'is-selected' : 'bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-primary-readable)]'}`}>
              {r.label}
              {Array.isArray(r.requirements) && <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" title="Has its own requirements" />}
            </button>
          ))}
          <button type="button" onClick={() => setReasonModal({ mode: 'add' })}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs border border-dashed border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-primary-readable)] hover:text-[var(--color-primary-readable)] transition-colors">
            <Plus size={12} /> Add reason
          </button>
        </div>
        <p className="text-xs text-[var(--color-text-muted)] mt-1.5">
          The Registrar picks one of these when starting a clearance. A dot marks a reason with its own requirements.
        </p>
      </div>

      {/* ── Selected reason: its settings ───────────────────────────────── */}
      <div className="p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
              {activeReason ? activeReason.label : 'Standard list'}
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              {!activeReason && 'Used by every reason that has not been customized.'}
              {readOnly && 'This reason uses the standard list. Customize it to give this reason different requirements.'}
              {customized && 'This reason has its own requirements.'}
            </p>
            {activeReason && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {customized ? <Chip tone="info">Own requirements ({activeReason.requirements.length})</Chip> : <Chip>Standard list</Chip>}
                {activeReason.requiresZeroBalance && <Chip tone="warn">Zero balance needed</Chip>}
              </div>
            )}
          </div>

          {activeReason && (
            <div className="flex items-center gap-0.5 shrink-0">
              <button type="button" className="icon-btn-ghost" aria-label={`Move ${activeReason.label} earlier`}
                disabled={reasonIndex === 0} onClick={() => moveReason(-1)}><ArrowLeft size={14} /></button>
              <button type="button" className="icon-btn-ghost" aria-label={`Move ${activeReason.label} later`}
                disabled={reasonIndex === sd.reasons.length - 1} onClick={() => moveReason(1)}><ArrowRight size={14} /></button>
              <button type="button" className="icon-btn-ghost" aria-label={`Edit reason ${activeReason.label}`}
                onClick={() => setReasonModal({ mode: 'edit' })}><Pencil size={14} /></button>
              <button type="button" className="icon-btn-ghost" aria-label={`Remove reason ${activeReason.label}`}
                onClick={() => setRemoveReason(true)}><Trash2 size={14} /></button>
            </div>
          )}
        </div>

        {readOnly && (
          <button type="button" onClick={customize} className="btn btn-ghost gap-1.5 text-xs">
            <Pencil size={13} /> Customize for this reason
          </button>
        )}
        {customized && (
          <button type="button" onClick={() => setUseStandard(true)} className="btn btn-ghost gap-1.5 text-xs">
            <Undo2 size={13} /> Use the standard list again
          </button>
        )}
      </div>

      {/* ── Requirements of whatever is selected ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_20rem] gap-5 items-start">
        <div className="space-y-3 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide flex flex-wrap items-center gap-1.5">
              <ShieldCheck size={11} /> Requirements ({draft.length})
              {!activeReason && <Chip tone={isCustom ? 'info' : 'neutral'}>{isCustom ? 'Custom' : 'Standard'}</Chip>}
            </p>
            {!readOnly && (
              <button type="button" onClick={() => setModal({ mode: 'add' })}
                className="flex items-center gap-1 text-xs border border-dashed border-[var(--color-border)] hover:border-[var(--color-primary-readable)] px-3 py-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-primary-readable)] transition-colors shrink-0">
                <Plus size={12} /> Add requirement
              </button>
            )}
          </div>

          {draft.length === 0 ? (
            <div className="px-4 py-8 rounded-xl border border-dashed border-[var(--color-border)] text-center text-sm text-[var(--color-text-muted)]">
              No requirements yet. Add one so students have something to clear.
            </div>
          ) : (
            <ol className="space-y-2">
              {draft.map((req, i) => {
                const Icon = iconFor(req)
                return (
                  <li key={req.id}
                    className={`flex items-start gap-3 p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] ${readOnly ? 'opacity-75' : ''}`}>
                    <div className="w-9 h-9 rounded-lg bg-[var(--color-bg-subtle)] flex items-center justify-center shrink-0 text-[var(--color-primary-readable)]">
                      <Icon size={16} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{req.label}</p>
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5 break-words">{signerSummary(req, userName)}</p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {CLEARANCE_TEACHER_SIGNER_TYPES.includes(req.signer.type) && <Chip tone="info">From Subject Load</Chip>}
                        {req.order === 'after_others' && <Chip>Signs last</Chip>}
                        {!req.required && <Chip tone="warn">Optional</Chip>}
                        {req.autoFromPayment && <Chip>Auto balance check</Chip>}
                      </div>
                    </div>

                    {!readOnly && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button type="button" className="icon-btn-ghost" aria-label={`Move ${req.label} up`}
                          disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={14} /></button>
                        <button type="button" className="icon-btn-ghost" aria-label={`Move ${req.label} down`}
                          disabled={i === draft.length - 1} onClick={() => move(i, 1)}><ArrowDown size={14} /></button>
                        <button type="button" className="icon-btn-ghost" aria-label={`Edit ${req.label}`}
                          onClick={() => setModal({ mode: 'edit', index: i })}><Pencil size={14} /></button>
                        <button type="button" className="icon-btn-ghost" aria-label={`Remove ${req.label}`}
                          onClick={() => setRemoveIndex(i)}><Trash2 size={14} /></button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ol>
          )}

          <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-[var(--color-info-light)] border border-[var(--color-info-border)] text-xs text-[var(--color-info-text)]">
            <Info size={13} className="shrink-0 mt-0.5" />
            <span>
              {readOnly
                ? 'To change these for every reason on the standard list, select "Standard list" above. '
                : customized
                  ? `Only clearances opened for "${activeReason.label}" use this list. `
                  : 'Every reason that is not customized uses this list. '}
              Open clearances follow the saved setup. A requirement you remove disappears from them unless it was already signed (it then shows as "no longer required"). New requirements appear as pending. Fully cleared records are never changed.
            </span>
          </div>
        </div>

        <CoveragePanel coverage={coverage} scope={scope} listName={listName} />
      </div>

      {/* ── Action bar ──────────────────────────────────────────────────── */}
      <div className="sticky bottom-0 z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)]">
        <p className="text-xs text-[var(--color-text-muted)] flex items-center gap-1.5">
          {isDirty
            ? <><AlertCircle size={13} className="text-[var(--color-warning)]" /> Unsaved changes in {scopeLabel(scope)} ({campusName || 'this campus'})</>
            : <><Check size={13} className="text-[var(--color-success)]" /> {scopeLabel(scope)} is saved for {campusName || 'this campus'}</>}
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setResetOpen(true)} disabled={!isCustom && !isDirty}
            className="btn btn-ghost gap-1.5 text-xs">
            <RotateCcw size={13} /> Default setup
          </button>
          <button type="button" onClick={() => setDiscardOpen(true)} disabled={!isDirty}
            className="btn btn-ghost gap-1.5 text-xs">
            <Undo2 size={13} /> Discard
          </button>
          <button type="button" onClick={requestSave} disabled={!isDirty || isSaving}
            className="btn btn-primary gap-1.5 text-xs">
            {isSaving
              ? <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
              : <Save size={13} />}
            Save {scopeLabel(scope)}
          </button>
        </div>
      </div>

      {/* ── Add / edit modals ───────────────────────────────────────────── */}
      {modal && (
        <RequirementModal
          key={modal.mode === 'add' ? 'new' : draft[modal.index]?.id}
          isNew={modal.mode === 'add'}
          initial={modal.mode === 'add'
            ? { signer: { type: 'role', roles: [] }, order: 'any', required: true, icon: 'default' }
            : draft[modal.index]}
          scope={scope}
          existingIds={draft.map(r => r.id)}
          users={accounts}
          onSave={handleModalSave}
          onClose={() => setModal(null)}
        />
      )}

      {reasonModal && (
        <ReasonModal
          key={reasonModal.mode === 'add' ? 'new-reason' : activeReason?.id}
          isNew={reasonModal.mode === 'add'}
          initial={reasonModal.mode === 'add' ? {} : activeReason}
          existingIds={sd.reasons.map(r => r.id)}
          otherLabels={sd.reasons.filter(r => r.id !== activeReason?.id || reasonModal.mode === 'add').map(r => r.label.toLowerCase())}
          onSave={handleReasonSave}
          onClose={() => setReasonModal(null)}
        />
      )}

      {/* ── Dialogs ─────────────────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!removing}
        title="Remove requirement"
        message={removing
          ? `Remove "${removing.label}" from ${customized ? `the "${activeReason.label}" list` : `the ${scopeLabel(scope)} standard list`}? Nothing changes for students until you save, and anything already signed stays on record as "no longer required".`
          : ''}
        confirmLabel="Remove"
        danger
        onConfirm={() => { setList(draft.filter((_, i) => i !== removeIndex)); setRemoveIndex(null) }}
        onCancel={() => setRemoveIndex(null)}
      />

      <ConfirmDialog
        open={removeReason && !!activeReason}
        title="Remove reason"
        message={activeReason
          ? `Remove "${activeReason.label}"? The Registrar will no longer see it when starting a clearance${customized ? ', and its own requirements list is deleted' : ''}. Existing clearances keep their reason and follow the standard list once you save.`
          : ''}
        confirmLabel="Remove"
        danger
        onConfirm={() => {
          patchScope({ reasons: sd.reasons.filter(r => r.id !== activeReason.id) })
          setTarget('standard')
          setRemoveReason(false)
        }}
        onCancel={() => setRemoveReason(false)}
      />

      <ConfirmDialog
        open={useStandard && !!activeReason}
        title="Use the standard list again"
        message={activeReason
          ? `Delete the own requirements of "${activeReason.label}" and use the standard list instead? Nothing changes for students until you save.`
          : ''}
        confirmLabel="Use standard list"
        onConfirm={dropOwnList}
        onCancel={() => setUseStandard(false)}
      />

      <ConfirmDialog
        open={discardOpen}
        title="Discard changes"
        message={`Throw away your unsaved changes to ${scopeLabel(scope)}?`}
        confirmLabel="Discard"
        danger
        onConfirm={doDiscard}
        onCancel={() => setDiscardOpen(false)}
      />

      <ConfirmDialog
        open={resetOpen}
        title="Back to the default setup"
        message={`Remove ${campusName || 'this campus'}'s own ${scopeLabel(scope)} setup and use the default instead (the school-wide setup if there is one, otherwise the standard five requirements and reasons). Reasons' own lists are removed. Other campuses are not affected, and open clearances here will follow the default right away.`}
        confirmLabel="Use default setup"
        onConfirm={doReset}
        onCancel={() => setResetOpen(false)}
      />

      <ConfirmDialog
        open={!!zeroWarning}
        title="Some students would have nothing to sign"
        message={zeroWarning
          ? `${zeroWarning.map(p => `${p.name}: ${plural(p.cov.zeroCount, 'student')} (for example ${p.cov.zero.slice(0, 2).map(z => z.name).join('; ')})`).join('. ')}. These students would have no required sign-offs in ${scopeLabel(scope)}, so their clearance could never be completed. This usually means Subject Load is not set up for them yet, or no subject matches. Save anyway?`
          : ''}
        confirmLabel="Save anyway"
        danger
        onConfirm={doSave}
        onCancel={() => setZeroWarning(null)}
      />

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  )
}
