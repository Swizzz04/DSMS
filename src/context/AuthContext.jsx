import { createContext, useContext, useState, useEffect } from 'react'
import { SYSTEM_USERS } from '../config/appConfig'

const AuthContext = createContext()

// Read current users — prefers runtime config saved by Settings page
function getUsers() {
  try {
    const raw = localStorage.getItem('cshc_app_config')
    if (raw) {
      const saved = JSON.parse(raw)
      if (saved.systemUsers?.length) return saved.systemUsers
    }
  } catch {}
  return SYSTEM_USERS
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const storedUser = localStorage.getItem('cshc_user')
    if (storedUser) setUser(JSON.parse(storedUser))
    setLoading(false)
  }, [])

  const login = (email, password) => {
    const users = getUsers()
    const found = users.find(u => u.email === email && u.password === password)
    if (found) {
      const { password: _pw, ...safe } = found
      setUser(safe)
      localStorage.setItem('cshc_user', JSON.stringify(safe))
      return { success: true, user: safe }
    }
    return { success: false, error: 'Invalid email or password' }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('cshc_user')
  }

  const hasPermission = (requiredRole) => {
    if (!user) return false
    if (user.role === 'admin') return true
    return user.role === requiredRole
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, hasPermission, isAuthenticated: !!user, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}