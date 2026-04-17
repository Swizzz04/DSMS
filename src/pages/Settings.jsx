import { useState, useEffect } from 'react'
import {
  Calendar, DollarSign, Building2, GraduationCap,
  Users, Plus, Edit, Palette, Moon, Sun, Check, Save, Receipt,
  X, ChevronDown, ChevronUp, AlertCircle, Info, Trash2, Tag, Percent, BookOpen
} from 'lucide-react'
import { PageSkeleton, useToast, ModalPortal } from '../components/UIComponents'
import { useTheme } from '../context/ThemeContext'
import { useAppConfig } from '../context/AppConfigContext'
import { useAuth } from '../context/AuthContext'
import { DEFAULT_DISCOUNTS, applyDiscountsCascading, FEE_STRUCTURE as DEFAULT_FEE_STRUCTURE, previewCollegeFee, getLoadStatus, ROLE_DEFINITIONS } from '../config/appConfig'
import GroupedSelect from '../components/GroupedSelect'



// ─────────────────────────────────────────────────────────────────────
// CAMPUS-SCOPED STORAGE HELPERS
// Each campus has its own localStorage key so settings never bleed
// between campuses. Format: cshc_campus_cfg_{campusKey}
// ─────────────────────────────────────────────────────────────────────
function getCampusKey(campusName) {
  // Extract a clean key from campus name, e.g. 'Carcar City Campus' → 'Carcar'
  if (!campusName || campusName === 'all') return 'all'
  return campusName.replace(/ (City |)Campus$/i, '').replace(/[^a-zA-Z]/g, '')
}

function loadCampusCfg(campusName) {
  try {
    const key = `cshc_campus_cfg_${getCampusKey(campusName)}`
    return JSON.parse(localStorage.getItem(key) || '{}')
  } catch { return {} }
}

function saveCampusCfg(campusName, updates) {
  try {
    const key = `cshc_campus_cfg_${getCampusKey(campusName)}`
    const existing = loadCampusCfg(campusName)
    localStorage.setItem(key, JSON.stringify({ ...existing, ...updates }))
    return true
  } catch { return false }
}

