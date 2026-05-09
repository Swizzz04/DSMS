/**
 * workflowEngine.js — ALMIRENE DX Workflow Engine
 *
 * Pure functions ONLY. This engine:
 *   - Never reads from localStorage
 *   - Never writes to localStorage
 *   - Never accesses React context
 *   - Always accepts workflowDefinition as a parameter
 *   - Returns what SHOULD happen — the bridge file does the saving
 *
 * Usage pattern (in any bridge file):
 *   import * as workflowEngine from '../engines/workflowEngine'
 *   const { valid, reason } = workflowEngine.validateTransition(user, stepId, actionId, record, workflowDef)
 *   const { updatedRecord, auditEntry, notificationTrigger } = workflowEngine.executeTransition(...)
 *
 * @module workflowEngine
 */

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if the user is a technical_admin (wildcard — always allowed).
 * @param {object} user
 * @returns {boolean}
 */
function isSuperAdmin(user) {
  return user?.role === 'technical_admin'
}

/**
 * Evaluates a single condition against a record.
 *
 * Supported operators:
 *   equals          — record[field] === value
 *   not_equals      — record[field] !== value
 *   greater_than    — record[field] > value
 *   less_than       — record[field] < value
 *   greater_or_equal — record[field] >= value
 *   less_or_equal   — record[field] <= value
 *   is_empty        — falsy or empty array/string
 *   is_not_empty    — truthy and non-empty
 *   includes        — array/string includes value
 *   not_includes    — array/string does NOT include value
 *
 * Nested field paths are supported via dot notation: 'documents.form138'
 *
 * @param {object} condition
 * @param {object} record
 * @returns {boolean}
 */
function evaluateCondition(condition, record) {
  const { field, operator, value } = condition

  // Resolve nested paths: 'documents.form138' → record.documents?.form138
  const fieldValue = field.split('.').reduce((obj, key) => obj?.[key], record)

  switch (operator) {
    case 'equals':
      return fieldValue === value

    case 'not_equals':
      return fieldValue !== value

    case 'greater_than':
      return typeof fieldValue === 'number' && fieldValue > value

    case 'less_than':
      return typeof fieldValue === 'number' && fieldValue < value

    case 'greater_or_equal':
      return typeof fieldValue === 'number' && fieldValue >= value

    case 'less_or_equal':
      return typeof fieldValue === 'number' && fieldValue <= value

    case 'is_empty':
      if (fieldValue === null || fieldValue === undefined || fieldValue === false) return true
      if (Array.isArray(fieldValue)) return fieldValue.length === 0
      if (typeof fieldValue === 'string') return fieldValue.trim() === ''
      return false

    case 'is_not_empty':
      if (fieldValue === null || fieldValue === undefined || fieldValue === false) return false
      if (Array.isArray(fieldValue)) return fieldValue.length > 0
      if (typeof fieldValue === 'string') return fieldValue.trim() !== ''
      return true

    case 'includes':
      if (Array.isArray(fieldValue)) return fieldValue.includes(value)
      if (typeof fieldValue === 'string') return fieldValue.includes(value)
      return false

    case 'not_includes':
      if (Array.isArray(fieldValue)) return !fieldValue.includes(value)
      if (typeof fieldValue === 'string') return !fieldValue.includes(value)
      return true

    default:
      // Unknown operator — log a warning and treat as false so we never silently block
      console.warn(`[workflowEngine] Unknown condition operator: "${operator}"`)
      return false
  }
}

/**
 * Returns the step definition for a given step ID.
 * Internal version (no null guard needed — callers handle null).
 * @param {string} stepId
 * @param {object} workflowDefinition
 * @returns {object|undefined}
 */
function findStep(stepId, workflowDefinition) {
  return workflowDefinition?.steps?.find(s => s.id === stepId)
}

/**
 * Generates a unique ID for audit entries.
 * Uses timestamp + random suffix — no crypto dependency needed.
 * @param {string} prefix
 * @returns {string}
 */
function uid(prefix = 'audit') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}


// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if a user can view records in a workflow.
 * technical_admin always returns true (wildcard).
 *
 * @param {object} user
 * @param {object} workflowDefinition
 * @returns {boolean}
 */
export function canView(user, workflowDefinition) {
  if (isSuperAdmin(user)) return true
  const allowed = workflowDefinition?.permissions?.canView ?? []
  return allowed.includes(user?.role)
}

/**
 * Check if a user can create a new record in a workflow.
 * technical_admin always returns true.
 *
 * @param {object} user
 * @param {object} workflowDefinition
 * @returns {boolean}
 */
export function canCreate(user, workflowDefinition) {
  if (isSuperAdmin(user)) return true
  const allowed = workflowDefinition?.permissions?.canCreate ?? []
  return allowed.includes(user?.role)
}

/**
 * Check if a user can export data from a workflow.
 *
 * @param {object} user
 * @param {object} workflowDefinition
 * @returns {boolean}
 */
export function canExport(user, workflowDefinition) {
  if (isSuperAdmin(user)) return true
  const allowed = workflowDefinition?.permissions?.canExport ?? []
  return allowed.includes(user?.role)
}

/**
 * Check if a user can delete records in a workflow.
 * By design, only technical_admin can delete in most workflows.
 *
 * @param {object} user
 * @param {object} workflowDefinition
 * @returns {boolean}
 */
export function canDelete(user, workflowDefinition) {
  if (isSuperAdmin(user)) return true
  const allowed = workflowDefinition?.permissions?.canDelete ?? []
  return allowed.includes(user?.role)
}

/**
 * Check if a user can perform any action at the current step.
 * Does NOT check conditions — only checks if the user's role is allowed at this step.
 * Use getAvailableActions() if you need condition-filtered actions.
 *
 * @param {object} user
 * @param {string} currentStepId
 * @param {object} workflowDefinition
 * @returns {boolean}
 */
export function canAct(user, currentStepId, workflowDefinition) {
  if (isSuperAdmin(user)) return true
  const step = findStep(currentStepId, workflowDefinition)
  if (!step) return false
  if (step.isFinal) return false                // Final steps have no further actions
  return step.allowedRoles?.includes(user?.role) ?? false
}

/**
 * Get the available actions for a user at the current step.
 * Filters out actions if the step's conditions block the action
 * (e.g., block_if conditions reduce available options).
 *
 * @param {object} user
 * @param {string} currentStepId
 * @param {object} record
 * @param {object} workflowDefinition
 * @returns {Array} — only actions the user is allowed to take, empty if none
 */
export function getAvailableActions(user, currentStepId, record, workflowDefinition) {
  if (!canAct(user, currentStepId, workflowDefinition)) return []

  const step = findStep(currentStepId, workflowDefinition)
  if (!step || !Array.isArray(step.actions)) return []

  const actions = step.actions ?? []

  // Evaluate block_if conditions — if any block condition is true, remove affected actions
  const blockConditions = (step.conditions ?? []).filter(c => c.type === 'block_if')

  // If block conditions list an actionId, block only that action
  // If they don't specify an actionId, block ALL actions at this step
  const blockedActionIds = new Set()
  for (const cond of blockConditions) {
    if (evaluateCondition(cond, record)) {
      if (cond.actionId) {
        blockedActionIds.add(cond.actionId)
      } else {
        // Block everything at this step
        return []
      }
    }
  }

  return actions.filter(action => !blockedActionIds.has(action.id))
}

/**
 * Get field permissions for a user at the current step.
 * Returns a map of { [fieldName]: 'visible' | 'editable' | 'hidden' }.
 * If a field has no entry for the user's role, defaults to 'visible'.
 *
 * @param {object} user
 * @param {string} currentStepId
 * @param {object} workflowDefinition
 * @returns {object} — { [fieldName]: 'visible' | 'editable' | 'hidden' }
 */
