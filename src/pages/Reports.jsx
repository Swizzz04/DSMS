import { useState } from 'react'
import { Line, Bar, Pie } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'
import { Download, Calendar, TrendingUp, Users, FileText, Building2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { exportToExcel, exportMultipleSheets } from '../utils/exportToExcel'
import { useAppConfig } from '../context/AppConfigContext'

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
)

export default function Reports() {
  const { user } = useAuth()
  const { activeCampuses, currentSchoolYear, allBasicEdGrades, basicEdGroups } = useAppConfig()
  const [dateRange, setDateRange] = useState('month')
  const [selectedCampus, setSelectedCampus] = useState('all')

  // Chart Options
  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: '#9ca3af'
        }
      }
    },
    scales: {
      x: {
        ticks: { color: '#9ca3af' },
        grid: { color: '#374151' }
      },
      y: {
        ticks: { color: '#9ca3af' },
        grid: { color: '#374151' }
      }
    }
  }

  // Enrollment Trends Data
  const enrollmentTrendData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'],
    datasets: [
      {
        label: 'Total Enrollments',
        data: [45, 52, 38, 64, 78, 156, 234, 198],
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4
      },
      {
        label: 'Approved',
        data: [38, 48, 32, 58, 72, 145, 218, 185],
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.4
      },
      {
        label: 'Rejected',
        data: [7, 4, 6, 6, 6, 11, 16, 13],
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        tension: 0.4
      }
    ]
  }

  // Campus Comparison Data — labels driven by active campuses
  const campusComparisonData = {
    labels: activeCampuses.map(c => c.key),
    datasets: [
      {
        label: 'Total Students',
        data: [1678, 1234, 655],
        backgroundColor: '#3b82f6'
      },
      {
        label: 'New Enrollments',
        data: [567, 445, 222],
        backgroundColor: '#10b981'
      }
    ]
  }

  // Status Distribution Data
  const statusDistributionData = {
    labels: ['Approved', 'Pending', 'Rejected'],
    datasets: [
      {
        data: [1089, 45, 100],
        backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
        borderWidth: 0
      }
    ]
  }

  // Grade Level Data — labels driven by basicEdGroups + "College" if any campus has programs
  const gradeLevelLabels = [
    ...allBasicEdGrades.filter(g => g.startsWith('Grade') || ['Nursery','Kindergarten','Preparatory'].includes(g)),
    'College'
  ]
  const gradeLevelData = {
    labels: gradeLevelLabels,
    datasets: [
      {
        label: 'Students',
        data: gradeLevelLabels.map(() => Math.floor(Math.random() * 300 + 100)),
        backgroundColor: '#8b5cf6'
      }
    ]
  }

  const handleExportPDF = () => {
    alert('Exporting reports to PDF...')
  }



