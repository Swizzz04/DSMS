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
 * Campus:
 *   - A campus user (user.campusKey) works in their own campus — always.
 *   - Admin / technical admin follow the header Campus menu (useCampusFilter).
 *     "All Campuses" lists every campus; New Clearance then asks which campus.
 *   - campusKey ('Carcar') is what records store and filter on; the display name
 *     ('Carcar City Campus') comes from activeCampuses and is only for the screen.
 *
 * Refresh: same-window changes arrive as 'almirene_clearance_updated'; changes made in
 * ANOTHER window/tab arrive as the browser 'storage' event (clearance, payments, students).
 *
 * Bridge: src/utils/documentBridge.js (getClearances, updateDepartmentClearance, etc.)
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ShieldCheck, Shield, Clock, CheckCircle, AlertCircle,
  Search, ChevronRight, X, Info, User, Building2,
  Filter, Eye, CreditCard, BookOpen, Users, Plus, RefreshCw,
} from 'lucide-react'
import { useAuth }      from '../context/AuthContext'
import { useAppConfig } from '../context/AppConfigContext'
import { useCampusFilter } from '../context/CampusFilterContext'
import GroupedSelect from '../components/GroupedSelect'
import { SortTh, Pager, useTablePaging } from '../components/DataTable'
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

/** Storage keys that change what this page shows (clearances, live balances, student records). */
const WATCHED_STORAGE_KEYS = ['almirene_clearance', 'almirene_submissions', 'almirene_students']

