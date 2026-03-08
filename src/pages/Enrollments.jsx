import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Search, FileText, CheckCircle, XCircle, Clock, Eye, Download, User, ChevronDown } from 'lucide-react'
import { mockEnrollments } from '../data/mockEnrollments'
import { useAuth } from '../context/AuthContext'
import { exportToExcel } from '../utils/exportToExcel'
import { useLocation } from 'react-router-dom'
import { useToast, ToastContainer, ConfirmDialog } from '../components/UIComponents'
import { useAppConfig } from '../context/AppConfigContext'

// ── Mobile-friendly grouped select ───────────────────
function GradeLevelSelect({ value, onChange, campusFilter, userRole, campusProgramsMap, basicEdGroups }) {
  const [open, setOpen] = useState(false)
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 })
  const triggerRef = useRef(null)
  const panelRef = useRef(null)

  // College options based on campus — from live config
  const collegePrograms = campusFilter === 'all'
    ? [...new Set(Object.values(campusProgramsMap || {}).flat())]
    : (campusProgramsMap?.[campusFilter] || [])
  const uniqueCollege = [...new Set(collegePrograms)]

  const isBasicOnly   = userRole === 'registrar_basic'
  const isCollegeOnly = userRole === 'registrar_college'

  const groups = [
    ...(!isCollegeOnly ? (basicEdGroups || []) : []),
    ...(!isBasicOnly && uniqueCollege.length > 0 ? [{
      label: campusFilter === 'all' ? 'College (All Campuses)' : `College (${campusFilter})`,
      options: uniqueCollege,
    }] : []),
  ]

  const selectedLabel = value === 'all' ? 'All Grades' : value

  // Position the portal panel relative to the trigger button
  const openDropdown = () => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const panelHeight = 256 // max-h-64

    // If not enough space below, flip upward
    if (spaceBelow < panelHeight && rect.top > panelHeight) {
      setDropPos({
        bottom: window.innerHeight - rect.top + 4,
        top: 'auto',
        left: rect.left + window.scrollX,
        width: rect.width,
        flip: true,
      })
    } else {
      setDropPos({
        top: rect.bottom + window.scrollY + 4,
        bottom: 'auto',
        left: rect.left + window.scrollX,
        width: rect.width,
        flip: false,
      })
    }
    setOpen(true)
  }

  // Close on outside click or scroll
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        panelRef.current && !panelRef.current.contains(e.target)
      ) setOpen(false)
    }
    const scrollHandler = (e) => {
      // Don't close if the scroll happened inside the dropdown panel itself
      if (panelRef.current && panelRef.current.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('scroll', scrollHandler, true)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('scroll', scrollHandler, true)
    }
  }, [open])

  const handleSelect = (val) => { onChange(val); setOpen(false) }

  const panelContent = (
    <div
      ref={panelRef}
      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl max-h-64 overflow-y-auto"
      style={{
        position: 'fixed',
        top: dropPos.flip ? 'auto' : dropPos.top,
        bottom: dropPos.flip ? dropPos.bottom : 'auto',
        left: dropPos.left,
        width: dropPos.width,
        zIndex: 99999,
      }}
    >
      <button
        type="button"
        onClick={() => handleSelect('all')}
        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors
          ${value === 'all' ? 'text-primary font-semibold bg-primary/5 dark:bg-primary/20' : 'text-gray-700 dark:text-gray-300'}`}
      >
        All Grades
      </button>

      {groups.map((group) => (
        <div key={group.label}>
          <div className="px-3 pt-2 pb-1 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
            {group.label}
          </div>
          {group.options.map((opt) => (
            <button
              type="button"
              key={opt}
              onClick={() => handleSelect(opt)}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors
                ${value === opt ? 'text-primary font-semibold bg-primary/5 dark:bg-primary/20' : 'text-gray-700 dark:text-gray-300'}`}
            >
              {opt}
            </button>
          ))}
        </div>
      ))}

      {campusFilter !== 'all' && (campusProgramsMap?.[campusFilter] || []).length === 0 && (
        <div className="px-4 py-2 text-xs text-gray-400 dark:text-gray-500 italic border-t border-gray-100 dark:border-gray-700">
          No college programs at this campus
        </div>
      )}
    </div>
  )

  return (
    <div ref={triggerRef}>
      <button
        type="button"
        onClick={openDropdown}
        className={`w-full flex items-center justify-between px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white text-sm transition-all
          ${open ? 'border-primary ring-2 ring-primary' : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'}`}
      >
        <span className={value === 'all' ? 'text-gray-400' : ''}>{selectedLabel}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ml-2 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && createPortal(panelContent, document.body)}
    </div>
  )
}

