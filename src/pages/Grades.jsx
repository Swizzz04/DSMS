/**
 * Grades.jsx
 * ─────────────────────────────────────────────────────────────────
 * Grade Submission page — teachers enter scores, system computes grades.
 *
 * Teacher flow:
 *   1. See list of assigned subjects (from Subject Load)
 *   2. Select a subject → see students in that section
 *   3. Enter WW/PT/QA scores per student
 *   4. System auto-computes: percentage → weighted → initial → transmuted
 *   5. Submit grades for approval
 *
 * Principal/Registrar flow:
 *   1. See submitted grades by section
 *   2. Review and approve
 * ─────────────────────────────────────────────────────────────────
 */

import { useState, useEffect } from 'react'
import {
  ClipboardList, BookOpen, Users, ChevronRight,
  CheckCircle, Clock, AlertCircle, FileText
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useAppConfig } from '../context/AppConfigContext'
import { CampusBanner } from '../components/SchoolComponents'
import { PageSkeleton, useToast, ToastContainer } from '../components/UIComponents'
import { SUBJECT_AREAS, GRADING_PERIODS, getAllGrades } from '../utils/gradingEngine'

export default function Grades() {
  const { user } = useAuth()
  const { config } = useAppConfig()
  const [loading, setLoading] = useState(true)
  const { toasts, addToast, removeToast } = useToast()

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 150)
    return () => clearTimeout(t)
  }, [])

  if (loading) return <PageSkeleton />

  const isTeacher = user?.role === 'teacher'
  const campusKey = user?.campusKey || ''

  // Get teacher's assigned subjects from Subject Load
  const subjectLoads = (() => {
    try {
      const all = JSON.parse(localStorage.getItem('cshc_subject_loads') || '[]')
      if (isTeacher) {
        return all.filter(sl => sl.teacherId === user.id || sl.teacherName === user.name)
      }
      // Principal/registrar sees all for their campus
      return all.filter(sl => sl.campusKey === campusKey || !campusKey)
    } catch { return [] }
  })()

  // Get existing grades
  const myGrades = getAllGrades({ teacherId: isTeacher ? user.id : undefined, campusKey })

  // Group subject loads by section
  const grouped = {}
  subjectLoads.forEach(sl => {
    const key = `${sl.sectionId || sl.section}`
    if (!grouped[key]) {
      grouped[key] = { section: sl.section || sl.sectionName || key, subjects: [], campusKey: sl.campusKey }
    }
    // Count grades for this subject
    const gradeCount = myGrades.filter(g => g.subjectId === sl.subjectId && g.sectionId === (sl.sectionId || sl.section)).length
    grouped[key].subjects.push({ ...sl, gradeCount })
  })

  const sections = Object.values(grouped)

  return (
    <div className="page-enter space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)]">
            {isTeacher ? 'Grade Submission' : 'Grade Management'}
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {isTeacher
              ? `${user.campus} · Enter and submit student grades`
              : 'Review and approve submitted grades'
            }
          </p>
        </div>
      </div>

      <CampusBanner user={user} />

      {/* Teacher view — assigned subjects */}
      {sections.length === 0 ? (
        <div className="card p-8 text-center">
          <ClipboardList className="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-3" />
          <h3 className="text-sm font-bold text-[var(--color-text-primary)] mb-1">No Subjects Assigned</h3>
          <p className="text-xs text-[var(--color-text-muted)]">
            {isTeacher
              ? 'You don\'t have any subjects assigned yet. Contact your Principal or Program Head.'
              : 'No subject loads found for this campus.'
            }
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sections.map(sec => (
            <div key={sec.section} className="card overflow-hidden">
              <div className="p-4 border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)]/50">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-bold text-[var(--color-text-primary)]">{sec.section}</h3>
                  <span className="text-xs text-[var(--color-text-muted)]">· {sec.subjects.length} subject{sec.subjects.length !== 1 ? 's' : ''}</span>
                </div>
              </div>
              <div className="divide-y divide-[var(--color-border)]">
                {sec.subjects.map((subj, idx) => (
                  <button
                    key={idx}
                    onClick={() => addToast('Grade entry UI coming in next session!', 'info')}
                    className="w-full flex items-center justify-between p-4 hover:bg-[var(--color-bg-subtle)]/50 transition text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center">
                        <BookOpen className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[var(--color-text-primary)]">{subj.subjectName || subj.subject}</p>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {subj.gradeCount > 0
                            ? `${subj.gradeCount} grade${subj.gradeCount !== 1 ? 's' : ''} entered`
                            : 'No grades entered yet'
                          }
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {subj.gradeCount > 0 ? (
                        <span className="px-2 py-0.5 text-[9px] font-semibold rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">In Progress</span>
                      ) : (
                        <span className="px-2 py-0.5 text-[9px] font-semibold rounded-full bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]">Not Started</span>
                      )}
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