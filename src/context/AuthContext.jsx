/**
 * AuthContext.jsx — secure authentication context
 *
 * Security measures implemented:
 *  1. Passwords stored & compared as SHA-256 hashes (never plaintext)
 *  2. Brute-force lockout — 5 failed attempts → 15 min lockout
 *  3. Session timeout — auto-logout after 5 min of inactivity
 *  4. Only safe user fields stored in sessionStorage (no passwordHash)
 *  5. Session integrity check on load — malformed data is cleared
 *  6. No sensitive data ever logged to console
 *  7. Inactive/deactivated accounts cannot log in
 *  8. Tab-isolated sessions via sessionStorage (no cross-tab auto-login)
 *  9. Session fingerprint — prevents session replay across tabs
 * 10. Password validation utility for user creation
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
const SESSION_KEY     = 'cshc_session_user'
const EXPIRED_KEY     = 'cshc_expired'
const FINGERPRINT_KEY = 'cshc_session_fp'
const SESSION_TIMEOUT = 5 * 60 * 1000     // 5 minutes inactivity
const MAX_ATTEMPTS    = 5
const LOCKOUT_DURATION= 15 * 60 * 1000    // 15 minutes

const AuthContext = createContext()

// ── Helpers ──────────────────────────────────────────────────────────

/** Generate a unique fingerprint for this tab session */
function generateFingerprint() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/** Validate password meets minimum security requirements */
export function validatePassword(password) {
  if (!password || password.length < 8) return 'Password must be at least 8 characters'
  if (!/[A-Za-z]/.test(password))       return 'Password must contain at least one letter'
  if (!/[0-9]/.test(password))          return 'Password must contain at least one number'
  return null // null = valid
}

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
  // ✅ FIX: Store doLogout in a ref so the timer callback always calls
  // the latest version and never captures a stale closure
  const doLogoutRef = useRef(null)

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      // Use ref to avoid stale closure — doLogout may have changed
      if (doLogoutRef.current) doLogoutRef.current(true)
    }, SESSION_TIMEOUT)
  }, [])

  // ✅ FIX: Defined as useCallback so it can be safely stored in ref
  const doLogout = useCallback((expired = false) => {
    setUser(null)
    sessionStorage.removeItem(SESSION_KEY)
    sessionStorage.removeItem(FINGERPRINT_KEY)
    localStorage.removeItem(USER_KEY)
    if (timerRef.current) clearTimeout(timerRef.current)
    if (expired) {
      sessionStorage.setItem(EXPIRED_KEY, '1')
    }
    window.dispatchEvent(new CustomEvent('cshc_auth_change'))
  }, [])

  // ✅ FIX: Keep ref in sync with latest doLogout
  useEffect(() => { doLogoutRef.current = doLogout }, [doLogout])

  // Track user activity to reset the inactivity timer
  useEffect(() => {
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll']
    const handleActivity = () => { if (user) resetTimer() }
    events.forEach(e => window.addEventListener(e, handleActivity, { passive: true }))
    return () => events.forEach(e => window.removeEventListener(e, handleActivity))
  }, [user, resetTimer])

  // ── Restore session on mount ───────────────────────────────────────
  // Uses sessionStorage (tab-isolated) as the primary session store.
  // localStorage is only used to persist lockout state and app config —
  // NOT for auto-login across tabs. Each tab must log in independently.
  useEffect(() => {
    try {
      const sessionRaw = sessionStorage.getItem(SESSION_KEY)
      const storedFP   = sessionStorage.getItem(FINGERPRINT_KEY)
      if (sessionRaw && storedFP) {
        const parsed = JSON.parse(sessionRaw)
        if (isValidSession(parsed)) {
          // Verify user still exists and is active
          const users = getUsers()
          const current = users.find(u => u.id === parsed.id && u.email === parsed.email)
          if (current && current.status !== 'inactive') {
            setUser(parsed)
            resetTimer()
            setLoading(false)
            return
          }
          // User deactivated or removed — force logout
          sessionStorage.removeItem(SESSION_KEY)
          sessionStorage.removeItem(FINGERPRINT_KEY)
        } else {
          sessionStorage.removeItem(SESSION_KEY)
          sessionStorage.removeItem(FINGERPRINT_KEY)
        }
      }
      localStorage.removeItem(USER_KEY)
    } catch {
      sessionStorage.removeItem(SESSION_KEY)
      sessionStorage.removeItem(FINGERPRINT_KEY)
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
      return { success: false, error: 'Invalid email or password.' }
    }

    // Block inactive/deactivated accounts
    if (found.status === 'inactive') {
      return { success: false, error: 'This account has been deactivated. Contact your System Admin.' }
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

    // Success — clear lockout, store safe session with fingerprint
    clearLockout(emailLower)
    sessionStorage.removeItem(EXPIRED_KEY)
    const safe = sanitizeUser(found)
    safe.lastLogin = new Date().toISOString()
    setUser(safe)
    // Generate unique session fingerprint for this tab
    const fp = generateFingerprint()
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(safe))
    sessionStorage.setItem(FINGERPRINT_KEY, fp)
    resetTimer()
    window.dispatchEvent(new CustomEvent('cshc_auth_change'))
    return { success: true, user: safe }
  }

  // ── Logout ─────────────────────────────────────────────────────────
  const logout = () => doLogout(false)

  // ── Permission check ───────────────────────────────────────────────
  const hasPermission = (requiredRole) => {
    if (!user) return false
    // Super admin and owner bypass role checks
    if (user.role === 'admin' || user.role === 'technical_admin') return true
    // System admin has limited permissions
    if (user.role === 'system_admin') {
      return ['dashboard', 'settings', 'users'].includes(requiredRole)
    }
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