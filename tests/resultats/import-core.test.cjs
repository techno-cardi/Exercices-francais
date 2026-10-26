const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const sourcePath = path.join(__dirname, '../../supabase/functions/school-teacher-api/import-core.js');
const sandbox = { module: { exports: {} } };
if (fs.existsSync(sourcePath)) vm.runInNewContext(fs.readFileSync(sourcePath, 'utf8'), sandbox);
const buildPreview = sandbox.module.exports.buildPreview || (() => { throw new Error('buildPreview is not implemented'); });
const plain = x => JSON.parse(JSON.stringify(x));
function fixture() {
  return {
    formative: { formativeId: 'f1', assignmentId: 'fa1', sectionId: 's1', title: 'Dictée', groupCode: '101',
      questions: [{ id: 'q1', number: 1, label: 'A', possiblePoints: 3, gradedCount: 1 }, { id: 'q2', number: 2, label: 'B', possiblePoints: 7, gradedCount: 1 }],
      students: [{ id: 'sA', email: 'A@school.ca', firstName: 'Alex', lastName: 'Zulu', answers: [{ questionId: 'q1', answerId: 'a1', points: 1, possiblePoints: 3, gradedAt: '2026-10-26' }, { questionId: 'q2', answerId: 'a2', points: 4, possiblePoints: 7, gradedAt: '2026-10-26' }] }] },
    selectedQuestionIds: ['q1', 'q2'], assignment: null, results: [],
    roster: [{ email: 'a@school.ca', first_name: 'Alex', last_name: 'Zulu', group_code: '101', active: true }]
  };
}
test('complete Formative source produces one rounded add with canonical numerator and denominator', () => {
  const p = buildPreview(fixture());
  assert.equal(p.rows[0].action, 'add');
  assert.equal(p.rows[0].afterGrade, 5);
  assert.equal(p.writes[0].baseScore, 5);
  assert.equal(p.writes[0].baseMax, 10);
  assert.equal(p.writes[0].sourceKind, 'formative');
  assert.equal(p.sourceMaxScore, 10);
  assert.equal(p.targetMaxScore, 10);
  assert.deepEqual(plain(p.counts), { add: 1, replace: 0, rescale: 0, unchanged: 0, blocked: 0, modified: 0 });
});
test('null, missing and nonnumeric points never become zero', () => {
  for (const edit of [a => a.points = null, a => delete a.points, a => a.points = '2']) {
    const f = fixture(); edit(f.formative.students[0].answers[0]);
    const p = buildPreview(f);
    assert.equal(p.writes.length, 0);
    assert.equal(p.rows[0].afterGrade, null);
    assert.match(p.rows[0].reason, /résultat Formative est incomplet/i);
  }
});
test('auto-corrected zero and positive points import with no grading timestamp', () => {
  for (const points of [0, 2]) {
    const f = fixture(); f.formative.students[0].answers[0].points = points;
    f.formative.students[0].answers.forEach(a => a.gradedAt = null);
    const p = buildPreview(f);
    assert.equal(p.rows[0].action, 'add'); assert.equal(p.writes[0].grade, points + 4);
  }
});
test('real zero is imported and complete answer denominators retain individual exemptions', () => {
  const f = fixture(); f.formative.students[0].answers[0].points = 0;
  f.formative.students[0].answers[1].points = 0;
  assert.equal(buildPreview(f).writes[0].grade, 0);
  f.formative.students[0].answers[0].points = 1;
  f.formative.students[0].answers[1].points = 1;
  f.formative.students[0].answers[1].possiblePoints = 1;
  const p = buildPreview(f);
  assert.equal(p.writes[0].baseMax, 4);
  assert.equal(p.writes[0].grade, 5);
});
test('hundred mode persists and retakes replace using fresh complete source', () => {
  const f = fixture();
  f.assignment = { id: 'a', group_codes: ['101'], max_score: 100, formative_scale_mode: 'hundred' };
  f.results = [{ student_email: 'a@school.ca', grade: 40, base_score: 4, base_max: 10, base_source: 'formative', response: 'work', feedback: 'note', visible: false }];
  const p = buildPreview(f);
  assert.equal(p.scaleMode, 'hundred'); assert.equal(p.writes[0].grade, 50);
  assert.equal(p.rows[0].action, 'replace');
  assert.equal(p.writes[0].response, 'work'); assert.equal(p.writes[0].feedback, 'note'); assert.equal(p.writes[0].visible, false);
});
test('max changes rescale excluded and absent existing grades from canonical source without cumulative rounding', () => {
  const f = fixture(); f.selectedEmails = [];
  f.assignment = { id: 'a', group_codes: ['101'], max_score: 3 };
  f.results = [{ student_email: 'a@school.ca', grade: 1, response: 'keep', feedback: 'feedback', visible: false }];
  let p = buildPreview(f);
  assert.equal(p.rows[0].action, 'rescale'); assert.equal(p.writes[0].grade, 3.3);
  assert.equal(p.writes[0].baseScore, 1); assert.equal(p.writes[0].baseMax, 3);
  f.results[0] = { ...f.results[0], grade: 3.3, base_score: 1, base_max: 3, base_source: 'manual' };
  f.assignment.max_score = 10; f.formative.questions[1].possiblePoints = 0;
  f.selectedQuestionIds = ['q1'];
  p = buildPreview(f);
  assert.equal(p.writes[0].grade, 1); assert.equal(p.writes[0].sourceKind, 'manual');
  assert.equal(p.writes[0].feedback, 'feedback');
});
test('notes outside import batch rescale while a blank grade remains absent', () => {
  const f = fixture(); f.assignment = { id: 'a', group_codes: ['101'], max_score: 20 };
  f.roster.push({ email: 'b@school.ca', name: 'Bea Alpha', group_code: '101', active: true }, { email: 'c@school.ca', name: 'Cleo Beta', group_code: '101', active: true });
  f.results = [{ student_email: 'b@school.ca', grade: 12, feedback: 'outside' }, { student_email: 'c@school.ca', grade: null }];
  const p = buildPreview(f);
  assert.equal(p.writes.find(w => w.email === 'b@school.ca').grade, 6);
  assert.equal(p.writes.some(w => w.email === 'c@school.ca'), false);
  assert.equal(p.counts.rescale, 1);
});
test('numeric equality and same maximum are unchanged even when canonical provenance changes', () => {
  const f = fixture(); f.assignment = { id: 'a', group_codes: ['101'], max_score: 10 };
  f.results = [{ student_email: 'a@school.ca', grade: 5, base_score: 5, base_max: 10, base_source: 'manual' }];
  const p = buildPreview(f);
  assert.equal(p.rows[0].action, 'unchanged'); assert.equal(p.counts.modified, 0);
  assert.equal(p.writes[0].sourceKind, 'formative');
  f.results[0].grade = 5.01;
  assert.equal(buildPreview(f).rows[0].action, 'replace');
});
test('wrong group and legacy shared assignments are rejected', () => {
  for (const groups of [['102'], ['101', '102']]) {
    const f = fixture(); f.assignment = { id: 'a', group_codes: groups, max_score: 10 };
    assert.throws(() => buildPreview(f), /group|groupe/i);
  }
});
test('ambiguous questions, answers, students and results never use last-wins', () => {
  for (const edit of [
    f => f.formative.questions.push({ ...f.formative.questions[0] }),
    f => f.formative.students[0].answers.push({ ...f.formative.students[0].answers[0], answerId: 'other' }),
    f => f.formative.students[0].answers[1].answerId = 'a1',
    f => f.formative.students.push({ ...f.formative.students[0], id: 'other' }),
    f => f.formative.students.push({ ...f.formative.students[0], email: 'b@school.ca' }),
    f => f.results.push({ student_email: 'a@school.ca', grade: 3 }, { student_email: 'A@school.ca', grade: 4 })
  ]) { const f = fixture(); edit(f); assert.throws(() => buildPreview(f), /doublon/i); }
});
test('selected questions are known, unique and have bounded positive total', () => {
  for (const ids of [[], ['unknown'], ['q1', 'q1']]) {
    const f = fixture(); f.selectedQuestionIds = ids;
    assert.throws(() => buildPreview(f), /question/i);
  }
  for (const max of [0, -2, 1001, Infinity]) {
    const f = fixture(); f.selectedQuestionIds = ['q1']; f.formative.questions[0].possiblePoints = max;
    assert.throws(() => buildPreview(f), /maximum|points/i);
  }
});
test('unknown and inactive or wrong-group students produce diagnostics with no writes', () => {
  for (const edit of [f => f.roster = [], f => f.roster[0].active = false, f => f.roster[0].group_code = '102']) {
    const f = fixture(); edit(f); const p = buildPreview(f);
    assert.equal(p.writes.length, 0); assert.equal(p.counts.blocked, 1);
    assert.equal(p.unmatched.length, 1);
    assert.match(p.rows[0].reason, /élève à associer/i);
  }
});
test('historical moved or inactive students rescale existing canonical grades without importing new Formative results', () => {
  for (const edit of [f => f.roster = [], f => f.roster[0].active = false, f => f.roster[0].group_code = '102']) {
    const f = fixture(); edit(f);
    f.assignment = { id: 'a', group_codes: ['101'], max_score: 20 };
    f.results = [{ student_email: 'a@school.ca', grade: 12, base_score: 6, base_max: 10, base_source: 'manual', response: 'ancien travail', feedback: 'conserver', visible: false }];
    const p = buildPreview(f);
    assert.equal(p.rows[0].action, 'rescale'); assert.equal(p.writes[0].grade, 6);
    assert.equal(p.writes[0].baseScore, 6); assert.equal(p.writes[0].baseMax, 10);
    assert.equal(p.writes[0].sourceKind, 'manual');
    assert.equal(p.writes[0].feedback, 'conserver'); assert.equal(p.writes[0].visible, false);
    assert.equal(p.unmatched.length, 0);
  }
});
test('historical inactive student with a blank existing grade receives no new Formative grade', () => {
  const f = fixture(); f.roster[0].active = false;
  f.assignment = { id: 'a', group_codes: ['101'], max_score: 20 };
  f.results = [{ student_email: 'a@school.ca', grade: null }];
  const p = buildPreview(f);
  assert.equal(p.rows[0].action, 'unchanged'); assert.equal(p.rows[0].afterGrade, null);
  assert.equal(p.writes.length, 0);
});
test('official surname sorting and email identity keep homonyms separate', () => {
  const f = fixture();
  f.roster.push({ email: 'b@school.ca', first_name: 'Alex', last_name: 'Alpha', name: 'wrong', active: true, group_code: '101' });
  f.formative.students.push({ ...f.formative.students[0], id: 'sB', email: 'b@school.ca' });
  const p = buildPreview(f);
  assert.deepEqual(plain(p.rows.map(r => r.email)), ['b@school.ca', 'a@school.ca']);
  assert.equal(p.rows[0].name, 'Alex Alpha'); assert.equal(p.writes.length, 2);
});
test('unsupported bonuses and unusable existing denominator block instead of clamping', () => {
  const f = fixture(); f.formative.students[0].answers[0].points = 5;
  let p = buildPreview(f); assert.equal(p.rows[0].action, 'blocked'); assert.equal(p.writes.length, 0);
  f.selectedEmails = []; f.assignment = { id: 'a', group_codes: ['101'], max_score: null };
  f.results = [{ student_email: 'a@school.ca', grade: 5 }];
  p = buildPreview(f); assert.equal(p.rows[0].action, 'blocked'); assert.equal(p.writes.length, 0);
});
test('overflowing individual source denominators cannot manufacture a zero grade', () => {
  const f = fixture();
  f.formative.students[0].answers.forEach(a => a.possiblePoints = 1e308);
  const p = buildPreview(f);
  assert.equal(p.rows[0].action, 'blocked'); assert.equal(p.writes.length, 0);
});
test('retained unsupported bonus is shown as blocked even without a scale change', () => {
  const f = fixture(); f.selectedEmails = [];
  f.assignment = { id: 'a', group_codes: ['101'], max_score: 10 };
  f.results = [{ student_email: 'a@school.ca', grade: 12 }];
  const p = buildPreview(f);
  assert.equal(p.rows[0].action, 'blocked'); assert.equal(p.writes.length, 0);
});

