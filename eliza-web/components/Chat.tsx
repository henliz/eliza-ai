'use client'

import { useState, useRef, useEffect, FormEvent, KeyboardEvent } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  hasAnomaly?: boolean
}

interface ChatProps {
  username: string
}

const GLYPH = '◈'

export default function Chat({ username }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `Hello, ${username}. I'm ELIZA, your university AI assistant.\n\nHow can I help you today?`,
    },
  ])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [currentResponse, setCurrentResponse] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, currentResponse])

  async function sendMessage() {
    if (!input.trim() || streaming) return
    const userText = input.trim()
    setInput('')

    const newMessages: Message[] = [...messages, { role: 'user', content: userText }]
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

              {/* ELIZA avatar */}
              {msg.role === 'assistant' && (
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#5a6fa5] flex items-center justify-center mt-0.5">
                  <span className="text-white text-[10px] font-mono">◈</span>
                </div>
              )}

              <div className={`max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>

                {msg.role === 'assistant' && (
                  <span className="text-[11px] text-[#aaa] font-medium px-1">ELIZA</span>
                )}

                <div
                  className={`eliza-response rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[#1a1a1a] text-white rounded-br-sm'
                      : 'bg-white border border-[#e5e5e0] text-[#1a1a1a] rounded-bl-sm shadow-sm pb-6'
                  }`}
                >
                  <p className="whitespace-pre-wrap">
                    {msg.content}
                    {streaming && i === allMessages.length - 1 && msg.role === 'assistant' && (
                      <span className="cursor-blink" />
                    )}
                  </p>

                  {/* Glyph — contract with Dev B's extension */}
                  {msg.role === 'assistant' && (
                    <span className="eliza-glyph">{GLYPH}</span>
                  )}
                </div>

                {msg.hasAnomaly && (
                  <span className="text-[10px] text-[#bbb] px-1">render anomaly · fragment logged</span>
                )}
              </div>

              {/* User avatar */}
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

      {/* Input */}
      <div className="flex-shrink-0 px-4 pb-5 pt-2 bg-[#f5f5f0]">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white border border-[#e5e5e0] rounded-2xl shadow-sm flex items-end gap-2 px-4 py-3 focus-within:border-[#5a6fa5] focus-within:ring-2 focus-within:ring-[#5a6fa5]/10 transition">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'
              }}
              onKeyDown={handleKeyDown}
              placeholder="Message ELIZA..."
              rows={1}
              disabled={streaming}
              className="flex-1 resize-none outline-none text-sm text-[#1a1a1a] placeholder:text-[#ccc] bg-transparent disabled:opacity-50"
              style={{ minHeight: '24px', maxHeight: '160px' }}
            />
            <button
              onClick={sendMessage}
              disabled={streaming || !input.trim()}
              className="flex-shrink-0 w-8 h-8 bg-[#1a1a1a] hover:bg-[#333] rounded-xl flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed"
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
          <p className="text-center text-[11px] text-[#ccc] mt-2">
            ELIZA · LUMEN Project · MOSAIC University · All sessions monitored
          </p>
        </div>
      </div>

    </div>
  )
}
