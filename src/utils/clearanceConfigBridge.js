/**
 * clearanceConfigBridge.js — ALMIRENE DX · Student Clearance requirements
 *
 * Plain .js on purpose (no JSX, no React): the page, documentBridge and Settings all
 * import it, and it is the one place that knows what a clearance is made of.
 *
 * What it does
 *   1. Stores the clearance REQUIREMENTS list per school department ('basicEd' | 'college'),
 *      and the REASONS a clearance can be opened for. A reason uses the department's standard
 *      requirements unless it carries its own list.
 *      Key: almirene_clearance_requirements   Event: almirene_clearance_config_updated
 *      Shape: { campuses: { [campusKey]: { basicEd: {...}, college: {...} } } }: every campus has its own setup.
 *      The old school-wide shape ({ basicEd, college } at the top) is only the default for a campus with none saved.
 *      Until the school saves its own, the defaults from appConfig.js are used.
 *   2. Turns "requirements + one student" into SIGN-OFF SLOTS. A requirement is a rule;
 *      a slot is one actual signature needed from one person. "Subject instructors"
 *      becomes one slot per subject the student takes; "Admin Office" becomes one slot.
 *   3. Keeps open clearances in step with the configuration (syncClearanceSlots):
 *      removed requirements disappear unless already signed, new ones appear as pending,
 *      signed slots are never lost.
 *   4. Answers "who may sign this slot, and is it open yet?" (canUserSignSlot, slotBlockReason).
 *
 * Everything below the storage helpers is pure — no localStorage, no React — so it can be
 * tested with plain objects and moved to the ASP.NET backend unchanged in meaning.
 *
 * Slot shape (stored on each clearance record by documentBridge, step 2):
 *   {
 *     id, requirementId, label, icon, itemLabel, // itemLabel = the subject for instructor slots
 *     signerType, roles?, userIds?, teacherId?, teacherName?, unassigned?,
 *     order, required, autoFromPayment,
 *     cleared, clearedBy, clearedAt, note?,
 *     retired?                                   // signed, but its requirement was later removed
 *   }
 *
 * Swap the localStorage calls for API calls when the backend is ready.
 */

import {
  CLEARANCE_SIGNER_TYPES,
  CLEARANCE_ORDER_OPTIONS,
  CLEARANCE_DEPARTMENT_SCOPES,
  CLEARANCE_UNASSIGNED_FALLBACK_ROLES,
  ROLE_DEFINITIONS,
  getDefaultClearanceRequirements,
  getDefaultClearanceReasons,
} from '../config/appConfig'

const CONFIG_KEY   = 'almirene_clearance_requirements'
const CONFIG_EVENT = 'almirene_clearance_config_updated'
const SUBJECT_LOAD_KEY = 'almirene_subject_loads'
const STUDENTS_KEY     = 'almirene_students'

const SIGNER_TYPE_IDS = CLEARANCE_SIGNER_TYPES.map(t => t.id)
const ORDER_IDS       = CLEARANCE_ORDER_OPTIONS.map(o => o.id)
const SCOPE_IDS       = CLEARANCE_DEPARTMENT_SCOPES.map(s => s.id)

// ═════════════════════════════════════════════════════════════════
// SMALL HELPERS
// ═════════════════════════════════════════════════════════════════

const norm  = (v) => String(v ?? '').trim().toLowerCase()
const slug  = (v) => norm(v).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
const sameId = (a, b) => a != null && b != null && String(a) === String(b)

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch { return fallback }
}

/** Which requirements list a student belongs to. almirene_students stores 'basicEd' | 'college'. */
export function getClearanceScope(student) {
  if (!student) return 'basicEd'
  if (SCOPE_IDS.includes(student.department)) return student.department
  return student.program ? 'college' : 'basicEd'
}

/** A new, unique requirement id from its label (used by the Settings editor). */
export function makeRequirementId(label, existingIds = []) {
  const base = slug(label) || 'requirement'
  if (!existingIds.includes(base)) return base
  let n = 2
  while (existingIds.includes(`${base}_${n}`)) n += 1
  return `${base}_${n}`
}

