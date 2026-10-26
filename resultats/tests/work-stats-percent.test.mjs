import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync(new URL('../work-stats-v01.js',import.meta.url),'utf8');
test('mean and median prioritize percent with original points secondary and no invented zero',()=>{
 const context=vm.createContext({});
 vm.runInContext(source.slice(source.indexOf('  function formatStatNumber('),source.indexOf('  function median('))+source.slice(source.indexOf('  function metricMarkup('),source.indexOf('  function renderWorkStats(')),context);
 assert.match(context.metricMarkup('Moyenne',15,20),/work-stat-main">75 %/);
 assert.match(context.metricMarkup('Médiane',0,20),/work-stat-main">0 %/);
 assert.match(context.metricMarkup('Moyenne',75,100),/work-stat-main">75 %/);
 for(const [n,max]of [[null,20],[undefined,20],[5,null],[5,0],[5,'bad']])assert.doesNotMatch(context.metricMarkup('Moyenne',n,max),/(NaN|Infinity|0 %)/);
});