test('different canonical proportions remain replacements when publication rounds identically', () => {
  const f = fixture();
  f.selectedQuestionIds = ['q1']; f.scaleMode = 'hundred';
  f.formative.questions[0].possiblePoints = 1000;
  f.formative.students[0].answers[0] = { questionId: 'q1', answerId: 'a1', points: 333, possiblePoints: 1000 };
  f.assignment = { id: 'a', group_codes: ['101'], max_score: 100 };
  f.results = [{ student_email: 'a@school.ca', grade: 33.3, base_score: 1, base_max: 3, base_source: 'manual' }];
  const p = buildPreview(f);
  assert.equal(p.rows[0].afterGrade, 33.3);
  assert.equal(p.rows[0].action, 'replace'); assert.equal(p.counts.modified, 1);
  assert.equal(p.writes[0].baseScore, 333); assert.equal(p.writes[0].baseMax, 1000);
});

test('equivalent canonical fractions allow provenance-only updates without modified grades', () => {
  const f = fixture();
  f.assignment = { id: 'a', group_codes: ['101'], max_score: 10 };
  f.results = [{ student_email: 'a@school.ca', grade: 5, base_score: 1, base_max: 2, base_source: 'manual' }];
  const p = buildPreview(f);
  assert.equal(p.rows[0].action, 'unchanged'); assert.equal(p.counts.modified, 0);
  assert.equal(p.writes[0].baseScore, 5); assert.equal(p.writes[0].baseMax, 10);
});

