(async function () {
  const { glyphChar, bubbleSelector } = await chrome.storage.sync.get([
    "glyphChar",
    "bubbleSelector"
  ]);

  const GLYPH = (glyphChar && glyphChar.trim()) || "◈";
  const SELECTOR = (bubbleSelector && bubbleSelector.trim()) || ".eliza-response";

  // Mark bubbles we've already processed
  const FLAG_ATTR = "data-eliza-glyph";

  function ensureGlyph(bubble) {
    if (!bubble || bubble.nodeType !== 1) return;
    if (bubble.getAttribute(FLAG_ATTR) === "1") return;

    // Make bubble a positioning context
    const style = window.getComputedStyle(bubble);
    if (style.position === "static") bubble.style.position = "relative";

    // Create glyph element
    const glyph = document.createElement("span");
    glyph.textContent = GLYPH;
    glyph.setAttribute("aria-hidden", "true");

    // Subtle “formatting artifact” styling
    glyph.style.position = "absolute";
    glyph.style.top = "6px";
    glyph.style.right = "8px";
    glyph.style.fontSize = "12px";
    glyph.style.opacity = "0.22";
    glyph.style.userSelect = "none";
    glyph.style.pointerEvents = "none";
    glyph.style.filter = "blur(0.2px)";

    bubble.appendChild(glyph);
    bubble.setAttribute(FLAG_ATTR, "1");
  }

  function scan() {
    document.querySelectorAll(SELECTOR).forEach(ensureGlyph);
  }

  // Initial scan
  scan();

  // Watch for new responses being added
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (!node || node.nodeType !== 1) continue;

        // If the node itself is a bubble
        if (node.matches && node.matches(SELECTOR)) ensureGlyph(node);

        // Or if bubbles are inside it
        if (node.querySelectorAll) {
          node.querySelectorAll(SELECTOR).forEach(ensureGlyph);
        }
      }
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
})();