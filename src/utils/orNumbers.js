/**
 * orNumbers.js — official receipt (OR) number rules.
 *
 * An OR number identifies exactly one payment, so it must be unique across
 * every recorded payment. Used by the Enrollments fee modal and the Payments
 * record-payment modal.
 */

const norm = s => String(s ?? '').trim().toUpperCase()

const readList = key => {
  try { return JSON.parse(localStorage.getItem(key) || '[]') } catch { return [] }
}

/**
 * True when this OR number is already on any recorded payment: an enrollment
 * payment (almirene_submissions) or a document-fee payment (almirene_documents).
 */
export function isOrNumberUsed(orNumber) {
  const target = norm(orNumber)
  if (!target) return false
  const onEnrollment = readList('almirene_submissions')
    .some(s => (s.paymentHistory || []).some(h => norm(h.orNumber) === target))
  if (onEnrollment) return true
  return readList('almirene_documents').some(d => norm(d.payment?.orNumber) === target)
}

/**
 * A suggested OR number (OR-YYMM-NNNN) that is not used yet. The cashier can
 * overwrite it with the number printed on the paper receipt book.
 */
export function suggestOrNumber() {
  const d      = new Date()
  const prefix = `OR-${String(d.getFullYear()).slice(-2)}${String(d.getMonth() + 1).padStart(2, '0')}-`
  for (let i = 0; i < 25; i++) {
    const candidate = prefix + Math.floor(Math.random() * 9000 + 1000)
    if (!isOrNumberUsed(candidate)) return candidate
  }
  return prefix + String(Date.now()).slice(-6)
}
