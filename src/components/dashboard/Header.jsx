import { useState, useRef, useEffect } from 'react'
import { Bell, User, Menu, Search, LogOut, ChevronDown } from 'lucide-react'
import ThemeToggle from '../ThemeToggle'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import NotificationPanel from './NotificationPanel'
import { mockEnrollments } from '../../data/mockEnrollments'
import { mockPayments } from '../../data/mockPayments'
import { useAvatar } from '../../hooks/useAvatar'
import ProfileModal from './ProfileModal'

function getNotificationCount(user) {
  let count = 0

  if (user?.role !== 'accounting') {
    mockEnrollments.forEach(e => {
      if (e.status === 'pending') {
        const isBasicGrade = e.enrollment.gradeLevel.includes('Grade')
        const isCollegeGrade = e.enrollment.gradeLevel.includes('BS') || e.enrollment.gradeLevel.includes('Year')
        const visible =
          user?.role === 'admin' ||
          (user?.role === 'registrar_basic' && isBasicGrade) ||
          (user?.role === 'registrar_college' && isCollegeGrade)
        if (visible) count++
      }
    })
  }

  if (user?.role === 'admin' || user?.role === 'accounting') {
    mockPayments.forEach(p => {
      if (p.status === 'overdue') count++
      if (p.status === 'partial') {
        const daysUntilDue = Math.ceil((new Date(p.dueDate) - new Date()) / (1000 * 60 * 60 * 24))
        if (daysUntilDue <= 30 && daysUntilDue > 0) count++
      }
    })
  }

  return count
}

export default function Header({ toggleSidebar }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [showDropdown, setShowDropdown] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const dropdownRef = useRef(null)
  const [avatar] = useAvatar(user?.id)

  const notifCount = getNotificationCount(user)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <>
    <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4 lg:px-6 flex-shrink-0">
      
      {/* Left Side - Menu & Search */}
      <div className="flex items-center gap-4 flex-1">
        <button
          onClick={toggleSidebar}
          className="lg:hidden text-gray-700 dark:text-gray-300 hover:text-primary"
        >
          <Menu className="w-6 h-6" />
        </button>

        <div className="hidden md:flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded-lg px-4 py-2 max-w-md flex-1">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search students, enrollments..."
            className="bg-transparent outline-none text-sm text-gray-700 dark:text-gray-300 w-full"
          />
        </div>
      </div>

      {/* Right Side */}
      <div className="flex items-center gap-3">

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative text-gray-700 dark:text-gray-300 hover:text-primary transition-colors p-1"
          >
            <Bell className="w-5 h-5" />
            {notifCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-white text-xs rounded-full flex items-center justify-center font-medium">
                {notifCount > 9 ? '9+' : notifCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <NotificationPanel onClose={() => setShowNotifications(false)} />
          )}
        </div>

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* User Profile Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:text-primary transition-colors px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
              {avatar
                ? <img src={avatar} alt="avatar" className="w-full h-full object-cover" />
                : <User className="w-5 h-5 text-white" />
              }
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-semibold">{user?.name || 'User'}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                {user?.role?.replace('_', ' ') || 'Role'}
              </p>
            </div>
            <ChevronDown className={`w-4 h-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
          </button>

          {showDropdown && (
            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-[9999] overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
                <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                  {avatar
                    ? <img src={avatar} alt="avatar" className="w-full h-full object-cover" />
                    : <User className="w-5 h-5 text-white" />
                  }
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 dark:text-white truncate">{user?.name || 'User'}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email || 'email@example.com'}</p>
                  <span className="inline-block mt-0.5 text-xs text-gray-400 dark:text-gray-500 capitalize">
                    {user?.role?.replace('_', ' ') || 'Role'}
                  </span>
                </div>
              </div>
              <div className="py-1">
                <button
                  onClick={() => { setShowDropdown(false); setShowProfile(true) }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <User className="w-4 h-4" />
                  My Profile
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>

    {/* Profile Modal */}
    {showProfile && (
      <ProfileModal onClose={() => setShowProfile(false)} />
    )}
    </>
  )
}