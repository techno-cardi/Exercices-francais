import { api, clearSession, escapeHtml, formatDate, requireBootstrap } from './api.js?v=20260831-2';

const content = document.querySelector('#teacher-content');
const toast = document.querySelector('#toast');
const matrixCache = new Map();
const matrixRequests = new Map();
const activitySelection = new Set();
const expandedMatrices = new Set();
let state;
let activeTab = 'overview';
let liveTimer;
let liveGeneration = 0;
let catalogOpenId = '';
let catalogCategory = 'Toutes';
let overviewFilters = { search:'', group:'', assignment:'', status:'' };
let assignmentVisibleCount = 12;
let catalogVisibleCount = 18;

document.querySelector('#logout').addEventListener('click', () => { clearSession(); location.href = './'; });
document.querySelector('.teacher-tabs').addEventListener('click', event => {
  const button = event.target.closest('[data-tab]');
  if (button) { event.preventDefault(); switchTab(button.dataset.tab); }
});

try {
  state = await requireBootstrap('enseignant');
  const name = state.user.name || state.user.email;
  document.querySelector('#user-name').textContent = name;
  document.querySelector('#user-avatar').textContent = name.slice(0, 1).toLocaleUpperCase('fr');
  document.querySelector('#preview-banner').hidden = !state.preview;
  render();
  startLiveUpdates();
} catch (error) {
  content.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
}

function switchTab(tab) {
  liveGeneration += 1;
  activeTab = tab;
  document.querySelectorAll('[data-tab]').forEach(item => item.classList.toggle('active', item.dataset.tab === tab));
  render();
  startLiveUpdates();
}

function render() {
  if (activeTab === 'overview') renderOverview();
  if (activeTab === 'assignments') renderAssignments();
  if (activeTab === 'groups') renderGroups();
  if (activeTab === 'catalog') renderCatalog();
}

function renderOverview() {
  const results = state.results || {};
  content.innerHTML = `
    <section class="command-hero">
      <div><span class="live-kicker"><i></i> Suivi actif</span><h2>Ta classe, en un coup d’œil.</h2><p>Les réponses apparaissent ici pendant que les élèves travaillent.</p></div>
      <button class="button button-primary" id="new-assignment" type="button">+ Nouvelle affectation</button>
    </section>
    <div id="overview-stats" class="stats-grid stats-grid-four">
      ${statCard('Élèves actifs maintenant', results.activeNow || 0, 'live')}
      ${statCard('Exercices en cours', results.inProgress || 0)}
      ${statCard('Exercices remis', results.remises || 0)}
      ${statCard('Moyenne des remises', `${results.average || 0} %`)}
    </div>
    <section class="surface live-surface">
      <div class="surface-heading"><div><h2>Suivi en direct</h2><p class="live-copy"><span class="live-dot"></span><span id="live-status">Actualisé automatiquement</span></p></div>${state.sheetUrl ? `<a class="text-button" href="${escapeHtml(state.sheetUrl)}" target="_blank" rel="noopener">Ouvrir le tableau Google ↗</a>` : ''}</div>
      <div class="live-filters">
        <input id="progress-search" class="search-input" type="search" placeholder="Chercher un élève" value="${escapeHtml(overviewFilters.search)}">
        <select id="progress-group"><option value="">Tous les groupes</option>${(state.groups||[]).map(group=>`<option value="${escapeHtml(group.code)}" ${overviewFilters.group===String(group.code)?'selected':''}>${escapeHtml(group.name)}</option>`).join('')}</select>
        <select id="progress-assignment"><option value="">Toutes les affectations</option>${(state.assignments||[]).map(item=>`<option value="${escapeHtml(item.id)}" ${overviewFilters.assignment===String(item.id)?'selected':''}>${escapeHtml(item.title)}</option>`).join('')}</select>
        <select id="progress-status"><option value="">Tous les états</option><option value="en_cours" ${overviewFilters.status==='en_cours'?'selected':''}>En cours</option><option value="corrige" ${overviewFilters.status==='corrige'?'selected':''}>Corrigés</option></select>
      </div>
      <div id="progress-results">${progressTable(filteredProgress())}</div>
    </section>
    <section class="surface assignments-surface">
      <div class="surface-heading"><div><h2>Affectations</h2><p>Ce que chaque groupe voit actuellement.</p></div><button class="text-button" id="manage-assignments" type="button">Gérer les affectations →</button></div>
      ${assignmentCards(state.assignments || [])}
    </section>`;

  document.querySelector('#new-assignment').addEventListener('click', () => switchTab('assignments'));
  document.querySelector('#manage-assignments').addEventListener('click', () => switchTab('assignments'));
  for (const id of ['progress-search','progress-group','progress-assignment','progress-status']) {
    document.querySelector(`#${id}`).addEventListener(id === 'progress-search' ? 'input' : 'change', updateProgressFilters);
  }
  content.querySelectorAll('[data-preview-assignment]').forEach(button => button.addEventListener('click', () => {
    const item = (state.assignments||[]).find(entry=>String(entry.id)===button.dataset.previewAssignment);
    if(item){
      const matrixId=item.matrixIds?.[0];
      const matrix=state.catalog.matrices.find(entry=>String(entry.id)===String(matrixId));
      openPreview(matrixId,'',item.mode,item.title);
    }
  }));
}

