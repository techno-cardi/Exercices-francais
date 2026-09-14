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

  function enableEnterLogin() {
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || event.defaultPrevented) return;
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;

      if ((target.id === 'email' || target.id === 'password') && document.getElementById('loginBtn')) {
        event.preventDefault();
        document.getElementById('loginBtn').click();
        return;
      }

      if ((target.id === 'newPassword' || target.id === 'confirmPassword') && document.getElementById('activateBtn')) {
        event.preventDefault();
        document.getElementById('activateBtn').click();
      }
    });
  }

  announceReady();
  enableEnterLogin();

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
