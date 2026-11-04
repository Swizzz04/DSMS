/**
 * SchoolYearTab — Settings → School Year (campus-only)
 *
 * Each campus owns its school year list: which years exist, their start/end dates, the calendar
 * events, the grading period type and framework picked per year, and which year is current.
 * A campus that never saved a list uses the school-wide one; its first Save writes a full copy
 * for that campus only (copy-on-write), after which it no longer follows the school-wide list.
 *
 * The campus is chosen with the Campus menu in the header (Technical Admin) or is the person's
 * own campus. With no campus (the school owner) the tab shows each campus's own current school
 * year, read-only.
 *
 * Grading framework DEFINITIONS (weights, transmutation) stay school-wide and are managed in
 * Settings; this tab only picks which framework a year uses.
 * No native selects / date inputs / window.confirm, colors from CSS variables only, no gradients.
 */

import { useState } from 'react'
import {
  Calendar, Plus, Edit, Check, Save, ChevronDown, Clock, Trash2, BookOpen, GraduationCap,
  RotateCcw, Info, Building2,
} from 'lucide-react'
import { ConfirmDialog, ModalPortal } from '../UIComponents'
import GroupedSelect from '../GroupedSelect'
import DatePicker from '../DatePicker'
import AccordionBody from '../AccordionBody'
import { getGradingFrameworks, getCollegeGradingFrameworks } from '../../engines/gradingEngine'

const clone = (list) => JSON.parse(JSON.stringify(list || []))
const sameLists = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const longDate  = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
const shortDate = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

const EMPTY_ADD = { year: '', beStart: '', beEnd: '', colStart: '', colEnd: '' }

const STATUS_OPTIONS = [
  { value: 'upcoming',  label: 'Upcoming' },
  { value: 'active',    label: 'Active' },
  { value: 'completed', label: 'Completed' },
]

// Badge colors from CSS variables only
const BADGE_CURRENT  = 'bg-[var(--color-success-light)] text-[var(--color-success-text)] border border-[var(--color-success-border)]'
const BADGE_ACTIVE   = 'bg-[var(--color-info-light)] text-[var(--color-info)] border border-[var(--color-info-border)]'
const BADGE_UPCOMING = 'bg-[var(--color-warning-light)] text-[var(--color-warning-text)] border border-[var(--color-warning-border)]'
const BADGE_MUTED    = 'bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)] border border-[var(--color-border)]'
const EVENT_TYPE_BADGE = {
  academic: BADGE_ACTIVE,
  holiday:  BADGE_CURRENT,
  special:  BADGE_UPCOMING,
}

const PRESET_EVENTS = [
  { name: 'Enrollment Period',    type: 'academic' },
  { name: 'Midterm Examinations', type: 'academic' },
  { name: 'Final Examinations',   type: 'academic' },
  { name: 'Semestral Break',      type: 'holiday' },
  { name: 'Summer Break',         type: 'holiday' },
  { name: 'Graduation Ceremony',  type: 'special' },
  { name: 'Foundation Day',       type: 'special' },
]

/**
 * Props
 *  campusKey / campusName   the campus being configured ('' = none chosen)
 *  years                    that campus's school years as the app reads them now
 *  hasOwnList               the campus already saved its own list
 *  schoolWideYears          the school-wide list (what "Use school-wide" goes back to)
 *  currentYearsByCampus     [{ key, name, year, hasOwnList }] for the overview
 *  canSeeBoth               Technical Admin: Basic Ed and College calendars
 *  visibleDept              'basic_ed' | 'college' — the department shown
 *  onDeptChange(dept)       Technical Admin department switch
 *  onSave(list)             save this campus's list
 *  onReset()                drop this campus's list (back to the school-wide one)
 *  addToast(message, type)
 */
export default function SchoolYearTab(props) {
  return props.campusKey
    ? <CampusSchoolYears key={props.campusKey} {...props} />
    : <NoCampusView {...props} />
}