function updateProgressFilters() {
  overviewFilters = { search:document.querySelector('#progress-search').value, group:document.querySelector('#progress-group').value, assignment:document.querySelector('#progress-assignment').value, status:document.querySelector('#progress-status').value };
  document.querySelector('#progress-results').innerHTML = progressTable(filteredProgress());
}

function filteredProgress() {
  const query=overviewFilters.search.trim().toLocaleLowerCase('fr');
  return (state.progress||[]).filter(item=>(!query||`${item.name} ${item.email}`.toLocaleLowerCase('fr').includes(query))&&(!overviewFilters.group||(item.groups||[]).map(String).includes(overviewFilters.group))&&(!overviewFilters.assignment||String(item.assignmentId)===overviewFilters.assignment)&&(!overviewFilters.status||item.status===overviewFilters.status));
}

function progressTable(progress) {
  if (!progress.length) return '<div class="empty-state compact-empty">Aucune activité ne correspond à ces filtres. Les élèves apparaîtront ici dès qu’ils ouvriront un exercice.</div>';
  return `<div class="table-scroll"><table class="data-table progress-table"><thead><tr><th>Élève</th><th>Groupe</th><th>Affectation</th><th>Exercice</th><th>État</th><th>Copie</th></tr></thead><tbody>${progress.map(item=>{
    const inProgress=item.status==='en_cours';
    return `<tr class="${inProgress?'row-live':''}"><td data-label="Élève"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.email)}</small></td><td data-label="Groupe">${escapeHtml((item.groups||[]).join(', '))}</td><td data-label="Affectation">${escapeHtml(item.assignmentTitle)}</td><td data-label="Exercice"><strong>${escapeHtml(item.exerciseLabel || `Exercice ${item.exerciseId}`)}</strong><small>${escapeHtml(formatDate(item.timestamp)||'Maintenant')}</small></td><td data-label="État">${inProgress?`<span class="status-pill status-working"><i></i> En cours · ${item.answered}/${item.total}</span>`:`<span class="result-pill ${item.percentage>=60?'result-ok':'result-help'}">${item.score}/${item.total} · ${item.percentage} %</span>`}</td><td data-label="Copie"><a class="text-button" href="copie.html?email=${encodeURIComponent(item.email)}&assignment=${encodeURIComponent(item.assignmentId)}&live=1">${inProgress?'Voir maintenant':'Voir la copie'} →</a></td></tr>`;
  }).join('')}</tbody></table></div>`;
}

function statCard(label, value, accent='') { return `<div class="surface stat-card ${accent?'stat-live':''}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`; }

