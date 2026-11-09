import { describe, it, expect } from 'vitest'
import { getCampusScope, isCampusLockedRole } from '../config/appConfig'

describe('getCampusScope: the user\'s own campus value decides, never the role', () => {
  it('a user with a campus is locked to it', () => {
    expect(getCampusScope({ role: 'accounting', campus: 'Carcar City Campus' }))
      .toEqual({ locked: true, campusName: 'Carcar City Campus' })
  })

  it('campus "all", empty or missing is not locked', () => {
    expect(getCampusScope({ campus: 'all' }).locked).toBe(false)
    expect(getCampusScope({ campus: '' }).locked).toBe(false)
    expect(getCampusScope({ campus: '   ' }).locked).toBe(false)
    expect(getCampusScope({}).locked).toBe(false)
    expect(getCampusScope(null).locked).toBe(false)
  })

  it('the same role is locked or not depending on the account', () => {
    expect(isCampusLockedRole({ role: 'teacher', campus: 'Carcar City Campus' })).toBe(true)
    expect(isCampusLockedRole({ role: 'teacher', campus: 'all' })).toBe(false)
  })
})
