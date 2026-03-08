export const mockEnrollments = [
  {
    id: 1,
    referenceNumber: 'CSHC-2026-001',
    status: 'pending',
    submittedDate: '2026-02-28T10:30:00',
    
    // Student Information
    student: {
      firstName: 'Juan',
      middleName: 'Santos',
      lastName: 'Dela Cruz',
      birthDate: '2010-05-15',
      age: 15,
      gender: 'Male',
      placeOfBirth: 'Cebu City',
      civilStatus: 'Single',
      religion: 'Roman Catholic',
      nationality: 'Filipino',
      address: '123 Main St, Talisay City, Cebu',
      email: 'juan.delacruz@email.com',
      contactNumber: '09123456789'
    },
    
    // Enrollment Details
    enrollment: {
      campus: 'Talisay City Campus',
      gradeLevel: 'Grade 10',
      studentType: 'Returnee',
      schoolYear: '2026-2027'
    },
    
    // Parent Information
    father: {
      name: 'Pedro Dela Cruz',
      occupation: 'Engineer',
      contactNumber: '09111111111'
    },
    mother: {
      name: 'Maria Dela Cruz',
      occupation: 'Teacher',
      contactNumber: '09222222222'
    },
    guardian: {
      name: 'N/A',
      contactNumber: 'N/A'
    },
    
    // Previous School
    previousSchool: {
      name: 'Talisay National High School',
      address: 'Talisay City, Cebu',
      lastGrade: 'Grade 9',
      schoolYear: '2025-2026'
    }
  },
  {
    id: 2,
    referenceNumber: 'CSHC-2026-002',
    status: 'approved',
    submittedDate: '2026-02-27T14:20:00',
    
    student: {
      firstName: 'Maria',
      middleName: 'Garcia',
      lastName: 'Santos',
      birthDate: '2012-08-20',
      age: 13,
      gender: 'Female',
      placeOfBirth: 'Carcar City',
      civilStatus: 'Single',
      religion: 'Roman Catholic',
      nationality: 'Filipino',
      address: '456 Sunset Blvd, Carcar City, Cebu',
      email: 'maria.santos@email.com',
      contactNumber: '09234567890'
    },
    
    enrollment: {
      campus: 'Carcar City Campus',
      gradeLevel: 'Grade 8',
      studentType: 'New',
      schoolYear: '2026-2027'
    },
    
    father: {
      name: 'Jose Santos',
      occupation: 'Businessman',
      contactNumber: '09333333333'
    },
    mother: {
      name: 'Ana Santos',
      occupation: 'Nurse',
      contactNumber: '09444444444'
    },
    guardian: {
      name: 'N/A',
      contactNumber: 'N/A'
    },
    
    previousSchool: {
      name: 'Carcar Elementary School',
      address: 'Carcar City, Cebu',
      lastGrade: 'Grade 7',
      schoolYear: '2025-2026'
    }
  },
  {
    id: 3,
    referenceNumber: 'CSHC-2026-003',
    status: 'pending',
    submittedDate: '2026-02-28T09:15:00',
    
    student: {
      firstName: 'Pedro',
      middleName: 'Lopez',
      lastName: 'Garcia',
      birthDate: '2008-03-10',
      age: 17,
      gender: 'Male',
      placeOfBirth: 'Tagbilaran City',
      civilStatus: 'Single',
      religion: 'Iglesia ni Cristo',
      nationality: 'Filipino',
      address: '789 Rizal Ave, Tagbilaran City, Bohol',
      email: 'pedro.garcia@email.com',
      contactNumber: '09345678901'
    },
    
    enrollment: {
      campus: 'Bohol Campus',
      gradeLevel: 'Grade 12',
      studentType: 'Transferee',
      schoolYear: '2026-2027'
    },
    
    father: {
      name: 'Ramon Garcia',
      occupation: 'Fisherman',
      contactNumber: '09555555555'
    },
    mother: {
      name: 'Rosa Garcia',
      occupation: 'Vendor',
      contactNumber: '09666666666'
    },
    guardian: {
      name: 'Lola Carmen Garcia',
      contactNumber: '09777777777'
    },
    
    previousSchool: {
      name: 'Tagbilaran National High School',
      address: 'Tagbilaran City, Bohol',
      lastGrade: 'Grade 11',
      schoolYear: '2025-2026'
    }
  },
  {
    id: 4,
    referenceNumber: 'CSHC-2026-004',
    status: 'rejected',
    submittedDate: '2026-02-26T16:45:00',
    
    student: {
      firstName: 'Ana',
      middleName: 'Reyes',
      lastName: 'Cruz',
      birthDate: '2011-11-25',
      age: 14,
      gender: 'Female',
      placeOfBirth: 'Talisay City',
      civilStatus: 'Single',
      religion: 'Born Again',
      nationality: 'Filipino',
      address: '321 Luna St, Talisay City, Cebu',
      email: 'ana.cruz@email.com',
      contactNumber: '09456789012'
    },
    
    enrollment: {
      campus: 'Talisay City Campus',
      gradeLevel: 'Grade 9',
      studentType: 'New',
      schoolYear: '2026-2027'
    },
    
    father: {
      name: 'Miguel Cruz',
      occupation: 'Driver',
      contactNumber: '09888888888'
    },
    mother: {
      name: 'Elena Cruz',
      occupation: 'Housewife',
      contactNumber: '09999999999'
    },
    guardian: {
      name: 'N/A',
      contactNumber: 'N/A'
    },
    
    previousSchool: {
      name: 'Talisay Central School',
      address: 'Talisay City, Cebu',
      lastGrade: 'Grade 8',
      schoolYear: '2025-2026'
    }
  },
  {
    id: 5,
    referenceNumber: 'CSHC-2026-005',
    status: 'pending',
    submittedDate: '2026-02-28T11:00:00',
    
    student: {
      firstName: 'Carlo',
      middleName: 'Mendoza',
      lastName: 'Bautista',
      birthDate: '2006-07-08',
      age: 19,
      gender: 'Male',
      placeOfBirth: 'Carcar City',
      civilStatus: 'Single',
      religion: 'Roman Catholic',
      nationality: 'Filipino',
      address: '555 Maharlika St, Carcar City, Cebu',
      email: 'carlo.bautista@email.com',
      contactNumber: '09567890123'
    },
    
    enrollment: {
      campus: 'Carcar City Campus',
      gradeLevel: 'BS Nursing - 1st Year',
      studentType: 'New',
      schoolYear: '2026-2027'
    },
    
    father: {
      name: 'Roberto Bautista',
      occupation: 'Mechanic',
      contactNumber: '09101010101'
    },
    mother: {
      name: 'Linda Bautista',
      occupation: 'Store Owner',
      contactNumber: '09202020202'
    },
    guardian: {
      name: 'N/A',
      contactNumber: 'N/A'
    },
    
    previousSchool: {
      elementary: 'Carcar Elementary School',
      juniorHigh: 'Carcar National High School',
      seniorHigh: 'Carcar City Senior High School',
      lastCollege: 'N/A'
    }
  },
  {
    id: 6,
    referenceNumber: 'CSHC-2026-006',
    status: 'approved',
    submittedDate: '2026-02-27T13:30:00',
    
    student: {
      firstName: 'Sofia',
      middleName: 'Torres',
      lastName: 'Ramos',
      birthDate: '2013-01-18',
      age: 13,
      gender: 'Female',
      placeOfBirth: 'Talisay City',
      civilStatus: 'Single',
      religion: 'Roman Catholic',
      nationality: 'Filipino',
      address: '888 Del Pilar St, Talisay City, Cebu',
      email: 'sofia.ramos@email.com',
      contactNumber: '09678901234'
    },
    
    enrollment: {
      campus: 'Talisay City Campus',
      gradeLevel: 'Grade 7',
      studentType: 'New',
      schoolYear: '2026-2027'
    },
    
    father: {
      name: 'Fernando Ramos',
      occupation: 'Accountant',
      contactNumber: '09303030303'
    },
    mother: {
      name: 'Isabella Ramos',
      occupation: 'Pharmacist',
      contactNumber: '09404040404'
    },
    guardian: {
      name: 'N/A',
      contactNumber: 'N/A'
    },
    
    previousSchool: {
      name: 'Talisay Elementary School',
      address: 'Talisay City, Cebu',
      lastGrade: 'Grade 6',
      schoolYear: '2025-2026'
    }
  }
]