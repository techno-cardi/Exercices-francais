(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CardinalGestionImportCore = api;
})(globalThis, function () {
  'use strict';
  const emailKey = value => String(value || '').trim().toLowerCase();
  const text = value => String(value == null ? '' : value).trim();
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const numeric = value => (finite(value) ? value : typeof value === 'string' && value.trim() && Number.isFinite(Number(value)) ? Number(value) : null);
  const positive = value => finite(value) && value > 0;
  const round = value => Math.round((value + Number.EPSILON) * 10) / 10;
  const owns = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  function uniqueMap(values, key, kind, allowEmpty) {
    const map = new Map();
    for (const value of values) {
      const id = key(value);
      if (!id && allowEmpty) continue;
      if (!id) throw new Error('Une information manque pour reconnaître cet élément (' + kind + ').');
      if (map.has(id)) throw new Error('Un doublon a été détecté (' + kind + '). Vérifie les données avant de réessayer.');
      map.set(id, value);
    }
    return map;
  }
  function displayName(rosterStudent, sourceStudent, email) {
    const first = text(rosterStudent?.first_name) || text(sourceStudent?.firstName);
    const last = text(rosterStudent?.last_name) || text(sourceStudent?.lastName);
    return { name: [first, last].filter(Boolean).join(' ') || text(rosterStudent?.name) || email || 'Élève à associer',
      surname: last || text(rosterStudent?.name).split(/\s+/).pop() || email };
  }
  function validateHierarchy(questions, byQuestion, selectedIds, hierarchy) {
    const parents = new Set();
    if (hierarchy != null && !Array.isArray(hierarchy)) throw new Error('La hiérarchie Formative doit fournir les identités de tous les éléments natifs.');
    const byItem = hierarchy == null ? byQuestion : uniqueMap(hierarchy, item => text(item.id), 'hiérarchie Formative');
    for (const question of questions) {
      if (['children', 'subparts', 'childIds'].some(key => question[key] != null && (!Array.isArray(question[key]) || question[key].length))) {
        throw new Error('La hiérarchie des sous-parties Formative n’est pas prise en charge. Actualise une source détaillée avant de confirmer.');
      }
      const item = byItem.get(text(question.id));
      if (!item || (hierarchy != null && text(item.kind) !== 'question') || (owns(question, 'parentId') && text(question.parentId) !== text(item.parentId))) {
        throw new Error('La hiérarchie Formative ne correspond pas aux questions et à leurs parents. Actualise les données avant de confirmer.');
      }
    }
    for (const item of byItem.values()) {
      const visited = new Set([text(item.id)]);
      let parentId = text(item.parentId);
      while (parentId) {
        if (!byItem.has(parentId) || visited.has(parentId)) throw new Error('La hiérarchie Formative contient un parent inconnu ou un cycle. Vérifie les sous-parties avant de confirmer.');
        visited.add(parentId);
        if (byQuestion.has(text(item.id))) parents.add(parentId);
        parentId = text(byItem.get(parentId).parentId);
      }
    }
    if (selectedIds.some(id => parents.has(id))) throw new Error('Une question parent contient des sous-parties : choisis uniquement ses questions finales pour éviter un double total.');
  }
  function selectedGlobalTotal(total, byQuestion, selectedIds) {
    if (total == null) return null;
    const ids = total.questionIds;
    if (!Array.isArray(ids) || !ids.length || ids.some(id => !text(id) || !byQuestion.has(text(id))) || new Set(ids.map(text)).size !== ids.length) {
      throw new Error('Le total global Formative doit identifier ses questions disponibles sans doublon.');
    }
    return ids.length === selectedIds.length && ids.every(id => selectedIds.includes(text(id))) ? total : null;
  }
  /** Pure preview. Inputs use DB snake_case for assignment, roster and results.
   * Writes use camelCase canonical fields; sourceLink is ready for assignment storage.
   * Duplicate identities fail the whole preview; blocked rows never produce writes.
   * Optional authoritative totals must be supplied by the source, never synthesized:
   * formative.globalTotal = { questionIds, possiblePoints }; student.globalTotal =
   * { questionIds, points, possiblePoints }. Only exact selection scopes apply.
   * A matching incomplete student total is preserved as incomplete, not summed.
   * Flat questions may carry parentId. Optional formative.hierarchy contains all
   * native items as { id, parentId, kind }, including context/content ancestors.
   * Only graded leaves can be selected. Nested or unresolved hierarchies are
   * rejected before preview/confirmation.
   */
  function buildPreview(input) {
    const { formative: f, assignment = null, results = [], roster = [] } = input || {};
    if (!f || !text(f.formativeId || f.id) || !text(f.assignmentId) || !text(f.sectionId)) throw new Error('Les informations du travail Formative sont incomplètes. Actualise les données avant de réessayer.');
    const groupCode = text(f.groupCode);
    if (!groupCode) throw new Error('Le groupe Formative n’a pas été reconnu.');
    if (assignment && (!Array.isArray(assignment.group_codes) || assignment.group_codes.length !== 1 || text(assignment.group_codes[0]) !== groupCode)) {
      throw new Error('Choisis un travail propre au groupe actuel. Les travaux partagés doivent d’abord être séparés par groupe.');
    }
    const questions = Array.isArray(f.questions) ? f.questions : [];
    const byQuestion = uniqueMap(questions, q => text(q.id), 'question');
    const ids = input.selectedQuestionIds;
    if (!Array.isArray(ids) || !ids.length || ids.some(id => !text(id) || !byQuestion.has(text(id))) || new Set(ids.map(text)).size !== ids.length) {
      throw new Error('Choisis au moins une question disponible, sans sélectionner deux fois la même question.');
    }
    const selectedIds = ids.map(text);
    const selected = selectedIds.map(id => byQuestion.get(id));
    validateHierarchy(questions, byQuestion, selectedIds, f.hierarchy);
    const globalTotal = selectedGlobalTotal(f.globalTotal, byQuestion, selectedIds);
    if (selected.some(q => !positive(q.possiblePoints))) throw new Error('Le maximum de chaque question choisie doit être un nombre supérieur à zéro.');
    const sourceMaxScore = globalTotal ? globalTotal.possiblePoints : selected.reduce((sum, q) => sum + q.possiblePoints, 0);
    if (!positive(sourceMaxScore) || sourceMaxScore > 1000) throw new Error('Le maximum des questions doit être supérieur à zéro et ne pas dépasser 1 000 points.');
    const scaleMode = input.scaleMode == null ? assignment?.formative_scale_mode || 'origin' : input.scaleMode;
    if (scaleMode !== 'origin' && scaleMode !== 'hundred') throw new Error('Choisis le maximum d’origine ou la conversion sur 100.');
    const targetMaxScore = scaleMode === 'hundred' ? 100 : sourceMaxScore;
    const beforeMax = assignment ? numeric(assignment.max_score) : null;
    const maxChanged = !!assignment && beforeMax !== targetMaxScore;
    const students = Array.isArray(f.students) ? f.students : [];
    uniqueMap(students, s => text(s.id), 'élève Formative', true);
    const studentMap = uniqueMap(students, s => emailKey(s.email), 'adresse courriel Formative', true);
    const rosterMap = uniqueMap(roster, s => emailKey(s.email), 'adresse courriel de la liste de classe');
    const resultMap = uniqueMap(results, r => emailKey(r.student_email), 'résultat d’élève');
    const answersByStudent = new Map();
    const totalsByStudent = new Map();
    for (const student of students) {
      totalsByStudent.set(student, selectedGlobalTotal(student.globalTotal, byQuestion, selectedIds));
      const answers = Array.isArray(student.answers) ? student.answers : [];
      uniqueMap(answers, a => text(a.answerId), 'réponse Formative', true);
      answersByStudent.set(student, uniqueMap(answers, a => text(a.questionId), 'réponse à une question'));
    }
    const selectedEmails = input.selectedEmails == null ? null : new Set(input.selectedEmails.map(emailKey));
    const allEmails = new Set([...studentMap.keys(), ...resultMap.keys(), ...roster.filter(s => s.active === true && text(s.group_code) === groupCode).map(s => emailKey(s.email))]);
    const rows = [], writes = [], unmatched = [];
    const counts = { add: 0, replace: 0, rescale: 0, unchanged: 0, blocked: 0, modified: 0 };
    function addRow(email, student) {
      const rosterStudent = rosterMap.get(email), prev = resultMap.get(email);
      const name = displayName(rosterStudent, student, email);
      const oldGrade = prev ? numeric(prev.grade) : null;
      const row = { email, name: name.name, action: 'unchanged', reason: '', beforeGrade: oldGrade, afterGrade: oldGrade,
        beforeMax, targetMaxScore, baseScore: null, baseMax: null, sourceKind: null };
      let canonical = null, incoming = null;
      const canImport = !!email && rosterStudent?.active === true && text(rosterStudent.group_code) === groupCode;
      // A historical result remains part of its assignment after the student moves
      // or becomes inactive. Preserve its proportion, but do not import new data.
      const hasHistoricalResult = !!email && !!assignment && !!prev;
      if (!canImport && !hasHistoricalResult) {
        row.action = 'blocked'; row.reason = 'Élève à associer : absent de la liste active du groupe actuel.';
        unmatched.push({ email, reason: row.reason });
      } else {
        if (prev && oldGrade !== null) {
          const hasCanonical = prev.base_score != null || prev.base_max != null;
          const score = hasCanonical ? numeric(prev.base_score) : oldGrade;
          const max = hasCanonical ? numeric(prev.base_max) : beforeMax;
          if (score !== null && positive(max) && score >= 0 && score <= max) canonical = { baseScore: score, baseMax: max, sourceKind: text(prev.base_source) || 'gestion' };
        }
        const selectedStudent = canImport && student && (!selectedEmails || selectedEmails.has(email));
        if (selectedStudent) {
          let numerator = 0, denominator = 0;
          const answerMap = answersByStudent.get(student);
          const studentTotal = totalsByStudent.get(student);
          if (studentTotal) {
            numerator = studentTotal.points; denominator = studentTotal.possiblePoints;
            if (!finite(numerator) || !positive(denominator)) row.reason = 'Le résultat global Formative est incomplet.';
            else if (numerator < 0 || numerator > denominator) {
              row.action = 'blocked'; row.reason = 'La note globale Formative est négative ou dépasse le maximum. Vérifie ce résultat avant l’import.';
            }
          }
          for (const question of studentTotal ? [] : selected) {
            const answer = answerMap.get(text(question.id));
            if (!answer || !finite(answer.points)) { row.reason = 'Le résultat Formative est incomplet.'; break; }
            const max = owns(answer, 'possiblePoints') ? answer.possiblePoints : question.possiblePoints;
            if (!positive(max)) { row.reason = 'Le maximum individuel Formative est invalide ou incomplet.'; break; }
            if (answer.points < 0 || answer.points > max) {
              row.action = 'blocked'; row.reason = 'La note Formative est négative ou dépasse le maximum. Vérifie ce résultat avant l’import.'; break;
            }
            numerator += answer.points; denominator += max;
          }
          if (!row.reason && (!finite(numerator) || !positive(denominator))) {
            row.action = 'blocked'; row.reason = 'Le total des points Formative ou son maximum est invalide. Vérifie ce résultat avant l’import.';
          }
          if (!row.reason) incoming = { baseScore: numerator, baseMax: denominator, sourceKind: 'formative' };
        } else row.reason = !canImport ? 'Élève absent de la liste active du groupe actuel; aucun nouveau résultat importé.'
          : student ? 'Élève exclu du nouvel import.' : 'Aucun nouveau résultat Formative.';
        if (row.action !== 'blocked') {
          if (incoming) {
            const sameProportion = canonical && canonical.baseScore / canonical.baseMax === incoming.baseScore / incoming.baseMax;
            canonical = incoming;
            row.afterGrade = round(canonical.baseScore / canonical.baseMax * targetMaxScore);
            row.action = oldGrade === null ? 'add' : sameProportion && oldGrade === row.afterGrade && !maxChanged ? 'unchanged' : 'replace';
            row.reason = row.action === 'unchanged' ? 'La note et le maximum sont identiques.' : 'Le résultat Formative est complet.';
          } else if (maxChanged && oldGrade !== null) {
            if (canonical) { row.action = 'rescale'; row.afterGrade = round(canonical.baseScore / canonical.baseMax * targetMaxScore); }
            else { row.action = 'blocked'; row.reason = 'La note enregistrée ou son maximum d’origine est invalide. Corrige ce résultat avant de changer l’échelle.'; }
          } else if (prev && prev.grade != null && text(prev.grade) !== '' && oldGrade === null) {
            row.action = 'blocked'; row.reason = 'La note enregistrée n’est pas un nombre. Corrige ce résultat avant l’import.';
          } else if (oldGrade !== null && (oldGrade < 0 || (positive(beforeMax) && oldGrade > beforeMax))) {
            row.action = 'blocked'; row.reason = 'La note enregistrée est négative ou dépasse le maximum. Vérifie ce résultat avant l’import.';
          }
          if (canonical) Object.assign(row, canonical);
          const provenanceChanged = canonical && prev && (numeric(prev.base_score) !== canonical.baseScore || numeric(prev.base_max) !== canonical.baseMax || prev.base_source !== canonical.sourceKind);
          if (row.action !== 'blocked' && (['add', 'replace', 'rescale'].includes(row.action) || (incoming && provenanceChanged))) {
            writes.push({ email, grade: row.afterGrade, ...canonical, requiresCurrentMembership: !!incoming,
              response: prev && owns(prev, 'response') ? prev.response : '',
              feedback: prev && owns(prev, 'feedback') ? prev.feedback : '',
              visible: prev && owns(prev, 'visible') ? prev.visible : true });
          }
        }
      }
      rows.push({ row, surname: name.surname }); counts[row.action]++;
    }
    for (const email of allEmails) addRow(email, studentMap.get(email));
    for (const student of students) if (!emailKey(student.email)) addRow('', student);
    const compare = (a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base', numeric: true });
    rows.sort((a, b) => compare(a.surname, b.surname) || compare(a.row.name, b.row.name) || compare(a.row.email, b.row.email));
    const rowOrder = new Map(rows.map((entry, index) => [entry.row.email, index]));
    writes.sort((a, b) => rowOrder.get(a.email) - rowOrder.get(b.email));
    counts.modified = counts.replace + counts.rescale;
    const questionMeta = selected.map(q => ({ id: text(q.id), number: q.number ?? null, label: text(q.label), possiblePoints: q.possiblePoints }));
    const sourceLink = { formative_id: text(f.formativeId || f.id), formative_assignment_id: text(f.assignmentId), formative_section_id: text(f.sectionId),
      formative_title: text(f.title), formative_question_ids: selectedIds, formative_question_meta: questionMeta, formative_scale_mode: scaleMode };
    return { groupCode, sourceMaxScore, targetMaxScore, scaleMode, rows: rows.map(entry => entry.row), counts, writes, questionMeta, sourceLink, unmatched };
  }
  return { buildPreview };
});
