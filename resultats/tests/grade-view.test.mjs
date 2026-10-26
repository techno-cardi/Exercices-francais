import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
function setup(){
 const nodes=new Map();const $=id=>{if(!nodes.has(id))nodes.set(id,{value:id==='failureThreshold'?'60':'',textContent:'',innerHTML:'',querySelectorAll:()=>[]});return nodes.get(id);};
 const state={detailGroup:'31',currentAssignment:{id:'a',maxScore:20},currentStudents:[
  {name:'Zéro Alice',firstName:'Alice',lastName:'Zéro',email:'a@test',group:'31',grade:0},
  {name:'Limite Bob',firstName:'Bob',lastName:'Limite',email:'b@test',group:'31',grade:11.999},
  {name:'Réussite Carol',firstName:'Carol',lastName:'Réussite',email:'c@test',group:'31',grade:12},
  {name:'Non noté Dan',firstName:'Dan',lastName:'Non noté',email:'d@test',group:'31',grade:null},
  {name:'Autre Eve',firstName:'Eve',lastName:'Autre',email:'e@test',group:'32',grade:5}]};
 const context=vm.createContext({$,state,esc:String,formatNumber:n=>String(Math.round(n*10)/10),wireGradeInputs(){},document:{activeElement:null,querySelectorAll:()=>[]},localStorage:{getItem:()=>null,setItem(){}},window:{}});
 const start=source.indexOf('function gradePercentage(');
 assert.notEqual(start,-1,'shared grade metrics must exist');
 vm.runInContext(source.slice(start,source.indexOf('function wireGradeInputs(')),context);
 return {context,state,$};
}
test('failure classification uses the unrounded grade and treats missing or invalid maximum as unknown',()=>{
 const {context:c}=setup();
 assert.equal(c.isFailingGrade(0,20,60),true);
 assert.equal(c.isFailingGrade(11.999,20,60),true);
 assert.equal(c.isFailingGrade(12,20,60),false);
 for(const value of [null,undefined,'',NaN])assert.equal(c.isFailingGrade(value,20,60),false);
 for(const max of [null,undefined,0,'bad'])assert.equal(c.isFailingGrade(0,max,60),false);
});
test('failure filter combines with group and search and displays an explicit empty state',()=>{
 const {context:c,$}=setup();$('gradeFilter').value='failures';
 assert.deepEqual(Array.from(c.visibleStudents(),s=>s.email),['b@test','a@test']);
 $('studentSearch').value='alice';assert.deepEqual(Array.from(c.visibleStudents(),s=>s.email),['a@test']);
 c.renderGradeRows();assert.match($('studentRows').innerHTML,/grade-failing/);assert.match($('studentRows').innerHTML,/Échec/);
 $('studentSearch').value='carol';c.renderGradeRows();assert.match($('studentRows').innerHTML,/Aucun échec/);
 $('gradeFilter').value='all';assert.deepEqual(Array.from(c.visibleStudents(),s=>s.email),['c@test']);
});
test('threshold is configurable without changing grades and detail summary counts ungraded separately',()=>{
 const {context:c,state,$}=setup();$('failureThreshold').value='50';$('gradeFilter').value='failures';
 assert.deepEqual(Array.from(c.visibleStudents(),s=>s.email),['a@test']);
 c.renderGradeRows();assert.match($('gradeSummary').textContent,/1 échec/);assert.match($('gradeSummary').textContent,/1 non noté/);
 assert.equal(state.currentStudents[1].grade,11.999);
});
