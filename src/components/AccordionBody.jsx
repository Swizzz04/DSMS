/**
 * AccordionBody.jsx — smooth expand / collapse for an accordion card's body.
 *
 * Usage (the card header decides `open`; only one card is open at a time):
 *   <AccordionBody open={isOpen}> …card content… </AccordionBody>
 *
 * How it animates
 *   • Pure CSS: the wrapper is a grid whose row goes 0fr ↔ 1fr, plus a fade.
 *     No height measuring, so it works with content of any (changing) size.
 *   • Opening: content mounts collapsed, then expands one frame later.
 *   • Closing: collapses first, then unmounts after the animation — so form
 *     state held by the parent is untouched and nothing stays in the DOM.
 *   • While collapsed the body is `inert`, so hidden fields can't be tabbed to.
 *   • `motion-reduce` users get no animation (the unmount still happens).
 */
import { useState, useEffect } from 'react'

const DURATION_MS = 220   // slightly longer than the 200ms CSS transition

export default function AccordionBody({ open, children }) {
  const [mounted, setMounted] = useState(open)   // content is in the DOM
  const [shown,   setShown]   = useState(open)   // expanded styles applied

  useEffect(() => {
    if (open) {
      setMounted(true)
      // Two frames: let the collapsed state paint first so the expand animates
      let id2
      const id1 = requestAnimationFrame(() => { id2 = requestAnimationFrame(() => setShown(true)) })
      return () => { cancelAnimationFrame(id1); cancelAnimationFrame(id2) }
    }
    setShown(false)
    const t = setTimeout(() => setMounted(false), DURATION_MS)
    return () => clearTimeout(t)
  }, [open])

  if (!mounted) return null

  return (
    <div
      inert={!shown}
      className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none ${
        shown ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
      }`}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  )
}
