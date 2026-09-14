importScripts('background.js');

let extensionOpenedTabId = null;

async function ensureSyncUi(tabId) {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['mozaik-ui.js'] });
  } catch {}
}

async function sendSyncUi(tabId, data) {
  if (!tabId) return;
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

function academicYearStart() {
  const d = new Date();
  return d.getMonth() < 6 ? d.getFullYear() - 1 : d.getFullYear();
}

function currentizePortalId(raw, establishmentId) {
  const s = String(raw || '');
  const e = String(establishmentId || '');
  if (!s || !e) return s;
  return s.replace(new RegExp('^' + e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\d{4}'), e + academicYearStart());
}

async function focusTab(tab) {
  if (!tab?.id) return;
  try { await chrome.windows.update(tab.windowId, { focused: true }); } catch {}
  try { await chrome.tabs.update(tab.id, { active: true }); } catch {}
}

async function mozaikTabs() {
  const tabs = await chrome.tabs.query({ url: MOZAIK_URL });
  return [...tabs].sort((a, b) => {
    if (!!a.active !== !!b.active) return a.active ? -1 : 1;
    return Number(b.lastAccessed || 0) - Number(a.lastAccessed || 0);
  });
}

async function focusOrOpenMozaik({ waitComplete = false } = {}) {
  const tabs = await mozaikTabs();
  let tab = tabs[0];

  if (!tab?.id) {
    tab = await chrome.tabs.create({ url: MOZAIK_HOME, active: true });
    if (!tab?.id) throw new Error('Impossible d’ouvrir Mozaïk.');
    extensionOpenedTabId = tab.id;
  } else {
    await focusTab(tab);
  }

  if (waitComplete && tab.status !== 'complete') {
    try { await waitForTabComplete(tab.id, 45000); } catch {}
    try { tab = await chrome.tabs.get(tab.id); } catch {}
  }

  if (tab?.id && tab.status === 'complete') await ensureSyncUi(tab.id);
  return tab;
}

async function hasMozaikToken(tabId) {
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: () => {
        const root = window.authentification;
        if (!root || typeof root !== 'object') return false;
        const seen = new WeakSet();
        const stack = [root];
        let steps = 0;
        while (stack.length && steps++ < 3000) {
          const o = stack.pop();
          if (!o || typeof o !== 'object' || seen.has(o)) continue;
          seen.add(o);
          try {
            if (typeof o.AccessToken === 'string' && o.AccessToken.length > 40) return true;
          } catch {}
          let vals = [];
          try { vals = Object.values(o); } catch {}
          for (const v of vals) if (v && typeof v === 'object') stack.push(v);
        }
        return false;
      }
    });
    return result === true;
  } catch {
    return false;
  }
}

async function waitForAuthenticatedMozaikTab(initialTabId, timeout = 180000) {
  const started = Date.now();
  let lastShownTabId = null;

  while (Date.now() - started < timeout) {
    const tabs = await mozaikTabs();

    for (const tab of tabs) {
      if (!tab?.id || tab.status !== 'complete') continue;
      if (await hasMozaikToken(tab.id)) {
        await focusTab(tab);
        await ensureSyncUi(tab.id);
        await sendSyncUi(tab.id, {
          status: 'working',
          progress: 24,
          title: 'Connexion détectée',
          message: 'Mozaïk est connecté. La synchronisation reprend automatiquement…',
          indeterminate: true
        });

        if (extensionOpenedTabId && extensionOpenedTabId !== tab.id) {
          try {
            const old = await chrome.tabs.get(extensionOpenedTabId);
            if (old?.url?.startsWith('https://mozaikportail.ca/')) {
              await chrome.tabs.remove(extensionOpenedTabId);
            }
          } catch {}
          extensionOpenedTabId = null;
        }
        return tab;
      }
    }

    const candidate = tabs.find(t => t?.id && t.status === 'complete') || tabs[0];
    if (candidate?.id && candidate.id !== lastShownTabId) {
      lastShownTabId = candidate.id;
      await focusTab(candidate);
      await ensureSyncUi(candidate.id);
      await sendSyncUi(candidate.id, {
        status: 'working',
        progress: 14,
        title: 'Connexion requise',
        message: 'Connecte-toi à Mozaïk. La synchronisation reprendra automatiquement dès que la connexion sera terminée.',
        indeterminate: true
      });
    }

    await sleep(500);
  }

  throw new Error('La connexion à Mozaïk a expiré. Connecte-toi au portail puis réessaie.');
}

