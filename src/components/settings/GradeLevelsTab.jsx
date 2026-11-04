/**
 * GradeLevelsTab — Settings → Grade Levels (campus-only)
 *
 * Each campus keeps its own list of Basic Education levels, grouped (Pre-Elementary,
 * Elementary, ...). A campus that has not changed anything uses the school-wide list; the first
 * save makes a copy for that campus only. College programs (courses) are added and removed here
 * for the campus; a new program gets empty fee rows in Fee Structure. College year levels are shown
 * (each program has its own year levels).
 *
 * A level that has enrolled students at this campus cannot be renamed or removed.
 * No native selects, no window.confirm, colors from CSS variables only.
 */

import { useMemo, useState } from 'react'
import { Plus, X, ChevronUp, ChevronDown, Lock, RotateCcw, Save, Info, Trash2 } from 'lucide-react'
import { ConfirmDialog } from '../UIComponents'

const MAX_NAME = 40

const clone = (groups) => (groups || []).map(g => ({ label: g.label, options: [...(g.options || [])] }))
const sameLists = (a, b) => JSON.stringify(a) === JSON.stringify(b)

function moveItem(list, from, to) {
  if (to < 0 || to >= list.length) return list
  const next = [...list]
  const [x] = next.splice(from, 1)
  next.splice(to, 0, x)
  return next
}

/** How many students are enrolled per level at this campus (from the saved enrollments). */
function countEnrolled(campusName, campusKey) {
  const counts = {}
  try {
    const subs = JSON.parse(localStorage.getItem('almirene_submissions') || '[]')
    subs.forEach(s => {
      if (['rejected', 'declined', 'cancelled', 'withdrawn'].includes(s.status)) return
      const camp = s.enrollment?.campus || s.campusName || s.campus
      if (camp && camp !== campusName && camp !== campusKey) return
      const lvl = s.enrollment?.gradeLevel || s.gradeLevel
      if (lvl) counts[lvl] = (counts[lvl] || 0) + 1
    })
  } catch { /* no saved enrollments */ }
  return counts
}

/** Inline editor for the section names of one level. */
function SectionNames({ label, names, newName, setNewName, error, onAdd, onChange, onCopyAll, inputCls, btnPrimary, btnOutline, iconBtn }) {
  return (
    <div className="basis-full w-full mt-2 p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-subtle)]">
      <p className="text-xs text-[var(--color-text-secondary)] mb-2">
        Sections of <strong className="text-[var(--color-text-primary)]">{label}</strong> are created from enrollment. The first section
        takes the first name below, the second takes the second, and so on. Extra sections are named {label}-A, {label}-B… Leave this empty to use that for all.
      </p>
      {names.length > 0 && (
        <ol className="flex flex-wrap gap-2 mb-2">
          {names.map((n, i) => (
            <li key={`${n}-${i}`} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full bg-[var(--color-bg-card)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)]">
              <span className="text-[10px] text-[var(--color-text-muted)]">{i + 1}.</span> {n}
              <button className={iconBtn} disabled={i === 0} onClick={() => onChange(moveItem(names, i, i - 1))} aria-label={`Move ${n} earlier`}><ChevronUp className="w-3.5 h-3.5 -rotate-90" /></button>
              <button className={iconBtn} disabled={i === names.length - 1} onClick={() => onChange(moveItem(names, i, i + 1))} aria-label={`Move ${n} later`}><ChevronDown className="w-3.5 h-3.5 -rotate-90" /></button>
              <button className={iconBtn} onClick={() => onChange(names.filter((_, k) => k !== i))} aria-label={`Remove section ${n}`}><X className="w-3.5 h-3.5" /></button>
            </li>
          ))}
        </ol>
      )}
      <div className="flex gap-2">
        <input value={newName} maxLength={40} onChange={e => setNewName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onAdd() }}
          placeholder="Section name, e.g. St. Francis" className={inputCls} aria-label={`Add a section name for ${label}`} />
        <button onClick={onAdd} className={btnPrimary}><Plus className="w-3.5 h-3.5" /> Add</button>
      </div>
      {error && <p role="alert" className="mt-2 text-sm font-medium" style={{ color: 'var(--color-error-text, var(--color-alert))' }}>{error}</p>}
      <div className="flex flex-wrap gap-2 mt-2">
        {onCopyAll && names.length > 0 && <button onClick={onCopyAll} className={btnOutline}>Use these names for the whole group</button>}
        {names.length > 0 && <button onClick={() => onChange([])} className={btnOutline}>Use automatic names</button>}
      </div>
    </div>
  )
}

