/**
 * migrateLocalStorageKeys — one-time migration from cshc_* to almirene_*
 * Run once on app boot. Safe to call multiple times (idempotent).
 */
export function migrateLocalStorageKeys() {
  // Avatar keys are skipped — they store base64 images that can exceed quota
  // They will be re-generated naturally when users update their profiles
  try { _doMigrate() } catch (e) {
    console.warn('[ALMIRENE] localStorage migration failed (quota?):', e.message)
  }
}

function _doMigrate() {
  const KEY_MAP = {
    'cshc_submissions':        'almirene_submissions',
    'cshc_app_config':         'almirene_app_config',
    'cshc_website_content':    'almirene_website_content',
    'cshc_subject_loads':      'almirene_subject_loads',
    'cshc_grades':             'almirene_grades',
    'cshc_college_grades':     'almirene_college_grades',
    'cshc_form_templates':     'almirene_form_templates',
    'cshc_custom_form_types':  'almirene_custom_form_types',
    'cshc_ref_counter':        'almirene_ref_counter',
    'cshc_lockout':            'almirene_lockout',
    'cshc_draft_scores':       'almirene_draft_scores',
    'cshc_grade_activities':   'almirene_grade_activities',
  }
  let migrated = 0
  for (const [oldKey, newKey] of Object.entries(KEY_MAP)) {
    const val = localStorage.getItem(oldKey)
    if (val !== null && localStorage.getItem(newKey) === null) {
      localStorage.setItem(newKey, val)
      localStorage.removeItem(oldKey)
      migrated++
    }
  }
  // Migrate campus config keys (dynamic prefix)
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith('cshc_campus_cfg_')) {
      const newKey = key.replace('cshc_campus_cfg_', 'almirene_campus_cfg_')
      if (localStorage.getItem(newKey) === null) {
        localStorage.setItem(newKey, localStorage.getItem(key))
        localStorage.removeItem(key)
        migrated++
        i-- // recheck index after removal
      }
    }
    if (key?.startsWith('cshc_profile_')) {
      const newKey = key.replace('cshc_profile_', 'almirene_profile_')
      if (localStorage.getItem(newKey) === null) {
        localStorage.setItem(newKey, localStorage.getItem(key))
        localStorage.removeItem(key)
        migrated++
        i--
      }
    }
    if (key?.startsWith('cshc_theme_')) {
      const newKey = key.replace('cshc_theme_', 'almirene_theme_')
      if (localStorage.getItem(newKey) === null) {
        localStorage.setItem(newKey, localStorage.getItem(key))
        localStorage.removeItem(key)
        migrated++
        i--
      }
    }
  }
  if (migrated > 0) console.info(`[ALMIRENE] Migrated ${migrated} localStorage keys from cshc_* to almirene_*`)
}

function hexToRgb(hex) {
  const h = hex.replace('#', '')
  return { r: parseInt(h.substring(0, 2), 16), g: parseInt(h.substring(2, 4), 16), b: parseInt(h.substring(4, 6), 16) }
}

function rgbToHex(r, g, b) {
  const c = v => Math.max(0, Math.min(255, Math.round(v)))
  return '#' + [r, g, b].map(v => c(v).toString(16).padStart(2, '0')).join('')
}

function darken(hex, pct) {
  const { r, g, b } = hexToRgb(hex)
  const f = 1 - pct / 100
  return rgbToHex(r * f, g * f, b * f)
}

function lighten(hex, pct) {
  const { r, g, b } = hexToRgb(hex)
  const f = pct / 100
  return rgbToHex(r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f)
}

function hexToRgba(hex, a) {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

// Space-separated RGB triplet for Tailwind's opacity-modifier syntax
// (bg-primary/10, border-primary/40, etc.) — see tailwind.config.js
function hexToRgbTriplet(hex) {
  const { r, g, b } = hexToRgb(hex)
  return `${r} ${g} ${b}`
}

// ── Contrast-safe color derivation ──────────────────────────────
// Root fix for the "pale default primary color makes text/buttons invisible"
// class of bugs (Rev.14 flagged this as unresolved system-wide risk). Rather
// than picking a different static default — which just moves the bug to
// whatever color a school picks next — these functions COMPUTE safe colors
// from whatever primary/secondary is actually configured, using real WCAG
// relative luminance. This works for any color, forever, with no future
// "still hardcoded" bug reports when a school picks their own brand colors.

/** WCAG 2.x relative luminance (0 = black, 1 = white) */
export function relativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex)
  const [rl, gl, bl] = [r, g, b].map(c => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl
}

/**
 * The text color to place ON TOP of a solid fill of `hex` (e.g. a bg-primary
 * button). Returns near-black or white, whichever contrasts more.
 */
export function contrastOn(hex) {
  return relativeLuminance(hex) > 0.5 ? '#1a1a1a' : '#ffffff'
}

/**
 * A variant of `hex` guaranteed to be readable as PLAIN TEXT/borders/icons
 * against the page background — i.e. for `text-primary`/`border-primary`
 * usage where the color isn't sitting on its own filled background. A pale
 * primary (readable as a button fill, since contrastOn() picks dark text for
 * it) is NOT readable as text directly on a light page — this darkens it
 * until it clears a minimum contrast threshold against the page background.
 * Mirrors in dark mode (lightens an overly-dark color instead).
 */
function readableForeground(hex, isDarkMode) {
  let { r, g, b } = hexToRgb(hex)
  let tries = 0
  if (!isDarkMode) {
    // Light page background (~white) — darken until contrast is ~4.5:1+ (WCAG AA).
    while (relativeLuminance(rgbToHex(r, g, b)) > 0.16 && tries < 30) {
      r *= 0.88; g *= 0.88; b *= 0.88
      tries++
    }
  } else {
    // Dark page background (~near-black) — lighten until it's light enough to read.
    while (relativeLuminance(rgbToHex(r, g, b)) < 0.4 && tries < 30) {
      r += (255 - r) * 0.25; g += (255 - g) * 0.25; b += (255 - b) * 0.25
      tries++
    }
  }
  return rgbToHex(r, g, b)
}