// ═════════════════════════════════════════════════════════════════
// 1. REQUIREMENTS — validate, normalise, store
// ═════════════════════════════════════════════════════════════════

/** Clean one requirement into the exact shape the rest of the system expects. */
export function normalizeRequirement(r = {}) {
  const type = SIGNER_TYPE_IDS.includes(r.signer?.type) ? r.signer.type : 'role'
  const signer = { type }
  if (type === 'role') signer.roles   = [...new Set((r.signer?.roles   || []).map(String))]
  if (type === 'user') signer.userIds = [...new Set((r.signer?.userIds || []).map(String))]
  if (type === 'subject_teacher') signer.subject = String(r.signer?.subject || '').trim()
  return {
    id:              String(r.id || '').trim(),
    label:           String(r.label || '').trim(),
    icon:            r.icon || 'default',
    signer,
    order:           ORDER_IDS.includes(r.order) ? r.order : 'any',
    required:        r.required !== false,
    autoFromPayment: !!r.autoFromPayment,
  }
}

/** Human-readable problems with a requirements list. Empty array = valid. */
export function validateRequirements(list) {
  const errors = []
  if (!Array.isArray(list) || list.length === 0) return ['Add at least one clearance requirement.']

  const seen = new Set()
  list.forEach((raw, i) => {
    const r = normalizeRequirement(raw)
    const name = r.label || `Requirement ${i + 1}`
    if (!r.label) errors.push(`Requirement ${i + 1} needs a name.`)
    if (!r.id) errors.push(`${name} has no id.`)
    else if (seen.has(r.id)) errors.push(`Two requirements share the id "${r.id}". Rename one.`)
    seen.add(r.id)

    if (r.signer.type === 'role') {
      if (!r.signer.roles.length) errors.push(`${name}: choose at least one role that signs it.`)
      r.signer.roles.forEach(role => {
        if (!ROLE_DEFINITIONS[role]) errors.push(`${name}: "${role}" is not a known role.`)
      })
    }
    if (r.signer.type === 'user' && !r.signer.userIds.length) {
      errors.push(`${name}: choose at least one account that signs it.`)
    }
    if (r.signer.type === 'subject_teacher' && !r.signer.subject) {
      errors.push(`${name}: enter the subject whose teacher signs it (e.g. Mathematics).`)
    }
    if (r.autoFromPayment && r.signer.type !== 'role' && r.signer.type !== 'user') {
      errors.push(`${name}: the automatic balance check only works with a role or account signer.`)
    }
  })

  if (!list.some(r => normalizeRequirement(r).required)) {
    errors.push('At least one requirement must be required.')
  }
  if (list.every(r => normalizeRequirement(r).order === 'after_others')) {
    errors.push('At least one requirement must be signable at any time, or nothing can open the others.')
  }
  return errors
}

// Storage shape (almirene_clearance_requirements):
//   {
//     campuses: { [campusKey]: { basicEd: { requirements, reasons, updatedAt, updatedBy }, college: { ... } } },
//     basicEd?, college?        <- the old school-wide setup, kept only as the DEFAULT for a campus
//                                  that has not saved its own
//   }
// Every campus configures its own clearance, so a change at one campus never reaches another.
// A campus with nothing saved uses the school-wide setup if there is one, else the standard lists.
// Reading without a campus gives that default; saving always needs a campus.

function loadConfig() {
  const cfg = readJSON(CONFIG_KEY, {})
  return cfg && typeof cfg === 'object' ? cfg : {}
}

const hasItems = (v) => Array.isArray(v) && v.length > 0

/** One saved part ('requirements' | 'reasons') of a department: this campus's own, else the school-wide default. */
function getSavedPart(scope, part, campusKey) {
  const cfg = loadConfig()
  const own = campusKey ? cfg.campuses?.[campusKey]?.[scope]?.[part] : null
  if (hasItems(own)) return own
  const shared = cfg[scope]?.[part]
  return hasItems(shared) ? shared : null
}

