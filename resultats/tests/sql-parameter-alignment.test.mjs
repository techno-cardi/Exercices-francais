import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {PGlite} from './sql-runtime/package/dist/index.js';
const db=new PGlite();
await db.exec(await readFile(new URL('./sql-bootstrap.sql',import.meta.url),'utf8'));
await db.exec(`alter table school_assignments add column school_year integer;
create table school_year_enrollments(school_year integer,student_email text,active boolean,group_code text);
create function cardinal_assert_year_open(integer,boolean) returns void language plpgsql as $$begin return;end$$;
create table school_mozaik_groups(group_code text primary key,establishment_id text,group_course_id text,group_matter_id text,subject_code text);
create table school_mozaik_sync_jobs(id uuid primary key default gen_random_uuid(),code_hash text,assignment_id uuid references school_assignments,group_code text,payload jsonb,status text,expires_at timestamptz,teacher_email text,claim_hash text,claimed_at timestamptz,completed_at timestamptz,created_at timestamptz default now(),result jsonb);`);
for(const name of ['20261026180000_gestion_imports.sql','20261026200000_mozaik_metadata.sql','20261026210000_mozaik_sync_journal.sql','20261028191532_mozaik_preserve_snapshot_nulls.sql','20261029150000_mozaik_destination_switch.sql','20261113220000_mozaik_cancel_reviewed_planned.sql'])await db.exec(await readFile(new URL('../../supabase/migrations/'+name,import.meta.url),'utf8'));
const migration=new URL('../../supabase/migrations/20261114001000_mozaik_parameter_alignment.sql',import.meta.url);
if(existsSync(migration))await db.exec(await readFile(migration,'utf8'));
await db.exec(`insert into school_teachers values('teacher@test',true);
insert into school_students values('cardinal-fixture-only@educ.cscapitale.qc.ca','101',true),('two@test','101',true),('blank@test','101',true);
insert into school_year_enrollments values(2026,'cardinal-fixture-only@educ.cscapitale.qc.ca',true,'101'),(2026,'two@test',true,'101'),(2026,'blank@test',true,'101');
insert into school_mozaik_groups values('101','s','s2026course','s2026matter','FR')`);
const call=async(name,args)=>(await db.query(`select ${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) v`,args)).rows[0].v;
let seq=0;
async function setup({weightSource='mozaik',maximumSource='mozaik',nativeMax=100,nativeWeight=45,gestionMax=70,grade=56,base=null}={}){
 const act='native-'+(++seq),aid=(await db.query("insert into school_assignments(title,group_codes,max_score,weight,report_card_enabled,school_year)values('Test',array['101'],$1,39,true,2026)returning id",[gestionMax])).rows[0].id;
 await db.query("insert into school_results(assignment_id,student_email,grade,feedback,visible,base_score,base_max,base_source)values($1,'cardinal-fixture-only@educ.cscapitale.qc.ca',$2,'Keep feedback',false,$3,$4,$5),($1,'blank@test',null,'Blank',true,null,null,null)",[aid,grade,base?.score??null,base?.max??null,base?.source??null]);
 await db.query("insert into school_mozaik_links(assignment_id,group_code,activity_id,school_year,school_id,subject_id,mozaik_group_id)values($1,'101',$2,'2026','s','FR','s2026matter')",[aid,act]);
 const rev=(await db.query('select revision from school_assignments where id=$1',[aid])).rows[0].revision;
 const payload={protocolVersion:2,sourceRevision:rev,scope:{groupCode:'101',schoolYear:'2026',schoolId:'s',subjectId:'FR',mozaikGroupId:'s2026matter'},group:{code:'101',establishmentId:'s',groupCourseId:'s2026course',groupMatterId:'s2026matter',subjectCode:'FR'},assignment:{id:aid,alignmentVersion:1,weightSource,maximumSource,maxScore:gestionMax,weight:39,reportCardEnabled:true},link:{activityId:act},results:[{email:'cardinal-fixture-only@educ.cscapitale.qc.ca',grade,baseScore:base?.score??null,baseMax:base?.max??null,baseSource:base?.source??null}]};
 const jid=(await db.query("insert into school_mozaik_sync_jobs(assignment_id,group_code,payload,status,claim_hash,teacher_email)values($1,'101',$2,'claimed','hash','teacher@test')returning id",[aid,payload])).rows[0].id;
 const targetMax=maximumSource==='mozaik'?nativeMax:gestionMax,targetWeight=weightSource==='mozaik'?nativeWeight:39;
 const targetGrade=targetMax===gestionMax?grade:Math.round((base?base.score/base.max:grade/gestionMax)*targetMax*10)/10;
 const cp={phase:'planned',activityId:act,reviewConfirmed:false,initial:{activity:{id:act,idGroupe:'s2026matter',parametresEvaluation:{noteMaximale:nativeMax,ponderation:nativeWeight,porteeAuBulletin:true}},results:{eleves:[]}},target:{activity:{id:act,idGroupe:'s2026matter',parametresEvaluation:{noteMaximale:targetMax,ponderation:targetWeight,porteeAuBulletin:true}},results:{eleves:[{fiche:1,resultat:String(targetGrade)}]},gestion:{maxScore:targetMax,weight:targetWeight,reportCardEnabled:true,results:[{email:'cardinal-fixture-only@educ.cscapitale.qc.ca',fiche:1,grade:targetGrade}]}}};
 const result={success:true,activityId:act,competenceCode:'1',syncedCount:1,verified:true,verifiedCount:1,message:'ok'};
 return{aid,jid,payload,cp,result,targetGrade,targetMax,targetWeight,checkpoint:c=>call('cardinal_checkpoint_mozaik_job',[jid,'hash',c]),finish:r=>call('cardinal_finish_mozaik_job',[jid,'hash',r??result])};
}
async function verified(h){for(const phase of ['planned','parameters_verified','results_verified','verified'])await h.checkpoint({...h.cp,phase,reviewConfirmed:true,verifiedCount:1});}
for(const weightSource of ['gestion','mozaik'])for(const maximumSource of ['gestion','mozaik']){
 const h=await setup({weightSource,maximumSource});
 await h.checkpoint(h.cp);
 let a=(await db.query('select max_score,weight from school_assignments where id=$1',[h.aid])).rows[0];
 assert.equal(Number(a.max_score),70,'Preview cannot change Gestion maximum');assert.equal(Number(a.weight),39);
 await assert.rejects(h.finish(),/unverified_sync/);
 await verified(h);const ack=await h.finish();assert.equal(ack.alignmentApplied,true);
 a=(await db.query('select max_score,weight,mozaik_sync_status from school_assignments where id=$1',[h.aid])).rows[0];
 assert.equal(Number(a.max_score),h.targetMax);assert.equal(Number(a.weight),h.targetWeight);assert.equal(a.mozaik_sync_status,'synced');
 const notes=(await db.query('select student_email,grade,feedback,visible,base_score,base_max from school_results where assignment_id=$1 order by student_email',[h.aid])).rows;
 assert.equal(notes[0].grade,null);assert.equal(Number(notes[1].grade),h.targetGrade);assert.equal(notes[1].feedback,'Keep feedback');assert.equal(notes[1].visible,false);
 assert.deepEqual(await h.finish(),ack,'Lost completion response must not apply alignment twice');
 console.log('PASS atomic '+weightSource+'/'+maximumSource);
}
// Invalid source, wrong target, inconsistent local/remote grades are rejected before any native write.
for(const kind of ['wrongMax','wrongWeight','missingLocal','wrongGrade','missingVersion','wrongFiche']){
 const h=await setup(),cp=structuredClone(h.cp);
 if(kind==='wrongMax')cp.target.activity.parametresEvaluation.noteMaximale=99;
 if(kind==='wrongWeight')cp.target.activity.parametresEvaluation.ponderation=12;
 if(kind==='missingLocal')delete cp.target.gestion;
 if(kind==='wrongGrade')cp.target.gestion.results[0].grade=81;
 if(kind==='wrongFiche')cp.target.results.eleves[0].fiche=2;
 if(kind==='missingVersion'){h.payload.assignment.alignmentVersion=2;await db.query('update school_mozaik_sync_jobs set payload=$1 where id=$2',[h.payload,h.jid]);}
 await assert.rejects(h.checkpoint(cp),/alignment|target_snapshot/);console.log('PASS blocked '+kind);
 await db.query("update school_mozaik_sync_jobs set status='expired' where id=$1",[h.jid]);
}
{
 const h=await setup();await verified(h);
 await db.query("update school_results set grade=57 where assignment_id=$1 and student_email='cardinal-fixture-only@educ.cscapitale.qc.ca'",[h.aid]);
 await assert.rejects(h.finish(),/stale_source_revision/);
 await call('cardinal_reconcile_mozaik_job',['teacher@test',h.jid,'hash']);
 const ack=await h.finish();assert.equal(ack.staleSource,true);assert.equal(ack.alignmentApplied,false);
 const a=(await db.query('select max_score,weight from school_assignments where id=$1',[h.aid])).rows[0];assert.equal(Number(a.max_score),70);assert.equal(Number(a.weight),39);
 assert.equal(Number((await db.query("select grade from school_results where assignment_id=$1 and student_email='cardinal-fixture-only@educ.cscapitale.qc.ca'",[h.aid])).rows[0].grade),57);
 console.log('PASS stale-source recovery does not overwrite current Gestion');
}
{
 const h=await setup({gestionMax:100,grade:33.3,nativeMax:3,base:{score:1,max:3,source:'formative'}});await verified(h);await h.finish();
 const r=(await db.query("select grade,base_score,base_max,base_source from school_results where assignment_id=$1 and student_email='cardinal-fixture-only@educ.cscapitale.qc.ca'",[h.aid])).rows[0];
 assert.equal(Number(r.grade),1);assert.equal(Number(r.base_score),1);assert.equal(Number(r.base_max),3);assert.equal(r.base_source,'formative');console.log('PASS canonical base preserved');
}
{
 const h=await setup({nativeWeight:0});await verified(h);await h.finish();
 assert.equal(Number((await db.query('select weight from school_assignments where id=$1',[h.aid])).rows[0].weight),0);console.log('PASS zero weighting is not missing');
}
{
 const h=await setup();h.cp.initial.activity.parametresEvaluation.porteeAuBulletin=false;h.cp.initial.activity.parametresEvaluation.ponderation=null;
 h.cp.target.activity.parametresEvaluation.porteeAuBulletin=false;h.cp.target.activity.parametresEvaluation.ponderation=null;
 h.cp.target.gestion.reportCardEnabled=false;h.cp.target.gestion.weight=null;
 await verified(h);await h.finish();
 const row=(await db.query('select weight,report_card_enabled from school_assignments where id=$1',[h.aid])).rows[0];assert.equal(row.weight,null);assert.equal(row.report_card_enabled,false);console.log('PASS non-bulletin native choice aligns Gestion without invented zero');
}
{
 const h=await setup();await verified(h);
 await db.exec("create function fail_alignment_test() returns trigger language plpgsql as $$begin if new.source_metadata?'mozaikAlignment' then raise exception 'simulated_storage_failure';end if;return new;end$$;create trigger fail_alignment_test before update on school_assignments for each row execute function fail_alignment_test();");
 await assert.rejects(h.finish(),/simulated_storage_failure/);
 assert.equal(Number((await db.query("select grade from school_results where assignment_id=$1 and student_email='cardinal-fixture-only@educ.cscapitale.qc.ca'",[h.aid])).rows[0].grade),56,'Local transaction rolls grades back with metadata');
 assert.equal((await db.query('select status from school_mozaik_sync_jobs where id=$1',[h.jid])).rows[0].status,'claimed');
 await db.exec('drop trigger fail_alignment_test on school_assignments;drop function fail_alignment_test();');
 assert.equal((await h.finish()).alignmentApplied,true);console.log('PASS failed finalization rolls back locally and retry applies once');
}
// Integrated path: actual extension engine + actual PostgreSQL checkpoint/finalize.
// Only Mozaik HTTP is simulated; no external endpoints or pupil identities are used.
if(process.env.CARDINAL_EXTENSION_DIR){
 const {createRequire}=await import('node:module');const vm=await import('node:vm');const path=await import('node:path');const {fileURLToPath}=await import('node:url');
 const require=createRequire(import.meta.url);
 const nativeFile=fileURLToPath(new URL('../../tests/resultats/mozaik-sync.test.cjs',import.meta.url));
 const testSource=await readFile(nativeFile,'utf8');
 const harness=vm.runInNewContext(testSource.slice(0,testSource.indexOf("test('"))+';setup',{require,process,__dirname:path.dirname(nativeFile),console});
 for(const weightSource of ['gestion','mozaik'])for(const maximumSource of ['gestion','mozaik']){
  const h=await setup({weightSource,maximumSource});
  const n=harness({nativeRows:[{fiche:2,resultat:'60',commentaire:'Outside'},{fiche:3,resultat:'ABS'}],members:[{fiche:1,courriel:'cardinal-fixture-only@educ.cscapitale.qc.ca'}],checkpointHandler:h.checkpoint});
  Object.assign(n.payload.group,h.payload.group);
  Object.assign(n.payload.assignment,h.payload.assignment);
  Object.assign(n.payload,{results:h.payload.results,link:h.payload.link,reviewOnly:true,confirmedReview:false});
  n.activity.id=h.cp.activityId;n.activity.idGroupe=h.payload.group.groupMatterId;
  n.activity.parametresEvaluation.noteMaximale=100;n.activity.parametresEvaluation.ponderation=45;
  const preview=await n.run();assert.equal(preview.previewRequired,true,preview.message);assert.equal(n.writes.length,0);
  assert.equal(Number((await db.query('select max_score from school_assignments where id=$1',[h.aid])).rows[0].max_score),70);
  n.payload.checkpoint=preview.checkpoint;n.payload.reviewOnly=false;n.payload.confirmedReview=true;
  const written=await n.run();assert.equal(written.success,true,written.message);assert.equal(n.writes.length,1);
  assert.equal(Number(n.writes[0].eleves.find(x=>x.fiche===1).resultat),h.targetGrade);
  assert.equal(Number(n.writes[0].eleves.find(x=>x.fiche===2).resultat),maximumSource==='mozaik'?60:42);
  assert.equal(n.writes[0].eleves.find(x=>x.fiche===3).resultat,'ABS');
  // Simulate loss of local completion response after it committed.
  const receipt=await h.finish();assert.equal(receipt.alignmentApplied,true);assert.deepEqual(await h.finish(),receipt);
  assert.equal(Number((await db.query("select grade from school_results where assignment_id=$1 and student_email='cardinal-fixture-only@educ.cscapitale.qc.ca'",[h.aid])).rows[0].grade),h.targetGrade);
  console.log('PASS real engine + PostgreSQL '+weightSource+'/'+maximumSource);
 }
}
assert.equal((await db.query("select has_function_privilege('anon','public.cardinal_finish_mozaik_job(uuid,text,jsonb)','EXECUTE') v")).rows[0].v,false);
await db.close();console.log('PASS alignment PostgreSQL integration');
