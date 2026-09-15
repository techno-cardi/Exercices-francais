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

  function boxes() {
    return [...document.querySelectorAll('#formativeQuestionList input[type="checkbox"]')];
  }

  function isGraded(cb, p) {
    const q = (p?.questions || []).find(item => String(item.id) === String(cb.value));
    if (q) return Number(q.gradedCount || 0) > 0;
    const text = cb.closest('label')?.textContent || '';
    const match = text.match(/(\d+)\s*\/\s*\d+\s+not[eé]s?/i);
    return !!match && Number(match[1]) > 0;
  }

  function fireSelectionChange(list) {
    const first = list[0];
    if (first) first.dispatchEvent(new Event('change', { bubbles:true }));
  }

  function selectAll() {
    const list = boxes();
    list.forEach(cb => { cb.checked = true; });
    fireSelectionChange(list);
  }

  function selectGraded(p) {
    const list = boxes();
    list.forEach(cb => { cb.checked = isGraded(cb, p); });
    fireSelectionChange(list);
  }

  function ensureSelectionButtons(p) {
    const list = document.getElementById('formativeQuestionList');
    if (!list || document.querySelector('[data-cardinal-global-actions]')) return;

    const actions = document.createElement('div');
    actions.dataset.cardinalGlobalActions = '1';
    actions.style.display = 'flex';
    actions.style.gap = '8px';
    actions.style.flexWrap = 'wrap';
    actions.style.margin = '0 0 10px';

    const all = document.createElement('button');
    all.type = 'button';
    all.className = 'btn btn-ghost';
    all.textContent = 'Sélectionner tout';
    all.addEventListener('click', selectAll);

    const graded = document.createElement('button');
    graded.type = 'button';
    graded.className = 'btn btn-ghost';
    graded.textContent = 'Sélectionner les questions corrigées';
    graded.addEventListener('click', () => selectGraded(pending || p));

    actions.append(all, graded);
    list.parentNode?.insertBefore(actions, list);
  }

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

    // Le formulaire de base présélectionne déjà les questions ayant au moins un pointage.
    // On réapplique explicitement cette règle pour l'import global et on offre les deux raccourcis.
    selectGraded(p);
    ensureSelectionButtons(p);

    const title = document.getElementById('formativeWorkTitle');
    if (title && p.title) title.value = String(p.title).replace(/^questions?\s+évaluées?\s*[-:]\s*/i,'').trim() || p.title;

    const dialogTitle = document.getElementById('formativeDialogTitle');
    if (dialogTitle) dialogTitle.textContent = 'Importer le résultat global';

    const summary = document.getElementById('formativeSummary');
    if (summary && !summary.querySelector('[data-cardinal-global]')) {
      const note = document.createElement('span');
      note.dataset.cardinalGlobal = '1';
      note.textContent = 'Les questions ayant un pointage corrigé sont présélectionnées pour former une seule note globale.';
      summary.appendChild(note);
    }

    const confirm = document.getElementById('confirmFormativeImport');
    const dest = document.getElementById('formativeDestination');
    if (confirm && !dest?.value) confirm.textContent = 'Importer le résultat global';
  }

  const observer = new MutationObserver(() => requestAnimationFrame(applyGlobalDefaults));
  observer.observe(document.documentElement, { childList:true, subtree:true, attributes:true, attributeFilter:['open','class'] });
})();
