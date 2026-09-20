/**
 * App.jsx — ALMIRENE DX Admin Portal
 * Main router and layout shell.
 *
 * Pages are lazy-loaded (React.lazy) rather than imported eagerly at the top
 * of this file. Previously every page — including Settings.jsx (~270KB of
 * source) and Enrollments.jsx (~110KB+) — was statically imported here,
 * meaning just requesting /login forced the bundler to load and transform
 * the entire app's pages first, even though the login screen needs none of
 * them. LoginPage itself stays a normal eager import since it's needed
 * immediately and is small; everything reachable only after logging in is
 * lazy, so its actual JS is only fetched when a user navigates there.
 */

import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth }      from './context/AuthContext'
import DashboardLayout  from './components/dashboard/DashboardLayout'
import ProtectedRoute   from './components/ProtectedRoute'
import LoginPage        from './pages/LoginPage'
import { PageSkeleton }  from './components/UIComponents'

const Dashboard            = lazy(() => import('./pages/Dashboard'))
const Enrollments          = lazy(() => import('./pages/Enrollments'))
const Students             = lazy(() => import('./pages/Students'))
const Payments             = lazy(() => import('./pages/Payments'))
const DocumentRequests     = lazy(() => import('./pages/DocumentRequests'))
const Clearance            = lazy(() => import('./pages/Clearance'))
const Reports              = lazy(() => import('./pages/Reports'))
const SubjectLoad          = lazy(() => import('./pages/SubjectLoad'))
const Eclassrecord         = lazy(() => import('./pages/Eclassrecord'))
const TeacherForms         = lazy(() => import('./pages/TeacherForms'))
const GradeChangeRequests  = lazy(() => import('./pages/GradeChangeRequests'))
const INCCompletion        = lazy(() => import('./pages/INCCompletion'))
const Attendance           = lazy(() => import('./pages/Attendance'))
const Settings             = lazy(() => import('./pages/Settings'))

function Page({ page, children }) {
  return (
    <ProtectedRoute requiredPage={page}>
      <DashboardLayout>
        <Suspense fallback={<PageSkeleton />}>
          {children}
        </Suspense>
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

        <Route path="/dashboard"             element={<Page page="dashboard">            <Dashboard            /></Page>} />
        <Route path="/enrollments"           element={<Page page="enrollments">           <Enrollments          /></Page>} />
        <Route path="/students"              element={<Page page="students">              <Students             /></Page>} />
        <Route path="/payments"              element={<Page page="payments">              <Payments             /></Page>} />
        <Route path="/document-requests"     element={<Page page="document-requests">     <DocumentRequests     /></Page>} />
        <Route path="/clearance"             element={<Page page="clearance">             <Clearance            /></Page>} />
        <Route path="/reports"               element={<Page page="reports">               <Reports              /></Page>} />
        <Route path="/subject-load"          element={<Page page="subject-load">          <SubjectLoad          /></Page>} />
        <Route path="/e-class-record"        element={<Page page="e-class-record">        <Eclassrecord         /></Page>} />
        <Route path="/teacher-forms"         element={<Page page="teacher-forms">         <TeacherForms         /></Page>} />
        <Route path="/grade-change-requests" element={<Page page="grade-change-requests"> <GradeChangeRequests  /></Page>} />
        <Route path="/inc-completion"        element={<Page page="inc-completion">        <INCCompletion        /></Page>} />
        <Route path="/attendance"            element={<Page page="attendance">            <Attendance           /></Page>} />
        <Route path="/settings"              element={<Page page="settings">              <Settings             /></Page>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}