/** True when THIS campus has saved its own version of the part (not just inheriting the default). */
function campusHasOwnPart(scope, part, campusKey) {
  return !!campusKey && hasItems(loadConfig().campuses?.[campusKey]?.[scope]?.[part])
}

function needCampus(campusKey) {
  if (!campusKey) throw new Error('Choose a campus first. Each campus has its own clearance setup.')
}

/** Write part(s) of one campus's department config and announce it. */
function writeCampusPart(scope, campusKey, patch, user) {
  needCampus(campusKey)
  const cfg = loadConfig()
  const campuses = { ...(cfg.campuses || {}) }
  const own = { ...(campuses[campusKey] || {}) }
  own[scope] = { ...(own[scope] || {}), ...patch, updatedAt: new Date().toISOString(), updatedBy: user?.name || 'Technical Administrator' }
  campuses[campusKey] = own
  localStorage.setItem(CONFIG_KEY, JSON.stringify({ ...cfg, campuses }))
  window.dispatchEvent(new CustomEvent(CONFIG_EVENT))
}

/** Drop one part of a campus's department config so it falls back to the default. */
function dropCampusPart(scope, part, campusKey) {
  needCampus(campusKey)
  const cfg = loadConfig()
  const own = cfg.campuses?.[campusKey]
  if (own?.[scope]) {
    delete own[scope][part]
    if (!own[scope].requirements && !own[scope].reasons) delete own[scope]
    if (!Object.keys(own).length) delete cfg.campuses[campusKey]
  }
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg))
  window.dispatchEvent(new CustomEvent(CONFIG_EVENT))
}

/**
 * The requirements for one school department at one campus: the campus's saved list, else the
 * school-wide default, else the standard list. Pass a reason id to get that reason's own list
 * when it has one (else the department's list).
 * @param {'basicEd'|'college'} scope
 * @param {string} [reasonId]
 * @param {string} [campusKey]
 */
export function getClearanceRequirements(scope, reasonId, campusKey) {
  if (!SCOPE_IDS.includes(scope)) return []
  if (reasonId) {
    const own = getClearanceReasons(scope, campusKey).find(r => r.id === reasonId)?.requirements
    if (Array.isArray(own) && own.length) return own.map(normalizeRequirement)
  }
  return getStandardRequirements(scope, campusKey)
}

/** The department's standard list at a campus: saved, else school-wide default, else the standard five. */
function getStandardRequirements(scope, campusKey) {
  const saved = getSavedPart(scope, 'requirements', campusKey)
  return (saved || getDefaultClearanceRequirements(scope)).map(normalizeRequirement)
}

/**
 * Every requirement a department can ask for at a campus: the standard list plus any list a reason
 * brings, each requirement once (first one wins). The Clearance table builds its columns from this.
 */
export function getAllClearanceRequirements(scope, campusKey) {
  if (!SCOPE_IDS.includes(scope)) return []
  const out = [], seen = new Set()
  const add = (r) => { if (!seen.has(r.id)) { seen.add(r.id); out.push(r) } }
  getStandardRequirements(scope, campusKey).forEach(add)
  getClearanceReasons(scope, campusKey).forEach(reason => (reason.requirements || []).map(normalizeRequirement).forEach(add))
  return out
}

/** True when this campus has saved its own requirements for the department (false = still on the default). */
export function hasCustomClearanceRequirements(scope, campusKey) {
  return campusHasOwnPart(scope, 'requirements', campusKey)
}

/**
 * Save the requirements for one department at one campus. Technical Admin only.
 * Throws a readable Error when the list is invalid, no campus is chosen, or the user may not change it.
 */
