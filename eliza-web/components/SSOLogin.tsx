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
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#f5f5f0]">

      {/* Top bar */}
      <div className="fixed top-0 left-0 right-0 h-11 bg-white border-b border-[#e5e5e0] flex items-center px-6">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-[#5a6fa5] flex items-center justify-center">
            <span className="text-white text-xs font-mono">◈</span>
          </div>
          <span className="text-sm font-semibold text-[#1a1a1a] tracking-tight">ELIZA</span>
        </div>
        <span className="ml-3 text-xs text-[#aaa]">by MOSAIC University</span>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-[#e5e5e0] overflow-hidden">

        <div className="px-8 pt-8 pb-6">
          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-8 h-8 rounded-lg bg-[#5a6fa5] flex items-center justify-center">
              <span className="text-white text-sm font-mono">◈</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-[#1a1a1a]">Sign in to ELIZA</p>
              <p className="text-xs text-[#aaa]">University AI Portal · LUMEN Project</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-[#555] mb-1.5">University NetID</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. jsmith24"
                autoComplete="username"
                autoFocus
                className="w-full border border-[#e5e5e0] rounded-xl text-sm px-3.5 py-2.5 outline-none focus:border-[#5a6fa5] focus:ring-2 focus:ring-[#5a6fa5]/10 transition text-[#1a1a1a] placeholder:text-[#ccc]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#555] mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full border border-[#e5e5e0] rounded-xl text-sm px-3.5 py-2.5 outline-none focus:border-[#5a6fa5] focus:ring-2 focus:ring-[#5a6fa5]/10 transition text-[#1a1a1a] placeholder:text-[#ccc]"
              />
            </div>

            {error && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !username.trim()}
              className="w-full mt-1 bg-[#1a1a1a] hover:bg-[#333] text-white text-sm font-medium py-2.5 rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                'Continue with SSO'
              )}
            </button>
          </form>
        </div>

        <div className="px-8 py-4 bg-[#fafaf8] border-t border-[#e5e5e0] flex justify-between">
          <span className="text-[11px] text-[#bbb]">Forgot password → x4400</span>
          <span className="text-[11px] text-[#bbb]">LUMEN v0.9.1</span>
        </div>
      </div>

      {/* Footer */}
      <p className="mt-6 text-xs text-[#bbb]">
        © {new Date().getFullYear()} MOSAIC University · Office of Information Technology
      </p>

    </div>
  )
}
