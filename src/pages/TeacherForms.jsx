/**
 * TeacherForms.jsx — ALMIRENE DX
 * ─────────────────────────────────────────────────────────────────
 * Teacher fills filters → system builds data preview → teacher exports.
 *
 * If Super Admin uploaded a template for a form type:
 *   → the template format is used and data is auto-filled into it
 * If no template uploaded:
 *   → a clean DepEd-compliant workbook is generated from scratch
 * ─────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Calendar, FileText, TrendingUp, Heart, Archive, BookOpen,
  Download, Eye, CheckCircle, AlertCircle, Upload,
  ChevronRight, Loader, Info, Users
} from 'lucide-react'
import { useAuth }      from '../context/AuthContext'
import { useAppConfig } from '../context/AppConfigContext'
import GroupedSelect    from '../components/GroupedSelect'
import { PageSkeleton, useToast, ToastContainer } from '../components/UIComponents'
import {
  FORM_TYPES, MONTHS,
  getSectionStudents, getTeacherSections,
  buildSF1Data, buildSF2Data, buildSF5Data, buildSF8Data, buildSF9Data, buildSF10Data,
  exportSF1, exportSF2, exportSF5, exportSF8, exportSF9, exportSF10,
  hasTemplate,
} from '../utils/teacherFormsBridge'

// ── Icon map ───────────────────────────────────────────────────────
const ICON_MAP = {
  Calendar, FileText, TrendingUp, Heart, Archive, BookOpen,
}

const COLOR_MAP = {
  blue:   { bg: 'bg-[var(--color-info-light)]',   icon: 'text-[var(--color-info-text)]',   badge: 'bg-[var(--color-info-light)] text-[var(--color-info-text)]'   },
  green:  { bg: 'bg-[var(--color-success-light)]', icon: 'text-[var(--color-success-text)]', badge: 'bg-[var(--color-success-light)] text-[var(--color-success-text)]' },
  pink:   { bg: 'bg-[var(--color-cat-pink-bg)]',   icon: 'text-[var(--color-cat-pink-text)]',   badge: 'bg-[var(--color-cat-pink-bg)] text-[var(--color-cat-pink-text)]'   },
  purple: { bg: 'bg-[var(--color-cat-purple-bg)]', icon: 'text-[var(--color-cat-purple-text)]', badge: 'bg-[var(--color-cat-purple-bg)] text-[var(--color-cat-purple-text)]' },
  orange: { bg: 'bg-[var(--color-cat-orange-bg)]', icon: 'text-[var(--color-cat-orange-text)]', badge: 'bg-[var(--color-cat-orange-bg)] text-[var(--color-cat-orange-text)]' },
  red:    { bg: 'bg-[var(--color-error-light)]',    icon: 'text-[var(--color-error-text)]',     badge: 'bg-[var(--color-error-light)] text-[var(--color-error-text)]'     },
}

// ── Preview table component ────────────────────────────────────────
function PreviewTable({ formId, data }) {
  if (!data || !data.students || data.students.length === 0) {
    return (
      <div className="text-center py-10 text-[var(--color-text-muted)]">
        <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No students found for the selected section.</p>
        <p className="text-xs mt-1">Make sure students are enrolled in this section.</p>
      </div>
    )
  }

  if (formId === 'sf2') {
    return (
      <div className="overflow-x-auto">
        <table className="text-xs w-full min-w-[500px]">
          <thead>
            <tr className="bg-[var(--color-bg-subtle)] border-b border-[var(--color-border)]">
              <th className="text-left px-3 py-2 font-semibold text-[var(--color-text-muted)]">No.</th>
              <th className="text-left px-3 py-2 font-semibold text-[var(--color-text-muted)]">Name</th>
              <th className="text-left px-3 py-2 font-semibold text-[var(--color-text-muted)]">LRN</th>
              <th className="text-left px-3 py-2 font-semibold text-[var(--color-text-muted)]">Sex</th>
              <th className="text-right px-3 py-2 font-semibold text-[var(--color-text-muted)]">Absent</th>
              <th className="text-right px-3 py-2 font-semibold text-[var(--color-text-muted)]">Tardy</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {data.students.map((s, i) => (
              <tr key={i} className="hover:bg-[var(--color-bg-subtle)] transition-colors">
                <td className="px-3 py-2 text-[var(--color-text-muted)]">{i+1}</td>
                <td className="px-3 py-2 font-medium text-[var(--color-text-primary)]">{s.name}</td>
                <td className="px-3 py-2 font-mono text-[var(--color-text-muted)]">{s.lrn || '—'}</td>
                <td className="px-3 py-2 text-[var(--color-text-muted)]">{s.sex || '—'}</td>
                <td className="px-3 py-2 text-right text-[var(--color-text-secondary)]">{s.totalAbsent ?? 0}</td>
                <td className="px-3 py-2 text-right text-[var(--color-text-secondary)]">{s.totalTardy ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (formId === 'sf5') {
    return (
      <div className="overflow-x-auto">
        <table className="text-xs w-full min-w-[500px]">
          <thead>
            <tr className="bg-[var(--color-bg-subtle)] border-b border-[var(--color-border)]">
              <th className="text-left px-3 py-2 font-semibold text-[var(--color-text-muted)]">No.</th>
              <th className="text-left px-3 py-2 font-semibold text-[var(--color-text-muted)]">Name</th>
              <th className="text-left px-3 py-2 font-semibold text-[var(--color-text-muted)]">LRN</th>
              <th className="text-center px-3 py-2 font-semibold text-[var(--color-text-muted)]">GWA</th>
              <th className="text-center px-3 py-2 font-semibold text-[var(--color-text-muted)]">Action</th>
              <th className="text-left px-3 py-2 font-semibold text-[var(--color-text-muted)]">Failed Areas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {data.students.map((s, i) => (
              <tr key={i} className="hover:bg-[var(--color-bg-subtle)] transition-colors">
                <td className="px-3 py-2 text-[var(--color-text-muted)]">{i+1}</td>
                <td className="px-3 py-2 font-medium text-[var(--color-text-primary)]">{s.name}</td>
                <td className="px-3 py-2 font-mono text-[var(--color-text-muted)]">{s.lrn || '—'}</td>
                <td className="px-3 py-2 text-center font-bold"
                    style={{ color: !s.gwa ? 'var(--color-text-muted)' : s.gwa >= 75 ? 'var(--color-success)' : 'var(--color-error-text)' }}>
                  {s.gwa ?? '—'}
                </td>
                <td className="px-3 py-2 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    s.action === 'PROMOTED' ? 'bg-[var(--color-success-light)] text-[var(--color-success-text)]' :
                    s.action === 'RETAINED' ? 'bg-[var(--color-error-light)] text-[var(--color-error-text)]' :
                    'bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]'
                  }`}>{s.action}</span>
                </td>
                <td className="px-3 py-2 text-[var(--color-text-muted)]">{s.failedAreas || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (formId === 'sf9') {
    const subjects = data.subjects || []
    const periods  = [...(data.periods || ['Q1','Q2','Q3','Q4']), 'Final']
    return (
      <div className="overflow-x-auto">
        <table className="text-xs w-full min-w-[600px]">
          <thead>
            <tr className="bg-[var(--color-bg-subtle)] border-b border-[var(--color-border)]">
              <th className="text-left px-3 py-2 font-semibold text-[var(--color-text-muted)] sticky left-0 bg-[var(--color-bg-subtle)]">Name</th>
              {subjects.map(sub => (
                <th key={sub} className="text-center px-2 py-2 font-semibold text-[var(--color-text-muted)] whitespace-nowrap" colSpan={periods.length}>
                  {sub.length > 12 ? sub.substring(0, 12) + '…' : sub}
                </th>
              ))}
            </tr>
            <tr className="bg-[var(--color-bg-subtle)] border-b border-[var(--color-border)]">
              <th className="sticky left-0 bg-[var(--color-bg-subtle)]" />
              {subjects.flatMap(sub => periods.map(p => (
                <th key={`${sub}-${p}`} className="text-center px-1 py-1 text-[9px] font-medium text-[var(--color-text-muted)]">{p}</th>
              )))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {data.students.map((s, i) => (
              <tr key={i} className="hover:bg-[var(--color-bg-subtle)] transition-colors">
                <td className="px-3 py-2 font-medium text-[var(--color-text-primary)] sticky left-0 bg-[var(--color-bg-card)]">{s.name}</td>
                {subjects.flatMap(sub => periods.map(p => (
                  <td key={`${sub}-${p}`} className={`px-1 py-2 text-center ${p === 'Final' ? 'font-bold' : ''}`}
                      style={{ color: s.grades?.[sub]?.[p] ? (s.grades[sub][p] >= 75 ? 'var(--color-success)' : 'var(--color-error-text)') : 'var(--color-text-muted)' }}>
                    {s.grades?.[sub]?.[p] || '—'}
                  </td>
                )))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (formId === 'sf1') {
    return (
      <div className="overflow-x-auto">
        <table className="text-xs w-full min-w-[700px]">
          <thead>
            <tr className="bg-[var(--color-bg-subtle)] border-b border-[var(--color-border)]">
              <th className="text-left px-3 py-2 font-semibold text-[var(--color-text-muted)]">No.</th>
              <th className="text-left px-3 py-2 font-semibold text-[var(--color-text-muted)]">Name</th>
              <th className="text-left px-3 py-2 font-semibold text-[var(--color-text-muted)]">LRN</th>
              <th className="text-center px-2 py-2 font-semibold text-[var(--color-text-muted)]">Sex</th>
              <th className="text-center px-2 py-2 font-semibold text-[var(--color-text-muted)]">Birthdate</th>
              <th className="text-center px-2 py-2 font-semibold text-[var(--color-text-muted)]">Age</th>
              <th className="text-left px-2 py-2 font-semibold text-[var(--color-text-muted)]">Contact</th>
              <th className="text-left px-2 py-2 font-semibold text-[var(--color-text-muted)]">Father</th>
              <th className="text-left px-2 py-2 font-semibold text-[var(--color-text-muted)]">Mother</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {data.students.map((s, i) => (
              <tr key={i} className="hover:bg-[var(--color-bg-subtle)] transition-colors">
                <td className="px-3 py-2 text-[var(--color-text-muted)]">{i+1}</td>
                <td className="px-3 py-2 font-medium text-[var(--color-text-primary)]">{s.name}</td>
                <td className="px-3 py-2 font-mono text-[var(--color-text-muted)]">{s.lrn || '—'}</td>
                <td className="px-2 py-2 text-center text-[var(--color-text-muted)]">{s.sex || '—'}</td>
                <td className="px-2 py-2 text-center text-[var(--color-text-muted)]">{s.birthdate || '—'}</td>
                <td className="px-2 py-2 text-center text-[var(--color-text-secondary)]">{s.age || '—'}</td>
                <td className="px-2 py-2 text-[var(--color-text-muted)]">{s.contactNumber || '—'}</td>
                <td className="px-2 py-2 text-[var(--color-text-muted)]">{s.fatherName || '—'}</td>
                <td className="px-2 py-2 text-[var(--color-text-muted)]">{s.motherName || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // Default: SF8, SF10 — simple list
  return (
    <div className="overflow-x-auto">
      <table className="text-xs w-full min-w-[400px]">
        <thead>
          <tr className="bg-[var(--color-bg-subtle)] border-b border-[var(--color-border)]">
            <th className="text-left px-3 py-2 font-semibold text-[var(--color-text-muted)]">No.</th>
            <th className="text-left px-3 py-2 font-semibold text-[var(--color-text-muted)]">Name</th>
            <th className="text-left px-3 py-2 font-semibold text-[var(--color-text-muted)]">LRN</th>
            <th className="text-center px-3 py-2 font-semibold text-[var(--color-text-muted)]">Sex</th>
            {formId === 'sf10' && (
              <th className="text-center px-3 py-2 font-semibold text-[var(--color-text-muted)]">GWA</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {data.students.map((s, i) => (
            <tr key={i} className="hover:bg-[var(--color-bg-subtle)] transition-colors">
              <td className="px-3 py-2 text-[var(--color-text-muted)]">{i+1}</td>
              <td className="px-3 py-2 font-medium text-[var(--color-text-primary)]">{s.name}</td>
              <td className="px-3 py-2 font-mono text-[var(--color-text-muted)]">{s.lrn || '—'}</td>
              <td className="px-3 py-2 text-center text-[var(--color-text-muted)]">{s.sex || '—'}</td>
              {formId === 'sf10' && (
                <td className="px-3 py-2 text-center font-bold"
                    style={{ color: !s.gwa ? 'var(--color-text-muted)' : s.gwa >= 75 ? 'var(--color-success)' : 'var(--color-error-text)' }}>
                  {s.gwa ?? '—'}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────
export default function TeacherForms() {
  const { user }                       = useAuth()
  const { campuses, currentSchoolYear } = useAppConfig()
  const { toasts, addToast, removeToast } = useToast()

  const [loading,    setLoading]    = useState(true)
  const [exporting,  setExporting]  = useState(null)   // formId being exported
  const [previewing, setPreviewing] = useState(null)   // formId being previewed

  // Filters — campus comes from user header, no manual override needed
  const userCampus = user?.campus || campuses?.[0]?.name || ''
  const [selectedSY,      setSelectedSY]      = useState(currentSchoolYear || '2025-2026')
  const [selectedGrade,   setSelectedGrade]   = useState('')
  const [selectedSection, setSelectedSection] = useState('')
  const [selectedMonth,   setSelectedMonth]   = useState(MONTHS[0])

  // Sections from THIS teacher's subject load assignments only
  const [sections, setSections] = useState([])
  useEffect(() => {
    const teacherSections = getTeacherSections(userCampus, selectedSY, user?.id || user?.email)
    setSections(teacherSections)
    // Auto-select first section if only one
    if (teacherSections.length === 1) {
      setSelectedGrade(teacherSections[0].gradeLevel)
      setSelectedSection(teacherSections[0].section)
    } else {
      setSelectedGrade('')
      setSelectedSection('')
    }
  }, [userCampus, selectedSY, user?.id, user?.email])

  // Unique grade levels from teacher's sections only
  const gradeLevels = useMemo(() => {
    const set = new Set(sections.map(s => s.gradeLevel).filter(Boolean))
    return Array.from(set).sort()
  }, [sections])

  // Filtered sections by selected grade
  const filteredSections = useMemo(() => {
    if (!selectedGrade) return sections
    return sections.filter(s => s.gradeLevel === selectedGrade)
  }, [sections, selectedGrade])

  // Preview data
  const [previewData, setPreviewData] = useState(null)
  const buildPreview = useCallback((formId) => {
    setPreviewing(formId)
    setPreviewData(null)
    const campusKey  = userCampus
    const gradeLevel = selectedGrade
    const section    = selectedSection

    try {
      let data
      if (formId === 'sf1')  data = buildSF1Data(campusKey, gradeLevel, section, selectedSY)
      if (formId === 'sf2')  data = buildSF2Data(campusKey, gradeLevel, section, selectedSY, selectedMonth)
      if (formId === 'sf5')  data = buildSF5Data(campusKey, gradeLevel, section, selectedSY)
      if (formId === 'sf8')  data = buildSF8Data(campusKey, gradeLevel, section, selectedSY)
      if (formId === 'sf9')  data = buildSF9Data(campusKey, gradeLevel, section, selectedSY)
      if (formId === 'sf10') data = buildSF10Data(campusKey, gradeLevel, section, selectedSY)
      setPreviewData(data)
    } catch (err) {
      addToast(`Preview error: ${err.message}`, 'error')
    }
  }, [userCampus, selectedGrade, selectedSection, selectedSY, selectedMonth])

  const handleExport = useCallback(async (formId) => {
    setExporting(formId)
    const campusKey  = userCampus
    const gradeLevel = selectedGrade
    const section    = selectedSection
    try {
      let count
      if (formId === 'sf1')  count = await exportSF1(campusKey, gradeLevel, section, selectedSY)
      if (formId === 'sf2')  count = await exportSF2(campusKey, gradeLevel, section, selectedSY, selectedMonth)
      if (formId === 'sf5')  count = await exportSF5(campusKey, gradeLevel, section, selectedSY)
      if (formId === 'sf8')  count = await exportSF8(campusKey, gradeLevel, section, selectedSY)
      if (formId === 'sf9')  count = await exportSF9(campusKey, gradeLevel, section, selectedSY)
      if (formId === 'sf10') count = await exportSF10(campusKey, gradeLevel, section, selectedSY)
      addToast(`${FORM_TYPES.find(f => f.id === formId)?.label} exported — ${count} student${count !== 1 ? 's' : ''}.`, 'success')
    } catch (err) {
      addToast(`Export failed: ${err.message}`, 'error')
    } finally {
      setExporting(null)
    }
  }, [userCampus, selectedGrade, selectedSection, selectedSY, selectedMonth])

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 150)
    return () => clearTimeout(t)
  }, [])

  if (loading) return <PageSkeleton />

  // Select options
  const syOptions      = ['2024-2025','2025-2026','2026-2027'].map(y => ({ value: y, label: y }))
  const gradeOptions   = gradeLevels.map(g => ({ value: g, label: g }))
  const sectionOptions = filteredSections.map(s => ({
    value: s.section || s.gradeLevel,
    label: s.section ? `${s.section} (${s.gradeLevel})` : s.gradeLevel,
  }))
  const monthOptions   = MONTHS.map(m => ({ value: m, label: m }))
  const canExport = selectedGrade && selectedSection

  return (
    <div className="page-enter space-y-5 p-1">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Teacher Forms</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
          Select your section and month, preview the data, then export the DepEd form.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-[var(--color-bg-card)] rounded-2xl border border-[var(--color-border)]/50 p-5 shadow-sm">
        <h2 className="text-sm font-bold text-[var(--color-text-primary)] mb-3 uppercase tracking-wide">Filters</h2>
        {/* Campus is auto-set from your account — shown as info only */}
        <div className="flex items-center gap-2 mb-3 px-1">
          <span className="text-xs text-[var(--color-text-muted)]">Campus:</span>
          <span className="text-xs font-semibold text-[var(--color-text-primary)]">{userCampus}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <GroupedSelect
            value={selectedSY}
            onChange={v => setSelectedSY(v)}
            options={[{ group: 'School Year', items: syOptions }]}
            label="School Year"
          />
          <GroupedSelect
            value={selectedGrade}
            onChange={v => { setSelectedGrade(v); setSelectedSection('') }}
            options={[{ group: 'Grade Level', items: gradeOptions }]}
            label="Grade Level"
            allLabel={sections.length === 0 ? 'No assignments found' : 'Select grade level'}
          />
          <GroupedSelect
            value={selectedSection}
            onChange={setSelectedSection}
            options={[{ group: 'Section', items: sectionOptions }]}
            label="Section"
            allLabel={!selectedGrade ? 'Select grade first' : 'Select section'}
          />
          <GroupedSelect
            value={selectedMonth}
            onChange={setSelectedMonth}
            options={[{ group: 'Month', items: monthOptions }]}
            label="Month (SF2 only)"
          />
        </div>
        <p className="mt-2 text-xs text-[var(--color-text-muted)]">
          <Info className="inline w-3 h-3 mr-1" />
          Month filter applies to SF2 only. All other forms use the full school year.
        </p>
      </div>

      {/* Form cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {FORM_TYPES.map(form => {
          const Icon    = ICON_MAP[form.icon] || FileText
          const colors  = COLOR_MAP[form.color] || COLOR_MAP.blue
          const hasTmpl = hasTemplate(form.templateKey)
          const isExporting = exporting === form.id
          const isPreviewing = previewing === form.id

          return (
            <div key={form.id}
                 className="bg-[var(--color-bg-card)] rounded-2xl border border-[var(--color-border)]/50 shadow-sm overflow-hidden flex flex-col">
              {/* Card header */}
              <div className={`p-4 ${colors.bg}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-xl bg-[color-mix(in_srgb,var(--color-bg-card)_70%,transparent)] ${colors.icon}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[var(--color-text-primary)]">{form.label}</h3>
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5 leading-snug">{form.description}</p>
                    </div>
                  </div>
                </div>
                {/* Template status badge */}
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    hasTmpl
                      ? 'bg-[var(--color-success-light)] text-[var(--color-success-text)]'
                      : 'bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]'
                  }`}>
                    {hasTmpl ? <CheckCircle className="w-3 h-3" /> : <Upload className="w-3 h-3" />}
                    {hasTmpl ? 'Template uploaded' : 'Using auto-format'}
                  </span>
                  {!hasTmpl && (
                    <span className="text-[10px] text-[var(--color-text-muted)]">
                      Upload in Settings → Form Templates
                    </span>
                  )}
                </div>
              </div>

              {/* Preview section */}
              {isPreviewing && (
                <div className="border-t border-[var(--color-border)]">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--color-bg-subtle)]">
                    <span className="text-xs font-semibold text-[var(--color-text-primary)]">
                      Preview · {previewData?.students?.length ?? 0} student{(previewData?.students?.length ?? 0) !== 1 ? 's' : ''}
                    </span>
                    <button
                      onClick={() => { setPreviewing(null); setPreviewData(null) }}
                      className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition"
                    >Close</button>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    <PreviewTable formId={form.id} data={previewData} />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="mt-auto p-3 flex items-center gap-2 border-t border-[var(--color-border)]/50">
                <button
                  onClick={() => buildPreview(form.id)}
                  disabled={isExporting || !canExport}
                  title={!canExport ? 'Select a grade level and section first' : ''}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)] transition disabled:opacity-50"
                >
                  <Eye className="w-3.5 h-3.5" />
                  {isPreviewing ? 'Refresh' : 'Preview'}
                </button>
                <button
                  onClick={() => handleExport(form.id)}
                  disabled={isExporting || !canExport}
                  title={!canExport ? 'Select a grade level and section first' : ''}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-primary text-[var(--color-primary-contrast)] hover:bg-[var(--color-primary-hover)] transition disabled:opacity-50"
                >
                  {isExporting ? (
                    <><Loader className="w-3.5 h-3.5 animate-spin" /> Exporting…</>
                  ) : (
                    <><Download className="w-3.5 h-3.5" /> Export</>
                  )}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Info note */}
      <div className="bg-[var(--color-bg-card)] rounded-2xl border border-[var(--color-border)]/50 p-4 shadow-sm">
        <div className="flex gap-3">
          <Info className="w-4 h-4 text-[var(--color-text-muted)] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs font-semibold text-[var(--color-text-primary)]">How templates work</p>
            <p className="text-xs text-[var(--color-text-muted)]">
              When the Super Admin uploads a template in <strong>Settings → Form Templates</strong>, the system uses
              that exact file format and auto-fills student names, grades, and attendance. If no template is
              uploaded, a clean DepEd-standard workbook is generated automatically.
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              <strong>SF8 note:</strong> Height, weight, and BMI columns are left blank — health measurements must be
              entered manually or collected separately.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}