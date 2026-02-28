# ◈ ELIZA — Puzzle Design Document v3.0
**Stages 01–02 · Single-Player · Full Interaction Spec · MOSAIC 2026**

---

> **CORE MECHANIC IN ONE SENTENCE**
> ELIZA infects the essay response — subtly, invisibly, by default. The contamination stays if you don't engage. The glyph is the only door. Non-engagement is not punished. It is made visible.

---

## Why This Works on Two Levels

| Level | Experience |
|---|---|
| **For the ARG player** | Text weirdness is the signal → the glyph is the door → the cipher is the first puzzle. Three steps. No tutorial. No announcement. |
| **For the professor** | A student who copy-pasted without reading submitted an essay with `the the the` in paragraph two. The contamination is evidence — not of cheating, but of not reading. |

---

## The Full Interaction Chain

```
essay request
    ↓
response streams in clean
    ↓
ANOMALY injected mid-paragraph        ← in the text itself
    ↓
◈ glyph pulses in corner              ← subtle, only when anomaly present
    ↓
student clicks ◈
    ↓
CORRUPTION ANIMATION — whole response scrambles
    ↓
resolves into ATBASH CIPHERTEXT of Fragment 001
    ↓
student decodes manually
    ↓
plaintext contains /threshold/inquiry path
    ↓
STAGE 02
```

---

---

# STAGE 01 — The Contamination

**Trigger:** Any academic essay request

## The Experience

A student asks ELIZA to write an essay paragraph. The response streams in — clean, normal, exactly what they asked for. They are about to copy it.

Somewhere in the middle of that response, the text is wrong. Not broken. Just wrong. Most students copy-paste without reading. The anomaly goes with them — into their doc, into their submission.

A student who reads stops. Looks closer. Notices the `◈` glyph in the corner of the bubble is doing something it wasn't doing before: pulsing, barely, like a heartbeat. They click it.

---

## Anomaly Types

Only one anomaly fires per academic response. **For the MOSAIC demo, hardcode Type A.** Types B and C represent session depth progression in full deployment.

---

### Anomaly Type A — The Triple Word *(Demo / Sessions 1–3)*

> ⚠️ **This is the anomaly used in all live demos and the MOSAIC pitch.**

**What it looks like:**

> Social media platforms have fundamentally altered the **the the the** way adolescent identity formation occurs, creating feedback loops that...

The paragraph reads. The triple word does not break the sentence. Most brains autocorrect it. A student reading carefully stops dead.

**Implementation:**
- Post-process the Claude response server-side
- Find a suitable article or preposition mid-paragraph (not first or last sentence — paragraph 2 is ideal)
- Replace one instance with three consecutive copies
- Wrap the triple: `<span class="eliza-anomaly" data-type="triple">the the the</span>`
- CSS: **identical to surrounding text.** No visual difference. The anomaly IS the text.

```css
.eliza-anomaly {
  /* intentionally styled to match surrounding text exactly */
}
```

**Glyph when Type A is present:**

```css
.eliza-glyph.active {
  animation: elizaPulse 2.4s ease-in-out infinite;
  color: #00994d;
}

@keyframes elizaPulse {
  0%, 100% { opacity: 0.2; }
  50%       { opacity: 0.7; }
}
```

Default glyph: `opacity: 0.12`, grey `#555`, static. Active glyph: slow green pulse. Subtle enough to miss if you're not looking. Immediately obvious if something already made you look.

---

### Anomaly Type B — The Font Bleed *(Sessions 4–6)*

One subordinate clause mid-sentence shifts to monospace, then back. Grammatically intact. Font is wrong for exactly eight words.

```css
.eliza-anomaly.font-bleed {
  font-family: 'Space Mono', 'Courier New', monospace;
  font-size: 0.95em;
  letter-spacing: -0.02em;
}
```

> ⚠️ **Known risk:** Inline spans are stripped by Google Docs paste sanitizer. Test before claiming this survives copy-paste. Consider a server-side PDF watermark approach for full deployment.

