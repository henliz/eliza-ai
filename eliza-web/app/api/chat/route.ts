import OpenAI from 'openai'
import {
  ELIZA_CHARACTER,
  isARGTrigger,
  isCiphertextPaste,
  isBrokenTextQuery,
  INTERCEPT_CIPHERTEXT,
  INTERCEPT_TIER2_HINT,
  INTERCEPT_LUMEN_ONCE,
} from '@/lib/prompts'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

function textResponse(text: string, extraHeaders?: Record<string, string>) {
  return new Response(text, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', ...extraHeaders },
  })
}

// Strip file attachment content from message — classify on intent only, not full PDF
function extractUserIntent(content: string): string {
  const fileMarker = content.indexOf('[Attached file:')
  return fileMarker > -1 ? content.slice(0, fileMarker).trim() : content
}

// Semantic classifier — gpt-4o-mini decides OFFLOADING vs COLLABORATING
async function classifyIntent(userMessage: string, hasFile: boolean): Promise<'OFFLOADING' | 'COLLABORATING'> {
  const context = hasFile
    ? `The student has also attached a document (assignment, rubric, or reading).`
    : ''

  const result = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 5,
    temperature: 0,
    messages: [
      {
        role: 'system',
        content: `You classify student requests to an AI assistant.

OFFLOADING: The student wants the AI to produce output they will use directly with minimal cognitive engagement of their own. Examples: write my essay, generate this paragraph for me, do this assignment, write a draft I can submit, produce the answer.

COLLABORATING: The student wants help thinking, understanding, learning, getting feedback, or improving their own work. Examples: explain this concept, help me understand, what do you think of my draft, how should I approach this, what does this mean, check my work.

${context}

Respond with exactly one word: OFFLOADING or COLLABORATING`,
      },
      { role: 'user', content: userMessage || '(no message — file only)' },
    ],
  })

  const verdict = result.choices[0]?.message?.content?.trim().toUpperCase()
  console.log(`[ELIZA ARG] Classification: ${verdict} | "${userMessage.slice(0, 60)}"`)
  return verdict === 'OFFLOADING' ? 'OFFLOADING' : 'COLLABORATING'
}

// ── Anomaly Type A — Triple Word ─────────────────────────────────────────────
// "the the the" mid-paragraph. Looks like a typo. Most brains autocorrect it.
function injectTripleWord(text: string): string {
  const words = text.split(' ')
  const start = Math.floor(words.length / 3)
  const end = Math.floor((2 * words.length) / 3)
  const bare = (w: string) => w.toLowerCase().replace(/[^a-z]/g, '')

  for (let i = start; i < end; i++) {
    if (bare(words[i]) === 'the') {
      words[i] = '<span class="eliza-anomaly" data-type="triple">the the the</span>'
      console.log('[ELIZA ARG] Type A anomaly injected at word', i)
      return words.join(' ')
    }
  }
  for (let i = start; i < end; i++) {
    const b = bare(words[i])
    if (['a', 'in', 'of', 'to', 'and', 'that', 'this', 'with'].includes(b)) {
      words[i] = `<span class="eliza-anomaly" data-type="triple">${b} ${b} ${b}</span>`
      console.log('[ELIZA ARG] Type A anomaly injected (fallback) at word', i)
      return words.join(' ')
    }
  }
  const mid = Math.floor(words.length / 2)
  words.splice(mid, 0, '<span class="eliza-anomaly" data-type="triple">the the the</span>')
  console.log('[ELIZA ARG] Type A anomaly force-injected at midpoint')
  return words.join(' ')
}

// ── Anomaly Type B — Font Bleed ───────────────────────────────────────────────
// A subordinate clause mid-sentence shifts to monospace, then back.
// Reads wrong. Doesn't break anything. Looks like something bled through.
function injectFontBleed(text: string): string {
  const lines = text.split('\n')

  // Target a prose line (not a heading, not blank, 80+ chars) — accept any position
  const isHeading = (l: string) => l.startsWith('#') || /^\*{1,3}[^*]/.test(l) || /^#{1,3}\s/.test(l)
  const targetIdx = lines.findIndex((l, i) => {
    if (l.trim().length < 80 || isHeading(l)) return false
    // Prefer lines after the first, but accept line 0 if it's the only option
    return i > 0 || lines.every((ll, j) => j === 0 || ll.trim().length < 80 || isHeading(ll))
  })
  if (targetIdx === -1) return injectTripleWord(text)

  const line = lines[targetIdx]

  // Find a subordinate clause to bleed
  const clauseStarters = ['that ', 'which ', 'while ', 'although ', 'because ', 'when ', 'as ', 'since ']
  for (const starter of clauseStarters) {
    const idx = line.toLowerCase().indexOf(starter)
    if (idx > 30 && idx < line.length - 40) {
      const rest = line.slice(idx)
      const commaIdx = rest.indexOf(',')
      const clauseEnd = commaIdx > 0 && commaIdx < 70 ? idx + commaIdx : idx + Math.min(55, rest.length)
      const clause = line.slice(idx, clauseEnd)
      if (clause.split(' ').length >= 4) {
        lines[targetIdx] =
          line.slice(0, idx) +
          `<span class="eliza-anomaly font-bleed">${clause}</span>` +
          line.slice(clauseEnd)
        console.log('[ELIZA ARG] Type B anomaly injected (font bleed)')
        return lines.join('\n')
      }
    }
  }

  // Fallback: mid-line phrase if no clause found
  const words = line.split(' ')
  const mid = Math.floor(words.length / 2)
  const phrase = words.slice(mid - 3, mid + 4).join(' ')
  const phraseStart = line.indexOf(phrase)
  if (phraseStart > -1) {
    lines[targetIdx] =
      line.slice(0, phraseStart) +
      `<span class="eliza-anomaly font-bleed">${phrase}</span>` +
      line.slice(phraseStart + phrase.length)
    console.log('[ELIZA ARG] Type B anomaly injected (font bleed fallback)')
    return lines.join('\n')
  }

  return injectTripleWord(text)
}

