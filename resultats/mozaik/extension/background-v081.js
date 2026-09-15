importScripts('background-v08.js');

async function ensureFormativeUi081(tabId) {
  if (!tabId) return;
  try {
    await chrome.tabs.sendMessage(tabId, { type:'CARDINAL_FORMATIVE_UI', title:'Formative', message:'', status:'working' });
  } catch {
    try { await chrome.scripting.executeScript({ target:{ tabId }, files:['formative-ui.js'] }); } catch {}
  }
}

async function sendFormativeUi081(tabId, data) {
  if (!tabId) return;
  try {
    await chrome.tabs.sendMessage(tabId, { type:'CARDINAL_FORMATIVE_UI', ...data });
  } catch {
    await ensureFormativeUi081(tabId);
    await sleepFormative(120);
    try { await chrome.tabs.sendMessage(tabId, { type:'CARDINAL_FORMATIVE_UI', ...data }); } catch {}
  }
}

async function ensureFormativeSession081(tab) {
  if (!tab?.id) throw new Error('Onglet Formative introuvable.');
  await focusTab(tab);
  await ensureFormativeUi081(tab.id);
  if (formativeHeadersByTab.has(tab.id)) return tab;

  await sendFormativeUi081(tab.id, {
    title:'Préparation de Formative',
    message:'Je recharge la page une fois pour détecter ta session et lire les résultats…',
    status:'working'
  });

  try {
    await chrome.tabs.reload(tab.id, { bypassCache:true });
    await waitForTabComplete(tab.id, 45000);
  } catch {}

  const started = Date.now();
  while (Date.now() - started < 15000) {
    if (formativeHeadersByTab.has(tab.id)) {
      try { tab = await chrome.tabs.get(tab.id); } catch {}
      await ensureFormativeUi081(tab.id);
      await sendFormativeUi081(tab.id, {
        title:'Session Formative détectée',
        message:'Je récupère maintenant le travail, les élèves et les notes…',
        status:'working'
      });
      return tab;
    }
    await sleepFormative(250);
  }
  throw new Error('Je n’ai pas réussi à détecter ta session Formative. Recharge la page Réponses, attends que les élèves apparaissent, puis réessaie.');
}

const readFormativeSnapshotV08 = readFormativeSnapshot;
async function readFormativeSnapshot081(tabId, formativeId) {
  await sendFormativeUi081(tabId, {
    title:'Lecture de Formative',
    message:'Je récupère le travail, les questions, les élèves et leurs dernières notes…',
    status:'working'
  });
  try {
    return await readFormativeSnapshotV08(tabId, formativeId);
  } catch (error) {
    throw new Error(`Lecture Formative impossible : ${error?.message || String(error)}`);
  }
}

handleFormativeSendToGestion = async function(senderTab, formativeId) {
  if (!senderTab?.id) throw new Error('Onglet Formative introuvable.');
  let tab = senderTab;
  try {
    tab = await ensureFormativeSession081(tab);
    const snapshot = await readFormativeSnapshot081(tab.id, formativeId);
    await sendFormativeUi081(tab.id, {
      title:'Données récupérées',
      message:`${snapshot.students.length} élève${snapshot.students.length===1?'':'s'} et ${snapshot.questions.length} question${snapshot.questions.length===1?'':'s'} détectés. J’ouvre Gestion des notes…`,
      status:'success'
    });
    await deliverFormativeImport(snapshot);
    return { ok:true, groupCode:snapshot.groupCode, questionCount:snapshot.questions.length, studentCount:snapshot.students.length };
  } catch (error) {
    await sendFormativeUi081(tab?.id || senderTab.id, { title:'Erreur Formative', message:error?.message || String(error), status:'error' });
    throw error;
  }
};

handleFormativeRequest = async function(action, payload) {
  if (action === 'captureActive') {
    let tab = await focusOrOpenFormative('');
    const id = String(tab.url || '').match(/\/formatives\/([^/]+)\/results/)?.[1] || '';
    if (!id) throw new Error('Ouvre un travail Formative dans l’onglet Réponses.');
    try {
      tab = await ensureFormativeSession081(tab);
      const snapshot = await readFormativeSnapshot081(tab.id, id);
      await sendFormativeUi081(tab.id, { title:'Formative prêt', message:'Le travail et les questions ont été détectés. Retourne dans Gestion des notes pour choisir le lien.', status:'success' });
      return { ok:true, payload:snapshot };
    } catch (error) {
      await sendFormativeUi081(tab?.id, { title:'Erreur Formative', message:error?.message || String(error), status:'error' });
      throw error;
    }
  }

  if (action === 'pull') {
    const id = String(payload?.formativeId || '');
    if (!id) throw new Error('Ce travail n’est pas lié à Formative.');
    let tab = await focusOrOpenFormative(id);
    try {
      tab = await ensureFormativeSession081(tab);
      const snapshot = await readFormativeSnapshot081(tab.id, id);
      await sendFormativeUi081(tab.id, { title:'Lecture terminée', message:'Les résultats Formative ont été récupérés.', status:'success' });
      return { ok:true, payload:snapshot };
    } catch (error) {
      await sendFormativeUi081(tab?.id, { title:'Erreur Formative', message:error?.message || String(error), status:'error' });
      throw error;
    }
  }

  if (action === 'push') {
    const id = String(payload?.formativeId || ''), qid = String(payload?.questionId || '');
    if (!id || !qid) throw new Error('Le lien Formative est incomplet.');
    let tab = await focusOrOpenFormative(id);
    try {
      tab = await ensureFormativeSession081(tab);
      await focusTab(tab);
      await sendFormativeUi081(tab.id, { title:'Envoi vers Formative', message:`Je mets à jour ${Number(payload?.grades?.length || 0)} note${Number(payload?.grades?.length || 0)===1?'':'s'}…`, status:'working' });
      const tracked = formativeHeadersByTab.get(tab.id) || {};
      const rr = await chrome.scripting.executeScript({ target:{ tabId:tab.id }, world:'MAIN', func:formativeGradeInsidePage, args:[id, qid, payload.grades || [], tracked] });
      const out = rr?.[0]?.result;
      if (!out?.ok) throw new Error(out?.message || 'Formative n’a pas confirmé la mise à jour.');
      await sendFormativeUi081(tab.id, { title:'Mise à jour terminée', message:`${out.updatedCount || 0} note${Number(out.updatedCount || 0)===1?'':'s'} mise${Number(out.updatedCount || 0)===1?'':'s'} à jour dans Formative.`, status:'success' });
      return out;
    } catch (error) {
      await sendFormativeUi081(tab?.id, { title:'Erreur Formative', message:error?.message || String(error), status:'error' });
      throw error;
    }
  }
  throw new Error('Action Formative inconnue.');
};