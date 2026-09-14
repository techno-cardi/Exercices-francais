(() => {
  if (window.__cardinalFormativeSafetyV081) return;
  window.__cardinalFormativeSafetyV081 = true;

  const LINK_ENDPOINT = 'https://ojyswaxuqwnqilrvtjll.supabase.co/functions/v1/school-formative-link';
  let linkOnlyNoticePending = false;

  try {
    const originalApi = api;
    api = async function(endpoint, payload) {
      if (
        endpoint === TEACHER_ENDPOINT &&
        payload?.action === 'formativeImport' &&
        payload?.destinationAssignmentId
      ) {
        const importGrades = document.getElementById('formativeImportGrades');
        if (importGrades && !importGrades.checked) {
          const linked = await originalApi(LINK_ENDPOINT, {
            action: 'link',
            token: payload.token,
            formative: payload.formative,
            selectedQuestionIds: payload.selectedQuestionIds || [],
            destinationAssignmentId: payload.destinationAssignmentId,
          });
          linkOnlyNoticePending = true;
          return {
            ...linked,
            importedCount: 0,
            skippedIncomplete: 0,
            skippedUnknown: 0,
          };
        }
      }
      return originalApi(endpoint, payload);
    };
  } catch {}

  try {
    const originalNotify = notify;
    notify = function(message, type = 'success') {
      if (linkOnlyNoticePending && /^Formative\s*:\s*0\s+note/i.test(String(message || ''))) {
        linkOnlyNoticePending = false;
        return originalNotify('Lien Formative enregistré. Aucune note de Gestion des notes n’a été modifiée.', 'success');
      }
      return originalNotify(message, type);
    };
  } catch {}

  function ensureSafetyControls() {
    const dialog = document.getElementById('formativeImportDialog');
    if (!dialog) return;

    const options = dialog.querySelector('.formative-options');
    if (options && !document.getElementById('formativeImportGrades')) {
      const label = document.createElement('label');
      label.className = 'switch-line';
      label.innerHTML = '<input id="formativeImportGrades" type="checkbox"> Importer/remplacer les notes depuis Formative';
      options.insertBefore(label, options.firstChild);

      const hint = document.createElement('div');
      hint.id = 'formativeImportSafetyHint';
      hint.className = 'hint';
      options.insertAdjacentElement('afterend', hint);
    }

    const dest = document.getElementById('formativeDestination');
    const cb = document.getElementById('formativeImportGrades');
    const sync = document.getElementById('formativeSyncMozaik');
    const confirmBtn = document.getElementById('confirmFormativeImport');
    const hint = document.getElementById('formativeImportSafetyHint');
    if (!dest || !cb) return;

    if (!dest.dataset.formativeSafetyBound) {
      dest.dataset.formativeSafetyBound = '1';
      dest.addEventListener('change', () => {
        dest.dataset.formativeSafetyLast = '';
        setTimeout(updateMode, 0);
      });
      cb.addEventListener('change', updateMode);
    }

    function updateMode() {
      const value = String(dest.value || '');
      const existing = !!value;
      const changedDestination = dest.dataset.formativeSafetyLast !== value;
      if (changedDestination) {
        cb.checked = !existing;
        dest.dataset.formativeSafetyLast = value;
      }
      cb.disabled = !existing;

      if (sync) {
        sync.disabled = existing && !cb.checked;
        if (sync.disabled) sync.checked = false;
      }
      if (confirmBtn) confirmBtn.textContent = existing && !cb.checked ? 'Associer sans toucher aux notes' : 'Importer';
      if (hint) {
        hint.textContent = existing && !cb.checked
          ? 'Association seulement : les notes et les paramètres actuels de Gestion des notes seront conservés.'
          : existing
            ? 'Attention : les notes Formative corrigées remplaceront les notes actuelles du travail choisi.'
            : 'Les notes sélectionnées seront importées dans le nouveau travail.';
      }
    }

    updateMode();
  }

  document.addEventListener('click', event => {
    const pull = event.target instanceof Element ? event.target.closest('#formativePullBtn') : null;
    if (!pull || pull.disabled) return;
    if (!window.confirm('Importer depuis Formative remplacera les notes locales correspondantes qui sont déjà corrigées dans Formative. Continuer?')) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  const observer = new MutationObserver(() => requestAnimationFrame(ensureSafetyControls));
  observer.observe(document.documentElement, { childList: true, subtree: true });
  ensureSafetyControls();
})();