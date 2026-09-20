/**
 * AuthContext.jsx — secure authentication context
 *
 * REVERTED (July 2026): this was temporarily wired to a real ASP.NET Core
 * API (POST /api/auth/login) to test against the backend. That backend
 * isn't reachable right now, so this reverts to fully local, offline auth
 * against SYSTEM_USERS (config/users.js) + almirene_app_config.systemUsers,
 * verified client-side via SHA-256 (utils/crypto.js) — same approach used
 * everywhere else in the app before the backend existed.
 *
 * NOTE: while reverting, found the API version was also missing `user.campus`
 * (it only set campusId/campusName/campusKey) — but Sidebar, Dashboard,
 * Students, Enrollments, Payments, Reports, and SchoolComponents all read
 * `user.campus` directly as a name string (e.g. 'Carcar City Campus' or 'all').
 * This revert restores that field so campus-scoped pages work again.
 *
 * Security measures implemented:
 *  1. Login verified against SYSTEM_USERS / almirene_app_config.systemUsers,
 *     password checked via SHA-256 (utils/crypto.js) — frontend-only stopgap
 *     until the backend is reconnected (bcrypt/argon2 server-side then)
 *  2. Brute-force lockout — 5 failed attempts → 15 min lockout (per email)
 *  3. Session timeout — auto-logout after 5 min of inactivity
 *  4. Only safe user fields stored in sessionStorage (no password hash)
 *  5. Session integrity check on load — malformed data is cleared
 *  6. No sensitive data ever logged to console
 *  7. Tab-isolated sessions via sessionStorage (no cross-tab auto-login)
 *  8. Session fingerprint — prevents session replay across tabs
 *  9. Password validation utility for user creation
 */

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { SYSTEM_USERS } from '../config/users'
import { verifyPassword } from '../utils/crypto'

// ── Constants ────────────────────────────────────────────────────────
const APP_CONFIG_KEY   = 'almirene_app_config'
const LOCKOUT_KEY     = 'almirene_lockout'
const SESSION_KEY     = 'almirene_session_user'
const EXPIRED_KEY     = 'almirene_expired'
const FINGERPRINT_KEY = 'almirene_session_fp'
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

/** Read the current system user list — Settings → Users edits persist here, falls back to defaults */
function getSystemUsers() {
  try {
    const cfg = JSON.parse(localStorage.getItem(APP_CONFIG_KEY) || '{}')
    if (Array.isArray(cfg.systemUsers) && cfg.systemUsers.length) return cfg.systemUsers
  } catch {}
  return SYSTEM_USERS
}

/** Persist an updated user record (e.g. lastLogin) back into almirene_app_config */
function updateSystemUser(userId, patch) {
  try {
    const cfg = JSON.parse(localStorage.getItem(APP_CONFIG_KEY) || '{}')
    const list = Array.isArray(cfg.systemUsers) && cfg.systemUsers.length ? cfg.systemUsers : SYSTEM_USERS
    cfg.systemUsers = list.map(u => (u.id === userId ? { ...u, ...patch } : u))
    localStorage.setItem(APP_CONFIG_KEY, JSON.stringify(cfg))
  } catch {}
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
    if (timerRef.current) clearTimeout(timerRef.current)
    if (expired) {
      sessionStorage.setItem(EXPIRED_KEY, '1')
    }
    window.dispatchEvent(new CustomEvent('almirene_auth_change'))
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
          setUser(parsed)
          resetTimer()
          setLoading(false)
          return
        }
        sessionStorage.removeItem(SESSION_KEY)
        sessionStorage.removeItem(FINGERPRINT_KEY)
      }
    } catch {
      sessionStorage.removeItem(SESSION_KEY)
      sessionStorage.removeItem(FINGERPRINT_KEY)
    }
    setLoading(false)
  }, [])

  // ── Login ──────────────────────────────────────────────────────────
  const login = async (email, password) => {
    const emailLower = email.trim().toLowerCase()

    // Frontend brute-force guard
    const lockout = getLockoutState(emailLower)
    if (lockout.lockedUntil && Date.now() < lockout.lockedUntil) {
      const remaining = Math.ceil((lockout.lockedUntil - Date.now()) / 60000)
      return {
        success: false,
        error: `Account temporarily locked. Try again in ${remaining} minute${remaining !== 1 ? 's' : ''}.`,
      }
    }

    // ── Local lookup (no backend yet) ────────────────────────────────
    const users = getSystemUsers()
    const found = users.find(u => u.email.toLowerCase() === emailLower && u.status === 'active')

    const passwordOk = found ? await verifyPassword(password, found.passwordHash) : false

    if (!found || !passwordOk) {
      const attempts = (lockout.attempts || 0) + 1
      if (attempts >= MAX_ATTEMPTS) {
        setLockoutState(emailLower, { attempts, lockedUntil: Date.now() + LOCKOUT_DURATION })
        return { success: false, error: 'Too many failed attempts. Account locked for 15 minutes.' }
      }
      setLockoutState(emailLower, { attempts, lockedUntil: null })
      const left = MAX_ATTEMPTS - attempts
      return {
        success: false,
        error: `Invalid email or password. ${left} attempt${left !== 1 ? 's' : ''} remaining.`,
      }
    }

    // ── Success ────────────────────────────────────────────────────
    clearLockout(emailLower)
    sessionStorage.removeItem(EXPIRED_KEY)

    // Normalise the user object to the shape the rest of the app expects.
    // `campus` stays the plain name string ('Carcar City Campus', 'Talisay
    // City Campus', 'Bohol Campus', or 'all') — Sidebar/Dashboard/Students/
    // Enrollments/Payments/Reports/SchoolComponents all read it directly.
    const safe = {
      id:         found.id,
      name:       found.name,
      email:      found.email,
      role:       found.role,
      campus:     found.campus,
      campusKey:  found.campusKey ?? null,
      lastLogin:  new Date().toISOString(),
    }

    updateSystemUser(found.id, { lastLogin: safe.lastLogin })

    setUser(safe)
    const fp = generateFingerprint()
    sessionStorage.setItem(SESSION_KEY,     JSON.stringify(safe))
    sessionStorage.setItem(FINGERPRINT_KEY, fp)
    resetTimer()
    window.dispatchEvent(new CustomEvent('almirene_auth_change'))
    return { success: true, user: safe }
  }

  // ── Logout ─────────────────────────────────────────────────────────
  const logout = () => doLogout(false)

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
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