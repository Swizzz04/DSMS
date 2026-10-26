/**
 * Clearance.jsx — ALMIRENE DX
 * Student Clearance Management — Standalone Page
 *
 * What a student must clear, and who signs each part, is NOT fixed in this file. The
 * Technical Admin sets it up per school department (Basic Ed / College) in Settings →
 * Workflow → Clearance (utils/clearanceConfigBridge.js). A requirement can be signed by:
 *   - anyone with a role (e.g. the librarian), or specific accounts
 *   - the student's subject instructors (one sign-off per subject, from Subject Load)
 *   - the teacher of a named subject (e.g. the Math teacher), or the section adviser
 *   - technical_admin signs anything; any account can be given extra requirements
 *     (user.clearanceDuties, Settings → Users)
 *   - a teacher-based sign-off with nobody assigned can be signed on behalf by the
 *     Principal / Program Head, with a note
 * The table's columns, the progress, the drawer and "Needs My Sign" are all built from the
 * requirements stored on each clearance, so changing the setup changes this page.
 *
 * Rules:
 *   - A requirement marked "signs last" opens only once every other requirement is signed
 *   - Accounting-style requirements auto-clear when the LIVE balance (almirene_submissions) is
 *     zero; they may be signed manually, with a note, while a balance is owing, so the student
 *     can still enroll next term. The balance at sign-off is recorded on the clearance.
 *   - GRADUATION clearance needs a zero balance — accounting cannot sign it while one is owing
 *   - A student that cannot be found is never auto-cleared; accounting verifies manually
 *   - Sign-off is permanent once given — no unsigning
 *   - Open clearances follow the setup (a removed requirement drops away unless already signed,
 *     a new one shows as pending); fully cleared ones never change
 *   - A teacher who is not part of any department only sees the clearances they have to sign
 *
 * Campus:
 *   - A campus user (user.campusKey) works in their own campus — always.
 *   - Admin / technical admin follow the header Campus menu (useCampusFilter).
 *     "All Campuses" lists every campus; New Clearance then asks which campus.
 *   - campusKey ('Carcar') is what records store and filter on; the display name
 *     ('Carcar City Campus') comes from activeCampuses and is only for the screen.
 *
 * Refresh: same-window changes arrive as 'almirene_clearance_updated' (and the setup /
 * Subject Load events); changes made in ANOTHER window/tab arrive as the browser 'storage'
 * event (clearance, payments, students, setup, Subject Load).
 *
 * Bridge: src/utils/documentBridge.js (getClearances, signClearanceSlot, etc.) and
 *         src/utils/clearanceConfigBridge.js (requirements, who may sign)
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ShieldCheck, Shield, Clock, CheckCircle, AlertCircle,
  Search, ChevronRight, X, Info, User, Building2,
  Filter, Eye, CreditCard, BookOpen, Users, Plus, RefreshCw, GraduationCap, UserCheck, Presentation,
} from 'lucide-react'
import { useAuth }      from '../context/AuthContext'
import { useAppConfig } from '../context/AppConfigContext'
import { useCampusFilter } from '../context/CampusFilterContext'
import GroupedSelect from '../components/GroupedSelect'
import { SortTh, Pager, useTablePaging } from '../components/DataTable'
import { CLEARANCE_DEPARTMENT_SCOPES } from '../config/appConfig'
import { getClearanceRequirements, getClearanceProgress, canUserSignSlot, slotBlockReason } from '../utils/clearanceConfigBridge'
import { getStudents } from '../utils/enrollmentBridge'
import {
  PageSkeleton, useToast, ToastContainer, ModalPortal
} from '../components/UIComponents'
import ClearanceSignDialog from '../components/documents/ClearanceSignDialog'
import {
  getClearances, getClearanceById, createClearance, syncAllClearances,
  checkAccountingStatus,
  getClearanceBalance, clearanceRequiresZeroBalance,
  getSignableDepartments, getSignableClearanceSlots, getClearanceWaitingOn,
  getClearanceRequirementSummary, getRetiredClearanceSlots,
} from '../utils/documentBridge'

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const ICONS = {
  library:     BookOpen,
  accounting:  CreditCard,
  registrar:   ShieldCheck,
  guidance:    Users,
  admin:       Building2,
  instructors: GraduationCap,
  adviser:     UserCheck,
}

/** Icon when a requirement has none of its own: by what kind of signer it has. */
const SIGNER_ICONS = {
  student_instructors: GraduationCap,
  subject_teacher:     Presentation,
  section_adviser:     UserCheck,
}

const TEACHER_SIGNER_TYPES = ['student_instructors', 'subject_teacher', 'section_adviser']

