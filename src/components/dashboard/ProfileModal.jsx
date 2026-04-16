/**
 * ProfileModal.jsx — CSHC Admin Portal
 * ─────────────────────────────────────────────────────────────────
 * Rev. 4 UI Cleanup:
 *  - All hardcoded bg-white/bg-gray-800 → var(--color-bg-card)
 *  - All border-gray-* → var(--color-border)
 *  - All text-gray-* → var(--color-text-*)
 *  - All bg-gray-50/100/700 → var(--color-bg-subtle/muted)
 *  - shadow-2xl → var(--shadow-modal)
 *  - backdrop-blur-sm → removed
 *  - hover:bg-gray-50/100/700 → var(--color-bg-subtle)
 *  - All inputs use .input class from design tokens
 *  - Toast uses semantic token colors
 *  - No gradients, no shadow-2xl, no hover:scale, no backdrop-blur
 * ─────────────────────────────────────────────────────────────────
 */
import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  X, Camera, User, Mail, Phone, Lock, Eye, EyeOff,
  CheckCircle, AlertCircle, Shield, Save, ChevronRight, ArrowLeft
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useAvatar } from '../../hooks/useAvatar'

// ── Helpers ───────────────────────────────────────────
const ROLE_LABELS = {
  admin: 'Administrator',
  technical_admin: 'Technical Admin',
  registrar_basic: 'Basic Ed Registrar',
  registrar_college: 'College Registrar',
  accounting: 'Accounting Officer',
  principal_basic: 'Basic Ed Principal',
  program_head: 'Program Head',
}

const ROLE_COLORS = {
  admin:              { bg: 'var(--color-primary-muted)',   text: 'var(--color-primary)' },
  technical_admin:    { bg: 'var(--color-primary-muted)',   text: 'var(--color-primary)' },
  registrar_basic:    { bg: 'var(--color-info-light)',      text: 'var(--color-info)' },
  registrar_college:  { bg: 'rgba(124,58,237,0.08)',        text: '#7c3aed' },
  accounting:         { bg: 'var(--color-success-light)',   text: 'var(--color-success)' },
  principal_basic:    { bg: 'var(--color-warning-light)',   text: 'var(--color-warning)' },
  program_head:       { bg: 'var(--color-info-light)',      text: 'var(--color-info)' },
}

