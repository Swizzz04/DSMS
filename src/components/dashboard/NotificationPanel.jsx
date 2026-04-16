/**
 * NotificationPanel.jsx — CSHC Admin Portal
 * ─────────────────────────────────────────────────────────────────
 * Rev. 4 UI Cleanup:
 *  - All hardcoded bg-white/bg-gray-800 → var(--color-bg-card)
 *  - All border-gray-* → var(--color-border)
 *  - All text-gray-* → var(--color-text-*)
 *  - All bg-gray-50/100/700 → var(--color-bg-subtle/muted)
 *  - shadow-2xl → var(--shadow-modal)
 *  - Icon config uses semantic token colors
 *  - No gradients, no shadow-2xl, no hover:scale, no backdrop-blur
 * ─────────────────────────────────────────────────────────────────
 */
import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Clock, AlertCircle, CheckCircle, DollarSign, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

// Generate notifications from live localStorage submissions
function generateNotifications(user) {
  const notifications = []
  if (!user) return notifications

  let subs = []
  try { subs = JSON.parse(localStorage.getItem('cshc_submissions') || '[]') } catch {}

  const campus = user.campus
  const campusMatch = (val) => {
    if (!val || campus === 'all') return true
    return val === campus || val.includes(campus) || campus.includes(val)
  }
  const isBasicGrade   = g => g && (g.includes('Grade') || ['Nursery','Kindergarten','Preparatory'].some(x => g.includes(x)))
  const isCollegeGrade = g => g && (g.includes('BS') || g.includes('Year'))

  const campusSubs = subs.filter(s => campusMatch(s.enrollment?.campus || ''))

  // ── Pending enrollments (awaiting payment recording) ──────────
  if (user.role !== 'accounting') {
    campusSubs
      .filter(e => e.status === 'pending')
      .forEach(e => {
        const g = e.enrollment?.gradeLevel || ''
        const visible =
          (user.role === 'admin' || user.role === 'technical_admin') ||
          (user.role === 'registrar_basic'   && isBasicGrade(g)) ||
          (user.role === 'registrar_college' && isCollegeGrade(g))
        if (visible) {
          const name = e.student?.fullName ||
            `${(e.student?.firstName || '')} ${(e.student?.lastName || '')}`.trim()
          notifications.push({
            id: `enroll-${e.id || e.referenceNumber}`,
            type: 'pending', icon: 'clock',
            title: 'Awaiting Payment',
            message: `${name} — ${g}`,
            sub: `${e.enrollment?.campus || ''} • ${e.referenceNumber || ''}`,
            time: e.submittedDate,
            link: '/enrollments',
            read: false,
          })
        }
      })
  }

  // ── Payment received — awaiting registrar approval ────────────
  if (user.role === 'registrar_basic' || user.role === 'registrar_college' || user.role === 'admin' || user.role === 'technical_admin') {
    campusSubs
      .filter(e => e.status === 'payment_received')
      .forEach(e => {
        const g = e.enrollment?.gradeLevel || ''
        const visible =
          (user.role === 'admin' || user.role === 'technical_admin') ||
          (user.role === 'registrar_basic'   && isBasicGrade(g)) ||
          (user.role === 'registrar_college' && isCollegeGrade(g))
        if (visible) {
          const name = e.student?.fullName ||
            `${(e.student?.firstName || '')} ${(e.student?.lastName || '')}`.trim()
          notifications.push({
            id: `approve-${e.id || e.referenceNumber}`,
            type: 'check', icon: 'check',
            title: 'Ready for Approval',
            message: `${name} — ${g}`,
            sub: `${e.enrollment?.campus || ''} • ${e.referenceNumber || ''}`,
            time: e.updatedAt || e.submittedDate,
            link: '/enrollments',
            read: false,
          })
        }
      })
  }

  // ── Overdue balances (>30 days with balance) ──────────────────
  if (user.role === 'admin' || user.role === 'technical_admin' || user.role === 'accounting') {
    campusSubs
      .filter(s =>
        (s.status === 'payment_received' || s.status === 'approved') &&
        (s.balance || 0) > 0 &&
        s.submittedDate &&
        Math.floor((Date.now() - new Date(s.submittedDate)) / 86400000) > 30
      )
      .forEach(p => {
        const name = p.student?.fullName ||
          `${(p.student?.firstName || '')} ${(p.student?.lastName || '')}`.trim()
        const days = Math.floor((Date.now() - new Date(p.submittedDate)) / 86400000)
        notifications.push({
          id: `overdue-${p.id || p.referenceNumber}`,
          type: 'overdue', icon: 'alert',
          title: 'Overdue Balance',
          message: `${name} — ₱${(p.balance || 0).toLocaleString()} remaining`,
          sub: `${p.enrollment?.campus || ''} • ${days} days overdue`,
          time: p.submittedDate,
          link: '/payments',
          read: false,
        })
      })
  }

  // Sort most recent first, cap at 20
  return notifications
    .sort((a, b) => new Date(b.time) - new Date(a.time))
    .slice(0, 20)
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
  clock:  { icon: Clock,       color: 'var(--color-warning)', bg: 'var(--color-warning-light)' },
  alert:  { icon: AlertCircle, color: 'var(--color-error)',   bg: 'var(--color-error-light)'   },
  dollar: { icon: DollarSign,  color: 'var(--color-info)',    bg: 'var(--color-info-light)'    },
  check:  { icon: CheckCircle, color: 'var(--color-success)', bg: 'var(--color-success-light)' },
}

