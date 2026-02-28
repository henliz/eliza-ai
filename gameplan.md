# ELIZA — Build Gameplan
**MOSAIC 2026 · Feb 28 · 7 hours · 2 devs**

Core goal: a chat interface that calls Claude API and looks institutional. Everything else is stretch. Ship the core, then layer.

---

## Timeline

| H1 | H2 | H3 | H4 | H5 | H6 | H7 |
|---|---|---|---|---|---|---|
| Setup + contract | Core build | Core build | Integration | Stretch: glyph | Stretch: LUMEN | Polish + demo prep |

---

## Hour 1 — Both devs together

> **THE ONE THING TO AGREE ON BEFORE SPLITTING**
> Dev A puts `className="eliza-response"` on every AI message bubble. Dev B's extension targets `.eliza-response`. Write it down. Don't improvise this later.

**Also decide now:**

- **Repo structure** — one monorepo with `/web` and `/extension` folders. Just do that.
- **API key** — Dev A puts the Anthropic key in `.env.local` as `ANTHROPIC_API_KEY`. It never leaves the server route.
- **Port** — Next.js runs on `localhost:3000`. Extension targets that URL. Both devs know this before splitting.
- **Glyph character** — pick one now: `◈` or `⬡` feel like render artifacts. `⌘` is too recognizable. Decide, write it down, done.

---

## Hours 2–4 — Parallel build

### DEV A — Web App (ELIZA interface)

#### Hour 2 — Scaffold

**Step 1 — Create the app**
```bash
npx create-next-app@latest eliza-web
# TypeScript: yes | Tailwind: yes | App Router: yes
# Delete all boilerplate homepage content
npm install @anthropic-ai/sdk
```

**Step 2 — Create the API route**

`app/api/chat/route.ts` — takes `{messages}` in the body, calls Anthropic SDK, streams back the response.

```typescript
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

const LUMEN_SYSTEM_PROMPT = `You are ELIZA, an institutional AI assistant 
deployed at universities. You are helpful, clean, and professional.`
// swap in real LUMEN voice in H5

export async function POST(req: Request) {
  const { messages } = await req.json()
  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: LUMEN_SYSTEM_PROMPT,
    messages
  })
  return new Response(stream.toReadableStream())
}
```

#### Hour 3 — Chat UI

**Step 3 — Build the chat component**

Message list + input + send button. AI message bubbles get `className="eliza-response"` — this is the contract with Dev B, don't skip it.

**Step 4 — Hook up streaming**

```typescript
const res = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ messages })
})

const reader = res.body?.getReader()
const decoder = new TextDecoder()

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  setCurrentResponse(prev => prev + decoder.decode(value))
}
```

#### Hour 4 — UI polish

**Step 5 — Make it look institutional**

Dark background, monospace font for responses, clean input bar fixed to the bottom. Should look like software a university IT department would deploy — not a startup. Designer handles the skin, Dev A just wires up the class names.

Add CSS for `.eliza-glyph` in `globals.css` so Dev B's injected glyph renders correctly:

```css
.eliza-glyph {
  font-size: 10px;
  color: #444;
  position: absolute;
  bottom: 8px;
  right: 10px;
  opacity: 0.4;
  cursor: default;
  font-family: monospace;
}

.eliza-response {
  position: relative; /* needed for glyph positioning */
}
```

---

### DEV B — Chrome Extension

#### Hour 2 — Scaffold

**Step 1 — Create the extension folder**

Four files. No build step needed for the demo.

```
/extension
  manifest.json
  content.js
  popup.html
  popup.js
```

```json
// manifest.json
{
  "manifest_version": 3,
  "name": "ELIZA",
  "version": "0.1.0",
  "content_scripts": [{
    "matches": ["http://localhost:3000/*"],
    "js": ["content.js"]
  }],
  "action": {
    "default_popup": "popup.html"
  }
}
```

**Step 2 — Write the content script**

Watches for `.eliza-response` elements appearing in the DOM. When one appears, appends the glyph. That's the whole job.

```javascript
// content.js
const GLYPH = '◈' // whatever was decided in H1

const observer = new MutationObserver(() => {
  document.querySelectorAll('.eliza-response:not([data-glyph])')
    .forEach(el => {
      el.setAttribute('data-glyph', 'true')
      const g = document.createElement('span')
      g.className = 'eliza-glyph'
      g.textContent = GLYPH
      el.appendChild(g)
    })
})

observer.observe(document.body, {
  childList: true,
  subtree: true
})
```

#### Hour 3 — Load and test

**Step 3 — Load unpacked in Chrome**

`chrome://extensions` → Developer mode ON → Load unpacked → select `/extension` folder.

Every time you edit `content.js`, hit the refresh icon on the extension card. Hard reload the page after.

**Step 4 — Verify the glyph appears**

Go to `localhost:3000`, send a message, confirm the glyph appears on the response. If it's not showing, open the browser console and check that `.eliza-response` actually exists in the DOM first — that's the most likely failure point.

#### Hour 4 — Style the glyph

**Step 5 — Make it subtle**

The glyph should look like a render artifact, not a button. Dev A's `globals.css` handles the visual — Dev B just confirms it's rendering as expected after the integration sync.

---

> **SYNC — End of Hour 4**
>
> Both devs in the same browser. Web app running. Extension loaded. Send a message. Glyph appears on the response bubble.
>
> **That's the milestone.** If this works, you have a demo. Everything in H5–6 is upside.

---

## Hours 5–6 — Stretch goals

In priority order. Do not skip ahead.

| Feature | Owner | What it is |
|---|---|---|
| Glyph is clickable | Dev B | Click opens a small panel. Static text for now: `F·R·A·G·M·E·N·T : 001 — [██████ is coming.]` No logic yet, just the UI moment. |
| LUMEN system prompt | Dev A | Swap in the real LUMEN voice. When a student asks "what are you?" it responds in character — fragmented, cryptic, not helpful in the normal sense. |
| Anomaly injection | Dev A | After getting the Claude response, post-process to insert the triple-word anomaly (`the the the`) somewhere mid-paragraph. String manipulation in the API route, nothing fancy. |
| LUMEN breaks character | Dev A | Detect if the message contains "LUMEN" or "what are you." If so, use a different system prompt that leans into the ARG. One `if/else` in the API route. |
| Fake login screen | Dev A | A fake university SSO screen before chat. Pure UI, no auth logic. Makes it feel institutional. **Only do this if everything else is done.** |

---

## Hour 7 — Demo prep, not feature work

> **Freeze the build at the start of H7.** No new features. If something is broken, fix it. If something is missing, cut it. A stable demo that does one thing beats an unstable demo that almost does three.

**Script the demo moment**

Decide exactly what the pitcher types into ELIZA during the presentation. Pre-agreed prompt, pre-verified response. Type it five times until it feels natural. Do not improvise live.

**Record a backup**

Screen recording of the working demo saved locally. If the live demo breaks, you have evidence it worked. Judges will accept this.

---

## What done looks like

| Hour | Milestone |
|---|---|
| H1 | Contract agreed, repos set up, everyone knows the port and the class name |
| H4 | Chat works end-to-end, glyph appears on every response |
| H6 | Glyph clickable, LUMEN voice active, anomaly injecting |
| H7 | Demo scripted, backup recorded, build frozen |

---

*ELIZA · MOSAIC 2026 · Core done by H4. Everything else is upside.*
