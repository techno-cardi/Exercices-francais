importScripts('background-v092.js');

// v0.9.3 beta: safer annual Mozaik discovery.
// Uses the last known Gestion mapping only as a navigation hint, then validates the
// discovered roster before the backend is allowed to replace group identifiers.

// Formative stays visually untouched until Cardinal is explicitly invoked.
// When UI is needed, inject the working interface and its stealth layer together.
ensureFormativeUi = async function(tabId) {
  if (!tabId) return;
  try {
    await chrome.tabs.sendMessage(tabId, { type:'CARDINAL_FORMATIVE_UI', title:'Formative', message:'', status:'working' });
  } catch {
    try {
      await chrome.scripting.executeScript({ target:{ tabId }, files:['formative-simple-ui.js','formative-stealth-v093.js'] });
    } catch {}
  }
};

function cleanFallbackGroup093(value, groupCode) {
  const g = value && typeof value === 'object' ? value : {};
  const establishmentId = String(g.establishmentId || '').trim();
  const groupCourseId = String(g.groupCourseId || '').trim();
  const groupMatterId = String(g.groupMatterId || '').trim();
  const subjectCode = String(g.subjectCode || '').trim();
  const code = String(groupCode || g.code || '').trim();
  if (!/^\d+$/.test(establishmentId) || !code) return null;
  if (!groupCourseId.endsWith(`-${code}`) || !groupMatterId.endsWith(`-${code}`)) return null;
  return { code, establishmentId, groupCourseId, groupMatterId, subjectCode };
}

async function rosterForGroup093(tabId, group) {
  try {
    const rr = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: extractOfficialRoster,
      args: [group]
    });
    return Array.isArray(rr?.[0]?.result) ? rr[0].result : [];
  } catch {
    return [];
  }
}

async function navigateFallbackGroup093(tab, fallback) {
  const groupCourseId = currentizePortalId(fallback.groupCourseId, fallback.establishmentId);
  const groupMatterId = currentizePortalId(fallback.groupMatterId, fallback.establishmentId);
  const group = { ...fallback, groupCourseId, groupMatterId };
  const url = `https://mozaikportail.ca/${group.establishmentId}/groupes/${group.groupCourseId}/eleves/liste`;
  try {
    const current = await chrome.tabs.get(tab.id);
    if (!String(current?.url || '').includes(`/groupes/${group.groupCourseId}/`)) {
      await chrome.tabs.update(tab.id, { url, active: true });
      await waitForTabComplete(tab.id, 45000);
    }
    await sleep(1400);
    await scanMozaikPage092(tab.id).catch(() => {});
  } catch {}
  return group;
}

async function discoverMozaikGroup093(groupCode, force = false, fallbackGroup = null) {
  const code = String(groupCode || '').trim();
  if (!code) throw new Error('Groupe manquant.');

  // First use passive/live discovery. This is the preferred path and avoids navigation.
  let first = null;
  try { first = await discoverMozaikGroup092(code, force); } catch {}
  if (first?.ok && Array.isArray(first.roster) && first.roster.length) {
    return { ...first, source: `${first.source || 'live'}+validated-roster` };
  }

  const fallback = cleanFallbackGroup093(fallbackGroup, code);
  if (!fallback) return first || { ok:false, message:`Le groupe ${code} n'a pas encore pu être détecté automatiquement dans Mozaïk.` };

  let tab = await focusOrOpenMozaik({ waitComplete:true });
  tab = await waitForAuthenticatedMozaikTab(tab.id, 180000);
  const currentizedFallback = await navigateFallbackGroup093(tab, fallback);

  // Navigation to the list normally causes Mozaik to reveal the current course/matter IDs.
  let second = null;
  try { second = await discoverMozaikGroup092(code, true); } catch {}
  if (second?.ok) {
    const roster = Array.isArray(second.roster) && second.roster.length
      ? second.roster
      : await rosterForGroup093(tab.id, second.group);
    return { ...second, roster, source:'fallback-navigation+live' };
  }

  // Last safe fallback: currentize the previous year's IDs and ask the live members API.
  // Supabase v3 will refuse to save changed IDs unless the returned roster matches Gestion.
  const roster = await rosterForGroup093(tab.id, currentizedFallback);
  if (!roster.length) {
    return first || { ok:false, message:`Je n'ai pas pu valider la liste officielle du groupe ${code}. La configuration Mozaïk existante reste inchangée.` };
  }
  return { ok:true, group:currentizedFallback, roster, source:'fallback-currentized+validated-roster' };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'DISCOVER_MOZAIK_GROUP_V2') return;
  (async () => {
    try {
      sendResponse(await discoverMozaikGroup093(message.groupCode, message.force === true, message.fallbackGroup || null));
    } catch (error) {
      sendResponse({ ok:false, message:error?.message || String(error) });
    }
  })();
  return true;
});