test('incoming writes require current group membership, historical conversions do not', () => {
  const f = fixture();
  assert.equal(buildPreview(f).writes[0].requiresCurrentMembership, true);
  f.assignment = { id: 'a', group_codes: ['101'], max_score: 20 };
  f.results = [{ student_email: 'a@school.ca', grade: 12 }];
  f.roster = [];
  assert.equal(buildPreview(f).writes[0].requiresCurrentMembership, false);
});

test('explicit authoritative totals scoped to the selection override additive item totals', () => {
  const f = fixture();
  f.formative.globalTotal = { questionIds: ['q2', 'q1'], possiblePoints: 12 };
  f.formative.students[0].globalTotal = { questionIds: ['q1', 'q2'], points: 8, possiblePoints: 12 };
  const p = buildPreview(f);
  assert.equal(p.sourceMaxScore, 12); assert.equal(p.targetMaxScore, 12);
  assert.equal(p.writes[0].baseScore, 8); assert.equal(p.writes[0].baseMax, 12); assert.equal(p.writes[0].grade, 8);
});

test('authoritative individual total preserves an exemption denominator', () => {
  const f = fixture(); f.scaleMode = 'hundred';
  f.formative.globalTotal = { questionIds: ['q1', 'q2'], possiblePoints: 25 };
  f.formative.students[0].globalTotal = { questionIds: ['q1', 'q2'], points: 18, possiblePoints: 20 };
  const p = buildPreview(f);
  assert.equal(p.sourceMaxScore, 25); assert.equal(p.writes[0].grade, 90);
  assert.equal(p.writes[0].baseMax, 20);
});