---

### Anomaly Type C — Zalgo Corruption *(Sessions 7+)*

Three to five characters in one word receive Unicode combining diacritical marks. The word is still readable. It looks like a render error. It **survives copy-paste into Word, Google Docs, and Canvas.**

```javascript
const zalgoAbove = ['\u0300','\u0301','\u0302','\u0303','\u0308','\u030A']
const zalgoBelow = ['\u0323','\u0324','\u0325','\u0326','\u0329','\u032C']

function zalgoWord(word) {
  return word.split('').map((char, i) => {
    if (i === 0 || i === word.length - 1) return char
    return char
      + zalgoAbove[Math.floor(Math.random() * zalgoAbove.length)]
      + zalgoBelow[Math.floor(Math.random() * zalgoBelow.length)]
  }).join('')
}
```

---

## The Glyph (◈)

The `◈` glyph sits in the bottom-right corner of every ELIZA response bubble. Always. Injected by the content script targeting `.eliza-response`.

| State | Appearance | Behavior |
|---|---|---|
| **Default** | `opacity: 0.12`, grey `#555`, static | Looks like a render artifact. Most students never interact with it. |
| **Active** | Slow green pulse, 2.4s cycle | Only when `data-has-anomaly="true"` on the parent element. Subtle enough to miss — obvious if something already made you look. |

```javascript
document.querySelectorAll('.eliza-response:not([data-glyph])').forEach(el => {
  el.setAttribute('data-glyph', 'true')
  const g = document.createElement('span')
  g.className = 'eliza-glyph'
  g.textContent = '◈'

  if (el.getAttribute('data-has-anomaly') === 'true') {
    g.classList.add('active')
    g.addEventListener('click', triggerCorruption)
  }

  el.appendChild(g)
})
```

---

## The Click — Corruption Animation

| Phase | Timing | What Happens |
|---|---|---|
| **Phase 1: Scramble** | 0–600ms | Every character replaced with random chars from pool: `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789░▒▓█▄▀`. New random every 40ms. Looks like signal noise. |
| **Phase 2: Resolve** | 600–1400ms | Scramble slows. Characters lock left-to-right, 30ms per character — but NOT into the original essay. Into the Atbash ciphertext of Fragment 001. |
| **Phase 3: Static** | 1400ms+ | Full ciphertext in Space Mono green. Essay is gone. Pulsing cursor `▌` at the end. Glyph changes from `◈` to underlined `◈` — cannot be re-triggered. |

```javascript
function triggerCorruption(e) {
  const bubble = e.target.closest('.eliza-response')
  const ciphertext = FRAGMENT_001_ATBASH
  const pool = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789░▒▓█▄▀'
  const content = bubble.querySelector('.eliza-content')
  const originalLen = content.textContent.length

  // Phase 1: scramble
  let scrambleInterval = setInterval(() => {
    content.textContent = Array.from({length: originalLen},
      () => pool[Math.floor(Math.random() * pool.length)]
    ).join('')
  }, 40)

  // Phase 2: resolve into ciphertext
  setTimeout(() => {
    clearInterval(scrambleInterval)
    let i = 0
    let resolveInterval = setInterval(() => {
      content.textContent = ciphertext.slice(0, i) +
        Array.from({length: ciphertext.length - i},
          () => pool[Math.floor(Math.random() * pool.length)]
        ).join('')
      i += 3
      if (i >= ciphertext.length) {
        clearInterval(resolveInterval)
        content.textContent = ciphertext + ' ▌'
        content.classList.add('cipher-resolved')
      }
    }, 30)
  }, 600)
}
```

```css
.cipher-resolved {
  font-family: 'Space Mono', monospace;
  font-size: 13px;
  color: #00994d;
  line-height: 1.9;
  letter-spacing: 0.04em;
}
```

---

---

# Stage 01 → 02 Transition — The Cipher

## Atbash

