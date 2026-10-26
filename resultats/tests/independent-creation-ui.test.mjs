import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
function fn(name){const candidates=['function '+name+'(','async function '+name+'('].map(x=>source.indexOf(x)).filter(x=>x>=0);const start=Math.min(...candidates);return source.slice(start,source.indexOf('\n}',start)+2);}
function harness(){
 const calls=[],nodes=new Map(),get=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',disabled:false,checked:false});return nodes.get(id)};
 const state={dashboardGroup:'32',teacherToken:'test',currentAssignment:{id:null},currentStudents:[],navigationRevision:0};
 let preview=false;
 const win={};const ctx=vm.createContext({state,window:win,crypto:globalThis.crypto,assignmentSavePromise:null,assignmentSaveError:null,$:get,
  collectAssignment:()=>({id:state.currentAssignment.id,title:'Examen',groups:['31','32'],maxScore:30}),
  TEACHER_ENDPOINT:'teacher',api:async(_,body)=>{calls.push(body);if(body.action==='saveAssignment')return preview?{id:'A32',previewRequired:true,previewId:'P'}:{id:'A31',assignments:[{id:'A31',groupCode:'31'},{id:'A32',groupCode:'32'}]};return{assignment:{id:body.assignmentId,groups:['32'],title:'Examen'},students:[]}},
  refreshTeacherData:async()=>{},fillWorkPage(){},renderGradeRows(){},refreshSyncState:async()=>{},notify(){},prepareAssignmentNavigation:async()=>true,setTeacherSection(){},today:()=> '2026-10-26'});
 win.CardinalAssignmentActions={reviewPreview:async()=>({assignmentId:'A32'})};
 vm.runInContext(fn('saveAssignmentSettings'),ctx);
 return{ctx,state,calls,get,preview:()=>{preview=true}};
}
test('one creation confirmation receives an idempotency key and opens the active group copy',async()=>{
 const h=harness();await h.ctx.saveAssignmentSettings();
 assert.match(h.calls[0].operationId,/^[a-f0-9-]{36}$/);
 assert.equal(h.calls[1].assignmentId,'A32','The active group copy must open rather than the first batch row');
 assert.equal(h.state.currentAssignment.id,'A32');
});
test('overlapping saves of the same new draft send a single creation operation',async()=>{
 const h=harness();await Promise.all([h.ctx.saveAssignmentSettings(),h.ctx.saveAssignmentSettings()]);
 assert.equal(h.calls.filter(x=>x.action==='saveAssignment').length,1);
});
test('maximum change receives explicit preview confirmation before refreshing work',async()=>{
 const h=harness();h.preview();let confirmed=0;
 h.ctx.window.CardinalAssignmentActions.reviewPreview=async()=>{confirmed++;return{assignmentId:'A32'}};
 await h.ctx.saveAssignmentSettings();assert.equal(confirmed,1);
});
test('new-work navigation honors the save guard and invalidates old open requests',async()=>{
 const h=harness();h.state.currentAssignment={id:'Old'};h.ctx.prepareAssignmentNavigation=async()=>false;
 vm.runInContext(fn('newAssignment'),h.ctx);await h.ctx.newAssignment();assert.equal(h.state.currentAssignment.id,'Old');
 h.ctx.prepareAssignmentNavigation=async()=>true;const rev=h.state.navigationRevision;await h.ctx.newAssignment();assert(h.state.navigationRevision>rev);assert.equal(h.state.currentAssignment.id,null);
});
test('page exposes distinct Gestion and Mozaik visibility cards',()=>{
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/Visibilité dans Gestion/);assert.match(html,/Visibilité dans Mozaïk/);
 assert.doesNotMatch(html,/<input[^>]*type="hidden"[^>]*id="topMozaikVisibleToggle"/);
});
