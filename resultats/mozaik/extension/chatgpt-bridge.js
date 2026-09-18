(() => {
  if (window.__cardinalFormativeChatGPTBridgeV1) return;
  window.__cardinalFormativeChatGPTBridgeV1 = true;

  const SENTINEL = 'CARDINAL_FORMATIVE_PACKAGE_V1';

  function parsePackage(text) {
    const raw = String(text || '').trim();
    if (!raw.startsWith(SENTINEL)) return null;
    const jsonText = raw.slice(SENTINEL.length).trim();
    if (!jsonText.startsWith('{')) return null;

    try {
      const pkg = JSON.parse(jsonText);
      if (pkg?.schema !== 'cardinal.formative/1' || !Array.isArray(pkg?.items)) return null;
      return pkg;
    } catch {
      return null;
    }
  }

  function status(button, text, kind = '') {
    button.textContent = text;
    button.dataset.state = kind;
  }

  async function sendPackage(button, pkg) {
    status(button, 'Envoi à Cardinal…', 'working');
    try {
      const result = await chrome.runtime.sendMessage({
        type: 'CARDINAL_FORMATIVE_BUILDER_CAPTURE',
        payload: pkg
      });
      if (!result?.ok) throw new Error(result?.message || 'Cardinal n’a pas accepté le paquet.');
      status(button, 'Ouvert dans Cardinal ✓', 'success');
    } catch (error) {
      status(button, `Erreur Cardinal: ${error?.message || error}`, 'error');
    }
  }

  function decorate(pre, pkg) {
    if (pre.dataset.cardinalFormativeReady === '1') return;
    pre.dataset.cardinalFormativeReady = '1';
    pre.style.position ||= 'relative';

    const bar = document.createElement('div');
    bar.style.cssText = [
      'display:flex',
      'align-items:center',
      'gap:8px',
      'padding:8px 10px',
      'margin:6px 0',
      'border:1px solid rgba(127,127,127,.35)',
      'border-radius:10px',
      'font:600 13px/1.2 system-ui,sans-serif'
    ].join(';');

    const label = document.createElement('span');
    label.textContent = `Cardinal Formative · ${pkg.items.length} élément${pkg.items.length === 1 ? '' : 's'}`;

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Réviser dans Cardinal';
    button.style.cssText = [
      'margin-left:auto',
      'padding:7px 10px',
      'border-radius:8px',
      'border:1px solid currentColor',
      'cursor:pointer',
      'font:inherit'
    ].join(';');
    button.addEventListener('click', () => sendPackage(button, pkg));

    bar.append(label, button);
    pre.parentNode?.insertBefore(bar, pre);
  }

  function scan() {
    const seen = new Set();
    for (const node of document.querySelectorAll('pre code, pre')) {
      const pre = node.closest('pre') || node;
      if (seen.has(pre)) continue;
      seen.add(pre);

      const pkg = parsePackage(node.textContent || pre.textContent || '');
      if (pkg) decorate(pre, pkg);
    }
  }

  let queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      scan();
    });
  }

  new MutationObserver(schedule).observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  scan();
})();
