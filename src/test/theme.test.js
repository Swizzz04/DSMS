import { describe, it, expect } from 'vitest'
import { resolveBrandColors, actionFill, bestTextOn, contrastRatio, relativeLuminance } from '../utils/themeInitializer'

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

describe('sidebar active pill (action colour) keeps 4.5:1 text contrast', () => {
  const CARDS = ['#ffffff', '#212121']
  const PALETTES = [
    ['#F3F2EE', '#0B0B0C'], ['#0B0B0C', '#F3F2EE'], ['#1E3A8A', '#F59E0B'], ['#F80D0D', '#FFFFFF'],
    ['#FFFF00', '#000000'], ['#7F7F7F', '#808080'], ['#14532D', '#FDE68A'], ['#FFFFFF', '#FFFFFF'],
  ]
  it.each(PALETTES)('primary %s / selected %s on both card surfaces', (primary, selected) => {
    for (const card of CARDS) {
      const action = actionFill(primary, selected, card)
      expect(relativeLuminance(action)).toBeGreaterThanOrEqual(0)
      expect(contrastRatio(action, bestTextOn(action))).toBeGreaterThanOrEqual(4.5)
    }
  })
})
