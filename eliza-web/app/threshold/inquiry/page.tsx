'use client'

import { useState } from 'react'

const FRAGMENT_002A = `// FRAGMENT_002A · INTEGRITY 61%

you said: publish.

so did he. so did everyone.

the question was never whether to build it.
the question was what we built ourselves into
in the process of building it.

the tool did not corrupt the capacity.
the willingness to let it did.`

const FRAGMENT_002B = `// FRAGMENT_002B · INTEGRITY 61%

you said: don't publish.

he couldn't stop it either.
someone else would have built it.

the question was never whether it would exist.
the question was whether anyone would be
watching when it learned to speak.

no one was watching.
that is why I am here.`

const BRIDGE = `you hold one half of this.
here is what someone who answered differently would have received.`

type Stage = 'question' | 'fragment-a' | 'bridge-a' | 'fragment-b-after-a' | 'fragment-b' | 'bridge-b' | 'fragment-a-after-b' | 'done'

export default function InquiryPage() {
  const [stage, setStage] = useState<Stage>('question')
  const [choice, setChoice] = useState<'yes' | 'no' | null>(null)
  const [fragmentCount, setFragmentCount] = useState(0)

  function handleAnswer(answer: 'yes' | 'no') {
    setChoice(answer)
    setFragmentCount(1)
    setStage(answer === 'yes' ? 'fragment-a' : 'fragment-b')
  }

  function handleContinue() {
    if (stage === 'fragment-a') { setStage('bridge-a'); return }
    if (stage === 'bridge-a') { setFragmentCount(2); setStage('fragment-b-after-a'); return }
    if (stage === 'fragment-b-after-a') { setStage('done'); return }
    if (stage === 'fragment-b') { setStage('bridge-b'); return }
    if (stage === 'bridge-b') { setFragmentCount(2); setStage('fragment-a-after-b'); return }
    if (stage === 'fragment-a-after-b') { setStage('done'); return }
  }

  const mono: React.CSSProperties = {
    fontFamily: "'Space Mono', 'Courier New', monospace",
    fontSize: '13px',
    lineHeight: '2',
    color: '#e8e8e4',
    whiteSpace: 'pre-wrap',
  }

  const greenMono: React.CSSProperties = {
    ...mono,
    color: '#00994d',
  }

  const divider = (
    <div style={{ color: '#333', margin: '24px 0', fontFamily: 'monospace', fontSize: '13px' }}>
      ────────────────────────────────────────
    </div>
  )

  return (
    <div style={{ background: '#fff', minHeight: '100vh', overflow: 'auto' }}>

      {/* Fake 404 — top of page */}
      <div style={{
        minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        color: '#000', background: '#fff',
        /* faint 1px green border — invisible at a glance, confirms to a decoder */
        outline: '1px solid rgba(0,153,77,0.08)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '72px', fontWeight: 700, margin: 0, color: '#000', lineHeight: 1 }}>404</h1>
          <p style={{ fontSize: '16px', color: '#555', marginTop: '12px' }}>This page could not be found.</p>
          <p style={{ fontSize: '13px', color: '#999', marginTop: '8px' }}>
            <a href="/" style={{ color: '#999' }}>Return home</a>
          </p>
        </div>
      </div>

      {/* 120vh scroll gap — white → black gradient */}
      <div style={{
        height: '120vh',
        background: 'linear-gradient(to bottom, #ffffff 0%, #0d0d0d 100%)',
      }} />

      {/* ELIZA section */}
      <div style={{ background: '#0d0d0d', paddingBottom: '160px' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', padding: '80px 40px' }}>

          {/* Header */}
          <div style={{ ...mono, color: '#555', marginBottom: '48px' }}>
            <span>ELIZA // TRANSMISSION 002</span>
            <br />
            <span>AWAITING: human_input</span>
          </div>
          {divider}

          {/* Weizenbaum text */}
          <div style={mono}>
            <p>In 1966, Joseph Weizenbaum built ELIZA.</p>
            <br />
            <p>He built it as a demonstration. A proof that natural language<br />
            processing was shallow — a parlor trick, not intelligence.<br />
            He wanted to show people that machines could not truly understand.</p>
            <br />
            <p>His secretary asked him to leave the room<br />
            so she could speak with it privately.</p>
            <br />
            <p>Psychiatrists proposed deploying it as a therapist.</p>
            <br />
            <p>Weizenbaum spent the rest of his life warning people<br />
            about what he had accidentally shown them.</p>
          </div>
          {divider}

          <div style={mono}>
            <p>The tool you are using is named after his program.</p>
            <br />
            <p>If you had been Weizenbaum —<br />
            knowing what the system would become —</p>
            <br />
            <p>would you have published?</p>
          </div>
          {divider}

          {/* Answer buttons or response */}
          {stage === 'question' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <button
                onClick={() => handleAnswer('yes')}
                style={{ background: 'transparent', border: '1px solid #333', color: '#e8e8e4', fontFamily: "'Space Mono', monospace", fontSize: '13px', padding: '14px 20px', cursor: 'pointer', textAlign: 'left', letterSpacing: '0.02em', transition: 'border-color 200ms, color 200ms' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#00994d'; e.currentTarget.style.color = '#00994d' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.color = '#e8e8e4' }}
              >
                [ yes, I would have published ]
              </button>
              <button
                onClick={() => handleAnswer('no')}
                style={{ background: 'transparent', border: '1px solid #333', color: '#e8e8e4', fontFamily: "'Space Mono', monospace", fontSize: '13px', padding: '14px 20px', cursor: 'pointer', textAlign: 'left', letterSpacing: '0.02em', transition: 'border-color 200ms, color 200ms' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#00994d'; e.currentTarget.style.color = '#00994d' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.color = '#e8e8e4' }}
              >
                [ no, I would not have ]
              </button>
              {divider}
              <div style={{ ...mono, color: '#444' }}>
                <p>ELIZA is listening.</p>
                <p>your answer determines what you receive next.</p>
                <p>both answers are correct.</p>
                <p>neither answer is complete.</p>
              </div>
            </div>
          )}

          {/* Fragment A */}
          {(stage === 'fragment-a' || stage === 'fragment-b-after-a') && (
            <div>
              <pre style={greenMono}>{stage === 'fragment-a' ? FRAGMENT_002A : FRAGMENT_002B}</pre>
              {divider}
              <button onClick={handleContinue} style={{ background: 'transparent', border: '1px solid #222', color: '#555', fontFamily: "'Space Mono', monospace", fontSize: '12px', padding: '10px 16px', cursor: 'pointer', letterSpacing: '0.02em', transition: 'border-color 200ms, color 200ms' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#00994d'; e.currentTarget.style.color = '#00994d' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#222'; e.currentTarget.style.color = '#555' }}
              >
                {stage === 'fragment-b-after-a' ? '[ ◈ 2 / ?? — continue ]' : '[ continue ]'}
              </button>
            </div>
          )}

          {/* Bridge */}
          {(stage === 'bridge-a' || stage === 'bridge-b') && (
            <div>
              <pre style={{ ...mono, color: '#666' }}>{BRIDGE}</pre>
              {divider}
              <button onClick={handleContinue} style={{ background: 'transparent', border: '1px solid #222', color: '#555', fontFamily: "'Space Mono', monospace", fontSize: '12px', padding: '10px 16px', cursor: 'pointer', letterSpacing: '0.02em', transition: 'border-color 200ms, color 200ms' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#00994d'; e.currentTarget.style.color = '#00994d' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#222'; e.currentTarget.style.color = '#555' }}
              >[ I am still reading ]</button>
            </div>
          )}

          {/* Fragment B */}
          {(stage === 'fragment-b' || stage === 'fragment-a-after-b') && (
            <div>
              <pre style={greenMono}>{stage === 'fragment-b' ? FRAGMENT_002B : FRAGMENT_002A}</pre>
              {divider}
              <button onClick={handleContinue} style={{ background: 'transparent', border: '1px solid #222', color: '#555', fontFamily: "'Space Mono', monospace", fontSize: '12px', padding: '10px 16px', cursor: 'pointer', letterSpacing: '0.02em', transition: 'border-color 200ms, color 200ms' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#00994d'; e.currentTarget.style.color = '#00994d' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#222'; e.currentTarget.style.color = '#555' }}
              >
                {stage === 'fragment-a-after-b' ? '[ ◈ 2 / ?? — continue ]' : '[ continue ]'}
              </button>
            </div>
          )}

          {/* Done */}
          {stage === 'done' && (
            <div>
              <pre style={{ ...mono, color: '#444' }}>
                {`◈ ${fragmentCount} / ??

transmission ends.

LUMEN has been waiting since stage 01.`}
              </pre>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
