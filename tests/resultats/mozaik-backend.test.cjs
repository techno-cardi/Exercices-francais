const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const shared=fs.readFileSync('supabase/functions/_shared/school-years.ts','utf8').replace(/^export /gm,'');
const source=stripTypeScriptTypes(shared+'\n'+fs.readFileSync('supabase/functions/mozaik-sync/index.ts','utf8').replace(/^import .*;\r?\n/gm,''));
function load(){const context={TextEncoder,crypto,btoa,Date,console,Deno:{serve(){}},Response};vm.createContext(context);vm.runInContext(source+';globalThis.api={complete,competenceForSync,reconcileStale,mozaikScope,resume,prepare};',context);return context.api;}
function db(){const calls=[];return{calls,rpc:async(name,args)=>{calls.push({name,args});return{data:{success:true,syncedCount:1},error:null}},from(){return{select(){return this},eq(){return this},maybeSingle:async()=>({data:{id:'j',status:'claimed',claim_hash:require('node:crypto').createHash('sha256').update('secret').digest('hex')}}),update(){calls.push({legacy:true});return this},upsert(){calls.push({legacy:true});return this}}}};}
test('success cannot finalize without re-read verification',async()=>{const c=db();await assert.rejects(()=>load().complete(c,{jobId:'j',claimToken:'secret',success:true,activityId:'a',syncedCount:1}),/vérifi|verification/i);assert.equal(c.calls.length,0)});
test('complete delegates claim/revision/activity/count checks to atomic database finalization',async()=>{const c=db();await load().complete(c,{jobId:'j',claimToken:'secret',success:true,activityId:'a',syncedCount:1,verified:true,verifiedCount:1});assert.equal(c.calls[0]?.name,'cardinal_finish_mozaik_job');assert.equal(c.calls.some(x=>x.legacy),false)});



test('explicit resume reloads the immutable journal only for its teacher',async()=>{const calls=[];const c={rpc:async(name,args)=>{calls.push({name,args});return{data:{jobId:'j',claimToken:'new',payload:{checkpoint:{phase:'planned'}}}}},from(table){return{select(){return this},eq(){return this},maybeSingle:async()=>({data:table==='school_teacher_sessions'?{teacher_email:'t',expires_at:'2099-01-01'}:{email:'t',active:true}})}}};const result=await load().resume(c,{teacherToken:'teacher',jobId:'j'});assert.equal(calls[0]?.name,'cardinal_resume_mozaik_job');assert.equal(result.payload.checkpoint.phase,'planned')});



test('sync scope derives actual year consistently from course and matter, with no calendar fallback',()=>{const api=load();const g={establishment_id:'s',group_course_id:'s2024course',group_matter_id:'s2024matter',subject_code:'FR'};assert.equal(api.mozaikScope('101',g).schoolYear,'2024');assert.throws(()=>api.mozaikScope('101',{...g,group_course_id:'s2026course'}),/année/i);assert.throws(()=>api.mozaikScope('101',{...g,group_matter_id:'unknown'}),/année/i)});

test('explicit stale recovery authenticates teacher and uses the reconciliation RPC',async()=>{const calls=[];const c={rpc:async(name,args)=>{calls.push({name,args});return{data:{mode:'reconcile',jobId:'j',payload:{checkpoint:{phase:'planned'}}}}},from(table){return{select(){return this},eq(){return this},maybeSingle:async()=>({data:table==='school_teacher_sessions'?{teacher_email:'t',expires_at:'2099-01-01'}:{email:'t',active:true}})}}};const result=await load().reconcileStale(c,{teacherToken:'teacher',jobId:'j'});assert.equal(calls[0]?.name,'cardinal_reconcile_mozaik_job');assert.equal(result.mode,'reconcile');assert.equal(result.payload.checkpoint.phase,'planned')});

test('explicit competence kind with a cleared assignment code never revives an obsolete linked code',()=>{const fn=load().competenceForSync;assert.equal(fn({mozaik_competence_kind:'oral',mozaik_competence_code:null},{competence_code:'lecture-code'}).competenceCode,'');assert.equal(fn({mozaik_competence_kind:'oral',mozaik_competence_code:'oral-code'},{competence_code:'lecture-code'}).competenceCode,'oral-code');assert.equal(fn({mozaik_competence_kind:null,mozaik_competence_code:null},{competence_code:'legacy-code'}).competenceCode,'legacy-code')});

function annualPrepareHarness(){
 const tables={school_teacher_sessions:[{teacher_email:'t',token_hash:require('node:crypto').createHash('sha256').update('teacher').digest('hex'),expires_at:'2099-01-01'}],school_teachers:[{email:'t',active:true}],
  school_assignments:[{id:'a',school_year:2026,group_codes:['31'],max_score:20}],
  school_mozaik_groups:[{group_code:'31',establishment_id:'s',group_course_id:'s2026-course-31',group_matter_id:'s2026-matter-31',subject_code:'FR'}],school_mozaik_links:[],
  school_students:[{email:'next@test.invalid',group_code:'31',active:true}],
  school_results:[{assignment_id:'a',student_email:'historic@test.invalid',grade:12}],
  school_year_enrollments:[{school_year:2026,student_email:'historic@test.invalid',group_code:'31',name:'Historical',active:true}]};
 const catalog={activeYear:2026,enforced:true,years:[{year:2026,status:'open'},{year:2027,status:'open'}]},writes=[];
 const client={async rpc(name){assert.equal(name,'cardinal_year_catalog');return{data:structuredClone(catalog)};},from(table){let rows=tables[table]||[];const q={select(){return q;},eq(k,v){rows=rows.filter(r=>r[k]===v);return q;},not(k,op,v){rows=rows.filter(r=>r[k]!==v);return q;},update(p){writes.push({table,update:p});return q;},insert(p){writes.push({table,insert:p});return q;},maybeSingle:async()=>({data:rows[0]||null}),then(resolve,reject){return Promise.resolve({data:rows,count:rows.length}).then(resolve,reject);}};return q;}};
 return{client,tables,catalog,writes,body:{teacherToken:'teacher',assignmentId:'a',groupCode:'31',schoolYear:2026}};
}

test('archived work and reopened nonactive year cannot prepare a job using the reused group code',async()=>{
 for(const status of ['archived','open']){
  const h=annualPrepareHarness();h.catalog.activeYear=2027;h.catalog.years[0].status=status;
  await assert.rejects(load().prepare(h.client,h.body),status==='archived'?/archivée/:/année active/);
  assert.equal(h.writes.length,0);
 }
});

test('annual assignment scope rejects explicit year mismatch and mismatched external year before writes',async()=>{
 const h=annualPrepareHarness();await assert.rejects(load().prepare(h.client,{...h.body,schoolYear:2027}),/autre année/);assert.equal(h.writes.length,0);
 Object.assign(h.tables.school_mozaik_groups[0],{group_course_id:'s2027-course-31',group_matter_id:'s2027-matter-31'});
 await assert.rejects(load().prepare(h.client,h.body),/autre année/);assert.equal(h.writes.length,0);
});

test('departed historical result is not silently omitted from a Mozaik batch',async()=>{
 const h=annualPrepareHarness();h.tables.school_year_enrollments[0].active=false;
 await assert.rejects(load().prepare(h.client,h.body),/notes historiques/);assert.equal(h.writes.length,0);
 assert.equal(h.tables.school_results[0].grade,12);
});
