(() => {
  if (window.__cardinalWorkStatsV01Installed) return;
  window.__cardinalWorkStatsV01Installed = true;

  function formatStatNumber(value, digits = 2) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '-';
    return Number.isInteger(n)
      ? String(n)
      : n.toLocaleString('fr-CA', { maximumFractionDigits: digits });
  }

  function median(values) {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function ensureStyles() {
    if (document.getElementById('cardinal-work-stats-style')) return;
    const style = document.createElement('style');
    style.id = 'cardinal-work-stats-style';
    style.textContent = `
      .work-stats-row{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}
      .work-stat{min-width:180px;padding:12px 14px;border:1px solid #dbe5f3;border-radius:14px;background:#f7f9fd}
      .work-stat-label{font-size:.73rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#65748a;margin-bottom:4px}
      .work-stat-main{font-size:1.08rem;font-weight:800;color:#0f172a;line-height:1.25}
      .work-stat-secondary{font-size:.86rem;color:#53657d;margin-top:2px}
      .work-stat-empty{color:#8a97a8}
      @media (max-width:720px){.work-stat{min-width:0;flex:1 1 145px}}
    `;
    document.head.appendChild(style);
  }

  function ensureContainer() {
    let box = document.getElementById('workStats');
    if (box) return box;
    const meta = document.getElementById('workMeta');
    if (!meta) return null;
    box = document.createElement('div');
    box.id = 'workStats';
    box.className = 'work-stats-row';
    meta.insertAdjacentElement('afterend', box);
    return box;
  }

  function metricMarkup(label, value, maxScore) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) {
      return `<div class="work-stat"><div class="work-stat-label">${label}</div><div class="work-stat-main work-stat-empty">-</div></div>`;
    }

    const max = Number(maxScore);
    const raw = Number(value);
    const rawLine = `${formatStatNumber(raw)} / ${formatStatNumber(max)}`;

    if (max === 100) {
      return `<div class="work-stat"><div class="work-stat-label">${label}</div><div class="work-stat-main">${rawLine}</div></div>`;
    }

    const on100 = max > 0 ? (raw / max) * 100 : null;
    const secondary = on100 === null
      ? ''
      : `<div class="work-stat-secondary">${formatStatNumber(on100, 1)} / 100</div>`;

    return `<div class="work-stat"><div class="work-stat-label">${label}</div><div class="work-stat-main">${rawLine}</div>${secondary}</div>`;
  }

  function renderWorkStats() {
    try {
      if (typeof state === 'undefined') return;
      const box = ensureContainer();
      if (!box) return;

      const assignment = state.currentAssignment;
      if (!assignment) {
        box.innerHTML = '';
        return;
      }

      const group = state.detailGroup || assignment.groups?.[0] || '';
      const grades = (state.currentStudents || [])
        .filter(student => !group || student.group === group)
        .map(student => student.grade)
        .filter(grade => grade !== null && grade !== undefined && grade !== '' && Number.isFinite(Number(grade)))
        .map(Number);

      const average = grades.length
        ? grades.reduce((sum, grade) => sum + grade, 0) / grades.length
        : null;
      const med = median(grades);
      const max = Number(assignment.maxScore || 0);

      box.innerHTML = `${metricMarkup('Moyenne', average, max)}${metricMarkup('Médiane', med, max)}`;
      box.title = grades.length
        ? `${grades.length} note${grades.length === 1 ? '' : 's'} prise${grades.length === 1 ? '' : 's'} en compte pour le groupe ${group}.`
        : `Aucune note saisie pour le groupe ${group}.`;
    } catch {}
  }

  function install() {
    try {
      if (
        typeof state === 'undefined' ||
        typeof renderGradeRows !== 'function' ||
        typeof commitGrade !== 'function'
      ) {
        setTimeout(install, 80);
        return;
      }

      ensureStyles();
      ensureContainer();

      if (!window.__cardinalWorkStatsWrapped) {
        window.__cardinalWorkStatsWrapped = true;

        const originalRenderGradeRows = renderGradeRows;
        renderGradeRows = function(...args) {
          const result = originalRenderGradeRows.apply(this, args);
          renderWorkStats();
          return result;
        };

        const originalCommitGrade = commitGrade;
        commitGrade = async function(...args) {
          const result = await originalCommitGrade.apply(this, args);
          renderWorkStats();
          return result;
        };

        document.getElementById('detailGroupSelect')?.addEventListener('change', () => {
          setTimeout(renderWorkStats, 0);
        });
      }

      renderWorkStats();
    } catch {
      setTimeout(install, 80);
    }
  }

  install();
})();