/**
 * workflowConfigBridge.js — ALMIRENE DX Workflow Configuration Bridge
 *
 * Stores and retrieves workflow definitions and audit trails.
 * Swap localStorage calls for API calls when ASP.NET backend is ready.
 * Pages never import this directly — they use useWorkflow() hook.
 *
 * localStorage keys:
 *   almirene_workflow_config   — workflow definitions
 *   almirene_workflow_audit    — immutable audit trail (append-only, never delete)
 *
 * Events:
 *   almirene_workflow_config_updated
 */

const CONFIG_KEY = 'almirene_workflow_config'
const AUDIT_KEY  = 'almirene_workflow_audit'
const EVENT_KEY  = 'almirene_workflow_config_updated'

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function loadConfig() {
  try { return JSON.parse(localStorage.getItem(CONFIG_KEY) || '[]') }
  catch { return [] }
}

function saveConfig(data) {
  // Deduplicate before saving — campus-specific beats 'all' for same workflowId.
  // This guards against React StrictMode double-invoking initializeDefaults()
  // concurrently, where both reads see [] and both push the full defaults.
  const seen = new Map()
  for (const w of data) {
    const existing = seen.get(w.workflowId)
    // Keep campus-specific over 'all'; if same campusKey, keep latest version
    if (!existing || w.campusKey !== 'all' || existing.campusKey === 'all') {
      seen.set(w.workflowId + '__' + w.campusKey, w)
    }
  }
  localStorage.setItem(CONFIG_KEY, JSON.stringify([...seen.values()]))
  window.dispatchEvent(new CustomEvent(EVENT_KEY))
}

function loadAudit() {
  try { return JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]') }
  catch { return [] }
}

