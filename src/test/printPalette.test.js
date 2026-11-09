import { describe, it, expect } from 'vitest'
import { buildPrintPalette, printPaletteCss } from '../utils/printPalette'
import { contrastRatio } from '../utils/themeInitializer'

describe('print palette for white paper', () => {
  it('a very light brand colour is darkened so printed text in it can be read', () => {
    const p = buildPrintPalette('#F3F2EE', '#0B0B0C')
    expect(contrastRatio(p.brand, '#ffffff')).toBeGreaterThanOrEqual(4.5)
  })

  it('a dark brand colour is left as it is', () => {
    expect(buildPrintPalette('#1E3A8A', '#0B0B0C').brand.toLowerCase()).toBe('#1e3a8a')
  })

  it('table header text reads on the header fill, whichever way round the school\'s colour is', () => {
    for (const fill of ['#0B0B0C', '#F3F2EE', '#F59E0B', '#1E3A8A']) {
      const p = buildPrintPalette('#1E3A8A', fill)
      expect(contrastRatio(p.headInk, fill)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('the CSS block defines every variable the Statement of Account uses', () => {
    const css = printPaletteCss('#F3F2EE', '#0B0B0C')
    for (const v of ['brand', 'head-fill', 'head-ink', 'head-edge', 'ink', 'muted', 'faint', 'rule', 'row-rule',
      'panel', 'fee-box', 'fee-box-border', 'paid-text', 'paid-bg', 'paid-border', 'due-text', 'due-bg', 'due-border', 'discount']) {
      expect(css).toContain(`--p-${v}:`)
    }
  })
})