export function saveClearanceRequirements(scope, list, user, campusKey) {
  if (!SCOPE_IDS.includes(scope)) throw new Error(`Unknown department "${scope}".`)
  if (user?.role !== 'technical_admin') throw new Error('Only the Technical Administrator can change the clearance requirements.')
  needCampus(campusKey)

  const clean  = (list || []).map(normalizeRequirement)
  const errors = validateRequirements(clean)
  if (errors.length) throw new Error(errors[0])

  writeCampusPart(scope, campusKey, { requirements: clean }, user)
  return clean
}

/** Go back to the default requirements for one department at one campus (its reasons are kept). Technical Admin only. */
export function resetClearanceRequirements(scope, user, campusKey) {
  if (user?.role !== 'technical_admin') throw new Error('Only the Technical Administrator can change the clearance requirements.')
  dropCampusPart(scope, 'requirements', campusKey)
  return getClearanceRequirements(scope, undefined, campusKey)
}

// ═════════════════════════════════════════════════════════════════
// 1b. REASONS — why a clearance is opened, and what each one needs
// ═════════════════════════════════════════════════════════════════

/** Clean one reason. `requirements` is kept only when the reason has its own (non-empty) list. */
export function normalizeReason(r = {}) {
  const own = Array.isArray(r.requirements) && r.requirements.length ? r.requirements.map(normalizeRequirement) : null
  return {
    id:                  String(r.id || '').trim(),
    label:               String(r.label || '').trim(),
    requiresZeroBalance: !!r.requiresZeroBalance,
    ...(own ? { requirements: own } : {}),
  }
}

/** Human-readable problems with a reasons list, including problems inside a reason's own list. */
export function validateReasons(list) {
  const errors = []
  if (!Array.isArray(list) || list.length === 0) return ['Add at least one reason for clearance.']
  const seen = new Set(), labels = new Set()
  list.forEach((raw, i) => {
    const r = normalizeReason(raw)
    const name = r.label || `Reason ${i + 1}`
    if (!r.label) errors.push(`Reason ${i + 1} needs a name.`)
    if (!r.id) errors.push(`${name} has no id.`)
    else if (seen.has(r.id)) errors.push(`Two reasons share the id "${r.id}". Rename one.`)
    seen.add(r.id)
    const key = norm(r.label)
    if (key && labels.has(key)) errors.push(`Two reasons are both called "${r.label}". Rename one.`)
    labels.add(key)
    if (r.requirements) validateRequirements(r.requirements).forEach(e => errors.push(`${name}: ${e}`))
  })
  return errors
}

/** The reasons for one department at a campus: saved, else school-wide default, else the starting reasons. */
export function getClearanceReasons(scope, campusKey) {
  if (!SCOPE_IDS.includes(scope)) return []
  const saved = getSavedPart(scope, 'reasons', campusKey)
  return (saved || getDefaultClearanceReasons(scope)).map(normalizeReason)
}

/** True when this campus has saved its own reasons for the department. */
export function hasCustomClearanceReasons(scope, campusKey) {
  return campusHasOwnPart(scope, 'reasons', campusKey)
}

/** Save the reasons for one department at one campus (the requirements list is kept). Technical Admin only. */
export function saveClearanceReasons(scope, list, user, campusKey) {
  if (!SCOPE_IDS.includes(scope)) throw new Error(`Unknown department "${scope}".`)
  if (user?.role !== 'technical_admin') throw new Error('Only the Technical Administrator can change the clearance reasons.')
  needCampus(campusKey)
  const clean  = (list || []).map(normalizeReason)
  const errors = validateReasons(clean)
  if (errors.length) throw new Error(errors[0])
  writeCampusPart(scope, campusKey, { reasons: clean }, user)
  return clean
}

/** Go back to the default reasons for one department at one campus (its requirements are kept). Technical Admin only. */
export function resetClearanceReasons(scope, user, campusKey) {
  if (user?.role !== 'technical_admin') throw new Error('Only the Technical Administrator can change the clearance reasons.')
  dropCampusPart(scope, 'reasons', campusKey)
  return getClearanceReasons(scope, campusKey)
}

