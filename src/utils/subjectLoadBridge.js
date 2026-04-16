/**
 * subjectLoadBridge.js — localStorage bridge for Subject Load Management.
 *
 * STORAGE KEY: cshc_subject_loads
 * Shape per campusKey+schoolYear:
 * {
 *   maxPerSection:    number
 *   basicEdSubjects:  { [grade]: string[] }
 *   basicEdLoads:     BasicEdLoad[]      — per grade+subject (shared across sections)
 *   basicEdAdvisers:  AdviserLoad[]      — per section
 *   basicEdSections:  { [grade]: Section[] }   — auto-gen, renameable
 *   collegeSubjects:  { [prog]: { [yr]: { [sem]: string[] } } }
 *   collegeLoads:     CollegeLoad[]      — per prog+yr+sem+sectionId+subject
 *   collegeSections:  { [prog]: { [yr]: Section[] } }  — auto-gen, letters only
 * }
 * Section: { id, defaultName, displayName, studentCount }
 */

import { DEFAULT_BASIC_ED_SUBJECTS, DEFAULT_COLLEGE_SUBJECTS } from '../config/appConfig'

const STORAGE_KEY = 'cshc_subject_loads'
const DEFAULT_MAX = 40
const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function loadAll() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') } catch { return {} }
}
function saveAll(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  window.dispatchEvent(new CustomEvent('cshc_subject_load_updated'))
}
function getCY(campusKey, schoolYear) {
  return loadAll()[campusKey]?.[schoolYear] || null
}
function setCY(campusKey, schoolYear, data) {
  const all = loadAll()
  if (!all[campusKey]) all[campusKey] = {}
  all[campusKey][schoolYear] = data
  saveAll(all)
}
function uid(p) { return `${p}_${Date.now()}_${Math.random().toString(36).slice(2,7)}` }

// ── Section generation ────────────────────────────────────────────
function buildSections(count, max, prefix, existing = [], letterOnly = false) {
  const n = Math.max(1, Math.ceil(count / (max || DEFAULT_MAX)))
  return Array.from({ length: n }, (_, i) => {
    const letter = ALPHA[i] || String(i + 1)
    const defaultName = `${prefix}-${letter}`
    const prev = existing.find(s => s.defaultName === defaultName)
    return {
      id:           prev?.id || uid('sec'),
      defaultName,
      displayName:  letterOnly ? defaultName : (prev?.displayName || defaultName),
      studentCount: Math.min(max, count - i * max),
    }
  })
}

function getEnrolledCount(campusName, gradeLevel) {
  try {
    const subs = JSON.parse(localStorage.getItem('cshc_submissions') || '[]')
    return subs.filter(s =>
      s.status === 'approved' &&
      s.enrollment?.campus === campusName &&
      s.enrollment?.gradeLevel === gradeLevel
    ).length
  } catch { return 0 }
}

function getCollegeEnrolledCount(campusName, program, yearLevel) {
  try {
    const subs = JSON.parse(localStorage.getItem('cshc_submissions') || '[]')
    return subs.filter(s =>
      s.status === 'approved' &&
      s.enrollment?.campus === campusName &&
      (s.enrollment?.gradeLevel || '').startsWith(program) &&
      (s.enrollment?.gradeLevel || '').includes(yearLevel)
    ).length
  } catch { return 0 }
}

function rebuildSections(data, campusName, collegePrograms) {
  const max = data.maxPerSection || DEFAULT_MAX
  const YEAR_LEVELS = ['1st Year', '2nd Year', '3rd Year', '4th Year']

  // Basic Ed
  Object.keys(data.basicEdSubjects || {}).forEach(grade => {
    const count = getEnrolledCount(campusName, grade)
    const existing = data.basicEdSections?.[grade] || []
    if (!data.basicEdSections) data.basicEdSections = {}
    data.basicEdSections[grade] = buildSections(count, max, grade, existing, false)
  })

  // College
  if (!data.collegeSections) data.collegeSections = {};
  (collegePrograms || []).forEach(prog => {
    if (!data.collegeSections[prog]) data.collegeSections[prog] = {}
    YEAR_LEVELS.forEach(yr => {
      const count = getCollegeEnrolledCount(campusName, prog, yr)
      const shortProg = prog.replace('BS ', '')
      const prefix = `${shortProg} ${yr.replace(' Year','')}`
      const existing = data.collegeSections[prog]?.[yr] || []
      data.collegeSections[prog][yr] = buildSections(count, max, prefix, existing, true)
    })
  })

  return data
}