/** A requirement's icon: its own, else by id, else by signer type. Works for config rows, summaries and slots. */
function iconFor(req) {
  return ICONS[req?.icon] || ICONS[req?.id] || ICONS[req?.requirementId] || SIGNER_ICONS[req?.signerType] || Shield
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

/** Slots that still count (a signed sign-off whose requirement was later removed is "retired"). */
const activeSlots = (clearance) => (clearance?.slots || []).filter(s => !s.retired)

/** Signed / total over the required sign-offs, and the percent. */
const getProgress = (clearance) => getClearanceProgress(clearance?.slots)

/** "Library, Guidance" / "Library, Guidance +1" — what a clearance is waiting on. */
function waitingLabel(clearance) {
  const names = getClearanceWaitingOn(clearance).map(d => d.label)
  if (!names.length) return ''
  return names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ')
}

/** Storage keys that change what this page shows (clearances, live balances, student records, the setup). */
const WATCHED_STORAGE_KEYS = [
  'almirene_clearance', 'almirene_submissions', 'almirene_students',
  'almirene_clearance_requirements', 'almirene_subject_loads',
]

function fmtPeso(n) {
  return `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** True once every Accounting-style (balance-checking) sign-off of a clearance is signed. */
function balanceCheckDone(clearance) {
  const checks = activeSlots(clearance).filter(s => s.autoFromPayment)
  return checks.length > 0 && checks.every(s => s.cleared)
}

/**
 * The table's columns: the requirements of whichever school department(s) are on screen
 * (Basic Ed, College, or both when the filter is "All"), in the order the Technical Admin set.
 * A requirement that is still on a record but no longer configured (a frozen clearance, or a
 * signed sign-off that was retired) is added at the end so nothing on screen goes missing.
 * @returns {{id,label,icon,signerType,order,legacy?}[]}
 */
function buildColumns(list, scopeFilter) {
  const present = scopeFilter !== 'all'
    ? [scopeFilter]
    : CLEARANCE_DEPARTMENT_SCOPES.map(s => s.id).filter(id => list.some(c => c.scope === id))
  const cols = [], seen = new Set()
  const add = (col) => { if (!seen.has(col.id)) { seen.add(col.id); cols.push(col) } }
  present.forEach(sc => getClearanceRequirements(sc).forEach(r =>
    add({ id: r.id, label: r.label, icon: r.icon, signerType: r.signer.type, order: r.order })))
  list.forEach(c => getClearanceRequirementSummary(c).forEach(r =>
    add({ id: r.id, label: r.label, icon: r.icon, signerType: r.signerType, order: r.order, legacy: true })))
  // With both departments on screen, "signs last" requirements still end the row, and leftovers come after
  const rank = (col) => col.legacy ? 2 : col.order === 'after_others' ? 1 : 0
  return cols.map((col, i) => ({ col, i })).sort((a, b) => rank(a.col) - rank(b.col) || a.i - b.i).map(x => x.col)
}

/** Requirement id -> how far one clearance has got with it (undefined = not part of this clearance). */
function summaryById(clearance) {
  const out = {}
  getClearanceRequirementSummary(clearance).forEach(e => { out[e.id] = e })
  return out
}

/** Column sorters for the list (module-level so their identity never changes). */
const CLEARANCE_SORTERS = {
  student:   (a, b) => (a.studentName || '').localeCompare(b.studentName || ''),
  reason:    (a, b) => (a.reason || '').localeCompare(b.reason || ''),
  progress:  (a, b) => getProgress(a).percent - getProgress(b).percent,
  requested: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
}

// ─────────────────────────────────────────────────────────────────────────────
// REQUIREMENT CHIP — compact status for the phone list
// ─────────────────────────────────────────────────────────────────────────────

function DeptChip({ label, entry }) {
  const cleared = !!entry && entry.pending === 0
  const partial = !!entry && !cleared && entry.cleared > 0
  const state   = !entry ? 'not required' : cleared ? 'cleared' : partial ? `${entry.cleared}/${entry.total} signed` : 'pending'

  return (
    <span
      title={`${label}: ${state}`}
      aria-label={`${label}: ${state}`}
      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[9px] font-bold border
        ${!entry
          ? 'border-dashed border-[var(--color-border)] text-[var(--color-text-muted)] opacity-50'
          : cleared
            ? 'bg-[var(--color-success-light)] text-[var(--color-success)] border-[var(--color-success-border)]'
            : partial
              ? 'bg-[var(--color-warning-light)] text-[var(--color-warning-text)] border-[var(--color-warning-border)]'
              : 'bg-[var(--color-bg-muted)] text-[var(--color-text-muted)] border-[var(--color-border)]'}`}
    >
      {label?.[0]}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CLEARANCE DETAIL DRAWER
// ─────────────────────────────────────────────────────────────────────────────

/** One sign-off line in the drawer — a whole requirement, or one subject inside a group. */
function SignoffRow({ slot, Icon, nested, canSign, waitText, signLabel, onSign }) {
  const cleared = slot.cleared === true
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border transition-colors ${nested ? 'p-2.5' : 'p-3'}
        ${cleared
          ? 'bg-[var(--color-success-light)] border-[var(--color-success-border)]'
          : 'bg-[var(--color-bg-page)] border-[var(--color-border)]'}`}
    >
      {!nested && (
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0
          ${cleared ? 'bg-[var(--color-success)] text-white' : 'bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]'}`}>
          <Icon size={15} />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className={`${nested ? 'text-xs' : 'text-sm'} font-semibold ${cleared ? 'text-[var(--color-success)]' : 'text-[var(--color-text-primary)]'}`}>
            {nested ? slot.itemLabel : slot.label}
          </p>
          {slot.autoFromPayment && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--color-info-light)] text-[var(--color-info)] border border-[var(--color-info-border)] font-semibold">
              AUTO
            </span>
          )}
          {!nested && slot.itemLabel && (
            <span className="text-[11px] text-[var(--color-text-muted)]">{slot.itemLabel}</span>
          )}
          {!cleared && slot.unassigned && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--color-warning-light)] text-[var(--color-warning-text)] border border-[var(--color-warning-border)] font-semibold">
              NO TEACHER ASSIGNED
            </span>
          )}
        </div>

        {cleared ? (
          <>
            <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
              {slot.clearedBy} · {fmtDateTime(slot.clearedAt)}
            </p>
            {slot.signedOnBehalf && (
              <p className="text-[11px] text-[var(--color-warning-text)] mt-0.5 font-semibold">
                Signed on behalf — no teacher was assigned
              </p>
            )}
            {slot.withBalance && (
              <p className="text-[11px] text-[var(--color-warning)] mt-0.5 font-semibold">
                Cleared with balance of {fmtPeso(slot.balanceAtSignoff)}
              </p>
            )}
            {slot.balanceUnverified && (
              <p className="text-[11px] text-[var(--color-warning)] mt-0.5 font-semibold">Balance verified manually</p>
            )}
            {slot.note && (
              <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5 break-words">Note: {slot.note}</p>
            )}
          </>
        ) : (
          <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
            {waitText || (slot.teacherName ? `Waiting for ${slot.teacherName}` : 'Pending')}
          </p>
        )}
      </div>

      {cleared
        ? <CheckCircle size={nested ? 14 : 16} className="text-[var(--color-success)] shrink-0" />
        : canSign
          ? (
            <button onClick={onSign} className="btn btn-primary text-xs py-1.5 px-3 shrink-0">
              {signLabel}
            </button>
          )
          : <Clock size={nested ? 14 : 16} className="text-[var(--color-text-muted)] shrink-0" />
      }
    </div>
  )
}