function assignmentCards(assignments) {
  if(!assignments.length)return '<div class="empty-state compact-empty">Aucune affectation active. Crée-en une pour commencer.</div>';
  return `<div class="teacher-assignment-grid">${assignments.map(item=>{
    const activities=item.matrixIds?.length||0,questions=item.exerciseIds?.length||item.matrixIds?.reduce((sum,id)=>sum+(state.catalog.matrices.find(matrix=>String(matrix.id)===String(id))?.exerciseCount||0),0)||0;
    return `<article class="teacher-assignment-card"><div class="assignment-card-top"><span class="mode-badge mode-${item.mode}">${item.mode==='evaluation'?'Évaluation':'Formatif'}</span><span class="assignment-count">${activities} activité${activities>1?'s':''} · ${questions} question${questions>1?'s':''}</span></div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml((item.groupCodes||[]).join(' · '))}${item.dueAt?` · jusqu’au ${escapeHtml(formatDate(item.dueAt))}`:''}</p><div class="assignment-card-actions"><button class="button button-secondary button-small" data-preview-assignment="${escapeHtml(item.id)}" type="button">Voir comme un élève</button></div></article>`;
  }).join('')}</div>`;
}

function startLiveUpdates() {
  clearInterval(liveTimer);
  if (state?.preview || activeTab !== 'overview') return;
  const generation=liveGeneration;
  liveTimer=setInterval(async()=>{if(document.hidden||activeTab!=='overview')return;try{const fresh=await api('dashboard');if(generation!==liveGeneration||activeTab!=='overview'||document.querySelector('[data-tab].active')?.dataset.tab!=='overview')return;state.results=fresh.results;state.progress=fresh.progress;state.updatedAt=fresh.updatedAt;updateLiveOverview();}catch{}},3000);
}

function updateLiveOverview(){
  const stats=document.querySelector('#overview-stats');
  if(stats){const results=state.results||{};stats.innerHTML=`${statCard('Élèves actifs maintenant',results.activeNow||0,'live')}${statCard('Exercices en cours',results.inProgress||0)}${statCard('Exercices remis',results.remises||0)}${statCard('Moyenne des remises',`${results.average||0} %`)}`;}
  const table=document.querySelector('#progress-results');if(table)table.innerHTML=progressTable(filteredProgress());
  const status=document.querySelector('#live-status');if(status)status.textContent=`Actualisé à ${formatDate(state.updatedAt)||'l’instant'}`;
}

function renderAssignments() {
  const groups=state.groups||[];
  content.innerHTML=`
    <section class="assignment-builder">
      <div class="builder-intro"><div><p class="eyebrow">Nouvelle affectation</p><h2>Choisis exactement ce que les élèves feront.</h2><p>Chaque activité peut contenir plusieurs questions. Sélectionne les activités, puis décide du type de correction.</p></div><div id="selection-count" class="selection-counter">${activitySelection.size}<small>activité${activitySelection.size>1?'s':''}</small></div></div>
      <form id="assignment-form">
        <section class="surface builder-settings">
          <div class="surface-heading"><h3>1. Paramètres</h3><span>Nom, groupes et mode</span></div>
          <div class="form-grid">
            <div class="form-field full"><label for="assignment-title">Titre visible par les élèves</label><input id="assignment-title" name="title" required placeholder="Ex. Révision – classes de mots"></div>
            <fieldset class="form-field full group-choice"><legend>Groupes</legend><div class="choice-grid">${groups.map(group=>`<label><input type="checkbox" name="groupCode" value="${escapeHtml(group.code)}"><span><strong>${escapeHtml(group.name)}</strong><small>${group.students} élève${group.students>1?'s':''}</small></span></label>`).join('')}</div></fieldset>
            <div class="form-field"><label for="assignment-mode">Mode</label><select id="assignment-mode" name="mode"><option value="formatif">Formatif avec rétroaction</option><option value="evaluation">Évaluation</option></select></div>
            <div class="form-field"><label for="assignment-attempts">Tentatives permises</label><input id="assignment-attempts" name="attempts" type="number" min="1" max="20" value="3"></div>
            <div class="form-field"><label for="assignment-start">Ouverture</label><input id="assignment-start" name="startAt" type="datetime-local"></div>
            <div class="form-field"><label for="assignment-due">Échéance</label><input id="assignment-due" name="dueAt" type="datetime-local"></div>
            <div class="form-field full"><label for="assignment-feedback">Après la remise</label><select id="assignment-feedback" name="feedback"><option value="true">Afficher les réussites en mode formatif</option><option value="false">Garder la correction cachée</option></select></div>
          </div>
        </section>
        <section class="surface builder-content">
          <div class="surface-heading"><div><h3>2. Activités</h3><p>Chaque carte correspond à une activité complète et à toutes ses questions.</p></div><input id="matrix-search" class="search-input" type="search" placeholder="Chercher une activité"></div>
          <div id="matrix-picker" class="matrix-picker"></div>
        </section>
        <div class="builder-submit"><div><strong id="submit-summary">${activitySelection.size} activité sélectionnée</strong><small>Tu pourras suivre les réponses dès l’ouverture.</small></div><button class="button button-primary" type="submit">Assigner aux groupes →</button></div>
      </form>
    </section>`;

  const search=document.querySelector('#matrix-search');
  search.addEventListener('input',()=>{assignmentVisibleCount=12;drawAssignmentPicker();});
  document.querySelector('#matrix-picker').addEventListener('click',handlePickerClick);
  document.querySelector('#matrix-picker').addEventListener('change',handlePickerChange);
  document.querySelector('#assignment-form').addEventListener('submit',submitAssignment);
  drawAssignmentPicker();
}

