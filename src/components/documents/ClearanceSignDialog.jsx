/**
 * ClearanceSignDialog.jsx — ALMIRENE DX
 * One sign-off dialog shared by the Clearance page and the Document Requests
 * (drawer + Clearance tab), so the rules live in a single place.
 *
 *   - Signing goes through the clearance workflow (role, order, blocking rules).
 *   - Accounting signing with a balance owing, or a balance that cannot be found,
 *     must add a note. Every other sign-off is a plain confirmation.
 *   - The balance is read live every time the dialog opens.
 *
 * Render it only when a department is picked:
 *   {signDept && <ClearanceSignDialog clearance={c} deptId={signDept} user={user}
 *       onClose={() => setSignDept(null)} onSigned={...} onError={...} />}
 */

import { useState } from 'react'
import { X, AlertCircle } from 'lucide-react'
import { ConfirmDialog, ModalPortal } from '../UIComponents'
import {
  CLEARANCE_DEPARTMENTS, getClearanceBalance, signClearanceDepartment,
} from '../../utils/documentBridge'

function fmtPeso(n) {
  return `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function ClearanceSignDialog({ clearance, deptId, user, onClose, onSigned, onError }) {
  const [note, setNote] = useState('')

  const deptLabel = CLEARANCE_DEPARTMENTS.find(d => d.id === deptId)?.label ?? deptId
  const bal       = getClearanceBalance(clearance)
  const owing     = bal.found && bal.balance > 0
  const needsNote = deptId === 'accounting' && (owing || !bal.found)

  const sign = () => {
    if (needsNote && !note.trim()) return
    try {
      const fresh = signClearanceDepartment(clearance.id, deptId, note.trim(), user)
      onSigned?.(fresh, deptLabel)
    } catch (err) {
      onError?.(err.message)
    }
    onClose()
  }

  if (!needsNote) {
    return (
      <ConfirmDialog
        open
        title={`Sign ${deptLabel} Clearance`}
        message="This action is permanent and cannot be reversed. Once signed, it cannot be undone without Super Admin intervention. Are you sure?"
        confirmLabel="Sign Clearance"
        danger={false}
        onConfirm={sign}
        onCancel={onClose}
      />
    )
  }

  return (
    <ModalPortal onClose={onClose}>
      <div className="modal-backdrop">
        <div className="modal-panel" style={{ maxWidth: '28rem', maxHeight: '92dvh' }}>
          <div className="flex items-center justify-between p-5 border-b border-[var(--color-border)] shrink-0">
            <h3 className="text-base font-bold text-[var(--color-text-primary)]">
              Sign Accounting Clearance
            </h3>
            <button onClick={onClose} className="icon-btn-ghost" aria-label="Close">
              <X size={16} />
            </button>
          </div>

          <div className="p-5 space-y-3 flex-1 min-h-0 overflow-y-auto">
            <div className="flex items-start gap-2 p-3 rounded-xl bg-[var(--color-warning-light)] border border-[var(--color-warning-border)] text-xs text-[var(--color-text-secondary)]">
              <AlertCircle size={13} className="text-[var(--color-warning)] shrink-0 mt-0.5" />
              <span>
                {owing
                  ? <>{clearance.studentName} still owes <strong>{fmtPeso(bal.balance)}</strong>. Signing lets the clearance continue, and the balance stays on record. It must be paid before graduation.</>
                  : <>The balance for {clearance.studentName} could not be found. Verify it with the payment records, then explain in the note.</>}
              </span>
            </div>

            <div>
              <label className="text-label text-[var(--color-text-muted)] block mb-1.5">Note *</label>
              <textarea
                rows={3}
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="e.g. Approved by the principal — payment plan until December"
                className="w-full border border-[var(--color-border)] rounded-[var(--radius-md)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-border-focus)]"
              />
            </div>

            <p className="text-[11px] text-[var(--color-text-muted)]">
              This action is permanent and cannot be reversed.
            </p>
          </div>

          <div className="flex justify-end gap-2 p-5 border-t border-[var(--color-border)] shrink-0">
            <button onClick={onClose} className="btn btn-ghost text-sm">Cancel</button>
            <button onClick={sign} disabled={!note.trim()} className="btn btn-primary text-sm disabled:opacity-50">
              Sign Clearance
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}
