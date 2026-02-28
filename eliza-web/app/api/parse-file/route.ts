import { NextRequest } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), { status: 400 })
    }

    const name = file.name.toLowerCase()
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Plain text types — read directly
    if (
      name.endsWith('.txt') ||
      name.endsWith('.md') ||
      name.endsWith('.csv') ||
      name.endsWith('.rtf')
    ) {
      const text = buffer.toString('utf-8')
      return Response.json({ text })
    }

    // PDF — use unpdf
    if (name.endsWith('.pdf')) {
      const { extractText } = await import('unpdf')
      const { text } = await extractText(new Uint8Array(bytes), { mergePages: true })
      return Response.json({ text })
    }

    // Docx — read raw text (rough extraction, good enough for rubrics)
    if (name.endsWith('.docx')) {
      // Extract readable strings from docx XML (simple approach, no library needed)
      const raw = buffer.toString('utf-8')
      const text = raw
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      return Response.json({ text })
    }

    return new Response(
      JSON.stringify({ error: 'Unsupported file type. Use .txt, .pdf, .md, or .docx' }),
      { status: 415 }
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('File parse error:', msg)
    return new Response(JSON.stringify({ error: `Failed to parse file: ${msg}` }), { status: 500 })
  }
}
