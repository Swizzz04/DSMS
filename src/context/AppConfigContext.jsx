/**
 * AppConfigContext
 *
 * Wraps appConfig.js defaults with localStorage persistence.
 * Any page calling useAppConfig() gets live, per-campus-aware config.
 * When Settings saves a change, all pages re-render automatically.
 *
 * Priority: localStorage overrides > appConfig.js defaults
 */

import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react'
import {
  SCHOOL_INFO,
  SCHOOL_YEARS,
  CAMPUSES,
  BASIC_ED_GROUPS,
  COLLEGE_YEAR_LEVELS,
  GRADE_SECTIONS,
  FEE_STRUCTURE,
  CUSTOM_FEE_ID_START,
  SYSTEM_USERS,
  ROLE_DEFINITIONS,
  DEFAULT_DISCOUNTS,
  getCampusByKey,
  getCampusByName,
  getCampusCollegeGrades,
  getAllBasicEdGrades,
  getCampusBasicEdGroups,
  unionBasicEdGroups,
  getCampusCollegeYearLevels,
  getProgramYearLevels,
  getCampusAllYearLevels,
  unionCollegeYearLevels,
  isBasicGrade   as checkBasicGrade,
  isCollegeGrade as checkCollegeGrade,
  getCurrentSchoolYear,
  getCampusSchoolYears,
  getCampusCurrentSchoolYear,
  getCurrentYearsByCampus,
  summarizeCurrentYears,
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
import { useAuth } from './AuthContext'
import { useCampusFilter } from './CampusFilterContext'

const STORAGE_KEY = 'almirene_app_config'

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
  // Rows a campus saved for itself (id from CUSTOM_FEE_ID_START up) are kept apart from the
  // shipped rows, so they never count towards "missing new entries" and are never thrown away.
  const savedShipped = savedFees.filter(f => !(f.id >= CUSTOM_FEE_ID_START))
  const savedCustom  = savedFees.filter(f => f.id >= CUSTOM_FEE_ID_START && (f.gradeLevel || f.program) && f.campus && f.campus !== 'all')
  const hasFlatCollege  = savedShipped.some(f => f.gradeLevel?.startsWith('BS') && !f.semester)
  const isMissingNew    = savedShipped.length > 0 && savedShipped.length < FEE_STRUCTURE.length
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

  // Clear stale localStorage fee data so it won't persist. Campus-made rows are put back
  // right after, so a reset of the shipped rows never deletes a campus's own fees.
  if (hasStaleData) {
    try {
      const cfg = JSON.parse(localStorage.getItem('almirene_app_config') || '{}')
      if (savedCustom.length) cfg.feeStructure = savedCustom
      else delete cfg.feeStructure
      localStorage.setItem('almirene_app_config', JSON.stringify(cfg))
    } catch {}
  }

  return {
    schoolInfo:        saved.schoolInfo        || SCHOOL_INFO,
    schoolYears:       saved.schoolYears       || SCHOOL_YEARS,
    campusSchoolYears: saved.campusSchoolYears || {},
    campuses:          saved.campuses          || CAMPUSES,
    basicEdGroups:     saved.basicEdGroups     || BASIC_ED_GROUPS,
    campusGradeLevels: saved.campusGradeLevels || {},
    collegeYearLevels: saved.collegeYearLevels || COLLEGE_YEAR_LEVELS,
    gradeSections:     saved.gradeSections     || GRADE_SECTIONS,
    feeStructure:      [...savedCustom, ...mergedFees],
    systemUsers:       saved.systemUsers       || SYSTEM_USERS,
    discounts:         saved.discounts         || DEFAULT_DISCOUNTS,
    roleDefs:          ROLE_DEFINITIONS,
  }
}

const AppConfigContext = createContext(null)

