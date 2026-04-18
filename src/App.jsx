import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import DashboardLayout from './components/dashboard/DashboardLayout'
import ProtectedRoute from './components/ProtectedRoute'
import { useAuth } from './context/AuthContext'

// ── Lazy-loaded pages ────────────────────────────────────────
// Each page loads ONLY when the user navigates to it.
// This cuts initial bundle by ~70% — login loads in <1s instead of 3-4s.
const Dashboard   = lazy(() => import('./pages/Dashboard'))
const Enrollments = lazy(() => import('./pages/Enrollments'))
const Students    = lazy(() => import('./pages/Students'))
const Payments    = lazy(() => import('./pages/Payments'))
const Reports     = lazy(() => import('./pages/Reports'))
const Settings    = lazy(() => import('./pages/Settings'))
const SubjectLoad = lazy(() => import('./pages/SubjectLoad'))

// ── Page loading fallback ────────────────────────────────────
// Minimal spinner shown while a page chunk loads (usually <200ms on repeat visits)
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

// ── Role-aware route guard ────────────────────────────────────
// Extends ProtectedRoute with an allowedRoles check.
// If the logged-in user's role is not in allowedRoles → redirect to /dashboard.
function RoleRoute({ children, allowedRoles }) {
  const { user } = useAuth()
  if (user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <Suspense fallback={<PageLoader />}>
          {children}
        </Suspense>
      </DashboardLayout>
    </ProtectedRoute>
  )
}

// Full operational access (everyone except school owner and technical_admin)
const OPERATIONAL = [
  'registrar_basic', 'registrar_college',
  'accounting', 'principal_basic', 'program_head',
]

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/"      element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Dashboard — all authenticated roles */}
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <DashboardLayout>
              <Suspense fallback={<PageLoader />}>
                <Dashboard />
              </Suspense>
            </DashboardLayout>
          </ProtectedRoute>
        } />

        {/* Enrollments — admin (read-only) + operational roles (NOT technical_admin) */}
        <Route path="/enrollments" element={
          <RoleRoute allowedRoles={['admin', ...OPERATIONAL]}>
            <Enrollments />
          </RoleRoute>
        } />

        {/* Students — operational roles only (NOT technical_admin) */}
        <Route path="/students" element={
          <RoleRoute allowedRoles={OPERATIONAL}>
            <Students />
          </RoleRoute>
        } />

        {/* Payments — accounting only */}
        <Route path="/payments" element={
          <RoleRoute allowedRoles={['accounting']}>
            <Payments />
          </RoleRoute>
        } />

        {/* Reports — school owner + accounting */}
        <Route path="/reports" element={
          <RoleRoute allowedRoles={['admin', 'accounting']}>
            <Reports />
          </RoleRoute>
        } />

        {/* Settings — technical_admin (all tabs) + accounting (fee/discount/receipt) + principal/program_head (school year/grades) */}
        <Route path="/settings" element={
          <RoleRoute allowedRoles={['technical_admin', 'accounting', 'principal_basic', 'program_head']}>
            <Settings />
          </RoleRoute>
        } />

        {/* Subject Load — principal_basic + program_head */}
        <Route path="/subject-load" element={
          <RoleRoute allowedRoles={['principal_basic', 'program_head', 'registrar_college']}>
            <SubjectLoad />
          </RoleRoute>
        } />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App