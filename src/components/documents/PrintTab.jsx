/**
 * PrintTab.jsx — ALMIRENE DX (Document Requests → Print)
 *
 * Lists the requests the registrar can print. Print opens the uploaded format
 * for that document type, already filled with the request's details.
 * No format for that document type → "No format uploaded" with a link to Formats.
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Search, Printer, X, AlertCircle, FileText } from 'lucide-react'
import { ModalPortal } from '../UIComponents'
import FilledPage from './FilledPage'
import { getTemplates, buildFieldValues, printFilledTemplate } from '../../utils/documentTemplates'
import { statusMatches } from '../../utils/documentBridge'

const fmtDate = (iso) => iso
  ? new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
  : '—'

function schoolNameFromSettings() {
  try { return JSON.parse(localStorage.getItem('almirene_website_content') || '{}').schoolName || '' }
  catch { return '' }
}

/**
 * Why a request can't be printed yet, or null when it can.
 * The request's own status decides, the same one the Requests tab shows:
 *  - Ready for Pickup / Released: it has already been through payment, so it prints
 *    (older records have no payment details saved, and must not be blocked by that).
 *  - For Payment: waits for accounting to confirm the payment.
 *  - Processing: prints only if the document is free.
 *  - Requested / Cancelled: not yet.
 */
export function printBlockReason(request) {
  const is = (id) => statusMatches(request.status, id)
  if (is('cancelled'))                      return 'Cancelled'
  if (is('ready_for_pickup') || is('released')) return null
  if (is('for_payment'))                    return request.payment ? null : 'Waiting for payment'
  if (is('processing'))                     return Number(request.fee) > 0 ? 'Waiting for payment' : null
  return 'Start processing first'
}
export const isPrintable = (request) => printBlockReason(request) === null

/**
 * The format + filled values for one request, or null when its document type has no format yet.
 * Shared by the Print tab and the request drawer.
 */
export function getPrintJob(request, campusKey, currentUser) {
  const dept = request.department === 'college' ? 'college' : 'basicEd'
  const template = getTemplates(campusKey, dept)[request.documentType] ?? null
  if (!template) return null
  const values = buildFieldValues(request, {
    schoolName: schoolNameFromSettings(),
    preparedBy: currentUser?.name || '',
  })
  return { request, template, values }
}

// ── Preview before printing ─────────────────────────────────────

export function PrintPreviewModal({ request, template, values, addToast, onClose }) {
  const onPrint = () => printFilledTemplate({
    template, values,
    title: `${request.documentLabel} — ${request.studentName}`,
    onBlocked: () => addToast?.('Your browser blocked the print window. Allow pop-ups for this site and try again.', 'error'),
  })
  return (
    <ModalPortal>
      <div className="modal-backdrop">
        <div className="modal-panel" style={{ maxWidth: '44rem' }}>
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[var(--color-border)]">
            <div className="min-w-0">
              <h2 className="text-base font-bold text-[var(--color-text-primary)] truncate">{request.documentLabel}</h2>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">{request.studentName}</p>
            </div>
            <button onClick={onClose} aria-label="Close" className="p-2 rounded-lg hover:bg-[var(--color-bg-subtle)] transition">
              <X size={16} className="text-[var(--color-text-muted)]" />
            </button>
          </div>
          <div className="p-4 sm:p-5 max-h-[72vh] overflow-y-auto">
            <FilledPage template={template} values={values} />
          </div>
          <div className="flex justify-end gap-2 p-4 sm:p-5 border-t border-[var(--color-border)]">
            <button onClick={onClose} className="btn btn-ghost text-sm">Close</button>
            <button onClick={onPrint} className="btn btn-primary text-sm gap-1.5">
              <Printer size={14} /> Print
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}

// ── Tab ─────────────────────────────────────────────────────────

/**
 * @param {Array}    requests      already scoped to this registrar's department
 * @param {function} renderStatus  (request) → status badge node (passed in to avoid a circular import)
 * @param {function} [onOpenFormats] switch to the Formats tab (only passed to the technical admin)
 */
export default function PrintTab({ requests, campusKey, currentUser, renderStatus, onOpenFormats, addToast }) {
  const [search, setSearch]   = useState('')
  const [tplBasic, setTplBasic] = useState({})
  const [tplCollege, setTplCollege] = useState({})
  const [preview, setPreview] = useState(null) // { request, template, values }

  const load = useCallback(() => {
    setTplBasic(getTemplates(campusKey, 'basicEd'))
    setTplCollege(getTemplates(campusKey, 'college'))
  }, [campusKey])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const h = () => load()
    window.addEventListener('almirene_document_templates_updated', h)
    return () => window.removeEventListener('almirene_document_templates_updated', h)
  }, [load])

  const templateFor = (r) => ((r.department === 'college' ? tplCollege : tplBasic)[r.documentType] ?? null)

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return requests
      .filter(r => r.status !== 'cancelled')
      .filter(r => !q || [r.studentName, r.studentId, r.documentLabel, r.purpose, r.payment?.orNumber]
        .some(v => String(v || '').toLowerCase().includes(q)))
  }, [requests, search])

  const open = (r) => {
    const job = getPrintJob(r, campusKey, currentUser)
    if (job) setPreview(job)
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search student, document, purpose or OR number…"
          className="w-full pl-9 pr-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition"
        />
      </div>

      {rows.length === 0 ? (
        <div className="p-10 text-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)]">
          <FileText size={28} className="mx-auto text-[var(--color-text-muted)] mb-2" />
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">Nothing to print</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">Requests you create appear here, ready to print.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map(r => {
            const hasFormat = !!templateFor(r)
            const printable = isPrintable(r)
            return (
              <div key={r.id} className="p-3 sm:p-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold text-[var(--color-text-primary)] truncate">{r.studentName}</p>
                    {renderStatus?.(r)}
                  </div>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 truncate">
                    {r.documentLabel}{r.purpose ? ` · ${r.purpose}` : ''}
                  </p>
                  <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                    Filed {fmtDate(r.createdAt)}{r.studentGrade ? ` · ${r.studentGrade}` : ''}
                  </p>
                </div>

                {!printable ? (
                  <p className="text-xs text-[var(--color-text-muted)] shrink-0">{printBlockReason(r)}</p>
                ) : hasFormat ? (
                  <button onClick={() => open(r)} className="btn btn-primary text-xs gap-1.5 shrink-0 self-start sm:self-center">
                    <Printer size={13} /> Print
                  </button>
                ) : (
                  <div className="flex items-center gap-2 shrink-0 text-xs text-[var(--color-text-muted)]">
                    <AlertCircle size={13} className="shrink-0" />
                    <span>No format uploaded{onOpenFormats ? '' : '. Ask the technical admin.'}</span>
                    {onOpenFormats && (
                      <button onClick={onOpenFormats} className="font-semibold text-[var(--color-primary-readable)] hover:underline">
                        Upload
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {preview && (
        <PrintPreviewModal
          request={preview.request}
          template={preview.template}
          values={preview.values}
          addToast={addToast}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  )
}
