(() => {
  if (window.__cardinalV14Installed) return;
  window.__cardinalV14Installed = true;

  const PAGE_SOURCE = 'cardinal-mozaik-console';
  let inFlight = false;
  let ownedHandler = null;

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function timeoutError(label, ms) {
    const seconds = Math.max(1, Math.round(ms / 1000));
    return new Error(`${label} n’a pas répondu après ${seconds} s. La synchronisation a été arrêtée au lieu d’attendre indéfiniment.`);
  }

  function withTimeout(promise, ms, label) {
    let timer;
    return Promise.race([
      Promise.resolve(promise).finally(() => clearTimeout(timer)),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(timeoutError(label, ms)), ms);
      })
    ]);
  }

  function syncState(message) {
    const el = document.getElementById('syncState');
    if (el) el.textContent = message;
  }

  function showMozaikPanel() {
    try {
      window.postMessage({ source: PAGE_SOURCE, type: 'MOZAIK_EXTENSION_SHOW_PROGRESS' }, location.origin);
    } catch {}
  }

  function pushMozaikStage(message, progress = 10, status = 'working') {
    try {
      window.postMessage({
        source: PAGE_SOURCE,
        type: 'MOZAIK_EXTENSION_PROGRESS',
        payload: {
          status,
          progress,
          title: status === 'error' ? 'Synchronisation arrêtée' : 'Synchronisation en cours',
          message,
          indeterminate: status === 'working'
        }
      }, location.origin);
    } catch {}
  }

  async function waitForExtensionReady(timeout = 1800) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      try { pingExtension(); } catch {}
      if (state.extensionReady) return true;
      await sleep(120);
    }
    return !!state.extensionReady;
  }

  async function flushPendingGradeSaves(timeout = 7000) {
    const active = document.activeElement;
    if (active instanceof HTMLInputElement && active.classList.contains('grade-input')) {
      try { Promise.resolve(commitGrade(active)).catch(() => {}); } catch {}
      try { active.blur(); } catch {}
    }

    const started = Date.now();
    while (document.querySelector('.grade-input.saving')) {
      if (Date.now() - started >= timeout) {
        throw new Error('Une note n’a pas fini de s’enregistrer après 7 s. La synchronisation est arrêtée pour éviter d’envoyer une ancienne valeur.');
      }
      await sleep(80);
    }

    if (document.querySelector('.grade-input.error')) {
      throw new Error('Une note contient une erreur ou n’a pas pu être enregistrée. Corrige-la avant la synchronisation Mozaïk.');
    }
  }

  function currentFormSnapshot() {
    let a = state.currentAssignment || {};
    try {
      if (typeof collectAssignment === 'function') a = { ...a, ...collectAssignment() };
    } catch {}
    return a;
  }

  function expectedGradeCount(group) {
    return (state.currentStudents || []).filter(student =>
      String(student.group) === String(group) &&
      student.grade !== null && student.grade !== undefined
    ).length;
  }

  async function prepareJob(group, expectedCount, form) {
    const settings = {
      term: Number(form.term || 1),
      activityDate: form.activityDate || (typeof today === 'function' ? today() : new Date().toISOString().slice(0, 10)),
      period: Number(form.period || 3),
      weight: form.weight ?? 0,
      competenceKind: form.competenceKind || state.currentAssignment?.competenceKind || '',
      reportCardEnabled: !!form.reportCardEnabled,
      resultsVisible: !!form.resultsVisible,
      showInSchedule: form.showInSchedule !== false,
      homework: !!form.homework
    };

    const prepared = await withTimeout(api(SYNC_ENDPOINT, {
      action: 'prepare',
      teacherToken: state.teacherToken,
      assignmentId: state.currentAssignment.id,
      groupCode: group,
      settings
    }), 10000, 'La préparation du lot Mozaïk');

    if (!prepared?.code) throw new Error('Le serveur n’a pas retourné le code du lot Mozaïk préparé.');

    const preparedCount = Number(prepared.resultCount || 0);
    if (preparedCount !== expectedCount) {
      throw new Error(`Le lot préparé contient ${preparedCount} note${preparedCount === 1 ? '' : 's'}, mais Gestion en attend ${expectedCount}. Rien n’a été envoyé.`);
    }

    return withTimeout(api(SYNC_ENDPOINT, { action: 'claim', code: prepared.code }), 10000, 'La prise en charge du lot Mozaïk');
  }

  function isMissingMapping(error) {
    return /configuration\s+mozaïk\s+du\s+groupe\s+introuvable|détection\s+automatique/i.test(String(error?.message || error || ''));
  }

  async function completeJob(job, result, syncedCount) {
    return withTimeout(api(SYNC_ENDPOINT, {
      action: 'complete',
      jobId: job.jobId,
      claimToken: job.claimToken,
      success: result?.success === true,
      activityId: result?.activityId || '',
      competenceCode: result?.competenceCode || '',
      syncedCount,
      message: result?.message || ''
    }), 10000, 'La confirmation finale dans Gestion des notes');
  }

  async function runSync(btn) {
    if (!state.currentAssignment?.id) return;

    let job = null;
    let completed = false;
    const originalText = btn.textContent;

    try {
      btn.disabled = true;
      btn.textContent = 'Préparation...';
      showMozaikPanel();
      syncState('1/4 · Vérification locale...');
      pushMozaikStage('Vérification de Gestion des notes…', 8);

      if (!await waitForExtensionReady()) {
        throw new Error('Extension Chrome non détectée. Recharge l’extension puis Gestion des notes.');
      }

      await flushPendingGradeSaves();

      const group = String(state.detailGroup || state.currentAssignment?.groups?.[0] || '');
      if (!group) throw new Error('Choisis un groupe.');

      validateMozaikGrades();
      const expectedCount = expectedGradeCount(group);
      if (!expectedCount) throw new Error(`Aucune note à synchroniser pour le groupe ${group}.`);

      const form = currentFormSnapshot();
      syncState(`2/4 · Préparation du lot pour le groupe ${group}...`);
      pushMozaikStage(`Préparation du lot du groupe ${group}…`, 18);

      try {
        job = await prepareJob(group, expectedCount, form);
      } catch (error) {
        if (isMissingMapping(error)) {
          throw new Error(`Le mapping Mozaïk du groupe ${group} est absent. La synchronisation a été arrêtée immédiatement au lieu de lancer une détection de 150 s.`);
        }
        throw error;
      }

      btn.textContent = 'Synchronisation...';
      syncState('3/4 · Envoi dans Mozaïk...');
      pushMozaikStage('Lot prêt. Envoi dans Mozaïk…', 32);

      const result = await withTimeout(sendToExtension(job.payload), 35000, 'L’envoi vers Mozaïk');
      const syncedCount = Number(result?.syncedCount || 0);

      if (result?.success === true && syncedCount !== expectedCount) {
        throw new Error(`Mozaïk a confirmé ${syncedCount} note${syncedCount === 1 ? '' : 's'}, mais le lot en contient ${expectedCount}. La synchronisation n’est pas confirmée.`);
      }
      if (result?.success === true && !String(result?.activityId || '').trim()) {
        throw new Error('Mozaïk a répondu succès sans identifiant d’activité. La synchronisation n’est pas confirmée.');
      }

      syncState('4/4 · Confirmation finale...');
      const completeResponse = await completeJob(job, result, syncedCount);
      completed = true;

      if (!result?.success) {
        throw new Error(result?.message || completeResponse?.message || 'La synchronisation a échoué.');
      }

      const label = result.competenceLabel || competenceLabel(state.currentAssignment.competenceKind);
      syncState(`Synchronisation réussie : ${syncedCount} note${syncedCount === 1 ? '' : 's'} envoyée${syncedCount === 1 ? '' : 's'} · ${label}.`);
      notify(`Synchronisation réussie : ${syncedCount} note${syncedCount === 1 ? '' : 's'} envoyée${syncedCount === 1 ? '' : 's'} dans Mozaïk.`);
      try { Promise.resolve(refreshSyncState()).catch(() => {}); } catch {}
    } catch (error) {
      const message = error?.message || String(error);

      if (job && !completed) {
        try {
          await withTimeout(api(SYNC_ENDPOINT, {
            action: 'complete',
            jobId: job.jobId,
            claimToken: job.claimToken,
            success: false,
            activityId: '',
            competenceCode: '',
            syncedCount: 0,
            message
          }), 5000, 'La fermeture du lot en erreur');
        } catch {}
      }

      syncState(message);
      pushMozaikStage(message, 100, 'error');
      notify(message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = originalText || 'Envoyer dans Mozaïk';
    }
  }

  function installOwnership() {
    try {
      if (
        typeof state === 'undefined' ||
        typeof api !== 'function' ||
        typeof sendToExtension !== 'function' ||
        typeof validateMozaikGrades !== 'function' ||
        typeof commitGrade !== 'function'
      ) return false;

      const btn = document.getElementById('syncMozaikBtn');
      if (!btn) return false;

      if (!ownedHandler) {
        ownedHandler = async function() {
          if (inFlight) return;
          inFlight = true;
          try { await runSync(btn); }
          finally { inFlight = false; }
        };
      }

      if (btn.onclick !== ownedHandler || btn.dataset.cardinalSyncOwner !== 'v14') {
        btn.onclick = ownedHandler;
        btn.dataset.cardinalSyncOwner = 'v14';
      }
      return true;
    } catch {
      return false;
    }
  }

  let attempts = 0;
  const timer = setInterval(() => {
    attempts++;
    installOwnership();
    if (attempts > 120) clearInterval(timer);
  }, 250);
  installOwnership();
})();
