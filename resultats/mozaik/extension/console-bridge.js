(() => {
  const PAGE_SOURCE = 'cardinal-mozaik-console';
  const EXT_SOURCE = 'cardinal-mozaik-extension';

  function announceReady() {
    window.postMessage({
      source: EXT_SOURCE,
      type: 'MOZAIK_EXTENSION_READY',
      version: chrome.runtime.getManifest().version
    }, location.origin);
  }

  announceReady();

  window.addEventListener('message', async (event) => {
    if (event.source !== window || event.origin !== location.origin) return;
    const data = event.data;
    if (!data || data.source !== PAGE_SOURCE) return;

    if (data.type === 'MOZAIK_EXTENSION_PING') {
      announceReady();
      return;
    }

    if (data.type !== 'MOZAIK_EXTENSION_SYNC') return;
    const requestId = String(data.requestId || '');
    if (!requestId) return;

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'START_MOZAIK_SYNC',
        requestId,
        payload: data.payload
      });
      window.postMessage({
        source: EXT_SOURCE,
        type: 'MOZAIK_EXTENSION_RESULT',
        requestId,
        result: response || { success: false, message: 'Aucune réponse de l’extension.' }
      }, location.origin);
    } catch (error) {
      window.postMessage({
        source: EXT_SOURCE,
        type: 'MOZAIK_EXTENSION_RESULT',
        requestId,
        result: { success: false, message: error?.message || String(error) }
      }, location.origin);
    }
  });
})();
