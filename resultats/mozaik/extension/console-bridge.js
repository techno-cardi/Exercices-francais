(() => {
  const PAGE_SOURCE = 'cardinal-mozaik-console';
  const EXT_SOURCE = 'cardinal-mozaik-extension';

  function injectAppPatch() {
    if (document.getElementById('cardinal-app-patch-v04')) return;
    const script = document.createElement('script');
    script.id = 'cardinal-app-patch-v04';
    script.src = 'https://techno-cardi.github.io/Exercices-francais/resultats/app-patch-v04.js?v=4';
    script.async = true;
    (document.head || document.documentElement).appendChild(script);
  }

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

  injectAppPatch();
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