function saveAudit(data) {
  // Audit log is never dispatched as an event — it's a silent write
  localStorage.setItem(AUDIT_KEY, JSON.stringify(data))
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all workflow definitions for a campus.
 * 'all' campus key returns global workflows; campus-specific ones override globals.
 *
 * @param {string} campusKey
 * @returns {Array}
 */
export function getAllWorkflows(campusKey) {
  const all = loadConfig()
  const relevant = all.filter(w => w.campusKey === campusKey || w.campusKey === 'all')
  // Deduplicate by workflowId — campus-specific beats global.
  // Guards against StrictMode double-invoke creating duplicate entries.
  const deduped = new Map()
  for (const w of relevant) {
    const existing = deduped.get(w.workflowId)
    if (!existing || w.campusKey === campusKey) deduped.set(w.workflowId, w)
  }
  return [...deduped.values()]
}

/**
 * Get a specific workflow definition.
 * Campus-specific workflow takes precedence over 'all' (global).
 *
 * @param {string} workflowId
 * @param {string} campusKey
 * @returns {object | null}
 */
export function getWorkflowDefinition(workflowId, campusKey) {
  const all = loadConfig()
  // Prefer campus-specific over global
  const campusSpecific = all.find(w => w.workflowId === workflowId && w.campusKey === campusKey)
  if (campusSpecific) return campusSpecific
  return all.find(w => w.workflowId === workflowId && w.campusKey === 'all') ?? null
}

/**
 * Save or update a workflow definition.
 * Increments version on every save. Only technical_admin should call this.
 *
 * @param {object} workflowDefinition
 * @returns {object} — the saved definition
 */
export function saveWorkflowDefinition(workflowDefinition) {
  const all = loadConfig()
  const now = new Date().toISOString()
  const idx = all.findIndex(
    w => w.workflowId === workflowDefinition.workflowId &&
         w.campusKey  === workflowDefinition.campusKey
  )

  const updated = {
    ...workflowDefinition,
    version:   (workflowDefinition.version ?? 0) + 1,
    updatedAt: now,
  }

  if (idx >= 0) {
    all[idx] = updated
  } else {
    updated.createdAt = now
    all.push(updated)
  }

  saveConfig(all)
  return updated
}

/**
 * Reset a single workflow to system defaults for a campus.
 * Does NOT affect in-progress records — they keep their original workflow version.
 *
 * @param {string} workflowId
 * @param {string} campusKey
 * @returns {object} — the reset definition
 */
export function resetWorkflow(workflowId, campusKey) {
  const defaultDef = DEFAULT_WORKFLOWS.find(w => w.workflowId === workflowId)
  if (!defaultDef) throw new Error(`No default definition found for workflow "${workflowId}"`)

  const all = loadConfig()
  const now = new Date().toISOString()
  const idx = all.findIndex(
    w => w.workflowId === workflowId && w.campusKey === campusKey
  )

  const reset = {
    ...defaultDef,
    campusKey,
    version:   ((idx >= 0 ? all[idx].version : 0) ?? 0) + 1,
    updatedAt: now,
    resetAt:   now,
  }

  if (idx >= 0) {
    all[idx] = reset
  } else {
    reset.createdAt = now
    all.push(reset)
  }

  saveConfig(all)
  return reset
}

/**
 * Get all audit entries for a specific record.
 * Audit entries are immutable — never updated or deleted.
 *
 * @param {string} recordId
 * @returns {Array}
 */
export function getAuditTrail(recordId) {
  const audit = loadAudit()
  return audit
    .filter(entry => entry.recordId === recordId)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
}

/**
 * Get all audit entries for a campus (for Super Admin audit log view).
 *
 * @param {string} campusKey
 * @returns {Array}
 */
export function getAllAuditEntries(campusKey) {
  const audit = loadAudit()
  return audit.filter(entry => entry.campusKey === campusKey)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
}

/**
 * Append an audit entry. NEVER updates or deletes existing entries.
 * Called by bridge files after executeTransition() returns an auditEntry.
 *
 * @param {object} auditEntry — from workflowEngine.executeTransition()
 */
export function appendAuditEntry(auditEntry) {
  const audit = loadAudit()
  audit.push(auditEntry)
  saveAudit(audit)
}

/**
 * Initialize default workflows for a campus.
 * Only writes workflows that don't already exist — safe to call multiple times.
 * Call when: new instance setup, new campus added, or Super Admin clicks "Reset All to Defaults".
 *
 * @param {string} campusKey
 */
export function initializeDefaults(campusKey) {
  const existing = loadConfig()
  const now = new Date().toISOString()

  DEFAULT_WORKFLOWS.forEach(workflow => {
    const alreadyExists = existing.some(
      w => w.workflowId === workflow.workflowId && w.campusKey === campusKey
    )
    if (!alreadyExists) {
      existing.push({
        ...workflow,
        campusKey,
        version:   1,
        createdAt: now,
        updatedAt: now,
      })
    }
  })

  saveConfig(existing)
}

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT WORKFLOW DEFINITIONS
// Source: docs/default-workflows.md
// Super Admin can edit any of these via Settings → Workflow Config.
// These are the factory defaults used when a school is first set up.
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_WORKFLOWS = [

  // ── WORKFLOW 1: Basic Ed Enrollment ────────────────────────────────────────
  {
    workflowId:  'enrollment_basic_ed',
    label:       'Basic Education Enrollment',
    campusKey:   'all',
    department:  'basicEd',
    version:     1,

    steps: [
      {
        id: 'pre_registered', label: 'Pre-Registered', order: 1, color: 'yellow',
        isInitial: true, isFinal: false,
        description: 'Walk-in or website application received. Awaiting document submission.',
        allowedRoles: ['registrar_basic', 'technical_admin'],
        actions: [
          { id: 'submit_documents', label: 'Submit Documents', icon: 'FileCheck',
            style: 'primary', nextStep: 'documents_submitted', requiresNote: false, notifyTrigger: null },
          { id: 'reject', label: 'Reject Application', icon: 'X',
            style: 'danger', nextStep: 'rejected', requiresNote: true, notifyTrigger: 'enrollment_rejected' },
        ],
        conditions: [],
        fieldPermissions: [
          { field: 'firstName',   access: 'editable', roles: ['registrar_basic', 'technical_admin'] },
          { field: 'lastName',    access: 'editable', roles: ['registrar_basic', 'technical_admin'] },
          { field: 'gradeLevel',  access: 'editable', roles: ['registrar_basic', 'technical_admin'] },
          { field: 'studentType', access: 'editable', roles: ['registrar_basic', 'technical_admin'] },
        ],
        deadlineHours: null, deadlineAction: null,
      },
      {
        id: 'documents_submitted', label: 'Documents Submitted', order: 2, color: 'blue',
        isInitial: false, isFinal: false,
        description: 'Registrar verifies PSA Birth Certificate, Form 138, Good Moral Certificate.',
        allowedRoles: ['registrar_basic', 'technical_admin'],
        actions: [
          { id: 'begin_review', label: 'Begin Review', icon: 'Search',
            style: 'primary', nextStep: 'registrar_review', requiresNote: false, notifyTrigger: null },
          { id: 'return_to_applicant', label: 'Return to Applicant', icon: 'RotateCcw',
            style: 'secondary', nextStep: 'pre_registered', requiresNote: true, notifyTrigger: null },
        ],
        conditions: [
          {
            type: 'block_if', field: 'documents.form138', operator: 'equals', value: false,
            actionId: 'begin_review',
            reason: 'Transferee has not submitted Form 138. Mark as temporarily enrolled or wait for submission.',
          },
        ],
        fieldPermissions: [
          { field: 'documents', access: 'editable', roles: ['registrar_basic', 'technical_admin'] },
        ],
        deadlineHours: null, deadlineAction: null,
      },
      {
        id: 'registrar_review', label: 'Under Registrar Review', order: 3, color: 'blue',
        isInitial: false, isFinal: false,
        description: 'Registrar evaluates application and endorses to Accounting for fee assessment.',
        allowedRoles: ['registrar_basic', 'technical_admin'],
        actions: [
          { id: 'endorse_accounting', label: 'Endorse to Accounting', icon: 'Send',
            style: 'primary', nextStep: 'accounting_assessment', requiresNote: false, notifyTrigger: null },
          { id: 'reject', label: 'Reject', icon: 'X',
            style: 'danger', nextStep: 'rejected', requiresNote: true, notifyTrigger: 'enrollment_rejected' },
        ],
        conditions: [],
        fieldPermissions: [
          { field: 'firstName',    access: 'editable', roles: ['registrar_basic', 'technical_admin'] },
          { field: 'middleName',   access: 'editable', roles: ['registrar_basic', 'technical_admin'] },
          { field: 'lastName',     access: 'editable', roles: ['registrar_basic', 'technical_admin'] },
          { field: 'gradeLevel',   access: 'editable', roles: ['registrar_basic', 'technical_admin'] },
          { field: 'assessedFees', access: 'visible',  roles: ['accounting'] },
        ],
        deadlineHours: 48, deadlineAction: 'notify_admin',
      },
      {
        id: 'accounting_assessment', label: 'For Fee Assessment', order: 4, color: 'orange',
        isInitial: false, isFinal: false,
        description: 'Accounting computes tuition + misc + lab fees, applies discounts and scholarships.',
        allowedRoles: ['accounting', 'technical_admin'],
        actions: [
          { id: 'send_assessment', label: 'Send Assessment', icon: 'Calculator',
            style: 'primary', nextStep: 'for_payment', requiresNote: false, notifyTrigger: null },
        ],
        conditions: [],
        fieldPermissions: [
          { field: 'assessedFees',  access: 'editable', roles: ['accounting', 'technical_admin'] },
          { field: 'discount',      access: 'editable', roles: ['accounting', 'technical_admin'] },
          { field: 'netFee',        access: 'editable', roles: ['accounting', 'technical_admin'] },
          { field: 'scholarship',   access: 'editable', roles: ['accounting', 'technical_admin'] },
          { field: 'firstName',     access: 'visible',  roles: ['accounting'] },
          { field: 'gradeLevel',    access: 'visible',  roles: ['accounting'] },
        ],
        deadlineHours: 24, deadlineAction: 'notify_admin',
      },
      {
        id: 'for_payment', label: 'For Payment', order: 5, color: 'orange',
        isInitial: false, isFinal: false,
        description: 'Student pays assessed fees. Accounting confirms receipt.',
        allowedRoles: ['accounting', 'technical_admin'],
        actions: [
          { id: 'confirm_payment', label: 'Confirm Payment', icon: 'CreditCard',
            style: 'primary', nextStep: 'payment_received', requiresNote: false, notifyTrigger: null },
          { id: 'return_reassessment', label: 'Return for Reassessment', icon: 'RotateCcw',
            style: 'secondary', nextStep: 'accounting_assessment', requiresNote: true, notifyTrigger: null },
        ],
        conditions: [
          // Full scholarship — skip payment step entirely
          { type: 'skip_if', field: 'netFee', operator: 'equals', value: 0 },
        ],
        fieldPermissions: [
          { field: 'amountPaid',       access: 'editable', roles: ['accounting', 'technical_admin'] },
          { field: 'paymentMethod',    access: 'editable', roles: ['accounting', 'technical_admin'] },
          { field: 'paymentReference', access: 'editable', roles: ['accounting', 'technical_admin'] },
        ],
        deadlineHours: null, deadlineAction: null,
      },
      {
        id: 'payment_received', label: 'Payment Received', order: 6, color: 'indigo',
        isInitial: false, isFinal: false,
        description: 'Principal reviews and approves enrollment after payment is confirmed.',
        allowedRoles: ['principal_basic', 'technical_admin'],
        actions: [
          { id: 'approve_enrollment', label: 'Approve Enrollment', icon: 'CheckCircle',
            style: 'primary', nextStep: 'section_assignment', requiresNote: false,
            notifyTrigger: 'enrollment_approved' },
          { id: 'reject', label: 'Reject', icon: 'X',
            style: 'danger', nextStep: 'rejected', requiresNote: true, notifyTrigger: 'enrollment_rejected' },
        ],
        conditions: [],
        fieldPermissions: [
          { field: 'amountPaid',    access: 'visible', roles: ['principal_basic'] },
          { field: 'netFee',        access: 'visible', roles: ['principal_basic'] },
          { field: 'gradeLevel',    access: 'visible', roles: ['principal_basic'] },
        ],
        deadlineHours: 24, deadlineAction: 'notify_admin',
      },
      {
        id: 'section_assignment', label: 'For Section Assignment', order: 7, color: 'purple',
        isInitial: false, isFinal: false,
        description: 'Principal or Registrar assigns student to a section. Class adviser is auto-notified.',
        allowedRoles: ['principal_basic', 'registrar_basic', 'technical_admin'],
        actions: [
          { id: 'assign_section', label: 'Assign Section & Finalize', icon: 'Users',
            style: 'primary', nextStep: 'officially_enrolled', requiresNote: false,
            notifyTrigger: 'enrollment_finalized' },
        ],
        conditions: [],
        fieldPermissions: [
          { field: 'sectionId',   access: 'editable', roles: ['principal_basic', 'registrar_basic', 'technical_admin'] },
          { field: 'section',     access: 'editable', roles: ['principal_basic', 'registrar_basic', 'technical_admin'] },
          { field: 'gradeLevel',  access: 'editable', roles: ['principal_basic', 'registrar_basic', 'technical_admin'] },
        ],
        deadlineHours: null, deadlineAction: null,
      },
      {
        id: 'officially_enrolled', label: 'Officially Enrolled ✓', order: 8, color: 'green',
        isInitial: false, isFinal: true,
        description: 'Student is fully enrolled. Student record is created automatically.',
        allowedRoles: [],
        actions: [],
        conditions: [],
        fieldPermissions: [],
        deadlineHours: null, deadlineAction: null,
        notifyTrigger: 'enrollment_finalized',
      },
      {
        id: 'rejected', label: 'Rejected ✗', order: null, color: 'red',
        isInitial: false, isFinal: true,
        description: 'Application was rejected.',
        allowedRoles: [],
        actions: [],
        conditions: [],
        fieldPermissions: [],
        deadlineHours: null, deadlineAction: null,
        notifyTrigger: 'enrollment_rejected',
      },
    ],

    permissions: {
      canView:   ['registrar_basic', 'principal_basic', 'accounting', 'admin', 'technical_admin'],
      canCreate: ['registrar_basic', 'technical_admin'],
      canExport: ['registrar_basic', 'principal_basic', 'admin', 'technical_admin'],
      canDelete: ['technical_admin'],
    },
    audit: { logAllActions: true, retentionDays: 3650 },
  },

  // ── WORKFLOW 2: College Enrollment ─────────────────────────────────────────
  {
    workflowId:  'enrollment_college',
    label:       'College Enrollment',
    campusKey:   'all',
    department:  'college',
    version:     1,

    steps: [
      {
        id: 'applied', label: 'Application Submitted', order: 1, color: 'yellow',
        isInitial: true, isFinal: false,
        description: 'College application submitted. Awaiting document submission.',
        allowedRoles: ['registrar_college', 'technical_admin'],
        actions: [
          { id: 'submit_documents', label: 'Submit Documents', icon: 'FileCheck',
            style: 'primary', nextStep: 'documents_submitted', requiresNote: false, notifyTrigger: null },
          { id: 'reject', label: 'Reject', icon: 'X',
            style: 'danger', nextStep: 'rejected', requiresNote: true, notifyTrigger: 'enrollment_rejected' },
        ],
        conditions: [], fieldPermissions: [],
        deadlineHours: null, deadlineAction: null,
      },
      {
        id: 'documents_submitted', label: 'Documents Submitted', order: 2, color: 'blue',
        isInitial: false, isFinal: false,
        description: 'Documents received. Registrar evaluates credentials.',
        allowedRoles: ['registrar_college', 'technical_admin'],
        actions: [
          { id: 'begin_evaluation', label: 'Begin Evaluation', icon: 'Search',
            style: 'primary', nextStep: 'registrar_evaluation', requiresNote: false, notifyTrigger: null },
        ],
        conditions: [], fieldPermissions: [],
        deadlineHours: null, deadlineAction: null,
      },
      {
        id: 'registrar_evaluation', label: 'Under Registrar Evaluation', order: 3, color: 'blue',
        isInitial: false, isFinal: false,
        description: 'Registrar evaluates transfer credits, computes curriculum standing.',
        allowedRoles: ['registrar_college', 'technical_admin'],
        actions: [
          { id: 'proceed_exam', label: 'Proceed to Entrance Exam', icon: 'ClipboardList',
            style: 'primary', nextStep: 'entrance_exam', requiresNote: false, notifyTrigger: null },
          { id: 'reject', label: 'Reject', icon: 'X',
            style: 'danger', nextStep: 'rejected', requiresNote: true, notifyTrigger: 'enrollment_rejected' },
        ],
        conditions: [], fieldPermissions: [],
        deadlineHours: 48, deadlineAction: 'notify_admin',
      },
      {
        id: 'entrance_exam', label: 'For Entrance Examination', order: 4, color: 'purple',
        isInitial: false, isFinal: false,
        description: 'Student takes entrance examination. Some programs or returning students may skip.',
        allowedRoles: ['registrar_college', 'technical_admin'],
        actions: [
          { id: 'pass_exam', label: 'Passed — Proceed', icon: 'Check',
            style: 'primary', nextStep: 'course_advising', requiresNote: false, notifyTrigger: null },
          { id: 'reject', label: 'Failed Exam — Reject', icon: 'X',
            style: 'danger', nextStep: 'rejected', requiresNote: true, notifyTrigger: 'enrollment_rejected' },
        ],
        conditions: [
          { type: 'skip_if', field: 'requiresEntranceExam', operator: 'equals', value: false },
          { type: 'skip_if', field: 'studentType', operator: 'equals', value: 'Returnee' },
        ],
        fieldPermissions: [],
        deadlineHours: null, deadlineAction: null,
      },
      {
        id: 'course_advising', label: 'For Course Advising', order: 5, color: 'teal',
        isInitial: false, isFinal: false,
        description: 'Program Head evaluates curriculum standing and recommends subject load.',
        allowedRoles: ['program_head', 'technical_admin'],
        actions: [
          { id: 'proceed_enlistment', label: 'Proceed to Subject Enlistment', icon: 'BookOpen',
            style: 'primary', nextStep: 'subject_enlistment', requiresNote: false, notifyTrigger: null },
        ],
        conditions: [], fieldPermissions: [],
        deadlineHours: 48, deadlineAction: 'notify_admin',
      },
      {
        id: 'subject_enlistment', label: 'Subject Enlistment', order: 6, color: 'teal',
        isInitial: false, isFinal: false,
        description: 'Student enlists subjects. Program Head validates unit load.',
        allowedRoles: ['program_head', 'registrar_college', 'technical_admin'],
        actions: [
          { id: 'validate_units', label: 'Validate Unit Load', icon: 'CheckCircle',
            style: 'primary', nextStep: 'scholarship_notation', requiresNote: false, notifyTrigger: null },
          { id: 'return_advising', label: 'Return for Re-enlistment', icon: 'RotateCcw',
            style: 'secondary', nextStep: 'course_advising', requiresNote: true, notifyTrigger: null },
        ],
        conditions: [
          { type: 'block_if', field: 'totalUnits', operator: 'less_than', value: 1,
            reason: 'Student has not enlisted any subjects yet.' },
        ],
        fieldPermissions: [
          { field: 'enlistedSubjects', access: 'editable', roles: ['program_head', 'registrar_college', 'technical_admin'] },
          { field: 'totalUnits',       access: 'editable', roles: ['program_head', 'registrar_college', 'technical_admin'] },
        ],
        deadlineHours: null, deadlineAction: null,
      },
      {
        id: 'scholarship_notation', label: 'Scholarship Notation', order: 7, color: 'indigo',
        isInitial: false, isFinal: false,
        description: 'Registrar or OSA validates scholarship entitlement for Accounting.',
        allowedRoles: ['registrar_college', 'accounting', 'technical_admin'],
        actions: [
          { id: 'proceed_assessment', label: 'Proceed to Fee Assessment', icon: 'ArrowRight',
            style: 'primary', nextStep: 'accounting_assessment', requiresNote: false, notifyTrigger: null },
        ],
        conditions: [
          { type: 'skip_if', field: 'scholarship', operator: 'is_empty', value: null },
        ],
        fieldPermissions: [
          { field: 'scholarship', access: 'editable', roles: ['registrar_college', 'accounting', 'technical_admin'] },
        ],
        deadlineHours: null, deadlineAction: null,
      },
      {
        id: 'accounting_assessment', label: 'For Fee Assessment', order: 8, color: 'orange',
        isInitial: false, isFinal: false,
        description: 'Accounting computes fees based on unit load, applies discounts and scholarship deductions.',
        allowedRoles: ['accounting', 'technical_admin'],
        actions: [
          { id: 'send_assessment', label: 'Send Assessment', icon: 'Calculator',
            style: 'primary', nextStep: 'for_payment', requiresNote: false, notifyTrigger: null },
        ],
        conditions: [],
        fieldPermissions: [
          { field: 'assessedFees', access: 'editable', roles: ['accounting', 'technical_admin'] },
          { field: 'discount',     access: 'editable', roles: ['accounting', 'technical_admin'] },
          { field: 'netFee',       access: 'editable', roles: ['accounting', 'technical_admin'] },
        ],
        deadlineHours: 24, deadlineAction: 'notify_admin',
      },
      {
        id: 'for_payment', label: 'For Payment', order: 9, color: 'orange',
        isInitial: false, isFinal: false,
        description: 'Student pays assessed fees.',
        allowedRoles: ['accounting', 'technical_admin'],
        actions: [
          { id: 'confirm_payment', label: 'Confirm Payment', icon: 'CreditCard',
            style: 'primary', nextStep: 'payment_received', requiresNote: false, notifyTrigger: null },
          { id: 'return_reassessment', label: 'Return for Reassessment', icon: 'RotateCcw',
            style: 'secondary', nextStep: 'accounting_assessment', requiresNote: true, notifyTrigger: null },
        ],
        conditions: [
          { type: 'skip_if', field: 'netFee', operator: 'equals', value: 0 },
        ],
        fieldPermissions: [
          { field: 'amountPaid',       access: 'editable', roles: ['accounting', 'technical_admin'] },
          { field: 'paymentMethod',    access: 'editable', roles: ['accounting', 'technical_admin'] },
          { field: 'paymentReference', access: 'editable', roles: ['accounting', 'technical_admin'] },
        ],
        deadlineHours: null, deadlineAction: null,
      },
      {
        id: 'payment_received', label: 'Payment Received', order: 10, color: 'indigo',
        isInitial: false, isFinal: false,
        description: 'Registrar confirms enrollment after payment is verified.',
        allowedRoles: ['registrar_college', 'technical_admin'],
        actions: [
          { id: 'confirm_enrollment', label: 'Confirm Enrollment', icon: 'CheckCircle',
            style: 'primary', nextStep: 'medical_clearance', requiresNote: false,
            notifyTrigger: 'enrollment_approved' },
        ],
        conditions: [], fieldPermissions: [],
        deadlineHours: 24, deadlineAction: 'notify_admin',
      },
      {
        id: 'medical_clearance', label: 'Medical Clearance', order: 11, color: 'teal',
        isInitial: false, isFinal: false,
        description: 'School clinic issues medical certificate. Configurable — may be skipped.',
        allowedRoles: ['registrar_college', 'technical_admin'],
        actions: [
          { id: 'cleared', label: 'Medical Cleared', icon: 'Heart',
            style: 'primary', nextStep: 'id_processing', requiresNote: false, notifyTrigger: null },
        ],
        conditions: [
          { type: 'skip_if', field: 'requiresMedicalClearance', operator: 'equals', value: false },
        ],
        fieldPermissions: [],
        deadlineHours: null, deadlineAction: null,
      },
      {
        id: 'id_processing', label: 'ID Processing', order: 12, color: 'teal',
        isInitial: false, isFinal: false,
        description: 'OSA processes student ID. Returning students with existing IDs skip this.',
        allowedRoles: ['registrar_college', 'technical_admin'],
        actions: [
          { id: 'id_done', label: 'ID Processed — Finalize', icon: 'CreditCard',
            style: 'primary', nextStep: 'officially_enrolled', requiresNote: false,
            notifyTrigger: 'enrollment_finalized' },
        ],
        conditions: [
          { type: 'skip_if', field: 'hasExistingId', operator: 'equals', value: true },
        ],
        fieldPermissions: [],
        deadlineHours: null, deadlineAction: null,
      },
      {
        id: 'officially_enrolled', label: 'Officially Enrolled ✓', order: 13, color: 'green',
        isInitial: false, isFinal: true,
        description: 'College student is officially enrolled. COR is auto-generated.',
        allowedRoles: [], actions: [], conditions: [], fieldPermissions: [],
        deadlineHours: null, deadlineAction: null,
        notifyTrigger: 'enrollment_finalized',
      },
      {
        id: 'rejected', label: 'Rejected ✗', order: null, color: 'red',
        isInitial: false, isFinal: true,
        description: 'Application was rejected.',
        allowedRoles: [], actions: [], conditions: [], fieldPermissions: [],
        deadlineHours: null, deadlineAction: null,
        notifyTrigger: 'enrollment_rejected',
      },
    ],

    permissions: {
      canView:   ['registrar_college', 'program_head', 'accounting', 'admin', 'technical_admin'],
      canCreate: ['registrar_college', 'technical_admin'],
      canExport: ['registrar_college', 'program_head', 'admin', 'technical_admin'],
      canDelete: ['technical_admin'],
    },
    audit: { logAllActions: true, retentionDays: 3650 },
  },

  // ── WORKFLOW 3: Basic Ed Grade Submission ──────────────────────────────────
  {
    workflowId:  'grade_submission_basic',
    label:       'Basic Ed Grade Submission',
    campusKey:   'all',
    department:  'basicEd',
    version:     1,

    steps: [
      {
        id: 'encoding', label: 'Grade Encoding', order: 1, color: 'gray',
        isInitial: true, isFinal: false,
        description: 'Teacher encodes WW, PT, and QA scores. Grades computed in real time.',
        allowedRoles: ['teacher', 'technical_admin'],
        actions: [
          { id: 'submit', label: 'Submit Grades', icon: 'Send',
            style: 'primary', nextStep: 'submitted', requiresNote: false, notifyTrigger: null },
        ],
        conditions: [],
        fieldPermissions: [
          { field: 'wwScores', access: 'editable', roles: ['teacher', 'technical_admin'] },
          { field: 'ptScores', access: 'editable', roles: ['teacher', 'technical_admin'] },
          { field: 'qaScores', access: 'editable', roles: ['teacher', 'technical_admin'] },
        ],
        deadlineHours: null, deadlineAction: null,
      },
      {
        id: 'submitted', label: 'Submitted to Registrar', order: 2, color: 'blue',
        isInitial: false, isFinal: false,
        description: 'Registrar checks for missing grades, impossible values, or errors.',
        allowedRoles: ['registrar_basic', 'technical_admin'],
        actions: [
          { id: 'verify', label: 'Verify', icon: 'CheckCircle',
            style: 'primary', nextStep: 'registrar_verified', requiresNote: false, notifyTrigger: null },
          { id: 'return_correction', label: 'Return for Correction', icon: 'RotateCcw',
            style: 'secondary', nextStep: 'encoding', requiresNote: true,
            notifyTrigger: 'grades_returned_for_correction' },
        ],
        conditions: [], fieldPermissions: [],
        deadlineHours: 48, deadlineAction: 'notify_admin',
      },
      {
        id: 'registrar_verified', label: 'Verified by Registrar', order: 3, color: 'indigo',
        isInitial: false, isFinal: false,
        description: 'Principal reviews and approves the verified grades.',
        allowedRoles: ['principal_basic', 'technical_admin'],
        actions: [
          { id: 'approve', label: 'Approve', icon: 'Check',
            style: 'primary', nextStep: 'approved', requiresNote: false,
            notifyTrigger: 'grades_released' },
          { id: 'return_correction', label: 'Return for Correction', icon: 'RotateCcw',
            style: 'secondary', nextStep: 'encoding', requiresNote: true,
            notifyTrigger: 'grades_returned_for_correction' },
        ],
        conditions: [], fieldPermissions: [],
        deadlineHours: 48, deadlineAction: 'notify_admin',
      },
      {
        id: 'approved', label: 'Approved ✓', order: 4, color: 'green',
        isInitial: false, isFinal: true,
        description: 'Grades approved and locked. Changes require a Grade Change Request.',
        allowedRoles: [], actions: [], conditions: [], fieldPermissions: [],
        deadlineHours: null, deadlineAction: null,
        notifyTrigger: 'grades_released',
      },
      {
        id: 'returned', label: 'Returned for Correction', order: null, color: 'red',
        isInitial: false, isFinal: false,
        description: 'Returned to teacher for correction.',
        allowedRoles: ['teacher', 'technical_admin'],
        actions: [
          { id: 'resubmit', label: 'Resubmit After Correction', icon: 'RefreshCw',
            style: 'primary', nextStep: 'submitted', requiresNote: false, notifyTrigger: null },
        ],
        conditions: [], fieldPermissions: [],
        deadlineHours: 24, deadlineAction: 'notify_admin',
      },
    ],

    permissions: {
      canView:   ['teacher', 'registrar_basic', 'principal_basic', 'admin', 'technical_admin'],
      canCreate: ['teacher', 'technical_admin'],
      canExport: ['registrar_basic', 'principal_basic', 'admin', 'technical_admin'],
      canDelete: ['technical_admin'],
    },
    audit: { logAllActions: true, retentionDays: 3650 },
  },

  // ── WORKFLOW 4: College Grade Submission ───────────────────────────────────
  {
    workflowId:  'grade_submission_college',
    label:       'College Grade Submission',
    campusKey:   'all',
    department:  'college',
    version:     1,

    steps: [
      {
        id: 'encoding', label: 'Grade Encoding', order: 1, color: 'gray',
        isInitial: true, isFinal: false,
        description: 'Instructor encodes Prelim, Midterm, Finals. Point grade computed in real time.',
        allowedRoles: ['teacher', 'technical_admin'],
        actions: [
          { id: 'submit', label: 'Submit Grades', icon: 'Send',
            style: 'primary', nextStep: 'submitted', requiresNote: false, notifyTrigger: null },
        ],
        conditions: [],
        fieldPermissions: [
          { field: 'prelimScore',  access: 'editable', roles: ['teacher', 'technical_admin'] },
          { field: 'midtermScore', access: 'editable', roles: ['teacher', 'technical_admin'] },
          { field: 'finalsScore',  access: 'editable', roles: ['teacher', 'technical_admin'] },
          { field: 'specialGrade', access: 'editable', roles: ['teacher', 'technical_admin'] },
        ],
        deadlineHours: null, deadlineAction: null,
      },
      {
        id: 'submitted', label: 'Submitted', order: 2, color: 'blue',
        isInitial: false, isFinal: false,
        description: 'Submitted to Program Head for review.',
        allowedRoles: ['program_head', 'technical_admin'],
        actions: [
          { id: 'begin_review', label: 'Begin Review', icon: 'Search',
            style: 'primary', nextStep: 'program_head_review', requiresNote: false, notifyTrigger: null },
        ],
        conditions: [], fieldPermissions: [],
        deadlineHours: 48, deadlineAction: 'notify_admin',
      },
      {
        id: 'program_head_review', label: 'Program Head Review', order: 3, color: 'indigo',
        isInitial: false, isFinal: false,
        description: 'Program Head reviews grades and endorses to Registrar for posting.',
        allowedRoles: ['program_head', 'technical_admin'],
        actions: [
          { id: 'endorse_registrar', label: 'Endorse to Registrar', icon: 'Send',
            style: 'primary', nextStep: 'registrar_posted', requiresNote: false, notifyTrigger: null },
          { id: 'return', label: 'Return', icon: 'RotateCcw',
            style: 'secondary', nextStep: 'encoding', requiresNote: true,
            notifyTrigger: 'grades_returned_for_correction' },
        ],
        conditions: [], fieldPermissions: [],
        deadlineHours: 48, deadlineAction: 'notify_admin',
      },
      {
        id: 'registrar_posted', label: 'Posted by Registrar ✓', order: 4, color: 'green',
        isInitial: false, isFinal: true,
        description: 'Grades officially posted. INC deadline timer starts from this date.',
        allowedRoles: [], actions: [], conditions: [], fieldPermissions: [],
        deadlineHours: null, deadlineAction: null,
        notifyTrigger: 'grades_released',
      },
      {
        id: 'returned', label: 'Returned for Correction', order: null, color: 'red',
        isInitial: false, isFinal: false,
        description: 'Returned to instructor for correction.',
        allowedRoles: ['teacher', 'technical_admin'],
        actions: [
          { id: 'resubmit', label: 'Resubmit After Correction', icon: 'RefreshCw',
            style: 'primary', nextStep: 'submitted', requiresNote: false, notifyTrigger: null },
        ],
        conditions: [], fieldPermissions: [],
        deadlineHours: 24, deadlineAction: 'notify_admin',
      },
    ],

    permissions: {
      canView:   ['teacher', 'program_head', 'registrar_college', 'admin', 'technical_admin'],
      canCreate: ['teacher', 'technical_admin'],
      canExport: ['registrar_college', 'program_head', 'admin', 'technical_admin'],
      canDelete: ['technical_admin'],
    },
    audit: { logAllActions: true, retentionDays: 3650 },
  },

  // ── WORKFLOW 5: Grade Change Request ───────────────────────────────────────
  {
    workflowId:  'grade_change_request',
    label:       'Grade Change Request',
    campusKey:   'all',
    department:  'all',
    version:     1,

    steps: [
      {
        id: 'requested', label: 'Change Requested', order: 1, color: 'yellow',
        isInitial: true, isFinal: false,
        description: 'Teacher identifies error and submits a grade change request with full justification.',
        allowedRoles: ['teacher', 'technical_admin'],
        actions: [
          { id: 'submit_request', label: 'Submit Request', icon: 'Send',
            style: 'primary', nextStep: 'principal_review', requiresNote: true, notifyTrigger: null },
        ],
        conditions: [
          { type: 'block_if', field: 'grade.status', operator: 'not_equals', value: 'approved',
            reason: 'Grade change requests can only be filed for approved grades.' },
        ],
        fieldPermissions: [
          { field: 'oldGrade',  access: 'editable', roles: ['teacher', 'technical_admin'] },
          { field: 'newGrade',  access: 'editable', roles: ['teacher', 'technical_admin'] },
          { field: 'reason',    access: 'editable', roles: ['teacher', 'technical_admin'] },
        ],
        deadlineHours: null, deadlineAction: null,
      },
      {
        id: 'principal_review', label: 'Under Review', order: 2, color: 'blue',
        isInitial: false, isFinal: false,
        description: 'Principal or Program Head reviews the grade change request.',
        allowedRoles: ['principal_basic', 'program_head', 'technical_admin'],
        actions: [
          { id: 'approve_request', label: 'Approve — Send to Registrar', icon: 'CheckCircle',
            style: 'primary', nextStep: 'registrar_correction', requiresNote: false, notifyTrigger: null },
          { id: 'reject', label: 'Reject Request', icon: 'X',
            style: 'danger', nextStep: 'rejected', requiresNote: true,
            notifyTrigger: 'grade_change_rejected' },
        ],
        conditions: [], fieldPermissions: [],
        deadlineHours: 48, deadlineAction: 'notify_admin',
      },
      {
        id: 'registrar_correction', label: 'For Registrar Correction', order: 3, color: 'indigo',
        isInitial: false, isFinal: false,
        description: 'Registrar posts the corrected grade and logs the immutable audit entry.',
        allowedRoles: ['registrar_basic', 'registrar_college', 'technical_admin'],
        actions: [
          { id: 'post_correction', label: 'Post Corrected Grade', icon: 'Check',
            style: 'primary', nextStep: 'approved', requiresNote: false,
            notifyTrigger: 'grade_changed' },
        ],
        conditions: [], fieldPermissions: [],
        deadlineHours: 24, deadlineAction: 'notify_admin',
      },
      {
        id: 'approved', label: 'Approved & Posted ✓', order: 4, color: 'green',
        isInitial: false, isFinal: true,
        description: 'Grade correction is officially posted. Audit trail entry is permanent.',
        allowedRoles: [], actions: [], conditions: [], fieldPermissions: [],
        deadlineHours: null, deadlineAction: null,
        notifyTrigger: 'grade_changed',
      },
      {
        id: 'rejected', label: 'Rejected ✗', order: null, color: 'red',
        isInitial: false, isFinal: true,
        description: 'Grade change request was rejected. Original grade stands.',
        allowedRoles: [], actions: [], conditions: [], fieldPermissions: [],
        deadlineHours: null, deadlineAction: null,
        notifyTrigger: 'grade_change_rejected',
      },
    ],

    permissions: {
      canView:   ['teacher', 'principal_basic', 'program_head', 'registrar_basic', 'registrar_college', 'admin', 'technical_admin'],
      canCreate: ['teacher', 'technical_admin'],
      canExport: ['registrar_basic', 'registrar_college', 'admin', 'technical_admin'],
      canDelete: ['technical_admin'],
    },
    audit: { logAllActions: true, retentionDays: 3650 },
  },

  // ── WORKFLOW 6: INC Grade Completion ───────────────────────────────────────
  {
    workflowId:  'inc_completion',
    label:       'INC Grade Completion',
    campusKey:   'all',
    department:  'college',
    version:     1,

    steps: [
      {
        id: 'inc_recorded', label: 'INC Recorded', order: 1, color: 'yellow',
        isInitial: true, isFinal: false,
        description: 'INC recorded automatically when teacher marks grade as INC during grade submission.',
        allowedRoles: ['teacher', 'technical_admin'],
        actions: [
          { id: 'open_completion', label: 'Open Completion Period', icon: 'Calendar',
            style: 'primary', nextStep: 'completion_open', requiresNote: false, notifyTrigger: 'inc_recorded' },
        ],
        conditions: [], fieldPermissions: [],
        deadlineHours: null, deadlineAction: null,
      },
      {
        id: 'completion_open', label: 'Completion Period Open', order: 2, color: 'blue',
        isInitial: false, isFinal: false,
        description: 'Student submits completion requirements within the deadline.',
        allowedRoles: ['teacher', 'technical_admin'],
        actions: [
          { id: 'requirements_received', label: 'Requirements Received', icon: 'FileCheck',
            style: 'primary', nextStep: 'requirements_submitted', requiresNote: false, notifyTrigger: null },
        ],
        conditions: [], fieldPermissions: [],
        deadlineHours: null, deadlineAction: null,
      },
      {
        id: 'requirements_submitted', label: 'Requirements Submitted', order: 3, color: 'indigo',
        isInitial: false, isFinal: false,
        description: 'Teacher evaluates submitted completion requirements.',
        allowedRoles: ['teacher', 'technical_admin'],
        actions: [
          { id: 'evaluate', label: 'Evaluate Requirements', icon: 'ClipboardCheck',
            style: 'primary', nextStep: 'teacher_evaluated', requiresNote: false, notifyTrigger: null },
        ],
        conditions: [], fieldPermissions: [],
        deadlineHours: null, deadlineAction: null,
      },
      {
        id: 'teacher_evaluated', label: 'Teacher Evaluated', order: 4, color: 'purple',
        isInitial: false, isFinal: false,
        description: 'Teacher submits final completion grade to Registrar for posting.',
        allowedRoles: ['teacher', 'technical_admin'],
        actions: [
          { id: 'submit_grade', label: 'Submit Final Grade', icon: 'Send',
            style: 'primary', nextStep: 'registrar_posted', requiresNote: false, notifyTrigger: null },
        ],
        conditions: [],
        fieldPermissions: [
          { field: 'completionGrade', access: 'editable', roles: ['teacher', 'technical_admin'] },
        ],
        deadlineHours: null, deadlineAction: null,
      },
      {
        id: 'registrar_posted', label: 'Final Grade Posted ✓', order: 5, color: 'green',
        isInitial: false, isFinal: true,
        description: 'Completion grade officially posted. INC resolved.',
        allowedRoles: [], actions: [], conditions: [], fieldPermissions: [],
        deadlineHours: null, deadlineAction: null,
        notifyTrigger: 'inc_completed',
      },
      {
        id: 'auto_failed', label: 'Auto-Failed (5.00) ✗', order: null, color: 'red',
        isInitial: false, isFinal: true,
        description: 'INC deadline passed without completion. Grade automatically set to 5.00.',
        allowedRoles: [], actions: [], conditions: [], fieldPermissions: [],
        deadlineHours: null, deadlineAction: null,
        notifyTrigger: 'inc_auto_failed',
      },
    ],

    permissions: {
      canView:   ['teacher', 'program_head', 'registrar_college', 'admin', 'technical_admin'],
      canCreate: ['teacher', 'technical_admin'],
      canExport: ['registrar_college', 'admin', 'technical_admin'],
      canDelete: ['technical_admin'],
    },
    audit: { logAllActions: true, retentionDays: 3650 },
  },

  // ── WORKFLOW 7: Document Request ───────────────────────────────────────────
  {
    workflowId:  'document_request',
    label:       'Document Request',
    campusKey:   'all',
    department:  'all',
    version:     1,

    steps: [
      {
        id: 'requested', label: 'Request Submitted', order: 1, color: 'yellow',
        isInitial: true, isFinal: false,
        description: 'Document request received from student, parent, or admin.',
        allowedRoles: ['registrar_basic', 'registrar_college', 'technical_admin'],
        actions: [
          { id: 'start_processing', label: 'Start Processing', icon: 'Play',
            style: 'primary', nextStep: 'processing', requiresNote: false, notifyTrigger: null },
          { id: 'cancel', label: 'Cancel Request', icon: 'X',
            style: 'danger', nextStep: 'cancelled', requiresNote: true, notifyTrigger: null },
        ],
        conditions: [], fieldPermissions: [],
        deadlineHours: null, deadlineAction: null,
      },
      {
        id: 'processing', label: 'Being Processed', order: 2, color: 'blue',
        isInitial: false, isFinal: false,
        description: 'Registrar is preparing the document.',
        allowedRoles: ['registrar_basic', 'registrar_college', 'technical_admin'],
        actions: [
          { id: 'require_payment', label: 'Require Payment', icon: 'CreditCard',
            style: 'secondary', nextStep: 'for_payment', requiresNote: false, notifyTrigger: null },
          { id: 'mark_ready', label: 'Mark as Ready for Pickup', icon: 'Package',
            style: 'primary', nextStep: 'ready_for_pickup', requiresNote: false, notifyTrigger: 'document_ready' },
          { id: 'cancel', label: 'Cancel', icon: 'X',
            style: 'danger', nextStep: 'cancelled', requiresNote: true, notifyTrigger: null },
        ],
        conditions: [], fieldPermissions: [],
        deadlineHours: null, deadlineAction: null,
      },
      {
        id: 'for_payment', label: 'For Payment', order: 3, color: 'orange',
        isInitial: false, isFinal: false,
        description: 'Processing fee required. Accounting confirms payment.',
        allowedRoles: ['accounting', 'technical_admin'],
        actions: [
          { id: 'confirm_payment', label: 'Confirm Payment', icon: 'CheckCircle',
            style: 'primary', nextStep: 'ready_for_pickup', requiresNote: false, notifyTrigger: 'document_ready' },
        ],
        conditions: [
          { type: 'skip_if', field: 'fee', operator: 'equals', value: 0 },
        ],
        fieldPermissions: [],
        deadlineHours: null, deadlineAction: null,
      },
      {
        id: 'ready_for_pickup', label: 'Ready for Pickup', order: 4, color: 'indigo',
        isInitial: false, isFinal: false,
        description: 'Document prepared and ready. Clearance required for certain documents.',
        allowedRoles: ['registrar_basic', 'registrar_college', 'technical_admin'],
        actions: [
          { id: 'release', label: 'Release Document', icon: 'CheckCircle',
            style: 'primary', nextStep: 'released', requiresNote: false, notifyTrigger: null },
        ],
        conditions: [
          { type: 'block_if', field: 'requiresClearance', operator: 'equals', value: true,
            actionId: 'release',
            reason: 'This document requires a completed student clearance before release.' },
        ],
        fieldPermissions: [
          { field: 'releasedTo', access: 'editable', roles: ['registrar_basic', 'registrar_college', 'technical_admin'] },
          { field: 'claimDate',  access: 'editable', roles: ['registrar_basic', 'registrar_college', 'technical_admin'] },
        ],
        deadlineHours: null, deadlineAction: null,
      },
      {
        id: 'released', label: 'Released ✓', order: 5, color: 'green',
        isInitial: false, isFinal: true,
        description: 'Document has been released to student or authorized representative.',
        allowedRoles: [], actions: [], conditions: [], fieldPermissions: [],
        deadlineHours: null, deadlineAction: null,
        notifyTrigger: 'document_released',
      },
      {
        id: 'cancelled', label: 'Cancelled ✗', order: null, color: 'gray',
        isInitial: false, isFinal: true,
        description: 'Request was cancelled.',
        allowedRoles: [], actions: [], conditions: [], fieldPermissions: [],
        deadlineHours: null, deadlineAction: null,
      },
    ],

    permissions: {
      canView:   ['registrar_basic', 'registrar_college', 'accounting', 'admin', 'technical_admin'],
      canCreate: ['registrar_basic', 'registrar_college', 'technical_admin'],
      canExport: ['registrar_basic', 'registrar_college', 'admin', 'technical_admin'],
      canDelete: ['technical_admin'],
    },
    audit: { logAllActions: true, retentionDays: 3650 },
  },

  // ── WORKFLOW 8: Student Clearance ──────────────────────────────────────────
  {
    workflowId:  'student_clearance',
    label:       'Student Clearance',
    campusKey:   'all',
    department:  'all',
    version:     1,

    steps: [
      {
        id: 'initiated', label: 'Clearance Initiated', order: 1, color: 'yellow',
        isInitial: true, isFinal: false,
        description: 'Clearance process initiated. Each department will sign off separately.',
        allowedRoles: ['registrar_basic', 'registrar_college', 'technical_admin'],
        actions: [
          { id: 'proceed_library', label: 'Proceed to Library Clearance', icon: 'ArrowRight',
            style: 'primary', nextStep: 'library', requiresNote: false, notifyTrigger: null },
        ],
        conditions: [], fieldPermissions: [],
        deadlineHours: null, deadlineAction: null,
      },
      {
        id: 'library', label: 'Library Clearance', order: 2, color: 'blue',
        isInitial: false, isFinal: false,
        description: 'Library verifies no unreturned books or fines.',
        allowedRoles: ['registrar_basic', 'registrar_college', 'technical_admin'],
        actions: [
          { id: 'library_cleared', label: 'Library Cleared', icon: 'Check',
            style: 'primary', nextStep: 'accounting', requiresNote: false, notifyTrigger: null },
        ],
        conditions: [], fieldPermissions: [],
        deadlineHours: null, deadlineAction: null,
      },
      {
        id: 'accounting', label: 'Accounting Clearance', order: 3, color: 'orange',
        isInitial: false, isFinal: false,
        description: 'Auto-blocked if student has unpaid balance. Clears automatically when balance is zero.',
        allowedRoles: ['accounting', 'technical_admin'],
        actions: [
          { id: 'accounting_cleared', label: 'Accounting Cleared', icon: 'Check',
            style: 'primary', nextStep: 'registrar', requiresNote: false, notifyTrigger: null },
        ],
        conditions: [
          { type: 'block_if', field: 'paymentBalance', operator: 'greater_than', value: 0,
            reason: 'Student has an outstanding balance. Balance must be settled before accounting clearance.' },
        ],
        fieldPermissions: [],
        deadlineHours: null, deadlineAction: null,
      },
      {
        id: 'registrar', label: 'Registrar Clearance', order: 4, color: 'indigo',
        isInitial: false, isFinal: false,
        description: 'Registrar verifies all academic records are complete and in order.',
        allowedRoles: ['registrar_basic', 'registrar_college', 'technical_admin'],
        actions: [
          { id: 'registrar_cleared', label: 'Registrar Cleared', icon: 'Check',
            style: 'primary', nextStep: 'guidance', requiresNote: false, notifyTrigger: null },
        ],
        conditions: [], fieldPermissions: [],
        deadlineHours: null, deadlineAction: null,
      },
      {
        id: 'guidance', label: 'Guidance Clearance', order: 5, color: 'teal',
        isInitial: false, isFinal: false,
        description: 'Guidance counselor signs off.',
        allowedRoles: ['registrar_basic', 'registrar_college', 'technical_admin'],
        actions: [
          { id: 'guidance_cleared', label: 'Guidance Cleared', icon: 'Check',
            style: 'primary', nextStep: 'admin_office', requiresNote: false, notifyTrigger: null },
        ],
        conditions: [], fieldPermissions: [],
        deadlineHours: null, deadlineAction: null,
      },
      {
        id: 'admin_office', label: 'Admin Office Clearance', order: 6, color: 'purple',
        isInitial: false, isFinal: false,
        description: 'School admin or principal signs final clearance.',
        allowedRoles: ['principal_basic', 'program_head', 'technical_admin'],
        actions: [
          { id: 'admin_cleared', label: 'Admin Cleared — Finalize', icon: 'CheckCircle',
            style: 'primary', nextStep: 'fully_cleared', requiresNote: false,
            notifyTrigger: 'clearance_completed' },
        ],
        conditions: [], fieldPermissions: [],
        deadlineHours: null, deadlineAction: null,
      },
      {
        id: 'fully_cleared', label: 'Fully Cleared ✓', order: 7, color: 'green',
        isInitial: false, isFinal: true,
        description: 'Student is fully cleared. Clearance-required documents can now be released.',
        allowedRoles: [], actions: [], conditions: [], fieldPermissions: [],
        deadlineHours: null, deadlineAction: null,
        notifyTrigger: 'clearance_completed',
      },
    ],

    permissions: {
      canView:   ['registrar_basic', 'registrar_college', 'accounting', 'principal_basic', 'program_head', 'admin', 'technical_admin'],
      canCreate: ['registrar_basic', 'registrar_college', 'technical_admin'],
      canExport: ['registrar_basic', 'registrar_college', 'admin', 'technical_admin'],
      canDelete: ['technical_admin'],
    },
    audit: { logAllActions: true, retentionDays: 3650 },
  },

  // ── WORKFLOW 9: Subject Dropping (College) ─────────────────────────────────
  {
    workflowId:  'subject_dropping',
    label:       'Subject Dropping',
    campusKey:   'all',
    department:  'college',
    version:     1,

    steps: [
      {
        id: 'drop_requested', label: 'Drop Requested', order: 1, color: 'yellow',
        isInitial: true, isFinal: false,
        description: 'Student or adviser initiates subject drop request.',
        allowedRoles: ['program_head', 'registrar_college', 'technical_admin'],
        actions: [
          { id: 'proceed_adviser', label: 'Proceed to Adviser Approval', icon: 'ArrowRight',
            style: 'primary', nextStep: 'adviser_approval', requiresNote: false, notifyTrigger: null },
          { id: 'deny', label: 'Deny Request', icon: 'X',
            style: 'danger', nextStep: 'denied', requiresNote: true, notifyTrigger: null },
        ],
        conditions: [
          { type: 'block_if', field: 'droppingDeadlinePassed', operator: 'equals', value: true,
            reason: 'The dropping deadline has passed. Subjects can no longer be dropped this term.' },
        ],
        fieldPermissions: [],
        deadlineHours: null, deadlineAction: null,
      },
      {
        id: 'adviser_approval', label: 'Adviser Approval', order: 2, color: 'blue',
        isInitial: false, isFinal: false,
        description: 'Program Head (or designated adviser) approves the dropping request.',
        allowedRoles: ['program_head', 'technical_admin'],
        actions: [
          { id: 'approve_drop', label: 'Approve Drop', icon: 'Check',
            style: 'primary', nextStep: 'registrar_records', requiresNote: false, notifyTrigger: null },
          { id: 'deny', label: 'Deny', icon: 'X',
            style: 'danger', nextStep: 'denied', requiresNote: true, notifyTrigger: null },
        ],
        conditions: [], fieldPermissions: [],
        deadlineHours: 24, deadlineAction: 'notify_admin',
      },
      {
        id: 'registrar_records', label: 'Registrar Records DRP', order: 3, color: 'indigo',
        isInitial: false, isFinal: false,
        description: 'Registrar posts DRP code to student grade record and frees the class slot.',
        allowedRoles: ['registrar_college', 'technical_admin'],
        actions: [
          { id: 'post_drp', label: 'Post DRP Code', icon: 'FileEdit',
            style: 'primary', nextStep: 'accounting_refund', requiresNote: false, notifyTrigger: null },
        ],
        conditions: [], fieldPermissions: [],
        deadlineHours: 24, deadlineAction: 'notify_admin',
      },
      {
        id: 'accounting_refund', label: 'Accounting Computes Refund', order: 4, color: 'orange',
        isInitial: false, isFinal: false,
        description: 'Accounting computes refund per school refund policy.',
        allowedRoles: ['accounting', 'technical_admin'],
        actions: [
          { id: 'complete_drop', label: 'Complete Drop', icon: 'CheckCircle',
            style: 'primary', nextStep: 'officially_dropped', requiresNote: false,
            notifyTrigger: 'subject_dropped' },
        ],
        conditions: [
          { type: 'skip_if', field: 'refundDeadlinePassed', operator: 'equals', value: true },
        ],
        fieldPermissions: [
          { field: 'refundAmount',  access: 'editable', roles: ['accounting', 'technical_admin'] },
          { field: 'refundMethod',  access: 'editable', roles: ['accounting', 'technical_admin'] },
        ],
        deadlineHours: 48, deadlineAction: 'notify_admin',
      },
      {
        id: 'officially_dropped', label: 'Officially Dropped ✓', order: 5, color: 'green',
        isInitial: false, isFinal: true,
        description: 'Subject officially dropped. Student units updated. GWA recalculated.',
        allowedRoles: [], actions: [], conditions: [], fieldPermissions: [],
        deadlineHours: null, deadlineAction: null,
        notifyTrigger: 'subject_dropped',
      },
      {
        id: 'denied', label: 'Denied ✗', order: null, color: 'red',
        isInitial: false, isFinal: true,
        description: 'Drop request was denied.',
        allowedRoles: [], actions: [], conditions: [], fieldPermissions: [],
        deadlineHours: null, deadlineAction: null,
      },
    ],

    permissions: {
      canView:   ['program_head', 'registrar_college', 'accounting', 'admin', 'technical_admin'],
      canCreate: ['program_head', 'registrar_college', 'technical_admin'],
      canExport: ['registrar_college', 'admin', 'technical_admin'],
      canDelete: ['technical_admin'],
    },
    audit: { logAllActions: true, retentionDays: 3650 },
  },

  // ── WORKFLOW 10: Transfer Out / Release of Credentials ─────────────────────
  {
    workflowId:  'transfer_out',
    label:       'Transfer Out / Release of Credentials',
    campusKey:   'all',
    department:  'all',
    version:     1,

    steps: [
      {
        id: 'transfer_requested', label: 'Transfer Requested', order: 1, color: 'yellow',
        isInitial: true, isFinal: false,
        description: 'Student or parent requests transfer credentials.',
        allowedRoles: ['registrar_basic', 'registrar_college', 'technical_admin'],
        actions: [
          { id: 'require_clearance', label: 'Initiate Clearance Process', icon: 'ClipboardList',
            style: 'primary', nextStep: 'clearance_required', requiresNote: false, notifyTrigger: null },
        ],
        conditions: [], fieldPermissions: [],
        deadlineHours: null, deadlineAction: null,
      },
      {
        id: 'clearance_required', label: 'Clearance Required', order: 2, color: 'orange',
        isInitial: false, isFinal: false,
        description: 'Student clearance workflow is created. This step blocks until fully cleared.',
        allowedRoles: ['registrar_basic', 'registrar_college', 'technical_admin'],
        actions: [
          { id: 'clearance_done', label: 'Clearance Complete — Proceed', icon: 'CheckCircle',
            style: 'primary', nextStep: 'balance_settled', requiresNote: false, notifyTrigger: null },
        ],
        conditions: [
          { type: 'block_if', field: 'clearance.isFullyCleared', operator: 'not_equals', value: true,
            reason: 'Student clearance is not yet complete. All departments must sign off before credentials can be released.' },
        ],
        fieldPermissions: [],
        deadlineHours: null, deadlineAction: null,
      },
      {
        id: 'balance_settled', label: 'Balance Settled', order: 3, color: 'indigo',
        isInitial: false, isFinal: false,
        description: 'Accounting confirms all outstanding balances are fully paid.',
        allowedRoles: ['accounting', 'technical_admin'],
        actions: [
          { id: 'balance_confirmed', label: 'Balance Confirmed — Prepare Records', icon: 'CreditCard',
            style: 'primary', nextStep: 'records_prepared', requiresNote: false, notifyTrigger: null },
        ],
        conditions: [
          { type: 'block_if', field: 'paymentBalance', operator: 'greater_than', value: 0,
            reason: 'Student has an outstanding balance. Must be fully settled before credentials can be prepared.' },
        ],
        fieldPermissions: [],
        deadlineHours: null, deadlineAction: null,
      },
      {
        id: 'records_prepared', label: 'Records Being Prepared', order: 4, color: 'purple',
        isInitial: false, isFinal: false,
        description: 'Registrar generates Form 137, SF9/Form 138, and Good Moral Certificate.',
        allowedRoles: ['registrar_basic', 'registrar_college', 'technical_admin'],
        actions: [
          { id: 'release_credentials', label: 'Release Credentials', icon: 'Package',
            style: 'primary', nextStep: 'released', requiresNote: false,
            notifyTrigger: 'credentials_released' },
        ],
        conditions: [],
        fieldPermissions: [
          { field: 'documentsReleased', access: 'editable', roles: ['registrar_basic', 'registrar_college', 'technical_admin'] },
          { field: 'receivedBy',        access: 'editable', roles: ['registrar_basic', 'registrar_college', 'technical_admin'] },
          { field: 'releaseDate',       access: 'editable', roles: ['registrar_basic', 'registrar_college', 'technical_admin'] },
        ],
        deadlineHours: null, deadlineAction: null,
      },
      {
        id: 'released', label: 'Credentials Released ✓', order: 5, color: 'green',
        isInitial: false, isFinal: true,
        description: 'All credentials released. Student status updated to "transferred".',
        allowedRoles: [], actions: [], conditions: [], fieldPermissions: [],
        deadlineHours: null, deadlineAction: null,
        notifyTrigger: 'credentials_released',
      },
    ],

    permissions: {
      canView:   ['registrar_basic', 'registrar_college', 'accounting', 'admin', 'technical_admin'],
      canCreate: ['registrar_basic', 'registrar_college', 'technical_admin'],
      canExport: ['registrar_basic', 'registrar_college', 'admin', 'technical_admin'],
      canDelete: ['technical_admin'],
    },
    audit: { logAllActions: true, retentionDays: 3650 },
  },

  // ── WORKFLOW 11: Off-Term / Special Class Request (College) ────────────────
  {
    workflowId:  'off_term_class',
    label:       'Off-Term / Special Class Request',
    campusKey:   'all',
    department:  'college',
    version:     1,

    steps: [
      {
        id: 'requested', label: 'Student Requests', order: 1, color: 'yellow',
        isInitial: true, isFinal: false,
        description: 'Student requests an off-term or special class.',
        allowedRoles: ['program_head', 'registrar_college', 'technical_admin'],
        actions: [
          { id: 'evaluate', label: 'Send for Dean Evaluation', icon: 'ArrowRight',
            style: 'primary', nextStep: 'dean_evaluation', requiresNote: false, notifyTrigger: null },
          { id: 'deny', label: 'Deny', icon: 'X',
            style: 'danger', nextStep: 'denied', requiresNote: true, notifyTrigger: null },
        ],
        conditions: [], fieldPermissions: [],
        deadlineHours: null, deadlineAction: null,
      },
      {
        id: 'dean_evaluation', label: 'Dean/Program Head Evaluates', order: 2, color: 'blue',
        isInitial: false, isFinal: false,
        description: 'Dean or Program Head evaluates the merit and feasibility.',
        allowedRoles: ['program_head', 'technical_admin'],
        actions: [
          { id: 'proceed_fees', label: 'Endorse — Compute Fees', icon: 'Calculator',
            style: 'primary', nextStep: 'accounting_computation', requiresNote: false, notifyTrigger: null },
          { id: 'deny', label: 'Deny', icon: 'X',
            style: 'danger', nextStep: 'denied', requiresNote: true, notifyTrigger: null },
        ],
        conditions: [], fieldPermissions: [],
        deadlineHours: 48, deadlineAction: 'notify_admin',
      },
      {
        id: 'accounting_computation', label: 'Accounting Computes Special Fees', order: 3, color: 'orange',
        isInitial: false, isFinal: false,
        description: 'Accounting computes special class fees.',
        allowedRoles: ['accounting', 'technical_admin'],
        actions: [
          { id: 'send_to_student', label: 'Send to Student for Confirmation', icon: 'Send',
            style: 'primary', nextStep: 'student_confirmation', requiresNote: false, notifyTrigger: null },
        ],
        conditions: [],
        fieldPermissions: [
          { field: 'specialFees', access: 'editable', roles: ['accounting', 'technical_admin'] },
        ],
        deadlineHours: 24, deadlineAction: 'notify_admin',
      },
      {
        id: 'student_confirmation', label: 'Student Confirms Fees', order: 4, color: 'indigo',
        isInitial: false, isFinal: false,
        description: 'Student confirms acceptance of special class fees.',
        allowedRoles: ['program_head', 'registrar_college', 'technical_admin'],
        actions: [
          { id: 'confirmed', label: 'Student Confirmed', icon: 'CheckCircle',
            style: 'primary', nextStep: 'registrar_review', requiresNote: false, notifyTrigger: null },
          { id: 'student_declined', label: 'Student Declined', icon: 'X',
            style: 'danger', nextStep: 'denied', requiresNote: true, notifyTrigger: null },
        ],
        conditions: [], fieldPermissions: [],
        deadlineHours: 48, deadlineAction: 'notify_admin',
      },
      {
        id: 'registrar_review', label: 'Registrar Reviews', order: 5, color: 'purple',
        isInitial: false, isFinal: false,
        description: 'Registrar reviews academic records and validates eligibility.',
        allowedRoles: ['registrar_college', 'technical_admin'],
        actions: [
          { id: 'endorse_admin', label: 'Endorse for Admin Approval', icon: 'Send',
            style: 'primary', nextStep: 'admin_approval', requiresNote: false, notifyTrigger: null },
          { id: 'deny', label: 'Deny', icon: 'X',
            style: 'danger', nextStep: 'denied', requiresNote: true, notifyTrigger: null },
        ],
        conditions: [], fieldPermissions: [],
        deadlineHours: 24, deadlineAction: 'notify_admin',
      },
      {
        id: 'admin_approval', label: 'Admin/COO Approval', order: 6, color: 'teal',
        isInitial: false, isFinal: false,
        description: 'Super Admin (or COO) gives final approval to open the special class.',
        allowedRoles: ['technical_admin'],
        actions: [
          { id: 'approve_open', label: 'Approve & Open Subject', icon: 'CheckCircle',
            style: 'primary', nextStep: 'subject_opened', requiresNote: false,
            notifyTrigger: 'special_class_approved' },
          { id: 'deny', label: 'Deny', icon: 'X',
            style: 'danger', nextStep: 'denied', requiresNote: true, notifyTrigger: null },
        ],
        conditions: [], fieldPermissions: [],
        deadlineHours: 48, deadlineAction: 'notify_admin',
      },
      {
        id: 'subject_opened', label: 'Subject Opened ✓', order: 7, color: 'green',
        isInitial: false, isFinal: true,
        description: 'Special class is officially opened.',
        allowedRoles: [], actions: [], conditions: [], fieldPermissions: [],
        deadlineHours: null, deadlineAction: null,
        notifyTrigger: 'special_class_approved',
      },
      {
        id: 'denied', label: 'Denied ✗', order: null, color: 'red',
        isInitial: false, isFinal: true,
        description: 'Special class request was denied.',
        allowedRoles: [], actions: [], conditions: [], fieldPermissions: [],
        deadlineHours: null, deadlineAction: null,
      },
    ],

    permissions: {
      canView:   ['program_head', 'registrar_college', 'accounting', 'admin', 'technical_admin'],
      canCreate: ['program_head', 'registrar_college', 'technical_admin'],
      canExport: ['registrar_college', 'admin', 'technical_admin'],
      canDelete: ['technical_admin'],
    },
    audit: { logAllActions: true, retentionDays: 3650 },
  },
]