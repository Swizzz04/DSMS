import { useState, useRef, useEffect } from 'react'
import {
  X, Camera, User, Mail, Phone, Lock, Eye, EyeOff,
  CheckCircle, AlertCircle, Shield, Save, ChevronRight, ArrowLeft
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useAvatar } from '../../hooks/useAvatar'

// ── Helpers ───────────────────────────────────────────
const ROLE_LABELS = {
  admin: 'Administrator',
  registrar_basic: 'Basic Ed Registrar',
  registrar_college: 'College Registrar',
  accounting: 'Accounting Officer',
}

const ROLE_COLORS = {
  admin:              'bg-primary/10 text-primary dark:bg-primary/20 dark:text-red-300',
  registrar_basic:    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  registrar_college:  'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  accounting:         'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
}

function Toast({ message, type }) {
  return (
    <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium shadow-lg
      ${type === 'success'
        ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
        : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
      }`}>
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
    // Update user email in localStorage
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
    registrar_basic: 'registrar123',
    registrar_college: 'registrar123',
    accounting: 'accounting123',
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
  const strengthColor = ['', 'bg-red-500', 'bg-yellow-400', 'bg-blue-400', 'bg-green-500'][strength || 0]

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
        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
      </button>
      <h3 className="text-base font-semibold text-gray-800 dark:text-white">{label}</h3>
    </div>
  )

  const InputField = ({ label, type = 'text', value, onChange, placeholder, hint, rightEl }) => (
    <div>
      <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-sm pr-10"
        />
        {rightEl && <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightEl}</div>}
      </div>
      {hint && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{hint}</p>}
    </div>
  )

  const PrimaryBtn = ({ onClick, loading, disabled, children, danger }) => (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className={`w-full py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all
        ${danger
          ? 'bg-red-600 hover:bg-red-700 text-white'
          : 'bg-primary hover:bg-accent-burgundy text-white'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : children}
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
            <div className="w-28 h-28 rounded-full overflow-hidden bg-primary/10 dark:bg-primary/20 border-4 border-white dark:border-gray-700 shadow-lg flex items-center justify-center">
              {avatar
                ? <img src={avatar} alt="avatar" className="w-full h-full object-cover" />
                : <User className="w-12 h-12 text-primary" />
              }
            </div>
            <button
              onClick={() => fileRef.current.click()}
              className="absolute bottom-0 right-0 w-9 h-9 bg-primary hover:bg-accent-burgundy text-white rounded-full flex items-center justify-center shadow-lg transition-colors"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          <div className="w-full space-y-3">
            <button
              onClick={() => fileRef.current.click()}
              className="w-full py-2.5 border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-primary dark:hover:border-primary rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary font-medium transition-all flex items-center justify-center gap-2"
            >
              <Camera className="w-4 h-4" /> Upload New Photo
            </button>
            {avatar && (
              <button
                onClick={() => { setAvatar(null); showToast('Photo removed') }}
                className="w-full py-2.5 text-sm text-red-500 hover:text-red-600 font-medium transition-colors"
              >
                Remove Photo
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
            Supported: JPG, PNG, GIF &bull; Max 5MB
          </p>
        </div>
      </div>
    )

    if (activeSection === 'email') return (
      <div>
        <SectionHeader label="Change Email Address" />
        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
            <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" />
            A verification code will be sent to your new email to confirm the change.
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Current Email</label>
            <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-500 dark:text-gray-400">
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
                <button
                  onClick={() => { setEmailCodeSent(false); setEmailVerifyCode('') }}
                  className="flex-1 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Resend
                </button>
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
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
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
                <button
                  onClick={() => { setPhoneCodeSent(false); setPhoneVerifyCode('') }}
                  className="flex-1 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Resend
                </button>
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
            rightEl={
              <button type="button" onClick={() => setShowCurrent(v => !v)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
          />

          {/* New password */}
          <div>
            <InputField
              label="New Password"
              type={showNew ? 'text' : 'password'}
              value={newPassword}
              onChange={setNewPassword}
              placeholder="At least 8 characters"
              rightEl={
                <button type="button" onClick={() => setShowNew(v => !v)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
            />
            {/* Strength bar */}
            {newPassword && (
              <div className="mt-2 space-y-1">
                <div className="flex gap-1">
                  {[1,2,3,4].map(i => (
                    <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300
                      ${i <= strength ? strengthColor : 'bg-gray-200 dark:bg-gray-600'}`} />
                  ))}
                </div>
                <p className={`text-xs font-medium ${
                  strength <= 1 ? 'text-red-500' : strength === 2 ? 'text-yellow-500' :
                  strength === 3 ? 'text-blue-500' : 'text-green-500'
                }`}>{strengthLabel}</p>
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
            rightEl={
              <button type="button" onClick={() => setShowConfirm(v => !v)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
          />
          {confirmPassword && newPassword !== confirmPassword && (
            <p className="text-xs text-red-500 -mt-2">Passwords do not match</p>
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
    return (
      <div>
        {/* Avatar + name */}
        <div className="flex flex-col items-center gap-3 mb-6 pt-2">
          <div className="relative">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-primary/10 dark:bg-primary/20 border-4 border-white dark:border-gray-700 shadow-lg flex items-center justify-center">
              {avatar
                ? <img src={avatar} alt="avatar" className="w-full h-full object-cover" />
                : <User className="w-9 h-9 text-primary" />
              }
            </div>
            <button
              onClick={() => setActiveSection('photo')}
              className="absolute bottom-0 right-0 w-7 h-7 bg-primary hover:bg-accent-burgundy text-white rounded-full flex items-center justify-center shadow transition-colors"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="text-center">
            <p className="font-bold text-gray-800 dark:text-white">{savedExtras.displayName || user?.name}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{savedExtras.verifiedEmail || user?.email}</p>
            <span className={`inline-block mt-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${ROLE_COLORS[user?.role]}`}>
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
              className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group"
            >
              <div className="w-9 h-9 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-primary/10 dark:group-hover:bg-primary/20 transition-colors">
                <Icon className="w-4 h-4 text-gray-500 dark:text-gray-400 group-hover:text-primary dark:group-hover:text-red-300 transition-colors" />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-white">{label}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{sublabel}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {badge && (
                  <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-bold rounded-full">
                    {badge}
                  </span>
                )}
                {warn && (
                  <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-[10px] font-bold rounded-full">
                    {warn}
                  </span>
                )}
                <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-400 transition-colors" />
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Modal panel */}
      <div className="fixed top-0 right-0 h-full w-full max-w-sm bg-white dark:bg-gray-800 shadow-2xl z-50 flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-base font-bold text-gray-800 dark:text-white">
            {activeSection ? '' : 'My Profile'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
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
    </>
  )
}