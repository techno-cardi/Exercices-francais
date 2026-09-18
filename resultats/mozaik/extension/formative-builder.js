(() => {
  const $ = id => document.getElementById(id);
  let pkg = null;
  let plan = null;

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;'
    }[ch]));
  }

  async function send(type, extra = {}) {
    const result = await chrome.runtime.sendMessage({ type, ...extra });
    if (!result?.ok) throw new Error(result?.message || 'Aucune réponse de Cardinal.');
    return result;
  }

  function keywordQuestions() {
    return (pkg?.items || []).filter(
      item => item?.kind === 'question' && item?.grading?.mode === 'keyword-absolute'
    );
  }

  function refreshApprovalState() {
    const qs = keywordQuestions();
    const done = qs.filter(q => q.grading?.reviewApproved === true).length;
    const el = $('approvalState');
    el.textContent = qs.length ? `${done}/${qs.length} validée${qs.length === 1 ? '' : 's'}` : 'Aucun mot-clé';
    el.className = `badge ${done === qs.length ? 'good' : 'warn'}`;
    plan = null;
    $('apply').disabled = true;
    $('plan').textContent = 'Le paquet a changé. Prépare le plan à nouveau.';
  }

  function renderItems() {
    const root = $('items');
    root.innerHTML = '';

    for (const item of pkg.items || []) {
      const div = document.createElement('article');
      div.className = 'item';

      const typeLabel = item.kind === 'question'
        ? `${item.subtype} · ${Number(item.points || 0)} pt${Number(item.points || 0) === 1 ? '' : 's'}`
        : item.kind;

      div.innerHTML = `
        <div class="item-head">
          <div class="item-title">
            <h3>${esc(item.id)}</h3>
            <div class="badge">${esc(typeLabel)}</div>
          </div>
        </div>
        <div class="prompt">${esc(item.prompt || item.content || item.passage || '')}</div>
      `;

      if (item.kind === 'question' && item.grading?.mode === 'keyword-absolute') {
        const table = document.createElement('div');
        table.className = 'keyword-table';

        (item.grading.matches || []).forEach((match, index) => {
          const row = document.createElement('div');
          row.className = 'keyword-row';
          row.innerHTML = `
            <input class="enabled" type="checkbox" ${match.enabled === false ? '' : 'checked'}>
            <input class="input kw" value="${esc(match.text || '')}" aria-label="Mot-clé">
            <input class="score" type="number" min="0" max="${esc(item.points)}" step="0.1" value="${esc(match.score)}" aria-label="Note">
            <span>/ ${esc(item.points)}</span>
            <span class="reason">${esc(match.reason || match.concept || '')}</span>
            <button class="button secondary remove" type="button">Supprimer</button>
          `;

          const invalidate = () => {
            item.grading.reviewApproved = false;
            refreshApprovalState();
          };

          row.querySelector('.enabled').addEventListener('change', e => {
            match.enabled = e.target.checked;
            invalidate();
          });
          row.querySelector('.kw').addEventListener('input', e => {
            match.text = e.target.value;
            invalidate();
          });
          row.querySelector('.score').addEventListener('input', e => {
            match.score = Number(e.target.value);
            invalidate();
          });
          row.querySelector('.remove').addEventListener('click', () => {
            item.grading.matches.splice(index, 1);
            item.grading.reviewApproved = false;
            renderItems();
            refreshApprovalState();
          });

          table.appendChild(row);
        });

        const add = document.createElement('button');
        add.className = 'button secondary';
        add.type = 'button';
        add.textContent = 'Ajouter un mot-clé';
        add.addEventListener('click', () => {
          item.grading.matches.push({
            text: '',
            score: Number(item.points || 0),
            reason: 'Ajout manuel',
            confidence: 1,
            enabled: true
          });
          item.grading.reviewApproved = false;
          renderItems();
          refreshApprovalState();
        });
        table.appendChild(add);
        div.appendChild(table);

        const approval = document.createElement('label');
        approval.className = 'approval';
        approval.innerHTML = `
          <input type="checkbox" ${item.grading.reviewApproved === true ? 'checked' : ''}>
          <strong>Je valide les mots-clés et leurs notes absolues pour cette question.</strong>
        `;
        approval.querySelector('input').addEventListener('change', e => {
          item.grading.reviewApproved = e.target.checked;
          refreshApprovalState();
        });
        div.appendChild(approval);
      }

      root.appendChild(div);
    }

    refreshApprovalState();
  }

  async function load() {
    try {
      const result = await send('CARDINAL_FORMATIVE_BUILDER_GET_PACKAGE');
      pkg = result.payload;
      if (!pkg) throw new Error('Aucun paquet Formative en attente.');

      $('subtitle').textContent = pkg.assessment?.title || 'Questionnaire sans titre';
      renderItems();
    } catch (error) {
      $('globalState').className = 'state error';
      $('globalState').textContent = error.message;
    }
  }

  $('detectTarget').addEventListener('click', async () => {
    const state = $('targetState');
    state.className = 'state';
    state.textContent = 'Détection…';
    try {
      const result = await send('CARDINAL_FORMATIVE_BUILDER_FIND_TARGET', {
        formativeId: $('formativeId').value.trim()
      });
      $('formativeId').value = result.formativeId || '';
      state.className = `state ${result.hasSession ? 'success' : 'error'}`;
      state.textContent = result.hasSession
        ? `Formative détecté ✓ ${result.title || result.formativeId}`
        : 'Formative détecté, mais la session GraphQL n’est pas encore capturée. Fais une action dans l’onglet Formative puis redétecte.';
    } catch (error) {
      state.className = 'state error';
      state.textContent = error.message;
    }
  });

  $('preparePlan').addEventListener('click', async () => {
    const root = $('plan');
    root.className = 'plan';
    root.textContent = 'Préparation…';
    $('apply').disabled = true;

    try {
      await send('CARDINAL_FORMATIVE_BUILDER_SAVE_PACKAGE', { payload: pkg });
      const result = await send('CARDINAL_FORMATIVE_BUILDER_PREPARE', {
        payload: pkg,
        formativeId: $('formativeId').value.trim()
      });
      plan = result.plan;

      root.innerHTML = `
        <strong>${esc(plan.formativeTitle || plan.formativeId)}</strong>
        <div class="plan-grid">
          <div class="plan-chip">Créer<br><strong>${plan.counts.create}</strong></div>
          <div class="plan-chip">Mettre à jour<br><strong>${plan.counts.update}</strong></div>
          <div class="plan-chip">À jour<br><strong>${plan.counts.unchanged}</strong></div>
          <div class="plan-chip">Bloqué<br><strong>${plan.counts.blocked}</strong></div>
        </div>
        <div>${plan.entries.map(e => `
          <div class="plan-entry">
            <strong>${esc(e.id)}</strong> · ${esc(e.action.toUpperCase())}
            ${e.blockedReason ? ` · ${esc(e.blockedReason)}` : ''}
          </div>
        `).join('')}</div>
      `;

      $('formativeId').value = plan.formativeId;
      $('apply').disabled = plan.counts.blocked > 0;
    } catch (error) {
      plan = null;
      root.className = 'plan state error';
      root.textContent = error.message;
    }
  });

  $('apply').addEventListener('click', async () => {
    if (!plan) return;
    if (!confirm(
      `Importer dans « ${plan.formativeTitle || plan.formativeId} » ?\n\n` +
      `${plan.counts.create} création(s), ${plan.counts.update} mise(s) à jour, ` +
      `${plan.counts.unchanged} déjà à jour.`
    )) return;

    const state = $('globalState');
    $('apply').disabled = true;
    state.className = 'state';
    state.textContent = 'Import en cours…';

    try {
      const result = await send('CARDINAL_FORMATIVE_BUILDER_APPLY', {
        payload: pkg,
        formativeId: plan.formativeId
      });
      state.className = 'state success';
      state.textContent = `Import terminé ✓ ${result.results.length} élément(s) traité(s).`;
      plan = null;
    } catch (error) {
      state.className = 'state error';
      state.textContent = error.message;
      $('apply').disabled = false;
    }
  });

  load();
})();
