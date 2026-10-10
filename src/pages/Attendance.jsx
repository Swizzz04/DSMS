/**
 * Attendance.jsx — ALMIRENE DX
 *
 * Daily attendance tracking for Basic Ed and College.
 *
 * Teacher workflow:
 *   1. Select subject/section → select    
 *   2. Mark each student: Present / Absent / Late / Excused
 *   3. Save → records stored → engine computes rates → alerts fire
 *
 * Views:
 *   - Daily Entry  : mark today's (or any date's) attendance
 *   - Summary      : per-student attendance rates, at-risk flags
 *   - SF2 Report   : DepEd School Form 2 format (Basic Ed)
 *
 * Location: src/pages/Attendance.jsx
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Calendar, Users, Check, X, Clock, AlertCircle,
  ArrowLeft, Save, ChevronLeft, ChevronRight,
  BarChart2, FileText, CheckCircle, Info,
} from 'lucide-react'
import { useAuth }      from '../context/AuthContext'
import { useAppConfig } from '../context/AppConfigContext'
import { PageSkeleton, useToast, ToastContainer } from '../components/UIComponents'
import GroupedSelect from '../components/GroupedSelect'
import DatePicker   from '../components/DatePicker'
import {
  getAttendance, getAttendanceByDate, saveBulkAttendance,
  isAttendanceRecorded, getRecordedDates, getTodayString,
} from '../utils/attendanceBridge'
import {
  computeSectionSummary, generateSF2,
  getStatusStyle, DEFAULT_ATTENDANCE_CONFIG,
} from '../engines/attendanceEngine'

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

// School name is white-label content (almirene_website_content), never hardcoded.
function getSchoolName() {
  try { return JSON.parse(localStorage.getItem('almirene_website_content') || '{}').schoolName || '' }
  catch { return '' }
}

function fmtDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-PH', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  })
}

function fmtShort(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-PH', {
    month: 'short', day: 'numeric'
  })
}

const STATUS_OPTIONS = [
  { id: 'present', label: 'Present', short: 'P', color: 'green' },
  { id: 'absent',  label: 'Absent',  short: 'A', color: 'red'   },
  { id: 'late',    label: 'Late',    short: 'L', color: 'amber' },
  { id: 'excused', label: 'Excused', short: 'E', color: 'blue'  },
]

const BTN_CLASS = {
  present: 'border-[var(--color-success-border)] text-[var(--color-success-text)] bg-[var(--color-success-light)]',
  absent:  'border-[var(--color-error-border)] text-[var(--color-error-text)] bg-[var(--color-error-light)]',
  late:    'border-[var(--color-warning-border)] text-[var(--color-warning-text)] bg-[var(--color-warning-light)]',
  excused: 'border-[var(--color-info-border)] text-[var(--color-info-text)] bg-[var(--color-info-light)]',
}

const BTN_ACTIVE = {
  present: 'bg-[var(--color-success)] border-[var(--color-success)] text-[var(--color-text-inverse)]',
  absent:  'bg-[var(--color-error)] border-[var(--color-error)] text-[var(--color-text-inverse)]',
  late:    'bg-[var(--color-warning)] border-[var(--color-warning)] text-[var(--color-text-inverse)]',
  excused: 'bg-[var(--color-info)] border-[var(--color-info)] text-[var(--color-text-inverse)]',
}

// Summary-table count columns (label + colour per status), used on phone and desktop.
const COUNT_COLS = [
  { key: 'present', label: 'Present', cls: 'text-[var(--color-success-text)]' },
  { key: 'absent',  label: 'Absent',  cls: 'text-[var(--color-error-text)]'   },
  { key: 'late',    label: 'Late',    cls: 'text-[var(--color-warning-text)]' },
  { key: 'excused', label: 'Excused', cls: 'text-[var(--color-info-text)]'    },
]

// ─────────────────────────────────────────────────────────────────────────────
// SF2 REPORT VIEW
// ─────────────────────────────────────────────────────────────────────────────

function SF2Report({ subject, campusKey, schoolYear, user }) {
  const [month, setMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  const allRecords = getAttendance({
    campusKey, schoolYear,
    sectionId:  subject.sectionId,
    subjectId:  subject.department === 'college' ? subject.subjectId : undefined,
  })

  const sf2 = generateSF2(allRecords, month, {
    schoolName:  getSchoolName(),
    teacherName: user?.name ?? '',
    gradeLevel:  subject.gradeLevel,
    section:     subject.section,
    subject:     subject.subjectName,
  })

  const changeMonth = (delta) => {
    const [yr, mo] = month.split('-').map(Number)
    const d = new Date(yr, mo - 1 + delta)
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const monthLabel = new Date(month + '-15').toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-4">
      {/* Month navigation */}
      <div className="flex items-center gap-3">
        <button onClick={() => changeMonth(-1)} className="p-2 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-bg-subtle)] transition">
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-semibold text-[var(--color-text-primary)] min-w-32 text-center">{monthLabel}</span>
        <button onClick={() => changeMonth(1)} className="p-2 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-bg-subtle)] transition">
          <ChevronRight size={16} />
        </button>
        <span className="text-xs text-[var(--color-text-muted)] ml-auto">{sf2.totalDaysOfClass} school days</span>
      </div>

      {sf2.students.length === 0 ? (
        <div className="card p-8 text-center">
          <Calendar size={36} className="mx-auto mb-2 text-[var(--color-text-muted)] opacity-40" />
          <p className="text-sm text-[var(--color-text-muted)]">No attendance records for {monthLabel}.</p>
        </div>
      ) : (
        <div className="min-w-0 card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="text-xs w-full" style={{ minWidth: `${300 + sf2.schoolDays.length * 32}px` }}>
              <thead>
                <tr className="bg-[var(--color-bg-subtle)]">
                  <th className="px-3 py-2 text-left font-semibold border-b border-[var(--color-border)] sticky left-0 bg-[var(--color-bg-subtle)] z-10" style={{ minWidth: 180 }}>
                    Learner's Name
                  </th>
                  {sf2.schoolDays.map(d => (
                    <th key={d} className="px-1 py-2 text-center font-medium border-b border-[var(--color-border)] text-[var(--color-text-muted)]" style={{ minWidth: 28 }}>
                      {new Date(d + 'T12:00:00').getDate()}
                    </th>
                  ))}
                  <th className="px-2 py-2 text-center font-semibold border-b border-l border-[var(--color-border)] text-[var(--color-success-text)]">P</th>
                  <th className="px-2 py-2 text-center font-semibold border-b border-[var(--color-border)] text-[var(--color-error-text)]">A</th>
                  <th className="px-2 py-2 text-center font-semibold border-b border-[var(--color-border)] text-[var(--color-warning-text)]">L</th>
                  <th className="px-2 py-2 text-center font-semibold border-b border-[var(--color-border)]">Days</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {sf2.students.map((stu, i) => (
                  <tr key={stu.studentId} className="hover:bg-[color-mix(in_srgb,var(--color-bg-subtle)_30%,transparent)] transition">
                    <td className="px-3 py-1.5 font-medium text-[var(--color-text-primary)] sticky left-0 bg-[var(--color-bg-card)] z-10">
                      {i + 1}. {stu.studentName}
                    </td>
                    {stu.dayStatuses.map((st, di) => {
                      const style = getStatusStyle(st)
                      return (
                        <td key={di} className="px-0.5 py-1 text-center">
                          {st && (
                            <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-[9px] font-bold ${style.bg} ${style.text}`}>
                              {style.label}
                            </span>
                          )}
                        </td>
                      )
                    })}
                    <td className="px-2 py-1.5 text-center font-semibold text-[var(--color-success-text)] border-l border-[var(--color-border)]">{stu.totals.present}</td>
                    <td className="px-2 py-1.5 text-center font-semibold text-[var(--color-error-text)]">{stu.totals.absent}</td>
                    <td className="px-2 py-1.5 text-center font-semibold text-[var(--color-warning-text)]">{stu.totals.late}</td>
                    <td className="px-2 py-1.5 text-center text-[var(--color-text-muted)]">{stu.totals.daysOfClass}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY VIEW
// ─────────────────────────────────────────────────────────────────────────────

function SummaryView({ subject, campusKey, schoolYear, attendanceConfig }) {
  const allRecords = getAttendance({
    campusKey, schoolYear,
    sectionId: subject.sectionId,
    subjectId: subject.department === 'college' ? subject.subjectId : undefined,
  })

  const cfg      = { ...DEFAULT_ATTENDANCE_CONFIG, ...attendanceConfig }
  const summary  = computeSectionSummary(allRecords, cfg)
  const atRisk   = summary.filter(s => s.stats.isAtRisk)
  const recorded = getRecordedDates(
    subject.sectionId, schoolYear,
    subject.department === 'college' ? subject.subjectId : null
  )

  if (summary.length === 0) {
    return (
      <div className="card p-10 text-center">
        <BarChart2 size={36} className="mx-auto mb-2 text-[var(--color-text-muted)] opacity-40" />
        <p className="text-sm text-[var(--color-text-muted)]">No attendance data recorded yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Days',    value: recorded.length,         color: 'text-[var(--color-text-primary)]' },
          { label: 'Students',      value: summary.length,          color: 'text-[var(--color-text-primary)]' },
          { label: 'At Risk',       value: atRisk.length,           color: atRisk.length > 0 ? 'text-[var(--color-error-text)]' : 'text-[var(--color-success-text)]' },
          { label: 'Min Required',  value: `${cfg.minAttendancePercent}%`, color: 'text-[var(--color-text-muted)]' },
        ].map(stat => (
          <div key={stat.label} className="card p-3 text-center">
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* At-risk banner */}
      {atRisk.length > 0 && (
        <div className="flex items-start gap-2 p-3 bg-[var(--color-error-light)] border border-[var(--color-error-border)] rounded-xl text-xs text-[var(--color-error-text)]">
          <AlertCircle size={13} className="shrink-0 mt-0.5" />
          <span>
            <strong>{atRisk.length} student{atRisk.length !== 1 ? 's' : ''}</strong> below {cfg.minAttendancePercent}% attendance:&nbsp;
            {atRisk.slice(0, 3).map(s => s.studentName.split(',')[0]).join(', ')}
            {atRisk.length > 3 && ` +${atRisk.length - 3} more`}
          </span>
        </div>
      )}

      {/* Student summary table */}
      <div className="card overflow-hidden">
        <div className="hidden sm:grid grid-cols-[1fr_80px_80px_80px_80px_100px_100px] gap-2 px-4 py-2.5 border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)] text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
          <span>Student</span>
          <span className="text-center text-[var(--color-success-text)]">Present</span>
          <span className="text-center text-[var(--color-error-text)]">Absent</span>
          <span className="text-center text-[var(--color-warning-text)]">Late</span>
          <span className="text-center text-[var(--color-info-text)]">Excused</span>
          <span className="text-center">Attendance %</span>
          <span className="text-center">Status</span>
        </div>
        <div className="divide-y divide-[var(--color-border)]">
          {summary.map(({ studentId, studentName, stats }) => (
            <div key={studentId} className="grid grid-cols-1 sm:grid-cols-[1fr_80px_80px_80px_80px_100px_100px] gap-2 px-4 py-3 items-center hover:bg-[color-mix(in_srgb,var(--color-bg-subtle)_40%,transparent)] transition">
              <p className="text-sm font-medium text-[var(--color-text-primary)]">{studentName}</p>
              <div className="grid grid-cols-4 gap-2 sm:contents">
                {COUNT_COLS.map(c => (
                  <div key={c.key} className="text-center">
                    <p className={`text-sm font-semibold ${c.cls}`}>{stats[c.key]}</p>
                    <p className="sm:hidden text-[10px] text-[var(--color-text-muted)]">{c.label}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="w-full max-w-20 h-1.5 bg-[var(--color-bg-subtle)] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${stats.isAtRisk ? 'bg-[var(--color-error)]' : 'bg-[var(--color-success)]'}`}
                    style={{ width: `${Math.min(stats.attendancePercent, 100)}%` }}
                  />
                </div>
                <span className={`text-xs font-bold ${stats.isAtRisk ? 'text-[var(--color-error-text)]' : 'text-[var(--color-success-text)]'}`}>
                  {stats.attendancePercent.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-center">
                {stats.isAtRisk ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--color-error-light)] text-[var(--color-error-text)]">
                    At Risk
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--color-success-light)] text-[var(--color-success-text)]">
                    Good
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DAILY ENTRY VIEW
// ─────────────────────────────────────────────────────────────────────────────

function DailyEntry({ subject, campusKey, schoolYear, user, students, onSaved }) {
  const todayStr  = getTodayString()
  const [date,    setDate]    = useState(todayStr)
  const [rows,    setRows]    = useState([])
  const [saving,  setSaving]  = useState(false)
  const [already, setAlready] = useState(false)
  const { toasts, addToast, removeToast } = useToast()

  const isCollege = subject.department === 'college'

  const loadForDate = useCallback((d) => {
    const existing = getAttendanceByDate(
      subject.sectionId, d,
      isCollege ? subject.subjectId : null
    )
    const existMap = Object.fromEntries(existing.map(r => [r.studentId, r]))

    setAlready(existing.length > 0)
    setRows(students.map(stu => ({
      studentId:   stu.id,
      studentName: stu.name,
      status:      existMap[stu.id]?.status ?? 'present',
      remarks:     existMap[stu.id]?.remarks ?? '',
    })))
  }, [subject.sectionId, subject.subjectId, isCollege, students])

  useEffect(() => { loadForDate(date) }, [date, loadForDate])

  const setStatus = (idx, status) => {
    setRows(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], status }
      return next
    })
  }

  const markAll = (status) => {
    setRows(prev => prev.map(r => ({ ...r, status })))
  }

  const handleSave = () => {
    setSaving(true)
    const records = rows.map(r => ({
      studentId:   r.studentId,
      studentName: r.studentName,
      campusKey,
      schoolYear,
      department:  subject.department,
      subjectId:   isCollege ? subject.subjectId : null,
      subjectName: isCollege ? subject.subjectName : null,
      sectionId:   subject.sectionId,
      teacherId:   user?.id,
      date,
      status:      r.status,
      remarks:     r.remarks ?? '',
      recordedBy:  user?.name ?? '',
    }))
    saveBulkAttendance(records)
    setSaving(false)
    setAlready(true)
    addToast(`Attendance saved for ${fmtShort(date)}.`, 'success')
    onSaved?.()
  }

  const presentCount = rows.filter(r => r.status === 'present').length
  const absentCount  = rows.filter(r => r.status === 'absent').length

  return (
    <div className="space-y-4">
      {/* Date picker */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <DatePicker
            value={date}
            onChange={setDate}
            label="Date"
          />
        </div>
        {already && (
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--color-warning-light)] border border-[var(--color-warning-border)] text-xs text-[var(--color-warning-text)] self-end">
            <Info size={12} /> Attendance already recorded. You can update it.
          </div>
        )}
        <div className="sm:ml-auto flex gap-2 self-end">
          <button onClick={() => markAll('present')}
            className="px-3 py-1.5 text-xs rounded-lg border border-[var(--color-success-border)] text-[var(--color-success-text)] hover:bg-[var(--color-success-light)] transition font-medium">
            All Present
          </button>
          <button onClick={() => markAll('absent')}
            className="px-3 py-1.5 text-xs rounded-lg border border-[var(--color-error-border)] text-[var(--color-error-text)] hover:bg-[var(--color-error-light)] transition font-medium">
            All Absent
          </button>
        </div>
      </div>

      {/* Stats chips */}
      <div className="flex gap-2 flex-wrap">
        {[
          { label: `${presentCount} Present`,  color: 'bg-[var(--color-success-light)] text-[var(--color-success-text)]' },
          { label: `${absentCount} Absent`,    color: 'bg-[var(--color-error-light)] text-[var(--color-error-text)]' },
          { label: `${rows.length} Students`,  color: 'bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]' },
        ].map(c => (
          <span key={c.label} className={`px-3 py-1 rounded-full text-xs font-medium ${c.color}`}>
            {c.label}
          </span>
        ))}
      </div>

      {/* Attendance grid */}
      {rows.length === 0 ? (
        <div className="card p-8 text-center">
          <Users size={32} className="mx-auto mb-2 text-[var(--color-text-muted)] opacity-40" />
          <p className="text-sm text-[var(--color-text-muted)]">No students found for this section.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="divide-y divide-[var(--color-border)]">
            {rows.map((row, idx) => (
              <div key={row.studentId} className="flex items-center gap-3 px-4 py-3 hover:bg-[color-mix(in_srgb,var(--color-bg-subtle)_30%,transparent)] transition">
                <span className="text-xs text-[var(--color-text-muted)] w-5 text-right shrink-0">{idx + 1}</span>
                <p className="text-sm font-medium text-[var(--color-text-primary)] flex-1 min-w-0 truncate">{row.studentName}</p>
                <div className="flex gap-1 shrink-0">
                  {STATUS_OPTIONS.map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setStatus(idx, opt.id)}
                      title={opt.label}
                      className={`w-9 h-9 rounded-lg border text-xs font-bold transition-colors
                        ${row.status === opt.id ? BTN_ACTIVE[opt.id] : BTN_CLASS[opt.id]}`}
                    >
                      {opt.short}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Save bar */}
      {rows.length > 0 && (
        <div className="flex items-center justify-between card p-4">
          <p className="text-xs text-[var(--color-text-muted)]">
            {fmtDate(date)}
          </p>
          <button onClick={handleSave} disabled={saving}
            className="btn btn-primary gap-1.5 text-sm disabled:opacity-50">
            <Save size={14} />
            {already ? 'Update Attendance' : 'Save Attendance'}
          </button>
        </div>
      )}

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function Attendance() {
  const { user }       = useAuth()
  const { currentSchoolYear, activeCampuses } = useAppConfig()

  // currentSchoolYear is already the year string ('2026-2027'); the old `.year` read was
  // always undefined, so the page silently fell back to a hardcoded '2025-2026'.
  const schoolYear = currentSchoolYear

  // The teacher's own campus: prefer the stored key, else resolve it from the campus name.
  const campusKey  = user?.campusKey
    || activeCampuses?.find(c => c.name === user?.campus)?.key
    || ''
  const campusName = activeCampuses?.find(c => c.key === campusKey)?.name || ''

  const [loading,         setLoading]         = useState(true)
  const [selectedSubject, setSelectedSubject] = useState(null)
  const [activeTab,       setActiveTab]       = useState('entry')
  const [refreshKey,      setRefreshKey]      = useState(0)
  const { toasts, removeToast }               = useToast()

  useEffect(() => { const t = setTimeout(() => setLoading(false), 150); return () => clearTimeout(t) }, [])

  // Load teacher's subject loads (same pattern as Eclassrecord)
  const subjectLoads = (() => {
    try {
      const raw      = localStorage.getItem('almirene_subject_loads')
      if (!raw) return []
      const all      = JSON.parse(raw)
      const campData = all[campusKey]
      if (!campData) return []
      const syData   = campData[schoolYear]
      if (!syData) return []

      const loads = []

      // Basic Ed loads
      ;(syData.basicEdLoads || []).forEach(load => {
        if (load.teacherId !== user?.id && load.teacherName !== user?.name) return
        const sections = syData.basicEdSections?.[load.gradeLevel] || []
        sections.forEach(sec => {
          loads.push({
            subjectId:   `${load.gradeLevel}_${load.subject}`,
            subjectName: load.subject,
            gradeLevel:  load.gradeLevel,
            section:     sec.displayName || sec.defaultName,
            sectionId:   sec.id,
            department:  'basicEd',
          })
        })
      })

      // College loads
      ;(syData.collegeLoads || []).forEach(load => {
        if (load.teacherId !== user?.id && load.teacherName !== user?.name) return
        loads.push({
          subjectId:   `${load.program}_${load.yearLevel}_${load.subject}`,
          subjectName: load.subject,
          gradeLevel:  `${load.program} - ${load.yearLevel}`,
          section:     load.sectionName || load.sectionId,
          sectionId:   load.sectionId,
          department:  'college',
        })
      })

      // Deduplicate by sectionId+subjectId
      const seen = new Set()
      return loads.filter(l => {
        const key = `${l.sectionId}_${l.subjectId}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
    } catch { return [] }
  })()

  // Approved students for the selected subject's grade level / program, on this campus.
  // Memoised: DailyEntry reloads its rows whenever this array changes identity, which
  // would wipe a teacher's unsaved marks on any parent re-render.
  const students = useMemo(() => {
    if (!selectedSubject || !campusName) return []
    try {
      const subs = JSON.parse(localStorage.getItem('almirene_submissions') || '[]')
      return subs
        .filter(s =>
          s.status === 'approved' &&
          (s.enrollment?.campus || '') === campusName &&
          s.enrollment?.gradeLevel === selectedSubject.gradeLevel
        )
        .map(s => ({
          id:   s.id,
          name: `${s.student?.lastName || ''}, ${s.student?.firstName || ''}`.trim(),
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
    } catch { return [] }
  }, [selectedSubject, campusName])

  // Group loads by section for the subject list
  const grouped = {}
  subjectLoads.forEach(sl => {
    const key = sl.sectionId || sl.section
    if (!grouped[key]) grouped[key] = { section: sl.section, gradeLevel: sl.gradeLevel, subjects: [] }
    grouped[key].subjects.push(sl)
  })
  const sections = Object.values(grouped)

  if (loading) return <PageSkeleton />

  // ── Subject selected: show tabs ──
  if (selectedSubject) {
    const tabs = [
      { id: 'entry',   label: 'Daily Entry',   icon: Calendar },
      { id: 'summary', label: 'Summary',        icon: BarChart2 },
      ...(selectedSubject.department === 'basicEd'
        ? [{ id: 'sf2', label: 'SF2 Report', icon: FileText }]
        : []),
    ]

    return (
      <div className="page-enter space-y-5">
        {/* Back + title */}
        <div className="flex items-start gap-3">
          <button onClick={() => setSelectedSubject(null)}
            className="mt-1 p-2 rounded-lg hover:bg-[var(--color-bg-subtle)] transition text-[var(--color-text-muted)]">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-[var(--color-text-primary)]">
              {selectedSubject.subjectName}
            </h1>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              {selectedSubject.section} · {selectedSubject.gradeLevel} · {schoolYear}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-[var(--color-bg-subtle)] rounded-xl w-fit">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                ${activeTab === tab.id
                  ? 'bg-[var(--color-bg-card)] text-[var(--color-text-primary)] shadow-sm'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'}`}>
              <tab.icon size={14} />{tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'entry' && (
          <DailyEntry
            key={refreshKey}
            subject={selectedSubject}
            campusKey={campusKey}
            schoolYear={schoolYear}
            user={user}
            students={students}
            onSaved={() => setRefreshKey(k => k + 1)}
          />
        )}

        {activeTab === 'summary' && (
          <SummaryView
            subject={selectedSubject}
            campusKey={campusKey}
            schoolYear={schoolYear}
            attendanceConfig={{}}
          />
        )}

        {activeTab === 'sf2' && selectedSubject.department === 'basicEd' && (
          <SF2Report
            subject={selectedSubject}
            campusKey={campusKey}
            schoolYear={schoolYear}
            user={user}
          />
        )}

        <ToastContainer toasts={toasts} removeToast={removeToast} />
      </div>
    )
  }

  // ── Subject list ──
  return (
    <div className="page-enter space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)]">Attendance</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
          {schoolYear} · Select a subject to record attendance
        </p>
      </div>

      {sections.length === 0 ? (
        <div className="card p-10 text-center">
          <Calendar size={40} className="mx-auto mb-3 text-[var(--color-text-muted)] opacity-40" />
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">No subjects assigned</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">Contact your principal or program head to assign subjects.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sections.map(sec => (
            <div key={sec.section} className="card overflow-hidden">
              <div className="p-4 border-b border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-bg-subtle)_50%,transparent)]">
                <div className="flex items-center gap-2">
                  <Users size={14} className="text-[var(--color-primary-readable)]" />
                  <h3 className="text-sm font-bold text-[var(--color-text-primary)]">{sec.section}</h3>
                  <span className="text-xs text-[var(--color-text-muted)]">· {sec.gradeLevel}</span>
                </div>
              </div>
              <div className="divide-y divide-[var(--color-border)]">
                {sec.subjects.map((subj, idx) => {
                  const recorded = getRecordedDates(
                    subj.sectionId, schoolYear,
                    subj.department === 'college' ? subj.subjectId : null
                  )
                  const todayDone = isAttendanceRecorded(
                    subj.sectionId, getTodayString(),
                    subj.department === 'college' ? subj.subjectId : null
                  )

                  return (
                    <button key={idx} onClick={() => { setSelectedSubject(subj); setActiveTab('entry') }}
                      className="w-full flex items-center justify-between p-4 hover:bg-[color-mix(in_srgb,var(--color-bg-subtle)_50%,transparent)] transition text-left">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${subj.department === 'college' ? 'bg-[var(--color-cat-indigo-bg)]' : 'bg-primary/10'}`}>
                          <Calendar className={`w-4 h-4 ${subj.department === 'college' ? 'text-[var(--color-cat-indigo-text)]' : 'text-[var(--color-primary-readable)]'}`} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[var(--color-text-primary)]">{subj.subjectName}</p>
                          <p className="text-xs text-[var(--color-text-muted)]">
                            {recorded.length} day{recorded.length !== 1 ? 's' : ''} recorded
                            {todayDone && <span className="ml-2 text-[var(--color-success-text)]">· Today ✓</span>}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!todayDone && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--color-warning-light)] text-[var(--color-warning-text)]">
                            Not Taken
                          </span>
                        )}
                        {todayDone && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--color-success-light)] text-[var(--color-success-text)]">
                            Done Today
                          </span>
                        )}
                        <ChevronRight size={14} className="text-[var(--color-text-muted)]" />
                      </div>
                    </button>
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