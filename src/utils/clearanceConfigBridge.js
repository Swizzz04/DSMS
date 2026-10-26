/**
 * clearanceConfigBridge.js — ALMIRENE DX · Student Clearance requirements
 *
 * Plain .js on purpose (no JSX, no React): the page, documentBridge and Settings all
 * import it, and it is the one place that knows what a clearance is made of.
 *
 * What it does
 *   1. Stores the clearance REQUIREMENTS list per school department ('basicEd' | 'college').
 *      Key: almirene_clearance_requirements   Event: almirene_clearance_config_updated
 *      Until the school saves its own list, the defaults from appConfig.js are used.
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

function loadConfig() {
  const cfg = readJSON(CONFIG_KEY, {})
  return cfg && typeof cfg === 'object' ? cfg : {}
}

/**
 * The requirements for one school department, saved list if there is one, else defaults.
 * @param {'basicEd'|'college'} scope
 */
export function getClearanceRequirements(scope) {
  if (!SCOPE_IDS.includes(scope)) return []
  const saved = loadConfig()[scope]
  if (Array.isArray(saved?.requirements) && saved.requirements.length) {
    return saved.requirements.map(normalizeRequirement)
  }
  return getDefaultClearanceRequirements(scope).map(normalizeRequirement)
}

/** True when the school has saved its own list for this department (false = still on defaults). */
export function hasCustomClearanceRequirements(scope) {
  const saved = loadConfig()[scope]
  return Array.isArray(saved?.requirements) && saved.requirements.length > 0
}

/**
 * Save the requirements for one department. Technical Admin only.
 * Throws a readable Error when the list is invalid or the user may not change it.
 */
export function saveClearanceRequirements(scope, list, user) {
  if (!SCOPE_IDS.includes(scope)) throw new Error(`Unknown department "${scope}".`)
  if (user?.role !== 'technical_admin') throw new Error('Only the Technical Administrator can change the clearance requirements.')

  const clean  = (list || []).map(normalizeRequirement)
  const errors = validateRequirements(clean)
  if (errors.length) throw new Error(errors[0])

  const cfg = loadConfig()
  cfg[scope] = { requirements: clean, updatedAt: new Date().toISOString(), updatedBy: user?.name || 'Technical Administrator' }
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg))
  window.dispatchEvent(new CustomEvent(CONFIG_EVENT))
  return clean
}

/** Go back to the built-in list for one department. Technical Admin only. */
export function resetClearanceRequirements(scope, user) {
  if (user?.role !== 'technical_admin') throw new Error('Only the Technical Administrator can change the clearance requirements.')
  const cfg = loadConfig()
  delete cfg[scope]
  localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg))
  window.dispatchEvent(new CustomEvent(CONFIG_EVENT))
  return getClearanceRequirements(scope)
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
