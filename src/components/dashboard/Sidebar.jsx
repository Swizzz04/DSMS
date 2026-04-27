import { useState, useEffect, useCallback } from 'react'
import {
  LayoutDashboard, FileText, Users, DollarSign,
  Settings, X, GraduationCap, BarChart2, Layers
} from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getUserPermissions } from '../../config/appConfig'

// Read school branding
function getSchoolConfig() {
  try {
    const s = JSON.parse(localStorage.getItem('cshc_website_content') || '{}')
    return { name: s.schoolName || 'Admin Portal', shortName: s.schoolShortName || (s.schoolName || 'Admin').split(' ')[0], logo: s.logoUrl || '/assets/cshclogo.png' }
  } catch { return { name: 'Admin Portal', shortName: 'Admin', logo: '/assets/cshclogo.png' } }
}

// ── Helpers ───────────────────────────────────────────────────────
const isBasicGrade   = g => g && (g.includes('Grade') || ['Nursery','Kindergarten','Preparatory'].some(x => g.includes(x)))
const isCollegeGrade = g => g && (g.includes('BS') || g.includes('Year'))

function computeBadges(user) {
  if (!user) return {}
  const role   = user.role
  const campus = user.campus
  const campusMatch = (val) => {
    if (!val || campus === 'all') return true
    return val === campus || val.includes(campus) || campus.includes(val)
  }
  const campusEnr = []
  const campusStu = []
  let webSubs = []
  try {
    const all = JSON.parse(localStorage.getItem('cshc_submissions') || '[]')
    webSubs = all.filter(s => {
      const subCampus = s.enrollment?.campus || s.campusName || s.campus || ''
      return campusMatch(subCampus)
    })
  } catch {}
  const allEnr = [...campusEnr, ...webSubs]
  let enrBadge = 0, payBadge = 0, stuBadge = 0

  if (role === 'admin') {
    enrBadge = allEnr.filter(e => e.status === 'pending' || e.status === 'payment_received').length
  }
  if (role === 'technical_admin' || role === 'system_admin') {
    // Super admin and system admin don't see enrollment badges
    enrBadge = 0
    payBadge = 0
  }
  if (role === 'registrar_basic') {
    enrBadge = allEnr.filter(e => e.status === 'payment_received' && isBasicGrade(e.enrollment?.gradeLevel || '')).length
    stuBadge = campusStu.filter(s => isBasicGrade(s.academic?.gradeLevel) && s.status === 'inactive').length
  }
  if (role === 'registrar_college') {
    enrBadge = allEnr.filter(e => e.status === 'payment_received' && isCollegeGrade(e.enrollment?.gradeLevel || '')).length
    stuBadge = campusStu.filter(s => isCollegeGrade(s.academic?.gradeLevel) && s.status === 'inactive').length
  }
  if (role === 'accounting') {
    enrBadge = allEnr.filter(e => e.status === 'pending').length
    payBadge = webSubs.filter(s =>
      (s.status === 'payment_received' || s.status === 'approved') &&
      s.balance > 0 && s.submittedDate &&
      Math.floor((Date.now() - new Date(s.submittedDate)) / 86400000) > 30
    ).length
  }
  if (role === 'principal_basic' || role === 'program_head') {
    stuBadge = campusStu.filter(s => isBasicGrade(s.academic?.gradeLevel) && s.status === 'inactive').length
  }
  return {
    dashboard:   enrBadge + payBadge + stuBadge,
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
    <span style={{
      marginLeft:      'auto',
      minWidth:        18,
      height:          18,
      padding:         '0 5px',
      borderRadius:    999,
      fontSize:        10,
      fontWeight:      700,
      display:         'flex',
      alignItems:      'center',
      justifyContent:  'center',
      flexShrink:      0,
      letterSpacing:   '0.02em',
      backgroundColor: active ? 'rgba(255,255,255,0.20)' : 'var(--color-primary)',
      color:           '#fff',
      border:          active ? '1px solid rgba(255,255,255,0.30)' : 'none',
    }}>
      {count > 99 ? '99+' : count}
    </span>
  )
}

