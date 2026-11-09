import { describe, it, expect } from 'vitest'
import { updateSubmissionStatus, getSubmissionStudentId, ensureStudentIds, getWebsiteSubmissions } from '../utils/enrollmentBridge'

const seed = (list) => localStorage.setItem('almirene_submissions', JSON.stringify(list))
const sub = (ref, over = {}) => ({
  id: ref, referenceNumber: ref, status: 'pending',
  submittedDate: '2026-06-01T00:00:00.000Z', enrollment: { schoolYear: '2026-2027' }, ...over,
})

describe('student ID: school year + 6-digit sequence, issued once on first approval', () => {
  it('issues 2026000001 for the first approval', () => {
    seed([sub('R1')])
    expect(updateSubmissionStatus('R1', 'approved')).toBe(true)
    expect(getSubmissionStudentId('R1')).toBe('2026000001')
  })

  it('never repeats and counts on across enrollees', () => {
    seed([sub('R1'), sub('R2'), sub('R3')])
    ;['R1', 'R2', 'R3'].forEach(r => updateSubmissionStatus(r, 'approved'))
    const ids = ['R1', 'R2', 'R3'].map(getSubmissionStudentId)
    expect(ids).toEqual(['2026000001', '2026000002', '2026000003'])
  })

  it('an approved record keeps its ID when its status changes again', () => {
    seed([sub('R1')])
    updateSubmissionStatus('R1', 'approved')
    const first = getSubmissionStudentId('R1')
    updateSubmissionStatus('R1', 'pending')
    updateSubmissionStatus('R1', 'approved')
    expect(getSubmissionStudentId('R1')).toBe(first)
  })

  it('a new school year changes the prefix but the counter continues', () => {
    seed([sub('R1'), sub('R2', { enrollment: { schoolYear: '2027-2028' } })])
    updateSubmissionStatus('R1', 'approved')
    updateSubmissionStatus('R2', 'approved')
    expect(getSubmissionStudentId('R2')).toBe('2027000002')
  })

  it('the counter is guarded by the highest ID already on a record', () => {
    seed([sub('R1', { status: 'approved', studentId: '2026000450' }), sub('R2')])
    updateSubmissionStatus('R2', 'approved')
    expect(getSubmissionStudentId('R2')).toBe('2026000451')
  })

  it('records that are not approved have no ID', () => {
    seed([sub('R1')])
    updateSubmissionStatus('R1', 'payment_received')
    expect(getSubmissionStudentId('R1')).toBe('')
  })

  it('backfill gives IDs to old approved records, oldest approval first, and is safe to repeat', () => {
    seed([
      sub('B', { status: 'approved', updatedAt: '2026-07-02T00:00:00.000Z' }),
      sub('A', { status: 'approved', updatedAt: '2026-07-01T00:00:00.000Z' }),
      sub('C'),
    ])
    expect(ensureStudentIds()).toBe(2)
    expect(getSubmissionStudentId('A')).toBe('2026000001')
    expect(getSubmissionStudentId('B')).toBe('2026000002')
    expect(getSubmissionStudentId('C')).toBe('')
    expect(ensureStudentIds()).toBe(0)
    expect(getWebsiteSubmissions().find(s => s.id === 'A').studentId).toBe('2026000001')
  })

  it('a student already in the students store keeps the ID it has there', () => {
    seed([sub('R1')])
    localStorage.setItem('almirene_students', JSON.stringify([{ id: 'R1', studentId: '2026000007' }]))
    updateSubmissionStatus('R1', 'approved')
    expect(getSubmissionStudentId('R1')).toBe('2026000007')
  })

  it('an unknown reference changes nothing', () => {
    seed([sub('R1')])
    expect(updateSubmissionStatus('nope', 'approved')).toBe(false)
  })
})
