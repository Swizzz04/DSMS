/**
 * Header.jsx — CSHC Admin Portal
 * ─────────────────────────────────────────────────────────────────
 * Rev. 4 UI Cleanup:
 *  - All hardcoded bg-white/bg-gray-800 → CSS token var(--color-bg-card)
 *  - All border-gray-200/dark:border-gray-700 → var(--color-border)
 *  - All text-gray-* / dark:text-gray-* → var(--color-text-*)
 *  - hover:bg-gray-100 dark:hover:bg-gray-700 → var(--color-bg-subtle)
 *  - dropdownTransition helper removed — replaced by .dropdown-in + opacity toggle
 *  - Campus picker active state: --color-primary-muted bg + --color-primary text
 *  - Logout hover: --color-error-light bg + --color-error text
 *  - No gradients, no shadow-2xl, no hardcoded dark: classes
 * ─────────────────────────────────────────────────────────────────
 */

import { useState, useRef, useEffect } from 'react'
import { User, Menu, LogOut, ChevronDown, MapPin, X } from 'lucide-react'
import ThemeToggle from '../ThemeToggle'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { CampusChip } from '../SchoolComponents'
import { useAvatar } from '../../hooks/useAvatar'
import ProfileModal from './ProfileModal'
import { useAppConfig } from '../../context/AppConfigContext'
import { useCampusFilter } from '../../context/CampusFilterContext'

// ── Dropdown visibility — uses .dropdown-in keyframe from index.css ─
const dropdownVis = (open) =>
  open
    ? 'dropdown-in pointer-events-auto opacity-100'
    : 'pointer-events-none opacity-0'

// Campus dot colors — brand-first palette, one per campus slot
const CAMPUS_DOTS = [
  'var(--color-primary)',
  '#2563eb',
  '#10b981',
  '#7c3aed',
]

