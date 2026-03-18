import { createContext, useContext, useEffect, useState, useCallback } from 'react'

const ThemeContext = createContext()

// Get the theme storage key scoped to the current logged-in user.
// Uses sessionStorage for the active user (tab-specific) so that
// multiple users logged in on different tabs don't interfere with
// each other's theme preference.
// Theme preferences themselves are still stored in localStorage
// (keyed by user ID) so they persist across sessions.
function getThemeKey() {
  try {
    // sessionStorage is tab-isolated — each tab has its own user
    const raw = sessionStorage.getItem('cshc_session_user')
    if (raw) {
      const user = JSON.parse(raw)
      if (user?.id) return `cshc_theme_${user.id}`
    }
    // Fallback: try localStorage for single-tab usage
    const lsRaw = localStorage.getItem('cshc_user')
    if (lsRaw) {
      const user = JSON.parse(lsRaw)
      if (user?.id) return `cshc_theme_${user.id}`
    }
  } catch {}
  return 'cshc_theme_guest'
}

function resolveInitialTheme(key) {
  try {
    const saved = localStorage.getItem(key)
    if (saved === 'dark' || saved === 'light') return saved
  } catch {}
  // No saved pref — fall back to system preference
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

export function ThemeProvider({ children }) {
  const [themeKey, setThemeKey] = useState(() => getThemeKey())
  const [theme, setTheme] = useState(() => {
    const key = getThemeKey()
    const t = resolveInitialTheme(key)
    applyTheme(t)
    return t
  })

  // When the user logs in or out, the cshc_user key changes.
  // We listen for storage events AND expose a refresh function
  // so AuthContext can call it right after login/logout.
  const refreshUserTheme = useCallback(() => {
    const key = getThemeKey()
    setThemeKey(key)
    const t = resolveInitialTheme(key)
    setTheme(t)
    applyTheme(t)
  }, [])

  // Same-tab only: AuthContext fires 'cshc_auth_change' after login/logout
  // We intentionally do NOT listen to the 'storage' event for cshc_user
  // because that would cause one tab's login to change another tab's theme.
  useEffect(() => {
    const onAuthChange = () => refreshUserTheme()
    window.addEventListener('cshc_auth_change', onAuthChange)
    return () => window.removeEventListener('cshc_auth_change', onAuthChange)
  }, [refreshUserTheme])

  // Apply theme to DOM whenever it changes
  useEffect(() => {
    applyTheme(theme)
    try {
      localStorage.setItem(themeKey, theme)
    } catch {}
  }, [theme, themeKey])

  const toggleTheme = useCallback(() => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'))
  }, [])

  const setThemeMode = useCallback((mode) => {
    if (mode === 'light' || mode === 'dark') setTheme(mode)
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setThemeMode, refreshUserTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}