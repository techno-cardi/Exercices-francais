const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), vm=require('node:vm'), path=require('node:path');
const root=path.join(__dirname,'../../supabase/functions/fr-dictee-feedback');
function harness(){
 const tables={school_assignments:[{id:'old',slug:'dictee-test',title:'Dictée',group_codes:[],split_archived:true,max_score:20},{id:'g31',slug:'dictee-test-g31',title:'Dictée',group_codes:['31'],split_archived:false,max_score:20},{id:'g32',slug:'dictee-test-g32',title:'Dictée',group_codes:['32'],split_archived:false,max_score:20}],school_assignment_splits:[{old_assignment_id:'old',group_code:'31',assignment_id:'g31'},{old_assignment_id:'old',group_code:'32',assignment_id:'g32'}],fr_dictee_feedback:[{assignment_id:'g31',student_email:'a@test',errors:[]},{assignment_id:'g32',student_email:'b@test',errors:[]}],school_results:[{assignment_id:'g31',student_email:'a@test',grade:14},{assignment_id:'g32',student_email:'b@test',grade:16}],school_students:[{email:'a@test',name:'A',group_code:'31',active:true},{email:'b@test',name:'B',group_code:'32',active:true}]};
 const db={from(table){let rows=tables[table]||[];const q={select(){return q;},eq(k,v){rows=rows.filter(r=>r[k]===v);return q;},in(k,vs){rows=rows.filter(r=>vs.includes(r[k]));return q;},not(k,op,v){rows=rows.filter(r=>r[k]!==v);return q;},order(){return q;},maybeSingle:async()=>({data:rows[0]||null}),then(resolve,reject){return Promise.resolve({data:rows}).then(resolve,reject);}};return q;}};
 let helper='';try{helper=fs.readFileSync(path.join(root,'split-work.ts'),'utf8').replaceAll('export ','');}catch{}
 const source=fs.readFileSync(path.join(root,'index.ts'),'utf8').replace(/^import .*;\r?\n/gm,'').split('Deno.serve(')[0];
 const context=vm.createContext({TextEncoder,crypto:require('node:crypto').webcrypto});
 // Existing endpoint TypeScript is parsed with Node's built-in stripper.
 vm.runInContext(require('node:module').stripTypeScriptTypes(helper+'\n'+source+'\nteacherAllowed=async()=>({});globalThis.routes={getAssignedWork,teacherStatus,teacherCatalog};',{mode:'transform'}),context);
 return {db,tables,routes:context.routes};
}
test('old dictation URL resolves each student to the independent group copy',async()=>{
 const h=harness();
 for(const [group,id,email] of [['31','g31','a@test'],['32','g32','b@test']]){
  const r=await h.routes.getAssignedWork(h.db,{email,group_code:group},'dictee-test');assert.equal(r.assignment.id,id);assert.equal(r.feedback.student_email,email);
 }
 await assert.rejects(h.routes.getAssignedWork(h.db,{email:'a@test',group_code:'51'},'dictee-test'),/indisponible/);
});
test('old teacher link reads both copies and group filter isolates results',async()=>{
 const h=harness();const all=await h.routes.teacherStatus(h.db,{workSlug:'dictee-test'});assert.equal(all.rows.length,2);assert.equal(all.rows[0].grade,14);assert.equal(all.rows[1].grade,16);
 const group=await h.routes.teacherStatus(h.db,{workSlug:'dictee-test',group:'32'});assert.equal(group.rows.length,1);assert.equal(group.rows[0].group,'32');assert.equal(group.rows[0].grade,16);
 const catalog=await h.routes.teacherCatalog(h.db,{});assert.equal(catalog.works.length,2);assert.ok(catalog.works.every(w=>w.groups.length===1));
});
test('group filter remains isolated for a dictation that has not been split',async()=>{
 const h=harness();h.tables.school_assignments[0].split_archived=false;h.tables.school_assignments[0].group_codes=['31','32'];
 const result=await h.routes.teacherStatus(h.db,{workSlug:'dictee-test',group:'32'});
 assert.equal(result.rows.length,1);assert.equal(result.rows[0].group,'32');
});
