import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import DashboardLayout from './components/dashboard/DashboardLayout'
import Dashboard from './pages/Dashboard'
import ProtectedRoute from './components/ProtectedRoute'
import Enrollments from './pages/Enrollments'
import Students from './pages/Students'
import Reports from './pages/Reports'
import Payments from './pages/Payments'
import Settings from './pages/Settings'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Protected Routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <Dashboard />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/enrollments"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <Enrollments />
              </DashboardLayout>
            </ProtectedRoute>
         }
        />
        <Route
          path="/students"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <Students />
              </DashboardLayout>
            </ProtectedRoute>
         }
        />
        
        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <Reports />
              </DashboardLayout>
            </ProtectedRoute>
         }
        />

        <Route
          path="/payments"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <Payments />
              </DashboardLayout>
            </ProtectedRoute>
         }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <Settings />
              </DashboardLayout>
            </ProtectedRoute>
         }
        />
        
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>

    
    
  )
}

export default App