function ClearanceDrawer({ clearance, campusName, currentUser, onUpdate, onClose }) {
  const [confirmSlot, setConfirmSlot] = useState(null)   // the slot being signed
  const { toasts, addToast, removeToast } = useToast()

  // Live balance, read fresh from the payment records every render
  const balInfo      = getClearanceBalance(clearance)
  const owing        = balInfo.found && balInfo.balance > 0
  const zeroRequired = clearanceRequiresZeroBalance(clearance)

  const progress  = getProgress(clearance)
  const pct       = progress.percent

  // Who can sign what, in which order, is decided per sign-off (role / account / assigned teacher,
  // order rule, blocking rules) — the bridge answers it, this page only shows it
  const signableIds = new Set(getSignableClearanceSlots(currentUser, clearance).map(s => s.id))

  // Accounting cannot sign a graduation clearance while a balance is owing
  const accountingBlocked = zeroRequired && owing

  const groups  = getClearanceRequirementSummary(clearance)
  const slots   = activeSlots(clearance)
  const retired = getRetiredClearanceSlots(clearance)
  // Setup notes (e.g. "no section yet") — missing teachers already show on their own row
  const notes   = (clearance.slotWarnings || []).filter(w => w.code !== 'unassigned')

  const waitTextFor = (slot) => {
    if (slot.autoFromPayment && accountingBlocked) return 'Blocked — balance owing'
    if (slot.order === 'after_others' && slotBlockReason(clearance.slots, slot.id)) return 'Opens after the other requirements sign'
    return null
  }
  const signLabelFor = (slot) => {
    if (slot.autoFromPayment && (owing || !balInfo.found)) return 'Sign with note'
    if (slot.unassigned) return 'Sign on behalf'
    return 'Sign'
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
                  {progress.cleared} / {progress.total} sign-offs
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
                ['Campus',     campusName || clearance.campusKey || '—'],
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

            {notes.length > 0 && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-[var(--color-warning-light)] border border-[var(--color-warning-border)] text-xs text-[var(--color-text-secondary)]">
                <AlertCircle size={13} className="text-[var(--color-warning)] shrink-0 mt-0.5" />
                <ul className="space-y-0.5">
                  {notes.map((w, i) => <li key={`${w.code}-${i}`}>{w.message}</li>)}
                </ul>
              </div>
            )}

            {/* Sign-offs, one block per requirement — as set up by the Technical Admin */}
            <div>
              <p className="text-label text-[var(--color-text-muted)] mb-3">Sign-offs</p>
              <div className="space-y-2">
                {groups.map(g => {
                  const Icon  = iconFor(g)
                  const items = slots.filter(s => s.requirementId === g.id)

                  // One sign-off: a plain row
                  if (items.length === 1) {
                    const s = items[0]
                    return (
                      <SignoffRow
                        key={s.id} slot={s} Icon={Icon}
                        canSign={signableIds.has(s.id)}
                        waitText={waitTextFor(s)}
                        signLabel={signLabelFor(s)}
                        onSign={() => setConfirmSlot(s)}
                      />
                    )
                  }

                  // Several sign-offs (e.g. one per subject): a block with a row each
                  const done = g.pending === 0
                  return (
                    <div key={g.id} className={`rounded-xl border p-3 space-y-2
                      ${done
                        ? 'bg-[var(--color-success-light)] border-[var(--color-success-border)]'
                        : 'bg-[var(--color-bg-page)] border-[var(--color-border)]'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0
                          ${done ? 'bg-[var(--color-success)] text-white' : 'bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]'}`}>
                          <Icon size={15} />
                        </div>
                        <p className={`flex-1 text-sm font-semibold ${done ? 'text-[var(--color-success)]' : 'text-[var(--color-text-primary)]'}`}>
                          {g.label}
                        </p>
                        <span className="text-xs font-bold tabular-nums text-[var(--color-text-secondary)]">
                          {g.cleared} / {g.total} signed
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {items.map(s => (
                          <SignoffRow
                            key={s.id} slot={s} Icon={Icon} nested
                            canSign={signableIds.has(s.id)}
                            waitText={waitTextFor(s)}
                            signLabel={signLabelFor(s)}
                            onSign={() => setConfirmSlot(s)}
                          />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Signed, then taken off the requirements list */}
            {retired.length > 0 && (
              <div>
                <p className="text-label text-[var(--color-text-muted)] mb-2">No longer required</p>
                <ul className="space-y-1.5">
                  {retired.map(s => (
                    <li key={s.id} className="flex items-center gap-2 p-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)] text-xs">
                      <CheckCircle size={13} className="text-[var(--color-text-muted)] shrink-0" />
                      <span className="font-medium text-[var(--color-text-secondary)]">
                        {s.label}{s.itemLabel ? ` — ${s.itemLabel}` : ''}
                      </span>
                      <span className="text-[var(--color-text-muted)] ml-auto text-right">
                        signed by {s.clearedBy} · {fmtDate(s.clearedAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Fully cleared banner */}
            {clearance.isFullyCleared && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-[var(--color-success-light)] border border-[var(--color-success-border)]">
                <ShieldCheck size={20} className="text-[var(--color-success)] shrink-0" />
                <div>
                  <p className="text-sm font-bold text-[var(--color-success)]">Fully Cleared</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    All sign-offs complete on {fmtDate(clearance.completedAt)}.
                    Registrar may now release requested credentials.
                  </p>
                </div>
              </div>
            )}
          </div>

          <ToastContainer toasts={toasts} removeToast={removeToast} />
        </div>
      </div>

      {confirmSlot && (
        <ClearanceSignDialog
          clearance={clearance}
          deptId={confirmSlot.requirementId}
          slotId={confirmSlot.id}
          user={currentUser}
          onClose={() => setConfirmSlot(null)}
          onSigned={(_fresh, label) => { addToast(`${label} clearance signed.`, 'success'); onUpdate() }}
          onError={(msg) => addToast(msg, 'error')}
        />
      )}
    </ModalPortal>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CLEARANCE LIST — table on desktop, compact rows on phones
// ─────────────────────────────────────────────────────────────────────────────

/** One status pill per clearance — shared by the table and the phone list. */
function StatusPill({ clearance, needsMySign, compact = false }) {
  if (clearance.isFullyCleared) return <span className="badge badge-approved shrink-0">Cleared</span>
  if (needsMySign)              return <span className="badge badge-pending shrink-0">Needs your sign</span>
  // The table already shows each department's sign-off, so it only needs "Pending";
  // the phone list has no such columns and names who the clearance is waiting on.
  return (
    <span
      className="badge shrink-0"
      style={{
        background: 'var(--color-bg-subtle)',
        color: 'var(--color-text-muted)',
        border: '1px solid var(--color-border)',
      }}
    >
      {compact ? 'Pending' : `Waiting on ${waitingLabel(clearance)}`}
    </span>
  )
}

/** One requirement's sign-off as a round check / clock — a column cell in the table. */
function DeptCell({ label, entry, info }) {
  // Not part of this clearance (e.g. a College-only requirement on a Basic Ed student)
  if (!entry) {
    return (
      <span className="text-[var(--color-text-muted)] opacity-50" title={`${label}: not required`}>
        <span aria-hidden="true">—</span>
        <span className="sr-only">{label}: not required</span>
      </span>
    )
  }

  const cleared = entry.pending === 0
  const partial = !cleared && entry.cleared > 0

  // Several sign-offs (one per subject): show the count
  if (entry.total > 1) {
    return (
      <span
        title={`${label}: ${entry.cleared} of ${entry.total} signed`}
        className={`inline-flex items-center justify-center min-w-[2.25rem] px-1.5 h-6 rounded-full border text-[10px] font-bold tabular-nums
          ${cleared
            ? 'bg-[var(--color-success-light)] text-[var(--color-success)] border-[var(--color-success-border)]'
            : partial
              ? 'bg-[var(--color-warning-light)] text-[var(--color-warning-text)] border-[var(--color-warning-border)]'
              : 'bg-[var(--color-bg-muted)] text-[var(--color-text-muted)] border-[var(--color-border)]'}`}
      >
        {entry.cleared}/{entry.total}
        <span className="sr-only"> {label}: {entry.cleared} of {entry.total} signed</span>
      </span>
    )
  }

  return (
    <span
      title={`${label}: ${cleared ? `Cleared by ${info?.clearedBy ?? '—'}` : 'Pending'}`}
      className={`inline-flex items-center justify-center w-6 h-6 rounded-full border
        ${cleared
          ? 'bg-[var(--color-success-light)] text-[var(--color-success)] border-[var(--color-success-border)]'
          : 'bg-[var(--color-bg-muted)] text-[var(--color-text-muted)] border-[var(--color-border)]'}`}
    >
      {cleared ? <CheckCircle size={13} /> : <Clock size={12} />}
      <span className="sr-only">{label}: {cleared ? 'cleared' : 'pending'}</span>
    </span>
  )
}

/** Progress as "3/5" with a thin bar. */
function ProgressCell({ clearance }) {
  const { cleared, total, percent } = getProgress(clearance)
  return (
    <div className="flex items-center gap-2">
      <div className="hidden 2xl:block h-1.5 w-12 bg-[var(--color-bg-subtle)] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${percent}%`,
            backgroundColor: clearance.isFullyCleared
              ? 'var(--color-success)'
              : percent >= 60 ? 'var(--color-warning)' : 'var(--color-primary)',
          }}
        />
      </div>
      <span className="text-xs font-semibold text-[var(--color-text-muted)] tabular-nums">
        {cleared}/{total}
      </span>
    </div>
  )
}

function ClearanceTable({ rows, columns, summaries, studentMap, signMap, showCampus, campusNameOf, sort, onSort, onSelect }) {
  return (
    <div className="hidden md:block overflow-x-auto">
      <table className="w-full [&_th]:!px-3 [&_td]:!px-3">
        <thead className="bg-[var(--color-bg-subtle)]">
          <tr>
            <SortTh label="Student" sortKey="student" sort={sort} onSort={onSort} />
            <SortTh label="Reason" sortKey="reason" sort={sort} onSort={onSort} />
            {showCampus && <th scope="col" className="th">Campus</th>}
            {columns.map(col => {
              const Icon = iconFor(col)
              return (
                <th key={col.id} scope="col" className="th text-center !px-2"
                    title={col.legacy ? `${col.label} (no longer required for new clearances)` : col.label}>
                  <span className={`inline-flex items-center gap-1 ${col.legacy ? 'opacity-70' : ''}`}>
                    <Icon size={14} />
                    <span className="hidden 2xl:inline">{col.label}</span>
                    <span className="2xl:hidden sr-only">{col.label}</span>
                  </span>
                </th>
              )
            })}
            <SortTh label="Progress" sortKey="progress" sort={sort} onSort={onSort} />
            <th scope="col" className="th">Status</th>
            <SortTh label="Requested" sortKey="requested" sort={sort} onSort={onSort} />
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {rows.map(c => {
            const st          = studentMap.get(c.studentId)
            const needsMySign = signMap.get(c.id) === true
            const mine        = summaries.get(c.id) || {}
            return (
              <tr
                key={c.id}
                onClick={() => onSelect(c)}
                className={`table-row cursor-pointer ${needsMySign ? 'shadow-[inset_3px_0_0_0_var(--color-warning)]' : ''}`}
              >
                <td className="td">
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); onSelect(c) }}
                    className="text-left rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)]"
                    aria-label={`View clearance for ${c.studentName}`}
                  >
                    <span className="block text-sm font-semibold text-[var(--color-text-primary)]">{c.studentName}</span>
                    <span className="block text-xs text-[var(--color-text-muted)]">
                      <span className="font-mono">{st?.studentId || '—'}</span>
                      {st?.gradeLevel ? ` · ${st.gradeLevel}` : ''}
                    </span>
                  </button>
                </td>
                <td className="td text-[var(--color-text-secondary)]">{c.reason || 'General Clearance'}</td>
                {showCampus && <td className="td text-[var(--color-text-secondary)]" title={campusNameOf(c.campusKey)}>{campusNameOf(c.campusKey).replace(/ Campus$/, '')}</td>}
                {columns.map(col => (
                  <td key={col.id} className="td text-center !px-2">
                    <DeptCell label={col.label} entry={mine[col.id]} info={c.departments?.[col.id]} />
                  </td>
                ))}
                <td className="td"><ProgressCell clearance={c} /></td>
                <td className="td"><StatusPill clearance={c} needsMySign={needsMySign} compact /></td>
                <td className="td text-[var(--color-text-muted)]">{fmtDate(c.createdAt)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** Phone / small-tablet list: one tappable row per clearance. */
function ClearanceMobileList({ rows, columns, summaries, studentMap, signMap, showCampus, campusNameOf, onSelect }) {
  return (
    <ul className="md:hidden divide-y divide-[var(--color-border)]">
      {rows.map(c => {
        const st          = studentMap.get(c.studentId)
        const needsMySign = signMap.get(c.id) === true
        const mine        = summaries.get(c.id) || {}
        const progress    = getProgress(c)
        return (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onSelect(c)}
              className={`w-full text-left p-4 hover:bg-[var(--color-bg-subtle)] transition-colors
                ${needsMySign ? 'shadow-[inset_3px_0_0_0_var(--color-warning)]' : ''}`}
              aria-label={`View clearance for ${c.studentName}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[var(--color-text-primary)] truncate">{c.studentName}</p>
                  <p className="text-xs text-[var(--color-text-muted)] truncate">
                    {[st?.studentId, st?.gradeLevel].filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>
                <StatusPill clearance={c} needsMySign={needsMySign} />
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-1 truncate">
                {c.reason || 'General Clearance'} · {fmtDate(c.createdAt)}
                {showCampus ? ` · ${campusNameOf(c.campusKey)}` : ''}
              </p>
              <div className="mt-2.5 flex items-center justify-between gap-3">
                <div className="flex flex-wrap gap-1">
                  {columns.filter(col => mine[col.id]).map(col => (
                    <DeptChip key={col.id} label={col.label} entry={mine[col.id]} />
                  ))}
                </div>
                <span className="text-[10px] text-[var(--color-text-muted)] font-semibold tabular-nums">
                  {progress.cleared}/{progress.total}
                </span>
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STATS BAR
// ─────────────────────────────────────────────────────────────────────────────

function StatsBar({ clearances, needsMe, showMine }) {
  const total    = clearances.length
  const cleared  = clearances.filter(c => c.isFullyCleared).length
  const pending  = total - cleared

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

function NewClearanceModal({ campusKey: lockedCampusKey, schoolYear, currentUser, onSave, onClose }) {
  const [studentSearch, setStudentSearch] = useState('')
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [reason, setReason] = useState('general')
  const [saving, setSaving] = useState(false)
  const [pickedKey, setPickedKey] = useState('')
  const { toasts, addToast, removeToast } = useToast()
  const { isBasicGrade, activeCampuses } = useAppConfig()

  // The page already knows the campus (own campus, or the one chosen in the header menu).
  // Only with "All Campuses" selected does the registrar choose one here.
  const needsCampusPick = !lockedCampusKey
  const campusKey  = lockedCampusKey || pickedKey
  const campusName = activeCampuses?.find(c => c.key === campusKey)?.name ?? campusKey
  const campusOptions = (activeCampuses || []).map(c => ({ value: c.key, label: c.name }))

  // Students come from the student records (they carry the school ID), scoped to the
  // campus and school year. A department registrar only sees their own students;
  // the technical admin sees both.
  const studentDept = (st) => st?.department || (isBasicGrade?.(st?.gradeLevel) ? 'basicEd' : 'college')
  const lockedDept  = currentUser?.role === 'registrar_basic' ? 'basicEd'
                    : currentUser?.role === 'registrar_college' ? 'college' : null
  // No campus yet (All Campuses, nothing picked) → no students, never "everyone"
  const allStudents = campusKey
    ? (getStudents({ campusKey, schoolYear }) || [])
        .filter(st => !lockedDept || studentDept(st) === lockedDept)
    : []

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
    if (!campusKey) { addToast('Please choose a campus first.', 'error'); return }
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
            {/* Campus — a pick only when the header menu is on "All Campuses" */}
            <div>
              <label className="text-label text-[var(--color-text-muted)] block mb-1.5">
                Campus {needsCampusPick ? '*' : ''}
              </label>
              {needsCampusPick ? (
                <GroupedSelect
                  value={pickedKey || 'all'}
                  onChange={v => { setPickedKey(v === 'all' ? '' : v); setSelectedStudent(null); setStudentSearch('') }}
                  allLabel="Select campus"
                  placeholder="Select campus"
                  options={campusOptions}
                />
              ) : (
                <p className="text-sm font-medium text-[var(--color-text-primary)]">{campusName}</p>
              )}
            </div>

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
                      disabled={!campusKey}
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
                      No students found{campusName ? ` in ${campusName}` : ''}
                      {lockedDept ? ` (${lockedDept === 'college' ? 'College' : 'Basic Ed'} only)` : ''}.
                    </p>
                  )}
                  {!q && (
                    <p className="text-xs text-[var(--color-text-muted)] mt-1.5 pl-1">
                      {campusKey
                        ? 'Type a name or school ID, then pick the student from the list.'
                        : 'Choose a campus first, then search for the student.'}
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
              <span className="text-xs text-[var(--color-text-muted)] mr-auto">
                {campusKey ? 'Pick a student to continue.' : 'Choose a campus to continue.'}
              </span>
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

  // Campus: a campus user works in their own campus. Admin / technical admin follow the
  // header Campus menu. '' = All Campuses (the list shows every campus; New Clearance asks).
  // campusFilter holds a campus KEY ('Carcar'); a key that is no longer active counts as 'all'.
  const { campusFilter = 'all' } = useCampusFilter()
  const headerCampusKey = activeCampuses?.some(c => c.key === campusFilter) ? campusFilter : ''
  const campusKey  = user?.campusKey || headerCampusKey
  const campusNameOf = useCallback(
    (key) => activeCampuses?.find(c => c.key === key)?.name ?? key ?? '',
    [activeCampuses]
  )
  const campusName = campusKey ? campusNameOf(campusKey) : 'All Campuses'
  // currentSchoolYear is already the year string (e.g. '2026-2027'), not an object
  const schoolYear = currentSchoolYear || '2026-2027'
  const role       = user?.role

  // Which requirements can this account sign? Read from the Technical Admin's setup: the roles /
  // accounts a requirement lists, requirements given to this account as extra duties, and — for a
  // teacher — the teacher-based ones (their own subjects / section). Super Admin signs all.
  const isSuperAdmin = role === 'technical_admin'
  const [configTick, setConfigTick] = useState(0)     // bumped when the setup changes
  const myReqs = useMemo(() => {
    if (!user) return []
    const found = new Map()
    CLEARANCE_DEPARTMENT_SCOPES.forEach(sc => getClearanceRequirements(sc.id).forEach(r => {
      const t = r.signer.type
      const mine =
        (t === 'role' && r.signer.roles.includes(role)) ||
        (t === 'user' && r.signer.userIds.some(id => String(id) === String(user.id))) ||
        (Array.isArray(user.clearanceDuties) && user.clearanceDuties.includes(r.id)) ||
        (TEACHER_SIGNER_TYPES.includes(t) && role === 'teacher')
      if (mine && !found.has(r.id)) found.set(r.id, r)
    }))
    return [...found.values()]
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role, configTick])
  const myLabels       = myReqs.map(r => r.label)
  const showMine       = isSuperAdmin || myReqs.length > 0
  const pureAccounting = !isSuperAdmin && myReqs.length > 0 && myReqs.every(r => r.autoFromPayment)
  // A teacher with no department of their own only sees the clearances they have to sign
  const restrictToMine = !isSuperAdmin && myReqs.length > 0 && myReqs.every(r => TEACHER_SIGNER_TYPES.includes(r.signer.type))
  const isRegistrar  = ['registrar_basic', 'registrar_college', 'technical_admin'].includes(role)

  const [clearances,   setClearances]   = useState([])
  const [loading,      setLoading]      = useState(true)
  const [filter,       setFilter]       = useState('pending')  // 'pending' | 'cleared' | 'all'
  const [search,       setSearch]       = useState('')
  const [selected,     setSelected]     = useState(null)
  const [showNew,      setShowNew]      = useState(false)
  const [waitFilter,   setWaitFilter]   = useState('all')      // a requirement id, or 'all'
  const [scopeFilter,  setScopeFilter]  = useState('all')      // 'basicEd' | 'college' | 'all'
  const { toasts, addToast, removeToast } = useToast()

  const loadData = useCallback(() => {
    try {
      // Save whatever the setup / Subject Load changed on open clearances (no-op when nothing did)
      syncAllClearances()

      // An empty campusKey means "All Campuses" — getClearances skips the campus filter
      let all = getClearances({ campusKey, schoolYear })

      // Accounting role: only show clearances where the balance check hasn't been signed yet
      if (pureAccounting) {
        all = all.filter(c => !balanceCheckDone(c))
      }
      // A teacher: only the clearances they have a sign-off in
      if (restrictToMine) {
        all = all.filter(c => activeSlots(c).some(sl => canUserSignSlot(user, sl)))
      }

      setClearances(all)
    } catch (err) {
      addToast('Failed to load clearance records.', 'error')
    } finally {
      setLoading(false)
    }
  }, [campusKey, schoolYear, pureAccounting, restrictToMine, user])

  useEffect(() => { loadData() }, [loadData])

  // The header Campus menu changed: close anything that belongs to the previous campus view.
  // (Skipped on first render so /clearance?id=… can still open a record.)
  const lastCampusRef = useRef(campusKey)
  useEffect(() => {
    if (lastCampusRef.current === campusKey) return
    lastCampusRef.current = campusKey
    setSelected(null)
    setShowNew(false)
  }, [campusKey])

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

  // Keep the list AND the open drawer fresh:
  //  - 'almirene_clearance_updated' → a change made in this window
  //  - 'storage'                    → a change made in another window/tab (the browser never
  //                                   fires it in the window that wrote; key === null = cleared)
  useEffect(() => {
    const refresh = () => {
      loadData()
      setSelected(prev => (prev ? (getClearanceById(prev.id) ?? prev) : prev))
    }
    // The setup or Subject Load changed: the columns and the teachers on each sign-off may differ
    const refreshSetup = () => { setConfigTick(t => t + 1); refresh() }
    const onStorage = (e) => {
      if (e.key === null || WATCHED_STORAGE_KEYS.includes(e.key)) refreshSetup()
    }
    const SETUP_EVENTS = ['almirene_clearance_config_updated', 'almirene_subject_load_updated']
    window.addEventListener('almirene_clearance_updated', refresh)
    SETUP_EVENTS.forEach(ev => window.addEventListener(ev, refreshSetup))
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('almirene_clearance_updated', refresh)
      SETUP_EVENTS.forEach(ev => window.removeEventListener(ev, refreshSetup))
      window.removeEventListener('storage', onStorage)
    }
  }, [loadData])

  // ── Derived data (computed once per load, not once per row) ─────────────────
  // Can this account sign each clearance right now? One engine call per record, reused by the
  // stats, the filter chips and every row.
  const signMap = useMemo(
    () => new Map(clearances.map(c => [c.id, getSignableDepartments(user, c).length > 0])),
    [clearances, user]
  )
  const needsMeCount = useMemo(
    () => clearances.reduce((n, c) => n + (signMap.get(c.id) ? 1 : 0), 0),
    [clearances, signMap]
  )

  // Student records give the School ID and grade / program shown in the list
  const studentMap = useMemo(() => {
    const m = new Map()
    try { getStudents(campusKey ? { campusKey } : {}).forEach(st => m.set(st.id, st)) } catch { /* no student records yet */ }
    return m
  }, [campusKey, clearances])

  // Which school departments are in the data (the department filter only shows when there are two)
  const scopesPresent = CLEARANCE_DEPARTMENT_SCOPES.filter(sc => clearances.some(c => c.scope === sc.id))
  const scopeOptions  = scopesPresent.map(sc => ({ value: sc.id, label: sc.label }))

  // Status + department + search first; the columns come from what is left, then "waiting on"
  const baseList = useMemo(() => {
    let list = clearances

    if (filter === 'pending')       list = list.filter(c => !c.isFullyCleared)
    else if (filter === 'cleared')  list = list.filter(c => c.isFullyCleared)
    else if (filter === 'needs-me' && showMine) list = list.filter(c => signMap.get(c.id))

    if (scopeFilter !== 'all') list = list.filter(c => c.scope === scopeFilter)

    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(c =>
        c.studentName?.toLowerCase().includes(q) ||
        c.reason?.toLowerCase().includes(q) ||
        String(studentMap.get(c.studentId)?.studentId || '').toLowerCase().includes(q)
      )
    }
    return list
  }, [clearances, filter, scopeFilter, search, showMine, signMap, studentMap])

  // The table's columns follow the requirements of the clearances on screen
  const columns   = useMemo(() => buildColumns(baseList, scopeFilter), [baseList, scopeFilter])
  const summaries = useMemo(() => new Map(clearances.map(c => [c.id, summaryById(c)])), [clearances])
  const waitOptions = columns.filter(col => !col.legacy).map(col => ({ value: col.id, label: col.label }))

  const filtered = useMemo(
    () => waitFilter === 'all'
      ? baseList
      : baseList.filter(c => getClearanceWaitingOn(c).some(d => d.id === waitFilter)),
    [baseList, waitFilter]
  )

  // A filter that points at something no longer on screen (the setup changed) goes back to "any"
  useEffect(() => {
    if (waitFilter !== 'all' && !columns.some(col => col.id === waitFilter)) setWaitFilter('all')
  }, [columns, waitFilter])
  useEffect(() => {
    if (scopeFilter !== 'all' && !scopesPresent.some(sc => sc.id === scopeFilter)) setScopeFilter('all')
  }, [scopesPresent, scopeFilter])

  // Sort + page the filtered list (back to page 1 when the filters, search or campus change)
  const { rows, sort, onSort, page, pageCount, total, setPage, pageSize, setPageSize } = useTablePaging(filtered, {
    sorters:     CLEARANCE_SORTERS,
    defaultSort: { key: 'requested', dir: 'desc' },
    descFirst:   ['requested', 'progress'],
    resetOn:     [filter, waitFilter, scopeFilter, search, campusKey],
  })

  const filterOptions = [
    { id: 'all',     label: `All (${clearances.length})` },
    { id: 'pending', label: `Pending (${clearances.filter(c => !c.isFullyCleared).length})` },
    { id: 'cleared', label: `Cleared (${clearances.filter(c => c.isFullyCleared).length})` },
    ...(showMine ? [{ id: 'needs-me', label: `Needs My Sign (${needsMeCount})` }] : []),
  ]
  const hasExtraFilters = waitFilter !== 'all' || scopeFilter !== 'all' || search.trim() !== ''
  const clearExtraFilters = () => { setWaitFilter('all'); setScopeFilter('all'); setSearch('') }

  if (loading) return <PageSkeleton />

  return (
    <div className="page-enter space-y-5">
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-display text-[var(--color-text-primary)]">Student Clearance</h1>
          <p className="text-body text-[var(--color-text-muted)] mt-1">
            {schoolYear} · {campusName}
            {!isSuperAdmin && myLabels.length > 0 && (
              <span className="ml-2 badge" style={{
                background: 'var(--color-secondary-muted)',
                color: 'var(--color-secondary)',
                border: '1px solid var(--color-secondary)',
                display: 'inline-flex'
              }}>
                {myLabels.join(' + ')} — My {myLabels.length > 1 ? 'Requirements' : 'Requirement'}
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
      {!isSuperAdmin && myLabels.length > 0 && (
        <div className="flex items-start gap-2.5 p-4 rounded-xl bg-[var(--color-info-light)] border border-[var(--color-info-border)]">
          <Info size={15} className="text-[var(--color-info)] shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-semibold text-[var(--color-info)]">Your role: </span>
            <span className="text-[var(--color-text-secondary)]">
              You can sign off the <strong>{myLabels.join(', ')}</strong> clearance for each student.
              {restrictToMine && ' You only see the students whose clearance needs your signature, for your own subjects or section.'}
              {' '}Sign-offs can happen in any order, except those marked as signing last, which open once the others are done.
              Once signed, it cannot be reversed. Everything else is handled by its own officer.
            </span>
          </div>
        </div>
      )}

      {myReqs.some(r => r.autoFromPayment) && !isSuperAdmin && (
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
      <StatsBar clearances={clearances} needsMe={needsMeCount} showMine={showMine} />

      {/* ── Filters + Search ──────────────────────────────────────────────── */}
      <div className="space-y-3">
        {/* Status chips — scroll sideways on a phone instead of wrapping into a tall block */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {filterOptions.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`btn text-xs py-2 px-4 shrink-0 whitespace-nowrap ${
                filter === f.id ? 'btn-primary' : 'btn-ghost'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          {/* Search */}
          <div className="flex-1 flex items-center gap-2 border border-[var(--color-border)] rounded-[var(--radius-md)] bg-[var(--color-bg-card)] px-3 focus-within:ring-2 focus-within:ring-[var(--color-border-focus)] transition-shadow">
            <Search size={14} className="text-[var(--color-text-muted)] shrink-0" />
            <input
              className="flex-1 min-w-0 py-[0.5625rem] text-sm bg-transparent outline-none text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
              placeholder="Search name, school ID or reason..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              aria-label="Search clearances"
            />
          </div>
          {scopeOptions.length > 1 && (
            <GroupedSelect
              value={scopeFilter}
              onChange={setScopeFilter}
              allLabel="All departments"
              placeholder="Department"
              options={scopeOptions}
              className="md:w-52"
            />
          )}
          <GroupedSelect
            value={waitFilter}
            onChange={setWaitFilter}
            allLabel="Any requirement"
            placeholder="Waiting on…"
            options={waitOptions}
            className="md:w-52"
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
            {hasExtraFilters
              ? 'No clearance matches the search or filters.'
              : filter === 'pending'
                ? 'All students are fully cleared for this school year.'
                : filter === 'needs-me'
                  ? 'Every clearance you can sign is already signed.'
                  : 'Clearance records are created when students request credentials.'}
          </p>
          {hasExtraFilters && (
            <button onClick={clearExtraFilters} className="btn btn-ghost text-xs mt-4">Clear search and filters</button>
          )}
        </div>
      ) : (
        <div className="card-section border border-[var(--color-border)]">
          <ClearanceTable
            rows={rows}
            columns={columns}
            summaries={summaries}
            studentMap={studentMap}
            signMap={signMap}
            showCampus={!campusKey}
            campusNameOf={campusNameOf}
            sort={sort}
            onSort={onSort}
            onSelect={c => setSelected(c)}
          />
          <ClearanceMobileList
            rows={rows}
            columns={columns}
            summaries={summaries}
            studentMap={studentMap}
            signMap={signMap}
            showCampus={!campusKey}
            campusNameOf={campusNameOf}
            onSelect={c => setSelected(c)}
          />
          <Pager page={page} pageCount={pageCount} total={total} onPage={setPage} pageSize={pageSize} onPageSize={setPageSize} noun="clearance" />
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
          campusName={campusNameOf(selected.campusKey)}
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