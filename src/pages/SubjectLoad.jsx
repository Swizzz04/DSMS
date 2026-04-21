import { useState, useEffect, useCallback } from 'react'
import {
  BookOpen, GraduationCap, User, Plus, X, ChevronDown, ChevronUp,
  Check, Search, AlertCircle, Download, Pencil, Users,
  Settings2, ChevronRight
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useAppConfig } from '../context/AppConfigContext'
import { useToast, ToastContainer, PageSkeleton, ModalPortal } from '../components/UIComponents'
import { exportToExcel } from '../utils/exportToExcel'
import {
  getSubjectLoadData, setMaxPerSection,
  renameSection,
  addBasicEdSubject, removeBasicEdSubject,
  addCollegeSubject, removeCollegeSubject,
  assignBasicEdLoad, assignAdviser, assignCollegeLoad,
} from '../utils/subjectLoadBridge'
import { BASIC_ED_GROUPS, COLLEGE_YEAR_LEVELS } from '../config/appConfig'

const SEMESTERS = ['1st', '2nd']

// ─────────────────────────────────────────────────────────────────
// SHARED MODALS
// ─────────────────────────────────────────────────────────────────

function TeacherPickerModal({ teachers, title, subtitle, currentTeacherId, onSelect, onClose }) {
  const [search, setSearch] = useState('')
  const filtered = teachers.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.email.toLowerCase().includes(search.toLowerCase())
  )
  return (
    <ModalPortal>
    <div className="modal-backdrop">
      <div className="modal-panel modal-panel-md" style={{ maxHeight: '85vh' }}>
        <div className="modal-header">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-[var(--color-text-primary)]">{title}</h3>
            {subtitle && <p className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="icon-btn icon-btn-ghost ml-2 flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-4 pt-3 pb-2 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
            <input autoFocus type="text" placeholder="Search teacher…" value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition" />
          </div>
        </div>
        <div className="overflow-y-auto flex-1 px-2 pb-3">
          {currentTeacherId && (
            <button onClick={() => onSelect(null)}
              className="w-full text-left px-3 py-3 rounded-xl text-sm text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition flex items-center gap-2 mb-1">
              <X className="w-4 h-4" /> Remove assignment
            </button>
          )}
          {filtered.length === 0 && (
            <p className="text-center text-sm text-[var(--color-text-muted)] py-8">No teachers found.</p>
          )}
          {filtered.map(t => (
            <button key={t.id} onClick={() => onSelect(t)}
              className={`w-full text-left px-3 py-3 rounded-xl transition flex items-center gap-3 ${t.id === currentTeacherId ? 'bg-primary/10 dark:bg-primary/20' : 'hover:bg-[var(--color-bg-subtle)]'}`}>
              <div className="w-8 h-8 bg-primary/10 dark:bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-primary dark:text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{t.name}</p>
                <p className="text-xs text-[var(--color-text-muted)] truncate">{t.email}</p>
              </div>
              {t.id === currentTeacherId && <Check className="w-4 h-4 text-primary dark:text-red-400 flex-shrink-0" />}
            </button>
          ))}
        </div>
      </div>
    </div>
    </ModalPortal>
  )
}

function AddSubjectModal({ title, existing, onAdd, onClose }) {
  const [value, setValue] = useState('')
  const trimmed = value.trim()
  const isDupe = existing.map(s => s.toLowerCase()).includes(trimmed.toLowerCase())
  const canAdd = trimmed.length > 0 && !isDupe

  return (
    <ModalPortal>
    <div className="modal-backdrop-center">
      <div className="modal-panel modal-panel-sm p-5">
        <h3 className="text-base font-bold text-[var(--color-text-primary)] mb-1">Add Subject</h3>
        <p className="text-xs text-[var(--color-text-muted)] mb-4">{title}</p>
        <input autoFocus type="text" placeholder="e.g. Philippine History"
          value={value} onChange={e => setValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && canAdd && (onAdd(trimmed), onClose())}
          className={`w-full px-3 py-2.5 text-sm border rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none transition mb-1
            ${isDupe ? 'border-red-400' : 'border-[var(--color-border)] focus:ring-2 focus:ring-primary'}`} />
        {isDupe && <p className="text-xs text-red-500 mb-2">Subject already exists in this level.</p>}
        <div className="action-row mt-3">
          <button onClick={onClose} className="btn-cancel">Cancel</button>
          <button onClick={() => canAdd && (onAdd(trimmed), onClose())} disabled={!canAdd} className="btn-submit">
            Add Subject
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  )
}

