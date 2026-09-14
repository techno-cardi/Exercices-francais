(() => {
  const V04_ID = 'cardinal-app-patch-v04';
  const V04_SRC = 'https://techno-cardi.github.io/Exercices-francais/resultats/app-patch-v04.js?v=6';

  function ensureV04() {
    if (document.getElementById(V04_ID) || window.__cardinalV04Installed) return;
    const script = document.createElement('script');
    script.id = V04_ID;
    script.src = V04_SRC;
    script.async = true;
    (document.head || document.documentElement).appendChild(script);
  }

  function ensureFormativeClient() {
    if (!document.querySelector('link[data-cardinal-formative]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'formative.css?v=81';
      link.dataset.cardinalFormative = '1';
      document.head.appendChild(link);
    }
    if (!document.getElementById('cardinal-formative-integration')) {
      const script = document.createElement('script');
      script.id = 'cardinal-formative-integration';
      script.src = 'formative-integration.js?v=81';
      script.async = false;
      (document.body || document.documentElement).appendChild(script);
    }
    if (!document.getElementById('cardinal-formative-safety-v081')) {
      const script = document.createElement('script');
      script.id = 'cardinal-formative-safety-v081';
      script.src = 'formative-safety-v081.js?v=1';
      script.async = false;
      (document.body || document.documentElement).appendChild(script);
    }
  }

  function installImmediateMozaikFeedback() {
    const btn = document.getElementById('syncMozaikBtn');
    if (!btn) {
      setTimeout(installImmediateMozaikFeedback, 80);
      return;
    }
    if (btn.dataset.cardinalImmediateV05 === '1') return;
    btn.dataset.cardinalImmediateV05 = '1';
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      window.postMessage({
        source: 'cardinal-mozaik-console',
        type: 'MOZAIK_EXTENSION_SHOW_PROGRESS'
      }, location.origin);
    }, true);
  }

  function currentRoute() {
    const params = new URLSearchParams(location.search);
    return {
      assignmentId: params.get('travail') || '',
      group: params.get('groupe') || ''
    };
  }

  function setAssignmentRoute(assignmentId, group, mode = 'replace') {
    const url = new URL(location.href);
    if (assignmentId) url.searchParams.set('travail', assignmentId);
    else url.searchParams.delete('travail');
    if (assignmentId && group) url.searchParams.set('groupe', group);
    else url.searchParams.delete('groupe');
    const method = mode === 'push' ? 'pushState' : 'replaceState';
    history[method]({ travail: assignmentId || null, groupe: group || null }, '', url);
  }

  function waitForAppNavigation() {
    try {
      if (
        typeof state === 'undefined' ||
        typeof openAssignment !== 'function' ||
        typeof renderGradeRows !== 'function' ||
        typeof refreshSyncState !== 'function' ||
        !window.__cardinalV04Installed
      ) {
        setTimeout(waitForAppNavigation, 80);
        return;
      }
      installNavigationPersistence();
    } catch {
      setTimeout(waitForAppNavigation, 80);
    }
  }

  function installNavigationPersistence() {
    if (window.__cardinalNavigationV05Installed) return;
    window.__cardinalNavigationV05Installed = true;

    const originalOpenAssignment = openAssignment;
    let restoring = false;

    openAssignment = async function(id) {
      await originalOpenAssignment(id);
      const route = currentRoute();
      const requestedGroup = restoring ? route.group : '';
      if (requestedGroup && state.currentAssignment?.groups?.includes(requestedGroup)) {
        state.detailGroup = requestedGroup;
        const select = document.getElementById('detailGroupSelect');
        if (select) select.value = requestedGroup;
        renderGradeRows();
        await refreshSyncState();
      }
      setAssignmentRoute(
        state.currentAssignment?.id || id,
        state.detailGroup || state.currentAssignment?.groups?.[0] || '',
        restoring ? 'replace' : 'push'
      );
    };

    const groupSelect = document.getElementById('detailGroupSelect');
    groupSelect?.addEventListener('change', () => {
      if (!state.currentAssignment?.id) return;
      setAssignmentRoute(state.currentAssignment.id, groupSelect.value || state.detailGroup || '', 'replace');
    });

    const back = document.getElementById('backToAssignments');
    back?.addEventListener('click', () => {
      setAssignmentRoute('', '', 'replace');
    }, true);

    document.querySelectorAll('.nav-item[data-teacher-view], .group-nav').forEach(el => {
      el.addEventListener('click', () => {
        setAssignmentRoute('', '', 'replace');
      }, true);
    });

    async function restoreAssignmentFromUrl() {
      const route = currentRoute();
      if (!route.assignmentId) return;

      const started = Date.now();
      while (Date.now() - started < 15000) {
        const teacherView = document.getElementById('teacherView');
        const ready = !!state.teacherToken && teacherView && !teacherView.classList.contains('hidden');
        if (ready) break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      if (!state.teacherToken) return;

      restoring = true;
      try {
        await openAssignment(route.assignmentId);
      } catch {
        setAssignmentRoute('', '', 'replace');
      } finally {
        restoring = false;
      }
    }

    window.addEventListener('popstate', async () => {
      const route = currentRoute();
      if (route.assignmentId) {
        restoring = true;
        try { await openAssignment(route.assignmentId); } finally { restoring = false; }
      } else if (typeof setTeacherSection === 'function') {
        setTeacherSection('dashboard');
        if (typeof renderDashboard === 'function') renderDashboard();
      }
    });

    restoreAssignmentFromUrl();
  }

  ensureV04();
  ensureFormativeClient();
  installImmediateMozaikFeedback();
  waitForAppNavigation();
})();