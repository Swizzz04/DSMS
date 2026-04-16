/**
 * AppConfigContext
 *
 * Wraps appConfig.js defaults with localStorage persistence.
 * Any page calling useAppConfig() gets live, per-campus-aware config.
 * When Settings saves a change, all pages re-render automatically.
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
  DEFAULT_DISCOUNTS,
  getCampusByKey,
  getCampusByName,
  getCampusCollegeGrades,
  getAllBasicEdGrades,
  getCurrentSchoolYear,
  getTotalFee,
  getFeeEntry,
  getGradingScale,
  getPassingGrade,
  getFormRequestTypes,
  getSpecialRoles,
  getPaymentMethods,
  isWorkflowConfirmed,
  campusHasRole,
  buildCampusProgramsMap,
  computeCollegeFee,
  previewCollegeFee,
  getLoadStatus,
  getFeeBreakdown,
  computeStudentBill,
} from '../config/appConfig'

const STORAGE_KEY = 'cshc_app_config'

function loadPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function buildInitialState() {
  const saved = loadPersisted()

  // Detect stale fee structure: old data used flat college entries (no 'semester' field).
  // If any saved fee has no 'semester' field and has a 'gradeLevel' like 'BS Criminology',
  // the saved fees are stale — discard them and use fresh defaults.
  const savedFees = saved.feeStructure || []

  // Stale detection: old fee structure used flat college entries with gradeLevel='BS Criminology'
  // New structure uses program+yearLevel+semester fields. Also detect if saved data
  // is missing new entries (count mismatch means new entries were added to appConfig).
  const hasFlatCollege  = savedFees.some(f => f.gradeLevel?.startsWith('BS') && !f.semester)
  const isMissingNew    = savedFees.length > 0 && savedFees.length < FEE_STRUCTURE.length
  const hasStaleData    = hasFlatCollege || isMissingNew

  // Build saved fee map — but ONLY use saved values for fees that have matching
  // structure (both have semester field, or both don't). Never let a flat entry
  // overwrite a semester entry even if ids happen to match.
  const savedFeeMap = hasStaleData
    ? {}
    : Object.fromEntries(
        savedFees
          .filter(sf => {
            const defaultEntry = FEE_STRUCTURE.find(f => f.id === sf.id)
            if (!defaultEntry) return false
            // Reject if saved entry is flat college but default expects semester
            if (!sf.semester && defaultEntry.semester) return false
            return true
          })
          .map(f => [f.id, f])
      )

  const mergedFees = FEE_STRUCTURE.map(f => ({ ...f, ...(savedFeeMap[f.id] || {}) }))

  // Clear stale localStorage fee data so it won't persist
  if (hasStaleData) {
    try {
      const cfg = JSON.parse(localStorage.getItem('cshc_app_config') || '{}')
      delete cfg.feeStructure
      localStorage.setItem('cshc_app_config', JSON.stringify(cfg))
    } catch {}
  }

  return {
    schoolInfo:        saved.schoolInfo        || SCHOOL_INFO,
    schoolYears:       saved.schoolYears       || SCHOOL_YEARS,
    campuses:          saved.campuses          || CAMPUSES,
    basicEdGroups:     saved.basicEdGroups     || BASIC_ED_GROUPS,
    collegeYearLevels: saved.collegeYearLevels || COLLEGE_YEAR_LEVELS,
    gradeSections:     saved.gradeSections     || GRADE_SECTIONS,
    feeStructure:      mergedFees,
    systemUsers:       saved.systemUsers       || SYSTEM_USERS,
    discounts:         saved.discounts         || DEFAULT_DISCOUNTS,
    roleDefs:          ROLE_DEFINITIONS,
  }
}

const AppConfigContext = createContext(null)

export function AppConfigProvider({ children }) {
  const [config, setConfig] = useState(buildInitialState)

  const updateConfig = useCallback((section, value) => {
    setConfig(prev => {
      const next = { ...prev, [section]: value }
      const { roleDefs, ...toSave } = next
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
      return next
    })
  }, [])

  const resetSection = useCallback((section) => {
    const defaults = {
      schoolInfo: SCHOOL_INFO, schoolYears: SCHOOL_YEARS,
      campuses: CAMPUSES, basicEdGroups: BASIC_ED_GROUPS,
      collegeYearLevels: COLLEGE_YEAR_LEVELS, gradeSections: GRADE_SECTIONS,
      feeStructure: FEE_STRUCTURE, systemUsers: SYSTEM_USERS,
      discounts: DEFAULT_DISCOUNTS,
    }
    updateConfig(section, defaults[section])
  }, [updateConfig])

  // ── Derived values ──────────────────────────────────────────────
  const activeCampuses    = config.campuses.filter(c => c.isActive)
  const currentSchoolYear = getCurrentSchoolYear(config.schoolYears)
  const allBasicEdGrades  = getAllBasicEdGrades(config.basicEdGroups)
  const campusProgramsMap = buildCampusProgramsMap(config.campuses)

  // ── Per-campus helpers (all read from live config) ──────────────
  const getCollegeGrades = useCallback((campusKey) =>
    getCampusCollegeGrades(campusKey, config.campuses), [config.campuses])

  const getFee = useCallback((gradeLevel, campusName) =>
    getTotalFee(gradeLevel, campusName, config.feeStructure), [config.feeStructure])

  const getFeeDetail = useCallback((gradeLevel, campusName) =>
    getFeeEntry(gradeLevel, campusName, config.feeStructure), [config.feeStructure])

  const getCampus = useCallback((key) =>
    getCampusByKey(key, config.campuses), [config.campuses])

  const getCampusFromName = useCallback((name) =>
    getCampusByName(name, config.campuses), [config.campuses])

  const hasRole = useCallback((campusKey, roleKey) =>
    campusHasRole(campusKey, roleKey, config.campuses), [config.campuses])

  const getGrading = useCallback((campusKey, dept = 'basicEd') =>
    getGradingScale(campusKey, dept, config.campuses), [config.campuses])

  const getPassingMark = useCallback((campusKey, dept = 'basicEd') =>
    getPassingGrade(campusKey, dept, config.campuses), [config.campuses])

  const getForms = useCallback((campusKey, dept = 'basicEd') =>
    getFormRequestTypes(campusKey, dept, config.campuses), [config.campuses])

  const getSpecial = useCallback((campusKey) =>
    getSpecialRoles(campusKey, config.campuses), [config.campuses])

  const getPayMethods = useCallback((campusKey) =>
    getPaymentMethods(campusKey, config.campuses), [config.campuses])

  const workflowConfirmed = useCallback((campusKey) =>
    isWorkflowConfirmed(campusKey, config.campuses), [config.campuses])

  const value = {
    // Raw config sections
    ...config,

    // Derived
    activeCampuses,
    currentSchoolYear,
    campusProgramsMap,
    allBasicEdGrades,

    // Per-campus helpers
    getCollegeGrades,
    getFee,
    getFeeDetail,
    getCampus,
    getCampusFromName,
    hasRole,
    getGrading,
    getPassingMark,
    getForms,
    getSpecial,
    getPayMethods,
    workflowConfirmed,

    // College fee computation
    computeCollegeFee,
    previewCollegeFee,
    getLoadStatus,
    getFeeBreakdown,
    computeStudentBill,

    // Config mutation
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