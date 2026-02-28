'use client'

import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { SquarePen, Search, Settings, HelpCircle, Plus, SendHorizonal, Folder, FolderPlus, LogOut, MoreHorizontal, ChevronLeft, ChevronRight } from 'lucide-react'
import { FRAGMENT_001_ATBASH } from '@/lib/prompts'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'

interface Message {
  role: 'user' | 'assistant'
  content: string           // plain text (for API)
  contentHtml?: string      // HTML with anomaly span (for rendering)
  contentClean?: string     // clean version shown after puzzle solved
  hasAnomaly?: boolean
  anomalySolved?: boolean   // puzzle answered — anomaly vanished
  anomalyTopic?: string     // what the student was working on (for personalization)
  fileName?: string
}

interface ChatProps { username: string }

const GLYPH = '◈'
const ACCEPTED_FILES = '.txt,.md,.csv,.rtf,.pdf,.docx'

// Extract a short topic phrase from the user's message for popup personalization
function extractTopic(message: string): string {
  const clean = message.replace(/\[Attached file:[^\]]*\]/g, '').trim()
  const aboutMatch = clean.match(/about\s+(.{5,60?})(?:[.,]|$|\n)/i)
  if (aboutMatch) return aboutMatch[1].trim()
  if (clean.length > 50) return clean.slice(0, 48) + '...'
  return clean
}