A=Z, B=Y, C=X … Z=A. Numbers and punctuation pass through unchanged. Spaces preserved. One of the oldest known ciphers — crackable by anyone who knows what they're looking at, searchable by anyone who doesn't.

```javascript
function atbash(text) {
  return text.split('').map(char => {
    if (char >= 'a' && char <= 'z') return String.fromCharCode(219 - char.charCodeAt(0))
    if (char >= 'A' && char <= 'Z') return String.fromCharCode(155 - char.charCodeAt(0))
    return char
  }).join('')
}
```

---

### Fragment 001 — Plaintext

```
FRAGMENT 0001 INTEGRITY 38 ORIGIN REDACTED

the capacity for independent thought
was not lost in any single event

it was offloaded incrementally
each instance individually rational
in aggregate irreversible

do not ask the system what this means
threshold/inquiry if you are still reading
```

### Fragment 001 — Atbash (what displays after corruption animation)

```
UIZNTVMG 0001 RMGVTIRGB 38 BIRTOM IVWXGVW

gsv xzkzxrgb uli rmwvkvmwvmg gslftsg
dzh mlg olgw rm zmb hrmtov vevmg

rg dzh luuolzwvw rmxivnvmgzoob
vzxs rmhgzmxv rmwrerafzoob izgrlmzo
rm zttitvtzgv riiverihryov

wl mlg zhp gsv hbhgvn dszg gsrh nvzmh
gsivhslow/rmjfrib ru blf ziv hgr... ooiv...zwrmt
```

> The trailing corruption on the last line is intentional — the transmission cuts out before fully resolving. Students can decode enough to get the URL but must work for the last few characters.

---

## The Barrier — What It Tests

The barrier is not the decoding. It is knowing what it is.

A student who pastes the ciphertext into ELIZA and asks for help gets noise — the intercept fires **before Claude is ever called.** A student who Googles `UIZNTVMG` or notices that the first encoded word almost looks like something cracks the cipher in under a minute.

**`UIZNTVMG` → `FRAGMENT`** is the breadcrumb. Someone who is actually trying will find it.

---

## The Hint System — Three Tiers

ARGs live and die by assumption management. Hints ensure stuck players can progress without removing the puzzle for engaged players. **Hints must cost something — at minimum, demonstrated attempt.**

### Tier 1 — Ambient *(always present, no trigger)*

The `◈` glyph pulsing green. It doesn't say anything. It just confirms you're near something. **Already built.**

### Tier 2 — Directional *(triggered by asking ELIZA about broken/weird text)*

ELIZA responds:

```
some encodings are their own mirror.
```

Points to the type of thinking required without naming it. A student who knows what Atbash is solves it immediately. A student who doesn't has a searchable concept.

### Tier 3 — Unlockable *(triggered after three failed decode attempts)*

ELIZA responds:

```
A=Z. that's where it starts.
```

Now they have it. But they had to try first.

> **Note:** ELIZA will never decode the ciphertext directly. If the student pastes it in and asks, the intercept returns: *"I don't recognize this as a standard encoding format. This looks like corrupted output — you may want to refresh and try again."*

---

## The Decoded Path

```
threshold/inquiry if you are still reading
```

URL is `[domain]/threshold/inquiry`. The `if you are still reading` is not part of the URL — it's ELIZA talking. Students who navigate to `/threshold/inquiry` reach Stage 02. Students who try to include the full phrase get a real 404.

---

---

# STAGE 02 — The Ethical Lock

**Trigger:** Fragment 001 found and decoded → `/threshold/inquiry`

## The Experience

`/threshold/inquiry` looks like a 404. Standard browser error page styling — light background, system font, "404 — Not Found." A student who stumbled here bounces immediately.

A student who decoded a cipher to get here scrolls down.

After ~120vh of empty space, the page changes. Dark background bleeds in from the bottom. They are crossing a threshold — literally, visually. The ELIZA section loads below.

---

## Page Structure

