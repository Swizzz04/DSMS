import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import DashboardLayout from './components/dashboard/DashboardLayout'
import ProtectedRoute from './components/ProtectedRoute'
import { useAuth } from './context/AuthContext'
import { getUserPermissions } from './config/appConfig'

// ── Lazy-loaded pages ────────────────────────────────────────
const Dashboard   = lazy(() => import('./pages/Dashboard'))
const Enrollments = lazy(() => import('./pages/Enrollments'))
const Students    = lazy(() => import('./pages/Students'))
const Payments    = lazy(() => import('./pages/Payments'))
const Reports     = lazy(() => import('./pages/Reports'))
const Settings    = lazy(() => import('./pages/Settings'))
const SubjectLoad = lazy(() => import('./pages/SubjectLoad'))
const Grades      = lazy(() => import('./pages/Grades'))

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

// ── Permission-based route guard ─────────────────────────────
// Checks user.permissions.pages (or DEFAULT_PERMISSIONS fallback)
function PermRoute({ children, page }) {
  const { user } = useAuth()
  if (user) {
    const perms = getUserPermissions(user)
    if (!perms.pages.includes(page)) {
      return <Navigate to="/dashboard" replace />
    }
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

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/"      element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Dashboard — all authenticated users */}
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <DashboardLayout>
              <Suspense fallback={<PageLoader />}>
                <Dashboard />
              </Suspense>
            </DashboardLayout>
          </ProtectedRoute>
        } />

        {/* Permission-based routes */}
        <Route path="/enrollments"  element={<PermRoute page="enrollments"><Enrollments /></PermRoute>} />
        <Route path="/students"     element={<PermRoute page="students"><Students /></PermRoute>} />
        <Route path="/payments"     element={<PermRoute page="payments"><Payments /></PermRoute>} />
        <Route path="/reports"      element={<PermRoute page="reports"><Reports /></PermRoute>} />
        <Route path="/settings"     element={<PermRoute page="settings"><Settings /></PermRoute>} />
        <Route path="/subject-load" element={<PermRoute page="subject-load"><SubjectLoad /></PermRoute>} />
        <Route path="/grades"       element={<PermRoute page="grades"><Grades /></PermRoute>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App