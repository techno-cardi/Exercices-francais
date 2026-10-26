const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('dashboard preserves the unrounded mean so percentage agrees with detail statistics',async()=>{
 const source=fs.readFileSync(require('node:path').join(__dirname,'../../supabase/functions/school-teacher-api/index.ts'),'utf8');
 const data={school_assignments:[{id:'a',group_codes:['31'],max_score:22}],school_students:[{email:'a',group_code:'31'},{email:'b',group_code:'31'}],school_results:[{assignment_id:'a',grade:10},{assignment_id:'a',grade:20.3333}]};
 const db={from(table){const q={select(){return q;},eq(){return q;},order(){return q;},then(resolve,reject){return Promise.resolve({data:data[table]}).then(resolve,reject);}};return q;}};
 const context=vm.createContext({ASSIGNMENT_SELECT:'*',teacherFromToken:async()=>({email:'teacher'}),fail:message=>{throw Error(message);},assignmentShape:a=>({id:a.id,maxScore:a.max_score}),cleanGroupCode:String});
 vm.runInContext(require('node:module').stripTypeScriptTypes(source.slice(source.indexOf('async function dashboard('),source.indexOf('async function assignment('))),context);
 const out=await context.dashboard(db,'t');
 assert.equal(out.assignments[0].average,(10+20.3333)/2);assert.equal(out.assignments[0].gradedCount,2);
});