const handleExportExcel = () => {
  // Create multiple sheets for comprehensive report
  const sheets = [
    {
      data: [
        { Metric: 'Total Enrollments', Value: 1234, Change: '+12%' },
        { Metric: 'Total Students', Value: 3567, Change: '+5%' },
        { Metric: 'Approval Rate', Value: '88%', Change: '+3%' },
        { Metric: 'Active Campuses', Value: activeCampuses.length, Change: '-' }
      ],
      sheetName: 'Summary'
    },
    {
      data: enrollmentTrendData.labels.map((month, index) => ({
        Month: month,
        'Total Enrollments': enrollmentTrendData.datasets[0].data[index],
        'Approved': enrollmentTrendData.datasets[1].data[index],
        'Rejected': enrollmentTrendData.datasets[2].data[index]
      })),
      sheetName: 'Enrollment Trends'
    },
    {
      data: campusComparisonData.labels.map((campus, index) => ({
        Campus: campus,
        'Total Students': campusComparisonData.datasets[0].data[index],
        'New Enrollments': campusComparisonData.datasets[1].data[index]
      })),
      sheetName: 'Campus Comparison'
    },
    {
      data: statusDistributionData.labels.map((status, index) => ({
        Status: status,
        Count: statusDistributionData.datasets[0].data[index],
        Percentage: `${Math.round((statusDistributionData.datasets[0].data[index] / 1234) * 100)}%`
      })),
      sheetName: 'Status Distribution'
    },
    {
      data: gradeLevelData.labels.map((grade, index) => ({
        'Grade Level': grade,
        'Student Count': gradeLevelData.datasets[0].data[index]
      })),
      sheetName: 'Grade Distribution'
    }
  ]
  
  const timestamp = new Date().toISOString().split('T')[0]
  exportMultipleSheets(sheets, `CSHC_Reports_${timestamp}`)
  
  alert('Comprehensive report exported to Excel with 5 sheets!')
  }

  return (
    <div className="">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">
          Reports & Analytics
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Comprehensive overview of enrollment statistics and trends
        </p>
      </div>

      {/* Filters & Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-6 shadow-lg">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex flex-wrap gap-3">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-primary outline-none"
            >
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="year">This Year</option>
              <option value="all">All Time</option>
            </select>

            <select
              value={selectedCampus}
              onChange={(e) => setSelectedCampus(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-primary outline-none"
            >
              <option value="all">All Campuses</option>
              <option value="all">All Campuses</option>
              {activeCampuses.map(c => (
                <option key={c.key} value={c.key.toLowerCase()}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleExportPDF}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              PDF
            </button>
            <button
              onClick={handleExportExcel}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Excel
            </button>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <FileText className="w-8 h-8 opacity-80" />
            <TrendingUp className="w-5 h-5" />
          </div>
          <p className="text-sm opacity-90 mb-1">Total Enrollments</p>
          <p className="text-3xl font-bold">1,234</p>
          <p className="text-xs opacity-75 mt-2">↑ 12% from last period</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Users className="w-8 h-8 opacity-80" />
            <TrendingUp className="w-5 h-5" />
          </div>
          <p className="text-sm opacity-90 mb-1">Total Students</p>
          <p className="text-3xl font-bold">3,567</p>
          <p className="text-xs opacity-75 mt-2">↑ 5% from last period</p>
        </div>

        <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white rounded-lg p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Calendar className="w-8 h-8 opacity-80" />
            <TrendingUp className="w-5 h-5" />
          </div>
          <p className="text-sm opacity-90 mb-1">Approval Rate</p>
          <p className="text-3xl font-bold">88%</p>
          <p className="text-xs opacity-75 mt-2">↑ 3% from last period</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Building2 className="w-8 h-8 opacity-80" />
            <TrendingUp className="w-5 h-5" />
          </div>
          <p className="text-sm opacity-90 mb-1">Active Campuses</p>
          <p className="text-3xl font-bold">{activeCampuses.length}</p>
          <p className="text-xs opacity-75 mt-2">{activeCampuses.map(c => c.key).join(', ')}</p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        
        {/* Enrollment Trends - Line Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
            Enrollment Trends (2026)
          </h3>
          <div style={{ height: '300px' }}>
            <Line data={enrollmentTrendData} options={commonOptions} />
          </div>
        </div>

        {/* Campus Comparison - Bar Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
            Campus Comparison
          </h3>
          <div style={{ height: '300px' }}>
            <Bar data={campusComparisonData} options={commonOptions} />
          </div>
        </div>

        {/* Status Distribution - Pie Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
            Enrollment Status Distribution
          </h3>
          <div style={{ height: '300px' }} className="flex items-center justify-center">
            <Pie 
              data={statusDistributionData} 
              options={{
                ...commonOptions,
                scales: undefined,
                plugins: {
                  legend: {
                    position: 'bottom',
                    labels: { color: '#9ca3af' }
                  }
                }
              }} 
            />
          </div>
        </div>

        {/* Grade Level Distribution - Bar Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
            Students by Grade Level
          </h3>
          <div style={{ height: '300px' }}>
            <Bar data={gradeLevelData} options={commonOptions} />
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
            Detailed Statistics
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Campus
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Total Students
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  New Enrollments
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Pending
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Approval Rate
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {activeCampuses.map((campus, i) => {
                // Placeholder stats — replace with real API data later
                const mockStats = [
                  { students: 1678, enrollments: 567, pending: 20, approval: '89%' },
                  { students: 1234, enrollments: 445, pending: 15, approval: '91%' },
                  { students: 655,  enrollments: 222, pending: 10, approval: '85%' },
                ]
                const stat = mockStats[i] || { students: 0, enrollments: 0, pending: 0, approval: 'N/A' }
                return (
                  <tr key={campus.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 text-sm font-medium text-gray-800 dark:text-white">{campus.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">{stat.students.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">{stat.enrollments.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">{stat.pending}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className="text-green-600 dark:text-green-400 font-semibold">{stat.approval}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}