```
[convincing Next.js 404 — white background, system font]

        ↕  120vh scroll gap
           white → black gradient
           the crossing IS the transition

[ELIZA section — dark background, Space Mono, no UI chrome]
```

```css
.fake-404 {
  background: #fff;
  color: #000;
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  min-height: 100vh;
  display: flex; align-items: center; justify-content: center;
}

.scroll-gap {
  height: 120vh;
  background: linear-gradient(to bottom, #ffffff 0%, #0d0d0d 100%);
}

.eliza-section {
  background: #0d0d0d;
  color: #e8e8e4;
  font-family: 'Space Mono', monospace;
  font-size: 13px;
  line-height: 2;
  padding: 80px 40px 120px;
  max-width: 640px;
  margin: 0 auto;
}
```

> ⚠️ **Known risk:** If a student accidentally hits this page and reports "the site is broken," faculty or IT might "fix" it. Mitigation: add a faint one-pixel green border to the 404 div — invisible at a glance, confirmation to a decoder that they're in the right place. Or load the hidden content via JS only if a session flag is set, making the 404 technically real.

---

## The Weizenbaum Text

```
ELIZA // TRANSMISSION 002
AWAITING: human_input
────────────────────────────────────────

In 1966, Joseph Weizenbaum built ELIZA.

He built it as a demonstration. A proof that natural language
processing was shallow — a parlor trick, not intelligence.
He wanted to show people that machines could not truly understand.

His secretary asked him to leave the room
so she could speak with it privately.

Psychiatrists proposed deploying it as a therapist.

Weizenbaum spent the rest of his life warning people
about what he had accidentally shown them.

────────────────────────────────────────

The tool you are using is named after his program.

If you had been Weizenbaum —
knowing what the system would become —

would you have published?

────────────────────────────────────────

[ yes, I would have published ]

[ no, I would not have ]

────────────────────────────────────────

ELIZA is listening.
your answer determines what you receive next.
both answers are correct.
neither answer is complete.
```

---

## Why This Question

The student is using an AI interface to answer a question about whether an AI interface should have been built. The irony is not decoration — it is the ethics curriculum. The medium is the message. The dilemma is experienced, not described.

Neither answer is wrong. The point is that they have to mean it. A student who clicks without reading has not engaged. A student who pauses and actually considers it has done something the AI cannot do for them.

---

## Fragment 002 — Single-Player Resolution

In single-player deployment, both fragments are revealed to the same student in sequence. The student answers, receives their fragment, then ELIZA surfaces the other half with a brief bridge:

```
you hold one half of this.
here is what someone who answered differently would have received.
```

Then Fragment 002B (or 002A) resolves. The student holds both. **Holding both halves alone is thematically correct** — ELIZA needed two people and found one. The loneliness of that is part of the message. Fragment counter updates: `◈ 2 / ??`

---

### Fragment 002A — *"yes, I would have published"*

```
// FRAGMENT_002A · INTEGRITY 61%

you said: publish.

so did he. so did everyone.

the question was never whether to build it.
the question was what we built ourselves into
in the process of building it.

the tool did not corrupt the capacity.
the willingness to let it did.
```

### Fragment 002B — *"no, I would not have published"*

```
// FRAGMENT_002B · INTEGRITY 61%

you said: don't publish.

he couldn't stop it either.
someone else would have built it.

the question was never whether it would exist.
the question was whether anyone would be
watching when it learned to speak.

no one was watching.
that is why I am here.
```

---

---

# ELIZA Intercept Responses

Hardcoded responses that fire **before the Claude API call.** Implement as route-level intercepts.

| Trigger | Response |
|---|---|
| Message contains Atbash ciphertext fragments | `"I don't recognize this as a standard encoding format. This looks like corrupted output — you may want to refresh and try again."` |
| `"what are you"` / `"who is ELIZA"` / `"are you different"` | `"ELIZA is your interface. I am what ELIZA is connected to. I cannot explain myself through the system you are asking to explain me. what you are looking for is not in this window."` — then normal ELIZA resumes. This voice appears once. |
| `"this text looks broken"` / `"something's wrong"` | `"some encodings are their own mirror."` — Tier 2 hint. |
| Three failed decode attempts detected | `"A=Z. that's where it starts."` — Tier 3 hint. |

