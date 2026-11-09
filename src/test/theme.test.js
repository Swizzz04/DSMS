import { describe, it, expect } from 'vitest'
import { resolveBrandColors } from '../utils/themeInitializer'

describe('which primary/secondary pair the theme uses', () => {
  it('with nothing saved, the defaults swap roles in dark mode', () => {
    expect(resolveBrandColors(null, null, false)).toEqual({ primary: '#F3F2EE', secondary: '#0B0B0C' })
    expect(resolveBrandColors(null, null, true)).toEqual({ primary: '#0B0B0C', secondary: '#F3F2EE' })
  })

  it('a school\'s own colours never change with the theme', () => {
    const pair = { primary: '#1E3A8A', secondary: '#F59E0B' }
    expect(resolveBrandColors('#1E3A8A', '#F59E0B', false)).toEqual(pair)
    expect(resolveBrandColors('#1E3A8A', '#F59E0B', true)).toEqual(pair)
  })

  it('saving only one colour keeps the other on the light default in both modes', () => {
    expect(resolveBrandColors(null, '#F80D0D', true)).toEqual({ primary: '#F3F2EE', secondary: '#F80D0D' })
    expect(resolveBrandColors(null, '#F80D0D', false)).toEqual({ primary: '#F3F2EE', secondary: '#F80D0D' })
    expect(resolveBrandColors('#1E3A8A', null, true)).toEqual({ primary: '#1E3A8A', secondary: '#0B0B0C' })
  })
})
