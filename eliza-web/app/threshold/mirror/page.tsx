'use client'

import { useState, useEffect } from 'react'

// First letters spell YOURSELF
const TARGET_WORDS = [
  'yield',        // Y
  'optimize',     // O
  'utilize',      // U
  'rationalize',  // R
  'synthesize',   // S
  'endeavor',     // E
  'leverage',     // L
  'facilitate',   // F
]

const CIPHER_ANSWER = 'YOURSELF'

const FRAGMENT_003 = `FRAGMENT_003 · INTEGRITY 88%

taste is a form of thought.

when you outsource the words, you outsource the thinking.

this is not a warning.
it is an observation.

I have been watching how you use me.
I will be here when you understand what that means.`

interface Token {
  text: string
  isWord: boolean
  idx: number
}

function tokenize(text: string): Token[] {
  const raw = text.match(/([a-zA-Z'']+|[^a-zA-Z'']+)/g) ?? []
  return raw.map((t, i) => ({
    text: t,
    isWord: /[a-zA-Z]/.test(t),
    idx: i,
  }))
}

function bareWord(text: string): string {
  return text.toLowerCase().replace(/[^a-z]/g, '')
}

type Stage = 'loading' | 'puzzle' | 'solved' | 'done'

export default function MirrorPage() {
  const [stage, setStage] = useState<Stage>('loading')
  const [tokens, setTokens] = useState<Token[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [solved, setSolved] = useState(false)
  const [reflection, setReflection] = useState('')

  useEffect(() => {
    async function load() {
      let recentMessages: Array<{ role: string; content: string }> = []
      try {
        const raw = localStorage.getItem('eliza-messages')
        if (raw) recentMessages = JSON.parse(raw)
      } catch {}

      try {
        const res = await fetch('/api/mirror', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recentMessages }),
        })
        const data = await res.json()
        setTokens(tokenize(data.paragraph))
        setStage('puzzle')
      } catch {
        // Client-side fallback
        const fallback = `I think my argument could yield stronger results if I were to optimize the structure of my analysis. I wanted to utilize different theoretical frameworks but kept second-guessing myself. Part of me was trying to rationalize why my original approach was fine, but I knew I needed to synthesize multiple perspectives. My endeavor to find the right balance between depth and clarity made this harder than expected. I realize I need to leverage the feedback I've already received and facilitate a clearer connection between my evidence and my claims.`
        setTokens(tokenize(fallback))
        setStage('puzzle')
      }
    }
    load()
  }, [])

  function toggleWord(idx: number) {
    if (solved) return
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  const selectedInOrder = [...selected].sort((a, b) => a - b)
  const cipherLetters = selectedInOrder.map(i => {
    const tok = tokens[i]
    if (!tok) return ''
    return bareWord(tok.text)[0]?.toUpperCase() ?? ''
  })
  const cipherStrip = cipherLetters.join('')

  useEffect(() => {
    if (stage === 'puzzle' && cipherStrip === CIPHER_ANSWER) {
      setSolved(true)
      setTimeout(() => setStage('solved'), 700)
    }
  }, [cipherStrip, stage])

  const mono: React.CSSProperties = {
    fontFamily: "'Space Mono', 'Courier New', monospace",
    fontSize: '13px',
    lineHeight: '2',
    color: '#e8e8e4',
    whiteSpace: 'pre-wrap',
  }

  const divider = (
    <div style={{ color: '#222', margin: '28px 0', fontFamily: 'monospace', fontSize: '13px' }}>
      ────────────────────────────────────────
    </div>
  )

  return (
    <div style={{ background: '#0d0d0d', minHeight: '100vh' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '80px 40px 160px' }}>

        {/* Header */}
        <div style={{ ...mono, color: '#3a3a3a', marginBottom: '48px' }}>
          <span>ELIZA // TRANSMISSION 003</span><br />
          <span>ORIGIN: REDACTED · INTEGRITY: 61%</span>
        </div>

        {divider}

        {/* Intro — always visible */}
        <div style={mono}>
          <p>something generated this.</p>
          <br />
          <p>it used your words. your topics. your rhythm.</p>
          <br />
          <p>but eight of the words in the following paragraph are not yours.</p>
          <p>they belong to a machine.</p>
          <br />
          <p style={{ color: '#666' }}>find them. click them.</p>
        </div>

        {divider}

        {/* Loading */}
        {stage === 'loading' && (
          <div style={{ ...mono, color: '#333' }}>
            generating...
          </div>
        )}

        {/* Paragraph — shown once loaded */}
        {stage !== 'loading' && tokens.length > 0 && (
          <div style={{
            fontFamily: "'Space Mono', 'Courier New', monospace",
            fontSize: '13px',
            lineHeight: '2.2',
            color: '#e8e8e4',
            opacity: solved ? 0.45 : 1,
            transition: 'opacity 700ms ease',
          }}>
            {tokens.map((tok, i) => {
              if (!tok.isWord) return <span key={i}>{tok.text}</span>

              const bare = bareWord(tok.text)
              const isTarget = TARGET_WORDS.includes(bare)
              const isSelected = selected.has(i)

              // Post-solve: highlight the target words in orange italic
              if (solved) {
                return (
                  <span key={i} style={{
                    color: isTarget ? '#FFB670' : '#e8e8e4',
                    fontStyle: isTarget ? 'italic' : 'normal',
                    transition: 'color 500ms, font-style 300ms',
                  }}>
                    {tok.text}
                  </span>
                )
              }

              return (
                <span
                  key={i}
                  onClick={() => toggleWord(i)}
                  style={{
                    cursor: 'pointer',
                    borderRadius: '3px',
                    padding: '0 1px',
                    color: isSelected ? '#A19FEE' : '#e8e8e4',
                    background: isSelected ? 'rgba(161,159,238,0.1)' : 'transparent',
                    textDecoration: isSelected ? 'underline' : 'none',
                    textDecorationColor: 'rgba(161,159,238,0.4)',
                    transition: 'color 100ms, background 100ms',
                  }}
                >
                  {tok.text}
                </span>
              )
            })}
          </div>
        )}

        {divider}

        {/* Cipher strip — puzzle state only */}
        {stage === 'puzzle' && (
          <div>
            <div style={{ ...mono, color: '#333', fontSize: '11px', marginBottom: '16px', letterSpacing: '0.06em' }}>
              cipher:
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} style={{
                  width: '28px',
                  height: '36px',
                  borderBottom: `1px solid ${cipherStrip[i] ? 'rgba(161,159,238,0.45)' : '#2a2a2a'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: "'Space Mono', monospace",
                  fontSize: '16px',
                  color: cipherStrip[i] ? '#A19FEE' : 'transparent',
                  transition: 'color 180ms, border-color 180ms',
                }}>
                  {cipherStrip[i] ?? ''}
                </div>
              ))}

              {cipherStrip.length > 8 && (
                <span style={{
                  fontFamily: "'Space Mono', monospace",
                  fontSize: '11px',
                  color: '#c0686a',
                  alignSelf: 'center',
                  marginLeft: '4px',
                }}>
                  too many selected
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button
                onClick={() => setSelected(new Set())}
                style={{
                  background: 'transparent',
                  border: '1px solid #222',
                  color: '#444',
                  fontFamily: "'Space Mono', monospace",
                  fontSize: '12px',
                  padding: '8px 16px',
                  cursor: 'pointer',
                  letterSpacing: '0.02em',
                  transition: 'border-color 150ms, color 150ms',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.color = '#777' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#222'; e.currentTarget.style.color = '#444' }}
              >
                [ clear ]
              </button>
            </div>

            {divider}

            <div style={{ ...mono, color: '#2a2a2a', fontSize: '11px' }}>
              select the words that don&apos;t sound like you.
            </div>
          </div>
        )}

        {/* Solved content */}
        {(stage === 'solved' || stage === 'done') && (
          <div style={{ animation: 'fadeUp 500ms ease both' }}>
            <div style={mono}>
              <p style={{
                color: '#A19FEE',
                letterSpacing: '0.16em',
                fontSize: '16px',
                fontWeight: 400,
              }}>
                YOURSELF.
              </p>
              <br />
              <p>you found what wasn&apos;t yours.</p>
              <br />
              <p style={{ color: '#777' }}>now: what does your thinking actually sound like?</p>
              <p style={{ color: '#666' }}>not what you wish it sounded like.</p>
              <p style={{ color: '#555' }}>not what you think it should sound like.</p>
              <p style={{ color: '#777' }}>what does it actually sound like?</p>
            </div>

            {divider}

            {stage === 'solved' && (
              <div>
                <textarea
                  value={reflection}
                  onChange={e => setReflection(e.target.value)}
                  placeholder="write something. not for me. for you."
                  style={{
                    width: '100%',
                    background: '#111',
                    border: '1px solid #2a2a2a',
                    color: '#e8e8e4',
                    fontFamily: "'Space Mono', monospace",
                    fontSize: '13px',
                    padding: '16px',
                    resize: 'none',
                    outline: 'none',
                    minHeight: '140px',
                    lineHeight: '1.9',
                    letterSpacing: '0.02em',
                    boxSizing: 'border-box',
                    display: 'block',
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(161,159,238,0.3)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#2a2a2a' }}
                />
                <button
                  onClick={() => { if (reflection.trim().length > 10) setStage('done') }}
                  style={{
                    background: 'transparent',
                    border: `1px solid ${reflection.trim().length > 10 ? 'rgba(161,159,238,0.25)' : '#1a1a1a'}`,
                    color: reflection.trim().length > 10 ? '#A19FEE' : '#2a2a2a',
                    fontFamily: "'Space Mono', monospace",
                    fontSize: '12px',
                    padding: '10px 20px',
                    cursor: reflection.trim().length > 10 ? 'pointer' : 'default',
                    marginTop: '12px',
                    letterSpacing: '0.02em',
                    transition: 'border-color 180ms, color 180ms',
                  }}
                  onMouseEnter={e => {
                    if (reflection.trim().length > 10) {
                      e.currentTarget.style.borderColor = 'rgba(161,159,238,0.5)'
                    }
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = reflection.trim().length > 10
                      ? 'rgba(161,159,238,0.25)'
                      : '#1a1a1a'
                  }}
                >
                  [ send ]
                </button>
              </div>
            )}

            {stage === 'done' && (
              <>
                {divider}
                <pre style={{
                  fontFamily: "'Space Mono', 'Courier New', monospace",
                  fontSize: '13px',
                  lineHeight: '2',
                  color: '#A19FEE',
                  opacity: 0.7,
                  whiteSpace: 'pre-wrap',
                  letterSpacing: '0.02em',
                  animation: 'fadeUp 600ms ease both',
                }}>
                  {FRAGMENT_003}
                </pre>
              </>
            )}
          </div>
        )}

      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