/**
 * The configured reason a clearance belongs to: by id, else by its label (records made before
 * reasons were configurable only stored the label). null when it no longer exists.
 */
export function findClearanceReason(scope, { reasonId, label, campusKey } = {}) {
  const list = getClearanceReasons(scope, campusKey)
  if (reasonId) { const hit = list.find(r => r.id === reasonId); if (hit) return hit }
  const want = norm(label)
  return want ? list.find(r => norm(r.label) === want) || null : null
}

// ═════════════════════════════════════════════════════════════════
// 2. RESOLVER — requirements + one student → sign-off slots
// ═════════════════════════════════════════════════════════════════

/** Read-only read of Subject Load for one campus + school year (never creates data). */
export function readSubjectLoad(campusKey, schoolYear) {
  const all = readJSON(SUBJECT_LOAD_KEY, {})
  return all?.[campusKey]?.[schoolYear] || null
}

/** The student record a clearance points at (almirene_students), or null. */
export function getStudentForClearance(studentId) {
  const students = readJSON(STUDENTS_KEY, [])
  return Array.isArray(students) ? students.find(s => sameId(s.id, studentId)) || null : null
}

/** The section id for a student: stored id, else match the stored name, else the only section. */
function resolveSectionId(student, sections = []) {
  if (student.sectionId && sections.some(s => sameId(s.id, student.sectionId))) return student.sectionId
  if (student.section) {
    const want = norm(student.section)
    const hit = sections.find(s => norm(s.displayName) === want || norm(s.defaultName) === want)
    if (hit) return hit.id
  }
  return sections.length === 1 ? sections[0].id : null
}

/**
 * Subjects the student takes, each with the instructor from Subject Load.
 * @returns {{ items: {subject, teacherId, teacherName}[], issue: string|null }}
 */
function getStudentSubjects(student, load) {
  if (!load) return { items: [], issue: 'no_subject_load' }

  if (getClearanceScope(student) === 'college') {
    const program = student.program, yearLevel = student.yearLevel, semester = student.semester || '1st'
    const names = load.collegeSubjects?.[program]?.[yearLevel]?.[semester] || []
    const sections = load.collegeSections?.[program]?.[yearLevel] || []
    const sectionId = resolveSectionId(student, sections)
    const loads = (load.collegeLoads || []).filter(l =>
      l.program === program && l.yearLevel === yearLevel && l.semester === semester &&
      (sectionId ? sameId(l.sectionId, sectionId) : false)
    )
    const items = names.map(subject => {
      const l = loads.find(x => x.subject === subject)
      return { subject, teacherId: l?.teacherId ?? null, teacherName: l?.teacherName || '' }
    })
    return { items, issue: !names.length ? 'no_subjects' : (!sectionId ? 'no_section' : null) }
  }

  const grade = student.gradeLevel
  const names = load.basicEdSubjects?.[grade] || []
  const items = names.map(subject => {
    const l = (load.basicEdLoads || []).find(x => x.gradeLevel === grade && x.subject === subject)
    return { subject, teacherId: l?.teacherId ?? null, teacherName: l?.teacherName || '' }
  })
  return { items, issue: !names.length ? 'no_subjects' : null }
}

/** The student's Basic Ed section adviser, or null. */
function getStudentAdviser(student, load) {
  if (!load || getClearanceScope(student) !== 'basicEd') return { adviser: null, issue: 'not_basic_ed' }
  const sections = load.basicEdSections?.[student.gradeLevel] || []
  const sectionId = resolveSectionId(student, sections)
  if (!sectionId) return { adviser: null, issue: 'no_section' }
  const a = (load.basicEdAdvisers || []).find(x => sameId(x.sectionId, sectionId))
  return { adviser: a ? { teacherId: a.teacherId ?? null, teacherName: a.teacherName || '' } : null, issue: null }
}

