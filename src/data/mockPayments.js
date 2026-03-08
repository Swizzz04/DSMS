export const mockPayments = [
  {
    id: 1,
    studentId: 'CSHC-2026-0001',
    studentName: 'Maria Garcia Santos',
    gradeLevel: 'Grade 8',
    campus: 'Carcar City Campus',
    
    totalFee: 45000,
    amountPaid: 45000,
    balance: 0,
    
    status: 'paid', // paid, partial, overdue, pending
    paymentMethod: 'Cash',
    
    lastPaymentDate: '2026-02-27T10:00:00',
    dueDate: '2026-03-15T00:00:00',
    
    paymentHistory: [
      {
        id: 1,
        amount: 20000,
        method: 'Cash',
        date: '2026-02-27T10:00:00',
        orNumber: 'OR-2026-001',
        notes: 'Initial payment - Enrollment fee'
      },
      {
        id: 2,
        amount: 25000,
        method: 'Cash',
        date: '2026-02-28T14:00:00',
        orNumber: 'OR-2026-015',
        notes: 'Remaining balance'
      }
    ]
  },
  {
    id: 2,
    studentId: 'CSHC-2026-0002',
    studentName: 'Sofia Torres Ramos',
    gradeLevel: 'Grade 7',
    campus: 'Talisay City Campus',
    
    totalFee: 42000,
    amountPaid: 20000,
    balance: 22000,
    
    status: 'partial',
    paymentMethod: 'Bank Transfer',
    
    lastPaymentDate: '2026-02-28T09:00:00',
    dueDate: '2026-03-20T00:00:00',
    
    paymentHistory: [
      {
        id: 1,
        amount: 20000,
        method: 'Bank Transfer',
        date: '2026-02-28T09:00:00',
        orNumber: 'OR-2026-008',
        notes: 'Down payment'
      }
    ]
  },
  {
    id: 3,
    studentId: 'CSHC-2025-0156',
    studentName: 'Juan Santos Dela Cruz',
    gradeLevel: 'Grade 10',
    campus: 'Talisay City Campus',
    
    totalFee: 48000,
    amountPaid: 48000,
    balance: 0,
    
    status: 'paid',
    paymentMethod: 'GCash',
    
    lastPaymentDate: '2026-01-15T11:00:00',
    dueDate: '2026-02-01T00:00:00',
    
    paymentHistory: [
      {
        id: 1,
        amount: 48000,
        method: 'GCash',
        date: '2026-01-15T11:00:00',
        orNumber: 'OR-2025-234',
        notes: 'Full payment'
      }
    ]
  },
  {
    id: 4,
    studentId: 'CSHC-2024-0089',
    studentName: 'Pedro Lopez Garcia',
    gradeLevel: 'Grade 12',
    campus: 'Bohol Campus',
    
    totalFee: 52000,
    amountPaid: 30000,
    balance: 22000,
    
    status: 'overdue',
    paymentMethod: 'Cash',
    
    lastPaymentDate: '2025-12-10T10:00:00',
    dueDate: '2026-02-15T00:00:00',
    
    paymentHistory: [
      {
        id: 1,
        amount: 15000,
        method: 'Cash',
        date: '2025-11-20T10:00:00',
        orNumber: 'OR-2025-189',
        notes: 'Initial payment'
      },
      {
        id: 2,
        amount: 15000,
        method: 'Cash',
        date: '2025-12-10T10:00:00',
        orNumber: 'OR-2025-201',
        notes: 'Second installment'
      }
    ]
  },
  {
    id: 5,
    studentId: 'CSHC-2026-0003',
    studentName: 'Carlo Mendoza Bautista',
    gradeLevel: 'BS Nursing - 1st Year',
    campus: 'Carcar City Campus',
    
    totalFee: 85000,
    amountPaid: 40000,
    balance: 45000,
    
    status: 'partial',
    paymentMethod: 'Bank Transfer',
    
    lastPaymentDate: '2026-02-28T15:00:00',
    dueDate: '2026-03-30T00:00:00',
    
    paymentHistory: [
      {
        id: 1,
        amount: 40000,
        method: 'Bank Transfer',
        date: '2026-02-28T15:00:00',
        orNumber: 'OR-2026-018',
        notes: 'Down payment - Enrollment'
      }
    ]
  },
  {
    id: 6,
    studentId: 'CSHC-2026-0004',
    studentName: 'Ana Cruz Reyes',
    gradeLevel: 'Grade 9',
    campus: 'Talisay City Campus',
    
    totalFee: 44000,
    amountPaid: 0,
    balance: 44000,
    
    status: 'pending',
    paymentMethod: null,
    
    lastPaymentDate: null,
    dueDate: '2026-03-10T00:00:00',
    
    paymentHistory: []
  }
]