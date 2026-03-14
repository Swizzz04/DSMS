import { createContext, useContext, useEffect, useState, useCallback } from 'react'

const ThemeContext = createContext()

// Get the theme storage key scoped to the current logged-in user.
// Falls back to 'guest' if no session exists yet (login page).
function getThemeKey() {
  try {
    const raw = localStorage.getItem('cshc_user')
    if (raw) {
      const user = JSON.parse(raw)
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

  // Cross-tab: if another tab logs in/out, sync theme
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'cshc_user') refreshUserTheme()
    }
    // Same-tab: fired by AuthContext right after login/logout
    const onAuthChange = () => refreshUserTheme()
    window.addEventListener('storage', onStorage)
    window.addEventListener('cshc_auth_change', onAuthChange)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('cshc_auth_change', onAuthChange)
    }
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