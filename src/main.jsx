import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'
import { AppConfigProvider } from './context/AppConfigContext'
import { CampusFilterProvider } from './context/CampusFilterContext'
import { initTheme, listenForThemeChanges } from './utils/themeInitializer'

// Apply super admin's brand colors BEFORE React renders
// This prevents a flash of default colors on page load
initTheme()
listenForThemeChanges()

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