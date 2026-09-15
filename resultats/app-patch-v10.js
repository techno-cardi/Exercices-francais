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
    const settings = document.getElementById('workSettings');
    const grid = settings?.querySelector('.settings-grid');
    if (!settings || !grid) return;

    let row = document.getElementById('cardinalNewWorkGroupRow');
    const summary = settings.querySelector('summary');

    if (!isNewWork()) {
      row?.remove();
      setLegacyGroupChoicesVisible(true);
      hideDisplayedGroupSelector(false);
      if (summary) summary.textContent = 'Paramètres du travail';
      return;
    }

    settings.open = true;
    if (summary) summary.textContent = 'Paramètres du nouveau travail';

    const groups = knownGroups();
    if (!groups.length) return;

    let selected = String(state.currentAssignment?.groups?.[0] || state.dashboardGroup || groups[0]);
    if (!groups.includes(selected)) selected = groups[0];

    state.currentAssignment.groups = [selected];
    state.detailGroup = selected;

    if (!row) {
      row = document.createElement('div');
      row.id = 'cardinalNewWorkGroupRow';
      row.className = 'span2';
      row.innerHTML = `
        <label class="field-label" for="cardinalNewWorkGroupSelect">Groupe du travail</label>
        <select id="cardinalNewWorkGroupSelect" class="select"></select>
        <div class="hint">Le groupe affiché dans la page sert à consulter les notes d’un travail déjà créé. Pour un nouveau travail, choisis simplement le groupe ici.</div>`;
      grid.insertAdjacentElement('afterbegin', row);

      row.querySelector('#cardinalNewWorkGroupSelect')?.addEventListener('change', event => {
        const group = String(event.target.value || '');
        if (!group || !state.currentAssignment || state.currentAssignment.id) return;
        state.currentAssignment.groups = [group];
        state.detailGroup = group;
        syncHiddenGroupChoices(group);
        const detail = document.getElementById('detailGroupSelect');
        if (detail) {
          detail.innerHTML = `<option value="${escAttr(group)}">Groupe ${escAttr(group)}</option>`;
          detail.value = group;
        }
      });
    }

    const select = document.getElementById('cardinalNewWorkGroupSelect');
    if (select) {
      select.innerHTML = groups.map(g => `<option value="${escAttr(g)}">Groupe ${escAttr(g)}</option>`).join('');
      select.value = selected;
    }

    syncHiddenGroupChoices(selected);
    setLegacyGroupChoicesVisible(false);
    hideDisplayedGroupSelector(true);
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
