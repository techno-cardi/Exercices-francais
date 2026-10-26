import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const patch = fs.readFileSync(new URL('../app-patch-v04.js', import.meta.url), 'utf8');
function setup() {
  const elements = new Map();
  const make = () => ({ value: '', textContent: '', innerHTML: '', dataset: {}, listeners: {}, classList: { toggle() {}, contains: () => true }, addEventListener(type, fn) { this.listeners[type] = fn; }, querySelectorAll: () => [] });
  const $ = id => { if (!elements.has(id)) elements.set(id, make()); return elements.get(id); };
  const buttons = ['31', '32', '77'].map(group => ({ ...make(), dataset: { group }, classList: { toggle(key, active) { this.active = active; } } }));
  const context = vm.createContext({ show() {}, $, document: { getElementById: $, querySelectorAll: selector => selector === '.group-nav' ? buttons : [], querySelector: selector => selector === '#assignmentsView h1' ? $('listHeading') : null, activeElement: null }, state: { dashboardGroup: '31', teacherAssignments: [{ id: 'x', title: 'Examen', groups: ['32'], competenceKind: 'lecture' }], currentAssignment: null }, localStorage: { setItem(k, v) { this[k] = v; } }, window: {}, location: { href: 'https://example.test/resultats/', search: '' }, URL, history: { pushState(data, title, url) { context.route = String(url); }, replaceState(data, title, url) { context.route = String(url); } }, renderDashboard() {}, assignmentCards: list => list.map(a => a.id).join(','), wireAssignmentCards() {}, notify(message) { context.notice = message; }, setTimeout, clearTimeout, TEACHER_ENDPOINT: 'teacher', ROSTER_ENDPOINT: 'roster', refreshSyncState: async () => {}, pingExtension() {}, fillWorkPage() {}, renderGradeRows() {}, mergeRoster: students => students, roundGrade: Number });
  vm.runInContext(source.slice(source.indexOf('function setTeacherSection('), source.indexOf('async function refreshTeacherData(')), context);
  vm.runInContext(source.slice(source.indexOf('function renderAssignmentList('), source.indexOf('async function newAssignment(')), context);
  vm.runInContext(patch.slice(patch.indexOf('    openAssignment = async function(id'), patch.indexOf('    const originalSendToExtension')), context);
  return { context, $, buttons };
}

test('Travaux group selector activates context, sidebar, complete list and route', async () => {
  const { context: c, $, buttons } = setup();
  $('assignmentSearch').value = 'invisible';
  $('assignmentCompetenceFilter').value = 'oral';
  $('assignmentGroupFilter').value = '32';
  await $('assignmentGroupFilter').listeners.input();
  assert.equal(c.state.dashboardGroup, '32');
  assert.equal(c.localStorage.results_dashboard_group, '32');
  assert.equal(buttons[1].classList.active, true);
  assert.equal($('assignmentList').innerHTML, 'x');
  assert.match(c.route, /groupe=32/);
});

test('explicit dynamic group switch resets filters and heading', async () => {
  const { context: c, $ } = setup();
  $('assignmentSearch').value = 'old';
  await c.selectDashboardGroup('77', true);
  assert.equal($('assignmentSearch').value, '');
  assert.equal($('assignmentGroupFilter').value, '77');
  assert.equal($('listHeading').textContent, 'Travaux du groupe 77');
  assert.match(c.route, /groupe=77/);
});

test('late work response cannot reopen detail after a group switch', async () => {
  const { context: c } = setup();
  let resolve;
  c.api = (endpoint) => endpoint === 'roster' ? Promise.resolve({ students: [] }) : new Promise(done => { resolve = done; });
  const opening = c.openAssignment('old');
  await new Promise(done => setImmediate(done));
  await c.selectDashboardGroup('32', true);
  resolve({ assignment: { id: 'old', groups: ['31'] }, students: [] });
  await opening;
  assert.equal(c.state.dashboardGroup, '32');
  assert.equal(c.state.currentAssignment, null);
});

test('opening a work activates its actual group and retains valid legacy shared context', async () => {
  const { context: c, $ } = setup();
  c.api = async endpoint => endpoint === 'roster' ? { students: [] } : { assignment: { id: 'x', groups: ['32', '77'] }, students: [] };
  await c.openAssignment('x');
  assert.equal(c.state.dashboardGroup, '32');
  assert.equal($('assignmentGroupFilter').value, '32');
  c.state.dashboardGroup = '77';
  await c.openAssignment('x');
  assert.equal(c.state.detailGroup, '77');
});


test('opening existing fractional grades performs no saveResult writes', async () => {
  const { context: c } = setup();
  const actions = [];
  c.api = async (endpoint, payload) => {
    actions.push(payload.action);
    return endpoint === 'roster' ? { students: [] } : { assignment: { id: 'x', groups: ['31'] }, students: [{ email: 'student', grade: 33.3333 }] };
  };
  c.roundGrade = n => Math.round(n * 10) / 10;
  await c.openAssignment('x');
  assert.equal(actions.includes('saveResult'), false);
  assert.equal(c.state.currentStudents[0].grade, 33.3333);
});

