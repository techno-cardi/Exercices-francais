(() => {
  const PAGE_SOURCE = 'cardinal-mozaik-console';
  const EXT_SOURCE = 'cardinal-mozaik-extension';
  const FORMATIVE_PAGE_SOURCE = 'cardinal-formative-console';
  const FORMATIVE_EXT_SOURCE = 'cardinal-formative-extension';
  let pendingFormativeImport = null;

  function postPendingFormativeImport() {
    if (!pendingFormativeImport) return;
    window.postMessage({ source: FORMATIVE_EXT_SOURCE, type: 'FORMATIVE_IMPORT_AVAILABLE', payload: pendingFormativeImport }, location.origin);
  }

  function announceReady() {
    window.postMessage({
      source: EXT_SOURCE,
      type: 'MOZAIK_EXTENSION_READY',
      version: chrome.runtime.getManifest().version
    }, location.origin);
    window.postMessage({
      source: FORMATIVE_EXT_SOURCE,
      type: 'FORMATIVE_EXTENSION_READY',
      version: chrome.runtime.getManifest().version
    }, location.origin);
  }

  document.addEventListener('click', event => {
    const btn = event.target instanceof Element ? event.target.closest('#syncMozaikBtn') : null;
    if (!btn || btn.disabled) return;
    chrome.runtime.sendMessage({ type: 'SHOW_MOZAIK_SYNC_UI' }).catch(() => {});
  }, true);

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
  window.addEventListener('load', () => setTimeout(postPendingFormativeImport, 250));

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === 'FORMATIVE_IMPORT_AVAILABLE') {
      pendingFormativeImport = message.payload || null;
      postPendingFormativeImport();
      setTimeout(postPendingFormativeImport, 500);
      setTimeout(postPendingFormativeImport, 1500);
      sendResponse?.({ ok: true });
    }
  });

  window.addEventListener('message', async (event) => {
    if (event.source !== window || event.origin !== location.origin) return;
    const data = event.data;
    if (!data) return;

    if (data.source === FORMATIVE_PAGE_SOURCE) {
      if (data.type === 'FORMATIVE_EXTENSION_PING') {
        announceReady();
        postPendingFormativeImport();
        return;
      }
      if (data.type !== 'FORMATIVE_EXTENSION_REQUEST') return;
      const requestId = String(data.requestId || '');
      if (!requestId) return;
      try {
        const result = await chrome.runtime.sendMessage({
          type: 'FORMATIVE_REQUEST',
          action: data.action,
          payload: data.payload || {}
        });
        window.postMessage({ source: FORMATIVE_EXT_SOURCE, type: 'FORMATIVE_EXTENSION_RESULT', requestId, result }, location.origin);
      } catch (error) {
        window.postMessage({
          source: FORMATIVE_EXT_SOURCE,
          type: 'FORMATIVE_EXTENSION_RESULT',
          requestId,
          result: { ok: false, message: error?.message || String(error) }
        }, location.origin);
      }
      return;
    }

    if (data.source !== PAGE_SOURCE) return;
    if (data.type === 'MOZAIK_EXTENSION_PING') {
      announceReady();
      return;
    }
    if (data.type === 'MOZAIK_EXTENSION_SHOW_PROGRESS') {
      try { await chrome.runtime.sendMessage({ type: 'SHOW_MOZAIK_SYNC_UI' }); } catch {}
      return;
    }
    if (data.type !== 'MOZAIK_EXTENSION_SYNC') return;
    const requestId = String(data.requestId || '');
    if (!requestId) return;
    try {
      const response = await chrome.runtime.sendMessage({ type: 'START_MOZAIK_SYNC', requestId, payload: data.payload });
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
