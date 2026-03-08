import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  DollarSign, 
  Settings,
  X,
  BarChart3,
  GraduationCap
} from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function Sidebar({ isOpen, toggleSidebar }) {
  const location = useLocation()
  const { user } = useAuth()

  // Role-based navigation items
  const getNavItems = () => {
    const baseItems = [
      {
        id: 'dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
        path: '/dashboard',
        roles: ['admin', 'registrar_basic', 'registrar_college', 'accounting']
      }
    ]

    const roleSpecificItems = {
      admin: [
        {
          id: 'enrollments',
          label: 'Enrollments',
          icon: FileText,
          path: '/enrollments',
          roles: ['admin']
        },
        {
          id: 'students',
          label: 'Students',
          icon: Users,
          path: '/students',
          roles: ['admin']
        },
        {
          id: 'payments',
          label: 'Payments',
          icon: DollarSign,
          path: '/payments',
          roles: ['admin']
        },
        {
          id: 'reports',
          label: 'Reports',
          icon: BarChart3,
          path: '/reports',
          roles: ['admin']
        },
        {
          id: 'settings',
          label: 'Settings',
          icon: Settings,
          path: '/settings',
          roles: ['admin']
        }
      ],
      registrar_basic: [
        {
          id: 'enrollments',
          label: 'Basic Ed Enrollments',
          icon: FileText,
          path: '/enrollments',
          roles: ['registrar_basic']
        },
        {
          id: 'students',
          label: 'Basic Ed Students',
          icon: GraduationCap,
          path: '/students',
          roles: ['registrar_basic']
        }
      ],
      registrar_college: [
        {
          id: 'enrollments',
          label: 'College Enrollments',
          icon: FileText,
          path: '/enrollments',
          roles: ['registrar_college']
        },
        {
          id: 'students',
          label: 'College Students',
          icon: Users,
          path: '/students',
          roles: ['registrar_college']
        }
      ],
      accounting: [
        {
          id: 'payments',
          label: 'Payments',
          icon: DollarSign,
          path: '/payments',
          roles: ['accounting']
        },
        {
          id: 'reports',
          label: 'Financial Reports',
          icon: BarChart3,
          path: '/reports',
          roles: ['accounting']
        }
      ]
    }

    // Combine base items with role-specific items
    const userRole = user?.role || 'admin'
    const items = [...baseItems, ...(roleSpecificItems[userRole] || [])]

    return items.filter(item => item.roles.includes(userRole))
  }

  const navItems = getNavItems()
  const isActive = (path) => location.pathname === path

  // Get role display name
  const getRoleDisplay = () => {
    const roleNames = {
      admin: 'Admin Portal',
      registrar_basic: 'Basic Ed Registrar',
      registrar_college: 'College Registrar',
      accounting: 'Accounting Portal'
    }
    return roleNames[user?.role] || 'Portal'
  }

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:relative top-0 left-0 h-full bg-white dark:bg-gray-800 
          transition-transform duration-300 ease-in-out z-50
          w-64 border-r border-gray-200 dark:border-gray-700
          flex flex-col
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Sidebar Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/20 flex-shrink-0 bg-white">
              <img
                src="/cshclogo.png"
                alt="CSHC Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h2 className="font-bold text-primary dark:text-white text-sm">CSHC</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">{getRoleDisplay()}</p>
            </div>
          </div>
          
          {/* Close button (mobile only) */}
          <button
            onClick={toggleSidebar}
            className="lg:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation - Scrollable */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.id}
              to={item.path}
              onClick={() => window.innerWidth < 1024 && toggleSidebar()}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-lg
                transition-colors duration-200
                ${isActive(item.path)
                  ? 'bg-primary text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }
              `}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
            © 2026 CSHC
          </div>
        </div>
      </aside>
    </>
  )
}