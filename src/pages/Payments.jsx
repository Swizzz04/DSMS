import { useState } from 'react'
import { Search, DollarSign, Eye, Plus, Printer, Download, Receipt, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { mockPayments } from '../data/mockPayments'
import { useAuth } from '../context/AuthContext'
import { useAppConfig } from '../context/AppConfigContext'
import { exportToExcel } from '../utils/exportToExcel'

export default function Payments() {
  const { user } = useAuth()
  const { activeCampuses } = useAppConfig()
  const [payments, setPayments] = useState(mockPayments)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [campusFilter, setCampusFilter] = useState('all')
  const [selectedPayment, setSelectedPayment] = useState(null)
  const [showModal, setShowModal] = useState(false)

  // Filter payments
  const filteredPayments = payments.filter(payment => {
    const matchesSearch = 
      payment.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.studentId.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || payment.status === statusFilter
    const matchesCampus = campusFilter === 'all' || payment.campus.includes(campusFilter)
    
    return matchesSearch && matchesStatus && matchesCampus
  })

  // Stats
  const stats = {
    totalRevenue: filteredPayments.reduce((sum, p) => sum + p.amountPaid, 0),
    outstanding: filteredPayments.reduce((sum, p) => sum + p.balance, 0),
    paid: filteredPayments.filter(p => p.status === 'paid').length,
    overdue: filteredPayments.filter(p => p.status === 'overdue').length
  }

  // Status badge
  const StatusBadge = ({ status }) => {
    const styles = {
      paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      partial: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      overdue: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      pending: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
    }
    
    const icons = {
      paid: <CheckCircle className="w-3 h-3" />,
      partial: <Clock className="w-3 h-3" />,
      overdue: <AlertCircle className="w-3 h-3" />,
      pending: <XCircle className="w-3 h-3" />
    }
    
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {icons[status]}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0
    }).format(amount)
  }

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const handleViewReceipt = (payment) => {
    setSelectedPayment(payment)
    setShowModal(true)
  }

  const handleRecordPayment = (payment) => {
    alert(`Record payment for ${payment.studentName}`)
    // TODO: Implement payment recording
  }

  const handlePrintReceipt = () => {
    alert('Printing receipt...')
    // TODO: Implement print functionality
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
          Payments
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Track and manage student payment records
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-8 h-8 opacity-80" />
            <CheckCircle className="w-5 h-5" />
          </div>
          <p className="text-sm opacity-90 mb-1">Total Revenue</p>
          <p className="text-3xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
          <p className="text-xs opacity-75 mt-2">Collected payments</p>
        </div>

        <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white rounded-lg p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Receipt className="w-8 h-8 opacity-80" />
            <Clock className="w-5 h-5" />
          </div>
          <p className="text-sm opacity-90 mb-1">Outstanding Balance</p>
          <p className="text-3xl font-bold">{formatCurrency(stats.outstanding)}</p>
          <p className="text-xs opacity-75 mt-2">Pending collection</p>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle className="w-8 h-8 opacity-80" />
          </div>
          <p className="text-sm opacity-90 mb-1">Fully Paid</p>
          <p className="text-3xl font-bold">{stats.paid}</p>
          <p className="text-xs opacity-75 mt-2">Students</p>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 text-white rounded-lg p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <AlertCircle className="w-8 h-8 opacity-80" />
          </div>
          <p className="text-sm opacity-90 mb-1">Overdue</p>
          <p className="text-3xl font-bold">{stats.overdue}</p>
          <p className="text-xs opacity-75 mt-2">Requires follow-up</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 mb-6 shadow-sm border border-gray-100 dark:border-gray-700/50">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Search */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Student name or ID..."
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
              <option value="paid">Fully Paid</option>
              <option value="partial">Partial Payment</option>
              <option value="overdue">Overdue</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          {/* Campus Filter */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
              Campus
            </label>
            <select
              value={campusFilter}
              onChange={(e) => setCampusFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:ring-2 focus:ring-primary outline-none"
            >
              <option value="all">All Campuses</option>
              {activeCampuses.map(c => (
                <option key={c.id} value={c.key}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Export Button */}
        <div className="mt-4 flex justify-end">
          <button className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-accent-burgundy transition-colors flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export Payment Records
          </button>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Student
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Campus
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Total Fee
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Paid
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Balance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Last Payment
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredPayments.map((payment) => (
                <tr key={payment.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-800 dark:text-white">
                        {payment.studentName}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {payment.studentId} • {payment.gradeLevel}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                    {payment.campus}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800 dark:text-white">
                    {formatCurrency(payment.totalFee)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 dark:text-green-400 font-medium">
                    {formatCurrency(payment.amountPaid)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <span className={payment.balance > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}>
                      {formatCurrency(payment.balance)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={payment.status} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                    {formatDate(payment.lastPaymentDate)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewReceipt(payment)}
                        className="text-primary hover:text-accent-burgundy font-medium flex items-center gap-1"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </button>
                      {payment.balance > 0 && (
                        <button
                          onClick={() => handleRecordPayment(payment)}
                          className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* No Results */}
        {filteredPayments.length === 0 && (
          <div className="text-center py-12">
            <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">No payment records found</p>
          </div>
        )}
      </div>

{/* Payment Detail Modal - COMPLETE VERSION */}
{showModal && selectedPayment && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
    <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full my-8">
      
      {/* Modal Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
            <DollarSign className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
              Payment Details
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {selectedPayment.studentName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrintReceipt}
            className="p-2 bg-primary text-white rounded-lg hover:bg-accent-burgundy transition-colors"
            title="Print Receipt"
          >
            <Printer className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowModal(false)}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <XCircle className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Modal Content */}
      <div className="p-6 space-y-6 max-h-[calc(100vh-250px)] overflow-y-auto">
        
        {/* Student Info & Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-3">
              Student Information
            </h3>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Student ID</p>
                <p className="font-medium text-gray-800 dark:text-white">{selectedPayment.studentId}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Grade Level</p>
                <p className="font-medium text-gray-800 dark:text-white">{selectedPayment.gradeLevel}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Campus</p>
                <p className="font-medium text-gray-800 dark:text-white">{selectedPayment.campus}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-3">
              Payment Status
            </h3>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
                <StatusBadge status={selectedPayment.status} />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Due Date</p>
                <p className="font-medium text-gray-800 dark:text-white">{formatDate(selectedPayment.dueDate)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Last Payment</p>
                <p className="font-medium text-gray-800 dark:text-white">{formatDate(selectedPayment.lastPaymentDate)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Summary */}
        <div className="bg-gradient-to-br from-primary to-accent-burgundy text-white rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Payment Summary</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm opacity-90 mb-1">Total Fee</p>
              <p className="text-2xl font-bold">{formatCurrency(selectedPayment.totalFee)}</p>
            </div>
            <div>
              <p className="text-sm opacity-90 mb-1">Amount Paid</p>
              <p className="text-2xl font-bold">{formatCurrency(selectedPayment.amountPaid)}</p>
            </div>
            <div>
              <p className="text-sm opacity-90 mb-1">Balance</p>
              <p className="text-2xl font-bold">{formatCurrency(selectedPayment.balance)}</p>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-4">
            <div className="w-full bg-white/20 rounded-full h-2">
              <div 
                className="bg-white h-2 rounded-full transition-all duration-500"
                style={{ width: `${(selectedPayment.amountPaid / selectedPayment.totalFee) * 100}%` }}
              ></div>
            </div>
            <p className="text-xs opacity-75 mt-2">
              {Math.round((selectedPayment.amountPaid / selectedPayment.totalFee) * 100)}% Paid
            </p>
          </div>
        </div>

        {/* Payment History */}
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Payment History
          </h3>
          
          {selectedPayment.paymentHistory.length > 0 ? (
            <div className="space-y-3">
              {selectedPayment.paymentHistory.map((history) => (
                <div 
                  key={history.id}
                  className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-600"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-gray-800 dark:text-white">
                          {formatCurrency(history.amount)}
                        </p>
                        <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 px-2 py-0.5 rounded-full">
                          {history.method}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {history.notes}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-800 dark:text-white">
                        {history.orNumber}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(history.date)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Receipt className="w-12 h-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500 dark:text-gray-400 text-sm">No payment history yet</p>
            </div>
          )}
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
        
        <div className="flex gap-3">
          {selectedPayment.balance > 0 && (
            <button
              onClick={() => handleRecordPayment(selectedPayment)}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 font-medium"
            >
              <Plus className="w-5 h-5" />
              Record Payment
            </button>
          )}
          <button
            onClick={handlePrintReceipt}
            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-accent-burgundy transition-colors flex items-center gap-2 font-medium"
          >
            <Printer className="w-5 h-5" />
            Print Receipt
          </button>
        </div>
      </div>
    </div>
  </div>
)}
    </div>
  )
}