(() => {
  if (window.__cardinalV11Installed) return;
  window.__cardinalV11Installed = true;

  function isNewWork() {
    try { return !!state.currentAssignment && !state.currentAssignment.id; }
    catch { return false; }
  }

  function injectStyles() {
    if (document.getElementById('cardinal-work-ux-v11-style')) return;
    const style = document.createElement('style');
    style.id = 'cardinal-work-ux-v11-style';
    style.textContent = `
      #workSettings.cardinal-new-work {
        overflow: visible;
        border-color: #c9d9ee;
        box-shadow: 0 18px 50px rgba(20,45,90,.10);
      }
      #workSettings.cardinal-new-work > summary {
        font-size: 1.08rem;
        padding: 18px 20px;
        cursor: default;
        color: #142033;
      }
      #workSettings.cardinal-new-work > summary::after {
        content: 'Crée le travail, puis ajoute les notes.';
        display: block;
        margin-top: 3px;
        font-size: .79rem;
        font-weight: 500;
        color: #67758a;
      }
      #cardinalWorkTopRow {
        grid-column: 1 / -1;
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(170px, 220px);
        gap: 14px;
        align-items: end;
      }
      #cardinalWorkTopRow > div { min-width: 0; }
      #cardinalWorkTopRow .field-label { margin-top: 0; }
      #cardinalNewWorkGroupRow { min-width: 0; }
      #cardinalNewWorkGroupRow .hint { display: none; }
      #cardinalNewWorkGroupSelect { max-width: 220px; }
      #cardinalCopyWorkRow {
        grid-column: 1 / -1 !important;
        padding: 10px 12px;
        border: 1px solid #e1e8f1;
        border-radius: 13px;
        background: #f9fbfe;
      }
      #cardinalCopyWorkRow .field-label { margin-top: 0; }
      #workSettings .cardinal-full-row { grid-column: 1 / -1 !important; }
      #workSettings .cardinal-hidden-field { display: none !important; }
      #workSettings.cardinal-new-work .settings-grid {
        gap: 8px 14px;
        padding-top: 16px;
      }
      #workSettings.cardinal-new-work .field-label { margin-top: 8px; }
      #workSettings.cardinal-new-work #cardinalWorkTopRow .field-label,
      #workSettings.cardinal-new-work #cardinalCopyWorkRow .field-label { margin-top: 0; }
      #workSettings.cardinal-new-work .settings-actions {
        padding-top: 4px;
      }
      #workSettings.cardinal-new-work #saveAssignmentBtn {
        min-width: 180px;
        padding: 12px 18px;
      }
      @media (max-width: 760px) {
        #cardinalWorkTopRow { grid-template-columns: 1fr; }
        #cardinalNewWorkGroupSelect { max-width: none; }
      }
    `;
    document.head.appendChild(style);
  }

  function setTypeHidden() {
    const select = document.getElementById('editActivityType');
    const row = select?.parentElement;
    if (!select || !row) return;
    row.classList.add('cardinal-hidden-field');
    // Le type n'est pas utilisé dans la synchro Mozaïk. On conserve toutefois
    // la valeur existante en base pour compatibilité avec les anciens travaux.
    if (isNewWork() && !select.value) select.value = 'Évaluation';
  }

  function restoreTitleBlock(grid) {
    const top = document.getElementById('cardinalWorkTopRow');
    const title = document.getElementById('editTitle')?.parentElement;
    if (!grid || !title) return;
    if (top?.contains(title)) {
      title.classList.add('span2');
      grid.insertAdjacentElement('afterbegin', title);
    }
    top?.remove();
  }

  function buildNewWorkTopRow(grid) {
    const title = document.getElementById('editTitle')?.parentElement;
    const group = document.getElementById('cardinalNewWorkGroupRow');
    if (!grid || !title || !group) return;

    let top = document.getElementById('cardinalWorkTopRow');
    if (!top) {
      top = document.createElement('div');
      top.id = 'cardinalWorkTopRow';
      grid.insertAdjacentElement('afterbegin', top);
    }

    title.classList.remove('span2');
    group.classList.remove('span2');
    top.append(title, group);
  }

  function markFullRows() {
    const toggles = document.querySelector('#workSettings .toggle-grid');
    const instructions = document.getElementById('editInstructions')?.parentElement;
    const actions = document.querySelector('#workSettings .settings-actions');
    toggles?.classList.add('cardinal-full-row');
    instructions?.classList.add('cardinal-full-row');
    actions?.classList.add('cardinal-full-row');
  }

  function moveCopyRowNearTop(grid) {
    const copy = document.getElementById('cardinalCopyWorkRow');
    const top = document.getElementById('cardinalWorkTopRow');
    if (!grid || !copy) return;
    if (top) top.insertAdjacentElement('afterend', copy);
  }

  function setCreationMode(on) {
    const hero = document.querySelector('.work-hero');
    const actions = document.querySelector('.work-topbar .work-actions');
    const grade = document.querySelector('.grade-card');
    const settings = document.getElementById('workSettings');
    const summary = settings?.querySelector('summary');

    if (hero) hero.style.display = on ? 'none' : '';
    if (actions) actions.style.display = on ? 'none' : '';
    if (grade) grade.style.display = on ? 'none' : '';
    if (settings) {
      settings.classList.toggle('cardinal-new-work', on);
      if (on) settings.open = true;
    }
    if (summary) summary.textContent = on ? 'Nouveau travail' : 'Paramètres du travail';
  }

  function optimizeWorkPage() {
    try {
      injectStyles();
      setTypeHidden();
      markFullRows();

      const settings = document.getElementById('workSettings');
      const grid = settings?.querySelector('.settings-grid');
      if (!settings || !grid) return;

      const creating = isNewWork();
      setCreationMode(creating);

      if (creating) {
        buildNewWorkTopRow(grid);
        moveCopyRowNearTop(grid);
      } else {
        restoreTitleBlock(grid);
      }
    } catch {}
  }

  function install() {
    try {
      if (typeof fillWorkPage !== 'function' || typeof state === 'undefined') {
        setTimeout(install, 100);
        return;
      }
      if (window.__cardinalWorkUxV11Hooked) return;
      window.__cardinalWorkUxV11Hooked = true;

      const originalFill = fillWorkPage;
      fillWorkPage = function(...args) {
        const out = originalFill.apply(this, args);
        optimizeWorkPage();
        setTimeout(optimizeWorkPage, 0);
        return out;
      };

      document.querySelectorAll('#newAssignmentBtn,#newAssignmentBtn2').forEach(btn => {
        btn.addEventListener('click', () => {
          [0, 60, 180, 400].forEach(ms => setTimeout(optimizeWorkPage, ms));
        }, true);
      });

      document.getElementById('saveAssignmentBtn')?.addEventListener('click', () => {
        [100, 350, 900].forEach(ms => setTimeout(optimizeWorkPage, ms));
      });

      optimizeWorkPage();
    } catch {
      setTimeout(install, 100);
    }
  }

  install();
})();