// ── Main Sidebar ──────────────────────────────────────────────────
export default function Sidebar({ isOpen, toggleSidebar }) {
  const location = useLocation()
  const { user }  = useAuth()
  const school    = getSchoolConfig()
  const [badges, setBadges] = useState({})

  const refreshBadges = useCallback(() => setBadges(computeBadges(user)), [user])

  useEffect(() => {
    refreshBadges()
    const handleStorage = (e) => { if (e.key === 'cshc_submissions' || e.key === null) refreshBadges() }
    window.addEventListener('cshc_enrollment_updated', refreshBadges)
    window.addEventListener('cshc_new_submission',     refreshBadges)
    window.addEventListener('storage',                 handleStorage)
    const t = setInterval(refreshBadges, 10_000)
    return () => {
      window.removeEventListener('cshc_enrollment_updated', refreshBadges)
      window.removeEventListener('cshc_new_submission',     refreshBadges)
      window.removeEventListener('storage',                 handleStorage)
      clearInterval(t)
    }
  }, [refreshBadges])

  const getNavItems = () => {
    const perms = getUserPermissions(user)
    const pages = perms.pages || []

    const pageNavMap = {
      enrollments:    { id: 'enrollments',  label: 'Enrollments',  icon: FileText,   path: '/enrollments' },
      students:       { id: 'students',     label: 'Students',     icon: Users,      path: '/students' },
      payments:       { id: 'payments',     label: 'Payments',     icon: DollarSign, path: '/payments' },
      reports:        { id: 'reports',      label: 'Reports',      icon: BarChart2,  path: '/reports' },
      settings:       { id: 'settings',     label: 'Settings',     icon: Settings,   path: '/settings' },
      'subject-load': { id: 'subject-load', label: 'Subject Load', icon: Layers,     path: '/subject-load' },
    }

    const items = [{ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' }]
    pages.forEach(pageId => {
      if (pageId !== 'dashboard' && pageNavMap[pageId]) items.push(pageNavMap[pageId])
    })
    return items
  }

  const navItems = getNavItems()
  const isActive = (path) => location.pathname === path

  const getRoleLabel = () => ({
    admin:             'Owner Dashboard',
    technical_admin:   'Super Admin Portal',
    system_admin:      'System Admin',
    registrar_basic:   'Basic Ed Registrar',
    registrar_college: 'College Registrar',
    accounting:        'Accounting Portal',
    principal_basic:   'Basic Ed Principal',
    program_head:      'Program Head',
  }[user?.role] || 'Portal')

  // ── Section label helper (visual grouping within long nav lists) ──
  const getSectionLabel = (id) => ({
    enrollments: 'Management',
    payments:    'Management',
    students:    'Management',
    reports:     'Analytics',
    settings:    'System',
    'subject-load': 'Academic',
  }[id])

  // Insert section dividers
  const itemsWithDividers = []
  let lastSection = null
  navItems.forEach((item, idx) => {
    if (idx === 0) { itemsWithDividers.push(item); return }
    const sec = getSectionLabel(item.id)
    if (sec && sec !== lastSection) {
      itemsWithDividers.push({ type: 'divider', label: sec })
      lastSection = sec
    }
    itemsWithDividers.push(item)
  })

  return (
    <>
      {/* Mobile overlay — uses CSS transition via overlay-backdrop class */}
      <div
        className={`overlay-backdrop fixed inset-0 z-[60] lg:hidden ${isOpen ? 'visible' : 'hidden'}`}
        style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
        onClick={toggleSidebar}
      />

      {/* Sidebar panel — uses CSS sidebar-panel transition */}
      <aside
        className={`sidebar-panel fixed top-0 left-0 h-full z-[70] w-64 shrink-0 flex flex-col ${isOpen ? 'open' : 'closed'}`}
        style={{
          backgroundColor: 'var(--color-bg-card)',
          borderRight:     '1px solid var(--color-border)',
          boxShadow:       isOpen ? 'var(--shadow-modal)' : 'none',
        }}
      >
        {/* ── Brand header ── */}
        <div style={{
          height:         64,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '0 1rem',
          borderBottom:   '1px solid var(--color-border)',
          flexShrink:     0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Logo with red ring */}
            <div style={{
              width:        38,
              height:       38,
              borderRadius: '50%',
              overflow:     'hidden',
              flexShrink:   0,
              border:       '2px solid var(--color-primary)',
              backgroundColor: '#fff',
              boxShadow:    '0 0 0 3px var(--color-primary-muted)',
            }}>
              <img src={school.logo} alt={school.shortName} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 3 }} />
            </div>
            <div>
              <div style={{
                fontSize:      '0.8rem',
                fontWeight:    700,
                color:         'var(--color-text-primary)',
                letterSpacing: '0.04em',
                lineHeight:    1.2,
              }}>
                CSHC
              </div>
              <div style={{
                fontSize:      '0.62rem',
                color:         'var(--color-text-muted)',
                letterSpacing: '0.03em',
                lineHeight:    1.3,
                maxWidth:      140,
                overflow:      'hidden',
                whiteSpace:    'nowrap',
                textOverflow:  'ellipsis',
              }}>
                {getRoleLabel()}
              </div>
            </div>
          </div>

          {/* Mobile close button */}
          <button
            onClick={toggleSidebar}
            className="lg:hidden"
            style={{
              padding:         6,
              borderRadius:    'var(--radius-sm)',
              color:           'var(--color-text-muted)',
              background:      'none',
              border:          'none',
              cursor:          'pointer',
              transition:      'color var(--t-base)',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--color-text-primary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-muted)'}
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Navigation ── */}
        <nav style={{
          flex:       1,
          padding:    '0.75rem 0.75rem',
          overflowY:  'auto',
          overflowX:  'hidden',
        }}>
          {itemsWithDividers.map((item, idx) => {
            // Section divider label
            if (item.type === 'divider') {
              return (
                <div key={`div-${idx}`} style={{
                  padding:       '0.85rem 0.75rem 0.35rem',
                  fontSize:      '0.58rem',
                  fontWeight:    700,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color:         'var(--color-text-muted)',
                }}>
                  {item.label}
                </div>
              )
            }

            const active     = isActive(item.path)
            const badgeCount = badges[item.id] || 0

            return (
              <Link
                key={item.id}
                to={item.path}
                onClick={() => window.innerWidth < 1024 && toggleSidebar()}
                style={{
                  display:        'flex',
                  alignItems:     'center',
                  gap:            '0.65rem',
                  padding:        '0.6rem 0.75rem',
                  borderRadius:   'var(--radius-md)',
                  marginBottom:   2,
                  textDecoration: 'none',
                  position:       'relative',
                  transition:     `background-color var(--t-base), color var(--t-base)`,
                  backgroundColor: active ? 'var(--color-primary)' : 'transparent',
                  color:          active ? '#fff' : 'var(--color-text-secondary)',
                  // Active left-edge accent
                  borderLeft:     active ? '3px solid var(--color-primary)' : '3px solid transparent',
                }}
                onMouseEnter={e => {
                  if (!active) {
                    e.currentTarget.style.backgroundColor = 'var(--color-primary-muted)'
                    e.currentTarget.style.color           = 'var(  --color-text-secondary)'
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    e.currentTarget.style.backgroundColor = 'transparent'
                    e.currentTarget.style.color           = 'var(--color-text-primary)'
                  }
                }}
              >
                {/* Icon */}
                <item.icon
                  size={16}
                  style={{
                    flexShrink: 0,
                    color:      active ? '#fff' : 'var(--color-text-muted)',
                    transition: 'color var(--t-base)',
                  }}
                />

                {/* Label */}
                <span style={{
                  fontSize:     '0.82rem',
                  fontWeight:   active ? 600 : 500,
                  flex:         1,
                  overflow:     'hidden',
                  whiteSpace:   'nowrap',
                  textOverflow: 'ellipsis',
                  letterSpacing: '0.01em',
                }}>
                  {item.label}
                </span>

                {/* Badge */}
                <NavBadge count={badgeCount} active={active} />
              </Link>
            )
          })}
        </nav>

        {/* ── Footer ── */}
        <div style={{
          padding:       '0.75rem 1rem',
          borderTop:     '1px solid var(--color-border)',
          flexShrink:    0,
          textAlign:     'center',
          fontSize:      '0.62rem',
          color:         'var(--color-text-muted)',
          letterSpacing: '0.04em',
        }}>
          {'00A9 ' + new Date().getFullYear() + ' ' + school.shortName}
        </div>
      </aside>
    </>
  )
}