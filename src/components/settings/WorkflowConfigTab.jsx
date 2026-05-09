/**
 * WorkflowConfigTab.jsx — Settings → Workflow Config Tab
 * Location: src/components/settings/WorkflowConfigTab.jsx
 *
 * Rules enforced (from ALMIRENE DX Rev.9):
 *  - NO native <select> anywhere — GroupedSelect is the standard dropdown
 *  - All colors via CSS variables — no hardcoded hex
 *  - No gradients, no shadow-2xl, no hover:scale
 *  - Mobile-first responsive
 *  - addToast(message, type) signature — matches UIComponents.jsx
 */

import { useState, useEffect, useCallback } from 'react'
import {
  GitBranch, ChevronDown, ChevronRight, Plus, Trash2,
  RotateCcw, Save, AlertCircle, GripVertical,
  Settings, Users, Zap, Clock, Eye, Info,
} from 'lucide-react'
import GroupedSelect from '../GroupedSelect'
import {
  getAllWorkflows,
  saveWorkflowDefinition,
  resetWorkflow,
} from '../../utils/workflowConfigBridge'
import { useAuth } from '../../context/AuthContext'
import { useAppConfig } from '../../context/AppConfigContext'
import { ConfirmDialog, useToast, ToastContainer } from '../UIComponents'

// ─────────────────────────────────────────────────────────────────────────────
// OPTION LISTS (used by GroupedSelect)
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_OPTIONS = [
  { value: 'technical_admin',   label: 'Super Admin' },
  { value: 'admin',             label: 'Owner (Read-only)' },
  { value: 'system_admin',      label: 'System Admin' },
  { value: 'principal_basic',   label: 'Principal (Basic Ed)' },
  { value: 'program_head',      label: 'Program Head (College)' },
  { value: 'registrar_basic',   label: 'Registrar (Basic Ed)' },
  { value: 'registrar_college', label: 'Registrar (College)' },
  { value: 'accounting',        label: 'Accounting' },
  { value: 'teacher',           label: 'Teacher' },
]

const STEP_COLOR_OPTIONS = [
  { value: 'yellow', label: 'Yellow' },
  { value: 'blue',   label: 'Blue' },
  { value: 'indigo', label: 'Indigo' },
  { value: 'green',  label: 'Green' },
  { value: 'red',    label: 'Red' },
  { value: 'orange', label: 'Orange' },
  { value: 'purple', label: 'Purple' },
  { value: 'teal',   label: 'Teal' },
  { value: 'gray',   label: 'Gray' },
]

const DEPARTMENT_OPTIONS = [
  { value: 'basicEd', label: 'Basic Education' },
  { value: 'college', label: 'College' },
  { value: 'all',     label: 'All Departments' },
]

const ACTION_STYLE_OPTIONS = [
  { value: 'primary',   label: 'Primary (Blue)' },
  { value: 'secondary', label: 'Secondary (Gray)' },
  { value: 'danger',    label: 'Danger (Red)' },
]

const CONDITION_TYPE_OPTIONS = [
  { value: 'skip_if',    label: 'skip_if — auto-skip this step' },
  { value: 'require_if', label: 'require_if — block unless condition met' },
  { value: 'block_if',   label: 'block_if — block a specific action' },
]

const CONDITION_OPERATOR_OPTIONS = [
  { value: 'equals',           label: 'equals' },
  { value: 'not_equals',       label: 'not equals' },
  { value: 'greater_than',     label: 'greater than' },
  { value: 'less_than',        label: 'less than' },
  { value: 'greater_or_equal', label: 'greater or equal' },
  { value: 'less_or_equal',    label: 'less or equal' },
  { value: 'is_empty',         label: 'is empty' },
  { value: 'is_not_empty',     label: 'is not empty' },
  { value: 'includes',         label: 'includes' },
  { value: 'not_includes',     label: 'not includes' },
]

const DEADLINE_ACTION_OPTIONS = [
  { value: 'notify_admin',   label: 'Notify Admin' },
  { value: 'auto_escalate',  label: 'Auto-escalate' },
  { value: 'auto_reject',    label: 'Auto-reject' },
]

