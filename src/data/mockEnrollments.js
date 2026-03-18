/**
 * mockEnrollments.js
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

// Mock data cleared — all enrollments now come from the website form (localStorage bridge)
// When backend is ready, replace this with: fetch('/api/enrollments')
export const mockEnrollments = []

/*
// BEFORE (current)
export const mockEnrollments = []

// AFTER (API connected)
export const mockEnrollments = await fetch('/api/enrollments').then(r => r.json())*/