/**
 * SlidingTabs — page tabs with a clear "you are here" and a sliding marker
 * ─────────────────────────────────────────────────────────────────────────────
 * One marker is measured from the active tab button and moved with a transform, so it glides
 * from tab to tab (and stretches to the new tab's width) instead of jumping.
 *
 * Props
 *   tabs       [{ id, label, icon?, count? }]   icon is a lucide component; count shows as "(n)"
 *   value      id of the active tab
 *   onChange   (id) => void
 *   variant    'underline' (default) — a bar under the tab row, for page sections
 *              'pill'                — a filled pill behind the tab, for compact switchers
 *   size       'md' (default) | 'lg'   — underline only; 'lg' is the roomy Settings bar
 *   className  extra classes for the outer box (for example "mb-4")
 *   ariaLabel  name of the tab list for screen readers
 *
 * How the active tab is emphasised
 *   underline: bold dark label, a soft background, and a thick bar in the selected colour.
 *   pill:      a solid selected-colour pill with contrasting bold text (same look as .is-selected).
 *   The selected colour is --color-selected (follows light and dark mode and the school's brand).
 *
 * Behaviour
 *   - No slide on the first paint, only when the person changes tab.
 *   - Scrolls sideways on a phone; the chosen tab scrolls smoothly into view.
 *   - Re-measures when tabs resize (fonts loading, window resize, labels changing).
 *   - If the marker cannot be measured, the active tab still draws its own marker.
 *   - Honours "reduce motion": the marker then just snaps.
 *   - A tab's width never changes when it becomes bold, so nothing shifts.
 * Colors come from CSS variables only.
 */

import { useRef, useState, useLayoutEffect, useEffect, useCallback } from 'react'

// Motion for the marker. A strong ease-out feels quick to start and settles softly.
const SLIDE = { ms: 300, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }

const BUTTON_SIZE = {
  underline: { md: 'px-4 py-2.5', lg: 'px-3 sm:px-6 py-3 sm:py-4' },
  pill:      { md: 'px-4 py-2',   lg: 'px-4 py-2' },
}

export default function SlidingTabs({
  tabs, value, onChange, variant = 'underline', size = 'md', className = '', ariaLabel = 'Tabs',
}) {
  const scrollRef = useRef(null)
  const trackRef  = useRef(null)
  const btnRefs   = useRef({})
  const [bar, setBar]         = useState(null)    // { left, width } of the active tab, or null
  const [animate, setAnimate] = useState(false)   // false until after the first paint
  const isPill = variant === 'pill'

  const measure = useCallback(() => {
    const el = btnRefs.current[value]
    setBar(el ? { left: el.offsetLeft, width: el.offsetWidth } : null)
  }, [value])

  useLayoutEffect(() => { measure() }, [measure, tabs])

  // Turn the slide on only after the first measurement is painted
  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    const track = trackRef.current
    if (!track || typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(measure)
    ro.observe(track)
    Object.values(btnRefs.current).forEach(b => { if (b) ro.observe(b) })
    return () => ro.disconnect()
  }, [measure, tabs])

  // Keep the chosen tab on screen when the bar scrolls sideways
  useEffect(() => {
    const box = scrollRef.current
    const el  = btnRefs.current[value]
    if (!box || !el) return
    const left  = el.offsetLeft
    const right = left + el.offsetWidth
    const pad   = 24
    if (left - pad < box.scrollLeft) {
      box.scrollTo({ left: Math.max(0, left - pad), behavior: 'smooth' })
    } else if (right + pad > box.scrollLeft + box.clientWidth) {
      box.scrollTo({ left: right + pad - box.clientWidth, behavior: 'smooth' })
    }
  }, [value])

  const outerClass = isPill
    ? 'w-fit max-w-full overflow-x-auto rounded-xl bg-[var(--color-bg-subtle)]'
    : 'overflow-x-auto border-b border-[var(--color-border)]'
  const trackClass = isPill
    ? 'relative flex gap-1 p-1 min-w-max'
    : 'relative flex gap-1 min-w-max'

  // The marker, with the same slide for both looks
  const slide = animate
    ? `transform ${SLIDE.ms}ms ${SLIDE.easing}, width ${SLIDE.ms}ms ${SLIDE.easing}`
    : 'none'

  return (
    <div ref={scrollRef} className={`${outerClass} ${className}`}>
      <div ref={trackRef} role="tablist" aria-label={ariaLabel} className={trackClass}>
        {/* Behind the labels for the pill; the underline sits at the bottom edge */}
        {bar && (
          <span
            aria-hidden="true"
            className={`absolute left-0 pointer-events-none motion-reduce:!transition-none ${
              isPill
                ? 'top-1 bottom-1 rounded-lg bg-[var(--color-selected)] shadow-sm'
                : 'bottom-0 z-20 h-[3px] rounded-t-full bg-[var(--color-selected)]'
            }`}
            style={{ width: bar.width, transform: `translateX(${bar.left}px)`, transition: slide }}
          />
        )}

        {tabs.map(tab => {
          const active = tab.id === value
          const Icon = tab.icon
          const label = (
            <>
              {tab.label}
              {tab.count != null && <span className="ml-1 text-xs opacity-70">({tab.count})</span>}
            </>
          )

          const activeLook = isPill
            ? `text-[var(--color-selected-contrast)] font-semibold ${bar ? '' : 'bg-[var(--color-selected)] shadow-sm'}`
            : `text-[var(--color-text-primary)] font-semibold bg-[var(--color-bg-subtle)] ${bar ? '' : 'shadow-[inset_0_-3px_0_var(--color-selected)]'}`
          const idleLook = 'text-[var(--color-text-muted)] font-medium hover:text-[var(--color-text-primary)]'

          return (
            <button
              key={tab.id}
              ref={el => { btnRefs.current[tab.id] = el }}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(tab.id)}
              className={`relative z-10 flex items-center gap-1.5 text-sm whitespace-nowrap transition-colors duration-200 ${
                isPill ? 'rounded-lg' : 'rounded-t-lg'
              } ${BUTTON_SIZE[variant]?.[size] || BUTTON_SIZE.underline.md} ${active ? activeLook : idleLook}`}
            >
              {Icon && <Icon className={size === 'lg' && !isPill ? 'w-5 h-5' : 'w-4 h-4'} aria-hidden="true" />}
              {/* The bold label is also drawn invisibly, so the tab is always as wide as its bold form */}
              <span className="inline-flex flex-col items-center">
                <span>{label}</span>
                <span aria-hidden="true" className="invisible h-0 overflow-hidden font-semibold select-none">{label}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