export function getFieldPermissions(user, currentStepId, workflowDefinition) {
  // technical_admin sees and edits everything
  if (isSuperAdmin(user)) {
    const step = findStep(currentStepId, workflowDefinition)
    const result = {}
    if (step?.fieldPermissions) {
      for (const fp of step.fieldPermissions) {
        result[fp.field] = 'editable'
      }
    }
    return result
  }

  const step = findStep(currentStepId, workflowDefinition)
  if (!step || !Array.isArray(step.fieldPermissions)) return {}

  const result = {}
  for (const fp of step.fieldPermissions) {
    // Find the access level for this user's role
    if (fp.roles?.includes(user?.role)) {
      result[fp.field] = fp.access
    } else if (!(fp.field in result)) {
      // If this field hasn't been set yet and no specific role rule applies,
      // default to 'visible' (least-restrictive safe default)
      result[fp.field] = 'visible'
    }
  }
  return result
}

/**
 * Evaluate conditions and determine the next step.
 * Automatically resolves skip_if chains — if the next step has a skip_if condition
 * that is true, continues advancing until it finds a step that doesn't skip.
 *
 * @param {string} currentStepId
 * @param {object} action — the action being taken (contains nextStep)
 * @param {object} record
 * @param {object} workflowDefinition
 * @returns {{ nextStepId: string, skipped: string[] }}
 */
export function resolveNextStep(currentStepId, action, record, workflowDefinition) {
  const skipped = []
  let targetStepId = action.nextStep

  // Walk the skip_if chain — max 20 hops to prevent infinite loops
  let hops = 0
  while (targetStepId && hops < 20) {
    const targetStep = findStep(targetStepId, workflowDefinition)
    if (!targetStep) break

    // Check skip_if conditions on the target step
    const skipConditions = (targetStep.conditions ?? []).filter(c => c.type === 'skip_if')
    const shouldSkip = skipConditions.some(c => evaluateCondition(c, record))

    if (shouldSkip) {
      // Find the first available action on the skipped step to know where to go next
      const skipAction = targetStep.actions?.[0]
      if (skipAction?.nextStep) {
        skipped.push(targetStepId)
        targetStepId = skipAction.nextStep
        hops++
      } else {
        // No next step after skip — stay here
        break
      }
    } else {
      // No skip — this is the real next step
      break
    }
  }

  if (hops >= 20) {
    console.warn('[workflowEngine] resolveNextStep: Maximum hop limit reached. Possible circular skip_if definition.')
  }

  return { nextStepId: targetStepId, skipped }
}

/**
 * Validate that a transition is legal before executing it.
 * Checks:
 *   1. User's role is allowed at the current step
 *   2. The action exists at the current step
 *   3. The action is not blocked by block_if conditions
 *   4. require_if conditions are satisfied (required fields are present)
 *
 * @param {object} user
 * @param {string} currentStepId
 * @param {string} actionId
 * @param {object} record
 * @param {object} workflowDefinition
 * @returns {{ valid: boolean, reason: string | null }}
 */
export function validateTransition(user, currentStepId, actionId, record, workflowDefinition) {
  // 1. Check role is allowed at this step
  if (!canAct(user, currentStepId, workflowDefinition)) {
    const step = findStep(currentStepId, workflowDefinition)
    if (step?.isFinal) {
      return { valid: false, reason: 'This record has reached its final step and cannot be advanced.' }
    }
    return {
      valid: false,
      reason: `Your role (${user?.role}) is not allowed to act at the "${step?.label ?? currentStepId}" step.`,
    }
  }

  // 2. Check action exists on this step
  const step = findStep(currentStepId, workflowDefinition)
  const action = step?.actions?.find(a => a.id === actionId)
  if (!action) {
    return {
      valid: false,
      reason: `Action "${actionId}" does not exist at the "${step?.label ?? currentStepId}" step.`,
    }
  }

  // 3. Check block_if conditions
  const blockConditions = (step.conditions ?? []).filter(c => c.type === 'block_if')
  for (const cond of blockConditions) {
    if (evaluateCondition(cond, record)) {
      // If the block is for a specific action, only block that action
      if (cond.actionId && cond.actionId !== actionId) continue
      return {
        valid: false,
        reason: cond.reason ?? `This action is currently blocked. ${cond.field} condition not met.`,
      }
    }
  }

  // 4. Check require_if conditions — these block advancement unless a field condition IS met
  const requireConditions = (step.conditions ?? []).filter(c => c.type === 'require_if')
  for (const cond of requireConditions) {
    if (!evaluateCondition(cond, record)) {
      return {
        valid: false,
        reason: cond.reason ?? `Required condition not met: field "${cond.field}" must satisfy "${cond.operator}" ${cond.value}.`,
      }
    }
  }

  return { valid: true, reason: null }
}

