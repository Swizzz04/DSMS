/**
 * useWorkflow.js — ALMIRENE DX Workflow Hook
 *
 * Wraps workflowEngine (pure functions) + workflowConfigBridge (data)
 * into a single ergonomic hook for page components.
 *
 * Usage:
 *   const {
 *     workflowDef, currentStep, orderedSteps,
 *     availableActions, fieldPermissions, progress,
 *     canAct, isFinal, advance, auditTrail,
 *   } = useWorkflow(workflowId, currentStepId, record, user)
 *
 * `advance(actionId, note?)` handles validate → execute → save → notify.
 * Pages never call workflowEngine or workflowConfigBridge directly.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import * as workflowEngine from '../engines/workflowEngine'
import {
  getWorkflowDefinition,
  appendAuditEntry,
  getAuditTrail,
} from '../utils/workflowConfigBridge'

/**
 * Primary hook — use this in every page component that has workflow steps.
 *
 * @param {string}   workflowId    — e.g. 'enrollment_basic_ed'
 * @param {string}   currentStepId — current step ID on the record
 * @param {object}   record        — the full record object (enrollment, grade, etc.)
 * @param {object}   user          — current authenticated user from useAuth()
 * @param {function} onAdvance     — async function(updatedRecord) called after a successful transition
 *                                   This is where the bridge save happens (e.g. enrollmentBridge.saveRecord)
 * @returns {object}
 */
