/**
 * orNumbers.js — official receipt (OR) number rules.
 *
 * An OR number identifies exactly one payment, so it must be unique across
 * every recorded payment. Used by the Enrollments fee modal and the Payments
 * record-payment modal.
 */

const norm = s => String(s ?? '').trim().toUpperCase()

/** True when this OR number is already on any recorded payment. */
export function isOrNumberUsed(orNumber) {
  const target = norm(orNumber)
  if (!target) return false
  try {
    const subs = JSON.parse(localStorage.getItem('almirene_submissions') || '[]')
    return subs.some(s => (s.paymentHistory || []).some(h => norm(h.orNumber) === target))
  } catch { return false }
}
