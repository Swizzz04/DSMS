import { useState, useRef, useEffect } from 'react'
import { User, Menu, LogOut, ChevronDown, MapPin, X } from 'lucide-react'
import ThemeToggle from '../ThemeToggle'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { mockEnrollments } from '../../data/mockEnrollments'
import { CampusChip } from '../SchoolComponents'
import { mockPayments } from '../../data/mockPayments'
import { useAvatar } from '../../hooks/useAvatar'
import ProfileModal from './ProfileModal'
import { useAppConfig } from '../../context/AppConfigContext'
import { useCampusFilter } from '../../context/CampusFilterContext'


// Shared transition classes for all dropdowns
const dropdownTransition = (open) =>
  `transition-all duration-200 ease-out origin-top-right
   ${open
     ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
     : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'
   }`

export default function Header({ toggleSidebar }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [showDropdown,      setShowDropdown]      = useState(false)
  const [showProfile,       setShowProfile]       = useState(false)
  const [showCampusPicker,  setShowCampusPicker]  = useState(false)
  const dropdownRef = useRef(null)
  const campusRef   = useRef(null)
  const [avatar]    = useAvatar(user?.id)
  const { activeCampuses } = useAppConfig()
  const { campusFilter, setCampusFilter } = useCampusFilter()
  const isAccountingLocked = user?.role === 'accounting' && user?.campus !== 'all'


  const selectedCampus = activeCampuses.find(c => c.key === campusFilter)
  const campusLabel    = selectedCampus ? selectedCampus.name : 'All Campuses'

  const handleLogout = () => { logout(); navigate('/login') }

  useEffect(() => {
    function handler(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDropdown(false)
      if (campusRef.current   && !campusRef.current.contains(e.target))   setShowCampusPicker(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <>
      <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-4 gap-2 flex-shrink-0 lg:px-6">

        {/* Hamburger */}
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:text-primary hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors lg:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex-1" />

        {/* ── Action row ── */}
        <div className="flex items-center gap-1 sm:gap-2">

          {/* ── Campus chip for all campus-locked roles ── */}
          <CampusChip user={user} />

          {/* ── 1. Campus Selector (hidden for campus-locked roles) ── */}
          {user?.role !== 'registrar_college' && user?.role !== 'registrar_basic' && !(user?.role === 'accounting' && user?.campus !== 'all') && (
          <div className="relative" ref={campusRef}>
            <button
              onClick={() => { setShowCampusPicker(v => !v); setShowDropdown(false) }}
              className={`flex items-center gap-1.5 rounded-lg border transition-all px-2.5 py-2
                ${campusFilter !== 'all'
                  ? 'bg-primary text-white border-primary shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-transparent hover:text-primary hover:border-primary/40'
                }`}
            >
              <MapPin className="w-4 h-4 flex-shrink-0" />
              {campusFilter !== 'all'
                ? <span className="text-xs font-medium max-w-[110px] truncate">{campusLabel}</span>
                : <span className="hidden sm:inline text-xs font-medium">Campus</span>
              }
              {campusFilter !== 'all'
                ? <X className="w-3.5 h-3.5 opacity-80 flex-shrink-0" onClick={(e) => { e.stopPropagation(); setCampusFilter('all') }} />
                : <ChevronDown className={`hidden sm:inline w-3 h-3 flex-shrink-0 transition-transform ${showCampusPicker ? 'rotate-180' : ''}`} />
              }
            </button>

            {/* Campus dropdown */}
            <div className={`fixed inset-x-3 top-[4.5rem] z-[9999]
              sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-52
              bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden
              ${dropdownTransition(showCampusPicker)}`}
            >
              <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Select Campus</p>
                <button onClick={() => setShowCampusPicker(false)} className="sm:hidden p-1 text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="py-1">
                <button
                  onClick={() => { setCampusFilter('all'); setShowCampusPicker(false) }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors
                    ${campusFilter === 'all'
                      ? 'bg-primary/10 text-primary dark:text-red-300 font-semibold'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                >
                  <span className="w-2 h-2 rounded-full bg-gray-400 flex-shrink-0" />
                  <span>All Campuses</span>
                  {campusFilter === 'all' && <span className="ml-auto text-xs">✓</span>}
                </button>
                {activeCampuses.map((campus, i) => {
                  const colors = ['bg-primary', 'bg-blue-500', 'bg-emerald-500', 'bg-purple-500']
                  const isActive = campusFilter === campus.key
                  return (
                    <button
                      key={campus.key}
                      onClick={() => { setCampusFilter(campus.key); setShowCampusPicker(false) }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors
                        ${isActive
                          ? 'bg-primary/10 text-primary dark:text-red-300 font-semibold'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                    >
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${colors[i % colors.length]}`} />
                      <span className="truncate">{campus.name}</span>
                      {isActive && <span className="ml-auto text-xs">✓</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
          )}



          {/* Notifications moved to sidebar badges */}

          {/* ── 3. Theme Toggle ── */}
          <ThemeToggle />

          {/* ── 4. User Profile ── */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => { setShowDropdown(v => !v); setShowCampusPicker(false) }}
              className="flex items-center gap-1.5 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                {avatar
                  ? <img src={avatar} alt="avatar" className="w-full h-full object-cover" />
                  : <User className="w-5 h-5 text-white" />
                }
              </div>
              <div className="hidden md:block text-left">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 leading-tight">{user?.name || 'User'}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 capitalize leading-tight">{user?.role?.replace(/_/g, ' ')}</p>
              </div>
              <ChevronDown className={`hidden md:block w-4 h-4 text-gray-400 transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`} />
            </button>

            {/* Profile dropdown */}
            <div className={`fixed inset-x-3 top-[4.5rem] z-[9999]
              sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-56
              bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden
              ${dropdownTransition(showDropdown)}`}
            >
              {/* User info header */}
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
                <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                  {avatar
                    ? <img src={avatar} alt="avatar" className="w-full h-full object-cover" />
                    : <User className="w-5 h-5 text-white" />
                  }
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 dark:text-white truncate">{user?.name || 'User'}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email || ''}</p>
                  <span className="text-xs text-gray-400 dark:text-gray-500 capitalize">{user?.role?.replace(/_/g, ' ')}</span>
                </div>
              </div>
              {/* Actions */}
              <div className="py-1">
                <button
                  onClick={() => { setShowDropdown(false); setShowProfile(true) }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <User className="w-4 h-4" /> My Profile
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <LogOut className="w-4 h-4" /> Logout
                </button>
              </div>
            </div>
          </div>

        </div>
      </header>

      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
    </>
  )
}