'use client'

import { useState, FormEvent } from 'react'

interface SSOLoginProps {
  onLogin: (username: string) => void
}

export default function SSOLogin({ onLogin }: SSOLoginProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!username.trim()) return
    setLoading(true)
    setError('')
    await new Promise((r) => setTimeout(r, 1200))
    if (password.toLowerCase() === 'wrong') {
      setError('Incorrect credentials. Contact IT Services if this persists.')
      setLoading(false)
      return
    }
    onLogin(username.trim())
  }

  return (
    <div style={{
      height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', background: 'var(--bg-sidebar)',
    }}>

      {/* Card */}
      <div style={{
        width: '100%', maxWidth: '400px',
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-card-hover)',
        overflow: 'hidden',
      }}>

        <div style={{ padding: '36px 32px 28px' }}>
          {/* Logo */}
          <div style={{ marginBottom: '28px' }}>
            <h1 style={{
              fontFamily: 'var(--font-serif)', fontSize: '24px',
              color: 'var(--color-primary)', fontWeight: 400, marginBottom: '4px',
            }}>ELIZA</h1>
            <p style={{ fontSize: '12px', color: 'var(--color-text-faint)' }}>
              University AI Portal · LUMEN Project
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--color-text)', marginBottom: '6px' }}>
                University NetID
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. jsmith24"
                autoComplete="username"
                autoFocus
                style={{
                  width: '100%', border: '2px solid var(--color-primary-border)',
                  borderRadius: 'var(--radius-md)', fontSize: '14px',
                  padding: '10px 14px', outline: 'none', fontFamily: 'var(--font-sans)',
                  color: 'var(--color-text)', background: 'var(--bg-main)',
                  transition: 'border-color 200ms',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--color-primary)'}
                onBlur={e => e.target.style.borderColor = 'var(--color-primary-border)'}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--color-text)', marginBottom: '6px' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                style={{
                  width: '100%', border: '2px solid var(--color-primary-border)',
                  borderRadius: 'var(--radius-md)', fontSize: '14px',
                  padding: '10px 14px', outline: 'none', fontFamily: 'var(--font-sans)',
                  color: 'var(--color-text)', background: 'var(--bg-main)',
                  transition: 'border-color 200ms',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--color-primary)'}
                onBlur={e => e.target.style.borderColor = 'var(--color-primary-border)'}
              />
            </div>

            {error && (
              <div style={{
                fontSize: '12px', color: '#c0686a', background: '#fff0f0',
                border: '1px solid #f0c0c0', borderRadius: 'var(--radius-sm)', padding: '10px 14px',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !username.trim()}
              style={{
                marginTop: '4px', background: 'var(--color-primary)', border: 'none',
                borderRadius: 'var(--radius-md)', color: '#fff', fontFamily: 'var(--font-sans)',
                fontSize: '14px', fontWeight: 500, padding: '12px', cursor: 'pointer',
                transition: 'opacity 200ms', opacity: (loading || !username.trim()) ? 0.5 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}
            >
              {loading ? (
                <>
                  <div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  Signing in…
                </>
              ) : 'Continue with SSO'}
            </button>
          </form>
        </div>

        <div style={{
          padding: '14px 32px', background: 'var(--bg-sidebar)',
          borderTop: '1px solid rgba(161,159,238,0.15)',
          display: 'flex', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: '11px', color: 'var(--color-text-faint)' }}>Forgot password → IT x4400</span>
          <span style={{ fontSize: '11px', color: 'var(--color-text-faint)' }}>LUMEN v0.9.1</span>
        </div>
      </div>

      <p style={{ marginTop: '24px', fontSize: '11px', color: 'var(--color-text-faint)' }}>
        © {new Date().getFullYear()} MOSAIC University · Office of Information Technology
      </p>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
