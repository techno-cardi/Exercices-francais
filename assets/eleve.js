import { clearSession, escapeHtml, formatDate, requireBootstrap } from './api.js';

const grid = document.querySelector('#assignment-grid');
const logout = document.querySelector('#logout');

logout.addEventListener('click', () => {
  clearSession();
  location.href = './';
});

try {
  const data = await requireBootstrap('eleve');
  const firstName = (data.user.name || data.user.email).split(/[\s.@]/)[0];
  document.querySelector('#user-name').textContent = data.user.name || data.user.email;
  document.querySelector('#user-group').textContent = (data.user.groups || []).join(' · ') || 'Aucun groupe';
  document.querySelector('#user-avatar').textContent = firstName.slice(0, 1).toLocaleUpperCase('fr');
  document.querySelector('#greeting').textContent = `Bonjour, ${firstName}!`;
  document.querySelector('#preview-banner').hidden = !data.preview;
  renderAssignments(data.assignments || [], data.catalog);
} catch (error) {
  grid.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
}

function renderAssignments(assignments, catalog) {
  if (!assignments.length) {
    grid.innerHTML = '<div class="empty-state">Ton enseignant ne t’a pas encore assigné d’activité.</div>';
    return;
  }

  grid.innerHTML = assignments.map(assignment => {
    const total = assignment.total || countExercises(assignment, catalog);
    const completed = Math.min(Number(assignment.completed) || 0, total);
    const percentage = total ? Math.round(completed / total * 100) : 0;
    const firstMatrix = assignment.matrixIds?.[0] || '';
    const due = formatDate(assignment.dueAt);
    const modeLabel = assignment.mode === 'evaluation' ? 'Évaluation' : 'Formatif';

    return `
      <article class="assignment-card">
        <div class="assignment-card-top">
          <span class="mode-badge mode-${escapeHtml(assignment.mode)}">${modeLabel}</span>
          <small>${assignment.matrixIds?.length || 1} activité${(assignment.matrixIds?.length || 1) > 1 ? 's' : ''} · ${total} question${total > 1 ? 's' : ''}</small>
        </div>
        <div>
          <h2>${escapeHtml(assignment.title)}</h2>
          <p>${assignment.mode === 'evaluation' ? 'Les corrections apparaîtront selon les réglages de ton enseignant.' : 'Tu recevras une rétroaction après chaque réponse.'}</p>
        </div>
        <div>
          <div class="progress-track" aria-label="Progression : ${percentage} %"><span style="width:${percentage}%"></span></div>
          <div class="progress-copy"><span>${completed} terminé${completed > 1 ? 's' : ''}</span><span>${percentage} %</span></div>
        </div>
        <div class="assignment-footer">
          <small>${due ? `À remettre le ${escapeHtml(due)}` : 'Aucune date limite'}</small>
          <a class="button button-primary button-small" href="exercice.html?assignment=${encodeURIComponent(assignment.id)}&matrix=${encodeURIComponent(firstMatrix)}">${completed ? 'Continuer' : 'Commencer'} →</a>
        </div>
      </article>`;
  }).join('');
}

function countExercises(assignment, catalog) {
  if (assignment.exerciseIds?.length) return assignment.exerciseIds.length;
  const selected = new Set(assignment.matrixIds || []);
  return (catalog?.matrices || []).reduce((sum, matrix) => sum + (selected.has(matrix.id) ? matrix.exerciseCount : 0), 0);
}