export default function GradeLevelsTab({
  campusKey, campusName,
  effectiveGroups, schoolGroups, hasOwnList, schoolYearLevels,
  programs, getProgramYears, getSectionNames, onAddProgram, onRemoveProgram,
  onSave, onReset, addToast,
}) {
  const [draft, setDraft] = useState(() => clone(effectiveGroups))
  const [saved, setSaved] = useState(() => clone(effectiveGroups))
  // Year levels are per program. These hold only the programs edited here: { [program]: [years] }.
  const [draftYears, setDraftYears] = useState({})
  const [savedYears, setSavedYears] = useState({})
  const [newYear, setNewYear] = useState({})                // { [program]: text }
  const [renamingYear, setRenamingYear] = useState(null)   // { prog, i, text }
  const [yearError, setYearError] = useState({})           // { [program]: text }
  // Section names per level (Basic Ed level, or "<Program> - <Year>"): { [levelKey]: [names] }.
  // Only the levels edited here are held; the rest come from what the campus saved.
  const [draftSections, setDraftSections] = useState({})
  const [savedSections, setSavedSections] = useState({})
  const [openSections, setOpenSections] = useState(null)   // levelKey whose editor is open
  const [newSection, setNewSection] = useState('')
  const [sectionError, setSectionError] = useState('')
  const sectionsOf = (key) => draftSections[key] || savedSections[key] || getSectionNames(key) || []
  const savedSectionsOf = (key) => savedSections[key] || getSectionNames(key) || []
  const yearsOf = (prog) => draftYears[prog] || savedYears[prog] || getProgramYears(prog)
  const savedYearsOf = (prog) => savedYears[prog] || getProgramYears(prog)
  const [newGroup, setNewGroup] = useState('')
  const [newLevel, setNewLevel] = useState({})      // { [groupIndex]: text }
  const [renaming, setRenaming] = useState(null)    // { g, i|null, text }
  const [showReset, setShowReset] = useState(false)
  const [error, setError] = useState('')
  const [newProgram, setNewProgram] = useState('')
  const [programError, setProgramError] = useState('')
  const [removeProgram, setRemoveProgram] = useState(null)

  const enrolled = useMemo(() => countEnrolled(campusName, campusKey), [campusName, campusKey])
  const dirty = !sameLists(draft, saved)
    || Object.keys(draftYears).some(p => !sameLists(draftYears[p], savedYearsOf(p)))
    || Object.keys(draftSections).some(k => !sameLists(draftSections[k], savedSectionsOf(k)))
  const savedLevels = useMemo(() => new Set(saved.flatMap(g => g.options)), [saved])

  const lockedCount = (level) => (savedLevels.has(level) ? (enrolled[level] || 0) : 0)
  const groupLockedCount = (g) => g.options.reduce((n, o) => n + lockedCount(o), 0)

  const allNames = () => [...draft.map(g => g.label), ...draft.flatMap(g => g.options)].map(n => n.toLowerCase())

  const validName = (raw, ignore) => {
    const name = raw.trim().replace(/\s+/g, ' ')
    if (!name) return { error: 'Enter a name.' }
    if (name.length > MAX_NAME) return { error: `Keep it to ${MAX_NAME} characters or fewer.` }
    if (name.includes(' - ')) return { error: 'Do not use " - " in a level name (it is used for college levels).' }
    if (Object.values(draftYears).flat().some(y => name.toLowerCase().endsWith(String(y).toLowerCase())))
      return { error: 'A Basic Ed level cannot end like a college year level.' }
    const taken = allNames().filter(n => n !== (ignore || '').toLowerCase())
    if (taken.includes(name.toLowerCase())) return { error: `"${name}" is already used.` }
    return { name }
  }

  const fail = (msg) => { setError(msg); return false }

  // College programs ---------------------------------------------------------
  const programStudents = (prog) => Object.entries(enrolled)
    .filter(([lvl]) => lvl.startsWith(`${prog} - `)).reduce((n, [, c]) => n + c, 0)

  const addProgram = () => {
    const name = newProgram.trim().replace(/\s+/g, ' ')
    if (name.length < 2) return setProgramError('Enter the program name, e.g. BS Information Technology.')
    if (name.length > 60) return setProgramError('Keep it to 60 characters or fewer.')
    if (name.includes(' - ')) return setProgramError('Do not use " - " in a program name.')
    if (!/^[A-Za-z0-9][A-Za-z0-9 .,&()'/-]*$/.test(name)) return setProgramError('Use letters, numbers, spaces and . , & ( ) - only.')
    const err = onAddProgram?.(name)
    if (err) return setProgramError(err)
    setNewProgram(''); setProgramError('')
  }

  // College year levels (per program) -------------------------------------------
  // Students are enrolled under "<Program> - <Year level>", so a year is locked by those records.
  const yearStudents = (prog, year) => savedYearsOf(prog).includes(year) ? (enrolled[`${prog} - ${year}`] || 0) : 0

  const setYears = (prog, list) => setDraftYears(d => ({ ...d, [prog]: list }))
  const yearErr = (prog, msg) => { setYearError(e => ({ ...e, [prog]: msg })); return false }

  const validYear = (prog, raw, ignore) => {
    const name = raw.trim().replace(/\s+/g, ' ')
    if (!name) return { error: 'Enter a year level.' }
    if (name.length > 30) return { error: 'Keep it to 30 characters or fewer.' }
    if (name.includes(' - ')) return { error: 'Do not use " - " in a year level.' }
    if (yearsOf(prog).some(y => y.toLowerCase() === name.toLowerCase() && y.toLowerCase() !== (ignore || '').toLowerCase()))
      return { error: `"${name}" is already used.` }
    return { name }
  }

  const addYear = (prog) => {
    const v = validYear(prog, newYear[prog] || '')
    if (v.error) return yearErr(prog, v.error)
    setYears(prog, [...yearsOf(prog), v.name]); setNewYear(n => ({ ...n, [prog]: '' })); yearErr(prog, '')
  }
  // Section names ---------------------------------------------------------------
  const MAX_SECTION_NAME = 30
  const addSectionName = (key) => {
    const name = newSection.trim().replace(/\s+/g, ' ')
    const list = sectionsOf(key)
    if (!name) return setSectionError('Enter a section name.')
    if (name.length > MAX_SECTION_NAME) return setSectionError(`Keep it to ${MAX_SECTION_NAME} characters or fewer.`)
    if (list.some(x => x.toLowerCase() === name.toLowerCase())) return setSectionError(`"${name}" is already used.`)
    if (list.length >= 30) return setSectionError('That is enough sections for one level.')
    setDraftSections(d => ({ ...d, [key]: [...list, name] })); setNewSection(''); setSectionError('')
  }
  const setSectionList = (key, list) => setDraftSections(d => ({ ...d, [key]: list }))
  // A renamed level keeps its section names
  const moveSectionKey = (from, to) => {
    if (from === to) return
    const list = sectionsOf(from)
    if (!list.length) return
    setDraftSections(d => ({ ...d, [to]: list, [from]: [] }))
    setOpenSections(o => (o === from ? to : o))
  }

  const commitYearRename = () => {
    if (!renamingYear) return
    const { prog, i, text } = renamingYear
    const v = validYear(prog, text, yearsOf(prog)[i])
    if (v.error) return yearErr(prog, v.error)
    moveSectionKey(`${prog} - ${yearsOf(prog)[i]}`, `${prog} - ${v.name}`)
    setYears(prog, yearsOf(prog).map((y, k) => k === i ? v.name : y)); setRenamingYear(null); yearErr(prog, '')
  }
  const removeYear = (prog, i) => {
    const y = yearsOf(prog)[i]
    const n = yearStudents(prog, y)
    if (n) return yearErr(prog, `${y} has ${n} enrolled student${n !== 1 ? 's' : ''} and cannot be removed.`)
    if (yearsOf(prog).length === 1) return yearErr(prog, 'Keep at least one year level.')
    setYears(prog, yearsOf(prog).filter((_, k) => k !== i)); yearErr(prog, '')
  }

  // Going back to the school-wide list is blocked while students are in a level only this campus has
  const tryReset = () => {
    const schoolYears = new Set(schoolYearLevels || [])
    for (const prog of (programs || [])) {
      const stuckYear = savedYearsOf(prog).find(y => yearStudents(prog, y) > 0 && !schoolYears.has(y))
      if (stuckYear) return fail(`${prog} ${stuckYear} has enrolled students and is not in the school-wide list, so this campus cannot go back to it.`)
    }
    const schoolLevels = new Set((schoolGroups || []).flatMap(g => g.options))
    const stuck = [...savedLevels].find(l => (enrolled[l] || 0) > 0 && !schoolLevels.has(l))
    if (stuck) return fail(`${stuck} has enrolled students and is not in the school-wide list, so this campus cannot go back to it.`)
    setError(''); setShowReset(true)
  }

  const addGroup = () => {
    const v = validName(newGroup)
    if (v.error) return fail(v.error)
    setDraft(d => [...d, { label: v.name, options: [] }]); setNewGroup(''); setError('')
  }

  const addLevel = (gi) => {
    const v = validName(newLevel[gi] || '')
    if (v.error) return fail(v.error)
    setDraft(d => d.map((g, i) => i === gi ? { ...g, options: [...g.options, v.name] } : g))
    setNewLevel(n => ({ ...n, [gi]: '' })); setError('')
  }

  const startRename = (g, i) => setRenaming({ g, i, text: i === null ? draft[g].label : draft[g].options[i] })

  const commitRename = () => {
    if (!renaming) return
    const { g, i, text } = renaming
    const current = i === null ? draft[g].label : draft[g].options[i]
    const v = validName(text, current)
    if (v.error) return fail(v.error)
    if (i !== null) moveSectionKey(current, v.name)
    setDraft(d => d.map((grp, gi) => {
      if (gi !== g) return grp
      if (i === null) return { ...grp, label: v.name }
      return { ...grp, options: grp.options.map((o, oi) => oi === i ? v.name : o) }
    }))
    setRenaming(null); setError('')
  }

  const removeLevel = (gi, oi) => {
    const level = draft[gi].options[oi]
    if (lockedCount(level)) return fail(`${level} has ${lockedCount(level)} enrolled student${lockedCount(level) !== 1 ? 's' : ''} and cannot be removed.`)
    setDraft(d => d.map((g, i) => i === gi ? { ...g, options: g.options.filter((_, k) => k !== oi) } : g)); setError('')
  }

  const removeGroup = (gi) => {
    if (groupLockedCount(draft[gi])) return fail(`${draft[gi].label} has levels with enrolled students and cannot be removed.`)
    setDraft(d => d.filter((_, i) => i !== gi)); setError('')
  }

  const save = () => {
    const cleaned = draft.filter(g => g.options.length > 0)
    if (!cleaned.length) return fail('Keep at least one level.')
    // A saved level may not be dropped while students are enrolled in it (also covers a group rename)
    const missing = [...savedLevels].find(l => (enrolled[l] || 0) > 0 && !cleaned.some(g => g.options.includes(l)))
    if (missing) return fail(`${missing} has enrolled students and cannot be removed or renamed.`)
    for (const prog of Object.keys(draftYears)) {
      const missingYear = savedYearsOf(prog).find(y => yearStudents(prog, y) > 0 && !draftYears[prog].includes(y))
      if (missingYear) return fail(`${prog} ${missingYear} has enrolled students and cannot be removed or renamed.`)
    }
    const previous = Object.fromEntries(Object.keys(draftYears).map(p => [p, savedYearsOf(p)]))
    // Section names for the levels that exist now (a removed or renamed level's old key is dropped)
    const sections = {}
    const keep = (key) => { const list = sectionsOf(key); if (list.length) sections[key] = list }
    cleaned.forEach(g => g.options.forEach(keep))
    ;(programs || []).forEach(prog => yearsOf(prog).forEach(y => keep(`${prog} - ${y}`)))
    onSave(cleaned, draftYears, previous, sections)
    setDraft(clone(cleaned)); setSaved(clone(cleaned)); setSavedYears(y => ({ ...y, ...draftYears })); setDraftYears({})
    setSavedSections(sections); setDraftSections({}); setError('')
    addToast?.(`Grade levels saved for ${campusName}.`, 'success')
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition'
  const btnBase = 'inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg whitespace-nowrap transition disabled:opacity-40 disabled:cursor-not-allowed'
  const btnPrimary = `${btnBase} bg-[var(--color-secondary)] text-[var(--color-secondary-contrast)] hover:opacity-90`
  const btnOutline = `${btnBase} border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)]`
  const iconBtn = 'p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text-primary)] transition disabled:opacity-30 disabled:cursor-not-allowed'

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-[var(--color-bg-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Grade Levels</h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Levels for {campusName} only · {hasOwnList ? 'this campus has its own list' : 'using the school-wide list until you save a change'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:flex-shrink-0">
            {hasOwnList && (
              <button onClick={tryReset} className={btnOutline}>
                <RotateCcw className="w-3.5 h-3.5" /> School-wide list
              </button>
            )}
            <button onClick={() => { setDraft(clone(saved)); setDraftYears({}); setDraftSections({}); setSectionError(''); setError(''); setYearError({}); setRenaming(null); setRenamingYear(null) }} disabled={!dirty} className={btnOutline}>
              Discard
            </button>
            <button onClick={save} disabled={!dirty} className={btnPrimary}>
              <Save className="w-3.5 h-3.5" /> Save
            </button>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2 px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-subtle)] text-xs text-[var(--color-text-secondary)]">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-[var(--color-text-muted)]" />
          <p>
            Fees are set per level in Fee Structure: a new or renamed level starts at ₱0 there until you set it.
            Levels with enrolled students are locked. Changes apply to this campus only.
          </p>
        </div>

        {error && (
          <p role="alert" className="mt-3 text-sm font-medium" style={{ color: 'var(--color-error-text, var(--color-alert))' }}>{error}</p>
        )}
      </div>

      {/* Groups */}
      {draft.map((group, gi) => (
        <div key={`${group.label}-${gi}`} className="bg-[var(--color-bg-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-5">
          <div className="flex items-center gap-2 mb-3">
            {renaming && renaming.g === gi && renaming.i === null ? (
              <>
                <input autoFocus value={renaming.text} maxLength={MAX_NAME + 10}
                  onChange={e => setRenaming({ ...renaming, text: e.target.value })}
                  onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenaming(null) }}
                  className={inputCls} aria-label="Group name" />
                <button onClick={commitRename} className={btnPrimary}>Done</button>
                <button onClick={() => setRenaming(null)} className={iconBtn} aria-label="Cancel rename"><X className="w-4 h-4" /></button>
              </>
            ) : (
              <>
                <h3 className="flex-1 min-w-0 text-base font-bold text-[var(--color-text-primary)] truncate">{group.label}</h3>
                <span className="text-xs text-[var(--color-text-muted)] whitespace-nowrap">{group.options.length} level{group.options.length !== 1 ? 's' : ''}</span>
                <button className={iconBtn} disabled={gi === 0} onClick={() => setDraft(d => moveItem(d, gi, gi - 1))} aria-label="Move group up"><ChevronUp className="w-4 h-4" /></button>
                <button className={iconBtn} disabled={gi === draft.length - 1} onClick={() => setDraft(d => moveItem(d, gi, gi + 1))} aria-label="Move group down"><ChevronDown className="w-4 h-4" /></button>
                <button className="px-2 py-1 text-xs font-medium rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)] transition"
                  onClick={() => startRename(gi, null)}>Rename</button>
                <button className={iconBtn} onClick={() => removeGroup(gi)} aria-label="Remove group" title={groupLockedCount(group) ? 'Has enrolled students' : 'Remove group'}>
                  {groupLockedCount(group) ? <Lock className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </>
            )}
          </div>

          <ul className="divide-y divide-[var(--color-border)] border border-[var(--color-border)] rounded-xl overflow-hidden">
            {group.options.length === 0 && (
              <li className="px-3 py-3 text-xs text-[var(--color-text-muted)]">No levels yet. A group with no levels is dropped when you save.</li>
            )}
            {group.options.map((level, oi) => {
              const n = lockedCount(level)
              const editing = renaming && renaming.g === gi && renaming.i === oi
              return (
                <li key={`${level}-${oi}`} className="flex flex-wrap items-center gap-2 px-3 py-2 bg-[var(--color-bg-card)]">
                  {editing ? (
                    <>
                      <input autoFocus value={renaming.text} maxLength={MAX_NAME + 10}
                        onChange={e => setRenaming({ ...renaming, text: e.target.value })}
                        onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenaming(null) }}
                        className={inputCls} aria-label="Level name" />
                      <button onClick={commitRename} className={btnPrimary}>Done</button>
                      <button onClick={() => setRenaming(null)} className={iconBtn} aria-label="Cancel rename"><X className="w-4 h-4" /></button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 min-w-0 text-sm text-[var(--color-text-primary)] truncate">{level}</span>
                      {n > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-[var(--color-border)] text-[var(--color-text-muted)] whitespace-nowrap"
                          title="Enrolled students lock this level">
                          <Lock className="w-3 h-3" /> {n} enrolled
                        </span>
                      )}
                      <button className="px-2 py-1 text-xs font-medium rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)] transition whitespace-nowrap"
                        onClick={() => { setOpenSections(o => o === level ? null : level); setNewSection(''); setSectionError('') }} aria-expanded={openSections === level} aria-label={`Sections of ${level}`}>
                        Sections{sectionsOf(level).length ? ` · ${sectionsOf(level).length}` : ''}
                      </button>
                      <button className={iconBtn} disabled={oi === 0} onClick={() => setDraft(d => d.map((g, i) => i === gi ? { ...g, options: moveItem(g.options, oi, oi - 1) } : g))} aria-label={`Move ${level} up`}><ChevronUp className="w-4 h-4" /></button>
                      <button className={iconBtn} disabled={oi === group.options.length - 1} onClick={() => setDraft(d => d.map((g, i) => i === gi ? { ...g, options: moveItem(g.options, oi, oi + 1) } : g))} aria-label={`Move ${level} down`}><ChevronDown className="w-4 h-4" /></button>
                      <button className="px-2 py-1 text-xs font-medium rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)] transition disabled:opacity-30 disabled:cursor-not-allowed"
                        disabled={n > 0} onClick={() => startRename(gi, oi)}>Rename</button>
                      <button className={iconBtn} disabled={n > 0} onClick={() => removeLevel(gi, oi)} aria-label={`Remove ${level}`}><Trash2 className="w-4 h-4" /></button>
                    </>
                  )}
                  {openSections === level && !editing && (
                    <SectionNames label={level} names={sectionsOf(level)} newName={newSection} setNewName={setNewSection}
                      error={sectionError} onAdd={() => addSectionName(level)}
                      onChange={(list) => setSectionList(level, list)}
                      onCopyAll={() => setDraftSections(d => ({ ...d, ...Object.fromEntries(group.options.map(o => [o, sectionsOf(level)])) }))}
                      inputCls={inputCls} btnPrimary={btnPrimary} btnOutline={btnOutline} iconBtn={iconBtn} />
                  )}
                </li>
              )
            })}
          </ul>

          <div className="flex gap-2 mt-3">
            <input value={newLevel[gi] || ''} maxLength={MAX_NAME + 10}
              onChange={e => setNewLevel(n => ({ ...n, [gi]: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') addLevel(gi) }}
              placeholder="New level, e.g. Grade 13" className={inputCls} aria-label={`Add a level to ${group.label}`} />
            <button onClick={() => addLevel(gi)} className={btnPrimary}><Plus className="w-3.5 h-3.5" /> Add</button>
          </div>
        </div>
      ))}

      {/* Add group */}
      <div className="bg-[var(--color-bg-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-5">
        <p className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">Add a group</p>
        <div className="flex gap-2">
          <input value={newGroup} maxLength={MAX_NAME + 10} onChange={e => setNewGroup(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addGroup() }}
            placeholder="Group name, e.g. Day Care" className={inputCls} aria-label="New group name" />
          <button onClick={addGroup} className={btnPrimary}><Plus className="w-3.5 h-3.5" /> Add</button>
        </div>
      </div>

      {/* College programs + year levels */}
      <div className="bg-[var(--color-bg-card)] rounded-2xl shadow-sm border border-[var(--color-border)] p-5">
        <h3 className="text-base font-bold text-[var(--color-text-primary)]">College programs</h3>
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5 mb-3">
          Programs {campusName} offers, each with its own year levels (one program can run 5 years while another runs 4). Adding a program turns on College here and creates empty fee rows for it in Fee Structure. Year level changes are saved with the Save button at the top.
        </p>

        {(programs || []).length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)] mb-3">No college programs yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--color-border)] border border-[var(--color-border)] rounded-xl overflow-hidden mb-3">
            {programs.map(prog => {
              const n = programStudents(prog)
              const years = yearsOf(prog)
              return (
                <li key={prog} className="px-3 py-3 bg-[var(--color-bg-card)]">
                  <div className="flex items-center gap-2">
                    <span className="flex-1 min-w-0 text-sm font-semibold text-[var(--color-text-primary)] truncate">{prog}</span>
                    {n > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-[var(--color-border)] text-[var(--color-text-muted)] whitespace-nowrap"
                        title="Enrolled students lock this program">
                        <Lock className="w-3 h-3" /> {n} enrolled
                      </span>
                    )}
                    <button className={iconBtn} disabled={n > 0} onClick={() => setRemoveProgram(prog)} aria-label={`Remove ${prog}`}><Trash2 className="w-4 h-4" /></button>
                  </div>

                  {/* Year levels of this program only */}
                  <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mt-3 mb-1.5">Year levels · {years.length}</p>
                  <ul className="divide-y divide-[var(--color-border)] border border-[var(--color-border)] rounded-lg overflow-hidden">
                    {years.map((year, i) => {
                      const yn = yearStudents(prog, year)
                      const editing = renamingYear && renamingYear.prog === prog && renamingYear.i === i
                      return (
                        <li key={`${year}-${i}`} className="flex flex-wrap items-center gap-2 px-3 py-1.5 bg-[var(--color-bg-subtle)]">
                          {editing ? (
                            <>
                              <input autoFocus value={renamingYear.text} maxLength={40}
                                onChange={e => setRenamingYear({ ...renamingYear, text: e.target.value })}
                                onKeyDown={e => { if (e.key === 'Enter') commitYearRename(); if (e.key === 'Escape') setRenamingYear(null) }}
                                className={inputCls} aria-label={`${prog} year level name`} />
                              <button onClick={commitYearRename} className={btnPrimary}>Done</button>
                              <button onClick={() => setRenamingYear(null)} className={iconBtn} aria-label="Cancel rename"><X className="w-4 h-4" /></button>
                            </>
                          ) : (
                            <>
                              <span className="flex-1 min-w-0 text-sm text-[var(--color-text-primary)] truncate">{year}</span>
                              {yn > 0 && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-[var(--color-border)] text-[var(--color-text-muted)] whitespace-nowrap">
                                  <Lock className="w-3 h-3" /> {yn} enrolled
                                </span>
                              )}
                              <button className="px-2 py-1 text-xs font-medium rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card)] transition whitespace-nowrap"
                                onClick={() => { const k = `${prog} - ${year}`; setOpenSections(o => o === k ? null : k); setNewSection(''); setSectionError('') }}
                                aria-expanded={openSections === `${prog} - ${year}`} aria-label={`Sections of ${prog} ${year}`}>
                                Sections{sectionsOf(`${prog} - ${year}`).length ? ` · ${sectionsOf(`${prog} - ${year}`).length}` : ''}
                              </button>
                              <button className={iconBtn} disabled={i === 0} onClick={() => setYears(prog, moveItem(years, i, i - 1))} aria-label={`Move ${prog} ${year} up`}><ChevronUp className="w-4 h-4" /></button>
                              <button className={iconBtn} disabled={i === years.length - 1} onClick={() => setYears(prog, moveItem(years, i, i + 1))} aria-label={`Move ${prog} ${year} down`}><ChevronDown className="w-4 h-4" /></button>
                              <button className="px-2 py-1 text-xs font-medium rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card)] transition disabled:opacity-30 disabled:cursor-not-allowed"
                                disabled={yn > 0} onClick={() => setRenamingYear({ prog, i, text: year })}>Rename</button>
                              <button className={iconBtn} disabled={yn > 0} onClick={() => removeYear(prog, i)} aria-label={`Remove ${prog} ${year}`}><Trash2 className="w-4 h-4" /></button>
                            </>
                          )}
                          {openSections === `${prog} - ${year}` && !editing && (
                            <SectionNames label={`${prog} ${year}`} names={sectionsOf(`${prog} - ${year}`)} newName={newSection} setNewName={setNewSection}
                              error={sectionError} onAdd={() => addSectionName(`${prog} - ${year}`)}
                              onChange={(list) => setSectionList(`${prog} - ${year}`, list)}
                              onCopyAll={() => setDraftSections(d => ({ ...d, ...Object.fromEntries(years.map(y => [`${prog} - ${y}`, sectionsOf(`${prog} - ${year}`)])) }))}
                              inputCls={inputCls} btnPrimary={btnPrimary} btnOutline={btnOutline} iconBtn={iconBtn} />
                          )}
                        </li>
                      )
                    })}
                  </ul>
                  <div className="flex gap-2 mt-2">
                    <input value={newYear[prog] || ''} maxLength={40}
                      onChange={e => { setNewYear(v => ({ ...v, [prog]: e.target.value })); yearErr(prog, '') }}
                      onKeyDown={e => { if (e.key === 'Enter') addYear(prog) }}
                      placeholder="New year level, e.g. 5th Year" className={inputCls} aria-label={`New year level for ${prog}`} />
                    <button onClick={() => addYear(prog)} className={btnPrimary}><Plus className="w-3.5 h-3.5" /> Add</button>
                  </div>
                  {yearError[prog] && <p role="alert" className="mt-2 text-sm font-medium" style={{ color: 'var(--color-error-text, var(--color-alert))' }}>{yearError[prog]}</p>}
                </li>
              )
            })}
          </ul>
        )}

        <div className="flex gap-2">
          <input value={newProgram} maxLength={70}
            onChange={e => { setNewProgram(e.target.value); setProgramError('') }}
            onKeyDown={e => { if (e.key === 'Enter') addProgram() }}
            placeholder="New program, e.g. BS Information Technology" className={inputCls} aria-label="New college program" />
          <button onClick={addProgram} className={btnPrimary}><Plus className="w-3.5 h-3.5" /> Add</button>
        </div>
        {programError && <p role="alert" className="mt-2 text-sm font-medium" style={{ color: 'var(--color-error-text, var(--color-alert))' }}>{programError}</p>}

      </div>

      <ConfirmDialog
        open={!!removeProgram}
        title={`Remove ${removeProgram || ''}?`}
        message={`${campusName} will stop offering this program. Its fee rows stay saved but are no longer used. This cannot be done while students are enrolled in it.`}
        confirmLabel="Remove program"
        danger
        onConfirm={() => {
          const prog = removeProgram; setRemoveProgram(null)
          if (programStudents(prog) > 0) return setProgramError(`${prog} has enrolled students and cannot be removed.`)
          const err = onRemoveProgram?.(prog)
          if (err) setProgramError(err)
        }}
        onCancel={() => setRemoveProgram(null)}
      />

      <ConfirmDialog
        open={showReset}
        title="Use the school-wide list?"
        message={`${campusName} will go back to the school-wide grade levels. Levels this campus added or renamed are no longer offered here.`}
        confirmLabel="Use school-wide list"
        danger
        onConfirm={() => { setShowReset(false); onReset() }}
        onCancel={() => setShowReset(false)}
      />
    </div>
  )
}