/** One blank (unsigned) slot for a requirement. */
function baseSlot(req, extra = {}) {
  return {
    id:              extra.id || req.id,
    requirementId:   req.id,
    label:           req.label,
    icon:            req.icon || 'default',
    itemLabel:       extra.itemLabel || null,
    signerType:      req.signer.type,
    order:           req.order,
    required:        req.required,
    autoFromPayment: !!req.autoFromPayment,
    cleared:   false,
    clearedBy: null,
    clearedAt: null,
    ...(req.signer.type === 'role' ? { roles:   [...req.signer.roles]   } : {}),
    ...(req.signer.type === 'user' ? { userIds: [...req.signer.userIds] } : {}),
    ...(extra.teacher ? {
      teacherId:   extra.teacher.teacherId,
      teacherName: extra.teacher.teacherName,
      unassigned:  extra.teacher.teacherId == null,
    } : {}),
  }
}

/**
 * Expand a requirements list into the actual sign-offs one student needs.
 *
 * @param {object}   student       an almirene_students record (department, campusKey, schoolYear,
 *                                 gradeLevel, section/sectionId, program, yearLevel, semester)
 * @param {object[]} requirements  from getClearanceRequirements(scope)
 * @param {object}   [ctx]         { subjectLoad } — injected for tests; read from storage by default
 * @returns {{ slots: object[], warnings: {requirementId:string, code:string, message:string}[] }}
 *
 * A requirement that needs a teacher nobody has been assigned yet still produces a slot, marked
 * `unassigned`, so the gap is visible instead of the requirement silently vanishing.
 */
export function resolveClearanceSlots(student, requirements, ctx = {}) {
  const slots = [], warnings = []
  if (!student) return { slots, warnings: [{ requirementId: '', code: 'no_student', message: 'The student record could not be found.' }] }

  const load = ctx.subjectLoad !== undefined ? ctx.subjectLoad : readSubjectLoad(student.campusKey, student.schoolYear)
  const warn = (req, code, message) => warnings.push({ requirementId: req.id, code, message })

  ;(requirements || []).forEach(req => {
    const t = req.signer.type

    if (t === 'role' || t === 'user') {
      slots.push(baseSlot(req))
      return
    }

    if (t === 'section_adviser') {
      const { adviser, issue } = getStudentAdviser(student, load)
      if (issue === 'not_basic_ed') { warn(req, issue, `${req.label} only applies to Basic Education students.`); return }
      if (issue === 'no_section')   warn(req, issue, `${req.label}: the student has no section yet.`)
      const teacher = adviser || { teacherId: null, teacherName: '' }
      if (!adviser && issue !== 'no_section') warn(req, 'unassigned', `${req.label}: no adviser is assigned to the student's section.`)
      slots.push(baseSlot(req, { teacher }))
      return
    }

    // student_instructors | subject_teacher both start from the student's subject list
    const { items, issue } = getStudentSubjects(student, load)
    if (issue === 'no_subject_load') { warn(req, issue, `${req.label}: Subject Load has not been set up for this school year.`); return }
    if (issue === 'no_subjects')     { warn(req, issue, `${req.label}: no subjects are listed for the student's level.`); return }
    if (issue === 'no_section')      warn(req, issue, `${req.label}: the student has no section, so instructors cannot be matched.`)

    const wanted = t === 'subject_teacher'
      ? items.filter(it => norm(it.subject).includes(norm(req.signer.subject)))
      : items
    if (!wanted.length) { warn(req, 'no_match', `${req.label}: the student has no subject matching "${req.signer.subject}".`); return }

    wanted.forEach(it => {
      if (it.teacherId == null) warn(req, 'unassigned', `${req.label}: no instructor is assigned to ${it.subject}.`)
      slots.push(baseSlot(req, { id: `${req.id}:${slug(it.subject)}`, itemLabel: it.subject, teacher: it }))
    })
  })

  return { slots, warnings }
}

// ═════════════════════════════════════════════════════════════════
// 3. SYNC — open clearances follow the configuration
// ═════════════════════════════════════════════════════════════════