test('global totals for a different question selection are never reused', () => {
  const f = fixture(); f.selectedQuestionIds = ['q1'];
  f.formative.globalTotal = { questionIds: ['q1', 'q2'], possiblePoints: 12 };
  f.formative.students[0].globalTotal = { questionIds: ['q1', 'q2'], points: 8, possiblePoints: 12 };
  const p = buildPreview(f);
  assert.equal(p.sourceMaxScore, 3); assert.equal(p.writes[0].baseScore, 1); assert.equal(p.writes[0].baseMax, 3);
});

test('matching but incomplete authoritative total never falls back to fabricated complete answers', () => {
  for (const total of [
    { questionIds: ['q1', 'q2'], points: null, possiblePoints: 10 },
    { questionIds: ['q1', 'q2'], points: 4, possiblePoints: null },
    { questionIds: ['q1', 'q2'], points: 12, possiblePoints: 10 }
  ]) {
    const f = fixture(); f.formative.students[0].globalTotal = total;
    const p = buildPreview(f);
    assert.equal(p.writes.length, 0); assert.equal(p.rows[0].afterGrade, null);
    assert.match(p.rows[0].reason, /Formative/i);
  }
});

test('duplicate or unknown global-total scope cannot count items twice', () => {
  for (const questionIds of [['q1', 'q1'], ['q1', 'missing'], []]) {
    const f = fixture(); f.formative.globalTotal = { questionIds, possiblePoints: 10 };
    assert.throws(() => buildPreview(f), /total|question|doublon/i);
  }
});

