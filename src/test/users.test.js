import { describe, it, expect } from 'vitest'
import { resolveSystemUsers } from '../config/users'

const DEMO = [{ id: 99, email: 'demo@school.edu.ph', role: 'teacher' }]
const HASH = 'a'.repeat(64)

describe('which accounts a build starts with', () => {
  it('development loads the demo accounts', () => {
    expect(resolveSystemUsers({ DEV: true }, DEMO)).toBe(DEMO)
  })

  it('a production build loads demo accounts only when VITE_DEMO_ACCOUNTS is "true"', () => {
    expect(resolveSystemUsers({ DEV: false, VITE_DEMO_ACCOUNTS: 'true' }, DEMO)).toBe(DEMO)
    expect(resolveSystemUsers({ DEV: false, VITE_DEMO_ACCOUNTS: 'TRUE ' }, DEMO)).toBe(DEMO)
    expect(resolveSystemUsers({ DEV: false, VITE_DEMO_ACCOUNTS: 'false' }, DEMO)).toEqual([])
    expect(resolveSystemUsers({ DEV: false, VITE_DEMO_ACCOUNTS: '1' }, DEMO)).toEqual([])
  })

  it('production starts with the one bootstrap Technical Administrator', () => {
    const users = resolveSystemUsers({
      DEV: false, VITE_BOOTSTRAP_ADMIN_EMAIL: ' owner@school.edu.ph ', VITE_BOOTSTRAP_ADMIN_HASH: HASH.toUpperCase(),
    }, DEMO)
    expect(users).toHaveLength(1)
    expect(users[0]).toMatchObject({
      email: 'owner@school.edu.ph', passwordHash: HASH,
      role: 'technical_admin', campus: 'all', status: 'active',
    })
  })

  it('a missing email or a hash that is not 64 hex characters gives no accounts', () => {
    expect(resolveSystemUsers({ DEV: false, VITE_BOOTSTRAP_ADMIN_HASH: HASH }, DEMO)).toEqual([])
    expect(resolveSystemUsers({ DEV: false, VITE_BOOTSTRAP_ADMIN_EMAIL: 'a@b.ph', VITE_BOOTSTRAP_ADMIN_HASH: 'admin123' }, DEMO)).toEqual([])
    expect(resolveSystemUsers({ DEV: false }, DEMO)).toEqual([])
  })

  it('the demo accounts never leak into a production build with a bootstrap admin', () => {
    const users = resolveSystemUsers({ DEV: false, VITE_BOOTSTRAP_ADMIN_EMAIL: 'o@s.ph', VITE_BOOTSTRAP_ADMIN_HASH: HASH }, DEMO)
    expect(users.some(u => u.id === 99)).toBe(false)
  })
})
