/**
 * RolePermissionsTab.jsx — Settings → Role Permissions
 *
 * Super Admin configures what pages and settings tabs each role
 * can access by default. Changes are saved to cshc_app_config.rolePermissions
 * and take effect immediately on next page navigation (no re-login needed).
 *
 * Permission priority (getUserPermissions):
 *   1. Per-user custom override (set in Users tab)
 *   2. Role-level config saved here  ← this tab controls this layer
 *   3. Hardcoded DEFAULT_PERMISSIONS  ← baseline, never changes without a deploy
 */

import { useState, useCallback } from 'react'
import {
  Shield, RotateCcw, Save, Info, Check, ChevronDown, ChevronUp,
} from 'lucide-react'
import {
  ALL_PAGES, ALL_TABS as ALL_SETTINGS_TABS,
  DEFAULT_PERMISSIONS, ROLE_DEFINITIONS,
  getRolePermissions, saveRolePermissions,
} from '../../config/appConfig'
import { useToast, ToastContainer, ConfirmDialog } from '../UIComponents'

// ── Roles that can be configured (not technical_admin — always full access) ──
const CONFIGURABLE_ROLES = [
  { id: 'admin',             label: 'School Owner (Admin)',       description: 'Read-only overview. Cannot modify data.' },
  { id: 'registrar_basic',   label: 'Registrar — Basic Ed',       description: 'Manages Basic Ed enrollment and student records.' },
  { id: 'registrar_college', label: 'Registrar — College',        description: 'Manages College enrollment and student records.' },
  { id: 'accounting',        label: 'Accounting',                 description: 'Manages payments and fee collection.' },
  { id: 'principal_basic',   label: 'Principal — Basic Ed',       description: 'Oversees Basic Ed curriculum and grades.' },
  { id: 'program_head',      label: 'Program Head — College',     description: 'Oversees College programs and grades.' },
  { id: 'teacher',           label: 'Teacher',                    description: 'Manages e-Class Record and attendance.' },
]

