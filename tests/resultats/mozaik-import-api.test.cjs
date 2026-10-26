const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const {pathToFileURL}=require('node:url');
const apiFile=path.join(__dirname,'../../supabase/functions/school-teacher-api/mozaik-import-api.ts');
async function api(){return fs.existsSync(apiFile)?(await import(pathToFileURL(apiFile))).createMozaikImportApi:()=>({mozaikPreview:async()=>{throw Error('mozaikPreview not implemented');},mozaikConfirm:async()=>{throw Error('mozaikConfirm not implemented');}});}
const scope={groupCode:'31',schoolYear:'2026-2027',schoolId:'s',subjectId:'fr',mozaikGroupId:'m31'};
const body={scope,complete:true,activities:[{...scope,activityId:'a1',title:'Roman',maxScore:null,weight:15}],selections:[{activityId:'a1',mode:'create'}]};
function harness(rows={}){
 const stored=[],rpcs=[],reads=[];const db={from(table){reads.push(table);return{select(){return this;},contains(){return this;},eq(){return this;},then(resolve){return Promise.resolve({data:rows[table]||[],error:null}).then(resolve);},async insert(row){stored.push(row);return{error:null};}};},async rpc(name,args){rpcs.push({name,args});return{data:{assignments:[],operationId:args.p_preview_id},error:null};}};
 const deps={teacherFromToken:async()=>({email:'teacher@school.ca'}),validateKnownGroups:async(_db,groups)=>assert.deepEqual(groups,['31']),fail(message,status=400){throw Object.assign(Error(message),{status});}};return{db,deps,stored,rpcs,reads};
}
test('metadata API stores authoritative batch plans; excludes credentials and client grade writes',async()=>{
 const h=harness(),handler=(await api())(h.deps);const result=await handler.mozaikPreview(h.db,'token',{...body,teacherToken:'private',writes:[{grade:99}]});assert.match(result.previewId,/^[0-9a-f-]{36}$/);assert.equal(h.stored.length,1);assert.equal(h.stored[0].kind,'mozaik_metadata');assert.equal(h.stored[0].plan.items.length,1);assert.deepEqual(h.stored[0].plan.items[0].writes,[]);assert.equal(JSON.stringify(h.stored).includes('private'),false);assert.equal(h.reads.includes('school_students'),false);
});
test('list-only metadata preview never creates an operation',async()=>{const h=harness(),handler=(await api())(h.deps);const result=await handler.mozaikPreview(h.db,'token',{...body,selections:[]});assert.equal(result.previewId,null);assert.equal(result.preview.rows[0].status,'missing');assert.equal(h.stored.length,0);});
test('confirmation accepts only stored preview identity and uses atomic batch RPC',async()=>{const h=harness(),handler=(await api())(h.deps),id='123e4567-e89b-42d3-a456-426614174000';await handler.mozaikConfirm(h.db,'token',{previewId:id,writes:[{grade:99}]});assert.deepEqual(h.rpcs,[{name:'cardinal_confirm_mozaik_metadata_batch',args:{p_teacher:'teacher@school.ca',p_preview_id:id}}]);await assert.rejects(()=>handler.mozaikConfirm(h.db,'token',{previewId:'invalid'}));});
