importScripts('background.js');

async function ensureSyncUi(tabId) {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['mozaik-ui.js'] });
  } catch {}
}

async function sendSyncUi(tabId, data) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'CARDINAL_MOZAIK_SYNC_UI', ...data });
  } catch {
    await ensureSyncUi(tabId);
    await sleep(120);
    try {
      await chrome.tabs.sendMessage(tabId, { type: 'CARDINAL_MOZAIK_SYNC_UI', ...data });
    } catch {}
  }
}

function roundedPayload(payload) {
  return {
    ...payload,
    results: (payload.results || []).map(r => ({
      ...r,
      grade: Number.isFinite(Number(r.grade))
        ? Math.round((Number(r.grade) + Number.EPSILON) * 10) / 10
        : r.grade
    }))
  };
}

async function focusOrOpenMozaik() {
  let tabs = await chrome.tabs.query({ url: MOZAIK_URL });
  tabs = [...tabs].sort((a, b) => Number(b.lastAccessed || 0) - Number(a.lastAccessed || 0));
  let tab = tabs[0];

  if (!tab?.id) {
    tab = await chrome.tabs.create({ url: MOZAIK_HOME, active: true });
    if (!tab?.id) throw new Error('Impossible d’ouvrir Mozaïk.');
    await waitForTabComplete(tab.id);
  } else {
    try { await chrome.windows.update(tab.windowId, { focused: true }); } catch {}
    await chrome.tabs.update(tab.id, { active: true });
    if (tab.status !== 'complete') await waitForTabComplete(tab.id);
  }

  await ensureSyncUi(tab.id);
  return tab;
}

async function extractOfficialRoster(group) {
  try {
    const API = 'https://apiaffaires.mozaikportail.ca';
    function norm(s){return String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
    function strings(o,d=0,out=[]){if(d>4||o==null)return out;if(typeof o==='string'){out.push(o);return out}if(typeof o!=='object')return out;for(const v of Object.values(o)){if(typeof v==='string')out.push(v);else if(v&&typeof v==='object')strings(v,d+1,out)}return out}
    function findField(o,names,d=0,seen=new WeakSet()){if(!o||typeof o!=='object'||d>5||seen.has(o))return null;seen.add(o);for(const[k,v]of Object.entries(o)){const nk=norm(k).replace(/ /g,'');if(names.includes(nk)&&v!=null&&typeof v!=='object')return v}for(const v of Object.values(o)){const r=findField(v,names,d+1,seen);if(r!=null)return r}return null}
    function findToken(){const root=window.authentification;if(!root)return null;const seen=new WeakSet(),stack=[root];let steps=0;while(stack.length&&steps++<2500){const o=stack.pop();if(!o||typeof o!=='object'||seen.has(o))continue;seen.add(o);try{if(typeof o.AccessToken==='string'&&o.AccessToken.length>40)return o.AccessToken}catch{}let vals=[];try{vals=Object.values(o)}catch{}for(const v of vals)if(v&&typeof v==='object')stack.push(v)}return null}
    const token=findToken();if(!token)return[];
    const response=await fetch(`${API}/api/organisationscolaire/groupes/${group.establishmentId}/${group.groupMatterId}/membres`,{
      headers:{Authorization:'Bearer '+token,Accept:'application/json, text/plain, */*','Encode-Response':'false'}
    });
    if(!response.ok)return[];
    const data=await response.json();
    const members=Array.isArray(data)?data:(data?.membres||[]);
    return members.map(m=>{
      const email=strings(m).map(x=>String(x).trim().toLowerCase()).find(x=>x.endsWith('@educ.cscapitale.qc.ca'))||'';
      const firstName=String(findField(m,['prenom','firstname','first'])||'').trim();
      const lastName=String(findField(m,['nom','lastname','last','nomfamille'])||'').trim();
      return{email,firstName,lastName};
    }).filter(x=>x.email&&x.firstName&&x.lastName);
  } catch { return []; }
}

async function openActivityFromList(tabId, meta) {
  const establishmentId = String(meta.establishmentId || '');
  const groupCourseId = String(meta.groupCourseId || '');
  const activityId = String(meta.activityId || '');
  const activityTitle = String(meta.activityTitle || '');

  if (!establishmentId || !groupCourseId) return false;

  const listUrl = `https://mozaikportail.ca/${establishmentId}/groupes/${groupCourseId}/evaluation/activites/liste`;
  await chrome.tabs.update(tabId, { url: listUrl, active: true });
  try { await waitForTabComplete(tabId, 45000); } catch {}
  await sleep(550);

  function findAndOpen(activityId, activityTitle) {
    const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
    const wanted = norm(activityTitle);
    const started = Date.now();

    return new Promise(resolve => {
      const tick = () => {
        const links = [...document.querySelectorAll('a[href]')];

        if (activityId) {
          const direct = links.find(a => String(a.getAttribute('href') || '').includes(activityId));
          if (direct) {
            direct.click();
            resolve(true);
            return;
          }
        }

        if (wanted) {
          const titleLink = links.find(a => {
            const t = norm(a.textContent);
            return t === wanted || t.includes(wanted) || wanted.includes(t);
          });
          if (titleLink) {
            titleLink.click();
            resolve(true);
            return;
          }

          const clickable = [...document.querySelectorAll('button,[role="button"],[role="link"]')].find(el => {
            const t = norm(el.textContent);
            return t === wanted || t.includes(wanted) || wanted.includes(t);
          });
          if (clickable) {
            clickable.click();
            resolve(true);
            return;
          }

          const textNode = [...document.querySelectorAll('td,div,span')].find(el => norm(el.textContent) === wanted);
          if (textNode) {
            const parent = textNode.closest('a,button,[role="button"],[role="link"]') || textNode.parentElement?.closest('a,button,[role="button"],[role="link"]');
            if (parent) {
              parent.click();
              resolve(true);
              return;
            }
          }
        }

        if (Date.now() - started > 15000) {
          resolve(false);
          return;
        }
        setTimeout(tick, 350);
      };
      tick();
    });
  }

  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: findAndOpen,
      args: [activityId, activityTitle]
    });
    return !!result;
  } catch {
    return false;
  }
}

