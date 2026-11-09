import { describe, it, expect } from 'vitest'
import {
  getUserPermissions, saveRolePermissions, getRolePermissions,
  getCustomRoles, saveCustomRoles, makeCustomRoleId, getAllRoleDefinitions,
  DEFAULT_PERMISSIONS,
} from '../config/appConfig'

describe('permission tiers', () => {
  it('Super Admin always gets everything, even with a role override saved', () => {
    saveRolePermissions({ technical_admin: { pages: ['dashboard'], tabs: [] } })
    const p = getUserPermissions({ role: 'technical_admin' })
    expect(p.pages).toContain('settings')
    expect(p.tabs).toContain('rolePermissions')
  })

  it('a built-in role uses its defaults until Role Permissions saves something', () => {
    expect(getUserPermissions({ role: 'accounting' }).pages).toEqual(DEFAULT_PERMISSIONS.accounting.pages)
    saveRolePermissions({ accounting: { pages: ['dashboard', 'payments'], tabs: [] } })
    expect(getUserPermissions({ role: 'accounting' }).pages).toEqual(['dashboard', 'payments'])
  })

  it('a per-user override beats the role setting', () => {
    saveRolePermissions({ accounting: { pages: ['dashboard', 'payments'], tabs: [] } })
    const user = { role: 'accounting', permissions: { pages: ['dashboard'], tabs: [] } }
    expect(getUserPermissions(user).pages).toEqual(['dashboard'])
  })

  it('an unknown role only gets the dashboard', () => {
    expect(getUserPermissions({ role: 'nobody' })).toEqual({ pages: ['dashboard'], tabs: [] })
  })
})

describe('custom roles', () => {
  const makeRole = (over = {}) => ({
    id: 'custom_academic_coordinator', label: 'Academic Coordinator',
    description: '', campusScoped: false, pages: ['reports', 'students'], tabs: [], ...over,
  })

  it('ids come from the name and never collide with built-in or existing roles', () => {
    expect(makeCustomRoleId('Academic Coordinator')).toBe('custom_academic_coordinator')
    expect(makeCustomRoleId('Academic Coordinator', ['custom_academic_coordinator']))
      .toBe('custom_academic_coordinator_2')
    expect(makeCustomRoleId('!!!')).toBe('custom_role')
  })

  it('a custom role gets its own pages, and always the dashboard', () => {
    saveCustomRoles([makeRole()])
    expect(getUserPermissions({ role: 'custom_academic_coordinator' }).pages)
      .toEqual(['dashboard', 'reports', 'students'])
  })

  it('shows up with the built-in roles, with its campus scope', () => {
    saveCustomRoles([makeRole()])
    const defs = getAllRoleDefinitions()
    expect(defs.custom_academic_coordinator.label).toBe('Academic Coordinator')
    expect(defs.custom_academic_coordinator.campusScoped).toBe(false)
    expect(defs.teacher).toBeDefined()
  })

  it('renaming a role does not detach its users (the id stays)', () => {
    saveCustomRoles([makeRole({ label: 'Coordinator (renamed)' })])
    expect(getUserPermissions({ role: 'custom_academic_coordinator' }).pages).toContain('reports')
  })

  it('saving role permissions does not erase the custom roles, and the other way round', () => {
    saveCustomRoles([makeRole()])
    saveRolePermissions({ accounting: { pages: ['dashboard'], tabs: [] } })
    expect(getCustomRoles()).toHaveLength(1)
    saveCustomRoles([])
    expect(getRolePermissions().accounting.pages).toEqual(['dashboard'])
  })
})
