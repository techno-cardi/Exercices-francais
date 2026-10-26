const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const source=path.resolve(__dirname,'../../supabase/functions/school-teacher-api/split-api.ts');
test('split API authenticates teacher, binds preview mappings, and confirms only server-stored plan',async()=>{
 assert.ok(fs.existsSync(source),'split adapter must exist');
 const {createSplitApi}=await import(pathToFileURL(source));
 const calls=[];
 const api=createSplitApi({teacherFromToken:async(db,token)=>{assert.equal(token,'teacher-token');return {email:'teacher@test'};},fail:(message,status=400)=>{throw Object.assign(Error(message),{status});}});
 const db={rpc:async(name,args)=>{calls.push({name,args});return {data:{previewId:'preview',preview:{canConfirm:false}},error:null};}};
 const id='00000000-0000-4000-8000-000000000099';
 await api.splitPreview(db,'teacher-token',{assignmentId:id,resultGroups:{'unknown@test':'102'},formativeGroupCode:'101'});
 assert.deepEqual(calls[0],{name:'cardinal_preview_assignment_split',args:{p_teacher:'teacher@test',p_assignment_id:id,p_result_groups:{'unknown@test':'102'},p_formative_group:'101'}});
 await api.splitConfirm(db,'teacher-token',{previewId:id,plan:{arbitrary:'ignore'},resultGroups:{'unknown@test':'101'}});
 assert.deepEqual(calls[1],{name:'cardinal_confirm_assignment_split',args:{p_teacher:'teacher@test',p_preview_id:id}});
 await assert.rejects(api.splitPreview(db,'teacher-token',{assignmentId:'invalid'}),/identifiant/i);
 await assert.rejects(api.splitConfirm(db,'teacher-token',{previewId:'invalid'}),/identifiant/i);
 assert.equal(calls.length,2);
});
test('split API presents stale/conflict and authentication failures without database detail disclosure',async()=>{
 const {createSplitApi}=await import(pathToFileURL(source));
 const api=createSplitApi({teacherFromToken:async()=>({email:'teacher@test'}),fail:(message,status=400)=>{throw Object.assign(Error(message),{status});}});
 const id='00000000-0000-4000-8000-000000000099';
 for(const [error,status,pattern] of [['stale_preview',409,/aperçu/i],['split_unresolved_results',409,/attribu/i],['operation_teacher_mismatch',401,/session/i],['secret detail',409,/séparation/i]]){
  await assert.rejects(api.splitConfirm({rpc:async()=>({error:{message:error}})},'',{previewId:id}),e=>e.status===status&&pattern.test(e.message)&&!e.message.includes('secret detail'));
 }
});
