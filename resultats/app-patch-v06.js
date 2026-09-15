(() => {
  if (window.__cardinalV06Installed) return;
  window.__cardinalV06Installed = true;

  const DELETE_ASSIGNMENT_ENDPOINT = 'https://ojyswaxuqwnqilrvtjll.supabase.co/functions/v1/school-teacher-delete-assignment';

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

  function ensureDeleteStyle() {
    if (document.getElementById('cardinal-delete-style-v06')) return;
    const style = document.createElement('style');
    style.id = 'cardinal-delete-style-v06';
    style.textContent = `
      #deleteAssignmentBtn{margin-right:auto;border-color:#fecaca;color:#b91c1c;background:#fff7f7}
      #deleteAssignmentBtn:hover{background:#fee2e2;border-color:#fca5a5}
      #deleteAssignmentBtn:disabled{opacity:.45;cursor:not-allowed}
      .settings-actions{gap:10px}
    `;
    document.head.appendChild(style);
  }

  function updateDeleteButton() {
    const btn = document.getElementById('deleteAssignmentBtn');
    if (!btn || typeof state === 'undefined') return;
    const saved = !!state.currentAssignment?.id;
    btn.disabled = !saved;
    btn.hidden = !saved;
  }

  function installDeleteControl() {
    try {
      if (
        typeof state === 'undefined' ||
        typeof api !== 'function' ||
        typeof refreshTeacherData !== 'function' ||
        typeof renderAssignmentList !== 'function' ||
        typeof setTeacherSection !== 'function'
      ) {
        setTimeout(installDeleteControl, 80);
        return;
      }

      const actions = document.querySelector('#workSettings .settings-actions');
      if (!actions) {
        setTimeout(installDeleteControl, 80);
        return;
      }

      ensureDeleteStyle();

      let btn = document.getElementById('deleteAssignmentBtn');
      if (!btn) {
        btn = document.createElement('button');
        btn.id = 'deleteAssignmentBtn';
        btn.className = 'btn btn-ghost';
        btn.type = 'button';
        btn.textContent = 'Supprimer le travail';
        actions.insertBefore(btn, actions.firstChild);
      }

      if (btn.dataset.cardinalDeleteBound !== '1') {
        btn.dataset.cardinalDeleteBound = '1';
        btn.addEventListener('click', async () => {
          const assignment = state.currentAssignment;
          if (!assignment?.id) return;

          const title = String(assignment.title || 'ce travail');
          const group = state.detailGroup || assignment.groups?.[0] || '';
          const ok = window.confirm(
            `Supprimer « ${title} » de Gestion des notes?\n\n` +
            `Cette action supprime aussi ses notes, rétroactions et liens de synchronisation enregistrés dans Gestion des notes.\n\n` +
            `Elle ne supprime rien automatiquement dans Mozaïk ni dans Formative.`
          );
          if (!ok) return;

          const oldText = btn.textContent;
          btn.disabled = true;
          btn.textContent = 'Suppression...';

          try {
            await api(DELETE_ASSIGNMENT_ENDPOINT, {
              token: state.teacherToken,
              assignmentId: assignment.id,
            });

            state.currentAssignment = null;
            state.currentStudents = [];
            state.currentStudent = null;
            state.syncLinks = [];

            const url = new URL(location.href);
            url.searchParams.delete('travail');
            url.searchParams.delete('groupe');
            history.replaceState({}, '', url);

            await refreshTeacherData();
            if (group && document.getElementById('assignmentGroupFilter')) {
              document.getElementById('assignmentGroupFilter').value = group;
            }
            setTeacherSection('assignments');
            renderAssignmentList();
            if (typeof renderDashboard === 'function') renderDashboard();
            if (typeof notify === 'function') notify(`« ${title} » a été supprimé de Gestion des notes.`);
          } catch (error) {
            btn.disabled = false;
            btn.textContent = oldText;
            if (typeof notify === 'function') notify(error?.message || 'Impossible de supprimer le travail.', 'error');
          }
        });
      }

      if (!window.__cardinalDeleteFillWrapped && typeof fillWorkPage === 'function') {
        window.__cardinalDeleteFillWrapped = true;
        const originalFillWorkPage = fillWorkPage;
        fillWorkPage = function(...args) {
          const out = originalFillWorkPage.apply(this, args);
          updateDeleteButton();
          return out;
        };
      }

      updateDeleteButton();
    } catch {
      setTimeout(installDeleteControl, 80);
    }
  }

  ensureWorkStats();
  installSyncRefresh();
  installDeleteControl();
})();