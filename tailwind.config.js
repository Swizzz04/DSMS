/** @type {import('tailwindcss').Config} */

// Tailwind color helper: supports both plain utilities (bg-primary) and
// opacity-modified utilities (bg-primary/10, border-primary/40, etc).
// Requires a companion "--color-X-rgb" CSS variable holding a space-separated
// RGB triplet (e.g. "244 250 252") — set in index.css and, at runtime, in
// src/utils/themeInitializer.js's applyTheme().
function cssVarColor(varName, rgbVarName) {
  return ({ opacityValue }) =>
    opacityValue !== undefined
      ? `rgba(var(${rgbVarName}), ${opacityValue})`
      : `var(${varName})`
}

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Enable dark mode using a CSS class
  theme: {
    extend: {
      colors: {
        // ── Brand colors — READ FROM CSS VARIABLES, never hardcode a hex
        // here. These are set dynamically by src/utils/themeInitializer.js
        // from each school's almirene_website_content config (falling back
        // to the SaaS-neutral defaults in index.css if unconfigured).
        // See PROJECT_STATUS.md / Rev.13 docs Section 20.6 — this file was
        // previously pinning 'primary'/'secondary'/'accent-burgundy' to
        // literal CSHC hex values, silently overriding every CSS-variable
        // fix elsewhere in the app regardless of configured brand color.
        'primary':        cssVarColor('--color-primary',   '--color-primary-rgb'),
        'secondary':      cssVarColor('--color-secondary', '--color-secondary-rgb'),
        'light-secondary': 'var(--color-secondary-light)',
      },
    },
  },
  plugins: [],
}
