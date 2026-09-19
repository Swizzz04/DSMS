import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getUserPermissions } from '../config/appConfig'

/**
 * ProtectedRoute — enforces both authentication AND page-level permission.
 *
 * requiredPage must match a page id from ALL_PAGES / DEFAULT_PERMISSIONS
 * (e.g. 'settings', 'payments', 'clearance'). This reuses the exact same
 * getUserPermissions() resolution Sidebar.jsx uses to decide what to show
 * in nav — so a page hidden from nav is now also blocked at the route level,
 * closing the "any authenticated user can reach any route by typing the URL"
 * gap (Rev.13 Section 20.1).
 *
 * requiredPage is optional on purpose — routes with no page-gating concept
 * (none currently, but kept for flexibility) simply require login.
 */
export default function ProtectedRoute({ children, requiredPage }) {
  const { isAuthenticated, user } = useAuth()

  // Not logged in - redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // Logged in but this role's resolved permissions don't include this page
  if (requiredPage) {
    const { pages } = getUserPermissions(user)
    if (!pages.includes(requiredPage)) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-page)]">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-[var(--color-primary-readable)] mb-4">Access Denied</h1>
            <p className="text-[var(--color-text-secondary)]">
              You don't have permission to access this page.
            </p>
          </div>
        </div>
      )
    }
  }

  // Has permission - render the page
  return children
}