import { api, clearSession, escapeHtml, formatDate, requireBootstrap } from './api.js';

const content = document.querySelector('#teacher-content');
const toast = document.querySelector('#toast');
let state;
let activeTab = 'overview';
let liveTimer;

document.querySelector('#logout').addEventListener('click', () => {
  clearSession();
  location.href = './';
});

document.querySelector('.teacher-tabs').addEventListener('click', event => {
  const button = event.target.closest('[data-tab]');
  if (!button) return;
  activeTab = button.dataset.tab;
  document.querySelectorAll('[data-tab]').forEach(item => item.classList.toggle('active', item === button));
  render();
  startLiveUpdates();
});

try {
  state = await requireBootstrap('enseignant');
  const name = state.user.name || state.user.email;
  document.querySelector('#user-name').textContent = name;
  document.querySelector('#user-avatar').textContent = name.slice(0, 1).toLocaleUpperCase('fr');
  document.querySelector('#preview-banner').hidden = !state.preview;
  render();
} catch (error) {
  content.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
}

function render() {
  if (activeTab === 'overview') renderOverview();
  if (activeTab === 'assignments') renderAssignments();
  if (activeTab === 'groups') renderGroups();
  if (activeTab === 'catalog') renderCatalog();
}

function renderOverview() {
  const results = state.results || {};
  const assignments = state.assignments || [];
  content.innerHTML = `
    <div class="stats-grid">
      ${statCard('Remises', results.remises || 0)}
      ${statCard('Moyenne', `${results.average || 0} %`)}
      ${statCard('Élèves actifs', results.activeStudents || 0)}
    </div>
    <section class="surface">
      <div class="surface-heading"><h2>Affectations en cours</h2>${state.sheetUrl ? `<a class="text-button" href="${escapeHtml(state.sheetUrl)}" target="_blank" rel="noopener">Ouvrir le tableau Sheets ↗</a>` : ''}</div>
      ${assignmentTable(assignments)}
    </section>
    <section class="surface live-surface">
      <div class="surface-heading"><div><h2>Progression en direct</h2><p class="live-copy"><span class="live-dot"></span><span id="live-status">À jour maintenant</span></p></div><span>Une ligne par élève et par exercice</span></div>
      ${progressTable(state.progress || [])}
    </section>`;
}

function progressTable(progress) {
  if (!progress.length) return '<div class="empty-state">Les résultats apparaîtront ici dès qu’un élève terminera un exercice.</div>';
  return `<div class="table-scroll"><table class="data-table progress-table"><thead><tr><th>Élève</th><th>Groupe</th><th>Activité</th><th>Exercice</th><th>Résultat</th><th>Copie</th></tr></thead><tbody>${progress.map(item=>`<tr><td data-label="Élève"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.email)}</small></td><td data-label="Groupe">${escapeHtml((item.groups||[]).join(', '))}</td><td data-label="Activité">${escapeHtml(item.assignmentTitle)}</td><td data-label="Exercice">${escapeHtml(item.exerciseLabel || `Exercice ${item.exerciseId}`)}<small>${escapeHtml(formatDate(item.timestamp)||'Maintenant')}</small></td><td data-label="Résultat"><span class="result-pill ${item.percentage>=60?'result-ok':'result-help'}">${item.score}/${item.total} · ${item.percentage} %</span></td><td data-label="Copie"><a class="text-button" href="copie.html?email=${encodeURIComponent(item.email)}&assignment=${encodeURIComponent(item.assignmentId)}">Voir la copie →</a></td></tr>`).join('')}</tbody></table></div>`;
}

function startLiveUpdates() {
  clearInterval(liveTimer);
  if (state.preview) return;
  liveTimer=setInterval(async()=>{if(document.hidden||activeTab!=='overview')return;try{const fresh=await api('dashboard');state.results=fresh.results;state.progress=fresh.progress;state.updatedAt=fresh.updatedAt;renderOverview();}catch{}},5000);
}

