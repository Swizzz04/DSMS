import { useState } from 'react'
import { Eye, EyeOff, LogIn } from 'lucide-react'

// Read school branding from localStorage (set by super admin in Settings → School Info)
function getSchoolConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem('cshc_website_content') || '{}')
    return {
      name:       saved.schoolName   || 'School Management System',
      motto:      saved.motto        || '',
      email:      saved.email        || '',
      logo:       saved.logoUrl      || '/assets/cshclogo.png',
      portalLabel: saved.portalLabel || 'School Management Portal',
      supportLabel: saved.supportLabel || 'Contact IT Support',
    }
  } catch {
    return { name: 'School Management System', motto: '', email: '', logo: '/assets/cshclogo.png', portalLabel: 'School Management Portal', supportLabel: 'Contact IT Support' }
  }
}

export default function Login({ onLoginSuccess, error, loading = false }) {
  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe,   setRememberMe]   = useState(false)
  const school = getSchoolConfig()

  const handleSubmit = (e) => {
    e.preventDefault()
    if (onLoginSuccess) onLoginSuccess(email, password)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', overflow: 'hidden',
      background: 'var(--color-secondary)',
      fontFamily: 'Inter, -apple-system, sans-serif',
    }}>

      {/* ── Left Panel (hidden on mobile, shown ≥ 900px) ── */}
      <aside
        className="login-panel"
        style={{
          display: 'none',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '3rem',
          flex: '0 0 42%',
          background: 'linear-gradient(160deg, var(--color-secondary-light) 0%, var(--color-secondary) 55%, #04062a 100%)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative circles */}
        <div style={{
          position: 'absolute', top: -80, left: -80,
          width: 420, height: 420, borderRadius: '50%',
          border: '60px solid var(--color-primary-muted)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -60, right: -60,
          width: 300, height: 300, borderRadius: '50%',
          border: '40px solid var(--color-primary-muted)',
          pointerEvents: 'none',
        }} />

        {/* Red accent bar */}
        <div style={{
          position: 'absolute', top: 0, left: 0,
          width: 4, height: '100%',
          background: 'linear-gradient(to bottom, transparent, var(--color-primary), transparent)',
        }} />

        {/* Logo + school name — centered */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', animation: 'loginFadeUp 0.7s ease both', textAlign: 'center' }}>
          <div style={{
            width: 200, height: 200, borderRadius: '50%',
            background: '#fff',
            border: '3px solid var(--color-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 0 8px rgba(117,0,20,0.12), 0 16px 40px rgba(0,0,0,0.4)',
            overflow: 'hidden', flexShrink: 0,
          }}>
            <img src={school.logo} alt="School Logo"
              style={{ width: 200, height: 200  , objectFit: 'contain', padding: 8 }} />
          </div>
          <div>
            <div style={{
              fontSize: 'clamp(1.05rem, 1.8vw, 1.35rem)',
              fontWeight: 700, color: '#fff',
              lineHeight: 1.25, letterSpacing: '0.01em',
            }}>
              {school.name}
            </div>
            <div style={{
              fontSize: '0.78rem', fontWeight: 500,
              color: 'rgba(255,255,255,0.7)',
              fontStyle: 'italic',
              marginTop: '0.5rem',
              lineHeight: 1.4,
            }}>
              {school.motto ? `"${school.motto}"` : ''}
            </div>
            <div style={{
              fontSize: '0.65rem', fontWeight: 600,
              color: 'rgba(255,255,255,0.35)',
              letterSpacing: '0.15em', textTransform: 'uppercase',
              marginTop: '0.75rem',
            }}>
              {school.portalLabel}
            </div>
          </div>
        </div>

        <div style={{ position: 'absolute', bottom: '2rem', left: 0, right: 0, textAlign: 'center', fontSize: '0.66rem', color: 'rgba(255,255,255,0.22)', letterSpacing: '0.04em', animation: 'loginFadeUp 0.7s 0.25s ease both' }}>
          {'\u00A9'} {new Date().getFullYear()} {school.name}
        </div>
      </aside>

      {/* ── Right Panel ── */}
      <main style={{
        flex: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '2rem 1.5rem',
        overflowY: 'auto',
        background: '#f4f5f0',
        position: 'relative',
      }}>
        {/* Dot grid texture */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'radial-gradient(circle, var(--color-secondary-muted) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }} />

        <div style={{ width: '100%', maxWidth: 400, position: 'relative', animation: 'loginFadeUp 0.65s 0.1s ease both' }}>

          {/* Mobile-only branding */}
          <div className="login-mobile-brand" style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: '#fff',
              border: '3px solid var(--color-primary)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: 'var(--shadow-md)', overflow: 'hidden',
              marginBottom: '0.75rem',
            }}>
              <img src={school.logo} alt="School Logo"
                style={{ width: 62, height: 62, objectFit: 'contain', padding: 4 }} />
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-secondary)', display: 'block' }}>
              {school.name}
            </div>
            <div style={{
              fontSize: '0.68rem', fontWeight: 600,
              color: 'var(--color-primary)',
              letterSpacing: '0.12em', textTransform: 'uppercase',
            }}>
              {school.portalLabel}
            </div>
          </div>

          {/* ── Card ── */}
          <div style={{
            padding: '2.25rem 2rem',
            borderRadius: '20px',
            background: '#ffffff',
            border: '1px solid #e8e8e4',
            borderTop: '3px solid var(--color-primary)',
            boxShadow: '0 4px 6px var(--color-secondary-muted), 0 20px 60px var(--color-secondary-muted)',
          }}>
            {/* Eyebrow + heading */}
            <div style={{ marginBottom: '1.75rem' }}>
              <div style={{
                fontSize: '0.62rem', fontWeight: 700,
                letterSpacing: '0.18em', textTransform: 'uppercase',
                color: 'var(--color-primary)', marginBottom: '0.35rem',
              }}>
                {school.portalLabel}
              </div>
              <h1 style={{
                fontSize: '1.6rem', fontWeight: 700,
                color: 'var(--color-secondary)',
                lineHeight: 1.2, marginBottom: '0.3rem',
              }}>
                Welcome back.
              </h1>
              <p style={{ fontSize: '0.82rem', color: '#8a8a8a' }}>
                Sign in to access the management system.
              </p>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--color-error-light)',
                border: '1px solid var(--color-error-border)',
                color: 'var(--color-error)',
                fontSize: '0.82rem', fontWeight: 500,
                marginBottom: '1.25rem',
              }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>

              {/* Email */}
              <div style={{ marginBottom: '1.1rem' }}>
                <label htmlFor="email" style={{
                  display: 'block', fontSize: '0.78rem', fontWeight: 600,
                  color: '#4a4a4a', marginBottom: '0.45rem',
                }}>
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  style={{ background: '#ffffff', color: '#1a1a1a', border: '1.5px solid #e8e8e4' }}
                  className="input"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="Enter your email"
                  autoComplete="email"
                />
              </div>

              {/* Password */}
              <div style={{ marginBottom: '0.75rem' }}>
                <label htmlFor="password" style={{
                  display: 'block', fontSize: '0.78rem', fontWeight: 600,
                  color: '#4a4a4a', marginBottom: '0.45rem',
                }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    className="input"
                    style={{ paddingRight: '2.75rem', background: '#ffffff', color: '#1a1a1a', border: '1.5px solid #e8e8e4' }}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    placeholder="Enter your password"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword(v => !v)}
                    style={{
                      position: 'absolute', right: '0.75rem', top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#8a8a8a',
                      display: 'flex', alignItems: 'center',
                      padding: 2, borderRadius: 'var(--radius-xs)',
                      transition: 'color var(--t-base)',
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = '#4a4a4a'}
                    onMouseLeave={e => e.currentTarget.style.color = '#8a8a8a'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Remember me + Forgot password */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: '1.5rem', marginTop: '0.5rem',
              }}>
                <label style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  cursor: 'pointer', fontSize: '0.8rem',
                  color: '#8a8a8a', userSelect: 'none',
                }}>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                    style={{
                      width: 15, height: 15, borderRadius: 4,
                      accentColor: 'var(--color-secondary)', cursor: 'pointer',
                    }}
                  />
                  Remember me
                </label>
                <a
                  href="#"
                  style={{
                    fontSize: '0.8rem', fontWeight: 600,
                    color: 'var(--color-primary)', textDecoration: 'none',
                    transition: 'color var(--t-base)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--color-primary-hover)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--color-primary)'}
                >
                  Forgot Password?
                </a>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="btn btn-secondary"
                style={{
                  width: '100%', padding: '0.875rem',
                  borderRadius: 'var(--radius-xl)',
                  fontSize: '0.9rem', letterSpacing: '0.02em',
                  boxShadow: '0 4px 14px rgba(8,12,66,0.25), inset 0 1px 0 rgba(255,255,255,0.08)',
                  position: 'relative', overflow: 'hidden',
                  transition: 'transform var(--t-fast), box-shadow var(--t-base), background-color var(--t-base)',
                }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.boxShadow = '0 8px 22px rgba(8,12,66,0.32)' }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 14px rgba(8,12,66,0.25), inset 0 1px 0 rgba(255,255,255,0.08)' }}
              >
                {/* Red shimmer accent at bottom of button */}
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  height: 2,
                  background: 'linear-gradient(90deg, transparent, var(--color-primary), transparent)',
                  opacity: 0.55,
                }} />

                {loading ? (
                  <>
                    <span style={{
                      width: 16, height: 16, borderRadius: '50%',
                      border: '2px solid rgba(255,255,255,0.25)',
                      borderTopColor: '#fff',
                      animation: 'loginSpin 0.7s linear infinite',
                      display: 'inline-block', flexShrink: 0,
                    }} />
                    Signing in…
                  </>
                ) : (
                  <>
                    <LogIn size={16} />
                    Sign In
                  </>
                )}
              </button>
            </form>

            {/* Support footer */}
            <div style={{ height: 1, background: '#e8e8e4', margin: '1.5rem 0 1rem' }} />
            <div style={{ textAlign: 'center', fontSize: '0.78rem', color: '#8a8a8a' }}>
              Need help?{' '}
              <a
                href={`mailto:${school.email || 'support@school.edu'}`}
                style={{ color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'none' }}
                onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
              >
                {school.supportLabel}
              </a>
            </div>
          </div>

          {/* Page copyright */}
          <p style={{
            textAlign: 'center', fontSize: '0.68rem',
            color: '#8a8a8a', marginTop: '1.5rem',
          }}>
            {'\u00A9'} {new Date().getFullYear()} {school.name}. All rights reserved.
          </p>
        </div>
      </main>

      {/* Keyframes + responsive visibility */}
      <style>{`
        @keyframes loginFadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes loginSpin {
          to { transform: rotate(360deg); }
        }
        @media (min-width: 900px) {
          .login-panel        { display: flex !important; }
          .login-mobile-brand { display: none !important; }
        }
      `}</style>
    </div>
  )
}