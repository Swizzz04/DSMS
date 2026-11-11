/**
 * reportStats.js — the counting rules behind the Income Reports page (Reports.jsx).
 * Pure functions, no React and no localStorage, so the stat cards and the grade table
 * always use the same rules and the rules can be unit-tested.
 *
 * Basis (Step 5.2): "students who paid in the period". Every number on the cards and in
 * the grade table starts from the same filtered transactions. One student is counted
 * once, however many payments they made.
 *   Fully Paid = the student's current balance is 0 or less
 *   Partial    = they paid in the period but still owe (this includes overdue accounts)
 * Overdue (Step 5.3) is a separate measure and does NOT depend on the period: an account
 * is overdue when it still owes a balance and its due date has passed (same rule as the
 * Payments page, config/appConfig.js isPastDue).
 */
import { isPastDue, daysPast } from '../config/appConfig'

/** Method label for payments recorded without one. */
export const METHOD_NOT_RECORDED = 'Not recorded'

/**
 * Unique students behind a list of transactions.
 * @param {Array} txs transactions with refNum, gradeLevel, balance, amount
 * @returns {Map<string, {refNum, grade, balance, collected}>}
 */
export function studentsFromTxs(txs) {
  const map = new Map()
  ;(txs || []).forEach(tx => {
    const key = tx.refNum
    if (!map.has(key)) {
      map.set(key, { refNum: key, grade: tx.gradeLevel || 'Unknown', balance: tx.balance || 0, collected: 0 })
    }
    map.get(key).collected += tx.amount || 0
  })
  return map
}

/** Cards: students paid, fully paid, partial and the money collected. */
export function summarizePaid(txs) {
  const students = [...studentsFromTxs(txs).values()]
  const fullyPaid = students.filter(s => s.balance <= 0).length
  return {
    students:  students.length,
    fullyPaid,
    partial:   students.length - fullyPaid,
    collected: students.reduce((sum, s) => sum + s.collected, 0),
  }
}

/**
 * One row per account that has a recorded payment: its status and how many days overdue.
 * @param {Array} subs enrollment submissions that already have a payment
 * @param {(sub) => string} getDueDate returns 'YYYY-MM-DD' or ''
 * @param {string} today 'YYYY-MM-DD'
 */
export function buildAccounts(subs, getDueDate, today) {
  return (subs || []).map(sub => {
    const balance = sub.balance || 0
    const dueDate = getDueDate(sub) || ''
    const overdue = balance > 0 && isPastDue(dueDate, today)
    return {
      refNum:      sub.referenceNumber,
      name:        sub.student?.fullName ||
                   `${(sub.student?.lastName || '').toUpperCase()}, ${(sub.student?.firstName || '').toUpperCase()}`,
      grade:       sub.enrollment?.gradeLevel || 'Unknown',
      campus:      sub.enrollment?.campus || '',
      balance,
      dueDate,
      status:      balance <= 0 ? 'paid' : overdue ? 'overdue' : 'partial',
      daysOverdue: overdue ? daysPast(dueDate, today) : 0,
    }
  })
}

/** Overdue card: how many accounts, how much they owe, and how long the oldest has been overdue. */
export function summarizeOverdue(accounts, include = () => true) {
  const rows = (accounts || []).filter(a => a.status === 'overdue' && include(a.grade))
  return {
    count:       rows.length,
    outstanding: rows.reduce((sum, a) => sum + a.balance, 0),
    oldestDays:  rows.reduce((max, a) => Math.max(max, a.daysOverdue), 0),
  }
}

/**
 * Grade / program table. Students, fully paid, partial and collected come from the same
 * transactions as the cards; overdue comes from accounts (all periods).
 * @param {(grade: string) => boolean} include department / grade filter for this table
 */
export function gradeBreakdown(txs, accounts, include = () => true) {
  const rows = new Map()
  const row = (grade) => {
    if (!rows.has(grade)) rows.set(grade, { label: grade, students: 0, paid: 0, partial: 0, collected: 0, overdue: 0 })
    return rows.get(grade)
  }
  studentsFromTxs(txs).forEach(s => {
    if (!include(s.grade)) return
    const r = row(s.grade)
    r.students++
    if (s.balance <= 0) r.paid++; else r.partial++
    r.collected += s.collected
  })
  ;(accounts || []).forEach(a => {
    if (a.status === 'overdue' && include(a.grade)) row(a.grade).overdue++
  })
  return [...rows.values()]
    .filter(r => r.collected > 0 || r.overdue > 0)
    .sort((a, b) => b.collected - a.collected)
}

/**
 * Money collected by payment method, one entry per method actually used (Step 5.1).
 * Cash first, then every other method largest first. Nothing is hardcoded to "Bank Transfer",
 * so a new method added in Settings shows up here without code changes.
 */
export function collectedByMethod(txs) {
  const totals = new Map()
  ;(txs || []).forEach(tx => {
    const method = tx.method || METHOD_NOT_RECORDED
    totals.set(method, (totals.get(method) || 0) + (tx.amount || 0))
  })
  const list = [...totals.entries()].map(([method, total]) => ({ method, total }))
  return [
    ...list.filter(m => m.method === 'Cash'),
    ...list.filter(m => m.method !== 'Cash').sort((a, b) => b.total - a.total),
  ]
}
