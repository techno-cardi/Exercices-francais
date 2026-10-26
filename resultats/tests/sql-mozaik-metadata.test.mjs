import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from './sql-runtime/package/dist/index.js';
const db=new PGlite();
await db.exec(await readFile(new URL('./sql-bootstrap.sql',import.meta.url),'utf8'));
await db.exec(await readFile(new URL('../../supabase/migrations/20261026180000_gestion_imports.sql',import.meta.url),'utf8'));
try{await db.exec(await readFile(new URL('../../supabase/migrations/20261026200000_mozaik_metadata.sql',import.meta.url),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
await db.exec("insert into school_teachers values ('teacher@test',true);insert into school_students values('one@test','31',true)");
const call=async(name,args)=>(await db.query(`select ${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as v`,args)).rows[0].v;
const link=id=>({group_code:'31',school_year:'2026-2027',school_id:'school',subject_id:'fr',mozaik_group_id:'mg31',activity_id:id,planning_id:'p1'});
const plan=id=>({assignmentId:null,beforeSnapshot:null,newAssignment:{title:'Roman',weight:15,max_score:null,import_state:'metadata_only',published:false,mozaik_results_visible:true,source_metadata:{mozaik:{maxScore:null,weight:15}}},assignmentPatch:{},groupCode:'31',writes:[],mozaikLink:link(id)});
const store=async(items)=>{const id=crypto.randomUUID();await db.query("insert into school_assignment_operations(id,teacher_email,kind,plan) values($1,'teacher@test','mozaik_metadata',$2)",[id,{items}]);return id;};
const confirm=id=>call('cardinal_confirm_mozaik_metadata_batch',['teacher@test',id]);
let id=await store([plan('a1'),plan('a2')]);
const first=await confirm(id);assert.equal(first.assignments.length,2);assert.equal(first.importedCount,0);assert.notEqual(first.assignments[0].assignmentId,first.assignments[1].assignmentId);assert.deepEqual(await confirm(id),first);
let rows=(await db.query('select * from school_mozaik_links')).rows;assert.equal(rows.length,2);assert.equal(rows[0].school_year,'2026-2027');assert.equal(rows[0].mozaik_group_id,'mg31');
const aid=first.assignments[0].assignmentId;let snap=await call('cardinal_assignment_snapshot',[aid]);assert.equal(snap.assignment.max_score,null);assert.equal(snap.assignment.mozaik_results_visible,true);assert.equal(snap.assignment.published,false);
const count=async()=>(await db.query('select count(*)::int as n from school_assignments')).rows[0].n;
id=await store([plan('a3'),plan('a1')]);await assert.rejects(confirm(id),/mozaik_link_conflict/);assert.equal(await count(),2);assert.equal((await db.query("select count(*)::int as n from school_mozaik_links where activity_id='a3'")).rows[0].n,0);
// Same remote activity id in a different school year is a separate identity.
id=await store([{...plan('a1'),mozaikLink:{...link('a1'),school_year:'2027-2028'}}]);await confirm(id);assert.equal(await count(),3);
// Associating a graded existing work leaves grade, canonical bases and settings intact.
const batch=await call('cardinal_create_assignment_batch',['teacher@test',crypto.randomUUID(),{title:'Existing',weight:42,max_score:40,published:true},['31']]);const existing=batch.assignments[0].id;
await db.query("insert into school_results(assignment_id,student_email,grade,base_score,base_max,base_source,result_group_code) values($1,'one@test',35,35,40,'gestion','31')",[existing]);
snap=await call('cardinal_assignment_snapshot',[existing]);
const associated={...plan('a4'),assignmentId:existing,beforeSnapshot:snap,newAssignment:null,assignmentPatch:{source_metadata:{mozaik:{activityId:'a4',weight:15}}}};
id=await store([associated]);await confirm(id);const after=await call('cardinal_assignment_snapshot',[existing]);assert.equal(after.assignment.max_score,40);assert.equal(after.assignment.weight,42);assert.equal(after.assignment.published,true);assert.deepEqual(after.results,snap.results);
// Existing links cannot be silently replaced; changes since preview rollback the entire batch.
id=await store([plan('a5'),{...associated,beforeSnapshot:after,mozaikLink:link('a6')}]);await assert.rejects(confirm(id),/mozaik_link_conflict/);assert.equal(await count(),4);
const emptyScope={...link('a7'),school_year:''};id=await store([{...plan('a7'),mozaikLink:emptyScope}]);await assert.rejects(confirm(id),/invalid_mozaik_scope/);
id=await store([{...plan('a8'),writes:[{email:'one@test',grade:0}]}]);await assert.rejects(confirm(id),/metadata_grade_write_forbidden/);
assert.equal((await db.query("select has_function_privilege('anon','public.cardinal_confirm_mozaik_metadata_batch(text,uuid)','EXECUTE') as v")).rows[0].v,false);
const legacy=await call('cardinal_create_assignment_batch',['teacher@test',crypto.randomUUID(),{title:'Historical',max_score:10},['31']]);
await db.query("insert into school_mozaik_links(assignment_id,group_code,activity_id) values($1,'31','legacy-a')",[legacy.assignments[0].id]);
id=await store([plan('legacy-a')]);await assert.rejects(confirm(id),/mozaik_link_conflict/);
console.log('PASS SQL Mozaik metadata: atomic batch, replay, exact scopes, rollback, no grades, retained settings/weight/visibility, no implicit replacement, scope validation, grants');
await db.close();

