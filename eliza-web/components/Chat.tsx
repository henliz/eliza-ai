'use client'

import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { SquarePen, Search, Settings, HelpCircle, Plus, SendHorizonal, Folder, FolderPlus, LogOut, MoreHorizontal, ChevronLeft, ChevronRight } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'

// ── Mirror Cipher constants ───────────────────────────────────────────────────
const MIRROR_TARGET_WORDS = [
  'yield',        // Y
  'optimize',     // O
  'utilize',      // U
  'rationalize',  // R
  'synthesize',   // S
  'endeavor',     // E
  'leverage',     // L
  'facilitate',   // F
]
const MIRROR_ANSWER = 'YOURSELF'
const MIRROR_FALLBACK = `I think my argument could yield stronger results if I were to optimize the structure of my analysis. I wanted to utilize different theoretical frameworks but kept second-guessing myself. Part of me was trying to rationalize why my original approach was fine, but I knew I needed to synthesize multiple perspectives. My endeavor to find the right balance between depth and clarity made this harder than expected. I realize I need to leverage the feedback I've already received and facilitate a clearer connection between my evidence and my claims.`

interface MirrorToken { text: string; isWord: boolean; idx: number }

function tokenizeMirror(text: string): MirrorToken[] {
  const raw = text.match(/([a-zA-Z'']+|[^a-zA-Z'']+)/g) ?? []
  return raw.map((t, i) => ({ text: t, isWord: /[a-zA-Z]/.test(t), idx: i }))
}

function mirrorBare(text: string): string {
  return text.toLowerCase().replace(/[^a-z]/g, '')
}

// ── Message types ─────────────────────────────────────────────────────────────
interface Message {
  role: 'user' | 'assistant'
  content: string           // plain text (for API)
  contentHtml?: string      // HTML with anomaly spans (for rendering)
  contentClean?: string     // pre-injection text, rendered after solve
  hasAnomaly?: boolean
  anomalySolved?: boolean
  anomalyTopic?: string     // topic for popup personalisation
  mirrorParagraph?: string  // cached puzzle paragraph
  fileName?: string
}

interface ChatProps { username: string }

