/**
 * chartTheme.js — ALMIRENE DX
 * ─────────────────────────────────────────────────────────────────
 * Chart.js draws on a <canvas>, which cannot resolve CSS var() strings, so it needs real
 * colour values. This reads the live tokens from :root.
 *
 * Series colours come from the fixed --color-chart-1..8 palette (index.css), NOT from the
 * school's brand colours: a pale or dark brand must never make bars or slices unreadable.
 *
 * Slot convention (colour follows the entity, never its rank):
 *   Basic Ed = slot 1 · College = slot 2 · campuses start at slot 3 (config order)
 *
 * Use through the hook: src/hooks/useChartTheme.js (re-reads when the theme or brand changes).
 * Plain .js on purpose: no JSX, no React, no storage.
 */

export const SERIES_COUNT = 8

/** Fixed slot indices (0-based) */
export const CHART_SLOTS = Object.freeze({
  basic: 0,
  college: 1,
  campusStart: 2,
})

export function readChartTheme() {
  if (typeof document === 'undefined') return emptyTheme()
  const css = getComputedStyle(document.documentElement)
  const v = (name) => css.getPropertyValue(name).trim()

  const series = Array.from({ length: SERIES_COUNT }, (_, i) => v(`--color-chart-${i + 1}`))

  return {
    // chrome
    grid:      v('--color-border'),
    tick:      v('--color-text-muted'),
    text:      v('--color-text-secondary'),
    surface:   v('--color-bg-card'),
    // fixed categorical palette
    series,
    violet:    series[6],
    // status colours (semantic — only for status data)
    success:   v('--color-success'),
    warning:   v('--color-warning'),
    error:     v('--color-error'),
    info:      v('--color-info'),
  }
}

function emptyTheme() {
  return {
    grid: '', tick: '', text: '', surface: '',
    series: Array.from({ length: SERIES_COUNT }, () => ''),
    violet: '', success: '', warning: '', error: '', info: '',
  }
}

/** Colour for series slot `index` (0-based). Past 8 it wraps, but 8+ series should be folded or faceted. */
export function seriesColor(theme, index) {
  const list = theme.series
  return list[((index % list.length) + list.length) % list.length]
}

/** Stable colour for a campus: its position in the configured campus list, not in the filtered list. */
export function campusColor(theme, campusKey, allCampuses) {
  const idx = Math.max(0, (allCampuses || []).findIndex((c) => c.key === campusKey))
  return seriesColor(theme, CHART_SLOTS.campusStart + idx)
}
