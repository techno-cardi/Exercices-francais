(() => {
  const V04_ID = 'cardinal-app-patch-v04';
  const V04_SRC = 'https://techno-cardi.github.io/Exercices-francais/resultats/app-patch-v04.js?v=4';

  function ensureV04() {
    if (document.getElementById(V04_ID) || window.__cardinalV04Installed) return;
    const script = document.createElement('script');
    script.id = V04_ID;
    script.src = V04_SRC;
    script.async = true;
    (document.head || document.documentElement).appendChild(script);
  }

  function installImmediateMozaikFeedback() {
    const btn = document.getElementById('syncMozaikBtn');
    if (!btn) {
      setTimeout(installImmediateMozaikFeedback, 80);
      return;
    }
    if (btn.dataset.cardinalImmediateV05 === '1') return;
    btn.dataset.cardinalImmediateV05 = '1';
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      window.postMessage({
        source: 'cardinal-mozaik-console',
        type: 'MOZAIK_EXTENSION_SHOW_PROGRESS'
      }, location.origin);
    }, true);
  }

  ensureV04();
  installImmediateMozaikFeedback();
})();
