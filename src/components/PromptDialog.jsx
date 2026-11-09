/**
 * PromptDialog.jsx — asks for one line of text. Replaces window.prompt().
 *
 * The page keeps the open/closed state; this component keeps the typed value.
 * Enter confirms (it is the primary button), Esc cancels, and the text is checked before it is
 * accepted: empty is never allowed, and `validate` can add its own rule (for example "name
 * already used").
 *
 *   <PromptDialog
 *     open={dialog.open}
 *     title="Duplicate framework"
 *     message="Name the copy. You can edit its weights before saving."
 *     label="Framework name"
 *     initialValue="DepEd (Copy)"
 *     confirmLabel="Duplicate"
 *     validate={name => taken(name) ? 'That name is already used.' : ''}
 *     onConfirm={name => { ...; close() }}
 *     onCancel={close}
 *   />
 *
 * @param {boolean}  open
 * @param {string}   title
 * @param {string}   [message]
 * @param {string}   [label]         label above the input
 * @param {string}   [initialValue]  value when the dialog opens
 * @param {string}   [placeholder]
 * @param {string}   [confirmLabel]
 * @param {function} [validate]      (trimmedValue) => error message, or '' when fine
 * @param {function} onConfirm       (trimmedValue) => void
 * @param {function} onCancel
 */
import { useState, useEffect, useRef } from 'react'
import { ModalPortal } from './UIComponents'

export default function PromptDialog({
  open, title, message, label, initialValue = '', placeholder = '',
  confirmLabel = 'OK', validate, onConfirm, onCancel,
}) {
  if (!open) return null
  return (
    <PromptDialogBody
      title={title} message={message} label={label} initialValue={initialValue}
      placeholder={placeholder} confirmLabel={confirmLabel} validate={validate}
      onConfirm={onConfirm} onCancel={onCancel}
    />
  )
}

// Mounted only while open, so the typed value starts fresh from initialValue every time
function PromptDialogBody({ title, message, label, initialValue, placeholder, confirmLabel, validate, onConfirm, onCancel }) {
  const [value, setValue]   = useState(initialValue)
  const [touched, setTouched] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const trimmed = value.trim()
  const error   = !trimmed ? 'Enter a name.' : (validate ? validate(trimmed) : '')

  const submit = () => {
    setTouched(true)
    if (error) return
    onConfirm(trimmed)
  }

  return (
    <ModalPortal onClose={onCancel}>
      <div className="modal-backdrop-center">
        <div className="modal-panel-sm" style={{ maxWidth: '26rem' }}>
          <h3 className="text-base font-bold text-[var(--color-text-primary)] mb-0.5">{title}</h3>
          {message && <p className="text-xs text-[var(--color-text-muted)] mb-4">{message}</p>}

          {label && <label className="form-label">{label}</label>}
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={e => setValue(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder={placeholder}
            aria-invalid={touched && !!error}
            className={`w-full px-3 py-2.5 text-sm border rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition ${
              touched && error ? 'border-[var(--color-error)]' : 'border-[var(--color-border)]'
            }`}
          />
          <p className="text-xs text-[var(--color-error-text)] mt-1.5 min-h-[1rem]">{touched && error ? error : ''}</p>

          <div className="flex gap-3 mt-3">
            <button type="button" onClick={onCancel} className="btn-cancel flex-1">Cancel</button>
            <button type="button" onClick={submit} data-modal-primary className="btn btn-primary flex-1 py-2.5">
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}