function drawAssignmentPicker() {
  const picker=document.querySelector('#matrix-picker');if(!picker)return;
  const query=document.querySelector('#matrix-search').value.trim().toLocaleLowerCase('fr');
  const matches=state.catalog.matrices.filter(matrix=>!query||`${matrix.number||''} ${matrix.label} ${matrix.themeLabel||''} ${matrix.hierarchy}`.toLocaleLowerCase('fr').includes(query)),matrices=matches.slice(0,assignmentVisibleCount);
  picker.innerHTML=matrices.map(matrix=>{
    const questions=(matrix.exerciseIds||[]).length,selected=activitySelection.has(String(matrix.id)),expanded=expandedMatrices.has(String(matrix.id)),loaded=matrixCache.get(String(matrix.id));
    return `<article class="matrix-select-card ${selected?'has-selection':''}"><div class="matrix-select-head"><label class="matrix-check"><input type="checkbox" data-matrix-check="${escapeHtml(matrix.id)}" ${selected?'checked':''}><span><strong>${escapeHtml(matrix.displayLabel||matrix.label)}</strong><small>Activité complète · ${questions} question${questions>1?'s':''} · Thème ${escapeHtml(matrix.themeNumber||'')}</small></span></label><span class="matrix-selected">${selected?'Sélectionnée':'Disponible'}</span><button class="text-button" data-expand-matrix="${escapeHtml(matrix.id)}" type="button">${expanded?'Refermer':'Voir les questions'}</button></div>${expanded?`<div class="exercise-picker-list">${loaded?exercisePickerRows(loaded):'<div class="picker-loading"><span class="loading-spinner" aria-hidden="true"></span><span>Chargement des questions…</span></div>'}</div>`:''}</article>`;
  }).join('')+(matches.length>matrices.length?`<button class="button button-secondary load-more" data-load-more type="button">Afficher ${Math.min(12,matches.length-matrices.length)} notions de plus</button>`:'')||'<div class="empty-state compact-empty">Aucune notion trouvée.</div>';
  picker.querySelectorAll('[data-matrix-check]').forEach(input=>{input.indeterminate=false;});
  updateSelectionCounter();
}

function exercisePickerRows(matrix) {
  return matrix.exercises.map((exercise,index)=>`<div class="exercise-pick-row"><span><strong>Question ${escapeHtml(exercise.number||`${matrix.number||''}.${index+1}`)}</strong><small>${escapeHtml(plainText(exercise.title)||matrix.label)} · ${escapeHtml((exercise.types||[]).join(' · '))}</small></span><button class="button button-secondary button-small" data-preview-exercise="${escapeHtml(exercise.id)}" data-matrix-id="${escapeHtml(matrix.id)}" type="button">Voir la question</button></div>`).join('');
}

