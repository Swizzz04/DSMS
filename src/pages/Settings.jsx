import { useState, useEffect } from 'react'
import {
  Calendar, DollarSign, Building2, GraduationCap,
  Users, Plus, Edit, Check, Save, Receipt,
  X, ChevronDown, ChevronUp, AlertCircle, Info, Trash2, Tag, Percent, BookOpen,
  ChevronRight, Clock, MapPin, Paintbrush, School, Image, Upload, Ticket,
  Shield, Bug, UserPlus, HelpCircle, MessageSquare, Send
} from 'lucide-react'
import { PageSkeleton, useToast, ToastContainer, ModalPortal } from '../components/UIComponents'
import { useTheme } from '../context/ThemeContext'
import { useAppConfig } from '../context/AppConfigContext'
import { useAuth } from '../context/AuthContext'
import { DEFAULT_DISCOUNTS, applyDiscountsCascading, FEE_STRUCTURE as DEFAULT_FEE_STRUCTURE, previewCollegeFee, getLoadStatus, ROLE_DEFINITIONS } from '../config/appConfig'
import GroupedSelect from '../components/GroupedSelect'
import { getAllTickets, getTicketStats, updateTicketStatus, updateTicketPriority, addTicketNote } from '../utils/ticketBridge'



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
  const { toasts, addToast, removeToast } = useToast()
  const [showAddSY, setShowAddSY] = useState(false)
  const [expandedSY, setExpandedSY] = useState(null)
  const [showAddEvent, setShowAddEvent] = useState(null)  // { syId, dept }
  const [newEvtName, setNewEvtName] = useState('')
  const [newEvtType, setNewEvtType] = useState('academic')
  const [newEvtStart, setNewEvtStart] = useState('')
  const [newEvtEnd, setNewEvtEnd] = useState('')
  const [editSY, setEditSY] = useState(null)
  const [syDeptView, setSyDeptView] = useState(() =>
    user?.role === 'program_head' ? 'college' : 'basic_ed'
  )
  const [showAddCampus, setShowAddCampus] = useState(false)
  const [editCampusId, setEditCampusId] = useState(null)       // campus id being edited
  const [campusForm, setCampusForm] = useState({               // shared form for add/edit
    name: '', key: '', address: '', contactNumber: '', email: '',
    hasBasicEd: true, hasCollege: false, collegePrograms: [], newProgram: '',
  })
  // Collapsible sections for School Info tab
  const [infoSections, setInfoSections] = useState({ general: true, branding: false, campuses: false, faq: false, about: false, programs: false, admissions: false })
  const toggleInfoSection = (key) => setInfoSections(prev => ({ ...prev, [key]: !prev[key] }))

  // Website content — CMS for school website (stored in localStorage cshc_website_content)
  const [websiteContent, setWebsiteContent] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('cshc_website_content') || '{}')
      return {
        schoolName:  saved.schoolName  || 'Cebu Sacred Heart College, Inc.',
        motto:       saved.motto       || 'Where Children Grow In Love and Knowledge.',
        email:       saved.email       || 'info@cshc.edu.ph',
        phone:       saved.phone       || '(032) 123-4567',
        website:     saved.website     || 'www.cshc.edu.ph',
        schoolYear:  saved.schoolYear  || '2025-2026',
        faq:         saved.faq         || [
          { id: 1, q: 'What are the tuition fees?', a: 'Tuition fees vary by campus and program. Please contact the Registrar\'s Office or visit any campus for detailed fee schedules.' },
          { id: 2, q: 'Do you offer scholarships?', a: 'Yes, we offer various scholarships based on academic performance and financial need. Please inquire at the Admissions Office for eligibility criteria.' },
          { id: 3, q: 'What extracurricular activities are available?', a: 'We offer sports, arts, music, and academic clubs. Each campus has its own set of activities — check with your campus for more details.' },
          { id: 4, q: 'Can I enroll online?', a: 'Yes! Submit your form online, then proceed to any campus to complete requirements and payment.' },
          { id: 5, q: 'What programs are offered at each campus?', a: 'All campuses offer Basic Education (Pre-Elem to SHS). College programs are at Talisay (BS Nursing, BS Tourism, BS HRM) and Carcar (BS Criminology). Bohol offers Pre-Elementary to Junior High.' },
        ],
        mission:     saved.mission     || 'To enhance virtue, develop competence, promote excellence, and inspire service in all academic levels of the institution.',
        vision:      saved.vision      || 'CSHC envisions to produce graduates who are Christ-centered, critical thinkers, service-oriented, and globally competitive.',
        goals:       saved.goals       || ['Consistent pursuit of academic excellence.', 'Faithful adherence to Christian values and virtue.', 'Learning environment conducive to holistic formation.', 'Continuous faculty development.', 'Promotion of academic and cultural development.', 'Partnership with the community in social service.', 'Strict compliance with DepEd mandates.', 'Conformity with K to 12 Standards & competencies.'],
        coreValues:  saved.coreValues  || ['Integrity', 'Christ-centered', 'Excellence'],
        programs:    saved.programs    || [
          { id: 1, title: 'Pre-Elementary', age: 'Ages 3-5', description: 'Nurturing young minds through play-based learning and early childhood development.', features: ['Nursery', 'Kindergarten', 'Preparatory'], highlight: false },
          { id: 2, title: 'Elementary', age: 'Grades 1-6', description: 'Building strong foundations in academics, values, and character development.', features: ['Core subjects mastery', 'Values education', 'Extracurricular activities'], highlight: false },
          { id: 3, title: 'Junior High School', age: 'Grades 7-10', description: 'Preparing students for senior high through the comprehensive K-12 curriculum.', features: ['Enhanced curriculum', 'Skills development', 'Career guidance'], highlight: false },
          { id: 4, title: 'Senior High School', age: 'Grades 11-12', description: 'Specialized tracks preparing students for college and career readiness.', features: ['General Academic Strand', 'Skills development', 'Specialized subjects'], highlight: false },
          { id: 5, title: 'College', age: '4-Year Program', description: 'BS in Criminology — training future law enforcement professionals.', features: ['Board exam preparation', 'Practical training', 'Professional instructors'], highlight: true },
        ],
        requirements: saved.requirements || [
          { id: 1, icon: '📄', title: 'Birth Certificate', desc: 'Original and photocopy (NSO/PSA issued)' },
          { id: 2, icon: '📋', title: 'Report Card', desc: 'Form 138 (previous school records)' },
          { id: 3, icon: '🎓', title: 'Good Moral Certificate', desc: 'From previous school attended' },
          { id: 4, icon: '🪪', title: '2x2 ID Photos', desc: 'Recent photos (white background)' },
        ],
        steps: saved.steps || [
          { id: 1, title: 'Submit Online Form', desc: 'Fill out our online enrollment form or visit any campus registrar\'s office.' },
          { id: 2, title: 'Submit Requirements', desc: 'Provide all necessary documents to the registrar.' },
          { id: 3, title: 'Pay Down Payment', desc: 'Proceed to Accounting/Finance for assessment and initial payment.' },
          { id: 4, title: 'Registrar Approval', desc: 'Receive your class schedule once enrollment is approved.' },
        ],
      }
    } catch { return { schoolName: 'Cebu Sacred Heart College, Inc.', motto: '', email: '', phone: '', website: '', schoolYear: '2025-2026', faq: [], mission: '', vision: '', goals: [], coreValues: [], programs: [], requirements: [], steps: [] } }
  })
  const [newFaqQ, setNewFaqQ] = useState('')
  const [newFaqA, setNewFaqA] = useState('')
  const [editFaqId, setEditFaqId] = useState(null)
  const [newGoal, setNewGoal] = useState('')
  const [newValue, setNewValue] = useState('')
  const [editProgramId, setEditProgramId] = useState(null)
  const [showAddProgram, setShowAddProgram] = useState(false)
  const [showAddRequirement, setShowAddRequirement] = useState(false)
  const [showAddStep, setShowAddStep] = useState(false)

  const saveWebsiteContent = () => {
    localStorage.setItem('cshc_website_content', JSON.stringify(websiteContent))
    addToast('Website content saved! Changes will appear on the school website.', 'success')
  }

  // Tickets tab state
  const [tickets, setTickets] = useState([])
  const [ticketStats, setTicketStats] = useState({ total: 0, open: 0, inProgress: 0, onHold: 0, resolved: 0, closed: 0, urgent: 0, high: 0 })
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [ticketFilterStatus, setTicketFilterStatus] = useState('all')
  const [ticketFilterType, setTicketFilterType] = useState('all')
  const [ticketNote, setTicketNote] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 150)
    return () => clearTimeout(t)
  }, [])

  const [activeTab, setActiveTab] = useState(() => {
    const role = user?.role
    if (role === 'accounting') return 'fees'
    if (role === 'technical_admin') return 'users'
    if (role === 'principal_basic' || role === 'program_head') return 'schoolYear'
    return 'fees'
  })

  // Load tickets when tab is active
  useEffect(() => {
    if (activeTab === 'tickets') {
      setTickets(getAllTickets())
      setTicketStats(getTicketStats())
    }
    const handleUpdate = () => { setTickets(getAllTickets()); setTicketStats(getTicketStats()) }
    window.addEventListener('cshc_ticket_updated', handleUpdate)
    window.addEventListener('storage', (e) => { if (e.key === 'cshc_tickets' || e.key === null) handleUpdate() })
    return () => window.removeEventListener('cshc_ticket_updated', handleUpdate)
  }, [activeTab])

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


  // Tab configuration
  const isAccounting = user?.role === 'accounting'

  const allTabs = [
    // Tech admin — system management
    { id: 'users',       label: 'Users',            icon: Users,         roles: ['technical_admin'] },
    { id: 'schoolInfo',  label: 'School Info',       icon: School,        roles: ['technical_admin'] },
    { id: 'tickets',     label: 'Tickets',           icon: Ticket,        roles: ['technical_admin'] },
    // Principal / Program Head — academic config
    { id: 'schoolYear', label: 'School Year',       icon: Calendar,      roles: ['principal_basic', 'program_head'] },
    { id: 'grades',     label: 'Grade Levels',      icon: GraduationCap, roles: ['principal_basic', 'program_head'] },
    // Accounting — financial config
    { id: 'fees',       label: 'Fee Structure',     icon: DollarSign,    roles: ['accounting'] },
    { id: 'discounts',  label: 'Discounts',         icon: Tag,           roles: ['accounting'] },
    { id: 'receipt',    label: 'Receipt',            icon: Receipt,       roles: ['accounting'] },
  ]
  const tabs = allTabs.filter(t => t.roles.includes(user?.role || 'technical_admin'))

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0
    }).format(amount)
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


        {/* School Year Tab */}
        {activeTab === 'schoolYear' && (() => {
          const role = user?.role
          const canSeeBoth = role === 'technical_admin'
          const visibleDept = role === 'principal_basic' ? 'basic_ed' : role === 'program_head' ? 'college' : syDeptView
          const deptLabel = { basic_ed: 'Basic Education', college: 'College' }
          const deptKey = visibleDept === 'college' ? 'college' : 'basicEd'
          const sorted = editSchoolYears.slice().sort((a, b) => b.year.localeCompare(a.year))

          return (
          <div className="bg-[var(--color-bg-card)] rounded-2xl shadow-sm p-6 border border-[var(--color-border)]/50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div>
                <h2 className="text-xl font-bold text-[var(--color-text-primary)]">School Year Management</h2>
                <p className="text-sm text-[var(--color-text-muted)] mt-1">
                  {canSeeBoth ? 'Manage academic calendars per department' : `Manage ${deptLabel[visibleDept]} academic calendar`}
                </p>
              </div>
              <button onClick={() => setShowAddSY(true)}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-accent-burgundy transition-colors flex items-center gap-2 text-sm font-semibold self-start sm:self-auto">
                <Plus className="w-4 h-4" /> Add School Year
              </button>
            </div>

            {/* Department tabs — tech admin only */}
            {canSeeBoth && (
              <div className="flex gap-1 p-1 bg-[var(--color-bg-subtle)] rounded-xl mb-5 w-fit">
                {[
                  { key: 'basic_ed', label: 'Basic Education', icon: BookOpen },
                  { key: 'college',  label: 'College',         icon: GraduationCap },
                ].map(dept => (
                  <button key={dept.key} onClick={() => { setSyDeptView(dept.key); setExpandedSY(null) }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                      syDeptView === dept.key ? 'bg-primary text-white shadow-sm' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                    }`}>
                    <dept.icon className="w-4 h-4" /> {dept.label}
                  </button>
                ))}
              </div>
            )}

            {/* Department label for locked roles */}
            {!canSeeBoth && (
              <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-[var(--color-bg-subtle)] rounded-lg w-fit">
                {visibleDept === 'basic_ed' ? <BookOpen className="w-4 h-4 text-primary" /> : <GraduationCap className="w-4 h-4 text-primary" />}
                <span className="text-sm font-medium text-[var(--color-text-primary)]">{deptLabel[visibleDept]} Department</span>
              </div>
            )}

            {sorted.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-3 opacity-40" />
                <p className="text-sm text-[var(--color-text-muted)]">No school years configured yet.</p>
                <button onClick={() => setShowAddSY(true)} className="mt-3 text-sm text-primary font-medium hover:underline">Add your first school year</button>
              </div>
            ) : (
              <div className="space-y-3">
                {sorted.map((sy) => {
                  const isExpanded = expandedSY === sy.id
                  const cal = sy[deptKey] || { startDate: '', endDate: '', events: [] }
                  const events = cal.events || []
                  const eventTypeColors = {
                    academic: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
                    holiday:  'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
                    special:  'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
                  }
                  return (
                  <div key={sy.id} className={`border rounded-xl overflow-hidden transition-colors ${sy.isCurrent ? 'border-primary/40 bg-primary/5' : 'border-[var(--color-border)]'}`}>
                    {/* Header */}
                    <button onClick={() => setExpandedSY(isExpanded ? null : sy.id)}
                      className="w-full text-left p-4 flex items-center justify-between hover:bg-[var(--color-bg-subtle)]/50 transition">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <h3 className="text-base font-bold text-[var(--color-text-primary)]">{sy.year}</h3>
                          {sy.isCurrent && (
                            <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-semibold rounded-full uppercase tracking-wider">Current</span>
                          )}
                          <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full uppercase tracking-wider ${
                            sy.status === 'active'    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                            sy.status === 'completed' ? 'bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]' :
                            'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                          }`}>{sy.status}</span>
                          {events.length > 0 && (
                            <span className="text-[10px] text-[var(--color-text-muted)]">{events.length} event{events.length !== 1 ? 's' : ''}</span>
                          )}
                        </div>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {cal.startDate
                            ? `${new Date(cal.startDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} — ${new Date(cal.endDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
                            : 'No dates configured for this department'
                          }
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={(e) => { e.stopPropagation(); setEditSY({ ...sy, _dept: visibleDept }) }} className="icon-btn-ghost" title="Edit school year">
                          <Edit className="w-4 h-4" />
                        </button>
                        <ChevronDown className={`w-5 h-5 text-[var(--color-text-muted)] transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                    </button>

                    {/* Expanded — events */}
                    {isExpanded && (
                      <div className="border-t border-[var(--color-border)] bg-[var(--color-bg-subtle)]/30">
                        <div className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                              <Clock className="w-4 h-4 text-[var(--color-text-muted)]" /> {deptLabel[visibleDept]} Events
                            </h4>
                            <button onClick={() => setShowAddEvent({ syId: sy.id, dept: deptKey })} className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                              <Plus className="w-3.5 h-3.5" /> Add Event
                            </button>
                          </div>

                          {events.length === 0 ? (
                            <div className="text-center py-6 border border-dashed border-[var(--color-border)] rounded-lg">
                              <p className="text-xs text-[var(--color-text-muted)]">No events scheduled</p>
                              <button onClick={() => setShowAddEvent({ syId: sy.id, dept: deptKey })} className="mt-2 text-xs text-primary font-medium hover:underline">Add your first event</button>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {events.slice().sort((a, b) => new Date(a.startDate) - new Date(b.startDate)).map((evt) => (
                                <div key={evt.id} className="flex items-start gap-3 p-3 bg-[var(--color-bg-card)] rounded-lg border border-[var(--color-border)]">
                                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <Calendar className="w-4 h-4 text-primary" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                      <span className="text-sm font-medium text-[var(--color-text-primary)]">{evt.name}</span>
                                      <span className={`px-1.5 py-0.5 text-[9px] font-semibold rounded uppercase tracking-wider ${eventTypeColors[evt.type] || eventTypeColors.special}`}>{evt.type}</span>
                                    </div>
                                    <p className="text-xs text-[var(--color-text-muted)]">
                                      {new Date(evt.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                      {evt.endDate && evt.endDate !== evt.startDate && (<> — {new Date(evt.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</>)}
                                      {(!evt.endDate || evt.endDate === evt.startDate) && (<>, {new Date(evt.startDate).getFullYear()}</>)}
                                    </p>
                                  </div>
                                  <button onClick={() => {
                                    setEditSchoolYears(editSchoolYears.map(s => s.id === sy.id ? { ...s, [deptKey]: { ...s[deptKey], events: (s[deptKey]?.events || []).filter(e => e.id !== evt.id) } } : s))
                                    addToast(`"${evt.name}" removed`, 'success')
                                  }} className="icon-btn-ghost flex-shrink-0" title="Remove event">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )})}
              </div>
            )}

            <div className="mt-6 flex items-center justify-between border-t border-[var(--color-border)] pt-4">
              <p className="text-xs text-[var(--color-text-muted)]">{sorted.length} school year{sorted.length !== 1 ? 's' : ''} · {deptLabel[visibleDept]}</p>
              <button onClick={() => saveSection('schoolYears', editSchoolYears)}
                className="px-5 py-2 bg-primary text-white rounded-lg hover:bg-accent-burgundy transition-colors flex items-center gap-2 text-sm font-semibold">
                {savedSection === 'schoolYears' ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                {savedSection === 'schoolYears' ? 'Saved!' : 'Save Changes'}
              </button>
            </div>
          </div>
          )
        })()}

        {/* Add School Year Modal */}
        {showAddSY && (() => {
          const existingYears = editSchoolYears.map(y => y.year)
          const latestYear = editSchoolYears.length > 0
            ? Math.max(...editSchoolYears.map(y => parseInt(y.year.split('-')[1])))
            : new Date().getFullYear()
          const suggestedYear = `${latestYear}-${latestYear + 1}`
          const defaultYear = existingYears.includes(suggestedYear) ? '' : suggestedYear

          return (
            <ModalPortal>
            <div className="modal-backdrop-center">
              <div className="modal-panel-sm">
                <h3 className="text-base font-bold text-[var(--color-text-primary)] mb-1">Add School Year</h3>
                <p className="text-xs text-[var(--color-text-muted)] mb-5">Create a new academic year with department calendars</p>

                <label className="form-label">School Year</label>
                <input id="add-sy-year" type="text" defaultValue={defaultYear} placeholder="e.g. 2028-2029"
                  className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition mb-4" />

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="form-label flex items-center gap-1.5"><BookOpen className="w-3 h-3" /> Basic Ed Start</label>
                    <input id="add-sy-be-start" type="date" defaultValue={`${latestYear}-06-01`}
                      className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition" />
                  </div>
                  <div>
                    <label className="form-label">Basic Ed End</label>
                    <input id="add-sy-be-end" type="date" defaultValue={`${latestYear + 1}-03-31`}
                      className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="form-label flex items-center gap-1.5"><GraduationCap className="w-3 h-3" /> College Start</label>
                    <input id="add-sy-col-start" type="date" defaultValue={`${latestYear}-08-01`}
                      className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition" />
                  </div>
                  <div>
                    <label className="form-label">College End</label>
                    <input id="add-sy-col-end" type="date" defaultValue={`${latestYear + 1}-05-31`}
                      className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition" />
                  </div>
                </div>

                <label className="form-label mb-1.5">Status</label>
                <div className="mb-5">
                  <GroupedSelect value="upcoming" onChange={() => {}} allLabel={null} options={[
                    { value: 'upcoming', label: 'Upcoming' }, { value: 'active', label: 'Active' }, { value: 'completed', label: 'Completed' },
                  ]} />
                </div>

                <div className="action-row">
                  <button onClick={() => setShowAddSY(false)} className="btn-cancel">Cancel</button>
                  <button className="btn-action" onClick={() => {
                    const year = document.getElementById('add-sy-year').value.trim()
                    if (!year) { addToast('Please enter a school year', 'error'); return }
                    if (!/^\d{4}-\d{4}$/.test(year)) { addToast('Format must be YYYY-YYYY', 'error'); return }
                    const [sY, eY] = year.split('-').map(Number)
                    if (eY !== sY + 1) { addToast('End year must be 1 year after start', 'error'); return }
                    if (existingYears.includes(year)) { addToast(`${year} already exists`, 'error'); return }

                    const beStart = document.getElementById('add-sy-be-start').value
                    const beEnd = document.getElementById('add-sy-be-end').value
                    const colStart = document.getElementById('add-sy-col-start').value
                    const colEnd = document.getElementById('add-sy-col-end').value

                    if (!beStart || !beEnd || !colStart || !colEnd) { addToast('Please set all dates', 'error'); return }

                    setEditSchoolYears(prev => [...prev, {
                      id: Date.now(), year, status: 'upcoming', isCurrent: false,
                      basicEd: { startDate: beStart, endDate: beEnd, events: [] },
                      college: { startDate: colStart, endDate: colEnd, events: [] },
                    }])
                    setShowAddSY(false)
                    addToast(`School year ${year} added! Click "Save Changes" to apply.`, 'success')
                  }}>Add School Year</button>
                </div>
              </div>
            </div>
            </ModalPortal>
          )
        })()}

        {/* Add Event Modal */}
        {showAddEvent && (() => {
          const targetSY = editSchoolYears.find(sy => sy.id === showAddEvent.syId)
          if (!targetSY) return null
          const dept = showAddEvent.dept
          const deptName = dept === 'basicEd' ? 'Basic Education' : 'College'

          const presetEvents = [
            { name: 'Enrollment Period',    type: 'academic' },
            { name: 'Midterm Examinations', type: 'academic' },
            { name: 'Final Examinations',   type: 'academic' },
            { name: 'Semestral Break',      type: 'holiday' },
            { name: 'Summer Break',         type: 'holiday' },
            { name: 'Graduation Ceremony',  type: 'special' },
            { name: 'Foundation Day',       type: 'special' },
          ]
          const existingEvents = targetSY[dept]?.events || []

          return (
            <ModalPortal>
            <div className="modal-backdrop-center">
              <div className="modal-panel-sm" style={{ maxWidth: '28rem' }}>
                <h3 className="text-base font-bold text-[var(--color-text-primary)] mb-0.5">Add Event</h3>
                <p className="text-xs text-[var(--color-text-muted)] mb-5">
                  {deptName} · <span className="font-semibold text-[var(--color-text-primary)]">{targetSY.year}</span>
                </p>

                <label className="form-label">Quick Add</label>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {presetEvents.map(preset => {
                    const exists = existingEvents.some(e => e.name === preset.name)
                    return (
                      <button key={preset.name} disabled={exists}
                        onClick={() => { setNewEvtName(preset.name); setNewEvtType(preset.type) }}
                        className={`px-2.5 py-1 text-[11px] rounded-lg border transition ${
                          exists ? 'border-[var(--color-border)] text-[var(--color-text-muted)] opacity-40 cursor-not-allowed line-through'
                            : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-primary hover:text-primary cursor-pointer'
                        }`}>{preset.name}</button>
                    )
                  })}
                </div>

                <label className="form-label">Event Name</label>
                <input type="text" value={newEvtName} onChange={e => setNewEvtName(e.target.value)}
                  placeholder="e.g. Enrollment Period"
                  className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition mb-4" />

                <label className="form-label mb-1.5">Event Type</label>
                <div className="mb-4">
                  <GroupedSelect value={newEvtType} onChange={setNewEvtType} allLabel={null}
                    options={[
                      { value: 'academic', label: 'Academic' },
                      { value: 'holiday',  label: 'Holiday / Break' },
                      { value: 'special',  label: 'Special Event' },
                    ]} />
                </div>

                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div>
                    <label className="form-label">Start Date</label>
                    <input type="date" value={newEvtStart} onChange={e => setNewEvtStart(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition" />
                  </div>
                  <div>
                    <label className="form-label">End Date</label>
                    <input type="date" value={newEvtEnd} onChange={e => setNewEvtEnd(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition" />
                  </div>
                </div>

                <div className="action-row">
                  <button onClick={() => { setShowAddEvent(null); setNewEvtName(''); setNewEvtType('academic'); setNewEvtStart(''); setNewEvtEnd('') }} className="btn-cancel">Cancel</button>
                  <button className="btn-action" onClick={() => {
                    const name = newEvtName.trim()
                    if (!name) { addToast('Please enter an event name', 'error'); return }
                    if (!newEvtStart) { addToast('Please set a start date', 'error'); return }
                    const endDate = newEvtEnd || newEvtStart
                    if (new Date(endDate) < new Date(newEvtStart)) { addToast('End date cannot be before start', 'error'); return }

                    setEditSchoolYears(editSchoolYears.map(sy =>
                      sy.id === showAddEvent.syId
                        ? { ...sy, [dept]: { ...sy[dept], events: [...(sy[dept]?.events || []), { id: Date.now(), name, type: newEvtType, startDate: newEvtStart, endDate }] } }
                        : sy
                    ))
                    setShowAddEvent(null); setNewEvtName(''); setNewEvtType('academic'); setNewEvtStart(''); setNewEvtEnd('')
                    addToast(`"${name}" added to ${targetSY.year}`, 'success')
                  }}>Add Event</button>
                </div>
              </div>
            </div>
            </ModalPortal>
          )
        })()}

        {/* Edit School Year Modal */}
        {editSY && (() => {
          const dept = editSY._dept || 'basic_ed'
          const deptKey = dept === 'college' ? 'college' : 'basicEd'
          const cal = editSY[deptKey] || { startDate: '', endDate: '' }

          return (
            <ModalPortal>
            <div className="modal-backdrop-center">
              <div className="modal-panel-sm">
                <h3 className="text-base font-bold text-[var(--color-text-primary)] mb-1">Edit School Year</h3>
                <p className="text-xs text-[var(--color-text-muted)] mb-5">
                  Editing <span className="font-semibold text-[var(--color-text-primary)]">{editSY.year}</span> · {dept === 'college' ? 'College' : 'Basic Education'} dates
                </p>

                <label className="form-label">School Year</label>
                <input type="text" value={editSY.year} onChange={e => setEditSY({ ...editSY, year: e.target.value })}
                  className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition mb-4" />

                <label className="form-label">Start Date ({dept === 'college' ? 'College' : 'Basic Ed'})</label>
                <input type="date" value={cal.startDate} onChange={e => setEditSY({ ...editSY, [deptKey]: { ...cal, startDate: e.target.value } })}
                  className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition mb-4" />

                <label className="form-label">End Date ({dept === 'college' ? 'College' : 'Basic Ed'})</label>
                <input type="date" value={cal.endDate} onChange={e => setEditSY({ ...editSY, [deptKey]: { ...cal, endDate: e.target.value } })}
                  className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition mb-4" />

                <label className="form-label mb-1.5">Status</label>
                <div className="mb-4">
                  <GroupedSelect value={editSY.status} onChange={v => setEditSY({ ...editSY, status: v })} allLabel={null}
                    options={[
                      { value: 'upcoming', label: 'Upcoming' }, { value: 'active', label: 'Active' }, { value: 'completed', label: 'Completed' },
                    ]} />
                </div>

                <label className="flex items-center gap-3 mb-5 cursor-pointer">
                  <input type="checkbox" checked={editSY.isCurrent || false}
                    onChange={e => setEditSY({ ...editSY, isCurrent: e.target.checked })}
                    className="w-4 h-4 rounded border-[var(--color-border)] text-primary focus:ring-primary" />
                  <span className="text-sm text-[var(--color-text-secondary)]">Set as current school year</span>
                </label>

                <div className="action-row">
                  <button onClick={() => setEditSY(null)} className="btn-cancel">Cancel</button>
                  <button className="btn-action" onClick={() => {
                    const year = editSY.year.trim()
                    if (!year || !/^\d{4}-\d{4}$/.test(year)) { addToast('Format must be YYYY-YYYY', 'error'); return }
                    const [sY, eY] = year.split('-').map(Number)
                    if (eY !== sY + 1) { addToast('End year must be 1 year after start', 'error'); return }
                    const dupe = editSchoolYears.find(sy => sy.year === year && sy.id !== editSY.id)
                    if (dupe) { addToast(`${year} already exists`, 'error'); return }
                    const updatedCal = editSY[deptKey]
                    if (!updatedCal?.startDate || !updatedCal?.endDate) { addToast('Please set both dates', 'error'); return }
                    if (new Date(updatedCal.endDate) <= new Date(updatedCal.startDate)) { addToast('End date must be after start', 'error'); return }

                    setEditSchoolYears(editSchoolYears.map(sy => {
                      if (sy.id === editSY.id) {
                        const updated = { ...editSY }
                        delete updated._dept
                        return updated
                      }
                      if (editSY.isCurrent) return { ...sy, isCurrent: false }
                      return sy
                    }))
                    setEditSY(null)
                    addToast(`${year} updated! Click "Save Changes" to apply.`, 'success')
                  }}>Save Changes</button>
                </div>
              </div>
            </div>
            </ModalPortal>
          )
        })()}

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

        {/* ═══ SCHOOL INFO TAB — collapsible sections ═══ */}

        {/* ═══ SCHOOL INFO TAB — CMS for school website ═══ */}
        {activeTab === 'schoolInfo' && (
          <div className="space-y-3">

            {/* ── Section 1: General Information ── */}
            <div className="bg-[var(--color-bg-card)] rounded-2xl shadow-sm border border-[var(--color-border)]/50 overflow-hidden">
              <button onClick={() => toggleInfoSection('general')} className="w-full flex items-center justify-between p-5 hover:bg-[var(--color-bg-subtle)]/50 transition text-left">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center"><School className="w-4 h-4 text-primary" /></div>
                  <div><h3 className="text-sm font-bold text-[var(--color-text-primary)]">General Information</h3><p className="text-xs text-[var(--color-text-muted)]">School name, motto, contact details, school year</p></div>
                </div>
                <ChevronDown className={`w-5 h-5 text-[var(--color-text-muted)] transition-transform ${infoSections.general ? 'rotate-180' : ''}`} />
              </button>
              {infoSections.general && (
                <div className="border-t border-[var(--color-border)] p-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><label className="form-label">School Name</label><input type="text" value={websiteContent.schoolName} onChange={e => setWebsiteContent({ ...websiteContent, schoolName: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition" /></div>
                    <div><label className="form-label">Current School Year</label><input type="text" value={websiteContent.schoolYear} onChange={e => setWebsiteContent({ ...websiteContent, schoolYear: e.target.value })} placeholder="e.g. 2025-2026" className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition" /></div>
                  </div>
                  <div><label className="form-label">School Motto</label><input type="text" value={websiteContent.motto} onChange={e => setWebsiteContent({ ...websiteContent, motto: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition" /></div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div><label className="form-label">Email</label><input type="email" value={websiteContent.email} onChange={e => setWebsiteContent({ ...websiteContent, email: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition" /></div>
                    <div><label className="form-label">Phone</label><input type="text" value={websiteContent.phone} onChange={e => setWebsiteContent({ ...websiteContent, phone: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition" /></div>
                    <div><label className="form-label">Website</label><input type="text" value={websiteContent.website} onChange={e => setWebsiteContent({ ...websiteContent, website: e.target.value })} className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition" /></div>
                  </div>
                  <div className="flex justify-end"><button onClick={saveWebsiteContent} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-accent-burgundy transition-colors flex items-center gap-2 text-sm font-semibold"><Save className="w-4 h-4" /> Save Changes</button></div>
                </div>
              )}
            </div>

            {/* ── Section 2: System Branding ── */}
            <div className="bg-[var(--color-bg-card)] rounded-2xl shadow-sm border border-[var(--color-border)]/50 overflow-hidden">
              <button onClick={() => toggleInfoSection('branding')} className="w-full flex items-center justify-between p-5 hover:bg-[var(--color-bg-subtle)]/50 transition text-left">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center"><Paintbrush className="w-4 h-4 text-primary" /></div>
                  <div><h3 className="text-sm font-bold text-[var(--color-text-primary)]">System Branding</h3><p className="text-xs text-[var(--color-text-muted)]">Logo, banner, and system colors</p></div>
                </div>
                <ChevronDown className={`w-5 h-5 text-[var(--color-text-muted)] transition-transform ${infoSections.branding ? 'rotate-180' : ''}`} />
              </button>
              {infoSections.branding && (
                <div className="border-t border-[var(--color-border)] p-5 space-y-5">
                  <div>
                    <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2"><Image className="w-4 h-4 text-[var(--color-text-muted)]" /> School Logo</h4>
                    <div className="flex flex-col sm:flex-row items-start gap-4">
                      <div className="w-20 h-20 bg-[var(--color-bg-subtle)] border-2 border-dashed border-[var(--color-border)] rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"><img src="/assets/cshclogo.png" alt="Logo" className="w-16 h-16 object-contain" onError={(e) => { e.target.style.display='none' }} /></div>
                      <div><p className="text-xs text-[var(--color-text-muted)] mb-2">512×512px PNG, transparent background. Max 2MB.</p><button className="flex items-center gap-2 px-3 py-2 text-xs font-medium border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-subtle)] transition text-[var(--color-text-secondary)]" onClick={() => addToast('Logo upload available when backend is connected', 'info')}><Upload className="w-3.5 h-3.5" /> Upload Logo</button></div>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2"><Image className="w-4 h-4 text-[var(--color-text-muted)]" /> School Banner</h4>
                    <div className="w-full h-24 bg-[var(--color-bg-subtle)] border-2 border-dashed border-[var(--color-border)] rounded-xl flex items-center justify-center mb-3 overflow-hidden"><img src="/assets/bg-image.jpg" alt="Banner" className="w-full h-full object-cover" onError={(e) => { e.target.style.display='none' }} /></div>
                    <button className="flex items-center gap-2 px-3 py-2 text-xs font-medium border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-bg-subtle)] transition text-[var(--color-text-secondary)]" onClick={() => addToast('Banner upload available when backend is connected', 'info')}><Upload className="w-3.5 h-3.5" /> Upload Banner</button>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2"><Paintbrush className="w-4 h-4 text-[var(--color-text-muted)]" /> System Colors</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-lg border border-[var(--color-border)]" style={{ backgroundColor: '#750014' }} /><div><p className="text-xs text-[var(--color-text-muted)]">Primary</p><p className="text-sm font-mono text-[var(--color-text-primary)]">#750014</p></div></div>
                      <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-lg border border-[var(--color-border)]" style={{ backgroundColor: '#080c42' }} /><div><p className="text-xs text-[var(--color-text-muted)]">Secondary</p><p className="text-sm font-mono text-[var(--color-text-primary)]">#080c42</p></div></div>
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)] mt-3 flex items-center gap-1.5"><Info className="w-3.5 h-3.5" /> Color customization available when backend is connected</p>
                  </div>
                </div>
              )}
            </div>

            {/* ── Section 3: About — Mission, Vision, Goals, Core Values ── */}
            <div className="bg-[var(--color-bg-card)] rounded-2xl shadow-sm border border-[var(--color-border)]/50 overflow-hidden">
              <button onClick={() => toggleInfoSection('about')} className="w-full flex items-center justify-between p-5 hover:bg-[var(--color-bg-subtle)]/50 transition text-left">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center"><BookOpen className="w-4 h-4 text-primary" /></div>
                  <div><h3 className="text-sm font-bold text-[var(--color-text-primary)]">About Section</h3><p className="text-xs text-[var(--color-text-muted)]">Mission, vision, goals, and core values shown on the website</p></div>
                </div>
                <ChevronDown className={`w-5 h-5 text-[var(--color-text-muted)] transition-transform ${infoSections.about ? 'rotate-180' : ''}`} />
              </button>
              {infoSections.about && (
                <div className="border-t border-[var(--color-border)] p-5 space-y-4">
                  <div><label className="form-label">Mission</label><textarea value={websiteContent.mission} onChange={e => setWebsiteContent({ ...websiteContent, mission: e.target.value })} rows={3} className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition resize-none" /></div>
                  <div><label className="form-label">Vision</label><textarea value={websiteContent.vision} onChange={e => setWebsiteContent({ ...websiteContent, vision: e.target.value })} rows={3} className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition resize-none" /></div>
                  {/* Goals */}
                  <div>
                    <label className="form-label mb-2">Goals</label>
                    <div className="space-y-2 mb-3">
                      {websiteContent.goals.map((goal, idx) => (
                        <div key={idx} className="flex items-start gap-2 p-2.5 bg-[var(--color-bg-subtle)] rounded-lg">
                          <span className="text-xs font-bold text-[var(--color-text-muted)] mt-0.5 w-5 flex-shrink-0">{idx + 1}.</span>
                          <p className="text-sm text-[var(--color-text-primary)] flex-1">{goal}</p>
                          <button onClick={() => setWebsiteContent({ ...websiteContent, goals: websiteContent.goals.filter((_, i) => i !== idx) })} className="icon-btn-ghost flex-shrink-0 hover:!text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input type="text" value={newGoal} onChange={e => setNewGoal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newGoal.trim()) { setWebsiteContent({ ...websiteContent, goals: [...websiteContent.goals, newGoal.trim()] }); setNewGoal('') } }} placeholder="Add a new goal" className="flex-1 px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition" />
                      <button onClick={() => { if (newGoal.trim()) { setWebsiteContent({ ...websiteContent, goals: [...websiteContent.goals, newGoal.trim()] }); setNewGoal('') } }} disabled={!newGoal.trim()} className="btn-action" style={{ flex: 'none', padding: '0.625rem 1rem' }}><Plus className="w-4 h-4" /></button>
                    </div>
                  </div>
                  {/* Core Values */}
                  <div>
                    <label className="form-label mb-2">Core Values</label>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {websiteContent.coreValues.map((val, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium bg-primary/10 text-primary rounded-lg">{val}<button onClick={() => setWebsiteContent({ ...websiteContent, coreValues: websiteContent.coreValues.filter((_, i) => i !== idx) })} className="hover:text-red-500 transition ml-0.5"><X className="w-3 h-3" /></button></span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input type="text" value={newValue} onChange={e => setNewValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newValue.trim()) { setWebsiteContent({ ...websiteContent, coreValues: [...websiteContent.coreValues, newValue.trim()] }); setNewValue('') } }} placeholder="Add a core value" className="flex-1 px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition" />
                      <button onClick={() => { if (newValue.trim()) { setWebsiteContent({ ...websiteContent, coreValues: [...websiteContent.coreValues, newValue.trim()] }); setNewValue('') } }} disabled={!newValue.trim()} className="btn-action" style={{ flex: 'none', padding: '0.625rem 1rem' }}><Plus className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <div className="flex justify-end"><button onClick={saveWebsiteContent} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-accent-burgundy transition-colors flex items-center gap-2 text-sm font-semibold"><Save className="w-4 h-4" /> Save Changes</button></div>
                </div>
              )}
            </div>

            {/* ── Section 4: FAQ Management ── */}
            <div className="bg-[var(--color-bg-card)] rounded-2xl shadow-sm border border-[var(--color-border)]/50 overflow-hidden">
              <button onClick={() => toggleInfoSection('faq')} className="w-full flex items-center justify-between p-5 hover:bg-[var(--color-bg-subtle)]/50 transition text-left">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center"><HelpCircle className="w-4 h-4 text-primary" /></div>
                  <div><h3 className="text-sm font-bold text-[var(--color-text-primary)]">FAQ Management</h3><p className="text-xs text-[var(--color-text-muted)]">{websiteContent.faq.length} question{websiteContent.faq.length !== 1 ? 's' : ''} on the school website</p></div>
                </div>
                <ChevronDown className={`w-5 h-5 text-[var(--color-text-muted)] transition-transform ${infoSections.faq ? 'rotate-180' : ''}`} />
              </button>
              {infoSections.faq && (
                <div className="border-t border-[var(--color-border)] p-5">
                  {/* Existing FAQs */}
                  <div className="space-y-3 mb-4">
                    {websiteContent.faq.map(item => (
                      <div key={item.id} className="border border-[var(--color-border)] rounded-xl p-4">
                        {editFaqId === item.id ? (
                          <div className="space-y-3">
                            <div><label className="form-label">Question</label><input type="text" defaultValue={item.q} id={`faq-q-${item.id}`} className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition" /></div>
                            <div><label className="form-label">Answer</label><textarea defaultValue={item.a} id={`faq-a-${item.id}`} rows={3} className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition resize-none" /></div>
                            <div className="flex gap-2 justify-end">
                              <button onClick={() => setEditFaqId(null)} className="btn-cancel text-xs">Cancel</button>
                              <button onClick={() => {
                                const q = document.getElementById(`faq-q-${item.id}`).value.trim()
                                const a = document.getElementById(`faq-a-${item.id}`).value.trim()
                                if (!q || !a) { addToast('Both question and answer are required', 'error'); return }
                                setWebsiteContent({ ...websiteContent, faq: websiteContent.faq.map(f => f.id === item.id ? { ...f, q, a } : f) })
                                setEditFaqId(null)
                                addToast('FAQ updated', 'success')
                              }} className="btn-action text-xs">Save</button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">{item.q}</h4>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button onClick={() => setEditFaqId(item.id)} className="icon-btn-ghost" title="Edit"><Edit className="w-3.5 h-3.5" /></button>
                                <button onClick={() => { setWebsiteContent({ ...websiteContent, faq: websiteContent.faq.filter(f => f.id !== item.id) }); addToast('FAQ removed', 'success') }} className="icon-btn-ghost hover:!text-red-500" title="Remove"><Trash2 className="w-3.5 h-3.5" /></button>
                              </div>
                            </div>
                            <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{item.a}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {/* Add new FAQ */}
                  <div className="border-2 border-dashed border-[var(--color-border)] rounded-xl p-4 space-y-3">
                    <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Add New Question</h4>
                    <div><input type="text" value={newFaqQ} onChange={e => setNewFaqQ(e.target.value)} placeholder="Question (e.g. What are the tuition fees?)" className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition" /></div>
                    <div><textarea value={newFaqA} onChange={e => setNewFaqA(e.target.value)} placeholder="Answer" rows={3} className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition resize-none" /></div>
                    <div className="flex justify-end">
                      <button disabled={!newFaqQ.trim() || !newFaqA.trim()} onClick={() => {
                        setWebsiteContent({ ...websiteContent, faq: [...websiteContent.faq, { id: Date.now(), q: newFaqQ.trim(), a: newFaqA.trim() }] })
                        setNewFaqQ(''); setNewFaqA('')
                        addToast('FAQ added', 'success')
                      }} className="btn-action text-xs flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> Add Question</button>
                    </div>
                  </div>
                  <div className="flex justify-end mt-4"><button onClick={saveWebsiteContent} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-accent-burgundy transition-colors flex items-center gap-2 text-sm font-semibold"><Save className="w-4 h-4" /> Save All FAQs</button></div>
                </div>
              )}
            </div>

            {/* ── Section 5: Academic Programs ── */}
            <div className="bg-[var(--color-bg-card)] rounded-2xl shadow-sm border border-[var(--color-border)]/50 overflow-hidden">
              <button onClick={() => toggleInfoSection('programs')} className="w-full flex items-center justify-between p-5 hover:bg-[var(--color-bg-subtle)]/50 transition text-left">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center"><GraduationCap className="w-4 h-4 text-primary" /></div>
                  <div><h3 className="text-sm font-bold text-[var(--color-text-primary)]">Academic Programs</h3><p className="text-xs text-[var(--color-text-muted)]">{websiteContent.programs.length} program{websiteContent.programs.length !== 1 ? 's' : ''} listed on the website</p></div>
                </div>
                <ChevronDown className={`w-5 h-5 text-[var(--color-text-muted)] transition-transform ${infoSections.programs ? 'rotate-180' : ''}`} />
              </button>
              {infoSections.programs && (
                <div className="border-t border-[var(--color-border)] p-5">
                  <div className="space-y-3 mb-4">
                    {websiteContent.programs.map(prog => (
                      <div key={prog.id} className={`border rounded-xl p-4 ${prog.highlight ? 'border-primary/30 bg-primary/5' : 'border-[var(--color-border)]'}`}>
                        {editProgramId === prog.id ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div><label className="form-label">Program Title</label><input type="text" defaultValue={prog.title} id={`prog-title-${prog.id}`} className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition" /></div>
                              <div><label className="form-label">Age / Level</label><input type="text" defaultValue={prog.age} id={`prog-age-${prog.id}`} className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition" /></div>
                            </div>
                            <div><label className="form-label">Description</label><textarea defaultValue={prog.description} id={`prog-desc-${prog.id}`} rows={2} className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition resize-none" /></div>
                            <div><label className="form-label">Features (comma-separated)</label><input type="text" defaultValue={prog.features.join(', ')} id={`prog-feat-${prog.id}`} className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition" /></div>
                            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" defaultChecked={prog.highlight} id={`prog-hl-${prog.id}`} className="w-4 h-4 rounded border-[var(--color-border)] text-primary focus:ring-primary" /><span className="text-sm text-[var(--color-text-secondary)]">Highlight this program on the website</span></label>
                            <div className="flex gap-2 justify-end">
                              <button onClick={() => setEditProgramId(null)} className="btn-cancel text-xs">Cancel</button>
                              <button onClick={() => {
                                const title = document.getElementById(`prog-title-${prog.id}`).value.trim()
                                const age = document.getElementById(`prog-age-${prog.id}`).value.trim()
                                const desc = document.getElementById(`prog-desc-${prog.id}`).value.trim()
                                const feat = document.getElementById(`prog-feat-${prog.id}`).value.split(',').map(f => f.trim()).filter(Boolean)
                                const hl = document.getElementById(`prog-hl-${prog.id}`).checked
                                if (!title) { addToast('Program title is required', 'error'); return }
                                setWebsiteContent({ ...websiteContent, programs: websiteContent.programs.map(p => p.id === prog.id ? { ...p, title, age, description: desc, features: feat, highlight: hl } : p) })
                                setEditProgramId(null); addToast('Program updated', 'success')
                              }} className="btn-action text-xs">Save</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="text-sm font-bold text-[var(--color-text-primary)]">{prog.title}</h4>
                                <span className="px-2 py-0.5 text-[9px] font-semibold rounded-full bg-primary/10 text-primary">{prog.age}</span>
                                {prog.highlight && <span className="px-2 py-0.5 text-[9px] font-semibold rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">Featured</span>}
                              </div>
                              <p className="text-xs text-[var(--color-text-muted)] mb-2">{prog.description}</p>
                              <div className="flex flex-wrap gap-1">{prog.features.map(f => <span key={f} className="px-2 py-0.5 text-[9px] rounded bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)]">{f}</span>)}</div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button onClick={() => setEditProgramId(prog.id)} className="icon-btn-ghost" title="Edit"><Edit className="w-3.5 h-3.5" /></button>
                              <button onClick={() => { setWebsiteContent({ ...websiteContent, programs: websiteContent.programs.filter(p => p.id !== prog.id) }); addToast('Program removed', 'success') }} className="icon-btn-ghost hover:!text-red-500" title="Remove"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {showAddProgram ? (
                    <div className="border-2 border-dashed border-[var(--color-border)] rounded-xl p-4 space-y-3">
                      <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Add New Program</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div><label className="form-label">Title</label><input type="text" id="new-prog-title" placeholder="e.g. Senior High School" className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition" /></div>
                        <div><label className="form-label">Age / Level</label><input type="text" id="new-prog-age" placeholder="e.g. Grades 11-12" className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition" /></div>
                      </div>
                      <div><label className="form-label">Description</label><textarea id="new-prog-desc" rows={2} placeholder="Brief description" className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition resize-none" /></div>
                      <div><label className="form-label">Features (comma-separated)</label><input type="text" id="new-prog-feat" placeholder="e.g. Board exam prep, Practical training" className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition" /></div>
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setShowAddProgram(false)} className="btn-cancel text-xs">Cancel</button>
                        <button onClick={() => {
                          const title = document.getElementById('new-prog-title').value.trim()
                          const age = document.getElementById('new-prog-age').value.trim()
                          const desc = document.getElementById('new-prog-desc').value.trim()
                          const feat = document.getElementById('new-prog-feat').value.split(',').map(f => f.trim()).filter(Boolean)
                          if (!title) { addToast('Program title is required', 'error'); return }
                          setWebsiteContent({ ...websiteContent, programs: [...websiteContent.programs, { id: Date.now(), title, age, description: desc, features: feat, highlight: false }] })
                          setShowAddProgram(false); addToast('Program added', 'success')
                        }} className="btn-action text-xs flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> Add Program</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setShowAddProgram(true)} className="w-full py-3 border-2 border-dashed border-[var(--color-border)] rounded-xl text-xs text-[var(--color-text-muted)] font-medium hover:border-primary hover:text-primary transition flex items-center justify-center gap-1.5"><Plus className="w-3.5 h-3.5" /> Add New Program</button>
                  )}
                  <div className="flex justify-end mt-4"><button onClick={saveWebsiteContent} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-accent-burgundy transition-colors flex items-center gap-2 text-sm font-semibold"><Save className="w-4 h-4" /> Save Programs</button></div>
                </div>
              )}
            </div>

            {/* ── Section 6: Admission Requirements & Steps ── */}
            <div className="bg-[var(--color-bg-card)] rounded-2xl shadow-sm border border-[var(--color-border)]/50 overflow-hidden">
              <button onClick={() => toggleInfoSection('admissions')} className="w-full flex items-center justify-between p-5 hover:bg-[var(--color-bg-subtle)]/50 transition text-left">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center"><Tag className="w-4 h-4 text-primary" /></div>
                  <div><h3 className="text-sm font-bold text-[var(--color-text-primary)]">Admission</h3><p className="text-xs text-[var(--color-text-muted)]">Enrollment requirements and steps shown on the website</p></div>
                </div>
                <ChevronDown className={`w-5 h-5 text-[var(--color-text-muted)] transition-transform ${infoSections.admissions ? 'rotate-180' : ''}`} />
              </button>
              {infoSections.admissions && (
                <div className="border-t border-[var(--color-border)] p-5 space-y-5">
                  {/* Requirements */}
                  <div>
                    <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Enrollment Requirements</h4>
                    <div className="space-y-2 mb-3">
                      {websiteContent.requirements.map(req => (
                        <div key={req.id} className="flex items-start gap-3 p-3 bg-[var(--color-bg-subtle)] rounded-lg">
                          <span className="text-lg flex-shrink-0">{req.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[var(--color-text-primary)]">{req.title}</p>
                            <p className="text-xs text-[var(--color-text-muted)]">{req.desc}</p>
                          </div>
                          <button onClick={() => { setWebsiteContent({ ...websiteContent, requirements: websiteContent.requirements.filter(r => r.id !== req.id) }); addToast('Requirement removed', 'success') }} className="icon-btn-ghost flex-shrink-0 hover:!text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      ))}
                    </div>
                    {showAddRequirement ? (
                      <div className="border-2 border-dashed border-[var(--color-border)] rounded-xl p-4 space-y-3">
                        <div className="grid grid-cols-[60px_1fr] gap-3">
                          <div><label className="form-label">Icon</label><input type="text" id="new-req-icon" defaultValue="📄" maxLength={2} className="w-full px-3 py-2.5 text-sm text-center border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition" /></div>
                          <div><label className="form-label">Title</label><input type="text" id="new-req-title" placeholder="e.g. Birth Certificate" className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition" /></div>
                        </div>
                        <div><label className="form-label">Description</label><input type="text" id="new-req-desc" placeholder="e.g. Original and photocopy (PSA issued)" className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition" /></div>
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setShowAddRequirement(false)} className="btn-cancel text-xs">Cancel</button>
                          <button onClick={() => {
                            const icon = document.getElementById('new-req-icon').value.trim() || '📄'
                            const title = document.getElementById('new-req-title').value.trim()
                            const desc = document.getElementById('new-req-desc').value.trim()
                            if (!title) { addToast('Title is required', 'error'); return }
                            setWebsiteContent({ ...websiteContent, requirements: [...websiteContent.requirements, { id: Date.now(), icon, title, desc }] })
                            setShowAddRequirement(false); addToast('Requirement added', 'success')
                          }} className="btn-action text-xs flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> Add</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setShowAddRequirement(true)} className="text-xs text-primary font-medium hover:underline flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add Requirement</button>
                    )}
                  </div>

                  {/* Enrollment Steps */}
                  <div>
                    <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">How to Enroll (Steps)</h4>
                    <div className="space-y-2 mb-3">
                      {websiteContent.steps.map((step, idx) => (
                        <div key={step.id} className="flex items-start gap-3 p-3 bg-[var(--color-bg-subtle)] rounded-lg">
                          <div className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold flex-shrink-0">{idx + 1}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[var(--color-text-primary)]">{step.title}</p>
                            <p className="text-xs text-[var(--color-text-muted)]">{step.desc}</p>
                          </div>
                          <button onClick={() => { setWebsiteContent({ ...websiteContent, steps: websiteContent.steps.filter(s => s.id !== step.id) }); addToast('Step removed', 'success') }} className="icon-btn-ghost flex-shrink-0 hover:!text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      ))}
                    </div>
                    {showAddStep ? (
                      <div className="border-2 border-dashed border-[var(--color-border)] rounded-xl p-4 space-y-3">
                        <div><label className="form-label">Step Title</label><input type="text" id="new-step-title" placeholder="e.g. Submit Online Form" className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition" /></div>
                        <div><label className="form-label">Description</label><input type="text" id="new-step-desc" placeholder="e.g. Fill out our online enrollment form" className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition" /></div>
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setShowAddStep(false)} className="btn-cancel text-xs">Cancel</button>
                          <button onClick={() => {
                            const title = document.getElementById('new-step-title').value.trim()
                            const desc = document.getElementById('new-step-desc').value.trim()
                            if (!title) { addToast('Step title is required', 'error'); return }
                            setWebsiteContent({ ...websiteContent, steps: [...websiteContent.steps, { id: Date.now(), title, desc }] })
                            setShowAddStep(false); addToast('Step added', 'success')
                          }} className="btn-action text-xs flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> Add Step</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setShowAddStep(true)} className="text-xs text-primary font-medium hover:underline flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add Step</button>
                    )}
                  </div>

                  <div className="flex justify-end"><button onClick={saveWebsiteContent} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-accent-burgundy transition-colors flex items-center gap-2 text-sm font-semibold"><Save className="w-4 h-4" /> Save Admission Info</button></div>
                </div>
              )}
            </div>

            {/* ── Section 7: Campus Configuration ── */}
            <div className="bg-[var(--color-bg-card)] rounded-2xl shadow-sm border border-[var(--color-border)]/50 overflow-hidden">
              <button onClick={() => toggleInfoSection('campuses')} className="w-full flex items-center justify-between p-5 hover:bg-[var(--color-bg-subtle)]/50 transition text-left">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center"><Building2 className="w-4 h-4 text-primary" /></div>
                  <div><h3 className="text-sm font-bold text-[var(--color-text-primary)]">Campus Configuration</h3><p className="text-xs text-[var(--color-text-muted)]">{editCampuses.length} campus{editCampuses.length !== 1 ? 'es' : ''} configured</p></div>
                </div>
                <ChevronDown className={`w-5 h-5 text-[var(--color-text-muted)] transition-transform ${infoSections.campuses ? 'rotate-180' : ''}`} />
              </button>
              {infoSections.campuses && (
                <div className="border-t border-[var(--color-border)] p-5">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs text-[var(--color-text-muted)]">Manage campus locations, departments, and programs</p>
                    <button onClick={() => { setCampusForm({ name: '', key: '', address: '', contactNumber: '', email: '', hasBasicEd: true, hasCollege: false, collegePrograms: [], newProgram: '' }); setEditCampusId(null); setShowAddCampus(true) }} className="text-xs text-primary font-medium hover:underline flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add Campus</button>
                  </div>
                  <div className="space-y-3">
                    {editCampuses.map(campus => (
                      <div key={campus.id} className={`border rounded-xl p-4 transition-colors ${campus.isActive ? 'border-[var(--color-border)] hover:border-primary' : 'border-[var(--color-border)] opacity-60'}`}>
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="text-sm font-bold text-[var(--color-text-primary)]">{campus.name}</h4>
                              <span className={`px-1.5 py-0.5 text-[9px] font-semibold rounded-full uppercase tracking-wider ${campus.isActive ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]'}`}>{campus.isActive ? 'Active' : 'Inactive'}</span>
                            </div>
                            <p className="text-xs text-[var(--color-text-muted)] font-mono">Key: {campus.key}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button onClick={() => { setCampusForm({ name: campus.name, key: campus.key, address: campus.address || '', contactNumber: campus.contactNumber || '', email: campus.email || '', hasBasicEd: campus.hasBasicEd !== false, hasCollege: campus.hasCollege || false, collegePrograms: [...(campus.collegePrograms || [])], newProgram: '' }); setEditCampusId(campus.id); setShowAddCampus(true) }} className="icon-btn-ghost" title="Edit campus"><Edit className="w-4 h-4" /></button>
                            <button onClick={() => { if (editCampuses.length <= 1) { addToast('You need at least one campus', 'error'); return } if (!window.confirm(`Remove "${campus.name}"?`)) return; setEditCampuses(editCampuses.filter(c => c.id !== campus.id)); addToast(`${campus.name} removed. Click "Save Campuses" to apply.`, 'success') }} className="icon-btn-ghost hover:!text-red-500" title="Remove campus"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </div>
                        {campus.address && <p className="text-xs text-[var(--color-text-secondary)] flex items-center gap-1.5 mb-1"><MapPin className="w-3 h-3 text-[var(--color-text-muted)]" /> {campus.address}</p>}
                        {campus.contactNumber && <p className="text-xs text-[var(--color-text-muted)] mb-2">{campus.contactNumber} · {campus.email}</p>}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {campus.hasBasicEd !== false && <span className="px-2 py-0.5 text-[9px] font-semibold rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 flex items-center gap-1"><BookOpen className="w-2.5 h-2.5" /> Basic Ed</span>}
                          {campus.hasCollege && <span className="px-2 py-0.5 text-[9px] font-semibold rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 flex items-center gap-1"><GraduationCap className="w-2.5 h-2.5" /> College</span>}
                          {(campus.collegePrograms || []).map(prog => <span key={prog} className="px-2 py-0.5 text-[9px] rounded-lg bg-[var(--color-bg-subtle)] text-[var(--color-text-secondary)]">{prog}</span>)}
                        </div>
                        {campus.workflowConfirmed === false && <p className="text-[9px] text-yellow-600 dark:text-yellow-400 mt-2 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Workflow not yet confirmed</p>}
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center justify-end"><button onClick={() => saveSection('campuses', editCampuses)} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-accent-burgundy transition-colors flex items-center gap-2 text-sm font-semibold">{savedSection === 'campuses' ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}{savedSection === 'campuses' ? 'Saved!' : 'Save Campuses'}</button></div>
                </div>
              )}
            </div>
          </div>
        )}


        {/* Add / Edit Campus Modal */}
        {showAddCampus && (
          <ModalPortal>
          <div className="modal-backdrop">
            <div className="modal-panel" style={{ maxWidth: '36rem' }}>
              <div className="modal-header">
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-[var(--color-text-primary)]">{editCampusId ? 'Edit Campus' : 'Add New Campus'}</h3>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{editCampusId ? `Editing ${campusForm.name}` : 'Configure a new campus location'}</p>
                </div>
                <button onClick={() => setShowAddCampus(false)} className="icon-btn-ghost ml-2 flex-shrink-0"><X className="w-5 h-5" /></button>
              </div>
              <div className="overflow-y-auto flex-1 p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><label className="form-label">Campus Name</label><input type="text" value={campusForm.name} onChange={e => setCampusForm({ ...campusForm, name: e.target.value })} placeholder="e.g. Carcar City Campus" className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition" /></div>
                  <div><label className="form-label">Campus Key</label><input type="text" value={campusForm.key} onChange={e => setCampusForm({ ...campusForm, key: e.target.value })} placeholder="e.g. Carcar" className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition" /><p className="text-[10px] text-[var(--color-text-muted)] mt-1">No spaces. Used for data filtering.</p></div>
                </div>
                <div><label className="form-label">Address</label><input type="text" value={campusForm.address} onChange={e => setCampusForm({ ...campusForm, address: e.target.value })} placeholder="e.g. Valladolid, Carcar City, Cebu" className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition" /></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><label className="form-label">Contact Number</label><input type="text" value={campusForm.contactNumber} onChange={e => setCampusForm({ ...campusForm, contactNumber: e.target.value })} placeholder="e.g. 032-234-5678" className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition" /></div>
                  <div><label className="form-label">Email</label><input type="email" value={campusForm.email} onChange={e => setCampusForm({ ...campusForm, email: e.target.value })} placeholder="e.g. carcar@cshc.edu.ph" className="w-full px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition" /></div>
                </div>
                <div>
                  <label className="form-label mb-2">Departments</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={campusForm.hasBasicEd} onChange={e => setCampusForm({ ...campusForm, hasBasicEd: e.target.checked })} className="w-4 h-4 rounded border-[var(--color-border)] text-primary focus:ring-primary" /><span className="text-sm text-[var(--color-text-secondary)] flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" /> Basic Education</span></label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={campusForm.hasCollege} onChange={e => setCampusForm({ ...campusForm, hasCollege: e.target.checked })} className="w-4 h-4 rounded border-[var(--color-border)] text-primary focus:ring-primary" /><span className="text-sm text-[var(--color-text-secondary)] flex items-center gap-1.5"><GraduationCap className="w-3.5 h-3.5" /> College</span></label>
                  </div>
                </div>
                {campusForm.hasCollege && (
                  <div>
                    <label className="form-label mb-2">College Programs</label>
                    {campusForm.collegePrograms.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {campusForm.collegePrograms.map(prog => (
                          <span key={prog} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg">
                            {prog}<button onClick={() => setCampusForm({ ...campusForm, collegePrograms: campusForm.collegePrograms.filter(p => p !== prog) })} className="hover:text-red-500 transition ml-0.5"><X className="w-3 h-3" /></button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input type="text" value={campusForm.newProgram} onChange={e => setCampusForm({ ...campusForm, newProgram: e.target.value })}
                        onKeyDown={e => { if (e.key === 'Enter' && campusForm.newProgram.trim()) { const prog = campusForm.newProgram.trim(); if (!campusForm.collegePrograms.includes(prog)) setCampusForm({ ...campusForm, collegePrograms: [...campusForm.collegePrograms, prog], newProgram: '' }) } }}
                        placeholder="e.g. BS Criminology" className="flex-1 px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition" />
                      <button onClick={() => { const prog = campusForm.newProgram.trim(); if (prog && !campusForm.collegePrograms.includes(prog)) setCampusForm({ ...campusForm, collegePrograms: [...campusForm.collegePrograms, prog], newProgram: '' }) }} disabled={!campusForm.newProgram.trim()} className="btn-action" style={{ flex: 'none', padding: '0.625rem 1rem' }}><Plus className="w-4 h-4" /></button>
                    </div>
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-1.5">Press Enter or click + to add</p>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button onClick={() => setShowAddCampus(false)} className="btn-cancel">Cancel</button>
                <button className="btn-action" onClick={() => {
                  const name = campusForm.name.trim(); const key = campusForm.key.trim()
                  if (!name) { addToast('Please enter a campus name', 'error'); return }
                  if (!key) { addToast('Please enter a campus key', 'error'); return }
                  if (/\s/.test(key)) { addToast('Campus key cannot contain spaces', 'error'); return }
                  if (editCampusId) {
                    if (editCampuses.find(c => c.key === key && c.id !== editCampusId)) { addToast(`Key "${key}" already exists`, 'error'); return }
                    setEditCampuses(editCampuses.map(c => c.id === editCampusId ? { ...c, name, key, address: campusForm.address.trim(), contactNumber: campusForm.contactNumber.trim(), email: campusForm.email.trim(), hasBasicEd: campusForm.hasBasicEd, hasCollege: campusForm.hasCollege, collegePrograms: campusForm.hasCollege ? campusForm.collegePrograms : [] } : c))
                    addToast(`${name} updated! Click "Save Campuses" to apply.`, 'success')
                  } else {
                    if (editCampuses.find(c => c.key === key)) { addToast(`Key "${key}" already exists`, 'error'); return }
                    setEditCampuses([...editCampuses, { id: Date.now(), key, name, address: campusForm.address.trim(), contactNumber: campusForm.contactNumber.trim(), email: campusForm.email.trim(), isActive: true, workflowConfirmed: false, hasBasicEd: campusForm.hasBasicEd, hasCollege: campusForm.hasCollege, collegePrograms: campusForm.hasCollege ? campusForm.collegePrograms : [], roles: { hasPrincipal: true, hasProgramHead: campusForm.hasCollege, hasRegistrarBasic: true, hasRegistrarCollege: campusForm.hasCollege, hasAccounting: true } }])
                    addToast(`${name} added! Click "Save Campuses" to apply.`, 'success')
                  }
                  setShowAddCampus(false)
                }}>{editCampusId ? 'Save Changes' : 'Add Campus'}</button>
              </div>
            </div>
          </div>
          </ModalPortal>
        )}

        {/* ═══ TICKETS TAB ═══ */}
        {activeTab === 'tickets' && (() => {
          const typeLabels = { account: 'Account Issue', bug: 'System Bug', access: 'Access Request', inquiry: 'General Inquiry' }
          const typeIcons = { account: Shield, bug: Bug, access: UserPlus, inquiry: HelpCircle }
          const typeColors = { account: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400', bug: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400', access: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400', inquiry: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' }
          const priorityColors = { low: 'bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]', medium: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400', high: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400', urgent: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' }
          const statusColors = { open: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400', in_progress: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400', on_hold: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400', resolved: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400', closed: 'bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)]' }
          const statusLabels = { open: 'Open', in_progress: 'In Progress', on_hold: 'On Hold', resolved: 'Resolved', closed: 'Closed' }
          const fmtDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          const fmtTime = (d) => new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

          const filtered = tickets.filter(t => {
            if (ticketFilterStatus !== 'all' && t.status !== ticketFilterStatus) return false
            if (ticketFilterType !== 'all' && t.type !== ticketFilterType) return false
            return true
          })

          return (
          <div className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Open', value: ticketStats.open, color: 'border-yellow-500' },
                { label: 'In Progress', value: ticketStats.inProgress, color: 'border-blue-500' },
                { label: 'Urgent/High', value: ticketStats.urgent + ticketStats.high, color: 'border-red-500' },
                { label: 'Resolved', value: ticketStats.resolved, color: 'border-green-500' },
              ].map(s => (
                <div key={s.label} className={`stat-card ${s.color}`}>
                  <p className="text-xs text-[var(--color-text-muted)]">{s.label}</p>
                  <p className="text-2xl font-bold text-[var(--color-text-primary)]">{s.value}</p>
                </div>
              ))}
            </div>

            {/* Filters */}
            <div className="card p-4 flex flex-col sm:flex-row gap-3">
              <div className="flex-1"><GroupedSelect value={ticketFilterStatus} onChange={setTicketFilterStatus} allLabel="All Status" options={[{ value: 'open', label: 'Open' }, { value: 'in_progress', label: 'In Progress' }, { value: 'on_hold', label: 'On Hold' }, { value: 'resolved', label: 'Resolved' }, { value: 'closed', label: 'Closed' }]} /></div>
              <div className="flex-1"><GroupedSelect value={ticketFilterType} onChange={setTicketFilterType} allLabel="All Types" options={[{ value: 'account', label: 'Account Issue' }, { value: 'bug', label: 'System Bug' }, { value: 'access', label: 'Access Request' }, { value: 'inquiry', label: 'General Inquiry' }]} /></div>
            </div>

            {/* Ticket list */}
            <div className="bg-[var(--color-bg-card)] rounded-2xl shadow-sm border border-[var(--color-border)]/50 overflow-hidden">
              {filtered.length === 0 ? (
                <div className="text-center py-12">
                  <Ticket className="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-3 opacity-40" />
                  <p className="text-sm text-[var(--color-text-muted)]">{tickets.length === 0 ? 'No support tickets yet' : 'No tickets match current filters'}</p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--color-border)]">
                  {filtered.map(t => {
                    const TypeIcon = typeIcons[t.type] || HelpCircle
                    return (
                      <button key={t.id} onClick={() => setSelectedTicket(t)} className="w-full text-left p-4 hover:bg-[var(--color-bg-subtle)]/50 transition flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${typeColors[t.type]}`}><TypeIcon className="w-4 h-4" /></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{t.subject}</span>
                            <span className={`px-1.5 py-0.5 text-[9px] font-semibold rounded uppercase tracking-wider ${statusColors[t.status]}`}>{statusLabels[t.status]}</span>
                            <span className={`px-1.5 py-0.5 text-[9px] font-semibold rounded uppercase tracking-wider ${priorityColors[t.priority]}`}>{t.priority}</span>
                          </div>
                          <p className="text-xs text-[var(--color-text-muted)]">{t.ticketNumber} · {t.submittedBy.name} · {fmtDate(t.submittedDate)}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)] flex-shrink-0 mt-2" />
                      </button>
                    )
                  })}
                </div>
              )}
              <div className="px-4 py-3 border-t border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
                {filtered.length} of {tickets.length} ticket{tickets.length !== 1 ? 's' : ''}
              </div>
            </div>

            {/* Ticket Detail Modal */}
            {selectedTicket && (
              <ModalPortal>
              <div className="modal-backdrop">
                <div className="modal-panel" style={{ maxWidth: '40rem' }}>
                  <div className="modal-header">
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-[var(--color-text-primary)] truncate">{selectedTicket.subject}</h3>
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{selectedTicket.ticketNumber} · {fmtDate(selectedTicket.submittedDate)}</p>
                    </div>
                    <button onClick={() => { setSelectedTicket(null); setTicketNote('') }} className="icon-btn-ghost ml-2 flex-shrink-0"><X className="w-5 h-5" /></button>
                  </div>
                  <div className="overflow-y-auto flex-1 p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="form-label mb-1.5">Status</label><GroupedSelect value={selectedTicket.status} allLabel={null} onChange={v => { updateTicketStatus(selectedTicket.id, v); setSelectedTicket({ ...selectedTicket, status: v }); setTickets(getAllTickets()); setTicketStats(getTicketStats()); addToast(`Status → ${statusLabels[v]}`, 'success') }} options={[{ value: 'open', label: 'Open' }, { value: 'in_progress', label: 'In Progress' }, { value: 'on_hold', label: 'On Hold' }, { value: 'resolved', label: 'Resolved' }, { value: 'closed', label: 'Closed' }]} /></div>
                      <div><label className="form-label mb-1.5">Priority</label><GroupedSelect value={selectedTicket.priority} allLabel={null} onChange={v => { updateTicketPriority(selectedTicket.id, v); setSelectedTicket({ ...selectedTicket, priority: v }); setTickets(getAllTickets()); setTicketStats(getTicketStats()); addToast('Priority updated', 'success') }} options={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }, { value: 'urgent', label: 'Urgent' }]} /></div>
                    </div>
                    <div className="bg-[var(--color-bg-subtle)] rounded-xl p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div><span className="text-xs text-[var(--color-text-muted)]">Type</span><p className="font-medium text-[var(--color-text-primary)]">{typeLabels[selectedTicket.type]}</p></div>
                        <div><span className="text-xs text-[var(--color-text-muted)]">Submitted by</span><p className="font-medium text-[var(--color-text-primary)]">{selectedTicket.submittedBy.name}</p></div>
                        <div><span className="text-xs text-[var(--color-text-muted)]">Role</span><p className="font-medium text-[var(--color-text-primary)] capitalize">{selectedTicket.submittedBy.role?.replace('_', ' ')}</p></div>
                        <div><span className="text-xs text-[var(--color-text-muted)]">Campus</span><p className="font-medium text-[var(--color-text-primary)]">{selectedTicket.submittedBy.campus || 'All'}</p></div>
                      </div>
                      <div className="border-t border-[var(--color-border)] pt-3">
                        <span className="text-xs text-[var(--color-text-muted)]">Description</span>
                        <p className="text-sm text-[var(--color-text-primary)] mt-1 whitespace-pre-wrap">{selectedTicket.description || 'No description.'}</p>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2"><MessageSquare className="w-4 h-4 text-[var(--color-text-muted)]" /> Notes ({selectedTicket.notes?.length || 0})</h4>
                      {(selectedTicket.notes || []).map(note => (
                        <div key={note.id} className="p-3 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg mb-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-primary">{note.author}</span>
                            <span className="text-[10px] text-[var(--color-text-muted)]">{fmtDate(note.date)} {fmtTime(note.date)}</span>
                          </div>
                          <p className="text-sm text-[var(--color-text-primary)]">{note.text}</p>
                        </div>
                      ))}
                      <div className="flex gap-2 mt-2">
                        <input type="text" value={ticketNote} onChange={e => setTicketNote(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter' && ticketNote.trim()) { const updated = addTicketNote(selectedTicket.id, ticketNote.trim(), 'Technical Admin'); if (updated) setSelectedTicket(updated); setTicketNote(''); setTickets(getAllTickets()); addToast('Note added', 'success') } }}
                          placeholder="Add a note..." className="flex-1 px-3 py-2.5 text-sm border border-[var(--color-border)] rounded-xl bg-[var(--color-bg-subtle)] text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-primary transition" />
                        <button onClick={() => { if (!ticketNote.trim()) return; const updated = addTicketNote(selectedTicket.id, ticketNote.trim(), 'Technical Admin'); if (updated) setSelectedTicket(updated); setTicketNote(''); setTickets(getAllTickets()); addToast('Note added', 'success') }}
                          disabled={!ticketNote.trim()} className="btn-action" style={{ flex: 'none', padding: '0.625rem 1rem' }}><Send className="w-4 h-4" /></button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              </ModalPortal>
            )}
          </div>
          )
        })()}

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
      <ToastContainer toasts={toasts} removeToast={removeToast} />
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
  const { toasts, addToast, removeToast } = useToast()

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

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  )
}