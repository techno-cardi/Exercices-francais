(() => {
  if (window.__cardinalFormativeFeedbackBridgeV01) return;
  window.__cardinalFormativeFeedbackBridgeV01 = true;

  const FEEDBACK_ENDPOINT = 'https://ojyswaxuqwnqilrvtjll.supabase.co/functions/v1/school-formative-feedback';
  const FORMATIVE_EXT_SOURCE = 'cardinal-formative-extension';

  function escFb(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  }

  function commentsForAssignment(items, assignmentId) {
    return (items || []).filter(x => String(x.assignmentId || '') === String(assignmentId || ''));
  }

  function commentsMarkup(items) {
    if (!items.length) return '';
    return `<div class="formative-student-feedbacks">${items.map(item => {
      const label = item.questionNumber ? `Question ${escFb(item.questionNumber)}` : (item.questionLabel ? escFb(item.questionLabel) : 'Rétroaction');
      return `<div class="formative-student-feedback"><strong>${label}</strong><p>${escFb(item.feedback || '')}</p></div>`;
    }).join('')}</div>`;
  }

  function ensureStyles() {
    if (document.getElementById('formative-feedback-bridge-style')) return;
    const style = document.createElement('style');
    style.id = 'formative-feedback-bridge-style';
    style.textContent = `
      .formative-student-feedbacks{display:grid;gap:8px;margin-top:12px}
      .formative-student-feedback{padding:10px 12px;border:1px solid #dbe5f3;border-radius:12px;background:#f7f9fd}
      .formative-student-feedback strong{display:block;font-size:.78rem;color:#53657d;margin-bottom:4px}
      .formative-student-feedback p{margin:0;white-space:pre-wrap;line-height:1.45}
    `;
    document.head.appendChild(style);
  }

  function installStudentDashboard() {
    try {
      if (typeof loadStudentDashboard !== 'function' || typeof api !== 'function' || typeof state === 'undefined') {
        setTimeout(installStudentDashboard, 80);
        return;
      }
      if (window.__cardinalStudentFeedbackDashboardWrapped) return;
      window.__cardinalStudentFeedbackDashboardWrapped = true;

      loadStudentDashboard = async function() {
        const [d, feedbackData] = await Promise.all([
          api(DATA_ENDPOINT, { action: 'studentDashboard', token: state.studentToken }),
          api(FEEDBACK_ENDPOINT, { action: 'studentList', token: state.studentToken }).catch(() => ({ items: [] }))
        ]);
        const feedbackItems = feedbackData.items || [];
        show(bootView, false);
        show(loginView, false);
        show(teacherView, false);
        show(studentView, true);
        show(logoutBtn, true);
        $('studentName').textContent = d.user.name;
        $('studentMeta').textContent = `${d.user.email} · Groupe ${d.user.group}`;
        const graded = d.assignments.filter(a => a.result && a.result.grade !== null);
        $('studentSummary').innerHTML = `<strong>${graded.length}</strong><span>résultat${graded.length === 1 ? '' : 's'}</span>`;
        $('studentAssignments').innerHTML = d.assignments.length ? d.assignments.map(a => {
          const formComments = commentsForAssignment(feedbackItems, a.id);
          return `
          <article class="card student-card">
            <div class="eyebrow">${a.result ? 'Travail corrigé' : 'Travail'}</div>
            <h2>${esc(a.title)}</h2>
            <div class="meta-row">
              <span class="pill">${(a.competencies || []).map(esc).join(' · ') || 'Français'}</span>
              ${a.weight !== null ? `<span class="pill gray">${a.weight}%</span>` : ''}
            </div>
            ${a.result ? `<h3>${a.result.grade === null ? 'Non noté' : `${formatNumber(a.result.grade)} / ${formatNumber(a.maxScore)}`}</h3>${a.result.feedback ? `<p>${esc(a.result.feedback)}</p>` : ''}` : `<p class="muted">Aucun résultat publié.</p>`}
            ${commentsMarkup(formComments)}
          </article>`;
        }).join('') : '<div class="card" style="padding:28px">Aucun travail publié pour le moment.</div>';
      };
    } catch {
      setTimeout(installStudentDashboard, 80);
    }
  }

  function refreshRestoredStudentDashboard() {
    try {
      if (!window.__cardinalStudentFeedbackDashboardWrapped) {
        setTimeout(refreshRestoredStudentDashboard, 120);
        return;
      }
      if (window.__cardinalStudentFeedbackInitialRefreshDone) return;
      const view = document.getElementById('studentView');
      if (typeof state === 'undefined' || !state.studentToken || !view || view.classList.contains('hidden')) return;
      window.__cardinalStudentFeedbackInitialRefreshDone = true;
      Promise.resolve(loadStudentDashboard()).catch(() => {});
    } catch {}
  }

  async function saveIncomingFeedback(payload) {
    if (!payload?.formativeId || !Array.isArray(payload?.items) || !payload.items.length) return;
    if (typeof state === 'undefined' || !state.teacherToken) {
      sessionStorage.setItem('pending_formative_chatgpt_feedback', JSON.stringify(payload));
      return;
    }

    try {
      if (typeof refreshTeacherData === 'function') await refreshTeacherData();
      const group = String(payload.groupCode || '');
      const linked = (state.teacherAssignments || []).filter(a =>
        String(a.formativeId || '') === String(payload.formativeId) &&
        (!group || (a.groups || []).includes(group))
      );

      const saveItems = [];
      for (const item of payload.items) {
        for (const assignment of linked) {
          const qids = (assignment.formativeQuestionIds || []).map(String);
          if (qids.length && !qids.includes(String(item.formativeItemId || item.questionId || ''))) continue;
          saveItems.push({
            assignmentId: assignment.id,
            email: item.email,
            formativeItemId: item.formativeItemId || item.questionId,
            questionNumber: item.questionNumber || '',
            questionLabel: item.questionLabel || '',
            feedback: item.feedback || '',
            feedbackMessageId: item.feedbackMessageId || null,
          });
        }
      }

      if (!saveItems.length) {
        sessionStorage.setItem('pending_formative_chatgpt_feedback', JSON.stringify(payload));
        if (typeof notify === 'function') notify('Commentaires publiés dans Formative. Aucun travail lié à ces questions dans Gestion des notes pour le moment.', 'success');
        return;
      }

      const out = await api(FEEDBACK_ENDPOINT, {
        action: 'saveBatch',
        token: state.teacherToken,
        formativeId: payload.formativeId,
        items: saveItems
      });
      sessionStorage.removeItem('pending_formative_chatgpt_feedback');
      if (typeof notify === 'function') notify(`${out.savedCount || 0} commentaire${Number(out.savedCount || 0) === 1 ? '' : 's'} Formative copié${Number(out.savedCount || 0) === 1 ? '' : 's'} dans Gestion des notes.`);
    } catch (error) {
      sessionStorage.setItem('pending_formative_chatgpt_feedback', JSON.stringify(payload));
      if (typeof notify === 'function') notify(error?.message || String(error), 'error');
    }
  }

  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin || event.data?.source !== FORMATIVE_EXT_SOURCE) return;
    if (event.data.type === 'FORMATIVE_CHATGPT_FEEDBACK_AVAILABLE') {
      saveIncomingFeedback(event.data.payload || {});
    }
  });

  function retryPending() {
    try {
      const raw = sessionStorage.getItem('pending_formative_chatgpt_feedback');
      if (!raw || typeof state === 'undefined' || !state.teacherToken) return;
      const payload = JSON.parse(raw);
      if (payload?.formativeId) saveIncomingFeedback(payload);
    } catch {}
  }

  ensureStyles();
  installStudentDashboard();
  setTimeout(refreshRestoredStudentDashboard, 350);
  setInterval(retryPending, 1800);
})();