const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), vm=require('node:vm'), path=require('node:path');
const root=path.join(__dirname,'../../supabase/functions/fr-dictee-feedback');
function harness(){
 const tables={school_assignments:[{id:'old',slug:'dictee-test',title:'Dictée',group_codes:[],split_archived:true,max_score:20},{id:'g31',slug:'dictee-test-g31',title:'Dictée',group_codes:['31'],split_archived:false,max_score:20},{id:'g32',slug:'dictee-test-g32',title:'Dictée',group_codes:['32'],split_archived:false,max_score:20}],school_assignment_splits:[{old_assignment_id:'old',group_code:'31',assignment_id:'g31'},{old_assignment_id:'old',group_code:'32',assignment_id:'g32'}],fr_dictee_feedback:[{assignment_id:'g31',student_email:'a@test',errors:[]},{assignment_id:'g32',student_email:'b@test',errors:[]}],school_results:[{assignment_id:'g31',student_email:'a@test',grade:14},{assignment_id:'g32',student_email:'b@test',grade:16}],school_students:[{email:'a@test',name:'A',group_code:'31',active:true},{email:'b@test',name:'B',group_code:'32',active:true}]};
 for(const a of tables.school_assignments)a.school_year=2026;
 tables.school_assignment_roster=[{assignment_id:'g31',student_email:'a@test',group_code:'31',school_year:2026,name:'A Historical'},{assignment_id:'g32',student_email:'b@test',group_code:'32',school_year:2026,name:'B Historical'}];
 const studentToken='synthetic-student-session-token-long-enough';
 tables.school_student_sessions=[{student_email:'a@test',expires_at:'2099-01-01',token_hash:require('node:crypto').createHash('sha256').update(studentToken).digest('hex')}];
 const catalog={activeYear:2027,enforced:true,years:[{year:2026,status:'open'},{year:2027,status:'open'}]},writes=[];
 const db={rpc:async(name)=>{if(name==='cardinal_year_catalog')return{data:structuredClone(catalog)};writes.push({rpc:name});throw Error('Unexpected mutation RPC: '+name);},from(table){let rows=tables[table]||[];const q={select(){return q;},eq(k,v){rows=rows.filter(r=>r[k]===v);return q;},in(k,vs){rows=rows.filter(r=>vs.includes(r[k]));return q;},not(k,op,v){rows=rows.filter(r=>r[k]!==v);return q;},order(){return q;},update(p){writes.push({table,update:p});return q;},maybeSingle:async()=>({data:rows[0]||null}),then(resolve,reject){return Promise.resolve({data:rows}).then(resolve,reject);}};return q;}};
 let helper='';try{helper=fs.readFileSync(path.join(root,'split-work.ts'),'utf8').replaceAll('export ','');}catch{}
 const shared=fs.readFileSync(path.join(root,'../_shared/school-years.ts'),'utf8').replace(/^export /gm,'');
 const source=fs.readFileSync(path.join(root,'index.ts'),'utf8').replace(/^import .*;\r?\n/gm,'');
 const context=vm.createContext({TextEncoder,crypto:require('node:crypto').webcrypto,Response,Request,createClient:()=>db,Deno:{env:{get:key=>({SUPABASE_URL:'https://synthetic.invalid',SUPABASE_SERVICE_ROLE_KEY:'synthetic-only',SUPABASE_ANON_KEY:'public-test'}[key]||'')},serve:fn=>{context.handle=fn;}}});
 // Existing endpoint TypeScript is parsed with Node's built-in stripper.
 vm.runInContext(require('node:module').stripTypeScriptTypes(shared+'\n'+helper+'\n'+source+'\nteacherAllowed=async()=>({});globalThis.routes={getAssignedWork,teacherStatus,teacherCatalog};',{mode:'transform'}),context);
 return {db,tables,routes:context.routes,catalog,writes,studentToken,handle:context.handle};
}
test('old dictation URL resolves each student to the independent group copy',async()=>{
 const h=harness();
 for(const [group,id,email] of [['31','g31','a@test'],['32','g32','b@test']]){
  const r=await h.routes.getAssignedWork(h.db,{email,group_code:group},'dictee-test');assert.equal(r.assignment.id,id);assert.equal(r.feedback.student_email,email);
 }
 await assert.rejects(h.routes.getAssignedWork(h.db,{email:'outsider@test',group_code:'31'},'dictee-test'),/indisponible|attribué/);
});
test('old teacher link reads both copies and group filter isolates results',async()=>{
 const h=harness();const all=await h.routes.teacherStatus(h.db,{workSlug:'dictee-test'});assert.equal(all.rows.length,2);assert.equal(all.rows[0].grade,14);assert.equal(all.rows[1].grade,16);
 const group=await h.routes.teacherStatus(h.db,{workSlug:'dictee-test',group:'32'});assert.equal(group.rows.length,1);assert.equal(group.rows[0].group,'32');assert.equal(group.rows[0].grade,16);
 const catalog=await h.routes.teacherCatalog(h.db,{});assert.equal(catalog.works.length,2);assert.ok(catalog.works.every(w=>w.groups.length===1));
});
test('group filter remains isolated for a dictation that has not been split',async()=>{
 const h=harness();h.tables.school_assignments[0].split_archived=false;h.tables.school_assignments[0].group_codes=['31','32'];
 for(const member of h.tables.school_assignment_roster)member.assignment_id='old';
 for(const row of [...h.tables.fr_dictee_feedback,...h.tables.school_results])row.assignment_id='old';
 const result=await h.routes.teacherStatus(h.db,{workSlug:'dictee-test',group:'32'});
 assert.equal(result.rows.length,1);assert.equal(result.rows[0].group,'32');
});