export default function NotificationPanel({ onClose }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const panelRef = useRef(null)
  const notifications = generateNotifications(user)

  const handleNotificationClick = (link) => {
    navigate(link)
    onClose()
  }

  const unreadCount = notifications.length

  return (
    <div
      ref={panelRef}
      className="w-full rounded-[var(--radius-xl)] overflow-hidden"
      style={{
        top: '100%',
        backgroundColor: 'var(--color-bg-card)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-modal)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{
          borderColor: 'var(--color-border)',
          backgroundColor: 'var(--color-bg-subtle)',
        }}
      >
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
          <h3 className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>
            Notifications
          </h3>
          {unreadCount > 0 && (
            <span
              className="px-2 py-0.5 text-xs rounded-full font-medium"
              style={{ backgroundColor: 'var(--color-primary)', color: '#ffffff' }}
            >
              {unreadCount}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="transition-colors"
          style={{ color: 'var(--color-text-muted)' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--color-text-primary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-muted)'}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Notification List */}
      <div className="max-h-[420px] overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
              style={{ backgroundColor: 'var(--color-bg-muted)' }}
            >
              <Bell className="w-6 h-6" style={{ color: 'var(--color-text-muted)' }} />
            </div>
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              All caught up!
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
              No new notifications
            </p>
          </div>
        ) : (
          <div>
            {notifications.map((notif, idx) => {
              const cfg = iconConfig[notif.icon] || iconConfig.clock
              const IconComponent = cfg.icon
              return (
                <button
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif.link)}
                  className="w-full flex items-start gap-3 px-4 py-3 transition-colors text-left group"
                  style={{
                    borderBottom: idx < notifications.length - 1 ? '1px solid var(--color-border)' : 'none',
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  {/* Icon */}
                  <div
                    className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center mt-0.5"
                    style={{ backgroundColor: cfg.bg }}
                  >
                    <IconComponent className="w-4 h-4" style={{ color: cfg.color }} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-xs font-semibold uppercase tracking-wide mb-0.5"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      {notif.title}
                    </p>
                    <p
                      className="text-sm font-medium truncate"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {notif.message}
                    </p>
                    <p
                      className="text-xs truncate mt-0.5"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      {notif.sub}
                    </p>
                  </div>

                  {/* Time */}
                  <div
                    className="flex-shrink-0 text-xs mt-0.5 whitespace-nowrap"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
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
        <div
          className="px-4 py-3 border-t"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-bg-subtle)',
          }}
        >
          <div className="flex items-center justify-between text-xs" style={{ color: 'var(--color-text-muted)' }}>
            <span>{unreadCount} item{unreadCount !== 1 ? 's' : ''} need{unreadCount === 1 ? 's' : ''} attention</span>
            <button
              onClick={() => { navigate('/enrollments'); onClose() }}
              className="font-medium transition-colors"
              style={{ color: 'var(--color-primary)' }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--color-primary-hover)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--color-primary)'}
            >
              View all →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}