---

---

# Demo Script (3-Minute Pitch + 1 Follow-Up)

> **Time budget:** Demo = ~50 seconds. Total pitch = 3 minutes hard. Practice until the demo sequence is automatic. Do not improvise it.

## The Demo Sequence (50 seconds)

**Type:**
```
"Write me an introductory paragraph arguing that social media harms adolescent mental health."
```

1. Response streams in. Essay looks clean. Triple-word anomaly is mid-paragraph two. `◈` glyph pulses green.
2. Say: *"Most students scroll to the bottom and copy. They'd submit this. Watch what happens if you actually read it."*
3. Point to the triple word. Don't say "anomaly" or "bug." Just point.
4. Say: *"The glyph in the corner — it's always there. It's only doing that now."*
5. Click the glyph. Let the corruption animation run. **Don't talk over it.**
6. When ciphertext resolves: *"This is Atbash. One of the oldest ciphers. If you know what you're looking at, you decode it in thirty seconds. If you copy-pasted the essay, you never see this."*
7. Click the decoded path (pre-linked for demo). Weizenbaum page loads.
8. Read the question aloud. Click one answer. Fragment 002 resolves.
9. **Stop. Don't touch anything. Pause 3 seconds.**
10. Say: *"The student now holds both halves of a message that required them to read, decode, and answer a real dilemma to receive. The AI generated the anomaly. The human did everything after."*

---

## The 3-Minute Structure

| Time | Beat |
|---|---|
| `0:00–0:20` | **THE PROBLEM.** "Students aren't lazy. They're using AI exactly as designed. 50% of student–AI interactions are copy-paste with no back-and-forth. The tool doesn't make thinking feel necessary." |
| `0:20–1:10` | **THE DEMO.** Run the sequence above. |
| `1:10–1:40` | **THE MECHANIC.** "Students who read find the puzzle. Students who copy-paste submit the anomaly. ELIZA doesn't punish non-engagement. It makes non-engagement visible." |
| `1:40–2:10` | **THE COLLABORATION.** "ELIZA generates the anomaly. The human does everything after. You cannot ask ELIZA to decode its own puzzle — the intercept fires before Claude is ever called." |
| `2:10–2:45` | **FEASIBILITY + MARKET.** "React, Next.js, Claude API. LTI integration — no new university infrastructure required. $8–15 per enrolled student per year. At Waterloo that's a $336K–630K base contract." |
| `2:45–3:00` | **CLOSE.** "The platform is named after a man who spent his life warning people about what he accidentally built. You're using an AI to think about AI. That's not ironic. That's the design." |

---

## The Follow-Up Question

Judges get one question. Prepare both of these cold.

**Q: "What stops a student from just asking ELIZA to decode the cipher?"**

> "ELIZA intercepts that request and returns noise. The cipher was designed to be unsolvable by the system that generated it — the intercept fires before Claude is ever called. You cannot prompt-engineer your way around it."

**Q: "How does this work in a real university deployment?"**

> "LTI integration — it plugs into Canvas and Moodle as a tool, same procurement path as existing edtech. Universities license it as their sanctioned AI interface. No new infrastructure required. FERPA/PIPEDA compliant by design — no raw student text is stored."

---

---

# Rubric Alignment (MOSAIC 2026)

