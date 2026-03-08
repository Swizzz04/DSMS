import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Login from '../components/Login'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, isAuthenticated } = useAuth()
  const [error, setError] = useState('')

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true })
    }
  }, [isAuthenticated, navigate])

  const handleLoginSuccess = (email, password) => {
    setError('')
    
    const result = login(email, password)
    
    if (result.success) {
      console.log('Login successful!', result.user)
      // Navigation will happen automatically via useEffect
    } else {
      setError(result.error)
    }
  }

  // Don't render login if already authenticated
  if (isAuthenticated) {
    return null
  }

  return (
    <Login 
      onLoginSuccess={handleLoginSuccess}
      error={error}
    />
  )
}