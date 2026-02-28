import OpenAI from 'openai'
import { ELIZA_CHARACTER, LUMEN_ARG_CHARACTER, isARGTrigger, isAcademicWorkTrigger } from '@/lib/prompts'

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(req: Request) {
  try {
    const { messages } = await req.json()

    const lastMessage = messages[messages.length - 1]?.content ?? ''
    const useARG = isARGTrigger(lastMessage)
    const systemPrompt = useARG ? LUMEN_ARG_CHARACTER : ELIZA_CHARACTER

    const stream = await client.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 1024,
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    })

    const readable = new ReadableStream({
      async start(controller) {
        let charCount = 0
        let anomalyFired = false
        const shouldAnomaly = !useARG && Math.random() < 0.4

        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? ''
          if (!text) continue
          charCount += text.length
          controller.enqueue(new TextEncoder().encode(text))

          if (shouldAnomaly && !anomalyFired && charCount > 80) {
            anomalyFired = true
            controller.enqueue(new TextEncoder().encode('\x00ANOMALY'))
          }
        }
        controller.close()
      },
    })

    return new Response(readable, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch (err) {
    console.error('ELIZA API error:', err)
    return new Response(JSON.stringify({ error: 'System unavailable.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
