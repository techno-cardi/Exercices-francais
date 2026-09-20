(() => {
  if (window.__cardinalV13Installed) return;
  window.__cardinalV13Installed = true;

  const PAGE_SOURCE = 'cardinal-mozaik-console';
  let syncInFlight = false;

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function showMozaikProgressImmediately() {
    try {
      window.postMessage({
        source: PAGE_SOURCE,
        type: 'MOZAIK_EXTENSION_SHOW_PROGRESS'
      }, location.origin);
    } catch {}
  }

  async function waitForExtensionReady(timeout = 2200) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      try { pingExtension(); } catch {}
      if (state.extensionReady) return true;
      await sleep(160);
    }
    return !!state.extensionReady;
  }

  async function waitForPendingGradeSaves(timeout = 10000) {
    const active = document.activeElement;
    if (active instanceof HTMLInputElement && active.classList.contains('grade-input')) {
      await commitGrade(active);
      try { active.blur(); } catch {}
    }

    const started = Date.now();
    while (document.querySelector('.grade-input.saving')) {
      if (Date.now() - started > timeout) {
        throw new Error('Une note est encore en cours d’enregistrement. Attends qu’elle soit enregistrée puis réessaie.');
      }
      await sleep(80);
    }

    if (document.querySelector('.grade-input.error')) {
      throw new Error('Une note contient une erreur. Corrige-la avant la synchronisation Mozaïk.');
    }
  }

  function expectedGradeCount(group) {
    return state.currentStudents.filter(student =>
      String(student.group) === String(group) &&
      student.grade !== null && student.grade !== undefined
    ).length;
  }

  function needsDiscovery(error) {
    const message = String(error?.message || error || '');
    return /configuration\s+mozaïk\s+du\s+groupe\s+introuvable|lance\s+d['’]abord\s+la\s+détection\s+automatique/i.test(message);
  }

  async function prepareExactJob(group, expectedCount) {
    const prepared = await api(SYNC_ENDPOINT, {
      action: 'prepare',
      teacherToken: state.teacherToken,
      assignmentId: state.currentAssignment.id,
      groupCode: group,
      settings: {
        term: Number(state.currentAssignment.term || 1),
        activityDate: state.currentAssignment.activityDate || today(),
        period: Number(state.currentAssignment.period || 3),
        weight: state.currentAssignment.weight ?? 0,
        competenceKind: state.currentAssignment.competenceKind,
        reportCardEnabled: !!state.currentAssignment.reportCardEnabled,
        resultsVisible: !!state.currentAssignment.resultsVisible,
        showInSchedule: state.currentAssignment.showInSchedule !== false,
        homework: !!state.currentAssignment.homework
      }
    });

    if (!prepared?.code) {
      throw new Error('Le serveur n’a pas retourné le code du lot Mozaïk préparé.');
    }

    const preparedCount = Number(prepared.resultCount || 0);
    if (preparedCount !== expectedCount) {
      throw new Error(`Le lot préparé contient ${preparedCount} note${preparedCount === 1 ? '' : 's'}, mais Gestion en attend ${expectedCount}. Rien n’a été envoyé.`);
    }

    return api(SYNC_ENDPOINT, {
      action: 'claim',
      code: prepared.code
    });
  }

  async function runDirectSync(btn, previousHandler, args) {
    let job = null;
    let completed = false;
    const syncState = document.getElementById('syncState');

    try {
      btn.disabled = true;
      btn.textContent = 'Préparation...';
      if (syncState) syncState.textContent = 'Préparation directe du lot Mozaïk...';

      showMozaikProgressImmediately();

      if (!await waitForExtensionReady()) {
        throw new Error('Extension Chrome non détectée. Recharge l’extension puis cette page.');
      }

      await waitForPendingGradeSaves();
      await saveAssignmentSettings({ quiet: true });

      const group = String(state.detailGroup || state.currentAssignment?.groups?.[0] || '');
      if (!group) throw new Error('Choisis un groupe.');

      validateMozaikGrades();
      const expectedCount = expectedGradeCount(group);
      if (!expectedCount) throw new Error(`Aucune note à synchroniser pour le groupe ${group}.`);

      if (syncState) syncState.textContent = `Groupe ${group} · préparation du lot...`;

      try {
        job = await prepareExactJob(group, expectedCount);
      } catch (error) {
        if (!needsDiscovery(error)) throw error;

        // Première association ou mapping réellement absent. Seulement dans ce cas,
        // on redonne la main à l'ancien mécanisme de découverte sécurisé.
        if (syncState) syncState.textContent = `Aucun mapping Mozaïk enregistré pour le groupe ${group}. Détection automatique...`;
        btn.disabled = false;
        return await previousHandler.apply(btn, args);
      }

      btn.textContent = 'Synchronisation...';
      if (syncState) syncState.textContent = 'Envoi des notes dans Mozaïk...';

      const result = await sendToExtension(job.payload);
      const syncedCount = Number(result?.syncedCount || 0);

      if (result?.success === true && syncedCount !== expectedCount) {
        throw new Error(`Mozaïk a confirmé ${syncedCount} note${syncedCount === 1 ? '' : 's'}, mais le lot en contient ${expectedCount}. La synchronisation n’est pas confirmée.`);
      }
      if (result?.success === true && !String(result?.activityId || '').trim()) {
        throw new Error('Mozaïk a répondu succès sans identifiant d’activité. La synchronisation n’est pas confirmée.');
      }

      let completeResponse;
      try {
        completeResponse = await api(SYNC_ENDPOINT, {
          action: 'complete',
          jobId: job.jobId,
          claimToken: job.claimToken,
          success: result?.success === true,
          activityId: result?.activityId || '',
          competenceCode: result?.competenceCode || '',
          syncedCount,
          message: result?.message || ''
        });
        completed = true;
      } catch (completeError) {
        if (result?.success) {
          throw new Error(`Mozaïk a reçu les notes, mais Gestion des notes n’a pas pu enregistrer la confirmation. Vérifie Mozaïk avant de réessayer. ${completeError.message}`);
        }
        throw completeError;
      }

      if (!result?.success) {
        throw new Error(result?.message || completeResponse?.message || 'La synchronisation a échoué.');
      }

      const label = result.competenceLabel || competenceLabel(state.currentAssignment.competenceKind);
      if (syncState) {
        syncState.textContent = `Synchronisation réussie : ${syncedCount} note${syncedCount === 1 ? '' : 's'} envoyée${syncedCount === 1 ? '' : 's'} · ${label}.`;
      }
      notify(`Synchronisation réussie : ${syncedCount} note${syncedCount === 1 ? '' : 's'} envoyée${syncedCount === 1 ? '' : 's'} dans Mozaïk.`);
      await refreshSyncState();
    } catch (error) {
      if (job && !completed) {
        try {
          await api(SYNC_ENDPOINT, {
            action: 'complete',
            jobId: job.jobId,
            claimToken: job.claimToken,
            success: false,
            activityId: '',
            competenceCode: '',
            syncedCount: 0,
            message: error?.message || String(error)
          });
        } catch {}
      }

      const message = error?.message || String(error);
      if (syncState) syncState.textContent = message;
      notify(message, 'error');
    } finally {
      btn.disabled = false;
      try { await refreshSyncState(); } catch {}
    }
  }

  function install() {
    try {
      if (
        typeof state === 'undefined' ||
        typeof api !== 'function' ||
        typeof sendToExtension !== 'function' ||
        typeof saveAssignmentSettings !== 'function' ||
        typeof validateMozaikGrades !== 'function' ||
        typeof commitGrade !== 'function' ||
        !window.__cardinalV12Installed
      ) {
        setTimeout(install, 100);
        return;
      }

      const btn = document.getElementById('syncMozaikBtn');
      if (!btn || typeof btn.onclick !== 'function') {
        setTimeout(install, 100);
        return;
      }
      if (btn.dataset.cardinalSyncV13 === '1') return;

      btn.dataset.cardinalSyncV13 = '1';
      const previousHandler = btn.onclick;

      btn.onclick = async function(...args) {
        if (syncInFlight || btn.dataset.cardinalSyncInFlightV13 === '1') return;
        if (!state.currentAssignment?.id) return;

        syncInFlight = true;
        btn.dataset.cardinalSyncInFlightV13 = '1';
        const originalText = btn.textContent;
        btn.disabled = true;
        showMozaikProgressImmediately();

        try {
          return await runDirectSync(btn, previousHandler, args);
        } finally {
          syncInFlight = false;
          delete btn.dataset.cardinalSyncInFlightV13;
          btn.disabled = false;
          if (btn.textContent === 'Préparation...' || btn.textContent === 'Synchronisation...') {
            btn.textContent = originalText;
          }
        }
      };
    } catch {
      setTimeout(install, 100);
    }
  }

  install();
})();
