/**
 * FormatsTab.jsx — ALMIRENE DX (Document Requests → Formats)
 *
 * The registrar uploads a PDF/image format for each document type, then places
 * the fields (student name, grade level, purpose, dates...) on it once.
 * Every request of that type is later filled in automatically from the Print tab.
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Upload, Pencil, Trash2, Undo2, ChevronDown, X, Plus, Minus, FileText, Check, AlertCircle, Loader2, Bold, AlignLeft, AlignCenter, AlignRight } from 'lucide-react'
import GroupedSelect from '../GroupedSelect'
import { ConfirmDialog, ModalPortal } from '../UIComponents'
import FilledPage from './FilledPage'
import {
  getDocumentTypes, addDocumentType, removeDocumentType, getRequests,
  getDeletedDocuments, restoreDocumentType, purgeDeletedDocument, setDocumentClearance,
} from '../../utils/documentBridge'
import {
  getTemplates, saveTemplate, removeTemplate, formatDepartmentsFor, sampleFieldValues,
} from '../../utils/documentTemplates'
import { fileToTemplateImage } from '../../utils/templateFiles'
import { DOCUMENT_FORMAT_FIELDS, DOCUMENT_FORMAT_LIMITS, DOCUMENT_TRASH_RETENTION_DAYS } from '../../config/appConfig'

const DEPT_LABEL = { basicEd: 'Basic Education', college: 'College' }
const FIELD_BY_KEY = Object.fromEntries(DOCUMENT_FORMAT_FIELDS.map(f => [f.key, f]))
const FIELD_GROUPS = (() => {
  const map = new Map()
  DOCUMENT_FORMAT_FIELDS.forEach(f => {
    if (!map.has(f.group)) map.set(f.group, [])
    map.get(f.group).push({ value: f.key, label: f.label })
  })
  return [...map.entries()].map(([label, options]) => ({ label, options }))
})()

const fmtWhen = (iso) => iso
  ? new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
  : ''

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))

// ─────────────────────────────────────────────────────────────────────────────
// EDITOR MODAL — place fields on the uploaded page
// ─────────────────────────────────────────────────────────────────────────────

function FormatEditorModal({ draft, docLabel, onSave, onClose, saving, error }) {
  const [page, setPage]       = useState(draft)       // image, size, fontFamily, fields
  const [selectedId, setSel]  = useState(draft.fields[0]?.id ?? null)
  const [showSample, setShowSample] = useState(true)
  const [dirty, setDirty]     = useState(!!draft.isNew)
  const [confirmClose, setConfirmClose] = useState(false)
  const pageElRef = useRef(null)
  const dragRef   = useRef(null)
  const samples   = useMemo(() => sampleFieldValues(), [])

  const selected = page.fields.find(f => f.id === selectedId) || null

  const patchField = useCallback((id, patch) => {
    setPage(p => ({ ...p, fields: p.fields.map(f => f.id === id ? { ...f, ...patch } : f) }))
    setDirty(true)
  }, [])

  const addField = (key) => {
    if (!key || key === 'all') return
    const n = page.fields.length
    const id = `f_${Date.now().toString(36)}_${n}`
    const field = { id, key, x: 0.25, y: clamp(0.2 + n * 0.05, 0.05, 0.95), w: 0.4, fontPt: 12, bold: false, align: 'left' }
    setPage(p => ({ ...p, fields: [...p.fields, field] }))
    setSel(id)
    setDirty(true)
  }

  const removeField = (id) => {
    setPage(p => ({ ...p, fields: p.fields.filter(f => f.id !== id) }))
    setSel(null)
    setDirty(true)
  }

  // ── drag (pointer events work for mouse, pen and touch) ──
  const onChipPointerDown = (e, f) => {
    e.stopPropagation()
    setSel(f.id)
    const rect = pageElRef.current?.getBoundingClientRect()
    if (!rect) return
    dragRef.current = { id: f.id, startX: e.clientX, startY: e.clientY, x: f.x, y: f.y, w: f.w, rect }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const onChipPointerMove = (e) => {
    const d = dragRef.current
    if (!d) return
    const nx = clamp(d.x + (e.clientX - d.startX) / d.rect.width, 0, 1 - Math.min(d.w, 0.98))
    const ny = clamp(d.y + (e.clientY - d.startY) / d.rect.height, 0, 1)
    patchField(d.id, { x: nx, y: ny })
  }
  const onChipPointerUp = () => { dragRef.current = null }

  const onChipKeyDown = (e, f) => {
    const step = e.shiftKey ? 0.01 : 0.002
    const move = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key]
    if (move) {
      e.preventDefault()
      patchField(f.id, { x: clamp(f.x + move[0], 0, 1 - Math.min(f.w, 0.98)), y: clamp(f.y + move[1], 0, 1) })
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      removeField(f.id)
    }
  }

  const renderField = (f, style) => {
    const isSel = f.id === selectedId
    const label = FIELD_BY_KEY[f.key]?.label ?? f.key
    const text  = showSample ? (samples[f.key] || label) : label
    return (
      <button
        key={f.id}
        type="button"
        onPointerDown={e => onChipPointerDown(e, f)}
        onPointerMove={onChipPointerMove}
        onPointerUp={onChipPointerUp}
        onPointerCancel={onChipPointerUp}
        onKeyDown={e => onChipKeyDown(e, f)}
        onFocus={() => setSel(f.id)}
        aria-label={`${label} field. Drag or use arrow keys to move.`}
        className="cursor-grab active:cursor-grabbing"
        style={{
          ...style,
          touchAction: 'none',
          background: isSel ? 'color-mix(in srgb, var(--color-action) 15%, transparent)' : 'transparent',
          outline: `${isSel ? 2 : 1}px ${isSel ? 'solid' : 'dashed'} var(--color-action)`,
          outlineOffset: '1px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          padding: 0,
        }}
      >
        {text}
      </button>
    )
  }

  const requestClose = () => (dirty ? setConfirmClose(true) : onClose())

  const submit = () => onSave({
    image: page.image, pageWidthPt: page.pageWidthPt, pageHeightPt: page.pageHeightPt,
    fileName: page.fileName, fontFamily: page.fontFamily, fields: page.fields,
  })

  return (
    <ModalPortal>
      <div className="modal-backdrop">
        <div className="modal-panel" style={{ maxWidth: '72rem' }}>
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[var(--color-border)]">
            <div className="min-w-0">
              <h2 className="text-base font-bold text-[var(--color-text-primary)] truncate">{docLabel} format</h2>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">
                {page.fileName || 'Uploaded file'} · add the fields, then drag each one onto its blank space
              </p>
            </div>
            <button onClick={requestClose} aria-label="Close" className="p-2 rounded-lg hover:bg-[var(--color-bg-subtle)] transition">
              <X size={16} className="text-[var(--color-text-muted)]" />
            </button>
          </div>

          <div className="p-4 sm:p-5 max-h-[72vh] overflow-y-auto">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
              {/* Page */}
              <div className="min-w-0">
                <FilledPage
                  template={page}
                  renderField={renderField}
                  onPageRef={el => { pageElRef.current = el }}
                  onPagePointerDown={() => setSel(null)}
                />
              </div>

              {/* Controls */}
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">Add a field</label>
                  <GroupedSelect
                    value="all"
                    onChange={addField}
                    placeholder="Choose what to place…"
                    allLabel="Choose what to place…"
                    groups={FIELD_GROUPS}
                  />
                  <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                    The same field can be added more than once, for example the name on two lines.
                  </p>
                </div>

                <div className="flex gap-2">
                  {[['serif', 'Serif'], ['sans', 'Sans']].map(([id, label]) => (
                    <button key={id} type="button"
                      onClick={() => { setPage(p => ({ ...p, fontFamily: id })); setDirty(true) }}
                      className={`flex-1 py-2 text-xs rounded-xl border transition-colors font-medium
                        ${page.fontFamily === id ? 'is-selected' : 'border-[var(--color-border)] text-[var(--color-text-secondary)]'}`}>
                      {label} font
                    </button>
                  ))}
                </div>

                <button type="button" onClick={() => setShowSample(s => !s)}
                  className={`w-full py-2 text-xs rounded-xl border transition-colors font-medium
                    ${showSample ? 'is-selected' : 'border-[var(--color-border)] text-[var(--color-text-secondary)]'}`}>
                  {showSample ? 'Showing sample data' : 'Showing field names'}
                </button>

                {selected ? (
                  <div className="p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)] space-y-3">
                    <p className="text-xs font-bold text-[var(--color-text-primary)]">
                      {FIELD_BY_KEY[selected.key]?.label}
                    </p>

                    <div>
                      <span className="text-[11px] font-semibold text-[var(--color-text-secondary)] block mb-1">Text size</span>
                      <div className="flex items-center gap-2">
                        <button type="button" aria-label="Smaller"
                          onClick={() => patchField(selected.id, { fontPt: clamp(selected.fontPt - 1, 6, 72) })}
                          className="btn btn-ghost p-2"><Minus size={14} /></button>
                        <span className="flex-1 text-center text-sm font-semibold text-[var(--color-text-primary)]">{selected.fontPt} pt</span>
                        <button type="button" aria-label="Larger"
                          onClick={() => patchField(selected.id, { fontPt: clamp(selected.fontPt + 1, 6, 72) })}
                          className="btn btn-ghost p-2"><Plus size={14} /></button>
                      </div>
                    </div>

                    <div>
                      <span className="text-[11px] font-semibold text-[var(--color-text-secondary)] block mb-1">Width</span>
                      <input type="range" min="5" max="100" step="1"
                        value={Math.round(selected.w * 100)}
                        onChange={e => patchField(selected.id, { w: Number(e.target.value) / 100 })}
                        className="w-full" aria-label="Field width" />
                    </div>

                    <div className="flex gap-2">
                      <button type="button" aria-label="Bold" onClick={() => patchField(selected.id, { bold: !selected.bold })}
                        className={`p-2 rounded-xl border transition-colors ${selected.bold ? 'is-selected' : 'border-[var(--color-border)] text-[var(--color-text-secondary)]'}`}>
                        <Bold size={14} />
                      </button>
                      {[['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]].map(([id, Icon]) => (
                        <button key={id} type="button" aria-label={`Align ${id}`} onClick={() => patchField(selected.id, { align: id })}
                          className={`p-2 rounded-xl border transition-colors ${selected.align === id ? 'is-selected' : 'border-[var(--color-border)] text-[var(--color-text-secondary)]'}`}>
                          <Icon size={14} />
                        </button>
                      ))}
                      <button type="button" aria-label="Remove field" onClick={() => removeField(selected.id)}
                        className="ml-auto p-2 rounded-xl border border-[var(--color-border)] text-[var(--color-error-text)] hover:bg-[var(--color-error-light)] transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {page.fields.length === 0
                      ? 'No fields yet. Add one above, then drag it onto the page.'
                      : 'Tap a field on the page to change its size, width or alignment.'}
                  </p>
                )}

                {error && (
                  <div className="flex items-start gap-2 p-3 bg-[var(--color-error-light)] border border-[var(--color-error-border)] rounded-xl text-xs text-[var(--color-error-text)]">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" /> {error}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 p-4 sm:p-5 border-t border-[var(--color-border)]">
            <button onClick={requestClose} className="btn btn-ghost text-sm">Cancel</button>
            <button onClick={submit} disabled={saving || page.fields.length === 0}
              className="btn btn-primary text-sm gap-1.5 disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save format
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmClose}
        title="Discard your changes?"
        message="The fields you placed on this format have not been saved."
        confirmLabel="Discard"
        danger
        onConfirm={() => { setConfirmClose(false); onClose() }}
        onCancel={() => setConfirmClose(false)}
      />
    </ModalPortal>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ADD DOCUMENT MODAL — the school adds a document of its own
// ─────────────────────────────────────────────────────────────────────────────

function AddDocumentModal({ departmentLabel, onAdd, onClose }) {
  const [label, setLabel] = useState('')
  const [requiresClearance, setRequiresClearance] = useState(false)
  const [error, setError] = useState('')

  const submit = (e) => {
    e?.preventDefault()
    if (!label.trim()) { setError('Enter the document name.'); return }
    try { onAdd({ label, requiresClearance }) }
    catch (err) { setError(err.message || 'Could not add the document.') }
  }

  return (
    <ModalPortal>
      <div className="modal-backdrop">
        <form className="modal-panel" style={{ maxWidth: '26rem' }} onSubmit={submit}>
          <div className="flex items-center justify-between p-5 border-b border-[var(--color-border)]">
            <div>
              <h2 className="text-base font-bold text-[var(--color-text-primary)]">Add a document</h2>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{departmentLabel}</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="p-2 rounded-lg hover:bg-[var(--color-bg-subtle)] transition">
              <X size={16} className="text-[var(--color-text-muted)]" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            <div>
              <label className="text-xs font-semibold text-[var(--color-text-secondary)] block mb-1">Document name *</label>
              <input
                autoFocus
                value={label}
                maxLength={60}
                onChange={e => { setLabel(e.target.value); setError('') }}
                placeholder="e.g. Certificate of Indigency"
                className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition"
              />
            </div>

            <button type="button" onClick={() => setRequiresClearance(v => !v)} aria-pressed={requiresClearance}
              className={`w-full flex items-center justify-between gap-3 p-3 rounded-xl border text-left transition-colors
                ${requiresClearance ? 'is-selected' : 'border-[var(--color-border)] text-[var(--color-text-secondary)]'}`}>
              <span>
                <span className="block text-sm font-semibold">Requires clearance</span>
                <span className="block text-xs opacity-80">The student must be cleared by every department before release.</span>
              </span>
              {requiresClearance && <Check size={16} className="shrink-0" />}
            </button>

            <p className="text-xs text-[var(--color-text-muted)]">
              The price is set by accounting on the Fees tab. Until then this document is free. After adding it, upload its format and place the fields.
            </p>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-[var(--color-error-light)] border border-[var(--color-error-border)] rounded-xl text-xs text-[var(--color-error-text)]">
                <AlertCircle size={14} className="shrink-0 mt-0.5" /> {error}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 p-5 border-t border-[var(--color-border)]">
            <button type="button" onClick={onClose} className="btn btn-ghost text-sm">Cancel</button>
            <button type="submit" disabled={!label.trim()} className="btn btn-primary text-sm gap-1.5 disabled:opacity-50">
              <Plus size={14} /> Add document
            </button>
          </div>
        </form>
      </div>
    </ModalPortal>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// RESTORE WITH A NEW NAME — when the deleted document's name is now taken
// ─────────────────────────────────────────────────────────────────────────────

function RestoreRenameModal({ doc, onRestore, onClose }) {
  const [label, setLabel] = useState(doc.label)
  const [error, setError] = useState('')

  const submit = (e) => {
    e?.preventDefault()
    try { onRestore(label) }
    catch (err) { setError(err.message || 'Could not restore the document.') }
  }

  return (
    <ModalPortal>
      <div className="modal-backdrop">
        <form className="modal-panel" style={{ maxWidth: '26rem' }} onSubmit={submit}>
          <div className="p-5 border-b border-[var(--color-border)]">
            <h2 className="text-base font-bold text-[var(--color-text-primary)]">Choose another name</h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              A document named "{doc.label}" already exists. Give the restored one a different name.
            </p>
          </div>
          <div className="p-5 space-y-3">
            <input
              autoFocus
              value={label}
              maxLength={60}
              onChange={e => { setLabel(e.target.value); setError('') }}
              className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition"
            />
            {error && (
              <div className="flex items-start gap-2 p-3 bg-[var(--color-error-light)] border border-[var(--color-error-border)] rounded-xl text-xs text-[var(--color-error-text)]">
                <AlertCircle size={14} className="shrink-0 mt-0.5" /> {error}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 p-5 border-t border-[var(--color-border)]">
            <button type="button" onClick={onClose} className="btn btn-ghost text-sm">Cancel</button>
            <button type="submit" disabled={!label.trim()} className="btn btn-primary text-sm gap-1.5 disabled:opacity-50">
              <Undo2 size={14} /> Restore
            </button>
          </div>
        </form>
      </div>
    </ModalPortal>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FORMATS TAB
// ─────────────────────────────────────────────────────────────────────────────

export default function FormatsTab({ campusKey, currentUser, addToast }) {
  const departments = formatDepartmentsFor(currentUser)
  const [department, setDepartment] = useState(departments[0] || 'basicEd')
  const [templates, setTemplates]   = useState({})
  const [types, setTypes]           = useState([])
  const [busyId, setBusyId]         = useState(null)   // document type being read
  const [editing, setEditing]       = useState(null)   // { docType, draft }
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')
  const [toRemove, setToRemove]     = useState(null)
  const [showAdd, setShowAdd]       = useState(false)
  const [toDelete, setToDelete]     = useState(null)   // a document the user wants to delete
  const [deleted, setDeleted]       = useState([])     // deleted documents that can still be restored
  const [showDeleted, setShowDeleted] = useState(false)
  const [renaming, setRenaming]     = useState(null)   // deleted document whose name is now taken
  const [toPurge, setToPurge]       = useState(null)   // deleted document to remove for good
  const fileRef   = useRef(null)
  const uploadFor = useRef(null)                        // { docType, keepFields }

  const load = useCallback(() => {
    setTemplates(getTemplates(campusKey, department))
    setTypes(getDocumentTypes(campusKey, department))
    setDeleted(getDeletedDocuments(campusKey, department))
  }, [campusKey, department])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const h = () => load()
    window.addEventListener('almirene_document_templates_updated', h)
    window.addEventListener('almirene_document_catalog_updated', h)
    return () => {
      window.removeEventListener('almirene_document_templates_updated', h)
      window.removeEventListener('almirene_document_catalog_updated', h)
    }
  }, [load])

  const pickFile = (docType, keepFields) => {
    uploadFor.current = { docType, keepFields }
    fileRef.current?.click()
  }

  const onFileChosen = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    const target = uploadFor.current
    if (!file || !target) return
    setBusyId(target.docType.id)
    try {
      const res = await fileToTemplateImage(file)
      const existing = templates[target.docType.id]
      setError('')
      setEditing({
        docType: target.docType,
        draft: {
          image: res.image, pageWidthPt: res.pageWidthPt, pageHeightPt: res.pageHeightPt,
          fileName: res.fileName,
          fontFamily: existing?.fontFamily || 'serif',
          fields: target.keepFields && existing ? existing.fields : [],
          isNew: true,
        },
      })
      if (res.pages > 1) addToast?.(`This PDF has ${res.pages} pages. Only page 1 is used.`, 'info')
    } catch (err) {
      addToast?.(err.message || 'The file could not be used.', 'error')
    } finally {
      setBusyId(null)
    }
  }

  const openEditor = (docType) => {
    const t = templates[docType.id]
    if (!t) return
    setError('')
    setEditing({ docType, draft: { ...t, isNew: false } })
  }

  const handleSave = (page) => {
    setSaving(true)
    setError('')
    try {
      saveTemplate({
        campusKey, department,
        documentType: editing.docType.id,
        documentLabel: editing.docType.label,
        ...page,
      }, currentUser)
      addToast?.(`${editing.docType.label} format saved.`, 'success')
      setEditing(null)
      load()
    } catch (err) {
      setError(err.message || 'Could not save the format.')
    } finally {
      setSaving(false)
    }
  }

  const handleAddDocument = (data) => {
    const created = addDocumentType(campusKey, department, data, currentUser)   // throws a readable message
    setShowAdd(false)
    load()
    addToast?.(`${created.label} added. Upload its format below.`, 'success')
  }

  // How many filed requests are for the document being deleted (they stay, as history)
  const requestsFor = (t) => {
    try { return getRequests({ campusKey }).filter(r => r.documentType === t.id).length }
    catch { return 0 }
  }

  const handleClearance = (t) => {
    try {
      setDocumentClearance(campusKey, department, t.id, !t.requiresClearance, currentUser)
      load()
    } catch (err) {
      addToast?.(err.message || 'Could not change the clearance rule.', 'error')
    }
  }

  const handleDeleteDocument = () => {
    try {
      // The format travels with the document into "Deleted documents", so a restore brings it back
      removeDocumentType(campusKey, department, toDelete.id, currentUser, { template: templates[toDelete.id] ?? null })
      removeTemplate(campusKey, department, toDelete.id, currentUser)
      addToast?.(`${toDelete.label} deleted. You can restore it for ${DOCUMENT_TRASH_RETENTION_DAYS} days.`, 'success')
      load()
    } catch (err) {
      addToast?.(err.message || 'Could not delete the document.', 'error')
    }
    setToDelete(null)
  }

  const handleRestore = (doc, newLabel) => {
    const { type, template } = restoreDocumentType(campusKey, department, doc.id, currentUser, newLabel)   // throws a readable message
    setRenaming(null)
    let note = ''
    if (template) {
      try {
        saveTemplate({ ...template, campusKey, department, documentType: type.id, documentLabel: type.label }, currentUser)
      } catch {
        note = ' Its uploaded format could not be restored (storage is full). Upload it again.'
      }
    }
    load()
    addToast?.(`${type.label} restored.${note}`, note ? 'info' : 'success')
  }

  const tryRestore = (doc) => {
    try { handleRestore(doc) }
    catch (err) {
      if (err.code === 'NAME_IN_USE') setRenaming(doc)
      else addToast?.(err.message || 'Could not restore the document.', 'error')
    }
  }

  const handlePurge = () => {
    try {
      purgeDeletedDocument(campusKey, department, toPurge.id, currentUser)
      addToast?.(`${toPurge.label} removed for good.`, 'success')
      load()
    } catch (err) {
      addToast?.(err.message || 'Could not remove the document.', 'error')
    }
    setToPurge(null)
  }

  const handleRemove = () => {
    try {
      removeTemplate(campusKey, department, toRemove.id, currentUser)
      addToast?.(`${toRemove.label} format removed.`, 'success')
      load()
    } catch (err) {
      addToast?.(err.message, 'error')
    }
    setToRemove(null)
  }

  if (departments.length === 0) return null

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm text-[var(--color-text-muted)] max-w-xl">
          Upload your school's own PDF for each document, then place the fields once. After that, every request is filled in automatically and ready to print.
        </p>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {departments.length > 1 && (
            <div className="flex gap-1 p-1 bg-[var(--color-bg-subtle)] rounded-xl w-fit">
              {departments.map(d => (
                <button key={d} onClick={() => setDepartment(d)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                    ${department === d ? 'is-selected shadow-sm' : 'text-[var(--color-text-muted)]'}`}>
                  {DEPT_LABEL[d]}
                </button>
              ))}
            </div>
          )}
          <button onClick={() => setShowAdd(true)} className="btn btn-primary text-sm gap-1.5">
            <Plus size={14} /> Add document
          </button>
        </div>
      </div>

      <input ref={fileRef} type="file" accept="application/pdf,image/png,image/jpeg,image/webp"
        className="hidden" onChange={onFileChosen} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {types.map(t => {
          const tpl  = templates[t.id]
          const busy = busyId === t.id
          return (
            <div key={t.id} className="p-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="w-14 h-[4.5rem] shrink-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-subtle)] overflow-hidden flex items-center justify-center">
                  {tpl
                    ? <img src={tpl.image} alt="" className="w-full h-full object-cover object-top" />
                    : <FileText size={20} className="text-[var(--color-text-muted)]" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[var(--color-text-primary)] truncate">{t.label}</p>
                  {tpl ? (
                    <>
                      <p className="text-xs text-[var(--color-success-text)] font-medium mt-0.5">
                        Format ready · {tpl.fields.length} field{tpl.fields.length !== 1 ? 's' : ''}
                      </p>
                      <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5 truncate">
                        {tpl.fileName} · {fmtWhen(tpl.updatedAt)}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">No format uploaded yet</p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-auto">
                {tpl ? (
                  <>
                    <button onClick={() => openEditor(t)} className="btn btn-primary text-xs gap-1.5">
                      <Pencil size={13} /> Edit fields
                    </button>
                    <button onClick={() => pickFile(t, false)} disabled={busy} className="btn btn-ghost text-xs gap-1.5">
                      {busy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} Replace file
                    </button>
                    <button onClick={() => setToRemove(t)} aria-label={`Remove the uploaded format of ${t.label}`} title="Remove the uploaded file (keeps the document)" className="btn btn-ghost text-xs p-2 ml-auto">
                      <Trash2 size={13} />
                    </button>
                  </>
                ) : (
                  <button onClick={() => pickFile(t, false)} disabled={busy} className="btn btn-primary text-xs gap-1.5">
                    {busy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} Upload format
                  </button>
                )}
              </div>

              {/* The registrar decides whether this document needs the student's clearance */}
              <button type="button" onClick={() => handleClearance(t)} aria-pressed={!!t.requiresClearance}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-colors
                  ${t.requiresClearance ? 'is-selected' : 'border-[var(--color-border)] text-[var(--color-text-secondary)]'}`}>
                <span>Requires clearance</span>
                <span>{t.requiresClearance ? 'Yes' : 'No'}</span>
              </button>

              {/* Any document can be deleted, for a school that does not issue it */}
              <button onClick={() => setToDelete(t)}
                className="self-start inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-error-text)] hover:underline">
                <Trash2 size={12} /> Delete document
              </button>
            </div>
          )
        })}

        <button onClick={() => setShowAdd(true)}
          className="p-4 rounded-2xl border border-dashed border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-primary-readable)] transition-colors flex items-center justify-center gap-2 min-h-[7rem] text-sm font-medium">
          <Plus size={16} /> Add another document
        </button>
      </div>

      {deleted.length > 0 && (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)]">
          <button onClick={() => setShowDeleted(v => !v)} aria-expanded={showDeleted}
            className="w-full flex items-center justify-between gap-3 p-4 text-left">
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">
              Deleted documents ({deleted.length})
            </span>
            <ChevronDown size={16} className={`text-[var(--color-text-muted)] transition-transform ${showDeleted ? 'rotate-180' : ''}`} />
          </button>

          {showDeleted && (
            <div className="border-t border-[var(--color-border)] divide-y divide-[var(--color-border)]">
              <p className="px-4 py-3 text-xs text-[var(--color-text-muted)]">
                Restore brings back the document with its price, clearance setting and uploaded format. After {DOCUMENT_TRASH_RETENTION_DAYS} days a deleted document is removed for good.
              </p>
              {deleted.map(d => (
                <div key={d.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{d.label}</p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      Deleted {fmtWhen(d.deletedAt)}{d.deletedBy ? ` by ${d.deletedBy}` : ''} · removed for good in {d.daysLeft} day{d.daysLeft !== 1 ? 's' : ''}
                      {d.hasFormat ? ' · has an uploaded format' : ''}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0 [&>button]:flex-1 sm:[&>button]:flex-none">
                    <button onClick={() => tryRestore(d)} className="btn btn-primary text-xs gap-1.5 justify-center">
                      <Undo2 size={13} /> Restore
                    </button>
                    <button onClick={() => setToPurge(d)} className="btn btn-ghost text-xs gap-1.5 justify-center text-[var(--color-error-text)]">
                      <Trash2 size={13} /> Delete for good
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <p className="text-[11px] text-[var(--color-text-muted)]">
        PDF, PNG, JPG or WebP up to {DOCUMENT_FORMAT_LIMITS.maxFileMB} MB. Only the first page of a PDF is used.
      </p>

      {showAdd && (
        <AddDocumentModal
          departmentLabel={DEPT_LABEL[department]}
          onAdd={handleAddDocument}
          onClose={() => setShowAdd(false)}
        />
      )}

      {editing && (
        <FormatEditorModal
          key={editing.docType.id}
          draft={editing.draft}
          docLabel={editing.docType.label}
          saving={saving}
          error={error}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Delete this document?"
        message={toDelete
          ? `"${toDelete.label}" will be removed from the document list. You can restore it from "Deleted documents" for ${DOCUMENT_TRASH_RETENTION_DAYS} days, with its price and uploaded format.`
            + (requestsFor(toDelete) > 0 ? ` ${requestsFor(toDelete)} request${requestsFor(toDelete) !== 1 ? 's' : ''} already filed for it will stay in the list as history.` : '')
          : ''}
        confirmLabel="Delete document"
        danger
        onConfirm={handleDeleteDocument}
        onCancel={() => setToDelete(null)}
      />

      <ConfirmDialog
        open={!!toPurge}
        title="Delete for good?"
        message={toPurge ? `"${toPurge.label}" and its uploaded format will be removed permanently. This cannot be undone.` : ''}
        confirmLabel="Delete for good"
        danger
        onConfirm={handlePurge}
        onCancel={() => setToPurge(null)}
      />

      {renaming && (
        <RestoreRenameModal
          doc={renaming}
          onRestore={(label) => handleRestore(renaming, label)}
          onClose={() => setRenaming(null)}
        />
      )}

      <ConfirmDialog
        open={!!toRemove}
        title="Remove this format?"
        message={toRemove ? `${toRemove.label} will have no format until you upload a new one. Requests are not affected.` : ''}
        confirmLabel="Remove"
        danger
        onConfirm={handleRemove}
        onCancel={() => setToRemove(null)}
      />
    </div>
  )
}
