// ============================================================
// ALMIRENE DX PUBLIC WEBSITE — THEME SYNC
// style.css defines --red/--gold/--red-rgb/--gold-rgb (etc.) as static
// neutral defaults so the site never looks broken with no JS, and never
// shows one school's brand colors on another's site. This script
// overrides them at runtime from the school's own admin-configured
// brand colors (almirene_website_content.primaryColor/secondaryColor),
// the same source the admin portal itself uses. Loaded early, before
// paint, so there's no flash of the default colors.
//
// The *-rgb triplets exist so rgba(var(--red-rgb), .08)-style overlays
// (shadows, hover tints, section backgrounds) can be theme-driven too —
// a plain rgba(117,0,20,.08) literal can't be overridden by CSS
// variables at all, which was the root cause of overlays/tints staying
// on the old brand color even after the named --red/--gold vars updated.
//
// Self-contained (no build step / bundler on this static site), so
// this duplicates the small amount of color math themeInitializer.js
// already has on the admin side, rather than importing it.
// ============================================================
(function () {
  'use strict';

  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const num = parseInt(full, 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  }

  function toHex(r, g, b) {
    const c = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
    return '#' + c(r) + c(g) + c(b);
  }

  function darken(hex, amount) {
    const { r, g, b } = hexToRgb(hex);
    return toHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
  }

  function lighten(hex, amount) {
    const { r, g, b } = hexToRgb(hex);
    return toHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
  }

  function isValidHex(v) {
    return typeof v === 'string' && /^#[0-9a-fA-F]{3,6}$/.test(v.trim());
  }

  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem('almirene_website_content') || '{}');
  } catch (e) { saved = {}; }

  const primary   = isValidHex(saved.primaryColor)   ? saved.primaryColor.trim()   : null;
  const secondary = isValidHex(saved.secondaryColor) ? saved.secondaryColor.trim() : null;

  if (!primary && !secondary) return; // nothing configured yet — keep the defaults as-is

  const root = document.documentElement.style;

  if (primary) {
    const { r, g, b } = hexToRgb(primary);
    root.setProperty('--red', primary);
    root.setProperty('--red-dark', darken(primary, 0.38));
    root.setProperty('--red-mid', darken(primary, 0.15));
    root.setProperty('--red-rgb', `${r} ${g} ${b}`);
    root.setProperty('--shadow-sm', `0 2px 12px rgba(${r},${g},${b},.08)`);
    root.setProperty('--shadow-md', `0 8px 32px rgba(${r},${g},${b},.13)`);
    root.setProperty('--shadow-lg', `0 20px 60px rgba(${r},${g},${b},.16)`);
  }

  if (secondary) {
    const { r, g, b } = hexToRgb(secondary);
    root.setProperty('--gold', secondary);
    root.setProperty('--gold-light', lighten(secondary, 0.3));
    root.setProperty('--gold-rgb', `${r} ${g} ${b}`);
  }
})();