function statCard(label, value) {
  return `<div class="surface stat-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function assignmentTable(assignments) {
  if (!assignments.length) return '<div class="empty-state">Aucune affectation.</div>';
  return `<table class="data-table"><thead><tr><th>Titre</th><th>Mode</th><th>Groupes</th><th>Échéance</th></tr></thead><tbody>${assignments.map(item => `
    <tr><td><strong>${escapeHtml(item.title)}</strong></td><td>${item.mode === 'evaluation' ? 'Évaluation' : 'Formatif'}</td><td>${escapeHtml((item.groupCodes || []).join(', '))}</td><td>${escapeHtml(formatDate(item.dueAt) || '—')}</td></tr>`).join('')}</tbody></table>`;
}

function renderAssignments() {
  const groupOptions = (state.groups || []).map(group => `<option value="${escapeHtml(group.code)}">${escapeHtml(group.name)}</option>`).join('');
  content.innerHTML = `
    <section class="surface">
      <div class="surface-heading"><h2>Nouvelle affectation</h2><span id="selection-count" class="tag-chip mode-formatif">0 dossier</span></div>
      <form id="assignment-form" class="form-grid">
        <div class="form-field"><label for="assignment-title">Titre</label><input id="assignment-title" name="title" required placeholder="Ex. Révision du récit narratif"></div>
        <div class="form-field"><label for="assignment-group">Groupe</label><select id="assignment-group" name="groupCode" required><option value="">Choisir…</option>${groupOptions}</select></div>
        <div class="form-field"><label for="assignment-mode">Mode</label><select id="assignment-mode" name="mode"><option value="formatif">Formatif avec rétroaction</option><option value="evaluation">Évaluation</option></select></div>
        <div class="form-field"><label for="assignment-due">Échéance</label><input id="assignment-due" name="dueAt" type="datetime-local"></div>
        <div class="form-field"><label for="assignment-attempts">Tentatives</label><input id="assignment-attempts" name="attempts" type="number" min="1" max="20" value="3"></div>
        <div class="form-field"><label for="assignment-feedback">Correction</label><select id="assignment-feedback" name="feedback"><option value="true">Afficher en mode formatif</option><option value="false">Masquer</option></select></div>
        <div class="form-field full"><label for="matrix-search">Exercices</label><input id="matrix-search" class="search-input" type="search" placeholder="Chercher une notion ou un dossier"><div id="matrix-picker" class="catalog-picker"></div></div>
        <div class="form-field full"><button class="button button-primary" type="submit">Assigner les exercices →</button></div>
      </form>
    </section>`;

  const selected = new Set();
  const picker = document.querySelector('#matrix-picker');
  const search = document.querySelector('#matrix-search');
  const renderPicker = () => {
    const query = search.value.trim().toLocaleLowerCase('fr');
    const matrices = state.catalog.matrices.filter(matrix => !query || `${matrix.label} ${matrix.hierarchy}`.toLocaleLowerCase('fr').includes(query));
    picker.innerHTML = matrices.map(matrix => `
      <label class="catalog-row"><input type="checkbox" value="${escapeHtml(matrix.id)}" ${selected.has(matrix.id) ? 'checked' : ''}><span><strong>${escapeHtml(matrix.label)}</strong><small>${escapeHtml(matrix.hierarchy)}</small></span><small>${matrix.exerciseCount}</small></label>`).join('');
  };
  renderPicker();
  search.addEventListener('input', renderPicker);
  picker.addEventListener('change', event => {
    if (event.target.checked) selected.add(event.target.value); else selected.delete(event.target.value);
    document.querySelector('#selection-count').textContent = `${selected.size} dossier${selected.size > 1 ? 's' : ''}`;
  });
  document.querySelector('#assignment-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (!selected.size) return showToast('Choisis au moins un dossier.');
    const values = Object.fromEntries(new FormData(event.currentTarget));
    await save('saveAssignment', {
      assignment: {
        ...values,
        matrixIds: [...selected],
        groupCodes: [values.groupCode],
        attempts: Number(values.attempts),
        feedback: values.feedback === 'true',
      },
    }, 'Affectation enregistrée.');
  });
}

function renderGroups() {
  content.innerHTML = `
    <div class="form-grid">
      <section class="surface">
        <div class="surface-heading"><h2>Créer un groupe</h2></div>
        <form id="group-form" class="form-grid">
          <div class="form-field"><label for="group-code">Code</label><input id="group-code" name="code" required placeholder="301"></div>
          <div class="form-field"><label for="group-name">Nom</label><input id="group-name" name="name" required placeholder="Français 301"></div>
          <div class="form-field full"><button class="button button-primary" type="submit">Ajouter le groupe</button></div>
        </form>
      </section>
      <section class="surface">
        <div class="surface-heading"><h2>Importer des courriels</h2></div>
        <form id="users-form" class="form-grid">
          <div class="form-field"><label for="users-group">Groupe</label><select id="users-group" name="groupCode" required>${(state.groups || []).map(group => `<option value="${escapeHtml(group.code)}">${escapeHtml(group.name)}</option>`).join('')}</select></div>
          <div class="form-field"><label for="users-role">Rôle</label><select id="users-role" name="role"><option value="eleve">Élève</option><option value="enseignant">Enseignant</option></select></div>
          <div class="form-field full"><label for="emails">Un courriel par ligne</label><textarea id="emails" name="emails" required placeholder="prenom.nom@ecole.ca"></textarea></div>
          <div class="form-field full"><button class="button button-primary" type="submit">Importer la liste</button></div>
        </form>
      </section>
    </div>
    <section class="surface"><div class="surface-heading"><h2>Groupes</h2></div>${groupTable()}</section>`;

  document.querySelector('#group-form').addEventListener('submit', async event => {
    event.preventDefault();
    await save('saveGroup', { group: Object.fromEntries(new FormData(event.currentTarget)) }, 'Groupe enregistré.');
  });
  document.querySelector('#users-form').addEventListener('submit', async event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const emails = values.emails.split(/[\n,;]+/).map(value => value.trim().toLowerCase()).filter(Boolean);
    await save('importUsers', { groupCode: values.groupCode, role: values.role, emails }, `${emails.length} adresse${emails.length > 1 ? 's' : ''} importée${emails.length > 1 ? 's' : ''}.`);
  });
}

function groupTable() {
  return `<table class="data-table"><thead><tr><th>Code</th><th>Groupe</th><th>Élèves</th></tr></thead><tbody>${(state.groups || []).map(group => `<tr><td>${escapeHtml(group.code)}</td><td>${escapeHtml(group.name)}</td><td>${Number(group.students) || 0}</td></tr>`).join('')}</tbody></table>`;
}

function renderCatalog() {
  content.innerHTML = `<section class="surface"><div class="surface-heading"><h2>Banque d’activités</h2><span>Choisis une notion à travailler</span></div><input id="catalog-search" class="search-input" type="search" placeholder="Chercher une notion"><div id="catalog-list" class="catalog-picker"></div></section>`;
  const search = document.querySelector('#catalog-search');
  const list = document.querySelector('#catalog-list');
  const draw = () => {
    const query = search.value.trim().toLocaleLowerCase('fr');
    list.innerHTML = state.catalog.matrices.filter(matrix => !query || matrix.hierarchy.toLocaleLowerCase('fr').includes(query)).map(matrix => `<div class="catalog-row"><span class="tag-chip mode-formatif">${matrix.exerciseCount}</span><span><strong>${escapeHtml(matrix.label)}</strong><small>${escapeHtml(matrix.hierarchy)}</small></span><small>${escapeHtml(matrix.types.join(' · '))}</small></div>`).join('');
  };
  search.addEventListener('input', draw);
  draw();
}

async function save(action, payload, successMessage) {
  try {
    const response = await api(action, payload);
    state = await api('bootstrap');
    if (!state.catalog) state.catalog = await fetch('data/catalog.json').then(result => result.json());
    showToast(response.message || successMessage);
    render();
  } catch (error) {
    showToast(error.message);
  }
}

function showToast(text) {
  toast.textContent = text;
  toast.hidden = false;
  setTimeout(() => { toast.hidden = true; }, 3600);
}
