import assert from 'node:assert/strict';import {readFile}from'node:fs/promises';import{PGlite}from'./sql-runtime/package/dist/index.js';
process.on('uncaughtException',e=>{console.error('SQL school years failure:',e.message,e.where||'',e.internalQuery||'');process.exit(1);});
const db=new PGlite();const migration=async name=>db.exec(await readFile(new URL('../../supabase/migrations/'+name,import.meta.url),'utf8'));
await db.exec(await readFile(new URL('./sql-bootstrap.sql',import.meta.url),'utf8'));
await db.exec(`alter table school_students add name text not null default 'Synthetic pupil',add first_name text,add last_name text,add fiche_hash text not null default 'original-credential',add roster_name_source text,add updated_at timestamptz default now();
create table school_mozaik_groups(group_code text primary key,establishment_id text,group_course_id text,group_matter_id text,subject_code text,updated_at timestamptz default now());
create table school_mozaik_sync_jobs(id uuid primary key default gen_random_uuid(),code_hash text,assignment_id uuid references school_assignments,group_code text,payload jsonb,status text,expires_at timestamptz,teacher_email text,claim_hash text,claimed_at timestamptz,completed_at timestamptz,created_at timestamptz default now(),result jsonb);
create table school_formative_feedbacks(assignment_id uuid references school_assignments,student_email text references school_students,formative_id text,formative_item_id text,question_number text,question_label text,feedback text,feedback_message_id text,updated_at timestamptz default now(),primary key(assignment_id,student_email,formative_item_id));
insert into school_teachers values('teacher@test',true);
insert into school_students(email,group_code,name,first_name,last_name)values('alpha@educ.cscapitale.qc.ca','31','Alpha Original','Alpha','Original'),('departed@educ.cscapitale.qc.ca','31','Departed Original','Departed','Original'),('comments@educ.cscapitale.qc.ca','31','Comments Only','Comments','Only');
insert into school_mozaik_groups values('31','s','s2026-course','s2026-matter','FR',now());`);
await migration('20261008180000_fr_dictee_feedback.sql');await migration('20261009120500_dictee_attempt_history.sql');
for(const name of ['20261026180000_gestion_imports.sql','20261026190000_gestion_split.sql','20261026200000_mozaik_metadata.sql','20261026203552_gestion_split_dictee.sql','20261026210000_mozaik_sync_journal.sql'])await migration(name);
const aid=(await db.query("insert into school_assignments(title,slug,group_codes,max_score,activity_date) values('Old exam','dictee-old',array['31'],20,'2026-10-01')returning id")).rows[0].id;
await db.query("insert into school_results(assignment_id,student_email,grade,feedback)values($1,'alpha@educ.cscapitale.qc.ca',12.34567,'Original feedback')",[aid]);
await db.query("insert into school_formative_feedbacks(assignment_id,student_email,formative_item_id,feedback)values($1,'comments@educ.cscapitale.qc.ca','item','Comment without numeric grade')",[aid]);
await db.query("insert into fr_dictee_feedback(assignment_id,student_email,copy_url,secret_hash,errors,attempt_history)values($1,'alpha@educ.cscapitale.qc.ca','https://synthetic.test/copy',repeat('a',64),'[]','[{\"attempt\":1}]')",[aid]);
const before=(await db.query('select to_jsonb(r) v from school_results r where assignment_id=$1',[aid])).rows[0].v;
const dictationBefore=(await db.query('select to_jsonb(r) v from fr_dictee_feedback r where assignment_id=$1',[aid])).rows[0].v;
await migration('20261026211837_school_years_and_archives.sql');
const call=async(name,args=[])=>(await db.query(`select ${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) v`,args)).rows[0].v;
const preview=(kind,request)=>call('cardinal_preview_school_year',['teacher@test',kind,request]);const confirm=id=>call('cardinal_confirm_school_year',['teacher@test',id]);
assert.equal((await call('cardinal_year_catalog')).activeYear,2026);
assert.deepEqual((await db.query('select to_jsonb(r) v from school_results r where assignment_id=$1',[aid])).rows[0].v,before);
assert.equal((await db.query('select count(*)::int n from school_assignment_roster where assignment_id=$1',[aid])).rows[0].n,3);
// Splitting uses the source assessment membership before copying results, even
// when annual membership has moved to another group since the work was created.
await db.exec("insert into school_year_groups(school_year,group_code)values(2026,'32')");
const sharedWork=(await db.query("insert into school_assignments(title,group_codes,max_score,activity_date,school_year)values('Shared historical exam',array['31','32'],20,'2026-10-01',2026)returning id")).rows[0].id;
await db.query("insert into school_results(assignment_id,student_email,grade,result_group_code,feedback)values($1,'alpha@educ.cscapitale.qc.ca',10,'31','Historical split feedback')",[sharedWork]);
await db.query("insert into school_formative_feedbacks(assignment_id,student_email,formative_item_id,feedback)values($1,'comments@educ.cscapitale.qc.ca','split-item','Split comment only')",[sharedWork]);
await db.exec("update school_year_enrollments set group_code='32' where school_year=2026 and student_email='alpha@educ.cscapitale.qc.ca'");
const splitPreview=await call('cardinal_preview_assignment_split',['teacher@test',sharedWork,{'comments@educ.cscapitale.qc.ca':'31'},null]);
const splitResult=await call('cardinal_confirm_assignment_split',['teacher@test',splitPreview.previewId]);
const split31=splitResult.assignments.find(a=>a.groupCode==='31').id,split32=splitResult.assignments.find(a=>a.groupCode==='32').id;
assert.equal((await db.query("select grade from school_results where assignment_id=$1 and student_email='alpha@educ.cscapitale.qc.ca'",[split31])).rows[0].grade,'10');
assert.equal((await db.query("select group_code from school_assignment_roster where assignment_id=$1 and student_email='alpha@educ.cscapitale.qc.ca'",[split31])).rows[0].group_code,'31');
assert.equal((await db.query('select count(*)::int n from school_assignment_roster where assignment_id=$1',[split32])).rows[0].n,0,'current moved cohort is not copied into the other historical child');
assert.equal((await db.query('select feedback from school_formative_feedbacks where assignment_id=$1',[split31])).rows[0].feedback,'Split comment only');
await db.exec("update school_year_enrollments set group_code='31' where school_year=2026 and student_email='alpha@educ.cscapitale.qc.ca'");
let p=await preview('create',{year:2027});await confirm(p.previewId);
const rows=[{email:'alpha@educ.cscapitale.qc.ca',name:'Alpha New Name',firstName:'Alpha',lastName:'New Name',group:'77'},
 {email:'new@educ.cscapitale.qc.ca',name:'New Cohort',firstName:'New',lastName:'Cohort',group:'31',ficheHash:'pbkdf2_sha256$120000$c2FsdA$aGFzaA'}];
