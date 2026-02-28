'use client'

import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { SquarePen, Search, Settings, HelpCircle, Plus, SendHorizonal } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  hasAnomaly?: boolean
  fileName?: string
}

interface ChatProps {
  username: string
}

const GLYPH = '◈'
const ACCEPTED_FILES = '.txt,.md,.csv,.rtf,.pdf,.docx'


export default function Chat({ username }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [currentResponse, setCurrentResponse] = useState('')
  const [attachedFile, setAttachedFile] = useState<{ name: string; text: string } | null>(null)
  const [fileLoading, setFileLoading] = useState(false)
  const [fileError, setFileError] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const initials = username.slice(0, 2).toUpperCase()
  const email = `${username.toLowerCase()}@mosaic.edu`

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, currentResponse])

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileError('')
    setFileLoading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/parse-file', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Parse failed')
      setAttachedFile({ name: file.name, text: data.text })
    } catch (err: unknown) {
      setFileError(err instanceof Error ? err.message : 'Could not read file.')
    } finally {
      setFileLoading(false)
      e.target.value = ''
    }
  }

  async function sendMessage() {
    if ((!input.trim() && !attachedFile) || streaming) return

    let userContent = input.trim()
    const fileName = attachedFile?.name
    if (attachedFile) {
      userContent = `${userContent ? userContent + '\n\n' : ''}[Attached file: ${attachedFile.name}]\n\n${attachedFile.text}`
    }

    setInput('')
    setAttachedFile(null)
    setFileError('')

    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }

    const newMessages: Message[] = [...messages, { role: 'user', content: userContent, fileName }]
    setMessages(newMessages)
    setStreaming(true)
    setCurrentResponse('')

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      })
      if (!res.ok) throw new Error('Stream failed')

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let full = ''
      let hasAnomaly = false

      while (reader) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        if (chunk.includes('\x00ANOMALY')) {
          hasAnomaly = true
          full += chunk.replace('\x00ANOMALY', '')
        } else {
          full += chunk
        }
        setCurrentResponse(full)
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: full, hasAnomaly }])
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Something went wrong. Please try again.', hasAnomaly: false },
      ])
    } finally {
      setStreaming(false)
      setCurrentResponse('')
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const allMessages = streaming
    ? [...messages, { role: 'assistant' as const, content: currentResponse, hasAnomaly: false }]
    : messages

  const hasMessages = allMessages.length > 0

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* ── Sidebar ── */}
      {sidebarOpen && (
        <aside style={{
          width: '280px',
          flexShrink: 0,
          background: 'var(--bg-sidebar)',
          padding: '24px 16px',
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid rgba(161,159,238,0.1)',
        }}>

          {/* Top */}
          <div style={{ flex: 1 }}>
            {/* Logo row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', color: 'var(--color-primary)', letterSpacing: '-0.01em' }}>
                ELIZA
              </span>
              <button
                onClick={() => setSidebarOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', opacity: 0.6, fontSize: '14px', padding: '4px' }}
                title="Collapse sidebar"
              >
                ‹
              </button>
            </div>

            {/* New chat */}
            <button
              onClick={() => { setMessages([]); setInput(''); setAttachedFile(null) }}
              style={{
                width: '100%',
                background: 'var(--bg-card)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-card)',
                color: 'var(--color-primary)',
                fontFamily: 'var(--font-sans)',
                fontSize: '14px',
                fontWeight: 500,
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                transition: 'box-shadow 200ms, transform 200ms',
                marginBottom: '8px',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-card-hover)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-card)' }}
            >
              <SquarePen size={15} />
              New chat
            </button>

            {/* Search */}
            <button
              style={{
                width: '100%',
                background: 'none',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--color-text-faint)',
                fontFamily: 'var(--font-sans)',
                fontSize: '14px',
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <Search size={15} />
              Search
            </button>
          </div>

          {/* Bottom — account card */}
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-card)',
            padding: '16px',
          }}>
            {/* Avatar + name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                background: 'radial-gradient(circle, #F9EFF4, #C8C6F7)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '13px', fontWeight: 600, color: 'var(--color-primary)',
              }}>
                {initials}
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.2 }}>{username}</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-faint)', lineHeight: 1.4 }}>{email}</div>
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: '1px', background: 'rgba(161,159,238,0.2)', marginBottom: '12px' }} />

            {/* Icons */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', opacity: 0.7, padding: '2px' }}>
                <Settings size={16} />
              </button>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', opacity: 0.7, padding: '2px' }}>
                <HelpCircle size={16} />
              </button>
            </div>
          </div>

        </aside>
      )}

      {/* ── Main area ── */}
      <main style={{
        flex: 1,
        background: 'var(--bg-main)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
      }}>

        {/* Collapsed sidebar toggle */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            style={{
              position: 'absolute', top: '16px', left: '16px',
              background: 'var(--bg-card)', border: 'none', borderRadius: 'var(--radius-sm)',
              boxShadow: 'var(--shadow-card)', color: 'var(--color-primary)',
              cursor: 'pointer', padding: '6px 10px', fontSize: '14px', zIndex: 10,
            }}
          >›</button>
        )}

        {/* Messages or empty state */}
        {hasMessages ? (
          <div style={{ flex: 1, overflowY: 'auto', padding: '32px 24px 16px' }}>
            <div style={{ maxWidth: '760px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {allMessages.map((msg, i) => (
                <div key={i} style={{ display: 'flex', gap: '12px', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>

                  {/* ELIZA avatar */}
                  {msg.role === 'assistant' && (
                    <div style={{
                      width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
                      background: 'radial-gradient(circle, #F9EFF4, #C8C6F7)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '11px', color: 'var(--color-primary)', fontFamily: 'monospace',
                      marginTop: '2px',
                    }}>◈</div>
                  )}

                  <div style={{ maxWidth: '78%', display: 'flex', flexDirection: 'column', gap: '4px', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>

                    {msg.role === 'assistant' && (
                      <span style={{ fontSize: '11px', color: 'var(--color-text-faint)', fontWeight: 500, paddingLeft: '2px' }}>ELIZA</span>
                    )}

                    {msg.fileName && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        background: 'var(--color-primary-soft)', borderRadius: 'var(--radius-sm)',
                        padding: '6px 12px', marginBottom: '4px',
                      }}>
                        <Plus size={11} style={{ color: 'var(--color-primary)' }} />
                        <span style={{ fontSize: '11px', color: 'var(--color-text)' }}>{msg.fileName}</span>
                      </div>
                    )}

                    <div
                      className="eliza-response"
                      style={{
                        background: msg.role === 'user' ? 'var(--color-primary)' : 'var(--bg-card)',
                        color: msg.role === 'user' ? '#fff' : 'var(--color-text)',
                        borderRadius: msg.role === 'user'
                          ? 'var(--radius-md) var(--radius-md) var(--radius-sm) var(--radius-md)'
                          : 'var(--radius-md) var(--radius-md) var(--radius-md) var(--radius-sm)',
                        padding: msg.role === 'assistant' ? '16px 16px 28px' : '12px 16px',
                        fontSize: '14px',
                        lineHeight: '1.65',
                        boxShadow: msg.role === 'assistant' ? 'var(--shadow-card)' : 'none',
                        fontFamily: 'var(--font-sans)',
                      }}
                    >
                      <p style={{ whiteSpace: 'pre-wrap' }}>
                        {msg.role === 'user' && msg.fileName
                          ? (msg.content.split(`[Attached file: ${msg.fileName}]`)[0].trim() || '(file attached)')
                          : msg.content}
                        {streaming && i === allMessages.length - 1 && msg.role === 'assistant' && (
                          <span className="cursor-blink" />
                        )}
                      </p>
                      {msg.role === 'assistant' && <span className="eliza-glyph">{GLYPH}</span>}
                    </div>

                  </div>

                  {/* User avatar */}
                  {msg.role === 'user' && (
                    <div style={{
                      width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
                      background: 'radial-gradient(circle, #F9EFF4, #C8C6F7)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '11px', fontWeight: 600, color: 'var(--color-primary)',
                      marginTop: '2px',
                    }}>{initials}</div>
                  )}

                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            <h1
              className="fade-up"
              style={{ fontFamily: 'var(--font-serif)', fontSize: '40px', color: 'var(--color-primary)', fontWeight: 400, marginBottom: '32px', textAlign: 'center' }}
            >
              How can I help you?
            </h1>
          </div>
        )}

        {/* ── Input bar ── */}
        <div className={hasMessages ? '' : 'fade-up-delay'} style={{ padding: hasMessages ? '8px 24px 24px' : '0 24px 48px', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: '760px' }}>

            {/* File attachment / error */}
            {(attachedFile || fileLoading || fileError) && (
              <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {fileLoading && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-card)', border: '1px solid var(--color-primary-border)', borderRadius: 'var(--radius-sm)', padding: '6px 12px' }}>
                    <div style={{ width: '12px', height: '12px', border: '2px solid var(--color-primary-soft)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                    <span style={{ fontSize: '12px', color: 'var(--color-text-faint)' }}>Reading file…</span>
                  </div>
                )}
                {attachedFile && !fileLoading && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--color-primary-soft)', border: '1px solid var(--color-primary-border)', borderRadius: 'var(--radius-sm)', padding: '6px 12px' }}>
                    <Plus size={11} style={{ color: 'var(--color-primary)' }} />
                    <span style={{ fontSize: '12px', color: 'var(--color-text)' }}>{attachedFile.name}</span>
                    <button onClick={() => setAttachedFile(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-faint)', fontSize: '12px', marginLeft: '4px', padding: 0 }}>✕</button>
                  </div>
                )}
                {fileError && (
                  <span style={{ fontSize: '12px', color: '#c0686a', background: '#fff0f0', border: '1px solid #f0c0c0', borderRadius: 'var(--radius-sm)', padding: '6px 12px' }}>{fileError}</span>
                )}
              </div>
            )}

            {/* Pill input */}
            <div style={{
              background: 'var(--bg-card)',
              border: '2px solid var(--color-primary-border)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-card)',
              display: 'flex',
              alignItems: 'flex-end',
              padding: '10px 12px 10px 16px',
              gap: '8px',
              transition: 'border-color 200ms, box-shadow 200ms',
            }}
              onFocusCapture={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.boxShadow = 'var(--shadow-card-hover)' }}
              onBlurCapture={e => { e.currentTarget.style.borderColor = 'var(--color-primary-border)'; e.currentTarget.style.boxShadow = 'var(--shadow-card)' }}
            >
              {/* Attach */}
              <input ref={fileInputRef} type="file" accept={ACCEPTED_FILES} className="hidden" onChange={handleFileChange} />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={streaming || fileLoading}
                title="Attach file"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', flexShrink: 0, padding: '2px', display: 'flex', alignItems: 'center', opacity: (streaming || fileLoading) ? 0.3 : 1 }}
              >
                <Plus size={18} />
              </button>

              {/* Textarea */}
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value)
                  e.target.style.height = 'auto'
                  e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'
                }}
                onKeyDown={handleKeyDown}
                placeholder={attachedFile ? `Ask about ${attachedFile.name}…` : 'Ask anything'}
                rows={1}
                disabled={streaming}
                style={{
                  flex: 1, resize: 'none', border: 'none', outline: 'none', background: 'transparent',
                  fontFamily: 'var(--font-sans)', fontSize: '16px', color: 'var(--color-text)',
                  lineHeight: '1.5', minHeight: '26px', maxHeight: '160px',
                }}
              />

              {/* Send */}
              <button
                onClick={sendMessage}
                disabled={streaming || (!input.trim() && !attachedFile)}
                style={{
                  background: 'var(--color-primary)', border: 'none', borderRadius: '50%',
                  width: '34px', height: '34px', flexShrink: 0, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'opacity 200ms', opacity: (streaming || (!input.trim() && !attachedFile)) ? 0.35 : 1,
                }}
              >
                {streaming
                  ? <div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  : <SendHorizonal size={15} color="white" />
                }
              </button>
            </div>

            <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--color-text-faint)', marginTop: '10px' }}>
              ELIZA · LUMEN Project · MOSAIC University
            </p>
          </div>
        </div>

      </main>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
