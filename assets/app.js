const config = window.ATELIER_CONFIG || {};

const emailForm = document.querySelector('#email-form');
const codeForm = document.querySelector('#code-form');
const emailInput = document.querySelector('#email');
const codeInput = document.querySelector('#code');
const message = document.querySelector('#form-message');
const changeEmailButton = document.querySelector('#change-email');
const connectionLabel = document.querySelector('#connection-label');
const previewActions = document.querySelector('#preview-actions');

let pendingEmail = '';

function setMessage(text = '', type = '') {
  message.textContent = text;
  message.className = `form-message${type ? ` ${type}` : ''}`;
}

function setBusy(form, busy) {
  for (const element of form.elements) element.disabled = busy;
}

async function callApi(action, payload = {}) {
  if (!config.backendUrl) {
    throw new Error('Le portail de connexion n’est pas encore ouvert. Utilise le mode aperçu pour le moment.');
  }

  const response = await fetch(config.backendUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await response.json();
  if (!data.ok) throw new Error(data.message || 'La demande a échoué.');
  return data;
}

emailForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!emailForm.reportValidity()) return;
  pendingEmail = emailInput.value.trim().toLowerCase();
  setBusy(emailForm, true);
  setMessage('Ouverture de ta session…');

  try {
    const data = await callApi('loginWithEmail', { email: pendingEmail });
    if (data.needsPassword) {
      emailForm.hidden = true;
      codeForm.hidden = false;
      codeInput.focus();
      setMessage('Entre ton mot de passe enseignant.', 'success');
    } else {
      sessionStorage.setItem('atelier_session', data.token);
      location.href = 'eleve.html';
    }
  } catch (error) {
    setMessage(error.message, 'error');
  } finally {
    setBusy(emailForm, false);
  }
});

codeForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!codeForm.reportValidity()) return;
  setBusy(codeForm, true);
  setMessage('Vérification du code…');

  try {
    const data = await callApi('verifyTeacherPassword', { email: pendingEmail, password: codeInput.value });
    sessionStorage.setItem('atelier_session', data.token);
    location.href = data.user.role === 'enseignant' ? 'enseignant.html' : 'eleve.html';
  } catch (error) {
    setMessage(error.message, 'error');
  } finally {
    setBusy(codeForm, false);
  }
});

changeEmailButton.addEventListener('click', () => {
  codeForm.hidden = true;
  emailForm.hidden = false;
  codeInput.value = '';
  setMessage();
  emailInput.focus();
});

async function loadCatalogSummary() {
  try {
    const response = await fetch('data/catalog.json');
    const catalog = await response.json();
    const roots = [...new Set(catalog.matrices.map(matrix => matrix.path[0]).filter(Boolean))].slice(0, 4);
    document.querySelector('#topic-ribbon').innerHTML = roots.map(root => `<span>${escapeHtml(root)}</span>`).join('');
  } catch {
    connectionLabel.textContent = 'Portail scolaire';
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

loadCatalogSummary();

if (['127.0.0.1', 'localhost'].includes(location.hostname)) {
  previewActions.hidden = false;
  connectionLabel.textContent = 'Mode aperçu local';
}