const PAGE_GROUPS = [
  {
    group: 'Management',
    pages: ALL_PAGES.filter(p => ['enrollments','students','payments','document-requests','clearance'].includes(p.id)),
  },
  {
    group: 'Analytics',
    pages: ALL_PAGES.filter(p => ['reports'].includes(p.id)),
  },
  {
    group: 'Academic',
    pages: ALL_PAGES.filter(p => ['subject-load','e-class-record','teacher-forms','grade-change-requests','attendance'].includes(p.id)),
  },
  {
    group: 'System',
    pages: ALL_PAGES.filter(p => ['settings'].includes(p.id)),
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// ROLE ROW
// ─────────────────────────────────────────────────────────────────────────────

function RoleRow({ role, permissions, defaults, onChange }) {
  const [expanded, setExpanded] = useState(false)

  const pages = permissions?.pages ?? defaults.pages ?? []
  const tabs  = permissions?.tabs  ?? defaults.tabs  ?? []
  const isCustomized = !!permissions

  const togglePage = (pageId) => {
    const next = pages.includes(pageId)
      ? pages.filter(p => p !== pageId)
      : [...pages, pageId]
    // If removing settings, also clear tabs
    const nextTabs = next.includes('settings') ? tabs : []
    onChange({ pages: next, tabs: nextTabs })
  }

  const toggleTab = (tabId) => {
    const next = tabs.includes(tabId)
      ? tabs.filter(t => t !== tabId)
      : [...tabs, tabId]
    onChange({ pages, tabs: next })
  }

  const resetToDefault = () => {
    onChange(null) // null = use default
  }

  const grantAll = () => {
    onChange({
      pages: ALL_PAGES.filter(p => p.id !== 'dashboard').map(p => p.id),
      tabs:  ALL_SETTINGS_TABS.map(t => t.id),
    })
  }

  return (
    <div className="card overflow-hidden">
      {/* Role header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-[var(--color-bg-subtle)]/50 transition-colors select-none"
        onClick={() => setExpanded(e => !e)}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && setExpanded(v => !v)}
      >
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0
            ${isCustomized ? 'bg-primary/10 text-primary' : 'bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]'}`}>
            <Shield size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                {role.label}
              </p>
              {isCustomized && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  Customized
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{role.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-[var(--color-text-muted)]">
            {pages.length} page{pages.length !== 1 ? 's' : ''}
          </span>
          {expanded ? <ChevronUp size={16} className="text-[var(--color-text-muted)]" /> : <ChevronDown size={16} className="text-[var(--color-text-muted)]" />}
        </div>
      </div>

      {/* Expandable permissions editor */}
      {expanded && (
        <div className="border-t border-[var(--color-border)] p-4 space-y-5 bg-[var(--color-bg-page)]">
          {/* Quick actions */}
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={resetToDefault}
              className="btn btn-ghost text-xs gap-1.5"
            >
              <RotateCcw size={12} /> Reset to Default
            </button>
            <button
              type="button"
              onClick={grantAll}
              className="btn btn-ghost text-xs gap-1.5"
            >
              Grant All Pages
            </button>
          </div>

          {/* Info notice */}
          <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-xs text-blue-800 dark:text-blue-300">
            <Info size={12} className="shrink-0 mt-0.5" />
            Dashboard is always included. Per-user overrides in the Users tab take priority over these settings.
          </div>

          {/* Page access by group */}
          <div className="space-y-4">
            {PAGE_GROUPS.map(group => (
              <div key={group.group}>
                <p className="text-label text-[var(--color-text-muted)] mb-2">{group.group}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {group.pages.map(page => {
                    const checked = pages.includes(page.id)
                    return (
                      <label
                        key={page.id}
                        className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-colors
                          ${checked
                            ? 'bg-primary/5 border-primary/30 text-primary'
                            : 'bg-[var(--color-bg-card)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-primary/30'}`}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors
                          ${checked ? 'bg-primary border-primary' : 'border-[var(--color-border)]'}`}>
                          {checked && <Check size={10} className="text-white" />}
                        </div>
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={checked}
                          onChange={() => togglePage(page.id)}
                        />
                        <span className="text-xs font-medium truncate">{page.label}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Settings tabs — only if settings page is enabled */}
          {pages.includes('settings') && (
            <div>
              <p className="text-label text-[var(--color-text-muted)] mb-2">Settings Tabs</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ALL_SETTINGS_TABS.map(tab => {
                  const checked = tabs.includes(tab.id)
                  return (
                    <label
                      key={tab.id}
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-colors
                        ${checked
                          ? 'bg-primary/5 border-primary/30 text-primary'
                          : 'bg-[var(--color-bg-card)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-primary/30'}`}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors
                        ${checked ? 'bg-primary border-primary' : 'border-[var(--color-border)]'}`}>
                        {checked && <Check size={10} className="text-white" />}
                      </div>
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        onChange={() => toggleTab(tab.id)}
                      />
                      <span className="text-xs font-medium truncate">{tab.label}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function RolePermissionsTab() {
  const { toasts, addToast, removeToast } = useToast()

  // Load current role permissions
  const [rolePerms, setRolePerms] = useState(() => {
    const saved = getRolePermissions()
    // If saved equals DEFAULT_PERMISSIONS, treat as no customization
    // (so we can detect what's been customized vs default)
    const result = {}
    CONFIGURABLE_ROLES.forEach(role => {
      const savedPerms = saved[role.id]
      const defaults   = DEFAULT_PERMISSIONS[role.id]
      // Mark as customized if stored in cshc_app_config (not just defaults)
      try {
        const cfg = JSON.parse(localStorage.getItem('cshc_app_config') || '{}')
        result[role.id] = cfg.rolePermissions?.[role.id] ?? null
      } catch {
        result[role.id] = null
      }
    })
    return result
  })

  const [isDirty,        setIsDirty]        = useState(false)
  const [isSaving,       setIsSaving]       = useState(false)
  const [resetConfirm,   setResetConfirm]   = useState(false)

  const handleChange = (roleId, perms) => {
    setRolePerms(prev => ({ ...prev, [roleId]: perms }))
    setIsDirty(true)
  }

  const handleSave = () => {
    setIsSaving(true)
    try {
      // Only save roles that have been customized (non-null)
      const toSave = {}
      CONFIGURABLE_ROLES.forEach(role => {
        if (rolePerms[role.id] !== null) {
          toSave[role.id] = rolePerms[role.id]
        }
      })
      const ok = saveRolePermissions(toSave)
      if (ok) {
        addToast('Role permissions saved. Changes take effect on next navigation.', 'success')
        setIsDirty(false)
      } else {
        addToast('Failed to save. Please try again.', 'error')
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleResetAll = () => {
    // Clear all customizations — everyone goes back to DEFAULT_PERMISSIONS
    saveRolePermissions({})
    setRolePerms(() => {
      const r = {}
      CONFIGURABLE_ROLES.forEach(role => { r[role.id] = null })
      return r
    })
    setIsDirty(false)
    setResetConfirm(false)
    addToast('All role permissions reset to system defaults.', 'success')
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Role Permissions</h2>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            Configure which pages and settings tabs each role can access by default.
            Per-user overrides set in the Users tab take priority over these settings.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setResetConfirm(true)}
            className="btn btn-ghost text-xs gap-1.5"
          >
            <RotateCcw size={12} /> Reset All
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            className="btn btn-primary text-xs gap-1.5 disabled:opacity-50"
          >
            {isSaving
              ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Save size={12} />
            }
            {isDirty ? 'Save Changes' : 'Saved'}
          </button>
        </div>
      </div>

      {/* Notice: technical_admin is always full access */}
      <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
        <Info size={12} className="shrink-0 mt-0.5" />
        <span>
          <strong>Super Admin (technical_admin)</strong> always has full access to all pages and settings.
          This role cannot be restricted.
        </span>
      </div>

      {/* Unsaved changes banner */}
      {isDirty && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-xs text-amber-800 dark:text-amber-300">
          <Info size={12} className="shrink-0" />
          You have unsaved changes. Click "Save Changes" to apply.
        </div>
      )}

      {/* Role rows */}
      <div className="space-y-3">
        {CONFIGURABLE_ROLES.map(role => (
          <RoleRow
            key={role.id}
            role={role}
            permissions={rolePerms[role.id]}
            defaults={DEFAULT_PERMISSIONS[role.id] ?? { pages: ['dashboard'], tabs: [] }}
            onChange={(perms) => handleChange(role.id, perms)}
          />
        ))}
      </div>

      <ConfirmDialog
        open={resetConfirm}
        title="Reset All Role Permissions"
        message="This will remove all custom role configurations and restore every role to system defaults. Per-user overrides are not affected."
        confirmLabel="Reset All"
        danger={false}
        onConfirm={handleResetAll}
        onCancel={() => setResetConfirm(false)}
      />

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  )
}