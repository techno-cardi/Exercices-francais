import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const renderSource = source.slice(source.indexOf('function assignmentCards('), source.indexOf('function wireAssignmentCards('));

test('group-scoped cards omit the redundant group badge, including historical shared works', () => {
  const context = vm.createContext({esc: String, competenceLabel: () => 'Écrire', formatNumber: String});
  vm.runInContext(renderSource, context);
  for (const groups of [['31'], ['31', '32']]) {
    const html = context.assignmentCards([{id: 'work', title: 'Dictée', groups, weight: 15,
      mozaikSyncStatus: 'not_synced', gradedCount: 55, studentCount: 60, average: 14.71}]);
    assert.doesNotMatch(html, /Groupe/);
    assert.match(html, /Dictée/);
    assert.match(html, /55\/60/);
    assert.match(html, /15 %/);
    assert.match(html, /Non synchronisé/);
  }
});
