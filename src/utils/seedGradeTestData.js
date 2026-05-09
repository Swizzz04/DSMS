/**
 * seedGradeTestData.js
 * ─────────────────────────────────────────────────────────────────
 * Run this ONCE to populate localStorage with mock data for testing
 * the e-Class Record grade entry. Creates:
 *   - Subject load assignments for teacher Maria Santos (id: 19)
 *   - 10 approved student enrollments in Grade 7
 *   - Sections for Grade 7
 *
 * Usage: Import and call seedGradeTestData() from browser console
 *   or add a temp button. Delete after testing.
 *
 * To seed from browser console:
 *   Copy-paste this entire file's content into console and run seedGradeTestData()
 * ─────────────────────────────────────────────────────────────────
 */

export function seedGradeTestData() {
  const campusKey = 'Carcar'
  const campusName = 'Carcar City Campus'
  // Detect active school year from config
  const schoolYear = (() => {
    try {
      const cfg = JSON.parse(localStorage.getItem('cshc_app_config') || '{}')
      const years = cfg.schoolYears || []
      const current = years.find(sy => sy.isCurrent)
      return current?.year || '2026-2027'
    } catch { return '2026-2027' }
  })()
  const teacherId = 19
  const teacherName = 'Maria Santos'

  // ── 1. Seed Subject Loads ──────────────────────────────────
  const existingLoads = JSON.parse(localStorage.getItem('cshc_subject_loads') || '{}')

  if (!existingLoads[campusKey]) existingLoads[campusKey] = {}
  if (!existingLoads[campusKey][schoolYear]) {
    existingLoads[campusKey][schoolYear] = {
      maxPerSection: 40,
      basicEdSubjects: {
        'Grade 7': ['Filipino', 'English', 'Mathematics', 'Science', 'Araling Panlipunan', 'MAPEH', 'TLE', 'Values Education'],
        'Grade 8': ['Filipino', 'English', 'Mathematics', 'Science', 'Araling Panlipunan', 'MAPEH', 'TLE', 'Values Education'],
      },
      basicEdLoads: [],
      basicEdAdvisers: [],
      basicEdSections: {},
      collegeSubjects: {},
      collegeLoads: [],
      collegeSections: {},
    }
  }

  const syData = existingLoads[campusKey][schoolYear]

  // Assign subjects to teachers for Grade 7
  // Maria Santos (id: 19) = Filipino, English, Math, Science, Music & Arts
  // Juan dela Cruz (id: 20) = PE & Health, TLE, Computer
  const teacherAssignments = [
    { subject: 'Filipino',       teacherId: 19, teacherName: 'Maria Santos' },
    { subject: 'English',        teacherId: 19, teacherName: 'Maria Santos' },
    { subject: 'Mathematics',    teacherId: 19, teacherName: 'Maria Santos' },
    { subject: 'Science',        teacherId: 19, teacherName: 'Maria Santos' },
    { subject: 'Music & Arts',   teacherId: 19, teacherName: 'Maria Santos' },
    { subject: 'PE & Health',    teacherId: 20, teacherName: 'Juan dela Cruz' },
    { subject: 'TLE',            teacherId: 20, teacherName: 'Juan dela Cruz' },
    { subject: 'Computer',       teacherId: 20, teacherName: 'Juan dela Cruz' },
  ]

  teacherAssignments.forEach(({ subject, teacherId: tid, teacherName: tname }) => {
    const existing = syData.basicEdLoads.find(l => l.gradeLevel === 'Grade 7' && l.subject === subject)
    if (!existing) {
      syData.basicEdLoads.push({
        id: `be_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        gradeLevel: 'Grade 7',
        subject,
        teacherId: tid,
        teacherName: tname,
        updatedAt: new Date().toISOString(),
      })
    }
  })

  // Create sections for Grade 7
  syData.basicEdSections['Grade 7'] = [
    { id: 'g7_sec_a', defaultName: 'Grade 7 - Section A', displayName: 'Grade 7 - St. Augustine', studentCount: 10 },
  ]

  localStorage.setItem('cshc_subject_loads', JSON.stringify(existingLoads))

  // ── 2. Seed Approved Students ──────────────────────────────
  const existingSubs = JSON.parse(localStorage.getItem('cshc_submissions') || '[]')

  const studentNames = [
    { first: 'ANGELA', last: 'REYES', middle: 'CRUZ', gender: 'female' },
    { first: 'BRIAN', last: 'SANTOS', middle: 'DELA', gender: 'male' },
    { first: 'CATHERINE', last: 'GARCIA', middle: 'LOPEZ', gender: 'female' },
    { first: 'DANIEL', last: 'MENDOZA', middle: 'BAUTISTA', gender: 'male' },
    { first: 'ELENA', last: 'FERNANDEZ', middle: 'RAMOS', gender: 'female' },
    { first: 'FRANCO', last: 'VILLANUEVA', middle: 'PEREZ', gender: 'male' },
    { first: 'GRACE', last: 'ESPINOSA', middle: 'RIVERA', gender: 'female' },
    { first: 'HENRY', last: 'NAVARRO', middle: 'CRUZ', gender: 'male' },
    { first: 'IRIS', last: 'PASCUAL', middle: 'TORRES', gender: 'female' },
    { first: 'JAMES', last: 'AQUINO', middle: 'SANTOS', gender: 'male' },
  ]

  // Only add if we don't already have Grade 7 students
  const existingG7 = existingSubs.filter(s =>
    s.status === 'approved' &&
    s.enrollment?.campus === campusName &&
    s.enrollment?.gradeLevel === 'Grade 7'
  )

  if (existingG7.length === 0) {
    studentNames.forEach((name, idx) => {
      existingSubs.push({
        id: `mock_stu_${1000 + idx}`,
        referenceNumber: `CSHC-2025-M${String(idx + 1).padStart(4, '0')}`,
        firstName: name.first,
        lastName: name.last,
        middleName: name.middle,
        gender: name.gender,
        status: 'approved',
        enrollment: {
          campus: campusName,
          gradeLevel: 'Grade 7',
          studentType: 'new',
          schoolYear,
        },
        submittedDate: new Date().toISOString(),
      })
    })

    localStorage.setItem('cshc_submissions', JSON.stringify(existingSubs))
  }

  console.log('✅ Grade test data seeded!')
  console.log('   - 8 subjects assigned across 2 teachers (Grade 7)')
  console.log('     Maria Santos: Filipino, English, Math, Science, Music & Arts')
  console.log('     Juan dela Cruz: PE & Health, TLE, Computer')
  console.log('   - 10 approved students (5 boys, 5 girls)')
  console.log('   - 1 section: Grade 7 - St. Augustine')
  console.log('')
  console.log('Test MAPEH merge: Login as Maria Santos → enter Music & Arts grades')
  console.log('                  Login as Juan dela Cruz → enter PE & Health grades')
  console.log('                  Both will see the MAPEH merged grade card')
  console.log('')
  console.log('Maria Santos:    teacher.santos@cshc.edu.ph / teacher123')
  console.log('Juan dela Cruz:  teacher.delacruz@cshc.edu.ph / teacher123')

  return true
}

// Auto-run if loaded directly
if (typeof window !== 'undefined') {
  window.seedGradeTestData = seedGradeTestData
}