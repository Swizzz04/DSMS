import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useReactToPrint } from 'react-to-print'
import { Search, Users, Eye, Printer, Download, GraduationCap, MapPin, BookOpen, X, ChevronDown } from 'lucide-react'
import { mockStudents } from '../data/mockStudents'
import { useAuth } from '../context/AuthContext'
import { exportToExcel } from '../utils/exportToExcel'
import PrintableStudent from '../components/PrintableStudent'
import { useLocation } from 'react-router-dom'
import { useToast, ToastContainer } from '../components/UIComponents'
import { useAppConfig } from '../context/AppConfigContext'

// ── Portal-based grouped grade select ────────────────
// Renders the panel at document.body level so it can never
// be clipped or buried by the table's stacking context.
function GradeLevelSelect({ value, onChange, campusFilter, userRole, campusProgramsMap, basicEdGroups }) {
  const [open, setOpen]       = useState(false)
  const [dropPos, setDropPos] = useState({})
  const triggerRef = useRef(null)
  const panelRef   = useRef(null)

  const collegePrograms = campusFilter === 'all'
    ? [...new Set(Object.values(campusProgramsMap || {}).flat())]
    : (campusProgramsMap?.[campusFilter] || [])

  const isBasicOnly   = userRole === 'registrar_basic'
  const isCollegeOnly = userRole === 'registrar_college'

  const groups = [
    ...(!isCollegeOnly ? (basicEdGroups || []) : []),
    ...(!isBasicOnly && collegePrograms.length > 0 ? [{
      label: campusFilter === 'all' ? 'College (All Campuses)' : `College (${campusFilter})`,
      options: collegePrograms,
    }] : []),
  ]

  const openDropdown = () => {
    if (!triggerRef.current) return
    const rect        = triggerRef.current.getBoundingClientRect()
    const spaceBelow  = window.innerHeight - rect.bottom
    const panelHeight = 256
    if (spaceBelow < panelHeight && rect.top > panelHeight) {
      setDropPos({ bottom: window.innerHeight - rect.top + 4, top: 'auto', left: rect.left, width: rect.width })
    } else {
      setDropPos({ top: rect.bottom + 4, bottom: 'auto', left: rect.left, width: rect.width })
    }
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const onMouse  = (e) => {
      if (!triggerRef.current?.contains(e.target) && !panelRef.current?.contains(e.target))
        setOpen(false)
    }
    const onScroll = (e) => {
      // Don't close if the scroll happened inside the dropdown panel itself
      if (panelRef.current && panelRef.current.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onMouse)
    document.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onMouse)
      document.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  const select = (val) => { onChange(val); setOpen(false) }

  const panel = (
    <div
      ref={panelRef}
      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl max-h-64 overflow-y-auto"
      style={{ position: 'fixed', zIndex: 99999, top: dropPos.top, bottom: dropPos.bottom, left: dropPos.left, width: dropPos.width }}
    >
      <button type="button" onClick={() => select('all')}
        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors
          ${value === 'all' ? 'text-primary font-semibold bg-primary/5 dark:bg-primary/20' : 'text-gray-700 dark:text-gray-300'}`}>
        All Grades
      </button>
      {groups.map((group) => (
        <div key={group.label}>
          <div className="px-3 pt-2 pb-1 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
            {group.label}
          </div>
          {group.options.map((opt) => (
            <button type="button" key={opt} onClick={() => select(opt)}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors
                ${value === opt ? 'text-primary font-semibold bg-primary/5 dark:bg-primary/20' : 'text-gray-700 dark:text-gray-300'}`}>
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
        <span className={value === 'all' ? 'text-gray-400' : ''}>{value === 'all' ? 'All Grades' : value}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 ml-2 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && createPortal(panel, document.body)}
    </div>
  )
}