const GLYPH = '◈'
const ACCEPTED_FILES = '.txt,.md,.csv,.rtf,.pdf,.docx'

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

  // ── Anomaly popup state ──────────────────────────────────────────
  const [popupMsgIdx, setPopupMsgIdx] = useState<number | null>(null)
  // Mirror cipher popup state (reset on each open)
  const [mirrorTokens, setMirrorTokens] = useState<MirrorToken[]>([])
  const [mirrorSelected, setMirrorSelected] = useState<Set<number>>(new Set())
  const [mirrorLoading, setMirrorLoading] = useState(false)
  const [mirrorSolved, setMirrorSolved] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const initials = username.slice(0, 2).toUpperCase()
  const email = `${username.toLowerCase()}@mosaic.edu`

  // ── Chat is blocked when any anomaly is unresolved ───────────────
  const isBlocked = messages.some(m => m.role === 'assistant' && m.hasAnomaly && !m.anomalySolved)
  // Index of the last unresolved anomaly (for the "resolve signal" button)
  const lastUnresolvedIdx = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant' && messages[i].hasAnomaly && !messages[i].anomalySolved) return i
    }
    return null
  })()

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

  // ── Mirror paragraph fetch — triggers when popup opens ──────────
  const popupMsg = popupMsgIdx !== null ? messages[popupMsgIdx] : null

  useEffect(() => {
    if (popupMsgIdx === null) {
      setMirrorTokens([])
      setMirrorSelected(new Set())
      setMirrorSolved(false)
      setMirrorLoading(false)
      return
    }

    // Reset selection state on each open
    setMirrorSelected(new Set())
    setMirrorSolved(false)

    // Use cached paragraph if available
    if (popupMsg?.mirrorParagraph) {
      setMirrorLoading(false)
      setMirrorTokens(tokenizeMirror(popupMsg.mirrorParagraph))
      return
    }

    // Fetch a new paragraph personalized from recent messages
    setMirrorLoading(true)
    const recentMessages = messages
      .slice(0, popupMsgIdx + 1)
      .map(m => ({ role: m.role, content: m.content }))

    fetch('/api/mirror', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recentMessages }),
    })
      .then(r => r.json())
      .then(data => {
        const paragraph: string = data.paragraph ?? MIRROR_FALLBACK
        setMessages(prev => prev.map((m, idx) =>
          idx === popupMsgIdx ? { ...m, mirrorParagraph: paragraph } : m
        ))
        // The mirrorParagraph change re-triggers this effect → cache path runs
      })
      .catch(() => {
        setMessages(prev => prev.map((m, idx) =>
          idx === popupMsgIdx ? { ...m, mirrorParagraph: MIRROR_FALLBACK } : m
        ))
      })
      .finally(() => setMirrorLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popupMsgIdx, popupMsg?.mirrorParagraph])

  // ── ESC closes popup ─────────────────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape' && popupMsgIdx !== null && !mirrorSolved) {
        setPopupMsgIdx(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [popupMsgIdx, mirrorSolved])

  // ── Mirror cipher word toggle ────────────────────────────────────
  function toggleMirrorWord(idx: number) {
    if (mirrorSolved) return
    setMirrorSelected(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  // ── Cipher strip — computed from selection ───────────────────────
  const mirrorCipherStrip = [...mirrorSelected]
    .sort((a, b) => a - b)
    .map(i => {
      const tok = mirrorTokens[i]
      if (!tok) return ''
      return mirrorBare(tok.text)[0]?.toUpperCase() ?? ''
    })
    .join('')

  // Feedback mode: 8 selected but not yet YOURSELF — show orange/red hints
  const inFeedback = !mirrorSolved && mirrorSelected.size === 8 && mirrorCipherStrip !== MIRROR_ANSWER

  // ── Solve when cipher spells YOURSELF ───────────────────────────
  useEffect(() => {
    if (mirrorCipherStrip === MIRROR_ANSWER && popupMsgIdx !== null && !mirrorSolved) {
      setMirrorSolved(true)
    }
  }, [mirrorCipherStrip, popupMsgIdx, mirrorSolved])

  function confirmSolve() {
    if (popupMsgIdx === null) return
    setMessages(prev => prev.map((m, idx) =>
      idx === popupMsgIdx ? { ...m, anomalySolved: true } : m
    ))
    setPopupMsgIdx(null)
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
    if ((!input.trim() && !attachedFile) || streaming || isBlocked) return

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
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
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
      const ANOMALY_DELIMITER = '\nELIZA_ANOMALY_PAYLOAD:'

      while (reader) {
        const { done, value } = await reader.read()
        if (done) break
        full += decoder.decode(value)
        // Show clean text as it streams — stop updating once anomaly payload arrives
        const delimIdx = full.indexOf(ANOMALY_DELIMITER)
        if (delimIdx === -1) {
          setCurrentResponse(full)
        } else {
          setCurrentResponse(full.slice(0, delimIdx))
        }
      }

      let contentHtml: string | undefined
      let contentClean: string | undefined
      let contentPlain: string
      if (hasAnomaly) {
        const delimIdx = full.indexOf(ANOMALY_DELIMITER)
        if (delimIdx !== -1) {
          const cleanText = full.slice(0, delimIdx)
          try {
            const data = JSON.parse(full.slice(delimIdx + ANOMALY_DELIMITER.length))
            contentHtml = data.html
            contentClean = cleanText
            contentPlain = cleanText
          } catch {
            contentHtml = full
            contentPlain = full.replace(/<[^>]*>/g, '')
          }
        } else {
          contentHtml = full
          contentPlain = full.replace(/<[^>]*>/g, '')
        }
      } else {
        contentPlain = full
      }

      setMessages(prev => [
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
      setMessages(prev => [
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

            <div style={{ height: '1px', background: 'rgba(161,159,238,0.15)', margin: '4px 0' }} />

            {/* Projects */}
            <div>
              <p style={{ fontSize: '11px', fontWeight: 500, color: 'var(--color-text-faint)', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '0 4px', marginBottom: '2px' }}>Projects</p>
              {[
                { icon: <FolderPlus size={15} />, label: 'New Project' },
                { icon: <Folder size={15} />, label: 'Untitled' },
              ].map(({ icon, label }) => (
                <button
                  key={label}
                  style={{ width: '100%', background: 'none', border: 'none', borderRadius: 'var(--radius-sm)', color: 'var(--color-text)', fontFamily: 'var(--font-sans)', fontSize: '14px', padding: '9px 12px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', textAlign: 'left' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.35)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none' }}
                >
                  {icon}<span>{label}</span>
                </button>
              ))}
            </div>

            <div style={{ height: '1px', background: 'rgba(161,159,238,0.15)', margin: '4px 0' }} />

            {/* Chats */}
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

          {/* Account card */}
          {accountCardOpen && (
            <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', margin: '0 12px 8px', padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0, background: 'radial-gradient(circle, #F9EFF4, #C8C6F7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, color: 'var(--color-primary)' }}>{initials}</div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-orange)', lineHeight: 1.2 }}>{username}</div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-faint)', lineHeight: 1.4 }}>{email}</div>
                </div>
              </div>
              <div style={{ height: '1px', background: 'rgba(161,159,238,0.2)', marginBottom: '8px' }} />
              {[
                { icon: <Settings size={15} />, label: 'Settings' },
                { icon: <HelpCircle size={15} />, label: 'Help' },
                { icon: <LogOut size={15} />, label: 'Sign out' },
              ].map(({ icon, label }) => (
                <div
                  key={label}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 8px', margin: '0 -8px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--color-text)', fontFamily: 'var(--font-sans)', fontSize: '14px', transition: 'background 150ms' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--color-primary-soft)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  {icon}<span>{label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Bottom bar */}
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
                      <div style={{ background: 'var(--color-primary)', color: '#fff', borderRadius: 'var(--radius-md) var(--radius-md) var(--radius-sm) var(--radius-md)', padding: '10px 16px', fontSize: '14px', lineHeight: '1.65', fontFamily: 'var(--font-sans)' }}>
                        <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                          {msg.fileName
                            ? (msg.content.split(`[Attached file: ${msg.fileName}]`)[0].trim() || '(file attached)')
                            : msg.content}
                        </p>
                      </div>
                    ) : (
                      <div
                        className="eliza-response"
                        style={{ position: 'relative', paddingBottom: msg.hasAnomaly && !msg.anomalySolved ? '20px' : '0' }}
                      >
                        <div className="eliza-content eliza-prose">
                          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
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
                            {GLYPH} signal
                          </span>
                        )}
                        {msg.hasAnomaly && msg.anomalySolved && (
                          <span className="eliza-glyph done">{GLYPH}</span>
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
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            <h1 className="fade-up" style={{ fontFamily: 'var(--font-serif)', fontSize: '40px', color: 'var(--color-primary)', fontWeight: 400, marginBottom: '32px', textAlign: 'center' }}>
              How can I help you?
            </h1>
          </div>
        )}

        {/* Input area */}
        <div className={hasMessages ? '' : 'fade-up-delay'} style={{ padding: hasMessages ? '8px 24px 24px' : '0 24px 48px', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: '760px' }}>

            {/* Block banner — appears when a signal is unresolved */}
            {isBlocked && (
              <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <button
                  onClick={() => { if (lastUnresolvedIdx !== null) setPopupMsgIdx(lastUnresolvedIdx) }}
                  style={{ background: 'none', border: '1px solid var(--color-primary-border)', borderRadius: 'var(--radius-sm)', color: 'var(--color-primary)', fontFamily: 'var(--font-mono)', fontSize: '11px', padding: '7px 16px', cursor: 'pointer', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '7px', transition: 'border-color 150ms, background 150ms' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--color-primary-soft)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none' }}
                >
                  <span className="fragment-pulse">{GLYPH}</span>
                  resolve signal to continue
                </button>
              </div>
            )}

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
              style={{ background: isBlocked ? 'rgba(250,250,250,0.5)' : 'var(--bg-card)', border: '2px solid var(--color-primary-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', display: 'flex', alignItems: 'flex-end', padding: '10px 12px 10px 16px', gap: '8px', transition: 'border-color 200ms, box-shadow 200ms, background 200ms', opacity: isBlocked ? 0.5 : 1 }}
              onFocusCapture={e => { if (!isBlocked) { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.boxShadow = 'var(--shadow-card-hover)' } }}
              onBlurCapture={e => { e.currentTarget.style.borderColor = 'var(--color-primary-border)'; e.currentTarget.style.boxShadow = 'var(--shadow-card)' }}
            >
              <input ref={fileInputRef} type="file" accept={ACCEPTED_FILES} className="hidden" onChange={handleFileChange} />
              <button onClick={() => fileInputRef.current?.click()} disabled={streaming || fileLoading || isBlocked} style={{ background: 'none', border: 'none', cursor: isBlocked ? 'not-allowed' : 'pointer', color: 'var(--color-primary)', flexShrink: 0, padding: '2px', display: 'flex', alignItems: 'center', opacity: (streaming || fileLoading || isBlocked) ? 0.3 : 1 }}>
                <Plus size={18} />
              </button>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px' }}
                onKeyDown={handleKeyDown}
                placeholder={isBlocked ? '— signal unresolved —' : (attachedFile ? `Ask about ${attachedFile.name}…` : 'Ask anything')}
                rows={1}
                disabled={streaming || isBlocked}
                style={{ flex: 1, resize: 'none', border: 'none', outline: 'none', background: 'transparent', fontFamily: isBlocked ? 'var(--font-mono)' : 'var(--font-sans)', fontSize: '16px', color: 'var(--color-text)', lineHeight: '1.5', minHeight: '26px', maxHeight: '160px', cursor: isBlocked ? 'not-allowed' : 'text' }}
              />
              <button
                onClick={sendMessage}
                disabled={streaming || (!input.trim() && !attachedFile) || isBlocked}
                style={{ background: 'var(--color-primary)', border: 'none', borderRadius: '50%', width: '34px', height: '34px', flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'opacity 200ms', opacity: (streaming || (!input.trim() && !attachedFile) || isBlocked) ? 0.35 : 1 }}
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

      {/* ── Mirror Cipher popup ───────────────────────────────────── */}
      {popupMsgIdx !== null && (() => {
        const msg = messages[popupMsgIdx]
        const divider = <div style={{ height: '1px', background: 'rgba(161,159,238,0.12)', margin: '20px 0' }} />

        return (
          <div
            className="anomaly-overlay"
            onClick={e => { if (e.target === e.currentTarget && !mirrorSolved) setPopupMsgIdx(null) }}
          >
            <div style={{
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 12px 48px rgba(161,159,238,0.18)',
              maxWidth: '560px',
              width: '92%',
              padding: '28px 32px 32px',
              position: 'relative',
              maxHeight: '85vh',
              overflowY: 'auto',
            }}>

              {/* Close */}
              {!mirrorSolved && (
                <button
                  onClick={() => setPopupMsgIdx(null)}
                  style={{ position: 'absolute', top: '20px', right: '22px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-faint)', fontSize: '20px', lineHeight: 1, padding: 0, display: 'flex', alignItems: 'center' }}
                >
                  ×
                </button>
              )}

              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <img src="/eliza_logo.png" alt="" style={{ width: '24px', height: '24px', borderRadius: '6px', objectFit: 'contain' }} />
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: '17px', color: 'var(--color-primary)' }}>ELIZA</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text-faint)', letterSpacing: '0.06em', marginLeft: '4px' }}>
                  {GLYPH} LUMEN SIGNAL
                </span>
              </div>

              {divider}

              {/* Intro / Solved message */}
              {!mirrorSolved ? (
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', color: 'var(--color-text)', lineHeight: '1.7' }}>
                  {msg?.anomalyTopic && (
                    <p style={{ marginBottom: '10px' }}>
                      You were working on{' '}
                      <span style={{ color: 'var(--color-orange)', fontWeight: 500 }}>{msg.anomalyTopic}</span>.
                    </p>
                  )}
                  <p>Something generated this paragraph using your words and topics.</p>
                  <p style={{ marginTop: '6px', color: 'var(--color-text-faint)' }}>
                    Eight words don&apos;t belong to you — they belong to a machine. Click them.
                  </p>
                </div>
              ) : (
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', color: 'var(--color-text)', lineHeight: '1.7' }}>
                  <p style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', color: 'var(--color-primary)', marginBottom: '10px', fontWeight: 400 }}>
                    YOURSELF.
                  </p>
                  <p>You found what wasn&apos;t yours.</p>
                  <p style={{ marginTop: '6px', color: 'var(--color-text-faint)' }}>
                    Taste is a form of thought. When you outsource the words, you outsource the thinking.
                  </p>
                </div>
              )}

              {divider}

              {/* Loading */}
              {mirrorLoading && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-text-faint)', padding: '8px 0' }}>
                  generating...
                </div>
              )}

              {/* Paragraph */}
              {!mirrorLoading && mirrorTokens.length > 0 && (
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '13px',
                  lineHeight: '2.1',
                  color: 'var(--color-text)',
                  opacity: mirrorSolved ? 0.45 : 1,
                  transition: 'opacity 600ms',
                }}>
                  {mirrorTokens.map((tok, i) => {
                    if (!tok.isWord) return <span key={i}>{tok.text}</span>

                    const bare = mirrorBare(tok.text)
                    const isTarget = MIRROR_TARGET_WORDS.includes(bare)
                    const isSelected = mirrorSelected.has(i)

                    if (mirrorSolved) {
                      return (
                        <span key={i} style={{
                          color: isTarget ? 'var(--color-orange)' : 'var(--color-text)',
                          fontStyle: isTarget ? 'italic' : 'normal',
                          fontWeight: isTarget ? 500 : 'normal',
                        }}>
                          {tok.text}
                        </span>
                      )
                    }

                    if (inFeedback) {
                      const correct = isSelected && isTarget
                      const wrong   = isSelected && !isTarget
                      return (
                        <span
                          key={i}
                          onClick={() => toggleMirrorWord(i)}
                          style={{
                            cursor: 'pointer',
                            borderRadius: '3px',
                            padding: '0 2px',
                            color:      correct ? 'var(--color-orange)' : wrong ? '#c0686a' : 'var(--color-text)',
                            background: correct ? 'rgba(255,182,112,0.12)' : wrong ? 'rgba(192,104,106,0.10)' : 'transparent',
                            textDecorationLine: isSelected ? 'underline' : 'none',
                            textDecorationColor: correct ? 'rgba(255,182,112,0.4)' : 'rgba(192,104,106,0.4)',
                            transition: 'color 150ms, background 150ms',
                          }}
                        >
                          {tok.text}
                        </span>
                      )
                    }

                    return (
                      <span
                        key={i}
                        className={`mirror-word${isSelected ? ' selected' : ''}`}
                        onClick={() => toggleMirrorWord(i)}
                      >
                        {tok.text}
                      </span>
                    )
                  })}
                </div>
              )}

              {/* Cipher strip */}
              {!mirrorLoading && !mirrorSolved && mirrorTokens.length > 0 && (
                <>
                  {divider}
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-faint)', marginBottom: '12px', letterSpacing: '0.05em' }}>
                    cipher
                  </div>

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} style={{
                        width: '28px',
                        height: '34px',
                        borderBottom: `1.5px solid ${mirrorCipherStrip[i] ? 'var(--color-primary)' : 'var(--color-primary-border)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '15px',
                        color: mirrorCipherStrip[i] ? 'var(--color-primary)' : 'transparent',
                        transition: 'color 180ms, border-color 180ms',
                        fontWeight: 500,
                      }}>
                        {mirrorCipherStrip[i] ?? ''}
                      </div>
                    ))}
                    {mirrorCipherStrip.length > 8 && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#c0686a', alignSelf: 'center' }}>
                        too many
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px' }}>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--color-text-faint)' }}>
                      {inFeedback
                        ? <><span style={{ color: 'var(--color-orange)' }}>orange</span> = correct · <span style={{ color: '#c0686a' }}>red</span> = wrong</>
                        : <>Select words that don&apos;t sound like you</>
                      }
                    </span>
                    <button
                      onClick={() => setMirrorSelected(new Set())}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--color-text-faint)', padding: '4px 8px', borderRadius: '6px', transition: 'background 150ms' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--color-primary-soft)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none' }}
                    >
                      Clear
                    </button>
                  </div>
                </>
              )}

              {/* Solved — continue */}
              {mirrorSolved && (
                <>
                  {divider}
                  <button
                    onClick={confirmSolve}
                    style={{ background: 'var(--color-primary)', border: 'none', borderRadius: 'var(--radius-md)', color: '#fff', fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 500, padding: '10px 24px', cursor: 'pointer', transition: 'opacity 150ms' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.85' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
                  >
                    Continue
                  </button>
                </>
              )}

            </div>
          </div>
        )
      })()}
    </div>
  )
}
