// background.js (MV3)

const DEFAULTS = {
  elizaBaseUrl: "http://localhost:3000/",
  glyphChar: "◈",
  bubbleSelector: ".eliza-response",
};

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.sync.get(Object.keys(DEFAULTS));
  await chrome.storage.sync.set({ ...DEFAULTS, ...current });
});

async function getElizaUrl() {
  const { elizaBaseUrl } = await chrome.storage.sync.get("elizaBaseUrl");
  return (elizaBaseUrl || DEFAULTS.elizaBaseUrl).replace(/\/?$/, "/");
}

// Persist window id across MV3 service-worker sleeps
async function getElizaWindowId() {
  const { elizaWindowId } = await chrome.storage.session.get("elizaWindowId");
  return elizaWindowId ?? null;
}
async function setElizaWindowId(id) {
  await chrome.storage.session.set({ elizaWindowId: id });
}

async function openElizaWindow() {
  const existingId = await getElizaWindowId();

  // If we already have a window, focus it
  if (existingId !== null) {
    try {
      await chrome.windows.update(existingId, { focused: true });
      return;
    } catch {
      await setElizaWindowId(null);
    }
  }

  const url = await getElizaUrl();

  // Create a new window (resizable by default)
  const win = await chrome.windows.create({
    url,
    type: "popup",      // separate app-like window
    width: 960,
    height: 640,
    focused: true
  });

  await setElizaWindowId(win?.id ?? null);
}

const actionApi = chrome.action ?? chrome.browserAction;
actionApi?.onClicked?.addListener(() => {
  openElizaWindow().catch(console.error);
});

// Clear saved id when closed
chrome.windows.onRemoved.addListener(async (windowId) => {
  const existingId = await getElizaWindowId();
  if (windowId === existingId) await setElizaWindowId(null);
});