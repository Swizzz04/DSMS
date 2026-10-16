/**
 * documentTemplates.js — ALMIRENE DX document formats (Document Requests → Formats / Print)
 *
 * A "format" is a PDF or image the registrar uploaded for one document type
 * (for example Good Moral Certificate), plus the places on that page where the
 * request's details go (name, grade level, purpose, date...). Set it up once;
 * every request of that type is then filled in and ready to print.
 *
 * Swap the localStorage calls for API calls when the ASP.NET backend is ready.
 *
 * localStorage key:  almirene_document_templates
 * Event:             almirene_document_templates_updated
 *
 * Shape:
 *   { [campusKey]: { [department]: { [documentTypeId]: template } } }
 *
 * template = {
 *   documentType, documentLabel, fileName,
 *   image,                  // the page as a JPEG data URL
 *   pageWidthPt, pageHeightPt,
 *   fontFamily,             // 'serif' | 'sans'
 *   fields: [{ id, key, x, y, w, fontPt, bold, align }],
 *     // x, y, w are fractions (0–1) of the page width / height.
 *     // x = left edge of the box, y = vertical centre of the line.
 *   updatedAt, updatedBy
 * }
 */

import { DOCUMENT_FORMAT_FIELDS } from '../config/appConfig'

const KEY   = 'almirene_document_templates'
const EVENT = 'almirene_document_templates_updated'

const FIELD_KEYS = new Set(DOCUMENT_FORMAT_FIELDS.map(f => f.key))
const ALIGNS     = ['left', 'center', 'right']
const FONTS      = ['serif', 'sans']

// ── Storage ─────────────────────────────────────────────────────

function loadAll() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {} }
  catch { return {} }
}

function saveAll(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    throw new Error('Browser storage is full. Remove a format you no longer use, or upload a smaller file.')
  }
  window.dispatchEvent(new CustomEvent(EVENT))
}

const normDept = (d) => (d === 'college' ? 'college' : 'basicEd')

/** Which departments this user may manage formats for. */
export function formatDepartmentsFor(user) {
  if (user?.role === 'registrar_basic')   return ['basicEd']
  if (user?.role === 'registrar_college') return ['college']
  if (user?.role === 'technical_admin')   return ['basicEd', 'college']
  return []
}

function assertCanManage(user, department) {
  if (!formatDepartmentsFor(user).includes(normDept(department))) {
    throw new Error('You are not allowed to change document formats for this department.')
  }
}

// ── Reads ───────────────────────────────────────────────────────

/** One format, or null when none is set up for that document type. */
export function getTemplate(campusKey, department, documentType) {
  return loadAll()?.[campusKey]?.[normDept(department)]?.[documentType] ?? null
}

/** Every format of a campus + department, keyed by document type id. */
export function getTemplates(campusKey, department) {
  return { ...(loadAll()?.[campusKey]?.[normDept(department)] || {}) }
}

// ── Writes ──────────────────────────────────────────────────────

function cleanFields(fields) {
  if (!Array.isArray(fields)) return []
  const seen = new Set()
  return fields.map((f, i) => {
    if (!FIELD_KEYS.has(f.key)) throw new Error('One of the fields is no longer available. Remove it and try again.')
    const num = (v, lo, hi, fallback) => {
      const n = Number(v)
      return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback
    }
    let id = String(f.id || '')
    if (!id || seen.has(id)) id = `f_${Date.now().toString(36)}_${i}`
    seen.add(id)
    return {
      id,
      key:    f.key,
      x:      num(f.x, 0, 1, 0.1),
      y:      num(f.y, 0, 1, 0.1),
      w:      num(f.w, 0.02, 1, 0.3),
      fontPt: num(f.fontPt, 6, 72, 12),
      bold:   !!f.bold,
      align:  ALIGNS.includes(f.align) ? f.align : 'left',
    }
  })
}

/**
 * Save (create or replace) the format of one document type.
 * @param {object} data { campusKey, department, documentType, documentLabel, fileName,
 *                        image, pageWidthPt, pageHeightPt, fontFamily, fields }
 * @param {object} user  registrar of that department (or technical admin)
 */
export function saveTemplate(data, user) {
  const dept = normDept(data.department)
  assertCanManage(user, dept)
  if (!data.campusKey)    throw new Error('Campus is missing.')
  if (!data.documentType) throw new Error('Document type is missing.')
  if (!data.image || !String(data.image).startsWith('data:image/')) throw new Error('Upload the format file first.')
  if (!(Number(data.pageWidthPt) > 0) || !(Number(data.pageHeightPt) > 0)) throw new Error('The page size is missing.')

  const template = {
    documentType:  data.documentType,
    documentLabel: String(data.documentLabel || data.documentType),
    fileName:      String(data.fileName || ''),
    image:         data.image,
    pageWidthPt:   Number(data.pageWidthPt),
    pageHeightPt:  Number(data.pageHeightPt),
    fontFamily:    FONTS.includes(data.fontFamily) ? data.fontFamily : 'serif',
    fields:        cleanFields(data.fields),
    updatedAt:     new Date().toISOString(),
    updatedBy:     user?.name ?? '',
  }

  const all = loadAll()
  all[data.campusKey] = {
    ...(all[data.campusKey] || {}),
    [dept]: { ...(all[data.campusKey]?.[dept] || {}), [data.documentType]: template },
  }
  saveAll(all)
  return template
}

