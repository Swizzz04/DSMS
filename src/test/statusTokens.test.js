/**
 * statusTokens.test.js — guards Step 4.3 (palette classes -> CSS-variable tokens).
 *
 * 1. Every status token exists in index.css, and the ones that must change in dark
 *    mode are overridden in the .dark block.
 * 2. Files already cleaned in 4.3 contain no Tailwind palette classes or hex colours
 *    (comments are ignored). Add a file to CLEAN_FILES when its round is done.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SRC = resolve(__dirname, '..')
const read = (rel) => readFileSync(resolve(SRC, rel), 'utf8')

const css = read('index.css')
const rootBlock = (css.match(/^:root\s*\{([\s\S]*?)^\}/m) || [])[1] || ''
const darkBlock = (css.match(/^\.dark\s*\{([\s\S]*?)^\}/m) || [])[1] || ''

const defines = (block, name) => new RegExp(`${name}\\s*:`).test(block)

const STATUSES = ['success', 'warning', 'error', 'info']

// Same value in both themes: defined once in :root.
const SHARED_TOKENS = [
  ...STATUSES.map((s) => `--color-${s}`),
  ...STATUSES.map((s) => `--color-${s}-contrast`),
  '--color-error-hover',
  '--color-success-hover',
  '--color-info-hover',
  '--color-warning-hover',
  '--color-cat-teal-solid',
  '--color-cat-indigo-solid',
  '--color-cat-violet-solid',
]

// Must exist in :root AND be overridden in .dark.
const THEMED_TOKENS = [
  ...STATUSES.flatMap((s) => [`--color-${s}-light`, `--color-${s}-border`, `--color-${s}-text`]),
  ...['pending', 'approved', 'rejected', 'payment'].flatMap((s) => [
    `--color-${s}-bg`, `--color-${s}-text`, `--color-${s}-border`,
  ]),
  ...['indigo', 'purple', 'teal', 'orange', 'violet', 'pink'].flatMap((c) => [
    `--color-cat-${c}-bg`, `--color-cat-${c}-text`, `--color-cat-${c}-border`,
  ]),
  '--color-overlay',
  '--color-table-line',
  ...Array.from({ length: 8 }, (_, i) => `--color-chart-${i + 1}`),
]

describe('status tokens in index.css', () => {
  it('finds the :root and .dark blocks', () => {
    expect(rootBlock.length).toBeGreaterThan(500)
    expect(darkBlock.length).toBeGreaterThan(500)
  })

  it.each(SHARED_TOKENS)('%s is defined in :root', (name) => {
    expect(defines(rootBlock, name)).toBe(true)
  })

  it.each(THEMED_TOKENS)('%s is defined in :root and overridden in .dark', (name) => {
    expect(defines(rootBlock, name)).toBe(true)
    expect(defines(darkBlock, name)).toBe(true)
  })
})

// Files whose 4.3 round is finished. All 4.3 files are covered.
const CLEAN_FILES = [
  'components/UIComponents.jsx',
  'components/dashboard/ProfileModal.jsx',
  'components/dashboard/Header.jsx',
  'components/dashboard/NotificationPanel.jsx',
  'components/SchoolComponents.jsx',
  'pages/Dashboard.jsx',
  'pages/Enrollments.jsx',
  'pages/Settings.jsx',
]

const PALETTES =
  'red|green|emerald|amber|yellow|orange|blue|sky|indigo|violet|purple|pink|rose|teal|cyan|lime|gray|slate|zinc|neutral|stone'
const PALETTE_CLASS = new RegExp(
  `\\b(?:bg|text|border|ring|from|to|via|divide|outline|fill|stroke|shadow|placeholder|accent|decoration)-(?:${PALETTES})-\\d{2,3}\\b`
)
const PLAIN_WHITE_BLACK = /\b(?:bg|text|border|ring)-(?:white|black)\b/
const HEX = /#[0-9a-fA-F]{3,8}\b/
const RGB_LITERAL = /rgba?\(\s*\d/

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
}

describe('cleaned files stay free of hardcoded colours', () => {
  it.each(CLEAN_FILES)('%s', (rel) => {
    const code = stripComments(read(rel))
    expect(code.match(PALETTE_CLASS)).toBeNull()
    expect(code.match(PLAIN_WHITE_BLACK)).toBeNull()
    expect(code.match(HEX)).toBeNull()
    expect(code.match(RGB_LITERAL)).toBeNull()
  })
})

describe('receipt paper stays light in dark mode', () => {
  const paper = (css.match(/^\.receipt-paper\s*\{([\s\S]*?)^\}/m) || [])[1] || ''
  it.each(['--color-bg-card', '--color-border', '--color-text-primary', '--color-table-line', '--color-success-text', '--color-error-text'])(
    '%s is pinned inside .receipt-paper', (name) => {
      expect(defines(paper, name)).toBe(true)
    })
})