/**
 * Bring a clearance's stored slots in line with freshly resolved ones.
 *   • in both            → keeps who signed and when; unsigned ones pick up label/teacher changes
 *   • only in resolved   → added as pending
 *   • only in existing   → dropped if unsigned; kept and marked `retired` if already signed
 * Pass fully cleared clearances through untouched — they are frozen and must not be synced.
 *
 * @returns {{ slots: object[], added: string[], dropped: string[], retired: string[], changed: boolean }}
 */
export function syncClearanceSlots(existing = [], resolved = []) {
  const byId = new Map(existing.map(s => [s.id, s]))
  const resolvedIds = new Set(resolved.map(s => s.id))
  const added = [], dropped = [], retired = []
  let changed = false

  const merged = resolved.map(next => {
    const prev = byId.get(next.id)
    if (!prev) { added.push(next.id); changed = true; return next }

    if (prev.cleared) {
      // Signed slots keep their original record. Only revive one that had been retired.
      if (prev.retired) { changed = true; const revived = { ...prev }; delete revived.retired; return revived }
      return prev
    }
    const refreshed = { ...next, note: prev.note }
    if (refreshed.note === undefined) delete refreshed.note
    if (JSON.stringify(refreshed) !== JSON.stringify(prev)) changed = true
    return refreshed
  })

  existing.forEach(prev => {
    if (resolvedIds.has(prev.id)) return
    if (prev.cleared) {
      // Already retired on an earlier sync: keep it as is, and do not report it again
      if (prev.retired) { merged.push(prev); return }
      changed = true; retired.push(prev.id); merged.push({ ...prev, retired: true })
    } else {
      changed = true; dropped.push(prev.id)
    }
  })

  return { slots: merged, added, dropped, retired, changed }
}

// ═════════════════════════════════════════════════════════════════
// 4. RULES — progress, ordering and who may sign
// ═════════════════════════════════════════════════════════════════

const active = (slots) => (slots || []).filter(s => !s.retired)

/** Cleared / total over the slots that count (retired ones are history only). */
export function getClearanceProgress(slots) {
  const list = active(slots)
  const byRequirement = {}
  list.forEach(s => {
    const b = byRequirement[s.requirementId] || (byRequirement[s.requirementId] = { cleared: 0, total: 0 })
    b.total += 1
    if (s.cleared) b.cleared += 1
  })
  const counted = list.filter(s => s.required)
  const cleared = counted.filter(s => s.cleared).length
  return { cleared, total: counted.length, percent: counted.length ? Math.round((cleared / counted.length) * 100) : 0, byRequirement }
}

/** Fully cleared = every required, active slot is signed. Needs at least one required slot. */
export function areSlotsFullyCleared(slots) {
  const counted = active(slots).filter(s => s.required)
  return counted.length > 0 && counted.every(s => s.cleared)
}

/** Why a slot cannot be signed right now (readable), or null if it can. */
export function slotBlockReason(slots, slotId) {
  const slot = (slots || []).find(s => s.id === slotId)
  if (!slot) return 'That sign-off no longer exists.'
  if (slot.retired) return `${slot.label} is no longer required.`
  if (slot.cleared) return `${slot.label}${slot.itemLabel ? ` (${slot.itemLabel})` : ''} is already signed.`
  if (slot.order === 'after_others') {
    const waiting = active(slots).filter(s => s.required && s.order === 'any' && !s.cleared)
    if (waiting.length) {
      const names = [...new Set(waiting.map(s => s.label))]
      return `${slot.label} signs last. Still waiting on: ${names.join(', ')}.`
    }
  }
  return null
}

/**
 * May this account sign this slot (ignoring order)?
 *   • Super Admin signs anything
 *   • role slots      → the account's role is listed
 *   • user slots      → the account is listed
 *   • teacher slots   → the account IS the assigned instructor / adviser
 *   • teacher slots with nobody assigned → Principal / Program Head (CLEARANCE_UNASSIGNED_FALLBACK_ROLES)
 *   • an account given the requirement as an extra duty (user.clearanceDuties) signs it too
 */
