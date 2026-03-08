export const mockSettings = {
  // School Year Settings
  schoolYears: [
    {
      id: 1,
      year: '2026-2027',
      startDate: '2026-08-01',
      endDate: '2027-05-31',
      status: 'active',
      isCurrentYear: true
    },
    {
      id: 2,
      year: '2025-2026',
      startDate: '2025-08-01',
      endDate: '2026-05-31',
      status: 'completed',
      isCurrentYear: false
    },
    {
      id: 3,
      year: '2027-2028',
      startDate: '2027-08-01',
      endDate: '2028-05-31',
      status: 'upcoming',
      isCurrentYear: false
    }
  ],

  // Fee Structure
  feeStructure: [
    {
      id: 1,
      gradeLevel: 'Grade 7',
      tuitionFee: 42000,
      enrollmentFee: 2000,
      miscFee: 3000,
      totalFee: 47000,
      campus: 'all'
    },
    {
      id: 2,
      gradeLevel: 'Grade 8',
      tuitionFee: 42000,
      enrollmentFee: 2000,
      miscFee: 3000,
      totalFee: 47000,
      campus: 'all'
    },
    {
      id: 3,
      gradeLevel: 'Grade 9',
      tuitionFee: 44000,
      enrollmentFee: 2000,
      miscFee: 3000,
      totalFee: 49000,
      campus: 'all'
    },
    {
      id: 4,
      gradeLevel: 'Grade 10',
      tuitionFee: 44000,
      enrollmentFee: 2000,
      miscFee: 3000,
      totalFee: 49000,
      campus: 'all'
    },
    {
      id: 5,
      gradeLevel: 'Grade 11',
      tuitionFee: 48000,
      enrollmentFee: 2000,
      miscFee: 4000,
      totalFee: 54000,
      campus: 'all'
    },
    {
      id: 6,
      gradeLevel: 'Grade 12',
      tuitionFee: 48000,
      enrollmentFee: 2000,
      miscFee: 4000,
      totalFee: 54000,
      campus: 'all'
    },
    {
      id: 7,
      gradeLevel: 'BS Nursing - 1st Year',
      tuitionFee: 85000,
      enrollmentFee: 5000,
      miscFee: 8000,
      totalFee: 98000,
      campus: 'Carcar City Campus'
    }
  ],

  // Campus Settings
  campuses: [
    {
      id: 1,
      name: 'Talisay City Campus',
      address: 'Talisay City, Cebu',
      contactNumber: '032-123-4567',
      email: 'talisay@cshc.edu.ph',
      isActive: true,
      levels: ['Basic Education', 'Senior High School']
    },
    {
      id: 2,
      name: 'Carcar City Campus',
      address: 'Carcar City, Cebu',
      contactNumber: '032-234-5678',
      email: 'carcar@cshc.edu.ph',
      isActive: true,
      levels: ['Basic Education', 'Senior High School', 'College']
    },
    {
      id: 3,
      name: 'Bohol Campus',
      address: 'Tagbilaran City, Bohol',
      contactNumber: '038-345-6789',
      email: 'bohol@cshc.edu.ph',
      isActive: true,
      levels: ['Basic Education', 'Senior High School']
    }
  ],

  // Grade Level Configuration
  gradeLevels: [
    {
      id: 1,
      level: 'Grade 7',
      sections: ['St. Francis', 'St. John', 'St. Peter'],
      maxStudentsPerSection: 40,
      department: 'Junior High School'
    },
    {
      id: 2,
      level: 'Grade 8',
      sections: ['St. Francis', 'St. John', 'St. Peter', 'St. Paul'],
      maxStudentsPerSection: 40,
      department: 'Junior High School'
    },
    {
      id: 3,
      level: 'Grade 9',
      sections: ['St. Francis', 'St. John', 'St. Peter'],
      maxStudentsPerSection: 40,
      department: 'Junior High School'
    },
    {
      id: 4,
      level: 'Grade 10',
      sections: ['St. Francis', 'St. John', 'St. Peter'],
      maxStudentsPerSection: 40,
      department: 'Junior High School'
    },
    {
      id: 5,
      level: 'Grade 11',
      sections: ['STEM', 'ABM', 'HUMSS'],
      maxStudentsPerSection: 35,
      department: 'Senior High School'
    },
    {
      id: 6,
      level: 'Grade 12',
      sections: ['STEM', 'ABM', 'HUMSS'],
      maxStudentsPerSection: 35,
      department: 'Senior High School'
    },
    {
      id: 7,
      level: 'BS Nursing',
      sections: ['Nursing 1-A', 'Nursing 1-B'],
      maxStudentsPerSection: 30,
      department: 'College'
    }
  ],

  // System Users
  users: [
    {
      id: 1,
      name: 'Admin User',
      email: 'admin@cshc.edu.ph',
      role: 'admin',
      campus: 'all',
      status: 'active',
      lastLogin: '2026-03-05T10:30:00'
    },
    {
      id: 2,
      name: 'Basic Ed Registrar',
      email: 'registrar.basic@cshc.edu.ph',
      role: 'registrar_basic',
      campus: 'Talisay City Campus',
      status: 'active',
      lastLogin: '2026-03-05T09:15:00'
    },
    {
      id: 3,
      name: 'College Registrar',
      email: 'registrar.college@cshc.edu.ph',
      role: 'registrar_college',
      campus: 'Carcar City Campus',
      status: 'active',
      lastLogin: '2026-03-04T14:20:00'
    },
    {
      id: 4,
      name: 'Accounting Officer',
      email: 'accounting@cshc.edu.ph',
      role: 'accounting',
      campus: 'all',
      status: 'active',
      lastLogin: '2026-03-05T08:00:00'
    }
  ],

  // General Settings
  general: {
    schoolName: 'Cebu Sacred Heart College',
    schoolAbbreviation: 'CSHC',
    primaryColor: '#750014',
    secondaryColor: '#080c42',
    timezone: 'Asia/Manila',
    currency: 'PHP',
    dateFormat: 'MM/DD/YYYY',
    academicCalendarStart: 'August',
    academicCalendarEnd: 'May'
  }
}