test('failed settings save keeps the original group and work visible', async () => {
  const { context: c, $ } = setup();
  c.state.teacherSection = 'detail';
  c.state.currentAssignment = { id: 'x', groups: ['31'] };
  c.window.cardinalFlushPendingAssignmentSaves = async () => { throw new Error('save failed'); };
  const result = await c.selectDashboardGroup('32', true);
  assert.equal(result, false);
  assert.equal(c.state.dashboardGroup, '31');
  assert.equal(c.state.teacherSection, 'detail');
  assert.equal($('assignmentGroupFilter').value, '31');
  assert.equal(c.notice, 'save failed');
});

test('navigation waits for pending settings before changing group', async () => {
  const { context: c } = setup();
  c.state.teacherSection = 'detail';
  c.state.currentAssignment = { id: 'x', groups: ['31'] };
  let finish;
  c.window.cardinalFlushPendingAssignmentSaves = () => new Promise(resolve => { finish = resolve; });
  const navigating = c.selectDashboardGroup('32', true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(c.state.dashboardGroup, '31');
  finish();
  assert.equal(await navigating, true);
  assert.equal(c.state.dashboardGroup, '32');
});

test('v05 navigation restores a group-only history entry into the matching list', async () => {
  const { context: c, $ } = setup();
  const listeners = {};
  c.URLSearchParams = URLSearchParams;
  c.window.addEventListener = (type, fn) => { listeners[type] = fn; };
  c.location.search = '';
  const v05 = fs.readFileSync(new URL('../app-patch-v05.js', import.meta.url), 'utf8');
  vm.runInContext(v05.slice(v05.indexOf('  function currentRoute()'), v05.indexOf('  function waitForAppNavigation()')), c);
  vm.runInContext(v05.slice(v05.indexOf('  function installNavigationPersistence()'), v05.indexOf('  ensureV04();')), c);
  c.installNavigationPersistence();
  c.location.search = '?groupe=77&vue=assignments';
  await listeners.popstate();
  assert.equal(c.state.dashboardGroup, '77');
  assert.equal(c.state.teacherSection, 'assignments');
  assert.equal($('listHeading').textContent, 'Travaux du groupe 77');
});

test('late rejected sync status cannot overwrite the newly selected group status', async () => {
  const { context: c, $ } = setup();
  c.SYNC_ENDPOINT = 'sync';
  vm.runInContext(source.slice(source.indexOf('async function refreshSyncState()'), source.indexOf('function validateMozaikGrades()')), c);
  c.state.currentAssignment = { id: 'old', groups: ['31'] };
  c.state.detailGroup = '31';
  let reject;
  c.api = () => new Promise((resolve, fail) => { reject = fail; });
  const pending = c.refreshSyncState();
  await c.selectDashboardGroup('32', true);
  $('syncState').textContent = 'current status';
  reject(new Error('old failure'));
  await pending;
  assert.equal($('syncState').textContent, 'current status');
});

test('late mapping badge response cannot repaint a different active group', async () => {
  const { context: c, $ } = setup();
  const v09 = fs.readFileSync(new URL('../app-patch-v09.js', import.meta.url), 'utf8');
  c.state.teacherToken = 'test';
  c.state.currentAssignment = { id: 'old', groups: ['31'] };
  c.state.detailGroup = '31';
  c.ensureMappingBadge = () => $('mappingBadge');
  c.mappingYear = () => 2026;
  vm.runInContext(v09.slice(v09.indexOf("  let lastBadgeKey = ''"), v09.indexOf('  function installWorkUiFixes()')), c);
  let finish;
  c.api = () => new Promise(resolve => { finish = resolve; });
  const pending = c.refreshMappingBadge();
  await c.selectDashboardGroup('32', true);
  $('mappingBadge').textContent = 'current mapping';
  finish({ group: {} });
  await pending;
  assert.equal($('mappingBadge').textContent, 'current mapping');
});

test('blocked browser history navigation restores the current work route', async () => {
  const { context: c } = setup();
  const listeners = {};
  c.URLSearchParams = URLSearchParams;
  c.window.addEventListener = (type, fn) => { listeners[type] = fn; };
  const v05 = fs.readFileSync(new URL('../app-patch-v05.js', import.meta.url), 'utf8');
  vm.runInContext(v05.slice(v05.indexOf('  function currentRoute()'), v05.indexOf('  function waitForAppNavigation()')), c);
  vm.runInContext(v05.slice(v05.indexOf('  function installNavigationPersistence()'), v05.indexOf('  ensureV04();')), c);
  c.installNavigationPersistence();
  c.state.currentAssignment = { id: 'current', groups: ['31'] };
  c.state.detailGroup = '31';
  c.state.teacherSection = 'detail';
  c.window.cardinalFlushPendingAssignmentSaves = async () => { throw new Error('save failed'); };
  c.location.search = '?groupe=77&vue=assignments';
  await listeners.popstate();
  assert.match(c.route, /travail=current/);
  assert.match(c.route, /groupe=31/);
});

test('dashboard group navigation restores the dashboard section', async () => {
  const { context: c } = setup();
  c.state.teacherSection = 'assignments';
  await c.selectDashboardGroup('77', false, 'replace');
  assert.equal(c.state.teacherSection, 'dashboard');
  assert.equal(c.state.dashboardGroup, '77');
});
