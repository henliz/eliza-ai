ELIZA Chat App — Build Instructions
Stack
React (single file or component-based), CSS with custom properties, no external UI libraries. Google Font: DM Serif Display for the logo/headings + Geist (or fallback: 'DM Sans') for all UI text. Import both via Google Fonts CDN.

Design Tokens (CSS variables)
css--bg-sidebar: #F9EFF4;
--bg-main: #FAFAFA;        /* near white, slightly warm */
--bg-card: #FFFFFF;
--color-primary: #A19FEE;
--color-primary-soft: rgba(161, 159, 238, 0.15);
--color-text: #6B69A3;     /* muted purple-grey for all text */
--color-text-faint: rgba(161, 159, 238, 0.5);
--radius-sm: 12px;
--radius-md: 20px;
--radius-lg: 28px;
--shadow-card: 0 4px 24px rgba(161,159,238,0.10);
```

---

### Layout
Two-column flex layout, full viewport height:
- **Sidebar**: fixed `280px` wide, `#F9EFF4` background, `padding: 24px 16px`
- **Main area**: flex-grow 1, `#FAFAFA` background, centered content column

---

### Sidebar
**Top section:**
- App name `ELIZA` — DM Serif Display, `18px`, `--color-primary`
- Collapse toggle button (two-arrow or `[>]` icon) — top right, subtle, `--color-primary`
- `New chat` button — pill shape, full width, white background, `--shadow-card`, `--color-primary` text + edit icon left, `--radius-md`. Hover: slight lift (`translateY(-1px)`), shadow intensifies
- `Search` row — no background, just icon + label, `--color-text-faint`

**Bottom section (account card):**
- White card, `--radius-lg`, `--shadow-card`, `padding: 16px`
- Avatar circle (soft pink/lavender gradient placeholder), name + email in two lines
- Thin `1px` divider line below name/email (`--color-primary` at `20%` opacity)
- Settings gear icon + Help circle icon below, `--color-primary`, spaced `12px` apart
- Outside the card: smaller avatar + name row below it (this is the collapsed account row — just show both and let the card be a popover/expanded state, or render the card as an expanded state on hover)

---

### Main Area
Vertically and horizontally centered content:

**Headline:**
- `"How can I help you?"` — DM Serif Display, `40px`, `--color-primary`, `font-weight: 400`
- Subtle fade-in animation on mount (`opacity 0 → 1`, `translateY(8px) → 0`, `600ms ease`)

**Input bar:**
- Full-width pill, max-width `760px`
- White background, `2px` border `--color-primary` at `40%` opacity
- `--radius-lg` (fully rounded pill ends)
- `--shadow-card`
- Left: `+` icon button (attach/add), `--color-primary`
- Center: `placeholder="Ask anything"` in `--color-text-faint`, Geist font
- Right: send arrow icon button (`▷`), `--color-primary`
- Focus state: border becomes full `--color-primary`, shadow intensifies slightly
- Input font: Geist, `16px`, `--color-text`

---

### Interactions / Micro-animations
- Sidebar `New chat` button: `transition: box-shadow 200ms, transform 200ms` on hover
- Input bar: `transition: border-color 200ms, box-shadow 200ms` on focus
- Page load: staggered fade-in — headline first (`0ms` delay), input bar second (`150ms` delay)
- Avatar: soft radial gradient `from #F9EFF4 to #C8C6F7`

---

### Icons
Use **Lucide React** (`lucide-react`) — specifically: `SquarePen` (new chat), `Search`, `Settings`, `HelpCircle`, `Plus`, `SendHorizonal`

---

### Typography summary
```
Logo:      DM Serif Display, 18px, #A19FEE
Headline:  DM Serif Display, 40px, #A19FEE
UI text:   DM Sans (or Geist), 14px, #6B69A3
Input:     DM Sans (or Geist), 16px, #6B69A3