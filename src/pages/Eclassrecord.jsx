/**
 * EClassRecord.jsx
 * ─────────────────────────────────────────────────────────────────
 * Unified grade entry page for both Basic Ed and College.
 *
 * Basic Ed:  WW / PT / QA → DepEd transmutation → 60–100 grade (score entry
 *            still fixed to WW/PT/QA — see gradingFramework note below)
 * College:   fully dynamic — score columns render from whatever components
 *            the school year's configured college grading framework defines
 *            (defaults to Prelim/Midterm/Finals) → CHED 1.00–5.00 point grade
 *
 * The page detects department from the selected subject and renders
 * the appropriate grade entry interface automatically.
 * ─────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useRef, Fragment } from 'react'
import {
  ClipboardList, BookOpen, Users, ChevronRight, ChevronDown,
  Save, Send, ArrowLeft, Plus, Trash2, Info, AlertCircle, X, Settings, Download
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useAppConfig } from '../context/AppConfigContext'
import { PageSkeleton, useToast, ToastContainer, ModalPortal } from '../components/UIComponents'
import GroupedSelect from '../components/GroupedSelect'
import {
  // Basic Ed
  SUBJECT_AREAS, GRADING_PERIODS, WEIGHT_TABLES,
  computeGrade, transmute, getAllGrades, saveGradeRecord, submitGrades,
  getParentComposite, getCompositeConfig, computeCompositeGrade, COMPOSITE_SUBJECTS,
  getTransmutationTable, getGradingFramework, computeGradeUniversal, DEFAULT_GRADING_FRAMEWORKS,
  // College
  COLLEGE_GRADE_SCALE, COLLEGE_SEMESTERS, SPECIAL_GRADES,
  computeCollegeGrade, getPointGrade, getCollegeGradingFramework, DEFAULT_COLLEGE_GRADING_FRAMEWORKS,
  getCollegeGrades, saveCollegeGradeRecord, submitCollegeGrades,
  loadCollegeDraftScores, saveCollegeDraftScores,
} from '../engines/gradingEngine'
import { exportEClassRecord } from '../utils/exportEClassRecord'
import { recordINC } from '../utils/incCompletionBridge'

// ── localStorage keys ──────────────────────────────────────────
const ACTIVITIES_KEY   = 'almirene_grade_activities'
const DRAFT_SCORES_KEY = 'almirene_draft_scores'

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

// ── College point grade badge color ───────────────────────────
function pointGradeColor(pg) {
  if (!pg) return 'text-[var(--color-text-muted)]'
  const n = Number(pg)
  if (isNaN(n)) return 'text-amber-600 dark:text-amber-400'   // INC / DRP
  if (n <= 1.25) return 'text-emerald-600 dark:text-emerald-400'
  if (n <= 2.00) return 'text-green-600 dark:text-green-400'
  if (n <= 3.00) return 'text-blue-600 dark:text-blue-400'
  return 'text-red-500 dark:text-red-400'
}

// ─────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────

export default function EClassRecord() {
  const { user } = useAuth()
  const { activeCampuses, currentSchoolYear } = useAppConfig()
  const [loading, setLoading] = useState(true)
  const { toasts, addToast, removeToast } = useToast()

  // ── Shared state ───────────────────────────────────────────
  const [selectedSubject,    setSelectedSubject]    = useState(null)
  const [saving,             setSaving]             = useState(false)
  const [showSubmitConfirm,  setShowSubmitConfirm]  = useState(false)

  const isTeacher  = user?.role === 'teacher'
  const campusKey  = user?.campusKey || ''

  // ── School year & grading period config ─────────────────────
  // Resolved BEFORE state declarations below so the initial
  // grading period default (Q1 vs T1) is correct on first render.
  const activeSY    = currentSchoolYear || { year: '2026-2027', gradingPeriodType: 'quarterly', gradingFramework: 'do8_2015' }
  const currentSY   = activeSY.year || '2026-2027'
  const periodType  = activeSY.gradingPeriodType || 'quarterly'
  const isTrimester = periodType === 'trimester'
  const periods     = isTrimester ? GRADING_PERIODS.trimester : GRADING_PERIODS.quarterly

  // Resolve this school year's configured grading framework (components,
  // weights, transmutation on/off) — falls back to the verified DO 8, s.2015
  // seed if the school hasn't configured one yet.
  const gradingFramework = getGradingFramework(activeSY.gradingFramework) || DEFAULT_GRADING_FRAMEWORKS[0]
  // The score-entry grid below dynamically renders whatever flat components
  // the configured framework defines (any count, any keys/labels) — covers
  // DO 8 s.2015's WW/PT/QA, DO 015 s.2026's WW/PT/EX, and any custom
  // framework built in Settings. A framework where a component has its own
  // nested sub-scores (e.g. an exam broken into multiple parts) needs a
  // different entry UI — not yet built — so we fall back to the legacy
  // computeGrade() path for those rather than silently computing from data
  // the teacher never had a chance to enter per sub-part.
  const frameworkKeys = gradingFramework.components.map(c => c.key).sort().join(',')
  const frameworkGroupIds = new Set(gradingFramework.subjectGroups.map(g => g.id))
  const frameworkMatchesEntryUI = gradingFramework.components.every(c => !c.subcomponents || c.subcomponents.length === 0)

  // Same idea for college — resolve this school year's configured college
  // grading framework (Prelim/Midterm/Finals weights + point scale), falling
  // back to CHED Standard if the school hasn't configured one yet.
  const collegeGradingFramework = getCollegeGradingFramework(activeSY.collegeGradingFramework) || DEFAULT_COLLEGE_GRADING_FRAMEWORKS[0]
    && SUBJECT_AREAS.every(a => frameworkGroupIds.has(a.id))

  // ── Basic Ed state ─────────────────────────────────────────
  const [gradingPeriod,      setGradingPeriod]      = useState(() => periods[0]?.id || 'Q1')
  const [subjectArea,        setSubjectArea]        = useState('')
  const [studentGrades,      setStudentGrades]      = useState([])
  const [activities,         setActivities]         = useState({ ww: [], pt: [], qa: [] })
  const [showActivitySetup,  setShowActivitySetup]  = useState(false)
  const tableRef = useRef(null)

  // ── College state ──────────────────────────────────────────
  const [collegeSemester,    setCollegeSemester]    = useState('1st_sem')
  const [collegeRows,        setCollegeRows]        = useState([])

  useEffect(() => { setTimeout(() => setLoading(false), 150) }, [])

  // Defensive re-sync: if the school's gradingPeriodType changes while this
  // page is mounted (e.g. Super Admin edits it in Settings and the config
  // context refreshes) and the currently selected period no longer exists
  // for the new type (e.g. 'Q4' selected, school switches to trimester),
  // fall back to the first valid period instead of leaving a dead selection.
  useEffect(() => {
    if (!periods.some(p => p.id === gradingPeriod)) {
      setGradingPeriod(periods[0]?.id || 'Q1')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodType])

  // ── Detect college subject ─────────────────────────────────
  const isCollege = selectedSubject?.department === 'college'

  const draftKey = (subj, period) =>
    `${subj?.subjectId}_${subj?.sectionId}_${period}_${currentSY}`

  const collegeDraftKey = (subj, sem) =>
    `college_${subj?.subjectId}_${subj?.sectionId}_${sem}_${currentSY}`

  // ── Load subject assignments from subjectLoadBridge ────────
  const subjectLoads = (() => {
    try {
      const raw = localStorage.getItem('almirene_subject_loads')
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
                subjectId:   `${load.gradeLevel}_${load.subject}`,
                subjectName: load.subject,
                gradeLevel:  load.gradeLevel,
                section:     sec.displayName || sec.defaultName,
                sectionId:   sec.id,
                teacherId:   load.teacherId,
                teacherName: load.teacherName,
                campusKey,
                department:  'basicEd',
              })
            })
          }
        })
      }
      if (syData.collegeLoads) {
        syData.collegeLoads.forEach(load => {
          if (load.teacherId === user?.id || load.teacherName === user?.name) {
            loads.push({
              subjectId:   `${load.program}_${load.yearLevel}_${load.subject}`,
              subjectName: load.subject,
              gradeLevel:  `${load.program} - ${load.yearLevel}`,
              section:     load.sectionName || load.sectionId,
              sectionId:   load.sectionId,
              teacherId:   load.teacherId,
              teacherName: load.teacherName,
              campusKey,
              department:  'college',
            })
          }
        })
      }
      return loads
    } catch { return [] }
  })()

  const allMyGrades = getAllGrades({
    teacherId: isTeacher ? user?.id : undefined, campusKey,
  })
  const allMyCollegeGrades = getCollegeGrades({
    teacherId: isTeacher ? user?.id : undefined, campusKey,
  })

  // Period-aware grade lookup — used by the composite merge card.
  const gradeByKeyAndPeriod = allMyGrades.reduce((acc, g) => {
    const k = `${g.subjectId}_${g.sectionId}_${g.period}`
    if (!acc[k] || (g.updatedAt || '') > (acc[k].updatedAt || '')) acc[k] = g
    return acc
  }, {})

  // Period-agnostic — used only for grade count display in subject list
  const latestGradeByKey = allMyGrades.reduce((acc, g) => {
    const k = `${g.subjectId}_${g.sectionId}`
    if (!acc[k] || (g.updatedAt || '') > (acc[k].updatedAt || '')) acc[k] = g
    return acc
  }, {})

  // Group by section for subject list view
  const grouped = {}
  subjectLoads.forEach(sl => {
    const key = sl.sectionId || sl.section
    if (!grouped[key]) {
      grouped[key] = { section: sl.section, gradeLevel: sl.gradeLevel, subjects: [], department: sl.department }
    }
    const gradeCount = sl.department === 'college'
      ? allMyCollegeGrades.filter(g => g.subjectId === sl.subjectId && g.sectionId === sl.sectionId).length
      : allMyGrades.filter(g => g.subjectId === sl.subjectId && g.sectionId === sl.sectionId).length
    grouped[key].subjects.push({ ...sl, gradeCount })
  })
  const sections = Object.values(grouped)

  // ── Get students from enrollments ──────────────────────────
  const getStudents = (gradeLevel, campKey) => {
    try {
      const subs = JSON.parse(localStorage.getItem('almirene_submissions') || '[]')
      let campusName = user?.campus || ''
      try {
        const savedCfg = JSON.parse(localStorage.getItem('almirene_app_config') || '{}')
        const c = (savedCfg.campuses || []).find(c => c.key === campKey)
        if (c?.name) campusName = c.name
      } catch {}

      return subs
        .filter(s => {
          if (s.status !== 'approved') return false
          const eCampus = s.enrollment?.campus || ''
          return eCampus === campusName &&
                 s.enrollment?.gradeLevel === gradeLevel
        })
        .map(s => ({
          id:     s.id,
          name:   `${s.student?.lastName || s.lastName || ''}, ${s.student?.firstName || s.firstName || ''} ${s.student?.middleName || s.middleName || ''}`.trim(),
          gender: s.student?.gender || s.gender || '',
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
    } catch { return [] }
  }

  // ── Activity config key ────────────────────────────────────
  const activityKey = (subj) =>
    `${subj.subjectId}_${subj.sectionId}_${gradingPeriod}_${currentSY}`

  // ── Open grade entry (shared entry point) ──────────────────
  const openGradeEntry = (subj) => {
    setSelectedSubject(subj)

    if (subj.department === 'college') {
      setSubjectArea('')
      // Load college grades
      buildCollegeRows(getStudents(subj.gradeLevel, subj.campusKey), subj, collegeSemester)
    } else {
      // Pre-fill subject area from the subject load (set by principal in Subject Load)
      try {
        const rawLoads = JSON.parse(localStorage.getItem('almirene_subject_loads') || '{}')
        const campusLoads = rawLoads[subj.campusKey]?.[currentSY]?.basicEdLoads || []
        const matchedLoad = campusLoads.find(l =>
          l.gradeLevel === subj.gradeLevel && l.subject === subj.subjectName
        )
        setSubjectArea(matchedLoad?.subjectArea || '')
      } catch {
        setSubjectArea('')
      }

      // Load basic ed activities
      const allActs = loadActivities()
      const key = `${subj.subjectId}_${subj.sectionId}_${gradingPeriod}_${currentSY}`
      const savedActs = allActs[key] || {}
      const isEmpty = gradingFramework.components.every(c => !(savedActs[c.key]?.length))
      if (isEmpty) {
        // Sensible starter default per component — same spirit as the old
        // hardcoded Quiz 1/Activity 1/Quarterly Exam seed, just generic to
        // however many components the active framework actually defines.
        gradingFramework.components.forEach((c, i) => {
          const isLast = i === gradingFramework.components.length - 1
          savedActs[c.key] = [{ name: `${c.label} 1`, maxScore: isLast ? 100 : 20 }]
        })
      } else {
        // Fill in any component the framework has that this saved config predates
        gradingFramework.components.forEach(c => { if (!savedActs[c.key]) savedActs[c.key] = [] })
      }
      setActivities(savedActs)
      buildGradeRows(getStudents(subj.gradeLevel, subj.campusKey), savedActs, subj, gradingPeriod)
    }
  }

  // ── Build Basic Ed grade rows ──────────────────────────────
  const buildGradeRows = (students, acts, subj, period) => {
    const allDrafts  = loadDraftScores()
    const key        = draftKey(subj || selectedSubject, period || gradingPeriod)
    const savedScores = allDrafts[key] || {}

    const alignScores = (savedArr, actArr) => {
      const target = (actArr || []).length
      if (!savedArr || savedArr.length === 0) return Array(target).fill('')
      if (savedArr.length === target) return [...savedArr]
      if (savedArr.length < target) return [...savedArr, ...Array(target - savedArr.length).fill('')]
      return savedArr.slice(0, target)
    }

    const rows = students.map(stu => {
      const saved  = savedScores[stu.id]
      const scores = {}
      Object.keys(acts).forEach(key => {
        scores[key] = alignScores(saved?.scores?.[key], acts[key])
      })
      return {
        studentId:   stu.id,
        studentName: stu.name,
        gender:      stu.gender,
        scores,
        computed:    null,
        status:      saved?.status || 'draft',
      }
    })
    setStudentGrades(rows)
  }

  // ── Build College grade rows ───────────────────────────────
  const buildCollegeRows = (students, subj, sem) => {
    const allDrafts   = loadCollegeDraftScores()
    const key         = collegeDraftKey(subj, sem)
    const savedScores = allDrafts[key] || {}

    // Also load any saved (submitted/approved) grades
    const savedGrades = getCollegeGrades({
      subjectId: subj.subjectId, sectionId: subj.sectionId,
      semester: sem, schoolYear: currentSY,
    })
    const gradeByStudent = Object.fromEntries(savedGrades.map(g => [g.studentId, g]))

    const rows = students.map(stu => {
      const draft  = savedScores[stu.id]
      const saved  = gradeByStudent[stu.id]
      const scores = {}
      collegeGradingFramework.components.forEach(c => {
        scores[c.key] = draft?.scores?.[c.key] ?? saved?.scores?.[c.key] ?? ''
      })
      const specialGrade = draft?.specialGrade ?? saved?.specialGrade ?? ''
      return {
        studentId:    stu.id,
        studentName:  stu.name,
        gender:       stu.gender,
        scores,
        specialGrade,
        computed:     computeCollegeGrade(scores, collegeGradingFramework),
        status:       saved?.status || 'draft',
      }
    })
    setCollegeRows(rows)
  }

  // ── Save activity config (Basic Ed) ───────────────────────
  const saveActivityConfig = (newActs) => {
    if (!selectedSubject) return
    const allActs = loadActivities()
    allActs[activityKey(selectedSubject)] = newActs
    saveActivitiesConfig(allActs)
    setActivities(newActs)
    const students = getStudents(selectedSubject.gradeLevel, selectedSubject.campusKey)
    buildGradeRows(students, newActs, selectedSubject, gradingPeriod)
    addToast('Activities updated', 'success')
    setShowActivitySetup(false)
  }

  // ── Update Basic Ed score (auto-saves) ─────────────────────
  const updateScore = (studentIdx, component, actIdx, value) => {
    setStudentGrades(prev => {
      const updated = [...prev]
      const row     = { ...updated[studentIdx] }
      const scores  = [...row.scores[component]]
      scores[actIdx] = value === '' ? '' : Number(value) || 0
      row.scores = { ...row.scores, [component]: scores }

      if (!isTrimester && subjectArea) {
        const totals = {}
        gradingFramework.components.forEach(c => {
          const arr = row.scores[c.key] || []
          const max = (activities[c.key] || []).reduce((s, a) => s + (a.maxScore || 0), 0)
          totals[c.key] = { score: arr.reduce((s, v) => s + (Number(v) || 0), 0), total: max }
        })

        const hasScores = Object.values(row.scores).some(arr => (arr || []).some(v => v !== ''))
        const allHaveMax = gradingFramework.components.every(c => totals[c.key].total > 0)
        if (hasScores && allHaveMax) {
          try {
            if (frameworkMatchesEntryUI) {
              // Use the school year's actually-configured framework (weights,
              // transmutation on/off, custom table) — not just the do8_2015 default.
              const r = computeGradeUniversal(totals, gradingFramework, subjectArea)
              row.computed = {
                breakdown: r.breakdown,
                weights: gradingFramework.subjectGroups.find(g => g.id === subjectArea)?.weights,
                initial: r.initial, transmuted: r.final, passed: r.passed, remarks: r.remarks,
              }
            } else {
              // Configured framework doesn't match this flat entry grid's
              // shape (e.g. a component with nested exam sub-scores) — fall
              // back to the verified DO 8, s.2015 defaults rather than
              // compute from a mismatched framework.
              row.computed = computeGrade(totals, subjectArea)
            }
          } catch { row.computed = null }
        }
      }
      updated[studentIdx] = row

      // Auto-save draft
      try {
        const allDrafts = loadDraftScores()
        const key = draftKey(selectedSubject, gradingPeriod)
        if (!allDrafts[key]) allDrafts[key] = {}
        updated.forEach(r => {
          const hasAny = Object.values(r.scores).some(arr => (arr || []).some(v => v !== ''))
          if (hasAny) allDrafts[key][r.studentId] = { scores: r.scores, status: r.status }
        })
        saveDraftScores(allDrafts)
      } catch {}

      return updated
    })
  }

  // ── Update College score (auto-saves) ─────────────────────
  const updateCollegeScore = (studentIdx, field, value) => {
    setCollegeRows(prev => {
      const updated = [...prev]
      const row     = field === 'specialGrade'
        ? { ...updated[studentIdx], specialGrade: value }
        : { ...updated[studentIdx], scores: { ...updated[studentIdx].scores, [field]: value } }

      // Special grade clears computed; removing special grade restores computed
      if (field === 'specialGrade') {
        row.computed = value ? null : computeCollegeGrade(row.scores, collegeGradingFramework)
      } else {
        // Re-compute if no special grade
        if (!row.specialGrade) {
          row.computed = computeCollegeGrade(row.scores, collegeGradingFramework)
        }
      }

      updated[studentIdx] = row

      // Auto-save draft
      try {
        const allDrafts = loadCollegeDraftScores()
        const key = collegeDraftKey(selectedSubject, collegeSemester)
        if (!allDrafts[key]) allDrafts[key] = {}
        const hasAny = Object.values(row.scores).some(v => v !== '') || row.specialGrade
        if (hasAny) {
          allDrafts[key][row.studentId] = {
            scores: row.scores, specialGrade: row.specialGrade,
            status: row.status,
          }
        }
        saveCollegeDraftScores(allDrafts)
      } catch {}

      return updated
    })
  }

  // ── Basic Ed save draft ────────────────────────────────────
  const handleSaveDraft = () => {
    if (!subjectArea) { addToast('Please select a subject area first', 'error'); return }
    setSaving(true)
    let count = 0
    studentGrades.forEach(row => {
      const hasAny = Object.values(row.scores).some(arr => (arr || []).some(v => v !== ''))
      if (!hasAny) return
      const scores = {}
      gradingFramework.components.forEach(c => {
        const arr = row.scores[c.key] || []
        const max = (activities[c.key] || []).reduce((s, a) => s + (a.maxScore || 0), 0)
        scores[c.key] = { score: arr.reduce((s, v) => s + (Number(v) || 0), 0), total: max }
      })
      saveGradeRecord({
        studentId: row.studentId, studentName: row.studentName,
        subjectId: selectedSubject.subjectId, subjectName: selectedSubject.subjectName,
        subjectArea, sectionId: selectedSubject.sectionId, campusKey,
        schoolYear: currentSY, period: gradingPeriod,
        teacherId: user?.id, teacherName: user?.name,
        scores,
        scoresRaw: row.scores,
        status: 'draft',
      }, gradingFramework)
      count++
    })
    setSaving(false)
    addToast(`${count} grade${count !== 1 ? 's' : ''} saved as draft`, 'success')
  }

  // ── College save draft ─────────────────────────────────────
  const handleCollegeSaveDraft = () => {
    setSaving(true)
    let count = 0
    collegeRows.forEach(row => {
      const hasAny = Object.values(row.scores).some(v => v !== '') || row.specialGrade
      if (!hasAny) return
      saveCollegeGradeRecord({
        studentId:    row.studentId,
        studentName:  row.studentName,
        subjectId:    selectedSubject.subjectId,
        subjectName:  selectedSubject.subjectName,
        sectionId:    selectedSubject.sectionId,
        campusKey,
        schoolYear:   currentSY,
        semester:     collegeSemester,
        teacherId:    user?.id,
        teacherName:  user?.name,
        scores:       row.scores,
        specialGrade: row.specialGrade || null,
        status:       'draft',
      }, collegeGradingFramework)
      count++
    })
    setSaving(false)
    addToast(`${count} college grade${count !== 1 ? 's' : ''} saved as draft`, 'success')
  }

  // ── Basic Ed submit ────────────────────────────────────────
  const handleSubmit = () => {
    handleSaveDraft()
    const count = submitGrades(user?.id, selectedSubject.subjectId, selectedSubject.sectionId, gradingPeriod, currentSY)
    setShowSubmitConfirm(false)
    addToast(`${count} grade${count !== 1 ? 's' : ''} submitted for approval!`, 'success')
    setStudentGrades(prev => prev.map(row => {
      const hasAny = Object.values(row.scores).some(arr => (arr || []).some(v => v !== ''))
      return { ...row, status: hasAny ? 'submitted' : row.status }
    }))
  }

  // ── College submit ─────────────────────────────────────────
  const handleCollegeSubmit = () => {
    handleCollegeSaveDraft()
    const count = submitCollegeGrades(user?.id, selectedSubject.subjectId, selectedSubject.sectionId, collegeSemester, currentSY)
    setShowSubmitConfirm(false)
    addToast(`${count} college grade${count !== 1 ? 's' : ''} submitted to Program Head!`, 'success')
    setCollegeRows(prev => prev.map(row => {
      const hasAny = Object.values(row.scores).some(v => v !== '') || row.specialGrade
      return { ...row, status: hasAny ? 'submitted' : row.status }
    }))

    // Auto-create INC completion tracking for any student marked INC this submit.
    // recordINC() is a no-op if an active record already exists (safe to call
    // on every submit/resubmit without creating duplicates).
    const incRows = collegeRows.filter(row => row.specialGrade === 'INC')
    if (incRows.length > 0) {
      incRows.forEach(row => {
        recordINC({
          studentId:   row.studentId,
          studentName: row.studentName,
          subjectId:   selectedSubject.subjectId,
          subjectName: selectedSubject.subjectName,
          sectionId:   selectedSubject.sectionId,
          semester:    collegeSemester,
          schoolYear:  currentSY,
          campusKey,
          teacherId:   user?.id,
          teacherName: user?.name,
          deadline:    activeSY.college?.endDate ? new Date(activeSY.college.endDate).toISOString() : undefined,
        })
      })
      addToast(`${incRows.length} INC completion record${incRows.length !== 1 ? 's' : ''} started — track in INC Completion.`, 'info')
    }
  }

  // ── Export (Basic Ed only) ─────────────────────────────────
  const [exporting, setExporting] = useState(false)
  const handleExport = async () => {
    if (!subjectArea) { addToast('Please select a subject area first', 'error'); return }
    setExporting(true)
    try {
      let schoolName = 'School'
      try {
        const wc = JSON.parse(localStorage.getItem('almirene_website_content') || '{}')
        schoolName = wc.schoolName || 'School'
      } catch {}
      const allActs   = loadActivities()
      const allDrafts = loadDraftScores()
      const activitiesByPeriod = {}
      const scoresByPeriod = {}
      periods.forEach(p => {
        const key = draftKey(selectedSubject, p.id)
        activitiesByPeriod[p.id] = allActs[key] || activities
        const draftsForPeriod = allDrafts[key] || {}
        const unwrapped = {}
        Object.keys(draftsForPeriod).forEach(studentId => {
          unwrapped[studentId] = draftsForPeriod[studentId]?.scores || {}
        })
        scoresByPeriod[p.id] = unwrapped
      })
      const students = studentGrades.map(r => ({ id: r.studentId, name: r.studentName, gender: r.gender }))
      const filename = await exportEClassRecord({
        subjectName: selectedSubject.subjectName,
        section: selectedSubject.section,
        gradeLevel: selectedSubject.gradeLevel,
        teacherName: user?.name || '',
        schoolYear: currentSY, schoolName,
        periodType, subjectArea, activitiesByPeriod, scoresByPeriod, students,
        framework: gradingFramework,
      })
      addToast(`Exported: ${filename}`, 'success')
    } catch (err) {
      addToast('Export failed: ' + (err.message || 'Unknown error'), 'error')
    } finally { setExporting(false) }
  }

  // ── Computed stats ─────────────────────────────────────────
  const filledCount   = studentGrades.filter(r => Object.values(r.scores || {}).some(arr => (arr || []).some(v => v !== ''))).length
  const computedCount = studentGrades.filter(r => r.computed).length
  const draftCount    = studentGrades.filter(r => r.status === 'draft' && Object.values(r.scores || {}).some(arr => (arr || []).some(v => v !== ''))).length

  const collegeFilledCount  = collegeRows.filter(r => Object.values(r.scores || {}).some(v => v !== '') || r.specialGrade).length
  const collegeDraftCount   = collegeRows.filter(r => r.status === 'draft' && (Object.values(r.scores || {}).some(v => v !== '') || r.specialGrade)).length
  const collegeComputedCount = collegeRows.filter(r => r.computed || r.specialGrade).length

  if (loading) return <PageSkeleton />

  // ═══════════════════════════════════════════════════════════
  // VIEW: Grade Entry (subject selected)
  // ═══════════════════════════════════════════════════════════
  if (selectedSubject) {
    // Weights shown in the "max score" row come from the school year's
    // actually-configured framework, not the hardcoded DO 8, s.2015
    // WEIGHT_TABLES constant — a custom framework's weights now display
    // correctly here instead of always showing the DO 8 default.
    const weights = gradingFramework.subjectGroups.find(g => g.id === subjectArea)?.weights || WEIGHT_TABLES[subjectArea]
    const colCounts = {}
    gradingFramework.components.forEach(c => { colCounts[c.key] = (activities[c.key] || []).length })
    const totalColCount = Object.values(colCounts).reduce((s, n) => s + n, 0)
    const componentPalette = [
      { text: 'text-[var(--color-primary-readable)]', headBg: 'bg-red-50/50 dark:bg-red-900/10', subBg: 'bg-red-50/30 dark:bg-red-900/5' },
      { text: 'text-blue-700 dark:text-blue-400', headBg: 'bg-blue-50/50 dark:bg-blue-900/10', subBg: 'bg-blue-50/30 dark:bg-blue-900/5' },
      { text: 'text-green-700 dark:text-green-400', headBg: 'bg-green-50/50 dark:bg-green-900/10', subBg: 'bg-green-50/30 dark:bg-green-900/5' },
      { text: 'text-purple-700 dark:text-purple-400', headBg: 'bg-purple-50/50 dark:bg-purple-900/10', subBg: 'bg-purple-50/30 dark:bg-purple-900/5' },
      { text: 'text-amber-700 dark:text-amber-400', headBg: 'bg-amber-50/50 dark:bg-amber-900/10', subBg: 'bg-amber-50/30 dark:bg-amber-900/5' },
    ]

    const semesterLabel = COLLEGE_SEMESTERS.find(s => s.id === collegeSemester)?.label ?? collegeSemester

    return (
      <div className="page-enter space-y-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <button onClick={() => setSelectedSubject(null)}
            className="mt-1 p-2 rounded-lg hover:bg-[var(--color-bg-subtle)] transition text-[var(--color-text-muted)]">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">
                {selectedSubject.subjectName}
              </h1>
              {isCollege && (
                <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">
                  College
                </span>
              )}
              {!isCollege && (() => {
                const pi = getParentComposite(selectedSubject.subjectName)
                return pi ? (
                  <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                    {pi.parentLabel} sub-subject
                  </span>
                ) : null
              })()}
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              {selectedSubject.section} · {selectedSubject.gradeLevel} · {currentSY}
            </p>
          </div>
        </div>

        {/* ── Config panel ──────────────────────────────────── */}
        <div className="card p-4 space-y-3">
          {/* Trimester notice (Basic Ed only) */}
          {!isCollege && isTrimester && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-700 dark:text-amber-300">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              Trimester mode — DepEd Order No. 015, s.2026 restructures grade components to
              Written/Oral Works, Product/Performance Tasks, and Examinations (ST1+ST2+TE) for
              SY 2026-2027. Score entry below still uses the WW/PT/QA layout; a dedicated
              WW/PT/EX entry screen is planned separately.
            </div>
          )}

          {isCollege ? (
            /* ── College config ── */
            <div className="space-y-3">
              <div className="max-w-xs">
                <label className="form-label mb-1">Semester</label>
                <GroupedSelect
                  value={collegeSemester}
                  onChange={v => {
                    setCollegeSemester(v)
                    buildCollegeRows(getStudents(selectedSubject.gradeLevel, selectedSubject.campusKey), selectedSubject, v)
                  }}
                  options={COLLEGE_SEMESTERS.map(s => ({ value: s.id, label: s.label }))}
                  allLabel="Select semester"
                  placeholder="Select semester"
                />
              </div>
              {/* College weight info */}
              <div className="flex flex-wrap gap-4 pt-2 border-t border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
                <span className="flex items-center gap-1"><Info className="w-3 h-3" /> Weights:</span>
                <span>Prelim: <strong className="text-[var(--color-text-primary)]">30%</strong></span>
                <span>Midterm: <strong className="text-[var(--color-text-primary)]">30%</strong></span>
                <span>Finals: <strong className="text-[var(--color-text-primary)]">40%</strong></span>
                <span className="ml-auto text-[var(--color-primary-readable)] font-medium">1.00–5.00 CHED Scale</span>
              </div>
            </div>
          ) : (
            /* ── Basic Ed config ── */
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="form-label mb-1">Grading Period</label>
                  <GroupedSelect value={gradingPeriod}
                    onChange={v => { setGradingPeriod(v); openGradeEntry(selectedSubject) }}
                    allLabel={null}
                    options={periods.map(p => ({ value: p.id, label: p.label }))} />
                  <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                    {isTrimester ? 'Trimester' : 'Quarterly'} · Set by principal
                  </p>
                </div>
    <div>
                  <label className="form-label mb-1">
                    Subject Area
                    {subjectArea && (
                      <span className="ml-2 text-[10px] font-normal text-green-600 dark:text-green-400">
                        ✓ Set by principal
                      </span>
                    )}
                  </label>
                  {subjectArea ? (
                    // Locked — set by principal in Subject Load. Cannot be changed by teacher.
                    <div className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)]/50 text-[var(--color-text-primary)] flex items-center justify-between">
                      <span>{SUBJECT_AREAS.find(sa => sa.id === subjectArea)?.label ?? subjectArea}</span>
                      <span className="text-[10px] text-[var(--color-text-muted)] ml-2 shrink-0">Locked</span>
                    </div>
                  ) : (
                    // Not set by principal — teacher can select manually
                    <GroupedSelect value={subjectArea} onChange={setSubjectArea}
                      allLabel="Select subject area..."
                      options={SUBJECT_AREAS.map(sa => ({ value: sa.id, label: sa.label }))} />
                  )}
                  <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                    {subjectArea ? 'Contact principal to change.' : 'Principal can pre-set this in Subject Load.'}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowActivitySetup(true)}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-subtle)] transition text-[var(--color-text-secondary)]">
                <Settings className="w-3.5 h-3.5" /> Configure Activities
              </button>
              {subjectArea && weights && (
                <div className="pt-3 border-t border-[var(--color-border)] flex flex-wrap gap-4 text-xs text-[var(--color-text-muted)]">
                  <span className="flex items-center gap-1"><Info className="w-3 h-3" /> Weights:</span>
                  {gradingFramework.components.map(c => (
                    <span key={c.key}>{c.label}: <strong className="text-[var(--color-text-primary)]">{Math.round((weights[c.key] || 0) * 100)}%</strong></span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Stats ─────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-3 text-xs">
          {isCollege ? (
            <>
              <span className="px-3 py-1.5 rounded-lg bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)]">{collegeRows.length} students</span>
              <span className="px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">{collegeFilledCount} entered</span>
              <span className="px-3 py-1.5 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300">{collegeComputedCount} computed</span>
            </>
          ) : (
            <>
              <span className="px-3 py-1.5 rounded-lg bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)]">{studentGrades.length} students</span>
              <span className="px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">{filledCount} entered</span>
              <span className="px-3 py-1.5 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300">{computedCount} computed</span>
            </>
          )}
        </div>

        {/* ── Basic Ed subject area warning ─────────────────── */}
        {!isCollege && !subjectArea && (
          <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-700 dark:text-amber-300">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> Select a Subject Area to enable auto-computation.
          </div>
        )}

        {/* ════════════════════════════════════════════════════
            COLLEGE GRADE ENTRY TABLE
            ════════════════════════════════════════════════════ */}
        {isCollege && (
          <>
            {collegeRows.length === 0 ? (
              <div className="card p-8 text-center">
                <Users className="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-3" />
                <h3 className="text-sm font-bold text-[var(--color-text-primary)] mb-1">No Students Found</h3>
                <p className="text-xs text-[var(--color-text-muted)]">
                  No approved enrollments for {selectedSubject.gradeLevel}. Approve enrollments first.{import.meta.env.DEV && ' (Dev: use "Seed test data" on the teacher dashboard.)'}
                </p>
              </div>
            ) : (
              <div className="min-w-0 card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs" style={{ minWidth: 660 + collegeGradingFramework.components.length * 80 }}>
                    <thead>
                      <tr className="bg-[var(--color-bg-subtle)]">
                        <th className="px-2 py-2 text-left font-semibold border-b border-[var(--color-border)] sticky left-0 bg-[var(--color-bg-subtle)] z-10" style={{ minWidth: 30 }}>#</th>
                        <th className="px-2 py-2 text-left font-semibold border-b border-[var(--color-border)] sticky left-8 bg-[var(--color-bg-subtle)] z-10" style={{ minWidth: 180 }}>Student Name</th>
                        {collegeGradingFramework.components.map((c, ci) => {
                          const palette = [
                            { text: 'text-[var(--color-primary-readable)]', bg: 'bg-red-50/50 dark:bg-red-900/10' },
                            { text: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-50/50 dark:bg-blue-900/10' },
                            { text: 'text-green-700 dark:text-green-400', bg: 'bg-green-50/50 dark:bg-green-900/10' },
                            { text: 'text-purple-700 dark:text-purple-400', bg: 'bg-purple-50/50 dark:bg-purple-900/10' },
                            { text: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50/50 dark:bg-amber-900/10' },
                          ]
                          const clr = palette[ci % palette.length]
                          return (
                            <th key={c.key} className={`px-2 py-2 text-center font-bold ${clr.text} border-b border-l border-[var(--color-border)] ${clr.bg}`} style={{ minWidth: 80 }}>
                              {c.label}<br /><span className="text-[10px] font-normal opacity-70">{Math.round((c.weight || 0) * 100)}%</span>
                            </th>
                          )
                        })}
                        <th className="px-2 py-2 text-center font-semibold border-b border-l border-[var(--color-border)]" style={{ minWidth: 80 }}>Sem. Grade</th>
                        <th className="px-2 py-2 text-center font-semibold border-b border-l border-[var(--color-border)]" style={{ minWidth: 80 }}>Point Grade</th>
                        <th className="px-2 py-2 text-center font-semibold border-b border-l border-[var(--color-border)]" style={{ minWidth: 100 }}>Descriptor</th>
                        <th className="px-2 py-2 text-center font-semibold border-b border-l border-[var(--color-border)]" style={{ minWidth: 120 }}>Special Grade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)]">
                      {collegeRows.map((row, idx) => {
                        const isLocked = row.status === 'submitted' || row.status === 'approved'
                        const effectiveGrade   = row.specialGrade || row.computed?.pointGrade || null
                        const effectiveDesc    = row.specialGrade
                          ? SPECIAL_GRADES.find(s => s.value === row.specialGrade)?.label ?? row.specialGrade
                          : row.computed?.descriptor ?? null
                        const passed           = !row.specialGrade && row.computed?.passed

                        return (
                          <tr key={row.studentId} className="hover:bg-[var(--color-bg-subtle)]/30 transition">
                            <td className="px-2 py-1.5 text-[var(--color-text-muted)] sticky left-0 bg-[var(--color-bg-card)] z-10">{idx + 1}</td>
                            <td className="px-2 py-1.5 font-medium text-[var(--color-text-primary)] whitespace-nowrap sticky left-8 bg-[var(--color-bg-card)] z-10" style={{ minWidth: 180 }}>
                              {row.studentName}
                              {isLocked && (
                                <span className="ml-2 px-1.5 py-0.5 text-[8px] font-bold rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 uppercase">
                                  {row.status}
                                </span>
                              )}
                            </td>

                            {/* Score inputs — one per component the active framework defines */}
                            {collegeGradingFramework.components.map(c => (
                              <td key={c.key} className="px-1 py-1 border-l border-[var(--color-border)]/30">
                                <input type="number" min={0} max={100} step="0.01"
                                  value={row.scores[c.key] ?? ''} disabled={isLocked}
                                  onChange={e => updateCollegeScore(idx, c.key, e.target.value === '' ? '' : Math.min(100, Math.max(0, Number(e.target.value))))}
                                  className="w-16 px-1 py-1 text-center border border-[var(--color-border)] rounded bg-[var(--color-bg-card)] text-[var(--color-text-primary)] outline-none focus:ring-1 focus:ring-primary transition disabled:opacity-40 text-xs"
                                  placeholder="0–100" />
                              </td>
                            ))}

                            {/* Semester Grade */}
                            <td className="px-2 py-1.5 text-center font-mono border-l border-[var(--color-border)]">
                              {row.specialGrade
                                ? <span className="text-[var(--color-text-muted)] italic text-[10px]">—</span>
                                : row.computed
                                  ? <span className="text-[var(--color-text-secondary)]">{row.computed.semesterGrade.toFixed(2)}</span>
                                  : ''}
                            </td>

                            {/* Point Grade */}
                            <td className="px-2 py-1.5 text-center border-l border-[var(--color-border)]">
                              {effectiveGrade ? (
                                <span className={`font-bold font-mono text-sm ${pointGradeColor(effectiveGrade)}`}>
                                  {effectiveGrade}
                                </span>
                              ) : ''}
                            </td>

                            {/* Descriptor */}
                            <td className="px-2 py-1.5 text-center border-l border-[var(--color-border)]">
                              <span className={`text-[10px] ${
                                row.specialGrade ? 'text-amber-600 dark:text-amber-400 italic' :
                                passed ? 'text-green-600 dark:text-green-400' :
                                effectiveGrade ? 'text-red-500' : 'text-[var(--color-text-muted)]'
                              }`}>
                                {effectiveDesc ?? ''}
                              </span>
                            </td>

                            {/* Special Grade */}
                            <td className="px-1 py-1 border-l border-[var(--color-border)]">
                              {isLocked ? (
                                <span className="text-[10px] text-[var(--color-text-muted)]">{row.specialGrade || '—'}</span>
                              ) : (
                                <GroupedSelect
                                  value={row.specialGrade || 'all'}
                                  onChange={v => updateCollegeScore(idx, 'specialGrade', v === 'all' ? '' : v)}
                                  options={SPECIAL_GRADES}
                                  allLabel="None"
                                  placeholder="None"
                                  className="text-xs"
                                />
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* College action bar */}
            {collegeRows.length > 0 && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 card p-4">
                <p className="text-xs text-[var(--color-text-muted)]">
                  {collegeFilledCount} of {collegeRows.length} graded · {collegeDraftCount} drafts · {semesterLabel}
                </p>
                <div className="flex gap-2">
                  <button onClick={handleCollegeSaveDraft}
                    disabled={saving || collegeFilledCount === 0}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-subtle)] transition text-[var(--color-text-secondary)] disabled:opacity-50">
                    <Save className="w-4 h-4" /> Save Draft
                  </button>
                  <button onClick={() => setShowSubmitConfirm(true)}
                    disabled={collegeDraftCount === 0}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-primary text-[var(--color-primary-contrast)] rounded-lg hover:bg-[var(--color-primary-hover)] transition disabled:opacity-50">
                    <Send className="w-4 h-4" /> Submit to Program Head
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ════════════════════════════════════════════════════
            BASIC ED GRADE ENTRY TABLE
            ════════════════════════════════════════════════════ */}
        {!isCollege && (
          <>
            {studentGrades.length === 0 ? (
              <div className="card p-8 text-center">
                <Users className="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-3" />
                <h3 className="text-sm font-bold text-[var(--color-text-primary)] mb-1">No Students Found</h3>
                <p className="text-xs text-[var(--color-text-muted)]">No approved enrollments for {selectedSubject.gradeLevel}.</p>
              </div>
            ) : (
              <div className="min-w-0 card overflow-hidden" ref={tableRef}>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs" style={{ minWidth: `${300 + (totalColCount + gradingFramework.components.length * 3 + 4) * 60}px` }}>
                    <thead>
                      <tr className="bg-[var(--color-bg-subtle)]">
                        <th className="px-2 py-2 text-left font-semibold text-[var(--color-text-primary)] border-b border-[var(--color-border)] sticky left-0 bg-[var(--color-bg-subtle)] z-10" rowSpan={2} style={{ minWidth: 30 }}>#</th>
                        <th className="px-2 py-2 text-left font-semibold text-[var(--color-text-primary)] border-b border-[var(--color-border)] sticky left-8 bg-[var(--color-bg-subtle)] z-10" rowSpan={2} style={{ minWidth: 180 }}>Student Name</th>
                        {gradingFramework.components.map((c, ci) => colCounts[c.key] > 0 && (
                          <th key={c.key} colSpan={colCounts[c.key] + 3} className={`px-2 py-2 text-center font-bold ${componentPalette[ci % componentPalette.length].text} border-b border-l border-[var(--color-border)] ${componentPalette[ci % componentPalette.length].headBg}`}>
                            {c.label.toUpperCase()}
                          </th>
                        ))}
                        <th className="px-2 py-2 text-center font-bold border-b border-l border-[var(--color-border)]" rowSpan={2}>Initial</th>
                        <th className="px-2 py-2 text-center font-bold border-b border-l border-[var(--color-border)]" rowSpan={2}>Grade</th>
                      </tr>
                      <tr className="bg-[var(--color-bg-subtle)]/60">
                        {gradingFramework.components.map((c, ci) => {
                          const clr = componentPalette[ci % componentPalette.length]
                          return (
                            <Fragment key={c.key}>
                              {(activities[c.key] || []).map((a, i) => (
                                <th key={`${c.key}${i}`} className={`px-1 py-1.5 text-center font-medium text-[var(--color-text-muted)] border-b ${ci > 0 ? 'border-l' : ''} border-[var(--color-border)] ${clr.subBg}`} style={{ minWidth: 50 }} title={a.name}>{a.name}</th>
                              ))}
                              <th className={`px-1 py-1.5 text-center font-semibold text-[var(--color-text-secondary)] border-b border-[var(--color-border)] ${clr.subBg}`}>Total</th>
                              <th className={`px-1 py-1.5 text-center font-semibold text-[var(--color-text-secondary)] border-b border-[var(--color-border)] ${clr.subBg}`}>PS</th>
                              <th className={`px-1 py-1.5 text-center font-semibold text-[var(--color-text-secondary)] border-b border-[var(--color-border)] ${clr.subBg}`}>WS</th>
                            </Fragment>
                          )
                        })}
                      </tr>
                      {/* Highest Possible Score row */}
                      <tr className="bg-amber-50/50 dark:bg-amber-900/10">
                        <td colSpan={2} className="px-2 py-1.5 text-[10px] font-bold text-amber-700 dark:text-amber-400 sticky left-0 bg-amber-50/50 dark:bg-amber-900/10 z-10">HIGHEST POSSIBLE SCORE</td>
                        {gradingFramework.components.map((c, ci) => (
                          <Fragment key={c.key}>
                            {(activities[c.key] || []).map((a, i) => (
                              <td key={`m${c.key}${i}`} className={`px-1 py-1.5 text-center font-bold text-amber-700 dark:text-amber-400 text-[10px] ${ci > 0 && i === 0 ? 'border-l border-[var(--color-border)]' : ''}`}>{a.maxScore}</td>
                            ))}
                            <td className="px-1 py-1.5 text-center font-bold text-amber-700 dark:text-amber-400 text-[10px]">{(activities[c.key] || []).reduce((s, a) => s + (a.maxScore || 0), 0)}</td>
                            <td className="px-1 py-1.5 text-center text-[10px] text-amber-600/60">100</td>
                            <td className="px-1 py-1.5 text-center text-[10px] text-amber-600/60">{weights ? `${Math.round((weights[c.key] || 0) * 100)}%` : '-'}</td>
                          </Fragment>
                        ))}
                        <td className="px-1 py-1.5 border-l border-[var(--color-border)]" />
                        <td className="px-1 py-1.5 border-l border-[var(--color-border)]" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)]">
                      {studentGrades.map((row, idx) => {
                        const isLocked = row.status === 'submitted' || row.status === 'approved'
                        const compStats = {}
                        gradingFramework.components.forEach(c => {
                          const arr = row.scores[c.key] || []
                          const sum = arr.reduce((s, v) => s + (Number(v) || 0), 0)
                          const max = (activities[c.key] || []).reduce((s, a) => s + (a.maxScore || 0), 0)
                          compStats[c.key] = { sum, max, ps: max > 0 ? Math.round((sum / max) * 10000) / 100 : 0 }
                        })

                        return (
                          <tr key={row.studentId} className="hover:bg-[var(--color-bg-subtle)]/30 transition">
                            <td className="px-2 py-1 text-[var(--color-text-muted)] sticky left-0 bg-[var(--color-bg-card)] z-10">{idx + 1}</td>
                            <td className="px-2 py-1 font-medium text-[var(--color-text-primary)] whitespace-nowrap sticky left-8 bg-[var(--color-bg-card)] z-10" style={{ minWidth: 180 }}>{row.studentName}</td>
                            {gradingFramework.components.map((c, ci) => (
                              <Fragment key={c.key}>
                                {(row.scores[c.key] || []).map((v, i) => (
                                  <td key={`${c.key}${i}`} className={`px-0.5 py-0.5 ${ci > 0 && i === 0 ? 'border-l border-[var(--color-border)]/30' : ''}`}>
                                    <input type="number" min={0} max={activities[c.key]?.[i]?.maxScore || 999} value={v} disabled={isLocked}
                                      onChange={e => updateScore(idx, c.key, i, e.target.value)}
                                      className="w-12 px-1 py-1 text-center border border-[var(--color-border)] rounded bg-[var(--color-bg-card)] text-[var(--color-text-primary)] outline-none focus:ring-1 focus:ring-primary transition disabled:opacity-40 text-xs" />
                                  </td>
                                ))}
                                <td className="px-1 py-1 text-center font-medium text-[var(--color-text-secondary)]">{compStats[c.key].sum || ''}</td>
                                <td className="px-1 py-1 text-center text-[var(--color-text-muted)]">{(row.scores[c.key] || []).some(v => v !== '') ? compStats[c.key].ps.toFixed(2) : ''}</td>
                                <td className="px-1 py-1 text-center text-[var(--color-text-muted)]">{row.computed?.breakdown?.[c.key]?.weighted != null ? row.computed.breakdown[c.key].weighted.toFixed(2) : ''}</td>
                              </Fragment>
                            ))}
                            <td className="px-2 py-1 text-center font-mono border-l border-[var(--color-border)]">{row.computed ? row.computed.initial : ''}</td>
                            <td className="px-2 py-1 text-center font-mono font-bold border-l border-[var(--color-border)]">
                              {row.computed ? (
                                <span className={row.computed.passed ? 'text-green-600 dark:text-green-400' : 'text-red-500'}>
                                  {row.computed.transmuted}
                                </span>
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

            {/* Basic Ed action bar */}
            {studentGrades.length > 0 && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 card p-4">
                <p className="text-xs text-[var(--color-text-muted)]">{filledCount} of {studentGrades.length} graded · {draftCount} drafts</p>
                <div className="flex gap-2">
                  <button onClick={handleExport} disabled={exporting || !subjectArea || filledCount === 0}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-subtle)] transition text-[var(--color-text-secondary)] disabled:opacity-50">
                    <Download className={`w-4 h-4 ${exporting ? 'animate-spin' : ''}`} />
                    {exporting ? 'Exporting...' : 'Export'}
                  </button>
                  <button onClick={handleSaveDraft} disabled={saving || !subjectArea || filledCount === 0}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-subtle)] transition text-[var(--color-text-secondary)] disabled:opacity-50">
                    <Save className="w-4 h-4" /> Save Draft
                  </button>
                  <button onClick={() => setShowSubmitConfirm(true)} disabled={!subjectArea || draftCount === 0}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-primary text-[var(--color-primary-contrast)] rounded-lg hover:bg-[var(--color-primary-hover)] transition disabled:opacity-50">
                    <Send className="w-4 h-4" /> Submit
                  </button>
                </div>
              </div>
            )}

            {/* Activity Setup Modal */}
            {showActivitySetup && (
              <ActivitySetupModal
                activities={activities}
                framework={gradingFramework}
                onSave={saveActivityConfig}
                onClose={() => setShowActivitySetup(false)}
              />
            )}
          </>
        )}

        {/* Submit Confirm Modal */}
        {showSubmitConfirm && (
          <ModalPortal>
            <div className="modal-backdrop">
              <div className="modal-panel" style={{ maxWidth: '28rem' }}>
                <div className="p-5 text-center">
                  <Send className="w-10 h-10 text-[var(--color-primary-readable)] mx-auto mb-3" />
                  <h3 className="text-base font-bold text-[var(--color-text-primary)] mb-1">Submit Grades?</h3>
                  <p className="text-xs text-[var(--color-text-muted)] mb-4">
                    {isCollege
                      ? `Submit ${collegeDraftCount} college grade${collegeDraftCount !== 1 ? 's' : ''} for ${selectedSubject.subjectName} (${semesterLabel}) to the Program Head. You won't be able to edit until returned.`
                      : `Submit ${draftCount} grade${draftCount !== 1 ? 's' : ''} for ${selectedSubject.subjectName} (${gradingPeriod}). You won't be able to edit until the principal returns them.`
                    }
                  </p>
                  <div className="flex gap-2 justify-center">
                    <button onClick={() => setShowSubmitConfirm(false)} className="btn-cancel">Cancel</button>
                    <button onClick={isCollege ? handleCollegeSubmit : handleSubmit}
                      className="btn-action flex items-center gap-1.5">
                      <Send className="w-4 h-4" /> Submit
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </ModalPortal>
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
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          {user?.campus} · Select a subject to enter grades
        </p>
      </div>

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
                  <Users className="w-4 h-4 text-[var(--color-primary-readable)]" />
                  <h3 className="text-sm font-bold text-[var(--color-text-primary)]">{sec.section}</h3>
                  <span className="text-xs text-[var(--color-text-muted)]">· {sec.gradeLevel} · {sec.subjects.length} subject{sec.subjects.length !== 1 ? 's' : ''}</span>
                  {sec.department === 'college' && (
                    <span className="ml-auto px-2 py-0.5 text-[10px] font-semibold rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">
                      College
                    </span>
                  )}
                </div>
              </div>
              <div className="divide-y divide-[var(--color-border)]">
                {sec.subjects.map((subj, idx) => {
                  const parentInfo = getParentComposite(subj.subjectName)
                  if (!subj.department || subj.department === 'basicEd') {
                    if (getCompositeConfig(subj.subjectName)) return null
                  }
                  return (
                    <button key={idx} onClick={() => openGradeEntry(subj)}
                      className="w-full flex items-center justify-between p-4 hover:bg-[var(--color-bg-subtle)]/50 transition text-left">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                          subj.department === 'college' ? 'bg-indigo-500/10' :
                          parentInfo ? 'bg-purple-500/10' : 'bg-primary/10'
                        }`}>
                          <BookOpen className={`w-4 h-4 ${
                            subj.department === 'college' ? 'text-indigo-500' :
                            parentInfo ? 'text-purple-500' : 'text-[var(--color-primary-readable)]'
                          }`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-[var(--color-text-primary)]">{subj.subjectName}</p>
                            {subj.department === 'college' && (
                              <span className="px-1.5 py-0.5 text-[8px] font-semibold rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">COLLEGE</span>
                            )}
                            {parentInfo && (
                              <span className="px-1.5 py-0.5 text-[8px] font-semibold rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">{parentInfo.parentLabel}</span>
                            )}
                          </div>
                          <p className="text-xs text-[var(--color-text-muted)]">
                            {subj.gradeCount > 0 ? `${subj.gradeCount} grades entered` : 'No grades yet'}
                          </p>
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
                  )
                })}

                {/* Composite subject merge cards (Basic Ed only) */}
                {sec.department !== 'college' && Object.entries(COMPOSITE_SUBJECTS).map(([key, config]) => {
                  const subs = sec.subjects.filter(s => {
                    const p = getParentComposite(s.subjectName)
                    return p && p.parent === key
                  })
                  if (subs.length === 0) return null

                  const subGrades = {}
                  config.subSubjects.forEach(ss => {
                    const subj = subs.find(s => s.subjectName === ss.label)
                    if (subj) {
                      // Use period-aware lookup so Q1 Music & Arts doesn't mix with Q2 PE & Health
                      const gradeRecord = gradeByKeyAndPeriod[`${subj.subjectId}_${subj.sectionId}_${gradingPeriod}`]
                      if (gradeRecord?.transmuted) subGrades[ss.id] = gradeRecord.transmuted
                    }
                  })
                  const mergedGrade = computeCompositeGrade(subGrades, key)
                  const allEntered  = config.subSubjects.every(ss => subGrades[ss.id] > 0)

                  return (
                    <div key={key} className="p-4 bg-purple-50/50 dark:bg-purple-900/5 border-t border-[var(--color-border)]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-purple-500/10 rounded-lg flex items-center justify-center">
                            <ClipboardList className="w-4 h-4 text-purple-500" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-purple-700 dark:text-purple-300">{config.label} — Merged Grade</p>
                              <span className="px-1.5 py-0.5 text-[8px] font-semibold rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">Auto</span>
                            </div>
                            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                              {config.subSubjects.map(ss => `${ss.label}: ${subGrades[ss.id] || '—'}`).join(' · ')}
                              {config.mergeMethod === 'weighted' && ` · Formula: ${config.subSubjects.map(ss => `${ss.weight * 100}%`).join(' + ')}`}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          {allEntered ? (
                            <div>
                              <p className={`text-lg font-bold font-mono ${mergedGrade >= 75 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>{mergedGrade}</p>
                              <p className="text-[9px] text-[var(--color-text-muted)]">{mergedGrade >= 75 ? 'PASSED' : 'FAILED'}</p>
                            </div>
                          ) : (
                            <p className="text-xs text-[var(--color-text-muted)] italic">Waiting for all sub-subjects</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
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
// Activity Setup Modal (Basic Ed only)
// ═══════════════════════════════════════════════════════════════
function ActivitySetupModal({ activities, framework, onSave, onClose }) {
  const [draft, setDraft] = useState(() => {
    const init = {}
    framework.components.forEach(c => { init[c.key] = [...(activities[c.key] || [])] })
    return init
  })

  const addActivity = (component) => {
    const defaultMax = component === framework.components[framework.components.length - 1].key ? 100 : 20
    setDraft(prev => ({
      ...prev,
      [component]: [...prev[component], { name: `Item ${prev[component].length + 1}`, maxScore: defaultMax }]
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

  const componentColors = [
    'text-[var(--color-primary-readable)]', 'text-blue-700 dark:text-blue-400', 'text-green-700 dark:text-green-400',
    'text-purple-700 dark:text-purple-400', 'text-amber-700 dark:text-amber-400',
  ]

  const renderSection = (label, component, color) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className={`text-sm font-bold ${color}`}>{label}</h4>
        <button onClick={() => addActivity(component)}
          className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-lg bg-[var(--color-bg-subtle)] hover:bg-[var(--color-bg-muted)] transition text-[var(--color-text-secondary)]">
          <Plus className="w-3 h-3" /> Add
        </button>
      </div>
      {(draft[component] || []).length === 0 && <p className="text-[10px] text-[var(--color-text-muted)] italic">No activities added</p>}
      {(draft[component] || []).map((act, idx) => (
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
    <ModalPortal>
      <div className="modal-backdrop">
        <div className="modal-panel" style={{ maxWidth: '32rem' }}>
          <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
            <div>
              <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Configure Activities</h3>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">Set up quizzes, tasks, and exams with their highest possible scores</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--color-bg-subtle)] transition">
              <X className="w-4 h-4 text-[var(--color-text-muted)]" />
            </button>
          </div>
          <div className="p-4 space-y-5 max-h-[60vh] overflow-y-auto">
            {framework.components.map((c, ci) => (
              <Fragment key={c.key}>
                {ci > 0 && <div className="border-t border-[var(--color-border)]" />}
                {renderSection(c.label, c.key, componentColors[ci % componentColors.length])}
              </Fragment>
            ))}
          </div>
          <div className="flex justify-end gap-2 p-4 border-t border-[var(--color-border)]">
            <button onClick={onClose} className="btn-cancel">Cancel</button>
            <button onClick={() => onSave(draft)} className="btn-action flex items-center gap-1.5">
              <Save className="w-4 h-4" /> Save Activities
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}