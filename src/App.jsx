/**
 * App.jsx — ALMIRENE DX Admin Portal
 * Main router and layout shell.
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth }      from './context/AuthContext'
import DashboardLayout  from './components/dashboard/DashboardLayout'
import ProtectedRoute   from './components/ProtectedRoute'
import LoginPage        from './pages/LoginPage'
import Dashboard        from './pages/Dashboard'
import Enrollments      from './pages/Enrollments'
import Students         from './pages/Students'
import Payments         from './pages/Payments'
import DocumentRequests from './pages/DocumentRequests'
import Clearance        from './pages/Clearance'
import Reports          from './pages/Reports'
import SubjectLoad      from './pages/SubjectLoad'
import Eclassrecord     from './pages/Eclassrecord'
import TeacherForms     from './pages/TeacherForms'
import GradeChangeRequests from './pages/GradeChangeRequests'
import Attendance       from './pages/Attendance'
import Settings         from './pages/Settings'

function Page({ children }) {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        {children}
      </DashboardLayout>
    </ProtectedRoute>
  )
}

function RootRedirect() {
  const { isAuthenticated } = useAuth()
  return isAuthenticated
    ? <Navigate to="/dashboard" replace />
    : <Navigate to="/login"     replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/"      element={<RootRedirect />} />

        <Route path="/dashboard"             element={<Page><Dashboard            /></Page>} />
        <Route path="/enrollments"           element={<Page><Enrollments          /></Page>} />
        <Route path="/students"              element={<Page><Students             /></Page>} />
        <Route path="/payments"              element={<Page><Payments             /></Page>} />
        <Route path="/document-requests"     element={<Page><DocumentRequests     /></Page>} />
        <Route path="/clearance"             element={<Page><Clearance            /></Page>} />
        <Route path="/reports"               element={<Page><Reports              /></Page>} />
        <Route path="/subject-load"          element={<Page><SubjectLoad          /></Page>} />
        <Route path="/e-class-record"        element={<Page><Eclassrecord         /></Page>} />
        <Route path="/teacher-forms"         element={<Page><TeacherForms         /></Page>} />
        <Route path="/grade-change-requests" element={<Page><GradeChangeRequests  /></Page>} />
        <Route path="/attendance"            element={<Page><Attendance           /></Page>} />
        <Route path="/settings"              element={<Page><Settings             /></Page>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}