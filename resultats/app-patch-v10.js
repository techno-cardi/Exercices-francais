(() => {
  if (window.__cardinalV10Installed) return;
  window.__cardinalV10Installed = true;

  function escAttr(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  }

  function knownGroups() {
    const set = new Set();
    try {
      if (typeof state !== 'undefined') {
        Object.keys(state.groupStats || {}).forEach(g => g && set.add(String(g)));
        (state.teacherAssignments || []).forEach(a => (a.groups || []).forEach(g => g && set.add(String(g))));
      }
    } catch {}
    document.querySelectorAll('.group-nav[data-group]').forEach(el => el.dataset.group && set.add(String(el.dataset.group)));
    document.querySelectorAll('#assignmentGroupFilter option').forEach(o => o.value && set.add(String(o.value)));
    return [...set].filter(Boolean).sort((a,b) => a.localeCompare(b, 'fr', { numeric:true, sensitivity:'base' }));
  }

  function isNewWork() {
    try { return !!state.currentAssignment && !state.currentAssignment.id; }
    catch { return false; }
  }

  function syncHiddenGroupChoices(group) {
    const choices = document.getElementById('groupChoices');
    if (!choices) return;
    [...choices.querySelectorAll('input[type="checkbox"]')].forEach(input => {
      input.checked = String(input.value) === String(group);
    });
    choices.dispatchEvent(new Event('change', { bubbles:true }));
  }

  function hideDisplayedGroupSelector(hide) {
    const label = document.querySelector('label[for="detailGroupSelect"]');
    const select = document.getElementById('detailGroupSelect');
    if (label) label.style.display = hide ? 'none' : '';
    if (select) select.style.display = hide ? 'none' : '';

    const syncState = document.getElementById('syncState');
    const mapping = document.getElementById('cardinalMozaikMappingState');
    if (syncState) {
      if (hide) {
        syncState.dataset.cardinalWasDisplay = syncState.style.display || '';
        syncState.style.display = 'none';
      } else {
        syncState.style.display = syncState.dataset.cardinalWasDisplay || '';
      }
    }
    if (mapping) mapping.style.display = hide ? 'none' : '';
  }

  function setLegacyGroupChoicesVisible(visible) {
    const choices = document.getElementById('groupChoices');
    const row = choices?.closest('.span2');
    if (!row) return;
    row.style.display = visible ? '' : 'none';
  }

  function ensureNewWorkGroupSelect() {
    if (typeof state === 'undefined') return;
    // The real checkbox list is the only source of selected creation groups.
    // Each checked group creates its own work in the server transaction.
    document.getElementById('cardinalNewWorkGroupRow')?.remove();
    setLegacyGroupChoicesVisible(true);
    const creating = isNewWork();
    hideDisplayedGroupSelector(creating);
    const settings = document.getElementById('workSettings');
    const summary = settings?.querySelector('summary');
    if (creating && settings) settings.open = true;
    if (summary) summary.textContent = creating ? 'Paramètres des nouveaux travaux' : 'Paramètres du travail';
    const hint = document.getElementById('independentGroupHint');
    if (hint) hint.hidden = !creating;
  }

  function install() {
    try {
      if (typeof fillWorkPage !== 'function' || typeof state === 'undefined') {
        setTimeout(install, 100);
        return;
      }
      if (window.__cardinalNewWorkUxInstalled) return;
      window.__cardinalNewWorkUxInstalled = true;

      const originalFill = fillWorkPage;
      fillWorkPage = function(...args) {
        const out = originalFill.apply(this, args);
        ensureNewWorkGroupSelect();
        return out;
      };

      document.querySelectorAll('#newAssignmentBtn,#newAssignmentBtn2').forEach(btn => {
        btn.addEventListener('click', () => {
          [0, 40, 120, 300].forEach(ms => setTimeout(ensureNewWorkGroupSelect, ms));
        }, true);
      });

      const saveBtn = document.getElementById('saveAssignmentBtn');
      saveBtn?.addEventListener('click', () => {
        setTimeout(ensureNewWorkGroupSelect, 300);
        setTimeout(ensureNewWorkGroupSelect, 900);
      });

      ensureNewWorkGroupSelect();
    } catch {
      setTimeout(install, 100);
    }
  }

  install();
})();