/** Remove the format of one document type. */
export function removeTemplate(campusKey, department, documentType, user) {
  const dept = normDept(department)
  assertCanManage(user, dept)
  const all = loadAll()
  if (all[campusKey]?.[dept]?.[documentType]) {
    delete all[campusKey][dept][documentType]
    saveAll(all)
  }
}

// ── Filling a request into a format ─────────────────────────────

const ORDINAL_RULES = ['th', 'st', 'nd', 'rd']
export function ordinal(n) {
  const v = n % 100
  return `${n}${ORDINAL_RULES[(v - 20) % 10] || ORDINAL_RULES[v] || ORDINAL_RULES[0]}`
}

const longDate = (d) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

/** "Dela Cruz, Maria" → { first: 'Maria', last: 'Dela Cruz' } */
export function splitStudentName(studentName) {
  const s = String(studentName || '').trim()
  const i = s.indexOf(',')
  if (i < 0) return { first: s, last: '' }
  return { last: s.slice(0, i).trim(), first: s.slice(i + 1).trim() }
}

/**
 * Every field value for one request.
 * @param {object} request  a document request record
 * @param {object} [ctx]    { now?: Date, schoolName?, preparedBy? }
 * @returns {Object<string,string>} values by field key
 */
export function buildFieldValues(request, ctx = {}) {
  const now = ctx.now instanceof Date ? ctx.now : new Date()
  const { first, last } = splitStudentName(request?.studentName)
  const full  = [first, last].filter(Boolean).join(' ')
  const filed = request?.createdAt ? new Date(request.createdAt) : null
  const money = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  // graduates without a former ID are stored with a generated id; never print that
  const studentId = String(request?.studentId || '')

  return {
    student_name:            full,
    student_name_upper:      full.toUpperCase(),
    student_name_last_first: [last, first].filter(Boolean).join(', ').toUpperCase(),
    student_id:              studentId.startsWith('grad_') ? '' : studentId,
    grade_level:             request?.studentGrade || '',
    year_graduated:          request?.yearGraduated || '',
    document_type:           request?.documentLabel || '',
    purpose:                 request?.purpose || '',
    requestor_name:          request?.requestorName || full,
    date_requested:          filed && !Number.isNaN(filed.getTime()) ? longDate(filed) : '',
    school_year:             request?.schoolYear || '',
    date_today:              longDate(now),
    date_given:              `${ordinal(now.getDate())} day of ${now.toLocaleDateString('en-US', { month: 'long' })}, ${now.getFullYear()}`,
    day_today:               ordinal(now.getDate()),
    month_today:             now.toLocaleDateString('en-US', { month: 'long' }),
    year_today:              String(now.getFullYear()),
    or_number:               request?.payment?.orNumber || '',
    amount_paid:             request?.payment ? money(request.payment.amount) : '',
    school_name:             ctx.schoolName || '',
    campus_name:             request?.campusName || '',
    prepared_by:             ctx.preparedBy || '',
  }
}

/** The values shown in the editor preview. */
export function sampleFieldValues() {
  return Object.fromEntries(DOCUMENT_FORMAT_FIELDS.map(f => [f.key, f.sample]))
}

// ── Printing ────────────────────────────────────────────────────

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const FONT_STACKS = {
  serif: "'Times New Roman', Times, Georgia, serif",
  sans:  "Arial, Helvetica, sans-serif",
}
export const fontStack = (family) => FONT_STACKS[family] || FONT_STACKS.serif

/**
 * Opens the filled page in a print window, at the real page size, with no margins.
 * The window is a blank document with no app styles, so the page carries its own.
 * Printed ink is plain black on the uploaded page — it never follows the app theme.
 * @returns {boolean} true when the window opened
 */
export function printFilledTemplate({ template, values, title = 'Document', onBlocked } = {}) {
  if (!template) return false
  const W = template.pageWidthPt
  const H = template.pageHeightPt
  const fields = (template.fields || []).map(f => {
    const text = values?.[f.key] ?? ''
    if (!text) return ''
    return `<div style="position:absolute;left:${f.x * 100}%;top:${f.y * 100}%;width:${f.w * 100}%;transform:translateY(-50%);` +
      `font-size:${f.fontPt}pt;line-height:1;white-space:nowrap;text-align:${f.align};font-weight:${f.bold ? 700 : 400};` +
      `font-family:${fontStack(template.fontFamily)};color:#000">${esc(text)}</div>`
  }).join('')

  const w = window.open('', '_blank', 'width=900,height=1000')
  if (!w) { onBlocked?.(); return false }
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
    <style>
      @page { size: ${W}pt ${H}pt; margin: 0; }
      html, body { margin: 0; padding: 0; background: #fff; }
      .page { position: relative; width: ${W}pt; height: ${H}pt; overflow: hidden; margin: 0 auto; }
      .page img { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }
      @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
    </style></head><body>
    <div class="page"><img src="${esc(template.image)}" alt="">${fields}</div>
    <script>
      (function () {
        var img = document.querySelector('img');
        function go() { window.print(); setTimeout(function () { window.close(); }, 800); }
        if (img.complete) go(); else img.onload = go;
      })();
    <\/script>
    </body></html>`)
  w.document.close()
  return true
}