async function handlePickerClick(event) {
  const more=event.target.closest('[data-load-more]');if(more){assignmentVisibleCount+=12;drawAssignmentPicker();return;}
  const expand=event.target.closest('[data-expand-matrix]');if(expand){const id=expand.dataset.expandMatrix;if(expandedMatrices.has(id)){expandedMatrices.delete(id);drawAssignmentPicker();return;}expandedMatrices.add(id);drawAssignmentPicker();try{await loadMatrix(id);}catch(error){expandedMatrices.delete(id);showToast(error.message);}drawAssignmentPicker();return;}
  const preview=event.target.closest('[data-preview-exercise]');if(preview)openPreview(preview.dataset.matrixId,preview.dataset.previewExercise,'formatif','Aperçu de la banque');
}

function handlePickerChange(event) {
  const matrixId=event.target.dataset.matrixCheck;if(matrixId){if(event.target.checked)activitySelection.add(String(matrixId));else activitySelection.delete(String(matrixId));drawAssignmentPicker();}
}

function updateSelectionCounter(){const count=activitySelection.size,node=document.querySelector('#selection-count'),summary=document.querySelector('#submit-summary');if(node)node.innerHTML=`${count}<small>activité${count>1?'s':''}</small>`;if(summary)summary.textContent=`${count} activité${count>1?'s':''} sélectionnée${count>1?'s':''}`;}

async function submitAssignment(event) {
  event.preventDefault();const form=event.currentTarget,values=Object.fromEntries(new FormData(form)),groupCodes=[...form.querySelectorAll('[name="groupCode"]:checked')].map(input=>input.value);
  if(!groupCodes.length)return showToast('Choisis au moins un groupe.');if(!activitySelection.size)return showToast('Choisis au moins une activité.');
  const matrixIds=[...activitySelection];
  const response=await save('saveAssignment',{assignment:{...values,groupCodes,matrixIds,exerciseIds:[],attempts:Number(values.attempts),feedback:values.feedback==='true'}},'Affectation enregistrée.');
  if(response){activitySelection.clear();showToast('Affectation prête pour les groupes choisis.');switchTab('overview');}
}

function renderGroups() {
  content.innerHTML=`<div class="form-grid"><section class="surface"><div class="surface-heading"><h2>Créer un groupe</h2></div><form id="group-form" class="form-grid"><div class="form-field"><label for="group-code">Code</label><input id="group-code" name="code" required placeholder="31"></div><div class="form-field"><label for="group-name">Nom</label><input id="group-name" name="name" required placeholder="Groupe 31"></div><div class="form-field full"><button class="button button-primary" type="submit">Ajouter le groupe</button></div></form></section><section class="surface"><div class="surface-heading"><h2>Importer des courriels</h2></div><form id="users-form" class="form-grid"><div class="form-field"><label for="users-group">Groupe</label><select id="users-group" name="groupCode" required>${(state.groups||[]).map(group=>`<option value="${escapeHtml(group.code)}">${escapeHtml(group.name)}</option>`).join('')}</select></div><div class="form-field"><label for="users-role">Rôle</label><select id="users-role" name="role"><option value="eleve">Élève</option><option value="enseignant">Enseignant</option></select></div><div class="form-field full"><label for="emails">Un courriel par ligne</label><textarea id="emails" name="emails" required placeholder="prenom.nom@ecole.ca"></textarea></div><div class="form-field full"><button class="button button-primary" type="submit">Importer la liste</button></div></form></section></div><section class="surface"><div class="surface-heading"><h2>Groupes autorisés</h2></div>${groupTable()}</section>`;
  document.querySelector('#group-form').addEventListener('submit',async event=>{event.preventDefault();await save('saveGroup',{group:Object.fromEntries(new FormData(event.currentTarget))},'Groupe enregistré.');});
  document.querySelector('#users-form').addEventListener('submit',async event=>{event.preventDefault();const values=Object.fromEntries(new FormData(event.currentTarget)),emails=values.emails.split(/[\n,;]+/).map(value=>value.trim().toLowerCase()).filter(Boolean);await save('importUsers',{groupCode:values.groupCode,role:values.role,emails},`${emails.length} adresse${emails.length>1?'s':''} importée${emails.length>1?'s':''}.`);});
}

