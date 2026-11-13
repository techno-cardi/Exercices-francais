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
      if (state.extensionReady) {
        const version=String(state.extensionVersion || '').split('.').map(Number);
        if ((version[0] || 0) < 1 || version[0] === 1 && ((version[1] || 0) < 3 || version[1] === 3 && (version[2] || 0) < 24)) throw new Error('Cardinal 1.3.24 est requis pour l’aperçu et la reprise des envois Mozaïk. Recharge l’extension mise à jour.');
        return true;
      }
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

  async function cancelUnwrittenJob(job) {
    if (!job?.jobId) throw new Error('Le journal ne peut pas être identifié pour son annulation.');
    const response=await withTimeout(api(SYNC_ENDPOINT,{action:'cancelUnwritten',teacherToken:state.teacherToken,jobId:job.jobId}),10000,'L’annulation du lot');
    if(response?.mode!=='cancelled') throw new Error('Ce lot a peut-être commencé à écrire. Utilise « Résoudre l’envoi interrompu » avant un nouvel envoi.');
  }

  async function prepareJob(group, expectedCount, form, destination = null, weightSource = null) {
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
      settings,
      weightSource,
      ...(destination ? {destination} : {})
    }), 10000, 'La préparation du lot Mozaïk');

    if (!prepared?.code) throw new Error('Le serveur n’a pas retourné le code du lot Mozaïk préparé.');
    if (destination && (prepared.destinationAccepted?.previousActivityId !== destination.previousActivityId || prepared.destinationAccepted?.activityId !== destination.activityId))
      throw new Error('Le serveur n’a pas confirmé la destination choisie. Actualise Gestion des notes avant de réessayer.');

    const preparedCount = Number(prepared.resultCount || 0);
    if (preparedCount !== expectedCount) {
      throw new Error(`Le lot préparé contient ${preparedCount} note${preparedCount === 1 ? '' : 's'}, mais Gestion en attend ${expectedCount}. Rien n’a été envoyé.`);
    }

    const claimed=await withTimeout(api(SYNC_ENDPOINT, { action: 'claim', code: prepared.code }), 10000, 'La prise en charge du lot Mozaïk');
    if(destination && (claimed?.payload?.previousLink?.activityId !== destination.previousActivityId || (claimed?.payload?.link?.activityId ?? null) !== destination.activityId)) {
      try { await cancelUnwrittenJob(claimed); }
      catch { throw new Error('La destination du lot diffère de ton choix. Aucune note envoyée; utilise « Résoudre l’envoi interrompu » pour libérer le lot.'); }
      throw new Error('La destination du lot diffère de ton choix. Aucune note n’a été envoyée et le lot a été annulé.');
    }
    return claimed;
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
      verified: result?.verified === true,
      verifiedCount: result?.verifiedCount ?? 0,
      message: result?.message || ''
    }), 10000, 'La confirmation finale dans Gestion des notes');
  }

  async function runSync(btn, resumeJobId = '', recoveryJob = null) {
    if (!state.currentAssignment?.id) return;

    let job = null;
    let destination = null;
    let completed = false;
    let confirmedSendAttempted = false;
    let prewriteCheckpoint = false;
    const isUnwritten = checkpoint => !checkpoint || checkpoint.phase === 'planned' && checkpoint.reviewConfirmed !== true;
    const originalText = btn.textContent;

    try {
      window.cardinalActiveSync = true;
      btn.disabled = true;
      btn.textContent = 'Préparation...';
      showMozaikPanel();
      syncState('1/4 · Vérification locale...');
      pushMozaikStage('Vérification de Gestion des notes…', 8);

      if (!await waitForExtensionReady()) {
        throw new Error('Extension Chrome non détectée. Recharge l’extension puis Gestion des notes.');
      }

      await flushPendingGradeSaves();
      if (!resumeJobId && !recoveryJob) {
        const status = await api(SYNC_ENDPOINT,{action:'status',teacherToken:state.teacherToken,assignmentId:state.currentAssignment.id});
        const pending=(status.pendingJobs || []).filter(job => String(job.groupCode) === String(state.detailGroup));
        if(pending.length>1) throw new Error('Plusieurs envois interrompus existent pour ce groupe. Aucun nouvel envoi n’a été lancé.');
        if(pending.length===1) resumeJobId=pending[0].jobId;
      }
      if (!resumeJobId && !recoveryJob) {
        await saveAssignmentSettings({quiet:true});
        if (!window.CardinalGestionImports?.chooseMozaikDestination) throw new Error('Actualise Gestion des notes pour choisir le travail Mozaïk avant l’envoi.');
        syncState('Choisis le travail de destination dans Mozaïk.');
        const chosen=await window.CardinalGestionImports.chooseMozaikDestination(state.currentAssignment.id);
        if (!chosen) {
          syncState('Envoi annulé. Aucune note envoyée dans Mozaïk.');
          pushMozaikStage('Envoi annulé. Aucune note envoyée.', 0, 'cancelled');
          return;
        }
        if (typeof chosen === 'object') {
          const [major,minor,patch]=String(state.extensionVersion || '').split('.').map(Number);
          if ((major||0)<1 || major===1 && ((minor||0)<3 || minor===3 && (patch||0)<37))
            throw new Error('Cardinal 1.3.37 est requis pour changer de destination Mozaïk. Recharge l’extension mise à jour.');
          destination=chosen;
        }
      }

      const group = String(state.detailGroup || state.currentAssignment?.groups?.[0] || '');
      if (!group) throw new Error('Choisis un groupe.');

      // Le choix n'est proposé que lors d'un NOUVEAU lot, jamais pour un lot
      // interrompu dont l'identité, les notes et la cible ont déjà été figées.
      let weightSource = null;
      if (!resumeJobId && !recoveryJob) {
        const picker = window.CardinalAssignmentActions?.chooseMozaikWeightSource;
        if (typeof picker !== 'function') throw new Error('Le choix de pondération est indisponible. Actualise Gestion des notes avant un nouvel envoi.');
        const current = currentFormSnapshot();
        const destinationInfo=window.CardinalGestionImports?.getLastDestinationWeightInfo?.();
        if (!destinationInfo ||
            String(destinationInfo.assignmentId)!==String(state.currentAssignment.id) ||
            String(destinationInfo.groupCode)!==group ||
            Date.now()-Number(destinationInfo.capturedAt)>120000) {
          throw new Error('Le choix de destination Mozaïk n’est plus fiable. Actualise Gestion des notes et recommence.');
        }
        weightSource = await picker({
          groupCode: group,
          title: state.currentAssignment?.title || '',
          gestionWeight: current.weight,
          gestionMaxScore: current.maxScore,
          gestionReportCard: current.reportCardEnabled,
          mozaikWeight: destinationInfo.weight,
          mozaikMaxScore: destinationInfo.maxScore,
          mozaikReportCard: destinationInfo.reportCardEnabled,
          isNew: destinationInfo.isNew
        });
        if (!weightSource) {
          syncState('Envoi annulé. Aucun nouveau lot Mozaïk préparé.');
          pushMozaikStage('Envoi annulé avant la préparation.', 0, 'cancelled');
          return;
        }
        if (!['gestion','mozaik'].includes(weightSource)) throw new Error('Choix de pondération invalide.');
      }

      validateMozaikGrades();
      let expectedCount = expectedGradeCount(group);
      if (!expectedCount && !resumeJobId && !recoveryJob) throw new Error(`Aucune note à synchroniser pour le groupe ${group}.`);

      const form = currentFormSnapshot();
      syncState(`2/4 · Préparation du lot pour le groupe ${group}...`);
      pushMozaikStage(`Préparation du lot du groupe ${group}…`, 18);

      try {
        job = recoveryJob || (resumeJobId
          ? await withTimeout(api(SYNC_ENDPOINT,{action:'resume',teacherToken:state.teacherToken,jobId:resumeJobId}),10000,'La reprise du lot Mozaïk')
          : await prepareJob(group, expectedCount, form, destination, weightSource));
        if (resumeJobId || recoveryJob) expectedCount = job.payload.results.length;
      } catch (error) {
        if (isMissingMapping(error)) {
          throw new Error(`Le mapping Mozaïk du groupe ${group} est absent. La synchronisation a été arrêtée immédiatement au lieu de lancer une détection de 150 s.`);
        }
        throw error;
      }

      btn.textContent = 'Synchronisation...';
      prewriteCheckpoint = isUnwritten(job.payload?.checkpoint);
      syncState('3/4 · Envoi dans Mozaïk...');
      pushMozaikStage('Lot prêt. Envoi dans Mozaïk…', 32);

      const syncJob={jobId:job.jobId,claimToken:job.claimToken,endpoint:SYNC_ENDPOINT,apiKey:PUBLIC_KEY};
      const inspected = await withTimeout(sendToExtension({...job.payload,syncJob,reviewOnly:true}),35000,'La lecture de Mozaïk');
      if (inspected?.checkpoint) prewriteCheckpoint = prewriteCheckpoint && isUnwritten(inspected.checkpoint);
      if (!inspected?.success || !inspected.previewRequired || !inspected.preview) throw new Error(inspected?.message || 'L’aperçu Mozaïk n’a pas pu être préparé.');
      const approved=await window.CardinalAssignmentActions.reviewMozaik(inspected.preview,{groupCode:job.payload.group.code,title:job.payload.assignment.title,reconcilingStale:job.payload.reconcilingStale===true,weightSource:job.payload.assignment?.weightSource||weightSource});
      if (!approved) {
        if (prewriteCheckpoint && !recoveryJob) {
          await cancelUnwrittenJob(job);job=null;
          syncState('Envoi annulé. Aucune note envoyée dans Mozaïk.');
          pushMozaikStage('Envoi annulé. Aucune note envoyée.', 0, 'cancelled');
          return;
        }
        throw new Error('Envoi annulé. Le lot interrompu est conservé pour une reprise sécurisée.');
      }
      confirmedSendAttempted = true;
      const result = await withTimeout(sendToExtension({...job.payload,syncJob,checkpoint:inspected.checkpoint,confirmedReview:true,reviewOnly:false}),35000,'L’envoi vers Mozaïk');
      const syncedCount = Number(result?.syncedCount || 0);

      if (result?.success === true && (result.verified !== true || Number(result.verifiedCount) !== expectedCount)) throw new Error('Les notes n’ont pas toutes été relues dans Mozaïk. La synchronisation reste à vérifier.');
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
      if (completeResponse?.staleSource) {
        notify('L’ancien envoi est terminé. Les changements plus récents de Gestion restent à envoyer.');
        return;
      }

      const label = result.competenceLabel || competenceLabel(state.currentAssignment.competenceKind);
      syncState(`Synchronisation réussie : ${syncedCount} note${syncedCount === 1 ? '' : 's'} envoyée${syncedCount === 1 ? '' : 's'} · ${label}.`);
      notify(`Synchronisation réussie : ${syncedCount} note${syncedCount === 1 ? '' : 's'} envoyée${syncedCount === 1 ? '' : 's'} dans Mozaïk.`);
      try { Promise.resolve(refreshSyncState()).catch(() => {}); } catch {}
    } catch (error) {
      let message = error?.message || String(error);

      if(job && !completed && !confirmedSendAttempted && prewriteCheckpoint && !recoveryJob) {
        try {await cancelUnwrittenJob(job);job=null;}
        catch {message += ' Le lot reste à vérifier dans « Résoudre l’envoi interrompu ».';}
      }

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
      if (resumeJobId) {
        const recover=document.getElementById('recoverMozaikBtn');
        if(recover){recover.dataset.jobId=resumeJobId;recover.classList.remove('hidden');}
      }
    } finally {
      window.cardinalActiveSync = false;
      btn.disabled = false;
      btn.textContent = originalText || 'Envoyer dans Mozaïk';
      try { await refreshSyncState(); } catch {}
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
      const resume = document.getElementById('resumeMozaikBtn');
      if (resume) resume.onclick = async () => {
        if (inFlight || !resume.dataset.jobId) return;
        inFlight = true;
        try { await runSync(resume, resume.dataset.jobId); }
        finally { inFlight = false; }
      };
      const cancel=document.getElementById('cancelMozaikBtn');
      if(cancel) cancel.onclick=async()=>{
        if(inFlight || !cancel.dataset.jobId || !state.currentAssignment?.id)return;
        const originalId=String(cancel.dataset.jobId);
        const assignmentId=String(state.currentAssignment.id);
        const group=String(state.detailGroup || '');
        const confirmed=window.confirm(
          'Annuler l’envoi interrompu du groupe '+group+' ?\\n\\n'
          +'Cardinal vérifiera le journal sur le serveur. L’annulation sera REFUSÉE si une écriture de notes a pu commencer. '
          +'Les paramètres éventuellement déjà modifiés dans Mozaïk ne seront pas restaurés. '
          +'Aucune note de Gestion ni de Mozaïk ne sera supprimée.\\n\\n'
          +'Tu devras préparer ensuite un NOUVEL envoi avec un nouvel aperçu.'
        );
        if(!confirmed)return;
        inFlight=true;cancel.disabled=true;
        try{
          const status=await withTimeout(api(SYNC_ENDPOINT,{action:'status',teacherToken:state.teacherToken,assignmentId}),10000,'La vérification de l’envoi interrompu');
          if(String(state.currentAssignment?.id)!==assignmentId || String(state.detailGroup)!==group)
            throw new Error('Tu as changé de travail ou de groupe. L’annulation est arrêtée.');
          const pending=(status.pendingJobs||[]).filter(job=>String(job.groupCode)===group);
          if(pending.length!==1 || String(pending[0].jobId)!==originalId)
            throw new Error('Le journal a changé ou plusieurs envois sont présents. Actualise les données avant toute annulation.');
          const phase=String(pending[0].phase||'');
          if(!['planned','claimed'].includes(phase))
            throw new Error('La synchronisation a dépassé la préparation. Annulation refusée pour protéger les notes; utilise la résolution.');
          const result=await withTimeout(api(SYNC_ENDPOINT,{action:'cancelUnwritten',teacherToken:state.teacherToken,jobId:originalId}),10000,'L’annulation sécurisée');
          if(result?.mode!=='cancelled')throw new Error('Le serveur ne garantit pas une annulation sans écriture de notes. Le journal est conservé.');
          const mayHaveChanged=result?.activitySettingsMayHaveChanged===true;
          notify(mayHaveChanged
            ? 'Lot abandonné sans écriture de notes selon le journal. Les paramètres Mozaïk peuvent avoir changé : vérifie-les avant un nouvel envoi.'
            : 'Ancien lot annulé avant l’écriture des notes. Prépare un nouvel envoi et vérifie son aperçu.');
          syncState(mayHaveChanged
            ? 'Lot abandonné avant l’envoi des notes. Vérifie les paramètres de l’activité Mozaïk.'
            : 'Lot interrompu annulé. Aucun résultat de ce lot envoyé.');
          await refreshSyncState();
        }catch(error){notify(error?.message||String(error),'error');}
        finally{cancel.disabled=false;inFlight=false;}
      };
      const recover=document.getElementById('recoverMozaikBtn');
      if(recover) recover.onclick=async()=>{
        if(inFlight || !recover.dataset.jobId)return;
        inFlight=true;
        try{
          const recovered=await api(SYNC_ENDPOINT,{action:'reconcileStale',teacherToken:state.teacherToken,jobId:recover.dataset.jobId});
          if(recovered.mode==='cancelled') {recover.classList.add('hidden');notify('L’ancien envoi n’avait rien écrit. Tu peux préparer le nouvel envoi.');await refreshSyncState();}
          else await runSync(recover,'',recovered);
        }catch(error){notify(error.message,'error');}
        finally{inFlight=false;}
      };
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
