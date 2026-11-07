import { describe, it, expect } from 'vitest'
import {
  getSubjectLoadData, setBasicEdSubjectArea, setBasicEdSubjectAreas, assignBasicEdLoad,
} from '../utils/subjectLoadBridge'

const CAMPUS = 'carcar', SY = '2026-2027', GRADE = 'Grade 7', SUBJECT = 'Mathematics'
const load = () => getSubjectLoadData(CAMPUS, SY, 'Carcar City Campus', [])
  .basicEdLoads.find(l => l.gradeLevel === GRADE && l.subject === SUBJECT)

describe('Basic Ed subject area', () => {
  it('can be set before any teacher is assigned, and it persists', () => {
    load()  // creates the school-year record
    setBasicEdSubjectArea(CAMPUS, SY, GRADE, SUBJECT, 'science_math')
    expect(load()).toMatchObject({ subjectArea: 'science_math', teacherId: null })
  })

  it('is kept when a teacher is assigned and when the teacher is changed', () => {
    load()
    setBasicEdSubjectArea(CAMPUS, SY, GRADE, SUBJECT, 'science_math')
    assignBasicEdLoad(CAMPUS, SY, GRADE, SUBJECT, { id: 't1', name: 'Ms. One' })
    expect(load()).toMatchObject({ subjectArea: 'science_math', teacherId: 't1' })
    assignBasicEdLoad(CAMPUS, SY, GRADE, SUBJECT, { id: 't2', name: 'Mr. Two' })
    expect(load()).toMatchObject({ subjectArea: 'science_math', teacherId: 't2', teacherName: 'Mr. Two' })
  })

  it('the batch setter changes only loads that exist and reports how many changed', () => {
    load()
    assignBasicEdLoad(CAMPUS, SY, GRADE, SUBJECT, { id: 't1', name: 'Ms. One' })
    const changed = setBasicEdSubjectAreas(CAMPUS, SY, [
      { gradeLevel: GRADE, subject: SUBJECT, area: 'science_math' },
      { gradeLevel: GRADE, subject: 'No Such Subject', area: 'x' },
    ])
    expect(changed).toBe(1)
    // the same values again write nothing
    expect(setBasicEdSubjectAreas(CAMPUS, SY, [{ gradeLevel: GRADE, subject: SUBJECT, area: 'science_math' }])).toBe(0)
  })
})
