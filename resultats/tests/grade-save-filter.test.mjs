import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
function setup(){
 const nodes=new Map();const $=id=>{if(!nodes.has(id))nodes.set(id,{value:id==='failureThreshold'?'60':id==='gradeFilter'?'failures':'',textContent:'',hidden:true,querySelectorAll:()=>[]});return nodes.get(id);};
 const state={teacherToken:'t',currentAssignment:{id:'a',maxScore:20},detailGroup:'31',currentStudents:[{email:'a@test',name:'Alice',firstName:'Alice',lastName:'A',group:'31',grade:5,response:'keep response',feedback:'keep comment',visible:false},{email:'b@test',name:'Bob',firstName:'Bob',lastName:'B',group:'31',grade:10}]};
 const document={activeElement:null,querySelectorAll(selector){return selector==='.grade-input'?inputs:[];}};
 const rows=[],inputs=state.currentStudents.map(s=>{
  const classes=new Set();const listeners={};const percent={textContent:''},badge={textContent:'',hidden:false};
  const row={dataset:{email:s.email},hidden:false,classList:{toggle(c,on){on?classes.add(c):classes.delete(c);},contains:c=>classes.has(c)},contains:el=>el===input,querySelector:selector=>selector==='.percent-value'?percent:selector==='.grade-status'?badge:input};
  const input={dataset:{email:s.email},value:String(s.grade),classList:{add(...cs){cs.forEach(c=>classes.add(c));},remove(...cs){cs.forEach(c=>classes.delete(c));},contains:c=>classes.has(c)},closest:()=>row,addEventListener(t,f){listeners[t]=f;},focus(){document.activeElement=input;},select(){},listeners};rows.push(row);return input;
 });
 $('studentRows').querySelectorAll=()=>rows;
 const calls=[];let resolveSave,rejectSave;
 const context=vm.createContext({$,state,document,esc:String,formatNumber:String,TEACHER_ENDPOINT:'api',refreshSyncState:async()=>{},setTimeout:()=>1,api:(url,payload)=>{calls.push(payload);return new Promise((resolve,reject)=>{resolveSave=resolve;rejectSave=reject;});}});
 vm.runInContext(source.slice(source.indexOf('function gradePercentage('),source.indexOf('function openStudentDialog(')),context);
 context.wireGradeInputs();return{context,state,$,document,rows,inputs,calls,resolve:()=>resolveSave({}),reject:()=>rejectSave(Error('Save rejected'))};
}
test('successful failure-to-pass save retains focused editor then hides it after leaving; no comments or visibility lost',async()=>{
 const h=setup();h.document.activeElement=h.inputs[0];h.inputs[0].value='15';const saving=h.context.commitGrade(h.inputs[0]);
 assert.equal(h.rows[0].hidden,false);h.resolve();await saving;assert.equal(h.rows[0].hidden,false);
 assert.equal(h.calls[0].feedback,'keep comment');assert.equal(h.calls[0].response,'keep response');assert.equal(h.calls[0].visible,false);
 h.document.activeElement=h.inputs[1];h.context.syncGradeFilterRows();assert.equal(h.rows[0].hidden,true);assert.equal(h.rows[1].hidden,false);
});
test('failed save restores grade and failure state without hiding the error row',async()=>{
 const h=setup();h.inputs[0].value='15';const saving=h.context.commitGrade(h.inputs[0]);h.reject();await saving;
 assert.equal(h.state.currentStudents[0].grade,5);assert.equal(h.inputs[0].value,'5');assert.equal(h.rows[0].classList.contains('grade-failing'),true);assert.equal(h.rows[0].hidden,false);assert.match(h.$('gradeSaveState').textContent,/rejected/);
});
test('Tab navigation skips rows hidden by the failure filter',()=>{
 const h=setup();h.state.currentStudents[1].grade=15;h.inputs[1].value='15';h.rows[1].hidden=true;h.document.activeElement=h.inputs[0];
 h.inputs[0].listeners.keydown({key:'Tab',shiftKey:false,preventDefault(){}});
 assert.equal(h.document.activeElement,h.inputs[0]);assert.equal(h.calls.length,0);
});
test('focusing and leaving an existing fractional grade never rounds or rewrites it',async()=>{
 const h=setup();h.state.currentStudents[0].grade=17.999;h.inputs[0].value='17,999';
 h.context.gradeValue=()=>({grade:18,rawGrade:17.999,text:'18'});
 let writes=0;h.context.api=async()=>{writes++;return{};};
 await h.context.commitGrade(h.inputs[0]);
 assert.equal(writes,0);assert.equal(h.state.currentStudents[0].grade,17.999);assert.equal(h.inputs[0].value,'17.999');
});
test('leaving a grade with more precision than its displayed value causes zero writes',async()=>{
 const h=setup();h.state.currentAssignment.maxScore=50;h.state.currentStudents[0].grade=33.3333;h.inputs[0].value='33.333';h.inputs[0].dataset.originalValue='33.333';
 h.context.gradeValue=()=>({grade:33.3,rawGrade:33.333,text:'33.3'});
 let writes=0;h.context.api=async()=>{writes++;return{};};await h.context.commitGrade(h.inputs[0]);
 assert.equal(writes,0);assert.equal(h.state.currentStudents[0].grade,33.3333);assert.equal(h.inputs[0].value,'33.333');
});
test('two edits in the same field serialize and reverting to the original value is saved',async()=>{
 const h=setup();h.inputs[0].dataset.originalValue='5';h.inputs[0].value='15';const first=h.context.commitGrade(h.inputs[0]);
 h.inputs[0].value='5';const second=h.context.commitGrade(h.inputs[0]);assert.equal(h.calls.length,1);
 h.resolve();await first;await Promise.resolve();assert.equal(h.calls.length,2);assert.equal(h.calls[1].grade,5);
 h.resolve();await second;assert.equal(h.state.currentStudents[0].grade,5);assert.equal(h.inputs[0].value,'5');
});
test('sync-status refresh failure never rolls back a successfully saved grade',async()=>{
 const h=setup();h.context.refreshSyncState=async()=>{throw Error('Status offline');};h.inputs[0].value='15';const saving=h.context.commitGrade(h.inputs[0]);h.resolve();await saving;
 assert.equal(h.state.currentStudents[0].grade,15);assert.equal(h.inputs[0].classList.contains('error'),false);assert.equal(h.$('gradeSaveState').textContent,'Enregistré');
});