/**
 * Execute a step transition.
 * Returns the updated record state, the audit entry, and any notification trigger.
 * Does NOT save — the calling bridge file is responsible for persistence.
 *
 * @param {object} user
 * @param {string} currentStepId
 * @param {string} actionId
 * @param {string} note
 * @param {object} record
 * @param {object} workflowDefinition
 * @returns {{ updatedRecord: object, auditEntry: object, notificationTrigger: string | null }}
 */
export function executeTransition(user, currentStepId, actionId, note, record, workflowDefinition) {
  const step = findStep(currentStepId, workflowDefinition)
  const action = step?.actions?.find(a => a.id === actionId)

  if (!step || !action) {
    throw new Error(`[workflowEngine] executeTransition: Step "${currentStepId}" or action "${actionId}" not found.`)
  }

  // Resolve the next step (handles skip_if chain)
  const { nextStepId, skipped } = resolveNextStep(currentStepId, action, record, workflowDefinition)

  const now = new Date().toISOString()

  // Build the updated record — engine only updates workflow-related fields
  // The bridge file merges this with its own domain-specific updates
  const updatedRecord = {
    ...record,
    currentStep: nextStepId,
    previousStep: currentStepId,
    updatedAt: now,

    // Append to stageHistory (used by enrollments, document requests, etc.)
    stageHistory: [
      ...(record.stageHistory ?? []),
      {
        step:          nextStepId,
        fromStep:      currentStepId,
        actionId,
        actionLabel:   action.label,
        by:            user.id ?? user.username,
        byName:        user.name ?? user.username,
        byRole:        user.role,
        note:          note ?? '',
        skippedSteps:  skipped,
        at:            now,
      },
    ],
  }

  // Build the immutable audit entry — never deleted
  const auditEntry = {
    id:              uid('audit'),
    recordId:        record.id,
    workflowId:      workflowDefinition.workflowId,
    workflowVersion: workflowDefinition.version ?? 1,
    campusKey:       record.campusKey ?? workflowDefinition.campusKey,
    fromStep:        currentStepId,
    toStep:          nextStepId,
    actionId,
    actionLabel:     action.label,
    performedBy:     user.id ?? user.username,
    performedByName: user.name ?? user.username,
    performedByRole: user.role,
    note:            note ?? '',
    skippedSteps:    skipped,
    timestamp:       now,                        // Immutable — never updated
  }

  // Notification trigger from the action definition, OR from the target step
  const targetStep = findStep(nextStepId, workflowDefinition)
  const notificationTrigger =
    action.notifyTrigger ??
    targetStep?.notifyTrigger ??
    null

  return { updatedRecord, auditEntry, notificationTrigger }
}

/**
 * Get the full step definition for a given step ID.
 *
 * @param {string} stepId
 * @param {object} workflowDefinition
 * @returns {object | null}
 */
export function getStep(stepId, workflowDefinition) {
  return findStep(stepId, workflowDefinition) ?? null
}

/**
 * Get all steps sorted by their order property.
 * Non-final steps come first in order, final steps (approved/rejected) come last.
 *
 * @param {object} workflowDefinition
 * @returns {Array}
 */
export function getOrderedSteps(workflowDefinition) {
  const steps = workflowDefinition?.steps ?? []
  return [...steps].sort((a, b) => {
    // Non-final steps sort by order
    // Final steps always sort to the end (use Infinity as their order)
    const orderA = a.isFinal ? Infinity : (a.order ?? 0)
    const orderB = b.isFinal ? Infinity : (b.order ?? 0)
    return orderA - orderB
  })
}

/**
 * Check if a record is at a final step (approved, rejected, completed, etc.).
 *
 * @param {string} currentStepId
 * @param {object} workflowDefinition
 * @returns {boolean}
 */
