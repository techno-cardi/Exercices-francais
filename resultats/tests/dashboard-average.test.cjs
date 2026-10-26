const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {stripTypeScriptTypes}=require('node:module');
const oldId='00000000-0000-4000-8000-000000000026',newId='00000000-0000-4000-8000-000000000027';
let sql,api,calls;
test.before(async()=>{
 const {PGlite}=await import('./sql-runtime/package/dist/index.js');sql=new PGlite();
 await sql.exec(fs.readFileSync(path.join(__dirname,'sql-bootstrap.sql'),'utf8'));
 await sql.exec(`alter table school_assignments add school_year integer,add split_archived boolean default false;
 create table school_year_enrollments(school_year integer,student_email text,group_code text,active boolean);
 create table school_assignment_roster(assignment_id uuid,student_email text,school_year integer,group_code text,name text,first_name text,last_name text);
 insert into school_students values('a@test.invalid','77',true),('b@test.invalid','99',false),('c@test.invalid','31',true);
 insert into school_assignments(id,title,max_score,group_codes,school_year) values('${oldId}','Old exam',22,array['31'],2026),('${newId}','New exam',22,array['31'],2027);
 insert into school_results(assignment_id,student_email,grade,feedback) values('${oldId}','a@test.invalid',10,'Keep original'),('${oldId}','b@test.invalid',20.3333,'Departed pupil'),('${newId}','c@test.invalid',0,'New cohort');
 insert into school_year_enrollments values(2026,'a@test.invalid','31',true),(2026,'b@test.invalid','31',true),(2027,'c@test.invalid','31',true);
 insert into school_assignment_roster values('${oldId}','a@test.invalid',2026,'31','A Original','A','Original'),('${oldId}','b@test.invalid',2026,'31','B Departed','B','Departed'),('${newId}','c@test.invalid',2027,'31','C New','C','New');`);
 const migration=fs.readFileSync(path.join(__dirname,'../../supabase/migrations/20261026211837_school_years_and_archives.sql'),'utf8');
 for(const name of ['cardinal_teacher_year_dashboard','cardinal_teacher_assignment_read']){
  const start=migration.indexOf('create function public.'+name+'(');assert.notEqual(start,-1);
  const end=migration.indexOf('$$;',migration.indexOf('as $$',start));assert.notEqual(end,-1);
  await sql.exec(migration.slice(start,end+3));
 }
 calls=[];
 const db={async rpc(name,args){calls.push({name,args});if(name==='cardinal_year_catalog')return{data:{activeYear:2027,enforced:true,years:[{year:2026,status:'archived'},{year:2027,status:'open'}]}};
  assert.ok(['cardinal_teacher_year_dashboard','cardinal_teacher_assignment_read'].includes(name));
  const {rows}=await sql.query(`select public.${name}($1) value`,[args.p_year??args.p_id]);return{data:rows[0].value};}};
 const source=['../_shared/school-years.ts','year-read-api.ts'].map(name=>fs.readFileSync(path.join(__dirname,'../../supabase/functions/school-teacher-api',name),'utf8').replace(/^import .*$/gm,'').replace(/^export /gm,'')).join('\n');
 const context=vm.createContext({teacherFromToken:async()=>({email:'teacher'}),assignmentShape:a=>({id:a.id,maxScore:a.max_score,groups:a.group_codes,schoolYear:a.school_year}),fail:message=>{throw Error(message);},db});
 vm.runInContext(stripTypeScriptTypes(source,{mode:'transform'})+'\nglobalThis.reads=createAnnualReadApi({teacherFromToken,assignmentShape,fail});',context);
 api={dashboard:body=>context.reads.dashboard(db,'t',body),assignment:body=>context.reads.assignment(db,'t',body)};
});
test.after(async()=>{await sql?.close();});

test('actual dashboard SQL preserves the unrounded mean through the annual API',async()=>{
 const out=await api.dashboard({schoolYear:2026});
 assert.equal(out.assignments.length,1);assert.equal(out.assignments[0].average,(10+20.3333)/2);
 assert.equal(out.assignments[0].gradedCount,2);assert.equal(out.assignments[0].studentCount,2);
 assert.equal(out.context.readOnly,true);
});

test('same group code in another year never contributes work, grades, or counts',async()=>{
 const old=await api.dashboard({schoolYear:2026}),current=await api.dashboard({schoolYear:2027});
 assert.deepEqual(Array.from(old.assignments,a=>a.id),[oldId]);assert.deepEqual(Array.from(current.assignments,a=>a.id),[newId]);
 assert.equal(old.groups['31'],2);assert.equal(current.groups['31'],1);assert.equal(current.assignments[0].average,0);
 assert.ok(calls.some(c=>c.name==='cardinal_teacher_year_dashboard'&&c.args.p_year===2026));
 assert.ok(calls.some(c=>c.name==='cardinal_teacher_year_dashboard'&&c.args.p_year===2027));
});

test('historical detail retains moved and inactive pupils with original feedback and group',async()=>{
 const out=await api.assignment({assignmentId:oldId});
 assert.equal(out.assignment.readOnly,true);assert.equal(out.students.length,2);
 const departed=out.students.find(s=>s.email==='b@test.invalid');
 assert.equal(departed.group,'31');assert.equal(departed.grade,20.3333);assert.equal(departed.feedback,'Departed pupil');
 assert.equal(out.students.find(s=>s.email==='a@test.invalid').feedback,'Keep original');
 assert.equal(out.students.some(s=>s.email==='c@test.invalid'),false);
});
