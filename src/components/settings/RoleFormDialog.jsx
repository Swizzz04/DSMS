/**
 * RoleFormDialog.jsx — create or edit the details of a custom role
 * (name, description, and whether the role belongs to one campus or covers all of them).
 *
 * The role's pages and settings tabs are chosen afterwards in the role's own card on
 * Settings → Role Permissions, with the same checkboxes the built-in roles use.
 *
 *   <RoleFormDialog
 *     open={dialog.open}
 *     role={dialog.role}                // null = new role, or the role being edited
 *     takenNames={['Teacher', ...]}      // names already used (lower-cased compare)
 *     onSave={({ label, description, campusScoped }) => { ... }}
 *     onCancel={close}
 *   />
 */
import { useState, useEffect, useRef } from 'react'
import { ModalPortal } from '../UIComponents'
import GroupedSelect from '../GroupedSelect'

const SCOPE_OPTIONS = [
  { value: 'campus', label: 'One campus (the user is assigned a campus)' },
  { value: 'all',    label: 'All campuses (school-wide)' },
]

export default function RoleFormDialog({ open, role, takenNames = [], onSave, onCancel }) {
  if (!open) return null
  return <RoleFormBody role={role} takenNames={takenNames} onSave={onSave} onCancel={onCancel} />
}

// Mounted only while open so the fields start fresh each time
function RoleFormBody({ role, takenNames, onSave, onCancel }) {
  const [label, setLabel]             = useState(role?.label || '')
  const [description, setDescription] = useState(role?.description || '')
  const [scope, setScope]             = useState(role && role.campusScoped === false ? 'all' : 'campus')
  const [touched, setTouched]         = useState(false)
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const trimmed = label.trim()
  const error = !trimmed
    ? 'Enter a role name.'
    : takenNames.some(n => n.toLowerCase() === trimmed.toLowerCase())
      ? 'That role name is already used.'
      : ''

  const submit = () => {
    setTouched(true)
    if (error) return
    onSave({ label: trimmed, description: description.trim(), campusScoped: scope === 'campus' })
  }

  return (
    <ModalPortal onClose={onCancel}>
      <div className="modal-backdrop-center">
        <div className="modal-panel-sm" style={{ maxWidth: '28rem' }}>
          <h3 className="text-base font-bold text-[var(--color-text-primary)] mb-0.5">
            {role ? 'Edit Role' : 'Add Role'}
          </h3>
          <p className="text-xs text-[var(--color-text-muted)] mb-4">
            {role
              ? 'Change the name, description or campus scope. Users keep the role.'
              : 'After adding the role, tick the pages it can open in its card below.'}
          </p>

          <label className="form-label">Role name <span className="text-[var(--color-error-text)]">*</span></label>
          <input
            ref={inputRef}
            type="text"
            value={label}
            maxLength={40}
            onChange={e => setLabel(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder="e.g. Academic Coordinator"
            aria-invalid={touched && !!error}
            className={`w-full px-3 py-2.5 text-sm border rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition ${
              touched && error ? 'border-[var(--color-error)]' : 'border-[var(--color-border)]'
            }`}
          />
          <p className="text-xs text-[var(--color-error-text)] mt-1.5 min-h-[1rem]">{touched && error ? error : ''}</p>

          <label className="form-label mt-2">Description</label>
          <input
            type="text"
            value={description}
            maxLength={120}
            onChange={e => setDescription(e.target.value)}
            placeholder="What this role is for"
            className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition"
          />

          <label className="form-label mt-4">Campus scope</label>
          <GroupedSelect value={scope} onChange={setScope} options={SCOPE_OPTIONS} />

          <div className="flex gap-3 mt-5">
            <button type="button" onClick={onCancel} className="btn-cancel flex-1">Cancel</button>
            <button type="button" onClick={submit} data-modal-primary className="btn btn-primary flex-1 py-2.5">
              {role ? 'Save Role' : 'Add Role'}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}
