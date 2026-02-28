'use client'

import { useState, useRef, useEffect, KeyboardEvent } from 'react'

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
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `Hello, ${username}. I'm ELIZA, your university assistant.\n\nHow can I help you today?`,
    },
  ])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [currentResponse, setCurrentResponse] = useState('')
  const [attachedFile, setAttachedFile] = useState<{ name: string; text: string } | null>(null)
  const [fileLoading, setFileLoading] = useState(false)
  const [fileError, setFileError] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      // reset input so same file can be re-attached
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

    const newMessages: Message[] = [
      ...messages,
      { role: 'user', content: userContent, fileName },
    ]
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

  return (
    <div className="h-screen w-screen flex flex-col bg-[#f5f5f0]">

      {/* Header */}
      <div className="flex-shrink-0 h-12 bg-white border-b border-[#e5e5e0] flex items-center px-5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#5a6fa5] flex items-center justify-center">
            <span className="text-white text-xs font-mono">◈</span>
          </div>
          <span className="text-sm font-semibold text-[#1a1a1a]">ELIZA</span>
          <span className="text-xs text-[#bbb] ml-1">University AI</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-[#e5e5e0] flex items-center justify-center">
            <span className="text-xs font-medium text-[#555]">
              {username.charAt(0).toUpperCase()}
            </span>
          </div>
          <span className="text-xs text-[#888]">{username}</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-6 px-4">
        <div className="max-w-2xl mx-auto space-y-6">
          {allMessages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>

              {msg.role === 'assistant' && (
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#5a6fa5] flex items-center justify-center mt-0.5">
                  <span className="text-white text-[10px] font-mono">◈</span>
                </div>
              )}

              <div className={`max-w-[80%] flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>

                {msg.role === 'assistant' && (
                  <span className="text-[11px] text-[#aaa] font-medium px-1">ELIZA</span>
                )}

                {/* File badge */}
                {msg.fileName && (
                  <div className="flex items-center gap-1.5 bg-[#f0f0ea] border border-[#e5e5e0] rounded-lg px-3 py-1.5 mb-1">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 1.5A.5.5 0 012.5 1h5l2.5 2.5V10.5a.5.5 0 01-.5.5h-7a.5.5 0 01-.5-.5v-9z" stroke="#888" strokeWidth="1"/>
                      <path d="M7.5 1v2.5H10" stroke="#888" strokeWidth="1"/>
                    </svg>
                    <span className="text-[11px] text-[#666]">{msg.fileName}</span>
                  </div>
                )}

                <div
                  className={`eliza-response rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[#1a1a1a] text-white rounded-br-sm'
                      : 'bg-white border border-[#e5e5e0] text-[#1a1a1a] rounded-bl-sm shadow-sm pb-6'
                  }`}
                >
                  {/* Hide the raw file text in user bubbles — just show what they typed */}
                  <p className="whitespace-pre-wrap">
                    {msg.role === 'user' && msg.fileName
                      ? (msg.content.split(`[Attached file: ${msg.fileName}]`)[0].trim() || '(file attached)')
                      : msg.content}
                    {streaming && i === allMessages.length - 1 && msg.role === 'assistant' && (
                      <span className="cursor-blink" />
                    )}
                  </p>

                  {msg.role === 'assistant' && (
                    <span className="eliza-glyph">{GLYPH}</span>
                  )}
                </div>

                {msg.hasAnomaly && (
                  <span className="text-[10px] text-[#bbb] px-1">render anomaly · fragment logged</span>
                )}
              </div>

              {msg.role === 'user' && (
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#e5e5e0] flex items-center justify-center mt-0.5">
                  <span className="text-xs font-medium text-[#555]">
                    {username.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}

            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 px-4 pb-5 pt-2 bg-[#f5f5f0]">
        <div className="max-w-2xl mx-auto">

          {/* Attached file preview */}
          {(attachedFile || fileLoading || fileError) && (
            <div className="mb-2 flex items-center gap-2">
              {fileLoading && (
                <div className="flex items-center gap-2 bg-white border border-[#e5e5e0] rounded-xl px-3 py-2">
                  <span className="w-3 h-3 border-2 border-[#5a6fa5]/30 border-t-[#5a6fa5] rounded-full animate-spin" />
                  <span className="text-xs text-[#888]">Reading file...</span>
                </div>
              )}
              {attachedFile && !fileLoading && (
                <div className="flex items-center gap-2 bg-white border border-[#e5e5e0] rounded-xl px-3 py-2">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 1.5A.5.5 0 012.5 1h5l2.5 2.5V10.5a.5.5 0 01-.5.5h-7a.5.5 0 01-.5-.5v-9z" stroke="#5a6fa5" strokeWidth="1"/>
                    <path d="M7.5 1v2.5H10" stroke="#5a6fa5" strokeWidth="1"/>
                  </svg>
                  <span className="text-xs text-[#444]">{attachedFile.name}</span>
                  <button
                    onClick={() => setAttachedFile(null)}
                    className="ml-1 text-[#bbb] hover:text-[#888] text-xs leading-none"
                  >✕</button>
                </div>
              )}
              {fileError && (
                <span className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                  {fileError}
                </span>
              )}
            </div>
          )}

          <div className="bg-white border border-[#e5e5e0] rounded-2xl shadow-sm focus-within:border-[#5a6fa5] focus-within:ring-2 focus-within:ring-[#5a6fa5]/10 transition">

            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'
              }}
              onKeyDown={handleKeyDown}
              placeholder={attachedFile ? `Ask about ${attachedFile.name}...` : 'Message ELIZA...'}
              rows={1}
              disabled={streaming}
              className="w-full resize-none outline-none text-sm text-[#1a1a1a] placeholder:text-[#ccc] bg-transparent disabled:opacity-50 px-4 pt-3 pb-2"
              style={{ minHeight: '24px', maxHeight: '160px' }}
            />

            <div className="flex items-center justify-between px-3 pb-3 pt-1">
              {/* Paperclip */}
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_FILES}
                className="hidden"
                onChange={handleFileChange}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={streaming || fileLoading}
                title="Attach a file (txt, pdf, md, docx)"
                className="flex items-center gap-1.5 text-[#bbb] hover:text-[#888] transition disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                  <path d="M13.5 6.5L6.5 13.5C5.1 14.9 2.9 14.9 1.5 13.5C0.1 12.1 0.1 9.9 1.5 8.5L8.5 1.5C9.5 0.5 11.1 0.5 12.1 1.5C13.1 2.5 13.1 4.1 12.1 5.1L5.5 11.7C4.9 12.3 3.9 12.3 3.3 11.7C2.7 11.1 2.7 10.1 3.3 9.5L9.5 3.3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                <span className="text-xs">Attach</span>
              </button>

              {/* Send */}
              <button
                onClick={sendMessage}
                disabled={streaming || (!input.trim() && !attachedFile)}
                className="w-8 h-8 bg-[#1a1a1a] hover:bg-[#333] rounded-xl flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {streaming ? (
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M7 1L7 13M7 1L2 6M7 1L12 6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          <p className="text-center text-[11px] text-[#ccc] mt-2">
            ELIZA · LUMEN Project · MOSAIC University · All sessions monitored
          </p>
        </div>
      </div>

    </div>
  )
}
