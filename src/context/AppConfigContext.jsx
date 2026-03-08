/**
 * AppConfigContext
 *
 * Wraps the static appConfig.js defaults with localStorage persistence.
 * Any page that calls useAppConfig() gets live config values.
 * When Settings saves a change, all pages re-render with the new data
 * automatically — no page reload needed.
 *
 * Priority: localStorage overrides > appConfig.js defaults
 */

import { createContext, useContext, useState, useCallback } from 'react'
import {
  SCHOOL_INFO,
  SCHOOL_YEARS,
  CAMPUSES,
  BASIC_ED_GROUPS,
  COLLEGE_YEAR_LEVELS,
  GRADE_SECTIONS,
  FEE_STRUCTURE,
  SYSTEM_USERS,
  ROLE_DEFINITIONS,
  getCampusCollegeGrades,
  getAllBasicEdGrades,
  getCurrentSchoolYear,
  getTotalFee,
} from '../config/appConfig'

const STORAGE_KEY = 'cshc_app_config'

// Load persisted overrides from localStorage
function loadPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

// Merge defaults with any saved overrides
function buildInitialState() {
  const saved = loadPersisted()
  return {
    schoolInfo:        saved.schoolInfo        || SCHOOL_INFO,
    schoolYears:       saved.schoolYears       || SCHOOL_YEARS,
    campuses:          saved.campuses          || CAMPUSES,
    basicEdGroups:     saved.basicEdGroups     || BASIC_ED_GROUPS,
    collegeYearLevels: saved.collegeYearLevels || COLLEGE_YEAR_LEVELS,
    gradeSections:     saved.gradeSections     || GRADE_SECTIONS,
    feeStructure:      saved.feeStructure      || FEE_STRUCTURE,
    systemUsers:       saved.systemUsers       || SYSTEM_USERS,
    roleDefs:          ROLE_DEFINITIONS,       // roles are code-level only
  }
}

const AppConfigContext = createContext(null)

export function AppConfigProvider({ children }) {
  const [config, setConfig] = useState(buildInitialState)

  // Persist a partial update and merge into state
  const updateConfig = useCallback((section, value) => {
    setConfig(prev => {
      const next = { ...prev, [section]: value }
      // Persist everything except roleDefs (that's code-only)
      const { roleDefs, ...toSave } = next
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
      return next
    })
  }, [])

  // Reset a section back to appConfig.js defaults
  const resetSection = useCallback((section) => {
    const defaults = {
      schoolInfo:        SCHOOL_INFO,
      schoolYears:       SCHOOL_YEARS,
      campuses:          CAMPUSES,
      basicEdGroups:     BASIC_ED_GROUPS,
      collegeYearLevels: COLLEGE_YEAR_LEVELS,
      gradeSections:     GRADE_SECTIONS,
      feeStructure:      FEE_STRUCTURE,
      systemUsers:       SYSTEM_USERS,
    }
    updateConfig(section, defaults[section])
  }, [updateConfig])

  // ── Derived values (computed live from config) ──────────────────

  /** Active campuses only */
  const activeCampuses = config.campuses.filter(c => c.isActive)

  /** Current school year string */
  const currentSchoolYear = getCurrentSchoolYear(config.schoolYears)

  /** College grade strings for a campus key */
  const getCollegeGrades = useCallback((campusKey) =>
    getCampusCollegeGrades(campusKey, config.campuses),
  [config.campuses])

  /** All basic-ed grades flat */
  const allBasicEdGrades = getAllBasicEdGrades(config.basicEdGroups)

  /** Total fee lookup */
  const getFee = useCallback((gradeLevel, campusName) =>
    getTotalFee(gradeLevel, campusName, config.feeStructure),
  [config.feeStructure])

  /**
   * Campus programs map — shape used by Enrollments & Students dropdowns
   * { Talisay: ['BS Nursing - 1st Year', ...], Carcar: [...], Bohol: [] }
   */
  const campusProgramsMap = Object.fromEntries(
    config.campuses.map(c => [c.key, getCollegeGrades(c.key)])
  )

  const value = {
    // Raw config sections
    ...config,

    // Derived/computed
    activeCampuses,
    currentSchoolYear,
    campusProgramsMap,
    allBasicEdGrades,

    // Functions
    getCollegeGrades,
    getFee,
    updateConfig,
    resetSection,
  }

  return (
    <AppConfigContext.Provider value={value}>
      {children}
    </AppConfigContext.Provider>
  )
}

export function useAppConfig() {
  const ctx = useContext(AppConfigContext)
  if (!ctx) throw new Error('useAppConfig must be used inside <AppConfigProvider>')
  return ctx
}