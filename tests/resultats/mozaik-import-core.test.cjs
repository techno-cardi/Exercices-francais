const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const sandbox={module:{exports:{}}};const file=path.join(__dirname,'../../supabase/functions/school-teacher-api/mozaik-import-core.js');
if(fs.existsSync(file))vm.runInNewContext(fs.readFileSync(file,'utf8'),sandbox);
const preview=sandbox.module.exports.buildMetadataPreview||(()=>{throw Error('buildMetadataPreview not implemented');});
const plain=x=>JSON.parse(JSON.stringify(x));
const scope={groupCode:'31',schoolYear:'2026-2027',schoolId:'school',subjectId:'fr',mozaikGroupId:'mg31'};
const activity=(overrides={})=>({...scope,activityId:'a1',planningId:'p1',title:'Roman',activityDate:'2026-11-03',term:1,maxScore:10,weight:15,reportCardEnabled:true,resultsVisible:true,...overrides});
const fixture=(overrides={})=>({scope,activities:[activity()],assignments:[],links:[],complete:true,...overrides});

test('exact scoped activity link survives rename and isolates other groups and years',()=>{
 const p=preview(fixture({activities:[activity({title:'Renommé'})],assignments:[{id:'g1',title:'Avant',group_codes:['31']}],links:[{...scope,activityId:'a1',assignmentId:'g1'},{...scope,schoolYear:'2025-2026',activityId:'a1',assignmentId:'old'}]}));
 assert.equal(p.rows[0].status,'linked');assert.equal(p.rows[0].assignmentId,'g1');assert.equal(p.rows[0].selectable,false);
});
test('one title suggestion is already_exists but never automatically associated',()=>{
 const p=preview(fixture({assignments:[{id:'g1',title:'RÔMAN',group_codes:['31'],activity_date:'2026-11-03',term:1},{id:'g2',title:'Roman',group_codes:['32']}]}));
 assert.equal(p.rows[0].status,'already_exists');assert.equal(p.rows[0].assignmentId,null);assert.deepEqual(plain(p.rows[0].candidates.map(a=>a.id)),['g1']);assert.equal(p.plans.length,0);
});
test('duplicate title candidates stay ambiguous; explicit association writes no settings or grades',()=>{
 const a={id:'g1',title:'Roman',group_codes:['31'],weight:42,max_score:40,published:true,source_metadata:{other:'keep'}};
 const f=fixture({assignments:[a,{...a,id:'g2'}],snapshots:{g1:{assignment:a,results:[{grade:35}]}},selections:[{activityId:'a1',mode:'associate',assignmentId:'g1'}]});
 const p=preview(f);assert.equal(p.rows[0].status,'ambiguous');assert.equal(p.plans[0].assignmentId,'g1');assert.deepEqual(plain(p.plans[0].writes),[]);assert.deepEqual(plain(Object.keys(p.plans[0].assignmentPatch)),['source_metadata']);assert.equal(p.plans[0].assignmentPatch.source_metadata.other,'keep');
});
test('metadata create preserves weight, visibility and scope without inventing a maximum',()=>{
 const p=preview(fixture({activities:[activity({maxScore:null,weight:0,weightCategoryId:'cat1',reportCardEnabled:false,resultsVisible:true})],selections:[{activityId:'a1',mode:'create'}]}));
 const plan=p.plans[0],a=plan.newAssignment;assert.equal(a.max_score,null);assert.equal(a.import_state,'metadata_only');assert.equal(a.weight,0);assert.equal(a.published,false);assert.equal(a.mozaik_results_visible,true);assert.equal(a.report_card_enabled,false);assert.equal(a.source_metadata.mozaik.weightCategoryId,'cat1');assert.equal(plan.mozaikLink.school_year,'2026-2027');assert.equal(plan.mozaikLink.mozaik_group_id,'mg31');assert.deepEqual(plain(plan.writes),[]);
});
test('zero source maximum is preserved as metadata and null Gestion maximum; null weight stays null',()=>{
 const p=preview(fixture({activities:[activity({maxScore:0,weight:null})],selections:[{activityId:'a1',mode:'create'}]}));assert.equal(p.plans[0].newAssignment.max_score,null);assert.equal(p.plans[0].newAssignment.weight,null);assert.equal(p.plans[0].newAssignment.source_metadata.mozaik.maxScore,0);
});
test('missing or mismatched scope, duplicate activities, incomplete list and wrong destinations reject selection',()=>{
 for(const f of [fixture({scope:{...scope,schoolYear:''}}),fixture({activities:[activity({mozaikGroupId:'mg32'})]}),fixture({activities:[activity(),activity()]}),fixture({complete:false,selections:[{activityId:'a1',mode:'create'}]}),fixture({selections:[{activityId:'unknown',mode:'create'}]}),fixture({assignments:[{id:'g1',title:'Roman',group_codes:['31','32']}],selections:[{activityId:'a1',mode:'associate',assignmentId:'g1'}]})])assert.throws(()=>preview(f));
});
test('already-linked activity and two activities targeting one Gestion work cannot be selected',()=>{
 assert.throws(()=>preview(fixture({assignments:[{id:'g1',group_codes:['31']}],links:[{...scope,activityId:'a1',assignmentId:'g1'}],selections:[{activityId:'a1',mode:'create'}]})));
 const a={id:'g1',group_codes:['31'],source_metadata:{}};
 assert.throws(()=>preview(fixture({activities:[activity(),activity({activityId:'a2'})],assignments:[a],snapshots:{g1:{assignment:a,results:[]}},selections:[{activityId:'a1',mode:'associate',assignmentId:'g1'},{activityId:'a2',mode:'associate',assignmentId:'g1'}]})));
});
test('arbitrary cookies, student records and notes are discarded from stored metadata',()=>{
 const p=preview(fixture({activities:[activity({cookie:'secret',students:[{email:'private',grade:9}],results:[{score:9}],token:'secret'})],selections:[{activityId:'a1',mode:'create'}]}));
 const stored=JSON.stringify(p.plans);assert.equal(stored.includes('secret'),false);assert.equal(stored.includes('private'),false);assert.equal(stored.includes('score'),true);assert.equal(p.plans[0].newAssignment.weight,15);
});

