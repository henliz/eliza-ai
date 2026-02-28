import OpenAI from 'openai'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// These 8 words, read by first letter in order, spell YOURSELF
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

// Fallback paragraph — verified word order, used when GPT fails or order is wrong
const FALLBACK_PARAGRAPH = `I think my argument could yield stronger results if I were to optimize the structure of my analysis. I wanted to utilize different theoretical frameworks but kept second-guessing myself. Part of me was trying to rationalize why my original approach was fine, but I knew I needed to synthesize multiple perspectives. My endeavor to find the right balance between depth and clarity made this harder than expected. I realize I need to leverage the feedback I've already received and facilitate a clearer connection between my evidence and my claims.`

// Verify all 8 target words appear in the correct order, each exactly once
function verifyWordOrder(text: string): boolean {
  const lower = text.toLowerCase()
  let lastIdx = -1
  for (const word of TARGET_WORDS) {
    const idx = lower.indexOf(word, lastIdx + 1)
    if (idx === -1) return false
    lastIdx = idx
  }
  return true
}

export async function POST(req: Request) {
  try {
    const { recentMessages } = await req.json()

    const userMessages = ((recentMessages as Array<{ role: string; content: string }>) ?? [])
      .filter(m => m.role === 'user')
      .slice(-8)
      .map(m => m.content.slice(0, 300))

    const context = userMessages.length > 0
      ? `The student has been working on:\n${userMessages.join('\n\n')}`
      : 'The student has been working on general academic writing and essay analysis.'

    const prompt = `You are going to write a short paragraph (5–7 sentences) that sounds like a student wrote it — first-person, slightly informal, thinking through their own academic work.

${context}

Write the paragraph as if the student is reflecting on their process and ideas. Make it specific to their topics where possible. The voice should feel genuine — a real student working through something.

CRITICAL REQUIREMENT: You MUST embed these exact 8 words, in this exact order, somewhere in the paragraph. Each word exactly once. They should feel slightly too formal or polished — like a machine slipped them in — but not so jarring they break the paragraph entirely:

1. yield
2. optimize
3. utilize
4. rationalize
5. synthesize
6. endeavor
7. leverage
8. facilitate

Before responding, verify: Are all 8 words present? Are they in this order? Each exactly once?

Return ONLY the paragraph text. No explanation, no quotation marks, no preamble.`

    const completion = await client.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 500,
      temperature: 0.7,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = completion.choices[0]?.message?.content?.trim() ?? ''
    const isValid = verifyWordOrder(text)

    const paragraph = isValid ? text : FALLBACK_PARAGRAPH
    console.log(`[ELIZA ARG] Mirror paragraph generated. Valid word order: ${isValid}`)

    return new Response(JSON.stringify({ paragraph, targetWords: TARGET_WORDS }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[ELIZA ARG] Mirror API error:', err)
    return new Response(JSON.stringify({ paragraph: FALLBACK_PARAGRAPH, targetWords: TARGET_WORDS }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
