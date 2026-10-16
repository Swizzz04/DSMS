/**
 * FilledPage.jsx — ALMIRENE DX
 * Renders an uploaded document format with its fields placed on top.
 * Used by the Formats editor (draggable fields) and by the Print preview.
 *
 * Sizing uses CSS container units (cqw = 1% of the page width), so the page and
 * its text scale together on any screen and match the printed result.
 */

import { fontStack } from '../../utils/documentTemplates'

/** Position + size of one field box, as fractions of the page. */
export function fieldBoxStyle(field, template) {
  return {
    position: 'absolute',
    left:  `${field.x * 100}%`,
    top:   `${field.y * 100}%`,
    width: `${field.w * 100}%`,
    transform: 'translateY(-50%)',
    fontSize: `${(field.fontPt / template.pageWidthPt) * 100}cqw`,
    lineHeight: 1,
    whiteSpace: 'nowrap',
    textAlign: field.align,
    fontWeight: field.bold ? 700 : 400,
    fontFamily: fontStack(template.fontFamily),
    color: 'var(--color-text-primary)',
  }
}

/**
 * @param {object}   template    { image, pageWidthPt, pageHeightPt, fontFamily, fields }
 * @param {object}   values      field key → text (used by the default field renderer)
 * @param {function} renderField optional (field, style) → node, for the editor
 * @param {function} onPageRef   optional ref callback for the page element (editor drag maths)
 */
export default function FilledPage({ template, values = {}, renderField, onPageRef, onPagePointerDown }) {
  if (!template) return null
  return (
    <div className="receipt-paper rounded-lg overflow-hidden border border-[var(--color-border)]">
      <div
        ref={onPageRef}
        onPointerDown={onPagePointerDown}
        className="relative w-full select-none"
        style={{
          containerType: 'inline-size',
          aspectRatio: `${template.pageWidthPt} / ${template.pageHeightPt}`,
        }}
      >
        <img
          src={template.image}
          alt=""
          draggable={false}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />
        {(template.fields || []).map(f => {
          const style = fieldBoxStyle(f, template)
          if (renderField) return renderField(f, style)
          const text = values[f.key] ?? ''
          return text ? <div key={f.id} style={style}>{text}</div> : null
        })}
      </div>
    </div>
  )
}