export function canUserSignSlot(user, slot) {
  if (!user || !slot || slot.retired) return false
  if (user.role === 'technical_admin') return true
  if (Array.isArray(user.clearanceDuties) && user.clearanceDuties.includes(slot.requirementId)) return true
  // Nobody assigned yet: Principal / Program Head may sign on behalf (a note is required by documentBridge)
  if (slot.unassigned && CLEARANCE_UNASSIGNED_FALLBACK_ROLES.includes(user.role)) return true
  switch (slot.signerType) {
    case 'role': return (slot.roles || []).includes(user.role)
    case 'user': return (slot.userIds || []).some(id => sameId(id, user.id))
    default:     return sameId(slot.teacherId, user.id)
  }
}

/** Slots this account may sign RIGHT NOW: theirs, unsigned, and not held back by ordering. */
export function getSignableSlots(user, slots) {
  return (slots || []).filter(s => canUserSignSlot(user, s) && !slotBlockReason(slots, s.id))
}

// ═════════════════════════════════════════════════════════════════
// 5. COVERAGE CHECK — what a requirements list would mean for real students
// ═════════════════════════════════════════════════════════════════

/** All student records (almirene_students), or []. */
export function readStudentsForClearance() {
  const list = readJSON(STUDENTS_KEY, [])
  return Array.isArray(list) ? list : []
}

const studentLabel = (s) =>
  [s.lastName, s.firstName].filter(Boolean).join(', ') || s.name || s.studentName || `Student ${s.id}`

/**
 * Dry run of a requirements list against the students of one department. Nothing is written.
 *
 * Answers the question the Settings editor asks before saving: "would any student end up
 * with no required sign-offs?" A clearance with zero required slots can never be completed.
 *
 *   zero    students who would get no required sign-off, with the reasons
 *   counts  how many students would get N required sign-offs: { [N]: students }
 *   issues  Subject Load gaps that leave a teacher-based requirement short
 *           (no section, no instructor assigned, no matching subject, ...), grouped
 *
 * @param {'basicEd'|'college'} scope
 * @param {object[]} requirements   the draft list
 * @param {object[]} [students]     injected for tests; read from storage by default
 * @param {function} [loadSubjectLoad]  (campusKey, schoolYear) => load|null, injected for tests
 * @returns {{ total:number, zeroCount:number, zero:{id,name,reasons:string[]}[],
 *             counts:Object<string,number>, issues:{requirementId,code,message,count}[] }}
 */
export function analyzeClearanceCoverage(scope, requirements, students, loadSubjectLoad = readSubjectLoad) {
  const reqs = (requirements || []).map(normalizeRequirement)
  const list = (students || readStudentsForClearance()).filter(s => getClearanceScope(s) === scope)
  const loadCache = new Map()
  const loadFor = (s) => {
    const key = `${s.campusKey}|${s.schoolYear}`
    if (!loadCache.has(key)) loadCache.set(key, loadSubjectLoad(s.campusKey, s.schoolYear))
    return loadCache.get(key)
  }

  const zero = [], counts = {}, issueMap = new Map()
  list.forEach(s => {
    const { slots, warnings } = resolveClearanceSlots(s, reqs, { subjectLoad: loadFor(s) })
    const required = slots.filter(x => x.required).length
    counts[required] = (counts[required] || 0) + 1

    warnings.forEach(w => {
      const key = `${w.requirementId}|${w.code}`
      const e = issueMap.get(key) || { requirementId: w.requirementId, code: w.code, message: w.message, count: 0 }
      e.count += 1
      issueMap.set(key, e)
    })
    if (required === 0) {
      zero.push({ id: s.id, name: studentLabel(s), reasons: [...new Set(warnings.map(w => w.message))] })
    }
  })

  return {
    total: list.length,
    zeroCount: zero.length,
    zero,
    counts,
    issues: [...issueMap.values()].sort((a, b) => b.count - a.count),
  }
}
