import { useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Clock, AlertCircle, CheckCircle, DollarSign, X } from 'lucide-react'
import { mockEnrollments } from '../../data/mockEnrollments'
import { mockPayments } from '../../data/mockPayments'
import { useAuth } from '../../context/AuthContext'

// Generate notifications from real mock data
function generateNotifications(user) {
  const notifications = []

  // Pending enrollments → relevant for admin, registrar_basic, registrar_college
  if (user?.role !== 'accounting') {
    mockEnrollments.forEach(e => {
      if (e.status === 'pending') {
        const isBasicGrade = e.enrollment.gradeLevel.includes('Grade')
        const isCollegeGrade = e.enrollment.gradeLevel.includes('BS') || e.enrollment.gradeLevel.includes('Year')

        const visible =
          user?.role === 'admin' ||
          (user?.role === 'registrar_basic' && isBasicGrade) ||
          (user?.role === 'registrar_college' && isCollegeGrade)

        if (visible) {
          notifications.push({
            id: `enroll-${e.id}`,
            type: 'pending',
            icon: 'clock',
            title: 'Pending Enrollment',
            message: `${e.student.firstName} ${e.student.lastName} — ${e.enrollment.gradeLevel}`,
            sub: `${e.enrollment.campus} • ${e.referenceNumber}`,
            time: e.submittedDate,
            link: '/enrollments',
            read: false,
          })
        }
      }
    })
  }

  // Overdue payments → relevant for admin and accounting
  if (user?.role === 'admin' || user?.role === 'accounting') {
    mockPayments.forEach(p => {
      if (p.status === 'overdue') {
        notifications.push({
          id: `payment-overdue-${p.id}`,
          type: 'overdue',
          icon: 'alert',
          title: 'Overdue Payment',
          message: `${p.studentName} — ₱${p.balance.toLocaleString()} balance`,
          sub: `${p.campus} • Due ${new Date(p.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
          time: p.dueDate,
          link: '/payments',
          read: false,
        })
      }
    })

    // Partial payments with upcoming due dates
    mockPayments.forEach(p => {
      if (p.status === 'partial') {
        const dueDate = new Date(p.dueDate)
        const now = new Date()
        const daysUntilDue = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24))
        if (daysUntilDue <= 30 && daysUntilDue > 0) {
          notifications.push({
            id: `payment-partial-${p.id}`,
            type: 'partial',
            icon: 'dollar',
            title: 'Partial Payment',
            message: `${p.studentName} — ₱${p.balance.toLocaleString()} remaining`,
            sub: `Due in ${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''} • ${p.campus}`,
            time: p.lastPaymentDate,
            link: '/payments',
            read: false,
          })
        }
      }
    })
  }

  // Sort by time descending
  return notifications.sort((a, b) => new Date(b.time) - new Date(a.time))
}

function timeAgo(dateString) {
  const now = new Date()
  const date = new Date(dateString)
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'Yesterday'
  return `${diffDays}d ago`
}

const iconConfig = {
  clock: { icon: Clock, bg: 'bg-yellow-100 dark:bg-yellow-900/30', color: 'text-yellow-600 dark:text-yellow-400' },
  alert: { icon: AlertCircle, bg: 'bg-red-100 dark:bg-red-900/30', color: 'text-red-600 dark:text-red-400' },
  dollar: { icon: DollarSign, bg: 'bg-blue-100 dark:bg-blue-900/30', color: 'text-blue-600 dark:text-blue-400' },
  check: { icon: CheckCircle, bg: 'bg-green-100 dark:bg-green-900/30', color: 'text-green-600 dark:text-green-400' },
}

export default function NotificationPanel({ onClose }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const panelRef = useRef(null)
  const notifications = generateNotifications(user)

  useEffect(() => {
    function handleClickOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  const handleNotificationClick = (link) => {
    navigate(link)
    onClose()
  }

  const unreadCount = notifications.length

  return (
    <div
      ref={panelRef}
      className="absolute right-0 mt-2 w-96 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-[9999]"
      style={{ top: '100%' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-gray-800 dark:text-white text-sm">Notifications</h3>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 bg-primary text-white text-xs rounded-full font-medium">
              {unreadCount}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Notification List */}
      <div className="max-h-[420px] overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-3">
              <Bell className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">All caught up!</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">No new notifications</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {notifications.map((notif) => {
              const cfg = iconConfig[notif.icon] || iconConfig.clock
              const IconComponent = cfg.icon
              return (
                <button
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif.link)}
                  className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left group"
                >
                  {/* Icon */}
                  <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center mt-0.5 ${cfg.bg}`}>
                    <IconComponent className={`w-4 h-4 ${cfg.color}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-0.5">
                      {notif.title}
                    </p>
                    <p className="text-sm font-medium text-gray-800 dark:text-white truncate">
                      {notif.message}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
                      {notif.sub}
                    </p>
                  </div>

                  {/* Time */}
                  <div className="flex-shrink-0 text-xs text-gray-400 dark:text-gray-500 mt-0.5 whitespace-nowrap">
                    {timeAgo(notif.time)}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>{unreadCount} item{unreadCount !== 1 ? 's' : ''} need{unreadCount === 1 ? 's' : ''} attention</span>
            <button
              onClick={() => { navigate('/enrollments'); onClose() }}
              className="text-primary hover:text-accent-burgundy font-medium transition-colors"
            >
              View all →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}