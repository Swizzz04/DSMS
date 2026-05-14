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

export function applyTheme(config) {
  const root = document.documentElement
  let primary = '#750014'
  let secondary = '#080c42'

  if (config) {
    primary = config.primaryColor || primary
    secondary = config.secondaryColor || secondary
  } else {
    try {
      const saved = JSON.parse(localStorage.getItem('almirene_website_content') || '{}')
      if (saved.primaryColor) primary = saved.primaryColor
      if (saved.secondaryColor) secondary = saved.secondaryColor
    } catch (e) { /* use defaults */ }
  }

  root.style.setProperty('--color-primary', primary)
  root.style.setProperty('--color-primary-hover', darken(primary, 20))
  root.style.setProperty('--color-primary-light', lighten(primary, 92))
  root.style.setProperty('--color-primary-muted', hexToRgba(primary, 0.08))

  root.style.setProperty('--color-secondary', secondary)
  root.style.setProperty('--color-secondary-hover', darken(secondary, 20))
  root.style.setProperty('--color-secondary-light', lighten(secondary, 40))
  root.style.setProperty('--color-secondary-muted', hexToRgba(secondary, 0.08))
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