/** WCAG 2.x contrast ratio between two colors (1 = no contrast, 21 = max). */
export function contrastRatio(hexA, hexB) {
  const lA = relativeLuminance(hexA)
  const lB = relativeLuminance(hexB)
  const lighter = Math.max(lA, lB)
  const darker = Math.min(lA, lB)
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * A variant of `fgHex` guaranteed to be readable as plain text directly
 * against a SPECIFIC other color `bgHex` — not "the page". Use this when
 * text sits on a school's OTHER custom color (e.g. primary-colored text on
 * a secondary-colored panel, like the login screen's left brand panel).
 * readableForeground() above assumes a near-white/near-black PAGE and
 * doesn't help here, since either custom color can independently be light
 * or dark regardless of light/dark mode. Darkens or lightens fgHex toward
 * whichever end increases contrast against bgHex, until it clears WCAG AA
 * (4.5:1) or gives up after a bounded number of steps.
 */
function readableAgainst(fgHex, bgHex, targetRatio = 4.5) {
  let { r, g, b } = hexToRgb(fgHex)
  const goDarker = relativeLuminance(bgHex) > 0.5 // light bg → darken fg toward black
  let tries = 0
  while (contrastRatio(rgbToHex(r, g, b), bgHex) < targetRatio && tries < 40) {
    if (goDarker) { r *= 0.9; g *= 0.9; b *= 0.9 }
    else { r += (255 - r) * 0.15; g += (255 - g) * 0.15; b += (255 - b) * 0.15 }
    tries++
  }
  return rgbToHex(r, g, b)
}

// Default brand palette — mode-aware. A school's OWN custom color (picked
// via Settings → School Info) stays the same hex in both modes, since a
// brand color shouldn't visually change identity between light/dark — only
// these neutral, brand-less defaults swap roles for a polished out-of-box
// dark mode. See applyTheme() below.
const DEFAULT_PRIMARY_LIGHT   = '#F4FAFC'
const DEFAULT_SECONDARY_LIGHT = '#212121'
const DEFAULT_PRIMARY_DARK    = '#1A1A1A'
const DEFAULT_SECONDARY_DARK  = '#F4FAFC'

export function applyTheme(config) {
  const root = document.documentElement
  const isDarkMode = root.classList.contains('dark')

  let primary = null
  let secondary = null

  if (config) {
    primary = config.primaryColor || null
    secondary = config.secondaryColor || null
  } else {
    try {
      const saved = JSON.parse(localStorage.getItem('almirene_website_content') || '{}')
      primary = saved.primaryColor || null
      secondary = saved.secondaryColor || null
    } catch (e) { /* use defaults */ }
  }

  // No custom color configured — use the mode-appropriate default. A custom
  // color (truthy above) is left exactly as the school set it, unchanged
  // across modes; only its derived contrast/readable variants adapt per mode.
  if (!primary) primary = isDarkMode ? DEFAULT_PRIMARY_DARK : DEFAULT_PRIMARY_LIGHT
  if (!secondary) secondary = isDarkMode ? DEFAULT_SECONDARY_DARK : DEFAULT_SECONDARY_LIGHT

  root.style.setProperty('--color-primary', primary)
  root.style.setProperty('--color-primary-rgb', hexToRgbTriplet(primary))
  root.style.setProperty('--color-primary-hover', darken(primary, 20))
  root.style.setProperty('--color-primary-light', lighten(primary, 92))
  root.style.setProperty('--color-primary-muted', hexToRgba(primary, 0.08))

  root.style.setProperty('--color-secondary', secondary)
  root.style.setProperty('--color-secondary-rgb', hexToRgbTriplet(secondary))
  root.style.setProperty('--color-secondary-hover', darken(secondary, 20))
  root.style.setProperty('--color-secondary-light', lighten(secondary, 40))
  root.style.setProperty('--color-secondary-muted', hexToRgba(secondary, 0.08))

  // Contrast-safe derived colors — see readableForeground()/contrastOn() above.
  // Recomputed every call, so switching dark/light mode (which calls this via
  // ThemeContext) or changing brand colors in Settings both stay correct.
  root.style.setProperty('--color-primary-contrast', contrastOn(primary))
  root.style.setProperty('--color-secondary-contrast', contrastOn(secondary))
  root.style.setProperty('--color-primary-contrast-rgb', hexToRgbTriplet(contrastOn(primary)))
  root.style.setProperty('--color-secondary-contrast-rgb', hexToRgbTriplet(contrastOn(secondary)))
  root.style.setProperty('--color-primary-readable', readableForeground(primary, isDarkMode))
  root.style.setProperty('--color-secondary-readable', readableForeground(secondary, isDarkMode))

  // For text sitting on the SCHOOL'S OTHER custom color rather than the page
  // (e.g. primary-colored brand text on the login screen's secondary-colored
  // side panel) — measured against that actual color, not a page assumption,
  // so it stays correct no matter which two colors a school picks together.
  root.style.setProperty('--color-primary-on-secondary', readableAgainst(primary, secondary))
  root.style.setProperty('--color-secondary-on-primary', readableAgainst(secondary, primary))
}

export function initTheme() {
  applyTheme(null)
}

export function listenForThemeChanges() {
  window.addEventListener('storage', function(e) {
    if (e.key === 'almirene_website_content') {
      applyTheme(null)
    }
  })
}