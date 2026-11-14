'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const file=path.join(__dirname,'../mozaik-review.js');
const box={module:{exports:{}},Intl};
if(fs.existsSync(file))vm.runInNewContext(fs.readFileSync(file,'utf8'),box);
const api=box.module.exports;
const before={titre:'Évaluation fictive',parametresEvaluation:{noteMaximale:70,resultatsDisponibles:false}};
const after={titre:'Évaluation fictive',parametresEvaluation:{noteMaximale:70,resultatsDisponibles:false}};
function analyze(rows,extra={},context={}){
  assert.equal(typeof api.analyze,'function','Presentation review analyzer must be implemented');
  return api.analyze({activityBefore:before,activityAfter:after,rows,...extra},context);
}
const row=(overrides={})=>({name:'Élève fictif',fiche:1,source:'gestion',beforeGrade:56,beforeMax:70,afterGrade:'56',afterMax:70,...overrides});
const aligned={gestionBefore:{maxScore:70,weight:39},gestionAfter:{maxScore:100,weight:39}};

test('numeric string and number with equal denominators are identical',()=>{
 const report=analyze([row()]);assert.equal(report.rows[0].kind,'unchanged');assert.equal(report.blocked,false);assert.equal(report.counts.unchanged,1);
});
test('empty native score is an addition, zero is not missing',()=>{
 const report=analyze([row({beforeGrade:null,afterGrade:0})]);assert.equal(report.rows[0].kind,'added');assert.equal(report.risks.zero.length,0);
});
test('zero replacing an existing positive mark requires acknowledgement',()=>{
 const report=analyze([row({afterGrade:0})]);assert.equal(report.rows[0].kind,'modified');assert.equal(report.risks.zero.length,1);
});
test('conversion only is distinct from a change in percentage',()=>{
 const report=analyze([row({afterGrade:80,afterMax:100})]);assert.equal(report.rows[0].kind,'scaled');assert.equal(report.rows[0].nativeChange,'scaled');
});
test('one-decimal proportional rounding is a conversion, not a grade change',()=>{
 const report=analyze([row({beforeGrade:1,beforeMax:3,afterGrade:33.3,afterMax:100})]);assert.equal(report.rows[0].kind,'scaled');
});
test('not every change of maximum is a proportional conversion',()=>{
 const report=analyze([row({afterGrade:56,afterMax:100})]);assert.equal(report.rows[0].kind,'modified');
});
test('Gestion-only conversion counts even if Mozaik mark is already correct',()=>{
 const report=analyze([row({beforeGrade:80,beforeMax:100,afterGrade:80,afterMax:100,gestionBeforeGrade:56,gestionBeforeMax:70})],aligned);
 assert.equal(report.rows[0].kind,'scaled');assert.equal(report.rows[0].nativeChange,'unchanged');assert.equal(report.rows[0].gestionChange,'scaled');
});
test('stale recovery does not claim to align or convert newer Gestion data',()=>{
 const report=analyze([row({beforeGrade:80,beforeMax:100,afterGrade:80,afterMax:100,gestionBeforeGrade:56,gestionBeforeMax:70})],aligned,{reconcilingStale:true});
 assert.equal(report.alignsGestion,false);assert.equal(report.rows[0].kind,'unchanged');assert.equal(report.rows[0].gestionChange,null);
});
test('stale flag in native preview is also respected',()=>{
 const report=analyze([row({gestionBeforeGrade:56,gestionBeforeMax:70})],{...aligned,reconcilingStale:true});assert.equal(report.alignsGestion,false);
});
test('special native code retained has no fake numerical denominator',()=>{
 const report=analyze([row({source:'preserved',beforeGrade:'ABS',afterGrade:'ABS'})]);assert.equal(report.rows[0].kind,'unchanged');assert.equal(report.counts.outside,1);assert.equal(report.risks.codes.length,0);
 assert.equal(api.formatGrade('ABS',70),'ABS (code)');
});
test('replacement of a special native code is highlighted',()=>{
 const report=analyze([row({beforeGrade:'EX'})]);assert.equal(report.risks.codes.length,1);assert.equal(report.rows[0].attention,true);
});
test('missing score shown separately from a real zero',()=>{
 analyze([row()]);assert.equal(api.formatGrade(null,70),'Non noté');assert.equal(api.formatGrade('',70),'Non noté');assert.equal(api.formatGrade(0,70),'0 / 70');
});
test('making the result visible requires its own acknowledgement',()=>{
 const report=analyze([row()],{activityAfter:{...after,parametresEvaluation:{...after.parametresEvaluation,resultatsDisponibles:true}}});assert.equal(report.risks.publication,true);
});
test('already visible results do not demand another publication acknowledgement',()=>{
 const act={parametresEvaluation:{resultatsDisponibles:true}};assert.equal(analyze([row()],{activityBefore:act,activityAfter:act}).risks.publication,false);
});
test('empty, absent, duplicated or malformed preview rows block confirmation',()=>{
 for(const rows of [[],null,[null],[row(),row()],[row({afterGrade:NaN})],[row({afterMax:0})],[row({afterGrade:{value:4}})],[row({afterGrade:71})],[row({source:'unknown'})]])assert.equal(analyze(rows).blocked,true);
});
test('missing aligned Gestion prior mark blocks misleading preview',()=>{assert.equal(analyze([row()],aligned).blocked,true);});
test('a removed native grade is blocked rather than treated as zero',()=>{
 assert.equal(analyze([row({afterGrade:null})]).blocked,true);
});
test('unchanged missing marks stay unchanged',()=>{assert.equal(analyze([row({beforeGrade:null,afterGrade:null})]).rows[0].kind,'unchanged');});
test('existing zero preserved is not flagged as destructive',()=>{assert.equal(analyze([row({beforeGrade:0,afterGrade:0})]).risks.zero.length,0);});
test('search ignores case and accents; change filter never changes counts or payload',()=>{
 const rows=[row({name:'Éloïse fictive'}),row({fiche:2,name:'Zoé fictive',afterGrade:0})];
 const original=JSON.stringify(rows),report=analyze(rows);
 assert.equal(api.selectRows(report,'all','eloise')[0].name,'Éloïse fictive');assert.equal(api.selectRows(report,'changes','').length,1);
 assert.equal(api.selectRows(report,'attention','zoe').length,1);assert.equal(api.selectRows(report,'all','absent').length,0);
 assert.equal(report.counts.total,2);assert.equal(report.risks.zero.length,1);assert.equal(JSON.stringify(rows),original);
});
test('pure analysis accepts frozen input and does not modify nested metadata',()=>{
 const input=Object.freeze(row());const data={activityBefore:Object.freeze(before),activityAfter:Object.freeze(after),rows:Object.freeze([input])};
 analyze([row()]);assert.doesNotThrow(()=>api.analyze(Object.freeze(data)));
});
