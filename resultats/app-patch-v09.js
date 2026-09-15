(() => {
  if (window.__cardinalV09Installed) return;
  window.__cardinalV09Installed = true;

  const ROSTER_ENDPOINT = 'https://ojyswaxuqwnqilrvtjll.supabase.co/functions/v1/school-roster';

  function knownGroups() {
    if (typeof state === 'undefined') return [];
    const set = new Set();
    Object.keys(state.groupStats || {}).forEach(g => g && set.add(String(g)));
    (state.teacherAssignments || []).forEach(a => (a.groups || []).forEach(g => g && set.add(String(g))));
    return [...set].sort((a,b) => a.localeCompare(b, 'fr', { numeric:true, sensitivity:'base' }));
  }

  function escAttr(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  }

  function selectedTargetGroups() {
    const checked = [...document.querySelectorAll('#groupChoices input:checked')].map(i => String(i.value));
    if (checked.length) return checked;
    const fromAssignment = (state.currentAssignment?.groups || []).map(String).filter(Boolean);
    if (fromAssignment.length) return fromAssignment;
    return state.dashboardGroup ? [String(state.dashboardGroup)] : [];
  }

  function renderAllGroupChoices() {
    const choices = document.getElementById('groupChoices');
    if (!choices || typeof state === 'undefined') return;
    const groups = knownGroups();
    if (!groups.length) return;
    const selected = new Set((state.currentAssignment?.groups || []).map(String));
    choices.innerHTML = groups.map(g =>
      `<label class="check-chip"><input type="checkbox" value="${escAttr(g)}" ${selected.has(g) ? 'checked' : ''}> ${escAttr(g)}</label>`
    ).join('');
  }

  function sameLevelCandidates() {
    const targets = selectedTargetGroups();
    const level = String(targets[0] || state.dashboardGroup || '').trim().charAt(0);
    const all = (state.teacherAssignments || []).filter(a => a?.id);
    if (!level) return all;
    const same = all.filter(a => (a.groups || []).some(g => String(g).trim().charAt(0) === level));
    return same.length ? same : all;
  }

  function refreshCopyOptions() {
    const select = document.getElementById('cardinalCopyWorkSelect');
    if (!select) return;
    const previous = select.value;
    const candidates = sameLevelCandidates();
    select.innerHTML = '<option value="">Choisir un travail existant...</option>' + candidates.map(a => {
      const groups = (a.groups || []).join(', ');
      return `<option value="${escAttr(a.id)}">Groupe${(a.groups||[]).length>1?'s':''} ${escAttr(groups)} · ${escAttr(a.title || 'Travail')}</option>`;
    }).join('');
    if (candidates.some(a => String(a.id) === previous)) select.value = previous;
  }

  function copyAssignmentSettings(source) {
    if (!source || !state.currentAssignment || state.currentAssignment.id) return;
    const groups = selectedTargetGroups();
    state.currentAssignment = {
      ...state.currentAssignment,
      title: source.title || state.currentAssignment.title,
      competenceKind: source.competenceKind || state.currentAssignment.competenceKind,
      competencies: Array.isArray(source.competencies) ? [...source.competencies] : state.currentAssignment.competencies,
      weight: source.weight ?? null,
      maxScore: Number(source.maxScore || 10),
      groups: groups.length ? groups : state.currentAssignment.groups,
      published: !!source.published,
      instructions: source.instructions || '',
      term: Number(source.term || 1),
      activityDate: source.activityDate || state.currentAssignment.activityDate,
      activityType: source.activityType || 'Évaluation',
      reportCardEnabled: !!source.reportCardEnabled,
      resultsVisible: !!source.resultsVisible,
      showInSchedule: source.showInSchedule !== false,
      homework: !!source.homework,
      period: Number(source.period || 3),
      mozaikSyncStatus: 'not_synced',
      competenceCode: '',
      formativeId: '',
      formativeAssignmentId: '',
      formativeSectionId: '',
      formativeTitle: '',
      formativeQuestionIds: [],
      formativeQuestionMeta: [],
      formativeLastSyncedAt: null,
    };
    if (typeof fillWorkPage === 'function') fillWorkPage();
    const stateEl = document.getElementById('saveState');
    if (stateEl) stateEl.textContent = 'Paramètres copiés. Vérifie puis enregistre.';
  }

  function ensureCopyControl() {
    const grid = document.querySelector('#workSettings .settings-grid');
    const choices = document.getElementById('groupChoices');
    if (!grid || !choices || typeof state === 'undefined') return;

    let row = document.getElementById('cardinalCopyWorkRow');
    if (state.currentAssignment?.id) {
      if (row) row.remove();
      return;
    }

    if (!row) {
      row = document.createElement('div');
      row.id = 'cardinalCopyWorkRow';
      row.className = 'span2';
      row.innerHTML = `
        <label class="field-label" for="cardinalCopyWorkSelect">Copier les paramètres d’un travail existant</label>
        <div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center">
          <select id="cardinalCopyWorkSelect" class="select"></select>
          <button id="cardinalCopyWorkBtn" class="btn btn-ghost" type="button">Copier</button>
        </div>
        <div class="hint">Propose d’abord les travaux du même niveau. Les notes, rétroactions et liens Formative/Mozaïk ne sont jamais copiés.</div>`;
      choices.closest('.span2')?.insertAdjacentElement('beforebegin', row);
      row.querySelector('#cardinalCopyWorkBtn')?.addEventListener('click', () => {
        const id = String(document.getElementById('cardinalCopyWorkSelect')?.value || '');
        const source = (state.teacherAssignments || []).find(a => String(a.id) === id);
        if (source) copyAssignmentSettings(source);
      });
    }
    refreshCopyOptions();
  }

  function mappingYear(group) {
    const establishment = String(group?.establishmentId || '');
    const id = String(group?.groupMatterId || group?.groupCourseId || '');
    if (!establishment || !id.startsWith(establishment)) return '';
    return id.slice(establishment.length).match(/^(20\d{2})/)?.[1] || '';
  }

  function ensureMappingBadge() {
    const syncState = document.getElementById('syncState');
    if (!syncState) return null;
    let badge = document.getElementById('cardinalMozaikMappingState');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'cardinalMozaikMappingState';
      badge.style.cssText = 'margin-top:6px;font-size:12px;color:#5b6b80;line-height:1.35';
      syncState.insertAdjacentElement('afterend', badge);
    }
    return badge;
  }

  let lastBadgeKey = '';
  async function refreshMappingBadge(force = false) {
    try {
      if (typeof state === 'undefined' || typeof api !== 'function' || !state.teacherToken) return;
      const groupCode = String(state.detailGroup || state.currentAssignment?.groups?.[0] || '');
      const badge = ensureMappingBadge();
      if (!badge || !groupCode) return;
      const key = `${groupCode}|${state.currentAssignment?.id || ''}`;
      if (!force && key === lastBadgeKey && badge.textContent) return;
      lastBadgeKey = key;
      const r = await api(ROSTER_ENDPOINT, { action:'discoveryConfig', teacherToken:state.teacherToken, groupCode });
      const g = r?.group;
      if (!g) {
        badge.textContent = `Groupe ${groupCode} : mapping Mozaïk à valider lors de la première synchronisation.`;
        return;
      }
      const y = mappingYear(g);
      badge.textContent = `Mapping Mozaïk validé pour le groupe ${groupCode}${y ? ` · ${y}-${Number(y)+1}` : ''}.`;
    } catch {}
  }

  function installWorkUiFixes() {
    try {
      if (typeof state === 'undefined' || typeof fillWorkPage !== 'function') {
        setTimeout(installWorkUiFixes, 100);
        return;
      }
      if (window.__cardinalWorkUiV09) return;
      window.__cardinalWorkUiV09 = true;

      const originalFill = fillWorkPage;
      fillWorkPage = function(...args) {
        const out = originalFill.apply(this, args);
        renderAllGroupChoices();
        ensureCopyControl();
        refreshMappingBadge();
        return out;
      };

      const groupChoices = document.getElementById('groupChoices');
      groupChoices?.addEventListener('change', () => refreshCopyOptions());
      const groupSelect = document.getElementById('detailGroupSelect');
      groupSelect?.addEventListener('change', () => setTimeout(() => refreshMappingBadge(true), 0));

      renderAllGroupChoices();
      ensureCopyControl();
      refreshMappingBadge(true);
    } catch {
      setTimeout(installWorkUiFixes, 100);
    }
  }

  function installRefreshBadge() {
    try {
      if (typeof refreshSyncState !== 'function') { setTimeout(installRefreshBadge, 120); return; }
      if (window.__cardinalMappingBadgeRefreshV09) return;
      window.__cardinalMappingBadgeRefreshV09 = true;
      const original = refreshSyncState;
      refreshSyncState = async function(...args) {
        const out = await original.apply(this, args);
        await refreshMappingBadge(true);
        return out;
      };
    } catch { setTimeout(installRefreshBadge, 120); }
  }

  installWorkUiFixes();
  installRefreshBadge();
})();