export function AppConfigProvider({ children }) {
  const [config, setConfig] = useState(buildInitialState)

  // Seed default workflow definitions once after mount.
  // Using useEffect (not buildInitialState) so React StrictMode's double-invoke
  // of the state initializer does not cause duplicate workflow entries.
  useEffect(() => {
    import('../utils/workflowConfigBridge').then(({ initializeDefaults }) => {
      initializeDefaults('all')
    })
  }, [])

  // Grade levels and school years are kept per campus. `workingCampusKey` is the campus the
  // signed-in person is working in (set by <WorkingCampusSync/>); with none, grade levels of every
  // campus are merged and school years fall back to the school-wide list.
  const [workingCampusKey, setWorkingCampusKey] = useState('')
  const workingCampusRef = useRef('')
  useEffect(() => { workingCampusRef.current = workingCampusKey }, [workingCampusKey])

  const persist = (next) => {
    const { roleDefs, ...toSave } = next
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
  }

  const updateConfig = useCallback((section, value) => {
    setConfig(prev => {
      // Interim (until the School Year tab calls updateCampusSchoolYears itself): a save of the
      // 'schoolYears' section while a campus is being worked in goes to THAT campus's own list,
      // never over the school-wide one.
      const key = section === 'schoolYears' ? workingCampusRef.current : ''
      const next = key
        ? { ...prev, campusSchoolYears: { ...(prev.campusSchoolYears || {}), [key]: value } }
        : { ...prev, [section]: value }
      persist(next)
      return next
    })
  }, [])

  // Save one campus's own school year list (copy-on-write: the first save writes the full list)
  const updateCampusSchoolYears = useCallback((campusKey, years) => {
    if (!campusKey) return
    setConfig(prev => {
      const next = { ...prev, campusSchoolYears: { ...(prev.campusSchoolYears || {}), [campusKey]: years } }
      persist(next)
      return next
    })
  }, [])

  // Drop a campus's own list so it goes back to the school-wide one
  const resetCampusSchoolYears = useCallback((campusKey) => {
    if (!campusKey) return
    setConfig(prev => {
      const rest = { ...(prev.campusSchoolYears || {}) }
      delete rest[campusKey]
      const next = { ...prev, campusSchoolYears: rest }
      persist(next)
      return next
    })
  }, [])

  const resetSection = useCallback((section) => {
    const defaults = {
      schoolInfo: SCHOOL_INFO, schoolYears: SCHOOL_YEARS,
      campuses: CAMPUSES, basicEdGroups: BASIC_ED_GROUPS,
      collegeYearLevels: COLLEGE_YEAR_LEVELS, gradeSections: GRADE_SECTIONS,
      feeStructure: FEE_STRUCTURE, systemUsers: SYSTEM_USERS,
      discounts: DEFAULT_DISCOUNTS, campusGradeLevels: {}, campusSchoolYears: {},
    }
    if (section === 'schoolYears' && workingCampusRef.current) {
      resetCampusSchoolYears(workingCampusRef.current)
      return
    }
    updateConfig(section, defaults[section])
  }, [updateConfig, resetCampusSchoolYears])

  // ── Derived values ──────────────────────────────────────────────
  const activeCampuses    = config.campuses.filter(c => c.isActive)
  // School years: the working campus's own list; with no campus (school owner) the school-wide
  // list, and `currentYearsByCampus` carries each campus's own current year for all-campus screens.
  const schoolYears = useMemo(
    () => workingCampusKey
      ? getCampusSchoolYears(workingCampusKey, config.schoolYears, config.campusSchoolYears)
      : config.schoolYears,
    [workingCampusKey, config.schoolYears, config.campusSchoolYears]
  )
  const currentSchoolYear = getCurrentSchoolYear(schoolYears)
  const currentYearsByCampus = useMemo(
    () => getCurrentYearsByCampus(config.campuses.filter(c => c.isActive), config.schoolYears, config.campusSchoolYears),
    [config.campuses, config.schoolYears, config.campusSchoolYears]
  )
  // Header text when no single campus is chosen: one year if all agree, else each campus's own
  const currentSchoolYearLabel = workingCampusKey ? currentSchoolYear : summarizeCurrentYears(currentYearsByCampus)
  // Header text for any screen: that campus's own year when one campus is meant (key or name),
  // otherwise the working campus's year, or every campus's own when none is chosen.
  const getSchoolYearLabel = useCallback((campusRef) => {
    const c = campusRef && campusRef !== 'all'
      ? config.campuses.find(x => x.key === campusRef || x.name === campusRef)
      : null
    if (c) return getCampusCurrentSchoolYear(c.key, config.schoolYears, config.campusSchoolYears)
    return currentSchoolYearLabel
  }, [config.campuses, config.schoolYears, config.campusSchoolYears, currentSchoolYearLabel])
  const getCampusSchoolYearList = useCallback((campusKey) =>
    getCampusSchoolYears(campusKey, config.schoolYears, config.campusSchoolYears),
    [config.schoolYears, config.campusSchoolYears])
  const getCampusYear = useCallback((campusKey) =>
    getCampusCurrentSchoolYear(campusKey, config.schoolYears, config.campusSchoolYears),
    [config.schoolYears, config.campusSchoolYears])
  // Same lookups by campus NAME (enrollment records store the name, not the key)
  const getSchoolYearsForCampusName = useCallback((campusName) => {
    const c = getCampusByName(campusName, config.campuses)
    return getCampusSchoolYears(c?.key, config.schoolYears, config.campusSchoolYears)
  }, [config.campuses, config.schoolYears, config.campusSchoolYears])
  const unionGroups = useMemo(
    () => unionBasicEdGroups(config.basicEdGroups, config.campusGradeLevels),
    [config.basicEdGroups, config.campusGradeLevels]
  )
  const basicEdGroups = useMemo(
    () => workingCampusKey
      ? getCampusBasicEdGroups(workingCampusKey, config.basicEdGroups, config.campusGradeLevels)
      : unionGroups,
    [workingCampusKey, config.basicEdGroups, config.campusGradeLevels, unionGroups]
  )
  const allBasicEdGrades  = useMemo(() => getAllBasicEdGrades(basicEdGroups), [basicEdGroups])
  // College year levels are kept per campus the same way
  const unionYears = useMemo(
    () => unionCollegeYearLevels(config.collegeYearLevels, config.campusGradeLevels),
    [config.collegeYearLevels, config.campusGradeLevels]
  )
  const collegeYearLevels = useMemo(
    () => workingCampusKey
      ? getCampusAllYearLevels(workingCampusKey, config.collegeYearLevels, config.campusGradeLevels)
      : unionYears,
    [workingCampusKey, config.collegeYearLevels, config.campusGradeLevels, unionYears]
  )
  // A campus's default year levels (what a program uses until it gets a list of its own)
  const getCampusYears = useCallback((campusKey) =>
    getCampusCollegeYearLevels(campusKey, config.collegeYearLevels, config.campusGradeLevels),
    [config.collegeYearLevels, config.campusGradeLevels])
  // Section names the campus configured for a level ("Grade 7", or "BS Nursing - 1st Year"), or []
  const getSectionNames = useCallback((campusKey, level) => {
    const names = campusKey ? config.campusGradeLevels?.[campusKey]?.sections?.[level] : null
    return Array.isArray(names) ? names : []
  }, [config.campusGradeLevels])
  // One program's year levels at one campus. With no campus: every campus's years for that program, merged.
  const getProgramYears = useCallback((campusKey, program) => {
    if (campusKey) return getProgramYearLevels(campusKey, program, config.collegeYearLevels, config.campusGradeLevels)
    const out = [...(config.collegeYearLevels || [])]
    Object.keys(config.campusGradeLevels || {}).forEach(k => {
      const list = config.campusGradeLevels[k]?.programYears?.[program]
      ;(list || []).forEach(y => { if (!out.includes(y)) out.push(y) })
    })
    return out
  }, [config.collegeYearLevels, config.campusGradeLevels])
  const getCampusGroups = useCallback((campusKey) =>
    getCampusBasicEdGroups(campusKey, config.basicEdGroups, config.campusGradeLevels),
    [config.basicEdGroups, config.campusGradeLevels])
  // Fee rows with a campus of their own come before the shared ('all') ones, so a page that
  // takes the first matching row (Enrollments does) gets the campus's own fee, not the shared one.
  const feeStructure = useMemo(
    () => [...config.feeStructure.filter(f => f.campus !== 'all'), ...config.feeStructure.filter(f => f.campus === 'all')],
    [config.feeStructure]
  )
  const campusProgramsMap = useMemo(() => buildCampusProgramsMap(config.campuses, getProgramYears), [config.campuses, getProgramYears])

  // ── Per-campus helpers (all read from live config) ──────────────
  const getCollegeGrades = useCallback((campusKey) =>
    getCampusCollegeGrades(campusKey, config.campuses, (prog) => getProgramYears(campusKey, prog)), [config.campuses, getProgramYears])

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

  // Grade-level department checks — bound to the LIVE (admin-editable) lists,
  // so levels edited in Settings are respected everywhere. Identity changes
  // only when the lists change, so they are safe in effect/memo dependencies.
  // Recognising a level uses every campus's list, so a record from another campus is never misread.
  const isBasicGrade = useCallback((gradeLevel) =>
    checkBasicGrade(gradeLevel, unionGroups), [unionGroups])

  const isCollegeGrade = useCallback((gradeLevel) =>
    checkCollegeGrade(gradeLevel, unionYears), [unionYears])

  const value = {
    // Raw config sections
    ...config,

    // Derived
    feeStructure,            // overrides the raw list above: campus rows first
    basicEdGroups,           // overrides the raw list: the working campus's levels (all campuses merged if none)
    collegeYearLevels,       // same for college year levels
    schoolCollegeYearLevels: config.collegeYearLevels,
    getCampusYearLevels: getCampusYears,
    getSectionNames,         // (campusKey, level) => configured section names ([] = automatic A, B, C)
    getProgramYearLevels: getProgramYears,   // (campusKey, program) => that program's year levels
    schoolBasicEdGroups: config.basicEdGroups,   // the school-wide list a campus starts from
    getCampusBasicEdGroups: getCampusGroups,     // (campusKey) => that campus's levels
    setWorkingCampusKey,
    activeCampuses,
    schoolYears,             // overrides the raw list: the working campus's school years (school-wide if none)
    currentSchoolYear,       // the working campus's current year (school-wide current if none)
    currentSchoolYearLabel,  // header text: one year, or each campus's own when no campus is chosen
    currentYearsByCampus,    // [{ key, name, year, hasOwnList }] for all-campus (Owner) views
    getSchoolYearLabel,      // (campusKeyOrName | 'all') => header text for that scope
    schoolWideSchoolYears: config.schoolYears,   // the school-wide list a campus starts from
    getCampusSchoolYears: getCampusSchoolYearList,       // (campusKey) => that campus's school years
    getCampusCurrentSchoolYear: getCampusYear,           // (campusKey) => that campus's current year
    getSchoolYearsForCampusName,                         // (campusName) => that campus's school years
    updateCampusSchoolYears,                             // (campusKey, years) => save that campus's list
    resetCampusSchoolYears,                              // (campusKey) => back to the school-wide list
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
    isBasicGrade,
    isCollegeGrade,

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

/**
 * Tells the config which campus is being worked in, so `basicEdGroups` / `allBasicEdGrades`
 * are that campus's levels on every page. Technical Admin: the campus picked in the header menu.
 * Everyone else: their own campus. Render once, inside AuthProvider and CampusFilterProvider.
 */
export function WorkingCampusSync() {
  const { user } = useAuth()
  const { campusFilter } = useCampusFilter()
  const { setWorkingCampusKey, activeCampuses } = useAppConfig()
  const key = user?.role === 'technical_admin'
    ? (activeCampuses?.some(c => c.key === campusFilter) ? campusFilter : '')
    : (user?.campusKey || '')
  useEffect(() => { setWorkingCampusKey(key) }, [key, setWorkingCampusKey])
  return null
}
