import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from './sql-runtime/package/dist/index.js';
const db=new PGlite();
await db.exec(`create role anon;create role authenticated;create role service_role;
create table public.school_teachers(email text primary key, active boolean);
create table public.school_mozaik_sync_jobs(id uuid primary key,teacher_email text,status text,checkpoint jsonb,payload jsonb,result jsonb,completed_at timestamptz);
create table public.school_results(id int,grade numeric);insert into school_results values(1,17.5);
insert into school_teachers values('teacher@test.invalid',true),('inactive@test.invalid',false);`);
await db.exec(await readFile(new URL('../../supabase/migrations/20261113220000_mozaik_cancel_reviewed_planned.sql',import.meta.url),'utf8'));
const payload={protocolVersion:2,link:{activityId:'activity'}};
const checkpoint={phase:'planned',reviewConfirmed:true,activityId:'activity'};
let n=1,count=0;
const fixtures=[
 ['unreviewed',payload,{...checkpoint,reviewConfirmed:false},'cancelled'],
 ['claimed',payload,null,'cancelled'],
 ['reviewed-existing',payload,checkpoint,'cancelled'],
 ['missing-protocol',{link:payload.link},checkpoint,'preserved'],
 ['missing-link',{protocolVersion:2},checkpoint,'preserved'],
 ['different-link',{...payload,link:{activityId:'other'}},checkpoint,'preserved'],
 ['switching',{...payload,previousLink:{activityId:'before'}},checkpoint,'preserved'],
 ...['creating','created','parameters_verified','results_verified','verified'].map(phase=>[phase,payload,{...checkpoint,phase},'preserved']),
 ['request-inflight',payload,{...checkpoint,activityWrite:{state:'inflight'}},'preserved'],
 ['request-unknown',payload,{...checkpoint,activityWrite:{state:'mystery'}},'preserved'],
 ['request-rejected',payload,{...checkpoint,activityWrite:{state:'rejected',httpStatus:400}},'cancelled'],
 ['request-returned',payload,{...checkpoint,activityWrite:{state:'confirmed'}},'cancelled']
];
for(const [name,p,c,expected] of fixtures){
 const id=`00000000-0000-4000-8000-${String(n++).padStart(12,'0')}`;
 await db.query("insert into school_mozaik_sync_jobs(id,teacher_email,status,payload,checkpoint)values($1,'teacher@test.invalid','claimed',$2,$3)",[id,p,c]);
 const call=async who=>(await db.query('select public.cardinal_cancel_unwritten_mozaik_job($1,$2) as v',[who,id])).rows[0].v;
 await assert.rejects(call('other@test.invalid'),/invalid_job_owner/);
 const before=(await db.query('select * from school_mozaik_sync_jobs where id=$1',[id])).rows[0];
 const out=await call('teacher@test.invalid');assert.equal(out.mode,expected,name);
 const after=(await db.query('select * from school_mozaik_sync_jobs where id=$1',[id])).rows[0];
 if(expected==='cancelled'){
  assert.equal(after.status,'expired');assert(after.completed_at);
  const replay=await call('teacher@test.invalid');assert.equal(replay.mode,'cancelled');
  assert.equal(replay.activitySettingsMayHaveChanged,out.activitySettingsMayHaveChanged,'replay warning');
 }else assert.deepEqual(after,before,name+' untouched');
 assert.equal((await db.query('select grade from school_results')).rows[0].grade,'17.5');count++;
}
assert.equal((await db.query("select has_function_privilege('anon','public.cardinal_cancel_unwritten_mozaik_job(text,uuid)','execute') as ok")).rows[0].ok,false);
assert.equal((await db.query("select has_function_privilege('authenticated','public.cardinal_cancel_unwritten_mozaik_job(text,uuid)','execute') as ok")).rows[0].ok,false);
assert.equal((await db.query("select has_function_privilege('service_role','public.cardinal_cancel_unwritten_mozaik_job(text,uuid)','execute') as ok")).rows[0].ok,true);
await db.close();console.log(`PASS ${count} cancellation states, owner checks, replay, grades preserved, grants`);
