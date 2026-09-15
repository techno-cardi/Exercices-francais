importScripts('background-v093.js');

// v0.9.4 beta: Formative is truly stealth by default.
// No Formative helper is injected until the teacher explicitly invokes Cardinal.
ensureFormativeUi = async function(tabId) {
  if (!tabId) return;
  try {
    const pong = await chrome.tabs.sendMessage(tabId, { type:'CARDINAL_SIMPLE_PING' });
    if (pong?.ok) return;
  } catch {}
  try {
    await chrome.scripting.executeScript({
      target:{ tabId },
      files:['formative-simple-ui.js','formative-stealth-v093.js']
    });
  } catch {}
};
