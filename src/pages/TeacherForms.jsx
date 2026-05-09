/**
 * TeacherForms.jsx
 * ─────────────────────────────────────────────────────────────────
 * Teacher Forms page — attendance sheets, report cards, and other
 * forms teachers need to fill out and submit.
 *
 * Forms will be added based on reference files from the school.
 * ─────────────────────────────────────────────────────────────────
 */

import { useState, useEffect } from 'react'
import {
  FolderOpen, ClipboardList, Users, Calendar,
  FileText, CheckSquare, ChevronRight
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {} from '../components/SchoolComponents'
import { PageSkeleton, useToast, ToastContainer } from '../components/UIComponents'

export default function TeacherForms() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const { toasts, addToast, removeToast } = useToast()

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 150)
    return () => clearTimeout(t)
  }, [])

  if (loading) return <PageSkeleton />

  // Available form types — will be expanded when reference files are uploaded
  const forms = [
    {
      id: 'attendance',
      title: 'Daily Attendance',
      description: 'Record student attendance for your assigned sections',
      icon: CheckSquare,
      color: 'bg-emerald-500/10 text-emerald-600',
      status: 'coming_soon'
    },
    {
      id: 'sf2',
      title: 'School Form 2 (SF2)',
      description: 'Daily attendance report per month — DepEd standard form',
      icon: Calendar,
      color: 'bg-blue-500/10 text-blue-600',
      status: 'coming_soon'
    },
    {
      id: 'sf5',
      title: 'School Form 5 (SF5)',
      description: 'Report on promotion and level of proficiency',
      icon: ClipboardList,
      color: 'bg-purple-500/10 text-purple-600',
      status: 'coming_soon'
    },
    {
      id: 'sf9',
      title: 'School Form 9 (SF9)',
      description: 'Learner progress report card',
      icon: FileText,
      color: 'bg-amber-500/10 text-amber-600',
      status: 'coming_soon'
    },
    {
      id: 'sf10',
      title: 'School Form 10 (SF10)',
      description: "Learner's permanent academic record",
      icon: FolderOpen,
      color: 'bg-red-500/10 text-red-600',
      status: 'coming_soon'
    },
  ]

  return (
    <div className="page-enter space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--color-text-primary)]">Teacher Forms</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          {user?.campus} · Attendance, reports, and other required forms
        </p>
      </div>


      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {forms.map(form => {
          const Icon = form.icon
          return (
            <button
              key={form.id}
              onClick={() => addToast(`${form.title} will be available soon!`, 'info')}
              className="card p-4 text-left hover:shadow-md transition group"
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${form.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-bold text-[var(--color-text-primary)]">{form.title}</h3>
                    <span className="px-1.5 py-0.5 text-[8px] font-semibold rounded-full bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)] uppercase tracking-wider">Soon</span>
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{form.description}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)] group-hover:text-primary transition flex-shrink-0 mt-1" />
              </div>
            </button>
          )
        })}
      </div>

      <div className="card p-5">
        <div className="flex items-center gap-2 mb-2">
          <FolderOpen className="w-4 h-4 text-[var(--color-text-muted)]" />
          <h3 className="text-sm font-bold text-[var(--color-text-primary)]">About Teacher Forms</h3>
        </div>
        <div className="space-y-2 text-xs text-[var(--color-text-secondary)]">
          <p>This section will contain all the forms required by teachers. Forms are based on DepEd standard school forms and school-specific requirements.</p>
          <p>When complete, you'll be able to fill out attendance, generate report cards, and submit required forms digitally — no more paper forms.</p>
        </div>
      </div>

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  )
}