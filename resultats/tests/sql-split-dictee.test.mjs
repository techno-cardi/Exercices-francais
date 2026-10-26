import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from './sql-runtime/package/dist/index.js';
const db = new PGlite();
for (const file of ['sql-bootstrap.sql','../../supabase/migrations/20261026180000_gestion_imports.sql','../../supabase/migrations/20261026190000_gestion_split.sql'])
  await db.exec(await readFile(new URL(file, import.meta.url),'utf8'));
await db.exec(`create table fr_dictee_feedback(assignment_id uuid references school_assignments,student_email text references school_students,copy_url text,secret_hash text,errors jsonb,attempt_history jsonb,understood_keys text[],updated_at timestamptz,primary key(assignment_id,student_email));
insert into school_teachers values('teacher@test',true);
insert into school_students values('a@test','101',true),('b@test','102',true);
insert into school_assignments(id,slug,title,group_codes,max_score) values('10000000-0000-4000-8000-000000000001','dictee-test','Dictée',array['101','102'],20);
insert into school_results(assignment_id,student_email,grade,feedback,result_group_code) values('10000000-0000-4000-8000-000000000001','a@test',14,'Existing comment','101');
insert into fr_dictee_feedback values('10000000-0000-4000-8000-000000000001','a@test','https://private.test/a','secret-a','[{"key":"a"}]','[{"number":1}]',array['a'],'2026-10-08'),('10000000-0000-4000-8000-000000000001','b@test','https://private.test/b','secret-b','[]','[]',array[]::text[],'2026-10-08');`);
await db.exec(await readFile(new URL('../../supabase/migrations/20261026203552_gestion_split_dictee.sql',import.meta.url),'utf8'));
const call=async(name,args)=>(await db.query(`select ${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as v`,args)).rows[0].v;
const id='10000000-0000-4000-8000-000000000001';
const preview=()=>call('cardinal_preview_assignment_split',['teacher@test',id,{'b@test':'102'},null]);
let p=await call('cardinal_preview_assignment_split',['teacher@test',id,{},null]);
assert.deepEqual(p.preview.unresolvedEmails,['b@test'],'dictation feedback-only student requires attribution');
p=await preview();assert.equal(p.preview.canConfirm,true,'known dictation dependency should be supported');
await db.query("update fr_dictee_feedback set understood_keys=array['a','b'] where student_email='a@test'");
await assert.rejects(call('cardinal_confirm_assignment_split',['teacher@test',p.previewId]),/stale_preview/);
const before=(await db.query('select to_jsonb(f) as row from fr_dictee_feedback f order by student_email')).rows.map(r=>r.row);
p=await preview();const done=await call('cardinal_confirm_assignment_split',['teacher@test',p.previewId]);
for(const copy of done.assignments){
 const f=(await db.query('select to_jsonb(f) as row from fr_dictee_feedback f where assignment_id=$1',[copy.id])).rows[0].row;
 assert.deepEqual(f,{...before.find(b=>b.student_email===f.student_email),assignment_id:copy.id});
 assert.equal((await db.query('select slug from school_assignments where id=$1',[copy.id])).rows[0].slug,'dictee-test-g'+copy.groupCode);
}
assert.equal((await db.query('select count(*)::int n from fr_dictee_feedback where assignment_id=$1',[id])).rows[0].n,0);
await assert.rejects(db.query("insert into fr_dictee_feedback(assignment_id,student_email) values($1,'a@test')",[id]),/split_archived_assignment/);
assert.deepEqual(await call('cardinal_confirm_assignment_split',['teacher@test',p.previewId]),done);
console.log('PASS dictation split: full feedback/progress rows, feedback-only attribution, stale checks, slugs, guards and idempotency');
await db.close();
