import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
require('../../supabase/functions/school-teacher-api/import-core.js');
const Core=globalThis.CardinalGestionImportCore;
function harness(){
  const assignment={id:'A',school_year:2026,title:'Examen',group_codes:['31'],max_score:20,weight:15,revision:7,term:1,activity_date:'2026-10-26',competencies:['Lecture'],mozaik_competence_kind:'lecture'};
  const results=[{student_email:'a@test.invalid',grade:10,response:'Texte',feedback:'Conserver',visible:false},{student_email:'b@test.invalid',grade:5,response:'',feedback:'',visible:true}];
  const roster=['a','b'].map(x=>({email:x+'@test.invalid',name:x,first_name:x,last_name:x,active:true,group_code:'31'}));
  roster.push({email:'c@test.invalid',name:'c',first_name:'c',last_name:'c',active:true,group_code:'32'});
  const calls=[],operations=[];
  const catalog={activeYear:2026,enforced:true,revision:1,years:[{year:2026,status:'open'},{year:2027,status:'draft'}]};
  const tables={school_students:roster,school_assignments:[assignment],school_results:results,
    school_year_enrollments:roster.map(s=>({...s,school_year:2026,student_email:s.email})),
    school_assignment_roster:roster.slice(0,2).map(s=>({...s,assignment_id:'A',school_year:2026,student_email:s.email})),
    school_teacher_sessions:[{token_hash:require('node:crypto').createHash('sha256').update('token').digest('hex'),teacher_email:'teacher@test.invalid',expires_at:'2099-01-01'}],
    school_teachers:[{email:'teacher@test.invalid',active:true}]};
  const db={from(table){let rows=tables[table]||[],payload;const query={select(){return query},eq(k,v){rows=rows.filter(r=>r[k]===v);return query},in(k,v){rows=rows.filter(r=>v.includes(r[k]));return query},insert(p){payload=p;calls.push({table,insert:p});operations.push(p);return query},update(p){calls.push({table,update:p});return query},maybeSingle:async()=>({data:rows[0]||null}),single:async()=>({data:payload||rows[0]||null}),then(resolve){resolve({data:rows});}};return query},async rpc(name,args){calls.push({rpc:name,args});if(name==='cardinal_year_catalog')return{data:structuredClone(catalog)};if(name==='cardinal_assignment_snapshot')return{data:{assignment:structuredClone(assignment),results:structuredClone(results),roster:structuredClone(tables.school_assignment_roster)}};if(name==='cardinal_confirm_assignment_operation')return{data:{assignmentId:'A',importedCount:2,maxScore:100,counts:{add:0,replace:1,rescale:1,unchanged:0,blocked:0,modified:2}}};if(name==='cardinal_create_assignment_batch')return{data:{id:'A31',assignments:[{id:'A31',groupCode:'31'},{id:'A32',groupCode:'32'}]}};throw Error(name)}};
  let source=fs.readFileSync(new URL('../../supabase/functions/school-teacher-api/index.ts',import.meta.url),'utf8').replace(/^import .*$/gm,'');
  const adapter=fs.readFileSync(new URL('../../supabase/functions/school-teacher-api/import-api.ts',import.meta.url),'utf8').replace(/^import .*$/gm,'').replace(/^export /gm,'');
  const more=['../_shared/school-years.ts','year-api.ts','year-read-api.ts','split-api.ts','mozaik-import-api.ts'].map(name=>fs.readFileSync(new URL('../../supabase/functions/school-teacher-api/'+name,import.meta.url),'utf8').replace(/^import .*$/gm,'').replace(/^export /gm,'')).join('\n');
  source=adapter+'\n'+more+'\n'+source;
  source=stripTypeScriptTypes(source,{mode:'transform'});
  const context=vm.createContext({console,TextEncoder,crypto:globalThis.crypto,Response,Request,createClient:()=>db,CardinalGestionImportCore:Core,Deno:{env:{get(key){return {SUPABASE_URL:'https://local.invalid',SUPABASE_SERVICE_ROLE_KEY:'test-only',SUPABASE_ANON_KEY:'public-test'}[key] || ''}},serve(fn){context.handle=fn}},btoa,atob,setTimeout,clearTimeout});
  vm.runInContext(source,context);
  return{context,db,calls,operations,assignment,results,tables,catalog};
}
const snapshot={formativeId:'F',assignmentId:'FA',sectionId:'S31',title:'Formative',groupCode:'31',questions:[{id:'q',possiblePoints:10}],students:[{id:'student-a',email:'a@test.invalid',answers:[{questionId:'q',answerId:'answer-a',points:5,possiblePoints:10,gradedAt:null}]}]};
test('overview rejects a changed score or maximum before creating any write plan',async()=>{
 for(const expected of [{grade:5,maxScore:20},{grade:10,maxScore:30}]){
  const h=harness();await assert.rejects(h.context.saveResult(h.db,'token',{assignmentId:'A',email:'a@test.invalid',grade:12,expectedResult:expected}),/changé/);assert.equal(h.operations.length,0);
 }
});
test('overview grade-only edit preserves stored feedback, response and visibility',async()=>{
 const h=harness();await h.context.saveResult(h.db,'token',{assignmentId:'A',email:'a@test.invalid',grade:12,expectedResult:{grade:10,maxScore:20}});
 const write=h.operations[0].plan.writes[0];assert.equal(write.feedback,'Conserver');assert.equal(write.response,'Texte');assert.equal(write.visible,false);
});
test('Formative preview compares stored notes, preserves settings, and writes only a preview',async()=>{
  const h=harness();assert.equal(typeof h.context.formativePreview,'function','The API needs an authenticated preview before grade writes');
  const result=await h.context.formativePreview(h.db,'token',{formative:snapshot,selectedQuestionIds:['q'],destinationAssignmentId:'A',scaleMode:'hundred',settings:{title:'Overwrite',weight:99}});
  assert.equal(result.preview.targetMaxScore,100);assert.equal(result.preview.counts.replace,1);assert.equal(result.preview.counts.rescale,1);
  assert.equal(h.operations.length,1);const plan=h.operations[0].plan;
  assert.equal(plan.assignmentPatch.weight,undefined,'An import must not replace the destination weighting');
  assert.equal(plan.assignmentPatch.max_score,100);assert.equal(plan.writes[0].feedback,'Conserver');assert.equal(plan.writes[0].visible,false);
  assert.equal(h.calls.some(x=>x.table==='school_results'&&x.insert),false);assert.equal(h.calls.some(x=>x.table==='school_assignments'&&x.update),false);
});
test('confirmation uses the transaction RPC and returns its authoritative result',async()=>{
  const h=harness();assert.equal(typeof h.context.formativeConfirm,'function');
  const r=await h.context.formativeConfirm(h.db,'token',{schoolYear:2026,previewId:'550e8400-e29b-41d4-a716-446655440000'});
  assert.equal(r.assignmentId,'A');assert.equal(h.calls.filter(x=>x.rpc==='cardinal_confirm_assignment_operation').length,1);
  assert.equal(h.calls.some(x=>x.table==='school_results'&&x.update),false);
});
test('multi-group creation calls one atomic independent-work RPC',async()=>{
  const h=harness();const r=await h.context.saveAssignment(h.db,'token',{schoolYear:2026,operationId:'550e8400-e29b-41d4-a716-446655440000',assignment:{title:'Nouveau',groups:['31','32'],competencies:['Lecture'],maxScore:30,weight:15}});
  assert.equal(r.assignments.length,2);assert.notEqual(r.assignments[0].id,r.assignments[1].id);
  assert.equal(h.calls.filter(x=>x.rpc==='cardinal_create_assignment_batch').length,1);
  assert.equal(h.calls.some(x=>x.table==='school_assignments'&&x.insert),false);
});
test('a shared legacy destination cannot be changed by the new import',async()=>{
  const h=harness();h.assignment.group_codes=['31','32'];assert.equal(typeof h.context.formativePreview,'function');
  await assert.rejects(h.context.formativePreview(h.db,'token',{formative:snapshot,selectedQuestionIds:['q'],destinationAssignmentId:'A',scaleMode:'hundred'}));
  assert.equal(h.operations.length,0);
});