test('hierarchical selections never sum a parent and its graded descendants', () => {
  for (const selectedQuestionIds of [['q1', 'q2'], ['q1']]) {
    const f = fixture(); f.formative.questions[1].parentId = 'q1'; f.selectedQuestionIds = selectedQuestionIds;
    assert.throws(() => buildPreview(f), /parent|sous-part|hiérarch/i);
  }
  const f = fixture(); f.formative.questions[1].parentId = 'q1'; f.selectedQuestionIds = ['q2'];
  const p = buildPreview(f);
  assert.equal(p.sourceMaxScore, 7); assert.equal(p.writes[0].baseScore, 4); assert.equal(p.writes[0].baseMax, 7);
});

test('unresolvable and nested hierarchies fail before confirmation', () => {
  for (const edit of [
    f => f.formative.questions[0].parentId = 'missing',
    f => { f.formative.questions[0].parentId = 'q2'; f.formative.questions[1].parentId = 'q1'; },
    f => f.formative.questions[0].children = [{ id: 'child', possiblePoints: 3 }],
    f => f.formative.questions[0].subparts = [{ id: 'child', possiblePoints: 3 }]
  ]) {
    const f = fixture(); edit(f);
    assert.throws(() => buildPreview(f), /parent|sous-part|hiérarch/i);
  }
});

test('invalid explicit individual denominator never falls back to the common question maximum', () => {
  for (const possiblePoints of [null, 0, -1, '3', Infinity]) {
    const f = fixture(); f.formative.students[0].answers[0].possiblePoints = possiblePoints;
    const p = buildPreview(f);
    assert.equal(p.writes.length, 0); assert.equal(p.rows[0].afterGrade, null);
    assert.match(p.rows[0].reason, /maximum|incomplet/i);
  }
});

test('invalid matching common global maximum cannot fall back to an additive total', () => {
  for (const possiblePoints of [null, 0, -1, '10', Infinity, 1001]) {
    const f = fixture(); f.formative.globalTotal = { questionIds: ['q1', 'q2'], possiblePoints };
    assert.throws(() => buildPreview(f), /maximum/i);
  }
});

test('native context parents resolve through the complete item hierarchy', () => {
  const f = fixture();
  f.formative.questions[0].parentId = 'passage';
  f.formative.questions[1].parentId = 'section';
  f.formative.hierarchy = [
    { id: 'section', parentId: null, kind: 'section' },
    { id: 'passage', parentId: 'section', kind: 'content' },
    { id: 'q1', parentId: 'passage', kind: 'question' },
    { id: 'q2', parentId: 'section', kind: 'question' }
  ];
  const p = buildPreview(f);
  assert.equal(p.writes[0].grade, 5); assert.equal(p.sourceMaxScore, 10);
});

test('complete native hierarchy allows leaves but rejects a graded ancestor selection', () => {
  const f = fixture();
  f.formative.hierarchy = [
    { id: 'q1', parentId: null, kind: 'question' },
    { id: 'context', parentId: 'q1', kind: 'content' },
    { id: 'q2', parentId: 'context', kind: 'question' }
  ];
  assert.throws(() => buildPreview(f), /parent|sous-part/i);
  f.selectedQuestionIds = ['q2'];
  const p = buildPreview(f);
  assert.equal(p.sourceMaxScore, 7); assert.equal(p.writes[0].baseScore, 4);
});

test('native hierarchy rejects unknown ancestors cycles duplicate identities and conflicting metadata', () => {
  for (const hierarchy of [
    [{ id: 'q1', parentId: 'missing', kind: 'question' }, { id: 'q2', parentId: null, kind: 'question' }],
    [{ id: 'q1', parentId: 'context', kind: 'question' }, { id: 'context', parentId: 'q1', kind: 'content' }, { id: 'q2', parentId: null, kind: 'question' }],
    [{ id: 'q1', parentId: null, kind: 'question' }, { id: 'q1', parentId: null, kind: 'question' }, { id: 'q2', parentId: null, kind: 'question' }],
    [{ id: 'q1', parentId: null, kind: 'question' }]
  ]) {
    const f = fixture(); f.formative.hierarchy = hierarchy;
    assert.throws(() => buildPreview(f), /hiérarch|parent|doublon/i);
  }
  const f = fixture();
  f.formative.questions[0].parentId = 'q2';
  f.formative.hierarchy = [{ id: 'q1', parentId: null, kind: 'question' }, { id: 'q2', parentId: null, kind: 'question' }];
  assert.throws(() => buildPreview(f), /hiérarch|parent/i);
});
