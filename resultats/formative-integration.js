(() => {
  if (window.__cardinalFormativeIntegrationV08) return;
  window.__cardinalFormativeIntegrationV08 = true;

  const PAGE_SOURCE = 'cardinal-formative-console';
  const EXT_SOURCE = 'cardinal-formative-extension';
  const pending = new Map();
  let formativeReady = false;
  let currentImport = null;
  let lockedDestinationId = '';
  let lastIncomingKey = '';

  function escF(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  }
  function normF(v) {
    return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  }
  function shortTitle(text, max = 92) {
    const s = String(text || '').replace(/\s+/g,' ').trim();
    return s.length > max ? s.slice(0,max-1).trim() + '…' : s;
  }
  function formativeRequest(action, payload = {}) {
    return new Promise((resolve, reject) => {
      const requestId = crypto.randomUUID();
      const timer = setTimeout(() => {
        pending.delete(requestId);
        reject(new Error('Le connecteur Formative a expiré. Vérifie que Formative est ouvert et connecté.'));
      }, 180000);
      pending.set(requestId, { resolve, reject, timer });
      window.postMessage({ source: PAGE_SOURCE, type: 'FORMATIVE_EXTENSION_REQUEST', requestId, action, payload }, location.origin);
    });
  }

  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin || event.data?.source !== EXT_SOURCE) return;
    const data = event.data;
    if (data.type === 'FORMATIVE_EXTENSION_READY') {
      formativeReady = true;
      renderFormativeCard();
      return;
    }
    if (data.type === 'FORMATIVE_EXTENSION_RESULT') {
      const p = pending.get(String(data.requestId || ''));
      if (!p) return;
      pending.delete(String(data.requestId || ''));
      clearTimeout(p.timer);
      p.resolve(data.result || { ok:false, message:'Aucune réponse du connecteur Formative.' });
      return;
    }
    if (data.type === 'FORMATIVE_IMPORT_AVAILABLE' && data.payload?.formativeId) {
      const key = `${data.payload.formativeId}|${data.payload.assignmentId}|${data.payload.sectionId}`;
      currentImport = data.payload;
      sessionStorage.setItem('pending_formative_import', JSON.stringify(data.payload));
      if (key !== lastIncomingKey || !document.getElementById('formativeImportDialog')?.open) {
        lastIncomingKey = key;
        tryShowPendingImport();
      }
    }
  });

  function ensureUi() {
    if (!document.getElementById('formativeCard')) {
      const card = document.createElement('div');
      card.id = 'formativeCard';
      card.className = 'card formative-card hidden';
      card.innerHTML = `
        <div class="formative-card-main">
          <div class="eyebrow">Formative</div>
          <h3 id="formativeCardTitle">Aucun lien Formative</h3>
          <p id="formativeCardMeta" class="muted">Associe ce travail à une question Formative pour importer ou renvoyer les notes.</p>
        </div>
        <div class="formative-card-actions">
          <button id="formativeAssociateBtn" class="btn btn-ghost" type="button">Associer à Formative ouvert</button>
          <button id="formativePullBtn" class="btn btn-ghost hidden" type="button">Importer depuis Formative</button>
          <button id="formativePushBtn" class="btn btn-primary hidden" type="button">Envoyer vers Formative</button>
        </div>`;
      const gradeCard = document.querySelector('#assignmentDetail .grade-card');
      gradeCard?.parentNode?.insertBefore(card, gradeCard);

      card.querySelector('#formativeAssociateBtn').onclick = associateCurrentAssignment;
      card.querySelector('#formativePullBtn').onclick = pullCurrentAssignment;
      card.querySelector('#formativePushBtn').onclick = pushCurrentAssignment;
    }

    if (!document.getElementById('formativeImportDialog')) {
      const dialog = document.createElement('dialog');
      dialog.id = 'formativeImportDialog';
      dialog.className = 'dialog formative-dialog';
      dialog.innerHTML = `
        <div class="dialog-head">
          <div><div class="eyebrow">Import Formative</div><h2 id="formativeDialogTitle">Importer des notes</h2></div>
          <button id="closeFormativeDialog" class="icon-btn" type="button">×</button>
        </div>
        <div class="formative-dialog-body">
          <div class="formative-summary" id="formativeSummary"></div>
          <div>
            <div class="field-label">Questions à importer</div>
            <div id="formativeQuestionList" class="formative-question-list"></div>
            <div id="formativeSelectedTotal" class="hint"></div>
          </div>
          <div class="formative-destination">
            <label class="field-label" for="formativeDestination">Destination</label>
            <select id="formativeDestination" class="select"></select>
          </div>
          <div class="formative-settings-grid">
            <div class="span2"><label class="field-label" for="formativeWorkTitle">Titre du travail</label><input id="formativeWorkTitle" class="input" type="text"></div>
            <div><label class="field-label" for="formativeCompetence">Compétence</label><select id="formativeCompetence" class="select"><option value="lecture">Lire</option><option value="ecriture">Écrire</option><option value="oral">Communiquer oralement</option></select></div>
            <div><label class="field-label" for="formativeType">Type</label><select id="formativeType" class="select"><option>SAÉ</option><option>Évaluation</option><option>Lecture</option><option>Test</option><option>Examen</option><option>Travail</option><option>Autre</option></select></div>
            <div><label class="field-label" for="formativeWeight">Pondération (%)</label><input id="formativeWeight" class="input" type="number" min="0" max="100" step="0.1"></div>
            <div><label class="field-label" for="formativeTerm">Étape</label><select id="formativeTerm" class="select"><option value="1">Étape 1</option><option value="2">Étape 2</option><option value="3">Étape 3</option></select></div>
            <div><label class="field-label" for="formativeDate">Date</label><input id="formativeDate" class="input" type="date"></div>
            <div><label class="field-label" for="formativePeriod">Période</label><input id="formativePeriod" class="input" type="number" min="1" max="20" value="3"></div>
          </div>
          <div class="formative-options">
            <label class="switch-line"><input id="formativeVisible" type="checkbox"> Visible aux élèves et parents</label>
            <label class="switch-line"><input id="formativeReportCard" type="checkbox"> Porté au bulletin</label>
            <label class="switch-line"><input id="formativeSyncMozaik" type="checkbox"> Synchroniser ensuite dans Mozaïk</label>
          </div>
          <div id="formativeImportWarning" class="alert alert-error hidden"></div>
        </div>
        <div class="dialog-actions">
          <span id="formativeImportState" class="save-state"></span>
          <button id="cancelFormativeImport" class="btn btn-ghost" type="button">Annuler</button>
          <button id="confirmFormativeImport" class="btn btn-primary" type="button">Importer</button>
        </div>`;
      document.body.appendChild(dialog);
      dialog.querySelector('#closeFormativeDialog').onclick = () => dialog.close();
      dialog.querySelector('#cancelFormativeImport').onclick = () => dialog.close();
      dialog.querySelector('#formativeDestination').addEventListener('change', fillSettingsFromDestination);
      dialog.querySelector('#formativeQuestionList').addEventListener('change', updateSelectedTotal);
      dialog.querySelector('#confirmFormativeImport').onclick = confirmImport;
    }
  }

  function questionLabel(q) {
    const n = q.number ? `Q${q.number}` : 'Question';
    return `${n} - ${shortTitle(q.label || '')}`;
  }
  function cleanFormativeTitle(title) {
    return String(title || 'Travail Formative').replace(/^questions?\s+évaluées?\s*[-:]\s*/i,'').trim() || 'Travail Formative';
  }
  function selectedQuestionIds() {
    return [...document.querySelectorAll('#formativeQuestionList input[type="checkbox"]:checked')].map(x => x.value);
  }
  function selectedQuestions() {
    const ids = new Set(selectedQuestionIds());
    return (currentImport?.questions || []).filter(q => ids.has(String(q.id)));
  }
  function updateSelectedTotal() {
    const qs = selectedQuestions();
    const max = qs.reduce((s,q) => s + Number(q.possiblePoints || 0),0);
    const incomplete = (currentImport?.students || []).filter(s => qs.some(q => {
      const a = (s.answers || []).find(x => String(x.questionId) === String(q.id));
      return a?.points === null || a?.points === undefined || !Number.isFinite(Number(a.points));
    })).length;
    const el = document.getElementById('formativeSelectedTotal');
    if (el) el.textContent = qs.length ? `${qs.length} question${qs.length===1?'':'s'} · note sur ${formatNumber(max)}${incomplete ? ` · ${incomplete} élève${incomplete===1?'':'s'} incomplet${incomplete===1?'':'s'} (non écrasé${incomplete===1?'':'s'})` : ''}` : 'Choisis au moins une question.';
    const title = document.getElementById('formativeWorkTitle');
    const dest = document.getElementById('formativeDestination');
    if (title && dest?.value === '' && qs.length === 1) {
      const q = qs[0];
      const base = cleanFormativeTitle(currentImport?.title);
      title.value = q.label && q.label.length < 70 ? q.label : `${base} - Q${q.number || ''}`.replace(/ - Q$/,'');
    }
  }

  function assignmentForDestination(id) {
    return (state.teacherAssignments || []).find(a => String(a.id) === String(id));
  }
  function fillFieldsFromAssignment(a) {
    if (!a) return;
    document.getElementById('formativeWorkTitle').value = a.title || '';
    document.getElementById('formativeCompetence').value = a.competenceKind || 'lecture';
    document.getElementById('formativeType').value = [...document.getElementById('formativeType').options].some(o => o.value === a.activityType) ? a.activityType : 'Autre';
    document.getElementById('formativeWeight').value = a.weight ?? '';
    document.getElementById('formativeTerm').value = String(a.term || 1);
    document.getElementById('formativeDate').value = a.activityDate || today();
    document.getElementById('formativePeriod').value = a.period || 3;
    document.getElementById('formativeVisible').checked = !!a.published || !!a.resultsVisible;
    document.getElementById('formativeReportCard').checked = !!a.reportCardEnabled;
  }
  function fillSettingsFromDestination() {
    const select = document.getElementById('formativeDestination');
    const a = assignmentForDestination(select.value);
    if (a) fillFieldsFromAssignment(a);
    else {
      document.getElementById('formativeWorkTitle').value = cleanFormativeTitle(currentImport?.title);
      document.getElementById('formativeCompetence').value = 'lecture';
      document.getElementById('formativeType').value = 'SAÉ';
      document.getElementById('formativeWeight').value = '';
      document.getElementById('formativeTerm').value = '1';
      document.getElementById('formativeDate').value = today();
      document.getElementById('formativePeriod').value = '3';
      document.getElementById('formativeVisible').checked = false;
      document.getElementById('formativeReportCard').checked = false;
      updateSelectedTotal();
    }
  }

  function showImportModal(snapshot, destinationId = '') {
    ensureUi();
    currentImport = snapshot;
    lockedDestinationId = destinationId || '';
    const dialog = document.getElementById('formativeImportDialog');
    document.getElementById('formativeDialogTitle').textContent = snapshot.title || 'Importer depuis Formative';
    document.getElementById('formativeSummary').innerHTML = `<strong>${escF(snapshot.sectionTitle || `Groupe ${snapshot.groupCode || '?'}`)}</strong><span>${snapshot.students?.length || 0} élèves détectés</span>`;

    const questions = snapshot.questions || [];
    let defaults = questions.filter(q => Number(q.gradedCount || 0) > 0).map(q => String(q.id));
    if (!defaults.length && questions[0]) defaults = [String(questions[0].id)];
    if (destinationId) {
      const existing = assignmentForDestination(destinationId) || state.currentAssignment;
      if (existing?.formativeId === snapshot.formativeId && existing?.formativeQuestionIds?.length) defaults = existing.formativeQuestionIds.map(String);
    }
    const defaultSet = new Set(defaults);
    document.getElementById('formativeQuestionList').innerHTML = questions.map(q => `
      <label class="formative-question">
        <input type="checkbox" value="${escF(q.id)}" ${defaultSet.has(String(q.id)) ? 'checked' : ''}>
        <span><strong>${escF(questionLabel(q))}</strong><small>${formatNumber(q.possiblePoints)} pt${Number(q.possiblePoints)===1?'':'s'} · ${Number(q.gradedCount||0)}/${snapshot.students?.length || snapshot.studentCount || 0} notés</small></span>
      </label>`).join('');

    const available = (state.teacherAssignments || []).filter(a => (a.groups || []).includes(String(snapshot.groupCode || '')));
    const dest = document.getElementById('formativeDestination');
    dest.innerHTML = `<option value="">Créer un nouveau travail</option>` + available.map(a => `<option value="${escF(a.id)}">${escF(a.title)}</option>`).join('');
    if (destinationId) {
      if (![...dest.options].some(o => o.value === destinationId)) {
        const a = assignmentForDestination(destinationId) || state.currentAssignment;
        if (a?.id) dest.add(new Option(a.title, a.id));
      }
      dest.value = destinationId;
      dest.disabled = true;
      fillFieldsFromAssignment(assignmentForDestination(destinationId) || state.currentAssignment);
    } else {
      dest.disabled = false;
      dest.value = '';
      fillSettingsFromDestination();
    }
    document.getElementById('formativeSyncMozaik').checked = false;
    document.getElementById('formativeImportWarning').classList.add('hidden');
    document.getElementById('formativeImportState').textContent = '';
    updateSelectedTotal();
    if (!dialog.open) dialog.showModal();
  }

  function tryShowPendingImport() {
    if (document.getElementById('formativeImportDialog')?.open) return;
    if (!state?.teacherToken || !Array.isArray(state.teacherAssignments)) return;
    let payload = currentImport;
    if (!payload) {
      try { payload = JSON.parse(sessionStorage.getItem('pending_formative_import') || 'null'); } catch {}
    }
    if (payload?.formativeId) {
      currentImport = payload;
      showImportModal(payload, '');
    }
  }

  async function confirmImport() {
    const btn = document.getElementById('confirmFormativeImport');
    const stateEl = document.getElementById('formativeImportState');
    const warning = document.getElementById('formativeImportWarning');
    const ids = selectedQuestionIds();
    if (!ids.length) {
      warning.textContent = 'Choisis au moins une question.';
      warning.classList.remove('hidden');
      return;
    }
    const dest = document.getElementById('formativeDestination').value;
    const visible = document.getElementById('formativeVisible').checked;
    const kind = document.getElementById('formativeCompetence').value;
    const settings = {
      title: document.getElementById('formativeWorkTitle').value.trim(),
      competenceKind: kind,
      competencies: competencyArray(kind),
      weight: document.getElementById('formativeWeight').value === '' ? null : Number(document.getElementById('formativeWeight').value),
      term: Number(document.getElementById('formativeTerm').value || 1),
      activityDate: document.getElementById('formativeDate').value || today(),
      activityType: document.getElementById('formativeType').value,
      published: visible,
      resultsVisible: visible,
      reportCardEnabled: document.getElementById('formativeReportCard').checked,
      showInSchedule: true,
      homework: false,
      period: Number(document.getElementById('formativePeriod').value || 3),
      instructions: ''
    };
    if (!settings.title) {
      warning.textContent = 'Entre un titre pour le travail.';
      warning.classList.remove('hidden');
      return;
    }
    try {
      btn.disabled = true;
      stateEl.textContent = 'Importation...';
      warning.classList.add('hidden');
      const result = await api(TEACHER_ENDPOINT, {
        action: 'formativeImport',
        token: state.teacherToken,
        formative: currentImport,
        selectedQuestionIds: ids,
        destinationAssignmentId: dest || lockedDestinationId || '',
        settings
      });
      sessionStorage.removeItem('pending_formative_import');
      currentImport = null;
      document.getElementById('formativeImportDialog').close();
      await openAssignment(result.assignmentId);
      notify(`Formative : ${result.importedCount} note${result.importedCount===1?'':'s'} importée${result.importedCount===1?'':'s'}${result.skippedIncomplete ? `, ${result.skippedIncomplete} incomplète${result.skippedIncomplete===1?'':'s'} laissée${result.skippedIncomplete===1?'':'s'} intacte${result.skippedIncomplete===1?'':'s'}` : ''}.`);
      if (document.getElementById('formativeSyncMozaik').checked) setTimeout(() => document.getElementById('syncMozaikBtn')?.click(), 350);
    } catch (error) {
      warning.textContent = error?.message || String(error);
      warning.classList.remove('hidden');
      stateEl.textContent = '';
    } finally {
      btn.disabled = false;
    }
  }

  function currentSettings(a) {
    const visible = !!a.published || !!a.resultsVisible;
    return {
      title: a.title,
      competenceKind: a.competenceKind,
      competencies: a.competencies || competencyArray(a.competenceKind),
      weight: a.weight,
      term: a.term || 1,
      activityDate: a.activityDate || today(),
      activityType: a.activityType || 'Évaluation',
      published: visible,
      resultsVisible: visible,
      reportCardEnabled: !!a.reportCardEnabled,
      showInSchedule: a.showInSchedule !== false,
      homework: !!a.homework,
      period: a.period || 3,
      instructions: a.instructions || ''
    };
  }

  async function pullCurrentAssignment() {
    const a = state.currentAssignment;
    if (!a?.formativeId) return;
    const btn = document.getElementById('formativePullBtn');
    try {
      btn.disabled = true;
      btn.textContent = 'Importation...';
      const r = await formativeRequest('pull', { formativeId: a.formativeId });
      if (!r?.ok || !r.payload) throw new Error(r?.message || 'Impossible de lire Formative.');
      const out = await api(TEACHER_ENDPOINT, {
        action:'formativeImport', token:state.teacherToken, formative:r.payload,
        selectedQuestionIds:a.formativeQuestionIds || [], destinationAssignmentId:a.id, settings:currentSettings(a)
      });
      await openAssignment(a.id);
      notify(`Formative : ${out.importedCount} note${out.importedCount===1?'':'s'} mise${out.importedCount===1?'':'s'} à jour.`);
    } catch (error) { notify(error?.message || String(error), 'error'); }
    finally { btn.disabled = false; btn.textContent = 'Importer depuis Formative'; }
  }

  async function pushCurrentAssignment() {
    const a = state.currentAssignment;
    const qids = a?.formativeQuestionIds || [];
    if (!a?.formativeId || qids.length !== 1) {
      notify('L’envoi vers Formative est disponible seulement lorsqu’un travail est lié à une seule question.', 'error');
      return;
    }
    const q = (a.formativeQuestionMeta || []).find(x => String(x.id) === String(qids[0]));
    if (q && Math.abs(Number(q.possiblePoints) - Number(a.maxScore)) > 1e-9) {
      notify(`La question Formative vaut ${formatNumber(q.possiblePoints)} points, mais ce travail est sur ${formatNumber(a.maxScore)}. Importe d’abord depuis Formative pour réaligner le total.`, 'error');
      return;
    }
    const btn = document.getElementById('formativePushBtn');
    const grades = state.currentStudents
      .filter(s => (!state.detailGroup || s.group === state.detailGroup) && s.grade !== null && s.grade !== undefined)
      .map(s => ({ email:s.email, grade:Number(s.grade) }));
    if (!grades.length) {
      notify('Aucune note à envoyer vers Formative.', 'error');
      return;
    }
    const qLabel = q?.number ? `Q${q.number}` : 'la question liée';
    if (!window.confirm(`Envoyer ${grades.length} note${grades.length === 1 ? '' : 's'} vers ${qLabel} dans Formative? Les notes déjà présentes dans Formative seront remplacées.`)) return;
    try {
      btn.disabled = true;
      btn.textContent = 'Envoi...';
      const r = await formativeRequest('push', { formativeId:a.formativeId, questionId:qids[0], grades });
      if (!r?.ok) throw new Error(r?.message || 'Formative n’a pas confirmé la mise à jour.');
      notify(`Formative : ${r.updatedCount || 0} note${Number(r.updatedCount||0)===1?'':'s'} mise${Number(r.updatedCount||0)===1?'':'s'} à jour.`);
      renderFormativeCard();
    } catch (error) { notify(error?.message || String(error), 'error'); }
    finally { btn.disabled = false; btn.textContent = 'Envoyer vers Formative'; }
  }

  async function associateCurrentAssignment() {
    if (!state.currentAssignment?.id) return;
    const btn = document.getElementById('formativeAssociateBtn');
    try {
      btn.disabled = true;
      btn.textContent = 'Lecture...';
      const r = await formativeRequest('captureActive', {});
      if (!r?.ok || !r.payload) throw new Error(r?.message || 'Aucun Formative ouvert n’a été trouvé.');
      showImportModal(r.payload, state.currentAssignment.id);
    } catch (error) { notify(error?.message || String(error), 'error'); }
    finally { btn.disabled = false; btn.textContent = state.currentAssignment?.formativeId ? 'Changer le lien' : 'Associer à Formative ouvert'; }
  }

  function renderFormativeCard() {
    ensureUi();
    const card = document.getElementById('formativeCard');
    if (!card) return;
    const detailVisible = document.getElementById('assignmentDetail') && !document.getElementById('assignmentDetail').classList.contains('hidden');
    card.classList.toggle('hidden', !detailVisible || !state.currentAssignment);
    if (!state.currentAssignment) return;
    const a = state.currentAssignment;
    const linked = !!a.formativeId;
    const title = document.getElementById('formativeCardTitle');
    const meta = document.getElementById('formativeCardMeta');
    const associate = document.getElementById('formativeAssociateBtn');
    const pull = document.getElementById('formativePullBtn');
    const push = document.getElementById('formativePushBtn');
    associate.textContent = linked ? 'Changer le lien' : 'Associer à Formative ouvert';
    associate.disabled = !formativeReady;
    pull.classList.toggle('hidden', !linked);
    push.classList.toggle('hidden', !linked);
    if (!linked) {
      title.textContent = 'Aucun lien Formative';
      meta.textContent = formativeReady ? 'Ouvre le Formative voulu dans l’onglet Réponses, puis associe-le à ce travail.' : 'Extension Formative non détectée.';
      return;
    }
    title.textContent = a.formativeTitle || 'Formative lié';
    const qs = a.formativeQuestionMeta || [];
    meta.textContent = qs.length ? qs.map(q => `${q.number ? `Q${q.number}` : 'Question'} · ${formatNumber(q.possiblePoints)} pt${Number(q.possiblePoints)===1?'':'s'}`).join(' + ') : `${a.formativeQuestionIds?.length || 0} question(s) liée(s)`;
    push.disabled = !formativeReady || (a.formativeQuestionIds || []).length !== 1;
    pull.disabled = !formativeReady;
    push.title = (a.formativeQuestionIds || []).length === 1 ? '' : 'L’envoi vers Formative exige un lien vers une seule question.';
  }

  ensureUi();
  try {
    const originalFill = fillWorkPage;
    fillWorkPage = function(...args) {
      const out = originalFill.apply(this,args);
      setTimeout(renderFormativeCard,0);
      return out;
    };
  } catch {}
  window.postMessage({ source: PAGE_SOURCE, type:'FORMATIVE_EXTENSION_PING' }, location.origin);
  setTimeout(renderFormativeCard, 200);
  setInterval(() => {
    renderFormativeCard();
    if (sessionStorage.getItem('pending_formative_import')) tryShowPendingImport();
  }, 1200);
})();