await assert.rejects(preview('roster',{year:2027,mode:'merge',rows:[rows[0],rows[0]]}),/duplicate_roster_student/);
await assert.rejects(preview('roster',{year:2027,mode:'merge',rows:[{...rows[1],ficheHash:null}]}),/new_student_fiche_required/);
p=await preview('roster',{year:2027,mode:'merge',rows});assert.equal(p.preview.newStudents,1);await confirm(p.previewId);
assert.equal((await db.query("select active from school_students where email='new@educ.cscapitale.qc.ca'")).rows[0].active,false);
assert.equal((await db.query("select group_code from school_students where email='alpha@educ.cscapitale.qc.ca'")).rows[0].group_code,'31');
assert.equal((await db.query("select fiche_hash from school_students where email='alpha@educ.cscapitale.qc.ca'")).rows[0].fiche_hash,'original-credential');
await db.exec('update school_year_config set enforced=true');
const job=(await db.query("insert into school_mozaik_sync_jobs(assignment_id,group_code,status,payload)values($1,'31','ready','{}')returning id",[aid])).rows[0].id;
await assert.rejects(preview('activate',{year:2027}),/school_year_pending_mozaik/);await db.query("update school_mozaik_sync_jobs set status='completed' where id=$1",[job]);
p=await preview('activate',{year:2027});await db.query("update school_results set feedback='Concurrent original comment' where assignment_id=$1",[aid]);await assert.rejects(confirm(p.previewId),/stale_year_preview/);
await db.query("update school_results set feedback='Original feedback' where assignment_id=$1",[aid]);
const preserved=(await db.query('select to_jsonb(r) v from school_results r where assignment_id=$1',[aid])).rows[0].v;
p=await preview('activate',{year:2027});const activation=await confirm(p.previewId);assert.equal(activation.activeYear,2027);assert.deepEqual(await confirm(p.previewId),activation);
assert.equal((await db.query("select group_code from school_students where email='alpha@educ.cscapitale.qc.ca'")).rows[0].group_code,'77');
assert.equal((await db.query("select active from school_students where email='departed@educ.cscapitale.qc.ca'")).rows[0].active,true,'archiving is not account deactivation');
assert.equal((await db.query('select count(*)::int n from school_mozaik_groups')).rows[0].n,0);
assert.deepEqual((await db.query('select to_jsonb(r) v from school_results r where assignment_id=$1',[aid])).rows[0].v,preserved);
assert.deepEqual((await db.query('select to_jsonb(r) v from fr_dictee_feedback r where assignment_id=$1',[aid])).rows[0].v,dictationBefore);
assert.equal((await db.query("select group_code from school_assignment_roster where assignment_id=$1 and student_email='alpha@educ.cscapitale.qc.ca'",[aid])).rows[0].group_code,'31');
for(const sql of ["update school_results set grade=1 where assignment_id=$1","delete from school_results where assignment_id=$1","update school_formative_feedbacks set feedback='bad' where assignment_id=$1","update fr_dictee_feedback set started_at=now() where assignment_id=$1","delete from school_assignments where id=$1"])
 await assert.rejects(db.query(sql,[aid]),/school_year_read_only/);