function Toast({ message, type }) {
  return (
    <div
      className="flex items-center gap-2 px-4 py-3 rounded-[var(--radius-lg)] text-sm font-medium"
      style={{
        backgroundColor: type === 'success' ? 'var(--color-success-light)' : 'var(--color-error-light)',
        color: type === 'success' ? 'var(--color-success)' : 'var(--color-error)',
        border: `1px solid ${type === 'success' ? 'var(--color-success-border)' : 'var(--color-error-border)'}`,
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {type === 'success'
        ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
        : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
      {message}
    </div>
  )
}

// ── Main Modal ────────────────────────────────────────
export default function ProfileModal({ onClose }) {
  const { user, logout } = useAuth()

  // Pull persisted profile extras from localStorage
  const savedExtras = JSON.parse(localStorage.getItem(`cshc_profile_${user?.id}`) || '{}')

  const [activeSection, setActiveSection] = useState(null)  // null = overview
  const [toast, setToast]   = useState(null)
  const [avatar, setAvatar] = useAvatar(user?.id)

  // ── Field states ──────────────────────────────────
  const [displayName, setDisplayName] = useState(savedExtras.displayName || user?.name || '')

  // Email change
  const [newEmail, setNewEmail]           = useState('')
  const [emailVerifyCode, setEmailVerifyCode] = useState('')
  const [emailCodeSent, setEmailCodeSent] = useState(false)
  const [emailLoading, setEmailLoading]   = useState(false)

  // Phone
  const [phone, setPhone]                 = useState(savedExtras.phone || '')
  const [phoneVerifyCode, setPhoneVerifyCode] = useState('')
  const [phoneCodeSent, setPhoneCodeSent] = useState(false)
  const [phoneLoading, setPhoneLoading]   = useState(false)
  const [phoneVerified, setPhoneVerified] = useState(savedExtras.phoneVerified || false)

  // Password
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword]         = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent]         = useState(false)
  const [showNew, setShowNew]                 = useState(false)
  const [showConfirm, setShowConfirm]         = useState(false)
  const [pwLoading, setPwLoading]             = useState(false)

  const fileRef = useRef()

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  const saveExtras = (updates) => {
    const current = JSON.parse(localStorage.getItem(`cshc_profile_${user?.id}`) || '{}')
    localStorage.setItem(`cshc_profile_${user?.id}`, JSON.stringify({ ...current, ...updates }))
  }

  // ── Avatar ────────────────────────────────────────
  const handleAvatarChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image must be under 5MB', 'error'); return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      setAvatar(ev.target.result)
      showToast('Profile picture updated!')
    }
    reader.readAsDataURL(file)
  }

  // ── Email change (mock verification) ─────────────
  const handleSendEmailCode = () => {
    if (!newEmail || !newEmail.includes('@')) {
      showToast('Enter a valid email address', 'error'); return
    }
    setEmailLoading(true)
    setTimeout(() => {
      setEmailCodeSent(true)
      setEmailLoading(false)
      showToast(`Verification code sent to ${newEmail}`)
    }, 1200)
  }

  const handleVerifyEmail = () => {
    if (emailVerifyCode !== '123456') {
      showToast('Invalid code. (Hint: use 123456)', 'error'); return
    }
    const storedUser = JSON.parse(localStorage.getItem('cshc_user') || '{}')
    storedUser.email = newEmail
    localStorage.setItem('cshc_user', JSON.stringify(storedUser))
    saveExtras({ verifiedEmail: newEmail })
    showToast('Email updated successfully!')
    setNewEmail(''); setEmailVerifyCode(''); setEmailCodeSent(false)
    setActiveSection(null)
  }

  // ── Phone (mock verification) ─────────────────────
  const handleSendPhoneCode = () => {
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length < 10) {
      showToast('Enter a valid phone number', 'error'); return
    }
    setPhoneLoading(true)
    setTimeout(() => {
      setPhoneCodeSent(true)
      setPhoneLoading(false)
      showToast(`Verification code sent to ${phone}`)
    }, 1200)
  }

  const handleVerifyPhone = () => {
    if (phoneVerifyCode !== '123456') {
      showToast('Invalid code. (Hint: use 123456)', 'error'); return
    }
    setPhoneVerified(true)
    saveExtras({ phone, phoneVerified: true })
    showToast('Phone number verified!')
    setPhoneVerifyCode(''); setPhoneCodeSent(false)
    setActiveSection(null)
  }

  // ── Password ──────────────────────────────────────
  const MOCK_PASSWORDS = {
    admin: 'admin123',
    technical_admin: 'techadmin123',
    registrar_basic: 'registrar123',
    registrar_college: 'registrar123',
    accounting: 'accounting123',
    principal_basic: 'principal123',
    program_head: 'principal123',
  }

  const pwStrength = (pw) => {
    if (!pw) return null
    let score = 0
    if (pw.length >= 8)              score++
    if (/[A-Z]/.test(pw))            score++
    if (/[0-9]/.test(pw))            score++
    if (/[^A-Za-z0-9]/.test(pw))    score++
    return score
  }

  const strength = pwStrength(newPassword)
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][strength || 0]
  const strengthColors = ['', 'var(--color-error)', 'var(--color-warning)', 'var(--color-info)', 'var(--color-success)']

  const handleChangePassword = () => {
    if (currentPassword !== MOCK_PASSWORDS[user?.role]) {
      showToast('Current password is incorrect', 'error'); return
    }
    if (newPassword.length < 8) {
      showToast('New password must be at least 8 characters', 'error'); return
    }
    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match', 'error'); return
    }
    setPwLoading(true)
    setTimeout(() => {
      setPwLoading(false)
      showToast('Password changed successfully!')
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
      setActiveSection(null)
    }, 1000)
  }

  // ── Sections config ───────────────────────────────
  const sections = [
    {
      id: 'photo',
      icon: Camera,
      label: 'Profile Picture',
      sublabel: 'JPG, PNG up to 5MB',
    },
    {
      id: 'email',
      icon: Mail,
      label: 'Email Address',
      sublabel: savedExtras.verifiedEmail || user?.email || '—',
      badge: 'Verified',
    },
    {
      id: 'phone',
      icon: Phone,
      label: 'Phone Number',
      sublabel: savedExtras.phone || 'Not set',
      badge: savedExtras.phoneVerified ? 'Verified' : null,
      warn: savedExtras.phone && !savedExtras.phoneVerified ? 'Unverified' : null,
    },
    {
      id: 'password',
      icon: Lock,
      label: 'Password',
      sublabel: 'Change your account password',
    },
  ]

  // ── Render helpers ────────────────────────────────
  const SectionHeader = ({ label }) => (
    <div className="flex items-center gap-3 mb-6">
      <button
        onClick={() => setActiveSection(null)}
        className="p-1.5 rounded-[var(--radius-lg)] transition-colors"
        style={{ color: 'var(--color-text-muted)' }}
        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)'}
        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        <ArrowLeft className="w-4 h-4" />
      </button>
      <h3 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>{label}</h3>
    </div>
  )

  const InputField = ({ label, type = 'text', value, onChange, placeholder, hint, rightEl }) => (
    <div>
      <label className="text-label mb-1.5 block" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="input pr-10"
        />
        {rightEl && <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightEl}</div>}
      </div>
      {hint && <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{hint}</p>}
    </div>
  )

  const PrimaryBtn = ({ onClick, loading, disabled, children, danger }) => (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className="w-full py-2.5 rounded-[var(--radius-md)] font-semibold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        backgroundColor: danger ? 'var(--color-error)' : 'var(--color-primary)',
        color: '#ffffff',
      }}
      onMouseEnter={e => {
        if (!loading && !disabled) e.currentTarget.style.backgroundColor = danger ? '#b91c1c' : 'var(--color-primary-hover)'
      }}
      onMouseLeave={e => {
        if (!loading && !disabled) e.currentTarget.style.backgroundColor = danger ? 'var(--color-error)' : 'var(--color-primary)'
      }}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : children}
    </button>
  )

  const GhostBtn = ({ onClick, children }) => (
    <button
      onClick={onClick}
      className="btn btn-ghost flex-1 py-2.5"
    >
      {children}
    </button>
  )

  // ── Password visibility toggle ────────────────────
  const EyeToggle = ({ show, onToggle }) => (
    <button
      type="button"
      onClick={onToggle}
      className="transition-colors"
      style={{ color: 'var(--color-text-muted)' }}
      onMouseEnter={e => e.currentTarget.style.color = 'var(--color-text-secondary)'}
      onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-muted)'}
    >
      {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    </button>
  )

  // ── Render sections ───────────────────────────────
  const renderSection = () => {
    if (activeSection === 'photo') return (
      <div>
        <SectionHeader label="Profile Picture" />
        <div className="flex flex-col items-center gap-6">
          {/* Preview */}
          <div className="relative">
            <div
              className="w-28 h-28 rounded-full overflow-hidden flex items-center justify-center"
              style={{
                backgroundColor: 'var(--color-primary-muted)',
                border: '4px solid var(--color-bg-card)',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              {avatar
                ? <img src={avatar} alt="avatar" className="w-full h-full object-cover" />
                : <User className="w-12 h-12" style={{ color: 'var(--color-primary)' }} />
              }
            </div>
            <button
              onClick={() => fileRef.current.click()}
              className="absolute bottom-0 right-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors"
              style={{
                backgroundColor: 'var(--color-primary)',
                color: '#ffffff',
                boxShadow: 'var(--shadow-lg)',
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--color-primary)'}
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          <div className="w-full space-y-3">
            <button
              onClick={() => fileRef.current.click()}
              className="w-full py-2.5 border-2 border-dashed rounded-[var(--radius-lg)] text-sm font-medium transition-all flex items-center justify-center gap-2"
              style={{
                borderColor: 'var(--color-border-strong)',
                color: 'var(--color-text-secondary)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--color-primary)'
                e.currentTarget.style.color = 'var(--color-primary)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--color-border-strong)'
                e.currentTarget.style.color = 'var(--color-text-secondary)'
              }}
            >
              <Camera className="w-4 h-4" /> Upload New Photo
            </button>
            {avatar && (
              <button
                onClick={() => { setAvatar(null); showToast('Photo removed') }}
                className="w-full py-2.5 text-sm font-medium transition-colors"
                style={{ color: 'var(--color-error)' }}
              >
                Remove Photo
              </button>
            )}
          </div>
          <p className="text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>
            Supported: JPG, PNG, GIF &bull; Max 5MB
          </p>
        </div>
      </div>
    )

    if (activeSection === 'email') return (
      <div>
        <SectionHeader label="Change Email Address" />
        <div className="space-y-4">
          <div
            className="rounded-[var(--radius-lg)] p-3 text-xs flex items-start gap-2"
            style={{
              backgroundColor: 'var(--color-info-light)',
              border: '1px solid var(--color-info-border)',
              color: 'var(--color-info)',
            }}
          >
            <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" />
            A verification code will be sent to your new email to confirm the change.
          </div>
          <div>
            <label className="text-label mb-1.5 block" style={{ color: 'var(--color-text-muted)' }}>Current Email</label>
            <div
              className="px-4 py-2.5 rounded-[var(--radius-md)] text-sm"
              style={{
                backgroundColor: 'var(--color-bg-subtle)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-muted)',
              }}
            >
              {savedExtras.verifiedEmail || user?.email}
            </div>
          </div>
          <InputField
            label="New Email Address"
            type="email"
            value={newEmail}
            onChange={setNewEmail}
            placeholder="new@cshc.edu.ph"
          />
          {!emailCodeSent ? (
            <PrimaryBtn onClick={handleSendEmailCode} loading={emailLoading}>
              <Mail className="w-4 h-4" /> Send Verification Code
            </PrimaryBtn>
          ) : (
            <>
              <InputField
                label="Verification Code"
                value={emailVerifyCode}
                onChange={setEmailVerifyCode}
                placeholder="Enter 6-digit code"
                hint="Check your new email inbox. (Demo code: 123456)"
              />
              <div className="flex gap-2">
                <GhostBtn onClick={() => { setEmailCodeSent(false); setEmailVerifyCode('') }}>
                  Resend
                </GhostBtn>
                <PrimaryBtn onClick={handleVerifyEmail} disabled={!emailVerifyCode}>
                  <CheckCircle className="w-4 h-4" /> Verify & Save
                </PrimaryBtn>
              </div>
            </>
          )}
        </div>
      </div>
    )

    if (activeSection === 'phone') return (
      <div>
        <SectionHeader label="Phone Number" />
        <div className="space-y-4">
          <div
            className="rounded-[var(--radius-lg)] p-3 text-xs flex items-start gap-2"
            style={{
              backgroundColor: 'var(--color-info-light)',
              border: '1px solid var(--color-info-border)',
              color: 'var(--color-info)',
            }}
          >
            <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" />
            Your phone number is used for two-factor authentication and account recovery.
          </div>
          <InputField
            label="Phone Number"
            type="tel"
            value={phone}
            onChange={setPhone}
            placeholder="+63 9XX XXX XXXX"
          />
          {!phoneCodeSent ? (
            <PrimaryBtn onClick={handleSendPhoneCode} loading={phoneLoading}>
              <Phone className="w-4 h-4" /> Send Verification Code
            </PrimaryBtn>
          ) : (
            <>
              <InputField
                label="Verification Code"
                value={phoneVerifyCode}
                onChange={setPhoneVerifyCode}
                placeholder="Enter 6-digit code"
                hint="Check your SMS. (Demo code: 123456)"
              />
              <div className="flex gap-2">
                <GhostBtn onClick={() => { setPhoneCodeSent(false); setPhoneVerifyCode('') }}>
                  Resend
                </GhostBtn>
                <PrimaryBtn onClick={handleVerifyPhone} disabled={!phoneVerifyCode}>
                  <CheckCircle className="w-4 h-4" /> Verify & Save
                </PrimaryBtn>
              </div>
            </>
          )}
        </div>
      </div>
    )

    if (activeSection === 'password') return (
      <div>
        <SectionHeader label="Change Password" />
        <div className="space-y-4">
          {/* Current password */}
          <InputField
            label="Current Password"
            type={showCurrent ? 'text' : 'password'}
            value={currentPassword}
            onChange={setCurrentPassword}
            placeholder="Your current password"
            rightEl={<EyeToggle show={showCurrent} onToggle={() => setShowCurrent(v => !v)} />}
          />

          {/* New password */}
          <div>
            <InputField
              label="New Password"
              type={showNew ? 'text' : 'password'}
              value={newPassword}
              onChange={setNewPassword}
              placeholder="At least 8 characters"
              rightEl={<EyeToggle show={showNew} onToggle={() => setShowNew(v => !v)} />}
            />
            {/* Strength bar */}
            {newPassword && (
              <div className="mt-2 space-y-1">
                <div className="flex gap-1">
                  {[1,2,3,4].map(i => (
                    <div
                      key={i}
                      className="h-1 flex-1 rounded-full transition-all duration-300"
                      style={{
                        backgroundColor: i <= strength
                          ? strengthColors[strength]
                          : 'var(--color-border)',
                      }}
                    />
                  ))}
                </div>
                <p className="text-xs font-medium" style={{ color: strengthColors[strength || 0] }}>
                  {strengthLabel}
                </p>
              </div>
            )}
          </div>

          {/* Confirm */}
          <InputField
            label="Confirm New Password"
            type={showConfirm ? 'text' : 'password'}
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder="Re-enter new password"
            rightEl={<EyeToggle show={showConfirm} onToggle={() => setShowConfirm(v => !v)} />}
          />
          {confirmPassword && newPassword !== confirmPassword && (
            <p className="text-xs -mt-2" style={{ color: 'var(--color-error)' }}>Passwords do not match</p>
          )}

          <PrimaryBtn
            onClick={handleChangePassword}
            loading={pwLoading}
            disabled={!currentPassword || !newPassword || !confirmPassword}
          >
            <Save className="w-4 h-4" /> Update Password
          </PrimaryBtn>
        </div>
      </div>
    )

    // ── Overview ────────────────────────────────────
    const roleStyle = ROLE_COLORS[user?.role] || ROLE_COLORS.admin
    return (
      <div>
        {/* Avatar + name */}
        <div className="flex flex-col items-center gap-3 mb-6 pt-2">
          <div className="relative">
            <div
              className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center"
              style={{
                backgroundColor: 'var(--color-primary-muted)',
                border: '4px solid var(--color-bg-card)',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              {avatar
                ? <img src={avatar} alt="avatar" className="w-full h-full object-cover" />
                : <User className="w-9 h-9" style={{ color: 'var(--color-primary)' }} />
              }
            </div>
            <button
              onClick={() => setActiveSection('photo')}
              className="absolute bottom-0 right-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors"
              style={{
                backgroundColor: 'var(--color-primary)',
                color: '#ffffff',
                boxShadow: 'var(--shadow-sm)',
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--color-primary)'}
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="text-center">
            <p className="font-bold" style={{ color: 'var(--color-text-primary)' }}>
              {savedExtras.displayName || user?.name}
            </p>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {savedExtras.verifiedEmail || user?.email}
            </p>
            <span
              className="inline-block mt-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold"
              style={{
                backgroundColor: roleStyle.bg,
                color: roleStyle.text,
              }}
            >
              {ROLE_LABELS[user?.role] || user?.role}
            </span>
          </div>
        </div>

        {/* Section list */}
        <div className="space-y-1">
          {sections.map(({ id, icon: Icon, label, sublabel, badge, warn }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id)}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-[var(--radius-lg)] transition-colors group"
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <div
                className="w-9 h-9 rounded-[var(--radius-lg)] flex items-center justify-center flex-shrink-0 transition-colors"
                style={{ backgroundColor: 'var(--color-bg-muted)' }}
              >
                <Icon className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{label}</p>
                <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>{sublabel}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {badge && (
                  <span
                    className="px-2 py-0.5 text-[10px] font-bold rounded-full"
                    style={{
                      backgroundColor: 'var(--color-success-light)',
                      color: 'var(--color-success)',
                    }}
                  >
                    {badge}
                  </span>
                )}
                {warn && (
                  <span
                    className="px-2 py-0.5 text-[10px] font-bold rounded-full"
                    style={{
                      backgroundColor: 'var(--color-warning-light)',
                      color: 'var(--color-warning)',
                    }}
                  >
                    {warn}
                  </span>
                )}
                <ChevronRight className="w-4 h-4" style={{ color: 'var(--color-border-strong)' }} />
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return createPortal(
    <>
      {/* Backdrop — no backdrop-blur */}
      <div
        className="fixed inset-0 z-[9998]"
        style={{ backgroundColor: 'rgba(0,0,0,0.40)' }}
        onClick={onClose}
      />

      {/* Modal panel */}
      <div
        className="fixed top-0 right-0 h-full w-full max-w-sm z-[9999] flex flex-col"
        style={{
          backgroundColor: 'var(--color-bg-card)',
          boxShadow: 'var(--shadow-modal)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <h2 className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>
            {activeSection ? '' : 'My Profile'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-[var(--radius-lg)] transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-bg-subtle)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toast */}
        {toast && (
          <div className="px-5 pt-3">
            <Toast message={toast.message} type={toast.type} />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {renderSection()}
        </div>
      </div>
    </>,
    document.body
  )
}