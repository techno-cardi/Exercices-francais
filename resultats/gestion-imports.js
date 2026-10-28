(() => {
  'use strict';
  if (window.CardinalGestionImports) return;
  let session = null;
  const pending = new Map();
  const el = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  function cleanup() {
    const old = session;
    session = null;
    for (const [id, item] of pending) {
      clearTimeout(item.timer); pending.delete(id); item.resolve(null);
    }
    old?.resolveCopy?.(null);
    old?.resolveDestination?.(false);
  }
  function close() { cleanup(); el('gestionImportsDialog')?.close(); }
  function valid(s) {
    return session === s && el('gestionImportsDialog')?.open && s.token === state.teacherToken &&
      s.group === String(state.dashboardGroup || '') && s.schoolYear === state.schoolYear && s.navigation === state.navigationRevision &&
      (!['split','destination'].includes(s.kind) || s.assignmentId === state.currentAssignment?.id);
  }
  function create(kind, title) {
    close();
    let dialog = el('gestionImportsDialog');
    if (!dialog) {
      dialog = document.createElement('dialog'); dialog.id = 'gestionImportsDialog';
      dialog.className = 'dialog formative-dialog';
      dialog.innerHTML = '<div class="dialog-head"><h2 id="gestionImportsTitle"></h2><button type="button" class="icon-btn" id="gestionImportsClose" aria-label="Fermer">×</button></div><div class="formative-dialog-body"><p id="gestionImportsScope" class="hint"></p><div id="gestionImportsContent"></div><p id="gestionImportsError" class="alert" role="alert"></p></div><div class="dialog-actions"><button type="button" class="btn btn-ghost" id="gestionImportsCancel">Annuler</button><button type="button" class="btn btn-primary" id="gestionImportsSubmit"></button></div>';
      document.body.appendChild(dialog);
      dialog.addEventListener('close', () => { if (!dialog.open) cleanup(); });
      dialog.addEventListener('cancel', cleanup);
      el('gestionImportsClose').onclick = close; el('gestionImportsCancel').onclick = close;
      el('gestionImportsSubmit').onclick = submit; el('gestionImportsContent').onchange = change;
    }
    session = {kind, schoolYear:state.schoolYear,group:String(state.dashboardGroup || ''), navigation:state.navigationRevision, token:state.teacherToken, busy:false, previewId:null, choices:new Map(), resultGroups:{}, unresolved:[]};
    el('gestionImportsTitle').textContent = title;
    el('gestionImportsScope').textContent = `Groupe ${session.group}`;
    el('gestionImportsContent').textContent = 'Lecture en cours…';
    el('gestionImportsError').textContent = '';
    el('gestionImportsSubmit').textContent = 'Prévisualiser'; el('gestionImportsSubmit').disabled = true;
    dialog.showModal(); return session;
  }
  function error(s, value) { if (valid(s)) el('gestionImportsError').textContent = value?.message || String(value); }
  function request(s, action, data) { return api(TEACHER_ENDPOINT, {action, token:s.token,schoolYear:s.schoolYear, ...data}); }
  function invalidate(s) {
    s.previewId = null; el('gestionImportsError').textContent = '';
    el('gestionImportsSubmit').textContent = s.kind === 'copies' ? 'Ouvrir ce groupe' : 'Prévisualiser';
  }
  function change(event) {
    const s = session, node = event.target;
    if (!s || !valid(s) || s.busy) return;
    if (s.kind === 'destination') {
      if (node.dataset.destination !== undefined) {
        s.destination = s.destinationOptions?.includes(node.value) ? node.value : '';
        s.previewId = null;
        el('gestionImportsSubmit').textContent = 'Continuer vers l’aperçu';
        updateButton(s);
      }
      return;
    }
    invalidate(s);
    if (node.dataset.activity !== undefined) {
      const id = node.dataset.activity, row = s.rows?.find(r => r.activityId === id);
      if (!row?.selectable) return;
      if (!node.value) s.choices.delete(id);
      else if (node.value === 'create') s.choices.set(id, {activityId:id, mode:'create'});
      else if (node.value.startsWith('associate:') && row.candidates?.some(c => c.id === node.value.slice(10))) s.choices.set(id, {activityId:id, mode:'associate', assignmentId:node.value.slice(10)});
    } else if (node.dataset.email !== undefined) {
      if (s.groups.includes(node.value)) s.resultGroups[node.dataset.email] = node.value;
      else delete s.resultGroups[node.dataset.email];
    } else if (node.dataset.formative !== undefined) s.formativeGroupCode = s.groups.includes(node.value) ? node.value : undefined;
    else if (node.dataset.copy !== undefined) s.selectedCopy = s.copies.find(c => c.assignmentId === node.value)?.assignmentId;
    updateButton(s);
  }
  function updateButton(s) {
    let ready = true;
    if (s.kind === 'mozaik') ready = s.complete === true && s.choices.size > 0;
    if (s.kind === 'split') ready = !s.unresolved.some(email => !s.resultGroups[email]) && (!s.formativeRequired || !!s.formativeGroupCode) && !s.hardBlocked;
    if (s.kind === 'copies') ready = !!s.selectedCopy;
    if (s.kind === 'destination') ready = s.complete === true && !!s.destination;
    el('gestionImportsSubmit').disabled = s.busy || !ready;
  }
  function bridge(s) {
    return new Promise((resolve, reject) => {
      const requestId = crypto.randomUUID();
      const timer = setTimeout(() => {pending.delete(requestId); reject(new Error('Le connecteur Mozaïk ne répond pas. Vérifie que l’extension Cardinal est active et Mozaïk connecté.'));}, 90000);
      pending.set(requestId, {resolve, reject, timer, session:s});
      window.postMessage({source:'cardinal-mozaik-console', type:'MOZAIK_EXTENSION_PLANNED_ACTIVITIES', requestId, groupCode:s.group}, location.origin);
    });
  }
  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin || event.data?.source !== 'cardinal-mozaik-extension' || event.data.type !== 'MOZAIK_EXTENSION_PLANNED_ACTIVITIES_RESULT') return;
    const id = String(event.data.requestId || ''), item = pending.get(id);
    if (!item) return;
    pending.delete(id); clearTimeout(item.timer);
    item.resolve(valid(item.session) ? event.data.result : null);
  });
  window.addEventListener('cardinal-group-changed', close);
  function metadataRows(s) {
    const labels = {linked:'✅ Déjà importé', already_exists:'✅ Déjà présent · association à vérifier', missing:'À importer', ambiguous:'Correspondance à vérifier'};
    const missing = s.rows.filter(row => row.status === 'missing' && row.selectable);
    const rank = row => row.status === 'missing' ? 0 : row.status === 'linked' ? 2 : 1;
    const rows = [...s.rows].sort((a,b) => rank(a)-rank(b));
    el('gestionImportsContent').innerHTML = `<p>${missing.length} ${missing.length === 1 ? 'travail manquant' : 'travaux manquants'}. Import des paramètres uniquement, sans notes.</p><button type="button" class="btn btn-ghost" id="gestionImportsAllMissing"${!s.complete || !missing.length ? ' disabled' : ''}>Importer tous les manquants (${missing.length})</button>` +
      (s.complete ? '' : '<p class="alert">Liste Mozaïk incomplète : import bloqué. Ferme puis recharge la liste.</p>') +
      '<div class="gestion-metadata-list">' + (rows.length ? rows.map(row => {
        const m = row.metadata || {}, selected = s.choices.get(row.activityId);
        const label = row.status === 'ambiguous' && row.candidates?.length === 1 ? '✅ Déjà présent · association à vérifier' : labels[row.status] || row.status;
        return `<section class="formative-section"><h3>${esc(row.title || 'Sans titre')}</h3><p>${esc(label)} · ${m.maxScore == null || Number(m.maxScore) <= 0 ? 'À compléter' : esc(m.maxScore) + ' points'} · ${esc(m.activityDate || 'Date absente')}</p>` +
          (row.selectable ? `<label>Action <select class="select" data-activity="${esc(row.activityId)}"><option value="">Ne pas importer</option><option value="create"${selected?.mode === 'create' ? ' selected' : ''}>Créer un nouveau travail</option>${(row.candidates || []).map(c => `<option value="associate:${esc(c.id)}"${selected?.assignmentId === c.id ? ' selected' : ''}>Associer : ${esc(c.title)} · ${esc(c.activityDate || 'sans date')} · étape ${esc(c.term ?? '—')} · ${esc(c.maxScore ?? '—')} points</option>`).join('')}</select></label>` : '<p>Association existante à conserver ou à vérifier dans le travail.</p>') + '</section>';
      }).join('') : '<p>Aucun travail Mozaïk dans cette portée.</p>') + '</div>';
    el('gestionImportsAllMissing').onclick = async () => {
      if (!valid(s) || s.busy || !s.complete || !missing.length) return;
      invalidate(s); s.choices.clear();
      for (const row of missing) s.choices.set(row.activityId, {activityId:row.activityId, mode:'create'});
      metadataRows(s); updateButton(s); await submit();
    };
  }
  async function openMozaik() {
    const s = create('mozaik', 'Importer des travaux Mozaïk'); s.busy = true;
    try {
      const version=String(state.extensionVersion || '').split('.').map(Number);
      if (!state.extensionReady || (version[0] || 0)<1 || version[0]===1 && ((version[1] || 0)<3 || version[1]===3 && (version[2] || 0)<24)) throw new Error('Active Cardinal 1.3.24 pour lire les travaux Mozaïk, puis réessaie.');
      const result = await bridge(s); if (!valid(s) || !result) return;
      if (result.ok !== true) throw new Error(result.message || 'Lecture Mozaïk impossible.');
      if (String(result.scope?.groupCode || '') !== s.group) throw new Error('La réponse Mozaïk appartient à un autre groupe.');
      s.scope = result.scope; s.activities = result.activities; s.complete = result.complete === true;
      const response = await request(s, 'mozaikPreview', {scope:s.scope, activities:s.activities, complete:s.complete});
      if (!valid(s)) return;
      s.rows = response.preview?.rows || [];
      for (const row of s.rows) if (row.status === 'missing' && row.selectable) s.choices.set(row.activityId, {activityId:row.activityId, mode:'create'});
      el('gestionImportsScope').textContent = `Groupe ${s.group} · Année ${s.scope.schoolYear} · Matière ${s.scope.subjectId}`;
      metadataRows(s);
    } catch (e) {error(s, e);} finally {if (valid(s)) {s.busy = false; updateButton(s);}}
  }
  const blockerLabels = {unresolved_formative_group:'Choisis le groupe historique de l’association Formative.', unresolved_link_group:'Un lien Mozaïk sans groupe doit être vérifié.', unresolved_legacy_mozaik_link:'Un ancien lien Mozaïk doit être vérifié.', split_active_sync_job:'Un envoi Mozaïk est encore actif.', split_unhandled_dependency:'Une référence historique doit être vérifiée.'};
  function splitRows(s, preview) {
    s.groups = (preview.groups || []).map(g => String(g.groupCode));
    // Keep resolved choices visible so the teacher can correct an attribution before confirming.
    s.unresolved = [...new Set([...s.unresolved, ...(preview.unresolvedEmails || [])])];
    s.formativeRequired = (preview.blockers || []).includes('unresolved_formative_group') || !!s.formativeGroupCode;
    s.hardBlocked = (preview.blockers || []).some(b => b !== 'unresolved_formative_group');
    const options = selected => '<option value="">Choisir le groupe historique</option>' + s.groups.map(g => `<option value="${esc(g)}"${selected === g ? ' selected' : ''}>Groupe ${esc(g)}</option>`).join('');
    el('gestionImportsContent').innerHTML = '<p>Chaque groupe recevra un travail indépendant. Vérifie le groupe historique des notes et associations avant de confirmer.</p>' +
      '<ul>' + (preview.groups || []).map(g => `<li>Groupe ${esc(g.groupCode)} : ${esc(g.resultCount)} notes, ${esc(g.linkCount)} liens Mozaïk</li>`).join('') + '</ul>' +
      s.unresolved.map(email => `<label class="field-label">${esc(email)}<select class="select" data-email="${esc(email)}">${options(s.resultGroups[email])}</select></label>`).join('') +
      (s.formativeRequired ? `<label class="field-label">Association Formative<select class="select" data-formative="1">${options(s.formativeGroupCode)}</select></label>` : '') +
      (preview.blockers || []).map(b => `<p class="alert">${esc(blockerLabels[b] || 'Une référence historique nécessite une vérification avant la séparation : ' + b)}</p>`).join('');
  }
  async function prepareSplit(s) {
    const response = await request(s, 'splitPreview', {assignmentId:s.assignmentId, resultGroups:s.resultGroups, ...(s.formativeGroupCode ? {formativeGroupCode:s.formativeGroupCode} : {})});
    if (!valid(s)) return;
    splitRows(s, response.preview || {});
    s.previewId = response.preview?.canConfirm === true ? response.previewId : null;
    el('gestionImportsSubmit').textContent = s.previewId ? 'Confirmer la séparation' : 'Prévisualiser les attributions';
  }
  async function splitCurrent() {
    const a = state.currentAssignment;
    if (!a?.id || !Array.isArray(a.groups) || a.groups.length < 2) return;
    const s = create('split', 'Séparer cet ancien travail partagé'); s.assignmentId = a.id; s.busy = true;
    try {await prepareSplit(s);} catch (e) {error(s, e);} finally {if (valid(s)) {s.busy = false; updateButton(s);}}
  }
  function resolveOldWork(response) {
    const s = create('copies', 'Choisir le groupe du travail');
    s.copies = (response.copies || []).filter(c => c.assignmentId && c.groupCode);
    el('gestionImportsContent').innerHTML = '<p>Ce travail a été séparé. Choisis la copie à ouvrir.</p><label>Groupe<select class="select" data-copy="1"><option value="">Choisir un groupe</option>' + s.copies.map(c => `<option value="${esc(c.assignmentId)}">Groupe ${esc(c.groupCode)}</option>`).join('') + '</select></label>';
    el('gestionImportsSubmit').textContent = 'Ouvrir ce groupe'; updateButton(s);
    return new Promise(resolve => {s.resolveCopy = resolve;});
  }
  async function submit() {
    const s = session; if (!s || !valid(s) || s.busy || el('gestionImportsSubmit').disabled) return;
    if (s.kind === 'copies') {const resolve = s.resolveCopy; s.resolveCopy = null; const id = s.selectedCopy; close(); resolve?.(id); return;}
    s.busy = true; updateButton(s); el('gestionImportsError').textContent = '';
    try {
      if (s.kind === 'destination') {
        if (s.destination !== '__create__' && s.destination !== s.linkedActivity) {
          if (!s.previewId) {
            const response = await request(s, 'mozaikPreview', {scope:s.scope,activities:s.activities,complete:s.complete,selections:[{activityId:s.destination,mode:'associate',assignmentId:s.assignmentId}]});
            if (!valid(s)) return;
            if (!response.previewId) throw new Error('La destination n’a pas pu être vérifiée. Recharge la liste.');
            s.previewId = response.previewId;
          }
          // Store only the chosen association. The subsequent native preview still precedes all grade writes.
          await request(s, 'mozaikConfirm', {previewId:s.previewId});
          if (!valid(s)) return;
        }
        const resolve = s.resolveDestination; s.resolveDestination = null;
        close(); resolve?.(true); return;
      }
      if (!s.previewId) {
        if (s.kind === 'split') await prepareSplit(s);
        else {
          const response = await request(s, 'mozaikPreview', {scope:s.scope, activities:s.activities, complete:s.complete, selections:Array.from(s.choices.values())});
          if (!valid(s)) return;
          s.previewId = response.previewId;
          if (!s.previewId) throw new Error('Aucune modification à confirmer. Recharge la liste.');
          el('gestionImportsContent').innerHTML = `<p>${s.choices.size} travaux sélectionnés pour le groupe ${esc(s.group)}.</p><ul>` + Array.from(s.choices.values()).map(choice => `<li>${esc(s.rows.find(r => r.activityId === choice.activityId)?.title)} : ${choice.mode === 'create' ? 'nouveau travail non publié' : 'association au travail choisi; notes conservées'}</li>`).join('') + '</ul><p>Aucune note importée. Aucun changement dans Mozaïk.</p>';
          el('gestionImportsSubmit').textContent = 'Confirmer l’import des travaux';
        }
      } else {
        const result = await request(s, s.kind === 'split' ? 'splitConfirm' : 'mozaikConfirm', {previewId:s.previewId});
        if (!valid(s)) return;
        await refreshTeacherData(); if (!valid(s)) return;
        const copies = (result.assignments || []).map(copy => ({...copy, assignmentId:copy.assignmentId || copy.id}));
        close();
        if (s.kind === 'split' && copies.length) {const id = await resolveOldWork({copies}); if (id) await openAssignment(id);}
        else if (typeof notify === 'function') notify('Travaux Mozaïk importés.');
      }
    } catch (e) {if (valid(s)) {error(s, e);}}
    finally {if (valid(s)) {s.busy = false; updateButton(s);}}
  }
  async function loadDestination(s) {
    s.busy = true;
    try {
      const result = await bridge(s); if (!valid(s) || !result) return;
      if (result.ok !== true || result.complete !== true) throw new Error(result.message || 'Liste Mozaïk incomplète : aucune création ni publication. Réessaie la lecture.');
      if (String(result.scope?.groupCode || '') !== s.group) throw new Error('La liste Mozaïk appartient à un autre groupe.');
      s.scope=result.scope; s.activities=result.activities; s.complete=true;
      const response=await request(s,'mozaikPreview',{scope:s.scope,activities:s.activities,complete:true});
      if (!valid(s)) return;
      s.rows=response.preview?.rows || [];
      const linked=s.rows.filter(row=>row.assignmentId===s.assignmentId);
      if (linked.length>1) throw new Error('Plusieurs associations Mozaïk existent pour ce travail. Vérifie ses liens avant l’envoi.');
      s.linkedActivity=linked[0]?.activityId || '';
      const available=linked.length ? linked : s.rows.filter(row=>row.selectable);
      s.destinationOptions=available.map(row=>row.activityId);
      if (!linked.length) s.destinationOptions.push('__create__');
      s.destination=s.linkedActivity;
      const ordered=[...available].sort((a,b)=>String(b.metadata?.activityDate||'').localeCompare(String(a.metadata?.activityDate||'')) || String(a.title).localeCompare(String(b.title),'fr',{numeric:true}));
      el('gestionImportsScope').textContent=`Groupe ${s.group} · ${state.currentAssignment.title} · Année ${s.scope.schoolYear}`;
      el('gestionImportsContent').innerHTML='<p>Choisis le travail qui recevra les notes. Son titre peut être différent de celui dans Gestion.</p><label class="field-label" for="mozaikDestination">Travail dans Mozaïk</label><select id="mozaikDestination" class="select" data-destination="1">'+
        (linked.length?'':'<option value="">Choisir un travail…</option>')+ordered.map(row=>`<option value="${esc(row.activityId)}"${row.activityId===s.destination?' selected':''}>${esc(row.title)} · ${esc(row.metadata?.activityDate||'Date à compléter')} · Étape ${esc(row.metadata?.term??'—')} · ${esc(row.metadata?.maxScore??'—')} points</option>`).join('')+
        (linked.length?'':'<option value="__create__">＋ Créer un nouveau travail dans Mozaïk</option>')+'</select><p class="muted">'+(linked.length?'Association existante retrouvée. ':'')+'L’aperçu suivant montrera les changements de paramètres et de notes avant leur envoi.</p>';
      el('gestionImportsSubmit').textContent='Continuer vers l’aperçu';
    } catch(e) {error(s,e);} finally {if(valid(s)){s.busy=false;updateButton(s);}}
  }
  function chooseMozaikDestination(assignmentId) {
    if (state.currentAssignment?.id !== assignmentId || state.currentAssignment.groups?.length !== 1 || String(state.currentAssignment.groups[0]) !== String(state.detailGroup || state.dashboardGroup)) return Promise.reject(new Error('Choisis un travail indépendant du bon groupe.'));
    const s=create('destination','Destination dans Mozaïk');s.assignmentId=assignmentId;
    const promise=new Promise(resolve=>{s.resolveDestination=resolve;});
    loadDestination(s);
    return promise;
  }
  window.CardinalGestionImports = {openMozaik, splitCurrent, resolveOldWork, chooseMozaikDestination};
  if (el('importMozaikWorks')) el('importMozaikWorks').onclick = openMozaik;
  if (el('splitAssignmentBtn')) el('splitAssignmentBtn').onclick = splitCurrent;
})();
