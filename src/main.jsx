import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'
import { AppConfigProvider } from './context/AppConfigContext'
import { CampusFilterProvider } from './context/CampusFilterContext'
import { initTheme, listenForThemeChanges, migrateLocalStorageKeys } from './utils/themeInitializer'
import { exposeDevTools } from './utils/devTools'

// Migrate localStorage keys from cshc_* to almirene_* (one-time, idempotent)
migrateLocalStorageKeys()

// Apply super admin's brand colors BEFORE React renders
// This prevents a flash of default colors on page load
initTheme()
listenForThemeChanges()

// Dev-only: window.almireneReset() to clear stale local config back to
// source-code defaults. import.meta.env.DEV is false in a production
// build, so this is guaranteed to never reach a real client's browser.
if (import.meta.env.DEV) {
  exposeDevTools()
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <AppConfigProvider>
        <AuthProvider>
          <CampusFilterProvider>
           <App />
          </CampusFilterProvider>
        </AuthProvider>
      </AppConfigProvider>
    </ThemeProvider>
  </StrictMode>,
)