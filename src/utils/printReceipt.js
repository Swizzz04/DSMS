/**
 * printReceipt.js — opens ONE receipt in a print window.
 *
 * The popup is a blank document: it has no Tailwind and none of our CSS
 * variables. We carry over the app's stylesheets and the brand colours set on
 * <html>. The popup has no `dark` class, and the receipt paper (.receipt-paper)
 * pins its own light tokens, so a receipt always prints on white.
 *
 * Used by Enrollments, Payments and Reports so all receipts print the same way.
 */

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

/**
 * @param {object}   opts
 * @param {string}   opts.html        innerHTML of the single receipt
 * @param {string}   [opts.title]     window title (student name etc.)
 * @param {string}   [opts.rootVars]  extra CSS custom properties, e.g. '--color-primary:#123456;'
 * @param {Function} [opts.onBlocked] called when the browser blocks the popup
 * @returns {boolean} true when the print window opened
 */
export function printReceiptHtml({ html, title = 'Receipt', rootVars = '', onBlocked } = {}) {
  if (!html) return false
  const appStyles = [...document.querySelectorAll('link[rel="stylesheet"], style')].map(n => n.outerHTML).join('\n')
  const rootStyle = esc((document.documentElement.getAttribute('style') || '') + ';' + rootVars)
  const w = window.open('', '_blank', 'width=560,height=900')
  if (!w) { onBlocked?.(); return false }
  w.document.write(`<!DOCTYPE html><html style="${rootStyle}"><head><meta charset="utf-8"><title>${esc(title)}</title>
    ${appStyles}
    <style>
      html, body { background: #fff; }
      body { margin: 0; font-family: Georgia, serif; font-size: 13px; }
      .print-page { max-width: 480px; margin: 0 auto; padding: 16px; }
      @page { margin: 10mm; }
      @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
    </style></head><body>
    <div class="print-page">${html}</div>
    <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 800); }<\/script>
    </body></html>`)
  w.document.close()
  return true
}