test('HTTP dispatcher passes the authenticated token to preview and confirm',async()=>{
 const h=harness();
 for(const body of [{action:'formativePreview',token:'token',formative:snapshot,selectedQuestionIds:['q'],destinationAssignmentId:'A',scaleMode:'hundred'}, {action:'formativeConfirm',token:'token',previewId:'550e8400-e29b-41d4-a716-446655440000'}]){
   const response=await h.context.handle(new Request('https://local.invalid',{method:'POST',headers:{apikey:'public-test','content-type':'application/json',origin:'https://techno-cardi.github.io'},body:JSON.stringify({...body,schoolYear:2026})}));
   assert.equal(response.status,200,await response.text());
 }
});

test('manual precision is kept as the unrounded canonical numerator',async()=>{
 const h=harness();await h.context.saveResult(h.db,'token',{assignmentId:'A',email:'a@test.invalid',grade:8.1,rawGrade:8.1234});
 const write=h.operations[0].plan.writes[0];assert.equal(write.grade,8.1);assert.equal(write.baseScore,8.1234);assert.equal(write.baseMax,20);assert.equal(write.requiresCurrentMembership,true);
});
test('feedback-only edits retain existing canonical references and visibility',async()=>{
 const h=harness();Object.assign(h.results[0],{grade:10,base_score:1,base_max:2,base_source:'formative'});
 await h.context.saveResult(h.db,'token',{assignmentId:'A',email:'a@test.invalid',grade:10,feedback:'Nouveau retour'});
 const write=h.operations[0].plan.writes[0];assert.equal(write.baseScore,1);assert.equal(write.baseMax,2);assert.equal(write.sourceKind,'formative');assert.equal(write.visible,false);
});