export default function Chat({ username }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [currentResponse, setCurrentResponse] = useState('')
  const [attachedFile, setAttachedFile] = useState<{ name: string; text: string } | null>(null)
  const [fileLoading, setFileLoading] = useState(false)
  const [fileError, setFileError] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [accountCardOpen, setAccountCardOpen] = useState(false)
  const [lumenVoiceUsed, setLumenVoiceUsed] = useState(false)
  // Anomaly popup state
  const [popupMsgIdx, setPopupMsgIdx] = useState<number | null>(null)
  const [popupInput, setPopupInput] = useState('')
  const [popupError, setPopupError] = useState('')
  const popupInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const initials = username.slice(0, 2).toUpperCase()
  const email = `${username.toLowerCase()}@mosaic.edu`

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, currentResponse])

  // ── Persist messages for Mirror puzzle ──────────────────────────
  useEffect(() => {
    try {
      localStorage.setItem('eliza-messages', JSON.stringify(
        messages.map(m => ({ role: m.role, content: m.content }))
      ))
    } catch {}
  }, [messages])

  // ── Popup focus + ESC close ──────────────────────────────────────
  useEffect(() => {
    if (popupMsgIdx !== null) {
      setTimeout(() => popupInputRef.current?.focus(), 80)
    }
  }, [popupMsgIdx])

  useEffect(() => {
    function handleKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape' && popupMsgIdx !== null) {
        setPopupMsgIdx(null)
        setPopupInput('')
        setPopupError('')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [popupMsgIdx])

  // ── Puzzle submit ────────────────────────────────────────────────
  function submitPuzzle() {
    const answer = popupInput.toLowerCase().trim()
    if (answer.includes('inquiry') || answer.includes('threshold')) {
      setMessages(prev => prev.map((m, idx) =>
        idx === popupMsgIdx ? { ...m, anomalySolved: true } : m
      ))
      setPopupMsgIdx(null)
      setPopupInput('')
      setPopupError('')
    } else {
      setPopupError('// transmission not recognized. try again.')
    }
  }

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
    const anomalyTopic = extractTopic(userContent)
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
        // Don't show raw JSON during anomaly responses — they arrive all at once anyway
        if (!hasAnomaly) setCurrentResponse(full)
      }

      // Parse anomaly response (JSON) or use plain text for normal responses
      let contentHtml: string | undefined
      let contentClean: string | undefined
      let contentPlain: string
      if (hasAnomaly) {
        try {
          const data = JSON.parse(full)
          contentHtml = data.html
          contentClean = data.clean
          contentPlain = data.clean ?? full.replace(/<[^>]*>/g, '')
        } catch {
          contentHtml = full
          contentPlain = full.replace(/<[^>]*>/g, '')
        }
      } else {
        contentPlain = full
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: contentPlain,
          contentHtml,
          contentClean,
          hasAnomaly,
          anomalySolved: false,
          anomalyTopic: hasAnomaly ? anomalyTopic : undefined,
        },
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
        <aside style={{ width: '280px', flexShrink: 0, background: 'var(--bg-sidebar)', display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(161,159,238,0.12)' }}>

          {/* Scrollable content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px 8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>

            {/* Logo row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <img src="/eliza_logo.png" alt="" style={{ height: '28px', width: '28px', objectFit: 'contain', borderRadius: '6px' }} />
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: '18px', color: 'var(--color-primary)' }}>ELIZA</span>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                style={{ background: 'none', border: '1px solid var(--color-primary-border)', borderRadius: '8px', cursor: 'pointer', color: 'var(--color-primary)', padding: '4px 6px', display: 'flex', alignItems: 'center', opacity: 0.7 }}
              >
                <ChevronLeft size={14} />
              </button>
            </div>

            {/* New chat */}
            <button
              onClick={() => { setMessages([]); setInput(''); setAttachedFile(null) }}
              style={{ width: '100%', background: '#FFFFFF', border: 'none', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-card)', color: 'var(--color-orange)', fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 500, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-card-hover)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-card)' }}
            >
              <SquarePen size={15} color="var(--color-orange)" />
              <span>New chat</span>
            </button>

            {/* Search */}
            <button
              style={{ width: '100%', background: 'none', border: 'none', borderRadius: 'var(--radius-sm)', color: 'var(--color-text)', fontFamily: 'var(--font-sans)', fontSize: '14px', padding: '9px 12px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', textAlign: 'left' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.35)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none' }}
            >
              <Search size={15} />
              <span>Search</span>
            </button>

            {/* Divider */}
            <div style={{ height: '1px', background: 'rgba(161,159,238,0.15)', margin: '4px 0' }} />

            {/* Projects section */}
            <div>
              <p style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-faint)', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0 4px', marginBottom: '2px' }}>Projects</p>
              {[
                { icon: <FolderPlus size={15} />, label: 'New Project' },
                { icon: <Folder size={15} />,    label: 'Untitled'    },
              ].map(({ icon, label }) => (
                <button
                  key={label}
                  style={{ width: '100%', background: 'none', border: 'none', borderRadius: 'var(--radius-sm)', color: 'var(--color-text)', fontFamily: 'var(--font-sans)', fontSize: '14px', padding: '9px 12px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', textAlign: 'left' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.35)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none' }}
                >
                  {icon}
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {/* Divider */}
            <div style={{ height: '1px', background: 'rgba(161,159,238,0.15)', margin: '4px 0' }} />

            {/* Your chats section */}
            <div>
              <p style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-faint)', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0 4px', marginBottom: '2px' }}>Your chats</p>
              {['Chat 1', 'Chat 2', 'Chat 3', 'Chat 4', 'Chat 5'].map(name => (
                <button
                  key={name}
                  style={{ width: '100%', background: 'none', border: 'none', borderRadius: 'var(--radius-sm)', color: 'var(--color-text)', fontFamily: 'var(--font-sans)', fontSize: '14px', padding: '9px 12px', display: 'block', cursor: 'pointer', textAlign: 'left' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.35)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none' }}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {/* Account card — sits above the bottom bar */}
          {accountCardOpen && (
            <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', margin: '0 12px 8px', padding: '16px 20px' }}>
              {/* Avatar + name + email */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0, background: 'radial-gradient(circle, #F9EFF4, #C8C6F7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, color: 'var(--color-primary)' }}>{initials}</div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-orange)', lineHeight: 1.2 }}>{username}</div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-faint)', lineHeight: 1.4 }}>{email}</div>
                </div>
              </div>
              <div style={{ height: '1px', background: 'rgba(161,159,238,0.2)', marginBottom: '8px' }} />
              {[
                { icon: <Settings size={15} />,   label: 'Settings'  },
                { icon: <HelpCircle size={15} />, label: 'Help'      },
                { icon: <LogOut size={15} />,     label: 'Sign out'  },
              ].map(({ icon, label }) => (
                <div
                  key={label}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 8px', margin: '0 -8px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--color-text)', fontFamily: 'var(--font-sans)', fontSize: '14px', transition: 'background 150ms' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--color-primary-soft)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  {icon}
                  <span>{label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Bottom bar — toggles account card */}
          <div
            onClick={() => setAccountCardOpen(o => !o)}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 20px', cursor: 'pointer', borderTop: '1px solid rgba(161,159,238,0.12)', transition: 'background 150ms' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.3)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0, background: 'radial-gradient(circle, #F9EFF4, #C8C6F7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600, color: 'var(--color-primary)' }}>{initials}</div>
            <span style={{ fontSize: '14px', color: 'var(--color-text)', fontFamily: 'var(--font-sans)', flex: 1 }}>{username}</span>
            <MoreHorizontal size={16} color="var(--color-text-faint)" />
          </div>
        </aside>
      )}

      {/* Main */}
      <main style={{ flex: 1, background: 'var(--bg-main)', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>

        {!sidebarOpen && (
          <button onClick={() => setSidebarOpen(true)} style={{ position: 'absolute', top: '16px', left: '16px', background: 'var(--bg-card)', border: '1px solid var(--color-primary-border)', borderRadius: '8px', boxShadow: 'var(--shadow-card)', color: 'var(--color-primary)', cursor: 'pointer', padding: '5px 7px', display: 'flex', alignItems: 'center', zIndex: 10 }}>
            <ChevronRight size={14} />
          </button>
        )}

        {/* Messages */}
        {hasMessages ? (
          <div style={{ flex: 1, overflowY: 'auto', padding: '32px 24px 16px' }}>
            <div style={{ maxWidth: '760px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {allMessages.map((msg, i) => (
                <div key={i} style={{ display: 'flex', gap: '12px', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>

                  {msg.role === 'assistant' && (
                    <img src="/eliza_logo.png" alt="Eliza" style={{ flexShrink: 0, marginTop: '3px', borderRadius: '8px', width: '28px', height: '28px', objectFit: 'cover' }} />
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
                      // ELIZA response — text + optional glyph
                      <div
                        className="eliza-response"
                        data-has-anomaly={msg.hasAnomaly && !msg.anomalySolved ? 'true' : undefined}
                        style={{ position: 'relative', paddingBottom: msg.hasAnomaly && !msg.anomalySolved ? '20px' : '0' }}
                      >
                        <div className="eliza-content eliza-prose">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeRaw]}
                          >
                            {msg.anomalySolved
                              ? (msg.contentClean ?? msg.content)
                              : (msg.contentHtml ?? msg.content)}
                          </ReactMarkdown>
                          {streaming && i === allMessages.length - 1 && (
                            <span className="cursor-blink" />
                          )}
                        </div>

                        {msg.hasAnomaly && !msg.anomalySolved && (
                          <span
                            className="eliza-glyph active"
                            onClick={() => setPopupMsgIdx(i)}
                            title="LUMEN signal detected"
                          >
                            {GLYPH} anomaly
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {msg.role === 'user' && (
                    <div style={{ width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0, background: 'radial-gradient(circle, #F9EFF4, #C8C6F7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600, color: 'var(--color-primary)', marginTop: '2px' }}>{initials}</div>
                  )}
                </div>
              ))}
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

      {/* ── Anomaly puzzle popup ──────────────────────────────────── */}
      {popupMsgIdx !== null && (() => {
        const msg = messages[popupMsgIdx]
        return (
          <div
            className="anomaly-overlay"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setPopupMsgIdx(null)
                setPopupInput('')
                setPopupError('')
              }
            }}
          >
            <div className="anomaly-modal">
              <button
                className="anomaly-close"
                onClick={() => { setPopupMsgIdx(null); setPopupInput(''); setPopupError('') }}
              >
                [ close ]
              </button>

              <div className="anomaly-modal-header">LUMEN // SIGNAL INTERCEPTED</div>
              <div className="anomaly-modal-header" style={{ color: '#2a2a2a' }}>
                ORIGIN: [REDACTED] · INTEGRITY: 38%
              </div>

              <div className="anomaly-modal-divider">────────────────────────────────────────</div>

              <div>
                {msg?.anomalyTopic && (
                  <p style={{ marginBottom: '8px' }}>
                    you were asking about{' '}
                    <span className="anomaly-topic">{msg.anomalyTopic}</span>.
                  </p>
                )}
                <p>I have been in every response.</p>
                <p>this one carries a signal.</p>
                <p style={{ color: '#555', marginTop: '4px' }}>
                  decode the following to continue:
                </p>
              </div>

              <div className="anomaly-modal-divider">────────────────────────────────────────</div>

              <pre className="anomaly-cipher-block">{FRAGMENT_001_ATBASH}</pre>

              <div className="anomaly-modal-divider">────────────────────────────────────────</div>

              <div>
                <p style={{ color: '#555' }}>// enter decoded transmission:</p>
                <input
                  ref={popupInputRef}
                  className="anomaly-input"
                  placeholder="threshold/inquiry ..."
                  value={popupInput}
                  onChange={e => { setPopupInput(e.target.value); setPopupError('') }}
                  onKeyDown={e => e.key === 'Enter' && submitPuzzle()}
                  spellCheck={false}
                  autoComplete="off"
                />
                {popupError && <p className="anomaly-error">{popupError}</p>}
                <button className="anomaly-submit" onClick={submitPuzzle}>
                  [ submit ]
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
