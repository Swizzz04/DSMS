import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage       from './pages/LoginPage'
import DashboardLayout from './components/dashboard/DashboardLayout'
import ProtectedRoute  from './components/ProtectedRoute'
import { useAuth }     from './context/AuthContext'
import { getUserPermissions } from './config/appConfig'

// ── Lazy-loaded pages ─────────────────────────────────────────────────────────
const Dashboard           = lazy(() => import('./pages/Dashboard'))
const Enrollments         = lazy(() => import('./pages/Enrollments'))
const Students            = lazy(() => import('./pages/Students'))
const Payments            = lazy(() => import('./pages/Payments'))
const Reports             = lazy(() => import('./pages/Reports'))
const Settings            = lazy(() => import('./pages/Settings'))
const SubjectLoad         = lazy(() => import('./pages/SubjectLoad'))
const EClassRecord        = lazy(() => import('./pages/Eclassrecord'))
const TeacherForms        = lazy(() => import('./pages/TeacherForms'))
const DocumentRequests    = lazy(() => import('./pages/DocumentRequests'))
const GradeChangeRequests = lazy(() => import('./pages/GradeChangeRequests'))
const Attendance          = lazy(() => import('./pages/Attendance'))
const Clearance           = lazy(() => import('./pages/Clearance'))

// ── Loading fallback ──────────────────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

// ── Page permission guard ─────────────────────────────────────────────────────
// Wraps a page in DashboardLayout + auth + permission check.
// DashboardLayout uses {children} so each route must wrap its page directly.
function Page({ pageId, children }) {
  const { user, isAuthenticated } = useAuth()

  if (!isAuthenticated) return <Navigate to="/login" replace />

  const perms = getUserPermissions(user)
  if (!perms.pages.includes(pageId)) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full min-h-[60vh]">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-primary mb-4">Access Denied</h1>
            <p className="text-[var(--color-text-secondary)]">
              You don't have permission to access this page.
            </p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <Suspense fallback={<PageLoader />}>
        {children}
      </Suspense>
    </DashboardLayout>
  )
}

// ── Root redirect ─────────────────────────────────────────────────────────────
function RootRedirect() {
  const { isAuthenticated } = useAuth()
  return isAuthenticated
    ? <Navigate to="/dashboard" replace />
    : <Navigate to="/login"    replace />
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/"      element={<RootRedirect />} />

        {/* Protected pages — each wrapped individually in DashboardLayout */}
        <Route path="/dashboard"
          element={<ProtectedRoute><Page pageId="dashboard"><Dashboard /></Page></ProtectedRoute>} />

        <Route path="/enrollments"
          element={<ProtectedRoute><Page pageId="enrollments"><Enrollments /></Page></ProtectedRoute>} />

        <Route path="/students"
          element={<ProtectedRoute><Page pageId="students"><Students /></Page></ProtectedRoute>} />

        <Route path="/payments"
          element={<ProtectedRoute><Page pageId="payments"><Payments /></Page></ProtectedRoute>} />

        <Route path="/reports"
          element={<ProtectedRoute><Page pageId="reports"><Reports /></Page></ProtectedRoute>} />

        <Route path="/settings"
          element={<ProtectedRoute><Page pageId="settings"><Settings /></Page></ProtectedRoute>} />

        <Route path="/subject-load"
          element={<ProtectedRoute><Page pageId="subject-load"><SubjectLoad /></Page></ProtectedRoute>} />

        <Route path="/e-class-record"
          element={<ProtectedRoute><Page pageId="e-class-record"><EClassRecord /></Page></ProtectedRoute>} />

        <Route path="/teacher-forms"
          element={<ProtectedRoute><Page pageId="teacher-forms"><TeacherForms /></Page></ProtectedRoute>} />

        <Route path="/document-requests"
          element={<ProtectedRoute><Page pageId="document-requests"><DocumentRequests /></Page></ProtectedRoute>} />

        <Route path="/grade-change-requests"
          element={<ProtectedRoute><Page pageId="grade-change-requests"><GradeChangeRequests /></Page></ProtectedRoute>} />

        <Route path="/attendance"
          element={<ProtectedRoute><Page pageId="attendance"><Attendance /></Page></ProtectedRoute>} />

        <Route path="/clearance"
          element={<ProtectedRoute><Page pageId="clearance"><Clearance /></Page></ProtectedRoute>} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}