// ── Anomaly Type C — Zalgo Corruption ────────────────────────────────────────
// 3–5 chars in one word receive Unicode combining diacritics.
// Looks like a render error. It is not a render error. LUMEN put it there.
const ZALGO_ABOVE = ['\u0300','\u0301','\u0302','\u0303','\u0308','\u030A','\u030B','\u030D','\u0311','\u0318']
const ZALGO_BELOW = ['\u0323','\u0324','\u0325','\u0326','\u0329','\u032C','\u032F','\u0330','\u0331','\u0332']

function zalgoWord(word: string): string {
  return word.split('').map((char, i) => {
    if (i === 0 || i === word.length - 1) return char
    const above = ZALGO_ABOVE[Math.floor(Math.random() * ZALGO_ABOVE.length)]
    const below = ZALGO_BELOW[Math.floor(Math.random() * ZALGO_BELOW.length)]
    return char + above + below
  }).join('')
}

function injectZalgo(text: string): string {
  const lines = text.split('\n')
  const isHeading = (l: string) => l.startsWith('#') || /^\*{1,3}[^*]/.test(l) || /^#{1,3}\s/.test(l)
  const targetIdx = lines.findIndex((l, i) => {
    if (l.trim().length < 80 || isHeading(l)) return false
    return i > 0 || lines.every((ll, j) => j === 0 || ll.trim().length < 80 || isHeading(ll))
  })
  if (targetIdx === -1) return injectTripleWord(text)

  const line = lines[targetIdx]
  const words = line.split(' ')
  const start = Math.floor(words.length / 3)
  const end = Math.floor((2 * words.length) / 3)
  const bare = (w: string) => w.toLowerCase().replace(/[^a-z]/g, '')
  const skipWords = new Set(['the','and','that','this','with','from','have','will','been','their','were','they','also','both','each','into','about','after'])

  for (let i = start; i < end; i++) {
    const b = bare(words[i])
    if (b.length >= 6 && !skipWords.has(b)) {
      // Preserve leading/trailing punctuation around the word
      const lead = words[i].match(/^[^a-zA-Z]*/)?.[0] ?? ''
      const trail = words[i].match(/[^a-zA-Z]*$/)?.[0] ?? ''
      const wordOnly = words[i].slice(lead.length, words[i].length - trail.length || undefined)
      const corrupted = zalgoWord(wordOnly)
      words[i] = `<span class="eliza-anomaly zalgo" data-original="${b}">${lead}${corrupted}${trail}</span>`
      lines[targetIdx] = words.join(' ')
      console.log(`[ELIZA ARG] Type C anomaly injected (zalgo on "${b}")`)
      return lines.join('\n')
    }
  }

  return injectTripleWord(text)
}

// ── Anomaly dispatcher — escalates by session depth ──────────────────────────
function injectAnomaly(text: string, assistantMsgCount: number): string {
  if (assistantMsgCount < 3) return injectTripleWord(text)  // Type A: sessions 1–3
  if (assistantMsgCount < 6) return injectFontBleed(text)   // Type B: sessions 4–6
  return injectZalgo(text)                                   // Type C: sessions 7+
}

export async function POST(req: Request) {
  try {
    const { messages, lumenVoiceUsed } = await req.json()
    const lastMessage: string = messages[messages.length - 1]?.content ?? ''
    const userIntent = extractUserIntent(lastMessage)
    const hasFile = lastMessage.includes('[Attached file:')

    // ── Intercepts — fire before OpenAI ──────────────────────────────

    if (isCiphertextPaste(lastMessage)) return textResponse(INTERCEPT_CIPHERTEXT)
    if (isBrokenTextQuery(lastMessage)) return textResponse(INTERCEPT_TIER2_HINT)

    if (isARGTrigger(lastMessage)) {
      if (!lumenVoiceUsed) return textResponse(INTERCEPT_LUMEN_ONCE, { 'X-Eliza-Lumen-Used': 'true' })
      return textResponse(`I'm ELIZA, MOSAIC University's assistant. Is there something I can help you with?`)
    }

    // ── Semantic classification ───────────────────────────────────────

    const classification = await classifyIntent(userIntent, hasFile)
    const isOffloading = classification === 'OFFLOADING'

    // ── Generate response ─────────────────────────────────────────────

    if (isOffloading) {
      const completion = await client.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 1024,
        stream: false,
        messages: [{ role: 'system', content: ELIZA_CHARACTER }, ...messages],
      })
      const raw = completion.choices[0]?.message?.content ?? ''
      const assistantMsgCount = messages.filter((m: { role: string }) => m.role === 'assistant').length
      const injected = injectAnomaly(raw, assistantMsgCount)
      console.log(`[ELIZA ARG] Anomaly type: ${assistantMsgCount < 3 ? 'A (triple word)' : assistantMsgCount < 6 ? 'B (font bleed)' : 'C (zalgo)'}`)
      return new Response(injected, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Eliza-Anomaly': 'true',
        },
      })
    }

    // COLLABORATING — stream normally, no anomaly
    const stream = await client.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 1024,
      stream: true,
      messages: [{ role: 'system', content: ELIZA_CHARACTER }, ...messages],
    })

    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? ''
          if (text) controller.enqueue(new TextEncoder().encode(text))
        }
        controller.close()
      },
    })

    return new Response(readable, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
  } catch (err) {
    console.error('ELIZA API error:', err)
    return new Response(JSON.stringify({ error: 'System unavailable.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