function groupTable(){return `<div class="group-card-grid">${(state.groups||[]).map(group=>`<details class="group-card"><summary><span class="group-code">${escapeHtml(group.code)}</span><span class="group-title"><strong>${escapeHtml(group.name)}</strong><small>${Number(group.students)||0} élève${Number(group.students)>1?'s':''}</small></span><span class="group-open">Voir la liste</span></summary><div class="group-members">${(group.members||[]).length?`<div class="group-member-head"><span>Élève</span><span>Dernière connexion</span></div>${group.members.map(member=>`<div class="group-member"><span><strong>${escapeHtml(member.name)}</strong><small>${escapeHtml(member.email)}</small></span><time>${member.lastLogin?escapeHtml(formatDate(member.lastLogin)):'Jamais connecté'}</time></div>`).join('')}`:'<p class="group-empty">Aucun élève dans ce groupe.</p>'}</div></details>`).join('')}</div>`;}

function renderCatalog() {
  const categories=['Toutes',...new Set(state.catalog.matrices.map(matrix=>matrix.path?.[0]).filter(Boolean))];
  content.innerHTML=`<section class="catalog-hero"><div><p class="eyebrow">Banque d’activités</p><h2>Explore les activités avant de les assigner.</h2><p>Ouvre chaque activité pour voir ses questions et l’écran exact des élèves.</p></div><input id="catalog-search" class="search-input" type="search" placeholder="Chercher une activité, un type ou un mot-clé"></section><div class="category-pills">${categories.map(category=>`<button class="${catalogCategory===category?'active':''}" data-category="${escapeHtml(category)}" type="button">${escapeHtml(category)}</button>`).join('')}</div><div id="catalog-detail"></div><div id="catalog-list" class="catalog-card-grid"></div>`;
  document.querySelector('#catalog-search').addEventListener('input',()=>{catalogVisibleCount=18;drawCatalogCards();});
  document.querySelector('.category-pills').addEventListener('click',event=>{const button=event.target.closest('[data-category]');if(!button)return;catalogCategory=button.dataset.category;catalogOpenId='';catalogVisibleCount=18;renderCatalog();});
  document.querySelector('#catalog-list').addEventListener('click',async event=>{const more=event.target.closest('[data-catalog-more]');if(more){catalogVisibleCount+=18;drawCatalogCards();return;}const button=event.target.closest('[data-open-catalog]');if(!button)return;catalogOpenId=button.dataset.openCatalog;button.disabled=true;button.setAttribute('aria-busy','true');const original=button.textContent;button.textContent='Chargement…';try{await loadMatrix(catalogOpenId);drawCatalogDetail();}catch(error){showToast(error.message);}finally{button.disabled=false;button.removeAttribute('aria-busy');button.textContent=original;}});
  document.querySelector('#catalog-detail').addEventListener('click',handleCatalogDetail);
  drawCatalogCards();drawCatalogDetail();
}

function drawCatalogCards(){const list=document.querySelector('#catalog-list');if(!list)return;const query=document.querySelector('#catalog-search').value.trim().toLocaleLowerCase('fr'),matches=state.catalog.matrices.filter(matrix=>(catalogCategory==='Toutes'||matrix.path?.[0]===catalogCategory)&&(!query||`${matrix.number||''} ${matrix.label} ${matrix.themeLabel||''} ${matrix.hierarchy} ${(matrix.types||[]).join(' ')}`.toLocaleLowerCase('fr').includes(query))),matrices=matches.slice(0,catalogVisibleCount);list.innerHTML=(matrices.map(matrix=>`<article class="catalog-card"><div class="catalog-card-top"><span class="catalog-count">${escapeHtml(matrix.number||matrix.exerciseCount)}</span><span>Thème ${escapeHtml(matrix.themeNumber||'')} · ${matrix.exerciseCount} question${matrix.exerciseCount>1?'s':''}</span></div><h3>${escapeHtml(matrix.label)}</h3><p>${escapeHtml(matrix.themeLabel||matrix.hierarchy)}</p><div class="catalog-types">${(matrix.types||[]).slice(0,3).map(type=>`<span>${escapeHtml(type)}</span>`).join('')}</div><button class="button button-secondary" data-open-catalog="${escapeHtml(matrix.id)}" type="button">Choisir cette activité →</button></article>`).join('')+(matches.length>matrices.length?`<button class="button button-secondary catalog-more" data-catalog-more type="button">Afficher ${Math.min(18,matches.length-matrices.length)} notions de plus</button>`:''))||'<div class="empty-state">Aucune activité trouvée.</div>';}

