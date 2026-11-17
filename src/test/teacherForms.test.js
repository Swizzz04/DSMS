import { describe, it, expect } from 'vitest'
import { normaliseStudent, normaliseSex, buildSF1Data } from '../utils/teacherFormsBridge'

// The three shapes a student can arrive in
const FROM_ENROLLMENT = {
  id: 'ENR-1', referenceNumber: 'ENR-1', status: 'approved',
  student: { firstName: 'Ana', middleName: 'Cruz', lastName: 'Reyes', birthDate: '2013-08-15', gender: 'Female',
             religion: 'Catholic', address: 'Purok 1, Carcar', contactNumber: '0917' },
  father: { name: 'Pedro Reyes' }, mother: { name: 'Maria Reyes' },
  enrollment: { campus: 'Carcar City Campus', gradeLevel: 'Grade 7', section: 'A', schoolYear: '2026-2027' },
}
const FROM_STUDENTS_STORE = {
  id: 'stu-1', studentId: '2026000001', firstName: 'Ben', lastName: 'Lim', birthDate: '2012-02-01T00:00:00.000Z', gender: 'Male',
  gradeLevel: 'Grade 7', section: 'A', campusName: 'Carcar City Campus', schoolYear: '2026-2027',
}
const OLD_FLAT = { id: 'x', firstName: 'Cy', lastName: 'Go', sex: 'F', birthdate: '2011-05-05', gradeLevel: 'Grade 7', section: 'A' }

describe('normaliseSex', () => {
  it.each([['Male', 'M'], ['female', 'F'], ['M', 'M'], ['f', 'F'], [' MALE ', 'M']])('%s -> %s', (i, o) => {
    expect(normaliseSex(i)).toBe(o)
  })
  it('is blank when unknown, never a guess', () => {
    expect(normaliseSex('')).toBe('')
    expect(normaliseSex(null)).toBe('')
    expect(normaliseSex('other')).toBe('')
  })
})

describe('normaliseStudent reads sex and birthdate from every store (5.5)', () => {
  it('enrollment submission: student.gender and student.birthDate', () => {
    const n = normaliseStudent(FROM_ENROLLMENT)
    expect(n.sex).toBe('F')
    expect(n.birthdate).toBe('2013-08-15')
    expect(n.fatherName).toBe('Pedro Reyes')
    expect(n.motherName).toBe('Maria Reyes')
    expect(n.religion).toBe('Catholic')
    expect(n.address).toBe('Purok 1, Carcar')
  })
  it('students store: top-level gender and birthDate, time part dropped', () => {
    const n = normaliseStudent(FROM_STUDENTS_STORE)
    expect(n.sex).toBe('M')
    expect(n.birthdate).toBe('2012-02-01')
  })
  it('older flat records keep working', () => {
    const n = normaliseStudent(OLD_FLAT)
    expect(n.sex).toBe('F')
    expect(n.birthdate).toBe('2011-05-05')
  })
  it('a record with neither field gives blanks, not a crash', () => {
    const n = normaliseStudent({ id: 'z', firstName: 'No', lastName: 'Data' })
    expect(n.sex).toBe('')
    expect(n.birthdate).toBe('')
  })
})

describe('SF1 end to end', () => {
  it('prints sex and birthdate for an approved enrollment', () => {
    localStorage.setItem('almirene_submissions', JSON.stringify([FROM_ENROLLMENT]))
    const sf1 = buildSF1Data('Carcar City Campus', 'Grade 7', 'A', '2026-2027')
    expect(sf1.students).toHaveLength(1)
    expect(sf1.students[0]).toMatchObject({ name: 'Reyes, Ana C.', sex: 'F', birthdate: '2013-08-15', fatherName: 'Pedro Reyes' })
    expect(sf1.students[0].age).not.toBe('')
  })
})
