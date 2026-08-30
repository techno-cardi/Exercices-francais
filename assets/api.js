const config = window.ATELIER_CONFIG || {};
const localPreview = ['127.0.0.1', 'localhost'].includes(location.hostname)
  && new URLSearchParams(location.search).get('apercu') === '1';

export function getToken() {
  return sessionStorage.getItem('atelier_session') || '';
}

export function clearSession() {
  sessionStorage.removeItem('atelier_session');
}

export function isPreview() {
  return localPreview;
}

export async function api(action, payload = {}) {
  if (localPreview) return previewApi(action, payload);
  if (!config.backendUrl) {
    throw new Error('Le portail de connexion n’est pas encore ouvert.');
  }

  const response = await fetch(config.backendUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, token: getToken(), ...payload }),
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('Le portail ne répond pas pour le moment. Réessaie bientôt.');
  }
  if (!data.ok) {
    if (data.code === 'AUTH_REQUIRED') clearSession();
    throw new Error(data.message || 'La demande a échoué.');
  }
  return data;
}

async function previewApi(action, payload) {
  if (action === 'bootstrap') {
    const catalog = await fetch('data/catalog.json').then(response => response.json());
    const previewRole = new URLSearchParams(location.search).get('role') === 'enseignant' || location.pathname.includes('enseignant') || location.pathname.includes('copie')
      ? 'enseignant'
      : 'eleve';
    const assignments = [
      {
        id: 'apercu-formatif',
        title: 'Récit narratif · notions',
        mode: 'formatif',
        groupCodes: ['301'],
        matrixIds: catalog.matrices.slice(0, 2).map(matrix => matrix.id),
        exerciseIds: [],
        dueAt: '',
        attempts: 3,
        feedback: true,
        completed: 2,
        total: 20,
      },
      {
        id: 'apercu-evaluation',
        title: 'La phrase · vérification',
        mode: 'evaluation',
        groupCodes: ['301'],
        matrixIds: catalog.matrices.slice(28, 30).map(matrix => matrix.id),
        exerciseIds: [],
        dueAt: '',
        attempts: 1,
        feedback: false,
        completed: 0,
        total: 20,
      },
    ];
    return {
      ok: true,
      preview: true,
      user: {
        email: previewRole === 'enseignant' ? 'enseignant@apercu.local' : 'eleve@apercu.local',
        name: previewRole === 'enseignant' ? 'Enseignant' : 'Camille Roy',
        role: previewRole,
        groups: ['301'],
      },
      catalog,
      assignments,
      groups: [
        { code: '301', name: 'Français 301', students: 28 },
        { code: '302', name: 'Français 302', students: 27 },
        { code: '303', name: 'Français 303', students: 29 },
      ],
      users: [],
      results: { remises: 148, average: 76, activeStudents: 72 },
      progress: [
        { timestamp: new Date().toISOString(), email: 'camille.roy@ecole.ca', name: 'Camille Roy', groups: ['301'], assignmentId:'apercu-formatif', assignmentTitle: 'Récit narratif · notions', exerciseLabel: 'Exercice 3 · Le nom', score: 4, total: 5, percentage: 80 },
        { timestamp: new Date(Date.now() - 90000).toISOString(), email: 'malik.gagne@ecole.ca', name: 'Malik Gagné', groups: ['301'], assignmentId:'apercu-formatif', assignmentTitle: 'Récit narratif · notions', exerciseLabel: 'Exercice 4 · Le nom', score: 5, total: 5, percentage: 100 },
        { timestamp: new Date(Date.now() - 180000).toISOString(), email: 'nora.tremblay@ecole.ca', name: 'Nora Tremblay', groups: ['302'], assignmentId:'apercu-evaluation', assignmentTitle: 'La phrase · vérification', exerciseLabel: 'Exercice 2 · La phrase', score: 3, total: 6, percentage: 50 },
      ],
      sheetUrl: '',
    };
  }

  if (action === 'grade') {
    return {
      ok: true,
      preview: true,
      score: 0,
      total: Object.keys(payload.answers || {}).length,
      percentage: 0,
      message: 'Mode aperçu : tes choix sont prêts. La correction sera disponible dans la version en ligne.',
      details: [],
    };
  }

  if (action === 'studentCopy') {
    return { ok:true, preview:true, student:{email:payload.email||'camille.roy@ecole.ca',name:'Camille Roy',groups:['301']}, assignment:{id:payload.assignmentId,title:'Récit narratif · notions',mode:'formatif'}, remises:[{timestamp:new Date().toISOString(),matrixId:'10102',exerciseId:'110317',exerciseLabel:'Exercice 1 · Les classes de mots',score:7,total:10,percentage:70,attempt:1,answers:{},details:{}}] };
  }

  return { ok: true, preview: true, message: 'Modification simulée dans l’aperçu local.' };
}

export async function requireBootstrap(expectedRole) {
  if (!getToken() && !isPreview()) {
    location.replace('./');
    throw new Error('Connexion requise.');
  }
  const data = await api('bootstrap');
  if (!data.catalog) {
    const response = await fetch('data/catalog.json');
    if (!response.ok) throw new Error('La banque d’activités est temporairement indisponible.');
    data.catalog = await response.json();
  }
  if (expectedRole && data.user.role !== expectedRole) {
    location.replace(data.user.role === 'enseignant' ? 'enseignant.html' : 'eleve.html');
    throw new Error('Accès refusé.');
  }
  return data;
}

export function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('fr-CA', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}