handleSync = async function(payload) {
  if (!payload?.assignment || !payload?.group || !Array.isArray(payload?.results)) {
    throw new Error('Le lot de synchronisation est incomplet.');
  }

  const tab = await focusOrOpenMozaik();

  await sendSyncUi(tab.id, {
    status: 'working',
    progress: 18,
    title: 'Synchronisation en cours',
    message: 'Connexion à Mozaïk…'
  });

  const normalized = roundedPayload(payload);

  await sendSyncUi(tab.id, {
    status: 'working',
    progress: 42,
    title: 'Synchronisation en cours',
    message: 'Préparation du travail et des notes…',
    indeterminate: true
  });

  let result;
  try {
    const executed = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: syncInsideMozaik,
      args: [normalized]
    });
    result = executed?.[0]?.result;
    if (!result || typeof result !== 'object') throw new Error('Mozaïk n’a retourné aucun résultat exploitable.');
  } catch (error) {
    result = { success: false, message: error?.message || String(error), syncedCount: 0 };
  }

  await sendSyncUi(tab.id, {
    status: 'working',
    progress: 84,
    title: 'Synchronisation en cours',
    message: 'Vérification finale…'
  });

  let roster = [];
  try {
    const rr = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: extractOfficialRoster,
      args: [normalized.group]
    });
    roster = Array.isArray(rr?.[0]?.result) ? rr[0].result : [];
  } catch {}

  if (result.success) {
    await sendSyncUi(tab.id, {
      status: 'success',
      progress: 100,
      title: 'Synchronisation terminée',
      message: `${result.syncedCount || 0} note${Number(result.syncedCount||0)===1?'':'s'} envoyée${Number(result.syncedCount||0)===1?'':'s'} avec succès.`,
      closable: true,
      canOpenActivity: true,
      activityId: result.activityId || '',
      activityTitle: normalized.assignment?.title || '',
      establishmentId: normalized.group?.establishmentId || '',
      groupCourseId: normalized.group?.groupCourseId || ''
    });
  } else {
    await sendSyncUi(tab.id, {
      status: 'error',
      progress: 100,
      title: 'Échec de la synchronisation',
      message: result.message || 'La synchronisation a échoué.',
      closable: true
    });
  }

  return { ...result, roster };
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'SHOW_MOZAIK_SYNC_UI') {
    (async () => {
      try {
        const tab = await focusOrOpenMozaik();
        await sendSyncUi(tab.id, {
          status: 'working',
          progress: 6,
          title: 'Synchronisation en cours',
          message: 'Préparation de la synchronisation…',
          indeterminate: true
        });
        sendResponse({ ok: true });
      } catch (error) {
        sendResponse({ ok: false, message: error?.message || String(error) });
      }
    })();
    return true;
  }

  if (message?.type === 'CLOSE_MOZAIK_TAB' && sender.tab?.id) {
    chrome.tabs.remove(sender.tab.id).catch(() => {});
    return;
  }

  if (message?.type === 'OPEN_MOZAIK_ACTIVITY' && sender.tab?.id) {
    const tabId = sender.tab.id;
    openActivityFromList(tabId, message).catch(() => {});
  }
});
