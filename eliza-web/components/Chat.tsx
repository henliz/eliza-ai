'use client'

import { useState, useRef, useEffect, KeyboardEvent, useCallback } from 'react'
import { SquarePen, Search, Settings, HelpCircle, Plus, SendHorizonal } from 'lucide-react'
import { FRAGMENT_001_ATBASH } from '@/lib/prompts'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'

interface Message {
  role: 'user' | 'assistant'
  content: string        // plain text (for API)
  contentHtml?: string   // HTML with anomaly span (for rendering)
  hasAnomaly?: boolean
  corrupted?: boolean    // corruption animation has run
  fileName?: string
}

interface ChatProps { username: string }

const GLYPH = '◈'
const ACCEPTED_FILES = '.txt,.md,.csv,.rtf,.pdf,.docx'
const SCRAMBLE_POOL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789░▒▓█▄▀'

function randomChar() { return SCRAMBLE_POOL[Math.floor(Math.random() * SCRAMBLE_POOL.length)] }
function scramble(len: number) { return Array.from({ length: len }, randomChar).join('') }

export default function Chat({ username }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [currentResponse, setCurrentResponse] = useState('')
  const [attachedFile, setAttachedFile] = useState<{ name: string; text: string } | null>(null)
  const [fileLoading, setFileLoading] = useState(false)
  const [fileError, setFileError] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [lumenVoiceUsed, setLumenVoiceUsed] = useState(false)
  // Corruption animation state: which message index, current display text
  const [corruptingIdx, setCorruptingIdx] = useState<number | null>(null)
  const [corruptionDisplay, setCorruptionDisplay] = useState('')
  const corruptionRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const initials = username.slice(0, 2).toUpperCase()
  const email = `${username.toLowerCase()}@mosaic.edu`

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, currentResponse])

  // ── Corruption animation ─────────────────────────────────────────
  const triggerCorruption = useCallback((msgIdx: number) => {
    const cipher = FRAGMENT_001_ATBASH
    const targetLen = cipher.length + 20 // rough length for scramble

    setCorruptingIdx(msgIdx)
    setCorruptionDisplay(scramble(targetLen))

    // Phase 1: scramble every 40ms for 600ms
    corruptionRef.current = setInterval(() => {
      setCorruptionDisplay(scramble(targetLen))
    }, 40)

    // Phase 2: resolve into ciphertext at 600ms
    setTimeout(() => {
      if (corruptionRef.current) clearInterval(corruptionRef.current)
      let i = 0
      corruptionRef.current = setInterval(() => {
        i += 3
        setCorruptionDisplay(
          cipher.slice(0, i) + scramble(Math.max(0, cipher.length - i))
        )
        if (i >= cipher.length) {
          if (corruptionRef.current) clearInterval(corruptionRef.current)
          setCorruptionDisplay(cipher + ' ▌')
          // Phase 3: mark as corrupted
          setTimeout(() => {
            setMessages(prev => prev.map((m, idx) =>
              idx === msgIdx ? { ...m, corrupted: true } : m
            ))
            setCorruptingIdx(null)
          }, 200)
        }
      }, 30)
    }, 600)
  }, [])

  useEffect(() => {
    return () => { if (corruptionRef.current) clearInterval(corruptionRef.current) }
  }, [])

  // ── File upload ──────────────────────────────────────────────────
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

  // ── Send message ─────────────────────────────────────────────────
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
    if (inputRef.current) inputRef.current.style.height = 'auto'

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
          lumenVoiceUsed,
        }),
      })
      if (!res.ok) throw new Error('Stream failed')

      const hasAnomaly = res.headers.get('X-Eliza-Anomaly') === 'true'
      const lumenUsed = res.headers.get('X-Eliza-Lumen-Used') === 'true'

      if (lumenUsed) setLumenVoiceUsed(true)

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let full = ''

      while (reader) {
        const { done, value } = await reader.read()
        if (done) break
        full += decoder.decode(value)
        setCurrentResponse(full)
      }

      // Strip HTML from content used for API calls; keep HTML for rendering
      const contentHtml = hasAnomaly ? full : undefined
      const contentPlain = hasAnomaly
        ? full.replace(/<[^>]*>/g, '') // strip span tags for API context
        : full

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: contentPlain, contentHtml, hasAnomaly, corrupted: false },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Something went wrong. Please try again.' },
      ])
    } finally {
      setStreaming(false)
      setCurrentResponse('')
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const allMessages = streaming
    ? [...messages, { role: 'assistant' as const, content: currentResponse }]
    : messages

  const hasMessages = allMessages.length > 0

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* Sidebar */}
      {sidebarOpen && (
        <aside style={{ width: '280px', flexShrink: 0, background: 'var(--bg-sidebar)', padding: '24px 16px', display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(161,159,238,0.1)' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', color: 'var(--color-primary)' }}>ELIZA</span>
              <button onClick={() => setSidebarOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', opacity: 0.6, fontSize: '14px', padding: '4px' }}>‹</button>
            </div>
            <button
              onClick={() => { setMessages([]); setInput(''); setAttachedFile(null) }}
              style={{ width: '100%', background: 'var(--bg-card)', border: 'none', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-card)', color: 'var(--color-primary)', fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 500, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', transition: 'box-shadow 200ms, transform 200ms', marginBottom: '8px' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-card-hover)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-card)' }}
            >
              <SquarePen size={15} /> New chat
            </button>
            <button style={{ width: '100%', background: 'none', border: 'none', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-faint)', fontFamily: 'var(--font-sans)', fontSize: '14px', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <Search size={15} /> Search
            </button>
          </div>
          <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0, background: 'radial-gradient(circle, #F9EFF4, #C8C6F7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 600, color: 'var(--color-primary)' }}>{initials}</div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.2 }}>{username}</div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-faint)', lineHeight: 1.4 }}>{email}</div>
              </div>
            </div>
            <div style={{ height: '1px', background: 'rgba(161,159,238,0.2)', marginBottom: '12px' }} />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', opacity: 0.7, padding: '2px' }}><Settings size={16} /></button>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', opacity: 0.7, padding: '2px' }}><HelpCircle size={16} /></button>
            </div>
          </div>
        </aside>
      )}

      {/* Main */}
      <main style={{ flex: 1, background: 'var(--bg-main)', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>

        {!sidebarOpen && (
          <button onClick={() => setSidebarOpen(true)} style={{ position: 'absolute', top: '16px', left: '16px', background: 'var(--bg-card)', border: 'none', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)', color: 'var(--color-primary)', cursor: 'pointer', padding: '6px 10px', fontSize: '14px', zIndex: 10 }}>›</button>
        )}

        {/* Messages */}
        {hasMessages ? (
          <div style={{ flex: 1, overflowY: 'auto', padding: '32px 24px 16px' }}>
            <div style={{ maxWidth: '760px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {allMessages.map((msg, i) => {
                const isCorrupting = corruptingIdx === i
                const isFinalCorrupted = msg.corrupted

                return (
                  <div key={i} style={{ display: 'flex', gap: '12px', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>

                    {msg.role === 'assistant' && (
                      <div style={{ width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0, background: 'radial-gradient(circle, #F9EFF4, #C8C6F7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: 'var(--color-primary)', fontFamily: 'monospace', marginTop: '2px' }}>◈</div>
                    )}

                    <div style={{ maxWidth: '78%', display: 'flex', flexDirection: 'column', gap: '4px', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                      {msg.role === 'assistant' && (
                        <span style={{ fontSize: '11px', color: 'var(--color-text-faint)', fontWeight: 500, paddingLeft: '2px' }}>ELIZA</span>
                      )}
                      {msg.fileName && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--color-primary-soft)', borderRadius: 'var(--radius-sm)', padding: '6px 12px', marginBottom: '4px' }}>
                          <Plus size={11} style={{ color: 'var(--color-primary)' }} />
                          <span style={{ fontSize: '11px', color: 'var(--color-text)' }}>{msg.fileName}</span>
                        </div>
                      )}

                      {msg.role === 'user' ? (
                        // User bubble — pill with color
                        <div style={{
                          background: 'var(--color-primary)',
                          color: '#fff',
                          borderRadius: 'var(--radius-md) var(--radius-md) var(--radius-sm) var(--radius-md)',
                          padding: '10px 16px',
                          fontSize: '14px', lineHeight: '1.65',
                          fontFamily: 'var(--font-sans)',
                        }}>
                          <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                            {msg.fileName
                              ? (msg.content.split(`[Attached file: ${msg.fileName}]`)[0].trim() || '(file attached)')
                              : msg.content}
                          </p>
                        </div>
                      ) : (
                        // ELIZA response — no card, just text + glyph
                        <div
                          className="eliza-response"
                          data-has-anomaly={msg.hasAnomaly ? 'true' : undefined}
                          style={{ position: 'relative', paddingBottom: '20px' }}
                        >
                          {(isCorrupting || isFinalCorrupted) ? (
                            <p style={{
                              whiteSpace: 'pre-wrap', margin: 0,
                              fontFamily: 'var(--font-mono)',
                              color: '#00994d', fontSize: '13px',
                              lineHeight: '1.9', letterSpacing: '0.04em',
                            }}>
                              {isFinalCorrupted ? FRAGMENT_001_ATBASH + ' ▌' : corruptionDisplay}
                            </p>
                          ) : (
                            <div className="eliza-content eliza-prose">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                rehypePlugins={[rehypeRaw]}
                              >
                                {msg.contentHtml ?? msg.content}
                              </ReactMarkdown>
                              {streaming && i === allMessages.length - 1 && (
                                <span className="cursor-blink" />
                              )}
                            </div>
                          )}

                          <span
                            className={`eliza-glyph${msg.hasAnomaly && !msg.corrupted ? ' active' : msg.corrupted ? ' done' : ''}`}
                            onClick={msg.hasAnomaly && !msg.corrupted && !isCorrupting ? () => triggerCorruption(i) : undefined}
                            title={msg.hasAnomaly && !msg.corrupted ? 'LUMEN' : undefined}
                          >
                            {GLYPH}
                          </span>
                        </div>
                      )}
                    </div>

                    {msg.role === 'user' && (
                      <div style={{ width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0, background: 'radial-gradient(circle, #F9EFF4, #C8C6F7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600, color: 'var(--color-primary)', marginTop: '2px' }}>{initials}</div>
                    )}
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>
          </div>
        ) : streaming ? (
          // Streaming state shown inline — handled in message list above
          null
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            <h1 className="fade-up" style={{ fontFamily: 'var(--font-serif)', fontSize: '40px', color: 'var(--color-primary)', fontWeight: 400, marginBottom: '32px', textAlign: 'center' }}>
              How can I help you?
            </h1>
          </div>
        )}

        {/* Input */}
        <div className={hasMessages ? '' : 'fade-up-delay'} style={{ padding: hasMessages ? '8px 24px 24px' : '0 24px 48px', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: '760px' }}>
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

            <div
              style={{ background: 'var(--bg-card)', border: '2px solid var(--color-primary-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', display: 'flex', alignItems: 'flex-end', padding: '10px 12px 10px 16px', gap: '8px', transition: 'border-color 200ms, box-shadow 200ms' }}
              onFocusCapture={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.boxShadow = 'var(--shadow-card-hover)' }}
              onBlurCapture={e => { e.currentTarget.style.borderColor = 'var(--color-primary-border)'; e.currentTarget.style.boxShadow = 'var(--shadow-card)' }}
            >
              <input ref={fileInputRef} type="file" accept={ACCEPTED_FILES} className="hidden" onChange={handleFileChange} />
              <button onClick={() => fileInputRef.current?.click()} disabled={streaming || fileLoading} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', flexShrink: 0, padding: '2px', display: 'flex', alignItems: 'center', opacity: (streaming || fileLoading) ? 0.3 : 1 }}>
                <Plus size={18} />
              </button>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px' }}
                onKeyDown={handleKeyDown}
                placeholder={attachedFile ? `Ask about ${attachedFile.name}…` : 'Ask anything'}
                rows={1}
                disabled={streaming}
                style={{ flex: 1, resize: 'none', border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-sans)', fontSize: '16px', color: 'var(--color-text)', lineHeight: '1.5', minHeight: '26px', maxHeight: '160px' }}
              />
              <button
                onClick={sendMessage}
                disabled={streaming || (!input.trim() && !attachedFile)}
                style={{ background: 'var(--color-primary)', border: 'none', borderRadius: '50%', width: '34px', height: '34px', flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'opacity 200ms', opacity: (streaming || (!input.trim() && !attachedFile)) ? 0.35 : 1 }}
              >
                {streaming
                  ? <div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  : <SendHorizonal size={15} color="white" />}
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
