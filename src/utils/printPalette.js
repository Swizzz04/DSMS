/**
 * printPalette.js — the colours of printed pages (Statement of Account, and any later print window).
 *
 * A print window is a separate page: it cannot read the app's CSS variables, and it is always printed
 * on white paper. So print colours are defined here, once, instead of being typed as hex values through
 * the print markup. Two kinds of colour:
 *   - Brand colours come from the school (Settings → School Info) and are adjusted to stay readable on
 *     white paper: a very light brand colour (such as the default off-white) is darkened until text in it
 *     can be read, and text on a brand fill uses whichever of black or white reads better.
 *   - Neutrals and status colours (paid, balance due, discount) are fixed here, as paper colours.
 *
 * printPaletteCss(primary, secondary) returns a `:root { --p-... }` block to put in the print window's
 * <style>; the markup then uses var(--p-...) only.
 */
import { readableAgainst, bestTextOn } from './themeInitializer'

const PAPER = '#ffffff'

/** Fixed paper colours: text, rules and panels, plus the status colours. */
export const PRINT_NEUTRALS = {
  ink:      '#111111',
  muted:    '#555555',
  faint:    '#888888',
  rule:     '#dddddd',
  rowRule:  '#eeeeee',
  panel:    '#f7f6f3',
  feeBox:   '#faf8f4',
  feeBoxBorder: '#e2dccf',
}

export const PRINT_STATUS = {
  paid:     { text: '#047857', bg: '#ecfdf5', border: '#10b981' },
  due:      { text: '#b45309', bg: '#fffbeb', border: '#f59e0b' },
  discount: '#b91c1c',
}

/** The palette for a school's brand colours. */
export function buildPrintPalette(primary, secondary) {
  return {
    brand:       readableAgainst(primary, PAPER),     // brand colour as ink on paper (text, rules)
    headFill:    secondary,                           // table header background
    headInk:     bestTextOn(secondary),               // text on that background
    headEdge:    readableAgainst(primary, PAPER),     // keeps a light header fill visible on paper
  }
}

/** CSS variables for the print window, built from a school's brand colours. */
export function printPaletteCss(primary, secondary) {
  const b = buildPrintPalette(primary, secondary)
  const n = PRINT_NEUTRALS
  const s = PRINT_STATUS
  return `:root {
      --p-brand: ${b.brand}; --p-head-fill: ${b.headFill}; --p-head-ink: ${b.headInk}; --p-head-edge: ${b.headEdge};
      --p-ink: ${n.ink}; --p-muted: ${n.muted}; --p-faint: ${n.faint}; --p-rule: ${n.rule}; --p-row-rule: ${n.rowRule};
      --p-panel: ${n.panel}; --p-fee-box: ${n.feeBox}; --p-fee-box-border: ${n.feeBoxBorder};
      --p-paid-text: ${s.paid.text}; --p-paid-bg: ${s.paid.bg}; --p-paid-border: ${s.paid.border};
      --p-due-text: ${s.due.text}; --p-due-bg: ${s.due.bg}; --p-due-border: ${s.due.border};
      --p-discount: ${s.discount};
    }`
}
