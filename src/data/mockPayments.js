/**
 * mockPayments.js — expanded to cover all campuses, departments, and programs
 * All grade levels/programs are derived from appConfig (dynamic).
 */
import { CAMPUSES, BASIC_ED_GROUPS, COLLEGE_YEAR_LEVELS } from '../config/appConfig'

const campusName  = (key) => CAMPUSES.find(c => c.key === key)?.name ?? key
const basicGrade  = (groupIndex, optionIndex) => BASIC_ED_GROUPS[groupIndex]?.options[optionIndex] ?? 'Grade 1'
const collegeGrade = (campusKey, programIndex = 0, yearIndex = 0) => {
  const programs = CAMPUSES.find(c => c.key === campusKey)?.collegePrograms ?? []
  const program  = programs[programIndex] ?? programs[0]
  const year     = COLLEGE_YEAR_LEVELS[yearIndex] ?? COLLEGE_YEAR_LEVELS[0]
  return program ? `${program} - ${year}` : 'College'
}

let idCounter = 1
const mkPay = (studentId, studentName, gradeLevel, campus, totalFee, amountPaid, method, lastDate, dueDate, histories) => {
  const balance = totalFee - amountPaid
  const status  = balance === 0 ? 'paid' : new Date(dueDate) < new Date() && balance > 0 ? 'overdue' : amountPaid === 0 ? 'pending' : 'partial'
  return {
    id: idCounter++, studentId, studentName, gradeLevel, campus,
    totalFee, amountPaid, balance, status,
    paymentMethod: method,
    lastPaymentDate: lastDate,
    dueDate,
    paymentHistory: histories,
  }
}

// Mock data cleared — payments will be populated from accounting records
// When backend is ready, replace this with: fetch('/api/payments')
export const mockPayments = []