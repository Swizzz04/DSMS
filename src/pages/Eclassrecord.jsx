/**
 * EClassRecord.jsx
 * ─────────────────────────────────────────────────────────────────
 * e-Class Record — matches the school's Excel grading template.
 *
 * Layout per quarter sheet:
 *   WRITTEN WORKS: multiple columns (Quiz1, Quiz2, HW1...)
 *   PERFORMANCE TASKS: multiple columns (Demo1, Presentation...)
 *   QUARTERLY ASSESSMENT: usually 1 column (Exam)
 *   Then: TOTAL | PS | WS for each component
 *   Then: INITIAL GRADE | TRANSMUTED GRADE
 *
 * Teacher flow:
 *   1. Select subject from list
 *   2. Configure activities (add Quiz 1 = 15pts, Quiz 2 = 20pts, etc.)
 *   3. Enter student scores in spreadsheet-like table
 *   4. System auto-computes everything
 *   5. Save draft → Submit for approval
 * ─────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useRef } from 'react'
import {
  ClipboardList, BookOpen, Users, ChevronRight, ChevronDown,
  Save, Send, ArrowLeft, Plus, Trash2, Info, AlertCircle, X, Settings, Download
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useAppConfig } from '../context/AppConfigContext'
import { CampusBanner } from '../components/SchoolComponents'
import { PageSkeleton, useToast, ToastContainer, ModalPortal } from '../components/UIComponents'
import GroupedSelect from '../components/GroupedSelect'
import {
  SUBJECT_AREAS, GRADING_PERIODS, WEIGHT_TABLES,
  computeGrade, transmute, getAllGrades, saveGradeRecord, submitGrades
} from '../utils/gradingEngine'
import { exportEClassRecord } from '../utils/exportEClassRecord'

// ── localStorage key for activity configs ──────────────────
const ACTIVITIES_KEY = 'cshc_grade_activities'
const DRAFT_SCORES_KEY = 'cshc_draft_scores'

function loadActivities() {
  try { return JSON.parse(localStorage.getItem(ACTIVITIES_KEY) || '{}') } catch { return {} }
}
function saveActivitiesConfig(data) {
  localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(data))
}
function loadDraftScores() {
  try { return JSON.parse(localStorage.getItem(DRAFT_SCORES_KEY) || '{}') } catch { return {} }
}
function saveDraftScores(data) {
  localStorage.setItem(DRAFT_SCORES_KEY, JSON.stringify(data))
}

export default function EClassRecord() {
  const { user } = useAuth()
  const { config } = useAppConfig()
  const [loading, setLoading] = useState(true)
  const { toasts, addToast, removeToast } = useToast()

  const [selectedSubject, setSelectedSubject] = useState(null)
  const [gradingPeriod, setGradingPeriod] = useState('Q1')
  const [subjectArea, setSubjectArea] = useState('')
  const [studentGrades, setStudentGrades] = useState([])
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const [showActivitySetup, setShowActivitySetup] = useState(false)
  const [saving, setSaving] = useState(false)
  const tableRef = useRef(null)

  // Activities config: { ww: [{name, maxScore}], pt: [...], qa: [...] }
  const [activities, setActivities] = useState({ ww: [], pt: [], qa: [] })

  // Draft score key for auto-save
  const draftKey = (subj, period) => `${subj?.subjectId}_${subj?.sectionId}_${period}_${currentSY}`

  useEffect(() => { setTimeout(() => setLoading(false), 150) }, [])

  const isTeacher = user?.role === 'teacher'
  const campusKey = user?.campusKey || ''

  // Read active school year
  const activeSY = (() => {
    try {
      const saved = JSON.parse(localStorage.getItem('cshc_app_config') || '{}')
      const years = saved.schoolYears || config?.schoolYears || []
      return years.find(sy => sy.isCurrent) || years[0] || {}
    } catch { return {} }
  })()
  const currentSY = activeSY.year || '2026-2027'
  const periodType = activeSY.gradingPeriodType || 'quarterly'
  const isTrimester = periodType === 'trimester'
  const periods = GRADING_PERIODS[periodType] || GRADING_PERIODS.quarterly

  // ── Subject loads ──────────────────────────────────────────
  const subjectLoads = (() => {
    try {
      const raw = localStorage.getItem('cshc_subject_loads')
      if (!raw) return []
      const all = JSON.parse(raw)
      const campusData = all[campusKey]
      if (!campusData) return []
      const syData = campusData[currentSY]
      if (!syData) return []

      const loads = []
      if (syData.basicEdLoads) {
        syData.basicEdLoads.forEach(load => {
          if (load.teacherId === user?.id || load.teacherName === user?.name) {
            const sections = syData.basicEdSections?.[load.gradeLevel] || []
            sections.forEach(sec => {
              loads.push({
                subjectId: `${load.gradeLevel}_${load.subject}`,
                subjectName: load.subject,
                gradeLevel: load.gradeLevel,
                section: sec.displayName || sec.defaultName,
                sectionId: sec.id,
                teacherId: load.teacherId,
                teacherName: load.teacherName,
                campusKey,
                department: 'basicEd',
              })
            })
          }
        })
      }
      if (syData.collegeLoads) {
        syData.collegeLoads.forEach(load => {
          if (load.teacherId === user?.id || load.teacherName === user?.name) {
            loads.push({
              subjectId: `${load.program}_${load.yearLevel}_${load.subject}`,
              subjectName: load.subject,
              gradeLevel: `${load.program} - ${load.yearLevel}`,
              section: load.sectionName || load.sectionId,
              sectionId: load.sectionId,
              teacherId: load.teacherId,
              teacherName: load.teacherName,
              campusKey,
              department: 'college',
            })
          }
        })
      }
      return loads
    } catch { return [] }
  })()

  const allMyGrades = getAllGrades({ teacherId: isTeacher ? user?.id : undefined, campusKey })

  // Group by section
  const grouped = {}
  subjectLoads.forEach(sl => {
    const key = sl.sectionId || sl.section
    if (!grouped[key]) grouped[key] = { section: sl.section, gradeLevel: sl.gradeLevel, subjects: [] }
    const gradeCount = allMyGrades.filter(g => g.subjectId === sl.subjectId && g.sectionId === sl.sectionId).length
    grouped[key].subjects.push({ ...sl, gradeCount })
  })
  const sections = Object.values(grouped)

  // ── Get students ───────────────────────────────────────────
  const getStudents = (gradeLevel, campKey) => {
    try {
      const subs = JSON.parse(localStorage.getItem('cshc_submissions') || '[]')
      let campusName = user?.campus || ''
      try {
        const savedCfg = JSON.parse(localStorage.getItem('cshc_app_config') || '{}')
        const c = (savedCfg.campuses || []).find(c => c.key === campKey)
        if (c?.name) campusName = c.name
      } catch {}

      return subs
        .filter(s => {
          if (s.status !== 'approved') return false
          const eCampus = s.enrollment?.campus || ''
          return (eCampus === campusName || eCampus.includes(campKey)) && s.enrollment?.gradeLevel === gradeLevel
        })
        .map(s => ({
          id: s.id,
          name: `${s.lastName || ''}, ${s.firstName || ''} ${s.middleName || ''}`.trim(),
          gender: s.gender || s.sex || '',
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
    } catch { return [] }
  }

  // ── Activity config key ────────────────────────────────────
  const activityKey = (subj) => `${subj.subjectId}_${subj.sectionId}_${gradingPeriod}_${currentSY}`

  // ── Open grade entry ───────────────────────────────────────
  const openGradeEntry = (subj) => {
    setSelectedSubject(subj)
    setSubjectArea('')

    // Load saved activities config for this subject+period
    const allActs = loadActivities()
    const key = `${subj.subjectId}_${subj.sectionId}_${gradingPeriod}_${currentSY}`
    const savedActs = allActs[key] || { ww: [], pt: [], qa: [] }

    // If no activities configured yet, show setup
    if (savedActs.ww.length === 0 && savedActs.pt.length === 0 && savedActs.qa.length === 0) {
      // Default starter activities
      savedActs.ww = [{ name: 'Quiz 1', maxScore: 20 }]
      savedActs.pt = [{ name: 'Activity 1', maxScore: 50 }]
      savedActs.qa = [{ name: 'Quarterly Exam', maxScore: 100 }]
    }
    setActivities(savedActs)

    // Get students and build grade rows
    const students = getStudents(subj.gradeLevel, subj.campusKey)
    buildGradeRows(students, savedActs, subj, gradingPeriod)
  }

  // ── Build grade rows from students + activities ────────────
  const buildGradeRows = (students, acts, subj, period) => {
    // Load saved draft scores
    const allDrafts = loadDraftScores()
    const key = draftKey(subj || selectedSubject, period || gradingPeriod)
    const savedScores = allDrafts[key] || {}

    // Helper: ensure score array matches activity count
    const alignScores = (savedArr, actArr) => {
      const target = (actArr || []).length
      if (!savedArr || savedArr.length === 0) return Array(target).fill('')
      if (savedArr.length === target) return [...savedArr]
      if (savedArr.length < target) return [...savedArr, ...Array(target - savedArr.length).fill('')]
      return savedArr.slice(0, target) // trim excess
    }

    const rows = students.map(stu => {
      const saved = savedScores[stu.id]
      return {
        studentId: stu.id,
        studentName: stu.name,
        gender: stu.gender,
        // Always align saved scores to current activity count
        ww: alignScores(saved?.ww, acts.ww),
        pt: alignScores(saved?.pt, acts.pt),
        qa: alignScores(saved?.qa, acts.qa),
        computed: null,
        status: saved?.status || 'draft',
      }
    })
    setStudentGrades(rows)
  }

  // ── Save activities config ─────────────────────────────────
  const saveActivityConfig = (newActs) => {
    if (!selectedSubject) return
    const allActs = loadActivities()
    const key = activityKey(selectedSubject)
    allActs[key] = newActs
    saveActivitiesConfig(allActs)
    setActivities(newActs)

    // Rebuild grade rows to match new activity count
    const students = getStudents(selectedSubject.gradeLevel, selectedSubject.campusKey)
    buildGradeRows(students, newActs, selectedSubject, gradingPeriod)
    addToast('Activities updated', 'success')
    setShowActivitySetup(false)
  }

  // ── Update score (auto-saves to localStorage) ──────────────
  const updateScore = (studentIdx, component, actIdx, value) => {
    setStudentGrades(prev => {
      const updated = [...prev]
      const row = { ...updated[studentIdx] }
      const scores = [...row[component]]
      scores[actIdx] = value === '' ? '' : Number(value) || 0
      row[component] = scores

      // Auto-compute if subject area selected and not trimester
      if (!isTrimester && subjectArea) {
        const wwTotal = row.ww.reduce((s, v) => s + (Number(v) || 0), 0)
        const wwMax = activities.ww.reduce((s, a) => s + (a.maxScore || 0), 0)
        const ptTotal = row.pt.reduce((s, v) => s + (Number(v) || 0), 0)
        const ptMax = activities.pt.reduce((s, a) => s + (a.maxScore || 0), 0)
        const qaTotal = row.qa.reduce((s, v) => s + (Number(v) || 0), 0)
        const qaMax = activities.qa.reduce((s, a) => s + (a.maxScore || 0), 0)

        const hasScores = row.ww.some(v => v !== '') || row.pt.some(v => v !== '') || row.qa.some(v => v !== '')
        if (hasScores && wwMax > 0 && ptMax > 0 && qaMax > 0) {
          try {
            const result = computeGrade(
              { ww: { score: wwTotal, total: wwMax }, pt: { score: ptTotal, total: ptMax }, qa: { score: qaTotal, total: qaMax } },
              subjectArea
            )
            row.computed = result
          } catch { row.computed = null }
        }
      }

      updated[studentIdx] = row

      // Auto-save all scores to localStorage (prevents data loss on refresh)
      try {
        const allDrafts = loadDraftScores()
        const key = draftKey(selectedSubject, gradingPeriod)
        if (!allDrafts[key]) allDrafts[key] = {}
        updated.forEach(r => {
          const hasAny = r.ww.some(v => v !== '') || r.pt.some(v => v !== '') || r.qa.some(v => v !== '')
          if (hasAny) {
            allDrafts[key][r.studentId] = { ww: r.ww, pt: r.pt, qa: r.qa, status: r.status }
          }
        })
        saveDraftScores(allDrafts)
      } catch {}

      return updated
    })
  }

  // ── Save draft ─────────────────────────────────────────────
  const handleSaveDraft = () => {
    if (!subjectArea) { addToast('Please select a subject area first', 'error'); return }
    setSaving(true)
    let count = 0
    studentGrades.forEach(row => {
      const hasAny = row.ww.some(v => v !== '') || row.pt.some(v => v !== '') || row.qa.some(v => v !== '')
      if (!hasAny) return

      const wwTotal = row.ww.reduce((s, v) => s + (Number(v) || 0), 0)
      const wwMax = activities.ww.reduce((s, a) => s + (a.maxScore || 0), 0)
      const ptTotal = row.pt.reduce((s, v) => s + (Number(v) || 0), 0)
      const ptMax = activities.pt.reduce((s, a) => s + (a.maxScore || 0), 0)
      const qaTotal = row.qa.reduce((s, v) => s + (Number(v) || 0), 0)
      const qaMax = activities.qa.reduce((s, a) => s + (a.maxScore || 0), 0)

      saveGradeRecord({
        studentId: row.studentId, studentName: row.studentName,
        subjectId: selectedSubject.subjectId, subjectName: selectedSubject.subjectName,
        subjectArea, sectionId: selectedSubject.sectionId, campusKey,
        schoolYear: currentSY, period: gradingPeriod,
        teacherId: user?.id, teacherName: user?.name,
        ww: { score: wwTotal, total: wwMax }, pt: { score: ptTotal, total: ptMax }, qa: { score: qaTotal, total: qaMax },
        // Store individual scores for later editing
        wwScores: row.ww, ptScores: row.pt, qaScores: row.qa,
        status: 'draft',
      })
      count++
    })
    setSaving(false)
    addToast(`${count} grade${count !== 1 ? 's' : ''} saved as draft`, 'success')
  }

  // ── Submit ─────────────────────────────────────────────────
  const handleSubmit = () => {
    handleSaveDraft()
    const count = submitGrades(user?.id, selectedSubject.subjectId, selectedSubject.sectionId, gradingPeriod, currentSY)
    setShowSubmitConfirm(false)
    addToast(`${count} grade${count !== 1 ? 's' : ''} submitted for approval!`, 'success')
    setStudentGrades(prev => prev.map(row => {
      const hasAny = row.ww.some(v => v !== '') || row.pt.some(v => v !== '') || row.qa.some(v => v !== '')
      return { ...row, status: hasAny ? 'submitted' : row.status }
    }))
  }

  // ── Export to Excel ──────────────────────────────────────────
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    if (!subjectArea) { addToast('Please select a subject area first', 'error'); return }
    setExporting(true)

    try {
      // Get school name from config
      let schoolName = 'School'
      try {
        const wc = JSON.parse(localStorage.getItem('cshc_website_content') || '{}')
        schoolName = wc.schoolName || 'School'
      } catch {}

      // Gather activities and scores for ALL periods
      const allActs = loadActivities()
      const allDrafts = loadDraftScores()
      const activitiesByPeriod = {}
      const scoresByPeriod = {}

      periods.forEach(p => {
        const key = draftKey(selectedSubject, p.id)
        activitiesByPeriod[p.id] = allActs[key] || activities
        scoresByPeriod[p.id] = allDrafts[key] || {}
      })

      const students = studentGrades.map(r => ({ id: r.studentId, name: r.studentName, gender: r.gender }))

      const filename = await exportEClassRecord({
        subjectName: selectedSubject.subjectName,
        section: selectedSubject.section,
        gradeLevel: selectedSubject.gradeLevel,
        teacherName: user?.name || '',
        schoolYear: currentSY,
        schoolName,
        periodType,
        subjectArea,
        activitiesByPeriod,
        scoresByPeriod,
        students,
      })
      addToast(`Exported: ${filename}`, 'success')
    } catch (err) {
      addToast('Export failed: ' + (err.message || 'Unknown error'), 'error')
    } finally {
      setExporting(false)
    }
  }

  // ── Computed stats ─────────────────────────────────────────
  const filledCount = studentGrades.filter(r => r.ww.some(v => v !== '') || r.pt.some(v => v !== '') || r.qa.some(v => v !== '')).length
  const computedCount = studentGrades.filter(r => r.computed).length
  const draftCount = studentGrades.filter(r => r.status === 'draft' && (r.ww.some(v => v !== '') || r.pt.some(v => v !== ''))).length

  if (loading) return <PageSkeleton />

  // ═══════════════════════════════════════════════════════════
  // VIEW: Grade Entry
  // ═══════════════════════════════════════════════════════════
  if (selectedSubject) {
    const weights = WEIGHT_TABLES[subjectArea]
    const wwColCount = activities.ww.length
    const ptColCount = activities.pt.length
    const qaColCount = activities.qa.length

    return (
      <div className="page-enter space-y-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <button onClick={() => setSelectedSubject(null)} className="mt-1 p-2 rounded-lg hover:bg-[var(--color-bg-subtle)] transition text-[var(--color-text-muted)]">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">{selectedSubject.subjectName}</h1>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{selectedSubject.section} · {selectedSubject.gradeLevel} · {currentSY}</p>
          </div>
        </div>

        {/* Config row */}
        <div className="card p-4">
          {isTrimester && (
            <div className="flex items-center gap-2 p-3 mb-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-700 dark:text-amber-300">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              Trimester mode — grade entry available but auto-computation disabled until DepEd releases guidelines.
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="form-label mb-1">Grading Period</label>
              <GroupedSelect value={gradingPeriod} onChange={v => { setGradingPeriod(v); openGradeEntry(selectedSubject) }} allLabel={null}
                options={periods.map(p => ({ value: p.id, label: p.label }))} />
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1">{isTrimester ? 'Trimester' : 'Quarterly'} · Set by principal</p>
            </div>
            <div>
              <label className="form-label mb-1">Subject Area</label>
              <GroupedSelect value={subjectArea} onChange={setSubjectArea} allLabel="Select subject area..."
                options={SUBJECT_AREAS.map(sa => ({ value: sa.id, label: sa.label }))} />
            </div>
          </div>
          <div className="mt-3">
            <button onClick={() => setShowActivitySetup(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-subtle)] transition text-[var(--color-text-secondary)]">
              <Settings className="w-3.5 h-3.5" /> Configure Activities
            </button>
          </div>
          {subjectArea && weights && (
            <div className="mt-3 pt-3 border-t border-[var(--color-border)] flex flex-wrap gap-4 text-xs text-[var(--color-text-muted)]">
              <span className="flex items-center gap-1"><Info className="w-3 h-3" /> Weights:</span>
              <span>WW: <strong className="text-[var(--color-text-primary)]">{weights.ww * 100}%</strong></span>
              <span>PT: <strong className="text-[var(--color-text-primary)]">{weights.pt * 100}%</strong></span>
              <span>QA: <strong className="text-[var(--color-text-primary)]">{weights.qa * 100}%</strong></span>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="px-3 py-1.5 rounded-lg bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)]">{studentGrades.length} students</span>
          <span className="px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">{filledCount} entered</span>
          <span className="px-3 py-1.5 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300">{computedCount} computed</span>
        </div>

        {!subjectArea && (
          <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-700 dark:text-amber-300">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> Select a Subject Area to enable auto-computation.
          </div>
        )}

        {/* Grade entry table */}
        {studentGrades.length === 0 ? (
          <div className="card p-8 text-center">
            <Users className="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-3" />
            <h3 className="text-sm font-bold text-[var(--color-text-primary)] mb-1">No Students Found</h3>
            <p className="text-xs text-[var(--color-text-muted)]">No approved enrollments found for {selectedSubject.gradeLevel}. Make sure you've seeded test data or have approved enrollments.</p>
          </div>
        ) : (
          <div className="min-w-0 card overflow-hidden" ref={tableRef}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs" style={{ minWidth: `${300 + (wwColCount + ptColCount + qaColCount + 7) * 60}px` }}>
                <thead>
                  {/* Component group headers */}
                  <tr className="bg-[var(--color-bg-subtle)]">
                    <th className="px-2 py-2 text-left font-semibold text-[var(--color-text-primary)] border-b border-[var(--color-border)] sticky left-0 bg-[var(--color-bg-subtle)] z-10" rowSpan={2} style={{ minWidth: 30 }}>#</th>
                    <th className="px-2 py-2 text-left font-semibold text-[var(--color-text-primary)] border-b border-[var(--color-border)] sticky left-8 bg-[var(--color-bg-subtle)] z-10" rowSpan={2} style={{ minWidth: 180 }}>Student Name</th>
                    {wwColCount > 0 && <th colSpan={wwColCount + 3} className="px-2 py-2 text-center font-bold text-primary border-b border-l border-[var(--color-border)] bg-red-50/50 dark:bg-red-900/10">WRITTEN WORKS</th>}
                    {ptColCount > 0 && <th colSpan={ptColCount + 3} className="px-2 py-2 text-center font-bold text-blue-700 dark:text-blue-400 border-b border-l border-[var(--color-border)] bg-blue-50/50 dark:bg-blue-900/10">PERFORMANCE TASKS</th>}
                    {qaColCount > 0 && <th colSpan={qaColCount + 3} className="px-2 py-2 text-center font-bold text-green-700 dark:text-green-400 border-b border-l border-[var(--color-border)] bg-green-50/50 dark:bg-green-900/10">QUARTERLY ASSESSMENT</th>}
                    <th className="px-2 py-2 text-center font-bold border-b border-l border-[var(--color-border)]" rowSpan={2}>Initial</th>
                    <th className="px-2 py-2 text-center font-bold border-b border-l border-[var(--color-border)]" rowSpan={2}>Grade</th>
                  </tr>
                  {/* Activity name headers */}
                  <tr className="bg-[var(--color-bg-subtle)]/60">
                    {activities.ww.map((a, i) => <th key={`ww${i}`} className="px-1 py-1.5 text-center font-medium text-[var(--color-text-muted)] border-b border-[var(--color-border)] bg-red-50/30 dark:bg-red-900/5" style={{ minWidth: 50 }} title={a.name}>{a.name}</th>)}
                    <th className="px-1 py-1.5 text-center font-semibold text-[var(--color-text-secondary)] border-b border-[var(--color-border)] bg-red-50/30 dark:bg-red-900/5">Total</th>
                    <th className="px-1 py-1.5 text-center font-semibold text-[var(--color-text-secondary)] border-b border-[var(--color-border)] bg-red-50/30 dark:bg-red-900/5">PS</th>
                    <th className="px-1 py-1.5 text-center font-semibold text-[var(--color-text-secondary)] border-b border-[var(--color-border)] bg-red-50/30 dark:bg-red-900/5">WS</th>
                    {activities.pt.map((a, i) => <th key={`pt${i}`} className="px-1 py-1.5 text-center font-medium text-[var(--color-text-muted)] border-b border-l border-[var(--color-border)] bg-blue-50/30 dark:bg-blue-900/5" style={{ minWidth: 50 }} title={a.name}>{a.name}</th>)}
                    <th className="px-1 py-1.5 text-center font-semibold text-[var(--color-text-secondary)] border-b border-[var(--color-border)] bg-blue-50/30 dark:bg-blue-900/5">Total</th>
                    <th className="px-1 py-1.5 text-center font-semibold text-[var(--color-text-secondary)] border-b border-[var(--color-border)] bg-blue-50/30 dark:bg-blue-900/5">PS</th>
                    <th className="px-1 py-1.5 text-center font-semibold text-[var(--color-text-secondary)] border-b border-[var(--color-border)] bg-blue-50/30 dark:bg-blue-900/5">WS</th>
                    {activities.qa.map((a, i) => <th key={`qa${i}`} className="px-1 py-1.5 text-center font-medium text-[var(--color-text-muted)] border-b border-l border-[var(--color-border)] bg-green-50/30 dark:bg-green-900/5" style={{ minWidth: 50 }} title={a.name}>{a.name}</th>)}
                    <th className="px-1 py-1.5 text-center font-semibold text-[var(--color-text-secondary)] border-b border-[var(--color-border)] bg-green-50/30 dark:bg-green-900/5">Total</th>
                    <th className="px-1 py-1.5 text-center font-semibold text-[var(--color-text-secondary)] border-b border-[var(--color-border)] bg-green-50/30 dark:bg-green-900/5">PS</th>
                    <th className="px-1 py-1.5 text-center font-semibold text-[var(--color-text-secondary)] border-b border-[var(--color-border)] bg-green-50/30 dark:bg-green-900/5">WS</th>
                  </tr>
                  {/* Highest Possible Score row */}
                  <tr className="bg-amber-50/50 dark:bg-amber-900/10">
                    <td colSpan={2} className="px-2 py-1.5 text-[10px] font-bold text-amber-700 dark:text-amber-400 sticky left-0 bg-amber-50/50 dark:bg-amber-900/10 z-10">HIGHEST POSSIBLE SCORE</td>
                    {activities.ww.map((a, i) => <td key={`mww${i}`} className="px-1 py-1.5 text-center font-bold text-amber-700 dark:text-amber-400 text-[10px]">{a.maxScore}</td>)}
                    <td className="px-1 py-1.5 text-center font-bold text-amber-700 dark:text-amber-400 text-[10px]">{activities.ww.reduce((s, a) => s + (a.maxScore || 0), 0)}</td>
                    <td className="px-1 py-1.5 text-center text-[10px] text-amber-600/60">100</td>
                    <td className="px-1 py-1.5 text-center text-[10px] text-amber-600/60">{weights ? `${weights.ww * 100}%` : '-'}</td>
                    {activities.pt.map((a, i) => <td key={`mpt${i}`} className="px-1 py-1.5 text-center font-bold text-amber-700 dark:text-amber-400 text-[10px] border-l border-[var(--color-border)]">{a.maxScore}</td>)}
                    <td className="px-1 py-1.5 text-center font-bold text-amber-700 dark:text-amber-400 text-[10px]">{activities.pt.reduce((s, a) => s + (a.maxScore || 0), 0)}</td>
                    <td className="px-1 py-1.5 text-center text-[10px] text-amber-600/60">100</td>
                    <td className="px-1 py-1.5 text-center text-[10px] text-amber-600/60">{weights ? `${weights.pt * 100}%` : '-'}</td>
                    {activities.qa.map((a, i) => <td key={`mqa${i}`} className="px-1 py-1.5 text-center font-bold text-amber-700 dark:text-amber-400 text-[10px] border-l border-[var(--color-border)]">{a.maxScore}</td>)}
                    <td className="px-1 py-1.5 text-center font-bold text-amber-700 dark:text-amber-400 text-[10px]">{activities.qa.reduce((s, a) => s + (a.maxScore || 0), 0)}</td>
                    <td className="px-1 py-1.5 text-center text-[10px] text-amber-600/60">100</td>
                    <td className="px-1 py-1.5 text-center text-[10px] text-amber-600/60">{weights ? `${weights.qa * 100}%` : '-'}</td>
                    <td className="px-1 py-1.5 border-l border-[var(--color-border)]"></td>
                    <td className="px-1 py-1.5 border-l border-[var(--color-border)]"></td>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {studentGrades.map((row, idx) => {
                    const isLocked = row.status === 'submitted' || row.status === 'approved'
                    const wwSum = row.ww.reduce((s, v) => s + (Number(v) || 0), 0)
                    const wwMax = activities.ww.reduce((s, a) => s + (a.maxScore || 0), 0)
                    const ptSum = row.pt.reduce((s, v) => s + (Number(v) || 0), 0)
                    const ptMax = activities.pt.reduce((s, a) => s + (a.maxScore || 0), 0)
                    const qaSum = row.qa.reduce((s, v) => s + (Number(v) || 0), 0)
                    const qaMax = activities.qa.reduce((s, a) => s + (a.maxScore || 0), 0)
                    const wwPS = wwMax > 0 ? Math.round((wwSum / wwMax) * 10000) / 100 : 0
                    const ptPS = ptMax > 0 ? Math.round((ptSum / ptMax) * 10000) / 100 : 0
                    const qaPS = qaMax > 0 ? Math.round((qaSum / qaMax) * 10000) / 100 : 0

                    return (
                      <tr key={row.studentId} className="hover:bg-[var(--color-bg-subtle)]/30 transition">
                        <td className="px-2 py-1 text-[var(--color-text-muted)] sticky left-0 bg-[var(--color-bg-card)] z-10">{idx + 1}</td>
                        <td className="px-2 py-1 font-medium text-[var(--color-text-primary)] whitespace-nowrap sticky left-8 bg-[var(--color-bg-card)] z-10" style={{ minWidth: 180 }}>{row.studentName}</td>
                        {/* WW scores */}
                        {row.ww.map((v, i) => (
                          <td key={`ww${i}`} className="px-0.5 py-0.5">
                            <input type="number" min={0} max={activities.ww[i]?.maxScore || 999} value={v} disabled={isLocked}
                              onChange={e => updateScore(idx, 'ww', i, e.target.value)}
                              className="w-12 px-1 py-1 text-center border border-[var(--color-border)] rounded bg-[var(--color-bg-card)] text-[var(--color-text-primary)] outline-none focus:ring-1 focus:ring-primary transition disabled:opacity-40 text-xs" />
                          </td>
                        ))}
                        <td className="px-1 py-1 text-center font-medium text-[var(--color-text-secondary)]">{wwSum || ''}</td>
                        <td className="px-1 py-1 text-center text-[var(--color-text-muted)]">{row.ww.some(v => v !== '') ? wwPS.toFixed(2) : ''}</td>
                        <td className="px-1 py-1 text-center text-[var(--color-text-muted)]">{row.computed ? row.computed.wwWS.toFixed(2) : ''}</td>
                        {/* PT scores */}
                        {row.pt.map((v, i) => (
                          <td key={`pt${i}`} className="px-0.5 py-0.5 border-l border-[var(--color-border)]/30">
                            <input type="number" min={0} max={activities.pt[i]?.maxScore || 999} value={v} disabled={isLocked}
                              onChange={e => updateScore(idx, 'pt', i, e.target.value)}
                              className="w-12 px-1 py-1 text-center border border-[var(--color-border)] rounded bg-[var(--color-bg-card)] text-[var(--color-text-primary)] outline-none focus:ring-1 focus:ring-primary transition disabled:opacity-40 text-xs" />
                          </td>
                        ))}
                        <td className="px-1 py-1 text-center font-medium text-[var(--color-text-secondary)]">{ptSum || ''}</td>
                        <td className="px-1 py-1 text-center text-[var(--color-text-muted)]">{row.pt.some(v => v !== '') ? ptPS.toFixed(2) : ''}</td>
                        <td className="px-1 py-1 text-center text-[var(--color-text-muted)]">{row.computed ? row.computed.ptWS.toFixed(2) : ''}</td>
                        {/* QA scores */}
                        {row.qa.map((v, i) => (
                          <td key={`qa${i}`} className="px-0.5 py-0.5 border-l border-[var(--color-border)]/30">
                            <input type="number" min={0} max={activities.qa[i]?.maxScore || 999} value={v} disabled={isLocked}
                              onChange={e => updateScore(idx, 'qa', i, e.target.value)}
                              className="w-12 px-1 py-1 text-center border border-[var(--color-border)] rounded bg-[var(--color-bg-card)] text-[var(--color-text-primary)] outline-none focus:ring-1 focus:ring-primary transition disabled:opacity-40 text-xs" />
                          </td>
                        ))}
                        <td className="px-1 py-1 text-center font-medium text-[var(--color-text-secondary)]">{qaSum || ''}</td>
                        <td className="px-1 py-1 text-center text-[var(--color-text-muted)]">{row.qa.some(v => v !== '') ? qaPS.toFixed(2) : ''}</td>
                        <td className="px-1 py-1 text-center text-[var(--color-text-muted)]">{row.computed ? row.computed.qaWS.toFixed(2) : ''}</td>
                        {/* Initial + Transmuted */}
                        <td className="px-2 py-1 text-center font-mono border-l border-[var(--color-border)]">{row.computed ? row.computed.initial : ''}</td>
                        <td className="px-2 py-1 text-center font-mono font-bold border-l border-[var(--color-border)]">
                          {row.computed ? (
                            <span className={row.computed.passed ? 'text-green-600 dark:text-green-400' : 'text-red-500'}>{row.computed.transmuted}</span>
                          ) : ''}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Action bar */}
        {studentGrades.length > 0 && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 card p-4">
            <p className="text-xs text-[var(--color-text-muted)]">{filledCount} of {studentGrades.length} graded · {draftCount} drafts</p>
            <div className="flex gap-2">
              <button onClick={handleExport} disabled={exporting || !subjectArea || filledCount === 0}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-subtle)] transition text-[var(--color-text-secondary)] disabled:opacity-50">
                <Download className={`w-4 h-4 ${exporting ? 'animate-spin' : ''}`} /> {exporting ? 'Exporting...' : 'Export'}
              </button>
              <button onClick={handleSaveDraft} disabled={saving || !subjectArea || filledCount === 0}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-subtle)] transition text-[var(--color-text-secondary)] disabled:opacity-50">
                <Save className="w-4 h-4" /> Save Draft
              </button>
              <button onClick={() => setShowSubmitConfirm(true)} disabled={!subjectArea || draftCount === 0}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-primary text-white rounded-lg hover:bg-accent-burgundy transition disabled:opacity-50">
                <Send className="w-4 h-4" /> Submit
              </button>
            </div>
          </div>
        )}

        {/* Activity Setup Modal */}
        {showActivitySetup && (
          <ActivitySetupModal
            activities={activities}
            onSave={saveActivityConfig}
            onClose={() => setShowActivitySetup(false)}
          />
        )}

        {/* Submit Confirm */}
        {showSubmitConfirm && (
          <ModalPortal><div className="modal-backdrop"><div className="modal-panel" style={{ maxWidth: '28rem' }}>
            <div className="p-5 text-center">
              <Send className="w-10 h-10 text-primary mx-auto mb-3" />
              <h3 className="text-base font-bold text-[var(--color-text-primary)] mb-1">Submit Grades?</h3>
              <p className="text-xs text-[var(--color-text-muted)] mb-4">
                Submit <strong>{draftCount}</strong> grades for <strong>{selectedSubject.subjectName}</strong> ({gradingPeriod}). You won't be able to edit until the principal returns them.
              </p>
              <div className="flex gap-2 justify-center">
                <button onClick={() => setShowSubmitConfirm(false)} className="btn-cancel">Cancel</button>
                <button onClick={handleSubmit} className="btn-action flex items-center gap-1.5"><Send className="w-4 h-4" /> Submit</button>
              </div>
            </div>
          </div></div></ModalPortal>
        )}

        <ToastContainer toasts={toasts} removeToast={removeToast} />
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════
  // VIEW: Subject List
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="page-enter space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)]">e-Class Record</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">{user?.campus} · Select a subject to enter grades</p>
      </div>
      <CampusBanner user={user} />

      {sections.length === 0 ? (
        <div className="card p-8 text-center">
          <ClipboardList className="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-3" />
          <h3 className="text-sm font-bold text-[var(--color-text-primary)] mb-1">No Subjects Assigned</h3>
          <p className="text-xs text-[var(--color-text-muted)]">Contact your Principal or Program Head to assign subjects.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sections.map(sec => (
            <div key={sec.section} className="card overflow-hidden">
              <div className="p-4 border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)]/50">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-bold text-[var(--color-text-primary)]">{sec.section}</h3>
                  <span className="text-xs text-[var(--color-text-muted)]">· {sec.gradeLevel} · {sec.subjects.length} subject{sec.subjects.length !== 1 ? 's' : ''}</span>
                </div>
              </div>
              <div className="divide-y divide-[var(--color-border)]">
                {sec.subjects.map((subj, idx) => (
                  <button key={idx} onClick={() => openGradeEntry(subj)} className="w-full flex items-center justify-between p-4 hover:bg-[var(--color-bg-subtle)]/50 transition text-left">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center"><BookOpen className="w-4 h-4 text-primary" /></div>
                      <div>
                        <p className="text-sm font-medium text-[var(--color-text-primary)]">{subj.subjectName}</p>
                        <p className="text-xs text-[var(--color-text-muted)]">{subj.gradeCount > 0 ? `${subj.gradeCount} grades entered` : 'No grades yet'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {subj.gradeCount > 0
                        ? <span className="px-2 py-0.5 text-[9px] font-semibold rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">In Progress</span>
                        : <span className="px-2 py-0.5 text-[9px] font-semibold rounded-full bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]">Not Started</span>
                      }
                      <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)]" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════
// Activity Setup Modal
// ═══════════════════════════════════════════════════════════════
function ActivitySetupModal({ activities, onSave, onClose }) {
  const [draft, setDraft] = useState({
    ww: [...(activities.ww || [])],
    pt: [...(activities.pt || [])],
    qa: [...(activities.qa || [])],
  })

  const addActivity = (component) => {
    const labels = { ww: 'Quiz', pt: 'Activity', qa: 'Exam' }
    const defaults = { ww: 20, pt: 50, qa: 100 }
    setDraft(prev => ({
      ...prev,
      [component]: [...prev[component], { name: `${labels[component]} ${prev[component].length + 1}`, maxScore: defaults[component] }]
    }))
  }

  const removeActivity = (component, idx) => {
    setDraft(prev => ({ ...prev, [component]: prev[component].filter((_, i) => i !== idx) }))
  }

  const updateActivity = (component, idx, field, value) => {
    setDraft(prev => {
      const arr = [...prev[component]]
      arr[idx] = { ...arr[idx], [field]: field === 'maxScore' ? (Number(value) || 0) : value }
      return { ...prev, [component]: arr }
    })
  }

  const renderSection = (label, component, color) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className={`text-sm font-bold ${color}`}>{label}</h4>
        <button onClick={() => addActivity(component)} className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-lg bg-[var(--color-bg-subtle)] hover:bg-[var(--color-bg-muted)] transition text-[var(--color-text-secondary)]">
          <Plus className="w-3 h-3" /> Add
        </button>
      </div>
      {draft[component].length === 0 && <p className="text-[10px] text-[var(--color-text-muted)] italic">No activities added</p>}
      {draft[component].map((act, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <input type="text" value={act.name} onChange={e => updateActivity(component, idx, 'name', e.target.value)}
            className="flex-1 px-2 py-1.5 text-xs border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-card)] text-[var(--color-text-primary)] outline-none focus:ring-1 focus:ring-primary" placeholder="Activity name" />
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-[var(--color-text-muted)]">Max:</span>
            <input type="number" min={1} value={act.maxScore} onChange={e => updateActivity(component, idx, 'maxScore', e.target.value)}
              className="w-16 px-2 py-1.5 text-xs text-center border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-card)] text-[var(--color-text-primary)] outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <button onClick={() => removeActivity(component, idx)} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-[var(--color-text-muted)] hover:text-red-500 transition">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  )

  return (
    <ModalPortal><div className="modal-backdrop"><div className="modal-panel" style={{ maxWidth: '32rem' }}>
      <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
        <div>
          <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Configure Activities</h3>
          <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">Set up quizzes, tasks, and exams with their highest possible scores</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--color-bg-subtle)] transition"><X className="w-4 h-4 text-[var(--color-text-muted)]" /></button>
      </div>
      <div className="p-4 space-y-5 max-h-[60vh] overflow-y-auto">
        {renderSection('Written Works', 'ww', 'text-primary')}
        <div className="border-t border-[var(--color-border)]" />
        {renderSection('Performance Tasks', 'pt', 'text-blue-700 dark:text-blue-400')}
        <div className="border-t border-[var(--color-border)]" />
        {renderSection('Quarterly Assessment', 'qa', 'text-green-700 dark:text-green-400')}
      </div>
      <div className="flex justify-end gap-2 p-4 border-t border-[var(--color-border)]">
        <button onClick={onClose} className="btn-cancel">Cancel</button>
        <button onClick={() => onSave(draft)} className="btn-action flex items-center gap-1.5"><Save className="w-4 h-4" /> Save Activities</button>
      </div>
    </div></div></ModalPortal>
  )
}