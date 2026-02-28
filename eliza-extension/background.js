const DEFAULTS = {
  elizaBaseUrl: "http://localhost:3000/",
  glyphChar: "◈",
  bubbleSelector: ".eliza-response"
};

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.sync.get(Object.keys(DEFAULTS));
  const next = { ...DEFAULTS, ...current };
  await chrome.storage.sync.set(next);
});