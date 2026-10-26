import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const patch = fs.readFileSync(new URL('../app-patch-v04.js', import.meta.url), 'utf8');

function setup(published, resultsVisible) {
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) {
      const card = { style: {}, strong: { textContent: id === 'topPublishedToggle' ? 'Gestion' : 'Mozaïk' }, small: { textContent: '' }, querySelector(selector) { return selector === 'strong' ? this.strong : this.small; } };
      elements.set(id, { value: '', checked: false, textContent: '', options: [], card, classList:{toggle(){}}, listeners: {}, closest: () => card, addEventListener(type, fn) { this.listeners[type] = fn; } });
    }
    return elements.get(id);
  }
  const context = vm.createContext({
    $: element,
    document: { getElementById: element, querySelectorAll: () => [] },
    state: { currentAssignment: { id: 'imported', title: 'Imported metadata', groups: ['32'], maxScore: 10, weight: null, published, resultsVisible }, detailGroup: '32' },
    window: {}, api() {}, renderGradeRows() {}, openAssignment() {}, sendToExtension() {},
    gradeValue() {}, validateMozaikGrades() {},
    esc: String, competenceLabel: () => 'Lire', formatNumber: String,
    competencyArray: () => ['Lecture'], today: () => '2026-10-26',
    setTimeout() { throw new Error('Patch initialization must finish immediately.'); },
  });
  vm.runInContext(app.slice(app.indexOf('function updateVisibilityLabels()'), app.indexOf('async function saveAssignmentSettings(')), context);
  vm.runInContext(patch, context);
  assert.equal(context.window.__cardinalV04Installed, true);
  context.fillWorkPage();
  return { context, element };
}

for (const [published, resultsVisible] of [[false, true], [true, false], [false, false], [true, true]]) {
  test(`opening and collecting preserves Gestion=${published} and Mozaïk=${resultsVisible}`, () => {
    const { context: c, element } = setup(published, resultsVisible);
    assert.equal(element('topPublishedToggle').checked, published);
    assert.equal(element('topMozaikVisibleToggle').checked, resultsVisible);
    assert.equal(element('platformVisibilityText').textContent, published ? 'Visible' : 'Masqué');
    assert.equal(element('mozaikVisibilityText').textContent, resultsVisible ? 'Visible' : 'Masqué');
    const collected = c.collectAssignment();
    assert.equal(collected.published, published);
    assert.equal(collected.resultsVisible, resultsVisible);
  });
}

test('changing Gestion visibility preserves the Mozaïk control and payload', () => {
  const { context: c, element } = setup(false, true);
  element('topPublishedToggle').checked = true;
  c.updateVisibilityLabels();
  assert.equal(element('topMozaikVisibleToggle').checked, true);
  element('topPublishedToggle').checked = false;
  c.updateVisibilityLabels();
  assert.equal(c.collectAssignment().resultsVisible, true);
  assert.notEqual(element('topMozaikVisibleToggle').card.style.display, 'none');
  assert.equal(element('topPublishedToggle').card.strong.textContent, 'Gestion');
});