// ─────────────────────────────────────────────────────────────────────────────
// No campus chosen: each campus's own current school year
// ─────────────────────────────────────────────────────────────────────────────
function NoCampusView({ currentYearsByCampus }) {
  return (
    <div className="bg-[var(--color-bg-card)] rounded-2xl shadow-sm p-4 sm:p-6 border border-[var(--color-border)]">
      <h2 className="text-xl font-bold text-[var(--color-text-primary)]">School Year Management</h2>
      <p className="text-sm text-[var(--color-text-muted)] mt-1 mb-4">
        Every campus keeps its own school years, dates, calendar and current school year.
        Choose a campus from the Campus menu in the header to edit it.
      </p>

      <div className="space-y-2">
        {(currentYearsByCampus || []).map(row => (
          <div key={row.key} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)]/40">
            <div className="flex items-center gap-3 min-w-0">
              <Building2 className="w-4 h-4 text-[var(--color-text-muted)] flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{row.name}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{row.hasOwnList ? 'Own calendar' : 'Using the school-wide calendar'}</p>
              </div>
            </div>
            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full flex-shrink-0 ${BADGE_CURRENT}`}>{row.year}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// One campus
// ─────────────────────────────────────────────────────────────────────────────
function CampusSchoolYears({
  campusName,
  years, hasOwnList, schoolWideYears, canSeeBoth, visibleDept, onDeptChange, onSave, onReset, addToast,
}) {
  const [edit, setEdit] = useState(() => clone(years))
  const [expandedSY, setExpandedSY] = useState(null)
  const [showAddSY, setShowAddSY] = useState(false)
  const [addForm, setAddForm] = useState(EMPTY_ADD)
  const [showAddEvent, setShowAddEvent] = useState(null)   // { syId, dept }
  const [evt, setEvt] = useState({ name: '', type: 'academic', start: '', end: '' })
  const [editSY, setEditSY] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [justSaved, setJustSaved] = useState(false)

  const dirty   = !sameLists(edit, years)
  const deptKey = visibleDept === 'college' ? 'college' : 'basicEd'
  const deptLabel = { basic_ed: 'Basic Education', college: 'College' }
  const sorted  = edit.slice().sort((a, b) => b.year.localeCompare(a.year))

  // ── Save / reset ──────────────────────────────────────────────
  const save = () => {
    if (edit.length && !edit.some(sy => sy.isCurrent)) {
      addToast('Mark one school year as current before saving.', 'error')
      return
    }
    onSave(clone(edit))
    setJustSaved(true)
    setTimeout(() => setJustSaved(false), 2000)
    addToast(`${campusName} school years saved.`, 'success')
  }

  const askReset = () => setConfirm({
    title: 'Use the school-wide school years?',
    message: `${campusName} will drop its own school years, dates and calendar events and follow the school-wide list again. This cannot be undone.`,
    confirmLabel: 'Use school-wide',
    danger: true,
    onConfirm: () => { onReset(); setEdit(clone(schoolWideYears)); setExpandedSY(null) },
  })

  // ── Add school year ───────────────────────────────────────────
  const openAddSY = () => {
    const latest = edit.length > 0
      ? Math.max(...edit.map(y => parseInt(y.year.split('-')[1], 10)))
      : new Date().getFullYear()
    const suggested = `${latest}-${latest + 1}`
    const taken = edit.some(y => y.year === suggested)
    setAddForm(taken ? EMPTY_ADD : {
      year: suggested,
      beStart: `${latest}-06-01`, beEnd: `${latest + 1}-03-31`,
      colStart: `${latest}-08-01`, colEnd: `${latest + 1}-05-31`,
    })
    setShowAddSY(true)
  }
  const closeAddSY = () => { setShowAddSY(false); setAddForm(EMPTY_ADD) }

  const submitAddSY = () => {
    const year = addForm.year.trim()
    if (!year) { addToast('Please enter a school year', 'error'); return }
    if (!/^\d{4}-\d{4}$/.test(year)) { addToast('Format must be YYYY-YYYY', 'error'); return }
    const [sY, eY] = year.split('-').map(Number)
    if (eY !== sY + 1) { addToast('End year must be 1 year after start', 'error'); return }
    if (edit.some(y => y.year === year)) { addToast(`${year} already exists`, 'error'); return }

    // Basic Ed and College run on different dates, so this form only asks for the department
    // being viewed. The other department starts on a standard default and is set from its own tab.
    const isCollege = visibleDept === 'college'
    if (!isCollege && (!addForm.beStart || !addForm.beEnd)) { addToast('Please set Basic Ed dates', 'error'); return }
    if (isCollege && (!addForm.colStart || !addForm.colEnd)) { addToast('Please set College dates', 'error'); return }
    if (!isCollege && new Date(addForm.beEnd) <= new Date(addForm.beStart)) { addToast('End date must be after start', 'error'); return }
    if (isCollege && new Date(addForm.colEnd) <= new Date(addForm.colStart)) { addToast('End date must be after start', 'error'); return }

    setEdit(prev => [...prev, {
      id: Date.now(), year, status: 'upcoming', isCurrent: false,
      gradingPeriodType: 'quarterly', gradingFramework: 'do8_2015', collegeGradingFramework: 'ched_standard',
      basicEd: { startDate: addForm.beStart || `${sY}-06-01`, endDate: addForm.beEnd || `${eY}-03-31`, events: [] },
      college: { startDate: addForm.colStart || `${sY}-08-01`, endDate: addForm.colEnd || `${eY}-05-31`, events: [] },
    }])
    closeAddSY()
    addToast(`School year ${year} added. Click "Save Changes" to apply.`, 'success')
  }

  // ── Events ────────────────────────────────────────────────────
  const closeAddEvent = () => { setShowAddEvent(null); setEvt({ name: '', type: 'academic', start: '', end: '' }) }

  const submitAddEvent = () => {
    const name = evt.name.trim()
    if (!name) { addToast('Please enter an event name', 'error'); return }
    if (!evt.start) { addToast('Please set a start date', 'error'); return }
    const endDate = evt.end || evt.start
    if (new Date(endDate) < new Date(evt.start)) { addToast('End date cannot be before start', 'error'); return }
    const dept = showAddEvent.dept
    setEdit(prev => prev.map(sy => sy.id === showAddEvent.syId
      ? { ...sy, [dept]: { ...sy[dept], events: [...(sy[dept]?.events || []), { id: Date.now(), name, type: evt.type, startDate: evt.start, endDate }] } }
      : sy))
    const yearLabel = edit.find(sy => sy.id === showAddEvent.syId)?.year || ''
    closeAddEvent()
    addToast(`"${name}" added to ${yearLabel}`, 'success')
  }

  const removeEvent = (syId, event) => {
    setEdit(prev => prev.map(s => s.id === syId
      ? { ...s, [deptKey]: { ...s[deptKey], events: (s[deptKey]?.events || []).filter(e => e.id !== event.id) } }
      : s))
    addToast(`"${event.name}" removed`, 'success')
  }

  // ── Edit school year ──────────────────────────────────────────
  const submitEditSY = () => {
    const dept = editSY._dept || 'basic_ed'
    const key  = dept === 'college' ? 'college' : 'basicEd'
    const year = editSY.year.trim()
    if (!year || !/^\d{4}-\d{4}$/.test(year)) { addToast('Format must be YYYY-YYYY', 'error'); return }
    const [sY, eY] = year.split('-').map(Number)
    if (eY !== sY + 1) { addToast('End year must be 1 year after start', 'error'); return }
    if (edit.some(sy => sy.year === year && sy.id !== editSY.id)) { addToast(`${year} already exists`, 'error'); return }
    const cal = editSY[key]
    if (!cal?.startDate || !cal?.endDate) { addToast('Please set both dates', 'error'); return }
    if (new Date(cal.endDate) <= new Date(cal.startDate)) { addToast('End date must be after start', 'error'); return }

    setEdit(prev => prev.map(sy => {
      if (sy.id === editSY.id) {
        const updated = { ...editSY, year }
        delete updated._dept
        return updated
      }
      return editSY.isCurrent ? { ...sy, isCurrent: false } : sy
    }))
    setEditSY(null)
    addToast(`${year} updated. Click "Save Changes" to apply.`, 'success')
  }

  return (
    <>
      <div className="bg-[var(--color-bg-card)] rounded-2xl shadow-sm p-4 sm:p-6 border border-[var(--color-border)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl font-bold text-[var(--color-text-primary)]">School Year Management</h2>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              {canSeeBoth ? 'Manage academic calendars per department' : `Manage ${deptLabel[visibleDept]} academic calendar`}
            </p>
          </div>
          <button onClick={openAddSY} className="btn-action !flex-none self-start sm:self-auto flex items-center gap-2 whitespace-nowrap">
            <Plus className="w-4 h-4" /> Add School Year
          </button>
        </div>

        {/* Which campus, and whether it already has its own list */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4 p-3 rounded-xl bg-[var(--color-bg-subtle)] border border-[var(--color-border)]">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <Info className="w-4 h-4 text-[var(--color-text-muted)] flex-shrink-0 mt-0.5" />
            <p className="text-xs text-[var(--color-text-secondary)]">
              These school years apply to <span className="font-semibold text-[var(--color-text-primary)]">{campusName}</span> only.{' '}
              {hasOwnList
                ? 'This campus keeps its own list.'
                : 'This campus is using the school-wide list. Your first save gives it its own copy.'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {hasOwnList && (
              <button onClick={askReset} className="btn-cancel flex items-center gap-1.5 text-xs">
                <RotateCcw className="w-3.5 h-3.5" /> Use school-wide
              </button>
            )}
          </div>
        </div>

        {/* Department tabs — tech admin only */}
        {canSeeBoth ? (
          <div className="flex gap-1 p-1 bg-[var(--color-bg-subtle)] rounded-xl mb-5 w-full sm:w-fit">
            {[
              { key: 'basic_ed', label: 'Basic Education', icon: BookOpen },
              { key: 'college',  label: 'College',         icon: GraduationCap },
            ].map(d => (
              <button key={d.key} onClick={() => { onDeptChange(d.key); setExpandedSY(null) }}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                  visibleDept === d.key ? 'is-selected shadow-sm' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}>
                <d.icon className="w-4 h-4" /> {d.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-[var(--color-bg-subtle)] rounded-lg w-fit">
            {visibleDept === 'basic_ed' ? <BookOpen className="w-4 h-4 text-[var(--color-primary-readable)]" /> : <GraduationCap className="w-4 h-4 text-[var(--color-primary-readable)]" />}
            <span className="text-sm font-medium text-[var(--color-text-primary)]">{deptLabel[visibleDept]} Department</span>
          </div>
        )}

        {sorted.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-3 opacity-40" />
            <p className="text-sm text-[var(--color-text-muted)]">No school years configured yet.</p>
            <button onClick={openAddSY} className="mt-3 text-sm text-[var(--color-primary-readable)] font-medium hover:underline">Add your first school year</button>
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map((sy) => {
              const isExpanded = expandedSY === sy.id
              const cal = sy[deptKey] || { startDate: '', endDate: '', events: [] }
              const events = cal.events || []
              return (
                <div key={sy.id} className={`border rounded-xl overflow-hidden transition-colors ${sy.isCurrent ? 'border-[var(--color-border-strong)] bg-primary/5' : 'border-[var(--color-border)]'}`}>
                  <div className="flex items-stretch">
                    <button onClick={() => setExpandedSY(isExpanded ? null : sy.id)} aria-expanded={isExpanded}
                      className="flex-1 min-w-0 text-left p-4 flex items-center justify-between gap-2 hover:bg-[var(--color-bg-subtle)]/50 transition">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <h3 className="text-base font-bold text-[var(--color-text-primary)]">{sy.year}</h3>
                          {sy.isCurrent && (
                            <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full uppercase tracking-wider ${BADGE_CURRENT}`}>Current</span>
                          )}
                          <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full uppercase tracking-wider ${
                            sy.status === 'active' ? BADGE_ACTIVE : sy.status === 'completed' ? BADGE_MUTED : BADGE_UPCOMING
                          }`}>{sy.status}</span>
                          {deptKey === 'basicEd' && (
                            <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full uppercase tracking-wider ${BADGE_MUTED}`}>
                              {sy.gradingPeriodType === 'trimester' ? 'Trimester' : 'Quarterly'} · {getGradingFrameworks().find(f => f.id === sy.gradingFramework)?.label.replace(/^DepEd Order No\.\s*/, '') || 'DO 8 s.2015'}
                            </span>
                          )}
                          {events.length > 0 && (
                            <span className="text-[10px] text-[var(--color-text-muted)]">{events.length} event{events.length !== 1 ? 's' : ''}</span>
                          )}
                        </div>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {cal.startDate && cal.endDate
                            ? `${longDate(cal.startDate)} — ${longDate(cal.endDate)}`
                            : 'No dates configured for this department'}
                        </p>
                      </div>
                      <ChevronDown className={`w-5 h-5 text-[var(--color-text-muted)] transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                    <button onClick={() => setEditSY({ ...sy, _dept: visibleDept })} className="icon-btn-ghost self-center mr-2" title="Edit school year" aria-label={`Edit ${sy.year}`}>
                      <Edit className="w-4 h-4" />
                    </button>
                  </div>

                  <AccordionBody open={isExpanded}>
                    <div className="border-t border-[var(--color-border)] bg-[var(--color-bg-subtle)]/30">
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                            <Clock className="w-4 h-4 text-[var(--color-text-muted)]" /> {deptLabel[visibleDept]} Events
                          </h4>
                          <button onClick={() => setShowAddEvent({ syId: sy.id, dept: deptKey })} className="text-xs text-[var(--color-primary-readable)] font-medium hover:underline flex items-center gap-1">
                            <Plus className="w-3.5 h-3.5" /> Add Event
                          </button>
                        </div>

                        {events.length === 0 ? (
                          <div className="text-center py-6 border border-dashed border-[var(--color-border)] rounded-lg">
                            <p className="text-xs text-[var(--color-text-muted)]">No events scheduled</p>
                            <button onClick={() => setShowAddEvent({ syId: sy.id, dept: deptKey })} className="mt-2 text-xs text-[var(--color-primary-readable)] font-medium hover:underline">Add your first event</button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {events.slice().sort((a, b) => a.startDate.localeCompare(b.startDate)).map((e) => (
                              <div key={e.id} className="flex items-start gap-3 p-3 bg-[var(--color-bg-card)] rounded-lg border border-[var(--color-border)]">
                                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                  <Calendar className="w-4 h-4 text-[var(--color-primary-readable)]" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <span className="text-sm font-medium text-[var(--color-text-primary)]">{e.name}</span>
                                    <span className={`px-1.5 py-0.5 text-[9px] font-semibold rounded uppercase tracking-wider ${EVENT_TYPE_BADGE[e.type] || EVENT_TYPE_BADGE.special}`}>{e.type}</span>
                                  </div>
                                  <p className="text-xs text-[var(--color-text-muted)]">
                                    {shortDate(e.startDate)}
                                    {e.endDate && e.endDate !== e.startDate
                                      ? ` — ${longDate(e.endDate)}`
                                      : `, ${new Date(`${e.startDate}T12:00:00`).getFullYear()}`}
                                  </p>
                                </div>
                                <button onClick={() => removeEvent(sy.id, e)} className="icon-btn-ghost flex-shrink-0" title="Remove event" aria-label={`Remove ${e.name}`}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </AccordionBody>
                </div>
              )
            })}
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 border-t border-[var(--color-border)] pt-4">
          <p className="text-xs text-[var(--color-text-muted)]">
            {sorted.length} school year{sorted.length !== 1 ? 's' : ''} · {deptLabel[visibleDept]} · {campusName}
            {dirty && <span className="ml-2 font-semibold text-[var(--color-warning-text)]">Unsaved changes</span>}
          </p>
          <button onClick={save} disabled={!dirty && !justSaved} className="btn-action !flex-none sm:px-6 flex items-center justify-center gap-2 whitespace-nowrap">
            {justSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {justSaved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Add School Year */}
      {showAddSY && (
        <ModalPortal>
          <div className="modal-backdrop-center">
            <div className="modal-panel-sm">
              <h3 className="text-base font-bold text-[var(--color-text-primary)] mb-1">Add School Year</h3>
              <p className="text-xs text-[var(--color-text-muted)] mb-5">
                {deptLabel[visibleDept]} · {campusName}
              </p>

              <label className="form-label">School Year</label>
              <input type="text" value={addForm.year} onChange={e => setAddForm(f => ({ ...f, year: e.target.value }))} placeholder="e.g. 2028-2029"
                className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition mb-4" />

              {visibleDept === 'basic_ed' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <DatePicker label={<span className="flex items-center gap-1.5"><BookOpen className="w-3 h-3" /> Basic Ed Start</span>} value={addForm.beStart} onChange={v => setAddForm(f => ({ ...f, beStart: v }))} />
                  <DatePicker label="Basic Ed End" value={addForm.beEnd} onChange={v => setAddForm(f => ({ ...f, beEnd: v }))} />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <DatePicker label={<span className="flex items-center gap-1.5"><GraduationCap className="w-3 h-3" /> College Start</span>} value={addForm.colStart} onChange={v => setAddForm(f => ({ ...f, colStart: v }))} />
                  <DatePicker label="College End" value={addForm.colEnd} onChange={v => setAddForm(f => ({ ...f, colEnd: v }))} />
                </div>
              )}
              <p className="text-[10px] text-[var(--color-text-muted)] -mt-2 mb-4">
                {visibleDept === 'basic_ed' ? 'College' : 'Basic Ed'} dates start on a standard default. Set them from the {visibleDept === 'basic_ed' ? 'College' : 'Basic Education'} tab.
              </p>

              <label className="form-label mb-1.5">Status</label>
              <div className="mb-5">
                <GroupedSelect value="upcoming" onChange={() => {}} allLabel={null} options={STATUS_OPTIONS} />
                <p className="text-[10px] text-[var(--color-text-muted)] mt-1">A new school year starts as Upcoming. Change it later with the edit button.</p>
              </div>

              <div className="action-row">
                <button onClick={closeAddSY} className="btn-cancel">Cancel</button>
                <button className="btn-action" onClick={submitAddSY}>Add School Year</button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Add Event */}
      {showAddEvent && (() => {
        const targetSY = edit.find(sy => sy.id === showAddEvent.syId)
        if (!targetSY) return null
        const dept = showAddEvent.dept
        const existingEvents = targetSY[dept]?.events || []
        return (
          <ModalPortal>
            <div className="modal-backdrop-center">
              <div className="modal-panel-sm" style={{ maxWidth: '28rem' }}>
                <h3 className="text-base font-bold text-[var(--color-text-primary)] mb-0.5">Add Event</h3>
                <p className="text-xs text-[var(--color-text-muted)] mb-5">
                  {dept === 'basicEd' ? 'Basic Education' : 'College'} · <span className="font-semibold text-[var(--color-text-primary)]">{targetSY.year}</span> · {campusName}
                </p>

                <label className="form-label">Quick Add</label>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {PRESET_EVENTS.map(preset => {
                    const exists = existingEvents.some(e => e.name === preset.name)
                    return (
                      <button key={preset.name} disabled={exists}
                        onClick={() => setEvt(v => ({ ...v, name: preset.name, type: preset.type }))}
                        className={`px-2.5 py-1 text-[11px] rounded-lg border transition ${
                          exists ? 'border-[var(--color-border)] text-[var(--color-text-muted)] opacity-40 cursor-not-allowed line-through'
                            : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary-readable)] hover:text-[var(--color-primary-readable)] cursor-pointer'
                        }`}>{preset.name}</button>
                    )
                  })}
                </div>

                <label className="form-label">Event Name</label>
                <input type="text" value={evt.name} onChange={e => setEvt(v => ({ ...v, name: e.target.value }))}
                  placeholder="e.g. Enrollment Period"
                  className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition mb-4" />

                <label className="form-label mb-1.5">Event Type</label>
                <div className="mb-4">
                  <GroupedSelect value={evt.type} onChange={v => setEvt(s => ({ ...s, type: v }))} allLabel={null}
                    options={[
                      { value: 'academic', label: 'Academic' },
                      { value: 'holiday',  label: 'Holiday / Break' },
                      { value: 'special',  label: 'Special Event' },
                    ]} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                  <DatePicker label="Start Date" value={evt.start} onChange={v => setEvt(s => ({ ...s, start: v }))} />
                  <DatePicker label="End Date" value={evt.end} onChange={v => setEvt(s => ({ ...s, end: v }))} />
                </div>

                <div className="action-row">
                  <button onClick={closeAddEvent} className="btn-cancel">Cancel</button>
                  <button className="btn-action" onClick={submitAddEvent}>Add Event</button>
                </div>
              </div>
            </div>
          </ModalPortal>
        )
      })()}

      {/* Edit School Year */}
      {editSY && (() => {
        const dept = editSY._dept || 'basic_ed'
        const key  = dept === 'college' ? 'college' : 'basicEd'
        const cal  = editSY[key] || { startDate: '', endDate: '' }
        const label = dept === 'college' ? 'College' : 'Basic Ed'
        return (
          <ModalPortal>
            <div className="modal-backdrop-center">
              <div className="modal-panel-sm">
                <h3 className="text-base font-bold text-[var(--color-text-primary)] mb-1">Edit School Year</h3>
                <p className="text-xs text-[var(--color-text-muted)] mb-5">
                  Editing <span className="font-semibold text-[var(--color-text-primary)]">{editSY.year}</span> · {dept === 'college' ? 'College' : 'Basic Education'} dates · {campusName}
                </p>

                <label className="form-label">School Year</label>
                <input type="text" value={editSY.year} onChange={e => setEditSY({ ...editSY, year: e.target.value })}
                  className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition mb-4" />

                <div className="mb-4">
                  <DatePicker label={`Start Date (${label})`} value={cal.startDate} onChange={v => setEditSY({ ...editSY, [key]: { ...cal, startDate: v } })} />
                </div>
                <div className="mb-4">
                  <DatePicker label={`End Date (${label})`} value={cal.endDate} onChange={v => setEditSY({ ...editSY, [key]: { ...cal, endDate: v } })} />
                </div>

                <label className="form-label mb-1.5">Status</label>
                <div className="mb-4">
                  <GroupedSelect value={editSY.status} onChange={v => setEditSY({ ...editSY, status: v })} allLabel={null} options={STATUS_OPTIONS} />
                </div>

                {dept === 'basic_ed' && (
                  <>
                    <label className="form-label mb-1.5">Grading Period Type</label>
                    <div className="mb-4">
                      <GroupedSelect value={editSY.gradingPeriodType || 'quarterly'}
                        onChange={v => setEditSY({ ...editSY, gradingPeriodType: v })} allLabel={null}
                        options={[
                          { value: 'quarterly', label: 'Quarterly (Q1–Q4)' },
                          { value: 'trimester', label: 'Trimester (T1–T3) — DepEd Order No. 9, s.2026' },
                        ]} />
                    </div>

                    <label className="form-label mb-1.5">Grading Framework</label>
                    <div className="mb-4">
                      <GroupedSelect value={editSY.gradingFramework || 'do8_2015'}
                        onChange={v => setEditSY({ ...editSY, gradingFramework: v })} allLabel={null}
                        options={getGradingFrameworks().map(f => ({ value: f.id, label: f.label }))} />
                      <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                        Component weights, transmutation and new frameworks are managed school-wide in the Grading
                        Frameworks panel below. Score-entry UI for frameworks with more than 3 flat components
                        (e.g. WW/PT/EX with sub-exams) is still being built.
                      </p>
                    </div>
                  </>
                )}

                {dept === 'college' && (
                  <div className="mb-4">
                    <label className="form-label mb-1.5">Grading Framework</label>
                    <GroupedSelect value={editSY.collegeGradingFramework || 'ched_standard'}
                      onChange={v => setEditSY({ ...editSY, collegeGradingFramework: v })} allLabel={null}
                      options={getCollegeGradingFrameworks().map(f => ({ value: f.id, label: f.label }))} />
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                      Component weights, the point-scale conversion and new frameworks (e.g. when CHED revises
                      grading) are managed school-wide in the College Grading panel below.
                    </p>
                  </div>
                )}

                <label className="flex items-center gap-3 mb-5 cursor-pointer">
                  <input type="checkbox" checked={editSY.isCurrent || false}
                    onChange={e => setEditSY({ ...editSY, isCurrent: e.target.checked })}
                    className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-primary-readable)] focus:ring-primary" />
                  <span className="text-sm text-[var(--color-text-secondary)]">Set as current school year for {campusName}</span>
                </label>

                <div className="action-row">
                  <button onClick={() => setEditSY(null)} className="btn-cancel">Cancel</button>
                  <button className="btn-action" onClick={submitEditSY}>Save Changes</button>
                </div>
              </div>
            </div>
          </ModalPortal>
        )
      })()}

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title}
        message={confirm?.message}
        danger={confirm?.danger}
        confirmLabel={confirm?.confirmLabel || 'Confirm'}
        onConfirm={() => { confirm?.onConfirm?.(); setConfirm(null) }}
        onCancel={() => setConfirm(null)}
      />
    </>
  )
}
