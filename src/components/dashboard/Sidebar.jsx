import { useState, useEffect, useCallback } from 'react'
import { LayoutDashboard, FileText, Users, DollarSign, Settings, X, GraduationCap } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { mockEnrollments } from '../../data/mockEnrollments'
import { mockPayments } from '../../data/mockPayments'
import { mockStudents } from '../../data/mockStudents'

// ── Helpers ──────────────────────────────────────────────────────
const isBasicGrade   = g => g && (g.includes('Grade') || ['Nursery','Kindergarten','Preparatory'].some(x => g.includes(x)))
const isCollegeGrade = g => g && (g.includes('BS') || g.includes('Year'))

/**
 * Computes per-page badge counts for the logged-in user.
 *
 * PAGE BADGES:
 *   dashboard   → total of all other badges (shows something needs attention)
 *   enrollments →
 *     admin               = pending + payment_received + website submissions
 *     registrar_basic     = payment_received basic ed (ready to approve)
 *     registrar_college   = payment_received college (ready to approve)
 *     accounting          = pending on their campus (awaiting payment recording)
 *   payments →
 *     admin / accounting  = overdue accounts
 *   students →
 *     admin               = students with 'inactive' or 'graduated' status needing review (0 if none)
 *     registrar_basic     = pending enrollment count for their campus basic ed
 *     registrar_college   = pending enrollment count for their campus college
 *   settings → always 0
 */
function computeBadges(user) {
  if (!user) return {}

  const role   = user.role
  const campus = user.campus  // 'all' or specific campus name

  // Filter by campus
  const campusEnr = mockEnrollments.filter(e =>
    campus === 'all' || e.enrollment.campus === campus
  )
  const campusPay = mockPayments.filter(p =>
    campus === 'all' || p.campus === campus
  )
  const campusStu = mockStudents.filter(s =>
    campus === 'all' || s.academic.campus === campus
  )

  // Website bridge submissions — filter by campus (checks multiple possible fields)
  let webPending = 0
  try {
    const subs = JSON.parse(localStorage.getItem('cshc_submissions') || '[]')
    webPending = subs.filter(s => {
      if (s.status !== 'pending') return false
      if (campus === 'all') return true
      // Check all possible campus fields the bridge might use
      const subCampus = s.enrollment?.campus || s.campusName || s.campus || ''
      return subCampus === campus ||
             subCampus.includes(campus) ||
             campus.includes(subCampus)
    }).length
  } catch {}

  let enrBadge = 0
  let payBadge = 0
  let stuBadge = 0

  // ── Admin ──────────────────────────────────────────────────────
  if (role === 'admin') {
    // Enrollments: anything needing action (pending payment + ready to approve + website)
    enrBadge = campusEnr.filter(e =>
      e.status === 'pending' || e.status === 'payment_received'
    ).length + webPending

    // Payments: overdue accounts
    payBadge = campusPay.filter(p => p.status === 'overdue').length

    // Students: none requiring urgent action for admin
    stuBadge = 0
  }

  // ── Basic Ed Registrar ─────────────────────────────────────────
  if (role === 'registrar_basic') {
    // Enrollments: payment_received basic ed = ready for registrar to approve
    enrBadge = campusEnr.filter(e =>
      e.status === 'payment_received' && isBasicGrade(e.enrollment.gradeLevel)
    ).length

    // Students: inactive basic ed students that may need re-enrollment
    stuBadge = campusStu.filter(s =>
      isBasicGrade(s.academic.gradeLevel) && s.status === 'inactive'
    ).length
  }

  // ── College Registrar ──────────────────────────────────────────
  if (role === 'registrar_college') {
    // Enrollments: payment_received college = ready to approve
    enrBadge = campusEnr.filter(e =>
      e.status === 'payment_received' && isCollegeGrade(e.enrollment.gradeLevel)
    ).length

    // Students: inactive college students
    stuBadge = campusStu.filter(s =>
      isCollegeGrade(s.academic.gradeLevel) && s.status === 'inactive'
    ).length
  }

  // ── Accounting ────────────────────────────────────────────────
  if (role === 'accounting') {
    // Enrollments: pending = students who haven't paid yet (needs accounting action)
    enrBadge = campusEnr.filter(e => e.status === 'pending').length + webPending

    // Payments: overdue accounts on campus
    payBadge = campusPay.filter(p => p.status === 'overdue').length
  }

  // ── Principal ────────────────────────────────────────────────
  if (role === 'principal_basic') {
    // Students: inactive students to review
    stuBadge = campusStu.filter(s =>
      isBasicGrade(s.academic.gradeLevel) && s.status === 'inactive'
    ).length
  }

  const dashBadge = enrBadge + payBadge + stuBadge

  return {
    dashboard:   dashBadge,
    enrollments: enrBadge,
    payments:    payBadge,
    students:    stuBadge,
    settings:    0,
  }
}