async function extractOfficialRoster(group) {
  try {
    const API = 'https://apiaffaires.mozaikportail.ca';
    function norm(s){return String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
    function strings(o,d=0,out=[]){if(d>4||o==null)return out;if(typeof o==='string'){out.push(o);return out}if(typeof o!=='object')return out;for(const v of Object.values(o)){if(typeof v==='string')out.push(v);else if(v&&typeof v==='object')strings(v,d+1,out)}return out}
    function findField(o,names,d=0,seen=new WeakSet()){if(!o||typeof o!=='object'||d>5||seen.has(o))return null;seen.add(o);for(const[k,v]of Object.entries(o)){const nk=norm(k).replace(/ /g,'');if(names.includes(nk)&&v!=null&&typeof v!=='object')return v}for(const v of Object.values(o)){const r=findField(v,names,d+1,seen);if(r!=null)return r}return null}
    function findToken(){const root=window.authentification;if(!root)return null;const seen=new WeakSet(),stack=[root];let steps=0;while(stack.length&&steps++<3000){const o=stack.pop();if(!o||typeof o!=='object'||seen.has(o))continue;seen.add(o);try{if(typeof o.AccessToken==='string'&&o.AccessToken.length>40)return o.AccessToken}catch{}let vals=[];try{vals=Object.values(o)}catch{}for(const v of vals)if(v&&typeof v==='object')stack.push(v)}return null}
    const token=findToken();if(!token)return[];
    const groupMatterId = String(group.groupMatterId || '');
    const response=await fetch(`${API}/api/organisationscolaire/groupes/${group.establishmentId}/${groupMatterId}/membres`,{
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

async function navigateToActivity(tabId, meta) {
  const establishmentId = String(meta.establishmentId || '');
  const groupCourseId = currentizePortalId(meta.groupCourseId || '', establishmentId);
  const activityId = String(meta.activityId || '');
  const activityTitle = String(meta.activityTitle || '');

  if (!establishmentId || !groupCourseId) return false;

  const groupHome = `https://mozaikportail.ca/${establishmentId}/groupes/${groupCourseId}/eleves/liste`;
  try {
    const current = await chrome.tabs.get(tabId);
    if (!String(current.url || '').includes(`/groupes/${groupCourseId}/`)) {
      await chrome.tabs.update(tabId, { url: groupHome, active: true });
      await waitForTabComplete(tabId, 45000);
      await sleep(900);
    }
  } catch {
    return false;
  }

  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: async (activityId, activityTitle) => {
        const wait = ms => new Promise(r => setTimeout(r, ms));
        const norm = s => String(s || '')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .replace(/\s+/g, ' ')
          .trim();

        const visible = el => {
          if (!el) return false;
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden';
        };

        const click = el => {
          if (!el) return false;
          try { el.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch {}
          try { el.click(); } catch {
            el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
          }
          return true;
        };

        function clickables() {
          return [...document.querySelectorAll('a[href],button,[role="button"],[role="link"]')].filter(visible);
        }

        function activityElement() {
          const els = clickables();
          if (activityId) {
            const byId = els.find(el => String(el.getAttribute('href') || '').includes(activityId));
            if (byId) return byId;
          }
          const wanted = norm(activityTitle);
          if (!wanted) return null;
          return els.find(el => norm(el.textContent) === wanted)
            || els.find(el => {
              const t = norm(el.textContent);
              return t && (t.includes(wanted) || wanted.includes(t)) && t.length < wanted.length + 90;
            })
            || null;
        }

        function evaluationLink() {
          const els = clickables();
          return els.find(el => {
            const href = String(el.getAttribute('href') || '').toLowerCase();
            return href.includes('/evaluation') || href.includes('/evaluations');
          }) || els.find(el => {
            const text = norm(el.textContent);
            const aria = norm(el.getAttribute('aria-label'));
            const title = norm(el.getAttribute('title'));
            return [text, aria, title].some(v => v === 'evaluation' || v === 'evaluations' || v.includes('evaluation'));
          }) || null;
        }

        function activitiesLink() {
          const els = clickables();
          return els.find(el => {
            const href = String(el.getAttribute('href') || '').toLowerCase();
            return href.includes('activit');
          }) || els.find(el => {
            const text = norm(el.textContent);
            const aria = norm(el.getAttribute('aria-label'));
            const title = norm(el.getAttribute('title'));
            return [text, aria, title].some(v => v.includes('activite') || v.includes('resultat'));
          }) || null;
        }

        async function waitFor(fn, timeout = 7000) {
          const start = Date.now();
          while (Date.now() - start < timeout) {
            const value = fn();
            if (value) return value;
            await wait(250);
          }
          return null;
        }

        let target = activityElement();
        if (target) {
          click(target);
          return { ok: true, stage: 'direct' };
        }

        const evalLink = evaluationLink();
        if (evalLink) {
          click(evalLink);
          await wait(1000);
        }

        target = await waitFor(activityElement, 2500);
        if (target) {
          click(target);
          return { ok: true, stage: 'evaluation' };
        }

        const actLink = activitiesLink();
        if (actLink) {
          click(actLink);
          await wait(1100);
        }

        target = await waitFor(activityElement, 8000);
        if (target) {
          click(target);
          return { ok: true, stage: 'activities' };
        }

        const lateEval = evaluationLink();
        if (lateEval) {
          click(lateEval);
          await wait(900);
          const lateAct = activitiesLink();
          if (lateAct) {
            click(lateAct);
            await wait(900);
          }
          target = await waitFor(activityElement, 6000);
          if (target) {
            click(target);
            return { ok: true, stage: 'late' };
          }
        }

        return { ok: false };
      },
      args: [activityId, activityTitle]
    });
    return !!result?.ok;
  } catch {
    return false;
  }
}

handleSync = async function(payload) {
  if (!payload?.assignment || !payload?.group || !Array.isArray(payload?.results)) {
    throw new Error('Le lot de synchronisation est incomplet.');
  }

  const normalized = roundedPayload(payload);
  normalized.group = {
    ...normalized.group,
    groupCourseId: currentizePortalId(normalized.group.groupCourseId, normalized.group.establishmentId),
    groupMatterId: currentizePortalId(normalized.group.groupMatterId, normalized.group.establishmentId)
  };

  const initial = await focusOrOpenMozaik({ waitComplete: true });

  await sendSyncUi(initial.id, {
    status: 'working',
    progress: 10,
    title: 'Synchronisation en cours',
    message: 'Vérification de la connexion Mozaïk…',
    indeterminate: true
  });

  const tab = await waitForAuthenticatedMozaikTab(initial.id);

  await sendSyncUi(tab.id, {
    status: 'working',
    progress: 38,
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
    if (!result || typeof result !== 'object') {
      throw new Error('Mozaïk n’a retourné aucun résultat exploitable.');
    }
  } catch (error) {
    result = { success: false, message: error?.message || String(error), syncedCount: 0 };
  }

  await sendSyncUi(tab.id, {
    status: 'working',
    progress: 86,
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
        const tab = await focusOrOpenMozaik({ waitComplete: false });
        if (tab?.id) {
          setTimeout(async () => {
            try {
              const fresh = await chrome.tabs.get(tab.id);
              if (fresh.status === 'complete') {
                await ensureSyncUi(tab.id);
                await sendSyncUi(tab.id, {
                  status: 'working',
                  progress: 5,
                  title: 'Synchronisation en cours',
                  message: 'Préparation de la synchronisation…',
                  indeterminate: true
                });
              }
            } catch {}
          }, 250);
        }
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
    (async () => {
      try {
        await chrome.windows.update(sender.tab.windowId, { focused: true });
        await chrome.tabs.update(tabId, { active: true });
      } catch {}

      const ok = await navigateToActivity(tabId, message);
      if (!ok) {
        await sendSyncUi(tabId, {
          status: 'error',
          progress: 100,
          title: 'Travail introuvable',
          message: 'La synchronisation est réussie, mais Mozaïk n’a pas exposé le lien du travail dans cette vue.',
          closable: true
        });
      }
    })();
  }
});

// ---- Formative connector v0.8 ------------------------------------------------
const FORMATIVE_RESULTS_URL = 'https://app.formative.com/formatives/*/results*';
const GESTION_URL = 'https://techno-cardi.github.io/Exercices-francais/resultats/*';
const formativeHeadersByTab = new Map();

try {
  chrome.webRequest.onBeforeSendHeaders.addListener(
    details => {
      if (details.tabId < 0 || !details.url.startsWith('https://svc.goformative.com/graphql/')) return;
      const allow = new Set(['x-user-id','x-session-id','x-tab-id','x-app-version','x-anonymous-id']);
      const headers = {};
      for (const h of details.requestHeaders || []) {
        const key = String(h.name || '').toLowerCase();
        if (allow.has(key) && h.value) headers[key] = h.value;
      }
      if (Object.keys(headers).length) formativeHeadersByTab.set(details.tabId, headers);
    },
    { urls: ['https://svc.goformative.com/*'] },
    ['requestHeaders', 'extraHeaders']
  );
} catch {}

function sleepFormative(ms) { return new Promise(r => setTimeout(r, ms)); }

async function formativeTabs(formativeId = '') {
  const tabs = await chrome.tabs.query({ url: 'https://app.formative.com/formatives/*/results*' });
  const sorted = [...tabs].sort((a,b) => Number(b.lastAccessed || 0) - Number(a.lastAccessed || 0));
  if (!formativeId) return sorted;
  const exact = sorted.filter(t => String(t.url || '').includes(`/formatives/${formativeId}/results`));
  return exact.length ? exact : sorted;
}

async function focusOrOpenFormative(formativeId = '') {
  let tabs = await formativeTabs(formativeId);
  let tab = tabs[0];
  if (!tab?.id) {
    if (!formativeId) throw new Error('Ouvre d’abord un travail Formative dans l’onglet Réponses.');
    tab = await chrome.tabs.create({ url: `https://app.formative.com/formatives/${formativeId}/results`, active: true });
    if (!tab?.id) throw new Error('Impossible d’ouvrir Formative.');
  } else {
    await focusTab(tab);
  }
  if (tab.status !== 'complete') {
    try { await waitForTabComplete(tab.id, 45000); } catch {}
    try { tab = await chrome.tabs.get(tab.id); } catch {}
  }
  return tab;
}

async function waitForFormativeTab(formativeId = '', timeout = 120000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const tabs = await formativeTabs(formativeId);
    for (const tab of tabs) {
      if (!tab?.id || tab.status !== 'complete') continue;
      if (formativeHeadersByTab.has(tab.id)) return tab;
    }
    if (tabs[0]?.id) await focusTab(tabs[0]);
    await sleepFormative(500);
  }
  throw new Error('La connexion à Formative n’a pas été détectée. Connecte-toi à Formative puis réessaie.');
}

async function formativeSnapshotInsidePage(formativeId, trackedHeaders) {
  const API = 'https://svc.goformative.com/graphql';
  const headers = {
    'content-type': 'application/json',
    'accept': 'application/graphql-response+json,application/json;q=0.9',
    ...(trackedHeaders || {})
  };
  async function gql(kind, name, variables, query) {
    const r = await fetch(`${API}/${kind}/${name}`, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify({ operationName: name, variables, extensions: { clientLibrary: { name: '@apollo/client', version: '4.2.7' } }, query })
    });
    const text = await r.text();
    let data = null;
    try { data = JSON.parse(text); } catch {}
    if (!r.ok || data?.errors?.length) {
      const msg = data?.errors?.[0]?.message || text || `HTTP ${r.status}`;
      throw new Error(`${name}: ${msg}`);
    }
    return data?.data || {};
  }
  function plainText(value) {
    if (!value) return '';
    try {
      const root = typeof value === 'string' ? JSON.parse(value) : value;
      const out = [];
      const walk = o => {
        if (!o) return;
        if (typeof o === 'string') { out.push(o); return; }
        if (Array.isArray(o)) { o.forEach(walk); return; }
        if (typeof o === 'object') {
          if (typeof o.text === 'string') out.push(o.text);
          if (Array.isArray(o.content)) o.content.forEach(walk);
        }
      };
      walk(root);
      return out.join(' ').replace(/\s+/g,' ').trim();
    } catch { return String(value).replace(/\s+/g,' ').trim(); }
  }

  const resultsQuery = `query Results($formativeId: ID!) {
    formative(id: $formativeId) {
      _id title
      assignments: teacherAssignments {
        _id
        section { _id title studentCount }
      }
      items {
        _id questionNumber type subtype text
        details { points }
      }
    }
  }`;
  const rd = await gql('query','Results',{ formativeId },resultsQuery);
  const f = rd?.formative;
  if (!f?._id) throw new Error('Formative introuvable ou session expirée.');
  const assignment = (f.assignments || []).find(a => a?.section?._id) || f.assignments?.[0];
  if (!assignment?._id || !assignment?.section?._id) throw new Error('Aucune classe assignée n’a été trouvée pour ce Formative.');
  const sectionId = assignment.section._id;
  const assignmentId = assignment._id;

  const studentsQuery = `query ResultsSummarySection($sectionId: ID!, $assignmentId: ID!, $formativeId: ID!, $archivedEnrollments: Boolean) {
    students: users(sections: [$sectionId], assignments: [$assignmentId], archivedEnrollments: $archivedEnrollments) {
      nodes {
        _id emails { address } firstName lastName
        answers(formativeId: $formativeId, latestSubmissionOnly: true) {
          nodes { _id points possiblePoints gradedAt formativeItem { _id } }
        }
      }
    }
  }`;
  let studentNodes = [];
  try {
    const sd = await gql('query','ResultsSummarySection',{ sectionId, assignmentId, formativeId, archivedEnrollments:false },studentsQuery);
    studentNodes = sd?.students?.nodes || [];
  } catch {
    const listQuery = `query ResultsSummarySection($sectionId: ID!, $assignmentId: ID!, $archivedEnrollments: Boolean) {
      students: users(sections: [$sectionId], assignments: [$assignmentId], archivedEnrollments: $archivedEnrollments) {
        nodes { _id emails { address } firstName lastName }
      }
    }`;
    const sd = await gql('query','ResultsSummarySection',{ sectionId, assignmentId, archivedEnrollments:false },listQuery);
    const basic = sd?.students?.nodes || [];
    const answerQuery = `query ResultsSummaryUserAnswers($userId: ID!, $formativeId: ID!, $latestSubmissionOnly: Boolean) {
      student: user(id: $userId) {
        _id
        answers(formativeId: $formativeId, latestSubmissionOnly: $latestSubmissionOnly) {
          nodes { _id points possiblePoints gradedAt formativeItem { _id } }
        }
      }
    }`;
    for (let i=0; i<basic.length; i+=6) {
      const batch = basic.slice(i,i+6);
      const answers = await Promise.all(batch.map(async s => {
        const x = await gql('query','ResultsSummaryUserAnswers',{ userId:s._id, formativeId, latestSubmissionOnly:true },answerQuery);
        return { ...s, answers: x?.student?.answers || { nodes: [] } };
      }));
      studentNodes.push(...answers);
    }
  }

  const questions = (f.items || [])
    .filter(x => x?.type === 'question')
    .map(x => ({
      id: String(x._id || ''),
      number: String(x.questionNumber || ''),
      label: plainText(x.text) || `Question ${x.questionNumber || ''}`.trim(),
      possiblePoints: Number(x?.details?.points || 0),
      gradedCount: 0
    }));
  const questionMap = new Map(questions.map(q => [q.id,q]));
  const students = studentNodes.map(s => {
    const answers = (s?.answers?.nodes || []).map(a => {
      const qid = String(a?.formativeItem?._id || '');
      if (a?.points !== null && a?.points !== undefined && Number.isFinite(Number(a.points)) && questionMap.has(qid)) questionMap.get(qid).gradedCount++;
      return {
        questionId: qid,
        answerId: String(a?._id || ''),
        points: a?.points === null || a?.points === undefined ? null : Number(a.points),
        possiblePoints: Number(a?.possiblePoints || 0),
        gradedAt: a?.gradedAt || null
      };
    });
    const email = (s?.emails || []).map(e => String(e?.address || '').trim().toLowerCase()).find(Boolean) || '';
    return { id:String(s?._id||''), email, firstName:String(s?.firstName||''), lastName:String(s?.lastName||''), answers };
  }).filter(s => s.email);

  const groupMatch = String(assignment.section.title || '').match(/(?:groupe|group)\s*(31|32|51)\b/i);
  return {
    id: String(f._id),
    formativeId: String(f._id),
    assignmentId: String(assignmentId),
    sectionId: String(sectionId),
    sectionTitle: String(assignment.section.title || ''),
    groupCode: groupMatch ? groupMatch[1] : '',
    title: String(f.title || 'Formative'),
    studentCount: Number(assignment.section.studentCount || students.length),
    questions,
    students
  };
}

async function readFormativeSnapshot(tabId, formativeId) {
  const tracked = formativeHeadersByTab.get(tabId) || {};
  const result = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: formativeSnapshotInsidePage,
    args: [formativeId, tracked]
  });
  const data = result?.[0]?.result;
  if (!data?.formativeId) throw new Error('Formative n’a retourné aucune donnée exploitable.');
  return data;
}