test('manual historical correction uses captured membership after a roster move or account deactivation',async()=>{
 const h=harness();Object.assign(h.tables.school_students[0],{group_code:'77',active:false});
 h.catalog.activeYear=2027;h.catalog.years[1].status='open';
 await h.context.saveResult(h.db,'token',{schoolYear:2026,assignmentId:'A',email:'a@test.invalid',grade:10,feedback:'Historical correction'});
 assert.equal(h.operations[0].plan.writes[0].feedback,'Historical correction');
 assert.equal(h.operations[0].plan.writes[0].email,'a@test.invalid');
 assert.equal(h.operations[0].plan.beforeSnapshot.assignment.school_year,2026);
});

test('reused current group cannot authorize a new-cohort pupil to edit an old work',async()=>{
 const h=harness();h.tables.school_students.push({email:'new@test.invalid',group_code:'31',active:true});
 await assert.rejects(h.context.saveResult(h.db,'token',{schoolYear:2026,assignmentId:'A',email:'new@test.invalid',grade:10}),/groupe du travail/);
 assert.equal(h.operations.length,0);
});

test('archives block manual edits and reopened nonactive years still block external imports',async()=>{
 const h=harness();h.catalog.activeYear=2027;h.catalog.years[1].status='open';h.catalog.years[0].status='archived';
 await assert.rejects(h.context.saveResult(h.db,'token',{assignmentId:'A',email:'a@test.invalid',grade:10}),/archivée/);
 h.catalog.years[0].status='open';
 await assert.rejects(h.context.formativePreview(h.db,'token',{schoolYear:2026,formative:snapshot,destinationAssignmentId:'A',selectedQuestionIds:['q']}),/année active/);
 assert.equal(h.operations.length,0);
});

test('creation without annual context and assignment/year mismatches reject before mutation',async()=>{
 const h=harness();
 await assert.rejects(h.context.saveAssignment(h.db,'token',{operationId:'550e8400-e29b-41d4-a716-446655440000',assignment:{title:'Nouveau',groups:['31'],maxScore:20}}),/année/);
 await assert.rejects(h.context.formativePreview(h.db,'token',{schoolYear:2027,formative:snapshot,destinationAssignmentId:'A',selectedQuestionIds:['q']}),/autre année/);
 assert.equal(h.operations.length,0);assert.equal(h.calls.some(x=>x.rpc==='cardinal_create_assignment_batch'),false);
});

test('Formative preserves departed historical notes instead of treating captured membership as active enrollment',async()=>{
 const h=harness();h.tables.school_year_enrollments[0].active=false;
 const changed=structuredClone(snapshot);changed.students[0].answers[0].points=2;
 await h.context.formativePreview(h.db,'token',{schoolYear:2026,formative:changed,destinationAssignmentId:'A',selectedQuestionIds:['q'],scaleMode:'hundred'});
 const write=h.operations[0].plan.writes.find(w=>w.email==='a@test.invalid');
 assert.equal(write.grade,50,'Historical 10/20 is preserved as 50/100; incoming 2/10 must not replace a departed pupil');
 assert.equal(write.feedback,'Conserver');assert.equal(write.visible,false);
});