export function isFinal(currentStepId, workflowDefinition) {
  const step = findStep(currentStepId, workflowDefinition)
  return step?.isFinal === true
}

/**
 * Get a progress percentage for progress bars.
 * Only counts non-final steps in the calculation.
 * A record at the first step is at ~(1/total)%. A final step returns 100%.
 *
 * @param {string} currentStepId
 * @param {object} workflowDefinition
 * @returns {number} — integer 0–100
 */
export function getProgress(currentStepId, workflowDefinition) {
  if (isFinal(currentStepId, workflowDefinition)) return 100

  // Only use non-final steps for calculating progress
  const progressSteps = getOrderedSteps(workflowDefinition).filter(s => !s.isFinal)
  if (progressSteps.length === 0) return 0

  const currentIndex = progressSteps.findIndex(s => s.id === currentStepId)
  if (currentIndex < 0) return 0

  // Progress: completing step N of total means you're at N/total × 100
  // e.g. 5-step workflow, at step 2 (index 1) → (2/5) × 100 = 40%
  return Math.round(((currentIndex + 1) / progressSteps.length) * 100)
}

/**
 * Get the initial step of a workflow (isInitial: true).
 * Falls back to the step with order: 1 if no isInitial flag is set.
 *
 * @param {object} workflowDefinition
 * @returns {object | null}
 */
export function getInitialStep(workflowDefinition) {
  const steps = workflowDefinition?.steps ?? []
  return (
    steps.find(s => s.isInitial === true) ??
    getOrderedSteps(workflowDefinition).find(s => !s.isFinal) ??
    null
  )
}

/**
 * Evaluate all skip_if conditions on a step and determine if the step
 * should be auto-skipped when reached. Used by resolveNextStep internally,
 * but also exported for UI components that want to show/hide steps in
 * a progress indicator based on whether they'll be reached.
 *
 * @param {string} stepId
 * @param {object} record
 * @param {object} workflowDefinition
 * @returns {boolean}
 */
export function willSkip(stepId, record, workflowDefinition) {
  const step = findStep(stepId, workflowDefinition)
  if (!step) return false
  const skipConditions = (step.conditions ?? []).filter(c => c.type === 'skip_if')
  return skipConditions.length > 0 && skipConditions.some(c => evaluateCondition(c, record))
}

/**
 * Get all steps that will be skipped for a given record based on its current data.
 * Useful for rendering a progress tracker that grays out auto-skipped steps.
 *
 * @param {object} record
 * @param {object} workflowDefinition
 * @returns {string[]} — array of step IDs that will be auto-skipped
 */
export function getSkippedSteps(record, workflowDefinition) {
  const steps = workflowDefinition?.steps ?? []
  return steps
    .filter(s => !s.isFinal && willSkip(s.id, record, workflowDefinition))
    .map(s => s.id)
}

/**
 * Check if a specific action requires a note/reason.
 *
 * @param {string} currentStepId
 * @param {string} actionId
 * @param {object} workflowDefinition
 * @returns {boolean}
 */
export function actionRequiresNote(currentStepId, actionId, workflowDefinition) {
  const step = findStep(currentStepId, workflowDefinition)
  const action = step?.actions?.find(a => a.id === actionId)
  return action?.requiresNote === true
}

/**
 * Get a human-readable summary of a workflow's steps for display.
 * Returns ordered non-final steps with label, order, color, and allowedRoles.
 *
 * @param {object} workflowDefinition
 * @returns {Array<{ id, label, order, color, allowedRoles, isInitial, isFinal }>}
 */
export function getWorkflowSummary(workflowDefinition) {
  return getOrderedSteps(workflowDefinition).map(s => ({
    id:           s.id,
    label:        s.label,
    description:  s.description ?? '',
    order:        s.order ?? null,
    color:        s.color ?? 'gray',
    allowedRoles: s.allowedRoles ?? [],
    isInitial:    s.isInitial === true,
    isFinal:      s.isFinal === true,
    deadlineHours: s.deadlineHours ?? null,
  }))
}