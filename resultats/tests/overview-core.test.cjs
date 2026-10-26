const test=require('node:test'),assert=require('node:assert/strict');
try{require('../overview-core.js');}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;}
const core=()=>{assert.ok(globalThis.CardinalOverviewCore,'Overview core must exist');return globalThis.CardinalOverviewCore;};
test('groups columns by real competency, preserving order and every work exactly once',()=>{
 const c=core(),works=[{id:'o',competenceKind:'oral'},{id:'l',competencies:['Lire']},{id:'e',competenceKind:'ecriture'},{id:'l2',competenceKind:'lecture'},{id:'x',competencies:['Lire','Écrire']},{id:'u'}];
 assert.deepEqual(c.orderWorks(works,true).map(w=>w.id),['l','l2','e','o','x','u']);assert.deepEqual(c.orderWorks(works,false).map(w=>w.id),works.map(w=>w.id));
});
test('risk averages respect relative weights and separate stages and competencies',()=>{
 const c=core(),works=[{id:'a',term:1,competenceKind:'lecture',maxScore:20,weight:10},{id:'b',term:1,competenceKind:'lecture',maxScore:10,weight:30},{id:'c',term:2,competenceKind:'lecture',maxScore:10,weight:10},{id:'d',term:1,competenceKind:'oral',maxScore:10,weight:10}];
 const report=c.followUp({assignments:works,students:[{email:'s',name:'S',results:{a:{grade:20},b:{grade:4},c:{grade:10},d:{grade:8}}}]},{threshold:70,passing:60});
 const reading=report.find(r=>r.competency==='lecture'&&r.term===1);assert.equal(reading.average,55);assert.equal(reading.level,'failure');assert.equal(reading.method,'weighted');assert.equal(report.length,1);
});
test('zero is a failing grade; missing and unassigned never become zeros',()=>{
 const c=core(),works=[{id:'a',maxScore:10,competenceKind:'lecture'}];
 const report=c.followUp({assignments:works,students:[{email:'z',results:{a:{grade:0}}},{email:'m',results:{a:{grade:null}}},{email:'u',results:{}}]},{threshold:70,passing:60});
 assert.equal(report.find(r=>r.email==='z').average,0);assert.equal(report.find(r=>r.email==='m').level,'insufficient');assert.equal(report.some(r=>r.email==='u'),false);
});
test('incomplete weights explicitly produce indicative average; weight zero is excluded',()=>{
 const c=core(),works=[{id:'a',maxScore:10,weight:10},{id:'b',maxScore:20,weight:null},{id:'c',maxScore:10,weight:0}];
 const report=c.followUp({assignments:works,students:[{email:'s',results:{a:{grade:5},b:{grade:16},c:{grade:0}}}]},{threshold:70,passing:60});
 assert.equal(report[0].average,65);assert.equal(report[0].method,'indicative');assert.equal(report[0].graded,2);assert.equal(report[0].level,'watch');
});
test('unknown scale produces insufficient information, never a passing classification',()=>{
 const report=core().followUp({assignments:[{id:'a',maxScore:null}],students:[{email:'s',results:{a:{grade:5}}}]},{threshold:70,passing:60});
 assert.equal(report[0].level,'insufficient');assert.equal(report[0].average,null);
});
test('threshold and stage filter do not change scores or classify equality as failure',()=>{
 const input={assignments:[{id:'a',maxScore:10,term:1},{id:'b',maxScore:10,term:2}],students:[{email:'s',results:{a:{grade:6},b:{grade:5}}}]};
 assert.equal(core().followUp(input,{term:1,threshold:60,passing:60}).length,0);assert.equal(input.students[0].results.a.grade,6);
});