test('old dictation route follows recorded membership after a group move and keeps archived access',async()=>{
 const h=harness();h.catalog.years[0].status='archived';h.tables.school_students[0].group_code='77';
 const out=await h.routes.getAssignedWork(h.db,h.tables.school_students[0],'dictee-test');
 assert.equal(out.assignment.id,'g31');assert.equal(out.assignment.historicalGroup,'31');assert.equal(out.assignment.readOnly,true);
 assert.equal(out.feedback.student_email,'a@test');
});

test('reused current group does not grant the next cohort access to historical copies',async()=>{
 const h=harness();h.tables.school_students.push({email:'new@test',name:'New Cohort',active:true,group_code:'31'});
 await assert.rejects(h.routes.getAssignedWork(h.db,{email:'new@test',group_code:'31'},'dictee-test'),/indisponible|attribué/);
 const status=await h.routes.teacherStatus(h.db,{workSlug:'dictee-test',group:'31'});
 assert.deepEqual(Array.from(status.rows,s=>s.email),['a@test']);assert.equal(status.rows[0].grade,14);
});

test('archived dictation HTTP load never starts a new attempt and write actions reject',async()=>{
 const h=harness();h.catalog.years[0].status='archived';h.tables.school_students[0].group_code='77';
 Object.assign(h.tables.fr_dictee_feedback[0],{released:true,started_at:null,attempt_number:1,attempt_history:[{attempt:1}],copy_url:'https://synthetic.invalid/copy'});
 const before=structuredClone(h.tables.fr_dictee_feedback[0]);
 const request=action=>new Request('https://synthetic.invalid',{method:'POST',headers:{apikey:'public-test','content-type':'application/json'},body:JSON.stringify({action,token:h.studentToken,workSlug:'dictee-test',attemptNumber:1})});
 const response=await h.handle(request('load'));assert.equal(response.status,200);const out=await response.json();
 assert.equal(out.readOnly,true);assert.equal(out.group,'31');assert.equal(out.grade,14);assert.equal(out.copyUrl,before.copy_url);
 for(const action of ['restart','copyOpened','finish'])assert.equal((await h.handle(request(action))).status,409);
 assert.equal(h.writes.length,0);assert.deepEqual(h.tables.fr_dictee_feedback[0],before);
});