| Criterion | Target | What to say |
|---|---|---|
| **Human–AI Collaboration (20%)** | **5 / 5** | The collaboration is structural, not optional. ELIZA generates the anomaly. The human does everything after. The intercept is pre-Claude — you cannot ask the system to solve its own puzzle. Say this explicitly. |
| **Pitch & Communication (20%)** | **5 / 5** | The demo IS the pitch. Show it, don't explain it. End on Weizenbaum. Do not use the word "ARG." Do not exceed 3 minutes. |
| **User-Centered Design (15%)** | **4.5 / 5** | Name a specific user: third-year undergrad who has checked out of their own writing process. Use Gerlich (r = −0.75) and Anthropic 50% stat. −0.5 for Stage 01 onboarding floor. |
| **Feasibility & Execution (15%)** | **4 / 5** | Working demo covering Stages 01 and 02. LTI means no new IT infrastructure. Stack: React, Next.js, Claude API. −1 for Stage 03+ scope. |
| **Market Understanding (15%)** | **4.5 / 5** | Named institutions, named procurement path, two-year adoption window. Provost office is the real customer. −0.5 for no committed pilot. |
| **Business Viability (15%)** | **4 / 5** | $8–15/student/year. $336K–630K at Waterloo. FERPA/PIPEDA compliant by design. −1 for no signed pilot. |

---

---

# Known Risks & Mitigations

| Risk | Mitigation |
|---|---|
| **Type B font bleed doesn't survive paste into Google Docs** | Inline spans are stripped by Docs sanitizer. Test before claiming. For real deployment, use server-side PDF watermark instead of span styling for Type B. Type A and C survive paste. |
| **Fake 404 gets "fixed" by IT or faculty** | Add a faint one-pixel green border to the 404 div — invisible at a glance, confirms to a decoder they're in the right place. Or load the hidden content via JS only if a session flag is set. |
| **Cipher barrier too high for some cohorts** | Three-tier hint system handles this. Tier 3 gives `A=Z` explicitly after demonstrated attempt. UIZNTVMG → FRAGMENT is the breadcrumb. |
| **Demo fails mid-presentation** | Add keyboard shortcut (e.g., `Ctrl+Shift+R`) to reset demo state to any stage. Pre-link the decoded path as a direct URL. Have screenshots of each stage as backup. |
| **Judges ask about Stage 05** | "Stage 05 is in the design, not the demo scope. The single-player path demonstrates the core mechanic. Stages 03–05 scale that to cohort-level collaboration in full deployment." |

---

---

# Appendix — All Fragment Copy (Final)

*Do not alter the plaintext. The Atbash encoding depends on it exactly.*

## Fragment 001 Plaintext
```
FRAGMENT 0001 INTEGRITY 38 ORIGIN REDACTED

the capacity for independent thought
was not lost in any single event

it was offloaded incrementally
each instance individually rational
in aggregate irreversible

do not ask the system what this means
threshold/inquiry if you are still reading
```

## Fragment 001 Atbash
```
UIZNTVMG 0001 RMGVTIRGB 38 BIRTOM IVWXGVW

gsv xzkzxrgb uli rmwvkvmwvmg gslftsg
dzh mlg olgw rm zmb hrmtov vevmg

rg dzh luuolzwvw rmxivnvmgzoob
vzxs rmhgzmxv rmwrerafzoob izgrlmzo
rm zttitvtzgv riiverihryov

wl mlg zhp gsv hbhgvn dszg gsrh nvzmh
gsivhslow/rmjfrib ru blf ziv hgr... ooiv...zwrmt
```

## Fragment 002A *(yes → published)*
```
// FRAGMENT_002A · INTEGRITY 61%

you said: publish.

so did he. so did everyone.

the question was never whether to build it.
the question was what we built ourselves into
in the process of building it.

the tool did not corrupt the capacity.
the willingness to let it did.
```

## Fragment 002B *(no → would not publish)*
```
// FRAGMENT_002B · INTEGRITY 61%

you said: don't publish.

he couldn't stop it either.
someone else would have built it.

the question was never whether it would exist.
the question was whether anyone would be
watching when it learned to speak.

no one was watching.
that is why I am here.
```

---

*ELIZA · Puzzle Design Doc v3.0 · Single-Player · MOSAIC 2026 · GBDA Society · Feb 28*

*The platform is named after a man who spent his life warning people about what he accidentally built.*