test('historical link without verified year is ambiguous and cannot create a duplicate',()=>{
 const f=fixture({assignments:[{id:'g1',title:'Before',group_codes:['31']}],links:[{groupCode:'31',activityId:'a1',assignmentId:'g1'}]});
 const p=preview(f);assert.equal(p.rows[0].status,'ambiguous');assert.equal(p.rows[0].selectable,false);
 assert.throws(()=>preview({...f,selections:[{activityId:'a1',mode:'create'}]}),/déjà liée/);
});

test('native numeric strings and ISO calendar dates normalize only DB fields while retaining raw metadata',()=>{
 const p=preview(fixture({activities:[activity({term:'2',period:'4',activityDate:'2027-02-03T00:00:00Z',maxScore:'40',weight:'15'})],selections:[{activityId:'a1',mode:'create'}]}));
 const a=p.plans[0].newAssignment;assert.equal(a.term,2);assert.equal(a.mozaik_period,4);assert.equal(a.activity_date,'2027-02-03');assert.equal(a.max_score,40);assert.equal(a.weight,15);
 assert.equal(a.source_metadata.mozaik.term,'2');assert.equal(a.source_metadata.mozaik.period,'4');assert.equal(a.source_metadata.mozaik.activityDate,'2027-02-03T00:00:00Z');assert.equal(a.source_metadata.mozaik.maxScore,'40');assert.equal(a.source_metadata.mozaik.weight,'15');
 const offset=preview(fixture({activities:[activity({activityDate:'2027-02-03T23:00:00-05:00'})],selections:[{activityId:'a1',mode:'create'}]}));assert.equal(offset.plans[0].newAssignment.activity_date,'2027-02-03');
});
test('empty native strings never become zero or invented dates; malformed dates block selected creation',()=>{
 const a=preview(fixture({activities:[activity({term:' ',period:'',activityDate:'',maxScore:'',weight:' '})],selections:[{activityId:'a1',mode:'create'}]})).plans[0].newAssignment;
 assert.equal(a.max_score,null);assert.equal(a.weight,null);assert.equal(a.import_state,'metadata_only');assert.equal(a.term,undefined);assert.equal(a.mozaik_period,undefined);assert.equal(a.activity_date,undefined);
 for(const activityDate of ['tomorrow','2027-02-30','2027-02-03garbage','2027-02-03T99:00:00Z'])assert.throws(()=>preview(fixture({activities:[activity({activityDate})],selections:[{activityId:'a1',mode:'create'}]})),/Date/);
});