export function useWorkflow(workflowId, currentStepId, record, user, onAdvance) {
  const [workflowDef, setWorkflowDef]   = useState(null)
  const [auditTrail, setAuditTrail]     = useState([])
  const [isAdvancing, setIsAdvancing]   = useState(false)
  const [advanceError, setAdvanceError] = useState(null)

  // Keep onAdvance in a ref so it never triggers a re-render when it changes
  const onAdvanceRef = useRef(onAdvance)
  useEffect(() => { onAdvanceRef.current = onAdvance }, [onAdvance])

  // Load workflow definition on mount and when workflowId/campusKey changes
  useEffect(() => {
    if (!workflowId || !record?.campusKey) return
    const def = getWorkflowDefinition(workflowId, record.campusKey)
    setWorkflowDef(def)
  }, [workflowId, record?.campusKey])

  // Load and refresh audit trail when record changes
  useEffect(() => {
    if (!record?.id) return
    setAuditTrail(getAuditTrail(record.id))
  }, [record?.id, currentStepId]) // Re-run when step changes (after advance)

  // Listen for workflow config changes (Super Admin edits in Settings)
  useEffect(() => {
    if (!workflowId || !record?.campusKey) return
    const handler = () => {
      const def = getWorkflowDefinition(workflowId, record.campusKey)
      setWorkflowDef(def)
    }
    window.addEventListener('almirene_workflow_config_updated', handler)
    return () => window.removeEventListener('almirene_workflow_config_updated', handler)
  }, [workflowId, record?.campusKey])

  /**
   * Advance the workflow.
   * Validates → executes → saves audit entry → calls onAdvance(updatedRecord).
   * The bridge's save call happens inside onAdvance — keeps the hook decoupled from storage.
   *
   * @param {string} actionId
   * @param {string} [note='']
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  const advance = useCallback(async (actionId, note = '') => {
    if (!workflowDef || !record || !user) {
      return { success: false, error: 'Missing workflow definition, record, or user.' }
    }

    setIsAdvancing(true)
    setAdvanceError(null)

    try {
      // 1. Validate
      const { valid, reason } = workflowEngine.validateTransition(
        user, currentStepId, actionId, record, workflowDef
      )
      if (!valid) {
        setAdvanceError(reason)
        setIsAdvancing(false)
        return { success: false, error: reason }
      }

      // 2. Execute (returns new state — does NOT save)
      const { updatedRecord, auditEntry, notificationTrigger } =
        workflowEngine.executeTransition(
          user, currentStepId, actionId, note, record, workflowDef
        )

      // 3. Save audit entry (append-only — bridge handles localStorage)
      appendAuditEntry(auditEntry)

      // 4. Call the page's onAdvance callback — it does the bridge save
      if (onAdvanceRef.current) {
        await onAdvanceRef.current(updatedRecord)
      }

      // 5. Fire notification event if needed
      if (notificationTrigger) {
        window.dispatchEvent(new CustomEvent('almirene_notification_trigger', {
          detail: { triggerId: notificationTrigger, record: updatedRecord }
        }))
      }

      // 6. Refresh audit trail
      setAuditTrail(getAuditTrail(record.id))

      setIsAdvancing(false)
      return { success: true }

    } catch (err) {
      console.error('[useWorkflow] advance error:', err)
      const msg = err?.message ?? 'An unexpected error occurred.'
      setAdvanceError(msg)
      setIsAdvancing(false)
      return { success: false, error: msg }
    }
  }, [workflowDef, record, user, currentStepId])

  // ── Derived values from the pure engine (computed on every render, zero cost) ──

  const currentStep      = workflowDef ? workflowEngine.getStep(currentStepId, workflowDef)         : null
  const orderedSteps     = workflowDef ? workflowEngine.getOrderedSteps(workflowDef)                : []
  const availableActions = workflowDef ? workflowEngine.getAvailableActions(user, currentStepId, record, workflowDef) : []
  const fieldPermissions = workflowDef ? workflowEngine.getFieldPermissions(user, currentStepId, workflowDef) : {}
  const progress         = workflowDef ? workflowEngine.getProgress(currentStepId, workflowDef)     : 0
  const canActNow        = workflowDef ? workflowEngine.canAct(user, currentStepId, workflowDef)    : false
  const isFinalStep      = workflowDef ? workflowEngine.isFinal(currentStepId, workflowDef)         : false
  const canView          = workflowDef ? workflowEngine.canView(user, workflowDef)                  : false
  const canCreate        = workflowDef ? workflowEngine.canCreate(user, workflowDef)                : false
  const skippedSteps     = workflowDef ? workflowEngine.getSkippedSteps(record ?? {}, workflowDef)  : []
  const summary          = workflowDef ? workflowEngine.getWorkflowSummary(workflowDef)             : []

  return {
    // Data
    workflowDef,
    currentStep,
    orderedSteps,
    summary,           // Array of { id, label, order, color, allowedRoles, isInitial, isFinal }

    // Permissions
    canAct:    canActNow,
    canView,
    canCreate,
    isFinal:   isFinalStep,

    // Actions
    availableActions,  // Filtered actions this user can take right now
    fieldPermissions,  // { [fieldName]: 'editable' | 'visible' | 'hidden' }
    skippedSteps,      // Step IDs that will auto-skip for this record

    // Progress
    progress,          // 0-100 integer for progress bars

    // Advance function
    advance,           // (actionId, note?) => Promise<{ success, error? }>
    isAdvancing,       // true while advance is in-flight
    advanceError,      // Error message from last failed advance (null if none)

    // Audit
    auditTrail,        // Array of audit entries for this record
  }
}

/**
 * Lightweight hook — just reads the workflow definition.
 * Use when you only need to render step labels / colors (e.g. badge in a list row)
 * without the full advance machinery.
 *
 * @param {string} workflowId
 * @param {string} campusKey
 * @returns {{ workflowDef: object | null, getStep: function }}
 */
export function useWorkflowDef(workflowId, campusKey) {
  const [workflowDef, setWorkflowDef] = useState(null)

  useEffect(() => {
    if (!workflowId || !campusKey) return
    setWorkflowDef(getWorkflowDefinition(workflowId, campusKey))
  }, [workflowId, campusKey])

  useEffect(() => {
    if (!workflowId || !campusKey) return
    const handler = () => setWorkflowDef(getWorkflowDefinition(workflowId, campusKey))
    window.addEventListener('almirene_workflow_config_updated', handler)
    return () => window.removeEventListener('almirene_workflow_config_updated', handler)
  }, [workflowId, campusKey])

  const getStep = useCallback(
    (stepId) => workflowDef ? workflowEngine.getStep(stepId, workflowDef) : null,
    [workflowDef]
  )

  return { workflowDef, getStep }
}