export default function Students() {
  const { user } = useAuth()
  const { activeCampuses, campusProgramsMap, basicEdGroups } = useAppConfig()
  const location = useLocation()
  const { toasts, addToast, removeToast } = useToast()
  const [students, setStudents] = useState(mockStudents)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [campusFilter, setCampusFilter] = useState('all')
  const [gradeLevelFilter, setGradeLevelFilter] = useState('all')
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [showModal, setShowModal] = useState(false)

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
    if (location.state?.openStudent) {
      setSelectedStudent(location.state.openStudent)
      setShowModal(true)
      // Clear state so back-navigation doesn't re-open
      window.history.replaceState({}, '')
    }
  }, [location.state])
  const printRef = useRef()
  const [studentToPrint, setStudentToPrint] = useState(null)

  // Role-based data filtering
  const roleFilteredStudents = students.filter(student => {
    if (user?.role === 'admin') return true
    
    if (user?.role === 'registrar_basic') {
      const g = student.academic.gradeLevel
      return g.includes('Grade') ||
             g.includes('Nursery') ||
             g.includes('Kindergarten') ||
             g.includes('Preparatory')
    }
    
    if (user?.role === 'registrar_college') {
      return student.academic.gradeLevel.includes('BS') || student.academic.gradeLevel.includes('Year')
    }
    
    return true
  })

  // Filter students
  const filteredStudents = roleFilteredStudents.filter(student => {
    const matchesSearch = 
      student.personal.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.personal.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.studentId.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || student.status === statusFilter
    const matchesCampus = campusFilter === 'all' || student.academic.campus.includes(campusFilter)
    const matchesGradeLevel = gradeLevelFilter === 'all' || student.academic.gradeLevel.includes(gradeLevelFilter)
    
    return matchesSearch && matchesStatus && matchesCampus && matchesGradeLevel
  })

  

  // Stats
  const stats = {
    total: filteredStudents.length,
    active: filteredStudents.filter(s => s.status === 'active').length,
    graduated: filteredStudents.filter(s => s.status === 'graduated').length,
    inactive: filteredStudents.filter(s => s.status === 'inactive').length
  }

  // Status badge
  const StatusBadge = ({ status }) => {
    const styles = {
      active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      inactive: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
      graduated: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
    }
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const handleViewProfile = (student) => {
    setSelectedStudent(student)
    setShowModal(true)
  }

  // Print handler - UPDATED for new react-to-print API
  const handlePrint = useReactToPrint({
  contentRef: printRef,  // ← Changed from 'content' to 'contentRef'
  documentTitle: `Student_Profile_${studentToPrint?.studentId || 'Unknown'}`,
  onAfterPrint: () => {
    console.log('Print completed!')
    setStudentToPrint(null)
  }
})

const handlePrintClick = (student) => {
  console.log('Print clicked for:', student.personal.firstName)
  setStudentToPrint(student)
  
  setTimeout(() => {
    if (printRef.current) {
      console.log('Print ref found, triggering print...')
      handlePrint()
    } else {
      console.error('Print ref not found!')
    }
  }, 300)
}

  const handleExportStudents = () => {
  const exportData = filteredStudents.map(student => ({
    'Student ID': student.studentId,
    'Full Name': `${student.personal.firstName} ${student.personal.middleName} ${student.personal.lastName}`,
    'Email': student.personal.email,
    'Contact Number': student.personal.contactNumber,
    'Birth Date': new Date(student.personal.birthDate).toLocaleDateString(),
    'Age': student.personal.age,
    'Gender': student.personal.gender,
    'Address': student.personal.address,
    'Campus': student.academic.campus,
    'Grade Level': student.academic.gradeLevel,
    'Section': student.academic.section,
    'Student Type': student.academic.studentType,
    'School Year': student.academic.schoolYear,
    'Status': student.status.toUpperCase(),
    'Enrollment Date': new Date(student.enrollmentDate).toLocaleDateString(),
    'Father Name': student.parents.father.name,
    'Father Contact': student.parents.father.contactNumber,
    'Mother Name': student.parents.mother.name,
    'Mother Contact': student.parents.mother.contactNumber,
    'Previous School': student.previousSchool.name
  }))
  
  const timestamp = new Date().toISOString().split('T')[0]
  const filename = `Students_${campusFilter !== 'all' ? campusFilter + '_' : ''}${timestamp}`
  
  exportToExcel(exportData, filename, 'Students')
  addToast(`Exported ${exportData.length} student records to Excel!`, 'success')
}

  return (
    <div className="">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">
          Students
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          View and manage enrolled students
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 transition-colors">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border-l-4 border-primary shadow-lg ">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Students</p>
          <p className="text-2xl font-bold text-gray-800 dark:text-white">{stats.total}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            {campusFilter !== 'all' ? `${campusFilter} Campus` : 'All Campuses'}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border-l-4 border-green-500 shadow-lg">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Active</p>
          <p className="text-2xl font-bold text-gray-800 dark:text-white">{stats.active}</p>
          <p className="text-xs text-green-600 dark:text-green-400 mt-2">
            {stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}% of total
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border-l-4 border-blue-500 shadow-lg">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Graduated</p>
          <p className="text-2xl font-bold text-gray-800 dark:text-white">{stats.graduated}</p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
            Completed studies
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border-l-4 border-gray-500 shadow-lg">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Inactive</p>
          <p className="text-2xl font-bold text-gray-800 dark:text-white">{stats.inactive}</p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
            Not currently enrolled
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-6 shadow-lg">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          
          {/* Search */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Name or Student ID..."
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
              <option value="active">Active</option>
              <option value="graduated">Graduated</option>
              <option value="inactive">Inactive</option>
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

        {/* Export Button for student list */}
        <div className="mt-4 flex justify-end">
          <button 
            onClick={handleExportStudents}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-accent-burgundy flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export Student List
          </button>
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Student ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Student Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Grade Level
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Campus
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Enrolled
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredStudents.map((student) => (
                <tr key={student.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800 dark:text-white">
                    {student.studentId}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 dark:bg-blue-400/10 rounded-full flex items-center justify-center transition-colors">
                        <Users className="w-5 h-5 text-primary dark:text-blue-600 transition-colors" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-800 dark:text-white">
                          {student.personal.firstName} {student.personal.lastName}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {student.personal.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                    {student.academic.gradeLevel}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                    {student.academic.campus}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={student.status} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                    {formatDate(student.enrollmentDate)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewProfile(student)}
                        className="text-primary hover:text-accent-burgundy dark:text-off-white dark:hover:text-dirty-white font-medium flex items-center gap-1"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </button>
                      <button
                        onClick={() => handlePrintClick(student)}
                        className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* No Results */}
        {filteredStudents.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">No students found</p>
          </div>
        )}
      </div>

{/* Student Profile Modal - FULL VERSION */}
{showModal && selectedStudent && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
    <div className="bg-white dark:bg-gray-800 rounded-lg max-w-5xl w-full my-8">
      
      {/* Modal Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Users className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
              {selectedStudent.personal.firstName} {selectedStudent.personal.lastName}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Student ID: {selectedStudent.studentId}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handlePrintClick(selectedStudent)}
            className="p-2 bg-primary text-white rounded-lg hover:bg-accent-burgundy transition-colors"
            title="Print Profile"
          >
            <Printer className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowModal(false)}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Modal Content */}
      <div className="p-6 space-y-6 max-h-[calc(100vh-250px)] overflow-y-auto">
        
        {/* Status Badge */}
        <div className="flex items-center justify-between">
          <StatusBadge status={selectedStudent.status} />
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Enrolled: {formatDate(selectedStudent.enrollmentDate)}
          </span>
        </div>

        {/* Personal Information */}
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Personal Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Full Name</p>
              <p className="font-medium text-gray-800 dark:text-white">
                {selectedStudent.personal.firstName} {selectedStudent.personal.middleName} {selectedStudent.personal.lastName}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Birth Date / Age</p>
              <p className="font-medium text-gray-800 dark:text-white">
                {new Date(selectedStudent.personal.birthDate).toLocaleDateString()} ({selectedStudent.personal.age} years old)
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Gender</p>
              <p className="font-medium text-gray-800 dark:text-white">{selectedStudent.personal.gender}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Place of Birth</p>
              <p className="font-medium text-gray-800 dark:text-white">{selectedStudent.personal.placeOfBirth}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Religion</p>
              <p className="font-medium text-gray-800 dark:text-white">{selectedStudent.personal.religion}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Nationality</p>
              <p className="font-medium text-gray-800 dark:text-white">{selectedStudent.personal.nationality}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Contact Number</p>
              <p className="font-medium text-gray-800 dark:text-white">{selectedStudent.personal.contactNumber}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm text-gray-500 dark:text-gray-400">Email Address</p>
              <p className="font-medium text-gray-800 dark:text-white">{selectedStudent.personal.email}</p>
            </div>
            <div className="md:col-span-3">
              <p className="text-sm text-gray-500 dark:text-gray-400">Home Address</p>
              <p className="font-medium text-gray-800 dark:text-white">{selectedStudent.personal.address}</p>
            </div>
          </div>
        </div>

        {/* Academic Information */}
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
            <GraduationCap className="w-5 h-5" />
            Academic Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Campus</p>
              <p className="font-medium text-gray-800 dark:text-white flex items-center gap-1">
                <MapPin className="w-4 h-4 text-primary" />
                {selectedStudent.academic.campus}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Grade Level</p>
              <p className="font-medium text-gray-800 dark:text-white">{selectedStudent.academic.gradeLevel}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Section</p>
              <p className="font-medium text-gray-800 dark:text-white">{selectedStudent.academic.section}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Student Type</p>
              <p className="font-medium text-gray-800 dark:text-white">{selectedStudent.academic.studentType}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">School Year</p>
              <p className="font-medium text-gray-800 dark:text-white">{selectedStudent.academic.schoolYear}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Level</p>
              <p className="font-medium text-gray-800 dark:text-white">{selectedStudent.academic.yearLevel}</p>
            </div>
          </div>
        </div>

        {/* Parent Information */}
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Parent/Guardian Information
          </h3>
          
          <div className="space-y-4">
            {/* Father */}
            <div>
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">Father</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Name</p>
                  <p className="font-medium text-gray-800 dark:text-white">{selectedStudent.parents.father.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Occupation</p>
                  <p className="font-medium text-gray-800 dark:text-white">{selectedStudent.parents.father.occupation}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Contact</p>
                  <p className="font-medium text-gray-800 dark:text-white">{selectedStudent.parents.father.contactNumber}</p>
                </div>
              </div>
            </div>

            {/* Mother */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-600">
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">Mother</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Name</p>
                  <p className="font-medium text-gray-800 dark:text-white">{selectedStudent.parents.mother.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Occupation</p>
                  <p className="font-medium text-gray-800 dark:text-white">{selectedStudent.parents.mother.occupation}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Contact</p>
                  <p className="font-medium text-gray-800 dark:text-white">{selectedStudent.parents.mother.contactNumber}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Previous School */}
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Previous School Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">School Name</p>
              <p className="font-medium text-gray-800 dark:text-white">{selectedStudent.previousSchool.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Address</p>
              <p className="font-medium text-gray-800 dark:text-white">{selectedStudent.previousSchool.address}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Last Grade</p>
              <p className="font-medium text-gray-800 dark:text-white">{selectedStudent.previousSchool.lastGrade}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">School Year</p>
              <p className="font-medium text-gray-800 dark:text-white">{selectedStudent.previousSchool.schoolYear}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
          <button
            onClick={() => setShowModal(false)}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            Close
        </button>
  
        <button
          onClick={() => handlePrintClick(selectedStudent)}
          className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-accent-burgundy transition-colors flex items-center gap-2 font-medium"
         >
          <Printer className="w-5 h-5" />
          Print PDF
        </button>
      </div>
    </div>
  </div>
)}
    {studentToPrint && (
    <div style={{ display: 'none' }}>
      <PrintableStudent 
        ref={printRef} 
        student={studentToPrint} 
        key={studentToPrint.id}
        />
    </div>
      )}

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  )
}