// Badge color CSS classes mapped by color value
const COLOR_BADGE = {
  yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  blue:   'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  indigo: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  green:  'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  red:    'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  orange: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  teal:   'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  gray:   'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
}

const LOCKED_FINAL_STEPS = ['officially_enrolled', 'approved', 'registrar_posted']
const LOCKED_WORKFLOWS   = ['grade_change_request']

function uid() { return `step_${Date.now()}_${Math.random().toString(36).slice(2, 5)}` }

// Shared input class — matches existing Settings.jsx pattern
const INPUT_CLS = 'w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition'

// ─────────────────────────────────────────────────────────────────────────────
// ROLE CHIPS — multi-select chips (not a GroupedSelect — roles need multi-select)
// ─────────────────────────────────────────────────────────────────────────────

function RoleChips({ value = [], onChange, label }) {
  return (
    <div>
      {label && (
        <p className="text-xs font-medium text-[var(--color-text-muted)] mb-1.5">{label}</p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {ROLE_OPTIONS.map(r => {
          const on = value.includes(r.value)
          return (
            <button
              key={r.value}
              type="button"
              onClick={() => onChange(on ? value.filter(v => v !== r.value) : [...value, r.value])}
              className={`px-2 py-0.5 rounded-lg text-xs font-mono border transition-colors
                ${on
                  ? 'bg-primary text-white border-primary'
                  : 'bg-[var(--color-bg-card)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:border-primary'}`}
            >
              {r.value}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTION EDITOR
// ─────────────────────────────────────────────────────────────────────────────

function ActionEditor({ actions = [], steps = [], onChange }) {
  const stepOptions = steps.map(s => ({ value: s.id, label: s.label || s.id }))

  const add = () => onChange([...actions, {
    id: `act_${Date.now()}`, label: 'New Action',
    style: 'primary', nextStep: '', requiresNote: false, notifyTrigger: null,
  }])
  const upd = (i, p) => { const n = [...actions]; n[i] = { ...n[i], ...p }; onChange(n) }
  const del = (i) => onChange(actions.filter((_, x) => x !== i))

  return (
    <div className="space-y-2">
      {actions.map((a, i) => (
        <div
          key={i}
          className="border border-[var(--color-border)] rounded-xl p-3 space-y-3 bg-[var(--color-bg-page)]"
        >
          {/* Label + style */}
          <div className="flex gap-2">
            <input
              className={INPUT_CLS + ' flex-1'}
              placeholder="Action label (e.g. Approve)"
              value={a.label}
              onChange={e => upd(i, { label: e.target.value })}
            />
            <div className="w-36 shrink-0">
              <GroupedSelect
                value={a.style}
                onChange={v => upd(i, { style: v })}
                options={ACTION_STYLE_OPTIONS}
                allLabel="Style"
                placeholder="Style"
              />
            </div>
            <button
              type="button"
              onClick={() => del(i)}
              className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
            >
              <Trash2 size={14} />
            </button>
          </div>

          {/* Next step */}
          <div>
            <label className="text-xs text-[var(--color-text-muted)] mb-1 block">Next Step</label>
            <GroupedSelect
              value={a.nextStep || 'all'}
              onChange={v => upd(i, { nextStep: v === 'all' ? '' : v })}
              options={stepOptions}
              allLabel="— select next step —"
              placeholder="— select next step —"
            />
          </div>

          {/* Notify trigger */}
          <div>
            <label className="text-xs text-[var(--color-text-muted)] mb-1 block">
              Notify Trigger <span className="opacity-60">(optional)</span>
            </label>
            <input
              className={INPUT_CLS}
              placeholder="e.g. enrollment_approved"
              value={a.notifyTrigger ?? ''}
              onChange={e => upd(i, { notifyTrigger: e.target.value || null })}
            />
          </div>

          {/* Requires note */}
          <label className="flex items-center gap-2 text-xs cursor-pointer select-none text-[var(--color-text-secondary)]">
            <input
              type="checkbox"
              className="accent-primary"
              checked={a.requiresNote}
              onChange={e => upd(i, { requiresNote: e.target.checked })}
            />
            Requires a note / reason from the user
          </label>
        </div>
      ))}

      <button
        type="button"
        onClick={add}
        className="w-full py-2 text-xs border border-dashed border-[var(--color-border)] hover:border-primary rounded-xl text-[var(--color-text-muted)] hover:text-primary transition-colors flex items-center justify-center gap-1"
      >
        <Plus size={12} /> Add Action
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CONDITION EDITOR
// ─────────────────────────────────────────────────────────────────────────────

function ConditionEditor({ conditions = [], onChange }) {
  const add = () => onChange([...conditions, {
    type: 'skip_if', field: '', operator: 'equals', value: '',
  }])
  const upd = (i, p) => { const n = [...conditions]; n[i] = { ...n[i], ...p }; onChange(n) }
  const del = (i) => onChange(conditions.filter((_, x) => x !== i))

  return (
    <div className="space-y-2">
      {conditions.map((c, i) => (
        <div
          key={i}
          className="border border-[var(--color-border)] rounded-xl p-3 space-y-3 bg-[var(--color-bg-page)]"
        >
          {/* Type + field */}
          <div className="flex gap-2">
            <div className="flex-1">
              <GroupedSelect
                value={c.type}
                onChange={v => upd(i, { type: v })}
                options={CONDITION_TYPE_OPTIONS}
                allLabel="Condition type"
                placeholder="Condition type"
              />
            </div>
            <button
              type="button"
              onClick={() => del(i)}
              className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
            >
              <Trash2 size={14} />
            </button>
          </div>

          {/* Field path + operator + value */}
          <div className="grid grid-cols-3 gap-2">
            <input
              className={INPUT_CLS}
              placeholder="field.path"
              value={c.field}
              onChange={e => upd(i, { field: e.target.value })}
            />
            <GroupedSelect
              value={c.operator}
              onChange={v => upd(i, { operator: v })}
              options={CONDITION_OPERATOR_OPTIONS}
              allLabel="operator"
              placeholder="operator"
            />
            <input
              className={INPUT_CLS}
              placeholder="value"
              value={String(c.value ?? '')}
              onChange={e => {
                let v = e.target.value
                if (v === 'true') v = true
                else if (v === 'false') v = false
                else if (v !== '' && !isNaN(v)) v = Number(v)
                upd(i, { value: v })
              }}
            />
          </div>

          {/* Reason (block_if / require_if only) */}
          {(c.type === 'block_if' || c.type === 'require_if') && (
            <input
              className={INPUT_CLS}
              placeholder="Reason shown to user when blocked (optional)"
              value={c.reason ?? ''}
              onChange={e => upd(i, { reason: e.target.value || undefined })}
            />
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={add}
        className="w-full py-2 text-xs border border-dashed border-[var(--color-border)] hover:border-primary rounded-xl text-[var(--color-text-muted)] hover:text-primary transition-colors flex items-center justify-center gap-1"
      >
        <Plus size={12} /> Add Condition
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP CARD
// ─────────────────────────────────────────────────────────────────────────────

function StepCard({ step, steps, index, isExpanded, onToggle, onChange, onDelete, isLocked }) {
  const badgeCls = COLOR_BADGE[step.color] ?? COLOR_BADGE.gray
  const patch = (k, v) => onChange({ ...step, [k]: v })

  return (
    <div className="border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-card)] overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-3 p-3 cursor-pointer select-none hover:bg-[var(--color-bg-subtle)] transition-colors"
        onClick={onToggle}
      >
        <GripVertical size={14} className="text-[var(--color-text-muted)] shrink-0" />

        <span className={`px-2 py-0.5 rounded-lg text-xs font-medium shrink-0 ${badgeCls}`}>
          {step.isFinal ? '⬛ Final' : `#${index + 1}`}
        </span>

        <span className="font-medium text-sm text-[var(--color-text-primary)] flex-1 truncate">
          {step.label || (
            <span className="italic text-[var(--color-text-muted)]">Untitled step</span>
          )}
        </span>

        <div className="flex items-center gap-1 shrink-0">
          {step.isInitial && (
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
              START
            </span>
          )}
          {step.isFinal && (
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
              FINAL
            </span>
          )}
          <span className="font-mono text-[10px] opacity-40 hidden sm:inline">{step.id}</span>
        </div>

        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </div>

      {/* Detail editor */}
      {isExpanded && (
        <div className="border-t border-[var(--color-border)] p-4 space-y-5">
          {/* ID + Label */}
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="text-xs font-medium text-[var(--color-text-muted)] block mb-1">
                Step ID
              </label>
              <input
                className={INPUT_CLS + ' font-mono'}
                value={step.id}
                disabled={isLocked}
                onChange={e => patch('id', e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                placeholder="snake_case_id"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--color-text-muted)] block mb-1">
                Label
              </label>
              <input
                className={INPUT_CLS}
                value={step.label}
                onChange={e => patch('label', e.target.value)}
                placeholder="Display name"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-[var(--color-text-muted)] block mb-1">
              Description
            </label>
            <textarea
              className={INPUT_CLS + ' resize-none'}
              rows={2}
              value={step.description ?? ''}
              onChange={e => patch('description', e.target.value)}
              placeholder="What happens at this step"
            />
          </div>

          {/* Color */}
          <div>
            <label className="text-xs font-medium text-[var(--color-text-muted)] block mb-1.5">
              Badge Color
            </label>
            <GroupedSelect
              value={step.color || 'all'}
              onChange={v => patch('color', v === 'all' ? 'gray' : v)}
              options={STEP_COLOR_OPTIONS}
              allLabel="Select color"
              placeholder="Select color"
            />
          </div>

          {/* Flags */}
          <div className="flex flex-wrap gap-4">
            {[
              ['isInitial', 'Starting step (isInitial)'],
              ['isFinal',   'Final step — no further actions (isFinal)'],
            ].map(([key, lbl]) => (
              <label key={key} className="flex items-center gap-2 text-xs cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={!!step[key]}
                  onChange={e => patch(key, e.target.checked)}
                />
                <span className="text-[var(--color-text-secondary)]">{lbl}</span>
              </label>
            ))}
          </div>

          {/* SLA Deadline */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-[var(--color-text-muted)] flex items-center gap-1 mb-1">
                <Clock size={11} /> SLA Deadline (hours)
              </label>
              <input
                type="number"
                min="0"
                className={INPUT_CLS}
                value={step.deadlineHours ?? ''}
                onChange={e => patch('deadlineHours', e.target.value ? Number(e.target.value) : null)}
                placeholder="Leave blank = no deadline"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--color-text-muted)] block mb-1">
                If deadline missed
              </label>
              <GroupedSelect
                value={step.deadlineAction ?? 'all'}
                onChange={v => patch('deadlineAction', v === 'all' ? null : v)}
                options={DEADLINE_ACTION_OPTIONS}
                allLabel="No action"
                placeholder="No action"
              />
            </div>
          </div>

          {/* Allowed roles */}
          {!step.isFinal && (
            <RoleChips
              label="Roles that can act at this step"
              value={step.allowedRoles ?? []}
              onChange={v => patch('allowedRoles', v)}
            />
          )}

          {/* Actions */}
          {!step.isFinal && (
            <div>
              <p className="text-xs font-semibold text-[var(--color-text-secondary)] mb-2 flex items-center gap-1">
                <Zap size={12} /> Actions
              </p>
              <ActionEditor
                actions={step.actions ?? []}
                steps={steps.filter(s => s.id !== step.id)}
                onChange={v => patch('actions', v)}
              />
            </div>
          )}

          {/* Conditions */}
          <div>
            <p className="text-xs font-semibold text-[var(--color-text-secondary)] mb-2 flex items-center gap-1">
              <GitBranch size={12} /> Conditions
            </p>
            <ConditionEditor
              conditions={step.conditions ?? []}
              onChange={v => patch('conditions', v)}
            />
          </div>

          {/* Delete step */}
          {!isLocked && !LOCKED_FINAL_STEPS.includes(step.id) && (
            <div className="pt-2 border-t border-[var(--color-border)]">
              <button
                type="button"
                onClick={onDelete}
                className="flex items-center gap-1.5 text-xs text-red-600 border border-red-200 dark:border-red-800 px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <Trash2 size={12} /> Delete this step
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// WORKFLOW FLOW PREVIEW (SVG — no native selects needed here)
// ─────────────────────────────────────────────────────────────────────────────

function WorkflowPreview({ steps }) {
  const sorted = [...steps]
    .filter(s => !s.isFinal)
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
  const all = [...sorted, ...steps.filter(s => s.isFinal)]
  if (!all.length) return null

  const W = 130, H = 34, GY = 20, PX = 14, PY = 12
  const COLOR_HEX = {
    yellow: '#ca8a04', blue: '#2563eb', indigo: '#4f46e5', green: '#16a34a',
    red: '#dc2626', orange: '#ea580c', purple: '#9333ea', teal: '#0d9488', gray: '#6b7280',
  }

  return (
    <svg
      viewBox={`0 0 ${W + PX * 2} ${all.length * (H + GY) + PY * 2}`}
      className="w-full max-w-[200px] mx-auto"
      aria-label="Workflow flow preview"
    >
      <defs>
        <marker id="wf-arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3z" fill="#9ca3af" />
        </marker>
      </defs>
      {all.map((s, i) => {
        const y = PY + i * (H + GY)
        const cx = PX + W / 2
        const c = COLOR_HEX[s.color] ?? '#6b7280'
        return (
          <g key={s.id}>
            {i > 0 && (
              <line
                x1={cx} y1={y - GY + 4} x2={cx} y2={y - 4}
                stroke="#9ca3af" strokeWidth="1.5"
                markerEnd="url(#wf-arrow)"
              />
            )}
            <rect
              x={PX} y={y} width={W} height={H} rx="5"
              fill={s.isFinal ? c + '22' : c + '15'}
              stroke={c}
              strokeWidth={s.isFinal ? '2' : '1.5'}
            />
            <text
              x={cx} y={y + H / 2 + 1}
              textAnchor="middle" dominantBaseline="middle"
              fontSize="8.5" fill={c}
              fontWeight={s.isFinal ? '700' : '500'}
              style={{ fontFamily: 'system-ui, sans-serif' }}
            >
              {s.label.length > 20 ? s.label.slice(0, 18) + '…' : s.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function WorkflowConfigTab() {
  const { user }           = useAuth()
  const { activeCampuses } = useAppConfig()
  const { toasts, addToast, removeToast } = useToast()

  const campusKey = user?.campusKey ?? activeCampuses?.[0]?.key ?? 'all'

  const [workflows,     setWorkflows]     = useState([])
  const [deptTab,       setDeptTab]       = useState('basicEd') // 'basicEd' | 'college' | 'all'
  const [selectedId,    setSelectedId]    = useState(null)
  const [draft,         setDraft]         = useState(null)
  const [expandedSteps, setExpandedSteps] = useState({})
  const [isDirty,       setIsDirty]       = useState(false)
  const [showPreview,   setShowPreview]   = useState(false)
  const [isSaving,      setIsSaving]      = useState(false)
  const [resetConfirm,  setResetConfirm]  = useState(false)
  const [switchTarget,  setSwitchTarget]  = useState(null)

  // Load workflows on mount
  useEffect(() => {
    const loaded = getAllWorkflows(campusKey)
    setWorkflows(loaded)
    if (loaded.length > 0) setSelectedId(loaded[0].workflowId)
  }, [campusKey])

  // Load selected workflow into draft
  useEffect(() => {
    if (!selectedId) return
    const found = workflows.find(w => w.workflowId === selectedId)
    if (found) {
      setDraft(JSON.parse(JSON.stringify(found)))
      setIsDirty(false)
      setExpandedSteps({})
    }
  }, [selectedId, workflows])

  // Stay in sync if another tab updates workflows
  useEffect(() => {
    const handler = () => {
      const loaded = getAllWorkflows(campusKey)
      setWorkflows(loaded)
    }
    window.addEventListener('almirene_workflow_config_updated', handler)
    return () => window.removeEventListener('almirene_workflow_config_updated', handler)
  }, [campusKey])

  const patchDraft = useCallback((patch) => {
    setDraft(p => ({ ...p, ...patch }))
    setIsDirty(true)
  }, [])

  const patchSteps = useCallback((steps) => {
    setDraft(p => ({ ...p, steps }))
    setIsDirty(true)
  }, [])

  const handleSave = async () => {
    if (!draft || isSaving) return
    setIsSaving(true)
    try {
      const saved = saveWorkflowDefinition(draft)
      setWorkflows(prev => {
        const idx = prev.findIndex(w => w.workflowId === saved.workflowId)
        const next = [...prev]
        if (idx >= 0) next[idx] = saved; else next.push(saved)
        return next
      })
      setDraft(JSON.parse(JSON.stringify(saved)))
      setIsDirty(false)
      addToast(`"${saved.label}" saved (v${saved.version})`, 'success')
    } catch (err) {
      addToast('Save failed: ' + err.message, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = () => {
    try {
      const reset = resetWorkflow(selectedId, campusKey)
      setWorkflows(prev => {
        const idx = prev.findIndex(w => w.workflowId === selectedId)
        const next = [...prev]
        if (idx >= 0) next[idx] = reset; else next.push(reset)
        return next
      })
      setDraft(JSON.parse(JSON.stringify(reset)))
      setIsDirty(false)
      setResetConfirm(false)
      addToast(`"${reset.label}" reset to system defaults.`, 'success')
    } catch (err) {
      addToast(err.message, 'error')
      setResetConfirm(false)
    }
  }

  const handleAddStep = () => {
    const newStep = {
      id: uid(), label: 'New Step', description: '',
      order: draft.steps.length + 1, color: 'blue',
      isInitial: false, isFinal: false,
      allowedRoles: [], actions: [], conditions: [], fieldPermissions: [],
      deadlineHours: null, deadlineAction: null,
    }
    patchSteps([...draft.steps, newStep])
    setExpandedSteps(p => ({ ...p, [draft.steps.length]: true }))
  }

  const isLocked = LOCKED_WORKFLOWS.includes(selectedId)

  if (!draft) {
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-sm text-[var(--color-text-muted)]">Loading workflow definitions…</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            Workflow Configuration
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
            Configure step sequences, role permissions, and automation conditions.
          </p>
        </div>

        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowPreview(v => !v)}
            className="btn btn-ghost gap-1.5 text-xs"
          >
            <Eye size={13} />
            {showPreview ? 'Hide Preview' : 'Preview'}
          </button>
          <button
            type="button"
            onClick={() => setResetConfirm(true)}
            className="btn btn-ghost gap-1.5 text-xs text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20"
          >
            <RotateCcw size={13} /> Reset
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            className="btn btn-primary gap-1.5 text-xs"
            style={{ opacity: !isDirty ? 0.5 : 1 }}
          >
            {isSaving
              ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Save size={13} />
            }
            {isDirty ? 'Save Changes' : 'Saved'}
          </button>
        </div>
      </div>

      {/* ── Banners ───────────────────────────────────────────────────────── */}
      {isDirty && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-xs text-amber-800 dark:text-amber-300">
          <AlertCircle size={13} className="shrink-0" />
          Unsaved changes — new records will use the last saved version.
        </div>
      )}
      {isLocked && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 text-xs text-blue-800 dark:text-blue-300">
          <Info size={13} className="shrink-0" />
          Core logic for this workflow is locked for compliance.
        </div>
      )}

      {/* ── Two-column layout ─────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row gap-5">
        {/* Left: workflow selector */}
        <div className="lg:w-56 shrink-0">
          {/* Department tabs */}
          <div className="flex gap-1 p-1 rounded-xl bg-[var(--color-bg-subtle)] mb-3">
            {[
              { id: 'basicEd', label: 'Basic Ed' },
              { id: 'college', label: 'College' },
              { id: 'all',     label: 'All' },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setDeptTab(tab.id)}
                className={`flex-1 py-1.5 text-[11px] font-semibold rounded-lg transition-colors
                  ${deptTab === tab.id
                    ? 'bg-[var(--color-bg-card)] text-[var(--color-text-primary)] shadow-sm'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Filtered workflow list */}
          <div className="space-y-1">
            {workflows
              .filter(wf => deptTab === 'all' || wf.department === deptTab || wf.department === 'all')
              .map(wf => (
              <button
                key={wf.workflowId}
                type="button"
                onClick={() =>
                  isDirty ? setSwitchTarget(wf.workflowId) : setSelectedId(wf.workflowId)
                }
                className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors
                  ${selectedId === wf.workflowId
                    ? 'bg-primary text-white'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)]'}`}
              >
                <div className="font-medium text-[13px] truncate">{wf.label}</div>
                <div className={`text-[10px] ${selectedId === wf.workflowId ? 'text-white/70' : 'text-[var(--color-text-muted)]'}`}>
                  v{wf.version}
                </div>
              </button>
            ))}
          </div>

          {showPreview && (
            <div className="mt-3 p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-page)]">
              <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase mb-2">
                Flow
              </p>
              <WorkflowPreview steps={draft.steps} />
            </div>
          )}
        </div>

        {/* Right: editor */}
        <div className="flex-1 min-w-0 space-y-5">
          {/* Workflow info */}
          <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] space-y-3">
            <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide flex items-center gap-1">
              <Settings size={11} /> Workflow Info
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[var(--color-text-muted)] block mb-1">Label</label>
                <input
                  className={INPUT_CLS}
                  value={draft.label}
                  onChange={e => patchDraft({ label: e.target.value })}
                />
              </div>

            </div>
          </div>

          {/* Steps */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide flex items-center gap-1">
                <GitBranch size={11} /> Steps ({draft.steps.length})
              </p>
              {!isLocked && (
                <button
                  type="button"
                  onClick={handleAddStep}
                  className="flex items-center gap-1 text-xs border border-dashed border-[var(--color-border)] hover:border-primary px-3 py-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-primary transition-colors"
                >
                  <Plus size={12} /> Add Step
                </button>
              )}
            </div>

            <div className="space-y-2">
              {[...draft.steps]
                .sort((a, b) => {
                  if (a.isFinal && !b.isFinal) return 1
                  if (!a.isFinal && b.isFinal) return -1
                  return (a.order ?? 99) - (b.order ?? 99)
                })
                .map((step, vi) => {
                  const ri = draft.steps.findIndex(s => s.id === step.id)
                  return (
                    <StepCard
                      key={step.id}
                      step={step}
                      steps={draft.steps}
                      index={vi}
                      isExpanded={!!expandedSteps[ri]}
                      onToggle={() =>
                        setExpandedSteps(p => ({ ...p, [ri]: !p[ri] }))
                      }
                      onChange={updated => {
                        const next = [...draft.steps]
                        next[ri] = updated
                        patchSteps(next)
                      }}
                      onDelete={() =>
                        patchSteps(draft.steps.filter((_, i) => i !== ri))
                      }
                      isLocked={isLocked}
                    />
                  )
                })}
            </div>
          </div>

          {/* Global permissions */}
          <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] space-y-4">
            <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide flex items-center gap-1">
              <Users size={11} /> Global Permissions
            </p>
            {[
              ['canView',   'Can view records'],
              ['canCreate', 'Can create new records'],
              ['canExport', 'Can export data'],
              ['canDelete', 'Can delete records (Super Admin only by default)'],
            ].map(([key, lbl]) => (
              <RoleChips
                key={key}
                label={lbl}
                value={(draft.permissions ?? {})[key] ?? []}
                onChange={v =>
                  patchDraft({ permissions: { ...(draft.permissions ?? {}), [key]: v } })
                }
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Dialogs ───────────────────────────────────────────────────────── */}
      <ConfirmDialog
        open={resetConfirm}
        title="Reset to Defaults"
        message={`This will overwrite all custom step configurations for "${draft.label}". In-progress records will not be affected.`}
        confirmLabel="Reset to Defaults"
        danger={false}
        onConfirm={handleReset}
        onCancel={() => setResetConfirm(false)}
      />

      <ConfirmDialog
        open={!!switchTarget}
        title="Unsaved Changes"
        message="Switch workflow and discard your unsaved changes?"
        confirmLabel="Switch & Discard"
        danger
        onConfirm={() => { setSelectedId(switchTarget); setSwitchTarget(null) }}
        onCancel={() => setSwitchTarget(null)}
      />

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  )
}