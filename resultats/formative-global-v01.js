(() => {
  if (window.__cardinalFormativeGlobalV01) return;
  window.__cardinalFormativeGlobalV01 = true;

  const EXT_SOURCE = 'cardinal-formative-extension';
  let pending = null;
  let appliedKey = '';

  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin || event.data?.source !== EXT_SOURCE) return;
    if (event.data.type !== 'FORMATIVE_IMPORT_AVAILABLE' || !event.data.payload?.globalImport) return;
    pending = event.data.payload;
    appliedKey = '';
    try { sessionStorage.setItem('cardinal_global_formative_import', JSON.stringify({formativeId:pending.formativeId,assignmentId:pending.assignmentId,sectionId:pending.sectionId,title:pending.title||''})); } catch {}
    setTimeout(applyGlobalDefaults, 0);
  });

  function applyGlobalDefaults() {
    const dialog = document.getElementById('formativeImportDialog');
    if (!dialog?.open) return;
    let p = pending;
    if (!p) {
      try { const saved = JSON.parse(sessionStorage.getItem('cardinal_global_formative_import') || 'null'); if (saved?.formativeId) p = saved; } catch {}
    }
    if (!p?.formativeId) return;
    const key = `${p.formativeId}|${p.assignmentId||''}|${p.sectionId||''}`;
    if (appliedKey === key) return;
    appliedKey = key;

    const boxes = [...document.querySelectorAll('#formativeQuestionList input[type="checkbox"]')];
    boxes.forEach(cb => { cb.checked = true; });
    if (boxes[0]) boxes[0].dispatchEvent(new Event('change', { bubbles:true }));

    const title = document.getElementById('formativeWorkTitle');
    if (title && p.title) title.value = String(p.title).replace(/^questions?\s+évaluées?\s*[-:]\s*/i,'').trim() || p.title;

    const dialogTitle = document.getElementById('formativeDialogTitle');
    if (dialogTitle) dialogTitle.textContent = 'Importer le résultat global';

    const summary = document.getElementById('formativeSummary');
    if (summary && !summary.querySelector('[data-cardinal-global]')) {
      const note = document.createElement('span');
      note.dataset.cardinalGlobal = '1';
      note.textContent = 'Toutes les questions sont présélectionnées pour former une seule note globale.';
      summary.appendChild(note);
    }

    const confirm = document.getElementById('confirmFormativeImport');
    const dest = document.getElementById('formativeDestination');
    if (confirm && !dest?.value) confirm.textContent = 'Importer le résultat global';
  }

  const observer = new MutationObserver(() => requestAnimationFrame(applyGlobalDefaults));
  observer.observe(document.documentElement, { childList:true, subtree:true, attributes:true, attributeFilter:['open','class'] });
})();
