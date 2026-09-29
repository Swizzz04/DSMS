/**
 * SchoolLogo.jsx — the one place a school logo is rendered.
 *
 * White-label rule: a school's own uploaded logo (Settings → School Info →
 * Branding, stored as `logoUrl` in almirene_website_content) always wins.
 * Until the school finishes the New School Setup wizard and uploads one —
 * or if the uploaded file fails to load — the ALMIRENE DX mark is shown
 * instead, so there is never a broken-image icon.
 *
 * Props
 *   src      custom logo URL (empty/undefined → default ALMIRENE mark)
 *   alt      alt text
 *   size     'lg' (default) | 'sm' — 'sm' uses the thicker-stroke mark so it
 *            stays readable at avatar sizes (about 60px wide or less)
 *   surface  'theme' (default) — the surface follows light/dark mode
 *            'light' — the surface is always light (white avatar circle,
 *            printed receipts), so the dark-stroke mark is always used
 *   style, className — passed straight to the <img>
 *
 * Asset naming: "light" = dark strokes for light surfaces,
 *               "dark"  = white strokes for dark surfaces.
 */
import { useState, useEffect } from 'react'
import { useTheme } from '../context/ThemeContext'

import markLight   from '../assets/brand/almirene-mark-light.png'
import markDark    from '../assets/brand/almirene-mark-dark.png'
import markLightSm from '../assets/brand/almirene-mark-light-sm.png'
import markDarkSm  from '../assets/brand/almirene-mark-dark-sm.png'

const MARKS = {
  lg: { light: markLight,   dark: markDark   },
  sm: { light: markLightSm, dark: markDarkSm },
}

export default function SchoolLogo({
  src,
  alt = 'School Logo',
  size = 'lg',
  surface = 'theme',
  style,
  className,
}) {
  const { theme } = useTheme()
  const [failed, setFailed] = useState(false)

  // A new src (e.g. the school just uploaded a logo) gets a fresh attempt
  useEffect(() => { setFailed(false) }, [src])

  const useCustom = Boolean(src) && !failed
  const variant   = surface === 'light' ? 'light' : (theme === 'dark' ? 'dark' : 'light')
  const resolved  = useCustom ? src : (MARKS[size] || MARKS.lg)[variant]

  return (
    <img
      src={resolved}
      alt={alt}
      className={className}
      style={style}
      onError={() => { if (useCustom) setFailed(true) }}
    />
  )
}
