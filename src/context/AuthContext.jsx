/**
 * AuthContext.jsx — secure authentication context
 *
 * Security measures implemented:
 *  1. Passwords stored & compared as SHA-256 hashes (never plaintext)
 *  2. Brute-force lockout — 5 failed attempts → 15 min lockout
 *  3. Session timeout — auto-logout after 60 min of inactivity
 *  4. Only safe user fields stored in localStorage (no passwordHash)
 *  5. Session integrity check on load — malformed data is cleared
 *  6. No sensitive data ever logged to console
 *
 * NOTE: This is a frontend-only implementation for the pre-backend phase.
 * When the API is connected, replace login() with a POST /auth/login call
 * and store a JWT/session token instead of the user object.
 */

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { SYSTEM_USERS } from '../config/appConfig'
import { verifyPassword } from '../utils/crypto'

// ── Constants ────────────────────────────────────────────────────────
const USER_KEY        = 'cshc_user'
const LOCKOUT_KEY     = 'cshc_lockout'
const SESSION_TIMEOUT = 60 * 60 * 1000   // 60 minutes inactivity
const MAX_ATTEMPTS    = 5
const LOCKOUT_DURATION= 15 * 60 * 1000   // 15 minutes

const AuthContext = createContext()

// ── Helpers ──────────────────────────────────────────────────────────
function getUsers() {
  try {
    const raw = localStorage.getItem('cshc_app_config')
    if (raw) {
      const saved = JSON.parse(raw)
      if (Array.isArray(saved.systemUsers) && saved.systemUsers.length)
        return saved.systemUsers
    }
  } catch { /* corrupted config — fall through to defaults */ }
  return SYSTEM_USERS
}

/** Strip all sensitive fields before storing */
function sanitizeUser(user) {
  const { passwordHash, password, ...safe } = user
  return safe
}

/** Validate that a stored session object has expected shape */
function isValidSession(obj) {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.id    === 'number' &&
    typeof obj.email === 'string' &&
    typeof obj.role  === 'string'
  )
}

function getLockoutState(email) {
  try {
    const raw = localStorage.getItem(LOCKOUT_KEY)
    const all = raw ? JSON.parse(raw) : {}
    return all[email] || { attempts: 0, lockedUntil: null }
  } catch { return { attempts: 0, lockedUntil: null } }
}

function setLockoutState(email, state) {
  try {
    const raw = localStorage.getItem(LOCKOUT_KEY)
    const all = raw ? JSON.parse(raw) : {}
    all[email] = state
    localStorage.setItem(LOCKOUT_KEY, JSON.stringify(all))
  } catch {}
}

function clearLockout(email) {
  try {
    const raw = localStorage.getItem(LOCKOUT_KEY)
    const all = raw ? JSON.parse(raw) : {}
    delete all[email]
    localStorage.setItem(LOCKOUT_KEY, JSON.stringify(all))
  } catch {}
}

// ── Provider ─────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [loading, setLoading] = useState(true)
  const timerRef = useRef(null)

  // ── Session timeout ────────────────────────────────────────────────
  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      doLogout(true) // silent auto-logout
    }, SESSION_TIMEOUT)
  }, [])

  const doLogout = (expired = false) => {
    setUser(null)
    localStorage.removeItem(USER_KEY)
    if (timerRef.current) clearTimeout(timerRef.current)
    if (expired) {
      sessionStorage.setItem('cshc_expired', '1')
    }
    // Notify ThemeContext to reset to guest/system theme
    window.dispatchEvent(new CustomEvent('cshc_auth_change'))
  }

  // Track user activity to reset the inactivity timer
  useEffect(() => {
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll']
    const handleActivity = () => { if (user) resetTimer() }
    events.forEach(e => window.addEventListener(e, handleActivity, { passive: true }))
    return () => events.forEach(e => window.removeEventListener(e, handleActivity))
  }, [user, resetTimer])

  // ── Restore session on mount ───────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(USER_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (isValidSession(parsed)) {
          setUser(parsed)
          resetTimer()
        } else {
          // Malformed — clear it
          localStorage.removeItem(USER_KEY)
        }
      }
    } catch {
      localStorage.removeItem(USER_KEY)
    }
    setLoading(false)
  }, [])

  // ── Login ──────────────────────────────────────────────────────────
  const login = async (email, password) => {
    const emailLower = email.trim().toLowerCase()

    // Check lockout
    const lockout = getLockoutState(emailLower)
    if (lockout.lockedUntil && Date.now() < lockout.lockedUntil) {
      const remaining = Math.ceil((lockout.lockedUntil - Date.now()) / 60000)
      return {
        success: false,
        error: `Account temporarily locked. Try again in ${remaining} minute${remaining !== 1 ? 's' : ''}.`,
      }
    }

    const users = getUsers()
    const found = users.find(u => u.email.toLowerCase() === emailLower)

    if (!found) {
      // Don't reveal whether email exists
      return { success: false, error: 'Invalid email or password.' }
    }

    // Verify password against hash
    const valid = await verifyPassword(password, found.passwordHash ?? found.password ?? '')

    if (!valid) {
      const attempts = (lockout.attempts || 0) + 1
      if (attempts >= MAX_ATTEMPTS) {
        setLockoutState(emailLower, { attempts, lockedUntil: Date.now() + LOCKOUT_DURATION })
        return {
          success: false,
          error: `Too many failed attempts. Account locked for 15 minutes.`,
        }
      }
      setLockoutState(emailLower, { attempts, lockedUntil: null })
      const left = MAX_ATTEMPTS - attempts
      return {
        success: false,
        error: `Invalid email or password. ${left} attempt${left !== 1 ? 's' : ''} remaining.`,
      }
    }

    // Success — clear lockout, store safe session
    clearLockout(emailLower)
    sessionStorage.removeItem('cshc_expired')
    const safe = sanitizeUser(found)
    setUser(safe)
    localStorage.setItem(USER_KEY, JSON.stringify(safe))
    resetTimer()
    // Notify ThemeContext to load this user's saved theme preference
    window.dispatchEvent(new CustomEvent('cshc_auth_change'))
    return { success: true, user: safe }
  }

  // ── Logout ─────────────────────────────────────────────────────────
  const logout = () => doLogout(false)

  // ── Permission check ───────────────────────────────────────────────
  const hasPermission = (requiredRole) => {
    if (!user) return false
    if (user.role === 'admin') return true
    return user.role === requiredRole
  }

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      hasPermission,
      isAuthenticated: !!user,
      loading,
    }}>
      {!loading && children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}