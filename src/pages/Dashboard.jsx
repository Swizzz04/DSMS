import { useState } from 'react'
import { Filter } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useAppConfig } from '../context/AppConfigContext'

export default function Dashboard() {
  const { user } = useAuth()
  const { activeCampuses, currentSchoolYear } = useAppConfig()
  const [campusFilter, setCampusFilter] = useState('all')
  const [timeFilter, setTimeFilter] = useState('all')

  const allData = {
    enrollments: { all: 1234, talisay: 567, carcar: 445, bohol: 222, today: 45, week: 234, month: 567 },
    pending:     { all: 45,   talisay: 20,  carcar: 15,  bohol: 10,  today: 12, week: 28,  month: 45  },
    students:    { all: 3567, talisay: 1678,carcar: 1234,bohol: 655 },
    revenue:     { all: 2500000, talisay: 1200000, carcar: 900000, bohol: 400000, today: 125000, week: 450000, month: 850000 }
  }

  const getStats = () => {
    const campus = campusFilter.toLowerCase()
    return {
      enrollments: campusFilter === 'all'
        ? (timeFilter === 'all' ? allData.enrollments.all : allData.enrollments[timeFilter])
        : allData.enrollments[campus],
      pending: campusFilter === 'all'
        ? (timeFilter === 'all' ? allData.pending.all : allData.pending[timeFilter])
        : allData.pending[campus],
      students: campusFilter === 'all' ? allData.students.all : allData.students[campus],
      revenue: campusFilter === 'all'
        ? (timeFilter === 'all' ? allData.revenue.all : allData.revenue[timeFilter])
        : allData.revenue[campus]
    }
  }

  // In a real application, you would fetch this data from an API based on the selected filters

  const stats = getStats()

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency', currency: 'PHP', minimumFractionDigits: 0
    }).format(amount)
  }

  const getCampusLabel = () => {
    if (campusFilter === 'all') return 'All Campuses'
    const campus = activeCampuses.find(c => c.key === campusFilter)
    return campus ? campus.name : campusFilter
  }

  const getTimeLabel = () => {
    const labels = { all: 'All Time', today: 'Today', week: 'This Week', month: 'This Month' }
    return labels[timeFilter]
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2 transition-colors duration-300">
           {user?.role === 'admin' && 'Admin Dashboard'}
           {user?.role === 'registrar_basic' && 'Basic Education Dashboard'}
           {user?.role === 'registrar_college' && 'College Dashboard'}
           {user?.role === 'accounting' && 'Accounting Dashboard'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
           {user?.role === 'admin' && 'Overview of school operations and statistics'}
           {user?.role === 'registrar_basic' && 'Basic Education enrollment overview'}
           {user?.role === 'registrar_college' && 'College enrollment overview'}
           {user?.role === 'accounting' && 'Financial overview and payment tracking'}
          </p>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-6 shadow-lg">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-500" />
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Filter Statistics:
            </span>
          </div>

          <select
            value={campusFilter}
            onChange={(e) => setCampusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-primary outline-none"
          >
            <option value="all">All Campuses</option>
            {activeCampuses.map(c => (
              <option key={c.key} value={c.key}>{c.name}</option>
            ))}
          </select>

          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-primary outline-none"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>

          {(campusFilter !== 'all' || timeFilter !== 'all') && (
            <button
              onClick={() => { setCampusFilter('all'); setTimeFilter('all') }}
              className="text-sm text-primary hover:text-accent-burgundy dark:text-off-white dark:hover:text-light-cream underline"
            >
              Clear filters
            </button>
          )}
        </div>

        {(campusFilter !== 'all' || timeFilter !== 'all') && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Showing statistics for: <span className="font-semibold text-primary dark:text-off-white">{getCampusLabel()}</span>
              {timeFilter !== 'all' && (
                <> • <span className="font-semibold text-primary dark:text-off-white">{getTimeLabel()}</span></>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border-l-4 border-primary shadow-lg transform hover:scale-105 transition-transform">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Enrollments</p>
              <h3 className="text-2xl font-bold text-gray-800 dark:text-white">{stats.enrollments.toLocaleString()}</h3>
            </div>
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
              <span className="text-2xl">📋</span>
            </div>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            {getCampusLabel()} • {getTimeLabel()}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border-l-4 border-yellow-500 shadow-lg transform hover:scale-105 transition-transform">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Pending Review</p>
              <h3 className="text-2xl font-bold text-gray-800 dark:text-white">{stats.pending.toLocaleString()}</h3>
            </div>
            <div className="w-12 h-12 bg-yellow-500/10 rounded-full flex items-center justify-center">
              <span className="text-2xl">⏳</span>
            </div>
          </div>
          <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
            {stats.enrollments > 0 ? Math.round((stats.pending / stats.enrollments) * 100) : 0}% pending
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border-l-4 border-green-500 shadow-lg transform hover:scale-105 transition-transform">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Students</p>
              <h3 className="text-2xl font-bold text-gray-800 dark:text-white">{stats.students.toLocaleString()}</h3>
            </div>
            <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center">
              <span className="text-2xl">👥</span>
            </div>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            {getCampusLabel()}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border-l-4 border-blue-500 shadow-lg transform hover:scale-105 transition-transform">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Revenue</p>
              <h3 className="text-2xl font-bold text-gray-800 dark:text-white">{formatCurrency(stats.revenue)}</h3>
            </div>
            <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center">
              <span className="text-2xl">💰</span>
            </div>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            {getCampusLabel()} • {getTimeLabel()}
          </p>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Recent Activity</h2>
        <div className="space-y-4">
          <div className="flex items-start gap-4 pb-4 border-b border-gray-200 dark:border-gray-700">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
              <span>📝</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800 dark:text-white">New enrollment submitted</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Juan Dela Cruz - Grade 7 - Talisay Campus</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">2 minutes ago</p>
            </div>
          </div>

          <div className="flex items-start gap-4 pb-4 border-b border-gray-200 dark:border-gray-700">
            <div className="w-10 h-10 bg-green-500/10 rounded-full flex items-center justify-center flex-shrink-0">
              <span>✅</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800 dark:text-white">Enrollment approved</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Maria Santos - Grade 10 - Carcar Campus</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">15 minutes ago</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-yellow-500/10 rounded-full flex items-center justify-center flex-shrink-0">
              <span>💰</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800 dark:text-white">Payment received</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Pedro Garcia - ₱15,000 - BS Nursing</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">1 hour ago</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}