// ─────────────────────────────────────────────────────────────────────
// DISCOUNTS TAB
// Accounting can add, edit, delete discount types.
// Discounts are stackable and applied cascading (each % on remaining).
// Applies to TUITION FEE ONLY.
// ─────────────────────────────────────────────────────────────────────
function DiscountsTab({ discounts, setDiscounts, userCampus, userRole }) {
  const [editingId,  setEditingId]  = useState(null)
  const [showAdd,    setShowAdd]    = useState(false)
  const [newDiscount, setNewDiscount] = useState({ name: '', description: '', defaultRate: 0, discountType: 'percentage', isActive: true })
  const [errors,     setErrors]     = useState({})
  const [saved,      setSaved]      = useState(false)

  // Preview: show cascading effect with sample tuition
  const SAMPLE_TUITION = 15000
  const activeDiscounts = discounts.filter(d => d.isActive)

  const saveToStorage = (updated) => {
    // Save scoped to this campus — never affects other campuses
    const ok = saveCampusCfg(userCampus, { discounts: updated })
    if (ok) { setSaved(true); setTimeout(() => setSaved(false), 2000) }
  }

  const handleToggle = (id) => {
    const updated = discounts.map(d => d.id === id ? { ...d, isActive: !d.isActive } : d)
    setDiscounts(updated)
    saveToStorage(updated)
  }

  const handleDelete = (id) => {
    const d = discounts.find(x => x.id === id)
    if (!d?.isCustom) return // can't delete system defaults
    const updated = discounts.filter(x => x.id !== id)
    setDiscounts(updated)
    saveToStorage(updated)
  }

  const handleRateChange = (id, rate) => {
    const updated = discounts.map(d => d.id === id ? { ...d, defaultRate: Number(rate) } : d)
    setDiscounts(updated)
  }

  const handleRateSave = (id) => {
    setEditingId(null)
    saveToStorage(discounts)
  }

  const validateNew = () => {
    const e = {}
    if (!newDiscount.name.trim()) e.name = 'Name is required'
    if (newDiscount.discountType === 'percentage') {
      if (newDiscount.defaultRate <= 0 || newDiscount.defaultRate > 100)
        e.rate = 'Rate must be between 1 and 100'
    } else {
      if (newDiscount.defaultRate <= 0)
        e.rate = 'Amount must be greater than 0'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleAdd = () => {
    if (!validateNew()) return
    const created = {
      ...newDiscount,
      id:        `custom_${Date.now()}`,
      type:       newDiscount.discountType,  // 'percentage' | 'fixed'
      appliesTo: 'tuition',
      isCustom:  true,
    }
    const updated = [...discounts, created]
    setDiscounts(updated)
    saveToStorage(updated)
    setShowAdd(false)
    setNewDiscount({ name: '', description: '', defaultRate: 0, discountType: 'percentage', isActive: true })
    setErrors({})
  }

  const php = (n) => `₱${(n||0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`

  // Cascading preview calculation
  const previewResult = applyDiscountsCascading(SAMPLE_TUITION, activeDiscounts.map(d => ({ name: d.name, rate: d.defaultRate, type: d.type || 'percentage' })))

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-[var(--color-bg-card)] rounded-2xl shadow-sm border border-[var(--color-border)]/50 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-[var(--color-text-primary)] flex items-center gap-2">
              <Tag className="w-5 h-5 text-primary"/> Discount Types
              {userCampus && userCampus !== 'all' && (
                <span className="text-xs font-normal bg-primary/10 text-primary dark:bg-primary/20 dark:text-red-300 px-2.5 py-1 rounded-full ml-1">
                  {userCampus}
                </span>
              )}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Discounts for <strong>{userCampus && userCampus !== 'all' ? userCampus : 'this campus'}</strong> only.
              Changes here do not affect other campuses. Applied to tuition fee only, cascading order.
            </p>
          </div>
          <button onClick={() => setShowAdd(v => !v)}
            className="self-start flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-accent-burgundy transition shadow-sm">
            <Plus className="w-4 h-4"/> Add Custom Discount
          </button>
        </div>

        {/* Info box */}
        <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl px-4 py-3">
          <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5"/>
          <div className="text-xs text-blue-700 dark:text-blue-300 space-y-0.5">
            <p><strong>Cascading discounts:</strong> each percentage is applied to the amount remaining after the previous discount.</p>
            <p>Example: ₱15,000 tuition → 35% off = ₱9,750 → then 15% off ₱9,750 = <strong>₱8,287.50 final</strong></p>
          </div>
        </div>
      </div>

      {/* Add custom discount form */}
      {showAdd && (
        <div className="bg-[var(--color-bg-card)] rounded-2xl shadow-sm border-2 border-primary/30 dark:border-primary/20 p-5">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary"/> New Custom Discount
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            {/* Discount Name */}
            <div>
              <label className="form-label">
                Discount Name <span className="text-red-500">*</span>
              </label>
              <input type="text" value={newDiscount.name}
                onChange={e => setNewDiscount(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. ESC, Sports Award..."
                className={`w-full px-3 py-2.5 text-sm border rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none transition
                  ${errors.name ? 'border-red-400' : 'border-[var(--color-border)] focus:border-primary focus:ring-2 focus:ring-primary/20'}`}
              />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
            </div>

            {/* Discount Type toggle + Value */}
            <div>
              <label className="form-label">
                Discount Type &amp; Value <span className="text-red-500">*</span>
              </label>
              {/* Type toggle */}
              <div className="flex rounded-xl overflow-hidden border border-[var(--color-border)] mb-2">
                {[
                  { val: 'percentage', label: '% Rate',       icon: <Percent className="w-3.5 h-3.5"/> },
                  { val: 'fixed',      label: '₱ Fixed Amt',  icon: <DollarSign className="w-3.5 h-3.5"/> },
                ].map(opt => (
                  <button key={opt.val} type="button"
                    onClick={() => setNewDiscount(p => ({ ...p, discountType: opt.val, defaultRate: 0 }))}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition
                      ${newDiscount.discountType === opt.val
                        ? 'bg-primary text-white'
                        : 'bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)]'
                      }`}>
                    {opt.icon} {opt.label}
                  </button>
                ))}
              </div>
              {/* Value input — changes based on type */}
              <div className="relative">
                {newDiscount.discountType === 'percentage'
                  ? <>
                      <input type="number" min="1" max="100" value={newDiscount.defaultRate}
                        onChange={e => setNewDiscount(p => ({ ...p, defaultRate: Number(e.target.value) }))}
                        placeholder="e.g. 15"
                        className={`w-full px-3 py-2.5 pr-8 text-sm border rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none transition
                          ${errors.rate ? 'border-red-400' : 'border-[var(--color-border)] focus:border-primary focus:ring-2 focus:ring-primary/20'}`}
                      />
                      <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"/>
                    </>
                  : <>
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">₱</span>
                      <input type="number" min="1" value={newDiscount.defaultRate}
                        onChange={e => setNewDiscount(p => ({ ...p, defaultRate: Number(e.target.value) }))}
                        placeholder="e.g. 9000"
                        className={`w-full pl-7 pr-3 py-2.5 text-sm border rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none transition
                          ${errors.rate ? 'border-red-400' : 'border-[var(--color-border)] focus:border-primary focus:ring-2 focus:ring-primary/20'}`}
                      />
                    </>
                }
              </div>
              {errors.rate && <p className="text-xs text-red-500 mt-1">{errors.rate}</p>}
              <p className="text-xs text-gray-400 mt-1">
                {newDiscount.discountType === 'percentage'
                  ? 'Percentage deducted from tuition (1–100%)'
                  : 'Fixed amount deducted directly from tuition fee'
                }
              </p>
            </div>

            {/* Description */}
            <div className="sm:col-span-2">
              <label className="form-label">Description (optional)</label>
              <input type="text" value={newDiscount.description}
                onChange={e => setNewDiscount(p => ({ ...p, description: e.target.value }))}
                placeholder="Brief description of who qualifies"
                className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowAdd(false); setErrors({}) }}
              className="btn-cancel" style={{ flex: 'none' }}>
              Cancel
            </button>
            <button onClick={handleAdd}
              className="btn-action flex items-center gap-2" style={{ flex: 'none' }}>
              <Check className="w-4 h-4"/> Add Discount
            </button>
          </div>
        </div>
      )}

      {/* Discount list */}
      <div className="bg-[var(--color-bg-card)] rounded-2xl shadow-sm border border-[var(--color-border)]/50 divide-y divide-[var(--color-border)] overflow-hidden">
        {discounts.length === 0 && (
          <div className="py-12 text-center text-gray-400">
            <Tag className="w-8 h-8 mx-auto mb-2 opacity-30"/>
            <p className="text-sm">No discounts configured yet</p>
          </div>
        )}
        {discounts.map((d, idx) => {
          const isEditing = editingId === d.id
          return (
            <div key={d.id} className={`px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 transition
              ${!d.isActive ? 'opacity-50' : ''}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">{d.name}</p>
                  {d.isCustom && (
                    <span className="text-[10px] px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full font-medium">Custom</span>
                  )}
                  {!d.isActive && (
                    <span className="text-[10px] px-2 py-0.5 bg-[var(--color-bg-subtle)] text-gray-500 rounded-full">Disabled</span>
                  )}
                </div>
                {d.description && <p className="text-xs text-gray-400 mt-0.5">{d.description}</p>}
                <p className="text-xs text-gray-400 mt-0.5">Applies to: <span className="font-medium text-[var(--color-text-secondary)]">tuition fee only</span></p>
              </div>

              {/* Rate editor */}
              <div className="flex items-center gap-3">
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <input type="number" min="1" max="100"
                        value={d.defaultRate}
                        onChange={e => handleRateChange(d.id, e.target.value)}
                        className="w-20 px-2 py-1.5 pr-6 text-sm font-mono border border-primary rounded-lg bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none text-right"
                      />
                      <Percent className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400"/>
                    </div>
                    <button onClick={() => handleRateSave(d.id)}
                      className="p-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition">
                      <Check className="w-3.5 h-3.5"/>
                    </button>
                    <button onClick={() => setEditingId(null)}
                      className="p-1.5 text-gray-400 border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-subtle)] transition">
                      <X className="w-3.5 h-3.5"/>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-primary/10 dark:bg-primary/20 text-primary dark:text-red-300 px-3 py-1.5 rounded-lg">
                      {d.type === 'fixed'
                        ? <><span className="text-sm font-bold font-mono leading-none">₱{(d.defaultRate||0).toLocaleString()}</span></>
                        : <><span className="text-lg font-bold font-mono leading-none">{d.defaultRate}</span><Percent className="w-3.5 h-3.5"/></>
                      }
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${d.type === 'fixed' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'}`}>
                      {d.type === 'fixed' ? 'Fixed' : '%'}
                    </span>
                    <button onClick={() => setEditingId(d.id)}
                      className="p-1.5 text-gray-400 hover:text-primary border border-[var(--color-border)] rounded-lg hover:border-primary hover:bg-primary/5 transition"
                      title="Edit rate">
                      <Edit className="w-3.5 h-3.5"/>
                    </button>
                  </div>
                )}

                {/* Toggle active */}
                <button onClick={() => handleToggle(d.id)}
                  className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${d.isActive ? 'bg-green-500' : 'bg-[var(--color-border-strong)]'}`}
                  title={d.isActive ? 'Click to disable' : 'Click to enable'}>
                  <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${d.isActive ? 'translate-x-5' : 'translate-x-0'}`}/>
                </button>

                {/* Delete — custom only */}
                {d.isCustom && (
                  <button onClick={() => handleDelete(d.id)}
                    className="p-1.5 text-red-400 hover:text-red-600 border border-[var(--color-border)] hover:border-red-400 rounded-lg transition"
                    title="Delete discount">
                    <Trash2 className="w-3.5 h-3.5"/>
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Cascading preview */}
      {activeDiscounts.length > 0 && (() => {
        const SAMPLE_ENROLLMENT = 2500
        const SAMPLE_MISC       = 1800
        return (
          <div className="bg-[var(--color-bg-card)] rounded-2xl shadow-sm border border-[var(--color-border)]/50 p-5">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1 flex items-center gap-2">
              <Percent className="w-4 h-4 text-primary"/> Cascading Discount Preview
            </h3>
            <p className="text-xs text-gray-400 mb-3">
              Sample: tuition ₱{SAMPLE_TUITION.toLocaleString()} + enrollment ₱{SAMPLE_ENROLLMENT.toLocaleString()} + misc ₱{SAMPLE_MISC.toLocaleString()}.
              Discounts apply to <strong className="text-primary">tuition only</strong> — enrollment &amp; misc are fixed charges.
            </p>
            <div className="space-y-1.5">
              {/* Base tuition */}
              <div className="flex justify-between text-xs pb-2 border-b border-[var(--color-border)]">
                <span className="text-gray-500">Base tuition</span>
                <span className="font-mono font-semibold text-[var(--color-text-primary)]">{php(SAMPLE_TUITION)}</span>
              </div>
              {/* Discount steps */}
              {previewResult.breakdown.map((b, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span className="text-[var(--color-text-secondary)]">
                    {i + 1}. {b.name}{' '}
                    <span className="text-gray-400">
                      ({b.type === 'fixed' ? `₱${b.rate.toLocaleString()} fixed` : `${b.rate}% off`})
                    </span>
                  </span>
                  <span className="font-mono text-red-500 dark:text-red-400">- {php(b.deduction)}</span>
                </div>
              ))}
              {/* Tuition after discounts */}
              <div className="flex justify-between text-xs font-semibold pt-1.5 border-t border-[var(--color-border)]">
                <span className="text-[var(--color-text-primary)]">Tuition after discounts</span>
                <span className="font-mono text-primary dark:text-red-400">{php(previewResult.finalAmount)}</span>
              </div>
              {/* Fixed fees — unaffected */}
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>+ Enrollment fee <span className="italic">(fixed)</span></span>
                <span className="font-mono">{php(SAMPLE_ENROLLMENT)}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-400">
                <span>+ Misc fee <span className="italic">(fixed)</span></span>
                <span className="font-mono">{php(SAMPLE_MISC)}</span>
              </div>
              {/* Grand total */}
              <div className="flex justify-between text-sm font-bold pt-2 border-t-2 border-[var(--color-border)] mt-1">
                <span className="text-[var(--color-text-primary)]">Grand Total</span>
                <span className="font-mono text-green-600 dark:text-green-400">
                  {php(previewResult.finalAmount + SAMPLE_ENROLLMENT + SAMPLE_MISC)}
                </span>
              </div>
              <p className="text-[10px] text-gray-400 pt-1">
                Total saved: {php(previewResult.totalDeducted)} off tuition
                {' '}({Math.round(previewResult.totalDeducted / SAMPLE_TUITION * 100)}% of original tuition)
              </p>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// FEE STRUCTURE TAB — full inline editor
// Campus-scoped: accounting sees only their campus fees
// Admin sees all campuses with a campus filter
// ─────────────────────────────────────────────────────────────────────
function FeeInput({ value, onChange, disabled, noPrefix }) {
  return (
    <div className="relative">
      {!noPrefix && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">₱</span>}
      <input
        type="number" min="0" step={noPrefix ? 1 : 100}
        value={value} onChange={e => onChange(Number(e.target.value))}
        disabled={disabled}
        className={`w-full ${noPrefix ? 'px-2' : 'pl-6 pr-2'} py-1.5 text-sm border rounded-lg text-right font-mono
          bg-[var(--color-bg-card)] text-[var(--color-text-primary)] outline-none transition
          ${disabled
            ? 'border-[var(--color-border)] bg-[var(--color-bg-subtle)] text-gray-400 cursor-not-allowed'
            : 'border-[var(--color-border)] focus:border-primary focus:ring-2 focus:ring-primary/20'
          }`}
      />
      {noPrefix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">u</span>}
    </div>
  )
}

function FeeStructureTab({ fees, setFees, campuses, userCampus, userRole, onSave, saved }) {
  const isAccounting  = userRole === 'accounting'
  const isAdmin       = userRole === 'admin' || userRole === 'technical_admin'

  // Campus filter — accounting locked to their campus, admin can switch
  const [campusFilter, setCampusFilter] = useState(
    isAccounting ? (userCampus || 'all') : 'all'
  )
  const [editingId,  setEditingId]  = useState(null)
  const [editBuffer, setEditBuffer] = useState({})
  const [hasChanges, setHasChanges] = useState(false)
  const [expandedGroup, setExpandedGroup] = useState('all')

  // Fee groups for display
  const FEE_GROUPS = [
    { key: 'pre-elem', label: 'Pre-Elementary',    type: 'basic', grades: ['Nursery','Kindergarten','Preparatory'] },
    { key: 'elem',     label: 'Elementary',         type: 'basic', grades: ['Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Grade 6'] },
    { key: 'jhs',      label: 'Junior High School', type: 'basic', grades: ['Grade 7','Grade 8','Grade 9','Grade 10'] },
    { key: 'shs',      label: 'Senior High School', type: 'basic', grades: ['Grade 11','Grade 12'] },
    { key: 'college',  label: 'College',             type: 'college', grades: [] },
  ]

  // Basic ed fee columns — includes books and other fees
  const BASIC_FEE_COLS = [
    { key: 'tuition',    label: 'Tuition'        },
    { key: 'enrollment', label: 'Enrollment Fee' },
    { key: 'misc',       label: 'Misc Fee'       },
    { key: 'lab',        label: 'Lab Fee'        },
    { key: 'books',      label: 'Books'          },
    { key: 'other',      label: 'Other Fees'     },
  ]

  // College rate-based columns (editable rates + fixed fees)
  const COLLEGE_RATE_COLS = [
    { key: 'tuitionRatePerUnit', label: 'Rate/Unit (Tuition)', type: 'rate' },
    { key: 'labRatePerUnit',     label: 'Rate/Unit (Lab)',     type: 'rate' },
    { key: 'typicalUnits',       label: 'Typical Units',       type: 'units' },
    { key: 'typicalLabUnits',    label: 'Typical Lab Units',   type: 'units' },
    { key: 'enrollment',         label: 'Enrollment Fee',      type: 'fixed' },
    { key: 'misc',               label: 'Misc Fee',            type: 'fixed' },
  ]

  // Get the campus object for the current filter
  const activeCampusObj = campusFilter !== 'all'
    ? campuses.find(c => c.name === campusFilter)
    : null

  // Get programs this campus actually offers (from campus config, not just fee entries)
  const campusOfferedPrograms = activeCampusObj
    ? (activeCampusObj.college?.programs ?? activeCampusObj.collegePrograms ?? [])
    : null // null = all campuses (admin)

  // Filter college fees strictly by:
  // 1. Has a program field (is a college fee)
  // 2. Matches campus filter
  // 3. Campus actually offers that program (prevents cross-campus bleed)
  const collegeCampusFees = fees.filter(f => {
    if (!f.program) return false
    if (campusFilter !== 'all' && f.campus !== campusFilter) return false
    if (campusOfferedPrograms && !campusOfferedPrograms.includes(f.program)) return false
    return true
  })
  const collegePrograms = [...new Set(collegeCampusFees.map(f => f.program))]
  const YEAR_LEVELS       = ['1st Year', '2nd Year', '3rd Year', '4th Year']

  // Filter fees by campus
  const visibleFees = fees.filter(f => {
    if (campusFilter === 'all') return true
    return f.campus === 'all' || f.campus === campusFilter
  })

  // Group fees — basic ed groups filter by gradeLevel, college groups filter by program
  const getGroupFees = (group) => {
    if (group.type === 'college') return [] // college handled separately
    return visibleFees.filter(f => !f.program && group.grades.includes(f.gradeLevel))
  }

  const startEdit = (fee) => {
    setEditingId(fee.id)
    setEditBuffer({
      tuition:    fee.tuition    ?? 0,
      enrollment: fee.enrollment ?? 0,
      misc:       fee.misc       ?? 0,
      lab:        fee.lab        ?? 0,
      books:      fee.books      ?? 0,
      other:      fee.other      ?? 0,
    })
  }

  const cancelEdit = () => { setEditingId(null); setEditBuffer({}) }

  const commitEdit = (feeId) => {
    setFees(prev => prev.map(f =>
      f.id === feeId ? { ...f, ...editBuffer } : f
    ))
    setEditingId(null)
    setEditBuffer({})
    setHasChanges(true)
  }

  const bufferTotal = (cols) =>
    cols.reduce((sum, c) => sum + (Number(editBuffer[c.key])||0), 0)

  const feeTotal = (f) =>
    (f.tuition||0) + (f.enrollment||0) + (f.misc||0) + (f.lab||0) + (f.books||0) + (f.other||0)

  const php = (n) => `₱${(n||0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`

  const handleSave = () => { onSave(); setHasChanges(false) }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-[var(--color-bg-card)] rounded-2xl shadow-sm border border-[var(--color-border)]/50 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Fee Structure</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {isAccounting ? 'Manage fees for your campus' : 'Manage fees across all campuses'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Campus filter — admin only */}
            {isAdmin && (
              <GroupedSelect
                value={campusFilter}
                onChange={setCampusFilter}
                allLabel="All Campuses"
                options={campuses.map(c => ({ value: c.name, label: c.name }))}
              />
            )}
            {/* Save button */}
            {hasChanges && (
              <button onClick={handleSave}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-accent-burgundy transition shadow-sm">
                {saved ? <><Check className="w-4 h-4"/>Saved!</> : <><Save className="w-4 h-4"/>Save Changes</>}
              </button>
            )}
            {!hasChanges && saved && (
              <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400 font-medium">
                <Check className="w-4 h-4"/> Up to date
              </span>
            )}
          </div>
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-4 py-3">
          <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5"/>
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Fee changes apply to <strong>new enrollments only</strong>.
            Existing student balances are not affected. Click the edit icon on any row to update fees.
          </p>
        </div>
      </div>

      {/* Fee groups */}
      {FEE_GROUPS.map(group => {
        const groupFees = getGroupFees(group)
        if (groupFees.length === 0) return null
        const isExpanded = expandedGroup === 'all' || expandedGroup === group.key

        return (
          <div key={group.key} className="bg-[var(--color-bg-card)] rounded-2xl shadow-sm border border-[var(--color-border)]/50 overflow-hidden">
            {/* Group header */}
            <button
              onClick={() => setExpandedGroup(isExpanded ? null : group.key)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-[var(--color-bg-subtle)]/40 transition">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-primary"/>
                <span className="font-semibold text-sm text-[var(--color-text-primary)]">{group.label}</span>
                <span className="text-xs text-gray-400 bg-[var(--color-bg-subtle)] px-2 py-0.5 rounded-full">
                  {groupFees.length} level{groupFees.length !== 1 ? 's' : ''}
                </span>
              </div>
              {isExpanded
                ? <ChevronUp className="w-4 h-4 text-gray-400"/>
                : <ChevronDown className="w-4 h-4 text-gray-400"/>
              }
            </button>

            {isExpanded && (
              <div className="border-t border-[var(--color-border)]">
                {/* Mobile: card layout */}
                <div className="block sm:hidden divide-y divide-[var(--color-border)]">
                  {groupFees.map(fee => {
                    const isEditing = editingId === fee.id
                    const cols = group.type === 'college' ? COLLEGE_FEE_COLS : BASIC_FEE_COLS
                    return (
                      <div key={fee.id} className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-[var(--color-text-primary)]">{fee.gradeLevel}</p>
                            {fee.campus !== 'all' && <p className="text-xs text-gray-400">{fee.campus}</p>}
                          </div>
                          {!isEditing ? (
                            <button onClick={() => startEdit(fee)}
                              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-primary/10 text-primary dark:bg-primary/20 dark:text-red-300 rounded-lg hover:bg-primary hover:text-white transition font-medium">
                              <Edit className="w-3 h-3"/> Edit
                            </button>
                          ) : (
                            <div className="flex gap-2">
                              <button onClick={() => commitEdit(fee.id)}
                                className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium">Save</button>
                              <button onClick={cancelEdit}
                                className="text-xs px-2 py-1.5 text-gray-400 border border-[var(--color-border)] rounded-lg transition">
                                <X className="w-3 h-3"/></button>
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {cols.map(({ label, key }) => (
                            <div key={key}>
                              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">{label}</p>
                              {isEditing
                                ? <FeeInput value={editBuffer[key] || 0} onChange={v => setEditBuffer(b => ({ ...b, [key]: v }))}/>
                                : <p className="text-sm font-mono text-[var(--color-text-primary)]">{php(fee[key] || 0)}</p>
                              }
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-[var(--color-border)]">
                          <span className="text-xs text-gray-400">Total</span>
                          <span className="text-sm font-bold text-primary dark:text-red-400">
                            {isEditing ? php(bufferTotal(cols)) : php(feeTotal(fee))}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Desktop: table layout */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-[var(--color-bg-subtle)]/50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                          Grade Level
                        </th>
                        {BASIC_FEE_COLS.map(c => (
                          <th key={c.key} className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">
                            {c.label}
                          </th>
                        ))}
                        <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Total</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)]">
                      {groupFees.map(fee => {
                        const isEditing = editingId === fee.id
                        return (
                          <tr key={fee.id}
                            className={`transition ${isEditing ? 'bg-primary/5 dark:bg-primary/10' : 'hover:bg-[var(--color-bg-subtle)]/30'}`}>
                            <td className="px-4 py-3">
                              <p className="text-sm font-semibold text-[var(--color-text-primary)]">{fee.gradeLevel}</p>
                              {fee.campus !== 'all' && <p className="text-xs text-gray-400">{fee.campus}</p>}
                            </td>
                            {BASIC_FEE_COLS.map(col => (
                              <td key={col.key} className="px-4 py-3">
                                {isEditing
                                  ? <FeeInput value={editBuffer[col.key] || 0} onChange={v => setEditBuffer(b => ({ ...b, [col.key]: v }))}/>
                                  : <span className="text-sm font-mono text-[var(--color-text-secondary)]">{php(fee[col.key] || 0)}</span>
                                }
                              </td>
                            ))}
                            <td className="px-4 py-3">
                              <span className={`text-sm font-bold ${isEditing ? 'text-green-600 dark:text-green-400' : 'text-primary dark:text-red-400'}`}>
                                {isEditing ? php(bufferTotal(BASIC_FEE_COLS)) : php(feeTotal(fee))}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {!isEditing ? (
                                <button onClick={() => startEdit(fee)}
                                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-primary/10 text-primary dark:bg-primary/20 dark:text-red-300 rounded-lg hover:bg-primary hover:text-white transition font-medium">
                                  <Edit className="w-3 h-3"/> Edit
                                </button>
                              ) : (
                                <div className="flex items-center gap-2 justify-end">
                                  <button onClick={() => commitEdit(fee.id)}
                                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium">
                                    <Check className="w-3 h-3"/> Save row
                                  </button>
                                  <button onClick={cancelEdit}
                                    className="p-1.5 text-gray-400 border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-subtle)] transition">
                                    <X className="w-3.5 h-3.5"/>
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* College semester fee tables */}
      {collegePrograms.length > 0 && collegePrograms.map(program => (
        <div key={program} className="bg-[var(--color-bg-card)] rounded-2xl shadow-sm border border-[var(--color-border)]/50 overflow-hidden">
          {/* Program header */}
          <button
            onClick={() => setExpandedGroup(expandedGroup === program ? null : program)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-[var(--color-bg-subtle)]/40 transition">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="w-2 h-2 rounded-full bg-secondary flex-shrink-0"/>
              <span className="font-semibold text-sm text-[var(--color-text-primary)]">{program}</span>
              <span className="text-xs text-gray-400 bg-[var(--color-bg-subtle)] px-2 py-0.5 rounded-full">College · Unit-based</span>
              <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
                Tuition = Rate/Unit × Actual Units
              </span>
            </div>
            {expandedGroup === program
              ? <ChevronUp className="w-4 h-4 text-gray-400"/>
              : <ChevronDown className="w-4 h-4 text-gray-400"/>
            }
          </button>

          {(expandedGroup === program || expandedGroup === 'all') && (
            <div className="mx-5 mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl text-xs text-blue-700 dark:text-blue-300">
              <strong>Unit-based billing:</strong> Tuition = Rate/Unit × units enrolled · Lab = Lab Rate/Unit × lab units enrolled · Enrollment &amp; Misc are fixed.
              <br/>
              <span className="text-blue-600 dark:text-blue-400">
                Regular students use <em>Typical Units</em> as their load. Transferees may be <strong>underload</strong> (fewer units) or <strong>overload</strong> (more units) — same rate applies either way.
              </span>
            </div>
          )}

          {(expandedGroup === program || expandedGroup === 'all') && (
            <div className="border-t border-[var(--color-border)]">
              {/* Year level tabs */}
              {YEAR_LEVELS.map(yr => {
                const sem1 = fees.find(f =>
                  f.program === program && f.yearLevel === yr && f.semester === '1st' &&
                  (campusFilter === 'all' || f.campus === campusFilter) &&
                  (!campusOfferedPrograms || campusOfferedPrograms.includes(f.program))
                )
                const sem2 = fees.find(f =>
                  f.program === program && f.yearLevel === yr && f.semester === '2nd' &&
                  (campusFilter === 'all' || f.campus === campusFilter) &&
                  (!campusOfferedPrograms || campusOfferedPrograms.includes(f.program))
                )
                if (!sem1 && !sem2) return null

                return (
                  <div key={yr} className="border-b border-[var(--color-border)] last:border-0">
                    {/* Year level label */}
                    <div className="px-5 py-2 bg-[var(--color-bg-subtle)]">
                      <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">{yr}</p>
                    </div>

                    {/* Mobile: 2 cards per year level */}
                    <div className="block sm:hidden divide-y divide-[var(--color-border)]">
                      {[{sem: sem1, label:'1st Semester'},{sem: sem2, label:'2nd Semester'}].filter(x=>x.sem).map(({sem, label}) => {
                        const isEditing = editingId === sem.id
                        const preview   = previewCollegeFee(isEditing ? {...sem,...editBuffer} : sem)
                        return (
                          <div key={sem.id} className="p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-semibold text-secondary dark:text-blue-300">{label}</p>
                              {!isEditing
                                ? <button onClick={() => startEdit(sem)} className="text-xs px-3 py-1.5 bg-primary/10 text-primary rounded-lg hover:bg-primary hover:text-white transition font-medium flex items-center gap-1"><Edit className="w-3 h-3"/>Edit</button>
                                : <div className="flex gap-2">
                                    <button onClick={() => commitEdit(sem.id)} className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg">Save</button>
                                    <button onClick={cancelEdit} className="text-xs px-2 py-1.5 border border-[var(--color-border)] rounded-lg text-gray-400"><X className="w-3 h-3"/></button>
                                  </div>
                              }
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {COLLEGE_RATE_COLS.map(({label:l, key, type}) => (
                                <div key={key}>
                                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">{l}</p>
                                  {isEditing
                                    ? <FeeInput value={editBuffer[key]||0} onChange={v => setEditBuffer(b=>({...b,[key]:v}))} prefix={type==='units'?'':undefined}/>
                                    : <p className="text-sm font-mono text-[var(--color-text-primary)]">
                                        {type === 'units' ? (sem[key]||0) : php(sem[key]||0)}
                                      </p>
                                  }
                                </div>
                              ))}
                            </div>
                            {/* Computed preview */}
                            <div className="bg-[var(--color-bg-subtle)] rounded-lg p-3 space-y-1">
                              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Estimated sem total (typical units)</p>
                              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                                <span className="text-gray-500">Tuition ({(isEditing?editBuffer.typicalUnits:sem.typicalUnits)||0} units)</span>
                                <span className="font-mono text-right">{php(preview.tuition)}</span>
                                <span className="text-gray-500">Lab ({(isEditing?editBuffer.typicalLabUnits:sem.typicalLabUnits)||0} units)</span>
                                <span className="font-mono text-right">{php(preview.lab)}</span>
                                <span className="text-gray-500">Enrollment</span>
                                <span className="font-mono text-right">{php(preview.enrollment)}</span>
                                <span className="text-gray-500">Misc</span>
                                <span className="font-mono text-right">{php(preview.misc)}</span>
                              </div>
                              <div className="flex justify-between font-bold text-sm pt-1 border-t border-[var(--color-border)]">
                                <span className="text-secondary dark:text-blue-300">Est. Sem Total</span>
                                <span className="font-mono text-secondary dark:text-blue-300">{php(preview.semTotal ?? preview.total)}</span>
                              </div>
                              {preview.enrollment > 0 && (
                                <div className="flex justify-between text-xs text-amber-500 dark:text-amber-400">
                                  <span>+ Enrollment fee (separate)</span>
                                  <span className="font-mono">{php(preview.enrollment)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                      {sem1 && sem2 && (() => {
                        const p1 = previewCollegeFee(sem1), p2 = previewCollegeFee(sem2)
                        const annualSem = (p1.semTotal ?? p1.total) + (p2.semTotal ?? p2.total)
                        return (
                          <div className="px-4 py-2.5 bg-[var(--color-bg-subtle)]">
                            <div className="flex justify-between">
                              <span className="text-xs text-gray-500 font-medium">Est. annual sem total ({yr})</span>
                              <span className="text-sm font-bold text-primary dark:text-red-400">{php(annualSem)}</span>
                            </div>
                            {(p1.enrollment + p2.enrollment) > 0 && (
                              <div className="flex justify-between text-[10px] text-amber-500 dark:text-amber-400 mt-0.5">
                                <span>+ Enrollment fees (both sems)</span>
                                <span className="font-mono">{php(p1.enrollment + p2.enrollment)}</span>
                              </div>
                            )}
                          </div>
                        )
                      })()}
                    </div>

                    {/* Desktop: side-by-side semesters — rate-based */}
                    <div className="hidden sm:block overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-[var(--color-bg-subtle)]">
                          <tr>
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase">Semester</th>
                            {COLLEGE_RATE_COLS.map(c => (
                              <th key={c.key} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase whitespace-nowrap">{c.label}</th>
                            ))}
                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase whitespace-nowrap">Est. Sem Total</th>
                            <th className="px-4 py-2.5"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border)]">
                          {[{sem: sem1, label:'1st Semester'},{sem: sem2, label:'2nd Semester'}].filter(x=>x.sem).map(({sem, label}) => {
                            const isEditing = editingId === sem.id
                            const cur       = isEditing ? {...sem, ...editBuffer} : sem
                            const preview   = previewCollegeFee(cur)
                            return (
                              <tr key={sem.id} className={`transition ${isEditing ? 'bg-primary/5 dark:bg-primary/10' : 'hover:bg-[var(--color-bg-subtle)]/30'}`}>
                                <td className="px-4 py-3">
                                  <span className="text-xs font-semibold text-secondary dark:text-blue-300">{label}</span>
                                  {sem.campus && <p className="text-xs text-gray-400">{sem.campus}</p>}
                                </td>
                                {COLLEGE_RATE_COLS.map(col => (
                                  <td key={col.key} className="px-4 py-3">
                                    {isEditing
                                      ? <FeeInput
                                          value={editBuffer[col.key] ?? sem[col.key] ?? 0}
                                          onChange={v => setEditBuffer(b => ({...b, [col.key]: v}))}
                                          noPrefix={col.type === 'units'}
                                        />
                                      : <span className="text-sm font-mono text-[var(--color-text-secondary)]">
                                          {col.type === 'units'
                                            ? <span className="text-gray-500">{sem[col.key] ?? 0} <span className="text-xs">units</span></span>
                                            : php(sem[col.key] ?? 0)
                                          }
                                        </span>
                                    }
                                  </td>
                                ))}
                                {/* Estimated sem total — tuition + lab + misc only, enrollment fee excluded */}
                                <td className="px-4 py-3">
                                  <div className={`text-sm font-bold ${isEditing ? 'text-green-600 dark:text-green-400' : 'text-secondary dark:text-blue-300'}`}>
                                    {php(preview.semTotal ?? preview.total)}
                                  </div>
                                  <div className="text-[10px] text-gray-400 mt-0.5 space-y-0.5">
                                    <div>T: {php(preview.tuition)}</div>
                                    <div>L: {php(preview.lab)}</div>
                                    <div>M: {php(preview.misc)}</div>
                                    {preview.enrollment > 0 && (
                                      <div className="text-amber-500 dark:text-amber-400">+Enroll: {php(preview.enrollment)}</div>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  {!isEditing
                                    ? <button onClick={() => startEdit(sem)} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-primary/10 text-primary dark:bg-primary/20 dark:text-red-300 rounded-lg hover:bg-primary hover:text-white transition font-medium"><Edit className="w-3 h-3"/>Edit</button>
                                    : <div className="flex items-center gap-2 justify-end">
                                        <button onClick={() => commitEdit(sem.id)} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"><Check className="w-3 h-3"/>Save row</button>
                                        <button onClick={cancelEdit} className="p-1.5 text-gray-400 border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-subtle)] transition"><X className="w-3.5 h-3.5"/></button>
                                      </div>
                                  }
                                </td>
                              </tr>
                            )
                          })}
                          {/* Annual estimated total row — excludes enrollment fee */}
                          {sem1 && sem2 && (() => {
                            const p1 = previewCollegeFee(sem1)
                            const p2 = previewCollegeFee(sem2)
                            const annualSem    = (p1.semTotal ?? p1.total) + (p2.semTotal ?? p2.total)
                            const annualEnroll = p1.enrollment + p2.enrollment
                            return (
                              <tr className="bg-[var(--color-bg-subtle)]">
                                <td className="px-4 py-2.5 text-xs font-bold text-[var(--color-text-secondary)]" colSpan={COLLEGE_RATE_COLS.length + 1}>
                                  Est. Annual Sem Total ({yr}) <span className="font-normal text-gray-400">— tuition + lab + misc only</span>
                                </td>
                                <td className="px-4 py-2.5">
                                  <div className="text-sm font-bold text-primary dark:text-red-400">{php(annualSem)}</div>
                                  {annualEnroll > 0 && (
                                    <div className="text-[10px] text-amber-500 dark:text-amber-400">+{php(annualEnroll)} enrollment fee</div>
                                  )}
                                </td>
                                <td/>
                              </tr>
                            )
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ))}

      {/* Save footer */}
      <div className="bg-[var(--color-bg-card)] rounded-2xl shadow-sm border border-[var(--color-border)]/50 px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <p className="text-xs text-gray-400">
          {hasChanges
            ? <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400"><AlertCircle className="w-3.5 h-3.5"/> You have unsaved changes</span>
            : 'All fees saved — changes apply to new enrollments only'
          }
        </p>
        <button
          onClick={handleSave}
          disabled={!hasChanges}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl transition shadow-sm
            ${hasChanges
              ? 'bg-primary text-white hover:bg-accent-burgundy'
              : 'bg-[var(--color-bg-subtle)] text-gray-400 cursor-not-allowed'
            }`}>
          {saved && !hasChanges ? <><Check className="w-4 h-4"/>Up to date</> : <><Save className="w-4 h-4"/>Save All Changes</>}
        </button>
      </div>
    </div>
  )
}

export default function Settings() {
  const { user } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const {
    schoolYears, campuses, feeStructure, systemUsers, basicEdGroups,
    updateConfig, resetSection, activeCampuses, currentSchoolYear
  } = useAppConfig()

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 600)
    return () => clearTimeout(t)
  }, [])

  const [activeTab, setActiveTab] = useState(() => user?.role === 'accounting' ? 'fees' : user?.role === 'technical_admin' ? 'users' : 'appearance')

  // Local editable copies — committed to context on Save
  const [editSchoolYears, setEditSchoolYears] = useState(() => schoolYears)
  const [editCampuses,    setEditCampuses]    = useState(() => campuses)
  const [editFees, setEditFees] = useState(() => {
    const saved = feeStructure || []
    // Stale if: has flat BS entries without semester, or missing new entries
    const hasStale =
      saved.some(f => f.gradeLevel?.startsWith('BS') && !f.semester) ||
      saved.length < DEFAULT_FEE_STRUCTURE.length

    // Build safe map: only allow saved entry to override if structures match
    const savedMap = hasStale ? {} : Object.fromEntries(
      saved
        .filter(sf => {
          const def = DEFAULT_FEE_STRUCTURE.find(d => d.id === sf.id)
          return def && !(!sf.semester && def.semester) // block flat→semester collisions
        })
        .map(f => [f.id, f])
    )
    return DEFAULT_FEE_STRUCTURE.map(f => {
      const sv = savedMap[f.id] || {}
      return {
        ...f, ...sv,
        tuition:    sv.tuition    ?? sv.tuitionFee    ?? f.tuition    ?? 0,
        enrollment: sv.enrollment ?? sv.enrollmentFee ?? f.enrollment ?? 0,
        misc:       sv.misc       ?? sv.miscFee       ?? f.misc       ?? 0,
        lab:        sv.lab        ?? f.lab   ?? 0,
        books:      sv.books      ?? f.books ?? 0,
        other:      sv.other      ?? f.other ?? 0,
      }
    })
  })
  const [editUsers,       setEditUsers]       = useState(() => systemUsers)
  const [cashierName,     setCashierName]     = useState(() => {
    try {
      // Load campus-scoped cashier name
      return loadCampusCfg(user?.campus).cashierName || ''
    } catch { return '' }
  })
  const [cashierSaved,    setCashierSaved]    = useState(false)
  const [discounts,       setDiscounts]       = useState(() => {
    try {
      // Load campus-scoped discounts — each campus manages their own
      const campusCfg = loadCampusCfg(user?.campus)
      return campusCfg.discounts || DEFAULT_DISCOUNTS
    } catch { return DEFAULT_DISCOUNTS }
  })
  const [savedSection,    setSavedSection]    = useState(null)

  const saveSection = (section, value) => {
    updateConfig(section, value)
    setSavedSection(section)
    setTimeout(() => setSavedSection(null), 2000)
  }


  // Available color themes
  const colorThemes = [
    { id: 'red', name: 'Classic Red', primary: '#750014', secondary: '#4a0009', color: 'bg-red-700' },
    { id: 'blue', name: 'Ocean Blue', primary: '#1e40af', secondary: '#1e3a8a', color: 'bg-blue-700' },
    { id: 'green', name: 'Emerald Green', primary: '#047857', secondary: '#065f46', color: 'bg-green-700' },
    { id: 'purple', name: 'Royal Purple', primary: '#7c3aed', secondary: '#6d28d9', color: 'bg-purple-600' },
    { id: 'pink', name: 'Rose Pink', primary: '#db2777', secondary: '#be185d', color: 'bg-pink-600' },
    { id: 'orange', name: 'Amber Gold', primary: '#ea580c', secondary: '#c2410c', color: 'bg-orange-600' },
    { id: 'gray', name: 'Graphite', primary: '#475569', secondary: '#334155', color: 'bg-gray-600' },
    { id: 'teal', name: 'Teal', primary: '#0d9488', secondary: '#0f766e', color: 'bg-teal-600' }
  ]

  const [selectedColor, setSelectedColor] = useState('red')

  // Tab configuration
  const isAccounting = user?.role === 'accounting'

  const allTabs = [
    { id: 'appearance', label: 'Appearance',    icon: Palette,      roles: ['admin', 'technical_admin'] },
    { id: 'schoolYear', label: 'School Year',   icon: Calendar,     roles: ['admin', 'technical_admin'] },
    { id: 'fees',       label: 'Fee Structure', icon: DollarSign,   roles: ['admin', 'technical_admin', 'accounting'] },
    { id: 'campuses',   label: 'Campuses',      icon: Building2,    roles: ['admin', 'technical_admin'] },
    { id: 'grades',     label: 'Grade Levels',  icon: GraduationCap,roles: ['admin', 'technical_admin'] },
    { id: 'discounts',  label: 'Discounts',     icon: Tag,          roles: ['accounting', 'admin'] },
    { id: 'receipt',    label: 'Receipt',        icon: Receipt,      roles: ['accounting'] },
    { id: 'users',      label: 'Users',          icon: Users,        roles: ['admin', 'technical_admin'] },
  ]
  const tabs = allTabs.filter(t => t.roles.includes(user?.role || 'technical_admin'))

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const handleColorChange = (colorId) => {
    setSelectedColor(colorId)
    alert(`Color theme "${colorThemes.find(c => c.id === colorId).name}" selected! (This will be implemented globally)`)
  }

  if (loading) return <PageSkeleton title="Settings" />

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-1">
          {isAccounting ? 'Accounting Settings' : 'Settings'}
        </h1>
        <p className="text-[var(--color-text-secondary)]">
          Manage system configuration and preferences
        </p>
      </div>

      {/* Tabs */}
      <div className="bg-[var(--color-bg-card)] rounded-lg shadow-lg mb-6">
        <div className="flex overflow-x-auto border-b border-[var(--color-border)]">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-1.5 px-3 sm:px-6 py-3 sm:py-4 text-sm font-medium whitespace-nowrap transition-colors
                ${activeTab === tab.id
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }
              `}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        
        {/* Appearance Tab */}
        {activeTab === 'appearance' && (
          <>
            {/* Accent Color Theme */}
            <div className="bg-[var(--color-bg-card)] rounded-2xl shadow-sm p-6 border border-[var(--color-border)]/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Palette className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
                    Accent Color Theme
                  </h2>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Personalize the primary highlight colors of your dashboard
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {colorThemes.map((color) => (
                  <button
                    key={color.id}
                    onClick={() => handleColorChange(color.id)}
                    className={`
                      relative p-4 border-2 rounded-lg transition-all 
                      ${selectedColor === color.id
                        ? 'border-primary shadow-lg'
                        : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)]'
                      }
                    `}
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className={`w-16 h-16 ${color.color} rounded-full flex items-center justify-center`}>
                        {selectedColor === color.id && (
                          <Check className="w-8 h-8 text-white" />
                        )}
                      </div>
                      <span className="text-sm font-medium text-[var(--color-text-primary)]">
                        {color.name}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Background Mode */}
            <div className="bg-[var(--color-bg-card)] rounded-2xl shadow-sm p-6 border border-[var(--color-border)]/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Moon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
                    Background Mode
                  </h2>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Choose your preferred application background lighting
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {/* Light Mode */}
                <button
                  onClick={() => theme === 'dark' && toggleTheme()}
                  className={`
                    p-6 border-2 rounded-lg transition-all 
                    ${theme === 'light'
                      ? 'border-primary shadow-lg bg-gray-50'
                      : 'border-[var(--color-border)] hover:border-gray-300'
                    }
                  `}
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 bg-white border-2 border-gray-200 rounded-full flex items-center justify-center">
                      <Sun className="w-8 h-8 text-yellow-500" />
                    </div>
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">
                      Light
                    </span>
                  </div>
                </button>

                {/* Dark Mode */}
                <button
                  onClick={() => theme === 'light' && toggleTheme()}
                  className={`
                    p-6 border-2 rounded-lg transition-all 
                    ${theme === 'dark'
                      ? 'border-primary shadow-lg bg-gray-900'
                      : 'border-[var(--color-border)] hover:border-gray-300'
                    }
                  `}
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 bg-gray-900 border-2 border-gray-700 rounded-full flex items-center justify-center">
                      <Moon className="w-8 h-8 text-blue-400" />
                    </div>
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">
                      Dark
                    </span>
                  </div>
                </button>

                {/* Auto Mode (Coming Soon) */}
                <button
                  disabled
                  className="p-6 border-2 border-[var(--color-border)] rounded-lg opacity-50 cursor-not-allowed"
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 bg-gradient-to-br from-white to-gray-900 rounded-full flex items-center justify-center">
                      <Sun className="w-6 h-6 text-yellow-500" />
                    </div>
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">
                      Auto
                    </span>
                    <span className="text-xs text-gray-500">Coming Soon</span>
                  </div>
                </button>
              </div>
            </div>
          </>
        )}

        {/* School Year Tab */}
        {activeTab === 'schoolYear' && (
          <div className="bg-[var(--color-bg-card)] rounded-2xl shadow-sm p-6 border border-[var(--color-border)]/50">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
                School Year Management
              </h2>
              <button className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-accent-burgundy transition-colors flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Add School Year
              </button>
            </div>

            <div className="space-y-4">
              {editSchoolYears.map((year) => (
                <div
                  key={year.id}
                  className="border border-[var(--color-border)] rounded-lg p-4 hover:border-primary transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
                          {year.year}
                        </h3>
                        {year.isCurrent && (
                          <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 text-xs font-medium rounded-full">
                            Current
                          </span>
                        )}
                        <span className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${
                          year.status === 'active' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400' :
                          year.status === 'completed' ? 'bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]' :
                          'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400'
                        }`}>
                          {year.status}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--color-text-secondary)]">
                        {new Date(year.startDate).toLocaleDateString()} - {new Date(year.endDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button className="p-2 text-[var(--color-text-secondary)] hover:text-primary">
                        <Edit className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {/* Save bar */}
            <div className="mt-6 flex items-center justify-between border-t border-[var(--color-border)] pt-4">
              <p className="text-xs text-gray-400">Changes affect all pages immediately</p>
              <button
                onClick={() => saveSection('schoolYears', editSchoolYears)}
                className="px-5 py-2 bg-primary text-white rounded-lg hover:bg-accent-burgundy transition-colors flex items-center gap-2 text-sm font-semibold"
              >
                {savedSection === 'schoolYears' ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                {savedSection === 'schoolYears' ? 'Saved!' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}

        {/* Fee Structure Tab */}
        {activeTab === 'fees' && (
          <FeeStructureTab
            fees={editFees}
            setFees={setEditFees}
            campuses={activeCampuses}
            userCampus={user?.campus}
            userRole={user?.role}
            onSave={() => saveSection('feeStructure', editFees)}
            saved={savedSection === 'feeStructure'}
          />
        )}

        {/* Campuses Tab */}
        {activeTab === 'campuses' && (
          <div className="bg-[var(--color-bg-card)] rounded-2xl shadow-sm p-6 border border-[var(--color-border)]/50">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
                Campus Management
              </h2>
              <button className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-accent-burgundy transition-colors flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Add Campus
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {editCampuses.map((campus) => (
                <div
                  key={campus.id}
                  className="border border-[var(--color-border)] rounded-lg p-4 hover:border-primary transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
                      {campus.name}
                    </h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      campus.isActive
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                        : 'bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]'
                    }`}>
                      {campus.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--color-text-secondary)] mb-2">
                    {campus.address}
                  </p>
                  <p className="text-sm text-[var(--color-text-secondary)] mb-2">
                    {campus.contactNumber}
                  </p>
                  <p className="text-sm text-[var(--color-text-secondary)] mb-3">
                    {campus.email}
                  </p>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {(campus.departments || campus.levels || []).map((level, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 text-xs rounded"
                      >
                        {level}
                      </span>
                    ))}
                  </div>
                  <button className="text-primary hover:text-accent-burgundy text-sm font-medium">
                    Edit Campus
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-[var(--color-border)] pt-4">
              <p className="text-xs text-gray-400">Campus changes update all dropdowns site-wide</p>
              <button
                onClick={() => saveSection('campuses', editCampuses)}
                className="px-5 py-2 bg-primary text-white rounded-lg hover:bg-accent-burgundy transition-colors flex items-center gap-2 text-sm font-semibold"
              >
                {savedSection === 'campuses' ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                {savedSection === 'campuses' ? 'Saved!' : 'Save Campuses'}
              </button>
            </div>
          </div>
        )}


        {activeTab === 'grades' && (
          <div className="bg-[var(--color-bg-card)] rounded-2xl shadow-sm p-6 border border-[var(--color-border)]/50">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
                Grade Level Configuration
              </h2>
              <button className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-accent-burgundy transition-colors flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Add Grade Level
              </button>
            </div>

            <div className="space-y-4">
              {basicEdGroups.map((group) => (
                <div
                  key={group.label}
                  className="border border-[var(--color-border)] rounded-lg p-4 hover:border-primary transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
                          {group.label}
                        </h3>
                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 text-xs font-medium rounded-full">
                          {group.options.length} grade{group.options.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {group.options.map((grade) => (
                          <span
                            key={grade}
                            className="px-3 py-1 bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)] text-sm rounded-full"
                          >
                            {grade}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button className="text-primary hover:text-accent-burgundy ml-4 flex-shrink-0">
                      <Edit className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Discounts Tab */}
        {activeTab === 'discounts' && (
          <DiscountsTab
            discounts={discounts}
            setDiscounts={setDiscounts}
            userCampus={user?.campus}
            userRole={user?.role}
          />
        )}

        {/* Receipt Settings Tab — accounting only */}
        {activeTab === 'receipt' && (
          <div className="bg-[var(--color-bg-card)] rounded-2xl shadow-sm p-6 border border-[var(--color-border)]/50">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <Receipt className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Receipt Settings</h2>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Configure receipts for <strong>{user?.campus || 'your campus'}</strong> only — other campuses are not affected.
                </p>
              </div>
            </div>

            <div className="max-w-lg space-y-6">
              {/* Cashier Name */}
              <div className="bg-[var(--color-bg-subtle)] rounded-xl p-5">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">Cashier / Accounting Officer Name</h3>
                <p className="text-xs text-[var(--color-text-muted)] mb-3">
                  This name appears on the signature line of every printed official receipt.
                </p>
                <input
                  type="text"
                  value={cashierName}
                  onChange={e => { setCashierName(e.target.value); setCashierSaved(false) }}
                  placeholder="e.g. Maria Santos"
                  className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-card)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-primary outline-none transition"
                />
              </div>

              {/* Receipt preview */}
              <div className="border border-dashed border-[var(--color-border)] rounded-xl p-5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5" /> Receipt Preview
                </p>
                <div className="text-xs space-y-1.5 text-[var(--color-text-secondary)]">
                  <p className="font-bold text-sm text-[var(--color-text-primary)] text-center">Cebu Sacred Heart College, Inc.</p>
                  <p className="text-center text-gray-400">{user?.campus || 'Campus'}</p>
                  <div className="border-t border-[var(--color-border)] mt-2 pt-2">
                    <div className="flex justify-between"><span className="text-gray-400">OR No.:</span><span className="font-mono">OR-2526-XXXX</span></div>
                    <div className="flex justify-between mt-1"><span className="text-gray-400">Student:</span><span>Juan Dela Cruz</span></div>
                    <div className="flex justify-between mt-1"><span className="text-gray-400">Amount:</span><span className="font-bold text-green-600">₱5,000.00</span></div>
                  </div>
                  <div className="border-t border-dashed border-[var(--color-border)] pt-2 mt-2 flex justify-between">
                    <div className="text-center">
                      <div className="border-t border-gray-300 pt-1 w-28">
                        <p className="font-semibold text-[var(--color-text-primary)]">{cashierName || '— not set —'}</p>
                        <p className="text-gray-400">Cashier</p>
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="border-t border-gray-300 pt-1 w-28">
                        <p className="text-gray-400 italic">Received by</p>
                        <p className="text-gray-400">Student/Parent</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Save */}
              <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-4">
                <p className="text-xs text-gray-400">Changes apply to all receipts printed from this account</p>
                <button
                  onClick={() => {
                    try {
                      // Save scoped to this campus — never affects other campuses
                      saveCampusCfg(user?.campus, { cashierName })
                      setCashierSaved(true)
                      setTimeout(() => setCashierSaved(false), 2000)
                    } catch {}
                  }}
                  className="flex items-center gap-2 px-5 py-2 bg-primary text-white rounded-lg hover:bg-accent-burgundy transition text-sm font-semibold"
                >
                  {cashierSaved ? <><Check className="w-4 h-4" /> Saved!</> : <><Save className="w-4 h-4" /> Save Settings</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <UsersTab
            users={editUsers}
            setUsers={setEditUsers}
            campuses={editCampuses}
            onSave={() => saveSection('systemUsers', editUsers)}
            saved={savedSection === 'systemUsers'}
          />
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// USERS TAB — full user management for technical_admin
// Add / Edit / Deactivate system users
// ─────────────────────────────────────────────────────────────────────

// Roles that require a campus assignment
const CAMPUS_SCOPED_ROLES = [
  'registrar_basic', 'registrar_college', 'accounting',
  'principal_basic', 'program_head',
]

// Roles available to assign (excluding student/teacher — future features)
const ASSIGNABLE_ROLES = [
  { value: 'technical_admin',   label: 'Technical Administrator' },
  { value: 'registrar_basic',   label: 'Basic Ed Registrar'      },
  { value: 'registrar_college', label: 'College Registrar'        },
  { value: 'accounting',        label: 'Accounting Officer'       },
  { value: 'principal_basic',   label: 'Basic Ed Principal'       },
  { value: 'program_head',      label: 'Program Head (College)'   },
]

// Hash password using Web Crypto API (same as AuthContext)
async function hashPassword(password) {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

const EMPTY_FORM = {
  name: '', email: '', role: 'registrar_basic',
  campus: '', campusKey: '', password: '', confirmPassword: '',
}

function UsersTab({ users, setUsers, campuses, onSave, saved }) {
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null) // null = adding new
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [showDeactivateId, setShowDeactivateId] = useState(null)
  const { addToast } = useToast()

  const needsCampus = CAMPUS_SCOPED_ROLES.includes(form.role)

  const activeCampusOptions = (campuses || [])
    .filter(c => c.isActive !== false)
    .map(c => ({ value: c.name, label: c.name, key: c.key }))

  // ── Filtering ─────────────────────────────────────────────────
  const filtered = users.filter(u => {
    const matchSearch = !searchQuery ||
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
    const matchRole = roleFilter === 'all' || u.role === roleFilter
    return matchSearch && matchRole
  })

  // ── Open Add modal ─────────────────────────────────────────────
  const handleAdd = () => {
    setEditingUser(null)
    setForm(EMPTY_FORM)
    setErrors({})
    setShowModal(true)
  }

  // ── Open Edit modal ────────────────────────────────────────────
  const handleEdit = (u) => {
    setEditingUser(u)
    setForm({
      name: u.name, email: u.email, role: u.role,
      campus: u.campus || '', campusKey: u.campusKey || '',
      password: '', confirmPassword: '',
    })
    setErrors({})
    setShowModal(true)
  }

  // ── Validation ─────────────────────────────────────────────────
  const validate = () => {
    const errs = {}
    if (!form.name.trim())  errs.name  = 'Name is required'
    if (!form.email.trim()) errs.email = 'Email is required'
    else if (!/^[^@]+@[^@]+\.[^@]+$/.test(form.email))
      errs.email = 'Enter a valid email address'
    else {
      const duplicate = users.find(u =>
        u.email.toLowerCase() === form.email.toLowerCase() &&
        u.id !== editingUser?.id
      )
      if (duplicate) errs.email = 'This email is already in use'
    }
    if (!form.role) errs.role = 'Select a role'
    if (needsCampus && !form.campus)
      errs.campus = 'This role requires a campus assignment'
    if (!editingUser) {
      // Adding — password required
      if (!form.password) errs.password = 'Password is required'
      else if (form.password.length < 6) errs.password = 'Minimum 6 characters'
      if (form.password !== form.confirmPassword)
        errs.confirmPassword = 'Passwords do not match'
    } else if (form.password) {
      // Editing — password optional but must match if provided
      if (form.password.length < 6) errs.password = 'Minimum 6 characters'
      if (form.password !== form.confirmPassword)
        errs.confirmPassword = 'Passwords do not match'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  // ── Save user ──────────────────────────────────────────────────
  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const campusObj = activeCampusOptions.find(c => c.value === form.campus)
      const campusKey = campusObj?.key || ''

      if (editingUser) {
        // Edit existing
        const updates = {
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          role: form.role,
          campus: needsCampus ? form.campus : 'all',
          campusKey: needsCampus ? campusKey : '',
        }
        if (form.password) {
          updates.passwordHash = await hashPassword(form.password)
        }
        setUsers(prev => prev.map(u =>
          u.id === editingUser.id ? { ...u, ...updates } : u
        ))
      } else {
        // Add new
        const passwordHash = await hashPassword(form.password)
        const newId = Math.max(...users.map(u => u.id), 0) + 1
        const newUser = {
          id: newId,
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          passwordHash,
          role: form.role,
          campus: needsCampus ? form.campus : 'all',
          campusKey: needsCampus ? campusKey : '',
          status: 'active',
          lastLogin: null,
        }
        setUsers(prev => [...prev, newUser])
      }

      onSave()
      setShowModal(false)
    } catch (err) {
      console.error('Save user error:', err)
    } finally {
      setSaving(false)
    }
  }

  // ── Toggle active/inactive ─────────────────────────────────────
  const handleToggleStatus = (userId) => {
    setUsers(prev => prev.map(u =>
      u.id === userId
        ? { ...u, status: u.status === 'active' ? 'inactive' : 'active' }
        : u
    ))
    onSave()
    setShowDeactivateId(null)
  }

  // ── Role badge ─────────────────────────────────────────────────
  const RoleBadge = ({ role }) => {
    const def = ROLE_DEFINITIONS?.[role]
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        def?.color || 'bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)]'
      }`}>
        {def?.label || role}
      </span>
    )
  }

  const fmtDate = (d) => {
    if (!d) return '—'
    try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
    catch { return '—' }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-[var(--color-bg-card)] rounded-2xl shadow-sm border border-[var(--color-border)]/50 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">User Management</h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              {users.filter(u => u.status === 'active').length} active · {users.filter(u => u.status !== 'active').length} inactive
            </p>
          </div>
          <button
            onClick={handleAdd}
            className="self-start sm:self-auto flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl hover:bg-accent-burgundy transition text-sm font-semibold shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add User
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <svg className="search-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            <input
              type="text"
              placeholder="Search name or email…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] focus:ring-2 focus:ring-primary outline-none transition"
            />
          </div>
          <GroupedSelect
            value={roleFilter}
            onChange={setRoleFilter}
            allLabel="All Roles"
            options={ASSIGNABLE_ROLES}
            className="sm:w-52"
          />
        </div>
      </div>

      {/* User table */}
      <div className="bg-[var(--color-bg-card)] rounded-2xl shadow-sm border border-[var(--color-border)]/50 overflow-hidden">
        {/* Mobile list */}
        <ul className="md:hidden divide-y divide-[var(--color-border)]">
          {filtered.map(u => (
            <li key={u.id} className="px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className={`text-sm font-semibold truncate ${u.status !== 'active' ? 'text-[var(--color-text-muted)]' : 'text-[var(--color-text-primary)]'}`}>
                      {u.name}
                    </p>
                    {u.status !== 'active' && (
                      <span className="text-xs px-1.5 py-0.5 bg-[var(--color-bg-subtle)] text-gray-500 rounded-full flex-shrink-0">Inactive</span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)] truncate mb-1.5">{u.email}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <RoleBadge role={u.role} />
                    {u.campus && u.campus !== 'all' && (
                      <span className="text-xs text-[var(--color-text-muted)]">{u.campus.replace(' Campus','').replace(' City','')}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => handleEdit(u)} className="p-2 text-[var(--color-text-muted)] hover:text-primary rounded-lg hover:bg-[var(--color-bg-subtle)] transition">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => setShowDeactivateId(u.id)} className={`p-2 rounded-lg transition ${u.status === 'active' ? 'text-[var(--color-text-muted)] hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20' : 'text-[var(--color-text-muted)] hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'}`}>
                    {u.status === 'active'
                      ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
                      : <Check className="w-4 h-4" />
                    }
                  </button>
                </div>
              </div>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-4 py-10 text-center text-sm text-gray-400">No users match your search.</li>
          )}
        </ul>

        {/* Desktop table */}
        <div className="hidden md:block min-w-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-[var(--color-bg-subtle)]/50">
                <tr>
                  {['Name','Email','Role','Campus','Status','Last Login','Actions'].map(h => (
                    <th key={h} className="th">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {filtered.map(u => (
                  <tr key={u.id} className={`hover:bg-[var(--color-bg-subtle)]/30 transition-colors ${u.status !== 'active' ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 font-medium text-[var(--color-text-primary)] whitespace-nowrap">{u.name}</td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)] whitespace-nowrap">{u.email}</td>
                    <td className="px-4 py-3 whitespace-nowrap"><RoleBadge role={u.role} /></td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)] whitespace-nowrap">
                      {u.campus && u.campus !== 'all' ? u.campus : <span className="text-[var(--color-text-muted)] opacity-50">All campuses</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        u.status === 'active'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)]'
                      }`}>
                        {u.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-muted)] whitespace-nowrap text-xs">{fmtDate(u.lastLogin)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleEdit(u)} className="inline-flex items-center gap-1 text-sm text-primary dark:text-red-400 hover:text-accent-burgundy font-medium transition">
                          <Edit className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button
                          onClick={() => setShowDeactivateId(u.id)}
                          className={`inline-flex items-center gap-1 text-sm font-medium transition ${
                            u.status === 'active'
                              ? 'text-amber-600 dark:text-amber-400 hover:text-amber-800'
                              : 'text-green-600 dark:text-green-400 hover:text-green-800'
                          }`}
                        >
                          {u.status === 'active' ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400">No users match your search.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
          Showing {filtered.length} of {users.length} users · Changes take effect on next login
        </div>
      </div>

      {/* ── Add / Edit Modal ─────────────────────────────────────── */}
      {showModal && (
        <ModalPortal>
        <div className="modal-backdrop">
          <div className="bg-[var(--color-bg-card)] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[92vh] flex flex-col shadow-[var(--shadow-modal)]">
            {/* Modal header */}
            <div className="modal-header">
              <div>
                <h3 className="text-base font-bold text-[var(--color-text-primary)]">
                  {editingUser ? 'Edit User' : 'Add New User'}
                </h3>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  {editingUser ? `Editing ${editingUser.name}` : 'Create a new system account'}
                </p>
              </div>
              <button onClick={() => setShowModal(false)} className="icon-btn-ghost">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal body */}
            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {/* Name */}
              <div>
                <label className="form-label">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Maria Santos"
                  className={`w-full px-3 py-2.5 text-sm border rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none transition
                    ${errors.name ? 'border-red-400' : 'border-[var(--color-border)] focus:border-primary focus:ring-2 focus:ring-primary/20'}`}
                />
                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
              </div>

              {/* Email */}
              <div>
                <label className="form-label">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="e.g. registrar@cshc.edu.ph"
                  className={`w-full px-3 py-2.5 text-sm border rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none transition
                    ${errors.email ? 'border-red-400' : 'border-[var(--color-border)] focus:border-primary focus:ring-2 focus:ring-primary/20'}`}
                />
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
              </div>

              {/* Role */}
              <div>
                <label className="form-label">
                  Role <span className="text-red-500">*</span>
                </label>
                <GroupedSelect
                  value={form.role}
                  onChange={v => setForm(f => ({ ...f, role: v, campus: '', campusKey: '' }))}
                  allLabel="Select role…"
                  options={ASSIGNABLE_ROLES}
                />
                {errors.role && <p className="text-xs text-red-500 mt-1">{errors.role}</p>}
                {form.role && ROLE_DEFINITIONS?.[form.role] && (
                  <p className="text-xs text-[var(--color-text-muted)] mt-1.5">
                    {ROLE_DEFINITIONS[form.role].description}
                  </p>
                )}
              </div>

              {/* Campus — only for campus-scoped roles */}
              {needsCampus && (
                <div>
                  <label className="form-label">
                    Campus <span className="text-red-500">*</span>
                  </label>
                  <GroupedSelect
                    value={form.campus}
                    onChange={v => {
                      const obj = activeCampusOptions.find(c => c.value === v)
                      setForm(f => ({ ...f, campus: v, campusKey: obj?.key || '' }))
                    }}
                    allLabel="Select campus…"
                    options={activeCampusOptions}
                  />
                  {errors.campus && <p className="text-xs text-red-500 mt-1">{errors.campus}</p>}
                </div>
              )}

              {/* Password */}
              <div>
                <label className="form-label">
                  {editingUser ? 'New Password' : 'Password'} {!editingUser && <span className="text-red-500">*</span>}
                  {editingUser && <span className="text-gray-400 font-normal"> (leave blank to keep current)</span>}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Minimum 6 characters"
                  className={`w-full px-3 py-2.5 text-sm border rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none transition
                    ${errors.password ? 'border-red-400' : 'border-[var(--color-border)] focus:border-primary focus:ring-2 focus:ring-primary/20'}`}
                />
                {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
              </div>

              {/* Confirm Password */}
              {(form.password || !editingUser) && (
                <div>
                  <label className="form-label">
                    Confirm Password {!editingUser && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="password"
                    value={form.confirmPassword}
                    onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
                    placeholder="Re-enter password"
                    className={`w-full px-3 py-2.5 text-sm border rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none transition
                      ${errors.confirmPassword ? 'border-red-400' : 'border-[var(--color-border)] focus:border-primary focus:ring-2 focus:ring-primary/20'}`}
                  />
                  {errors.confirmPassword && <p className="text-xs text-red-500 mt-1">{errors.confirmPassword}</p>}
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="modal-footer">
              <button
                onClick={() => setShowModal(false)}
                className="btn-cancel"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm bg-primary text-white rounded-xl hover:bg-accent-burgundy transition font-semibold shadow-sm disabled:opacity-60"
              >
                {saving
                  ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Saving…</>
                  : <><Check className="w-4 h-4" /> {editingUser ? 'Save Changes' : 'Create User'}</>
                }
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* ── Deactivate / Reactivate Confirm ──────────────────────── */}
      {showDeactivateId && (() => {
        const target = users.find(u => u.id === showDeactivateId)
        const isActive = target?.status === 'active'
        return (
          <ModalPortal>
          <div className="modal-backdrop-center">
            <div className="bg-[var(--color-bg-card)] rounded-2xl w-full max-w-sm p-6 shadow-[var(--shadow-modal)]">
              <h3 className="text-base font-bold text-[var(--color-text-primary)] mb-2">
                {isActive ? 'Deactivate User?' : 'Reactivate User?'}
              </h3>
              <p className="text-sm text-[var(--color-text-muted)] mb-5">
                {isActive
                  ? `${target?.name} will no longer be able to log in. You can reactivate them at any time.`
                  : `${target?.name} will be able to log in again.`
                }
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeactivateId(null)}
                  className="btn-cancel"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleToggleStatus(showDeactivateId)}
                  className={`flex-1 py-2.5 text-sm text-white rounded-xl transition font-semibold ${
                    isActive ? 'bg-amber-600 hover:bg-amber-700' : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {isActive ? 'Yes, Deactivate' : 'Yes, Reactivate'}
                </button>
              </div>
            </div>
          </div>
          </ModalPortal>
        )
      })()}
    </div>
  )
}