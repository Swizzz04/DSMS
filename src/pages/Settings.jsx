import { useState, useEffect } from 'react'
import {
  Calendar, DollarSign, Building2, GraduationCap,
  Users, Plus, Edit, Palette, Moon, Sun, Check, Save
} from 'lucide-react'
import { PageSkeleton } from '../components/UIComponents'
import { useTheme } from '../context/ThemeContext'
import { useAppConfig } from '../context/AppConfigContext'

export default function Settings() {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 600)
    return () => clearTimeout(t)
  }, [])

  const [activeTab, setActiveTab] = useState('appearance')
  const { theme, toggleTheme } = useTheme()
  const {
    schoolYears, campuses, feeStructure, systemUsers, basicEdGroups,
    updateConfig, resetSection, activeCampuses, currentSchoolYear
  } = useAppConfig()

  // Local editable copies — committed to context on Save
  const [editSchoolYears, setEditSchoolYears] = useState(() => schoolYears)
  const [editCampuses,    setEditCampuses]    = useState(() => campuses)
  const [editFees,        setEditFees]        = useState(() => feeStructure)
  const [editUsers,       setEditUsers]       = useState(() => systemUsers)
  const [savedSection,    setSavedSection]    = useState(null)

  const saveSection = (section, value) => {
    updateConfig(section, value)
    setSavedSection(section)
    setTimeout(() => setSavedSection(null), 2000)
  }


  // Available color themes
  const colorThemes = [
    { id: 'red', name: 'Classic Red', primary: '#750014', secondary: '#4a0009', color: 'bg-red-700' },
    { id: 'blue', name: 'Ocean Blue', primary: '#1e40af', secondary: '#1e3a8a', color: 'bg-blue-700' },
    { id: 'green', name: 'Emerald Green', primary: '#047857', secondary: '#065f46', color: 'bg-green-700' },
    { id: 'purple', name: 'Royal Purple', primary: '#7c3aed', secondary: '#6d28d9', color: 'bg-purple-600' },
    { id: 'pink', name: 'Rose Pink', primary: '#db2777', secondary: '#be185d', color: 'bg-pink-600' },
    { id: 'orange', name: 'Amber Gold', primary: '#ea580c', secondary: '#c2410c', color: 'bg-orange-600' },
    { id: 'gray', name: 'Graphite', primary: '#475569', secondary: '#334155', color: 'bg-gray-600' },
    { id: 'teal', name: 'Teal', primary: '#0d9488', secondary: '#0f766e', color: 'bg-teal-600' }
  ]

  const [selectedColor, setSelectedColor] = useState('red')

  // Tab configuration
  const tabs = [
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'schoolYear', label: 'School Year', icon: Calendar },
    { id: 'fees', label: 'Fee Structure', icon: DollarSign },
    { id: 'campuses', label: 'Campuses', icon: Building2 },
    { id: 'grades', label: 'Grade Levels', icon: GraduationCap },
    { id: 'users', label: 'Users', icon: Users }
  ]

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const handleColorChange = (colorId) => {
    setSelectedColor(colorId)
    alert(`Color theme "${colorThemes.find(c => c.id === colorId).name}" selected! (This will be implemented globally)`)
  }

  if (loading) return <PageSkeleton title="Settings" />

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
          Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage system configuration and preferences
        </p>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg mb-6">
        <div className="flex overflow-x-auto border-b border-gray-200 dark:border-gray-700">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 px-6 py-4 font-medium whitespace-nowrap transition-colors
                ${activeTab === tab.id
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                }
              `}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        
        {/* Appearance Tab */}
        {activeTab === 'appearance' && (
          <>
            {/* Accent Color Theme */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 border border-gray-100 dark:border-gray-700/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Palette className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-800 dark:text-white">
                    Accent Color Theme
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Personalize the primary highlight colors of your dashboard
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {colorThemes.map((color) => (
                  <button
                    key={color.id}
                    onClick={() => handleColorChange(color.id)}
                    className={`
                      relative p-4 border-2 rounded-lg transition-all hover:scale-105
                      ${selectedColor === color.id
                        ? 'border-primary shadow-lg'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }
                    `}
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className={`w-16 h-16 ${color.color} rounded-full flex items-center justify-center`}>
                        {selectedColor === color.id && (
                          <Check className="w-8 h-8 text-white" />
                        )}
                      </div>
                      <span className="text-sm font-medium text-gray-800 dark:text-white">
                        {color.name}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Background Mode */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 border border-gray-100 dark:border-gray-700/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Moon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-800 dark:text-white">
                    Background Mode
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Choose your preferred application background lighting
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {/* Light Mode */}
                <button
                  onClick={() => theme === 'dark' && toggleTheme()}
                  className={`
                    p-6 border-2 rounded-lg transition-all hover:scale-105
                    ${theme === 'light'
                      ? 'border-primary shadow-lg bg-gray-50'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 bg-white border-2 border-gray-200 rounded-full flex items-center justify-center">
                      <Sun className="w-8 h-8 text-yellow-500" />
                    </div>
                    <span className="text-sm font-medium text-gray-800 dark:text-white">
                      Light
                    </span>
                  </div>
                </button>

                {/* Dark Mode */}
                <button
                  onClick={() => theme === 'light' && toggleTheme()}
                  className={`
                    p-6 border-2 rounded-lg transition-all hover:scale-105
                    ${theme === 'dark'
                      ? 'border-primary shadow-lg bg-gray-900'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 bg-gray-900 border-2 border-gray-700 rounded-full flex items-center justify-center">
                      <Moon className="w-8 h-8 text-blue-400" />
                    </div>
                    <span className="text-sm font-medium text-gray-800 dark:text-white">
                      Dark
                    </span>
                  </div>
                </button>

                {/* Auto Mode (Coming Soon) */}
                <button
                  disabled
                  className="p-6 border-2 border-gray-200 dark:border-gray-700 rounded-lg opacity-50 cursor-not-allowed"
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 bg-gradient-to-br from-white to-gray-900 rounded-full flex items-center justify-center">
                      <Sun className="w-6 h-6 text-yellow-500" />
                    </div>
                    <span className="text-sm font-medium text-gray-800 dark:text-white">
                      Auto
                    </span>
                    <span className="text-xs text-gray-500">Coming Soon</span>
                  </div>
                </button>
              </div>
            </div>
          </>
        )}

        {/* School Year Tab */}
        {activeTab === 'schoolYear' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 border border-gray-100 dark:border-gray-700/50">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                School Year Management
              </h2>
              <button className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-accent-burgundy transition-colors flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Add School Year
              </button>
            </div>

            <div className="space-y-4">
              {editSchoolYears.map((year) => (
                <div
                  key={year.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-primary transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white">
                          {year.year}
                        </h3>
                        {year.isCurrent && (
                          <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 text-xs font-medium rounded-full">
                            Current
                          </span>
                        )}
                        <span className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${
                          year.status === 'active' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400' :
                          year.status === 'completed' ? 'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-400' :
                          'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400'
                        }`}>
                          {year.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {new Date(year.startDate).toLocaleDateString()} - {new Date(year.endDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button className="p-2 text-gray-600 hover:text-primary dark:text-gray-400 dark:hover:text-primary">
                        <Edit className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {/* Save bar */}
            <div className="mt-6 flex items-center justify-between border-t border-gray-100 dark:border-gray-700 pt-4">
              <p className="text-xs text-gray-400">Changes affect all pages immediately</p>
              <button
                onClick={() => saveSection('schoolYears', editSchoolYears)}
                className="px-5 py-2 bg-primary text-white rounded-lg hover:bg-accent-burgundy transition-colors flex items-center gap-2 text-sm font-semibold"
              >
                {savedSection === 'schoolYears' ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                {savedSection === 'schoolYears' ? 'Saved!' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}

        {/* Fee Structure Tab */}
        {activeTab === 'fees' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 border border-gray-100 dark:border-gray-700/50">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                Fee Structure by Grade Level
              </h2>
              <button className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-accent-burgundy transition-colors flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Add Fee Entry
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Grade Level
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Tuition Fee
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Enrollment Fee
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Misc Fee
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Total
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {editFees.map((fee) => (
                    <tr key={fee.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 text-sm font-medium text-gray-800 dark:text-white">
                        {fee.gradeLevel}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                        {formatCurrency(fee.tuitionFee)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                        {formatCurrency(fee.enrollmentFee)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                        {formatCurrency(fee.miscFee)}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-primary">
                        {formatCurrency(fee.totalFee)}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <button className="text-primary hover:text-accent-burgundy">
                          <Edit className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-gray-100 dark:border-gray-700 pt-4">
              <p className="text-xs text-gray-400">Fee changes apply to new enrollments immediately</p>
              <button
                onClick={() => saveSection('feeStructure', editFees)}
                className="px-5 py-2 bg-primary text-white rounded-lg hover:bg-accent-burgundy transition-colors flex items-center gap-2 text-sm font-semibold"
              >
                {savedSection === 'feeStructure' ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                {savedSection === 'feeStructure' ? 'Saved!' : 'Save Fee Structure'}
              </button>
            </div>
          </div>
        )}

        {/* Campuses Tab */}
        {activeTab === 'campuses' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 border border-gray-100 dark:border-gray-700/50">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                Campus Management
              </h2>
              <button className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-accent-burgundy transition-colors flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Add Campus
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {editCampuses.map((campus) => (
                <div
                  key={campus.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-primary transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white">
                      {campus.name}
                    </h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      campus.isActive
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                        : 'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-400'
                    }`}>
                      {campus.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    {campus.address}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    {campus.contactNumber}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {campus.email}
                  </p>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {(campus.departments || campus.levels || []).map((level, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 text-xs rounded"
                      >
                        {level}
                      </span>
                    ))}
                  </div>
                  <button className="text-primary hover:text-accent-burgundy text-sm font-medium">
                    Edit Campus
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-gray-100 dark:border-gray-700 pt-4">
              <p className="text-xs text-gray-400">Campus changes update all dropdowns site-wide</p>
              <button
                onClick={() => saveSection('campuses', editCampuses)}
                className="px-5 py-2 bg-primary text-white rounded-lg hover:bg-accent-burgundy transition-colors flex items-center gap-2 text-sm font-semibold"
              >
                {savedSection === 'campuses' ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                {savedSection === 'campuses' ? 'Saved!' : 'Save Campuses'}
              </button>
            </div>
          </div>
        )}


        {activeTab === 'grades' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 border border-gray-100 dark:border-gray-700/50">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                Grade Level Configuration
              </h2>
              <button className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-accent-burgundy transition-colors flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Add Grade Level
              </button>
            </div>

            <div className="space-y-4">
              {basicEdGroups.map((group) => (
                <div
                  key={group.label}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-primary transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white">
                          {group.label}
                        </h3>
                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 text-xs font-medium rounded-full">
                          {group.options.length} grade{group.options.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {group.options.map((grade) => (
                          <span
                            key={grade}
                            className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-full"
                          >
                            {grade}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button className="text-primary hover:text-accent-burgundy ml-4 flex-shrink-0">
                      <Edit className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 border border-gray-100 dark:border-gray-700/50">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                User Management
              </h2>
              <button className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-accent-burgundy transition-colors flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Add User
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Campus
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Last Login
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {editUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 text-sm font-medium text-gray-800 dark:text-white">
                        {user.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                        {user.email}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 capitalize">
                        {user.role.replace('_', ' ')}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                        {user.campus}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          user.status === 'active'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                            : 'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-400'
                        }`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {new Date(user.lastLogin).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <button className="text-primary hover:text-accent-burgundy">
                          <Edit className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-gray-100 dark:border-gray-700 pt-4">
              <p className="text-xs text-gray-400">User changes take effect on next login</p>
              <button
                onClick={() => saveSection('systemUsers', editUsers)}
                className="px-5 py-2 bg-primary text-white rounded-lg hover:bg-accent-burgundy transition-colors flex items-center gap-2 text-sm font-semibold"
              >
                {savedSection === 'systemUsers' ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                {savedSection === 'systemUsers' ? 'Saved!' : 'Save Users'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}