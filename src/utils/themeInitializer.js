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
      const saved = JSON.parse(localStorage.getItem('cshc_website_content') || '{}')
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
    if (e.key === 'cshc_website_content') {
      applyTheme(null)
    }
  })
}