await assert.rejects(call('cardinal_write_assignment',[null,{title:'Stale create',school_year:2026,max_score:20},'31']),/school_year_read_only|school_year_not_active/);
await assert.rejects(call('cardinal_write_assignment',[null,{title:'Old client',max_score:20},'31']),/school_year_context_required/);
const newWork=await call('cardinal_write_assignment',[null,{title:'New cohort exam',school_year:2027,max_score:20},'31']);
await assert.rejects(call('cardinal_update_annual_roster_names',[2026,'31',[{email:'alpha@educ.cscapitale.qc.ca',firstName:'Wrong',lastName:'Year'}]]),/school_year_read_only/);
assert.equal(await call('cardinal_update_annual_roster_names',[2027,'31',[{email:'new@educ.cscapitale.qc.ca',firstName:'Verified',lastName:'New Name'}]]),1);
assert.equal((await db.query("select first_name from school_students where email='new@educ.cscapitale.qc.ca'")).rows[0].first_name,'Verified');
assert.equal((await db.query('select first_name from school_assignment_roster where assignment_id=$1',[newWork])).rows[0].first_name,'New','name corrections preserve captured assessment identity');
assert.deepEqual((await db.query('select student_email from school_assignment_roster where assignment_id=$1',[newWork])).rows.map(r=>r.student_email),['new@educ.cscapitale.qc.ca']);
await assert.rejects(db.query("insert into school_results(assignment_id,student_email,grade) values($1,'departed@educ.cscapitale.qc.ca',10)",[newWork]),/invalid_assignment_member/);
await assert.rejects(db.query("insert into school_mozaik_groups values('31','s','s2026-course','s2026-matter','FR',now())"),/mozaik_school_year_mismatch/);
// Actual JSON readers must keep archived members and same-code cohorts separate.
await db.query('update school_assignments set published=true where id=$1',[newWork]);
await db.query("insert into school_results(assignment_id,student_email,grade)values($1,'new@educ.cscapitale.qc.ca',0)",[newWork]);
const oldOverview=await call('cardinal_group_year_overview',[2026,'31']);
assert.equal(oldOverview.students.some(s=>s.email==='new@educ.cscapitale.qc.ca'),false);
assert.equal(oldOverview.students.find(s=>s.email==='alpha@educ.cscapitale.qc.ca').results[aid].grade,12.34567);
const newOverview=await call('cardinal_group_year_overview',[2027,'31']);
assert.deepEqual(newOverview.students.map(s=>s.email),['new@educ.cscapitale.qc.ca']);
assert.equal(newOverview.students[0].results[newWork].grade,0);
assert.equal((await call('cardinal_student_year_results',['new@educ.cscapitale.qc.ca'])).some(a=>a.id===aid),false);
await assert.rejects(db.query("update school_assignment_roster set school_year=2026 where assignment_id=$1",[newWork]),/assignment_roster_scope_mismatch/);
// A later row pointing to an archive rolls back the entire feedback batch.
await assert.rejects(call('cardinal_save_annual_feedback',['teacher@test','F',[{assignmentId:newWork,email:'new@educ.cscapitale.qc.ca',questionId:'q',feedback:'Must roll back'},{assignmentId:aid,email:'alpha@educ.cscapitale.qc.ca',questionId:'q',feedback:'Archive forbidden'}],2027]),/school_year_read_only/);
assert.equal((await db.query('select count(*)::int n from school_formative_feedbacks where assignment_id=$1',[newWork])).rows[0].n,0);
// Late arrival membership is explicit and append-only; no old result disappears.
const late={email:'late@educ.cscapitale.qc.ca',name:'Late Arrival',firstName:'Late',lastName:'Arrival',group:'31',ficheHash:'pbkdf2_sha256$120000$c2FsdA$aGFzaA'};
p=await preview('roster',{year:2027,mode:'merge',rows:[late]});await confirm(p.previewId);
assert.equal((await db.query('select count(*)::int n from school_assignment_roster where assignment_id=$1',[newWork])).rows[0].n,1);
p=await preview('roster_append',{year:2027,assignmentId:newWork});assert.equal(p.preview.addedCount,1);await confirm(p.previewId);await confirm(p.previewId);
assert.equal((await db.query('select count(*)::int n from school_assignment_roster where assignment_id=$1',[newWork])).rows[0].n,2);
assert.equal((await db.query('select grade from school_results where assignment_id=$1',[newWork])).rows[0].grade,'0');
p=await preview('reopen',{year:2026});await confirm(p.previewId);await db.query("update school_results set feedback='Explicit archive correction' where assignment_id=$1",[aid]);
await db.query('update school_assignments set published=true where id=$1',[aid]);
const history=await call('cardinal_student_year_results',['alpha@educ.cscapitale.qc.ca']);assert.equal(history[0].group,'31');assert.equal(history[0].schoolYear,2026);assert.equal(history[0].result.grade,12.34567);
assert.equal((await call('cardinal_student_annual_feedback',['comments@educ.cscapitale.qc.ca'])).filter(f=>f.assignmentId===aid).length,1,'comment-only historical member retains their feedback');
assert.equal((await call('cardinal_student_annual_feedback',['new@educ.cscapitale.qc.ca'])).length,0);
assert.equal((await call('cardinal_year_catalog')).activeYear,2027,'reopening manual corrections never activates old year');
await assert.rejects(call('cardinal_assert_year_open',[2026,true]),/school_year_not_active/);
assert.equal((await db.query("select has_function_privilege('anon','public.cardinal_confirm_school_year(text,uuid)','EXECUTE') v")).rows[0].v,false);
// A member with any retained assessment data cannot disappear from historical readers.
await assert.rejects(db.query("delete from school_assignment_roster where assignment_id=$1 and student_email='alpha@educ.cscapitale.qc.ca'",[aid]),/assignment_roster_has_history/);
await assert.rejects(db.query("delete from school_assignment_roster where assignment_id=$1 and student_email='comments@educ.cscapitale.qc.ca'",[aid]),/assignment_roster_has_history/);
await db.query("insert into fr_dictee_feedback(assignment_id,student_email,copy_url,secret_hash,errors) values($1,'departed@educ.cscapitale.qc.ca','https://synthetic.test/only-copy',repeat('b',64),'[]')",[aid]);
await assert.rejects(db.query("delete from school_assignment_roster where assignment_id=$1 and student_email='departed@educ.cscapitale.qc.ca'",[aid]),/assignment_roster_has_history/);
const enrollmentHistoryBefore=(await db.query('select jsonb_agg(to_jsonb(h) order by id) v from school_year_enrollment_history h')).rows[0].v;
for(const mutation of ['delete from school_year_enrollment_history',"update school_year_enrollment_history set after_row='{}'",'truncate school_year_enrollment_history'])await assert.rejects(db.exec(mutation),/enrollment_history_immutable/);
assert.deepEqual((await db.query('select jsonb_agg(to_jsonb(h) order by id) v from school_year_enrollment_history h')).rows[0].v,enrollmentHistoryBefore);
// Empty auto-captured cohorts may be replaced during a split; deleting an open
// parent assignment is still a supported explicit operation with normal cascades.
const scratch=await call('cardinal_write_assignment',[null,{title:'Disposable open work',school_year:2027,max_score:20},'31']);
await db.query('delete from school_assignment_roster where assignment_id=$1',[scratch]);
await db.query("insert into school_results(assignment_id,student_email,grade)values($1,'new@educ.cscapitale.qc.ca',1)",[scratch]);
await db.query('delete from school_assignments where id=$1',[scratch]);
assert.equal((await db.query('select count(*)::int n from school_assignment_roster where assignment_id=$1',[scratch])).rows[0].n,0);
// An unused staged profile can join a different future draft. Existing deliberately
// disabled accounts (pending_school_year IS NULL) must never be reactivated.
for(const year of [2028,2029]){p=await preview('create',{year});await confirm(p.previewId);}
const staged={email:'staged-other-year@educ.cscapitale.qc.ca',name:'Staged Other Year',firstName:'Staged',lastName:'Other Year',group:'A-2',active:false,ficheHash:'pbkdf2_sha256$120000$c2FsdA$aGFzaA'};
p=await preview('roster',{year:2028,mode:'merge',rows:[staged]});await confirm(p.previewId);
await db.exec("insert into school_students(email,group_code,name,active) values('disabled-account@educ.cscapitale.qc.ca','A-2','Disabled Account',false)");
const stagedHash=(await db.query('select fiche_hash from school_students where email=$1',[staged.email])).rows[0].fiche_hash;
p=await preview('roster',{year:2029,mode:'merge',rows:[{...staged,active:true,ficheHash:undefined},{email:'disabled-account@educ.cscapitale.qc.ca',name:'Disabled Account',group:'A-2',active:true}]});await confirm(p.previewId);
p=await preview('activate',{year:2029});await confirm(p.previewId);
const stagedAfter=(await db.query('select active,pending_school_year,fiche_hash from school_students where email=$1',[staged.email])).rows[0];
assert.equal(stagedAfter.active,true);assert.equal(stagedAfter.pending_school_year,null);assert.equal(stagedAfter.fiche_hash,stagedHash);
assert.equal((await db.query("select active from school_students where email='disabled-account@educ.cscapitale.qc.ca'")).rows[0].active,false);
console.log('PASS school years: additive bootstrap, stable identities/credentials, staged cohorts, pending-sync and stale guards, atomic activation/replay, immutable archives, same-code isolation, explicit reopen');
await db.close();