function RenameSectionModal({ section, onRename, onClose }) {
  const [value, setValue] = useState(section.displayName)
  return (
    <ModalPortal>
    <div className="modal-backdrop-center">
      <div className="modal-panel modal-panel-sm p-5">
        <h3 className="text-base font-bold text-[var(--color-text-primary)] mb-1">Rename Section</h3>
        <p className="text-xs text-[var(--color-text-muted)] mb-4">Default: {section.defaultName}</p>
        <input autoFocus type="text" placeholder={section.defaultName}
          value={value} onChange={e => setValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && value.trim() && (onRename(value.trim()), onClose())}
          className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition mb-3" />
        <p className="text-xs text-[var(--color-text-muted)] mb-3">
          e.g. "Grade 7 Peridot", "Grade 7 Sapphire"
        </p>
        <div className="action-row">
          <button onClick={onClose} className="btn-cancel">Cancel</button>
          <button onClick={() => { onRename(value.trim() || section.defaultName); onClose() }} className="btn-submit">
            Save Name
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  )
}

// ─────────────────────────────────────────────────────────────────
// SUBJECT ROW — reusable
// ─────────────────────────────────────────────────────────────────
function SubjectRow({ subject, teacherName, teacherId, onAssign, onRemove }) {
  return (
    <div className="flex items-center gap-2 py-2.5 border-b border-[var(--color-border)]/50 last:border-0">
      <p className="flex-1 text-sm text-[var(--color-text-primary)] truncate">{subject}</p>
      {teacherId ? (
        <button onClick={onAssign}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-medium hover:bg-green-200 dark:hover:bg-green-800/40 transition max-w-[160px]">
          <Check className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{teacherName}</span>
          <Pencil className="w-2.5 h-2.5 flex-shrink-0 opacity-60" />
        </button>
      ) : (
        <button onClick={onAssign}
          className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-400 rounded-full text-xs font-medium hover:bg-amber-100 transition">
          <User className="w-3 h-3" /> Assign
        </button>
      )}
      <button onClick={onRemove} title="Remove subject"
        className="p-1.5 text-[var(--color-text-muted)] opacity-50 hover:text-red-500 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition flex-shrink-0">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// BASIC ED TAB
// ─────────────────────────────────────────────────────────────────
function BasicEdTab({ data, teachers, campusKey, schoolYear, onDataChange, addToast }) {
  const [openGrades, setOpenGrades] = useState({})
  const [picker, setPicker] = useState(null)     // { type:'subject'|'adviser', gradeLevel, subject?, sectionId?, load }
  const [addModal, setAddModal] = useState(null) // gradeLevel
  const [renameModal, setRenameModal] = useState(null) // { gradeLevel, section }

  const toggle = g => setOpenGrades(p => ({ ...p, [g]: !p[g] }))

  const allGrades = BASIC_ED_GROUPS.flatMap(g => g.options)
  const totalSubjects = Object.values(data.basicEdSubjects || {}).reduce((s, a) => s + a.length, 0)
  const assignedSubjects = (data.basicEdLoads || []).filter(l => l.teacherId).length
  const totalSections = Object.values(data.basicEdSections || {}).reduce((s, a) => s + a.length, 0)
  const assignedAdvisers = (data.basicEdAdvisers || []).filter(a => a.teacherId).length

  // Group open state — track which department groups are open
  const [openGroups, setOpenGroups] = useState(() =>
    Object.fromEntries(BASIC_ED_GROUPS.map(g => [g.label, true]))
  )
  const toggleGroup = label => setOpenGroups(p => ({ ...p, [label]: !p[label] }))

  const handleSelectTeacher = (teacher) => {
    if (!picker) return
    if (picker.type === 'subject') {
      assignBasicEdLoad(campusKey, schoolYear, picker.gradeLevel, picker.subject, teacher)
      addToast(teacher ? `${teacher.name} assigned to ${picker.subject}` : 'Assignment removed', teacher ? 'success' : 'error')
    } else {
      assignAdviser(campusKey, schoolYear, picker.gradeLevel, picker.sectionId, teacher)
      addToast(teacher ? `${teacher.name} set as adviser` : 'Adviser removed', teacher ? 'success' : 'error')
    }
    onDataChange(); setPicker(null)
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Grade Levels',     value: allGrades.length,                  border: 'border-primary' },
          { label: 'Total Subjects',   value: totalSubjects,                      border: 'border-blue-500' },
          { label: 'Subjects Assigned', value: `${assignedSubjects}/${totalSubjects}`, border: 'border-green-500' },
          { label: 'Advisers Assigned', value: `${assignedAdvisers}/${totalSections}`, border: 'border-violet-500' },
        ].map(({ label, value, border }) => (
          <div key={label} className={`bg-[var(--color-bg-card)] rounded-xl p-3 border-l-4 ${border} shadow-sm`}>
            <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
            <p className="text-lg font-bold text-[var(--color-text-primary)]">{value}</p>
          </div>
        ))}
      </div>

      {/* Grade level accordion — grouped by department */}
      {BASIC_ED_GROUPS.map(group => {
        // Stats for this group
        const groupGrades = group.options
        const groupTotalSubj = groupGrades.reduce((s, g) => s + (data.basicEdSubjects?.[g]?.length || 0), 0)
        const groupAssigned = (data.basicEdLoads || []).filter(l => groupGrades.includes(l.gradeLevel) && l.teacherId).length
        const groupUnassignedAdv = groupGrades.reduce((s, g) => {
          const secs = data.basicEdSections?.[g] || []
          return s + secs.filter(sec => !(data.basicEdAdvisers || []).find(a => a.sectionId === sec.id && a.teacherId)).length
        }, 0)
        const isGroupOpen = openGroups[group.label]

        return (
          <div key={group.label} className="space-y-2">
            {/* Department group header */}
            <button
              onClick={() => toggleGroup(group.label)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-secondary/5 dark:bg-secondary/20 hover:bg-secondary/10 dark:hover:bg-secondary/30 transition"
            >
              <div className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-secondary dark:text-blue-300" />
                <span className="text-sm font-bold text-secondary dark:text-blue-200 uppercase tracking-wide">{group.label}</span>
                <span className="text-xs text-[var(--color-text-muted)]">({groupGrades.length} level{groupGrades.length !== 1 ? 's' : ''})</span>
              </div>
              <div className="flex items-center gap-2">
                {(groupTotalSubj - groupAssigned + groupUnassignedAdv) > 0 ? (
                  <span className="text-xs px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full font-medium">
                    {groupTotalSubj - groupAssigned + groupUnassignedAdv} pending
                  </span>
                ) : groupTotalSubj > 0 ? (
                  <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full font-medium">✓ Complete</span>
                ) : null}
                {isGroupOpen ? <ChevronUp className="w-4 h-4 text-[var(--color-text-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)]" />}
              </div>
            </button>

            {/* Grade levels inside this group */}
            {isGroupOpen && groupGrades.map(grade => {
        const subjects = data.basicEdSubjects?.[grade] || []
        const sections = data.basicEdSections?.[grade] || []
        const loads    = (data.basicEdLoads || []).filter(l => l.gradeLevel === grade)
        const advisers = (data.basicEdAdvisers || [])
        const isOpen   = openGrades[grade]
        const unassignedSubj = subjects.filter(s => !loads.find(l => l.subject === s && l.teacherId)).length
        const unassignedAdv  = sections.filter(s => !advisers.find(a => a.sectionId === s.id && a.teacherId)).length

        return (
          <div key={grade} className="bg-[var(--color-bg-card)] rounded-xl shadow-sm overflow-hidden">
            <button onClick={() => toggle(grade)}
              className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-[var(--color-bg-subtle)]/30 transition">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary/10 dark:bg-primary/20 rounded-lg flex items-center justify-center">
                  <BookOpen className="w-4 h-4 text-primary dark:text-red-400" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">{grade}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {subjects.length} subject{subjects.length !== 1 ? 's' : ''} · {sections.length} section{sections.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {(unassignedSubj > 0 || unassignedAdv > 0) ? (
                  <span className="text-xs px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full font-medium">
                    {unassignedSubj + unassignedAdv} pending
                  </span>
                ) : subjects.length > 0 ? (
                  <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full font-medium">✓ Complete</span>
                ) : null}
                {isOpen ? <ChevronUp className="w-4 h-4 text-[var(--color-text-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)]" />}
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-[var(--color-border)]">
                {/* ── Subjects ── */}
                <div className="px-4 pt-3 pb-2">
                  <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">
                    Subject Teachers <span className="font-normal normal-case">(applies to all sections)</span>
                  </p>
                  {subjects.length === 0 && (
                    <p className="text-sm text-[var(--color-text-muted)] py-2 text-center">No subjects yet.</p>
                  )}
                  {subjects.map(subject => {
                    const load = loads.find(l => l.subject === subject)
                    return (
                      <SubjectRow key={subject} subject={subject}
                        teacherName={load?.teacherName} teacherId={load?.teacherId}
                        onAssign={() => setPicker({ type: 'subject', gradeLevel: grade, subject, load })}
                        onRemove={() => { removeBasicEdSubject(campusKey, schoolYear, grade, subject); onDataChange(); addToast(`"${subject}" removed`, 'success') }}
                      />
                    )
                  })}
                  <button onClick={() => setAddModal(grade)}
                    className="mt-2 flex items-center gap-1.5 text-xs text-primary dark:text-red-400 hover:text-accent-burgundy font-medium transition">
                    <Plus className="w-3.5 h-3.5" /> Add Subject
                  </button>
                </div>

                {/* ── Sections & Advisers ── */}
                {sections.length > 0 && (
                  <div className="px-4 pt-2 pb-3 border-t border-[var(--color-border)]">
                    <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">
                      Sections & Class Advisers
                    </p>
                    <div className="space-y-2">
                      {sections.map(sec => {
                        const adv = advisers.find(a => a.sectionId === sec.id)
                        return (
                          <div key={sec.id} className="flex items-center gap-2 p-2.5 bg-[var(--color-bg-subtle)] rounded-xl">
                            {/* Section name + rename */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{sec.displayName}</p>
                                <button onClick={() => setRenameModal({ gradeLevel: grade, section: sec })}
                                  className="p-0.5 text-[var(--color-text-muted)] hover:text-primary dark:hover:text-red-400 transition flex-shrink-0" title="Rename section">
                                  <Pencil className="w-3 h-3" />
                                </button>
                              </div>
                              <p className="text-xs text-[var(--color-text-muted)]">{sec.studentCount} student{sec.studentCount !== 1 ? 's' : ''}</p>
                            </div>
                            {/* Adviser assignment */}
                            {adv?.teacherId ? (
                              <button onClick={() => setPicker({ type: 'adviser', gradeLevel: grade, sectionId: sec.id, currentTeacherId: adv.teacherId })}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 rounded-full text-xs font-medium hover:bg-violet-200 dark:hover:bg-violet-800/40 transition max-w-[140px]">
                                <Check className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate">{adv.teacherName}</span>
                                <Pencil className="w-2.5 h-2.5 flex-shrink-0 opacity-60" />
                              </button>
                            ) : (
                              <button onClick={() => setPicker({ type: 'adviser', gradeLevel: grade, sectionId: sec.id, currentTeacherId: null })}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700 text-violet-700 dark:text-violet-400 rounded-full text-xs font-medium hover:bg-violet-100 transition">
                                <User className="w-3 h-3" /> Set Adviser
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)] mt-2">
                      Sections are based on approved enrollments ÷ max per section.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
            )
          })}
          </div>
        )
      })}

      {/* Modals */}
      {picker && (
        <TeacherPickerModal
          teachers={teachers}
          title={picker.type === 'adviser' ? 'Assign Class Adviser' : 'Assign Teacher'}
          subtitle={picker.type === 'subject' ? picker.subject : undefined}
          currentTeacherId={picker.load?.teacherId || picker.currentTeacherId}
          onSelect={handleSelectTeacher}
          onClose={() => setPicker(null)}
        />
      )}
      {addModal && (
        <AddSubjectModal
          title={addModal}
          existing={data.basicEdSubjects?.[addModal] || []}
          onAdd={s => { addBasicEdSubject(campusKey, schoolYear, addModal, s); onDataChange(); addToast(`"${s}" added`, 'success') }}
          onClose={() => setAddModal(null)}
        />
      )}
      {renameModal && (
        <RenameSectionModal
          section={renameModal.section}
          onRename={name => { renameSection(campusKey, schoolYear, renameModal.gradeLevel, renameModal.section.id, name); onDataChange(); addToast('Section renamed!', 'success') }}
          onClose={() => setRenameModal(null)}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// COLLEGE TAB
// ─────────────────────────────────────────────────────────────────
function CollegeTab({ data, teachers, campusKey, schoolYear, collegePrograms, onDataChange, addToast }) {
  const [openKeys, setOpenKeys] = useState({})
  const [picker, setPicker]   = useState(null)
  const [addModal, setAddModal] = useState(null)
  const [semFilter, setSemFilter] = useState('1st')

  const toggle = k => setOpenKeys(p => ({ ...p, [k]: !p[k] }))

  // Stats
  let totalSubj = 0, assignedSubj = 0
  collegePrograms.forEach(prog => {
    COLLEGE_YEAR_LEVELS.forEach(yr => {
      const sections = data.collegeSections?.[prog]?.[yr] || []
      SEMESTERS.forEach(sem => {
        const subs = data.collegeSubjects?.[prog]?.[yr]?.[sem] || []
        totalSubj += subs.length * Math.max(1, sections.length)
        subs.forEach(sub => {
          sections.forEach(sec => {
            if (data.collegeLoads?.find(l =>
              l.program === prog && l.yearLevel === yr && l.semester === sem &&
              l.sectionId === sec.id && l.subject === sub && l.teacherId
            )) assignedSubj++
          })
        })
      })
    })
  })

  const handleSelect = (teacher) => {
    if (!picker) return
    assignCollegeLoad(campusKey, schoolYear, picker.program, picker.yearLevel, picker.semester, picker.sectionId, picker.subject, teacher)
    addToast(teacher ? `${teacher.name} assigned` : 'Assignment removed', teacher ? 'success' : 'error')
    onDataChange(); setPicker(null)
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[var(--color-bg-card)] rounded-xl p-3 border-l-4 border-primary shadow-sm">
          <p className="text-xs text-[var(--color-text-muted)]">Total Assignments</p>
          <p className="text-lg font-bold text-[var(--color-text-primary)]">{totalSubj}</p>
        </div>
        <div className="bg-[var(--color-bg-card)] rounded-xl p-3 border-l-4 border-green-500 shadow-sm">
          <p className="text-xs text-[var(--color-text-muted)]">Assigned</p>
          <p className="text-lg font-bold text-[var(--color-text-primary)]">{assignedSubj}/{totalSubj}</p>
        </div>
      </div>

      {/* Semester toggle */}
      <div className="flex gap-2">
        {SEMESTERS.map(sem => (
          <button key={sem} onClick={() => setSemFilter(sem)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${semFilter === sem ? 'bg-primary text-white' : 'bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:border-primary'}`}>
            {sem} Semester
          </button>
        ))}
      </div>

      {collegePrograms.map(program => (
        <div key={program} className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <GraduationCap className="w-4 h-4 text-primary dark:text-red-400" />
            <h3 className="text-sm font-bold text-[var(--color-text-primary)] uppercase tracking-wide">{program}</h3>
          </div>

          {COLLEGE_YEAR_LEVELS.map(yearLevel => {
            const key      = `${program}__${yearLevel}__${semFilter}`
            const isOpen   = openKeys[key]
            const subjects = data.collegeSubjects?.[program]?.[yearLevel]?.[semFilter] || []
            const sections = data.collegeSections?.[program]?.[yearLevel] || []

            // Count unassigned across all sections
            let unassigned = 0
            subjects.forEach(sub => {
              sections.forEach(sec => {
                if (!data.collegeLoads?.find(l =>
                  l.program === program && l.yearLevel === yearLevel &&
                  l.semester === semFilter && l.sectionId === sec.id &&
                  l.subject === sub && l.teacherId
                )) unassigned++
              })
            })

            return (
              <div key={key} className="bg-[var(--color-bg-card)] rounded-xl shadow-sm overflow-hidden">
                <button onClick={() => toggle(key)}
                  className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-[var(--color-bg-subtle)]/30 transition">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-secondary/10 dark:bg-secondary/20 rounded-lg flex items-center justify-center">
                      <BookOpen className="w-4 h-4 text-secondary dark:text-blue-400" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-[var(--color-text-primary)]">{yearLevel}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {subjects.length} subject{subjects.length !== 1 ? 's' : ''} · {sections.length} section{sections.length !== 1 ? 's' : ''} · {semFilter} Sem
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {unassigned > 0 ? (
                      <span className="text-xs px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full font-medium">{unassigned} pending</span>
                    ) : subjects.length > 0 && sections.length > 0 ? (
                      <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full font-medium">✓ Complete</span>
                    ) : null}
                    {isOpen ? <ChevronUp className="w-4 h-4 text-[var(--color-text-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)]" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-[var(--color-border)]">
                    {sections.length === 0 ? (
                      <p className="px-4 py-4 text-sm text-[var(--color-text-muted)] text-center">
                        No sections yet — sections appear automatically once students are enrolled and approved.
                      </p>
                    ) : (
                      /* Per section */
                      sections.map(sec => {
                        const secLoads = (data.collegeLoads || []).filter(l =>
                          l.program === program && l.yearLevel === yearLevel &&
                          l.semester === semFilter && l.sectionId === sec.id
                        )
                        return (
                          <div key={sec.id} className="border-b border-[var(--color-border)] last:border-0">
                            <div className="flex items-center gap-2 px-4 py-2 bg-[var(--color-bg-subtle)]">
                              <Users className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                              <p className="text-xs font-semibold text-[var(--color-text-secondary)]">
                                {sec.displayName}
                              </p>
                              <span className="text-xs text-[var(--color-text-muted)]">· {sec.studentCount} students</span>
                            </div>
                            <div className="px-4 pt-1 pb-2">
                              {subjects.length === 0 && (
                                <p className="text-sm text-[var(--color-text-muted)] py-2 text-center">No subjects yet.</p>
                              )}
                              {subjects.map(subject => {
                                const load = secLoads.find(l => l.subject === subject)
                                return (
                                  <SubjectRow key={subject} subject={subject}
                                    teacherName={load?.teacherName} teacherId={load?.teacherId}
                                    onAssign={() => setPicker({ program, yearLevel, semester: semFilter, sectionId: sec.id, subject, load })}
                                    onRemove={() => { removeCollegeSubject(campusKey, schoolYear, program, yearLevel, semFilter, subject); onDataChange(); addToast(`"${subject}" removed`, 'success') }}
                                  />
                                )
                              })}
                              <button onClick={() => setAddModal({ program, yearLevel, semester: semFilter })}
                                className="mt-2 flex items-center gap-1.5 text-xs text-primary dark:text-red-400 hover:text-accent-burgundy font-medium transition">
                                <Plus className="w-3.5 h-3.5" /> Add Subject
                              </button>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}

      {picker && (
        <TeacherPickerModal
          teachers={teachers}
          title="Assign Instructor"
          subtitle={`${picker.subject} · ${picker.yearLevel} · ${picker.semester} Sem`}
          currentTeacherId={picker.load?.teacherId}
          onSelect={handleSelect}
          onClose={() => setPicker(null)}
        />
      )}
      {addModal && (
        <AddSubjectModal
          title={`${addModal.program} — ${addModal.yearLevel} — ${addModal.semester} Semester`}
          existing={data.collegeSubjects?.[addModal.program]?.[addModal.yearLevel]?.[addModal.semester] || []}
          onAdd={s => { addCollegeSubject(campusKey, schoolYear, addModal.program, addModal.yearLevel, addModal.semester, s); onDataChange(); addToast(`"${s}" added`, 'success') }}
          onClose={() => setAddModal(null)}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// SETTINGS PANEL — max per section
// ─────────────────────────────────────────────────────────────────
function SettingsPanel({ maxPerSection, campusKey, schoolYear, campusName, collegePrograms, onDataChange, addToast, onClose }) {
  const [value, setValue] = useState(String(maxPerSection))
  const n = parseInt(value, 10)
  const valid = !isNaN(n) && n >= 1 && n <= 100

  return (
    <ModalPortal>
    <div className="modal-backdrop-center">
      <div className="modal-panel modal-panel-sm p-5">
        <h3 className="text-base font-bold text-[var(--color-text-primary)] mb-1">Section Settings</h3>
        <p className="text-xs text-[var(--color-text-muted)] mb-5">Sections are auto-calculated based on approved enrollments.</p>

        <label className="block text-sm font-semibold text-[var(--color-text-secondary)] mb-2">
          Max Students per Section
        </label>
        <input type="number" min="1" max="100" value={value}
          onChange={e => setValue(e.target.value)}
          className={`w-full px-3 py-2.5 text-sm border rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none transition mb-1
            ${!valid && value ? 'border-red-400' : 'border-[var(--color-border)] focus:ring-2 focus:ring-primary'}`} />
        {!valid && value && <p className="text-xs text-red-500 mb-2">Enter a number between 10 and 100.</p>}
        <p className="text-xs text-[var(--color-text-muted)] mb-4">
          Example: 40 students → 2 sections if max is 25, 1 section if max is 40.
        </p>

        <div className="action-row">
          <button onClick={onClose} className="btn-cancel">Cancel</button>
          <button disabled={!valid} onClick={() => {
            setMaxPerSection(campusKey, schoolYear, campusName, collegePrograms, n)
            onDataChange()
            addToast(`Max per section updated to ${n}`, 'success')
            onClose()
          }} className="btn-submit">
            Save
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  )
}

// ─────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────
export default function SubjectLoad() {
  const { user }    = useAuth()
  const { activeCampuses, currentSchoolYear, systemUsers } = useAppConfig()
  const { toasts, addToast, removeToast } = useToast()

  const role     = user?.role
  const campus   = activeCampuses.find(c => c.name === user?.campus)
  const campusKey  = campus?.key    || ''
  const campusName = campus?.name   || user?.campus || ''
  const collegePrograms = campus?.collegePrograms || []

  const [activeTab,     setActiveTab]     = useState((role === 'program_head' || role === 'registrar_college') ? 'college' : 'basicEd')
  const [loading,       setLoading]       = useState(true)
  const [data,          setData]          = useState(null)
  const [showSettings,  setShowSettings]  = useState(false)

  // Teachers pool — same campus, all teaching-eligible roles
  // Includes principal_basic so they can be assigned to college minor subjects
  const teachers = (systemUsers || []).filter(u =>
    u.status === 'active' &&
    (u.campus === campusName || u.campus === 'all') &&
    ['teacher_basic', 'instructor_college', 'registrar_basic',
     'registrar_college', 'principal_basic', 'program_head'].includes(u.role)
  ).map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role }))

  const reload = useCallback(() => {
    const d = getSubjectLoadData(campusKey, currentSchoolYear, campusName, collegePrograms)
    setData(d)
  }, [campusKey, currentSchoolYear, campusName])

  useEffect(() => {
    reload()
    const t = setTimeout(() => setLoading(false), 100)
    return () => clearTimeout(t)
  }, [reload])

  useEffect(() => {
    // Reload when subject assignments change
    window.addEventListener('cshc_subject_load_updated', reload)
    // Also reload when an enrollment is approved — sections may have changed
    const handleEnrollmentUpdate = () => reload()
    window.addEventListener('cshc_enrollment_updated', handleEnrollmentUpdate)
    // Cross-tab: another tab approves an enrollment
    const handleStorage = (e) => {
      if (e.key === 'cshc_submissions' || e.key === null) reload()
    }
    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener('cshc_subject_load_updated', reload)
      window.removeEventListener('cshc_enrollment_updated', handleEnrollmentUpdate)
      window.removeEventListener('storage', handleStorage)
    }
  }, [reload])

  const handleExport = () => {
    if (!data) return
    const rows = []
    // Basic Ed
    Object.entries(data.basicEdSubjects || {}).forEach(([grade, subjects]) => {
      const sections = data.basicEdSections?.[grade] || []
      subjects.forEach(subject => {
        const load = data.basicEdLoads?.find(l => l.gradeLevel === grade && l.subject === subject)
        rows.push({ Dept: 'Basic Ed', Level: grade, Section: sections.map(s => s.displayName).join(', ') || '—', Semester: '', Subject: subject, Teacher: load?.teacherName || '— Unassigned —' })
      })
      sections.forEach(sec => {
        const adv = data.basicEdAdvisers?.find(a => a.sectionId === sec.id)
        rows.push({ Dept: 'Basic Ed', Level: grade, Section: sec.displayName, Semester: '', Subject: '(Class Adviser)', Teacher: adv?.teacherName || '— Unassigned —' })
      })
    })
    // College
    Object.entries(data.collegeSubjects || {}).forEach(([prog, years]) => {
      Object.entries(years || {}).forEach(([yr, sems]) => {
        const sections = data.collegeSections?.[prog]?.[yr] || []
        Object.entries(sems || {}).forEach(([sem, subjects]) => {
          sections.forEach(sec => {
            subjects.forEach(subject => {
              const load = data.collegeLoads?.find(l =>
                l.program === prog && l.yearLevel === yr && l.semester === sem &&
                l.sectionId === sec.id && l.subject === subject
              )
              rows.push({ Dept: 'College', Level: `${prog} ${yr}`, Section: sec.displayName, Semester: `${sem} Sem`, Subject: subject, Teacher: load?.teacherName || '— Unassigned —' })
            })
          })
        })
      })
    })
    exportToExcel(rows, `SubjectLoad_${campusKey}_${currentSchoolYear.replace('-','_')}`, 'Subject Load')
    addToast('Subject load exported!', 'success')
  }

  if (loading || !data) return <PageSkeleton title="Subject Load Management" />

  const tabs = [
    ...(role === 'principal_basic' ? [{ id: 'basicEd', label: 'Basic Education', icon: BookOpen }] : []),
    ...(role === 'program_head' || role === 'registrar_college' ? [{ id: 'college', label: 'College', icon: GraduationCap }] : []),
  ]

  return (
    <div className="animate-fade-in space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)]">Subject Load</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {currentSchoolYear} · {campusName}
            {role === 'registrar_college' && (
              <span className="ml-2 text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full font-medium">Managing on behalf of Program Head</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 self-start">
          <button onClick={() => setShowSettings(true)}
            className="p-2 text-[var(--color-text-muted)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-subtle)] transition" title="Section settings">
            <Settings2 className="w-4 h-4" />
          </button>
          <button onClick={handleExport}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium">
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      {/* No teachers warning */}
      {teachers.length === 0 && (
        <div className="flex items-start gap-3 px-4 py-3.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">No teachers found for this campus</p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
              Ask your Technical Administrator to add teacher accounts in Settings → Users, then assign them here.
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      {tabs.length > 1 && (
        <div className="flex gap-2 border-b border-[var(--color-border)]">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${
                activeTab === tab.id
                  ? 'border-primary text-primary dark:text-red-400'
                  : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              }`}>
              <tab.icon className="w-4 h-4" /> {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {activeTab === 'basicEd' && (
        <BasicEdTab data={data} teachers={teachers} campusKey={campusKey}
          schoolYear={currentSchoolYear} onDataChange={reload} addToast={addToast} />
      )}
      {activeTab === 'college' && (
        <CollegeTab data={data} teachers={teachers} campusKey={campusKey}
          schoolYear={currentSchoolYear} collegePrograms={collegePrograms}
          onDataChange={reload} addToast={addToast} />
      )}

      {/* Settings modal */}
      {showSettings && (
        <SettingsPanel
          maxPerSection={data.maxPerSection || 40}
          campusKey={campusKey} schoolYear={currentSchoolYear}
          campusName={campusName} collegePrograms={collegePrograms}
          onDataChange={reload} addToast={addToast}
          onClose={() => setShowSettings(false)}
        />
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  )
}