function drawCatalogDetail(){const host=document.querySelector('#catalog-detail');if(!host)return;const matrix=matrixCache.get(String(catalogOpenId));if(!matrix){host.innerHTML='';return;}host.innerHTML=`<section class="surface catalog-detail"><div class="surface-heading"><div><p class="eyebrow">Thème ${escapeHtml(matrix.themeNumber||'')} · ${escapeHtml(matrix.themeLabel||matrix.hierarchy)}</p><h2>${escapeHtml(matrix.displayLabel||matrix.label)}</h2></div><button class="button button-primary" data-assign-all="${escapeHtml(matrix.id)}" type="button">Assigner cette activité</button></div><div class="catalog-exercise-grid">${matrix.exercises.map((exercise,index)=>`<article><span>Question ${escapeHtml(exercise.number||`${matrix.number||''}.${index+1}`)}</span><h3>${escapeHtml(plainText(exercise.title)||matrix.label)}</h3><p>${escapeHtml((exercise.types||[]).join(' · '))}</p><button class="button button-secondary button-small" data-catalog-preview="${escapeHtml(exercise.id)}" data-matrix-id="${escapeHtml(matrix.id)}" type="button">Voir cette question</button></article>`).join('')}</div></section>`;host.scrollIntoView({behavior:'smooth',block:'start'});}

function handleCatalogDetail(event){const preview=event.target.closest('[data-catalog-preview]');if(preview){openPreview(preview.dataset.matrixId,preview.dataset.catalogPreview,'formatif','Aperçu de la banque');return;}const all=event.target.closest('[data-assign-all]');if(all){activitySelection.add(String(all.dataset.assignAll));switchTab('assignments');}}

async function loadMatrix(id){id=String(id);if(matrixCache.has(id))return matrixCache.get(id);if(matrixRequests.has(id))return matrixRequests.get(id);const request=fetch(`data/matrices/${encodeURIComponent(id)}.json`).then(response=>{if(!response.ok)throw new Error('Cette notion est introuvable.');return response.json();}).then(matrix=>{matrixCache.set(id,matrix);return matrix;}).finally(()=>matrixRequests.delete(id));matrixRequests.set(id,request);return request;}
function plainText(html){const doc=new DOMParser().parseFromString(String(html||''),'text/html');return doc.body.textContent.replace(/\s+/g,' ').trim();}
function openPreview(matrixId,exerciseId='',mode='formatif',title='Aperçu enseignant'){if(!matrixId)return showToast('Aucun exercice à prévisualiser.');const local=['127.0.0.1','localhost'].includes(location.hostname)?'&apercu=1&role=enseignant':'';location.href=`exercice.html?apercu-enseignant=1&matrix=${encodeURIComponent(matrixId)}&mode=${encodeURIComponent(mode)}&title=${encodeURIComponent(title)}${exerciseId?`&exercise=${encodeURIComponent(exerciseId)}`:''}${local}`;}

async function save(action,payload,successMessage){try{const response=await api(action,payload);state=await api('bootstrap');if(!state.catalog)state.catalog=await fetch('data/catalog.json').then(result=>result.json());if(activeTab==='groups')render();showToast(response.message||successMessage);return response;}catch(error){showToast(error.message);return null;}}
function showToast(text){toast.textContent=text;toast.hidden=false;setTimeout(()=>{toast.hidden=true;},3600);}
