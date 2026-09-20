(() => {
  if (window.__cardinalV12Installed) return;
  window.__cardinalV12Installed = true;

  const ROSTER_ENDPOINT = 'https://ojyswaxuqwnqilrvtjll.supabase.co/functions/v1/school-roster';
  const PAGE_SOURCE = 'cardinal-mozaik-console';
  let syncInFlight = false;

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function academicYearStartNow() {
    const d = new Date();
    return d.getMonth() < 6 ? d.getFullYear() - 1 : d.getFullYear();
  }

  function yearFromPortalId(value, establishmentId) {
    const raw = String(value || '');
    const establishment = String(establishmentId || '');
    if (!raw || !establishment || !raw.startsWith(establishment)) return null;
    const match = raw.slice(establishment.length).match(/^(20\d{2})/);
    return match ? Number(match[1]) : null;
  }

  function subjectFromMatterId(value) {
    return String(value || '').match(/M(\d+)-[^/]+$/i)?.[1] || '';
  }

  function hasCurrentStoredMapping(group, groupCode) {
    const code = String(groupCode || '').trim();
    if (!group || !code) return false;

    const establishmentId = String(group.establishmentId || '').trim();
    const groupCourseId = String(group.groupCourseId || '').trim();
    const groupMatterId = String(group.groupMatterId || '').trim();
    const subjectCode = String(group.subjectCode || '').trim();

    if (!/^\d+$/.test(establishmentId) || !subjectCode) return false;
    if (!groupCourseId.endsWith(`-${code}`) || !groupMatterId.endsWith(`-${code}`)) return false;

    const courseYear = yearFromPortalId(groupCourseId, establishmentId);
    const matterYear = yearFromPortalId(groupMatterId, establishmentId);
    if (!courseYear || courseYear !== matterYear) return false;
    if (Number(group.academicYearStart || courseYear) !== courseYear) return false;
    if (courseYear !== academicYearStartNow()) return false;
    if (subjectFromMatterId(groupMatterId) !== subjectCode) return false;

    return true;
  }

  async function discoveryConfig(groupCode) {
    const timeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Validation du mapping Mozaïk trop longue.')), 5000);
    });
    return Promise.race([
      api(ROSTER_ENDPOINT, {
        action: 'discoveryConfig',
        teacherToken: state.teacherToken,
        groupCode: String(groupCode || '')
      }),
      timeout
    ]);
  }

  async function waitForExtensionReady(timeout = 1800) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      pingExtension();
      if (state.extensionReady) return true;
      await sleep(180);
    }
    return !!state.extensionReady;
  }

  function showMozaikProgressImmediately() {
    try {
      window.postMessage({
        source: PAGE_SOURCE,
        type: 'MOZAIK_EXTENSION_SHOW_PROGRESS'
      }, location.origin);
    } catch {}
  }

  function expectedGradeCount(group) {
    return state.currentStudents.filter(student =>
      student.group === group && student.grade !== null && student.grade !== undefined
    ).length;
  }

  async function directSync(btn) {
    if (!state.currentAssignment?.id) return;

    let job = null;
    let completed = false;

    try {
      btn.disabled = true;
      btn.textContent = 'Préparation...';
      const syncState = document.getElementById('syncState');
      if (syncState) syncState.textContent = 'Préparation de la synchronisation...';

      showMozaikProgressImmediately();
      if (!await waitForExtensionReady()) {
        throw new Error('Extension Chrome non détectée. Recharge l’extension puis cette page.');
      }

      await saveAssignmentSettings({ quiet: true });

      const group = String(state.detailGroup || '');
      if (!group) throw new Error('Choisis un groupe.');
      validateMozaikGrades();

      const expectedCount = expectedGradeCount(group);
      if (!expectedCount) throw new Error(`Aucune note à synchroniser pour le groupe ${group}.`);

      if (syncState) syncState.textContent = `Groupe ${group} déjà validé. Préparation du lot Mozaïk...`;

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
      if (Number(prepared.resultCount || 0) !== expectedCount) {
        throw new Error(`Le lot préparé contient ${Number(prepared.resultCount || 0)} note${Number(prepared.resultCount || 0) === 1 ? '' : 's'}, mais Gestion en attend ${expectedCount}. Rien n’a été envoyé.`);
      }

      job = await api(SYNC_ENDPOINT, {
        action: 'claim',
        code: prepared.code
      });

      btn.textContent = 'Synchronisation...';
      if (syncState) syncState.textContent = 'Envoi des notes dans Mozaïk...';

      const result = await sendToExtension(job.payload);
      const syncedCount = Number(result?.syncedCount || 0);

      if (result?.success === true && syncedCount !== expectedCount) {
        throw new Error(`Mozaïk a confirmé ${syncedCount} note${syncedCount === 1 ? '' : 's'}, mais Gestion en attendait ${expectedCount}. La synchronisation n’est pas considérée comme complète.`);
      }
      if (result?.success === true && !String(result?.activityId || '').trim()) {
        throw new Error('Mozaïk a répondu succès sans identifiant d’activité. La synchronisation n’est pas considérée comme complète.');
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
      const syncState = document.getElementById('syncState');
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
        !window.__cardinalV08Installed ||
        !window.__cardinalV11Installed
      ) {
        setTimeout(install, 100);
        return;
      }

      const btn = document.getElementById('syncMozaikBtn');
      if (!btn || typeof btn.onclick !== 'function') {
        setTimeout(install, 100);
        return;
      }
      if (btn.dataset.cardinalSyncV12 === '1') return;

      btn.dataset.cardinalSyncV12 = '1';
      const previousHandler = btn.onclick;

      btn.onclick = async function(...args) {
        if (syncInFlight || btn.dataset.cardinalSyncInFlight === '1') return;
        if (!state.currentAssignment?.id) return;

        syncInFlight = true;
        btn.dataset.cardinalSyncInFlight = '1';
        const originalText = btn.textContent;
        btn.disabled = true;
        showMozaikProgressImmediately();

        try {
          const group = String(state.detailGroup || state.currentAssignment?.groups?.[0] || '');
          if (!group) throw new Error('Choisis un groupe.');

          const syncState = document.getElementById('syncState');
          if (syncState) syncState.textContent = `Validation rapide du groupe ${group}...`;

          let config = null;
          let configLookupFailed = false;
          try {
            config = await discoveryConfig(group);
          } catch {
            configLookupFailed = true;
          }

          if (hasCurrentStoredMapping(config?.group, group)) {
            if (syncState) syncState.textContent = `Groupe ${group} déjà validé. Synchronisation directe...`;
            return await directSync(btn);
          }

          if (configLookupFailed) {
            if (syncState) syncState.textContent = `Validation rapide indisponible pour le groupe ${group}. Tentative directe...`;
            return await directSync(btn);
          }

          // Aucun mapping courant: on conserve le mécanisme de découverte existant
          // pour une première association ou un changement d’année scolaire.
          btn.disabled = false;
          return await previousHandler.apply(this, args);
        } catch (error) {
          const message = error?.message || String(error);
          const syncState = document.getElementById('syncState');
          if (syncState) syncState.textContent = message;
          notify(message, 'error');
        } finally {
          syncInFlight = false;
          delete btn.dataset.cardinalSyncInFlight;
          if (btn.disabled) btn.disabled = false;
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
