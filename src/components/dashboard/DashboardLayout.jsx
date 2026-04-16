import { useState } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'

export default function DashboardLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen)
  }

  return (
    <div className="flex h-dvh overflow-hidden" style={{ backgroundColor: 'var(--color-bg-subtle)' }}>

      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0">

        {/* Header — sits above page content, below modals */}
        <div className="relative z-50 flex-shrink-0">
          <Header toggleSidebar={toggleSidebar} />
        </div>

        {/* Page Content - Scrollable — isolated scroll context, does NOT trap fixed children */}
        <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 sm:p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}