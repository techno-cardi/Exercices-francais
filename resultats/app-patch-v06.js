(() => {
  if (window.__cardinalV06Installed) return;
  window.__cardinalV06Installed = true;

  function ensureWorkStats() {
    if (document.getElementById('cardinal-work-stats-v01')) return;
    const script = document.createElement('script');
    script.id = 'cardinal-work-stats-v01';
    script.src = 'work-stats-v01.js?v=1';
    script.async = false;
    (document.body || document.documentElement).appendChild(script);
  }

  async function refreshTeacherViews() {
    try {
      if (typeof refreshTeacherData !== 'function' || typeof state === 'undefined' || !state.teacherToken) return;
      await refreshTeacherData();

      const currentId = state.currentAssignment?.id;
      if (currentId) {
        const fresh = (state.teacherAssignments || []).find(a => String(a.id) === String(currentId));
        if (fresh && state.currentAssignment) {
          state.currentAssignment.mozaikSyncStatus = fresh.mozaikSyncStatus;
        }
      }

      const assignmentsView = document.getElementById('assignmentsView');
      const dashboardView = document.getElementById('teacherDashboard');
      if (assignmentsView && !assignmentsView.classList.contains('hidden') && typeof renderAssignmentList === 'function') {
        renderAssignmentList();
      }
      if (dashboardView && !dashboardView.classList.contains('hidden') && typeof renderDashboard === 'function') {
        renderDashboard();
      }
    } catch {}
  }

  function installSyncRefresh() {
    try {
      if (typeof state === 'undefined' || typeof refreshTeacherData !== 'function') {
        setTimeout(installSyncRefresh, 80);
        return;
      }

      const btn = document.getElementById('syncMozaikBtn');
      if (!btn || typeof btn.onclick !== 'function') {
        setTimeout(installSyncRefresh, 80);
        return;
      }

      if (btn.dataset.cardinalSyncRefreshV06 === '1') return;
      btn.dataset.cardinalSyncRefreshV06 = '1';

      const original = btn.onclick;
      btn.onclick = async function(...args) {
        try {
          return await original.apply(this, args);
        } finally {
          await refreshTeacherViews();
        }
      };

      document.querySelectorAll('.nav-item[data-teacher-view]').forEach(el => {
        if (el.dataset.cardinalRefreshV06 === '1') return;
        el.dataset.cardinalRefreshV06 = '1';
        el.addEventListener('click', () => {
          setTimeout(refreshTeacherViews, 0);
        });
      });

      document.querySelectorAll('.group-nav').forEach(el => {
        if (el.dataset.cardinalRefreshV06 === '1') return;
        el.dataset.cardinalRefreshV06 = '1';
        el.addEventListener('click', () => {
          setTimeout(refreshTeacherViews, 0);
        });
      });
    } catch {
      setTimeout(installSyncRefresh, 80);
    }
  }

  ensureWorkStats();
  installSyncRefresh();
})();