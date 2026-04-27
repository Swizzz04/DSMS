/**
 * ColorPicker.jsx
 * ─────────────────────────────────────────────────────────────────
 * Custom draggable color picker — replaces native browser picker.
 * Features: saturation/brightness canvas, hue slider, hex input, presets.
 * Portal-rendered so it works inside modals without clipping.
 * Debounced onChange — smooth dragging without lag.
 *
 * Usage:
 *   <ColorPicker value="#f97316" onChange={setColor} label="Campus Color" />
 * ─────────────────────────────────────────────────────────────────
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'

// ── Color conversion helpers ─────────────────────────────────
function hexToHSV(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + 6) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
  }
  const s = max === 0 ? 0 : d / max
  return { h, s, v: max }
}

function hsvToHex(h, s, v) {
  const c = v * s
  const x = c * (1 - Math.abs((h / 60) % 2 - 1))
  const m = v - c
  let r = 0, g = 0, b = 0
  if (h < 60)       { r = c; g = x }
  else if (h < 120) { r = x; g = c }
  else if (h < 180) { g = c; b = x }
  else if (h < 240) { g = x; b = c }
  else if (h < 300) { r = x; b = c }
  else              { r = c; b = x }
  const toHex = (n) => Math.round((n + m) * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function hueToHex(h) {
  return hsvToHex(h, 1, 1)
}

// ── Additional format converters ─────────────────────────────
function hexToRGB(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  }
}

function rgbToHex(r, g, b) {
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)))
  return '#' + [r, g, b].map(v => clamp(v).toString(16).padStart(2, '0')).join('')
}

function hexToHSL(hex) {
  const { r: r8, g: g8, b: b8 } = hexToRGB(hex)
  const r = r8 / 255, g = g8 / 255, b = b8 / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0, s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = ((g - b) / d + 6) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) }
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs((h / 60) % 2 - 1))
  const m = l - c / 2
  let r = 0, g = 0, b = 0
  if (h < 60)       { r = c; g = x }
  else if (h < 120) { r = x; g = c }
  else if (h < 180) { g = c; b = x }
  else if (h < 240) { g = x; b = c }
  else if (h < 300) { r = x; b = c }
  else              { r = c; b = x }
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255)
}

const COLOR_MODES = ['HEX', 'RGB', 'HSL', 'HSV']

const PRESETS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#10b981', '#3b82f6', '#6366f1', '#8b5cf6',
  '#a855f7', '#ec4899', '#750014', '#080c42',
]

export default function ColorPicker({ value = '#6b7280', onChange, label, className = '' }) {
  const hsv = hexToHSV(value)
  const [hue, setHue] = useState(hsv.h)
  const [sat, setSat] = useState(hsv.s)
  const [bright, setBright] = useState(hsv.v)
  const [hexInput, setHexInput] = useState(value)
  const [open, setOpen] = useState(false)
  const [colorMode, setColorMode] = useState('HEX')
  const [dragging, setDragging] = useState(null) // 'sv' | 'hue' | null
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 })

  const triggerRef = useRef(null)
  const panelRef = useRef(null)
  const svRef = useRef(null)
  const hueRef = useRef(null)
  const rafRef = useRef(null)
  const pendingColor = useRef(value)

  // Sync from external value changes
  useEffect(() => {
    if (!dragging) {
      const h = hexToHSV(value)
      setHue(h.h); setSat(h.s); setBright(h.v)
      setHexInput(value)
    }
  }, [value, dragging])

  // Debounced emit — fires onChange at most once per animation frame
  const emitColor = useCallback((hex) => {
    pendingColor.current = hex
    if (rafRef.current) return
    rafRef.current = requestAnimationFrame(() => {
      onChange?.(pendingColor.current)
      rafRef.current = null
    })
  }, [onChange])

  // Update color from HSV
  const updateFromHSV = useCallback((h, s, v) => {
    const hex = hsvToHex(h, s, v)
    setHexInput(hex)
    emitColor(hex)
  }, [emitColor])

  // Position dropdown
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const panelH = 380
    const spaceBelow = window.innerHeight - rect.bottom
    const goUp = spaceBelow < panelH && rect.top > panelH
    setDropPos({
      top: goUp ? rect.top - panelH - 4 + window.scrollY : rect.bottom + 6 + window.scrollY,
      left: Math.max(8, Math.min(rect.left + window.scrollX, window.innerWidth - 308)),
    })
  }, [])

  // Close on click outside
  useEffect(() => {
    if (!open) return
    updatePosition()
    const handleClick = (e) => {
      if (triggerRef.current?.contains(e.target)) return
      if (panelRef.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [open, updatePosition])

  // ── SV panel drag ──────────────────────────────────────────
  const handleSVMove = useCallback((clientX, clientY) => {
    if (!svRef.current) return
    const rect = svRef.current.getBoundingClientRect()
    const s = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const v = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height))
    setSat(s); setBright(v)
    updateFromHSV(hue, s, v)
  }, [hue, updateFromHSV])

  // ── Hue slider drag ───────────────────────────────────────
  const handleHueMove = useCallback((clientX) => {
    if (!hueRef.current) return
    const rect = hueRef.current.getBoundingClientRect()
    const h = Math.max(0, Math.min(360, (clientX - rect.left) / rect.width * 360))
    setHue(h)
    updateFromHSV(h, sat, bright)
  }, [sat, bright, updateFromHSV])

  // Global mouse move/up handlers
  useEffect(() => {
    if (!dragging) return
    const handleMove = (e) => {
      e.preventDefault()
      if (dragging === 'sv') handleSVMove(e.clientX, e.clientY)
      if (dragging === 'hue') handleHueMove(e.clientX)
    }
    const handleUp = () => setDragging(null)

    // Touch support
    const handleTouchMove = (e) => {
      e.preventDefault()
      const t = e.touches[0]
      if (dragging === 'sv') handleSVMove(t.clientX, t.clientY)
      if (dragging === 'hue') handleHueMove(t.clientX)
    }

    document.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseup', handleUp)
    document.addEventListener('touchmove', handleTouchMove, { passive: false })
    document.addEventListener('touchend', handleUp)
    return () => {
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseup', handleUp)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleUp)
    }
  }, [dragging, handleSVMove, handleHueMove])

  // Cleanup RAF on unmount
  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }, [])

  const panel = open && createPortal(
    <div
      ref={panelRef}
      className="fixed z-[9999] bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl shadow-lg p-4 animate-fade-in"
      style={{ top: dropPos.top, left: dropPos.left, width: 300, position: 'absolute' }}
    >
      {/* Saturation/Brightness panel */}
      <div
        ref={svRef}
        className="relative w-full rounded-xl overflow-hidden cursor-crosshair select-none"
        style={{ height: 160, background: `linear-gradient(to right, #fff, ${hueToHex(hue)})` }}
        onMouseDown={(e) => { setDragging('sv'); handleSVMove(e.clientX, e.clientY) }}
        onTouchStart={(e) => { setDragging('sv'); const t = e.touches[0]; handleSVMove(t.clientX, t.clientY) }}
      >
        {/* Black overlay (top to bottom) */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent, #000)' }} />
        {/* Cursor */}
        <div
          className="absolute w-4 h-4 rounded-full border-2 border-white shadow-md pointer-events-none"
          style={{
            left: `${sat * 100}%`, top: `${(1 - bright) * 100}%`,
            transform: 'translate(-50%, -50%)',
            backgroundColor: hsvToHex(hue, sat, bright),
          }}
        />
      </div>

      {/* Hue slider */}
      <div
        ref={hueRef}
        className="relative w-full h-4 rounded-full mt-3 cursor-pointer select-none"
        style={{ background: 'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)' }}
        onMouseDown={(e) => { setDragging('hue'); handleHueMove(e.clientX) }}
        onTouchStart={(e) => { setDragging('hue'); handleHueMove(e.touches[0].clientX) }}
      >
        <div
          className="absolute w-4 h-4 rounded-full border-2 border-white shadow-md pointer-events-none"
          style={{
            left: `${(hue / 360) * 100}%`, top: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: hueToHex(hue),
          }}
        />
      </div>

      {/* Color values — mode toggle */}
      <div className="mt-3 space-y-2">
        {/* Mode tabs */}
        <div className="flex items-center gap-1">
          <div className="w-9 h-9 rounded-lg border border-[var(--color-border)] flex-shrink-0" style={{ backgroundColor: hexInput }} />
          <div className="flex-1 flex bg-[var(--color-bg-subtle)] rounded-lg p-0.5">
            {COLOR_MODES.map(mode => (
              <button key={mode} type="button" onClick={() => setColorMode(mode)}
                className={`flex-1 text-[10px] font-semibold py-1.5 rounded-md transition ${
                  colorMode === mode ? 'bg-[var(--color-bg-card)] text-[var(--color-text-primary)] shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]'
                }`}
              >{mode}</button>
            ))}
          </div>
        </div>

        {/* HEX mode */}
        {colorMode === 'HEX' && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-[var(--color-text-muted)] w-6">HEX</span>
            <input type="text" value={hexInput}
              onChange={e => {
                const v = e.target.value
                setHexInput(v)
                if (/^#[0-9a-fA-F]{6}$/.test(v)) {
                  const h = hexToHSV(v)
                  setHue(h.h); setSat(h.s); setBright(h.v)
                  emitColor(v)
                }
              }}
              onBlur={() => { if (!/^#[0-9a-fA-F]{6}$/.test(hexInput)) setHexInput(value) }}
              maxLength={7}
              className="flex-1 px-3 py-1.5 text-xs font-mono border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition"
            />
          </div>
        )}

        {/* RGB mode */}
        {colorMode === 'RGB' && (() => {
          const rgb = hexToRGB(hexInput)
          const updateRGB = (key, val) => {
            const n = Math.max(0, Math.min(255, parseInt(val) || 0))
            const newRgb = { ...rgb, [key]: n }
            const hex = rgbToHex(newRgb.r, newRgb.g, newRgb.b)
            const h = hexToHSV(hex)
            setHue(h.h); setSat(h.s); setBright(h.v); setHexInput(hex)
            emitColor(hex)
          }
          return (
            <div className="flex items-center gap-2">
              {[['R', 'r', rgb.r], ['G', 'g', rgb.g], ['B', 'b', rgb.b]].map(([label, key, val]) => (
                <div key={key} className="flex-1">
                  <span className="text-[10px] font-semibold text-[var(--color-text-muted)]">{label}</span>
                  <input type="number" min={0} max={255} value={val}
                    onChange={e => updateRGB(key, e.target.value)}
                    className="w-full px-2 py-1.5 text-xs font-mono border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition text-center"
                  />
                </div>
              ))}
            </div>
          )
        })()}

        {/* HSL mode */}
        {colorMode === 'HSL' && (() => {
          const hsl = hexToHSL(hexInput)
          const updateHSL = (key, val) => {
            const max = key === 'h' ? 360 : 100
            const n = Math.max(0, Math.min(max, parseInt(val) || 0))
            const newHsl = { ...hsl, [key]: n }
            const hex = hslToHex(newHsl.h, newHsl.s, newHsl.l)
            const h = hexToHSV(hex)
            setHue(h.h); setSat(h.s); setBright(h.v); setHexInput(hex)
            emitColor(hex)
          }
          return (
            <div className="flex items-center gap-2">
              {[['H', 'h', hsl.h, '°'], ['S', 's', hsl.s, '%'], ['L', 'l', hsl.l, '%']].map(([label, key, val, unit]) => (
                <div key={key} className="flex-1">
                  <span className="text-[10px] font-semibold text-[var(--color-text-muted)]">{label}</span>
                  <div className="relative">
                    <input type="number" min={0} max={key === 'h' ? 360 : 100} value={val}
                      onChange={e => updateHSL(key, e.target.value)}
                      className="w-full px-2 py-1.5 text-xs font-mono border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition text-center pr-5"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-[var(--color-text-muted)]">{unit}</span>
                  </div>
                </div>
              ))}
            </div>
          )
        })()}

        {/* HSV mode */}
        {colorMode === 'HSV' && (() => {
          const updateHSV = (key, val) => {
            const max = key === 'h' ? 360 : 100
            const n = Math.max(0, Math.min(max, parseInt(val) || 0))
            let newH = hue, newS = sat, newV = bright
            if (key === 'h') newH = n
            if (key === 's') newS = n / 100
            if (key === 'v') newV = n / 100
            setHue(newH); setSat(newS); setBright(newV)
            const hex = hsvToHex(newH, newS, newV)
            setHexInput(hex)
            emitColor(hex)
          }
          return (
            <div className="flex items-center gap-2">
              {[['H', 'h', Math.round(hue), '°'], ['S', 's', Math.round(sat * 100), '%'], ['V', 'v', Math.round(bright * 100), '%']].map(([label, key, val, unit]) => (
                <div key={key} className="flex-1">
                  <span className="text-[10px] font-semibold text-[var(--color-text-muted)]">{label}</span>
                  <div className="relative">
                    <input type="number" min={0} max={key === 'h' ? 360 : 100} value={val}
                      onChange={e => updateHSV(key, e.target.value)}
                      className="w-full px-2 py-1.5 text-xs font-mono border border-[var(--color-border)] rounded-lg bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition text-center pr-5"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-[var(--color-text-muted)]">{unit}</span>
                  </div>
                </div>
              ))}
            </div>
          )
        })()}
      </div>

      {/* Presets */}
      <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-[var(--color-border)]">
        {PRESETS.map(color => (
          <button key={color} type="button"
            onClick={() => {
              const h = hexToHSV(color)
              setHue(h.h); setSat(h.s); setBright(h.v); setHexInput(color)
              emitColor(color)
            }}
            className={`w-6 h-6 rounded-md transition-transform hover:scale-125 ${value === color ? 'ring-2 ring-offset-1 ring-[var(--color-text-primary)] scale-110' : ''}`}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>
    </div>,
    document.body
  )

  return (
    <div className={`relative ${className}`} ref={triggerRef}>
      {label && <label className="form-label">{label}</label>}
      <button
        type="button"
        onClick={() => { setOpen(v => !v); setTimeout(updatePosition, 0) }}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none hover:border-[var(--color-border-strong)] transition cursor-pointer"
      >
        <div className="w-6 h-6 rounded-lg border border-[var(--color-border)] flex-shrink-0" style={{ backgroundColor: value }} />
        <span className="font-mono text-xs flex-1 text-left">{value}</span>
        <ChevronDown className={`w-4 h-4 text-[var(--color-text-muted)] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {panel}
    </div>
  )
}