function fmtPeso(n) {
  return `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function getProgressPct(clearance) {
  return Math.round((getClearedCount(clearance) / CLEARANCE_DEPARTMENTS.length) * 100)
}

/** Column sorters for the list (module-level so their identity never changes). */
const CLEARANCE_SORTERS = {
  student:   (a, b) => (a.studentName || '').localeCompare(b.studentName || ''),
  reason:    (a, b) => (a.reason || '').localeCompare(b.reason || ''),
  progress:  (a, b) => getClearedCount(a) - getClearedCount(b),
  requested: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
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

function ClearanceDrawer({ clearance, campusName, currentUser, onUpdate, onClose }) {
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

/** One department's sign-off as a round check / clock — a column cell in the table. */
function DeptCell({ deptId, info }) {
  const dept    = CLEARANCE_DEPARTMENTS.find(d => d.id === deptId)
  const cleared = info?.cleared === true
  return (
    <span
      title={`${dept?.label}: ${cleared ? `Cleared by ${info.clearedBy}` : 'Pending'}`}
      className={`inline-flex items-center justify-center w-6 h-6 rounded-full border
        ${cleared
          ? 'bg-[var(--color-success-light)] text-[var(--color-success)] border-[var(--color-success-border)]'
          : 'bg-[var(--color-bg-muted)] text-[var(--color-text-muted)] border-[var(--color-border)]'}`}
    >
      {cleared ? <CheckCircle size={13} /> : <Clock size={12} />}
      <span className="sr-only">{dept?.label}: {cleared ? 'cleared' : 'pending'}</span>
    </span>
  )
}

/** Progress as "3/5" with a thin bar. */
function ProgressCell({ clearance }) {
  const pct      = getProgressPct(clearance)
  const clearedN = getClearedCount(clearance)
  return (
    <div className="flex items-center gap-2">
      <div className="hidden 2xl:block h-1.5 w-12 bg-[var(--color-bg-subtle)] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            backgroundColor: clearance.isFullyCleared
              ? 'var(--color-success)'
              : pct >= 60 ? 'var(--color-warning)' : 'var(--color-primary)',
          }}
        />
      </div>
      <span className="text-xs font-semibold text-[var(--color-text-muted)] tabular-nums">
        {clearedN}/{CLEARANCE_DEPARTMENTS.length}
      </span>
    </div>
  )
}

function ClearanceTable({ rows, studentMap, signMap, showCampus, campusNameOf, sort, onSort, onSelect }) {
  return (
    <div className="hidden md:block overflow-x-auto">
      <table className="w-full [&_th]:!px-3 [&_td]:!px-3">
        <thead className="bg-[var(--color-bg-subtle)]">
          <tr>
            <SortTh label="Student" sortKey="student" sort={sort} onSort={onSort} />
            <SortTh label="Reason" sortKey="reason" sort={sort} onSort={onSort} />
            {showCampus && <th scope="col" className="th">Campus</th>}
            {CLEARANCE_DEPARTMENTS.map(d => {
              const Icon = DEPT_ICONS[d.id] ?? Shield
              return (
                <th key={d.id} scope="col" className="th text-center !px-2" title={d.label}>
                  <span className="inline-flex items-center gap-1">
                    <Icon size={14} />
                    <span className="hidden 2xl:inline">{d.label}</span>
                    <span className="2xl:hidden sr-only">{d.label}</span>
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
                {CLEARANCE_DEPARTMENTS.map(d => (
                  <td key={d.id} className="td text-center !px-2">
                    <DeptCell deptId={d.id} info={c.departments[d.id]} />
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
function ClearanceMobileList({ rows, studentMap, signMap, showCampus, campusNameOf, onSelect }) {
  return (
    <ul className="md:hidden divide-y divide-[var(--color-border)]">
      {rows.map(c => {
        const st          = studentMap.get(c.studentId)
        const needsMySign = signMap.get(c.id) === true
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
                <div className="flex gap-1">
                  {CLEARANCE_DEPARTMENTS.map(d => (
                    <DeptChip key={d.id} deptId={d.id} info={c.departments[d.id]} compact />
                  ))}
                </div>
                <span className="text-[10px] text-[var(--color-text-muted)] font-semibold tabular-nums">
                  {getClearedCount(c)}/{CLEARANCE_DEPARTMENTS.length}
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
  const [waitFilter,   setWaitFilter]   = useState('all')      // a department id, or 'all'
  const { toasts, addToast, removeToast } = useToast()

  const loadData = useCallback(() => {
    try {
      // An empty campusKey means "All Campuses" — getClearances skips the campus filter
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
    const onStorage = (e) => {
      if (e.key === null || WATCHED_STORAGE_KEYS.includes(e.key)) refresh()
    }
    window.addEventListener('almirene_clearance_updated', refresh)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('almirene_clearance_updated', refresh)
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

  const waitOptions = CLEARANCE_DEPARTMENTS.map(d => ({ value: d.id, label: d.label }))

  // Apply filters + search
  const filtered = useMemo(() => {
    let list = clearances

    if (filter === 'pending')       list = list.filter(c => !c.isFullyCleared)
    else if (filter === 'cleared')  list = list.filter(c => c.isFullyCleared)
    else if (filter === 'needs-me' && showMine) list = list.filter(c => signMap.get(c.id))

    if (waitFilter !== 'all')   list = list.filter(c => getClearanceWaitingOn(c).some(d => d.id === waitFilter))

    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(c =>
        c.studentName?.toLowerCase().includes(q) ||
        c.reason?.toLowerCase().includes(q) ||
        String(studentMap.get(c.studentId)?.studentId || '').toLowerCase().includes(q)
      )
    }

    return list
  }, [clearances, filter, waitFilter, search, showMine, signMap, studentMap])

  // Sort + page the filtered list (back to page 1 when the filters, search or campus change)
  const { rows, sort, onSort, page, pageCount, total, setPage, pageSize, setPageSize } = useTablePaging(filtered, {
    sorters:     CLEARANCE_SORTERS,
    defaultSort: { key: 'requested', dir: 'desc' },
    descFirst:   ['requested', 'progress'],
    resetOn:     [filter, waitFilter, search, campusKey],
  })

  const filterOptions = [
    { id: 'all',     label: `All (${clearances.length})` },
    { id: 'pending', label: `Pending (${clearances.filter(c => !c.isFullyCleared).length})` },
    { id: 'cleared', label: `Cleared (${clearances.filter(c => c.isFullyCleared).length})` },
    ...(showMine ? [{ id: 'needs-me', label: `Needs My Sign (${needsMeCount})` }] : []),
  ]
  const hasExtraFilters = waitFilter !== 'all' || search.trim() !== ''
  const clearExtraFilters = () => { setWaitFilter('all'); setSearch('') }

  if (loading) return <PageSkeleton />

  return (
    <div className="page-enter space-y-5">
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="text-display text-[var(--color-text-primary)]">Student Clearance</h1>
          <p className="text-body text-[var(--color-text-muted)] mt-1">
            {schoolYear} · {campusName}
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
          <GroupedSelect
            value={waitFilter}
            onChange={setWaitFilter}
            allLabel="Any department"
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
                  ? 'All clearances in your department are signed.'
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