export default function Enrollments() {
  const { user } = useAuth()
  const { activeCampuses, campusProgramsMap, basicEdGroups, currentSchoolYear } = useAppConfig()
  const location = useLocation()
  const { toasts, addToast, removeToast } = useToast()
  const [enrollments, setEnrollments] = useState(mockEnrollments)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [campusFilter, setCampusFilter] = useState('all')
  const [timeFilter, setTimeFilter] = useState('all')
  const [gradeLevelFilter, setGradeLevelFilter] = useState('all')
  const [selectedEnrollment, setSelectedEnrollment] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [confirm, setConfirm] = useState({ open: false, type: null, id: null })
  const [actionLoading, setActionLoading] = useState(false)

  // Auto-reset grade filter when campus changes and selected grade isn't available there
  const handleCampusChange = (campus) => {
    setCampusFilter(campus)
    if (campus !== 'all' && gradeLevelFilter !== 'all') {
      const basicEd = basicEdGroups.flatMap(g => g.options)
      const college = campusProgramsMap[campus] || []
      const available = [
        ...(user?.role !== 'registrar_college' ? basicEd : []),
        ...(user?.role !== 'registrar_basic'   ? college  : []),
      ]
      if (!available.includes(gradeLevelFilter)) setGradeLevelFilter('all')
    }
  }
  useEffect(() => {
    if (location.state?.openEnrollment) {
      setSelectedEnrollment(location.state.openEnrollment)
      setShowModal(true)
      window.history.replaceState({}, '')
    }
  }, [location.state])

  const roleFilteredEnrollments = enrollments.filter(enrollment => {
    // admin sees everything.
    if (user?.role === 'admin') return true

    //Basic ed Registrar sees Pre-Elem, Elementary, JHS, SHS (Grade 7-12)
    if (user?.role === 'registrar_basic') {
      const gradeLevel = enrollment.enrollment.gradeLevel
      return gradeLevel.includes('Grade') ||
             gradeLevel.includes('Nursery') ||
             gradeLevel.includes('Kindergarten') ||
             gradeLevel.includes('Preparatory')
    }

    //College Registrar sees only college programs
    if (user?.role === 'registrar_college') {
      const gradeLevel = enrollment.enrollment.gradeLevel
      return gradeLevel.includes('BS') || gradeLevel.includes('Year')
    }

    //Accounting shouldn't see enrollments only payment
    if (user?.role === 'accounting') return false

    return true
  })

  // Enhanced Filter enrollments
  const filteredEnrollments = roleFilteredEnrollments.filter(enrollment => {
  const matchesSearch = 
    enrollment.student.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    enrollment.student.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    enrollment.referenceNumber.toLowerCase().includes(searchQuery.toLowerCase())

  const matchesStatus = statusFilter === 'all' || enrollment.status === statusFilter
  const matchesCampus = campusFilter === 'all' || enrollment.enrollment.campus.includes(campusFilter)
  const matchesGradeLevel = gradeLevelFilter === 'all' || enrollment.enrollment.gradeLevel.includes(gradeLevelFilter)

  // Time filter logic
  let matchesTime = true
  if (timeFilter !== 'all') {
    const submittedDate = new Date(enrollment.submittedDate)
    const now = new Date()

    if (timeFilter === 'today') {
      matchesTime = submittedDate.toDateString() === now.toDateString()
    } else if (timeFilter === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      matchesTime = submittedDate >= weekAgo
    } else if (timeFilter === 'month') {
      matchesTime = submittedDate.getMonth() === now.getMonth() && 
                    submittedDate.getFullYear() === now.getFullYear()
    }
  }

  return matchesSearch && matchesStatus && matchesCampus && matchesGradeLevel && matchesTime
})

  // Status badge component
  const StatusBadge = ({ status }) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
    }

    const icons = {
      pending: <Clock className="w-3 h-3" />,
      approved: <CheckCircle className="w-3 h-3" />,
      rejected: <XCircle className="w-3 h-3" />
    }

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {icons[status]}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Handle actions — opens confirm dialog first
  const handleApprove = (id) => setConfirm({ open: true, type: 'approve', id })
  const handleReject  = (id) => setConfirm({ open: true, type: 'reject',  id })

  const confirmAction = () => {
    setActionLoading(true)
    setTimeout(() => {
      const newStatus = confirm.type === 'approve' ? 'approved' : 'rejected'
      setEnrollments(prev => prev.map(e => e.id === confirm.id ? { ...e, status: newStatus } : e))
      // Update modal if it's showing the same enrollment
      if (selectedEnrollment?.id === confirm.id) {
        setSelectedEnrollment(prev => ({ ...prev, status: newStatus }))
      }
      addToast(
        confirm.type === 'approve' ? 'Enrollment approved successfully!' : 'Enrollment rejected.',
        confirm.type === 'approve' ? 'success' : 'warning'
      )
      setActionLoading(false)
      setConfirm({ open: false, type: null, id: null })
    }, 600)
  }

  const handleViewDetails = (enrollment) => {
    setSelectedEnrollment(enrollment)
    setShowModal(true)
  }

  const handleExportEnrollments = () => {
  const exportData = filteredEnrollments.map(enrollment => ({
    'Reference Number': enrollment.referenceNumber,
    'Student Name': `${enrollment.student.firstName} ${enrollment.student.lastName}`,
    'Email': enrollment.student.email,
    'Contact Number': enrollment.student.contactNumber,
    'Campus': enrollment.enrollment.campus,
    'Grade Level': enrollment.enrollment.gradeLevel,
    'Student Type': enrollment.enrollment.studentType,
    'School Year': enrollment.enrollment.schoolYear,
    'Status': enrollment.status.toUpperCase(),
    'Submitted Date': new Date(enrollment.submittedDate).toLocaleString(),
    'Father Name': enrollment.father.name,
    'Father Contact': enrollment.father.contactNumber,
    'Mother Name': enrollment.mother.name,
    'Mother Contact': enrollment.mother.contactNumber,
    'Previous School': enrollment.previousSchool.name,
    'Address': enrollment.student.address
  }))
  
  const timestamp = new Date().toISOString().split('T')[0]
  const filename = `Enrollments_${campusFilter !== 'all' ? campusFilter + '_' : ''}${timestamp}`
  
  exportToExcel(exportData, filename, 'Enrollments')
  addToast(`Exported ${exportData.length} enrollment records to Excel!`, 'success')
}


  // Stats
  const stats = {
    total: filteredEnrollments.length,
    pending: filteredEnrollments.filter(e => e.status === 'pending').length,
    approved: filteredEnrollments.filter(e => e.status === 'approved').length,
    rejected: filteredEnrollments.filter(e => e.status === 'rejected').length
  }

  return (
    <div className="">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">
          Enrollments
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Review and manage student enrollment applications
        </p>
      </div>

      {/* Active Filters Badge - Enhanced */}
{(statusFilter !== 'all' || campusFilter !== 'all' || timeFilter !== 'all' || gradeLevelFilter !== 'all' || searchQuery) && (
  <div className="mb-4 flex items-center gap-2 flex-wrap">
    <span className="text-sm text-gray-600 dark:text-gray-400 font-semibold">Active filters:</span>

    {campusFilter !== 'all' && (
      <span className="px-3 py-1 bg-light-cream/10 dark:bg-dirty-white/10 text-primary dark:text-off-white rounded-full text-sm font-medium flex items-center gap-2">
        📍 {campusFilter}
        <button
          onClick={() => setCampusFilter('all')}
          className="hover:text-accent-burgundy font-bold"
        >
          ×
        </button>
      </span>
    )}

    {statusFilter !== 'all' && (
      <span className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 rounded-full text-sm font-medium flex items-center gap-2 capitalize">
        📊 {statusFilter}
        <button
          onClick={() => setStatusFilter('all')}
          className="hover:text-yellow-900 dark:hover:text-yellow-300 font-bold"
        >
          ×
        </button>
      </span>
    )}

    {timeFilter !== 'all' && (
      <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 rounded-full text-sm font-medium flex items-center gap-2 capitalize">
        📅 {timeFilter === 'today' ? 'Today' : timeFilter === 'week' ? 'This Week' : 'This Month'}
        <button
          onClick={() => setTimeFilter('all')}
          className="hover:text-blue-900 dark:hover:text-blue-300 font-bold"
        >
          ×
        </button>
      </span>
    )}

    {gradeLevelFilter !== 'all' && (
      <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 rounded-full text-sm font-medium flex items-center gap-2">
        🎓 {gradeLevelFilter}
        <button
          onClick={() => setGradeLevelFilter('all')}
          className="hover:text-green-900 dark:hover:text-green-300 font-bold"
        >
          ×
        </button>
      </span>
    )}

    {searchQuery && (
      <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400 rounded-full text-sm font-medium flex items-center gap-2">
        🔍 "{searchQuery}"
        <button
          onClick={() => setSearchQuery('')}
          className="hover:text-purple-900 dark:hover:text-purple-300 font-bold"
        >
          ×
        </button>
      </span>
    )}

    <button
      onClick={() => {
        setSearchQuery('')
        setStatusFilter('all')
        setCampusFilter('all')
        setTimeFilter('all')
        setGradeLevelFilter('all')
      }}
      className="px-3 py-1 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-full text-sm font-medium hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
    >
      Clear all filters
    </button>
  </div>
)}

      {/* Stats Cards - Enhanced with Percentages */}
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">

  {/* Total Enrollments */}
  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border-l-4 border-primary shadow-lg">
    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Enrollments</p>
    <p className="text-2xl font-bold text-gray-800 dark:text-white">{stats.total}</p>
    <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
      {campusFilter !== 'all' ? `${campusFilter} Campus` : 'All Campuses'}
      {timeFilter !== 'all' && (
        <> • {timeFilter === 'today' ? 'Today' : timeFilter === 'week' ? 'This Week' : 'This Month'}</>
      )}
    </p>
  </div>

  {/* Pending Review */}
  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border-l-4 border-yellow-500 shadow-lg">
    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Pending Review</p>
    <p className="text-2xl font-bold text-gray-800 dark:text-white">{stats.pending}</p>

    {/* Progress Bar */}
    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-3 mb-2">
      <div 
        className="bg-yellow-500 h-1.5 rounded-full transition-all duration-500"
        style={{ width: `${stats.total > 0 ? (stats.pending / stats.total) * 100 : 0}%` }}
      ></div>
    </div>

    <p className="text-xs text-yellow-600 dark:text-yellow-400">
      {stats.total > 0 ? Math.round((stats.pending / stats.total) * 100) : 0}% of total • Needs attention
    </p>
  </div>

  {/* Approved */}
  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border-l-4 border-green-500 shadow-lg">
    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Approved</p>
    <p className="text-2xl font-bold text-gray-800 dark:text-white">{stats.approved}</p>

    {/* Progress Bar */}
    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-3 mb-2">
      <div 
        className="bg-green-500 h-1.5 rounded-full transition-all duration-500"
        style={{ width: `${stats.total > 0 ? (stats.approved / stats.total) * 100 : 0}%` }}
      ></div>
    </div>

    <p className="text-xs text-green-600 dark:text-green-400">
      {stats.total > 0 ? Math.round((stats.approved / stats.total) * 100) : 0}% approval rate
    </p>
  </div>

  {/* Rejected */}
  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border-l-4 border-red-500 shadow-lg">
    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Rejected</p>
    <p className="text-2xl font-bold text-gray-800 dark:text-white">{stats.rejected}</p>

    {/* Progress Bar */}
    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-3 mb-2">
      <div 
        className="bg-red-500 h-1.5 rounded-full transition-all duration-500"
        style={{ width: `${stats.total > 0 ? (stats.rejected / stats.total) * 100 : 0}%` }}
      ></div>
    </div>

    <p className="text-xs text-red-600 dark:text-red-400">
      {stats.total > 0 ? Math.round((stats.rejected / stats.total) * 100) : 0}% rejection rate
    </p>
  </div>
</div>

      {/* Enhanced Filters */}
<div className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-6 shadow-lg">
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">

    {/* Search - Takes 2 columns on large screens */}
    <div className="lg:col-span-2">
      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
        Search
      </label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Name or reference number..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
        />
      </div>
    </div>

    {/* Status Filter */}
    <div>
      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
        Status
      </label>
      <select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-primary outline-none"
      >
        <option value="all">All Status</option>
        <option value="pending">Pending</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
      </select>
    </div>

    {/* Campus Filter */}
    <div>
      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
        Campus
      </label>
      <select
        value={campusFilter}
        onChange={(e) => handleCampusChange(e.target.value)}
        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-primary outline-none"
      >
        <option value="all">All Campuses</option>
        {activeCampuses.map(c => (
          <option key={c.key} value={c.key}>{c.name}</option>
        ))}
      </select>
    </div>

    {/* Time Filter - NEW! */}
    <div>
      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
        Time Period
      </label>
      <select
        value={timeFilter}
        onChange={(e) => setTimeFilter(e.target.value)}
        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-primary outline-none"
      >
        <option value="all">All Time</option>
        <option value="today">Today</option>
        <option value="week">This Week</option>
        <option value="month">This Month</option>
      </select>
    </div>

    {/* Grade Level Filter — dynamic per campus, mobile-friendly */}
    <div>
      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
        Grade Level
      </label>
      <GradeLevelSelect
        value={gradeLevelFilter}
        onChange={setGradeLevelFilter}
        campusFilter={campusFilter}
        userRole={user?.role}
        campusProgramsMap={campusProgramsMap}
        basicEdGroups={basicEdGroups}
      />
    </div>
  </div>

  {/* Export Button Row */}
  <div className="mt-4 flex justify-end">
    <button 
      onClick={handleExportEnrollments}
      className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-accent-burgundy transition-colors flex items-center gap-2"
    >
      <Download className="w-4 h-4" />
      Export Filtered Results
    </button>
  </div>
</div>

      {/* Enrollments Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Reference
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Student Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Campus
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Grade Level
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Date Submitted
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredEnrollments.map((enrollment) => (
                <tr key={enrollment.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800 dark:text-white">
                    {enrollment.referenceNumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-800 dark:text-white">
                      {enrollment.student.firstName} {enrollment.student.lastName}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {enrollment.student.email}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                    {enrollment.enrollment.campus}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                    {enrollment.enrollment.gradeLevel}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                    {formatDate(enrollment.submittedDate)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={enrollment.status} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => handleViewDetails(enrollment)}
                      className="text-primary hover:text-accent-burgundy dark:text-white dark:hover:text-off-white font-medium flex items-center gap-1"
                    >
                      <Eye className="w-4 h-4" />
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* No Results */}
        {filteredEnrollments.length === 0 && (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">No enrollments found</p>
          </div>
        )}
      </div>

      {/* Detail Modal */}
{showModal && selectedEnrollment && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
    <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full my-8">

      {/* Modal Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
            Enrollment Details
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Reference: {selectedEnrollment.referenceNumber}
          </p>
        </div>
        <button
          onClick={() => setShowModal(false)}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <XCircle className="w-6 h-6" />
        </button>
      </div>

      {/* Modal Content */}
      <div className="p-6 space-y-6 max-h-[calc(100vh-250px)] overflow-y-auto">

        {/* Status and Date */}
        <div className="flex items-center justify-between">
          <StatusBadge status={selectedEnrollment.status} />
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Submitted: {formatDate(selectedEnrollment.submittedDate)}
          </span>
        </div>

        {/* Student Information */}
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
            <User className="w-5 h-5" />
            Student Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Full Name</p>
              <p className="font-medium text-gray-800 dark:text-white">
                {selectedEnrollment.student.firstName} {selectedEnrollment.student.middleName} {selectedEnrollment.student.lastName}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Birth Date / Age</p>
              <p className="font-medium text-gray-800 dark:text-white">
                {new Date(selectedEnrollment.student.birthDate).toLocaleDateString()} ({selectedEnrollment.student.age} years old)
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Gender</p>
              <p className="font-medium text-gray-800 dark:text-white">{selectedEnrollment.student.gender}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Place of Birth</p>
              <p className="font-medium text-gray-800 dark:text-white">{selectedEnrollment.student.placeOfBirth}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Civil Status</p>
              <p className="font-medium text-gray-800 dark:text-white">{selectedEnrollment.student.civilStatus}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Religion</p>
              <p className="font-medium text-gray-800 dark:text-white">{selectedEnrollment.student.religion}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Nationality</p>
              <p className="font-medium text-gray-800 dark:text-white">{selectedEnrollment.student.nationality}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Contact Number</p>
              <p className="font-medium text-gray-800 dark:text-white">{selectedEnrollment.student.contactNumber}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm text-gray-500 dark:text-gray-400">Email Address</p>
              <p className="font-medium text-gray-800 dark:text-white">{selectedEnrollment.student.email}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm text-gray-500 dark:text-gray-400">Home Address</p>
              <p className="font-medium text-gray-800 dark:text-white">{selectedEnrollment.student.address}</p>
            </div>
          </div>
        </div>

        {/* Enrollment Details */}
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Enrollment Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Campus</p>
              <p className="font-medium text-gray-800 dark:text-white">{selectedEnrollment.enrollment.campus}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Grade Level</p>
              <p className="font-medium text-gray-800 dark:text-white">{selectedEnrollment.enrollment.gradeLevel}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Student Type</p>
              <p className="font-medium text-gray-800 dark:text-white">{selectedEnrollment.enrollment.studentType}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">School Year</p>
              <p className="font-medium text-gray-800 dark:text-white">{selectedEnrollment.enrollment.schoolYear}</p>
            </div>
          </div>
        </div>

        {/* Parent Information */}
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
            <User className="w-5 h-5" />
            Parent/Guardian Information
          </h3>

          <div className="space-y-4">
            {/* Father */}
            <div>
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">Father</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Name</p>
                  <p className="font-medium text-gray-800 dark:text-white">{selectedEnrollment.father.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Occupation</p>
                  <p className="font-medium text-gray-800 dark:text-white">{selectedEnrollment.father.occupation}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Contact</p>
                  <p className="font-medium text-gray-800 dark:text-white">{selectedEnrollment.father.contactNumber}</p>
                </div>
              </div>
            </div>

            {/* Mother */}
            <div>
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">Mother</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Name</p>
                  <p className="font-medium text-gray-800 dark:text-white">{selectedEnrollment.mother.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Occupation</p>
                  <p className="font-medium text-gray-800 dark:text-white">{selectedEnrollment.mother.occupation}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Contact</p>
                  <p className="font-medium text-gray-800 dark:text-white">{selectedEnrollment.mother.contactNumber}</p>
                </div>
              </div>
            </div>

            {/* Guardian (if applicable) */}
            {selectedEnrollment.guardian.name !== 'N/A' && (
              <div>
                <p className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">Guardian</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Name</p>
                    <p className="font-medium text-gray-800 dark:text-white">{selectedEnrollment.guardian.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Contact</p>
                    <p className="font-medium text-gray-800 dark:text-white">{selectedEnrollment.guardian.contactNumber}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Previous School */}
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Previous School Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">School Name</p>
              <p className="font-medium text-gray-800 dark:text-white">{selectedEnrollment.previousSchool.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Address</p>
              <p className="font-medium text-gray-800 dark:text-white">{selectedEnrollment.previousSchool.address}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Last Grade</p>
              <p className="font-medium text-gray-800 dark:text-white">{selectedEnrollment.previousSchool.lastGrade}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">School Year</p>
              <p className="font-medium text-gray-800 dark:text-white">{selectedEnrollment.previousSchool.schoolYear}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Footer - Actions */}
      <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
        <button
          onClick={() => setShowModal(false)}
          className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
        >
          Close
        </button>

        <div className="flex gap-3">
          {user?.role !== 'admin' && (
            <>
              {selectedEnrollment.status === 'pending' && (
                <>
                  <button
                    onClick={() => handleReject(selectedEnrollment.id)}
                    className="px-6 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors flex items-center gap-2 font-medium"
                  >
                    <XCircle className="w-5 h-5" />
                    Reject
                  </button>
                  <button
                    onClick={() => handleApprove(selectedEnrollment.id)}
                    className="px-6 py-2 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg transition-colors flex items-center gap-2 font-medium"
                  >
                    <CheckCircle className="w-5 h-5" />
                    Approve
                  </button>
                </>
              )}

              {selectedEnrollment.status !== 'pending' && (
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  This enrollment has been {selectedEnrollment.status}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  </div>
)}

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirm.open}
        title={confirm.type === 'approve' ? 'Approve Enrollment?' : 'Reject Enrollment?'}
        message={confirm.type === 'approve'
          ? 'This will mark the enrollment as approved. The student will be notified.'
          : 'This will reject the enrollment application. This action can be reviewed.'}
        confirmLabel={confirm.type === 'approve' ? 'Yes, Approve' : 'Yes, Reject'}
        danger={confirm.type === 'reject'}
        loading={actionLoading}
        onConfirm={confirmAction}
        onCancel={() => setConfirm({ open: false, type: null, id: null })}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  )
}