export default function Header({ toggleSidebar }) {
  const { user, logout }   = useAuth()
  const navigate           = useNavigate()
  const [showDropdown,     setShowDropdown]     = useState(false)
  const [showProfile,      setShowProfile]      = useState(false)
  const [showCampusPicker, setShowCampusPicker] = useState(false)
  const dropdownRef = useRef(null)
  const campusRef   = useRef(null)
  const [avatar]    = useAvatar(user?.id)
  const { activeCampuses } = useAppConfig()
  const { campusFilter, setCampusFilter } = useCampusFilter()

  const selectedCampus = activeCampuses.find(c => c.key === campusFilter)
  const campusLabel    = selectedCampus ? selectedCampus.name : 'All Campuses'

  const handleLogout = () => { logout(); navigate('/login') }

  // Close both dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDropdown(false)
      if (campusRef.current   && !campusRef.current.contains(e.target))   setShowCampusPicker(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <>
      {/* ── Header bar ─────────────────────────────────────────── */}
      <header
        className="h-16 flex items-center px-4 lg:px-6 gap-2 flex-shrink-0 border-b"
        style={{
          backgroundColor: 'var(--color-bg-card)',
          borderColor:     'var(--color-border)',
        }}
      >

        {/* Hamburger — mobile only */}
        <button
          onClick={toggleSidebar}
          className="p-2 rounded-[var(--radius-md)] transition-colors lg:hidden"
          style={{ color: 'var(--color-text-secondary)' }}
          onMouseEnter={e => {
            e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)'
            e.currentTarget.style.color           = 'var(--color-primary)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.backgroundColor = 'transparent'
            e.currentTarget.style.color           = 'var(--color-text-secondary)'
          }}
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex-1" />

        {/* ── Right-side action row ─────────────────────────────── */}
        <div className="flex items-center gap-0.5 sm:gap-2">

          {/* Campus chip — shown to campus-locked roles */}
          <CampusChip user={user} />

          {/* ── Campus Selector (admin + technical_admin only) ─── */}
          {(user?.role === 'admin' || user?.role === 'technical_admin') && (
            <div className="relative" ref={campusRef}>

              {/* Trigger button */}
              <button
                onClick={() => { setShowCampusPicker(v => !v); setShowDropdown(false) }}
                className="flex items-center gap-1.5 rounded-[var(--radius-md)] border transition-all px-2.5 py-2"
                style={
                  campusFilter !== 'all'
                    ? { backgroundColor: 'var(--color-primary)', color: '#ffffff', borderColor: 'var(--color-primary)' }
                    : { backgroundColor: 'var(--color-bg-subtle)', color: 'var(--color-text-secondary)', borderColor: 'transparent' }
                }
              >
                <MapPin className="w-4 h-4 flex-shrink-0" />
                {campusFilter !== 'all'
                  ? <span className="text-xs font-medium max-w-[110px] truncate">{campusLabel}</span>
                  : <span className="hidden sm:inline text-xs font-medium">Campus</span>
                }
                {campusFilter !== 'all'
                  ? (
                    <X
                      className="w-3.5 h-3.5 opacity-80 flex-shrink-0"
                      onClick={e => { e.stopPropagation(); setCampusFilter('all') }}
                    />
                  ) : (
                    <ChevronDown
                      className={`hidden sm:inline w-3 h-3 flex-shrink-0 transition-transform ${showCampusPicker ? 'rotate-180' : ''}`}
                    />
                  )
                }
              </button>

              {/* Campus dropdown panel */}
              <div
                className={`fixed inset-x-3 top-[4.5rem] z-[9000]
                  sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-52
                  rounded-[var(--radius-xl)] shadow-[var(--shadow-lg)] overflow-hidden
                  transition-[opacity,transform] ${dropdownVis(showCampusPicker)}`}
                style={{
                  backgroundColor: 'var(--color-bg-card)',
                  border:          '1px solid var(--color-border)',
                }}
              >
                {/* Panel label row */}
                <div
                  className="px-3 py-2 flex items-center justify-between border-b"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <p className="text-label" style={{ color: 'var(--color-text-muted)' }}>
                    Select Campus
                  </p>
                  <button
                    onClick={() => setShowCampusPicker(false)}
                    className="sm:hidden p-1 rounded transition-colors"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="py-1">
                  {/* All Campuses option */}
                  <CampusOption
                    label="All Campuses"
                    dotColor="var(--color-text-muted)"
                    isActive={campusFilter === 'all'}
                    onClick={() => { setCampusFilter('all'); setShowCampusPicker(false) }}
                  />
                  {/* Per-campus options */}
                  {activeCampuses.map((campus) => (
                    <CampusOption
                      key={campus.key}
                      label={campus.name}
                      dotColor={'var(--color-primary)'}
                      isActive={campusFilter === campus.key}
                      onClick={() => { setCampusFilter(campus.key); setShowCampusPicker(false) }}
                    />
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* ── Theme Toggle ──────────────────────────────────── */}
          <ThemeToggle />

          {/* ── User Profile ──────────────────────────────────── */}
          <div className="relative" ref={dropdownRef}>

            {/* Avatar + name trigger */}
            <button
              onClick={() => { setShowDropdown(v => !v); setShowCampusPicker(false) }}
              className="flex items-center gap-1.5 p-1 rounded-[var(--radius-md)] transition-colors"
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <Avatar src={avatar} size="w-8 h-8" />
              <div className="hidden md:block text-left">
                <p className="text-sm font-semibold leading-tight" style={{ color: 'var(--color-text-primary)' }}>
                  {user?.name || 'User'}
                </p>
                <p className="text-xs leading-tight capitalize" style={{ color: 'var(--color-text-muted)' }}>
                  {user?.role?.replace(/_/g, ' ')}
                </p>
              </div>
              <ChevronDown
                className={`hidden md:block w-4 h-4 transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`}
                style={{ color: 'var(--color-text-muted)' }}
              />
            </button>

            {/* Profile dropdown panel */}
            <div
              className={`fixed inset-x-3 top-[4.5rem] z-[9000]
                sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-56
                rounded-[var(--radius-xl)] shadow-[var(--shadow-lg)] overflow-hidden
                transition-[opacity,transform] ${dropdownVis(showDropdown)}`}
              style={{
                backgroundColor: 'var(--color-bg-card)',
                border:          '1px solid var(--color-border)',
              }}
            >
              {/* User info header */}
              <div
                className="px-4 py-3 flex items-center gap-3 border-b"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <Avatar src={avatar} size="w-10 h-10" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>
                    {user?.name || 'User'}
                  </p>
                  <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                    {user?.email || ''}
                  </p>
                  <span className="text-xs capitalize" style={{ color: 'var(--color-text-muted)' }}>
                    {user?.role?.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="py-1">
                <DropdownAction
                  icon={<User className="w-4 h-4" />}
                  label="My Profile"
                  onClick={() => { setShowDropdown(false); setShowProfile(true) }}
                />
                <DropdownAction
                  icon={<LogOut className="w-4 h-4" />}
                  label="Logout"
                  onClick={handleLogout}
                  danger
                />
              </div>
            </div>

          </div>
        </div>
      </header>

      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
    </>
  )
}


// ─────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────

/** Reusable avatar circle — primary bg fallback with user icon */
function Avatar({ src, size = 'w-9 h-9' }) {
  return (
    <div
      className={`${size} rounded-full flex items-center justify-center overflow-hidden flex-shrink-0`}
      style={{ backgroundColor: 'var(--color-primary)' }}
    >
      {src
        ? <img src={src} alt="avatar" className="w-full h-full object-cover" />
        : <User className="w-5 h-5 text-white" />
      }
    </div>
  )
}

/** Campus picker list item — active state uses primary-muted bg */
function CampusOption({ label, dotColor, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors"
      style={{
        backgroundColor: isActive ? 'var(--color-primary-muted)' : 'transparent',
        color:           isActive ? 'var(--color-primary)'        : 'var(--color-text-secondary)',
        fontWeight:      isActive ? 600 : 400,
      }}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)' }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent' }}
    >
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} />
      <span className="truncate">{label}</span>
      {isActive && (
        <span className="ml-auto text-xs" style={{ color: 'var(--color-primary)' }}>✓</span>
      )}
    </button>
  )
}

/** Profile dropdown action row — danger variant uses error tokens */
function DropdownAction({ icon, label, onClick, danger = false }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors"
      style={{ color: danger ? 'var(--color-error)' : 'var(--color-text-secondary)' }}
      onMouseEnter={e => {
        e.currentTarget.style.backgroundColor = danger
          ? 'var(--color-error-light)'
          : 'var(--color-bg-subtle)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.backgroundColor = 'transparent'
      }}
    >
      {icon}
      {label}
    </button>
  )
}