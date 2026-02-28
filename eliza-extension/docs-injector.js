// docs-injector.js — runs inside Google Docs tabs
// Receives anomaly text from background and pastes it into the open document.

console.log('[ELIZA] docs-injector.js loaded');

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== 'typeInDoc') return;
  console.log('[ELIZA] docs-injector received text, injecting into doc');
  injectText(msg.text);
});

function injectText(text) {
  // Google Docs captures paste events on the document and routes them into
  // the editor. Dispatching a ClipboardEvent with a DataTransfer payload
  // is the most reliable way to insert text programmatically.
  const dt = new DataTransfer();
  dt.setData('text/plain', text);

  const pasteEvent = new ClipboardEvent('paste', {
    clipboardData: dt,
    bubbles: true,
    cancelable: true,
  });

  // Focus the editor container first so Google Docs routes the paste correctly
  const editor = document.querySelector('.kix-appview-editor');
  if (editor) editor.focus();

  document.dispatchEvent(pasteEvent);
  console.log('[ELIZA] paste event dispatched');
}