// ── Badge pill ────────────────────────────────────────────────────
function NavBadge({ count, active }) {
  if (!count || count <= 0) return null
  return (
    <span className={`
      ml-auto min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold
      flex items-center justify-center leading-none flex-shrink-0
      transition-colors
      ${active ? 'bg-white text-primary' : 'bg-red-500 text-white'}
    `}>
      {count > 99 ? '99+' : count}
    </span>
  )
}

// ── Main Sidebar ──────────────────────────────────────────────────
export default function Sidebar({ isOpen, toggleSidebar }) {
  const location = useLocation()
  const { user } = useAuth()
  const [badges, setBadges] = useState({})

  const refreshBadges = useCallback(() => {
    setBadges(computeBadges(user))
  }, [user])

  useEffect(() => {
    refreshBadges()
    // Re-compute when a new enrollment or status update arrives from another tab
    const handleStorage = (e) => {
      if (e.key === 'cshc_submissions' || e.key === 'cshc_new_submission' || e.key === 'cshc_status_update') {
        refreshBadges()
      }
    }
    window.addEventListener('cshc_new_submission', refreshBadges)
    window.addEventListener('storage', handleStorage)
    const t = setInterval(refreshBadges, 10_000)
    return () => {
      window.removeEventListener('cshc_new_submission', refreshBadges)
      window.removeEventListener('storage', handleStorage)
      clearInterval(t)
    }
  }, [refreshBadges])

  // ── Nav items per role ────────────────────────────────────────
  const getNavItems = () => {
    const base = [{
      id: 'dashboard', label: 'Dashboard',
      icon: LayoutDashboard, path: '/dashboard',
      roles: ['admin','registrar_basic','registrar_college','accounting','principal_basic']
    }]

    const roleItems = {
      admin: [
        { id: 'enrollments', label: 'Enrollments', icon: FileText,        path: '/enrollments', roles: ['admin'] },
        { id: 'students',    label: 'Students',    icon: Users,            path: '/students',    roles: ['admin'] },
        { id: 'payments',    label: 'Payments',    icon: DollarSign,       path: '/payments',    roles: ['admin'] },
        { id: 'settings',    label: 'Settings',    icon: Settings,         path: '/settings',    roles: ['admin'] },
      ],
      registrar_basic: [
        { id: 'enrollments', label: 'Basic Ed Enrollments', icon: FileText,      path: '/enrollments', roles: ['registrar_basic'] },
        { id: 'students',    label: 'Basic Ed Students',    icon: GraduationCap, path: '/students',    roles: ['registrar_basic'] },
      ],
      registrar_college: [
        { id: 'enrollments', label: 'College Enrollments', icon: FileText, path: '/enrollments', roles: ['registrar_college'] },
        { id: 'students',    label: 'College Students',    icon: Users,    path: '/students',    roles: ['registrar_college'] },
      ],
      accounting: [
        { id: 'payments',    label: 'Payments',    icon: DollarSign, path: '/payments',    roles: ['accounting'] },
        { id: 'enrollments', label: 'Enrollments', icon: FileText,   path: '/enrollments', roles: ['accounting'] },
      ],
      principal_basic: [
        { id: 'students', label: 'Students', icon: GraduationCap, path: '/students', roles: ['principal_basic'] },
      ],
    }

    const role = user?.role || 'admin'
    return [...base, ...(roleItems[role] || [])].filter(i => i.roles.includes(role))
  }

  const navItems     = getNavItems()
  const isActive     = (path) => location.pathname === path
  const getRoleLabel = () => ({
    admin:             'Admin Portal',
    registrar_basic:   'Basic Ed Registrar',
    registrar_college: 'College Registrar',
    accounting:        'Accounting Portal',
    principal_basic:   'Basic Ed Principal',
  }[user?.role] || 'Portal')

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={toggleSidebar} />
      )}

      <aside className={`
        fixed lg:relative top-0 left-0 h-full bg-white dark:bg-gray-800
        transition-transform duration-300 ease-in-out z-50
        w-64 border-r border-gray-200 dark:border-gray-700 flex flex-col
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>

        {/* Logo + role */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/20 flex-shrink-0 bg-white">
              <img src="/cshclogo.png" alt="CSHC Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h2 className="font-bold text-primary dark:text-white text-sm">CSHC</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">{getRoleLabel()}</p>
            </div>
          </div>
          <button
            onClick={toggleSidebar}
            className="lg:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active     = isActive(item.path)
            const badgeCount = badges[item.id] || 0
            return (
              <Link
                key={item.id}
                to={item.path}
                onClick={() => window.innerWidth < 1024 && toggleSidebar()}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-lg
                  transition-colors duration-200
                  ${active
                    ? 'bg-primary text-white'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }
                `}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium flex-1">{item.label}</span>
                <NavBadge count={badgeCount} active={active} />
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">© 2026 CSHC</p>
        </div>
      </aside>
    </>
  )
}