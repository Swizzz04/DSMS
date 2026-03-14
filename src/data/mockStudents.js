/**
 * mockStudents.js
 * Grade levels, campus names, and college programs are all derived
 * from appConfig — so any change in Settings automatically reflects here.
 */
import { CAMPUSES, BASIC_ED_GROUPS, COLLEGE_YEAR_LEVELS, getCurrentSchoolYear } from '../config/appConfig'

const campusName = (key) => CAMPUSES.find(c => c.key === key)?.name ?? key
const collegeGrade = (campusKey, programIndex = 0, yearIndex = 0) => {
  const programs = CAMPUSES.find(c => c.key === campusKey)?.collegePrograms ?? []
  const program  = programs[programIndex] ?? programs[0]
  const year     = COLLEGE_YEAR_LEVELS[yearIndex] ?? COLLEGE_YEAR_LEVELS[0]
  return program ? `${program} - ${year}` : 'College'
}
const basicGrade = (groupIndex, optionIndex) =>
  BASIC_ED_GROUPS[groupIndex]?.options[optionIndex] ?? 'Grade 1'
const SY = getCurrentSchoolYear()

export const mockStudents = [
  // ── Basic Ed Students ─────────────────────────────────────────
  {
    id: 1,
    studentId: 'CSHC-2026-0001',
    status: 'active',
    enrollmentDate: '2026-02-27T10:00:00',
    personal: {
      firstName: 'Maria', middleName: 'Garcia', lastName: 'Santos',
      birthDate: '2012-08-20', age: 13, gender: 'Female',
      placeOfBirth: 'Carcar City', civilStatus: 'Single',
      religion: 'Roman Catholic', nationality: 'Filipino',
      address: '456 Sunset Blvd, Carcar City, Cebu',
      email: 'maria.santos@email.com', contactNumber: '09234567890',
    },
    academic: {
      campus: campusName('Carcar'), gradeLevel: basicGrade(1, 1),
      section: 'St. Francis', studentType: 'New', schoolYear: SY, yearLevel: 'Elementary',
    },
    parents: {
      father: { name: 'Jose Santos',  occupation: 'Businessman', contactNumber: '09333333333' },
      mother: { name: 'Ana Santos',   occupation: 'Nurse',       contactNumber: '09444444444' },
    },
    previousSchool: { name: 'Carcar Elementary School', address: 'Carcar City, Cebu', lastGrade: basicGrade(1, 0), schoolYear: '2025-2026' },
  },
  {
    id: 2,
    studentId: 'CSHC-2026-0002',
    status: 'active',
    enrollmentDate: '2026-02-28T14:20:00',
    personal: {
      firstName: 'Sofia', middleName: 'Torres', lastName: 'Ramos',
      birthDate: '2013-01-18', age: 13, gender: 'Female',
      placeOfBirth: 'Talisay City', civilStatus: 'Single',
      religion: 'Roman Catholic', nationality: 'Filipino',
      address: '888 Del Pilar St, Talisay City, Cebu',
      email: 'sofia.ramos@email.com', contactNumber: '09678901234',
    },
    academic: {
      campus: campusName('Talisay'), gradeLevel: basicGrade(2, 0),
      section: 'St. John', studentType: 'New', schoolYear: SY, yearLevel: 'Junior High School',
    },
    parents: {
      father: { name: 'Fernando Ramos', occupation: 'Accountant', contactNumber: '09303030303' },
      mother: { name: 'Isabella Ramos', occupation: 'Pharmacist', contactNumber: '09404040404' },
    },
    previousSchool: { name: 'Talisay Elementary School', address: 'Talisay City, Cebu', lastGrade: basicGrade(1, 5), schoolYear: '2025-2026' },
  },
  {
    id: 3,
    studentId: 'CSHC-2025-0156',
    status: 'active',
    enrollmentDate: '2025-05-15T09:00:00',
    personal: {
      firstName: 'Juan', middleName: 'Santos', lastName: 'Dela Cruz',
      birthDate: '2010-05-15', age: 15, gender: 'Male',
      placeOfBirth: 'Cebu City', civilStatus: 'Single',
      religion: 'Roman Catholic', nationality: 'Filipino',
      address: '123 Main St, Talisay City, Cebu',
      email: 'juan.delacruz@email.com', contactNumber: '09123456789',
    },
    academic: {
      campus: campusName('Talisay'), gradeLevel: basicGrade(2, 3),
      section: 'St. Peter', studentType: 'Returnee', schoolYear: SY, yearLevel: 'Junior High School',
    },
    parents: {
      father: { name: 'Pedro Dela Cruz', occupation: 'Engineer', contactNumber: '09111111111' },
      mother: { name: 'Maria Dela Cruz', occupation: 'Teacher',  contactNumber: '09222222222' },
    },
    previousSchool: { name: 'Talisay National High School', address: 'Talisay City, Cebu', lastGrade: basicGrade(2, 2), schoolYear: '2025-2026' },
  },
  {
    id: 4,
    studentId: 'CSHC-2024-0089',
    status: 'active',
    enrollmentDate: '2024-06-10T11:30:00',
    personal: {
      firstName: 'Pedro', middleName: 'Lopez', lastName: 'Garcia',
      birthDate: '2008-03-10', age: 17, gender: 'Male',
      placeOfBirth: 'Tagbilaran City', civilStatus: 'Single',
      religion: 'Iglesia ni Cristo', nationality: 'Filipino',
      address: '789 Rizal Ave, Tagbilaran City, Bohol',
      email: 'pedro.garcia@email.com', contactNumber: '09345678901',
    },
    academic: {
      campus: campusName('Bohol'), gradeLevel: basicGrade(3, 1),
      section: 'St. Paul', studentType: 'Transferee', schoolYear: SY, yearLevel: 'Senior High School',
    },
    parents: {
      father: { name: 'Ramon Garcia', occupation: 'Fisherman', contactNumber: '09555555555' },
      mother: { name: 'Rosa Garcia',  occupation: 'Vendor',    contactNumber: '09666666666' },
    },
    previousSchool: { name: 'Tagbilaran National High School', address: 'Tagbilaran City, Bohol', lastGrade: basicGrade(3, 0), schoolYear: '2025-2026' },
  },
  {
    id: 6,
    studentId: 'CSHC-2023-0234',
    status: 'graduated',
    enrollmentDate: '2023-06-01T08:00:00',
    personal: {
      firstName: 'Angela', middleName: 'Cruz', lastName: 'Reyes',
      birthDate: '2007-12-05', age: 18, gender: 'Female',
      placeOfBirth: 'Talisay City', civilStatus: 'Single',
      religion: 'Roman Catholic', nationality: 'Filipino',
      address: '321 Burgos St, Talisay City, Cebu',
      email: 'angela.reyes@email.com', contactNumber: '09789012345',
    },
    academic: {
      campus: campusName('Talisay'), gradeLevel: basicGrade(3, 1),
      section: 'St. Mary', studentType: 'Returnee', schoolYear: '2025-2026', yearLevel: 'Senior High School',
    },
    parents: {
      father: { name: 'Carlos Reyes', occupation: 'Driver',    contactNumber: '09888888888' },
      mother: { name: 'Teresa Reyes', occupation: 'Housewife', contactNumber: '09999999999' },
    },
    previousSchool: { name: 'Talisay National High School', address: 'Talisay City, Cebu', lastGrade: basicGrade(3, 0), schoolYear: '2024-2025' },
  },

  // ── Carcar College — BS Criminology ──────────────────────────
  {
    id: 5,
    studentId: 'CSHC-2026-0003',
    status: 'active',
    enrollmentDate: '2026-02-28T15:45:00',
    personal: {
      firstName: 'Carlo', middleName: 'Mendoza', lastName: 'Bautista',
      birthDate: '2006-07-08', age: 19, gender: 'Male',
      placeOfBirth: 'Carcar City', civilStatus: 'Single',
      religion: 'Roman Catholic', nationality: 'Filipino',
      address: '555 Maharlika St, Carcar City, Cebu',
      email: 'carlo.bautista@email.com', contactNumber: '09567890123',
    },
    academic: {
      campus: campusName('Carcar'), gradeLevel: collegeGrade('Carcar', 0, 0),
      section: 'BCrim 1-A', studentType: 'New', schoolYear: SY, yearLevel: 'College',
    },
    parents: {
      father: { name: 'Roberto Bautista', occupation: 'Mechanic',    contactNumber: '09101010101' },
      mother: { name: 'Linda Bautista',   occupation: 'Store Owner', contactNumber: '09202020202' },
    },
    previousSchool: { name: 'Carcar City Senior High School', address: 'Carcar City, Cebu', lastGrade: basicGrade(3, 1), schoolYear: '2025-2026' },
  },
  {
    id: 7,
    studentId: 'CSHC-2025-0201',
    status: 'active',
    enrollmentDate: '2025-08-05T09:00:00',
    personal: {
      firstName: 'Liza', middleName: 'Villanueva', lastName: 'Oquendo',
      birthDate: '2005-04-12', age: 20, gender: 'Female',
      placeOfBirth: 'Carcar City', civilStatus: 'Single',
      religion: 'Roman Catholic', nationality: 'Filipino',
      address: '22 Rizal St, Carcar City, Cebu',
      email: 'liza.oquendo@email.com', contactNumber: '09512345678',
    },
    academic: {
      campus: campusName('Carcar'), gradeLevel: collegeGrade('Carcar', 0, 1),
      section: 'BCrim 2-A', studentType: 'Returnee', schoolYear: SY, yearLevel: 'College',
    },
    parents: {
      father: { name: 'Domingo Oquendo', occupation: 'Security Guard', contactNumber: '09611111111' },
      mother: { name: 'Cora Oquendo',    occupation: 'Laundrywoman',   contactNumber: '09622222222' },
    },
    previousSchool: { name: 'Carcar City Senior High School', address: 'Carcar City, Cebu', lastGrade: basicGrade(3, 1), schoolYear: '2024-2025' },
  },
  {
    id: 8,
    studentId: 'CSHC-2024-0312',
    status: 'active',
    enrollmentDate: '2024-08-06T10:30:00',
    personal: {
      firstName: 'Mark', middleName: 'Alano', lastName: 'Escarda',
      birthDate: '2004-09-30', age: 21, gender: 'Male',
      placeOfBirth: 'Sibonga, Cebu', civilStatus: 'Single',
      religion: 'Roman Catholic', nationality: 'Filipino',
      address: '8 Burgos Ave, Carcar City, Cebu',
      email: 'mark.escarda@email.com', contactNumber: '09523456789',
    },
    academic: {
      campus: campusName('Carcar'), gradeLevel: collegeGrade('Carcar', 0, 2),
      section: 'BCrim 3-A', studentType: 'Transferee', schoolYear: SY, yearLevel: 'College',
    },
    parents: {
      father: { name: 'Eddie Escarda', occupation: 'Farmer',         contactNumber: '09633333333' },
      mother: { name: 'Norma Escarda', occupation: 'Sari-sari Store',contactNumber: '09644444444' },
    },
    previousSchool: { name: 'University of Southern Philippines', address: 'Cebu City', lastGrade: 'BS Criminology - 2nd Year', schoolYear: '2024-2025' },
  },
  {
    id: 9,
    studentId: 'CSHC-2023-0410',
    status: 'active',
    enrollmentDate: '2023-08-07T08:00:00',
    personal: {
      firstName: 'Grace', middleName: 'Tan', lastName: 'Cabrera',
      birthDate: '2003-11-05', age: 22, gender: 'Female',
      placeOfBirth: 'Carcar City', civilStatus: 'Single',
      religion: 'Roman Catholic', nationality: 'Filipino',
      address: '44 Osmeña St, Carcar City, Cebu',
      email: 'grace.cabrera@email.com', contactNumber: '09534567890',
    },
    academic: {
      campus: campusName('Carcar'), gradeLevel: collegeGrade('Carcar', 0, 3),
      section: 'BCrim 4-A', studentType: 'Returnee', schoolYear: SY, yearLevel: 'College',
    },
    parents: {
      father: { name: 'Virgilio Cabrera', occupation: 'Tricycle Driver', contactNumber: '09655555555' },
      mother: { name: 'Elsie Cabrera',    occupation: 'Teacher',         contactNumber: '09666666666' },
    },
    previousSchool: { name: 'Carcar National High School', address: 'Carcar City, Cebu', lastGrade: basicGrade(3, 1), schoolYear: '2022-2023' },
  },
  {
    id: 10,
    studentId: 'CSHC-2026-0004',
    status: 'active',
    enrollmentDate: '2026-03-02T09:00:00',
    personal: {
      firstName: 'Renz', middleName: 'Catipay', lastName: 'Delos Santos',
      birthDate: '2007-02-14', age: 18, gender: 'Male',
      placeOfBirth: 'Carcar City', civilStatus: 'Single',
      religion: 'Roman Catholic', nationality: 'Filipino',
      address: '17 Tres de Abril, Carcar City, Cebu',
      email: 'renz.delossantos@email.com', contactNumber: '09545678901',
    },
    academic: {
      campus: campusName('Carcar'), gradeLevel: collegeGrade('Carcar', 0, 0),
      section: 'BCrim 1-B', studentType: 'New', schoolYear: SY, yearLevel: 'College',
    },
    parents: {
      father: { name: 'Allan Delos Santos', occupation: 'Jeepney Driver', contactNumber: '09677777777' },
      mother: { name: 'Mercy Delos Santos', occupation: 'Market Vendor',  contactNumber: '09688888888' },
    },
    previousSchool: { name: 'Carcar City Senior High School', address: 'Carcar City, Cebu', lastGrade: basicGrade(3, 1), schoolYear: '2025-2026' },
  },

  // ── Talisay College ─────────────────────────────────────────
  {
    id: 11,
    studentId: 'CSHC-2026-0005',
    status: 'active',
    enrollmentDate: '2026-02-26T11:30:00',
    personal: {
      firstName: 'Angelica', middleName: 'Reyes', lastName: 'Flores',
      birthDate: '2006-05-20', age: 19, gender: 'Female',
      placeOfBirth: 'Talisay City', civilStatus: 'Single',
      religion: 'Roman Catholic', nationality: 'Filipino',
      address: '77 San Pedro St, Talisay City, Cebu',
      email: 'angelica.flores@email.com', contactNumber: '09712345678',
    },
    academic: {
      campus: campusName('Talisay'), gradeLevel: collegeGrade('Talisay', 0, 0),
      section: 'Nursing 1-A', studentType: 'New', schoolYear: SY, yearLevel: 'College',
    },
    parents: {
      father: { name: 'Ronnie Flores',  occupation: 'Barangay Captain', contactNumber: '09811111111' },
      mother: { name: 'Lourdes Flores', occupation: 'Nurse',            contactNumber: '09822222222' },
    },
    previousSchool: { name: 'Talisay City Senior High School', address: 'Talisay City, Cebu', lastGrade: basicGrade(3, 1), schoolYear: '2025-2026' },
  },
  {
    id: 12,
    studentId: 'CSHC-2025-0188',
    status: 'active',
    enrollmentDate: '2025-08-08T14:00:00',
    personal: {
      firstName: 'Jerome', middleName: 'Santos', lastName: 'Gatela',
      birthDate: '2005-08-11', age: 20, gender: 'Male',
      placeOfBirth: 'Talisay City', civilStatus: 'Single',
      religion: 'Born Again', nationality: 'Filipino',
      address: '14 Guadalupe St, Talisay City, Cebu',
      email: 'jerome.gatela@email.com', contactNumber: '09723456789',
    },
    academic: {
      campus: campusName('Talisay'), gradeLevel: collegeGrade('Talisay', 0, 1),
      section: 'Nursing 2-A', studentType: 'Returnee', schoolYear: SY, yearLevel: 'College',
    },
    parents: {
      father: { name: 'Nestor Gatela', occupation: 'Engineer',   contactNumber: '09833333333' },
      mother: { name: 'Vicky Gatela',  occupation: 'Accountant', contactNumber: '09844444444' },
    },
    previousSchool: { name: 'Talisay City Senior High School', address: 'Talisay City, Cebu', lastGrade: basicGrade(3, 1), schoolYear: '2024-2025' },
  },
  {
    id: 13,
    studentId: 'CSHC-2026-0006',
    status: 'active',
    enrollmentDate: '2026-02-23T10:00:00',
    personal: {
      firstName: 'Kyla', middleName: 'Maglinte', lastName: 'Abella',
      birthDate: '2004-12-01', age: 21, gender: 'Female',
      placeOfBirth: 'Cebu City', civilStatus: 'Single',
      religion: 'Roman Catholic', nationality: 'Filipino',
      address: '3 Mahayahay St, Talisay City, Cebu',
      email: 'kyla.abella@email.com', contactNumber: '09734567890',
    },
    academic: {
      campus: campusName('Talisay'), gradeLevel: collegeGrade('Talisay', 1, 0),
      section: 'HRM 1-A', studentType: 'New', schoolYear: SY, yearLevel: 'College',
    },
    parents: {
      father: { name: 'Pio Abella',     occupation: 'Hotel Manager', contactNumber: '09855555555' },
      mother: { name: 'Rosario Abella', occupation: 'Chef',          contactNumber: '09866666666' },
    },
    previousSchool: { name: 'Talisay City Senior High School', address: 'Talisay City, Cebu', lastGrade: basicGrade(3, 1), schoolYear: '2025-2026' },
  },
  {
    id: 14,
    studentId: 'CSHC-2026-0007',
    status: 'active',
    enrollmentDate: '2026-03-03T09:30:00',
    personal: {
      firstName: 'Daniel', middleName: 'Opena', lastName: 'Pepito',
      birthDate: '2006-03-22', age: 19, gender: 'Male',
      placeOfBirth: 'Talisay City', civilStatus: 'Single',
      religion: 'Roman Catholic', nationality: 'Filipino',
      address: '101 Tres Marias, Talisay City, Cebu',
      email: 'daniel.pepito@email.com', contactNumber: '09745678901',
    },
    academic: {
      campus: campusName('Talisay'), gradeLevel: collegeGrade('Talisay', 2, 0),
      section: 'Tourism 1-A', studentType: 'New', schoolYear: SY, yearLevel: 'College',
    },
    parents: {
      father: { name: 'Dante Pepito',  occupation: 'Tour Guide',  contactNumber: '09877777777' },
      mother: { name: 'Carmen Pepito', occupation: 'Travel Agent',contactNumber: '09888888888' },
    },
    previousSchool: { name: 'Talisay City Senior High School', address: 'Talisay City, Cebu', lastGrade: basicGrade(3, 1), schoolYear: '2025-2026' },
  },
  {
    id: 15,
    studentId: 'CSHC-2025-0220',
    status: 'active',
    enrollmentDate: '2025-08-10T10:00:00',
    personal: {
      firstName: 'Patricia', middleName: 'Urot', lastName: 'Mangubat',
      birthDate: '2004-06-17', age: 21, gender: 'Female',
      placeOfBirth: 'Talisay City', civilStatus: 'Single',
      religion: 'Roman Catholic', nationality: 'Filipino',
      address: '55 National Rd, Talisay City, Cebu',
      email: 'patricia.mangubat@email.com', contactNumber: '09756789012',
    },
    academic: {
      campus: campusName('Talisay'), gradeLevel: collegeGrade('Talisay', 0, 2),
      section: 'Nursing 3-A', studentType: 'Returnee', schoolYear: SY, yearLevel: 'College',
    },
    parents: {
      father: { name: 'Roger Mangubat',  occupation: 'Police Officer', contactNumber: '09899999999' },
      mother: { name: 'Sheryl Mangubat', occupation: 'Pharmacist',     contactNumber: '09900000000' },
    },
    previousSchool: { name: 'Talisay City Senior High School', address: 'Talisay City, Cebu', lastGrade: basicGrade(3, 1), schoolYear: '2023-2024' },
  },

  // ── INJECTED: Basic Ed students across all 3 campuses ────────────
// Talisay basic ed
,  {
    id: 16,
    studentId: 'CSHC-2026-0008',
    status: 'active',
    enrollmentDate: '2026-03-01T08:00:00',
    personal: {
      firstName: 'Lea', middleName: 'Bacalso', lastName: 'Villanueva',
      birthDate: '2018-06-12', age: 7, gender: 'Female',
      placeOfBirth: 'Talisay City', civilStatus: 'Single',
      religion: 'Roman Catholic', nationality: 'Filipino',
      address: '5 Katipunan St, Talisay City, Cebu',
      email: 'parent.villanueva@email.com', contactNumber: '09221234567',
    },
    academic: {
      campus: campusName('Talisay'), gradeLevel: basicGrade(0, 1),
      section: 'St. Teresa', studentType: 'New', schoolYear: SY, yearLevel: 'Pre-Elementary',
    },
    parents: {
      father: { name: 'Rex Villanueva',  occupation: 'Carpenter',  contactNumber: '09221234567' },
      mother: { name: 'Gina Villanueva', occupation: 'Housewife',  contactNumber: '09232345678' },
    },
    previousSchool: { name: 'N/A', address: 'N/A', lastGrade: 'N/A', schoolYear: 'N/A' },
  },
  {
    id: 17,
    studentId: 'CSHC-2025-0301',
    status: 'active',
    enrollmentDate: '2025-08-11T09:00:00',
    personal: {
      firstName: 'Ronel', middleName: 'Tagab', lastName: 'Fuentes',
      birthDate: '2014-03-20', age: 11, gender: 'Male',
      placeOfBirth: 'Talisay City', civilStatus: 'Single',
      religion: 'Roman Catholic', nationality: 'Filipino',
      address: '18 Magsaysay Ave, Talisay City, Cebu',
      email: 'fuentes.family@email.com', contactNumber: '09243456789',
    },
    academic: {
      campus: campusName('Talisay'), gradeLevel: basicGrade(1, 3),
      section: 'St. Joseph', studentType: 'Returnee', schoolYear: SY, yearLevel: 'Elementary',
    },
    parents: {
      father: { name: 'Danilo Fuentes',  occupation: 'Electrician', contactNumber: '09243456789' },
      mother: { name: 'Loreta Fuentes',  occupation: 'Teacher',     contactNumber: '09254567890' },
    },
    previousSchool: { name: 'Talisay Central Elementary School', address: 'Talisay City, Cebu', lastGrade: basicGrade(1, 2), schoolYear: '2024-2025' },
  },
  {
    id: 18,
    studentId: 'CSHC-2024-0402',
    status: 'active',
    enrollmentDate: '2024-06-05T10:30:00',
    personal: {
      firstName: 'Hazel', middleName: 'Cañete', lastName: 'Napoles',
      birthDate: '2011-09-08', age: 14, gender: 'Female',
      placeOfBirth: 'Talisay City', civilStatus: 'Single',
      religion: 'Roman Catholic', nationality: 'Filipino',
      address: '33 Poblacion, Talisay City, Cebu',
      email: 'napoles.fam@email.com', contactNumber: '09265678901',
    },
    academic: {
      campus: campusName('Talisay'), gradeLevel: basicGrade(2, 1),
      section: 'St. Francis', studentType: 'Returnee', schoolYear: SY, yearLevel: 'Junior High School',
    },
    parents: {
      father: { name: 'Mario Napoles',  occupation: 'Police Officer', contactNumber: '09265678901' },
      mother: { name: 'Cynthia Napoles',occupation: 'Nurse',          contactNumber: '09276789012' },
    },
    previousSchool: { name: 'Talisay National High School', address: 'Talisay City, Cebu', lastGrade: basicGrade(2, 0), schoolYear: '2023-2024' },
  },
  {
    id: 19,
    studentId: 'CSHC-2023-0511',
    status: 'active',
    enrollmentDate: '2023-06-12T11:00:00',
    personal: {
      firstName: 'Jayson', middleName: 'Uy', lastName: 'Balili',
      birthDate: '2008-12-01', age: 17, gender: 'Male',
      placeOfBirth: 'Talisay City', civilStatus: 'Single',
      religion: 'Iglesia ni Cristo', nationality: 'Filipino',
      address: '77 Linao, Talisay City, Cebu',
      email: 'balili.family@email.com', contactNumber: '09287890123',
    },
    academic: {
      campus: campusName('Talisay'), gradeLevel: basicGrade(3, 0),
      section: 'STEM-A', studentType: 'Returnee', schoolYear: SY, yearLevel: 'Senior High School',
    },
    parents: {
      father: { name: 'Erick Balili',  occupation: 'Engineer',   contactNumber: '09287890123' },
      mother: { name: 'Marian Balili', occupation: 'Pharmacist', contactNumber: '09298901234' },
    },
    previousSchool: { name: 'Talisay National High School', address: 'Talisay City, Cebu', lastGrade: basicGrade(2, 3), schoolYear: '2022-2023' },
  },

  // Carcar basic ed
  {
    id: 20,
    studentId: 'CSHC-2026-0009',
    status: 'active',
    enrollmentDate: '2026-03-02T08:30:00',
    personal: {
      firstName: 'Tricia', middleName: 'Abao', lastName: 'Montecillo',
      birthDate: '2019-02-15', age: 6, gender: 'Female',
      placeOfBirth: 'Carcar City', civilStatus: 'Single',
      religion: 'Roman Catholic', nationality: 'Filipino',
      address: '11 Parian, Carcar City, Cebu',
      email: 'montecillo.parent@email.com', contactNumber: '09311234567',
    },
    academic: {
      campus: campusName('Carcar'), gradeLevel: basicGrade(0, 0),
      section: 'St. Rose', studentType: 'New', schoolYear: SY, yearLevel: 'Pre-Elementary',
    },
    parents: {
      father: { name: 'Noel Montecillo',  occupation: 'Mechanic', contactNumber: '09311234567' },
      mother: { name: 'Girly Montecillo', occupation: 'Vendor',   contactNumber: '09322345678' },
    },
    previousSchool: { name: 'N/A', address: 'N/A', lastGrade: 'N/A', schoolYear: 'N/A' },
  },
  {
    id: 21,
    studentId: 'CSHC-2025-0388',
    status: 'active',
    enrollmentDate: '2025-08-09T09:15:00',
    personal: {
      firstName: 'Kyle', middleName: 'Daclan', lastName: 'Ando',
      birthDate: '2013-07-22', age: 12, gender: 'Male',
      placeOfBirth: 'Carcar City', civilStatus: 'Single',
      religion: 'Roman Catholic', nationality: 'Filipino',
      address: '4 Guadalupe, Carcar City, Cebu',
      email: 'ando.family@email.com', contactNumber: '09333456789',
    },
    academic: {
      campus: campusName('Carcar'), gradeLevel: basicGrade(1, 4),
      section: 'St. Michael', studentType: 'Returnee', schoolYear: SY, yearLevel: 'Elementary',
    },
    parents: {
      father: { name: 'Renato Ando',  occupation: 'Farmer',      contactNumber: '09333456789' },
      mother: { name: 'Norma Ando',   occupation: 'Store Owner', contactNumber: '09344567890' },
    },
    previousSchool: { name: 'Carcar Elementary School', address: 'Carcar City, Cebu', lastGrade: basicGrade(1, 3), schoolYear: '2024-2025' },
  },
  {
    id: 22,
    studentId: 'CSHC-2024-0456',
    status: 'active',
    enrollmentDate: '2024-06-10T10:00:00',
    personal: {
      firstName: 'Yna', middleName: 'Largo', lastName: 'Pepito',
      birthDate: '2010-11-11', age: 15, gender: 'Female',
      placeOfBirth: 'Carcar City', civilStatus: 'Single',
      religion: 'Roman Catholic', nationality: 'Filipino',
      address: '22 Bolinawan, Carcar City, Cebu',
      email: 'pepito.carcar@email.com', contactNumber: '09355678901',
    },
    academic: {
      campus: campusName('Carcar'), gradeLevel: basicGrade(2, 2),
      section: 'St. John', studentType: 'Returnee', schoolYear: SY, yearLevel: 'Junior High School',
    },
    parents: {
      father: { name: 'Rodrigo Pepito', occupation: 'Jeepney Driver', contactNumber: '09355678901' },
      mother: { name: 'Lita Pepito',    occupation: 'Dressmaker',     contactNumber: '09366789012' },
    },
    previousSchool: { name: 'Carcar National High School', address: 'Carcar City, Cebu', lastGrade: basicGrade(2, 1), schoolYear: '2023-2024' },
  },
  {
    id: 23,
    studentId: 'CSHC-2023-0522',
    status: 'active',
    enrollmentDate: '2023-06-08T11:30:00',
    personal: {
      firstName: 'Lester', middleName: 'Castaños', lastName: 'Bonita',
      birthDate: '2007-05-30', age: 18, gender: 'Male',
      placeOfBirth: 'Carcar City', civilStatus: 'Single',
      religion: 'Roman Catholic', nationality: 'Filipino',
      address: '15 Pitalo, Carcar City, Cebu',
      email: 'bonita.family@email.com', contactNumber: '09377890123',
    },
    academic: {
      campus: campusName('Carcar'), gradeLevel: basicGrade(3, 1),
      section: 'ABM-A', studentType: 'Returnee', schoolYear: SY, yearLevel: 'Senior High School',
    },
    parents: {
      father: { name: 'Ramon Bonita',  occupation: 'Accountant', contactNumber: '09377890123' },
      mother: { name: 'Teresita Bonita',occupation: 'Teacher',   contactNumber: '09388901234' },
    },
    previousSchool: { name: 'Carcar National High School', address: 'Carcar City, Cebu', lastGrade: basicGrade(2, 3), schoolYear: '2022-2023' },
  },

  // Bohol basic ed
  {
    id: 24,
    studentId: 'CSHC-2026-0010',
    status: 'active',
    enrollmentDate: '2026-03-03T08:00:00',
    personal: {
      firstName: 'Aileen', middleName: 'Sabornido', lastName: 'Dimzon',
      birthDate: '2019-04-18', age: 6, gender: 'Female',
      placeOfBirth: 'Tagbilaran City', civilStatus: 'Single',
      religion: 'Roman Catholic', nationality: 'Filipino',
      address: '9 CPG Ave, Tagbilaran City, Bohol',
      email: 'dimzon.parent@email.com', contactNumber: '09411234567',
    },
    academic: {
      campus: campusName('Bohol'), gradeLevel: basicGrade(0, 2),
      section: 'St. Clare', studentType: 'New', schoolYear: SY, yearLevel: 'Pre-Elementary',
    },
    parents: {
      father: { name: 'Jun Dimzon',    occupation: 'Fisherman',  contactNumber: '09411234567' },
      mother: { name: 'Marivic Dimzon',occupation: 'Midwife',    contactNumber: '09422345678' },
    },
    previousSchool: { name: 'N/A', address: 'N/A', lastGrade: 'N/A', schoolYear: 'N/A' },
  },
  {
    id: 25,
    studentId: 'CSHC-2025-0412',
    status: 'active',
    enrollmentDate: '2025-08-06T09:30:00',
    personal: {
      firstName: 'Alvin', middleName: 'Taghap', lastName: 'Gabito',
      birthDate: '2014-08-14', age: 11, gender: 'Male',
      placeOfBirth: 'Tagbilaran City', civilStatus: 'Single',
      religion: 'Roman Catholic', nationality: 'Filipino',
      address: '3 Mansasa, Tagbilaran City, Bohol',
      email: 'gabito.family@email.com', contactNumber: '09433456789',
    },
    academic: {
      campus: campusName('Bohol'), gradeLevel: basicGrade(1, 5),
      section: 'St. Therese', studentType: 'Returnee', schoolYear: SY, yearLevel: 'Elementary',
    },
    parents: {
      father: { name: 'Rommel Gabito', occupation: 'Government Employee', contactNumber: '09433456789' },
      mother: { name: 'Susan Gabito',  occupation: 'Housewife',           contactNumber: '09444567890' },
    },
    previousSchool: { name: 'Tagbilaran Central School', address: 'Tagbilaran City, Bohol', lastGrade: basicGrade(1, 4), schoolYear: '2024-2025' },
  },
  {
    id: 26,
    studentId: 'CSHC-2024-0489',
    status: 'active',
    enrollmentDate: '2024-06-07T10:00:00',
    personal: {
      firstName: 'Shaina', middleName: 'Ondoy', lastName: 'Pajo',
      birthDate: '2011-03-25', age: 14, gender: 'Female',
      placeOfBirth: 'Tagbilaran City', civilStatus: 'Single',
      religion: 'Roman Catholic', nationality: 'Filipino',
      address: '55 Cogon, Tagbilaran City, Bohol',
      email: 'pajo.family@email.com', contactNumber: '09455678901',
    },
    academic: {
      campus: campusName('Bohol'), gradeLevel: basicGrade(2, 3),
      section: 'St. Raphael', studentType: 'Returnee', schoolYear: SY, yearLevel: 'Junior High School',
    },
    parents: {
      father: { name: 'Arnel Pajo',    occupation: 'Tricycle Driver', contactNumber: '09455678901' },
      mother: { name: 'Danilou Pajo',  occupation: 'Market Vendor',   contactNumber: '09466789012' },
    },
    previousSchool: { name: 'Tagbilaran National High School', address: 'Tagbilaran City, Bohol', lastGrade: basicGrade(2, 2), schoolYear: '2023-2024' },
  },
  {
    id: 27,
    studentId: 'CSHC-2023-0566',
    status: 'active',
    enrollmentDate: '2023-06-09T11:00:00',
    personal: {
      firstName: 'Ian', middleName: 'Cortes', lastName: 'Villasis',
      birthDate: '2007-10-07', age: 18, gender: 'Male',
      placeOfBirth: 'Tagbilaran City', civilStatus: 'Single',
      religion: 'Roman Catholic', nationality: 'Filipino',
      address: '12 Bool, Tagbilaran City, Bohol',
      email: 'villasis.family@email.com', contactNumber: '09477890123',
    },
    academic: {
      campus: campusName('Bohol'), gradeLevel: basicGrade(3, 0),
      section: 'HUMSS-A', studentType: 'Returnee', schoolYear: SY, yearLevel: 'Senior High School',
    },
    parents: {
      father: { name: 'Bernardo Villasis',occupation: 'Fisherman',     contactNumber: '09477890123' },
      mother: { name: 'Florita Villasis', occupation: 'Barangay Worker',contactNumber: '09488901234' },
    },
    previousSchool: { name: 'Tagbilaran National High School', address: 'Tagbilaran City, Bohol', lastGrade: basicGrade(2, 3), schoolYear: '2022-2023' },
  },
]