function initCY(campusKey, schoolYear, campusName, collegePrograms = []) {
  const existing = getCY(campusKey, schoolYear)
  if (existing) return existing
  const collegeSubjects = {}
  ;(collegePrograms || []).forEach(prog => {
    if (DEFAULT_COLLEGE_SUBJECTS[prog]) collegeSubjects[prog] = DEFAULT_COLLEGE_SUBJECTS[prog]
  })
  const fresh = {
    maxPerSection: DEFAULT_MAX,
    basicEdSubjects: { ...DEFAULT_BASIC_ED_SUBJECTS },
    basicEdLoads: [], basicEdAdvisers: [], basicEdSections: {},
    collegeSubjects, collegeLoads: [], collegeSections: {},
  }
  setCY(campusKey, schoolYear, fresh)
  return fresh
}

// ═══════════════════════════════ PUBLIC API ═══════════════════════

export function getSubjectLoadData(campusKey, schoolYear, campusName, collegePrograms = []) {
  let data = initCY(campusKey, schoolYear, campusName, collegePrograms)
  data = rebuildSections(data, campusName, collegePrograms)
  return data
}

export function setMaxPerSection(campusKey, schoolYear, campusName, collegePrograms, max) {
  const data = getCY(campusKey, schoolYear) || initCY(campusKey, schoolYear, campusName, collegePrograms)
  data.maxPerSection = Math.max(1, parseInt(max, 10) || DEFAULT_MAX)
  setCY(campusKey, schoolYear, rebuildSections(data, campusName, collegePrograms))
}

export function renameSection(campusKey, schoolYear, gradeLevel, sectionId, newName) {
  const data = getCY(campusKey, schoolYear)
  if (!data) return
  const secs = data.basicEdSections?.[gradeLevel] || []
  const idx = secs.findIndex(s => s.id === sectionId)
  if (idx >= 0) {
    secs[idx].displayName = newName.trim() || secs[idx].defaultName
    data.basicEdSections[gradeLevel] = secs
    setCY(campusKey, schoolYear, data)
  }
}

export function addBasicEdSubject(campusKey, schoolYear, gradeLevel, subject) {
  const data = getCY(campusKey, schoolYear)
  if (!data) return
  if (!data.basicEdSubjects[gradeLevel]) data.basicEdSubjects[gradeLevel] = []
  if (!data.basicEdSubjects[gradeLevel].includes(subject)) {
    data.basicEdSubjects[gradeLevel].push(subject)
    setCY(campusKey, schoolYear, data)
  }
}

export function removeBasicEdSubject(campusKey, schoolYear, gradeLevel, subject) {
  const data = getCY(campusKey, schoolYear)
  if (!data) return
  data.basicEdSubjects[gradeLevel] = (data.basicEdSubjects[gradeLevel] || []).filter(s => s !== subject)
  data.basicEdLoads = data.basicEdLoads.filter(l => !(l.gradeLevel === gradeLevel && l.subject === subject))
  setCY(campusKey, schoolYear, data)
}

export function addCollegeSubject(campusKey, schoolYear, program, yearLevel, semester, subject) {
  const data = getCY(campusKey, schoolYear)
  if (!data) return
  if (!data.collegeSubjects[program]) data.collegeSubjects[program] = {}
  if (!data.collegeSubjects[program][yearLevel]) data.collegeSubjects[program][yearLevel] = {}
  if (!data.collegeSubjects[program][yearLevel][semester]) data.collegeSubjects[program][yearLevel][semester] = []
  if (!data.collegeSubjects[program][yearLevel][semester].includes(subject)) {
    data.collegeSubjects[program][yearLevel][semester].push(subject)
    setCY(campusKey, schoolYear, data)
  }
}