async function formativeGradeInsidePage(formativeId, questionId, grades, trackedHeaders) {
  const API = 'https://svc.goformative.com/graphql';
  const headers = {
    'content-type': 'application/json',
    'accept': 'application/graphql-response+json,application/json;q=0.9',
    ...(trackedHeaders || {})
  };
  async function gql(kind,name,variables,query) {
    const r = await fetch(`${API}/${kind}/${name}`, { method:'POST', credentials:'include', headers, body:JSON.stringify({ operationName:name, variables, extensions:{clientLibrary:{name:'@apollo/client',version:'4.2.7'}}, query }) });
    const text = await r.text(); let data=null; try{data=JSON.parse(text)}catch{}
    if(!r.ok || data?.errors?.length) throw new Error(data?.errors?.[0]?.message || text || `HTTP ${r.status}`);
    return data?.data || {};
  }
  const resultQ = `query Results($formativeId: ID!) { formative(id:$formativeId){ _id assignments:teacherAssignments{_id section{_id title}} } }`;
  const rd = await gql('query','Results',{formativeId},resultQ);
  const f=rd?.formative; const assignment=(f?.assignments||[]).find(a=>a?.section?._id)||f?.assignments?.[0];
  if(!assignment?._id||!assignment?.section?._id) throw new Error('Classe Formative introuvable.');
  const sectionId=assignment.section._id, assignmentId=assignment._id;
  const listQ=`query ResultsSummarySection($sectionId: ID!, $assignmentId: ID!, $formativeId: ID!, $archivedEnrollments: Boolean) {
    students:users(sections:[$sectionId],assignments:[$assignmentId],archivedEnrollments:$archivedEnrollments){nodes{_id emails{address} answers(formativeId:$formativeId,latestSubmissionOnly:true){nodes{_id points possiblePoints formativeItem{_id}}}}}
  }`;
  let studentNodes=[];
  try {
    const sd=await gql('query','ResultsSummarySection',{sectionId,assignmentId,formativeId,archivedEnrollments:false},listQ);
    studentNodes=sd?.students?.nodes||[];
  } catch {
    const basicQ=`query ResultsSummarySection($sectionId: ID!, $assignmentId: ID!, $archivedEnrollments: Boolean) {
      students:users(sections:[$sectionId],assignments:[$assignmentId],archivedEnrollments:$archivedEnrollments){nodes{_id emails{address}}}
    }`;
    const sd=await gql('query','ResultsSummarySection',{sectionId,assignmentId,archivedEnrollments:false},basicQ);
    const basic=sd?.students?.nodes||[];
    const answerQ=`query ResultsSummaryUserAnswers($userId: ID!, $formativeId: ID!, $latestSubmissionOnly: Boolean) {
      student:user(id:$userId){_id answers(formativeId:$formativeId,latestSubmissionOnly:$latestSubmissionOnly){nodes{_id points possiblePoints formativeItem{_id}}}}
    }`;
    for(let i=0;i<basic.length;i+=6){
      const batch=basic.slice(i,i+6);
      const loaded=await Promise.all(batch.map(async st=>{
        const x=await gql('query','ResultsSummaryUserAnswers',{userId:st._id,formativeId,latestSubmissionOnly:true},answerQ);
        return {...st,answers:x?.student?.answers||{nodes:[]}};
      }));
      studentNodes.push(...loaded);
    }
  }
  const byEmail=new Map();
  for(const s of studentNodes){const email=(s.emails||[]).map(e=>String(e.address||'').trim().toLowerCase()).find(Boolean);if(email)byEmail.set(email,s)}
  const targets=[];
  for(const g of grades||[]){const email=String(g.email||'').trim().toLowerCase();const n=Number(g.grade);if(!email||!Number.isFinite(n))continue;const s=byEmail.get(email);const a=(s?.answers?.nodes||[]).find(x=>String(x?.formativeItem?._id||'')===String(questionId));if(!a?._id)continue;const max=Number(a.possiblePoints||0);if(!(max>0)||n<0||n>max)throw new Error(`Note invalide pour ${email}: ${n} / ${max}.`);targets.push({answerId:String(a._id),points:n,possiblePoints:max})}
  if(!targets.length)throw new Error('Aucune réponse Formative correspondante n’a été trouvée.');
  const groups=new Map();
  for(const t of targets){const key=`${t.points}|${t.possiblePoints}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(t.answerId)}
  const mutation=`mutation ResultsSelectedItemSidebarGradeAnswers($answerIds: [ID!]!, $points: Float!, $scoreFactor: Float, $rubricLevels: [AnswerRubricLevelInput!]!) {
    teacherGradeAnswers(answerIds:$answerIds,points:$points,scoreFactor:$scoreFactor,rubricLevels:$rubricLevels){_id gradedAt points possiblePoints scoreFactor updatedAt}
  }`;
  let count=0;
  for(const [key,answerIds] of groups){const [p,m]=key.split('|').map(Number);await gql('mutation','ResultsSelectedItemSidebarGradeAnswers',{answerIds,points:p,scoreFactor:p/m,rubricLevels:[]},mutation);count+=answerIds.length}
  return { ok:true, updatedCount:count };
}

async function deliverFormativeImport(payload) {
  let tabs = await chrome.tabs.query({ url: GESTION_URL });
  let tab = [...tabs].sort((a,b)=>Number(b.lastAccessed||0)-Number(a.lastAccessed||0))[0];
  if (!tab?.id) {
    tab = await chrome.tabs.create({ url: 'https://techno-cardi.github.io/Exercices-francais/resultats/?formativeImport=1', active: true });
    if (!tab?.id) throw new Error('Impossible d’ouvrir Gestion des notes.');
    try { await waitForTabComplete(tab.id, 45000); } catch {}
  } else await focusTab(tab);
  for (let i=0;i<20;i++) {
    try {
      const r = await chrome.tabs.sendMessage(tab.id,{ type:'FORMATIVE_IMPORT_AVAILABLE', payload });
      if (r?.ok) return true;
    } catch {}
    await sleepFormative(350);
  }
  throw new Error('Gestion des notes est ouverte, mais le connecteur n’a pas encore répondu. Recharge la page puis réessaie.');
}

async function handleFormativeSendToGestion(senderTab, formativeId) {
  if (!senderTab?.id) throw new Error('Onglet Formative introuvable.');
  const snapshot = await readFormativeSnapshot(senderTab.id, formativeId);
  await deliverFormativeImport(snapshot);
  return { ok:true, groupCode:snapshot.groupCode, questionCount:snapshot.questions.length, studentCount:snapshot.students.length };
}

async function handleFormativeRequest(action,payload) {
  if (action === 'captureActive') {
    const tab = await focusOrOpenFormative('');
    const id = String(tab.url||'').match(/\/formatives\/([^/]+)\/results/)?.[1] || '';
    if (!id) throw new Error('Ouvre un travail Formative dans l’onglet Réponses.');
    return { ok:true, payload: await readFormativeSnapshot(tab.id,id) };
  }
  if (action === 'pull') {
    const id = String(payload?.formativeId||'');
    if (!id) throw new Error('Ce travail n’est pas lié à Formative.');
    let tab = await focusOrOpenFormative(id);
    if (!formativeHeadersByTab.has(tab.id)) tab = await waitForFormativeTab(id);
    return { ok:true, payload: await readFormativeSnapshot(tab.id,id) };
  }
  if (action === 'push') {
    const id=String(payload?.formativeId||''), qid=String(payload?.questionId||'');
    if(!id||!qid)throw new Error('Le lien Formative est incomplet.');
    let tab=await focusOrOpenFormative(id);
    if(!formativeHeadersByTab.has(tab.id))tab=await waitForFormativeTab(id);
    await focusTab(tab);
    const tracked=formativeHeadersByTab.get(tab.id)||{};
    const rr=await chrome.scripting.executeScript({target:{tabId:tab.id},world:'MAIN',func:formativeGradeInsidePage,args:[id,qid,payload.grades||[],tracked]});
    const out=rr?.[0]?.result;
    if(!out?.ok)throw new Error(out?.message||'Formative n’a pas confirmé la mise à jour.');
    return out;
  }
  throw new Error('Action Formative inconnue.');
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'FORMATIVE_SEND_TO_GESTION') {
    (async()=>{
      try { sendResponse(await handleFormativeSendToGestion(sender.tab, String(message.formativeId||''))); }
      catch(error){ sendResponse({ok:false,message:error?.message||String(error)}); }
    })();
    return true;
  }
  if (message?.type === 'FORMATIVE_REQUEST') {
    (async()=>{
      try { sendResponse(await handleFormativeRequest(String(message.action||''), message.payload||{})); }
      catch(error){ sendResponse({ok:false,message:error?.message||String(error)}); }
    })();
    return true;
  }
});
