import { describe, it, expect } from 'vitest'
import {
  summarizePaid, buildAccounts, summarizeOverdue, gradeBreakdown, collectedByMethod, METHOD_NOT_RECORDED,
} from '../utils/reportStats'

const TODAY = '2026-11-11'

// Three students: A paid in full, B still owes and is on time, C still owes and is overdue.
// A pays twice (counted once). D owes and is overdue but made no payment in the period.
const tx = (refNum, gradeLevel, balance, amount, method) => ({ refNum, gradeLevel, balance, amount, method })
const TXS = [
  tx('A', 'Grade 7',  0,    1000, 'Cash'),
  tx('A', 'Grade 7',  0,    500,  'GCash'),
  tx('B', 'Grade 7',  2000, 800,  'Bank Transfer'),
  tx('C', 'Grade 8',  3000, 400,  'Cash'),
]
const sub = (referenceNumber, grade, balance, dueDate, name = 'X') => ({
  referenceNumber, balance, dueDate,
  student: { fullName: name }, enrollment: { gradeLevel: grade, campus: 'Carcar City Campus' },
})
const SUBS = [
  sub('A', 'Grade 7', 0,    '2026-10-01', 'Ann'),
  sub('B', 'Grade 7', 2000, '2026-12-01', 'Ben'),
  sub('C', 'Grade 8', 3000, '2026-10-01', 'Cy'),
  sub('D', 'Grade 8', 500,  '2026-11-01', 'Dee'),
]
const ACCOUNTS = buildAccounts(SUBS, s => s.dueDate, TODAY)

describe('summarizePaid (cards)', () => {
  it('counts each student once and splits fully paid from partial', () => {
    expect(summarizePaid(TXS)).toEqual({ students: 3, fullyPaid: 1, partial: 2, collected: 2700 })
  })
  it('is empty for no transactions', () => {
    expect(summarizePaid([])).toEqual({ students: 0, fullyPaid: 0, partial: 0, collected: 0 })
  })
})

describe('buildAccounts / summarizeOverdue', () => {
  it('overdue = balance left AND due date passed; paid and on-time are not overdue', () => {
    expect(ACCOUNTS.map(a => [a.refNum, a.status])).toEqual([
      ['A', 'paid'], ['B', 'partial'], ['C', 'overdue'], ['D', 'overdue'],
    ])
  })
  it('counts days past the due date', () => {
    expect(ACCOUNTS.find(a => a.refNum === 'C').daysOverdue).toBe(41)
    expect(ACCOUNTS.find(a => a.refNum === 'D').daysOverdue).toBe(10)
    expect(ACCOUNTS.find(a => a.refNum === 'B').daysOverdue).toBe(0)
  })
  it('summarises count, outstanding balance and the oldest account', () => {
    expect(summarizeOverdue(ACCOUNTS)).toEqual({ count: 2, outstanding: 3500, oldestDays: 41 })
  })
  it('respects a grade filter', () => {
    expect(summarizeOverdue(ACCOUNTS, g => g === 'Grade 7').count).toBe(0)
  })
})

describe('gradeBreakdown (table) uses the same basis as the cards', () => {
  const rows = gradeBreakdown(TXS, ACCOUNTS)
  const sum = (key) => rows.reduce((s, r) => s + r[key], 0)

  it('column totals equal the cards when no grade filter is on', () => {
    const cards = summarizePaid(TXS)
    expect(sum('students')).toBe(cards.students)
    expect(sum('paid')).toBe(cards.fullyPaid)
    expect(sum('partial')).toBe(cards.partial)
    expect(sum('collected')).toBe(cards.collected)
    expect(sum('overdue')).toBe(summarizeOverdue(ACCOUNTS).count)
  })
  it('keeps an overdue student with no payment in the period visible through Overdue', () => {
    expect(rows.find(r => r.label === 'Grade 8')).toMatchObject({ students: 1, overdue: 2 })
  })
  it('applies the grade filter to every column', () => {
    expect(gradeBreakdown(TXS, ACCOUNTS, g => g === 'Grade 7')).toEqual([
      { label: 'Grade 7', students: 2, paid: 1, partial: 1, collected: 2300, overdue: 0 },
    ])
  })
})

describe('collectedByMethod (5.1)', () => {
  it('lists Cash first, then each other method actually used, largest first', () => {
    expect(collectedByMethod(TXS)).toEqual([
      { method: 'Cash', total: 1400 },
      { method: 'GCash', total: 500 },
      { method: 'Bank Transfer', total: 800 },
    ].sort((a, b) => (a.method === 'Cash' ? -1 : b.method === 'Cash' ? 1 : b.total - a.total)))
  })
  it('does not call GCash or cheque money "Bank Transfer"', () => {
    const names = collectedByMethod([tx('Z', 'Grade 7', 0, 100, 'GCash'), tx('Y', 'Grade 7', 0, 50, 'Cheque')]).map(m => m.method)
    expect(names).toEqual(['GCash', 'Cheque'])
  })
  it('does not lose payments recorded without a method', () => {
    const list = collectedByMethod([tx('Z', 'Grade 7', 0, 100, undefined)])
    expect(list).toEqual([{ method: METHOD_NOT_RECORDED, total: 100 }])
  })
  it('the method totals add up to the total collected', () => {
    expect(collectedByMethod(TXS).reduce((s, m) => s + m.total, 0)).toBe(summarizePaid(TXS).collected)
  })
})
