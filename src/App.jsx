import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import DashboardLayout from './components/dashboard/DashboardLayout'
import Dashboard from './pages/Dashboard'
import ProtectedRoute from './components/ProtectedRoute'
import Enrollments from './pages/Enrollments'
import Students from './pages/Students'
import Payments from './pages/Payments'
import Settings from './pages/Settings'
import Reports from './pages/Reports'
import SubjectLoad from './pages/SubjectLoad'
import { useAuth } from './context/AuthContext'

// ── Role-aware route guard ────────────────────────────────────────
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
        {children}
      </DashboardLayout>
    </ProtectedRoute>
  )
}

// Full operational access (everyone except school owner)
const OPERATIONAL = [
  'technical_admin', 'registrar_basic', 'registrar_college',
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
            <DashboardLayout><Dashboard /></DashboardLayout>
          </ProtectedRoute>
        } />

        {/* Enrollments — admin (read-only overview) + all operational roles */}
        <Route path="/enrollments" element={
          <RoleRoute allowedRoles={['admin', ...OPERATIONAL]}>
            <Enrollments />
          </RoleRoute>
        } />

        {/* Students — operational roles only */}
        <Route path="/students" element={
          <RoleRoute allowedRoles={OPERATIONAL}>
            <Students />
          </RoleRoute>
        } />

        {/* Payments — accounting + technical_admin only */}
        <Route path="/payments" element={
          <RoleRoute allowedRoles={['technical_admin', 'accounting']}>
            <Payments />
          </RoleRoute>
        } />

        {/* Reports — school owner + technical_admin + accounting */}
        <Route path="/reports" element={
          <RoleRoute allowedRoles={['admin', 'technical_admin', 'accounting']}>
            <Reports />
          </RoleRoute>
        } />

        {/* Settings — technical_admin (all tabs) + accounting (fee/discount/receipt tabs) */}
        <Route path="/settings" element={
          <RoleRoute allowedRoles={['technical_admin', 'accounting']}>
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
