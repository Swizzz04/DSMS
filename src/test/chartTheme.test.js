import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { SERIES_COUNT, CHART_SLOTS, seriesColor, campusColor } from '../utils/chartTheme'

const SRC = resolve(__dirname, '..')
const read = (rel) => readFileSync(resolve(SRC, rel), 'utf8')

const theme = { series: ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'] }
const campuses = [{ key: 'talisay' }, { key: 'carcar' }, { key: 'bohol' }]

describe('chart palette', () => {
  it('has 8 fixed slots, Basic Ed first and College second', () => {
    expect(SERIES_COUNT).toBe(8)
    expect(CHART_SLOTS.basic).toBe(0)
    expect(CHART_SLOTS.college).toBe(1)
    expect(CHART_SLOTS.campusStart).toBe(2)
  })

  it('seriesColor picks by slot and wraps past the end', () => {
    expect(seriesColor(theme, 0)).toBe('c1')
    expect(seriesColor(theme, 7)).toBe('c8')
    expect(seriesColor(theme, 8)).toBe('c1')
  })

  it('a campus keeps its colour by its position in the configured list', () => {
    expect(campusColor(theme, 'talisay', campuses)).toBe('c3')
    expect(campusColor(theme, 'carcar', campuses)).toBe('c4')
    expect(campusColor(theme, 'bohol', campuses)).toBe('c5')
  })

  it('filtering the visible campuses never repaints the survivors', () => {
    // the header campus filter shows only Bohol; its colour is still slot 5, not slot 3
    expect(campusColor(theme, 'bohol', campuses)).toBe('c5')
  })
})

describe('chart colours never follow the school brand', () => {
  it.each(['utils/chartTheme.js', 'hooks/useChartTheme.js'])('%s does not read primary/secondary', (rel) => {
    const code = read(rel)
    expect(code).not.toMatch(/--color-primary/)
    expect(code).not.toMatch(/--color-secondary/)
  })

  it.each(['pages/Dashboard.jsx', 'pages/Students.jsx'])('%s builds chart colours from the shared theme', (rel) => {
    const code = read(rel)
    expect(code).toMatch(/useChartTheme\(\)/)
    expect(code).not.toMatch(/chart\.(primary|secondary)\b/)
    expect(code).not.toMatch(/primaryClr|secondaryColor|primaryColor/)
  })
})