export function removeCollegeSubject(campusKey, schoolYear, program, yearLevel, semester, subject) {
  const data = getCY(campusKey, schoolYear)
  if (!data) return
  const arr = data.collegeSubjects?.[program]?.[yearLevel]?.[semester] || []
  data.collegeSubjects[program][yearLevel][semester] = arr.filter(s => s !== subject)
  data.collegeLoads = data.collegeLoads.filter(l =>
    !(l.program === program && l.yearLevel === yearLevel && l.semester === semester && l.subject === subject)
  )
  setCY(campusKey, schoolYear, data)
}

export function assignBasicEdLoad(campusKey, schoolYear, gradeLevel, subject, teacher) {
  const data = getCY(campusKey, schoolYear)
  if (!data) return
  const idx = data.basicEdLoads.findIndex(l => l.gradeLevel === gradeLevel && l.subject === subject)
  const load = {
    id: idx >= 0 ? data.basicEdLoads[idx].id : uid('be'),
    gradeLevel, subject,
    teacherId: teacher?.id || null, teacherName: teacher?.name || '',
    updatedAt: new Date().toISOString(),
  }
  if (idx >= 0) data.basicEdLoads[idx] = load; else data.basicEdLoads.push(load)
  setCY(campusKey, schoolYear, data)
}

export function assignAdviser(campusKey, schoolYear, gradeLevel, sectionId, teacher) {
  const data = getCY(campusKey, schoolYear)
  if (!data) return
  if (!data.basicEdAdvisers) data.basicEdAdvisers = []
  const idx = data.basicEdAdvisers.findIndex(a => a.sectionId === sectionId)
  const load = {
    id: idx >= 0 ? data.basicEdAdvisers[idx].id : uid('adv'),
    sectionId, gradeLevel,
    teacherId: teacher?.id || null, teacherName: teacher?.name || '',
    updatedAt: new Date().toISOString(),
  }
  if (idx >= 0) data.basicEdAdvisers[idx] = load; else data.basicEdAdvisers.push(load)
  setCY(campusKey, schoolYear, data)
}

export function assignCollegeLoad(campusKey, schoolYear, program, yearLevel, semester, sectionId, subject, teacher) {
  const data = getCY(campusKey, schoolYear)
  if (!data) return
  const idx = data.collegeLoads.findIndex(l =>
    l.program === program && l.yearLevel === yearLevel &&
    l.semester === semester && l.sectionId === sectionId && l.subject === subject
  )
  const load = {
    id: idx >= 0 ? data.collegeLoads[idx].id : uid('col'),
    program, yearLevel, semester, sectionId, subject,
    teacherId: teacher?.id || null, teacherName: teacher?.name || '',
    updatedAt: new Date().toISOString(),
  }
  if (idx >= 0) data.collegeLoads[idx] = load; else data.collegeLoads.push(load)
  setCY(campusKey, schoolYear, data)
}

export function getSubjectLoadStats(campusKey, schoolYear) {
  const data = getCY(campusKey, schoolYear)
  if (!data) return { unassignedBasicEd: 0, unassignedCollege: 0, unassignedAdvisers: 0 }

  let unassignedBasicEd = 0
  Object.entries(data.basicEdSubjects || {}).forEach(([grade, subjects]) => {
    subjects.forEach(s => {
      if (!data.basicEdLoads?.find(l => l.gradeLevel === grade && l.subject === s && l.teacherId))
        unassignedBasicEd++
    })
  })

  let unassignedAdvisers = 0
  Object.entries(data.basicEdSections || {}).forEach(([, sections]) => {
    sections.forEach(sec => {
      if (!data.basicEdAdvisers?.find(a => a.sectionId === sec.id && a.teacherId))
        unassignedAdvisers++
    })
  })

  let unassignedCollege = 0
  Object.entries(data.collegeSubjects || {}).forEach(([prog, years]) => {
    Object.entries(years || {}).forEach(([yr, sems]) => {
      const sections = data.collegeSections?.[prog]?.[yr] || []
      Object.entries(sems || {}).forEach(([sem, subjects]) => {
        sections.forEach(sec => {
          subjects.forEach(sub => {
            if (!data.collegeLoads?.find(l =>
              l.program === prog && l.yearLevel === yr && l.semester === sem &&
              l.sectionId === sec.id && l.subject === sub && l.teacherId
            )) unassignedCollege++
          })
        })
      })
    })
  })

  return { unassignedBasicEd, unassignedCollege, unassignedAdvisers }
}
