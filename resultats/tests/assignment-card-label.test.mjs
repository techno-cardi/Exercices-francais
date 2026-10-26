import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const renderSource = source.slice(source.indexOf('function assignmentCards('), source.indexOf('function wireAssignmentCards('));
const metricSource = source.includes('function gradePercentage(') ? source.slice(source.indexOf('function gradePercentage('),source.indexOf('function gradeValue(')) : '';

test('group-scoped cards omit the redundant group badge, including historical shared works', () => {
  const context = vm.createContext({esc: String, competenceLabel: () => 'Écrire', formatNumber: String});
  vm.runInContext(metricSource + renderSource, context);
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
test('assignment averages use their own valid denominator, preserve zero and leave missing values empty',()=>{
 const context=vm.createContext({esc:String,competenceLabel:()=>'',formatNumber:String});
 vm.runInContext(metricSource+renderSource,context);
 const card=(average,maxScore)=>context.assignmentCards([{id:'x',title:'A',groups:['31'],weight:null,average,maxScore,studentCount:1,gradedCount:1}]);
 assert.match(card(15,20),/>75 %<\/strong>/);
 assert.match(card(0,20),/>0 %<\/strong>/);
 for(const [average,max] of [[null,20],[undefined,20],['',20],[15,null],[15,0],[15,'bad']])assert.doesNotMatch(card(average,max),/(NaN|Infinity|>0 %<)/);
});
