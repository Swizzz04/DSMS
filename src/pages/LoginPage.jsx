import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Login from '../components/Login'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, isAuthenticated } = useAuth()
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  // Show session-expired message if auto-logout occurred
  useEffect(() => {
    if (sessionStorage.getItem('cshc_expired')) {
      setError('Your session has expired. Please sign in again.')
      sessionStorage.removeItem('cshc_expired')
    }
  }, [])

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true })
  }, [isAuthenticated, navigate])

  const handleLoginSuccess = async (email, password) => {
    setError('')
    setLoading(true)
    const result = await login(email, password)
    setLoading(false)
    if (!result.success) setError(result.error)
    // on success, useEffect above handles redirect
  }

  if (isAuthenticated) return null

  return (
    <Login
      onLoginSuccess={handleLoginSuccess}
      error={error}
      loading={loading}
    />
  )
}