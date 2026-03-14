import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'
import { AppConfigProvider } from './context/AppConfigContext'
import { CampusFilterProvider } from './context/CampusFilterContext'

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