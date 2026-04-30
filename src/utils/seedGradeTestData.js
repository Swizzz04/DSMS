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

  // Assign subjects to Maria Santos for Grade 7
  const subjects = ['Filipino', 'English', 'Mathematics', 'Science']
  subjects.forEach(subject => {
    const existing = syData.basicEdLoads.find(l => l.gradeLevel === 'Grade 7' && l.subject === subject)
    if (!existing) {
      syData.basicEdLoads.push({
        id: `be_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        gradeLevel: 'Grade 7',
        subject,
        teacherId,
        teacherName,
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
    { first: 'ANGELA', last: 'REYES', middle: 'CRUZ' },
    { first: 'BRIAN', last: 'SANTOS', middle: 'DELA' },
    { first: 'CATHERINE', last: 'GARCIA', middle: 'LOPEZ' },
    { first: 'DANIEL', last: 'MENDOZA', middle: 'BAUTISTA' },
    { first: 'ELENA', last: 'FERNANDEZ', middle: 'RAMOS' },
    { first: 'FRANCO', last: 'VILLANUEVA', middle: 'PEREZ' },
    { first: 'GRACE', last: 'ESPINOSA', middle: 'RIVERA' },
    { first: 'HENRY', last: 'NAVARRO', middle: 'CRUZ' },
    { first: 'IRIS', last: 'PASCUAL', middle: 'TORRES' },
    { first: 'JAMES', last: 'AQUINO', middle: 'SANTOS' },
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
  console.log('   - 4 subjects assigned to Maria Santos (Grade 7)')
  console.log('   - 10 approved students in Grade 7')
  console.log('   - 1 section: Grade 7 - St. Augustine')
  console.log('')
  console.log('Login as: teacher.santos@cshc.edu.ph / teacher123')
  console.log('Go to: e-Class Record → click any subject → enter grades')

  return true
}

// Auto-run if loaded directly
if (typeof window !== 'undefined') {
  window.seedGradeTestData = seedGradeTestData
}