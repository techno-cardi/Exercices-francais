(() => {
  if (window.__cardinalV08Installed) return;
  window.__cardinalV08Installed = true;

  const ROSTER_ENDPOINT = 'https://ojyswaxuqwnqilrvtjll.supabase.co/functions/v1/school-roster';
  const PAGE_SOURCE = 'cardinal-mozaik-console';
  const EXT_SOURCE = 'cardinal-mozaik-extension';
  const pendingDiscovery = new Map();
  let groupUiFingerprint = '';

  function versionAtLeast(v, min) {
    const a = String(v || '0').split('.').map(Number), b = String(min || '0').split('.').map(Number);
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const x = a[i] || 0, y = b[i] || 0;
      if (x > y) return true;
      if (x < y) return false;
    }
    return true;
  }

  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin || event.data?.source !== EXT_SOURCE) return;
    if (event.data.type !== 'MOZAIK_EXTENSION_DISCOVERY_RESULT_V3') return;
    const id = String(event.data.requestId || '');
    const p = pendingDiscovery.get(id);
    if (!p) return;
    pendingDiscovery.delete(id);
    clearTimeout(p.timer);
    p.resolve(event.data.result || { ok:false, message:'Aucune réponse de détection.' });
  });

  function discoverGroup(groupCode, fallbackGroup) {
    return new Promise((resolve, reject) => {
      const requestId = crypto.randomUUID();
      const timer = setTimeout(() => {
        pendingDiscovery.delete(requestId);
        reject(new Error('La détection automatique Mozaïk a expiré.'));
      }, 150000);
      pendingDiscovery.set(requestId, { resolve, reject, timer });
      window.postMessage({
        source: PAGE_SOURCE,
        type: 'MOZAIK_EXTENSION_DISCOVER_GROUP_V3',
        requestId,
        groupCode: String(groupCode || ''),
        force: false,
        fallbackGroup: fallbackGroup || null,
      }, location.origin);
    });
  }

  async function getFallbackConfig(groupCode) {
    try {
      const r = await api(ROSTER_ENDPOINT, {
        action: 'discoveryConfig',
        teacherToken: state.teacherToken,
        groupCode: String(groupCode || ''),
      });
      return r?.group || null;
    } catch {
      return null;
    }
  }

  async function syncDiscoveryToBackend(result, groupCode) {
    if (!result?.ok || typeof api !== 'function' || !state?.teacherToken) return null;
    const candidates = Array.isArray(result.candidates) ? result.candidates.filter(c => c?.group) : [];
    if (candidates.length > 1) {
      return api(ROSTER_ENDPOINT, {
        action: 'syncDiscoveryCandidates',
        teacherToken: state.teacherToken,
        groupCode: String(groupCode || ''),
        candidates,
      });
    }
    if (!result.group) return null;
    return api(ROSTER_ENDPOINT, {
      action: 'syncDiscovery',
      teacherToken: state.teacherToken,
      groupCode: String(groupCode || ''),
      group: result.group,
      students: Array.isArray(result.roster) ? result.roster : [],
    });
  }

  function knownGroups() {
    if (typeof state === 'undefined') return [];
    const set = new Set();
    Object.keys(state.groupStats || {}).forEach(g => g && set.add(String(g)));
    (state.teacherAssignments || []).forEach(a => (a.groups || []).forEach(g => g && set.add(String(g))));
    return [...set].sort((a,b) => a.localeCompare(b, 'fr', { numeric:true, sensitivity:'base' }));
  }

  function rebuildGroupUi() {
    try {
      if (typeof state === 'undefined') return;
      const groups = knownGroups();
      if (!groups.length) return;
      const fingerprint = groups.join('|');
      if (fingerprint === groupUiFingerprint) return;
      groupUiFingerprint = fingerprint;

      if (!groups.includes(String(state.dashboardGroup || ''))) {
        state.dashboardGroup = groups[0];
        localStorage.setItem('results_dashboard_group', groups[0]);
      }

      const sidebar = document.querySelector('.sidebar');
      if (sidebar) {
        sidebar.querySelectorAll('.group-nav').forEach(el => el.remove());
        const labels = [...sidebar.querySelectorAll('.sidebar-label')];
        const label = labels.find(el => String(el.textContent || '').trim().toLowerCase() === 'groupes');
        if (label) {
          let anchor = label;
          for (const group of groups) {
            const b = document.createElement('button');
            b.className = `nav-item group-nav${String(state.dashboardGroup) === group ? ' active' : ''}`;
            b.dataset.group = group;
            b.type = 'button';
            b.textContent = `Groupe ${group}`;
            b.onclick = () => {
              if (typeof selectDashboardGroup === 'function') selectDashboardGroup(group, true);
            };
            anchor.insertAdjacentElement('afterend', b);
            anchor = b;
          }
        }
      }

      const filter = document.getElementById('assignmentGroupFilter');
      if (filter) {
        const old = filter.value;
        filter.innerHTML = '<option value="">Tous les groupes</option>' + groups.map(g => `<option value="${String(g).replace(/"/g,'&quot;')}">${g}</option>`).join('');
        filter.value = groups.includes(old) ? old : '';
      }

      const choices = document.getElementById('groupChoices');
      if (choices) {
        const checked = new Set([...choices.querySelectorAll('input:checked')].map(i => i.value));
        const assignmentGroups = new Set(state.currentAssignment?.groups || []);
        choices.innerHTML = groups.map(g => {
          const on = checked.has(g) || assignmentGroups.has(g);
          return `<label class="check-chip"><input type="checkbox" value="${String(g).replace(/"/g,'&quot;')}" ${on ? 'checked' : ''}> ${g}</label>`;
        }).join('');
      }

      if (typeof renderDashboard === 'function' && document.getElementById('teacherDashboard') && !document.getElementById('teacherDashboard').classList.contains('hidden')) {
        renderDashboard();
      }
    } catch {}
  }

  function installSyncDiscovery() {
    try {
      if (typeof state === 'undefined' || typeof api !== 'function') { setTimeout(installSyncDiscovery, 120); return; }
      const btn = document.getElementById('syncMozaikBtn');
      if (!btn || typeof btn.onclick !== 'function') { setTimeout(installSyncDiscovery, 120); return; }
      if (btn.dataset.cardinalDiscoveryV08 === '1') return;
      btn.dataset.cardinalDiscoveryV08 = '1';
      const original = btn.onclick;

      btn.onclick = async function(...args) {
        const group = String(state.detailGroup || state.currentAssignment?.groups?.[0] || '');
        const canDiscover = group && versionAtLeast(state.extensionVersion, '0.9.4.0');
        if (!canDiscover) return original.apply(this, args);

        const oldText = btn.textContent;
        const syncState = document.getElementById('syncState');
        try {
          btn.disabled = true;
          btn.textContent = 'Détection Mozaïk...';
          if (syncState) syncState.textContent = `Validation automatique du groupe ${group} dans Mozaïk…`;
          const fallbackGroup = await getFallbackConfig(group);
          const result = await discoverGroup(group, fallbackGroup);
          if (!result?.ok) throw new Error(result?.message || `Le groupe ${group} n’a pas pu être validé dans Mozaïk.`);
          const saved = await syncDiscoveryToBackend(result, group);
          if (!saved?.groupSaved) throw new Error('La configuration Mozaïk détectée n’a pas été validée par Gestion.');
          if (syncState) {
            const matched = Number(saved.rosterMatched || 0);
            const n = Number(saved.rosterUpdated || 0);
            const y = saved.group?.academicYearStart ? ` · ${saved.group.academicYearStart}-${Number(saved.group.academicYearStart)+1}` : '';
            syncState.textContent = `Groupe ${group} validé${y}${matched ? ` · ${matched} élève${matched===1?'':'s'} reconnu${matched===1?'':'s'}` : ''}${n ? ` · ${n} nom${n===1?'':'s'} officiel${n===1?'':'s'} mis à jour` : ''}. Préparation de la synchronisation…`;
          }
        } catch (error) {
          if (syncState) syncState.textContent = error?.message || 'La détection Mozaïk n’a pas pu être validée.';
          if (typeof notify === 'function') notify(error?.message || 'La détection Mozaïk n’a pas pu être validée.', 'error');
          return;
        } finally {
          btn.disabled = false;
          btn.textContent = oldText;
        }
        return original.apply(this, args);
      };
    } catch {
      setTimeout(installSyncDiscovery, 120);
    }
  }

  function ensureGlobalImportPatch() {
    if (document.getElementById('cardinal-formative-global-v01')) return;
    const script = document.createElement('script');
    script.id = 'cardinal-formative-global-v01';
    script.src = 'formative-global-v01.js?v=2';
    script.async = false;
    (document.body || document.documentElement).appendChild(script);
  }

  ensureGlobalImportPatch();
  installSyncDiscovery();
  rebuildGroupUi();
  setInterval(rebuildGroupUi, 800);
})();